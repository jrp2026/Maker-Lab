/**
 * Core Arduino runtime libraries: serial ports (hardware + SoftwareSerial) routed to wired
 * devices, SPI, EEPROM, the SD card library, and C string formatting helpers.
 */
import type { McuRuntime } from './runtime';

// ------------------------------------------------------------------ formatting

/** C printf formatting: %d %i %u %ld %f %.2f %e %s %c %x %X %o %p %% with flags/width. */
export function sprintf(fmt: string, ...args: unknown[]): string {
  let ai = 0;
  return String(fmt).replace(/%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|z)?([diuxXofFeEgGcsp%])/g, (_m, flags: string, w: string, p: string, _len, conv: string) => {
    if (conv === '%') return '%';
    let width = w === '*' ? Number(args[ai++]) : w ? Number(w) : 0;
    const prec = p === '*' ? Number(args[ai++]) : p !== undefined ? Number(p) : undefined;
    const arg = args[ai++];
    let out: string;
    const n = Number(arg);
    switch (conv) {
      case 'd': case 'i': out = String(Math.trunc(n)); break;
      case 'u': out = String(Math.trunc(n) >>> 0); break;
      case 'x': out = (Math.trunc(n) >>> 0).toString(16); break;
      case 'X': out = (Math.trunc(n) >>> 0).toString(16).toUpperCase(); break;
      case 'o': out = (Math.trunc(n) >>> 0).toString(8); break;
      case 'f': case 'F': out = n.toFixed(prec ?? 6); break;
      case 'e': case 'E': out = n.toExponential(prec ?? 6); if (conv === 'E') out = out.toUpperCase(); break;
      case 'g': case 'G': out = String(Number(n.toPrecision(prec || 6))); break;
      case 'c': out = typeof arg === 'string' ? arg.slice(0, 1) : String.fromCharCode(n & 255); break;
      case 's': out = arg === undefined || arg === null ? '(null)' : String(arg); if (prec !== undefined) out = out.slice(0, prec); break;
      case 'p': out = '0x0'; break;
      default: out = String(arg);
    }
    if (flags.includes('+') && /[dife]/i.test(conv) && n >= 0) out = `+${out}`;
    if (flags.includes('#') && (conv === 'x' || conv === 'X') && n) out = `0${conv}${out}`;
    if (width < 0) width = 0;
    if (out.length < width) {
      if (flags.includes('-')) out = out.padEnd(width);
      else if (flags.includes('0') && /[diuxXofFeE]/.test(conv)) {
        const neg = out[0] === '-' || out[0] === '+';
        out = neg ? out[0] + out.slice(1).padStart(width - 1, '0') : out.padStart(width, '0');
      } else out = out.padStart(width);
    }
    return out;
  });
}

export function dtostrf(v: number, width: number, prec: number, ): string {
  const s = Number(v).toFixed(Math.max(0, prec));
  return width < 0 ? s.padEnd(-width) : s.padStart(width);
}

// ------------------------------------------------------------------ serial

/** A serial port (hardware UART or SoftwareSerial). Port 0 also feeds the Serial Monitor. */
export class UartPort {
  /** received, not yet read */
  rx = '';
  baud = 9600;
  timeout = 1000;
  started = false;
  constructor(protected R: McuRuntime, public rxPin: number, public txPin: number, public monitor = false) {}
  isOk() {
    return true;
  }
  begin(baud = 9600, _cfg?: number, rxPin?: number, txPin?: number) {
    this.baud = Number(baud) || 9600;
    if (rxPin !== undefined && rxPin >= 0) this.rxPin = rxPin;
    if (txPin !== undefined && txPin >= 0) this.txPin = txPin;
    this.started = true;
  }
  end() {
    this.started = false;
  }
  setRxBufferSize() {}
  setTimeout(ms: number) {
    this.timeout = ms;
  }
  flush() {}
  availableForWrite() {
    return 63;
  }
  /** bytes arriving from a device / another board */
  push(text: string) {
    this.rx += text;
    if (this.rx.length > 4096) this.rx = this.rx.slice(-4096);
  }
  protected send(text: string) {
    if (this.monitor) {
      this.R.serialOut += text.replace(/\r/g, '');
      if (this.R.serialOut.length > 20000) this.R.serialOut = this.R.serialOut.slice(-15000);
      this.R.lastSerialAt = this.R.t;
      for (const l of this.R.serialListeners) l(text.replace(/\r/g, ''));
    }
    this.R.env.uartSend(this.txPin, text);
    this.R.t += (text.length * 10e6) / Math.max(300, this.baud); // bits on the wire (µs)
  }
  print(text: string) {
    this.send(text);
    return text.length;
  }
  println(text: string) {
    this.send(`${text}\r\n`);
    return text.length + 2;
  }
  write(x: number | number[] | string, n?: number) {
    if (Array.isArray(x)) {
      const bytes = x.slice(0, n ?? x.length).map((b) => String.fromCharCode(Number(b) & 255)).join('');
      this.send(bytes);
      return bytes.length;
    }
    if (typeof x === 'string') return this.print(n !== undefined ? x.slice(0, n) : x);
    this.send(String.fromCharCode(Number(x) & 255));
    return 1;
  }
  writeStr(s: string) {
    return this.print(s);
  }
  available() {
    return this.rx.length;
  }
  read() {
    if (!this.rx.length) return -1;
    const c = this.rx.charCodeAt(0);
    this.rx = this.rx.slice(1);
    return c;
  }
  peek() {
    return this.rx.length ? this.rx.charCodeAt(0) : -1;
  }
  readString() {
    const s = this.rx;
    this.rx = '';
    return s;
  }
  readStringUntil(c: number) {
    const ch = typeof c === 'string' ? c : String.fromCharCode(c);
    const i = this.rx.indexOf(ch);
    if (i < 0) return this.readString();
    const s = this.rx.slice(0, i);
    this.rx = this.rx.slice(i + 1);
    return s;
  }
  readBytes(buf: unknown[], n: number) {
    let k = 0;
    while (k < n && this.rx.length) buf[k++] = this.read();
    return k;
  }
  readBytesUntil(term: number, buf: unknown[], n: number) {
    let k = 0;
    while (k < n && this.rx.length) {
      const c = this.read();
      if (c === term) break;
      buf[k++] = c;
    }
    return k;
  }
  find(target: string) {
    const i = this.rx.indexOf(String(target));
    if (i < 0) {
      this.rx = '';
      return false;
    }
    this.rx = this.rx.slice(i + String(target).length);
    return true;
  }
  parseInt() {
    const m = /[-]?\d+/.exec(this.rx);
    if (!m) {
      this.rx = '';
      return 0;
    }
    this.rx = this.rx.slice(m.index + m[0].length);
    return parseInt(m[0], 10) | 0;
  }
  parseFloat() {
    const m = /[-]?\d+(\.\d+)?/.exec(this.rx);
    if (!m) {
      this.rx = '';
      return 0;
    }
    this.rx = this.rx.slice(m.index + m[0].length);
    return parseFloat(m[0]);
  }
  // SoftwareSerial extras
  listen() {
    return true;
  }
  isListening() {
    return true;
  }
  overflow() {
    return false;
  }
}

// ------------------------------------------------------------------ SPI

export class SpiLib {
  constructor(private R: McuRuntime) {}
  begin() {}
  end() {}
  beginTransaction() {}
  endTransaction() {}
  setClockDivider() {}
  setBitOrder() {}
  setDataMode() {}
  setFrequency() {}
  transfer(x: number | number[], n?: number): number {
    if (Array.isArray(x)) {
      for (let i = 0; i < (n ?? x.length); i++) x[i] = this.transfer(Number(x[i]));
      return 0;
    }
    this.R.t += 2;
    return this.R.env.spi(Number(x) & 255) & 255;
  }
  transfer16(x: number) {
    const hi = this.transfer((x >> 8) & 255);
    return (hi << 8) | this.transfer(x & 255);
  }
}

// ------------------------------------------------------------------ EEPROM

type Desc = string | { a: number; e: Desc } | { s: [string, Desc][] };

export class EepromLib {
  bytes: Uint8Array;
  constructor(private R: McuRuntime, size: number) {
    this.bytes = new Uint8Array(size).fill(0xff);
  }
  begin() {
    return true;
  }
  commit() {
    return true;
  }
  end() {}
  length() {
    return this.bytes.length;
  }
  private check(a: number) {
    a = Math.trunc(a);
    if (a < 0 || a >= this.bytes.length) throw new Error(`EEPROM address ${a} is outside 0–${this.bytes.length - 1}`);
    return a;
  }
  read(a: number) {
    return this.bytes[this.check(a)];
  }
  write(a: number, v: number) {
    this.bytes[this.check(a)] = Number(v) & 255;
    this.R.t += 3300; // 3.3 ms per byte on the ATmega
  }
  update(a: number, v: number) {
    if (this.read(a) !== (Number(v) & 255)) this.write(a, v);
  }
  private enc(v: unknown, d: Desc, out: number[]) {
    if (typeof d === 'string') {
      const n = Number(v);
      const dv = new DataView(new ArrayBuffer(4));
      switch (d) {
        case 'bool': case 'char': case 'uchar': out.push(n & 255); return;
        case 'int': case 'uint': out.push(n & 255, (n >> 8) & 255); return;
        case 'long': case 'ulong': dv.setInt32(0, n | 0, true); break;
        case 'float': dv.setFloat32(0, n, true); break;
        case 'String': for (const ch of String(v)) out.push(ch.charCodeAt(0) & 255); out.push(0); return;
        default: out.push(n & 255); return;
      }
      for (let i = 0; i < 4; i++) out.push(dv.getUint8(i));
      return;
    }
    if ('a' in d) {
      const arr = (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : (v as unknown[])) ?? [];
      for (let i = 0; i < d.a; i++) this.enc(arr[i] ?? 0, d.e, out);
      return;
    }
    for (const [k, fd] of d.s) this.enc((v as Record<string, unknown>)[k], fd, out);
  }
  private dec(d: Desc, at: { i: number }, prev: unknown): unknown {
    const b = () => this.read(at.i++);
    if (typeof d === 'string') {
      switch (d) {
        case 'bool': return b() !== 0;
        case 'char': return (b() << 24) >> 24;
        case 'uchar': return b();
        case 'int': { const x = b() | (b() << 8); return (x << 16) >> 16; }
        case 'uint': return b() | (b() << 8);
        case 'String': { let s = ''; for (let c = b(); c !== 0 && c !== 0xff && s.length < 256; c = b()) s += String.fromCharCode(c); return s; }
      }
      const dv = new DataView(new ArrayBuffer(4));
      for (let i = 0; i < 4; i++) dv.setUint8(i, b());
      if (d === 'float') return dv.getFloat32(0, true);
      if (d === 'ulong') return dv.getUint32(0, true);
      return dv.getInt32(0, true);
    }
    if ('a' in d) {
      const arr = Array.isArray(prev) ? prev : [];
      for (let i = 0; i < d.a; i++) arr[i] = this.dec(d.e, at, arr[i]);
      return arr;
    }
    const obj = (prev && typeof prev === 'object' ? prev : {}) as Record<string, unknown>;
    for (const [k, fd] of d.s) obj[k] = this.dec(fd, at, obj[k]);
    return obj;
  }
  put(a: number, v: unknown, d: Desc) {
    const out: number[] = [];
    this.enc(v, d, out);
    out.forEach((x, i) => this.update(a + i, x));
  }
  get(a: number, prev: unknown, d: Desc) {
    return this.dec(d, { i: a }, prev);
  }
}

// ------------------------------------------------------------------ SD card

/** What an SD-card module device exposes to the library. */
export interface SdCard {
  files: Map<string, string>;
  inserted: boolean;
}

export class SdFile {
  pos = 0;
  private dirList: string[] | null = null;
  constructor(private card: SdCard | null, private path: string, private mode: number, private dir = false) {
    if (dir && card) this.dirList = [...card.files.keys()].filter((p) => p.startsWith(path === '/' ? '/' : `${path}/`)).sort();
    if (card && !dir && mode & 0x04) this.pos = (card.files.get(path) ?? '').length;
  }
  isOk() {
    return !!this.card;
  }
  private get data() {
    return this.card?.files.get(this.path) ?? '';
  }
  private put(text: string) {
    if (!this.card || !(this.mode & 0x02)) return 0;
    const d = this.data;
    this.card.files.set(this.path, d.slice(0, this.pos) + text + d.slice(this.pos + text.length));
    this.pos += text.length;
    return text.length;
  }
  print(t: string) {
    return this.put(t);
  }
  println(t: string) {
    return this.put(`${t}\r\n`);
  }
  printf(t: string) {
    return this.put(t);
  }
  write(x: number | number[] | string, n?: number) {
    if (Array.isArray(x)) return this.put(x.slice(0, n ?? x.length).map((b) => String.fromCharCode(Number(b) & 255)).join(''));
    if (typeof x === 'string') return this.put(x);
    return this.put(String.fromCharCode(Number(x) & 255));
  }
  writeStr(s: string) {
    return this.put(s);
  }
  available() {
    return Math.max(0, this.data.length - this.pos);
  }
  read() {
    if (this.pos >= this.data.length) return -1;
    return this.data.charCodeAt(this.pos++);
  }
  peek() {
    return this.pos < this.data.length ? this.data.charCodeAt(this.pos) : -1;
  }
  readString() {
    const s = this.data.slice(this.pos);
    this.pos = this.data.length;
    return s;
  }
  readStringUntil(c: number) {
    const ch = String.fromCharCode(c);
    const d = this.data;
    const i = d.indexOf(ch, this.pos);
    const end = i < 0 ? d.length : i;
    const s = d.slice(this.pos, end);
    this.pos = i < 0 ? d.length : i + 1;
    return s;
  }
  readBytes(buf: unknown[], n: number) {
    let k = 0;
    while (k < n && this.available()) buf[k++] = this.read();
    return k;
  }
  readBytesUntil(term: number, buf: unknown[], n: number) {
    let k = 0;
    while (k < n && this.available()) {
      const c = this.read();
      if (c === term) break;
      buf[k++] = c;
    }
    return k;
  }
  parseInt() {
    const m = /[-]?\d+/.exec(this.data.slice(this.pos));
    if (!m) return 0;
    this.pos += m.index + m[0].length;
    return parseInt(m[0], 10) | 0;
  }
  parseFloat() {
    const m = /[-]?\d+(\.\d+)?/.exec(this.data.slice(this.pos));
    if (!m) return 0;
    this.pos += m.index + m[0].length;
    return parseFloat(m[0]);
  }
  find(t: string) {
    const i = this.data.indexOf(t, this.pos);
    if (i < 0) return false;
    this.pos = i + t.length;
    return true;
  }
  flush() {}
  setTimeout() {}
  availableForWrite() {
    return 512;
  }
  close() {}
  size() {
    return this.data.length;
  }
  position() {
    return this.pos;
  }
  seek(p: number) {
    this.pos = Math.max(0, Math.min(this.data.length, p));
    return true;
  }
  name() {
    return this.path.split('/').pop() ?? '';
  }
  isDirectory() {
    return this.dir;
  }
  openNextFile() {
    const next = this.dirList?.shift();
    return next ? new SdFile(this.card, next, 0x01) : new SdFile(null, '', 0);
  }
  rewindDirectory() {}
}

export class SdLib {
  private cs = -1;
  constructor(private R: McuRuntime) {}
  private card(): SdCard | null {
    if (this.cs < 0) return null;
    const c = this.R.env.device('sd', this.cs) as SdCard | null;
    return c && c.inserted ? c : null;
  }
  private norm(p: string) {
    p = String(p).trim();
    return p.startsWith('/') ? p : `/${p}`;
  }
  begin(cs?: number) {
    this.cs = cs ?? this.R.spec.spi.ss;
    this.R.t += 20000;
    const ok = !!this.card();
    if (!ok) this.R.warnLib(`SD.begin(${this.cs}): no card answered — wire the SD module's CS to pin ${this.cs}, SCK/MOSI/MISO to the SPI pins, and insert a card.`);
    return ok;
  }
  exists(p: string) {
    const c = this.card();
    const path = this.norm(p);
    return !!c && (c.files.has(path) || [...c.files.keys()].some((k) => k.startsWith(`${path}/`)));
  }
  mkdir() {
    return !!this.card();
  }
  rmdir() {
    return !!this.card();
  }
  remove(p: string) {
    const c = this.card();
    return !!c && c.files.delete(this.norm(p));
  }
  open(p: string, mode = 0x01) {
    const c = this.card();
    const path = this.norm(p);
    if (!c) return new SdFile(null, path, mode);
    const isDir = path === '/' || (!c.files.has(path) && [...c.files.keys()].some((k) => k.startsWith(`${path}/`)));
    if (isDir) return new SdFile(c, path, mode, true);
    if (!c.files.has(path)) {
      if (!(mode & 0x02)) return new SdFile(null, path, mode);
      c.files.set(path, '');
    }
    return new SdFile(c, path, mode);
  }
}
