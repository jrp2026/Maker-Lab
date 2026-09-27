/**
 * No-code logic examples built from the symbol gates, clickable logic inputs and logic probes.
 * Every circuit is laid out by `logic()`: inputs on the left, gates in stages, probes on the right,
 * one USB supply with a VCC bus along the top and a GND bus along the bottom.
 */
import type { CircuitDoc, ComponentInstance, Point, PropValue, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';

let n = 0;
const uid = (p: string) => `${p}${++n}`;

function place(type: string, pin: string, at: Point, props: Record<string, PropValue> = {}): ComponentInstance {
  const def = getDef(type)!;
  const comp: ComponentInstance = { id: uid(type.replace(/[^a-z0-9]/g, '').slice(0, 5)), type, x: 0, y: 0, rot: 0, flip: false, props: { ...def.defaultProps, ...props } };
  const p = def.pins(comp.props).find((x) => x.id === pin)!;
  const w = localToWorld(comp, def, p);
  comp.x = at.x - w.x;
  comp.y = at.y - w.y;
  return comp;
}

function pinAt(c: ComponentInstance, pin: string): Point {
  const def = getDef(c.type)!;
  return localToWorld(c, def, def.pins(c.props).find((p) => p.id === pin)!);
}

const RED = '#e53935', BLACK = '#212121', SIGNAL = ['#1e88e5', '#fb8c00', '#8e24aa', '#43a047', '#00897b', '#6d4c41'];

const wire = (a: ComponentInstance, ap: string, b: ComponentInstance, bp: string, color: string, points: Point[] = []): Wire => ({
  id: uid('w'), a: { comp: a.id, pin: ap }, b: { comp: b.id, pin: bp }, points, color,
});

interface LogicSpec {
  name: string;
  /** clickable inputs: [key, x, y of the OUT pin, initial value] */
  inputs: [string, number, number, number?][];
  /** gates: [key, type, x, y of the Y pin] */
  gates: [string, string, number, number][];
  /** probes: [key, x, y of the IN pin] */
  probes: [string, number, number][];
  /** signal links: [from key (an input or gate), to key, to pin] — the source pin is OUT / Y */
  links: [string, string, string][];
  /** feedback links routed around the gates: [from, to, pin, lane y] */
  feedback?: [string, string, string, number][];
  /** extra outputs driven by a gate: [key, type, pin driven, x, y of that pin] (their other pin goes to GND) */
  loads?: [string, string, string, string, number, number][];
}

/** Build a powered, wired logic circuit from a compact description. */
function logic(s: LogicSpec): CircuitDoc {
  const byKey = new Map<string, ComponentInstance>();
  const ys = [...s.inputs.map((i) => i[2]), ...s.gates.map((g) => g[3]), ...s.probes.map((p) => p[2])];
  const top = Math.min(...ys) - 70, bottom = Math.max(...ys) + 70;
  const p = place('usb-breakout', 'VBUS', { x: -120, y: top - 40 });
  const parts: ComponentInstance[] = [p];
  for (const [k, x, y, on] of s.inputs) byKey.set(k, place('logic-input', 'OUT', { x, y }, { on: on ?? 0 }));
  for (const [k, type, x, y] of s.gates) byKey.set(k, place(type, 'Y', { x, y }));
  for (const [k, x, y] of s.probes) byKey.set(k, place('logic-probe', 'IN', { x, y }));
  parts.push(...byKey.values());
  const wires: Wire[] = [];
  // power: every input, gate and probe hangs off the two buses
  for (const c of byKey.values()) {
    const v = pinAt(c, 'VCC'), g = pinAt(c, 'GND');
    wires.push(wire(p, 'VBUS', c, 'VCC', RED, [{ x: pinAt(p, 'VBUS').x, y: top }, { x: v.x, y: top }]));
    wires.push(wire(p, 'GND', c, 'GND', BLACK, [{ x: pinAt(p, 'GND').x, y: bottom }, { x: g.x, y: bottom }]));
  }
  const src = (k: string) => (byKey.get(k)!.type === 'logic-input' ? 'OUT' : 'Y');
  // signals: across to a bend just left of the target, then down / up into its pin
  const offset: Record<string, number> = { A: 14, B: 20, C: 26, IN: 14 };
  s.links.forEach(([from, to, pin], i) => {
    const a = byKey.get(from)!, b = byKey.get(to)!;
    const pa = pinAt(a, src(from)), pb = pinAt(b, pin);
    const mx = pb.x - (offset[pin] ?? 14);
    wires.push(wire(a, src(from), b, pin, SIGNAL[i % SIGNAL.length], pa.y === pb.y ? [] : [{ x: mx, y: pa.y }, { x: mx, y: pb.y }]));
  });
  // feedback: out to the right, along a lane, back in from the left
  for (const [from, to, pin, lane] of s.feedback ?? []) {
    const a = byKey.get(from)!, b = byKey.get(to)!;
    const pa = pinAt(a, src(from)), pb = pinAt(b, pin);
    wires.push(wire(a, src(from), b, pin, '#d81b60', [{ x: pa.x + 20, y: pa.y }, { x: pa.x + 20, y: lane }, { x: pb.x - 20, y: lane }, { x: pb.x - 20, y: pb.y }]));
  }
  for (const [k, type, pinIn, fromGate, x, y] of s.loads ?? []) {
    const load = place(type, pinIn, { x, y });
    parts.push(load);
    const def = getDef(type)!;
    const other = def.pins(load.props).find((q) => q.id !== pinIn)!.id;
    const g = pinAt(load, other);
    wires.push(wire(byKey.get(fromGate)!, 'Y', load, pinIn, '#fdd835'));
    wires.push(wire(p, 'GND', load, other, BLACK, [{ x: pinAt(p, 'GND').x, y: bottom }, { x: g.x, y: bottom }]));
    byKey.set(k, load);
  }
  return { version: 1, name: s.name, components: parts, wires };
}

export const GATE_EXAMPLES = [
  {
    id: 'logic-gates',
    name: 'Logic gates playground',
    description: 'Two clickable inputs A (top) and B (bottom) feed NOT, AND, OR, NAND, NOR and XOR gates; a probe on each output shows 1 or 0. Click the inputs while simulating and check each truth table.',
    build: (): CircuitDoc => {
      const types = ['gate-not', 'gate-and', 'gate-or', 'gate-nand', 'gate-nor', 'gate-xor'];
      return logic({
        name: 'Logic gates',
        inputs: [['A', 0, 60], ['B', 0, 260]],
        gates: types.map((t, i) => [t, t, 260, -20 + i * 70] as [string, string, number, number]),
        probes: types.map((t, i) => [`p-${t}`, 320, -20 + i * 70] as [string, number, number]),
        links: [
          ...types.map((t) => ['A', t, 'A'] as [string, string, string]),
          ...types.filter((t) => t !== 'gate-not').map((t) => ['B', t, 'B'] as [string, string, string]),
          ...types.map((t) => [t, `p-${t}`, 'IN'] as [string, string, string]),
        ],
      });
    },
  },
  {
    id: 'half-adder',
    name: 'Half adder (XOR + AND)',
    description: 'Adds two bits: the XOR gives the sum bit and the AND the carry. 1 + 1 = 10 in binary, so both probes read 1 0 → Sum 0, Carry 1. The first building block of every computer’s arithmetic.',
    build: () => logic({
      name: 'Half adder',
      inputs: [['A', 0, 0], ['B', 0, 120]],
      gates: [['sum', 'gate-xor', 220, 20], ['carry', 'gate-and', 220, 120]],
      probes: [['S', 290, 20], ['C', 290, 120]],
      links: [['A', 'sum', 'A'], ['B', 'sum', 'B'], ['A', 'carry', 'A'], ['B', 'carry', 'B'], ['sum', 'S', 'IN'], ['carry', 'C', 'IN']],
    }),
  },
  {
    id: 'full-adder',
    name: 'Full adder (A + B + carry in)',
    description: 'Two half adders and an OR: adds A, B and a carry-in bit, giving Sum (top probe) and Carry out (bottom probe). Chain four of them and you have a 4-bit adder like the 74HC283.',
    build: () => logic({
      name: 'Full adder',
      inputs: [['A', 0, 0], ['B', 0, 90], ['Cin', 0, 200]],
      gates: [
        ['x1', 'gate-xor', 200, 40], ['x2', 'gate-xor', 380, 110],
        ['a1', 'gate-and', 200, 270], ['a2', 'gate-and', 380, 200], ['or', 'gate-or', 540, 260],
      ],
      probes: [['S', 610, 110], ['Co', 610, 260]],
      links: [
        ['A', 'x1', 'A'], ['B', 'x1', 'B'], ['x1', 'x2', 'A'], ['Cin', 'x2', 'B'],
        ['A', 'a1', 'A'], ['B', 'a1', 'B'], ['x1', 'a2', 'A'], ['Cin', 'a2', 'B'],
        ['a2', 'or', 'A'], ['a1', 'or', 'B'], ['x2', 'S', 'IN'], ['or', 'Co', 'IN'],
      ],
    }),
  },
  {
    id: 'sr-latch',
    name: 'SR latch — 1 bit of memory (2 NORs)',
    description: 'Two cross-coupled NOR gates remember a bit. It starts reset (R = 1). Click R back to 0: Q stays 0. Pulse S (1 then 0): Q flips to 1 and stays there — it remembers. Pulse R to clear it. Top probe Q, bottom probe Q̅.',
    build: () => logic({
      name: 'SR latch',
      inputs: [['S', 0, 0], ['R', 0, 180, 1]],
      gates: [['nq', 'gate-nor', 240, 10], ['q', 'gate-nor', 240, 170]],
      probes: [['Q', 320, 170], ['NQ', 320, 10]],
      links: [['S', 'nq', 'A'], ['R', 'q', 'B'], ['q', 'Q', 'IN'], ['nq', 'NQ', 'IN']],
      feedback: [['q', 'nq', 'B', 110], ['nq', 'q', 'A', 70]],
    }),
  },
  {
    id: 'mux-gates',
    name: '2-to-1 multiplexer from gates',
    description: 'A digital switch: when S is 0 the output copies A, when S is 1 it copies B. Built from a NOT, two ANDs and an OR — the same job a 74HC157 does four times over.',
    build: () => logic({
      name: 'Multiplexer',
      inputs: [['A', 0, 0], ['B', 0, 110], ['S', 0, 240]],
      gates: [['ns', 'gate-not', 220, 320], ['a1', 'gate-and', 380, 30], ['a2', 'gate-and', 380, 150], ['or', 'gate-or', 540, 90]],
      probes: [['Y', 610, 90]],
      links: [['A', 'a1', 'A'], ['S', 'ns', 'A'], ['ns', 'a1', 'B'], ['B', 'a2', 'A'], ['S', 'a2', 'B'], ['a1', 'or', 'A'], ['a2', 'or', 'B'], ['or', 'Y', 'IN']],
    }),
  },
  {
    id: 'majority',
    name: 'Majority vote (3 inputs)',
    description: 'The output is 1 when at least two of the three inputs are 1 — three ANDs check every pair and a 3-input OR combines them. Used for fault-tolerant voting (e.g. three sensors, trust the majority).',
    build: () => logic({
      name: 'Majority vote',
      inputs: [['A', 0, 0], ['B', 0, 110], ['C', 0, 220]],
      gates: [['ab', 'gate-and', 240, 0], ['bc', 'gate-and', 240, 110], ['ac', 'gate-and', 240, 220], ['or', 'gate-or3', 420, 110]],
      probes: [['Y', 490, 110]],
      links: [['A', 'ab', 'A'], ['B', 'ab', 'B'], ['B', 'bc', 'A'], ['C', 'bc', 'B'], ['A', 'ac', 'A'], ['C', 'ac', 'B'], ['ab', 'or', 'A'], ['bc', 'or', 'B'], ['ac', 'or', 'C'], ['or', 'Y', 'IN']],
    }),
  },
  {
    id: 'nand-xor',
    name: 'XOR built only from NAND gates',
    description: 'NAND is "universal": four of them make an XOR. Compare the probe with a real XOR gate’s truth table — 1 only when A and B differ.',
    build: () => logic({
      name: 'XOR from NANDs',
      inputs: [['A', 0, 0], ['B', 0, 160]],
      gates: [['n1', 'gate-nand', 200, 80], ['n2', 'gate-nand', 380, 20], ['n3', 'gate-nand', 380, 140], ['n4', 'gate-nand', 540, 80]],
      probes: [['Y', 610, 80]],
      links: [['A', 'n1', 'A'], ['B', 'n1', 'B'], ['A', 'n2', 'A'], ['n1', 'n2', 'B'], ['n1', 'n3', 'A'], ['B', 'n3', 'B'], ['n2', 'n4', 'A'], ['n3', 'n4', 'B'], ['n4', 'Y', 'IN']],
    }),
  },
  {
    id: 'alarm-gates',
    name: 'Burglar alarm logic (buzzer)',
    description: 'Door, window and "armed" switches (top to bottom; 1 = open / armed). (door OR window) AND armed sounds the buzzer — unmute the sound in the toolbar and open a door while it is armed.',
    build: () => logic({
      name: 'Burglar alarm',
      inputs: [['door', 0, 0], ['window', 0, 110], ['armed', 0, 240]],
      gates: [['or', 'gate-or', 220, 60], ['and', 'gate-and', 400, 150]],
      probes: [['Y', 470, 150]],
      links: [['door', 'or', 'A'], ['window', 'or', 'B'], ['or', 'and', 'A'], ['armed', 'and', 'B'], ['and', 'Y', 'IN']],
      loads: [['bz', 'active-buzzer', 'P', 'and', 400, 250]],
    }),
  },
];
