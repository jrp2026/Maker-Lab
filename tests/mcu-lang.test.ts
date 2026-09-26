import { describe, expect, it } from 'vitest';
import { McuRuntime } from '../src/mcu/runtime';
import { ESP32 } from '../src/mcu/boards';

function run(code: string, us = 200000, rt = new McuRuntime()) {
  const err = rt.load(code);
  if (err) throw new Error(`${err.message} (line ${err.line})`);
  rt.runUntil(us);
  if (rt.error) throw new Error(rt.error.message);
  return rt;
}
const lines = (r: McuRuntime) => r.serialOut.trim().split('\n');

describe('structs, typedef and the preprocessor', () => {
  it('supports struct definitions, initialisers, copies, arrays, references and pointers', () => {
    const r = run(`
      struct Point { int x; int y; };
      typedef struct { float t; Point p; int hist[3]; } Sample;
      Point origin = {0, 0};
      Sample samples[2];
      void nudge(Point &q) { q.x += 10; }
      int manhattan(Point a) { a.x = 999; return a.y + 5; }
      void setup() {
        Serial.begin(9600);
        Point a = {3, 4};
        Point b = a;         // copy
        b.x = 7;
        nudge(a);
        Serial.println(a.x); // 13
        Serial.println(b.x); // 7
        Serial.println(manhattan(a)); // 9, a unchanged
        Serial.println(a.x);
        samples[1].p.y = 42;
        samples[1].hist[2] = 5;
        Point *pp = &samples[1].p;
        pp->x = 8;
        Serial.println(samples[1].p.x + samples[1].p.y + samples[1].hist[2]); // 55
        Serial.println(sizeof(Point));  // 4 on AVR
        Serial.println(sizeof(Sample)); // 4 + 4 + 6
        origin = a;
        Serial.println(origin.y);
      }
      void loop() {}`);
    expect(lines(r)).toEqual(['13', '7', '9', '13', '55', '4', '14', '4']);
  });

  it('picks #if / #ifdef branches by board', () => {
    const code = `
      #define LED 5
      #if defined(ESP32)
        const char *board = "esp";
      #elif defined(__AVR__)
        const char *board = "avr";
      #else
        #error unknown board
      #endif
      #ifndef LED
        #error LED missing
      #endif
      void setup() { Serial.begin(115200); Serial.println(board); }
      void loop() {}`;
    expect(lines(run(code))).toEqual(['avr']);
    expect(lines(run(code, 200000, new McuRuntime(ESP32)))).toEqual(['esp']);
  });

  it('formats with sprintf / printf / dtostrf', () => {
    const r = run(`
      char buf[32];
      void setup() {
        Serial.begin(9600);
        sprintf(buf, "T=%d.%02d %s %5.1f|%-3d|%04X", 21, 5, "ok", 3.14159, 7, 255);
        Serial.println(buf);
        char f[10];
        dtostrf(2.5, 6, 2, f);
        Serial.print("[");
        Serial.print(f);
        Serial.println("]");
        Serial.printf("%s=%lu\\n", "ms", 1234UL);
      }
      void loop() {}`);
    expect(lines(r)).toEqual(['T=21.05 ok   3.1|7  |00FF', '[  2.50]', 'ms=1234']);
  });

  it('EEPROM.put/get round-trips structs, floats and ints', () => {
    const r = run(`
      #include <EEPROM.h>
      struct Settings { int id; float gain; char name[8]; };
      void setup() {
        Serial.begin(9600);
        Settings s = {7, 2.5, "abc"};
        EEPROM.put(10, s);
        EEPROM.put(0, 1234);
        Settings back;
        EEPROM.get(10, back);
        int v;
        EEPROM.get(0, v);
        Serial.println(back.id);
        Serial.println(back.gain);
        Serial.println(v);
        Serial.println(EEPROM.read(0));
        Serial.println(EEPROM.length());
      }
      void loop() {}`);
    expect(lines(r)).toEqual(['7', '2.50', '1234', '210', '1024']);
  });

  it('routes Serial2 and SoftwareSerial to the pins they use', () => {
    const sent: [number, string][] = [];
    const rt = new McuRuntime(ESP32);
    rt.env = { spi: () => 255, device: () => null, uartSend: (pin, t) => sent.push([pin, t]), pulse: () => null, lcdFor: () => null, i2c: () => null };
    run(`void setup() { Serial2.begin(9600); Serial2.print("AT"); Serial2.println(); } void loop() {}`, 100000, rt);
    expect(sent).toEqual([[17, 'AT'], [17, '\r\n']]);

    const r = new McuRuntime();
    const out: string[] = [];
    r.env = { spi: () => 255, device: () => null, uartSend: (_p, t) => out.push(t), pulse: () => null, lcdFor: () => null, i2c: () => null };
    run(`
      #include <SoftwareSerial.h>
      SoftwareSerial bt(10, 11);
      void setup() { Serial.begin(9600); bt.begin(9600); }
      void loop() { if (bt.available()) { String s = bt.readStringUntil('\\n'); Serial.println(s + "!"); bt.print("ack"); } }`, 1000, r);
    r.softPorts[0].push('hello\n');
    r.runUntil(50000);
    expect(lines(r)).toEqual(['hello!']);
    expect(out).toContain('ack');
  });

  it('DateTime and RTC_Millis keep time; objects returned by methods have methods', () => {
    const r = run(`
      #include <RTClib.h>
      RTC_Millis rtc;
      void setup() {
        Serial.begin(9600);
        rtc.begin(DateTime(2024, 2, 28, 23, 59, 58));
        delay(3000);
        DateTime now = rtc.now();
        Serial.println(now.year());
        Serial.println(now.month());
        Serial.println(now.day());
        Serial.println(now.second());
        Serial.println(now.dayOfTheWeek());
        Serial.println(now.timestamp());
      }
      void loop() {}`, 4000000);
    expect(lines(r)).toEqual(['2024', '2', '29', '1', '4', '2024-02-29T00:00:01']);
  });

  it('TinyGPS++ parses NMEA sentences', () => {
    const r = run(`
      #include <TinyGPS++.h>
      TinyGPSPlus gps;
      const char *nmea = "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\\r\\n$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47\\r\\n";
      void setup() {
        Serial.begin(9600);
        String s = nmea;
        for (int i = 0; i < s.length(); i++) gps.encode(s.charAt(i));
        Serial.println(gps.location.isValid());
        Serial.println(gps.location.lat(), 4);
        Serial.println(gps.location.lng(), 4);
        Serial.println(gps.satellites.value());
        Serial.println(gps.altitude.meters());
        Serial.println(gps.date.year());
        Serial.println(gps.time.hour());
        Serial.println(gps.speed.knots());
      }
      void loop() {}`);
    expect(lines(r)).toEqual(['1', '48.1173', '11.5167', '8', '545.40', '2094', '12', '22.40']);
  });
});
