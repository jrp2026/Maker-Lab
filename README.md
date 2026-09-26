<h1 align="center">MakerLab</h1>

<p align="center">
  <b>A browser electronics &amp; Arduino simulator</b> — build circuits from 197 realistic parts, write a sketch, press Run.
</p>

<p align="center">
  <a href="https://github.com/jrp2026/electronic-simulator/actions/workflows/pages.yml"><img src="https://img.shields.io/github/actions/workflow/status/jrp2026/electronic-simulator/pages.yml?style=flat-square&label=tests%20%26%20deploy" alt="Tests and deploy status"></a>
  <a href="https://jrp2026.github.io/electronic-simulator/"><img src="https://img.shields.io/badge/demo-live-00a39a?style=flat-square" alt="Live demo"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-22-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://vite.dev"><img src="https://img.shields.io/badge/vite-8-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite 8"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square" alt="License: GPL-3.0"></a>
</p>

<p align="center">
  <a href="https://jrp2026.github.io/electronic-simulator/"><b>Open the live demo</b></a> ·
  <a href="#features">Features</a> ·
  <a href="#development">Development</a>
</p>

A Tinkercad-Circuits-style workspace: drag parts onto a breadboard, wire them pin to pin,
press **Start Simulation** and watch LEDs light, motors spin, meters read and Arduino
sketches run — all in the browser, no server. Works on desktop, tablets and phones.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # solver, sketch compiler and end-to-end simulation tests
npm run build      # static site in dist/
```


## Features

- **Canvas** – pan (drag background), zoom (wheel), breadboard and schematic views.
  Parts snap to the 0.1" grid; a leg sitting on a breadboard hole or Uno header plugs in
  (green outline). Hover a pin to see its connected strip and, while simulating, its voltage.
- **Phones & tablets** – the toolbar wraps to fit, **＋ Parts** opens the parts library as a
  bottom sheet, pinch to zoom and drag with two fingers to pan, tap a pin to start a wire (a
  **Cancel** button replaces Esc), the inspector docks at the bottom and the code editor
  opens full screen.
- **Wiring** – click a pin, optionally click empty space to add bends, click another pin.
  Select a wire to recolour it, drag bend handles, double-click to add/remove bends, drag an
  end to reconnect.
- **Editing** – rotate `R`, flip `F`, delete `Del`, undo/redo `Ctrl+Z` / `Ctrl+Shift+Z`,
  copy/paste/duplicate `Ctrl+C/V/D`, shift-click or shift-drag to multi-select.
- **Parts (200+)** – the whole component library from the brief, every entry placeable:
  - *surfaces*: half/full breadboard, perfboard, stripboard, DIP IC sockets
  - *passives*: resistors, pots, trimmers, rheostat, LDR, NTC thermistor, ceramic/electrolytic/super
    capacitors, inductor, ferrite, transformer, crystal, resonator, X9C103 digital pot
  - *diodes & opto*: LED, RGB, diode, zener, Schottky, TVS, IR LED, photodiode, laser, NeoPixel
    stick/ring/strip
  - *transistors*: NPN/PNP, N/P MOSFETs, MOSFET module, Darlington, optocoupler, JFET, IGBT, TRIAC, SCR
  - *switches & inputs*: button, slide/toggle/DIP/rotary switches, 4×4 keypad, joystick, rotary encoder
  - *power*: batteries & holders, LiPo/18650 (state of charge), barrel jack, USB/USB-C, AC source,
    78xx/LM317/AMS1117 regulators, bridge rectifier, buck/boost/buck-boost converters, TP4056 charger,
    protection board, 3S BMS, solar panel & charge controller, fuses, polyfuse, terminal blocks, headers
  - *motors & audio*: DC, TT/N20/planetary/coreless gear motors, BLDC, servo, NEMA 17 and 28BYJ-48
    steppers, linear actuator, solenoid, piezo, speaker, microphone
  - *drivers*: L298N, L293D, TB6612FNG, DRV8833, L9110S, MX1508, BTS7960, VNH2SP30, IRF520 and TIP120
    modules, A4988/DRV8825/TMC2208/TMC2209 step-dir drivers, ULN2003, ESC, BLDC controller, PCA9685
  - *ICs*: 555, LM358, µA741, LM393, 74HC00/08/32/86/04, 74HC595, CD4017, 74HC4051, 74HC138,
    ADS1115 ADC, MCP4725 DAC, PCF8574 expander, ADuM1201 isolator
  - *memory & time*: 24LC256 EEPROM, W25Q32 flash, DS1307/DS3231 RTCs, SD / microSD modules
  - *sensors*: TMP36/LM35, DHT11/22, BMP280, LDR, IR obstacle, HC-SR04, PIR, Hall, MPU6050,
    ADXL335, QMC5883L, MQ-2, sound, vibration, tilt, reed, INA219, ACS712, voltage divider,
    rotary/quadrature/wheel encoders, resistive touch panel
  - *displays*: 16×2/20×4 LCD (parallel & I2C), SSD1306 OLED 128×64/128×32, seven-segment, 8×8 matrix,
    MAX7219 matrix module
  - *communication*: HC-05 Bluetooth, ESP-01 (AT Wi-Fi), NEO-6M GPS, nRF24L01, SIM800L GSM, RC522 RFID,
    PN532 NFC, MCP2515 CAN, MAX485 RS-485, USB-TTL / CH340 adapters, logic-level converter, SPI monitor
  - *boards*: Arduino Uno, Nano, Mega 2560, Micro; ESP32 DevKit; ESP8266 NodeMCU; Raspberry Pi Pico /
    Pico W; STM32 Blue Pill; Teensy 4.0; bare ATtiny85, ATmega328P, PIC16F877A and a generic MCU
    (powered from their own VCC pin); USBasp programmer
- **Simulation** – modified nodal analysis with Newton–Raphson for diodes/LEDs/BJTs and
  backward-Euler capacitors; motor back-EMF and inertia. Animated current dots on wires.
  Interactive parts: hold buttons, click switches and the multimeter dial, drag pot/LDR knobs.
- **Error flags** – short circuits, LED over-current and burn-out, reversed electrolytics,
  resistor over-power, overloaded Arduino pins / 5 V rail, missing ground, compile/runtime errors.
- **Arduino code (every board)** – an Arduino C++ subset compiled to JavaScript generators:
  - per-board integer sizes, pin maps, ADC resolution, PWM/interrupt pins, CPU speed and
    `#if defined(ESP32)` / `__AVR__` style macros
  - `digitalWrite/Read`, `analogRead`, PWM `analogWrite`, ESP32 `ledc*`/`dacWrite`, `tone`, `pulseIn`,
    `shiftOut`, `millis`, `delay`, interrupts, `EEPROM`, `sprintf`/`dtostrf`/`strcpy`…
  - `Serial`, `Serial1–3` and `SoftwareSerial` really carry bytes between boards and modules;
    `Wire` (I2C) and `SPI` address the chips wired to them (raw register code works too)
  - **libraries**: Servo, LiquidCrystal(_I2C), Adafruit_NeoPixel, Adafruit_SSD1306/GFX, LedControl,
    Adafruit_PWMServoDriver, Stepper, AccelStepper, Keypad, NewPing, DHT, Adafruit_BMP280,
    Adafruit_MPU6050, QMC5883LCompass, Adafruit_INA219, Adafruit_ADS1X15, Adafruit_MCP4725, PCF8574,
    RTClib, SD, MFRC522, Adafruit_PN532, RF24, mcp_can, TinyGPS++
  - `struct`/`typedef`, pointers & references, `String`, multi-dimensional arrays, `enum`, `switch`
- **Block coding** – Tinkercad-style blocks (Blockly) with *Blocks*, *Blocks + Text* (live
  generated code) and *Text* modes: pins, PWM, tone, servo, I2C LCD, inputs, waits, loops,
  conditions, math, text and variables. Generated code targets the selected board.
- **✨ AI part generator** – describe a part (“7805 voltage regulator”, “12 V relay module”,
  “LM35 temperature sensor”) and a model designs it: pins, Tinkercad-style art, schematic symbol,
  editable properties, and an electrical model built from the simulator's primitives plus
  formula-driven sources (`v(IN,GND)`, `i(REG)`, props, time). Parts can be refined in plain
  language, edited as JSON, saved to *My AI parts*, and they travel inside project files and
  share links. Providers:
  - **Claude** (Anthropic), **ChatGPT** (OpenAI), **Gemini** (Google) — paste your API key; it is
    stored only in this browser and sent only to that provider.
  - **Ollama** (`OLLAMA_ORIGINS=* ollama serve`) and **LM Studio** (Developer → start server,
    enable CORS) running locally — no key needed.
  Model output is treated as untrusted data: a strict validator whitelists shape types, colours,
  path data and formula functions, so specs (including ones from share links) can't run code.
  There's also a built-in example part to try without any AI.
- **Projects** – autosave, save/open in the browser, JSON import/export, PNG export, and share
  links that carry the whole circuit in the URL.
- **Examples** – blink, button, dimmer, RC charging, motor, melody, servo, LCD, ESP32, interrupts,
  OLED, NeoPixel rainbow, weather station, parking sensor, stepper, RFID lock, 555 blinker,
  74HC595 chaser, two-board nRF24 remote, and an AI-made regulator.

## Layout

```
src/sim/        solver.ts (MNA engine), netlist.ts, simulator.ts (stepping, warnings, wire flow)
src/mcu/        lexer/compiler (sketch → JS), runtime.ts (Arduino API, pin drive, scheduler, ISRs),
                boards.ts (board specs), libspecs.ts (library APIs for the compiler),
                stdlib.ts (serial, SPI, EEPROM, SD), devlibs/ (device libraries)
src/parts/      built-in parts authored as declarative specs; devices/ adds their TypeScript side
src/blocks/     Blockly block definitions + C++ generator, lazy-loaded editor
src/ai/         part spec + validator, formula language, provider clients, prompt
src/components/ part definitions: art, schematic symbol, pins, electrical model
src/ui/         canvas, library, inspector, code panel, toolbar
src/examples/   starter circuits
```

## Deployment

Pushing to `main` (or this project's working branch) runs `.github/workflows/pages.yml`: it
installs, tests, builds and publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves.

## Known limits

- Breadboard view is top-down with shading rather than true isometric.
- Networking isn't simulated (ESP32/ESP8266/Pico W Wi-Fi, Bluetooth LE); serial modules like the
  ESP-01 and HC-05 answer realistically instead. User-defined `class`es and function pointers
  (other than interrupt handlers) aren't supported — the compiler says so.
- Complex chips are behavioural models (e.g. BLDC drive is averaged, radio links are ideal).
