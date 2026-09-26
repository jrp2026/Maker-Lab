import { COL, circle, contact, legs, line, moduleBoard, pinRow, rect, screwTerminals, statusLed, text, type Raw } from './kit';

export const SWITCHES: Raw[] = [
  {
    type: 'toggle-switch', name: 'Toggle switch (SPDT)', category: 'switches',
    description: 'Panel toggle switch: the middle pin (C) connects to 1 when the lever is down and 2 when up. Click it while simulating.',
    keywords: ['toggle', 'spdt', 'lever', 'panel switch', 'on off'],
    pins: pinRow(['1', 'C', '2'], { labels: { C: 'Common' } }),
    props: [{ key: 'on', label: 'Lever', type: 'select', default: 0, options: [{ value: 0, label: 'Down (C–1)' }, { value: 1, label: 'Up (C–2)' }] }],
    toggle: 'on',
    shapes: [...legs(pinRow(['1', 'C', '2']), -8), rect(-6, -22, 32, 14, '#2f3237', { rx: 2 }), circle(10, -15, 6, '#b8bec6', { stroke: '#7d858e', strokeWidth: 0.6 })],
    animations: [{ shape: rect(8, -38, 4, 22, '#dfe3e8', { rx: 2, stroke: '#9aa3ad', strokeWidth: 0.5 }), rotate: 'on == 1 ? 25 : -25', cx: 10, cy: -15 }],
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
      shapes: [...top.map((p) => line(p.x, 0, p.x, 5, COL.metal, 2.2)), ...bottom.map((p) => line(p.x, 25, p.x, 30, COL.metal, 2.2)), rect(-6, 4, 82, 22, '#c0392b', { rx: 1.5 }), ...top.map((p) => rect(p.x - 3, 8, 6, 14, '#fff', { rx: 1 })), text(35, 29, 'ON  1 2 3 4 5 6 7 8', 3, '#fff')],
      animations: top.map((p, i) => ({ shape: rect(p.x - 2.5, 16, 5, 5, '#39424c', { rx: 0.8 }), dy: `s${i + 1} == 1 ? -7 : 0` })),
      model: { elements: top.map((p, i) => contact(`S${i + 1}`, p.id, `${i + 1}b`, `s${i + 1} == 1`)) },
    };
  })(),
  (() => {
    const b = moduleBoard(['GND', 'VCC', 'VRX', 'VRY', 'SW'], { h: 56, color: '#262a30', title: 'JOYSTICK', labels: { VRX: 'X axis (analog)', VRY: 'Y axis (analog)', SW: 'Button (to GND when pressed)', VCC: '+5 V' } });
    return {
      type: 'joystick', name: 'Joystick module', category: 'switches',
      description: 'Two-axis thumb joystick (two 10 kΩ pots) with a push button. VRX/VRY sit at VCC/2 when centred. Move the axes in the inspector; press on the canvas to click the stick.',
      keywords: ['joystick', 'thumbstick', 'ky-023', 'analog stick', 'gamepad'],
      pins: b.pins,
      props: [
        { key: 'x', label: 'X', type: 'slider', default: 0.5, min: 0, max: 1 },
        { key: 'y', label: 'Y', type: 'slider', default: 0.5, min: 0, max: 1 },
      ],
      interactive: 'press',
      drag: 'y',
      shapes: [...b.shapes, circle(20, -34, 18, '#3a3e44'), circle(20, -34, 15, '#2b2d31')],
      animations: [{ shape: circle(20, -34, 10, '#4b4f56', { stroke: '#666', strokeWidth: 1 }), dx: '(x - 0.5) * 12', dy: '(0.5 - y) * 12' }],
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
    shapes: [...legs(pinRow(['C', '1', '2', '3', '4']), -8), circle(20, -30, 22, '#2f3237'), circle(20, -30, 16, '#3c4047'), ...[1, 2, 3, 4].map((i) => text(20 + 19 * Math.cos(((-150 + i * 60) * Math.PI) / 180), -30 + 19 * Math.sin(((-150 + i * 60) * Math.PI) / 180) + 2, String(i), 4.5, '#ddd'))],
    animations: [{ shape: rect(18.5, -44, 3, 14, '#f2f4f6', { rx: 1.5 }), rotate: '-90 + pos * 60', cx: 20, cy: -30 }],
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
      shapes: [...legs([...coil, ...sw], -6), rect(-8, -48, 66, 42, '#2f6fd6', { rx: 2, stroke: '#1f4f9f', strokeWidth: 0.8 }), text(25, -34, 'SRD-05VDC-SL-C', 4, '#fff'), text(25, -24, '10A 250VAC', 3.6, '#d8e4ff')],
      states: [{ name: 'on', init: 0, next: 'abs(v(COIL1, COIL2)) > 3.75 ? 1 : (abs(v(COIL1, COIL2)) < 1.2 ? 0 : on)' }],
      animations: [{ shape: rect(40, -14, 16, 4, '#f2c230', { rx: 1 }), dx: 'on == 1 ? -4 : 0' }],
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
      shapes: [rect(-10, -50, 80, 44, '#f4f2ec', { rx: 3, stroke: '#9aa3ad', strokeWidth: 0.8 }), rect(-6, -46, 72, 12, '#1f2226', { rx: 1 }), text(30, -38, 'SSR-25DA', 5, '#fff'), text(5, -12, '+  −', 5, '#333'), text(55, -12, 'LOAD', 4, '#333'), ...screwTerminals([...inp.map((p) => ({ ...p })), ...out])],
      indicators: [{ shape: circle(30, -26, 2.5, '#ff3b30'), color: '#ff3b30', level: 'v(INP, INN) > 3 ? 1 : 0' }],
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
    const b = moduleBoard(['GND', 'VCC', 'IN'], { h: 60, w: 110, color: '#1f5fbf', labels: { IN: 'IN (LOW = on)', VCC: '+5 V', GND: 'GND' } });
    const load = pinRow(['NO', 'COM', 'NC'], { x0: 60, kind: 'terminal', labels: { NO: 'Normally open', COM: 'Common', NC: 'Normally closed' } });
    const led = statusLed(30, -50, '#ff3b30', 'on');
    return {
      type: 'relay-module', name: 'Relay driver module', category: 'switches',
      description: '1-channel relay board: transistor driver, flyback diode and LED already fitted. Active-LOW input (pull IN to GND to switch). Screw terminals NO / COM / NC.',
      keywords: ['relay module', 'relay board', 'relay driver', 'songle', 'optocoupler'],
      pins: [...b.pins, ...load],
      shapes: [...b.shapes, rect(46, -58, 46, 30, '#2f6fd6', { rx: 1.5 }), text(69, -44, 'SRD-05VDC', 3.8, '#fff'), led.shape, ...screwTerminals(load)],
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
