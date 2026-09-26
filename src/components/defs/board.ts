import { Avg, type SimBuilder, type SimComponent, type SimWarning } from '../../sim/builder';
import type { Source } from '../../sim/solver';
import type { BoardSpec } from '../../mcu/boards';
import { formatSI } from '../util';

export interface SupplyPin {
  pin: string;
  volts: number;
  r: number;
  /** current where we warn (A) */
  warn: number;
  /** current treated as a short (A) */
  short: number;
}

/** Electrical model shared by every programmable board: I/O pin drivers, supply pins, warnings. */
export function buildBoard(b: SimBuilder, spec: BoardSpec, headerPins: string[], gnd: string, supplies: SupplyPin[], power?: { vcc: string; min: number; max: number }): SimComponent {
  const mcu = b.mcu;
  b.markGround(gnd);
  /** bare chips run from their VCC pin: outputs follow the supply, and they halt without one */
  let vcc = spec.vcc;
  if (power) b.resistor(power.vcc, gnd, spec.vcc / 0.004);
  const sup = supplies.map((s) => ({ ...s, src: b.source(s.pin, gnd, s.volts, s.r), cur: new Avg() }));
  const drivers: { pin: number; id: string; src: Source; cur: Avg }[] = [];
  for (const id of headerPins) {
    const idx = spec.pinIndex(id);
    if (idx < 0 || !b.connected(id)) continue;
    drivers.push({ pin: idx, id, src: b.source(id, gnd, 0, 1e8), cur: new Avg() });
  }
  let warn: SimWarning[] = [];
  return {
    beforeStep(t, h) {
      if (!mcu) return;
      if (power) mcu.powerOk = vcc >= power.min;
      for (const d of drivers) {
        if (!mcu.powerOk) {
          d.src.volts = 0;
          d.src.r = 1e8;
          continue;
        }
        const dr = mcu.drive(d.pin, t, h);
        d.src.volts = power ? (dr.volts * vcc) / spec.vcc : dr.volts;
        d.src.r = dr.r;
      }
    },
    afterStep(v, h) {
      const g = b.volt(gnd);
      if (power) vcc = b.volt(power.vcc) - g;
      for (const d of drivers) {
        d.cur.add(-d.src.currents(v)[0], h);
        if (mcu) mcu.pins[d.pin].volts = b.volt(d.id) - g;
      }
      for (const s of sup) s.cur.add(-s.src.currents(v)[0], h);
      mcu?.sampleInterrupts();
    },
    maxStep: () => (mcu?.needsFineSteps ? 2e-4 : 1e-3),
    frame() {
      warn = [];
      const pinCurrents: Record<string, number> = {};
      for (const d of drivers) {
        const i = d.cur.take();
        pinCurrents[d.id] = i;
        if (Math.abs(i) > spec.maxPinCurrent) {
          warn.push({ level: 'error', message: `Pin ${d.id} overloaded: ${formatSI(Math.abs(i), 'A')} (max ${formatSI(spec.maxPinCurrent, 'A')}). Add a resistor or drive the load through a transistor.` });
        }
      }
      for (const s of sup) {
        const i = s.cur.take();
        if (i > s.short) warn.push({ level: 'error', message: `Short circuit on ${s.pin}: ${formatSI(i, 'A')} drawn from the supply.` });
        else if (i > s.warn) warn.push({ level: 'warn', message: `${s.pin} pin supplying ${formatSI(i, 'A')} — close to its limit.` });
      }
      if (power && vcc > power.max) warn.push({ level: 'error', message: `${spec.name} supply is ${vcc.toFixed(1)} V — above its ${power.max} V maximum.` });
      if (power && mcu && !mcu.powerOk) warn.push({ level: 'warn', message: `${spec.name} has no power: connect VCC (and GND) to a ${power.min}–${power.max} V supply.` });
      if (mcu?.error) warn.push({ level: 'error', message: `${mcu.error.kind === 'compile' ? 'Compile error' : 'Runtime error'}: ${mcu.error.message}` });
      for (const m of mcu?.libWarnings ?? []) warn.push({ level: 'warn', message: m });
      const led = mcu?.pins[Number(spec.constants.LED_BUILTIN)];
      const l = led ? led.mode === 'output' && (led.pwm !== null ? led.pwm > 0.1 : led.value === 1) : false;
      return {
        l,
        tx: mcu ? mcu.t - mcu.lastSerialAt < 60000 : false,
        error: mcu?.error ? mcu.error.message : undefined,
        pinCurrents,
        time: mcu ? mcu.t / 1e6 : 0,
      };
    },
    warnings: () => warn,
  };
}
