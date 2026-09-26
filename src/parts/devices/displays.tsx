/** Display devices driven by libraries: NeoPixel strips, SSD1306 OLEDs, MAX7219 matrix, 74HC595. */
import { chip, circle, dip, ecap, header, line, moduleBoard, path, pcb, pinRow, rect, smd, smdRow, tri, type Raw } from '../kit';

/** a WS2812B package: white 5050 body, the dark window over the three dies */
const ws2812 = (x: number, y: number): Raw[] => [
  rect(x - 3.4, y - 3.4, 6.8, 6.8, '#fbfbf9', { rx: 0.6, grad: '#d9d8d2', shadow: 0.6 }),
  circle(x, y, 2.4, '#e9e6de', { grad: '#b9b4a6', gradDir: 'r' }),
  rect(x - 1.1, y - 1.3, 0.8, 0.8, '#3a3d42'), rect(x + 0.3, y - 1.3, 0.8, 0.8, '#3a3d42'), rect(x - 0.4, y + 0.4, 0.8, 0.8, '#3a3d42'),
];
import { poweredFn, type DevicePart } from './common';

// ------------------------------------------------------------------ NeoPixel

function neoPixel(type: string, name: string, n: number, pos: (i: number) => [number, number], body: Raw[], pins: Raw[], description: string): DevicePart {
  const leds = Array.from({ length: n }, (_, i) => pos(i));
  return [
    {
      type, name, category: 'diodes', description,
      keywords: ['neopixel', 'ws2812', 'ws2812b', 'addressable led', 'rgb strip', 'led strip', 'fastled', 'sk6812'],
      pins,
      shapes: [...body, ...leds.flatMap(([x, y]) => ws2812(x, y))],
      model: {
        elements: [
          { id: 'LOAD', kind: 'isource', p: 'GND', n: 'VCC', value: 'v(VCC, GND) > 3 ? iload : 0' },
          { id: 'RIN', kind: 'resistor', a: 'DIN', b: 'GND', value: 1e6 },
          { id: 'ROUT', kind: 'resistor', a: 'DOUT', b: 'GND', value: 1e6 },
        ],
      },
      warnings: [{ when: 'v(VCC, GND) > 5.6', level: 'error', message: 'WS2812 LEDs are 5 V parts.' }],
    },
    {
      vars: ['iload'],
      setup(b) {
        const powered = poweredFn(b, 3.5);
        const st = b.state as { colors?: number[] };
        st.colors ??= new Array(n).fill(0);
        b.registerDevice({
          kind: 'neopixel', key: 'din', pins: { din: 'DIN', dout: 'DOUT' }, powered,
          api: {
            show(colors: number[]) {
              st.colors = colors.slice(0, n).concat(new Array(Math.max(0, n - colors.length)).fill(0));
              const rest = colors.slice(n);
              if (rest.length) b.deviceOn('DOUT', 'neopixel')?.api?.show(rest);
            },
          },
        });
        const current = () => {
          if (!powered()) return 0;
          let sum = 0;
          for (const c of st.colors!) sum += ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255) + ((c >>> 24) & 255);
          return n * 0.0008 + (sum / 255) * 0.02;
        };
        return {
          values: () => ({ iload: current() }),
          frame: () => ({ colors: powered() ? [...st.colors!] : null }),
          warnings: () => (current() > 2 ? [{ level: 'warn', message: `The LEDs draw ${current().toFixed(1)} A — a board's 5 V pin can't supply that; use a separate 5 V supply.` }] : []),
        };
      },
      overlay: ({ sim }) => {
        const colors = sim?.colors as number[] | null | undefined;
        if (!colors) return null;
        return (
          <g style={{ pointerEvents: 'none' }}>
            {leds.map(([x, y], i) => {
              const c = colors[i] ?? 0;
              const r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255, w = (c >>> 24) & 255;
              const lvl = Math.max(r, g, bl, w);
              if (lvl < 3) return null;
              const k = 255 / lvl;
              const fill = `rgb(${Math.min(255, (r + w) * k)},${Math.min(255, (g + w) * k)},${Math.min(255, (bl + w) * k)})`;
              return (
                <g key={i} opacity={0.35 + (0.65 * lvl) / 255} style={{ filter: `drop-shadow(0 0 ${2 + (4 * lvl) / 255}px ${fill})` }}>
                  <circle cx={x} cy={y} r={2.8} fill={fill} />
                </g>
              );
            })}
          </g>
        );
      },
    },
  ];
}

const neoPins = (x0 = 0) => pinRow(['GND', 'VCC', 'DIN', 'DOUT'], { x0, labels: { VCC: '+5 V', DIN: 'Data in', DOUT: 'Data out (to the next strip)' } });

// ------------------------------------------------------------------ SSD1306 OLED

interface OledState {
  gram: Uint8Array;
  on: boolean;
  invert: boolean;
  contrast: number;
  mode: number;
  col: number;
  page: number;
  c0: number;
  c1: number;
  p0: number;
  p1: number;
  flipX: boolean;
  flipY: boolean;
}

/** SSD1306 command/data stream decoder (the subset libraries use). */
export function ssd1306Write(s: OledState, bytes: number[], pages: number) {
  let i = 0;
  while (i < bytes.length) {
    const ctrl = bytes[i++];
    const isData = (ctrl & 0x40) !== 0;
    const single = (ctrl & 0x80) !== 0;
    const chunk = single ? bytes.slice(i, i + 1) : bytes.slice(i);
    i += chunk.length;
    if (isData) {
      for (const b of chunk) {
        s.gram[(s.page % 8) * 128 + (s.col % 128)] = b;
        if (s.mode === 2) s.col = (s.col + 1) % 128;
        else if (s.col >= s.c1) {
          s.col = s.c0;
          s.page = s.page >= s.p1 ? s.p0 : s.page + 1;
        } else s.col++;
      }
    } else {
      for (let k = 0; k < chunk.length; k++) {
        const c = chunk[k];
        const arg = () => chunk[++k] ?? 0;
        if (c === 0xae) s.on = false;
        else if (c === 0xaf) s.on = true;
        else if (c === 0xa6) s.invert = false;
        else if (c === 0xa7) s.invert = true;
        else if (c === 0x81) s.contrast = arg();
        else if (c === 0x20) s.mode = arg() & 3;
        else if (c === 0x21) { s.c0 = arg() & 127; s.c1 = arg() & 127; s.col = s.c0; }
        else if (c === 0x22) { s.p0 = arg() & 7; s.p1 = Math.min(arg() & 7, pages - 1); s.page = s.p0; }
        else if (c >= 0xb0 && c <= 0xb7) s.page = c & 7;
        else if (c <= 0x0f) s.col = (s.col & 0xf0) | c;
        else if (c >= 0x10 && c <= 0x1f) s.col = ((c & 0x0f) << 4) | (s.col & 0x0f);
        else if (c === 0xa0) s.flipX = false;
        else if (c === 0xa1) s.flipX = true;
        else if (c === 0xc0) s.flipY = false;
        else if (c === 0xc8) s.flipY = true;
        else if ([0xa8, 0xd3, 0xd5, 0xd9, 0xda, 0xdb, 0x8d].includes(c)) arg();
        else if (c === 0x26 || c === 0x27) k += 6;
        else if (c === 0x29 || c === 0x2a) k += 5;
        else if (c === 0xa3) k += 2;
      }
    }
  }
}

function oled(type: string, name: string, h: number): DevicePart {
  const pages = h / 8;
  const b = moduleBoard(['GND', 'VCC', 'SCL', 'SDA'], { h: h === 64 ? 96 : 44, w: 112, color: '#1d3c80', labels: { VCC: '+3.3–5 V', SCL: 'I2C clock', SDA: 'I2C data' } });
  const scr = { x: -36, y: h === 64 ? -86 : -38, w: 102, px: 102 / 128 };
  const scrH = h * scr.px;
  return [
    {
      type, name, category: 'displays',
      description: `${h === 64 ? '0.96"' : '0.91"'} monochrome OLED, 128 × ${h} pixels, SSD1306 controller on I2C (address 0x3C). Draw text and graphics with Adafruit_SSD1306 / Adafruit_GFX (or raw Wire commands).`,
      keywords: ['oled', 'ssd1306', 'display', '128x64', '128x32', 'i2c display', 'screen', 'adafruit_ssd1306'],
      pins: b.pins,
      props: [{ key: 'addr', label: 'I2C address', type: 'select', default: 0x3c, options: [{ value: 0x3c, label: '0x3C' }, { value: 0x3d, label: '0x3D' }] }],
      shapes: [
        ...b.shapes,
        rect(scr.x - 3.5, scr.y - 4, scr.w + 7, scrH + (h === 64 ? 16 : 9), '#dfe3e7', { rx: 1, grad: '#b8c0c8', opacity: 0.55 }),
        rect(scr.x - 3, scr.y - 3, scr.w + 6, scrH + 6, '#15171b', { rx: 1.2, shadow: 0.8 }),
        rect(scr.x, scr.y, scr.w, scrH, '#040506'),
        path(`M ${scr.x} ${scr.y} L ${scr.x + scr.w * 0.35} ${scr.y} L ${scr.x + scr.w * 0.18} ${scr.y + scrH} L ${scr.x} ${scr.y + scrH} Z`, '#ffffff', { opacity: 0.04 }),
        rect(scr.x + scr.w / 2 - 14, scr.y + scrH + 3, 28, h === 64 ? 6 : 3, '#e0a257', { opacity: 0.8, rx: 0.5 }),
      ],
      model: { elements: [{ id: 'IQ', kind: 'rvar', a: 'VCC', b: 'GND', value: 'v(VCC, GND) > 2 ? 250 : 1e6' }, { id: 'RSDA', kind: 'resistor', a: 'SDA', b: 'GND', value: 1e6 }, { id: 'RSCL', kind: 'resistor', a: 'SCL', b: 'GND', value: 1e6 }] },
    },
    {
      setup(bld, comp) {
        const powered = poweredFn(bld, 2.8);
        const st = (bld.state.oled ??= { gram: new Uint8Array(1024), on: false, invert: false, contrast: 0xcf, mode: 2, col: 0, page: 0, c0: 0, c1: 127, p0: 0, p1: pages - 1, flipX: false, flipY: false }) as OledState;
        bld.registerI2C({
          address: Number(comp.props.addr ?? 0x3c), sda: 'SDA', scl: 'SCL', powered,
          device: { write: (bytes) => ssd1306Write(st, bytes, pages), read: (n) => new Array(n).fill(0x40) },
        });
        let wasOn = true;
        return {
          afterStep() {
            const p = powered();
            if (!p && wasOn) {
              st.gram.fill(0);
              st.on = false;
            }
            wasOn = p;
          },
          frame: () => ({ oled: powered() && st.on ? { gram: st.gram.slice(0, pages * 128), invert: st.invert, flipX: st.flipX, flipY: st.flipY } : null }),
        };
      },
      overlay: ({ sim }) => {
        const o = sim?.oled as { gram: Uint8Array; invert: boolean; flipX: boolean; flipY: boolean } | null | undefined;
        if (!o) return null;
        let d = '';
        for (let y = 0; y < h; y++) {
          let run = -1;
          for (let x = 0; x <= 128; x++) {
            // Adafruit's init remaps segments/COM so the buffer shows the right way up
            const gx = o.flipX ? x : 127 - x, gy = o.flipY ? y : h - 1 - y;
            const on = x < 128 && (((o.gram[(gy >> 3) * 128 + gx] >> (gy & 7)) & 1) === 1) !== o.invert;
            if (on && run < 0) run = x;
            if (!on && run >= 0) {
              d += `M${(scr.x + run * scr.px).toFixed(2)} ${(scr.y + y * scr.px).toFixed(2)}h${((x - run) * scr.px).toFixed(2)}v${scr.px.toFixed(2)}h${(-(x - run) * scr.px).toFixed(2)}z`;
              run = -1;
            }
          }
        }
        return <path d={d} fill="#7fd8ff" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 1px #5ec8ff)' }} />;
      },
    },
  ];
}

// ------------------------------------------------------------------ MAX7219 8×8 module (FC-16)

function max7219(): DevicePart {
  const inp = pinRow(['VCC', 'GND', 'DIN', 'CS', 'CLK'], { labels: { VCC: '+5 V', DIN: 'Data in', CS: 'Load (CS)', CLK: 'Clock' } });
  const out = pinRow(['VCC2', 'GND2', 'DOUT', 'CS2', 'CLK2'], { x0: 90, labels: { VCC2: '+5 V out', GND2: 'GND out', DOUT: 'Data out (to the next module)', CS2: 'CS out', CLK2: 'CLK out' } });
  const dot = (r: number, c: number): [number, number] => [45 - 35 + c * 10, -82 + r * 10];
  return [
    {
      type: 'max7219-matrix', name: 'LED matrix module 8×8 (MAX7219)', category: 'displays',
      description: 'MAX7219 driver + 8×8 red LED matrix: 3 wires (DIN, CS, CLK) drive all 64 LEDs, and modules daisy-chain (DOUT → next DIN). Use the LedControl library (or MD_MAX72XX-style raw shifting).',
      keywords: ['max7219', 'led matrix', 'dot matrix', 'fc-16', 'ledcontrol', '8x8', 'scrolling text'],
      pins: [...inp, ...out],
      shapes: [
        ...pcb(-8, -100, 146, 106, '#1d5bb8', { holes: 'none' }),
        ...header(inp), ...header(out),
        ...chip(96, -70, 26, 12, { n: 12, label: 'MAX7219' }), ...ecap(108, -88, 5), ...smdRow(96, -44, 4, 6, false, 'rcrc'),
        rect(3, -95, 84, 84, '#34363b', { rx: 1.5, grad: '#111214', shadow: 1 }),
        ...Array.from({ length: 64 }, (_, i) => ({ ...circle(...dot(Math.floor(i / 8), i % 8), 3.6, '#6d6662'), grad: '#3b3533', gradDir: 'r' })),
        rect(3, -95, 84, 26, '#ffffff', { opacity: 0.04, rx: 1.5 }),
      ],
      connections: [['VCC', 'VCC2'], ['GND', 'GND2'], ['CS', 'CS2'], ['CLK', 'CLK2']],
      model: { elements: [{ id: 'LOAD', kind: 'isource', p: 'GND', n: 'VCC', value: 'v(VCC, GND) > 3 ? iload : 0' }, ...['DIN', 'CS', 'CLK'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 })), { id: 'RDO', kind: 'resistor', a: 'DOUT', b: 'GND', value: 1e6 }] },
    },
    {
      vars: ['iload'],
      setup(b) {
        const powered = poweredFn(b, 4);
        const st = (b.state.max ??= { sr: 0, regs: new Array(16).fill(0) }) as { sr: number; regs: number[] };
        const shift = (bit: number) => {
          const out = (st.sr >> 15) & 1;
          st.sr = ((st.sr << 1) | bit) & 0xffff;
          b.deviceOn('DOUT', 'max7219')?.api?.shift(out);
        };
        b.registerDevice({
          kind: 'max7219', key: 'din', pins: { din: 'DIN', clk: 'CLK', cs: 'CS', dout: 'DOUT' }, powered,
          api: { shift },
          watch: {
            clk: (v) => v && b.boardDriven('DIN') && shift(b.levelAt('DIN')),
            cs: (v) => {
              if (!v) return;
              st.regs[(st.sr >> 8) & 15] = st.sr & 255;
            },
          },
        });
        const lit = () => {
          if (!powered() || !st.regs[0x0c]) return st.regs[0x0f] ? 64 : 0;
          let n = 0;
          for (let r = 1; r <= 8; r++) for (let x = st.regs[r]; x; x >>= 1) n += x & 1;
          return n;
        };
        return {
          values: () => ({ iload: powered() ? 0.008 + lit() * 0.004 * ((st.regs[0x0a] + 1) / 16) : 0 }),
          frame: () => ({ rows: powered() ? (st.regs[0x0f] ? new Array(8).fill(255) : st.regs[0x0c] ? st.regs.slice(1, 9) : new Array(8).fill(0)) : null, bright: (st.regs[0x0a] + 1) / 16 }),
        };
      },
      overlay: ({ sim }) => {
        const rows = sim?.rows as number[] | null | undefined;
        if (!rows) return null;
        const op = 0.45 + 0.55 * Number(sim?.bright ?? 1);
        return (
          <g style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 2px #ff2a1a)' }} opacity={op}>
            {rows.flatMap((v, r) => Array.from({ length: 8 }, (_, c) => ((v >> (7 - c)) & 1 ? <circle key={`${r}-${c}`} cx={dot(r, c)[0]} cy={dot(r, c)[1]} r={3.4} fill="#ff2a1a" /> : null)))}
          </g>
        );
      },
    },
  ];
}

// ------------------------------------------------------------------ 74HC595

function hc595(): DevicePart {
  const names = ['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', 'QHS', 'SRCLR', 'SRCLK', 'RCLK', 'OE', 'SER', 'QA', 'VCC'];
  const d = dip(names, {
    label: '74HC595', sub: 'shift register',
    labels: { SER: 'Serial data in (DS)', SRCLK: 'Shift clock (SH_CP)', RCLK: 'Latch clock (ST_CP)', OE: 'Output enable (active LOW)', SRCLR: 'Clear (active LOW, tie to VCC)', QHS: "QH' serial out (to the next chip's SER)" },
  });
  const en = '(v(OE, GND) < v(VCC, GND) / 2 && v(VCC, GND) > 1.5)';
  return [
    {
      type: '74hc595', name: '74HC595 shift register', category: 'logic',
      description: '8-bit serial-in, parallel-out shift register: shift bits in on SER with SRCLK, then pulse RCLK (latch) to show them on QA–QH. Chain chips through QH\'. Drive it with shiftOut() — 3 pins give you 8, 16, 24… outputs.',
      keywords: ['74hc595', '595', 'shift register', 'shiftout', 'sipo', 'output expander', 'io expander'],
      ...d,
      model: {
        elements: [
          ...['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].flatMap((q, i) => tri(`O${i}`, q, `bit(latch, ${i}) == 1`, en, 'VCC', 'GND', 50)),
          ...tri('OS', 'QHS', 'bit(sr, 7) == 1', 'v(VCC, GND) > 1.5', 'VCC', 'GND', 50),
          ...['SER', 'SRCLK', 'RCLK', 'OE', 'SRCLR'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e7 })),
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e5 },
        ],
      },
    },
    {
      vars: ['latch', 'sr'],
      setup(b) {
        const powered = poweredFn(b, 1.5);
        const st = (b.state.sr595 ??= { sr: 0, latch: 0 }) as { sr: number; latch: number };
        const shift = (bit: number) => {
          if (b.levelAt('SRCLR') === 0 && b.connected('SRCLR')) return;
          const out = (st.sr >> 7) & 1;
          st.sr = ((st.sr << 1) | bit) & 255;
          b.deviceOn('QHS', '595')?.api?.shift(out);
        };
        b.registerDevice({
          kind: '595', key: 'ser', pins: { ser: 'SER', srclk: 'SRCLK', rclk: 'RCLK', srclr: 'SRCLR' }, powered,
          api: { shift },
          watch: {
            srclk: (v) => v && b.boardDriven('SER') && shift(b.levelAt('SER')),
            rclk: (v) => {
              if (v) st.latch = st.sr;
            },
            srclr: (v) => {
              if (!v) st.sr = 0;
            },
          },
        });
        return { values: () => ({ latch: st.latch, sr: st.sr }), frame: () => ({ latch: st.latch }) };
      },
    },
  ];
}

export const DISPLAY_DEVICES: DevicePart[] = [
  neoPixel('neopixel-stick', 'NeoPixel stick (8 × WS2812)', 8, (i) => [i * 10 + 5, -12],
    [...pcb(-4, -22, 88, 16, '#23252a', { holes: 'none', rx: 2 }), ...neoPins(15).map((p) => rect(p.x - 2.4, -5, 4.8, 4, '#e3c25e', { rx: 0.6, grad: '#9c7b26' })), ...Array.from({ length: 8 }, (_, i) => smd(i * 10 + 10, -18.5, 'c')).flat()], neoPins(15),
    '8 addressable RGB LEDs (WS2812B) in a row. Send colours down one data wire with Adafruit_NeoPixel; chain more strips from DOUT. Each LED draws up to 60 mA at full white.'),
  neoPixel('neopixel-ring', 'NeoPixel ring (16 × WS2812)', 16, (i) => [15 + 26 * Math.cos((i * 2 * Math.PI) / 16 - Math.PI / 2), -40 + 26 * Math.sin((i * 2 * Math.PI) / 16 - Math.PI / 2)],
    [circle(15, -40, 32, '#2a2c31', { grad: '#111214', gradDir: 'd', shadow: 1 }), circle(15, -40, 20, '#f3f4f6', { grad: '#d5d9de', gradDir: 'd' }), ...Array.from({ length: 16 }, (_, i) => { const a = (i * 2 * Math.PI) / 16 - Math.PI / 2 + 0.2; return smd(15 + 21.5 * Math.cos(a), -40 + 21.5 * Math.sin(a), 'c'); }).flat(), line(0, 0, 0, -9, '#26282c', 1.6), line(10, 0, 10, -9, '#d63c35', 1.6), line(20, 0, 20, -9, '#3ec46d', 1.6), line(30, 0, 30, -9, '#f2f4f6', 1.6)], neoPins(0),
    '16 WS2812B RGB LEDs on a ring — clocks, spinners, level meters. Adafruit_NeoPixel with 16 pixels; chain more from DOUT.'),
  neoPixel('neopixel-strip', 'NeoPixel LED strip (30 × WS2812B)', 30, (i) => [i * 10 + 5, -12],
    [path('M -30 0 C -30 -8 -12 -12 -4 -12', 'none', { stroke: '#26282c', strokeWidth: 1.6 }), path('M -20 0 C -20 -6 -12 -9 -4 -9', 'none', { stroke: '#d63c35', strokeWidth: 1.6 }), path('M -10 0 C -10 -3 -8 -6 -4 -6', 'none', { stroke: '#3ec46d', strokeWidth: 1.6 }), line(304, -12, 310, 0, '#3ec46d', 1.6), rect(-4, -21, 308, 18, '#fbfbf9', { rx: 1, grad: '#d9d8d2', shadow: 0.9 }), rect(-4, -21, 308, 2, '#ffffff', { opacity: 0.6 }), ...Array.from({ length: 10 }, (_, i) => [line(i * 30 + 30, -21, i * 30 + 30, -3, '#c9a24a', 0.8), rect(i * 30 + 27, -20, 6, 3, '#e3c25e', { rx: 0.4 }), rect(i * 30 + 27, -7, 6, 3, '#e3c25e', { rx: 0.4 })]).flat(), ...Array.from({ length: 30 }, (_, i) => smd(i * 10 + 10, -18, 'r')).flat()], neoPins(0).map((p, i) => ({ ...p, x: [-30, -20, -10, 310][i], y: 0 })),
    '1 m of addressable LED strip, 30 WS2812B pixels. Power it from a 5 V supply (it can draw 1.8 A at full white!) and join the grounds; data from any pin through ~330 Ω.'),
  oled('oled-128x64', 'OLED display 0.96" (SSD1306 128×64)', 64),
  oled('oled-128x32', 'OLED display 0.91" (SSD1306 128×32)', 32),
  max7219(),
  hc595(),
];


