import type { CircuitDoc } from '../model/types';
import { pinKey } from '../model/types';
import { getDef } from '../components/registry';
import { worldPins } from '../model/geometry';

export type EdgeKind = 'wire' | 'contact' | 'internal';

export interface NetEdge {
  a: string;
  b: string;
  kind: EdgeKind;
  wireId?: string;
}

export interface Netlist {
  /** pinKey → net index */
  netOf: Map<string, number>;
  /** net index → pin keys */
  nets: string[][];
  edges: NetEdge[];
  /** pin keys of leads that are plugged into a socket */
  plugged: Set<string>;
}

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function buildNetlist(doc: CircuitDoc, opts: { skip?: Set<string> } = {}): Netlist {
  const uf = new UnionFind();
  const edges: NetEdge[] = [];
  const sockets = new Map<string, string[]>();
  const leads: { key: string; pos: string }[] = [];
  const plugged = new Set<string>();

  for (const comp of doc.components) {
    const def = getDef(comp.type);
    if (!def) continue;
    const pins = worldPins(comp, def);
    for (const p of pins) {
      const key = `${comp.id}:${p.id}`;
      uf.find(key);
      if (opts.skip?.has(comp.id)) continue;
      const pos = `${Math.round(p.wx)},${Math.round(p.wy)}`;
      if (p.kind === 'socket') {
        const list = sockets.get(pos);
        if (list) list.push(key);
        else sockets.set(pos, [key]);
      } else if (p.kind === 'lead') {
        leads.push({ key, pos });
      }
    }
    const groups = def.internalConnections?.(comp.props) ?? [];
    for (const g of groups) {
      for (let i = 1; i < g.length; i++) {
        const a = `${comp.id}:${g[i - 1]}`, b = `${comp.id}:${g[i]}`;
        uf.union(a, b);
        edges.push({ a, b, kind: 'internal' });
      }
    }
  }

  for (const l of leads) {
    const s = sockets.get(l.pos);
    if (!s) continue;
    for (const sk of s) {
      uf.union(l.key, sk);
      edges.push({ a: l.key, b: sk, kind: 'contact' });
      plugged.add(l.key);
      plugged.add(sk);
    }
  }

  for (const w of doc.wires) {
    const a = pinKey(w.a), b = pinKey(w.b);
    uf.union(a, b);
    edges.push({ a, b, kind: 'wire', wireId: w.id });
  }

  const rootIndex = new Map<string, number>();
  const netOf = new Map<string, number>();
  const nets: string[][] = [];
  for (const key of uf.parent.keys()) {
    const r = uf.find(key);
    let idx = rootIndex.get(r);
    if (idx === undefined) {
      idx = nets.length;
      rootIndex.set(r, idx);
      nets.push([]);
    }
    nets[idx].push(key);
    netOf.set(key, idx);
  }
  return { netOf, nets, edges, plugged };
}
