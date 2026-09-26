import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

const usb = () => part('p', 'usb-breakout');
const pw = (id: string) => [wire('p.VBUS', `${id}.VCC`), wire('p.GND', `${id}.GND`)];
const hi = (id: string, ...pins: string[]) => pins.map((q) => wire('p.VBUS', `${id}.${q}`));
const lo = (id: string, ...pins: string[]) => pins.map((q) => wire('p.GND', `${id}.${q}`));

describe('third batch: logic', () => {
  it('74HC10 NAND3 is LOW only with all three inputs HIGH', () => {
    const { volts } = simulate([usb(), part('g', '74hc10')], [...pw('g'), ...hi('g', 'A1', 'B1', 'C1', 'A2', 'B2'), ...lo('g', 'C2')], 0.05);
    expect(volts('g:Y1') - volts('g:GND')).toBeLessThan(0.5);
    expect(volts('g:Y2') - volts('g:GND')).toBeGreaterThan(4);
  });

  it('74HC157 routes A or B by the select pin', () => {
    const { volts } = simulate([usb(), part('m', '74hc157')], [...pw('m'), ...lo('m', 'E', 'S', 'B1'), ...hi('m', 'A1')], 0.05);
    expect(volts('m:Y1') - volts('m:GND')).toBeGreaterThan(4);
    const r2 = simulate([usb(), part('m', '74hc157')], [...pw('m'), ...lo('m', 'E', 'B1'), ...hi('m', 'S', 'A1')], 0.05);
    expect(r2.volts('m:Y1') - r2.volts('m:GND')).toBeLessThan(0.5);
  });

  it('CD4511 shows a 5 (segments a c d f g)', () => {
    const { volts } = simulate([usb(), part('d', 'cd4511')], [...pw('d'), ...hi('d', 'A', 'C', 'LT', 'BI'), ...lo('d', 'B', 'D', 'LE')], 0.05);
    const on = (s: string) => volts(`d:${s}`) - volts('d:GND') > 2.5;
    expect(['SA', 'SB', 'SC', 'SD', 'SE', 'SF', 'SG'].map(on)).toEqual([true, false, true, true, false, true, true]);
  });

  it('74HC393 counts falling clock edges in binary', () => {
    const code = `void setup(){ pinMode(2, OUTPUT); for (int i = 0; i < 5; i++) { digitalWrite(2, HIGH); delayMicroseconds(200); digitalWrite(2, LOW); delayMicroseconds(200); } } void loop(){}`;
    const { volts } = simulate([part('u', 'arduino-uno', { code }), part('c', '74hc393')], [wire('u.5V', 'c.VCC'), wire('u.GND1', 'c.GND'), wire('u.D2', 'c.CP1'), wire('u.GND2', 'c.MR1')], 0.1);
    const q = (b: number) => (volts(`c:Q${b}1`) - volts('c:GND') > 2.5 ? 1 : 0);
    expect(q(0) + 2 * q(1) + 4 * q(2) + 8 * q(3)).toBe(5);
  });

  it('74HC283 adds 9 + 9 = 18 (sum 2, carry out)', () => {
    const { volts } = simulate([usb(), part('a', '74hc283')], [...pw('a'), ...hi('a', 'A1', 'A4', 'B1', 'B4'), ...lo('a', 'A2', 'A3', 'B2', 'B3', 'CI')], 0.05);
    const b = (p: string) => (volts(`a:${p}`) - volts('a:GND') > 2.5 ? 1 : 0);
    expect([b('S1'), b('S2'), b('S3'), b('S4'), b('CO')]).toEqual([0, 1, 0, 0, 1]);
  });

  it('74HC245 copies A to B when DIR is HIGH', () => {
    const { volts } = simulate([usb(), part('t', '74hc245')], [...pw('t'), ...hi('t', 'DIR', 'A3'), ...lo('t', 'OE', 'A4')], 0.05);
    expect(volts('t:B3') - volts('t:GND')).toBeGreaterThan(4.5);
    expect(volts('t:B4') - volts('t:GND')).toBeLessThan(0.5);
  });
});

describe('third batch: analog, power & discretes', () => {
  it('ULN2803 sinks a load when its input is HIGH', () => {
    const { volts } = simulate(
      [usb(), part('u', 'uln2803'), part('r', 'resistor', { resistance: 100, power: 1 })],
      [...hi('u', 'I1', 'COM'), ...lo('u', 'GND'), wire('p.VBUS', 'r.1'), wire('r.2', 'u.O1')],
      0.05,
    );
    expect(volts('u:O1') - volts('u:GND')).toBeLessThan(0.3);
  });

  it('HT7333 makes 3.3 V from 5 V', () => {
    const { volts } = simulate([usb(), part('u', 'ht7333'), part('r', 'resistor', { resistance: 330 })], [wire('p.VBUS', 'u.IN'), wire('p.GND', 'u.GND'), wire('u.OUT', 'r.1'), wire('r.2', 'p.GND')], 0.05);
    expect(volts('u:OUT') - volts('u:GND')).toBeCloseTo(3.3, 1);
  });

  it('2N7000 switches an LED on from a 5 V gate', () => {
    const run = (gate: 'VBUS' | 'GND') => simulate(
      [usb(), part('q', '2n7000'), part('r', 'resistor', { resistance: 220 }), part('l', 'led')],
      [wire('p.VBUS', 'r.1'), wire('r.2', 'l.A'), wire('l.K', 'q.D'), wire('q.S', 'p.GND'), wire(`p.${gate}`, 'q.G')],
      0.05,
    ).snap.comps.l!.current!;
    expect(run('VBUS')).toBeGreaterThan(0.01);
    expect(run('GND')).toBeLessThan(0.0005);
  });

  it('the bench supply limits the current into a heavy load', () => {
    const { snap, volts } = simulate([part('s', 'lab-psu', { vset: 10, ilim: 0.1 }), part('r', 'resistor', { resistance: 10, power: 5 })], [wire('s.P', 'r.1'), wire('r.2', 's.N')], 0.2);
    expect(snap.comps.s!.readouts![1]).toBeCloseTo(0.1, 2);
    expect(volts('s:P') - volts('s:N')).toBeCloseTo(1, 1);
    expect(snap.comps.s!.levels![0]).toBeGreaterThan(0.5);
  });

  it('the bench supply gives its set voltage below the limit', () => {
    const { volts } = simulate([part('s', 'lab-psu', { vset: 12, ilim: 1 }), part('r', 'resistor', { resistance: 1000 })], [wire('s.P', 'r.1'), wire('r.2', 's.N')], 0.2);
    expect(volts('s:P') - volts('s:N')).toBeCloseTo(12, 1);
  });

  it('ICL7660 turns +5 V into −5 V', () => {
    const { volts } = simulate([usb(), part('c', 'icl7660'), part('r', 'resistor', { resistance: 10000 })], [...pw('c'), wire('c.VOUT', 'r.1'), wire('r.2', 'p.GND')], 0.05);
    expect(volts('c:VOUT') - volts('c:GND')).toBeLessThan(-4.8);
  });

  it('B0505S gives an isolated 5 V', () => {
    const { volts } = simulate(
      [usb(), part('b', 'b0505s'), part('r', 'resistor', { resistance: 100 })],
      [wire('p.VBUS', 'b.VIN'), wire('p.GND', 'b.GND'), wire('b.OUTP', 'r.1'), wire('r.2', 'b.OUTN')],
      0.05,
    );
    expect(volts('b:OUTP') - volts('b:OUTN')).toBeGreaterThan(4.7);
    expect(volts('b:OUTP') - volts('b:OUTN')).toBeLessThan(5.3);
  });

  it('the analog voltmeter needle settles at V / full scale', () => {
    const { snap } = simulate([part('b', 'battery'), part('m', 'analog-voltmeter', { fs: 15 })], [wire('b.+', 'm.P'), wire('b.-', 'm.N')], 1.5);
    expect(snap.comps.m!.vars!.nd).toBeCloseTo(9 / 15, 1);
  });

  it('a 5 kg load cell gives 1 mV/V across its signal wires', () => {
    const { volts } = simulate([usb(), part('c', 'load-cell', { kg: 5 })], [wire('p.VBUS', 'c.EP'), wire('p.GND', 'c.EN')], 0.05);
    expect((volts('c:SP') - volts('c:SN')) * 1000).toBeCloseTo(5, 0);
  });

  it('the self-flashing LED blinks by itself', () => {
    const doc: CircuitDoc = { version: 1, name: 't', components: [usb(), part('r', 'resistor', { resistance: 100 }), part('l', 'flashing-led')], wires: [wire('p.VBUS', 'r.1'), wire('r.2', 'l.A'), wire('l.K', 'p.GND')] };
    const sim = new Simulator(doc);
    sim.start();
    const seen = new Set<boolean>();
    for (let i = 0; i < 60; i++) {
      sim.advance(0.02);
      seen.add((sim.snapshot().comps.l!.levels![0] ?? 0) > 0.5);
    }
    expect([...seen].sort()).toEqual([false, true]);
  });

  it('the anemometer closes once per turn: 24 km/h → 10 pulses a second', () => {
    const doc: CircuitDoc = { version: 1, name: 't', components: [usb(), part('a', 'anemometer', { wind: 24 }), part('r', 'resistor', { resistance: 10000 })], wires: [wire('p.VBUS', 'r.1'), wire('r.2', 'a.1'), wire('a.2', 'p.GND')] };
    const sim = new Simulator(doc);
    sim.start();
    let n = 0, last = true;
    for (let i = 0; i < 500; i++) {
      sim.advance(0.002);
      const s = sim.snapshot();
      const high = s.netVolts[s.netOfPin.get('a:1')!] - s.netVolts[s.netOfPin.get('p:GND')!] > 2.5;
      if (!high && last) n++;
      last = high;
    }
    expect(n).toBeGreaterThanOrEqual(9);
    expect(n).toBeLessThanOrEqual(11);
  });

  it('the 3-position slide switch connects C to the selected pin', () => {
    const { volts } = simulate(
      [usb(), part('s', 'slide-switch-3', { pos: 2 }), part('r1', 'resistor', { resistance: 10000 }), part('r3', 'resistor', { resistance: 10000 })],
      [wire('p.VBUS', 's.C'), wire('s.1', 'r1.1'), wire('r1.2', 'p.GND'), wire('s.3', 'r3.1'), wire('r3.2', 'p.GND')],
      0.05,
    );
    expect(volts('s:3') - volts('p:GND')).toBeGreaterThan(4.9);
    expect(volts('s:1') - volts('p:GND')).toBeLessThan(0.1);
  });

  it('a 555 at ~1 kHz keeps its timing with the adaptive step (counted by a 74HC393)', () => {
    // f = 1.44 / ((1 k + 2 × 6.8 k) × 100 nF) ≈ 986 Hz; the two counters are chained to count to 255
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [usb(), part('t', 'ne555'), part('r1', 'resistor', { resistance: 1000 }), part('r2', 'resistor', { resistance: 6800 }), part('c', 'capacitor', { capacitance: 100e-9 }), part('n', '74hc393')],
      wires: [
        wire('p.VBUS', 't.VCC'), wire('p.VBUS', 't.RESET'), wire('p.GND', 't.GND'), wire('p.VBUS', 'r1.1'), wire('r1.2', 't.DIS'), wire('t.DIS', 'r2.1'),
        wire('r2.2', 't.THR'), wire('t.THR', 't.TRIG'), wire('t.TRIG', 'c.1'), wire('c.2', 'p.GND'),
        ...pw('n'), wire('t.OUT', 'n.CP1'), wire('n.Q31', 'n.CP2'), ...lo('n', 'MR1', 'MR2'),
      ],
    };
    const sim = new Simulator(doc);
    sim.start();
    while (sim.time < 0.2 - 1e-6) sim.advance(0.2 - sim.time);   // not limited by the per-frame CPU budget
    const v = sim.snapshot().comps.n!.vars!;
    const hz = (v.c1 + 16 * v.c2) / sim.time;
    // within ~15 % of the textbook value (the model's 50 µs step floor stretches each half-period slightly)
    expect(hz).toBeGreaterThan(830);
    expect(hz).toBeLessThan(1000);
  });

  it('the siren wails while powered', () => {
    const { snap } = simulate([part('b', 'battery'), part('z', 'siren')], [wire('b.+', 'z.P'), wire('b.-', 'z.N')], 0.05);
    expect(snap.comps.z!.freq).toBeGreaterThan(1000);
  });
});
