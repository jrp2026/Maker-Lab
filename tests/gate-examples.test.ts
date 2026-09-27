import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

const build = (id: string): CircuitDoc => EXAMPLES.find((e) => e.id === id)!.build();
const inputs = (doc: CircuitDoc) => doc.components.filter((c) => c.type === 'logic-input');
const probes = (doc: CircuitDoc) => doc.components.filter((c) => c.type === 'logic-probe');

/** run `doc` with the inputs set to `bits`, return every probe's value (in document order) */
function evaluate(doc: CircuitDoc, bits: number[]): number[] {
  inputs(doc).forEach((c, i) => (c.props.on = bits[i]));
  const sim = new Simulator(doc);
  expect([...sim.start().values()]).toEqual([]);
  for (let i = 0; i < 4; i++) sim.advance(0.02);
  const snap = sim.snapshot();
  expect(snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
  return probes(doc).map((p) => snap.comps[p.id]!.readouts![0] as number);
}

const combos = (n: number) => Array.from({ length: 1 << n }, (_, k) => Array.from({ length: n }, (_, i) => (k >> (n - 1 - i)) & 1));

describe('logic gate examples compute what they say', () => {
  const cases: [string, number, (b: number[]) => number[]][] = [
    ['half-adder', 2, ([a, b]) => [a ^ b, a & b]],
    ['full-adder', 3, ([a, b, c]) => [(a + b + c) & 1, (a + b + c) >> 1]],
    ['mux-gates', 3, ([a, b, s]) => [s ? b : a]],
    ['majority', 3, ([a, b, c]) => [a + b + c >= 2 ? 1 : 0]],
    ['nand-xor', 2, ([a, b]) => [a ^ b]],
    ['alarm-gates', 3, ([d, w, armed]) => [(d | w) & armed]],
  ];
  it.each(cases)('%s truth table', (id, nIn, f) => {
    const doc = build(id);
    expect(inputs(doc).length).toBe(nIn);
    for (const bits of combos(nIn)) expect(evaluate(doc, bits), `${id} ${bits.join('')}`).toEqual(f(bits));
  });

  it('the burglar alarm buzzer sounds only when triggered', () => {
    for (const [bits, sounds] of [[[1, 0, 1], true], [[1, 0, 0], false], [[0, 0, 1], false]] as const) {
      const doc = build('alarm-gates');
      inputs(doc).forEach((c, i) => (c.props.on = bits[i]));
      const sim = new Simulator(doc);
      sim.start();
      for (let i = 0; i < 3; i++) sim.advance(0.02);
      const bz = doc.components.find((c) => c.type === 'active-buzzer')!.id;
      expect((sim.snapshot().comps[bz]!.freq ?? 0) > 0, bits.join('')).toBe(sounds);
    }
  });

  it('the SR latch remembers: set, hold, reset, hold', () => {
    const doc = build('sr-latch');
    const [S, R] = inputs(doc);
    const [qProbe, nqProbe] = probes(doc);
    const sim = new Simulator(doc);
    expect([...sim.start().values()]).toEqual([]);
    const step = (s: number, r: number) => {
      S.props.on = s;
      R.props.on = r;
      for (let i = 0; i < 4; i++) sim.advance(0.02);
      const snap = sim.snapshot();
      return [snap.comps[qProbe.id]!.readouts![0], snap.comps[nqProbe.id]!.readouts![0]];
    };
    expect(step(0, 1)).toEqual([0, 1]);   // starts reset
    expect(step(0, 0)).toEqual([0, 1]);   // holds 0
    expect(step(1, 0)).toEqual([1, 0]);   // set
    expect(step(0, 0)).toEqual([1, 0]);   // remembers 1
    expect(step(0, 1)).toEqual([0, 1]);   // reset
    expect(step(0, 0)).toEqual([0, 1]);   // remembers 0
  });
});
