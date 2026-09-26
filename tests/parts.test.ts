import { describe, expect, it } from 'vitest';
import { Simulator } from '../src/sim/simulator';
import { getDef } from '../src/components/registry';
import type { CircuitDoc, ComponentInstance, Wire } from '../src/model/types';

const comp = (id: string, type: string, x = 0, y = 0, props: Record<string, any> = {}): ComponentInstance => ({
  id, type, x, y, rot: 0, flip: false, props: { ...getDef(type)!.defaultProps, ...props },
});
let wn = 0;
const w = (a: string, b: string): Wire => {
  const [ac, ap] = a.split('.');
  const [bc, bp] = b.split('.');
  return { id: `w${++wn}`, a: { comp: ac, pin: ap }, b: { comp: bc, pin: bp }, points: [], color: '#000' };
};
function run(doc: CircuitDoc, seconds: number) {
  const sim = new Simulator(doc);
  const errs = sim.start();
  if (errs.size) throw new Error([...errs.values()].map((e) => `${e.message} @${e.line}`).join());
  let snap = sim.snapshot();
  for (let i = 0; i < Math.round(seconds / 0.02); i++) {
    sim.advance(0.02);
    snap = sim.snapshot();
  }
  return { sim, snap };
}
const lcdText = (st: any) => st.rows.map((r: number[]) => String.fromCharCode(...r.map((c) => (c < 8 ? 35 : c)))).join('|');

describe('servo', () => {
  it('follows Servo.write() from an Uno', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('uno', 'arduino-uno', 0, 0, { code: `#include <Servo.h>\nServo s; void setup(){ s.attach(9); s.write(30); } void loop(){}` }), comp('sv', 'servo', 0, 300)],
      wires: [w('sv.SIG', 'uno.D9'), w('sv.+', 'uno.5V'), w('sv.-', 'uno.GND1')],
    };
    const { snap } = run(doc, 0.8);
    expect(snap.comps.sv!.angle).toBeCloseTo(30, 0);
    expect(snap.warnings).toEqual([]);
  });

  it('does not move without power and says why', () => {
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('uno', 'arduino-uno', 0, 0, { code: `#include <Servo.h>\nServo s; void setup(){ s.attach(9); s.write(170); } void loop(){}` }), comp('sv', 'servo', 0, 300)],
      wires: [w('sv.SIG', 'uno.D9'), w('sv.-', 'uno.GND1')],
    };
    const { snap } = run(doc, 0.5);
    expect(snap.comps.sv!.angle).toBe(90);
    expect(snap.warnings.map((x) => x.message).join()).toMatch(/no power/);
  });
});

describe('LCD', () => {
  it('shows text from LiquidCrystal on a wired 16x2', () => {
    const code = `#include <LiquidCrystal.h>
      LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
      void setup(){ lcd.begin(16, 2); lcd.print("Hello, world!"); }
      void loop(){ lcd.setCursor(0, 1); lcd.print(millis() / 1000); delay(100); }`;
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('uno', 'arduino-uno', 0, 0, { code }), comp('lcd', 'lcd', 0, 400)],
      wires: [
        w('lcd.VSS', 'uno.GND1'), w('lcd.VDD', 'uno.5V'), w('lcd.V0', 'uno.GND2'), w('lcd.RW', 'uno.GND3'),
        w('lcd.RS', 'uno.D12'), w('lcd.E', 'uno.D11'), w('lcd.D4', 'uno.D5'), w('lcd.D5', 'uno.D4'), w('lcd.D6', 'uno.D3'), w('lcd.D7', 'uno.D2'),
      ],
    };
    const { snap } = run(doc, 2.2);
    expect(lcdText(snap.comps.lcd)).toBe('Hello, world!   |2               ');
    expect(snap.comps.lcd!.on).toBe(true);
    expect(snap.warnings).toEqual([]);
  });

  it('flags data lines wired to the wrong pins', () => {
    const code = `#include <LiquidCrystal.h>\nLiquidCrystal lcd(12, 11, 5, 4, 3, 2);\nvoid setup(){ lcd.begin(16,2); lcd.print("x"); } void loop(){}`;
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('uno', 'arduino-uno', 0, 0, { code }), comp('lcd', 'lcd', 0, 400)],
      wires: [w('lcd.VSS', 'uno.GND1'), w('lcd.VDD', 'uno.5V'), w('lcd.RS', 'uno.D12'), w('lcd.E', 'uno.D11'), w('lcd.D4', 'uno.D6')],
    };
    const { snap } = run(doc, 0.3);
    expect(snap.warnings.map((x) => x.message).join()).toMatch(/D4–D7 aren't wired/);
  });

  it('drives an I2C LCD from an ESP32 on GPIO21/22', () => {
    const code = `#include <Wire.h>
      #include <LiquidCrystal_I2C.h>
      LiquidCrystal_I2C lcd(0x27, 16, 2);
      void setup(){ lcd.init(); lcd.backlight(); lcd.print("ESP32 + I2C"); }
      void loop(){}`;
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('esp', 'esp32-devkit', 0, 0, { code }), comp('lcd', 'lcd-i2c', 0, 400)],
      wires: [w('lcd.GND', 'esp.GND1'), w('lcd.VCC', 'esp.VIN'), w('lcd.SDA', 'esp.D21'), w('lcd.SCL', 'esp.D22')],
    };
    const { snap } = run(doc, 0.5);
    expect(lcdText(snap.comps.lcd).split('|')[0].trim()).toBe('ESP32 + I2C');
    expect(snap.comps.lcd!.backlight).toBe(1);
    expect(snap.warnings).toEqual([]);
  });
});

describe('ESP32', () => {
  it('drives an LED at 3.3 V and reads a 12-bit ADC', () => {
    const code = `void setup(){ Serial.begin(115200); pinMode(4, OUTPUT); digitalWrite(4, HIGH); }
      void loop(){ Serial.println(analogRead(34)); delay(100); }`;
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('esp', 'esp32-devkit', 0, 0, { code }), comp('r', 'resistor', 0, 300, { resistance: 100 }), comp('l', 'led', 0, 400), comp('pot', 'potentiometer', 200, 300, { position: 0.5 })],
      wires: [w('esp.D4', 'r.1'), w('r.2', 'l.A'), w('l.K', 'esp.GND1'), w('pot.1', 'esp.GND2'), w('pot.2', 'esp.3V3'), w('pot.W', 'esp.D34')],
    };
    const { sim, snap } = run(doc, 0.4);
    const i = snap.comps.l!.current * 1000;
    expect(i).toBeGreaterThan(9); // (3.3 − 1.8) / (100 + 30)
    expect(i).toBeLessThan(13);
    const last = Number(sim.mcus.get('esp')!.serialOut.trim().split('\n').at(-1));
    expect(last).toBeGreaterThan(1990);
    expect(last).toBeLessThan(2100);
  });

  it('counts button presses with an interrupt', () => {
    const code = `volatile int n = 0; void IRAM_ATTR onPress(){ n++; }
      void setup(){ Serial.begin(115200); pinMode(15, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(15), onPress, FALLING); }
      void loop(){ Serial.println(n); delay(50); }`;
    const doc: CircuitDoc = {
      version: 1, name: 't',
      components: [comp('esp', 'esp32-devkit', 0, 0, { code }), comp('b', 'pushbutton', 0, 300)],
      wires: [w('b.1a', 'esp.D15'), w('b.2a', 'esp.GND1')],
    };
    const sim = new Simulator(doc);
    expect(sim.start().size).toBe(0);
    const step = (s: number) => { for (let i = 0; i < s / 0.02; i++) { sim.advance(0.02); sim.snapshot(); } };
    step(0.2);
    for (let k = 0; k < 3; k++) {
      sim.input('b').pressed = true; step(0.1);
      sim.input('b').pressed = false; step(0.1);
    }
    step(0.1);
    expect(sim.mcus.get('esp')!.serialOut.trim().split('\n').at(-1)).toBe('3');
  });
});
