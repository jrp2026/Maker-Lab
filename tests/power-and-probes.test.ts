import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';


/** run a board and record whether its built-in LED ever turned on and whether it reported "off" */
function runBoard(parts: ReturnType<typeof part>[], wires: ReturnType<typeof wire>[], id: string, seconds = 1.5) {
  const leds = new Set<boolean>();
  const r = simulate(parts, wires, seconds, (sim) => {
    const c = sim.snapshot().comps[id];
    if (c) leds.add(!!c.l);
  });
  const c = r.snap.comps[id]!;
  return { off: !!c.off, blinked: leds.has(true) && leds.has(false), warnings: r.snap.warnings.filter((w) => w.comp === id).map((w) => w.message) };
}

describe('boards need power when the USB cable is unplugged', () => {
  it('a board with its USB cable plugged in runs with nothing wired (like on a desk)', () => {
    const r = runBoard([part('u', 'arduino-uno')], [], 'u');
    expect(r.off).toBe(false);
    expect(r.blinked).toBe(true);
  });

  it('unplugged and unwired, the ESP32 and the Uno stay off and say why', () => {
    for (const type of ['esp32-devkit', 'arduino-uno', 'arduino-nano', 'pico']) {
      const r = runBoard([part('u', type, { usb: 0 })], [], 'u', 0.6);
      expect(r.off, type).toBe(true);
      expect(r.blinked, type).toBe(false);
      expect(r.warnings.join(' '), type).toMatch(/unplugged and has no power/);
    }
  });

  it('unplugged ESP32 runs from 5 V on VIN, or 3.3 V on 3V3 — but not without GND', () => {
    const usb = part('p', 'usb-breakout');
    let r = runBoard([part('u', 'esp32-devkit', { usb: 0 }), usb], [wire('p.VBUS', 'u.VIN'), wire('p.GND', 'u.GND1')], 'u');
    expect(r.off).toBe(false);
    expect(r.blinked).toBe(true);
    r = runBoard([part('u', 'esp32-devkit', { usb: 0 }), part('b', 'battery', { kind: 'AA2' })], [wire('b.+', 'u.3V3'), wire('b.-', 'u.GND1')], 'u');
    expect(r.off).toBe(false);
    r = runBoard([part('u', 'esp32-devkit', { usb: 0 }), usb], [wire('p.VBUS', 'u.VIN')], 'u', 0.6);
    expect(r.off).toBe(true);
  });

  it('unplugged Uno runs from a 9 V battery on VIN, not from 3 V; its 5V pin then powers other parts', () => {
    let r = runBoard([part('u', 'arduino-uno', { usb: 0 }), part('b', 'battery', { kind: '9V' })], [wire('b.+', 'u.VIN'), wire('b.-', 'u.GND1')], 'u');
    expect(r.off).toBe(false);
    expect(r.blinked).toBe(true);
    const s = simulate([part('u', 'arduino-uno', { usb: 0 }), part('b', 'battery', { kind: '9V' })], [wire('b.+', 'u.VIN'), wire('b.-', 'u.GND1')], 0.3);
    expect(s.volts('u:5V') - s.volts('u:GND1')).toBeCloseTo(5, 0);
    r = runBoard([part('u', 'arduino-uno', { usb: 0 }), part('b', 'battery', { kind: 'AA2' })], [wire('b.+', 'u.VIN'), wire('b.-', 'u.GND1')], 'u', 0.6);
    expect(r.off).toBe(true);
  });
});

describe('meters and the scope measure between both of their leads', () => {
  const circuit = [part('b', 'battery', { kind: '9V' }), part('r', 'resistor', { resistance: 1000 })];
  const loop = [wire('b.+', 'r.1'), wire('r.2', 'b.-')];

  it('the scope shows nothing until its ground clip is connected', () => {
    // with a board in the circuit, a floating clip used to read as if grounded
    let r = simulate([...circuit, part('s', 'oscilloscope'), part('u', 'arduino-uno')], [...loop, wire('s.+', 'r.1'), wire('u.GND1', 'b.-')], 0.2);
    expect(r.snap.comps.s!.trace).toEqual([]);
    expect(r.snap.warnings.some((w) => w.comp === 's' && /ground clip/.test(w.message))).toBe(true);
    r = simulate([...circuit, part('s', 'oscilloscope')], [...loop, wire('s.+', 'r.1'), wire('s.-', 'b.-')], 0.2);
    const tr = r.snap.comps.s!.trace as number[];
    expect(tr.length).toBeGreaterThan(10);
    expect(tr[tr.length - 1]).toBeCloseTo(9, 0);
  });

  it('the multimeter reads nothing with its COM probe hanging free', () => {
    let r = simulate([...circuit, part('m', 'multimeter'), part('u', 'arduino-uno')], [...loop, wire('m.+', 'r.1'), wire('u.GND1', 'b.-')], 0.2);
    expect(r.snap.comps.m!.open).toBe(true);
    r = simulate([...circuit, part('m', 'multimeter')], [...loop, wire('m.+', 'r.1'), wire('m.COM', 'b.-')], 0.2);
    expect(Number(r.snap.comps.m!.value)).toBeCloseTo(9, 0);
  });
});
