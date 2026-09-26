import { COL, axial, circle, dip, hiz, legs, line, path, pinRow, rect, text, type Raw } from './kit';

const radial = (ids: [string, string], body: Raw[], labels: Record<string, string> = {}) => {
  const pins = pinRow(ids, { labels });
  return { pins, shapes: [...legs(pins, -8), ...body] };
};

export const PASSIVE: Raw[] = [
  {
    type: 'trimmer', name: 'Trimmer potentiometer', category: 'passive',
    description: 'Small screwdriver-adjusted potentiometer. Pins: 1, wiper, 2. Drag it while simulating to turn the screw.',
    keywords: ['trimpot', 'preset', 'pot', 'adjust'],
    pins: pinRow(['1', 'W', '2']),
    props: [
      { key: 'r', label: 'Resistance', type: 'number', default: 10000, unit: 'Ω', min: 10 },
      { key: 'pos', label: 'Position', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
    drag: 'pos',
    shapes: [
      ...legs(pinRow(['1', 'W', '2']), -6),
      rect(-5, -26, 30, 21, '#3b82e0', { rx: 2, grad: '#1f4f9f', shadow: 1, stroke: '#173f7e', strokeWidth: 0.4 }),
      circle(10, -15.5, 8, '#f7f8fa', { grad: '#b9c0c8', gradDir: 'r', stroke: '#8a929b', strokeWidth: 0.5 }),
    ],
    animations: [{ shape: path('M 8.8 -22 L 11.2 -22 L 11.2 -9 L 8.8 -9 Z M 4 -16.7 L 16 -16.7 L 16 -14.3 L 4 -14.3 Z', '#8a929b'), rotate: '-135 + pos * 270', cx: 10, cy: -15.5 }],
    model: { elements: [{ id: 'RA', kind: 'rvar', a: '1', b: 'W', value: 'max(0.5, r * pos)' }, { id: 'RB', kind: 'rvar', a: 'W', b: '2', value: 'max(0.5, r * (1 - pos))' }] },
    summary: 'Adjustable preset resistor',
  },
  {
    type: 'rheostat', name: 'Variable resistor (rheostat)', category: 'passive',
    description: 'Two-terminal variable resistance, e.g. to set a current. Drag to adjust.',
    keywords: ['rheostat', 'variable', 'adjustable resistor'],
    pins: pinRow(['1', '2'], { step: 20 }),
    props: [
      { key: 'r', label: 'Maximum', type: 'number', default: 1000, unit: 'Ω', min: 1 },
      { key: 'pos', label: 'Setting', type: 'slider', default: 0.5, min: 0, max: 1 },
    ],
    drag: 'pos',
    shapes: [
      ...legs(pinRow(['1', '2'], { step: 20 }), -8),
      rect(-7, -27, 34, 19, '#f1e2bf', { rx: 3, grad: '#c9ad6a', shadow: 1, stroke: '#a78a48', strokeWidth: 0.5 }),
      ...Array.from({ length: 14 }, (_, i) => line(-3 + i * 2, -22, -3 + i * 2, -12, '#b8702e', 0.7)),
    ],
    animations: [{ shape: path('M -2 -31 L 2 -31 L 2 -24 L 0 -21 L -2 -24 Z', '#34373c', { stroke: '#111', strokeWidth: 0.4 }), dx: 'pos * 20' }],
    model: { elements: [{ id: 'R', kind: 'rvar', a: '1', b: '2', value: 'max(0.5, r * pos)' }] },
  },
  {
    type: 'thermistor', name: 'Thermistor (NTC 10k)', category: 'passive',
    description: 'Negative-temperature-coefficient thermistor: 10 kΩ at 25 °C, β = 3950. Use it in a divider and read it with analogRead. Set the temperature while simulating.',
    keywords: ['ntc', 'temperature', 'sensor', 'thermal'],
    pins: pinRow(['1', '2']),
    props: [
      { key: 'temp', label: 'Temperature', type: 'slider', default: 25, min: -20, max: 120, step: 0.5, unit: '°C' },
      { key: 'r25', label: 'R at 25 °C', type: 'number', default: 10000, unit: 'Ω' },
      { key: 'beta', label: 'β', type: 'number', default: 3950 },
    ],
    drag: 'temp',
    ...(() => {
      const r = radial(['1', '2'], [{ type: 'ellipse', cx: 5, cy: -14, rx: 7.5, ry: 6.5, fill: '#3a3c41', grad: '#0f1012', gradDir: 'r', shadow: 0.8 }, text(5, -12.5, '103', 3.4, '#c9ccd1', 'middle', { weight: 600 })]);
      return { shapes: r.shapes };
    })(),
    indicators: [{ shape: { type: 'ellipse', cx: 5, cy: -14, rx: 7, ry: 6 }, color: '#ff5a1a', level: 'clamp((temp - 40) / 80, 0, 0.8)' }],
    readouts: [{ value: 'temp', unit: '°C', x: 5, y: -24, size: 4.5 }],
    model: { elements: [{ id: 'R', kind: 'rvar', a: '1', b: '2', value: 'r25 * exp(beta * (1 / (temp + 273.15) - 1 / 298.15))' }] },
  },
  {
    type: 'supercap', name: 'Supercapacitor', category: 'passive',
    description: 'Electric double-layer capacitor (1 F, 5.5 V). Stores enough charge to keep a small circuit alive for seconds. The striped leg is negative.',
    keywords: ['supercapacitor', 'ultracapacitor', 'edlc', 'gold cap'],
    pins: pinRow(['P', 'N'], { labels: { P: 'Positive (+)', N: 'Negative (−)' } }),
    props: [{ key: 'c', label: 'Capacitance', type: 'number', default: 1, unit: 'F', min: 0.01 }],
    shapes: [
      ...legs(pinRow(['P', 'N']), -6),
      rect(-7, -36, 24, 30, '#3a3d44', { rx: 3, grad: '#15171a', gradDir: 'h', shadow: 1 }),
      rect(9, -36, 7, 30, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'h' }),
      rect(-7, -36, 24, 3, '#c5cbd2', { rx: 1.5 }), rect(-4, -32, 2, 22, '#ffffff', { opacity: 0.18, rx: 1 }),
      text(3, -22, '1F', 5, '#eee', 'middle', { weight: 700 }), text(3, -14, '5.5V', 3.6, '#bbb', 'middle', { weight: 600 }),
    ],
    model: { elements: [{ id: 'C', kind: 'capacitor', a: 'P', b: 'N', value: 'c' }, { id: 'ESR', kind: 'resistor', a: 'P', b: 'N', value: 1e6 }] },
    warnings: [
      { when: 'v(P, N) > 5.6', level: 'error', message: 'Above the 5.5 V rating — supercaps fail (and vent) when overcharged.' },
      { when: 'v(P, N) < -0.5', level: 'error', message: 'Reversed polarity.' },
    ],
    readouts: [{ value: 'v(P, N)', unit: 'V', x: 5, y: -38, size: 4.5 }],
  },
  {
    type: 'inductor', name: 'Inductor', category: 'passive',
    description: 'Wire-wound inductor (with its small DC resistance). Stores energy in its magnetic field; current through it can’t change instantly.',
    keywords: ['coil', 'choke', 'henry', 'l'],
    ...axial(['1', '2'], [rect(8, -5.5, 24, 11, '#5a8f4e', { rx: 5, grad: '#274a22', shadow: 0.8 }), ...[['#8b5a2b', 13], ['#1d1d1d', 17], ['#d63c35', 21], ['#d9b44a', 27]].map(([c, x]) => rect(Number(x), -5.4, 2.2, 10.8, String(c))), rect(10, -4.2, 20, 1.6, '#ffffff', { opacity: 0.22, rx: 0.8 })]),
    props: [
      { key: 'l', label: 'Inductance', type: 'number', default: 0.01, unit: 'H', min: 1e-9 },
      { key: 'dcr', label: 'DC resistance', type: 'number', default: 1, unit: 'Ω', min: 0.001 },
    ],
    symbol: [{ type: 'path', d: 'M0 0 L8 0 A3 3 0 0 1 14 0 A3 3 0 0 1 20 0 A3 3 0 0 1 26 0 A3 3 0 0 1 32 0 L40 0', fill: 'none', strokeWidth: 1.3 }],
    model: { nodes: ['M'], elements: [{ id: 'L', kind: 'inductor', a: '1', b: 'M', value: 'l' }, { id: 'R', kind: 'resistor', a: 'M', b: '2', value: 'dcr' }] },
    maxStep: 2e-4,
  },
  {
    type: 'ferrite', name: 'Ferrite bead', category: 'passive',
    description: 'Ferrite bead: near-zero resistance at DC, lossy at high frequency — used to keep noise off power lines.',
    keywords: ['ferrite', 'emi', 'filter', 'bead'],
    ...axial(['1', '2'], [rect(11, -5.5, 18, 11, '#5f636a', { rx: 2.5, grad: '#26282c', shadow: 0.8 }), rect(13, -4.3, 14, 1.4, '#ffffff', { opacity: 0.18, rx: 0.7 })]),
    model: { nodes: ['M'], elements: [{ id: 'L', kind: 'inductor', a: '1', b: 'M', value: 1e-6 }, { id: 'R', kind: 'resistor', a: 'M', b: '2', value: 0.05 }] },
  },
  {
    type: 'transformer', name: 'Transformer', category: 'passive',
    description: 'Mains-style step-down transformer (coupled windings). Works on AC only — drive the primary from the AC source. Primary P1/P2, secondary S1/S2.',
    keywords: ['transformer', 'ac', 'step down', 'isolation', 'coil'],
    pins: [
      { id: 'P1', x: 0, y: 0, label: 'Primary 1', kind: 'terminal' },
      { id: 'P2', x: 0, y: 30, label: 'Primary 2', kind: 'terminal' },
      { id: 'S1', x: 60, y: 0, label: 'Secondary 1', kind: 'terminal' },
      { id: 'S2', x: 60, y: 30, label: 'Secondary 2', kind: 'terminal' },
    ],
    props: [{ key: 'ratio', label: 'Turns ratio', type: 'select', default: 10, options: [{ value: 2, label: '2 : 1' }, { value: 5, label: '5 : 1' }, { value: 10, label: '10 : 1' }, { value: 19, label: '230 V → 12 V' }, { value: 1, label: '1 : 1 isolation' }] }],
    shapes: [
      line(0, 0, 14, 4, '#c98a3c', 1.2), line(0, 30, 14, 28, '#c98a3c', 1.2), line(60, 0, 46, 4, '#c98a3c', 1.2), line(60, 30, 46, 28, '#c98a3c', 1.2),
      rect(6, -12, 48, 54, '#8a929b', { rx: 1.5, grad: '#3f454c', gradDir: 'd', shadow: 1 }),
      ...Array.from({ length: 9 }, (_, i) => line(7, -10 + i * 6, 53, -10 + i * 6, '#5f666e', 0.4)),
      rect(13, -4, 34, 38, '#2b2d31', { rx: 1 }),
      rect(14, -2, 14, 34, '#e0a257', { rx: 2, grad: '#9a5a1e', gradDir: 'h' }), rect(32, -2, 14, 34, '#e0a257', { rx: 2, grad: '#9a5a1e', gradDir: 'h' }),
      rect(14, 12, 14, 5, '#f2d24a', { opacity: 0.9 }), rect(32, 12, 14, 5, '#f2d24a', { opacity: 0.9 }),
      text(30, 50, 'TRANSFORMER', 4, '#444', 'middle', { weight: 700 }),
    ],
    symbol: [
      { type: 'path', d: 'M0 0 L14 0 A3 3 0 0 1 14 7.5 A3 3 0 0 1 14 15 A3 3 0 0 1 14 22.5 A3 3 0 0 1 14 30 L0 30', fill: 'none', strokeWidth: 1.3 },
      { type: 'path', d: 'M60 0 L46 0 A3 3 0 0 0 46 7.5 A3 3 0 0 0 46 15 A3 3 0 0 0 46 22.5 A3 3 0 0 0 46 30 L60 30', fill: 'none', strokeWidth: 1.3 },
      line(28, -2, 28, 32, '#1f3a5f', 1.3), line(32, -2, 32, 32, '#1f3a5f', 1.3),
    ],
    model: {
      nodes: ['PM', 'SM'],
      elements: [
        { id: 'RP', kind: 'resistor', a: 'P1', b: 'PM', value: 5 },
        { id: 'T', kind: 'transformer', p1: 'PM', p2: 'P2', s1: 'SM', s2: 'S2', l1: 20, ratio: 'ratio', k: 0.995 },
        { id: 'RS', kind: 'resistor', a: 'SM', b: 'S1', value: 0.2 },
        { id: 'RL', kind: 'resistor', a: 'P2', b: 'S2', value: 1e8 },
      ],
    },
    maxStep: 2e-4,
  },
  {
    type: 'ac-source', name: 'AC voltage source', category: 'power',
    description: 'Sine-wave source (like a signal generator or a low-voltage AC adapter). Set peak voltage and frequency; use it to drive transformers, rectifiers and filters.',
    keywords: ['ac', 'sine', 'function generator', 'signal generator', 'mains', 'oscillator'],
    pins: [
      { id: 'L', x: 0, y: 0, label: 'Output', kind: 'terminal' },
      { id: 'N', x: 30, y: 0, label: 'Common', kind: 'terminal' },
    ],
    props: [
      { key: 'vpk', label: 'Peak voltage', type: 'number', default: 12, unit: 'V', min: 0, max: 400 },
      { key: 'f', label: 'Frequency', type: 'number', default: 50, unit: 'Hz', min: 0.1, max: 1000 },
    ],
    shapes: [
      rect(-11, -48, 52, 44, '#f4f6f8', { rx: 4, grad: '#c5ccd4', shadow: 1, stroke: '#9aa3ad', strokeWidth: 0.6 }),
      rect(-6, -43, 42, 22, '#1d2f24', { rx: 2, grad: '#0f1a13' }),
      path('M -3 -32 Q 2 -43 7 -32 T 17 -32 T 27 -32 T 33 -34', 'none', { stroke: '#4cff8a', strokeWidth: 1 }),
      circle(0, 0, 3.8, '#e0453d', { grad: '#8f1f1a', gradDir: 'r', shadow: 0.8 }), circle(30, 0, 3.8, '#3a3c41', { grad: '#111214', gradDir: 'r', shadow: 0.8 }),
      text(15, -11, 'AC SOURCE', 3.6, '#333', 'middle', { weight: 700 }),
    ],
    readouts: [{ value: 'f', unit: 'Hz', x: 15, y: -50, size: 4.5 }],
    model: { elements: [{ id: 'SRC', kind: 'vsource', p: 'L', n: 'N', value: 'vpk * sin(6.28318 * f * t)', r: 0.5 }] },
    maxStep: 2e-4,
  },
  {
    type: 'crystal', name: 'Crystal oscillator', category: 'passive',
    description: 'Quartz crystal (e.g. 16 MHz for an ATmega). It sets a clock frequency in a real circuit; here it is modelled as its large DC resistance and tiny capacitance (the simulator doesn’t run at MHz).',
    keywords: ['crystal', 'xtal', 'quartz', '16mhz', 'clock'],
    pins: pinRow(['1', '2'], { step: 20 }),
    props: [{ key: 'f', label: 'Frequency', type: 'select', default: 16, options: [{ value: 16, label: '16 MHz' }, { value: 8, label: '8 MHz' }, { value: 32.768e-3, label: '32.768 kHz' }, { value: 12, label: '12 MHz' }] }],
    shapes: [...legs(pinRow(['1', '2'], { step: 20 }), -6), { type: 'path', d: 'M-4 -6 L-4 -14 A6 6 0 0 1 2 -20 L18 -20 A6 6 0 0 1 24 -14 L24 -6 Z', fill: '#f1f3f5', grad: '#8a929b', gradDir: 'h', stroke: COL.metalDark, strokeWidth: 0.5, shadow: 0.9 }, rect(-5, -7.5, 30, 2.5, '#c5cbd2', { rx: 1 }), text(10, -10.5, '16.000', 3.6, '#4a5058', 'middle', { weight: 700 })],
    model: { elements: [{ id: 'R', kind: 'resistor', a: '1', b: '2', value: 1e9 }, { id: 'C', kind: 'capacitor', a: '1', b: '2', value: 5e-12 }] },
  },
  {
    type: 'resonator', name: 'Ceramic resonator', category: 'passive',
    description: 'Three-pin ceramic resonator with built-in load capacitors (middle pin to GND). Clock source for microcontrollers; not oscillated in this simulator.',
    keywords: ['resonator', 'ceramic', 'clock', 'cstce'],
    pins: pinRow(['1', 'GND', '2']),
    shapes: [...legs(pinRow(['1', 'GND', '2']), -6), rect(-5, -19, 30, 13, '#4f8fe0', { rx: 5.5, grad: '#1f4f9f', shadow: 0.9 }), rect(-1, -17.5, 22, 2, '#ffffff', { opacity: 0.3, rx: 1 }), text(10, -10.5, '16.00', 3.8, '#fff', 'middle', { weight: 700 })],
    model: { elements: [{ id: 'C1', kind: 'capacitor', a: '1', b: 'GND', value: 15e-12 }, { id: 'C2', kind: 'capacitor', a: '2', b: 'GND', value: 15e-12 }, { id: 'R', kind: 'resistor', a: '1', b: '2', value: 1e9 }] },
  },
  (() => {
    const d = dip(['INC', 'UD', 'VH', 'GND', 'VW', 'VL', 'CS', 'VCC'], { label: 'X9C103', sub: '10k digital pot' });
    return {
      type: 'digipot', name: 'Digital potentiometer (X9C103)', category: 'passive',
      description: '100-step 10 kΩ digital potentiometer. Hold CS low; each falling edge on INC moves the wiper up (UD high) or down (UD low). VH–VW–VL behave like a pot’s pins.',
      keywords: ['digital pot', 'x9c103', 'x9c', 'mcp41', 'programmable resistor'],
      ...d,
      props: [{ key: 'r', label: 'Resistance', type: 'number', default: 10000, unit: 'Ω' }],
      states: [
        { name: 'incPrev', init: 1, next: 'v(INC, GND) > 2 ? 1 : 0' },
        // wiper moves on INC falling edges while CS is low; 99 steps end to end
        { name: 'wiper', init: 50, next: `(v(CS, GND) < 1 && incPrev == 1 && v(INC, GND) < 1) ? clamp(wiper + (v(UD, GND) > 2 ? 1 : -1), 0, 99) : wiper` },
      ],
      readouts: [{ value: 'wiper', x: 15, y: -4, size: 4 }],
      model: {
        elements: [
          ...hiz(['INC', 'UD', 'CS']),
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 5000 },
          { id: 'RH', kind: 'rvar', a: 'VH', b: 'VW', value: 'max(40, r * (99 - wiper) / 99)' },
          { id: 'RL', kind: 'rvar', a: 'VW', b: 'VL', value: 'max(40, r * wiper / 99)' },
        ],
      },
    };
  })(),
];
