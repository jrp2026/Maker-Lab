/**
 * The component library, grouped as in the product brief. Every entry is a placeable part;
 * the same part can appear in more than one category (e.g. the MPU6050 is both an
 * accelerometer and a gyroscope).
 */
import { getDef } from './registry';

export interface CatalogEntry {
  name: string;
  type?: string;
  phase?: 2 | 3;
}

export interface CatalogCategory {
  id: string;
  name: string;
  icon: string;
  entries: CatalogEntry[];
}

/** entry for a part type, named after the part unless a name is given */
const T = (type: string, name?: string): CatalogEntry => ({ type, name: name ?? getDef(type)?.name ?? type });
const all = (...types: string[]) => types.map((t) => T(t));

export const CATALOG: CatalogCategory[] = [
  {
    id: 'basic', name: 'Starters', icon: '★',
    entries: all('breadboard', 'arduino-uno', 'resistor', 'led', 'pushbutton', 'battery', 'multimeter'),
  },
  {
    id: 'surfaces', name: 'Prototyping surfaces', icon: '▦',
    entries: all('breadboard', 'breadboard-full', 'perfboard', 'stripboard', 'ic-socket'),
  },
  {
    id: 'passive', name: 'Passive components', icon: 'Ω',
    entries: [
      ...all('resistor', 'potentiometer', 'trimmer', 'rheostat', 'photoresistor', 'thermistor', 'capacitor', 'electrolytic', 'supercap', 'inductor', 'ferrite', 'transformer', 'crystal', 'resonator', 'digipot', 'varistor', 'power-resistor', 'slide-pot', 'dual-pot'),
    ],
  },
  {
    id: 'diodes', name: 'Diodes & optoelectronics', icon: '▷|',
    entries: all('led', 'rgb-led', 'diode', 'zener', 'schottky', 'schottky-power', 'tvs', 'ir-led', 'photodiode', 'phototransistor', 'bicolor-led', 'rgb-led-module', 'led-bargraph', 'led-10mm', 'flashing-led', 'led-strip-12v', 'germanium-diode', 'laser', 'neopixel-stick', 'neopixel-ring', 'neopixel-strip'),
  },
  {
    id: 'transistors', name: 'Transistors & switching', icon: '⊳',
    entries: all('npn', 'pnp', 'nmos', 'pmos', '2n7000', 'mosfet-module', 'darlington', 'optocoupler', 'jfet', 'igbt', 'triac', 'scr'),
  },
  {
    id: 'switches', name: 'Switches & inputs', icon: '⏻',
    entries: all('pushbutton', 'slide-switch', 'toggle-switch', 'dip-switch', 'keypad', 'joystick', 'rotary-switch', 'rotary-encoder', 'limit-switch', 'touch-sensor', 'rocker-switch', 'slide-pot', 'keypad-1x4', 'arcade-button', 'key-switch', 'slide-switch-3', 'door-sensor', 'e-stop', 'touch-4key'),
  },
  {
    id: 'power', name: 'Power & connectors', icon: '⚡',
    entries: all(
      'battery', 'battery-holder', 'battery-snap', 'lipo', 'battery-18650', 'barrel-jack', 'usb-breakout', 'usbc-power', 'ac-source',
      'coin-cell', 'lifepo4', 'power-bank', 'lab-psu', 'reg-78xx', 'reg-79xx', 'lm317', 'ams1117', 'reg-3v3-module', 'ht7333', 'tl431', 'b0505s', 'icl7660', 'bridge-rectifier', 'buck-converter', 'boost-converter', 'buck-boost',
      'liion-protect', 'bms-3s', 'tp4056', 'solar-panel', 'solar-controller', 'power-distribution', 'fuse', 'polyfuse', 'terminal-block', 'pin-header',
    ),
  },
  {
    id: 'output', name: 'Motors, audio & actuators', icon: '⟳',
    entries: all('dc-motor', 'gear-motor', 'n20-motor', 'planetary-motor', 'coreless-motor', 'bldc-motor', 'servo', 'stepper-nema17', 'stepper-28byj48', 'linear-actuator', 'solenoid', 'electromagnet', 'vibration-motor', 'dc-fan', 'water-pump', 'piezo', 'active-buzzer', 'speaker', 'mic-module', 'lm386', 'light-bulb', 'traffic-light', 'neon-lamp', 'panel-led', 'siren', 'peltier', 'heater-pad', 'solenoid-valve'),
  },
  {
    id: 'drivers', name: 'Motor & driver modules', icon: '⇉',
    entries: all(
      'l298n', 'l293d', 'tb6612fng', 'drv8833', 'hbridge', 'dual-hbridge', 'bts7960', 'vnh2sp30', 'mosfet-switch', 'solenoid-driver',
      'a4988', 'drv8825', 'tmc2208', 'tmc2209', 'uln2003', 'uln2803', 'esc', 'bldc-controller', 'pca9685',
    ),
  },
  {
    id: 'relays', name: 'Relays', icon: '⎍',
    entries: all('relay', 'ssr', 'relay-module'),
  },
  {
    id: 'instruments', name: 'Instruments', icon: '◔',
    entries: all('multimeter', 'oscilloscope', 'panel-voltmeter', 'analog-voltmeter', 'analog-ammeter', 'spi-monitor', 'usb-ttl'),
  },
  {
    id: 'mcu', name: 'Microcontrollers & boards', icon: '⌗',
    entries: [
      ...all('arduino-uno', 'arduino-nano', 'arduino-mega', 'arduino-micro', 'esp32-devkit', 'esp8266-nodemcu', 'pico', 'pico-w', 'stm32-bluepill', 'teensy40'),
      T('attiny85'), T('atmega328p'), T('arduino-mega', 'ATmega2560 (Arduino Mega)'), T('pico', 'RP2040 (Raspberry Pi Pico)'), T('pic16f877a', 'PIC microcontroller (PIC16F877A)'),
      T('atmega328p', 'AVR microcontroller (ATmega328P)'), T('stm32-bluepill', 'ARM Cortex-M microcontroller (STM32F103)'), T('generic-mcu'), T('isp-programmer'),
    ],
  },
  {
    id: 'ics', name: 'Analog & timer ICs', icon: '▭',
    entries: all('ne555', 'lm358', 'lm324', 'ua741', 'tl072', 'lm386', 'lm393', 'lm339', 'lm311', 'mcp6002', 'tl431', 'cd4066', 'icl7660', 'uln2803'),
  },
  {
    id: 'logic', name: 'Digital logic & conversion ICs', icon: '&',
    entries: all('74hc00', '74hc08', '74hc32', '74hc86', '74hc02', '74hc04', '74hc10', '74hc11', '74hc14', '74hc20', '74hc27', '74hc74', '74hc125', '74hc157', '74hc245', '74hc283', '74hc393', 'cd4511', 'cd4011', 'cd4066', '74hc595', 'cd4017', '74hc4051', '74hc138', 'ads1115', 'mcp4725', 'pcf8574', 'adum1201'),
  },
  {
    id: 'memory', name: 'Memory & timekeeping', icon: '▤',
    entries: all('24lc256', 'w25q32', 'ds1307', 'ds3231', 'microsd-module', 'sd-module'),
  },
  {
    id: 'sensors', name: 'Sensors', icon: '◉',
    entries: [
      T('tmp36'), T('dht', 'Temperature & humidity (DHT11 / DHT22)'), T('bmp280'), T('ldr-module'), T('ir-obstacle'), T('hc-sr04'), T('pir'), T('hall-a3144'),
      T('mpu6050', 'Accelerometer & gyroscope (MPU6050)'), T('adxl335'), T('qmc5883l'), T('mq2'), T('sound-sensor'), T('vibration-sensor'), T('tilt-switch'), T('reed-switch'),
      T('ina219'), T('acs712'), T('voltage-sensor'), T('rotary-encoder'), T('quadrature-encoder'), T('speed-sensor'), T('touch-panel'),
      T('hall-49e'), T('hall-module'), T('phototransistor'), T('fsr'), T('flex-sensor'), T('soil-moisture'), T('rain-sensor'), T('water-level'), T('water-flow'), T('flame-sensor'),
      T('line-tracker'), T('mq135'), T('mq3'), T('pulse-sensor'), T('uv-sensor'), T('ntc-module'), T('knock-sensor'), T('touch-sensor'),
      T('temt6000'), T('rcwl-0516'), T('sharp-ir'), T('capacitive-soil'), T('load-cell'), T('sct013'), T('mq7'), T('mq4'), T('anemometer'), T('laser-receiver'), T('photo-interrupter'), T('mpx5010'), T('touch-4key'),
    ],
  },
  {
    id: 'displays', name: 'Displays', icon: '▣',
    entries: all('lcd', 'lcd-i2c', 'oled-128x64', 'oled-128x32', 'seven-seg-cc', 'seven-seg-ca', 'seven-seg-4digit', 'led-bargraph', 'led-matrix', 'max7219-matrix', 'touch-panel'),
  },
  {
    id: 'wireless', name: 'Communication & wireless', icon: '((·))',
    entries: [
      T('esp01', 'Wi-Fi module (ESP-01)'), T('hc05', 'Bluetooth module (HC-05)'), T('gps-neo6m'), T('nrf24l01'), T('sim800l', 'GSM/LTE module (SIM800L)'), T('rc522'), T('pn532'),
      T('mcp2515', 'CAN bus transceiver (MCP2515)'), T('max485'), T('spi-monitor', 'SPI interface module (monitor)'), T('usb-ttl', 'UART interface module (USB-TTL)'), T('usb-serial'),
      T('logic-level-converter'), T('rf-antenna'),
    ],
  },
];
