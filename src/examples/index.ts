import type { CircuitDoc, ComponentInstance, Point, PropValue, Rotation, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';
import { EXAMPLE_7805 } from '../ai/prompt';
import { validateSpec } from '../ai/spec';
import { registerSpec } from '../ai/library';
import { DEVICE_EXAMPLES } from './devices';
import { ADVANCED_EXAMPLES } from './advanced';
import { GATE_EXAMPLES } from './gates';

// ------------------------------------------------------------------ placement helpers

let n = 0;
const id = (p: string) => `${p}${++n}`;

/** Place a part so that `pin` lands exactly on `at`. */
function place(type: string, pin: string, at: Point, props: Record<string, PropValue> = {}, rot: Rotation = 0, flip = false): ComponentInstance {
  const def = getDef(type)!;
  const comp: ComponentInstance = { id: id(type.slice(0, 3)), type, x: 0, y: 0, rot, flip, props: { ...def.defaultProps, ...props } };
  const p = def.pins(comp.props).find((x) => x.id === pin)!;
  const w = localToWorld(comp, def, p);
  comp.x = at.x - w.x;
  comp.y = at.y - w.y;
  return comp;
}

const ROW_Y: Record<string, number> = { a: 60, b: 70, c: 80, d: 90, e: 100, f: 130, g: 140, h: 150, i: 160, j: 170 };
/** Breadboard at (0,0): hole position for column (1-based) and row letter. */
const hole = (col: number, row: string): Point => ({ x: 20 + (col - 1) * 10, y: ROW_Y[row] });
const holeId = (col: number, row: string) => `${col}${row}`;
/** Rail pin id nearest to a column (rails skip every 6th position). */
function railId(rail: 'tp' | 'tn' | 'bp' | 'bn', col: number) {
  let c = col - 1;
  if (c % 6 === 0) c += 1;
  return `${rail}${c}`;
}

function wire(a: [string, string], b: [string, string], color: string, points: Point[] = []): Wire {
  return { id: id('w'), a: { comp: a[0], pin: a[1] }, b: { comp: b[0], pin: b[1] }, points, color };
}

const RED = '#e53935', BLACK = '#212121', GREEN = '#43a047', BLUE = '#1e88e5', ORANGE = '#fb8c00', YELLOW = '#fdd835', PURPLE = '#8e24aa';

/** Standard layout: breadboard at origin, Uno to its left. Header pin x positions follow the Uno def. */
const UNO_AT = { x: -320, y: 20 };
const UNO_TOP: Record<string, number> = { GND3: 120, D13: 130, D12: 140, D11: 150, D10: 160, D9: 170, D8: 180, D7: 200, D6: 210, D5: 220, D4: 230, D3: 240, D2: 250 };
const UNO_BOT: Record<string, number> = { '5V': 150, GND1: 160, GND2: 170, A0: 200, A1: 210 };
const ESP_AT = { x: 40, y: 60 };
const ESP_TOP = ['D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'TX2', 'RX2', 'D4', 'D2', 'D15', 'GND2', '3V3'];
const ESP_BOT = ['EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'D13', 'GND1', 'VIN'];
const espPin = (id: string): Point => {
  const t = ESP_TOP.indexOf(id);
  if (t >= 0) return { x: ESP_AT.x + 20 + t * 10, y: ESP_AT.y };
  return { x: ESP_AT.x + 20 + ESP_BOT.indexOf(id) * 10, y: ESP_AT.y + 100 };
};
const unoTop = (pin: string): Point => ({ x: UNO_AT.x + UNO_TOP[pin], y: UNO_AT.y + 10 });
const unoBot = (pin: string): Point => ({ x: UNO_AT.x + UNO_BOT[pin], y: UNO_AT.y + 200 });

function uno(code: string): ComponentInstance {
  const def = getDef('arduino-uno')!;
  return { id: 'uno', type: 'arduino-uno', x: UNO_AT.x, y: UNO_AT.y, rot: 0, flip: false, props: { ...def.defaultProps, code } };
}
const breadboard = (): ComponentInstance => ({ id: 'bb', type: 'breadboard', x: 0, y: 0, rot: 0, flip: false, props: {} });

/** Route from a top-header pin up and over to a breadboard point. */
const overTop = (from: Point, to: Point, lane: number): Point[] => [{ x: from.x, y: -10 - lane * 8 }, { x: to.x, y: -10 - lane * 8 }];

function railX(rail: string) {
  return 20 + Number(rail.slice(2)) * 10;
}

// ------------------------------------------------------------------ sketches

const BLINK = `// Blink an LED on pin 13 (also lights the on-board "L" LED).
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink started");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`;

const BUTTON = `// Push button on pin 2 (uses the internal pull-up) controls the LED on pin 13.
const int BUTTON_PIN = 2;
const int LED_PIN = 13;
int presses = 0;
bool wasPressed = false;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Press and hold the button!");
}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;   // pull-up: pressed reads LOW
  digitalWrite(LED_PIN, pressed ? HIGH : LOW);
  if (pressed && !wasPressed) {
    presses++;
    Serial.print("Pressed ");
    Serial.print(presses);
    Serial.println(" times");
  }
  wasPressed = pressed;
  delay(10);
}
`;

const DIMMER = `// Turn the potentiometer (drag its knob) to dim the LED on PWM pin 9.
const int POT_PIN = A0;
const int LED_PIN = 9;
unsigned long lastPrint = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(POT_PIN);            // 0..1023
  int duty = map(raw, 0, 1023, 0, 255);     // 0..255
  analogWrite(LED_PIN, duty);

  if (millis() - lastPrint >= 250) {
    lastPrint = millis();
    float volts = raw * 5.0 / 1023.0;
    Serial.print("A0 = ");
    Serial.print(raw);
    Serial.print("  (");
    Serial.print(volts);
    Serial.println(" V)");
  }
}
`;

const MOTOR = `// PWM speed control of a DC motor through an NPN transistor.
// The motor has its own 6 V battery; grounds are shared.
const int MOTOR_PIN = 9;

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  for (int speed = 0; speed <= 255; speed += 5) {
    analogWrite(MOTOR_PIN, speed);
    delay(40);
  }
  Serial.println("Full speed");
  delay(1500);
  for (int speed = 255; speed >= 0; speed -= 5) {
    analogWrite(MOTOR_PIN, speed);
    delay(40);
  }
  Serial.println("Stopped");
  delay(1000);
}
`;

const MELODY = `// Play a little tune on a piezo buzzer with tone().
const int BUZZER = 8;
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};
int beats[] = {1, 1, 1, 1, 2, 2, 2, 4};

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    int ms = beats[i] * 120;
    Serial.print("Note ");
    Serial.println(notes[i]);
    tone(BUZZER, notes[i], ms);
    delay(ms + 40);
  }
  noTone(BUZZER);
  delay(1200);
}
`;


const SERVO_KNOB = `// Turn the potentiometer to steer the servo (Servo library).
#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  int angle = map(raw, 0, 1023, 0, 180);
  arm.write(angle);
  Serial.println(angle);
  delay(20);
}
`;

const LCD_HELLO = `// LiquidCrystal on a 16x2 display: RS=12, E=11, D4..D7 = 5, 4, 3, 2
#include <LiquidCrystal.h>

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
byte heart[8] = {0b00000, 0b01010, 0b11111, 0b11111, 0b01110, 0b00100, 0b00000, 0b00000};

void setup() {
  lcd.begin(16, 2);
  lcd.createChar(0, heart);
  lcd.print("Hello, world! ");
  lcd.write(byte(0));
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Uptime: ");
  lcd.print(millis() / 1000);
  lcd.print(" s");
  delay(200);
}
`;

const ESP32_LCD = `// ESP32 + I2C LCD (SDA = GPIO21, SCL = GPIO22). Turn the pot on GPIO34.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int POT = 34;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  lcd.init();
  lcd.backlight();
  lcd.print("ESP32 ADC demo");
}

void loop() {
  int raw = analogRead(POT);            // 12-bit: 0..4095
  float volts = raw * 3.3 / 4095.0;
  lcd.setCursor(0, 1);
  lcd.print(raw);
  lcd.print("  ");
  lcd.print(volts, 2);
  lcd.print(" V   ");
  digitalWrite(LED_BUILTIN, raw > 2048);
  delay(100);
}
`;

const INTERRUPT = `// A hardware interrupt counts button presses, even while loop() is busy.
const int BUTTON = 2;
const int LED = 13;
volatile int presses = 0;
volatile bool ledOn = false;

void onPress() {
  presses++;
  ledOn = !ledOn;
}

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(BUTTON), onPress, FALLING);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED, ledOn);
  Serial.print("Presses: ");
  Serial.println(presses);
  delay(1000);   // a long delay: the interrupt still catches every press
}
`;

/** Blocks program for the blocks example (the code below is what the generator produces from it). */
const BLOCKS_BLINK = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'arduino_forever', x: 30, y: 30,
        inputs: {
          DO: {
            block: {
              type: 'io_builtin_led', fields: { STATE: 'HIGH' },
              next: {
                block: {
                  type: 'control_wait', fields: { UNIT: 'S' }, inputs: { TIME: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } },
                  next: {
                    block: {
                      type: 'io_builtin_led', fields: { STATE: 'LOW' },
                      next: { block: { type: 'control_wait', fields: { UNIT: 'S' }, inputs: { TIME: { shadow: { type: 'math_number', fields: { NUM: 0.5 } } } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};
export const BLOCKS_BLINK_JSON = BLOCKS_BLINK;
export const BLOCKS_BLINK_CODE = `// Generated from blocks — switch to Text mode to edit the code directly.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000 * 0.5);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000 * 0.5);
}
`;

// ------------------------------------------------------------------ circuits

function blinkParts(ledPin: string, resistorCol = 5) {
  // resistor col c..c+4 on row a, LED anode on col c+4, cathode on c+5 (row c), cathode strip → GND rail
  const c = resistorCol;
  const r = place('resistor', '1', hole(c, 'a'), { resistance: 220 });
  const led = place('led', 'A', hole(c + 4, 'c'), { color: 'red' });
  const rail = railId('tn', c + 5);
  const parts = [r, led];
  const wires = [
    wire(['uno', ledPin], ['bb', holeId(c, 'c')], ORANGE, overTop(unoTop(ledPin), hole(c, 'c'), 2)),
    wire(['bb', holeId(c + 5, 'b')], ['bb', rail], BLACK),
  ];
  return { parts, wires };
}

function groundRail(): Wire {
  const rail = railId('tn', 2);
  return wire(['uno', 'GND3'], ['bb', rail], BLACK, overTop(unoTop('GND3'), { x: railX(rail), y: 30 }, 1));
}

export interface Example {
  id: string;
  name: string;
  description: string;
  /** heading the example is listed under in the Examples menu */
  group?: string;
  build: () => CircuitDoc;
}

export const EXAMPLES: Example[] = [
  {
    id: 'blink',
    name: 'Blink an LED',
    description: 'The classic first sketch: an LED and a 220 Ω resistor on pin 13.',
    build: () => {
      const { parts, wires } = blinkParts('D13');
      return { version: 1, name: 'Blink an LED', components: [breadboard(), uno(BLINK), ...parts], wires: [groundRail(), ...wires] };
    },
  },
  {
    id: 'button',
    name: 'Button controls an LED',
    description: 'A push button on pin 2 with INPUT_PULLUP switches the LED on pin 13 and counts presses.',
    build: () => {
      const { parts, wires } = blinkParts('D13');
      const btn = place('pushbutton', '1a', hole(20, 'e'), { cap: '#3b82f6' });
      return {
        version: 1,
        name: 'Button controls an LED',
        components: [breadboard(), uno(BUTTON), ...parts, btn],
        wires: [
          groundRail(),
          ...wires,
          wire(['uno', 'D2'], ['bb', holeId(22, 'j')], BLUE, [{ x: unoTop('D2').x, y: -34 }, { x: 330, y: -34 }, { x: 330, y: 190 }, { x: hole(22, 'j').x, y: 190 }]),
          wire(['bb', holeId(20, 'a')], ['bb', railId('tn', 20)], BLACK),
        ],
      };
    },
  },
  {
    id: 'dimmer',
    name: 'Potentiometer dimmer (PWM)',
    description: 'analogRead() a potentiometer and analogWrite() the value to an LED. Drag the knob while simulating.',
    build: () => {
      const { parts, wires } = blinkParts('D9');
      const pot = place('potentiometer', '1', { x: 60, y: 300 });
      return {
        version: 1,
        name: 'Potentiometer dimmer',
        components: [breadboard(), uno(DIMMER), ...parts, pot],
        wires: [
          groundRail(),
          ...wires,
          wire([pot.id, '1'], ['uno', 'GND1'], BLACK, [{ x: 60, y: 318 }, { x: unoBot('GND1').x, y: 318 }]),
          wire([pot.id, 'W'], ['uno', 'A0'], YELLOW, [{ x: 70, y: 310 }, { x: unoBot('A0').x, y: 310 }]),
          wire([pot.id, '2'], ['uno', '5V'], RED, [{ x: 80, y: 326 }, { x: unoBot('5V').x, y: 326 }]),
        ],
      };
    },
  },
  {
    id: 'rc',
    name: 'RC charging (multimeter + scope)',
    description: 'A 10 kΩ resistor charges a 100 µF capacitor from a 9 V battery (τ = 1 s). Flip the slide switch to discharge.',
    build: () => {
      const bat = place('battery', '+', { x: -90, y: 20 }, { kind: '9V' });
      const sw = place('slide-switch', '1', hole(3, 'a'));
      const r = place('resistor', '1', hole(4, 'b'), { resistance: 10000 });
      const cap = place('electrolytic', '+', hole(8, 'e'), { capacitance: 100e-6, voltage: 16 });
      const mm = place('multimeter', 'COM', { x: 150, y: -40 }, { mode: 'V' });
      const scope = place('oscilloscope', '+', { x: 500, y: 60 }, { timeDiv: 0.5, voltDiv: 2 });
      return {
        version: 1,
        name: 'RC charging',
        components: [breadboard(), bat, sw, r, cap, mm, scope],
        wires: [
          wire([bat.id, '+'], ['bb', railId('tp', 2)], RED, [{ x: -90, y: 5 }, { x: railX(railId('tp', 2)), y: 5 }]),
          wire([bat.id, '-'], ['bb', railId('tn', 2)], BLACK, [{ x: -70, y: 30 }]),
          wire(['bb', holeId(3, 'b')], ['bb', railId('tp', 3)], RED),
          wire(['bb', holeId(5, 'c')], ['bb', railId('tn', 5)], BLACK, [{ x: hole(5, 'c').x + 4, y: 76 }, { x: hole(5, 'c').x + 4, y: 34 }]),
          wire(['bb', holeId(9, 'b')], ['bb', railId('tn', 10)], BLACK),
          wire([mm.id, '+'], ['bb', holeId(8, 'a')], RED, [{ x: 180, y: 48 }, { x: hole(8, 'a').x, y: 48 }]),
          wire([mm.id, 'COM'], ['bb', holeId(9, 'a')], BLACK, [{ x: 150, y: 44 }, { x: hole(9, 'a').x, y: 44 }]),
          wire([scope.id, '+'], [r.id, '2'], GREEN, [{ x: 530, y: 60 }, { x: 530, y: 250 }, { x: hole(8, 'b').x + 4, y: 250 }, { x: hole(8, 'b').x + 4, y: 70 }]),
          wire([scope.id, '-'], [cap.id, '-'], BLACK, [{ x: 520, y: 90 }, { x: 520, y: 242 }, { x: hole(9, 'e').x, y: 242 }]),
        ],
      };
    },
  },
  {
    id: 'motor',
    name: 'Transistor motor driver',
    description: 'PWM on pin 9 drives an NPN transistor that switches a DC motor on its own 6 V supply, with a flyback diode.',
    build: () => {
      const q = place('npn', 'E', hole(15, 'e'));
      const rb = place('resistor', '1', hole(12, 'b'), { resistance: 1000 });
      const d = place('diode', 'A', hole(17, 'a'), { model: '1N4001' });
      const motor = place('dc-motor', '+', { x: 230, y: -40 });
      const bat = place('battery', '+', { x: 380, y: 40 }, { kind: 'AA4' });
      return {
        version: 1,
        name: 'Transistor motor driver',
        components: [breadboard(), uno(MOTOR), q, rb, d, motor, bat],
        wires: [
          groundRail(),
          wire(['uno', 'D9'], ['bb', holeId(12, 'a')], ORANGE, overTop(unoTop('D9'), hole(12, 'a'), 2)),
          wire(['bb', holeId(15, 'a')], ['bb', railId('tn', 15)], BLACK),
          wire([motor.id, '-'], ['bb', holeId(17, 'b')], PURPLE, [{ x: 250, y: -20 }, { x: hole(17, 'b').x + 4, y: -20 }, { x: hole(17, 'b').x + 4, y: 70 }]),
          wire([motor.id, '+'], ['bb', holeId(21, 'b')], RED, [{ x: 230, y: -10 }, { x: hole(21, 'b').x + 4, y: -10 }, { x: hole(21, 'b').x + 4, y: 70 }]),
          wire([bat.id, '+'], ['bb', holeId(21, 'c')], RED, [{ x: 400, y: 80 }]),
          wire([bat.id, '-'], ['bb', railId('tn', 25)], BLACK, [{ x: 420, y: 30 }]),
        ],
      };
    },
  },
  {
    id: 'melody',
    name: 'Piezo melody',
    description: 'tone() plays a scale on a piezo buzzer connected to pin 8. Unmute the sound in the toolbar.',
    build: () => {
      const pz = place('piezo', '+', hole(15, 'e'));
      return {
        version: 1,
        name: 'Piezo melody',
        components: [breadboard(), uno(MELODY), pz],
        wires: [
          groundRail(),
          wire(['uno', 'D8'], ['bb', holeId(15, 'a')], ORANGE, overTop(unoTop('D8'), hole(15, 'a'), 2)),
          wire(['bb', holeId(17, 'a')], ['bb', railId('tn', 17)], BLACK),
        ],
      };
    },
  },
  {
    id: 'blocks',
    name: 'Blink with blocks',
    description: 'The same blink, programmed with drag-and-drop blocks (open Code → Blocks).',
    build: () => {
      const { parts, wires } = blinkParts('D13');
      const board = uno(BLOCKS_BLINK_CODE);
      board.props = { ...board.props, codeMode: 'blocks', blocks: JSON.stringify(BLOCKS_BLINK) };
      return { version: 1, name: 'Blink with blocks', components: [breadboard(), board, ...parts], wires: [groundRail(), ...wires] };
    },
  },
  {
    id: 'servo',
    name: 'Servo steered by a knob',
    description: 'Servo library: analogRead a potentiometer and write the angle to an SG90 servo. Drag the knob while simulating.',
    build: () => {
      const pot = place('potentiometer', '1', { x: -250, y: 320 });
      const sv = place('servo', '-', { x: 40, y: 440 });
      return {
        version: 1,
        name: 'Servo knob',
        components: [uno(SERVO_KNOB), pot, sv],
        wires: [
          wire([pot.id, '1'], ['uno', 'GND2'], BLACK, [{ x: -250, y: 250 }, { x: unoBot('GND2').x, y: 250 }]),
          wire([pot.id, 'W'], ['uno', 'A0'], YELLOW, [{ x: -240, y: 262 }, { x: unoBot('A0').x, y: 262 }]),
          wire([pot.id, '2'], ['uno', '5V'], RED, [{ x: -230, y: 256 }, { x: unoBot('5V').x, y: 256 }]),
          wire([sv.id, '-'], ['uno', 'GND1'], BLACK, [{ x: 40, y: 470 }, { x: -100, y: 470 }, { x: -100, y: 290 }, { x: unoBot('GND1').x, y: 290 }]),
          wire([sv.id, '+'], ['uno', '5V'], RED, [{ x: 50, y: 478 }, { x: -92, y: 478 }, { x: -92, y: 298 }, { x: unoBot('5V').x, y: 298 }]),
          wire([sv.id, 'SIG'], ['uno', 'D9'], ORANGE, [{ x: 60, y: 486 }, { x: 110, y: 486 }, { x: 110, y: -20 }, { x: unoTop('D9').x, y: -20 }]),
        ],
      };
    },
  },
  {
    id: 'lcd',
    name: 'LCD: Hello, world!',
    description: 'LiquidCrystal on a 16×2 parallel LCD with a custom heart character and an uptime counter.',
    build: () => {
      const lcd = place('lcd', 'VSS', { x: -290, y: 400 });
      const lp = (pin: string) => localToWorld(lcd, getDef('lcd')!, getDef('lcd')!.pins(lcd.props).find((p) => p.id === pin)!);
      const up = (pin: string, lane: number, color: string, to: [string, string], toPt: Point) =>
        wire([lcd.id, pin], to, color, [{ x: lp(pin).x, y: 300 - lane * 6 }, { x: toPt.x, y: 300 - lane * 6 }]);
      return {
        version: 1,
        name: 'LCD hello world',
        components: [uno(LCD_HELLO), lcd],
        wires: [
          up('VSS', 0, BLACK, ['uno', 'GND1'], unoBot('GND1')),
          up('VDD', 1, RED, ['uno', '5V'], unoBot('5V')),
          up('V0', 2, BLACK, ['uno', 'GND2'], unoBot('GND2')),
          wire([lcd.id, 'RW'], [lcd.id, 'VSS'], BLACK, [{ x: lp('RW').x, y: 390 }, { x: lp('VSS').x, y: 390 }]),
          wire([lcd.id, 'RS'], ['uno', 'D12'], GREEN, [{ x: lp('RS').x, y: 270 }, { x: 20, y: 270 }, { x: 20, y: -30 }, { x: unoTop('D12').x, y: -30 }]),
          wire([lcd.id, 'E'], ['uno', 'D11'], BLUE, [{ x: lp('E').x, y: 276 }, { x: 26, y: 276 }, { x: 26, y: -24 }, { x: unoTop('D11').x, y: -24 }]),
          ...(['D4', 'D5', 'D6', 'D7'] as const).map((d, i) =>
            wire([lcd.id, d], ['uno', ['D5', 'D4', 'D3', 'D2'][i]], [ORANGE, YELLOW, PURPLE, GREEN][i], [
              { x: lp(d).x, y: 282 + i * 6 }, { x: 32 + i * 6, y: 282 + i * 6 }, { x: 32 + i * 6, y: -18 + i * 6 - 12 }, { x: unoTop(['D5', 'D4', 'D3', 'D2'][i]).x, y: -18 + i * 6 - 12 },
            ]),
          ),
          wire([lcd.id, 'A'], ['uno', '5V'], RED, [{ x: lp('A').x, y: 318 }, { x: unoBot('5V').x + 3, y: 318 }]),
          wire([lcd.id, 'K'], ['uno', 'GND2'], BLACK, [{ x: lp('K').x, y: 324 }, { x: unoBot('GND2').x + 3, y: 324 }]),
        ],
      };
    },
  },
  {
    id: 'esp32-lcd',
    name: 'ESP32 + I2C LCD + ADC',
    description: 'ESP32 DevKit reads a potentiometer with its 12-bit ADC and shows the value on an I2C LCD (SDA 21, SCL 22).',
    build: () => {
      const esp: ComponentInstance = { id: 'esp', type: 'esp32-devkit', x: ESP_AT.x, y: ESP_AT.y, rot: 0, flip: false, props: { ...getDef('esp32-devkit')!.defaultProps, code: ESP32_LCD } };
      const lcd = place('lcd-i2c', 'GND', { x: 330, y: 150 });
      const pot = place('potentiometer', '1', { x: 90, y: 260 });
      return {
        version: 1,
        name: 'ESP32 I2C LCD',
        components: [esp, lcd, pot],
        wires: [
          wire([lcd.id, 'GND'], ['esp', 'GND2'], BLACK, [{ x: 330, y: 20 }, { x: espPin('GND2').x, y: 20 }]),
          wire([lcd.id, 'VCC'], ['esp', 'VIN'], RED, [{ x: 340, y: 190 }, { x: espPin('VIN').x, y: 190 }]),
          wire([lcd.id, 'SDA'], ['esp', 'D21'], BLUE, [{ x: 350, y: 30 }, { x: espPin('D21').x, y: 30 }]),
          wire([lcd.id, 'SCL'], ['esp', 'D22'], YELLOW, [{ x: 360, y: 40 }, { x: espPin('D22').x, y: 40 }]),
          wire([pot.id, '1'], ['esp', 'GND1'], BLACK, [{ x: 90, y: 240 }, { x: espPin('GND1').x, y: 240 }]),
          wire([pot.id, 'W'], ['esp', 'D34'], ORANGE, [{ x: 100, y: 220 }, { x: espPin('D34').x, y: 220 }]),
          wire([pot.id, '2'], ['esp', '3V3'], RED, [{ x: 110, y: 230 }, { x: espPin('3V3').x + 12, y: 230 }, { x: espPin('3V3').x + 12, y: 40 }, { x: espPin('3V3').x, y: 40 }]),
        ],
      };
    },
  },
  {
    id: 'interrupt',
    name: 'Interrupt button counter',
    description: 'attachInterrupt() on pin 2 counts presses and toggles an LED even during a long delay().',
    build: () => {
      const { parts, wires } = blinkParts('D13');
      const btn = place('pushbutton', '1a', hole(20, 'e'), { cap: '#22c55e' });
      return {
        version: 1,
        name: 'Interrupt counter',
        components: [breadboard(), uno(INTERRUPT), ...parts, btn],
        wires: [
          groundRail(),
          ...wires,
          wire(['uno', 'D2'], ['bb', holeId(22, 'j')], BLUE, [{ x: unoTop('D2').x, y: -34 }, { x: 330, y: -34 }, { x: 330, y: 190 }, { x: hole(22, 'j').x, y: 190 }]),
          wire(['bb', holeId(20, 'a')], ['bb', railId('tn', 20)], BLACK),
        ],
      };
    },
  },
  {
    id: 'ai-regulator',
    name: 'AI part: 7805 regulator',
    description: 'A 7805 made by the AI part generator: 9 V in, 5 V out to an LED, with a multimeter on the output.',
    build: () => {
      const spec = validateSpec(EXAMPLE_7805);
      spec.type = 'ai-7805-voltage-regulator-demo';
      registerSpec(spec);
      const bat = place('battery', '+', { x: -80, y: 0 }, { kind: '9V' });
      const reg = place(spec.type, 'IN', hole(5, 'e'));
      const r = place('resistor', '1', hole(7, 'b'), { resistance: 220 });
      const led = place('led', 'A', hole(11, 'c'), { color: 'green' });
      const mm = place('multimeter', 'COM', { x: 200, y: -40 }, { mode: 'V' });
      return {
        version: 1,
        name: 'AI 7805 regulator',
        customParts: [spec],
        components: [breadboard(), bat, reg, r, led, mm],
        wires: [
          wire([bat.id, '+'], ['bb', railId('tp', 2)], RED, [{ x: -60, y: -12 }, { x: railX(railId('tp', 2)), y: -12 }]),
          wire([bat.id, '-'], ['bb', railId('tn', 2)], BLACK, [{ x: -40, y: 30 }]),
          wire(['bb', holeId(5, 'a')], ['bb', railId('tp', 5)], RED),
          wire(['bb', holeId(6, 'a')], ['bb', railId('tn', 6)], BLACK),
          wire(['bb', holeId(12, 'b')], ['bb', railId('tn', 13)], BLACK),
          wire([mm.id, '+'], ['bb', holeId(7, 'a')], RED, [{ x: 230, y: 45 }, { x: hole(7, 'a').x, y: 45 }]),
          wire([mm.id, 'COM'], ['bb', holeId(6, 'd')], BLACK, [{ x: 200, y: 110 }, { x: hole(6, 'd').x + 4, y: 110 }, { x: hole(6, 'd').x + 4, y: 90 }]),
        ],
      };
    },
  },
  ...DEVICE_EXAMPLES.map((e) => ({ ...e, group: 'Modules & ICs' })),
  ...ADVANCED_EXAMPLES.map((e) => ({ ...e, group: 'Advanced projects' })),
  ...GATE_EXAMPLES.map((e) => ({ ...e, group: 'Logic gates' })),
];