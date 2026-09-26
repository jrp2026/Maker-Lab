/**
 * Arduino sketch compiler: parses a practical subset of C/C++ and emits JavaScript
 * generator functions. Static types drive integer semantics (16-bit int on AVR,
 * truncating division, overflow wrap), and every loop iteration charges virtual CPU
 * time and can yield, so `delay()` and busy loops interleave with the circuit solver.
 */
import { CompileError, tokenize, type Token } from './lexer';
import { UNO, type BoardSpec } from './boards';

export { CompileError };

type Base = 'void' | 'bool' | 'char' | 'uchar' | 'int' | 'uint' | 'long' | 'ulong' | 'float' | 'String' | 'obj' | 'func';

interface Type {
  b: Base;
  dims?: (number | null)[];
  isConst?: boolean;
  /** pointer depth (int* → 1) */
  ptr?: number;
  /** library class for b === 'obj' */
  cls?: string;
  /** reference parameter / variable (int &x) */
  ref?: boolean;
}

const isPtr = (t: Type) => !!t.ptr && !t.dims;

/** Apply `n` levels of `*` to a declared type. `char*` is treated as a string. */
function withPtr(t: Type, n: number): Type {
  if (!n) return t;
  if ((t.b === 'char' || t.b === 'uchar') && n === 1) return { b: 'String', isConst: t.isConst };
  return { ...t, ptr: (t.ptr ?? 0) + n };
}

/** Element type of an array or pointer. */
function elemOf(t: Type): Type {
  if (t.dims) {
    const dims = t.dims.slice(1);
    const { dims: _d, ...rest } = t;
    void _d;
    return dims.length ? { ...rest, dims, isConst: false } : { ...rest, isConst: false };
  }
  const p = (t.ptr ?? 0) - 1;
  const { ptr: _p, ...rest } = t;
  void _p;
  return p > 0 ? { ...rest, ptr: p } : rest;
}

const T = (b: Base): Type => ({ b });

// ---------------------------------------------------------------- AST

type Expr =
  | { k: 'num'; v: number; t: Type; tok: Token }
  | { k: 'str'; v: string; tok: Token }
  | { k: 'id'; name: string; tok: Token }
  | { k: 'bin'; op: string; l: Expr; r: Expr; tok: Token }
  | { k: 'un'; op: string; e: Expr; tok: Token }
  | { k: 'post'; op: string; e: Expr; tok: Token }
  | { k: 'assign'; op: string; l: Expr; r: Expr; tok: Token }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr; tok: Token }
  | { k: 'call'; callee: Expr; args: Expr[]; tok: Token }
  | { k: 'member'; obj: Expr; name: string; tok: Token }
  | { k: 'index'; obj: Expr; idx: Expr; tok: Token }
  | { k: 'cast'; to: Type; e: Expr; tok: Token }
  | { k: 'sizeof'; type?: Type; e?: Expr; tok: Token }
  | { k: 'comma'; l: Expr; r: Expr; tok: Token }
  | { k: 'init'; items: Expr[]; tok: Token }
  | { k: 'new'; cls: string; args: Expr[]; tok: Token };

interface Declarator {
  name: string;
  type: Type;
  init?: Expr;
  tok: Token;
}

type Stmt =
  | { k: 'block'; body: Stmt[] }
  | { k: 'decl'; decls: Declarator[]; isStatic: boolean }
  | { k: 'expr'; e: Expr }
  | { k: 'if'; c: Expr; a: Stmt; b?: Stmt }
  | { k: 'while'; c: Expr; body: Stmt }
  | { k: 'do'; c: Expr; body: Stmt }
  | { k: 'for'; init?: Stmt; c?: Expr; step?: Expr; body: Stmt }
  | { k: 'switch'; e: Expr; cases: { test?: Expr; body: Stmt[] }[] }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'return'; e?: Expr; tok: Token }
  | { k: 'empty' };

interface FuncDef {
  name: string;
  ret: Type;
  params: { name: string; type: Type }[];
  body: Stmt;
  tok: Token;
}

// ---------------------------------------------------------------- parser

const TYPE_WORDS = new Set([
  'void', 'bool', 'boolean', 'char', 'byte', 'int', 'short', 'long', 'float', 'double', 'unsigned', 'signed', 'String', 'word',
  'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'uint64_t', 'int64_t', 'size_t',
]);
const QUALIFIERS = new Set(['const', 'static', 'volatile', 'inline', 'constexpr', 'register', 'extern']);
/** Arduino library classes the simulator implements. */
const CLASS_TYPES = new Set(['Servo', 'LiquidCrystal', 'LiquidCrystal_I2C']);
const UNSUPPORTED_TYPES: Record<string, string> = {
  Adafruit_NeoPixel: 'The NeoPixel library is on the roadmap (Phase 2) and not supported yet.',
  struct: 'struct is not supported in this simulator yet.',
  class: 'class is not supported in this simulator yet.',
  typedef: 'typedef is not supported in this simulator yet.',
};

/** Set per compile: `int` is 16-bit on AVR, 32-bit on ESP32. */
let INT32 = false;

class Parser {
  i = 0;
  enums = new Map<string, number>();
  consts = new Map<string, number>();
  constructor(private toks: Token[]) {}

  get cur() {
    return this.toks[this.i];
  }
  peek(o = 1) {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)];
  }
  err(msg: string, t: Token = this.cur): never {
    throw new CompileError(msg, t.line, t.col);
  }
  is(v: string, t = this.cur) {
    return (t.k === 'op' || t.k === 'id') && t.v === v;
  }
  eat(v: string) {
    if (this.is(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  expect(v: string): Token {
    if (!this.is(v)) {
      const got = this.cur.k === 'eof' ? 'end of input' : `'${this.cur.v}'`;
      this.err(`expected '${v}' before ${got}`);
    }
    return this.toks[this.i++];
  }
  ident(): Token {
    if (this.cur.k !== 'id') this.err(`expected identifier before '${this.cur.v}'`);
    return this.toks[this.i++];
  }

  isTypeStart(o = 0): boolean {
    let j = this.i + o;
    while (this.toks[j].k === 'id' && QUALIFIERS.has(this.toks[j].v)) j++;
    const t = this.toks[j];
    if (t.k !== 'id') return false;
    if (UNSUPPORTED_TYPES[t.v] && this.toks[j + 1]?.k === 'id') throw new CompileError(UNSUPPORTED_TYPES[t.v], t.line, t.col);
    return TYPE_WORDS.has(t.v) || CLASS_TYPES.has(t.v);
  }

  /** Consume `*` (and `const` after them); returns the pointer depth. */
  stars(): number {
    let n = 0;
    while (this.is('*')) {
      this.i++;
      n++;
      while (this.is('const')) this.i++;
    }
    return n;
  }

  /** Parse qualifiers + base type. */
  parseType(): { type: Type; isStatic: boolean } {
    let isStatic = false, isConst = false;
    while (this.cur.k === 'id' && QUALIFIERS.has(this.cur.v)) {
      if (this.cur.v === 'static') isStatic = true;
      if (this.cur.v === 'const' || this.cur.v === 'constexpr') isConst = true;
      this.i++;
    }
    if (this.cur.k === 'id' && CLASS_TYPES.has(this.cur.v)) {
      const cls = this.cur.v;
      this.i++;
      return { type: { b: 'obj', cls, isConst }, isStatic };
    }
    let unsigned = false, signed = false, longs = 0, short = false;
    let base: string | null = null;
    const start = this.cur;
    while (this.cur.k === 'id' && TYPE_WORDS.has(this.cur.v)) {
      const w = this.cur.v;
      if (w === 'unsigned') unsigned = true;
      else if (w === 'signed') signed = true;
      else if (w === 'long') longs++;
      else if (w === 'short') short = true;
      else {
        if (base) break;
        base = w;
      }
      this.i++;
      if (this.cur.k === 'id' && QUALIFIERS.has(this.cur.v)) {
        if (this.cur.v === 'const') isConst = true;
        this.i++;
      }
    }
    void signed;
    let b: Base;
    switch (base) {
      case 'void': b = 'void'; break;
      case 'bool': case 'boolean': b = 'bool'; break;
      case 'char': b = unsigned ? 'uchar' : 'char'; break;
      case 'byte': case 'uint8_t': b = 'uchar'; break;
      case 'int8_t': b = 'char'; break;
      case 'float': case 'double': b = 'float'; break;
      case 'String': b = 'String'; break;
      case 'word': case 'uint16_t': b = 'uint'; break;
      case 'int16_t': b = 'int'; break;
      case 'uint32_t': case 'size_t': case 'uint64_t': b = 'ulong'; break;
      case 'int32_t': case 'int64_t': b = 'long'; break;
      case 'int': case null:
        if (base === null && !unsigned && !longs && !short) this.err('expected type', start);
        if (longs || (INT32 && !short)) b = unsigned ? 'ulong' : 'long';
        else b = unsigned ? 'uint' : 'int';
        break;
      default:
        this.err(`unknown type '${base}'`, start);
    }
    return { type: { b, isConst }, isStatic };
  }

  parseProgram() {
    const globals: Stmt[] = [];
    const funcs: FuncDef[] = [];
    while (this.cur.k !== 'eof') {
      if (this.eat(';')) continue;
      if (this.is('enum')) {
        globals.push(this.parseEnum());
        continue;
      }
      if (this.cur.k === 'id' && UNSUPPORTED_TYPES[this.cur.v]) this.err(UNSUPPORTED_TYPES[this.cur.v]);
      if (!this.isTypeStart()) {
        if (this.cur.k === 'id' && this.peek().k === 'id') this.err(`'${this.cur.v}' does not name a type`);
        this.err(`expected declaration before '${this.cur.v}'`);
      }
      const save = this.i;
      const { type: baseType } = this.parseType();
      const type = withPtr(baseType, this.stars());
      this.eat('&');
      const nameTok = this.ident();
      if (this.is('(') && type.b !== 'obj') {
        this.i++;
        const params: { name: string; type: Type }[] = [];
        if (!this.is(')')) {
          if (this.is('void') && this.peek().v === ')') this.i++;
          else
            do {
              const { type: bt } = this.parseType();
              let pt = withPtr(bt, this.stars());
              if (this.eat('&')) pt = { ...pt, ref: true };
              const pn = this.cur.k === 'id' ? this.ident().v : `_p${params.length}`;
              const dims: (number | null)[] = [];
              while (this.eat('[')) {
                dims.push(this.cur.k === 'num' ? this.toks[this.i++].n! : null);
                this.expect(']');
              }
              params.push({ name: pn, type: dims.length ? { ...pt, dims } : pt });
            } while (this.eat(','));
        }
        this.expect(')');
        if (this.eat(';')) continue; // prototype
        const body = this.parseBlock();
        funcs.push({ name: nameTok.v, ret: type, params, body, tok: nameTok });
      } else {
        this.i = save;
        globals.push(this.parseDecl());
      }
    }
    return { globals, funcs };
  }

  parseEnum(): Stmt {
    this.expect('enum');
    if (this.cur.k === 'id') this.i++;
    this.expect('{');
    let val = 0;
    const decls: Declarator[] = [];
    while (!this.is('}')) {
      const nt = this.ident();
      if (this.eat('=')) {
        const v = constEval(this.parseAssign(), this.consts);
        if (v === undefined) this.err('enum values must be constants', nt);
        val = v;
      }
      this.enums.set(nt.v, val);
      decls.push({ name: nt.v, type: { b: 'int', isConst: true }, init: { k: 'num', v: val, t: T('int'), tok: nt }, tok: nt });
      val++;
      if (!this.eat(',')) break;
    }
    this.expect('}');
    // optional variable declarations after the enum body
    while (this.cur.k === 'id' && !this.is(';')) {
      const nt = this.ident();
      decls.push({ name: nt.v, type: T('int'), tok: nt });
      if (!this.eat(',')) break;
    }
    this.expect(';');
    return { k: 'decl', decls, isStatic: false };
  }

  parseDecl(requireSemi = true): Stmt {
    const { type: baseType, isStatic } = this.parseType();
    const decls: Declarator[] = [];
    do {
      let type = withPtr(baseType, this.stars());
      if (this.eat('&')) type = { ...type, ref: true };
      const nameTok = this.ident();
      const dims: (number | null)[] = [];
      while (this.eat('[')) {
        if (this.is(']')) dims.push(null);
        else {
          const e = this.parseCond();
          const v = constEval(e, this.consts);
          if (v === undefined) this.err('array size must be a constant', nameTok);
          dims.push(v);
        }
        this.expect(']');
      }
      let init: Expr | undefined;
      if (this.eat('=')) init = this.is('{') ? this.parseInitList() : this.parseAssign();
      else if (this.is('(') && type.b === 'obj') {
        // LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
        const t = this.cur;
        this.i++;
        const args: Expr[] = [];
        if (!this.is(')')) do args.push(this.parseAssign()); while (this.eat(','));
        this.expect(')');
        init = { k: 'new', cls: type.cls!, args, tok: t };
      } else if (this.is('(') && type.b === 'String') {
        // String s("abc");
        const t = this.cur;
        this.i++;
        const args: Expr[] = [];
        if (!this.is(')')) do args.push(this.parseAssign()); while (this.eat(','));
        this.expect(')');
        init = { k: 'call', callee: { k: 'id', name: 'String', tok: t }, args, tok: t };
      }
      if (type.isConst && !dims.length && init) {
        const cv = constEval(init, this.consts);
        if (cv !== undefined) this.consts.set(nameTok.v, cv);
      }
      decls.push({ name: nameTok.v, type: dims.length ? { ...type, dims } : { ...type }, init, tok: nameTok });
    } while (this.eat(','));
    if (requireSemi) this.expect(';');
    return { k: 'decl', decls, isStatic };
  }

  parseInitList(): Expr {
    const tok = this.expect('{');
    const items: Expr[] = [];
    while (!this.is('}')) {
      items.push(this.is('{') ? this.parseInitList() : this.parseAssign());
      if (!this.eat(',')) break;
    }
    this.expect('}');
    return { k: 'init', items, tok };
  }

  parseBlock(): Stmt {
    this.expect('{');
    const body: Stmt[] = [];
    while (!this.is('}')) {
      if (this.cur.k === 'eof') this.err("expected '}' at end of input");
      body.push(this.parseStmt());
    }
    this.expect('}');
    return { k: 'block', body };
  }

  parseStmt(): Stmt {
    const t = this.cur;
    if (this.is('{')) return this.parseBlock();
    if (this.eat(';')) return { k: 'empty' };
    if (t.k === 'id') {
      switch (t.v) {
        case 'if': {
          this.i++;
          this.expect('(');
          const c = this.parseExpr();
          this.expect(')');
          const a = this.parseStmt();
          const b = this.eat('else') ? this.parseStmt() : undefined;
          return { k: 'if', c, a, b };
        }
        case 'while': {
          this.i++;
          this.expect('(');
          const c = this.parseExpr();
          this.expect(')');
          return { k: 'while', c, body: this.parseStmt() };
        }
        case 'do': {
          this.i++;
          const body = this.parseStmt();
          this.expect('while');
          this.expect('(');
          const c = this.parseExpr();
          this.expect(')');
          this.expect(';');
          return { k: 'do', c, body };
        }
        case 'for': {
          this.i++;
          this.expect('(');
          let init: Stmt | undefined;
          if (!this.is(';')) init = this.isTypeStart() ? this.parseDecl(false) : { k: 'expr', e: this.parseExpr() };
          this.expect(';');
          const c = this.is(';') ? undefined : this.parseExpr();
          this.expect(';');
          const step = this.is(')') ? undefined : this.parseExpr();
          this.expect(')');
          return { k: 'for', init, c, step, body: this.parseStmt() };
        }
        case 'switch': {
          this.i++;
          this.expect('(');
          const e = this.parseExpr();
          this.expect(')');
          this.expect('{');
          const cases: { test?: Expr; body: Stmt[] }[] = [];
          while (!this.is('}')) {
            if (this.eat('case')) {
              const test = this.parseCond();
              this.expect(':');
              cases.push({ test, body: [] });
            } else if (this.eat('default')) {
              this.expect(':');
              cases.push({ body: [] });
            } else {
              if (!cases.length) this.err("statement before first 'case' label");
              cases[cases.length - 1].body.push(this.parseStmt());
            }
          }
          this.expect('}');
          return { k: 'switch', e, cases };
        }
        case 'break':
          this.i++;
          this.expect(';');
          return { k: 'break' };
        case 'continue':
          this.i++;
          this.expect(';');
          return { k: 'continue' };
        case 'return': {
          this.i++;
          const e = this.is(';') ? undefined : this.parseExpr();
          this.expect(';');
          return { k: 'return', e, tok: t };
        }
        case 'goto':
          this.err('goto is not supported');
      }
      if (this.isTypeStart()) return this.parseDecl();
      if (UNSUPPORTED_TYPES[t.v]) this.err(UNSUPPORTED_TYPES[t.v]);
    }
    const e = this.parseExpr();
    this.expect(';');
    return { k: 'expr', e };
  }

  // ---- expressions (precedence climbing)
  parseExpr(): Expr {
    let e = this.parseAssign();
    while (this.is(',')) {
      const tok = this.toks[this.i++];
      e = { k: 'comma', l: e, r: this.parseAssign(), tok };
    }
    return e;
  }

  parseAssign(): Expr {
    const l = this.parseCond();
    const t = this.cur;
    if (t.k === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(t.v)) {
      this.i++;
      const r = this.is('{') ? this.parseInitList() : this.parseAssign();
      return { k: 'assign', op: t.v, l, r, tok: t };
    }
    return l;
  }

  parseCond(): Expr {
    const c = this.parseBin(0);
    if (this.is('?')) {
      const tok = this.toks[this.i++];
      const a = this.parseAssign();
      this.expect(':');
      const b = this.parseAssign();
      return { k: 'cond', c, a, b, tok };
    }
    return c;
  }

  static PREC: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
  };

  parseBin(minPrec: number): Expr {
    let l = this.parseUnary();
    for (;;) {
      const t = this.cur;
      const p = t.k === 'op' ? Parser.PREC[t.v] : undefined;
      if (p === undefined || p <= minPrec - 1 || p < minPrec) break;
      this.i++;
      const r = this.parseBin(p + 1);
      l = { k: 'bin', op: t.v, l, r, tok: t };
    }
    return l;
  }

  parseUnary(): Expr {
    const t = this.cur;
    if (t.k === 'op' && ['-', '+', '!', '~', '++', '--'].includes(t.v)) {
      this.i++;
      return { k: 'un', op: t.v, e: this.parseUnary(), tok: t };
    }
    if (t.k === 'op' && (t.v === '*' || t.v === '&')) {
      this.i++;
      return { k: 'un', op: t.v, e: this.parseUnary(), tok: t };
    }
    if (this.is('sizeof')) {
      this.i++;
      this.expect('(');
      let r: Expr;
      if (this.isTypeStart()) r = { k: 'sizeof', type: withPtr(this.parseType().type, this.stars()), tok: t };
      else r = { k: 'sizeof', e: this.parseExpr(), tok: t };
      this.expect(')');
      return r;
    }
    // C-style cast
    if (this.is('(') && this.isTypeStart(1)) {
      this.i++;
      const { type: bt } = this.parseType();
      const type = withPtr(bt, this.stars());
      this.expect(')');
      return { k: 'cast', to: type, e: this.parseUnary(), tok: t };
    }
    return this.parsePostfix();
  }

  parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      const t = this.cur;
      if (this.is('(')) {
        this.i++;
        const args: Expr[] = [];
        if (!this.is(')')) do args.push(this.parseAssign()); while (this.eat(','));
        this.expect(')');
        e = { k: 'call', callee: e, args, tok: t };
      } else if (this.is('[')) {
        this.i++;
        const idx = this.parseExpr();
        this.expect(']');
        e = { k: 'index', obj: e, idx, tok: t };
      } else if (this.is('.') || this.is('->')) {
        this.i++;
        e = { k: 'member', obj: e, name: this.ident().v, tok: t };
      } else if (this.is('++') || this.is('--')) {
        this.i++;
        e = { k: 'post', op: t.v, e, tok: t };
      } else break;
    }
    return e;
  }

  parsePrimary(): Expr {
    const t = this.cur;
    if (t.k === 'num') {
      this.i++;
      let type: Type;
      const s = t.suffix ?? '';
      if (t.isFloat) type = T('float');
      else if (s.includes('u') && s.includes('l')) type = T('ulong');
      else if (s.includes('l')) type = T('long');
      else if (s.includes('u')) type = t.n! <= 0xffff ? T('uint') : T('ulong');
      else if (t.n! <= 32767 && !INT32) type = T('int');
      else if (t.n! <= 0x7fffffff) type = T('long');
      else type = T('ulong');
      return { k: 'num', v: t.n!, t: type, tok: t };
    }
    if (t.k === 'char') {
      this.i++;
      return { k: 'num', v: t.n!, t: T('char'), tok: t };
    }
    if (t.k === 'str') {
      this.i++;
      return { k: 'str', v: t.v, tok: t };
    }
    if (t.k === 'id') {
      if (t.v === 'true' || t.v === 'false') {
        this.i++;
        return { k: 'num', v: t.v === 'true' ? 1 : 0, t: T('bool'), tok: t };
      }
      if (this.enums.has(t.v)) {
        this.i++;
        return { k: 'num', v: this.enums.get(t.v)!, t: T('int'), tok: t };
      }
      // functional cast: int(x), float(x), byte(x), String(x) — also handles `unsigned long(x)` poorly but rarely used
      if (TYPE_WORDS.has(t.v) && this.peek().v === '(' && t.v !== 'String') {
        const { type } = this.parseType();
        this.expect('(');
        const e = this.parseExpr();
        this.expect(')');
        return { k: 'cast', to: type, e, tok: t };
      }
      this.i++;
      // Scope resolution like Serial::foo is not supported; treat Class::X as X
      return { k: 'id', name: t.v, tok: t };
    }
    if (this.is('(')) {
      this.i++;
      const e = this.parseExpr();
      this.expect(')');
      return e;
    }
    if (t.k === 'eof') this.err('unexpected end of input');
    this.err(`expected expression before '${t.v}'`);
  }
}

function constEval(e: Expr, consts: Map<string, number>): number | undefined {
  const rec = (x: Expr) => constEval(x, consts);
  switch (e.k) {
    case 'num':
      return e.v;
    case 'id':
      return consts.get(e.name);
    case 'un': {
      const v = rec(e.e);
      if (v === undefined) return undefined;
      return e.op === '-' ? -v : e.op === '+' ? v : e.op === '~' ? ~v : e.op === '!' ? +!v : undefined;
    }
    case 'bin': {
      const l = rec(e.l), r = rec(e.r);
      if (l === undefined || r === undefined) return undefined;
      switch (e.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return Math.trunc(l / r);
        case '%': return l % r;
        case '<<': return l << r;
        case '>>': return l >> r;
        case '|': return l | r;
        case '&': return l & r;
        case '^': return l ^ r;
      }
      return undefined;
    }
    case 'cast':
      return rec(e.e);
  }
  return undefined;
}

// ---------------------------------------------------------------- code generation

const RANK: Partial<Record<Base, number>> = { bool: 1, char: 1, uchar: 1, int: 1, uint: 2, long: 3, ulong: 4, float: 5 };
const SIZE: Record<Base, number> = { void: 0, bool: 1, char: 1, uchar: 1, int: 2, uint: 2, long: 4, ulong: 4, float: 4, String: 6, obj: 2, func: 2 };

function isNumeric(t: Type) {
  return !t.dims && !t.ptr && RANK[t.b] !== undefined;
}

function typeName(t: Type): string {
  if (t.dims) return 'array';
  if (t.ptr) return `${t.b}${'*'.repeat(t.ptr)}`;
  if (t.b === 'obj') return t.cls ?? 'object';
  return t.b;
}

/** Is this generated JS expression free of side effects and cheap to repeat? */
const SIMPLE = /^[\w$]+(\[0\])?$/;

function arith(a: Type, b: Type): Type {
  const r = Math.max(RANK[a.b] ?? 1, RANK[b.b] ?? 1);
  const table: Base[] = INT32 ? ['long', 'long', 'ulong', 'long', 'ulong', 'float'] : ['int', 'int', 'uint', 'long', 'ulong', 'float'];
  return T(table[r]);
}

function wrap(code: string, b: Base): string {
  switch (b) {
    case 'bool': return `((${code})?true:false)`;
    case 'char': return `((${code})<<24>>24)`;
    case 'uchar': return `((${code})&255)`;
    case 'int': return `((${code})<<16>>16)`;
    case 'uint': return `((${code})&65535)`;
    case 'long': return `((${code})|0)`;
    case 'ulong': return `((${code})>>>0)`;
    default: return code;
  }
}

interface VarInfo {
  js: string;
  type: Type;
  /** scalar stored in a 1-element array so its address can be taken */
  boxed?: boolean;
  /** reference: `js` holds a pointer that is implicitly dereferenced */
  ref?: boolean;
}

interface LValue {
  code: string;
  type: Type;
  /** expression that must run first (temp assignment) */
  pre?: string;
}

const withPre = (pre: string | undefined, code: string) => (pre ? `(${pre},${code})` : code);

interface FuncInfo {
  js: string;
  ret: Type;
  params: { name: string; type: Type }[];
}

type BuiltinGen = (c: Gen, args: Expr[], tok: Token) => { code: string; type: Type };

const JS_RESERVED = new Set(['R']);

class Gen {
  scopes: Map<string, VarInfo>[] = [];
  funcs = new Map<string, FuncInfo>();
  statics: string[] = [];
  staticCounter = 0;
  currentFunc: FuncInfo | null = null;
  tmp = 0;
  temps: string[] = [];
  board: BoardSpec = UNO;
  /** variable names whose address is taken somewhere (they get boxed) */
  boxedNames = new Set<string>();

  newTemp(): string {
    const t = `$t${this.tmp++}`;
    this.temps.push(t);
    return t;
  }

  varCode(v: VarInfo): string {
    if (v.boxed) return `${v.js}[0]`;
    if (v.ref) return `${v.js}.a[${v.js}.i]`;
    return v.js;
  }

  /** Pointer to an lvalue: `&x`, `&a[i]`, `&*p`. */
  addrOf(e: Expr): { code: string; type: Type } {
    if (e.k === 'id') {
      const v = this.lookup(e.name);
      if (!v) this.err(`'${e.name}' was not declared in this scope`, e.tok);
      if (v.type.dims) return { code: `R.ptr(${v.js},0)`, type: { ...elemOf(v.type), ptr: (elemOf(v.type).ptr ?? 0) + 1 } };
      if (v.boxed) return { code: `R.ptr(${v.js},0)`, type: { ...v.type, ptr: (v.type.ptr ?? 0) + 1, isConst: false } };
      if (v.ref) return { code: v.js, type: { ...v.type, ptr: (v.type.ptr ?? 0) + 1, isConst: false } };
      this.err(`cannot take the address of '${e.name}'`, e.tok);
    }
    if (e.k === 'index') {
      const o = this.expr(e.obj);
      const idx = this.expr(e.idx);
      const et = elemOf(o.type);
      const pt: Type = { ...et, ptr: (et.ptr ?? 0) + 1, isConst: false };
      if (o.type.dims) return { code: `R.ptr(${o.code},${idx.code})`, type: pt };
      if (isPtr(o.type)) return { code: `R.padd(${o.code},${idx.code})`, type: pt };
      this.err('cannot take the address of this expression', e.tok);
    }
    if (e.k === 'un' && e.op === '*') return this.expr(e.e);
    this.err("lvalue required as unary '&' operand", e.tok);
  }

  err(msg: string, t: Token): never {
    throw new CompileError(msg, t.line, t.col);
  }

  lookup(name: string): VarInfo | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const v = this.scopes[i].get(name);
      if (v) return v;
    }
    return undefined;
  }

  declare(name: string, type: Type, tok: Token, js?: string): VarInfo {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) this.err(`redeclaration of '${name}'`, tok);
    const info = { js: js ?? `$${name}`, type };
    if (JS_RESERVED.has(name)) info.js = `$_${name}`;
    scope.set(name, info);
    return info;
  }

  /** Convert expression code of type `from` into type `to`. */
  conv(code: string, from: Type, to: Type, tok: Token): string {
    if (to.b === 'obj' || from.b === 'obj') {
      if (to.b === 'obj' && from.b === 'obj' && to.cls === from.cls) return code;
      this.err(`cannot convert '${typeName(from)}' to '${typeName(to)}'`, tok);
    }
    if (isPtr(to)) {
      if (isPtr(from)) return code;
      if (from.dims) return `R.ptr(${code},0)`;
      if (isNumeric(from)) return code === '0' ? 'null' : `R.nullPtr(${code})`;
      this.err(`cannot convert '${typeName(from)}' to '${typeName(to)}'`, tok);
    }
    if (to.dims && isPtr(from)) return `R.toArr(${code})`;
    if (to.dims || from.dims) {
      if (from.dims && !to.dims && to.b !== 'String') this.err(`cannot convert an array to '${typeName(to)}'`, tok);
      if (from.dims && to.b === 'String') this.err(`cannot convert an array to a string; use a String or char* literal`, tok);
      return code;
    }
    if (isPtr(from)) {
      if (to.b === 'bool') return `(${code}!=null)`;
      this.err(`invalid conversion from '${typeName(from)}' to '${typeName(to)}'`, tok);
    }
    if (from.b === 'func') this.err('a function can only be used as an interrupt handler here', tok);
    if (to.b === 'String') {
      if (from.b === 'String') return code;
      return `R.str(${code},${JSON.stringify(from.b)})`;
    }
    if (from.b === 'String') {
      if (to.b === 'bool') return `(${code}.length>0)`;
      this.err(`cannot convert 'String' to '${to.b}'`, tok);
    }
    if (from.b === 'void') this.err('void value not ignored as it ought to be', tok);
    if (to.b === 'float') return `(+(${code}))`;
    if (to.b === from.b && to.b !== 'bool') return code;
    if (to.b === 'bool') return `((${code})?true:false)`;
    return wrap(code, to.b);
  }

  // ---- expressions
  expr(e: Expr): { code: string; type: Type } {
    switch (e.k) {
      case 'num':
        return { code: String(e.v), type: e.t };
      case 'str':
        return { code: JSON.stringify(e.v), type: T('String') };
      case 'id': {
        const v = this.lookup(e.name);
        if (v) return { code: this.varCode(v), type: v.type };
        const fn = this.funcs.get(e.name);
        if (fn) return { code: fn.js, type: { b: 'func' } };
        const bc = this.board.constants[e.name];
        if (bc !== undefined) return { code: String(bc), type: T('int') };
        const c = CONSTANTS[e.name];
        if (c !== undefined) return { code: String(c[0]), type: T(c[1]) };
        const bm = /^B([01]{1,8})$/.exec(e.name);
        if (bm) return { code: String(parseInt(bm[1], 2)), type: T('int') };
        if (BUILTINS[e.name]) this.err(`'${e.name}' is a function; did you forget the ()?`, e.tok);
        if (e.name === 'Wire' || /^Serial\d?$/.test(e.name)) this.err(`'${e.name}' can only be used to call its methods, e.g. ${e.name}.begin()`, e.tok);
        this.err(`'${e.name}' was not declared in this scope`, e.tok);
      }
      // falls through (unreachable)
      case 'comma': {
        const l = this.expr(e.l), r = this.expr(e.r);
        return { code: `(${l.code},${r.code})`, type: r.type };
      }
      case 'cond': {
        const c = this.expr(e.c), a = this.expr(e.a), b = this.expr(e.b);
        let type = a.type;
        if (isNumeric(a.type) && isNumeric(b.type)) type = arith(a.type, b.type);
        else if (a.type.b === 'String' || b.type.b === 'String') type = T('String');
        return { code: `((${c.code})?${this.conv(a.code, a.type, type, e.tok)}:${this.conv(b.code, b.type, type, e.tok)})`, type };
      }
      case 'un': {
        if (e.op === '++' || e.op === '--') {
          const lv = this.lvalue(e.e);
          const one = e.op === '++' ? '+1' : '-1';
          if (isPtr(lv.type)) return { code: withPre(lv.pre, `(${lv.code}=R.padd(${lv.code},${one}))`), type: lv.type };
          return { code: withPre(lv.pre, `(${lv.code}=${this.conv(`${lv.code}${one}`, T('float'), lv.type, e.tok)})`), type: lv.type };
        }
        if (e.op === '&') return this.addrOf(e.e);
        if (e.op === '*') {
          const x = this.expr(e.e);
          if (isPtr(x.type)) return { code: `R.deref(${x.code})`, type: elemOf(x.type) };
          if (x.type.dims) return { code: `${x.code}[0]`, type: elemOf(x.type) };
          if (x.type.b === 'String') return { code: `R.charAt(${x.code},0)`, type: T('char') };
          this.err(`invalid type argument of unary '*' (have '${typeName(x.type)}')`, e.tok);
        }
        const x = this.expr(e.e);
        if (e.op === '!' && isPtr(x.type)) return { code: `(${x.code}==null)`, type: T('bool') };
        if (e.op === '!') return { code: `(!(${x.code}))`, type: T('bool') };
        this.numeric(x.type, e.tok, e.op);
        const rt = arith(x.type, T('int'));
        if (e.op === '+') return { code: x.code, type: rt };
        if (e.op === '-') return { code: wrap(`-(${x.code})`, rt.b), type: rt };
        if (rt.b === 'float') this.err("wrong type argument to bit-complement", e.tok);
        return { code: wrap(`~(${x.code})`, rt.b), type: rt };
      }
      case 'post': {
        const lv = this.lvalue(e.e);
        const d = e.op === '++' ? 1 : -1;
        if (isPtr(lv.type)) {
          const t = this.newTemp();
          return { code: `(${lv.pre ? lv.pre + ',' : ''}${t}=${lv.code},${lv.code}=R.padd(${t},${d}),${t})`, type: lv.type };
        }
        const calc = T('float');
        const set = `${lv.code}=${this.conv(`(${lv.code})+(${d})`, calc, lv.type, e.tok)}`;
        const back = this.conv(`(${lv.code})-(${d})`, calc, lv.type, e.tok);
        return { code: `(${lv.pre ? lv.pre + ',' : ''}${set},${back})`, type: lv.type };
      }
      case 'bin':
        return this.binary(e.op, this.expr(e.l), this.expr(e.r), e.tok);
      case 'assign': {
        const lv = this.lvalue(e.l);
        if (lv.type.isConst) this.err(`assignment of read-only variable`, e.tok);
        if (e.r.k === 'init') {
          if (!lv.type.dims) this.err('initializer list can only be assigned to arrays', e.tok);
          return { code: withPre(lv.pre, `(${lv.code}=${this.initList(e.r, lv.type)})`), type: lv.type };
        }
        const r = this.expr(e.r);
        if (lv.type.dims) this.err('invalid array assignment', e.tok);
        if (lv.type.b === 'obj') this.err(`cannot assign to a ${lv.type.cls} object`, e.tok);
        if (e.op === '=') return { code: withPre(lv.pre, `(${lv.code}=${this.conv(r.code, r.type, lv.type, e.tok)})`), type: lv.type };
        const op = e.op.slice(0, -1);
        const res = this.binary(op, { code: lv.code, type: lv.type }, r, e.tok);
        return { code: withPre(lv.pre, `(${lv.code}=${this.conv(res.code, res.type, lv.type, e.tok)})`), type: lv.type };
      }
      case 'index': {
        const o = this.expr(e.obj);
        const idx = this.expr(e.idx);
        if (o.type.b === 'String' && !o.type.dims) return { code: `R.charAt(${o.code},${idx.code})`, type: T('char') };
        if (isPtr(o.type)) return { code: `R.deref(R.padd(${o.code},${idx.code}))`, type: elemOf(o.type) };
        if (!o.type.dims) this.err('subscripted value is neither array nor pointer', e.tok);
        return { code: `${o.code}[${idx.code}]`, type: elemOf(o.type) };
      }
      case 'cast': {
        const x = this.expr(e.e);
        return { code: this.conv(x.code, x.type, e.to, e.tok), type: e.to };
      }
      case 'sizeof': {
        let t: Type;
        if (e.type) t = e.type;
        else if (e.e!.k === 'id' && this.lookup(e.e!.name)) t = this.lookup(e.e!.name)!.type;
        else t = this.expr(e.e!).type;
        let size = t.ptr && !t.dims ? 2 : SIZE[t.b];
        for (const d of t.dims ?? []) size *= d ?? 0;
        if (t.dims && e.e?.k === 'id') {
          // arrays sized by initializer: use runtime length
          const v = this.lookup(e.e.name)!;
          return { code: `(R.sizeOf(${v.js},${SIZE[t.b]}))`, type: T('uint') };
        }
        return { code: String(size), type: T('uint') };
      }
      case 'member':
        this.err(`'${this.describe(e.obj)}' has no member named '${e.name}' (only method calls are supported)`, e.tok);
      // falls through
      case 'call':
        return this.call(e);
      case 'init':
        this.err('unexpected initializer list', e.tok);
      // falls through
      case 'new':
        return { code: this.newObj(e.cls, e.args, e.tok), type: { b: 'obj', cls: e.cls } };
    }
  }

  newObj(cls: string, args: Expr[], tok: Token): string {
    const spec = LIBS[cls];
    const [min, max] = spec.ctor;
    if (args.length < min || args.length > max) this.err(`no matching constructor for ${cls} with ${args.length} argument(s)`, tok);
    const a = this.args(args).map((x) => x.code);
    return `R.lib.create(${JSON.stringify(cls)},[${a.join(',')}])`;
  }

  describe(e: Expr): string {
    return e.k === 'id' ? e.name : 'expression';
  }

  numeric(t: Type, tok: Token, op: string) {
    if (!isNumeric(t)) this.err(`invalid operand of type '${typeName(t)}' to operator ${op}`, tok);
  }

  binary(op: string, l: { code: string; type: Type }, r: { code: string; type: Type }, tok: Token): { code: string; type: Type } {
    if (op === '&&' || op === '||') {
      const tb = (x: { code: string; type: Type }) => (isPtr(x.type) ? `(${x.code}!=null)` : `(${x.code})`);
      return { code: `(!!(${tb(l)}${op}${tb(r)}))`, type: T('bool') };
    }
    const pl = isPtr(l.type) || (!!l.type.dims && op !== '='), pr = isPtr(r.type) || (!!r.type.dims && op !== '=');
    if (pl || pr) {
      const P = (x: { code: string; type: Type }) => (x.type.dims ? `R.ptr(${x.code},0)` : x.code);
      const pt = pl ? (l.type.dims ? { ...elemOf(l.type), ptr: (elemOf(l.type).ptr ?? 0) + 1 } : l.type) : r.type.dims ? { ...elemOf(r.type), ptr: (elemOf(r.type).ptr ?? 0) + 1 } : r.type;
      if (op === '==' || op === '!=') return { code: `(${op === '!=' ? '!' : ''}R.peq(${P(l)},${P(r)}))`, type: T('bool') };
      if (['<', '>', '<=', '>='].includes(op) && pl && pr) return { code: `(R.pidx(${P(l)})${op}R.pidx(${P(r)}))`, type: T('bool') };
      if (op === '+' && pl && !pr) { this.numeric(r.type, tok, op); return { code: `R.padd(${P(l)},${r.code})`, type: pt }; }
      if (op === '+' && pr && !pl) { this.numeric(l.type, tok, op); return { code: `R.padd(${P(r)},${l.code})`, type: pt }; }
      if (op === '-' && pl && !pr) { this.numeric(r.type, tok, op); return { code: `R.padd(${P(l)},-(${r.code}))`, type: pt }; }
      if (op === '-' && pl && pr) return { code: `R.pdiff(${P(l)},${P(r)})`, type: T('int') };
      this.err(`invalid operands to binary '${op}' (have '${typeName(l.type)}' and '${typeName(r.type)}')`, tok);
    }
    const strL = l.type.b === 'String' && !l.type.dims, strR = r.type.b === 'String' && !r.type.dims;
    if (strL || strR) {
      if (op === '+') return { code: `(${this.conv(l.code, l.type, T('String'), tok)}+${this.conv(r.code, r.type, T('String'), tok)})`, type: T('String') };
      if (['==', '!=', '<', '>', '<=', '>='].includes(op) && strL && strR) {
        return { code: `(${l.code}${op === '==' ? '===' : op === '!=' ? '!==' : op}${r.code})`, type: T('bool') };
      }
      this.err(`invalid operands of type String to binary operator '${op}'`, tok);
    }
    this.numeric(l.type, tok, op);
    this.numeric(r.type, tok, op);
    if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      return { code: `((${l.code})${op}(${r.code}))`, type: T('bool') };
    }
    const rt = arith(l.type, r.type);
    const a = `(${l.code})`, b = `(${r.code})`;
    if (rt.b === 'float') {
      if (['%', '<<', '>>', '&', '|', '^'].includes(op)) this.err(`invalid operands of type 'float' to binary operator '${op}'`, tok);
      return { code: `(${a}${op}${b})`, type: rt };
    }
    let code: string;
    switch (op) {
      case '*':
        code = rt.b === 'long' || rt.b === 'ulong' ? `Math.imul(${a},${b})` : `${a}*${b}`;
        break;
      case '/':
      case '%':
        code = `R.idiv(${a},${b},${op === '%' ? 1 : 0})`;
        break;
      case '>>':
        code = rt.b === 'ulong' || rt.b === 'uint' ? `${a}>>>${b}` : `${a}>>${b}`;
        break;
      default:
        code = `${a}${op}${b}`;
    }
    return { code: wrap(code, rt.b), type: rt };
  }

  /** Assignable JS expression for a C lvalue. Pointer targets may need a temp (`pre`). */
  lvalue(e: Expr): LValue {
    if (e.k === 'id') {
      const v = this.lookup(e.name);
      if (!v) {
        if (CONSTANTS[e.name] || this.board.constants[e.name] !== undefined) this.err(`lvalue required as left operand of assignment`, e.tok);
        this.err(`'${e.name}' was not declared in this scope`, e.tok);
      }
      return { code: this.varCode(v), type: v.type };
    }
    const viaPtr = (p: { code: string }, off: string | null, type: Type): LValue => {
      let base = p.code, pre: string | undefined;
      if (!SIMPLE.test(base)) {
        const t = this.newTemp();
        pre = `${t}=${base}`;
        base = t;
      }
      const i = off === null ? `${base}.i` : `${base}.i+(${off})`;
      return { code: `R.nn(${base}).a[${i}]`, type, pre };
    };
    if (e.k === 'un' && e.op === '*') {
      const p = this.expr(e.e);
      if (isPtr(p.type)) return viaPtr(p, null, elemOf(p.type));
      if (p.type.dims) return { code: `${p.code}[0]`, type: elemOf(p.type) };
      this.err(`invalid type argument of unary '*' (have '${typeName(p.type)}')`, e.tok);
    }
    if (e.k === 'index') {
      const o = this.expr(e.obj);
      if (isPtr(o.type)) {
        const idx = this.expr(e.idx);
        return viaPtr(o, idx.code, elemOf(o.type));
      }
      const r = this.expr(e);
      if (r.code.startsWith('R.charAt(')) this.err('modifying String characters with [] is not supported; use setCharAt()', e.tok);
      return r;
    }
    this.err('lvalue required as left operand of assignment', e.tok);
  }

  args(args: Expr[]) {
    return args.map((a) => this.expr(a));
  }

  call(e: Expr & { k: 'call' }): { code: string; type: Type } {
    const callee = e.callee;
    if (callee.k === 'member') return this.method(callee.obj, callee.name, e.args, e.tok);
    if (callee.k !== 'id') this.err('called object is not a function', e.tok);
    const name = callee.name;
    const user = this.funcs.get(name);
    if (user && !this.lookup(name)) {
      if (e.args.length !== user.params.length) this.err(`wrong number of arguments to function '${name}' (expected ${user.params.length})`, e.tok);
      const argCodes = e.args.map((a, i) => {
        const pt = user.params[i].type;
        if (pt.ref && !pt.dims && pt.b !== 'obj') {
          const ptr = this.addrOf(a);
          return ptr.code;
        }
        const x = this.expr(a);
        if (pt.dims && !x.type.dims && !isPtr(x.type)) this.err(`argument ${i + 1} of '${name}' must be an array`, a.tok);
        return this.conv(x.code, x.type, pt, a.tok);
      });
      return { code: `(yield* ${user.js}(${argCodes.join(',')}))`, type: user.ret };
    }
    const b = BUILTINS[name];
    if (b) return b(this, e.args, e.tok);
    this.err(`'${name}' was not declared in this scope`, callee.tok);
  }

  method(obj: Expr, name: string, args: Expr[], tok: Token): { code: string; type: Type } {
    if (obj.k === 'id' && !this.lookup(obj.name) && /^Serial\d?$/.test(obj.name)) {
      const m = SERIAL[name];
      if (!m) this.err(`'Serial' has no member named '${name}'`, tok);
      return m(this, args, tok);
    }
    if (obj.k === 'id' && !this.lookup(obj.name) && UNSUPPORTED_TYPES[obj.name]) this.err(UNSUPPORTED_TYPES[obj.name], tok);
    if (obj.k === 'id' && !this.lookup(obj.name) && obj.name === 'Wire') return this.libCall('Wire', 'R.wire', name, args, tok);
    if (obj.k === 'id' && !this.lookup(obj.name) && (obj.name === 'SPI' || obj.name === 'EEPROM')) {
      this.err(`The ${obj.name} library is on the roadmap and not supported yet.`, tok);
    }
    if (obj.k === 'id' && !this.lookup(obj.name) && ['WiFi', 'SerialBT', 'WebServer', 'HTTPClient', 'BLEDevice', 'esp_now'].includes(obj.name)) {
      this.err(`${obj.name}: wireless networking isn't simulated yet (Phase 3). GPIO, ADC, PWM, DAC, I2C, Servo and LCD all work on the ESP32.`, tok);
    }
    const o = this.expr(obj);
    if (o.type.b === 'obj' && !o.type.dims) return this.libCall(o.type.cls!, o.code, name, args, tok);
    if (o.type.b === 'String' && !o.type.dims) {
      const a = this.args(args);
      const s = o.code;
      const A = (i: number) => (a[i] ? a[i].code : 'undefined');
      const S = (i: number) => (a[i] ? this.conv(a[i].code, a[i].type, T('String'), tok) : '""');
      const inplace = (expr: string) => {
        const lv = this.lvalue(obj);
        return { code: `(${lv.code}=${expr},undefined)`, type: T('void') };
      };
      switch (name) {
        case 'length': return { code: `${s}.length`, type: T('uint') };
        case 'charAt': return { code: `R.charAt(${s},${A(0)})`, type: T('char') };
        case 'substring': return { code: `${s}.substring(${A(0)}${a[1] ? ',' + A(1) : ''})`, type: T('String') };
        case 'indexOf': return { code: `${s}.indexOf(${a[0]?.type.b === 'char' ? `String.fromCharCode(${A(0)})` : S(0)}${a[1] ? ',' + A(1) : ''})`, type: T('int') };
        case 'lastIndexOf': return { code: `${s}.lastIndexOf(${a[0]?.type.b === 'char' ? `String.fromCharCode(${A(0)})` : S(0)})`, type: T('int') };
        case 'toInt': return { code: `R.toInt(${s})`, type: T('long') };
        case 'toFloat': case 'toDouble': return { code: `R.toFloat(${s})`, type: T('float') };
        case 'equals': return { code: `(${s}===${S(0)})`, type: T('bool') };
        case 'equalsIgnoreCase': return { code: `(${s}.toLowerCase()===${S(0)}.toLowerCase())`, type: T('bool') };
        case 'startsWith': return { code: `${s}.startsWith(${S(0)})`, type: T('bool') };
        case 'endsWith': return { code: `${s}.endsWith(${S(0)})`, type: T('bool') };
        case 'compareTo': return { code: `(${s}<${S(0)}?-1:${s}>${S(0)}?1:0)`, type: T('int') };
        case 'c_str': return { code: s, type: T('String') };
        case 'isEmpty': return { code: `(${s}.length===0)`, type: T('bool') };
        case 'toUpperCase': return inplace(`${s}.toUpperCase()`);
        case 'toLowerCase': return inplace(`${s}.toLowerCase()`);
        case 'trim': return inplace(`${s}.trim()`);
        case 'concat': return inplace(`${s}+${S(0)}`);
        case 'replace': return inplace(`${s}.split(${a[0]?.type.b === 'char' ? `String.fromCharCode(${A(0)})` : S(0)}).join(${a[1]?.type.b === 'char' ? `String.fromCharCode(${A(1)})` : S(1)})`);
        case 'setCharAt': return inplace(`R.setCharAt(${s},${A(0)},${A(1)})`);
        case 'remove': return inplace(`R.strRemove(${s},${A(0)}${a[1] ? ',' + A(1) : ''})`);
        case 'reserve': return { code: 'undefined', type: T('void') };
      }
      this.err(`'String' has no member named '${name}'`, tok);
    }
    this.err(`request for member '${name}' in '${this.describe(obj)}', which is of non-class type`, tok);
  }

  /** Method call on a library object (Servo, LiquidCrystal, Wire …). */
  libCall(cls: string, target: string, name: string, args: Expr[], tok: Token): { code: string; type: Type } {
    const m = LIBS[cls].methods[name];
    if (!m) this.err(`'${cls}' has no member named '${name}'`, tok);
    const [min, max, ret] = m;
    if (args.length < min) this.err(`too few arguments to '${cls}::${name}'`, tok);
    if (args.length > max) this.err(`too many arguments to '${cls}::${name}'`, tok);
    const a = this.args(args);
    if (name === 'print' || name === 'println') {
      // format like Serial.print, then hand the text to the library
      const text = a.length ? `R.fmt(${a[0].code},${JSON.stringify(a[0].type.b)}${a[1] ? ',' + a[1].code : ''})` : '""';
      return { code: `${target}.${name}(${text})`, type: T(ret) };
    }
    if (name === 'write' && a[0] && a[0].type.b === 'String' && !a[0].type.dims) return { code: `${target}.writeStr(${a[0].code})`, type: T(ret) };
    const codes = a.map((x) => (isPtr(x.type) ? `R.toArr(${x.code})` : x.code));
    return { code: `${target}.${name}(${codes.join(',')})`, type: T(ret) };
  }

  initList(e: Expr & { k: 'init' }, type: Type): string {
    const dims = type.dims ?? [];
    const inner: Type = elemOf(type);
    const items = e.items.map((it) => {
      if (it.k === 'init') return this.initList(it, inner);
      const x = this.expr(it);
      return this.conv(x.code, x.type, inner, it.tok);
    });
    const size = dims[0];
    if (size != null && items.length > size) this.err('too many initializers', e.tok);
    if (size != null && items.length < size) {
      const pad = inner.dims ? this.zeroArray(inner) : zeroOf(inner.b);
      return `R.pad([${items.join(',')}],${size},()=>${pad})`;
    }
    return `[${items.join(',')}]`;
  }

  zeroArray(t: Type): string {
    const dims = t.dims ?? [];
    if (!dims.length) return t.b === 'obj' ? `R.lib.create(${JSON.stringify(t.cls)},[])` : isPtr(t) ? 'null' : zeroOf(t.b);
    if (dims[0] == null) return '[]';
    const inner: Type = { ...t, dims: dims.slice(1) };
    return `Array.from({length:${dims[0]}},()=>${this.zeroArray(inner)})`;
  }

  // ---- statements
  decl(s: Stmt & { k: 'decl' }, out: string[], global: boolean) {
    for (const d of s.decls) {
      if (d.type.b === 'void' && !d.type.ptr) this.err(`variable '${d.name}' declared void`, d.tok);
      let type = d.type;
      let init: string;
      let ref = false;
      if (type.ref && !type.dims && type.b !== 'obj') {
        // int &r = x;  → r holds a pointer to x
        if (!d.init) this.err(`'${d.name}' declared as reference but not initialized`, d.tok);
        const { ref: _r, ...rest } = type;
        void _r;
        type = rest;
        init = this.addrOf(d.init).code;
        ref = true;
      } else if (type.b === 'obj' && !type.dims) {
        if (d.init && d.init.k !== 'new') this.err(`${type.cls} objects are created as '${type.cls} ${d.name}(...);'`, d.tok);
        init = this.newObj(type.cls!, d.init?.k === 'new' ? d.init.args : [], d.tok);
      } else if (d.init?.k === 'init' || (d.init?.k === 'str' && type.dims)) {
        if (!type.dims) {
          if (d.init.k === 'init' && d.init.items.length === 1) {
            const x = this.expr(d.init.items[0]);
            init = this.conv(x.code, x.type, type, d.tok);
          } else this.err(`scalar object '${d.name}' requires one element in initializer`, d.tok);
        } else if (d.init.k === 'str') {
          // char msg[] = "hello";  → String
          type = { b: 'String', isConst: type.isConst };
          init = JSON.stringify(d.init.v);
        } else {
          const dims = [...type.dims];
          if (dims[0] == null) dims[0] = d.init.items.length;
          type = { ...type, dims };
          init = this.initList(d.init, type);
        }
      } else if (d.init) {
        if (type.dims) {
          if (type.b === 'char' || type.b === 'uchar') {
            type = { b: 'String' };
            const x = this.expr(d.init);
            init = this.conv(x.code, x.type, type, d.tok);
          } else this.err(`array must be initialized with a brace-enclosed initializer`, d.tok);
        } else {
          const x = this.expr(d.init);
          init = this.conv(x.code, x.type, type, d.tok);
        }
      } else if (type.dims) {
        if (type.dims.some((x) => x == null)) this.err(`array size missing in '${d.name}'`, d.tok);
        init = this.zeroArray(type);
      } else init = isPtr(type) ? 'null' : zeroOf(type.b);

      const boxed = !ref && !type.dims && type.b !== 'obj' && this.boxedNames.has(d.name);
      if (boxed) init = `[${init}]`;
      let v: VarInfo;
      if (s.isStatic && !global && this.currentFunc) {
        const js = `$$s${this.staticCounter++}_${d.name}`;
        this.statics.push(`let ${js}=${init};`);
        v = this.declare(d.name, type, d.tok, js);
      } else if (global) {
        v = this.declare(d.name, type, d.tok);
        out.push(`${v.js}=${init};`);
      } else {
        v = this.declare(d.name, type, d.tok);
        out.push(`let ${v.js}=${init};`);
      }
      v.boxed = boxed;
      v.ref = ref;
    }
  }

  tick(cost: number) {
    return `if((R.t+=${+(cost * this.board.statementCost).toFixed(4)})>=R.until)yield 0;`;
  }

  stmt(s: Stmt, out: string[]) {
    switch (s.k) {
      case 'block': {
        this.scopes.push(new Map());
        const inner: string[] = [];
        for (const x of s.body) this.stmt(x, inner);
        this.scopes.pop();
        out.push(`{${inner.join('\n')}}`);
        break;
      }
      case 'decl':
        this.decl(s, out, false);
        break;
      case 'expr':
        out.push(`${this.expr(s.e).code};`);
        break;
      case 'if': {
        const c = this.expr(s.c);
        const a: string[] = [];
        this.scoped(() => this.stmt(s.a, a));
        let code = `if(${c.code}){${a.join('\n')}}`;
        if (s.b) {
          const b: string[] = [];
          this.scoped(() => this.stmt(s.b!, b));
          code += `else{${b.join('\n')}}`;
        }
        out.push(code);
        break;
      }
      case 'while': {
        const c = this.expr(s.c);
        const body: string[] = [];
        this.scoped(() => this.stmt(s.body, body));
        out.push(`while(${c.code}){${this.tick(cost(s.body))}${body.join('\n')}}`);
        break;
      }
      case 'do': {
        const body: string[] = [];
        this.scoped(() => this.stmt(s.body, body));
        const c = this.expr(s.c);
        out.push(`do{${this.tick(cost(s.body))}${body.join('\n')}}while(${c.code});`);
        break;
      }
      case 'for': {
        this.scopes.push(new Map());
        const init: string[] = [];
        if (s.init) {
          if (s.init.k === 'decl') this.decl(s.init, init, false);
          else if (s.init.k === 'expr') init.push(`${this.expr(s.init.e).code};`);
        }
        const c = s.c ? this.expr(s.c).code : 'true';
        const step = s.step ? this.expr(s.step).code : '';
        const body: string[] = [];
        this.scoped(() => this.stmt(s.body, body));
        this.scopes.pop();
        // `let` declarations move into the for header so each loop has its own binding
        const header = init.join('').replace(/;$/, '').replace(/;let /g, ',');
        out.push(`for(${header};${c};${step}){${this.tick(cost(s.body) + 1)}${body.join('\n')}}`);
        break;
      }
      case 'switch': {
        const e = this.expr(s.e);
        const parts: string[] = [];
        this.scopes.push(new Map());
        for (const cs of s.cases) {
          const body: string[] = [];
          for (const x of cs.body) this.stmt(x, body);
          const label = cs.test ? `case ${this.expr(cs.test).code}:` : 'default:';
          parts.push(`${label}${body.join('\n')}`);
        }
        this.scopes.pop();
        out.push(`switch(${e.code}){${parts.join('\n')}}`);
        break;
      }
      case 'break':
        out.push('break;');
        break;
      case 'continue':
        out.push('continue;');
        break;
      case 'return': {
        const f = this.currentFunc!;
        if (s.e) {
          const x = this.expr(s.e);
          if (f.ret.b === 'void') this.err(`return-statement with a value, in function returning 'void'`, s.tok);
          out.push(`return ${this.conv(x.code, x.type, f.ret, s.tok)};`);
        } else out.push('return;');
        break;
      }
      case 'empty':
        break;
    }
  }

  scoped(fn: () => void) {
    this.scopes.push(new Map());
    fn();
    this.scopes.pop();
  }
}

function cost(s: Stmt): number {
  if (s.k === 'block') return Math.max(1, s.body.length);
  return 1;
}

function zeroOf(b: Base): string {
  return b === 'String' ? '""' : b === 'bool' ? 'false' : '0';
}

// ---------------------------------------------------------------- built-ins

const CONSTANTS: Record<string, [number, Base]> = {
  HIGH: [1, 'int'], LOW: [0, 'int'], INPUT: [0, 'int'], OUTPUT: [1, 'int'], INPUT_PULLUP: [2, 'int'],
  DEC: [10, 'int'], HEX: [16, 'int'], OCT: [8, 'int'], BIN: [2, 'int'], PI: [Math.PI, 'float'], HALF_PI: [Math.PI / 2, 'float'],
  TWO_PI: [Math.PI * 2, 'float'], DEG_TO_RAD: [Math.PI / 180, 'float'], RAD_TO_DEG: [180 / Math.PI, 'float'], EULER: [Math.E, 'float'],
  ADC_11db: [3, 'int'], ADC_0db: [0, 'int'], NULL: [0, 'int'], nullptr: [0, 'int'], NOT_AN_INTERRUPT: [-1, 'int'], CHANGE: [1, 'int'], RISING: [3, 'int'], FALLING: [2, 'int'],
  LSBFIRST: [0, 'int'], MSBFIRST: [1, 'int'], DEFAULT: [1, 'int'], EXTERNAL: [0, 'int'], INTERNAL: [3, 'int'],
};

function argCheck(c: Gen, name: string, args: Expr[], min: number, max: number, tok: Token) {
  if (args.length < min) c.err(`too few arguments to function '${name}'`, tok);
  if (args.length > max) c.err(`too many arguments to function '${name}'`, tok);
}

function simple(name: string, jsName: string, ret: Base, min: number, max = min): BuiltinGen {
  return (c, args, tok) => {
    argCheck(c, name, args, min, max, tok);
    const a = c.args(args).map((x) => x.code);
    return { code: `${jsName}(${a.join(',')})`, type: T(ret) };
  };
}

function mathf(name: string, js: string, n = 1): BuiltinGen {
  return (c, args, tok) => {
    argCheck(c, name, args, n, n, tok);
    const a = c.args(args);
    a.forEach((x) => c.numeric(x.type, tok, name));
    return { code: `${js}(${a.map((x) => x.code).join(',')})`, type: T('float') };
  };
}

function generic(name: string, js: (a: string[]) => string, n: number): BuiltinGen {
  return (c, args, tok) => {
    argCheck(c, name, args, n, n, tok);
    const a = c.args(args);
    a.forEach((x) => c.numeric(x.type, tok, name));
    const t = a.reduce((acc, x) => arith(acc, x.type), T('int'));
    return { code: wrap(js(a.map((x) => `(${x.code})`)), t.b), type: t };
  };
}

function bitMacro(op: 'set' | 'clear' | 'write'): BuiltinGen {
  return (c, args, tok) => {
    argCheck(c, `bit${op}`, args, op === 'write' ? 3 : 2, op === 'write' ? 3 : 2, tok);
    const lv = c.lvalue(args[0]);
    const n = c.expr(args[1]).code;
    let expr: string;
    if (op === 'set') expr = `${lv.code}|(1<<(${n}))`;
    else if (op === 'clear') expr = `${lv.code}&~(1<<(${n}))`;
    else expr = `((${c.expr(args[2]).code})?(${lv.code}|(1<<(${n}))):(${lv.code}&~(1<<(${n}))))`;
    return { code: `(${lv.code}=${c.conv(expr, T('long'), lv.type, tok)})`, type: lv.type };
  };
}

function esp32Only(g: BuiltinGen): BuiltinGen {
  return (c, args, tok) => {
    if (c.board.id !== 'esp32') c.err(`this function is only available on ESP32 boards (you're programming an ${c.board.name})`, tok);
    return g(c, args, tok);
  };
}

const BUILTINS: Record<string, BuiltinGen> = {
  pinMode: simple('pinMode', 'R.pinMode', 'void', 2),
  digitalWrite: simple('digitalWrite', 'R.digitalWrite', 'void', 2),
  digitalRead: simple('digitalRead', 'R.digitalRead', 'int', 1),
  analogRead: simple('analogRead', 'R.analogRead', 'int', 1),
  analogWrite: simple('analogWrite', 'R.analogWrite', 'void', 2),
  analogReference: simple('analogReference', 'R.noop', 'void', 1),
  analogReadResolution: simple('analogReadResolution', 'R.noop', 'void', 1),
  millis: simple('millis', 'R.millis', 'ulong', 0),
  micros: simple('micros', 'R.micros', 'ulong', 0),
  delay: (c, args, tok) => {
    argCheck(c, 'delay', args, 1, 1, tok);
    return { code: `(yield* R.delay(${c.expr(args[0]).code}))`, type: T('void') };
  },
  delayMicroseconds: (c, args, tok) => {
    argCheck(c, 'delayMicroseconds', args, 1, 1, tok);
    return { code: `(yield* R.delayUs(${c.expr(args[0]).code}))`, type: T('void') };
  },
  pulseIn: (c, args, tok) => {
    argCheck(c, 'pulseIn', args, 2, 3, tok);
    return { code: `(yield* R.pulseIn(${c.args(args).map((x) => x.code).join(',')}))`, type: T('ulong') };
  },
  tone: simple('tone', 'R.tone', 'void', 2, 3),
  noTone: simple('noTone', 'R.noTone', 'void', 1),
  shiftOut: simple('shiftOut', 'R.shiftOut', 'void', 4),
  interrupts: simple('interrupts', 'R.interrupts', 'void', 0),
  noInterrupts: simple('noInterrupts', 'R.noInterrupts', 'void', 0),
  sei: simple('sei', 'R.interrupts', 'void', 0),
  cli: simple('cli', 'R.noInterrupts', 'void', 0),
  attachInterrupt: (c, args, tok) => {
    argCheck(c, 'attachInterrupt', args, 3, 3, tok);
    const [n, fn, mode] = c.args(args);
    if (fn.type.b !== 'func') c.err('the second argument of attachInterrupt must be the name of a function, e.g. attachInterrupt(0, onPress, FALLING)', args[1].tok);
    return { code: `R.attachInterrupt(${n.code},${fn.code},${mode.code})`, type: T('void') };
  },
  detachInterrupt: simple('detachInterrupt', 'R.detachInterrupt', 'void', 1),
  digitalPinToInterrupt: simple('digitalPinToInterrupt', 'R.pinToInterrupt', 'int', 1),
  map: simple('map', 'R.map', 'long', 5),
  random: simple('random', 'R.random', 'long', 1, 2),
  randomSeed: simple('randomSeed', 'R.randomSeed', 'void', 1),
  ledcSetup: esp32Only(simple('ledcSetup', 'R.ledcSetup', 'float', 3)),
  ledcAttachPin: esp32Only(simple('ledcAttachPin', 'R.ledcAttachPin', 'void', 2)),
  ledcAttach: esp32Only(simple('ledcAttach', 'R.ledcAttach', 'bool', 3)),
  ledcDetachPin: esp32Only(simple('ledcDetachPin', 'R.ledcDetachPin', 'void', 1)),
  ledcDetach: esp32Only(simple('ledcDetach', 'R.ledcDetachPin', 'void', 1)),
  ledcWrite: esp32Only(simple('ledcWrite', 'R.ledcWrite', 'void', 2)),
  dacWrite: esp32Only(simple('dacWrite', 'R.dacWrite', 'void', 2)),
  analogSetAttenuation: esp32Only(simple('analogSetAttenuation', 'R.noop', 'void', 1)),
  constrain: generic('constrain', (a) => `Math.min(Math.max(${a[0]},${a[1]}),${a[2]})`, 3),
  min: generic('min', (a) => `Math.min(${a[0]},${a[1]})`, 2),
  max: generic('max', (a) => `Math.max(${a[0]},${a[1]})`, 2),
  abs: generic('abs', (a) => `Math.abs(${a[0]})`, 1),
  sq: generic('sq', (a) => `(${a[0]}*${a[0]})`, 1),
  sqrt: mathf('sqrt', 'Math.sqrt'),
  pow: mathf('pow', 'Math.pow', 2),
  sin: mathf('sin', 'Math.sin'),
  cos: mathf('cos', 'Math.cos'),
  tan: mathf('tan', 'Math.tan'),
  asin: mathf('asin', 'Math.asin'),
  acos: mathf('acos', 'Math.acos'),
  atan: mathf('atan', 'Math.atan'),
  atan2: mathf('atan2', 'Math.atan2', 2),
  exp: mathf('exp', 'Math.exp'),
  log: mathf('log', 'Math.log'),
  log10: mathf('log10', 'Math.log10'),
  floor: mathf('floor', 'Math.floor'),
  ceil: mathf('ceil', 'Math.ceil'),
  fabs: mathf('fabs', 'Math.abs'),
  round: (c, args, tok) => {
    argCheck(c, 'round', args, 1, 1, tok);
    return { code: `R.round(${c.expr(args[0]).code})`, type: T('long') };
  },
  bitRead: (c, args, tok) => {
    argCheck(c, 'bitRead', args, 2, 2, tok);
    const [x, n] = c.args(args);
    return { code: `(((${x.code})>>(${n.code}))&1)`, type: T('int') };
  },
  bit: (c, args, tok) => {
    argCheck(c, 'bit', args, 1, 1, tok);
    return { code: `((1<<(${c.expr(args[0]).code}))>>>0)`, type: T('ulong') };
  },
  bitSet: bitMacro('set'),
  bitClear: bitMacro('clear'),
  bitWrite: bitMacro('write'),
  lowByte: (c, args, tok) => {
    argCheck(c, 'lowByte', args, 1, 1, tok);
    return { code: `((${c.expr(args[0]).code})&255)`, type: T('uchar') };
  },
  highByte: (c, args, tok) => {
    argCheck(c, 'highByte', args, 1, 1, tok);
    return { code: `(((${c.expr(args[0]).code})>>8)&255)`, type: T('uchar') };
  },
  isDigit: simple('isDigit', 'R.isDigit', 'bool', 1),
  isAlpha: simple('isAlpha', 'R.isAlpha', 'bool', 1),
  F: (c, args, tok) => {
    argCheck(c, 'F', args, 1, 1, tok);
    return c.expr(args[0]);
  },
  String: (c, args, tok) => {
    argCheck(c, 'String', args, 0, 2, tok);
    if (!args.length) return { code: '""', type: T('String') };
    const [x, f] = c.args(args);
    return { code: `R.str(${x.code},${JSON.stringify(x.type.b)}${f ? ',' + f.code : ''})`, type: T('String') };
  },
};

const printGen = (ln: boolean): BuiltinGen => (c, args, tok) => {
  argCheck(c, ln ? 'println' : 'print', args, ln ? 0 : 1, 2, tok);
  if (!args.length) return { code: 'R.serialWrite("\\n")', type: T('uint') };
  const [x, f] = c.args(args);
  if (x.type.dims) c.err('cannot print an array; print its elements in a loop', tok);
  return { code: `R.serialWrite(R.fmt(${x.code},${JSON.stringify(x.type.b)}${f ? ',' + f.code : ''})${ln ? '+"\\n"' : ''})`, type: T('uint') };
};

const SERIAL: Record<string, BuiltinGen> = {
  begin: simple('begin', 'R.serialBegin', 'void', 1, 2),
  end: simple('end', 'R.noop', 'void', 0),
  print: printGen(false),
  println: printGen(true),
  write: (c, args, tok) => {
    argCheck(c, 'write', args, 1, 1, tok);
    const x = c.expr(args[0]);
    return { code: `R.serialWrite(${x.type.b === 'String' ? x.code : `String.fromCharCode(${x.code})`})`, type: T('uint') };
  },
  available: simple('available', 'R.serialAvailable', 'int', 0),
  read: simple('read', 'R.serialRead', 'int', 0),
  peek: simple('peek', 'R.serialPeek', 'int', 0),
  flush: simple('flush', 'R.noop', 'void', 0),
  parseInt: simple('parseInt', 'R.serialParseInt', 'long', 0),
  parseFloat: simple('parseFloat', 'R.serialParseFloat', 'float', 0),
  readString: simple('readString', 'R.serialReadString', 'String', 0),
  readStringUntil: simple('readStringUntil', 'R.serialReadStringUntil', 'String', 1),
  setTimeout: simple('setTimeout', 'R.noop', 'void', 1),
};

/** Names used with unary `&` or passed to reference parameters: those variables get boxed. */
function findAddressTaken(roots: unknown[], funcs: FuncDef[]): Set<string> {
  const refParams = new Map(funcs.map((f) => [f.name, f.params.map((p) => !!p.type.ref && !p.type.dims && p.type.b !== 'obj')]));
  const out = new Set<string>();
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.k === 'un' && n.op === '&' && n.e?.k === 'id') out.add(n.e.name);
    if (n.k === 'call' && n.callee?.k === 'id') {
      const refs = refParams.get(n.callee.name);
      n.args.forEach((a: any, i: number) => refs?.[i] && a.k === 'id' && out.add(a.name));
    }
    if (n.k === 'decl') for (const d of n.decls) if (d.type?.ref && d.init?.k === 'id') out.add(d.init.name);
    for (const key in n) if (key !== 'tok' && key !== 'type' && key !== 't') walk(n[key]);
  };
  walk(roots);
  return out;
}

// ---------------------------------------------------------------- libraries

type MethodSpec = [min: number, max: number, ret: Base];
const LCD_METHODS: Record<string, MethodSpec> = {
  begin: [0, 3, 'void'], clear: [0, 0, 'void'], home: [0, 0, 'void'], setCursor: [2, 2, 'void'],
  print: [1, 2, 'uint'], println: [0, 2, 'uint'], write: [1, 1, 'uint'],
  cursor: [0, 0, 'void'], noCursor: [0, 0, 'void'], blink: [0, 0, 'void'], noBlink: [0, 0, 'void'],
  display: [0, 0, 'void'], noDisplay: [0, 0, 'void'], scrollDisplayLeft: [0, 0, 'void'], scrollDisplayRight: [0, 0, 'void'],
  autoscroll: [0, 0, 'void'], noAutoscroll: [0, 0, 'void'], leftToRight: [0, 0, 'void'], rightToLeft: [0, 0, 'void'],
  createChar: [2, 2, 'void'], command: [1, 1, 'void'],
};
const LIBS: Record<string, { ctor: [number, number]; methods: Record<string, MethodSpec> }> = {
  Servo: {
    ctor: [0, 0],
    methods: {
      attach: [1, 3, 'uchar'], write: [1, 1, 'void'], writeMicroseconds: [1, 1, 'void'], read: [0, 0, 'int'],
      readMicroseconds: [0, 0, 'int'], attached: [0, 0, 'bool'], detach: [0, 0, 'void'],
    },
  },
  LiquidCrystal: { ctor: [6, 11], methods: LCD_METHODS },
  LiquidCrystal_I2C: {
    ctor: [3, 3],
    methods: { ...LCD_METHODS, init: [0, 0, 'void'], backlight: [0, 0, 'void'], noBacklight: [0, 0, 'void'], setBacklight: [1, 1, 'void'] },
  },
  Wire: {
    ctor: [0, 0],
    methods: {
      begin: [0, 1, 'void'], end: [0, 0, 'void'], setClock: [1, 1, 'void'], beginTransmission: [1, 1, 'void'],
      write: [1, 2, 'uint'], endTransmission: [0, 1, 'uchar'], requestFrom: [2, 3, 'uchar'], available: [0, 0, 'int'], read: [0, 0, 'int'],
    },
  },
};

// ---------------------------------------------------------------- entry point

export interface CompiledProgram {
  /** Factory: given runtime R, returns the main generator. */
  create: (R: any) => Generator<number, void, unknown>;
  js: string;
}

export function compileSketch(src: string, board: BoardSpec = UNO): CompiledProgram {
  INT32 = board.int32;
  const toks = tokenize(src);
  const parser = new Parser(toks);
  const { globals, funcs } = parser.parseProgram();
  const g = new Gen();
  g.board = board;
  g.scopes.push(new Map());

  for (const f of funcs) {
    if (BUILTINS[f.name] && f.name !== 'map') {
      // allow users to shadow some names, but warn for core ones
    }
    g.funcs.set(f.name, { js: `$f_${f.name}`, ret: f.ret, params: f.params });
  }
  const setup = g.funcs.get('setup');
  const loop = g.funcs.get('loop');
  if (!setup) throw new CompileError("undefined reference to 'setup' — every sketch needs a setup() function", 1, 1);
  if (!loop) throw new CompileError("undefined reference to 'loop' — every sketch needs a loop() function", 1, 1);

  g.boxedNames = findAddressTaken([...globals, ...funcs.map((f) => f.body)], funcs);
  const globalInit: string[] = [];
  g.temps = [];
  for (const s of globals) g.decl(s as Stmt & { k: 'decl' }, globalInit, true);
  const globalTemps = g.temps;
  const globalNames = [...g.scopes[0].values()].map((v) => v.js);

  const fnCode: string[] = [];
  for (const f of funcs) {
    const info = g.funcs.get(f.name)!;
    g.currentFunc = info;
    g.scopes.push(new Map());
    g.temps = [];
    const prologue: string[] = [];
    const params = f.params.map((p) => {
      const isRef = !!p.type.ref && !p.type.dims && p.type.b !== 'obj';
      const { ref: _r, ...pt } = p.type;
      void _r;
      const v = g.declare(p.name, pt, f.tok);
      if (isRef) v.ref = true;
      else if (!pt.dims && pt.b !== 'obj' && g.boxedNames.has(p.name)) {
        v.boxed = true;
        prologue.push(`${v.js}=[${v.js}];`);
      }
      return v.js;
    });
    const body: string[] = [];
    for (const st of (f.body as Stmt & { k: 'block' }).body) g.stmt(st, body);
    g.scopes.pop();
    g.currentFunc = null;
    const temps = g.temps.length ? `let ${g.temps.join(',')};` : '';
    fnCode.push(`function* ${info.js}(${params.join(',')}){R.t+=${board.statementCost};${temps}${prologue.join('')}\n${body.join('\n')}\n}`);
  }

  const js = [
    '"use strict";',
    globalNames.length ? `let ${globalNames.join(',')};` : '',
    ...g.statics,
    ...fnCode,
    `function* __main(){`,
    globalTemps.length ? `let ${globalTemps.join(',')};` : '',
    globalInit.join('\n'),
    `yield* $f_setup();`,
    `for(;;){yield* $f_loop();if((R.t+=${board.statementCost})>=R.until)yield 0;}`,
    `}`,
    'return __main();',
  ].join('\n');

  let factory: (R: any) => Generator<number, void, unknown>;
  try {
    factory = new Function('R', js) as any;
  } catch (e) {
    throw new CompileError(`internal compiler error: ${(e as Error).message}`, 1, 1);
  }
  return { create: factory, js };
}
