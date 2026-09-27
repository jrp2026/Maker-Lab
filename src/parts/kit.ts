/**
 * Helpers for authoring built-in parts as declarative specs (the same format the
 * AI generator uses). Coordinates: 10 units = 0.1" breadboard pitch.
 */
export type Raw = Record<string, any>;
type Shape = Raw;
type Pin = { id: string; x: number; y: number; label: string; kind: 'lead' | 'terminal' };

export const COL = {
  ic: '#26282c',
  icText: '#d9dce0',
  metal: '#c3c9d0',
  metalDark: '#7d858e',
  lead: '#a9b0b8',
  pcbBlue: '#1d5bb8',
  pcbGreen: '#1c7040',
  pcbRed: '#b02a24',
  pcbBlack: '#222428',
  pcbPurple: '#55358f',
  header: '#1b1c1f',
  white: '#f4f2ec',
  copper: '#c98a3c',
  gold: '#d8b654',
  tin: '#d5d9de',
  silk: '#f3f5f1',
};

/** Lighten (k > 0) or darken (k < 0) a #rgb / #rrggbb colour. */
export function shade(c: string, k: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (!m) return c;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

export const text = (x: number, y: number, t: string, size = 5, fill = '#222', anchor = 'middle', extra: Raw = {}): Shape => ({ type: 'text', x, y, text: t, size, fill, anchor, ...extra });
export const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Raw = {}): Shape => ({ type: 'rect', x, y, w, h, fill, ...extra });
export const circle = (cx: number, cy: number, r: number, fill: string, extra: Raw = {}): Shape => ({ type: 'circle', cx, cy, r, fill, ...extra });
export const line = (x1: number, y1: number, x2: number, y2: number, stroke = COL.lead, strokeWidth = 1.8): Shape => ({ type: 'line', x1, y1, x2, y2, stroke, strokeWidth });
export const path = (d: string, fill: string, extra: Raw = {}): Shape => ({ type: 'path', d, fill, ...extra });

/** Silkscreen print on a PCB. */
export const silk = (x: number, y: number, t: string, size = 3.6, anchor = 'middle', fill: string = COL.silk, extra: Raw = {}): Shape => text(x, y, t, size, fill, anchor, { weight: 700, ...extra });

/** Pins in a row at y (default 0), 10 apart. */
export function pinRow(ids: string[], opts: { x0?: number; y?: number; kind?: 'lead' | 'terminal'; labels?: Record<string, string>; step?: number } = {}): Pin[] {
  const { x0 = 0, y = 0, kind = 'lead', labels = {}, step = 10 } = opts;
  // pins always sit on the 0.1" grid (the spec validator snaps them), so the artwork must too
  const g = (v: number) => Math.round(v / 10) * 10;
  return ids.map((id, i) => ({ id, x: g(x0 + i * step), y: g(y), label: labels[id] ?? id, kind }));
}

/** Tinned metal legs from each pin up (or down) to y. */
export const legs = (pins: Pin[], toY: number, color: string = COL.lead): Shape[] =>
  pins.flatMap((p) => [line(p.x, toY, p.x, p.y, shade(color, -0.25), 2.2), line(p.x - 0.35, toY, p.x - 0.35, p.y, shade(color, 0.35), 0.8)]);

/** Silkscreen pin names fitted to the 0.1" pitch so neighbours never run together. */
export function pinLabels(pins: Pin[], y: number, fill: string = COL.silk, max = 3.1): Shape[] {
  const names = pins.map((p) => p.id.replace(/^V(\d)$/, '$1V'));
  const pitch = pins.length > 1 ? Math.min(...pins.slice(1).map((p, i) => Math.abs(p.x - pins[i].x)).filter((d) => d > 0), 10) : 10;
  return pins.map((p, i) => silk(p.x, y, names[i].slice(0, 6), Math.max(1.6, Math.min(max, (pitch - 1.2) / (0.76 * names[i].slice(0, 6).length))), 'middle', fill));
}

/** Plated mounting hole. */
export const mountHole = (cx: number, cy: number, r = 2.4): Shape[] => [
  circle(cx, cy, r, '#d6cfae', { grad: '#a99f78', gradDir: 'd' }),
  circle(cx, cy, r * 0.58, '#16171a', { stroke: '#8f886c', strokeWidth: 0.3 }),
];

/** Bare PCB (solder mask with a slight sheen, darker edge, optional plated mounting holes). */
export function pcb(x: number, y: number, w: number, h: number, color: string, opts: { rx?: number; holes?: 'corners' | 'top' | 'none' } = {}): Shape[] {
  const rx = opts.rx ?? 2.5;
  const out: Shape[] = [
    rect(x, y, w, h, shade(color, 0.08), { rx, grad: shade(color, -0.14), stroke: shade(color, -0.45), strokeWidth: 0.7, shadow: 1 }),
    rect(x + 0.9, y + 0.9, w - 1.8, h - 1.8, 'none', { rx: Math.max(0, rx - 0.8), stroke: 'rgba(255,255,255,0.13)', strokeWidth: 0.5 }),
  ];
  const holes = opts.holes ?? 'top';
  const r = Math.min(2.4, w / 12, h / 10);
  if (holes !== 'none') out.push(...mountHole(x + 4.2, y + 4.2, r), ...mountHole(x + w - 4.2, y + 4.2, r));
  if (holes === 'corners') out.push(...mountHole(x + 4.2, y + h - 4.2, r), ...mountHole(x + w - 4.2, y + h - 4.2, r));
  return out;
}

/** Male pin header along a row of pins: black plastic with gold square posts. */
export function header(pins: Pin[], opts: { labelY?: number; labelColor?: string; labelSize?: number } = {}): Shape[] {
  if (!pins.length) return [];
  const xs = pins.map((p) => p.x), y = pins[0].y;
  const x0 = Math.min(...xs) - 5, x1 = Math.max(...xs) + 5;
  const out: Shape[] = [rect(x0, y - 5, x1 - x0, 9, '#2a2b2f', { rx: 0.8, grad: '#111214', shadow: 0.6 })];
  for (const p of pins) {
    if (p.x > x0 + 6) out.push(line(p.x - 5, y - 4.2, p.x - 5, y + 3.2, '#3b3d42', 0.4));
    out.push(rect(p.x - 1.5, y - 1.5, 3, 3, '#e3c25e', { grad: '#9c7b26', gradDir: 'd', rx: 0.3 }));
  }
  if (opts.labelY !== undefined) out.push(...pinLabels(pins, opts.labelY, opts.labelColor ?? COL.silk, opts.labelSize ?? 3.6));
  return out;
}

/** Generic schematic box with a lead per pin. */
export function boxSymbol(pins: Pin[], title: string): Shape[] {
  const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
  const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6;
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const twoRows = top !== bottom;
  const by = twoRows ? top + 5 : top - 30, bh = twoRows ? bottom - top - 10 : 22;
  // the name as large as the box allows; each lead labelled with its pin name inside the box
  const size = Math.max(3.5, Math.min(7, (x1 - x0 - 4) / (Math.max(1, title.length) * 0.62)));
  const out: Shape[] = [rect(x0, by, x1 - x0, bh, 'none', { strokeWidth: 1.3 }), text((x0 + x1) / 2, by + bh / 2 + size * 0.36, title, size, '#222', 'middle', { weight: 700 })];
  for (const p of pins) {
    const atTop = p.y <= by;
    const edge = atTop ? by : by + bh;
    out.push(line(p.x, p.y, p.x, edge, '#1f3a5f', 1.2));
    out.push(text(p.x, atTop ? edge + 3.4 : edge - 1.3, p.id.length > 4 ? p.id.slice(0, 4) : p.id, 2.8, '#222'));
  }
  return out;
}

/** Moulded black epoxy body (chips, regulators, transistors). */
export const epoxy = (x: number, y: number, w: number, h: number, color: string = COL.ic, rx = 1.2): Shape[] => [
  rect(x, y, w, h, shade(color, 0.1), { rx, grad: shade(color, -0.25), shadow: 0.9, stroke: shade(color, -0.5), strokeWidth: 0.5 }),
  rect(x + 1.1, y + 1.1, w - 2.2, h - 2.2, 'none', { rx: Math.max(0, rx - 0.6), stroke: 'rgba(255,255,255,0.07)', strokeWidth: 0.6 }),
];

/**
 * DIP package straddling the breadboard trench: pin 1 bottom-left (y = 30), numbering
 * counter-clockwise, top row at y = 0 (0.3" row spacing).
 */
export function dip(names: string[], opts: { label: string; sub?: string; color?: string; labels?: Record<string, string>; wide?: boolean } ) {
  const n = names.length, half = n / 2;
  const rowGap = opts.wide ? 60 : 30;
  const pins: Pin[] = names.map((id, i) => {
    const bottom = i < half;
    const x = bottom ? i * 10 : (n - 1 - i) * 10;
    return { id, x, y: bottom ? rowGap : 0, label: `${i + 1}: ${opts.labels?.[id] ?? id}`, kind: 'lead' };
  });
  const w = (half - 1) * 10 + 12;
  const body = opts.color ?? COL.ic;
  const shapes: Shape[] = [
    // gull legs: a wide shoulder at the body, a narrow tip into the breadboard
    ...pins.flatMap((p) => {
      const top = p.y === 0, edge = top ? 5 : rowGap - 5;
      return [
        rect(p.x - 1.9, top ? edge - 1.2 : edge - 0.8, 3.8, 2, COL.metal, { grad: COL.metalDark, gradDir: 'h' }),
        rect(p.x - 1, top ? p.y : edge, 2, Math.abs(edge - p.y), COL.metal, { grad: shade(COL.metalDark, -0.1), gradDir: 'h' }),
      ];
    }),
    ...epoxy(-6, 4, w, rowGap - 8, body, 1.4),
    path(`M -6 ${rowGap / 2 - 3.6} A 3.6 3.6 0 0 1 -6 ${rowGap / 2 + 3.6} Z`, shade(body, -0.45)),
    circle(-1.5, rowGap - 8.5, 1.5, shade(body, -0.3), { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 0.4 }),
    text(-6 + w / 2, rowGap / 2 + (opts.sub ? -0.5 : 2), opts.label, Math.min(5.6, (w - 6) / (0.66 * opts.label.length), (rowGap - 10) / 1.6), shade(body, 0.72), 'middle', { weight: 500 }),
  ];
  if (opts.sub) shapes.push(text(-6 + w / 2, rowGap / 2 + 5.5, opts.sub, Math.min(3.4, (w - 6) / (0.6 * opts.sub.length)), shade(body, 0.5), 'middle', { weight: 400 }));
  return { pins, shapes, symbol: boxSymbol(pins, opts.label) };
}

/**
 * Breakout carrier board with two header rows 0.6" apart (StepStick drivers, TB6612 breakouts):
 * same pin order as a wide DIP (pin 1 bottom-left, counter-clockwise), drawn as a small PCB
 * with silkscreen pin names. `detail` draws the parts on the board inside `box`.
 */
export function carrier(names: string[], opts: { title?: string; color: string; labels?: Record<string, string>; silk?: Record<string, string>; detail?: (box: { x: number; y: number; w: number; h: number }) => Shape[] }) {
  const d = dip(names, { label: opts.title ?? '', wide: true, labels: opts.labels });
  const top = d.pins.filter((p) => p.y === 0).sort((a, b) => a.x - b.x), bottom = d.pins.filter((p) => p.y === 60).sort((a, b) => a.x - b.x);
  const x0 = -6, x1 = Math.max(...d.pins.map((p) => p.x)) + 6;
  const box = { x: x0, y: -6, w: x1 - x0, h: 72 };
  const nm = (p: Pin) => opts.silk?.[p.id] ?? p.id;
  const shapes: Shape[] = [
    ...pcb(box.x, box.y, box.w, box.h, opts.color, { holes: 'none', rx: 1.5 }),
    ...[...top, ...bottom].map((p) => circle(p.x, p.y, 3.4, COL.tin, { grad: '#9fa6ad', gradDir: 'r' })),
    ...header(top),
    ...header(bottom),
    ...pinLabels(top.map((p) => ({ ...p, id: nm(p) })), 10.5),
    ...pinLabels(bottom.map((p) => ({ ...p, id: nm(p) })), 54),
    ...(opts.detail?.({ x: box.x + 3, y: 13, w: box.w - 6, h: 34 }) ?? []),
  ];
  if (opts.title) shapes.push(silk((x0 + x1) / 2, 50.5 - 4, opts.title, 3.4, 'middle', COL.silk, { z: 2 }));
  return { pins: d.pins, shapes, symbol: d.symbol, box };
}

/** Module PCB with a single row of header pins along the bottom edge (y = 0). */
export function moduleBoard(ids: string[], opts: { w?: number; h: number; color?: string; title?: string; titleColor?: string; titleY?: number; titleX?: number; titleSize?: number; labels?: Record<string, string>; kind?: 'lead' | 'terminal'; x0?: number; holes?: 'corners' | 'top' | 'none'; /** left edge of the board (default: centred on the pins) */ boardX?: number }) {
  const pins = pinRow(ids, { x0: opts.x0 ?? 0, kind: opts.kind ?? 'lead', labels: opts.labels });
  const xs = pins.map((p) => p.x);
  const w = Math.max(opts.w ?? 0, Math.max(...xs) - Math.min(...xs) + 20);
  const x = opts.boardX ?? (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2;
  const color = opts.color ?? COL.pcbBlue;
  const shapes: Shape[] = [
    ...pcb(x, -opts.h - 4, w, opts.h, color, { holes: opts.holes }),
    // solder pads of the header, then the header itself
    ...pins.map((p) => rect(p.x - 2.6, -8.2, 5.2, 3.6, COL.tin, { rx: 1.2, grad: '#a3a9b0' })),
    ...header(pins),
    ...pinLabels(pins, -9.8),
  ];
  if (opts.title) {
    const size = opts.titleSize ?? Math.min(5.5, (w - 10) / (0.68 * opts.title.length));
    shapes.push(silk(opts.titleX ?? x + w / 2, opts.titleY ?? -opts.h + 11, opts.title, size, 'middle', opts.titleColor ?? COL.silk, { z: 2 }));
  }
  return { pins, shapes, box: { x, y: -opts.h - 4, w, h: opts.h } };
}

/** TO-92 package (small transistor / sensor), pins at 0, 10, 20. */
export function to92(ids: string[], label: string, color = COL.ic, labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { labels });
  const dark = color === COL.ic;
  return {
    pins,
    shapes: [
      ...legs(pins, -8),
      path('M-4 -9 L24 -9 L24 -18 A14 11 0 0 0 -4 -18 Z', shade(color, 0.12), { grad: shade(color, -0.3), gradDir: 'h', stroke: shade(color, -0.5), strokeWidth: 0.6, shadow: 0.8 }),
      rect(-4, -12, 28, 3, shade(color, 0.22), { opacity: 0.5 }),
      text(10, -15, label, Math.min(4.2, 40 / label.length), dark ? '#c9ccd1' : '#222', 'middle', { weight: 500 }),
    ],
  };
}

/** TO-220 package (regulators, power transistors), pins at 0, 10, 20. */
export function to220(ids: string[], label: string, labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { labels });
  return {
    pins,
    shapes: [
      rect(-6, -48, 32, 18, '#dfe3e7', { rx: 1.5, grad: '#9aa2ab', gradDir: 'd', stroke: COL.metalDark, strokeWidth: 0.6, shadow: 0.9 }),
      circle(10, -40, 3.8, '#2c2e32', { stroke: '#8e959d', strokeWidth: 0.8 }),
      ...legs(pins, -10),
      ...pins.map((p) => rect(p.x - 2.2, -11, 4.4, 3.5, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
      ...epoxy(-6, -32, 32, 22, COL.ic, 1),
      text(10, -19, label, Math.min(5.2, 44 / label.length), COL.icText, 'middle', { weight: 500 }),
    ],
  };
}

/** A TO-220 transistor/regulator standing on a module: tab at the top, body with its marking, three legs down to `legY`. */
export function to220At(x: number, y: number, label: string, legY = y + 34): Shape[] {
  return [
    ...[6, 12, 18].map((dx) => rect(x + dx - 1, y + 22, 2, legY - y - 22, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(x, y, 24, 12, '#dfe3e7', { rx: 1, grad: '#9aa2ab', gradDir: 'd', stroke: COL.metalDark, strokeWidth: 0.5, shadow: 0.9 }),
    circle(x + 12, y + 5, 2.6, '#2c2e32', { stroke: '#8e959d', strokeWidth: 0.6 }),
    ...epoxy(x, y + 9, 24, 15, COL.ic, 0.8),
    text(x + 12, y + 18.2, label, Math.min(3.6, 22 / (0.62 * label.length)), COL.icText, 'middle', { weight: 500 }),
  ];
}

/** SOT-23 transistor (three legs), centred at (cx, cy). */
export const sot23 = (cx: number, cy: number, mark = ''): Shape[] => [
  rect(cx - 2.6, cy - 3, 1.1, 1.3, COL.metal), rect(cx + 1.5, cy - 3, 1.1, 1.3, COL.metal), rect(cx - 0.55, cy + 1.7, 1.1, 1.3, COL.metal),
  rect(cx - 3, cy - 1.8, 6, 3.6, '#2a2c30', { rx: 0.3, grad: '#15161a' }),
  ...(mark ? [text(cx, cy + 0.8, mark, 1.8, '#9ea2a8', 'middle', { weight: 500 })] : []),
];

/** Two-lead axial part between x = 0 and 40. */
export function axial(ids: [string, string], body: Shape[], labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { step: 40, labels });
  return { pins, shapes: [line(0, 0, 40, 0, shade(COL.lead, -0.2), 2), line(0, -0.4, 40, -0.4, shade(COL.lead, 0.35), 0.7), ...body] };
}

/**
 * Screw terminal block (KF301 style) at pin positions: plastic body, screw heads and the
 * wire entries on the `facing` side (towards the board edge the wires come from).
 */
export function screwTerminals(pins: Pin[], color = '#2f7fd6', facing: 'up' | 'down' | 'left' | 'right' = 'down'): Shape[] {
  if (!pins.length) return [];
  const vertical = facing === 'left' || facing === 'right';
  const sgn = facing === 'down' || facing === 'right' ? 1 : -1;
  const along = pins.map((p) => (vertical ? p.y : p.x)), base = vertical ? pins[0].x : pins[0].y;
  // local frame: a runs along the block, c across it (positive towards the wire entries)
  const R = (a0: number, c0: number, la: number, lc: number, fill: string, extra: Raw = {}) => {
    const cc = sgn > 0 ? base + c0 : base - c0 - lc;
    return vertical ? rect(cc, a0, lc, la, fill, extra) : rect(a0, cc, la, lc, fill, extra);
  };
  const P = (a: number, c: number): [number, number] => (vertical ? [base + sgn * c, a] : [a, base + sgn * c]);
  const a0 = Math.min(...along) - 5, a1 = Math.max(...along) + 5;
  const dir = vertical ? 'h' : 'v';
  const out: Shape[] = [R(a0, -9, a1 - a0, 13, shade(color, 0.14), { rx: 1.2, grad: shade(color, -0.3), gradDir: dir, stroke: shade(color, -0.5), strokeWidth: 0.5, shadow: 0.9 })];
  for (const a of along) {
    if (a > a0 + 6) {
      const [x1, y1] = P(a - 5, -8.5), [x2, y2] = P(a - 5, 3.5);
      out.push(line(x1, y1, x2, y2, shade(color, -0.35), 0.5));
    }
    const [sx, sy] = P(a, -3.2), [l1x, l1y] = P(a - 2.1, -1.1), [l2x, l2y] = P(a + 2.1, -5.3);
    out.push(
      R(a - 3, 0.8, 6, 2.8, '#15171a', { rx: 0.5 }),
      circle(sx, sy, 3.3, '#eef1f4', { grad: '#7f8891', gradDir: 'r', stroke: '#5f6770', strokeWidth: 0.4 }),
      line(l1x, l1y, l2x, l2y, '#4a5058', 0.9),
    );
  }
  return out;
}

/** Two-pin jumper with its black shunt fitted. */
export const jumper = (cx: number, cy: number, vertical = false): Shape[] =>
  vertical
    ? [rect(cx - 3, cy - 7, 6, 14, '#2b2c30', { rx: 1, grad: '#101113', gradDir: 'h', shadow: 0.8 }), rect(cx - 1.6, cy - 5.5, 3.2, 3.2, '#3c3e43'), rect(cx - 1.6, cy + 2.3, 3.2, 3.2, '#3c3e43')]
    : [rect(cx - 7, cy - 3, 14, 6, '#2b2c30', { rx: 1, grad: '#101113', shadow: 0.8 }), rect(cx - 5.5, cy - 1.6, 3.2, 3.2, '#3c3e43'), rect(cx + 2.3, cy - 1.6, 3.2, 3.2, '#3c3e43')];

/** An on-board SMD status LED that glows with `level`. */
export function statusLed(x: number, y: number, color: string, level: string): { shape: Shape; indicator: Raw } {
  return {
    shape: rect(x - 2.5, y - 1.5, 5, 3, '#efe9d2', { rx: 0.4, grad: shade(color, 0.55), gradDir: 'h', stroke: '#b9b39c', strokeWidth: 0.3 }),
    indicator: { shape: rect(x - 2.5, y - 1.5, 5, 3, color, { rx: 0.6 }), color, level },
  };
}

// ---- small surface-mount details that make a module read as the real board

/** SMD resistor / capacitor / diode, centred at (x, y); horizontal unless `vertical`. */
export function smd(x: number, y: number, kind: 'r' | 'c' | 'd' = 'r', vertical = false): Shape[] {
  const [w, h] = vertical ? [2, 4] : [4, 2];
  const body = kind === 'r' ? '#1d1e21' : kind === 'c' ? '#b88a5a' : '#2a2b2e';
  const out: Shape[] = [rect(x - w / 2, y - h / 2, w, h, body, { rx: 0.2 })];
  if (vertical) out.push(rect(x - 1, y - 2, 2, 0.9, COL.tin), rect(x - 1, y + 1.1, 2, 0.9, COL.tin));
  else out.push(rect(x - 2, y - 1, 0.9, 2, COL.tin), rect(x + 1.1, y - 1, 0.9, 2, COL.tin));
  if (kind === 'd') out.push(vertical ? rect(x - 1, y - 1, 2, 0.5, '#d9d9d9') : rect(x - 1.1, y - 1, 0.5, 2, '#d9d9d9'));
  return out;
}

/** A scatter of SMD passives along a line — the bits every module has around its chip. */
export const smdRow = (x: number, y: number, n: number, step = 5.5, vertical = false, kinds = 'rcrc'): Shape[] =>
  Array.from({ length: n }, (_, i) => smd(vertical ? x : x + i * step, vertical ? y + i * step : y, kinds[i % kinds.length] as 'r' | 'c', vertical)).flat();

/** Surface-mount IC with gull-wing legs (SOIC / SOT / TSSOP), or a leadless QFN square. */
export function chip(x: number, y: number, w: number, h: number, opts: { label?: string; sub?: string; legs?: 'soic' | 'qfp' | 'qfn' | 'none'; n?: number; color?: string; vertical?: boolean } = {}): Shape[] {
  const kind = opts.legs ?? 'soic', color = opts.color ?? COL.ic;
  const out: Shape[] = [];
  const perSide = Math.max(1, opts.n ?? Math.max(2, Math.round((opts.vertical ? h : w) / 2.6)));
  const leg = (lx: number, ly: number, lw: number, lh: number) => out.push(rect(lx, ly, lw, lh, COL.metal, { grad: COL.metalDark, gradDir: lw > lh ? 'h' : 'v' }));
  const along = (len: number, i: number, cnt: number) => (len / cnt) * (i + 0.5);
  if (kind === 'soic' || kind === 'qfp') {
    const sides = kind === 'qfp' ? ['t', 'b', 'l', 'r'] : opts.vertical ? ['l', 'r'] : ['t', 'b'];
    for (const s of sides) {
      const horiz = s === 't' || s === 'b', cnt = kind === 'qfp' ? perSide : perSide, len = horiz ? w : h;
      for (let i = 0; i < cnt; i++) {
        const a = along(len, i, cnt);
        if (s === 't') leg(x + a - 0.55, y - 1.6, 1.1, 1.8);
        if (s === 'b') leg(x + a - 0.55, y + h - 0.2, 1.1, 1.8);
        if (s === 'l') leg(x - 1.6, y + a - 0.55, 1.8, 1.1);
        if (s === 'r') leg(x + w - 0.2, y + a - 0.55, 1.8, 1.1);
      }
    }
  }
  if (kind === 'qfn') out.push(rect(x - 0.6, y - 0.6, w + 1.2, h + 1.2, COL.tin, { rx: 0.4 }));
  out.push(...epoxy(x, y, w, h, color, 0.6), circle(x + 1.6, y + 1.6, 0.6, shade(color, 0.3)));
  if (opts.label) {
    const size = Math.min(2.9, (w - 2) / (0.66 * opts.label.length), h / 2.4);
    out.push(text(x + w / 2, y + h / 2 + size * (opts.sub ? 0.1 : 0.36), opts.label, size, '#bfc3c8', 'middle', { weight: 500 }));
    if (opts.sub) out.push(text(x + w / 2, y + h / 2 + size * 1.25, opts.sub, Math.min(size * 0.7, (w - 1.5) / (0.62 * opts.sub.length)), '#8d9197', 'middle', { weight: 400 }));
  }
  return out;
}

/** Aluminium electrolytic capacitor seen from above: sleeve ring, can with the vent cross. */
export function ecap(cx: number, cy: number, r: number, sleeve = '#1a2a58'): Shape[] {
  return [
    circle(cx, cy, r, shade(sleeve, 0.15), { grad: shade(sleeve, -0.35), gradDir: 'd', shadow: 1 }),
    path(`M ${cx + r * 0.2} ${cy - r * 0.98} A ${r} ${r} 0 0 1 ${cx + r * 0.98} ${cy - r * 0.2} L ${cx + r * 0.78} ${cy - r * 0.16} A ${r * 0.8} ${r * 0.8} 0 0 0 ${cx + r * 0.16} ${cy - r * 0.78} Z`, '#c8cdd4', { opacity: 0.85 }),
    circle(cx, cy, r * 0.8, '#eef1f4', { grad: '#8c949d', gradDir: 'r', stroke: '#7a828b', strokeWidth: 0.3 }),
    line(cx - r * 0.45, cy, cx + r * 0.45, cy, '#8a929b', 0.5),
    line(cx, cy - r * 0.45, cx, cy + r * 0.45, '#8a929b', 0.5),
  ];
}

/** Gold solder pads for wire-on terminals (BMS, charger and converter boards), with optional silk names above. */
export function pads(pins: Pin[], names?: Record<string, string>, labelDy = -6): Shape[] {
  return pins.flatMap((p) => [
    rect(p.x - 3.6, p.y - 3.2, 7.2, 6.4, '#f0d27a', { rx: 1.2, grad: '#b88f2a', gradDir: 'd', stroke: '#9c7a22', strokeWidth: 0.3 }),
    circle(p.x, p.y, 1.3, '#3a3326'),
    ...(names ? [silk(p.x, p.y + labelDy, names[p.id] ?? p.id, 2.6)] : []),
  ]);
}

/** Rectangular multi-turn trimmer (3296W): blue box with the brass screw at one end. */
export const trimpot3296 = (x: number, y: number): Shape[] => [
  rect(x, y, 14, 7, '#3b82e0', { rx: 0.8, grad: '#1f4f9f', shadow: 1, stroke: '#173f7e', strokeWidth: 0.4 }),
  circle(x + 3.4, y + 3.5, 2.2, '#f1d98a', { grad: '#a8862e', gradDir: 'r' }),
  line(x + 2, y + 3.5, x + 4.8, y + 3.5, '#6b5418', 0.6),
  text(x + 9.5, y + 4.6, '103', 2.4, '#e8edf6', 'middle', { weight: 600 }),
];

/** D2PAK / TO-263 power chip lying on the board (buck regulators). */
export const d2pak = (x: number, y: number, w: number, h: number, label: string): Shape[] => [
  rect(x + w * 0.15, y - 3, w * 0.7, 4, COL.metal, { grad: COL.metalDark }),
  ...[0.2, 0.35, 0.5, 0.65, 0.8].map((f) => rect(x + w * f - 0.6, y + h - 0.5, 1.2, 3, COL.metal)),
  ...epoxy(x, y, w, h, COL.ic, 0.6),
  text(x + w / 2, y + h / 2 + 1, label, Math.min(3, (w - 2) / (0.66 * label.length)), COL.icText, 'middle', { weight: 500 }),
];

/** Square cermet trimmer (3362 / 3296): blue body with a brass adjustment screw. */
export function trimpot(cx: number, cy: number, s = 9, color = '#2f6fd6'): Shape[] {
  return [
    rect(cx - s / 2, cy - s / 2, s, s, shade(color, 0.15), { rx: 1, grad: shade(color, -0.3), shadow: 1, stroke: shade(color, -0.45), strokeWidth: 0.4 }),
    circle(cx, cy, s * 0.3, '#f1d98a', { grad: '#a8862e', gradDir: 'r', stroke: '#8a6c20', strokeWidth: 0.3 }),
    line(cx - s * 0.2, cy + s * 0.2, cx + s * 0.2, cy - s * 0.2, '#6b5418', 0.7),
  ];
}

/** HC-49 quartz crystal can seen from above. */
export const crystalCan = (x: number, y: number, w = 13, h = 5.5, mark = ''): Shape[] => [
  rect(x, y, w, h, '#eef1f4', { rx: h / 2, grad: '#8e969f', shadow: 0.8, stroke: '#7a828b', strokeWidth: 0.3 }),
  ...(mark ? [text(x + w / 2, y + h / 2 + 1.1, mark, Math.min(3, h * 0.55), '#4a5058', 'middle', { weight: 500 })] : []),
];

/** Shielded power inductor (the big square on buck/boost modules). */
export const powerInductor = (cx: number, cy: number, s = 16, mark = '330'): Shape[] => [
  rect(cx - s / 2, cy - s / 2, s, s, '#3a3c40', { rx: s * 0.18, grad: '#1c1d20', gradDir: 'd', shadow: 1 }),
  circle(cx, cy, s * 0.36, '#2a2b2e', { stroke: '#4c4f55', strokeWidth: 0.5 }),
  text(cx, cy + s * 0.08, mark, s * 0.2, '#b9bcc1', 'middle', { weight: 500 }),
];

/** Toroidal inductor: copper winding on a yellow/grey core. */
export function toroid(cx: number, cy: number, r = 9): Shape[] {
  const out: Shape[] = [circle(cx, cy, r, '#c9b458', { grad: '#8a7a2e', gradDir: 'd', shadow: 1 }), circle(cx, cy, r * 0.42, '#f0eee6', { stroke: '#8a7a2e', strokeWidth: 0.4 })];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    out.push(line(cx + c * r * 0.42, cy + s * r * 0.42, cx + c * r, cy + s * r, '#b8702e', 1.1));
  }
  return out;
}

/** Extruded aluminium heatsink with fins running vertically. */
export function heatsink(x: number, y: number, w: number, h: number, fins = 8, color = '#c5cbd2'): Shape[] {
  const out: Shape[] = [rect(x, y, w, h, shade(color, -0.2), { rx: 1, shadow: 1 })];
  const fw = w / fins;
  for (let i = 0; i < fins; i++) out.push(rect(x + i * fw + fw * 0.12, y + 0.6, fw * 0.76, h - 1.2, shade(color, 0.25), { grad: shade(color, -0.25), gradDir: 'h', rx: 0.4 }));
  return out;
}

/** Sugar-cube relay (Songle SRD): blue box with the rating print. */
export function relayCube(x: number, y: number, w: number, h: number, color = '#2463c9', lines: string[] = ['SONGLE', 'SRD-05VDC-SL-C', '10A 250VAC']): Shape[] {
  const out: Shape[] = [rect(x, y, w, h, shade(color, 0.12), { rx: 1.5, grad: shade(color, -0.25), shadow: 1, stroke: shade(color, -0.45), strokeWidth: 0.5 })];
  const size = Math.min(3.2, (w - 4) / (0.62 * Math.max(...lines.map((l) => l.length))));
  lines.forEach((l, i) => out.push(text(x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * size * 1.35 + size * 0.35, l, i === 0 ? size * 1.15 : size, '#e8edf6', 'middle', { weight: i === 0 ? 800 : 500 })));
  return out;
}

/** Micro-USB / USB-C receptacle seen from above, opening towards -x ('l') or -y ('t'). */
export function usbPort(x: number, y: number, kind: 'micro' | 'c' | 'mini' | 'a' = 'micro', side: 'l' | 't' | 'r' = 'l'): Shape[] {
  const [len, wid] = kind === 'a' ? [14, 13] : kind === 'c' ? [7.5, 9] : [6, 8];
  const w = side === 't' ? wid : len, h = side === 't' ? len : wid;
  return [
    rect(x - w / 2, y - h / 2, w, h, '#e7eaee', { rx: kind === 'c' ? 1.8 : 0.8, grad: '#8a929b', gradDir: side === 't' ? 'h' : 'v', stroke: '#6d757e', strokeWidth: 0.4, shadow: 0.8 }),
    rect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2, 'none', { rx: 0.5, stroke: 'rgba(255,255,255,.5)', strokeWidth: 0.4 }),
  ];
}

/** 6 × 6 tactile switch: metal frame, black plunger. */
export const tactSwitch = (cx: number, cy: number, s = 8): Shape[] => [
  rect(cx - s / 2, cy - s / 2, s, s, '#dfe3e7', { rx: 0.6, grad: '#8e969f', gradDir: 'd', shadow: 0.9 }),
  circle(cx, cy, s * 0.3, '#2c2e32', { grad: '#0f1012', gradDir: 'r' }),
];

/** Horizontal + vertical chords of a circle: mesh caps, Fresnel lenses, speaker grilles. */
export function gridInCircle(cx: number, cy: number, r: number, step: number, stroke: string, w = 0.4): Shape[] {
  const out: Shape[] = [];
  for (let d = -r + step / 2; d < r; d += step) {
    const h = Math.sqrt(Math.max(0, r * r - d * d));
    out.push(line(cx - h, cy + d, cx + h, cy + d, stroke, w), line(cx + d, cy - h, cx + d, cy + h, stroke, w));
  }
  return out;
}

/** Photoresistor (LDR) face: ceramic disc with the zig-zag CdS track. */
export function ldrFace(cx: number, cy: number, r = 5): Shape[] {
  const k = r / 5;
  let d = `M ${cx - 3.2 * k} ${cy - 3 * k}`;
  for (let i = 0; i < 5; i++) d += ` L ${cx + (i % 2 ? -3.2 : 3.2) * k} ${cy + (-3 + i * 1.5) * k} L ${cx + (i % 2 ? -3.2 : 3.2) * k} ${cy + (-1.5 + i * 1.5) * k}`;
  return [
    circle(cx, cy, r, '#f3e6c2', { grad: '#c9ad6a', gradDir: 'r', stroke: '#a78a48', strokeWidth: 0.4, shadow: 0.8 }),
    path(d, 'none', { stroke: '#b3452d', strokeWidth: 0.7 * k }),
    circle(cx - r * 0.35, cy - r * 0.35, r * 0.3, '#ffffff', { opacity: 0.35 }),
  ];
}

/** Metal can with a wire-mesh cap (MQ gas sensors). */
export const meshCan = (cx: number, cy: number, r: number): Shape[] => [
  circle(cx, cy, r + 1.8, '#2d4f96', { grad: '#1a2f5c', gradDir: 'd', shadow: 1 }),
  circle(cx, cy, r, '#e4e8ec', { grad: '#8a939c', gradDir: 'r', stroke: '#6b737c', strokeWidth: 0.5 }),
  ...gridInCircle(cx, cy, r * 0.82, r / 5, '#7b848d', 0.35),
  circle(cx, cy, r * 0.82, 'none', { stroke: '#9aa3ab', strokeWidth: 0.6 }),
];

/** Electret microphone capsule seen from above: aluminium rim, black felt. */
export const micCapsule = (cx: number, cy: number, r = 6): Shape[] => [
  circle(cx, cy, r, '#e3e7eb', { grad: '#858e97', gradDir: 'd', shadow: 1 }),
  circle(cx, cy, r * 0.78, '#2b2c2f', { grad: '#111214', gradDir: 'r' }),
  circle(cx, cy, r * 0.25, '#3a3b3f'),
];

/** PIR Fresnel dome seen from above: faceted white plastic. */
export const fresnelDome = (cx: number, cy: number, r: number): Shape[] => [
  circle(cx, cy, r, '#fbfaf6', { grad: '#d9d6cc', gradDir: 'r', stroke: '#c4c0b4', strokeWidth: 0.6, shadow: 1 }),
  ...gridInCircle(cx, cy, r * 0.94, r / 3.2, '#d2cec2', 0.45),
  circle(cx - r * 0.3, cy - r * 0.35, r * 0.28, '#ffffff', { opacity: 0.7 }),
];

/** 5 mm through-hole LED lying flat with its dome pointing up (IR pairs, line sensors). */
export const ledSide = (cx: number, top: number, color: string, len = 11): Shape[] => [
  rect(cx - 3, top, 6, len, shade(color, 0.25), { rx: 3, grad: shade(color, -0.3), gradDir: 'h', shadow: 0.8, opacity: 0.95 }),
  rect(cx - 3.6, top + len - 2, 7.2, 2, shade(color, 0.1), { rx: 0.6 }),
  rect(cx - 1.8, top + 1.5, 1.2, len - 5, '#ffffff', { opacity: 0.35, rx: 0.6 }),
];

/** Round lens LED seen from above (5 mm / 3 mm), unlit. */
export const ledTop = (cx: number, cy: number, r: number, color: string): Shape[] => [
  circle(cx, cy, r, shade(color, 0.3), { grad: shade(color, -0.25), gradDir: 'r', shadow: 0.8, opacity: 0.95 }),
  circle(cx - r * 0.3, cy - r * 0.3, r * 0.25, '#ffffff', { opacity: 0.55 }),
];

/** Logic level of a pin relative to a supply ("1" when above half the supply). */
export const H = (pin: string, vcc = 'VCC', gnd = 'GND') => `(v(${pin}, ${gnd}) > v(${vcc}, ${gnd}) / 2)`;

/** Totem-pole digital output driven by a condition. */
export const dout = (id: string, pin: string, cond: string, vcc = 'VCC', gnd = 'GND', r = 40): Raw => ({
  id, kind: 'vsource', p: pin, n: gnd, value: `(${cond}) ? v(${vcc}, ${gnd}) : 0`, r,
});

/** High-impedance input loads (1 MΩ to ground) so inputs never float in the solver. */
export const hiz = (pins: string[], gnd = 'GND', prefix = 'RIN'): Raw[] => pins.map((p, i) => ({ id: `${prefix}${i}`, kind: 'resistor', a: p, b: gnd, value: 1e6 }));

/** Quiescent supply current. */
export const quiescent = (vcc = 'VCC', gnd = 'GND', ohms = 5000): Raw => ({ id: 'IQ', kind: 'resistor', a: vcc, b: gnd, value: ohms });

/** Switch contact controlled by a formula (closed when non-zero). */
export const contact = (id: string, a: string, b: string, closed: string, ron = 0.05): Raw => ({ id, kind: 'rvar', a, b, value: `(${closed}) ? ${ron} : 1e9` });

/** Simple brushed-motor model: armature R + back-EMF, speed state `w` (rad/s). */
export function motorModel(p: string, n: string, o: { r: number; k: number; j: number; i0: number; gear?: number }): { elements: Raw[]; nodes: string[]; states: Raw[] } {
  const tf = o.k * o.i0;
  return {
    nodes: ['MM'],
    elements: [
      { id: 'RA', kind: 'resistor', a: p, b: 'MM', value: o.r },
      { id: 'EMF', kind: 'vsource', p: 'MM', n, value: `${o.k} * w`, r: 0.001 },
    ],
    states: [
      // stiction: the rotor only starts when motor torque beats friction; friction never reverses it
      { name: 'tm', init: 0, next: `${o.k} * i(RA)` },
      { name: 'w', init: 0, next: `(w == 0 && abs(tm) <= ${tf}) ? 0 : ((w != 0 && sign(w + (tm - sign(w == 0 ? tm : w) * ${tf} - 1e-7 * w) / ${o.j} * dt) != sign(w)) ? 0 : w + (tm - sign(w == 0 ? tm : w) * ${tf} - 1e-7 * w) / ${o.j} * dt)` },
      { name: 'angle', init: 0, next: `mod(angle + w * dt * 57.2958 / ${o.gear ?? 1} / 30, 360)` },
    ],
  };
}

export const rpm = (gear = 1) => `w * 60 / 6.28318 / ${gear}`;

/** Tri-state push-pull output: drives `cond` when `en` is true, otherwise high impedance. */
export const tri = (id: string, pin: string, cond: string, en = '1', vcc = 'VCC', gnd = 'GND', r = 40): Raw[] => [
  { id: `${id}H`, kind: 'rvar', a: vcc, b: pin, value: `((${en}) && (${cond})) ? ${r} : 1e9` },
  { id: `${id}L`, kind: 'rvar', a: pin, b: gnd, value: `((${en}) && !(${cond})) ? ${r} : 1e9` },
];

/** Half-bridge (motor driver output): high side on / low side on / both off. */
export const halfBridge = (id: string, out: string, vpos: string, gnd: string, hi: string, lo: string, ron = 0.5): Raw[] => [
  { id: `${id}H`, kind: 'rvar', a: vpos, b: out, value: `(${hi}) ? ${ron} : 1e9` },
  { id: `${id}L`, kind: 'rvar', a: out, b: gnd, value: `(${lo}) ? ${ron} : 1e9` },
  // body diodes: the motor's inductive kick returns to the rails
  { id: `${id}DH`, kind: 'diode', a: out, k: vpos, model: 'power' },
  { id: `${id}DL`, kind: 'diode', a: gnd, k: out, model: 'power' },
];

/** Rising edges on a pin since the state `prev` was last updated (use with a state `prev` = edges(PIN)). */
export const newEdges = (pin: string, prev: string) => `max(0, edges(${pin}) - ${prev})`;
