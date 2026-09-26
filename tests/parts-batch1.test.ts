import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';

describe('batch 1 parts behave like the real thing', () => {
  it('zener clamps a 9 V supply to its voltage through a resistor', () => {
    const { volts } = simulate(
      [part('b', 'battery'), part('r', 'resistor', { resistance: 470 }), part('z', 'zener', { vz: 5.1 })],
      [wire('b.+', 'r.1'), wire('r.2', 'z.K'), wire('z.A', 'b.-')],
      0.1,
    );
    const vz = volts('z:K') - volts('z:A');
    expect(vz).toBeGreaterThan(4.9);
    expect(vz).toBeLessThan(5.4);
  });

  it('N-MOSFET part switches a load from an Arduino pin', () => {
    const code = `void setup(){ pinMode(9, OUTPUT); digitalWrite(9, HIGH); } void loop(){}`;
    const { snap } = simulate(
      [part('u', 'arduino-uno', { code }), part('m', 'nmos'), part('bat', 'battery', { kind: 'AA4' }), part('r', 'resistor', { resistance: 22, power: 2 })],
      [wire('u.D9', 'm.G'), wire('m.S', 'u.GND1'), wire('bat.-', 'u.GND2'), wire('bat.+', 'r.1'), wire('r.2', 'm.D')],
      0.2,
    );
    expect(snap.comps.r!.current).toBeGreaterThan(0.2);
  });

  it('optocoupler passes a signal across the isolation barrier', () => {
    const { volts } = simulate(
      [part('b1', 'battery', { kind: 'AA2' }), part('r1', 'resistor', { resistance: 220 }), part('o', 'optocoupler'), part('b2', 'battery', { kind: '9V' }), part('r2', 'resistor', { resistance: 10000 })],
      [wire('b1.+', 'r1.1'), wire('r1.2', 'o.A'), wire('o.K', 'b1.-'), wire('b2.+', 'r2.1'), wire('r2.2', 'o.C'), wire('o.E', 'b2.-')],
      0.1,
    );
    expect(volts('o:C') - volts('o:E')).toBeLessThan(0.5);
  });

  it('SCR latches after a gate pulse', () => {
    const { snap, sim } = simulate(
      [part('b', 'battery'), part('r', 'resistor', { resistance: 100, power: 1 }), part('s', 'scr'), part('btn', 'pushbutton'), part('rg', 'resistor', { resistance: 1000 })],
      [wire('b.+', 'r.1'), wire('r.2', 's.A'), wire('s.K', 'b.-'), wire('b.+', 'btn.1a'), wire('btn.2a', 'rg.1'), wire('rg.2', 's.G')],
      0.1,
    );
    expect(snap.comps.r!.current).toBeLessThan(0.001);
    sim.input('btn').pressed = true;
    for (let i = 0; i < 5; i++) sim.advance(0.02);
    sim.input('btn').pressed = false;
    let s2 = sim.snapshot();
    for (let i = 0; i < 10; i++) {
      sim.advance(0.02);
      s2 = sim.snapshot();
    }
    expect(s2.comps.r!.current).toBeGreaterThan(0.07);
  });

  it('relay switches COM from NC to NO when the coil is energised', () => {
    const { snap } = simulate(
      [part('b', 'battery', { kind: 'AA4' }), part('k', 'relay'), part('b2', 'battery', { kind: '9V' }), part('lamp', 'resistor', { resistance: 100, power: 1 })],
      [wire('b.+', 'k.COIL1'), wire('k.COIL2', 'b.-'), wire('b2.+', 'k.COM'), wire('k.NO', 'lamp.1'), wire('lamp.2', 'b2.-')],
      0.2,
    );
    expect(snap.comps.lamp!.current).toBeGreaterThan(0.08);
  });

  it('transformer + AC source gives the turns ratio', () => {
    let peak = 0;
    simulate(
      [part('ac', 'ac-source', { vpk: 120, f: 13 }), part('t', 'transformer', { ratio: 10 }), part('r', 'resistor', { resistance: 1000 })],
      [wire('ac.L', 't.P1'), wire('ac.N', 't.P2'), wire('t.S1', 'r.1'), wire('t.S2', 'r.2')],
      0.3,
      (sim, t) => {
        if (t > 0.15) {
          const s = sim.snapshot();
          peak = Math.max(peak, Math.abs(s.netVolts[s.netOfPin.get('t:S1')!] - s.netVolts[s.netOfPin.get('t:S2')!]));
        }
      },
    );
    expect(peak).toBeGreaterThan(9);
    expect(peak).toBeLessThan(12.5);
  });

  it('thermistor resistance follows the temperature (β model)', () => {
    const run = (temp: number) =>
      simulate([part('b', 'battery', { kind: 'AA4' }), part('t', 'thermistor', { temp }), part('r', 'resistor', { resistance: 10000 })], [wire('b.+', 't.1'), wire('t.2', 'r.1'), wire('r.2', 'b.-')], 0.05).snap.comps.r!.current;
    const i25 = run(25), i80 = run(80);
    expect(i25 * 1000).toBeCloseTo(6 / 20000 * 1000, 1);
    expect(i80).toBeGreaterThan(i25 * 1.5);
  });
});
