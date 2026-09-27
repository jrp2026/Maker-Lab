/**
 * A part as the AI part generator would return it — used by the "AI part" example to show what a
 * generated part looks like on the canvas. It is deliberately a part MakerLab does not have built in.
 */
export const TELEGRAPH_KEY_SPEC = {
  name: 'Morse telegraph key',
  description: 'A straight Morse key on a wooden base: press the brass lever and its contacts close (A to B). Wire it in series with a buzzer or LED to send Morse code.',
  category: 'switches',
  keywords: ['morse', 'telegraph', 'straight key', 'cw', 'key'],
  pins: [
    { id: 'A', x: 0, y: 0, label: 'Contact A', kind: 'lead' },
    { id: 'B', x: 40, y: 0, label: 'Contact B', kind: 'lead' },
  ],
  shapes: [
    // wooden base
    { type: 'rect', x: -14, y: -52, w: 68, h: 44, rx: 4, fill: '#a86a3a', grad: '#6e4020', gradDir: 'd', shadow: 1 },
    { type: 'rect', x: -10, y: -48, w: 60, h: 36, rx: 3, fill: 'none', stroke: '#c58a55', strokeWidth: 0.6, opacity: 0.6 },
    // brass contact screws and binding posts
    { type: 'circle', cx: 0, cy: -16, r: 4, fill: '#e9c46a', grad: '#9c7a2a', gradDir: 'r', stroke: '#6b531c', strokeWidth: 0.5 },
    { type: 'circle', cx: 40, cy: -16, r: 4, fill: '#e9c46a', grad: '#9c7a2a', gradDir: 'r', stroke: '#6b531c', strokeWidth: 0.5 },
    { type: 'circle', cx: 34, cy: -30, r: 3, fill: '#d9d9d9', grad: '#7c7c7c', gradDir: 'r' },
    // pivot bracket
    { type: 'rect', x: -6, y: -38, w: 10, h: 16, rx: 1.5, fill: '#e9c46a', grad: '#9c7a2a', gradDir: 'h', stroke: '#6b531c', strokeWidth: 0.5 },
    // the lever and knob are drawn by the animations below (they dip when pressed)
    { type: 'text', x: 20, y: -42, text: 'MORSE', size: 4.5, fill: '#f3dcc0', weight: 700 },
    // leads
    { type: 'line', x1: 0, y1: -12, x2: 0, y2: 0, stroke: '#9aa3ad', strokeWidth: 2 },
    { type: 'line', x1: 40, y1: -12, x2: 40, y2: 0, stroke: '#9aa3ad', strokeWidth: 2 },
  ],
  symbol: [
    { type: 'line', x1: 0, y1: 0, x2: 0, y2: -14, strokeWidth: 1.3 },
    { type: 'line', x1: 40, y1: 0, x2: 40, y2: -14, strokeWidth: 1.3 },
    { type: 'line', x1: 0, y1: -14, x2: 34, y2: -24, strokeWidth: 1.3 },
    { type: 'circle', cx: 40, cy: -14, r: 1.6, fill: 'none', strokeWidth: 1.2 },
    { type: 'line', x1: 20, y1: -19, x2: 20, y2: -30, strokeWidth: 1.2 },
    { type: 'line', x1: 15, y1: -30, x2: 25, y2: -30, strokeWidth: 1.2 },
  ],
  interactive: 'press',
  model: {
    nodes: [],
    elements: [{ id: 'SW', kind: 'rvar', a: 'A', b: 'B', value: 'pressed ? 0.05 : 1e9' }],
  },
  animations: [
    { shape: { type: 'rect', x: -4, y: -33, w: 52, h: 6, rx: 2, fill: '#f0cf78', grad: '#a57f2c', stroke: '#6b531c', strokeWidth: 0.5, shadow: 0.6 }, dy: 'pressed ? 2 : 0' },
    { shape: { type: 'circle', cx: 46, cy: -30, r: 7, fill: '#3a3a3a', grad: '#0e0e0e', gradDir: 'r', shadow: 1 }, dy: 'pressed ? 2 : 0' },
  ],
  warnings: [{ when: 'pressed && abs(i(SW)) > 3', level: 'error', message: 'Over 3 A through the key contacts: they would weld. Add a current-limiting load.' }],
};
