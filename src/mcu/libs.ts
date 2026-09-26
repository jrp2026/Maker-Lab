/**
 * Arduino libraries implemented on top of the simulated hardware:
 * Servo (50 Hz pulses on a pin), LiquidCrystal (parallel HD44780), LiquidCrystal_I2C
 * (PCF8574 backpack, spoken over the simulated Wire bus) and Wire itself.
 */
import type { HD44780 } from '../sim/hd44780';
import type { McuRuntime } from './runtime';
import { UartPort } from './stdlib';
import { LedControlLib, NeoPixelLib, SSD1306Lib } from './devlibs/display';
import { AccelStepperLib, KeypadLib, NewPingLib, PwmServoLib, StepperLib } from './devlibs/motion';
import { Ads1115Lib, Bmp280Lib, DateTimeLib, DhtLib, DS1307Lib, DS3231Lib, Ina219Lib, Mcp4725Lib, Mpu6050Lib, Pcf8574Lib, Qmc5883Lib, RtcMillisLib } from './devlibs/sensors';
import { McpCanLib, Mfrc522Lib, Pn532Lib, Rf24Lib, TinyGpsLib } from './devlibs/comm';

export interface I2CDevice {
  write(bytes: number[]): void;
  read(n: number): number[];
}

/** Hooks the simulator provides so libraries can find the hardware they're wired to. */
export interface McuEnv {
  /** HD44780 whose RS and E pins are wired to these MCU pins */
  lcdFor(rs: number, en: number, data: number[]): HD44780 | null;
  /** powered I2C device at `addr` on this board's SDA/SCL bus */
  i2c(addr: number): I2CDevice | null;
  /** exchange one byte with the SPI devices whose chip-select is currently LOW (0xFF if none) */
  spi(out: number): number;
  /** high-level API of a powered device of this kind wired to the board pin (DHT data, NeoPixel DIN, RC522 SS …) */
  device(kind: string, pin: number): any;
  /** text written on a UART TX pin reaches the devices / boards listening on that net */
  uartSend(txPin: number, data: string): void;
  /** a device's pulse on this pin (HC-SR04 echo) in µs, or null when nothing drives one */
  pulse(pin: number, state: number): number | null;
}

const hex = (a: number) => `0x${a.toString(16).toUpperCase().padStart(2, '0')}`;

// ------------------------------------------------------------------ Servo

export class ServoLib {
  pin = -1;
  min = 544;
  max = 2400;
  us = 1500;
  constructor(private R: McuRuntime) {}
  attach(pin: number, min?: number, max?: number) {
    const idx = this.R.pinIndex(pin);
    if (min !== undefined) this.min = min;
    if (max !== undefined) this.max = max;
    this.pin = idx;
    this.apply();
    return 1;
  }
  private apply() {
    if (this.pin < 0) return;
    const p = this.R.pins[this.pin];
    p.mode = 'output';
    p.pwm = null;
    p.tone = null;
    p.dac = null;
    p.servo = this.us;
  }
  write(v: number) {
    if (v < this.min) {
      const a = Math.max(0, Math.min(180, v));
      this.us = Math.round(this.min + ((this.max - this.min) * a) / 180);
    } else this.us = v;
    this.apply();
  }
  writeMicroseconds(us: number) {
    this.us = Math.max(this.min, Math.min(this.max, us));
    this.apply();
  }
  read() {
    return Math.round(((this.us - this.min) * 180) / (this.max - this.min));
  }
  readMicroseconds() {
    return this.us;
  }
  attached() {
    return this.pin >= 0;
  }
  detach() {
    if (this.pin >= 0) this.R.pins[this.pin].servo = null;
    this.pin = -1;
  }
}

// ------------------------------------------------------------------ shared LCD API

abstract class LcdBase {
  cols = 16;
  rows = 2;
  protected displayCtl = 0x04;
  protected entry = 0x02;
  constructor(protected R: McuRuntime) {}
  protected abstract send(value: number, rs: boolean): void;

  command(c: number) {
    this.send(c, false);
    this.R.t += c === 0x01 || c === 0x02 ? 1600 : 40;
  }
  write(c: number) {
    this.send(c & 255, true);
    this.R.t += 40;
    return 1;
  }
  writeStr(s: string) {
    return this.print(s);
  }
  print(s: string) {
    for (let i = 0; i < s.length; i++) this.write(s.charCodeAt(i));
    return s.length;
  }
  println(s: string) {
    // the real library sends "\r\n", which shows up as two junk glyphs on the display
    return this.print(`${s}\r\n`);
  }
  protected setup(cols: number, rows: number) {
    this.cols = cols || 16;
    this.rows = rows || 2;
    this.command(0x20 | 0x08); // 4-bit, 2 lines
    this.displayCtl = 0x04;
    this.command(0x08 | this.displayCtl);
    this.clear();
    this.entry = 0x02;
    this.command(0x04 | this.entry);
  }
  clear() {
    this.command(0x01);
  }
  home() {
    this.command(0x02);
  }
  setCursor(c: number, r: number) {
    const off = [0x00, 0x40, this.cols, 0x40 + this.cols];
    r = Math.max(0, Math.min(this.rows - 1, r));
    this.command(0x80 | ((c + off[r]) & 0x7f));
  }
  private ctl(bit: number, on: boolean) {
    this.displayCtl = on ? this.displayCtl | bit : this.displayCtl & ~bit;
    this.command(0x08 | this.displayCtl);
  }
  display() { this.ctl(0x04, true); }
  noDisplay() { this.ctl(0x04, false); }
  cursor() { this.ctl(0x02, true); }
  noCursor() { this.ctl(0x02, false); }
  blink() { this.ctl(0x01, true); }
  noBlink() { this.ctl(0x01, false); }
  scrollDisplayLeft() { this.command(0x18); }
  scrollDisplayRight() { this.command(0x1c); }
  private ent(bit: number, on: boolean) {
    this.entry = on ? this.entry | bit : this.entry & ~bit;
    this.command(0x04 | this.entry);
  }
  leftToRight() { this.ent(0x02, true); }
  rightToLeft() { this.ent(0x02, false); }
  autoscroll() { this.ent(0x01, true); }
  noAutoscroll() { this.ent(0x01, false); }
  createChar(loc: number, bytes: number[]) {
    this.command(0x40 | ((loc & 7) << 3));
    for (let i = 0; i < 8; i++) this.write(Number(bytes[i] ?? 0));
    this.command(0x80);
  }
}

// ------------------------------------------------------------------ LiquidCrystal (parallel)

export class LiquidCrystalLib extends LcdBase {
  rs: number;
  en: number;
  data: number[];
  constructor(R: McuRuntime, args: number[]) {
    super(R);
    // (rs,en,d4..d7) | (rs,rw,en,d4..d7) | (rs,en,d0..d7) | (rs,rw,en,d0..d7)
    const a = args.map(Number);
    if (a.length === 6) [this.rs, this.en, this.data] = [a[0], a[1], a.slice(2)];
    else if (a.length === 7) [this.rs, this.en, this.data] = [a[0], a[2], a.slice(3)];
    else if (a.length === 10) [this.rs, this.en, this.data] = [a[0], a[1], a.slice(6)];
    else [this.rs, this.en, this.data] = [a[0], a[2], a.slice(7)];
    for (const p of [this.rs, this.en, ...this.data]) R.pinIndex(p);
  }
  begin(cols = 16, rows = 2) {
    this.setup(cols, rows);
  }
  protected send(value: number, rs: boolean) {
    const lcd = this.R.env.lcdFor(this.rs, this.en, this.data);
    if (!lcd) {
      this.R.warnLib(`LiquidCrystal: no LCD found with RS on pin ${this.rs} and E on pin ${this.en}. Check the wiring matches LiquidCrystal lcd(...).`);
      return;
    }
    if (rs) lcd.data(value);
    else lcd.command(value);
  }
}

// ------------------------------------------------------------------ LiquidCrystal_I2C

export class LiquidCrystalI2CLib extends LcdBase {
  private bl = 0x08;
  private warned = false;
  constructor(R: McuRuntime, private addr: number, cols: number, rows: number) {
    super(R);
    this.cols = cols;
    this.rows = rows;
  }
  private expander(b: number) {
    const ok = this.R.wire.transmitRaw(this.addr, [b | this.bl]);
    if (!ok && !this.warned) {
      this.warned = true;
      this.R.warnLib(`LiquidCrystal_I2C: no device answered at ${hex(this.addr)}. Connect SDA and SCL to the board's I2C pins and power the display.`);
    }
  }
  private write4(nib: number, mode: number) {
    const b = (nib & 0xf0) | mode;
    this.expander(b);
    this.expander(b | 0x04); // EN high
    this.expander(b & ~0x04); // EN low → latch
  }
  protected send(value: number, rs: boolean) {
    const mode = rs ? 0x01 : 0;
    this.write4(value & 0xf0, mode);
    this.write4((value << 4) & 0xf0, mode);
  }
  init() {
    this.begin();
  }
  begin(cols?: number, rows?: number) {
    if (cols) this.cols = cols;
    if (rows) this.rows = rows;
    this.R.t += 50000;
    this.expander(0);
    for (let i = 0; i < 3; i++) this.write4(0x30, 0);
    this.write4(0x20, 0); // switch to 4-bit
    this.setup(this.cols, this.rows);
    this.home();
  }
  backlight() {
    this.bl = 0x08;
    this.expander(0);
  }
  noBacklight() {
    this.bl = 0;
    this.expander(0);
  }
  setBacklight(on: number) {
    if (on) this.backlight();
    else this.noBacklight();
  }
}

// ------------------------------------------------------------------ Wire (I2C master)

export class WireLib {
  private txAddr = -1;
  private tx: number[] = [];
  private rx: number[] = [];
  private clock = 100000;
  constructor(private R: McuRuntime) {}
  begin() {}
  end() {}
  setPins() {
    return true;
  }
  setClock(hz: number) {
    this.clock = Math.max(10000, Math.min(1000000, Number(hz) || 100000));
  }
  /** µs per byte on the wire (9 clocks) */
  private get byteTime() {
    return 9e6 / this.clock;
  }
  beginTransmission(addr: number) {
    this.txAddr = addr & 0x7f;
    this.tx = [];
  }
  write(x: number | number[], n?: number) {
    if (Array.isArray(x)) {
      const bytes = x.slice(0, n ?? x.length).map((b) => Number(b) & 255);
      this.tx.push(...bytes);
      return bytes.length;
    }
    this.tx.push(Number(x) & 255);
    return 1;
  }
  writeStr(s: string) {
    for (let i = 0; i < s.length; i++) this.tx.push(s.charCodeAt(i) & 255);
    return s.length;
  }
  endTransmission() {
    const ok = this.transmitRaw(this.txAddr, this.tx);
    this.tx = [];
    return ok ? 0 : 2; // 2 = address NACK
  }
  /** Send bytes to a device; false when nothing acknowledges the address. */
  transmitRaw(addr: number, bytes: number[]): boolean {
    this.R.t += this.byteTime * (bytes.length + 1);
    const dev = this.R.env.i2c(addr & 0x7f);
    if (!dev) return false;
    dev.write(bytes);
    return true;
  }
  requestFrom(addr: number, n: number) {
    this.R.t += this.byteTime * (n + 1);
    const dev = this.R.env.i2c(addr & 0x7f);
    this.rx = dev ? dev.read(n).slice(0, n) : [];
    return this.rx.length;
  }
  available() {
    return this.rx.length;
  }
  read() {
    return this.rx.length ? this.rx.shift()! : -1;
  }
}

export function createLib(R: McuRuntime, cls: string, args: unknown[]): unknown {
  const n = (i: number, d = 0) => (args[i] === undefined ? d : Number(args[i]));
  switch (cls) {
    case 'Servo':
      return new ServoLib(R);
    case 'LiquidCrystal':
      return new LiquidCrystalLib(R, args as number[]);
    case 'LiquidCrystal_I2C':
      return new LiquidCrystalI2CLib(R, n(0), n(1), n(2));
    case 'SoftwareSerial': {
      const p = new UartPort(R, R.pinIndex(n(0)), R.pinIndex(n(1)));
      R.softPorts.push(p);
      return p;
    }
    case 'SPISettings':
    case 'File':
      return {};
    case 'Adafruit_NeoPixel':
      return new NeoPixelLib(R, n(0), args.length > 1 ? n(1) : -1, n(2, 0x52));
    case 'Adafruit_SSD1306':
      return new SSD1306Lib(R, n(0, 128), n(1, 64), ...args.slice(2));
    case 'LedControl':
      return new LedControlLib(R, n(0), n(1), n(2), n(3, 1));
    case 'Adafruit_PWMServoDriver':
      return new PwmServoLib(R, n(0, 0x40));
    case 'Stepper':
      return new StepperLib(R, n(0), ...(args.slice(1) as number[]).map(Number));
    case 'AccelStepper':
      return new AccelStepperLib(R, n(0, 4), n(1, 2), n(2, 3), n(3, 4), n(4, 5), n(5, 1));
    case 'Keypad':
      return new KeypadLib(R, args[0], args[1] as number[], args[2] as number[], n(3), n(4));
    case 'NewPing':
      return new NewPingLib(R, n(0), n(1), n(2, 500));
    case 'DHT':
      return new DhtLib(R, n(0), n(1));
    case 'Adafruit_BMP280':
      return new Bmp280Lib(R);
    case 'Adafruit_MPU6050':
      return new Mpu6050Lib(R);
    case 'QMC5883LCompass':
      return new Qmc5883Lib(R);
    case 'Adafruit_INA219':
      return new Ina219Lib(R, n(0, 0x40));
    case 'Adafruit_ADS1115':
      return new Ads1115Lib(R);
    case 'Adafruit_MCP4725':
      return new Mcp4725Lib(R);
    case 'PCF8574':
      return new Pcf8574Lib(R, n(0, 0x20));
    case 'RTC_DS3231':
      return new DS3231Lib(R);
    case 'RTC_DS1307':
      return new DS1307Lib(R);
    case 'RTC_Millis':
      return new RtcMillisLib(R);
    case 'DateTime':
      return new DateTimeLib(R, ...args);
    case 'MFRC522':
      return new Mfrc522Lib(R, n(0, 10), n(1, 9));
    case 'Adafruit_PN532':
      return new Pn532Lib(R, n(0, 2));
    case 'RF24':
      return new Rf24Lib(R, n(0), n(1));
    case 'MCP_CAN':
      return new McpCanLib(R, n(0));
    case 'TinyGPSPlus':
      return new TinyGpsLib(R);
  }
  throw new Error(`the ${cls} library can't be created here`);
}
