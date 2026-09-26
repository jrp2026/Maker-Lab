import { COL, circle, dip, halfBridge, moduleBoard, pinRow, rect, screwTerminals, statusLed, text, type Raw } from './kit';

/** logic HIGH (TTL-ish threshold) relative to a ground pin */
const hi = (pin: string, gnd = 'GND', th = 2) => `(v(${pin}, ${gnd}) > ${th})`;

const pwrLed = (x: number, y: number, vcc: string, gnd = 'GND', th = 4) => statusLed(x, y, '#ff3b30', `v(${vcc}, ${gnd}) > ${th} ? 1 : 0`);

// ---------------------------------------------------------------- H-bridges

const l298n: Raw = (() => {
  const ctrl = pinRow(['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'], { x0: 20, labels: { ENA: 'ENA (PWM speed A; jumper = full speed)', ENB: 'ENB (PWM speed B)', IN1: 'IN1 (direction A)', IN2: 'IN2', IN3: 'IN3 (direction B)', IN4: 'IN4' } });
  const pwr = pinRow(['V12', 'GND', 'V5'], { x0: 30, y: -110, kind: 'terminal', labels: { V12: '+12 V motor supply (5–35 V)', GND: 'GND', V5: '+5 V (out with the 5 V jumper fitted)' } });
  const ma = pinRow(['OUT1', 'OUT2'], { x0: -30, y: -50, step: 12, kind: 'terminal', labels: { OUT1: 'Motor A', OUT2: 'Motor A' } }).map((p, i) => ({ ...p, x: -30, y: -70 + i * 14 }));
  const mb = pinRow(['OUT3', 'OUT4'], { kind: 'terminal', labels: { OUT3: 'Motor B', OUT4: 'Motor B' } }).map((p, i) => ({ ...p, x: 100, y: -70 + i * 14 }));
  const enA = `(jumperA == 1 || ${hi('ENA')})`, enB = `(jumperB == 1 || ${hi('ENB')})`;
  const led = pwrLed(10, -30, 'V12', 'GND', 4.5);
  return {
    type: 'l298n', name: 'L298N dual motor driver', category: 'drivers',
    description: 'Two H-bridges (2 A each, 5–35 V) for two DC motors or one bipolar stepper. IN1/IN2 set motor A’s direction (HIGH/LOW = forward, LOW/HIGH = back, equal = brake); ENA enables it (PWM it for speed, or leave the jumper on). Its bipolar switches drop ~2 V. With the 5 V jumper on, the on-board regulator supplies 5 V out.',
    keywords: ['l298n', 'l298', 'motor driver', 'h-bridge', 'dual h-bridge', 'stepper driver', 'dc motor driver'],
    pins: [...ctrl, ...pwr, ...ma, ...mb],
    props: [
      { key: 'jumperA', label: 'ENA jumper', type: 'select', default: 0, options: [{ value: 0, label: 'Off (drive ENA)' }, { value: 1, label: 'On (always enabled)' }] },
      { key: 'jumperB', label: 'ENB jumper', type: 'select', default: 0, options: [{ value: 0, label: 'Off (drive ENB)' }, { value: 1, label: 'On (always enabled)' }] },
      { key: 'reg', label: '5 V regulator jumper', type: 'select', default: 1, options: [{ value: 1, label: 'On (5 V out)' }, { value: 0, label: 'Off (feed 5 V in)' }] },
    ],
    shapes: [
      rect(-40, -120, 150, 128, COL.pcbRed, { rx: 4, stroke: 'rgba(0,0,0,.35)', strokeWidth: 0.8 }),
      rect(20, -100, 50, 44, '#23252a', { rx: 2 }), ...[0, 1, 2, 3, 4, 5, 6].map((i) => rect(22 + i * 7, -100, 4, 44, '#3a3d44')),
      text(45, -48, 'L298N', 6, '#fff'),
      ...screwTerminals(pwr), ...screwTerminals(ma.map((p) => ({ ...p, y: p.y }))), ...screwTerminals(mb),
      rect(15, -5, 70, 9, COL.header, { rx: 1 }), ...ctrl.map((c) => text(c.x, -9, c.id, 3.4, '#fff')),
      led.shape,
    ],
    indicators: [led.indicator],
    model: {
      elements: [
        ...halfBridge('A1', 'OUT1', 'V12', 'GND', `${enA} && ${hi('IN1')}`, `${enA} && !${hi('IN1')}`, 1.2),
        ...halfBridge('A2', 'OUT2', 'V12', 'GND', `${enA} && ${hi('IN2')}`, `${enA} && !${hi('IN2')}`, 1.2),
        ...halfBridge('B1', 'OUT3', 'V12', 'GND', `${enB} && ${hi('IN3')}`, `${enB} && !${hi('IN3')}`, 1.2),
        ...halfBridge('B2', 'OUT4', 'V12', 'GND', `${enB} && ${hi('IN4')}`, `${enB} && !${hi('IN4')}`, 1.2),
        { id: 'REG', kind: 'vsource', p: 'V5', n: 'GND', value: '(reg == 1 && v(V12, GND) > 7) ? 5 : 0', r: 0.5 },
        { id: 'RL', kind: 'resistor', a: 'V5', b: 'GND', value: 5000 },
        ...['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
      ],
    },
    warnings: [
      { when: 'abs(i(A1H)) + abs(i(A1L)) + abs(i(A2H)) + abs(i(A2L)) > 4 || abs(i(B1H)) + abs(i(B1L)) + abs(i(B2H)) + abs(i(B2L)) > 4', level: 'error', message: 'A channel is carrying more than 2 A.' },
      { when: 'v(V12, GND) > 35', level: 'error', message: 'Motor supply above 35 V.' },
    ],
  };
})();

const l293d: Raw = (() => {
  const d = dip(['EN12', 'A1', 'Y1', 'GND1', 'GND2', 'Y2', 'A2', 'VCC2', 'EN34', 'A3', 'Y3', 'GND3', 'GND4', 'Y4', 'A4', 'VCC1'], {
    label: 'L293D', sub: 'H-bridge',
    labels: { EN12: '1,2 Enable', EN34: '3,4 Enable', A1: '1A', A2: '2A', A3: '3A', A4: '4A', Y1: '1Y (motor)', Y2: '2Y (motor)', Y3: '3Y (motor)', Y4: '4Y (motor)', VCC2: 'VCC2 motor supply (4.5–36 V)', VCC1: 'VCC1 logic 5 V', GND1: 'GND / heat sink', GND2: 'GND', GND3: 'GND', GND4: 'GND' },
  });
  const ch = (n: number, en: string) => halfBridge(`H${n}`, `Y${n}`, 'VCC2', 'GND1', `${hi(en, 'GND1')} && ${hi(`A${n}`, 'GND1')} && v(VCC1, GND1) > 4`, `${hi(en, 'GND1')} && !${hi(`A${n}`, 'GND1')} && v(VCC1, GND1) > 4`, 1.2);
  return {
    type: 'l293d', name: 'L293D quad half-H driver', category: 'drivers',
    description: 'Four half-bridges (600 mA each, built-in flyback diodes) = two H-bridges in a DIP-16. Motor between 1Y and 2Y; drive 1A/2A for direction and PWM the 1,2EN pin for speed. VCC1 = 5 V logic, VCC2 = motor supply.',
    keywords: ['l293d', 'l293', 'h-bridge', 'motor driver', 'half bridge', 'push-pull'],
    ...d,
    connections: [['GND1', 'GND2', 'GND3', 'GND4']],
    model: {
      elements: [...ch(1, 'EN12'), ...ch(2, 'EN12'), ...ch(3, 'EN34'), ...ch(4, 'EN34'), ...['EN12', 'EN34', 'A1', 'A2', 'A3', 'A4'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND1', value: 1e6 })), { id: 'IQ', kind: 'resistor', a: 'VCC1', b: 'GND1', value: 2000 }],
    },
    warnings: [{ when: [1, 2, 3, 4].map((n) => `abs(i(H${n}H)) > 1.2 || abs(i(H${n}L)) > 1.2`).join(' || '), level: 'error', message: 'Output current above the 1.2 A peak rating.' }],
  };
})();

/** Two-input bridge logic used by DRV8833 / MX1508: 10 forward, 01 reverse, 11 brake, 00 coast. */
function dualInBridge(prefix: string, o1: string, o2: string, in1: string, in2: string, en: string, vm: string, ron: number): Raw[] {
  return [
    ...halfBridge(`${prefix}1`, o1, vm, 'GND', `${en} && ${hi(in1)} && !${hi(in2)}`, `${en} && ${hi(in2)}`, ron),
    ...halfBridge(`${prefix}2`, o2, vm, 'GND', `${en} && ${hi(in2)} && !${hi(in1)}`, `${en} && ${hi(in1)}`, ron),
  ];
}

const tb6612: Raw = (() => {
  const d = dip(['PWMA', 'AIN2', 'AIN1', 'STBY', 'BIN1', 'BIN2', 'PWMB', 'GND1', 'GND2', 'BO1', 'BO2', 'AO2', 'AO1', 'GND3', 'VCC', 'VM'], {
    label: 'TB6612FNG', sub: 'dual driver', color: COL.pcbRed, wide: true,
    labels: { VM: 'VM motor supply (≤ 15 V)', VCC: 'VCC logic 2.7–5.5 V', STBY: 'Standby (HIGH to run)', AO1: 'Motor A', AO2: 'Motor A', BO1: 'Motor B', BO2: 'Motor B' },
  });
  const h1 = (p: string) => hi(p, 'GND1');
  const ch = (x: string) => {
    const i1 = h1(`${x}IN1`), i2 = h1(`${x}IN2`), pwm = h1(`PWM${x}`), st = h1('STBY');
    const brake = `(${i1} && ${i2}) || (!${pwm} && (${i1} || ${i2}))`;
    return [
      ...halfBridge(`${x}1`, `${x}O1`, 'VM', 'GND1', `${st} && ${i1} && !${i2} && ${pwm}`, `${st} && ((${brake}) || (!${i1} && ${i2} && ${pwm}))`, 0.5),
      ...halfBridge(`${x}2`, `${x}O2`, 'VM', 'GND1', `${st} && ${i2} && !${i1} && ${pwm}`, `${st} && ((${brake}) || (${i1} && !${i2} && ${pwm}))`, 0.5),
    ];
  };
  return {
    type: 'tb6612fng', name: 'TB6612FNG dual motor driver', category: 'drivers',
    description: 'Efficient MOSFET dual H-bridge (1.2 A per channel, 0.5 Ω). Per motor: IN1/IN2 set direction (both HIGH = brake), PWM sets speed (LOW = brake). STBY must be HIGH. VM up to 15 V, logic 3.3 or 5 V.',
    keywords: ['tb6612', 'tb6612fng', 'motor driver', 'mosfet h-bridge', 'dual motor'],
    ...d,
    connections: [['GND1', 'GND2', 'GND3']],
    model: {
      elements: [
        ...ch('A'),
        ...ch('B'),
        ...['PWMA', 'AIN1', 'AIN2', 'STBY', 'BIN1', 'BIN2', 'PWMB'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND1', value: 200000 })),
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND1', value: 5000 },
      ],
    },
    warnings: [{ when: 'v(VM, GND1) > 15', level: 'error', message: 'VM above 15 V.' }],
  };
})();

const drv8833: Raw = (() => {
  const b = moduleBoard(['IN1', 'IN2', 'IN3', 'IN4', 'SLP', 'GND', 'VM'], { h: 50, color: COL.pcbPurple, title: 'DRV8833', labels: { SLP: 'nSLEEP (HIGH/open = run)', VM: 'VM 2.7–10.8 V', IN1: 'AIN1', IN2: 'AIN2', IN3: 'BIN1', IN4: 'BIN2' } });
  const out = pinRow(['OUT1', 'OUT2', 'OUT3', 'OUT4'], { x0: 10, y: -80, labels: { OUT1: 'AOUT1', OUT2: 'AOUT2', OUT3: 'BOUT1', OUT4: 'BOUT2' } });
  const en = `(v(SLP, GND) > 1.5 && v(VM, GND) > 2.7)`;
  return {
    type: 'drv8833', name: 'DRV8833 dual motor driver', category: 'drivers',
    description: 'Tiny low-voltage dual H-bridge (1.5 A, 2.7–10.8 V) — great for small robots on batteries. Per motor: IN1 HIGH / IN2 LOW = forward, LOW/HIGH = reverse, both HIGH = brake, both LOW = coast. PWM an input for speed.',
    keywords: ['drv8833', 'motor driver', 'h-bridge', 'low voltage', 'dual motor'],
    pins: [...b.pins, ...out],
    shapes: [...b.shapes, rect(0, -90, 50, 9, COL.header, { rx: 1 }), rect(20, -46, 14, 14, COL.ic, { rx: 1 })],
    model: {
      elements: [
        ...dualInBridge('A', 'OUT1', 'OUT2', 'IN1', 'IN2', en, 'VM', 0.36),
        ...dualInBridge('B', 'OUT3', 'OUT4', 'IN3', 'IN4', en, 'VM', 0.36),
        { id: 'PSL', kind: 'resistor', a: 'VM', b: 'SLP', value: 100000 },
        ...['IN1', 'IN2', 'IN3', 'IN4'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
      ],
    },
    warnings: [{ when: 'v(VM, GND) > 10.8', level: 'error', message: 'VM above 10.8 V.' }],
  };
})();

const mx1508: Raw = (() => {
  const b = moduleBoard(['IN1', 'IN2', 'IN3', 'IN4', 'VCC', 'GND'], { h: 50, color: COL.pcbRed, title: 'MX1508', labels: { VCC: '+ (2–10 V motor supply)' } });
  const out = pinRow(['OUT1', 'OUT2', 'OUT3', 'OUT4'], { x0: 5, y: -80, kind: 'terminal', labels: { OUT1: 'Motor A', OUT2: 'Motor A', OUT3: 'Motor B', OUT4: 'Motor B' } });
  return {
    type: 'dual-hbridge', name: 'Dual H-bridge module (MX1508)', category: 'drivers',
    description: 'Cheap two-motor H-bridge board (1.5 A per channel, 2–10 V). IN1/IN2 control motor A and IN3/IN4 motor B: one input HIGH turns it one way, the other input the other way; both HIGH brakes. PWM the active input for speed.',
    keywords: ['dual h-bridge', 'mx1508', 'l9110', 'motor driver', 'two motors'],
    pins: [...b.pins, ...out],
    shapes: [...b.shapes, ...screwTerminals(out)],
    model: {
      elements: [
        ...dualInBridge('A', 'OUT1', 'OUT2', 'IN1', 'IN2', '(v(VCC, GND) > 1.8)', 'VCC', 0.5),
        ...dualInBridge('B', 'OUT3', 'OUT4', 'IN3', 'IN4', '(v(VCC, GND) > 1.8)', 'VCC', 0.5),
        ...['IN1', 'IN2', 'IN3', 'IN4'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
      ],
    },
  };
})();

const hbridge: Raw = (() => {
  const b = moduleBoard(['IA', 'IB', 'VCC', 'GND'], { h: 44, color: COL.pcbGreen, title: 'L9110S', labels: { IA: 'A-IA', IB: 'A-IB', VCC: 'VCC 2.5–12 V' } });
  const out = pinRow(['OA', 'OB'], { x0: 10, y: -64, kind: 'terminal', labels: { OA: 'Motor', OB: 'Motor' } });
  return {
    type: 'hbridge', name: 'H-bridge module (L9110S, single)', category: 'drivers',
    description: 'One small H-bridge (800 mA, 2.5–12 V) for one DC motor. IA HIGH + IB LOW spins one way, IA LOW + IB HIGH the other; both the same stops (both outputs LOW). PWM the HIGH input for speed.',
    keywords: ['h-bridge', 'l9110', 'l9110s', 'hg7881', 'motor driver', 'single motor'],
    pins: [...b.pins, ...out],
    shapes: [...b.shapes, ...screwTerminals(out, '#1f9d55')],
    model: {
      elements: [
        ...halfBridge('A', 'OA', 'VCC', 'GND', `${hi('IA')} && !${hi('IB')}`, `!(${hi('IA')} && !${hi('IB')}) && v(VCC, GND) > 2`, 0.8),
        ...halfBridge('B', 'OB', 'VCC', 'GND', `${hi('IB')} && !${hi('IA')}`, `!(${hi('IB')} && !${hi('IA')}) && v(VCC, GND) > 2`, 0.8),
        { id: 'RIA', kind: 'resistor', a: 'IA', b: 'GND', value: 100000 },
        { id: 'RIB', kind: 'resistor', a: 'IB', b: 'GND', value: 100000 },
      ],
    },
  };
})();

const bts7960: Raw = (() => {
  const b = moduleBoard(['RPWM', 'LPWM', 'REN', 'LEN', 'RIS', 'LIS', 'VCC', 'GND'], { h: 70, w: 110, color: COL.pcbBlack, labels: { RPWM: 'RPWM (forward PWM)', LPWM: 'LPWM (reverse PWM)', REN: 'R_EN (HIGH to enable)', LEN: 'L_EN (HIGH to enable)', RIS: 'R_IS current sense', LIS: 'L_IS current sense', VCC: '+5 V logic' } });
  const pw = pinRow(['BP', 'BN', 'MP', 'MN'], { x0: 5, y: -96, step: 20, kind: 'terminal', labels: { BP: 'B+ (6–27 V)', BN: 'B− (power GND)', MP: 'M+', MN: 'M−' } });
  return {
    type: 'bts7960', name: 'BTS7960 43 A motor driver', category: 'drivers',
    description: 'High-current H-bridge (two BTS7960 half-bridges, 43 A, 6–27 V) for big DC motors. Enable both R_EN and L_EN, then PWM RPWM for one direction or LPWM for the other (keep the other LOW). R_IS/L_IS output a voltage proportional to the current.',
    keywords: ['bts7960', 'ibt-2', 'high current', 'motor driver', 'h-bridge', '43a'],
    pins: [...b.pins, ...pw],
    shapes: [...b.shapes, ...screwTerminals(pw, '#2f7fd6'), rect(-2, -66, 64, 30, '#8a929b', { rx: 1 }), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => rect(0 + i * 8, -66, 3, 30, '#6f777f'))],
    connections: [['GND', 'BN']],
    model: {
      elements: [
        ...halfBridge('R', 'MP', 'BP', 'BN', `${hi('REN')} && ${hi('RPWM')}`, `${hi('REN')} && !${hi('RPWM')}`, 0.016),
        ...halfBridge('L', 'MN', 'BP', 'BN', `${hi('LEN')} && ${hi('LPWM')}`, `${hi('LEN')} && !${hi('LPWM')}`, 0.016),
        { id: 'SR', kind: 'vsource', p: 'RIS', n: 'GND', value: 'min(5, abs(i(RH)) / 8500 * 1000)', r: 1000 },
        { id: 'SL', kind: 'vsource', p: 'LIS', n: 'GND', value: 'min(5, abs(i(LH)) / 8500 * 1000)', r: 1000 },
        ...['RPWM', 'LPWM', 'REN', 'LEN'].map((p) => ({ id: `P${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 2500 },
      ],
    },
    warnings: [{ when: 'abs(i(RH)) > 43 || abs(i(LH)) > 43', level: 'error', message: 'Above 43 A.' }],
  };
})();

const vnh2sp30: Raw = (() => {
  const b = moduleBoard(['INA', 'INB', 'PWM', 'EN', 'CS', 'VCC', 'GND'], { h: 60, w: 90, color: COL.pcbRed, title: 'VNH2SP30', labels: { INA: 'INA (direction)', INB: 'INB (direction)', PWM: 'PWM (speed)', EN: 'EN / DIAG (HIGH = enabled)', CS: 'Current sense (~0.13 V/A)', VCC: '+5 V logic' } });
  const pw = pinRow(['VIN', 'GNDP', 'OUTA', 'OUTB'], { x0: 0, y: -86, step: 20, kind: 'terminal', labels: { VIN: 'Motor supply + (5.5–16 V)', GNDP: 'Motor supply −', OUTA: 'Motor A', OUTB: 'Motor B' } });
  const en = `${hi('EN')} && v(VIN, GNDP) > 5.5`, a = hi('INA'), bb = hi('INB'), pwm = hi('PWM');
  return {
    type: 'vnh2sp30', name: 'VNH2SP30 motor driver (Monster Moto)', category: 'drivers',
    description: 'Single high-power H-bridge (30 A, 5.5–16 V). INA HIGH + INB LOW = forward, LOW/HIGH = reverse, both equal = brake; PWM sets speed. EN has a pull-up (it also reports faults). CS gives ~0.13 V per amp.',
    keywords: ['vnh2sp30', 'monster moto', 'vnh5019', 'motor driver', 'high current'],
    pins: [...b.pins, ...pw],
    shapes: [...b.shapes, ...screwTerminals(pw), rect(10, -52, 24, 20, COL.ic, { rx: 1 })],
    connections: [['GND', 'GNDP']],
    model: {
      elements: [
        ...halfBridge('A', 'OUTA', 'VIN', 'GNDP', `${en} && ${a} && (${bb} || ${pwm})`, `${en} && !(${a} && (${bb} || ${pwm}))`, 0.02),
        ...halfBridge('B', 'OUTB', 'VIN', 'GNDP', `${en} && ${bb} && (${a} || ${pwm})`, `${en} && !(${bb} && (${a} || ${pwm}))`, 0.02),
        { id: 'CSO', kind: 'vsource', p: 'CS', n: 'GND', value: 'min(5, (abs(i(AH)) + abs(i(BH))) * 0.13)', r: 1500 },
        { id: 'PEN', kind: 'resistor', a: 'VCC', b: 'EN', value: 1000 },
        ...['INA', 'INB', 'PWM'].map((p) => ({ id: `P${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
      ],
    },
  };
})();

// ---------------------------------------------------------------- switch modules

const mosfetModule: Raw = (() => {
  const b = moduleBoard(['SIG', 'VCC', 'GND'], { h: 50, w: 70, color: COL.pcbBlue, labels: { SIG: 'SIG (gate)', VCC: 'VCC (not used)', GND: 'GND' } });
  const pw = pinRow(['VIN', 'GNDP', 'LP', 'LN'], { x0: -5, y: -76, step: 16, kind: 'terminal', labels: { VIN: 'VIN (load supply +)', GNDP: 'GND (load supply −)', LP: 'V+ (load +)', LN: 'V− (load −, switched)' } });
  const led = statusLed(40, -30, '#ff3b30', 'v(G, GND) > 3 ? 1 : 0');
  return {
    type: 'mosfet-switch', name: 'MOSFET switch module (IRF520)', category: 'drivers',
    description: 'IRF520 low-side switch board for motors, LED strips and solenoids up to 24 V. SIG HIGH switches V− to ground. Beware: the IRF520 is not logic-level — at 5 V on the gate it only passes ~1 A (it needs ~10 V for full current).',
    keywords: ['mosfet module', 'irf520', 'mosfet switch', 'motor switch', 'led strip driver', 'pwm driver'],
    pins: [...b.pins, ...pw],
    shapes: [...b.shapes, ...screwTerminals(pw), rect(0, -46, 24, 16, COL.ic, { rx: 1 }), text(12, -36, 'IRF520', 3.4, '#ddd'), led.shape],
    indicators: [led.indicator],
    connections: [['VIN', 'LP'], ['GND', 'GNDP']],
    model: {
      nodes: ['G'],
      elements: [
        { id: 'RG', kind: 'resistor', a: 'SIG', b: 'G', value: 1000 },
        { id: 'RPD', kind: 'resistor', a: 'G', b: 'GND', value: 10000 },
        { id: 'M', kind: 'nmos', d: 'LN', g: 'G', s: 'GNDP', vth: 3.8, k: 1.6 },
        { id: 'NCV', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e7 },
      ],
    },
  };
})();

const solenoidDriver: Raw = (() => {
  const b = moduleBoard(['IN', 'VCC', 'GND'], { h: 46, w: 70, color: COL.pcbGreen, labels: { IN: 'IN (HIGH = on)', VCC: '+5 V (LED)', GND: 'GND' } });
  const pw = pinRow(['VP', 'LN'], { x0: 5, y: -70, step: 20, kind: 'terminal', labels: { VP: 'Load supply + (to the solenoid)', LN: 'Solenoid − (switched to GND)' } });
  const led = statusLed(40, -28, '#35d05a', 'v(IN, GND) > 1.5 ? 1 : 0');
  return {
    type: 'solenoid-driver', name: 'Solenoid driver module (TIP120)', category: 'drivers',
    description: 'Darlington low-side switch with a flyback diode already fitted — the easy, safe way to fire a solenoid, relay coil or small motor (≤ 3 A, ≤ 30 V) from a pin. Connect the load between VP and LN; tie the load supply’s − to GND.',
    keywords: ['solenoid driver', 'tip120', 'darlington', 'flyback', 'low side switch'],
    pins: [...b.pins, ...pw],
    shapes: [...b.shapes, ...screwTerminals(pw), rect(0, -40, 20, 14, COL.ic, { rx: 1 }), led.shape],
    indicators: [led.indicator],
    model: {
      nodes: ['BX'],
      elements: [
        { id: 'RB', kind: 'resistor', a: 'IN', b: 'BX', value: 1000 },
        { id: 'Q', kind: 'npn', c: 'LN', b: 'BX', e: 'GND', beta: 1000 },
        { id: 'DF', kind: 'diode', a: 'LN', k: 'VP', model: 'power' },
        { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 3000 },
      ],
    },
  };
})();

const esc: Raw = (() => {
  const pins = [
    ...pinRow(['SIG', 'BEC', 'GNDS'], { labels: { SIG: 'Signal (servo pulses, 1–2 ms)', BEC: '+5 V BEC out', GNDS: 'Signal GND' } }),
    ...pinRow(['VBAT', 'GND'], { x0: -30, y: -40, step: 10, kind: 'terminal', labels: { VBAT: 'Battery + (2–3S LiPo)', GND: 'Battery −' } }).map((p, i) => ({ ...p, x: -30, y: -50 + i * 20 })),
    ...pinRow(['U', 'V', 'W'], { kind: 'terminal', labels: { U: 'Motor phase U', V: 'Motor phase V', W: 'Motor phase W' } }).map((p, i) => ({ ...p, x: 70, y: -60 + i * 15 })),
  ];
  return {
    type: 'esc', name: 'ESC (brushless speed controller, 30 A)', category: 'drivers',
    description: 'Hobby ESC for a brushless motor: takes RC servo pulses on SIG (1000 µs = stop … 2000 µs = full) — drive it with Servo.writeMicroseconds(). Arms when it first sees a low-throttle pulse. Its BEC supplies 5 V. (Simplified 3-phase drive.)',
    keywords: ['esc', 'speed controller', 'brushless', 'simonk', 'blheli', 'drone', 'rc'],
    pins,
    shapes: [rect(-24, -66, 88, 58, '#2f6fd6', { rx: 6 }), rect(-18, -58, 76, 42, '#1f4f9f', { rx: 4 }), text(20, -34, 'ESC 30A', 7, '#fff'), rect(-5, -8, 30, 9, COL.header, { rx: 1 })],
    readouts: [{ value: 'round(d * 100)', unit: '%', x: 20, y: -22, size: 4.5, color: '#fff' }],
    states: [
      { name: 'armed', init: 0, next: 'armed == 1 ? (v(VBAT, GND) > 3 ? 1 : 0) : ((servo(SIG) > 900 && servo(SIG) < 1100 && v(VBAT, GND) > 5) ? 1 : 0)' },
      { name: 'th', init: 0, next: 'armed == 1 ? clamp((servo(SIG) - 1050) / 900, 0, 1) : 0' },
      // soft start (full throttle in 0.5 s) and a 30 A current limit
      { name: 'd', init: 0, next: 'abs(i(OU)) > 30 ? d * 0.9 : (d < th ? min(th, d + 2 * dt) : th)' },
    ],
    connections: [['GND', 'GNDS']],
    model: {
      elements: [
        { id: 'OU', kind: 'vsource', p: 'U', n: 'V', value: 'd * v(VBAT, GND)', r: 0.02 },
        { id: 'RW', kind: 'resistor', a: 'W', b: 'V', value: 1e6 },
        { id: 'RV', kind: 'resistor', a: 'V', b: 'GND', value: 1e6 },
        { id: 'DRAW', kind: 'isource', p: 'GND', n: 'VBAT', value: 'abs(v(U, V) * i(OU)) / max(3, v(VBAT, GND)) / 0.92' },
        { id: 'BECS', kind: 'vsource', p: 'BEC', n: 'GND', value: 'v(VBAT, GND) > 6 ? 5 : 0', r: 0.3 },
        { id: 'RS', kind: 'resistor', a: 'SIG', b: 'GND', value: 100000 },
      ],
    },
    warnings: [{ when: 'abs(i(OU)) > 30', level: 'error', message: 'Above the 30 A rating.' }],
  };
})();

const bldcController: Raw = (() => {
  const b = moduleBoard(['SPEED', 'DIR', 'BRAKE', 'V5', 'GNDL'], { h: 70, w: 110, color: COL.pcbBlack, labels: { SPEED: 'Speed (0–5 V or PWM)', DIR: 'Direction', BRAKE: 'Brake (HIGH = brake)', V5: '+5 V out', GNDL: 'Logic GND' } });
  const pw = pinRow(['VIN', 'GND', 'U', 'V', 'W'], { x0: -5, y: -96, step: 15, kind: 'terminal', labels: { VIN: 'Supply + (6–60 V)', GND: 'Supply −', U: 'Phase U', V: 'Phase V', W: 'Phase W' } });
  return {
    type: 'bldc-controller', name: 'BLDC motor controller (ZS-X11H)', category: 'drivers',
    description: 'Sensor/sensorless brushless controller board for bigger BLDC motors (6–60 V, 16 A). The SPEED pin sets the speed from a 0–5 V level or a PWM signal; DIR reverses; BRAKE HIGH shorts the windings. (Simplified 3-phase drive.)',
    keywords: ['bldc controller', 'zs-x11h', 'brushless driver', 'hub motor', 'scooter'],
    pins: [...b.pins, ...pw],
    shapes: [...b.shapes, ...screwTerminals(pw, '#1f9d55'), rect(10, -66, 60, 26, '#8a929b', { rx: 1 })],
    connections: [['GND', 'GNDL']],
    model: {
      elements: [
        { id: 'OU', kind: 'vsource', p: 'U', n: 'V', value: `(v(VIN, GND) > 6 && !${hi('BRAKE', 'GND')}) ? (${hi('DIR', 'GND')} ? -1 : 1) * clamp((v(SPEED, GND) - 0.1) / 4.8, 0, 1) * v(VIN, GND) : 0`, r: 0.05 },
        { id: 'RW', kind: 'resistor', a: 'W', b: 'V', value: 1e6 },
        { id: 'RV', kind: 'resistor', a: 'V', b: 'GND', value: 1e6 },
        { id: 'DRAW', kind: 'isource', p: 'GND', n: 'VIN', value: 'abs(v(U, V) * i(OU)) / max(3, v(VIN, GND)) / 0.92' },
        { id: 'REG', kind: 'vsource', p: 'V5', n: 'GND', value: 'v(VIN, GND) > 7 ? 5 : 0', r: 1 },
        ...['SPEED', 'DIR', 'BRAKE'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
      ],
    },
  };
})();

// ---------------------------------------------------------------- step/dir stepper drivers

function stepperDriver(o: { type: string; name: string; chip: string; ms: string[]; micro: string; ilim: number; vmax: number; color: string; description: string; keywords: string[] }): Raw {
  const [m1, m2, m3] = o.ms;
  const names = ['EN', m1, m2, m3 ?? 'NC', 'RST', 'SLP', 'STEP', 'DIR', 'GND2', 'VDD', 'A2', 'A1', 'B1', 'B2', 'GND', 'VMOT'];
  const d = dip(names, {
    label: o.chip, color: o.color, wide: true,
    labels: { EN: 'ENABLE (LOW = on)', RST: 'RESET (tie to SLEEP)', SLP: 'SLEEP (HIGH = awake)', STEP: 'STEP (one microstep per rising edge)', DIR: 'DIR', VDD: 'Logic 3.3–5 V', VMOT: `Motor supply (8–${o.vmax} V, add 100 µF)`, A1: '1A (coil 1)', A2: '1B (coil 1)', B1: '2A (coil 2)', B2: '2B (coil 2)', NC: 'Not connected', GND2: 'GND' },
  });
  const hv = (p: string) => `(v(${p}, GND) > v(VDD, GND) / 2)`;
  const en = `(!${hv('EN')} && ${hv('RST')} && ${hv('SLP')} && v(VDD, GND) > 2.5 && v(VMOT, GND) > 7)`;
  const el = '(pos * 90 + 45) * 0.0174533';
  const drive = (coil: string, fn: string) => `${en} ? clamp(ilim * ${fn}(${el}) * rc${coil}, -v(VMOT, GND), v(VMOT, GND)) : 0`;
  return {
    type: o.type, name: o.name, category: 'drivers', description: o.description, keywords: o.keywords,
    ...d,
    props: [{ key: 'ilim', label: 'Current limit (Vref pot)', type: 'slider', default: o.ilim, min: 0.1, max: 2.5, step: 0.05, unit: 'A' }],
    connections: [['GND', 'GND2']],
    states: [
      { name: 'micro', init: 1, next: o.micro },
      { name: 'pos', init: 0, next: `${en} ? pos + (${hv('DIR')} ? 1 : -1) * max(0, edges(STEP) - pe) / micro : pos` },
      { name: 'pe', init: 'edges(STEP)', next: 'edges(STEP)' },
      // chopper: estimate the coil resistance so the bridge voltage produces the set current
      { name: 'rcA', init: 20, next: 'abs(i(OA)) > 0.02 ? clamp(abs(v(A1, A2)) / abs(i(OA)), 0.5, 200) : rcA' },
      { name: 'rcB', init: 20, next: 'abs(i(OB)) > 0.02 ? clamp(abs(v(B1, B2)) / abs(i(OB)), 0.5, 200) : rcB' },
    ],
    readouts: [{ value: 'round(pos * micro)', label: 'µstep', x: 35, y: 34, size: 3.6, color: '#ddd' }],
    model: {
      elements: [
        { id: 'OA', kind: 'vsource', p: 'A1', n: 'A2', value: drive('A', 'cos'), r: 0.3 },
        { id: 'OB', kind: 'vsource', p: 'B1', n: 'B2', value: drive('B', 'sin'), r: 0.3 },
        { id: 'GA', kind: 'resistor', a: 'A2', b: 'GND', value: 1e6 },
        { id: 'GB', kind: 'resistor', a: 'B2', b: 'GND', value: 1e6 },
        { id: 'DRAW', kind: 'isource', p: 'GND', n: 'VMOT', value: '(abs(v(A1, A2) * i(OA)) + abs(v(B1, B2) * i(OB))) / max(5, v(VMOT, GND)) / 0.85' },
        { id: 'PSL', kind: 'resistor', a: 'VDD', b: 'SLP', value: 100000 },
        { id: 'PRS', kind: 'resistor', a: 'VDD', b: 'RST', value: 100000 },
        ...['EN', m1, m2, ...(m3 ? [m3] : ['NC']), 'STEP', 'DIR'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 100000 })),
        { id: 'IQ', kind: 'resistor', a: 'VDD', b: 'GND', value: 20000 },
      ],
    },
    warnings: [{ when: `v(VMOT, GND) > ${o.vmax}`, level: 'error', message: `Motor supply above ${o.vmax} V.` }],
  };
}

const H3 = (a: string, b: string, c: string, pin: (p: string) => string = (p) => `(v(${p}, GND) > v(VDD, GND) / 2)`) => [pin(a), pin(b), pin(c)];

const a4988 = (() => {
  const [a, b, c] = H3('MS1', 'MS2', 'MS3');
  return stepperDriver({
    type: 'a4988', name: 'A4988 stepper driver', chip: 'A4988', ms: ['MS1', 'MS2', 'MS3'], ilim: 1, vmax: 35, color: '#1f7a45',
    micro: `(${a} && ${b} && ${c}) ? 16 : ((${a} && ${b}) ? 8 : (${b} ? 4 : (${a} ? 2 : 1)))`,
    description: 'Step/dir driver for one bipolar stepper (up to 2 A, 8–35 V). Each rising edge on STEP moves one (micro)step in the DIR direction; MS1–MS3 choose full … 1/16 steps. Set the current limit with the pot. Tie RESET to SLEEP; ENABLE is active LOW.',
    keywords: ['a4988', 'stepper driver', 'step dir', 'pololu', 'cnc shield', 'reprap', 'microstepping'],
  });
})();
const drv8825 = (() => {
  const [a, b, c] = H3('M0', 'M1', 'M2');
  return stepperDriver({
    type: 'drv8825', name: 'DRV8825 stepper driver', chip: 'DRV8825', ms: ['M0', 'M1', 'M2'], ilim: 1.5, vmax: 45, color: '#5b3a9a',
    micro: `${c} ? ((${a} || ${b}) ? 32 : 16) : ((${a} && ${b}) ? 8 : (${b} ? 4 : (${a} ? 2 : 1)))`,
    description: 'Higher-voltage step/dir stepper driver (2.2 A, 8.2–45 V, up to 1/32 microstepping via M0–M2). Pin-compatible with the A4988: one (micro)step per STEP rising edge.',
    keywords: ['drv8825', 'stepper driver', 'step dir', 'pololu', 'microstepping', '1/32'],
  });
})();
const tmc2208 = (() => {
  const [a, b] = H3('MS1', 'MS2', 'MS2');
  return stepperDriver({
    type: 'tmc2208', name: 'TMC2208 silent stepper driver', chip: 'TMC2208', ms: ['MS1', 'MS2'], ilim: 1.2, vmax: 36, color: '#23252a',
    micro: `(${a} && ${b}) ? 16 : (${b} ? 4 : (${a} ? 2 : 8))`,
    description: 'Trinamic "StealthChop" silent step/dir driver (1.4 A RMS, 4.75–36 V). Standalone mode: MS1/MS2 LOW/LOW = 1/8, HIGH/LOW = 1/2, LOW/HIGH = 1/4, HIGH/HIGH = 1/16 microsteps (interpolated to 256 internally).',
    keywords: ['tmc2208', 'trinamic', 'silent stepper', 'stealthchop', 'stepper driver', '3d printer'],
  });
})();
const tmc2209 = (() => {
  const [a, b] = H3('MS1', 'MS2', 'MS2');
  return stepperDriver({
    type: 'tmc2209', name: 'TMC2209 silent stepper driver', chip: 'TMC2209', ms: ['MS1', 'MS2'], ilim: 1.7, vmax: 29, color: '#23252a',
    micro: `(${a} && ${b}) ? 16 : (${b} ? 64 : (${a} ? 32 : 8))`,
    description: 'Trinamic silent step/dir driver (2 A RMS, 4.75–29 V) with StallGuard. Standalone mode: MS1/MS2 LOW/LOW = 1/8, HIGH/LOW = 1/32, LOW/HIGH = 1/64, HIGH/HIGH = 1/16 microsteps.',
    keywords: ['tmc2209', 'trinamic', 'silent stepper', 'stallguard', 'stepper driver'],
  });
})();

// ---------------------------------------------------------------- level shifting & RF

const levelShifter: Raw = (() => {
  const top = pinRow(['HV1', 'HV2', 'HV', 'GND', 'HV3', 'HV4'], { y: -50, labels: { HV: 'HV supply (5 V)', HV1: 'High-side 1', HV2: 'High-side 2', HV3: 'High-side 3', HV4: 'High-side 4' } });
  const bottom = pinRow(['LV1', 'LV2', 'LV', 'GND2', 'LV3', 'LV4'], { labels: { LV: 'LV supply (3.3 V)', LV1: 'Low-side 1', LV2: 'Low-side 2', LV3: 'Low-side 3', LV4: 'Low-side 4', GND2: 'GND' } });
  const ch = (n: number) => [
    { id: `M${n}`, kind: 'nmos', d: `HV${n}`, g: 'LV', s: `LV${n}`, vth: 1.3, k: 0.2 },
    { id: `D${n}`, kind: 'diode', a: `LV${n}`, k: `HV${n}`, model: 'silicon' },
    { id: `PL${n}`, kind: 'resistor', a: 'LV', b: `LV${n}`, value: 10000 },
    { id: `PH${n}`, kind: 'resistor', a: 'HV', b: `HV${n}`, value: 10000 },
  ];
  return {
    type: 'logic-level-converter', name: 'Logic-level converter (4-ch, BSS138)', category: 'comms',
    description: 'Bidirectional 3.3 V ↔ 5 V level shifter: each channel is a BSS138 MOSFET with 10 kΩ pull-ups on both sides. Works for I2C, UART, SPI and plain GPIO. Power LV with 3.3 V and HV with 5 V and join the grounds.',
    keywords: ['level shifter', 'logic level converter', 'bss138', '3.3v 5v', 'voltage translator', 'bidirectional'],
    pins: [...top, ...bottom],
    shapes: [...top.map((p) => ({ type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y + 6, stroke: COL.metal, strokeWidth: 2 })), ...bottom.map((p) => ({ type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y - 6, stroke: COL.metal, strokeWidth: 2 })), rect(-6, -44, 62, 38, '#b8322a', { rx: 2 }), text(25, -30, 'HV ⇅ LV', 5, '#fff'), ...[0, 1, 2, 3].map((i) => rect(4 + i * 12, -22, 6, 6, COL.ic, { rx: 0.5 }))],
    connections: [['GND', 'GND2']],
    model: { elements: [1, 2, 3, 4].flatMap(ch) },
  };
})();

const antenna: Raw = {
  type: 'rf-antenna', name: 'RF antenna (433 MHz / 2.4 GHz)', category: 'comms',
  description: 'Quarter-wave whip antenna for RF modules (433 MHz spring coil or 2.4 GHz whip). Connect ANT to the module’s antenna pin. Electrically it looks like a few pF here — radio links themselves are not simulated.',
  keywords: ['antenna', 'rf', '433mhz', '2.4ghz', 'whip', 'sma'],
  pins: pinRow(['ANT', 'GND'], { labels: { ANT: 'Antenna feed', GND: 'Ground plane' } }),
  shapes: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: -12, stroke: COL.copper, strokeWidth: 1.6 }, { type: 'line', x1: 10, y1: 0, x2: 10, y2: -8, stroke: '#333', strokeWidth: 1.6 }, rect(-4, -18, 18, 8, '#c9a24a', { rx: 1 }), rect(2, -80, 6, 62, '#2b2d31', { rx: 3 }), circle(5, -80, 3.5, '#2b2d31')],
  model: { elements: [{ id: 'C', kind: 'capacitor', a: 'ANT', b: 'GND', value: 3e-12 }, { id: 'R', kind: 'resistor', a: 'ANT', b: 'GND', value: 1e9 }] },
};

export const DRIVERS: Raw[] = [l298n, l293d, tb6612, drv8833, mx1508, hbridge, bts7960, vnh2sp30, mosfetModule, solenoidDriver, esc, bldcController, a4988, drv8825, tmc2208, tmc2209];
export const COMMS_PASSIVE: Raw[] = [levelShifter, antenna];

