import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileExpr, parseExpr } from '../src/ai/expr';
import { extractJson, SpecError, validateSpec } from '../src/ai/spec';
import { EXAMPLE_7805, generatePart } from '../src/ai/prompt';
import { complete, listModels, type AiSettings } from '../src/ai/providers';
import { registerSpec } from '../src/ai/library';
import { Simulator } from '../src/sim/simulator';
import { getDef } from '../src/components/registry';
import type { CircuitDoc, ComponentInstance, Wire } from '../src/model/types';
import { parseDoc } from '../src/model/persistence';

const names = { nodes: new Set(['A', 'B']), elements: new Set(['R1']), props: new Set(['k']) };
const scope = { v: (n: string) => (n === 'A' ? 5 : 2), i: () => 0.01, t: () => 1, prop: () => 3 };

describe('expression language', () => {
  it('evaluates arithmetic, functions, v(), i() and props', () => {
    expect(compileExpr('min(k, max(0, v(A, B) - 1)) * 2 + i(R1) * 100', names)(scope)).toBe(5);
    expect(compileExpr('v(A) > 4 && !(k < 2) ? 2 ^ 3 : -1', names)(scope)).toBe(8);
    expect(compileExpr('clamp(t * 10, 0, 5)', names)(scope)).toBe(5);
  });
  it('rejects unknown names and code-like input', () => {
    expect(() => compileExpr('window.alert(1)', names)).toThrow();
    expect(() => compileExpr('v(C)', names)).toThrow(/pin or node/);
    expect(() => compileExpr('foo + 1', names)).toThrow(/unknown name/);
    expect(() => parseExpr('1 +')).toThrow();
  });
});

describe('part spec validation', () => {
  it('accepts the 7805 example and snaps pins to the grid', () => {
    const spec = validateSpec({ ...EXAMPLE_7805, pins: EXAMPLE_7805.pins.map((p) => ({ ...p, x: p.x + 2 })) });
    expect(spec.pins.map((p) => p.x)).toEqual([0, 10, 20]);
    expect(spec.type).toMatch(/^ai-7805-voltage-regulator-/);
  });
  it('strips unsafe markup and reports every problem', () => {
    const bad = {
      name: 'x',
      pins: [{ id: 'A', x: 0, y: 0 }, { id: 'A', x: 0, y: 0 }],
      shapes: [{ type: 'path', d: 'M0 0 L10 10"/><script>alert(1)</script>' }, { type: 'foreignObject' }, { type: 'rect', x: 0, y: 0, w: 5, h: 5, fill: 'url(javascript:alert(1))' }],
      model: { elements: [{ id: 'R1', kind: 'resistor', a: 'A', b: 'Z', value: 'evil()' }, { kind: 'flux_capacitor' }] },
    };
    try {
      validateSpec(bad);
      throw new Error('should fail');
    } catch (e) {
      const p = (e as SpecError).problems.join('\n');
      expect(p).toMatch(/used twice/);
      expect(p).toMatch(/path 'd'/);
      expect(p).toMatch(/unknown shape type/);
      expect(p).toMatch(/'Z' is not a pin/);
      expect(p).toMatch(/unknown function 'evil'/);
      expect(p).toMatch(/unknown kind 'flux_capacitor'/);
    }
    // a colour that isn't a plain colour is dropped rather than rendered
    const ok = validateSpec({ ...EXAMPLE_7805, shapes: [{ type: 'rect', x: 0, y: 0, w: 5, h: 5, fill: 'url(javascript:alert(1))' }] });
    expect(ok.shapes[0].fill).toBeUndefined();
  });
  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('Sure!\n```json\n{"a": {"b": "}"}}\n```')).toEqual({ a: { b: '}' } });
    expect(() => extractJson('{"a": 1')).toThrow(/incomplete/);
  });
});

const comp = (id: string, type: string, props: Record<string, any> = {}): ComponentInstance => ({ id, type, x: 0, y: 0, rot: 0, flip: false, props: { ...getDef(type)!.defaultProps, ...props } });
let wn = 0;
const w = (a: string, b: string): Wire => {
  const [ac, ap] = a.split('.');
  const [bc, bp] = b.split('.');
  return { id: `w${++wn}`, a: { comp: ac, pin: ap }, b: { comp: bc, pin: bp }, points: [], color: '#000' };
};

describe('AI part in the simulator', () => {
  const spec = validateSpec(EXAMPLE_7805);
  registerSpec(spec);
  const doc = (kind: string, load: number): CircuitDoc => ({
    version: 1, name: 't', customParts: [spec],
    components: [comp('bat', 'battery', { kind }), comp('reg', spec.type), comp('r', 'resistor', { resistance: load, power: 1 })],
    wires: [w('bat.+', 'reg.IN'), w('bat.-', 'reg.GND'), w('reg.OUT', 'r.1'), w('r.2', 'reg.GND')],
  });
  const run = (d: CircuitDoc) => {
    const sim = new Simulator(d);
    sim.start();
    let snap = sim.snapshot();
    for (let i = 0; i < 10; i++) {
      sim.advance(0.02);
      snap = sim.snapshot();
    }
    return snap;
  };
  it('regulates 9 V down to 5 V and draws the load current from its input', () => {
    const snap = run(doc('9V', 100));
    expect(snap.comps.r!.current).toBeCloseTo(0.05, 3); // 5 V / 100 Ω
    expect(Math.abs(snap.comps.bat!.current)).toBeCloseTo(0.05 + 0.009, 2);
    expect(snap.warnings.filter((x) => x.comp === 'reg')).toEqual([]);
  });
  it('drops out and warns when the input is too low', () => {
    const snap = run(doc('AA4', 100));
    expect(snap.comps.r!.current).toBeLessThan(0.045);
    expect(snap.warnings.some((x) => x.comp === 'reg' && /too low/.test(x.message))).toBe(true);
  });
  it('travels inside documents (share links / files) and re-registers', () => {
    const json = JSON.parse(JSON.stringify(doc('9V', 100)));
    const d = parseDoc(json);
    expect(d.customParts?.[0].type).toBe(spec.type);
    expect(d.components.some((c) => c.type === spec.type)).toBe(true);
  });
});

describe('providers', () => {
  afterEach(() => vi.unstubAllGlobals());
  const settings = (provider: AiSettings['provider']): AiSettings => ({ provider, models: {}, keys: { anthropic: 'k1', openai: 'k2', gemini: 'k3' }, baseUrls: {} });

  it.each([
    ['anthropic', 'https://api.anthropic.com/v1/messages', { content: [{ type: 'text', text: 'hi' }] }],
    ['openai', 'https://api.openai.com/v1/chat/completions', { choices: [{ message: { content: 'hi' } }] }],
    ['gemini', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', { candidates: [{ content: { parts: [{ text: 'hi' }] } }] }],
    ['ollama', 'http://localhost:11434/api/chat', { message: { content: 'hi' } }],
    ['lmstudio', 'http://localhost:1234/v1/chat/completions', { choices: [{ message: { content: 'hi' } }] }],
  ] as const)('%s: correct endpoint, auth and response parsing', async (provider, url, reply) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await complete(settings(provider), 'sys', [{ role: 'user', content: 'x' }])).toBe('hi');
    const [calledUrl, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(url);
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body));
    if (provider === 'anthropic') {
      expect(headers['x-api-key']).toBe('k1');
      expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
      expect(body.system).toBe('sys');
    }
    if (provider === 'openai') {
      expect(headers.authorization).toBe('Bearer k2');
      expect(body.response_format).toEqual({ type: 'json_object' });
    }
    if (provider === 'gemini') expect(headers['x-goog-api-key']).toBe('k3');
    if (provider === 'ollama') expect(body.format).toBe('json');
  });

  it('asks for a key before calling a cloud provider, and explains local connection failures', async () => {
    await expect(complete({ provider: 'openai', models: {}, keys: {}, baseUrls: {} }, 's', [])).rejects.toThrow(/API key/);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(complete(settings('ollama'), 's', [])).rejects.toThrow(/OLLAMA_ORIGINS/);
  });

  it('lists models (Gemini filters to generateContent models)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ models: [{ name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] }))));
    expect(await listModels(settings('gemini'))).toEqual(['gemini-x']);
  });

  it('generatePart repairs an invalid first answer', async () => {
    const replies = [
      JSON.stringify({ name: 'Broken', pins: [], shapes: [], model: { elements: [] } }),
      'Here you go:\n' + JSON.stringify(EXAMPLE_7805),
    ];
    const fetch = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: replies.shift() }] })));
    vi.stubGlobal('fetch', fetch);
    const statuses: string[] = [];
    const spec = await generatePart(settings('anthropic'), { request: '7805', onStatus: (s) => statuses.push(s) });
    expect(spec.name).toBe('7805 voltage regulator');
    expect(fetch).toHaveBeenCalledTimes(2);
    const second = JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(second.messages.at(-1).content).toMatch(/can't be used yet/);
    expect(statuses[1]).toMatch(/Fixing/);
  });
});
