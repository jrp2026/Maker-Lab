/** Sensor / I2C chip devices: HC-SR04, DHT, BMP280, MPU6050, QMC5883L, INA219, ADS1115, MCP4725, PCF8574, PCA9685. */
import { BMP280_CALIB, bmpRaw } from '../../mcu/devlibs/bmp280math';
import { COL, chip, circle, crystalCan, ecap, gridInCircle, header, jumper, legs, line, moduleBoard, path, pcb, pinLabels, pinRow, rect, screwTerminals, silk, smdRow, statusLed, text, type Raw } from '../kit';

/** HC-SR04 ultrasonic transducer: aluminium can with a black mesh face. */
const transducer = (cx: number, cy: number, r: number): Raw[] => [
  circle(cx, cy, r, '#f1f3f5', { grad: '#8a929b', gradDir: 'd', shadow: 1, stroke: '#6d757e', strokeWidth: 0.5 }),
  circle(cx, cy, r * 0.74, '#26282c', { grad: '#0f1012', gradDir: 'r' }),
  ...gridInCircle(cx, cy, r * 0.7, r / 5.5, '#3c3f45', 0.45),
];
import { poweredFn, putS16BE, putS16LE, RegChip, type DevicePart } from './common';

const I2C_LABELS = { VCC: '+3.3–5 V', SCL: 'I2C clock', SDA: 'I2C data' };
const i2cLoads = (extra: string[] = []): Raw[] => ['SDA', 'SCL', ...extra].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e6 }));

// ------------------------------------------------------------------ HC-SR04

const hcsr04: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'TRIG', 'ECHO', 'GND'], { h: 44, w: 96, color: COL.pcbBlue, holes: 'corners', labels: { VCC: '+5 V', TRIG: 'Trigger (10 µs pulse)', ECHO: 'Echo (HIGH for the round-trip time)' } });
  return [
    {
      type: 'hc-sr04', name: 'Ultrasonic distance sensor (HC-SR04)', category: 'sensors',
      description: 'Sends a 40 kHz ping when TRIG gets a 10 µs pulse; ECHO then goes HIGH for the sound\'s round-trip time (58 µs per cm, 2–400 cm). Read it with pulseIn(echo, HIGH) or NewPing. Set the obstacle distance while simulating.',
      keywords: ['ultrasonic', 'hc-sr04', 'distance', 'sonar', 'range finder', 'newping', 'pulsein'],
      pins: b.pins,
      props: [{ key: 'dist', label: 'Obstacle distance', type: 'slider', default: 30, min: 1, max: 450, step: 1, unit: 'cm' }],
      drag: 'dist',
      shapes: [
        ...b.shapes,
        ...transducer(-12, -28, 15), ...transducer(42, -28, 15),
        ...crystalCan(8, -45, 14, 5), silk(15, -32, 'HC-SR04', 3.2), silk(-12, -9.5, 'T', 3), silk(42, -9.5, 'R', 3),
        ...smdRow(8, -24, 3, 5, false, 'rcr'),
      ],
      readouts: [{ value: 'dist', unit: 'cm', x: 15, y: -52, size: 4.5 }],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 330 }, { id: 'RT', kind: 'resistor', a: 'TRIG', b: 'GND', value: 1e6 }, { id: 'EO', kind: 'vsource', p: 'ECHO', n: 'GND', value: 0, r: 100 }] },
    },
    {
      setup(bld, comp) {
        const powered = poweredFn(bld, 4.2);
        let lastTrig = -1e12;
        bld.registerDevice({
          kind: 'pulse', key: 'out', pins: { out: 'ECHO', trig: 'TRIG' }, powered,
          watch: { trig: (v, t) => (!v ? (lastTrig = t) : undefined) },
          pulse(state, now) {
            if (!state || now - lastTrig > 60000) return null; // no ping → no echo
            const d = Number(comp.props.dist ?? 30);
            return d < 2 || d > 400 ? 38000 : d * 58.2;
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ DHT11 / DHT22

const dht: DevicePart = [
  {
    type: 'dht', name: 'Temperature & humidity sensor (DHT11 / DHT22)', category: 'sensors',
    description: 'Digital temperature + humidity sensor on one data wire (needs a 10 kΩ pull-up; modules include it). DHT11: 0–50 °C ±2 °C, 20–90 % RH, whole numbers. DHT22: −40–80 °C ±0.5 °C, 0.1 resolution. Read at most every 2 s with the DHT library.',
    keywords: ['dht11', 'dht22', 'am2302', 'humidity', 'temperature', 'weather', 'dht'],
    pins: pinRow(['VCC', 'DATA', 'NC', 'GND'], { labels: { VCC: '+3.3–5 V', DATA: 'Data', NC: 'not connected' } }),
    props: [
      { key: 'model', label: 'Sensor', type: 'select', default: 22, options: [{ value: 11, label: 'DHT11 (blue)' }, { value: 22, label: 'DHT22 / AM2302 (white)' }] },
      { key: 'temp', label: 'Temperature', type: 'slider', default: 24, min: -40, max: 80, step: 0.1, unit: '°C' },
      { key: 'hum', label: 'Humidity', type: 'slider', default: 55, min: 0, max: 100, step: 0.5, unit: '%' },
    ],
    drag: 'temp',
    shapes: [
      ...legs(pinRow(['VCC', 'DATA', 'NC', 'GND']), -8),
      rect(-7, -60, 44, 52, '#fbfaf6', { rx: 2.5, grad: '#d9d6cc', shadow: 1, stroke: '#bdb9ad', strokeWidth: 0.5 }),
      ...Array.from({ length: 15 }, (_, i) => rect(-2.5 + (i % 5) * 7.2, -55 + Math.floor(i / 5) * 9.5, 4.8, 7, '#a9a597', { rx: 0.8, grad: '#e0ddd2' })),
      rect(-4, -25, 38, 14, '#f1efe8', { rx: 1 }), text(15, -16, 'DHT', 4.4, '#8a867a', 'middle', { weight: 700 }),
      circle(15, -3.5, 0.1, 'none'),
    ],
    indicators: [{ shape: rect(-7, -60, 44, 52, '#2f6fd6', { rx: 2.5 }), color: '#2f6fd6', level: 'model == 11 ? 0.6 : 0' }],
    readouts: [{ value: 'temp', unit: '°C', x: 15, y: -64, size: 4.2 }],
    model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 5000 }, { id: 'PU', kind: 'resistor', a: 'VCC', b: 'DATA', value: 1e6 }, { id: 'NCR', kind: 'resistor', a: 'NC', b: 'GND', value: 1e9 }] },
  },
  {
    setup(b, comp) {
      b.registerDevice({
        kind: 'dht', key: 'data', pins: { data: 'DATA' }, powered: poweredFn(b, 2.9),
        api: {
          get model() { return Number(comp.props.model ?? 22); },
          get temperature() { return Math.max(Number(comp.props.model) === 11 ? 0 : -40, Math.min(Number(comp.props.model) === 11 ? 50 : 80, Number(comp.props.temp ?? 24))); },
          get humidity() { return Math.max(Number(comp.props.model) === 11 ? 20 : 0, Math.min(Number(comp.props.model) === 11 ? 90 : 100, Number(comp.props.hum ?? 55))); },
        },
      });
      return {};
    },
  },
];

// ------------------------------------------------------------------ BMP280

const bmp280: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SCL', 'SDA', 'CSB', 'SDO'], { h: 40, color: COL.pcbPurple, title: 'BMP280', titleY: -36, titleSize: 3.6, labels: { ...I2C_LABELS, CSB: 'CSB (HIGH for I2C)', SDO: 'SDO (address: GND 0x76, VCC 0x77)' } });
  return [
    {
      type: 'bmp280', name: 'Pressure sensor (BMP280)', category: 'sensors',
      description: 'Barometric pressure + temperature sensor on I2C (0x76 with SDO to GND, 0x77 with SDO high). ±1 hPa ≈ ±8 m of altitude. Use Adafruit_BMP280 (bmp.begin(0x76)).',
      keywords: ['bmp280', 'bme280', 'barometer', 'pressure', 'altitude', 'weather'],
      pins: b.pins,
      props: [
        { key: 'temp', label: 'Temperature', type: 'slider', default: 22, min: -40, max: 85, step: 0.1, unit: '°C' },
        { key: 'hpa', label: 'Pressure', type: 'slider', default: 1013.25, min: 300, max: 1100, step: 0.25, unit: 'hPa' },
      ],
      drag: 'hpa',
      shapes: [...b.shapes, rect(19, -29, 8, 7, '#eef1f4', { rx: 0.6, grad: '#8a929b', gradDir: 'd', shadow: 0.8 }), circle(21, -27, 0.7, '#2c2e32'), ...chip(0, -30, 7, 5, { legs: 'soic', n: 3 }), ...smdRow(-4, -21, 3, 5, false, 'rrc'), ...smdRow(32, -28, 2, 5, true, 'cc')],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e4 }, ...i2cLoads(['CSB', 'SDO'])] },
    },
    {
      setup(bld, comp) {
        const regs = new RegChip();
        regs.regs[0xd0] = 0x58;
        const c = BMP280_CALIB;
        [c.T1, c.T2, c.T3, c.P1, c.P2, c.P3, c.P4, c.P5, c.P6, c.P7, c.P8, c.P9].forEach((v, i) => putS16LE(regs.regs, 0x88 + i * 2, v > 32767 ? v - 65536 : v));
        const update = () => {
          const { adcT, adcP } = bmpRaw(Number(comp.props.temp ?? 22), Number(comp.props.hpa ?? 1013.25) * 100, c);
          regs.regs.set([adcP >> 12, (adcP >> 4) & 255, (adcP & 15) << 4, adcT >> 12, (adcT >> 4) & 255, (adcT & 15) << 4], 0xf7);
        };
        update();
        const addr = bld.levelAt('SDO') && bld.connected('SDO') ? 0x77 : 0x76;
        bld.registerI2C({ address: addr, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 1.7), device: { write: (x) => regs.write(x), read: (n) => (update(), regs.read(n)) } });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ MPU6050

const mpu6050: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'], { h: 50, color: COL.pcbBlue, title: 'GY-521', titleY: -44, titleX: 10, titleSize: 3.6, labels: { ...I2C_LABELS, AD0: 'AD0 (address: LOW 0x68, HIGH 0x69)', INT: 'Interrupt out', XDA: 'Aux I2C data', XCL: 'Aux I2C clock' } });
  return [
    {
      type: 'mpu6050', name: 'Accelerometer + gyroscope (MPU6050)', category: 'sensors',
      description: '6-axis IMU on I2C (0x68, or 0x69 with AD0 high): 3-axis accelerometer (±2–16 g) and gyroscope (±250–2000 °/s) plus a temperature sensor. Use Adafruit_MPU6050 or read registers 0x3B–0x48 with Wire. Set the motion while simulating.',
      keywords: ['mpu6050', 'gy-521', 'imu', 'accelerometer', 'gyroscope', 'gyro', 'tilt', 'balance'],
      pins: b.pins,
      props: [
        { key: 'ax', label: 'Accel X', type: 'slider', default: 0, min: -4, max: 4, step: 0.01, unit: 'g' },
        { key: 'ay', label: 'Accel Y', type: 'slider', default: 0, min: -4, max: 4, step: 0.01, unit: 'g' },
        { key: 'az', label: 'Accel Z', type: 'slider', default: 1, min: -4, max: 4, step: 0.01, unit: 'g' },
        { key: 'gx', label: 'Gyro X', type: 'slider', default: 0, min: -500, max: 500, step: 1, unit: '°/s' },
        { key: 'gy', label: 'Gyro Y', type: 'slider', default: 0, min: -500, max: 500, step: 1, unit: '°/s' },
        { key: 'gz', label: 'Gyro Z', type: 'slider', default: 0, min: -500, max: 500, step: 1, unit: '°/s' },
        { key: 'temp', label: 'Temperature', type: 'slider', default: 25, min: -40, max: 85, step: 0.5, unit: '°C' },
      ],
      shapes: [
        ...b.shapes,
        ...chip(28, -40, 14, 14, { legs: 'qfn', label: 'MPU', sub: '6050' }),
        ...chip(4, -38, 8, 5, { n: 3, label: '662K' }), ...smdRow(-2, -24, 5, 5, false, 'crcrc'), ...smdRow(50, -40, 3, 5, true, 'crc'),
        line(56, -24, 64, -24, COL.silk, 0.6), path('M 64 -25.5 L 67 -24 L 64 -22.5 Z', COL.silk), silk(66, -26.5, 'X', 2.4),
        line(56, -24, 56, -32, COL.silk, 0.6), path('M 54.5 -32 L 56 -35 L 57.5 -32 Z', COL.silk), silk(58.5, -33, 'Y', 2.4),
      ],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1200 }, ...i2cLoads(['XDA', 'XCL', 'AD0', 'INT'])] },
    },
    {
      setup(bld, comp) {
        const P = (k: string, d = 0) => Number(comp.props[k] ?? d);
        const regs = new RegChip((reg, v) => {
          if (reg === 0x6b && v & 0x80) {
            regs.regs.fill(0);
            regs.regs[0x6b] = 0x40;
            regs.regs[0x75] = 0x68;
          }
        });
        regs.regs[0x75] = 0x68;
        regs.regs[0x6b] = 0x40; // asleep after reset
        const update = () => {
          const r = regs.regs;
          const asleep = (r[0x6b] & 0x40) !== 0;
          const aS = 16384 / (1 << ((r[0x1c] >> 3) & 3)), gS = 131 / (1 << ((r[0x1b] >> 3) & 3));
          putS16BE(r, 0x3b, asleep ? 0 : P('ax') * aS);
          putS16BE(r, 0x3d, asleep ? 0 : P('ay') * aS);
          putS16BE(r, 0x3f, asleep ? 0 : P('az', 1) * aS);
          putS16BE(r, 0x41, asleep ? 0 : (P('temp', 25) - 36.53) * 340);
          putS16BE(r, 0x43, asleep ? 0 : P('gx') * gS);
          putS16BE(r, 0x45, asleep ? 0 : P('gy') * gS);
          putS16BE(r, 0x47, asleep ? 0 : P('gz') * gS);
        };
        const addr = bld.levelAt('AD0') && bld.connected('AD0') ? 0x69 : 0x68;
        bld.registerI2C({ address: addr, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.3), device: { write: (x) => regs.write(x), read: (n) => (update(), regs.read(n)) } });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ QMC5883L

const qmc5883: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SCL', 'SDA', 'DRDY'], { h: 40, color: COL.pcbBlue, title: 'GY-271', titleY: -36, titleSize: 3.6, labels: { ...I2C_LABELS, DRDY: 'Data ready' } });
  return [
    {
      type: 'qmc5883l', name: 'Magnetometer / compass (QMC5883L)', category: 'sensors',
      description: '3-axis magnetic field sensor (GY-271, QMC5883L at I2C 0x0D). Keep it level and it reads the heading. Use the QMC5883LCompass library. Turn the heading while simulating.',
      keywords: ['compass', 'magnetometer', 'qmc5883l', 'hmc5883l', 'gy-271', 'heading'],
      pins: b.pins,
      props: [{ key: 'heading', label: 'Heading', type: 'slider', default: 0, min: 0, max: 359, step: 1, unit: '°' }],
      drag: 'heading',
      shapes: [
        ...b.shapes, ...chip(14, -30, 9, 9, { legs: 'qfn' }), ...smdRow(-4, -22, 3, 5, false, 'crc'), ...chip(-4, -32, 7, 5, { n: 3 }),
        line(34, -20, 34, -32, COL.silk, 0.6), path('M 32.5 -32 L 34 -35 L 35.5 -32 Z', COL.silk), line(34, -20, 42, -20, COL.silk, 0.6), path('M 42 -21.5 L 45 -20 L 42 -18.5 Z', COL.silk),
        silk(36.5, -33, 'Y', 2.4), silk(44, -22.5, 'X', 2.4),
      ],
      animations: [{ shape: { type: 'path', d: 'M20 -31 L22 -24 L20 -17 L18 -24 Z', fill: '#d63c35' }, rotate: '-heading', cx: 20, cy: -24 }],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 1e4 }, ...i2cLoads(['DRDY'])] },
    },
    {
      setup(bld, comp) {
        const regs = new RegChip();
        regs.regs[0x0d] = 0xff;
        const update = () => {
          const h = (Number(comp.props.heading ?? 0) * Math.PI) / 180;
          const lsbPerG = (regs.regs[0x09] & 0x30) === 0x10 ? 3000 : 12000;
          putS16LE(regs.regs, 0, Math.cos(h) * 0.45 * lsbPerG);
          putS16LE(regs.regs, 2, Math.sin(h) * 0.45 * lsbPerG);
          putS16LE(regs.regs, 4, -0.25 * lsbPerG);
          regs.regs[6] = 1;
        };
        bld.registerI2C({ address: 0x0d, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.1), device: { write: (x) => regs.write(x), read: (n) => (update(), regs.read(n)) } });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ INA219

const ina219: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SCL', 'SDA'], { h: 72, w: 56, color: COL.pcbPurple, title: 'INA219', titleY: -24, titleSize: 3.4, holes: 'none', labels: I2C_LABELS });
  const t = pinRow(['VINP', 'VINN'], { x0: 10, y: -70, step: 10, kind: 'terminal', labels: { VINP: 'VIN+ (from supply)', VINN: 'VIN− (to load)' } });
  return [
    {
      type: 'ina219', name: 'Current & power sensor (INA219)', category: 'sensors',
      description: 'High-side current/voltage/power monitor on I2C (0x40): put its 0.1 Ω shunt in series with the load (VIN+ from the supply, VIN− to the load). Measures up to 26 V and ±3.2 A. Use Adafruit_INA219.',
      keywords: ['ina219', 'current sensor', 'power monitor', 'wattmeter', 'ina226', 'shunt'],
      pins: [...b.pins, ...t],
      shapes: [
        ...b.shapes, ...screwTerminals(t, '#2f7fd6', 'up'),
        ...chip(6, -54, 14, 6, { legs: 'none', label: 'R100' }), silk(1, -57.5, 'VIN+', 2.2), silk(20, -57.5, 'VIN-', 2.2),
        ...chip(6, -43, 10, 8, { n: 4, label: 'INA219' }), ...smdRow(-6, -33, 3, 5, false, 'crc'), ...smdRow(22, -33, 3, 5, false, 'rrc'),
      ],
      model: { elements: [{ id: 'RS', kind: 'resistor', a: 'VINP', b: 'VINN', value: 0.1 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 5000 }, { id: 'RB', kind: 'resistor', a: 'VINN', b: 'GND', value: 3.2e5 }, ...i2cLoads()] },
    },
    {
      setup(bld) {
        // 16-bit registers selected by a pointer: 0 config, 1 shunt, 2 bus, 3 power, 4 current, 5 calibration
        let ptr = 0, config = 0x399f, cal = 0;
        const reg = (r: number) => {
          const shunt = Math.max(-32000, Math.min(32000, Math.round((bld.volt('VINP') - bld.volt('VINN')) / 10e-6)));
          const busReg = Math.min(8191, Math.max(0, Math.round((bld.volt('VINN') - bld.volt('GND')) / 0.004)));
          const cur = Math.round((shunt * cal) / 4096);
          switch (r) {
            case 0: return config;
            case 1: return shunt & 0xffff;
            case 2: return ((busReg << 3) | 0x02) & 0xffff;
            case 3: return Math.round((Math.abs(cur) * busReg) / 5000) & 0xffff;
            case 4: return cur & 0xffff;
            case 5: return cal;
          }
          return 0;
        };
        bld.registerI2C({
          address: 0x40, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.9),
          device: {
            write: (x) => {
              if (!x.length) return;
              ptr = x[0] & 7;
              if (x.length >= 3) {
                const v = (x[1] << 8) | x[2];
                if (ptr === 0) config = v & 0x80 ? 0x399f : v;
                else if (ptr === 5) cal = v & 0xfffe;
              }
            },
            read: (n) => {
              const v = reg(ptr);
              return Array.from({ length: n }, (_, i) => (i % 2 ? v & 255 : (v >> 8) & 255));
            },
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ ADS1115

const ADS_FS = [6.144, 4.096, 2.048, 1.024, 0.512, 0.256, 0.256, 0.256];

const ads1115: DevicePart = (() => {
  const b = moduleBoard(['VDD', 'GND', 'SCL', 'SDA', 'ADDR', 'ALRT', 'A0', 'A1', 'A2', 'A3'], { h: 40, color: COL.pcbPurple, title: 'ADS1115', titleY: -36, titleX: 12, titleSize: 3.6, labels: { VDD: '+2–5.5 V', SCL: 'I2C clock', SDA: 'I2C data', ADDR: 'Address (GND 0x48, VDD 0x49)', ALRT: 'Alert / ready', A0: 'Input 0', A1: 'Input 1', A2: 'Input 2', A3: 'Input 3' } });
  return [
    {
      type: 'ads1115', name: 'ADC 16-bit, 4-channel (ADS1115)', category: 'logic',
      description: 'Precision 16-bit analog-to-digital converter on I2C (0x48): 4 single-ended or 2 differential inputs with a programmable gain (±6.144 V … ±0.256 V). Far finer than analogRead. Use Adafruit_ADS1115.',
      keywords: ['ads1115', 'adc', 'analog to digital', '16-bit', 'ads1015', 'precision'],
      pins: b.pins,
      shapes: [...b.shapes, ...chip(36, -31, 18, 8, { n: 5, label: 'ADS1115' }), ...smdRow(6, -24, 4, 6, false, 'rrrc'), ...smdRow(66, -30, 3, 5, false, 'rrc')],
      model: { elements: [{ id: 'IQ', kind: 'resistor', a: 'VDD', b: 'GND', value: 2e4 }, ...['A0', 'A1', 'A2', 'A3', 'ADDR', 'ALRT', 'SDA', 'SCL'].map((p) => ({ id: `R${p}`, kind: 'resistor', a: p, b: 'GND', value: 1e7 }))] },
    },
    {
      setup(bld) {
        let ptr = 0, config = 0x8583, conv = 0;
        const convert = () => {
          const mux = (config >> 12) & 7, fs = ADS_FS[(config >> 9) & 7];
          const v = (p: string) => bld.volt(p) - bld.volt('GND');
          const pairs: [string, string | null][] = [['A0', 'A1'], ['A0', 'A3'], ['A1', 'A3'], ['A2', 'A3'], ['A0', null], ['A1', null], ['A2', null], ['A3', null]];
          const [p, n] = pairs[mux];
          const x = v(p) - (n ? v(n) : 0);
          conv = Math.max(-32768, Math.min(32767, Math.round((x / fs) * 32768)));
        };
        const addr = bld.levelAt('ADDR') && bld.connected('ADDR') ? 0x49 : 0x48;
        bld.registerI2C({
          address: addr, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 1.9, 'VDD'),
          device: {
            write: (x) => {
              if (!x.length) return;
              ptr = x[0] & 3;
              if (ptr === 1 && x.length >= 3) {
                config = (x[1] << 8) | x[2];
                convert();
              }
            },
            read: (n) => {
              const v = ptr === 0 ? conv & 0xffff : ptr === 1 ? config & 0x7fff | 0x8000 : 0;
              return Array.from({ length: n }, (_, i) => (i % 2 ? v & 255 : (v >> 8) & 255));
            },
          },
        });
        return {};
      },
    },
  ];
})();

// ------------------------------------------------------------------ MCP4725

const mcp4725: DevicePart = (() => {
  const b = moduleBoard(['VCC', 'GND', 'SCL', 'SDA', 'A0', 'OUT'], { h: 38, color: COL.pcbPurple, title: 'MCP4725', titleY: -34, titleX: 6, titleSize: 3.4, labels: { ...I2C_LABELS, A0: 'A0 (address bit)', OUT: 'Analog output (0 … VCC)' } });
  return [
    {
      type: 'mcp4725', name: 'DAC 12-bit (MCP4725)', category: 'logic',
      description: 'Digital-to-analog converter on I2C (0x60, or 0x61 with A0 high; some modules are 0x62): a true analog voltage OUT = value / 4096 × VCC. Use Adafruit_MCP4725 setVoltage().',
      keywords: ['mcp4725', 'dac', 'digital to analog', 'analog output', '12-bit'],
      pins: b.pins,
      props: [{ key: 'base', label: 'Address', type: 'select', default: 0x60, options: [{ value: 0x60, label: '0x60 (MCP4725A0)' }, { value: 0x62, label: '0x62 (MCP4725A1)' }] }],
      shapes: [...b.shapes, ...chip(20, -30, 9, 5, { n: 3, label: '4725' }), ...smdRow(0, -22, 3, 5, false, 'crr'), ...smdRow(34, -24, 2, 5, false, 'cc')],
      readouts: [{ value: 'code', label: '', x: 25, y: -15.5, size: 3.4, color: '#ddd' }],
      model: { elements: [{ id: 'O', kind: 'vsource', p: 'OUT', n: 'GND', value: 'v(VCC, GND) > 2.6 ? code / 4096 * v(VCC, GND) : 0', r: 1 }, { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 2e4 }, ...i2cLoads(['A0'])] },
    },
    {
      vars: ['code'],
      setup(bld, comp) {
        const st = (bld.state.dac ??= { code: 0, eeprom: 0 }) as { code: number; eeprom: number };
        const a0 = bld.levelAt('A0') && bld.connected('A0') ? 1 : 0;
        bld.registerI2C({
          address: Number(comp.props.base ?? 0x60) + a0, sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.6),
          device: {
            write: (x) => {
              if (x.length >= 3 && (x[0] & 0xe0) === 0x40) {
                st.code = ((x[1] << 4) | (x[2] >> 4)) & 0xfff;
                if (x[0] & 0x20) st.eeprom = st.code;
              } else for (let i = 0; i + 1 < x.length; i += 2) if ((x[i] & 0xc0) === 0) st.code = ((x[i] & 0x0f) << 8) | x[i + 1];
            },
            read: (n) => [0xc0, st.code >> 4, (st.code & 15) << 4, st.eeprom >> 8, st.eeprom & 255].slice(0, n),
          },
        });
        return { values: () => ({ code: st.code }) };
      },
    },
  ];
})();

// ------------------------------------------------------------------ PCF8574

const pcf8574: DevicePart = (() => {
  const ports = pinRow(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'], { x0: 0, y: -60 });
  const b = moduleBoard(['VCC', 'GND', 'SDA', 'SCL', 'INT'], { h: 62, w: 86, boardX: -8, color: COL.pcbBlue, title: 'PCF8574', titleY: -20, titleX: 30, titleSize: 3.4, labels: { ...I2C_LABELS, INT: 'Interrupt (LOW on input change)' } });
  return [
    {
      type: 'pcf8574', name: 'I2C GPIO expander (PCF8574)', category: 'logic',
      description: '8 extra I/O pins over I2C (0x20–0x27 via A0–A2). Quasi-bidirectional: writing 1 releases a pin (weak pull-up — also how you make it an input), writing 0 pulls it LOW (sinks 25 mA: wire LEDs from + to the pin). Read the pin levels back over I2C.',
      keywords: ['pcf8574', 'io expander', 'gpio expander', 'i2c expander', 'port expander', 'mcp23017'],
      pins: [...b.pins, ...ports.map((p) => ({ ...p, label: `${p.id} (I/O)` }))],
      props: [{ key: 'addr', label: 'Address (A2 A1 A0)', type: 'select', default: 0x20, options: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ value: 0x20 + i, label: `0x${(0x20 + i).toString(16)}` })) }],
      shapes: [...b.shapes, ...header(ports), ...pinLabels(ports, -50), ...chip(14, -42, 34, 12, { n: 8, label: 'PCF8574' }), ...[0, 1, 2].map((i) => jumper(56 + i * 8, -34, true)).flat(), silk(64, -44, 'A0 A1 A2', 2.4), ...smdRow(-6, -24, 3, 5, false, 'rrc')],
      model: {
        elements: [
          ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [
            { id: `PU${i}`, kind: 'rvar', a: 'VCC', b: `P${i}`, value: `bit(out, ${i}) == 1 ? 50000 : 1e9` },
            { id: `PD${i}`, kind: 'rvar', a: `P${i}`, b: 'GND', value: `bit(out, ${i}) == 0 ? 25 : 1e9` },
          ]),
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 5e4 },
          { id: 'PI', kind: 'resistor', a: 'VCC', b: 'INT', value: 1e5 },
          ...i2cLoads(),
        ],
      },
    },
    {
      vars: ['out'],
      setup(bld, comp) {
        const st = (bld.state.pcf ??= { out: 0xff }) as { out: number };
        bld.registerI2C({
          address: Number(comp.props.addr ?? 0x20), sda: 'SDA', scl: 'SCL', powered: poweredFn(bld, 2.4),
          device: {
            write: (x) => {
              if (x.length) st.out = x[x.length - 1] & 255;
            },
            read: (n) => {
              const vcc = bld.volt('VCC') - bld.volt('GND');
              let v = 0;
              for (let i = 0; i < 8; i++) if (bld.volt(`P${i}`) - bld.volt('GND') > vcc * 0.5) v |= 1 << i;
              return new Array(n).fill(v);
            },
          },
        });
        return { values: () => ({ out: st.out }) };
      },
    },
  ];
})();

// ------------------------------------------------------------------ PCA9685 16-channel PWM / servo driver

const pca9685: DevicePart = (() => {
  const head = pinRow(['GND', 'OE', 'SCL', 'SDA', 'VCC', 'VPLUS'], { labels: { OE: 'Output enable (LOW = on)', VCC: 'Logic 3.3–5 V', VPLUS: 'V+ servo power (5–6 V)' } });
  const ch = Array.from({ length: 16 }, (_, i) => ({ id: `PWM${i}`, x: 80 + (i % 8) * 10, y: -70 - Math.floor(i / 8) * 10, label: `Channel ${i} signal`, kind: 'lead' as const }));
  const led = statusLed(56, -38, '#ff3b30', 'v(VCC, GND) > 2.5 ? 1 : 0');
  return [
    {
      type: 'pca9685', name: 'PCA9685 16-channel PWM / servo driver', category: 'drivers',
      description: '16 independent 12-bit PWM outputs over I2C (0x40) — drive 16 servos (setPWMFreq(50)) or dim LEDs without using the board\'s pins. Power the servos from V+, not the board. Use Adafruit_PWMServoDriver.',
      keywords: ['pca9685', 'servo driver', 'pwm driver', '16 channel', 'adafruit_pwmservodriver', 'servo shield'],
      pins: [...head, ...ch],
      shapes: [
        ...pcb(-10, -104, 170, 110, '#1d5bb8', { holes: 'corners' }),
        rect(74, -86, 82, 22, '#2a2b2f', { rx: 1, grad: '#111214', shadow: 1 }),
        ...ch.map((c) => rect(c.x - 1.5, c.y - 1.5, 3, 3, '#e3c25e', { grad: '#9c7b26', gradDir: 'd' })),
        silk(115, -58, 'PWM 0-7 (lower) · 8-15 (upper)', 2.6),
        ...screwTerminals(pinRow(['VP', 'VN'], { x0: 20, y: -86 }), '#2f7fd6', 'up'), silk(20, -76, 'V+', 2.6), silk(30, -76, 'GND', 2.6),
        ...ecap(52, -80, 7),
        ...chip(12, -58, 30, 10, { n: 14, label: 'PCA9685' }),
        ...smdRow(0, -38, 6, 6, false, 'rrcrrc'), ...smdRow(76, -44, 8, 9, false, 'rrrrrrrr'),
        ...header(head), ...pinLabels(head, -9.8),
        silk(40, -26, '16-CH 12-BIT PWM', 3.2),
        led.shape,
      ],
      indicators: [led.indicator],
      model: {
        elements: [
          ...ch.map((c, i) => ({ id: `O${i}`, kind: 'vsource', p: c.id, n: 'GND', value: `v(VCC, GND) > 2.3 && v(OE, GND) < 1 ? duty${i} * v(VCC, GND) : 0`, r: 220 })),
          { id: 'IQ', kind: 'resistor', a: 'VCC', b: 'GND', value: 2e3 },
          { id: 'POE', kind: 'resistor', a: 'OE', b: 'GND', value: 1e5 },
          { id: 'RV', kind: 'resistor', a: 'VPLUS', b: 'GND', value: 1e6 },
          ...i2cLoads(),
        ],
      },
    },
    {
      vars: Array.from({ length: 16 }, (_, i) => `duty${i}`),
      setup(bld) {
        const regs = new RegChip((reg, v) => {
          if (reg === 0x00 && v & 0x80) regs.regs[0x00] = v & 0x7f; // restart
        });
        regs.regs[0x00] = 0x11;
        regs.regs[0xfe] = 30;
        const powered = poweredFn(bld, 2.3);
        const freq = () => 25e6 / (4096 * (regs.regs[0xfe] + 1));
        const chan = (i: number) => {
          const r = regs.regs, a = 0x06 + 4 * i;
          const on = r[a] | ((r[a + 1] & 0x0f) << 8), off = r[a + 2] | ((r[a + 3] & 0x0f) << 8);
          if (r[0x00] & 0x10) return { duty: 0, width: 0 };
          if (r[a + 1] & 0x10) return { duty: 1, width: 4096 };
          if (r[a + 3] & 0x10) return { duty: 0, width: 0 };
          const w = (off - on + 4096) % 4096;
          return { duty: w / 4096, width: w };
        };
        bld.registerI2C({ address: 0x40, sda: 'SDA', scl: 'SCL', powered, device: { write: (x) => regs.write(x), read: (n) => regs.read(n) } });
        bld.registerDevice({
          kind: 'pwm-source', pins: Object.fromEntries(ch.map((c, i) => [`ch${i}`, c.id])), powered,
          api: {
            signalOn(role: string) {
              const i = Number(role.slice(2));
              const c = chan(i);
              if (c.duty <= 0 || c.duty >= 1) return null;
              const f = freq();
              return { freq: f, servoUs: f > 30 && f < 70 ? (c.duty * 1e6) / f : null, vcc: bld.volt('VCC') - bld.volt('GND') };
            },
          },
        });
        return { values: () => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`duty${i}`, chan(i).duty])) };
      },
    },
  ];
})();

export const SENSOR_DEVICES: DevicePart[] = [hcsr04, dht, bmp280, mpu6050, qmc5883, ina219, ads1115, mcp4725, pcf8574, pca9685];
