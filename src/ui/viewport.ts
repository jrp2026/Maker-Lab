import { create } from 'zustand';
import type { CircuitDoc } from '../model/types';
import { getDef } from '../components/registry';
import { worldBounds } from '../model/geometry';

export interface Viewport {
  x: number;
  y: number;
  s: number;
}

export const useViewport = create<Viewport>(() => ({ x: 380, y: 140, s: 1.6 }));

let canvasSize = { w: 1000, h: 700 };
export function setCanvasSize(w: number, h: number) {
  canvasSize = { w, h };
}
export function getCanvasSize() {
  return canvasSize;
}

export function docBounds(doc: CircuitDoc) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of doc.components) {
    const def = getDef(c.type);
    if (!def) continue;
    const b = worldBounds(c, def);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  for (const w of doc.wires) for (const p of w.points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function zoomToFit(doc: CircuitDoc) {
  const b = docBounds(doc);
  const { w, h } = canvasSize;
  if (!b) {
    useViewport.setState({ x: w / 2 - 150, y: h / 2 - 100, s: 1.6 });
    return;
  }
  const pad = 60;
  const s = Math.max(0.3, Math.min(4, Math.min((w - pad * 2) / Math.max(b.w, 50), (h - pad * 2) / Math.max(b.h, 50))));
  useViewport.setState({ s, x: w / 2 - (b.x + b.w / 2) * s, y: h / 2 - (b.y + b.h / 2) * s });
}

export function zoomBy(factor: number, cx = canvasSize.w / 2, cy = canvasSize.h / 2) {
  const v = useViewport.getState();
  const s = Math.max(0.25, Math.min(6, v.s * factor));
  const k = s / v.s;
  useViewport.setState({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
}
