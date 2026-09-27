/**
 * Robot-car examples: an ESP32 driving four TT gear motors through two L298N drivers, powered by two
 * 18650 cells in parallel with a TP4056 USB-C charger, a power switch and an MT3608 boost to 8.5 V
 * (the first L298N's 5 V regulator then powers the ESP32, the servo and the sensors).
 */
import type { CircuitDoc, ComponentInstance, Point, PropValue, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';

let n = 0;
const uid = (p: string) => `${p}${++n}`;

function place(type: string, pin: string, at: Point, props: Record<string, PropValue> = {}): ComponentInstance {
  const def = getDef(type)!;
  const comp: ComponentInstance = { id: uid(type.replace(/[^a-z0-9]/g, '').slice(0, 5)), type, x: 0, y: 0, rot: 0, flip: false, props: { ...def.defaultProps, ...props } };
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

const RED = '#e53935', BLACK = '#212121', ORANGE = '#fb8c00', YELLOW = '#fdd835', BLUE = '#1e88e5', GREEN = '#43a047', PURPLE = '#8e24aa', WHITE = '#eceff1', BROWN = '#8d6e63', CYAN = '#00acc1';

/** wire from a to b: down / up from a to `lane`, across, then to b (straight when lane is omitted) */
function link(a: ComponentInstance, ap: string, b: ComponentInstance, bp: string, color: string, lane?: number, laneX?: number): Wire {
  const pa = pinAt(a, ap), pb = pinAt(b, bp);
  let points: Point[] = [];
  if (lane !== undefined && laneX !== undefined) points = [{ x: pa.x, y: lane }, { x: laneX, y: lane }, { x: laneX, y: pb.y }];
  else if (lane !== undefined) points = [{ x: pa.x, y: lane }, { x: pb.x, y: lane }];
  else if (laneX !== undefined) points = [{ x: laneX, y: pa.y }, { x: laneX, y: pb.y }];
  return { id: uid('w'), a: { comp: a.id, pin: ap }, b: { comp: b.id, pin: bp }, points, color };
}

const esp32 = (code: string): ComponentInstance => ({ id: 'esp', type: 'esp32-devkit', x: 0, y: 0, rot: 0, flip: false, props: { ...getDef('esp32-devkit')!.defaultProps, code, usb: 0 } }); // runs on the car's own battery: no USB cable

// ESP32 pins used by both cars
const PINS = { L_EN: 'D25', L_A: 'D26', L_B: 'D27', R_EN: 'D33', R_A: 'D32', R_B: 'D14', VBAT: 'D34' };

/**
 * The shared chassis: battery pack + charger + switch + boost, two L298Ns and four motors, all wired
 * to the ESP32. Returns the parts, the wires and the handles the sensors attach to.
 */
function chassis(esp: ComponentInstance) {
  // two cells in parallel (1S2P), charged over USB-C by the TP4056, then switched and boosted to 8.5 V
  const c1 = place('battery-18650', 'P', { x: -330, y: 500 }, { charge: 85 });
  const c2 = place('battery-18650', 'P', { x: -230, y: 500 }, { charge: 85 });
  const chg = place('tp4056', 'BP', { x: -100, y: 450 });
  const usb = place('usbc-power', 'VOUT', { x: -120, y: 600 }, { volts: 5, plugged: 0 });
  const sw = place('rocker-switch', '1', { x: 60, y: 480 }, { on: 1 });
  const boost = place('boost-converter', 'INP', { x: 170, y: 480 }, { vset: 8.5 });
  const vs = place('voltage-sensor', 'S', { x: 370, y: 480 });
  // left driver drives both left wheels, right driver both right wheels
  const dL = place('l298n', 'ENA', { x: -360, y: 250 });
  const dR = place('l298n', 'ENA', { x: 370, y: 250 });
  const fl = place('gear-motor', 'P', { x: -570, y: 70 });
  const rl = place('gear-motor', 'P', { x: -570, y: 250 });
  const fr = place('gear-motor', 'P', { x: 610, y: 70 });
  const rr = place('gear-motor', 'P', { x: 610, y: 250 });

  const w: Wire[] = [
    // pack → charger → switch → boost → both drivers
    link(c1, 'P', chg, 'BP', RED, 440), link(c2, 'P', chg, 'BP', RED, 440),
    link(c1, 'N', chg, 'BN', BLACK, 540), link(c2, 'N', chg, 'BN', BLACK, 540),
    link(usb, 'VOUT', chg, 'INP', RED), link(usb, 'GND', chg, 'INN', BLACK),
    link(chg, 'OUTP', sw, '1', RED, 420), link(sw, '2', boost, 'INP', RED, 420), link(chg, 'OUTN', boost, 'INN', BLACK, 560),
    link(boost, 'OUTP', dL, 'V12', RED, 400), link(boost, 'OUTP', dR, 'V12', RED, 400),
    link(boost, 'OUTN', dL, 'GND', BLACK, 580), link(boost, 'OUTN', dR, 'GND', BLACK, 580),
    // battery monitor: S = pack voltage ÷ 5 into an ADC pin
    link(vs, 'VIN', chg, 'OUTP', RED, 410), link(vs, 'MINUS', boost, 'OUTN', BLACK, 570), link(vs, 'S', esp, PINS.VBAT, YELLOW, 360),
    // logic power: the left L298N's 5 V regulator feeds the ESP32
    link(dL, 'V5', esp, 'VIN', RED, 330), link(dL, 'GND', esp, 'GND1', BLACK, 340),
    // motors (the right-hand motors are mirrored, so their leads are swapped)
    link(dL, 'OUT1', fl, 'P', RED, undefined, -470), link(dL, 'OUT2', fl, 'N', BLACK, undefined, -480),
    link(dL, 'OUT3', rl, 'P', RED, 190), link(dL, 'OUT4', rl, 'N', BLACK, 200),
    link(dR, 'OUT3', fr, 'N', BLACK, undefined, 520), link(dR, 'OUT4', fr, 'P', RED, undefined, 530),
    link(dR, 'OUT1', rr, 'N', BLACK, 190), link(dR, 'OUT2', rr, 'P', RED, 200),
  ];
  // control: IN1+IN3 = direction A, IN2+IN4 = direction B, ENA+ENB = PWM speed, for each side
  const side = (d: ComponentInstance, en: string, a: string, b: string, base: number) => [
    link(esp, en, d, 'ENA', ORANGE, base), link(esp, en, d, 'ENB', ORANGE, base),
    link(esp, a, d, 'IN1', GREEN, base + 8), link(esp, a, d, 'IN3', GREEN, base + 8),
    link(esp, b, d, 'IN2', BLUE, base + 16), link(esp, b, d, 'IN4', BLUE, base + 16),
  ];
  w.push(...side(dL, PINS.L_EN, PINS.L_A, PINS.L_B, 270), ...side(dR, PINS.R_EN, PINS.R_A, PINS.R_B, 294));
  return { parts: [c1, c2, chg, usb, sw, boost, vs, dL, dR, fl, rl, fr, rr], wires: w, dL };
}

/** HC-SR04 on the 5 V rail. ECHO goes straight to the ESP32 here; on real hardware use an HC-SR04P
 * (3.3 V version) or put a 1 kΩ / 2 kΩ divider on ECHO, because a 5 V echo is too much for an ESP32 pin. */
function sonar(esp: ComponentInstance, dL: ComponentInstance, at: Point, trig: string, echo: string, dist = 60) {
  const s = place('hc-sr04', 'VCC', at, { dist });
  const wires = [
    link(s, 'VCC', dL, 'V5', RED, at.y + 30, -440), link(s, 'GND', esp, 'GND2', BLACK, at.y + 40),
    link(s, 'TRIG', esp, trig, PURPLE, at.y + 20), link(s, 'ECHO', esp, echo, WHITE, at.y + 50),
  ];
  return { parts: [s], wires, sensor: s };
}

// ---------------------------------------------------------------- sketches

const DRIVE_HELPERS = `// ---- motors: two L298Ns, one per side (IN1+IN3 / IN2+IN4 / ENA+ENB tied together)
const int L_EN = 25, L_A = 26, L_B = 27;   // left side: enable, forward (PWM), reverse (PWM)
const int R_EN = 33, R_A = 32, R_B = 14;   // right side
const int VBAT = 34;                        // voltage sensor S = battery ÷ 5
const int LED = 2;                          // on-board LED

// Soft start: drive() only sets a target; updateMotors() ramps the PWM towards it a little every
// 10 ms. Starting (or reversing) four motors at once would pull ~4 A of stall current and collapse
// the 8.5 V boost converter (2 A max) — and with it the 5 V that runs this ESP32.
const int RAMP = 10;                        // PWM steps per 10 ms
int targetL = 0, targetR = 0, speedL = 0, speedR = 0;

// ENA/ENB stay HIGH and the PWM goes on the direction pins ("slow decay"): in each off-phase both
// inputs are LOW, so the L298N shorts the motor through its low-side switches (a gentle brake)
// instead of leaving it to free-wheel through the protection diodes.
void apply(int left, int right) {           // -255 … 255, negative = reverse
  analogWrite(L_A, left > 0 ? left : 0);
  analogWrite(L_B, left < 0 ? -left : 0);
  analogWrite(R_A, right > 0 ? right : 0);
  analogWrite(R_B, right < 0 ? -right : 0);
}

int stepTowards(int now, int target) {
  if (now < target) return min(now + RAMP, target);
  if (now > target) return max(now - RAMP, target);
  return now;
}

void updateMotors() {
  static unsigned long last = 0;
  if (millis() - last < 10) return;
  last = millis();
  speedL = stepTowards(speedL, targetL);
  speedR = stepTowards(speedR, targetR);
  apply(speedL, speedR);
}

void drive(int left, int right) {
  targetL = left;
  targetR = right;
}

void stopNow() {                            // emergency stop: cut the motors at once (coasting is safe)
  targetL = targetR = speedL = speedR = 0;
  apply(0, 0);
}

// delay() that keeps the motor ramps running
void wait(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    updateMotors();
    delay(1);
  }
}

float batteryVolts() {
  return analogRead(VBAT) * 3.3 / 4095.0 * 5.0;
}

void setupMotors() {
  int pins[] = {L_EN, L_A, L_B, R_EN, R_A, R_B, LED};
  for (int i = 0; i < 7; i++) pinMode(pins[i], OUTPUT);
  digitalWrite(L_EN, HIGH);                 // both bridges enabled; speed is set on the direction pins
  digitalWrite(R_EN, HIGH);
  stopNow();
}
`;

const AVOIDER = `// Autonomous 4WD robot car (ESP32): drives forward, and when the HC-SR04 sees an obstacle
// it stops, backs up, looks left and right with the servo and turns towards the clearer side.
// Power: 2 × 18650 in parallel → TP4056 (USB-C charging) → switch → MT3608 boost to 8.5 V →
// two L298Ns; the left L298N's 5 V regulator powers the ESP32, the servo and the sensor.
// Try it: drag the HC-SR04's obstacle distance while it drives; plug in the USB-C cable to charge.
#include <Servo.h>

${DRIVE_HELPERS}
const int TRIG = 5, ECHO = 18, NECK = 19;  // HC-SR04: on a real 5 V module, divide ECHO down to 3.3 V (1 k / 2 k) or use an HC-SR04P
const int CRUISE = 180, TURN = 170;
const long STOP_CM = 25;
const float LOW_BATTERY = 3.3;              // volts per cell (the cells are in parallel)

enum Mode { CRUISING, BACKING, LOOKING, TURNING, EMPTY };
Mode mode = CRUISING;
unsigned long since = 0;
int turnDir = 1;                            // +1 = turn right, -1 = turn left
Servo neck;

long distanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us == 0 ? 400 : us / 58;
}

long lookAt(int angle) {
  neck.write(angle);
  wait(250);                                // let the servo get there
  return distanceCm();
}

void setMode(Mode m) {
  mode = m;
  since = millis();
  const char *names[] = {"cruising", "backing up", "looking", "turning", "battery empty"};
  Serial.println(names[m]);
}

void setup() {
  Serial.begin(115200);
  setupMotors();
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  neck.attach(NECK);
  neck.write(90);
  setMode(CRUISING);
}

void loop() {
  updateMotors();
  if (mode != EMPTY && batteryVolts() < LOW_BATTERY) {
    stopNow();
    setMode(EMPTY);
  }
  switch (mode) {
    case CRUISING:
      drive(CRUISE, CRUISE);
      if (distanceCm() < STOP_CM) {
        stopNow();
        setMode(BACKING);
      }
      break;
    case BACKING:
      drive(-CRUISE, -CRUISE);
      if (millis() - since > 600) {
        drive(0, 0);
        wait(250);                          // ramp down before looking around
        setMode(LOOKING);
      }
      break;
    case LOOKING: {
      long right = lookAt(30);
      long left = lookAt(150);
      neck.write(90);
      turnDir = right >= left ? 1 : -1;
      Serial.print("left ");
      Serial.print(left);
      Serial.print(" cm, right ");
      Serial.print(right);
      Serial.println(" cm");
      setMode(TURNING);
      break;
    }
    case TURNING:
      drive(TURN * turnDir, -TURN * turnDir);   // spin on the spot
      if (millis() - since > 500) {
        drive(0, 0);
        wait(250);
        setMode(CRUISING);
      }
      break;
    case EMPTY:
      digitalWrite(LED, (millis() / 250) % 2);  // blink: charge me
      if (batteryVolts() > LOW_BATTERY + 0.3) setMode(CRUISING);
      break;
  }
  wait(20);
}
`;

const FOLLOWER = `// Line-following 4WD robot car (ESP32): three TCRT5000 sensors look down at the floor
// (DO is HIGH over the black line) and steer the car to keep the line under the middle one;
// the HC-SR04 stops it when something blocks the track.
// Try it: change the sensors' "surface reflectance" (low = black line) while it drives.

${DRIVE_HELPERS}
const int S_LEFT = 4, S_MID = 15, S_RIGHT = 23;
const int TRIG = 5, ECHO = 18;             // HC-SR04 (use an HC-SR04P or an ECHO divider on real hardware)
const int BASE = 170, CORRECT = 110;
int lastSeen = 0;                           // -1 line was left, +1 right: where to search

long distanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us == 0 ? 400 : us / 58;
}

void setup() {
  Serial.begin(115200);
  setupMotors();
  pinMode(S_LEFT, INPUT);
  pinMode(S_MID, INPUT);
  pinMode(S_RIGHT, INPUT);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
}

void loop() {
  bool l = digitalRead(S_LEFT), m = digitalRead(S_MID), r = digitalRead(S_RIGHT);

  if (distanceCm() < 15) {                  // obstacle on the track: stop and wait
    stopNow();
    digitalWrite(LED, HIGH);
    wait(50);
    return;
  }
  digitalWrite(LED, LOW);

  if (m && !l && !r) drive(BASE, BASE);                      // centred
  else if (l) { drive(BASE - CORRECT, BASE); lastSeen = -1; }  // line drifting left: steer left
  else if (r) { drive(BASE, BASE - CORRECT); lastSeen = 1; }   // drifting right: steer right
  else if (m) drive(BASE, BASE);
  else drive(lastSeen <= 0 ? -140 : 140, lastSeen <= 0 ? 140 : -140);   // lost: spin to find it

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 500) {
    lastPrint = millis();
    Serial.print("sensors L M R: ");
    Serial.print(l);
    Serial.print(m);
    Serial.print(r);
    Serial.print("  battery ");
    Serial.print(batteryVolts(), 2);
    Serial.println(" V");
  }
  wait(10);
}
`;

export const ROBOT_EXAMPLES = [
  {
    id: 'robot-avoider',
    name: 'Autonomous 4WD car (ESP32, obstacle avoiding)',
    description: 'ESP32 + 2 × L298N + 4 TT motors, 2 × 18650 with a TP4056 USB-C charger, power switch and 8.5 V boost. It cruises, and when the HC-SR04 sees an obstacle it backs up, looks both ways with the servo and turns to the clearer side. Drag the obstacle distance; plug in the USB-C cable to charge.',
    build: (): CircuitDoc => {
      const esp = esp32(AVOIDER);
      const ch = chassis(esp);
      const son = sonar(esp, ch.dL, { x: -60, y: -260 }, 'D5', 'D18', 80);
      const neck = place('servo', '-', { x: 240, y: -200 });
      const wires = [...ch.wires, ...son.wires, link(neck, '-', esp, 'GND2', BROWN, -120), link(neck, '+', ch.dL, 'V5', RED, -110, -450), link(neck, 'SIG', esp, 'D19', ORANGE, -130)];
      return { version: 1, name: 'Autonomous robot car', components: [esp, ...ch.parts, ...son.parts, neck], wires };
    },
  },
  {
    id: 'robot-line',
    name: 'Line-following 4WD car (ESP32, 3 IR sensors)',
    description: 'The same ESP32 4WD chassis (2 × L298N, 2 × 18650 + TP4056 charger, 8.5 V boost) following a black line with three TCRT5000 sensors, and stopping for obstacles with an HC-SR04. Lower a sensor’s surface reflectance to put the line under it.',
    build: (): CircuitDoc => {
      const esp = esp32(FOLLOWER);
      const ch = chassis(esp);
      const son = sonar(esp, ch.dL, { x: -60, y: -260 }, 'D5', 'D18', 100);
      // left, middle, right line sensors (middle one over the black line)
      const sens = [['D4', 90], ['D15', 10], ['D23', 90]].map(([pin, refl], i) => ({ pin: pin as string, s: place('line-tracker', 'VCC', { x: 200 + i * 70, y: -140 }, { refl: refl as number }) }));
      const wires = [...ch.wires, ...son.wires];
      sens.forEach(({ pin, s }, i) => {
        wires.push(link(s, 'VCC', esp, '3V3', RED, -100 + i * 4), link(s, 'GND', esp, 'GND2', BLACK, -80 + i * 4), link(s, 'DO', esp, pin, [CYAN, GREEN, PURPLE][i], -60 + i * 6));
      });
      return { version: 1, name: 'Line-following robot car', components: [esp, ...ch.parts, ...son.parts, ...sens.map((x) => x.s)], wires };
    },
  },
];
