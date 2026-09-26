import type { ComponentInstance, Point, Props } from './types';
import { boundsOf, type ComponentDef, type PinDef } from '../components/types';

export const GRID = 10;

export function snap(v: number, g = GRID): number {
  return Math.round(v / g) * g;
}

/** Rotation pivot in local coordinates, snapped to the pin grid so rotated pins stay on grid. */
export function pivotOf(def: ComponentDef, props?: Props): Point {
  const b = props ? boundsOf(def, props) : def.bounds;
  return { x: snap(b.x + b.w / 2), y: snap(b.y + b.h / 2) };
}

export function localToWorld(comp: ComponentInstance, def: ComponentDef, p: Point): Point {
  const pv = pivotOf(def, comp.props);
  let x = p.x - pv.x;
  const y = p.y - pv.y;
  if (comp.flip) x = -x;
  let rx = x, ry = y;
  switch (comp.rot) {
    case 1: rx = -y; ry = x; break;
    case 2: rx = -x; ry = -y; break;
    case 3: rx = y; ry = -x; break;
  }
  return { x: comp.x + pv.x + rx, y: comp.y + pv.y + ry };
}

export function worldToLocal(comp: ComponentInstance, def: ComponentDef, p: Point): Point {
  const pv = pivotOf(def, comp.props);
  const x = p.x - comp.x - pv.x;
  const y = p.y - comp.y - pv.y;
  let rx = x, ry = y;
  switch (comp.rot) {
    case 1: rx = y; ry = -x; break;
    case 2: rx = -x; ry = -y; break;
    case 3: rx = -y; ry = x; break;
  }
  if (comp.flip) rx = -rx;
  return { x: rx + pv.x, y: ry + pv.y };
}

/** SVG transform string mapping local coordinates to world. */
export function transformOf(comp: ComponentInstance, def: ComponentDef): string {
  const pv = pivotOf(def, comp.props);
  const parts = [`translate(${comp.x + pv.x} ${comp.y + pv.y})`];
  if (comp.rot) parts.push(`rotate(${comp.rot * 90})`);
  if (comp.flip) parts.push('scale(-1 1)');
  parts.push(`translate(${-pv.x} ${-pv.y})`);
  return parts.join(' ');
}

export interface WorldPin extends PinDef {
  wx: number;
  wy: number;
}

const pinCache = new WeakMap<object, PinDef[]>();

export function pinsOf(comp: ComponentInstance, def: ComponentDef): PinDef[] {
  let pins = pinCache.get(comp.props);
  if (!pins) {
    pins = def.pins(comp.props);
    pinCache.set(comp.props, pins);
  }
  return pins;
}

export function worldPins(comp: ComponentInstance, def: ComponentDef): WorldPin[] {
  return pinsOf(comp, def).map((p) => {
    const w = localToWorld(comp, def, p);
    return { ...p, wx: w.x, wy: w.y };
  });
}

export function worldBounds(comp: ComponentInstance, def: ComponentDef) {
  const b = boundsOf(def, comp.props);
  const corners = [
    localToWorld(comp, def, { x: b.x, y: b.y }),
    localToWorld(comp, def, { x: b.x + b.w, y: b.y }),
    localToWorld(comp, def, { x: b.x, y: b.y + b.h }),
    localToWorld(comp, def, { x: b.x + b.w, y: b.y + b.h }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
