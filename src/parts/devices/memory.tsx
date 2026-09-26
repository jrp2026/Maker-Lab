/** Memory & timekeeping devices: 24LC256 EEPROM, W25Q32 flash, DS1307 / DS3231 RTCs, SD card modules. */
import { bin2bcd, bcd2bin } from '../../mcu/devlibs/i2c';
import type { SdCard } from '../../mcu/stdlib';
import { COL, dip, moduleBoard, rect, text } from '../kit';
import { poweredFn, TextLines, type DevicePart } from './common';

// ------------------------------------------------------------------ 24LC256

const eeprom24: DevicePart = (() => {
  const d = dip(['A0', 'A1', 'A2', 'GND', 'SDA', 'SCL', 'WP', 'VCC'], { label: '24LC256', sub: '32 KB EEPROM', labels: { A0: 'Address bit 0', A1: 'Address bit 1', A2: 'Address bit 2', WP: 'Write protect (HIGH = read-only)', SDA: 'I2C data', SCL: 'I2C clock' } });
  return [
    {
      type: '24lc256', name: 'I2C EEPROM (24LC256)', category: 'memory',
      description: '32 KB non-volatile memory on I2C (0x50 + A2 A1 A0). Write: two address bytes then up to 64 data bytes (one page); read: set the address, then request bytes. Data survives power-off (and rebuilds). WP HIGH blocks writes.',
      keywords: ['eeprom', '24lc256', 'at24c256', 'i2c eeprom', 'memory', 'storage', 'at24c32'],
      ...d,
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e5 }, ...['A0', 'A1', 'A2', 'WP', 'SDA', 'SCL'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e7 }))] },
    },
    {
      setup(b) {
        const mem = (b.state.mem ??= new Uint8Array(32768).fill(0xff)) as Uint8Array;
        let ptr = 0;
        const bitAt = (p: string) => (b.connected(p) && b.levelAt(p) ? 1 : 0);
        const addr = 0x50 | (bitAt('A2') << 2) | (bitAt('A1') << 1) | bitAt('A0');
        b.registerI2C({
          address: addr, sda: 'SDA', scl: 'SCL', powered: poweredFn(b, 1.7),
          device: {
            write: (x) => {
              if (x.length < 2) return;
              ptr = ((x[0] << 8) | x[1]) & 0x7fff;
              if (x.length > 2 && !(b.connected('WP') && b.levelAt('WP'))) {
                const page = ptr & ~63;
                for (let i = 2; i < x.length; i++) {
                  mem[page | (ptr & 63)] = x[i];
                  ptr = page | ((ptr + 1) & 63); // wraps inside the 64-byte page, like the chip
                }
              }
            },
            read: (n) => {
              const out: number[] = [];
              for (let i = 0; i < n; i++) {
                out.push(mem[ptr]);
                ptr = (ptr + 1) & 0x7fff;
              }
              return out;
            },
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ W25Q32 SPI flash

const w25q: DevicePart = (() => {
  const d = dip(['CS', 'DO', 'WP', 'GND', 'DI', 'CLK', 'HOLD', 'VCC'], { label: 'W25Q32', sub: '4 MB flash', labels: { CS: 'Chip select (active LOW)', DO: 'Data out (→ MISO)', DI: 'Data in (← MOSI)', CLK: 'SPI clock (SCK)', WP: 'Write protect', HOLD: 'Hold (tie HIGH)' } });
  return [
    {
      type: 'w25q32', name: 'SPI flash memory (W25Q32)', category: 'memory',
      description: '4 MB serial NOR flash on SPI (3.3 V!). Commands: 0x9F JEDEC ID, 0x03 read, 0x06 write enable, 0x02 page program (≤ 256 bytes), 0x20 4 KB sector erase, 0xC7 chip erase, 0x05 status (bit 0 = busy). Erased bytes read 0xFF; programming only clears bits.',
      keywords: ['flash', 'w25q32', 'w25q64', 'spi flash', 'nor flash', 'memory', 'storage'],
      ...d,
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e5 }, ...['CS', 'DI', 'CLK', 'WP', 'HOLD'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e7 })), { id: 'RDO', kind: 'resistor', a: 'DO', b: 'GND', value: 1e7 }] },
      warnings: [{ when: 'v(VCC, GND) > 3.8', level: 'error', message: 'The W25Q32 is a 3.3 V chip — 5 V destroys it.' }],
    },
    {
      setup(b) {
        const mem = (b.state.flash ??= new Uint8Array(4 * 1024 * 1024).fill(0xff)) as Uint8Array;
        let cmd = -1, n = 0, addr = 0, wel = false, busyUntil = 0;
        const busy = () => b.now() < busyUntil;
        b.registerDevice({
          kind: 'spi', key: 'cs', pins: { cs: 'CS', sck: 'CLK', mosi: 'DI', miso: 'DO' }, powered: poweredFn(b, 2.6),
          watch: { cs: (v) => { if (v) { if (cmd === 0x02 || cmd === 0x20 || cmd === 0xd8 || cmd === 0xc7 || cmd === 0x60) wel = false; cmd = -1; n = 0; } } },
          transfer(x) {
            n++;
            if (cmd < 0) {
              cmd = x;
              n = 0;
              if (x === 0x06) wel = true;
              else if (x === 0x04) wel = false;
              else if ((x === 0xc7 || x === 0x60) && wel && !busy()) {
                mem.fill(0xff);
                busyUntil = b.now() + 20000;
              }
              return 0xff;
            }
            switch (cmd) {
              case 0x9f: return [0xef, 0x40, 0x16][n - 1] ?? 0xff;
              case 0x90: return n <= 3 ? 0 : n % 2 === 0 ? 0xef : 0x15;
              case 0xab: return n >= 4 ? 0x15 : 0xff;
              case 0x05: return (busy() ? 1 : 0) | (wel ? 2 : 0);
              case 0x03: case 0x0b:
                if (n <= 3) {
                  addr = ((addr << 8) | x) & 0x3fffff;
                  return 0xff;
                }
                if (cmd === 0x0b && n === 4) return 0xff; // dummy byte
                return mem[addr++ & 0x3fffff];
              case 0x02:
                if (n <= 3) {
                  addr = ((addr << 8) | x) & 0x3fffff;
                  return 0xff;
                }
                if (wel && !busy()) mem[(addr & ~255) | ((addr + n - 4) & 255)] &= x;
                return 0xff;
              case 0x20: case 0xd8:
                if (n <= 3) addr = ((addr << 8) | x) & 0x3fffff;
                if (n === 3 && wel && !busy()) {
                  const size = cmd === 0x20 ? 4096 : 65536;
                  mem.fill(0xff, addr & ~(size - 1), (addr & ~(size - 1)) + size);
                  busyUntil = b.now() + (cmd === 0x20 ? 45000 : 150000);
                }
                return 0xff;
            }
            return 0xff;
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ RTCs

/** Time-of-day registers shared by the DS1307 and DS3231 (BCD, 24 h). */
function rtcCore(state: Record<string, any>, now: () => number, startMode: number) {
  // seconds offset between simulated time and the RTC's clock
  const st = (state.rtc ??= { base: startMode === 1 ? 946684800 : Math.floor(Date.now() / 1000) - new Date().getTimezoneOffset() * 60, simAtBase: 0, halted: false, osf: startMode === 1 }) as { base: number; simAtBase: number; halted: boolean; osf: boolean };
  const t = () => st.base + (st.halted ? 0 : Math.floor((now() / 1e6) - st.simAtBase));
  return {
    st,
    read(reg: number): number {
      const d = new Date(t() * 1000);
      switch (reg) {
        case 0: return bin2bcd(d.getUTCSeconds()) | (st.halted ? 0x80 : 0);
        case 1: return bin2bcd(d.getUTCMinutes());
        case 2: return bin2bcd(d.getUTCHours());
        case 3: return d.getUTCDay() || 7;
        case 4: return bin2bcd(d.getUTCDate());
        case 5: return bin2bcd(d.getUTCMonth() + 1);
        case 6: return bin2bcd(d.getUTCFullYear() % 100);
      }
      return 0;
    },
    /** write the 7 time registers starting at 0 */
    setTime(r: number[]) {
      const [s, m, h, , day, mon, yr] = r;
      st.base = Date.UTC(2000 + bcd2bin(yr), bcd2bin(mon & 0x1f) - 1, bcd2bin(day), bcd2bin(h & 0x3f), bcd2bin(m), bcd2bin(s & 0x7f)) / 1000;
      st.simAtBase = now() / 1e6;
      st.halted = (s & 0x80) !== 0;
    },
  };
}

function rtcDevice(kind: 'ds1307' | 'ds3231'): DevicePart {
  const isModule = kind === 'ds3231';
  const shape = isModule
    ? moduleBoard(['32K', 'SQW', 'SCL', 'SDA', 'VCC', 'GND'], { h: 60, w: 90, color: COL.pcbBlue, title: 'DS3231', labels: { '32K': '32 kHz out', SQW: 'Square wave / alarm', SCL: 'I2C clock', SDA: 'I2C data', VCC: '+3.3–5 V' } })
    : dip(['X1', 'X2', 'VBAT', 'GND', 'SDA', 'SCL', 'SQW', 'VCC'], { label: 'DS1307', sub: 'RTC', labels: { X1: 'Crystal', X2: 'Crystal', VBAT: 'Backup battery (+3 V)', SQW: 'Square wave out', SDA: 'I2C data', SCL: 'I2C clock', VCC: '+5 V' } });
  return [
    {
      type: kind, name: isModule ? 'RTC module (DS3231)' : 'Real-time clock IC (DS1307)', category: 'memory',
      description: isModule
        ? 'Temperature-compensated real-time clock module (±2 ppm) with a coin-cell backup, on I2C (0x68). Keeps date & time; also reports its temperature. Use RTClib (RTC_DS3231).'
        : 'Classic I2C real-time clock chip (0x68) — needs a 32.768 kHz crystal on X1/X2 and a 3 V backup cell. Keeps seconds … years in BCD registers. Use RTClib (RTC_DS1307).',
      keywords: ['rtc', 'real time clock', kind, 'clock', 'time', 'rtclib', 'date'],
      ...shape,
      props: [{ key: 'start', label: 'Clock at start', type: 'select', default: 0, options: [{ value: 0, label: 'Current time (set)' }, { value: 1, label: 'Lost power (2000-01-01)' }] }],
      shapes: isModule ? [...shape.shapes, rect(-6, -52, 30, 30, COL.metal, { rx: 15 }), text(9, -34, 'CR2032', 3.4, '#555'), rect(40, -44, 20, 14, COL.ic, { rx: 1 })] : shape.shapes,
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 2e4 }, { id: 'RSDA', kind: 'resistor', a: 'SDA', b: 'GND', value: 1e7 }, { id: 'RSCL', kind: 'resistor', a: 'SCL', b: 'GND', value: 1e7 }, { id: 'RSQ', kind: 'resistor', a: 'SQW', b: 'GND', value: 1e7 }] },
    },
    {
      setup(b, comp) {
        const core = rtcCore(b.state, () => b.now(), Number(comp.props.start ?? 0));
        const ram = new Uint8Array(64);
        let ptr = 0;
        b.registerI2C({
          address: 0x68, sda: 'SDA', scl: 'SCL', powered: poweredFn(b, isModule ? 2.2 : 4.4),
          device: {
            write: (x) => {
              if (!x.length) return;
              ptr = x[0] & 63;
              const data = x.slice(1);
              if (!data.length) return;
              const regs: number[] = [];
              for (let i = 0; i < 7; i++) regs.push(core.read(i));
              let timeWritten = false;
              for (const v of data) {
                if (ptr < 7) {
                  regs[ptr] = v;
                  timeWritten = true;
                } else if (isModule && ptr === 0x0f) core.st.osf = (v & 0x80) !== 0;
                else ram[ptr] = v;
                ptr = (ptr + 1) & 63;
              }
              if (timeWritten) core.setTime(regs);
            },
            read: (n) => {
              const out: number[] = [];
              for (let i = 0; i < n; i++) {
                let v: number;
                if (ptr < 7) v = core.read(ptr);
                else if (isModule && ptr === 0x0f) v = core.st.osf ? 0x80 : 0;
                else if (isModule && ptr === 0x11) v = 25;
                else if (isModule && ptr === 0x12) v = 0x40;
                else v = ram[ptr];
                out.push(v);
                ptr = (ptr + 1) & 63;
              }
              return out;
            },
          },
        });
        return {};
      },
    },
  ];
}

// ------------------------------------------------------------------ SD card modules

function sdModule(type: string, name: string, micro: boolean): DevicePart {
  const b = moduleBoard(['GND', 'VCC', 'MISO', 'MOSI', 'SCK', 'CS'], { h: micro ? 70 : 90, w: 80, color: micro ? COL.pcbBlue : COL.pcbBlack, labels: { VCC: '+5 V (on-board 3.3 V regulator)', MISO: 'MISO', MOSI: 'MOSI', SCK: 'SCK', CS: 'Chip select' } });
  const slot = micro ? { x: 0, y: -66, w: 50, h: 34 } : { x: -10, y: -88, w: 70, h: 50 };
  return [
    {
      type, name, category: 'memory',
      description: `${micro ? 'Micro-SD' : 'Full-size SD'} card socket on SPI (with a level shifter). The card (FAT, 8.3 file names) is simulated in memory: write logs with the SD library and they show up here — they stay until you remove the part. Click to eject / insert the card.`,
      keywords: ['sd card', 'micro sd', 'microsd', 'sd module', 'data logger', 'storage', 'sd reader'],
      pins: b.pins,
      props: [{ key: 'inserted', label: 'Card', type: 'select', default: 1, options: [{ value: 1, label: 'Inserted' }, { value: 0, label: 'Ejected' }] }],
      toggle: 'inserted',
      shapes: [...b.shapes, rect(slot.x, slot.y, slot.w, slot.h, COL.metal, { rx: 2, stroke: COL.metalDark, strokeWidth: 0.6 })],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 250 }, ...['MOSI', 'SCK', 'CS'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 })), { id: 'RMISO', kind: 'resistor', a: 'MISO', b: 'GND', value: 1e6 }] },
    },
    {
      setup(bld, comp) {
        const files = (bld.state.files ??= new Map<string, string>()) as Map<string, string>;
        const card: SdCard = {
          files,
          get inserted() {
            return Number(comp.props.inserted ?? 1) === 1;
          },
        };
        bld.registerDevice({ kind: 'sd', key: 'cs', pins: { cs: 'CS', sck: 'SCK', mosi: 'MOSI', miso: 'MISO' }, powered: poweredFn(bld, 3.2), api: card });
        return {
          frame: () => ({
            files: card.inserted ? [...files.entries()].slice(-5).map(([p, d]) => `${p.slice(1).padEnd(12)} ${d.length} B`) : ['(no card)'],
            last: [...files.values()].pop()?.split(/\r?\n/).filter(Boolean).slice(-2) ?? [],
          }),
        };
      },
      overlay: ({ sim }) => {
        if (!sim) return null;
        const lines = [...((sim.files as string[]) ?? []), ...((sim.last as string[]) ?? []).map((l) => `> ${l}`)].slice(0, 7);
        return <TextLines x={slot.x + 2} y={slot.y + 2} w={slot.w - 4} h={slot.h - 4} lines={lines} size={micro ? 3.4 : 4} />;
      },
    },
  ];
}

export const MEMORY_DEVICES: DevicePart[] = [eeprom24, w25q, rtcDevice('ds1307'), rtcDevice('ds3231'), sdModule('microsd-module', 'MicroSD card module', true), sdModule('sd-module', 'SD card reader module', false)];
