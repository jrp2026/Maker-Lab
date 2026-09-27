/**
 * Single logic gates drawn as their textbook symbols — for learning logic without reading a chip
 * pinout. Each is one ideal CMOS gate: inputs on the left, output on the right, VCC / GND leads
 * top and bottom; a small LED on the body shows the output state. Plus a clickable logic input
 * and a logic probe, so a gate circuit needs no breadboard wiring to try.
 */
import { H, circle, dout, hiz, line, path, quiescent, rect, text, type Raw } from './kit';

const BODY = '#e8f1fb', EDGE = '#1f4f8a';
const lead = (x1: number, y1: number, x2: number, y2: number): Raw => line(x1, y1, x2, y2, '#9aa3ad', 1.6);

// body outlines, 16…~54 wide inside a 70 × 40 box
const AND_BODY = 'M 16 4 L 36 4 A 16 16 0 0 1 36 36 L 16 36 Z';
const OR_BODY = 'M 12 4 Q 24 20 12 36 Q 40 36 54 20 Q 40 4 12 4 Z';
const XOR_BACK = 'M 7 4 Q 19 20 7 36';
const BUF_BODY = 'M 16 5 L 50 20 L 16 35 Z';

interface GateOpts {
  type: string; name: string; label: string; description: string; keywords: string[];
  inputs: string[]; body: string; outX: number; out: string;
  bubble?: boolean; back?: string; labelX?: number;
}

function gate(o: GateOpts): Raw {
  const inY = o.inputs.length === 1 ? [20] : o.inputs.length === 2 ? [10, 30] : [10, 20, 30];
  const lx = o.labelX ?? 32;
  const pins = [
    ...o.inputs.map((id, i) => ({ id, x: 0, y: inY[i], label: `Input ${id}`, kind: 'lead' })),
    { id: 'Y', x: 70, y: 20, label: 'Output Y', kind: 'lead' },
    { id: 'VCC', x: 30, y: 0, label: 'VCC (+3.3–5 V)', kind: 'lead' },
    { id: 'GND', x: 30, y: 40, label: 'GND', kind: 'lead' },
  ];
  // the symbol, shared by the breadboard and schematic views
  const symbol = [
    ...o.inputs.map((_, i) => lead(0, inY[i], 16, inY[i])),
    lead(o.outX + (o.bubble ? 8 : 0), 20, 70, 20),
    ...(o.back ? [path(o.back, 'none', { stroke: EDGE, strokeWidth: 1.4 })] : []),
    path(o.body, BODY, { stroke: EDGE, strokeWidth: 1.4 }),
    ...(o.bubble ? [circle(o.outX + 4, 20, 3.6, BODY, { stroke: EDGE, strokeWidth: 1.4 })] : []),
  ];
  const size = Math.min(6, 26 / (0.62 * o.label.length));
  const title = text(lx, 23.5, o.label, size, EDGE, 'middle', { weight: 800 });
  return {
    type: o.type, name: o.name, category: 'gates', description: o.description, keywords: o.keywords,
    pins,
    shapes: [
      lead(30, 0, 30, 6), lead(30, 34, 30, 40),
      ...symbol.map((s) => (s.type === 'path' && s.fill !== 'none') || s.type === 'circle' ? { ...s, shadow: 0.6 } : s),
      title,
      circle(lx, 30.5, 2, '#5a2a2a', { stroke: '#3a1a1a', strokeWidth: 0.4 }),
    ],
    symbol: [...symbol, title],
    indicators: [{ shape: circle(lx, 30.5, 2, '#ff3b30'), color: '#ff3b30', level: 'v(Y, GND) > v(VCC, GND) / 2 && v(VCC, GND) > 1.5 ? 1 : 0' }],
    model: { elements: [dout('O', 'Y', `v(VCC, GND) > 1.5 && (${o.out})`, 'VCC', 'GND', 50), ...hiz(o.inputs), quiescent('VCC', 'GND', 1e6)] },
    warnings: [{ when: 'v(VCC, GND) > 6.5', level: 'error', message: 'Logic gates are rated to 6 V.' }],
  };
}

const POWER = 'Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output.';
const A = H('A'), B = H('B'), C = H('C');

const logicInput: Raw = {
  type: 'logic-input', name: 'Logic input (click for 1 / 0)', category: 'gates',
  description: 'A switch that drives its OUT pin to a clean logic level: click it while simulating to flip between 1 (= VCC) and 0 (= GND). Connect VCC and GND to your supply. Perfect for feeding gates without pull-up resistors.',
  keywords: ['logic input', 'logic switch', 'input switch', 'toggle', 'high low', 'logic level', 'digital input'],
  pins: [
    { id: 'OUT', x: 40, y: 20, label: 'OUT (1 = VCC, 0 = GND)', kind: 'lead' },
    { id: 'VCC', x: 10, y: 0, label: 'VCC', kind: 'lead' },
    { id: 'GND', x: 10, y: 40, label: 'GND', kind: 'lead' },
  ],
  props: [{ key: 'on', label: 'Output', type: 'select', default: 0, options: [{ value: 0, label: '0 (LOW)' }, { value: 1, label: '1 (HIGH)' }] }],
  toggle: 'on',
  // schematic: an input flag pointing at its output, fed from VCC / GND
  symbol: [
    { type: 'polyline', points: [0, 10, 26, 10, 34, 20, 26, 30, 0, 30, 0, 10], fill: 'none', strokeWidth: 1.3 },
    text(14, 22.5, 'IN', 7, '#1f3a5f', 'middle', { weight: 700 }),
    { type: 'line', x1: 10, y1: 0, x2: 10, y2: 10, strokeWidth: 1.2 },
    { type: 'line', x1: 10, y1: 30, x2: 10, y2: 40, strokeWidth: 1.2 },
    { type: 'line', x1: 34, y1: 20, x2: 40, y2: 20, strokeWidth: 1.2 },
  ],
  shapes: [
    lead(10, 0, 10, 6), lead(10, 34, 10, 40), lead(30, 20, 40, 20),
    rect(-2, 6, 32, 28, BODY, { rx: 4, stroke: EDGE, strokeWidth: 1.4, shadow: 0.6 }),
    rect(4, 12, 20, 16, '#c9d6e4', { rx: 8, stroke: EDGE, strokeWidth: 0.8 }),
  ],
  animations: [{ shape: circle(11, 20, 6, '#ffffff', { stroke: EDGE, strokeWidth: 1, grad: '#c9d6e4', gradDir: 'r' }), dx: 'on == 1 ? 6 : 0' }],
  indicators: [{ shape: rect(4, 12, 20, 16, '#35c46a', { rx: 8 }), color: '#35c46a', level: 'on == 1 ? 0.8 : 0' }],
  readouts: [{ value: 'on', x: 14, y: 3, size: 5, color: EDGE }],
  model: { elements: [dout('O', 'OUT', 'on == 1', 'VCC', 'GND', 20), quiescent('VCC', 'GND', 1e6)] },
};

const logicProbe: Raw = {
  type: 'logic-probe', name: 'Logic probe (shows 1 / 0)', category: 'gates',
  description: 'A lamp that lights when its IN pin is a logic 1 (above half of VCC) and shows the value, 1 or 0. It draws almost no current, so it can watch any gate output. Connect VCC and GND to your supply.',
  keywords: ['logic probe', 'logic output', 'indicator', 'lamp', 'high low', 'logic level', 'digital output'],
  pins: [
    { id: 'IN', x: 0, y: 20, label: 'IN', kind: 'lead' },
    { id: 'VCC', x: 30, y: 0, label: 'VCC', kind: 'lead' },
    { id: 'GND', x: 30, y: 40, label: 'GND', kind: 'lead' },
  ],
  // schematic: a probe flag receiving its input
  symbol: [
    { type: 'polyline', points: [6, 20, 14, 10, 40, 10, 40, 30, 14, 30, 6, 20], fill: 'none', strokeWidth: 1.3 },
    text(25, 22.5, 'PROBE', 5.5, '#1f3a5f', 'middle', { weight: 700 }),
    { type: 'line', x1: 0, y1: 20, x2: 6, y2: 20, strokeWidth: 1.2 },
    { type: 'line', x1: 30, y1: 0, x2: 30, y2: 10, strokeWidth: 1.2 },
    { type: 'line', x1: 30, y1: 30, x2: 30, y2: 40, strokeWidth: 1.2 },
  ],
  shapes: [
    lead(0, 20, 14, 20), lead(30, 0, 30, 6), lead(30, 34, 30, 40),
    circle(30, 20, 14, BODY, { stroke: EDGE, strokeWidth: 1.4, shadow: 0.6 }),
    circle(30, 20, 9, '#5a2a2a', { grad: '#2a1515', gradDir: 'r' }),
  ],
  indicators: [{ shape: circle(30, 20, 9, '#ffcf3a'), color: '#ffcf3a', level: 'v(IN, GND) > v(VCC, GND) / 2 && v(VCC, GND) > 1.5 ? 1 : 0' }],
  readouts: [{ value: 'v(IN, GND) > v(VCC, GND) / 2 && v(VCC, GND) > 1.5 ? 1 : 0', x: 30, y: 23, size: 8, color: EDGE }],
  model: { elements: [...hiz(['IN']), quiescent('VCC', 'GND', 1e6)] },
};

export const GATES: Raw[] = [
  gate({
    type: 'gate-not', name: 'NOT gate (inverter)', label: 'NOT', inputs: ['A'], body: BUF_BODY, outX: 50, bubble: true, labelX: 27,
    description: `One inverter: Y is the opposite of A. ${POWER} (Six-in-a-chip version: 74HC04.)`,
    keywords: ['not', 'not gate', 'inverter', 'logic gate', 'negation', 'boolean'], out: `!${A}`,
  }),
  gate({
    type: 'gate-buffer', name: 'Buffer gate', label: 'BUF', inputs: ['A'], body: BUF_BODY, outX: 50, labelX: 27,
    description: `Y simply copies A — used to clean up a slow or weak signal or drive more inputs. ${POWER}`,
    keywords: ['buffer', 'buffer gate', 'logic gate', 'driver', 'boolean'], out: A,
  }),
  gate({
    type: 'gate-and', name: 'AND gate (2-input)', label: 'AND', inputs: ['A', 'B'], body: AND_BODY, outX: 52,
    description: `Y is 1 only when A AND B are both 1. ${POWER} (Four-in-a-chip version: 74HC08.)`,
    keywords: ['and', 'and gate', 'logic gate', 'conjunction', 'boolean'], out: `${A} && ${B}`,
  }),
  gate({
    type: 'gate-or', name: 'OR gate (2-input)', label: 'OR', inputs: ['A', 'B'], body: OR_BODY, outX: 54,
    description: `Y is 1 when A OR B (or both) is 1. ${POWER} (Four-in-a-chip version: 74HC32.)`,
    keywords: ['or', 'or gate', 'logic gate', 'disjunction', 'boolean'], out: `${A} || ${B}`,
  }),
  gate({
    type: 'gate-nand', name: 'NAND gate (2-input)', label: 'NAND', inputs: ['A', 'B'], body: AND_BODY, outX: 52, bubble: true,
    description: `NOT-AND: Y is 0 only when A and B are both 1. The "universal" gate — any logic can be built from NANDs alone. ${POWER} (Four-in-a-chip version: 74HC00.)`,
    keywords: ['nand', 'nand gate', 'logic gate', 'universal gate', 'boolean'], out: `!(${A} && ${B})`,
  }),
  gate({
    type: 'gate-nor', name: 'NOR gate (2-input)', label: 'NOR', inputs: ['A', 'B'], body: OR_BODY, outX: 54, bubble: true,
    description: `NOT-OR: Y is 1 only when A and B are both 0. Also a universal gate; two cross-coupled NORs make an SR latch. ${POWER} (Four-in-a-chip version: 74HC02.)`,
    keywords: ['nor', 'nor gate', 'logic gate', 'universal gate', 'sr latch', 'boolean'], out: `!(${A} || ${B})`,
  }),
  gate({
    type: 'gate-xor', name: 'XOR gate (2-input)', label: 'XOR', inputs: ['A', 'B'], body: OR_BODY, back: XOR_BACK, outX: 54,
    description: `Exclusive OR: Y is 1 when A and B are different. It is the "sum" bit of a half adder and a controllable inverter. ${POWER} (Four-in-a-chip version: 74HC86.)`,
    keywords: ['xor', 'xor gate', 'exclusive or', 'logic gate', 'half adder', 'parity', 'boolean'], out: `${A} != ${B}`,
  }),
  gate({
    type: 'gate-xnor', name: 'XNOR gate (2-input)', label: 'XNOR', inputs: ['A', 'B'], body: OR_BODY, back: XOR_BACK, outX: 54, bubble: true,
    description: `Exclusive NOR (equality): Y is 1 when A and B are the same. ${POWER}`,
    keywords: ['xnor', 'xnor gate', 'equivalence', 'equality', 'logic gate', 'comparator', 'boolean'], out: `${A} == ${B}`,
  }),
  gate({
    type: 'gate-and3', name: 'AND gate (3-input)', label: 'AND3', inputs: ['A', 'B', 'C'], body: AND_BODY, outX: 52,
    description: `Y is 1 only when A, B and C are all 1. ${POWER} (Three-in-a-chip version: 74HC11.)`,
    keywords: ['and', '3-input and', 'and3', 'logic gate', 'boolean'], out: `${A} && ${B} && ${C}`,
  }),
  gate({
    type: 'gate-or3', name: 'OR gate (3-input)', label: 'OR3', inputs: ['A', 'B', 'C'], body: OR_BODY, outX: 54,
    description: `Y is 1 when any of A, B or C is 1. ${POWER}`,
    keywords: ['or', '3-input or', 'or3', 'logic gate', 'boolean'], out: `${A} || ${B} || ${C}`,
  }),
  logicInput,
  logicProbe,
];
