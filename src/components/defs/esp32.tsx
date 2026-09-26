import type { ComponentDef, PinDef } from '../types';
import { DropShadow, Label, PinTip, SLine, SText, Sheen } from '../util';
import { ESP32 } from '../../mcu/boards';
import { buildBoard } from './board';

export const ESP32_BLINK = `// ESP32 blink + fade: GPIO2 is the blue on-board LED.
// ESP32 pins are 3.3 V; analogRead() returns 0–4095.
const int LED = 2;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  Serial.println("ESP32 ready");
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`;

// Board held antenna-left, USB-right, labels up (DOIT DevKit V1, 30 pins).
const TOP = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND2', '3V3'];
const BOTTOM = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND1', 'VIN'];
const X0 = 20, TOP_Y = 0, BOT_Y = 100;

const LABEL: Record<string, string> = {
  GND1: 'GND', GND2: 'GND', '3V3': '3.3 V out', VIN: 'VIN (5 V from USB)', EN: 'EN (reset)',
  VP: 'GPIO36 / VP (input only, ADC)', VN: 'GPIO39 / VN (input only, ADC)', TX0: 'GPIO1 / TX0', RX0: 'GPIO3 / RX0', TX2: 'GPIO17 / TX2', RX2: 'GPIO16 / RX2',
  D34: 'GPIO34 (input only, ADC)', D35: 'GPIO35 (input only, ADC)', D21: 'GPIO21 / SDA', D22: 'GPIO22 / SCL', D25: 'GPIO25 / DAC1', D26: 'GPIO26 / DAC2', D2: 'GPIO2 / on-board LED',
};

const PINS: PinDef[] = [
  ...TOP.map((id, i) => ({ id, x: X0 + i * 10, y: TOP_Y, kind: 'lead' as const, label: LABEL[id] ?? `GPIO${id.slice(1)}` })),
  ...BOTTOM.map((id, i) => ({ id, x: X0 + i * 10, y: BOT_Y, kind: 'lead' as const, label: LABEL[id] ?? `GPIO${id.slice(1)}` })),
];

const short = (id: string) => (id.startsWith('GND') ? 'GND' : id);

export const esp32: ComponentDef = {
  type: 'esp32-devkit',
  name: 'ESP32 DevKit V1',
  category: 'mcu',
  description: 'ESP32-WROOM-32 dev board (30 pins, 3.3 V logic). 12-bit ADC, PWM on any output pin (analogWrite or ledc), DAC on GPIO25/26, interrupts on any pin, I2C on GPIO21 (SDA) / GPIO22 (SCL). The pins plug into a breadboard across rows a and i.',
  keywords: ['esp32', 'espressif', 'devkit', 'wroom', 'microcontroller', 'wifi', 'bluetooth', 'board', 'mcu'],
  bounds: { x: -30, y: -6, w: 204, h: 112 },
  pins: () => PINS,
  internalConnections: () => [['GND1', 'GND2']],
  defaultProps: { code: ESP32_BLINK },
  mcu: { defaultCode: ESP32_BLINK, board: ESP32 },
  summary: () => 'Dual-core 240 MHz · 3.3 V',
  render: ({ sim }) => {
    const running = !!sim;
    return (
      <g>
        <DropShadow x={-30} y={4} w={204} h={92} rx={5} />
        <rect x={-30} y={4} width={204} height={92} rx={5} fill="#23252a" stroke="#101114" strokeWidth={1} />
        <Sheen x={-30} y={4} w={204} h={92} rx={5} />
        {/* WROOM module: shield + antenna */}
        <rect x={-26} y={16} width={104} height={68} rx={2} fill="#1b1d22" />
        <DropShadow x={-6} y={20} w={80} h={60} rx={2} />
        <rect x={-6} y={20} width={80} height={60} rx={2} fill="#d3d8dd" stroke="#8a929b" strokeWidth={0.8} />
        <Sheen x={-6} y={20} w={80} h={60} rx={2} metal />
        <path d="M-22 24 h12 v8 h-12 v8 h12 v8 h-12 v8 h12 v8 h-12 v8" fill="none" stroke="#c9a13b" strokeWidth={1.4} />
        <Label x={34} y={46} size={7} fill="#4a5058" weight={800}>ESP32</Label>
        <Label x={34} y={56} size={5} fill="#5b626b">WROOM-32</Label>
        <Label x={34} y={66} size={3.8} fill="#6d747c">ESPRESSIF</Label>
        {/* USB + buttons */}
        <DropShadow x={160} y={38} w={20} h={24} rx={2} />
        <rect x={160} y={38} width={20} height={24} rx={2} fill="#d3d8dd" stroke="#6d757e" strokeWidth={0.8} />
        <Sheen x={160} y={38} w={20} h={24} rx={2} metal />
        <rect x={128} y={20} width={12} height={9} rx={1.5} fill="#e5e7ea" />
        <circle cx={134} cy={24.5} r={2.6} fill="#2b2d31" />
        <Label x={134} y={36} size={3.8} fill="#cfd3d8">EN</Label>
        <rect x={128} y={70} width={12} height={9} rx={1.5} fill="#e5e7ea" />
        <circle cx={134} cy={74.5} r={2.6} fill="#2b2d31" />
        <Label x={134} y={67} size={3.8} fill="#cfd3d8">BOOT</Label>
        <rect x={96} y={34} width={22} height={30} rx={1.5} fill="#15161a" />
        <Sheen x={96} y={34} w={22} h={30} rx={1.5} strength={0.6} />
        {/* LEDs: red power, blue GPIO2 */}
        {running && <circle cx={150} cy={42} r={5} fill="#ff3b30" opacity={0.45} style={{ filter: 'blur(2px)' }} />}
        <rect x={147.5} y={40.5} width={5} height={3} rx={0.6} fill={running ? '#ff5a4f' : '#e9e4d0'} />
        {sim?.l && <circle cx={150} cy={56} r={6} fill="#3d8bff" opacity={0.55} style={{ filter: 'blur(2px)' }} />}
        <rect x={147.5} y={54.5} width={5} height={3} rx={0.6} fill={sim?.l ? '#6fb0ff' : '#e9e4d0'} />
        {/* header strips + labels */}
        <rect x={X0 - 5} y={TOP_Y - 5} width={150} height={10} rx={1} fill="#111" />
        <rect x={X0 - 5} y={BOT_Y - 5} width={150} height={10} rx={1} fill="#111" />
        {TOP.map((id, i) => (
          <text key={id} x={X0 + i * 10 + 1.4} y={TOP_Y + 8} fontSize={3.5} fill="#e8eaed" transform={`rotate(90 ${X0 + i * 10 + 1.4} ${TOP_Y + 8})`} fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
            {short(id)}
          </text>
        ))}
        {BOTTOM.map((id, i) => (
          <text key={id} x={X0 + i * 10 + 1.4} y={BOT_Y - 8} fontSize={3.5} fill="#e8eaed" transform={`rotate(-90 ${X0 + i * 10 + 1.4} ${BOT_Y - 8})`} fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
            {short(id)}
          </text>
        ))}
        {PINS.map((p) => <PinTip key={p.id} x={p.x} y={p.y} />)}
        {sim?.error && (
          <g>
            <rect x={0} y={40} width={120} height={16} rx={3} fill="#fff4f2" stroke="#e25b45" />
            <Label x={60} y={51} size={5.5} fill="#c0392b">⚠ {String(sim.error).slice(0, 32)}</Label>
          </g>
        )}
      </g>
    );
  },
  schematic: () => (
    <g>
      <rect x={10} y={14} width={160} height={72} rx={4} fill="#fff" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={90} y={50} size={11}>ESP32 DevKit</SText>
      {TOP.map((id, i) => (
        <g key={id}>
          <SLine pts={[[X0 + i * 10, TOP_Y], [X0 + i * 10, 14]]} />
          <text x={X0 + i * 10 + 1.6} y={19} fontSize={3.8} fill="#1f3a5f" transform={`rotate(90 ${X0 + i * 10 + 1.6} 19)`} fontFamily="monospace">{short(id)}</text>
        </g>
      ))}
      {BOTTOM.map((id, i) => (
        <g key={id}>
          <SLine pts={[[X0 + i * 10, BOT_Y], [X0 + i * 10, 86]]} />
          <text x={X0 + i * 10 + 1.6} y={81} fontSize={3.8} fill="#1f3a5f" transform={`rotate(-90 ${X0 + i * 10 + 1.6} 81)`} fontFamily="monospace">{short(id)}</text>
        </g>
      ))}
    </g>
  ),
  build: (b) =>
    buildBoard(b, ESP32, [...TOP, ...BOTTOM], 'GND1', [
      { pin: '3V3', volts: 3.3, r: 0.3, warn: 0.4, short: 0.8 },
      { pin: 'VIN', volts: 4.7, r: 0.5, warn: 0.45, short: 1 },
    ]),
};
