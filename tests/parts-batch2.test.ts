import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';
import type { Simulator } from '../src/sim/simulator';

const vars = (sim: Simulator, id: string): Record<string, number> => (sim as any).persist.get(id).vars;
const V = (sim: Simulator, a: string, b: string) => {
  const s = sim.snapshot();
  return s.netVolts[s.netOfPin.get(a)!] - s.netVolts[s.netOfPin.get(b)!];
};
/** 12 V from a barrel-jack adapter: pins j.TIP (+) / j.SLV (−) */
const jack12 = () => part('j', 'barrel-jack', { volts: 12 });

describe('analog & logic ICs', () => {
  it('555 astable blinks at ~1.44/((R1+2R2)C)', () => {
    let edges = 0, last = 0;
    simulate(
      [part('b', 'battery'), part('t', 'ne555'), part('r1', 'resistor', { resistance: 1000 }), part('r2', 'resistor', { resistance: 10000 }), part('c', 'electrolytic', { capacitance: 10e-6 })],
      [wire('b.+', 't.VCC'), wire('b.+', 't.RESET'), wire('b.-', 't.GND'), wire('b.+', 'r1.1'), wire('r1.2', 't.DIS'), wire('t.DIS', 'r2.1'), wire('r2.2', 't.THR'), wire('t.THR', 't.TRIG'), wire('t.THR', 'c.+'), wire('c.-', 'b.-')],
      1.5,
      (sim, t) => {
        const hi = V(sim, 't:OUT', 't:GND') > 3 ? 1 : 0;
        if (t > 0.5 && hi && !last) edges++;
        last = hi;
      },
    );
    // f ≈ 6.9 Hz → ~7 rising edges per second (sampled every 20 ms)
    expect(edges).toBeGreaterThanOrEqual(5);
    expect(edges).toBeLessThanOrEqual(9);
  });

  it('LM358 non-inverting amplifier has gain 1 + Rf/Rg', () => {
    const { volts } = simulate(
      [part('b', 'battery'), part('a', 'battery', { kind: 'AA2' }), part('u', 'lm358'), part('rf', 'resistor', { resistance: 10000 }), part('rg', 'resistor', { resistance: 10000 }), part('ri', 'resistor', { resistance: 10000 }), part('rd', 'resistor', { resistance: 10000 })],
      [
        wire('b.+', 'u.VCC'), wire('b.-', 'u.GND'),
        // 1.5 V into IN+ via a divider from the 3 V pack
        wire('a.+', 'ri.1'), wire('ri.2', 'u.IN1P'), wire('u.IN1P', 'rd.1'), wire('rd.2', 'b.-'), wire('a.-', 'b.-'),
        wire('u.OUT1', 'rf.1'), wire('rf.2', 'u.IN1N'), wire('u.IN1N', 'rg.1'), wire('rg.2', 'b.-'),
      ],
      0.05,
    );
    expect(volts('u:OUT1') - volts('u:GND')).toBeCloseTo(2 * (volts('u:IN1P') - volts('u:GND')), 1);
  });

  it('74HC00 NAND truth table', () => {
    const { volts } = simulate(
      [part('p', 'usb-breakout'), part('g', '74hc00')],
      [wire('p.VBUS', 'g.VCC'), wire('p.GND', 'g.GND'), wire('p.VBUS', 'g.A1'), wire('p.GND', 'g.B1'), wire('p.VBUS', 'g.A2'), wire('p.VBUS', 'g.B2'), wire('p.GND', 'g.A3'), wire('p.GND', 'g.B3')],
      0.05,
    );
    const y = (n: number) => volts(`g:Y${n}`) - volts('g:GND');
    expect(y(1)).toBeGreaterThan(4);
    expect(y(2)).toBeLessThan(0.5);
    expect(y(3)).toBeGreaterThan(4);
  });

  it('CD4017 counts clock edges written by an Arduino', () => {
    const code = `void setup(){ pinMode(2, OUTPUT); for (int i = 0; i < 3; i++) { digitalWrite(2, HIGH); delayMicroseconds(50); digitalWrite(2, LOW); delayMicroseconds(50); } } void loop(){}`;
    const { volts } = simulate(
      [part('u', 'arduino-uno', { code }), part('c', 'cd4017')],
      [wire('u.5V', 'c.VCC'), wire('u.GND1', 'c.GND'), wire('u.D2', 'c.CLK'), wire('u.GND2', 'c.RST'), wire('u.GND2', 'c.INH')],
      0.1,
    );
    expect(volts('c:Q3') - volts('c:GND')).toBeGreaterThan(4);
    expect(volts('c:Q0') - volts('c:GND')).toBeLessThan(0.5);
  });

  it('74HC4051 routes the selected channel', () => {
    const { volts } = simulate(
      [part('p', 'usb-breakout'), part('m', '74hc4051'), part('r', 'resistor', { resistance: 1000 })],
      [wire('p.VBUS', 'm.VCC'), wire('p.GND', 'm.GND'), wire('p.GND', 'm.VEE'), wire('p.GND', 'm.E'), wire('p.VBUS', 'm.S0'), wire('p.VBUS', 'm.S1'), wire('p.GND', 'm.S2'), wire('p.VBUS', 'm.Y3'), wire('m.Z', 'r.1'), wire('r.2', 'p.GND')],
      0.05,
    );
    expect(volts('m:Z') - volts('m:GND')).toBeGreaterThan(4.3);
  });
});

describe('sensors & displays', () => {
  it('TMP36 gives 750 mV at 25 °C', () => {
    const { volts } = simulate([part('p', 'usb-breakout'), part('t', 'tmp36')], [wire('p.VBUS', 't.VS'), wire('p.GND', 't.GND')], 0.05);
    expect(volts('t:VOUT') - volts('t:GND')).toBeCloseTo(0.75, 2);
  });

  it('seven-segment (CC) lights a segment through a resistor', () => {
    const { snap } = simulate(
      [part('p', 'usb-breakout'), part('d', 'seven-seg-cc'), part('r', 'resistor', { resistance: 220 })],
      [wire('p.VBUS', 'r.1'), wire('r.2', 'd.A'), wire('d.COM1', 'p.GND')],
      0.05,
    );
    expect(snap.comps.r!.current).toBeGreaterThan(0.01);
    expect(snap.comps.r!.current).toBeLessThan(0.02);
  });

  it('rotary encoder produces one CLK pulse per click', () => {
    const { sim } = simulate(
      [part('p', 'usb-breakout'), part('e', 'rotary-encoder', { pos: 1 })],
      [wire('p.VBUS', 'e.VCC'), wire('p.GND', 'e.GND')],
      0.1,
    );
    expect(vars(sim, 'e').ph).toBe(4);
    expect(V(sim, 'e:CLK', 'e:GND')).toBeGreaterThan(4);
    expect(V(sim, 'e:DT', 'e:GND')).toBeGreaterThan(4);
  });

  it('logic-level converter pulls the 5 V side low when the 3.3 V side is low', () => {
    const { volts } = simulate(
      [part('p', 'usb-breakout'), part('l', 'logic-level-converter'), part('a', 'ams1117', { vout: 3.3 })],
      [wire('p.VBUS', 'l.HV'), wire('p.GND', 'l.GND'), wire('p.VBUS', 'a.IN'), wire('p.GND', 'a.GND'), wire('a.OUT', 'l.LV'), wire('l.LV1', 'p.GND')],
      0.05,
    );
    expect(volts('l:HV1') - volts('l:GND')).toBeLessThan(0.8);
    expect(volts('l:HV2') - volts('l:GND')).toBeGreaterThan(4.5);
    expect(volts('l:LV2') - volts('l:GND')).toBeGreaterThan(3.0);
    expect(volts('l:LV2') - volts('l:GND')).toBeLessThan(3.5);
  });
});

describe('power', () => {
  it('7805 regulates 12 V down to 5 V', () => {
    const { volts } = simulate(
      [jack12(), part('u', 'reg-78xx'), part('r', 'resistor', { resistance: 100, power: 1 })],
      [wire('j.TIP', 'u.IN'), wire('j.SLV', 'u.GND'), wire('u.OUT', 'r.1'), wire('r.2', 'j.SLV')],
      0.05,
    );
    expect(volts('u:OUT') - volts('u:GND')).toBeGreaterThan(4.8);
    expect(volts('u:OUT') - volts('u:GND')).toBeLessThan(5.2);
  });

  it('LM317 follows 1.25 × (1 + R2/R1)', () => {
    const { volts } = simulate(
      [jack12(), part('u', 'lm317'), part('r1', 'resistor', { resistance: 240 }), part('r2', 'resistor', { resistance: 720 })],
      [wire('j.TIP', 'u.IN'), wire('u.OUT', 'r1.1'), wire('r1.2', 'u.ADJ'), wire('u.ADJ', 'r2.1'), wire('r2.2', 'j.SLV')],
      0.05,
    );
    expect(volts('u:OUT') - volts('j:SLV')).toBeGreaterThan(4.7);
    expect(volts('u:OUT') - volts('j:SLV')).toBeLessThan(5.3);
  });

  it('buck converter: 12 V → 5 V and the input draws less current than the output', () => {
    const { volts, snap } = simulate(
      [jack12(), part('b', 'buck-converter', { vset: 5 }), part('r', 'resistor', { resistance: 10, power: 5 }), part('m', 'resistor', { resistance: 0.01, power: 5 })],
      [wire('j.TIP', 'm.1'), wire('m.2', 'b.INP'), wire('j.SLV', 'b.INN'), wire('b.OUTP', 'r.1'), wire('r.2', 'b.OUTN')],
      0.05,
    );
    expect(volts('b:OUTP') - volts('b:OUTN')).toBeCloseTo(5, 1);
    const iout = snap.comps.r!.current, iin = snap.comps.m!.current;
    expect(iin).toBeGreaterThan(0.15);
    expect(iin).toBeLessThan(iout * 0.6);
  });

  it('TP4056 charges a half-empty LiPo at its set current', () => {
    const { sim } = simulate(
      [part('p', 'usb-breakout'), part('c', 'tp4056'), part('bat', 'lipo', { charge: 50 })],
      [wire('p.VBUS', 'c.INP'), wire('p.GND', 'c.INN'), wire('c.BP', 'bat.P'), wire('c.BN', 'bat.N')],
      0.2,
    );
    expect(vars(sim, 'bat').soc).toBeGreaterThan(0.5);
  });

  it('a fuse blows on a sustained overload', () => {
    const { sim } = simulate(
      [jack12(), part('f', 'fuse', { rating: 0.5 }), part('r', 'resistor', { resistance: 4, power: 50 })],
      [wire('j.TIP', 'f.1'), wire('f.2', 'r.1'), wire('r.2', 'j.SLV')],
      0.5,
    );
    expect(vars(sim, 'f').blown).toBe(1);
  });

  it('solar panel clamps at its open-circuit voltage', () => {
    const { volts } = simulate([part('s', 'solar-panel', { size: 1, sun: 1000 }), part('r', 'resistor', { resistance: 1e5 })], [wire('s.PVP', 'r.1'), wire('s.PVN', 'r.2')], 0.05);
    expect(volts('s:PVP') - volts('s:PVN')).toBeGreaterThan(20);
    expect(volts('s:PVP') - volts('s:PVN')).toBeLessThan(22.5);
  });
});

describe('motors & drivers', () => {
  it('L298N drives a motor forward and backward from Arduino pins', () => {
    const run = (in1: string, in2: string) => {
      const code = `void setup(){ pinMode(7, OUTPUT); pinMode(8, OUTPUT); digitalWrite(7, ${in1}); digitalWrite(8, ${in2}); } void loop(){}`;
      const { volts } = simulate(
        [part('u', 'arduino-uno', { code }), part('d', 'l298n', { jumperA: 1 }), jack12(), part('m', 'gear-motor')],
        [wire('j.TIP', 'd.V12'), wire('j.SLV', 'd.GND'), wire('u.GND1', 'd.GND'), wire('u.D7', 'd.IN1'), wire('u.D8', 'd.IN2'), wire('d.OUT1', 'm.P'), wire('d.OUT2', 'm.N')],
        0.3,
      );
      return volts('d:OUT1') - volts('d:OUT2');
    };
    expect(run('HIGH', 'LOW')).toBeGreaterThan(5);
    expect(run('LOW', 'HIGH')).toBeLessThan(-5);
    expect(Math.abs(run('LOW', 'LOW'))).toBeLessThan(0.5);
  });

  it('A4988 + NEMA 17: 200 STEP pulses turn the shaft one revolution', () => {
    const code = `void setup(){ pinMode(3, OUTPUT); pinMode(4, OUTPUT); digitalWrite(4, HIGH);
      for (int i = 0; i < 200; i++) { digitalWrite(3, HIGH); delayMicroseconds(500); digitalWrite(3, LOW); delayMicroseconds(500); } } void loop(){}`;
    const { sim } = simulate(
      [part('u', 'arduino-uno', { code }), part('d', 'a4988'), jack12(), part('m', 'stepper-nema17')],
      [wire('j.TIP', 'd.VMOT'), wire('j.SLV', 'd.GND'), wire('u.GND1', 'd.GND'), wire('u.5V', 'd.VDD'), wire('u.D3', 'd.STEP'), wire('u.D4', 'd.DIR'), wire('d.RST', 'd.SLP'), wire('d.A1', 'm.A1'), wire('d.A2', 'm.A2'), wire('d.B1', 'm.B1'), wire('d.B2', 'm.B2')],
      0.5,
    );
    expect(vars(sim, 'd').pos).toBe(200);
    expect(Math.abs(vars(sim, 'm').deg)).toBeGreaterThan(355);
    expect(Math.abs(vars(sim, 'm').deg)).toBeLessThan(365);
  });

  it('ULN2003 + 28BYJ-48 turn with the Stepper-style sequence', () => {
    const code = `int pins[4] = {8, 9, 10, 11};
      void setup(){ for (int i = 0; i < 4; i++) pinMode(pins[i], OUTPUT); }
      int s = 0;
      void loop(){ for (int i = 0; i < 4; i++) digitalWrite(pins[i], i == s % 4 ? HIGH : LOW); s++; delay(3); }`;
    const { sim } = simulate(
      [part('u', 'arduino-uno', { code }), part('d', 'uln2003'), part('m', 'stepper-28byj48')],
      [wire('u.5V', 'd.VCC'), wire('u.GND1', 'd.GND'), wire('u.D8', 'd.IN1'), wire('u.D9', 'd.IN2'), wire('u.D10', 'd.IN3'), wire('u.D11', 'd.IN4'), wire('d.MP', 'm.RED'), wire('d.O1', 'm.BLU'), wire('d.O2', 'm.PNK'), wire('d.O3', 'm.YEL'), wire('d.O4', 'm.ORG')],
      0.3,
    );
    expect(Math.abs(vars(sim, 'm').steps)).toBeGreaterThan(50);
  });

  it('ESC spins a brushless motor from Servo pulses', () => {
    const code = `#include <Servo.h>
      Servo esc;
      void setup(){ esc.attach(9); esc.writeMicroseconds(1000); delay(100); esc.writeMicroseconds(1600); } void loop(){}`;
    const { sim } = simulate(
      [part('u', 'arduino-uno', { code }), part('e', 'esc'), part('j', 'usbc-power', { volts: 12 }), part('m', 'bldc-motor')],
      [wire('j.VOUT', 'e.VBAT'), wire('j.GND', 'e.GND'), wire('u.GND1', 'e.GNDS'), wire('u.D9', 'e.SIG'), wire('e.U', 'm.U'), wire('e.V', 'm.V'), wire('e.W', 'm.W')],
      0.6,
    );
    expect(vars(sim, 'e').armed).toBe(1);
    expect(vars(sim, 'm').w).toBeGreaterThan(100);
  });
});
