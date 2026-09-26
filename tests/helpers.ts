import { Simulator } from '../src/sim/simulator';
import { getDef } from '../src/components/registry';
import type { CircuitDoc, ComponentInstance, Wire } from '../src/model/types';

export const part = (id: string, type: string, props: Record<string, any> = {}): ComponentInstance => {
  const def = getDef(type);
  if (!def) throw new Error(`no part ${type}`);
  return { id, type, x: 0, y: 0, rot: 0, flip: false, props: { ...def.defaultProps, ...props } };
};
let wn = 0;
/** wire('a.PIN', 'b.PIN') */
export const wire = (a: string, b: string): Wire => {
  const [ac, ...ap] = a.split('.');
  const [bc, ...bp] = b.split('.');
  return { id: `w${++wn}`, a: { comp: ac, pin: ap.join('.') }, b: { comp: bc, pin: bp.join('.') }, points: [], color: '#000' };
};
export function simulate(components: ComponentInstance[], wires: Wire[], seconds: number, each?: (sim: Simulator, t: number) => void) {
  const doc: CircuitDoc = { version: 1, name: 't', components, wires };
  const sim = new Simulator(doc);
  const errs = sim.start();
  if (errs.size) throw new Error([...errs.values()].map((e) => `${e.message} @${e.line}`).join());
  let snap = sim.snapshot();
  const frames = Math.max(1, Math.round(seconds / 0.02));
  for (let i = 0; i < frames; i++) {
    each?.(sim, i * 0.02);
    sim.advance(0.02);
    snap = sim.snapshot();
  }
  const volts = (pinKey: string) => snap.netVolts[snap.netOfPin.get(pinKey)!];
  return { sim, snap, volts };
}
