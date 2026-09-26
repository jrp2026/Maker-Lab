/** Motion & input libraries: Adafruit_PWMServoDriver (PCA9685), Stepper, AccelStepper, Keypad, NewPing. */
import type { McuRuntime } from '../runtime';
import { i2cReadReg, i2cWrite } from './i2c';

// ------------------------------------------------------------------ PCA9685

export class PwmServoLib {
  private freq = 50;
  constructor(private R: McuRuntime, private addr = 0x40) {}
  begin() {
    this.reset();
    this.setPWMFreq(1000);
    return i2cWrite(this.R, this.addr, [0x00]);
  }
  reset() {
    i2cWrite(this.R, this.addr, [0x00, 0x80]);
    this.R.t += 10000;
  }
  sleep() {
    const m = i2cReadReg(this.R, this.addr, 0x00, 1)[0] ?? 0;
    i2cWrite(this.R, this.addr, [0x00, m | 0x10]);
  }
  wakeup() {
    const m = i2cReadReg(this.R, this.addr, 0x00, 1)[0] ?? 0;
    i2cWrite(this.R, this.addr, [0x00, m & ~0x10]);
  }
  setOscillatorFrequency() {}
  setPWMFreq(f: number) {
    f = Math.max(1, Math.min(3500, f));
    this.freq = f;
    const prescale = Math.max(3, Math.min(255, Math.round(25e6 / (4096 * f)) - 1));
    const old = i2cReadReg(this.R, this.addr, 0x00, 1)[0] ?? 0;
    i2cWrite(this.R, this.addr, [0x00, (old & 0x7f) | 0x10]); // sleep
    i2cWrite(this.R, this.addr, [0xfe, prescale]);
    i2cWrite(this.R, this.addr, [0x00, old & ~0x10]);
    this.R.t += 5000;
    i2cWrite(this.R, this.addr, [0x00, (old & ~0x10) | 0xa0]); // restart + auto-increment
  }
  setPWM(ch: number, on: number, off: number) {
    i2cWrite(this.R, this.addr, [0x06 + 4 * (ch & 15), on & 255, (on >> 8) & 0x1f, off & 255, (off >> 8) & 0x1f]);
  }
  setPin(ch: number, val: number, invert = 0) {
    val = Math.max(0, Math.min(4095, val));
    if (invert) val = 4095 - val;
    if (val === 4095) this.setPWM(ch, 4096, 0);
    else if (val === 0) this.setPWM(ch, 0, 4096);
    else this.setPWM(ch, 0, val);
  }
  getPWM(ch: number, off = 0) {
    const b = i2cReadReg(this.R, this.addr, 0x06 + 4 * (ch & 15) + (off ? 2 : 0), 2);
    return (b[0] ?? 0) | ((b[1] ?? 0) << 8);
  }
  writeMicroseconds(ch: number, us: number) {
    this.setPWM(ch, 0, Math.round((us * this.freq * 4096) / 1e6));
  }
}

// ------------------------------------------------------------------ Stepper (Arduino core library)

export class StepperLib {
  private pins: number[];
  private stepNumber = 0;
  private delayUs = 0;
  constructor(private R: McuRuntime, private steps: number, ...pins: number[]) {
    this.pins = pins;
    for (const p of pins) R.pinMode(p, 1);
  }
  setSpeed(rpm: number) {
    this.delayUs = rpm > 0 ? (60 * 1e6) / this.steps / rpm : 0;
  }
  private stepMotor(n: number) {
    const [a, b, c, d] = this.pins;
    if (this.pins.length === 2) {
      const pat = [[0, 1], [1, 1], [1, 0], [0, 0]][n & 3];
      this.R.digitalWrite(a, pat[0]);
      this.R.digitalWrite(b, pat[1]);
    } else {
      const pat = [[1, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]][n & 3];
      this.R.digitalWrite(a, pat[0]);
      this.R.digitalWrite(b, pat[1]);
      this.R.digitalWrite(c, pat[2]);
      this.R.digitalWrite(d, pat[3]);
    }
  }
  *step(n: number) {
    let left = Math.abs(Math.trunc(n));
    const dir = n > 0 ? 1 : -1;
    while (left > 0) {
      yield* this.R.delayUs(this.delayUs || 2000);
      this.stepNumber = (this.stepNumber + dir + this.steps) % this.steps;
      this.stepMotor(this.stepNumber % 4);
      left--;
    }
  }
}

// ------------------------------------------------------------------ AccelStepper (same algorithm as the library)

export class AccelStepperLib {
  private pins: number[];
  private currentPos = 0;
  private targetPos = 0;
  private speedV = 0;
  private maxSpeedV = 1;
  private accel = 0;
  private stepInterval = 0;
  private lastStepTime = 0;
  private n = 0;
  private c0 = 0;
  private cn = 0;
  private cmin = 1;
  private dir = 0; // 1 = CW
  private enablePin = -1;
  constructor(private R: McuRuntime, private iface = 4, p1 = 2, p2 = 3, p3 = 4, p4 = 5, enable = 1) {
    this.pins = [p1, p2, p3, p4];
    void enable;
    this.enableOutputs();
    this.setAcceleration(1);
  }
  private get wires() {
    return this.iface === 1 ? 2 : this.iface === 2 ? 2 : this.iface === 3 || this.iface === 6 ? 3 : 4;
  }
  enableOutputs() {
    for (let i = 0; i < this.wires; i++) this.R.pinMode(this.pins[i], 1);
    if (this.enablePin >= 0) {
      this.R.pinMode(this.enablePin, 1);
      this.R.digitalWrite(this.enablePin, 1);
    }
  }
  disableOutputs() {
    for (let i = 0; i < this.wires; i++) this.R.digitalWrite(this.pins[i], 0);
    if (this.enablePin >= 0) this.R.digitalWrite(this.enablePin, 0);
  }
  setEnablePin(p: number) {
    this.enablePin = p;
    this.R.pinMode(p, 1);
    this.R.digitalWrite(p, 1);
  }
  setPinsInverted() {}
  moveTo(abs: number) {
    if (this.targetPos !== abs) {
      this.targetPos = Math.trunc(abs);
      this.computeNewSpeed();
    }
  }
  move(rel: number) {
    this.moveTo(this.currentPos + Math.trunc(rel));
  }
  distanceToGo() {
    return this.targetPos - this.currentPos;
  }
  targetPosition() {
    return this.targetPos;
  }
  currentPosition() {
    return this.currentPos;
  }
  setCurrentPosition(p: number) {
    this.targetPos = this.currentPos = Math.trunc(p);
    this.n = 0;
    this.stepInterval = 0;
    this.speedV = 0;
  }
  speed() {
    return this.speedV;
  }
  maxSpeed() {
    return this.maxSpeedV;
  }
  setMaxSpeed(s: number) {
    s = Math.abs(s);
    if (this.maxSpeedV !== s) {
      this.maxSpeedV = s;
      this.cmin = 1e6 / s;
      if (this.n > 0) {
        this.n = Math.trunc((this.speedV * this.speedV) / (2 * this.accel));
        this.computeNewSpeed();
      }
    }
  }
  setAcceleration(a: number) {
    if (a === 0) return;
    a = Math.abs(a);
    if (this.accel !== a) {
      this.n = this.accel ? this.n * (this.accel / a) : 0;
      this.c0 = 0.676 * Math.sqrt(2 / a) * 1e6;
      this.accel = a;
      this.computeNewSpeed();
    }
  }
  setSpeed(s: number) {
    if (s === this.speedV) return;
    s = Math.max(-this.maxSpeedV, Math.min(this.maxSpeedV, s));
    if (s === 0) this.stepInterval = 0;
    else {
      this.stepInterval = Math.abs(1e6 / s);
      this.dir = s > 0 ? 1 : 0;
    }
    this.speedV = s;
  }
  private computeNewSpeed() {
    const d = this.distanceToGo();
    const stepsToStop = Math.trunc((this.speedV * this.speedV) / (2 * this.accel));
    if (d === 0 && stepsToStop <= 1) {
      this.stepInterval = 0;
      this.speedV = 0;
      this.n = 0;
      return;
    }
    if (d > 0) {
      if (this.n > 0) {
        if (stepsToStop >= d || this.dir === 0) this.n = -stepsToStop;
      } else if (this.n < 0) {
        if (stepsToStop < d && this.dir === 1) this.n = -this.n;
      }
    } else if (d < 0) {
      if (this.n > 0) {
        if (stepsToStop >= -d || this.dir === 1) this.n = -stepsToStop;
      } else if (this.n < 0) {
        if (stepsToStop < -d && this.dir === 0) this.n = -this.n;
      }
    }
    if (this.n === 0) {
      this.cn = this.c0;
      this.dir = d > 0 ? 1 : 0;
    } else {
      this.cn = this.cn - (2 * this.cn) / (4 * this.n + 1);
      this.cn = Math.max(this.cn, this.cmin);
    }
    this.n++;
    this.stepInterval = this.cn;
    this.speedV = 1e6 / this.cn;
    if (this.dir === 0) this.speedV = -this.speedV;
  }
  runSpeed() {
    if (!this.stepInterval) return false;
    const now = this.R.t;
    if (now - this.lastStepTime >= this.stepInterval) {
      this.currentPos += this.dir === 1 ? 1 : -1;
      this.step(this.currentPos);
      this.lastStepTime = now;
      return true;
    }
    return false;
  }
  run() {
    this.R.t += 4;
    if (this.runSpeed()) this.computeNewSpeed();
    return this.speedV !== 0 || this.distanceToGo() !== 0;
  }
  runSpeedToPosition() {
    if (this.targetPos === this.currentPos) return false;
    if (this.targetPos > this.currentPos) this.dir = 1;
    else this.dir = 0;
    return this.runSpeed();
  }
  *runToPosition() {
    while (this.run()) if (this.R.t >= this.R.until) yield 0;
  }
  *runToNewPosition(p: number) {
    this.moveTo(p);
    yield* this.runToPosition();
  }
  stop() {
    if (this.speedV !== 0) {
      const s = Math.trunc((this.speedV * this.speedV) / (2 * this.accel)) + 1;
      this.move(this.speedV > 0 ? s : -s);
    }
  }
  isRunning() {
    return !(this.speedV === 0 && this.targetPos === this.currentPos);
  }
  private step(pos: number) {
    const w = (vals: number[]) => vals.forEach((v, i) => this.R.digitalWrite(this.pins[i], v));
    switch (this.iface) {
      case 1: // DRIVER: step, dir
        this.R.digitalWrite(this.pins[1], this.dir);
        this.R.digitalWrite(this.pins[0], 1);
        this.R.t += 2;
        this.R.digitalWrite(this.pins[0], 0);
        break;
      case 2:
        w([[1, 0], [1, 1], [0, 1], [0, 0]][pos & 3]);
        break;
      case 8:
        w([[1, 0, 0, 0], [1, 0, 1, 0], [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 1], [0, 0, 0, 1], [1, 0, 0, 1]][pos & 7]);
        break;
      default:
        w([[1, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]][pos & 3]);
    }
  }
}

// ------------------------------------------------------------------ Keypad (scans the matrix through the circuit)

export class KeypadLib {
  private rows: number;
  private cols: number;
  private prev = new Set<string>();
  private lastScan = -1e9;
  private debounce = 10;
  private state = 0;
  constructor(private R: McuRuntime, private map: unknown, private rowPins: number[], private colPins: number[], rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    for (let r = 0; r < rows; r++) R.pinMode(rowPins[r], 2);
  }
  private keyAt(r: number, c: number): number {
    const m = this.map as unknown[][] | unknown[];
    const row = m[r];
    if (Array.isArray(row)) return Number(row[c] ?? 0);
    if (typeof row === 'string') return row.charCodeAt(c) || 0;
    // flat array (char keys[ROWS*COLS])
    return Number((m as unknown[])[r * this.cols + c] ?? 0);
  }
  private *scan() {
    const found = new Set<string>();
    for (let c = 0; c < this.cols; c++) {
      this.R.pinMode(this.colPins[c], 1);
      this.R.digitalWrite(this.colPins[c], 0);
      yield* this.R.settle();
      for (let r = 0; r < this.rows; r++) if (this.R.readLevel(this.rowPins[r]) === 0) found.add(`${r},${c}`);
      this.R.digitalWrite(this.colPins[c], 1);
      this.R.pinMode(this.colPins[c], 0);
    }
    return found;
  }
  *getKey() {
    if (this.R.t / 1000 - this.lastScan < this.debounce) return 0;
    this.lastScan = this.R.t / 1000;
    const now: Set<string> = yield* this.scan();
    let key = 0;
    for (const k of now) {
      if (!this.prev.has(k)) {
        const [r, c] = k.split(',').map(Number);
        key = this.keyAt(r, c);
        this.state = 1;
        break;
      }
    }
    if (!key && now.size === 0 && this.prev.size) this.state = 3;
    else if (!key && now.size) this.state = 2;
    else if (!key) this.state = 0;
    this.prev = now;
    return key;
  }
  *waitForKey() {
    for (;;) {
      const k: number = yield* this.getKey();
      if (k) return k;
      yield* this.R.delayUs(1000);
    }
  }
  getState() {
    return this.state;
  }
  keyStateChanged() {
    return false;
  }
  *isPressed(ch: number) {
    const now: Set<string> = yield* this.scan();
    for (const k of now) {
      const [r, c] = k.split(',').map(Number);
      if (this.keyAt(r, c) === ch) return true;
    }
    return false;
  }
  setDebounceTime(ms: number) {
    this.debounce = Math.max(1, ms);
  }
  setHoldTime() {}
}

// ------------------------------------------------------------------ NewPing (HC-SR04)

export class NewPingLib {
  constructor(private R: McuRuntime, private trig: number, private echo: number, private maxCm = 500) {
    R.pinMode(trig, 1);
    R.pinMode(echo, 0);
  }
  *ping(max = this.maxCm) {
    this.R.digitalWrite(this.trig, 0);
    this.R.t += 4;
    this.R.digitalWrite(this.trig, 1);
    this.R.t += 10;
    this.R.digitalWrite(this.trig, 0);
    const us: number = yield* this.R.pulseIn(this.echo, 1, (max + 1) * 57);
    return us;
  }
  *ping_cm(max = this.maxCm) {
    const us: number = yield* this.ping(max);
    return Math.round(us / 57);
  }
  *ping_in(max = this.maxCm) {
    const us: number = yield* this.ping(max);
    return Math.round(us / 146);
  }
  *ping_median(it = 5, max = this.maxCm) {
    const v: number[] = [];
    for (let i = 0; i < it; i++) {
      const us: number = yield* this.ping(max);
      if (us) v.push(us);
      yield* this.R.delayUs(29000);
    }
    v.sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }
  convert_cm(us: number) {
    return Math.round(us / 57);
  }
  convert_in(us: number) {
    return Math.round(us / 146);
  }
}
