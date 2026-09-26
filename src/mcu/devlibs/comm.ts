/** RFID / NFC / radio / CAN / GPS libraries: MFRC522, Adafruit_PN532, RF24, MCP_CAN, TinyGPSPlus. */
import type { McuRuntime } from '../runtime';

const box = (x: unknown): unknown[] | null => (Array.isArray(x) ? x : null);

// ------------------------------------------------------------------ RFID reader (MFRC522)

/** A card reader device (RC522 / PN532): the card currently held to it. */
export interface CardReader {
  /** UID bytes of the card on the antenna, or null */
  card(): number[] | null;
  /** card "session": increments each time a card is (re)presented */
  session(): number;
}

export class Mfrc522Lib {
  uid = { size: 0, uidByte: new Array(10).fill(0), sak: 0 };
  private halted = -1;
  private ss: number;
  constructor(private R: McuRuntime, ss = 10, rst = 9) {
    this.ss = ss;
    void rst;
  }
  private dev(): CardReader | null {
    return this.R.env.device('rfid', this.ss) as CardReader | null;
  }
  PCD_Init(ss?: number) {
    if (ss !== undefined) this.ss = ss;
    this.R.t += 50000;
    if (!this.dev()) this.R.warnLib(`MFRC522: no RC522 found with SDA/SS on pin ${this.ss} (and SCK/MOSI/MISO on the SPI pins).`);
  }
  PCD_PerformSelfTest() {
    return !!this.dev();
  }
  PCD_DumpVersionToSerial() {
    this.R.uart(0).println(this.dev() ? 'Firmware Version: 0x92 = v2.0' : 'WARNING: Communication failure, is the MFRC522 properly connected?');
  }
  PICC_IsNewCardPresent() {
    this.R.t += 2000;
    const d = this.dev();
    if (!d || !d.card()) return false;
    return d.session() !== this.halted;
  }
  PICC_ReadCardSerial() {
    const d = this.dev();
    const c = d?.card();
    if (!c) return false;
    this.uid.size = c.length;
    for (let i = 0; i < 10; i++) this.uid.uidByte[i] = c[i] ?? 0;
    this.uid.sak = 0x08;
    return true;
  }
  PICC_HaltA() {
    const d = this.dev();
    if (d) this.halted = d.session();
  }
  PCD_StopCrypto1() {}
  PICC_GetType(sak: number) {
    return sak === 0x08 ? 3 : 0; // PICC_TYPE_MIFARE_1K
  }
  PICC_GetTypeName(t: number) {
    return t === 3 ? 'MIFARE 1KB' : 'Unknown type';
  }
  PICC_DumpToSerial() {
    this.R.uart(0).println(`Card UID: ${this.uid.uidByte.slice(0, this.uid.size).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  }
}

// ------------------------------------------------------------------ NFC (PN532 over I2C)

export class Pn532Lib {
  constructor(private R: McuRuntime, private irq: number) {}
  private dev(): CardReader | null {
    // I2C PN532 modules are found on the board's SDA line
    return (this.R.env.device('nfc', this.R.spec.i2c.sda) ?? this.R.env.device('nfc', this.irq)) as CardReader | null;
  }
  begin() {
    this.R.t += 10000;
    return !!this.dev();
  }
  getFirmwareVersion() {
    return this.dev() ? 0x32010607 : 0;
  }
  SAMConfig() {
    return !!this.dev();
  }
  setPassiveActivationRetries() {
    return true;
  }
  readPassiveTargetID(_baud: number, uid: unknown[], len: unknown[], timeout = 1000) {
    const d = this.dev();
    const c = d?.card();
    if (!c) {
      this.R.t += Math.min(timeout || 1000, 1000) * 1000;
      return false;
    }
    c.forEach((b, i) => (uid[i] = b));
    const l = box(len);
    if (l) l[0] = c.length;
    this.R.t += 20000;
    return true;
  }
  PrintHex(buf: number[], n: number) {
    this.R.uart(0).println(buf.slice(0, n).map((b) => ` 0x${Number(b).toString(16).toUpperCase().padStart(2, '0')}`).join(''));
  }
}

// ------------------------------------------------------------------ nRF24L01 (RF24)

/** The radio device a library drives. */
export interface Nrf24Radio {
  config: { channel: number; listening: boolean; writeAddr: string; readPipes: Map<number, string>; powered: boolean };
  /** deliver a payload to every listening radio with a matching pipe; true when acknowledged */
  transmit(addr: string, payload: unknown[]): boolean;
  /** pending received payloads */
  rx: { pipe: number; payload: unknown[] }[];
}

const addrKey = (a: unknown) => (Array.isArray(a) ? a.map((b) => (typeof b === 'number' ? String.fromCharCode(b) : String(b))).join('').replace(/\0+$/, '') : String(a));

export class Rf24Lib {
  constructor(private R: McuRuntime, private ce: number, private csn: number) {}
  private dev(): Nrf24Radio | null {
    return this.R.env.device('nrf24', this.csn) as Nrf24Radio | null;
  }
  begin() {
    const d = this.dev();
    if (!d) this.R.warnLib(`RF24: no nRF24L01 found with CSN on pin ${this.csn} (CE on ${this.ce}; SCK/MOSI/MISO on the SPI pins; 3.3 V power!).`);
    if (d) d.config.powered = true;
    return !!d;
  }
  isChipConnected() {
    return !!this.dev();
  }
  openWritingPipe(a: unknown) {
    const d = this.dev();
    if (d) d.config.writeAddr = addrKey(a);
  }
  openReadingPipe(n: number, a: unknown) {
    this.dev()?.config.readPipes.set(n, addrKey(a));
  }
  closeReadingPipe(n: number) {
    this.dev()?.config.readPipes.delete(n);
  }
  startListening() {
    const d = this.dev();
    if (d) d.config.listening = true;
  }
  stopListening() {
    const d = this.dev();
    if (d) d.config.listening = false;
  }
  write(buf: unknown[], _len?: number) {
    this.R.t += 1500;
    const d = this.dev();
    if (!d || d.config.listening) return false;
    return d.transmit(d.config.writeAddr, (this.R as any).clone(buf));
  }
  available(pipe?: unknown[]) {
    const d = this.dev();
    if (!d || !d.rx.length) return false;
    const p = box(pipe);
    if (p) p[0] = d.rx[0].pipe;
    return true;
  }
  read(buf: unknown[], _len?: number) {
    const d = this.dev();
    const m = d?.rx.shift();
    if (!m) return;
    const src = m.payload;
    if (buf.length === 1 && src.length === 1) {
      const dst = buf[0], v = src[0];
      if (dst && typeof dst === 'object' && v && typeof v === 'object' && !Array.isArray(dst)) Object.assign(dst, v);
      else buf[0] = v;
      return;
    }
    for (let i = 0; i < Math.min(buf.length, src.length); i++) buf[i] = src[i];
  }
  setPALevel() {}
  setDataRate() {
    return true;
  }
  setChannel(c: number) {
    const d = this.dev();
    if (d) d.config.channel = c & 127;
  }
  getChannel() {
    return this.dev()?.config.channel ?? 76;
  }
  setRetries() {}
  setAutoAck() {}
  setPayloadSize() {}
  enableDynamicPayloads() {}
  getDynamicPayloadSize() {
    return 32;
  }
  powerUp() {}
  powerDown() {}
  printDetails() {
    this.R.uart(0).println(`STATUS = 0x0e, RF_CH = 0x${this.getChannel().toString(16)}`);
  }
  testCarrier() {
    return false;
  }
  flush_rx() {
    const d = this.dev();
    if (d) d.rx.length = 0;
  }
  flush_tx() {}
}

// ------------------------------------------------------------------ MCP2515 CAN (mcp_can)

export interface CanController {
  send(id: number, ext: boolean, data: number[]): boolean;
  rx: { id: number; ext: boolean; data: number[] }[];
  mode: number;
}

export class McpCanLib {
  private last = { id: 0, ext: false };
  constructor(private R: McuRuntime, private cs: number) {}
  private dev(): CanController | null {
    return this.R.env.device('can', this.cs) as CanController | null;
  }
  begin() {
    this.R.t += 10000;
    const ok = !!this.dev();
    if (!ok) this.R.warnLib(`MCP_CAN: no MCP2515 module found with CS on pin ${this.cs}.`);
    return ok ? 0 : 1;
  }
  setMode(m: number) {
    const d = this.dev();
    if (d) d.mode = m;
    return d ? 0 : 5;
  }
  init_Mask() {
    return 0;
  }
  init_Filt() {
    return 0;
  }
  sendMsgBuf(id: number, a: number | unknown[], b?: number | unknown[], c?: unknown[]) {
    // sendMsgBuf(id, ext, len, buf) or sendMsgBuf(id, len, buf)
    let ext = false, len: number, buf: unknown[];
    if (c !== undefined) {
      ext = !!a;
      len = Number(b);
      buf = c;
    } else {
      len = Number(a);
      buf = b as unknown[];
      ext = id > 0x7ff;
    }
    this.R.t += 250;
    const d = this.dev();
    if (!d) return 2;
    return d.send(id >>> 0, ext, buf.slice(0, Math.min(8, len)).map((x) => Number(x) & 255)) ? 0 : 2;
  }
  checkReceive() {
    return this.dev()?.rx.length ? 3 : 4;
  }
  checkError() {
    return 0;
  }
  readMsgBuf(a: unknown[], b: unknown[], c: unknown[], d?: unknown[]) {
    // readMsgBuf(&id, &len, buf) or readMsgBuf(&id, &ext, &len, buf)
    const dev = this.dev();
    const m = dev?.rx.shift();
    if (!m) return 4;
    this.last = { id: m.id, ext: m.ext };
    a[0] = m.ext ? (m.id | 0x80000000) >>> 0 : m.id;
    const lenBox = d ? c : b, buf = d ?? c;
    if (d) b[0] = m.ext ? 1 : 0;
    lenBox[0] = m.data.length;
    m.data.forEach((x, i) => (buf[i] = x));
    return 0;
  }
  getCanId() {
    return this.last.id;
  }
}

// ------------------------------------------------------------------ TinyGPS++ (NMEA parser)

class GpsValue {
  valid = false;
  updated = false;
  at = 0;
  constructor(protected R: McuRuntime) {}
  isValid() {
    return this.valid;
  }
  isUpdated() {
    return this.updated;
  }
  age() {
    return this.valid ? Math.floor((this.R.t - this.at) / 1000) : 0xffffffff;
  }
  set(fn: () => void) {
    fn();
    this.valid = true;
    this.updated = true;
    this.at = this.R.t;
  }
  read<T>(v: T) {
    this.updated = false;
    return v;
  }
}
class GpsLocation extends GpsValue {
  la = 0;
  ln = 0;
  lat() { return this.read(this.la); }
  lng() { return this.read(this.ln); }
}
class GpsDate extends GpsValue {
  v = 0;
  value() { return this.read(this.v); }
  year() { return this.read(2000 + (this.v % 100)); }
  month() { return this.read(Math.floor(this.v / 100) % 100); }
  day() { return this.read(Math.floor(this.v / 10000)); }
}
class GpsTime extends GpsValue {
  v = 0;
  value() { return this.read(this.v); }
  hour() { return this.read(Math.floor(this.v / 1000000)); }
  minute() { return this.read(Math.floor(this.v / 10000) % 100); }
  second() { return this.read(Math.floor(this.v / 100) % 100); }
  centisecond() { return this.read(this.v % 100); }
}
class GpsDecimal extends GpsValue {
  v = 0; // stored in 1/100 units like TinyGPS++
  value() { return this.read(Math.round(this.v * 100)); }
  knots() { return this.read(this.v); }
  mph() { return this.read(this.v * 1.15077945); }
  mps() { return this.read(this.v * 0.51444444); }
  kmph() { return this.read(this.v * 1.852); }
  deg() { return this.read(this.v); }
  meters() { return this.read(this.v); }
  miles() { return this.read(this.v / 1609.344); }
  kilometers() { return this.read(this.v / 1000); }
  feet() { return this.read(this.v * 3.2808399); }
  hdop() { return this.read(this.v); }
}
class GpsInteger extends GpsValue {
  v = 0;
  value() { return this.read(this.v); }
}

export class TinyGpsLib {
  location: GpsLocation;
  date: GpsDate;
  time: GpsTime;
  speed: GpsDecimal;
  course: GpsDecimal;
  altitude: GpsDecimal;
  satellites: GpsInteger;
  hdop: GpsDecimal;
  private buf = '';
  private chars = 0;
  private withFix = 0;
  private good = 0;
  private bad = 0;
  constructor(R: McuRuntime) {
    this.location = new GpsLocation(R);
    this.date = new GpsDate(R);
    this.time = new GpsTime(R);
    this.speed = new GpsDecimal(R);
    this.course = new GpsDecimal(R);
    this.altitude = new GpsDecimal(R);
    this.satellites = new GpsInteger(R);
    this.hdop = new GpsDecimal(R);
  }
  charsProcessed() { return this.chars; }
  sentencesWithFix() { return this.withFix; }
  failedChecksum() { return this.bad; }
  passedChecksum() { return this.good; }
  encode(c: number) {
    this.chars++;
    const ch = String.fromCharCode(c & 255);
    if (ch === '$') {
      this.buf = '$';
      return false;
    }
    if (!this.buf) return false;
    if (ch === '\r' || ch === '\n') {
      const s = this.buf;
      this.buf = '';
      return this.parse(s);
    }
    this.buf += ch;
    if (this.buf.length > 120) this.buf = '';
    return false;
  }
  private parse(s: string): boolean {
    const star = s.indexOf('*');
    if (star < 0) return false;
    const body = s.slice(1, star);
    let sum = 0;
    for (const ch of body) sum ^= ch.charCodeAt(0);
    if (sum !== parseInt(s.slice(star + 1, star + 3), 16)) {
      this.bad++;
      return false;
    }
    this.good++;
    const f = body.split(',');
    const type = f[0].slice(2);
    const coord = (v: string, hemi: string) => {
      if (!v) return NaN;
      const dot = v.indexOf('.');
      const deg = Number(v.slice(0, dot - 2));
      const min = Number(v.slice(dot - 2));
      const x = deg + min / 60;
      return hemi === 'S' || hemi === 'W' ? -x : x;
    };
    const time = (v: string) => v && this.time.set(() => (this.time.v = Math.round(Number(v) * 100)));
    if (type === 'RMC') {
      time(f[1]);
      if (f[2] === 'A') {
        const la = coord(f[3], f[4]), ln = coord(f[5], f[6]);
        if (!Number.isNaN(la) && !Number.isNaN(ln)) this.location.set(() => ((this.location.la = la), (this.location.ln = ln)));
        if (f[7]) this.speed.set(() => (this.speed.v = Number(f[7])));
        if (f[8]) this.course.set(() => (this.course.v = Number(f[8])));
        this.withFix++;
      }
      if (f[9]) this.date.set(() => (this.date.v = Number(f[9])));
      return true;
    }
    if (type === 'GGA') {
      time(f[1]);
      if (Number(f[6]) > 0) {
        const la = coord(f[2], f[3]), ln = coord(f[4], f[5]);
        if (!Number.isNaN(la) && !Number.isNaN(ln)) this.location.set(() => ((this.location.la = la), (this.location.ln = ln)));
        if (f[9]) this.altitude.set(() => (this.altitude.v = Number(f[9])));
        this.withFix++;
      }
      if (f[7]) this.satellites.set(() => (this.satellites.v = Number(f[7])));
      if (f[8]) this.hdop.set(() => (this.hdop.v = Number(f[8])));
      return true;
    }
    return false;
  }
  distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
    const r = Math.PI / 180;
    const dLon = (lon2 - lon1) * r;
    const a1 = lat1 * r, a2 = lat2 * r;
    const y = Math.sqrt(Math.pow(Math.cos(a2) * Math.sin(dLon), 2) + Math.pow(Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dLon), 2));
    const x = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dLon);
    return Math.atan2(y, x) * 6372795;
  }
  courseTo(lat1: number, lon1: number, lat2: number, lon2: number) {
    const r = Math.PI / 180;
    const dLon = (lon2 - lon1) * r;
    const a1 = lat1 * r, a2 = lat2 * r;
    let a = Math.atan2(Math.sin(dLon) * Math.cos(a2), Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dLon));
    if (a < 0) a += 2 * Math.PI;
    return a / r;
  }
}
