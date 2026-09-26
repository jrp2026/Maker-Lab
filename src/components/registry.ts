import type { ComponentDef } from './types';
import { breadboardFull, breadboardSmall } from './defs/breadboard';
import { ceramicCapacitor, electrolyticCapacitor, photoresistor, potentiometer, resistor } from './defs/passive';
import { diode, led, rgbLed } from './defs/diodes';
import { npn, pnp, pushbutton, slideSwitch } from './defs/discrete';
import { battery } from './defs/power';
import { dcMotor, piezo } from './defs/output';
import { multimeter, oscilloscope } from './defs/instruments';
import { arduinoUno } from './defs/arduino';

export const DEFS: ComponentDef[] = [
  breadboardSmall, breadboardFull,
  resistor, potentiometer, photoresistor, ceramicCapacitor, electrolyticCapacitor,
  led, rgbLed, diode,
  npn, pnp,
  pushbutton, slideSwitch,
  battery,
  dcMotor, piezo,
  multimeter, oscilloscope,
  arduinoUno,
];

const byType = new Map(DEFS.map((d) => [d.type, d]));

export function getDef(type: string): ComponentDef | undefined {
  return byType.get(type);
}
