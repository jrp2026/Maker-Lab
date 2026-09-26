import { create } from 'zustand';
import type { CircuitDoc, ComponentInstance, PinRef, Point, PropValue, Rotation, Wire } from './types';
import { emptyDoc, newId } from './types';
import { getDef } from '../components/registry';
import { snap } from './geometry';
import type { McuError } from '../mcu/runtime';
import { useAiParts } from '../ai/library';

export type ViewMode = 'breadboard' | 'schematic';

export interface Selection {
  comps: string[];
  wire: string | null;
}

export interface EditorState {
  doc: CircuitDoc;
  past: CircuitDoc[];
  future: CircuitDoc[];
  selection: Selection;
  view: ViewMode;
  running: boolean;
  codeOpen: boolean;
  codeTarget: string | null;
  compileErrors: Record<string, McuError>;
  muted: boolean;
  toast: { text: string; kind: 'info' | 'error' } | null;
  /** doc captured at the start of a drag gesture (for a single undo step) */
  gestureBase: CircuitDoc | null;
  wireColor: string;
  simEpoch: number;
}

export const WIRE_COLORS = ['#e53935', '#212121', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#ffffff', '#795548', '#9e9e9e'];

const HISTORY_LIMIT = 100;

export const useEditor = create<EditorState>(() => ({
  doc: emptyDoc(),
  past: [],
  future: [],
  selection: { comps: [], wire: null },
  view: 'breadboard',
  running: false,
  codeOpen: false,
  codeTarget: null,
  compileErrors: {},
  muted: false,
  toast: null,
  gestureBase: null,
  wireColor: WIRE_COLORS[3],
  simEpoch: 0,
}));

const set = useEditor.setState;
const get = useEditor.getState;

// ------------------------------------------------------------------ history

export function commit(next: CircuitDoc) {
  const s = get();
  if (next === s.doc) return;
  if (s.gestureBase) {
    set({ doc: next });
    return;
  }
  set({ doc: next, past: [...s.past.slice(-HISTORY_LIMIT + 1), s.doc], future: [] });
}

export function beginGesture() {
  const s = get();
  if (!s.gestureBase) set({ gestureBase: s.doc });
}

export function endGesture() {
  const s = get();
  if (!s.gestureBase) return;
  if (s.gestureBase !== s.doc) set({ past: [...s.past.slice(-HISTORY_LIMIT + 1), s.gestureBase], future: [] });
  set({ gestureBase: null });
}

export function undo() {
  const s = get();
  const prev = s.past[s.past.length - 1];
  if (!prev) return;
  set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], selection: pruneSelection(prev, s.selection) });
}

export function redo() {
  const s = get();
  const next = s.future[0];
  if (!next) return;
  set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), selection: pruneSelection(next, s.selection) });
}

function pruneSelection(doc: CircuitDoc, sel: Selection): Selection {
  const ids = new Set(doc.components.map((c) => c.id));
  return { comps: sel.comps.filter((c) => ids.has(c)), wire: sel.wire && doc.wires.some((w) => w.id === sel.wire) ? sel.wire : null };
}

export function loadDoc(doc: CircuitDoc, opts: { keepHistory?: boolean } = {}) {
  const s = get();
  set({
    doc,
    past: opts.keepHistory ? [...s.past, s.doc] : [],
    future: [],
    selection: { comps: [], wire: null },
    compileErrors: {},
  });
}

// ------------------------------------------------------------------ edits

export function updateDoc(fn: (d: CircuitDoc) => CircuitDoc) {
  commit(fn(get().doc));
}

export function addComponent(type: string, x: number, y: number, props?: Record<string, PropValue>): string | null {
  const def = getDef(type);
  if (!def) return null;
  const id = newId(type.replace(/[^a-z]/g, '').slice(0, 3));
  const comp: ComponentInstance = { id, type, x: snap(x), y: snap(y), rot: 0, flip: false, props: { ...def.defaultProps, ...props } };
  const spec = useAiParts.getState().known[type];
  updateDoc((d) => ({
    ...d,
    components: def.layer === 0 ? [comp, ...d.components] : [...d.components, comp],
    // AI parts carry their definition inside the document
    ...(spec && !(d.customParts ?? []).some((p) => p.type === type) ? { customParts: [...(d.customParts ?? []), spec] } : {}),
  }));
  set({ selection: { comps: [id], wire: null } });
  return id;
}

export function moveComponents(ids: string[], dx: number, dy: number, base: CircuitDoc) {
  const idset = new Set(ids);
  const orig = new Map(base.components.map((c) => [c.id, c]));
  const moved = (c: ComponentInstance) => {
    const o = orig.get(c.id) ?? c;
    return { ...c, x: snap(o.x + dx), y: snap(o.y + dy) };
  };
  // Wires between two moved parts keep their shape; bends move along.
  const origWires = new Map(base.wires.map((w) => [w.id, w]));
  updateDoc((d) => ({
    ...d,
    components: d.components.map((c) => (idset.has(c.id) ? moved(c) : c)),
    wires: d.wires.map((w) => {
      const o = origWires.get(w.id);
      if (!o || !o.points.length) return w;
      if (idset.has(w.a.comp) && idset.has(w.b.comp)) return { ...w, points: o.points.map((p) => ({ x: snap(p.x + dx, 5), y: snap(p.y + dy, 5) })) };
      return w;
    }),
  }));
}

export function deleteSelection() {
  const { selection } = get();
  if (!selection.comps.length && !selection.wire) return;
  const ids = new Set(selection.comps);
  updateDoc((d) => ({
    ...d,
    components: d.components.filter((c) => !ids.has(c.id)),
    wires: d.wires.filter((w) => w.id !== selection.wire && !ids.has(w.a.comp) && !ids.has(w.b.comp)),
  }));
  set({ selection: { comps: [], wire: null } });
}

export function rotateSelection(dir: 1 | -1 = 1) {
  const ids = new Set(get().selection.comps);
  if (!ids.size) return;
  updateDoc((d) => ({ ...d, components: d.components.map((c) => (ids.has(c.id) ? { ...c, rot: (((c.rot + dir) % 4) + 4) % 4 as Rotation } : c)) }));
}

export function flipSelection() {
  const ids = new Set(get().selection.comps);
  if (!ids.size) return;
  updateDoc((d) => ({ ...d, components: d.components.map((c) => (ids.has(c.id) ? { ...c, flip: !c.flip } : c)) }));
}

export function setProp(id: string, key: string, value: PropValue) {
  updateDoc((d) => ({ ...d, components: d.components.map((c) => (c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c)) }));
}

export function addWire(a: PinRef, b: PinRef, points: Point[]) {
  if (a.comp === b.comp && a.pin === b.pin) return;
  const id = newId('w');
  const wire: Wire = { id, a, b, points, color: get().wireColor };
  updateDoc((d) => ({ ...d, wires: [...d.wires, wire] }));
  set({ selection: { comps: [], wire: id } });
}

export function updateWire(id: string, patch: Partial<Wire>) {
  updateDoc((d) => ({ ...d, wires: d.wires.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
}

export function select(sel: Partial<Selection>) {
  set({ selection: { comps: sel.comps ?? [], wire: sel.wire ?? null } });
}

let clipboard: { comps: ComponentInstance[]; wires: Wire[] } | null = null;

export function copySelection() {
  const { doc, selection } = get();
  const ids = new Set(selection.comps);
  if (!ids.size) return false;
  clipboard = {
    comps: doc.components.filter((c) => ids.has(c.id)),
    wires: doc.wires.filter((w) => ids.has(w.a.comp) && ids.has(w.b.comp)),
  };
  return true;
}

export function paste(offset = 20) {
  if (!clipboard) return;
  const map = new Map<string, string>();
  const comps = clipboard.comps.map((c) => {
    const id = newId(c.type.replace(/[^a-z]/g, '').slice(0, 3));
    map.set(c.id, id);
    return { ...c, id, x: c.x + offset, y: c.y + offset };
  });
  const wires = clipboard.wires.map((w) => ({
    ...w,
    id: newId('w'),
    a: { ...w.a, comp: map.get(w.a.comp)! },
    b: { ...w.b, comp: map.get(w.b.comp)! },
    points: w.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
  }));
  updateDoc((d) => ({ ...d, components: [...d.components, ...comps], wires: [...d.wires, ...wires] }));
  clipboard = { comps: comps, wires };
  set({ selection: { comps: comps.map((c) => c.id), wire: null } });
}

export function showToast(text: string, kind: 'info' | 'error' = 'info') {
  set({ toast: { text, kind } });
  const t = get().toast;
  setTimeout(() => {
    if (get().toast === t) set({ toast: null });
  }, kind === 'error' ? 5000 : 2600);
}

/** Update a prop without creating an undo step (used for code editing keystrokes). */
export function setPropSilent(id: string, key: string, value: PropValue) {
  const s = get();
  set({ doc: { ...s.doc, components: s.doc.components.map((c) => (c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c)) } });
}
