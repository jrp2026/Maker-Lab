import { describe, expect, it } from 'vitest';
import { DEFS } from '../src/components/registry';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

describe('every part', () => {
  it.each(DEFS.map((d) => [d.type, d] as const))('%s renders, builds and simulates alone', (type, def) => {
    const comp = { id: 'p', type, x: 0, y: 0, rot: 0 as const, flip: false, props: { ...def.defaultProps } };
    // render both views without throwing
    def.render({ comp, props: comp.props });
    def.schematic({ comp, props: comp.props });
    expect(def.pins(comp.props).length).toBeGreaterThan(0);
    const doc: CircuitDoc = { version: 1, name: 't', components: [comp], wires: [] };
    const sim = new Simulator(doc);
    const errs = sim.start();
    expect([...errs.values()]).toEqual([]);
    for (let i = 0; i < 5; i++) sim.advance(0.02);
    const snap = sim.snapshot();
    expect(snap.solverFailed).toBe(false);
    if (snap.comps.p) def.render({ comp, props: comp.props, sim: snap.comps.p });
  });
});
