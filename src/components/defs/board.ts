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

/** Is the board's USB cable plugged in? (Older saved circuits have no setting: plugged in.) */
export const usbPlugged = (props: Record<string, unknown>) => props.usb === undefined || Number(props.usb) !== 0;

/** Inspector setting shared by the dev boards. */
export const USB_FIELD = {
  key: 'usb', label: 'USB cable', kind: 'select' as const,
  options: [
    { value: 1, label: 'Plugged in (powered by the computer)' },
    { value: 0, label: 'Unplugged: power it through VIN / 5V / 3V3 + GND' },
  ],
};

/**
 * Electrical model shared by every programmable board: I/O pin drivers, supply pins, warnings.
 *
 * With the USB cable plugged in, the board's supply pins are outputs (the computer powers it).
 * Unplugged (`usb === false`), the board is dead until its pins are fed: VIN (or VBUS/VSYS, or the
 * 5 V pin of a 3.3 V board) through the on-board regulator, or the logic rail (5V / 3V3) directly.
 */
export function buildBoard(b: SimBuilder, spec: BoardSpec, headerPins: string[], gnd: string, supplies: SupplyPin[], power?: { vcc: string; min: number; max: number }, usb = true): SimComponent {
  const mcu = b.mcu;
  b.markGround(gnd);
  /** bare chips run from their VCC pin: outputs follow the supply, and they halt without one */
  let vcc = spec.vcc;
  if (power) b.resistor(power.vcc, gnd, spec.vcc / 0.004);
  const sup = supplies.map((s) => ({ ...s, src: b.source(s.pin, gnd, usb ? s.volts : 0, usb ? s.r : 1e8), cur: new Avg() }));
  // unplugged board: which pins feed the regulator, which pin is the logic rail
  const selfPowered = !usb && !power;
  const rail = selfPowered ? sup.find((s) => Math.abs(s.volts - spec.vcc) < 0.01) : undefined;
  const lower = selfPowered ? sup.filter((s) => s.volts < spec.vcc - 0.01) : [];
  const inputs = selfPowered
    ? [...supplies.filter((s) => s.volts > spec.vcc + 0.01).map((s) => s.pin), ...headerPins.filter((id) => /^(VIN|VBUS|VSYS)$/.test(id) && !supplies.some((s) => s.pin === id))]
    : [];
  const dropout = spec.vcc > 4 ? 1.2 : 1.0;
  let vin = 0, railV = 0;
  if (selfPowered) {
    // the chip's own draw on its rail, and the regulator's draw on its input
    if (rail) b.resistor(rail.pin, gnd, spec.vcc / 0.05);
    for (const id of inputs) b.resistor(id, gnd, 150);
  }
  const drivers: { pin: number; id: string; src: Source; cur: Avg }[] = [];
  for (const id of headerPins) {
    const idx = spec.pinIndex(id);
    if (idx < 0 || !b.connected(id)) continue;
    drivers.push({ pin: idx, id, src: b.source(id, gnd, 0, 1e8), cur: new Avg() });
  }
  let warn: SimWarning[] = [];
  return {
    beforeStep(t, h) {
      if (selfPowered) {
        // on-board regulator: VIN → logic rail, logic rail → the lower rail (e.g. the Uno's 3.3 V)
        const reg = Math.min(spec.vcc, vin - dropout);
        if (rail) {
          rail.src.volts = Math.max(0, reg);
          rail.src.r = reg > 1 ? rail.r : 1e8;
        }
        const main = rail ? railV : Math.max(0, reg);
        for (const l of lower) {
          const out = Math.min(l.volts, main - 0.2);
          l.src.volts = Math.max(0, out);
          l.src.r = out > 1 ? l.r : 1e8;
        }
        vcc = rail ? railV : Math.max(railV, reg);
      }
      if (!mcu) return;
      if (power) mcu.powerOk = vcc >= power.min;
      else if (selfPowered) mcu.powerOk = vcc >= spec.vcc * 0.8;
      for (const d of drivers) {
        if (!mcu.powerOk) {
          d.src.volts = 0;
          d.src.r = 1e8;
          continue;
        }
        const dr = mcu.drive(d.pin, t, h);
        d.src.volts = power || selfPowered ? (dr.volts * Math.min(vcc, spec.vcc)) / spec.vcc : dr.volts;
        d.src.r = dr.r;
      }
    },
    afterStep(v, h) {
      const g = b.volt(gnd);
      if (power) vcc = b.volt(power.vcc) - g;
      if (selfPowered) {
        vin = Math.max(0, ...inputs.map((id) => b.volt(id) - g));
        railV = rail ? b.volt(rail.pin) - g : Math.max(0, ...lower.map((l) => b.volt(l.pin) - g));
      }
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
      if (selfPowered && mcu && !mcu.powerOk) {
        warn.push({ level: 'warn', message: `${spec.name} is unplugged and has no power: feed ${inputs.length ? `${inputs.join(' / ')} (${spec.vcc > 4 ? '7–12' : '5'} V)` : ''}${inputs.length && rail ? ' or ' : ''}${rail ? `${rail.pin} (${spec.vcc} V)` : ''} and connect GND — or plug the USB cable back in (inspector).` });
      }
      if (selfPowered && vin > (spec.vcc > 4 ? 20 : 12)) warn.push({ level: 'error', message: `${inputs.join(' / ')} at ${vin.toFixed(1)} V is above what the on-board regulator takes.` });
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
        off: mcu ? !mcu.powerOk : false,
        usb,
      };
    },
    warnings: () => warn,
  };
}
