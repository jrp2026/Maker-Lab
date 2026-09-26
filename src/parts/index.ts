/**
 * Built-in parts authored as declarative specs (the same format the AI generator
 * produces), validated at start-up and turned into ComponentDefs.
 */
import { validateSpec, SpecError } from '../ai/spec';
import { defFromSpec, type PartExt } from '../ai/customPart';
import type { ComponentDef } from '../components/types';
import { PASSIVE } from './passive';
import { SEMIS } from './semis';
import { RELAYS, SWITCHES } from './switches';
import { ANALOG_ICS, LOGIC_ICS } from './ics';
import { SENSORS } from './sensors';
import { DISPLAYS, KEYPAD } from './displays';
import { MOTORS } from './motors';
import { COMMS_PASSIVE, DRIVERS } from './drivers';
import { BATTERY_MGMT, CONVERTERS, DISTRIBUTION, POWER_SOURCES, REGULATORS } from './power';

import { DEVICE_PARTS } from './devices';
export type { PartExt };

export const RAW_PARTS = [...PASSIVE, ...SEMIS, ...SWITCHES, ...RELAYS, ...ANALOG_ICS, ...LOGIC_ICS, ...SENSORS, ...DISPLAYS, KEYPAD, ...MOTORS, ...DRIVERS, ...COMMS_PASSIVE, ...POWER_SOURCES, ...REGULATORS, ...CONVERTERS, ...BATTERY_MGMT, ...DISTRIBUTION];

export function buildSpecParts(): ComponentDef[] {
  const out: ComponentDef[] = [];
  for (const entry of [...RAW_PARTS, ...DEVICE_PARTS]) {
    const [raw, ext] = Array.isArray(entry) ? entry : [entry, undefined];
    try {
      out.push(defFromSpec(validateSpec(raw, { builtin: true, extraNames: ext?.vars }), ext));
    } catch (e) {
      const why = e instanceof SpecError ? e.problems.join('; ') : String(e);
      throw new Error(`built-in part '${raw.type}' is invalid: ${why}`);
    }
  }
  return out;
}
