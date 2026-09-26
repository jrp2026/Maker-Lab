import { describe, expect, it } from 'vitest';
import { McuRuntime } from '../src/mcu/runtime';
import { compileSketch } from '../src/mcu/compiler';

function run(code: string, us: number) {
  const r = new McuRuntime();
  const err = r.load(code);
  expect(err).toBeNull();
  r.runUntil(us);
  if (r.error) throw new Error(r.error.message);
  return r;
}

describe('sketch compiler', () => {
  it('runs blink with delay timing', () => {
    const r = new McuRuntime();
    expect(r.load(`
      void setup() { pinMode(LED_BUILTIN, OUTPUT); }
      void loop() { digitalWrite(LED_BUILTIN, HIGH); delay(1000); digitalWrite(LED_BUILTIN, LOW); delay(1000); }
    `)).toBeNull();
    r.runUntil(500_000);
    expect(r.pins[13].value).toBe(1);
    r.runUntil(1_500_000);
    expect(r.pins[13].value).toBe(0);
    r.runUntil(2_100_000);
    expect(r.pins[13].value).toBe(1);
  });

  it('uses 16-bit int semantics and integer division', () => {
    const r = run(`
      int a = 7 / 2;
      int b = 300 * 300;
      byte c = 250;
      long d = 100000L * 3;
      float f = 7 / 2.0;
      unsigned int u = 0;
      void setup() {
        Serial.begin(9600);
        c += 10;
        u--;
        Serial.println(a); Serial.println(b); Serial.println(c); Serial.println(d);
        Serial.println(f); Serial.println(u); Serial.println(-7 % 3);
        Serial.println(255, HEX); Serial.println(5, BIN); Serial.println('A'); Serial.println(3.14159, 3);
      }
      void loop() {}
    `, 1000);
    expect(r.serialOut.trim().split('\n')).toEqual(['3', '24464', '4', '300000', '3.50', '65535', '-1', 'FF', '101', 'A', '3.142']);
  });

  it('supports functions, arrays, loops, switch, strings and statics', () => {
    const r = run(`
      #define N 5
      const int SIZE = 3;
      int data[N] = {5, 3, 9};
      int grid[SIZE][2];
      enum Mode { IDLE, RUN = 4, STOP };
      int sum(int arr[], int n) { int s = 0; for (int i = 0; i < n; i++) s += arr[i]; return s; }
      int counter() { static int c = 0; return ++c; }
      String name = "led";
      void setup() {
        Serial.println(sum(data, N));
        Serial.println(sizeof(data) / sizeof(data[0]));
        counter(); counter();
        Serial.println(counter());
        int x = 2;
        switch (x) { case 1: Serial.println("one"); break; case 2: Serial.println("two"); default: Serial.println("fall"); }
        name += "-" + String(13);
        name.toUpperCase();
        Serial.println(name + " " + name.length());
        grid[2][1] = STOP;
        Serial.println(grid[2][1]);
        int i = 0; while (true) { if (++i > 10) break; }
        Serial.println(i > 5 ? i : -1);
        bool ok = !false && (3 > 2);
        Serial.println(ok);
        Serial.println(map(512, 0, 1023, 0, 255));
        Serial.println(constrain(300, 0, 255));
      }
      void loop() {}
    `, 100000);
    expect(r.serialOut.trim().split('\n')).toEqual(['17', '5', '3', 'two', 'fall', 'LED-13 6', '5', '11', '1', '127', '255']);
  });

  it('reports compile errors with line numbers', () => {
    const r = new McuRuntime();
    const err = r.load(`void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}`);
    expect(err?.line).toBe(3);
    expect(err?.message).toMatch(/expected ';'/);
    const r2 = new McuRuntime();
    expect(r2.load(`void setup() { foo = 3; }\nvoid loop(){}`)?.message).toMatch(/'foo' was not declared/);
    const r3 = new McuRuntime();
    expect(r3.load(`void setup() {}`)?.message).toMatch(/loop/);
  });

  it('keeps busy loops from freezing and tracks millis', () => {
    const r = run(`
      unsigned long last = 0; int ticks = 0;
      void setup() {}
      void loop() { if (millis() - last >= 100) { last = millis(); ticks++; } }
    `, 1_050_000);
    const src = compileSketch('void setup(){} void loop(){}');
    expect(src.js).toContain('function*');
    expect(r.t).toBeGreaterThanOrEqual(1_050_000);
  });

  it('analogWrite sets PWM duty and digitalWrite on input enables pull-up', () => {
    const r = run(`void setup(){ analogWrite(9, 64); pinMode(2, INPUT); digitalWrite(2, HIGH); analogWrite(7, 200); } void loop(){}`, 1000);
    expect(r.pins[9].pwm).toBeCloseTo(64 / 255);
    expect(r.pins[2].mode).toBe('pullup');
    expect(r.pins[7].value).toBe(1);
  });
});
