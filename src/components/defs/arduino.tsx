import type { ComponentDef, PinDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import type { Source } from '../../sim/solver';
import { Label, SLine, SText, formatSI } from '../util';

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

/** Runtime pin index for a header pin id, or -1. */
export function unoPinIndex(id: string): number {
  if (/^D\d+$/.test(id)) return Number(id.slice(1));
  if (/^A\d$/.test(id)) return 14 + Number(id.slice(1));
  return -1;
}

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
        <rect key={i} x={a - 5} y={y - 5} width={b - a + 10} height={10} rx={1} fill="#1b1c1f" />
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
  defaultProps: { code: BLINK_SKETCH },
  mcu: { defaultCode: BLINK_SKETCH },
  thumbScale: 1,
  summary: () => 'ATmega328P · 16 MHz',
  render: ({ sim }) => {
    const running = !!sim;
    return (
      <g>
        <path d="M0 6 Q0 0 6 0 L262 0 L270 8 L280 8 L280 204 Q280 210 274 210 L6 210 Q0 210 0 204 Z" fill="#008f95" stroke="#006a6f" strokeWidth={1.2} />
        <path d="M4 10 L276 10" stroke="#00a4ab" strokeWidth={0.6} />
        {/* mounting holes */}
        {[[15, 190], [265, 190], [80, 30], [250, 45]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill="#f4f2ec" stroke="#c9c3a8" strokeWidth={1.5} />
        ))}
        {/* USB-B and barrel jack */}
        <rect x={-14} y={26} width={46} height={40} rx={2} fill="#c6ccd2" stroke="#8d949c" strokeWidth={1} />
        <rect x={-10} y={32} width={30} height={28} rx={1} fill="#aab1b9" />
        <rect x={-10} y={140} width={42} height={34} rx={3} fill="#1d1e21" />
        <circle cx={6} cy={157} r={6} fill="#333" />
        {/* reset button */}
        <rect x={42} y={16} width={16} height={16} rx={2} fill="#c6ccd2" />
        <circle cx={50} cy={24} r={5} fill="#d93b30" />
        <Label x={50} y={42} size={4.4} fill="#e8f3f3">RESET</Label>
        {/* MCU chip */}
        <rect x={120} y={126} width={140} height={30} rx={2} fill="#1d1e21" />
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i}>
            <rect x={124 + i * 9.6} y={122} width={4} height={5} fill="#c9ced4" />
            <rect x={124 + i * 9.6} y={155} width={4} height={5} fill="#c9ced4" />
          </g>
        ))}
        <circle cx={126} cy={141} r={3} fill="#2c2d31" />
        <Label x={190} y={143} size={6} fill="#9aa0a8">ATMEGA328P</Label>
        {/* crystal */}
        <rect x={80} y={90} width={24} height={10} rx={5} fill="#c9ced4" stroke="#8d949c" strokeWidth={0.6} />
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
  build: (b) => {
    const mcu = b.mcu;
    b.markGround('GND1');
    const five = b.source('5V', 'GND1', 5, 0.05);
    const three = b.source('3V3', 'GND1', 3.3, 0.5);
    const drivers: { pin: number; id: string; src: Source; cur: Avg }[] = [];
    for (const [id] of [...TOP, ...BOTTOM]) {
      const idx = unoPinIndex(id);
      if (idx < 0 || !b.connected(id)) continue;
      drivers.push({ pin: idx, id, src: b.source(id, 'GND1', 0, 1e8), cur: new Avg() });
    }
    const fiveCur = new Avg();
    const threeCur = new Avg();
    let warn: SimWarning[] = [];
    return {
      beforeStep(t, h) {
        if (!mcu) return;
        for (const d of drivers) {
          const dr = mcu.drive(d.pin, t, h);
          d.src.volts = dr.volts;
          d.src.r = dr.r;
        }
      },
      afterStep(v, h) {
        const g = b.volt('GND1');
        for (const d of drivers) {
          const out = -d.src.currents(v)[0];
          d.cur.add(out, h);
          if (mcu) mcu.pins[d.pin].volts = b.volt(d.id) - g;
        }
        fiveCur.add(-five.currents(v)[0], h);
        threeCur.add(-three.currents(v)[0], h);
      },
      maxStep: () => (mcu?.needsFineSteps ? 2e-4 : 1e-3),
      frame() {
        warn = [];
        const pinCurrents: Record<string, number> = {};
        for (const d of drivers) {
          const i = d.cur.take();
          pinCurrents[d.id] = i;
          if (Math.abs(i) > 0.04) {
            warn.push({ level: 'error', message: `Pin ${d.id} overloaded: ${formatSI(Math.abs(i), 'A')} (max 40 mA). Add a resistor or drive the load through a transistor.` });
          }
        }
        const i5 = fiveCur.take();
        const i3 = threeCur.take();
        if (i5 > 0.9) warn.push({ level: 'error', message: `Short circuit on 5V: ${formatSI(i5, 'A')} drawn from the supply.` });
        else if (i5 > 0.45) warn.push({ level: 'warn', message: `5V pin supplying ${formatSI(i5, 'A')} — close to the USB limit (500 mA).` });
        if (i3 > 0.15) warn.push({ level: 'error', message: `3.3V pin overloaded: ${formatSI(i3, 'A')} (max 150 mA).` });
        if (mcu?.error) warn.push({ level: 'error', message: `${mcu.error.kind === 'compile' ? 'Compile error' : 'Runtime error'}: ${mcu.error.message}` });
        const p13 = mcu?.pins[13];
        const l = p13 ? p13.mode === 'output' && (p13.pwm !== null ? p13.pwm > 0.1 : p13.value === 1) : false;
        return {
          l,
          tx: mcu ? mcu.t - mcu.lastSerialAt < 60000 : false,
          error: mcu?.error ? mcu.error.message : undefined,
          pinCurrents,
          time: mcu ? mcu.t / 1e6 : 0,
        };
      },
      warnings: () => warn,
    };
  },
};
