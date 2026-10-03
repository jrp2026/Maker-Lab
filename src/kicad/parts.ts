/**
 * Files use the KiCad 7 format, which KiCad 7, 8 and 9 all open.
 *
 * KiCad symbol and footprint for any MakerLab part (built-in or AI-made).
 *
 * - Symbol: the part's own schematic drawing, converted to KiCad graphics; one pin per MakerLab
 *   pin at the same place (pins are zero-length: the drawing already has the leads).
 * - Footprint: through-hole pads at the part's real pin positions (MakerLab's grid is 0.1 inch,
 *   so a DIP, a header or a module's pins land at their true pitch), body outline from its size.
 * Pin numbers and pad numbers match (DIP chips keep their datasheet numbering).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentDef, PinDef } from '../components/types';
import { boundsOf } from '../components/types';
import type { Props } from '../model/types';
import { pivotOf } from '../model/geometry';
import { svgToPrims, type Prim } from './svg';

/** MakerLab units (1/100 inch) → millimetres */
export const MM = 0.254;
export const LIB = 'makerlab';

export const r4 = (v: number) => {
  const s = (Math.round(v * 10000) / 10000).toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
export const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

let uid = 0;
/** uuids for one export (KiCad only needs them unique within a file) */
export function uuid(): string {
  uid++;
  const h = (n: number, w: number) => n.toString(16).padStart(w, '0').slice(-w);
  const rnd = Math.floor(Math.random() * 0xffffffff);
  return `${h(rnd, 8)}-${h(uid >>> 16, 4)}-4${h(uid, 3)}-8${h(rnd >>> 20, 3)}-${h(Date.now(), 12)}`;
}

/** KiCad reference designator letter(s) for a part */
export function refPrefix(def: ComponentDef): string {
  const t = def.type;
  if (/capacitor|electrolytic|supercap/.test(t)) return 'C';
  if (/inductor|ferrite/.test(t)) return 'L';
  if (/crystal|resonator/.test(t)) return 'Y';
  if (/transformer/.test(t)) return 'T';
  if (/battery|lipo|coin-cell|lifepo4|18650/.test(t)) return 'BT';
  if (/motor|servo|stepper|fan|pump/.test(t)) return 'M';
  if (/speaker|buzzer|piezo/.test(t)) return 'LS';
  if (/fuse/.test(t)) return 'F';
  if (/relay|ssr/.test(t)) return 'K';
  if (/header|terminal|jack|usb|connector/.test(t)) return 'J';
  switch (def.category) {
    case 'passive': return 'R';
    case 'diodes': return 'D';
    case 'transistors': return 'Q';
    case 'switches': return 'SW';
    case 'instruments': return 'TP';
    default: return 'U';
  }
}

/** parts that make no sense on a board: breadboards and lab instruments */
export const isBoardPart = (def: ComponentDef) => def.layer !== 0 && def.category !== 'instruments';

/** Pin numbers: DIP chips keep their datasheet numbers ("8: VCC"), others count 1, 2, 3 … */
export function pinNumbers(pins: PinDef[]): string[] {
  const dip = pins.map((p) => /^(\d+)\s*:/.exec(p.label ?? '')?.[1]);
  if (dip.every(Boolean) && new Set(dip).size === dip.length) return dip as string[];
  return pins.map((_, i) => String(i + 1));
}

const safeName = (s: string) => s.replace(/[^A-Za-z0-9_.+-]+/g, '_');

/** The part's schematic drawing as plain geometry (local MakerLab coordinates). */
export function drawingOf(def: ComponentDef, props: Props): Prim[] {
  const comp = { id: 'k', type: def.type, x: 0, y: 0, rot: 0 as const, flip: false, props };
  const markup = renderToStaticMarkup(createElement('svg', null, def.schematic({ comp, props })));
  return svgToPrims(markup);
}

export interface SymbolPin {
  id: string;
  number: string;
  /** lib coordinates (mm, y up), relative to the part's pivot */
  x: number;
  y: number;
  /** outward direction in lib coordinates */
  dx: number;
  dy: number;
}

export interface BuiltSymbol {
  /** the (symbol "…" …) block */
  text: string;
  pins: SymbolPin[];
  /** graphic extent in lib coordinates */
  box: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * KiCad symbol for a part. `name` is the full symbol name: "makerlab:resistor" inside a
 * schematic, "resistor" inside a .kicad_sym library. `flip` bakes a horizontal mirror in (MakerLab
 * flips parts before rotating them).
 */
export function buildSymbol(def: ComponentDef, props: Props, name: string, opts: { flip?: boolean; footprint?: string; value?: string } = {}): BuiltSymbol {
  const pv = pivotOf(def, props);
  const sx = opts.flip ? -1 : 1;
  const L = (x: number, y: number) => ({ x: (x - pv.x) * sx * MM, y: -(y - pv.y) * MM });
  const prims = drawingOf(def, props);
  const defPins = def.pins(props);
  const numbers = pinNumbers(defPins);

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (p: { x: number; y: number }) => {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  };
  const g: string[] = [];
  const stroke = '(stroke (width 0) (type default))';
  for (const p of prims) {
    if (p.kind === 'poly') {
      const pts = p.pts.map((v) => L(v.x, v.y));
      if (p.closed) pts.push(pts[0]);
      pts.forEach(grow);
      g.push(`(polyline (pts ${pts.map((v) => `(xy ${r4(v.x)} ${r4(v.y)})`).join(' ')}) ${stroke} (fill (type ${p.fill})))`);
    } else if (p.kind === 'circle') {
      const c = L(p.cx, p.cy), r = p.r * MM;
      grow({ x: c.x - r, y: c.y - r });
      grow({ x: c.x + r, y: c.y + r });
      g.push(`(circle (center ${r4(c.x)} ${r4(c.y)}) (radius ${r4(r)}) ${stroke} (fill (type ${p.fill})))`);
    } else {
      const at = L(p.x, p.y);
      // the text's own extent (baseline anchor; roughly 0.6 × size per character)
      const tw = p.text.length * p.size * MM * 0.6, th = p.size * MM;
      const left = p.anchor === 'start' ? 0 : p.anchor === 'end' ? -tw : -tw / 2;
      if (Math.abs(p.angle % 180) < 45) {
        grow({ x: at.x + left * sx, y: at.y });
        grow({ x: at.x + (left + tw) * sx, y: at.y + th });
      } else grow(at);
      // KiCad text is horizontal or vertical; MakerLab angles are clockwise, KiCad's counter-clockwise
      let ang = Math.round(((((-p.angle * sx) % 360) + 360) % 360) / 90) * 90 % 360;
      let anchor = sx < 0 ? ({ start: 'end', end: 'start', middle: 'middle' } as const)[p.anchor] : p.anchor;
      if (ang === 180 || ang === 270) {
        ang -= 180;
        anchor = ({ start: 'end', end: 'start', middle: 'middle' } as const)[anchor];
      }
      const just = anchor === 'start' ? 'left' : anchor === 'end' ? 'right' : '';
      const size = Math.max(0.5, p.size * MM);
      g.push(`(text ${q(p.text)} (at ${r4(at.x)} ${r4(at.y)} ${ang}) (effects (font (size ${r4(size)} ${r4(size)}))${just ? ` (justify ${just} bottom)` : ' (justify bottom)'}))`);
    }
  }
  const pinPts = defPins.map((p) => L(p.x, p.y));
  pinPts.forEach(grow);
  if (!Number.isFinite(x0)) x0 = y0 = x1 = y1 = 0;

  // each pin points away from the drawing: towards the nearest edge of its outline
  const pins: SymbolPin[] = defPins.map((p, i) => {
    const at = pinPts[i];
    const d = [
      { dx: -1, dy: 0, d: at.x - x0 },
      { dx: 1, dy: 0, d: x1 - at.x },
      { dx: 0, dy: 1, d: y1 - at.y },
      { dx: 0, dy: -1, d: at.y - y0 },
    ].reduce((a, c) => (c.d < a.d - 1e-6 ? c : a));
    return { id: p.id, number: numbers[i], x: at.x, y: at.y, dx: d.dx, dy: d.dy };
  });
  // KiCad pin angle: the direction from its connection point into the part
  const pinAngle = (p: SymbolPin) => (p.dx < 0 ? 0 : p.dx > 0 ? 180 : p.dy > 0 ? 270 : 90);
  const font = '(effects (font (size 1.27 1.27)))';
  const pinText = pins.map((p) => `(pin passive line (at ${r4(p.x)} ${r4(p.y)} ${pinAngle(p)}) (length 0) (name ${q(p.id)} ${font}) (number ${q(p.number)} ${font}))`);

  const base = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
  const value = opts.value ?? def.name;
  const prop = (k: string, v: string, x: number, y: number, hide = false) => `(property ${q(k)} ${q(v)} (at ${r4(x)} ${r4(y)} 0) (effects (font (size 1.27 1.27))${hide ? ' hide' : ''}))`;
  const text = [
    `(symbol ${q(name)} (pin_numbers hide) (pin_names (offset 0) hide) (in_bom yes) (on_board yes)`,
    `  ${prop('Reference', refPrefix(def), x0, y1 + 1.27)}`,
    `  ${prop('Value', value, x0, y0 - 1.27, true)}`,
    `  ${prop('Footprint', opts.footprint ?? `${LIB}:${footprintName(def, props)}`, x0, y0 - 3.81, true)}`,
    `  ${prop('Datasheet', '', x0, y0 - 6.35, true)}`,
    `  ${prop('ki_description', (def.description ?? '').slice(0, 240), x0, y0 - 8.89, true)}`,
    `  (symbol ${q(`${base}_0_1`)}`,
    ...g.map((l) => `    ${l}`),
    '  )',
    `  (symbol ${q(`${base}_1_1`)}`,
    ...pinText.map((l) => `    ${l}`),
    '  )',
    ')',
  ].join('\n');
  return { text, pins, box: { x0, y0, x1, y1 } };
}

/** A one-symbol .kicad_sym library file. */
export function symbolLibrary(symbols: string[]): string {
  return ['(kicad_symbol_lib (version 20220914) (generator makerlab)', ...symbols.map((s) => s.replace(/^/gm, '  ')), ')', ''].join('\n');
}

// ------------------------------------------------------------------ footprints

/** Footprint name: the part type, plus its pin count when that depends on settings. */
export function footprintName(def: ComponentDef, props: Props): string {
  const n = def.pins(props).length;
  const dflt = def.pins(def.defaultProps).length;
  return safeName(n === dflt ? def.type : `${def.type}_${n}pin`);
}

/** KiCad footprint (.kicad_mod) with pads at the part's pin positions; pad 1 at the origin. */
export function buildFootprint(def: ComponentDef, props: Props): string {
  const pins = def.pins(props);
  const numbers = pinNumbers(pins);
  const first = pins.find((_, i) => numbers[i] === '1') ?? pins[0] ?? { x: 0, y: 0 };
  const P = (x: number, y: number) => ({ x: (x - first.x) * MM, y: (y - first.y) * MM });
  const pads = pins.map((p, i) => {
    const at = P(p.x, p.y);
    const big = p.kind === 'terminal';
    const size = big ? 2.6 : 1.7, drill = big ? 1.3 : 1.0;
    const shape = numbers[i] === '1' ? 'rect' : 'circle';
    return { at, size, text: `(pad ${q(numbers[i])} thru_hole ${shape} (at ${r4(at.x)} ${r4(at.y)}) (size ${size} ${size}) (drill ${drill}) (layers "*.Cu" "*.Mask") (tstamp ${q(uuid())}))` };
  });
  const b = boundsOf(def, props);
  const a = P(b.x, b.y), z = P(b.x + b.w, b.y + b.h);
  let cx0 = Math.min(a.x, z.x), cy0 = Math.min(a.y, z.y), cx1 = Math.max(a.x, z.x), cy1 = Math.max(a.y, z.y);
  for (const p of pads) {
    cx0 = Math.min(cx0, p.at.x - p.size / 2); cx1 = Math.max(cx1, p.at.x + p.size / 2);
    cy0 = Math.min(cy0, p.at.y - p.size / 2); cy1 = Math.max(cy1, p.at.y + p.size / 2);
  }
  const rect = (x0: number, y0: number, x1: number, y1: number, layer: string, w: number) =>
    `(fp_rect (start ${r4(x0)} ${r4(y0)}) (end ${r4(x1)} ${r4(y1)}) (stroke (width ${w}) (type solid)) (fill none) (layer ${q(layer)}) (tstamp ${q(uuid())}))`;
  const name = footprintName(def, props);
  const font = '(effects (font (size 1 1) (thickness 0.15)))';
  return [
    `(footprint ${q(name)} (version 20221018) (generator makerlab) (layer "F.Cu")`,
    `  (descr ${q(`${def.name} — MakerLab footprint: pads at the part's pin positions (0.1 inch grid). Check against the datasheet before ordering boards.`)})`,
    `  (tags ${q(`makerlab ${def.type}`)})`,
    '  (attr through_hole)',
    `  (fp_text reference "REF**" (at ${r4(cx0)} ${r4(cy0 - 1.5)}) (layer "F.SilkS") ${font} (tstamp ${q(uuid())}))`,
    `  (fp_text value ${q(def.name)} (at ${r4(cx0)} ${r4(cy1 + 1.5)}) (layer "F.Fab") ${font} (tstamp ${q(uuid())}))`,
    `  ${rect(Math.min(a.x, z.x), Math.min(a.y, z.y), Math.max(a.x, z.x), Math.max(a.y, z.y), 'F.Fab', 0.1)}`,
    `  ${rect(Math.min(a.x, z.x), Math.min(a.y, z.y), Math.max(a.x, z.x), Math.max(a.y, z.y), 'F.SilkS', 0.12)}`,
    `  ${rect(cx0 - 0.25, cy0 - 0.25, cx1 + 0.25, cy1 + 0.25, 'F.CrtYd', 0.05)}`,
    ...pads.map((p) => `  ${p.text}`),
    ')',
    '',
  ].join('\n');
}
