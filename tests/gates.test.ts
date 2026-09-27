import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';

const TABLES: Record<string, (a: number, b: number, c: number) => number> = {
  'gate-not': (a) => 1 - a,
  'gate-buffer': (a) => a,
  'gate-and': (a, b) => a & b,
  'gate-or': (a, b) => a | b,
  'gate-nand': (a, b) => 1 - (a & b),
  'gate-nor': (a, b) => 1 - (a | b),
  'gate-xor': (a, b) => a ^ b,
  'gate-xnor': (a, b) => 1 - (a ^ b),
  'gate-and3': (a, b, c) => a & b & c,
  'gate-or3': (a, b, c) => a | b | c,
};
const INPUTS: Record<string, string[]> = { 'gate-not': ['A'], 'gate-buffer': ['A'], 'gate-and3': ['A', 'B', 'C'], 'gate-or3': ['A', 'B', 'C'] };

describe('logic gates', () => {
  it.each(Object.keys(TABLES))('%s follows its truth table (driven by logic inputs, read by a probe)', (type) => {
    const ins = INPUTS[type] ?? ['A', 'B'];
    for (let n = 0; n < 1 << ins.length; n++) {
      const bits = ins.map((_, i) => (n >> i) & 1);
      const pw = (id: string) => [wire('p.VBUS', `${id}.VCC`), wire('p.GND', `${id}.GND`)];
      const { snap, volts } = simulate(
        [part('p', 'usb-breakout'), part('g', type), part('q', 'logic-probe'), ...ins.map((pin, i) => part(`in${pin}`, 'logic-input', { on: bits[i] }))],
        [...pw('g'), ...pw('q'), ...ins.flatMap((pin) => [...pw(`in${pin}`), wire(`in${pin}.OUT`, `g.${pin}`)]), wire('g.Y', 'q.IN')],
        0.04,
      );
      const want = TABLES[type](bits[0], bits[1] ?? 0, bits[2] ?? 0);
      expect(volts('g:Y') - volts('p:GND') > 2.5 ? 1 : 0, `${type} ${bits.join('')}`).toBe(want);
      expect(snap.comps.q!.readouts![0], 'probe shows the value').toBe(want);
      expect(snap.comps.g!.levels![0] > 0.5 ? 1 : 0, 'the gate’s own output dot').toBe(want);
    }
  });

  it('a gate without power drives nothing', () => {
    const { volts } = simulate([part('p', 'usb-breakout'), part('g', 'gate-not'), part('r', 'resistor', { resistance: 10000 })], [wire('g.Y', 'r.1'), wire('r.2', 'p.GND')], 0.04);
    expect(volts('g:Y') - volts('p:GND')).toBeLessThan(0.1);
  });
});
