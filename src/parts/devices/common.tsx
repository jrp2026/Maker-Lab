/** Shared helpers for device parts (spec part + TypeScript behaviour). */
import type { SimBuilder } from '../../sim/builder';
import type { PartExt } from '../../ai/customPart';
import type { Raw } from '../kit';

export type DevicePart = [Raw, PartExt];

/** Supply check: VCC above `min` volts relative to GND. */
export const poweredFn = (b: SimBuilder, min: number, vcc = 'VCC', gnd = 'GND') => () => b.volt(vcc) - b.volt(gnd) > min;

/** 256-register I2C chip with an auto-incrementing register pointer (most sensors). */
export class RegChip {
  regs = new Uint8Array(256);
  ptr = 0;
  constructor(private onWrite?: (reg: number, v: number) => void, private onRead?: (reg: number) => number | undefined) {}
  write(bytes: number[]) {
    if (!bytes.length) return;
    this.ptr = bytes[0] & 255;
    for (let i = 1; i < bytes.length; i++) {
      this.regs[this.ptr] = bytes[i] & 255;
      this.onWrite?.(this.ptr, bytes[i] & 255);
      this.ptr = (this.ptr + 1) & 255;
    }
  }
  read(n: number) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      out.push(this.onRead?.(this.ptr) ?? this.regs[this.ptr]);
      this.ptr = (this.ptr + 1) & 255;
    }
    return out;
  }
}

/** big-endian / little-endian int16 into registers */
export function putS16BE(regs: Uint8Array, at: number, v: number) {
  const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff;
  regs[at] = x >> 8;
  regs[at + 1] = x & 255;
}
export function putS16LE(regs: Uint8Array, at: number, v: number) {
  const x = Math.max(-32768, Math.min(32767, Math.round(v))) & 0xffff;
  regs[at] = x & 255;
  regs[at + 1] = x >> 8;
}

/** Terminal-style scrollback kept in the part's state (survives rebuilds). */
export function scrollback(state: Record<string, any>, key = 'term') {
  const st = (state[key] ??= { lines: [''] as string[] });
  return {
    add(text: string) {
      for (const ch of text.replace(/\r\n/g, '\n')) {
        if (ch === '\n') st.lines.push('');
        else if (ch !== '\r') st.lines[st.lines.length - 1] += ch;
      }
      if (st.lines.length > 60) st.lines.splice(0, st.lines.length - 60);
    },
    lines: (n: number) => st.lines.slice(-n) as string[],
  };
}

/** Text lines drawn inside a rectangle (terminal / phone screen overlays). */
export function TextLines({ x, y, w, lines, size = 4, color = '#9effa8', bg = '#0d1117', h }: { x: number; y: number; w: number; h: number; lines: string[]; size?: number; color?: string; bg?: string }) {
  const max = Math.floor(w / (size * 0.6));
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={x} y={y} width={w} height={h} fill={bg} rx={1} />
      {lines.map((l, i) => (
        <text key={i} x={x + 1.5} y={y + size + 1 + i * (size + 1)} fontSize={size} fill={color} fontFamily="'JetBrains Mono', monospace" style={{ whiteSpace: 'pre' }}>
          {l.length > max ? l.slice(0, max - 1) + '…' : l}
        </text>
      ))}
    </g>
  );
}

/** Take the messages the user queued with a 'send' field. */
export function drain(input: Record<string, any>, key: string): string[] {
  const q = input[key] as string[] | undefined;
  return q?.length ? q.splice(0) : [];
}

/** Text scheduled to go out of a UART pin after a delay (modules answer AT commands a bit later). */
export class Outbox {
  private q: { at: number; text: string }[] = [];
  constructor(private send: (text: string) => void) {}
  /** delay in µs */
  push(text: string, delayUs = 2000, now = 0) {
    const last = this.q.length ? this.q[this.q.length - 1].at : 0;
    this.q.push({ at: Math.max(now + delayUs, last), text });
  }
  flush(now: number) {
    while (this.q.length && this.q[0].at <= now) this.send(this.q.shift()!.text);
  }
}
