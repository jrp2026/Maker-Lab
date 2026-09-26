import { describe, expect, it } from 'vitest';
import { McuRuntime } from '../src/mcu/runtime';
import { ESP32 } from '../src/mcu/boards';
import { HD44780 } from '../src/sim/hd44780';

function run(code: string, us: number, rt = new McuRuntime()) {
  const err = rt.load(code);
  if (err) throw new Error(`${err.message} (line ${err.line})`);
  rt.runUntil(us);
  if (rt.error) throw new Error(rt.error.message);
  return rt;
}
const lines = (r: McuRuntime) => r.serialOut.trim().split('\n');

describe('pointers and references', () => {
  it('supports address-of, dereference, pointer arithmetic and swap', () => {
    const r = run(`
      int a = 1, b = 2;
      int arr[5] = {10, 20, 30, 40, 50};
      void swap(int *x, int *y) { int t = *x; *x = *y; *y = t; }
      void inc(int &v) { v++; }
      int sum(const int *p, int n) { int s = 0; for (int i = 0; i < n; i++) s += p[i]; return s; }
      void setup() {
        Serial.begin(9600);
        swap(&a, &b);
        Serial.println(a); Serial.println(b);
        int *p = arr;
        p++;
        *p = 99;
        *(p + 2) += 1;
        Serial.println(arr[1]); Serial.println(arr[3]);
        Serial.println(sum(arr, 5));
        int *q = &arr[4];
        Serial.println(q - p);
        inc(a); inc(arr[0]);
        Serial.println(a); Serial.println(arr[0]);
        int local = 5; int &ref = local; ref = 7;
        Serial.println(local);
        int *np = NULL;
        Serial.println(np == NULL ? "null" : "set");
        const char *msg = "hi";
        Serial.println(msg);
        int *walk = arr; int total = 0;
        while (walk != &arr[5]) { total += *walk++; }
        Serial.println(total);
      }
      void loop() {}
    `, 1e5);
    expect(lines(r)).toEqual(['2', '1', '99', '41', '230', '3', '3', '11', '7', 'null', 'hi', '231']);
  });

  it('reports a null pointer dereference at runtime', () => {
    const r = new McuRuntime();
    expect(r.load(`int *p; void setup(){ *p = 3; } void loop(){}`)).toBeNull();
    r.runUntil(1000);
    expect(r.error?.message).toMatch(/null pointer/);
  });
});

describe('interrupts', () => {
  it('runs an ISR on a falling edge of pin 2', () => {
    const r = run(`
      volatile int count = 0;
      void onPress() { count++; }
      void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING); }
      void loop() { Serial.println(count); delay(10); }
    `, 1000);
    r.pins[2].volts = 5;
    r.sampleInterrupts();
    r.pins[2].volts = 0; // falling edge
    r.sampleInterrupts();
    r.runUntil(30000);
    r.pins[2].volts = 5;
    r.sampleInterrupts();
    r.pins[2].volts = 0;
    r.sampleInterrupts();
    r.runUntil(60000);
    expect(lines(r).at(-1)).toBe('2');
  });

  it('rejects a non-function handler with a clear message', () => {
    const r = new McuRuntime();
    expect(r.load(`int x; void setup(){ attachInterrupt(0, x, RISING); } void loop(){}`)?.message).toMatch(/name of a function/);
  });
});

describe('libraries', () => {
  it('Servo drives 50 Hz pulses whose width follows write()', () => {
    const r = run(`#include <Servo.h>
      Servo s;
      void setup(){ s.attach(9); s.write(0); delay(100); s.write(180); }
      void loop(){}`, 50000);
    expect(r.pins[9].servo).toBe(544);
    r.runUntil(200000);
    expect(r.pins[9].servo).toBe(2400);
    expect(r.pinFrequency(9)).toBe(50);
  });

  it('LiquidCrystal writes into an HD44780 wired to its pins', () => {
    const lcd = new HD44780();
    const r = new McuRuntime();
    r.env = { lcdFor: (rs, en) => (rs === 12 && en === 11 ? lcd : null), i2c: () => null };
    run(`#include <LiquidCrystal.h>
      LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
      byte heart[8] = {0, 10, 31, 31, 14, 4, 0, 0};
      void setup(){ lcd.begin(16, 2); lcd.createChar(0, heart); lcd.print("Hello"); lcd.setCursor(3, 1); lcd.print(42); lcd.write(byte(0)); }
      void loop(){}`, 200000, r);
    const rows = lcd.visible(16, 2).map((row) => row.map((c) => (c < 8 ? '#' : String.fromCharCode(c))).join(''));
    expect(rows[0]).toBe('Hello           ');
    expect(rows[1]).toBe('   42#          ');
    expect(lcd.glyph(0)).toEqual([0, 10, 31, 31, 14, 4, 0, 0]);
    expect(lcd.displayOn).toBe(true);
  });

  it('LiquidCrystal_I2C speaks PCF8574 over Wire; Wire scanner finds the device', () => {
    const lcd = new HD44780();
    const dev = { write: (b: number[]) => b.forEach((x) => lcd.pcfWrite(x)), read: () => [] };
    const r = new McuRuntime();
    r.env = { lcdFor: () => null, i2c: (a) => (a === 0x27 ? dev : null) };
    run(`#include <Wire.h>
      #include <LiquidCrystal_I2C.h>
      LiquidCrystal_I2C lcd(0x27, 16, 2);
      void setup(){
        Serial.begin(9600); Wire.begin();
        for (byte a = 1; a < 127; a++) { Wire.beginTransmission(a); if (Wire.endTransmission() == 0) { Serial.print("found 0x"); Serial.println(a, HEX); } }
        lcd.init(); lcd.backlight(); lcd.setCursor(0, 1); lcd.print("I2C ok");
      }
      void loop(){}`, 600000, r);
    expect(r.serialOut).toContain('found 0x27');
    expect(String.fromCharCode(...lcd.visible(16, 2)[1]).trim()).toBe('I2C ok');
    expect(lcd.backlight).toBe(true);
  });

  it('warns when a library object has no hardware attached', () => {
    const r = run(`#include <LiquidCrystal_I2C.h>
      LiquidCrystal_I2C lcd(0x3F, 16, 2);
      void setup(){ lcd.init(); lcd.print("x"); } void loop(){}`, 200000);
    expect([...r.libWarnings].join()).toMatch(/no device answered at 0x3F/);
  });

  it('unknown library members get a readable error', () => {
    const r = new McuRuntime();
    expect(r.load(`#include <Servo.h>\nServo s; void setup(){ s.spin(3); } void loop(){}`)?.message).toMatch(/'Servo' has no member named 'spin'/);
  });
});

describe('ESP32 target', () => {
  it('uses 32-bit int, 12-bit ADC, ledc PWM and dacWrite', () => {
    const r = new McuRuntime(ESP32);
    r.pins[34].volts = 1.65;
    run(`
      int big = 300 * 300;
      void setup(){
        Serial.begin(115200);
        Serial.println(big);
        Serial.println(analogRead(34));
        Serial.println(LED_BUILTIN);
        ledcAttach(5, 5000, 8); ledcWrite(5, 128);
        dacWrite(25, 255);
        attachInterrupt(digitalPinToInterrupt(15), onEdge, CHANGE);
      }
      void onEdge() {}
      void loop(){}`, 10000, r);
    expect(lines(r)).toEqual(['90000', '2048', '2']);
    expect(r.pins[5].pwm).toBeCloseTo(128 / 255);
    expect(r.pins[25].dac).toBeCloseTo(3.3);
  });

  it('rejects ESP32-only APIs on the Uno and output on input-only pins', () => {
    expect(new McuRuntime().load(`void setup(){ dacWrite(25, 3); } void loop(){}`)?.message).toMatch(/only available on ESP32/);
    const r = new McuRuntime(ESP32);
    r.load(`void setup(){ pinMode(34, OUTPUT); } void loop(){}`);
    r.runUntil(1000);
    expect(r.error?.message).toMatch(/input-only/);
    expect(new McuRuntime(ESP32).load(`void setup(){ WiFi.begin("x", "y"); } void loop(){}`)?.message).toMatch(/isn't simulated yet/);
  });
});

describe('attributes', () => {
  it('ignores PROGMEM / IRAM_ATTR', () => {
    const r = new McuRuntime(ESP32);
    expect(r.load(`const char msg[] PROGMEM = "x"; void IRAM_ATTR isr(){} void setup(){} void loop(){}`)).toBeNull();
  });
});
