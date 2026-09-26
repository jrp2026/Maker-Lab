import { COL, chip, circle, contact, d2pak, ecap, line, moduleBoard, path, pads, pcb, pinRow, powerInductor, rect, screwTerminals, silk, smd, smdRow, sot23, statusLed, text, to220, toroid, trimpot3296, usbPort, type Raw } from './kit';

const leads = (y: number, x2 = 20): Raw[] => [line(0, 0, 0, y, '#d63c35', 1.8), line(x2, 0, x2, y, '#26282c', 1.8)];

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
    shapes: [
      ...leads(-8),
      rect(-26, -62, 72, 56, '#34363b', { rx: 3, grad: '#17181b', shadow: 1 }),
      ...[0, 1, 2, 3].flatMap((i) => {
        const x = -21 + i * 16.5, up = i % 2 === 0;
        return [
          rect(x, -58, 13, 38, '#3a3d42', { rx: 2, grad: '#1a1b1e', gradDir: 'h' }),
          rect(x + 0.5, up ? -54 : -57, 12, 33, '#2d6fd1', { rx: 1.5, grad: '#123a78', gradDir: 'h' }),
          rect(x + 0.5, up ? -54 : -32, 12, 8, '#d9dde2', { grad: '#7f8891', gradDir: 'h', rx: 1 }),
          rect(x + 4, up ? -57 : -21, 5, 3, '#c5cbd2', { rx: 1 }),
          rect(x + 2.5, -40, 1.2, 14, '#ffffff', { opacity: 0.25, rx: 0.6 }),
          text(x + 6.5, -36, up ? '+' : '−', 5, '#e8edf6', 'middle', { weight: 800 }),
        ];
      }),
      rect(-6, -17, 16, 7, '#1d1e21', { rx: 1, stroke: '#4a4d53', strokeWidth: 0.4 }), silk(22, -11.5, 'ON', 2.6), silk(-14, -11.5, 'OFF', 2.6),
    ],
    animations: [{ shape: rect(-4, -16, 5, 5, '#e3e7eb', { rx: 1, grad: '#9aa3ad' }), dx: 'on == 1 ? 7 : 0' }],
    model: { nodes: ['M'], elements: [{ id: 'B', kind: 'vsource', p: 'M', n: 'N', value: 'cells * 1.5', r: 0.6 }, contact('S', 'M', 'P', 'on == 1', 0.05)] },
  },
  {
    type: 'battery-snap', name: 'Battery connector (9 V snap)', category: 'power',
    description: 'A 9 V snap clip with red/black leads — clip it onto a 9 V battery (wire the battery’s + and − to the snap) and plug the leads into the breadboard.',
    keywords: ['battery connector', 'battery clip', '9v snap', 'battery leads'],
    pins: [...pinRow(['SP', 'SN'], { y: -40, kind: 'terminal', labels: { SP: 'Snap + (to battery +)', SN: 'Snap − (to battery −)' } }), ...pinRow(['P', 'N'], { labels: { P: 'Red lead +', N: 'Black lead −' } })],
    shapes: [
      path('M0 -36 C-4 -24 4 -12 0 0', 'none', { stroke: '#d63c35', strokeWidth: 1.8 }), path('M10 -36 C14 -24 6 -12 10 0', 'none', { stroke: '#26282c', strokeWidth: 1.8 }),
      rect(-7, -51, 24, 16, '#34363b', { rx: 3, grad: '#111214', shadow: 1 }),
      circle(0, -43, 3.8, '#eef1f4', { grad: '#7f8891', gradDir: 'r' }), circle(0, -43, 1.6, '#5f666e'),
      path('M 10 -47.5 L 13.9 -45.25 L 13.9 -40.75 L 10 -38.5 L 6.1 -40.75 L 6.1 -45.25 Z', '#eef1f4', { grad: '#7f8891', gradDir: 'd' }), circle(10, -43, 2, '#2c2e32'),
    ],
    connections: [['SP', 'P'], ['SN', 'N']],
    model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 1e12 }] },
  },
  liIon({
    type: 'lipo', name: 'LiPo battery (1S, 3.7 V)', caps: [1000, 500, 2000], rint: 0.08,
    description: 'Single-cell lithium-polymer pack: 4.2 V full, 3.7 V nominal, ~3.0 V empty. The charge state drops as you draw current (and rises when charged, e.g. from a TP4056). Do not discharge below 3 V.',
    keywords: ['lipo', 'lithium polymer', '1s', '3.7v', 'rechargeable', 'li-ion'],
    shapes: [
      ...leads(-10),
      rect(-18, -68, 56, 60, '#eceff2', { rx: 3, grad: '#a9b1b9', gradDir: 'd', shadow: 1, stroke: '#8f979f', strokeWidth: 0.5 }),
      rect(-14, -64, 48, 4, '#ffffff', { opacity: 0.5, rx: 2 }),
      rect(-12, -56, 44, 34, '#f3c623', { rx: 1.5, grad: '#d9a50f' }),
      text(10, -44, 'LiPo', 7, '#1d1e21', 'middle', { weight: 800 }), text(10, -36, '3.7V  1S', 3.6, '#1d1e21', 'middle', { weight: 700 }), text(10, -29, 'Li-polymer battery', 2.6, '#5a4a10', 'middle', { weight: 500 }),
      rect(-6, -18, 32, 8, '#f0b429', { rx: 1, opacity: 0.85 }),
    ],
  }),
  liIon({
    type: 'battery-18650', name: '18650 Li-ion cell', caps: [3000, 2500, 3500], rint: 0.05,
    description: 'The common 18 mm × 65 mm lithium-ion cell: 4.2 V full, 3.6–3.7 V nominal, ~3.0 V empty, high current capable. Put it in a holder and protect it with a BMS/protection board.',
    keywords: ['18650', 'li-ion', 'lithium', 'rechargeable', '3.7v', 'cell'],
    shapes: [
      ...leads(-8),
      rect(-32, -36, 84, 28, '#35a86a', { rx: 4, grad: '#0f5a33', shadow: 1 }),
      rect(-30, -34, 80, 5, '#ffffff', { opacity: 0.22, rx: 2 }),
      rect(52, -29, 5, 14, '#eef1f4', { rx: 1.5, grad: '#7f8891' }), rect(-34, -34, 3, 24, '#c5cbd2', { rx: 1 }),
      text(8, -20.5, '18650', 7, '#ffffff', 'middle', { weight: 800 }), text(8, -13.5, '3.7V · Li-ion', 3.4, '#dff5e8', 'middle', { weight: 600 }),
      text(46, -19, '+', 6, '#ffffff', 'middle', { weight: 800 }),
    ],
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
    shapes: [
      ...[0, 10, 20].map((x) => rect(x - 1.4, -10, 2.8, 10, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
      rect(-9, -42, 38, 34, '#34363b', { rx: 2, grad: '#111214', shadow: 1 }),
      rect(-6, -39, 32, 3, '#ffffff', { opacity: 0.08 }),
      circle(10, -25, 9, '#1a1b1e', { stroke: '#4a4d53', strokeWidth: 0.8 }), circle(10, -25, 5.5, '#0c0d0f'),
      circle(10, -25, 1.8, '#eef1f4', { grad: '#8a929b', gradDir: 'r' }),
    ],
    animations: [{ shape: rect(3, -84, 14, 40, '#3a3c41', { rx: 3, grad: '#141517', gradDir: 'h', shadow: 0.8 }), dy: 'plugged == 1 ? 0 : -24' }],
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
    const b = moduleBoard(['VBUS', 'DM', 'DP', 'ID', 'GND'], { h: 36, color: COL.pcbPurple, holes: 'none', labels: { VBUS: 'VBUS (+5 V)', DM: 'D−', DP: 'D+', ID: 'ID', GND: 'GND' } });
    return {
      type: 'usb-breakout', name: 'USB connector (micro-B breakout)', category: 'power',
      description: 'Micro-USB socket on a breakout board, plugged into a computer or phone charger: VBUS gives 5 V (a PC port allows 0.5 A). D+/D− are the data lines (not simulated). Click to unplug.',
      keywords: ['usb', 'micro usb', 'usb connector', 'usb breakout', '5v', 'usb power'],
      pins: b.pins,
      props: [{ key: 'plugged', label: 'Cable', type: 'select', default: 1, options: [{ value: 1, label: 'Plugged in' }, { value: 0, label: 'Unplugged' }] }],
      toggle: 'plugged',
      shapes: [...b.shapes, ...usbPort(20, -36, 'micro', 't'), rect(12, -37.5, 16, 7, '#e7eaee', { rx: 1.2, grad: '#8a929b', stroke: '#6d757e', strokeWidth: 0.4, shadow: 0.8 }), rect(15, -35.5, 10, 3, '#2a2c30', { rx: 0.8 }), silk(20, -21, 'MICRO USB', 2.8)],
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
      shapes: [
        ...pcb(-14, -48, 38, 40, '#1d4f9e', { holes: 'none', rx: 2 }),
        rect(-3, -53, 16, 9, '#eef1f4', { rx: 3.5, grad: '#7f8891', stroke: '#5f666e', strokeWidth: 0.4, shadow: 0.9 }), rect(0, -50.5, 10, 4, '#1a1b1e', { rx: 2 }),
        ...chip(-8, -38, 10, 7, { n: 4, label: 'IP2721' }), ...smdRow(8, -36, 2, 5, false, 'cr'), ...smd(-8, -24, 'c'), ...smd(16, -24, 'r'),
        silk(5, -21, 'PD 5-20V', 2.8),
        ...screwTerminals(out, '#1f9d55'),
      ],
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
    shapes: [
      ...pinRow(['P', 'AC1', 'AC2', 'N']).map((p) => rect(p.x - 1.2, -9, 2.4, 9, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
      rect(-7, -32, 44, 24, '#34363b', { rx: 1.5, grad: '#141517', shadow: 1, stroke: '#0c0d0f', strokeWidth: 0.4 }),
      rect(-7, -32, 3, 24, '#4a4d53', { rx: 1 }),
      text(15, -22, 'KBP307', 4.2, '#c9ccd1', 'middle', { weight: 600 }), text(15, -13.5, '+   ~   ~   −', 4, '#c9ccd1', 'middle', { weight: 700 }),
    ],
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

/** The recognisable top side of each converter module. */
function dcdcLook(look: 'lm2596' | 'mt3608' | 'xl6019'): Raw[] {
  if (look === 'lm2596')
    return [
      ...ecap(3, -36, 8), ...ecap(57, -36, 8),
      ...powerInductor(26, -35, 17, '330'),
      ...d2pak(38, -47, 12, 10, 'LM2596'), rect(40, -33, 8, 4, '#2a2b2e', { rx: 0.5 }), rect(46.5, -33, 1.5, 4, '#d9d9d9'),
      ...trimpot3296(34, -26),
      silk(-4, -14.5, 'IN+  IN-', 2.6, 'start'), silk(64, -14.5, 'OUT+ OUT-', 2.6, 'end'),
    ];
  if (look === 'mt3608')
    return [
      ...powerInductor(10, -36, 11, '220'), ...sot23(26, -38, 'B628'), ...chip(34, -40, 5, 4, { legs: 'none' }),
      ...smdRow(-2, -24, 3, 5, false, 'ccc'), ...smdRow(40, -24, 3, 5, false, 'ccc'),
      ...trimpot3296(42, -48), silk(30, -30, 'MT3608', 3),
      silk(-4, -14.5, 'VIN+ VIN-', 2.6, 'start'), silk(64, -14.5, 'VOUT+ VOUT-', 2.6, 'end'),
    ];
  return [
    ...toroid(18, -32, 11), ...ecap(46, -36, 7.5), ...ecap(-2, -40, 5),
    ...chip(30, -26, 12, 8, { n: 4, label: 'XL6019' }), ...trimpot3296(48, -24),
    silk(-4, -14.5, 'IN+  IN-', 2.6, 'start'), silk(64, -14.5, 'OUT+ OUT-', 2.6, 'end'),
  ];
}

function dcdc(o: { type: string; name: string; title: string; description: string; keywords: string[]; out: string; vset: [number, number, number]; iMax: number; eff: number; color: string; look: 'lm2596' | 'mt3608' | 'xl6019' }): Raw {
  const inp = pinRow(['INP', 'INN'], { kind: 'terminal', labels: { INP: 'IN+', INN: 'IN−' } });
  const outp = pinRow(['OUTP', 'OUTN'], { x0: 50, kind: 'terminal', labels: { OUTP: 'OUT+', OUTN: 'OUT−' } });
  return {
    type: o.type, name: o.name, category: 'power', description: o.description, keywords: o.keywords,
    pins: [...inp, ...outp],
    props: [{ key: 'vset', label: 'Output (trim pot)', type: 'slider', default: o.vset[2], min: o.vset[0], max: o.vset[1], step: 0.05, unit: 'V' }],
    shapes: [...pcb(-10, -54, 80, 48, o.color, { holes: 'corners', rx: 2 }), ...dcdcLook(o.look), ...screwTerminals(inp, '#1f9d55'), ...screwTerminals(outp, '#1f9d55')],
    readouts: [{ value: 'v(OUTP, OUTN)', unit: 'V', x: 30, y: -58, size: 4.5 }],
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
    type: 'buck-converter', name: 'Buck converter (LM2596)', title: 'LM2596 BUCK', color: '#1d5bb8', look: 'lm2596', iMax: 3, eff: 0.88, vset: [1.25, 35, 5],
    out: 'v(INP, INN) > 4 ? min(vset, v(INP, INN) - 1.5) : 0',
    description: 'Step-down switching regulator module (4–40 V in, 1.25–35 V out, 3 A). Efficient: the input draws less current than the output. Turn the trim pot to set the output (it can only go below the input).',
    keywords: ['buck', 'step down', 'lm2596', 'dc-dc', 'switching regulator', 'mp1584'],
  }),
  dcdc({
    type: 'boost-converter', name: 'Boost converter (MT3608)', title: 'MT3608 BOOST', color: '#1d5bb8', look: 'mt3608', iMax: 2, eff: 0.9, vset: [5, 28, 12],
    out: 'v(INP, INN) > 2 ? max(vset, v(INP, INN) - 0.4) : 0',
    description: 'Step-up switching regulator module (2–24 V in, up to 28 V out, 2 A switch). Raises e.g. a 3.7 V LiPo to 5 V or 12 V; the input current is higher than the output current. It cannot go below its input.',
    keywords: ['boost', 'step up', 'mt3608', 'dc-dc', 'xl6009'],
  }),
  dcdc({
    type: 'buck-boost', name: 'Buck-boost converter (XL6019)', title: 'BUCK-BOOST', color: '#1c7040', look: 'xl6019', iMax: 3, eff: 0.85, vset: [1.25, 26, 12],
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
      shapes: [
        ...pcb(-8, -24, 66, 29, '#1d5bb8', { holes: 'none', rx: 1.5 }),
        ...chip(4, -19, 8, 5, { n: 3, label: 'DW01' }), ...chip(18, -20, 12, 7, { n: 4, label: '8205A' }), ...smdRow(33, -17, 2, 5, false, 'rc'),
        ...pads(pins, { BP: 'B+', BN: 'B-', PP: 'P+', PN: 'P-' }),
      ],
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
      shapes: [
        ...pcb(-8, -40, 56, 45, '#1c7040', { holes: 'none', rx: 1.5 }),
        ...[0, 1, 2, 3].map((i) => chip(-4 + i * 12.5, -35, 10, 8, { n: 4, label: 'AO4407' })).flat(),
        ...chip(4, -22, 16, 7, { n: 5, label: 'S-8254' }), ...smdRow(26, -19, 4, 5, false, 'rcrc'),
        ...pads(pins, { BN: 'B-', B1: '1', B2: '2', BP: 'B+', PN: 'P-' }),
      ],
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
    const red = statusLed(52, -40, '#ff3b30', `(${vin} > 4.5 && ${vb} < 4.15) ? 1 : 0`), blue = statusLed(62, -40, '#3b82ff', `(${vin} > 4.5 && ${vb} >= 4.15) ? 1 : 0`);
    return {
      type: 'tp4056', name: 'Li-ion charging module (TP4056)', category: 'power',
      description: 'Single-cell Li-ion/LiPo charger (5 V in): constant current (1 A by default) until the cell reaches 4.2 V, then constant voltage while the current tapers. Red LED = charging, blue = done. Deeply flat cells get a gentle trickle first.',
      keywords: ['tp4056', 'charger', 'li-ion charger', 'lipo charger', '18650 charger', 'cc cv', 'usb charger'],
      pins: [...inp, ...bat, ...out],
      props: [{ key: 'iset', label: 'Charge current (Rprog)', type: 'select', default: 1, options: [{ value: 1, label: '1 A (1.2 kΩ)' }, { value: 0.5, label: '500 mA (2.4 kΩ)' }, { value: 0.13, label: '130 mA (10 kΩ)' }] }],
      shapes: [
        ...pcb(-8, -56, 86, 61, '#1d5bb8', { holes: 'none', rx: 1.5 }),
        rect(-14, -46, 14, 16, '#e7eaee', { rx: 1.2, grad: '#8a929b', gradDir: 'h', stroke: '#6d757e', strokeWidth: 0.4, shadow: 0.9 }), rect(-12.5, -43, 3, 10, '#2a2c30', { rx: 0.8 }),
        ...chip(28, -34, 14, 9, { n: 4, label: 'TP4056' }), ...chip(52, -34, 8, 5, { n: 3, label: 'DW01' }), ...chip(62, -35, 11, 7, { n: 4, label: '8205A' }),
        ...smdRow(6, -24, 4, 5, false, 'rcrc'), ...smdRow(48, -22, 5, 5, false, 'rrcrc'),
        silk(35, -48.5, 'TP4056 1A', 3), silk(52, -44, 'CHRG', 2.2), silk(62, -44, 'STDBY', 2.2),
        ...pads([...inp, ...bat, ...out], { INP: 'IN+', INN: 'IN-', BP: 'B+', BN: 'B-', OUTP: 'OUT+', OUTN: 'OUT-' }),
        red.shape, blue.shape,
      ],
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
      shapes: [
        ...leads(-8, 10),
        rect(-41, -81, 92, 74, '#eef1f4', { rx: 2, grad: '#9aa3ad', gradDir: 'd', shadow: 1 }),
        rect(-38, -78, 86, 68, '#e9edf2'),
        ...Array.from({ length: 24 }, (_, k) => {
          const c = k % 6, r = Math.floor(k / 6);
          return rect(-37.5 + c * 14.2, -77.5 + r * 16.9, 13.6, 16.3, '#2a4f8f', { grad: '#10254a', gradDir: 'd' });
        }),
        ...[0, 1, 2, 3].map((r) => line(-37.5, -69.3 + r * 16.9, 47.5, -69.3 + r * 16.9, '#a9b4c4', 0.5)),
        ...Array.from({ length: 6 }, (_, c) => [line(-33 + c * 14.2, -77.5, -33 + c * 14.2, -10.5, '#c9d2dd', 0.4), line(-26.3 + c * 14.2, -77.5, -26.3 + c * 14.2, -10.5, '#c9d2dd', 0.4)]).flat(),
        rect(-38, -78, 86, 20, '#ffffff', { opacity: 0.07 }),
      ],
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
    const pv = statusLed(5, -42, '#35d05a', `v(PVP, PVN) > ${vb} + 0.5 ? 1 : 0`), bat = statusLed(25, -42, '#ffcc00', `${vb} > 12 ? 1 : 0.3`), ld = statusLed(45, -42, '#ff3b30', 'lvd');
    return {
      type: 'solar-controller', name: 'Solar charge controller (PWM, 12 V)', category: 'power',
      description: 'Charges a 12 V lead-acid/LiFePO4 battery from a solar panel: passes panel current while the battery is below 14.4 V (with reverse-current blocking at night), and switches the load off below 11.1 V (back on above 12.6 V).',
      keywords: ['solar charge controller', 'pwm controller', 'solar', '12v battery', 'off grid', 'mppt'],
      pins,
      shapes: [
        rect(-12, -68, 74, 64, '#fbfcfd', { rx: 5, grad: '#cfd5dc', shadow: 1, stroke: '#a9b1b9', strokeWidth: 0.6 }),
        rect(-6, -62, 62, 14, '#2f6fd6', { rx: 2, grad: '#1d4f9e' }), text(25, -53, 'PWM SOLAR CONTROLLER', 3.3, '#fff', 'middle', { weight: 700 }),
        circle(5, -32, 2.6, '#f2a900'), ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => line(5 + Math.cos((a * Math.PI) / 180) * 3.8, -32 + Math.sin((a * Math.PI) / 180) * 3.8, 5 + Math.cos((a * Math.PI) / 180) * 5.4, -32 + Math.sin((a * Math.PI) / 180) * 5.4, '#f2a900', 0.8)),
        rect(20, -35, 9, 6, 'none', { stroke: '#444', strokeWidth: 0.8, rx: 0.6 }), rect(29, -33.2, 1.2, 2.4, '#444'), rect(21.3, -33.7, 3, 3.4, '#35a86a'),
        circle(45, -33, 3, '#ffe27a', { stroke: '#444', strokeWidth: 0.6 }), rect(43.5, -30.2, 3, 2.4, '#8a929b', { rx: 0.4 }),
        text(5, -22.5, 'PV', 2.8, '#555', 'middle', { weight: 700 }), text(25, -22.5, 'BATT', 2.8, '#555', 'middle', { weight: 700 }), text(45, -22.5, 'LOAD', 2.8, '#555', 'middle', { weight: 700 }),
        ...screwTerminals(pins, '#1f9d55'), pv.shape, bat.shape, ld.shape,
      ],
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
    const outs = [1, 2, 3, 4].flatMap((n) => pinRow([`O${n}P`, `O${n}N`], { x0: 30 + (n - 1) * 30, kind: 'terminal', labels: { [`O${n}P`]: `Output ${n} +`, [`O${n}N`]: `Output ${n} −` } }));
    const led = statusLed(14, -30, '#ff3b30', 'v(INP, INN) > 2 ? 1 : 0');
    return {
      type: 'power-distribution', name: 'Power distribution board', category: 'power',
      description: 'Bus board that fans one supply out to four screw-terminal outputs (all + joined, all − joined), with a power LED — keeps a robot’s wiring tidy.',
      keywords: ['power distribution', 'pdb', 'power bus', 'splitter', 'terminal board'],
      pins: [...inp, ...outs],
      shapes: [
        ...pcb(-10, -42, 150, 38, '#222428', { holes: 'corners', rx: 2 }),
        rect(-2, -40, 136, 5, '#c98a3c', { opacity: 0.55, rx: 1 }), rect(-2, -14, 136, 2, '#c98a3c', { opacity: 0.35 }),
        ...screwTerminals(inp, '#d63c35'), ...[0, 2, 4, 6].flatMap((i) => screwTerminals(outs.slice(i, i + 2), '#2f7fd6')),
        silk(5, -21, 'IN + -', 2.8), ...[1, 2, 3, 4].map((n) => silk(5 + n * 30, -21, `OUT${n} + -`, 2.8)),
        ...ecap(26, -28, 5), silk(70, -30, 'POWER DISTRIBUTION', 3.2), led.shape,
      ],
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
    shapes: [
      line(0, 0, 50, 0),
      rect(-5, -9, 60, 18, '#34363b', { rx: 3, grad: '#111214', shadow: 1 }),
      rect(3, -6, 44, 12, '#1a1b1e', { rx: 2 }),
      rect(6, -4.8, 38, 9.6, '#f4fbfd', { rx: 1.5, grad: '#b9d0d8', opacity: 0.9 }),
      rect(4, -5, 7, 10, '#eef1f4', { rx: 1, grad: '#7f8891', gradDir: 'h' }), rect(39, -5, 7, 10, '#eef1f4', { rx: 1, grad: '#7f8891', gradDir: 'h' }),
      rect(12, -3.8, 26, 1.4, '#ffffff', { opacity: 0.6, rx: 0.7 }),
    ],
    indicators: [{ shape: line(11, 0.5, 39, 0.5, '#5b606b', 0.8), color: '#5b606b', level: 'blown == 1 ? 0 : 1' }],
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
    shapes: [
      line(0, 0, 0, -9, COL.lead, 1.8), line(20, 0, 20, -9, COL.lead, 1.8),
      rect(-5, -30, 30, 22, '#f7d24a', { rx: 7, grad: '#c9960f', gradDir: 'd', shadow: 1 }),
      rect(-1, -27, 14, 4, '#ffffff', { opacity: 0.3, rx: 2 }),
      text(10, -17.5, 'X050', 4.2, '#5a4500', 'middle', { weight: 700 }),
    ],
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
      shapes: [...[0, 20].map((x) => rect(x - 1.2, -12, 2.4, 12, COL.metal, { grad: COL.metalDark, gradDir: 'h' })), ...screwTerminals(w, '#2f7fd6')],
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
      shapes: [
        ...pins.map((p) => rect(p.x - 1.3, -14, 2.6, 12, '#f0d27a', { rx: 0.4, grad: '#a8862e', gradDir: 'h' })),
        rect(-5, -5, 80, 10, '#2e3034', { rx: 1, grad: '#101113', shadow: 1 }),
        ...pins.slice(1).map((p) => line(p.x - 5, -4.5, p.x - 5, 4.5, '#44474d', 0.4)),
      ],
      model: { elements: ids.slice(1).map((id) => ({ id: `R${id}`, kind: 'resistor', a: '1', b: id, value: 1e12 })) },
    };
  })(),
];
