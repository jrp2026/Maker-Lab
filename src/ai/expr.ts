/**
 * Tiny, safe expression language for AI-generated parts (no eval).
 *
 *   numbers, + - * / ^ %, comparisons, && || !, cond ? a : b
 *   v(A) / v(A, B)   voltage at pin/node A (relative to B)
 *   i(R1)            current through element R1 (from its first to second terminal)
 *   t                simulated time (s)
 *   prop names       the part's editable properties
 *   min max abs clamp exp log sqrt pow sin cos floor ceil sign
 */

export type Expr =
  | { k: 'n'; v: number }
  | { k: 'id'; name: string }
  | { k: 'un'; op: string; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr }
  | { k: 'call'; fn: string; args: Expr[] };

const FUNCS: Record<string, [number, number, (...a: number[]) => number]> = {
  min: [1, 8, Math.min],
  max: [1, 8, Math.max],
  abs: [1, 1, Math.abs],
  clamp: [3, 3, (x, lo, hi) => Math.min(Math.max(x, lo), hi)],
  exp: [1, 1, (x) => Math.exp(Math.min(x, 80))],
  log: [1, 1, Math.log],
  sqrt: [1, 1, Math.sqrt],
  pow: [2, 2, Math.pow],
  sin: [1, 1, Math.sin],
  cos: [1, 1, Math.cos],
  floor: [1, 1, Math.floor],
  ceil: [1, 1, Math.ceil],
  sign: [1, 1, Math.sign],
  round: [1, 1, Math.round],
  atan2: [2, 2, Math.atan2],
  tanh: [1, 1, Math.tanh],
  /** positive modulo */
  mod: [2, 2, (a, b) => (b === 0 ? 0 : ((a % b) + b) % b)],
  bit: [2, 2, (x, n) => (Math.floor(x) >>> Math.floor(n)) & 1],
  band: [2, 2, (a, b) => (Math.floor(a) & Math.floor(b)) >>> 0],
  bor: [2, 2, (a, b) => (Math.floor(a) | Math.floor(b)) >>> 0],
  bxor: [2, 2, (a, b) => (Math.floor(a) ^ Math.floor(b)) >>> 0],
  shl: [2, 2, (a, n) => (Math.floor(a) * Math.pow(2, Math.floor(n)))],
  shr: [2, 2, (a, n) => Math.floor(Math.floor(a) / Math.pow(2, Math.floor(n)))],
  hi: [2, 2, (x, th) => (x > th ? 1 : 0)],
};

export class ExprError extends Error {}

function tokenize(src: string): string[] {
  const out: string[] = [];
  const re = /\s*(\d+\.?\d*(?:e[-+]?\d+)?|\.\d+(?:e[-+]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|[-+*/^%()<>!?:,])/gy;
  let m: RegExpExecArray | null;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(pos))) break;
      throw new ExprError(`unexpected '${src.slice(pos).trim()[0]}' in "${src}"`);
    }
    out.push(m[1]);
    pos = re.lastIndex;
  }
  return out;
}

const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 8 };

export function parseExpr(src: string): Expr {
  if (src.length > 400) throw new ExprError('expression too long');
  const t = tokenize(src);
  let i = 0;
  const peek = () => t[i];
  const next = () => t[i++];
  const expect = (s: string) => {
    if (t[i] !== s) throw new ExprError(`expected '${s}' in "${src}"`);
    i++;
  };
  const primary = (): Expr => {
    const tok = next();
    if (tok === undefined) throw new ExprError(`unexpected end of "${src}"`);
    if (/^[\d.]/.test(tok)) return { k: 'n', v: parseFloat(tok) };
    if (tok === '(') {
      const e = cond();
      expect(')');
      return e;
    }
    if (tok === '-' || tok === '+' || tok === '!') return { k: 'un', op: tok, e: unary(7) };
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === '(') {
        next();
        const args: Expr[] = [];
        if (peek() !== ')') {
          args.push(cond());
          while (peek() === ',') {
            next();
            args.push(cond());
          }
        }
        expect(')');
        return { k: 'call', fn: tok, args };
      }
      return { k: 'id', name: tok };
    }
    throw new ExprError(`unexpected '${tok}' in "${src}"`);
  };
  const unary = (minPrec: number): Expr => {
    let l = primary();
    for (;;) {
      const op = peek();
      const p = op !== undefined ? PREC[op] : undefined;
      if (p === undefined || p < minPrec) break;
      next();
      const r = unary(op === '^' ? p : p + 1);
      l = { k: 'bin', op, l, r };
    }
    return l;
  };
  const cond = (): Expr => {
    const c = unary(1);
    if (peek() === '?') {
      next();
      const a = cond();
      expect(':');
      const b = cond();
      return { k: 'cond', c, a, b };
    }
    return c;
  };
  const e = cond();
  if (i < t.length) throw new ExprError(`unexpected '${t[i]}' in "${src}"`);
  return e;
}

export interface ExprScope {
  /** voltage of a named pin/node */
  v(name: string): number;
  /** current through a named element */
  i(name: string): number;
  t(): number;
  dt?(): number;
  /** frequency of a tone/PWM signal reaching a pin */
  freq?(pin: string): number;
  prop(name: string): number | undefined;
}

export type Compiled = (s: ExprScope) => number;

/** Compile to a closure, checking every name up front. */
export function compileExpr(src: string | number, names: { nodes: Set<string>; elements: Set<string>; props: Set<string>; pins?: Set<string> }): Compiled {
  if (typeof src === 'number') return () => src;
  const ast = parseExpr(String(src));
  const build = (e: Expr): Compiled => {
    switch (e.k) {
      case 'n':
        return () => e.v;
      case 'id': {
        if (e.name === 't') return (s) => s.t();
        if (e.name === 'dt') return (s) => s.dt?.() ?? 0;
        if (e.name === 'pi' || e.name === 'PI') return () => Math.PI;
        if (e.name === 'true') return () => 1;
        if (e.name === 'false') return () => 0;
        if (!names.props.has(e.name)) throw new ExprError(`unknown name '${e.name}' (not a property)`);
        const n = e.name;
        return (s) => s.prop(n) ?? 0;
      }
      case 'un': {
        const x = build(e.e);
        if (e.op === '-') return (s) => -x(s);
        if (e.op === '!') return (s) => (x(s) ? 0 : 1);
        return x;
      }
      case 'bin': {
        const a = build(e.l), b = build(e.r);
        switch (e.op) {
          case '+': return (s) => a(s) + b(s);
          case '-': return (s) => a(s) - b(s);
          case '*': return (s) => a(s) * b(s);
          case '/': return (s) => { const d = b(s); return d === 0 ? 0 : a(s) / d; };
          case '%': return (s) => a(s) % b(s);
          case '^': return (s) => Math.pow(a(s), b(s));
          case '<': return (s) => +(a(s) < b(s));
          case '>': return (s) => +(a(s) > b(s));
          case '<=': return (s) => +(a(s) <= b(s));
          case '>=': return (s) => +(a(s) >= b(s));
          case '==': return (s) => +(a(s) === b(s));
          case '!=': return (s) => +(a(s) !== b(s));
          case '&&': return (s) => +(!!a(s) && !!b(s));
          case '||': return (s) => +(!!a(s) || !!b(s));
        }
        throw new ExprError(`unknown operator ${e.op}`);
      }
      case 'cond': {
        const c = build(e.c), a = build(e.a), b = build(e.b);
        return (s) => (c(s) ? a(s) : b(s));
      }
      case 'call': {
        if (e.fn === 'v') {
          const ids = e.args.map((a) => {
            if (a.k !== 'id' || !names.nodes.has(a.name)) throw new ExprError(`v() needs pin or node names, got ${a.k === 'id' ? `'${a.name}'` : 'an expression'}`);
            return a.name;
          });
          if (ids.length === 1) return (s) => s.v(ids[0]);
          if (ids.length === 2) return (s) => s.v(ids[0]) - s.v(ids[1]);
          throw new ExprError('v() takes one or two names');
        }
        if (e.fn === 'freq') {
          const a = e.args[0];
          if (e.args.length !== 1 || a.k !== 'id' || !(names.pins ?? names.nodes).has(a.name)) throw new ExprError('freq() needs a pin name');
          const n = a.name;
          return (s) => s.freq?.(n) ?? 0;
        }
        if (e.fn === 'i') {
          const a = e.args[0];
          if (e.args.length !== 1 || a.k !== 'id' || !names.elements.has(a.name)) throw new ExprError(`i() needs an element id${a?.k === 'id' ? `, '${a.name}' is not one` : ''}`);
          const n = a.name;
          return (s) => s.i(n);
        }
        const f = FUNCS[e.fn];
        if (!f) throw new ExprError(`unknown function '${e.fn}'`);
        if (e.args.length < f[0] || e.args.length > f[1]) throw new ExprError(`${e.fn}() takes ${f[0]}${f[1] !== f[0] ? `–${f[1]}` : ''} argument(s)`);
        const args = e.args.map(build);
        const fn = f[2];
        return (s) => fn(...args.map((x) => x(s)));
      }
    }
  };
  const fn = build(ast);
  return (s) => {
    const r = fn(s);
    return Number.isFinite(r) ? r : 0;
  };
}
