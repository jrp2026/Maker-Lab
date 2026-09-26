/** Examples for the library-driven devices, boards and ICs added from the roadmap. */
import type { CircuitDoc, ComponentInstance, Point, PropValue, Rotation, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';

let n = 0;
const uid = (p: string) => `${p}${++n}`;

/** Place a part so that `pin` lands on `at`. */
function place(type: string, pin: string, at: Point, props: Record<string, PropValue> = {}, rot: Rotation = 0, id?: string): ComponentInstance {
  const def = getDef(type)!;
  const comp: ComponentInstance = { id: id ?? uid(type.replace(/[^a-z0-9]/g, '').slice(0, 4)), type, x: 0, y: 0, rot, flip: false, props: { ...def.defaultProps, ...props } };
  const p = def.pins(comp.props).find((x) => x.id === pin)!;
  const w = localToWorld(comp, def, p);
  comp.x = at.x - w.x;
  comp.y = at.y - w.y;
  return comp;
}

function pinAt(c: ComponentInstance, pin: string): Point {
  const def = getDef(c.type)!;
  return localToWorld(c, def, def.pins(c.props).find((p) => p.id === pin)!);
}

const RED = '#e53935', BLACK = '#212121', GREEN = '#43a047', BLUE = '#1e88e5', ORANGE = '#fb8c00', YELLOW = '#fdd835', PURPLE = '#8e24aa', WHITE = '#eceff1';

/** Wire routed through a horizontal lane at `laneY` (or straight when laneY is omitted). */
function link(a: ComponentInstance, ap: string, b: ComponentInstance, bp: string, color: string, laneY?: number): Wire {
  const pa = pinAt(a, ap), pb = pinAt(b, bp);
  const points = laneY === undefined ? [] : [{ x: pa.x, y: laneY }, { x: pb.x, y: laneY }];
  return { id: uid('w'), a: { comp: a.id, pin: ap }, b: { comp: b.id, pin: bp }, points, color };
}

const board = (type: string, code: string, x = 0, y = 0, id = 'uno'): ComponentInstance => ({ id, type, x, y, rot: 0, flip: false, props: { ...getDef(type)!.defaultProps, code } });
const doc = (name: string, components: ComponentInstance[], wires: Wire[]): CircuitDoc => ({ version: 1, name, components, wires });

// ---------------------------------------------------------------- sketches

const OLED = `// SSD1306 OLED on I2C (SDA = A4, SCL = A5) with Adafruit_GFX drawing.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);
int n = 0;

void setup() {
  Serial.begin(9600);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 not found");
    while (true) {}
  }
}

void loop() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Hello!");
  display.setTextSize(1);
  display.print("Count: ");
  display.println(n++);
  display.drawRect(0, 40, 128, 20, SSD1306_WHITE);
  display.fillRect(2, 42, (n * 4) % 124, 16, SSD1306_WHITE);
  display.fillCircle(110, 12, 4 + n % 5, SSD1306_WHITE);
  display.display();
  delay(150);
}
`;

const RAINBOW = `// NeoPixel ring rainbow (Adafruit_NeoPixel), data on pin 6.
#include <Adafruit_NeoPixel.h>
#define PIN 6
#define NUM 16

Adafruit_NeoPixel ring(NUM, PIN, NEO_GRB + NEO_KHZ800);
long hue = 0;

void setup() {
  ring.begin();
  ring.setBrightness(40); // keep the current low when powered from the board
}

void loop() {
  for (int i = 0; i < NUM; i++) {
    ring.setPixelColor(i, ring.gamma32(ring.ColorHSV(hue + i * 65536L / NUM)));
  }
  ring.show();
  hue += 1024;
  delay(20);
}
`;

const WEATHER = `// Weather station: DHT22 on pin 2, readings on an I2C LCD (0x27).
// Change the temperature / humidity of the sensor while simulating.
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(2, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  dht.begin();
  lcd.init();
  lcd.backlight();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(t, 1);
  lcd.print((char)223);
  lcd.print("C  ");
  lcd.setCursor(0, 1);
  lcd.print("Hum:  ");
  lcd.print(h, 1);
  lcd.print(" %  ");
  delay(2000);
}
`;

const PARKING = `// Parking sensor: HC-SR04 measures the distance; the buzzer beeps faster as you get closer.
// Drag the sensor's distance slider while simulating.
const int TRIG = 9, ECHO = 10, BUZZ = 8;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long cm = pulseIn(ECHO, HIGH, 30000) / 58;
  Serial.print(cm);
  Serial.println(" cm");
  if (cm > 0 && cm < 60) {
    tone(BUZZ, 2000, 40);
    delay(cm * 8);
  } else {
    delay(200);
  }
}
`;

const STEPPER = `// A4988 driver + NEMA 17: one turn forward, one turn back (200 full steps).
const int STEP = 3, DIR = 4;

void turn(bool forward) {
  digitalWrite(DIR, forward ? HIGH : LOW);
  for (int i = 0; i < 200; i++) {
    digitalWrite(STEP, HIGH);
    delayMicroseconds(1200);
    digitalWrite(STEP, LOW);
    delayMicroseconds(1200);
  }
}

void setup() {
  pinMode(STEP, OUTPUT);
  pinMode(DIR, OUTPUT);
}

void loop() {
  turn(true);
  delay(400);
  turn(false);
  delay(400);
}
`;

const RFID = `// RC522 RFID access control: the blue tag (DE AD BE EF) opens the "lock" LED on pin 7.
// Hold the reader on the canvas to tap the selected card.
#include <SPI.h>
#include <MFRC522.h>

MFRC522 rfid(10, 9);
byte allowed[4] = {0xDE, 0xAD, 0xBE, 0xEF};

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  pinMode(7, OUTPUT);
  Serial.println("Tap a card...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  bool ok = rfid.uid.size == 4;
  Serial.print("UID:");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(' ');
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < 4 && rfid.uid.uidByte[i] != allowed[i]) ok = false;
  }
  Serial.println(ok ? "  -> access granted" : "  -> denied");
  if (ok) {
    digitalWrite(7, HIGH);
    delay(1500);
    digitalWrite(7, LOW);
  }
  rfid.PICC_HaltA();
}
`;

const CHASER = `// 74HC595 LED chaser: 3 pins drive 8 LEDs through a shift register.
const int DATA = 11, CLOCK = 12, LATCH = 8;

void show(byte v) {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, v);
  digitalWrite(LATCH, HIGH);
}

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  for (int i = 0; i < 8; i++) { show(1 << i); delay(80); }
  for (int i = 6; i > 0; i--) { show(1 << i); delay(80); }
}
`;

const RADIO_TX = `// Remote (transmitter): sends the button state over nRF24L01 every 50 ms.
#include <RF24.h>
RF24 radio(9, 10); // CE, CSN
const byte address[6] = "00001";

void setup() {
  pinMode(2, INPUT_PULLUP);
  radio.begin();
  radio.openWritingPipe(address);
  radio.setPALevel(RF24_PA_MIN);
  radio.stopListening();
}

void loop() {
  int pressed = digitalRead(2) == LOW;
  radio.write(&pressed, sizeof(pressed));
  delay(50);
}
`;

const RADIO_RX = `// Receiver: lights the LED on pin 5 while the remote's button is held.
#include <RF24.h>
RF24 radio(9, 10); // CE, CSN
const byte address[6] = "00001";

void setup() {
  pinMode(5, OUTPUT);
  radio.begin();
  radio.openReadingPipe(0, address);
  radio.setPALevel(RF24_PA_MIN);
  radio.startListening();
}

void loop() {
  if (radio.available()) {
    int pressed = 0;
    radio.read(&pressed, sizeof(pressed));
    digitalWrite(5, pressed ? HIGH : LOW);
  }
}
`;

// ---------------------------------------------------------------- examples

export interface DeviceExample {
  id: string;
  name: string;
  description: string;
  build: () => CircuitDoc;
}

export const DEVICE_EXAMPLES: DeviceExample[] = [
  {
    id: 'oled',
    name: 'OLED display (SSD1306)',
    description: 'Text, a progress bar and a pulsing circle drawn with Adafruit_GFX on a 128×64 I2C OLED.',
    build: () => {
      const u = board('arduino-uno', OLED);
      const o = place('oled-128x64', 'GND', { x: 110, y: -60 });
      return doc('OLED display', [u, o], [
        link(o, 'GND', u, 'GND3', BLACK, -20), link(o, 'VCC', u, '5V', RED, 225), link(o, 'SCL', u, 'SCL', YELLOW, -30), link(o, 'SDA', u, 'SDA', BLUE, -40),
      ]);
    },
  },
  {
    id: 'neopixel',
    name: 'NeoPixel ring rainbow',
    description: 'A 16-LED WS2812 ring cycling through the colour wheel with Adafruit_NeoPixel (ColorHSV + gamma32).',
    build: () => {
      const u = board('arduino-uno', RAINBOW);
      const r = place('neopixel-ring', 'GND', { x: 330, y: -30 });
      return doc('NeoPixel rainbow', [u, r], [link(r, 'GND', u, 'GND3', BLACK, -12), link(r, 'VCC', u, '5V', RED, 230), link(r, 'DIN', u, 'D6', GREEN, -20)]);
    },
  },
  {
    id: 'weather',
    name: 'Weather station (DHT22 + LCD)',
    description: 'Temperature and humidity from a DHT22 shown on an I2C LCD. Change the sensor\'s readings while it runs.',
    build: () => {
      const u = board('arduino-uno', WEATHER);
      const d = place('dht', 'VCC', { x: 300, y: -30 });
      const l = place('lcd-i2c', 'GND', { x: 60, y: 280 });
      return doc('Weather station', [u, d, l], [
        link(d, 'VCC', u, '5V', RED, 240), link(d, 'GND', u, 'GND3', BLACK, -12), link(d, 'DATA', u, 'D2', GREEN, -20),
        link(l, 'GND', u, 'GND1', BLACK, 250), link(l, 'VCC', u, '5V', RED, 258), link(l, 'SDA', u, 'A4', BLUE, 266), link(l, 'SCL', u, 'A5', YELLOW, 274),
      ]);
    },
  },
  {
    id: 'parking',
    name: 'Parking sensor (HC-SR04)',
    description: 'pulseIn() measures the ultrasonic echo; a buzzer beeps faster as the obstacle gets closer. Drag the distance.',
    build: () => {
      const u = board('arduino-uno', PARKING);
      const s = place('hc-sr04', 'VCC', { x: 320, y: -40 });
      const p = place('piezo', '+', { x: 120, y: -60 });
      return doc('Parking sensor', [u, s, p], [
        link(s, 'VCC', u, '5V', RED, 235), link(s, 'GND', u, 'GND3', BLACK, -14), link(s, 'TRIG', u, 'D9', ORANGE, -22), link(s, 'ECHO', u, 'D10', PURPLE, -30),
        link(p, '+', u, 'D8', GREEN, -8), link(p, '-', u, 'GND3', BLACK, -4),
      ]);
    },
  },
  {
    id: 'stepper',
    name: 'Stepper motor (A4988 + NEMA 17)',
    description: 'STEP/DIR pulses from the Uno drive a bipolar stepper through an A4988; 12 V from a barrel jack powers the motor.',
    build: () => {
      const u = board('arduino-uno', STEPPER);
      const d = place('a4988', 'EN', { x: 340, y: 120 });
      const m = place('stepper-nema17', 'A1', { x: 470, y: 20 });
      const j = place('barrel-jack', 'TIP', { x: 350, y: -40 }, { volts: 12 });
      return doc('Stepper motor', [u, d, m, j], [
        link(u, 'D3', d, 'STEP', ORANGE, -20), link(u, 'D4', d, 'DIR', YELLOW, -28), link(u, '5V', d, 'VDD', RED, 230), link(u, 'GND1', d, 'GND2', BLACK, 238),
        link(d, 'RST', d, 'SLP', WHITE), link(j, 'TIP', d, 'VMOT', RED, -6), link(j, 'SLV', d, 'GND', BLACK, -12),
        link(d, 'A1', m, 'A1', BLACK), link(d, 'A2', m, 'A2', GREEN), link(d, 'B1', m, 'B1', RED), link(d, 'B2', m, 'B2', BLUE),
      ]);
    },
  },
  {
    id: 'rfid',
    name: 'RFID access control (RC522)',
    description: 'Reads card UIDs over SPI with the MFRC522 library and lights the "unlock" LED for the right tag. Hold the reader to tap.',
    build: () => {
      const u = board('arduino-uno', RFID);
      const r = place('rc522', 'SDA', { x: 330, y: -20 });
      const res = place('resistor', '1', { x: 120, y: -70 }, { resistance: 220 });
      const led = place('led', 'A', { x: 180, y: -70 }, { color: 'green' });
      return doc('RFID access', [u, r, res, led], [
        link(r, 'SDA', u, 'D10', ORANGE, -8), link(r, 'SCK', u, 'D13', YELLOW, -14), link(r, 'MOSI', u, 'D11', BLUE, -20), link(r, 'MISO', u, 'D12', PURPLE, -26),
        link(r, 'RST', u, 'D9', WHITE, -32), link(r, 'GND', u, 'GND1', BLACK, 236), link(r, 'VCC', u, '3V3', RED, 228),
        link(u, 'D7', res, '1', GREEN, -40), link(res, '2', led, 'A', GREEN), link(led, 'K', u, 'GND3', BLACK, -48),
      ]);
    },
  },
  {
    id: '555',
    name: '555 timer blinker (no code)',
    description: 'The classic astable 555: 1 kΩ, 47 kΩ and 10 µF make an LED flash about 1.5 times a second. Try other resistor values.',
    build: () => {
      const b = place('battery', '+', { x: -60, y: 0 }, { kind: '9V' });
      const t = place('ne555', 'GND', { x: 100, y: 60 });
      const r1 = place('resistor', '1', { x: 60, y: -60 }, { resistance: 1000 });
      const r2 = place('resistor', '1', { x: 150, y: -60 }, { resistance: 47000 });
      const c = place('electrolytic', '+', { x: 60, y: 140 }, { capacitance: 10e-6 });
      const r3 = place('resistor', '1', { x: 210, y: 110 }, { resistance: 470 });
      const led = place('led', 'A', { x: 270, y: 110 }, { color: 'red' });
      return doc('555 blinker', [b, t, r1, r2, c, r3, led], [
        link(b, '+', t, 'VCC', RED, -80), link(b, '+', t, 'RESET', RED, -80), link(b, '-', t, 'GND', BLACK, 170),
        link(b, '+', r1, '1', RED, -80), link(r1, '2', t, 'DIS', ORANGE, -40), link(t, 'DIS', r2, '1', ORANGE, -40), link(r2, '2', t, 'THR', YELLOW, -50),
        link(t, 'THR', t, 'TRIG', YELLOW, 110), link(t, 'TRIG', c, '+', YELLOW, 120), link(c, '-', b, '-', BLACK, 170),
        link(t, 'OUT', r3, '1', GREEN, 100), link(r3, '2', led, 'A', GREEN), link(led, 'K', b, '-', BLACK, 170),
      ]);
    },
  },
  {
    id: 'shift595',
    name: 'LED chaser (74HC595)',
    description: 'shiftOut() sends a byte to a 74HC595 shift register; a pulse on the latch moves it onto 8 LEDs — 3 pins, 8 outputs.',
    build: () => {
      const u = board('arduino-uno', CHASER);
      const s = place('74hc595', 'QB', { x: 360, y: 100 });
      const parts: ComponentInstance[] = [u, s];
      const wires: Wire[] = [
        link(u, 'D11', s, 'SER', BLUE, -20), link(u, 'D12', s, 'SRCLK', YELLOW, -28), link(u, 'D8', s, 'RCLK', ORANGE, -36),
        link(u, '5V', s, 'VCC', RED, 230), link(u, 'GND1', s, 'GND', BLACK, 238), link(s, 'OE', s, 'GND', BLACK, 140), link(s, 'SRCLR', s, 'VCC', RED, 60),
      ];
      ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].forEach((q, i) => {
        const r = place('resistor', '1', { x: 480, y: -40 + i * 30 }, { resistance: 330 });
        const led = place('led', 'A', { x: 540, y: -40 + i * 30 }, { color: ['red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue'][i] });
        parts.push(r, led);
        wires.push(link(s, q, r, '1', GREEN), link(r, '2', led, 'A', GREEN), link(led, 'K', u, 'GND3', BLACK, 250 + i * 4));
      });
      return doc('LED chaser', parts, wires);
    },
  },
  {
    id: 'radio',
    name: 'Wireless remote (2 × nRF24L01)',
    description: 'Two Unos with nRF24L01 radios: hold the button on the left board and the LED on the right board lights — sent over 2.4 GHz with RF24.',
    build: () => {
      const a = board('arduino-uno', RADIO_TX, 0, 0, 'tx');
      const b = board('arduino-uno', RADIO_RX, 520, 0, 'rx');
      const ra = place('nrf24l01', 'GND', { x: 120, y: -70 });
      const rb = place('nrf24l01', 'GND', { x: 640, y: -70 });
      const btn = place('pushbutton', '1a', { x: 40, y: 260 });
      const res = place('resistor', '1', { x: 700, y: 250 }, { resistance: 220 });
      const led = place('led', 'A', { x: 760, y: 250 }, { color: 'green' });
      const radio = (u: ComponentInstance, r: ComponentInstance, base: number): Wire[] => [
        link(r, 'GND', u, 'GND3', BLACK, base), link(r, 'VCC', u, '3V3', RED, 236), link(r, 'CE', u, 'D9', ORANGE, base - 6), link(r, 'CSN', u, 'D10', PURPLE, base - 12),
        link(r, 'SCK', u, 'D13', YELLOW, base - 18), link(r, 'MOSI', u, 'D11', BLUE, base - 24), link(r, 'MISO', u, 'D12', GREEN, base - 30),
      ];
      return doc('Wireless remote', [a, b, ra, rb, btn, res, led], [
        ...radio(a, ra, -10), ...radio(b, rb, -10),
        link(btn, '1a', a, 'D2', BLUE, 290), link(btn, '2a', a, 'GND1', BLACK, 300),
        link(b, 'D5', res, '1', GREEN, -50), link(res, '2', led, 'A', GREEN), link(led, 'K', b, 'GND1', BLACK, 280),
      ]);
    },
  },
];


