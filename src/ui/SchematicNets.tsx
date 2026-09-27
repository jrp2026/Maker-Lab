import { memo, useLayoutEffect, useState } from 'react';
import type { CircuitDoc, Point } from '../model/types';
import type { Netlist } from '../sim/netlist';
import type { ComponentDef } from '../components/types';
import { getDef } from '../components/registry';
import { localToWorld, worldBounds, worldPins } from '../model/geometry';

const INK = '#1f3a5f';
const STUB = 10;
const FONT = "'JetBrains Mono', ui-monospace, monospace";

interface SPin { key: string; comp: string; pin: string; at: Point; dir: Point; end: Point }

type Box = { x: number; y: number; w: number; h: number };

/**
 * The drawn extent of each part's schematic symbol, in world coordinates. Part bounds describe
 * the (usually larger) breadboard artwork, so the symbol itself is measured from the DOM.
 */
function measureSymbols(doc: CircuitDoc): Record<string, Box> {
  const out: Record<string, Box> = {};
  if (typeof document === 'undefined') return out;
  for (const c of doc.components) {
    const def = getDef(c.type);
    const g = document.querySelector(`g.comp[data-id="${CSS.escape(c.id)}"]`);
    if (!def || !g) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    // skip the invisible hit-area rect (first child) and the dashed selection outline
    for (const el of [...g.children].slice(1)) {
      if (el.getAttribute('stroke-dasharray') === '4 3' || !('getBBox' in el)) continue;
      const b = (el as SVGGraphicsElement).getBBox();
      if (!b.width && !b.height) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) continue;
    const pts = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }].map((p) => localToWorld(c, def, p));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    out[c.id] = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return out;
}

/** Outward direction of a pin: towards the side of the part's outline it sits nearest to. */
function outward(p: Point, b: { x: number; y: number; w: number; h: number }): Point {
  const d = [
    { v: { x: -1, y: 0 }, d: Math.abs(p.x - b.x) },
    { v: { x: 1, y: 0 }, d: Math.abs(b.x + b.w - p.x) },
    { v: { x: 0, y: -1 }, d: Math.abs(p.y - b.y) },
    { v: { x: 0, y: 1 }, d: Math.abs(b.y + b.h - p.y) },
  ];
  return d.reduce((a, c) => (c.d < a.d ? c : a)).v;
}

const GND_PIN = /^(GND\d*|VSS|AGND|DGND|PGND|0V)$/i;
const SUPPLY_PIN = /^(\+?5V|3V3|3\.3V|\+?12V|VCC|VDD|VIN|VBUS|5V0)$/i;

/**
 * Orthogonal L between two stub ends, bending on the side that leaves `a` forwards and
 * enters `b` from outside its symbol, so wires don't cut through parts or run along pin rows.
 */
function route(a: SPin, b: SPin): string {
  const score = (c: Point) => {
    let pen = 0;
    const l1 = { x: Math.sign(c.x - a.end.x), y: Math.sign(c.y - a.end.y) };
    const l2 = { x: Math.sign(b.end.x - c.x), y: Math.sign(b.end.y - c.y) };
    if (l1.x * a.dir.x + l1.y * a.dir.y < 0) pen += 2; // doubles back into a
    if (l2.x * b.dir.x + l2.y * b.dir.y > 0) pen += 2; // arrives from b's body side
    if (l1.x * a.dir.x + l1.y * a.dir.y > 0) pen -= 0.5; // leaves along the stub
    return pen;
  };
  const h = { x: b.end.x, y: a.end.y }, v = { x: a.end.x, y: b.end.y };
  const c = score(h) <= score(v) ? h : v;
  return `M${a.end.x} ${a.end.y} L${c.x} ${c.y} L${b.end.x} ${b.end.y}`;
}

/** 'GND', a supply name such as '5V', or null for an ordinary signal net. */
function netName(pins: SPin[]): string | null {
  if (pins.some((p) => GND_PIN.test(p.pin))) return 'GND';
  const sup = pins.map((p) => p.pin.toUpperCase().replace('3.3V', '3V3').replace(/^\+/, '')).filter((n) => SUPPLY_PIN.test(n));
  if (!sup.length) return null;
  // prefer a voltage ("5V") over a generic name ("VCC")
  return sup.find((n) => /^\d/.test(n)) ?? sup[0];
}

/** Reference designator prefix, as on a real schematic (R1, C2, D1, Q1, U3…). */
function prefix(def: ComponentDef): string {
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
  if (/multimeter|meter|oscilloscope/.test(t)) return 'XM';
  switch (def.category) {
    case 'passive': return 'R';
    case 'diodes': return 'D';
    case 'transistors': return 'Q';
    case 'switches': return 'SW';
    case 'output': return 'X';
    default: return 'U';
  }
}

/** Thin boxes around the straight runs of a wire path ("M x y L x y …"), for label placement. */
function wireBoxes(d: string): Box[] {
  const n = d.match(/-?[\d.]+/g)!.map(Number);
  const out: Box[] = [];
  for (let i = 2; i + 1 < n.length; i += 2) {
    const [x0, y0, x1, y1] = [n[i - 2], n[i - 1], n[i], n[i + 1]];
    out.push({ x: Math.min(x0, x1) - 1.5, y: Math.min(y0, y1) - 1.5, w: Math.abs(x1 - x0) + 3, h: Math.abs(y1 - y0) + 3 });
  }
  return out;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Put each designator next to its symbol where it doesn't collide with a flag or another label. */
function placeLabels(labels: { b: Box; text: string }[], obstacles: Box[]) {
  const placed: { x: number; y: number; anchor: 'start' | 'end'; text: string }[] = [];
  const taken: Box[] = [...obstacles];
  for (const [i, { b, text }] of labels.entries()) {
    const symbols = labels.filter((_, j) => j !== i).map((l) => l.b);
    const w = text.length * 5 + 1, h = 8;
    const cands: { x: number; y: number; anchor: 'start' | 'end' }[] = [
      { x: b.x, y: b.y - 3, anchor: 'start' },
      { x: b.x + b.w, y: b.y - 3, anchor: 'end' },
      { x: b.x - 3, y: b.y + b.h / 2 + 3, anchor: 'end' },
      { x: b.x + b.w + 3, y: b.y + b.h / 2 + 3, anchor: 'start' },
      { x: b.x, y: b.y + b.h + 9, anchor: 'start' },
    ];
    const box = (c: (typeof cands)[number]): Box => ({ x: c.anchor === 'start' ? c.x : c.x - w, y: c.y - h + 1, w, h });
    const c = cands.find((c) => !taken.some((t) => overlaps(t, box(c))) && !symbols.some((t) => overlaps(t, box(c))));
    if (!c) continue; // densely packed parts (resistor rows): leave the label out rather than overprint
    taken.push(box(c));
    placed.push({ ...c, text });
  }
  return placed;
}

/**
 * Schematic view: parts keep their positions. Every pin leaves its symbol with a short
 * outward stub; ground and supply nets end in ground symbols and named supply flags
 * instead of long wires; other nets are drawn as a minimum spanning tree of orthogonal
 * segments between the stub ends. Parts get reference designators (R1, C1, U1…).
 */
export const SchematicNets = memo(function SchematicNets({ doc, netlist }: { doc: CircuitDoc; netlist: Netlist }) {
  const [sym, setSym] = useState<Record<string, Box>>({});
  useLayoutEffect(() => {
    const m = measureSymbols(doc);
    setSym((old) => (JSON.stringify(old) === JSON.stringify(m) ? old : m));
  }, [doc]);
  const pins = new Map<string, SPin>();
  const labels: { b: Box; text: string }[] = [];
  const counters = new Map<string, number>();
  for (const c of doc.components) {
    const def = getDef(c.type);
    if (!def || def.layer === 0) continue;
    const b = sym[c.id] ?? worldBounds(c, def);
    const pre = prefix(def);
    const n = (counters.get(pre) ?? 0) + 1;
    counters.set(pre, n);
    labels.push({ b, text: `${pre}${n}` });
    for (const p of worldPins(c, def)) {
      const at = { x: p.wx, y: p.wy };
      const dir = outward(at, b);
      pins.set(`${c.id}:${p.id}`, { key: `${c.id}:${p.id}`, comp: c.id, pin: p.id, at, dir, end: { x: at.x + dir.x * STUB, y: at.y + dir.y * STUB } });
    }
  }
  const segs: string[] = [];
  const dots: Point[] = [];
  const grounds: SPin[] = [];
  const flags: { p: SPin; name: string }[] = [];
  for (const net of netlist.nets) {
    const all = net.map((k) => pins.get(k)).filter((p): p is SPin => !!p);
    // A part's internally joined pins (e.g. the Uno's three GNDs) collapse to the one
    // nearest the other parts on the net, so no loops are drawn through the symbol.
    const byComp = new Map<string, SPin[]>();
    for (const p of all) byComp.set(p.comp, [...(byComp.get(p.comp) ?? []), p]);
    if (byComp.size < 2) continue;
    const pts: SPin[] = [];
    for (const [c, list] of byComp) {
      if (list.length === 1) {
        pts.push(list[0]);
        continue;
      }
      const others = [...byComp].filter(([o]) => o !== c).flatMap(([, l]) => l);
      const cx = others.reduce((a, p) => a + p.at.x, 0) / others.length, cy = others.reduce((a, p) => a + p.at.y, 0) / others.length;
      pts.push(list.reduce((best, p) => (Math.hypot(p.at.x - cx, p.at.y - cy) < Math.hypot(best.at.x - cx, best.at.y - cy) ? p : best)));
    }
    const name = netName(all);
    if (name) {
      // power nets: every pin gets its own symbol, like a hand-drawn schematic
      for (const p of pts) {
        segs.push(`M${p.at.x} ${p.at.y} L${p.end.x} ${p.end.y}`);
        if (name === 'GND') grounds.push(p);
        else flags.push({ p, name });
      }
      continue;
    }
    const uniq: SPin[] = [];
    for (const p of pts) if (!uniq.some((q) => q.end.x === p.end.x && q.end.y === p.end.y)) uniq.push(p);
    for (const p of uniq) segs.push(`M${p.at.x} ${p.at.y} L${p.end.x} ${p.end.y}`);
    if (uniq.length < 2) continue;
    // Prim's MST on Manhattan distance between the stub ends
    const inTree = [0];
    const rest = uniq.map((_, i) => i).slice(1);
    const degree = new Array(uniq.length).fill(0);
    while (rest.length) {
      let bi = -1, bj = -1, bd = Infinity;
      for (const i of inTree) for (const j of rest) {
        const d = Math.abs(uniq[i].end.x - uniq[j].end.x) + Math.abs(uniq[i].end.y - uniq[j].end.y);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
      const a = uniq[bi], b = uniq[bj];
      segs.push(route(a, b));
      degree[bi]++;
      degree[bj]++;
      inTree.push(bj);
      rest.splice(rest.indexOf(bj), 1);
    }
    degree.forEach((d, i) => d >= 3 && dots.push(uniq[i].end));
  }
  return (
    <g className="sch-nets" style={{ pointerEvents: 'none' }}>
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />)}
      {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.2} fill={INK} />)}
      {grounds.map(({ end, dir }, i) => {
        // ground symbol pointing away from the part (down unless the pin faces up)
        const up = dir.y < 0;
        const s = up ? -1 : 1;
        return (
          <g key={`g${i}`} stroke={INK} strokeWidth={1.2}>
            <line x1={end.x} y1={end.y} x2={end.x} y2={end.y + 4 * s} />
            <line x1={end.x - 7} y1={end.y + 4 * s} x2={end.x + 7} y2={end.y + 4 * s} />
            <line x1={end.x - 4.5} y1={end.y + 7 * s} x2={end.x + 4.5} y2={end.y + 7 * s} />
            <line x1={end.x - 2} y1={end.y + 10 * s} x2={end.x + 2} y2={end.y + 10 * s} />
          </g>
        );
      })}
      {flags.map(({ p, name }, i) => {
        // supply flag: a bar with the rail's name, pointing away from the part
        const { end, dir } = p;
        const vertical = dir.y !== 0;
        const s = vertical ? Math.sign(dir.y) : Math.sign(dir.x);
        return (
          <g key={`f${i}`}>
            {vertical ? (
              <>
                <line x1={end.x - 6} y1={end.y} x2={end.x + 6} y2={end.y} stroke={INK} strokeWidth={1.4} />
                <text x={end.x} y={end.y + (s < 0 ? -3 : 9)} fontSize={7.5} fontWeight={700} textAnchor="middle" fill={INK} fontFamily={FONT}>{name}</text>
              </>
            ) : (
              <>
                <line x1={end.x} y1={end.y - 6} x2={end.x} y2={end.y + 6} stroke={INK} strokeWidth={1.4} />
                <text x={end.x + s * 3} y={end.y + 2.6} fontSize={7.5} fontWeight={700} textAnchor={s < 0 ? 'end' : 'start'} fill={INK} fontFamily={FONT}>{name}</text>
              </>
            )}
          </g>
        );
      })}
      {placeLabels(labels, [
        ...segs.flatMap(wireBoxes),
        ...grounds.map(({ end }) => ({ x: end.x - 7, y: end.y - 11, w: 14, h: 22 })),
        ...flags.map(({ p, name }) => ({ x: p.end.x - name.length * 5 - 4, y: p.end.y - 10, w: name.length * 10 + 8, h: 20 })),
      ]).map((l, i) => (
        <text key={`l${i}`} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={8} fontWeight={700} fill="#b4471f" fontFamily={FONT}>{l.text}</text>
      ))}
    </g>
  );
});
