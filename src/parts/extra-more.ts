/** A third batch of parts: more logic / analog ICs, discretes, switches, sensors, meters, power parts and actuators. */
import { COL, H, axial, chip, circle, contact, dip, dout, hiz, legs, line, moduleBoard, path, pinRow, quiescent, rect, shade, silk, smd, smdRow, statusLed, text, to92, tri, type Raw } from './kit';
import { linearReg } from './power';
import { mq } from './extra-io';

const LO = (pin: string) => `!${H(pin)}`;
/** 1 / 0 logic level of a pin, for arithmetic */
const b01 = (pin: string) => `(${H(pin)} ? 1 : 0)`;
const hcWarn = [{ when: 'v(VCC, GND) > 6.5', level: 'error', message: '74HC chips are rated to 6 V.' }];
const leads = (y: number, x2 = 20): Raw[] => [line(0, 0, 0, y, '#d63c35', 1.8), line(x2, 0, x2, y, '#26282c', 1.8)];
/** invisible box so a part's bounds include artwork that only exists as an animation */
const reach = (x: number, y: number, w: number, h: number): Raw => rect(x, y, w, h, '#000000', { opacity: 0 });
const pinLeg = (x: number, top: number, bottom = 0): Raw => rect(x - 1.2, top, 2.4, bottom - top, COL.metal, { grad: COL.metalDark, gradDir: 'h' });

// ---------------------------------------------------------------- logic

/** 14-pin chip with three 3-input gates (7410 / 7411 / 7427 pinout) */
function gate3(type: string, label: string, sub: string, name: string, op: (a: string, b: string, c: string) => string, description: string, keywords: string[]): Raw {
  const names = ['A1', 'B1', 'A2', 'B2', 'C2', 'Y2', 'GND', 'Y3', 'A3', 'B3', 'C3', 'Y1', 'C1', 'VCC'];
  const d = dip(names, { label, sub, labels: Object.fromEntries(names.filter((p) => /^[ABCY]\d$/.test(p)).map((p) => [p, `${p[1]}${p[0]}`])) });
  const g = [1, 2, 3];
  return {
    type, name, category: 'logic', description, keywords, ...d,
    model: { elements: [...g.map((n) => dout(`G${n}`, `Y${n}`, op(H(`A${n}`), H(`B${n}`), H(`C${n}`)))), ...hiz(g.flatMap((n) => [`A${n}`, `B${n}`, `C${n}`])), quiescent('VCC', 'GND', 1e5)] },
    warnings: hcWarn,
  };
}

const nand3 = gate3('74hc10', '74HC10', 'triple NAND3', '74HC10 triple 3-input NAND', (a, b, c) => `!(${a} && ${b} && ${c})`,
  'Three NAND gates with three inputs each: Y is LOW only when A, B and C are all HIGH. Tie an unused input HIGH to use it as a 2-input NAND.',
  ['74hc10', '7410', 'nand', '3-input', 'logic', 'gate']);
const and3 = gate3('74hc11', '74HC11', 'triple AND3', '74HC11 triple 3-input AND', (a, b, c) => `${a} && ${b} && ${c}`,
  'Three AND gates with three inputs each: Y is HIGH only when A, B and C are all HIGH — "all three conditions" in one gate.',
  ['74hc11', '7411', 'and', '3-input', 'logic', 'gate']);
const nor3 = gate3('74hc27', '74HC27', 'triple NOR3', '74HC27 triple 3-input NOR', (a, b, c) => `!(${a} || ${b} || ${c})`,
  'Three NOR gates with three inputs each: Y is HIGH only when A, B and C are all LOW.',
  ['74hc27', '7427', 'nor', '3-input', 'logic', 'gate']);

const nand4: Raw = (() => {
  const names = ['A1', 'B1', 'NC1', 'C1', 'D1', 'Y1', 'GND', 'Y2', 'A2', 'B2', 'NC2', 'C2', 'D2', 'VCC'];
  const d = dip(names, { label: '74HC20', sub: 'dual NAND4', labels: { NC1: 'not connected', NC2: 'not connected', ...Object.fromEntries(names.filter((p) => /^[ABCDY]\d$/.test(p)).map((p) => [p, `${p[1]}${p[0]}`])) } });
  return {
    type: '74hc20', name: '74HC20 dual 4-input NAND', category: 'logic',
    description: 'Two NAND gates with four inputs each: Y goes LOW only when all four inputs are HIGH — a handy "all keys pressed" or address decoder. Pins 3 and 11 are not connected.',
    keywords: ['74hc20', '7420', 'nand', '4-input', 'logic', 'gate', 'decoder'],
    ...d,
    model: { elements: [...[1, 2].map((n) => dout(`G${n}`, `Y${n}`, `!(${H(`A${n}`)} && ${H(`B${n}`)} && ${H(`C${n}`)} && ${H(`D${n}`)})`)), ...hiz([1, 2].flatMap((n) => [`A${n}`, `B${n}`, `C${n}`, `D${n}`, `NC${n}`])), quiescent('VCC', 'GND', 1e5)] },
    warnings: hcWarn,
  };
})();

const mux157: Raw = (() => {
  const names = ['S', 'A1', 'B1', 'Y1', 'A2', 'B2', 'Y2', 'GND', 'Y3', 'B3', 'A3', 'Y4', 'B4', 'A4', 'E', 'VCC'];
  const d = dip(names, { label: '74HC157', sub: 'quad 2:1 mux', labels: { S: 'Select (LOW = A, HIGH = B)', E: 'Enable (active LOW)', ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`A${n}`, `${n}A`], [`B${n}`, `${n}B`], [`Y${n}`, `${n}Y`]])) } });
  return {
    type: '74hc157', name: '74HC157 quad 2-to-1 multiplexer', category: 'logic',
    description: 'Four switches in one chip, all flipped by one Select pin: S LOW routes the A inputs to Y, S HIGH routes the B inputs. With E̅ HIGH every Y is LOW. Swap between two 4-bit sources (two sets of buttons, two sensors).',
    keywords: ['74hc157', '74157', 'multiplexer', 'mux', 'data selector', '2 to 1'],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => dout(`G${n}`, `Y${n}`, `${LO('E')} && (${H('S')} ? ${H(`B${n}`)} : ${H(`A${n}`)})`)),
        ...hiz(['S', 'E', ...[1, 2, 3, 4].flatMap((n) => [`A${n}`, `B${n}`])]),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    warnings: hcWarn,
  };
})();

const cd4511: Raw = (() => {
  const names = ['B', 'C', 'LT', 'BI', 'LE', 'D', 'A', 'GND', 'SE', 'SD', 'SC', 'SB', 'SA', 'SG', 'SF', 'VCC'];
  const segs = ['SA', 'SB', 'SC', 'SD', 'SE', 'SF', 'SG'];
  const d = dip(names, {
    label: 'CD4511BE', sub: 'BCD → 7-seg',
    labels: { A: 'BCD input A (1)', B: 'BCD input B (2)', C: 'BCD input C (4)', D: 'BCD input D (8)', LT: 'Lamp test (LOW = all segments on)', BI: 'Blanking (LOW = all off)', LE: 'Latch enable (HIGH = hold)', VCC: 'VDD (3–15 V)', GND: 'VSS', ...Object.fromEntries(segs.map((s) => [s, `Segment ${s[1].toLowerCase()}`])) },
  });
  const masks = [63, 6, 91, 79, 102, 109, 124, 7, 127, 103];
  return {
    type: 'cd4511', name: 'CD4511 BCD to seven-segment decoder', category: 'logic',
    description: 'Turns a 4-bit number (D C B A = 8 4 2 1) into the segment pattern of that digit and drives a common-cathode display directly (through 220–470 Ω resistors) — one digit from only four Arduino pins. Codes above 9 blank the display. Tie LT and BI HIGH and LE LOW for normal use.',
    keywords: ['cd4511', '4511', 'bcd', 'seven segment decoder', 'decoder driver', '7 segment'],
    ...d,
    states: [
      { name: 'n', init: 0, next: `${b01('A')} + 2 * ${b01('B')} + 4 * ${b01('C')} + 8 * ${b01('D')}` },
      { name: 'nl', init: 0, next: `${H('LE')} ? nl : n` },
      { name: 'm', init: 0, next: masks.map((mk, i) => `nl == ${i} ? ${mk} : `).join('') + '0' },
    ],
    model: {
      elements: [
        ...segs.map((s, k) => dout(`O${s}`, s, `${LO('LT')} || (${H('BI')} && bit(m, ${k}) == 1)`, 'VCC', 'GND', 60)),
        ...hiz(['A', 'B', 'C', 'D', 'LT', 'BI', 'LE']),
        quiescent('VCC', 'GND', 1e6),
      ],
    },
    readouts: [{ label: 'BCD', value: 'nl', x: 30, y: 38, size: 3.6, color: '#555' }],
    warnings: [{ when: 'v(VCC, GND) > 18', level: 'error', message: '4000-series CMOS is rated to 18 V.' }],
  };
})();

const counter393: Raw = (() => {
  const names = ['CP1', 'MR1', 'Q01', 'Q11', 'Q21', 'Q31', 'GND', 'Q32', 'Q22', 'Q12', 'Q02', 'MR2', 'CP2', 'VCC'];
  const d = dip(names, {
    label: '74HC393', sub: 'dual 4-bit counter',
    labels: Object.fromEntries([1, 2].flatMap((n) => [[`CP${n}`, `${n} clock (counts on the falling edge)`], [`MR${n}`, `${n} reset (HIGH = clear)`], ...[0, 1, 2, 3].map((b) => [`Q${b}${n}`, `${n} Q${b} (${1 << b}s)`])])),
  });
  const ctr = (n: number) => [
    // falling edges = rising edges seen so far, minus one while the clock is still HIGH; r = count at the last reset
    { name: `r${n}`, init: 0, next: `${H(`MR${n}`)} ? edges(CP${n}) : r${n}` },
    { name: `c${n}`, init: 0, next: `mod(max(0, edges(CP${n}) - r${n} - ${b01(`CP${n}`)}), 16)` },
  ];
  return {
    type: '74hc393', name: '74HC393 dual 4-bit binary counter', category: 'logic',
    description: 'Two ripple counters that count 0–15 in binary on the falling edge of their clock. Q0 toggles at half the clock rate, Q3 at 1/16 — a frequency divider, or chain Q3 of one into the clock of the other to count to 255. MR HIGH clears to 0.',
    keywords: ['74hc393', '74393', 'counter', 'binary counter', 'divider', 'ripple counter'],
    ...d,
    states: [...ctr(1), ...ctr(2)],
    model: {
      elements: [
        ...[1, 2].flatMap((n) => [0, 1, 2, 3].map((b) => dout(`O${b}${n}`, `Q${b}${n}`, `bit(c${n}, ${b}) == 1`))),
        ...hiz(['CP1', 'MR1', 'CP2', 'MR2']),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    readouts: [{ value: 'c1 * 100 + c2', x: 25, y: 38, size: 3.4, color: '#555' }],
    warnings: hcWarn,
  };
})();

const adder283: Raw = (() => {
  const names = ['S2', 'B2', 'A2', 'S1', 'A1', 'B1', 'CI', 'GND', 'CO', 'S4', 'B4', 'A4', 'S3', 'A3', 'B3', 'VCC'];
  const d = dip(names, { label: '74HC283', sub: '4-bit adder', labels: { CI: 'Carry in', CO: 'Carry out (16s)', ...Object.fromEntries([1, 2, 3, 4].flatMap((n) => [[`A${n}`, `A${n} (${1 << (n - 1)}s)`], [`B${n}`, `B${n} (${1 << (n - 1)}s)`], [`S${n}`, `Sum ${n} (${1 << (n - 1)}s)`]])) } });
  const num = (p: string) => [1, 2, 3, 4].map((n) => `${1 << (n - 1)} * ${b01(`${p}${n}`)}`).join(' + ');
  return {
    type: '74hc283', name: '74HC283 4-bit binary full adder', category: 'logic',
    description: 'Adds two 4-bit numbers A and B plus a carry-in: S1–S4 is the 4-bit sum and CO the carry (sum ≥ 16). Chain CO into the next chip\'s CI for 8, 12, 16 bits — the heart of a home-made calculator or ALU.',
    keywords: ['74hc283', '74283', 'adder', 'full adder', 'binary addition', 'alu', 'arithmetic'],
    ...d,
    states: [
      { name: 'a', init: 0, next: num('A') },
      { name: 'b', init: 0, next: num('B') },
      { name: 'sum', init: 0, next: `a + b + ${b01('CI')}` },
    ],
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => dout(`OS${n}`, `S${n}`, `bit(sum, ${n - 1}) == 1`)),
        dout('OC', 'CO', 'bit(sum, 4) == 1'),
        ...hiz(['CI', ...[1, 2, 3, 4].flatMap((n) => [`A${n}`, `B${n}`])]),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    readouts: [{ label: 'Σ', value: 'sum', x: 30, y: 38, size: 3.6, color: '#555' }],
    warnings: hcWarn,
  };
})();

const bus245: Raw = (() => {
  const n8 = [1, 2, 3, 4, 5, 6, 7, 8];
  const names = ['DIR', ...n8.map((n) => `A${n}`), 'GND', ...[...n8].reverse().map((n) => `B${n}`), 'OE', 'VCC'];
  const d = dip(names, { label: '74HC245', sub: 'octal bus transceiver', labels: { DIR: 'Direction (HIGH = A→B, LOW = B→A)', OE: 'Output enable (active LOW)' } });
  return {
    type: '74hc245', name: '74HC245 octal bus transceiver', category: 'logic',
    description: 'Eight bidirectional buffers: with OE̅ LOW, DIR HIGH copies A to B and DIR LOW copies B to A; with OE̅ HIGH both sides float. Buffers a data bus, drives many LEDs, or connects two buses that must take turns.',
    keywords: ['74hc245', '74245', 'transceiver', 'bus buffer', 'bidirectional', 'octal buffer', 'line driver'],
    ...d,
    model: {
      elements: [
        ...n8.flatMap((n) => [...tri(`TB${n}`, `B${n}`, H(`A${n}`), `${H('DIR')} && ${LO('OE')}`), ...tri(`TA${n}`, `A${n}`, H(`B${n}`), `${LO('DIR')} && ${LO('OE')}`)]),
        ...hiz(['DIR', 'OE', ...n8.flatMap((n) => [`A${n}`, `B${n}`])]),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    warnings: hcWarn,
  };
})();

// ---------------------------------------------------------------- analog ICs

const lm311: Raw = (() => {
  const d = dip(['GND', 'P', 'N', 'VEE', 'BAL', 'STB', 'OUT', 'VCC'], {
    label: 'LM311P', sub: 'comparator',
    labels: { GND: 'Ground / emitter of the output transistor', P: 'Input +', N: 'Input −', VEE: 'V− (GND or a negative rail)', BAL: 'Balance', STB: 'Balance / strobe', OUT: 'Output (open collector — add a pull-up)', VCC: 'V+ (5–30 V)' },
  });
  return {
    type: 'lm311', name: 'LM311 fast comparator', category: 'ics',
    description: 'A single, fast comparator: its open-collector output pulls LOW whenever IN+ is below IN−, so add a pull-up resistor (to any voltage up to 50 V). Zero-crossing detectors, level alarms, square-wave shapers.',
    keywords: ['lm311', 'comparator', 'open collector', 'zero crossing', 'level detector'],
    ...d,
    model: { elements: [{ id: 'C', kind: 'comparator', p: 'P', n: 'N', out: 'OUT', vee: 'GND' }, ...hiz(['P', 'N', 'BAL', 'STB']), { id: 'RV', kind: 'resistor', a: 'VEE', b: 'GND', value: 1e6 }, quiescent('VCC', 'VEE', 3000)] },
    warnings: [{ when: 'v(VCC, VEE) > 36', level: 'error', message: 'Total supply above 36 V.' }],
  };
})();

const mcp6002: Raw = (() => {
  const d = dip(['O1', 'N1', 'P1', 'GND', 'P2', 'N2', 'O2', 'VCC'], {
    label: 'MCP6002', sub: 'rail-to-rail',
    labels: { O1: 'Output A', N1: 'Input A −', P1: 'Input A +', GND: 'V− / GND', P2: 'Input B +', N2: 'Input B −', O2: 'Output B', VCC: 'V+ (1.8–6 V)' },
  });
  return {
    type: 'mcp6002', name: 'MCP6002 dual rail-to-rail op-amp', category: 'ics',
    description: 'A low-voltage (1.8–6 V) op-amp whose inputs and output reach both supply rails — the right choice for 3.3 V boards like the ESP32 or Pico, where an LM358 would lose over a volt at the top.',
    keywords: ['mcp6002', 'mcp6001', 'rail to rail', 'op-amp', 'opamp', '3.3v op amp', 'low voltage'],
    ...d,
    model: {
      elements: [
        { id: 'A', kind: 'opamp', p: 'P1', n: 'N1', out: 'O1', vcc: 'VCC', vee: 'GND', railToRail: true },
        { id: 'B', kind: 'opamp', p: 'P2', n: 'N2', out: 'O2', vcc: 'VCC', vee: 'GND', railToRail: true },
        ...hiz(['P1', 'N1', 'P2', 'N2']),
        quiescent('VCC', 'GND', 50000),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 6.5', level: 'error', message: 'The MCP6002 is rated to 6 V.' }],
  };
})();

const ht7333: Raw = {
  type: 'ht7333', name: 'HT7333 3.3 V LDO (TO-92)', category: 'power',
  description: 'A tiny 3.3 V regulator with only ~0.1 V dropout and 4 µA quiescent current — ideal to run a 3.3 V sensor or ESP from a Li-ion cell or 3 AA batteries. Up to 250 mA. Pinout GND – IN – OUT.',
  keywords: ['ht7333', 'ldo', '3.3v', 'regulator', 'low dropout', 'to-92', 'low quiescent'],
  ...to92(['GND', 'IN', 'OUT'], 'HT7333', COL.ic, { GND: 'Ground', IN: 'Input (≤ 12 V)', OUT: '3.3 V out' }),
  model: { nodes: ['B'], elements: linearReg('min(4.0, max(0, v(IN, GND) + 0.6))', 3000) },
  warnings: [{ when: 'i(Q) > 0.25', level: 'error', message: 'Output current above 250 mA.' }, { when: 'v(IN, OUT) * i(Q) > 0.5', level: 'warn', message: 'Dissipating more than 0.5 W — a TO-92 overheats.' }, { when: 'v(IN, GND) > 12', level: 'error', message: 'Input above 12 V.' }],
};

const uln2803: Raw = (() => {
  const n8 = [1, 2, 3, 4, 5, 6, 7, 8];
  const names = [...n8.map((n) => `I${n}`), 'GND', 'COM', ...[...n8].reverse().map((n) => `O${n}`)];
  const d = dip(names, { label: 'ULN2803A', sub: '8× Darlington', labels: { COM: 'COM (to the load supply, for the flyback diodes)', ...Object.fromEntries(n8.flatMap((n) => [[`I${n}`, `Input ${n}`], [`O${n}`, `Output ${n} (sinks up to 500 mA)`]])) } });
  return {
    type: 'uln2803', name: 'ULN2803 8-channel Darlington driver', category: 'drivers',
    description: 'Eight Darlington transistors with built-in flyback diodes: a HIGH input makes its output sink current to GND (≈1 V drop, up to 500 mA). Drives relays, solenoids, LED strips and unipolar steppers from logic pins — load between + supply and O, COM to that supply.',
    keywords: ['uln2803', 'uln2804', 'darlington array', 'driver', 'relay driver', 'sink driver', 'transistor array'],
    ...d,
    model: {
      elements: [
        ...n8.flatMap((n) => [
          contact(`Q${n}`, `O${n}`, 'GND', `v(I${n}, GND) > 1.4`, 2),
          { id: `RI${n}`, kind: 'resistor', a: `I${n}`, b: 'GND', value: 10000 },
          { id: `DF${n}`, kind: 'diode', a: `O${n}`, k: 'COM', model: 'silicon' },
        ]),
      ],
    },
    warnings: [{ when: n8.map((n) => `i(Q${n}) > 0.5`).join(' || '), level: 'error', message: 'An output sinks more than 500 mA.' }],
  };
})();

// ---------------------------------------------------------------- discretes

const mos2n7000: Raw = {
  type: '2n7000', name: 'Small-signal MOSFET (2N7000)', category: 'transistors',
  description: 'A little N-channel MOSFET in a TO-92 case: turns on from ~2 V on the gate and switches up to 200 mA — LEDs, small relays, level shifting. Pinout S – G – D (flat side facing you). Add a 100 kΩ gate pull-down so it stays off when the pin floats.',
  keywords: ['2n7000', 'bs170', 'mosfet', 'n-channel', 'small signal', 'to-92', 'level shifter'],
  ...to92(['S', 'G', 'D'], '2N7000', COL.ic, { S: 'Source', G: 'Gate', D: 'Drain' }),
  model: { elements: [{ id: 'M', kind: 'nmos', d: 'D', g: 'G', s: 'S', vth: 2.1, k: 0.3 }, { id: 'BD', kind: 'diode', a: 'S', k: 'D', model: 'silicon' }, { id: 'RG', kind: 'resistor', a: 'G', b: 'S', value: 1e9 }] },
  warnings: [{ when: 'i(M) > 0.2', level: 'error', message: 'Drain current above 200 mA.' }, { when: 'abs(v(G, S)) > 20', level: 'error', message: 'Gate voltage above ±20 V.' }],
};

const germanium: Raw = {
  type: 'germanium-diode', name: 'Germanium diode (1N34A)', category: 'diodes',
  description: 'An old-school germanium point-contact diode: it starts conducting at only ~0.3 V, so it can detect tiny radio signals — the diode of every crystal radio. Only for small currents (under 50 mA). The band is the cathode.',
  keywords: ['germanium', '1n34a', '1n60', 'crystal radio', 'detector diode', 'low forward voltage'],
  ...axial(['A', 'K'], [
    rect(12, -3.6, 16, 7.2, '#f2e6c6', { rx: 3.4, grad: '#c9a978', opacity: 0.85, stroke: '#b89a60', strokeWidth: 0.4, shadow: 0.6 }),
    rect(24, -3.6, 2.4, 7.2, '#26282c'), line(14, 0, 24, 0, '#8a6a2a', 0.8), rect(14, -2.6, 10, 1, '#ffffff', { opacity: 0.4, rx: 0.5 }),
  ], { A: 'Anode', K: 'Cathode (band)' }),
  model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'schottky' }, { id: 'RL', kind: 'resistor', a: 'A', b: 'K', value: 2e6 }] },
  warnings: [{ when: 'i(D) > 0.05', level: 'error', message: 'More than 50 mA — germanium signal diodes are fragile.' }],
};

const dome = (color: string, r: number, h: number, cx: number): Raw[] => [
  rect(cx - r - 1.5, -9.5 - 3, 2 * r + 3, 3.4, shade(color, 0.1), { rx: 1, grad: shade(color, -0.3), opacity: 0.97 }),
  path(`M${cx - r} -11 L${cx - r} ${-11 - h} A${r} ${r} 0 0 1 ${cx + r} ${-11 - h} L${cx + r} -11 Z`, shade(color, 0.3), { grad: shade(color, -0.3), gradDir: 'h', opacity: 0.93, stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.5, shadow: 0.6 }),
  rect(cx - r * 0.55, -12 - h - r * 0.5, 2.2, h + r * 0.4, '#ffffff', { opacity: 0.4, rx: 1 }),
];
const domePath = (r: number, h: number, cx: number) => ({ type: 'path', d: `M${cx - r} -11 L${cx - r} ${-11 - h} A${r} ${r} 0 0 1 ${cx + r} ${-11 - h} L${cx + r} -11 Z` });

const led10: Raw = {
  type: 'led-10mm', name: 'Jumbo LED (10 mm, red)', category: 'diodes',
  description: 'A big 10 mm LED — same wiring as a 5 mm one (long leg +, ~220 Ω resistor from a 5 V pin, 20 mA), just much easier to see across a room.',
  keywords: ['10mm led', 'jumbo led', 'big led', 'large led', 'led'],
  pins: pinRow(['A', 'K'], { labels: { A: 'Anode (+, long leg)', K: 'Cathode (−)' } }),
  shapes: [...legs(pinRow(['A', 'K']), -10), ...dome('#e0453d', 10.5, 14, 5)],
  indicators: [{ shape: { ...domePath(10.5, 14, 5), fill: '#ff2a1a' }, color: '#ff2a1a', level: 'clamp(i(D) / 0.015, 0, 1)' }],
  model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'led', vf: 1.95 }] },
  warnings: [{ when: 'i(D) > 0.03', level: 'error', message: 'More than 30 mA — add a series resistor.' }],
};

const flashingLed: Raw = {
  type: 'flashing-led', name: 'Self-flashing LED (5 mm)', category: 'diodes',
  description: 'An LED with a tiny oscillator chip inside: power it (3–5 V through ~100 Ω) and it blinks by itself about twice a second — no code, no 555. Long leg +.',
  keywords: ['flashing led', 'blinking led', 'self blinking', 'flasher', 'led'],
  pins: pinRow(['A', 'K'], { labels: { A: 'Anode (+, long leg)', K: 'Cathode (−)' } }),
  shapes: [...legs(pinRow(['A', 'K']), -10), ...dome('#f2c230', 8, 10, 5), rect(3.5, -15, 3, 2, '#2a2c30', { rx: 0.4 })],
  indicators: [{ shape: { ...domePath(8, 10, 5), fill: '#ffcf1a' }, color: '#ffcf1a', level: 'clamp(i(D) / 0.012, 0, 1)' }],
  model: {
    nodes: ['M'],
    elements: [
      contact('OSC', 'A', 'M', 'mod(t, 0.6) < 0.3', 5),
      { id: 'D', kind: 'diode', a: 'M', k: 'K', model: 'led', vf: 2.0 },
      { id: 'IC', kind: 'resistor', a: 'A', b: 'K', value: 50000 },
    ],
  },
  warnings: [{ when: 'i(D) > 0.03', level: 'error', message: 'More than 30 mA — add a series resistor.' }],
};

const ledStrip: Raw = (() => {
  const xs = [14, 38, 62];
  return {
    type: 'led-strip-12v', name: 'LED strip segment (12 V, white)', category: 'diodes',
    description: 'One cuttable 3-LED segment of a plain (non-addressable) 12 V strip: three 5050 LEDs and a resistor in series, so it goes straight on 12 V (~20 mA per segment) — dim it with PWM through a MOSFET. Below ~9 V it stays dark.',
    keywords: ['led strip', '12v led strip', '5050', 'led tape', 'analog strip', 'lighting'],
    pins: pinRow(['P', 'N'], { labels: { P: '+12 V', N: '− (to the MOSFET / GND)' } }),
    shapes: [
      line(0, 0, 0, -8, '#d63c35', 1.6), line(10, 0, 10, -8, '#26282c', 1.6),
      rect(-4, -18, 82, 11, '#f4f5f1', { rx: 0.6, grad: '#d9dcd4', shadow: 0.8, stroke: '#c7cac2', strokeWidth: 0.4 }),
      rect(-3, -16.5, 5, 3, '#e8c26a', { rx: 0.5 }), rect(-3, -12, 5, 3, '#e8c26a', { rx: 0.5 }), silk(5, -13.5, '+12V', 2.2, 'start', '#6b6b6b'),
      ...xs.flatMap((x) => [rect(x - 4, -16.5, 8, 8, '#fbfbf6', { rx: 0.6, stroke: '#c9ccc4', strokeWidth: 0.5 }), circle(x, -12.5, 3.2, '#f2e7a8', { grad: '#d9c86a', gradDir: 'r' })]),
      ...smd(50, -12.5, 'r'), line(75, -18, 75, -7, '#9aa0a6', 0.4),
    ],
    indicators: xs.map((x) => ({ shape: circle(x, -12.5, 4.2, '#fffbe8'), color: '#fff4c4', level: 'clamp(i(R) / 0.018, 0, 1)' })),
    model: {
      nodes: ['M1', 'M2', 'M3'],
      elements: [
        { id: 'D1', kind: 'diode', a: 'P', k: 'M1', model: 'led', vf: 3.0 },
        { id: 'D2', kind: 'diode', a: 'M1', k: 'M2', model: 'led', vf: 3.0 },
        { id: 'D3', kind: 'diode', a: 'M2', k: 'M3', model: 'led', vf: 3.0 },
        { id: 'R', kind: 'resistor', a: 'M3', b: 'N', value: 150 },
      ],
    },
    warnings: [{ when: 'v(P, N) > 14', level: 'error', message: 'Above 12 V — the segment overheats.' }],
  };
})();

const dualPot: Raw = (() => {
  const ids = ['A1', 'AW', 'A2', 'B1', 'BW', 'B2'];
  return {
    type: 'dual-pot', name: 'Dual-gang potentiometer (stereo)', category: 'passive',
    description: 'Two identical potentiometers on one shaft — turn the knob and both wipers move together. The classic stereo volume control (one gang per channel), or two linked settings from one knob. Drag the knob while simulating.',
    keywords: ['dual potentiometer', 'dual gang', 'stereo pot', 'volume control', 'ganged pot'],
    pins: pinRow(ids, { labels: { A1: 'Gang A end 1', AW: 'Gang A wiper', A2: 'Gang A end 2', B1: 'Gang B end 1', BW: 'Gang B wiper', B2: 'Gang B end 2' } }),
    props: [
      { key: 'r', label: 'Resistance', type: 'number', default: 10000, unit: 'Ω', min: 10 },
      { key: 'pos', label: 'Position', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
    drag: 'pos',
    shapes: [
      ...pinRow(ids).map((p) => pinLeg(p.x, -9)),
      rect(-6, -34, 62, 26, '#3a7f4e', { rx: 1.5, grad: '#1f4a2c', gradDir: 'd', shadow: 1 }),
      rect(-6, -34, 30, 26, '#e3e7eb', { rx: 1.5, grad: '#8a929b', gradDir: 'd', opacity: 0.55 }),
      line(24, -34, 24, -8, '#0f2a18', 0.8),
      circle(25, -21, 10, '#2d2f33', { grad: '#111214', gradDir: 'd', shadow: 1 }),
      ...Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * 6.28318; return line(25 + Math.cos(a) * 8.3, -21 + Math.sin(a) * 8.3, 25 + Math.cos(a) * 10, -21 + Math.sin(a) * 10, '#4a4d53', 0.6); }),
    ],
    animations: [{ shape: rect(24, -29.5, 2, 6.5, '#e7eaee', { rx: 0.8 }), rotate: '-135 + pos * 270', cx: 25, cy: -21 }],
    model: {
      elements: [
        { id: 'AA', kind: 'rvar', a: 'A1', b: 'AW', value: 'max(0.5, r * pos)' }, { id: 'AB', kind: 'rvar', a: 'AW', b: 'A2', value: 'max(0.5, r * (1 - pos))' },
        { id: 'BA', kind: 'rvar', a: 'B1', b: 'BW', value: 'max(0.5, r * pos)' }, { id: 'BB', kind: 'rvar', a: 'BW', b: 'B2', value: 'max(0.5, r * (1 - pos))' },
      ],
    },
  };
})();

// ---------------------------------------------------------------- switches

const arcadeButton: Raw = {
  type: 'arcade-button', name: 'Arcade button (30 mm, with LED)', category: 'switches',
  description: 'A chunky arcade push button with a light inside: C–NO close while it is held; the LED (LA +, LK −) has its resistor built in for 5 V. Read C/NO with INPUT_PULLUP and light the LED from another pin. Press it while simulating.',
  keywords: ['arcade button', 'big button', 'led button', 'game button', 'push button', 'illuminated button'],
  pins: pinRow(['C', 'NO', 'LA', 'LK'], { labels: { C: 'Switch common', NO: 'Switch normally open', LA: 'LED + (5 V, resistor built in)', LK: 'LED −' } }),
  interactive: 'press',
  shapes: [
    ...pinRow(['C', 'NO', 'LA', 'LK']).map((p) => pinLeg(p.x, -10)),
    rect(-6, -18, 42, 9, '#2d2f33', { rx: 1, grad: '#141517', shadow: 0.8 }),
    rect(-2, -21, 34, 4, '#e7eaee', { rx: 1, grad: '#9aa3ad' }),
    { type: 'ellipse', cx: 15, cy: -24, rx: 21, ry: 4.5, fill: '#b82a24', grad: '#6e1612', gradDir: 'h', shadow: 1 },
  ],
  animations: [
    { shape: { type: 'ellipse', cx: 15, cy: -30, rx: 16, ry: 6, fill: '#f24a3d', grad: '#9e2721', gradDir: 'r', stroke: '#7e1c17', strokeWidth: 0.5 }, dy: 'pressed == 1 ? 3 : 0' },
    { shape: { type: 'ellipse', cx: 11, cy: -32, rx: 6, ry: 1.8, fill: '#ffffff', opacity: 0.35 }, dy: 'pressed == 1 ? 3 : 0' },
  ],
  indicators: [{ shape: { type: 'ellipse', cx: 15, cy: -29, rx: 16, ry: 6, fill: '#ff6a5a' }, color: '#ff4a3a', level: 'clamp(i(DL) / 0.012, 0, 1)' }],
  model: {
    nodes: ['LM'],
    elements: [contact('S', 'C', 'NO', 'pressed == 1'), { id: 'RL', kind: 'resistor', a: 'LA', b: 'LM', value: 220 }, { id: 'DL', kind: 'diode', a: 'LM', k: 'LK', model: 'led', vf: 1.9 }],
  },
};

const keySwitch: Raw = {
  type: 'key-switch', name: 'Mechanical keyboard switch (MX style)', category: 'switches',
  description: 'The switch under a mechanical keyboard key: the two pins connect while the stem is pressed (~2 mm travel). Wire one pin to GND and the other to an INPUT_PULLUP pin; debounce in code. Press it while simulating.',
  keywords: ['key switch', 'cherry mx', 'mechanical keyboard', 'keyboard switch', 'macropad', 'gateron'],
  pins: pinRow(['1', '2'], { step: 20 }),
  interactive: 'press',
  shapes: [
    ...pinRow(['1', '2'], { step: 20 }).map((p) => pinLeg(p.x, -8)),
    rect(-6, -22, 32, 14, '#2d2f33', { rx: 1.5, grad: '#141517', shadow: 1 }),
    rect(-4, -30, 28, 9, '#e7eaee', { rx: 1.5, grad: '#c4ccd4', gradDir: 'v', opacity: 0.9 }),
    reach(4, -40, 12, 10),
  ],
  animations: [
    { shape: path('M 7.5 -38 L 12.5 -38 L 12.5 -35.5 L 15 -35.5 L 15 -33.5 L 12.5 -33.5 L 12.5 -30 L 7.5 -30 L 7.5 -33.5 L 5 -33.5 L 5 -35.5 L 7.5 -35.5 Z', '#d63c35', { stroke: '#8a1f1a', strokeWidth: 0.4 }), dy: 'pressed == 1 ? 4 : 0' },
  ],
  model: { elements: [contact('S', '1', '2', 'pressed == 1')] },
};

const slide3: Raw = {
  type: 'slide-switch-3', name: 'Slide switch (3-position, SP3T)', category: 'switches',
  description: 'A slider with three positions: the common pin (C) connects to 1, 2 or 3 depending on where the knob sits — a mode selector (e.g. off / slow / fast). Drag it sideways while simulating.',
  keywords: ['slide switch', '3 position', 'sp3t', 'selector', 'mode switch'],
  pins: pinRow(['1', '2', '3', 'C'], { labels: { C: 'Common' } }),
  props: [{ key: 'pos', label: 'Position', type: 'slider', default: 0, min: 0, max: 2, step: 1 }],
  drag: 'pos',
  shapes: [
    ...pinRow(['1', '2', '3', 'C']).map((p) => pinLeg(p.x, -8)),
    rect(-6, -20, 42, 12, '#dfe3e7', { rx: 1, grad: '#8a929b', gradDir: 'd', shadow: 1, stroke: '#6b737c', strokeWidth: 0.4 }),
    rect(-2, -17, 26, 6, '#2d2f33', { rx: 0.8 }),
    silk(1, -22, '1', 2.6, 'middle', '#555'), silk(11, -22, '2', 2.6, 'middle', '#555'), silk(21, -22, '3', 2.6, 'middle', '#555'),
  ],
  animations: [{ shape: rect(-2, -18, 6, 8, '#111214', { rx: 0.8, grad: '#3a3d42', gradDir: 'h' }), dx: 'round(pos) * 10' }],
  model: { elements: [contact('S1', 'C', '1', 'round(pos) == 0'), contact('S2', 'C', '2', 'round(pos) == 1'), contact('S3', 'C', '3', 'round(pos) == 2')] },
};

const doorSensor: Raw = {
  type: 'door-sensor', name: 'Magnetic door / window sensor (MC-38)', category: 'switches',
  description: 'A reed switch in a white case plus a separate magnet: screw one to the frame and one to the door. The wires are connected while the magnet is next to it (door closed) and open when the door opens. Click to open / close the door while simulating.',
  keywords: ['door sensor', 'mc-38', 'window sensor', 'magnetic contact', 'reed', 'alarm', 'security'],
  pins: pinRow(['1', '2']),
  props: [{ key: 'closed', label: 'Door', type: 'select', default: 1, options: [{ value: 1, label: 'Closed (magnet near)' }, { value: 0, label: 'Open' }] }],
  toggle: 'closed',
  shapes: [
    line(0, 0, 0, -10, '#26282c', 1.4), line(10, 0, 10, -10, '#26282c', 1.4),
    rect(-6, -34, 22, 24, '#f4f5f1', { rx: 2, grad: '#c9ccc4', gradDir: 'h', shadow: 1, stroke: '#b3b6ae', strokeWidth: 0.4 }),
    circle(5, -30, 1.4, '#9aa0a6'), circle(5, -14, 1.4, '#9aa0a6'),
    reach(18, -34, 26, 24),
  ],
  animations: [{ shape: rect(20, -34, 10, 24, '#f4f5f1', { rx: 2, grad: '#c9ccc4', gradDir: 'h', shadow: 1, stroke: '#b3b6ae', strokeWidth: 0.4 }), dx: 'closed == 1 ? 0 : 14' }],
  model: { elements: [contact('S', '1', '2', 'closed == 1', 0.2)] },
};

const estop: Raw = {
  type: 'e-stop', name: 'Emergency stop button (latching, NC)', category: 'switches',
  description: 'A big red mushroom button: its normally-closed contact opens when hit and stays open (latched) until the head is twisted to release it. Put it in series with the motor / heater supply, not just a microcontroller input. Click it while simulating.',
  keywords: ['emergency stop', 'e-stop', 'estop', 'kill switch', 'mushroom button', 'safety', 'latching'],
  pins: pinRow(['1', '2'], { step: 20, kind: 'terminal' }),
  props: [{ key: 'hit', label: 'Button', type: 'select', default: 0, options: [{ value: 0, label: 'Released (circuit closed)' }, { value: 1, label: 'Pressed (circuit open)' }] }],
  toggle: 'hit',
  shapes: [
    ...pinRow(['1', '2'], { step: 20 }).map((p) => pinLeg(p.x, -8)),
    rect(-10, -24, 40, 16, '#f2c230', { rx: 2, grad: '#b8901c', gradDir: 'd', shadow: 1 }),
    silk(10, -12, 'EMERGENCY STOP', 2.4, 'middle', '#2a2c30'),
    rect(3, -30, 14, 7, '#2d2f33', { rx: 1, grad: '#111214', gradDir: 'h' }),
    reach(-6, -44, 32, 14),
  ],
  animations: [
    { shape: path('M -6 -32 C -6 -46 26 -46 26 -32 Z', '#e0453d', { grad: '#8a1f1a', gradDir: 'd', stroke: '#6e1612', strokeWidth: 0.5, shadow: 1 }), dy: 'hit == 1 ? 3 : 0' },
    { shape: { type: 'ellipse', cx: 4, cy: -39, rx: 5, ry: 1.8, fill: '#ffffff', opacity: 0.35 }, dy: 'hit == 1 ? 3 : 0' },
  ],
  model: { elements: [contact('S', '1', '2', 'hit == 0', 0.02)] },
};

const ttp224: Raw = (() => {
  const b = moduleBoard(['VCC', 'GND', 'O1', 'O2', 'O3', 'O4'], { h: 40, w: 70, color: COL.pcbRed, holes: 'none', labels: { VCC: '+2.4–5.5 V', O1: 'Out 1 (HIGH while pad 1 touched)', O2: 'Out 2', O3: 'Out 3', O4: 'Out 4' } });
  const pads = [1, 2, 3, 4];
  // pad centres spread across the 70-wide board (x −10 … 60)
  const px = (k: number) => -6 + (k - 1) * 17.5;
  return {
    type: 'touch-4key', name: '4-key capacitive touch module (TTP224)', category: 'switches',
    description: 'Four touch pads on one board, each with its own output that goes HIGH while its pad is touched (no pull-ups needed). Drag sideways to move your finger over a pad, hold to touch it.',
    keywords: ['ttp224', 'touch', '4 key touch', 'capacitive', 'touch pad', 'touch buttons'],
    pins: b.pins,
    props: [{ key: 'key', label: 'Pad under the finger', type: 'slider', default: 1, min: 1, max: 4, step: 1 }],
    drag: 'key', interactive: 'press',
    shapes: [
      ...b.shapes,
      ...pads.flatMap((k) => [circle(px(k) + 5, -30, 7.2, '#e8c26a', { grad: '#b88f2a', gradDir: 'r', stroke: '#9c7a22', strokeWidth: 0.5 }), silk(px(k) + 5, -28.5, String(k), 4, 'middle', '#6b4f12')]),
    ],
    indicators: [
      ...pads.map((k) => ({ shape: circle(px(k) + 5, -30, 7.2, '#ffffff'), color: '#ffffff', level: `round(key) == ${k} ? (pressed == 1 ? 0.5 : 0.15) : 0` })),
      ...pads.map((k) => statusLed(px(k) + 5, -18, '#ff3b30', `pressed == 1 && round(key) == ${k} ? 1 : 0`).indicator),
    ],
    model: { elements: [...pads.map((k) => dout(`O${k}`, `O${k}`, `pressed == 1 && round(key) == ${k}`, 'VCC', 'GND', 200)), quiescent('VCC', 'GND', 1e5)] },
  };
})();
ttp224.shapes.push(...[1, 2, 3, 4].map((k) => statusLed(-1 + (k - 1) * 17.5, -18, '#ff3b30', '0').shape));

// ---------------------------------------------------------------- sensors

const temt6000: Raw = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SIG'], { h: 30, color: COL.pcbBlue, title: 'TEMT6000', titleY: -16, titleSize: 2.8, labels: { VCC: '+3.3–5 V', SIG: 'Analog out (≈ 5 mV per lux)' } });
  return {
    type: 'temt6000', name: 'Ambient light sensor (TEMT6000)', category: 'sensors',
    description: 'A phototransistor tuned to the human eye with a 10 kΩ load: SIG ≈ 5 mV per lux, so it reads indoor light levels (0–1000 lx) straight into analogRead. Set the light level while simulating.',
    keywords: ['temt6000', 'ambient light', 'light sensor', 'lux', 'brightness'],
    pins: b.pins,
    props: [{ key: 'lux', label: 'Light', type: 'slider', default: 200, min: 0, max: 1200, step: 1, unit: 'lx' }],
    drag: 'lux',
    shapes: [...b.shapes, rect(6, -26, 8, 5, '#eef1f4', { rx: 0.6, grad: '#9aa3ad' }), rect(8, -25, 4, 3, '#1a1b1e', { rx: 0.4 }), ...smd(22, -23, 'r')],
    readouts: [{ value: 'lux', unit: 'lx', x: 10, y: -38, size: 4 }],
    model: { elements: [{ id: 'O', kind: 'vsource', p: 'SIG', n: 'GND', value: 'v(VCC, GND) > 2 ? min(v(VCC, GND) - 0.1, lux * 0.005) : 0', r: 10000 }, quiescent('VCC', 'GND', 1e5)] },
  };
})();

const rcwl0516: Raw = (() => {
  const b = moduleBoard(['V3', 'GND', 'OUT', 'VIN', 'CDS'], { h: 40, color: COL.pcbBlue, holes: 'none', labels: { V3: '3V3 out (up to 100 mA)', OUT: 'OUT (3.3 V for ~2 s after motion)', VIN: 'VIN (4–28 V)', CDS: 'CDS (LDR input, leave open)' } });
  return {
    type: 'rcwl-0516', name: 'Microwave radar motion sensor (RCWL-0516)', category: 'sensors',
    description: 'Doppler radar at 3.2 GHz: it sees movement up to ~7 m, even through thin walls or a plastic case, and sets OUT HIGH (3.3 V) for about 2 s after the last movement. Power it from VIN (4–28 V). Press it to walk past it while simulating.',
    keywords: ['rcwl-0516', 'microwave', 'radar', 'motion sensor', 'doppler', 'presence'],
    pins: b.pins, interactive: 'press',
    shapes: [
      ...b.shapes,
      path('M -2 -38 L 42 -38 L 42 -34 L 2 -34 L 2 -26 L 38 -26 L 38 -22 L -2 -22 Z', 'none', { stroke: '#e3c25e', strokeWidth: 1.2 }),
      ...chip(12, -32, 8, 5, { n: 4, label: '' }), ...smdRow(22, -30, 3, 4.5),
    ],
    states: [{ name: 'tm', init: -100, next: 'pressed == 1 ? t : tm' }],
    indicators: [{ shape: rect(-3, -39, 46, 18, '#6ab8ff', { rx: 1 }), color: '#6ab8ff', level: '(t - tm < 2) ? 0.25 : 0' }],
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: '(v(VIN, GND) > 3.8 && t - tm < 2) ? 3.3 : 0', r: 300 },
        { id: 'R3', kind: 'vsource', p: 'V3', n: 'GND', value: 'v(VIN, GND) > 3.8 ? 3.3 : 0', r: 2 },
        quiescent('VIN', 'GND', 1200),
        ...hiz(['CDS']),
      ],
    },
  };
})();

const sharpIr: Raw = {
  type: 'sharp-ir', name: 'IR distance sensor (Sharp GP2Y0A21)', category: 'sensors',
  description: 'Measures distance with a triangulating IR beam (10–80 cm): VO is an analog voltage that falls as the object gets further (~2.3 V at 10 cm, ~0.4 V at 80 cm; not linear — fit a curve). Needs 5 V and a 10 µF capacitor nearby. Set the distance while simulating.',
  keywords: ['sharp ir', 'gp2y0a21', 'distance sensor', 'ir rangefinder', 'proximity', 'analog distance'],
  pins: pinRow(['VO', 'GND', 'VCC'], { labels: { VO: 'Vo (yellow, analog)', GND: 'GND (black)', VCC: 'Vcc 5 V (red)' } }),
  props: [{ key: 'dist', label: 'Object distance', type: 'slider', default: 30, min: 10, max: 80, step: 1, unit: 'cm' }],
  drag: 'dist',
  shapes: [
    line(0, 0, 2, -12, '#f2c230', 1.4), line(10, 0, 10, -12, '#26282c', 1.4), line(20, 0, 18, -12, '#d63c35', 1.4),
    rect(-18, -30, 56, 18, '#2d2f33', { rx: 3, grad: '#111214', gradDir: 'd', shadow: 1 }),
    circle(-13, -21, 2.2, '#0a0a0b', { stroke: '#4a4d53', strokeWidth: 0.4 }), circle(33, -21, 2.2, '#0a0a0b', { stroke: '#4a4d53', strokeWidth: 0.4 }),
    rect(-6, -29, 12, 16, '#1c1d20', { rx: 3, stroke: '#3a3d42', strokeWidth: 0.4 }), rect(14, -29, 12, 16, '#1c1d20', { rx: 3, stroke: '#3a3d42', strokeWidth: 0.4 }),
    circle(0, -21, 4.2, '#3a2a5a', { grad: '#140f24', gradDir: 'r' }), circle(20, -21, 4.2, '#2a2a30', { grad: '#0c0c10', gradDir: 'r' }),
  ],
  readouts: [{ value: 'dist', unit: 'cm', x: 10, y: -34, size: 4 }],
  model: { elements: [{ id: 'O', kind: 'vsource', p: 'VO', n: 'GND', value: 'v(VCC, GND) > 4.2 ? min(3.1, 27 / pow(dist, 1.1)) : 0', r: 300 }, quiescent('VCC', 'GND', 170)] },
  warnings: [{ when: 'v(VCC, GND) > 7', level: 'error', message: 'The GP2Y0A21 is a 5 V sensor (max 7 V).' }],
};

const capSoil: Raw = (() => {
  const b = moduleBoard(['GND', 'VCC', 'AO'], { h: 100, w: 26, color: COL.pcbBlack, holes: 'none', labels: { VCC: '+3.3–5.5 V', AO: 'Analog out (dry ≈ 2.9 V, wet ≈ 1.3 V)' } });
  return {
    type: 'capacitive-soil', name: 'Capacitive soil moisture sensor (v1.2)', category: 'sensors',
    description: 'Measures moisture by capacitance through its coated blade — nothing exposed to corrode, unlike the fork probes. AO falls as the soil gets wetter (~2.9 V dry, ~1.3 V in water); calibrate the two ends in your pot. Set the moisture while simulating.',
    keywords: ['capacitive soil', 'soil moisture', 'moisture sensor v1.2', 'plant', 'corrosion resistant', 'watering'],
    pins: b.pins,
    props: [{ key: 'moist', label: 'Moisture', type: 'slider', default: 30, min: 0, max: 100, step: 1, unit: '%' }],
    drag: 'moist',
    shapes: [
      ...b.shapes,
      ...chip(3, -34, 14, 7, { n: 4, label: '555' }), ...smdRow(2, -22, 3, 5),
      line(-3, -54, 23, -54, '#f4f5f1', 0.6), silk(10, -60, 'v1.2', 2.8),
      silk(10, -80, 'Capacitive', 2.4), silk(10, -76, 'Soil Moisture', 2.4),
    ],
    readouts: [{ value: 'moist', unit: '%', x: 10, y: -112, size: 4 }],
    model: { elements: [{ id: 'O', kind: 'vsource', p: 'AO', n: 'GND', value: 'v(VCC, GND) > 3 ? 2.9 - 1.6 * moist / 100 : 0', r: 1000 }, quiescent('VCC', 'GND', 1000)] },
  };
})();

const loadCell: Raw = {
  type: 'load-cell', name: 'Load cell (5 kg, strain-gauge bridge)', category: 'sensors',
  description: 'An aluminium bar with four strain gauges in a Wheatstone bridge: power E+/E−, and the output A+ − A− changes by only ~1 mV per volt at full load — far too small for analogRead, so pair it with an HX711 or an instrumentation amp. Set the weight while simulating.',
  keywords: ['load cell', 'strain gauge', 'weight sensor', 'scale', 'wheatstone bridge', 'hx711', 'force'],
  pins: pinRow(['EP', 'EN', 'SP', 'SN'], { labels: { EP: 'E+ (red, excitation +)', EN: 'E− (black)', SP: 'A+ (green, signal +)', SN: 'A− (white, signal −)' } }),
  props: [{ key: 'kg', label: 'Weight', type: 'slider', default: 0, min: 0, max: 5, step: 0.01, unit: 'kg' }],
  drag: 'kg',
  shapes: [
    line(0, 0, 4, -14, '#d63c35', 1.3), line(10, 0, 8, -14, '#26282c', 1.3), line(20, 0, 12, -14, '#2cae4a', 1.3), line(30, 0, 16, -14, '#f4f5f1', 1.3),
    rect(-30, -30, 100, 16, '#dfe3e7', { rx: 1, grad: '#8a929b', gradDir: 'v', shadow: 1, stroke: '#6b737c', strokeWidth: 0.5 }),
    circle(12, -22, 4, '#c9ccd1', { stroke: '#6b737c', strokeWidth: 0.5 }), circle(28, -22, 4, '#c9ccd1', { stroke: '#6b737c', strokeWidth: 0.5 }),
    rect(12, -26, 16, 8, '#c9ccd1'),
    ...[-24, -16, 52, 60].map((x) => circle(x, -22, 2, '#5f666e')),
    rect(2, -29, 8, 4, '#e8b24a', { opacity: 0.8 }), rect(30, -29, 8, 4, '#e8b24a', { opacity: 0.8 }),
    silk(20, -8, '5kg', 3, 'middle', '#555'),
  ],
  readouts: [{ value: 'kg', unit: 'kg', x: 20, y: -34, size: 4 }],
  model: {
    elements: [
      { id: 'R1', kind: 'rvar', a: 'EP', b: 'SP', value: '1000 * (1 - 0.0002 * kg)' },
      { id: 'R2', kind: 'rvar', a: 'SP', b: 'EN', value: '1000 * (1 + 0.0002 * kg)' },
      { id: 'R3', kind: 'rvar', a: 'EP', b: 'SN', value: '1000 * (1 + 0.0002 * kg)' },
      { id: 'R4', kind: 'rvar', a: 'SN', b: 'EN', value: '1000 * (1 - 0.0002 * kg)' },
    ],
  },
};

const sct013: Raw = {
  type: 'sct013', name: 'Split-core current transformer (SCT-013-030)', category: 'sensors',
  description: 'Clip it around ONE wire of a mains cable to measure AC current safely, without touching the wire: the output is an AC voltage of 1 V RMS at 30 A (built-in burden). Bias it to VCC/2 with a divider and capacitor before analogRead. Set the current while simulating.',
  keywords: ['sct-013', 'current transformer', 'ct clamp', 'ac current', 'energy monitor', 'emon'],
  pins: pinRow(['P', 'N'], { labels: { P: 'Output (tip)', N: 'Output (sleeve)' } }),
  props: [{ key: 'amps', label: 'Mains current', type: 'slider', default: 5, min: 0, max: 30, step: 0.1, unit: 'A rms' }],
  drag: 'amps',
  shapes: [
    line(0, 0, 3, -12, '#26282c', 1.6), line(10, 0, 7, -12, '#26282c', 1.6),
    rect(0, -16, 10, 5, '#c9ccd1', { rx: 1, grad: '#7f8891', gradDir: 'h' }),
    line(5, -16, 5, -26, '#2d2f33', 2.4),
    path('M -10 -42 A 15 15 0 1 1 20 -42 L 20 -34 L -10 -34 Z', '#2d2f33', { grad: '#111214', gradDir: 'd', shadow: 1 }),
    circle(5, -44, 7, '#f3f5f8'),
    line(-18, -44, 28, -44, '#b8702e', 3), line(-18, -44, 28, -44, '#d89a5a', 1),
    rect(-10, -30, 30, 5, '#2d2f33', { rx: 1 }), silk(5, -26.5, '30A/1V', 2.4),
  ],
  readouts: [{ value: 'amps', unit: 'A', x: 5, y: -62, size: 4 }],
  model: { elements: [{ id: 'O', kind: 'vsource', p: 'P', n: 'N', value: '1.41421 * amps / 30 * sin(6.28318 * 50 * t)', r: 60 }] },
  maxStep: 5e-4,
};

const mq7 = mq(
  'mq7', 'MQ-7', 'Carbon monoxide sensor (MQ-7)',
  'Detects carbon monoxide (20–2000 ppm) — the dangerous gas from stoves and exhausts. Its heater should really cycle between 5 V and 1.4 V; this model shows the reading at the end of a cycle. AO rises with CO; DO goes LOW above the threshold. Set the concentration while simulating.',
  ['mq7', 'mq-7', 'carbon monoxide', 'co sensor', 'co alarm', 'gas sensor'],
  { key: 'ppm', label: 'Carbon monoxide', type: 'slider', default: 20, min: 0, max: 2000, step: 5, unit: 'ppm' },
  'v(VCC, GND) * 10000 / (10000 + 60000 * pow(max(ppm, 5) / 100, -0.7))',
);

const mq4 = mq(
  'mq4', 'MQ-4', 'Methane / natural gas sensor (MQ-4)',
  'Sensitive to methane (natural gas, 200–10 000 ppm) and much less to alcohol or smoke — the sensor for a gas-leak alarm. Heater ~150 mA at 5 V. AO rises with the gas level; DO goes LOW above the threshold pot. Set the concentration while simulating.',
  ['mq4', 'mq-4', 'methane', 'natural gas', 'gas leak', 'cng', 'gas sensor'],
  { key: 'ppm', label: 'Methane', type: 'slider', default: 200, min: 0, max: 10000, step: 10, unit: 'ppm' },
  'v(VCC, GND) * 10000 / (10000 + 30000 * pow(max(ppm, 50) / 1000, -0.36))',
);

const anemometer: Raw = {
  type: 'anemometer', name: 'Anemometer (wind speed, reed pulse)', category: 'sensors',
  description: 'Three spinning cups with a magnet and a reed switch: the two wires close once per turn, and 1 closure per second = 2.4 km/h of wind. Use INPUT_PULLUP and count pulses with an interrupt. Set the wind speed while simulating.',
  keywords: ['anemometer', 'wind speed', 'weather station', 'wind sensor', 'cups'],
  pins: pinRow(['1', '2']),
  props: [{ key: 'wind', label: 'Wind speed', type: 'slider', default: 10, min: 0, max: 100, step: 0.5, unit: 'km/h' }],
  drag: 'wind',
  shapes: [
    line(0, 0, 0, -10, '#26282c', 1.4), line(10, 0, 10, -10, '#26282c', 1.4),
    rect(-2, -30, 14, 20, '#f4f5f1', { rx: 1.5, grad: '#c9ccc4', gradDir: 'h', shadow: 1 }),
    rect(3.5, -40, 3, 10, '#c9ccd1'),
    reach(-25, -68, 60, 56),
  ],
  animations: [0, 120, 240].flatMap((a) => {
    const r = (a * Math.PI) / 180, x = 5 + Math.cos(r) * 20, y = -44 + Math.sin(r) * 11;
    return [
      { shape: line(5, -44, x, y, '#9aa0a6', 1.2), rotate: 'ph * 360', cx: 5, cy: -44 },
      { shape: circle(x, y, 4.2, '#f4f5f1', { grad: '#9aa0a6', gradDir: 'r', stroke: '#6b737c', strokeWidth: 0.4 }), rotate: 'ph * 360', cx: 5, cy: -44 },
    ];
  }),
  readouts: [{ value: 'wind', unit: 'km/h', x: 5, y: -62, size: 4 }],
  states: [{ name: 'ph', init: 0, next: 'mod(ph + wind / 2.4 * dt, 1)' }],
  model: { elements: [contact('S', '1', '2', 'ph < 0.3', 0.5)] },
  maxStep: 1e-3,
};

const laserRx: Raw = (() => {
  const b = moduleBoard(['OUT', 'VCC', 'GND'], { h: 34, color: COL.pcbBlack, holes: 'none', labels: { OUT: 'OUT (HIGH while the laser hits it)', VCC: '+5 V' } });
  return {
    type: 'laser-receiver', name: 'Laser receiver module', category: 'sensors',
    description: 'A light sensor that only reacts to a strong beam: OUT goes HIGH while a laser dot is on the window. Pair it with a laser module for tripwire alarms or light barriers. Click to aim / block the laser while simulating.',
    keywords: ['laser receiver', 'laser sensor', 'light barrier', 'tripwire', 'beam break'],
    pins: b.pins,
    props: [{ key: 'beam', label: 'Laser', type: 'select', default: 1, options: [{ value: 1, label: 'On the sensor' }, { value: 0, label: 'Blocked / off' }] }],
    toggle: 'beam',
    shapes: [...b.shapes, circle(10, -24, 7, '#2d2f33', { grad: '#111214', gradDir: 'd', shadow: 1 }), circle(10, -24, 4, '#e7eaee', { opacity: 0.4 }), ...smdRow(-3, -14, 3, 4.5)],
    indicators: [{ shape: circle(10, -24, 2.2, '#ff2a2a'), color: '#ff2a2a', level: 'beam == 1 ? 1 : 0' }],
    model: { elements: [dout('O', 'OUT', 'beam == 1 && v(VCC, GND) > 3', 'VCC', 'GND', 300), quiescent('VCC', 'GND', 5000)] },
  };
})();

const photoInterrupter: Raw = (() => {
  const b = moduleBoard(['S', 'VCC', 'GND'], { h: 36, color: COL.pcbBlack, title: 'KY-010', titleY: -15.5, titleSize: 3, labels: { S: 'S (HIGH when the slot is blocked)', VCC: '+ (3.3–5 V)' } });
  return {
    type: 'photo-interrupter', name: 'Photo interrupter (slot sensor, KY-010)', category: 'sensors',
    description: 'An IR LED and a photo-transistor facing each other across a 5 mm slot: S is LOW while the beam is clear and goes HIGH when something (a card, a flag on a shaft) blocks it. Endstops, paper detectors, counting slots. Press it to block the slot.',
    keywords: ['photo interrupter', 'ky-010', 'slot sensor', 'optical endstop', 'opto switch', 'beam break'],
    pins: b.pins, interactive: 'press',
    shapes: [
      ...b.shapes,
      rect(-2, -38, 8, 18, '#2d2f33', { rx: 1, grad: '#111214', gradDir: 'h', shadow: 1 }), rect(14, -38, 8, 18, '#2d2f33', { rx: 1, grad: '#111214', gradDir: 'h', shadow: 1 }),
      rect(-2, -22, 24, 4, '#2d2f33', { rx: 1 }),
      reach(7, -46, 6, 20),
    ],
    animations: [{ shape: rect(7.5, -52, 5, 18, '#e8b24a', { rx: 0.6, stroke: '#9c7a22', strokeWidth: 0.4 }), dy: 'pressed == 1 ? 12 : 0' }],
    model: { elements: [{ id: 'PU', kind: 'resistor', a: 'VCC', b: 'S', value: 10000 }, contact('Q', 'S', 'GND', 'pressed == 0 && v(VCC, GND) > 2.5', 200), quiescent('VCC', 'GND', 300)] },
  };
})();

const mpx5010: Raw = {
  type: 'mpx5010', name: 'Pressure sensor (MPX5010DP, 0–10 kPa)', category: 'sensors',
  description: 'An amplified pressure sensor with a hose port: Vout = VS × (0.09 × P + 0.04), from 0.2 V at 0 kPa to 4.7 V at 10 kPa (at 5 V). Water level in a tank (1 kPa ≈ 10 cm of water), airflow, breath sensing. Set the pressure while simulating.',
  keywords: ['pressure sensor', 'mpx5010', 'differential pressure', 'water level', 'air pressure', 'kpa'],
  pins: pinRow(['VOUT', 'GND', 'VS'], { labels: { VOUT: 'Vout (pin 1)', GND: 'GND (pin 2)', VS: 'Vs 5 V (pin 3)' } }),
  props: [{ key: 'kpa', label: 'Pressure', type: 'slider', default: 2, min: 0, max: 10, step: 0.05, unit: 'kPa' }],
  drag: 'kpa',
  shapes: [
    ...pinRow(['VOUT', 'GND', 'VS']).map((p) => pinLeg(p.x, -10)),
    rect(-8, -26, 36, 16, '#f4f5f1', { rx: 1.5, grad: '#c9ccc4', gradDir: 'd', shadow: 1 }),
    rect(4, -40, 12, 14, '#f4f5f1', { rx: 1, grad: '#c9ccc4', gradDir: 'h' }), rect(6, -48, 8, 9, '#f4f5f1', { rx: 1.5, grad: '#b3b6ae', gradDir: 'h' }),
    text(10, -16, 'MPX5010', 3.2, '#3a3a3a', 'middle', { weight: 700 }),
  ],
  readouts: [{ value: 'kpa', unit: 'kPa', x: 10, y: -52, size: 4 }],
  model: { elements: [{ id: 'O', kind: 'vsource', p: 'VOUT', n: 'GND', value: 'v(VS, GND) > 4 ? v(VS, GND) * (0.09 * kpa + 0.04) : 0', r: 100 }, quiescent('VS', 'GND', 1000)] },
};

// ---------------------------------------------------------------- meters & indicators

/** Moving-coil panel meter: scale arc, ticks and a damped needle (state `nd`, 0..1 of full scale). */
function analogMeter(o: { type: string; name: string; description: string; keywords: string[]; unit: string; ranges: [number, string][]; value: string; elements: Raw[] }): Raw {
  const cx = 10, cy = -18;
  // 11 ticks over a 90° arc, long ones at 0, ½ and full scale
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = ((-45 + i * 9) * Math.PI) / 180, r1 = i % 5 === 0 ? 21 : 23;
    return line(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1, cx + Math.sin(a) * 26, cy - Math.cos(a) * 26, '#26282c', i % 5 === 0 ? 0.8 : 0.45);
  });
  return {
    type: o.type, name: o.name, category: 'instruments', description: o.description, keywords: o.keywords,
    pins: pinRow(['P', 'N'], { step: 20, kind: 'terminal', labels: { P: '+', N: '−' } }),
    props: [{ key: 'fs', label: 'Full scale', type: 'select', default: o.ranges[0][0], options: o.ranges.map(([v, l]) => ({ value: v, label: l })) }],
    shapes: [
      ...pinRow(['P', 'N'], { step: 20 }).map((p) => pinLeg(p.x, -8)),
      rect(-20, -52, 60, 46, '#2d2f33', { rx: 2, grad: '#111214', gradDir: 'd', shadow: 1 }),
      rect(-16, -48, 52, 32, '#f7f4ea', { rx: 1, grad: '#e0dccb', gradDir: 'v' }),
      path(`M ${cx - 18.4} ${cy - 18.4} A 26 26 0 0 1 ${cx + 18.4} ${cy - 18.4}`, 'none', { stroke: '#26282c', strokeWidth: 0.5 }),
      ...ticks,
      text(-11, -20, o.unit, 4.4, '#26282c', 'middle', { weight: 700 }),
      rect(-16, -16, 52, 6, '#1d1e21'),
      circle(cx, cy, 2.2, '#26282c'),
    ],
    animations: [{ shape: line(cx, cy, cx, cy - 24, '#c62828', 0.7), rotate: '-45 + 90 * nd', cx, cy }],
    states: [{ name: 'nd', init: 0, next: `nd + (clamp((${o.value}) / fs, -0.03, 1.08) - nd) * min(1, dt / 0.12)` }],
    readouts: [{ value: o.value, unit: o.unit, x: cx, y: -58, size: 3.6 }],
    model: { elements: o.elements },
    warnings: [{ when: `(${o.value}) > fs * 1.2`, level: 'warn', message: 'Needle pinned past full scale — pick a bigger range.' }, { when: `(${o.value}) < -fs * 0.05`, level: 'warn', message: 'Reversed — the needle pushes against its stop.' }],
  };
}

const voltmeterAnalog = analogMeter({
  type: 'analog-voltmeter', name: 'Analog panel voltmeter (moving coil)', unit: 'V',
  description: 'A classic needle voltmeter (85C1 style) with a 1 mA coil and a built-in series resistor, so it draws 1 mA at full scale. Connect it across what you measure, + to the higher side. Pick the full-scale range.',
  keywords: ['analog voltmeter', 'panel meter', 'needle meter', 'moving coil', '85c1', 'voltmeter'],
  ranges: [[5, '0–5 V'], [15, '0–15 V'], [30, '0–30 V']],
  value: 'v(P, N)',
  elements: [{ id: 'R', kind: 'rvar', a: 'P', b: 'N', value: 'fs * 1000' }],
});

const ammeterAnalog = analogMeter({
  type: 'analog-ammeter', name: 'Analog panel ammeter (moving coil)', unit: 'A',
  description: 'A needle ammeter with an internal shunt: put it IN SERIES with the load (+ towards the supply). It adds only ~0.05 V at full scale. Pick the full-scale range.',
  keywords: ['analog ammeter', 'panel meter', 'needle meter', 'moving coil', 'ammeter', 'current meter'],
  ranges: [[1, '0–1 A'], [0.1, '0–100 mA'], [5, '0–5 A']],
  value: 'i(R)',
  elements: [{ id: 'R', kind: 'rvar', a: 'P', b: 'N', value: '0.05 / fs' }],
});

const neonLamp: Raw = {
  type: 'neon-lamp', name: 'Neon indicator lamp (230 V, with resistor)', category: 'output',
  description: 'The orange glow lamp in mains switches: a neon bulb plus a 100 kΩ resistor, so it can sit directly across 110–230 V AC and draws under 1 mA. The gas only strikes above ~70 V — it stays dark on low voltages.',
  keywords: ['neon', 'neon lamp', 'ne-2', 'mains indicator', 'glow lamp', 'pilot light'],
  pins: pinRow(['L1', 'L2'], { step: 20, labels: { L1: 'Lead 1', L2: 'Lead 2' } }),
  shapes: [
    ...legs(pinRow(['L1', 'L2'], { step: 20 }), -10),
    rect(-2, -18, 24, 8, '#dfe3e7', { rx: 1.5, grad: '#8a929b', gradDir: 'h', shadow: 0.8 }),
    rect(1, -36, 18, 18, '#ffe7c8', { rx: 9, opacity: 0.55, stroke: '#c9b89a', strokeWidth: 0.4 }),
    line(7, -20, 7, -30, '#8a929b', 0.7), line(13, -20, 13, -30, '#8a929b', 0.7),
  ],
  indicators: [{ shape: rect(2, -34, 16, 14, '#ff7a1a', { rx: 7 }), color: '#ff7a1a', level: 'clamp((abs(i(D1)) - 0.00005) / 0.0006, 0, 1)' }],
  model: {
    nodes: ['M', 'Z'],
    elements: [
      { id: 'R', kind: 'resistor', a: 'L1', b: 'M', value: 100000 },
      { id: 'D1', kind: 'diode', a: 'Z', k: 'M', model: 'zener', vz: 70 },
      { id: 'D2', kind: 'diode', a: 'Z', k: 'L2', model: 'zener', vz: 70 },
    ],
  },
  maxStep: 5e-4,
};

const panelLed: Raw = {
  type: 'panel-led', name: 'Panel indicator LED (12 V, chrome bezel)', category: 'output',
  description: 'A front-panel pilot light: an LED with its resistor built in, in a threaded metal bezel with solder tags — connect it straight to 12 V (~15 mA). Green here; red/blue/yellow ones work the same.',
  keywords: ['panel led', 'indicator light', 'pilot light', '12v led', 'bezel led', 'power indicator'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (12 V)', N: '−' } }),
  shapes: [
    line(0, 0, 4, -12, '#d63c35', 1.4), line(20, 0, 16, -12, '#26282c', 1.4),
    rect(-2, -22, 24, 10, '#dfe3e7', { rx: 1, grad: '#8a929b', gradDir: 'h', shadow: 0.8 }),
    ...[-20, -17, -14].map((y) => line(-2, y, 22, y, '#9aa3ad', 0.5)),
    rect(-4, -26, 28, 5, '#e7eaee', { rx: 2, grad: '#7f8891', gradDir: 'h' }),
    path('M 2 -26 L 2 -30 A 8 8 0 0 1 18 -30 L 18 -26 Z', '#8ad69a', { grad: '#2c7a3e', gradDir: 'h', opacity: 0.9 }),
  ],
  indicators: [{ shape: path('M 2 -26 L 2 -30 A 8 8 0 0 1 18 -30 L 18 -26 Z', '#35ff5a'), color: '#35ff5a', level: 'clamp(i(D) / 0.012, 0, 1)' }],
  model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'M', value: 680 }, { id: 'D', kind: 'diode', a: 'M', k: 'N', model: 'led', vf: 2.1 }] },
  warnings: [{ when: 'v(P, N) > 15', level: 'error', message: 'Rated for 12 V.' }],
};

// ---------------------------------------------------------------- power

const labPsu: Raw = {
  type: 'lab-psu', name: 'Bench power supply (0–30 V, current limit)', category: 'power',
  description: 'An adjustable lab supply with two knobs: the voltage, and a current limit. When the load tries to draw more than the limit, the voltage drops so exactly the limit flows and the CC light comes on — the safest way to power up a new circuit. Set both while simulating.',
  keywords: ['bench power supply', 'lab power supply', 'psu', 'variable power supply', 'current limit', 'constant current'],
  pins: pinRow(['P', 'N'], { step: 20, kind: 'terminal', labels: { P: '+ (red)', N: '− (black)' } }),
  props: [
    { key: 'vset', label: 'Voltage', type: 'slider', default: 5, min: 0, max: 30, step: 0.1, unit: 'V' },
    { key: 'ilim', label: 'Current limit', type: 'slider', default: 1, min: 0.01, max: 5, step: 0.01, unit: 'A' },
  ],
  drag: 'vset',
  shapes: [
    rect(-30, -70, 80, 64, '#3a3d42', { rx: 2, grad: '#1f2124', gradDir: 'd', shadow: 1 }),
    rect(-26, -66, 72, 30, '#16181b', { rx: 1 }),
    rect(-24, -62, 32, 14, '#200505', { rx: 1 }), rect(12, -62, 32, 14, '#200505', { rx: 1 }),
    silk(-8, -42, 'VOLTS', 2.6, 'middle', '#9ea2a8'), silk(28, -42, 'AMPS', 2.6, 'middle', '#9ea2a8'),
    circle(-14, -26, 6, '#d5d9de', { grad: '#6f7881', gradDir: 'r', shadow: 0.8 }), circle(8, -26, 6, '#d5d9de', { grad: '#6f7881', gradDir: 'r', shadow: 0.8 }),
    silk(-14, -17, 'V', 2.4, 'middle', '#9ea2a8'), silk(8, -17, 'I', 2.4, 'middle', '#9ea2a8'),
    circle(0, -8, 3.4, '#e0453d', { grad: '#8a1f1a', gradDir: 'r' }), circle(20, -8, 3.4, '#2d2f33', { grad: '#111214', gradDir: 'r', stroke: '#555', strokeWidth: 0.4 }),
    circle(34, -26, 2, '#3a2a18'), silk(34, -20.5, 'CC', 2.2, 'middle', '#9ea2a8'),
  ],
  indicators: [{ shape: circle(34, -26, 2, '#ff9a1a'), color: '#ff9a1a', level: 'abs(i(B)) > ilim * 0.97 ? 1 : 0' }],
  readouts: [
    { value: 'vo', unit: 'V', x: -8, y: -52, size: 5.4, color: '#ff3a2a' },
    { value: 'abs(i(B))', unit: 'A', x: 28, y: -52, size: 5.4, color: '#ff3a2a' },
  ],
  // vo tracks the set voltage, or the voltage that pushes exactly ilim through the present load
  states: [{ name: 'vo', init: 0, next: 'clamp(vo + (min(vset, abs(i(B)) > 1e-6 ? vo * ilim / abs(i(B)) : vset) - vo) * 0.3, 0, vset)' }],
  model: { elements: [{ id: 'B', kind: 'vsource', p: 'P', n: 'N', value: 'vo', r: 0.02 }] },
};

const powerBank: Raw = {
  type: 'power-bank', name: 'USB power bank (5 V, 10 000 mAh)', category: 'power',
  description: 'A pocket battery with a USB 5 V output (up to 2.1 A) — the easy way to run an Arduino, a Pi Pico or a small robot without a cable. The four LEDs show the charge left. (Real ones switch off if the load is below ~50 mA.)',
  keywords: ['power bank', 'usb battery', 'portable charger', '5v battery', 'powerbank'],
  pins: pinRow(['VBUS', 'GND'], { step: 20, labels: { VBUS: 'USB +5 V', GND: 'USB GND' } }),
  props: [{ key: 'charge', label: 'Initial charge', type: 'slider', default: 90, min: 0, max: 100, step: 1, unit: '%' }],
  shapes: [
    line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#26282c', 1.6),
    rect(-16, -46, 52, 38, '#34363b', { rx: 5, grad: '#15171a', gradDir: 'd', shadow: 1 }),
    rect(-2, -12, 24, 4, '#9aa3ad', { rx: 0.8 }),
    silk(10, -30, '10000mAh', 3.4, 'middle', '#c9ccd1'),
    ...[0, 1, 2, 3].map((k) => circle(-2 + k * 8, -20, 1.4, '#1a2a3a')),
  ],
  indicators: [0, 1, 2, 3].map((k) => ({ shape: circle(-2 + k * 8, -20, 1.4, '#3aa0ff'), color: '#3aa0ff', level: `soc > ${0.02 + k * 0.25} ? 1 : 0` })),
  states: [{ name: 'soc', init: 'charge / 100', next: 'clamp(soc + i(B) * dt / (7400 * 3.6), 0, 1)' }],
  readouts: [{ value: 'round(soc * 100)', unit: '%', x: 10, y: -50, size: 4 }],
  model: { elements: [{ id: 'B', kind: 'vsource', p: 'VBUS', n: 'GND', value: 'soc > 0.02 ? 5.1 : 0', r: 0.12 }] },
  warnings: [{ when: '-i(B) > 2.1', level: 'error', message: 'Drawing more than 2.1 A — the power bank shuts down.' }],
};

const lifepo4: Raw = {
  type: 'lifepo4', name: 'LiFePO4 cell (3.2 V, 18650)', category: 'power',
  description: 'A lithium-iron-phosphate cell: 3.2 V with a very flat discharge, thousands of cycles and no fire risk — and it can run 3.3 V parts directly, no regulator. 1500 mAh, charge to 3.6 V max.',
  keywords: ['lifepo4', 'lfp', 'ifr18650', '3.2v battery', 'lithium iron phosphate', 'battery'],
  pins: pinRow(['P', 'N'], { step: 20, kind: 'terminal', labels: { P: '+', N: '−' } }),
  props: [{ key: 'charge', label: 'Initial charge', type: 'slider', default: 90, min: 0, max: 100, step: 1, unit: '%' }],
  shapes: [
    ...leads(-8),
    rect(-14, -24, 48, 16, '#2cae4a', { rx: 3, grad: '#156a2a', gradDir: 'v', shadow: 1 }),
    rect(34, -20, 3, 8, '#c9ccd1', { rx: 1 }), rect(-14, -24, 5, 16, '#c9ccd1', { rx: 1.5, grad: '#7f8891', gradDir: 'v' }),
    text(12, -14, 'LiFePO4 3.2V', 3.4, '#e9f6ec', 'middle', { weight: 700 }),
  ],
  states: [{ name: 'soc', init: 'charge / 100', next: 'clamp(soc + i(B) * dt / (1500 * 3.6), 0, 1)' }],
  readouts: [{ value: 'round(soc * 100)', unit: '%', x: 10, y: -28, size: 4 }],
  model: { elements: [{ id: 'B', kind: 'vsource', p: 'P', n: 'N', value: 'soc > 0.05 ? 3.05 + 0.3 * soc : 2.5 + 11 * soc', r: 0.04 }] },
  warnings: [{ when: 'soc < 0.02', level: 'error', message: 'Over-discharged below 2.5 V.' }, { when: 'v(P, N) > 3.7', level: 'error', message: 'Charged above 3.65 V.' }],
};

const b0505s: Raw = {
  type: 'b0505s', name: 'Isolated DC-DC converter (B0505S, 1 W)', category: 'power',
  description: 'A little SIP module that makes a second 5 V supply with NO electrical connection to the first (1 kV isolation) — its output − is not your ground. Used to power the far side of an isolated interface or to break ground loops. Unregulated: ~5 V at a 200 mA load.',
  keywords: ['b0505s', 'isolated dc-dc', 'isolated converter', 'galvanic isolation', 'ground loop', 'dc dc'],
  pins: pinRow(['GND', 'VIN', 'OUTN', 'OUTP'], { labels: { GND: 'Input − (pin 1)', VIN: 'Input +5 V (pin 2)', OUTN: 'Output 0 V (isolated)', OUTP: 'Output +5 V (isolated)' } }),
  shapes: [
    ...pinRow(['GND', 'VIN', 'OUTN', 'OUTP']).map((p) => pinLeg(p.x, -8)),
    rect(-6, -30, 42, 22, '#2d2f33', { rx: 1, grad: '#111214', gradDir: 'd', shadow: 1 }),
    text(15, -21, 'B0505S-1W', 3.8, '#d9dce0', 'middle', { weight: 600 }), text(15, -14, 'ISOLATED', 2.6, '#9ea2a8', 'middle', { weight: 500 }),
  ],
  model: {
    elements: [
      { id: 'O', kind: 'vsource', p: 'OUTP', n: 'OUTN', value: 'v(VIN, GND) > 3 ? v(VIN, GND) * 1.05 : 0', r: 1.2 },
      // input draws the output power plus losses
      { id: 'II', kind: 'isource', p: 'GND', n: 'VIN', value: 'v(VIN, GND) > 3 ? abs(i(O)) * 1.3 + 0.02 : 0' },
      { id: 'ISO', kind: 'resistor', a: 'OUTN', b: 'GND', value: 1e9 },
    ],
  },
  warnings: [{ when: 'abs(i(O)) > 0.2', level: 'warn', message: 'Above 200 mA (1 W) output.' }],
};

const icl7660: Raw = (() => {
  const d = dip(['NC', 'CAPP', 'GND', 'CAPN', 'VOUT', 'LV', 'OSC', 'VCC'], {
    label: 'ICL7660', sub: 'voltage inverter',
    labels: { NC: 'not connected', CAPP: 'CAP+ (10 µF to CAP−)', CAPN: 'CAP−', VOUT: 'Output (−VCC)', LV: 'Low-voltage (to GND below 3.5 V)', OSC: 'Oscillator', VCC: 'V+ (1.5–10 V)' },
  });
  return {
    type: 'icl7660', name: 'ICL7660 charge-pump voltage inverter', category: 'power',
    description: 'Makes a negative supply from a positive one with just two 10 µF capacitors: VOUT ≈ −VCC (−5 V from 5 V), up to ~20 mA — enough for an op-amp\'s negative rail or an LCD bias. The output sags ~55 Ω per mA drawn.',
    keywords: ['icl7660', 'charge pump', 'voltage inverter', 'negative voltage', 'lmc7660', 'max1044'],
    ...d,
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'GND', n: 'VOUT', value: 'v(VCC, GND) > 1.5 ? v(VCC, GND) : 0', r: 55 },
        { id: 'II', kind: 'isource', p: 'GND', n: 'VCC', value: 'v(VCC, GND) > 1.5 ? abs(i(O)) * 1.05 + 0.0001 : 0' },
        ...hiz(['NC', 'CAPP', 'CAPN', 'LV', 'OSC']),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 10.5', level: 'error', message: 'Supply above 10 V.' }, { when: 'abs(i(O)) > 0.02', level: 'warn', message: 'Output current above 20 mA.' }],
  };
})();

// ---------------------------------------------------------------- outputs

const peltier: Raw = {
  type: 'peltier', name: 'Peltier module (TEC1-12706)', category: 'output',
  description: 'A thermoelectric cooler: current pumps heat from one ceramic face to the other — one side goes cold, the other hot (up to ~65 °C apart). 12 V, up to 6 A: drive it with a big MOSFET and put a heatsink on the hot side. Reverse the current to swap sides.',
  keywords: ['peltier', 'tec1-12706', 'thermoelectric', 'cooler', 'tec', 'cooling', 'heat pump'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
  shapes: [
    ...leads(-12),
    rect(-14, -52, 48, 40, '#f4f5f1', { rx: 1, grad: '#c9ccc4', gradDir: 'd', shadow: 1, stroke: '#b3b6ae', strokeWidth: 0.4 }),
    text(10, -30, 'TEC1-12706', 3.6, '#3a3a3a', 'middle', { weight: 700 }),
    rect(-14, -14, 48, 2, '#b3b6ae'),
  ],
  indicators: [
    { shape: rect(-14, -52, 48, 40, '#4aa3ff', { rx: 1 }), color: '#4aa3ff', level: 'clamp(dT / 80, 0, 0.45)' },
    { shape: rect(-14, -52, 48, 40, '#ff5a1a', { rx: 1 }), color: '#ff5a1a', level: 'clamp(-dT / 80, 0, 0.45)' },
  ],
  states: [{ name: 'dT', init: 0, next: 'dT + (clamp(i(R) * 11, -65, 65) - dT) * min(1, dt / 4)' }],
  readouts: [{ label: 'ΔT', value: 'dT', unit: '°C', x: 10, y: -56, size: 4 }],
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 2 }] },
  warnings: [{ when: 'abs(i(R)) > 6.4', level: 'error', message: 'Above 6.4 A.' }],
};

const heaterPad: Raw = {
  type: 'heater-pad', name: 'Heating pad (5 V, 5 W)', category: 'output',
  description: 'A flexible polyimide heater (5 Ω): 5 V gives 5 W, warming an enclosure, a seed tray or a 3D-print bed toy. Draws 1 A — switch it with a MOSFET and control it from a temperature sensor.',
  keywords: ['heater', 'heating pad', 'polyimide heater', 'kapton heater', 'heating element', 'warmer'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
  shapes: [
    ...leads(-10),
    rect(-16, -54, 52, 44, '#d9902a', { rx: 3, grad: '#9a5a14', gradDir: 'd', shadow: 1, opacity: 0.95 }),
    path('M -10 -48 L 30 -48 L 30 -42 L -10 -42 L -10 -36 L 30 -36 L 30 -30 L -10 -30 L -10 -24 L 30 -24 L 30 -18', 'none', { stroke: '#6b3a0a', strokeWidth: 1.2 }),
  ],
  indicators: [{ shape: rect(-16, -54, 52, 44, '#ff4a1a', { rx: 3 }), color: '#ff4a1a', level: 'clamp((temp - 30) / 60, 0, 0.6)' }],
  states: [{ name: 'temp', init: 25, next: 'temp + (25 + 9 * v(P, N) * v(P, N) / 5 - temp) * min(1, dt / 20)' }],
  readouts: [{ value: 'temp', unit: '°C', x: 10, y: -58, size: 4 }],
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 5 }] },
  warnings: [{ when: 'abs(v(P, N)) > 7', level: 'error', message: 'Rated for 5 V — it will overheat.' }],
};

const solenoidValve: Raw = {
  type: 'solenoid-valve', name: 'Solenoid water valve (12 V, ½")', category: 'output',
  description: 'An electrically opened water valve: 12 V on the coil (~0.4 A) lifts the plunger and water flows; off, it closes. It is an inductor: switch it with a MOSFET or relay and add a flyback diode. Needs some water pressure to seal (not for gravity feed).',
  keywords: ['solenoid valve', 'water valve', 'irrigation valve', 'plumbing', '12v valve', 'garden'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: 'Coil +', N: 'Coil −' } }),
  shapes: [
    ...leads(-8),
    rect(-6, -40, 32, 30, '#2d2f33', { rx: 2, grad: '#111214', gradDir: 'h', shadow: 1 }),
    text(10, -24, '12V DC', 3.4, '#c9ccd1', 'middle', { weight: 700 }),
    rect(-26, -58, 72, 16, '#f4f5f1', { rx: 2, grad: '#c9ccc4', gradDir: 'v', shadow: 1 }),
    rect(-32, -56, 8, 12, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'v' }), rect(44, -56, 8, 12, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'v' }),
  ],
  indicators: [{ shape: path('M 52 -54 C 60 -54 64 -48 66 -38 L 62 -38 C 60 -46 57 -50 52 -50 Z', '#4aa3ff'), color: '#4aa3ff', level: 'on == 1 ? 0.9 : 0' }],
  states: [{ name: 'on', init: 0, next: 'abs(i(R)) > 0.25 ? 1 : (abs(i(R)) < 0.1 ? 0 : on)' }],
  model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'M', value: 30 }, { id: 'L', kind: 'inductor', a: 'M', b: 'N', value: 0.08 }] },
  warnings: [{ when: 'abs(v(P, N)) > 15', level: 'error', message: 'Rated for 12 V.' }],
  maxStep: 5e-4,
};

const siren: Raw = {
  type: 'siren', name: 'Alarm siren (12 V, 110 dB)', category: 'output',
  description: 'A loud electronic siren with its own wailing oscillator: apply 6–12 V (~120 mA) and it howls up and down. For burglar and fire alarms — switch it with a transistor or relay.',
  keywords: ['siren', 'alarm', 'horn', '12v siren', 'security', 'loud buzzer'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
  shapes: [
    ...leads(-10),
    rect(-8, -26, 36, 16, '#2d2f33', { rx: 2, grad: '#111214', gradDir: 'h', shadow: 1 }),
    path('M -12 -26 L 32 -26 L 42 -52 L -22 -52 Z', '#34363b', { grad: '#15171a', gradDir: 'h', shadow: 1 }),
    { type: 'ellipse', cx: 10, cy: -52, rx: 32, ry: 4, fill: '#1c1d20', stroke: '#4a4d53', strokeWidth: 0.6 },
  ],
  sound: 'v(P, N) > 5 ? 1800 + 700 * sin(t * 9) : 0',
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 100 }] },
  warnings: [{ when: 'abs(v(P, N)) > 15', level: 'error', message: 'Rated for 12 V.' }],
};

export const EXTRA_MORE: Raw[] = [
  nand3, and3, nor3, nand4, mux157, cd4511, counter393, adder283, bus245, lm311, mcp6002, ht7333, uln2803,
  mos2n7000, germanium, led10, flashingLed, ledStrip, dualPot,
  arcadeButton, keySwitch, slide3, doorSensor, estop, ttp224,
  temt6000, rcwl0516, sharpIr, capSoil, loadCell, sct013, mq7, mq4, anemometer, laserRx, photoInterrupter, mpx5010,
  voltmeterAnalog, ammeterAnalog, neonLamp, panelLed,
  labPsu, powerBank, lifepo4, b0505s, icl7660,
  peltier, heaterPad, solenoidValve, siren,
];
