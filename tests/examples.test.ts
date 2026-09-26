import { describe, expect, it } from 'vitest';
import { EXAMPLES, BLOCKS_BLINK_CODE, BLOCKS_BLINK_JSON } from '../src/examples';
import { Simulator } from '../src/sim/simulator';
import { sketchFromJson } from '../src/blocks/arduino';
import { UNO } from '../src/mcu/boards';
import { buildNetlist } from '../src/sim/netlist';

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))('%s runs cleanly', (_id, ex) => {
    const doc = ex.build();
    // every wire endpoint must exist
    const nl = buildNetlist(doc);
    for (const w of doc.wires) {
      expect(nl.netOf.has(`${w.a.comp}:${w.a.pin}`), `${w.a.comp}:${w.a.pin}`).toBe(true);
      expect(nl.netOf.has(`${w.b.comp}:${w.b.pin}`), `${w.b.comp}:${w.b.pin}`).toBe(true);
    }
    const sim = new Simulator(doc);
    const errs = sim.start();
    expect([...errs.values()]).toEqual([]);
    let snap = sim.snapshot();
    for (let i = 0; i < 75; i++) {
      sim.advance(0.02);
      snap = sim.snapshot();
    }
    expect(snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
    expect(snap.solverFailed).toBe(false);
  });

  it('blocks example code matches the generator', () => {
    expect(sketchFromJson(BLOCKS_BLINK_JSON, UNO)).toBe(BLOCKS_BLINK_CODE);
  });

  it('LCD and ESP32 examples actually show text', () => {
    for (const id of ['lcd', 'esp32-lcd']) {
      const sim = new Simulator(EXAMPLES.find((e) => e.id === id)!.build());
      sim.start();
      let snap = sim.snapshot();
      for (let i = 0; i < 60; i++) {
        sim.advance(0.02);
        snap = sim.snapshot();
      }
      const lcd = Object.values(snap.comps).find((c) => c && 'rows' in c)!;
      const text = (lcd.rows as number[][]).map((r) => String.fromCharCode(...r.map((c) => (c < 8 ? 35 : c)))).join('|');
      expect(text, id).toMatch(id === 'lcd' ? /Hello, world! #.*Uptime: 1 s/ : /ESP32 ADC demo.*V/);
    }
  });
});
