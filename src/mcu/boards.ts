/** Electrical + compiler description of each programmable board. */
export interface BoardSpec {
  id: string;
  /** chip family: decides family-specific APIs (ledc on ESP32 …) */
  family: 'avr' | 'esp32' | 'esp8266' | 'rp2040' | 'stm32' | 'teensy' | 'pic' | 'generic';
  /** usual Serial baud rate for this board (examples, blocks) */
  baud: number;
  /** analogRead(n) with a small n that isn't an ADC pin reads ADC channel n on this pin (ATtiny, PIC) */
  analogChannels?: number[];
  /** names shown in analog dropdowns (label, value) */
  analogNames?: [string, string][];
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
  /** predefined preprocessor macros (#if defined(ESP32) …) */
  macros: Record<string, number>;
  /** hardware SPI pins */
  spi: { mosi: number; miso: number; sck: number; ss: number };
  /** hardware serial ports: index 0 = Serial (USB), 1 = Serial1 … (null = not present) */
  uarts: ({ rx: number; tx: number } | null)[];
  /** EEPROM size in bytes (ESP32: emulated in flash) */
  eepromSize: number;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const UNO: BoardSpec = {
  id: 'uno',
  family: 'avr',
  baud: 9600,
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
  macros: { ARDUINO: 10819, ARDUINO_AVR_UNO: 1, ARDUINO_ARCH_AVR: 1, __AVR__: 1, __AVR_ATmega328P__: 1, F_CPU: 16000000 },
  spi: { mosi: 11, miso: 12, sck: 13, ss: 10 },
  uarts: [{ rx: 0, tx: 1 }],
  eepromSize: 1024,
};

// DOIT ESP32 DevKit V1 (30 pins)
const ESP32_IO = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
const ESP32_NAMES: Record<string, number> = { VP: 36, VN: 39, TX0: 1, RX0: 3, TX2: 17, RX2: 16 };

export const ESP32: BoardSpec = {
  id: 'esp32',
  family: 'esp32',
  baud: 115200,
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
  macros: { ARDUINO: 10819, ESP32: 1, ARDUINO_ARCH_ESP32: 1, ESP_PLATFORM: 1, ARDUINO_ESP32_DEV: 1, F_CPU: 240000000 },
  spi: { mosi: 23, miso: 19, sck: 18, ss: 5 },
  uarts: [{ rx: 3, tx: 1 }, { rx: 9, tx: 10 }, { rx: 16, tx: 17 }],
  eepromSize: 4096,
};

const named = (prefix: string, nums: number[], offset = 0): Record<string, number> => Object.fromEntries(nums.map((n) => [`${prefix}${n}`, n + offset]));

/** Arduino Nano (ATmega328P): the Uno's chip plus analog-only A6/A7. */
export const NANO: BoardSpec = {
  ...UNO,
  id: 'nano',
  name: 'Arduino Nano',
  pinCount: 22,
  pins: range(0, 21),
  adcPins: range(14, 21),
  inputOnly: [20, 21],
  constants: { ...UNO.constants, A6: 20, A7: 21 },
  pinIndex: (id) => (/^D\d+$/.test(id) ? (Number(id.slice(1)) <= 13 ? Number(id.slice(1)) : -1) : /^A[0-7]$/.test(id) ? 14 + Number(id.slice(1)) : -1),
  macros: { ...UNO.macros, ARDUINO_AVR_NANO: 1, ARDUINO_AVR_UNO: 0 },
};

/** Arduino Mega 2560. */
export const MEGA: BoardSpec = {
  ...UNO,
  id: 'mega',
  name: 'Arduino Mega 2560',
  pinCount: 70,
  pins: range(0, 69),
  analogChannelBase: 54,
  adcPins: range(54, 69),
  pwmPins: [...range(2, 13), 44, 45, 46],
  interruptPins: [2, 3, 21, 20, 19, 18],
  i2c: { sda: 20, scl: 21 },
  spi: { mosi: 51, miso: 50, sck: 52, ss: 53 },
  uarts: [{ rx: 0, tx: 1 }, { rx: 19, tx: 18 }, { rx: 17, tx: 16 }, { rx: 15, tx: 14 }],
  eepromSize: 4096,
  constants: { LED_BUILTIN: 13, ...named('A', range(0, 15), 54), SDA: 20, SCL: 21, SS: 53, MOSI: 51, MISO: 50, SCK: 52 },
  pinIndex: (id) => (/^D\d+$/.test(id) && Number(id.slice(1)) <= 53 ? Number(id.slice(1)) : /^A\d+$/.test(id) && Number(id.slice(1)) <= 15 ? 54 + Number(id.slice(1)) : -1),
  pinId: (n) => (n < 54 ? `D${n}` : `A${n - 54}`),
  pwmFrequency: (pin) => (pin === 4 || pin === 13 ? 980 : 490),
  macros: { ARDUINO: 10819, ARDUINO_AVR_MEGA2560: 1, ARDUINO_ARCH_AVR: 1, __AVR__: 1, __AVR_ATmega2560__: 1, F_CPU: 16000000 },
};

/** Arduino Micro (ATmega32U4, native USB). */
export const MICRO: BoardSpec = {
  ...UNO,
  id: 'micro',
  name: 'Arduino Micro',
  pinCount: 24,
  pins: range(0, 23),
  analogChannelBase: 18,
  adcPins: range(18, 23),
  pwmPins: [3, 5, 6, 9, 10, 11, 13],
  interruptPins: [3, 2, 0, 1, 7],
  i2c: { sda: 2, scl: 3 },
  spi: { mosi: 16, miso: 14, sck: 15, ss: 17 },
  uarts: [{ rx: -1, tx: -1 }, { rx: 0, tx: 1 }],
  constants: { LED_BUILTIN: 13, ...named('A', range(0, 5), 18), SDA: 2, SCL: 3, MOSI: 16, MISO: 14, SCK: 15, SS: 17 },
  pinIndex: (id) => {
    const special: Record<string, number> = { MOSI: 16, MISO: 14, SCK: 15 };
    if (special[id] !== undefined) return special[id];
    return /^D\d+$/.test(id) && Number(id.slice(1)) <= 13 ? Number(id.slice(1)) : /^A[0-5]$/.test(id) ? 18 + Number(id.slice(1)) : -1;
  },
  pinId: (n) => ({ 14: 'MISO', 15: 'SCK', 16: 'MOSI' } as Record<number, string>)[n] ?? (n < 14 ? `D${n}` : `A${n - 18}`),
  macros: { ARDUINO: 10819, ARDUINO_AVR_MICRO: 1, ARDUINO_ARCH_AVR: 1, __AVR__: 1, __AVR_ATmega32U4__: 1, F_CPU: 16000000 },
};

// NodeMCU v1.0 (ESP-12E): the silk-screen D-numbers map to GPIOs
const NODEMCU: Record<string, number> = { D0: 16, D1: 5, D2: 4, D3: 0, D4: 2, D5: 14, D6: 12, D7: 13, D8: 15, RX: 3, TX: 1, SD2: 9, SD3: 10, A0: 17 };

export const ESP8266: BoardSpec = {
  id: 'esp8266',
  family: 'esp8266',
  baud: 115200,
  name: 'ESP8266 NodeMCU',
  pinCount: 18,
  pins: [0, 1, 2, 3, 4, 5, 9, 10, 12, 13, 14, 15, 16, 17],
  vcc: 3.3,
  adcBits: 10,
  analogChannelBase: null,
  adcPins: [17],
  analogNames: [['A0', 'A0']],
  pwmPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15],
  inputOnly: [17],
  dacPins: [],
  interruptPins: 'all',
  pinResistance: 40,
  pullup: 40000,
  maxPinCurrent: 0.012,
  i2c: { sda: 4, scl: 5 },
  statementCost: 0.12,
  int32: true,
  constants: { ...NODEMCU, LED_BUILTIN: 2, SDA: 4, SCL: 5 },
  pinIndex: (id) => NODEMCU[id] ?? -1,
  pinId: (n) => Object.entries(NODEMCU).find(([, v]) => v === n)?.[0] ?? `GPIO${n}`,
  pwmFrequency: () => 1000,
  macros: { ARDUINO: 10819, ESP8266: 1, ARDUINO_ARCH_ESP8266: 1, ARDUINO_ESP8266_NODEMCU_ESP12E: 1, F_CPU: 80000000 },
  spi: { mosi: 13, miso: 12, sck: 14, ss: 15 },
  uarts: [{ rx: 3, tx: 1 }, { rx: -1, tx: 2 }],
  eepromSize: 4096,
};

const picoPins = (led: number) => [...range(0, 22), 25, 26, 27, 28, ...(led > 28 ? [led] : [])];

function pico(w: boolean): BoardSpec {
  const led = w ? 32 : 25;
  return {
    id: w ? 'picow' : 'pico',
    family: 'rp2040',
    baud: 115200,
    name: w ? 'Raspberry Pi Pico W' : 'Raspberry Pi Pico',
    pinCount: w ? 33 : 29,
    pins: picoPins(led),
    vcc: 3.3,
    adcBits: 10,
    analogChannelBase: 26,
    adcPins: [26, 27, 28],
    analogNames: [['A0 (GP26)', 'A0'], ['A1 (GP27)', 'A1'], ['A2 (GP28)', 'A2']],
    pwmPins: 'all',
    inputOnly: [],
    dacPins: [],
    interruptPins: 'all',
    pinResistance: 40,
    pullup: 50000,
    maxPinCurrent: 0.012,
    i2c: { sda: 4, scl: 5 },
    statementCost: 0.06,
    int32: true,
    constants: { LED_BUILTIN: led, PIN_LED: led, A0: 26, A1: 27, A2: 28, SDA: 4, SCL: 5, ...named('GP', range(0, 28)), ...named('D', range(0, 28)) },
    pinIndex: (id) => (/^GP\d+$/.test(id) && Number(id.slice(2)) <= 28 ? Number(id.slice(2)) : -1),
    pinId: (n) => (n === led && w ? 'LED' : `GP${n}`),
    pwmFrequency: () => 1000,
    macros: { ARDUINO: 10819, ARDUINO_ARCH_RP2040: 1, [w ? 'ARDUINO_RASPBERRY_PI_PICO_W' : 'ARDUINO_RASPBERRY_PI_PICO']: 1, F_CPU: 133000000 },
    spi: { mosi: 19, miso: 16, sck: 18, ss: 17 },
    uarts: [{ rx: -1, tx: -1 }, { rx: 1, tx: 0 }, { rx: 9, tx: 8 }],
    eepromSize: 4096,
  };
}
export const PICO = pico(false);
export const PICO_W = pico(true);

// STM32F103C8 "Blue Pill": PA0–15 → 0–15, PB0–15 → 16–31, PC13–15 → 45–47
const STM_IDS: Record<string, number> = { ...named('PA', range(0, 15)), ...named('PB', range(0, 15), 16), PC13: 45, PC14: 46, PC15: 47 };

export const BLUEPILL: BoardSpec = {
  id: 'bluepill',
  family: 'stm32',
  baud: 115200,
  name: 'STM32 Blue Pill (F103C8)',
  pinCount: 48,
  pins: Object.values(STM_IDS),
  vcc: 3.3,
  adcBits: 10,
  analogChannelBase: null,
  adcPins: [0, 1, 2, 3, 4, 5, 6, 7, 16, 17],
  analogNames: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [`PA${i}`, `PA${i}`] as [string, string]).concat([['PB0', 'PB0'], ['PB1', 'PB1']]),
  pwmPins: [0, 1, 2, 3, 6, 7, 8, 9, 10, 16, 17, 22, 23, 24, 25],
  inputOnly: [],
  dacPins: [],
  interruptPins: 'all',
  pinResistance: 40,
  pullup: 40000,
  maxPinCurrent: 0.02,
  i2c: { sda: 23, scl: 22 },
  statementCost: 0.14,
  int32: true,
  constants: { ...STM_IDS, LED_BUILTIN: 45, ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 16, 17].map((p, i) => [`A${i}`, p])), SDA: 23, SCL: 22 },
  pinIndex: (id) => STM_IDS[id] ?? -1,
  pinId: (n) => Object.entries(STM_IDS).find(([, v]) => v === n)?.[0] ?? `P${n}`,
  pwmFrequency: () => 1000,
  macros: { ARDUINO: 10819, ARDUINO_ARCH_STM32: 1, STM32F1xx: 1, STM32F103xB: 1, ARDUINO_BLUEPILL_F103C8: 1, F_CPU: 72000000 },
  spi: { mosi: 7, miso: 6, sck: 5, ss: 4 },
  uarts: [{ rx: 10, tx: 9 }, { rx: 10, tx: 9 }, { rx: 3, tx: 2 }, { rx: 27, tx: 26 }],
  eepromSize: 1024,
};

export const TEENSY40: BoardSpec = {
  ...UNO,
  id: 'teensy40',
  family: 'teensy',
  baud: 115200,
  name: 'Teensy 4.0',
  pinCount: 24,
  pins: range(0, 23),
  vcc: 3.3,
  adcBits: 10,
  analogChannelBase: 14,
  adcPins: range(14, 23),
  pwmPins: [...range(0, 15), 18, 19, 22, 23],
  interruptPins: 'all',
  pinResistance: 30,
  pullup: 22000,
  maxPinCurrent: 0.01,
  i2c: { sda: 18, scl: 19 },
  statementCost: 0.004,
  int32: true,
  constants: { LED_BUILTIN: 13, ...named('A', range(0, 9), 14), SDA: 18, SCL: 19 },
  pinIndex: (id) => (/^D\d+$/.test(id) && Number(id.slice(1)) <= 23 ? Number(id.slice(1)) : -1),
  pinId: (n) => `D${n}`,
  pwmFrequency: () => 4482,
  macros: { ARDUINO: 10819, TEENSYDUINO: 159, ARDUINO_TEENSY40: 1, __IMXRT1062__: 1, F_CPU: 600000000 },
  spi: { mosi: 11, miso: 12, sck: 13, ss: 10 },
  uarts: [{ rx: -1, tx: -1 }, { rx: 0, tx: 1 }, { rx: 7, tx: 8 }, { rx: 15, tx: 14 }, { rx: 16, tx: 17 }, { rx: 21, tx: 20 }],
  eepromSize: 1080,
};

/** ATtiny85 (ATTinyCore numbering: pin n = PBn). */
export const ATTINY85: BoardSpec = {
  ...UNO,
  id: 'attiny85',
  name: 'ATtiny85',
  pinCount: 6,
  pins: range(0, 5),
  analogChannelBase: null,
  adcPins: [2, 3, 4, 5],
  analogChannels: [5, 2, 4, 3],
  analogNames: [['A1 (PB2)', 'A1'], ['A2 (PB4)', 'A2'], ['A3 (PB3)', 'A3']],
  pwmPins: [0, 1, 4],
  interruptPins: [2],
  i2c: { sda: 0, scl: 2 },
  spi: { mosi: 0, miso: 1, sck: 2, ss: 3 },
  uarts: [{ rx: 1, tx: 0 }],
  statementCost: 2,
  eepromSize: 512,
  constants: { LED_BUILTIN: 1, A0: 5, A1: 2, A2: 4, A3: 3, ...named('PB', range(0, 5)), PIN_B0: 0, PIN_B1: 1, PIN_B2: 2, PIN_B3: 3, PIN_B4: 4, PIN_B5: 5 },
  pinIndex: (id) => (/^PB[0-5]$/.test(id) ? Number(id.slice(2)) : -1),
  pinId: (n) => `PB${n}`,
  macros: { ARDUINO: 10819, ARDUINO_AVR_ATTINYX5: 1, ARDUINO_ARCH_AVR: 1, __AVR__: 1, __AVR_ATtiny85__: 1, F_CPU: 8000000 },
};

/** Bare ATmega328P chip — same numbering as the Uno. */
export const ATMEGA328P: BoardSpec = { ...UNO, id: 'atmega328p', name: 'ATmega328P', macros: { ...UNO.macros, ARDUINO_AVR_UNO: 0 } };

// PIC16F877A: RA0–5 → 0–5, RB0–7 → 8–15, RC0–7 → 16–23, RD0–7 → 24–31, RE0–2 → 32–34
const PIC_IDS: Record<string, number> = { ...named('RA', range(0, 5)), ...named('RB', range(0, 7), 8), ...named('RC', range(0, 7), 16), ...named('RD', range(0, 7), 24), ...named('RE', range(0, 2), 32) };

export const PIC16F877A: BoardSpec = {
  id: 'pic16f877a',
  family: 'pic',
  baud: 9600,
  name: 'PIC16F877A',
  pinCount: 35,
  pins: Object.values(PIC_IDS),
  vcc: 5,
  adcBits: 10,
  analogChannelBase: null,
  adcPins: [0, 1, 2, 3, 5, 32, 33, 34],
  analogChannels: [0, 1, 2, 3, 5, 32, 33, 34],
  analogNames: ['RA0', 'RA1', 'RA2', 'RA3', 'RA5', 'RE0', 'RE1', 'RE2'].map((n, i) => [`AN${i} (${n})`, n] as [string, string]),
  pwmPins: [17, 18],
  inputOnly: [],
  dacPins: [],
  interruptPins: [8],
  pinResistance: 30,
  pullup: 30000,
  maxPinCurrent: 0.025,
  i2c: { sda: 20, scl: 19 },
  statementCost: 2,
  int32: false,
  constants: { ...PIC_IDS, LED_BUILTIN: 8 },
  pinIndex: (id) => PIC_IDS[id] ?? -1,
  pinId: (n) => Object.entries(PIC_IDS).find(([, v]) => v === n)?.[0] ?? `P${n}`,
  pwmFrequency: () => 1220,
  macros: { __PIC16F877A__: 1, _XTAL_FREQ: 20000000 },
  spi: { mosi: 21, miso: 20, sck: 19, ss: 5 },
  uarts: [{ rx: 23, tx: 22 }],
  eepromSize: 256,
};

/** A neutral 20-pin microcontroller for learning (P0–P15). */
export const GENERIC_MCU: BoardSpec = {
  id: 'generic',
  family: 'generic',
  baud: 9600,
  name: 'Generic MCU',
  pinCount: 16,
  pins: range(0, 15),
  vcc: 5,
  adcBits: 10,
  analogChannelBase: null,
  adcPins: range(0, 7),
  analogNames: range(0, 7).map((i) => [`P${i}`, `P${i}`] as [string, string]),
  pwmPins: [8, 9, 10, 11],
  inputOnly: [],
  dacPins: [],
  interruptPins: [2, 3],
  pinResistance: 30,
  pullup: 30000,
  maxPinCurrent: 0.02,
  i2c: { sda: 14, scl: 15 },
  statementCost: 1,
  int32: false,
  constants: { ...named('P', range(0, 15)), LED_BUILTIN: 8 },
  pinIndex: (id) => (/^P\d+$/.test(id) && Number(id.slice(1)) <= 15 ? Number(id.slice(1)) : -1),
  pinId: (n) => `P${n}`,
  pwmFrequency: () => 1000,
  macros: { ARDUINO: 10819 },
  spi: { mosi: 9, miso: 10, sck: 11, ss: 8 },
  uarts: [{ rx: 12, tx: 13 }],
  eepromSize: 512,
};

export const BOARDS = { uno: UNO, esp32: ESP32, nano: NANO, mega: MEGA, micro: MICRO, esp8266: ESP8266, pico: PICO, picow: PICO_W, bluepill: BLUEPILL, teensy40: TEENSY40, attiny85: ATTINY85, atmega328p: ATMEGA328P, pic16f877a: PIC16F877A, generic: GENERIC_MCU };
