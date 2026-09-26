/**
 * The rest of the programmable boards and bare microcontroller chips, drawn by one generic
 * renderer: a PCB (or DIP package) with labelled header rows.
 */
import type { ReactNode } from 'react';
import type { ComponentDef, PinDef } from '../types';
import { Label, PinTip, SLine, SText } from '../util';
import { ATMEGA328P, ATTINY85, BLUEPILL, ESP8266, GENERIC_MCU, MEGA, MICRO, NANO, PIC16F877A, PICO, PICO_W, TEENSY40, type BoardSpec } from '../../mcu/boards';
import { buildBoard, type SupplyPin } from './board';
import { Shapes } from '../../ai/customPart';
import type { PartShape } from '../../ai/spec';
import { COL, chip as chipArt, circle, epoxy, header as headerArt, pcb, rect, shade, text } from '../../parts/kit';

type Art = Record<string, any>[];

/** The static artwork of a board or bare chip, built from the part kit (gradients, headers, packages). */
function boardArt(c: BoardCfg, pins: PinDef[]): PartShape[] {
  return boardShapes(c, pins) as unknown as PartShape[];
}

function boardShapes(c: BoardCfg, pins: PinDef[]): Art {
  const { body } = c;
  const hdr = (ps: PinDef[]) => headerArt(ps.map((p) => ({ id: p.id, x: p.x, y: p.y, label: p.label ?? p.id, kind: 'lead' as const })));
  if (c.dip) {
    // a bare DIP chip: tinned legs, moulded body with the pin-1 notch
    const out: Art = pins.flatMap((p) => {
      const top = p.y === 0, edge = top ? body.y : body.y + body.h;
      return [
        rect(p.x - 1.9, top ? edge - 1.4 : edge - 0.6, 3.8, 2, COL.metal, { grad: COL.metalDark, gradDir: 'h' }),
        rect(p.x - 1, top ? p.y : edge, 2, Math.abs(edge - p.y), COL.metal, { grad: shade(COL.metalDark, -0.1), gradDir: 'h' }),
      ];
    });
    out.push(...(epoxy(body.x, body.y, body.w, body.h, body.color, 1.4)));
    out.push({ type: 'path', d: `M ${body.x} ${body.y + body.h / 2 - 4} A 4 4 0 0 1 ${body.x} ${body.y + body.h / 2 + 4} Z`, fill: shade(body.color, -0.45) });
    out.push(circle(body.x + 4, body.y + body.h - 4.5, 1.6, shade(body.color, -0.3), { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 0.4 }));
    return out;
  }
  const out: Art = [...(pcb(body.x, body.y, body.w, body.h, body.color, { holes: body.w > 150 || body.h > 80 ? 'corners' : 'none', rx: 3 }))];
  if (c.usb) {
    const u = c.usb;
    out.push(
      rect(u.x, u.y, u.w, u.h, '#eef1f4', { rx: u.micro ? 2 : 1.2, grad: '#7f8891', gradDir: u.w > u.h ? 'v' : 'h', stroke: '#5f666e', strokeWidth: 0.5, shadow: 1 }),
      rect(u.x + 1.2, u.y + 1.2, u.w - 2.4, u.h - 2.4, 'none', { rx: 1, stroke: 'rgba(255,255,255,0.55)', strokeWidth: 0.5 }),
    );
  }
  if (c.chip) {
    const k = c.chip, light = !!k.color && parseInt(k.color.slice(1, 3), 16) > 150;
    if (light) {
      // shielded module (ESP-12): metal can with the maker's print
      out.push(
        rect(k.x, k.y, k.w, k.h, '#f1f3f5', { rx: 1.5, grad: '#8a929b', gradDir: 'd', stroke: '#6d757e', strokeWidth: 0.5, shadow: 1 }),
        text(k.x + k.w / 2, k.y + k.h / 2, k.label, Math.min(6, (k.w - 6) / (0.66 * k.label.length)), '#3a3d42', 'middle', { weight: 800 }),
      );
      if (k.sub) out.push(text(k.x + k.w / 2, k.y + k.h / 2 + 7, k.sub, 3.6, '#5c636b', 'middle', { weight: 600 }));
    } else out.push(...(chipArt(k.x, k.y, k.w, k.h, { legs: k.w === k.h ? 'qfp' : 'soic', n: Math.max(4, Math.round(k.w / 3)), label: k.label, sub: k.sub, color: k.color })));
  }
  out.push(...hdr(pins.filter((p) => p.y === 0 && c.top.includes(p.id))), ...hdr(pins.filter((p) => p.y === c.rowGap && c.bottom.includes(p.id))));
  for (const p of c.extra ?? []) out.push(...hdr([p]));
  return out;
}

const blink = (spec: BoardSpec, led: string, note: string) => `// ${spec.name}: blink the LED and say hello.
// ${note}
const int LED = ${led};

void setup() {
  Serial.begin(${spec.baud});
  pinMode(LED, OUTPUT);
  Serial.println("${spec.name} ready");
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`;

interface BoardCfg {
  type: string;
  name: string;
  description: string;
  keywords: string[];
  spec: BoardSpec;
  code: string;
  summary: string;
  /** pins in drawing order; top row left→right, bottom row left→right */
  top: string[];
  bottom: string[];
  rowGap: number;
  /** extra pins at arbitrary positions (Mega's end header) */
  extra?: PinDef[];
  labels?: Record<string, string>;
  /** text printed next to a pin (defaults to the id) */
  short?: (id: string) => string;
  gnd: string;
  groundGroups?: string[][];
  internal?: string[][];
  supplies: SupplyPin[];
  power?: { vcc: string; min: number; max: number };
  /** body drawing */
  body: { x: number; y: number; w: number; h: number; color: string };
  chip?: { x: number; y: number; w: number; h: number; label: string; sub?: string; color?: string };
  usb?: { x: number; y: number; w: number; h: number; micro?: boolean };
  ledAt?: { x: number; y: number; color: string };
  powerLed?: { x: number; y: number };
  dip?: boolean;
  thumbScale?: number;
}

function makeBoard(c: BoardCfg): ComponentDef {
  const pins: PinDef[] = [
    ...c.top.map((id, i) => ({ id, x: i * 10, y: 0, kind: 'lead' as const, label: c.labels?.[id] ?? id })),
    ...c.bottom.map((id, i) => ({ id, x: i * 10, y: c.rowGap, kind: 'lead' as const, label: c.labels?.[id] ?? id })),
    ...(c.extra ?? []),
  ];
  const ioPins = pins.map((p) => p.id).filter((id) => c.spec.pinIndex(id) >= 0);
  const short = c.short ?? ((id: string) => id);
  const { body } = c;
  const bounds = { x: Math.min(body.x, -5), y: Math.min(body.y, -5), w: 0, h: 0 };
  bounds.w = Math.max(body.x + body.w, (Math.max(c.top.length, c.bottom.length) - 1) * 10 + 5, ...(c.extra ?? []).map((p) => p.x + 5)) - bounds.x;
  bounds.h = Math.max(body.y + body.h, c.rowGap + 5, ...(c.extra ?? []).map((p) => p.y + 5)) - bounds.y;
  const art = boardArt(c, pins);
  const row = (ids: string[], y: number, labelUp: boolean): ReactNode => (
    <g>
      {ids.map((id, i) => (
        <text key={id} x={i * 10 + 1.4} y={labelUp ? y + (c.dip ? 8 : 8) : y - 8} fontSize={3.3} fill={c.dip ? '#d7dbe0' : '#e8eaed'} transform={`rotate(${labelUp ? 90 : -90} ${i * 10 + 1.4} ${labelUp ? y + 8 : y - 8})`} fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
          {short(id)}
        </text>
      ))}
    </g>
  );
  return {
    type: c.type,
    name: c.name,
    category: 'mcu',
    description: c.description,
    keywords: c.keywords,
    bounds,
    pins: () => pins,
    internalConnections: () => [...(c.groundGroups ?? []), ...(c.internal ?? [])],
    defaultProps: { code: c.code },
    mcu: { defaultCode: c.code, board: c.spec },
    summary: () => c.summary,
    thumbScale: c.thumbScale,
    render: ({ sim }) => (
      <g>
        <Shapes shapes={art} />
        {c.dip && c.chip && (
          <g>
            <Label x={c.chip.x + c.chip.w / 2} y={c.chip.y + c.chip.h / 2 + (c.chip.sub ? 0 : 2)} size={Math.min(5.5, (c.chip.w / c.chip.label.length) * 1.4)} fill="#c9ccd1" weight={500}>{c.chip.label}</Label>
            {c.chip.sub && <Label x={c.chip.x + c.chip.w / 2} y={c.chip.y + c.chip.h / 2 + 6} size={3.2} fill="#8e959e" weight={400}>{c.chip.sub}</Label>}
          </g>
        )}
        {c.powerLed && (
          <g>
            {sim && !sim.off && <circle cx={c.powerLed.x} cy={c.powerLed.y} r={4} fill="#35d05a" opacity={0.45} style={{ filter: 'blur(2px)' }} />}
            <rect x={c.powerLed.x - 2.5} y={c.powerLed.y - 1.5} width={5} height={3} rx={0.6} fill={sim && !sim.off ? '#6af07e' : '#e9e4d0'} />
          </g>
        )}
        {c.ledAt && (
          <g>
            {sim?.l && <circle cx={c.ledAt.x} cy={c.ledAt.y} r={5} fill={c.ledAt.color} opacity={0.55} style={{ filter: 'blur(2px)' }} />}
            <rect x={c.ledAt.x - 2.5} y={c.ledAt.y - 1.5} width={5} height={3} rx={0.6} fill={sim?.l ? c.ledAt.color : '#e9e4d0'} />
          </g>
        )}
        {/* a narrow DIP has no room for printed pin names (hover a pin to see it) */}
        {!(c.dip && c.rowGap < 50) && row(c.top, 0, true)}
        {!(c.dip && c.rowGap < 50) && row(c.bottom, c.rowGap, false)}
        {(c.extra ?? []).map((p) => (
          <g key={p.id}>
            <text x={p.x + (p.x > body.x + body.w / 2 ? -6 : 6)} y={p.y + 1.3} fontSize={3.2} fill="#e8eaed" textAnchor={p.x > body.x + body.w / 2 ? 'end' : 'start'} fontFamily="Inter, sans-serif" fontWeight={600}>{short(p.id)}</text>
          </g>
        ))}
        {pins.map((p) => <PinTip key={p.id} x={p.x} y={p.y} />)}
        {sim?.error && (
          <g>
            <rect x={body.x + 4} y={body.y + body.h / 2 - 8} width={Math.min(140, body.w - 8)} height={16} rx={3} fill="#fff4f2" stroke="#e25b45" />
            <Label x={body.x + 4 + Math.min(140, body.w - 8) / 2} y={body.y + body.h / 2 + 3} size={5} fill="#c0392b">⚠ {String(sim.error).slice(0, 30)}</Label>
          </g>
        )}
      </g>
    ),
    schematic: () => (
      <g>
        <rect x={-6} y={14} width={Math.max(c.top.length, c.bottom.length) * 10 + 2} height={c.rowGap - 28} rx={3} fill="#fff" stroke="#1f3a5f" strokeWidth={1.4} />
        <SText x={((Math.max(c.top.length, c.bottom.length) - 1) * 10) / 2} y={c.rowGap / 2 + 2} size={Math.min(9, c.rowGap / 5)}>{c.spec.name}</SText>
        {c.top.map((id, i) => (
          <g key={id}>
            <SLine pts={[[i * 10, 0], [i * 10, 14]]} />
            <text x={i * 10 + 1.6} y={17} fontSize={3.4} fill="#1f3a5f" transform={`rotate(90 ${i * 10 + 1.6} 17)`} fontFamily="monospace">{short(id)}</text>
          </g>
        ))}
        {c.bottom.map((id, i) => (
          <g key={id}>
            <SLine pts={[[i * 10, c.rowGap], [i * 10, c.rowGap - 14]]} />
            <text x={i * 10 + 1.6} y={c.rowGap - 17} fontSize={3.4} fill="#1f3a5f" transform={`rotate(-90 ${i * 10 + 1.6} ${c.rowGap - 17})`} fontFamily="monospace">{short(id)}</text>
          </g>
        ))}
        {(c.extra ?? []).map((p) => <SLine key={p.id} pts={[[p.x, p.y], [p.x - 5, p.y]]} />)}
      </g>
    ),
    build: (b) => {
      const comp = buildBoard(b, c.spec, ioPins, c.gnd, c.supplies, c.power);
      const frame = comp.frame!;
      return { ...comp, frame: (dt) => ({ ...frame(dt), off: b.mcu ? !b.mcu.powerOk : false }) };
    },
  };
}

const V5 = (pin: string): SupplyPin => ({ pin, volts: 5, r: 0.05, warn: 0.45, short: 0.9 });
const V33 = (pin: string, warn = 0.3): SupplyPin => ({ pin, volts: 3.3, r: 0.3, warn, short: warn * 2 });

// ---------------------------------------------------------------- Arduino Nano

const nano = makeBoard({
  type: 'arduino-nano', name: 'Arduino Nano', spec: NANO,
  description: 'Breadboard-friendly ATmega328P board: the Uno\'s chip and pinout (D0–D13, A0–A5) plus A6/A7 (analog-only) on 0.6"-spaced pins that straddle the breadboard trench. Mini-USB, 5 V / 3.3 V pins.',
  keywords: ['arduino', 'nano', 'atmega328p', 'board', 'microcontroller', 'breadboard'],
  code: blink(NANO, 'LED_BUILTIN', 'Same code as the Uno. A6/A7 can only be read with analogRead().'),
  summary: 'ATmega328P · 5 V · 16 MHz',
  top: ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND1', 'RST1', 'D0', 'D1'],
  bottom: ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST2', 'GND2', 'VIN'],
  rowGap: 60,
  labels: { D0: 'D0 / RX', D1: 'D1 / TX', A4: 'A4 / SDA', A5: 'A5 / SCL', D13: 'D13 / LED / SCK', D11: 'D11 / MOSI', D12: 'D12 / MISO', D10: 'D10 / SS', GND1: 'GND', GND2: 'GND', RST1: 'RESET', RST2: 'RESET', VIN: 'VIN (7–12 V in)', AREF: 'AREF' },
  short: (id) => ({ GND1: 'GND', GND2: 'GND', RST1: 'RST', RST2: 'RST', D0: 'RX0', D1: 'TX1' } as Record<string, string>)[id] ?? id,
  gnd: 'GND1', groundGroups: [['GND1', 'GND2'], ['RST1', 'RST2']],
  supplies: [V5('5V'), V33('3V3', 0.05)],
  body: { x: -6, y: 4, w: 152, h: 52, color: '#1f5fbf' },
  chip: { x: 50, y: 18, w: 24, h: 24, label: 'ATMEGA', sub: '328P' },
  usb: { x: 146, y: 20, w: 12, h: 20 },
  ledAt: { x: 120, y: 22, color: '#ffb000' }, powerLed: { x: 120, y: 38 },
});

// ---------------------------------------------------------------- Arduino Mega 2560

const megaEnd: PinDef[] = [];
for (let n = 22; n <= 53; n++) {
  const k = n - 22;
  megaEnd.push({ id: `D${n}`, x: 330 + (k % 2) * 10, y: 20 + Math.floor(k / 2) * 10, kind: 'lead', label: `D${n}${({ 50: ' / MISO', 51: ' / MOSI', 52: ' / SCK', 53: ' / SS' } as Record<number, string>)[n] ?? ''}` });
}
const mega = makeBoard({
  type: 'arduino-mega', name: 'Arduino Mega 2560', spec: MEGA,
  description: 'ATmega2560 board: 54 digital I/O (15 PWM), 16 analog inputs, 4 hardware serial ports (Serial1–3 on 19/18, 17/16, 15/14), I2C on 20/21, SPI on 50–53, 256 KB flash. Uno shields fit its left half.',
  keywords: ['arduino', 'mega', 'mega2560', 'atmega2560', 'board', 'microcontroller', 'many pins'],
  code: blink(MEGA, 'LED_BUILTIN', 'Serial1, Serial2 and Serial3 are extra hardware serial ports.'),
  summary: 'ATmega2560 · 54 I/O · 16 analog',
  top: ['SCL', 'SDA', 'AREF', 'GND3', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21'],
  bottom: ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND1', 'GND2', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15'],
  rowGap: 200,
  extra: megaEnd,
  labels: { D0: 'D0 / RX0', D1: 'D1 / TX0', D14: 'D14 / TX3', D15: 'D15 / RX3', D16: 'D16 / TX2', D17: 'D17 / RX2', D18: 'D18 / TX1', D19: 'D19 / RX1', D20: 'D20 / SDA', D21: 'D21 / SCL', SCL: 'SCL (= D21)', SDA: 'SDA (= D20)', GND1: 'GND', GND2: 'GND', GND3: 'GND', NC: 'not connected' },
  short: (id) => ({ GND1: 'GND', GND2: 'GND', GND3: 'GND' } as Record<string, string>)[id] ?? id,
  gnd: 'GND1', groundGroups: [['GND1', 'GND2', 'GND3']], internal: [['SCL', 'D21'], ['SDA', 'D20']],
  supplies: [V5('5V'), V33('3V3', 0.05)],
  body: { x: -40, y: 4, w: 400, h: 192, color: '#1f6fb0' },
  chip: { x: 150, y: 70, w: 50, h: 50, label: 'ATMEGA2560', sub: '16AU' },
  usb: { x: -50, y: 30, w: 40, h: 34 },
  ledAt: { x: 50, y: 24, color: '#ffb000' }, powerLed: { x: 270, y: 70 },
  thumbScale: 0.45,
});

// ---------------------------------------------------------------- Arduino Micro

const micro = makeBoard({
  type: 'arduino-micro', name: 'Arduino Micro', spec: MICRO,
  description: 'ATmega32U4 board with native USB (it can act as a keyboard/mouse): 20 digital I/O (7 PWM), 12 analog inputs, Serial is USB and Serial1 is pins 0/1, I2C on D2/D3. Breadboard-friendly (0.6").',
  keywords: ['arduino', 'micro', 'atmega32u4', 'leonardo', 'native usb', 'board'],
  code: blink(MICRO, 'LED_BUILTIN', 'Serial is the USB port; Serial1 uses pins 0 (RX) and 1 (TX).'),
  summary: 'ATmega32U4 · native USB',
  top: ['MOSI', 'SS', 'D1', 'D0', 'RST1', 'GND1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'],
  bottom: ['MISO', 'SCK', 'D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'NC1', 'NC2', '5V', 'RST2', 'GND2', 'VIN'],
  rowGap: 60,
  labels: { D0: 'D0 / RX (Serial1)', D1: 'D1 / TX (Serial1)', D2: 'D2 / SDA', D3: 'D3 / SCL', GND1: 'GND', GND2: 'GND', SS: 'SS / RX LED' },
  short: (id) => ({ GND1: 'GND', GND2: 'GND', RST1: 'RST', RST2: 'RST', NC1: 'NC', NC2: 'NC' } as Record<string, string>)[id] ?? id,
  gnd: 'GND1', groundGroups: [['GND1', 'GND2'], ['RST1', 'RST2']],
  supplies: [V5('5V'), V33('3V3', 0.05)],
  body: { x: -6, y: 4, w: 172, h: 52, color: '#1d7a8c' },
  chip: { x: 70, y: 16, w: 26, h: 26, label: '32U4' },
  usb: { x: -16, y: 20, w: 12, h: 20 },
  ledAt: { x: 30, y: 22, color: '#ffb000' }, powerLed: { x: 30, y: 38 },
});

// ---------------------------------------------------------------- ESP8266 NodeMCU

const nodemcu = makeBoard({
  type: 'esp8266-nodemcu', name: 'ESP8266 NodeMCU', spec: ESP8266,
  description: 'ESP-12E (ESP8266, 80 MHz, 3.3 V logic) on a NodeMCU v1.0 board. Pins are labelled D0–D8 (→ GPIO16, 5, 4, 0, 2, 14, 12, 13, 15); one 10-bit ADC on A0 (0–3.3 V); the blue LED on D4/GPIO2 is ON when LOW. I2C defaults to D2 (SDA) / D1 (SCL). Wi-Fi itself isn\'t simulated.',
  keywords: ['esp8266', 'nodemcu', 'esp-12e', 'wemos', 'wifi', 'iot', 'board'],
  code: blink(ESP8266, 'LED_BUILTIN', 'The on-board LED (GPIO2 = D4) lights when the pin is LOW. Use D1, D2 … names.'),
  summary: 'ESP8266 · 80 MHz · 3.3 V',
  top: ['D0', 'D1', 'D2', 'D3', 'D4', '3V3A', 'GND1', 'D5', 'D6', 'D7', 'D8', 'RX', 'TX', 'GND2', '3V3'],
  bottom: ['A0', 'RSV1', 'RSV2', 'SD3', 'SD2', 'SD1', 'CMD', 'SD0', 'CLK', 'GND3', '3V3B', 'EN', 'RST', 'GND4', 'VIN'],
  rowGap: 100,
  labels: { D0: 'D0 / GPIO16 (wake)', D1: 'D1 / GPIO5 / SCL', D2: 'D2 / GPIO4 / SDA', D3: 'D3 / GPIO0 (flash)', D4: 'D4 / GPIO2 / LED', D5: 'D5 / GPIO14 / SCK', D6: 'D6 / GPIO12 / MISO', D7: 'D7 / GPIO13 / MOSI', D8: 'D8 / GPIO15 / SS', RX: 'RX / GPIO3', TX: 'TX / GPIO1', A0: 'A0 (ADC, 0–3.3 V)', VIN: 'VIN (5 V)' },
  short: (id) => (/^GND/.test(id) ? 'GND' : /^3V3/.test(id) ? '3V3' : /^RSV|^SD|^CMD|^CLK/.test(id) ? id.replace(/\d$/, '') : id),
  gnd: 'GND1', groundGroups: [['GND1', 'GND2', 'GND3', 'GND4'], ['3V3', '3V3A', '3V3B']],
  supplies: [V33('3V3', 0.3), { pin: 'VIN', volts: 4.7, r: 0.5, warn: 0.45, short: 1 }],
  body: { x: -8, y: 4, w: 156, h: 92, color: '#23252a' },
  chip: { x: 50, y: 22, w: 58, h: 52, label: 'ESP8266MOD', sub: 'ESP-12E', color: '#c9ced4' },
  usb: { x: 148, y: 38, w: 14, h: 24 },
  ledAt: { x: 40, y: 30, color: '#3d8bff' },
});

// ---------------------------------------------------------------- Raspberry Pi Pico / Pico W

function piPico(w: boolean) {
  const spec = w ? PICO_W : PICO;
  // physical pins 1–20 along the bottom, 40–21 along the top
  const bottom = ['GP0', 'GP1', 'GND1', 'GP2', 'GP3', 'GP4', 'GP5', 'GND2', 'GP6', 'GP7', 'GP8', 'GP9', 'GND3', 'GP10', 'GP11', 'GP12', 'GP13', 'GND4', 'GP14', 'GP15'];
  const top = ['VBUS', 'VSYS', 'GND8', '3V3_EN', '3V3', 'ADC_VREF', 'GP28', 'AGND', 'GP27', 'GP26', 'RUN', 'GP22', 'GND7', 'GP21', 'GP20', 'GP19', 'GP18', 'GND6', 'GP17', 'GP16'];
  return makeBoard({
    type: w ? 'pico-w' : 'pico', name: spec.name, spec,
    description: `RP2040 (dual-core Cortex-M0+, 133 MHz, 3.3 V logic): 26 GPIO (PWM on all), three 12-bit ADC inputs (GP26–28 = A0–A2; 10-bit by default in Arduino), I2C on GP4/GP5, SPI on GP16–19, Serial1 on GP0/GP1. Programmed with the Arduino (arduino-pico) API.${w ? ' The W adds a Wi-Fi chip (not simulated) which also drives the on-board LED.' : ' LED on GP25.'}`,
    keywords: ['raspberry pi pico', 'pico', 'rp2040', w ? 'pico w' : 'rpi pico', 'board', 'microcontroller'],
    code: blink(spec, 'LED_BUILTIN', 'Use GPx numbers: pinMode(15, OUTPUT) is GP15. Analog inputs: A0–A2 (GP26–28).'),
    summary: 'RP2040 · 133 MHz · 3.3 V',
    top, bottom, rowGap: 70,
    labels: { VBUS: 'VBUS (5 V from USB)', VSYS: 'VSYS (1.8–5.5 V in)', '3V3': '3V3 out', '3V3_EN': '3V3 enable', RUN: 'RUN (reset)', GP26: 'GP26 / A0', GP27: 'GP27 / A1', GP28: 'GP28 / A2', GP4: 'GP4 / SDA', GP5: 'GP5 / SCL', GP0: 'GP0 / TX (Serial1)', GP1: 'GP1 / RX (Serial1)' },
    short: (id) => (/^GND/.test(id) ? 'GND' : id.replace('ADC_VREF', 'VREF').replace('3V3_EN', 'EN')),
    gnd: 'GND1', groundGroups: [['GND1', 'GND2', 'GND3', 'GND4', 'GND6', 'GND7', 'GND8', 'AGND']],
    supplies: [V33('3V3', 0.3), { pin: 'VBUS', volts: 5, r: 0.2, warn: 0.5, short: 1 }, { pin: 'VSYS', volts: 4.7, r: 0.3, warn: 0.5, short: 1 }],
    body: { x: -8, y: 4, w: 206, h: 62, color: '#1f7a45' },
    chip: { x: 80, y: 20, w: 30, h: 30, label: 'RP2040', color: '#23252a' },
    usb: { x: -18, y: 25, w: 14, h: 20, micro: true },
    ledAt: { x: 20, y: 22, color: '#35d05a' },
  });
}

// ---------------------------------------------------------------- STM32 Blue Pill

const bluepill = makeBoard({
  type: 'stm32-bluepill', name: 'STM32 development board (Blue Pill)', spec: BLUEPILL,
  description: 'STM32F103C8 (ARM Cortex-M3, 72 MHz, 64 KB flash, 3.3 V) on the popular "Blue Pill" board, programmed with STM32duino: pins are named PA0…PC15, 10 ADC inputs (PA0–PA7, PB0, PB1), I2C1 on PB7/PB6, SPI1 on PA5–PA7, Serial on PA9/PA10. LED on PC13 lights when LOW.',
  keywords: ['stm32', 'blue pill', 'bluepill', 'stm32f103', 'arm', 'cortex-m3', 'stm32duino', 'board'],
  code: blink(BLUEPILL, 'PC13', 'The on-board LED on PC13 lights when the pin is LOW. Pins are PA0 … PC15.'),
  summary: 'STM32F103 · Cortex-M3 · 72 MHz',
  top: ['PB12', 'PB13', 'PB14', 'PB15', 'PA8', 'PA9', 'PA10', 'PA11', 'PA12', 'PA15', 'PB3', 'PB4', 'PB5', 'PB6', 'PB7', 'PB8', 'PB9', '5V', 'GND1', '3V3A'],
  bottom: ['VB', 'PC13', 'PC14', 'PC15', 'PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1', 'PB10', 'PB11', 'RST', '3V3', 'GND2', 'GND3'],
  rowGap: 60,
  labels: { PA9: 'PA9 / TX1', PA10: 'PA10 / RX1', PB6: 'PB6 / SCL', PB7: 'PB7 / SDA', PA5: 'PA5 / SCK', PA6: 'PA6 / MISO', PA7: 'PA7 / MOSI', PC13: 'PC13 / LED', VB: 'VBAT', PA2: 'PA2 / TX2', PA3: 'PA3 / RX2' },
  short: (id) => (/^GND/.test(id) ? 'GND' : /^3V3/.test(id) ? '3.3' : id.replace(/^P/, '')),
  gnd: 'GND1', groundGroups: [['GND1', 'GND2', 'GND3'], ['3V3', '3V3A']],
  supplies: [V33('3V3', 0.3), { pin: '5V', volts: 5, r: 0.2, warn: 0.5, short: 1 }],
  body: { x: -6, y: 4, w: 202, h: 52, color: '#2f6fd6' },
  chip: { x: 80, y: 16, w: 28, h: 28, label: 'STM32', sub: 'F103C8T6' },
  usb: { x: -16, y: 20, w: 12, h: 20, micro: true },
  ledAt: { x: 150, y: 20, color: '#35d05a' }, powerLed: { x: 150, y: 38 },
});

// ---------------------------------------------------------------- Teensy 4.0

const teensy = makeBoard({
  type: 'teensy40', name: 'Teensy 4.0', spec: TEENSY40,
  description: 'PJRC Teensy 4.0: ARM Cortex-M7 at 600 MHz (3.3 V logic, not 5 V tolerant!) in a tiny 1.4" × 0.7" board. 24 edge pins, PWM on most, 10 analog inputs (A0–A9 = 14–23), 7 serial ports, I2C on 18/19, SPI on 11–13. Programmed with Teensyduino.',
  keywords: ['teensy', 'teensy 4.0', 'imxrt1062', 'cortex-m7', 'pjrc', 'fast', 'board'],
  code: blink(TEENSY40, 'LED_BUILTIN', 'Pins are numbered 0–23; A0–A9 are pins 14–23. 3.3 V logic only.'),
  summary: 'i.MX RT1062 · 600 MHz · 3.3 V',
  top: ['VIN', 'GND2', '3V3', 'D23', 'D22', 'D21', 'D20', 'D19', 'D18', 'D17', 'D16', 'D15', 'D14', 'D13'],
  bottom: ['GND1', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'],
  rowGap: 70,
  labels: { D13: '13 / LED / SCK', D18: '18 / A4 / SDA', D19: '19 / A5 / SCL', D0: '0 / RX1', D1: '1 / TX1', VIN: 'VIN (3.6–5.5 V)', GND1: 'GND', GND2: 'GND' },
  short: (id) => (/^GND/.test(id) ? 'G' : id.replace(/^D/, '')),
  gnd: 'GND1', groundGroups: [['GND1', 'GND2']],
  supplies: [V33('3V3', 0.25)],
  body: { x: -6, y: 4, w: 142, h: 62, color: '#1f7a45' },
  chip: { x: 50, y: 18, w: 32, h: 32, label: 'IMXRT', sub: '1062' },
  usb: { x: -16, y: 25, w: 12, h: 20, micro: true },
  ledAt: { x: 110, y: 22, color: '#ffb000' },
});

// ---------------------------------------------------------------- bare chips (power from VCC)

function chip(o: { type: string; name: string; spec: BoardSpec; description: string; keywords: string[]; code: string; summary: string; dipPins: string[]; wide?: boolean; labels?: Record<string, string>; gnd: string; groundGroups?: string[][]; power: { vcc: string; min: number; max: number }; label: string; sub?: string }): ComponentDef {
  const n = o.dipPins.length;
  const bottom = o.dipPins.slice(0, n / 2);
  const top = o.dipPins.slice(n / 2).reverse();
  const gap = o.wide ? 60 : 30;
  const w = (n / 2 - 1) * 10 + 12;
  return makeBoard({
    type: o.type, name: o.name, spec: o.spec, description: o.description, keywords: o.keywords, code: o.code, summary: o.summary,
    top, bottom, rowGap: gap, dip: true,
    labels: Object.fromEntries(o.dipPins.map((id, i) => [id, `${i + 1}: ${o.labels?.[id] ?? id}`])),
    short: (id) => id.replace(/\d$/, (d) => (/^(GND|VCC|VDD|VSS)\d$/.test(id) ? '' : d)),
    gnd: o.gnd, groundGroups: o.groundGroups,
    supplies: [], power: o.power,
    body: { x: -6, y: 5, w, h: gap - 10, color: '#26282c' },
    chip: { x: -6 + w / 2 - Math.min(w - 10, 60) / 2, y: gap / 2 - 5, w: Math.min(w - 10, 60), h: 10, label: o.label, sub: o.sub, color: '#26282c' },
  });
}

const tiny85 = chip({
  type: 'attiny85', name: 'ATtiny85', spec: ATTINY85, label: 'ATTINY85',
  description: 'Tiny 8-pin AVR (8 KB flash, 8 MHz internal clock): 6 I/O pins PB0–PB5 (numbered 0–5), PWM on 0, 1 and 4, ADC on 2, 3, 4. Power it straight from 2.7–5.5 V on VCC (pin 8) and GND (pin 4) — no regulator, no USB. Serial (software) sends on PB0.',
  keywords: ['attiny85', 'attiny', 'avr', 'tiny', 'digispark', 'chip', 'microcontroller'],
  code: `// ATtiny85: blink an LED on PB1 (pin 6).\n// Power the chip from VCC (pin 8) and GND (pin 4).\nvoid setup() {\n  pinMode(1, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(1, HIGH);\n  delay(500);\n  digitalWrite(1, LOW);\n  delay(500);\n}\n`,
  summary: 'AVR · 8 pins · 8 MHz',
  dipPins: ['RST', 'PB3', 'PB4', 'GND', 'PB0', 'PB1', 'PB2', 'VCC'],
  labels: { RST: 'PB5 / RESET', PB3: 'PB3 / A3', PB4: 'PB4 / A2 (PWM)', PB0: 'PB0 / MOSI / SDA (PWM)', PB1: 'PB1 / MISO (PWM)', PB2: 'PB2 / SCK / SCL / A1 / INT0', VCC: 'VCC (2.7–5.5 V)' },
  gnd: 'GND', power: { vcc: 'VCC', min: 2.7, max: 5.5 },
});

const mega328 = chip({
  type: 'atmega328p', name: 'ATmega328P (DIP-28)', spec: ATMEGA328P, label: 'ATMEGA328P',
  description: 'The Uno\'s microcontroller as a bare DIP-28 chip for your own boards: same pin numbers as the Uno (D0–D13, A0–A5). Needs 5 V on VCC and AVCC (pins 7, 20), GND (8, 22) and a 16 MHz crystal + 22 pF caps on pins 9/10 in real life (plus a 10 kΩ pull-up on RESET).',
  keywords: ['atmega328p', 'atmega328', 'avr', 'chip', 'dip', 'barebones arduino', 'microcontroller'],
  code: blink(ATMEGA328P, '13', 'Arduino pin 13 = chip pin 19 (PB5).'),
  summary: 'AVR · 28 pins · 16 MHz',
  dipPins: ['RESET', 'D0', 'D1', 'D2', 'D3', 'D4', 'VCC', 'GND1', 'XTAL1', 'XTAL2', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'AVCC', 'AREF', 'GND2', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
  labels: { D0: 'PD0 / D0 / RX', D1: 'PD1 / D1 / TX', D13: 'PB5 / D13 / SCK', D11: 'PB3 / D11 / MOSI', D12: 'PB4 / D12 / MISO', A4: 'PC4 / A4 / SDA', A5: 'PC5 / A5 / SCL', XTAL1: 'XTAL1 (crystal)', XTAL2: 'XTAL2 (crystal)', AVCC: 'AVCC (ADC supply)', VCC: 'VCC (1.8–5.5 V)' },
  wide: false, gnd: 'GND1', groundGroups: [['GND1', 'GND2'], ['VCC', 'AVCC']], power: { vcc: 'VCC', min: 2.7, max: 5.5 },
});

const pic = chip({
  type: 'pic16f877a', name: 'PIC16F877A (DIP-40)', spec: PIC16F877A, label: 'PIC16F877A',
  description: 'Microchip 8-bit PIC (DIP-40, 20 MHz, 33 I/O on ports A–E, 8 ADC channels, UART on RC6/RC7, I2C/SPI on RC3–RC5). In this simulator it is programmed with the same Arduino-style C API as the other boards, using port-pin names (pinMode(RB0, OUTPUT)) — not MPLAB XC8 register code.',
  keywords: ['pic', 'pic16f877a', 'microchip', 'pic16', '8-bit', 'chip', 'microcontroller'],
  code: `// PIC16F877A with the Arduino-style API: pins are RA0…RE2.\n// Power: VDD (pins 11, 32) = 5 V, VSS (12, 31) = GND.\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(RB0, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(RB0, HIGH);\n  delay(500);\n  digitalWrite(RB0, LOW);\n  delay(500);\n}\n`,
  summary: 'PIC16 · 40 pins · 20 MHz',
  dipPins: ['MCLR', 'RA0', 'RA1', 'RA2', 'RA3', 'RA4', 'RA5', 'RE0', 'RE1', 'RE2', 'VDD1', 'VSS1', 'OSC1', 'OSC2', 'RC0', 'RC1', 'RC2', 'RC3', 'RD0', 'RD1', 'RD2', 'RD3', 'RC4', 'RC5', 'RC6', 'RC7', 'RD4', 'RD5', 'RD6', 'RD7', 'VSS2', 'VDD2', 'RB0', 'RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6', 'RB7'],
  labels: { MCLR: 'MCLR (reset, pull up)', RC6: 'RC6 / TX', RC7: 'RC7 / RX', RC3: 'RC3 / SCK / SCL', RC4: 'RC4 / SDI / SDA', RC5: 'RC5 / SDO', RB0: 'RB0 / INT', RC2: 'RC2 / CCP1 (PWM)', RC1: 'RC1 / CCP2 (PWM)', VDD1: 'VDD (+5 V)', VDD2: 'VDD (+5 V)', VSS1: 'VSS (GND)', VSS2: 'VSS (GND)' },
  wide: true, gnd: 'VSS1', groundGroups: [['VSS1', 'VSS2'], ['VDD1', 'VDD2']], power: { vcc: 'VDD1', min: 4, max: 5.5 },
});

const generic = chip({
  type: 'generic-mcu', name: 'Generic microcontroller (MCU-20)', spec: GENERIC_MCU, label: 'MCU-20',
  description: 'A simple, neutral 20-pin 5 V microcontroller for learning: I/O pins P0–P15 (ADC on P0–P7, PWM on P8–P11, interrupts on P2/P3, UART on P12 RX / P13 TX, I2C on P14/P15). Power it from VCC/GND; program it with the Arduino API.',
  keywords: ['generic', 'microcontroller', 'mcu', 'chip', 'learning'],
  code: `// Generic MCU: pins are P0…P15. Power it from VCC and GND.\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(P8, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(P8, HIGH);\n  delay(500);\n  digitalWrite(P8, LOW);\n  delay(500);\n}\n`,
  summary: '8-bit · 16 I/O · 5 V',
  dipPins: ['VCC', 'P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'GND', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'RST', 'NC'],
  labels: { P12: 'P12 / RX', P13: 'P13 / TX', P14: 'P14 / SDA', P15: 'P15 / SCL', RST: 'Reset (tie HIGH)' },
  gnd: 'GND', power: { vcc: 'VCC', min: 1.8, max: 5.5 },
});

export const MORE_BOARDS: ComponentDef[] = [nano, mega, micro, nodemcu, piPico(false), piPico(true), bluepill, teensy, tiny85, mega328, pic, generic];
