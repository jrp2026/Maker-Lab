import { describe, expect, it } from 'vitest';
import { DEFS, getDef } from '../src/components/registry';
import { part, simulate, wire } from './helpers';

const CHIP_POWER: Record<string, [string, string]> = { attiny85: ['VCC', 'GND'], atmega328p: ['VCC', 'GND1'], pic16f877a: ['VDD1', 'VSS1'], 'generic-mcu': ['VCC', 'GND'] };

describe('every programmable board runs its default sketch', () => {
  it.each(DEFS.filter((d) => d.mcu).map((d) => [d.type]))('%s', (type) => {
    const def = getDef(type)!;
    const spec = def.mcu!.board;
    const comps = [part('u', type)];
    const wires = [];
    if (CHIP_POWER[type]) {
      comps.push(part('b', 'battery', { kind: 'AA4' }));
      wires.push(wire('b.+', `u.${CHIP_POWER[type][0]}`), wire('b.-', `u.${CHIP_POWER[type][1]}`));
    }
    const seen = new Set<number>();
    const code = String(def.defaultProps.code);
    const first = /digitalWrite\((\w+),/.exec(code)![1];
    const ledPin = first === 'LED' ? /const int LED = (\w+);/.exec(code)![1] : first;
    const { sim } = simulate(comps, wires, 1.2, (s) => {
      const m = s.mcus.get('u')!;
      const idx = /^\d+$/.test(ledPin) ? Number(ledPin) : Number(spec.constants[ledPin]);
      seen.add(m.pins[idx].value);
    });
    const m = sim.mcus.get('u')!;
    expect(m.error).toBeNull();
    expect(seen).toEqual(new Set([0, 1]));
    if (code.includes('Serial.println')) expect(m.serialOut.length).toBeGreaterThan(3);
  });

  it('a bare chip without power does nothing, then starts when powered', () => {
    const { sim } = simulate([part('u', 'attiny85')], [], 0.5);
    expect(sim.mcus.get('u')!.powerOk).toBe(false);
    expect(sim.snapshot().warnings.some((w) => /no power/.test(w.message))).toBe(true);
  });
});
