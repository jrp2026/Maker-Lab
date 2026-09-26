import { COL, circle, contact, dip, line, pinRow, rect, text, type Raw } from './kit';

// segment geometry inside a 7-seg body spanning x −6…46, y 4…56
const SEG: Record<string, Raw> = {
  A: rect(13, 10, 18, 3.4, '', { rx: 1.5 }),
  B: rect(31.5, 13, 3.4, 15, '', { rx: 1.5 }),
  C: rect(30, 32, 3.4, 15, '', { rx: 1.5 }),
  D: rect(11, 46.5, 18, 3.4, '', { rx: 1.5 }),
  E: rect(8, 32, 3.4, 15, '', { rx: 1.5 }),
  F: rect(9.5, 13, 3.4, 15, '', { rx: 1.5 }),
  G: rect(12, 28.3, 18, 3.4, '', { rx: 1.5 }),
  DP: circle(38, 48, 2.2, ''),
};
const colored = (s: Raw, fill: string) => ({ ...s, fill });

function sevenSeg(anode: boolean): Raw {
  const d = dip(['E', 'D', 'COM1', 'C', 'DP', 'B', 'A', 'COM2', 'F', 'G'], { label: '', wide: true, labels: { COM1: anode ? 'Common anode' : 'Common cathode', COM2: anode ? 'Common anode' : 'Common cathode', DP: 'Decimal point' } });
  const segs = Object.keys(SEG);
  return {
    type: anode ? 'seven-seg-ca' : 'seven-seg-cc',
    name: `Seven-segment display (common ${anode ? 'anode' : 'cathode'})`,
    category: 'displays',
    description: anode
      ? 'Single 0.56" digit: the eight LED anodes are tied to COM (connect to +5 V); pull a segment pin LOW through a ~220 Ω resistor to light it.'
      : 'Single 0.56" digit: the eight LED cathodes are tied to COM (connect to GND); drive a segment pin HIGH through a ~220 Ω resistor to light it.',
    keywords: ['seven segment', '7 segment', '7-seg', 'digit', 'numeric display', anode ? 'common anode' : 'common cathode', '5161'],
    pins: d.pins,
    symbol: d.symbol,
    shapes: [
      ...d.pins.map((p) => line(p.x, p.y === 0 ? 5 : 55, p.x, p.y, COL.metal, 2.4)),
      rect(-6, 4, 52, 52, '#1c1d20', { rx: 1.5, stroke: '#000', strokeWidth: 0.6 }),
      ...segs.map((k) => colored(SEG[k], '#3a2222')),
    ],
    indicators: segs.map((k) => ({ shape: colored(SEG[k], '#ff2a1a'), color: '#ff2a1a', level: `clamp(i(D${k}) / 0.01, 0, 1)` })),
    connections: [['COM1', 'COM2']],
    model: {
      elements: segs.map((k) => (anode ? { id: `D${k}`, kind: 'diode', a: 'COM1', k, model: 'led', vf: 1.9 } : { id: `D${k}`, kind: 'diode', a: k, k: 'COM1', model: 'led', vf: 1.9 })),
    },
    warnings: [{ when: segs.map((k) => `i(D${k}) > 0.03`).join(' || '), level: 'error', message: 'A segment carries more than 30 mA — add series resistors.' }],
  };
}

function matrix8x8(): Raw {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];
  const cols = rows;
  const pins = [
    ...pinRow(rows.map((r) => `R${r}`), { y: 100, labels: Object.fromEntries(rows.map((r) => [`R${r}`, `Row ${r} (anodes)`])) }),
    ...pinRow(cols.map((c) => `C${c}`), { y: 0, labels: Object.fromEntries(cols.map((c) => [`C${c}`, `Column ${c} (cathodes)`])) }),
  ];
  const dot = (r: number, c: number) => circle((c - 1) * 10, 12 + (r - 1) * 10.8, 3.6, '');
  const elements: Raw[] = [];
  const indicators: Raw[] = [];
  for (const r of rows)
    for (const c of cols) {
      elements.push({ id: `D${r}${c}`, kind: 'diode', a: `R${r}`, k: `C${c}`, model: 'led', vf: 1.9 });
      indicators.push({ shape: colored(dot(r, c), '#ff2a1a'), color: '#ff2a1a', level: `clamp(i(D${r}${c}) / 0.01, 0, 1)` });
    }
  return {
    type: 'led-matrix', name: 'LED matrix 8×8 (1088AS)', category: 'displays',
    description: '64 red LEDs in a grid: row pins are the anodes, column pins the cathodes. Light one LED by driving its row HIGH and its column LOW (through resistors); multiplex rows fast to draw images — or drive it from a MAX7219.',
    keywords: ['led matrix', '8x8', 'dot matrix', '1088as', 'max7219', 'scrolling text'],
    pins,
    shapes: [
      ...pins.map((p) => line(p.x, p.y === 0 ? 5 : 95, p.x, p.y, COL.metal, 2)),
      rect(-6, 4, 82, 92, '#15161a', { rx: 1.5 }),
      ...rows.flatMap((r) => cols.map((c) => colored(dot(r, c), '#3a2323'))),
    ],
    indicators,
    model: { elements },
  };
}

export const DISPLAYS: Raw[] = [
  sevenSeg(false),
  sevenSeg(true),
  matrix8x8(),
  (() => {
    const pins = pinRow(['XP', 'YP', 'XM', 'YM'], { labels: { XP: 'X+', YP: 'Y+', XM: 'X−', YM: 'Y−' } });
    return {
      type: 'touch-panel', name: 'Resistive touchscreen (4-wire)', category: 'displays',
      description: 'Two resistive films (X ≈ 300 Ω, Y ≈ 500 Ω) that touch where you press. To read X: put 5 V across X+/X−, and analogRead Y+ (and vice-versa for Y). Set the touch point, then press the panel while simulating.',
      keywords: ['touchscreen', 'touch panel', 'resistive touch', '4-wire', 'touch'],
      pins,
      props: [
        { key: 'x', label: 'Touch X', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.01 },
        { key: 'y', label: 'Touch Y', type: 'slider', default: 0.5, min: 0, max: 1, step: 0.01 },
      ],
      interactive: 'press',
      shapes: [line(0, 0, 0, -10, COL.copper, 1.4), line(10, 0, 10, -10, COL.copper, 1.4), line(20, 0, 20, -10, COL.copper, 1.4), line(30, 0, 30, -10, COL.copper, 1.4), rect(-6, -12, 42, 6, '#d9b36a', { rx: 1 }), rect(-40, -96, 110, 84, '#cfd8dc', { rx: 3, stroke: '#90a4ae', strokeWidth: 1 }), rect(-36, -92, 102, 76, '#e8eef1', { rx: 2 })],
      animations: [{ shape: circle(15, -54, 4, '#e53935', { opacity: 0.8 }), dx: '(x - 0.5) * 96', dy: '(0.5 - y) * 70' }],
      model: {
        nodes: ['TX', 'TY'],
        elements: [
          { id: 'X1', kind: 'rvar', a: 'XP', b: 'TX', value: 'max(1, 300 * (1 - x))' },
          { id: 'X2', kind: 'rvar', a: 'TX', b: 'XM', value: 'max(1, 300 * x)' },
          { id: 'Y1', kind: 'rvar', a: 'YP', b: 'TY', value: 'max(1, 500 * (1 - y))' },
          { id: 'Y2', kind: 'rvar', a: 'TY', b: 'YM', value: 'max(1, 500 * y)' },
          { id: 'T', kind: 'rvar', a: 'TX', b: 'TY', value: 'pressed == 1 ? 400 : 1e9' },
        ],
      },
    };
  })(),
];

const KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];

export const KEYPAD: Raw = (() => {
  const pins = pinRow(['R1', 'R2', 'R3', 'R4', 'C1', 'C2', 'C3', 'C4'], { labels: { R1: 'Row 1', R2: 'Row 2', R3: 'Row 3', R4: 'Row 4', C1: 'Column 1', C2: 'Column 2', C3: 'Column 3', C4: 'Column 4' } });
  const kx = (i: number) => -5 + (i % 4) * 22, ky = (i: number) => -100 + Math.floor(i / 4) * 22;
  const down = (i: number) => `key == ${i + 1} && (pressed == 1 || hold == 1)`;
  return {
    type: 'keypad', name: 'Keypad 4×4 (matrix)', category: 'switches',
    description: '16 membrane keys in a 4×4 matrix: pressing a key connects its row pin to its column pin. Scan it (Keypad library, or drive rows and read columns). Pick the key in the inspector and press the keypad on the canvas — or set it to stay held.',
    keywords: ['keypad', 'matrix keypad', '4x4', 'membrane', 'keyboard', 'pin code', 'keypad matrix'],
    pins,
    props: [
      { key: 'key', label: 'Key', type: 'select', default: 1, options: KEYS.map((k, i) => ({ value: i + 1, label: k })) },
      { key: 'hold', label: 'Mode', type: 'select', default: 0, options: [{ value: 0, label: 'Pressed while you hold the keypad' }, { value: 1, label: 'Held down' }] },
    ],
    interactive: 'press',
    shapes: [
      ...pins.map((p) => line(p.x, p.y, p.x, -12, '#20242a', 3)),
      rect(-14, -110, 98, 96, '#1f2226', { rx: 3 }),
      ...KEYS.flatMap((k, i) => [rect(kx(i), ky(i), 18, 18, i % 4 === 3 ? '#d63c35' : i >= 12 && i !== 13 ? '#2f6fd6' : '#f4f2ec', { rx: 2 }), text(kx(i) + 9, ky(i) + 12, k, 7, i % 4 === 3 || (i >= 12 && i !== 13) ? '#fff' : '#222')]),
    ],
    indicators: KEYS.map((_, i) => ({ shape: rect(kx(i), ky(i), 18, 18, '#ffe066', { rx: 2, opacity: 0.6 }), color: '#ffe066', level: `(${down(i)}) ? 1 : 0` })),
    model: { elements: KEYS.map((_, i) => contact(`K${i + 1}`, `R${Math.floor(i / 4) + 1}`, `C${(i % 4) + 1}`, down(i), 100)) },
  };
})();
