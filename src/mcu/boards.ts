/** Electrical + compiler description of each programmable board. */
export interface BoardSpec {
  id: 'uno' | 'esp32';
  name: string;
  /** size of the pin table (indexed by Arduino pin / GPIO number) */
  pinCount: number;
  /** pins that physically exist */
  pins: number[];
  vcc: number;
  adcBits: number;
  /** analogRead(n) for small n means channel n (Uno: A0 = 14 + n); null = argument is the GPIO */
  analogChannelBase: number | null;
  adcPins: number[];
  pwmPins: number[] | 'all';
  inputOnly: number[];
  dacPins: number[];
  /** attachInterrupt(n): Uno maps interrupt numbers to pins, ESP32 uses the GPIO directly */
  interruptPins: number[] | 'all';
  pinResistance: number;
  pullup: number;
  maxPinCurrent: number;
  i2c: { sda: number; scl: number };
  /** simulated µs per C statement (CPU speed) */
  statementCost: number;
  /** int is 32-bit (ESP32) instead of 16-bit (AVR) */
  int32: boolean;
  /** board-specific constants for the compiler */
  constants: Record<string, number>;
  /** header pin id (e.g. "D13", "A0", "D23") → pin number, -1 if not an I/O pin */
  pinIndex: (id: string) => number;
  /** pin number → header pin id */
  pinId: (n: number) => string;
  pwmFrequency: (pin: number) => number;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const UNO: BoardSpec = {
  id: 'uno',
  name: 'Arduino Uno R3',
  pinCount: 20,
  pins: range(0, 19),
  vcc: 5,
  adcBits: 10,
  analogChannelBase: 14,
  adcPins: range(14, 19),
  pwmPins: [3, 5, 6, 9, 10, 11],
  inputOnly: [],
  dacPins: [],
  interruptPins: [2, 3],
  pinResistance: 25,
  pullup: 35000,
  maxPinCurrent: 0.04,
  i2c: { sda: 18, scl: 19 },
  statementCost: 1,
  int32: false,
  constants: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, SDA: 18, SCL: 19 },
  pinIndex: (id) => (/^D\d+$/.test(id) ? Number(id.slice(1)) : /^A\d$/.test(id) ? 14 + Number(id.slice(1)) : -1),
  pinId: (n) => (n < 14 ? `D${n}` : `A${n - 14}`),
  pwmFrequency: (pin) => (pin === 5 || pin === 6 ? 980 : 490),
};

// DOIT ESP32 DevKit V1 (30 pins)
const ESP32_IO = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
const ESP32_NAMES: Record<string, number> = { VP: 36, VN: 39, TX0: 1, RX0: 3, TX2: 17, RX2: 16 };

export const ESP32: BoardSpec = {
  id: 'esp32',
  name: 'ESP32 DevKit V1',
  pinCount: 40,
  pins: ESP32_IO,
  vcc: 3.3,
  adcBits: 12,
  analogChannelBase: null,
  adcPins: [32, 33, 34, 35, 36, 39, 25, 26, 27, 14, 12, 13, 15, 2, 4],
  pwmPins: 'all',
  inputOnly: [34, 35, 36, 39],
  dacPins: [25, 26],
  interruptPins: 'all',
  pinResistance: 30,
  pullup: 45000,
  maxPinCurrent: 0.04,
  i2c: { sda: 21, scl: 22 },
  statementCost: 0.05,
  int32: true,
  constants: {
    LED_BUILTIN: 2, A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12,
    A16: 14, A17: 27, A18: 25, A19: 26, SDA: 21, SCL: 22, DAC1: 25, DAC2: 26, TX: 1, RX: 3,
  },
  pinIndex: (id) => {
    if (ESP32_NAMES[id] !== undefined) return ESP32_NAMES[id];
    if (/^D\d+$/.test(id)) {
      const n = Number(id.slice(1));
      return ESP32_IO.includes(n) ? n : -1;
    }
    return -1;
  },
  pinId: (n) => Object.entries(ESP32_NAMES).find(([, v]) => v === n)?.[0] ?? `D${n}`,
  pwmFrequency: () => 1000,
};

export const BOARDS = { uno: UNO, esp32: ESP32 };
