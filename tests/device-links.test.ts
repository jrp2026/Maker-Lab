import { describe, expect, it } from 'vitest';
import { LINKS, linkFor, tiltAngle } from '../src/device/links';
import { getDef } from '../src/components/registry';
import { defFromSpec } from '../src/ai/customPart';
import { validateSpec } from '../src/ai/spec';
import { TELEGRAPH_KEY_SPEC } from '../src/ai/samplePart';

const flat = { ax: 0, ay: 0, az: 1, gx: 0, gy: 0, gz: 0, shake: 0 };
const run = (type: string, r: unknown, memo: Record<string, unknown> = {}) => {
  const def = getDef(type)!;
  return linkFor(def)!.apply(r as never, { props: def.defaultProps, memo });
};

describe('device sensor links', () => {
  it('only links real parts and settings', () => {
    for (const [type, link] of Object.entries(LINKS)) {
      const def = getDef(type);
      expect(def, type).toBeTruthy();
      const keys = new Set((def!.fields ?? []).map((f) => f.key));
      for (const k of link.keys) expect(keys.has(k), `${type}.${k}`).toBe(true);
    }
  });

  it('turns microphone loudness into sound levels', () => {
    expect(run('sound-sensor', { dbfs: -60, pitch: 0 }).props).toEqual({ db: 40 });
    expect(run('sound-sensor', { dbfs: 0, pitch: 0 }).props).toEqual({ db: 100 });
    const m = run('mic-module', { dbfs: -10, pitch: 443 }).props!;
    expect(m.level).toBe(1);
    expect(m.f).toBe(440);
    expect(run('mic-module', { dbfs: -90, pitch: 0 }).props).toEqual({ level: 0, f: 220 });
  });

  it('reads motion as g and °/s within each part’s range', () => {
    expect(run('adxl335', flat).props).toEqual({ ax: 0, ay: 0, az: 1 });
    const mpu = run('mpu6050', { ...flat, ax: 9, gz: 900 }).props!;
    expect(mpu.ax).toBe(4);
    expect(mpu.gz).toBe(500);
    expect(run('vibration-sensor', { ...flat, shake: 6 }).press).toBe(true);
    expect(run('vibration-sensor', flat).press).toBe(false);
  });

  it('tips the tilt switch past 45° from where it started', () => {
    const memo = {};
    expect(run('tilt-switch', flat, memo).props).toEqual({ tilted: 0 });
    expect(run('tilt-switch', { ...flat, ax: 0.5, az: 0.85 }, memo).props).toEqual({ tilted: 0 });
    expect(run('tilt-switch', { ...flat, ax: 0.9, az: 0.4 }, memo).props).toEqual({ tilted: 1 });
    expect(tiltAngle([0, 0, 1], [1, 0, 0])).toBeCloseTo(90);
  });

  it('maps camera light, compass and location', () => {
    expect(run('temt6000', { lux: 5000, motion: 0 }).props).toEqual({ lux: 1200 });
    expect(run('photoresistor', { lux: 500, motion: 0 }).props).toEqual({ light: 0.5 });
    expect(run('pir', { lux: 100, motion: 0.3 }).press).toBe(true);
    expect(run('qmc5883l', { heading: 359.6 }).props).toEqual({ heading: 0 });
    const gps = run('gps-neo6m', { lat: 48.858, lon: 2.2945, alt: 35, speed: 3.6, course: 90, accuracy: 8 }).props!;
    expect(gps).toMatchObject({ lat: 48.858, lon: 2.2945, fix: 1, course: 90 });
    expect(gps.sats).toBeGreaterThanOrEqual(4);
  });

  it('works for AI parts with a light or heading setting', () => {
    const spec = validateSpec({ ...TELEGRAPH_KEY_SPEC, type: 'ai-lux-test', props: [{ key: 'glow', label: 'Light', type: 'slider', default: 10, min: 0, max: 800, step: 1, unit: 'lx' }] });
    const link = linkFor(defFromSpec(spec))!;
    expect(link.source).toBe('camera');
    expect(link.apply({ lux: 2000, motion: 0 } as never, { props: {}, memo: {} }).props).toEqual({ glow: 800 });
    expect(linkFor(getDef('resistor')!)).toBeNull();
  });
});
