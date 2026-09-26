/** More everyday maker parts: discretes, outputs, inputs, sensor modules, a 4-digit display, a panel meter and small power parts. */
import { COL, chip, circle, contact, d2pak, dip, dout, ecap, ledTop, legs, line, meshCan, moduleBoard, motorModel, path, pinRow, rect, rpm, shade, silk, smd, smdRow, sot23, statusLed, text, to92, type Raw } from './kit';
import { comparatorModule } from './sensors';
import { linearReg } from './power';

/** red / black flying leads from the pins up to a body */
const leads = (y: number, x2 = 20): Raw[] => [line(0, 0, 0, y, '#d63c35', 1.8), line(x2, 0, x2, y, '#26282c', 1.8)];

/** 5 mm through-hole dome (LED-shaped package) above two pins 10 apart */
const dome = (color: string, opacity = 0.93): Raw[] => [
  rect(-4.5, -13.5, 19, 3.8, shade(color, 0.1), { rx: 1, grad: shade(color, -0.3), opacity: 0.97 }),
  path('M-3 -12 L-3 -22 A8 8 0 0 1 13 -22 L13 -12 Z', shade(color, 0.3), { grad: shade(color, -0.3), gradDir: 'h', opacity, stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.5, shadow: 0.6 }),
  rect(-0.8, -26, 2, 12, '#ffffff', { opacity: 0.4, rx: 1 }),
];

/** invisible box so a part's bounds (selection, thumbnails) include artwork that only exists as an animation */
const reach = (x: number, y: number, w: number, h: number): Raw => rect(x, y, w, h, '#000000', { opacity: 0 });

const pwrLed = (x: number, y: number, vcc = 'VCC', gnd = 'GND') => statusLed(x, y, '#ff3b30', `v(${vcc}, ${gnd}) > 2.5 ? 1 : 0`);

// ---------------------------------------------------------------- discretes

const phototransistor: Raw = {
  type: 'phototransistor', name: 'Phototransistor (PT333 / L-14F1)', category: 'diodes',
  description: 'A transistor whose base is lit instead of wired: light lets current flow from the collector (short leg) to the emitter. Put a 10 kΩ resistor from +5 V to C and read C (dark = high, bright = low). Set the light level while simulating.',
  keywords: ['phototransistor', 'light sensor', 'pt333', 'optical', 'ambient light'],
  pins: pinRow(['C', 'E'], { labels: { C: 'Collector (short leg)', E: 'Emitter (long leg)' } }),
  props: [{ key: 'lux', label: 'Light', type: 'slider', default: 200, min: 0, max: 2000, step: 1, unit: 'lx' }],
  drag: 'lux',
  shapes: [...legs(pinRow(['C', 'E']), -10), ...dome('#e9eef2', 0.75), circle(5, -20, 2.4, '#3a3d42', { opacity: 0.7 })],
  readouts: [{ value: 'lux', unit: 'lx', x: 5, y: -34, size: 4.2 }],
  model: {
    elements: [
      // photocurrent C → E, collapsing as the transistor saturates
      { id: 'IP', kind: 'isource', p: 'E', n: 'C', value: 'v(C, E) > 0 ? lux * 2.5e-6 * min(1, v(C, E) / 0.25) : 0' },
      { id: 'LK', kind: 'resistor', a: 'C', b: 'E', value: 1e8 },
    ],
  },
};

const bicolorLed: Raw = {
  type: 'bicolor-led', name: 'Bi-colour LED (red / green, common cathode)', category: 'diodes',
  description: 'Two LEDs in one dome sharing the middle (cathode) leg: light R, G or both for yellow. Each colour needs its own ~220 Ω resistor.',
  keywords: ['bicolor', 'bi-colour', 'two colour led', 'red green led', 'status led'],
  pins: pinRow(['R', 'K', 'G'], { labels: { R: 'Red anode', K: 'Common cathode (−)', G: 'Green anode' } }),
  shapes: [
    ...legs(pinRow(['R', 'K', 'G']), -10),
    rect(-4.5, -13.5, 29, 3.8, '#eef0f2', { rx: 1, grad: '#b9c0c8', opacity: 0.97 }),
    path('M0 -12 L0 -22 A10 9 0 0 1 20 -22 L20 -12 Z', '#f4f6f8', { grad: '#c4ccd4', gradDir: 'h', opacity: 0.8, stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.5, shadow: 0.6 }),
    rect(2.6, -27, 2, 12, '#ffffff', { opacity: 0.45, rx: 1 }),
  ],
  indicators: [
    { shape: path('M0 -12 L0 -22 A10 9 0 0 1 20 -22 L20 -12 Z', '#ff2a1a'), color: '#ff2a1a', level: 'clamp(i(DR) / 0.015, 0, 1)' },
    { shape: path('M0 -12 L0 -22 A10 9 0 0 1 20 -22 L20 -12 Z', '#2cff4a', { opacity: 0.8 }), color: '#2cff4a', level: 'clamp(i(DG) / 0.015, 0, 1)' },
  ],
  model: { elements: [{ id: 'DR', kind: 'diode', a: 'R', k: 'K', model: 'led', vf: 1.9 }, { id: 'DG', kind: 'diode', a: 'G', k: 'K', model: 'led', vf: 2.1 }] },
  warnings: [{ when: 'i(DR) > 0.03 || i(DG) > 0.03', level: 'error', message: 'More than 30 mA — add a series resistor on each colour.' }],
};

const bargraph: Raw = (() => {
  const n = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const names = [...n.map((i) => `A${i}`), ...n.map((i) => `K${11 - i}`)];
  const d = dip(names, { label: '', labels: Object.fromEntries(n.flatMap((i) => [[`A${i}`, `Segment ${i} anode`], [`K${i}`, `Segment ${i} cathode`]])) });
  const seg = (i: number) => rect((i - 1) * 10 - 2.6, 8, 5.2, 14, '', { rx: 0.6 });
  return {
    type: 'led-bargraph', name: 'LED bar graph (10 segments)', category: 'diodes',
    description: 'Ten separate LEDs in a DIP-20 block: segment n goes from anode pin n (bottom row) to the cathode straight above it. Perfect for level meters — drive each segment through its own 220 Ω resistor (or a resistor network).',
    keywords: ['bar graph', 'bargraph', 'led bar', 'vu meter', 'level meter', 'dc-10'],
    pins: d.pins, symbol: d.symbol,
    shapes: [
      ...d.shapes,
      rect(-6, 4, 102, 22, '#2d2f33', { rx: 1, grad: '#141517', shadow: 1 }),
      ...n.map((i) => ({ ...seg(i), fill: '#4a3434', stroke: '#1a1111', strokeWidth: 0.4 })),
      rect(-6, 4, 102, 6, '#ffffff', { opacity: 0.05, rx: 1 }),
    ],
    indicators: n.map((i) => ({ shape: { ...seg(i), fill: '#ff2a1a' }, color: '#ff2a1a', level: `clamp(i(D${i}) / 0.01, 0, 1)` })),
    model: { elements: n.map((i) => ({ id: `D${i}`, kind: 'diode', a: `A${i}`, k: `K${i}`, model: 'led', vf: 1.9 })) },
    warnings: [{ when: n.map((i) => `i(D${i}) > 0.03`).join(' || '), level: 'error', message: 'A segment carries more than 30 mA — add series resistors.' }],
  };
})();

const varistor: Raw = {
  type: 'varistor', name: 'Varistor (MOV)', category: 'passive',
  description: 'Metal-oxide varistor: an open circuit at normal voltage that suddenly conducts heavily above its clamping voltage (either polarity), soaking up spikes and surges. Put it across a supply input, after the fuse.',
  keywords: ['varistor', 'mov', 'surge', 'spike', 'overvoltage', 'transient', '10d471'],
  pins: pinRow(['1', '2'], { step: 20 }),
  props: [{ key: 'vz', label: 'Clamping voltage', type: 'select', default: 22, options: [{ value: 22, label: '22 V (10D220)' }, { value: 39, label: '39 V (10D390)' }, { value: 68, label: '68 V (10D680)' }, { value: 470, label: '470 V (10D471, mains)' }] }],
  shapes: [
    ...legs(pinRow(['1', '2'], { step: 20 }), -8),
    circle(10, -22, 13, '#3a7fd0', { grad: '#1c4a8a', gradDir: 'd', shadow: 1, stroke: '#173f7e', strokeWidth: 0.5 }),
    { type: 'ellipse', cx: 6, cy: -28, rx: 6, ry: 3, fill: '#ffffff', opacity: 0.18 },
    text(10, -22, '10D', 4, '#e8edf6', 'middle', { weight: 700 }), text(10, -16.5, 'MOV', 3, '#c2d4ee', 'middle', { weight: 600 }),
  ],
  model: {
    nodes: ['M'],
    elements: [
      { id: 'D1', kind: 'diode', a: 'M', k: '1', model: 'zener', vz: 'vz' },
      { id: 'D2', kind: 'diode', a: 'M', k: '2', model: 'zener', vz: 'vz' },
    ],
  },
  warnings: [{ when: 'abs(i(D1)) > 5', level: 'error', message: 'More than 5 A continuous — a MOV only absorbs short spikes; it will overheat.' }],
};

const lightBulb: Raw = {
  type: 'light-bulb', name: 'Incandescent bulb (E10, 1.2 W)', category: 'output',
  description: 'A tungsten filament: cold it has about a tenth of its hot resistance, so it takes a big inrush current and glows up over a few tens of milliseconds. Pick the 6 V or 12 V version.',
  keywords: ['bulb', 'lamp', 'incandescent', 'filament', 'torch bulb', 'e10'],
  pins: pinRow(['A', 'B'], { step: 20 }),
  props: [{ key: 'vn', label: 'Rating', type: 'select', default: 6, options: [{ value: 6, label: '6 V 0.2 A' }, { value: 12, label: '12 V 0.1 A' }] }],
  shapes: [
    ...legs(pinRow(['A', 'B'], { step: 20 }), -8),
    rect(-2, -20, 24, 12, '#d9dde2', { rx: 1.5, grad: '#7f8891', gradDir: 'h', shadow: 0.8 }),
    ...[-18, -15, -12].map((y) => line(-2, y, 22, y - 1.5, '#8a929b', 0.7)),
    path('M 2 -20 C -8 -30 -4 -50 10 -50 C 24 -50 28 -30 18 -20 Z', '#f6f8fa', { grad: '#cfd8df', gradDir: 'h', opacity: 0.6, stroke: '#aab4bd', strokeWidth: 0.5 }),
    line(6, -20, 7, -36, '#8a929b', 0.6), line(14, -20, 13, -36, '#8a929b', 0.6),
    path('M 7 -36 q 1 -3 2 0 q 1 3 2 0 q 1 -3 2 0', 'none', { stroke: '#6b5c4a', strokeWidth: 0.6 }),
    rect(3, -46, 3, 14, '#ffffff', { opacity: 0.45, rx: 1.5 }),
  ],
  indicators: [
    { shape: path('M 2 -20 C -8 -30 -4 -50 10 -50 C 24 -50 28 -30 18 -20 Z', '#ffd27a'), color: '#ffc04a', level: 'clamp(pow(th, 1.5), 0, 1)' },
    { shape: path('M 7 -36 q 1 -3 2 0 q 1 3 2 0 q 1 -3 2 0', 'none', { stroke: '#fff2b0', strokeWidth: 1 }), color: '#fff2b0', level: 'clamp(th * 2, 0, 1)' },
  ],
  // th: filament heat (1 = rated power); resistance rises from a tenth of hot to hot
  states: [{ name: 'th', init: 0, next: 'clamp(th + (v(A, B) * v(A, B) / (vn * vn / 1.2 * (0.1 + 0.9 * sqrt(th))) / 1.2 - th) * dt / 0.04, 0, 4)' }],
  model: { elements: [{ id: 'F', kind: 'rvar', a: 'A', b: 'B', value: 'vn * vn / 1.2 * (0.1 + 0.9 * sqrt(th))' }] },
  readouts: [{ value: 'abs(i(F))', unit: 'A', x: 10, y: -54, size: 4 }],
  warnings: [{ when: 'abs(v(A, B)) > vn * 1.3', level: 'error', message: 'Well above the rated voltage — the filament will burn out.' }],
  maxStep: 1e-3,
};

const hall49e: Raw = (() => {
  const pk = to92(['VCC', 'GND', 'OUT'], '49E', COL.ic, { VCC: '+3–6.5 V', OUT: 'Analog out (VCC/2 at 0 mT)' });
  return {
    type: 'hall-49e', name: 'Linear Hall sensor (SS49E)', category: 'sensors',
    description: 'Analog magnetic-field sensor: OUT sits at VCC/2 with no field and moves ~14 mV per mT (at 5 V) — up for a south pole, down for a north pole. Measures magnet distance, position or current. Press it to bring a magnet close, or set the field.',
    keywords: ['hall', 'ss49e', '49e', 'linear hall', 'magnetic field', 'magnet sensor', 'analog hall'],
    ...pk,
    props: [{ key: 'field', label: 'Magnetic field', type: 'slider', default: 0, min: -150, max: 150, step: 1, unit: 'mT' }],
    drag: 'field', interactive: 'press',
    readouts: [{ value: 'pressed == 1 ? 100 : field', unit: 'mT', x: 10, y: -24, size: 4 }],
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VCC, GND) > 2.7 ? clamp(v(VCC, GND) / 2 + 0.0028 * v(VCC, GND) * (pressed == 1 ? 100 : field), 0.2, v(VCC, GND) - 0.2) : 0', r: 100 },
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 800 },
      ],
    },
  };
})();

const powerResistor: Raw = {
  type: 'power-resistor', name: 'Power resistor (5 W / 10 W cement)', category: 'passive',
  description: 'Wire-wound resistor in a white ceramic block for loads, current limiting and dummy loads. Mind the watts: P = I² × R. It gets hot long before it fails.',
  keywords: ['power resistor', 'cement resistor', 'wirewound', '5w', '10w', 'load resistor', 'dummy load'],
  pins: pinRow(['A', 'B'], { step: 40 }),
  props: [
    { key: 'resistance', label: 'Resistance', type: 'number', default: 10, unit: 'Ω', min: 0.01 },
    { key: 'watts', label: 'Rating', type: 'select', default: 5, options: [{ value: 5, label: '5 W' }, { value: 10, label: '10 W' }] },
  ],
  shapes: [
    line(0, 0, 0, -4, COL.lead, 1.8), line(40, 0, 40, -4, COL.lead, 1.8), line(0, -4, 40, -4, shade(COL.lead, -0.2), 1.6),
    rect(-2, -14, 44, 12, '#f4f2ec', { rx: 1, grad: '#c9c5b8', gradDir: 'd', shadow: 1, stroke: '#b2ad9d', strokeWidth: 0.5 }),
    text(20, -6.5, 'SQP 5W', 3.8, '#3a3a3a', 'middle', { weight: 700 }),
  ],
  indicators: [{ shape: rect(-2, -14, 44, 12, '#ff5a1a', { rx: 1 }), color: '#ff5a1a', level: 'clamp((v(A, B) * v(A, B) / resistance / watts - 0.5) * 0.8, 0, 0.7)' }],
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'A', b: 'B', value: 'resistance' }] },
  readouts: [{ value: 'v(A, B) * v(A, B) / resistance', unit: 'W', x: 20, y: -18, size: 4 }],
  warnings: [{ when: 'v(A, B) * v(A, B) / resistance > watts', level: 'error', message: 'Dissipating more than its power rating.' }],
};

// ---------------------------------------------------------------- outputs

const activeBuzzer: Raw = {
  type: 'active-buzzer', name: 'Active buzzer (5 V)', category: 'output',
  description: 'A buzzer with its own oscillator: just apply 3–5 V (a pin is fine, ~25 mA) and it beeps at ~2.3 kHz. No tone() needed — unlike a passive buzzer / piezo it can play only its one note. The long leg is +.',
  keywords: ['active buzzer', 'buzzer', 'beeper', 'alarm', 'beep', 'sounder'],
  pins: pinRow(['P', 'N'], { labels: { P: '+ (long leg)', N: '−' } }),
  shapes: [
    ...legs(pinRow(['P', 'N']), -8),
    circle(5, -24, 13, '#2d2f33', { grad: '#111214', gradDir: 'd', shadow: 1 }),
    circle(5, -24, 11, 'none', { stroke: '#3c3f44', strokeWidth: 0.6 }),
    circle(5, -24, 2.2, '#050505'),
    text(-3, -31, '+', 5, '#9ea2a8', 'middle', { weight: 700 }),
    rect(-6, -38, 7, 3, '#ffffff', { opacity: 0.08, rx: 1.5 }),
  ],
  sound: 'v(P, N) > 2.5 ? 2300 : 0',
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 180 }] },
  warnings: [{ when: 'v(P, N) < -0.5', level: 'warn', message: 'Reversed — the buzzer stays silent.' }, { when: 'v(P, N) > 8', level: 'error', message: 'Above its 3–5 V rating (use the 12 V version).' }],
};

const trafficLight: Raw = (() => {
  const b = moduleBoard(['GND', 'R', 'Y', 'G'], { h: 76, w: 40, color: COL.pcbBlack, holes: 'top', labels: { R: 'Red (HIGH = on)', Y: 'Yellow (HIGH = on)', G: 'Green (HIGH = on)' } });
  const cx = 15;
  const lamps: [string, string, number][] = [['R', '#ff2a1a', -64], ['Y', '#ffc21a', -46], ['G', '#2cff4a', -28]];
  return {
    type: 'traffic-light', name: 'Traffic light module (R / Y / G)', category: 'output',
    description: 'Three 8 mm LEDs with their resistors already on the board — wire R, Y and G straight to Arduino pins (HIGH = on) and GND to ground. The classic first "state machine" project.',
    keywords: ['traffic light', 'traffic lights', 'stop light', 'red yellow green', 'led module'],
    pins: b.pins,
    shapes: [
      ...b.shapes,
      ...lamps.flatMap(([, c, y]) => [circle(cx, y, 7.4, '#15161a', { stroke: '#3a3d42', strokeWidth: 0.6 }), ...ledTop(cx, y, 6, shade(c, -0.55))]),
      ...smdRow(29, -60, 3, 16, true, 'rrr'),
    ],
    indicators: lamps.map(([k, c, y]) => ({ shape: circle(cx, y, 6, c), color: c, level: `clamp(i(D${k}) / 0.008, 0, 1)` })),
    model: {
      nodes: ['NR', 'NY', 'NG'],
      elements: lamps.flatMap(([k]) => [{ id: `R${k}`, kind: 'resistor', a: k, b: `N${k}`, value: 220 }, { id: `D${k}`, kind: 'diode', a: `N${k}`, k: 'GND', model: 'led', vf: k === 'G' ? 2.2 : 1.95 }]),
    },
  };
})();

const rgbModule: Raw = (() => {
  const b = moduleBoard(['R', 'G', 'B', 'GND'], { h: 40, color: COL.pcbBlack, title: 'KY-016', titleY: -15.5, titleSize: 3, labels: { R: 'Red (HIGH = on, PWM for mixing)', G: 'Green', B: 'Blue' } });
  const cols: [string, string][] = [['R', '#ff2a1a'], ['G', '#2cff4a'], ['B', '#2a6bff']];
  const lens = path('M5 -24 L5 -32 A10 10 0 0 1 25 -32 L25 -24 Z', '');
  return {
    type: 'rgb-led-module', name: 'RGB LED module (KY-016)', category: 'diodes',
    description: 'A common-cathode RGB LED with its three resistors on a little board: drive R, G and B from PWM pins (analogWrite) to mix any colour. No extra resistors needed.',
    keywords: ['rgb', 'rgb led module', 'ky-016', 'colour mixing', 'full colour led'],
    pins: b.pins,
    shapes: [
      ...b.shapes,
      rect(3.5, -26, 23, 4, '#eef0f2', { rx: 1, grad: '#b9c0c8', opacity: 0.95 }),
      { ...lens, fill: '#f4f6f8', grad: '#c4ccd4', gradDir: 'h', opacity: 0.85, stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.5, shadow: 0.6 },
      rect(8, -38, 2, 11, '#ffffff', { opacity: 0.5, rx: 1 }),
      ...smdRow(-2, -16, 3, 5, false, 'rrr'),
    ],
    indicators: cols.map(([k, c]) => ({ shape: { ...lens, fill: c, opacity: 0.75 }, color: c, level: `clamp(i(D${k}) / 0.01, 0, 1)` })),
    model: {
      nodes: ['NR', 'NG', 'NB'],
      elements: cols.flatMap(([k]) => [{ id: `R${k}`, kind: 'resistor', a: k, b: `N${k}`, value: 150 }, { id: `D${k}`, kind: 'diode', a: `N${k}`, k: 'GND', model: 'led', vf: k === 'R' ? 1.9 : 2.8 }]),
    },
  };
})();

const vibrationMotor: Raw = {
  type: 'vibration-motor', name: 'Vibration motor (coin, 10 mm)', category: 'output',
  description: 'The buzz motor from phones: an off-centre weight in a flat coin. 2.5–3.5 V, ~70 mA — too much for a pin, so switch it with a transistor (and add a flyback diode).',
  keywords: ['vibration motor', 'coin motor', 'haptic', 'buzz', 'rumble', 'pager motor'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (blue)' } }),
  shapes: [
    line(0, 0, 4, -14, '#d63c35', 1.4), line(20, 0, 16, -14, '#2f6fd6', 1.4),
    circle(10, -24, 11, '#e3e7eb', { grad: '#7f8891', gradDir: 'd', shadow: 1, stroke: '#6b737c', strokeWidth: 0.5 }),
    circle(10, -24, 8.5, '#f2d24a', { opacity: 0.35 }), text(10, -22.5, '1027', 3, '#4a5058', 'middle', { weight: 700 }),
  ],
  // the coin shakes while it runs
  animations: [{ shape: circle(10, -24, 11.4, 'none', { stroke: '#9aa3ad', strokeWidth: 0.6 }), dx: 'on == 1 ? sin(t * 1900) * 1.2 : 0', dy: 'on == 1 ? cos(t * 2300) * 1.2 : 0' }],
  states: [{ name: 'on', init: 0, next: 'abs(i(R)) > 0.03 ? 1 : 0' }],
  model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 40 }] },
  warnings: [{ when: 'abs(v(P, N)) > 4', level: 'warn', message: 'Rated for 2.5–3.5 V.' }],
};

const dcFan: Raw = (() => {
  const m = motorModel('P', 'N', { r: 20, k: 0.0048, j: 2e-6, i0: 0.08 });
  const blades = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * 360;
    return `M 10 -32 L ${10 + Math.cos(((a - 8) * Math.PI) / 180) * 17} ${-32 + Math.sin(((a - 8) * Math.PI) / 180) * 17} A 17 17 0 0 1 ${10 + Math.cos(((a + 26) * Math.PI) / 180) * 17} ${-32 + Math.sin(((a + 26) * Math.PI) / 180) * 17} Z`;
  }).join(' ');
  return {
    type: 'dc-fan', name: 'Cooling fan (40 mm, 5 V)', category: 'output',
    description: 'Brushless 40 mm fan for cooling regulators, drivers and enclosures: 5 V, ~0.1 A, spins up in a second or so. Red is +, black is −. Switch it with a transistor; slow it with PWM.',
    keywords: ['fan', 'cooling fan', '40mm fan', '5v fan', 'blower', 'ventilation'],
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
    shapes: [
      ...leads(-10),
      rect(-12, -54, 44, 44, '#2d2f33', { rx: 3, grad: '#15161a', gradDir: 'd', shadow: 1 }),
      ...[[-8, -50], [28, -50], [-8, -14], [28, -14]].map(([x, y]) => circle(x, y, 1.8, '#050505', { stroke: '#4a4d53', strokeWidth: 0.4 })),
      circle(10, -32, 19.5, '#0c0d0f'),
    ],
    // blades and the round hub sticker on top of them
    animations: [path(blades, '#3a3d42', { grad: '#1f2124', gradDir: 'r', stroke: '#4a4d53', strokeWidth: 0.4 }), circle(10, -32, 6, '#2a2c30', { grad: '#111214', gradDir: 'r', stroke: '#4a4d53', strokeWidth: 0.4 })]
      .map((shape) => ({ shape, rotate: 'angle * 30', cx: 10, cy: -32 })),
    readouts: [{ value: rpm(), unit: 'rpm', x: 10, y: -58, size: 4 }],
    states: m.states,
    model: { nodes: m.nodes, elements: [...m.elements, { id: 'RV', kind: 'diode', a: 'N', k: 'P', model: 'silicon' }] },
    warnings: [{ when: 'v(P, N) > 6.5', level: 'error', message: 'Rated for 5 V.' }],
  };
})();

const waterPump: Raw = (() => {
  const m = motorModel('P', 'N', { r: 8, k: 0.003, j: 1e-6, i0: 0.12 });
  return {
    type: 'water-pump', name: 'Mini water pump (3–6 V submersible)', category: 'output',
    description: 'Tiny submersible pump for plant waterers and fountains: ~120 L/h at 5 V, drawing ~0.2 A (switch it with a transistor or relay). Never run it dry for long.',
    keywords: ['pump', 'water pump', 'submersible', 'plant watering', 'irrigation', 'fountain'],
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
    shapes: [
      ...leads(-10),
      rect(-6, -50, 32, 40, '#f4f2ec', { rx: 4, grad: '#b9b5a8', gradDir: 'h', shadow: 1, stroke: '#9c988b', strokeWidth: 0.5 }),
      rect(-6, -26, 32, 5, '#d9d5c8', { opacity: 0.8 }),
      ...Array.from({ length: 5 }, (_, i) => rect(-2 + i * 6, -47, 2.4, 14, '#6a665b', { rx: 1 })),
      rect(26, -48, 12, 6, '#eeeae0', { rx: 1, grad: '#a9a597' }), rect(36, -50, 3, 10, '#d9d5c8', { rx: 1 }),
    ],
    indicators: [{ shape: path('M 39 -46 C 48 -46 52 -40 54 -30 L 50 -30 C 48 -38 45 -43 39 -43 Z', '#4aa3ff'), color: '#4aa3ff', level: 'clamp(w / 1200, 0, 0.9)' }],
    readouts: [{ value: 'max(0, w * 0.09)', unit: 'L/h', x: 10, y: -54, size: 4 }],
    states: m.states,
    model: { nodes: m.nodes, elements: m.elements },
    warnings: [{ when: 'abs(v(P, N)) > 7', level: 'error', message: 'Rated for 3–6 V.' }],
  };
})();

const electromagnet: Raw = {
  type: 'electromagnet', name: 'Lifting electromagnet (5 V, 25 N)', category: 'output',
  description: 'A coil in a steel cup that grabs iron while powered (~2.5 kg at 5 V, 0.25 A) — pick-and-place toys, door holders, magnetic locks. It is an inductor: drive it with a transistor and put a flyback diode across it.',
  keywords: ['electromagnet', 'magnet', 'lifting magnet', 'solenoid', 'magnetic lock', 'holding magnet'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
  shapes: [
    ...leads(-10),
    rect(-6, -34, 32, 24, '#e3e7eb', { rx: 2, grad: '#7f8891', gradDir: 'h', shadow: 1, stroke: '#5f666e', strokeWidth: 0.5 }),
    rect(-6, -34, 32, 4, '#f4f6f8', { rx: 1.5, opacity: 0.6 }),
    rect(-6, -14, 32, 4, '#5f666e', { rx: 1 }),
    text(10, -21, 'KK-P25', 3.2, '#3a3f45', 'middle', { weight: 700 }),
    reach(-2, -52, 24, 6),
  ],
  animations: [{ shape: rect(-2, -52, 24, 6, '#6b737c', { rx: 1, grad: '#3c4148', gradDir: 'h', stroke: '#2a2e33', strokeWidth: 0.5 }), dy: 'on == 1 ? 12 : 0' }],
  states: [{ name: 'on', init: 0, next: 'abs(i(R)) > 0.15 ? 1 : (abs(i(R)) < 0.06 ? 0 : on)' }],
  readouts: [{ value: 'min(25, abs(i(R)) * 100)', unit: 'N', x: 10, y: -56, size: 4 }],
  model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'M', value: 20 }, { id: 'L', kind: 'inductor', a: 'M', b: 'N', value: 0.05 }] },
  warnings: [{ when: 'abs(v(P, N)) > 7', level: 'error', message: 'Rated for 5 V.' }],
  maxStep: 5e-4,
};

// ---------------------------------------------------------------- inputs

const limitSwitch: Raw = {
  type: 'limit-switch', name: 'Limit switch (micro switch with lever)', category: 'switches',
  description: 'Snap-action micro switch: COM connects to NC at rest and to NO while the lever is pushed. Used as end stops on 3D printers and CNCs. Press it while simulating.',
  keywords: ['limit switch', 'micro switch', 'microswitch', 'end stop', 'endstop', 'lever switch', 'snap action'],
  pins: pinRow(['COM', 'NO', 'NC'], { step: 20, labels: { COM: 'C (common)', NO: 'NO (normally open)', NC: 'NC (normally closed)' } }),
  interactive: 'press',
  shapes: [
    ...pinRow(['COM', 'NO', 'NC'], { step: 20 }).map((p) => rect(p.x - 1.6, -10, 3.2, 10, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(-8, -30, 56, 21, '#2d2f33', { rx: 1.5, grad: '#141517', shadow: 1 }),
    circle(4, -19.5, 2.2, '#0a0a0b'), circle(36, -19.5, 2.2, '#0a0a0b'),
    rect(17, -33, 6, 3, '#d63c35', { rx: 1 }),
    silk(-4, -12, 'C', 2.6), silk(20, -12, 'NO', 2.6), silk(40, -12, 'NC', 2.6),
  ],
  animations: [rect(-6, -36, 54, 2.4, '#d5d9de', { rx: 1, grad: '#8a929b' }), circle(48, -37, 2.6, '#d5d9de', { grad: '#8a929b', gradDir: 'r' })].map((shape) => ({ shape, rotate: 'pressed == 1 ? 4 : -6', cx: -6, cy: -35 })),
  model: { elements: [contact('SO', 'COM', 'NO', 'pressed == 1'), contact('SC', 'COM', 'NC', 'pressed == 0')] },
};

const touchSensor: Raw = (() => {
  const b = moduleBoard(['SIG', 'VCC', 'GND'], { h: 36, color: '#d63c35', holes: 'none', labels: { SIG: 'SIG (HIGH while touched)', VCC: '+2–5.5 V' } });
  const l = statusLed(-2, -14, '#ff3b30', 'on');
  return {
    type: 'touch-sensor', name: 'Capacitive touch sensor (TTP223)', category: 'switches',
    description: 'A touch button with no moving parts: SIG goes HIGH while a finger is on the pad (through thin plastic too). Read it like a button with digitalRead — no pull-up needed. Press the pad while simulating.',
    keywords: ['touch', 'capacitive', 'ttp223', 'touch button', 'touch sensor', 'touch pad'],
    pins: b.pins, interactive: 'press',
    shapes: [
      ...b.shapes,
      circle(10, -28, 10, '#e8c26a', { grad: '#b88f2a', gradDir: 'r', stroke: '#9c7a22', strokeWidth: 0.5 }),
      circle(10, -28, 7.5, 'none', { stroke: '#f6e3a8', strokeWidth: 0.6, opacity: 0.8 }),
      ...sot23(23, -14, '223'), ...smd(-2, -20, 'c', true),
      l.shape,
    ],
    states: [{ name: 'on', init: 0, next: 'pressed == 1 && v(VCC, GND) > 2 ? 1 : 0' }],
    indicators: [l.indicator],
    model: { elements: [dout('O', 'SIG', 'on == 1', 'VCC', 'GND', 200), { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e5 }] },
  };
})();

const rockerSwitch: Raw = {
  type: 'rocker-switch', name: 'Rocker switch (KCD1)', category: 'switches',
  description: 'The panel power switch found on power strips: I = on (the two pins connected), O = off. Rated 6 A at 250 V AC. Click it while simulating.',
  keywords: ['rocker', 'rocker switch', 'kcd1', 'power switch', 'panel switch', 'on off'],
  pins: pinRow(['1', '2'], { step: 20 }),
  props: [{ key: 'on', label: 'Position', type: 'select', default: 0, options: [{ value: 0, label: 'O (off)' }, { value: 1, label: 'I (on)' }] }],
  toggle: 'on',
  shapes: [
    ...pinRow(['1', '2'], { step: 20 }).map((p) => rect(p.x - 2, -8, 4, 8, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(-6, -36, 32, 28, '#2d2f33', { rx: 2, grad: '#111214', shadow: 1 }),
    rect(-3, -33, 26, 22, '#d63c35', { rx: 1.5, grad: '#8a1f1a', gradDir: 'v' }),
    text(10, -25.5, 'I', 4.4, '#fbe3e1', 'middle', { weight: 800 }), circle(10, -16.5, 2.2, 'none', { stroke: '#fbe3e1', strokeWidth: 0.8 }),
  ],
  animations: [{ shape: rect(-3, -33, 26, 11, '#000000', { rx: 1.5, opacity: 0.28 }), dy: 'on == 1 ? 11 : 0' }],
  model: { elements: [contact('S', '1', '2', 'on == 1')] },
};

const slidePot: Raw = {
  type: 'slide-pot', name: 'Slide potentiometer (10 kΩ, 60 mm)', category: 'passive',
  description: 'A linear fader like on a mixing desk: the wiper (W) moves from pin 1 to pin 2 as you slide the knob. Wire 1 to GND, 2 to 5 V and read W with analogRead. Drag the knob while simulating.',
  keywords: ['slide pot', 'slider', 'fader', 'linear potentiometer', 'slide potentiometer', 'mixer'],
  pins: pinRow(['1', 'W', '2'], { step: 30 }),
  props: [
    { key: 'r', label: 'Resistance', type: 'number', default: 10000, unit: 'Ω', min: 10 },
    { key: 'pos', label: 'Position', type: 'slider', default: 0.5, min: 0, max: 1 },
  ],
  drag: 'pos',
  shapes: [
    ...legs(pinRow(['1', 'W', '2'], { step: 30 }), -8),
    rect(-10, -24, 80, 16, '#dfe3e7', { rx: 1, grad: '#8a929b', gradDir: 'd', shadow: 1, stroke: '#6b737c', strokeWidth: 0.5 }),
    rect(-4, -17.5, 68, 3, '#1b1c1f', { rx: 1.5 }),
    ...Array.from({ length: 11 }, (_, i) => line(-2 + i * 6.4, -22, -2 + i * 6.4, -20, '#4a4f55', 0.5)),
  ],
  animations: [rect(-6, -30, 8, 28, '#2d2f33', { rx: 1.2, grad: '#111214', gradDir: 'h', shadow: 1 }), rect(-6, -17, 8, 2, '#f4f6f8')].map((shape) => ({ shape, dx: 'pos * 64' })),
  model: { elements: [{ id: 'RA', kind: 'rvar', a: '1', b: 'W', value: 'max(0.5, r * pos)' }, { id: 'RB', kind: 'rvar', a: 'W', b: '2', value: 'max(0.5, r * (1 - pos))' }] },
};

const fsr: Raw = {
  type: 'fsr', name: 'Force-sensitive resistor (FSR402)', category: 'sensors',
  description: 'A pad whose resistance drops as you press it: >1 MΩ untouched, ~30 kΩ at a light touch, a few kΩ at a firm press. Use a 10 kΩ divider and analogRead. Press it, or set the force, while simulating.',
  keywords: ['fsr', 'force sensor', 'pressure sensor', 'fsr402', 'force sensitive resistor', 'weight', 'squeeze'],
  pins: pinRow(['1', '2']),
  props: [{ key: 'force', label: 'Force', type: 'slider', default: 0, min: 0, max: 20, step: 0.1, unit: 'N' }],
  drag: 'force', interactive: 'press',
  shapes: [
    ...pinRow(['1', '2']).map((p) => rect(p.x - 1.2, -8, 2.4, 8, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(-4, -34, 18, 27, '#e7d9a8', { rx: 1, grad: '#b8a46a', gradDir: 'h', stroke: '#9c8a55', strokeWidth: 0.4 }),
    line(1.5, -8, 1.5, -34, '#8a6a2a', 0.6), line(8.5, -8, 8.5, -34, '#8a6a2a', 0.6),
    circle(5, -48, 16, '#2d2f33', { grad: '#141517', gradDir: 'd', shadow: 1 }),
    circle(5, -48, 12.5, '#3a3d42', { stroke: '#55595f', strokeWidth: 0.5 }),
    text(5, -46.5, 'FSR', 4.2, '#9ea2a8', 'middle', { weight: 700 }),
  ],
  indicators: [{ shape: circle(5, -48, 12.5, '#ffffff'), color: '#ffffff', level: 'clamp((pressed == 1 ? 10 : force) / 40, 0, 0.3)' }],
  readouts: [{ value: 'pressed == 1 ? max(force, 10) : force', unit: 'N', x: 5, y: -68, size: 4 }],
  model: { elements: [{ id: 'R', kind: 'rvar', a: '1', b: '2', value: '(pressed == 1 ? max(force, 10) : force) < 0.1 ? 1e7 : 30000 / pow(pressed == 1 ? max(force, 10) : force, 0.9)' }] },
};

const flexSensor: Raw = {
  type: 'flex-sensor', name: 'Flex sensor (2.2")', category: 'sensors',
  description: 'A strip whose resistance rises as it bends: ~25 kΩ flat to ~100 kΩ at 90°. Glove controllers and robotic fingers — read it in a divider with a 47 kΩ resistor. Set the bend angle while simulating.',
  keywords: ['flex sensor', 'bend sensor', 'flex', 'glove', 'finger', 'bend'],
  pins: pinRow(['1', '2']),
  props: [{ key: 'bend', label: 'Bend', type: 'slider', default: 0, min: 0, max: 90, step: 1, unit: '°' }],
  drag: 'bend',
  shapes: [
    ...pinRow(['1', '2']).map((p) => rect(p.x - 1.2, -8, 2.4, 8, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(-3, -16, 16, 9, '#e7eaee', { rx: 1, grad: '#9aa3ad', shadow: 0.8 }),
    reach(-1, -76, 12, 60),
  ],
  // the strip (and its printed pattern) bends over about its root
  animations: [rect(-1, -76, 12, 60, '#2d2f33', { rx: 1.5, grad: '#141517', gradDir: 'h' }), ...Array.from({ length: 9 }, (_, i) => rect(0.5, -72 + i * 6, 9, 2.2, '#8a8f96', { opacity: 0.8 }))]
    .map((shape) => ({ shape, rotate: 'bend * 0.6', cx: 5, cy: -16 })),
  readouts: [{ value: 'bend', unit: '°', x: 26, y: -20, size: 4 }],
  model: { elements: [{ id: 'R', kind: 'rvar', a: '1', b: '2', value: '25000 * (1 + bend / 30)' }] },
};

const keypad1x4: Raw = (() => {
  const ids = ['COM', 'K1', 'K2', 'K3', 'K4'];
  const pins = pinRow(ids, { labels: { COM: 'Common', K1: 'Key 1', K2: 'Key 2', K3: 'Key 3', K4: 'Key 4' } });
  const keys = [1, 2, 3, 4];
  const keyX = (k: number) => -16 + (k - 1) * 18;
  return {
    type: 'keypad-1x4', name: 'Membrane keypad (1×4)', category: 'switches',
    description: 'Four flat membrane buttons on a ribbon: each key connects its pin to COMMON. Wire COM to GND and read K1–K4 with INPUT_PULLUP (pressed = LOW). Drag sideways to pick a key, hold to press it.',
    keywords: ['membrane keypad', '1x4 keypad', 'keypad', 'buttons', 'membrane switch'],
    pins,
    props: [{ key: 'key', label: 'Key under the finger', type: 'slider', default: 1, min: 1, max: 4, step: 1 }],
    drag: 'key', interactive: 'press',
    shapes: [
      ...pins.map((p) => rect(p.x - 1.5, -12, 3, 12, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
      rect(-5, -24, 50, 13, '#2d2f33', { rx: 1, grad: '#111214' }),
      rect(-2, -34, 44, 11, '#e7eaee', { opacity: 0.9, grad: '#b9c0c8' }),
      ...Array.from({ length: 5 }, (_, i) => line(1 + i * 9, -33, 1 + i * 9, -24, '#8a8f96', 0.6)),
      rect(-24, -60, 88, 26, '#2d2f33', { rx: 3, grad: '#15161a', gradDir: 'd', shadow: 1 }),
      ...keys.flatMap((k) => [
        rect(keyX(k), -56, 16, 18, '#3a7fd0', { rx: 2, grad: '#1c4a8a', gradDir: 'd', stroke: '#6fa3e8', strokeWidth: 0.4 }),
        text(keyX(k) + 8, -44, String(k), 7, '#ffffff', 'middle', { weight: 700 }),
      ]),
    ],
    indicators: keys.map((k) => ({ shape: rect(keyX(k), -56, 16, 18, '#ffffff', { rx: 2 }), color: '#ffffff', level: `round(key) == ${k} ? (pressed == 1 ? 0.45 : 0.12) : 0` })),
    model: { elements: keys.map((k) => contact(`S${k}`, `K${k}`, 'COM', `pressed == 1 && round(key) == ${k}`, 100)) },
  };
})();

// ---------------------------------------------------------------- sensor modules

const probe = (x: number, top: number, bottom: number): Raw[] => [
  path(`M ${x - 4} ${bottom} L ${x - 4} ${top + 6} L ${x - 1} ${top} L ${x + 2} ${top + 6} L ${x + 2} ${bottom} Z`, '#d9a441', { grad: '#8a6a1a', gradDir: 'h', shadow: 0.8 }),
];

const soilMoisture = comparatorModule({
  type: 'soil-moisture', name: 'Soil moisture sensor', title: 'SOIL',
  description: 'Fork probe + LM393 board: AO falls as the soil gets wetter (dry ≈ 4.7 V, in water ≈ 1.8 V at 5 V); DO goes LOW once wetter than the threshold pot. Power it only while measuring so the probe does not corrode. Set the moisture while simulating.',
  keywords: ['soil moisture', 'moisture sensor', 'plant', 'hygrometer', 'yl-69', 'fc-28', 'watering'],
  props: [
    { key: 'moist', label: 'Moisture', type: 'slider', default: 20, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.6, min: 0.05, max: 0.95, step: 0.01 },
  ],
  drag: 'moist',
  ao: 'v(VCC, GND) * (0.95 - 0.6 * moist / 100)',
  trip: 'v(AO, GND) < thr * v(VCC, GND)',
  doActiveLow: true,
  extraShapes: [
    ...probe(6, -112, -48), ...probe(24, -112, -48),
    rect(-2, -60, 34, 10, '#1c7040', { rx: 1, grad: '#0f4a28' }), silk(15, -53, 'YL-69', 3),
  ],
  readouts: [{ value: 'moist', unit: '%', x: 15, y: -66, size: 4, color: '#fff' }],
});

const rainSensor = comparatorModule({
  type: 'rain-sensor', name: 'Rain sensor (drop plate)', title: 'RAIN',
  description: 'Interleaved copper traces that conduct when drops land on them, plus an LM393 board: AO drops as the plate gets wetter, and DO goes LOW when rain is detected (threshold pot). Set the wetness while simulating.',
  keywords: ['rain', 'rain sensor', 'raindrop', 'water drop', 'weather', 'fc-37', 'yl-83'],
  props: [
    { key: 'wet', label: 'Wetness', type: 'slider', default: 0, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.7, min: 0.05, max: 0.95, step: 0.01 },
  ],
  drag: 'wet',
  ao: 'v(VCC, GND) * (0.98 - 0.75 * pow(wet / 100, 0.6))',
  trip: 'v(AO, GND) < thr * v(VCC, GND)',
  doActiveLow: true,
  extraShapes: [
    rect(-8, -106, 46, 50, '#1c7040', { rx: 1.5, grad: '#0f4a28', shadow: 1 }),
    ...Array.from({ length: 7 }, (_, i) => rect(-4 + (i % 2) * 4, -102 + i * 6.4, 34, 2, '#e3c25e', { rx: 1 })),
    rect(-5, -102, 2, 40, '#e3c25e'), rect(33, -99, 2, 40, '#e3c25e'),
  ],
});

const flameSensor = comparatorModule({
  type: 'flame-sensor', name: 'Flame sensor (IR, 760–1100 nm)', title: 'FLAME',
  description: 'An IR photodiode tuned to the flicker of flames: AO falls as the flame gets closer / stronger and DO goes LOW when it passes the threshold pot (range up to ~1 m). Set the flame strength while simulating.',
  keywords: ['flame', 'flame sensor', 'fire', 'ir flame', 'ky-026', 'fire alarm'],
  props: [
    { key: 'flame', label: 'Flame strength', type: 'slider', default: 0, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.5, min: 0.05, max: 0.95, step: 0.01 },
  ],
  drag: 'flame',
  ao: 'v(VCC, GND) * (0.97 - 0.9 * flame / 100)',
  trip: 'v(AO, GND) < thr * v(VCC, GND)',
  doActiveLow: true,
  extraShapes: [
    line(12, -50, 12, -62, COL.lead, 0.9), line(18, -50, 18, -62, COL.lead, 0.9),
    path('M9 -62 L9 -70 A6 6 0 0 1 21 -70 L21 -62 Z', '#2a2c30', { grad: '#0c0d0f', gradDir: 'h', shadow: 0.6 }),
    rect(11, -73, 1.6, 8, '#ffffff', { opacity: 0.3, rx: 0.8 }),
  ],
});

const lineTracker = comparatorModule({
  type: 'line-tracker', name: 'Line tracking sensor (TCRT5000)', title: 'TCRT5000',
  description: 'An IR LED and phototransistor looking down 1–15 mm at the floor: a white surface reflects (AO low, DO LOW), a black line absorbs (AO high, DO HIGH). Two or three of them steer a line-following robot. Set the surface reflectance while simulating.',
  keywords: ['line tracker', 'line follower', 'tcrt5000', 'reflective sensor', 'ir reflective', 'robot'],
  props: [
    { key: 'refl', label: 'Surface reflectance', type: 'slider', default: 90, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.5, min: 0.05, max: 0.95, step: 0.01 },
  ],
  drag: 'refl',
  ao: 'v(VCC, GND) * (0.95 - 0.85 * refl / 100)',
  trip: 'v(AO, GND) < thr * v(VCC, GND)',
  doActiveLow: true,
  extraShapes: [
    rect(4, -66, 22, 14, '#1f2023', { rx: 1, grad: '#0b0b0c', shadow: 1 }),
    circle(10, -59, 3.6, '#2f6fd6', { grad: '#173f7e', gradDir: 'r' }), circle(20, -59, 3.6, '#101113', { stroke: '#3a3d42', strokeWidth: 0.5 }),
    line(10, -52, 10, -50, COL.lead, 0.9), line(20, -52, 20, -50, COL.lead, 0.9),
  ],
});

export const mq = (type: string, title: string, name: string, description: string, keywords: string[], prop: Raw, ao: string) => comparatorModule({
  type, name, title, description, keywords,
  props: [prop, { key: 'thr', label: 'Threshold pot', type: 'slider', default: 1.5, min: 0.2, max: 4.5, step: 0.05, unit: 'V' }],
  drag: prop.key, ao,
  trip: 'v(AO, GND) > thr', doActiveLow: true,
  h: 70, extraShapes: [...meshCan(15, -56, 12)],
});

const mq135 = mq(
  'mq135', 'MQ-135', 'Air quality sensor (MQ-135)',
  'Tin-oxide sensor for "bad air" — CO₂, ammonia, benzene, smoke. Its heater needs ~150 mA from 5 V and a few minutes to warm up. AO rises with pollution; DO goes LOW above the threshold. Set the concentration while simulating.',
  ['mq135', 'mq-135', 'air quality', 'co2', 'ammonia', 'pollution', 'gas sensor'],
  { key: 'ppm', label: 'Pollutants', type: 'slider', default: 400, min: 10, max: 2000, step: 10, unit: 'ppm' },
  'v(VCC, GND) * 10000 / (10000 + 40000 * pow(max(ppm, 10) / 400, -0.42))',
);

const mq3 = mq(
  'mq3', 'MQ-3', 'Alcohol sensor (MQ-3)',
  'Breath-alcohol sensor (ethanol vapour, 0.05–10 mg/L). Heater ~150 mA at 5 V. AO rises with the alcohol level; DO goes LOW above the threshold pot. Set the concentration while simulating.',
  ['mq3', 'mq-3', 'alcohol', 'breathalyzer', 'ethanol', 'gas sensor'],
  { key: 'mgl', label: 'Alcohol', type: 'slider', default: 0.1, min: 0, max: 10, step: 0.05, unit: 'mg/L' },
  'v(VCC, GND) * 5000 / (5000 + 60000 * pow(max(mgl, 0.05) / 0.4, -0.65))',
);

const waterLevel: Raw = (() => {
  const b = moduleBoard(['S', 'VCC', 'GND'], { h: 86, w: 36, color: COL.pcbRed, holes: 'none', labels: { S: 'S (analog level)', VCC: '+ (3–5 V)', GND: '−' } });
  return {
    type: 'water-level', name: 'Water level sensor', category: 'sensors',
    description: 'Exposed parallel traces that conduct more the deeper they are dipped: S rises from 0 V (dry) to ~70 % of the supply when fully submerged (about 40 mm). Read it with analogRead. Set the water level while simulating.',
    keywords: ['water level', 'water sensor', 'liquid level', 'depth', 'tank level', 'flood'],
    pins: b.pins,
    props: [{ key: 'level', label: 'Water depth', type: 'slider', default: 0, min: 0, max: 40, step: 0.5, unit: 'mm' }],
    drag: 'level',
    shapes: [
      ...b.shapes,
      ...Array.from({ length: 10 }, (_, i) => rect(-3 + i * 2.8, -86, 1.3, 58, i % 2 ? '#d8dce0' : '#c98a3c', { rx: 0.6 })),
      ...smdRow(-2, -20, 3, 5, false, 'rrd'), statusLed(24, -20, '#ff3b30', '0').shape,
    ],
    indicators: [
      { shape: rect(-6, -86, 36, 58, '#4aa3ff', { rx: 1 }), color: '#4aa3ff', level: 'clamp(level / 40, 0, 1) * 0.5' },
      statusLed(24, -20, '#ff3b30', 'v(VCC, GND) > 2.5 ? 1 : 0').indicator,
    ],
    readouts: [{ value: 'level', unit: 'mm', x: 10, y: -94, size: 4 }],
    model: { elements: [{ id: 'O', kind: 'vsource', p: 'S', n: 'GND', value: 'v(VCC, GND) * 0.7 * pow(clamp(level / 40, 0, 1), 0.7)', r: 2000 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 20000 }] },
  };
})();

const pulseSensor: Raw = (() => {
  const pins = pinRow(['S', 'VCC', 'GND'], { labels: { S: 'Signal (purple)', VCC: '+ (red, 3–5 V)', GND: '− (black)' } });
  const heart = 'M 10 -30 C 4 -36 -2 -42 4 -46 C 7 -48 10 -45 10 -43 C 10 -45 13 -48 16 -46 C 22 -42 16 -36 10 -30 Z';
  const beat = 'exp(-pow((mod(t * bpm / 60, 1) - 0.2) / 0.035, 2)) - 0.25 * exp(-pow((mod(t * bpm / 60, 1) - 0.3) / 0.04, 2)) + 0.3 * exp(-pow((mod(t * bpm / 60, 1) - 0.55) / 0.08, 2))';
  return {
    type: 'pulse-sensor', name: 'Pulse / heart-rate sensor', category: 'sensors',
    description: 'Green LED + light sensor that sees the blood pulse in a fingertip: S is a heartbeat waveform around VCC/2 while a finger is on it. Detect the peaks with analogRead to measure BPM. Set the heart rate (and the finger) while simulating.',
    keywords: ['pulse sensor', 'heart rate', 'heartbeat', 'bpm', 'pulse', 'ppg', 'health'],
    pins,
    props: [
      { key: 'bpm', label: 'Heart rate', type: 'slider', default: 72, min: 40, max: 180, step: 1, unit: 'bpm' },
      { key: 'finger', label: 'Finger', type: 'select', default: 1, options: [{ value: 0, label: 'Off the sensor' }, { value: 1, label: 'On the sensor' }] },
    ],
    drag: 'bpm', toggle: 'finger',
    shapes: [
      line(0, 0, 0, -14, '#8a4ad6', 1.6), line(10, 0, 10, -14, '#d63c35', 1.6), line(20, 0, 20, -14, '#26282c', 1.6),
      circle(10, -36, 22, '#1c7040', { grad: '#0f4a28', gradDir: 'd', shadow: 1 }),
      circle(10, -36, 20.5, 'none', { stroke: '#2c8a52', strokeWidth: 0.6 }),
      path(heart, '#f4f5f1', { opacity: 0.9 }),
      rect(6.5, -42, 7, 7, '#e7eaee', { rx: 1, grad: '#9aa3ad' }), rect(8, -40.5, 4, 4, '#1a1b1e'),
    ],
    indicators: [{ shape: rect(6.5, -42, 7, 7, '#35ff5a', { rx: 1 }), color: '#35ff5a', level: 'v(VCC, GND) > 2.5 ? 0.7 : 0' }],
    readouts: [{ value: 'finger == 1 ? bpm : 0', unit: 'bpm', x: 10, y: -62, size: 4 }],
    model: {
      elements: [
        { id: 'O', kind: 'vsource', p: 'S', n: 'GND', value: `v(VCC, GND) > 2.5 ? v(VCC, GND) * (0.5 + (finger == 1 ? 0.28 * (${beat}) : 0.02 * sin(t * 377))) : 0`, r: 500 },
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1200 },
      ],
    },
    maxStep: 2e-3,
  };
})();

const uvSensor: Raw = (() => {
  const b = moduleBoard(['GND', 'VCC', 'SIG'], { h: 36, color: COL.pcbBlack, title: 'GUVA-S12SD', titleY: -15.5, titleSize: 2.6, labels: { VCC: '+2.7–5.5 V', SIG: 'Analog out (≈ UV index × 0.1 V)' } });
  return {
    type: 'uv-sensor', name: 'UV sensor (GUVA-S12SD)', category: 'sensors',
    description: 'A UV-A/B photodiode with an amplifier: SIG ≈ UV index ÷ 10 volts (0.1 V indoors, ~1 V in strong summer sun). Read it with analogRead. Set the UV index while simulating.',
    keywords: ['uv', 'ultraviolet', 'uv index', 'guva-s12sd', 'sunlight', 'sun'],
    pins: b.pins,
    props: [{ key: 'uvi', label: 'UV index', type: 'slider', default: 3, min: 0, max: 12, step: 0.1 }],
    drag: 'uvi',
    shapes: [...b.shapes, rect(3, -34, 9, 7, '#f4f2ec', { rx: 0.8, grad: '#c9c5b8', shadow: 0.8 }), rect(5, -32.5, 5, 4, '#6b4fd6', { opacity: 0.8 }), ...chip(16, -34, 9, 6, { n: 3, label: '358' }), ...smdRow(0, -22, 3, 5)],
    readouts: [{ value: 'uvi', unit: 'UVI', x: 10, y: -44, size: 4 }],
    model: { elements: [{ id: 'O', kind: 'vsource', p: 'SIG', n: 'GND', value: 'v(VCC, GND) > 2.6 ? clamp(uvi * 0.1, 0, v(VCC, GND) - 0.2) : 0', r: 1000 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 20000 }] },
  };
})();

const ntcModule: Raw = (() => {
  const b = moduleBoard(['S', 'VCC', 'GND'], { h: 36, color: COL.pcbBlack, title: 'KY-013', titleY: -15.5, titleSize: 3, labels: { S: 'S (divider output)', VCC: '+ (3.3–5 V)', GND: '−' } });
  return {
    type: 'ntc-module', name: 'Temperature module (KY-013, NTC)', category: 'sensors',
    description: 'A 10 kΩ NTC thermistor (β = 3950) with a 10 kΩ resistor to + already wired as a divider: S falls as it gets warmer (VCC/2 at 25 °C). Convert with the Steinhart–Hart / β formula. Set the temperature while simulating.',
    keywords: ['ntc', 'thermistor module', 'ky-013', 'temperature', 'analog temperature'],
    pins: b.pins,
    props: [{ key: 'temp', label: 'Temperature', type: 'slider', default: 25, min: -20, max: 120, step: 0.5, unit: '°C' }],
    drag: 'temp',
    shapes: [...b.shapes, line(8, -26, 8, -34, COL.lead, 0.9), line(12, -26, 12, -34, COL.lead, 0.9), { type: 'ellipse', cx: 10, cy: -36, rx: 5, ry: 4.4, fill: '#3a3c41', grad: '#0f1012', gradDir: 'r', shadow: 0.8 }, ...smd(22, -22, 'r')],
    readouts: [{ value: 'temp', unit: '°C', x: 10, y: -44, size: 4 }],
    model: {
      elements: [
        { id: 'R1', kind: 'resistor', a: 'VCC', b: 'S', value: 10000 },
        { id: 'NTC', kind: 'rvar', a: 'S', b: 'GND', value: '10000 * exp(3950 * (1 / (temp + 273.15) - 1 / 298.15))' },
      ],
    },
  };
})();

const waterFlow: Raw = (() => {
  const pins = pinRow(['VCC', 'SIG', 'GND'], { labels: { VCC: 'Red (+5–18 V)', SIG: 'Yellow (pulses: 7.5 Hz per L/min)', GND: 'Black (−)' } });
  return {
    type: 'water-flow', name: 'Water flow sensor (YF-S201)', category: 'sensors',
    description: 'A turbine with a Hall sensor in a ½" pipe fitting: SIG pulses 7.5 times per second for each litre per minute (1–30 L/min). Count the pulses with an interrupt: L/min = Hz ÷ 7.5. Set the flow while simulating.',
    keywords: ['water flow', 'flow sensor', 'flow meter', 'yf-s201', 'turbine', 'hall', 'litres'],
    pins,
    props: [{ key: 'flow', label: 'Flow', type: 'slider', default: 0, min: 0, max: 30, step: 0.1, unit: 'L/min' }],
    drag: 'flow',
    shapes: [
      line(0, 0, 4, -16, '#d63c35', 1.6), line(10, 0, 10, -16, '#f2c230', 1.6), line(20, 0, 16, -16, '#26282c', 1.6),
      rect(-26, -40, 14, 16, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'v' }), rect(32, -40, 14, 16, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'v' }),
      ...[-24, -21, -18, -15, 34, 37, 40, 43].map((x) => line(x, -40, x, -24, '#8a6a1a', 0.5)),
      rect(-14, -42, 48, 20, '#2d2f33', { rx: 2, grad: '#111214', gradDir: 'v', shadow: 1 }),
      circle(10, -44, 12, '#2d2f33', { grad: '#141517', gradDir: 'd' }), circle(10, -44, 9, '#e7eaee', { opacity: 0.35 }),
      rect(4, -22, 12, 6, '#2d2f33', { rx: 1 }),
    ],
    animations: [{ shape: path('M 10 -44 L 10 -52 M 10 -44 L 17 -40 M 10 -44 L 3 -40', 'none', { stroke: '#e7eaee', strokeWidth: 1.4 }), rotate: 'ph * 120', cx: 10, cy: -44 }],
    readouts: [{ value: 'flow', unit: 'L/min', x: 10, y: -60, size: 4 }],
    states: [{ name: 'ph', init: 0, next: 'mod(ph + 7.5 * flow * dt, 3)' }],
    model: { elements: [dout('O', 'SIG', 'v(VCC, GND) > 4 && mod(ph, 1) < 0.5', 'VCC', 'GND', 1000), { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1000 }] },
    maxStep: 5e-4,
  };
})();

const hallModule: Raw = (() => {
  const b = moduleBoard(['S', 'VCC', 'GND'], { h: 36, color: COL.pcbBlack, title: 'KY-003', titleY: -15.5, titleSize: 3, labels: { S: 'S (LOW near a magnet)', VCC: '+ (3.3–5 V)', GND: '−' } });
  const l = statusLed(24, -20, '#ff3b30', 'on');
  return {
    type: 'hall-module', name: 'Hall magnetic sensor module (KY-003)', category: 'sensors',
    description: 'A digital Hall switch with its pull-up and an indicator LED: S goes LOW (and the LED lights) when a magnet’s south pole comes close. Read it like a button. Press it to bring a magnet close, or set the field.',
    keywords: ['hall module', 'ky-003', 'magnet sensor', 'hall switch', 'magnetic', 'a3144'],
    pins: b.pins,
    props: [{ key: 'field', label: 'Magnetic field', type: 'slider', default: 0, min: -50, max: 50, step: 1, unit: 'mT' }],
    interactive: 'press',
    shapes: [...b.shapes, ...to92Top(8, -32), ...smd(18, -24, 'r'), l.shape],
    states: [{ name: 'on', init: 0, next: '(pressed == 1 ? 40 : field) > 18 ? 1 : ((pressed == 1 ? 40 : field) < 12 ? 0 : on)' }],
    indicators: [l.indicator],
    model: {
      elements: [
        { id: 'PU', kind: 'resistor', a: 'VCC', b: 'S', value: 10000 },
        contact('Q', 'S', 'GND', 'on == 1 && v(VCC, GND) > 2.5', 25),
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1500 },
      ],
    },
  };
})();

/** A TO-92 sensor seen lying on a module, with its three legs down to the board. */
function to92Top(cx: number, cy: number): Raw[] {
  return [
    ...[-2.5, 0, 2.5].map((dx) => line(cx + dx, cy + 4, cx + dx, cy + 10, COL.lead, 0.8)),
    path(`M ${cx - 4.5} ${cy + 4} L ${cx + 4.5} ${cy + 4} L ${cx + 4.5} ${cy - 2} A 4.5 4.5 0 0 0 ${cx - 4.5} ${cy - 2} Z`, '#2a2c30', { grad: '#111214', gradDir: 'h', shadow: 0.6 }),
  ];
}

const knockSensor: Raw = {
  type: 'knock-sensor', name: 'Piezo disc (knock / vibration sensor)', category: 'sensors',
  description: 'A bare piezo disc used as a sensor: a tap makes a sharp voltage spike (several volts, decaying in milliseconds). Put a 1 MΩ resistor across it and read it with analogRead (or a comparator). Press it to knock.',
  keywords: ['piezo', 'knock sensor', 'piezo disc', 'tap', 'drum trigger', 'vibration'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+ (red)', N: '− (black)' } }),
  props: [{ key: 'hit', label: 'Knock strength', type: 'slider', default: 5, min: 0.5, max: 20, step: 0.5, unit: 'V' }],
  interactive: 'press',
  shapes: [
    ...leads(-12),
    circle(10, -36, 22, '#e3c25e', { grad: '#9c7b26', gradDir: 'd', shadow: 1 }),
    circle(10, -36, 15, '#eef1f4', { grad: '#9aa3ad', gradDir: 'r' }),
    circle(4, -28, 1.6, '#c9ccd1', { stroke: '#8a929b', strokeWidth: 0.4 }), circle(16, -18, 1.6, '#c9ccd1', { stroke: '#8a929b', strokeWidth: 0.4 }),
    line(0, -12, 4, -28, '#d63c35', 1.2), line(20, -12, 16, -18, '#26282c', 1.2),
  ],
  states: [
    { name: 'tk', init: -1, next: 'pressed == 1 && pp == 0 ? t : tk' },
    { name: 'pp', init: 0, next: 'pressed' },
  ],
  model: { elements: [{ id: 'O', kind: 'vsource', p: 'P', n: 'N', value: '(tk >= 0 && t - tk < 0.05) ? hit * exp(-(t - tk) / 0.004) * cos(6.28318 * 400 * (t - tk)) : 0', r: 20000 }] },
  maxStep: 1e-4,
};

// ---------------------------------------------------------------- displays & meters

const fourDigit: Raw = (() => {
  // 5641AS pinout (common cathode): 1 E, 2 D, 3 DP, 4 C, 5 G, 6 D4 / 7 B, 8 D3, 9 D2, 10 F, 11 A, 12 D1
  const names = ['E', 'D', 'DP', 'C', 'G', 'D4', 'B', 'D3', 'D2', 'F', 'A', 'D1'];
  const d = dip(names, { label: '', wide: true, labels: { D1: 'Digit 1 cathode', D2: 'Digit 2 cathode', D3: 'Digit 3 cathode', D4: 'Digit 4 cathode', DP: 'Decimal point' } });
  const segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
  const segShape = (ox: number, s: string): Raw => {
    const oy = 16;
    const at: Record<string, Raw> = {
      A: rect(ox + 3.4, oy, 10, 2.4, '', { rx: 1 }), B: rect(ox + 13.6, oy + 2, 2.4, 12, '', { rx: 1 }), C: rect(ox + 12.8, oy + 16, 2.4, 12, '', { rx: 1 }),
      D: rect(ox + 2, oy + 27.6, 10, 2.4, '', { rx: 1 }), E: rect(ox, oy + 16, 2.4, 12, '', { rx: 1 }), F: rect(ox + 0.8, oy + 2, 2.4, 12, '', { rx: 1 }),
      G: rect(ox + 2.6, oy + 13.8, 10, 2.4, '', { rx: 1 }), DP: circle(ox + 18, oy + 29, 1.4, ''),
    };
    return at[s];
  };
  const digits = [1, 2, 3, 4];
  const ox = (k: number) => -22 + (k - 1) * 26;
  return {
    type: 'seven-seg-4digit', name: '4-digit seven-segment display (5641AS)', category: 'displays',
    description: 'Four digits sharing their segment pins (A–G, DP) with one common cathode per digit (D1–D4). Multiplex: light one digit at a time — segment pins HIGH through 220 Ω resistors, that digit’s pin LOW — cycling fast enough (≥ 50 Hz) that all four look lit. Or let a TM1637 / MAX7219 do it.',
    keywords: ['4 digit', 'four digit', '7 segment', 'seven segment', '5641as', 'multiplex', 'clock display', 'numeric display'],
    pins: d.pins, symbol: d.symbol,
    shapes: [
      ...d.pins.map((p) => rect(p.x - 1, p.y === 0 ? 0 : 54, 2, 6, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
      rect(-28, 6, 108, 48, '#34363b', { rx: 1.5, grad: '#141517', shadow: 1, stroke: '#0a0a0b', strokeWidth: 0.5 }),
      rect(-26, 8, 104, 44, '#1b1c1f', { rx: 1 }),
      ...digits.flatMap((k) => segs.map((s) => ({ ...segShape(ox(k), s), fill: '#4a3434' }))),
      rect(-26, 8, 104, 12, '#ffffff', { opacity: 0.04 }),
    ],
    // each segment holds its glow for a few ms so a multiplexed digit looks steadily lit
    states: digits.flatMap((k) => segs.map((s) => ({ name: `b${k}${s}`, init: 0, next: `max(clamp(i(L${k}${s}) / 0.004, 0, 1), b${k}${s} - dt / 0.03)` }))),
    indicators: digits.flatMap((k) => segs.map((s) => ({ shape: { ...segShape(ox(k), s), fill: '#ff2a1a' }, color: '#ff2a1a', level: `b${k}${s}` }))),
    model: { elements: digits.flatMap((k) => segs.map((s) => ({ id: `L${k}${s}`, kind: 'diode', a: s, k: `D${k}`, model: 'led', vf: 1.9 }))) },
    warnings: digits.map((k) => ({ when: segs.map((s) => `i(L${k}${s}) > 0.03`).join(' || '), level: 'error', message: `A digit ${k} segment carries more than 30 mA — add series resistors on the segment pins.` })),
  };
})();

const panelVoltmeter: Raw = {
  type: 'panel-voltmeter', name: 'Panel voltmeter (3-wire, 0–100 V)', category: 'instruments',
  description: 'A 0.36" red LED voltmeter for power supplies and battery boxes. Red powers it (4.5–30 V), black is ground, yellow is the voltage to measure (0–100 V, against black). Shows two decimals.',
  keywords: ['voltmeter', 'panel meter', 'volt meter', 'voltage display', 'led voltmeter', 'battery monitor'],
  pins: pinRow(['VCC', 'GND', 'VIN'], { labels: { VCC: 'Red: power (+4.5–30 V)', GND: 'Black: ground', VIN: 'Yellow: measured voltage' } }),
  shapes: [
    line(0, 0, 0, -12, '#d63c35', 1.6), line(10, 0, 10, -12, '#26282c', 1.6), line(20, 0, 20, -12, '#f2c230', 1.6),
    rect(-18, -36, 56, 24, '#2d2f33', { rx: 2, grad: '#111214', gradDir: 'd', shadow: 1 }),
    rect(-14, -32, 48, 16, '#1a0707', { rx: 1 }),
    rect(-14, -32, 48, 5, '#ffffff', { opacity: 0.06, rx: 1 }),
    text(36, -14, 'V', 3, '#9ea2a8', 'middle', { weight: 700 }),
  ],
  readouts: [{ value: 'v(VCC, GND) > 4 ? max(0, v(VIN, GND)) : 0', unit: 'V', x: 10, y: -20, size: 8, color: '#ff3a2a' }],
  model: { elements: [{ id: 'RIN', kind: 'resistor', a: 'VIN', b: 'GND', value: 100000 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 250 }] },
  warnings: [{ when: 'v(VCC, GND) > 30', level: 'error', message: 'Power input above 30 V.' }, { when: 'v(VIN, GND) > 100', level: 'error', message: 'Measured voltage above 100 V.' }],
};

// ---------------------------------------------------------------- power

const coinCell: Raw = {
  type: 'coin-cell', name: 'Coin cell holder (CR2032, 3 V)', category: 'power',
  description: 'A 3 V lithium coin cell (220 mAh) in a PCB holder. Great for low-power sensors and real-time clocks, but it has ~15 Ω of internal resistance — it sags badly above ~10 mA, so it cannot run motors or many LEDs.',
  keywords: ['coin cell', 'cr2032', 'button cell', '3v battery', 'lithium coin', 'rtc battery'],
  pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+', N: '−' } }),
  props: [{ key: 'charge', label: 'Initial charge', type: 'slider', default: 100, min: 0, max: 100, step: 1, unit: '%' }],
  shapes: [
    ...pinRow(['P', 'N'], { step: 20 }).map((p) => rect(p.x - 1.2, -8, 2.4, 8, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
    rect(-10, -36, 40, 28, '#2d2f33', { rx: 3, grad: '#141517', shadow: 1 }),
    circle(10, -22, 12.5, '#e3e7eb', { grad: '#8a929b', gradDir: 'd', stroke: '#6b737c', strokeWidth: 0.5 }),
    circle(10, -22, 10.5, 'none', { stroke: '#b9c0c8', strokeWidth: 0.5 }),
    text(10, -22.5, 'CR2032', 3.4, '#4a5058', 'middle', { weight: 700 }), text(10, -17.5, '3V  +', 2.8, '#4a5058', 'middle', { weight: 600 }),
    rect(4, -38, 12, 7, '#d9dde2', { rx: 1, grad: '#8a929b' }),
  ],
  states: [{ name: 'soc', init: 'charge / 100', next: 'clamp(soc + i(B) * dt / (220 * 3.6), 0, 1)' }],
  readouts: [{ value: 'round(soc * 100)', unit: '%', x: 10, y: -42, size: 4 }],
  model: { elements: [{ id: 'B', kind: 'vsource', p: 'P', n: 'N', value: 'soc > 0.08 ? 2.85 + 0.2 * soc : 2 + 10 * soc', r: 15 }] },
  warnings: [{ when: '-i(B) > 0.02', level: 'warn', message: 'Drawing more than 20 mA — a coin cell sags and empties fast.' }, { when: 'i(B) > 0.001', level: 'error', message: 'Current flowing into a CR2032 — lithium coin cells are not rechargeable.' }],
};

const reg3v3Module: Raw = (() => {
  const b = moduleBoard(['IN', 'GND', 'OUT'], { h: 38, color: COL.pcbBlue, title: 'AMS1117-3.3', titleY: -15, titleSize: 2.8, labels: { IN: 'VIN (4.5–12 V)', OUT: '3.3 V out (up to ~800 mA)' } });
  const l = pwrLed(25, -36, 'OUT');
  return {
    type: 'reg-3v3-module', name: '3.3 V regulator module (AMS1117)', category: 'power',
    description: 'A tiny board with an AMS1117-3.3 LDO and its capacitors: 4.5–12 V in, a steady 3.3 V out for ESP8266/ESP32 radios, sensors and SD cards. Burns the difference as heat — keep (VIN − 3.3 V) × current under about 1 W.',
    keywords: ['3.3v regulator', 'ams1117', 'ldo module', '3v3', 'voltage regulator', 'power module'],
    pins: b.pins,
    shapes: [...b.shapes, ...d2pak(3, -36, 14, 10, '1117'), ...ecap(-3, -24, 3), ...ecap(23, -24, 3), l.shape],
    indicators: [l.indicator],
    model: { nodes: ['B'], elements: linearReg('min(4.0, max(0, v(IN, GND) - 0.4))') },
    warnings: [
      { when: 'v(IN, OUT) * i(Q) > 1', level: 'warn', message: 'Dissipating more than 1 W — the little regulator overheats (lower VIN or use a buck).' },
      { when: 'i(Q) > 0.9', level: 'error', message: 'Output current above ~800 mA.' },
      { when: 'v(IN, GND) > 15', level: 'error', message: 'Input above 15 V.' },
    ],
  };
})();

export const EXTRA_IO: Raw[] = [
  phototransistor, bicolorLed, bargraph, varistor, lightBulb, hall49e, powerResistor,
  activeBuzzer, trafficLight, rgbModule, vibrationMotor, dcFan, waterPump, electromagnet,
  limitSwitch, touchSensor, rockerSwitch, slidePot, fsr, flexSensor, keypad1x4,
  soilMoisture, rainSensor, flameSensor, lineTracker, mq135, mq3, waterLevel, pulseSensor, uvSensor, ntcModule, waterFlow, hallModule, knockSensor,
  fourDigit, panelVoltmeter, coinCell, reg3v3Module,
];
