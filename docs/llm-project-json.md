# Writing a MakerLab project as JSON — a guide for LLMs

Give this file (and [parts-reference.md](parts-reference.md)) to a language model and it can build
MakerLab circuits for you. The model writes one JSON document; you load it with
**File → Import .json…** in MakerLab (or turn it into a share link, see the end).

---

## Your task, in one paragraph

You produce a single JSON object describing a circuit: which parts are on the canvas, where they are,
how they are wired, and (for microcontroller boards) the Arduino sketch they run. Use **only** part
types and pin ids that appear in `parts-reference.md` — spelled exactly, case-sensitive. Anything
unknown is silently dropped when the file is loaded, so a single typo loses a part or a wire.

## The document

```text
{
  "version": 1,                 // always 1
  "name": "Blink with a button", // shown in the title bar
  "components": [ … ],          // the parts
  "wires": [ … ]                // the connections
}
```

### Components

```text
{
  "id": "led1",          // unique in this file; letters/digits, used by wires
  "type": "led",         // a part type from parts-reference.md
  "x": 400, "y": -60,    // position of the part's local origin (see "Coordinates")
  "rot": 0,              // 0, 1, 2, 3 = 0°, 90°, 180°, 270° clockwise
  "flip": false,         // mirror left-right
  "props": { "color": "green" }   // optional; omitted keys take their defaults
}
```

- `props` only needs the settings you want to change. The reference lists every prop, its default and
  its allowed values (for `select` props use exactly one of the listed values, with the same type:
  `5` and `"5"` are different).
- Microcontroller boards (`arduino-uno`, `arduino-nano`, `esp32-devkit`, `pico`, …) take their program
  in `props.code` as one string of Arduino C++ (newlines as `\n` in JSON). See "Sketches" below.
- Boards have a USB cable setting, `props.usb`: `1` = plugged in (the computer powers the board),
  `0` = unplugged (the board is off until you wire power: 5 V to the ESP32's `VIN` or 3.3 V to
  `3V3`, 7–12 V to an Uno's `VIN`, plus `GND`). Set it explicitly; if you leave it out the board is
  treated as plugged in. A battery-powered project (a robot car) should use `"usb": 0` and wire the
  battery / regulator to `VIN` and `GND`.

### Wires

```text
{
  "id": "w1",
  "a": { "comp": "uno", "pin": "D13" },   // component id + pin id
  "b": { "comp": "r1",  "pin": "1" },
  "points": [],                            // optional bend points, world coordinates
  "color": "#fb8c00"                       // any CSS colour; red for +, black for GND reads best
}
```

A wire is an ideal connection between two pins. You may chain as many wires on one pin as you like
(a star of GND wires is fine). `points` is purely cosmetic — leave it empty unless you want neat
routing; the wire is drawn straight between the pins otherwise.

## Coordinates

- The canvas is in **units where 10 = 0.1 inch** (one breadboard pitch). y grows **downwards**.
- `x`, `y` place the part's local origin; the reference gives each pin's offset only implicitly, so
  think of a part as a box of roughly 50–300 units. Keep parts **at least ~150 units apart** and
  use multiples of 10 so everything sits on the grid.
- A good layout: the board at `(0, 0)`, parts to its right (`x ≥ 320`) or above it (`y ≤ -60`),
  modules and displays further out. Nothing overlaps → nothing connects by accident.

## How connections are made

1. **Wires** (above) — the normal way. Prefer them; they never depend on geometry.
2. **Plugging in by position.** When a part's *lead* pin lands exactly on a *socket* (a breadboard
   hole, perfboard hole, IC-socket contact), it is plugged in. This is how a real breadboard works,
   and only happens with the `breadboard`, `breadboard-full`, `perfboard`, `stripboard` and
   `ic-socket` parts. Two ordinary part pins on the same spot do **not** connect.
3. **Inside a part.** Some parts join pins internally (both sides of a push button, all GND pins of
   an Arduino, the 5-hole strips of a breadboard). The reference lists these as
   "Internally connected".

### Breadboards

`breadboard` (half, 30 columns) and `breadboard-full` (63 columns) placed at `(bx, by)`:

- Holes are named `<column><row>`: columns `1…30`, rows `a b c d e` (top half) and `f g h i j`
  (bottom half). Hole `5c` is column 5, row c.
- Hole position: x = `bx + 20 + (column − 1) × 10`; y = `by +` 60, 70, 80, 90, 100 for rows a–e and
  130, 140, 150, 160, 170 for rows f–j.
- The five holes `a–e` of one column are connected; so are `f–j`. The trench in the middle separates
  them (put DIP chips across it).
- Power rails: `tp<n>` (top +), `tn<n>` (top −), `bp<n>` (bottom +), `bn<n>` (bottom −) where `n` is
  1…(columns−2) **skipping multiples of 6** (there is no `tp6`, `tp12`, …). Rail hole `tp<n>` is at
  x = `bx + 20 + n × 10`, y = `by + 20` (`tn` 30, `bp` 200, `bn` 210). Each rail is one long strip.
- To plug a part in, compute where its pin must go and set the part's `x`, `y` so that pin lands on
  the hole. For a two-lead part like `resistor` (pin `1` at its origin, pin `2` at +40, 0) at hole
  `5a`: `x = bx + 60`, `y = by + 60`, and pin 2 lands in `9a`.
- You can also simply **wire** to a hole: `{ "comp": "bb", "pin": "12e" }`.

## Electrical rules that keep the simulation happy

- Every circuit needs a supply and a common ground. An Arduino's `5V`/`3V3` and `GND` pins supply
  power; otherwise use `battery`, `battery-holder`, `usb-breakout`, `barrel-jack`, `lab-psu`, ….
  Join all grounds (board GND, sensor GND, driver GND, battery −).
- LEDs need a series resistor (220–470 Ω from 5 V). Too much current raises a red error.
- Motors, solenoids, relays, pumps: never straight from a pin — use a driver (`l298n`, `tb6612fng`,
  `uln2003`, `mosfet-switch`, `2n7000`/`npn` + flyback `diode`, `relay-module`).
- Modules have supply limits (3.3 V parts on 5 V warn). Check the part's description.
- I2C modules connect SDA/SCL to the board's SDA/SCL (Uno: `A4`/`A5`, also the `SDA`/`SCL` header
  pins). SPI modules use the board's SPI pins (Uno: `D11` MOSI, `D12` MISO, `D13` SCK).

## Sketches (`props.code`)

The boards run a real Arduino-style C++ subset:

- `setup()` / `loop()`, `pinMode`, `digitalRead/Write`, `analogRead/Write` (PWM pins only),
  `delay`, `delayMicroseconds`, `millis`, `micros`, `tone`, `noTone`, `pulseIn`, `shiftOut`,
  `attachInterrupt(digitalPinToInterrupt(pin), fn, RISING|FALLING|CHANGE)`, `map`, `constrain`,
  `random`, `bitRead`…, `Serial` (shown in the Serial monitor).
- Types: `int` (16-bit on AVR), `long`, `unsigned`, `float`, `bool`, `char`, `byte`, `String`,
  arrays (also 2-D), `struct`, `enum` (usable as a type), `const`, `static`, pointers and references,
  `#define` (also function-like macros), `auto`, range-based `for`.
- Your own `class`es work: fields, member functions, constructors with initializer lists,
  `Class::method` definitions, single inheritance, objects in arrays. Overloads and default
  arguments work too.
- **Not supported:** templates, lambdas, virtual dispatch through base-class pointers, operator
  overloading, static class members, `goto`, the STL.
- Libraries (include the usual header): Wire, SPI, EEPROM, Servo, LiquidCrystal,
  LiquidCrystal_I2C, Adafruit_NeoPixel, Adafruit_SSD1306 (+ Adafruit_GFX), LedControl,
  Adafruit_PWMServoDriver, Stepper, AccelStepper, Keypad, NewPing, DHT, Adafruit_BMP280,
  Adafruit_MPU6050, QMC5883LCompass, Adafruit_INA219, Adafruit_ADS1115, Adafruit_MCP4725, PCF8574,
  RTClib (RTC_DS3231, RTC_DS1307, DateTime), SD, MFRC522, Adafruit_PN532, RF24, MCP_CAN,
  TinyGPSPlus, SoftwareSerial.
- Buttons: use `INPUT_PULLUP` and wire the button between the pin and GND (pressed reads `LOW`).
- In JSON the sketch is one string: escape `"` as `\"` and newlines as `\n`.

## Worked example 1 — wires only (Uno, LED, button)

The LED on D13 (through 220 Ω) lights while the button on D2 is held.

```json
{
  "version": 1,
  "name": "Button lights an LED",
  "components": [
    { "id": "uno", "type": "arduino-uno", "x": 0, "y": 0, "rot": 0, "flip": false,
      "props": { "code": "const int BUTTON = 2, LED = 13;\n\nvoid setup() {\n  pinMode(BUTTON, INPUT_PULLUP);\n  pinMode(LED, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  bool pressed = digitalRead(BUTTON) == LOW;\n  digitalWrite(LED, pressed ? HIGH : LOW);\n  delay(10);\n}\n" } },
    { "id": "r1", "type": "resistor", "x": 320, "y": -60, "rot": 0, "flip": false, "props": { "resistance": 220 } },
    { "id": "led1", "type": "led", "x": 400, "y": -60, "rot": 0, "flip": false, "props": { "color": "green" } },
    { "id": "btn", "type": "pushbutton", "x": 300, "y": -160, "rot": 0, "flip": false, "props": {} }
  ],
  "wires": [
    { "id": "w1", "a": { "comp": "uno", "pin": "D13" }, "b": { "comp": "r1", "pin": "1" }, "points": [], "color": "#fb8c00" },
    { "id": "w2", "a": { "comp": "r1", "pin": "2" }, "b": { "comp": "led1", "pin": "A" }, "points": [], "color": "#fb8c00" },
    { "id": "w3", "a": { "comp": "led1", "pin": "K" }, "b": { "comp": "uno", "pin": "GND3" }, "points": [], "color": "#212121" },
    { "id": "w4", "a": { "comp": "btn", "pin": "1a" }, "b": { "comp": "uno", "pin": "D2" }, "points": [], "color": "#1e88e5" },
    { "id": "w5", "a": { "comp": "btn", "pin": "2a" }, "b": { "comp": "uno", "pin": "GND3" }, "points": [], "color": "#212121" }
  ]
}
```

## Worked example 2 — a breadboard, no code

A 9 V battery lights an LED through 470 Ω. The resistor and LED are **plugged in** (their pins land
on holes); wires only bring power to the rails and the rails to the parts.

- Breadboard `bb` at (0, 0).
- Resistor pin 1 at hole `5a` (x = 20 + 4×10 = 60, y = 60) → pin 2 lands in `9a`.
- LED anode `A` at hole `9c` (100, 80), same column as the resistor's pin 2; cathode `K` lands in `10c`.
- Wires: battery + → `tp1`, battery − → `tn1`, `5b` → `tp5` (resistor side to +), `10e` → `tn10`
  (LED cathode column to −).

```json
{
  "version": 1,
  "name": "LED on a breadboard",
  "components": [
    { "id": "bb", "type": "breadboard", "x": 0, "y": 0, "rot": 0, "flip": false, "props": {} },
    { "id": "bat", "type": "battery", "x": -200, "y": 0, "rot": 0, "flip": false, "props": { "kind": "9V" } },
    { "id": "r1", "type": "resistor", "x": 60, "y": 60, "rot": 0, "flip": false, "props": { "resistance": 470 } },
    { "id": "led1", "type": "led", "x": 100, "y": 80, "rot": 0, "flip": false, "props": { "color": "red" } }
  ],
  "wires": [
    { "id": "w1", "a": { "comp": "bat", "pin": "+" }, "b": { "comp": "bb", "pin": "tp1" }, "points": [], "color": "#e53935" },
    { "id": "w2", "a": { "comp": "bat", "pin": "-" }, "b": { "comp": "bb", "pin": "tn1" }, "points": [], "color": "#212121" },
    { "id": "w3", "a": { "comp": "bb", "pin": "5b" }, "b": { "comp": "bb", "pin": "tp5" }, "points": [], "color": "#e53935" },
    { "id": "w4", "a": { "comp": "bb", "pin": "10e" }, "b": { "comp": "bb", "pin": "tn10" }, "points": [], "color": "#212121" }
  ]
}
```

## Custom parts (optional)

If a part you need does not exist, a document may carry its own part definitions in a top-level
`"customParts": [ … ]` array (the same declarative format MakerLab's "Make a part with AI" dialog
produces; see `src/ai/prompt.ts` in the repository for the full schema). Prefer existing parts.

## Checklist before you answer

1. Every `type` is in parts-reference.md; every `pin` in a wire exists on that part (exact spelling).
2. Every component `id` is unique, and every wire references existing ids.
3. There is a power source and every module's GND is joined to it.
4. LEDs have resistors; motors/relays go through a driver.
5. Parts do not overlap (≥ ~150 units apart) unless you are deliberately plugging into a breadboard.
6. `props` values use the listed options (numbers as numbers).
7. The sketch compiles in your head: `setup()` and `loop()`, no templates or lambdas, libraries from the list.
8. Output **only the JSON** (no comments — JSON has none) when the user wants a file to import.

## Loading the result

- **File → Import .json…** and pick the saved file, or
- make a share link: `https://jrp2026.github.io/Maker-Lab/#circuit=j` followed by the JSON
  encoded as base64url (standard base64 with `+`→`-`, `/`→`_`, no `=` padding). Opening the link
  loads the circuit.
