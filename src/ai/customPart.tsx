import type { ReactNode } from 'react';
import type { ComponentDef, PinDef, PropField } from '../components/types';
import type { CustomPartSpec, PartShape } from './spec';
import { compileExpr, type Compiled, type ExprScope } from './expr';
import { BehaviouralCurrent, BehaviouralResistor, BehaviouralSource, Bjt, Capacitor, Comparator, Diode, Inductor, Mosfet, OpAmp, Resistor, Source, Transformer, type Prim } from '../sim/solver';
import type { SimBuilder, SimWarning } from '../sim/builder';
import type { ComponentInstance } from '../model/types';
import { PinTip, SLine, SText, clamp01, formatSI, ledParams } from '../components/util';

function Shape({ s, glow }: { s: PartShape; glow?: string }): ReactNode {
  const common = {
    fill: glow ?? s.fill ?? (s.type === 'line' || s.type === 'polyline' ? 'none' : '#888'),
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    opacity: s.opacity,
  };
  switch (s.type) {
    case 'rect':
      return <rect x={s.x ?? 0} y={s.y ?? 0} width={s.w ?? 0} height={s.h ?? 0} rx={s.rx} {...common} />;
    case 'circle':
      return <circle cx={s.cx ?? 0} cy={s.cy ?? 0} r={s.r ?? 0} {...common} />;
    case 'ellipse':
      return <ellipse cx={s.cx ?? 0} cy={s.cy ?? 0} rx={s.rx ?? s.r ?? 0} ry={s.ry ?? s.r ?? 0} {...common} />;
    case 'line':
      return <line x1={s.x1 ?? 0} y1={s.y1 ?? 0} x2={s.x2 ?? 0} y2={s.y2 ?? 0} {...common} stroke={s.stroke ?? '#333'} strokeLinecap="round" />;
    case 'polyline': {
      const pts: string[] = [];
      for (let i = 0; i + 1 < (s.points ?? []).length; i += 2) pts.push(`${s.points![i]},${s.points![i + 1]}`);
      return <polyline points={pts.join(' ')} {...common} stroke={s.stroke ?? '#333'} strokeLinejoin="round" strokeLinecap="round" />;
    }
    case 'path':
      return <path d={s.d} {...common} />;
    case 'text':
      return (
        <text x={s.x ?? 0} y={s.y ?? 0} fontSize={s.size ?? 6} textAnchor={s.anchor ?? 'middle'} fill={s.fill ?? '#222'} opacity={s.opacity} fontFamily="Inter, system-ui, sans-serif" fontWeight={600} style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {s.text}
        </text>
      );
  }
}

function shapeBox(s: PartShape): [number, number, number, number] | null {
  switch (s.type) {
    case 'rect': return [s.x ?? 0, s.y ?? 0, (s.x ?? 0) + (s.w ?? 0), (s.y ?? 0) + (s.h ?? 0)];
    case 'circle': case 'ellipse': {
      const rx = s.rx ?? s.r ?? 0, ry = s.ry ?? s.r ?? 0;
      return [(s.cx ?? 0) - rx, (s.cy ?? 0) - ry, (s.cx ?? 0) + rx, (s.cy ?? 0) + ry];
    }
    case 'line': return [Math.min(s.x1 ?? 0, s.x2 ?? 0), Math.min(s.y1 ?? 0, s.y2 ?? 0), Math.max(s.x1 ?? 0, s.x2 ?? 0), Math.max(s.y1 ?? 0, s.y2 ?? 0)];
    case 'polyline': {
      const p = s.points ?? [];
      if (p.length < 2) return null;
      const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case 'text': return [(s.x ?? 0) - 10, (s.y ?? 0) - (s.size ?? 6), (s.x ?? 0) + 10, s.y ?? 0];
    case 'path': {
      const nums = (s.d ?? '').match(/-?\d*\.?\d+(e[-+]?\d+)?/gi)?.map(Number) ?? [];
      if (nums.length < 2) return null;
      const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
}

const DIODES = {
  silicon: { is: 2.52e-9, n: 1.752 },
  schottky: { is: 3e-6, n: 1.05 },
  power: { is: 14.1e-9, n: 1.984 },
};

/** Build a ComponentDef from a validated spec. */
/**
 * TypeScript behaviour attached to a built-in spec part: devices that libraries talk to
 * (register them in `setup`), values the spec's formulas can use (`vars`), and an overlay
 * drawn over the part (display contents, terminal text).
 */
export interface PartExt {
  /** names usable in the spec's formulas, supplied by the hooks' values() */
  vars?: string[];
  setup?(b: SimBuilder, comp: ComponentInstance): ExtHooks;
  overlay?(a: { props: Record<string, any>; sim?: Record<string, any> }): ReactNode;
  /** extra inspector fields (e.g. a send box) */
  fields?: PropField[];
  defaultProps?: Record<string, any>;
}
export interface ExtHooks {
  values?(): Record<string, number>;
  afterStep?(t: number, h: number): void;
  frame?(): Record<string, any> | undefined;
  warnings?(): SimWarning[];
}

export function defFromSpec(spec: CustomPartSpec, ext?: PartExt): ComponentDef {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of spec.shapes) {
    const b = shapeBox(s);
    if (!b) continue;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  for (const p of spec.pins) {
    x0 = Math.min(x0, p.x - 3); y0 = Math.min(y0, p.y - 3); x1 = Math.max(x1, p.x + 3); y1 = Math.max(y1, p.y + 3);
  }
  const bounds = { x: x0, y: y0, w: Math.max(10, x1 - x0), h: Math.max(10, y1 - y0) };
  const pins: PinDef[] = spec.pins.map((p) => ({ id: p.id, x: p.x, y: p.y, label: p.label, kind: p.kind }));
  const fields: PropField[] = spec.props.map((p) =>
    p.type === 'slider'
      ? { key: p.key, label: p.label, kind: 'slider', min: p.min ?? 0, max: p.max ?? 1, step: p.step ?? 0.01, unit: p.unit, live: true }
      : p.type === 'select'
        ? { key: p.key, label: p.label, kind: 'select', options: p.options ?? [], live: true }
        : { key: p.key, label: p.label, kind: 'number', unit: p.unit, min: p.min, max: p.max, si: true, live: true },
  );
  if (ext?.fields) fields.push(...ext.fields);
  const defaultProps = { ...Object.fromEntries(spec.props.map((p) => [p.key, p.default])), ...(ext?.defaultProps ?? {}) };
  const ai = spec.origin !== 'builtin';

  const autoSymbol = () => {
    const xs = spec.pins.map((p) => p.x), ys = spec.pins.map((p) => p.y);
    const bx = Math.min(...xs) - 5, by = Math.min(...ys) - 25, bw = Math.max(...xs) - Math.min(...xs) + 10;
    return (
      <g>
        <rect x={bx} y={by} width={Math.max(bw, 30)} height={18} rx={2} fill="#fff" stroke="#1f3a5f" strokeWidth={1.3} />
        <SText x={bx + Math.max(bw, 30) / 2} y={by + 11} size={5}>{spec.name.slice(0, 18)}</SText>
        {spec.pins.map((p) => <SLine key={p.id} pts={[[p.x, p.y], [p.x, by + 18]]} />)}
      </g>
    );
  };

  return {
    type: spec.type,
    name: spec.name,
    category: spec.category,
    description: ai ? `${spec.description}${spec.description ? '\n\n' : ''}✨ Generated by AI — check the behaviour before relying on it.` : spec.description,
    keywords: ai ? ['ai', 'custom', ...(spec.prompt ? spec.prompt.split(/\s+/).slice(0, 8) : [])] : spec.keywords,
    bounds,
    pins: () => pins,
    internalConnections: spec.connections ? () => spec.connections! : undefined,
    defaultProps,
    fields,
    interactive: spec.interactive ?? (spec.toggle ? 'toggle' : spec.drag ? 'drag' : undefined),
    toggleKey: spec.toggle,
    dragKey: spec.drag,
    summary: () => (ai ? '✨ AI-generated part' : spec.summary ?? ''),
    render: ({ sim, comp }) => (
      <g>
        {spec.shapes.map((s, i) => <Shape key={i} s={s} />)}
        {(spec.animations ?? []).map((a, i) => {
          const st = (sim?.anims?.[i] as [number, number, number] | undefined) ?? [0, 0, 0];
          return (
            <g key={`an${i}`} transform={`translate(${st[1]} ${st[2]}) rotate(${st[0]} ${a.cx ?? 0} ${a.cy ?? 0})`}>
              <Shape s={a.shape} />
            </g>
          );
        })}
        {(spec.indicators ?? []).map((ind, i) => {
          const lv = (sim?.levels?.[i] as number) ?? 0;
          if (lv < 0.02) return null;
          return (
            <g key={`ind${i}`} opacity={lv} style={{ pointerEvents: 'none' }}>
              <g style={{ filter: `drop-shadow(0 0 ${2 + 4 * lv}px ${ind.color})` }}>
                <Shape s={ind.shape} glow={ind.color} />
              </g>
            </g>
          );
        })}
        {sim &&
          (spec.readouts ?? []).map((r, i) => (
            <text key={`ro${i}`} x={r.x} y={r.y} fontSize={r.size ?? 6} textAnchor="middle" fill={r.color ?? '#1d2c3a'} fontFamily="'JetBrains Mono', monospace" fontWeight={700} style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {`${r.label ? `${r.label} ` : ''}${formatSI(Number(sim.readouts?.[i] ?? 0), r.unit ?? '', 3)}`}
            </text>
          ))}
        {ext?.overlay?.({ props: comp.props, sim })}
        {spec.pins.map((p) => <PinTip key={p.id} x={p.x} y={p.y} />)}
      </g>
    ),
    schematic: () => (spec.symbol ? <g>{spec.symbol.map((s, i) => <Shape key={i} s={{ ...s, fill: s.fill === 'none' || s.type === 'text' ? s.fill : s.fill ? '#fff' : undefined, stroke: s.type === 'text' ? undefined : '#1f3a5f' }} />)}</g> : autoSymbol()),
    build: (b, comp) => {
      const hooks: ExtHooks = ext?.setup?.(b, comp) ?? {};
      let extVals: Record<string, number> = hooks.values?.() ?? {};
      const pinIds = new Set(spec.pins.map((p) => p.id));
      const internal = new Map((spec.model.nodes ?? []).map((n) => [n, b.internal()]));
      const term = (name: string): string | number => (pinIds.has(name) ? name : internal.get(name)!);
      const nodeIdx = new Map<string, number>();
      for (const id of pinIds) nodeIdx.set(id, b.node(id));
      for (const [n, idx] of internal) nodeIdx.set(n, idx);
      const prims = new Map<string, Prim>();
      // state machines keep their values across circuit rebuilds
      const stateVals: Record<string, number> = (b.state.vars ??= {});
      /** element currents from the last accepted step (formulas see them one step late, which keeps feedback stable) */
      const lastI = new Map<string, number>();
      /** rising-edge counters for pins not driven by a board (counted from the voltage, TTL-style thresholds) */
      const edgeCounters = new Map<string, { n: number; high: boolean }>();
      const gndPin = nodeIdx.has('GND') ? 'GND' : null;
      let now = 0;
      let cur: Float64Array = b.v;
      const scope: ExprScope = {
        v: (n) => {
          const i = nodeIdx.get(n);
          return i === undefined || i >= cur.length ? 0 : cur[i];
        },
        i: (id) => lastI.get(id) ?? 0,
        t: () => now,
        dt: () => stepH,
        freq: (pin) => b.signalFrequency(pin),
        servo: (pin) => b.signalInfo(pin)?.servoUs ?? 0,
        edges: (pin) => {
          const n = b.pinEdges(pin);
          if (n !== null) return n;
          let c = edgeCounters.get(pin);
          if (!c) {
            const fresh: { n: number; high: boolean } = (b.state[`edge_${pin}`] ??= { n: 0, high: false });
            edgeCounters.set(pin, fresh);
            c = fresh;
          }
          return c.n;
        },
        prop: (k) => {
          if (k in extVals) return extVals[k];
          if (k === 'pressed') return b.input.pressed ? 1 : 0;
          if (k in stateVals) return stateVals[k];
          return Number(comp.props[k] ?? defaultProps[k] ?? 0);
        },
      };
      let stepH = 1e-3;
      const stateNames = (spec.states ?? []).map((x) => x.name);
      const names = {
        nodes: new Set(nodeIdx.keys()),
        elements: new Set(spec.model.elements.map((e) => e.id)),
        props: new Set([...Object.keys(defaultProps), ...stateNames, 'pressed', ...(ext?.vars ?? [])]),
        pins: pinIds,
      };
      const compile = (src: string | number): Compiled => compileExpr(src, names);
      const at = (fn: Compiled) => (v: Float64Array) => {
        cur = v;
        return fn(scope);
      };
      const constant = (src: string | number) => {
        if (typeof src === 'number') return src;
        const s = src.trim();
        return /^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(s) ? Number(s) : null;
      };
      const caps: { id: string; cap: Capacitor }[] = [];
      const inductors: { id: string; ind: Inductor }[] = [];
      for (const el of spec.model.elements) {
        let p: Prim;
        switch (el.kind) {
          case 'resistor': {
            const c = constant(el.value);
            p = c !== null ? b.add(new Resistor(b.node(term(el.a)), b.node(term(el.b)), Math.max(1e-3, c)), [term(el.a), term(el.b)]) : b.add(new BehaviouralResistor(b.node(term(el.a)), b.node(term(el.b)), at(compile(el.value))), [term(el.a), term(el.b)]);
            break;
          }
          case 'rvar':
            p = b.add(new BehaviouralResistor(b.node(term(el.a)), b.node(term(el.b)), at(compile(el.value))), [term(el.a), term(el.b)]);
            break;
          case 'capacitor': {
            const farads = Math.max(1e-15, compile(el.value)(scope));
            const cap = new Capacitor(b.node(term(el.a)), b.node(term(el.b)), farads, b.state[`cap_${el.id}`] ?? 0);
            p = b.add(cap, [term(el.a), term(el.b)]);
            caps.push({ id: el.id, cap });
            break;
          }
          case 'diode': {
            const val = (x: string | number | undefined, d: number) => (x === undefined ? d : compile(x)(scope));
            const params =
              el.model === 'led' ? ledParams(val(el.vf, 2)) : el.model === 'zener' ? { ...DIODES.silicon, bv: val(el.vz, 5.1) } : DIODES[el.model ?? 'silicon'] ?? DIODES.silicon;
            p = b.add(new Diode(b.node(term(el.a)), b.node(term(el.k)), params), [term(el.a), term(el.k)]);
            break;
          }
          case 'npn':
          case 'pnp':
            p = b.add(new Bjt(b.node(term(el.c)), b.node(term(el.b)), b.node(term(el.e)), { pnp: el.kind === 'pnp', is: 1e-14, bf: el.beta ?? 150, br: 3 }), [term(el.c), term(el.b), term(el.e)]);
            break;
          case 'vsource': {
            const c = constant(el.value);
            p = c !== null ? b.add(new Source(b.node(term(el.p)), b.node(term(el.n)), c, el.r ?? 0.05), [term(el.p), term(el.n)]) : b.add(new BehaviouralSource(b.node(term(el.p)), b.node(term(el.n)), at(compile(el.value)), el.r ?? 0.05), [term(el.p), term(el.n)]);
            break;
          }
          case 'isource':
            p = b.add(new BehaviouralCurrent(b.node(term(el.p)), b.node(term(el.n)), at(compile(el.value))), [term(el.p), term(el.n)]);
            break;
          case 'nmos':
          case 'pmos':
            p = b.add(new Mosfet(b.node(term(el.d)), b.node(term(el.g)), b.node(term(el.s)), { pmos: el.kind === 'pmos', vth: el.vth === undefined ? 2 : compile(el.vth)(scope), k: el.k === undefined ? 1 : compile(el.k)(scope) }), [term(el.d), term(el.g), term(el.s)]);
            break;
          case 'opamp': {
            const ts = [term(el.p), term(el.n), term(el.out), term(el.vcc), term(el.vee)];
            const drop = el.railToRail ? 0.05 : 1.5;
            p = b.add(new OpAmp(b.node(ts[0]), b.node(ts[1]), b.node(ts[2]), b.node(ts[3]), b.node(ts[4]), { gain: el.gain ?? 1e5, dropHigh: drop, dropLow: el.railToRail ? 0.05 : 0.02, rout: 50 }), ts);
            break;
          }
          case 'comparator': {
            const ts = [term(el.p), term(el.n), term(el.out), term(el.vee)];
            p = b.add(new Comparator(b.node(ts[0]), b.node(ts[1]), b.node(ts[2]), b.node(ts[3])), ts);
            break;
          }
          case 'inductor': {
            const henries = Math.max(1e-9, compile(el.value)(scope));
            const ind = new Inductor(b.node(term(el.a)), b.node(term(el.b)), henries, b.state[`ind_${el.id}`] ?? 0);
            p = b.add(ind, [term(el.a), term(el.b)]);
            inductors.push({ id: el.id, ind });
            break;
          }
          case 'transformer': {
            const ts = [term(el.p1), term(el.p2), term(el.s1), term(el.s2)];
            p = b.add(new Transformer(b.node(ts[0]), b.node(ts[1]), b.node(ts[2]), b.node(ts[3]), el.l1, el.l1 / Math.pow(Math.max(1e-3, compile(el.ratio)(scope)), 2), el.k ?? 0.995), ts);
            break;
          }
        }
        prims.set(el.id, p!);
      }
      // initialise state machines once (first build)
      const stateFns = (spec.states ?? []).map((st) => ({ name: st.name, next: compile(st.next), init: compile(st.init) }));
      for (const st of stateFns) if (!(st.name in stateVals)) stateVals[st.name] = st.init(scope);
      const anims = (spec.animations ?? []).map((a) => ({
        rotate: a.rotate !== undefined ? compile(a.rotate) : null,
        dx: a.dx !== undefined ? compile(a.dx) : null,
        dy: a.dy !== undefined ? compile(a.dy) : null,
      }));
      const sound = spec.sound !== undefined ? compile(spec.sound) : null;
      const levels = (spec.indicators ?? []).map((ind) => compile(ind.level));
      const readouts = (spec.readouts ?? []).map((r) => compile(r.value));
      const checks = (spec.warnings ?? []).map((w) => ({ ...w, fn: compile(w.when) }));
      const levelAvg = levels.map(() => ({ sum: 0, t: 0 }));
      let warn: SimWarning[] = [];
      return {
        beforeStep(t, h) {
          now = t;
          stepH = h;
          if (hooks.values) extVals = hooks.values();
        },
        maxStep: spec.maxStep ? () => spec.maxStep! : undefined,
        afterStep(v, h) {
          cur = v;
          stepH = h;
          for (const [id, p] of prims) lastI.set(id, p.currents(v)[0]);
          for (const [pin, c] of edgeCounters) {
            const x = scope.v(pin) - (gndPin ? scope.v(gndPin) : 0);
            if (!c.high && x > 2) {
              c.high = true;
              c.n++;
            } else if (c.high && x < 0.8) c.high = false;
          }
          for (const c of caps) b.state[`cap_${c.id}`] = c.cap.vPrev;
          for (const l of inductors) b.state[`ind_${l.id}`] = l.ind.iPrev;
          for (const st of stateFns) stateVals[st.name] = st.next(scope);
          levels.forEach((fn, i) => {
            levelAvg[i].sum += clamp01(fn(scope)) * h;
            levelAvg[i].t += h;
          });
          hooks.afterStep?.(now, h);
        },
        frame() {
          cur = b.v;
          const lv = levelAvg.map((a) => {
            const x = a.t > 0 ? a.sum / a.t : 0;
            a.sum = 0;
            a.t = 0;
            return x;
          });
          warn = checks.filter((c) => c.fn(scope)).map((c) => ({ level: c.level, message: c.message }));
          return {
            levels: lv,
            readouts: readouts.map((fn) => fn(scope)),
            anims: anims.map((a) => [a.rotate?.(scope) ?? 0, a.dx?.(scope) ?? 0, a.dy?.(scope) ?? 0]),
            freq: sound ? sound(scope) : undefined,
            vars: stateNames.length ? { ...stateVals } : undefined,
            ...(hooks.frame?.() ?? {}),
          };
        },
        warnings: () => (hooks.warnings ? [...warn, ...hooks.warnings()] : warn),
      };
    },
  };
}
