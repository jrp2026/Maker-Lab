import { describe, expect, it } from 'vitest';
import { Circuit, Comparator, Inductor, Mosfet, OpAmp, Resistor, Source, Transformer, BehaviouralSource } from '../src/sim/solver';

const steps = (c: Circuit, n: number, h = 1e-3) => {
  for (let i = 0; i < n; i++) expect(c.step(h)).toBe(true);
};

describe('new solver primitives', () => {
  it('NMOS low-side switch turns a load on and off', () => {
    // 0 = +12, 1 = drain, 2 = gate, 3 = gnd
    const c = new Circuit(4);
    c.add(new Source(0, 3, 12, 0.01));
    c.add(new Resistor(0, 1, 100));
    const gate = c.add(new Source(2, 3, 5, 10));
    const m = c.add(new Mosfet(1, 2, 3, { pmos: false, vth: 2, k: 2 }));
    steps(c, 3);
    expect(m.currents(c.v)[0]).toBeGreaterThan(0.115);
    gate.volts = 0;
    steps(c, 3);
    expect(Math.abs(m.currents(c.v)[0])).toBeLessThan(1e-4);
  });

  it('PMOS high-side switch', () => {
    // 0 = +5, 1 = drain(load), 2 = gate, 3 = gnd; source at +5
    const c = new Circuit(4);
    c.add(new Source(0, 3, 5, 0.01));
    const gate = c.add(new Source(2, 3, 0, 10));
    c.add(new Mosfet(1, 2, 0, { pmos: true, vth: 1.5, k: 1 }));
    c.add(new Resistor(1, 3, 100));
    steps(c, 3);
    expect(c.v[1] - c.v[3]).toBeGreaterThan(4.8);
    gate.volts = 5;
    steps(c, 3);
    expect(c.v[1] - c.v[3]).toBeLessThan(0.05);
  });

  it('op-amp inverting amplifier has gain −10 and clips at the rails', () => {
    // 0 = +12, 1 = in, 2 = inv, 3 = out, 4 = gnd, 5 = -12
    const c = new Circuit(6);
    c.add(new Source(0, 4, 12, 0.01));
    c.add(new Source(4, 5, 12, 0.01));
    const vin = c.add(new Source(1, 4, 0.5, 0.01));
    c.add(new Resistor(1, 2, 1000));
    c.add(new Resistor(2, 3, 10000));
    c.add(new OpAmp(4, 2, 3, 0, 5, { gain: 1e5, dropHigh: 1.5, dropLow: 1.5, rout: 50 }));
    steps(c, 3);
    expect(c.v[3] - c.v[4]).toBeCloseTo(-5, 2);
    vin.volts = -2;
    steps(c, 3);
    expect(c.v[3] - c.v[4]).toBeGreaterThan(10.3);
    expect(c.v[3] - c.v[4]).toBeLessThan(10.6);
  });

  it('comparator output pulls low only when in+ < in−', () => {
    // 0 = +5, 1 = in+, 2 = in-, 3 = out (10k pull-up), 4 = gnd
    const c = new Circuit(5);
    c.add(new Source(0, 4, 5, 0.01));
    const a = c.add(new Source(1, 4, 2, 1));
    c.add(new Source(2, 4, 2.5, 1));
    c.add(new Resistor(0, 3, 10000));
    c.add(new Comparator(1, 2, 3, 4));
    steps(c, 2);
    expect(c.v[3] - c.v[4]).toBeLessThan(0.2);
    a.volts = 3;
    steps(c, 2);
    expect(c.v[3] - c.v[4]).toBeGreaterThan(4.9);
  });

  it('RL circuit reaches 63% of the final current after L/R', () => {
    const c = new Circuit(3);
    c.add(new Source(0, 2, 10, 0.001));
    c.add(new Resistor(0, 1, 10));
    const l = c.add(new Inductor(1, 2, 0.1)); // tau = 10 ms
    for (let i = 0; i < 100; i++) c.step(1e-4);
    expect(l.currents()[0]).toBeGreaterThan(0.61);
    expect(l.currents()[0]).toBeLessThan(0.645);
  });

  it('transformer steps 50 Hz AC down by the turns ratio', () => {
    // primary 0-1 driven by 230*sqrt2 sine, secondary 2-3 into 1k; turns ratio 20:1 → L ratio 400
    const c = new Circuit(4);
    let t = 0;
    c.add(new BehaviouralSource(0, 1, () => 325 * Math.sin(2 * Math.PI * 50 * t), 0.1));
    c.add(new Transformer(0, 1, 2, 3, 10, 10 / 400, 0.999));
    c.add(new Resistor(2, 3, 1000));
    c.add(new Resistor(1, 3, 1e6));
    let peak = 0;
    for (let i = 0; i < 2000; i++) {
      t += 5e-5;
      c.step(5e-5);
      if (i > 1000) peak = Math.max(peak, Math.abs(c.v[2] - c.v[3]));
    }
    expect(peak).toBeGreaterThan(15);
    expect(peak).toBeLessThan(16.5);
  });
});
