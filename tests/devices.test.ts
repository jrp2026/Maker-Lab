import { describe, expect, it } from 'vitest';
import { part, simulate, wire } from './helpers';
import type { Simulator } from '../src/sim/simulator';

const uno = (code: string, id = 'u') => part(id, 'arduino-uno', { code });
const serial = (sim: Simulator, id = 'u') => sim.mcus.get(id)!.serialOut.trim().split('\n');
const err = (sim: Simulator, id = 'u') => sim.mcus.get(id)!.error?.message;
const i2c = (dev: string, board = 'u') => [wire(`${board}.5V`, `${dev}.VCC`), wire(`${board}.GND1`, `${dev}.GND`), wire(`${board}.A4`, `${dev}.SDA`), wire(`${board}.A5`, `${dev}.SCL`)];

describe('display devices', () => {
  it('NeoPixel stick shows the colours set with Adafruit_NeoPixel', () => {
    const code = `#include <Adafruit_NeoPixel.h>
      Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);
      void setup(){ strip.begin(); strip.setPixelColor(0, strip.Color(255, 0, 0)); strip.setPixelColor(7, 0, 0, 255); strip.show(); }
      void loop(){}`;
    const { snap, sim } = simulate([uno(code), part('n', 'neopixel-stick')], [wire('u.D6', 'n.DIN'), wire('u.5V', 'n.VCC'), wire('u.GND1', 'n.GND')], 0.1);
    expect(err(sim)).toBeUndefined();
    const c = snap.comps.n!.colors as number[];
    expect(c[0]).toBe(0xff0000);
    expect(c[7]).toBe(0x0000ff);
    expect(c[3]).toBe(0);
  });

  it('SSD1306 OLED receives the frame buffer over I2C', () => {
    const code = `#include <Wire.h>
      #include <Adafruit_GFX.h>
      #include <Adafruit_SSD1306.h>
      Adafruit_SSD1306 display(128, 64, &Wire, -1);
      void setup(){
        Serial.begin(9600);
        if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("fail");
        display.clearDisplay();
        display.drawPixel(0, 0, SSD1306_WHITE);
        display.fillRect(10, 8, 4, 4, SSD1306_WHITE);
        display.setTextSize(1); display.setTextColor(SSD1306_WHITE); display.setCursor(0, 20); display.print("Hi");
        display.display();
      }
      void loop(){}`;
    const { snap, sim } = simulate([uno(code), part('o', 'oled-128x64')], i2c('o'), 0.4);
    expect(err(sim)).toBeUndefined();
    expect(sim.mcus.get('u')!.serialOut).toBe('');
    const g = (snap.comps.o!.oled as { gram: Uint8Array }).gram;
    expect(g[0] & 1).toBe(1); // pixel (0,0)
    expect(g[1 * 128 + 10] & 0x0f).toBe(0x0f); // rows 8–11 of column 10
    expect([...g.slice(2 * 128, 2 * 128 + 12)].some((x) => x)).toBe(true); // "Hi" on page 2
  });

  it('74HC595 latches shiftOut() data onto its outputs', () => {
    const code = `void setup(){ pinMode(8, OUTPUT); pinMode(11, OUTPUT); pinMode(12, OUTPUT);
        digitalWrite(8, LOW); shiftOut(11, 12, MSBFIRST, 0b10100101); digitalWrite(8, HIGH); } void loop(){}`;
    const { volts, sim } = simulate(
      [uno(code), part('s', '74hc595')],
      [wire('u.5V', 's.VCC'), wire('u.GND1', 's.GND'), wire('u.D11', 's.SER'), wire('u.D12', 's.SRCLK'), wire('u.D8', 's.RCLK'), wire('u.GND2', 's.OE'), wire('u.5V', 's.SRCLR')],
      0.1,
    );
    expect(err(sim)).toBeUndefined();
    const q = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].map((p) => (volts(`s:${p}`) - volts('s:GND') > 2.5 ? 1 : 0));
    expect(q).toEqual([1, 0, 1, 0, 0, 1, 0, 1]); // QH = MSB
  });

  it('MAX7219 matrix shows rows set with LedControl', () => {
    const code = `#include <LedControl.h>
      LedControl lc(12, 11, 10, 1);
      void setup(){ lc.shutdown(0, false); lc.setIntensity(0, 8); lc.clearDisplay(0); lc.setRow(0, 2, B10000001); lc.setLed(0, 5, 3, true); }
      void loop(){}`;
    const { snap, sim } = simulate([uno(code), part('m', 'max7219-matrix')], [wire('u.5V', 'm.VCC'), wire('u.GND1', 'm.GND'), wire('u.D12', 'm.DIN'), wire('u.D11', 'm.CLK'), wire('u.D10', 'm.CS')], 0.2);
    expect(err(sim)).toBeUndefined();
    const rows = snap.comps.m!.rows as number[];
    expect(rows[2]).toBe(0x81);
    expect(rows[5]).toBe(0x10);
  });
});

describe('sensor devices', () => {
  it('HC-SR04 echo time gives the distance through pulseIn', () => {
    const code = `void setup(){ Serial.begin(9600); pinMode(9, OUTPUT); pinMode(10, INPUT); }
      void loop(){ digitalWrite(9, LOW); delayMicroseconds(2); digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW);
        long d = pulseIn(10, HIGH); Serial.println(d / 58); delay(100); }`;
    const { sim } = simulate([uno(code), part('h', 'hc-sr04', { dist: 42 })], [wire('u.5V', 'h.VCC'), wire('u.GND1', 'h.GND'), wire('u.D9', 'h.TRIG'), wire('u.D10', 'h.ECHO')], 0.3);
    expect(err(sim)).toBeUndefined();
    expect(Number(serial(sim)[0])).toBe(42);
  });

  it('DHT22 and BMP280 report their settings', () => {
    const code = `#include <DHT.h>
      #include <Adafruit_BMP280.h>
      DHT dht(2, DHT22);
      Adafruit_BMP280 bmp;
      void setup(){ Serial.begin(9600); dht.begin(); bmp.begin(0x76);
        Serial.println(dht.readTemperature(), 1); Serial.println(dht.readHumidity(), 1);
        Serial.println(bmp.readTemperature(), 1); Serial.println(bmp.readPressure() / 100.0, 1); }
      void loop(){}`;
    const { sim } = simulate(
      [uno(code), part('d', 'dht', { temp: 23.4, hum: 61.5 }), part('b', 'bmp280', { temp: 18.2, hpa: 1002.5 })],
      [wire('u.5V', 'd.VCC'), wire('u.GND1', 'd.GND'), wire('u.D2', 'd.DATA'), ...i2c('b')],
      0.3,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['23.4', '61.5', '18.2', '1002.5']);
  });

  it('MPU6050 acceleration arrives in m/s² via Adafruit_MPU6050, raw Wire reads work too', () => {
    const code = `#include <Adafruit_MPU6050.h>
      #include <Wire.h>
      Adafruit_MPU6050 mpu;
      void setup(){ Serial.begin(9600); if (!mpu.begin()) Serial.println("no mpu");
        sensors_event_t a, g, temp; mpu.getEvent(&a, &g, &temp);
        Serial.println(a.acceleration.z, 1); Serial.println(g.gyro.x, 2); Serial.println(temp.temperature, 0);
        Wire.beginTransmission(0x68); Wire.write(0x75); Wire.endTransmission(false); Wire.requestFrom(0x68, 1); Serial.println(Wire.read(), HEX); }
      void loop(){}`;
    const { sim } = simulate([uno(code), part('m', 'mpu6050', { az: 1, gx: 90, temp: 30 })], i2c('m'), 0.5);
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['9.8', '1.57', '30', '68']);
  });

  it('INA219 measures current through its shunt; ADS1115 reads a voltage; MCP4725 sets one', () => {
    const code = `#include <Adafruit_INA219.h>
      #include <Adafruit_ADS1X15.h>
      #include <Adafruit_MCP4725.h>
      Adafruit_INA219 ina; Adafruit_ADS1115 ads; Adafruit_MCP4725 dac;
      void setup(){ Serial.begin(9600); ina.begin(); ads.begin(); dac.begin(0x60); dac.setVoltage(2048, false); delay(20);
        Serial.println(ina.getCurrent_mA(), 0); Serial.println(ina.getBusVoltage_V(), 1);
        int16_t raw = ads.readADC_SingleEnded(0); Serial.println(ads.computeVolts(raw), 2); }
      void loop(){}`;
    const { sim } = simulate(
      [uno(code), part('i', 'ina219'), part('a', 'ads1115'), part('m', 'mcp4725'), part('j', 'barrel-jack', { volts: 12 }), part('r', 'resistor', { resistance: 100, power: 5 })],
      [
        ...i2c('i'), wire('u.5V', 'a.VDD'), wire('u.GND1', 'a.GND'), wire('u.A4', 'a.SDA'), wire('u.A5', 'a.SCL'), ...i2c('m'),
        wire('j.TIP', 'i.VINP'), wire('i.VINN', 'r.1'), wire('r.2', 'j.SLV'), wire('j.SLV', 'u.GND2'),
        wire('m.OUT', 'a.A0'),
      ],
      0.3,
    );
    expect(err(sim)).toBeUndefined();
    const [ma, bus, adc] = serial(sim).map(Number);
    expect(ma).toBeGreaterThan(110);
    expect(ma).toBeLessThan(122);
    expect(bus).toBeGreaterThan(11);
    expect(adc).toBeCloseTo(2.5, 1);
  });

  it('PCF8574 drives an LED low and reads a button', () => {
    const code = `#include <PCF8574.h>
      PCF8574 pcf(0x20);
      void setup(){ Serial.begin(9600); pcf.begin(); pcf.write(0, LOW); delay(10); Serial.println(pcf.read(1)); }
      void loop(){}`;
    const { sim, snap } = simulate(
      [uno(code), part('p', 'pcf8574'), part('l', 'led'), part('r', 'resistor', { resistance: 330 })],
      [...i2c('p'), wire('u.5V', 'r.1'), wire('r.2', 'l.A'), wire('l.K', 'p.P0'), wire('p.P1', 'u.GND2')],
      0.2,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['0']);
    expect(snap.comps.r!.current).toBeGreaterThan(0.005);
  });

  it('keypad scanning finds the held key', () => {
    const code = `#include <Keypad.h>
      const byte ROWS = 4, COLS = 4;
      char keys[ROWS][COLS] = {{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
      byte rowPins[ROWS] = {9, 8, 7, 6};
      byte colPins[COLS] = {5, 4, 3, 2};
      Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
      void setup(){ Serial.begin(9600); }
      void loop(){ char k = keypad.getKey(); if (k) Serial.println(k); }`;
    const { sim } = simulate(
      [uno(code), part('k', 'keypad', { key: 7, hold: 1 })],
      ['R1', 'R2', 'R3', 'R4'].map((r, i) => wire(`u.D${9 - i}`, `k.${r}`)).concat(['C1', 'C2', 'C3', 'C4'].map((c, i) => wire(`u.D${5 - i}`, `k.${c}`))),
      0.3,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['6']);
  });
});

describe('memory, time and storage', () => {
  it('DS3231 keeps the time set with RTClib', () => {
    const code = `#include <RTClib.h>
      RTC_DS3231 rtc;
      void setup(){ Serial.begin(9600); if (!rtc.begin()) Serial.println("no rtc");
        rtc.adjust(DateTime(2030, 6, 15, 10, 30, 0)); delay(2100);
        DateTime n = rtc.now(); Serial.println(n.year()); Serial.println(n.minute()); Serial.println(n.second()); Serial.println(rtc.lostPower()); }
      void loop(){}`;
    const { sim } = simulate([uno(code), part('r', 'ds3231')], i2c('r'), 2.4);
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['2030', '30', '2', '0']);
  });

  it('SD card: write a log file, read it back', () => {
    const code = `#include <SD.h>
      void setup(){ Serial.begin(9600); if (!SD.begin(4)) { Serial.println("init failed"); return; }
        File f = SD.open("log.txt", FILE_WRITE); f.println("t=1"); f.println("t=2"); f.close();
        File r = SD.open("log.txt"); while (r.available()) Serial.write(r.read()); r.close();
        Serial.println(SD.exists("log.txt")); Serial.println(SD.exists("nope.txt")); }
      void loop(){}`;
    const { sim, snap } = simulate(
      [uno(code), part('s', 'microsd-module')],
      [wire('u.5V', 's.VCC'), wire('u.GND1', 's.GND'), wire('u.D4', 's.CS'), wire('u.D11', 's.MOSI'), wire('u.D12', 's.MISO'), wire('u.D13', 's.SCK')],
      0.2,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['t=1', 't=2', '1', '0']);
    expect((snap.comps.s!.files as string[])[0]).toMatch(/log\.txt/);
  });

  it('24LC256 EEPROM and W25Q flash answer at register level', () => {
    const code = `#include <Wire.h>
      #include <SPI.h>
      void setup(){ Serial.begin(9600); Wire.begin(); SPI.begin(); pinMode(10, OUTPUT); digitalWrite(10, HIGH);
        Wire.beginTransmission(0x50); Wire.write(0); Wire.write(5); Wire.write(42); Wire.write(43); Wire.endTransmission(); delay(5);
        Wire.beginTransmission(0x50); Wire.write(0); Wire.write(5); Wire.endTransmission(); Wire.requestFrom(0x50, 2);
        Serial.println(Wire.read()); Serial.println(Wire.read());
        digitalWrite(10, LOW); SPI.transfer(0x9F); byte m = SPI.transfer(0), t = SPI.transfer(0), c = SPI.transfer(0); digitalWrite(10, HIGH);
        Serial.println(m, HEX); Serial.println(c, HEX); }
      void loop(){}`;
    const { sim } = simulate(
      [uno(code), part('e', '24lc256'), part('f', 'w25q32')],
      [...i2c('e'), wire('u.3V3', 'f.VCC'), wire('u.GND2', 'f.GND'), wire('u.D10', 'f.CS'), wire('u.D11', 'f.DI'), wire('u.D12', 'f.DO'), wire('u.D13', 'f.CLK'), wire('u.3V3', 'f.HOLD')],
      0.2,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['42', '43', 'EF', '16']);
  });
});

describe('communication devices', () => {
  it('RC522 reads the UID of a card on the reader', () => {
    const code = `#include <SPI.h>
      #include <MFRC522.h>
      MFRC522 rfid(10, 9);
      void setup(){ Serial.begin(9600); SPI.begin(); rfid.PCD_Init(); }
      void loop(){ if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
        for (byte i = 0; i < rfid.uid.size; i++) { Serial.print(rfid.uid.uidByte[i], HEX); Serial.print(' '); }
        Serial.println(); rfid.PICC_HaltA(); }`;
    const { sim } = simulate(
      [uno(code), part('r', 'rc522', { present: 1, card: 0 })],
      [wire('u.3V3', 'r.VCC'), wire('u.GND1', 'r.GND'), wire('u.D10', 'r.SDA'), wire('u.D13', 'r.SCK'), wire('u.D11', 'r.MOSI'), wire('u.D12', 'r.MISO'), wire('u.D9', 'r.RST')],
      0.3,
    );
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['DE AD BE EF']); // halted: read once per tap
  });

  it('two boards talk over nRF24L01 radios (a struct payload)', () => {
    const tx = `#include <RF24.h>
      struct Pkt { int id; float v; };
      RF24 radio(9, 10); const byte addr[6] = "00001";
      void setup(){ radio.begin(); radio.openWritingPipe(addr); radio.stopListening(); }
      void loop(){ Pkt p = {7, 3.25}; radio.write(&p, sizeof(p)); delay(50); }`;
    const rx = `#include <RF24.h>
      struct Pkt { int id; float v; };
      RF24 radio(9, 10); const byte addr[6] = "00001";
      void setup(){ Serial.begin(9600); radio.begin(); radio.openReadingPipe(0, addr); radio.startListening(); }
      void loop(){ if (radio.available()) { Pkt p; radio.read(&p, sizeof(p)); Serial.println(p.id); Serial.println(p.v); } }`;
    const radio = (b: string, r: string) => [wire(`${b}.3V3`, `${r}.VCC`), wire(`${b}.GND1`, `${r}.GND`), wire(`${b}.D9`, `${r}.CE`), wire(`${b}.D10`, `${r}.CSN`), wire(`${b}.D13`, `${r}.SCK`), wire(`${b}.D11`, `${r}.MOSI`), wire(`${b}.D12`, `${r}.MISO`)];
    const { sim } = simulate([uno(tx, 'a'), uno(rx, 'b'), part('ra', 'nrf24l01'), part('rb', 'nrf24l01')], [...radio('a', 'ra'), ...radio('b', 'rb')], 0.12);
    expect(err(sim, 'a')).toBeUndefined();
    expect(err(sim, 'b')).toBeUndefined();
    expect(serial(sim, 'b').slice(0, 2)).toEqual(['7', '3.25']);
  });

  it('GPS module NMEA → SoftwareSerial → TinyGPS++', () => {
    const code = `#include <SoftwareSerial.h>
      #include <TinyGPS++.h>
      SoftwareSerial ss(4, 3); TinyGPSPlus gps; bool done = false;
      void setup(){ Serial.begin(9600); ss.begin(9600); }
      void loop(){ while (ss.available()) gps.encode(ss.read());
        if (!done && gps.location.isUpdated()) { done = true; Serial.println(gps.location.lat(), 4); Serial.println(gps.satellites.value()); } }`;
    const { sim } = simulate([uno(code), part('g', 'gps-neo6m', { lat: 40.7128, lon: -74.006, sats: 9 })], [wire('u.5V', 'g.VCC'), wire('u.GND1', 'g.GND'), wire('g.TX', 'u.D4'), wire('u.D3', 'g.RX')], 1.2);
    expect(err(sim)).toBeUndefined();
    expect(serial(sim)).toEqual(['40.7128', '9']);
  });

  it('HC-05: the board prints to the phone, the phone sends to the board', () => {
    const code = `#include <SoftwareSerial.h>
      SoftwareSerial bt(10, 11);
      void setup(){ Serial.begin(9600); bt.begin(9600); bt.println("hello phone"); }
      void loop(){ if (bt.available()) Serial.write(bt.read()); }`;
    const { sim, snap } = simulate([uno(code), part('h', 'hc05')], [wire('u.5V', 'h.VCC'), wire('u.GND1', 'h.GND'), wire('h.TXD', 'u.D10'), wire('u.D11', 'h.RXD')], 0.1);
    expect((snap.comps.h!.term as string[]).join('\n')).toContain('hello phone');
    (sim.input('h').phone ??= []).push('ON\r\n');
    for (let i = 0; i < 5; i++) sim.advance(0.02);
    expect(serial(sim)).toEqual(['ON']);
  });

  it('ESP-01 answers AT commands', () => {
    const code = `#include <SoftwareSerial.h>
      SoftwareSerial esp(2, 3);
      void setup(){ Serial.begin(9600); esp.begin(115200); esp.println("AT"); delay(50);
        while (esp.available()) Serial.write(esp.read());
        esp.println("AT+CWJAP=\\"Home\\",\\"pw\\""); delay(3000); while (esp.available()) Serial.write(esp.read()); }
      void loop(){}`;
    const { sim } = simulate([uno(code), part('e', 'esp01')], [wire('u.3V3', 'e.VCC'), wire('u.GND1', 'e.GND'), wire('e.TX', 'u.D2'), wire('u.D3', 'e.RX')], 3.3);
    const out = sim.mcus.get('u')!.serialOut;
    expect(out).toContain('OK');
    expect(out).toContain('WIFI GOT IP');
  });

  it('two Arduinos talk over TX/RX; CAN frames cross between MCP2515 modules', () => {
    const a = `void setup(){ Serial.begin(9600); } void loop(){ Serial.println("ping"); delay(100); }`;
    const b = `void setup(){ Serial.begin(9600); } void loop(){ if (Serial.available()) { String s = Serial.readStringUntil('\\n'); s.trim(); if (s == "ping") pinMode(13, OUTPUT), digitalWrite(13, HIGH); } }`;
    const r1 = simulate([uno(a, 'a'), uno(b, 'b')], [wire('a.D1', 'b.D0'), wire('a.GND1', 'b.GND1')], 0.3);
    expect(r1.sim.mcus.get('b')!.pins[13].value).toBe(1);

    const tx = `#include <mcp_can.h>
      MCP_CAN CAN(10); byte d[2] = {0x12, 0x34};
      void setup(){ CAN.begin(MCP_ANY, CAN_500KBPS, MCP_8MHZ); CAN.setMode(MCP_NORMAL); CAN.sendMsgBuf(0x100, 0, 2, d); } void loop(){}`;
    const rx = `#include <mcp_can.h>
      MCP_CAN CAN(10); long unsigned int id; unsigned char len = 0; unsigned char buf[8];
      void setup(){ Serial.begin(9600); CAN.begin(MCP_ANY, CAN_500KBPS, MCP_8MHZ); CAN.setMode(MCP_NORMAL); }
      void loop(){ if (CAN.checkReceive() == CAN_MSGAVAIL) { CAN.readMsgBuf(&id, &len, buf); Serial.println(id, HEX); Serial.println(buf[1], HEX); } }`;
    const can = (bd: string, m: string) => [wire(`${bd}.5V`, `${m}.VCC`), wire(`${bd}.GND1`, `${m}.GND`), wire(`${bd}.D10`, `${m}.CS`), wire(`${bd}.D13`, `${m}.SCK`), wire(`${bd}.D11`, `${m}.SI`), wire(`${bd}.D12`, `${m}.SO`)];
    const r2 = simulate([uno(rx, 'r'), uno(tx, 't'), part('mr', 'mcp2515'), part('mt', 'mcp2515')], [...can('r', 'mr'), ...can('t', 'mt'), wire('mr.CANH', 'mt.CANH'), wire('mr.CANL', 'mt.CANL')], 0.2);
    expect(serial(r2.sim, 'r')).toEqual(['100', '34']);
  });

  it('PCA9685 channel drives a servo', () => {
    const code = `#include <Adafruit_PWMServoDriver.h>
      Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
      void setup(){ pwm.begin(); pwm.setPWMFreq(50); pwm.writeMicroseconds(0, 2400); }
      void loop(){}`;
    const { snap, sim } = simulate(
      [uno(code), part('p', 'pca9685'), part('s', 'servo'), part('bat', 'battery', { kind: 'AA4' })],
      [...i2c('p'), wire('p.PWM0', 's.SIG'), wire('bat.+', 's.+'), wire('bat.-', 's.-'), wire('bat.-', 'u.GND2')],
      1.2,
    );
    expect(err(sim)).toBeUndefined();
    expect(Number(snap.comps.s!.angle)).toBeGreaterThan(170);
  });
});
