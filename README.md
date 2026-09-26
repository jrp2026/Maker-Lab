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
- **Parts (20)** – half/full breadboard, resistor, potentiometer, photoresistor, ceramic and
  electrolytic capacitors, LED, RGB LED, diode, NPN/PNP transistors, push button, slide switch,
  batteries (9 V, 2×AA, 4×AA, coin cell), DC motor, piezo buzzer, multimeter, oscilloscope,
  Arduino Uno R3. The rest of the requested library is listed in the picker as Phase 2/3.
- **Simulation** – modified nodal analysis with Newton–Raphson for diodes/LEDs/BJTs and
  backward-Euler capacitors; motor back-EMF and inertia. Animated current dots on wires.
  Interactive parts: hold buttons, click switches and the multimeter dial, drag pot/LDR knobs.
- **Error flags** – short circuits, LED over-current and burn-out, reversed electrolytics,
  resistor over-power, overloaded Arduino pins / 5 V rail, missing ground, compile/runtime errors.
- **Arduino** – an Arduino C++ subset compiled to JavaScript generators: AVR integer semantics
  (16-bit `int`), `digitalWrite/Read`, `analogRead`, PWM `analogWrite`, `tone`, `millis`,
  `delay`, `Serial` in/out (Serial Monitor), `String`, arrays, `switch`, `enum`, `#define`.
- **Projects** – autosave, save/open in the browser, JSON import/export, PNG export, and share
  links that carry the whole circuit in the URL.

## Layout

```
src/sim/        solver.ts (MNA engine), netlist.ts, simulator.ts (stepping, warnings, wire flow)
src/mcu/        lexer/compiler (sketch → JS), runtime.ts (Arduino API, pin drive, scheduler)
src/components/ part definitions: art, schematic symbol, pins, electrical model
src/ui/         canvas, library, inspector, code panel, toolbar
src/examples/   starter circuits
```

## Known limits / next steps

- Breadboard view is top-down with shading rather than true isometric.
- Code editor is text only (blocks planned). No libraries (`Servo`, `Wire`, `LiquidCrystal`),
  interrupts or pointers yet — the compiler reports these clearly.
- Phase 2: sensors, servos/steppers + drivers, seven-segment/OLED displays, 555/op-amps, ESP32/Nano.
