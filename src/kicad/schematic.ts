/**
 * Export a circuit as a KiCad project (KiCad 7 format: opens in KiCad 7, 8 and 9): schematic (.kicad_sch) with the symbols embedded, a
 * symbol library (.kicad_sym), a footprint library (makerlab.pretty) and the library tables.
 *
 * Parts keep their schematic positions and rotations. Every connected pin gets a short wire stub
 * ending in a net label: connections are made by net name, so the netlist is exactly MakerLab's
 * (no accidental crossings). Breadboards and lab instruments are left out.
 */
import type { CircuitDoc, ComponentInstance } from '../model/types';
import type { ComponentDef } from '../components/types';
import { getDef } from '../components/registry';
import { buildNetlist } from '../sim/netlist';
import { pivotOf } from '../model/geometry';
import { buildFootprint, buildSymbol, footprintName, isBoardPart, LIB, MM, q, r4, refPrefix, symbolLibrary, uuid, type BuiltSymbol } from './parts';

const GND_PIN = /^(GND\d*|VSS\d*|AGND|DGND|PGND|0V|-)$/i;
const SUPPLY_PIN = /^(\+?5V|3V3|3\.3V|\+?12V|VCC|VDD\d*|VIN|VBUS|5V0)$/i;

interface Placed {
  comp: ComponentInstance;
  def: ComponentDef;
  ref: string;
  libName: string;
  sym: BuiltSymbol;
  /** pivot in MakerLab world units */
  ax: number;
  ay: number;
  /** KiCad angle (counter-clockwise degrees) */
  angle: number;
}

/** KiCad's placement: rotate lib coordinates (y up) counter-clockwise, then y down on the sheet. */
export function sheetPoint(ax: number, ay: number, angle: number, lx: number, ly: number) {
  const t = (angle * Math.PI) / 180, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  const rx = lx * c - ly * s, ry = lx * s + ly * c;
  return { x: ax * MM + rx, y: ay * MM - ry };
}

export interface KicadExport {
  files: Record<string, string>;
  /** parts exported / left out (breadboards, instruments) */
  parts: number;
  skipped: string[];
  nets: number;
  /** the connections as exported: net name → "R1.2"-style pins (for checks) */
  netPins: Record<string, string[]>;
}

/** parts are spread out on the sheet (symbols keep their size) so labels have room */
const SPREAD = 2;

const safe = (s: string) => s.replace(/[^A-Za-z0-9_.+-]+/g, '_') || 'circuit';

export function exportKicad(doc: CircuitDoc): KicadExport {
  const project = safe(doc.name);
  const netlist = buildNetlist(doc);
  const skipped: string[] = [];
  const placed: Placed[] = [];
  const counters = new Map<string, number>();
  const variants = new Map<string, { name: string; sym: BuiltSymbol }>();
  const perType = new Map<string, number>();
  const footprints = new Map<string, string>();

  for (const comp of doc.components) {
    const def = getDef(comp.type);
    if (!def) continue;
    if (!isBoardPart(def)) {
      if (def.layer !== 0) skipped.push(def.name);
      continue;
    }
    const pre = refPrefix(def);
    const n = (counters.get(pre) ?? 0) + 1;
    counters.set(pre, n);
    const key = `${comp.type}|${comp.flip ? 1 : 0}|${JSON.stringify(comp.props, (k, v) => (k === 'code' || k === 'blocks' || k === 'codeMode' ? undefined : v))}`;
    let v = variants.get(key);
    if (!v) {
      const count = (perType.get(comp.type) ?? 0) + 1;
      perType.set(comp.type, count);
      const name = safe(count === 1 ? comp.type : `${comp.type}_${count}`);
      v = { name, sym: buildSymbol(def, comp.props, `${LIB}:${name}`, { flip: comp.flip, value: def.name }) };
      variants.set(key, v);
    }
    const fp = footprintName(def, comp.props);
    if (!footprints.has(fp)) footprints.set(fp, buildFootprint(def, comp.props));
    const pv = pivotOf(def, comp.props);
    placed.push({ comp, def, ref: `${pre}${n}`, libName: v.name, sym: v.sym, ax: (comp.x + pv.x) * SPREAD, ay: (comp.y + pv.y) * SPREAD, angle: (360 - 90 * comp.rot) % 360 });
  }

  // ---- pins on the sheet, nets
  interface SheetPin { p: Placed; id: string; number: string; x: number; y: number; dx: number; dy: number }
  const pinOf = new Map<string, SheetPin>();
  for (const p of placed) {
    for (const sp of p.sym.pins) {
      const at = sheetPoint(p.ax, p.ay, p.angle, sp.x, sp.y);
      const d0 = sheetPoint(0, 0, p.angle, sp.dx, sp.dy);
      pinOf.set(`${p.comp.id}:${sp.id}`, { p, id: sp.id, number: sp.number, x: at.x, y: at.y, dx: Math.round(d0.x), dy: Math.round(d0.y) });
    }
  }
  const nets: { name: string; pins: SheetPin[] }[] = [];
  const used = new Set<string>();
  const unique = (base: string) => {
    let name = base, k = 2;
    while (used.has(name)) name = `${base}_${k++}`;
    used.add(name);
    return name;
  };
  const unconnected: SheetPin[] = [];
  for (const members of netlist.nets) {
    const pins = members.map((k) => pinOf.get(k)).filter((x): x is SheetPin => !!x);
    if (!pins.length) continue;
    if (new Set(pins.map((x) => x.p.comp.id)).size < 2) {
      unconnected.push(...pins);
      continue;
    }
    let base: string;
    const sup = pins.find((x) => SUPPLY_PIN.test(x.id));
    const mcu = pins.find((x) => x.p.def.mcu && !GND_PIN.test(x.id) && !SUPPLY_PIN.test(x.id));
    if (pins.some((x) => GND_PIN.test(x.id) && x.id !== '-')) base = 'GND';
    else if (sup) base = sup.id.toUpperCase().replace('3.3V', '3V3').replace(/^\+/, '');
    else if (mcu) base = /^\d/.test(mcu.id) ? `D${mcu.id}` : mcu.id;
    else base = `Net-(${pins[0].p.ref}-${pins[0].number})`;
    nets.push({ name: unique(base), pins });
  }
  // pins not in any net at all
  for (const [k, sp] of pinOf) if (netlist.netOf.get(k) === undefined) unconnected.push(sp);

  // ---- move everything onto the sheet with a margin (keeping the 2.54 mm pin grid)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const boxes = new Map<Placed, { x0: number; y0: number; x1: number; y1: number }>();
  for (const p of placed) {
    const b = p.sym.box;
    const cs = [sheetPoint(p.ax, p.ay, p.angle, b.x0, b.y0), sheetPoint(p.ax, p.ay, p.angle, b.x1, b.y1), sheetPoint(p.ax, p.ay, p.angle, b.x0, b.y1), sheetPoint(p.ax, p.ay, p.angle, b.x1, b.y0)];
    const bx = { x0: Math.min(...cs.map((c) => c.x)), y0: Math.min(...cs.map((c) => c.y)), x1: Math.max(...cs.map((c) => c.x)), y1: Math.max(...cs.map((c) => c.y)) };
    boxes.set(p, bx);
    x0 = Math.min(x0, bx.x0 - 12); y0 = Math.min(y0, bx.y0 - 8); x1 = Math.max(x1, bx.x1 + 12); y1 = Math.max(y1, bx.y1 + 8);
  }
  if (!placed.length) x0 = y0 = x1 = y1 = 0;
  const G = 2.54;
  const ox = Math.ceil((25.4 - x0) / G) * G, oy = Math.ceil((25.4 - y0) / G) * G;
  // margins, plus room under the drawing for KiCad's title block (bottom right, ~40 mm high)
  const w = x1 - x0 + 50.8, h = y1 - y0 + 25.4 + 45;
  const PAPERS: [string, number, number][] = [['A4', 297, 210], ['A3', 420, 297], ['A2', 594, 420], ['A1', 841, 594], ['A0', 1189, 841]];
  const paper = PAPERS.find(([, pw, ph]) => w <= pw && h <= ph);
  const paperText = paper ? `(paper ${q(paper[0])})` : `(paper "User" ${r4(Math.ceil(w))} ${r4(Math.ceil(h))})`;

  // ---- stubs + labels; a stub never ends on (or runs over) another pin or stub
  const key = (x: number, y: number) => `${Math.round((x + ox) * 100)},${Math.round((y + oy) * 100)}`;
  const taken = new Set<string>();
  for (const sp of pinOf.values()) taken.add(key(sp.x, sp.y));
  const body: string[] = [];
  const font = '(effects (font (size 1.27 1.27))';
  const wire = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    body.push(`(wire (pts (xy ${r4(a.x + ox)} ${r4(a.y + oy)}) (xy ${r4(b.x + ox)} ${r4(b.y + oy)})) (stroke (width 0) (type default)) (uuid ${q(uuid())}))`);
  /** grid points along a straight segment, excluding the start */
  const along = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 1.27);
    return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * (i + 1)) / n, y: a.y + ((b.y - a.y) * (i + 1)) / n }));
  };
  // two-pin nets: a real wire (straight, or with one bend) when its path touches nothing else
  const wired = new Set<(typeof nets)[number]>();
  for (const net of nets) {
    if (net.pins.length !== 2) continue;
    const [a, b] = net.pins;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 60) continue;
    const routes: { x: number; y: number }[][] = Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6 ? [[a, b]] : [[a, { x: b.x, y: a.y }, b], [a, { x: a.x, y: b.y }, b]];
    for (const r of routes) {
      const pts = r.slice(1).flatMap((p, i) => along(r[i], p));
      const inner = pts.slice(0, -1); // the end is pin b itself
      if (inner.some((p) => taken.has(key(p.x, p.y)))) continue;
      for (const p of inner) taken.add(key(p.x, p.y));
      r.slice(1).forEach((p, i) => wire(r[i], p));
      wired.add(net);
      break;
    }
  }
  for (const net of nets) {
    if (wired.has(net)) continue;
    for (const sp of net.pins) {
      let len = G;
      const free = (L: number) => {
        for (let s = 1.27; s <= L + 1e-6; s += 1.27) if (taken.has(key(sp.x + sp.dx * s, sp.y + sp.dy * s))) return false;
        return true;
      };
      while (!free(len) && len < 8 * G) len += G;
      const ex = sp.x + sp.dx * len, ey = sp.y + sp.dy * len;
      for (let s = 1.27; s <= len + 1e-6; s += 1.27) taken.add(key(sp.x + sp.dx * s, sp.y + sp.dy * s));
      wire(sp, { x: ex, y: ey });
      const ang = sp.dx > 0 ? 0 : sp.dx < 0 ? 180 : sp.dy < 0 ? 90 : 270;
      const just = ang === 0 || ang === 90 ? 'left' : 'right';
      body.push(`(label ${q(net.name)} (at ${r4(ex + ox)} ${r4(ey + oy)} ${ang}) (fields_autoplaced) ${font} (justify ${just} bottom)) (uuid ${q(uuid())}))`);
    }
  }
  for (const sp of unconnected) body.push(`(no_connect (at ${r4(sp.x + ox)} ${r4(sp.y + oy)}) (uuid ${q(uuid())}))`);

  // ---- symbol instances
  const root = uuid();
  const instances = placed.map((p) => {
    const b = boxes.get(p)!;
    const value = (p.def.summary?.(p.comp.props) || p.def.name).replace(/^✨\s*/, '');
    const prop = (k: string, v: string, x: number, y: number, hide = false) => `(property ${q(k)} ${q(v)} (at ${r4(x + ox)} ${r4(y + oy)} 0) ${font}${hide ? ' hide' : ''} (justify left)))`;
    return [
      `(symbol (lib_id ${q(`${LIB}:${p.libName}`)}) (at ${r4(p.ax * MM + ox)} ${r4(p.ay * MM + oy)} ${p.angle}) (unit 1) (in_bom yes) (on_board yes) (dnp no) (uuid ${q(uuid())})`,
      `  ${prop('Reference', p.ref, b.x0, b.y0 - 1.27)}`,
      `  ${prop('Value', value, b.x0, b.y1 + 2.54, true)}`,
      `  ${prop('Footprint', `${LIB}:${footprintName(p.def, p.comp.props)}`, b.x0, b.y1 + 5.08, true)}`,
      `  ${prop('Datasheet', '', b.x0, b.y1 + 7.62, true)}`,
      ...p.sym.pins.map((sp) => `  (pin ${q(sp.number)} (uuid ${q(uuid())}))`),
      `  (instances (project ${q(project)} (path ${q(`/${root}`)} (reference ${q(p.ref)}) (unit 1))))`,
      ')',
    ].join('\n');
  });

  const libSymbols = [...variants.values()].map((v) => v.sym.text);
  const sch = [
    `(kicad_sch (version 20230121) (generator makerlab) (uuid ${q(root)})`,
    `  ${paperText}`,
    `  (title_block (title ${q(doc.name)}) (comment 1 "Exported from MakerLab — connections are made by the net labels on each pin"))`,
    '  (lib_symbols',
    ...libSymbols.map((s) => s.replace(/^/gm, '    ')),
    '  )',
    ...body.map((l) => `  ${l}`),
    ...instances.map((s) => s.replace(/^/gm, '  ')),
    '  (sheet_instances (path "/" (page "1")))',
    ')',
    '',
  ].join('\n');

  // the library file has plain symbol names (no "makerlab:" prefix)
  const lib = symbolLibrary(libSymbols.map((s) => s.replace(/^\(symbol "makerlab:/, '(symbol "')));
  const dir = project;
  const files: Record<string, string> = {
    [`${dir}/${project}.kicad_sch`]: sch,
    [`${dir}/${project}.kicad_pro`]: JSON.stringify({ meta: { filename: `${project}.kicad_pro`, version: 1 }, sheets: [[root, 'Root']] }, null, 2) + '\n',
    [`${dir}/${LIB}.kicad_sym`]: lib,
    [`${dir}/sym-lib-table`]: `(sym_lib_table\n  (version 7)\n  (lib (name "${LIB}")(type "KiCad")(uri "\${KIPRJMOD}/${LIB}.kicad_sym")(options "")(descr "MakerLab parts"))\n)\n`,
    [`${dir}/fp-lib-table`]: `(fp_lib_table\n  (version 7)\n  (lib (name "${LIB}")(type "KiCad")(uri "\${KIPRJMOD}/${LIB}.pretty")(options "")(descr "MakerLab footprints"))\n)\n`,
  };
  for (const [name, text] of footprints) files[`${dir}/${LIB}.pretty/${name}.kicad_mod`] = text;
  const netPins = Object.fromEntries(nets.map((n) => [n.name, n.pins.map((x) => `${x.p.ref}.${x.number}`).sort()]));
  return { files, parts: placed.length, skipped, nets: nets.length, netPins };
}
