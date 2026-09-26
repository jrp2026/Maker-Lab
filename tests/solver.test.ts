import { describe, expect, it } from 'vitest';
import { Bjt, Capacitor, Circuit, Diode, Resistor, Source } from '../src/sim/solver';

describe('MNA solver', () => {
  it('solves a voltage divider', () => {
    // node0 = +, node1 = mid, node2 = gnd(-)
    const c = new Circuit(3);
    c.add(new Source(0, 2, 9, 0.001));
    c.add(new Resistor(0, 1, 1000));
    c.add(new Resistor(1, 2, 2000));
    c.step(1e-3);
    expect(c.v[1] - c.v[2]).toBeCloseTo(6, 3);
  });

  it('solves LED + resistor with a realistic forward voltage', () => {
    const c = new Circuit(3);
    c.add(new Source(0, 2, 5, 25));
    const r = c.add(new Resistor(0, 1, 220));
    const is = 0.02 / Math.exp(1.8 / (2 * 0.025852));
    const d = c.add(new Diode(1, 2, { is, n: 2 }));
    for (let i = 0; i < 3; i++) c.step(1e-3);
    const vd = c.v[1] - c.v[2];
    const i = r.currents(c.v)[0];
    expect(vd).toBeGreaterThan(1.6);
    expect(vd).toBeLessThan(1.85);
    expect(i * 1000).toBeGreaterThan(12);
    expect(i * 1000).toBeLessThan(14.5);
    expect(d.currents(c.v)[0]).toBeCloseTo(i, 6);
  });

  it('charges an RC circuit with the right time constant', () => {
    const c = new Circuit(3);
    c.add(new Source(0, 2, 5, 0.001));
    c.add(new Resistor(0, 1, 1000));
    c.add(new Capacitor(1, 2, 100e-6));
    const h = 1e-4;
    for (let t = 0; t < 0.1 - 1e-9; t += h) c.step(h); // one tau
    const v = c.v[1] - c.v[2];
    expect(v).toBeGreaterThan(5 * 0.62);
    expect(v).toBeLessThan(5 * 0.645);
  });

  it('switches an NPN transistor into saturation', () => {
    // 5V -> 1k -> collector ; base via 10k from 5V ; emitter gnd
    const c = new Circuit(4); // 0=vcc 1=collector 2=base 3=gnd
    c.add(new Source(0, 3, 5, 0.001));
    c.add(new Resistor(0, 1, 1000));
    c.add(new Resistor(0, 2, 10000));
    const q = c.add(new Bjt(1, 2, 3, { pnp: false, is: 1e-14, bf: 200, br: 3 }));
    for (let i = 0; i < 3; i++) expect(c.step(1e-3)).toBe(true);
    const vce = c.v[1] - c.v[3];
    const vbe = c.v[2] - c.v[3];
    expect(vce).toBeLessThan(0.3);
    expect(vbe).toBeGreaterThan(0.6);
    expect(vbe).toBeLessThan(0.8);
    const [ic, ib, ie] = q.currents(c.v);
    expect(ic + ib + ie).toBeCloseTo(0, 9);
  });

  it('keeps an NPN in its active region with beta gain', () => {
    const c = new Circuit(4);
    c.add(new Source(0, 3, 10, 0.001));
    c.add(new Resistor(0, 1, 100));
    c.add(new Resistor(0, 2, 1e6));
    const q = c.add(new Bjt(1, 2, 3, { pnp: false, is: 1e-14, bf: 100, br: 1 }));
    for (let i = 0; i < 3; i++) c.step(1e-3);
    const [ic, ib] = q.currents(c.v);
    expect(ic / ib).toBeGreaterThan(95);
    expect(ic / ib).toBeLessThan(101);
  });

  it('handles PNP polarity', () => {
    const c = new Circuit(4); // 0=vcc 1=collector 2=base 3=gnd
    c.add(new Source(0, 3, 5, 0.001));
    c.add(new Resistor(1, 3, 1000)); // load from collector to ground
    c.add(new Resistor(2, 3, 10000)); // base pulled low → on
    c.add(new Bjt(1, 2, 0, { pnp: true, is: 1e-14, bf: 180, br: 3 }));
    for (let i = 0; i < 3; i++) c.step(1e-3);
    expect(c.v[1] - c.v[3]).toBeGreaterThan(4.6);
  });

  it('survives floating sub-circuits', () => {
    const c = new Circuit(4);
    c.add(new Source(0, 1, 3, 1));
    c.add(new Resistor(2, 3, 100)); // floating resistor island
    expect(c.step(1e-3)).toBe(true);
    expect(Number.isFinite(c.v[2])).toBe(true);
  });
});
