import { compileSketch, CompileError } from './compiler';
import { UNO, type BoardSpec } from './boards';
import { createLib, WireLib, type McuEnv } from './libs';
import { dtostrf, EepromLib, SdLib, SpiLib, sprintf, UartPort } from './stdlib';

export type { BoardSpec };
export const UNO_SPEC = UNO;

export type PinMode = 'input' | 'output' | 'pullup';

export interface PinState {
  mode: PinMode;
  value: 0 | 1;
  /** PWM duty 0..1 when analogWrite is active */
  pwm: number | null;
  pwmFreq: number;
  tone: { freq: number; until: number } | null;
  /** servo pulse width in µs (50 Hz) */
  servo: number | null;
  /** DAC output voltage (ESP32 GPIO25/26) */
  dac: number | null;
  /** measured pin voltage relative to board GND (latest solve) */
  volts: number;
  /** last digital level seen by digitalRead (hysteresis) */
  level: 0 | 1;
  /** rising edges written so far (clock inputs of counters / stepper drivers count these) */
  rises: number;
}

export interface McuError {
  kind: 'compile' | 'runtime';
  message: string;
  line?: number;
  col?: number;
}

type Isr = { fn: () => Generator<number, void, unknown>; mode: number; last: 0 | 1 };

function highFraction(t0: number, h: number, period: number, duty: number): number {
  const F = (x: number) => Math.floor(x / period) * duty * period + Math.min(x - Math.floor(x / period) * period, duty * period);
  return h > 0 ? (F(t0 + h) - F(t0)) / h : duty;
}

const NO_ENV: McuEnv = { lcdFor: () => null, i2c: () => null, spi: () => 0xff, device: () => null, uartSend: () => {}, pulse: () => null };

/** Arduino API + scheduler for a compiled sketch. Times are in microseconds. */
export class McuRuntime {
  t = 0;
  until = 0;
  pins: PinState[];
  serialOut = '';
  serialListeners = new Set<(text: string) => void>();
  lastSerialAt = -1e9;
  error: McuError | null = null;
  done = false;
  env: McuEnv = NO_ENV;
  /** problems reported by libraries (e.g. "no LCD at 0x27") */
  libWarnings = new Set<string>();
  lib = { create: (cls: string, args: unknown[]) => createLib(this, cls, args) };
  wire = new WireLib(this);
  spi = new SpiLib(this);
  sd = new SdLib(this);
  eeprom: EepromLib;
  /** hardware serial ports (index = Serial number) and SoftwareSerial instances */
  ports: (UartPort | undefined)[] = [];
  softPorts: UartPort[] = [];
  /** called on every digitalWrite of an output (devices that clock data on edges listen here) */
  pinListeners = new Set<(pin: number, value: 0 | 1, t: number) => void>();
  private gen: Generator<number, void, unknown> | null = null;
  private seed = 12345;
  private isrs = new Map<number, Isr>();
  private pendingIsrs: Isr['fn'][] = [];
  private intEnabled = true;
  inIsr = false;
  private ledc = new Map<number, { freq: number; bits: number; pins: number[] }>();
  private ledcPin = new Map<number, { freq: number; bits: number }>();

  constructor(public spec: BoardSpec = UNO) {
    this.eeprom = new EepromLib(this, spec.eepromSize);
    this.pins = Array.from({ length: spec.pinCount }, () => ({
      mode: 'input' as PinMode,
      value: 0 as 0 | 1,
      pwm: null,
      pwmFreq: 490,
      tone: null,
      servo: null,
      dac: null,
      volts: 0,
      level: 0 as 0 | 1,
      rises: 0,
    }));
  }

  load(code: string): McuError | null {
    try {
      const prog = compileSketch(code, this.spec);
      this.gen = prog.create(this);
      return null;
    } catch (e) {
      if (e instanceof CompileError) this.error = { kind: 'compile', message: e.message, line: e.line, col: e.col };
      else this.error = { kind: 'compile', message: String((e as Error).message ?? e) };
      return this.error;
    }
  }

  /** Run the sketch until virtual time reaches `us`. */
  runUntil(us: number) {
    if (!this.gen || this.done || this.error) {
      this.t = Math.max(this.t, us);
      return;
    }
    this.until = us;
    let guard = 0;
    try {
      this.runIsrs();
      while (this.t < us && !this.done) {
        const r = this.gen.next();
        if (r.done) this.done = true;
        this.runIsrs();
        if (++guard > 1e6) throw new Error('scheduler stalled');
      }
    } catch (e) {
      this.error = { kind: 'runtime', message: friendlyError(e) };
    }
    if (this.t < us) this.t = us;
  }

  /** Electrical drive of a pin over [t0, t0+h] seconds: Thevenin volts + resistance relative to GND. */
  drive(pin: number, t0: number, h: number): { volts: number; r: number } {
    const p = this.pins[pin];
    const s = this.spec;
    if (p.mode === 'output') {
      if (p.dac !== null) return { volts: p.dac, r: 200 };
      const tUs = t0 * 1e6;
      if (p.tone) {
        if (p.tone.until > 0 && tUs >= p.tone.until) p.tone = null;
        else return { volts: s.vcc * highFraction(t0, h, 1 / p.tone.freq, 0.5), r: s.pinResistance };
      }
      if (p.servo !== null) return { volts: s.vcc * highFraction(t0, h, 0.02, p.servo / 20000), r: s.pinResistance };
      if (p.pwm !== null) return { volts: s.vcc * highFraction(t0, h, 1 / p.pwmFreq, p.pwm), r: s.pinResistance };
      return { volts: p.value ? s.vcc : 0, r: s.pinResistance };
    }
    if (p.mode === 'pullup') return { volts: s.vcc, r: s.pullup };
    return { volts: 0, r: 1e8 };
  }

  /** Signal frequency on a pin (tone or PWM), 0 if DC. */
  pinFrequency(pin: number): number {
    const p = this.pins[pin];
    if (!p || p.mode !== 'output') return 0;
    if (p.tone) return p.tone.freq;
    if (p.servo !== null) return 50;
    if (p.pwm !== null) return p.pwmFreq;
    return 0;
  }

  /** Does any pin need small solver steps (PWM switching)? */
  get needsFineSteps(): boolean {
    return this.pins.some((p) => p.mode === 'output' && p.pwm !== null && p.pwmFreq < 2000);
  }

  // ------------------------------------------------------------ interrupts
  levelOf(pin: number): 0 | 1 {
    const p = this.pins[pin];
    if (p.mode === 'output') return p.dac !== null ? (p.dac > this.spec.vcc / 2 ? 1 : 0) : p.value;
    const v = p.volts;
    if (v > 0.6 * this.spec.vcc) p.level = 1;
    else if (v < 0.3 * this.spec.vcc) p.level = 0;
    return p.level;
  }

  /** Called after each circuit solve: queue handlers for edges on interrupt pins. */
  sampleInterrupts() {
    for (const [pin, isr] of this.isrs) {
      const lv = this.levelOf(pin);
      const m = isr.mode;
      if ((m === 1 && lv !== isr.last) || (m === 3 && isr.last === 0 && lv === 1) || (m === 2 && isr.last === 1 && lv === 0) || (m === 0 && lv === 0)) {
        if (this.pendingIsrs.length < 16) this.pendingIsrs.push(isr.fn);
      }
      isr.last = lv;
    }
  }

  private runIsrs() {
    if (!this.intEnabled || this.inIsr || !this.pendingIsrs.length) return;
    while (this.pendingIsrs.length) {
      const fn = this.pendingIsrs.shift()!;
      this.inIsr = true;
      try {
        const g = fn();
        let n = 0;
        while (!g.next().done) if (++n > 200000) throw new Error('interrupt handler never returned');
        this.t += 3;
      } finally {
        this.inIsr = false;
      }
    }
  }

  attachInterrupt(n: number, fn: Isr['fn'], mode: number) {
    let pin: number;
    if (this.spec.interruptPins === 'all') pin = n;
    else {
      pin = this.spec.interruptPins[n];
      if (pin === undefined) throw new Error(`interrupt ${n} does not exist on ${this.spec.name} (use digitalPinToInterrupt(2) or (3))`);
    }
    this.pinIndex(pin);
    this.isrs.set(pin, { fn, mode, last: this.levelOf(pin) });
  }
  detachInterrupt(n: number) {
    const pin = this.spec.interruptPins === 'all' ? n : this.spec.interruptPins[n];
    this.isrs.delete(pin);
  }
  pinToInterrupt(p: number) {
    if (this.spec.interruptPins === 'all') return this.spec.pins.includes(p) ? p : -1;
    return this.spec.interruptPins.indexOf(p);
  }
  interrupts() {
    this.intEnabled = true;
  }
  noInterrupts() {
    this.intEnabled = false;
  }

  // ------------------------------------------------------------ pointers
  ptr(a: unknown[], i: number) {
    return { a, i: Math.trunc(i) };
  }
  padd(p: { a: unknown[]; i: number } | null, k: number) {
    if (!p) throw new Error('pointer arithmetic on a null pointer');
    return { a: p.a, i: p.i + Math.trunc(k) };
  }
  pdiff(p: { a: unknown[]; i: number }, q: { a: unknown[]; i: number }) {
    if (!p || !q) throw new Error('null pointer in subtraction');
    return p.i - q.i;
  }
  peq(p: any, q: any) {
    const n = (x: any) => (x === 0 || x === undefined ? null : x);
    p = n(p);
    q = n(q);
    if (p === q) return true;
    return !!p && !!q && p.a === q.a && p.i === q.i;
  }
  pidx(p: { i: number } | null) {
    return p ? p.i : 0;
  }
  nn<T>(p: T | null): T {
    if (!p) throw new Error('null pointer dereference');
    return p;
  }
  deref(p: { a: unknown[]; i: number } | null) {
    if (!p) throw new Error('null pointer dereference');
    const v = p.a[p.i];
    if (v === undefined) throw new Error(`pointer reads outside its array (index ${p.i} of ${p.a.length})`);
    return v;
  }
  nullPtr(x: number) {
    if (x === 0) return null;
    throw new Error('invalid conversion from integer to pointer');
  }
  toArr(p: { a: unknown[]; i: number } | null) {
    if (!p) throw new Error('null pointer passed where an array is expected');
    return p.i === 0 ? p.a : p.a.slice(p.i);
  }

  // ------------------------------------------------------------ Arduino API
  pinIndex(p: number): number {
    p = Math.trunc(p);
    if (p < 0 || p >= this.spec.pinCount || !this.spec.pins.includes(p)) throw new Error(`pin ${p} does not exist on ${this.spec.name}`);
    return p;
  }
  noop() {}
  ident(x: number) {
    return x;
  }
  warnLib(msg: string) {
    this.libWarnings.add(msg);
  }
  pinMode(p: number, m: number) {
    const idx = this.pinIndex(p);
    const pin = this.pins[idx];
    let mode: PinMode = m === 1 ? 'output' : m === 2 ? 'pullup' : 'input';
    if (mode === 'output' && this.spec.inputOnly.includes(idx)) throw new Error(`GPIO${idx} is input-only on the ESP32`);
    if (mode === 'pullup' && this.spec.inputOnly.includes(idx)) mode = 'input'; // no internal pull-ups on GPIO34–39
    pin.mode = mode;
    if (pin.mode !== 'output') {
      pin.pwm = null;
      pin.tone = null;
      pin.servo = null;
      pin.dac = null;
    }
  }
  digitalWrite(p: number, v: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.pwm = null;
    pin.servo = null;
    pin.dac = null;
    if (pin.mode === 'output') {
      const nv = v ? 1 : 0;
      if (nv && !pin.value) pin.rises++;
      pin.value = nv;
      if (this.pinListeners.size) for (const l of this.pinListeners) l(this.pinIndex(p), nv, this.t);
    } else pin.mode = v ? 'pullup' : 'input'; // writing an input toggles the pull-up, like the real AVR
  }
  digitalRead(p: number): number {
    return this.levelOf(this.pinIndex(p));
  }
  analogRead(p: number): number {
    p = Math.trunc(p);
    const base = this.spec.analogChannelBase;
    if (base !== null && p < this.spec.adcPins.length) p += base;
    if (!this.spec.adcPins.includes(p)) throw new Error(`analogRead: pin ${p} is not an analog input on ${this.spec.name}`);
    this.t += this.spec.adcBits > 10 ? 10 : 100; // conversion time
    const full = 1 << this.spec.adcBits;
    const v = this.pins[p].volts;
    return Math.max(0, Math.min(full - 1, Math.floor((v / this.spec.vcc) * full)));
  }
  analogWrite(p: number, v: number) {
    const idx = this.pinIndex(p);
    this.setDuty(idx, Math.max(0, Math.min(255, Math.trunc(v))) / 255, this.spec.pwmFrequency(idx));
  }
  private setDuty(idx: number, duty: number, freq: number) {
    const pin = this.pins[idx];
    if (this.spec.inputOnly.includes(idx)) throw new Error(`GPIO${idx} is input-only on the ESP32`);
    pin.mode = 'output';
    pin.tone = null;
    pin.servo = null;
    pin.dac = null;
    const pwmCapable = this.spec.pwmPins === 'all' || this.spec.pwmPins.includes(idx);
    if (!pwmCapable) {
      pin.pwm = null;
      pin.value = duty >= 0.5 ? 1 : 0;
      return;
    }
    if (duty <= 0 || duty >= 1) {
      pin.pwm = null;
      pin.value = duty >= 1 ? 1 : 0;
    } else {
      pin.pwm = duty;
      pin.pwmFreq = freq;
    }
  }
  // ESP32 LEDC (core 2.x: channels; core 3.x: pins)
  ledcSetup(ch: number, freq: number, bits: number) {
    this.ledc.set(ch, { freq, bits, pins: this.ledc.get(ch)?.pins ?? [] });
    return freq;
  }
  ledcAttachPin(pin: number, ch: number) {
    const c = this.ledc.get(ch) ?? { freq: 5000, bits: 8, pins: [] };
    c.pins.push(this.pinIndex(pin));
    this.ledc.set(ch, c);
  }
  ledcAttach(pin: number, freq: number, bits: number) {
    this.ledcPin.set(this.pinIndex(pin), { freq, bits });
    return true;
  }
  ledcDetachPin(pin: number) {
    this.ledcPin.delete(pin);
    for (const c of this.ledc.values()) c.pins = c.pins.filter((x) => x !== pin);
  }
  ledcWrite(chOrPin: number, duty: number) {
    const byPin = this.ledcPin.get(chOrPin);
    if (byPin) return this.setDuty(chOrPin, duty / ((1 << byPin.bits) - 1), byPin.freq);
    const c = this.ledc.get(chOrPin);
    if (!c) throw new Error(`ledcWrite: channel/pin ${chOrPin} was not set up with ledcSetup()/ledcAttach()`);
    for (const pin of c.pins) this.setDuty(pin, duty / ((1 << c.bits) - 1), c.freq);
  }
  dacWrite(p: number, v: number) {
    const idx = this.pinIndex(p);
    if (!this.spec.dacPins.includes(idx)) throw new Error(`dacWrite: GPIO${idx} has no DAC (use 25 or 26)`);
    const pin = this.pins[idx];
    pin.mode = 'output';
    pin.pwm = null;
    pin.tone = null;
    pin.servo = null;
    pin.dac = (Math.max(0, Math.min(255, Math.trunc(v))) / 255) * this.spec.vcc;
  }
  tone(p: number, freq: number, duration?: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.mode = 'output';
    pin.pwm = null;
    pin.servo = null;
    pin.dac = null;
    pin.tone = { freq: Math.max(31, freq), until: duration ? this.t + duration * 1000 : 0 };
  }
  noTone(p: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.tone = null;
    pin.value = 0;
  }
  shiftOut(dataPin: number, clockPin: number, order: number, val: number) {
    for (let i = 0; i < 8; i++) {
      const bit = order === 0 ? (val >> i) & 1 : (val >> (7 - i)) & 1;
      this.digitalWrite(dataPin, bit);
      this.digitalWrite(clockPin, 1);
      this.digitalWrite(clockPin, 0);
    }
  }
  millis() {
    return Math.floor(this.t / 1000) >>> 0;
  }
  micros() {
    return (Math.floor(this.t / 4) * 4) >>> 0;
  }
  *delay(ms: number) {
    yield* this.delayUs(ms * 1000);
  }
  *delayUs(us: number) {
    if (this.inIsr) {
      this.t += Math.max(0, us);
      return;
    }
    const end = this.t + Math.max(0, us);
    while (end > this.until) {
      this.t = this.until;
      yield 0;
    }
    this.t = end;
  }
  *pulseIn(p: number, state: number, timeout = 1000000) {
    const start = this.t;
    const dev = this.env.pulse(this.pinIndex(p), state ? 1 : 0);
    if (dev !== null) {
      const d = Math.round(dev);
      if (d <= 0 || d > timeout) {
        yield* this.delayUs(Math.min(timeout, 1000000));
        return 0;
      }
      yield* this.delayUs(d + 450); // trigger-to-echo latency + the pulse itself
      return d;
    }
    const read = () => this.digitalRead(p);
    const wait = function* (self: McuRuntime, cond: () => boolean) {
      while (!cond()) {
        self.t += 10;
        if (self.t - start > timeout) return false;
        if (self.t >= self.until) yield 0;
      }
      return true;
    };
    if (!(yield* wait(this, () => read() !== state))) return 0;
    if (!(yield* wait(this, () => read() === state))) return 0;
    const t0 = this.t;
    if (!(yield* wait(this, () => read() !== state))) return 0;
    return Math.round(this.t - t0);
  }
  map(x: number, a: number, b: number, c: number, d: number) {
    if (b === a) return c;
    return Math.trunc(((x - a) * (d - c)) / (b - a) + c) | 0;
  }
  random(a: number, b?: number) {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    const r = this.seed / 4294967296;
    if (b === undefined) return a <= 0 ? 0 : Math.floor(r * a);
    return b <= a ? a : a + Math.floor(r * (b - a));
  }
  randomSeed(s: number) {
    this.seed = s >>> 0 || 12345;
  }
  round(x: number) {
    return (x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5)) | 0;
  }
  idiv(a: number, b: number, mod: number) {
    if (b === 0) return mod ? a : a < 0 ? 1 : -1; // AVR returns garbage; keep it deterministic
    return mod ? a % b : Math.trunc(a / b);
  }
  pad<T>(arr: T[], n: number, fill: () => T): T[] {
    while (arr.length < n) arr.push(fill());
    return arr;
  }
  sizeOf(arr: unknown, elem: number): number {
    const count = (a: unknown): number => (Array.isArray(a) ? a.reduce((s: number, x) => s + count(x), 0) : 1);
    if (typeof arr === 'string') return arr.length + 1;
    return count(arr) * elem;
  }
  isDigit(c: number) {
    return c >= 48 && c <= 57;
  }
  isAlpha(c: number) {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  }

  // Strings
  str(x: unknown, type: string, fmt?: number): string {
    if (typeof x === 'string') return x;
    return this.fmt(x, type, fmt);
  }
  fmt(x: unknown, type: string, fmt?: number): string {
    if (typeof x === 'string') return x;
    if (typeof x === 'boolean') return x ? '1' : '0';
    const n = Number(x);
    if (type === 'char' && fmt === undefined) return String.fromCharCode(n & 255);
    if (type === 'float') {
      if (!Number.isFinite(n)) return Number.isNaN(n) ? 'nan' : 'inf';
      return n.toFixed(fmt === undefined ? 2 : Math.max(0, Math.min(10, fmt)));
    }
    if (fmt !== undefined && fmt !== 10) {
      const base = [2, 8, 16].includes(fmt) ? fmt : 10;
      return (n >>> 0).toString(base).toUpperCase();
    }
    return String(Math.trunc(n));
  }
  charAt(s: string, i: number) {
    return i >= 0 && i < s.length ? s.charCodeAt(i) : 0;
  }
  setCharAt(s: string, i: number, c: number) {
    if (i < 0 || i >= s.length) return s;
    return s.slice(0, i) + String.fromCharCode(c) + s.slice(i + 1);
  }
  strRemove(s: string, i: number, n?: number) {
    return s.slice(0, i) + (n === undefined ? '' : s.slice(i + n));
  }
  toInt(s: string) {
    const m = /^\s*[-+]?\d+/.exec(s);
    return m ? parseInt(m[0], 10) | 0 : 0;
  }
  toFloat(s: string) {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : 0;
  }

  // ------------------------------------------------------------ serial ports
  uart(n: number): UartPort {
    let p = this.ports[n];
    if (!p) {
      const pins = this.spec.uarts[n];
      if (!pins) throw new Error(`Serial${n || ''} does not exist on ${this.spec.name}${n ? ' (use SoftwareSerial)' : ''}`);
      p = new UartPort(this, pins.rx, pins.tx, n === 0);
      this.ports[n] = p;
    }
    return p;
  }
  /** every port that can receive bytes */
  allPorts(): UartPort[] {
    return [...this.ports.filter((p): p is UartPort => !!p), ...this.softPorts];
  }
  /** Serial Monitor input (port 0) */
  get serialIn() {
    return this.uart(0).rx;
  }
  set serialIn(v: string) {
    this.uart(0).rx = v;
  }
  serialWrite(text: string) {
    return this.uart(0).print(text);
  }

  // ------------------------------------------------------------ helpers used by generated code
  /** truth value of a library object (File, Serial …) */
  ok(o: any) {
    return !!o && (typeof o.isOk === 'function' ? o.isOk() : true);
  }
  clone<T>(x: T): T {
    if (Array.isArray(x)) return x.map((v) => this.clone(v)) as T;
    if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) o[k] = this.clone(v);
      return o as T;
    }
    return x;
  }
  /** pointer to a struct field */
  fptr(o: Record<string, unknown>, k: string) {
    return { a: o, i: k };
  }
  sprintf(fmt: string, ...args: unknown[]) {
    return sprintf(fmt, ...args);
  }
  dtostrf(v: number, w: number, p: number) {
    return dtostrf(v, w, p);
  }
  itoa(v: number, base: number) {
    return base === 10 ? String(Math.trunc(v)) : (Math.trunc(v) >>> 0).toString(base);
  }
  /** chars of a C string buffer up to its terminating 0 */
  cstr(a: unknown): string {
    if (typeof a === 'string') return a;
    if (!Array.isArray(a)) return String(a ?? '');
    let s = '';
    for (const c of a) {
      if (!c) break;
      s += String.fromCharCode(Number(c) & 255);
    }
    return s;
  }
  /** copy a string into a char buffer (with the terminating 0) */
  setCstr(a: unknown[], s: string) {
    if (s.length >= a.length) throw new Error(`buffer overflow: ${s.length + 1} bytes written into a char[${a.length}]`);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255;
    a[s.length] = 0;
    return s;
  }
  strlen(s: unknown) {
    return typeof s === 'string' ? s.length : Array.isArray(s) ? s.indexOf(0) >= 0 ? s.indexOf(0) : s.length : 0;
  }
  strcmp(a: unknown, b: unknown) {
    const x = String(a), y = String(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  /** __DATE__ / __TIME__ at compile (= simulation start) time */
  buildStamp(which: string) {
    const d = new Date();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    if (which === '__DATE__') return `${mon} ${String(d.getDate()).padStart(2, ' ')} ${d.getFullYear()}`;
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':');
  }
  /** wait until the circuit has been solved with the pins as they are now (for bit-banged reads) */
  *settle() {
    this.t = Math.max(this.t, this.until);
    yield 0;
  }
  /** electrical level of a pin as seen by digitalRead (after the latest solve) */
  readLevel(p: number) {
    return this.levelOf(this.pinIndex(p));
  }
}

function friendlyError(e: unknown): string {
  if (e instanceof RangeError) return 'Stack overflow (runaway recursion?)';
  const msg = String((e as Error)?.message ?? e);
  if (/Cannot (read|set) properties of (null|undefined)/.test(msg)) return 'null pointer dereference or array index out of bounds';
  return msg;
}
