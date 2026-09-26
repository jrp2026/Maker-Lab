/** Display / LED libraries: Adafruit_NeoPixel, Adafruit_GFX + Adafruit_SSD1306, LedControl (MAX7219). */
import type { McuRuntime } from '../runtime';
import { glyph } from '../font5x7';

// ------------------------------------------------------------------ NeoPixel

/** What a NeoPixel strip device exposes: receives packed 0xWWRRGGBB colours, returns the ones it passes on. */
export interface NeoPixelSink {
  show(colors: number[]): void;
}

export class NeoPixelLib {
  pixels: number[];
  brightness = 0;
  private warned = false;
  constructor(private R: McuRuntime, public n = 0, public pin = -1, public type = 0x52) {
    this.pixels = new Array(Math.max(0, n)).fill(0);
  }
  begin() {
    if (this.pin >= 0) this.R.pinMode(this.pin, 1);
  }
  updateLength(n: number) {
    this.n = n;
    this.pixels = new Array(n).fill(0);
  }
  setPin(p: number) {
    this.pin = p;
  }
  numPixels() {
    return this.n;
  }
  canShow() {
    return true;
  }
  Color(r: number, g: number, b: number, w = 0) {
    return (((w & 255) << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)) >>> 0;
  }
  setPixelColor(i: number, a: number, g?: number, b?: number, w?: number) {
    if (i < 0 || i >= this.n) return;
    this.pixels[i] = g === undefined ? a >>> 0 : this.Color(a, g, b ?? 0, w ?? 0);
  }
  getPixelColor(i: number) {
    return i >= 0 && i < this.n ? this.pixels[i] : 0;
  }
  fill(c = 0, first = 0, count = 0) {
    const end = count ? Math.min(this.n, first + count) : this.n;
    for (let i = Math.max(0, first); i < end; i++) this.pixels[i] = c >>> 0;
  }
  clear() {
    this.pixels.fill(0);
  }
  setBrightness(b: number) {
    this.brightness = (b + 1) & 255;
  }
  getBrightness() {
    return (this.brightness - 1) & 255;
  }
  /** Adafruit's HSV → packed RGB (hue 0–65535) */
  ColorHSV(hue: number, sat = 255, val = 255) {
    hue = ((hue % 65536) + 65536) % 65536;
    hue = Math.floor((hue * 1530 + 32768) / 65536);
    let r: number, g: number, b: number;
    if (hue < 510) {
      b = 0;
      if (hue < 255) { r = 255; g = hue; } else { r = 510 - hue; g = 255; }
    } else if (hue < 1020) {
      r = 0;
      if (hue < 765) { g = 255; b = hue - 510; } else { g = 1020 - hue; b = 255; }
    } else if (hue < 1530) {
      g = 0;
      if (hue < 1275) { r = hue - 1020; b = 255; } else { r = 255; b = 1530 - hue; }
    } else { r = 255; g = 0; b = 0; }
    const v1 = 1 + val, s1 = 1 + sat, s2 = 255 - sat;
    const f = (x: number) => Math.floor((Math.floor((x * s1) / 256) + s2) * v1 / 256);
    return this.Color(f(r), f(g), f(b));
  }
  gamma32(c: number) {
    const g = (x: number) => Math.round(Math.pow(x / 255, 2.6) * 255);
    return this.Color(g((c >> 16) & 255), g((c >> 8) & 255), g(c & 255), g((c >>> 24) & 255));
  }
  rainbow(first = 0, reps = 1, sat = 255, bright = 255, gammify = 1) {
    for (let i = 0; i < this.n; i++) {
      const c = this.ColorHSV(first + Math.floor((i * reps * 65536) / Math.max(1, this.n)), sat, bright);
      this.pixels[i] = gammify ? this.gamma32(c) : c;
    }
  }
  show() {
    this.R.t += 30 * this.n + 50;
    const dev = this.R.env.device('neopixel', this.pin) as NeoPixelSink | null;
    if (!dev) {
      if (!this.warned) this.R.warnLib(`Adafruit_NeoPixel: nothing is connected to pin ${this.pin} — wire it to the strip's DIN.`);
      this.warned = true;
      return;
    }
    const scale = this.brightness ? this.brightness / 256 : 1;
    dev.show(this.pixels.map((c) => {
      const ch = (s: number) => Math.floor(((c >>> s) & 255) * scale);
      return ((ch(24) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
    }));
  }
}

// ------------------------------------------------------------------ Adafruit GFX

export abstract class GfxLib {
  cursorX = 0;
  cursorY = 0;
  textSizeX = 1;
  textSizeY = 1;
  textColor = 1;
  textBg = 1;
  wrap = true;
  rotation = 0;
  constructor(protected R: McuRuntime, protected W: number, protected H: number) {}
  abstract rawPixel(x: number, y: number, c: number): void;
  width() {
    return this.rotation & 1 ? this.H : this.W;
  }
  height() {
    return this.rotation & 1 ? this.W : this.H;
  }
  drawPixel(x: number, y: number, c: number) {
    x = Math.trunc(x);
    y = Math.trunc(y);
    if (x < 0 || y < 0 || x >= this.width() || y >= this.height()) return;
    switch (this.rotation & 3) {
      case 1: [x, y] = [this.W - 1 - y, x]; break;
      case 2: [x, y] = [this.W - 1 - x, this.H - 1 - y]; break;
      case 3: [x, y] = [y, this.H - 1 - x]; break;
    }
    this.rawPixel(x, y, c);
  }
  drawLine(x0: number, y0: number, x1: number, y1: number, c: number) {
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
    if (x0 > x1) [x0, x1, y0, y1] = [x1, x0, y1, y0];
    const dx = x1 - x0, dy = Math.abs(y1 - y0);
    let err = Math.trunc(dx / 2);
    const ystep = y0 < y1 ? 1 : -1;
    for (; x0 <= x1; x0++) {
      if (steep) this.drawPixel(y0, x0, c);
      else this.drawPixel(x0, y0, c);
      err -= dy;
      if (err < 0) {
        y0 += ystep;
        err += dx;
      }
    }
  }
  drawFastHLine(x: number, y: number, w: number, c: number) {
    for (let i = 0; i < w; i++) this.drawPixel(x + i, y, c);
  }
  drawFastVLine(x: number, y: number, h: number, c: number) {
    for (let i = 0; i < h; i++) this.drawPixel(x, y + i, c);
  }
  drawRect(x: number, y: number, w: number, h: number, c: number) {
    this.drawFastHLine(x, y, w, c);
    this.drawFastHLine(x, y + h - 1, w, c);
    this.drawFastVLine(x, y, h, c);
    this.drawFastVLine(x + w - 1, y, h, c);
  }
  fillRect(x: number, y: number, w: number, h: number, c: number) {
    for (let i = 0; i < w; i++) this.drawFastVLine(x + i, y, h, c);
  }
  fillScreen(c: number) {
    this.fillRect(0, 0, this.width(), this.height(), c);
  }
  private circlePts(x0: number, y0: number, r: number, fn: (x: number, y: number) => void) {
    let f = 1 - r, ddx = 1, ddy = -2 * r, x = 0, y = r;
    fn(0, r);
    while (x < y) {
      if (f >= 0) {
        y--;
        ddy += 2;
        f += ddy;
      }
      x++;
      ddx += 2;
      f += ddx;
      fn(x, y);
    }
    void x0;
    void y0;
  }
  drawCircle(x0: number, y0: number, r: number, c: number) {
    this.circlePts(x0, y0, r, (x, y) => {
      for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x], [x, -y], [y, -x], [-x, -y], [-y, -x]]) this.drawPixel(x0 + a, y0 + b, c);
    });
  }
  fillCircle(x0: number, y0: number, r: number, c: number) {
    this.circlePts(x0, y0, r, (x, y) => {
      this.drawFastVLine(x0 + x, y0 - y, 2 * y + 1, c);
      this.drawFastVLine(x0 - x, y0 - y, 2 * y + 1, c);
      this.drawFastVLine(x0 + y, y0 - x, 2 * x + 1, c);
      this.drawFastVLine(x0 - y, y0 - x, 2 * x + 1, c);
    });
  }
  drawRoundRect(x: number, y: number, w: number, h: number, r: number, c: number) {
    r = Math.min(r, Math.floor(Math.min(w, h) / 2));
    this.drawFastHLine(x + r, y, w - 2 * r, c);
    this.drawFastHLine(x + r, y + h - 1, w - 2 * r, c);
    this.drawFastVLine(x, y + r, h - 2 * r, c);
    this.drawFastVLine(x + w - 1, y + r, h - 2 * r, c);
    this.circlePts(0, 0, r, (a, b) => {
      this.drawPixel(x + r - a, y + r - b, c); this.drawPixel(x + r - b, y + r - a, c);
      this.drawPixel(x + w - 1 - r + a, y + r - b, c); this.drawPixel(x + w - 1 - r + b, y + r - a, c);
      this.drawPixel(x + r - a, y + h - 1 - r + b, c); this.drawPixel(x + r - b, y + h - 1 - r + a, c);
      this.drawPixel(x + w - 1 - r + a, y + h - 1 - r + b, c); this.drawPixel(x + w - 1 - r + b, y + h - 1 - r + a, c);
    });
  }
  fillRoundRect(x: number, y: number, w: number, h: number, r: number, c: number) {
    r = Math.min(r, Math.floor(Math.min(w, h) / 2));
    this.fillRect(x + r, y, w - 2 * r, h, c);
    this.circlePts(0, 0, r, (a, b) => {
      this.drawFastVLine(x + r - a, y + r - b, h - 2 * r + 2 * b, c);
      this.drawFastVLine(x + r - b, y + r - a, h - 2 * r + 2 * a, c);
      this.drawFastVLine(x + w - 1 - r + a, y + r - b, h - 2 * r + 2 * b, c);
      this.drawFastVLine(x + w - 1 - r + b, y + r - a, h - 2 * r + 2 * a, c);
    });
  }
  drawTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number) {
    this.drawLine(x0, y0, x1, y1, c);
    this.drawLine(x1, y1, x2, y2, c);
    this.drawLine(x2, y2, x0, y0, c);
  }
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number) {
    const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    const edges: [number, number, number, number][] = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (const [ax, ay, bx, by] of edges) {
        if (ay === by) {
          if (y === ay) xs.push(ax, bx);
          continue;
        }
        if ((y >= ay && y <= by) || (y >= by && y <= ay)) xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
      if (xs.length) this.drawFastHLine(Math.min(...xs), y, Math.max(...xs) - Math.min(...xs) + 1, c);
    }
  }
  drawBitmap(x: number, y: number, bmp: number[], w: number, h: number, c: number, bg?: number) {
    const bw = Math.floor((w + 7) / 8);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const byte = Number(bmp[j * bw + Math.floor(i / 8)] ?? 0);
        if (byte & (0x80 >> (i & 7))) this.drawPixel(x + i, y + j, c);
        else if (bg !== undefined) this.drawPixel(x + i, y + j, bg);
      }
  }
  drawChar(x: number, y: number, ch: number, c: number, bg: number, sx: number, sy = sx) {
    const g = glyph(ch & 255);
    for (let i = 0; i < 6; i++) {
      const line = i < 5 ? g[i] : 0;
      for (let j = 0; j < 8; j++) {
        const on = (line >> j) & 1;
        if (!on && bg === c) continue;
        const col = on ? c : bg;
        if (sx === 1 && sy === 1) this.drawPixel(x + i, y + j, col);
        else this.fillRect(x + i * sx, y + j * sy, sx, sy, col);
      }
    }
  }
  setCursor(x: number, y: number) {
    this.cursorX = x;
    this.cursorY = y;
  }
  getCursorX() {
    return this.cursorX;
  }
  getCursorY() {
    return this.cursorY;
  }
  setTextColor(c: number, bg?: number) {
    this.textColor = c;
    this.textBg = bg ?? c;
  }
  setTextSize(sx: number, sy?: number) {
    this.textSizeX = Math.max(1, sx);
    this.textSizeY = Math.max(1, sy ?? sx);
  }
  setTextWrap(w: number) {
    this.wrap = !!w;
  }
  setRotation(r: number) {
    this.rotation = r & 3;
  }
  getRotation() {
    return this.rotation;
  }
  cp437() {}
  writeChar(c: number) {
    if (c === 10) {
      this.cursorX = 0;
      this.cursorY += this.textSizeY * 8;
    } else if (c !== 13) {
      if (this.wrap && this.cursorX + this.textSizeX * 6 > this.width()) {
        this.cursorX = 0;
        this.cursorY += this.textSizeY * 8;
      }
      this.drawChar(this.cursorX, this.cursorY, c, this.textColor, this.textBg, this.textSizeX, this.textSizeY);
      this.cursorX += this.textSizeX * 6;
    }
    return 1;
  }
  print(s: string) {
    for (let i = 0; i < s.length; i++) this.writeChar(s.charCodeAt(i));
    return s.length;
  }
  println(s: string) {
    return this.print(`${s}\n`);
  }
  write(c: number) {
    return this.writeChar(Number(c) & 255);
  }
  writeStr(s: string) {
    return this.print(s);
  }
  getTextBounds(s: string, x: number, y: number, x1: number[], y1: number[], w: number[], h: number[]) {
    const lines = String(s).split('\n');
    x1[0] = x;
    y1[0] = y;
    w[0] = Math.max(...lines.map((l) => l.length)) * 6 * this.textSizeX;
    h[0] = lines.length * 8 * this.textSizeY;
  }
}

// ------------------------------------------------------------------ SSD1306 (I2C)

export class SSD1306Lib extends GfxLib {
  buffer: Uint8Array;
  addr = 0x3c;
  private warned = false;
  constructor(R: McuRuntime, w = 128, h = 64, ...rest: unknown[]) {
    super(R, w, h);
    this.buffer = new Uint8Array((w * h) / 8);
    if (rest.length >= 3) R.warnLib('Adafruit_SSD1306: only the I2C version of the OLED is simulated — use Adafruit_SSD1306 display(128, 64, &Wire, -1).');
  }
  rawPixel(x: number, y: number, c: number) {
    const i = x + Math.floor(y / 8) * this.W, bit = 1 << (y & 7);
    if (c === 1) this.buffer[i] |= bit;
    else if (c === 0) this.buffer[i] &= ~bit;
    else if (c === 2) this.buffer[i] ^= bit;
  }
  private cmd(...c: number[]) {
    return this.R.wire.transmitRaw(this.addr, [0x00, ...c]);
  }
  begin(_vcc = 2, addr = 0x3c) {
    this.addr = addr & 0x7f;
    this.R.wire.setClock(400000);
    const ok = this.cmd(0xae, 0xd5, 0x80, 0xa8, this.H - 1, 0xd3, 0x00, 0x40, 0x8d, 0x14, 0x20, 0x00, 0xa1, 0xc8, 0xda, this.H === 32 ? 0x02 : 0x12, 0x81, 0xcf, 0xd9, 0xf1, 0xdb, 0x40, 0xa4, 0xa6, 0x2e, 0xaf);
    if (!ok && !this.warned) {
      this.warned = true;
      this.R.warnLib(`Adafruit_SSD1306: no display answered at 0x${this.addr.toString(16).toUpperCase()} — check SDA/SCL wiring, power and the address (0x3C or 0x3D).`);
    }
    return ok;
  }
  clearDisplay() {
    this.buffer.fill(0);
  }
  display() {
    this.cmd(0x22, 0, this.H / 8 - 1, 0x21, 0, this.W - 1);
    for (let i = 0; i < this.buffer.length; i += 32) this.R.wire.transmitRaw(this.addr, [0x40, ...this.buffer.subarray(i, i + 32)]);
  }
  invertDisplay(i: number) {
    this.cmd(i ? 0xa7 : 0xa6);
  }
  dim(d: number) {
    this.cmd(0x81, d ? 0 : 0xcf);
  }
  startscrollright(a: number, b: number) {
    this.cmd(0x26, 0, a, 0, b, 0, 0xff, 0x2f);
  }
  startscrollleft(a: number, b: number) {
    this.cmd(0x27, 0, a, 0, b, 0, 0xff, 0x2f);
  }
  stopscroll() {
    this.cmd(0x2e);
  }
}

// ------------------------------------------------------------------ LedControl (MAX7219, bit-banged like the real library)

const DIGITS: Record<string, number> = {
  '0': 0x7e, '1': 0x30, '2': 0x6d, '3': 0x79, '4': 0x33, '5': 0x5b, '6': 0x5f, '7': 0x70, '8': 0x7f, '9': 0x7b,
  a: 0x77, b: 0x1f, c: 0x0d, d: 0x3d, e: 0x4f, f: 0x47, h: 0x37, l: 0x0e, p: 0x67, '-': 0x01, '_': 0x08, ' ': 0x00, '.': 0x80,
};

export class LedControlLib {
  private status: number[];
  constructor(private R: McuRuntime, private din: number, private clk: number, private cs: number, private num = 1) {
    this.num = Math.max(1, Math.min(8, num));
    this.status = new Array(this.num * 8).fill(0);
    R.pinMode(din, 1);
    R.pinMode(clk, 1);
    R.pinMode(cs, 1);
    R.digitalWrite(cs, 1);
    for (let i = 0; i < this.num; i++) {
      this.transfer(i, 0x0f, 0); // display test off
      this.setScanLimit(i, 7);
      this.transfer(i, 0x09, 0); // no decode
      this.clearDisplay(i);
      this.shutdown(i, 1);
    }
  }
  private transfer(addr: number, op: number, data: number) {
    const bytes = new Array(this.num * 2).fill(0);
    bytes[addr * 2 + 1] = op;
    bytes[addr * 2] = data;
    this.R.digitalWrite(this.cs, 0);
    for (let i = this.num * 2; i > 0; i--) this.R.shiftOut(this.din, this.clk, 1, bytes[i - 1]);
    this.R.digitalWrite(this.cs, 1);
  }
  getDeviceCount() {
    return this.num;
  }
  shutdown(addr: number, b: number) {
    if (addr < 0 || addr >= this.num) return;
    this.transfer(addr, 0x0c, b ? 0 : 1);
  }
  setScanLimit(addr: number, limit: number) {
    if (addr >= 0 && addr < this.num && limit >= 0 && limit < 8) this.transfer(addr, 0x0b, limit);
  }
  setIntensity(addr: number, i: number) {
    if (addr >= 0 && addr < this.num && i >= 0 && i < 16) this.transfer(addr, 0x0a, i);
  }
  clearDisplay(addr: number) {
    if (addr < 0 || addr >= this.num) return;
    for (let i = 0; i < 8; i++) {
      this.status[addr * 8 + i] = 0;
      this.transfer(addr, i + 1, 0);
    }
  }
  setLed(addr: number, row: number, col: number, state: number) {
    if (addr < 0 || addr >= this.num || row < 0 || row > 7 || col < 0 || col > 7) return;
    const v = 0x80 >> col;
    const k = addr * 8 + row;
    this.status[k] = state ? this.status[k] | v : this.status[k] & ~v;
    this.transfer(addr, row + 1, this.status[k]);
  }
  setRow(addr: number, row: number, value: number) {
    if (addr < 0 || addr >= this.num || row < 0 || row > 7) return;
    this.status[addr * 8 + row] = value & 255;
    this.transfer(addr, row + 1, value & 255);
  }
  setColumn(addr: number, col: number, value: number) {
    for (let row = 0; row < 8; row++) this.setLed(addr, row, col, (value >> (7 - row)) & 1);
  }
  setDigit(addr: number, digit: number, value: number, dp: number) {
    if (addr < 0 || addr >= this.num || digit < 0 || digit > 7 || value > 15) return;
    let v = DIGITS[value.toString(16)] ?? 0;
    if (dp) v |= 0x80;
    this.status[addr * 8 + digit] = v;
    this.transfer(addr, digit + 1, v);
  }
  setChar(addr: number, digit: number, value: number, dp: number) {
    if (addr < 0 || addr >= this.num || digit < 0 || digit > 7) return;
    const ch = String.fromCharCode(value & 127).toLowerCase();
    let v = DIGITS[ch] ?? 0;
    if (dp) v |= 0x80;
    this.status[addr * 8 + digit] = v;
    this.transfer(addr, digit + 1, v);
  }
}
