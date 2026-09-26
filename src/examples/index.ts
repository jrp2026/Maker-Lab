import type { CircuitDoc, ComponentInstance, Point, PropValue, Rotation, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';

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
];
