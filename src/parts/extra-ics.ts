/** More logic and analog ICs: NOR, Schmitt inverter, D flip-flop, tri-state buffer, CMOS NAND, analog switch, op-amps, comparators, shunt reference, negative regulator. */
import { COL, H, dip, dout, hiz, quiescent, to92, to220, tri, contact, type Raw } from './kit';

const LO = (pin: string) => `!${H(pin)}`;
const hcWarn = [{ when: 'v(VCC, GND) > 6.5', level: 'error', message: '74HC chips are rated to 6 V.' }];

// ---------------------------------------------------------------- logic

const nor02: Raw = (() => {
  // the 7402 has its outputs first: 1Y 1A 1B …
  const names = ['Y1', 'A1', 'B1', 'Y2', 'A2', 'B2', 'GND', 'A3', 'B3', 'Y3', 'A4', 'B4', 'Y4', 'VCC'];
  const d = dip(names, { label: '74HC02', sub: 'NOR', labels: Object.fromEntries(names.filter((p) => /^[ABY]\d$/.test(p)).map((p) => [p, `${p[1]}${p[0]}`])) });
  return {
    type: '74hc02', name: '74HC02 quad NOR gate', category: 'logic',
    description: 'Four 2-input NOR gates: Y is HIGH only when both inputs are LOW. Note the 7402 pinout puts each output before its inputs. Two NORs cross-coupled make an SR latch.',
    keywords: ['nor', '74hc02', '7402', 'logic', 'gate', 'sr latch'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => dout(`G${n}`, `Y${n}`, `!(${H(`A${n}`)} || ${H(`B${n}`)})`)),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`A${n}`, `B${n}`])),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    warnings: hcWarn,
  };
})();

const schmitt14: Raw = (() => {
  const names = ['A1', 'Y1', 'A2', 'Y2', 'A3', 'Y3', 'GND', 'Y4', 'A4', 'Y5', 'A5', 'Y6', 'A6', 'VCC'];
  const d = dip(names, { label: '74HC14', sub: 'Schmitt inverter', labels: Object.fromEntries(names.filter((p) => /^[AY]\d$/.test(p)).map((p) => [p, `${p[1]}${p[0]}`])) });
  const g = [1, 2, 3, 4, 5, 6];
  return {
    type: '74hc14', name: '74HC14 hex Schmitt-trigger inverter', category: 'logic',
    description: 'Six inverters with hysteresis: the input must rise above ~60 % of VCC to switch the output LOW and fall below ~40 % to switch it back. Cleans up slow or noisy signals (button bounce, RC ramps) and makes a one-gate RC oscillator.',
    keywords: ['schmitt', 'trigger', '74hc14', '7414', 'inverter', 'hysteresis', 'debounce', 'oscillator'],
    ...d,
    states: g.map((n) => ({ name: `s${n}`, init: 0, next: `v(A${n}, GND) > 0.6 * v(VCC, GND) ? 1 : (v(A${n}, GND) < 0.4 * v(VCC, GND) ? 0 : s${n})` })),
    model: { elements: [...g.map((n) => dout(`G${n}`, `Y${n}`, `s${n} == 0`)), ...hiz(g.map((n) => `A${n}`)), quiescent('VCC', 'GND', 1e5)] },
    warnings: hcWarn,
  };
})();

const dff74: Raw = (() => {
  const names = ['CLR1', 'D1', 'CK1', 'PR1', 'Q1', 'QN1', 'GND', 'QN2', 'Q2', 'PR2', 'CK2', 'D2', 'CLR2', 'VCC'];
  const d = dip(names, {
    label: '74HC74', sub: 'dual D flip-flop',
    labels: { CLR1: '1 CLR (active LOW)', D1: '1 D', CK1: '1 CLK (rising edge)', PR1: '1 PRE (active LOW)', Q1: '1 Q', QN1: '1 Q̅', QN2: '2 Q̅', Q2: '2 Q', PR2: '2 PRE (active LOW)', CK2: '2 CLK (rising edge)', D2: '2 D', CLR2: '2 CLR (active LOW)' },
  });
  const ff = (n: number) => [
    // Q takes D on each rising clock edge; CLR / PRE (active LOW) override it
    { name: `q${n}`, init: 0, next: `${LO(`CLR${n}`)} ? 0 : (${LO(`PR${n}`)} ? 1 : ((edges(CK${n}) - pe${n}) > 0 ? (${H(`D${n}`)} ? 1 : 0) : q${n}))` },
    { name: `pe${n}`, init: `edges(CK${n})`, next: `edges(CK${n})` },
  ];
  return {
    type: '74hc74', name: '74HC74 dual D flip-flop', category: 'logic',
    description: 'Two edge-triggered D flip-flops: on each rising CLK edge Q copies D (and Q̅ is its opposite). CLR and PRE are active LOW and override the clock — tie them HIGH (the simulation pulls them up). Wire Q̅ back to D for a divide-by-2.',
    keywords: ['flip-flop', 'flip flop', 'd latch', '74hc74', '7474', 'register', 'divide by 2', 'toggle'],
    ...d,
    states: [...ff(1), ...ff(2)],
    model: {
      elements: [
        ...[1, 2].flatMap((n) => [dout(`OQ${n}`, `Q${n}`, `q${n} == 1`), dout(`ON${n}`, `QN${n}`, `q${n} == 0`)]),
        ...hiz(['D1', 'CK1', 'D2', 'CK2']),
        // CLR / PRE pulled up so an unconnected pin doesn't hold the flip-flop cleared
        ...hiz(['CLR1', 'PR1', 'CLR2', 'PR2'], 'VCC', 'RPU'),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    readouts: [{ label: 'Q', value: 'q1 * 10 + q2', x: 25, y: 38, size: 3.6, color: '#555' }],
    warnings: hcWarn,
  };
})();

const buf125: Raw = (() => {
  const names = ['OE1', 'A1', 'Y1', 'OE2', 'A2', 'Y2', 'GND', 'Y3', 'A3', 'OE3', 'Y4', 'A4', 'OE4', 'VCC'];
  const d = dip(names, { label: '74HC125', sub: 'tri-state buffer', labels: Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`OE${n}`, `${n}OE̅ (LOW = drive)`], [`A${n}`, `${n}A`], [`Y${n}`, `${n}Y`]])) });
  return {
    type: '74hc125', name: '74HC125 quad tri-state buffer', category: 'logic',
    description: 'Four buffers whose outputs can be switched off: with OE̅ LOW, Y follows A; with OE̅ HIGH the output floats (high impedance), so several chips can share one wire (a bus) or a 3.3 V line can be level-shifted.',
    keywords: ['buffer', 'tri-state', 'tristate', '74hc125', 'bus', 'high impedance', 'line driver'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].flatMap((n) => tri(`B${n}`, `Y${n}`, H(`A${n}`), LO(`OE${n}`))),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`A${n}`, `OE${n}`])),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    warnings: hcWarn,
  };
})();

const cd4011: Raw = (() => {
  const names = ['A1', 'B1', 'Y1', 'Y2', 'A2', 'B2', 'GND', 'A3', 'B3', 'Y3', 'Y4', 'A4', 'B4', 'VCC'];
  const d = dip(names, { label: 'CD4011BE', sub: 'quad NAND', labels: { VCC: 'VDD (3–15 V)', GND: 'VSS', ...Object.fromEntries(names.filter((p) => /^[ABY]\d$/.test(p)).map((p) => [p, `${p[1]}${p[0]}`])) } });
  return {
    type: 'cd4011', name: 'CD4011 quad NAND (4000-series CMOS)', category: 'logic',
    description: 'The classic 4000-series CMOS NAND: runs from 3 to 15 V (handy with a 9 V battery), draws almost nothing, but its outputs are weak (~1 kΩ) — fine for LEDs through a resistor, not for loads.',
    keywords: ['cd4011', '4011', 'nand', 'cmos', '4000 series', 'logic', '9v logic'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => dout(`G${n}`, `Y${n}`, `!(${H(`A${n}`)} && ${H(`B${n}`)})`, 'VCC', 'GND', 900)),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`A${n}`, `B${n}`])),
        quiescent('VCC', 'GND', 1e6),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 18', level: 'error', message: '4000-series CMOS is rated to 18 V.' }],
  };
})();

const cd4066: Raw = (() => {
  const names = ['A1', 'B1', 'B2', 'A2', 'C2', 'C3', 'GND', 'A3', 'B3', 'B4', 'A4', 'C4', 'C1', 'VCC'];
  const d = dip(names, {
    label: 'CD4066BE', sub: 'analog switch',
    labels: { VCC: 'VDD (3–15 V)', GND: 'VSS', ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`A${n}`, `Switch ${n} in/out`], [`B${n}`, `Switch ${n} out/in`], [`C${n}`, `Control ${n} (HIGH = closed)`]])) },
  });
  return {
    type: 'cd4066', name: 'CD4066 quad bilateral analog switch', category: 'logic',
    description: 'Four electronically controlled switches: when a control pin is HIGH its switch closes (~100 Ω) and passes signals either way — audio, analog voltages or logic. Keep signals between VSS and VDD.',
    keywords: ['cd4066', '4066', 'analog switch', 'bilateral switch', 'transmission gate', 'audio switch'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => contact(`S${n}`, `A${n}`, `B${n}`, `${H(`C${n}`)} && v(VCC, GND) > 2.5`, 100)),
        ...hiz([1, 2, 3, 4].map((n) => `C${n}`)),
        quiescent('VCC', 'GND', 1e6),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 18', level: 'error', message: '4000-series CMOS is rated to 18 V.' }],
  };
})();

// ---------------------------------------------------------------- analog

const lm324: Raw = (() => {
  const names = ['O1', 'N1', 'P1', 'VCC', 'P2', 'N2', 'O2', 'O3', 'N3', 'P3', 'GND', 'P4', 'N4', 'O4'];
  const d = dip(names, { label: 'LM324N', sub: 'quad op-amp', labels: { VCC: 'V+ (3–32 V)', GND: 'V− / GND', ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`O${n}`, `Output ${n}`], [`N${n}`, `Input ${n} −`], [`P${n}`, `Input ${n} +`]])) } });
  return {
    type: 'lm324', name: 'LM324 quad op-amp', category: 'ics',
    description: 'Four LM358-style op-amps in one DIP-14, single-supply (3–32 V) with inputs down to GND. Four filters, buffers or a bar-graph comparator ladder from one chip.',
    keywords: ['lm324', 'op-amp', 'opamp', 'quad', 'amplifier', 'operational amplifier'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => ({ id: `A${n}`, kind: 'opamp', p: `P${n}`, n: `N${n}`, out: `O${n}`, vcc: 'VCC', vee: 'GND' })),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`P${n}`, `N${n}`])),
        quiescent('VCC', 'GND', 7000),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 32', level: 'error', message: 'Supply above 32 V.' }],
  };
})();

const tl072: Raw = (() => {
  const d = dip(['O1', 'N1', 'P1', 'VEE', 'P2', 'N2', 'O2', 'VCC'], {
    label: 'TL072CP', sub: 'JFET op-amp',
    labels: { O1: 'Output A', N1: 'Input A −', P1: 'Input A +', VEE: 'V− (e.g. −12 V)', P2: 'Input B +', N2: 'Input B −', O2: 'Output B', VCC: 'V+ (e.g. +12 V)' },
  });
  return {
    type: 'tl072', name: 'TL072 dual JFET op-amp (audio)', category: 'ics',
    description: 'Low-noise dual op-amp with JFET inputs (practically no input current) — the audio favourite for preamps, filters and mixers. Needs a split supply (±5 to ±15 V); the output stays ~1.5 V inside the rails.',
    keywords: ['tl072', 'tl074', 'tl082', 'jfet', 'op-amp', 'audio', 'preamp', 'filter'],
    ...d,
    model: {
      elements: [
        { id: 'A', kind: 'opamp', p: 'P1', n: 'N1', out: 'O1', vcc: 'VCC', vee: 'VEE', gain: 2e5 },
        { id: 'B', kind: 'opamp', p: 'P2', n: 'N2', out: 'O2', vcc: 'VCC', vee: 'VEE', gain: 2e5 },
        ...hiz(['P1', 'N1', 'P2', 'N2'], 'VEE'),
        quiescent('VCC', 'VEE', 8000),
      ],
    },
    warnings: [{ when: 'v(VCC, VEE) > 36', level: 'error', message: 'Total supply above 36 V.' }],
  };
})();

const lm386: Raw = (() => {
  const d = dip(['G1', 'INN', 'INP', 'GND', 'OUT', 'VS', 'BYP', 'G8'], {
    label: 'LM386N', sub: 'audio amp',
    labels: { G1: 'Gain set', INN: 'Input −', INP: 'Input +', OUT: 'Output (to the speaker via 220 µF)', VS: 'Supply (4–12 V)', BYP: 'Bypass (10 µF to GND)', G8: 'Gain set' },
  });
  return {
    type: 'lm386', name: 'LM386 audio power amplifier', category: 'ics',
    description: 'Half-watt audio amplifier for a small 8 Ω speaker: gain 20 as is, up to 200 with 10 µF between pins 1 and 8 (set Gain). The output idles at half the supply, so feed the speaker through a 220 µF capacitor.',
    keywords: ['lm386', 'audio amplifier', 'speaker amp', 'power amplifier', 'sound'],
    ...d,
    props: [{ key: 'gain', label: 'Gain', type: 'select', default: 20, options: [{ value: 20, label: '20 (pins 1–8 open)' }, { value: 50, label: '50 (1.2 kΩ + 10 µF)' }, { value: 200, label: '200 (10 µF across 1–8)' }] }],
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VS, GND) > 4 ? clamp(v(VS, GND) / 2 + gain * (v(INP, GND) - v(INN, GND)), 0.4, v(VS, GND) - 0.4) : 0', r: 0.3 },
        // 50 kΩ input resistors to ground, as on the real chip
        { id: 'RIP', kind: 'resistor', a: 'INP', b: 'GND', value: 50000 },
        { id: 'RIN', kind: 'resistor', a: 'INN', b: 'GND', value: 50000 },
        ...hiz(['G1', 'G8', 'BYP']),
        quiescent('VS', 'GND', 1000),
      ],
    },
    warnings: [{ when: 'v(VS, GND) > 12.5', level: 'error', message: 'Supply above 12 V.' }, { when: 'abs(i(O)) > 0.6', level: 'warn', message: 'Output current above ~0.5 A — use an 8 Ω speaker.' }],
  };
})();

const lm339: Raw = (() => {
  const names = ['O2', 'O1', 'VCC', 'N1', 'P1', 'N2', 'P2', 'N3', 'P3', 'N4', 'P4', 'GND', 'O4', 'O3'];
  const d = dip(names, { label: 'LM339N', sub: 'quad comparator', labels: { VCC: 'V+ (2–36 V)', ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`O${n}`, `Output ${n} (open collector)`], [`N${n}`, `Input ${n} −`], [`P${n}`, `Input ${n} +`]])) } });
  return {
    type: 'lm339', name: 'LM339 quad comparator', category: 'ics',
    description: 'Four open-collector comparators: an output pulls LOW when its + input is below its − input, and floats otherwise — add a pull-up resistor. Window detectors, bar-graph ladders, battery monitors.',
    keywords: ['lm339', 'comparator', 'quad comparator', 'open collector', 'window detector'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => ({ id: `C${n}`, kind: 'comparator', p: `P${n}`, n: `N${n}`, out: `O${n}`, vee: 'GND' })),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`P${n}`, `N${n}`])),
        quiescent('VCC', 'GND', 8000),
      ],
    },
  };
})();

const tl431: Raw = (() => {
  const pk = to92(['REF', 'A', 'K'], 'TL431', COL.ic, { REF: 'Reference (2.495 V above the anode)', A: 'Anode', K: 'Cathode' });
  return {
    type: 'tl431', name: 'TL431 adjustable shunt reference', category: 'power',
    description: 'A "programmable zener": it sinks whatever current keeps its REF pin at 2.495 V above the anode. REF tied to K gives a 2.5 V reference; a divider R1/R2 from K sets Vk = 2.495 × (1 + R1/R2), up to 36 V. Feed it through a resistor (1–100 mA).',
    keywords: ['tl431', 'shunt regulator', 'voltage reference', 'programmable zener', '2.5v reference'],
    ...pk,
    model: {
      // error amplifier compares REF with the internal 2.495 V bandgap and drives the shunt transistor
      nodes: ['VR', 'OB', 'B'],
      elements: [
        { id: 'BG', kind: 'vsource', p: 'VR', n: 'A', value: 2.495, r: 1 },
        { id: 'EA', kind: 'opamp', p: 'REF', n: 'VR', out: 'OB', vcc: 'K', vee: 'A', gain: 1e4, railToRail: true },
        { id: 'RB', kind: 'resistor', a: 'OB', b: 'B', value: 1000 },
        { id: 'SH', kind: 'npn', c: 'K', b: 'B', e: 'A', beta: 200 },
        { id: 'RD', kind: 'diode', a: 'A', k: 'K', model: 'silicon' },
        { id: 'RR', kind: 'resistor', a: 'REF', b: 'A', value: 1e7 },
        { id: 'RL', kind: 'resistor', a: 'K', b: 'A', value: 1e7 },
      ],
    },
    readouts: [{ value: 'v(K, A)', unit: 'V', x: 10, y: -24, size: 4 }],
    warnings: [{ when: 'i(SH) > 0.1', level: 'error', message: 'Cathode current above 100 mA — raise the series resistor.' }],
  };
})();

const reg79: Raw = (() => {
  const pk = to220(['GND', 'IN', 'OUT'], 'L7905CV', { GND: 'Ground', IN: 'Input (−7 … −35 V)', OUT: 'Output (−5 V)' });
  return {
    type: 'reg-79xx', name: 'Negative voltage regulator (79xx)', category: 'power',
    description: 'The negative twin of the 78xx: turns an unregulated negative supply into a fixed −5, −9 or −12 V — with a 7805 it makes the ± rails op-amps love. Note the different pinout: GND, IN, OUT. Needs ~2 V of headroom.',
    keywords: ['7905', '7912', '79xx', 'negative regulator', 'split supply', 'dual rail'],
    ...pk,
    props: [{ key: 'vout', label: 'Type', type: 'select', default: 5, options: [{ value: 5, label: '7905 (−5 V)' }, { value: 9, label: '7909 (−9 V)' }, { value: 12, label: '7912 (−12 V)' }] }],
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'GND', n: 'OUT', value: 'min(vout, max(0, v(GND, IN) - 1.8))', r: 0.15 },
        { id: 'IQ', kind: 'resistor', a: 'GND', b: 'IN', value: 3000 },
        { id: 'MIN', kind: 'resistor', a: 'OUT', b: 'GND', value: 10000 },
      ],
    },
    warnings: [{ when: 'v(IN, GND) > 0.5', level: 'error', message: 'The input must be negative (below GND).' }, { when: 'v(GND, IN) < vout + 1.8 && v(GND, IN) > 1', level: 'warn', message: 'Input too close to the output — the regulator has dropped out.' }],
  };
})();

export const EXTRA_ICS: Raw[] = [nor02, schmitt14, dff74, buf125, cd4011, cd4066, lm324, tl072, lm386, lm339, tl431, reg79];
