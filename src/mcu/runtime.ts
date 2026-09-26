import { compileSketch, CompileError } from './compiler';

export type PinMode = 'input' | 'output' | 'pullup';

export interface PinState {
  mode: PinMode;
  value: 0 | 1;
  /** PWM duty 0..1 when analogWrite is active */
  pwm: number | null;
  pwmFreq: number;
  tone: { freq: number; until: number } | null;
  /** measured pin voltage relative to board GND (latest solve) */
  volts: number;
  /** last digital level seen by digitalRead (hysteresis) */
  level: 0 | 1;
}

export interface BoardSpec {
  name: string;
  pinCount: number;
  analogBase: number; // pin number of A0
  analogCount: number;
  pwmPins: number[];
  vcc: number;
  pinResistance: number;
  pullup: number;
  maxPinCurrent: number;
}

export const UNO_SPEC: BoardSpec = {
  name: 'Arduino Uno R3',
  pinCount: 20,
  analogBase: 14,
  analogCount: 6,
  pwmPins: [3, 5, 6, 9, 10, 11],
  vcc: 5,
  pinResistance: 25,
  pullup: 35000,
  maxPinCurrent: 0.04,
};

export interface McuError {
  kind: 'compile' | 'runtime';
  message: string;
  line?: number;
  col?: number;
}

function highFraction(t0: number, h: number, period: number, duty: number): number {
  const F = (x: number) => Math.floor(x / period) * duty * period + Math.min(x - Math.floor(x / period) * period, duty * period);
  return h > 0 ? (F(t0 + h) - F(t0)) / h : duty;
}

/** Arduino API + scheduler for a compiled sketch. Times are in microseconds. */
export class McuRuntime {
  t = 0;
  until = 0;
  pins: PinState[];
  serialOut = '';
  serialIn = '';
  serialListeners = new Set<(text: string) => void>();
  lastSerialAt = -1e9;
  error: McuError | null = null;
  done = false;
  private gen: Generator<number, void, unknown> | null = null;
  private seed = 12345;

  constructor(public spec: BoardSpec = UNO_SPEC) {
    this.pins = Array.from({ length: spec.pinCount }, () => ({
      mode: 'input' as PinMode,
      value: 0 as 0 | 1,
      pwm: null,
      pwmFreq: 490,
      tone: null,
      volts: 0,
      level: 0 as 0 | 1,
    }));
  }

  load(code: string): McuError | null {
    try {
      const prog = compileSketch(code);
      this.gen = prog.create(this);
      return null;
    } catch (e) {
      if (e instanceof CompileError) {
        this.error = { kind: 'compile', message: e.message, line: e.line, col: e.col };
      } else {
        this.error = { kind: 'compile', message: String((e as Error).message ?? e) };
      }
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
      while (this.t < us && !this.done) {
        const r = this.gen.next();
        if (r.done) this.done = true;
        if (++guard > 1e6) throw new Error('scheduler stalled');
      }
    } catch (e) {
      const msg = e instanceof RangeError ? 'Stack overflow (runaway recursion?)' : String((e as Error).message ?? e);
      this.error = { kind: 'runtime', message: msg };
    }
    if (this.t < us) this.t = us;
  }

  /** Electrical drive of a pin over [t0, t0+h] seconds: Thevenin volts + resistance relative to GND. */
  drive(pin: number, t0: number, h: number): { volts: number; r: number } {
    const p = this.pins[pin];
    const s = this.spec;
    if (p.mode === 'output') {
      const tUs = t0 * 1e6;
      if (p.tone) {
        if (p.tone.until > 0 && tUs >= p.tone.until) p.tone = null;
        else return { volts: s.vcc * highFraction(t0, h, 1 / p.tone.freq, 0.5), r: s.pinResistance };
      }
      if (p.pwm !== null) return { volts: s.vcc * highFraction(t0, h, 1 / p.pwmFreq, p.pwm), r: s.pinResistance };
      return { volts: p.value ? s.vcc : 0, r: s.pinResistance };
    }
    if (p.mode === 'pullup') return { volts: s.vcc, r: s.pullup };
    return { volts: 0, r: 1e8 };
  }

  /** Signal frequency on a pin (tone or PWM), 0 if DC. */
  pinFrequency(pin: number): number {
    const p = this.pins[pin];
    if (p.mode !== 'output') return 0;
    if (p.tone) return p.tone.freq;
    if (p.pwm !== null) return p.pwmFreq;
    return 0;
  }

  /** Does this pin need small solver steps (PWM switching)? */
  get needsFineSteps(): boolean {
    return this.pins.some((p) => p.mode === 'output' && p.pwm !== null);
  }

  // ------------------------------------------------------------ Arduino API
  private pinIndex(p: number): number {
    p = Math.trunc(p);
    if (p < 0 || p >= this.spec.pinCount) throw new Error(`pin ${p} does not exist on ${this.spec.name}`);
    return p;
  }
  noop() {}
  ident(x: number) {
    return x;
  }
  pinMode(p: number, m: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.mode = m === 1 ? 'output' : m === 2 ? 'pullup' : 'input';
    if (pin.mode !== 'output') {
      pin.pwm = null;
      pin.tone = null;
    }
  }
  digitalWrite(p: number, v: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.pwm = null;
    if (pin.mode === 'output') pin.value = v ? 1 : 0;
    else pin.mode = v ? 'pullup' : 'input'; // writing an input toggles the pull-up, like the real AVR
  }
  digitalRead(p: number): number {
    const pin = this.pins[this.pinIndex(p)];
    if (pin.mode === 'output') return pin.value;
    const v = pin.volts;
    if (v > 0.6 * this.spec.vcc) pin.level = 1;
    else if (v < 0.3 * this.spec.vcc) pin.level = 0;
    return pin.level;
  }
  analogRead(p: number): number {
    p = Math.trunc(p);
    if (p < this.spec.analogCount) p += this.spec.analogBase;
    if (p < this.spec.analogBase || p >= this.spec.analogBase + this.spec.analogCount) throw new Error(`analogRead: pin ${p} is not an analog input`);
    this.t += 100; // ADC conversion time
    const v = this.pins[p].volts;
    return Math.max(0, Math.min(1023, Math.floor((v / this.spec.vcc) * 1024)));
  }
  analogWrite(p: number, v: number) {
    const idx = this.pinIndex(p);
    const pin = this.pins[idx];
    pin.mode = 'output';
    pin.tone = null;
    v = Math.max(0, Math.min(255, Math.trunc(v)));
    if (!this.spec.pwmPins.includes(idx)) {
      pin.pwm = null;
      pin.value = v >= 128 ? 1 : 0;
      return;
    }
    if (v === 0 || v === 255) {
      pin.pwm = null;
      pin.value = v ? 1 : 0;
    } else {
      pin.pwm = v / 255;
      pin.pwmFreq = idx === 5 || idx === 6 ? 980 : 490;
    }
  }
  tone(p: number, freq: number, duration?: number) {
    const pin = this.pins[this.pinIndex(p)];
    pin.mode = 'output';
    pin.pwm = null;
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
    const end = this.t + Math.max(0, us);
    while (end > this.until) {
      this.t = this.until;
      yield 0;
    }
    this.t = end;
  }
  *pulseIn(p: number, state: number, timeout = 1000000) {
    const start = this.t;
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

  // Serial
  serialBegin() {}
  serialWrite(text: string) {
    this.serialOut += text;
    if (this.serialOut.length > 20000) this.serialOut = this.serialOut.slice(-15000);
    this.lastSerialAt = this.t;
    for (const l of this.serialListeners) l(text);
    this.t += text.length * 87; // ~9600 baud
    return text.length;
  }
  serialAvailable() {
    return this.serialIn.length;
  }
  serialRead() {
    if (!this.serialIn.length) return -1;
    const c = this.serialIn.charCodeAt(0);
    this.serialIn = this.serialIn.slice(1);
    return c;
  }
  serialPeek() {
    return this.serialIn.length ? this.serialIn.charCodeAt(0) : -1;
  }
  serialReadString() {
    const s = this.serialIn;
    this.serialIn = '';
    return s;
  }
  serialReadStringUntil(c: number) {
    const ch = String.fromCharCode(c);
    const i = this.serialIn.indexOf(ch);
    if (i < 0) return this.serialReadString();
    const s = this.serialIn.slice(0, i);
    this.serialIn = this.serialIn.slice(i + 1);
    return s;
  }
  serialParseInt() {
    const m = /[-]?\d+/.exec(this.serialIn);
    if (!m) {
      this.serialIn = '';
      return 0;
    }
    this.serialIn = this.serialIn.slice(m.index + m[0].length);
    return parseInt(m[0], 10) | 0;
  }
  serialParseFloat() {
    const m = /[-]?\d+(\.\d+)?/.exec(this.serialIn);
    if (!m) {
      this.serialIn = '';
      return 0;
    }
    this.serialIn = this.serialIn.slice(m.index + m[0].length);
    return parseFloat(m[0]);
  }
}
