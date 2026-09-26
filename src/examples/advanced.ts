/** Bigger, multi-part projects: state machines, multiplexing, control loops, and two logic circuits with no code at all. */
import type { CircuitDoc, ComponentInstance, Point, PropValue, Rotation, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { localToWorld } from '../model/geometry';

let n = 0;
const uid = (p: string) => `${p}${++n}`;

/** Place a part so that `pin` lands on `at`. */
function place(type: string, pin: string, at: Point, props: Record<string, PropValue> = {}, rot: Rotation = 0): ComponentInstance {
  const def = getDef(type)!;
  const comp: ComponentInstance = { id: uid(type.replace(/[^a-z0-9]/g, '').slice(0, 4)), type, x: 0, y: 0, rot, flip: false, props: { ...def.defaultProps, ...props } };
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

const RED = '#e53935', BLACK = '#212121', GREEN = '#43a047', BLUE = '#1e88e5', ORANGE = '#fb8c00', YELLOW = '#fdd835', PURPLE = '#8e24aa', WHITE = '#eceff1', BROWN = '#8d6e63';

/** Wire routed through a horizontal lane at `laneY` (straight when omitted). */
function link(a: ComponentInstance, ap: string, b: ComponentInstance, bp: string, color: string, laneY?: number): Wire {
  const pa = pinAt(a, ap), pb = pinAt(b, bp);
  const points = laneY === undefined ? [] : [{ x: pa.x, y: laneY }, { x: pb.x, y: laneY }];
  return { id: uid('w'), a: { comp: a.id, pin: ap }, b: { comp: b.id, pin: bp }, points, color };
}

const uno = (code: string): ComponentInstance => ({ id: 'uno', type: 'arduino-uno', x: 0, y: 0, rot: 0, flip: false, props: { ...getDef('arduino-uno')!.defaultProps, code } });
const doc = (name: string, components: ComponentInstance[], wires: Wire[]): CircuitDoc => ({ version: 1, name, components, wires });
/** I2C module (GND VCC SDA SCL or GND VCC SCL SDA) to the Uno */
const i2c = (u: ComponentInstance, m: ComponentInstance, base: number): Wire[] => [
  link(m, 'GND', u, 'GND3', BLACK, base), link(m, 'VCC', u, '5V', RED, 262), link(m, 'SDA', u, 'SDA', BLUE, base - 8), link(m, 'SCL', u, 'SCL', YELLOW, base - 16),
];

// ---------------------------------------------------------------- sketches

const THERMOSTAT = `// Thermostat with hysteresis.
// TMP36 on A0, setpoint buttons on D2 (up) and D3 (down),
// relay module on D7 (active LOW) switches a 5 V heating pad.
// Change the TMP36 temperature in the inspector while it runs.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int SENSOR = A0, UP = 2, DOWN = 3, RELAY = 7;
const float HYSTERESIS = 0.5;     // switch at setpoint ± 0.5 °C so the relay doesn't chatter

float setpoint = 22.0;
bool heating = false;
unsigned long lastButton = 0, lastShow = 0;

float readTemp() {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(SENSOR);   // average out noise
  float volts = sum / 8.0 * 5.0 / 1023.0;
  return (volts - 0.5) * 100.0;                              // TMP36: 0.5 V at 0 °C, 10 mV/°C
}

void setup() {
  pinMode(UP, INPUT_PULLUP);
  pinMode(DOWN, INPUT_PULLUP);
  pinMode(RELAY, OUTPUT);
  digitalWrite(RELAY, HIGH);      // relay off
  lcd.init();
  lcd.backlight();
  Serial.begin(9600);
}

void loop() {
  if (millis() - lastButton > 200) {
    if (digitalRead(UP) == LOW)   { setpoint += 0.5; lastButton = millis(); }
    if (digitalRead(DOWN) == LOW) { setpoint -= 0.5; lastButton = millis(); }
  }

  float t = readTemp();
  if (!heating && t < setpoint - HYSTERESIS) heating = true;
  if (heating && t > setpoint + HYSTERESIS) heating = false;
  digitalWrite(RELAY, heating ? LOW : HIGH);

  if (millis() - lastShow > 250) {
    lastShow = millis();
    lcd.setCursor(0, 0);
    lcd.print("Temp ");
    lcd.print(t, 1);
    lcd.print((char)223);
    lcd.print("C    ");
    lcd.setCursor(0, 1);
    lcd.print("Set  ");
    lcd.print(setpoint, 1);
    lcd.print(heating ? "  HEAT" : "   off");
    Serial.print(t);
    Serial.print(" C, set ");
    Serial.println(setpoint);
  }
}
`;

const INTERSECTION = `// Two-way traffic intersection with a pedestrian button.
// North-south lights on D8-D10, east-west on D11-D13 (R, Y, G),
// crossing button on D2 (interrupt), beeper on D4.
enum Phase { NS_GREEN, NS_YELLOW, ALL_RED_1, EW_GREEN, EW_YELLOW, ALL_RED_2, WALK };
struct Light { int red; int yellow; int green; };

const Light NS = {8, 9, 10};
const Light EW = {11, 12, 13};
const int BUTTON = 2, BUZZER = 4;
const unsigned long DURATION[] = {4000, 1200, 800, 4000, 1200, 800, 3000};

Phase phase = NS_GREEN;
Phase afterWalk = EW_GREEN;
unsigned long phaseStart = 0;
volatile bool walkRequest = false;

void requestWalk() { walkRequest = true; }

void setLight(const Light &l, int r, int y, int g) {
  digitalWrite(l.red, r);
  digitalWrite(l.yellow, y);
  digitalWrite(l.green, g);
}

void enter(Phase p) {
  phase = p;
  phaseStart = millis();
  switch (p) {
    case NS_GREEN:  setLight(NS, 0, 0, 1); setLight(EW, 1, 0, 0); break;
    case NS_YELLOW: setLight(NS, 0, 1, 0); break;
    case EW_GREEN:  setLight(NS, 1, 0, 0); setLight(EW, 0, 0, 1); break;
    case EW_YELLOW: setLight(EW, 0, 1, 0); break;
    default:        setLight(NS, 1, 0, 0); setLight(EW, 1, 0, 0); break;   // all red
  }
  Serial.print("phase ");
  Serial.println(p);
}

// after an all-red phase: serve a waiting pedestrian first
void next(Phase normal) {
  if (walkRequest) {
    walkRequest = false;
    afterWalk = normal;
    enter(WALK);
  } else {
    enter(normal);
  }
}

void setup() {
  for (int pin = 8; pin <= 13; pin++) pinMode(pin, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON), requestWalk, FALLING);
  Serial.begin(9600);
  enter(NS_GREEN);
}

void loop() {
  unsigned long t = millis() - phaseStart;
  if (phase == WALK) digitalWrite(BUZZER, (t / 250) % 2);   // beep while it is safe to cross
  if (t < DURATION[phase]) return;
  digitalWrite(BUZZER, LOW);
  switch (phase) {
    case NS_GREEN:  enter(NS_YELLOW); break;
    case NS_YELLOW: enter(ALL_RED_1); break;
    case ALL_RED_1: next(EW_GREEN); break;
    case EW_GREEN:  enter(EW_YELLOW); break;
    case EW_YELLOW: enter(ALL_RED_2); break;
    case ALL_RED_2: next(NS_GREEN); break;
    case WALK:      enter(afterWalk); break;
  }
}
`;

const PLANT = `// Automatic plant waterer.
// Capacitive soil sensor on A0, pump switched by a MOSFET module on D5,
// status on an SSD1306 OLED. Change the soil moisture in the inspector.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);
const int SENSOR = A0, PUMP = 5;
const int DRY = 593, WET = 266;                  // raw readings in air and in water: calibrate yours
const int START_BELOW = 35, STOP_ABOVE = 60;     // % moisture
const unsigned long MAX_PUMP = 4000, SOAK = 6000; // never pump longer than 4 s, then let it soak in

enum Mode { WATCHING, WATERING, SOAKING };
Mode mode = WATCHING;
unsigned long since = 0;
int waterings = 0;

int moisture() {
  int raw = analogRead(SENSOR);
  return constrain(map(raw, DRY, WET, 0, 100), 0, 100);
}

void setup() {
  pinMode(PUMP, OUTPUT);
  Serial.begin(9600);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  int m = moisture();
  switch (mode) {
    case WATCHING:
      if (m < START_BELOW) { mode = WATERING; since = millis(); waterings++; Serial.println("watering"); }
      break;
    case WATERING:
      if (m >= STOP_ABOVE || millis() - since > MAX_PUMP) { mode = SOAKING; since = millis(); Serial.println("soaking"); }
      break;
    case SOAKING:
      if (millis() - since > SOAK) mode = WATCHING;
      break;
  }
  digitalWrite(PUMP, mode == WATERING ? HIGH : LOW);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.print(m);
  display.print("%");
  display.setTextSize(1);
  display.setCursor(64, 4);
  display.print(mode == WATERING ? "PUMP ON" : (mode == SOAKING ? "soaking" : "ok"));
  display.drawRect(0, 22, 128, 12, SSD1306_WHITE);
  display.fillRect(2, 24, m * 124 / 100, 8, SSD1306_WHITE);
  display.setCursor(0, 44);
  display.print("Waterings: ");
  display.print(waterings);
  display.display();
  delay(100);
}
`;

const STOPWATCH = `// Stopwatch on a multiplexed 4-digit display (common cathode).
// Segments a-g and dp on D2-D9 through 1 kΩ resistors, digit cathodes on D10-D13.
// Only one digit is lit at a time, 2 ms each - fast enough that all four look lit.
// Start/stop button on A0, reset (while stopped) on A1.
const int SEG[8] = {2, 3, 4, 5, 6, 7, 8, 9};           // a b c d e f g dp
const int DIGIT[4] = {10, 11, 12, 13};
const byte FONT[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
const int START = A0, RESET = A1;

bool running = true, wasDown = false;
unsigned long elapsed = 0, startedAt = 0;

void showDigit(int pos, int value, bool dot) {
  for (int d = 0; d < 4; d++) digitalWrite(DIGIT[d], HIGH);   // all digits off while we switch
  for (int s = 0; s < 7; s++) digitalWrite(SEG[s], bitRead(FONT[value], s));
  digitalWrite(SEG[7], dot ? HIGH : LOW);
  digitalWrite(DIGIT[pos], LOW);                                // sink this digit's cathode
  delay(2);
}

void setup() {
  for (int i = 0; i < 8; i++) pinMode(SEG[i], OUTPUT);
  for (int i = 0; i < 4; i++) { pinMode(DIGIT[i], OUTPUT); digitalWrite(DIGIT[i], HIGH); }
  pinMode(START, INPUT_PULLUP);
  pinMode(RESET, INPUT_PULLUP);
  startedAt = millis();
}

void loop() {
  bool down = digitalRead(START) == LOW;
  if (down && !wasDown) {
    if (running) elapsed += millis() - startedAt;
    else startedAt = millis();
    running = !running;
  }
  wasDown = down;
  if (!running && digitalRead(RESET) == LOW) elapsed = 0;

  unsigned long t = elapsed + (running ? millis() - startedAt : 0);
  unsigned long cs = (t / 10) % 10000;   // centiseconds, shown as SS.cc
  showDigit(0, cs / 1000, false);
  showDigit(1, (cs / 100) % 10, true);
  showDigit(2, (cs / 10) % 10, false);
  showDigit(3, cs % 10, false);
}
`;

const LOCK = `// Keypad door lock: type the code, then # to open, * to clear.
// 4x4 keypad on D9-D2, servo bolt on D10, piezo on D11, I2C LCD.
// Pick a key in the keypad's inspector and press the keypad to type it.
#include <Keypad.h>
#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
byte rowPins[ROWS] = {9, 8, 7, 6};
byte colPins[COLS] = {5, 4, 3, 2};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);
Servo bolt;
LiquidCrystal_I2C lcd(0x27, 16, 2);

const String SECRET = "1234";
const int BUZZER = 11;
String entered = "";
int failures = 0;
unsigned long lockedUntil = 0, openedAt = 0;
bool open = false;

void prompt() {
  lcd.clear();
  lcd.print("Enter code:");
  lcd.setCursor(0, 1);
}

void setup() {
  bolt.attach(10);
  bolt.write(0);
  lcd.init();
  lcd.backlight();
  prompt();
}

void loop() {
  if (open && millis() - openedAt > 5000) {       // re-lock after 5 s
    open = false;
    bolt.write(0);
    prompt();
  }
  if (millis() < lockedUntil) return;              // too many wrong tries: ignore the keypad

  char k = keypad.getKey();
  if (!k) return;
  tone(BUZZER, 1800, 40);                          // key click
  if (k == '*') { entered = ""; prompt(); return; }
  if (k != '#') {
    if (entered.length() < 8) { entered += k; lcd.print('*'); }
    return;
  }
  lcd.clear();
  if (entered == SECRET) {
    lcd.print("Unlocked!");
    bolt.write(90);
    open = true;
    openedAt = millis();
    failures = 0;
    tone(BUZZER, 2600, 300);
  } else {
    failures++;
    lcd.print("Wrong code (");
    lcd.print(failures);
    lcd.print(")");
    tone(BUZZER, 300, 600);
    if (failures >= 3) {
      lockedUntil = millis() + 10000;
      lcd.setCursor(0, 1);
      lcd.print("Wait 10 s...");
      failures = 0;
    }
    delay(1200);
    prompt();
  }
  entered = "";
}
`;

const FAN = `// Temperature-controlled fan (proportional PWM).
// KY-013 NTC module on A0, 2N7000 MOSFET gate on D9 switches a 5 V fan.
// Below 28 °C the fan is off; from 28 to 40 °C it ramps from 30 % to 100 %.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int SENSOR = A0, FAN = 9;
const float T_MIN = 28.0, T_MAX = 40.0;

float readCelsius() {
  int adc = analogRead(SENSOR);
  float r = 10000.0 * adc / (1023.0 - adc);          // NTC from S to GND, 10 kΩ from S to +5 V
  float kelvin = 1.0 / (1.0 / 298.15 + log(r / 10000.0) / 3950.0);   // beta equation, B = 3950
  return kelvin - 273.15;
}

void setup() {
  pinMode(FAN, OUTPUT);
  lcd.init();
  lcd.backlight();
}

void loop() {
  float t = readCelsius();
  int duty = 0;
  if (t >= T_MIN) duty = 77 + (int)((t - T_MIN) / (T_MAX - T_MIN) * 178);
  duty = constrain(duty, 0, 255);
  analogWrite(FAN, duty);

  lcd.setCursor(0, 0);
  lcd.print("Temp ");
  lcd.print(t, 1);
  lcd.print((char)223);
  lcd.print("C   ");
  lcd.setCursor(0, 1);
  lcd.print("Fan  ");
  lcd.print(duty * 100 / 255);
  lcd.print(" %    ");
  delay(200);
}
`;

const TRACKER = `// Light-seeking servo (a one-axis solar tracker).
// Two LDR modules on A0 (left) and A1 (right), servo on D9.
// Make one side darker in the inspector and watch the servo turn towards the light.
#include <Servo.h>

Servo tracker;
const int LEFT = A0, RIGHT = A1;
const int DEADBAND = 25;     // ignore small differences so it doesn't hunt back and forth
int angle = 90;

void setup() {
  tracker.attach(9);
  tracker.write(angle);
  Serial.begin(9600);
}

void loop() {
  int left = analogRead(LEFT);     // the module's AO rises as it gets darker
  int right = analogRead(RIGHT);
  int diff = left - right;
  if (diff > DEADBAND) angle++;          // left side darker: turn right
  else if (diff < -DEADBAND) angle--;
  angle = constrain(angle, 0, 180);
  tracker.write(angle);
  if (millis() % 500 < 20) {
    Serial.print("L ");
    Serial.print(left);
    Serial.print("  R ");
    Serial.print(right);
    Serial.print("  angle ");
    Serial.println(angle);
  }
  delay(20);
}
`;

const REACTION = `// Reaction-time game with a high score kept in EEPROM.
// Button on D2, RGB LED on D9/D10/D11, piezo on D8, I2C LCD.
// Press to start, wait for green, then press as fast as you can.
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int BUTTON = 2, BUZZER = 8, RED_PIN = 9, GREEN_PIN = 10, BLUE_PIN = 11;
enum State { READY, WAITING, GO, RESULT };
State state = READY;
unsigned long goAt = 0, shownAt = 0;
unsigned long best = 0;
bool wasDown = true;               // a press only counts after a release (ignores a button held at reset)

void rgb(int r, int g, int b) {
  analogWrite(RED_PIN, r);
  analogWrite(GREEN_PIN, g);
  analogWrite(BLUE_PIN, b);
}

bool pressed() {                    // true once per press
  bool down = digitalRead(BUTTON) == LOW;
  bool edge = down && !wasDown;
  wasDown = down;
  return edge;
}

void show(const char *top, unsigned long value) {
  lcd.clear();
  lcd.print(top);
  lcd.setCursor(0, 1);
  if (value > 0) { lcd.print(value); lcd.print(" ms  "); }
  lcd.print("best ");
  if (best > 0) lcd.print(best); else lcd.print("-");
}

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  lcd.init();
  lcd.backlight();
  EEPROM.get(0, best);
  if (best == 0xFFFFFFFF) best = 0;   // blank EEPROM
  randomSeed(analogRead(A0));
  rgb(0, 0, 80);
  show("Press to start", 0);
}

void loop() {
  switch (state) {
    case READY:
      if (pressed()) {
        state = WAITING;
        goAt = millis() + random(1500, 4000);
        rgb(120, 0, 0);
        lcd.clear();
        lcd.print("Wait for green..");
      }
      break;
    case WAITING:
      if (pressed()) {                       // jumped the gun
        tone(BUZZER, 200, 400);
        rgb(120, 40, 0);
        show("Too soon!", 0);
        state = RESULT;
        shownAt = millis();
      } else if (millis() >= goAt) {
        rgb(0, 160, 0);
        tone(BUZZER, 2000, 80);
        goAt = millis();
        state = GO;
      }
      break;
    case GO:
      if (pressed()) {
        unsigned long t = millis() - goAt;
        if (best == 0 || t < best) {
          best = t;
          EEPROM.put(0, best);
          show("New record!", t);
        } else {
          show("Your time:", t);
        }
        rgb(0, 0, 80);
        state = RESULT;
        shownAt = millis();
      }
      break;
    case RESULT:
      pressed();
      if (millis() - shownAt > 2500) { state = READY; show("Press to start", 0); }
      break;
  }
}
`;

// ---------------------------------------------------------------- circuits

export const ADVANCED_EXAMPLES = [
  {
    id: 'thermostat',
    name: 'Thermostat (relay + heater + LCD)',
    description: 'A TMP36, two setpoint buttons and a relay that switches a heating pad with hysteresis. Lower the TMP36 temperature in the inspector to make it heat.',
    build: (): CircuitDoc => {
      const u = uno(THERMOSTAT);
      const t = place('tmp36', 'VS', { x: 300, y: 290 });
      const lcd = place('lcd-i2c', 'GND', { x: 360, y: -110 });
      const up = place('pushbutton', '1a', { x: 90, y: -120 }, { cap: '#22c55e' });
      const dn = place('pushbutton', '1a', { x: 170, y: -120 }, { cap: '#ef4444' });
      const relay = place('relay-module', 'GND', { x: 470, y: 150 });
      const jack = place('barrel-jack', 'TIP', { x: 640, y: 60 }, { volts: 5 });
      const heat = place('heater-pad', 'P', { x: 600, y: 310 });
      return doc('Thermostat', [u, t, lcd, up, dn, relay, jack, heat], [
        link(t, 'VS', u, '5V', RED, 250), link(t, 'VOUT', u, 'A0', YELLOW, 242), link(t, 'GND', u, 'GND2', BLACK, 270),
        ...i2c(u, lcd, -20),
        link(up, '1a', u, 'D2', BLUE, -50), link(up, '2a', u, 'GND3', BLACK, -60),
        link(dn, '1a', u, 'D3', PURPLE, -70), link(dn, '2a', u, 'GND3', BLACK, -80),
        link(relay, 'GND', u, 'GND1', BLACK, 278), link(relay, 'VCC', u, '5V', RED, 286), link(relay, 'IN', u, 'D7', ORANGE, -44),
        link(jack, 'TIP', relay, 'COM', RED, 110), link(relay, 'NO', heat, 'P', ORANGE, 230), link(heat, 'N', jack, 'SLV', BLACK, 340),
      ]);
    },
  },
  {
    id: 'intersection',
    name: 'Traffic intersection + crossing button',
    description: 'Two sets of traffic lights run by a millis() state machine (enum + switch). The crossing button is an interrupt; the next all-red phase becomes a beeping WALK phase.',
    build: (): CircuitDoc => {
      const u = uno(INTERSECTION);
      const ns = place('traffic-light', 'GND', { x: 340, y: -40 });
      const ew = place('traffic-light', 'GND', { x: 420, y: -40 });
      const btn = place('pushbutton', '1a', { x: 200, y: -150 }, { cap: '#f59e0b' });
      const bz = place('active-buzzer', 'P', { x: 110, y: -150 });
      return doc('Traffic intersection', [u, ns, ew, btn, bz], [
        link(ns, 'GND', u, 'GND3', BLACK, -12), link(ns, 'R', u, 'D8', RED, -18), link(ns, 'Y', u, 'D9', YELLOW, -24), link(ns, 'G', u, 'D10', GREEN, -30),
        link(ew, 'GND', u, 'GND3', BLACK, -36), link(ew, 'R', u, 'D11', RED, -42), link(ew, 'Y', u, 'D12', YELLOW, -48), link(ew, 'G', u, 'D13', GREEN, -54),
        link(btn, '1a', u, 'D2', BLUE, -70), link(btn, '2a', u, 'GND3', BLACK, -78),
        link(bz, 'P', u, 'D4', PURPLE, -86), link(bz, 'N', u, 'GND3', BLACK, -94),
      ]);
    },
  },
  {
    id: 'plant',
    name: 'Automatic plant waterer (OLED)',
    description: 'A capacitive soil sensor, a MOSFET-switched pump on its own battery and an OLED status screen. A 3-state machine waters, then lets the water soak in before checking again.',
    build: (): CircuitDoc => {
      const u = uno(PLANT);
      const soil = place('capacitive-soil', 'GND', { x: 300, y: 300 });
      const oled = place('oled-128x64', 'GND', { x: 360, y: -100 });
      const sw = place('mosfet-switch', 'SIG', { x: 500, y: 200 });
      const bat = place('battery-holder', 'P', { x: 440, y: 20 });
      const pump = place('water-pump', 'P', { x: 560, y: 20 });
      return doc('Plant waterer', [u, soil, oled, sw, bat, pump], [
        link(soil, 'GND', u, 'GND2', BLACK, 250), link(soil, 'VCC', u, '5V', RED, 242), link(soil, 'AO', u, 'A0', YELLOW, 234),
        ...i2c(u, oled, -20),
        link(sw, 'SIG', u, 'D5', ORANGE, -44), link(sw, 'VCC', u, '5V', RED, 262), link(sw, 'GND', u, 'GND1', BLACK, 270),
        link(bat, 'P', sw, 'VIN', RED, 60), link(bat, 'N', sw, 'GNDP', BLACK, 70),
        link(pump, 'P', sw, 'LP', RED, 80), link(pump, 'N', sw, 'LN', BLACK, 90),
      ]);
    },
  },
  {
    id: 'stopwatch',
    name: 'Stopwatch (multiplexed 4-digit display)',
    description: 'Drives a 4-digit seven-segment display with 12 pins: only one digit is on at a time, switching every 2 ms. Buttons start/stop and reset; the time shows as SS.cc.',
    build: (): CircuitDoc => {
      const u = uno(STOPWATCH);
      const disp = place('seven-seg-4digit', 'D1', { x: 420, y: 60 });
      const segPins = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
      const res = segPins.map((_, i) => place('resistor', '1', { x: 330 + i * 20, y: -150 }, { resistance: 1000 }, 1));
      const start = place('pushbutton', '1a', { x: 300, y: 330 }, { cap: '#22c55e' });
      const reset = place('pushbutton', '1a', { x: 380, y: 330 }, { cap: '#ef4444' });
      const wires: Wire[] = [];
      segPins.forEach((s, i) => {
        wires.push(link(u, `D${2 + i}`, res[i], '1', [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE, BROWN, WHITE][i], -20 - i * 6 - 60));
        // down from the resistor, then across to the display pin (top pins above it, bottom pins below it)
        const p = pinAt(disp, s);
        wires.push(link(res[i], '2', disp, s, [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE, BROWN, WHITE][i], p.y === pinAt(disp, 'D1').y ? -60 + i * 4 : 140 + i * 6));
      });
      ['D1', 'D2', 'D3', 'D4'].forEach((d, i) => wires.push(link(u, `D${10 + i}`, disp, d, BLACK, pinAt(disp, d).y === pinAt(disp, 'D1').y ? -20 - i * 5 : 180 + i * 5)));
      wires.push(link(start, '1a', u, 'A0', BLUE, 250), link(start, '2a', u, 'GND2', BLACK, 290), link(reset, '1a', u, 'A1', PURPLE, 258), link(reset, '2a', u, 'GND2', BLACK, 298));
      return doc('Stopwatch', [u, disp, ...res, start, reset], wires);
    },
  },
  {
    id: 'keypad-lock',
    name: 'Keypad door lock (servo + LCD)',
    description: 'Type 1234 then # on the 4×4 keypad to swing the servo bolt open for 5 s. Wrong codes beep; three in a row lock the keypad for 10 s. Uses Keypad, Servo, String and an I2C LCD.',
    build: (): CircuitDoc => {
      const u = uno(LOCK);
      const kp = place('keypad', 'R1', { x: 340, y: 60 });
      const sv = place('servo', '-', { x: 120, y: -140 });
      const pz = place('piezo', '+', { x: 40, y: -140 });
      const lcd = place('lcd-i2c', 'GND', { x: 300, y: 330 });
      const rows = ['R1', 'R2', 'R3', 'R4'], cols = ['C1', 'C2', 'C3', 'C4'];
      return doc('Keypad lock', [u, kp, sv, pz, lcd], [
        ...rows.map((r, i) => link(kp, r, u, `D${9 - i}`, [RED, ORANGE, YELLOW, GREEN][i], -14 - i * 6)),
        ...cols.map((c, i) => link(kp, c, u, `D${5 - i}`, [BLUE, PURPLE, BROWN, WHITE][i], -38 - i * 6)),
        link(sv, '-', u, 'GND3', BROWN, -70), link(sv, '+', u, '5V', RED, 282), link(sv, 'SIG', u, 'D10', ORANGE, -78),
        link(pz, '+', u, 'D11', GREEN, -86), link(pz, '-', u, 'GND3', BLACK, -94),
        link(lcd, 'GND', u, 'GND1', BLACK, 240), link(lcd, 'VCC', u, '5V', RED, 248), link(lcd, 'SDA', u, 'A4', BLUE, 256), link(lcd, 'SCL', u, 'A5', YELLOW, 264),
      ]);
    },
  },
  {
    id: 'fan-control',
    name: 'Temperature-controlled fan (PWM)',
    description: 'Reads an NTC with the beta equation and drives a fan through a 2N7000 with PWM: off below 28 °C, ramping to full speed at 40 °C. Raise the module’s temperature in the inspector.',
    build: (): CircuitDoc => {
      const u = uno(FAN);
      const ntc = place('ntc-module', 'S', { x: 300, y: 300 });
      const lcd = place('lcd-i2c', 'GND', { x: 360, y: -110 });
      const q = place('2n7000', 'S', { x: 470, y: 150 });
      const rg = place('resistor', '1', { x: 380, y: 60 }, { resistance: 100 });
      const rpd = place('resistor', '1', { x: 440, y: 230 }, { resistance: 100000 }, 1);
      const fan = place('dc-fan', 'P', { x: 560, y: 60 });
      const d = place('diode', 'A', { x: 600, y: 120 }, { model: '1N4148' });
      return doc('Fan controller', [u, ntc, lcd, q, rg, rpd, fan, d], [
        link(ntc, 'S', u, 'A0', YELLOW, 240), link(ntc, 'VCC', u, '5V', RED, 250), link(ntc, 'GND', u, 'GND2', BLACK, 260),
        ...i2c(u, lcd, -20),
        link(u, 'D9', rg, '1', ORANGE, -44), link(rg, '2', q, 'G', ORANGE, 100), link(q, 'G', rpd, '1', ORANGE, 190), link(rpd, '2', q, 'S', BLACK, 290), link(q, 'S', u, 'GND1', BLACK, 300),
        link(fan, 'P', u, '5V', RED, 310), link(fan, 'N', q, 'D', PURPLE, 120),
        link(d, 'A', fan, 'N', PURPLE, 100), link(d, 'K', fan, 'P', RED, 40),
      ]);
    },
  },
  {
    id: 'solar-tracker',
    name: 'Solar tracker (2 LDRs + servo)',
    description: 'Compares two light sensors and nudges a servo towards the brighter side, with a deadband so it doesn’t hunt. Darken one LDR module in the inspector and watch it turn.',
    build: (): CircuitDoc => {
      const u = uno(TRACKER);
      const left = place('ldr-module', 'VCC', { x: 280, y: 320 });
      const right = place('ldr-module', 'VCC', { x: 380, y: 320 });
      const sv = place('servo', '-', { x: 400, y: -60 });
      return doc('Solar tracker', [u, left, right, sv], [
        link(left, 'VCC', u, '5V', RED, 240), link(left, 'GND', u, 'GND2', BLACK, 250), link(left, 'AO', u, 'A0', YELLOW, 260),
        link(right, 'VCC', u, '5V', RED, 270), link(right, 'GND', u, 'GND2', BLACK, 280), link(right, 'AO', u, 'A1', ORANGE, 290),
        link(sv, '-', u, 'GND3', BROWN, -20), link(sv, '+', u, '5V', RED, 300), link(sv, 'SIG', u, 'D9', ORANGE, -30),
      ]);
    },
  },
  {
    id: 'reaction',
    name: 'Reaction-time game (EEPROM high score)',
    description: 'Press to start, wait for green, press again as fast as you can. Jumping the gun is caught; the best time is saved in EEPROM. RGB LED via PWM, sounds via tone(), a 4-state machine.',
    build: (): CircuitDoc => {
      const u = uno(REACTION);
      const btn = place('pushbutton', '1a', { x: 330, y: -130 }, { cap: '#3b82f6' });
      const led = place('rgb-led', 'R', { x: 190, y: -150 });
      const rs = ['R', 'G', 'B'].map((_, i) => place('resistor', '1', { x: 120 + i * 20, y: -120 }, { resistance: 220 }, 1));
      const pz = place('piezo', '+', { x: 40, y: -150 });
      const lcd = place('lcd-i2c', 'GND', { x: 330, y: 330 });
      return doc('Reaction game', [u, btn, led, ...rs, pz, lcd], [
        link(btn, '1a', u, 'D2', BLUE, -60), link(btn, '2a', u, 'GND3', BLACK, -68),
        link(u, 'D9', rs[0], '2', RED, -20), link(u, 'D10', rs[1], '2', GREEN, -28), link(u, 'D11', rs[2], '2', BLUE, -36),
        link(rs[0], '1', led, 'R', RED, -165), link(rs[1], '1', led, 'G', GREEN, -172), link(rs[2], '1', led, 'B', BLUE, -179), link(led, 'COM', u, 'GND3', BLACK, -44),
        link(pz, '+', u, 'D8', ORANGE, -52), link(pz, '-', u, 'GND3', BLACK, -76),
        link(lcd, 'GND', u, 'GND1', BLACK, 240), link(lcd, 'VCC', u, '5V', RED, 248), link(lcd, 'SDA', u, 'A4', BLUE, 256), link(lcd, 'SCL', u, 'A5', YELLOW, 264),
      ]);
    },
  },
  {
    id: 'binary-adder',
    name: 'Binary adder with DIP switches (no code)',
    description: 'Pure logic: DIP switches 1–4 set A, 5–8 set B, and a 74HC283 adds them — the LEDs show the 4-bit sum and the carry. 5 + 6 = 11 = 1011 to start; flip switches in the inspector.',
    build: (): CircuitDoc => {
      const p = place('usb-breakout', 'VBUS', { x: -120, y: -80 });
      const sw = place('dip-switch', '1', { x: 0, y: -40 }, { s1: 1, s3: 1, s6: 1, s7: 1 });
      const add = place('74hc283', 'VCC', { x: 200, y: 120 });
      // 10 kΩ pull-downs so an open switch reads 0
      const pd = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => place('resistor', '1', { x: (i - 1) * 10, y: 30 }, { resistance: 10000 }, 1));
      const ins = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
      const outs = ['S1', 'S2', 'S3', 'S4', 'CO'];
      const res = outs.map((_, i) => place('resistor', '1', { x: 380, y: -60 + i * 40 }, { resistance: 330 }));
      const leds = outs.map((_, i) => place('led', 'A', { x: 440, y: -60 + i * 40 }, { color: i === 4 ? 'yellow' : 'red' }));
      const wires: Wire[] = [
        link(p, 'VBUS', add, 'VCC', RED, -110), link(p, 'GND', add, 'GND', BLACK, 250), link(add, 'CI', add, 'GND', BLACK, 170),
      ];
      ins.forEach((pin, i) => {
        wires.push(link(p, 'VBUS', sw, String(i + 1), RED, -100));
        wires.push(link(sw, `${i + 1}b`, pd[i], '1', ORANGE));
        wires.push(link(pd[i], '1', add, pin, i < 4 ? BLUE : GREEN, 80 + i * 6 + (pinAt(add, pin).y === pinAt(add, 'VCC').y ? -30 : 0)));
        wires.push(link(pd[i], '2', p, 'GND', BLACK, 230));
      });
      outs.forEach((pin, i) => {
        wires.push(link(add, pin, res[i], '1', YELLOW, pinAt(add, pin).y === pinAt(add, 'VCC').y ? 60 - i * 6 : 190 + i * 6));
        wires.push(link(res[i], '2', leds[i], 'A', YELLOW), link(leds[i], 'K', p, 'GND', BLACK, 240 + i * 2));
      });
      return doc('Binary adder', [p, sw, add, ...pd, ...res, ...leds], wires);
    },
  },
  {
    id: 'decade-counter',
    name: 'Decimal counter: 555 → 74HC393 → CD4511 (no code)',
    description: 'A 555 clock (~2 Hz: 1 kΩ, 68 kΩ, 4.7 µF) drives a binary counter; an AND gate resets it at 10, and a CD4511 decodes the count onto a seven-segment digit. Four chips, zero lines of code.',
    build: (): CircuitDoc => {
      const p = place('usb-breakout', 'VBUS', { x: -160, y: -80 });
      const t = place('ne555', 'VCC', { x: 0, y: 40 });
      const r1 = place('resistor', '1', { x: -60, y: -40 }, { resistance: 1000 });
      const r2 = place('resistor', '1', { x: 10, y: -40 }, { resistance: 68000 });
      const c = place('electrolytic', '+', { x: -60, y: 150 }, { capacitance: 4.7e-6 });
      const ctr = place('74hc393', 'VCC', { x: 140, y: 40 });
      const and = place('74hc08', 'VCC', { x: 140, y: 170 });
      const dec = place('cd4511', 'VCC', { x: 300, y: 40 });
      const disp = place('seven-seg-cc', 'G', { x: 520, y: 20 });
      const segs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const sr = segs.map((_, i) => place('resistor', '1', { x: 420 + i * 10, y: -110 }, { resistance: 470 }, 1));
      const V = (x: ComponentInstance, pin: string, lane: number) => link(p, 'VBUS', x, pin, RED, lane);
      const G = (x: ComponentInstance, pin: string, lane: number) => link(p, 'GND', x, pin, BLACK, lane);
      const wires: Wire[] = [
        // 555 astable: f ≈ 1.44 / ((R1 + 2 R2) C) ≈ 2.2 Hz
        V(t, 'VCC', -70), V(t, 'RESET', -70), G(t, 'GND', 230), V(r1, '1', -70), link(r1, '2', t, 'DIS', ORANGE, -30), link(t, 'DIS', r2, '1', ORANGE, -30),
        link(r2, '2', t, 'THR', YELLOW, -20), link(t, 'THR', t, 'TRIG', YELLOW, 90), link(t, 'TRIG', c, '+', YELLOW, 100), G(c, '-', 230),
        // counter: clock from the 555, reset when Q1 and Q3 are both HIGH (count 10)
        V(ctr, 'VCC', -70), G(ctr, 'GND', 230), link(t, 'OUT', ctr, 'CP1', GREEN, 110),
        V(and, 'VCC', -70), G(and, 'GND', 230), link(ctr, 'Q11', and, 'A1', BLUE, 120), link(ctr, 'Q31', and, 'B1', PURPLE, 126), link(and, 'Y1', ctr, 'MR1', WHITE, 132),
        G(ctr, 'MR2', -60), G(ctr, 'CP2', -60),
        // decoder: BCD in, LT/BI HIGH, LE LOW
        V(dec, 'VCC', -70), G(dec, 'GND', 230), V(dec, 'LT', 140), V(dec, 'BI', 140), G(dec, 'LE', 230),
        link(ctr, 'Q01', dec, 'A', BLUE, 150), link(ctr, 'Q11', dec, 'B', GREEN, 156), link(ctr, 'Q21', dec, 'C', ORANGE, 162), link(ctr, 'Q31', dec, 'D', PURPLE, 168),
        G(disp, 'COM1', 230),
      ];
      segs.forEach((s, i) => {
        wires.push(link(dec, `S${s}`, sr[i], '1', YELLOW, -40 - i * 5));
        wires.push(link(sr[i], '2', disp, s, YELLOW, pinAt(disp, s).y === pinAt(disp, 'G').y ? -50 + i * 2 : 200 + i * 4));
      });
      // the other gates' inputs to GND so they don't float
      wires.push(G(and, 'A2', 230), G(and, 'B2', 230), G(and, 'A3', -60), G(and, 'B3', -60), G(and, 'A4', -60), G(and, 'B4', -60));
      return doc('Decimal counter', [p, t, r1, r2, c, ctr, and, dec, disp, ...sr], wires);
    },
  },
];
