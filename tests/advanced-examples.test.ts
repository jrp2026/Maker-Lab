import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

type Snap = ReturnType<Simulator['snapshot']>;

/** Build an example, optionally tweak part props (by type), run it. */
function run(id: string, seconds: number, props: Record<string, Record<string, number>> = {}, each?: (sim: Simulator, snap: Snap, t: number) => void) {
  const doc: CircuitDoc = EXAMPLES.find((e) => e.id === id)!.build();
  for (const c of doc.components) if (props[c.type]) c.props = { ...c.props, ...props[c.type] };
  const sim = new Simulator(doc);
  expect([...sim.start().values()]).toEqual([]);
  let snap = sim.snapshot();
  for (let i = 0; i < seconds / 0.02; i++) {
    sim.advance(0.02);
    snap = sim.snapshot();
    each?.(sim, snap, (i + 1) * 0.02);
  }
  for (const [mid, m] of sim.mcus) expect(m.error?.message, mid).toBeUndefined();
  const idOf = (type: string, nth = 0) => doc.components.filter((c) => c.type === type)[nth].id;
  const comp = (type: string, nth = 0) => snap.comps[idOf(type, nth)]!;
  const lcd = () => (comp('lcd-i2c').rows as number[][]).map((r) => String.fromCharCode(...r)).join('|');
  const serial = () => sim.mcus.get('uno')!.serialOut;
  const volts = (key: string) => snap.netVolts[snap.netOfPin.get(key)!];
  return { sim, snap, doc, idOf, comp, lcd, serial, volts };
}

describe('advanced examples do what they say', () => {
  it('thermostat heats only below the setpoint', () => {
    expect(run('thermostat', 1).lcd()).toMatch(/Temp 2[45]\.\d.*Set  22\.0   off/);
    const cold = run('thermostat', 1, { tmp36: { temp: 15 } });
    expect(cold.lcd()).toMatch(/HEAT/);
    expect(Math.abs(cold.comp('heater-pad').current as number ?? 0) || cold.volts(`${cold.idOf('heater-pad')}:P`) - cold.volts(`${cold.idOf('heater-pad')}:N`)).toBeGreaterThan(4);
  });

  it('intersection starts north-south green and serves a crossing request', () => {
    const r = run('intersection', 1);
    const ns = r.comp('traffic-light', 0).levels as number[], ew = r.comp('traffic-light', 1).levels as number[];
    expect(ns[2]).toBeGreaterThan(0.5);
    expect(ns[0]).toBeLessThan(0.05);
    expect(ew[0]).toBeGreaterThan(0.5);
    // press the crossing button, then run through yellow and all-red into WALK
    const btn = r.idOf('pushbutton');
    r.sim.input(btn).pressed = true;
    r.sim.advance(0.1);
    r.sim.input(btn).pressed = false;
    for (let i = 0; i < 250; i++) r.sim.advance(0.02);
    expect(r.serial()).toMatch(/phase 6/);
  });

  it('plant waterer runs the pump when the soil is dry, then soaks', () => {
    const r = run('plant', 5);
    expect(r.serial()).toMatch(/watering[\s\S]*soaking/);
    const wet = run('plant', 1, { 'capacitive-soil': { moist: 80 } });
    expect(wet.serial()).not.toMatch(/watering/);
  });

  it('stopwatch lights different digits in turn (multiplexing)', () => {
    const lit = new Set<number>();
    run('stopwatch', 1.2, {}, (_sim, snap, t) => {
      if (t < 0.5) return;
      const id = Object.keys(snap.comps).find((k) => snap.comps[k]?.vars && 'b1A' in (snap.comps[k]!.vars as object))!;
      const v = snap.comps[id]!.vars as Record<string, number>;
      for (const d of [1, 2, 3, 4]) if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].some((s) => v[`b${d}${s}`] > 0.3)) lit.add(d);
    });
    expect([...lit].sort()).toEqual([1, 2, 3, 4]);
  });

  it('keypad lock shows its prompt with the bolt closed', () => {
    const r = run('keypad-lock', 0.5);
    expect(r.lcd()).toMatch(/Enter code:/);
    expect(r.comp('servo').angle).toBe(0);
  });

  it('fan controller: off when cool, fast when hot', () => {
    expect(Math.abs(run('fan-control', 2).comp('dc-fan').readouts![0])).toBeLessThan(10);
    const hot = run('fan-control', 3, { 'ntc-module': { temp: 45 } });
    expect(hot.comp('dc-fan').readouts![0]).toBeGreaterThan(3000);
    expect(hot.lcd()).toMatch(/Fan  100 %/);
  });

  it('solar tracker turns towards the brighter side', () => {
    const r = run('solar-tracker', 2, {});
    expect(r.comp('servo').angle).toBe(90);
    const doc = EXAMPLES.find((e) => e.id === 'solar-tracker')!.build();
    const leftId = doc.components.find((c) => c.type === 'ldr-module')!.id;
    doc.components.find((c) => c.id === leftId)!.props.lux = 20;   // left side in shade
    const sim = new Simulator(doc);
    sim.start();
    for (let i = 0; i < 100; i++) sim.advance(0.02);
    expect(sim.snapshot().comps[doc.components.find((c) => c.type === 'servo')!.id]!.angle).toBeGreaterThan(120);
  });

  it('reaction game waits for green after a press', () => {
    const r = run('reaction', 0.4);
    expect(r.lcd()).toMatch(/Press to start/);
    const btn = r.idOf('pushbutton');
    r.sim.input(btn).pressed = true;
    r.sim.advance(0.1);
    r.sim.input(btn).pressed = false;
    r.sim.advance(0.1);
    const rows = (r.sim.snapshot().comps[r.idOf('lcd-i2c')]!.rows as number[][]).map((x) => String.fromCharCode(...x)).join('|');
    expect(rows).toMatch(/Wait for green/);
  });

  it('binary adder shows 5 + 6 = 1011', () => {
    const r = run('binary-adder', 0.2);
    const on = r.doc.components.filter((c) => c.type === 'led').map((c) => (r.snap.comps[c.id]!.brightness as number) > 0.2);
    expect(on).toEqual([true, true, false, true, false]);
  });

  it('decimal counter counts 0–9 and wraps', () => {
    const seen = new Set<number>();
    run('decade-counter', 6, {}, (_sim, snap) => {
      const id = Object.keys(snap.comps).find((k) => snap.comps[k]?.vars && 'nl' in (snap.comps[k]!.vars as object))!;
      seen.add((snap.comps[id]!.vars as Record<string, number>).nl);
    });
    expect(Math.max(...seen)).toBe(9);
    expect([...seen].every((v) => v >= 0 && v <= 9)).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(9);
  });
});
