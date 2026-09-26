import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/sim/simulator';
import { buildNetlist } from '../src/sim/netlist';
import { getDef } from '../src/components/registry';
import type { CircuitDoc, ComponentInstance } from '../src/model/types';

const comp = (id: string, type: string, x: number, y: number, props: Record<string, any> = {}, rot: 0 | 1 | 2 | 3 = 0): ComponentInstance => ({
  id, type, x, y, rot, flip: false, props: { ...getDef(type)!.defaultProps, ...props },
});

function run(sim: Simulator, seconds: number) {
  const frames = Math.round(seconds / 0.02);
  let snap = sim.snapshot();
  for (let i = 0; i < frames; i++) {
    sim.advance(0.02);
    snap = sim.snapshot();
  }
  return snap;
}

describe('netlist', () => {
  it('connects leads plugged into the same breadboard strip', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('bb', 'breadboard', 0, 0), comp('r', 'resistor', 20, 60), comp('l', 'led', 60, 70)],
      wires: [],
    };
    // resistor pins at (20,60)=1a and (60,60)=5a; LED A at (60,70)=5b, K at (70,70)=6b
    const nl = buildNetlist(doc);
    expect(nl.netOf.get('r:2')).toBe(nl.netOf.get('l:A'));
    expect(nl.netOf.get('r:1')).not.toBe(nl.netOf.get('l:K'));
    expect(nl.netOf.get('bb:1a')).toBe(nl.netOf.get('bb:1e'));
    expect(nl.netOf.get('bb:1e')).not.toBe(nl.netOf.get('bb:1f'));
  });
});

describe('simulator', () => {
  it('lights an LED from a battery through a resistor and animates wire current', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [
        comp('bb', 'breadboard', 0, 0),
        comp('bat', 'battery', -100, 0, { kind: '9V' }),
        comp('r', 'resistor', 20, 60, { resistance: 470, power: 0.25 }),
        comp('l', 'led', 60, 70, { color: 'red' }),
      ],
      wires: [
        { id: 'w1', a: { comp: 'bat', pin: '+' }, b: { comp: 'bb', pin: '1c' }, points: [], color: 'red' },
        { id: 'w2', a: { comp: 'bb', pin: '6c' }, b: { comp: 'bat', pin: '-' }, points: [], color: 'black' },
      ],
    };
    const sim = new Simulator(doc);
    sim.start();
    const snap = run(sim, 0.2);
    const led = snap.comps['l']!;
    expect(led.current * 1000).toBeGreaterThan(14);
    expect(led.current * 1000).toBeLessThan(16);
    expect(led.brightness).toBeGreaterThan(0.8);
    expect(snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
    expect(snap.wireFlow['w1']).toBeGreaterThan(0.013);
    expect(snap.wireFlow['w2']).toBeGreaterThan(0.013);
  });

  it('burns out an LED plugged straight into pin 13 and flags the overloaded pin', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [
        comp('uno', 'arduino-uno', 0, 0),
        // LED flipped: A lands in D13 (x=130), K in GND (x=120)
        { ...comp('l', 'led', 110, 10, { color: 'red' }), flip: true },
      ],
      wires: [],
    };
    const sim = new Simulator(doc);
    expect(sim.start().size).toBe(0);
    const snap = run(sim, 0.8);
    expect(snap.comps['l']!.burnt).toBe(true);
    const msgs = snap.warnings.map((w) => w.message).join('\n');
    expect(msgs).toMatch(/Burned out/);
  });

  it('runs blink through a resistor, LED toggles each second', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [
        comp('uno', 'arduino-uno', 0, 300),
        comp('bb', 'breadboard', 0, 0),
        comp('r', 'resistor', 20, 60, { resistance: 220, power: 0.25 }),
        comp('l', 'led', 60, 70, { color: 'green' }),
      ],
      wires: [
        { id: 'w1', a: { comp: 'uno', pin: 'D13' }, b: { comp: 'bb', pin: '1c' }, points: [], color: 'green' },
        { id: 'w2', a: { comp: 'bb', pin: '6c' }, b: { comp: 'uno', pin: 'GND3' }, points: [], color: 'black' },
      ],
    };
    const sim = new Simulator(doc);
    sim.start();
    let s = run(sim, 0.5);
    expect(s.comps['l']!.brightness).toBeGreaterThan(0.5);
    expect(s.comps['uno']!.l).toBe(true);
    s = run(sim, 1.0);
    expect(s.comps['l']!.brightness).toBe(0);
    expect(s.warnings).toEqual([]);
    expect(sim.mcus.get('uno')!.serialOut).toContain('Hello');
  });

  it('flags missing ground', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('uno', 'arduino-uno', 0, 300), comp('bb', 'breadboard', 0, 0), comp('r', 'resistor', 20, 60), comp('l', 'led', 60, 70)],
      wires: [{ id: 'w1', a: { comp: 'uno', pin: 'D13' }, b: { comp: 'bb', pin: '1c' }, points: [], color: 'green' }],
    };
    const sim = new Simulator(doc);
    sim.start();
    const s = run(sim, 0.1);
    expect(s.warnings.some((w) => /Missing ground/.test(w.message))).toBe(true);
  });

  it('reads a potentiometer with analogRead and fades with PWM', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [
        comp('uno', 'arduino-uno', 0, 300, { code: `int v; void setup(){ Serial.begin(9600); } void loop(){ v = analogRead(A0); analogWrite(9, v / 4); Serial.println(v); delay(50); }` }),
        comp('pot', 'potentiometer', 0, 0, { resistance: 10000, position: 0.25 }),
        comp('mm', 'multimeter', 100, 0, { mode: 'V' }),
      ],
      wires: [
        { id: 'a', a: { comp: 'pot', pin: '1' }, b: { comp: 'uno', pin: 'GND1' }, points: [], color: 'black' },
        { id: 'b', a: { comp: 'pot', pin: '2' }, b: { comp: 'uno', pin: '5V' }, points: [], color: 'red' },
        { id: 'c', a: { comp: 'pot', pin: 'W' }, b: { comp: 'uno', pin: 'A0' }, points: [], color: 'orange' },
        { id: 'd', a: { comp: 'mm', pin: '+' }, b: { comp: 'uno', pin: 'D9' }, points: [], color: 'red' },
        { id: 'e', a: { comp: 'mm', pin: 'COM' }, b: { comp: 'uno', pin: 'GND2' }, points: [], color: 'black' },
      ],
    };
    const sim = new Simulator(doc);
    expect(sim.start().size).toBe(0);
    const s = run(sim, 0.4);
    const lines = sim.mcus.get('uno')!.serialOut.trim().split('\n');
    const v = Number(lines[lines.length - 1]);
    expect(v).toBeGreaterThan(245);
    expect(v).toBeLessThan(265);
    // PWM average on D9 ≈ 5 V * (v/4)/255
    expect(s.comps['mm']!.value).toBeGreaterThan(1.1);
    expect(s.comps['mm']!.value).toBeLessThan(1.4);
  });

  it('spins a DC motor from a battery and measures current in series', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('bat', 'battery', 0, 0, { kind: 'AA4' }), comp('m', 'dc-motor', 100, 0), comp('mm', 'multimeter', 200, 0, { mode: 'A' })],
      wires: [
        { id: 'a', a: { comp: 'bat', pin: '+' }, b: { comp: 'mm', pin: '+' }, points: [], color: 'red' },
        { id: 'b', a: { comp: 'mm', pin: 'COM' }, b: { comp: 'm', pin: '+' }, points: [], color: 'red' },
        { id: 'c', a: { comp: 'm', pin: '-' }, b: { comp: 'bat', pin: '-' }, points: [], color: 'black' },
      ],
    };
    const sim = new Simulator(doc);
    sim.start();
    const s = run(sim, 1.0);
    expect(s.comps['m']!.rpm).toBeGreaterThan(4000);
    expect(s.comps['mm']!.value).toBeGreaterThan(0.03);
    expect(s.comps['mm']!.value).toBeLessThan(0.2);
  });

  it('measures resistance with the ohmmeter', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('r', 'resistor', 0, 0, { resistance: 4700, power: 0.25 }), comp('mm', 'multimeter', 100, 0, { mode: 'R' })],
      wires: [
        { id: 'a', a: { comp: 'r', pin: '1' }, b: { comp: 'mm', pin: '+' }, points: [], color: 'red' },
        { id: 'b', a: { comp: 'r', pin: '2' }, b: { comp: 'mm', pin: 'COM' }, points: [], color: 'black' },
      ],
    };
    const sim = new Simulator(doc);
    sim.start();
    const s = run(sim, 0.1);
    expect(s.comps['mm']!.value).toBeCloseTo(4700, -1);
  });
});
