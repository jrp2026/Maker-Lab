/**
 * Declarative description of an AI-generated part. It is pure data — geometry,
 * colours and formulas — validated strictly before use, so a spec coming from a
 * model (or a shared link) can't run code or inject markup.
 */
import { compileExpr } from './expr';
import type { CategoryId } from '../components/types';

export interface PartShape {
  type: 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'path' | 'text';
  x?: number; y?: number; w?: number; h?: number; rx?: number;
  cx?: number; cy?: number; r?: number; ry?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  points?: number[];
  d?: string;
  text?: string;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface PartPin {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: 'lead' | 'terminal';
}

export interface PartProp {
  key: string;
  label: string;
  type: 'number' | 'slider' | 'select';
  default: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; label: string }[];
}

export type PartElement =
  | { id: string; kind: 'resistor' | 'capacitor'; a: string; b: string; value: string | number }
  | { id: string; kind: 'rvar'; a: string; b: string; value: string | number }
  | { id: string; kind: 'diode'; a: string; k: string; model?: 'silicon' | 'schottky' | 'power' | 'led' | 'zener'; vz?: string | number; vf?: string | number }
  | { id: string; kind: 'npn' | 'pnp'; c: string; b: string; e: string; beta?: number }
  | { id: string; kind: 'vsource'; p: string; n: string; value: string | number; r?: number }
  | { id: string; kind: 'isource'; p: string; n: string; value: string | number }
  | { id: string; kind: 'nmos' | 'pmos'; d: string; g: string; s: string; vth?: string | number; k?: string | number }
  | { id: string; kind: 'opamp'; p: string; n: string; out: string; vcc: string; vee: string; gain?: number; railToRail?: boolean }
  | { id: string; kind: 'comparator'; p: string; n: string; out: string; vee: string }
  | { id: string; kind: 'inductor'; a: string; b: string; value: string | number }
  | { id: string; kind: 'transformer'; p1: string; p2: string; s1: string; s2: string; l1: number; ratio: string | number; k?: number };

export interface PartState {
  name: string;
  init: string | number;
  /** new value, evaluated after every simulation step (states update in order) */
  next: string;
}

export interface PartAnimation {
  shape: PartShape;
  /** rotation in degrees about (cx, cy) */
  rotate?: string;
  cx?: number;
  cy?: number;
  dx?: string;
  dy?: string;
}

export interface PartIndicator {
  shape: PartShape;
  color: string;
  /** 0..1 */
  level: string;
}

export interface PartReadout {
  label?: string;
  value: string;
  unit?: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
}

export interface PartWarning {
  when: string;
  level: 'warn' | 'error';
  message: string;
}

export interface CustomPartSpec {
  version: 1;
  type: string;
  name: string;
  description: string;
  category: CategoryId;
  pins: PartPin[];
  props: PartProp[];
  shapes: PartShape[];
  symbol?: PartShape[];
  indicators?: PartIndicator[];
  readouts?: PartReadout[];
  warnings?: PartWarning[];
  /** 'press': hold on the canvas while simulating; `pressed` (0/1) is usable in formulas */
  interactive?: 'press';
  /** click while simulating flips this 0/1 prop */
  toggle?: string;
  /** drag up/down while simulating adjusts this slider prop */
  drag?: string;
  model: { nodes?: string[]; elements: PartElement[] };
  states?: PartState[];
  animations?: PartAnimation[];
  /** tone frequency (Hz) the part emits while the formula is non-zero */
  sound?: string;
  /** groups of pins joined inside the part (e.g. both legs of a header, strips of a stripboard) */
  connections?: string[][];
  /** largest simulation step this part tolerates (s) */
  maxStep?: number;
  /** built-in parts are authored by hand; AI parts get a disclaimer */
  origin?: 'ai' | 'builtin';
  /** short text shown under the name in the inspector */
  summary?: string;
  keywords?: string[];
  /** the request that produced it */
  prompt?: string;
}

const CATEGORIES: CategoryId[] = ['passive', 'diodes', 'transistors', 'switches', 'power', 'output', 'instruments', 'mcu', 'boards'];
const RESERVED = new Set(['t', 'dt', 'v', 'i', 'pi', 'PI', 'pressed', 'true', 'false', 'freq']);
const COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]{1,3000}$/;
const PIN_ID = /^[A-Za-z0-9_+\-]{1,10}$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,19}$/;

export class SpecError extends Error {
  constructor(public problems: string[]) {
    super(problems.join('\n'));
  }
}

const num = (x: unknown, lo = -600, hi = 600): number | undefined => {
  const n = Number(x);
  if (x === undefined || x === null || x === '' || !Number.isFinite(n)) return undefined;
  return Math.max(lo, Math.min(hi, n));
};
const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : undefined);
const color = (x: unknown) => (typeof x === 'string' && COLOR.test(x.trim()) ? x.trim() : undefined);

function cleanShape(raw: any, problems: string[], where: string): PartShape | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type;
  if (!['rect', 'circle', 'ellipse', 'line', 'polyline', 'path', 'text'].includes(type)) {
    problems.push(`${where}: unknown shape type '${type}'`);
    return null;
  }
  const s: PartShape = { type };
  for (const k of ['x', 'y', 'w', 'h', 'rx', 'cx', 'cy', 'r', 'ry', 'x1', 'y1', 'x2', 'y2'] as const) {
    const v = num(raw[k]);
    if (v !== undefined) s[k] = v;
  }
  if (s.w !== undefined) s.w = Math.max(0, s.w);
  if (s.h !== undefined) s.h = Math.max(0, s.h);
  if (s.r !== undefined) s.r = Math.max(0, s.r);
  if (type === 'polyline' && Array.isArray(raw.points)) s.points = raw.points.slice(0, 200).map((p: unknown) => num(p) ?? 0);
  if (type === 'path') {
    const d = str(raw.d, 3000);
    if (!d || !PATH_D.test(d)) {
      problems.push(`${where}: path 'd' must only contain SVG path commands and numbers`);
      return null;
    }
    s.d = d;
  }
  if (type === 'text') {
    s.text = str(raw.text, 40) ?? '';
    s.size = num(raw.size, 2, 40) ?? 6;
    if (['start', 'middle', 'end'].includes(raw.anchor)) s.anchor = raw.anchor;
  }
  const fill = color(raw.fill), stroke = color(raw.stroke);
  if (raw.fill === 'none') s.fill = 'none';
  else if (fill) s.fill = fill;
  if (raw.stroke === 'none') s.stroke = 'none';
  else if (stroke) s.stroke = stroke;
  const sw = num(raw.strokeWidth, 0, 20);
  if (sw !== undefined) s.strokeWidth = sw;
  const op = num(raw.opacity, 0, 1);
  if (op !== undefined) s.opacity = op;
  return s;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'part';
}

/**
 * Validate & normalise untrusted JSON into a part spec. Throws SpecError listing every
 * problem (the list is fed back to the model for a repair round).
 */
export function validateSpec(raw: any, opts: { keepType?: boolean; builtin?: boolean } = {}): CustomPartSpec {
  const big = !!opts.builtin;
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object') throw new SpecError(['the answer is not a JSON object']);
  const name = str(raw.name, 48)?.trim();
  if (!name) problems.push('missing "name"');
  const description = str(raw.description, 600) ?? '';
  const category: CategoryId = CATEGORIES.includes(raw.category) ? raw.category : 'passive';

  // pins
  const pins: PartPin[] = [];
  const pinIds = new Set<string>();
  if (!Array.isArray(raw.pins) || !raw.pins.length) problems.push('"pins" must be a non-empty array');
  for (const [n, p] of (Array.isArray(raw.pins) ? raw.pins : []).slice(0, big ? 120 : 40).entries()) {
    const id = String(p?.id ?? '');
    if (!PIN_ID.test(id)) problems.push(`pin ${n}: id '${id}' must be 1–10 letters/digits/_+-`);
    else if (pinIds.has(id)) problems.push(`pin id '${id}' is used twice`);
    const x = num(p?.x), y = num(p?.y);
    if (x === undefined || y === undefined) problems.push(`pin '${id}': x and y are required numbers`);
    pinIds.add(id);
    pins.push({ id, x: Math.round((x ?? 0) / 10) * 10, y: Math.round((y ?? 0) / 10) * 10, label: str(p?.label, 40) ?? id, kind: p?.kind === 'terminal' ? 'terminal' : 'lead' });
  }
  const seenPos = new Set<string>();
  for (const p of pins) {
    const k = `${p.x},${p.y}`;
    if (seenPos.has(k)) problems.push(`two pins share the position (${p.x}, ${p.y}); pins must be at distinct multiples of 10`);
    seenPos.add(k);
  }

  // props
  const props: PartProp[] = [];
  for (const [n, p] of (Array.isArray(raw.props) ? raw.props : []).slice(0, big ? 20 : 8).entries()) {
    const key = String(p?.key ?? '');
    if (!NAME.test(key) || RESERVED.has(key)) {
      problems.push(`prop ${n}: key '${key}' must be a simple identifier (not t, v, i, pressed)`);
      continue;
    }
    const type = ['number', 'slider', 'select'].includes(p?.type) ? p.type : 'number';
    const prop: PartProp = { key, label: str(p?.label, 32) ?? key, type, default: num(p?.default, -1e9, 1e9) ?? 0 };
    const unit = str(p?.unit, 6);
    if (unit) prop.unit = unit;
    for (const k of ['min', 'max', 'step'] as const) {
      const v = num(p?.[k], -1e9, 1e9);
      if (v !== undefined) prop[k] = v;
    }
    if (type === 'slider') {
      prop.min ??= 0;
      prop.max ??= 1;
      prop.step ??= (prop.max - prop.min) / 100;
    }
    if (type === 'select') {
      prop.options = (Array.isArray(p?.options) ? p.options : []).slice(0, 12).map((o: any) => ({ value: num(o?.value, -1e9, 1e9) ?? 0, label: str(o?.label, 24) ?? String(o?.value) }));
      if (!prop.options!.length) problems.push(`prop '${key}': select needs options`);
    }
    props.push(prop);
  }
  const propKeys = new Set(props.map((p) => p.key));
  // state machines
  const states: PartState[] = [];
  for (const [n, st] of (Array.isArray(raw.states) ? raw.states : []).slice(0, big ? 96 : 24).entries()) {
    const name = String(st?.name ?? '');
    if (!NAME.test(name) || RESERVED.has(name) || propKeys.has(name) || states.some((x) => x.name === name)) {
      problems.push(`state ${n}: name '${name}' must be a new identifier`);
      continue;
    }
    states.push({ name, init: typeof st.init === 'number' ? st.init : String(st.init ?? '0'), next: String(st.next ?? name) });
  }
  const varKeys = new Set([...propKeys, ...states.map((x) => x.name)]);

  // model
  const nodes: string[] = [];
  for (const nm of (Array.isArray(raw.model?.nodes) ? raw.model.nodes : []).slice(0, big ? 200 : 30)) {
    const s = String(nm);
    if (!NAME.test(s) || pinIds.has(s) || RESERVED.has(s)) problems.push(`node '${s}' must be a new identifier (not a pin id)`);
    else nodes.push(s);
  }
  const nodeSet = new Set([...pins.map((p) => p.id), ...nodes]);
  const elements: PartElement[] = [];
  const deferredChecks: [string, string][] = [];
  /** numeric parameter that may also be a formula of props (evaluated when the circuit is built) */
  const exprOrNum = (x: unknown, lo: number, hi: number, where: string): string | number | undefined => {
    if (typeof x === 'number') return num(x, lo, hi);
    const s = str(x, 200);
    if (s === undefined || s === '') return undefined;
    deferredChecks.push([s, where]);
    return s;
  };
  const elemIds = new Set<string>();
  const rawEls = Array.isArray(raw.model?.elements) ? raw.model.elements.slice(0, big ? 400 : 60) : [];
  if (!rawEls.length) problems.push('"model.elements" must list at least one electrical element');
  const needNode = (el: any, key: string, where: string) => {
    const n = String(el?.[key] ?? '');
    if (!nodeSet.has(n)) problems.push(`${where}: '${key}' = '${n}' is not a pin id or declared node`);
    return n;
  };
  const pinSet = new Set(pins.map((p) => p.id));
  const exprNames = () => ({ nodes: nodeSet, elements: elemIds, props: new Set([...varKeys, 'pressed']), pins: pinSet });
  for (const [n, el] of rawEls.entries()) {
    const id = String(el?.id ?? `E${n + 1}`);
    const where = `element '${id}'`;
    if (!NAME.test(id)) problems.push(`${where}: id must be an identifier`);
    if (elemIds.has(id)) problems.push(`${where}: duplicate id`);
    elemIds.add(id);
    const kind = el?.kind;
    const value = typeof el?.value === 'number' ? el.value : str(el?.value, 400);
    switch (kind) {
      case 'resistor':
      case 'capacitor':
      case 'rvar':
        if (value === undefined || value === '') problems.push(`${where}: needs a value`);
        elements.push({ id, kind, a: needNode(el, 'a', where), b: needNode(el, 'b', where), value: value ?? 1 });
        break;
      case 'diode': {
        const model = ['silicon', 'schottky', 'power', 'led', 'zener'].includes(el.model) ? el.model : 'silicon';
        const d: PartElement = { id, kind, a: needNode(el, 'a', where), k: needNode(el, 'k', where), model };
        const vz = exprOrNum(el.vz, 0.5, 400, `${where} vz`), vf = exprOrNum(el.vf, 0.1, 5, `${where} vf`);
        if (vz !== undefined) d.vz = vz;
        if (vf !== undefined) d.vf = vf;
        if (model === 'zener' && vz === undefined) problems.push(`${where}: a zener needs "vz"`);
        elements.push(d);
        break;
      }
      case 'npn':
      case 'pnp':
        elements.push({ id, kind, c: needNode(el, 'c', where), b: needNode(el, 'b', where), e: needNode(el, 'e', where), beta: num(el.beta, 5, 2000) ?? 150 });
        break;
      case 'vsource':
        if (value === undefined || value === '') problems.push(`${where}: needs a value`);
        elements.push({ id, kind, p: needNode(el, 'p', where), n: needNode(el, 'n', where), value: value ?? 0, r: num(el.r, 1e-3, 1e7) ?? 0.05 });
        break;
      case 'isource':
        if (value === undefined || value === '') problems.push(`${where}: needs a value`);
        elements.push({ id, kind, p: needNode(el, 'p', where), n: needNode(el, 'n', where), value: value ?? 0 });
        break;
      case 'nmos':
      case 'pmos':
        elements.push({ id, kind, d: needNode(el, 'd', where), g: needNode(el, 'g', where), s: needNode(el, 's', where), vth: exprOrNum(el.vth, -20, 20, `${where} vth`) ?? 2, k: exprOrNum(el.k, 1e-6, 1000, `${where} k`) ?? 1 });
        break;
      case 'opamp':
        elements.push({ id, kind, p: needNode(el, 'p', where), n: needNode(el, 'n', where), out: needNode(el, 'out', where), vcc: needNode(el, 'vcc', where), vee: needNode(el, 'vee', where), gain: num(el.gain, 1, 1e7) ?? 1e5, railToRail: !!el.railToRail });
        break;
      case 'comparator':
        elements.push({ id, kind, p: needNode(el, 'p', where), n: needNode(el, 'n', where), out: needNode(el, 'out', where), vee: needNode(el, 'vee', where) });
        break;
      case 'inductor':
        if (value === undefined || value === '') problems.push(`${where}: needs a value (henries)`);
        elements.push({ id, kind, a: needNode(el, 'a', where), b: needNode(el, 'b', where), value: value ?? 1e-3 });
        break;
      case 'transformer':
        elements.push({ id, kind, p1: needNode(el, 'p1', where), p2: needNode(el, 'p2', where), s1: needNode(el, 's1', where), s2: needNode(el, 's2', where), l1: num(el.l1, 1e-6, 1000) ?? 1, ratio: typeof el.ratio === 'number' ? Math.max(1e-3, Math.min(1e3, el.ratio)) : (str(el.ratio, 200) ?? 1), k: num(el.k, 0.5, 0.9999) ?? 0.995 });
        if (typeof el.ratio === 'string') deferredChecks.push([el.ratio, `${where} ratio`]);
        break;
      default:
        problems.push(`${where}: unknown kind '${kind}' (use resistor, capacitor, rvar, inductor, transformer, diode, npn, pnp, nmos, pmos, opamp, comparator, vsource, isource)`);
    }
  }
  // formulas compile?
  const check = (src: unknown, where: string) => {
    if (typeof src === 'number') return;
    try {
      compileExpr(String(src), exprNames());
    } catch (e) {
      problems.push(`${where}: ${(e as Error).message}`);
    }
  };
  for (const el of elements) if ('value' in el) check(el.value, `element '${el.id}' value`);
  for (const [src, where] of deferredChecks) check(src, where);
  for (const st of states) {
    check(st.init, `state '${st.name}' init`);
    check(st.next, `state '${st.name}' next`);
  }
  const animations: PartAnimation[] = [];
  for (const [n, a] of (Array.isArray(raw.animations) ? raw.animations : []).slice(0, 40).entries()) {
    const sh = cleanShape(a?.shape, problems, `animation ${n}`);
    if (!sh) continue;
    const anim: PartAnimation = { shape: sh, cx: num(a.cx) ?? 0, cy: num(a.cy) ?? 0 };
    for (const k of ['rotate', 'dx', 'dy'] as const) {
      if (a[k] === undefined) continue;
      check(a[k], `animation ${n} ${k}`);
      anim[k] = String(a[k]);
    }
    animations.push(anim);
  }
  if (raw.sound !== undefined) check(raw.sound, 'sound');
  const connections: string[][] = [];
  for (const g of (Array.isArray(raw.connections) ? raw.connections : []).slice(0, 60)) {
    if (!Array.isArray(g)) continue;
    const ids = g.map(String).filter((x: string) => pinIds.has(x));
    if (ids.length >= 2) connections.push(ids);
  }
  const propOk = (k: unknown) => (typeof k === 'string' && propKeys.has(k) ? k : undefined);

  // art
  const shapes: PartShape[] = [];
  for (const [n, s] of (Array.isArray(raw.shapes) ? raw.shapes : []).slice(0, big ? 1200 : 200).entries()) {
    const c = cleanShape(s, problems, `shape ${n}`);
    if (c) shapes.push(c);
  }
  if (!shapes.length) problems.push('"shapes" must draw the part (at least one shape)');
  const symbol: PartShape[] = [];
  for (const [n, s] of (Array.isArray(raw.symbol) ? raw.symbol : []).slice(0, 120).entries()) {
    const c = cleanShape(s, problems, `symbol shape ${n}`);
    if (c) symbol.push(c);
  }
  const indicators: PartIndicator[] = [];
  for (const [n, ind] of (Array.isArray(raw.indicators) ? raw.indicators : []).slice(0, big ? 300 : 10).entries()) {
    const sh = cleanShape(ind?.shape, problems, `indicator ${n}`);
    if (!sh) continue;
    check(ind.level, `indicator ${n} level`);
    indicators.push({ shape: sh, color: color(ind.color) ?? '#ffd54a', level: String(ind.level ?? '0') });
  }
  const readouts: PartReadout[] = [];
  for (const [n, r] of (Array.isArray(raw.readouts) ? raw.readouts : []).slice(0, 12).entries()) {
    check(r?.value, `readout ${n}`);
    readouts.push({ label: str(r?.label, 12), value: String(r?.value ?? '0'), unit: str(r?.unit, 4), x: num(r?.x) ?? 0, y: num(r?.y) ?? 0, size: num(r?.size, 3, 20), color: color(r?.color) });
  }
  const warnings: PartWarning[] = [];
  for (const [n, w] of (Array.isArray(raw.warnings) ? raw.warnings : []).slice(0, 8).entries()) {
    check(w?.when, `warning ${n}`);
    warnings.push({ when: String(w?.when ?? '0'), level: w?.level === 'error' ? 'error' : 'warn', message: str(w?.message, 160) ?? 'Check this part' });
  }

  if (problems.length) throw new SpecError(problems);
  const type =
    opts.builtin && typeof raw.type === 'string'
      ? raw.type
      : opts.keepType && typeof raw.type === 'string' && /^ai-[a-z0-9-]{1,48}$/.test(raw.type)
        ? raw.type
        : `ai-${slug(name!)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    version: 1,
    type,
    name: name!,
    description,
    category,
    pins,
    props,
    shapes,
    symbol: symbol.length ? symbol : undefined,
    indicators: indicators.length ? indicators : undefined,
    readouts: readouts.length ? readouts : undefined,
    warnings: warnings.length ? warnings : undefined,
    interactive: raw.interactive === 'press' ? 'press' : undefined,
    toggle: propOk(raw.toggle),
    drag: propOk(raw.drag),
    model: { nodes, elements },
    states: states.length ? states : undefined,
    animations: animations.length ? animations : undefined,
    sound: raw.sound !== undefined ? String(raw.sound) : undefined,
    connections: connections.length ? connections : undefined,
    maxStep: num(raw.maxStep, 1e-6, 1e-3),
    origin: opts.builtin ? 'builtin' : 'ai',
    summary: str(raw.summary, 60),
    keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 20).map((k: unknown) => String(k).slice(0, 30)) : undefined,
    prompt: str(raw.prompt, 300),
  };
}

/** Pull the first JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  if (start < 0) throw new SpecError(['the reply contained no JSON object']);
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(body.slice(start, i + 1));
      } catch (e) {
        throw new SpecError([`the JSON is malformed: ${(e as Error).message}`]);
      }
    }
  }
  throw new SpecError(['the JSON object is incomplete (reply cut off?)']);
}
