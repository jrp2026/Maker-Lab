import { COL, axial, circle, contact, dip, header, legs, line, path, pcb, pinLabels, pinRow, rect, screwTerminals, shade, silk, smdRow, text, to220, to220At, to92, type Raw } from './kit';

const diodeBody = (color: string, band: string, w = 16) => [
  rect(20 - w / 2, -4.2, w, 8.4, shade(color, 0.25), { rx: 2.4, grad: shade(color, -0.35), shadow: 0.8 }),
  rect(20 + w / 2 - 4.4, -4.2, 2.8, 8.4, shade(band, 0.1), { grad: shade(band, -0.3) }),
  rect(20 - w / 2 + 2, -3.2, w - 4, 1.4, '#ffffff', { opacity: 0.25, rx: 0.7 }),
];
const diodeSymbol = (extra: Raw[] = []) => [
  line(0, 0, 15, 0, '#1f3a5f', 1.3), { type: 'path', d: 'M15 -6 L15 6 L25 0 Z', fill: '#1f3a5f' }, line(25, -6, 25, 6, '#1f3a5f', 1.3), line(25, 0, 40, 0, '#1f3a5f', 1.3), ...extra,
];
const AK = { A: 'Anode (+)', K: 'Cathode (−, banded)' };

const led5mm = (color: string, glowLevel: string, extra: Raw = {}) => ({
  pins: pinRow(['A', 'K'], { labels: { A: 'Anode (+, long leg)', K: 'Cathode (−)' } }),
  shapes: [
    ...legs(pinRow(['A', 'K']), -10),
    rect(-4.5, -13.5, 19, 3.8, shade(color, 0.1), { rx: 1, grad: shade(color, -0.3), opacity: 0.97 }),
    path('M-3 -12 L-3 -22 A8 8 0 0 1 13 -22 L13 -12 Z', shade(color, 0.3), { grad: shade(color, -0.3), gradDir: 'h', opacity: 0.93, stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.5, shadow: 0.6 }),
    rect(-0.8, -26, 2, 12, '#ffffff', { opacity: 0.4, rx: 1 }),
  ],
  ...extra,
  glowLevel,
});

export const SEMIS: Raw[] = [
  // ---------------------------------------------------------------- diodes
  {
    type: 'zener', name: 'Zener diode', category: 'diodes',
    description: 'Conducts in reverse at its Zener voltage — the classic cheap voltage reference / clamp. Put it cathode-to-positive with a series resistor.',
    keywords: ['zener', '1n4733', 'reference', 'regulator', 'clamp'],
    ...axial(['A', 'K'], diodeBody('#c95f2d', '#1d1d1d'), AK),
    props: [{ key: 'vz', label: 'Zener voltage', type: 'select', default: 5.1, options: [3.3, 4.7, 5.1, 6.2, 9.1, 12, 15].map((v) => ({ value: v, label: `${v} V` })) }],
    symbol: diodeSymbol([line(25, -6, 22, -8, '#1f3a5f', 1.3), line(25, 6, 28, 8, '#1f3a5f', 1.3)]),
    model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'zener', vz: 'vz' }] },
    summary: 'Voltage reference / clamp',
  },
  {
    type: 'schottky', name: 'Schottky diode (1N5819)', category: 'diodes',
    description: 'Low forward drop (~0.3 V) and fast recovery — for reverse-polarity protection and switching supplies. 1 A.',
    keywords: ['schottky', '1n5819', 'low drop', 'fast'],
    ...axial(['A', 'K'], diodeBody('#222', '#cfd4da'), AK),
    symbol: diodeSymbol([{ type: 'path', d: 'M25 -6 L22 -6 L22 -4 M25 6 L28 6 L28 4', fill: 'none', stroke: '#1f3a5f', strokeWidth: 1.2 }]),
    model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'schottky' }] },
    warnings: [{ when: 'i(D) > 1', level: 'error', message: 'Above the 1 A rating.' }],
  },
  {
    type: 'schottky-power', name: 'Schottky power diode (SB560)', category: 'diodes',
    description: '5 A, 60 V Schottky rectifier for high-current supplies and motor circuits.',
    keywords: ['schottky', 'power', 'sb560', 'rectifier'],
    ...axial(['A', 'K'], diodeBody('#222', '#cfd4da', 22), AK),
    symbol: diodeSymbol(),
    model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'schottky' }, { id: 'D2', kind: 'diode', a: 'A', k: 'K', model: 'schottky' }] },
    warnings: [{ when: 'i(D) + i(D2) > 5', level: 'error', message: 'Above the 5 A rating.' }],
  },
  {
    type: 'tvs', name: 'TVS protection diode', category: 'diodes',
    description: 'Bidirectional transient-voltage-suppressor (clamps both polarities above ~6.8 V). Put it across a supply or data line to absorb spikes.',
    keywords: ['tvs', 'esd', 'surge', 'transient', 'protection', 'p6ke'],
    ...axial(['1', '2'], [...diodeBody('#2b2b2e', '#2b2b2e'), text(20, 1.4, 'P6KE', 3, '#c9ccd1', 'middle', { weight: 600 })]),
    symbol: [line(0, 0, 12, 0, '#1f3a5f', 1.3), { type: 'path', d: 'M12 -6 L12 6 L20 0 Z M28 -6 L28 6 L20 0 Z', fill: '#1f3a5f' }, line(20, -6, 20, 6, '#1f3a5f', 1.3), line(28, 0, 40, 0, '#1f3a5f', 1.3)],
    model: {
      nodes: ['M'],
      elements: [{ id: 'D1', kind: 'diode', a: 'M', k: '1', model: 'zener', vz: 6.1 }, { id: 'D2', kind: 'diode', a: 'M', k: '2', model: 'zener', vz: 6.1 }],
    },
  },
  {
    type: 'ir-led', name: 'Infrared LED (940 nm)', category: 'diodes',
    description: 'IR LED for remotes and obstacle sensors. Invisible to the eye — shown here the way a phone camera sees it (faint violet). Vf ≈ 1.2 V, 20–50 mA.',
    keywords: ['ir', 'infrared', 'remote', '940nm', 'emitter'],
    ...(() => {
      const l = led5mm('#b9c2cf', '');
      return { pins: l.pins, shapes: [...l.shapes, text(5, -18, 'IR', 3.6, '#555')] };
    })(),
    indicators: [{ shape: { type: 'path', d: 'M-3 -12 L-3 -22 A8 8 0 0 1 13 -22 L13 -12 Z' }, color: '#b388ff', level: 'clamp(sqrt(i(D) / 0.03), 0, 1)' }],
    model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'led', vf: 1.25 }] },
    warnings: [{ when: 'i(D) > 0.1', level: 'error', message: 'Over 100 mA — add a series resistor.' }],
  },
  {
    type: 'photodiode', name: 'Photodiode', category: 'diodes',
    description: 'Light makes a small current flow from cathode to anode (reverse-biased use). Pair it with a resistor to get a voltage, or an op-amp for a transimpedance amplifier. Set the light level while simulating.',
    keywords: ['photodiode', 'bpw34', 'light', 'sensor'],
    ...(() => {
      const l = led5mm('#1c1c1f', '');
      return { pins: pinRow(['A', 'K'], { labels: { A: 'Anode', K: 'Cathode' } }), shapes: l.shapes };
    })(),
    props: [{ key: 'light', label: 'Light', type: 'slider', default: 0.5, min: 0, max: 1 }],
    drag: 'light',
    model: { elements: [{ id: 'D', kind: 'diode', a: 'A', k: 'K', model: 'silicon' }, { id: 'IPH', kind: 'isource', p: 'A', n: 'K', value: '-light * 100e-6' }] },
    readouts: [{ value: 'light * 100', unit: '%', x: 5, y: -28, size: 4.5 }],
  },
  {
    type: 'laser', name: 'Laser diode module', category: 'diodes',
    description: '5 V, 650 nm red laser module (with built-in current limiting). S = signal/+, − = ground. Draws ~30 mA.',
    keywords: ['laser', 'ky-008', '650nm', 'pointer'],
    pins: pinRow(['S', 'N'], { labels: { S: 'Signal / +5 V', N: 'GND' } }),
    shapes: [
      ...legs(pinRow(['S', 'N']), -8),
      rect(-8, -27, 28, 20, '#f3dc9a', { rx: 3, grad: '#a8862e', shadow: 1, stroke: '#8a6c20', strokeWidth: 0.4 }),
      rect(-6, -25, 24, 3, '#ffffff', { opacity: 0.35, rx: 1.5 }),
      rect(20, -22, 7, 10, '#e7eaee', { rx: 1, grad: '#8a929b' }), circle(27, -17, 2.4, '#8a1c1c', { grad: '#ff6b6b', gradDir: 'r' }),
      text(6, -14, '650nm', 3, '#6b5418', 'middle', { weight: 700 }),
    ],
    indicators: [
      { shape: rect(26, -18, 90, 2, '#ff2a2a'), color: '#ff2a2a', level: 'v(S, N) > 2.5 ? 0.85 : 0' },
      { shape: circle(118, -17, 4, '#ff2a2a'), color: '#ff2a2a', level: 'v(S, N) > 2.5 ? 1 : 0' },
    ],
    model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: 'S', b: 'M', value: 82 }, { id: 'D', kind: 'diode', a: 'M', k: 'N', model: 'led', vf: 2.2 }] },
  },

  // ---------------------------------------------------------------- transistors
  {
    type: 'nmos', name: 'MOSFET (N-channel)', category: 'transistors',
    description: 'N-channel enhancement MOSFET for low-side switching. Pins G, D, S. Choose a logic-level part (IRLZ44N, 2N7000) to drive it straight from 5 V pins.',
    keywords: ['mosfet', 'nmos', 'n-channel', 'irf540', 'irlz44n', '2n7000', 'fet'],
    ...to220(['G', 'D', 'S'], 'IRLZ44N', { G: 'Gate', D: 'Drain', S: 'Source' }),
    props: [{ key: 'part', label: 'Part', type: 'select', default: 1, options: [{ value: 1, label: 'IRLZ44N (logic level)' }, { value: 2, label: 'IRF540N (10 V gate)' }] }],
    symbol: [line(0, 0, 0, -20, '#1f3a5f', 1.2), line(0, -20, 6, -20, '#1f3a5f', 1.2), line(6, -28, 6, -12, '#1f3a5f', 1.4), line(9, -28, 9, -12, '#1f3a5f', 1.4), line(9, -26, 20, -26, '#1f3a5f', 1.2), line(20, -26, 20, -34, '#1f3a5f', 1.2), line(9, -14, 20, -14, '#1f3a5f', 1.2), line(20, -14, 20, 0, '#1f3a5f', 1.2), line(10, -26, 10, -26), text(-2, -30, 'G D S', 4)],
    model: {
      nodes: ['GI'],
      elements: [
        { id: 'RG', kind: 'resistor', a: 'G', b: 'GI', value: 10 },
        { id: 'M', kind: 'nmos', d: 'D', g: 'GI', s: 'S', vth: 'part == 2 ? 3.5 : 1.7', k: 'part == 2 ? 8 : 12' },
        { id: 'BD', kind: 'diode', a: 'S', k: 'D', model: 'power' },
      ],
    },
    warnings: [{ when: 'i(M) > 30', level: 'error', message: 'Drain current above ~30 A.' }, { when: 'abs(v(G, S)) > 20', level: 'error', message: 'Gate–source voltage above ±20 V would destroy the gate.' }],
  },
  {
    type: 'pmos', name: 'MOSFET (P-channel)', category: 'transistors',
    description: 'P-channel MOSFET (IRF9540N style) for high-side switching: source to the supply, pull the gate low to turn it on.',
    keywords: ['mosfet', 'pmos', 'p-channel', 'irf9540', 'high side', 'fet'],
    ...to220(['G', 'D', 'S'], 'IRF9540N', { G: 'Gate', D: 'Drain', S: 'Source' }),
    model: { elements: [{ id: 'M', kind: 'pmos', d: 'D', g: 'G', s: 'S', vth: 2.2, k: 6 }, { id: 'BD', kind: 'diode', a: 'D', k: 'S', model: 'power' }] },
  },
  (() => {
    const pins = pinRow(['SIG', 'VCC', 'GND'], { labels: { SIG: 'Signal (PWM ok)', VCC: 'VCC (logic)', GND: 'GND' } });
    const load = pinRow(['VIN', 'VOUT', 'LGND'], { x0: 60, kind: 'terminal', labels: { VIN: 'V+ (load supply)', VOUT: 'Load − (switched)', LGND: 'Load supply GND' } });
    return {
      type: 'mosfet-module', name: 'Logic-level MOSFET module', category: 'transistors',
      description: 'MOSFET switch board: connect SIG to a pin, and put your load between V+ and VOUT (low-side switch, up to ~5 A). The LED shows the gate state.',
      keywords: ['mosfet module', 'irf520', 'switch module', 'pwm driver'],
      pins: [...pins, ...load],
      shapes: [
        ...pcb(-9, -50, 98, 46, '#b02a24', { holes: 'top' }),
        ...to220At(26, -44, 'IRLZ44N', -14),
        ...header(pins), ...pinLabels(pins, -9.8),
        ...screwTerminals(load, '#2f7fd6'), silk(60, -14.5, 'V+', 2.6), silk(70, -14.5, 'OUT', 2.6), silk(80, -14.5, 'GND', 2.6),
        ...smdRow(56, -36, 4, 6), rect(1.5, -37.5, 5, 3, '#efe9d2', { rx: 0.4 }),
      ],
      indicators: [{ shape: rect(1.5, -37.5, 5, 3, '#ff3b30', { rx: 0.4 }), color: '#ff3b30', level: 'v(SIG, GND) > 1.5 ? 1 : 0' }],
      connections: [['GND', 'LGND']],
      model: {
        elements: [
          { id: 'RIN', kind: 'resistor', a: 'SIG', b: 'GND', value: 10000 },
          { id: 'M', kind: 'nmos', d: 'VOUT', g: 'SIG', s: 'LGND', vth: 1.6, k: 15 },
          { id: 'FD', kind: 'diode', a: 'VOUT', k: 'VIN', model: 'schottky' },
        ],
      },
    };
  })(),
  {
    type: 'darlington', name: 'Darlington transistor (TIP120)', category: 'transistors',
    description: 'NPN Darlington pair: current gain ~1000, 5 A. Pins B, C, E. Drives motors and solenoids from a single Arduino pin via ~1 kΩ; drops ~1 V when on.',
    keywords: ['darlington', 'tip120', 'npn', 'power', 'transistor'],
    ...to220(['B', 'C', 'E'], 'TIP120', { B: 'Base', C: 'Collector', E: 'Emitter' }),
    model: {
      nodes: ['E1'],
      elements: [
        { id: 'Q1', kind: 'npn', c: 'C', b: 'B', e: 'E1', beta: 30 },
        { id: 'Q2', kind: 'npn', c: 'C', b: 'E1', e: 'E', beta: 40 },
        { id: 'R1', kind: 'resistor', a: 'B', b: 'E1', value: 8000 },
        { id: 'R2', kind: 'resistor', a: 'E1', b: 'E', value: 120 },
        { id: 'DF', kind: 'diode', a: 'E', k: 'C', model: 'power' },
      ],
    },
    warnings: [{ when: 'i(Q2) > 5', level: 'error', message: 'Collector current above 5 A.' }],
  },
  (() => {
    const d = dip(['A', 'K', 'E', 'C'], { label: 'PC817', labels: { A: 'LED anode', K: 'LED cathode', E: 'Emitter', C: 'Collector' } });
    return {
      type: 'optocoupler', name: 'Optocoupler (PC817)', category: 'transistors',
      description: 'An LED shining on a phototransistor inside one package — the two sides are electrically isolated. Drive A/K through a resistor (~5–10 mA); C/E then conduct like a switch (CTR ≈ 100%).',
      keywords: ['optocoupler', 'optoisolator', 'pc817', '4n35', 'isolation'],
      ...d,
      model: {
        nodes: ['B'],
        elements: [
          { id: 'LED', kind: 'diode', a: 'A', k: 'K', model: 'led', vf: 1.2 },
          // light → photo-current into the phototransistor's base (CTR ≈ β·0.01 = 100 %)
          { id: 'PH', kind: 'isource', p: 'B', n: 'E', value: '0.01 * max(0, i(LED))' },
          { id: 'PT', kind: 'npn', c: 'C', b: 'B', e: 'E', beta: 100 },
          { id: 'LEAK', kind: 'resistor', a: 'C', b: 'E', value: 1e8 },
        ],
      },
    };
  })(),
  {
    type: 'jfet', name: 'JFET (2N5457)', category: 'transistors',
    description: 'N-channel JFET: conducts with 0 V on the gate and pinches off as the gate goes negative (Vgs(off) ≈ −1.5 V). Pins D, S, G.',
    keywords: ['jfet', '2n5457', 'j201', 'depletion'],
    ...to92(['D', 'S', 'G'], '2N5457', COL.ic, { D: 'Drain', S: 'Source', G: 'Gate' }),
    model: { elements: [{ id: 'M', kind: 'nmos', d: 'D', g: 'G', s: 'S', vth: -1.5, k: 0.002 }, { id: 'GJ', kind: 'diode', a: 'G', k: 'S', model: 'silicon' }] },
  },
  {
    type: 'igbt', name: 'IGBT', category: 'transistors',
    description: 'Insulated-gate bipolar transistor (IRG4BC20 style): MOSFET-like gate, BJT-like ~1.5 V on-state drop. For high-voltage motor and inverter switching. Pins G, C, E.',
    keywords: ['igbt', 'irg4', 'inverter', 'power switch'],
    ...to220(['G', 'C', 'E'], 'IGBT', { G: 'Gate', C: 'Collector', E: 'Emitter' }),
    model: {
      nodes: ['X'],
      elements: [
        { id: 'DJ', kind: 'diode', a: 'C', k: 'X', model: 'power' },
        { id: 'M', kind: 'nmos', d: 'X', g: 'G', s: 'E', vth: 5, k: 4 },
      ],
    },
  },
  {
    type: 'triac', name: 'TRIAC (BT136)', category: 'transistors',
    description: 'Bidirectional thyristor for AC switching (dimmers, heaters). A small gate current (either polarity) turns it on; it stays on until the main current drops below the holding current (at the AC zero crossing). Pins MT1, MT2, G.',
    keywords: ['triac', 'bt136', 'ac switch', 'dimmer', 'thyristor'],
    ...to220(['MT1', 'MT2', 'G'], 'BT136', { MT1: 'Main terminal 1', MT2: 'Main terminal 2', G: 'Gate' }),
    states: [{ name: 'on', init: 0, next: '(abs(i(RG)) > 0.005 || (on == 1 && abs(i(SW)) > 0.01)) ? 1 : 0' }],
    model: {
      elements: [
        { id: 'RG', kind: 'resistor', a: 'G', b: 'MT1', value: 60 },
        contact('SW', 'MT2', 'MT1', 'on == 1', 0.2),
      ],
    },
    maxStep: 2e-4,
  },
  {
    type: 'scr', name: 'SCR / thyristor (2N5064)', category: 'transistors',
    description: 'Silicon-controlled rectifier: a gate pulse latches it on (anode → cathode); it only turns off when the anode current falls below ~5 mA. Pins K, G, A.',
    keywords: ['scr', 'thyristor', '2n5064', 'latch', 'crowbar'],
    ...to92(['K', 'G', 'A'], '2N5064', COL.ic, { K: 'Cathode', G: 'Gate', A: 'Anode' }),
    states: [{ name: 'on', init: 0, next: '(i(GK) > 0.0002 || (on == 1 && i(SW) > 0.005)) ? 1 : 0' }],
    model: {
      nodes: ['M'],
      elements: [
        { id: 'GK', kind: 'diode', a: 'G', k: 'K', model: 'silicon' },
        { id: 'DA', kind: 'diode', a: 'A', k: 'M', model: 'silicon' },
        contact('SW', 'M', 'K', 'on == 1', 0.3),
      ],
    },
    maxStep: 2e-4,
  },
];

