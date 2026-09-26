import { COL, circle, contact, line, moduleBoard, pinRow, rect, screwTerminals, statusLed, text, to220, type Raw } from './kit';

const PN = { P: '+', N: '−' };

// ---------------------------------------------------------------- batteries & inputs

function liIon(o: { type: string; name: string; description: string; keywords: string[]; caps: number[]; shapes: Raw[]; rint: number }): Raw {
  return {
    type: o.type, name: o.name, category: 'power', description: o.description, keywords: o.keywords,
    pins: pinRow(['P', 'N'], { step: 20, kind: 'terminal', labels: PN }),
    props: [
      { key: 'cap', label: 'Capacity', type: 'select', default: o.caps[0], options: o.caps.map((c) => ({ value: c, label: `${c} mAh` })) },
      { key: 'charge', label: 'Initial charge', type: 'slider', default: 80, min: 0, max: 100, step: 1, unit: '%' },
    ],
    shapes: o.shapes,
    states: [{ name: 'soc', init: 'charge / 100', next: 'clamp(soc + i(B) * dt / (cap * 3.6), 0, 1)' }],
    readouts: [{ value: 'round(soc * 100)', unit: '%', x: 10, y: -14, size: 4.5 }],
    model: { elements: [{ id: 'B', kind: 'vsource', p: 'P', n: 'N', value: 'soc > 0.05 ? 3.3 + 0.9 * soc : 2.5 + 16 * soc', r: o.rint }] },
    warnings: [
      { when: 'soc < 0.03', level: 'error', message: 'Over-discharged below ~3 V — this damages a Li-ion cell (use a protection board).' },
      { when: 'i(B) > cap / 1000', level: 'warn', message: 'Charging faster than 1 C.' },
      { when: '-i(B) > cap / 1000 * 3', level: 'warn', message: 'Discharging above 3 C — the cell will heat up.' },
    ],
  };
}

export const POWER_SOURCES: Raw[] = [
  {
    type: 'battery-holder', name: 'Battery holder (AA, with switch)', category: 'power',
    description: 'Holder for 2–4 AA cells (1.5 V each, ~0.15 Ω per cell) with an on/off slide switch. Click it while simulating to switch it.',
    keywords: ['battery holder', 'aa', 'battery box', 'battery pack', '4xaa', 'switch'],
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
    props: [
      { key: 'cells', label: 'Cells', type: 'select', default: 4, options: [{ value: 2, label: '2 × AA (3 V)' }, { value: 3, label: '3 × AA (4.5 V)' }, { value: 4, label: '4 × AA (6 V)' }] },
      { key: 'on', label: 'Switch', type: 'select', default: 1, options: [{ value: 0, label: 'Off' }, { value: 1, label: 'On' }] },
    ],
    toggle: 'on',
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), rect(-24, -60, 68, 52, '#23252a', { rx: 3 }), ...[0, 1, 2, 3].map((i) => rect(-20 + i * 16, -56, 12, 36, '#c9a24a', { rx: 5 })), rect(-6, -16, 16, 6, '#3c4047', { rx: 1 })],
    animations: [{ shape: rect(-4, -15, 5, 4, '#e0e0e0', { rx: 1 }), dx: 'on == 1 ? 7 : 0' }],
    model: { nodes: ['M'], elements: [{ id: 'B', kind: 'vsource', p: 'M', n: 'N', value: 'cells * 1.5', r: 0.6 }, contact('S', 'M', 'P', 'on == 1', 0.05)] },
  },
  {
    type: 'battery-snap', name: 'Battery connector (9 V snap)', category: 'power',
    description: 'A 9 V snap clip with red/black leads — clip it onto a 9 V battery (wire the battery’s + and − to the snap) and plug the leads into the breadboard.',
    keywords: ['battery connector', 'battery clip', '9v snap', 'battery leads'],
    pins: [...pinRow(['SP', 'SN'], { y: -40, kind: 'terminal', labels: { SP: 'Snap + (to battery +)', SN: 'Snap − (to battery −)' } }), ...pinRow(['P', 'N'], { labels: { P: 'Red lead +', N: 'Black lead −' } })],
    shapes: [rect(-6, -50, 22, 14, '#1d1e21', { rx: 3 }), circle(0, -43, 3.5, COL.metal), circle(10, -43, 4, COL.metal), { type: 'path', d: 'M0 -36 C0 -20 0 -10 0 0', stroke: '#d63c35', strokeWidth: 1.6, fill: 'none' }, { type: 'path', d: 'M10 -36 C10 -20 10 -10 10 0', stroke: '#222', strokeWidth: 1.6, fill: 'none' }],
    connections: [['SP', 'P'], ['SN', 'N']],
    model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 1e12 }] },
  },
  liIon({
    type: 'lipo', name: 'LiPo battery (1S, 3.7 V)', caps: [1000, 500, 2000], rint: 0.08,
    description: 'Single-cell lithium-polymer pack: 4.2 V full, 3.7 V nominal, ~3.0 V empty. The charge state drops as you draw current (and rises when charged, e.g. from a TP4056). Do not discharge below 3 V.',
    keywords: ['lipo', 'lithium polymer', '1s', '3.7v', 'rechargeable', 'li-ion'],
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), rect(-16, -64, 52, 56, '#c7cdd4', { rx: 3, stroke: '#9aa3ad', strokeWidth: 0.8 }), rect(-10, -58, 40, 30, '#2f6fd6', { rx: 2 }), text(10, -40, '3.7V LiPo', 5.5, '#fff')],
  }),
  liIon({
    type: 'battery-18650', name: '18650 Li-ion cell', caps: [3000, 2500, 3500], rint: 0.05,
    description: 'The common 18 mm × 65 mm lithium-ion cell: 4.2 V full, 3.6–3.7 V nominal, ~3.0 V empty, high current capable. Put it in a holder and protect it with a BMS/protection board.',
    keywords: ['18650', 'li-ion', 'lithium', 'rechargeable', '3.7v', 'cell'],
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), rect(-30, -34, 80, 26, '#1f7a45', { rx: 5 }), rect(50, -28, 5, 14, COL.metal, { rx: 1 }), text(10, -18, '18650  3.7V', 5.5, '#fff')],
  }),
  {
    type: 'barrel-jack', name: 'DC barrel jack (with wall adapter)', category: 'power',
    description: '5.5 × 2.1 mm DC power jack with a plugged-in wall adapter (choose 5, 9 or 12 V, centre positive). Click it while simulating to unplug/plug. The switch pin SW is connected to the sleeve only while nothing is plugged in.',
    keywords: ['barrel jack', 'dc jack', 'power jack', 'wall adapter', '5.5x2.1', 'power supply'],
    pins: pinRow(['TIP', 'SW', 'SLV'], { kind: 'terminal', labels: { TIP: 'Centre pin (+)', SW: 'Switch', SLV: 'Sleeve (−)' } }),
    props: [
      { key: 'volts', label: 'Adapter', type: 'select', default: 9, options: [{ value: 5, label: '5 V 2 A' }, { value: 9, label: '9 V 1 A' }, { value: 12, label: '12 V 2 A' }] },
      { key: 'plugged', label: 'Plug', type: 'select', default: 1, options: [{ value: 1, label: 'Plugged in' }, { value: 0, label: 'Unplugged' }] },
    ],
    toggle: 'plugged',
    shapes: [line(0, 0, 0, -8, COL.metal, 2), line(10, 0, 10, -8, COL.metal, 2), line(20, 0, 20, -8, COL.metal, 2), rect(-8, -40, 36, 32, '#1d1e21', { rx: 2 }), circle(10, -24, 8, '#3a3e44'), circle(10, -24, 2, COL.metal)],
    animations: [{ shape: rect(4, -80, 12, 36, '#2b2d31', { rx: 3 }), dy: 'plugged == 1 ? 0 : -24' }],
    model: {
      nodes: ['M'],
      elements: [
        { id: 'A', kind: 'vsource', p: 'M', n: 'SLV', value: 'volts', r: 0.3 },
        contact('PL', 'M', 'TIP', 'plugged == 1', 0.02),
        contact('SWC', 'SW', 'SLV', 'plugged == 0', 0.02),
      ],
    },
    warnings: [{ when: '-i(A) > (volts == 9 ? 1 : 2)', level: 'warn', message: 'Drawing more than the adapter’s rated current.' }],
  },
  (() => {
    const b = moduleBoard(['VBUS', 'DM', 'DP', 'ID', 'GND'], { h: 34, color: COL.pcbPurple, labels: { VBUS: 'VBUS (+5 V)', DM: 'D−', DP: 'D+', ID: 'ID', GND: 'GND' } });
    return {
      type: 'usb-breakout', name: 'USB connector (micro-B breakout)', category: 'power',
      description: 'Micro-USB socket on a breakout board, plugged into a computer or phone charger: VBUS gives 5 V (a PC port allows 0.5 A). D+/D− are the data lines (not simulated). Click to unplug.',
      keywords: ['usb', 'micro usb', 'usb connector', 'usb breakout', '5v', 'usb power'],
      pins: b.pins,
      props: [{ key: 'plugged', label: 'Cable', type: 'select', default: 1, options: [{ value: 1, label: 'Plugged in' }, { value: 0, label: 'Unplugged' }] }],
      toggle: 'plugged',
      shapes: [...b.shapes, rect(8, -40, 24, 10, COL.metal, { rx: 2, stroke: COL.metalDark, strokeWidth: 0.6 })],
      model: {
        nodes: ['M'],
        elements: [
          { id: 'U', kind: 'vsource', p: 'M', n: 'GND', value: 5, r: 0.25 },
          contact('PL', 'M', 'VBUS', 'plugged == 1', 0.02),
          ...['DM', 'DP', 'ID'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 })),
        ],
      },
      warnings: [{ when: '-i(U) > 0.5', level: 'warn', message: 'More than 500 mA from a USB 2.0 port.' }],
    };
  })(),
  (() => {
    const out = pinRow(['VOUT', 'GND'], { kind: 'terminal', labels: { VOUT: 'Output +', GND: 'Output −' } });
    return {
      type: 'usbc-power', name: 'USB-C power module (PD trigger)', category: 'power',
      description: 'USB-C socket with a Power Delivery trigger chip: asks the charger for 5, 9, 12, 15 or 20 V (up to 3 A) and puts it on the screw terminals. Click to unplug.',
      keywords: ['usb-c', 'usb c', 'power delivery', 'pd trigger', 'type-c', 'decoy'],
      pins: out,
      props: [
        { key: 'volts', label: 'Requested voltage', type: 'select', default: 12, options: [5, 9, 12, 15, 20].map((v) => ({ value: v, label: `${v} V` })) },
        { key: 'plugged', label: 'Cable', type: 'select', default: 1, options: [{ value: 1, label: 'Plugged in' }, { value: 0, label: 'Unplugged' }] },
      ],
      toggle: 'plugged',
      shapes: [rect(-14, -46, 38, 36, COL.pcbBlack, { rx: 3 }), rect(-4, -52, 18, 8, COL.metal, { rx: 3 }), ...screwTerminals(out, '#1f9d55'), text(5, -24, 'PD', 6, '#fff')],
      model: { nodes: ['M'], elements: [{ id: 'U', kind: 'vsource', p: 'M', n: 'GND', value: 'volts', r: 0.05 }, contact('PL', 'M', 'VOUT', 'plugged == 1', 0.02)] },
      warnings: [{ when: '-i(U) > 3', level: 'error', message: 'More than 3 A from USB-C.' }],
    };
  })(),
];

// ---------------------------------------------------------------- regulators & conversion

/** Linear regulator: NPN pass transistor driven from a reference so OUT = min(vout, IN − dropout). */
function linearReg(ref: string, beta = 1000): Raw[] {
  return [
    { id: 'Q', kind: 'npn', c: 'IN', b: 'B', e: 'OUT', beta },
    { id: 'REF', kind: 'vsource', p: 'B', n: 'GND', value: ref, r: 50 },
    { id: 'IQ', kind: 'isource', p: 'GND', n: 'IN', value: 'v(IN, GND) > 1 ? 0.005 : 0' },
    { id: 'MIN', kind: 'resistor', a: 'OUT', b: 'GND', value: 10000 },
  ];
}

const regWarnings = (rated: number) => [
  { when: 'v(IN, OUT) * i(Q) > 2', level: 'warn', message: 'Dissipating more than 2 W — it needs a heat sink (or use a buck converter).' },
  { when: `i(Q) > ${rated}`, level: 'error', message: `Output current above ${rated} A.` },
];

export const REGULATORS: Raw[] = [
  {
    type: 'reg-78xx', name: 'Voltage regulator (78xx)', category: 'power',
    description: 'Fixed linear regulator (7805 / 7809 / 7812): IN – GND – OUT. Needs IN at least ~2 V above the output; the excess voltage × current becomes heat. Add 0.33 µF / 0.1 µF capacitors in a real build.',
    keywords: ['7805', '7812', '7809', 'lm7805', 'voltage regulator', 'linear regulator', '5v regulator'],
    ...to220(['IN', 'GND', 'OUT'], 'L7805', { IN: 'Input (7–35 V)', GND: 'Ground', OUT: 'Output' }),
    props: [{ key: 'vout', label: 'Type', type: 'select', default: 5, options: [{ value: 5, label: '7805 (5 V)' }, { value: 9, label: '7809 (9 V)' }, { value: 12, label: '7812 (12 V)' }] }],
    summary: 'Linear regulator, 1.5 A, ~2 V dropout',
    model: { nodes: ['B'], elements: linearReg('min(vout + 0.7, max(0, v(IN, GND) - 1.3))') },
    warnings: [...regWarnings(1.5), { when: 'v(IN, GND) > 35', level: 'error', message: 'Input above 35 V.' }],
  },
  {
    type: 'lm317', name: 'Adjustable regulator (LM317)', category: 'power',
    description: 'Adjustable linear regulator: keeps 1.25 V between OUT and ADJ, so with R1 (OUT→ADJ, 240 Ω) and R2 (ADJ→GND): Vout = 1.25 × (1 + R2/R1). 1.2–37 V, 1.5 A, ~2 V dropout.',
    keywords: ['lm317', 'adjustable regulator', 'variable voltage', 'linear regulator', 'current source'],
    ...to220(['ADJ', 'OUT', 'IN'], 'LM317', { ADJ: 'Adjust', OUT: 'Output', IN: 'Input (≤ 40 V)' }),
    model: {
      nodes: ['B'],
      elements: [
        { id: 'Q', kind: 'npn', c: 'IN', b: 'B', e: 'OUT', beta: 1000 },
        { id: 'REF', kind: 'vsource', p: 'B', n: 'ADJ', value: 1.97, r: 50 },
        { id: 'MIN', kind: 'resistor', a: 'OUT', b: 'ADJ', value: 1e6 },
        { id: 'IA', kind: 'resistor', a: 'ADJ', b: 'IN', value: 1e8 },
      ],
    },
    warnings: [{ when: 'v(IN, OUT) * i(Q) > 2', level: 'warn', message: 'Dissipating more than 2 W — add a heat sink.' }, { when: 'i(Q) > 1.5', level: 'error', message: 'Output current above 1.5 A.' }],
  },
  {
    type: 'ams1117', name: 'LDO regulator (AMS1117)', category: 'power',
    description: 'Low-dropout regulator (3.3 V or 5 V, 1 A, ~1.1 V dropout) — the chip that makes 3.3 V on most boards. Pinout GND – OUT – IN.',
    keywords: ['ams1117', 'ldo', '3.3v regulator', 'low dropout', 'lm1117', 'regulator'],
    ...to220(['GND', 'OUT', 'IN'], 'AMS1117', { GND: 'Ground / Adjust', OUT: 'Output', IN: 'Input (≤ 15 V)' }),
    props: [{ key: 'vout', label: 'Output', type: 'select', default: 3.3, options: [{ value: 3.3, label: '3.3 V' }, { value: 5, label: '5.0 V' }] }],
    model: { nodes: ['B'], elements: linearReg('min(vout + 0.7, max(0, v(IN, GND) - 0.4))') },
    warnings: [...regWarnings(1), { when: 'v(IN, GND) > 15', level: 'error', message: 'Input above 15 V.' }],
  },
  {
    type: 'bridge-rectifier', name: 'Bridge rectifier (KBP307)', category: 'power',
    description: 'Four diodes in one package: turns AC (between the two ~ pins) into pulsing DC on + and −, losing ~1.4 V. Add a big smoothing capacitor across + / −.',
    keywords: ['bridge rectifier', 'rectifier', 'kbp307', 'db107', 'ac to dc', 'full wave'],
    pins: pinRow(['P', 'AC1', 'AC2', 'N'], { labels: { P: '+', AC1: '~ AC', AC2: '~ AC', N: '−' } }),
    shapes: [...pinRow(['P', 'AC1', 'AC2', 'N']).map((p) => line(p.x, 0, p.x, -8, COL.metal, 1.8)), rect(-6, -30, 42, 22, COL.ic, { rx: 2 }), text(15, -18, '+  ~  ~  −', 5, '#ddd')],
    model: {
      elements: [
        { id: 'D1', kind: 'diode', a: 'AC1', k: 'P', model: 'power' },
        { id: 'D2', kind: 'diode', a: 'AC2', k: 'P', model: 'power' },
        { id: 'D3', kind: 'diode', a: 'N', k: 'AC1', model: 'power' },
        { id: 'D4', kind: 'diode', a: 'N', k: 'AC2', model: 'power' },
      ],
    },
  },
];

function dcdc(o: { type: string; name: string; title: string; description: string; keywords: string[]; out: string; vset: [number, number, number]; iMax: number; eff: number; color: string }): Raw {
  const inp = pinRow(['INP', 'INN'], { kind: 'terminal', labels: { INP: 'IN+', INN: 'IN−' } });
  const outp = pinRow(['OUTP', 'OUTN'], { x0: 50, kind: 'terminal', labels: { OUTP: 'OUT+', OUTN: 'OUT−' } });
  return {
    type: o.type, name: o.name, category: 'power', description: o.description, keywords: o.keywords,
    pins: [...inp, ...outp],
    props: [{ key: 'vset', label: 'Output (trim pot)', type: 'slider', default: o.vset[2], min: o.vset[0], max: o.vset[1], step: 0.05, unit: 'V' }],
    shapes: [rect(-10, -50, 80, 44, o.color, { rx: 3, stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.8 }), ...screwTerminals(inp, '#1f9d55'), ...screwTerminals(outp, '#1f9d55'), rect(22, -44, 16, 16, '#23252a', { rx: 8 }), rect(4, -44, 12, 10, '#2f6fd6', { rx: 1 }), text(30, -14, o.title, 4.5, '#fff')],
    readouts: [{ value: 'v(OUTP, OUTN)', unit: 'V', x: 30, y: -54, size: 4.5 }],
    connections: [['INN', 'OUTN']],
    model: {
      elements: [
        { id: 'VO', kind: 'vsource', p: 'OUTP', n: 'OUTN', value: o.out, r: 0.05 },
        { id: 'DRAW', kind: 'isource', p: 'INN', n: 'INP', value: `max(0, v(OUTP, OUTN) * -i(VO)) / max(1, v(INP, INN)) / ${o.eff}` },
        { id: 'IQ', kind: 'resistor', a: 'INP', b: 'INN', value: 5000 },
      ],
    },
    warnings: [{ when: `-i(VO) > ${o.iMax}`, level: 'error', message: `Output current above ${o.iMax} A.` }],
  };
}

export const CONVERTERS: Raw[] = [
  dcdc({
    type: 'buck-converter', name: 'Buck converter (LM2596)', title: 'LM2596 BUCK', color: '#1f5fbf', iMax: 3, eff: 0.88, vset: [1.25, 35, 5],
    out: 'v(INP, INN) > 4 ? min(vset, v(INP, INN) - 1.5) : 0',
    description: 'Step-down switching regulator module (4–40 V in, 1.25–35 V out, 3 A). Efficient: the input draws less current than the output. Turn the trim pot to set the output (it can only go below the input).',
    keywords: ['buck', 'step down', 'lm2596', 'dc-dc', 'switching regulator', 'mp1584'],
  }),
  dcdc({
    type: 'boost-converter', name: 'Boost converter (MT3608)', title: 'MT3608 BOOST', color: '#1f5fbf', iMax: 2, eff: 0.9, vset: [5, 28, 12],
    out: 'v(INP, INN) > 2 ? max(vset, v(INP, INN) - 0.4) : 0',
    description: 'Step-up switching regulator module (2–24 V in, up to 28 V out, 2 A switch). Raises e.g. a 3.7 V LiPo to 5 V or 12 V; the input current is higher than the output current. It cannot go below its input.',
    keywords: ['boost', 'step up', 'mt3608', 'dc-dc', 'xl6009'],
  }),
  dcdc({
    type: 'buck-boost', name: 'Buck-boost converter (XL6019)', title: 'BUCK-BOOST', color: '#1f7a45', iMax: 3, eff: 0.85, vset: [1.25, 26, 12],
    out: 'v(INP, INN) > 3.5 ? vset : 0',
    description: 'Automatic step-up/step-down module (3.5–30 V in, 1.25–26 V out): holds the set output whether the input is above or below it — ideal for batteries that sag.',
    keywords: ['buck-boost', 'buck boost', 'sepic', 'xl6019', 'dc-dc', 'automatic'],
  }),
];

// ---------------------------------------------------------------- battery management

export const BATTERY_MGMT: Raw[] = [
  (() => {
    const pins = [...pinRow(['BP', 'BN'], { kind: 'terminal', labels: { BP: 'B+ (cell +)', BN: 'B− (cell −)' } }), ...pinRow(['PP', 'PN'], { x0: 40, kind: 'terminal', labels: { PP: 'P+ (load / charger +)', PN: 'P− (load / charger −)' } })];
    return {
      type: 'liion-protect', name: 'Li-ion protection board (1S, DW01)', category: 'power',
      description: 'DW01 + dual MOSFET protection for one Li-ion cell: disconnects P− if the cell drops below 2.5 V, rises above 4.28 V or the current exceeds ~3 A; reconnects once the cell is back in range. The cell goes on B+/B−, the load/charger on P+/P−.',
      keywords: ['protection board', 'dw01', 'pcm', 'li-ion protection', 'battery protection', '18650'],
      pins,
      shapes: [rect(-10, -30, 70, 24, '#1f5fbf', { rx: 2 }), ...screwTerminals(pins, '#c9a24a'), rect(22, -26, 14, 10, COL.ic, { rx: 1 })],
      connections: [['BP', 'PP']],
      states: [{ name: 'ok', init: 1, next: 'ok == 1 ? ((v(BP, BN) < 2.5 || v(BP, BN) > 4.28 || abs(i(SW)) > 3) ? 0 : 1) : ((v(BP, BN) > 2.9 && v(BP, BN) < 4.15) ? 1 : 0)' }],
      model: { elements: [contact('SW', 'PN', 'BN', 'ok == 1', 0.05), { id: 'BD', kind: 'diode', a: 'BN', k: 'PN', model: 'power' }] },
    };
  })(),
  (() => {
    const pins = pinRow(['BN', 'B1', 'B2', 'BP', 'PN'], { kind: 'terminal', labels: { BN: 'B− (cell 1 −)', B1: 'B1 (cell 1 + / cell 2 −)', B2: 'B2 (cell 2 + / cell 3 −)', BP: 'B+ (cell 3 +, = P+)', PN: 'P− (load / charger −)' } });
    const cells = ['v(B1, BN)', 'v(B2, B1)', 'v(BP, B2)'];
    const lo = `min(${cells.join(', ')})`, hi = `max(${cells.join(', ')})`;
    return {
      type: 'bms-3s', name: 'Battery management system (3S BMS)', category: 'power',
      description: '3-cell (11.1 V) Li-ion BMS: watches every cell — cuts P− off if any cell is below 2.5 V or above 4.25 V or the current exceeds 10 A, and bleeds cells above 4.18 V to balance them. Connect the cell taps B−, B1, B2, B+; the load goes between B+ and P−.',
      keywords: ['bms', '3s', 'battery management', 'balance', '11.1v', '18650 pack', 'li-ion pack'],
      pins,
      shapes: [rect(-10, -40, 60, 34, '#1f7a45', { rx: 2 }), ...screwTerminals(pins, '#c9a24a'), text(20, -24, '3S BMS', 5, '#fff')],
      states: [{ name: 'ok', init: 1, next: `ok == 1 ? ((${lo} < 2.5 || ${hi} > 4.25 || abs(i(SW)) > 10) ? 0 : 1) : ((${lo} > 2.9 && ${hi} < 4.15) ? 1 : 0)` }],
      model: {
        elements: [
          contact('SW', 'PN', 'BN', 'ok == 1', 0.01),
          { id: 'BD', kind: 'diode', a: 'BN', k: 'PN', model: 'power' },
          { id: 'BL1', kind: 'rvar', a: 'B1', b: 'BN', value: `${cells[0]} > 4.18 ? 100 : 1e7` },
          { id: 'BL2', kind: 'rvar', a: 'B2', b: 'B1', value: `${cells[1]} > 4.18 ? 100 : 1e7` },
          { id: 'BL3', kind: 'rvar', a: 'BP', b: 'B2', value: `${cells[2]} > 4.18 ? 100 : 1e7` },
        ],
      },
    };
  })(),
  (() => {
    const inp = pinRow(['INP', 'INN'], { kind: 'terminal', labels: { INP: 'IN+ (5 V, or the USB socket)', INN: 'IN−' } });
    const bat = pinRow(['BP', 'BN'], { x0: 30, kind: 'terminal', labels: { BP: 'B+ (to cell +)', BN: 'B− (to cell −)' } });
    const out = pinRow(['OUTP', 'OUTN'], { x0: 60, kind: 'terminal', labels: { OUTP: 'OUT+ (= B+)', OUTN: 'OUT− (= B−)' } });
    const vin = 'v(INP, INN)', vb = 'v(BP, BN)';
    const red = statusLed(20, -40, '#ff3b30', `(${vin} > 4.5 && ${vb} < 4.15) ? 1 : 0`), blue = statusLed(40, -40, '#3b82ff', `(${vin} > 4.5 && ${vb} >= 4.15) ? 1 : 0`);
    return {
      type: 'tp4056', name: 'Li-ion charging module (TP4056)', category: 'power',
      description: 'Single-cell Li-ion/LiPo charger (5 V in): constant current (1 A by default) until the cell reaches 4.2 V, then constant voltage while the current tapers. Red LED = charging, blue = done. Deeply flat cells get a gentle trickle first.',
      keywords: ['tp4056', 'charger', 'li-ion charger', 'lipo charger', '18650 charger', 'cc cv', 'usb charger'],
      pins: [...inp, ...bat, ...out],
      props: [{ key: 'iset', label: 'Charge current (Rprog)', type: 'select', default: 1, options: [{ value: 1, label: '1 A (1.2 kΩ)' }, { value: 0.5, label: '500 mA (2.4 kΩ)' }, { value: 0.13, label: '130 mA (10 kΩ)' }] }],
      shapes: [rect(-10, -56, 90, 50, COL.pcbBlue, { rx: 3 }), rect(-14, -44, 14, 20, COL.metal, { rx: 2 }), rect(30, -30, 14, 12, COL.ic, { rx: 1 }), ...screwTerminals([...inp, ...bat, ...out], '#c9a24a'), red.shape, blue.shape, text(35, -48, 'TP4056', 4.5, '#fff')],
      indicators: [red.indicator, blue.indicator],
      connections: [['INN', 'BN', 'OUTN'], ['BP', 'OUTP']],
      model: {
        elements: [
          { id: 'CHG', kind: 'isource', p: 'BP', n: 'INP', value: `${vin} > 4.5 ? min(clamp((4.2 - ${vb}) * 25, 0, iset) * (${vb} < 2.9 ? 0.1 : 1), max(0, (${vin} - ${vb} - 0.3) * 10)) : 0` },
          { id: 'IQ', kind: 'resistor', a: 'INP', b: 'INN', value: 5000 },
        ],
      },
    };
  })(),
  (() => {
    const pins = pinRow(['PVP', 'PVN'], { kind: 'terminal', labels: { PVP: 'Solar panel +', PVN: 'Solar panel −' } });
    return {
      type: 'solar-panel', name: 'Solar panel', category: 'power',
      description: 'Photovoltaic panel: a current source proportional to the sunlight, limited to the open-circuit voltage (Voc). Set the irradiance (1000 W/m² = full sun) while simulating. 6 V 1 W: Voc 7.2 V, Isc 0.2 A; 12 V 10 W: Voc 21.6 V, Isc 0.6 A.',
      keywords: ['solar panel', 'solar cell', 'photovoltaic', 'pv', 'sun'],
      pins,
      props: [
        { key: 'sun', label: 'Sunlight', type: 'slider', default: 800, min: 0, max: 1100, step: 10, unit: 'W/m²' },
        { key: 'size', label: 'Panel', type: 'select', default: 1, options: [{ value: 0, label: '6 V 1 W' }, { value: 1, label: '12 V 10 W' }] },
      ],
      drag: 'sun',
      shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(10, 0, 10, -8, '#222', 1.6), rect(-40, -80, 90, 72, '#c0c6cc', { rx: 2 }), rect(-37, -77, 84, 66, '#1c3a6b'), ...[0, 1, 2, 3, 4, 5].map((i) => line(-37 + i * 14, -77, -37 + i * 14, -11, '#8aa0c0', 0.5)), ...[0, 1, 2, 3].map((i) => line(-37, -77 + i * 16.5, 47, -77 + i * 16.5, '#8aa0c0', 0.5))],
      readouts: [{ value: 'sun', unit: 'W/m²', x: 5, y: -86, size: 4.5 }],
      model: {
        elements: [
          { id: 'PH', kind: 'isource', p: 'PVP', n: 'PVN', value: '(size == 1 ? 0.6 : 0.2) * sun / 1000' },
          { id: 'DZ', kind: 'diode', a: 'PVN', k: 'PVP', model: 'zener', vz: 'size == 1 ? 21 : 7' },
          { id: 'RSH', kind: 'resistor', a: 'PVP', b: 'PVN', value: 5000 },
        ],
      },
    };
  })(),
  (() => {
    const pins = pinRow(['PVP', 'PVN', 'BATP', 'BATN', 'LP', 'LN'], { kind: 'terminal', labels: { PVP: 'Solar +', PVN: 'Solar −', BATP: 'Battery +', BATN: 'Battery −', LP: 'Load +', LN: 'Load −' } });
    const vb = 'v(BATP, BATN)';
    const pv = statusLed(5, -40, '#35d05a', `v(PVP, PVN) > ${vb} + 0.5 ? 1 : 0`), bat = statusLed(25, -40, '#ffcc00', `${vb} > 12 ? 1 : 0.3`), ld = statusLed(45, -40, '#ff3b30', 'lvd');
    return {
      type: 'solar-controller', name: 'Solar charge controller (PWM, 12 V)', category: 'power',
      description: 'Charges a 12 V lead-acid/LiFePO4 battery from a solar panel: passes panel current while the battery is below 14.4 V (with reverse-current blocking at night), and switches the load off below 11.1 V (back on above 12.6 V).',
      keywords: ['solar charge controller', 'pwm controller', 'solar', '12v battery', 'off grid', 'mppt'],
      pins,
      shapes: [rect(-10, -64, 70, 58, '#e9ecef', { rx: 4, stroke: '#9aa3ad', strokeWidth: 0.8 }), rect(-4, -58, 58, 12, '#2b2d31', { rx: 1 }), text(25, -50, 'SOLAR CTRL', 4.5, '#fff'), ...screwTerminals(pins, '#1f9d55'), pv.shape, bat.shape, ld.shape],
      indicators: [pv.indicator, bat.indicator, ld.indicator],
      connections: [['PVN', 'BATN', 'LN']],
      states: [{ name: 'lvd', init: 1, next: `lvd == 1 ? (${vb} < 11.1 ? 0 : 1) : (${vb} > 12.6 ? 1 : 0)` }],
      model: {
        nodes: ['X'],
        elements: [
          contact('CH', 'PVP', 'X', `${vb} < 14.4`, 0.05),
          { id: 'DB', kind: 'diode', a: 'X', k: 'BATP', model: 'schottky' },
          contact('LD', 'BATP', 'LP', 'lvd == 1', 0.02),
          { id: 'IQ', kind: 'resistor', a: 'BATP', b: 'BATN', value: 1200 },
        ],
      },
    };
  })(),
];

// ---------------------------------------------------------------- distribution, protection, connectors

export const DISTRIBUTION: Raw[] = [
  (() => {
    const inp = pinRow(['INP', 'INN'], { kind: 'terminal', labels: { INP: 'Input +', INN: 'Input −' } });
    const outs = [1, 2, 3, 4].flatMap((n) => pinRow([`O${n}P`, `O${n}N`], { x0: 30 + (n - 1) * 25, kind: 'terminal', labels: { [`O${n}P`]: `Output ${n} +`, [`O${n}N`]: `Output ${n} −` } }));
    const led = statusLed(60, -30, '#ff3b30', 'v(INP, INN) > 2 ? 1 : 0');
    return {
      type: 'power-distribution', name: 'Power distribution board', category: 'power',
      description: 'Bus board that fans one supply out to four screw-terminal outputs (all + joined, all − joined), with a power LED — keeps a robot’s wiring tidy.',
      keywords: ['power distribution', 'pdb', 'power bus', 'splitter', 'terminal board'],
      pins: [...inp, ...outs],
      shapes: [rect(-10, -40, 130, 34, COL.pcbBlack, { rx: 3 }), ...screwTerminals(inp, '#d63c35'), ...screwTerminals(outs, '#2f7fd6'), led.shape, text(60, -18, 'POWER DIST', 4.5, '#fff')],
      indicators: [led.indicator],
      connections: [['INP', 'O1P', 'O2P', 'O3P', 'O4P'], ['INN', 'O1N', 'O2N', 'O3N', 'O4N']],
      model: { elements: [{ id: 'RL', kind: 'resistor', a: 'INP', b: 'INN', value: 4700 }] },
    };
  })(),
  {
    type: 'fuse', name: 'Fuse holder (5×20 mm fuse)', category: 'power',
    description: 'Glass fuse in a holder: a thin wire that melts if the current stays above its rating (faster the bigger the overload), cutting the circuit. Once blown it stays open — stop and restart the simulation to fit a new one.',
    keywords: ['fuse', 'fuse holder', 'glass fuse', 'protection', 'overcurrent', '5x20'],
    pins: pinRow(['1', '2'], { step: 50 }),
    props: [{ key: 'rating', label: 'Rating', type: 'select', default: 1, options: [0.5, 1, 2, 5].map((a) => ({ value: a, label: `${a} A` })) }],
    shapes: [line(0, 0, 50, 0), rect(-4, -8, 58, 16, '#1d1e21', { rx: 3 }), rect(6, -5, 38, 10, '#e7eef2', { rx: 2, opacity: 0.9 }), rect(4, -5, 6, 10, COL.metal), rect(40, -5, 6, 10, COL.metal)],
    indicators: [{ shape: line(10, 0, 40, 0, '#6b7280', 0.8), color: '#6b7280', level: 'blown == 1 ? 0 : 1' }],
    states: [
      { name: 'h', init: 0, next: 'max(0, h + (i(F) * i(F) / (rating * rating) - 1) * dt)' },
      { name: 'blown', init: 0, next: 'blown == 1 || h > 0.05 ? 1 : 0' },
    ],
    model: { elements: [{ id: 'F', kind: 'rvar', a: '1', b: '2', value: 'blown == 1 ? 1e9 : 0.03' }] },
    warnings: [{ when: 'blown == 1', level: 'error', message: 'The fuse has blown.' }],
  },
  {
    type: 'polyfuse', name: 'Resettable fuse (polyfuse)', category: 'power',
    description: 'PTC polyfuse: a low resistance until an overload (≈ 2 × the hold current) heats it; then it jumps to high resistance and stays hot while the fault remains. Remove the overload and it cools down and resets by itself.',
    keywords: ['polyfuse', 'ptc', 'resettable fuse', 'mf-r', 'overcurrent'],
    pins: pinRow(['1', '2'], { step: 20 }),
    props: [{ key: 'ih', label: 'Hold current', type: 'select', default: 0.5, options: [0.1, 0.25, 0.5, 1.1, 2.5].map((a) => ({ value: a, label: `${a} A` })) }],
    shapes: [line(0, 0, 0, -8, COL.lead, 1.8), line(20, 0, 20, -8, COL.lead, 1.8), rect(-4, -28, 28, 20, '#f2c230', { rx: 5 }), text(10, -16, 'PTC', 5, '#5a4500')],
    indicators: [{ shape: rect(-4, -28, 28, 20, '#ff5722', { rx: 5 }), color: '#ff5722', level: 'tr == 1 ? 0.6 : 0' }],
    states: [
      { name: 'x', init: 0, next: 'x + (i(F) * i(F) * (tr == 1 ? 100 : 0.3) / (ih * ih * 0.3) - x) * dt / 0.5' },
      { name: 'tr', init: 0, next: 'tr == 1 ? (x < 1 ? 0 : 1) : (x > 4 ? 1 : 0)' },
    ],
    model: { elements: [{ id: 'F', kind: 'rvar', a: '1', b: '2', value: 'tr == 1 ? 100 : 0.3' }] },
    warnings: [{ when: 'tr == 1', level: 'warn', message: 'Polyfuse tripped (overload).' }],
  },
  (() => {
    const w = pinRow(['W1', 'W2'], { y: -20, kind: 'terminal', step: 20, labels: { W1: 'Screw 1', W2: 'Screw 2' } });
    const p = pinRow(['P1', 'P2'], { step: 20, labels: { P1: 'Pin 1', P2: 'Pin 2' } });
    return {
      type: 'terminal-block', name: 'Terminal block (2-way screw)', category: 'power',
      description: '5 mm PCB screw terminal: clamp a wire under each screw; the pin below it carries that wire into the board.',
      keywords: ['terminal block', 'screw terminal', 'wire connector', 'pcb terminal'],
      pins: [...w, ...p],
      shapes: [line(0, 0, 0, -12, COL.metal, 2), line(20, 0, 20, -12, COL.metal, 2), ...screwTerminals(w, '#2f7fd6')],
      connections: [['W1', 'P1'], ['W2', 'P2']],
      model: { elements: [{ id: 'R', kind: 'resistor', a: 'P1', b: 'P2', value: 1e12 }] },
    };
  })(),
  (() => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const pins = pinRow(ids);
    return {
      type: 'pin-header', name: 'Pin header (1×8 male)', category: 'power',
      description: 'A strip of 0.1" male header pins — solder it to a module to plug it into a breadboard, or use it as a connector. Each pin is its own connection.',
      keywords: ['pin header', 'header', 'male header', 'connector', 'breakaway'],
      pins,
      shapes: [rect(-5, -4, 80, 8, COL.header, { rx: 1 }), ...pins.map((p) => rect(p.x - 1.2, -12, 2.4, 16, '#d4af37', { rx: 0.4 }))],
      model: { elements: ids.slice(1).map((id) => ({ id: `R${id}`, kind: 'resistor', a: '1', b: id, value: 1e12 })) },
    };
  })(),
];
