/**
 * Which parts can take their values from the device's own sensors, and how a reading becomes
 * part settings. Pure functions: the runner (DeviceLinks) does the subscribing and writing.
 */
import type { ComponentDef, PropField } from '../components/types';
import type { Props } from '../model/types';
import type { Readings, SourceId } from './sensors';

export interface LinkCtx {
  /** current part settings */
  props: Props;
  /** per-link scratch (e.g. the "upright" direction captured when the link was switched on) */
  memo: Record<string, unknown>;
}

export interface LinkResult {
  /** settings to write */
  props?: Props;
  /** momentary press (vibration, motion) */
  press?: boolean;
}

export interface DeviceLink<K extends SourceId = SourceId> {
  source: K;
  /** what the toggle says, e.g. "Use this device's microphone" */
  label: string;
  /** settings the device controls (shown read-only while linked) */
  keys: string[];
  apply: (r: Readings[K], ctx: LinkCtx) => LinkResult;
  /** a short text for the live reading under the toggle */
  show: (r: Readings[K]) => string;
  /** 0 … 1 for the little meter, if it makes sense */
  meter?: (r: Readings[K]) => number;
}

/** a link for any one source */
export type AnyLink = { [K in SourceId]: DeviceLink<K> }[SourceId];

export const SOURCE_ICON: Record<SourceId, string> = { mic: '🎤', motion: '📱', compass: '🧭', camera: '📷', geo: '📍' };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round = (v: number, step: number) => {
  const digits = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  return Number((Math.round(v / step) * step).toFixed(digits));
};
const deg = (r: number) => (r * 180) / Math.PI;

const micMeter = (r: Readings['mic']) => clamp((r.dbfs + 70) / 60, 0, 1);
const micShow = (r: Readings['mic']) => `loudness ${Math.round(micMeter(r) * 100)}%${r.pitch ? ` · ${r.pitch} Hz` : ' · quiet'}`;
const motionShow = (r: Readings['motion']) => `X ${r.ax.toFixed(2)} · Y ${r.ay.toFixed(2)} · Z ${r.az.toFixed(2)} g`;
const camShow = (r: Readings['camera']) => `≈ ${r.lux} lx`;
const camMeter = (r: Readings['camera']) => clamp(r.lux / 1000, 0, 1);

const MIC = 'Use this device’s microphone';
const MOTION = 'Use this device’s motion sensors';
const CAMERA = 'Use the camera as a light sensor';

function lightLink(key: string, max: number): DeviceLink<'camera'> {
  return {
    source: 'camera', label: CAMERA, keys: [key],
    apply: (r) => ({ props: { [key]: Math.round(clamp(r.lux, 0, max)) } }),
    show: (r) => `${camShow(r)} · cover the camera to make it dark`, meter: camMeter,
  };
}

const levelLink: DeviceLink<'camera'> = {
  source: 'camera', label: CAMERA, keys: ['light'],
  apply: (r) => ({ props: { light: round(clamp(r.lux / 1000, 0, 1), 0.01) } }),
  show: (r) => `${camShow(r)} · cover the camera to make it dark`, meter: camMeter,
};

const accel = (r: Readings['motion'], lim: number, step: number) => ({
  ax: round(clamp(r.ax, -lim, lim), step), ay: round(clamp(r.ay, -lim, lim), step), az: round(clamp(r.az, -lim, lim), step),
});

export const LINKS: Record<string, AnyLink> = {
  'mic-module': {
    source: 'mic', label: MIC, keys: ['level', 'f'],
    apply: (r, { props }) => ({ props: { level: round(micMeter(r), 0.01), f: r.pitch ? round(clamp(r.pitch, 60, 2000), 10) : Number(props.f) || 220 } }),
    show: micShow, meter: micMeter,
  } satisfies DeviceLink<'mic'>,
  'sound-sensor': {
    source: 'mic', label: MIC, keys: ['db'],
    apply: (r) => ({ props: { db: Math.round(clamp(r.dbfs + 100, 30, 110)) } }),
    show: (r) => `≈ ${Math.round(clamp(r.dbfs + 100, 30, 110))} dB`, meter: micMeter,
  } satisfies DeviceLink<'mic'>,
  adxl335: {
    source: 'motion', label: MOTION, keys: ['ax', 'ay', 'az'],
    apply: (r) => ({ props: accel(r, 3, 0.05) }), show: motionShow,
  } satisfies DeviceLink<'motion'>,
  mpu6050: {
    source: 'motion', label: MOTION, keys: ['ax', 'ay', 'az', 'gx', 'gy', 'gz'],
    apply: (r) => ({ props: { ...accel(r, 4, 0.01), gx: Math.round(clamp(r.gx, -500, 500)), gy: Math.round(clamp(r.gy, -500, 500)), gz: Math.round(clamp(r.gz, -500, 500)) } }),
    show: (r) => `${motionShow(r)} · ${Math.round(Math.hypot(r.gx, r.gy, r.gz))} °/s`,
  } satisfies DeviceLink<'motion'>,
  'tilt-switch': {
    source: 'motion', label: 'Tip this device to tilt the switch', keys: ['tilted'],
    apply: (r, { memo }) => {
      const up = (memo.up ??= [r.ax, r.ay, r.az]) as number[];
      const a = tiltAngle(up, [r.ax, r.ay, r.az]);
      memo.angle = a;
      return { props: { tilted: a > 45 ? 1 : 0 } };
    },
    show: (r) => `${r.az > 0.9 ? 'flat' : 'held'} · tip it more than 45° to open the switch`,
  } satisfies DeviceLink<'motion'>,
  'vibration-sensor': {
    source: 'motion', label: 'Shake this device to trigger it', keys: [],
    apply: (r) => ({ press: r.shake > 3 }),
    show: (r) => (r.shake > 3 ? 'shaking!' : 'still · give it a shake'), meter: (r) => clamp(r.shake / 8, 0, 1),
  } satisfies DeviceLink<'motion'>,
  joystick: {
    source: 'motion', label: 'Tilt this device to move the stick', keys: ['x', 'y'],
    apply: (r) => ({ props: { x: round(clamp(0.5 + r.ax, 0, 1), 0.01), y: round(clamp(0.5 + r.ay, 0, 1), 0.01) } }),
    show: (r) => `X ${Math.round(clamp(0.5 + r.ax, 0, 1) * 100)}% · Y ${Math.round(clamp(0.5 + r.ay, 0, 1) * 100)}%`,
  } satisfies DeviceLink<'motion'>,
  qmc5883l: {
    source: 'compass', label: 'Use this device’s compass', keys: ['heading'],
    apply: (r) => ({ props: { heading: Math.round(r.heading) % 360 } }),
    show: (r) => `heading ${Math.round(r.heading)}° ${compassPoint(r.heading)}`,
  } satisfies DeviceLink<'compass'>,
  temt6000: lightLink('lux', 1200),
  'ldr-module': lightLink('lux', 2000),
  phototransistor: lightLink('lux', 2000),
  photoresistor: levelLink,
  photodiode: levelLink,
  pir: {
    source: 'camera', label: 'Use the camera to detect motion', keys: [],
    apply: (r) => ({ press: r.motion > 0.08 }),
    show: (r) => (r.motion > 0.08 ? 'motion!' : 'watching · wave a hand at the camera'), meter: (r) => clamp(r.motion * 5, 0, 1),
  } satisfies DeviceLink<'camera'>,
  'gps-neo6m': {
    source: 'geo', label: 'Use this device’s location', keys: ['lat', 'lon', 'alt', 'speed', 'course', 'sats', 'fix'],
    apply: (r) => ({
      props: {
        lat: round(r.lat, 1e-6), lon: round(r.lon, 1e-6), alt: Math.round(r.alt), speed: round(clamp(r.speed, 0, 200), 0.5),
        course: Math.round(r.course) % 360, fix: 1, sats: clamp(Math.round(14 - Math.log2(Math.max(1, r.accuracy))), 4, 12),
      },
    }),
    show: (r) => `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)} · ±${Math.round(r.accuracy)} m`,
  } satisfies DeviceLink<'geo'>,
};

/** Angle between two gravity vectors, in degrees. */
export function tiltAngle(a: number[], b: number[]) {
  const la = Math.hypot(a[0], a[1], a[2]) || 1, lb = Math.hypot(b[0], b[1], b[2]) || 1;
  return deg(Math.acos(clamp((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb), -1, 1)));
}

function compassPoint(h: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((h % 360) + 360) % 360) / 45) % 8];
}

/** The link for a part: built-in table first, then light (unit lx) and heading settings, so AI-made parts work too. */
export function linkFor(def: ComponentDef): AnyLink | null {
  const known = LINKS[def.type];
  if (known) return known;
  const fields = def.fields ?? [];
  const lx = fields.find((f): f is Extract<PropField, { kind: 'slider' }> => f.kind === 'slider' && f.unit === 'lx');
  if (lx) return lightLink(lx.key, lx.max);
  const heading = fields.find((f) => f.key === 'heading' && (f.kind === 'slider' || f.kind === 'number'));
  if (heading) return LINKS.qmc5883l;
  return null;
}
