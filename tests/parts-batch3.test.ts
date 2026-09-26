import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

const usb = () => part('p', 'usb-breakout');
const pw = (id: string) => [wire('p.VBUS', `${id}.VCC`), wire('p.GND', `${id}.GND`)];

describe('more logic & analog ICs', () => {
  it('74HC02 NOR truth table', () => {
    const { volts } = simulate(
      [usb(), part('g', '74hc02')],
      [...pw('g'), wire('p.GND', 'g.A1'), wire('p.GND', 'g.B1'), wire('p.VBUS', 'g.A2'), wire('p.GND', 'g.B2'), wire('p.VBUS', 'g.A3'), wire('p.VBUS', 'g.B3')],
      0.05,
    );
    const y = (n: number) => volts(`g:Y${n}`) - volts('g:GND');
    expect(y(1)).toBeGreaterThan(4);
    expect(y(2)).toBeLessThan(0.5);
    expect(y(3)).toBeLessThan(0.5);
  });

  it('74HC74 wired as divide-by-2 toggles once per rising clock edge', () => {
    const code = `void setup(){ pinMode(2, OUTPUT); for (int i = 0; i < 3; i++) { digitalWrite(2, HIGH); delayMicroseconds(200); digitalWrite(2, LOW); delayMicroseconds(200); } } void loop(){}`;
    const { volts } = simulate(
      [part('u', 'arduino-uno', { code }), part('f', '74hc74')],
      [wire('u.5V', 'f.VCC'), wire('u.GND1', 'f.GND'), wire('u.D2', 'f.CK1'), wire('f.QN1', 'f.D1')],
      0.1,
    );
    // three edges: 0 → 1 → 0 → 1 (CLR / PRE are pulled up inside)
    expect(volts('f:Q1') - volts('f:GND')).toBeGreaterThan(4);
    expect(volts('f:QN1') - volts('f:GND')).toBeLessThan(0.5);
  });

  it('74HC14 Schmitt inverter holds its state inside the hysteresis band', () => {
    const { volts, sim } = simulate(
      [usb(), part('g', '74hc14'), part('r1', 'resistor', { resistance: 10000 }), part('r2', 'resistor', { resistance: 10000 })],
      [...pw('g'), wire('p.VBUS', 'r1.1'), wire('r1.2', 'g.A1'), wire('g.A1', 'r2.1'), wire('r2.2', 'p.GND'), wire('p.VBUS', 'g.A2')],
      0.05,
    );
    // 2.5 V is between the 40 % and 60 % thresholds: the output keeps its power-on state (HIGH)
    expect(volts('g:Y1') - volts('g:GND')).toBeGreaterThan(4);
    expect(volts('g:Y2') - volts('g:GND')).toBeLessThan(0.5);
    expect(sim.snapshot().comps.g!.vars!.s2).toBe(1);
  });

  it('CD4066 passes a signal only through switches whose control is HIGH', () => {
    const { volts } = simulate(
      [usb(), part('s', 'cd4066'), part('r1', 'resistor', { resistance: 10000 }), part('r2', 'resistor', { resistance: 10000 })],
      [...pw('s'), wire('p.VBUS', 's.A1'), wire('s.B1', 'r1.1'), wire('r1.2', 'p.GND'), wire('p.VBUS', 's.C1'), wire('p.VBUS', 's.A2'), wire('s.B2', 'r2.1'), wire('r2.2', 'p.GND'), wire('p.GND', 's.C2')],
      0.05,
    );
    expect(volts('s:B1') - volts('s:GND')).toBeGreaterThan(4.8);
    expect(volts('s:B2') - volts('s:GND')).toBeLessThan(0.1);
  });

  it('LM324 voltage follower copies its input', () => {
    const { volts } = simulate(
      [usb(), part('a', 'lm324'), part('r1', 'resistor', { resistance: 10000 }), part('r2', 'resistor', { resistance: 10000 })],
      [...pw('a'), wire('p.VBUS', 'r1.1'), wire('r1.2', 'a.P1'), wire('a.P1', 'r2.1'), wire('r2.2', 'p.GND'), wire('a.O1', 'a.N1')],
      0.05,
    );
    expect(volts('a:O1') - volts('a:GND')).toBeCloseTo(2.5, 1);
  });

  it('TL431 with REF tied to K regulates at 2.5 V', () => {
    const { volts } = simulate(
      [part('b', 'battery'), part('r', 'resistor', { resistance: 1000 }), part('z', 'tl431')],
      [wire('b.+', 'r.1'), wire('r.2', 'z.K'), wire('z.K', 'z.REF'), wire('z.A', 'b.-')],
      0.05,
    );
    expect(volts('z:K') - volts('z:A')).toBeGreaterThan(2.45);
    expect(volts('z:K') - volts('z:A')).toBeLessThan(2.6);
  });

  it('7905 turns −9 V into −5 V', () => {
    const { volts } = simulate(
      [part('b', 'battery'), part('u', 'reg-79xx'), part('r', 'resistor', { resistance: 1000 })],
      [wire('b.+', 'u.GND'), wire('b.-', 'u.IN'), wire('u.OUT', 'r.1'), wire('r.2', 'u.GND')],
      0.05,
    );
    expect(volts('u:OUT') - volts('u:GND')).toBeCloseTo(-5, 1);
  });
});

describe('new outputs, inputs & modules', () => {
  it('a light bulb takes an inrush current, then settles at its rating', () => {
    const doc: CircuitDoc = { version: 1, name: 't', components: [part('b', 'battery-holder', { cells: 4 }), part('l', 'light-bulb', { vn: 6 })], wires: [wire('b.P', 'l.A'), wire('l.B', 'b.N')] };
    const sim = new Simulator(doc);
    sim.start();
    sim.advance(0.001);
    // cold filament: about ten times the rated current for the first moment
    expect(sim.snapshot().comps.l!.readouts![0]).toBeGreaterThan(0.8);
    for (let i = 0; i < 30; i++) sim.advance(0.02);
    const settled = sim.snapshot().comps.l!.readouts![0];
    expect(settled).toBeGreaterThan(0.15);
    expect(settled).toBeLessThan(0.22);
  });

  it('the traffic-light module lights only the colours driven HIGH', () => {
    const { snap } = simulate(
      [usb(), part('t', 'traffic-light')],
      [wire('p.VBUS', 't.R'), wire('p.GND', 't.Y'), wire('p.VBUS', 't.G'), wire('p.GND', 't.GND')],
      0.1,
    );
    const lv = snap.comps.t!.levels!;
    expect(lv[0]).toBeGreaterThan(0.5);
    expect(lv[1]).toBeLessThan(0.02);
    expect(lv[2]).toBeGreaterThan(0.5);
  });

  it('the 4-digit display lights a segment only on the digit whose cathode is LOW', () => {
    const { snap } = simulate(
      [usb(), part('d', 'seven-seg-4digit'), part('ra', 'resistor', { resistance: 220 })],
      [wire('p.VBUS', 'ra.1'), wire('ra.2', 'd.A'), wire('p.GND', 'd.D1'), wire('p.VBUS', 'd.D2'), wire('p.VBUS', 'd.D3'), wire('p.VBUS', 'd.D4')],
      0.1,
    );
    const v = snap.comps.d!.vars!;
    expect(v.b1A).toBeGreaterThan(0.9);
    expect(v.b2A).toBeLessThan(0.01);
    expect(v.b1B).toBeLessThan(0.01);
  });

  it('the panel voltmeter reads the yellow wire when powered', () => {
    const { snap } = simulate(
      [part('b', 'battery'), part('m', 'panel-voltmeter')],
      [wire('b.+', 'm.VCC'), wire('b.-', 'm.GND'), wire('b.+', 'm.VIN')],
      0.05,
    );
    expect(snap.comps.m!.readouts![0]).toBeGreaterThan(8.5);
    expect(snap.comps.m!.readouts![0]).toBeLessThan(9.1);
  });

  it.each([[80, false], [10, true]] as const)('soil moisture %i %%: DO high = %s', (moist, high) => {
    const { volts } = simulate([usb(), part('s', 'soil-moisture', { moist })], pw('s'), 0.05);
    expect(volts('s:DO') - volts('s:GND') > 2.5).toBe(high);
  });

  it('a phototransistor pulls its collector down in bright light', () => {
    const run = (lux: number) =>
      simulate([usb(), part('q', 'phototransistor', { lux }), part('r', 'resistor', { resistance: 10000 })], [wire('p.VBUS', 'r.1'), wire('r.2', 'q.C'), wire('q.E', 'p.GND')], 0.05);
    const volts = (lux: number) => { const r = run(lux); return r.volts('q:C') - r.volts('p:GND'); };
    expect(volts(0)).toBeGreaterThan(4.5);
    expect(volts(2000)).toBeLessThan(0.5);
  });

  it('a lit photodiode pushes its photocurrent out of the anode (reverse-biased use)', () => {
    const run = (light: number) => {
      const { volts } = simulate([usb(), part('d', 'photodiode', { light }), part('r', 'resistor', { resistance: 10000 })], [wire('p.VBUS', 'd.K'), wire('d.A', 'r.1'), wire('r.2', 'p.GND')], 0.05);
      return volts('d:A') - volts('p:GND');
    };
    expect(run(0)).toBeLessThan(0.01);
    // 100 µA × 10 kΩ
    expect(run(1)).toBeCloseTo(1, 1);
  });

  it('the 1×4 keypad connects the chosen key to COMMON while pressed', () => {
    const { sim } = simulate(
      [usb(), part('k', 'keypad-1x4', { key: 3 }), part('r3', 'resistor', { resistance: 10000 }), part('r1', 'resistor', { resistance: 10000 })],
      [wire('k.COM', 'p.GND'), wire('p.VBUS', 'r3.1'), wire('r3.2', 'k.K3'), wire('p.VBUS', 'r1.1'), wire('r1.2', 'k.K1')],
      0.05,
    );
    sim.input('k').pressed = true;
    sim.advance(0.04);
    const s = sim.snapshot();
    const v = (k: string) => s.netVolts[s.netOfPin.get(k)!] - s.netVolts[s.netOfPin.get('k:COM')!];
    expect(v('k:K3')).toBeLessThan(0.3);
    expect(v('k:K1')).toBeGreaterThan(4.5);
  });

  it('the water-flow sensor pulses at 7.5 Hz per L/min', () => {
    const doc: CircuitDoc = { version: 1, name: 't', components: [usb(), part('f', 'water-flow', { flow: 10 })], wires: pw('f') };
    const sim = new Simulator(doc);
    sim.start();
    let edges = 0, last = false;
    for (let i = 0; i < 1000; i++) {
      sim.advance(0.001);
      const s = sim.snapshot();
      const hi = s.netVolts[s.netOfPin.get('f:SIG')!] - s.netVolts[s.netOfPin.get('f:GND')!] > 2.5;
      if (hi && !last) edges++;
      last = hi;
    }
    expect(edges).toBeGreaterThanOrEqual(73);
    expect(edges).toBeLessThanOrEqual(77);
  });

  it('a CR2032 sags under a 100 Ω load', () => {
    const { volts } = simulate([part('c', 'coin-cell'), part('r', 'resistor', { resistance: 100 })], [wire('c.P', 'r.1'), wire('r.2', 'c.N')], 0.05);
    expect(volts('c:P') - volts('c:N')).toBeGreaterThan(2.5);
    expect(volts('c:P') - volts('c:N')).toBeLessThan(2.8);
  });

  it('the AMS1117 module makes 3.3 V from 5 V', () => {
    const { volts } = simulate(
      [usb(), part('m', 'reg-3v3-module'), part('r', 'resistor', { resistance: 100, power: 1 })],
      [wire('p.VBUS', 'm.IN'), wire('p.GND', 'm.GND'), wire('m.OUT', 'r.1'), wire('r.2', 'p.GND')],
      0.05,
    );
    expect(volts('m:OUT') - volts('m:GND')).toBeCloseTo(3.3, 1);
  });

  it('the active buzzer beeps at 2.3 kHz on plain DC', () => {
    const { snap } = simulate([usb(), part('z', 'active-buzzer')], [wire('p.VBUS', 'z.P'), wire('z.N', 'p.GND')], 0.05);
    expect(snap.comps.z!.freq).toBe(2300);
  });

  it('a 5 V fan spins up to several thousand rpm', () => {
    const { snap } = simulate([usb(), part('f', 'dc-fan')], [wire('p.VBUS', 'f.P'), wire('f.N', 'p.GND')], 3);
    expect(snap.comps.f!.readouts![0]).toBeGreaterThan(4000);
  });
});
