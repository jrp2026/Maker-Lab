import type { ReactNode } from 'react';

const PREFIXES: [number, string][] = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'],
];

export function formatSI(v: number, unit = '', digits = 3): string {
  if (!Number.isFinite(v)) return `— ${unit}`;
  if (v === 0) return `0 ${unit}`.trim();
  const a = Math.abs(v);
  for (const [f, p] of PREFIXES) {
    if (a >= f * 0.9995) {
      const x = v / f;
      return `${parseFloat(x.toPrecision(digits))} ${p}${unit}`.trim();
    }
  }
  return `${parseFloat((v / 1e-12).toPrecision(digits))} p${unit}`;
}

const PREFIX_MAP: Record<string, number> = {
  G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12, R: 1, r: 1,
};

/** Parse "4.7k", "220", "10u", "4k7", "100 nF" → number. Returns NaN when invalid. */
export function parseSI(input: string): number {
  const s = input.trim().replace(/\s+/g, '').replace(/(Ω|ohms?|F|H|V|A|Hz|s)$/i, '');
  if (!s) return NaN;
  // 4k7 style
  const mid = /^(\d+)([GMkKmuµnpRr])(\d+)$/.exec(s);
  if (mid) return parseFloat(`${mid[1]}.${mid[3]}`) * PREFIX_MAP[mid[2]];
  const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([GMkKmuµnpRr]?)$/.exec(s);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] ? PREFIX_MAP[m[2]] : 1);
}

export const BAND_COLORS = ['#1b1b1b', '#8a4b22', '#e0302a', '#f28a1a', '#f6d02f', '#3aa853', '#2f6fdb', '#8a4fd3', '#8d8d8d', '#f5f5f5'];
export const GOLD = '#c9a13b';
export const SILVER = '#b8bec6';

/** Four-band colour code for a resistance value (5% tolerance). */
export function resistorBands(ohms: number): string[] {
  if (!(ohms > 0)) return [BAND_COLORS[0], BAND_COLORS[0], BAND_COLORS[0], GOLD];
  let exp = Math.floor(Math.log10(ohms)) - 1;
  let sig = Math.round(ohms / Math.pow(10, exp));
  if (sig >= 100) {
    sig = Math.round(sig / 10);
    exp += 1;
  }
  const d1 = Math.floor(sig / 10) % 10;
  const d2 = sig % 10;
  let mult: string;
  if (exp >= 0 && exp <= 9) mult = BAND_COLORS[exp];
  else if (exp === -1) mult = GOLD;
  else mult = SILVER;
  return [BAND_COLORS[d1], BAND_COLORS[d2], mult, GOLD];
}

export const LEAD = '#9aa3ad';
export const LEAD_DARK = '#6d7680';

/** A straight metal lead between two points. */
export function Lead({ x1, y1, x2, y2, w = 1.6 }: { x1: number; y1: number; x2: number; y2: number; w?: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LEAD_DARK} strokeWidth={w + 0.8} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LEAD} strokeWidth={w} strokeLinecap="round" />
    </g>
  );
}

/** Lead end drawn as a small pad so it reads as a pin on the canvas. */
export function PinTip({ x, y }: { x: number; y: number }) {
  return <rect x={x - 1.8} y={y - 1.8} width={3.6} height={3.6} rx={0.8} fill="#c7cdd4" stroke={LEAD_DARK} strokeWidth={0.5} />;
}

export function Label({ x, y, children, size = 5, fill = '#333', anchor = 'middle', weight = 600 }: {
  x: number; y: number; children: ReactNode; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; weight?: number;
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight} fontFamily="Inter, system-ui, sans-serif" style={{ userSelect: 'none', pointerEvents: 'none' }}>
      {children}
    </text>
  );
}

// ---- schematic helpers
export const SCH = '#1f3a5f';

export function SLine({ pts, w = 1.4 }: { pts: [number, number][]; w?: number }) {
  return <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={SCH} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />;
}

export function SText({ x, y, children, size = 6, anchor = 'middle' }: { x: number; y: number; children: ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontSize={size} fill={SCH} textAnchor={anchor} fontFamily="'JetBrains Mono', ui-monospace, monospace" style={{ userSelect: 'none', pointerEvents: 'none' }}>
      {children}
    </text>
  );
}

/** Zig-zag resistor symbol between (x1,y) and (x2,y). */
export function zigzag(x1: number, x2: number, y: number, amp = 4, n = 6): [number, number][] {
  const pts: [number, number][] = [[x1, y]];
  const lead = (x2 - x1) * 0.2;
  const a = x1 + lead, b = x2 - lead;
  pts.push([a, y]);
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * (i + 0.5)) / n;
    pts.push([x, y + (i % 2 ? amp : -amp)]);
  }
  pts.push([b, y], [x2, y]);
  return pts;
}

export const LED_COLORS: Record<string, { fill: string; glow: string; vf: number; label: string }> = {
  red: { fill: '#e53935', glow: '#ff5a4f', vf: 1.8, label: 'Red' },
  orange: { fill: '#fb8c00', glow: '#ffa53a', vf: 2.0, label: 'Orange' },
  yellow: { fill: '#fdd835', glow: '#fff176', vf: 2.1, label: 'Yellow' },
  green: { fill: '#43a047', glow: '#6cff78', vf: 2.2, label: 'Green' },
  blue: { fill: '#1e88e5', glow: '#63b5ff', vf: 3.0, label: 'Blue' },
  white: { fill: '#eceff1', glow: '#ffffff', vf: 3.1, label: 'White' },
};

export function ledParams(vf: number) {
  const n = 2;
  return { is: 0.02 / Math.exp(vf / (n * 0.025852)), n };
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
