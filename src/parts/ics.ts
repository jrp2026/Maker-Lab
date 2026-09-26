import { H, dip, dout, hiz, quiescent, type Raw } from './kit';

const LO = (pin: string) => `!${H(pin)}`;

// ---------------------------------------------------------------- analog / timer

export const ANALOG_ICS: Raw[] = [
  (() => {
    const d = dip(['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'], {
      label: 'NE555', sub: 'timer',
      labels: { TRIG: 'Trigger (starts when < ⅓ VCC)', THR: 'Threshold (stops when > ⅔ VCC)', DIS: 'Discharge (open collector)', CTRL: 'Control voltage (⅔ VCC)', RESET: 'Reset (active low)' },
    });
    return {
      type: 'ne555', name: '555 timer IC', category: 'ics',
      description: 'The classic NE555: astable (blinker/oscillator), monostable (one-shot) or Schmitt trigger. Internal 5k–5k–5k divider sets the ⅓ and ⅔ VCC thresholds; OUT is ~1.7 V below VCC when high; DIS shorts to GND while OUT is low. 4.5–16 V.',
      keywords: ['555', 'ne555', 'timer', 'astable', 'monostable', 'oscillator', 'blinker', 'pwm'],
      ...d,
      states: [
        { name: 'q', init: 0, next: `v(RESET, GND) < 0.7 ? 0 : (v(TRIG, GND) < v(N1, GND) ? 1 : (v(THR, GND) > v(CTRL, GND) ? 0 : q))` },
        // how fast THR and TRIG are moving, for the adaptive step below
        { name: 'sh', init: 0, next: '(v(THR, GND) - ph) / max(dt, 1e-9)' },
        { name: 'ph', init: 0, next: 'v(THR, GND)' },
        { name: 'st', init: 0, next: '(v(TRIG, GND) - pt) / max(dt, 1e-9)' },
        { name: 'pt', init: 0, next: 'v(TRIG, GND)' },
      ],
      model: {
        nodes: ['N1'],
        elements: [
          { id: 'R1', kind: 'resistor', a: 'VCC', b: 'CTRL', value: 5000 },
          { id: 'R2', kind: 'resistor', a: 'CTRL', b: 'N1', value: 5000 },
          { id: 'R3', kind: 'resistor', a: 'N1', b: 'GND', value: 5000 },
          { id: 'OUTD', kind: 'vsource', p: 'OUT', n: 'GND', value: 'q == 1 ? max(0, v(VCC, GND) - 1.7) : 0.1', r: 10 },
          { id: 'DISQ', kind: 'rvar', a: 'DIS', b: 'GND', value: 'q == 0 ? 10 : 1e9' },
          { id: 'RT', kind: 'resistor', a: 'TRIG', b: 'GND', value: 1e8 },
          { id: 'RTH', kind: 'resistor', a: 'THR', b: 'GND', value: 1e8 },
          { id: 'RR', kind: 'resistor', a: 'VCC', b: 'RESET', value: 1e6 },
          quiescent('VCC', 'GND', 1500),
        ],
      },
      warnings: [
        { when: 'v(VCC, GND) > 16', level: 'error', message: 'Supply above the 16 V maximum.' },
        { when: 'abs(i(OUTD)) > 0.2', level: 'warn', message: 'OUT is sourcing/sinking more than 200 mA.' },
      ],
      // small steps only near a threshold: cover at most a quarter of the remaining distance per step
      // (a slow 1 Hz blinker runs at 1 ms steps, an audio-rate oscillator still gets 50 µs)
      maxStep: 'max(5e-5, min(0.25 * abs(v(CTRL, GND) - v(THR, GND)) / max(abs(sh), 1e-3), 0.25 * abs(v(TRIG, GND) - v(N1, GND)) / max(abs(st), 1e-3)))',
    };
  })(),
  (() => {
    const d = dip(['OUT1', 'IN1N', 'IN1P', 'GND', 'IN2P', 'IN2N', 'OUT2', 'VCC'], {
      label: 'LM358', sub: 'dual op-amp',
      labels: { OUT1: 'Output A', IN1N: 'Input A −', IN1P: 'Input A +', IN2P: 'Input B +', IN2N: 'Input B −', OUT2: 'Output B', VCC: 'V+ (3–32 V)', GND: 'V− / GND' },
    });
    return {
      type: 'lm358', name: 'LM358 dual op-amp', category: 'ics',
      description: 'Two general-purpose op-amps that run from a single supply (3–32 V). Inputs and output reach down to GND; the output tops out about 1.5 V below V+. Gain-bandwidth ~1 MHz.',
      keywords: ['op-amp', 'opamp', 'lm358', 'amplifier', 'operational amplifier', 'buffer', 'comparator'],
      ...d,
      model: {
        elements: [
          { id: 'A', kind: 'opamp', p: 'IN1P', n: 'IN1N', out: 'OUT1', vcc: 'VCC', vee: 'GND' },
          { id: 'B', kind: 'opamp', p: 'IN2P', n: 'IN2N', out: 'OUT2', vcc: 'VCC', vee: 'GND' },
          ...hiz(['IN1P', 'IN1N', 'IN2P', 'IN2N'], 'GND', 'RIN'),
          quiescent('VCC', 'GND', 7000),
        ],
      },
      warnings: [{ when: 'v(VCC, GND) > 32', level: 'error', message: 'Supply above 32 V.' }],
    };
  })(),
  (() => {
    const d = dip(['NULL1', 'INN', 'INP', 'VEE', 'NULL2', 'OUT', 'VCC', 'NC'], {
      label: 'UA741', sub: 'op-amp',
      labels: { INN: 'Inverting input −', INP: 'Non-inverting input +', VEE: 'V− (negative supply)', VCC: 'V+', OUT: 'Output', NULL1: 'Offset null', NULL2: 'Offset null', NC: 'Not connected' },
    });
    return {
      type: 'ua741', name: 'µA741 op-amp', category: 'ics',
      description: 'The textbook op-amp. Needs a split supply (e.g. ±9 V) — inputs must stay 2 V inside the rails, and the output swings to ~1.5 V from each rail. Leave the offset-null pins open.',
      keywords: ['741', 'ua741', 'lm741', 'op-amp', 'opamp', 'operational amplifier'],
      ...d,
      model: {
        elements: [
          { id: 'A', kind: 'opamp', p: 'INP', n: 'INN', out: 'OUT', vcc: 'VCC', vee: 'VEE', gain: 2e5 },
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'VEE', value: 10000 },
          ...hiz(['INP', 'INN'], 'VEE', 'RIN'),
          { id: 'N1', kind: 'resistor', a: 'NULL1', b: 'VEE', value: 1e8 },
          { id: 'N2', kind: 'resistor', a: 'NULL2', b: 'VEE', value: 1e8 },
          { id: 'NCR', kind: 'resistor', a: 'NC', b: 'VEE', value: 1e9 },
        ],
      },
    };
  })(),
  (() => {
    const d = dip(['OUT1', 'IN1N', 'IN1P', 'GND', 'IN2P', 'IN2N', 'OUT2', 'VCC'], {
      label: 'LM393', sub: 'dual comparator',
      labels: { OUT1: 'Output A (open collector)', IN1N: 'Input A −', IN1P: 'Input A +', IN2P: 'Input B +', IN2N: 'Input B −', OUT2: 'Output B (open collector)', VCC: 'V+ (2–36 V)' },
    });
    return {
      type: 'lm393', name: 'LM393 dual comparator', category: 'ics',
      description: 'Two voltage comparators with open-collector outputs: the output pulls to GND when IN− > IN+, and floats otherwise — add a pull-up resistor (e.g. 10 kΩ to your logic supply).',
      keywords: ['comparator', 'lm393', 'lm339', 'threshold', 'open collector'],
      ...d,
      model: {
        elements: [
          { id: 'A', kind: 'comparator', p: 'IN1P', n: 'IN1N', out: 'OUT1', vee: 'GND' },
          { id: 'B', kind: 'comparator', p: 'IN2P', n: 'IN2N', out: 'OUT2', vee: 'GND' },
          ...hiz(['IN1P', 'IN1N', 'IN2P', 'IN2N'], 'GND'),
          quiescent('VCC', 'GND', 6000),
        ],
      },
    };
  })(),
];

// ---------------------------------------------------------------- logic

const GATE_PINS = ['A1', 'B1', 'Y1', 'A2', 'B2', 'Y2', 'GND', 'Y3', 'A3', 'B3', 'Y4', 'A4', 'B4', 'VCC'];
const gateLabels = Object.fromEntries(GATE_PINS.map((p) => [p, /^[ABY]\d$/.test(p) ? `${p[1]}${p[0]}` : p]));

function quadGate(type: string, chip: string, fn: string, what: string, op: (a: string, b: string) => string, keywords: string[]): Raw {
  const d = dip(GATE_PINS, { label: chip, sub: fn, labels: gateLabels });
  return {
    type, name: `${chip} quad ${fn} gate`, category: 'logic',
    description: `Four 2-input ${fn} gates (${what}). 2–6 V CMOS; inputs switch at VCC/2 — never leave unused inputs floating on a real chip.`,
    keywords: ['logic', 'gate', chip.toLowerCase(), fn.toLowerCase(), ...keywords],
    ...d,
    model: {
      elements: [
        ...[1, 2, 3, 4].map((n) => dout(`G${n}`, `Y${n}`, op(H(`A${n}`), H(`B${n}`)))),
        ...hiz([1, 2, 3, 4].flatMap((n) => [`A${n}`, `B${n}`])),
        quiescent('VCC', 'GND', 1e5),
      ],
    },
    warnings: [{ when: 'v(VCC, GND) > 6.5', level: 'error', message: '74HC chips are rated to 6 V.' }],
  };
}

const INV_PINS = ['A1', 'Y1', 'A2', 'Y2', 'A3', 'Y3', 'GND', 'Y4', 'A4', 'Y5', 'A5', 'Y6', 'A6', 'VCC'];

export const LOGIC_ICS: Raw[] = [
  quadGate('74hc00', '74HC00', 'NAND', 'Y = NOT(A AND B)', (a, b) => `!(${a} && ${b})`, ['nand']),
  quadGate('74hc08', '74HC08', 'AND', 'Y = A AND B', (a, b) => `${a} && ${b}`, ['and']),
  quadGate('74hc32', '74HC32', 'OR', 'Y = A OR B', (a, b) => `${a} || ${b}`, ['or']),
  quadGate('74hc86', '74HC86', 'XOR', 'Y = A XOR B', (a, b) => `${a} != ${b}`, ['xor', 'exclusive or']),
  (() => {
    const d = dip(INV_PINS, { label: '74HC04', sub: 'hex inverter', labels: Object.fromEntries(INV_PINS.map((p) => [p, /^[AY]\d$/.test(p) ? `${p[1]}${p[0]}` : p])) });
    return {
      type: '74hc04', name: '74HC04 hex inverter (NOT)', category: 'logic',
      description: 'Six NOT gates: each output is the opposite of its input. 2–6 V CMOS.',
      keywords: ['logic', 'not', 'inverter', '74hc04', '7404', 'gate'],
      ...d,
      model: { elements: [...[1, 2, 3, 4, 5, 6].map((n) => dout(`G${n}`, `Y${n}`, LO(`A${n}`))), ...hiz([1, 2, 3, 4, 5, 6].map((n) => `A${n}`)), quiescent('VCC', 'GND', 1e5)] },
    };
  })(),
  (() => {
    const names = ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'GND', 'Q8', 'Q4', 'Q9', 'CO', 'INH', 'CLK', 'RST', 'VCC'];
    const d = dip(names, { label: 'CD4017', sub: 'decade counter', labels: { CO: 'Carry out (high for counts 0–4)', INH: 'Clock inhibit (active high)', CLK: 'Clock (counts rising edges)', RST: 'Reset (active high)', VCC: 'VDD (3–15 V)', GND: 'VSS' } });
    return {
      type: 'cd4017', name: 'CD4017 decade counter', category: 'logic',
      description: 'Johnson decade counter: one of the ten outputs Q0–Q9 is high, advancing one step on every rising clock edge (the LED-chaser chip — clock it from a 555 or an Arduino pin). RST high returns to Q0.',
      keywords: ['4017', 'cd4017', 'counter', 'decade', 'chaser', 'sequencer'],
      ...d,
      states: [
        { name: 'c', init: 0, next: `${H('RST')} ? 0 : (${H('INH')} ? c : mod(c + max(0, edges(CLK) - pe), 10))` },
        { name: 'pe', init: 'edges(CLK)', next: 'edges(CLK)' },
      ],
      model: {
        elements: [
          ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => dout(`O${n}`, `Q${n}`, `c == ${n}`, 'VCC', 'GND', 300)),
          dout('OC', 'CO', 'c < 5', 'VCC', 'GND', 300),
          ...hiz(['CLK', 'RST', 'INH']),
          quiescent('VCC', 'GND', 1e5),
        ],
      },
      readouts: [{ value: 'c', x: 30, y: 38, size: 4, color: '#555' }],
    };
  })(),
  (() => {
    const names = ['Y4', 'Y6', 'Z', 'Y7', 'Y5', 'E', 'VEE', 'GND', 'S2', 'S1', 'S0', 'Y3', 'Y0', 'Y1', 'Y2', 'VCC'];
    const d = dip(names, { label: '74HC4051', sub: '8-ch analog mux', labels: { Z: 'Common in/out', E: 'Enable (active low)', VEE: 'VEE (tie to GND)', S0: 'Select bit 0', S1: 'Select bit 1', S2: 'Select bit 2' } });
    const sel = `(${H('S0')} + 2 * ${H('S1')} + 4 * ${H('S2')})`;
    return {
      type: '74hc4051', name: '74HC4051 8-channel analog multiplexer', category: 'logic',
      description: 'Connects the common pin Z to one of Y0–Y7 chosen by S2 S1 S0 (a bidirectional analog switch, ~80 Ω on). Read 8 sensors with one analog pin, or route one signal to 8 places. E must be LOW.',
      keywords: ['mux', 'multiplexer', 'demux', '4051', 'cd4051', 'analog switch', 'channel select'],
      ...d,
      model: {
        elements: [
          ...[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `SW${n}`, kind: 'rvar', a: 'Z', b: `Y${n}`, value: `(${LO('E')} && ${sel} == ${n}) ? 80 : 1e10` })),
          ...hiz(['S0', 'S1', 'S2', 'E']),
          { id: 'RZ', kind: 'resistor', a: 'Z', b: 'GND', value: 1e9 },
          { id: 'RV', kind: 'resistor', a: 'VEE', b: 'GND', value: 1e6 },
          quiescent('VCC', 'GND', 1e5),
        ],
      },
    };
  })(),
  (() => {
    const names = ['A0', 'A1', 'A2', 'E1', 'E2', 'E3', 'Y7', 'GND', 'Y6', 'Y5', 'Y4', 'Y3', 'Y2', 'Y1', 'Y0', 'VCC'];
    const d = dip(names, { label: '74HC138', sub: '3-to-8 decoder', labels: { E1: 'Enable 1 (active low)', E2: 'Enable 2 (active low)', E3: 'Enable 3 (active high)', Y0: 'Y0 (active low)' } });
    const addr = `(${H('A0')} + 2 * ${H('A1')} + 4 * ${H('A2')})`;
    const en = `(${LO('E1')} && ${LO('E2')} && ${H('E3')})`;
    return {
      type: '74hc138', name: '74HC138 3-to-8 decoder / demultiplexer', category: 'logic',
      description: 'Drives exactly one of Y0–Y7 LOW, selected by the 3-bit address A2 A1 A0 (all outputs HIGH when disabled). Enable with E1 = E2 = LOW and E3 = HIGH; feed data into an enable to use it as a demultiplexer.',
      keywords: ['decoder', 'demultiplexer', 'demux', '74hc138', '138', 'address decoder', 'chip select'],
      ...d,
      model: {
        elements: [...[0, 1, 2, 3, 4, 5, 6, 7].map((n) => dout(`O${n}`, `Y${n}`, `!(${en} && ${addr} == ${n})`)), ...hiz(['A0', 'A1', 'A2', 'E1', 'E2', 'E3']), quiescent('VCC', 'GND', 1e5)],
      },
    };
  })(),
  (() => {
    const names = ['VDD1', 'VIA', 'VOB', 'GND1', 'GND2', 'VIB', 'VOA', 'VDD2'];
    const d = dip(names, { label: 'ADuM1201', sub: 'digital isolator', color: '#34373c', labels: { VDD1: 'Side 1 supply', VIA: 'Channel A in (side 1)', VOB: 'Channel B out (side 1)', GND1: 'Side 1 ground', GND2: 'Side 2 ground', VIB: 'Channel B in (side 2)', VOA: 'Channel A out (side 2)', VDD2: 'Side 2 supply' } });
    return {
      type: 'adum1201', name: 'ADuM1201 digital isolator', category: 'logic',
      description: 'Two logic channels across a magnetic isolation barrier (A: side 1 → side 2, B: side 2 → side 1). Each side has its own supply and ground — nothing conducts between them. 2.7–5.5 V, up to 10 Mbps.',
      keywords: ['isolator', 'digital isolator', 'adum1201', 'iso7721', 'galvanic isolation'],
      ...d,
      model: {
        elements: [
          dout('OA', 'VOA', H('VIA', 'VDD1', 'GND1'), 'VDD2', 'GND2', 50),
          dout('OB', 'VOB', H('VIB', 'VDD2', 'GND2'), 'VDD1', 'GND1', 50),
          ...hiz(['VIA'], 'GND1', 'RA'),
          ...hiz(['VIB'], 'GND2', 'RB'),
          { id: 'Q1', kind: 'resistor', a: 'VDD1', b: 'GND1', value: 5000 },
          { id: 'Q2', kind: 'resistor', a: 'VDD2', b: 'GND2', value: 5000 },
        ],
      },
    };
  })(),
];
