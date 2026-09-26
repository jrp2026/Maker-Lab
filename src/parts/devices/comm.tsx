/** Communication devices: RFID/NFC readers, nRF24L01, MCP2515 CAN, GPS and serial (UART) modules. */
import type { CanController, CardReader, Nrf24Radio } from '../../mcu/devlibs/comm';
import type { SimBuilder } from '../../sim/builder';
import { COL, chip, circle, crystalCan, ecap, jumper, line, moduleBoard, path, pcb, pinRow, rect, screwTerminals, silk, smdRow, tactSwitch, text, usbPort } from '../kit';

/** meander PCB antenna (2.4 GHz modules) */
const meander = (x: number, y: number, w: number, rows: number, step = 5) =>
  path(`M ${x} ${y} ` + Array.from({ length: rows }, (_, i) => `h ${i % 2 ? -w : w} v ${step}`).join(' '), 'none', { stroke: '#e6c86e', strokeWidth: 1.4 });

/** Antenna loop etched on an RFID/NFC reader (tinned traces under the solder mask). */
const antennaLoops = (x: number, y: number, w: number, h: number, turns: number, color: string) =>
  Array.from({ length: turns }, (_, i) => rect(x + i * 3.2, y + i * 3.2, w - i * 6.4, h - i * 6.4, 'none', { stroke: color, strokeWidth: 1.3, rx: 5 - i }));

/** A white MIFARE card, as it slides onto the reader. */
const card = (x: number, y: number, w: number, h: number) => rect(x, y, w, h, '#fbfbf9', { rx: 3, grad: '#dcdfe3', gradDir: 'd', stroke: '#a9b1b9', strokeWidth: 0.5, shadow: 1, opacity: 0.94 });
import { drain, Outbox, poweredFn, scrollback, TextLines, type DevicePart } from './common';

const CARDS: [string, number[]][] = [
  ['Blue tag  DE AD BE EF', [0xde, 0xad, 0xbe, 0xef]],
  ['White card  04 A2 2B 7A', [0x04, 0xa2, 0x2b, 0x7a]],
  ['Key fob  93 1C 5F 0B', [0x93, 0x1c, 0x5f, 0x0b]],
  ['NTAG215 (7-byte)  04 5A 21 E2 3C 6B 80', [0x04, 0x5a, 0x21, 0xe2, 0x3c, 0x6b, 0x80]],
];

function cardReaderApi(b: SimBuilder, props: () => Record<string, any>): CardReader {
  const st = (b.state.card ??= { session: 0, was: false }) as { session: number; was: boolean };
  const present = () => Number(props().present ?? 0) === 1 || !!b.input.pressed;
  return {
    card: () => {
      const p = present();
      if (p && !st.was) st.session++;
      st.was = p;
      return p ? CARDS[Number(props().card ?? 0)]?.[1] ?? CARDS[0][1] : null;
    },
    session: () => st.session,
  };
}

const cardProps = [
  { key: 'card', label: 'Card / tag', type: 'select', default: 0, options: CARDS.map(([label], i) => ({ value: i, label })) },
  { key: 'present', label: 'Card on the reader', type: 'select', default: 0, options: [{ value: 0, label: 'No (hold the reader to tap it)' }, { value: 1, label: 'Yes (left on it)' }] },
];

// ------------------------------------------------------------------ RC522

const rc522: DevicePart = (() => {
  const b = moduleBoard(['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', 'VCC'], { h: 110, w: 100, color: COL.pcbBlue, title: 'RFID-RC522', titleY: -12.5 - 5, titleSize: 3.2, labels: { SDA: 'SDA / SS (chip select)', SCK: 'SPI clock', MOSI: 'MOSI', MISO: 'MISO', IRQ: 'Interrupt', RST: 'Reset', VCC: '3.3 V (not 5 V!)' } });
  return [
    {
      type: 'rc522', name: 'RFID reader (RC522, 13.56 MHz)', category: 'comms',
      description: 'MFRC522 RFID reader on SPI for MIFARE cards and key fobs (13.56 MHz). Wire SDA to the SS pin you pass to MFRC522(ss, rst) and SCK/MOSI/MISO to the SPI pins; power from 3.3 V. Hold the reader to tap the chosen card.',
      keywords: ['rfid', 'rc522', 'mfrc522', 'mifare', 'nfc', 'card reader', 'access control', 'key fob'],
      pins: b.pins,
      props: cardProps,
      interactive: 'press',
      shapes: [
        ...b.shapes, ...antennaLoops(-12, -106, 94, 60, 4, '#5f95dc'),
        ...chip(4, -40, 14, 14, { legs: 'qfp', n: 6, label: 'RC522' }), ...crystalCan(26, -38, 14, 5.5, '27.12'),
        ...smdRow(-20, -26, 6, 5, false, 'crcrcc'), ...smdRow(26, -26, 6, 5, false, 'rcrcrc'), ...ecap(56, -40, 4),
      ],
      animations: [{ shape: card(-10, -166, 70, 44), dy: '(present == 1 || pressed == 1) ? 78 : -400' }],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 250 }, ...['SDA', 'SCK', 'MOSI', 'RST', 'MISO', 'IRQ'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }))] },
      warnings: [{ when: 'v(VCC, GND) > 3.8', level: 'error', message: 'The RC522 is a 3.3 V module — 5 V damages it.' }],
    },
    {
      setup(bld, comp) {
        bld.registerDevice({ kind: 'rfid', key: 'ss', pins: { ss: 'SDA', sck: 'SCK', mosi: 'MOSI', miso: 'MISO' }, powered: poweredFn(bld, 2.4), api: cardReaderApi(bld, () => comp.props) });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ PN532

const pn532: DevicePart = (() => {
  const b = moduleBoard(['GND', 'VCC', 'SDA', 'SCL', 'IRQ', 'RSTO'], { h: 90, w: 90, color: COL.pcbRed, title: 'PN532 NFC', titleY: -17, titleSize: 3.2, labels: { VCC: '+3.3–5 V', SDA: 'I2C data', SCL: 'I2C clock', IRQ: 'Interrupt', RSTO: 'Reset out' } });
  return [
    {
      type: 'pn532', name: 'NFC module (PN532)', category: 'comms',
      description: 'PN532 NFC/RFID reader in I2C mode (set the DIP switches to I2C): reads MIFARE cards, NTAG stickers and phones. Use Adafruit_PN532 nfc(IRQ, RESET) with readPassiveTargetID(). Hold the module to tap the chosen card.',
      keywords: ['nfc', 'pn532', 'rfid', 'ntag', 'mifare', 'card reader'],
      pins: b.pins,
      props: cardProps,
      interactive: 'press',
      shapes: [
        ...b.shapes, ...antennaLoops(-16, -90, 56, 52, 3, '#e07a70'),
        ...chip(44, -64, 14, 14, { legs: 'qfn', label: 'PN532' }), ...crystalCan(44, -46, 14, 5, '27.12'),
        rect(44, -86, 14, 12, '#d63c35', { rx: 1, grad: '#8f1f1a', shadow: 0.8 }), rect(46, -84, 4, 8, '#f4f2ec', { rx: 0.5 }), rect(52, -80, 4, 4, '#f4f2ec', { rx: 0.5 }), silk(51, -88, 'I2C', 2.4),
        ...smdRow(-18, -26, 6, 5, false, 'rcrcrc'), ...smdRow(24, -26, 5, 5, false, 'ccrrc'),
      ],
      animations: [{ shape: card(-12, -140, 56, 38), dy: '(present == 1 || pressed == 1) ? 60 : -400' }],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 200 }, ...['SDA', 'SCL', 'IRQ', 'RSTO'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }))] },
    },
    {
      setup(bld, comp) {
        const api = cardReaderApi(bld, () => comp.props);
        bld.registerDevice({ kind: 'nfc', key: 'sda', pins: { sda: 'SDA', irq: 'IRQ' }, powered: poweredFn(bld, 2.6), api });
        bld.registerI2C({ address: 0x24, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.6), device: { write: () => {}, read: (n) => new Array(n).fill(0x01) } });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ nRF24L01

const nrf24: DevicePart = (() => {
  const pins = [
    ...pinRow(['GND', 'CE', 'SCK', 'MISO'], { y: 0, labels: { GND: 'GND', CE: 'CE (chip enable)', SCK: 'SPI clock', MISO: 'MISO' } }),
    ...pinRow(['VCC', 'CSN', 'MOSI', 'IRQ'], { y: -10, labels: { VCC: '3.3 V (5 V kills it!)', CSN: 'CSN (SPI chip select)', MOSI: 'MOSI', IRQ: 'Interrupt' } }),
  ];
  return [
    {
      type: 'nrf24l01', name: '2.4 GHz radio (nRF24L01+)', category: 'comms',
      description: 'Low-power 2.4 GHz transceiver: two boards, each with one, can send small packets (≤ 32 bytes — ints, arrays, structs) to each other. Use the RF24 library: same channel, and the writer\'s address must match a reading pipe on the listener. Power from 3.3 V with a 10 µF capacitor.',
      keywords: ['nrf24l01', 'nrf24', 'rf24', '2.4ghz', 'radio', 'wireless', 'transceiver'],
      pins,
      shapes: [
        ...pcb(-8, -62, 90, 70, '#1c7040', { holes: 'none', rx: 1.5 }),
        rect(-6, -15, 40, 20, '#2a2b2f', { rx: 1, grad: '#111214', shadow: 0.8 }),
        ...pins.map((p) => rect(p.x - 1.5, p.y - 1.5, 3, 3, '#e3c25e', { grad: '#9c7b26', gradDir: 'd' })),
        ...chip(4, -48, 14, 14, { legs: 'qfn', label: 'NRF24', sub: 'L01+' }), ...crystalCan(-4, -28, 14, 5, '16.000'),
        ...smdRow(22, -44, 3, 5, true, 'crc'), ...smdRow(22, -26, 3, 5, false, 'rcc'),
        path('M40 -58 h36 v8 h-32 v8 h32 v8 h-32 v8 h36', 'none', { stroke: '#e6c86e', strokeWidth: 1.8 }),
        silk(58, -14, 'nRF24L01+', 3),
      ],
      indicators: [{ shape: circle(30, -24, 2.2, '#35d05a'), color: '#35d05a', level: 'act' }],
      model: { elements: [{ id: 'IQ', kind: 'rvar', a: 'VCC', b: 'GND', value: 'v(VCC, GND) > 1.9 ? 250 : 1e6' }, ...['CE', 'CSN', 'SCK', 'MOSI', 'MISO', 'IRQ'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }))] },
      warnings: [{ when: 'v(VCC, GND) > 3.7', level: 'error', message: 'nRF24L01 modules are 3.3 V only — this voltage destroys them (it will not work).' }],
    },
    {
      vars: ['act'],
      setup(bld) {
        const ok = () => {
          const v = bld.volt('VCC') - bld.volt('GND');
          return v > 1.9 && v < 3.7;
        };
        let lastAct = -1e9;
        const radio: Nrf24Radio = {
          config: { channel: 76, listening: false, writeAddr: '', readPipes: new Map(), powered: false },
          rx: [],
          transmit(addr, payload) {
            lastAct = bld.now();
            let acked = false;
            for (const peer of bld.peers('nrf24')) {
              const r = peer.api as Nrf24Radio;
              if (r === radio || !peer.powered() || !r.config.listening || r.config.channel !== radio.config.channel) continue;
              for (const [pipe, a] of r.config.readPipes) {
                if (a === addr) {
                  if (r.rx.length < 3) r.rx.push({ pipe, payload: JSON.parse(JSON.stringify(payload)) });
                  acked = true;
                  break;
                }
              }
            }
            return acked;
          },
        };
        const saved = bld.state.radio as Nrf24Radio['config'] | undefined;
        if (saved) Object.assign(radio.config, saved);
        bld.state.radio = radio.config;
        bld.registerDevice({ kind: 'nrf24', key: 'csn', pins: { csn: 'CSN', ce: 'CE', sck: 'SCK' }, powered: ok, api: radio });
        return { values: () => ({ act: bld.now() - lastAct < 60000 ? 1 : 0 }) };
      },
    },
  ];
})();

// ------------------------------------------------------------------ MCP2515 CAN

const mcp2515: DevicePart = (() => {
  const b = moduleBoard(['INT', 'SCK', 'SI', 'SO', 'CS', 'GND', 'VCC'], { h: 90, w: 90, color: COL.pcbBlue, holes: 'corners', labels: { INT: 'Interrupt (LOW = message)', SCK: 'SPI clock', SI: 'MOSI', SO: 'MISO', CS: 'Chip select', VCC: '+5 V' } });
  const bus = pinRow(['CANH', 'CANL'], { x0: 10, y: -90, step: 20, kind: 'terminal', labels: { CANH: 'CAN High', CANL: 'CAN Low' } });
  return [
    {
      type: 'mcp2515', name: 'CAN bus module (MCP2515 + TJA1050)', category: 'comms',
      description: 'CAN controller + transceiver on SPI, as used in cars and industrial networks. Join the CANH and CANL of all nodes (120 Ω at each end); every node sees every frame. Use the mcp_can library: begin(MCP_ANY, CAN_500KBPS, MCP_8MHZ), sendMsgBuf(), readMsgBuf().',
      keywords: ['can bus', 'mcp2515', 'tja1050', 'can transceiver', 'automotive', 'obd', 'mcp_can'],
      pins: [...b.pins, ...bus],
      shapes: [
        ...b.shapes, ...screwTerminals(bus, '#2f7fd6', 'up'), silk(10, -76, 'H', 3), silk(30, -76, 'L', 3),
        ...chip(-6, -58, 26, 12, { n: 9, label: 'MCP2515' }), ...chip(30, -58, 14, 10, { n: 4, label: 'TJA1050' }),
        ...crystalCan(-6, -40, 16, 6, '8.000'), ...jumper(56, -80), silk(56, -73, 'J1', 2.6),
        ...ecap(56, -48, 5), ...smdRow(14, -36, 6, 5, false, 'crcrcc'),
      ],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 500 }, { id: 'TERM', kind: 'resistor', a: 'CANH', b: 'CANL', value: 120 }, { id: 'PI', kind: 'rvar', a: 'VCC', b: 'INT', value: 'pending > 0 ? 1e9 : 10000' }, { id: 'PD', kind: 'rvar', a: 'INT', b: 'GND', value: 'pending > 0 ? 50 : 1e9' }, ...['SCK', 'SI', 'SO', 'CS'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }))] },
    },
    {
      vars: ['pending'],
      setup(bld) {
        const ctl: CanController = {
          mode: 0,
          rx: [],
          send(id, ext, data) {
            let heard = false;
            for (const peer of bld.peers('can')) {
              if (peer.api === ctl || !peer.powered() || !bld.sameNet('CANH', peer, 'CANH')) continue;
              const c = peer.api as CanController;
              if (c.rx.length < 16) c.rx.push({ id, ext, data: [...data] });
              heard = true;
            }
            return heard;
          },
        };
        bld.registerDevice({ kind: 'can', key: 'cs', pins: { cs: 'CS', sck: 'SCK', canh: 'CANH' }, powered: poweredFn(bld, 4.2), api: ctl });
        return { values: () => ({ pending: ctl.rx.length }), frame: () => ({ pending: ctl.rx.length }) };
      },
    },
  ];
})();

// ------------------------------------------------------------------ GPS (NEO-6M)

const nmeaSum = (s: string) => {
  let x = 0;
  for (const c of s) x ^= c.charCodeAt(0);
  return x.toString(16).toUpperCase().padStart(2, '0');
};
const nmea = (body: string) => `$${body}*${nmeaSum(body)}\r\n`;
function coord(v: number, lat: boolean) {
  const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  return `${String(d).padStart(lat ? 2 : 3, '0')}${m.toFixed(4).padStart(7, '0')},${lat ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W'}`;
}

const gps: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'RX', 'TX', 'GND', 'PPS'], { h: 84, w: 92, color: COL.pcbBlue, title: 'GY-GPS6MV2', titleY: -24, titleX: 14, titleSize: 3.2, holes: 'corners', labels: { VCC: '+3.3–5 V', RX: 'RX (from the board\'s TX)', TX: 'TX (to the board\'s RX)', PPS: '1 pulse per second (with a fix)' } });
  return [
    {
      type: 'gps-neo6m', name: 'GPS module (NEO-6M)', category: 'comms',
      description: 'u-blox NEO-6M GPS receiver: once it has a fix it sends NMEA sentences ($GPRMC, $GPGGA …) every second at 9600 baud on TX. Wire TX to a SoftwareSerial RX pin and feed the characters to TinyGPS++. Set the position and fix in the inspector.',
      keywords: ['gps', 'neo-6m', 'neo6m', 'ublox', 'nmea', 'tinygps', 'location', 'gnss'],
      pins: b.pins,
      props: [
        { key: 'lat', label: 'Latitude', type: 'number', default: 51.5074, min: -90, max: 90, unit: '°' },
        { key: 'lon', label: 'Longitude', type: 'number', default: -0.1278, min: -180, max: 180, unit: '°' },
        { key: 'alt', label: 'Altitude', type: 'number', default: 35, min: -400, max: 9000, unit: 'm' },
        { key: 'speed', label: 'Speed', type: 'slider', default: 0, min: 0, max: 200, step: 0.5, unit: 'km/h' },
        { key: 'course', label: 'Course', type: 'slider', default: 0, min: 0, max: 359, step: 1, unit: '°' },
        { key: 'sats', label: 'Satellites', type: 'slider', default: 8, min: 0, max: 12, step: 1 },
        { key: 'fix', label: 'Fix', type: 'select', default: 1, options: [{ value: 1, label: 'Has a fix' }, { value: 0, label: 'Searching (no fix)' }] },
      ],
      shapes: [
        ...b.shapes,
        // ceramic patch antenna and the shielded u-blox module
        rect(-8, -76, 44, 44, '#d9b45a', { rx: 2, grad: '#9c7b26', gradDir: 'd', shadow: 1 }),
        rect(-4, -72, 36, 36, '#efe4c4', { rx: 1, grad: '#cdbb8a', gradDir: 'd' }),
        rect(10, -58, 8, 8, '#e3c25e', { rx: 1, grad: '#9c7b26', gradDir: 'r' }), circle(14, -54, 1.2, '#6b5418'),
        rect(42, -72, 28, 26, '#f1f3f5', { rx: 1.5, grad: '#8a929b', gradDir: 'd', shadow: 1, stroke: '#6d757e', strokeWidth: 0.4 }),
        text(56, -61, 'u-blox', 3.4, '#3a3d42', 'middle', { weight: 800 }), text(56, -55, 'NEO-6M', 3, '#3a3d42', 'middle', { weight: 600 }),
        circle(58, -34, 6, '#e6eaee', { grad: '#8a929b', gradDir: 'r', shadow: 0.8 }), text(58, -32.8, 'ML1220', 2, '#3a3d42', 'middle', { weight: 600 }),
        ...smdRow(40, -22, 4, 5, false, 'rcrc'),
      ],
      indicators: [{ shape: circle(60, -64, 2.5, '#35d05a'), color: '#35d05a', level: 'blink' }],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 110 }, { id: 'OTX', kind: 'vsource', p: 'TX', n: 'GND', value: 'v(VCC, GND) > 2.7 ? 3.3 : 0', r: 300 }, { id: 'RRX', kind: 'resistor', a: 'RX', b: 'GND', value: 1e6 }, { id: 'OP', kind: 'vsource', p: 'PPS', n: 'GND', value: 'blink * 3.3', r: 300 }] },
    },
    {
      vars: ['blink'],
      setup(bld, comp) {
        const powered = poweredFn(bld, 2.7);
        const st = (bld.state.gps ??= { next: 1e6, start: Date.now() }) as { next: number; start: number };
        return {
          values: () => ({ blink: powered() && Number(comp.props.fix) === 1 && (bld.now() % 1e6) < 1e5 ? 1 : 0 }),
          afterStep() {
            const now = bld.now();
            if (!powered() || now < st.next) return;
            st.next = now + 1e6;
            const p = comp.props;
            const d = new Date(st.start + now / 1000);
            const hh = (n: number) => String(n).padStart(2, '0');
            const time = `${hh(d.getUTCHours())}${hh(d.getUTCMinutes())}${hh(d.getUTCSeconds())}.00`;
            const date = `${hh(d.getUTCDate())}${hh(d.getUTCMonth() + 1)}${hh(d.getUTCFullYear() % 100)}`;
            const fix = Number(p.fix) === 1 && Number(p.sats) >= 3;
            const lat = coord(Number(p.lat), true), lon = coord(Number(p.lon), false);
            const knots = (Number(p.speed) / 1.852).toFixed(3);
            const out = fix
              ? nmea(`GPRMC,${time},A,${lat},${lon},${knots},${Number(p.course).toFixed(2)},${date},,,A`) + nmea(`GPGGA,${time},${lat},${lon},1,${hh(Number(p.sats))},0.92,${Number(p.alt).toFixed(1)},M,46.9,M,,`)
              : nmea(`GPRMC,${time},V,,,,,,,${date},,,N`) + nmea(`GPGGA,${time},,,,,0,${hh(Number(p.sats))},99.99,,,,,,`);
            bld.uartSend('TX', out);
          },
        };
      },
    },
  ];
})();

// ------------------------------------------------------------------ serial modules with a terminal

/** A UART module that shows what it receives and answers with `respond`. */
function uartModule(o: {
  type: string; name: string; description: string; keywords: string[]; rx: string; tx: string; pins: string[]; labels: Record<string, string>;
  color: string; title: string; minV: number; maxV?: number; screen: { x: number; y: number; w: number; h: number }; h: number; w?: number;
  /** where the silkscreen name goes (clear of the parts) */
  titleAt?: [number, number];
  fields?: { key: string; label: string; placeholder?: string }[];
  props?: Record<string, any>[];
  respond: (ctx: { text: string; send: (t: string, delayMs?: number) => void; log: (t: string) => void; props: Record<string, any>; state: Record<string, any>; now: number }) => void;
  onUser?: (ctx: { key: string; text: string; send: (t: string, delayMs?: number) => void; log: (t: string) => void; props: Record<string, any>; state: Record<string, any> }) => void;
  extraElements?: Record<string, any>[];
  extraShapes?: Record<string, any>[];
  indicators?: Record<string, any>[];
  vars?: string[];
  values?: (state: Record<string, any>, props: Record<string, any>) => Record<string, number>;
}): DevicePart {
  const b = moduleBoard(o.pins, { h: o.h, w: o.w ?? 90, color: o.color, title: o.title, labels: o.labels, titleX: o.titleAt?.[0], titleY: o.titleAt?.[1], titleSize: o.titleAt ? 3.2 : undefined });
  return [
    {
      type: o.type, name: o.name, category: 'comms', description: o.description, keywords: o.keywords,
      pins: b.pins,
      props: o.props ?? [],
      shapes: [...b.shapes, ...(o.extraShapes ?? [])],
      indicators: o.indicators,
      model: {
        elements: [
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 400 },
          { id: 'OTX', kind: 'vsource', p: o.tx, n: 'GND', value: `v(VCC, GND) > ${o.minV} ? ${o.minV > 3 ? 'min(3.3, v(VCC, GND))' : '3.3'} : 0`, r: 300 },
          { id: 'RRX', kind: 'resistor', a: o.rx, b: 'GND', value: 1e6 },
          ...(o.extraElements ?? []),
        ],
      },
      warnings: o.maxV ? [{ when: `v(VCC, GND) > ${o.maxV}`, level: 'error', message: `This module runs from ${o.maxV <= 3.7 ? '3.3 V' : 'at most ' + o.maxV + ' V'}.` }] : undefined,
    },
    {
      vars: o.vars,
      fields: (o.fields ?? []).map((f) => ({ key: f.key, label: f.label, kind: 'send' as const, placeholder: f.placeholder })),
      setup(bld, comp) {
        const powered = poweredFn(bld, o.minV);
        const term = scrollback(bld.state);
        const state = (bld.state.dev ??= {}) as Record<string, any>;
        const out = new Outbox((t) => bld.uartSend(o.tx, t));
        const send = (t: string, delayMs = 3) => out.push(t, delayMs * 1000, bld.now());
        bld.registerDevice({
          kind: 'uart', pins: { rx: o.rx, tx: o.tx }, powered,
          receive: (text) => o.respond({ text, send, log: (t) => term.add(t), props: comp.props, state, now: bld.now() }),
        });
        return {
          values: o.values ? () => o.values!(state, comp.props) : undefined,
          afterStep() {
            if (!powered()) return;
            out.flush(bld.now());
            for (const f of o.fields ?? []) for (const t of drain(bld.input, f.key)) o.onUser?.({ key: f.key, text: t, send, log: (x) => term.add(x), props: comp.props, state });
          },
          frame: () => ({ term: term.lines(Math.floor(o.screen.h / 5)) }),
        };
      },
      overlay: ({ sim }) => (sim ? <TextLines {...o.screen} lines={(sim.term as string[]) ?? []} size={4} /> : null),
    },
  ];
}

/** Accumulate bytes into CR/LF-terminated lines. */
function lines(state: Record<string, any>, text: string, fn: (line: string) => void) {
  state.buf = (state.buf ?? '') + text;
  let i: number;
  while ((i = state.buf.search(/\r?\n/)) >= 0) {
    const l = state.buf.slice(0, i);
    state.buf = state.buf.slice(i + (state.buf[i] === '\r' ? 2 : 1));
    fn(l);
  }
  if (state.buf.length > 512) state.buf = state.buf.slice(-512);
}

const hc05 = uartModule({
  type: 'hc05', name: 'Bluetooth module (HC-05)', title: 'HC-05', color: COL.pcbBlue, h: 80, minV: 3.4, titleAt: [22, -17],
  pins: ['STATE', 'RXD', 'TXD', 'GND', 'VCC', 'EN'], rx: 'RXD', tx: 'TXD',
  labels: { STATE: 'State (HIGH when paired)', RXD: 'RX (from the board TX — 3.3 V: use a divider)', TXD: 'TX (to the board RX)', VCC: '+3.6–6 V', EN: 'EN / KEY (HIGH at power-up = AT mode)' },
  description: 'Bluetooth serial (SPP) module: whatever the board prints to it appears on the paired phone (shown on the module), and what you type in the phone box arrives at the board\'s RX. 9600 baud. Pull EN high at power-up for AT commands (AT, AT+NAME?, AT+VERSION?).',
  keywords: ['bluetooth', 'hc-05', 'hc-06', 'serial bluetooth', 'spp', 'wireless', 'phone'],
  screen: { x: -3, y: -76, w: 56, h: 36 },
  props: [{ key: 'paired', label: 'Phone', type: 'select', default: 1, options: [{ value: 1, label: 'Paired & connected' }, { value: 0, label: 'Not connected' }] }],
  fields: [{ key: 'phone', label: 'Phone sends', placeholder: 'e.g. ON' }],
  extraShapes: [
    // the HC-05 daughter board: antenna, BC417 radio and flash, on the blue carrier
    ...pcb(-6, -80, 60, 44, '#1c7040', { holes: 'none', rx: 1 }),
    meander(-2, -77, 50, 3, 3.5),
    ...chip(4, -62, 14, 14, { legs: 'qfn', label: 'BC417' }), ...chip(28, -60, 14, 9, { n: 4, label: 'FLASH' }), ...crystalCan(28, -48, 14, 5),
    ...tactSwitch(63, -68, 9), silk(63, -58, 'KEY', 2.4), ...smdRow(-16, -28, 5, 5, false, 'rcrcr'), ...chip(40, -30, 9, 5, { n: 3, label: '662K' }),
  ],
  extraElements: [{ id: 'OST', kind: 'vsource', p: 'STATE', n: 'GND', value: 'paired == 1 && v(VCC, GND) > 3.4 ? 3.3 : 0', r: 1000 }, { id: 'REN', kind: 'resistor', a: 'EN', b: 'GND', value: 1e6 }],
  indicators: [{ shape: circle(63, -40, 2.2, '#ff3b30'), color: '#ff3b30', level: 'paired == 1 ? 1 : (bit(floor(t * 4), 0))' }],
  respond: ({ text, send, log, props, state }) => {
    if (Number(props.paired) !== 1) {
      lines(state, text, (l) => {
        const cmd = l.trim().toUpperCase();
        if (!cmd.startsWith('AT')) return;
        const rep: Record<string, string> = { AT: 'OK', 'AT+NAME?': '+NAME:HC-05\r\nOK', 'AT+VERSION?': '+VERSION:2.0-20100601\r\nOK', 'AT+ADDR?': '+ADDR:98d3:31:fd2e45\r\nOK', 'AT+UART?': '+UART:9600,0,0\r\nOK', 'AT+ROLE?': '+ROLE:0\r\nOK', 'AT+PSWD?': '+PSWD:1234\r\nOK' };
        send(`${rep[cmd] ?? (cmd.includes('=') ? 'OK' : 'ERROR:(0)')}\r\n`);
      });
      return;
    }
    log(text);
  },
  onUser: ({ text, send, log }) => {
    log(`> ${text}`);
    send(text, 1);
  },
});

const esp01 = uartModule({
  type: 'esp01', name: 'Wi-Fi module (ESP-01, ESP8266 AT)', title: 'ESP-01', color: COL.pcbBlack, h: 70, w: 70, minV: 2.8, maxV: 3.6, titleAt: [64, -20],
  pins: ['GND', 'IO2', 'IO0', 'RX', 'TX', 'EN', 'RST', 'VCC'], rx: 'RX', tx: 'TX',
  labels: { GND: 'GND', IO2: 'GPIO2', IO0: 'GPIO0 (LOW at boot = flash mode)', RX: 'RX (3.3 V logic)', TX: 'TX', EN: 'CH_PD / EN (HIGH)', RST: 'Reset', VCC: '3.3 V (up to 300 mA)' },
  description: 'ESP8266 with the AT-command firmware: drive it over serial (115200 baud by default) — AT+CWJAP="ssid","pass" joins a (simulated) network, AT+CIPSTART / AT+CIPSEND talk to a server that answers HTTP requests with 200 OK. 3.3 V only.',
  keywords: ['esp-01', 'esp01', 'esp8266', 'wifi', 'wi-fi', 'at commands', 'iot'],
  screen: { x: -5, y: -66, w: 80, h: 36 },
  extraShapes: [
    meander(-6, -68, 14, 7, 5), ...chip(14, -60, 16, 16, { legs: 'qfn', label: 'ESP8266', sub: 'EX' }), ...chip(38, -58, 14, 9, { n: 4, label: '25Q80' }),
    ...crystalCan(56, -60, 16, 6, '26.000'), ...smdRow(38, -42, 6, 5, false, 'crcrcc'), ...smdRow(14, -38, 3, 5, false, 'rcr'),
  ],
  extraElements: ['IO2', 'IO0', 'EN', 'RST'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: 'VCC', b: p, value: 1e5 })),
  respond: ({ text, send, log, state }) => {
    if (state.sendLeft > 0) {
      const chunk = text.slice(0, state.sendLeft);
      state.sendLeft -= chunk.length;
      state.payload = (state.payload ?? '') + chunk;
      if (state.sendLeft <= 0) {
        log(`→ ${state.payload.split('\r\n')[0]}`);
        send(`\r\nRecv ${state.payload.length} bytes\r\n\r\nSEND OK\r\n`, 20);
        if (/^(GET|POST|HEAD) /.test(state.payload)) {
          const body = '{"ok":true,"temp":21.5}';
          const resp = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`;
          send(`\r\n+IPD,${resp.length}:${resp}`, 150);
          send('CLOSED\r\n', 180);
        }
        state.payload = '';
      }
      return;
    }
    lines(state, text, (l) => {
      const cmd = l.trim();
      if (!cmd) return;
      log(cmd.length > 40 ? cmd.slice(0, 40) : cmd);
      const up = cmd.toUpperCase();
      const ok = (extra = '', ms = 5) => send(`${cmd}\r\n${extra}\r\nOK\r\n`, ms);
      if (up === 'AT' || up === 'ATE0' || up === 'ATE1' || up.startsWith('AT+CWMODE') || up.startsWith('AT+CIPMUX') || up.startsWith('AT+UART') || up.startsWith('AT+CIPMODE')) ok();
      else if (up === 'AT+RST') {
        ok();
        send('\r\n ets Jan  8 2013,rst cause:2, boot mode:(3,7)\r\n\r\nready\r\n', 600);
      } else if (up === 'AT+GMR') ok('AT version:1.7.4.0\r\nSDK version:3.0.4\r\ncompile time:May 27 2020');
      else if (up.startsWith('AT+CWJAP=')) {
        state.ssid = /"([^"]*)"/.exec(cmd)?.[1] ?? 'wifi';
        send(`${cmd}\r\nWIFI CONNECTED\r\n`, 1500);
        send('WIFI GOT IP\r\n\r\nOK\r\n', 2500);
      } else if (up === 'AT+CWJAP?') ok(state.ssid ? `+CWJAP:"${state.ssid}","aa:bb:cc:dd:ee:ff",6,-58` : 'No AP');
      else if (up === 'AT+CWLAP') ok('+CWLAP:(3,"HomeWiFi",-52,"aa:bb:cc:dd:ee:ff",6)\r\n+CWLAP:(4,"Office",-71,"11:22:33:44:55:66",11)', 2000);
      else if (up === 'AT+CIFSR') ok(state.ssid ? '+CIFSR:STAIP,"192.168.1.42"\r\n+CIFSR:STAMAC,"5c:cf:7f:01:02:03"' : '+CIFSR:STAIP,"0.0.0.0"');
      else if (up.startsWith('AT+CIPSTART')) send(state.ssid ? `${cmd}\r\nCONNECT\r\n\r\nOK\r\n` : `${cmd}\r\n\r\nERROR\r\n`, 300);
      else if (up.startsWith('AT+CIPSEND=')) {
        state.sendLeft = Number(cmd.split('=')[1].split(',').pop()) || 0;
        state.payload = '';
        send(`${cmd}\r\n\r\nOK\r\n> `, 10);
      } else if (up === 'AT+CIPCLOSE') send(`${cmd}\r\nCLOSED\r\n\r\nOK\r\n`, 10);
      else send(`${cmd}\r\n\r\nERROR\r\n`, 5);
    });
  },
});

const sim800 = uartModule({
  type: 'sim800l', name: 'GSM module (SIM800L)', title: 'SIM800L', color: COL.pcbRed, h: 80, w: 80, minV: 3.4, maxV: 4.4, titleAt: [46, -24],
  pins: ['NET', 'VCC', 'RST', 'RXD', 'TXD', 'GND'], rx: 'RXD', tx: 'TXD',
  labels: { NET: 'Antenna', VCC: '3.7–4.2 V (LiPo; peaks 2 A!)', RST: 'Reset', RXD: 'RX', TXD: 'TX' },
  description: 'Quad-band GSM/GPRS modem: AT commands over serial (9600 baud) to send SMS (AT+CMGF=1, AT+CMGS="+number" then the text and Ctrl-Z), place calls (ATD…;) and check the signal (AT+CSQ). Sent messages show on the module; type in the box to receive an SMS. Needs 3.7–4.2 V.',
  keywords: ['gsm', 'sim800l', 'sim800', 'sms', 'gprs', 'cellular', 'modem', 'lte', 'sim900'],
  screen: { x: -3, y: -76, w: 70, h: 36 },
  fields: [{ key: 'sms', label: 'Receive an SMS', placeholder: 'message text' }],
  extraShapes: [
    rect(-2, -78, 40, 32, '#f1f3f5', { rx: 1.5, grad: '#8a929b', gradDir: 'd', shadow: 1, stroke: '#6d757e', strokeWidth: 0.4 }),
    text(18, -64, 'SIMCOM', 3.6, '#3a3d42', 'middle', { weight: 800 }), text(18, -58, 'SIM800L', 3.2, '#3a3d42', 'middle', { weight: 600 }),
    rect(42, -78, 22, 30, '#dfe3e7', { rx: 1, grad: '#8a929b', gradDir: 'h', shadow: 0.8 }), rect(45, -75, 16, 20, '#c5cbd2', { rx: 1 }), silk(53, -44, 'SIM', 2.4),
    ...Array.from({ length: 7 }, (_, i) => line(-10, -80 + i * 3, -4, -78.5 + i * 3, '#d9b45a', 1.2)), ...smdRow(0, -40, 5, 5, false, 'crcrc'),
  ],
  extraElements: [{ id: 'RRST', kind: 'resistor', a: 'VCC', b: 'RST', value: 1e5 }, { id: 'RNET', kind: 'resistor', a: 'NET', b: 'GND', value: 1e9 }],
  indicators: [{ shape: circle(70, -30, 2.2, '#ff3b30'), color: '#ff3b30', level: 'bit(floor(t / 3), 0) == 0 && mod(t, 3) < 0.064 ? 1 : 0' }],
  respond: ({ text, send, log, state }) => {
    if (state.sms !== undefined) {
      const k = text.indexOf('\x1a');
      state.sms += k < 0 ? text : text.slice(0, k);
      if (k >= 0) {
        log(`SMS to ${state.to}: ${state.sms.trim()}`);
        state.count = (state.count ?? 0) + 1;
        send(`\r\n+CMGS: ${state.count}\r\n\r\nOK\r\n`, 2500);
        state.sms = undefined;
      }
      return;
    }
    lines(state, text, (l) => {
      const cmd = l.trim();
      if (!cmd) return;
      const up = cmd.toUpperCase();
      const ok = (extra = '', ms = 5) => send(`${cmd}\r\n${extra ? extra + '\r\n' : ''}\r\nOK\r\n`, ms);
      if (up.startsWith('AT+CMGS=')) {
        state.to = /"([^"]*)"/.exec(cmd)?.[1] ?? '?';
        state.sms = '';
        send(`${cmd}\r\n> `, 20);
      } else if (up === 'AT+CSQ') ok('+CSQ: 21,0');
      else if (up === 'AT+CREG?') ok('+CREG: 0,1');
      else if (up === 'ATI') ok('SIM800 R14.18');
      else if (up === 'AT+CCID') ok('89441000303049123456');
      else if (up === 'AT+COPS?') ok('+COPS: 0,0,"Vodafone"');
      else if (up === 'AT+CBC') ok('+CBC: 0,82,4012');
      else if (up.startsWith('ATD')) {
        log(`Calling ${cmd.slice(3).replace(';', '')}…`);
        ok('', 50);
      } else if (up === 'ATH') {
        log('Call ended');
        ok();
      } else if (up.startsWith('AT')) ok();
    });
  },
  onUser: ({ text, send, log, state }) => {
    state.inbox = (state.inbox ?? 0) + 1;
    log(`SMS in: ${text.trim()}`);
    send(`\r\n+CMT: "+15551234567","","26/09/26,12:00:00+00"\r\n${text.trim()}\r\n`, 1);
  },
});

const usbTtl = (type: string, name: string, chipName: string, color: string): DevicePart =>
  uartModule({
    type, name, title: chipName, color, h: 50, w: 80, minV: 0, titleAt: [44, -20],
    pins: ['DTR', 'RXD', 'TXD', 'VCC', 'V33', 'GND'], rx: 'RXD', tx: 'TXD',
    labels: { DTR: 'DTR (auto-reset)', RXD: 'RX ← connect to the board\'s TX', TXD: 'TX → connect to the board\'s RX', VCC: '5 V from USB', V33: '3.3 V out', GND: 'GND' },
    description: `USB-to-serial (TTL) adapter with a ${chipName}: a computer terminal on the other end. Cross the wires (adapter TX → board RX, adapter RX → board TX), join the grounds. The module shows what it receives; type in the box to send. It also supplies 5 V / 3.3 V from USB.`,
    keywords: ['usb to ttl', 'usb serial', 'ftdi', 'cp2102', 'ch340', 'uart adapter', 'serial terminal', 'usb-to-serial'],
    screen: { x: -24, y: -50, w: 68, h: 28 },
    fields: [{ key: 'tx', label: 'Terminal sends' }],
    extraShapes: [...usbPort(62, -34, 'a', 'r'), ...chip(-12, -46, 16, 10, { n: 8, label: chipName }), ...crystalCan(10, -44, 14, 5, '12.000'), ...smdRow(-10, -30, 7, 5, false, 'rcrcrcr'), ...jumper(36, -40), silk(36, -46, '5V 3V3', 2.4)],
    extraElements: [{ id: 'U5', kind: 'vsource', p: 'VCC', n: 'GND', value: 5, r: 0.3 }, { id: 'U3', kind: 'vsource', p: 'V33', n: 'GND', value: 3.3, r: 1 }, { id: 'RDTR', kind: 'resistor', a: 'DTR', b: 'GND', value: 1e6 }],
    respond: ({ text, log }) => log(text),
    onUser: ({ text, send, log }) => {
      log(`> ${text}`);
      send(text, 1);
    },
  });

// ------------------------------------------------------------------ RS-485 (MAX485)

const max485: DevicePart = (() => {
  const b = moduleBoard(['RO', 'RE', 'DE', 'DI'], { h: 80, w: 50, color: COL.pcbBlue, title: 'MAX485', titleY: -22, titleSize: 3.2, holes: 'none', labels: { RO: 'Receiver out (→ board RX)', RE: 'RE (LOW = receive)', DE: 'DE (HIGH = transmit)', DI: 'Driver in (← board TX)' } });
  const pw = pinRow(['VCC', 'B', 'A', 'GND'], { x0: 0, y: -70, kind: 'terminal', labels: { VCC: '+5 V', B: 'B (−)', A: 'A (+)', GND: 'GND' } });
  return [
    {
      type: 'max485', name: 'RS-485 transceiver (MAX485 module)', category: 'comms',
      description: 'Turns a serial port into a long-distance differential RS-485 bus (up to 1.2 km, 32 nodes). Join A to A and B to B between modules; drive DE+RE HIGH to transmit and LOW to listen. Bytes sent on DI appear on RO of the listening modules.',
      keywords: ['rs485', 'max485', 'rs-485', 'modbus', 'differential', 'half duplex', 'transceiver'],
      pins: [...b.pins, ...pw],
      shapes: [...b.shapes, ...screwTerminals(pw, '#2f7fd6', 'up'), silk(0, -58, 'VCC', 2.4), silk(10, -58, 'B', 2.6), silk(20, -58, 'A', 2.6), silk(30, -58, 'GND', 2.4), ...chip(4, -48, 20, 10, { n: 4, label: 'MAX485' }), ...smdRow(-6, -32, 4, 5, false, 'rrcr'), ...smdRow(22, -32, 2, 5, false, 'rc')],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e4 }, { id: 'TERM', kind: 'resistor', a: 'A', b: 'B', value: 1e4 }, { id: 'ORO', kind: 'vsource', p: 'RO', n: 'GND', value: 'v(VCC, GND) > 4 ? 5 : 0', r: 200 }, ...['RE', 'DE', 'DI'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }))] },
    },
    {
      setup(bld) {
        const powered = poweredFn(bld, 4);
        const self = bld.registerDevice({
          kind: 'rs485', pins: { rx: 'DI', tx: 'RO', a: 'A' }, powered,
          receive(text) {
            if (!bld.levelAt('DE')) return; // not transmitting
            for (const peer of bld.peers('rs485')) {
              if (peer === self || !peer.powered() || !bld.sameNet('A', peer, 'A')) continue;
              peer.api?.deliver(text);
            }
          },
          api: {
            deliver(text: string) {
              if (bld.levelAt('RE') === 0 || !bld.connected('RE')) bld.uartSend('RO', text);
            },
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ SPI monitor

const spiMonitor: DevicePart = (() => {
  const b = moduleBoard(['CS', 'SCK', 'MOSI', 'MISO', 'GND'], { h: 60, w: 100, color: '#2b2d31', title: 'SPI MONITOR', labels: { CS: 'Chip select to watch', SCK: 'SCK', MOSI: 'MOSI', MISO: 'MISO', GND: 'GND' } });
  return [
    {
      type: 'spi-monitor', name: 'SPI interface monitor', category: 'comms',
      description: 'A tiny protocol analyser: clip it onto an SPI bus (CS, SCK, MOSI, MISO) and it lists the bytes exchanged while that CS is LOW (MOSI → / ← MISO, in hex). Handy for debugging SPI drivers.',
      keywords: ['spi', 'logic analyzer', 'protocol analyzer', 'spi monitor', 'debug', 'spi interface'],
      pins: b.pins,
      shapes: b.shapes,
      model: { elements: ['CS', 'SCK', 'MOSI', 'MISO'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e8 })) },
    },
    {
      setup(bld) {
        const term = scrollback(bld.state);
        let cur: string[] = [];
        bld.registerDevice({
          kind: 'spi-spy', pins: { cs: 'CS', sck: 'SCK' }, powered: () => true,
          watch: {
            cs: (v) => {
              if (v && cur.length) {
                term.add(`${cur.join(' ')}\n`);
                cur = [];
              }
            },
          },
          api: { observe: (mosi: number, miso: number) => cur.push(`${mosi.toString(16).padStart(2, '0')}/${miso.toString(16).padStart(2, '0')}`) },
        });
        return { frame: () => ({ term: term.lines(8) }) };
      },
      overlay: ({ sim }) => (sim ? <TextLines x={-44} y={-58} w={128} h={42} lines={(sim.term as string[]) ?? []} size={3.8} /> : null),
    },
  ];
})();

export const COMM_DEVICES: DevicePart[] = [rc522, pn532, nrf24, mcp2515, gps, hc05, esp01, sim800, max485, usbTtl('usb-ttl', 'USB-to-TTL adapter (CP2102)', 'CP2102', COL.pcbRed), usbTtl('usb-serial', 'USB-to-serial converter (CH340)', 'CH340', COL.pcbBlue), spiMonitor];

