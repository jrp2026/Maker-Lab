import { COL, circle, contact, line, moduleBoard, motorModel, pinRow, rect, rpm, statusLed, type Raw } from './kit';

function gearMotor(o: { type: string; name: string; description: string; keywords: string[]; r: number; k: number; j: number; i0: number; gear: number; maxV: number; shapes: Raw[]; hub: [number, number, number] }): Raw {
  const m = motorModel('P', 'N', { r: o.r, k: o.k, j: o.j, i0: o.i0, gear: o.gear });
  const [cx, cy, rr] = o.hub;
  return {
    type: o.type, name: o.name, category: 'output', description: o.description, keywords: o.keywords,
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: 'Motor +', N: 'Motor −' } }),
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), ...o.shapes],
    animations: [{ shape: { type: 'path', d: `M${cx - rr} ${cy} L${cx + rr} ${cy} M${cx} ${cy - rr} L${cx} ${cy + rr}`, stroke: '#f2f4f6', strokeWidth: 1.6, fill: 'none' }, rotate: 'angle * 30', cx, cy }],
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
    shapes: [rect(-10, -40, 40, 32, '#f2c230', { rx: 3, stroke: '#b89020', strokeWidth: 0.8 }), rect(30, -30, 16, 12, '#f2c230', { rx: 2 }), circle(10, -24, 7, '#fff5cc')],
    hub: [10, -24, 6],
  }),
  gearMotor({
    type: 'n20-motor', name: 'N20 micro gear motor (1:100)', r: 15, k: 0.0018, j: 2e-7, i0: 0.04, gear: 100, maxV: 6,
    description: 'Tiny metal-gear motor (12 mm): ~300 rpm at 6 V with a 1:100 gearbox, stall ~0.4 A. For small robots and mechanisms.',
    keywords: ['n20', 'micro gear motor', 'metal gear', 'small motor'],
    shapes: [rect(-4, -34, 28, 22, COL.metal, { rx: 3, stroke: COL.metalDark, strokeWidth: 0.6 }), rect(-2, -44, 24, 10, '#c9a24a', { rx: 1 }), circle(10, -48, 4, COL.metal)],
    hub: [10, -48, 3.5],
  }),
  gearMotor({
    type: 'planetary-motor', name: 'Planetary gear motor (12 V, 1:30)', r: 3, k: 0.0115, j: 5e-6, i0: 0.2, gear: 30, maxV: 12,
    description: '37 mm 12 V motor with a planetary gearbox: ~330 rpm, high torque, stall ~4 A. Needs a proper motor driver (L298N, BTS7960…).',
    keywords: ['planetary', 'gear motor', '12v motor', 'high torque', 'jgb37'],
    shapes: [rect(-12, -52, 44, 44, '#5f666e', { rx: 4 }), circle(10, -30, 17, '#8a929b'), circle(10, -30, 11, COL.metal)],
    hub: [10, -30, 9],
  }),
  gearMotor({
    type: 'coreless-motor', name: 'Coreless motor (8520)', r: 1.2, k: 0.00075, j: 5e-8, i0: 0.05, gear: 1, maxV: 4.2,
    description: '8.5 × 20 mm coreless motor as used in micro drones: 3.7 V, ~45 000 rpm, spins up in milliseconds. Drive it with a logic-level MOSFET + PWM.',
    keywords: ['coreless', '8520', 'drone motor', 'micro motor', 'quadcopter'],
    shapes: [rect(0, -40, 20, 32, COL.metal, { rx: 3, stroke: COL.metalDark, strokeWidth: 0.6 }), circle(10, -44, 3, '#333')],
    hub: [10, -44, 12],
  }),
  (() => {
    const m = motorModel('U', 'V', { r: 0.12, k: 0.00955, j: 3e-5, i0: 0.5 });
    return {
      type: 'bldc-motor', name: 'Brushless DC motor (A2212 1000KV)', category: 'output',
      description: 'Outrunner brushless motor (1000 rpm per volt, 7–12 V, up to ~12 A with a prop). Wire U/V/W to an ESC or BLDC controller. (Simplified: the controller’s 3-phase drive is modelled as its average voltage across U–V.)',
      keywords: ['bldc', 'brushless', 'a2212', 'outrunner', 'drone motor', 'esc', 'kv'],
      pins: pinRow(['U', 'V', 'W'], { kind: 'terminal', labels: { U: 'Phase U', V: 'Phase V', W: 'Phase W' } }),
      shapes: [line(0, 0, 0, -10, '#222', 1.6), line(10, 0, 10, -10, '#222', 1.6), line(20, 0, 20, -10, '#222', 1.6), circle(10, -34, 24, '#2b2d31'), circle(10, -34, 20, '#c0392b'), circle(10, -34, 6, COL.metal)],
      animations: [{ shape: { type: 'path', d: 'M-6 -34 L26 -34 M10 -50 L10 -18', stroke: '#1d1e21', strokeWidth: 3, fill: 'none' }, rotate: 'angle * 3', cx: 10, cy: -34 }],
      readouts: [{ value: rpm(1), unit: 'rpm', x: 10, y: -62, size: 4.5 }],
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
      shapes: [...coils.map((p, i) => line(p.x, 0, p.x, -8, ['#222', '#1f9d55', '#d63c35', '#2f6fd6'][i], 1.6)), rect(-12, -64, 54, 56, '#3a3e44', { rx: 5 }), rect(-8, -60, 46, 48, '#2b2d31', { rx: 3 }), circle(15, -36, 10, COL.metal)],
      animations: [{ shape: { type: 'path', d: 'M15 -44 L15 -28', stroke: '#333', strokeWidth: 2.2, fill: 'none' }, rotate: 'deg', cx: 15, cy: -36 }],
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
      shapes: [...pins.map((p, i) => line(p.x, 0, p.x, -8, ['#d63c35', '#f28c28', '#f2c230', '#f07aa8', '#2f6fd6'][i], 1.6)), circle(20, -34, 24, COL.metal, { stroke: COL.metalDark, strokeWidth: 0.8 }), rect(-8, -16, 56, 10, '#2f6fd6', { rx: 2 }), circle(20, -44, 5, '#f2c230')],
      animations: [{ shape: rect(18.5, -50, 3, 12, '#b8901f', { rx: 1 }), rotate: 'deg', cx: 20, cy: -44 }],
      readouts: [{ value: 'steps', label: 'step', x: 20, y: -64, size: 4.5 }],
      states: STEPPER_STATE('i(KB) - i(KY)', 'i(KP) - i(KO)', 360 / 2048),
      model: { elements: [['KB', 'BLU'], ['KP', 'PNK'], ['KY', 'YEL'], ['KO', 'ORG']].map(([id, pin]) => ({ id, kind: 'resistor', a: 'RED', b: pin, value: 50 })) },
    };
  })(),
  (() => {
    const b = moduleBoard(['IN1', 'IN2', 'IN3', 'IN4', 'GND', 'VCC'], { h: 50, w: 90, color: COL.pcbGreen, title: 'ULN2003', labels: { VCC: '+5–12 V (motor supply)', GND: 'GND' } });
    const out = pinRow(['MP', 'O4', 'O3', 'O2', 'O1'], { x0: 5, y: -70, labels: { MP: 'Motor + (red)', O1: 'OUT1 → blue', O2: 'OUT2 → pink', O3: 'OUT3 → yellow', O4: 'OUT4 → orange' } });
    const leds = [1, 2, 3, 4].map((n) => statusLed(-2 + n * 10, -24, '#ff3b30', `${'v(IN' + n + ', GND)'} > 2 ? 1 : 0`));
    return {
      type: 'uln2003', name: 'ULN2003 stepper driver board', category: 'drivers',
      description: 'Seven Darlington low-side switches (four used) with flyback diodes and indicator LEDs: IN n HIGH pulls OUT n to GND (~0.9 V drop, 500 mA). Plug a 28BYJ-48 into the output header; MP is the motor supply (= VCC).',
      keywords: ['uln2003', 'darlington', 'stepper driver', '28byj-48 driver', 'low side'],
      pins: [...b.pins, ...out],
      shapes: [...b.shapes, rect(-2, -80, 50, 14, '#f4f2ec', { rx: 1.5 }), rect(20, -46, 22, 12, COL.ic, { rx: 1 }), ...leds.map((l) => l.shape)],
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
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), rect(-10, -30, 40, 22, '#5f666e', { rx: 3 }), rect(30, -26, 60, 14, '#8a929b', { rx: 2 })],
    animations: [{ shape: rect(40, -23, 56, 8, COL.metal, { rx: 1.5, stroke: COL.metalDark, strokeWidth: 0.6 }), dx: 'p * 0.6' }],
    readouts: [{ value: 'p', unit: 'mm', x: 60, y: -34, size: 4.5 }],
    states: [{ name: 'p', init: 0, next: 'clamp(p + v(A, B) / 12 * 10 * dt, 0, 100)' }],
    model: { elements: [{ id: 'M', kind: 'rvar', a: 'A', b: 'B', value: '((p >= 100 && v(A, B) > 0) || (p <= 0 && v(A, B) < 0)) ? 1e6 : 12' }] },
  },
  {
    type: 'solenoid', name: 'Push-pull solenoid (12 V)', category: 'output',
    description: 'Electromagnet that yanks a steel plunger in while powered (12 V, ~0.5 A). It is an inductor: switch it with a transistor/MOSFET and put a flyback diode across it.',
    keywords: ['solenoid', 'plunger', 'electromagnet', 'door lock', 'actuator'],
    pins: pinRow(['1', '2'], { step: 20 }),
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), rect(-10, -40, 40, 32, '#b8bec6', { rx: 2, stroke: COL.metalDark, strokeWidth: 0.8 }), rect(-6, -34, 32, 20, COL.copper, { rx: 1 })],
    animations: [{ shape: rect(26, -28, 30, 8, '#5f666e', { rx: 1.5 }), dx: 'on == 1 ? -14 : 0' }],
    states: [{ name: 'on', init: 0, next: 'abs(i(R)) > 0.25 ? 1 : (abs(i(R)) < 0.1 ? 0 : on)' }],
    model: { nodes: ['M'], elements: [{ id: 'R', kind: 'resistor', a: '1', b: 'M', value: 24 }, { id: 'L', kind: 'inductor', a: 'M', b: '2', value: 0.03 }] },
    maxStep: 5e-4,
  },
  {
    type: 'speaker', name: 'Speaker (8 Ω)', category: 'output',
    description: '8 Ω 0.5 W speaker. Plays the tone reaching it; loud and power-hungry — drive it through a transistor or an amplifier, and use a series resistor/capacitor from a pin.',
    keywords: ['speaker', 'loudspeaker', '8 ohm', 'audio', 'sound'],
    pins: pinRow(['P', 'N'], { step: 20, labels: { P: '+', N: '−' } }),
    shapes: [line(0, 0, 0, -8, '#d63c35', 1.6), line(20, 0, 20, -8, '#222', 1.6), circle(10, -34, 26, '#2b2d31'), circle(10, -34, 20, '#3c4047'), circle(10, -34, 7, '#555a61')],
    sound: 'abs(i(R)) > 0.001 || freq(P) > 0 ? max(freq(P), freq(N)) : 0',
    model: { elements: [{ id: 'R', kind: 'resistor', a: 'P', b: 'N', value: 8 }] },
    warnings: [{ when: 'abs(i(R)) > 0.35', level: 'warn', message: 'Above the 0.5 W rating.' }],
  },
  (() => {
    const b = moduleBoard(['OUT', 'GND', 'VCC'], { h: 36, color: COL.pcbPurple, title: 'MAX4466', labels: { OUT: 'Audio out (VCC/2 ± signal)', VCC: '+2.4–5.5 V' } });
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
      shapes: [...b.shapes, circle(10, -30, 9, '#2b2d31', { stroke: '#8a9098', strokeWidth: 1 }), circle(10, -30, 5, '#555a61')],
      model: { elements: [{ id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VCC, GND) > 2.3 ? v(VCC, GND) / 2 * (1 + 0.95 * level * sin(6.28318 * f * t)) : 0', r: 200 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 20000 }] },
      maxStep: 1e-4,
    };
  })(),
];
