/**
 * Device links that are switched on in this session (not saved with the project, so opening a
 * project never asks for the mic or camera). Toggle from a click so the browser's permission
 * prompt is allowed.
 */
import { create } from 'zustand';
import { getDef } from '../components/registry';
import { setPropsSilent, useEditor } from '../model/store';
import { getSimulator } from '../sim/controller';
import type { PropValue } from '../model/types';
import { linkFor, type AnyLink } from './links';
import { subscribe, type Readings, type SourceId } from './sensors';

interface Active {
  link: AnyLink;
  stop: () => void;
  memo: Record<string, unknown>;
  lastWrite: number;
  pressUntil: number;
}

const active = new Map<string, Active>();

export const useDeviceLinks = create<{ on: Record<string, true>; reading: Record<string, Readings[SourceId]> }>(() => ({ on: {}, reading: {} }));

const WRITE_MS = 100;
const PRESS_MS = 300;

function apply(id: string, a: Active, r: Readings[SourceId]) {
  const comp = useEditor.getState().doc.components.find((c) => c.id === id);
  if (!comp) return unlink(id);
  useDeviceLinks.setState((s) => ({ reading: { ...s.reading, [id]: r } }));
  const res = a.link.apply(r as never, { props: comp.props, memo: a.memo });
  const now = performance.now();
  if (res.press !== undefined) {
    const sim = getSimulator();
    if (res.press) a.pressUntil = now + PRESS_MS;
    if (sim) sim.input(id).pressed = now < a.pressUntil;
  }
  if (res.props && now - a.lastWrite >= WRITE_MS) {
    const patch: Record<string, PropValue> = {};
    for (const [k, v] of Object.entries(res.props)) if (comp.props[k] !== v) patch[k] = v;
    if (Object.keys(patch).length) {
      a.lastWrite = now;
      setPropsSilent(id, patch);
    }
  }
}

export function isLinked(id: string) {
  return active.has(id);
}

export function link(id: string) {
  if (active.has(id)) return;
  const comp = useEditor.getState().doc.components.find((c) => c.id === id);
  const def = comp && getDef(comp.type);
  const l = def && linkFor(def);
  if (!l) return;
  const a: Active = { link: l, stop: () => undefined, memo: {}, lastWrite: 0, pressUntil: 0 };
  active.set(id, a);
  a.stop = subscribe(l.source as SourceId, (r: Readings[SourceId]) => apply(id, a, r));
  useDeviceLinks.setState((s) => ({ on: { ...s.on, [id]: true } }));
}

export function unlink(id: string) {
  const a = active.get(id);
  if (!a) return;
  active.delete(id);
  a.stop();
  const sim = getSimulator();
  if (sim && a.pressUntil) sim.input(id).pressed = false;
  useDeviceLinks.setState((s) => {
    const on = { ...s.on };
    const reading = { ...s.reading };
    delete on[id];
    delete reading[id];
    return { on, reading };
  });
}

export function toggleLink(id: string) {
  if (active.has(id)) unlink(id);
  else link(id);
}

// parts that were deleted (or a different circuit was opened) let go of their sensor
useEditor.subscribe((s, prev) => {
  if (s.doc === prev.doc || !active.size) return;
  const ids = new Set(s.doc.components.map((c) => c.id));
  for (const id of [...active.keys()]) if (!ids.has(id)) unlink(id);
});
