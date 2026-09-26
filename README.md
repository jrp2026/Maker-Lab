# Circuit Lab — browser electronics simulator

A Tinkercad-Circuits-style workspace: drag parts onto a breadboard, wire them pin to pin,
press **Start Simulation** and watch LEDs light, motors spin, meters read and Arduino
sketches run — all in the browser, no server.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # solver, sketch compiler and end-to-end simulation tests
npm run build      # static site in dist/
```

## What's in Phase 1

- **Canvas** – pan (drag background), zoom (wheel), breadboard and schematic views.
  Parts snap to the 0.1" grid; a leg sitting on a breadboard hole or Uno header plugs in
  (green outline). Hover a pin to see its connected strip and, while simulating, its voltage.
- **Wiring** – click a pin, optionally click empty space to add bends, click another pin.
  Select a wire to recolour it, drag bend handles, double-click to add/remove bends, drag an
  end to reconnect.
- **Editing** – rotate `R`, flip `F`, delete `Del`, undo/redo `Ctrl+Z` / `Ctrl+Shift+Z`,
  copy/paste/duplicate `Ctrl+C/V/D`, shift-click or shift-drag to multi-select.
- **Parts (24)** – half/full breadboard, resistor, potentiometer, photoresistor, ceramic and
  electrolytic capacitors, LED, RGB LED, diode, NPN/PNP transistors, push button, slide switch,
  batteries (9 V, 2×AA, 4×AA, coin cell), DC motor, piezo buzzer, servo (SG90 / MG996R /
  continuous), 16×2 & 20×4 LCD (parallel and I2C backpack), multimeter, oscilloscope,
  **Arduino Uno R3** and **ESP32 DevKit V1**. The rest of the requested library is listed in the
  picker as Phase 2/3 — or make it yourself with the AI part generator.
- **Simulation** – modified nodal analysis with Newton–Raphson for diodes/LEDs/BJTs and
  backward-Euler capacitors; motor back-EMF and inertia. Animated current dots on wires.
  Interactive parts: hold buttons, click switches and the multimeter dial, drag pot/LDR knobs.
- **Error flags** – short circuits, LED over-current and burn-out, reversed electrolytics,
  resistor over-power, overloaded Arduino pins / 5 V rail, missing ground, compile/runtime errors.
- **Arduino / ESP32 code** – an Arduino C++ subset compiled to JavaScript generators:
  - AVR integer semantics on the Uno (16-bit `int`), 32-bit `int` on the ESP32
  - `digitalWrite/Read`, `analogRead` (10-bit Uno, 12-bit ESP32), PWM `analogWrite`, ESP32 `ledc*`
    and `dacWrite`, `tone`, `millis`, `delay`, `Serial` in/out (Serial Monitor)
  - **libraries**: `Servo` (also `ESP32Servo`), `LiquidCrystal`, `LiquidCrystal_I2C`, `Wire`
    (the I2C bus really addresses devices: an I2C scanner finds the LCD at 0x27)
  - **interrupts**: `attachInterrupt(digitalPinToInterrupt(pin), handler, RISING|FALLING|CHANGE|LOW)`,
    `detachInterrupt`, `noInterrupts`/`interrupts`
  - **pointers & references**: `&x`, `*p`, pointer arithmetic, arrays decaying to pointers,
    `int &ref` parameters and locals, `const char*` strings, NULL checks at run time
  - `String`, arrays (multi-dimensional), `struct`-free C: `switch`, `enum`, `#define`, statics
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

## Layout

```
src/sim/        solver.ts (MNA engine), netlist.ts, simulator.ts (stepping, warnings, wire flow)
src/mcu/        lexer/compiler (sketch → JS), runtime.ts (Arduino API, pin drive, scheduler, ISRs),
                boards.ts (Uno / ESP32 specs), libs.ts (Servo, LiquidCrystal(_I2C), Wire)
src/blocks/     Blockly block definitions + C++ generator, lazy-loaded editor
src/ai/         part spec + validator, formula language, provider clients, prompt
src/components/ part definitions: art, schematic symbol, pins, electrical model
src/ui/         canvas, library, inspector, code panel, toolbar
src/examples/   starter circuits
```

## Known limits / next steps

- Breadboard view is top-down with shading rather than true isometric.
- ESP32 Wi-Fi/Bluetooth, `struct`/`class`, function pointers (other than interrupt handlers) and
  SPI/EEPROM aren't simulated yet — the compiler says so with a clear message.
- Phase 2: sensors, steppers + drivers, seven-segment/OLED displays, 555/op-amps, Nano.
