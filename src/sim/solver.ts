/**
 * Modified nodal analysis engine.
 *
 * Every element is expressed as conductances + current injections (Norton form),
 * so the system matrix only holds node voltages. Nonlinear parts (diodes, BJTs)
 * are linearised with Newton-Raphson; capacitors use backward-Euler companion models.
 * Every node gets a tiny conductance to an absolute reference so floating
 * sub-circuits stay solvable.
 */

export const VT = 0.025852; // thermal voltage at 300K
const GMIN_NODE = 1e-9;
const GMIN_JUNCTION = 1e-12;

export interface StampCtx {
  G: Float64Array; // row-major n*n
  I: Float64Array;
  n: number;
  v: Float64Array; // current Newton iterate
  h: number; // timestep (s)
  iter: number; // Newton iteration within this step
}

export abstract class Prim {
  /** Node indices; -1 means "not connected" (element terminal floats alone). */
  constructor(public nodes: number[]) {}
  nonlinear = false;
  abstract stamp(c: StampCtx): void;
  /** Newton convergence check for nonlinear prims. */
  converged(_v: Float64Array): boolean {
    return true;
  }
  /** Called once the timestep has converged. */
  accept(_v: Float64Array, _h: number): void {}
  /** Current flowing INTO the device at each terminal (A). */
  abstract currents(v: Float64Array): number[];
}

export function nv(v: Float64Array, n: number): number {
  return n < 0 ? 0 : v[n];
}

function addG(c: StampCtx, a: number, b: number, g: number) {
  const n = c.n;
  if (a >= 0) c.G[a * n + a] += g;
  if (b >= 0) c.G[b * n + b] += g;
  if (a >= 0 && b >= 0) {
    c.G[a * n + b] -= g;
    c.G[b * n + a] -= g;
  }
}

/** Current source pushing `i` amps out of node a (through the source) into node b. */
function addI(c: StampCtx, a: number, b: number, i: number) {
  if (a >= 0) c.I[a] -= i;
  if (b >= 0) c.I[b] += i;
}

export class Resistor extends Prim {
  constructor(a: number, b: number, public r: number) {
    super([a, b]);
  }
  stamp(c: StampCtx) {
    addG(c, this.nodes[0], this.nodes[1], 1 / Math.max(this.r, 1e-6));
  }
  currents(v: Float64Array) {
    const i = (nv(v, this.nodes[0]) - nv(v, this.nodes[1])) / Math.max(this.r, 1e-6);
    return [i, -i];
  }
}

/** Ideal voltage `volts` (p above n) in series with resistance `r`. */
export class Source extends Prim {
  constructor(p: number, n: number, public volts: number, public r: number) {
    super([p, n]);
  }
  stamp(c: StampCtx) {
    const g = 1 / Math.max(this.r, 1e-6);
    addG(c, this.nodes[0], this.nodes[1], g);
    // Norton current V/R flows from n to p inside the source.
    addI(c, this.nodes[1], this.nodes[0], this.volts * g);
  }
  currents(v: Float64Array) {
    const g = 1 / Math.max(this.r, 1e-6);
    const i = g * (nv(v, this.nodes[0]) - nv(v, this.nodes[1])) - this.volts * g;
    return [i, -i];
  }
}

/** Ideal current source: `amps` flow from p, through the external circuit, back into n. */
export class CurrentSource extends Prim {
  constructor(p: number, n: number, public amps: number) {
    super([p, n]);
  }
  stamp(c: StampCtx) {
    addI(c, this.nodes[1], this.nodes[0], this.amps);
  }
  currents() {
    return [-this.amps, this.amps];
  }
}

export class Capacitor extends Prim {
  vPrev = 0;
  constructor(a: number, b: number, public c: number, initial = 0) {
    super([a, b]);
    this.vPrev = initial;
  }
  stamp(ctx: StampCtx) {
    const g = this.c / ctx.h;
    addG(ctx, this.nodes[0], this.nodes[1], g);
    addI(ctx, this.nodes[1], this.nodes[0], g * this.vPrev);
  }
  lastH = 1e-3;
  accept(v: Float64Array, h: number) {
    this.lastH = h;
    this.lastI = (this.c / h) * (nv(v, this.nodes[0]) - nv(v, this.nodes[1]) - this.vPrev);
    this.vPrev = nv(v, this.nodes[0]) - nv(v, this.nodes[1]);
  }
  lastI = 0;
  currents() {
    return [this.lastI, -this.lastI];
  }
}

export interface DiodeParams {
  is: number;
  n: number;
  /** Reverse breakdown voltage (positive number), optional. */
  bv?: number;
  /** Series resistance. */
  rs?: number;
}

function limitJunction(vnew: number, vold: number, vt: number, vcrit: number): number {
  // SPICE pnjlim
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(vnew / vt);
    }
  }
  return vnew;
}

function safeExp(x: number): number {
  if (x > 80) return Math.exp(80) * (1 + x - 80);
  return Math.exp(x);
}

export function diodeIV(vd: number, p: DiodeParams): [number, number] {
  const nvt = p.n * VT;
  const e = safeExp(vd / nvt);
  let i = p.is * (e - 1);
  let g = (p.is / nvt) * e;
  if (p.bv !== undefined && vd < -p.bv + 5 * nvt) {
    // reverse breakdown branch
    const eb = safeExp((-p.bv - vd) / nvt);
    i -= p.is * eb * 1e6;
    g += ((p.is * 1e6) / nvt) * eb;
  }
  return [i, g + GMIN_JUNCTION];
}

export class Diode extends Prim {
  nonlinear = true;
  vd = 0;
  /** A destroyed junction: behaves as an open circuit. */
  open = false;
  private vcrit: number;
  constructor(a: number, k: number, public p: DiodeParams) {
    super([a, k]);
    const nvt = p.n * VT;
    this.vcrit = nvt * Math.log(nvt / (Math.SQRT2 * p.is));
  }
  stamp(c: StampCtx) {
    const [a, k] = this.nodes;
    if (this.open) {
      addG(c, a, k, GMIN_JUNCTION);
      return;
    }
    let vd = nv(c.v, a) - nv(c.v, k);
    const nvt = this.p.n * VT;
    vd = limitJunction(vd, this.vd, nvt, this.vcrit);
    if (this.p.bv !== undefined && vd < -this.p.bv) {
      // limit in breakdown direction as well (mirror)
      const vr = limitJunction(-vd - this.p.bv, -this.vd - this.p.bv, nvt, this.vcrit);
      vd = -vr - this.p.bv;
    }
    this.vd = vd;
    const [i, g] = diodeIV(vd, this.p);
    addG(c, a, k, g);
    addI(c, a, k, i - g * vd);
  }
  converged(v: Float64Array) {
    if (this.open) return true;
    const vd = nv(v, this.nodes[0]) - nv(v, this.nodes[1]);
    return Math.abs(vd - this.vd) < 1e-6 + 1e-3 * Math.abs(vd);
  }
  currents(v: Float64Array) {
    const vd = nv(v, this.nodes[0]) - nv(v, this.nodes[1]);
    if (this.open) return [vd * GMIN_JUNCTION, -vd * GMIN_JUNCTION];
    const [i] = diodeIV(vd, this.p);
    return [i, -i];
  }
}

export interface BjtParams {
  pnp: boolean;
  is: number;
  bf: number;
  br: number;
}

/** Ebers-Moll transport model. Nodes: [collector, base, emitter]. */
export class Bjt extends Prim {
  nonlinear = true;
  vbe = 0;
  vbc = 0;
  private vcrit: number;
  constructor(c: number, b: number, e: number, public p: BjtParams) {
    super([c, b, e]);
    this.vcrit = VT * Math.log(VT / (Math.SQRT2 * p.is));
  }
  private eval(vbe: number, vbc: number) {
    const { is, bf, br } = this.p;
    const ef = safeExp(vbe / VT);
    const er = safeExp(vbc / VT);
    const iF = is * (ef - 1);
    const iR = is * (er - 1);
    const gf = (is / VT) * ef + GMIN_JUNCTION;
    const gr = (is / VT) * er + GMIN_JUNCTION;
    const ic = iF - iR - iR / br;
    const ib = iF / bf + iR / br;
    return { ic, ib, gf, gr };
  }
  stamp(c: StampCtx) {
    const s = this.p.pnp ? -1 : 1;
    const [nc, nb, ne] = this.nodes;
    const vc = nv(c.v, nc);
    const vb = nv(c.v, nb);
    const ve = nv(c.v, ne);
    let vbe = s * (vb - ve);
    let vbc = s * (vb - vc);
    vbe = limitJunction(vbe, this.vbe, VT, this.vcrit);
    vbc = limitJunction(vbc, this.vbc, VT, this.vcrit);
    this.vbe = vbe;
    this.vbc = vbc;
    const { ic, ib, gf, gr } = this.eval(vbe, vbc);
    const br = this.p.br, bf = this.p.bf;
    // Terminal currents into device (in the "npn frame"): Ic, Ib, Ie=-(Ic+Ib)
    // Partial derivatives w.r.t. vbe and vbc
    const dIc_dvbe = gf, dIc_dvbc = -gr - gr / br;
    const dIb_dvbe = gf / bf, dIb_dvbc = gr / br;
    // vbe = s(vb - ve), vbc = s(vb - vc)
    // dI/dVc = -s*dI/dvbc ; dI/dVb = s*(dI/dvbe + dI/dvbc) ; dI/dVe = -s*dI/dvbe
    // Actual current = s * I_frame, so Jacobian entries get s*s = 1.
    const rows: [number, number, number, number][] = [
      // node, dI/dVc, dI/dVb, dI/dVe  (currents into device, actual frame)
      [nc, -dIc_dvbc, dIc_dvbe + dIc_dvbc, -dIc_dvbe],
      [nb, -dIb_dvbc, dIb_dvbe + dIb_dvbc, -dIb_dvbe],
      [ne, dIc_dvbc + dIb_dvbc, -(dIc_dvbe + dIc_dvbc + dIb_dvbe + dIb_dvbc), dIc_dvbe + dIb_dvbe],
    ];
    const I0 = [s * ic, s * ib, -s * (ic + ib)];
    const cols = [nc, nb, ne];
    // Terminal voltages consistent with the (limited) junction voltages.
    const vLin = [vb - s * vbc, vb, vb - s * vbe];
    const n = c.n;
    for (let r = 0; r < 3; r++) {
      const [node, j0, j1, j2] = rows[r];
      if (node < 0) continue;
      const J = [j0, j1, j2];
      let rhs = I0[r];
      for (let k = 0; k < 3; k++) {
        rhs -= J[k] * vLin[k];
        if (cols[k] >= 0) c.G[node * n + cols[k]] += J[k];
      }
      c.I[node] -= rhs;
    }
  }
  converged(v: Float64Array) {
    const s = this.p.pnp ? -1 : 1;
    const [nc, nb, ne] = this.nodes;
    const vbe = s * (nv(v, nb) - nv(v, ne));
    const vbc = s * (nv(v, nb) - nv(v, nc));
    return Math.abs(vbe - this.vbe) < 1e-6 + 1e-3 * Math.abs(vbe) && Math.abs(vbc - this.vbc) < 1e-6 + 1e-3 * Math.abs(vbc);
  }
  currents(v: Float64Array) {
    const s = this.p.pnp ? -1 : 1;
    const [nc, nb, ne] = this.nodes;
    const vbe = s * (nv(v, nb) - nv(v, ne));
    const vbc = s * (nv(v, nb) - nv(v, nc));
    const { ic, ib } = this.eval(vbe, vbc);
    return [s * ic, s * ib, -s * (ic + ib)];
  }
}

/** Dense LU solve with partial pivoting; returns false when singular. */
export function luSolve(A: Float64Array, b: Float64Array, n: number, x: Float64Array): boolean {
  const perm = new Int32Array(n);
  for (let i = 0; i < n; i++) perm[i] = i;
  for (let k = 0; k < n; k++) {
    let p = k;
    let max = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const a = Math.abs(A[i * n + k]);
      if (a > max) {
        max = a;
        p = i;
      }
    }
    if (max < 1e-30) return false;
    if (p !== k) {
      for (let j = 0; j < n; j++) {
        const t = A[k * n + j];
        A[k * n + j] = A[p * n + j];
        A[p * n + j] = t;
      }
      const t = b[k];
      b[k] = b[p];
      b[p] = t;
    }
    const akk = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i * n + k] / akk;
      if (f === 0) continue;
      A[i * n + k] = 0;
      for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      b[i] -= f * b[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
    x[i] = s / A[i * n + i];
  }
  return true;
}

export class Circuit {
  prims: Prim[] = [];
  v: Float64Array;
  private ctx: StampCtx;
  private next: Float64Array;
  private hasNonlinear = false;
  lastIterations = 0;
  failed = false;

  constructor(public n: number) {
    this.v = new Float64Array(n);
    this.next = new Float64Array(n);
    this.ctx = { G: new Float64Array(n * n), I: new Float64Array(n), n, v: this.v, h: 1e-3, iter: 0 };
  }

  add<T extends Prim>(p: T): T {
    this.prims.push(p);
    if (p.nonlinear) this.hasNonlinear = true;
    this.anchors = null;
    return p;
  }

  /** Nodes preferred as the 0V reference of their connected cluster (e.g. board GND). */
  preferredGrounds: number[] = [];
  private anchors: number[] | null = null;

  /** Pick one reference node per connected cluster so floating circuits are well conditioned. */
  private computeAnchors() {
    const parent = Array.from({ length: this.n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const p of this.prims) {
      const ns = p.nodes.filter((x) => x >= 0);
      for (let i = 1; i < ns.length; i++) parent[find(ns[i])] = find(ns[0]);
    }
    const chosen = new Map<number, number>();
    for (const g of this.preferredGrounds) if (g >= 0 && g < this.n && !chosen.has(find(g))) chosen.set(find(g), g);
    for (let i = 0; i < this.n; i++) if (!chosen.has(find(i))) chosen.set(find(i), i);
    this.anchors = [...chosen.values()];
  }

  /** Advance one timestep of length h (seconds). */
  step(h: number): boolean {
    const n = this.n;
    if (n === 0) {
      for (const p of this.prims) p.accept(this.v, h);
      return true;
    }
    const ctx = this.ctx;
    ctx.h = h;
    if (!this.anchors) this.computeAnchors();
    const maxIter = this.hasNonlinear ? 80 : 1;
    let ok = false;
    let it = 0;
    for (; it < maxIter; it++) {
      ctx.G.fill(0);
      ctx.I.fill(0);
      ctx.v = this.v;
      ctx.iter = it;
      for (let i = 0; i < n; i++) ctx.G[i * n + i] += GMIN_NODE;
      for (const a of this.anchors!) ctx.G[a * n + a] += 1;
      for (const p of this.prims) p.stamp(ctx);
      if (!luSolve(ctx.G, ctx.I, n, this.next)) {
        this.failed = true;
        return false;
      }
      let maxDelta = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(this.next[i] - this.v[i]) / (1 + Math.abs(this.next[i]));
        if (d > maxDelta) maxDelta = d;
        if (!Number.isFinite(this.next[i])) {
          this.failed = true;
          return false;
        }
      }
      this.v.set(this.next);
      if (!this.hasNonlinear) {
        ok = true;
        break;
      }
      if (maxDelta < 1e-6 && this.prims.every((p) => !p.nonlinear || p.converged(this.v))) {
        ok = true;
        break;
      }
    }
    this.lastIterations = it + 1;
    for (const p of this.prims) p.accept(this.v, h);
    this.failed = !ok;
    return ok;
  }
}

// ---------------------------------------------------------------- behavioural elements
// Values come from a formula of node voltages (used by AI-generated parts). They are
// re-evaluated every Newton iteration and must settle before a step is accepted.

type ValueFn = (v: Float64Array) => number;

const FREEZE_AFTER = 30;

abstract class Behavioural extends Prim {
  nonlinear = true;
  last = 0;
  private frozen = false;
  constructor(nodes: number[], public fn: ValueFn) {
    super(nodes);
  }
  /** Formula value for this iteration; frozen late in a step so discontinuous formulas still settle. */
  protected eval(c: StampCtx) {
    this.frozen = c.iter >= FREEZE_AFTER;
    if (this.frozen) return this.last;
    const x = this.fn(c.v);
    this.last = Number.isFinite(x) ? x : 0;
    return this.last;
  }
  converged(v: Float64Array) {
    if (this.frozen) return true;
    const x = this.fn(v);
    return Math.abs(x - this.last) < 1e-6 + 1e-4 * Math.abs(x);
  }
}

/** Voltage source (p above n) with series resistance r whose value is a formula. */
export class BehaviouralSource extends Behavioural {
  constructor(p: number, n: number, fn: ValueFn, public r: number) {
    super([p, n], fn);
  }
  stamp(c: StampCtx) {
    const g = 1 / Math.max(this.r, 1e-6);
    addG(c, this.nodes[0], this.nodes[1], g);
    addI(c, this.nodes[1], this.nodes[0], this.eval(c) * g);
  }
  currents(v: Float64Array) {
    const g = 1 / Math.max(this.r, 1e-6);
    const i = g * (nv(v, this.nodes[0]) - nv(v, this.nodes[1])) - this.last * g;
    return [i, -i];
  }
}

/** Current source pushing `fn` amps out of p through the circuit into n. */
export class BehaviouralCurrent extends Behavioural {
  constructor(p: number, n: number, fn: ValueFn) {
    super([p, n], fn);
  }
  stamp(c: StampCtx) {
    addI(c, this.nodes[1], this.nodes[0], this.eval(c));
  }
  currents() {
    return [-this.last, this.last];
  }
}

/** Resistance given by a formula (switches, sensors, thermistors …). */
export class BehaviouralResistor extends Behavioural {
  constructor(a: number, b: number, fn: ValueFn) {
    super([a, b], fn);
  }
  stamp(c: StampCtx) {
    const r = Math.min(1e12, Math.max(1e-3, this.eval(c)));
    addG(c, this.nodes[0], this.nodes[1], 1 / r);
  }
  currents(v: Float64Array) {
    const r = Math.min(1e12, Math.max(1e-3, this.last));
    const i = (nv(v, this.nodes[0]) - nv(v, this.nodes[1])) / r;
    return [i, -i];
  }
}

// ---------------------------------------------------------------- general helpers for multi-terminal devices

/**
 * Stamp a linearised terminal current: I_into(row) = Σ coef[k]·v[node k] + c.
 * Rows/nodes of -1 (unconnected) are skipped.
 */
function stampRow(c: StampCtx, row: number, nodes: number[], coefs: number[], constant: number) {
  if (row < 0) return;
  const n = c.n;
  for (let k = 0; k < nodes.length; k++) if (nodes[k] >= 0 && coefs[k] !== 0) c.G[row * n + nodes[k]] += coefs[k];
  c.I[row] -= constant;
}

// ---------------------------------------------------------------- MOSFET

export interface MosfetParams {
  pmos: boolean;
  /** threshold voltage magnitude (V); negative for depletion devices (JFET-like) */
  vth: number;
  /** transconductance parameter (A/V²) */
  k: number;
  lambda?: number;
}

/** Square-law MOSFET with a smooth turn-on. Nodes: [drain, gate, source]. Symmetric (drain/source swap). */
export class Mosfet extends Prim {
  nonlinear = true;
  vgs = 0;
  vds = 0;
  constructor(d: number, g: number, s: number, public p: MosfetParams) {
    super([d, g, s]);
  }
  private evalIds(vgs: number, vds: number) {
    const { vth, k } = this.p;
    const lambda = this.p.lambda ?? 0.01;
    const nvt = 0.04;
    // smooth overdrive (softplus) so the solver sees a continuous derivative near threshold
    const x = (vgs - vth) / nvt;
    const vov = x > 30 ? vgs - vth : nvt * Math.log1p(Math.exp(x));
    const dvov = x > 30 ? 1 : 1 / (1 + Math.exp(-x));
    let id: number, gm: number, gds: number;
    if (vds < vov) {
      id = k * (vov * vds - (vds * vds) / 2) * (1 + lambda * vds);
      gm = k * vds * (1 + lambda * vds) * dvov;
      gds = k * (vov - vds) * (1 + lambda * vds) + k * (vov * vds - (vds * vds) / 2) * lambda;
    } else {
      id = (k / 2) * vov * vov * (1 + lambda * vds);
      gm = k * vov * (1 + lambda * vds) * dvov;
      gds = (k / 2) * vov * vov * lambda;
    }
    return { id, gm, gds: gds + 1e-9 };
  }
  /** drain current (into drain) in the actual frame, plus Jacobian w.r.t. node voltages */
  private solve(vd: number, vg: number, vs: number) {
    const s = this.p.pmos ? -1 : 1;
    let d0 = vd, s0 = vs, swapped = false;
    if (s * (vd - vs) < 0) {
      [d0, s0] = [vs, vd];
      swapped = true;
    }
    const vgs = s * (vg - s0), vds = s * (d0 - s0);
    const { id, gm, gds } = this.evalIds(vgs, vds);
    // current into the "effective drain" (actual frame) = s*id
    return { id: s * id, gm, gds, swapped, vgs, vds };
  }
  stamp(c: StampCtx) {
    const [nd, ng, ns] = this.nodes;
    const vd = nv(c.v, nd), vg = nv(c.v, ng), vs = nv(c.v, ns);
    // limit gate-source swings between iterations for robustness
    const s = this.p.pmos ? -1 : 1;
    let vgs = s * (vg - vs);
    if (Math.abs(vgs - this.vgs) > 1) vgs = this.vgs + Math.sign(vgs - this.vgs);
    const vgL = vs + s * vgs;
    const r = this.solve(vd, vgL, vs);
    this.vgs = vgs;
    this.vds = s * (vd - vs);
    // effective drain/source nodes
    const D = r.swapped ? ns : nd, S = r.swapped ? nd : ns;
    const vD = r.swapped ? vs : vd, vS = r.swapped ? vd : vs;
    // I_into(D) = id(vgs, vds); partials in actual frame: dI/dVg = gm, dI/dVD = gds, dI/dVS = -(gm+gds)
    const coefs = [r.gds, r.gm, -(r.gm + r.gds)];
    const nodes = [D, ng, S];
    const lin = r.gds * vD + r.gm * vgL - (r.gm + r.gds) * vS;
    stampRow(c, D, nodes, coefs, r.id - lin);
    stampRow(c, S, nodes, coefs.map((x) => -x), -(r.id - lin));
  }
  converged(v: Float64Array) {
    const [nd, ng, ns] = this.nodes;
    const s = this.p.pmos ? -1 : 1;
    const vgs = s * (nv(v, ng) - nv(v, ns));
    return Math.abs(vgs - this.vgs) < 1e-6 + 1e-3 * Math.abs(vgs) && Math.abs(s * (nv(v, nd) - nv(v, ns)) - this.vds) < 1e-5 + 1e-3 * Math.abs(this.vds);
  }
  currents(v: Float64Array) {
    const [nd, ng, ns] = this.nodes;
    const r = this.solve(nv(v, nd), nv(v, ng), nv(v, ns));
    const idrain = r.swapped ? -r.id : r.id;
    return [idrain, 0, -idrain];
  }
}

// ---------------------------------------------------------------- op-amp / comparator

export interface OpAmpParams {
  gain: number;
  /** output headroom below V+ and above V− */
  dropHigh: number;
  dropLow: number;
  rout: number;
}

/** Op-amp with tanh output saturation. Nodes: [in+, in−, out, V+, V−]. Output current returns through V−. */
export class OpAmp extends Prim {
  nonlinear = true;
  /** normalised tanh argument used in the last iteration (limited like a junction voltage) */
  private x = 0;
  constructor(p: number, n: number, out: number, vcc: number, vee: number, public prm: OpAmpParams) {
    super([p, n, out, vcc, vee]);
  }
  private rails(v: Float64Array) {
    const [, , , vcc, vee] = this.nodes;
    const hi = nv(v, vcc) - this.prm.dropHigh, lo = nv(v, vee) + this.prm.dropLow;
    return { c: (hi + lo) / 2, h: Math.max(0.01, (hi - lo) / 2) };
  }
  private xOf(v: Float64Array, h: number) {
    const [p, n] = this.nodes;
    return (this.prm.gain * (nv(v, p) - nv(v, n))) / h;
  }
  stamp(c: StampCtx) {
    const [p, n, out, , vee] = this.nodes;
    const { c: mid, h } = this.rails(c.v);
    let x = this.xOf(c.v, h);
    // step limiting: the operating point may only move ~2 "tanh units" per iteration
    if (Math.abs(x - this.x) > 2) x = this.x + 2 * Math.sign(x - this.x);
    x = Math.max(-40, Math.min(40, x));
    this.x = x;
    const t = Math.tanh(x);
    const vt = mid + h * t;
    const d = this.prm.gain * (1 - t * t); // dVt/d(vp − vn)
    const vdL = (x * h) / this.prm.gain;
    const g = 1 / this.prm.rout;
    // I_into(out) = g·(v_out − Vt − d·(vd − vdL))
    const nodes = [out, p, n];
    const coefs = [g, -g * d, g * d];
    const k0 = -g * (vt - d * vdL);
    stampRow(c, out, nodes, coefs, k0);
    stampRow(c, vee, nodes, coefs.map((q) => -q), -k0);
  }
  converged(v: Float64Array) {
    const { h } = this.rails(v);
    const x = this.xOf(v, h);
    if (Math.abs(x) > 30 && Math.abs(this.x) > 30 && Math.sign(x) === Math.sign(this.x)) return true;
    return Math.abs(x - this.x) < 1e-3;
  }
  currents(v: Float64Array) {
    const [, , out] = this.nodes;
    const { c: mid, h } = this.rails(v);
    const x = Math.max(-40, Math.min(40, this.xOf(v, h)));
    const i = (nv(v, out) - (mid + h * Math.tanh(x))) / this.prm.rout;
    return [0, 0, i, 0, -i];
  }
}

/** Open-collector comparator (LM393 style): output sinks to V− when in+ < in−. Nodes: [in+, in−, out, V−]. */
export class Comparator extends Prim {
  nonlinear = true;
  private lastG = 0;
  constructor(p: number, n: number, out: number, vee: number, public gon = 1 / 80, public sharpness = 400) {
    super([p, n, out, vee]);
  }
  private g(v: Float64Array) {
    const [p, n] = this.nodes;
    const x = Math.max(-40, Math.min(40, this.sharpness * (nv(v, n) - nv(v, p))));
    const s = 1 / (1 + Math.exp(-x));
    return { g: this.gon * s + 1e-9, dg: this.gon * this.sharpness * s * (1 - s) };
  }
  stamp(c: StampCtx) {
    const [p, n, out, vee] = this.nodes;
    const { g, dg } = this.g(c.v);
    this.lastG = g;
    const vo = nv(c.v, out) - nv(c.v, vee);
    // I_into(out) = g(vn − vp)·(v_out − v_vee)
    const nodes = [out, vee, n, p];
    const coefs = [g, -g, dg * vo, -dg * vo];
    const i0 = g * vo;
    const lin = g * nv(c.v, out) - g * nv(c.v, vee) + dg * vo * nv(c.v, n) - dg * vo * nv(c.v, p);
    stampRow(c, out, nodes, coefs, i0 - lin);
    stampRow(c, vee, nodes, coefs.map((x) => -x), -(i0 - lin));
  }
  converged(v: Float64Array) {
    return Math.abs(this.g(v).g - this.lastG) < 1e-7 + 1e-3 * this.lastG;
  }
  currents(v: Float64Array) {
    const [, , out, vee] = this.nodes;
    const i = this.g(v).g * (nv(v, out) - nv(v, vee));
    return [0, 0, i, -i];
  }
}

// ---------------------------------------------------------------- inductors

export class Inductor extends Prim {
  iPrev = 0;
  lastI = 0;
  constructor(a: number, b: number, public l: number, initial = 0) {
    super([a, b]);
    this.iPrev = initial;
  }
  stamp(c: StampCtx) {
    const g = c.h / this.l;
    addG(c, this.nodes[0], this.nodes[1], g);
    addI(c, this.nodes[0], this.nodes[1], this.iPrev);
  }
  accept(v: Float64Array, h: number) {
    this.lastI = (h / this.l) * (nv(v, this.nodes[0]) - nv(v, this.nodes[1])) + this.iPrev;
    this.iPrev = this.lastI;
  }
  currents() {
    return [this.lastI, -this.lastI];
  }
}

/** Two coupled inductors (transformer). Nodes: [p1, p2, s1, s2]. */
export class Transformer extends Prim {
  i1 = 0;
  i2 = 0;
  constructor(p1: number, p2: number, s1: number, s2: number, public l1: number, public l2: number, public k = 0.995) {
    super([p1, p2, s1, s2]);
  }
  private admittance(h: number) {
    const m = this.k * Math.sqrt(this.l1 * this.l2);
    const det = this.l1 * this.l2 - m * m;
    return [(h * this.l2) / det, (-h * m) / det, (-h * m) / det, (h * this.l1) / det];
  }
  stamp(c: StampCtx) {
    const [p1, p2, s1, s2] = this.nodes;
    const [a11, a12, a21, a22] = this.admittance(c.h);
    const nodes = [p1, p2, s1, s2];
    // i1 = a11·v1 + a12·v2 + i1prev (into p1, out of p2), i2 likewise on the secondary
    const r1 = [a11, -a11, a12, -a12];
    const r2 = [a21, -a21, a22, -a22];
    stampRow(c, p1, nodes, r1, this.i1);
    stampRow(c, p2, nodes, r1.map((x) => -x), -this.i1);
    stampRow(c, s1, nodes, r2, this.i2);
    stampRow(c, s2, nodes, r2.map((x) => -x), -this.i2);
  }
  accept(v: Float64Array, h: number) {
    const [p1, p2, s1, s2] = this.nodes;
    const [a11, a12, a21, a22] = this.admittance(h);
    const v1 = nv(v, p1) - nv(v, p2), v2 = nv(v, s1) - nv(v, s2);
    this.i1 = a11 * v1 + a12 * v2 + this.i1;
    this.i2 = a21 * v1 + a22 * v2 + this.i2;
  }
  currents() {
    return [this.i1, -this.i1, this.i2, -this.i2];
  }
}
