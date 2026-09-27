import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';

function run(id: string, seconds: number, props: Record<string, Record<string, number>[]> = {}) {
  const doc: CircuitDoc = EXAMPLES.find((e) => e.id === id)!.build();
  for (const [type, list] of Object.entries(props)) doc.components.filter((c) => c.type === type).forEach((c, i) => list[i] && Object.assign(c.props, list[i]));
  const sim = new Simulator(doc);
  expect([...sim.start().values()]).toEqual([]);
  let snap = sim.snapshot();
  for (let i = 0; i < seconds / 0.02; i++) { sim.advance(0.02); snap = sim.snapshot(); }
  expect(sim.mcus.get('esp')!.error?.message).toBeUndefined();
  expect(snap.solverFailed).toBe(false);
  const motors = doc.components.filter((c) => c.type === 'gear-motor').map((c) => snap.comps[c.id]!.readouts![0] as number);
  return { sim, snap, doc, motors, serial: sim.mcus.get('esp')!.serialOut };
}

describe('robot car examples', () => {
  it('the autonomous car cruises forward on all four wheels with the 5 V rail up', () => {
    const r = run('robot-avoider', 1.2);
    expect(r.serial).toMatch(/cruising/);
    // left motors turn one way, the mirrored right motors the other, all at speed
    for (const rpm of r.motors) expect(Math.abs(rpm)).toBeGreaterThan(60);
    expect(r.snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
  });

  it('an obstacle makes it back up, look both ways and turn', () => {
    const r = run('robot-avoider', 2.5, { 'hc-sr04': [{ dist: 10 }] });
    expect(r.serial).toMatch(/backing up[\s\S]*looking[\s\S]*left \d+ cm, right \d+ cm[\s\S]*turning/);
  });

  it('plugging in USB-C charges the cells', () => {
    const doc = EXAMPLES.find((e) => e.id === 'robot-avoider')!.build();
    doc.components.find((c) => c.type === 'usbc-power')!.props.plugged = 1;
    doc.components.find((c) => c.type === 'rocker-switch')!.props.on = 0;   // car switched off while charging
    const sim = new Simulator(doc);
    sim.start();
    const cell = doc.components.find((c) => c.type === 'battery-18650')!.id;
    for (let i = 0; i < 5; i++) sim.advance(0.02);
    const before = (sim.snapshot().comps[cell]!.vars as Record<string, number>).soc;
    for (let i = 0; i < 25; i++) sim.advance(0.02);
    expect((sim.snapshot().comps[cell]!.vars as Record<string, number>).soc).toBeGreaterThan(before);
  });

  it('the line follower steers towards the sensor that sees the line', () => {
    // line under the left sensor only → slow the left wheels
    const r = run('robot-line', 1.2, { 'line-tracker': [{ refl: 10 }, { refl: 90 }, { refl: 90 }] });
    const [fl, rl, fr, rr] = r.motors.map(Math.abs);
    expect(fl + rl).toBeLessThan(fr + rr);
    expect(r.serial).toMatch(/sensors L M R: 100/);
  });
});
