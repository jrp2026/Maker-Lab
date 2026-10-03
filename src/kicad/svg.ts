/**
 * Turn a part's schematic drawing (React → static SVG markup) into plain geometry: polylines,
 * circles and texts in the part's local coordinates (MakerLab units, y down). Used to build KiCad
 * symbols from the same drawing the schematic view shows, so every part — AI-made ones included —
 * gets a matching symbol.
 */

export type Fill = 'none' | 'outline' | 'background';

export type Prim =
  | { kind: 'poly'; pts: { x: number; y: number }[]; closed: boolean; fill: Fill }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: Fill }
  | { kind: 'text'; x: number; y: number; text: string; size: number; anchor: 'start' | 'middle' | 'end'; angle: number };

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });

/** Minimal parser for the well-formed SVG that React's static renderer produces. */
export function parseSvg(src: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack: Node[] = [root];
  const re = /<!--[\s\S]*?-->|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      // closing tag
      if (stack.length > 1) stack.pop();
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '');
      const node: Node = { tag: m[2].toLowerCase(), attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5]) {
      top.text += decode(m[5]);
    }
  }
  return root;
}

// ------------------------------------------------------------------ 2-D affine transforms

/** [a b c d e f] like SVG: x' = a x + c y + e, y' = b x + d y + f */
type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (p: M, q: M): M => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
];
const apply = (m: M, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

function parseTransform(s: string | undefined): M {
  let m: M = I;
  if (!s) return m;
  for (const t of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n: M = I;
    switch (t[1]) {
      case 'translate': n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]; break;
      case 'scale': n = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const r = ((v[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
        const rot: M = [c, sn, -sn, c, 0, 0];
        n = v.length >= 3 ? mul(mul([1, 0, 0, 1, v[1], v[2]], rot), [1, 0, 0, 1, -v[1], -v[2]]) : rot;
        break;
      }
      case 'matrix': n = v.length === 6 ? (v as M) : I; break;
      default: break;
    }
    m = mul(m, n);
  }
  return m;
}

// ------------------------------------------------------------------ paths

/** Flatten an SVG path into polylines (curves and arcs sampled). */
export function flattenPath(d: string): { pts: { x: number; y: number }[]; closed: boolean }[] {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: { pts: { x: number; y: number }[]; closed: boolean }[] = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
  let cur: { pts: { x: number; y: number }[]; closed: boolean } | null = null;
  const num = () => Number(toks[i++]);
  const isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const start = (nx: number, ny: number) => {
    cur = { pts: [{ x: nx, y: ny }], closed: false };
    out.push(cur);
  };
  const to = (nx: number, ny: number) => {
    if (!cur) start(x, y);
    cur!.pts.push({ x: nx, y: ny });
  };
  const N = 10;
  while (i < toks.length) {
    if (!isNum()) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = ox + num(); y = oy + num();
        start(x, y);
        sx = x; sy = y;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': x = ox + num(); y = oy + num(); to(x, y); break;
      case 'H': x = (rel ? x : 0) + num(); to(x, y); break;
      case 'V': y = (rel ? y : 0) + num(); to(x, y); break;
      case 'C': case 'S': {
        let x1: number, y1: number;
        if (cmd.toUpperCase() === 'C') { x1 = ox + num(); y1 = oy + num(); } else { x1 = 2 * x - cx; y1 = 2 * y - cy; }
        const x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
        for (let k = 1; k <= N; k++) {
          const t = k / N, u = 1 - t;
          to(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey);
        }
        cx = x2; cy = y2; x = ex; y = ey;
        continue;
      }
      case 'Q': case 'T': {
        let x1: number, y1: number;
        if (cmd.toUpperCase() === 'Q') { x1 = ox + num(); y1 = oy + num(); } else { x1 = 2 * x - cx; y1 = 2 * y - cy; }
        const ex = ox + num(), ey = oy + num();
        for (let k = 1; k <= N; k++) {
          const t = k / N, u = 1 - t;
          to(u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey);
        }
        cx = x1; cy = y1; x = ex; y = ey;
        continue;
      }
      case 'A': {
        let rx = Math.abs(num()), ry = Math.abs(num());
        const phi = (num() * Math.PI) / 180, large = num() !== 0, sweep = num() !== 0;
        const ex = ox + num(), ey = oy + num();
        if (!rx || !ry) { to(ex, ey); x = ex; y = ey; break; }
        // endpoint → centre parameterisation (SVG spec F.6.5)
        const cp = Math.cos(phi), sp = Math.sin(phi);
        const dx = (x - ex) / 2, dy = (y - ey) / 2;
        const x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
        const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
        if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
        const num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
        const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
        const cxp = (coef * rx * y1) / ry, cyp = (-coef * ry * x1) / rx;
        const ccx = cp * cxp - sp * cyp + (x + ex) / 2, ccy = sp * cxp + cp * cyp + (y + ey) / 2;
        const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
        let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
        if (!sweep && dt > 0) dt -= 2 * Math.PI;
        if (sweep && dt < 0) dt += 2 * Math.PI;
        const steps = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
        for (let k = 1; k <= steps; k++) {
          const t = t1 + (dt * k) / steps;
          to(ccx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, ccy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp);
        }
        x = ex; y = ey;
        break;
      }
      case 'Z':
        if (cur) (cur as { closed: boolean }).closed = true;
        x = sx; y = sy;
        cur = null;
        break;
      default:
        i++;
    }
    cx = x; cy = y;
  }
  return out.filter((p) => p.pts.length >= 2);
}

// ------------------------------------------------------------------ walk

const LIGHT = /^(#fff(fff)?|white|#f\w{5}|none|transparent)$/i;

function fillOf(v: string | undefined, isLine: boolean): Fill {
  if (v === undefined) return isLine ? 'none' : 'outline'; // SVG fills shapes black by default
  const f = v.trim().toLowerCase();
  if (!f || f === 'none' || f === 'transparent' || f.startsWith('url(')) return 'none';
  return LIGHT.test(f) ? 'background' : 'outline';
}

/** All drawable geometry of an SVG fragment, in its own (outer) coordinates. */
export function svgToPrims(markup: string): Prim[] {
  const out: Prim[] = [];
  const walk = (n: Node, m0: M, inherited: Record<string, string>) => {
    const m = mul(m0, parseTransform(n.attrs.transform));
    const a = { ...inherited, ...n.attrs };
    if (a.display === 'none' || a.visibility === 'hidden' || Number(a.opacity ?? 1) === 0) return;
    const hasStroke = a.stroke !== undefined && a.stroke !== 'none' && a.stroke !== 'transparent';
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const shape = (pts: { x: number; y: number }[], closed: boolean, isLine: boolean) => {
      const fill = fillOf(n.attrs.fill ?? inherited.fill, isLine);
      if (fill === 'none' && !hasStroke) return;
      out.push({ kind: 'poly', pts: pts.map((p) => apply(m, p.x, p.y)), closed, fill: closed ? fill : 'none' });
    };
    const f = (k: string) => Number(n.attrs[k] ?? 0);
    switch (n.tag) {
      case 'line':
        if (hasStroke || a.stroke === undefined) out.push({ kind: 'poly', pts: [apply(m, f('x1'), f('y1')), apply(m, f('x2'), f('y2'))], closed: false, fill: 'none' });
        break;
      case 'polyline':
      case 'polygon': {
        const v = (n.attrs.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
        const pts = [];
        for (let k = 0; k + 1 < v.length; k += 2) pts.push({ x: v[k], y: v[k + 1] });
        if (pts.length >= 2) shape(pts, n.tag === 'polygon', n.tag === 'polyline');
        break;
      }
      case 'rect': {
        const x = f('x'), y = f('y'), w = f('width'), h = f('height');
        if (w > 0 && h > 0) shape([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true, false);
        break;
      }
      case 'circle':
      case 'ellipse': {
        const cx = f('cx'), cy = f('cy');
        const rx = n.tag === 'circle' ? f('r') : f('rx'), ry = n.tag === 'circle' ? f('r') : f('ry');
        if (rx <= 0 || ry <= 0) break;
        const fill = fillOf(n.attrs.fill ?? inherited.fill, false);
        if (fill === 'none' && !hasStroke) break;
        const uniform = Math.abs(m[0] - m[3]) < 1e-6 && Math.abs(m[1] + m[2]) < 1e-6 && rx === ry;
        if (uniform) {
          const c = apply(m, cx, cy);
          out.push({ kind: 'circle', cx: c.x, cy: c.y, r: rx * scale, fill });
        } else {
          const pts = Array.from({ length: 24 }, (_, k) => ({ x: cx + rx * Math.cos((k / 24) * 2 * Math.PI), y: cy + ry * Math.sin((k / 24) * 2 * Math.PI) }));
          shape(pts, true, false);
        }
        break;
      }
      case 'path':
        for (const p of flattenPath(n.attrs.d ?? '')) shape(p.pts, p.closed, false);
        break;
      case 'text': {
        const text = (n.text + n.children.map((c) => c.text).join('')).trim();
        if (!text) break;
        const p = apply(m, f('x'), f('y'));
        const size = Number(a['font-size'] ?? 6) * scale;
        const deg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
        const anchor = (a['text-anchor'] as 'start' | 'middle' | 'end') ?? 'start';
        out.push({ kind: 'text', x: p.x, y: p.y, text, size, anchor: ['start', 'middle', 'end'].includes(anchor) ? anchor : 'start', angle: deg });
        return;
      }
      default:
        break;
    }
    // inheritable presentation attributes
    const inh: Record<string, string> = { ...inherited };
    for (const k of ['fill', 'stroke', 'font-size', 'text-anchor']) if (n.attrs[k] !== undefined) inh[k] = n.attrs[k];
    for (const c of n.children) walk(c, m, inh);
  };
  walk(parseSvg(markup), I, {});
  return out;
}
