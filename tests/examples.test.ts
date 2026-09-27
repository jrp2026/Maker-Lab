import { describe, expect, it } from 'vitest';
import { EXAMPLES, BLOCKS_BLINK_CODE, BLOCKS_BLINK_JSON } from '../src/examples';
import { Simulator } from '../src/sim/simulator';
import { sketchFromJson } from '../src/blocks/arduino';
import { UNO } from '../src/mcu/boards';
import { buildNetlist } from '../src/sim/netlist';

describe('examples', () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))('%s runs cleanly', (_id, ex) => {
    const doc = ex.build();
    // every wire endpoint must exist
    const nl = buildNetlist(doc);
    for (const w of doc.wires) {
      expect(nl.netOf.has(`${w.a.comp}:${w.a.pin}`), `${w.a.comp}:${w.a.pin}`).toBe(true);
      expect(nl.netOf.has(`${w.b.comp}:${w.b.pin}`), `${w.b.comp}:${w.b.pin}`).toBe(true);
    }
    const sim = new Simulator(doc);
    const errs = sim.start();
    expect([...errs.values()]).toEqual([]);
    let snap = sim.snapshot();
    for (let i = 0; i < 75; i++) {
      sim.advance(0.02);
      snap = sim.snapshot();
    }
    expect(snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
    expect(snap.solverFailed).toBe(false);
  });

  it('blocks example code matches the generator', () => {
    expect(sketchFromJson(BLOCKS_BLINK_JSON, UNO)).toBe(BLOCKS_BLINK_CODE);
  });

  it('LCD and ESP32 examples actually show text', () => {
    for (const id of ['lcd', 'esp32-lcd']) {
      const sim = new Simulator(EXAMPLES.find((e) => e.id === id)!.build());
      sim.start();
      let snap = sim.snapshot();
      for (let i = 0; i < 60; i++) {
        sim.advance(0.02);
        snap = sim.snapshot();
      }
      const lcd = Object.values(snap.comps).find((c) => c && 'rows' in c)!;
      const text = (lcd.rows as number[][]).map((r) => String.fromCharCode(...r.map((c) => (c < 8 ? 35 : c)))).join('|');
      expect(text, id).toMatch(id === 'lcd' ? /Hello, world! #.*Uptime: 1 s/ : /ESP32 ADC demo.*V/);
    }
  });
});

describe('device examples do what they say', () => {
  const run = (id: string, seconds: number, each?: (sim: Simulator, snap: ReturnType<Simulator['snapshot']>) => void) => {
    const sim = new Simulator(EXAMPLES.find((e) => e.id === id)!.build());
    sim.start();
    let snap = sim.snapshot();
    while (sim.time < seconds - 1e-6) {
      sim.advance(0.02);
      snap = sim.snapshot();
      each?.(sim, snap);
    }
    return { sim, snap };
  };
  const comp = (snap: ReturnType<Simulator['snapshot']>, type: string, sim: Simulator) => {
    const id = (sim as any).doc.components.find((c: any) => c.type === type).id;
    return snap.comps[id]!;
  };

  it('the AI Morse key sounds the buzzer and lights the LED only while held', () => {
    let r = run('ai-morse-key', 0.2);
    expect(Number(comp(r.snap, 'active-buzzer', r.sim).freq ?? 0)).toBe(0);
    expect(Number(comp(r.snap, 'led', r.sim).brightness ?? 0)).toBeLessThan(0.05);
    const key = (r.sim as any).doc.components.find((c: any) => c.type.startsWith('ai-morse')).id;
    r.sim.input(key).pressed = true;
    for (let i = 0; i < 10; i++) r.sim.advance(0.02);
    const snap = r.sim.snapshot();
    expect(comp(snap, 'active-buzzer', r.sim).freq).toBe(2300);
    expect(Number(comp(snap, 'led', r.sim).brightness)).toBeGreaterThan(0.2);
  });

  it('OLED shows pixels, NeoPixels light up, the LCD shows the weather', () => {
    let r = run('oled', 1);
    expect([...(comp(r.snap, 'oled-128x64', r.sim).oled as { gram: Uint8Array }).gram].some((x) => x)).toBe(true);
    r = run('neopixel', 0.5);
    expect((comp(r.snap, 'neopixel-ring', r.sim).colors as number[]).filter((c) => c > 0).length).toBe(16);
    r = run('weather', 1.5);
    const rows = comp(r.snap, 'lcd-i2c', r.sim).rows as number[][];
    expect(String.fromCharCode(...rows[0])).toMatch(/Temp: 24\.0/);
  });

  it('the 555 blinks, the stepper turns, the chaser moves, the radio link works', () => {
    const led = new Set<boolean>();
    let r = run('555', 2, (sim, s) => {
      const id = (sim as any).doc.components.find((c: any) => c.type === 'led').id;
      led.add(Number(s.comps[id]?.brightness ?? s.comps[id]?.level ?? 0) > 0.2);
    });
    expect(led).toEqual(new Set([true, false]));
    r = run('stepper', 0.5);
    expect(Math.abs(((r.sim as any).persist.get([...(r.sim as any).doc.components].find((c: any) => c.type === 'stepper-nema17').id).vars.steps))).toBeGreaterThan(50);
    r = run('shift595', 0.3);
    const latch = comp(r.snap, '74hc595', r.sim).latch as number;
    expect([1, 2, 4, 8, 16, 32, 64, 128]).toContain(latch);
    r = run('radio', 0.1);
    r.sim.input((r.sim as any).doc.components.find((c: any) => c.type === 'pushbutton').id).pressed = true;
    for (let i = 0; i < 10; i++) r.sim.advance(0.02);
    expect(r.sim.mcus.get('rx')!.pins[5].value).toBe(1);
  });
});
