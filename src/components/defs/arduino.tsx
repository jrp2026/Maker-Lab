import type { ComponentDef, PinDef } from '../types';
import { Label, SLine, SText } from '../util';
import { UNO } from '../../mcu/boards';
import { buildBoard, USB_FIELD, usbPlugged } from './board';
import { UsbCable } from './usbCable';
import { Shapes } from '../../ai/customPart';
import type { PartShape } from '../../ai/spec';
import { chip, circle, crystalCan, ecap, epoxy, mountHole, path, rect, shade, COL } from '../../parts/kit';

/** The Uno's physical parts, drawn with the part kit (gradients, packages). */
const UNO_ART = [
  path('M0 6 Q0 0 6 0 L262 0 L270 8 L280 8 L280 204 Q280 210 274 210 L6 210 Q0 210 0 204 Z', '#0aa0a6', { grad: '#007a80', gradDir: 'd', stroke: '#005c61', strokeWidth: 1.1, shadow: 1 }),
  ...[[15, 190], [265, 190], [80, 30], [250, 45]].flatMap(([x, y]) => mountHole(x, y, 4)),
  // USB-B socket and the DC barrel jack
  rect(-14, 26, 46, 40, '#eef1f4', { rx: 2, grad: '#7f8891', stroke: '#5f666e', strokeWidth: 0.8, shadow: 1 }),
  rect(-10, 32, 30, 28, '#c9ced4', { rx: 1, grad: '#9aa2ab', gradDir: 'h' }), rect(-6, 40, 22, 12, '#3a3d42', { rx: 1 }),
  rect(-10, 140, 42, 34, '#3a3c41', { rx: 3, grad: '#111214', shadow: 1 }), circle(6, 157, 7, '#0c0d0f', { stroke: '#4a4d53', strokeWidth: 1 }), circle(6, 157, 2, '#c9ced4'),
  // reset button, USB chip, crystal, supply caps and the 5 V regulator
  rect(42, 16, 16, 16, '#eef1f4', { rx: 1.5, grad: '#7f8891', gradDir: 'd', shadow: 0.9 }), circle(50, 24, 5, '#e0453d', { grad: '#8f1f1a', gradDir: 'r' }),
  ...chip(42, 62, 14, 14, { legs: 'qfp', n: 5, label: '16U2' }),
  ...crystalCan(80, 90, 24, 10, '16.000'),
  ...ecap(48, 152, 7), ...ecap(66, 152, 7),
  rect(56, 168, 12, 3, COL.metal), ...chip(52, 171, 20, 12, { legs: 'none', label: 'NCP1117' }),
  // the ATmega328P in its DIP socket
  rect(116, 119, 148, 44, '#2a2b2f', { rx: 1.5, grad: '#141517', shadow: 0.8 }),
  ...Array.from({ length: 14 }, (_, i) => [rect(124 + i * 9.6, 121, 4, 6, COL.metal, { grad: COL.metalDark, gradDir: 'h' }), rect(124 + i * 9.6, 154, 4, 6, COL.metal, { grad: COL.metalDark, gradDir: 'h' })]).flat(),
  ...epoxy(120, 126, 140, 30, '#26282c', 1.4),
  path('M 120 137 A 4 4 0 0 1 120 145 Z', '#0c0d0f'), circle(126, 150, 1.8, '#1b1c1f', { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 0.4 }),
  // ICSP header by the chip
  rect(264, 110, 12, 22, '#2a2b2f', { rx: 0.8, grad: '#111214', shadow: 0.8 }),
  ...[0, 1, 2].flatMap((r) => [rect(265.8, 112.5 + r * 7, 3, 3, '#e3c25e', { grad: '#9c7b26', gradDir: 'd' }), rect(271.2, 112.5 + r * 7, 3, 3, '#e3c25e', { grad: '#9c7b26', gradDir: 'd' })]),
] as unknown as PartShape[];

const SOCKET = shade('#1b1c1f', 0.08);

export const BLINK_SKETCH = `// Blink: toggles the on-board LED (pin 13) once per second.
// Wire an LED + 220 Ω resistor from pin 13 to GND to see it on the breadboard too.

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Hello from the simulator!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`;

const TOP_Y = 10, BOT_Y = 200;
const TOP: [string, number, string][] = [
  ['SCL', 90, 'SCL'], ['SDA', 100, 'SDA'], ['AREF', 110, 'AREF'], ['GND3', 120, 'GND'],
  ['D13', 130, '13'], ['D12', 140, '12'], ['D11', 150, '~11'], ['D10', 160, '~10'], ['D9', 170, '~9'], ['D8', 180, '8'],
  ['D7', 200, '7'], ['D6', 210, '~6'], ['D5', 220, '~5'], ['D4', 230, '4'], ['D3', 240, '~3'], ['D2', 250, '2'], ['D1', 260, 'TX→1'], ['D0', 270, 'RX←0'],
];
const BOTTOM: [string, number, string][] = [
  ['NC', 110, ''], ['IOREF', 120, 'IOREF'], ['RESET', 130, 'RESET'], ['3V3', 140, '3.3V'], ['5V', 150, '5V'], ['GND1', 160, 'GND'], ['GND2', 170, 'GND'], ['VIN', 180, 'Vin'],
  ['A0', 200, 'A0'], ['A1', 210, 'A1'], ['A2', 220, 'A2'], ['A3', 230, 'A3'], ['A4', 240, 'A4'], ['A5', 250, 'A5'],
];

const PIN_LABELS: Record<string, string> = {
  GND1: 'GND', GND2: 'GND', GND3: 'GND', '3V3': '3.3V', '5V': '5V', VIN: 'Vin', NC: 'not connected',
};

const PINS: PinDef[] = [
  ...TOP.map(([id, x]) => ({ id, x, y: TOP_Y, kind: 'socket' as const, label: PIN_LABELS[id] ?? (id.startsWith('D') ? `Digital pin ${id.slice(1)}` : id) })),
  ...BOTTOM.map(([id, x]) => ({ id, x, y: BOT_Y, kind: 'socket' as const, label: PIN_LABELS[id] ?? (id.startsWith('A') ? `Analog pin ${id}` : id) })),
];


function Header({ pins, y }: { pins: [string, number, string][]; y: number }) {
  // group contiguous runs into black header strips
  const runs: [number, number][] = [];
  for (const [, x] of pins) {
    const last = runs[runs.length - 1];
    if (last && x - last[1] === 10) last[1] = x;
    else runs.push([x, x]);
  }
  return (
    <g>
      {runs.map(([a, b], i) => (
        <g key={i}>
          <rect x={a - 4.2} y={y - 3.6} width={b - a + 10} height={10} rx={1} fill="#000" opacity={0.25} />
          <rect x={a - 5} y={y - 5} width={b - a + 10} height={10} rx={1} fill={SOCKET} stroke="#0c0d0f" strokeWidth={0.4} />
          <rect x={a - 4.4} y={y - 4.4} width={b - a + 8.8} height={1.4} rx={0.6} fill="#fff" opacity={0.08} />
        </g>
      ))}
      {pins.map(([id, x]) => (
        <rect key={id} x={x - 2.2} y={y - 2.2} width={4.4} height={4.4} fill="#050506" stroke="#3a3c41" strokeWidth={0.4} />
      ))}
    </g>
  );
}

function BoardLed({ x, y, color, on, label }: { x: number; y: number; color: string; on: boolean; label: string }) {
  return (
    <g>
      {on && <circle cx={x} cy={y} r={6} fill={color} opacity={0.45} style={{ filter: 'blur(2px)' }} />}
      <rect x={x - 2.5} y={y - 1.6} width={5} height={3.2} rx={0.6} fill={on ? color : '#e9e4d0'} stroke="#8a8a7a" strokeWidth={0.3} />
      <Label x={x + 5} y={y + 1.8} size={4.2} fill="#e8f3f3" anchor="start">{label}</Label>
    </g>
  );
}

export const arduinoUno: ComponentDef = {
  type: 'arduino-uno',
  name: 'Arduino Uno R3',
  category: 'mcu',
  description: 'ATmega328P board: 14 digital I/O (6 PWM ~), 6 analog inputs, 5 V & 3.3 V supply pins. Program it in the Code panel.',
  keywords: ['arduino', 'uno', 'microcontroller', 'atmega328p', 'mcu', 'board'],
  bounds: { x: -14, y: 0, w: 294, h: 210 },
  pins: () => PINS,
  internalConnections: () => [['GND1', 'GND2', 'GND3'], ['A4', 'SDA'], ['A5', 'SCL']],
  defaultProps: { code: BLINK_SKETCH, usb: 0 },
  fields: [USB_FIELD],
  mcu: { defaultCode: BLINK_SKETCH, board: UNO },
  thumbScale: 1,
  summary: () => 'ATmega328P · 16 MHz',
  render: ({ sim, props }) => {
    const running = !!sim && !sim.off;
    return (
      <g>
        {usbPlugged(props) && <UsbCable x={-14} y={46} side="left" size={22} />}
        <Shapes shapes={UNO_ART} />
        <Label x={50} y={42} size={4.4} fill="#e8f3f3">RESET</Label>
        <Label x={190} y={143} size={5.6} fill="#b9bdc3" weight={500}>ATMEGA328P-PU</Label>
        {/* branding */}
        <Label x={150} y={82} size={16} fill="#ffffff" weight={800}>UNO</Label>
        <Label x={210} y={82} size={8} fill="#e8f3f3" weight={700}>ARDUINO</Label>
        <circle cx={200} cy={100} r={9} fill="none" stroke="#fff" strokeWidth={1.8} />
        <Label x={200} y={103} size={9} fill="#fff" weight={800}>∞</Label>
        <Label x={235} y={30} size={5} fill="#e8f3f3">DIGITAL (PWM ~)</Label>
        <Label x={225} y={186} size={5} fill="#e8f3f3">ANALOG IN</Label>
        <Label x={145} y={186} size={5} fill="#e8f3f3">POWER</Label>
        {/* pin labels */}
        {TOP.map(([id, x, t]) => (
          <text key={id} x={x + 1.5} y={TOP_Y + 9} fontSize={4.2} fill="#e8f3f3" transform={`rotate(90 ${x + 1.5} ${TOP_Y + 9})`} fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
            {t}
          </text>
        ))}
        {BOTTOM.map(([id, x, t]) => (
          <text key={id} x={x + 1.5} y={BOT_Y - 8} fontSize={4.2} fill="#e8f3f3" transform={`rotate(-90 ${x + 1.5} ${BOT_Y - 8})`} fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
            {t}
          </text>
        ))}
        <Header pins={TOP} y={TOP_Y} />
        <Header pins={BOTTOM} y={BOT_Y} />
        <BoardLed x={122} y={40} color="#ffb020" on={!!sim?.l} label="L" />
        <BoardLed x={122} y={50} color="#ffb020" on={!!sim?.tx} label="TX" />
        <BoardLed x={122} y={60} color="#ffb020" on={false} label="RX" />
        <BoardLed x={250} y={62} color="#5cff6a" on={running} label="ON" />
        {sim?.error && (
          <g>
            <rect x={60} y={100} width={160} height={18} rx={4} fill="#fff4f2" stroke="#e25b45" />
            <Label x={140} y={112} size={6} fill="#c0392b">⚠ {String(sim.error).slice(0, 40)}</Label>
          </g>
        )}
      </g>
    );
  },
  schematic: () => (
    <g>
      <rect x={60} y={24} width={220} height={162} rx={4} fill="#fff" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={170} y={100} size={12}>ARDUINO UNO</SText>
      <SText x={170} y={114} size={7}>ATmega328P</SText>
      {TOP.map(([id, x, t]) => (
        <g key={id}>
          <SLine pts={[[x, TOP_Y], [x, 24]]} />
          <text x={x + 1.8} y={30} fontSize={4.5} fill="#1f3a5f" transform={`rotate(90 ${x + 1.8} 30)`} fontFamily="monospace">{t}</text>
        </g>
      ))}
      {BOTTOM.filter(([id]) => id !== 'NC').map(([id, x, t]) => (
        <g key={id}>
          <SLine pts={[[x, BOT_Y], [x, 186]]} />
          <text x={x + 1.8} y={180} fontSize={4.5} fill="#1f3a5f" transform={`rotate(-90 ${x + 1.8} 180)`} fontFamily="monospace">{t}</text>
        </g>
      ))}
    </g>
  ),
  build: (b, comp) =>
    buildBoard(b, UNO, [...TOP, ...BOTTOM].map(([id]) => id), 'GND1', [
      { pin: '5V', volts: 5, r: 0.05, warn: 0.45, short: 0.9 },
      { pin: '3V3', volts: 3.3, r: 0.5, warn: 0.1, short: 0.15 },
    ], undefined, usbPlugged(comp.props)),
};
