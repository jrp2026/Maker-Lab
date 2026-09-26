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
    this.ctx = { G: new Float64Array(n * n), I: new Float64Array(n), n, v: this.v, h: 1e-3 };
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
