import { COL, chip, circle, contact, ecap, jumper, line, micCapsule, moduleBoard, motorModel, path, pinRow, rect, rpm, shade, silk, smdRow, statusLed, text, type Raw } from './kit';

/** red / black motor leads from the pins up to the body */
const leads = (y: number): Raw[] => [line(0, 0, 0, y, '#d63c35', 1.8), line(20, 0, 20, y, '#26282c', 1.8)];

/** a D-cut output shaft that turns (drawn as the animated part) */
const dShaft = (cx: number, cy: number, r: number, color = '#f4f2ec'): Raw => path(`M ${cx - r} ${cy - r * 0.45} L ${cx + r} ${cy - r * 0.45} L ${cx + r} ${cy + r * 0.45} L ${cx - r} ${cy + r * 0.45} Z`, color, { stroke: shade(color, -0.35), strokeWidth: 0.5 });

function gearMotor(o: { type: string; name: string; description: string; keywords: string[]; r: number; k: number; j: number; i0: number; gear: number; maxV: number; shapes: Raw[]; hub: [number, number, number]; spin?: Raw }): Raw {
  const m = motorModel('P', 'N', { r: o.r, k: o.k, j: o.j, i0: o.i0, gear: o.gear });
  const [cx, cy, rr] = o.hub;
  return {
    type: o.type, name: o.name, category: 'output', description: o.description, keywords: o.keywords,
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: 'Motor +', N: 'Motor −' } }),
    shapes: [...leads(-8), ...o.shapes],
    animations: [{ shape: o.spin ?? { type: 'path', d: `M${cx - rr} ${cy} L${cx + rr} ${cy} M${cx} ${cy - rr} L${cx} ${cy + rr}`, stroke: '#f2f4f6', strokeWidth: 1.6, fill: 'none' }, rotate: 'angle * 30', cx, cy }],
    readouts: [{ value: rpm(o.gear), unit: 'rpm', x: 10, y: cy - rr - 6, size: 4.5 }],
    states: m.states,
    model: { nodes: m.nodes, elements: m.elements },
    warnings: [{ when: `abs(v(P, N)) > ${o.maxV * 1.25}`, level: 'warn', message: `Rated for ${o.maxV} V.` }, { when: `abs(i(RA)) > ${3 * o.i0} && abs(w) < 1`, level: 'warn', message: 'Stalled — it draws its stall current and heats up.' }],
  };
}

const STEPPER_STATE = (x: string, y: string, stepDeg: number): Raw[] => [
  // electrical angle follows the magnetic field of the energised coils (unwrapped)
  { name: 'e', init: 0, next: `(abs(${x}) + abs(${y}) > 0.02) ? e + (mod(atan2(${y}, ${x}) * 57.2958 - e + 540, 360) - 180) : e` },
  { name: 'steps', init: 0, next: `round(e / 90)` },
  { name: 'deg', init: 0, next: `e / 90 * ${stepDeg}` },
];

export const MOTORS: Raw[] = [
  gearMotor({
    type: 'gear-motor', name: 'Gear motor (TT, 1:48)', r: 6, k: 0.0055, j: 1e-6, i0: 0.15, gear: 48, maxV: 6,
    description: 'The yellow "TT" robot-car motor: brushed DC motor with a 1:48 plastic gearbox, ~200 rpm at 6 V (3–6 V). Stall ~1 A — drive it from a motor driver.',
    keywords: ['gear motor', 'tt motor', 'robot car', 'yellow motor', 'dc gear motor'],
    shapes: [
      // silver motor can behind the yellow gearbox
      rect(26, -36, 24, 22, '#eef1f4', { rx: 2, grad: '#8a929b', shadow: 1 }), rect(48, -31, 5, 12, '#d9b45a', { rx: 1, grad: '#9c7b26' }),
      rect(-12, -42, 42, 34, '#f7d24a', { rx: 3, grad: '#d9a91c', shadow: 1, stroke: '#b88a14', strokeWidth: 0.6 }),
      circle(-7, -37, 1.6, '#b88a14'), circle(25, -37, 1.6, '#b88a14'), circle(-7, -13, 1.6, '#b88a14'), circle(25, -13, 1.6, '#b88a14'),
      circle(7, -25, 8, '#e6b92a', { stroke: '#b88a14', strokeWidth: 0.5 }), circle(7, -25, 4.5, '#fdf6dc'),
      text(16, -12, '1:48', 3, '#8a6a10', 'middle', { weight: 700 }),
    ],
    hub: [7, -25, 6],
    spin: dShaft(7, -25, 6.5),
  }),
  gearMotor({
    type: 'n20-motor', name: 'N20 micro gear motor (1:100)', r: 15, k: 0.0018, j: 2e-7, i0: 0.04, gear: 100, maxV: 6,
    description: 'Tiny metal-gear motor (12 mm): ~300 rpm at 6 V with a 1:100 gearbox, stall ~0.4 A. For small robots and mechanisms.',
    keywords: ['n20', 'micro gear motor', 'metal gear', 'small motor'],
    shapes: [
      rect(-3, -34, 26, 24, '#eef1f4', { rx: 3, grad: '#868f98', gradDir: 'h', shadow: 1 }), rect(-1, -12, 22, 3, '#2a2c30', { rx: 1 }),
      rect(-2, -46, 24, 12, '#f3d98a', { rx: 1, grad: '#b08a2a', gradDir: 'h', shadow: 0.8 }), ...[0, 1, 2].map((i) => rect(-2, -43.5 + i * 3.5, 24, 0.7, '#8a6a1a', { opacity: 0.6 })),
      rect(8, -52, 4, 7, '#d5d9de', { grad: '#8a929b', gradDir: 'h' }),
    ],
    hub: [10, -52, 3.5],
    spin: rect(9, -55.5, 2, 7, '#9aa3ad', { rx: 0.5 }),
  }),
  gearMotor({
    type: 'planetary-motor', name: 'Planetary gear motor (12 V, 1:30)', r: 3, k: 0.0115, j: 5e-6, i0: 0.2, gear: 30, maxV: 12,
    description: '37 mm 12 V motor with a planetary gearbox: ~330 rpm, high torque, stall ~4 A. Needs a proper motor driver (L298N, BTS7960…).',
    keywords: ['planetary', 'gear motor', '12v motor', 'high torque', 'jgb37'],
    shapes: [
      circle(10, -30, 22, '#e3e7eb', { grad: '#737c85', gradDir: 'd', shadow: 1, stroke: '#5f666e', strokeWidth: 0.6 }),
      circle(10, -30, 17, '#c5cbd2', { stroke: '#8a929b', strokeWidth: 0.6 }),
      ...[45, 135, 225, 315].map((a) => circle(10 + Math.cos((a * Math.PI) / 180) * 13.5, -30 + Math.sin((a * Math.PI) / 180) * 13.5, 1.7, '#3a3d42')),
      circle(10, -30, 7, '#eef1f4', { grad: '#8a929b', gradDir: 'r', stroke: '#6b737c', strokeWidth: 0.5 }),
    ],
    hub: [10, -30, 5],
    spin: dShaft(10, -30, 4, '#d5d9de'),
  }),
  gearMotor({
    type: 'coreless-motor', name: 'Coreless motor (8520)', r: 1.2, k: 0.00075, j: 5e-8, i0: 0.05, gear: 1, maxV: 4.2,
    description: '8.5 × 20 mm coreless motor as used in micro drones: 3.7 V, ~45 000 rpm, spins up in milliseconds. Drive it with a logic-level MOSFET + PWM.',
    keywords: ['coreless', '8520', 'drone motor', 'micro motor', 'quadcopter'],
    shapes: [rect(0, -42, 20, 34, '#eef1f4', { rx: 3, grad: '#808991', gradDir: 'h', shadow: 1 }), rect(0, -14, 20, 5, '#d9b45a', { rx: 1, grad: '#9c7b26', gradDir: 'h' }), rect(9, -47, 2, 6, '#c5cbd2')],
    hub: [10, -50, 12],
    spin: path('M -4 -50 Q 3 -54 10 -50 Q 17 -46 24 -50 Q 17 -48.4 10 -50 Q 3 -51.6 -4 -50 Z', '#34373c', { stroke: '#111', strokeWidth: 0.4 }),
  }),
  (() => {
    const m = motorModel('U', 'V', { r: 0.12, k: 0.00955, j: 3e-5, i0: 0.5 });
    return {
      type: 'bldc-motor', name: 'Brushless DC motor (A2212 1000KV)', category: 'output',
      description: 'Outrunner brushless motor (1000 rpm per volt, 7–12 V, up to ~12 A with a prop). Wire U/V/W to an ESC or BLDC controller. (Simplified: the controller’s 3-phase drive is modelled as its average voltage across U–V.)',
      keywords: ['bldc', 'brushless', 'a2212', 'outrunner', 'drone motor', 'esc', 'kv'],
      pins: pinRow(['U', 'V', 'W'], { kind: 'terminal', labels: { U: 'Phase U', V: 'Phase V', W: 'Phase W' } }),
      shapes: [
        line(0, 0, 0, -12, '#26282c', 2), line(10, 0, 10, -12, '#26282c', 2), line(20, 0, 20, -12, '#26282c', 2),
        circle(10, -36, 25, '#3a3d42', { grad: '#16171a', gradDir: 'd', shadow: 1 }),
        circle(10, -36, 21, '#e6eaee', { grad: '#7a838c', gradDir: 'd', stroke: '#5f666e', strokeWidth: 0.5 }),
        circle(10, -36, 15, '#d63c35', { grad: '#8f1f1a', gradDir: 'r' }),
        circle(10, -36, 5, '#eef1f4', { grad: '#8a929b', gradDir: 'r' }), circle(10, -36, 2, '#4a5058'),
      ],
      animations: [{ shape: { type: 'path', d: 'M 10 -49 L 10 -41 M 10 -31 L 10 -23 M -3 -36 L 5 -36 M 15 -36 L 23 -36 M 0.8 -45.2 L 6.5 -39.5 M 13.5 -32.5 L 19.2 -26.8 M 19.2 -45.2 L 13.5 -39.5 M 6.5 -32.5 L 0.8 -26.8', stroke: '#1d1e21', strokeWidth: 2.4, fill: 'none' }, rotate: 'angle * 3', cx: 10, cy: -36 }],
      readouts: [{ value: rpm(1), unit: 'rpm', x: 10, y: -65, size: 4.5 }],
      states: m.states,
      model: { nodes: m.nodes, elements: [...m.elements, { id: 'RW', kind: 'resistor', a: 'W', b: 'V', value: 1e6 }] },
      warnings: [{ when: 'abs(i(RA)) > 15', level: 'error', message: 'More than 15 A — the windings will burn.' }],
    };
  })(),
  (() => {
    const coils = pinRow(['A1', 'A2', 'B1', 'B2'], { labels: { A1: 'Coil A+ (black)', A2: 'Coil A− (green)', B1: 'Coil B+ (red)', B2: 'Coil B− (blue)' } });
    return {
      type: 'stepper-nema17', name: 'Stepper motor (NEMA 17, bipolar)', category: 'output',
      description: '200 steps/rev (1.8°) bipolar stepper with two coils (A1–A2, B1–B2). The shaft follows the magnetic field: energise the coils in sequence from an H-bridge (L298N) or a step/dir driver (A4988, DRV8825, TMC2208).',
      keywords: ['stepper', 'nema17', 'nema 17', 'nema23', 'bipolar', '17hs4401', 'cnc', '3d printer'],
      pins: coils,
      props: [{ key: 'r', label: 'Winding', type: 'select', default: 30, options: [{ value: 30, label: '12 V type (30 Ω, 0.4 A)' }, { value: 1.5, label: '17HS4401 (1.5 Ω, 1.7 A – needs a current-limiting driver)' }] }],
      shapes: [
        ...coils.map((p, i) => line(p.x, 0, p.x, -9, ['#26282c', '#1f9d55', '#d63c35', '#2f6fd6'][i], 1.8)),
        rect(5, -12, 20, 5, '#f4f2ec', { rx: 1, grad: '#cfccc2' }),
        path('M -7 -64 L 37 -64 L 42 -59 L 42 -15 L 37 -10 L -7 -10 L -12 -15 L -12 -59 Z', '#43474d', { grad: '#1c1d20', gradDir: 'd', shadow: 1, stroke: '#101113', strokeWidth: 0.6 }),
        ...[[-6, -58], [36, -58], [-6, -16], [36, -16]].map(([x, y]) => circle(x, y, 2.4, '#16171a', { stroke: '#6b737c', strokeWidth: 0.6 })),
        circle(15, -37, 13, '#e6eaee', { grad: '#7a838c', gradDir: 'd', stroke: '#5f666e', strokeWidth: 0.5 }),
        circle(15, -37, 9.5, '#2c2f33'),
        circle(15, -37, 3.2, '#eef1f4', { grad: '#8a929b', gradDir: 'r' }),
      ],
      animations: [{ shape: path('M 13.2 -40.6 L 16.8 -40.6 L 16.8 -33.4 L 13.2 -33.4 Z', '#b8bec6', { stroke: '#5f666e', strokeWidth: 0.4 }), rotate: 'deg', cx: 15, cy: -37 }],
      readouts: [{ value: 'steps', label: 'step', x: 15, y: -70, size: 4.5 }],
      states: STEPPER_STATE('i(CA)', 'i(CB)', 1.8),
      model: { elements: [{ id: 'CA', kind: 'rvar', a: 'A1', b: 'A2', value: 'r' }, { id: 'CB', kind: 'rvar', a: 'B1', b: 'B2', value: 'r' }] },
      warnings: [{ when: 'abs(i(CA)) > 2 || abs(i(CB)) > 2', level: 'error', message: 'Coil current above 2 A.' }],
    };
  })(),
  (() => {
    const pins = pinRow(['RED', 'ORG', 'YEL', 'PNK', 'BLU'], { labels: { RED: 'Red (+5 V common)', ORG: 'Orange', YEL: 'Yellow', PNK: 'Pink', BLU: 'Blue' } });
    return {
      type: 'stepper-28byj48', name: 'Stepper motor (28BYJ-48, 5 V)', category: 'output',
      description: 'Cheap geared unipolar stepper: 2048 steps per output revolution (full-step). Red is the common +5 V; pull the four coil wires LOW in sequence through a ULN2003 driver board. Works with the Arduino Stepper library (Stepper(2048, IN1, IN3, IN2, IN4)).',
      keywords: ['stepper', '28byj-48', '28byj', 'unipolar', 'uln2003', 'geared stepper'],
      pins,
      shapes: [
        ...pins.map((p, i) => line(p.x, 0, p.x, -12, ['#d63c35', '#f28c28', '#f2c230', '#f07aa8', '#2f6fd6'][i], 1.8)),
        // mounting ears, the steel can and the blue wire cover
        rect(-14, -38, 68, 9, '#dfe3e7', { rx: 4.5, grad: '#8a929b', shadow: 1 }), circle(-9, -33.5, 2.2, '#2c2e32'), circle(49, -33.5, 2.2, '#2c2e32'),
        circle(20, -34, 21, '#eef1f4', { grad: '#7d868f', gradDir: 'd', shadow: 1, stroke: '#6b737c', strokeWidth: 0.6 }),
        circle(20, -34, 16, 'none', { stroke: '#b3bac2', strokeWidth: 0.5 }),
        rect(4, -18, 32, 9, '#3b82e0', { rx: 2, grad: '#1f4f9f', shadow: 0.8 }),
        circle(20, -44, 6.5, '#e3c25e', { grad: '#9c7b26', gradDir: 'r' }),
        text(20, -27, '28BYJ-48', 3, '#5c636b', 'middle', { weight: 700 }),
      ],
      animations: [{ shape: rect(18.3, -49.5, 3.4, 11, '#c9a24a', { rx: 1, stroke: '#7a5e14', strokeWidth: 0.4 }), rotate: 'deg', cx: 20, cy: -44 }],
      readouts: [{ value: 'steps', label: 'step', x: 20, y: -64, size: 4.5 }],
      states: STEPPER_STATE('i(KB) - i(KY)', 'i(KP) - i(KO)', 360 / 2048),
      model: { elements: [['KB', 'BLU'], ['KP', 'PNK'], ['KY', 'YEL'], ['KO', 'ORG']].map(([id, pin]) => ({ id, kind: 'resistor', a: 'RED', b: pin, value: 50 })) },
    };
  })(),
  (() => {
    const b = moduleBoard(['IN1', 'IN2', 'IN3', 'IN4', 'GND', 'VCC'], { h: 84, w: 90, color: COL.pcbGreen, title: 'ULN2003', titleX: -8, titleY: -18, titleSize: 3, holes: 'corners', labels: { VCC: '+5–12 V (motor supply)', GND: 'GND' } });
    const out = pinRow(['MP', 'O4', 'O3', 'O2', 'O1'], { x0: 10, y: -70, labels: { MP: 'Motor + (red)', O1: 'OUT1 → blue', O2: 'OUT2 → pink', O3: 'OUT3 → yellow', O4: 'OUT4 → orange' } });
    const leds = [1, 2, 3, 4].map((n) => statusLed(-2 + n * 10, -22, '#ff3b30', `${'v(IN' + n + ', GND)'} > 2 ? 1 : 0`));
    return {
      type: 'uln2003', name: 'ULN2003 stepper driver board', category: 'drivers',
      description: 'Seven Darlington low-side switches (four used) with flyback diodes and indicator LEDs: IN n HIGH pulls OUT n to GND (~0.9 V drop, 500 mA). Plug a 28BYJ-48 into the output header; MP is the motor supply (= VCC).',
      keywords: ['uln2003', 'darlington', 'stepper driver', '28byj-48 driver', 'low side'],
      pins: [...b.pins, ...out],
      shapes: [
        ...b.shapes,
        // white JST-XH motor socket
        rect(4, -79, 52, 15, '#fbfaf5', { rx: 1, grad: '#d9d6cc', shadow: 1, stroke: '#bdb9ad', strokeWidth: 0.5 }),
        rect(6, -77, 48, 7, '#e9e6dc', { rx: 0.6 }), ...out.map((p) => rect(p.x - 1.2, -76, 2.4, 3, '#c9a24a')),
        // the ULN2003 Darlington array (DIP-16) and its supply cap
        ...chip(0, -56, 40, 11, { n: 8, label: 'ULN2003APG' }),
        ...smdRow(4, -36, 4, 10, false, 'rrrr'), ...ecap(56, -48, 5), ...jumper(60, -30, true),
        ...['A', 'B', 'C', 'D'].map((t, i) => silk(8 + i * 10, -30, t, 2.6)),
        ...leds.map((l) => l.shape),
      ],
      indicators: leds.map((l) => l.indicator),
      connections: [['VCC', 'MP']],
      model: {
        elements: [1, 2, 3, 4].flatMap((n) => [
          contact(`Q${n}`, `O${n}`, 'GND', `v(IN${n}, GND) > 2`, 8),
          { id: `F${n}`, kind: 'diode', a: `O${n}`, k: 'VCC', model: 'silicon' },
          { id: `RI${n}`, kind: 'resistor', a: `IN${n}`, b: 'GND', value: 2700 },
        ]),
      },
    };
  })(),
  {
    type: 'linear-actuator', name: 'Linear actuator (12 V, 100 mm)', category: 'output',
    description: 'Motor + lead screw that pushes a rod in and out (~10 mm/s at 12 V; reverse the polarity to retract). Built-in limit switches stop it at both ends.',
    keywords: ['linear actuator', 'actuator', 'push rod', 'lead screw', 'motorised'],
    pins: pinRow(['A', 'B'], { step: 20, labels: { A: 'Red (+ extends)', B: 'Black' } }),
    shapes: [
      ...leads(-8),
      rect(-18, -24, 10, 10, '#c5cbd2', { rx: 2, grad: '#6b737c' }), circle(-15, -19, 2, '#2c2e32'),
      rect(-10, -32, 40, 26, '#e6eaee', { rx: 4, grad: '#6f7881', shadow: 1, stroke: '#5f666e', strokeWidth: 0.5 }),
      rect(-6, -32, 3, 26, '#ffffff', { opacity: 0.25 }), rect(22, -30, 3, 22, '#3a3d42', { opacity: 0.4 }),
      rect(30, -27, 62, 16, '#eef1f4', { rx: 2, grad: '#7f8891', shadow: 1, stroke: '#6b737c', strokeWidth: 0.5 }),
      rect(31, -25, 60, 2, '#ffffff', { opacity: 0.45 }),
    ],
    animations: [{ shape: rect(40, -23, 56, 8, '#f4f6f8', { rx: 1.5, grad: '#9aa3ad', stroke: COL.metalDark, strokeWidth: 0.5 }), dx: 'p * 0.6' }],
    readouts: [{ value: 'p', unit: 'mm', x: 60, y: -34, size: 4.5 }],
    states: [{ name: 'p', init: 0, next: 'clamp(p + v(A, B) / 12 * 10 * dt, 0, 100)' }],
    model: { elements: [{ id: 'M', kind: 'rvar', a: 'A', b: 'B', value: '((p >= 100 && v(A, B) > 0) || (p <= 0 && v(A, B) < 0)) ? 1e6 : 12' }] },
  },
  {
    type: 'solenoid', name: 'Push-pull solenoid (12 V)', category: 'output',
    description: 'Electromagnet that yanks a steel plunger in while powered (12 V, ~0.5 A). It is an inductor: switch it with a transistor/MOSFET and put a flyback diode across it.',
    keywords: ['solenoid', 'plunger', 'electromagnet', 'door lock', 'actuator'],
    pins: pinRow(['1', '2'], { step: 20 }),
    shapes: [
      ...leads(-8),
      rect(-10, -42, 40, 34, '#dfe3e7', { rx: 1.5, grad: '#7f8891', gradDir: 'd', shadow: 1, stroke: '#5f666e', strokeWidth: 0.6 }),
      rect(-6, -37, 32, 24, '#e0a257', { rx: 2, grad: '#9a5a1e' }),
      ...Array.from({ length: 10 }, (_, i) => line(-4 + i * 3.1, -36, -4 + i * 3.1, -14, '#b8702e', 0.5)),
      rect(-6, -29, 32, 8, '#f2d24a', { opacity: 0.9, grad: '#c9a21c' }),
    ],
    animations: [{ shape: rect(24, -28, 32, 8, '#e3e7eb', { rx: 1.5, grad: '#7f8891', stroke: '#5f666e', strokeWidth: 0.5 }), dx: 'on == 1 ? -14 : 0' }],
    states: [{ name: 'on', init: 0, next: 'abs(i(R)) > 0.25 ? 1 : (abs(i(R)) < 0.1 ? 0 : on)' }],
    model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: '1', b: 'M', value: 24 }, { id: 'L', kind: 'inductor', a: 'M', b: '2', value: 0.03 }] },
    maxStep: 5e-4,
  },
  {
    type: 'speaker', name: 'Speaker (8 Ω)', category: 'output',
    description: '8 Ω 0.5 W speaker. Plays the tone reaching it; loud and power-hungry — drive it through a transistor or an amplifier, and use a series resistor/capacitor from a pin.',
    keywords: ['speaker', 'loudspeaker', '8 ohm', 'audio', 'sound'],
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+', N: '−' } }),
    shapes: [
      ...leads(-10),
      circle(10, -36, 26, '#3a3d42', { grad: '#141517', gradDir: 'd', shadow: 1 }),
      ...[45, 135, 225, 315].map((a) => circle(10 + Math.cos((a * Math.PI) / 180) * 23.5, -36 + Math.sin((a * Math.PI) / 180) * 23.5, 1.5, '#0c0d0f')),
      circle(10, -36, 21, '#2a2c30', { stroke: '#4a4d53', strokeWidth: 1.4 }),
      circle(10, -36, 18.5, '#55595f', { grad: '#1f2124', gradDir: 'r' }),
      ...[14, 10.5].map((r) => circle(10, -36, r, 'none', { stroke: '#3c3f44', strokeWidth: 0.5 })),
      circle(10, -36, 6.5, '#6a6e75', { grad: '#26282c', gradDir: 'r' }),
    ],
    sound: 'abs(i(R)) > 0.001 || freq(P) > 0 ? max(freq(P), freq(N)) : 0',
    model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 8 }] },
    warnings: [{ when: 'abs(i(R)) > 0.35', level: 'warn', message: 'Above the 0.5 W rating.' }],
  },
  (() => {
    const b = moduleBoard(['OUT', 'GND', 'VCC'], { h: 40, color: COL.pcbPurple, holes: 'none', labels: { OUT: 'Audio out (VCC/2 ± signal)', VCC: '+2.4–5.5 V' } });
    return {
      type: 'mic-module', name: 'Electret microphone amplifier (MAX4466)', category: 'output',
      description: 'Microphone + adjustable-gain amplifier: OUT is the audio waveform centred on VCC/2. Pick the test tone and loudness while simulating, then sample it with analogRead or look at it on the oscilloscope.',
      keywords: ['microphone', 'mic', 'electret', 'max4466', 'max9814', 'audio input', 'sound'],
      pins: b.pins,
      props: [
        { key: 'level', label: 'Loudness', type: 'slider', default: 0.3, min: 0, max: 1, step: 0.01 },
        { key: 'f', label: 'Sound', type: 'select', default: 220, options: [{ value: 100, label: '100 Hz hum' }, { value: 220, label: '220 Hz (A3)' }, { value: 440, label: '440 Hz (A4)' }] },
      ],
      drag: 'level',
      shapes: [...b.shapes, ...micCapsule(4, -26, 8), ...chip(17, -33, 8, 5, { n: 3, label: '4466' }), ...smdRow(17, -21, 2, 5, false, 'cr')],
      model: { elements: [{ id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VCC, GND) > 2.3 ? v(VCC, GND) / 2 * (1 + 0.95 * level * sin(6.28318 * f * t)) : 0', r: 200 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 20000 }] },
      maxStep: 1e-4,
    };
  })(),
];
