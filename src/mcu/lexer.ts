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

/** Tokenise source, running a tiny preprocessor (#include ignored, object-like #define expanded). */
export function tokenize(src: string): Token[] {
  const raw: Token[] = [];
  const macros = new Map<string, Token[]>();
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
    const toks = tokenize(text).filter((t) => t.k !== 'eof');
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
      if (dir === 'define') {
        const dm = /^(\w+)(\(?)(.*)$/.exec(rest);
        if (!dm) throw new CompileError('malformed #define', l0, c0);
        if (dm[2] === '(') throw new CompileError('function-like macros are not supported; use a function instead', l0, c0);
        macros.set(dm[1], lexLine(dm[3].trim(), l0, c0));
      } else if (dir === 'undef') {
        macros.delete(rest.trim());
      }
      // #include, #ifdef, #pragma ... are ignored
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

  // macro expansion
  const out: Token[] = [];
  const IGNORED = new Set(['PROGMEM', 'IRAM_ATTR', 'ICACHE_RAM_ATTR', 'DRAM_ATTR']);
  const expand = (t: Token, depth: number) => {
    if (t.k === 'id' && IGNORED.has(t.v)) return;
    if (t.k === 'id' && macros.has(t.v) && depth < 16) {
      for (const mt of macros.get(t.v)!) expand({ ...mt, line: t.line, col: t.col }, depth + 1);
    } else out.push(t);
  };
  for (const t of raw) expand(t, 0);
  out.push({ k: 'eof', v: '', line, col });
  return out;
}
