import type { CircuitDoc } from '../model/types';
import { getDef } from '../components/registry';
import { buildNetlist, type Netlist } from './netlist';
import { Circuit } from './solver';
import { NodeAllocator, SimBuilder, type BuildEnv, type DeviceRegistration, type I2CRegistration, type LcdRegistration, type PrimRecord, type SimComponent, type SimWarning } from './builder';
import { McuRuntime, type McuError } from '../mcu/runtime';
import type { McuEnv } from '../mcu/libs';
import type { BoardSpec } from '../mcu/boards';

export interface SignalInfo {
  freq: number;
  /** servo pulse width (µs) when the driving pin runs the Servo library */
  servoUs: number | null;
  vcc: number;
}

export interface SimSnapshot {
  time: number;
  comps: Record<string, Record<string, any> | undefined>;
  warnings: SimWarning[];
  /** wire id → current in amps, positive when flowing from end a to end b */
  wireFlow: Record<string, number>;
  /** net index → voltage relative to the circuit's ground */
  netVolts: Float64Array;
  netOfPin: Map<string, number>;
  slow: boolean;
  solverFailed: boolean;
}

const MAX_STEP = 1e-3;
const FRAME_BUDGET_MS = 12;

export class Simulator {
  time = 0;
  netlist!: Netlist;
  private circuit!: Circuit;
  private comps = new Map<string, SimComponent>();
  private records: PrimRecord[] = [];
  private pinCharge = new Map<string, number>();
  private nodeOfNet: (net: number) => number | undefined = () => undefined;
  private staticWarnings: SimWarning[] = [];
  private frameStart = 0;
  persist = new Map<string, Record<string, any>>();
  inputs = new Map<string, Record<string, any>>();
  mcus = new Map<string, McuRuntime>();
  slow = false;
  private lcds: LcdRegistration[] = [];
  private i2cDevs: I2CRegistration[] = [];
  private devices: DeviceRegistration[] = [];
  /** pin-write listeners installed on each board for the current build */
  private installedListeners = new Map<McuRuntime, (pin: number, value: 0 | 1, t: number) => void>();

  constructor(private doc: CircuitDoc) {}

  /** Compile all microcontroller sketches. Returns errors keyed by component id. */
  compile(): Map<string, McuError> {
    const errors = new Map<string, McuError>();
    this.mcus.clear();
    for (const c of this.doc.components) {
      const def = getDef(c.type);
      if (!def?.mcu) continue;
      const rt = new McuRuntime(def.mcu.board);
      rt.env = this.envFor(c.id, def.mcu.board);
      const err = rt.load(String(c.props.code ?? ''));
      if (err) errors.set(c.id, err);
      this.mcus.set(c.id, rt);
    }
    return errors;
  }

  start(): Map<string, McuError> {
    const errors = this.compile();
    this.rebuild(this.doc);
    return errors;
  }

  input(compId: string): Record<string, any> {
    let i = this.inputs.get(compId);
    if (!i) {
      i = {};
      this.inputs.set(compId, i);
    }
    return i;
  }

  /** (Re)build the electrical model, keeping per-part state (capacitor charge, motor speed, MCU). */
  rebuild(doc: CircuitDoc) {
    this.doc = doc;
    this.netlist = buildNetlist(doc);
    const alloc = new NodeAllocator(this.netlist);
    this.records = [];
    this.comps.clear();
    const grounds: number[] = [];
    this.lcds = [];
    this.mcuPinCache.clear();
    this.i2cDevs = [];
    this.devices = [];
    const env: BuildEnv = {
      grounds,
      signalFrequency: (k: string) => this.signalInfo(k)?.freq ?? 0,
      signalInfo: (k: string) => this.signalInfo(k),
      pinEdges: (k: string) => this.pinEdges(k),
      lcds: this.lcds,
      i2c: this.i2cDevs,
      devices: this.devices,
      deviceSend: (k, text) => this.deviceSend(k, text),
      levelAt: (k) => this.levelAt(k),
      now: () => this.time * 1e6,
      netOf: (k) => this.netOfKey(k),
      boardDriven: (k) => this.boardPinsOnNet(this.netOfKey(k)).some(([m, idx]) => m.pins[idx].mode === 'output'),
    };
    const builders: SimBuilder[] = [];
    for (const c of doc.components) {
      const def = getDef(c.type);
      if (!def?.build) continue;
      let st = this.persist.get(c.id);
      if (!st) {
        st = {};
        this.persist.set(c.id, st);
      }
      const b = new SimBuilder(alloc, c.id, st, this.input(c.id), this.mcus.get(c.id), this.records, env);
      builders.push(b);
      this.comps.set(c.id, def.build(b, c));
    }
    this.circuit = new Circuit(alloc.count);
    for (const r of this.records) this.circuit.add(r.prim);
    this.circuit.preferredGrounds = grounds;
    for (const b of builders) b.v = this.circuit.v;
    this.nodeOfNet = (n) => alloc.nodeOfNet(n);
    this.pinCharge.clear();
    this.frameStart = this.time;
    this.staticWarnings = this.staticChecks();
    this.installWatchers();
    // settle the initial operating point so the first frame isn't a transient from 0 V
    if (this.time === 0) this.stepOnce(1e-6, false);
  }

  private stepOnce(h: number, runMcus = true) {
    const t = this.time;
    if (runMcus) for (const m of this.mcus.values()) m.runUntil((t + h) * 1e6);
    for (const c of this.comps.values()) c.beforeStep?.(t, h);
    this.circuit.step(h);
    const v = this.circuit.v;
    for (const c of this.comps.values()) c.afterStep?.(v, h, t);
    for (const r of this.records) {
      let cur: number[] | null = null;
      for (let k = 0; k < r.pinKeys.length; k++) {
        const key = r.pinKeys[k];
        if (!key) continue;
        cur ??= r.prim.currents(v);
        this.pinCharge.set(key, (this.pinCharge.get(key) ?? 0) + cur[k] * h);
      }
    }
    this.time = t + h;
  }

  /** Advance by `realDt` seconds of wall-clock time (capped), within a CPU budget. */
  advance(realDt: number) {
    const target = this.time + Math.min(realDt, 0.05);
    const deadline = performance.now() + FRAME_BUDGET_MS;
    this.slow = false;
    while (this.time < target - 1e-9) {
      let h = MAX_STEP;
      for (const c of this.comps.values()) {
        const m = c.maxStep?.();
        if (m !== undefined && m < h) h = m;
      }
      h = Math.min(h, target - this.time);
      if (h < 1e-7) break;
      this.stepOnce(h);
      if (performance.now() > deadline) {
        this.slow = true;
        break;
      }
    }
  }

  snapshot(): SimSnapshot {
    const dt = this.time - this.frameStart;
    this.frameStart = this.time;
    const comps: SimSnapshot['comps'] = {};
    const warnings: SimWarning[] = [...this.staticWarnings];
    for (const [id, c] of this.comps) {
      comps[id] = c.frame?.(dt);
      for (const w of c.warnings?.() ?? []) warnings.push({ ...w, comp: id });
    }
    const wireFlow = this.wireFlows(dt);
    const netVolts = new Float64Array(this.netlist.nets.length);
    for (let n = 0; n < netVolts.length; n++) {
      const node = this.nodeOfNet(n);
      netVolts[n] = node === undefined ? NaN : this.circuit.v[node];
    }
    if (this.circuit.failed) warnings.push({ level: 'warn', message: 'The solver could not fully converge on this circuit; readings may be approximate.' });
    return { time: this.time, comps, warnings, wireFlow, netVolts, netOfPin: this.netlist.netOf, slow: this.slow, solverFailed: this.circuit.failed };
  }

  /** Distribute pin currents over each net's wiring (spanning tree) to animate wires. */
  private wireFlows(dt: number): Record<string, number> {
    const flows: Record<string, number> = {};
    if (dt <= 0) return flows;
    const inj = new Map<string, number>();
    for (const [k, q] of this.pinCharge) inj.set(k, -q / dt);
    this.pinCharge.clear();
    const adj = new Map<string, { to: string; wire?: string; forward: boolean }[]>();
    const link = (a: string, b: string, wire: string | undefined) => {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push({ to: b, wire, forward: true });
      adj.get(b)!.push({ to: a, wire, forward: false });
    };
    for (const e of this.netlist.edges) link(e.a, e.b, e.wireId);
    const seen = new Set<string>();
    for (const start of inj.keys()) {
      if (seen.has(start) || !adj.has(start)) continue;
      // BFS tree
      const order: string[] = [start];
      const parent = new Map<string, { from: string; wire?: string; forward: boolean }>();
      seen.add(start);
      for (let i = 0; i < order.length; i++) {
        const u = order[i];
        for (const e of adj.get(u) ?? []) {
          if (seen.has(e.to)) continue;
          seen.add(e.to);
          parent.set(e.to, { from: u, wire: e.wire, forward: e.forward });
          order.push(e.to);
        }
      }
      const sub = new Map<string, number>();
      for (let i = order.length - 1; i > 0; i--) {
        const u = order[i];
        const s = (sub.get(u) ?? 0) + (inj.get(u) ?? 0);
        const p = parent.get(u)!;
        // `s` flows from u towards its parent
        if (p.wire) flows[p.wire] = p.forward ? -s : s;
        sub.set(p.from, (sub.get(p.from) ?? 0) + s);
      }
    }
    return flows;
  }

  /** Board spec of an MCU component, if it is one. */
  private boardOf(compId: string): BoardSpec | undefined {
    const c = this.doc.components.find((x) => x.id === compId);
    return c ? getDef(c.type)?.mcu?.board : undefined;
  }

  private netOfKey(key: string) {
    return this.netlist?.netOf.get(key);
  }

  /** Board output pins on a net, as [runtime, pin index]. */
  private boardPinsOnNet(net: number | undefined): [McuRuntime, number][] {
    if (net === undefined) return [];
    const out: [McuRuntime, number][] = [];
    for (const [id, m] of this.mcus) {
      for (const idx of m.spec.pins) if (this.netOfKey(`${id}:${m.spec.pinId(idx)}`) === net) out.push([m, idx]);
    }
    return out;
  }

  /** Logic level on a net: a board output pin if one drives it, otherwise the solved voltage. */
  private levelAt(key: string): 0 | 1 {
    const net = this.netOfKey(key);
    for (const [m, idx] of this.boardPinsOnNet(net)) {
      const p = m.pins[idx];
      if (p.mode === 'output') return p.value;
    }
    if (net === undefined || !this.circuit) return 0;
    const node = this.nodeOfNet(net);
    return node !== undefined && this.circuit.v[node] > 1.5 ? 1 : 0;
  }

  /** A device sends text out of its TX pin: boards' serial ports and other devices on that net receive it. */
  private deviceSend(key: string, text: string) {
    const net = this.netOfKey(key);
    if (net === undefined) return;
    for (const [id, m] of this.mcus) {
      for (const port of m.allPorts()) if (this.netOfKey(`${id}:${m.spec.pinId(port.rxPin)}`) === net) port.push(text);
    }
    for (const d of this.devices) if (d.receive && d.pins.rx && `${d.compId}:${d.pins.rx}` !== key && this.netOfKey(`${d.compId}:${d.pins.rx}`) === net && d.powered()) d.receive(text);
  }

  /** Route board digitalWrite()s to devices watching those nets (shift registers, trigger pins, CS lines). */
  private installWatchers() {
    for (const [m, fn] of this.installedListeners) m.pinListeners.delete(fn);
    this.installedListeners.clear();
    const watchers = this.devices.filter((d) => d.watch);
    if (!watchers.length) return;
    for (const [id, m] of this.mcus) {
      const byPin = new Map<number, ((v: 0 | 1, t: number) => void)[]>();
      for (const d of watchers) {
        for (const [role, fn] of Object.entries(d.watch!)) {
          const net = this.netOfKey(`${d.compId}:${d.pins[role]}`);
          if (net === undefined) continue;
          for (const idx of m.spec.pins) {
            if (this.netOfKey(`${id}:${m.spec.pinId(idx)}`) !== net) continue;
            if (!byPin.has(idx)) byPin.set(idx, []);
            byPin.get(idx)!.push((v, t) => d.powered() && fn(v, t));
          }
        }
      }
      if (!byPin.size) continue;
      const listener = (pin: number, v: 0 | 1, t: number) => byPin.get(pin)?.forEach((f) => f(v, t));
      m.pinListeners.add(listener);
      this.installedListeners.set(m, listener);
    }
  }

  /** Library hooks for one board: find LCDs / I2C devices wired to its pins. */
  private envFor(mcuId: string, board: BoardSpec): McuEnv {
    const netOfPin = (n: number) => this.netlist?.netOf.get(`${mcuId}:${board.pinId(n)}`);
    const netOf = (comp: string, pin: string) => this.netlist?.netOf.get(`${comp}:${pin}`);
    /** is a device's pin held LOW by a board output (chip select)? */
    const low = (comp: string, pin: string) => this.levelAt(`${comp}:${pin}`) === 0 && netOf(comp, pin) !== undefined;
    return {
      spi: (out) => {
        const sck = netOfPin(board.spi.sck);
        let res = 0xff;
        let first = true;
        for (const d of this.devices) {
          if (!d.transfer || !d.powered() || netOf(d.compId, d.pins.sck) !== sck || !low(d.compId, d.pins.cs)) continue;
          const r = d.transfer(out);
          if (first) res = r;
          first = false;
        }
        for (const d of this.devices) if (d.kind === 'spi-spy' && netOf(d.compId, d.pins.sck) === sck && low(d.compId, d.pins.cs)) d.api.observe(out, res);
        return res;
      },
      device: (kind, pin) => {
        const net = netOfPin(pin);
        if (net === undefined) return null;
        const d = this.devices.find((x) => x.kind === kind && netOf(x.compId, x.pins[x.key ?? Object.keys(x.pins)[0]]) === net && x.powered());
        return d ? d.api : null;
      },
      uartSend: (txPin, text) => {
        const net = netOfPin(txPin);
        if (net === undefined) return;
        for (const d of this.devices) if (d.receive && d.pins.rx && netOf(d.compId, d.pins.rx) === net && d.powered()) d.receive(text);
        for (const [id, m] of this.mcus) {
          if (id === mcuId && txPin === m.spec.uarts[0]?.tx) continue; // USB serial does not loop back
          for (const port of m.allPorts()) if (this.netOfKey(`${id}:${m.spec.pinId(port.rxPin)}`) === net) port.push(text);
        }
      },
      pulse: (pin, state) => {
        const net = netOfPin(pin);
        const d = this.devices.find((x) => x.pulse && netOf(x.compId, x.pins.out) === net && x.powered());
        return d ? d.pulse!(state, this.mcus.get(mcuId)!.t) : null;
      },
      lcdFor: (rs, en, data) => {
        const rsNet = netOfPin(rs), enNet = netOfPin(en);
        if (rsNet === undefined || enNet === undefined) return null;
        const reg = this.lcds.find((l) => netOf(l.compId, l.rs) === rsNet && netOf(l.compId, l.en) === enNet);
        if (!reg) return null;
        const d4 = data.slice(-4);
        reg.dataMismatch = d4.some((p, i) => netOfPin(p) !== netOf(reg.compId, reg.data4[i]));
        return reg.ctrl;
      },
      i2c: (addr) => {
        const sda = netOfPin(board.i2c.sda), scl = netOfPin(board.i2c.scl);
        const reg = this.i2cDevs.find((d) => d.address === addr && netOf(d.compId, d.sda) === sda && netOf(d.compId, d.scl) === scl && d.powered());
        return reg ? reg.device : null;
      },
    };
  }

  /** Board pins reachable from a pin through nearby parts (nearest first); cached per rebuild. */
  private mcuPinCache = new Map<string, { mcu: McuRuntime; idx: number; depth: number }[]>();
  private nearbyMcuPins(pinKey: string): { mcu: McuRuntime; idx: number; depth: number }[] {
    const hit = this.mcuPinCache.get(pinKey);
    if (hit) return hit;
    const out: { mcu: McuRuntime; idx: number; depth: number }[] = [];
    this.mcuPinCache.set(pinKey, out);
    const nl = this.netlist;
    const byComp = new Map<string, string[]>();
    for (const key of nl.netOf.keys()) {
      const id = key.slice(0, key.indexOf(':'));
      if (!byComp.has(id)) byComp.set(id, []);
      byComp.get(id)!.push(key);
    }
    const compOf = (k: string) => k.slice(0, k.indexOf(':'));
    const startComp = compOf(pinKey);
    const startNet = nl.netOf.get(pinKey);
    if (startNet === undefined) return out;
    let frontier = [startNet];
    const seenNets = new Set(frontier);
    const seenComps = new Set([startComp]);
    for (let depth = 0; depth < 3 && frontier.length; depth++) {
      const next: number[] = [];
      for (const net of frontier) {
        for (const k of nl.nets[net] ?? []) {
          const cid = compOf(k);
          const mcu = this.mcus.get(cid);
          if (mcu) {
            const idx = mcu.spec.pinIndex(k.slice(cid.length + 1));
            if (idx >= 0) out.push({ mcu, idx, depth });
            continue;
          }
          if (seenComps.has(cid)) continue;
          seenComps.add(cid);
          const c = this.doc.components.find((x) => x.id === cid);
          if (!c || (getDef(c.type)?.layer ?? 1) === 0) continue;
          for (const pk of byComp.get(cid) ?? []) {
            const n = nl.netOf.get(pk)!;
            if (!seenNets.has(n)) {
              seenNets.add(n);
              next.push(n);
            }
          }
        }
      }
      frontier = next;
    }
    return out;
  }

  /** Walk from a pin through nearby parts to find a tone()/PWM/servo pin driving it. */
  private signalInfo(pinKey: string): SignalInfo | null {
    const net = this.netOfKey(pinKey);
    if (net !== undefined) {
      for (const d of this.devices) {
        if (!d.api?.signalOn || !d.powered()) continue;
        for (const [role, pin] of Object.entries(d.pins)) {
          if (this.netOfKey(`${d.compId}:${pin}`) !== net) continue;
          const info = d.api.signalOn(role) as SignalInfo | null;
          if (info) return info;
        }
      }
    }
    for (const { mcu, idx } of this.nearbyMcuPins(pinKey)) {
      const f = mcu.pinFrequency(idx);
      if (f) return { freq: f, servoUs: mcu.pins[idx].servo, vcc: mcu.spec.vcc };
    }
    return null;
  }

  /** Rising edges written by the board output pin wired (directly) to this pin. */
  private pinEdges(pinKey: string): number | null {
    // only a direct wire (same net) counts as a clock line
    for (const { mcu, idx, depth } of this.nearbyMcuPins(pinKey)) if (depth === 0 && mcu.pins[idx].mode === 'output') return mcu.pins[idx].rises;
    return null;
  }


  /** Topology checks that don't need a solve: e.g. circuits hanging off a board with no ground return. */
  private staticChecks(): SimWarning[] {
    const out: SimWarning[] = [];
    const nl = this.netlist;
    const compOf = (k: string) => k.slice(0, k.indexOf(':'));
    const compById = new Map(this.doc.components.map((c) => [c.id, c]));
    const pinsOfComp = new Map<string, string[]>();
    for (const k of nl.netOf.keys()) {
      const id = compOf(k);
      if (!pinsOfComp.has(id)) pinsOfComp.set(id, []);
      pinsOfComp.get(id)!.push(k);
    }
    for (const [mcuId] of this.mcus) {
      const board = this.boardOf(mcuId);
      if (!board) continue;
      const isIo = (p: string) => board.pinIndex(p) >= 0 || p === '5V' || p === '3V3' || p === 'VIN';
      const gndNet = nl.netOf.get(`${mcuId}:GND1`);
      const flagged = new Set<number>();
      for (const k of pinsOfComp.get(mcuId) ?? []) {
        const pin = k.slice(mcuId.length + 1);
        if (!isIo(pin)) continue;
        const startNet = nl.netOf.get(k)!;
        const hasOthers = nl.nets[startNet].some((x) => compOf(x) !== mcuId && (getDef(compById.get(compOf(x))?.type ?? '')?.layer ?? 1) !== 0);
        if (!hasOthers || flagged.has(startNet)) continue;
        // flood through parts (not through the MCU itself, not through boards)
        const seen = new Set([startNet]);
        const queue = [startNet];
        let reachesGround = false;
        let hasSource = false;
        while (queue.length && !reachesGround) {
          const net = queue.shift()!;
          if (net === gndNet) {
            reachesGround = true;
            break;
          }
          for (const pk of nl.nets[net]) {
            const cid = compOf(pk);
            if (cid === mcuId) {
              const p = pk.slice(mcuId.length + 1);
              if (p !== pin && isIo(p)) hasSource = true; // another pin can sink current
              continue;
            }
            const c = compById.get(cid);
            const def = c && getDef(c.type);
            if (!def || def.layer === 0) continue;
            if (def.type === 'battery' || this.mcus.has(cid)) hasSource = true;
            for (const other of pinsOfComp.get(cid) ?? []) {
              const n = nl.netOf.get(other)!;
              if (!seen.has(n)) {
                seen.add(n);
                queue.push(n);
              }
            }
          }
        }
        if (!reachesGround && !hasSource) {
          flagged.add(startNet);
          out.push({ comp: mcuId, level: 'warn', message: `Missing ground: the circuit on pin ${pin} has no path back to a GND pin, so no current can flow.` });
        }
      }
    }
    return out;
  }
}
