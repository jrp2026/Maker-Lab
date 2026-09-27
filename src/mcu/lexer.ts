export type TokKind = 'id' | 'num' | 'str' | 'char' | 'op' | 'eof';

export interface Token {
  k: TokKind;
  v: string;
  line: number;
  col: number;
  /** numeric value for num/char tokens */
  n?: number;
  isFloat?: boolean;
  suffix?: string;
}

export class CompileError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(message);
  }
}

const OPS = [
  '<<=', '>>=', '...',
  '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
  '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}',
];

function unescape(s: string, line: number, col: number): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const e = s[++i];
    switch (e) {
      case 'n': out += '\n'; break;
      case 't': out += '\t'; break;
      case 'r': out += '\r'; break;
      case '0': out += '\0'; break;
      case '\\': out += '\\'; break;
      case '"': out += '"'; break;
      case "'": out += "'"; break;
      case 'x': {
        const m = /^[0-9a-fA-F]{1,2}/.exec(s.slice(i + 1));
        if (!m) throw new CompileError('invalid \\x escape', line, col);
        out += String.fromCharCode(parseInt(m[0], 16));
        i += m[0].length;
        break;
      }
      default:
        out += e;
    }
  }
  return out;
}

/** Evaluate a #if expression: defined(X), macro values, integers, ! && || == != < > <= >= + - * / ( ). */
function evalCondition(text: string, macros: Map<string, Token[]>): boolean {
  const expr = text
    .replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, m) => (macros.has(m) ? ' 1 ' : ' 0 '))
    .replace(/defined\s+(\w+)/g, (_, m) => (macros.has(m) ? ' 1 ' : ' 0 '))
    .replace(/\b[A-Za-z_]\w*\b/g, (m) => {
      const v = macros.get(m);
      return v && v.length === 1 && v[0].k === 'num' ? ` ${v[0].n} ` : ' 0 ';
    })
    .replace(/\b(\d+)[uUlL]+\b/g, '$1');
  if (!/^[\d\s()!&|=<>+\-*/%]*$/.test(expr)) return false;
  try {
    return !!new Function(`return (${expr || 0});`)();
  } catch {
    return false;
  }
}

/**
 * Tokenise source, running a small preprocessor: #include is ignored, object-like #define is
 * expanded, #if/#ifdef/#ifndef/#elif/#else/#endif pick branches using `predefined` macros
 * (ARDUINO, board identification like __AVR__ / ESP32) plus the sketch's own #defines.
 */
export function tokenize(src: string, predefined: Record<string, number> = {}): Token[] {
  const raw: Token[] = [];
  const macros = new Map<string, Token[]>();
  /** function-like macros: #define SQ(x) ((x)*(x)) */
  const fnMacros = new Map<string, { params: string[]; body: Token[] }>();
  /** names the sketch declares as class/struct: their `Name::member` qualifiers are kept */
  const userTypes = new Set([...src.matchAll(/\b(?:class|struct)\s+([A-Za-z_]\w*)/g)].map((m) => m[1]));
  for (const [k, v] of Object.entries(predefined)) macros.set(k, [{ k: 'num', v: String(v), n: v, line: 0, col: 0 }]);
  /** conditional-compilation stack: is this level active, has a branch been taken */
  const conds: { active: boolean; taken: boolean; outer: boolean }[] = [];
  const skipping = () => conds.length > 0 && !conds[conds.length - 1].active;
  let i = 0, line = 1, col = 1;
  const n = src.length;
  let atLineStart = true;

  const adv = (k: number) => {
    for (let j = 0; j < k; j++) {
      if (src[i] === '\n') {
        line++;
        col = 1;
      } else col++;
      i++;
    }
  };

  const lexLine = (text: string, l0: number, c0: number): Token[] => {
    // tokenise a macro body using a nested call
    const toks = tokenize(text, {}).filter((t) => t.k !== 'eof');
    return toks.map((t) => ({ ...t, line: l0, col: c0 }));
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      adv(1);
      atLineStart = true;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      adv(1);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') adv(1);
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      adv(2);
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) adv(1);
      adv(2);
      continue;
    }
    if (c === '#' && atLineStart) {
      const l0 = line, c0 = col;
      let text = '';
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\' && src[i + 1] === '\n') {
          adv(2);
          continue;
        }
        text += src[i];
        adv(1);
      }
      text = text.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      const m = /^#\s*(\w+)\s*(.*)$/.exec(text);
      if (!m) continue;
      const [, dir, rest] = m;
      if (dir === 'if' || dir === 'ifdef' || dir === 'ifndef') {
        const outer = !skipping();
        const c = dir === 'if' ? evalCondition(rest, macros) : dir === 'ifdef' ? macros.has(rest.trim()) : !macros.has(rest.trim());
        conds.push({ active: outer && c, taken: c, outer });
        continue;
      }
      if (dir === 'elif' || dir === 'else' || dir === 'endif') {
        const top = conds[conds.length - 1];
        if (!top) throw new CompileError(`#${dir} without #if`, l0, c0);
        if (dir === 'endif') conds.pop();
        else if (dir === 'else') {
          top.active = top.outer && !top.taken;
          top.taken = true;
        } else {
          const c = !top.taken && evalCondition(rest, macros);
          top.active = top.outer && c;
          top.taken = top.taken || c;
        }
        continue;
      }
      if (skipping()) continue;
      if (dir === 'define') {
        const dm = /^(\w+)(\(?)(.*)$/.exec(rest);
        if (!dm) throw new CompileError('malformed #define', l0, c0);
        if (dm[2] === '(') {
          // function-like macro: NAME(a, b) body
          const close = dm[3].indexOf(')');
          if (close < 0) throw new CompileError(`missing ')' in the parameter list of macro '${dm[1]}'`, l0, c0);
          const params = dm[3].slice(0, close).split(',').map((x) => x.trim()).filter(Boolean);
          const body = dm[3].slice(close + 1).trim();
          if (/(^|[^'"])#/.test(body)) throw new CompileError(`the # and ## macro operators are not supported (in macro '${dm[1]}')`, l0, c0);
          fnMacros.set(dm[1], { params, body: lexLine(body, l0, c0) });
          macros.delete(dm[1]);
        } else {
          macros.set(dm[1], lexLine(dm[3].trim(), l0, c0));
          fnMacros.delete(dm[1]);
        }
      } else if (dir === 'undef') {
        macros.delete(rest.trim());
        fnMacros.delete(rest.trim());
      } else if (dir === 'error') {
        throw new CompileError(`#error ${rest}`, l0, c0);
      }
      // #include, #ifdef, #pragma ... are ignored
      continue;
    }
    if (skipping()) {
      // inside an inactive #if branch: drop the rest of the line
      while (i < n && src[i] !== '\n') adv(1);
      continue;
    }
    atLineStart = false;
    const l0 = line, c0 = col;

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      adv(j - i);
      raw.push({ k: 'id', v: word, line: l0, col: c0 });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)([uUlLfF]*)/.exec(src.slice(i));
      if (!m) throw new CompileError('bad number', l0, c0);
      const body = m[1];
      const suffix = m[2].toLowerCase();
      let val: number;
      let isFloat = false;
      if (/^0[xX]/.test(body)) val = parseInt(body.slice(2), 16);
      else if (/^0[bB]/.test(body)) val = parseInt(body.slice(2), 2);
      else if (/[.eE]/.test(body) || suffix.includes('f')) {
        val = parseFloat(body);
        isFloat = true;
      } else if (/^0[0-7]+$/.test(body)) val = parseInt(body, 8);
      else val = parseInt(body, 10);
      adv(m[0].length);
      raw.push({ k: 'num', v: m[0], n: val, isFloat, suffix, line: l0, col: c0 });
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') j++;
        if (src[j] === '\n') throw new CompileError('missing terminating " character', l0, c0);
        j++;
      }
      if (j >= n) throw new CompileError('missing terminating " character', l0, c0);
      const s = unescape(src.slice(i + 1, j), l0, c0);
      adv(j + 1 - i);
      // adjacent string literal concatenation
      const prev = raw[raw.length - 1];
      if (prev && prev.k === 'str') prev.v += s;
      else raw.push({ k: 'str', v: s, line: l0, col: c0 });
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== "'") {
        if (src[j] === '\\') j++;
        j++;
      }
      const s = unescape(src.slice(i + 1, j), l0, c0);
      if (s.length !== 1) throw new CompileError('character constant must contain one character', l0, c0);
      adv(j + 1 - i);
      raw.push({ k: 'char', v: s, n: s.charCodeAt(0), line: l0, col: c0 });
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new CompileError(`stray '${c}' in program`, l0, c0);
    adv(op.length);
    raw.push({ k: 'op', v: op, line: l0, col: c0 });
  }

  // qualifiers: Class::NAME / std::x → NAME (the names are global here), except the sketch's own
  // classes, whose `Name::method` definitions the parser needs
  const flat: Token[] = [];
  for (let k = 0; k < raw.length; k++) {
    const t = raw[k];
    if (t.k === 'id' && raw[k + 1]?.k === 'op' && raw[k + 1].v === '::' && !userTypes.has(t.v)) {
      k++;
      continue;
    }
    if (t.k === 'op' && t.v === '::' && !(raw[k - 1]?.k === 'id' && userTypes.has(raw[k - 1].v))) continue;
    flat.push(t);
  }

  // macro expansion
  const out: Token[] = [];
  const IGNORED = new Set(['PROGMEM', 'IRAM_ATTR', 'ICACHE_RAM_ATTR', 'DRAM_ATTR']);
  const isOp = (t: Token | undefined, v: string) => !!t && t.k === 'op' && t.v === v;
  const expandSeq = (toks: Token[], depth: number, sink: Token[]) => {
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.k === 'id' && IGNORED.has(t.v)) continue;
      if (t.k === 'id' && depth < 16 && macros.has(t.v)) {
        expandSeq(macros.get(t.v)!.map((mt) => ({ ...mt, line: t.line, col: t.col })), depth + 1, sink);
        continue;
      }
      const fm = t.k === 'id' && depth < 16 ? fnMacros.get(t.v) : undefined;
      if (fm && isOp(toks[k + 1], '(')) {
        // collect the arguments: split on commas at the outer parenthesis level
        const args: Token[][] = [[]];
        let lvl = 0, j = k + 2;
        for (; j < toks.length; j++) {
          const a = toks[j];
          if (isOp(a, '(') || isOp(a, '[') || isOp(a, '{')) lvl++;
          else if (isOp(a, ')') || isOp(a, ']') || isOp(a, '}')) {
            if (lvl === 0) break;
            lvl--;
          } else if (isOp(a, ',') && lvl === 0) {
            args.push([]);
            continue;
          }
          args[args.length - 1].push(a);
        }
        if (j >= toks.length) throw new CompileError(`unterminated call to macro '${t.v}'`, t.line, t.col);
        const given = args.length === 1 && !args[0].length ? [] : args;
        if (given.length !== fm.params.length) {
          throw new CompileError(`macro '${t.v}' takes ${fm.params.length} argument${fm.params.length === 1 ? '' : 's'}, but ${given.length} given`, t.line, t.col);
        }
        const body: Token[] = [];
        for (const bt of fm.body) {
          const pi = bt.k === 'id' ? fm.params.indexOf(bt.v) : -1;
          if (pi >= 0) body.push(...given[pi]);
          else body.push({ ...bt, line: t.line, col: t.col });
        }
        expandSeq(body, depth + 1, sink);
        k = j;
        continue;
      }
      sink.push(t);
    }
  };
  expandSeq(flat, 0, out);
  if (conds.length) throw new CompileError('unterminated #if', line, col);
  out.push({ k: 'eof', v: '', line, col });
  return out;
}
