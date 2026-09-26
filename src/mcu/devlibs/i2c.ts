/** Register-level I2C helpers for libraries (they go through the simulated Wire bus, like the real ones). */
import type { McuRuntime } from '../runtime';

export function i2cWrite(R: McuRuntime, addr: number, bytes: number[]): boolean {
  return R.wire.transmitRaw(addr, bytes.map((b) => b & 255));
}

export function i2cRead(R: McuRuntime, addr: number, n: number): number[] {
  R.wire.requestFrom(addr, n);
  const out: number[] = [];
  while (R.wire.available()) out.push(R.wire.read());
  return out;
}

export function i2cReadReg(R: McuRuntime, addr: number, reg: number, n: number): number[] {
  if (!i2cWrite(R, addr, [reg])) return [];
  return i2cRead(R, addr, n);
}

export const s16 = (hi: number, lo: number) => (((hi << 8) | lo) << 16) >> 16;
export const u16le = (b: number[], i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
export const s16le = (b: number[], i: number) => (u16le(b, i) << 16) >> 16;
export const bcd2bin = (v: number) => (v >> 4) * 10 + (v & 15);
export const bin2bcd = (v: number) => ((Math.floor(v / 10) % 10) << 4) | v % 10;
