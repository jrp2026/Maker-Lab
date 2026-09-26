/**
 * The full component roadmap, grouped as in the product brief. Entries with a `type`
 * are implemented and placeable; the rest are listed (searchable) with their planned phase.
 */
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

const P = (phase: 2 | 3, ...names: string[]): CatalogEntry[] => names.map((name) => ({ name, phase }));

export const CATALOG: CatalogCategory[] = [
  {
    id: 'basic', name: 'Starters', icon: '★',
    entries: [
      { name: 'Breadboard (half)', type: 'breadboard' },
      { name: 'Arduino Uno R3', type: 'arduino-uno' },
      { name: 'Resistor', type: 'resistor' },
      { name: 'LED', type: 'led' },
      { name: 'Push button', type: 'pushbutton' },
      { name: 'Battery', type: 'battery' },
      { name: 'Multimeter', type: 'multimeter' },
    ],
  },
  {
    id: 'surfaces', name: 'Prototyping surfaces', icon: '▦',
    entries: [
      { name: 'Breadboard (half)', type: 'breadboard' },
      { name: 'Breadboard (full)', type: 'breadboard-full' },
      ...P(3, 'Perfboard', 'Prototype PCB', 'IC socket'),
    ],
  },
  {
    id: 'passive', name: 'Passive components', icon: 'Ω',
    entries: [
      { name: 'Resistor', type: 'resistor' },
      { name: 'Potentiometer', type: 'potentiometer' },
      { name: 'Photoresistor (LDR)', type: 'photoresistor' },
      { name: 'Ceramic capacitor', type: 'capacitor' },
      { name: 'Electrolytic capacitor', type: 'electrolytic' },
      ...P(2, 'Trimmer potentiometer', 'Variable resistor', 'Thermistor', 'Supercapacitor', 'Inductor', 'Ferrite bead', 'Transformer', 'Crystal oscillator', 'Ceramic resonator'),
      ...P(3, 'Digital potentiometer'),
    ],
  },
  {
    id: 'diodes', name: 'Diodes & optoelectronics', icon: '▷|',
    entries: [
      { name: 'LED', type: 'led' },
      { name: 'RGB LED', type: 'rgb-led' },
      { name: 'Diode', type: 'diode' },
      ...P(2, 'Zener diode', 'Schottky diode', 'Schottky power diode', 'TVS protection diode', 'Infrared LED', 'Photodiode', 'Laser diode', 'NeoPixel / WS2812 LED strip'),
    ],
  },
  {
    id: 'transistors', name: 'Transistors & switching', icon: '⊳',
    entries: [
      { name: 'NPN transistor', type: 'npn' },
      { name: 'PNP transistor', type: 'pnp' },
      ...P(2, 'MOSFET', 'Logic-level MOSFET module', 'Darlington transistor', 'Optocoupler'),
      ...P(3, 'JFET', 'IGBT', 'TRIAC', 'SCR (thyristor)'),
    ],
  },
  {
    id: 'switches', name: 'Switches & inputs', icon: '⏻',
    entries: [
      { name: 'Push button', type: 'pushbutton' },
      { name: 'Slide switch', type: 'slide-switch' },
      ...P(2, 'Toggle switch', 'DIP switch', 'Keypad matrix', 'Joystick module', 'Rotary switch'),
    ],
  },
  {
    id: 'power', name: 'Power & connectors', icon: '⚡',
    entries: [
      { name: 'Battery', type: 'battery' },
      ...P(2, 'Battery holder', 'Battery connector', 'LiPo battery', '18650 battery', 'DC barrel jack', 'USB connector', 'Voltage regulator IC', 'Bridge rectifier', 'Buck converter', 'Boost converter'),
      ...P(3, 'Terminal block', 'Pin header', 'Buck-boost converter', 'USB-C power module', 'Li-ion battery protection board', 'Battery management system (BMS)', 'Li-ion charging module', 'Solar charging controller', 'Power distribution board', 'Fuse holder', 'Resettable fuse (polyfuse)'),
    ],
  },
  {
    id: 'output', name: 'Motors, audio & actuators', icon: '⟳',
    entries: [
      { name: 'DC motor', type: 'dc-motor' },
      { name: 'Piezo buzzer', type: 'piezo' },
      { name: 'Servo motor (standard / continuous / high-torque)', type: 'servo' },
      ...P(2, 'Stepper motor (NEMA 17/23)', 'Speaker', 'Gear motor', 'N20 gear motor', 'Solenoid', 'Electret microphone'),
      ...P(3, 'Brushless DC (BLDC) motor', 'Coreless motor', 'Planetary gear motor', 'Linear actuator'),
    ],
  },
  {
    id: 'drivers', name: 'Motor & driver modules', icon: '⇉',
    entries: [
      ...P(2, 'L298N', 'L293D', 'Servo driver board'),
      ...P(3, 'TB6612FNG', 'DRV8833', 'DRV8825', 'A4988', 'TMC2208', 'TMC2209', 'BTS7960', 'VNH2SP30', 'ESC (electronic speed controller)', 'BLDC motor controller', 'PCA9685 PWM driver', 'H-bridge module', 'Dual H-bridge module', 'MOSFET motor switch module', 'Solenoid driver module'),
    ],
  },
  {
    id: 'relays', name: 'Relays', icon: '⎍',
    entries: P(2, 'Relay', 'Solid-state relay', 'Relay driver module'),
  },
  {
    id: 'instruments', name: 'Instruments', icon: '◔',
    entries: [
      { name: 'Multimeter', type: 'multimeter' },
      { name: 'Oscilloscope', type: 'oscilloscope' },
    ],
  },
  {
    id: 'mcu', name: 'Microcontrollers & boards', icon: '⌗',
    entries: [
      { name: 'Arduino Uno R3', type: 'arduino-uno' },
      { name: 'ESP32 DevKit V1', type: 'esp32-devkit' },
      ...P(2, 'Arduino Nano'),
      ...P(3, 'Arduino Mega', 'Arduino Micro', 'ESP8266', 'Raspberry Pi Pico', 'Raspberry Pi Pico W', 'STM32 development board', 'Teensy', 'ATtiny', 'ATmega328P', 'ATmega2560', 'RP2040', 'PIC microcontroller', 'AVR microcontroller', 'ARM Cortex-M microcontroller', 'Generic microcontroller', 'Microcontroller programmer/debugger'),
    ],
  },
  {
    id: 'ics', name: 'Analog & timer ICs', icon: '▭',
    entries: P(2, '555 timer IC', 'Operational amplifier (op-amp)', 'Comparator IC'),
  },
  {
    id: 'logic', name: 'Digital logic & conversion ICs', icon: '&',
    entries: P(3, 'Logic gate IC', 'Shift register IC', 'Counter IC', 'Multiplexer IC', 'Demultiplexer IC', 'ADC IC', 'DAC IC', 'I2C GPIO expander', 'Digital isolator'),
  },
  {
    id: 'memory', name: 'Memory & timekeeping', icon: '▤',
    entries: P(3, 'EEPROM', 'Flash memory IC', 'Real-time clock (RTC) IC', 'RTC module', 'MicroSD card module', 'SD card reader'),
  },
  {
    id: 'sensors', name: 'Sensors', icon: '◉',
    entries: P(2, 'Temperature sensor', 'Humidity sensor', 'Pressure sensor', 'Light sensor', 'Proximity sensor', 'Ultrasonic sensor', 'PIR motion sensor', 'Hall-effect sensor', 'Accelerometer', 'Gyroscope', 'Magnetometer', 'Gas sensor', 'Sound sensor', 'Vibration sensor', 'Tilt switch', 'Reed switch', 'Current sensor module (INA219, INA226, ACS712)', 'Voltage sensor module', 'Rotary encoder', 'Quadrature encoder', 'Wheel/motor encoder'),
  },
  {
    id: 'displays', name: 'Displays', icon: '▣',
    entries: [
      { name: 'LCD display 16×2 / 20×4 (parallel)', type: 'lcd' },
      { name: 'LCD display with I2C backpack', type: 'lcd-i2c' },
      ...P(2, 'Seven-segment display', 'OLED display'),
      ...P(3, 'Matrix LED display', 'Touchscreen module'),
    ],
  },
  {
    id: 'wireless', name: 'Communication & wireless', icon: '((·))',
    entries: P(3, 'Wi-Fi module', 'Bluetooth module', 'GPS module', 'NRF24L01', 'GSM/LTE module', 'RFID reader module', 'NFC module', 'CAN bus transceiver', 'RS-485 transceiver', 'SPI interface module', 'UART interface module', 'USB-to-serial converter', 'USB-to-TTL adapter', 'Logic-level converter', 'RF antenna'),
  },
];
