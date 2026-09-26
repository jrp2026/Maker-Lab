import { COL, chip, circle, contact, dout, fresnelDome, ldrFace, ledSide, legs, line, meshCan, micCapsule, moduleBoard, path, pinRow, rect, screwTerminals, silk, smd, smdRow, statusLed, to92, trimpot, type Raw } from './kit';

const pwrLed = (x: number, y: number) => statusLed(x, y, '#ff3b30', 'v(VCC, GND) > 2.5 ? 1 : 0');

/** Sensor module with an LM393 comparator: DO goes `activeHigh` when AO crosses the threshold pot. */
export function comparatorModule(o: {
  type: string; name: string; description: string; keywords: string[]; title: string;
  ao: string; /** AO voltage formula */ trip: string; /** DO active condition */ doActiveLow: boolean;
  props: Raw[]; extraShapes?: Raw[]; states?: Raw[]; interactive?: 'press'; drag?: string; maxStep?: number; readouts?: Raw[]; pins?: string[]; h?: number;
}): Raw {
  const ids = o.pins ?? ['VCC', 'GND', 'DO', 'AO'];
  const h = o.h ?? 46;
  const b = moduleBoard(ids, { h, color: COL.pcbBlue, title: o.title, titleY: -14.5, titleSize: 3, labels: { VCC: '+3.3–5 V', DO: 'Digital out (threshold pot)', AO: 'Analog out' } });
  const p = pwrLed(b.box.x + 7, -15.5), d = statusLed(b.box.x + b.box.w - 7, -15.5, '#35d05a', o.doActiveLow ? `(${o.trip}) ? 1 : 0` : `(${o.trip}) ? 1 : 0`);
  return {
    type: o.type, name: o.name, category: 'sensors', description: o.description, keywords: o.keywords,
    pins: b.pins, props: o.props, interactive: o.interactive, drag: o.drag, states: o.states, maxStep: o.maxStep, readouts: o.readouts,
    shapes: [
      ...b.shapes,
      // blue multi-turn threshold pot, LM393 comparator and its resistors
      ...trimpot(b.box.x + 10, -24, 10),
      ...chip(b.box.x + b.box.w - 21, -29, 13, 8, { n: 4, label: 'LM393' }),
      ...smdRow(b.box.x + b.box.w - 20, -18.5, 3, 5),
      ...(o.extraShapes ?? []),
      p.shape, d.shape,
    ],
    indicators: [p.indicator, d.indicator],
    model: {
      elements: [
        ...(ids.includes('AO') ? [{ id: 'AOUT', kind: 'vsource', p: 'AO', n: 'GND', value: `v(VCC, GND) > 2.5 ? clamp(${o.ao}, 0, v(VCC, GND)) : 0`, r: 1000 }] : []),
        dout('DOUT', ids.includes('DO') ? 'DO' : 'OUT', `v(VCC, GND) > 2.5 && (${o.doActiveLow ? `!(${o.trip})` : o.trip})`, 'VCC', 'GND', 100),
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1200 },
      ],
    },
  };
}

export const SENSORS: Raw[] = [
  (() => {
    const pk = to92(['VS', 'VOUT', 'GND'], 'TMP36', COL.ic, { VS: '+Vs (2.7–5.5 V)', VOUT: 'Vout', GND: 'GND' });
    return {
      type: 'tmp36', name: 'Temperature sensor (TMP36 / LM35)', category: 'sensors',
      description: 'Analog temperature sensor. TMP36: Vout = 0.5 V + 10 mV/°C (750 mV at 25 °C, works below 0 °C). LM35: 10 mV/°C from 0 °C. Set the temperature in the inspector while simulating.',
      keywords: ['temperature', 'tmp36', 'lm35', 'thermometer', 'analog temperature'],
      ...pk,
      props: [
        { key: 'temp', label: 'Temperature', type: 'slider', default: 25, min: -40, max: 125, step: 0.5, unit: '°C' },
        { key: 'chip', label: 'Chip', type: 'select', default: 0, options: [{ value: 0, label: 'TMP36' }, { value: 1, label: 'LM35' }] },
      ],
      summary: 'Vout = 0.5 V + 10 mV/°C (TMP36)',
      drag: 'temp',
      readouts: [{ value: 'temp', unit: '°C', x: 10, y: -24, size: 4.2 }],
      model: {
        elements: [
          { id: 'OUT', kind: 'vsource', p: 'VOUT', n: 'GND', value: 'v(VS, GND) > 2.6 ? (chip == 1 ? max(0, 0.01 * temp) : max(0.1, 0.5 + 0.01 * temp)) : 0', r: 100 },
          { id: 'IQ', kind: 'resistor', a: 'VS', b: 'GND', value: 100000 },
        ],
      },
    };
  })(),
  comparatorModule({
    type: 'ldr-module', name: 'Light sensor module (LDR)', title: 'LDR',
    description: 'Photoresistor + 10 kΩ divider + LM393 comparator. AO rises as it gets darker; DO goes LOW when it is brighter than the threshold pot (the DO LED lights). Change the light level while simulating.',
    keywords: ['light sensor', 'ldr module', 'photoresistor module', 'lm393', 'brightness', 'day night'],
    props: [
      { key: 'lux', label: 'Light', type: 'slider', default: 300, min: 0, max: 2000, step: 1, unit: 'lx' },
      { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.5, min: 0.05, max: 0.95, step: 0.01 },
    ],
    drag: 'lux',
    ao: 'v(VCC, GND) * (50000 * pow(max(lux, 0.5) / 10, -0.7)) / (50000 * pow(max(lux, 0.5) / 10, -0.7) + 10000)',
    trip: 'v(AO, GND) < thr * v(VCC, GND)',
    doActiveLow: true,
    extraShapes: [line(12, -41, 12, -48, COL.lead, 0.9), line(18, -41, 18, -48, COL.lead, 0.9), ...ldrFace(15, -48, 5.5)],
  }),
  comparatorModule({
    type: 'ir-obstacle', name: 'IR proximity / obstacle sensor', title: 'FC-51',
    description: 'Infrared LED + photodiode that sees reflections: OUT goes LOW when an object is closer than the range set by the pot (2–30 cm). Set the object distance while simulating.',
    keywords: ['proximity', 'ir sensor', 'obstacle', 'fc-51', 'infrared', 'line follower', 'tcrt5000'],
    pins: ['OUT', 'GND', 'VCC'],
    props: [
      { key: 'dist', label: 'Object distance', type: 'slider', default: 40, min: 1, max: 60, step: 1, unit: 'cm' },
      { key: 'range', label: 'Range pot', type: 'slider', default: 10, min: 2, max: 30, step: 1, unit: 'cm' },
    ],
    drag: 'dist',
    ao: '0',
    trip: 'dist < range',
    doActiveLow: true,
    extraShapes: [...ledSide(-2, -58, '#cfe0f5', 12), ...ledSide(22, -58, '#2a2c30', 12), silk(10, -41, 'IR', 2.6)],
  }),
  (() => {
    const b = moduleBoard(['VCC', 'OUT', 'GND'], { h: 50, w: 44, color: COL.pcbGreen, holes: 'none', labels: { VCC: '+5–20 V', OUT: 'OUT (3.3 V while motion)' } });
    return {
      type: 'pir', name: 'PIR motion sensor (HC-SR501)', category: 'sensors',
      description: 'Passive-infrared motion detector: OUT goes HIGH (3.3 V) when something warm moves and stays high for the hold time. Hold the dome (press while simulating) to wave a hand in front of it. Needs 5 V+.',
      keywords: ['pir', 'motion', 'hc-sr501', 'presence', 'occupancy', 'movement'],
      pins: b.pins,
      props: [{ key: 'hold', label: 'Hold time', type: 'slider', default: 3, min: 0.3, max: 20, step: 0.1, unit: 's' }],
      interactive: 'press',
      shapes: [...b.shapes, ...fresnelDome(10, -32, 18.5)],
      states: [{ name: 'tm', init: -100, next: 'pressed == 1 ? t : tm' }],
      indicators: [{ shape: circle(10, -32, 18.5, '#ff9a3c'), color: '#ff9a3c', level: '(t - tm < hold) ? 0.3 : 0' }],
      model: {
        elements: [
          { id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: '(v(VCC, GND) > 4.5 && t - tm < hold) ? 3.3 : 0', r: 200 },
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 50000 },
        ],
      },
    };
  })(),
  (() => {
    const pk = to92(['VCC', 'GND', 'OUT'], 'A3144', COL.ic, { VCC: '+4.5–24 V', OUT: 'OUT (open collector, pull-up needed)' });
    return {
      type: 'hall-a3144', name: 'Hall-effect sensor (A3144)', category: 'sensors',
      description: 'Digital Hall switch: OUT pulls LOW when a magnet’s south pole is near (> ~18 mT), releases below ~12 mT. Open collector — use a 10 kΩ pull-up (or INPUT_PULLUP). Press the sensor to bring a magnet close, or set the field.',
      keywords: ['hall', 'a3144', 'magnet', 'magnetic switch', 'rpm sensor', 'hall effect'],
      ...pk,
      props: [{ key: 'field', label: 'Magnetic field', type: 'slider', default: 0, min: -50, max: 50, step: 1, unit: 'mT' }],
      interactive: 'press',
      shapes: [...pk.shapes, rect(28, -28, 8, 18, '#e0453d', { rx: 1, grad: '#9e2721', gradDir: 'h', shadow: 0.8 }), rect(28, -19, 8, 9, '#3b7de0', { rx: 1, grad: '#1f4f9f', gradDir: 'h' }), silk(32, -22, 'S', 3.4), silk(32, -12.5, 'N', 3.4)],
      states: [{ name: 'on', init: 0, next: '(pressed == 1 ? 40 : field) > 18 ? 1 : ((pressed == 1 ? 40 : field) < 12 ? 0 : on)' }],
      model: { elements: [contact('Q', 'OUT', 'GND', 'on == 1 && v(VCC, GND) > 3.5', 25), { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1500 }, { id: 'LK', kind: 'resistor', a: 'OUT', b: 'GND', value: 1e8 }] },
    };
  })(),
  (() => {
    const b = moduleBoard(['VCC', 'X', 'Y', 'Z', 'GND'], { h: 46, color: COL.pcbPurple, title: 'GY-61', titleY: -40, titleX: 5, titleSize: 3.6, labels: { VCC: '+3.3 V (1.8–3.6 V)', X: 'X out', Y: 'Y out', Z: 'Z out' } });
    const out = (axis: string) => ({ id: `O${axis}`, kind: 'vsource', p: axis, n: 'GND', value: `v(VCC, GND) > 1.8 ? v(VCC, GND) / 2 + 0.1 * v(VCC, GND) * clamp(a${axis.toLowerCase()}, -3.6, 3.6) : 0`, r: 32000 });
    return {
      type: 'adxl335', name: 'Accelerometer (ADXL335)', category: 'sensors',
      description: '3-axis ±3 g analog accelerometer: each output sits at VCC/2 for 0 g and moves ~330 mV per g (at 3.3 V, ratiometric). Lying flat: X = Y = 0 g, Z = +1 g. Set the acceleration of each axis while simulating.',
      keywords: ['accelerometer', 'adxl335', 'gy-61', 'tilt', 'g-force', 'motion', 'imu'],
      pins: b.pins,
      props: [
        { key: 'ax', label: 'X', type: 'slider', default: 0, min: -3, max: 3, step: 0.05, unit: 'g' },
        { key: 'ay', label: 'Y', type: 'slider', default: 0, min: -3, max: 3, step: 0.05, unit: 'g' },
        { key: 'az', label: 'Z', type: 'slider', default: 1, min: -3, max: 3, step: 0.05, unit: 'g' },
      ],
      shapes: [
        ...b.shapes,
        ...chip(13, -35, 12, 12, { legs: 'qfn', label: 'ADXL', sub: '335' }),
        ...smdRow(0, -22, 3, 5, false, 'ccc'), ...smd(34, -30, 'c', true), ...smd(34, -38, 'r', true),
        line(-4, -26, 6, -26, COL.silk, 0.6), path('M 6 -27.5 L 9 -26 L 6 -24.5 Z', COL.silk), silk(8, -28.5, 'X', 2.6),
        line(-4, -26, -4, -36, COL.silk, 0.6), path('M -5.5 -36 L -4 -39 L -2.5 -36 Z', COL.silk), silk(-1.5, -37, 'Y', 2.6),
      ],
      warnings: [{ when: 'v(VCC, GND) > 3.7', level: 'error', message: 'The ADXL335 is a 3.3 V part (max 3.6 V).' }],
      model: { elements: [out('X'), out('Y'), out('Z'), { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 10000 }] },
    };
  })(),
  comparatorModule({
    type: 'mq2', name: 'Gas / smoke sensor (MQ-2)', title: 'MQ-2',
    description: 'Tin-oxide gas sensor for LPG, propane, methane and smoke. The heater draws ~150 mA (use 5 V, not a pin!). AO rises with gas concentration; DO goes LOW above the threshold pot. Set the concentration while simulating.',
    keywords: ['gas', 'smoke', 'mq-2', 'mq2', 'mq-135', 'air quality', 'lpg', 'methane'],
    props: [
      { key: 'ppm', label: 'Gas concentration', type: 'slider', default: 100, min: 0, max: 10000, step: 10, unit: 'ppm' },
      { key: 'thr', label: 'Threshold pot', type: 'slider', default: 1.5, min: 0.2, max: 4.5, step: 0.05, unit: 'V' },
    ],
    drag: 'ppm',
    ao: 'v(VCC, GND) * 5000 / (5000 + 20000 * pow(max(ppm, 50) / 1000, -0.47))',
    trip: 'v(AO, GND) > thr',
    doActiveLow: true,
    h: 70,
    extraShapes: [...meshCan(15, -56, 12)],
  }),
  comparatorModule({
    type: 'sound-sensor', name: 'Sound sensor (KY-038)', title: 'KY-038',
    description: 'Electret microphone + comparator. AO is the (amplified) sound waveform around VCC/2; DO goes HIGH whenever the sound peaks above the threshold pot — great for clap switches. Set the loudness while simulating.',
    keywords: ['sound', 'microphone', 'ky-038', 'clap', 'noise', 'audio sensor'],
    props: [
      { key: 'db', label: 'Loudness', type: 'slider', default: 40, min: 30, max: 110, step: 1, unit: 'dB' },
      { key: 'thr', label: 'Threshold pot', type: 'slider', default: 0.3, min: 0.02, max: 2.5, step: 0.01, unit: 'V' },
    ],
    drag: 'db',
    ao: 'v(VCC, GND) / 2 + min(v(VCC, GND) / 2, 0.02 * pow(10, (db - 60) / 20)) * sin(6.28318 * 220 * t)',
    trip: 'v(AO, GND) - v(VCC, GND) / 2 > thr',
    doActiveLow: false,
    maxStep: 2e-4,
    extraShapes: [...micCapsule(15, -43, 6.5)],
  }),
  (() => {
    const b = moduleBoard(['VCC', 'GND', 'DO'], { h: 40, color: COL.pcbBlue, title: 'SW-420', titleY: -14, titleSize: 3, labels: { VCC: '+3.3–5 V', DO: 'DO (HIGH while shaking)' } });
    const p = pwrLed(b.box.x + 5, -17), d = statusLed(b.box.x + b.box.w - 5, -17, '#35d05a', 'pressed');
    return {
      type: 'vibration-sensor', name: 'Vibration sensor (SW-420)', category: 'sensors',
      description: 'Spring vibration switch + comparator: DO is LOW when still and goes HIGH while the module is shaken or knocked. Press it while simulating to shake it.',
      keywords: ['vibration', 'shock', 'knock', 'sw-420', 'tamper', 'earthquake'],
      pins: b.pins, interactive: 'press',
      shapes: [
        ...b.shapes,
        rect(-4, -40, 18, 8, '#eef1f4', { rx: 4, grad: '#7f8891', shadow: 0.9 }), rect(-6, -37, 2.5, 2, COL.lead), rect(13.5, -37, 2.5, 2, COL.lead),
        ...trimpot(24, -34, 9), ...chip(-2, -27, 12, 7, { n: 4, label: 'LM393' }), ...smdRow(14, -24, 3, 4.5),
        p.shape, d.shape,
      ],
      indicators: [p.indicator, d.indicator],
      model: { elements: [dout('DOUT', 'DO', 'pressed == 1 && v(VCC, GND) > 2.5', 'VCC', 'GND', 100), { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 2000 }] },
    };
  })(),
  {
    type: 'tilt-switch', name: 'Tilt switch (SW-520D)', category: 'sensors',
    description: 'A metal ball in a can: the two leads are connected while it stands upright and open when tilted past ~45°. Click it while simulating to tip it over.',
    keywords: ['tilt', 'ball switch', 'sw-520d', 'orientation', 'tip over'],
    pins: pinRow(['1', '2']),
    props: [{ key: 'tilted', label: 'Tilted', type: 'select', default: 0, options: [{ value: 0, label: 'Upright (closed)' }, { value: 1, label: 'Tilted (open)' }] }],
    toggle: 'tilted',
    shapes: [...legs(pinRow(['1', '2']), -6)],
    animations: [{ shape: rect(-2, -27, 14, 21, '#eef1f4', { rx: 2, grad: '#7f8891', gradDir: 'h', stroke: '#6b737c', strokeWidth: 0.5, shadow: 0.8 }), rotate: 'tilted == 1 ? 50 : 0', cx: 5, cy: -6 }],
    model: { elements: [contact('S', '1', '2', 'tilted == 0', 0.5)] },
  },
  {
    type: 'reed-switch', name: 'Reed switch', category: 'sensors',
    description: 'Two iron reeds in a glass tube that close when a magnet is brought near (door/window sensors, bike speedometers). Click it while simulating to move the magnet.',
    keywords: ['reed', 'magnet', 'door sensor', 'magnetic switch', 'window'],
    pins: pinRow(['1', '2'], { step: 40 }),
    props: [{ key: 'magnet', label: 'Magnet', type: 'select', default: 0, options: [{ value: 0, label: 'Away (open)' }, { value: 1, label: 'Near (closed)' }] }],
    toggle: 'magnet',
    shapes: [line(0, 0, 40, 0, COL.lead, 1.4), rect(6, -4.5, 28, 9, '#f2fbfd', { rx: 4.5, grad: '#b9d6de', stroke: '#8fb0ba', strokeWidth: 0.5, opacity: 0.85, shadow: 0.5 }), line(8, 0, 22, 0.4, '#8a7a55', 1.1), line(18, 1.2, 32, 1.2, '#8a7a55', 1.1), rect(9, -3, 22, 1, '#ffffff', { opacity: 0.6, rx: 0.5 })],
    animations: [{ shape: rect(8, -18, 24, 7, '#e0453d', { rx: 1, grad: '#2f6fd6', gradDir: 'h', shadow: 0.8 }), dy: 'magnet == 1 ? 4 : -8' }],
    model: { elements: [contact('S', '1', '2', 'magnet == 1', 0.1)] },
  },
  (() => {
    const b = moduleBoard(['VCC', 'OUT', 'GND'], { h: 70, w: 50, color: COL.pcbRed, title: 'ACS712', titleY: -24, titleSize: 3.6, holes: 'none', labels: { VCC: '+5 V', OUT: 'OUT (VCC/2 at 0 A)' } });
    const ip = pinRow(['IP1', 'IP2'], { x0: 0, y: -70, kind: 'terminal', labels: { IP1: 'IP+ (current in)', IP2: 'IP− (current out)' } });
    return {
      type: 'acs712', name: 'Current sensor (ACS712)', category: 'sensors',
      description: 'Hall-effect current sensor: put it in series with the load (IP+ → IP−, 1.2 mΩ, isolated from the logic side). OUT = VCC/2 + sensitivity × current: 185 mV/A (5 A), 100 mV/A (20 A) or 66 mV/A (30 A).',
      keywords: ['current sensor', 'acs712', 'ammeter', 'hall', 'power monitor'],
      pins: [...b.pins, ...ip],
      props: [{ key: 'sens', label: 'Version', type: 'select', default: 0.185, options: [{ value: 0.185, label: '5 A (185 mV/A)' }, { value: 0.1, label: '20 A (100 mV/A)' }, { value: 0.066, label: '30 A (66 mV/A)' }] }],
      shapes: [
        ...b.shapes, ...screwTerminals(ip),
        // thick current path to the SOIC-8 Hall chip
        rect(-2, -60, 4, 12, '#d8a24a', { rx: 1, opacity: 0.8 }), rect(8, -60, 4, 12, '#d8a24a', { rx: 1, opacity: 0.8 }),
        ...chip(-4, -49, 18, 10, { n: 4, label: 'ACS712', sub: 'ELCTR-05B' }),
        ...smdRow(-5, -33, 3, 5), ...smd(23, -45, 'c', true), ...smd(23, -37, 'r', true),
      ],
      readouts: [{ value: 'i(RS)', unit: 'A', x: 10, y: -16, size: 3.6, color: '#fff' }],
      model: {
        elements: [
          { id: 'RS', kind: 'resistor', a: 'IP1', b: 'IP2', value: 0.0012 },
          { id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VCC, GND) > 4 ? clamp(v(VCC, GND) / 2 + sens * i(RS) * v(VCC, GND) / 5, 0, v(VCC, GND)) : 0', r: 100 },
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 500 },
          { id: 'ISO', kind: 'resistor', a: 'IP2', b: 'GND', value: 1e9 },
        ],
      },
      warnings: [{ when: 'abs(i(RS)) > 0.185 * 30 / sens', level: 'error', message: 'Current above the sensor’s range.' }],
    };
  })(),
  (() => {
    const inp = pinRow(['VIN', 'GNDIN'], { y: -60, kind: 'terminal', labels: { VIN: 'Measured + (0–25 V)', GNDIN: 'Measured −' } });
    const b = moduleBoard(['S', 'PLUS', 'MINUS'], { h: 64, color: COL.pcbRed, holes: 'none', labels: { S: 'S (VIN / 5)', PLUS: '+ (not connected)', MINUS: '− (GND)' } });
    return {
      type: 'voltage-sensor', name: 'Voltage sensor module (0–25 V)', category: 'sensors',
      description: 'A 30 kΩ / 7.5 kΩ divider: S = VIN ÷ 5, so a 5 V Arduino can measure up to 25 V (analogRead × 25 / 1023). The measured − and the module − are the same ground.',
      keywords: ['voltage sensor', 'divider', 'battery monitor', 'voltmeter', 'measure voltage'],
      pins: [...b.pins, ...inp],
      shapes: [
        ...b.shapes, ...screwTerminals(inp),
        silk(-3, -50, 'VCC', 2.4), silk(13, -50, 'GND', 2.4),
        ...chip(-4, -42, 9, 4.5, { legs: 'none', label: '303' }), ...chip(11, -42, 9, 4.5, { legs: 'none', label: '752' }),
        silk(10, -26, 'DC 0–25V', 3), silk(10, -19.5, 'S  +  −', 3.2),
      ],
      connections: [['GNDIN', 'MINUS']],
      model: {
        elements: [
          { id: 'R1', kind: 'resistor', a: 'VIN', b: 'S', value: 30000 },
          { id: 'R2', kind: 'resistor', a: 'S', b: 'MINUS', value: 7500 },
          { id: 'NC', kind: 'resistor', a: 'PLUS', b: 'MINUS', value: 1e9 },
        ],
      },
    };
  })(),
  (() => {
    const b = moduleBoard(['GND', 'VCC', 'SW', 'DT', 'CLK'], { h: 46, color: COL.pcbBlue, title: 'KY-040', titleY: -15, titleX: 27, titleSize: 3, labels: { VCC: '+ (3.3–5 V)', SW: 'Push switch (LOW when pressed)', DT: 'DT (B)', CLK: 'CLK (A)' } });
    const q = 'mod(ph, 4)';
    return {
      type: 'rotary-encoder', name: 'Rotary encoder (KY-040)', category: 'sensors',
      description: 'Incremental encoder with detents and a push switch. Each click turns CLK and DT through one quadrature cycle (both HIGH at rest); read the direction from DT on each CLK edge. Drag the knob (or set the position) while simulating; press to push the shaft.',
      keywords: ['rotary encoder', 'ky-040', 'ec11', 'knob', 'quadrature', 'incremental', 'dial'],
      pins: b.pins,
      props: [{ key: 'pos', label: 'Position (clicks)', type: 'slider', default: 0, min: -40, max: 40, step: 1 }],
      drag: 'pos',
      interactive: 'press',
      shapes: [
        ...b.shapes,
        rect(7, -46, 26, 26, '#e7eaee', { rx: 1.5, grad: '#8c949d', gradDir: 'd', shadow: 1, stroke: '#6d757e', strokeWidth: 0.5 }),
        rect(9.5, -43.5, 21, 21, '#2b2d31', { rx: 1, grad: '#141517' }),
        circle(20, -33, 8.6, '#d5d9de', { grad: '#7e878f', gradDir: 'r', stroke: '#5c636b', strokeWidth: 0.5 }),
        ...Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 6.28318;
          return line(20 + Math.cos(a) * 6.6, -33 + Math.sin(a) * 6.6, 20 + Math.cos(a) * 8.4, -33 + Math.sin(a) * 8.4, '#6b737b', 0.45);
        }),
        ...smdRow(-6, -18, 3, 5, false, 'rrr'),
      ],
      animations: [{ shape: rect(19, -40.5, 2, 7.5, '#5c636b', { rx: 0.8 }), rotate: 'ph * 4.5', cx: 20, cy: -33 }],
      states: [
        { name: 'ph0', init: 0, next: 'ph' },
        { name: 'ph', init: 0, next: '(t - tl > 0.002 && ph != 4 * round(pos)) ? ph + sign(4 * round(pos) - ph) : ph' },
        { name: 'tl', init: 0, next: 'ph != ph0 ? t : tl' },
      ],
      model: {
        elements: [
          { id: 'PA', kind: 'resistor', a: 'VCC', b: 'CLK', value: 10000 },
          { id: 'PB', kind: 'resistor', a: 'VCC', b: 'DT', value: 10000 },
          { id: 'PS', kind: 'resistor', a: 'VCC', b: 'SW', value: 10000 },
          contact('A', 'CLK', 'GND', `!(${q} == 0 || ${q} == 3)`, 50),
          contact('B', 'DT', 'GND', `!(${q} <= 1)`, 50),
          contact('S', 'SW', 'GND', 'pressed == 1', 50),
        ],
      },
    };
  })(),
  (() => {
    const b = moduleBoard(['VCC', 'GND', 'A', 'B'], { h: 60, color: COL.pcbBlack, title: '', labels: { VCC: '+5 V', A: 'Channel A', B: 'Channel B (90° behind A)' } });
    return {
      type: 'quadrature-encoder', name: 'Quadrature encoder (optical)', category: 'sensors',
      description: 'Optical shaft encoder with two channels 90° apart (push-pull outputs). Count edges for position; the order of A and B gives the direction. Set the shaft speed (negative = reverse) while simulating.',
      keywords: ['quadrature', 'encoder', 'optical encoder', 'incremental', 'ab phase', 'odometry'],
      pins: b.pins,
      props: [
        { key: 'rpm', label: 'Shaft speed', type: 'slider', default: 0, min: -300, max: 300, step: 1, unit: 'rpm' },
        { key: 'ppr', label: 'Pulses per revolution', type: 'select', default: 20, options: [{ value: 20, label: '20' }, { value: 100, label: '100' }, { value: 360, label: '360' }] },
      ],
      drag: 'rpm',
      shapes: [...b.shapes, circle(15, -36, 21, '#4a4e55', { grad: '#1f2226', gradDir: 'd', shadow: 1 }), circle(15, -36, 16, '#2c2f34', { stroke: '#555a61', strokeWidth: 0.6 }), circle(15, -36, 4.5, '#e3e7eb', { grad: '#7e878f', gradDir: 'r' })],
      animations: [{ shape: circle(15, -36, 12, 'none', { stroke: '#8e959d', strokeWidth: 5, dash: 1.2, opacity: 0.8 }), rotate: 'ph / (4 * ppr) * 360', cx: 15, cy: -36 }],
      readouts: [{ value: 'rpm', unit: 'rpm', x: 15, y: -60, size: 4, color: '#ddd' }],
      states: [{ name: 'ph', init: 0, next: 'mod(ph + rpm / 60 * ppr * 4 * dt, 4 * ppr)' }],
      model: {
        elements: [
          dout('OA', 'A', 'mod(floor(ph + 1), 4) >= 2', 'VCC', 'GND', 200),
          dout('OB', 'B', 'mod(floor(ph), 4) >= 2', 'VCC', 'GND', 200),
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 10000 },
        ],
      },
      maxStep: 2e-4,
    };
  })(),
  (() => {
    const b = moduleBoard(['VCC', 'GND', 'DO', 'AO'], { h: 50, color: COL.pcbBlue, labels: { VCC: '+3.3–5 V', DO: 'DO (HIGH while the slot is blocked)', AO: 'AO' } });
    return {
      type: 'speed-sensor', name: 'Wheel / motor speed encoder (slot sensor)', category: 'sensors',
      description: 'Slotted optical sensor (FC-03 style) with a 20-slot encoder wheel: DO pulses once per slot, so pulses per second ÷ 20 = revolutions per second. Count them with an interrupt. Set the wheel speed while simulating.',
      keywords: ['speed sensor', 'wheel encoder', 'fc-03', 'slot sensor', 'tachometer', 'odometer', 'motor encoder'],
      pins: b.pins,
      props: [{ key: 'rpm', label: 'Wheel speed', type: 'slider', default: 0, min: 0, max: 600, step: 1, unit: 'rpm' }],
      drag: 'rpm',
      shapes: [
        ...b.shapes,
        circle(11, -45, 20, '#2b2d31', { opacity: 0.92, shadow: 1 }), circle(11, -45, 5, '#d8dce0', { grad: '#7e878f', gradDir: 'r' }),
        rect(-1, -42, 9, 20, '#34363b', { rx: 1, grad: '#141517', gradDir: 'h', shadow: 0.9 }), rect(14, -42, 9, 20, '#34363b', { rx: 1, grad: '#141517', gradDir: 'h', shadow: 0.9 }),
        ...chip(-6, -19.5, 10, 5, { n: 4, label: 'LM393' }), ...smdRow(12, -17, 3, 4.5),
      ],
      animations: [{ shape: circle(11, -45, 16.5, 'none', { stroke: '#101113', strokeWidth: 6, dash: 2.6 }), rotate: 'ph / 20 * 360', cx: 11, cy: -45 }],
      states: [{ name: 'ph', init: 0, next: 'mod(ph + rpm / 60 * 20 * dt, 20)' }],
      model: {
        elements: [
          dout('OD', 'DO', 'mod(ph, 1) < 0.5', 'VCC', 'GND', 100),
          { id: 'OA', kind: 'vsource', p: 'AO', n: 'GND', value: 'mod(ph, 1) < 0.5 ? v(VCC, GND) * 0.9 : 0.2', r: 1000 },
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1000 },
        ],
      },
      maxStep: 2e-4,
    };
  })(),
];


