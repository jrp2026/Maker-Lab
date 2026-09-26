/**
 * Sensor & I2C chip libraries (DHT, BMP280, MPU6050, QMC5883L, INA219, ADS1115, MCP4725,
 * PCF8574) and RTClib. The I2C ones talk to the simulated chips register by register, so raw
 * Wire code works too.
 */
import type { McuRuntime } from '../runtime';
import { BMP280_CALIB, bmpPressure, bmpTemperature, bmpTFine, type Bmp280Calib } from './bmp280math';
import { bcd2bin, bin2bcd, i2cRead, i2cReadReg, i2cWrite, s16, s16le, u16le } from './i2c';

const hex = (a: number) => `0x${a.toString(16).toUpperCase().padStart(2, '0')}`;

// ------------------------------------------------------------------ DHT11 / DHT22

/** What a DHT device exposes to the library. */
export interface DhtSensor {
  model: number; // 11 or 22
  temperature: number;
  humidity: number;
}

export class DhtLib {
  private lastRead = -1e12;
  private t = NaN;
  private h = NaN;
  private warned = false;
  constructor(private R: McuRuntime, private pin: number, private type: number) {}
  begin() {
    this.R.pinMode(this.pin, 2);
  }
  read() {
    if (this.R.t - this.lastRead < 2e6 && !Number.isNaN(this.t)) return true; // the library caches for 2 s
    this.R.t += 5000; // start signal + 40 bits
    this.lastRead = this.R.t;
    const s = this.R.env.device('dht', this.pin) as DhtSensor | null;
    if (!s) {
      if (!this.warned) this.R.warnLib(`DHT: no sensor answered on pin ${this.pin} — connect its DATA pin there (with a 10 kΩ pull-up) and power it.`);
      this.warned = true;
      this.t = this.h = NaN;
      return false;
    }
    if ((s.model === 11) !== (this.type === 11)) {
      if (!this.warned) this.R.warnLib(`DHT: the sketch says DHT${this.type} but a DHT${s.model} is wired — the readings will be wrong.`);
      this.warned = true;
      // decode the other sensor's bytes with the wrong format, like the real library would
      const raw = s.model === 11 ? [Math.round(s.humidity), 0, Math.round(s.temperature), 0] : [(Math.round(s.humidity * 10) >> 8) & 255, Math.round(s.humidity * 10) & 255, (Math.round(s.temperature * 10) >> 8) & 255, Math.round(s.temperature * 10) & 255];
      this.h = this.type === 11 ? raw[0] : ((raw[0] << 8) | raw[1]) / 10;
      this.t = this.type === 11 ? raw[2] : ((raw[2] << 8) | raw[3]) / 10;
      return true;
    }
    this.t = s.model === 11 ? Math.round(s.temperature) : Math.round(s.temperature * 10) / 10;
    this.h = s.model === 11 ? Math.round(s.humidity) : Math.round(s.humidity * 10) / 10;
    return true;
  }
  readTemperature(f = 0) {
    this.read();
    return f ? this.convertCtoF(this.t) : this.t;
  }
  readHumidity() {
    this.read();
    return this.h;
  }
  convertCtoF(c: number) {
    return (c * 9) / 5 + 32;
  }
  convertFtoC(f: number) {
    return ((f - 32) * 5) / 9;
  }
  computeHeatIndex(t: number, h: number, isF = 1) {
    let T = isF ? t : this.convertCtoF(t);
    let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + h * 0.094);
    if (hi > 79) {
      hi = -42.379 + 2.04901523 * T + 10.14333127 * h - 0.22475541 * T * h - 0.00683783 * T * T - 0.05481717 * h * h + 0.00122874 * T * T * h + 0.00085282 * T * h * h - 0.00000199 * T * T * h * h;
      if (h < 13 && T >= 80 && T <= 112) hi -= ((13 - h) * 0.25) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
      else if (h > 85 && T >= 80 && T <= 87) hi += ((h - 85) * 0.1) * ((87 - T) * 0.2);
    }
    T = hi;
    return isF ? T : this.convertFtoC(T);
  }
}

// ------------------------------------------------------------------ BMP280

export class Bmp280Lib {
  private addr = 0x77;
  private c: Bmp280Calib = BMP280_CALIB;
  private tFine = 0;
  constructor(private R: McuRuntime) {}
  begin(addr = 0x77, chipId = 0x58) {
    this.addr = addr;
    const id = i2cReadReg(this.R, addr, 0xd0, 1)[0];
    if (id !== chipId) {
      this.R.warnLib(`Adafruit_BMP280: no BMP280 at ${hex(addr)} (try bmp.begin(0x76) — most purple modules use 0x76).`);
      return false;
    }
    const b = i2cReadReg(this.R, addr, 0x88, 24);
    this.c = { T1: u16le(b, 0), T2: s16le(b, 2), T3: s16le(b, 4), P1: u16le(b, 6), P2: s16le(b, 8), P3: s16le(b, 10), P4: s16le(b, 12), P5: s16le(b, 14), P6: s16le(b, 16), P7: s16le(b, 18), P8: s16le(b, 20), P9: s16le(b, 22) };
    this.setSampling();
    return true;
  }
  setSampling() {
    i2cWrite(this.R, this.addr, [0xf5, 0x00]);
    i2cWrite(this.R, this.addr, [0xf4, 0x57]); // normal mode, oversampling
  }
  sensorID() {
    return i2cReadReg(this.R, this.addr, 0xd0, 1)[0] ?? 0;
  }
  private raw() {
    const d = i2cReadReg(this.R, this.addr, 0xf7, 6);
    const adcP = ((d[0] ?? 0) << 12) | ((d[1] ?? 0) << 4) | ((d[2] ?? 0) >> 4);
    const adcT = ((d[3] ?? 0) << 12) | ((d[4] ?? 0) << 4) | ((d[5] ?? 0) >> 4);
    return { adcP, adcT };
  }
  readTemperature() {
    const { adcT } = this.raw();
    this.tFine = bmpTFine(adcT, this.c);
    return bmpTemperature(adcT, this.c);
  }
  readPressure() {
    this.readTemperature();
    return bmpPressure(this.raw().adcP, this.tFine, this.c);
  }
  readAltitude(sea = 1013.25) {
    const p = this.readPressure() / 100;
    return 44330 * (1 - Math.pow(p / sea, 0.1903));
  }
  seaLevelForAltitude(alt: number, p: number) {
    return p / Math.pow(1 - alt / 44330, 5.255);
  }
}

// ------------------------------------------------------------------ MPU6050 (Adafruit_MPU6050)

type Vec = { x: number; y: number; z: number };
type SensEvent = { acceleration: Vec; gyro: Vec; temperature: number; timestamp: number; type: number };

export class Mpu6050Lib {
  private addr = 0x68;
  private accRange = 0;
  private gyroRange = 1;
  private bw = 0;
  constructor(private R: McuRuntime) {}
  begin(addr = 0x68) {
    this.addr = addr;
    const who = i2cReadReg(this.R, addr, 0x75, 1)[0];
    if (who !== 0x68 && who !== 0x72 && who !== 0x70) {
      this.R.warnLib(`Adafruit_MPU6050: no MPU6050 answered at ${hex(addr)} (AD0 LOW = 0x68, HIGH = 0x69).`);
      return false;
    }
    this.reset();
    i2cWrite(this.R, addr, [0x19, 0]);
    this.setFilterBandwidth(0);
    this.setGyroRange(1);
    this.setAccelerometerRange(0);
    i2cWrite(this.R, addr, [0x6b, 0x01]); // wake, PLL clock
    this.R.t += 100000;
    return true;
  }
  reset() {
    i2cWrite(this.R, this.addr, [0x6b, 0x80]);
    this.R.t += 100000;
  }
  setAccelerometerRange(r: number) {
    this.accRange = r & 3;
    i2cWrite(this.R, this.addr, [0x1c, this.accRange << 3]);
  }
  setGyroRange(r: number) {
    this.gyroRange = r & 3;
    i2cWrite(this.R, this.addr, [0x1b, this.gyroRange << 3]);
  }
  setFilterBandwidth(b: number) {
    this.bw = b & 7;
    i2cWrite(this.R, this.addr, [0x1a, this.bw]);
  }
  setTemperatureStandby() {}
  getAccelerometerRange() {
    return this.accRange;
  }
  getGyroRange() {
    return this.gyroRange;
  }
  getFilterBandwidth() {
    return this.bw;
  }
  getEvent(a: unknown[], g: unknown[], t: unknown[]) {
    const d = i2cReadReg(this.R, this.addr, 0x3b, 14);
    if (d.length < 14) return false;
    const v = (i: number) => s16(d[i], d[i + 1]);
    const aScale = 16384 / (1 << this.accRange), gScale = 131 / (1 << this.gyroRange);
    const now = Math.floor(this.R.t / 1000);
    const fill = (target: unknown, fn: (e: SensEvent) => void) => {
      const e = (Array.isArray(target) ? target[0] : target) as SensEvent;
      if (e && typeof e === 'object') {
        e.timestamp = now;
        fn(e);
      }
    };
    fill(a, (e) => {
      e.type = 1;
      e.acceleration.x = (v(0) / aScale) * 9.80665;
      e.acceleration.y = (v(2) / aScale) * 9.80665;
      e.acceleration.z = (v(4) / aScale) * 9.80665;
    });
    fill(g, (e) => {
      e.type = 4;
      e.gyro.x = (v(8) / gScale) * 0.017453293;
      e.gyro.y = (v(10) / gScale) * 0.017453293;
      e.gyro.z = (v(12) / gScale) * 0.017453293;
    });
    fill(t, (e) => {
      e.type = 13;
      e.temperature = v(6) / 340 + 36.53;
    });
    return true;
  }
}

// ------------------------------------------------------------------ QMC5883L (QMC5883LCompass)

export class Qmc5883Lib {
  private addr = 0x0d;
  private v = [0, 0, 0];
  private cal: number[] | null = null;
  private decl = 0;
  constructor(private R: McuRuntime) {}
  setADDR(a: number) {
    this.addr = a;
  }
  init() {
    if (!i2cWrite(this.R, this.addr, [0x0b, 0x01])) this.R.warnLib(`QMC5883LCompass: nothing answered at ${hex(this.addr)} — check SDA/SCL and power.`);
    this.setMode(0x01, 0x0c, 0x10, 0x00);
  }
  setMode(mode: number, odr: number, rng: number, osr: number) {
    i2cWrite(this.R, this.addr, [0x09, mode | odr | rng | osr]);
  }
  setReset() {
    i2cWrite(this.R, this.addr, [0x0a, 0x80]);
  }
  setSmoothing() {}
  setMagneticDeclination(deg: number, min: number) {
    this.decl = deg + min / 60;
  }
  setCalibration(xmin: number, xmax: number, ymin: number, ymax: number, zmin: number, zmax: number) {
    this.cal = [xmin, xmax, ymin, ymax, zmin, zmax];
  }
  read() {
    const d = i2cReadReg(this.R, this.addr, 0x00, 6);
    this.v = [s16le(d, 0), s16le(d, 2), s16le(d, 4)];
    if (this.cal) {
      const c = this.cal;
      const off = [(c[0] + c[1]) / 2, (c[2] + c[3]) / 2, (c[4] + c[5]) / 2];
      const delta = [(c[1] - c[0]) / 2, (c[3] - c[2]) / 2, (c[5] - c[4]) / 2];
      const avg = (delta[0] + delta[1] + delta[2]) / 3 || 1;
      this.v = this.v.map((x, i) => Math.round((x - off[i]) * (avg / (delta[i] || 1))));
    }
  }
  getX() {
    return this.v[0];
  }
  getY() {
    return this.v[1];
  }
  getZ() {
    return this.v[2];
  }
  getAzimuth() {
    let a = Math.trunc((Math.atan2(this.v[1], this.v[0]) * 180) / Math.PI + this.decl);
    if (a < 0) a += 360;
    return a % 360;
  }
  getBearing(az: number) {
    return Math.floor((((az % 360) + 360) % 360 + 11.25) / 22.5) % 16;
  }
}

// ------------------------------------------------------------------ INA219

export class Ina219Lib {
  private calValue = 4096;
  private currentDiv = 10;
  private powerMul = 2;
  private ok = false;
  constructor(private R: McuRuntime, private addr = 0x40) {}
  begin() {
    this.ok = i2cWrite(this.R, this.addr, [0x00]);
    if (!this.ok) this.R.warnLib(`Adafruit_INA219: no INA219 answered at ${hex(this.addr)}.`);
    this.setCalibration_32V_2A();
    return this.ok;
  }
  success() {
    return this.ok;
  }
  private cal(value: number, div: number, mul: number, config: number) {
    this.calValue = value;
    this.currentDiv = div;
    this.powerMul = mul;
    i2cWrite(this.R, this.addr, [0x05, (value >> 8) & 255, value & 255]);
    i2cWrite(this.R, this.addr, [0x00, (config >> 8) & 255, config & 255]);
  }
  setCalibration_32V_2A() {
    this.cal(4096, 10, 2, 0x399f);
  }
  setCalibration_32V_1A() {
    this.cal(10240, 25, 0.8, 0x399f);
  }
  setCalibration_16V_400mA() {
    this.cal(8192, 20, 1, 0x019f);
  }
  powerSave(on: number) {
    i2cWrite(this.R, this.addr, [0x00, 0x39, on ? 0x98 : 0x9f]);
  }
  private reg(r: number) {
    const b = i2cReadReg(this.R, this.addr, r, 2);
    return s16(b[0] ?? 0, b[1] ?? 0);
  }
  getBusVoltage_V() {
    return (((this.reg(0x02) & 0xffff) >> 3) * 4) / 1000;
  }
  getShuntVoltage_mV() {
    return this.reg(0x01) * 0.01;
  }
  getCurrent_mA() {
    i2cWrite(this.R, this.addr, [0x05, (this.calValue >> 8) & 255, this.calValue & 255]);
    return this.reg(0x04) / this.currentDiv;
  }
  getPower_mW() {
    i2cWrite(this.R, this.addr, [0x05, (this.calValue >> 8) & 255, this.calValue & 255]);
    return this.reg(0x03) * this.powerMul;
  }
}

// ------------------------------------------------------------------ ADS1115

const ADS_FS: Record<number, number> = { 0x0000: 6.144, 0x0200: 4.096, 0x0400: 2.048, 0x0600: 1.024, 0x0800: 0.512, 0x0a00: 0.256 };

export class Ads1115Lib {
  private addr = 0x48;
  private gain = 0x0000;
  private rate = 0x0080;
  constructor(private R: McuRuntime) {}
  begin(addr = 0x48) {
    this.addr = addr;
    const ok = i2cWrite(this.R, addr, [0x00]);
    if (!ok) this.R.warnLib(`Adafruit_ADS1115: nothing answered at ${hex(addr)} (ADDR pin: GND 0x48, VDD 0x49, SDA 0x4A, SCL 0x4B).`);
    return ok;
  }
  setGain(g: number) {
    this.gain = g;
  }
  getGain() {
    return this.gain;
  }
  setDataRate(r: number) {
    this.rate = r;
  }
  private convert(mux: number) {
    const cfg = 0x8000 | (mux << 12) | this.gain | 0x0100 | this.rate | 0x0003;
    i2cWrite(this.R, this.addr, [0x01, (cfg >> 8) & 255, cfg & 255]);
    this.R.t += 8000; // 128 SPS
    const b = i2cReadReg(this.R, this.addr, 0x00, 2);
    return s16(b[0] ?? 0, b[1] ?? 0);
  }
  readADC_SingleEnded(ch: number) {
    return ch < 0 || ch > 3 ? 0 : this.convert(4 + ch);
  }
  readADC_Differential_0_1() {
    return this.convert(0);
  }
  readADC_Differential_0_3() {
    return this.convert(1);
  }
  readADC_Differential_1_3() {
    return this.convert(2);
  }
  readADC_Differential_2_3() {
    return this.convert(3);
  }
  computeVolts(counts: number) {
    return (counts * (ADS_FS[this.gain] ?? 6.144)) / 32768;
  }
}

// ------------------------------------------------------------------ MCP4725

export class Mcp4725Lib {
  private addr = 0x60;
  constructor(private R: McuRuntime) {}
  begin(addr = 0x62) {
    this.addr = addr;
    const ok = i2cWrite(this.R, addr, []);
    if (!ok) this.R.warnLib(`Adafruit_MCP4725: nothing answered at ${hex(addr)} (modules are 0x60 or 0x62; try dac.begin(0x60)).`);
    return ok;
  }
  setVoltage(v: number, eeprom = 0) {
    v = Math.max(0, Math.min(4095, Math.trunc(v)));
    return i2cWrite(this.R, this.addr, [eeprom ? 0x60 : 0x40, v >> 4, (v & 15) << 4]);
  }
}

// ------------------------------------------------------------------ PCF8574

export class Pcf8574Lib {
  private out = 0xff;
  private err = 0;
  constructor(private R: McuRuntime, private addr = 0x20) {}
  begin(a?: number, b?: number, v = 0xff) {
    // Rob Tillaart: begin(value) / begin(sda, scl, value) on ESP32; xreef: begin()
    if (a !== undefined && b === undefined && a <= 0xff) v = a;
    return this.write8(v), this.isConnected();
  }
  isConnected() {
    return i2cWrite(this.R, this.addr, []);
  }
  lastError() {
    return this.err;
  }
  write8(v: number) {
    this.out = v & 255;
    this.err = i2cWrite(this.R, this.addr, [this.out]) ? 0 : 1;
  }
  read8() {
    const b = i2cRead(this.R, this.addr, 1);
    this.err = b.length ? 0 : 1;
    return b[0] ?? 0;
  }
  valueOut() {
    return this.out;
  }
  write(pin: number, v: number) {
    this.write8(v ? this.out | (1 << pin) : this.out & ~(1 << pin));
  }
  read(pin: number) {
    return (this.read8() >> pin) & 1;
  }
  toggle(pin: number) {
    this.write8(this.out ^ (1 << pin));
  }
  pinMode(pin: number, mode: number) {
    if (mode !== 1) this.write(pin, 1); // inputs are released high (quasi-bidirectional)
  }
  digitalWrite(pin: number, v: number) {
    this.write(pin, v);
  }
  digitalRead(pin: number) {
    return this.read(pin);
  }
}

// ------------------------------------------------------------------ RTClib

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class DateTimeLib {
  /** seconds since 1970-01-01 (UTC, used as local time like RTClib does) */
  t: number;
  constructor(_R: McuRuntime | null, ...a: unknown[]) {
    if (a.length >= 3) this.t = Date.UTC(Number(a[0]) < 100 ? 2000 + Number(a[0]) : Number(a[0]), Number(a[1]) - 1, Number(a[2]), Number(a[3] ?? 0), Number(a[4] ?? 0), Number(a[5] ?? 0)) / 1000;
    else if (a.length === 2 && typeof a[0] === 'string') {
      // DateTime(F(__DATE__), F(__TIME__)): "Sep 26 2026", "12:34:56"
      const [mon, day, year] = String(a[0]).trim().split(/\s+/);
      const [h, m, s] = String(a[1]).split(':').map(Number);
      this.t = Date.UTC(Number(year), Math.max(0, MONTHS.indexOf(mon)), Number(day), h || 0, m || 0, s || 0) / 1000;
    } else if (a.length === 1 && a[0] instanceof DateTimeLib) this.t = a[0].t;
    else if (a.length === 1 && typeof a[0] === 'string') {
      const d = Date.parse(`${a[0]}Z`);
      this.t = Number.isNaN(d) ? 946684800 : d / 1000;
    } else if (a.length === 1) this.t = Number(a[0]) >>> 0;
    else this.t = 946684800; // 2000-01-01
  }
  private get d() {
    return new Date(this.t * 1000);
  }
  year() { return this.d.getUTCFullYear(); }
  month() { return this.d.getUTCMonth() + 1; }
  day() { return this.d.getUTCDate(); }
  hour() { return this.d.getUTCHours(); }
  minute() { return this.d.getUTCMinutes(); }
  second() { return this.d.getUTCSeconds(); }
  dayOfTheWeek() { return this.d.getUTCDay(); }
  twelveHour() { const h = this.hour() % 12; return h === 0 ? 12 : h; }
  isPM() { return this.hour() >= 12 ? 1 : 0; }
  unixtime() { return this.t >>> 0; }
  secondstime() { return (this.t - 946684800) >>> 0; }
  isValid() { return this.year() >= 2000 && this.year() <= 2099; }
  timestamp(opt = 0) {
    const iso = this.d.toISOString().slice(0, 19);
    return opt === 1 ? iso.slice(11) : opt === 2 ? iso.slice(0, 10) : iso;
  }
}

class RtcI2CBase {
  protected addr = 0x68;
  constructor(protected R: McuRuntime, protected chip: string) {}
  begin() {
    const ok = i2cWrite(this.R, this.addr, [0x00]);
    if (!ok) this.R.warnLib(`RTC_${this.chip}: no RTC answered at 0x68 — check SDA/SCL and power.`);
    return ok;
  }
  now() {
    const b = i2cReadReg(this.R, this.addr, 0x00, 7);
    if (b.length < 7) return new DateTimeLib(null);
    return new DateTimeLib(null, 2000 + bcd2bin(b[6]), bcd2bin(b[5] & 0x1f), bcd2bin(b[4]), bcd2bin(b[2] & 0x3f), bcd2bin(b[1]), bcd2bin(b[0] & 0x7f));
  }
  adjust(dt: DateTimeLib) {
    i2cWrite(this.R, this.addr, [0x00, bin2bcd(dt.second()), bin2bcd(dt.minute()), bin2bcd(dt.hour()), dt.dayOfTheWeek() || 7, bin2bcd(dt.day()), bin2bcd(dt.month()), bin2bcd(dt.year() - 2000)]);
    if (this.chip === 'DS3231') {
      const st = i2cReadReg(this.R, this.addr, 0x0f, 1)[0] ?? 0;
      i2cWrite(this.R, this.addr, [0x0f, st & ~0x80]);
    }
  }
}

export class DS3231Lib extends RtcI2CBase {
  constructor(R: McuRuntime) {
    super(R, 'DS3231');
  }
  lostPower() {
    return ((i2cReadReg(this.R, this.addr, 0x0f, 1)[0] ?? 0) & 0x80) !== 0;
  }
  getTemperature() {
    const b = i2cReadReg(this.R, this.addr, 0x11, 2);
    return ((b[0] ?? 0) << 24 >> 24) + ((b[1] ?? 0) >> 6) * 0.25;
  }
}

export class DS1307Lib extends RtcI2CBase {
  constructor(R: McuRuntime) {
    super(R, 'DS1307');
  }
  isrunning() {
    return ((i2cReadReg(this.R, this.addr, 0x00, 1)[0] ?? 0x80) & 0x80) === 0;
  }
}

export class RtcMillisLib {
  private offset = 946684800;
  constructor(private R: McuRuntime) {}
  begin(dt?: DateTimeLib) {
    if (dt) this.adjust(dt);
    return true;
  }
  adjust(dt: DateTimeLib) {
    this.offset = dt.t - Math.floor(this.R.t / 1e6);
  }
  now() {
    return new DateTimeLib(null, this.offset + Math.floor(this.R.t / 1e6));
  }
}
