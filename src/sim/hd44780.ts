/**
 * HD44780 character-LCD controller model (the chip on every 16x2 / 20x4 LCD).
 * Accepts full commands/data bytes (parallel LiquidCrystal library), 4-bit nibbles,
 * and raw PCF8574 I2C-backpack bytes (LiquidCrystal_I2C or hand-written Wire code).
 */
export class HD44780 {
  ddram = new Uint8Array(128).fill(32);
  cgram = new Uint8Array(64);
  ac = 0;
  toCgram = false;
  increment = true;
  shiftOnWrite = false;
  displayOn = false;
  cursorOn = false;
  blinkOn = false;
  shift = 0;
  twoLine = true;
  eightBit = true;
  private half: number | null = null;
  /** backlight state as driven by an I2C backpack (parallel LCDs light from the A/K pins) */
  backlight = true;
  private pcfLast = 0;
  /** bumped on every change so views can re-render cheaply */
  version = 0;

  reset() {
    this.ddram.fill(32);
    this.cgram.fill(0);
    this.ac = 0;
    this.shift = 0;
    this.displayOn = false;
    this.eightBit = true;
    this.half = null;
    this.version++;
  }

  command(c: number) {
    c &= 255;
    this.version++;
    if (c & 0x80) {
      this.toCgram = false;
      this.ac = c & 0x7f;
    } else if (c & 0x40) {
      this.toCgram = true;
      this.ac = c & 0x3f;
    } else if (c & 0x20) {
      this.eightBit = !!(c & 0x10);
      this.twoLine = !!(c & 0x08);
      this.half = null;
    } else if (c & 0x10) {
      const display = !!(c & 0x08), right = !!(c & 0x04);
      if (display) this.shift += right ? -1 : 1;
      else this.moveAc(right ? 1 : -1);
    } else if (c & 0x08) {
      this.displayOn = !!(c & 0x04);
      this.cursorOn = !!(c & 0x02);
      this.blinkOn = !!(c & 0x01);
    } else if (c & 0x04) {
      this.increment = !!(c & 0x02);
      this.shiftOnWrite = !!(c & 0x01);
    } else if (c & 0x02) {
      this.ac = 0;
      this.shift = 0;
      this.toCgram = false;
    } else if (c & 0x01) {
      this.ddram.fill(32);
      this.ac = 0;
      this.shift = 0;
      this.increment = true;
      this.toCgram = false;
    }
  }

  data(d: number) {
    d &= 255;
    this.version++;
    if (this.toCgram) {
      this.cgram[this.ac & 63] = d & 31;
      this.ac = (this.ac + (this.increment ? 1 : -1)) & 63;
      return;
    }
    this.ddram[this.ac & 127] = d;
    this.moveAc(this.increment ? 1 : -1);
    if (this.shiftOnWrite) this.shift += this.increment ? 1 : -1;
  }

  private moveAc(d: number) {
    let a = this.ac + d;
    if (this.twoLine) {
      if (a === 0x28) a = 0x40;
      else if (a === 0x68) a = 0x00;
      else if (a === 0x3f) a = 0x27;
      else if (a === -1) a = 0x67;
    } else a = ((a % 80) + 80) % 80;
    this.ac = a;
  }

  /** One 4-bit transfer (D4–D7). */
  nibble(rs: boolean, n: number) {
    n &= 15;
    if (this.eightBit) {
      // in 8-bit mode the low data lines are unconnected (read as 0)
      const b = n << 4;
      if (rs) this.data(b);
      else this.command(b);
      return;
    }
    if (this.half === null) {
      this.half = n;
      return;
    }
    const b = (this.half << 4) | n;
    this.half = null;
    if (rs) this.data(b);
    else this.command(b);
  }

  /** PCF8574 backpack: P0=RS P1=RW P2=EN P3=backlight P4–P7=D4–D7; data latches on EN falling. */
  pcfWrite(b: number) {
    b &= 255;
    const bl = !!(b & 0x08);
    if (bl !== this.backlight) {
      this.backlight = bl;
      this.version++;
    }
    if (this.pcfLast & 0x04 && !(b & 0x04) && !(this.pcfLast & 0x02)) this.nibble(!!(this.pcfLast & 0x01), this.pcfLast >> 4);
    this.pcfLast = b;
  }

  /** Character codes visible on a cols×rows display. */
  visible(cols: number, rows: number): number[][] {
    const base = [0x00, 0x40, cols, 0x40 + cols];
    const out: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        let addr: number;
        if (r < 2 || rows <= 2) addr = base[r] + ((((c + this.shift) % 40) + 40) % 40);
        else addr = base[r] + c + this.shift;
        row.push(this.ddram[addr & 127]);
      }
      out.push(row);
    }
    return out;
  }

  /** Cursor (row, col) on screen, or null when off-screen. */
  cursorPos(cols: number, rows: number): [number, number] | null {
    if (this.toCgram) return null;
    const base = [0x00, 0x40, cols, 0x40 + cols];
    for (let r = rows - 1; r >= 0; r--) {
      const rel = this.ac - base[r];
      if (rel >= 0 && rel < 40) {
        const c = r < 2 ? (((rel - this.shift) % 40) + 40) % 40 : rel - this.shift;
        if (c >= 0 && c < cols) return [r, c];
        return null;
      }
    }
    return null;
  }

  glyph(code: number): number[] {
    const i = (code & 7) * 8;
    return Array.from(this.cgram.slice(i, i + 8));
  }
}

/** HD44780 A00 ROM → display text for printable codes. */
export function lcdChar(code: number): string {
  if (code >= 32 && code < 126) return String.fromCharCode(code);
  if (code === 0x7e) return '→';
  if (code === 0x7f) return '←';
  if (code === 0xdf) return '°';
  if (code === 0xe4) return 'µ';
  if (code === 0xf4) return 'Ω';
  if (code === 0xff) return '█';
  if (code === 0xa5) return '·';
  return ' ';
}
