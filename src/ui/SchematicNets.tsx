import { memo } from 'react';
import type { CircuitDoc, Point } from '../model/types';
import type { Netlist } from '../sim/netlist';
import { getDef } from '../components/registry';
import { worldPins } from '../model/geometry';

/**
 * Schematic view: parts keep their positions; every net is drawn as a
 * minimum spanning tree of orthogonal segments between the part pins it joins.
 */
export const SchematicNets = memo(function SchematicNets({ doc, netlist }: { doc: CircuitDoc; netlist: Netlist }) {
  const pos = new Map<string, Point>();
  for (const c of doc.components) {
    const def = getDef(c.type);
    if (!def || def.layer === 0) continue;
    for (const p of worldPins(c, def)) pos.set(`${c.id}:${p.id}`, { x: p.wx, y: p.wy });
  }
  const segs: string[] = [];
  const dots: Point[] = [];
  for (const net of netlist.nets) {
    // A part's internally joined pins (e.g. the Uno's three GNDs) collapse to the one
    // nearest the other parts on the net, so no loops are drawn through the symbol.
    const byComp = new Map<string, Point[]>();
    for (const k of net) {
      const p = pos.get(k);
      if (!p) continue;
      const c = k.slice(0, k.indexOf(':'));
      if (!byComp.has(c)) byComp.set(c, []);
      byComp.get(c)!.push(p);
    }
    const pts: Point[] = [];
    for (const [c, list] of byComp) {
      if (list.length === 1) {
        pts.push(list[0]);
        continue;
      }
      const others = [...byComp].filter(([o]) => o !== c).flatMap(([, l]) => l);
      if (!others.length) continue;
      const cx = others.reduce((a, p) => a + p.x, 0) / others.length, cy = others.reduce((a, p) => a + p.y, 0) / others.length;
      pts.push(list.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best)));
    }
    // de-duplicate identical positions
    const uniq: Point[] = [];
    for (const p of pts) if (!uniq.some((q) => q.x === p.x && q.y === p.y)) uniq.push(p);
    if (uniq.length < 2) continue;
    // Prim's MST on Manhattan distance
    const inTree = [0];
    const rest = uniq.map((_, i) => i).slice(1);
    const degree = new Array(uniq.length).fill(0);
    while (rest.length) {
      let bi = -1, bj = -1, bd = Infinity;
      for (const i of inTree) for (const j of rest) {
        const d = Math.abs(uniq[i].x - uniq[j].x) + Math.abs(uniq[i].y - uniq[j].y);
        if (d < bd) {
          bd = d;
          bi = i;
          bj = j;
        }
      }
      const a = uniq[bi], b = uniq[bj];
      segs.push(`M${a.x} ${a.y} L${b.x} ${a.y} L${b.x} ${b.y}`);
      degree[bi]++;
      degree[bj]++;
      inTree.push(bj);
      rest.splice(rest.indexOf(bj), 1);
    }
    degree.forEach((d, i) => d >= 3 && dots.push(uniq[i]));
  }
  return (
    <g className="sch-nets" style={{ pointerEvents: 'none' }}>
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="#1f3a5f" strokeWidth={1.2} strokeLinejoin="round" />)}
      {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.2} fill="#1f3a5f" />)}
    </g>
  );
});
