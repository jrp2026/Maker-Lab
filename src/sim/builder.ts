import { Bjt, Capacitor, CurrentSource, Diode, Prim, Resistor, Source, type BjtParams, type DiodeParams } from './solver';
import type { Netlist } from './netlist';
import type { McuRuntime } from '../mcu/runtime';
import type { I2CDevice } from '../mcu/libs';
import type { HD44780 } from './hd44780';

export interface SimWarning {
  comp?: string;
  level: 'error' | 'warn';
  message: string;
}

export interface SimComponent {
  /** Called before every solver step (update source values, switch states...). */
  beforeStep?(t: number, h: number): void;
  /** Called after every converged step. */
  afterStep?(v: Float64Array, h: number, t: number): void;
  /** Largest timestep (s) this part tolerates right now. */
  maxStep?(): number;
  /** Visual state for this animation frame; `dt` = simulated time covered by the frame. */
  frame?(dt: number): Record<string, any> | undefined;
  /** Current warnings (refreshed each frame). */
  warnings?(): SimWarning[];
}

/** A terminal is a component pin id (string) or an internal node index (number). */
export type Term = string | number;

export interface PrimRecord {
  prim: Prim;
  pinKeys: (string | null)[];
}

export class NodeAllocator {
  count = 0;
  private netNode = new Map<number, number>();
  constructor(public netlist: Netlist) {}
  forNet(net: number): number {
    let n = this.netNode.get(net);
    if (n === undefined) {
      n = this.count++;
      this.netNode.set(net, n);
    }
    return n;
  }
  nodeOfNet(net: number): number | undefined {
    return this.netNode.get(net);
  }
  internal(): number {
    return this.count++;
  }
}

/** A parallel HD44780 display: which of its pins carry RS, E and data. */
export interface LcdRegistration {
  compId: string;
  ctrl: HD44780;
  rs: string;
  en: string;
  data4: string[]; // D4..D7
  /** set by the simulator when the sketch's data pins don't match the wiring */
  dataMismatch?: boolean;
}

export interface I2CRegistration {
  compId: string;
  address: number;
  device: I2CDevice;
  sda: string;
  scl: string;
  powered: () => boolean;
}

export interface BuildEnv {
  grounds: number[];
  signalFrequency(pinKey: string): number;
  signalInfo(pinKey: string): { freq: number; servoUs: number | null; vcc: number } | null;
  lcds: LcdRegistration[];
  i2c: I2CRegistration[];
}

export class SimBuilder {
  records: PrimRecord[] = [];
  /** Voltages of the latest solution (set by the simulator). */
  v: Float64Array = new Float64Array(0);

  constructor(
    private alloc: NodeAllocator,
    public compId: string,
    /** Persistent per-component state that survives circuit rebuilds. */
    public state: Record<string, any>,
    /** Momentary UI inputs (e.g. push button held). */
    public input: Record<string, any>,
    public mcu: McuRuntime | undefined,
    private recordsSink: PrimRecord[],
    private env: BuildEnv,
  ) {}

  /** Prefer this pin's node as the 0 V reference of its circuit. */
  markGround(pin: string) {
    this.env.grounds.push(this.node(pin));
  }

  registerLcd(r: Omit<LcdRegistration, 'compId'>): LcdRegistration {
    const reg = { ...r, compId: this.compId };
    this.env.lcds.push(reg);
    return reg;
  }

  registerI2C(r: Omit<I2CRegistration, 'compId'>) {
    this.env.i2c.push({ ...r, compId: this.compId });
  }

  /** Periodic signal (tone/PWM/servo pulses) reaching this pin from a board, if any. */
  signalInfo(pin: string) {
    return this.env.signalInfo(`${this.compId}:${pin}`);
  }

  /** Frequency of a periodic signal (tone/PWM) reaching this pin, 0 if none. */
  signalFrequency(pin: string): number {
    return this.env.signalFrequency(`${this.compId}:${pin}`);
  }

  node(t: Term): number {
    if (typeof t === 'number') return t;
    const net = this.alloc.netlist.netOf.get(`${this.compId}:${t}`);
    if (net === undefined) return this.alloc.internal();
    return this.alloc.forNet(net);
  }

  internal(): number {
    return this.alloc.internal();
  }

  /** Is this pin connected to anything besides itself? */
  connected(pin: string): boolean {
    const net = this.alloc.netlist.netOf.get(`${this.compId}:${pin}`);
    if (net === undefined) return false;
    const members = this.alloc.netlist.nets[net];
    return members.some((k) => !k.startsWith(`${this.compId}:`));
  }

  add<T extends Prim>(p: T, terms: Term[]): T {
    const rec = { prim: p, pinKeys: terms.map((t) => (typeof t === 'string' ? `${this.compId}:${t}` : null)) };
    this.records.push(rec);
    this.recordsSink.push(rec);
    return p;
  }

  resistor(a: Term, b: Term, r: number) {
    return this.add(new Resistor(this.node(a), this.node(b), r), [a, b]);
  }
  source(p: Term, n: Term, volts: number, r: number) {
    return this.add(new Source(this.node(p), this.node(n), volts, r), [p, n]);
  }
  currentSource(p: Term, n: Term, amps: number) {
    return this.add(new CurrentSource(this.node(p), this.node(n), amps), [p, n]);
  }
  capacitor(a: Term, b: Term, c: number, key = 'cap') {
    const cap = this.add(new Capacitor(this.node(a), this.node(b), c, this.state[key] ?? 0), [a, b]);
    return cap;
  }
  diode(a: Term, k: Term, p: DiodeParams) {
    return this.add(new Diode(this.node(a), this.node(k), p), [a, k]);
  }
  bjt(c: Term, b: Term, e: Term, p: BjtParams) {
    return this.add(new Bjt(this.node(c), this.node(b), this.node(e), p), [c, b, e]);
  }

  /** Voltage at a pin/node from the latest solution. */
  volt(t: Term): number {
    const n = typeof t === 'number' ? t : this.nodeIfExists(t);
    if (n === undefined || n < 0 || n >= this.v.length) return 0;
    return this.v[n];
  }

  private nodeIfExists(pin: string): number | undefined {
    const net = this.alloc.netlist.netOf.get(`${this.compId}:${pin}`);
    if (net === undefined) return undefined;
    return this.alloc.nodeOfNet(net);
  }
}

/** Small helper for time-averaging quantities over an animation frame. */
export class Avg {
  sum = 0;
  time = 0;
  peak = 0;
  add(x: number, h: number) {
    this.sum += x * h;
    this.time += h;
    if (Math.abs(x) > Math.abs(this.peak)) this.peak = x;
  }
  take(): number {
    const r = this.time > 0 ? this.sum / this.time : 0;
    this.sum = 0;
    this.time = 0;
    this.peak = 0;
    return r;
  }
  get value() {
    return this.time > 0 ? this.sum / this.time : 0;
  }
}
