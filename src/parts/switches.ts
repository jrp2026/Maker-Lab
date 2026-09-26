import { COL, circle, contact, legs, line, moduleBoard, path, pinRow, rect, relayCube, screwTerminals, silk, smd, sot23, statusLed, text, type Raw } from './kit';

export const SWITCHES: Raw[] = [
  {
    type: 'toggle-switch', name: 'Toggle switch (SPDT)', category: 'switches',
    description: 'Panel toggle switch: the middle pin (C) connects to 1 when the lever is down and 2 when up. Click it while simulating.',
    keywords: ['toggle', 'spdt', 'lever', 'panel switch', 'on off'],
    pins: pinRow(['1', 'C', '2'], { labels: { C: 'Common' } }),
    props: [{ key: 'on', label: 'Lever', type: 'select', default: 0, options: [{ value: 0, label: 'Down (C–1)' }, { value: 1, label: 'Up (C–2)' }] }],
    toggle: 'on',
    shapes: [
      ...legs(pinRow(['1', 'C', '2']), -8),
      rect(-7, -24, 34, 16, '#3a3d44', { rx: 2, grad: '#15171a', shadow: 1 }),
      path('M 10 -22.5 L 16.1 -19 L 16.1 -11 L 10 -7.5 L 3.9 -11 L 3.9 -19 Z', '#eef1f4', { grad: '#7f8891', gradDir: 'd', stroke: '#5f666e', strokeWidth: 0.4 }),
      circle(10, -15, 4.2, '#d5d9de', { grad: '#6f7881', gradDir: 'r' }),
    ],
    animations: [{ shape: rect(8.2, -38, 3.6, 23, '#f7f8fa', { rx: 1.8, grad: '#8a929b', gradDir: 'h', stroke: '#6b737c', strokeWidth: 0.4 }), rotate: 'on == 1 ? 25 : -25', cx: 10, cy: -15 }],
    model: { elements: [contact('S1', 'C', '1', 'on == 0'), contact('S2', 'C', '2', 'on == 1')] },
  },
  (() => {
    const top = pinRow(['1', '2', '3', '4', '5', '6', '7', '8'], { y: 0 });
    const bottom = pinRow(['1b', '2b', '3b', '4b', '5b', '6b', '7b', '8b'], { y: 30 });
    const props = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ key: `s${i}`, label: `Switch ${i}`, type: 'select', default: 0, options: [{ value: 0, label: 'Off' }, { value: 1, label: 'On' }] }));
    return {
      type: 'dip-switch', name: 'DIP switch (8-way)', category: 'switches',
      description: 'Eight tiny on/off switches in a DIP package (straddles the breadboard trench). Switch n connects pin n (top) to pin nb (bottom). Set them in the inspector.',
      keywords: ['dip switch', 'config', 'address', 'selector'],
      pins: [...top, ...bottom],
      props,
      shapes: [
        ...top.map((p) => rect(p.x - 1, 0, 2, 5, COL.metal, { grad: COL.metalDark, gradDir: 'h' })), ...bottom.map((p) => rect(p.x - 1, 25, 2, 5, COL.metal, { grad: COL.metalDark, gradDir: 'h' })),
        rect(-6, 4, 82, 22, '#e0453d', { rx: 1.5, grad: '#9e2721', shadow: 1 }),
        ...top.map((p) => rect(p.x - 3, 7.5, 6, 13.5, '#2a2c30', { rx: 0.8 })),
        text(-3, 8.2, 'ON', 2.4, '#fff', 'start', { weight: 700 }), ...top.map((p, i) => text(p.x, 24.4, String(i + 1), 2.6, '#fff', 'middle', { weight: 700 })),
      ],
      animations: top.map((p, i) => ({ shape: rect(p.x - 2.5, 14.5, 5, 6, '#f7f8fa', { rx: 0.6, grad: '#c5ccd4' }), dy: `s${i + 1} == 1 ? -6.5 : 0` })),
      model: { elements: top.map((p, i) => contact(`S${i + 1}`, p.id, `${i + 1}b`, `s${i + 1} == 1`)) },
    };
  })(),
  (() => {
    const b = moduleBoard(['GND', 'VCC', 'VRX', 'VRY', 'SW'], { h: 56, w: 60, color: '#23252a', holes: 'corners', labels: { VRX: 'X axis (analog)', VRY: 'Y axis (analog)', SW: 'Button (to GND when pressed)', VCC: '+5 V' } });
    return {
      type: 'joystick', name: 'Joystick module', category: 'switches',
      description: 'Two-axis thumb joystick (two 10 kΩ pots) with a push button. VRX/VRY sit at VCC/2 when centred. Drag the stick up/down on the canvas (Y) or set both axes in the inspector; press and hold without moving to click it.',
      keywords: ['joystick', 'thumbstick', 'ky-023', 'analog stick', 'gamepad'],
      pins: b.pins,
      props: [
        { key: 'x', label: 'X', type: 'slider', default: 0.5, min: 0, max: 1 },
        { key: 'y', label: 'Y', type: 'slider', default: 0.5, min: 0, max: 1 },
      ],
      interactive: 'press',
      drag: 'y',
      shapes: [
        ...b.shapes,
        rect(2, -52, 36, 36, '#e6eaee', { rx: 2, grad: '#7f8891', gradDir: 'd', shadow: 1, stroke: '#5f666e', strokeWidth: 0.5 }),
        rect(5, -49, 30, 30, '#1f2124', { rx: 1.5 }),
        rect(-6, -40, 8, 10, '#1f2226', { rx: 1 }), rect(38, -40, 8, 10, '#1f2226', { rx: 1 }),
        circle(20, -34, 13, '#2f3237', { stroke: '#44474d', strokeWidth: 0.6 }),
      ],
      animations: [
        { shape: circle(20, -34, 10.5, '#4d5158', { grad: '#16171a', gradDir: 'r', stroke: '#0c0d0f', strokeWidth: 0.6, shadow: 1 }), dx: '(x - 0.5) * 12', dy: '(0.5 - y) * 12' },
        { shape: circle(20, -34, 6.5, 'none', { stroke: '#5c6068', strokeWidth: 0.5 }), dx: '(x - 0.5) * 12', dy: '(0.5 - y) * 12' },
      ],
      model: {
        elements: [
          { id: 'RX1', kind: 'rvar', a: 'VCC', b: 'VRX', value: 'max(20, 10000 * (1 - x))' },
          { id: 'RX2', kind: 'rvar', a: 'VRX', b: 'GND', value: 'max(20, 10000 * x)' },
          { id: 'RY1', kind: 'rvar', a: 'VCC', b: 'VRY', value: 'max(20, 10000 * (1 - y))' },
          { id: 'RY2', kind: 'rvar', a: 'VRY', b: 'GND', value: 'max(20, 10000 * y)' },
          contact('BTN', 'SW', 'GND', 'pressed == 1'),
        ],
      },
    };
  })(),
  {
    type: 'rotary-switch', name: 'Rotary switch (1-pole 4-way)', category: 'switches',
    description: 'Selector switch: the common pin C connects to one of positions 1–4 (choose it in the inspector, even while simulating).',
    keywords: ['rotary switch', 'selector', 'band switch', 'mode'],
    pins: pinRow(['C', '1', '2', '3', '4'], { labels: { C: 'Common' } }),
    props: [{ key: 'pos', label: 'Position', type: 'select', default: 1, options: [1, 2, 3, 4].map((v) => ({ value: v, label: `Position ${v}` })) }],
    shapes: [
      ...legs(pinRow(['C', '1', '2', '3', '4']), -8),
      circle(20, -30, 23, '#f4f6f8', { grad: '#c5ccd4', shadow: 1, stroke: '#9aa3ad', strokeWidth: 0.5 }),
      ...[1, 2, 3, 4].map((i) => text(20 + 19.5 * Math.cos(((-150 + i * 60) * Math.PI) / 180), -30 + 19.5 * Math.sin(((-150 + i * 60) * Math.PI) / 180) + 1.6, String(i), 4.2, '#333', 'middle', { weight: 700 })),
      circle(20, -30, 15, '#4a4d53', { grad: '#141517', gradDir: 'r', shadow: 1 }),
      ...Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * 6.28318;
        return line(20 + Math.cos(a) * 13, -30 + Math.sin(a) * 13, 20 + Math.cos(a) * 15, -30 + Math.sin(a) * 15, '#26282c', 0.7);
      }),
    ],
    animations: [{ shape: rect(18.8, -43, 2.4, 11, '#f2f4f6', { rx: 1.2 }), rotate: '-90 + pos * 60', cx: 20, cy: -30 }],
    model: { elements: [1, 2, 3, 4].map((i) => contact(`S${i}`, 'C', String(i), `pos == ${i}`)) },
  },
];

export const RELAYS: Raw[] = [
  (() => {
    const coil = pinRow(['COIL1', 'COIL2'], { labels: { COIL1: 'Coil +', COIL2: 'Coil −' } });
    const sw = pinRow(['COM', 'NO', 'NC'], { x0: 30, labels: { COM: 'Common', NO: 'Normally open', NC: 'Normally closed' } });
    return {
      type: 'relay', name: 'Relay (5 V, SPDT)', category: 'switches',
      description: 'Electromechanical relay (SRD-05VDC): energise the 70 Ω coil with ~5 V (via a transistor — it needs 70 mA, and a flyback diode across the coil!) and COM switches from NC to NO. Contacts rated 10 A.',
      keywords: ['relay', 'srd-05vdc', 'spdt', 'coil', 'contactor'],
      pins: [...coil, ...sw],
      shapes: [...legs([...coil, ...sw], -6), ...relayCube(-8, -50, 66, 44, '#2463c9', ['SONGLE', 'SRD-05VDC-SL-C', '10A 250VAC  10A 30VDC'])],
      states: [{ name: 'on', init: 0, next: 'abs(v(COIL1, COIL2)) > 3.75 ? 1 : (abs(v(COIL1, COIL2)) < 1.2 ? 0 : on)' }],
      model: {
        nodes: ['CM'],
        elements: [
          { id: 'COIL', kind: 'resistor', a: 'COIL1', b: 'CM', value: 70 },
          { id: 'LC', kind: 'inductor', a: 'CM', b: 'COIL2', value: 0.05 },
          contact('KNO', 'COM', 'NO', 'on == 1'),
          contact('KNC', 'COM', 'NC', 'on == 0'),
        ],
      },
      warnings: [{ when: 'abs(i(KNO)) > 10 || abs(i(KNC)) > 10', level: 'error', message: 'Contact current above 10 A.' }],
      maxStep: 5e-4,
    };
  })(),
  (() => {
    const inp = pinRow(['IN+', 'IN-'], { kind: 'terminal', labels: { 'IN+': 'Control + (3–32 V)', 'IN-': 'Control −' } });
    const out = pinRow(['L1', 'L2'], { x0: 50, kind: 'terminal', labels: { L1: 'Load 1', L2: 'Load 2' } });
    return {
      type: 'ssr', name: 'Solid-state relay', category: 'switches',
      description: 'Solid-state relay (Fotek SSR-25 DA style): 3–32 V DC on the input turns the load side on — silent, no contacts. Drop ≈ 1 V when on.',
      keywords: ['ssr', 'solid state relay', 'fotek', 'triac'],
      pins: [...inp.map((p) => ({ ...p, id: p.id === 'IN+' ? 'INP' : 'INN' })), ...out],
      shapes: [
        rect(-12, -54, 84, 52, '#fbfbf8', { rx: 3, grad: '#d7d9d4', shadow: 1, stroke: '#a9aca5', strokeWidth: 0.5 }),
        rect(-7, -49, 74, 14, '#26282c', { rx: 1.5, grad: '#111214' }), text(30, -39.5, 'SSR-25 DA', 5.4, '#fff', 'middle', { weight: 800 }),
        text(30, -28.5, 'INPUT 3-32VDC · LOAD 24-380VAC', 2.6, '#444', 'middle', { weight: 600 }),
        text(5, -17, '3+   4−', 3.2, '#333', 'middle', { weight: 700 }), text(55, -17, '1   2', 3.2, '#333', 'middle', { weight: 700 }),
        ...screwTerminals(inp, '#b9bdb6'), ...screwTerminals(out, '#b9bdb6'),
      ],
      indicators: [{ shape: circle(30, -20, 2.2, '#ff3b30'), color: '#ff3b30', level: 'v(INP, INN) > 3 ? 1 : 0' }],
      model: {
        nodes: ['M'],
        elements: [
          { id: 'LED', kind: 'resistor', a: 'INP', b: 'INN', value: 1500 },
          contact('SW', 'L1', 'M', 'v(INP, INN) > 3'),
          { id: 'DROP', kind: 'rvar', a: 'M', b: 'L2', value: '0.1' },
        ],
      },
    };
  })(),
  (() => {
    const b = moduleBoard(['GND', 'VCC', 'IN'], { h: 64, w: 104, boardX: -12, color: '#1d5bb8', holes: 'corners', labels: { IN: 'IN (LOW = on)', VCC: '+5 V', GND: 'GND' } });
    const load = pinRow(['NO', 'COM', 'NC'], { x0: 60, kind: 'terminal', labels: { NO: 'Normally open', COM: 'Common', NC: 'Normally closed' } });
    const led = statusLed(30, -50, '#ff3b30', 'on');
    return {
      type: 'relay-module', name: 'Relay driver module', category: 'switches',
      description: '1-channel relay board: transistor driver, flyback diode and LED already fitted. Active-LOW input (pull IN to GND to switch). Screw terminals NO / COM / NC.',
      keywords: ['relay module', 'relay board', 'relay driver', 'songle', 'optocoupler'],
      pins: [...b.pins, ...load],
      shapes: [
        ...b.shapes,
        ...relayCube(40, -60, 52, 38),
        ...sot23(18, -38, '1AM'), ...smd(8, -38, 'r', true), ...smd(28, -38, 'r', true),
        rect(4, -28, 14, 4.5, '#2a2b2e', { rx: 1.5 }), rect(15, -28, 2, 4.5, '#d9d9d9'),
        ...smd(26, -26, 'c'), silk(12, -46, '1 Relay Module', 2.8),
        led.shape, ...screwTerminals(load),
        silk(60, -14.5, 'NO', 2.6), silk(70, -14.5, 'COM', 2.6), silk(80, -14.5, 'NC', 2.6),
      ],
      indicators: [led.indicator],
      states: [{ name: 'on', init: 0, next: '(v(VCC, GND) > 4 && v(IN, GND) < 1.5) ? 1 : 0' }],
      model: {
        elements: [
          { id: 'PU', kind: 'resistor', a: 'VCC', b: 'IN', value: 1000 },
          { id: 'COIL', kind: 'rvar', a: 'VCC', b: 'GND', value: 'on == 1 ? 70 : 1e6' },
          contact('KNO', 'COM', 'NO', 'on == 1'),
          contact('KNC', 'COM', 'NC', 'on == 0'),
        ],
      },
    };
  })(),
];
