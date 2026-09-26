/**
 * Helpers for authoring built-in parts as declarative specs (the same format the
 * AI generator uses). Coordinates: 10 units = 0.1" breadboard pitch.
 */
export type Raw = Record<string, any>;
type Shape = Raw;
type Pin = { id: string; x: number; y: number; label: string; kind: 'lead' | 'terminal' };

export const COL = {
  ic: '#26282c',
  icText: '#e6e6e6',
  metal: '#b8bec6',
  metalDark: '#7d858e',
  lead: '#9aa3ad',
  pcbBlue: '#1f5fbf',
  pcbGreen: '#1f7a45',
  pcbRed: '#b8322a',
  pcbBlack: '#23252a',
  pcbPurple: '#5b3a9a',
  header: '#1d1e21',
  white: '#f4f2ec',
  copper: '#c98a3c',
};

export const text = (x: number, y: number, t: string, size = 5, fill = '#222', anchor = 'middle'): Shape => ({ type: 'text', x, y, text: t, size, fill, anchor });
export const rect = (x: number, y: number, w: number, h: number, fill: string, extra: Raw = {}): Shape => ({ type: 'rect', x, y, w, h, fill, ...extra });
export const circle = (cx: number, cy: number, r: number, fill: string, extra: Raw = {}): Shape => ({ type: 'circle', cx, cy, r, fill, ...extra });
export const line = (x1: number, y1: number, x2: number, y2: number, stroke = COL.lead, strokeWidth = 1.8): Shape => ({ type: 'line', x1, y1, x2, y2, stroke, strokeWidth });

/** Pins in a row at y (default 0), 10 apart. */
export function pinRow(ids: string[], opts: { x0?: number; y?: number; kind?: 'lead' | 'terminal'; labels?: Record<string, string>; step?: number } = {}): Pin[] {
  const { x0 = 0, y = 0, kind = 'lead', labels = {}, step = 10 } = opts;
  return ids.map((id, i) => ({ id, x: x0 + i * step, y, label: labels[id] ?? id, kind }));
}

/** Metal legs from each pin up (or down) to y. */
export const legs = (pins: Pin[], toY: number, color = COL.lead): Shape[] => pins.map((p) => line(p.x, toY, p.x, p.y, color, 1.8));

/** Black header strip behind a row of pins with their names printed above/below. */
export function header(pins: Pin[], opts: { labelY?: number; labelColor?: string; labelSize?: number } = {}): Shape[] {
  if (!pins.length) return [];
  const xs = pins.map((p) => p.x), y = pins[0].y;
  const out: Shape[] = [rect(Math.min(...xs) - 5, y - 5, Math.max(...xs) - Math.min(...xs) + 10, 9, COL.header, { rx: 1 })];
  if (opts.labelY !== undefined) for (const p of pins) out.push(text(p.x, opts.labelY, p.id.slice(0, 5), opts.labelSize ?? 3.6, opts.labelColor ?? '#eef2ee'));
  return out;
}

/** Generic schematic box with a lead per pin. */
export function boxSymbol(pins: Pin[], title: string): Shape[] {
  const xs = pins.map((p) => p.x), ys = pins.map((p) => p.y);
  const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6;
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const twoRows = top !== bottom;
  const by = twoRows ? top + 8 : top - 30, bh = twoRows ? bottom - top - 16 : 20;
  const out: Shape[] = [rect(x0, by, x1 - x0, bh, 'none', { strokeWidth: 1.3 }), text((x0 + x1) / 2, by + bh / 2 + 2, title, 5)];
  for (const p of pins) {
    const edge = p.y <= by ? by : by + bh;
    out.push(line(p.x, p.y, p.x, edge, '#1f3a5f', 1.2));
  }
  return out;
}

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
  const shapes: Shape[] = [
    ...pins.map((p) => line(p.x, p.y === 0 ? 5 : rowGap - 5, p.x, p.y, COL.metal, 2.4)),
    rect(-6, 4, w, rowGap - 8, opts.color ?? COL.ic, { rx: 1.5 }),
    { type: 'path', d: `M -6 ${rowGap / 2 - 4} A 4 4 0 0 1 -6 ${rowGap / 2 + 4}`, fill: '#3b3d42' },
    circle(-2, rowGap - 8, 1.4, '#3b3d42'),
    text(-6 + w / 2, rowGap / 2 + (opts.sub ? -1 : 2), opts.label, Math.min(6, 60 / opts.label.length + 2), COL.icText),
  ];
  if (opts.sub) shapes.push(text(-6 + w / 2, rowGap / 2 + 6, opts.sub, 3.6, '#9aa0a8'));
  return { pins, shapes, symbol: boxSymbol(pins, opts.label) };
}

/** Module PCB with a single row of header pins along the bottom edge (y = 0). */
export function moduleBoard(ids: string[], opts: { w?: number; h: number; color?: string; title?: string; titleColor?: string; labels?: Record<string, string>; kind?: 'lead' | 'terminal'; x0?: number }) {
  const pins = pinRow(ids, { x0: opts.x0 ?? 0, kind: opts.kind ?? 'lead', labels: opts.labels });
  const xs = pins.map((p) => p.x);
  const w = Math.max(opts.w ?? 0, Math.max(...xs) - Math.min(...xs) + 20);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2;
  const shapes: Shape[] = [
    rect(x, -opts.h - 4, w, opts.h, opts.color ?? COL.pcbBlue, { rx: 3, stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.8 }),
    circle(x + 5, -opts.h + 1, 2.2, COL.white),
    circle(x + w - 5, -opts.h + 1, 2.2, COL.white),
    ...header(pins, { labelY: -9, labelColor: '#eef2ee' }),
  ];
  if (opts.title) shapes.push(text(x + w / 2, -opts.h + 10, opts.title, 5.5, opts.titleColor ?? '#ffffff'));
  return { pins, shapes, box: { x, y: -opts.h - 4, w, h: opts.h } };
}

/** TO-92 package (small transistor / sensor), pins at 0, 10, 20. */
export function to92(ids: string[], label: string, color = COL.ic, labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { labels });
  return {
    pins,
    shapes: [
      ...legs(pins, -8),
      { type: 'path', d: 'M-4 -9 L24 -9 L24 -18 A14 11 0 0 0 -4 -18 Z', fill: color, stroke: '#111', strokeWidth: 0.6 },
      text(10, -15, label, Math.min(4.2, 40 / label.length), color === COL.ic ? '#cfd3d8' : '#222'),
    ],
  };
}

/** TO-220 package (regulators, power transistors), pins at 0, 10, 20. */
export function to220(ids: string[], label: string, labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { labels });
  return {
    pins,
    shapes: [
      rect(-6, -46, 32, 16, COL.metal, { rx: 1.5, stroke: COL.metalDark, strokeWidth: 0.8 }),
      circle(10, -38, 4, COL.white, { stroke: COL.metalDark, strokeWidth: 0.6 }),
      rect(-6, -31, 32, 23, COL.ic, { rx: 1.5, stroke: '#111', strokeWidth: 0.6 }),
      text(10, -18, label, Math.min(5.5, 44 / label.length), COL.icText),
      ...legs(pins, -8),
    ],
  };
}

/** Two-lead axial part between x = 0 and 40. */
export function axial(ids: [string, string], body: Shape[], labels: Record<string, string> = {}) {
  const pins = pinRow(ids, { step: 40, labels });
  return { pins, shapes: [line(0, 0, 40, 0), ...body] };
}

/** Screw terminal block drawn at pin positions (for "terminal" pins on modules). */
export function screwTerminals(pins: Pin[], color = '#2f7fd6'): Shape[] {
  if (!pins.length) return [];
  const xs = pins.map((p) => p.x), y = pins[0].y;
  const out: Shape[] = [rect(Math.min(...xs) - 5, y - 8, Math.max(...xs) - Math.min(...xs) + 10, 12, color, { rx: 1.5, stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.6 })];
  for (const p of pins) out.push(circle(p.x, y - 2, 3, '#c9ced4', { stroke: '#7d858e', strokeWidth: 0.5 }), line(p.x - 2, y - 2, p.x + 2, y - 2, '#5f6770', 0.8));
  return out;
}

/** An on-board SMD status LED that glows with `level`. */
export function statusLed(x: number, y: number, color: string, level: string): { shape: Shape; indicator: Raw } {
  return {
    shape: rect(x - 2.5, y - 1.5, 5, 3, '#e9e4d0', { rx: 0.6 }),
    indicator: { shape: rect(x - 2.5, y - 1.5, 5, 3, color, { rx: 0.6 }), color, level },
  };
}

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
