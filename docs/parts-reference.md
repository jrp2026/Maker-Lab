# MakerLab parts reference

Every part type MakerLab knows (309), with its exact pin ids and props. Use these ids verbatim in a
project JSON — see [llm-project-json.md](llm-project-json.md) for the file format. This file is generated from the
part definitions (`npm run docs`); do not edit it by hand.

## Index

- **Prototyping surfaces**: `breadboard`, `breadboard-full`, `ic-socket`, `perfboard`, `stripboard`
- **Microcontroller boards**: `arduino-mega`, `arduino-micro`, `arduino-nano`, `arduino-uno`, `atmega328p`, `attiny85`, `esp32-devkit`, `esp8266-nodemcu`, `generic-mcu`, `isp-programmer`, `pic16f877a`, `pico`, `pico-w`, `stm32-bluepill`, `teensy40`
- **Passive components**: `capacitor`, `crystal`, `digipot`, `dual-pot`, `electrolytic`, `ferrite`, `inductor`, `photoresistor`, `potentiometer`, `power-resistor`, `resistor`, `resonator`, `rheostat`, `slide-pot`, `supercap`, `thermistor`, `transformer`, `trimmer`, `varistor`
- **Diodes & LEDs**: `bicolor-led`, `diode`, `flashing-led`, `germanium-diode`, `ir-led`, `laser`, `led`, `led-10mm`, `led-bargraph`, `led-strip-12v`, `neopixel-ring`, `neopixel-stick`, `neopixel-strip`, `photodiode`, `phototransistor`, `rgb-led`, `rgb-led-module`, `schottky`, `schottky-power`, `tvs`, `zener`
- **Transistors**: `2n7000`, `darlington`, `igbt`, `jfet`, `mosfet-module`, `nmos`, `npn`, `optocoupler`, `pmos`, `pnp`, `scr`, `triac`
- **Switches & inputs**: `arcade-button`, `dip-switch`, `door-sensor`, `e-stop`, `joystick`, `key-switch`, `keypad`, `keypad-1x4`, `limit-switch`, `pushbutton`, `relay`, `relay-module`, `rocker-switch`, `rotary-switch`, `slide-switch`, `slide-switch-3`, `ssr`, `toggle-switch`, `touch-4key`, `touch-sensor`
- **Power**: `ac-source`, `ams1117`, `b0505s`, `barrel-jack`, `battery`, `battery-18650`, `battery-holder`, `battery-snap`, `bms-3s`, `boost-converter`, `bridge-rectifier`, `buck-boost`, `buck-converter`, `coin-cell`, `fuse`, `ht7333`, `icl7660`, `lab-psu`, `lifepo4`, `liion-protect`, `lipo`, `lm317`, `pin-header`, `polyfuse`, `power-bank`, `power-distribution`, `reg-3v3-module`, `reg-78xx`, `reg-79xx`, `solar-controller`, `solar-panel`, `terminal-block`, `tl431`, `tp4056`, `usb-breakout`, `usbc-power`
- **Outputs (motors, sound, lights)**: `active-buzzer`, `bldc-motor`, `coreless-motor`, `dc-fan`, `dc-motor`, `electromagnet`, `gear-motor`, `heater-pad`, `lcd`, `lcd-i2c`, `light-bulb`, `linear-actuator`, `mic-module`, `n20-motor`, `neon-lamp`, `panel-led`, `peltier`, `piezo`, `planetary-motor`, `servo`, `siren`, `solenoid`, `solenoid-valve`, `speaker`, `stepper-28byj48`, `stepper-nema17`, `traffic-light`, `vibration-motor`, `water-pump`
- **Motor & driver modules**: `a4988`, `bldc-controller`, `bts7960`, `drv8825`, `drv8833`, `dual-hbridge`, `esc`, `hbridge`, `l293d`, `l298n`, `mosfet-switch`, `pca9685`, `solenoid-driver`, `tb6612fng`, `tmc2208`, `tmc2209`, `uln2003`, `uln2803`, `vnh2sp30`
- **Analog & timer ICs**: `lm311`, `lm324`, `lm339`, `lm358`, `lm386`, `lm393`, `mcp6002`, `ne555`, `tl072`, `ua741`
- **Logic gates**: `gate-and`, `gate-and3`, `gate-buffer`, `gate-nand`, `gate-nor`, `gate-not`, `gate-or`, `gate-or3`, `gate-xnor`, `gate-xor`, `logic-input`, `logic-probe`
- **Logic ICs**: `74hc00`, `74hc02`, `74hc04`, `74hc08`, `74hc10`, `74hc11`, `74hc125`, `74hc138`, `74hc14`, `74hc157`, `74hc20`, `74hc245`, `74hc27`, `74hc283`, `74hc32`, `74hc393`, `74hc4051`, `74hc595`, `74hc74`, `74hc86`, `ads1115`, `adum1201`, `cd4011`, `cd4017`, `cd4066`, `cd4511`, `mcp4725`, `pcf8574`
- **Memory & time**: `24lc256`, `ds1307`, `ds3231`, `microsd-module`, `sd-module`, `w25q32`
- **Sensors**: `acs712`, `adxl335`, `anemometer`, `bmp280`, `capacitive-soil`, `dht`, `flame-sensor`, `flex-sensor`, `fsr`, `hall-49e`, `hall-a3144`, `hall-module`, `hc-sr04`, `ina219`, `ir-obstacle`, `knock-sensor`, `laser-receiver`, `ldr-module`, `line-tracker`, `load-cell`, `mpu6050`, `mpx5010`, `mq135`, `mq2`, `mq3`, `mq4`, `mq7`, `ntc-module`, `photo-interrupter`, `pir`, `pulse-sensor`, `qmc5883l`, `quadrature-encoder`, `rain-sensor`, `rcwl-0516`, `reed-switch`, `rotary-encoder`, `sct013`, `sharp-ir`, `soil-moisture`, `sound-sensor`, `speed-sensor`, `temt6000`, `tilt-switch`, `tmp36`, `uv-sensor`, `vibration-sensor`, `voltage-sensor`, `water-flow`, `water-level`
- **Displays**: `led-matrix`, `max7219-matrix`, `oled-128x32`, `oled-128x64`, `seven-seg-4digit`, `seven-seg-ca`, `seven-seg-cc`, `touch-panel`
- **Communication modules**: `esp01`, `gps-neo6m`, `hc05`, `logic-level-converter`, `max485`, `mcp2515`, `nrf24l01`, `pn532`, `rc522`, `rf-antenna`, `sim800l`, `spi-monitor`, `usb-serial`, `usb-ttl`
- **Instruments**: `analog-ammeter`, `analog-voltmeter`, `multimeter`, `oscilloscope`, `panel-voltmeter`

## Prototyping surfaces

#### `breadboard` — Breadboard (half)

Half-size solderless breadboard: 30 columns of 5-hole strips plus two power rails on each side.

Pins: 396 sockets (see "Breadboards" in the guide for the naming scheme, e.g. `1a`, `1b`, `1c`).

#### `breadboard-full` — Breadboard (full)

Full-size solderless breadboard: 63 columns plus power rails.

Pins: 834 sockets (see "Breadboards" in the guide for the naming scheme, e.g. `1a`, `1b`, `1c`).

#### `ic-socket` — IC socket (DIP)

DIP socket (8–40 pins): solder the socket and plug the chip into it, so the chip can be swapped. Place it on a breadboard or perfboard, then drop a DIP chip on top — each socket contact is connected to the leg below it.

Pins: 16 sockets (see "Breadboards" in the guide for the naming scheme, e.g. `S1`, `L1`, `S2`).

Props:
- `pins` = 8 — Pins; one of 8 (DIP-8), 14 (DIP-14), 16 (DIP-16), 18 (DIP-18), 20 (DIP-20), 28 (DIP-28), 40 (DIP-40)

#### `perfboard` — Perfboard

Solderable dot board (24 × 16 holes, 0.1" pitch): every hole is isolated — parts plug in like on a breadboard, and you make the connections yourself with wires. Good for making a circuit permanent.

Pins: 384 sockets (see "Breadboards" in the guide for the naming scheme, e.g. `A1`, `A2`, `A3`).

#### `stripboard` — Prototype PCB (stripboard)

Stripboard / Veroboard: each lettered row (24 holes) is a copper strip, so parts in the same row are connected — cut strips mentally by using separate rows. The classic way to turn a breadboard circuit into a soldered one.

Pins: 384 sockets (see "Breadboards" in the guide for the naming scheme, e.g. `A1`, `A2`, `A3`).

## Microcontroller boards

#### `arduino-mega` — Arduino Mega 2560

ATmega2560 board: 54 digital I/O (15 PWM), 16 analog inputs, 4 hardware serial ports (Serial1–3 on 19/18, 17/16, 15/14), I2C on 20/21, SPI on 50–53, 256 KB flash. Uno shields fit its left half.

Pins: `SCL` (SCL (= D21)), `SDA` (SDA (= D20)), `AREF`, `GND3` (GND), `D13`, `D12`, `D11`, `D10`, `D9`, `D8`, `D7`, `D6`, `D5`, `D4`, `D3`, `D2`, `D1` (D1 / TX0), `D0` (D0 / RX0), `D14` (D14 / TX3), `D15` (D15 / RX3), `D16` (D16 / TX2), `D17` (D17 / RX2), `D18` (D18 / TX1), `D19` (D19 / RX1), `D20` (D20 / SDA), `D21` (D21 / SCL), `NC` (not connected), `IOREF`, `RESET`, `3V3`, `5V`, `GND1` (GND), `GND2` (GND), `VIN`, `A0`, `A1`, `A2`, `A3`, `A4`, `A5`, `A6`, `A7`, `A8`, `A9`, `A10`, `A11`, `A12`, `A13`, `A14`, `A15`, `D22`, `D23`, `D24`, `D25`, `D26`, `D27`, `D28`, `D29`, `D30`, `D31`, `D32`, `D33`, `D34`, `D35`, `D36`, `D37`, `D38`, `D39`, `D40`, `D41`, `D42`, `D43`, `D44`, `D45`, `D46`, `D47`, `D48`, `D49`, `D50` (D50 / MISO), `D51` (D51 / MOSI), `D52` (D52 / SCK), `D53` (D53 / SS)

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3`; `SCL` = `D21`; `SDA` = `D20`

#### `arduino-micro` — Arduino Micro

ATmega32U4 board with native USB (it can act as a keyboard/mouse): 20 digital I/O (7 PWM), 12 analog inputs, Serial is USB and Serial1 is pins 0/1, I2C on D2/D3. Breadboard-friendly (0.6").

Pins: `MOSI`, `SS` (SS / RX LED), `D1` (D1 / TX (Serial1)), `D0` (D0 / RX (Serial1)), `RST1`, `GND1` (GND), `D2` (D2 / SDA), `D3` (D3 / SCL), `D4`, `D5`, `D6`, `D7`, `D8`, `D9`, `D10`, `D11`, `D12`, `MISO`, `SCK`, `D13`, `3V3`, `AREF`, `A0`, `A1`, `A2`, `A3`, `A4`, `A5`, `NC1`, `NC2`, `5V`, `RST2`, `GND2` (GND), `VIN`

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2`; `RST1` = `RST2`

#### `arduino-nano` — Arduino Nano

Breadboard-friendly ATmega328P board: the Uno's chip and pinout (D0–D13, A0–A5) plus A6/A7 (analog-only) on 0.6"-spaced pins that straddle the breadboard trench. Mini-USB, 5 V / 3.3 V pins.

Pins: `D12` (D12 / MISO), `D11` (D11 / MOSI), `D10` (D10 / SS), `D9`, `D8`, `D7`, `D6`, `D5`, `D4`, `D3`, `D2`, `GND1` (GND), `RST1` (RESET), `D0` (D0 / RX), `D1` (D1 / TX), `D13` (D13 / LED / SCK), `3V3`, `AREF`, `A0`, `A1`, `A2`, `A3`, `A4` (A4 / SDA), `A5` (A5 / SCL), `A6`, `A7`, `5V`, `RST2` (RESET), `GND2` (GND), `VIN` (VIN (7–12 V in))

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2`; `RST1` = `RST2`

#### `arduino-uno` — Arduino Uno R3

ATmega328P board: 14 digital I/O (6 PWM ~), 6 analog inputs, 5 V & 3.3 V supply pins. Program it in the Code panel.

Pins: `SCL`, `SDA`, `AREF`, `GND3` (GND), `D13` (Digital pin 13), `D12` (Digital pin 12), `D11` (Digital pin 11), `D10` (Digital pin 10), `D9` (Digital pin 9), `D8` (Digital pin 8), `D7` (Digital pin 7), `D6` (Digital pin 6), `D5` (Digital pin 5), `D4` (Digital pin 4), `D3` (Digital pin 3), `D2` (Digital pin 2), `D1` (Digital pin 1), `D0` (Digital pin 0), `NC` (not connected), `IOREF`, `RESET`, `3V3` (3.3V), `5V`, `GND1` (GND), `GND2` (GND), `VIN` (Vin), `A0` (Analog pin A0), `A1` (Analog pin A1), `A2` (Analog pin A2), `A3` (Analog pin A3), `A4` (Analog pin A4), `A5` (Analog pin A5)

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3`; `A4` = `SDA`; `A5` = `SCL`

#### `atmega328p` — ATmega328P (DIP-28)

The Uno's microcontroller as a bare DIP-28 chip for your own boards: same pin numbers as the Uno (D0–D13, A0–A5). Needs 5 V on VCC and AVCC (pins 7, 20), GND (8, 22) and a 16 MHz crystal + 22 pF caps on pins 9/10 in real life (plus a 10 kΩ pull-up on RESET).

Pins: `A5` (28: PC5 / A5 / SCL), `A4` (27: PC4 / A4 / SDA), `A3` (26: A3), `A2` (25: A2), `A1` (24: A1), `A0` (23: A0), `GND2` (22: GND2), `AREF` (21: AREF), `AVCC` (20: AVCC (ADC supply)), `D13` (19: PB5 / D13 / SCK), `D12` (18: PB4 / D12 / MISO), `D11` (17: PB3 / D11 / MOSI), `D10` (16: D10), `D9` (15: D9), `RESET` (1: RESET), `D0` (2: PD0 / D0 / RX), `D1` (3: PD1 / D1 / TX), `D2` (4: D2), `D3` (5: D3), `D4` (6: D4), `VCC` (7: VCC (1.8–5.5 V)), `GND1` (8: GND1), `XTAL1` (9: XTAL1 (crystal)), `XTAL2` (10: XTAL2 (crystal)), `D5` (11: D5), `D6` (12: D6), `D7` (13: D7), `D8` (14: D8)

Props:
- `code` — the Arduino sketch (a string of C++ source)

Internally connected: `GND1` = `GND2`; `VCC` = `AVCC`

#### `attiny85` — ATtiny85

Tiny 8-pin AVR (8 KB flash, 8 MHz internal clock): 6 I/O pins PB0–PB5 (numbered 0–5), PWM on 0, 1 and 4, ADC on 2, 3, 4. Power it straight from 2.7–5.5 V on VCC (pin 8) and GND (pin 4) — no regulator, no USB. Serial (software) sends on PB0.

Pins: `VCC` (8: VCC (2.7–5.5 V)), `PB2` (7: PB2 / SCK / SCL / A1 / INT0), `PB1` (6: PB1 / MISO (PWM)), `PB0` (5: PB0 / MOSI / SDA (PWM)), `RST` (1: PB5 / RESET), `PB3` (2: PB3 / A3), `PB4` (3: PB4 / A2 (PWM)), `GND` (4: GND)

Props:
- `code` — the Arduino sketch (a string of C++ source)

#### `esp32-devkit` — ESP32 DevKit V1

ESP32-WROOM-32 dev board (30 pins, 3.3 V logic). 12-bit ADC, PWM on any output pin (analogWrite or ledc), DAC on GPIO25/26, interrupts on any pin, I2C on GPIO21 (SDA) / GPIO22 (SCL). The pins plug into a breadboard across rows a and i.

Pins: `D23` (GPIO23), `D22` (GPIO22 / SCL), `TX0` (GPIO1 / TX0), `RX0` (GPIO3 / RX0), `D21` (GPIO21 / SDA), `D19` (GPIO19), `D18` (GPIO18), `D5` (GPIO5), `TX2` (GPIO17 / TX2), `RX2` (GPIO16 / RX2), `D4` (GPIO4), `D2` (GPIO2 / on-board LED), `D15` (GPIO15), `GND2` (GND), `3V3` (3.3 V out), `EN` (EN (reset)), `VP` (GPIO36 / VP (input only, ADC)), `VN` (GPIO39 / VN (input only, ADC)), `D34` (GPIO34 (input only, ADC)), `D35` (GPIO35 (input only, ADC)), `D32` (GPIO32), `D33` (GPIO33), `D25` (GPIO25 / DAC1), `D26` (GPIO26 / DAC2), `D27` (GPIO27), `D14` (GPIO14), `D12` (GPIO12), `D13` (GPIO13), `GND1` (GND), `VIN` (VIN (5 V: from USB, or feed it here))

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 0 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2`

#### `esp8266-nodemcu` — ESP8266 NodeMCU

ESP-12E (ESP8266, 80 MHz, 3.3 V logic) on a NodeMCU v1.0 board. Pins are labelled D0–D8 (→ GPIO16, 5, 4, 0, 2, 14, 12, 13, 15); one 10-bit ADC on A0 (0–3.3 V); the blue LED on D4/GPIO2 is ON when LOW. I2C defaults to D2 (SDA) / D1 (SCL). Wi-Fi itself isn't simulated.

Pins: `D0` (D0 / GPIO16 (wake)), `D1` (D1 / GPIO5 / SCL), `D2` (D2 / GPIO4 / SDA), `D3` (D3 / GPIO0 (flash)), `D4` (D4 / GPIO2 / LED), `3V3A`, `GND1`, `D5` (D5 / GPIO14 / SCK), `D6` (D6 / GPIO12 / MISO), `D7` (D7 / GPIO13 / MOSI), `D8` (D8 / GPIO15 / SS), `RX` (RX / GPIO3), `TX` (TX / GPIO1), `GND2`, `3V3`, `A0` (A0 (ADC, 0–3.3 V)), `RSV1`, `RSV2`, `SD3`, `SD2`, `SD1`, `CMD`, `SD0`, `CLK`, `GND3`, `3V3B`, `EN`, `RST`, `GND4`, `VIN` (VIN (5 V))

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3` = `GND4`; `3V3` = `3V3A` = `3V3B`

#### `generic-mcu` — Generic microcontroller (MCU-20)

A simple, neutral 20-pin 5 V microcontroller for learning: I/O pins P0–P15 (ADC on P0–P7, PWM on P8–P11, interrupts on P2/P3, UART on P12 RX / P13 TX, I2C on P14/P15). Power it from VCC/GND; program it with the Arduino API.

Pins: `NC` (20: NC), `RST` (19: Reset (tie HIGH)), `P15` (18: P15 / SCL), `P14` (17: P14 / SDA), `P13` (16: P13 / TX), `P12` (15: P12 / RX), `P11` (14: P11), `P10` (13: P10), `P9` (12: P9), `P8` (11: P8), `VCC` (1: VCC), `P0` (2: P0), `P1` (3: P1), `P2` (4: P2), `P3` (5: P3), `P4` (6: P4), `P5` (7: P5), `P6` (8: P6), `P7` (9: P7), `GND` (10: GND)

Props:
- `code` — the Arduino sketch (a string of C++ source)

#### `isp-programmer` — Microcontroller programmer (USBasp ISP)

In-system programmer for AVR chips (ATtiny85, ATmega328P …): wire MOSI, MISO, SCK, RESET and GND to the target's pins (and VCC to power it). The display checks the wiring and reports the target it found — the sketch in the Code panel is what gets "flashed".

Pins: `VCC` (+5 V out (target power)), `MOSI` (MOSI → target MOSI), `MISO` (MISO ← target MISO), `SCK` (SCK → target SCK), `RST` (RESET → target RESET), `GND`

Props:
- `power` = 1 — Target power; one of 1 (5 V to target), 0 (Off (target self-powered)

#### `pic16f877a` — PIC16F877A (DIP-40)

Microchip 8-bit PIC (DIP-40, 20 MHz, 33 I/O on ports A–E, 8 ADC channels, UART on RC6/RC7, I2C/SPI on RC3–RC5). In this simulator it is programmed with the same Arduino-style C API as the other boards, using port-pin names (pinMode(RB0, OUTPUT)) — not MPLAB XC8 register code.

Pins: `RB7` (40: RB7), `RB6` (39: RB6), `RB5` (38: RB5), `RB4` (37: RB4), `RB3` (36: RB3), `RB2` (35: RB2), `RB1` (34: RB1), `RB0` (33: RB0 / INT), `VDD2` (32: VDD (+5 V)), `VSS2` (31: VSS (GND)), `RD7` (30: RD7), `RD6` (29: RD6), `RD5` (28: RD5), `RD4` (27: RD4), `RC7` (26: RC7 / RX), `RC6` (25: RC6 / TX), `RC5` (24: RC5 / SDO), `RC4` (23: RC4 / SDI / SDA), `RD3` (22: RD3), `RD2` (21: RD2), `MCLR` (1: MCLR (reset, pull up)), `RA0` (2: RA0), `RA1` (3: RA1), `RA2` (4: RA2), `RA3` (5: RA3), `RA4` (6: RA4), `RA5` (7: RA5), `RE0` (8: RE0), `RE1` (9: RE1), `RE2` (10: RE2), `VDD1` (11: VDD (+5 V)), `VSS1` (12: VSS (GND)), `OSC1` (13: OSC1), `OSC2` (14: OSC2), `RC0` (15: RC0), `RC1` (16: RC1 / CCP2 (PWM)), `RC2` (17: RC2 / CCP1 (PWM)), `RC3` (18: RC3 / SCK / SCL), `RD0` (19: RD0), `RD1` (20: RD1)

Props:
- `code` — the Arduino sketch (a string of C++ source)

Internally connected: `VSS1` = `VSS2`; `VDD1` = `VDD2`

#### `pico` — Raspberry Pi Pico

RP2040 (dual-core Cortex-M0+, 133 MHz, 3.3 V logic): 26 GPIO (PWM on all), three 12-bit ADC inputs (GP26–28 = A0–A2; 10-bit by default in Arduino), I2C on GP4/GP5, SPI on GP16–19, Serial1 on GP0/GP1. Programmed with the Arduino (arduino-pico) API. LED on GP25.

Pins: `VBUS` (VBUS (5 V from USB)), `VSYS` (VSYS (1.8–5.5 V in)), `GND8`, `3V3_EN` (3V3 enable), `3V3` (3V3 out), `ADC_VREF`, `GP28` (GP28 / A2), `AGND`, `GP27` (GP27 / A1), `GP26` (GP26 / A0), `RUN` (RUN (reset)), `GP22`, `GND7`, `GP21`, `GP20`, `GP19`, `GP18`, `GND6`, `GP17`, `GP16`, `GP0` (GP0 / TX (Serial1)), `GP1` (GP1 / RX (Serial1)), `GND1`, `GP2`, `GP3`, `GP4` (GP4 / SDA), `GP5` (GP5 / SCL), `GND2`, `GP6`, `GP7`, `GP8`, `GP9`, `GND3`, `GP10`, `GP11`, `GP12`, `GP13`, `GND4`, `GP14`, `GP15`

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3` = `GND4` = `GND6` = `GND7` = `GND8` = `AGND`

#### `pico-w` — Raspberry Pi Pico W

RP2040 (dual-core Cortex-M0+, 133 MHz, 3.3 V logic): 26 GPIO (PWM on all), three 12-bit ADC inputs (GP26–28 = A0–A2; 10-bit by default in Arduino), I2C on GP4/GP5, SPI on GP16–19, Serial1 on GP0/GP1. Programmed with the Arduino (arduino-pico) API. The W adds a Wi-Fi chip (not simulated) which also drives the on-board LED.

Pins: `VBUS` (VBUS (5 V from USB)), `VSYS` (VSYS (1.8–5.5 V in)), `GND8`, `3V3_EN` (3V3 enable), `3V3` (3V3 out), `ADC_VREF`, `GP28` (GP28 / A2), `AGND`, `GP27` (GP27 / A1), `GP26` (GP26 / A0), `RUN` (RUN (reset)), `GP22`, `GND7`, `GP21`, `GP20`, `GP19`, `GP18`, `GND6`, `GP17`, `GP16`, `GP0` (GP0 / TX (Serial1)), `GP1` (GP1 / RX (Serial1)), `GND1`, `GP2`, `GP3`, `GP4` (GP4 / SDA), `GP5` (GP5 / SCL), `GND2`, `GP6`, `GP7`, `GP8`, `GP9`, `GND3`, `GP10`, `GP11`, `GP12`, `GP13`, `GND4`, `GP14`, `GP15`

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3` = `GND4` = `GND6` = `GND7` = `GND8` = `AGND`

#### `stm32-bluepill` — STM32 development board (Blue Pill)

STM32F103C8 (ARM Cortex-M3, 72 MHz, 64 KB flash, 3.3 V) on the popular "Blue Pill" board, programmed with STM32duino: pins are named PA0…PC15, 10 ADC inputs (PA0–PA7, PB0, PB1), I2C1 on PB7/PB6, SPI1 on PA5–PA7, Serial on PA9/PA10. LED on PC13 lights when LOW.

Pins: `PB12`, `PB13`, `PB14`, `PB15`, `PA8`, `PA9` (PA9 / TX1), `PA10` (PA10 / RX1), `PA11`, `PA12`, `PA15`, `PB3`, `PB4`, `PB5`, `PB6` (PB6 / SCL), `PB7` (PB7 / SDA), `PB8`, `PB9`, `5V`, `GND1`, `3V3A`, `VB` (VBAT), `PC13` (PC13 / LED), `PC14`, `PC15`, `PA0`, `PA1`, `PA2` (PA2 / TX2), `PA3` (PA3 / RX2), `PA4`, `PA5` (PA5 / SCK), `PA6` (PA6 / MISO), `PA7` (PA7 / MOSI), `PB0`, `PB1`, `PB10`, `PB11`, `RST`, `3V3`, `GND2`, `GND3`

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2` = `GND3`; `3V3` = `3V3A`

#### `teensy40` — Teensy 4.0

PJRC Teensy 4.0: ARM Cortex-M7 at 600 MHz (3.3 V logic, not 5 V tolerant!) in a tiny 1.4" × 0.7" board. 24 edge pins, PWM on most, 10 analog inputs (A0–A9 = 14–23), 7 serial ports, I2C on 18/19, SPI on 11–13. Programmed with Teensyduino.

Pins: `VIN` (VIN (3.6–5.5 V)), `GND2` (GND), `3V3`, `D23`, `D22`, `D21`, `D20`, `D19` (19 / A5 / SCL), `D18` (18 / A4 / SDA), `D17`, `D16`, `D15`, `D14`, `D13` (13 / LED / SCK), `GND1` (GND), `D0` (0 / RX1), `D1` (1 / TX1), `D2`, `D3`, `D4`, `D5`, `D6`, `D7`, `D8`, `D9`, `D10`, `D11`, `D12`

Props:
- `code` — the Arduino sketch (a string of C++ source)
- `usb` = 1 — USB cable; one of 1 (Plugged in (powered by the computer)), 0 (Unplugged: power it through VIN / 5V / 3V3 + GND)

Internally connected: `GND1` = `GND2`

## Passive components

#### `capacitor` — Ceramic capacitor

Non-polarised ceramic capacitor.

Pins: `1` (Terminal 1), `2` (Terminal 2)

Props:
- `capacitance` = 1e-7 — Capacitance; number in F, ≥ 1e-12
- `voltage` = 50

#### `crystal` — Crystal oscillator

Quartz crystal (e.g. 16 MHz for an ATmega). It sets a clock frequency in a real circuit; here it is modelled as its large DC resistance and tiny capacitance (the simulator doesn’t run at MHz).

Pins: `1`, `2`

Props:
- `f` = 16 — Frequency; one of 16 (16 MHz), 8 (8 MHz), 0.032768 (32.768 kHz), 12 (12 MHz)

#### `digipot` — Digital potentiometer (X9C103)

100-step 10 kΩ digital potentiometer. Hold CS low; each falling edge on INC moves the wiper up (UD high) or down (UD low). VH–VW–VL behave like a pot’s pins.

Pins: `INC` (1: INC), `UD` (2: UD), `VH` (3: VH), `GND` (4: GND), `VW` (5: VW), `VL` (6: VL), `CS` (7: CS), `VCC` (8: VCC)

Props:
- `r` = 10000 — Resistance; number in Ω

#### `dual-pot` — Dual-gang potentiometer (stereo)

Two identical potentiometers on one shaft — turn the knob and both wipers move together. The classic stereo volume control (one gang per channel), or two linked settings from one knob. Drag the knob while simulating.

Pins: `A1` (Gang A end 1), `AW` (Gang A wiper), `A2` (Gang A end 2), `B1` (Gang B end 1), `BW` (Gang B wiper), `B2` (Gang B end 2)

Props:
- `r` = 10000 — Resistance; number in Ω, ≥ 10
- `pos` = 0.5 — Position; 0…1

#### `electrolytic` — Electrolytic capacitor

Polarised aluminium electrolytic capacitor. The striped leg is negative.

Pins: `+` (Positive (+)), `-` (Negative (−))

Props:
- `capacitance` = 0.0001 — Capacitance; number in F, ≥ 1e-9
- `voltage` = 16 — Voltage rating; number in V, ≥ 1

#### `ferrite` — Ferrite bead

Ferrite bead: near-zero resistance at DC, lossy at high frequency — used to keep noise off power lines.

Pins: `1`, `2`

#### `inductor` — Inductor

Wire-wound inductor (with its small DC resistance). Stores energy in its magnetic field; current through it can’t change instantly.

Pins: `1`, `2`

Props:
- `l` = 0.01 — Inductance; number in H, ≥ 1e-9
- `dcr` = 1 — DC resistance; number in Ω, ≥ 0.001

#### `photoresistor` — Photoresistor (LDR)

Light-dependent resistor: ~1 MΩ in the dark, ~1 kΩ in bright light. Adjust the light level while simulating.

Pins: `1` (Terminal 1), `2` (Terminal 2)

Props:
- `light` = 0.5 — Light level; 0…1

#### `potentiometer` — Potentiometer

Rotary potentiometer. Drag the knob up/down during simulation (or use the slider) to turn it.

Pins: `1` (Terminal 1), `W` (Wiper), `2` (Terminal 2)

Props:
- `resistance` = 10000 — Resistance; number in Ω, ≥ 1
- `position` = 0.5 — Position; 0…1

#### `power-resistor` — Power resistor (5 W / 10 W cement)

Wire-wound resistor in a white ceramic block for loads, current limiting and dummy loads. Mind the watts: P = I² × R. It gets hot long before it fails.

Pins: `A`, `B`

Props:
- `resistance` = 10 — Resistance; number in Ω, ≥ 0.01
- `watts` = 5 — Rating; one of 5 (5 W), 10 (10 W)

#### `resistor` — Resistor

Fixed carbon-film resistor. Colour bands update with the value.

Pins: `1` (Terminal 1), `2` (Terminal 2)

Props:
- `resistance` = 220 — Resistance; number in Ω, ≥ 0.01
- `power` = 0.25 — Power rating; one of 0.125 (1/8 W), 0.25 (1/4 W), 0.5 (1/2 W), 1 (1 W)

#### `resonator` — Ceramic resonator

Three-pin ceramic resonator with built-in load capacitors (middle pin to GND). Clock source for microcontrollers; not oscillated in this simulator.

Pins: `1`, `GND`, `2`

#### `rheostat` — Variable resistor (rheostat)

Two-terminal variable resistance, e.g. to set a current. Drag to adjust.

Pins: `1`, `2`

Props:
- `r` = 1000 — Maximum; number in Ω, ≥ 1
- `pos` = 0.5 — Setting; 0…1

#### `slide-pot` — Slide potentiometer (10 kΩ, 60 mm)

A linear fader like on a mixing desk: the wiper (W) moves from pin 1 to pin 2 as you slide the knob. Wire 1 to GND, 2 to 5 V and read W with analogRead. Drag the knob while simulating.

Pins: `1`, `W`, `2`

Props:
- `r` = 10000 — Resistance; number in Ω, ≥ 10
- `pos` = 0.5 — Position; 0…1

#### `supercap` — Supercapacitor

Electric double-layer capacitor (1 F, 5.5 V). Stores enough charge to keep a small circuit alive for seconds. The striped leg is negative.

Pins: `P` (Positive (+)), `N` (Negative (−))

Props:
- `c` = 1 — Capacitance; number in F, ≥ 0.01

#### `thermistor` — Thermistor (NTC 10k)

Negative-temperature-coefficient thermistor: 10 kΩ at 25 °C, β = 3950. Use it in a divider and read it with analogRead. Set the temperature while simulating.

Pins: `1`, `2`

Props:
- `temp` = 25 — Temperature; -20…120 °C
- `r25` = 10000 — R at 25 °C; number in Ω
- `beta` = 3950 — β; number

#### `transformer` — Transformer

Mains-style step-down transformer (coupled windings). Works on AC only — drive the primary from the AC source. Primary P1/P2, secondary S1/S2.

Pins: `P1` (Primary 1), `P2` (Primary 2), `S1` (Secondary 1), `S2` (Secondary 2)

Props:
- `ratio` = 10 — Turns ratio; one of 2 (2 : 1), 5 (5 : 1), 10 (10 : 1), 19 (230 V → 12 V), 1 (1 : 1 isolation)

#### `trimmer` — Trimmer potentiometer

Small screwdriver-adjusted potentiometer. Pins: 1, wiper, 2. Drag it while simulating to turn the screw.

Pins: `1`, `W`, `2`

Props:
- `r` = 10000 — Resistance; number in Ω, ≥ 10
- `pos` = 0.5 — Position; 0…1

#### `varistor` — Varistor (MOV)

Metal-oxide varistor: an open circuit at normal voltage that suddenly conducts heavily above its clamping voltage (either polarity), soaking up spikes and surges. Put it across a supply input, after the fuse.

Pins: `1`, `2`

Props:
- `vz` = 22 — Clamping voltage; one of 22 (22 V (10D220)), 39 (39 V (10D390)), 68 (68 V (10D680)), 470 (470 V (10D471, mains))

## Diodes & LEDs

#### `bicolor-led` — Bi-colour LED (red / green, common cathode)

Two LEDs in one dome sharing the middle (cathode) leg: light R, G or both for yellow. Each colour needs its own ~220 Ω resistor.

Pins: `R` (Red anode), `K` (Common cathode (−)), `G` (Green anode)

#### `diode` — Diode

Silicon diode. Current flows from anode to the banded cathode.

Pins: `A` (Anode (+)), `K` (Cathode (−))

Props:
- `model` = "1N4148" — Model; one of "1N4148" (1N4148 signal), "1N4001" (1N4001 rectifier)

#### `flashing-led` — Self-flashing LED (5 mm)

An LED with a tiny oscillator chip inside: power it (3–5 V through ~100 Ω) and it blinks by itself about twice a second — no code, no 555. Long leg +.

Pins: `A` (Anode (+, long leg)), `K` (Cathode (−))

#### `germanium-diode` — Germanium diode (1N34A)

An old-school germanium point-contact diode: it starts conducting at only ~0.3 V, so it can detect tiny radio signals — the diode of every crystal radio. Only for small currents (under 50 mA). The band is the cathode.

Pins: `A` (Anode), `K` (Cathode (band))

#### `ir-led` — Infrared LED (940 nm)

IR LED for remotes and obstacle sensors. Invisible to the eye — shown here the way a phone camera sees it (faint violet). Vf ≈ 1.2 V, 20–50 mA.

Pins: `A` (Anode (+, long leg)), `K` (Cathode (−))

#### `laser` — Laser diode module

5 V, 650 nm red laser module (with built-in current limiting). S = signal/+, − = ground. Draws ~30 mA.

Pins: `S` (Signal / +5 V), `N` (GND)

#### `led` — LED

5 mm light-emitting diode. The longer, bent leg is the anode (+). Needs a series resistor!

Pins: `A` (Anode (+, bent leg)), `K` (Cathode (−))

Props:
- `color` = "red" — Color; one of "red" (Red), "orange" (Orange), "yellow" (Yellow), "green" (Green), "blue" (Blue), "white" (White)

#### `led-10mm` — Jumbo LED (10 mm, red)

A big 10 mm LED — same wiring as a 5 mm one (long leg +, ~220 Ω resistor from a 5 V pin, 20 mA), just much easier to see across a room.

Pins: `A` (Anode (+, long leg)), `K` (Cathode (−))

#### `led-bargraph` — LED bar graph (10 segments)

Ten separate LEDs in a DIP-20 block: segment n goes from anode pin n (bottom row) to the cathode straight above it. Perfect for level meters — drive each segment through its own 220 Ω resistor (or a resistor network).

Pins: `A1` (1: Segment 1 anode), `A2` (2: Segment 2 anode), `A3` (3: Segment 3 anode), `A4` (4: Segment 4 anode), `A5` (5: Segment 5 anode), `A6` (6: Segment 6 anode), `A7` (7: Segment 7 anode), `A8` (8: Segment 8 anode), `A9` (9: Segment 9 anode), `A10` (10: Segment 10 anode), `K10` (11: Segment 10 cathode), `K9` (12: Segment 9 cathode), `K8` (13: Segment 8 cathode), `K7` (14: Segment 7 cathode), `K6` (15: Segment 6 cathode), `K5` (16: Segment 5 cathode), `K4` (17: Segment 4 cathode), `K3` (18: Segment 3 cathode), `K2` (19: Segment 2 cathode), `K1` (20: Segment 1 cathode)

#### `led-strip-12v` — LED strip segment (12 V, white)

One cuttable 3-LED segment of a plain (non-addressable) 12 V strip: three 5050 LEDs and a resistor in series, so it goes straight on 12 V (~20 mA per segment) — dim it with PWM through a MOSFET. Below ~9 V it stays dark.

Pins: `P` (+12 V), `N` (− (to the MOSFET / GND))

#### `neopixel-ring` — NeoPixel ring (16 × WS2812)

16 WS2812B RGB LEDs on a ring — clocks, spinners, level meters. Adafruit_NeoPixel with 16 pixels; chain more from DOUT.

Pins: `GND`, `VCC` (+5 V), `DIN` (Data in), `DOUT` (Data out (to the next strip))

#### `neopixel-stick` — NeoPixel stick (8 × WS2812)

8 addressable RGB LEDs (WS2812B) in a row. Send colours down one data wire with Adafruit_NeoPixel; chain more strips from DOUT. Each LED draws up to 60 mA at full white.

Pins: `GND`, `VCC` (+5 V), `DIN` (Data in), `DOUT` (Data out (to the next strip))

#### `neopixel-strip` — NeoPixel LED strip (30 × WS2812B)

1 m of addressable LED strip, 30 WS2812B pixels. Power it from a 5 V supply (it can draw 1.8 A at full white!) and join the grounds; data from any pin through ~330 Ω.

Pins: `GND`, `VCC` (+5 V), `DIN` (Data in), `DOUT` (Data out (to the next strip))

#### `photodiode` — Photodiode

Light makes a small current flow from cathode to anode (reverse-biased use). Pair it with a resistor to get a voltage, or an op-amp for a transimpedance amplifier. Set the light level while simulating.

Pins: `A` (Anode), `K` (Cathode)

Props:
- `light` = 0.5 — Light; 0…1

#### `phototransistor` — Phototransistor (PT333 / L-14F1)

A transistor whose base is lit instead of wired: light lets current flow from the collector (short leg) to the emitter. Put a 10 kΩ resistor from +5 V to C and read C (dark = high, bright = low). Set the light level while simulating.

Pins: `C` (Collector (short leg)), `E` (Emitter (long leg))

Props:
- `lux` = 200 — Light; 0…2000 lx

#### `rgb-led` — RGB LED

Four-leg RGB LED. The longest leg is the common cathode (or anode).

Pins: `R` (Red), `COM` (Common cathode (−)), `G` (Green), `B` (Blue)

Props:
- `common` = "cathode" — Common pin; one of "cathode" (Common cathode), "anode" (Common anode)

#### `rgb-led-module` — RGB LED module (KY-016)

A common-cathode RGB LED with its three resistors on a little board: drive R, G and B from PWM pins (analogWrite) to mix any colour. No extra resistors needed.

Pins: `R` (Red (HIGH = on, PWM for mixing)), `G` (Green), `B` (Blue), `GND`

#### `schottky` — Schottky diode (1N5819)

Low forward drop (~0.3 V) and fast recovery — for reverse-polarity protection and switching supplies. 1 A.

Pins: `A` (Anode (+)), `K` (Cathode (−, banded))

#### `schottky-power` — Schottky power diode (SB560)

5 A, 60 V Schottky rectifier for high-current supplies and motor circuits.

Pins: `A` (Anode (+)), `K` (Cathode (−, banded))

#### `tvs` — TVS protection diode

Bidirectional transient-voltage-suppressor (clamps both polarities above ~6.8 V). Put it across a supply or data line to absorb spikes.

Pins: `1`, `2`

#### `zener` — Zener diode

Conducts in reverse at its Zener voltage — the classic cheap voltage reference / clamp. Put it cathode-to-positive with a series resistor.

Pins: `A` (Anode (+)), `K` (Cathode (−, banded))

Props:
- `vz` = 5.1 — Zener voltage; one of 3.3 (3.3 V), 4.7 (4.7 V), 5.1 (5.1 V), 6.2 (6.2 V), 9.1 (9.1 V), 12 (12 V), 15 (15 V)

## Transistors

#### `2n7000` — Small-signal MOSFET (2N7000)

A little N-channel MOSFET in a TO-92 case: turns on from ~2 V on the gate and switches up to 200 mA — LEDs, small relays, level shifting. Pinout S – G – D (flat side facing you). Add a 100 kΩ gate pull-down so it stays off when the pin floats.

Pins: `S` (Source), `G` (Gate), `D` (Drain)

#### `darlington` — Darlington transistor (TIP120)

NPN Darlington pair: current gain ~1000, 5 A. Pins B, C, E. Drives motors and solenoids from a single Arduino pin via ~1 kΩ; drops ~1 V when on.

Pins: `B` (Base), `C` (Collector), `E` (Emitter)

#### `igbt` — IGBT

Insulated-gate bipolar transistor (IRG4BC20 style): MOSFET-like gate, BJT-like ~1.5 V on-state drop. For high-voltage motor and inverter switching. Pins G, C, E.

Pins: `G` (Gate), `C` (Collector), `E` (Emitter)

#### `jfet` — JFET (2N5457)

N-channel JFET: conducts with 0 V on the gate and pinches off as the gate goes negative (Vgs(off) ≈ −1.5 V). Pins D, S, G.

Pins: `D` (Drain), `S` (Source), `G` (Gate)

#### `mosfet-module` — Logic-level MOSFET module

MOSFET switch board: connect SIG to a pin, and put your load between V+ and VOUT (low-side switch, up to ~5 A). The LED shows the gate state.

Pins: `SIG` (Signal (PWM ok)), `VCC` (VCC (logic)), `GND`, `VIN` (V+ (load supply)), `VOUT` (Load − (switched)), `LGND` (Load supply GND)

Internally connected: `GND` = `LGND`

#### `nmos` — MOSFET (N-channel)

N-channel enhancement MOSFET for low-side switching. Pins G, D, S. Choose a logic-level part (IRLZ44N, 2N7000) to drive it straight from 5 V pins.

Pins: `G` (Gate), `D` (Drain), `S` (Source)

Props:
- `part` = 1 — Part; one of 1 (IRLZ44N (logic level)), 2 (IRF540N (10 V gate))

#### `npn` — NPN transistor

NPN bipolar junction transistor in a TO-92 package. Pins left→right: Emitter, Base, Collector (flat face towards you).

Pins: `E` (Emitter), `B` (Base), `C` (Collector)

Props:
- `model` = "2N2222" — Model; one of "2N2222" (2N2222), "BC547" (BC547)

#### `optocoupler` — Optocoupler (PC817)

An LED shining on a phototransistor inside one package — the two sides are electrically isolated. Drive A/K through a resistor (~5–10 mA); C/E then conduct like a switch (CTR ≈ 100%).

Pins: `A` (1: LED anode), `K` (2: LED cathode), `E` (3: Emitter), `C` (4: Collector)

#### `pmos` — MOSFET (P-channel)

P-channel MOSFET (IRF9540N style) for high-side switching: source to the supply, pull the gate low to turn it on.

Pins: `G` (Gate), `D` (Drain), `S` (Source)

#### `pnp` — PNP transistor

PNP bipolar junction transistor in a TO-92 package. Pins left→right: Emitter, Base, Collector (flat face towards you).

Pins: `E` (Emitter), `B` (Base), `C` (Collector)

Props:
- `model` = "2N3906" — Model; one of "2N3906" (2N3906), "BC557" (BC557)

#### `scr` — SCR / thyristor (2N5064)

Silicon-controlled rectifier: a gate pulse latches it on (anode → cathode); it only turns off when the anode current falls below ~5 mA. Pins K, G, A.

Pins: `K` (Cathode), `G` (Gate), `A` (Anode)

#### `triac` — TRIAC (BT136)

Bidirectional thyristor for AC switching (dimmers, heaters). A small gate current (either polarity) turns it on; it stays on until the main current drops below the holding current (at the AC zero crossing). Pins MT1, MT2, G.

Pins: `MT1` (Main terminal 1), `MT2` (Main terminal 2), `G` (Gate)

## Switches & inputs

#### `arcade-button` — Arcade button (30 mm, with LED)

A chunky arcade push button with a light inside: C–NO close while it is held; the LED (LA +, LK −) has its resistor built in for 5 V. Read C/NO with INPUT_PULLUP and light the LED from another pin. Press it while simulating.

Pins: `C` (Switch common), `NO` (Switch normally open), `LA` (LED + (5 V, resistor built in)), `LK` (LED −)

#### `dip-switch` — DIP switch (8-way)

Eight tiny on/off switches in a DIP package (straddles the breadboard trench). Switch n connects pin n (top) to pin nb (bottom). Set them in the inspector.

Pins: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `1b`, `2b`, `3b`, `4b`, `5b`, `6b`, `7b`, `8b`

Props:
- `s1` = 0 — Switch 1; one of 0 (Off), 1 (On)
- `s2` = 0 — Switch 2; one of 0 (Off), 1 (On)
- `s3` = 0 — Switch 3; one of 0 (Off), 1 (On)
- `s4` = 0 — Switch 4; one of 0 (Off), 1 (On)
- `s5` = 0 — Switch 5; one of 0 (Off), 1 (On)
- `s6` = 0 — Switch 6; one of 0 (Off), 1 (On)
- `s7` = 0 — Switch 7; one of 0 (Off), 1 (On)
- `s8` = 0 — Switch 8; one of 0 (Off), 1 (On)

#### `door-sensor` — Magnetic door / window sensor (MC-38)

A reed switch in a white case plus a separate magnet: screw one to the frame and one to the door. The wires are connected while the magnet is next to it (door closed) and open when the door opens. Click to open / close the door while simulating.

Pins: `1`, `2`

Props:
- `closed` = 1 — Door; one of 1 (Closed (magnet near)), 0 (Open)

#### `e-stop` — Emergency stop button (latching, NC)

A big red mushroom button: its normally-closed contact opens when hit and stays open (latched) until the head is twisted to release it. Put it in series with the motor / heater supply, not just a microcontroller input. Click it while simulating.

Pins: `1`, `2`

Props:
- `hit` = 0 — Button; one of 0 (Released (circuit closed), 1 (Pressed (circuit open))

#### `joystick` — Joystick module

Two-axis thumb joystick (two 10 kΩ pots) with a push button. VRX/VRY sit at VCC/2 when centred. Drag the stick up/down on the canvas (Y) or set both axes in the inspector; press and hold without moving to click it.

Pins: `GND`, `VCC` (+5 V), `VRX` (X axis (analog)), `VRY` (Y axis (analog)), `SW` (Button (to GND when pressed))

Props:
- `x` = 0.5 — X; 0…1
- `y` = 0.5 — Y; 0…1

#### `key-switch` — Mechanical keyboard switch (MX style)

The switch under a mechanical keyboard key: the two pins connect while the stem is pressed (~2 mm travel). Wire one pin to GND and the other to an INPUT_PULLUP pin; debounce in code. Press it while simulating.

Pins: `1`, `2`

#### `keypad` — Keypad 4×4 (matrix)

16 membrane keys in a 4×4 matrix: pressing a key connects its row pin to its column pin. Scan it (Keypad library, or drive rows and read columns). Pick the key in the inspector and press the keypad on the canvas — or set it to stay held.

Pins: `R1` (Row 1), `R2` (Row 2), `R3` (Row 3), `R4` (Row 4), `C1` (Column 1), `C2` (Column 2), `C3` (Column 3), `C4` (Column 4)

Props:
- `key` = 1 — Key; one of 1 (1), 2 (2), 3 (3), 4 (A), 5 (4), 6 (5), 7 (6), 8 (B), 9 (7), 10 (8), 11 (9), 12 (C), 13 (*), 14 (0), 15 (#), 16 (D)
- `hold` = 0 — Mode; one of 0 (Pressed while you hold t), 1 (Held down)

#### `keypad-1x4` — Membrane keypad (1×4)

Four flat membrane buttons on a ribbon: each key connects its pin to COMMON. Wire COM to GND and read K1–K4 with INPUT_PULLUP (pressed = LOW). Drag sideways to pick a key, hold to press it.

Pins: `COM` (Common), `K1` (Key 1), `K2` (Key 2), `K3` (Key 3), `K4` (Key 4)

Props:
- `key` = 1 — Key under the finger; 1…4

#### `limit-switch` — Limit switch (micro switch with lever)

Snap-action micro switch: COM connects to NC at rest and to NO while the lever is pushed. Used as end stops on 3D printers and CNCs. Press it while simulating.

Pins: `COM` (C (common)), `NO` (NO (normally open)), `NC` (NC (normally closed))

#### `pushbutton` — Push button

Momentary tactile switch. Legs 1a/1b and 2a/2b are always connected; pressing connects side 1 to side 2. Click and hold it during simulation.

Pins: `1a` (Terminal 1a), `2a` (Terminal 2a), `1b` (Terminal 1b), `2b` (Terminal 2b)

Props:
- `cap` = "#e74c3c" — Cap colour; one of "#e74c3c" (Red), "#3b82f6" (Blue), "#22c55e" (Green), "#f5c518" (Yellow), "#374151" (Black)

Internally connected: `1a` = `1b`; `2a` = `2b`

#### `relay` — Relay (5 V, SPDT)

Electromechanical relay (SRD-05VDC): energise the 70 Ω coil with ~5 V (via a transistor — it needs 70 mA, and a flyback diode across the coil!) and COM switches from NC to NO. Contacts rated 10 A.

Pins: `COIL1` (Coil +), `COIL2` (Coil −), `COM` (Common), `NO` (Normally open), `NC` (Normally closed)

#### `relay-module` — Relay driver module

1-channel relay board: transistor driver, flyback diode and LED already fitted. Active-LOW input (pull IN to GND to switch). Screw terminals NO / COM / NC.

Pins: `GND`, `VCC` (+5 V), `IN` (IN (LOW = on)), `NO` (Normally open), `COM` (Common), `NC` (Normally closed)

#### `rocker-switch` — Rocker switch (KCD1)

The panel power switch found on power strips: I = on (the two pins connected), O = off. Rated 6 A at 250 V AC. Click it while simulating.

Pins: `1`, `2`

Props:
- `on` = 0 — Position; one of 0 (O (off)), 1 (I (on))

#### `rotary-switch` — Rotary switch (1-pole 4-way)

Selector switch: the common pin C connects to one of positions 1–4 (choose it in the inspector, even while simulating).

Pins: `C` (Common), `1`, `2`, `3`, `4`

Props:
- `pos` = 1 — Position; one of 1 (Position 1), 2 (Position 2), 3 (Position 3), 4 (Position 4)

#### `slide-switch` — Slide switch

SPDT slide switch. The middle pin (common) connects to the left or right pin. Click to flip it.

Pins: `1` (Terminal 1), `C` (Common), `2` (Terminal 2)

Props:
- `position` = 0 — Position; one of 0 (Left (C–1)), 1 (Right (C–2))

#### `slide-switch-3` — Slide switch (3-position, SP3T)

A slider with three positions: the common pin (C) connects to 1, 2 or 3 depending on where the knob sits — a mode selector (e.g. off / slow / fast). Drag it sideways while simulating.

Pins: `1`, `2`, `3`, `C` (Common)

Props:
- `pos` = 0 — Position; 0…2

#### `ssr` — Solid-state relay

Solid-state relay (Fotek SSR-25 DA style): 3–32 V DC on the input turns the load side on — silent, no contacts. Drop ≈ 1 V when on.

Pins: `INP` (Control + (3–32 V)), `INN` (Control −), `L1` (Load 1), `L2` (Load 2)

#### `toggle-switch` — Toggle switch (SPDT)

Panel toggle switch: the middle pin (C) connects to 1 when the lever is down and 2 when up. Click it while simulating.

Pins: `1`, `C` (Common), `2`

Props:
- `on` = 0 — Lever; one of 0 (Down (C–1)), 1 (Up (C–2))

#### `touch-4key` — 4-key capacitive touch module (TTP224)

Four touch pads on one board, each with its own output that goes HIGH while its pad is touched (no pull-ups needed). Drag sideways to move your finger over a pad, hold to touch it.

Pins: `VCC` (+2.4–5.5 V), `GND`, `O1` (Out 1 (HIGH while pad 1 touched)), `O2` (Out 2), `O3` (Out 3), `O4` (Out 4)

Props:
- `key` = 1 — Pad under the finger; 1…4

#### `touch-sensor` — Capacitive touch sensor (TTP223)

A touch button with no moving parts: SIG goes HIGH while a finger is on the pad (through thin plastic too). Read it like a button with digitalRead — no pull-up needed. Press the pad while simulating.

Pins: `SIG` (SIG (HIGH while touched)), `VCC` (+2–5.5 V), `GND`

## Power

#### `ac-source` — AC voltage source

Sine-wave source (like a signal generator or a low-voltage AC adapter). Set peak voltage and frequency; use it to drive transformers, rectifiers and filters.

Pins: `L` (Output), `N` (Common)

Props:
- `vpk` = 12 — Peak voltage; number in V, ≥ 0
- `f` = 50 — Frequency; number in Hz, ≥ 0.1

#### `ams1117` — LDO regulator (AMS1117)

Low-dropout regulator (3.3 V or 5 V, 1 A, ~1.1 V dropout) — the chip that makes 3.3 V on most boards. Pinout GND – OUT – IN.

Pins: `GND` (Ground / Adjust), `OUT` (Output), `IN` (Input (≤ 15 V))

Props:
- `vout` = 3.3 — Output; one of 3.3 (3.3 V), 5 (5.0 V)

#### `b0505s` — Isolated DC-DC converter (B0505S, 1 W)

A little SIP module that makes a second 5 V supply with NO electrical connection to the first (1 kV isolation) — its output − is not your ground. Used to power the far side of an isolated interface or to break ground loops. Unregulated: ~5 V at a 200 mA load.

Pins: `GND` (Input − (pin 1)), `VIN` (Input +5 V (pin 2)), `OUTN` (Output 0 V (isolated)), `OUTP` (Output +5 V (isolated))

#### `barrel-jack` — DC barrel jack (with wall adapter)

5.5 × 2.1 mm DC power jack with a plugged-in wall adapter (choose 5, 9 or 12 V, centre positive). Click it while simulating to unplug/plug. The switch pin SW is connected to the sleeve only while nothing is plugged in.

Pins: `TIP` (Centre pin (+)), `SW` (Switch), `SLV` (Sleeve (−))

Props:
- `volts` = 9 — Adapter; one of 5 (5 V 2 A), 9 (9 V 1 A), 12 (12 V 2 A)
- `plugged` = 1 — Plug; one of 1 (Plugged in), 0 (Unplugged)

#### `battery` — Battery

Battery with realistic internal resistance. Choose 9 V, 2×AA, 4×AA or a coin cell. Wire from its terminals.

Pins: `+` (Positive (+)), `-` (Negative (−))

Props:
- `kind` = "9V" — Type; one of "9V" (9 V battery), "AA2" (2 × AA (3 V)), "AA4" (4 × AA (6 V)), "coin" (CR2032 coin cell (3 V))

#### `battery-18650` — 18650 Li-ion cell

The common 18 mm × 65 mm lithium-ion cell: 4.2 V full, 3.6–3.7 V nominal, ~3.0 V empty, high current capable. Put it in a holder and protect it with a BMS/protection board.

Pins: `P` (+), `N` (−)

Props:
- `cap` = 3000 — Capacity; one of 3000 (3000 mAh), 2500 (2500 mAh), 3500 (3500 mAh)
- `charge` = 80 — Initial charge; 0…100 %

#### `battery-holder` — Battery holder (AA, with switch)

Holder for 2–4 AA cells (1.5 V each, ~0.15 Ω per cell) with an on/off slide switch. Click it while simulating to switch it.

Pins: `P` (+ (red)), `N` (− (black))

Props:
- `cells` = 4 — Cells; one of 2 (2 × AA (3 V)), 3 (3 × AA (4.5 V)), 4 (4 × AA (6 V))
- `on` = 1 — Switch; one of 0 (Off), 1 (On)

#### `battery-snap` — Battery connector (9 V snap)

A 9 V snap clip with red/black leads — clip it onto a 9 V battery (wire the battery’s + and − to the snap) and plug the leads into the breadboard.

Pins: `SP` (Snap + (to battery +)), `SN` (Snap − (to battery −)), `P` (Red lead +), `N` (Black lead −)

Internally connected: `SP` = `P`; `SN` = `N`

#### `bms-3s` — Battery management system (3S BMS)

3-cell (11.1 V) Li-ion BMS: watches every cell — cuts P− off if any cell is below 2.5 V or above 4.25 V or the current exceeds 10 A, and bleeds cells above 4.18 V to balance them. Connect the cell taps B−, B1, B2, B+; the load goes between B+ and P−.

Pins: `BN` (B− (cell 1 −)), `B1` (B1 (cell 1 + / cell 2 −)), `B2` (B2 (cell 2 + / cell 3 −)), `BP` (B+ (cell 3 +, = P+)), `PN` (P− (load / charger −))

#### `boost-converter` — Boost converter (MT3608)

Step-up switching regulator module (2–24 V in, up to 28 V out, 2 A switch). Raises e.g. a 3.7 V LiPo to 5 V or 12 V; the input current is higher than the output current. It cannot go below its input.

Pins: `INP` (IN+), `INN` (IN−), `OUTP` (OUT+), `OUTN` (OUT−)

Props:
- `vset` = 12 — Output (trim pot); 5…28 V

Internally connected: `INN` = `OUTN`

#### `bridge-rectifier` — Bridge rectifier (KBP307)

Four diodes in one package: turns AC (between the two ~ pins) into pulsing DC on + and −, losing ~1.4 V. Add a big smoothing capacitor across + / −.

Pins: `P` (+), `AC1` (~ AC), `AC2` (~ AC), `N` (−)

#### `buck-boost` — Buck-boost converter (XL6019)

Automatic step-up/step-down module (3.5–30 V in, 1.25–26 V out): holds the set output whether the input is above or below it — ideal for batteries that sag.

Pins: `INP` (IN+), `INN` (IN−), `OUTP` (OUT+), `OUTN` (OUT−)

Props:
- `vset` = 12 — Output (trim pot); 1.25…26 V

Internally connected: `INN` = `OUTN`

#### `buck-converter` — Buck converter (LM2596)

Step-down switching regulator module (4–40 V in, 1.25–35 V out, 3 A). Efficient: the input draws less current than the output. Turn the trim pot to set the output (it can only go below the input).

Pins: `INP` (IN+), `INN` (IN−), `OUTP` (OUT+), `OUTN` (OUT−)

Props:
- `vset` = 5 — Output (trim pot); 1.25…35 V

Internally connected: `INN` = `OUTN`

#### `coin-cell` — Coin cell holder (CR2032, 3 V)

A 3 V lithium coin cell (220 mAh) in a PCB holder. Great for low-power sensors and real-time clocks, but it has ~15 Ω of internal resistance — it sags badly above ~10 mA, so it cannot run motors or many LEDs.

Pins: `P` (+), `N` (−)

Props:
- `charge` = 100 — Initial charge; 0…100 %

#### `fuse` — Fuse holder (5×20 mm fuse)

Glass fuse in a holder: a thin wire that melts if the current stays above its rating (faster the bigger the overload), cutting the circuit. Once blown it stays open — stop and restart the simulation to fit a new one.

Pins: `1`, `2`

Props:
- `rating` = 1 — Rating; one of 0.5 (0.5 A), 1 (1 A), 2 (2 A), 5 (5 A)

#### `ht7333` — HT7333 3.3 V LDO (TO-92)

A tiny 3.3 V regulator with only ~0.1 V dropout and 4 µA quiescent current — ideal to run a 3.3 V sensor or ESP from a Li-ion cell or 3 AA batteries. Up to 250 mA. Pinout GND – IN – OUT.

Pins: `GND` (Ground), `IN` (Input (≤ 12 V)), `OUT` (3.3 V out)

#### `icl7660` — ICL7660 charge-pump voltage inverter

Makes a negative supply from a positive one with just two 10 µF capacitors: VOUT ≈ −VCC (−5 V from 5 V), up to ~20 mA — enough for an op-amp's negative rail or an LCD bias. The output sags ~55 Ω per mA drawn.

Pins: `NC` (1: not connected), `CAPP` (2: CAP+ (10 µF to CAP−)), `GND` (3: GND), `CAPN` (4: CAP−), `VOUT` (5: Output (−VCC)), `LV` (6: Low-voltage (to GND below 3.5 V)), `OSC` (7: Oscillator), `VCC` (8: V+ (1.5–10 V))

#### `lab-psu` — Bench power supply (0–30 V, current limit)

An adjustable lab supply with two knobs: the voltage, and a current limit. When the load tries to draw more than the limit, the voltage drops so exactly the limit flows and the CC light comes on — the safest way to power up a new circuit. Set both while simulating.

Pins: `P` (+ (red)), `N` (− (black))

Props:
- `vset` = 5 — Voltage; 0…30 V
- `ilim` = 1 — Current limit; 0.01…5 A

#### `lifepo4` — LiFePO4 cell (3.2 V, 18650)

A lithium-iron-phosphate cell: 3.2 V with a very flat discharge, thousands of cycles and no fire risk — and it can run 3.3 V parts directly, no regulator. 1500 mAh, charge to 3.6 V max.

Pins: `P` (+), `N` (−)

Props:
- `charge` = 90 — Initial charge; 0…100 %

#### `liion-protect` — Li-ion protection board (1S, DW01)

DW01 + dual MOSFET protection for one Li-ion cell: disconnects P− if the cell drops below 2.5 V, rises above 4.28 V or the current exceeds ~3 A; reconnects once the cell is back in range. The cell goes on B+/B−, the load/charger on P+/P−.

Pins: `BP` (B+ (cell +)), `BN` (B− (cell −)), `PP` (P+ (load / charger +)), `PN` (P− (load / charger −))

Internally connected: `BP` = `PP`

#### `lipo` — LiPo battery (1S, 3.7 V)

Single-cell lithium-polymer pack: 4.2 V full, 3.7 V nominal, ~3.0 V empty. The charge state drops as you draw current (and rises when charged, e.g. from a TP4056). Do not discharge below 3 V.

Pins: `P` (+), `N` (−)

Props:
- `cap` = 1000 — Capacity; one of 1000 (1000 mAh), 500 (500 mAh), 2000 (2000 mAh)
- `charge` = 80 — Initial charge; 0…100 %

#### `lm317` — Adjustable regulator (LM317)

Adjustable linear regulator: keeps 1.25 V between OUT and ADJ, so with R1 (OUT→ADJ, 240 Ω) and R2 (ADJ→GND): Vout = 1.25 × (1 + R2/R1). 1.2–37 V, 1.5 A, ~2 V dropout.

Pins: `ADJ` (Adjust), `OUT` (Output), `IN` (Input (≤ 40 V))

#### `pin-header` — Pin header (1×8 male)

A strip of 0.1" male header pins — solder it to a module to plug it into a breadboard, or use it as a connector. Each pin is its own connection.

Pins: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`

#### `polyfuse` — Resettable fuse (polyfuse)

PTC polyfuse: a low resistance until an overload (≈ 2 × the hold current) heats it; then it jumps to high resistance and stays hot while the fault remains. Remove the overload and it cools down and resets by itself.

Pins: `1`, `2`

Props:
- `ih` = 0.5 — Hold current; one of 0.1 (0.1 A), 0.25 (0.25 A), 0.5 (0.5 A), 1.1 (1.1 A), 2.5 (2.5 A)

#### `power-bank` — USB power bank (5 V, 10 000 mAh)

A pocket battery with a USB 5 V output (up to 2.1 A) — the easy way to run an Arduino, a Pi Pico or a small robot without a cable. The four LEDs show the charge left. (Real ones switch off if the load is below ~50 mA.)

Pins: `VBUS` (USB +5 V), `GND` (USB GND)

Props:
- `charge` = 90 — Initial charge; 0…100 %

#### `power-distribution` — Power distribution board

Bus board that fans one supply out to four screw-terminal outputs (all + joined, all − joined), with a power LED — keeps a robot’s wiring tidy.

Pins: `INP` (Input +), `INN` (Input −), `O1P` (Output 1 +), `O1N` (Output 1 −), `O2P` (Output 2 +), `O2N` (Output 2 −), `O3P` (Output 3 +), `O3N` (Output 3 −), `O4P` (Output 4 +), `O4N` (Output 4 −)

Internally connected: `INP` = `O1P` = `O2P` = `O3P` = `O4P`; `INN` = `O1N` = `O2N` = `O3N` = `O4N`

#### `reg-3v3-module` — 3.3 V regulator module (AMS1117)

A tiny board with an AMS1117-3.3 LDO and its capacitors: 4.5–12 V in, a steady 3.3 V out for ESP8266/ESP32 radios, sensors and SD cards. Burns the difference as heat — keep (VIN − 3.3 V) × current under about 1 W.

Pins: `IN` (VIN (4.5–12 V)), `GND`, `OUT` (3.3 V out (up to ~800 mA))

#### `reg-78xx` — Voltage regulator (78xx)

Fixed linear regulator (7805 / 7809 / 7812): IN – GND – OUT. Needs IN at least ~2 V above the output; the excess voltage × current becomes heat. Add 0.33 µF / 0.1 µF capacitors in a real build.

Pins: `IN` (Input (7–35 V)), `GND` (Ground), `OUT` (Output)

Props:
- `vout` = 5 — Type; one of 5 (7805 (5 V)), 9 (7809 (9 V)), 12 (7812 (12 V))

#### `reg-79xx` — Negative voltage regulator (79xx)

The negative twin of the 78xx: turns an unregulated negative supply into a fixed −5, −9 or −12 V — with a 7805 it makes the ± rails op-amps love. Note the different pinout: GND, IN, OUT. Needs ~2 V of headroom.

Pins: `GND` (Ground), `IN` (Input (−7 … −35 V)), `OUT` (Output (−5 V))

Props:
- `vout` = 5 — Type; one of 5 (7905 (−5 V)), 9 (7909 (−9 V)), 12 (7912 (−12 V))

#### `solar-controller` — Solar charge controller (PWM, 12 V)

Charges a 12 V lead-acid/LiFePO4 battery from a solar panel: passes panel current while the battery is below 14.4 V (with reverse-current blocking at night), and switches the load off below 11.1 V (back on above 12.6 V).

Pins: `PVP` (Solar +), `PVN` (Solar −), `BATP` (Battery +), `BATN` (Battery −), `LP` (Load +), `LN` (Load −)

Internally connected: `PVN` = `BATN` = `LN`

#### `solar-panel` — Solar panel

Photovoltaic panel: a current source proportional to the sunlight, limited to the open-circuit voltage (Voc). Set the irradiance (1000 W/m² = full sun) while simulating. 6 V 1 W: Voc 7.2 V, Isc 0.2 A; 12 V 10 W: Voc 21.6 V, Isc 0.6 A.

Pins: `PVP` (Solar panel +), `PVN` (Solar panel −)

Props:
- `sun` = 800 — Sunlight; 0…1100 W/m²
- `size` = 1 — Panel; one of 0 (6 V 1 W), 1 (12 V 10 W)

#### `terminal-block` — Terminal block (2-way screw)

5 mm PCB screw terminal: clamp a wire under each screw; the pin below it carries that wire into the board.

Pins: `W1` (Screw 1), `W2` (Screw 2), `P1` (Pin 1), `P2` (Pin 2)

Internally connected: `W1` = `P1`; `W2` = `P2`

#### `tl431` — TL431 adjustable shunt reference

A "programmable zener": it sinks whatever current keeps its REF pin at 2.495 V above the anode. REF tied to K gives a 2.5 V reference; a divider R1/R2 from K sets Vk = 2.495 × (1 + R1/R2), up to 36 V. Feed it through a resistor (1–100 mA).

Pins: `REF` (Reference (2.495 V above the anode)), `A` (Anode), `K` (Cathode)

#### `tp4056` — Li-ion charging module (TP4056)

Single-cell Li-ion/LiPo charger (5 V in): constant current (1 A by default) until the cell reaches 4.2 V, then constant voltage while the current tapers. Red LED = charging, blue = done. Deeply flat cells get a gentle trickle first.

Pins: `INP` (IN+ (5 V, or the USB socket)), `INN` (IN−), `BP` (B+ (to cell +)), `BN` (B− (to cell −)), `OUTP` (OUT+ (= B+)), `OUTN` (OUT− (= B−))

Props:
- `iset` = 1 — Charge current (Rprog); one of 1 (1 A (1.2 kΩ)), 0.5 (500 mA (2.4 kΩ)), 0.13 (130 mA (10 kΩ))

Internally connected: `INN` = `BN` = `OUTN`; `BP` = `OUTP`

#### `usb-breakout` — USB connector (micro-B breakout)

Micro-USB socket on a breakout board, plugged into a computer or phone charger: VBUS gives 5 V (a PC port allows 0.5 A). D+/D− are the data lines (not simulated). Click to unplug.

Pins: `VBUS` (VBUS (+5 V)), `DM` (D−), `DP` (D+), `ID`, `GND`

Props:
- `plugged` = 1 — Cable; one of 1 (Plugged in), 0 (Unplugged)

#### `usbc-power` — USB-C power module (PD trigger)

USB-C socket with a Power Delivery trigger chip: asks the charger for 5, 9, 12, 15 or 20 V (up to 3 A) and puts it on the screw terminals. Click to unplug.

Pins: `VOUT` (Output +), `GND` (Output −)

Props:
- `volts` = 12 — Requested voltage; one of 5 (5 V), 9 (9 V), 12 (12 V), 15 (15 V), 20 (20 V)
- `plugged` = 1 — Cable; one of 1 (Plugged in), 0 (Unplugged)

## Outputs (motors, sound, lights)

#### `active-buzzer` — Active buzzer (5 V)

A buzzer with its own oscillator: just apply 3–5 V (a pin is fine, ~25 mA) and it beeps at ~2.3 kHz. No tone() needed — unlike a passive buzzer / piezo it can play only its one note. The long leg is +.

Pins: `P` (+ (long leg)), `N` (−)

#### `bldc-motor` — Brushless DC motor (A2212 1000KV)

Outrunner brushless motor (1000 rpm per volt, 7–12 V, up to ~12 A with a prop). Wire U/V/W to an ESC or BLDC controller. (Simplified: the controller’s 3-phase drive is modelled as its average voltage across U–V.)

Pins: `U` (Phase U), `V` (Phase V), `W` (Phase W)

#### `coreless-motor` — Coreless motor (8520)

8.5 × 20 mm coreless motor as used in micro drones: 3.7 V, ~45 000 rpm, spins up in milliseconds. Drive it with a logic-level MOSFET + PWM.

Pins: `P` (Motor +), `N` (Motor −)

#### `dc-fan` — Cooling fan (40 mm, 5 V)

Brushless 40 mm fan for cooling regulators, drivers and enclosures: 5 V, ~0.1 A, spins up in a second or so. Red is +, black is −. Switch it with a transistor; slow it with PWM.

Pins: `P` (+ (red)), `N` (− (black))

#### `dc-motor` — DC motor

Small brushed hobby motor (≈6 V, ~6000 rpm no-load) with back-EMF and inertia. Drive it through a transistor, not straight from a pin.

Pins: `+` (Terminal + (red)), `-` (Terminal − (black))

#### `electromagnet` — Lifting electromagnet (5 V, 25 N)

A coil in a steel cup that grabs iron while powered (~2.5 kg at 5 V, 0.25 A) — pick-and-place toys, door holders, magnetic locks. It is an inductor: drive it with a transistor and put a flyback diode across it.

Pins: `P` (+ (red)), `N` (− (black))

#### `gear-motor` — Gear motor (TT, 1:48)

The yellow "TT" robot-car motor: brushed DC motor with a 1:48 plastic gearbox, ~200 rpm at 6 V (3–6 V). Stall ~1 A — drive it from a motor driver.

Pins: `P` (Motor +), `N` (Motor −)

#### `heater-pad` — Heating pad (5 V, 5 W)

A flexible polyimide heater (5 Ω): 5 V gives 5 W, warming an enclosure, a seed tray or a 3D-print bed toy. Draws 1 A — switch it with a MOSFET and control it from a temperature sensor.

Pins: `P` (+ (red)), `N` (− (black))

#### `lcd` — LCD 16×2 (parallel)

HD44780 character LCD. Use the LiquidCrystal library, e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2) for RS, E, D4–D7. Power VDD/VSS, tie RW to GND, feed V0 from a pot (or GND for full contrast) and the backlight A/K through a resistor.

Pins: `VSS` (VSS (GND)), `VDD` (VDD (+5 V)), `V0` (V0 (contrast)), `RS` (RS (register select)), `RW` (R/W (tie to GND)), `E` (E (enable)), `D0` (Data D0), `D1` (Data D1), `D2` (Data D2), `D3` (Data D3), `D4` (Data D4), `D5` (Data D5), `D6` (Data D6), `D7` (Data D7), `A` (A (backlight +)), `K` (K (backlight −))

Props:
- `size` = "16x2" — Size; one of "16x2" (16 × 2), "20x4" (20 × 4)
- `color` = "green" — Colour; one of "green" (Yellow-green), "blue" (Blue / white text)

#### `lcd-i2c` — LCD 16×2 I2C

Character LCD with a PCF8574 I2C backpack: only GND, VCC, SDA and SCL. Use LiquidCrystal_I2C lcd(0x27, 16, 2). On the Uno SDA = A4, SCL = A5; on the ESP32 SDA = GPIO21, SCL = GPIO22.

Pins: `GND`, `VCC` (VCC (+5 V)), `SDA`, `SCL`

Props:
- `size` = "16x2" — Size; one of "16x2" (16 × 2), "20x4" (20 × 4)
- `color` = "blue" — Colour; one of "green" (Yellow-green), "blue" (Blue / white text)
- `address` = 39 — I2C address; one of 39 (0x27), 63 (0x3F), 32 (0x20)

#### `light-bulb` — Incandescent bulb (E10, 1.2 W)

A tungsten filament: cold it has about a tenth of its hot resistance, so it takes a big inrush current and glows up over a few tens of milliseconds. Pick the 6 V or 12 V version.

Pins: `A`, `B`

Props:
- `vn` = 6 — Rating; one of 6 (6 V 0.2 A), 12 (12 V 0.1 A)

#### `linear-actuator` — Linear actuator (12 V, 100 mm)

Motor + lead screw that pushes a rod in and out (~10 mm/s at 12 V; reverse the polarity to retract). Built-in limit switches stop it at both ends.

Pins: `A` (Red (+ extends)), `B` (Black)

#### `mic-module` — Electret microphone amplifier (MAX4466)

Microphone + adjustable-gain amplifier: OUT is the audio waveform centred on VCC/2. Pick the test tone and loudness while simulating, then sample it with analogRead or look at it on the oscilloscope.

Pins: `OUT` (Audio out (VCC/2 ± signal)), `GND`, `VCC` (+2.4–5.5 V)

Props:
- `level` = 0.3 — Loudness; 0…1
- `f` = 220 — Sound; one of 100 (100 Hz hum), 220 (220 Hz (A3)), 440 (440 Hz (A4))

#### `n20-motor` — N20 micro gear motor (1:100)

Tiny metal-gear motor (12 mm): ~300 rpm at 6 V with a 1:100 gearbox, stall ~0.4 A. For small robots and mechanisms.

Pins: `P` (Motor +), `N` (Motor −)

#### `neon-lamp` — Neon indicator lamp (230 V, with resistor)

The orange glow lamp in mains switches: a neon bulb plus a 100 kΩ resistor, so it can sit directly across 110–230 V AC and draws under 1 mA. The gas only strikes above ~70 V — it stays dark on low voltages.

Pins: `L1` (Lead 1), `L2` (Lead 2)

#### `panel-led` — Panel indicator LED (12 V, chrome bezel)

A front-panel pilot light: an LED with its resistor built in, in a threaded metal bezel with solder tags — connect it straight to 12 V (~15 mA). Green here; red/blue/yellow ones work the same.

Pins: `P` (+ (12 V)), `N` (−)

#### `peltier` — Peltier module (TEC1-12706)

A thermoelectric cooler: current pumps heat from one ceramic face to the other — one side goes cold, the other hot (up to ~65 °C apart). 12 V, up to 6 A: drive it with a big MOSFET and put a heatsink on the hot side. Reverse the current to swap sides.

Pins: `P` (+ (red)), `N` (− (black))

#### `piezo` — Piezo buzzer

Passive piezo buzzer. It sounds when driven with a changing signal, e.g. tone(pin, 440) or PWM. Sound can be muted from the toolbar.

Pins: `+` (Positive (+)), `-` (Negative (−))

#### `planetary-motor` — Planetary gear motor (12 V, 1:30)

37 mm 12 V motor with a planetary gearbox: ~330 rpm, high torque, stall ~4 A. Needs a proper motor driver (L298N, BTS7960…).

Pins: `P` (Motor +), `N` (Motor −)

#### `servo` — Servo motor

Hobby servo. Brown = GND, red = +5 V, orange = signal. Drive it with the Servo library: servo.attach(pin); servo.write(angle). Continuous-rotation servos turn at a speed set by the angle (90 = stop).

Pins: `-` (GND (brown)), `+` (+5 V (red)), `SIG` (Signal (orange))

Props:
- `model` = "sg90" — Model; one of "sg90" (SG90 micro (180°)), "mg996r" (MG996R high-torque (180°)), "fs90r" (FS90R continuous rotation)

#### `siren` — Alarm siren (12 V, 110 dB)

A loud electronic siren with its own wailing oscillator: apply 6–12 V (~120 mA) and it howls up and down. For burglar and fire alarms — switch it with a transistor or relay.

Pins: `P` (+ (red)), `N` (− (black))

#### `solenoid` — Push-pull solenoid (12 V)

Electromagnet that yanks a steel plunger in while powered (12 V, ~0.5 A). It is an inductor: switch it with a transistor/MOSFET and put a flyback diode across it.

Pins: `1`, `2`

#### `solenoid-valve` — Solenoid water valve (12 V, ½")

An electrically opened water valve: 12 V on the coil (~0.4 A) lifts the plunger and water flows; off, it closes. It is an inductor: switch it with a MOSFET or relay and add a flyback diode. Needs some water pressure to seal (not for gravity feed).

Pins: `P` (Coil +), `N` (Coil −)

#### `speaker` — Speaker (8 Ω)

8 Ω 0.5 W speaker. Plays the tone reaching it; loud and power-hungry — drive it through a transistor or an amplifier, and use a series resistor/capacitor from a pin.

Pins: `P` (+), `N` (−)

#### `stepper-28byj48` — Stepper motor (28BYJ-48, 5 V)

Cheap geared unipolar stepper: 2048 steps per output revolution (full-step). Red is the common +5 V; pull the four coil wires LOW in sequence through a ULN2003 driver board. Works with the Arduino Stepper library (Stepper(2048, IN1, IN3, IN2, IN4)).

Pins: `RED` (Red (+5 V common)), `ORG` (Orange), `YEL` (Yellow), `PNK` (Pink), `BLU` (Blue)

#### `stepper-nema17` — Stepper motor (NEMA 17, bipolar)

200 steps/rev (1.8°) bipolar stepper with two coils (A1–A2, B1–B2). The shaft follows the magnetic field: energise the coils in sequence from an H-bridge (L298N) or a step/dir driver (A4988, DRV8825, TMC2208).

Pins: `A1` (Coil A+ (black)), `A2` (Coil A− (green)), `B1` (Coil B+ (red)), `B2` (Coil B− (blue))

Props:
- `r` = 30 — Winding; one of 30 (12 V type (30 Ω, 0.4 A)), 1.5 (17HS4401 (1.5 Ω, 1.7 A –)

#### `traffic-light` — Traffic light module (R / Y / G)

Three 8 mm LEDs with their resistors already on the board — wire R, Y and G straight to Arduino pins (HIGH = on) and GND to ground. The classic first "state machine" project.

Pins: `GND`, `R` (Red (HIGH = on)), `Y` (Yellow (HIGH = on)), `G` (Green (HIGH = on))

#### `vibration-motor` — Vibration motor (coin, 10 mm)

The buzz motor from phones: an off-centre weight in a flat coin. 2.5–3.5 V, ~70 mA — too much for a pin, so switch it with a transistor (and add a flyback diode).

Pins: `P` (+ (red)), `N` (− (blue))

#### `water-pump` — Mini water pump (3–6 V submersible)

Tiny submersible pump for plant waterers and fountains: ~120 L/h at 5 V, drawing ~0.2 A (switch it with a transistor or relay). Never run it dry for long.

Pins: `P` (+ (red)), `N` (− (black))

## Motor & driver modules

#### `a4988` — A4988 stepper driver

Step/dir driver for one bipolar stepper (up to 2 A, 8–35 V). Each rising edge on STEP moves one (micro)step in the DIR direction; MS1–MS3 choose full … 1/16 steps. Set the current limit with the pot. Tie RESET to SLEEP; ENABLE is active LOW.

Pins: `EN` (1: ENABLE (LOW = on)), `MS1` (2: MS1), `MS2` (3: MS2), `MS3` (4: MS3), `RST` (5: RESET (tie to SLEEP)), `SLP` (6: SLEEP (HIGH = awake)), `STEP` (7: STEP (one microstep per rising edge)), `DIR` (8: DIR), `GND2` (9: GND), `VDD` (10: Logic 3.3–5 V), `A2` (11: 1B (coil 1)), `A1` (12: 1A (coil 1)), `B1` (13: 2A (coil 2)), `B2` (14: 2B (coil 2)), `GND` (15: GND), `VMOT` (16: Motor supply (8–35 V, add 100 µF))

Props:
- `ilim` = 1 — Current limit (Vref pot); 0.1…2.5 A

Internally connected: `GND` = `GND2`

#### `bldc-controller` — BLDC motor controller (ZS-X11H)

Sensor/sensorless brushless controller board for bigger BLDC motors (6–60 V, 16 A). The SPEED pin sets the speed from a 0–5 V level or a PWM signal; DIR reverses; BRAKE HIGH shorts the windings. (Simplified 3-phase drive.)

Pins: `SPEED` (Speed (0–5 V or PWM)), `DIR` (Direction), `BRAKE` (Brake (HIGH = brake)), `V5` (+5 V out), `GNDL` (Logic GND), `VIN` (Supply + (6–60 V)), `GND` (Supply −), `U` (Phase U), `V` (Phase V), `W` (Phase W)

Internally connected: `GND` = `GNDL`

#### `bts7960` — BTS7960 43 A motor driver

High-current H-bridge (two BTS7960 half-bridges, 43 A, 6–27 V) for big DC motors. Enable both R_EN and L_EN, then PWM RPWM for one direction or LPWM for the other (keep the other LOW). R_IS/L_IS output a voltage proportional to the current.

Pins: `RPWM` (RPWM (forward PWM)), `LPWM` (LPWM (reverse PWM)), `REN` (R_EN (HIGH to enable)), `LEN` (L_EN (HIGH to enable)), `RIS` (R_IS current sense), `LIS` (L_IS current sense), `VCC` (+5 V logic), `GND`, `BP` (B+ (6–27 V)), `BN` (B− (power GND)), `MP` (M+), `MN` (M−)

Internally connected: `GND` = `BN`

#### `drv8825` — DRV8825 stepper driver

Higher-voltage step/dir stepper driver (2.2 A, 8.2–45 V, up to 1/32 microstepping via M0–M2). Pin-compatible with the A4988: one (micro)step per STEP rising edge.

Pins: `EN` (1: ENABLE (LOW = on)), `M0` (2: M0), `M1` (3: M1), `M2` (4: M2), `RST` (5: RESET (tie to SLEEP)), `SLP` (6: SLEEP (HIGH = awake)), `STEP` (7: STEP (one microstep per rising edge)), `DIR` (8: DIR), `GND2` (9: GND), `VDD` (10: Logic 3.3–5 V), `A2` (11: 1B (coil 1)), `A1` (12: 1A (coil 1)), `B1` (13: 2A (coil 2)), `B2` (14: 2B (coil 2)), `GND` (15: GND), `VMOT` (16: Motor supply (8–45 V, add 100 µF))

Props:
- `ilim` = 1.5 — Current limit (Vref pot); 0.1…2.5 A

Internally connected: `GND` = `GND2`

#### `drv8833` — DRV8833 dual motor driver

Tiny low-voltage dual H-bridge (1.5 A, 2.7–10.8 V) — great for small robots on batteries. Per motor: IN1 HIGH / IN2 LOW = forward, LOW/HIGH = reverse, both HIGH = brake, both LOW = coast. PWM an input for speed.

Pins: `IN1` (AIN1), `IN2` (AIN2), `IN3` (BIN1), `IN4` (BIN2), `SLP` (nSLEEP (HIGH/open = run)), `GND`, `VM` (VM 2.7–10.8 V), `OUT1` (AOUT1), `OUT2` (AOUT2), `OUT3` (BOUT1), `OUT4` (BOUT2)

#### `dual-hbridge` — Dual H-bridge module (MX1508)

Cheap two-motor H-bridge board (1.5 A per channel, 2–10 V). IN1/IN2 control motor A and IN3/IN4 motor B: one input HIGH turns it one way, the other input the other way; both HIGH brakes. PWM the active input for speed.

Pins: `IN1`, `IN2`, `IN3`, `IN4`, `VCC` (+ (2–10 V motor supply)), `GND`, `OUT1` (Motor A), `OUT2` (Motor A), `OUT3` (Motor B), `OUT4` (Motor B)

#### `esc` — ESC (brushless speed controller, 30 A)

Hobby ESC for a brushless motor: takes RC servo pulses on SIG (1000 µs = stop … 2000 µs = full) — drive it with Servo.writeMicroseconds(). Arms when it first sees a low-throttle pulse. Its BEC supplies 5 V. (Simplified 3-phase drive.)

Pins: `SIG` (Signal (servo pulses, 1–2 ms)), `BEC` (+5 V BEC out), `GNDS` (Signal GND), `VBAT` (Battery + (2–3S LiPo)), `GND` (Battery −), `U` (Motor phase U), `V` (Motor phase V), `W` (Motor phase W)

Internally connected: `GND` = `GNDS`

#### `hbridge` — H-bridge module (L9110S, single)

One small H-bridge (800 mA, 2.5–12 V) for one DC motor. IA HIGH + IB LOW spins one way, IA LOW + IB HIGH the other; both the same stops (both outputs LOW). PWM the HIGH input for speed.

Pins: `IA` (A-IA), `IB` (A-IB), `VCC` (VCC 2.5–12 V), `GND`, `OA` (Motor), `OB` (Motor)

#### `l293d` — L293D quad half-H driver

Four half-bridges (600 mA each, built-in flyback diodes) = two H-bridges in a DIP-16. Motor between 1Y and 2Y; drive 1A/2A for direction and PWM the 1,2EN pin for speed. VCC1 = 5 V logic, VCC2 = motor supply.

Pins: `EN12` (1: 1,2 Enable), `A1` (2: 1A), `Y1` (3: 1Y (motor)), `GND1` (4: GND / heat sink), `GND2` (5: GND), `Y2` (6: 2Y (motor)), `A2` (7: 2A), `VCC2` (8: VCC2 motor supply (4.5–36 V)), `EN34` (9: 3,4 Enable), `A3` (10: 3A), `Y3` (11: 3Y (motor)), `GND3` (12: GND), `GND4` (13: GND), `Y4` (14: 4Y (motor)), `A4` (15: 4A), `VCC1` (16: VCC1 logic 5 V)

Internally connected: `GND1` = `GND2` = `GND3` = `GND4`

#### `l298n` — L298N dual motor driver

Two H-bridges (2 A each, 5–35 V) for two DC motors or one bipolar stepper. IN1/IN2 set motor A’s direction (HIGH/LOW = forward, LOW/HIGH = back, equal = brake); ENA enables it (PWM it for speed, or leave the jumper on). Its bipolar switches drop ~2 V. With the 5 V jumper on, the on-board regulator supplies 5 V out.

Pins: `ENA` (ENA (PWM speed A; jumper = full speed)), `IN1` (IN1 (direction A)), `IN2`, `IN3` (IN3 (direction B)), `IN4`, `ENB` (ENB (PWM speed B)), `V12` (+12 V motor supply (5–35 V)), `GND`, `V5` (+5 V (out with the 5 V jumper fitted)), `OUT1` (Motor A), `OUT2` (Motor A), `OUT3` (Motor B), `OUT4` (Motor B)

Props:
- `jumperA` = 0 — ENA jumper; one of 0 (Off (drive ENA)), 1 (On (always enabled))
- `jumperB` = 0 — ENB jumper; one of 0 (Off (drive ENB)), 1 (On (always enabled))
- `reg` = 1 — 5 V regulator jumper; one of 1 (On (5 V out)), 0 (Off (feed 5 V in))

#### `mosfet-switch` — MOSFET switch module (IRF520)

IRF520 low-side switch board for motors, LED strips and solenoids up to 24 V. SIG HIGH switches V− to ground. Beware: the IRF520 is not logic-level — at 5 V on the gate it only passes ~1 A (it needs ~10 V for full current).

Pins: `SIG` (SIG (gate)), `VCC` (VCC (not used)), `GND`, `VIN` (VIN (load supply +)), `GNDP` (GND (load supply −)), `LP` (V+ (load +)), `LN` (V− (load −, switched))

Internally connected: `VIN` = `LP`; `GND` = `GNDP`

#### `pca9685` — PCA9685 16-channel PWM / servo driver

16 independent 12-bit PWM outputs over I2C (0x40) — drive 16 servos (setPWMFreq(50)) or dim LEDs without using the board's pins. Power the servos from V+, not the board. Use Adafruit_PWMServoDriver.

Pins: `GND`, `OE` (Output enable (LOW = on)), `SCL`, `SDA`, `VCC` (Logic 3.3–5 V), `VPLUS` (V+ servo power (5–6 V)), `PWM0` (Channel 0 signal), `PWM1` (Channel 1 signal), `PWM2` (Channel 2 signal), `PWM3` (Channel 3 signal), `PWM4` (Channel 4 signal), `PWM5` (Channel 5 signal), `PWM6` (Channel 6 signal), `PWM7` (Channel 7 signal), `PWM8` (Channel 8 signal), `PWM9` (Channel 9 signal), `PWM10` (Channel 10 signal), `PWM11` (Channel 11 signal), `PWM12` (Channel 12 signal), `PWM13` (Channel 13 signal), `PWM14` (Channel 14 signal), `PWM15` (Channel 15 signal)

#### `solenoid-driver` — Solenoid driver module (TIP120)

Darlington low-side switch with a flyback diode already fitted — the easy, safe way to fire a solenoid, relay coil or small motor (≤ 3 A, ≤ 30 V) from a pin. Connect the load between VP and LN; tie the load supply’s − to GND.

Pins: `IN` (IN (HIGH = on)), `VCC` (+5 V (LED)), `GND`, `VP` (Load supply + (to the solenoid)), `LN` (Solenoid − (switched to GND))

#### `tb6612fng` — TB6612FNG dual motor driver

Efficient MOSFET dual H-bridge (1.2 A per channel, 0.5 Ω). Per motor: IN1/IN2 set direction (both HIGH = brake), PWM sets speed (LOW = brake). STBY must be HIGH. VM up to 15 V, logic 3.3 or 5 V.

Pins: `PWMA` (1: PWMA), `AIN2` (2: AIN2), `AIN1` (3: AIN1), `STBY` (4: Standby (HIGH to run)), `BIN1` (5: BIN1), `BIN2` (6: BIN2), `PWMB` (7: PWMB), `GND1` (8: GND1), `GND2` (9: GND2), `BO1` (10: Motor B), `BO2` (11: Motor B), `AO2` (12: Motor A), `AO1` (13: Motor A), `GND3` (14: GND3), `VCC` (15: VCC logic 2.7–5.5 V), `VM` (16: VM motor supply (≤ 15 V))

Internally connected: `GND1` = `GND2` = `GND3`

#### `tmc2208` — TMC2208 silent stepper driver

Trinamic "StealthChop" silent step/dir driver (1.4 A RMS, 4.75–36 V). Standalone mode: MS1/MS2 LOW/LOW = 1/8, HIGH/LOW = 1/2, LOW/HIGH = 1/4, HIGH/HIGH = 1/16 microsteps (interpolated to 256 internally).

Pins: `EN` (1: ENABLE (LOW = on)), `MS1` (2: MS1), `MS2` (3: MS2), `NC` (4: Not connected), `RST` (5: RESET (tie to SLEEP)), `SLP` (6: SLEEP (HIGH = awake)), `STEP` (7: STEP (one microstep per rising edge)), `DIR` (8: DIR), `GND2` (9: GND), `VDD` (10: Logic 3.3–5 V), `A2` (11: 1B (coil 1)), `A1` (12: 1A (coil 1)), `B1` (13: 2A (coil 2)), `B2` (14: 2B (coil 2)), `GND` (15: GND), `VMOT` (16: Motor supply (8–36 V, add 100 µF))

Props:
- `ilim` = 1.2 — Current limit (Vref pot); 0.1…2.5 A

Internally connected: `GND` = `GND2`

#### `tmc2209` — TMC2209 silent stepper driver

Trinamic silent step/dir driver (2 A RMS, 4.75–29 V) with StallGuard. Standalone mode: MS1/MS2 LOW/LOW = 1/8, HIGH/LOW = 1/32, LOW/HIGH = 1/64, HIGH/HIGH = 1/16 microsteps.

Pins: `EN` (1: ENABLE (LOW = on)), `MS1` (2: MS1), `MS2` (3: MS2), `NC` (4: Not connected), `RST` (5: RESET (tie to SLEEP)), `SLP` (6: SLEEP (HIGH = awake)), `STEP` (7: STEP (one microstep per rising edge)), `DIR` (8: DIR), `GND2` (9: GND), `VDD` (10: Logic 3.3–5 V), `A2` (11: 1B (coil 1)), `A1` (12: 1A (coil 1)), `B1` (13: 2A (coil 2)), `B2` (14: 2B (coil 2)), `GND` (15: GND), `VMOT` (16: Motor supply (8–29 V, add 100 µF))

Props:
- `ilim` = 1.7 — Current limit (Vref pot); 0.1…2.5 A

Internally connected: `GND` = `GND2`

#### `uln2003` — ULN2003 stepper driver board

Seven Darlington low-side switches (four used) with flyback diodes and indicator LEDs: IN n HIGH pulls OUT n to GND (~0.9 V drop, 500 mA). Plug a 28BYJ-48 into the output header; MP is the motor supply (= VCC).

Pins: `IN1`, `IN2`, `IN3`, `IN4`, `GND`, `VCC` (+5–12 V (motor supply)), `MP` (Motor + (red)), `O4` (OUT4 → orange), `O3` (OUT3 → yellow), `O2` (OUT2 → pink), `O1` (OUT1 → blue)

Internally connected: `VCC` = `MP`

#### `uln2803` — ULN2803 8-channel Darlington driver

Eight Darlington transistors with built-in flyback diodes: a HIGH input makes its output sink current to GND (≈1 V drop, up to 500 mA). Drives relays, solenoids, LED strips and unipolar steppers from logic pins — load between + supply and O, COM to that supply.

Pins: `I1` (1: Input 1), `I2` (2: Input 2), `I3` (3: Input 3), `I4` (4: Input 4), `I5` (5: Input 5), `I6` (6: Input 6), `I7` (7: Input 7), `I8` (8: Input 8), `GND` (9: GND), `COM` (10: COM (to the load supply, for the fly), `O8` (11: Output 8 (sinks up to 500 mA)), `O7` (12: Output 7 (sinks up to 500 mA)), `O6` (13: Output 6 (sinks up to 500 mA)), `O5` (14: Output 5 (sinks up to 500 mA)), `O4` (15: Output 4 (sinks up to 500 mA)), `O3` (16: Output 3 (sinks up to 500 mA)), `O2` (17: Output 2 (sinks up to 500 mA)), `O1` (18: Output 1 (sinks up to 500 mA))

#### `vnh2sp30` — VNH2SP30 motor driver (Monster Moto)

Single high-power H-bridge (30 A, 5.5–16 V). INA HIGH + INB LOW = forward, LOW/HIGH = reverse, both equal = brake; PWM sets speed. EN has a pull-up (it also reports faults). CS gives ~0.13 V per amp.

Pins: `INA` (INA (direction)), `INB` (INB (direction)), `PWM` (PWM (speed)), `EN` (EN / DIAG (HIGH = enabled)), `CS` (Current sense (~0.13 V/A)), `VCC` (+5 V logic), `GND`, `VIN` (Motor supply + (5.5–16 V)), `GNDP` (Motor supply −), `OUTA` (Motor A), `OUTB` (Motor B)

Internally connected: `GND` = `GNDP`

## Analog & timer ICs

#### `lm311` — LM311 fast comparator

A single, fast comparator: its open-collector output pulls LOW whenever IN+ is below IN−, so add a pull-up resistor (to any voltage up to 50 V). Zero-crossing detectors, level alarms, square-wave shapers.

Pins: `GND` (1: Ground / emitter of the output transi), `P` (2: Input +), `N` (3: Input −), `VEE` (4: V− (GND or a negative rail)), `BAL` (5: Balance), `STB` (6: Balance / strobe), `OUT` (7: Output (open collector — add a pull-u), `VCC` (8: V+ (5–30 V))

#### `lm324` — LM324 quad op-amp

Four LM358-style op-amps in one DIP-14, single-supply (3–32 V) with inputs down to GND. Four filters, buffers or a bar-graph comparator ladder from one chip.

Pins: `O1` (1: Output 1), `N1` (2: Input 1 −), `P1` (3: Input 1 +), `VCC` (4: V+ (3–32 V)), `P2` (5: Input 2 +), `N2` (6: Input 2 −), `O2` (7: Output 2), `O3` (8: Output 3), `N3` (9: Input 3 −), `P3` (10: Input 3 +), `GND` (11: V− / GND), `P4` (12: Input 4 +), `N4` (13: Input 4 −), `O4` (14: Output 4)

#### `lm339` — LM339 quad comparator

Four open-collector comparators: an output pulls LOW when its + input is below its − input, and floats otherwise — add a pull-up resistor. Window detectors, bar-graph ladders, battery monitors.

Pins: `O2` (1: Output 2 (open collector)), `O1` (2: Output 1 (open collector)), `VCC` (3: V+ (2–36 V)), `N1` (4: Input 1 −), `P1` (5: Input 1 +), `N2` (6: Input 2 −), `P2` (7: Input 2 +), `N3` (8: Input 3 −), `P3` (9: Input 3 +), `N4` (10: Input 4 −), `P4` (11: Input 4 +), `GND` (12: GND), `O4` (13: Output 4 (open collector)), `O3` (14: Output 3 (open collector))

#### `lm358` — LM358 dual op-amp

Two general-purpose op-amps that run from a single supply (3–32 V). Inputs and output reach down to GND; the output tops out about 1.5 V below V+. Gain-bandwidth ~1 MHz.

Pins: `OUT1` (1: Output A), `IN1N` (2: Input A −), `IN1P` (3: Input A +), `GND` (4: V− / GND), `IN2P` (5: Input B +), `IN2N` (6: Input B −), `OUT2` (7: Output B), `VCC` (8: V+ (3–32 V))

#### `lm386` — LM386 audio power amplifier

Half-watt audio amplifier for a small 8 Ω speaker: gain 20 as is, up to 200 with 10 µF between pins 1 and 8 (set Gain). The output idles at half the supply, so feed the speaker through a 220 µF capacitor.

Pins: `G1` (1: Gain set), `INN` (2: Input −), `INP` (3: Input +), `GND` (4: GND), `OUT` (5: Output (to the speaker via 220 µF)), `VS` (6: Supply (4–12 V)), `BYP` (7: Bypass (10 µF to GND)), `G8` (8: Gain set)

Props:
- `gain` = 20 — Gain; one of 20 (20 (pins 1–8 open)), 50 (50 (1.2 kΩ + 10 µF)), 200 (200 (10 µF across 1–8))

#### `lm393` — LM393 dual comparator

Two voltage comparators with open-collector outputs: the output pulls to GND when IN− > IN+, and floats otherwise — add a pull-up resistor (e.g. 10 kΩ to your logic supply).

Pins: `OUT1` (1: Output A (open collector)), `IN1N` (2: Input A −), `IN1P` (3: Input A +), `GND` (4: GND), `IN2P` (5: Input B +), `IN2N` (6: Input B −), `OUT2` (7: Output B (open collector)), `VCC` (8: V+ (2–36 V))

#### `mcp6002` — MCP6002 dual rail-to-rail op-amp

A low-voltage (1.8–6 V) op-amp whose inputs and output reach both supply rails — the right choice for 3.3 V boards like the ESP32 or Pico, where an LM358 would lose over a volt at the top.

Pins: `O1` (1: Output A), `N1` (2: Input A −), `P1` (3: Input A +), `GND` (4: V− / GND), `P2` (5: Input B +), `N2` (6: Input B −), `O2` (7: Output B), `VCC` (8: V+ (1.8–6 V))

#### `ne555` — 555 timer IC

The classic NE555: astable (blinker/oscillator), monostable (one-shot) or Schmitt trigger. Internal 5k–5k–5k divider sets the ⅓ and ⅔ VCC thresholds; OUT is ~1.7 V below VCC when high; DIS shorts to GND while OUT is low. 4.5–16 V.

Pins: `GND` (1: GND), `TRIG` (2: Trigger (starts when < ⅓ VCC)), `OUT` (3: OUT), `RESET` (4: Reset (active low)), `CTRL` (5: Control voltage (⅔ VCC)), `THR` (6: Threshold (stops when > ⅔ VCC)), `DIS` (7: Discharge (open collector)), `VCC` (8: VCC)

#### `tl072` — TL072 dual JFET op-amp (audio)

Low-noise dual op-amp with JFET inputs (practically no input current) — the audio favourite for preamps, filters and mixers. Needs a split supply (±5 to ±15 V); the output stays ~1.5 V inside the rails.

Pins: `O1` (1: Output A), `N1` (2: Input A −), `P1` (3: Input A +), `VEE` (4: V− (e.g. −12 V)), `P2` (5: Input B +), `N2` (6: Input B −), `O2` (7: Output B), `VCC` (8: V+ (e.g. +12 V))

#### `ua741` — µA741 op-amp

The textbook op-amp. Needs a split supply (e.g. ±9 V) — inputs must stay 2 V inside the rails, and the output swings to ~1.5 V from each rail. Leave the offset-null pins open.

Pins: `NULL1` (1: Offset null), `INN` (2: Inverting input −), `INP` (3: Non-inverting input +), `VEE` (4: V− (negative supply)), `NULL2` (5: Offset null), `OUT` (6: Output), `VCC` (7: V+), `NC` (8: Not connected)

## Logic gates

#### `gate-and` — AND gate (2-input)

Y is 1 only when A AND B are both 1. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Four-in-a-chip version: 74HC08.)

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-and3` — AND gate (3-input)

Y is 1 only when A, B and C are all 1. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Three-in-a-chip version: 74HC11.)

Pins: `A` (Input A), `B` (Input B), `C` (Input C), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-buffer` — Buffer gate

Y simply copies A — used to clean up a slow or weak signal or drive more inputs. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output.

Pins: `A` (Input A), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-nand` — NAND gate (2-input)

NOT-AND: Y is 0 only when A and B are both 1. The "universal" gate — any logic can be built from NANDs alone. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Four-in-a-chip version: 74HC00.)

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-nor` — NOR gate (2-input)

NOT-OR: Y is 1 only when A and B are both 0. Also a universal gate; two cross-coupled NORs make an SR latch. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Four-in-a-chip version: 74HC02.)

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-not` — NOT gate (inverter)

One inverter: Y is the opposite of A. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Six-in-a-chip version: 74HC04.)

Pins: `A` (Input A), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-or` — OR gate (2-input)

Y is 1 when A OR B (or both) is 1. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Four-in-a-chip version: 74HC32.)

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-or3` — OR gate (3-input)

Y is 1 when any of A, B or C is 1. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output.

Pins: `A` (Input A), `B` (Input B), `C` (Input C), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-xnor` — XNOR gate (2-input)

Exclusive NOR (equality): Y is 1 when A and B are the same. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output.

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `gate-xor` — XOR gate (2-input)

Exclusive OR: Y is 1 when A and B are different. It is the "sum" bit of a half adder and a controllable inverter. Power it from VCC/GND (3.3–5 V); an input counts as HIGH above half of VCC. The red dot shows the output. (Four-in-a-chip version: 74HC86.)

Pins: `A` (Input A), `B` (Input B), `Y` (Output Y), `VCC` (VCC (+3.3–5 V)), `GND`

#### `logic-input` — Logic input (click for 1 / 0)

A switch that drives its OUT pin to a clean logic level: click it while simulating to flip between 1 (= VCC) and 0 (= GND). Connect VCC and GND to your supply. Perfect for feeding gates without pull-up resistors.

Pins: `OUT` (OUT (1 = VCC, 0 = GND)), `VCC`, `GND`

Props:
- `on` = 0 — Output; one of 0 (0 (LOW)), 1 (1 (HIGH))

#### `logic-probe` — Logic probe (shows 1 / 0)

A lamp that lights when its IN pin is a logic 1 (above half of VCC) and shows the value, 1 or 0. It draws almost no current, so it can watch any gate output. Connect VCC and GND to your supply.

Pins: `IN`, `VCC`, `GND`

## Logic ICs

#### `74hc00` — 74HC00 quad NAND gate

Four 2-input NAND gates (Y = NOT(A AND B)). 2–6 V CMOS; inputs switch at VCC/2 — never leave unused inputs floating on a real chip.

Pins: `A1` (1: 1A), `B1` (2: 1B), `Y1` (3: 1Y), `A2` (4: 2A), `B2` (5: 2B), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `Y4` (11: 4Y), `A4` (12: 4A), `B4` (13: 4B), `VCC` (14: VCC)

#### `74hc02` — 74HC02 quad NOR gate

Four 2-input NOR gates: Y is HIGH only when both inputs are LOW. Note the 7402 pinout puts each output before its inputs. Two NORs cross-coupled make an SR latch.

Pins: `Y1` (1: 1Y), `A1` (2: 1A), `B1` (3: 1B), `Y2` (4: 2Y), `A2` (5: 2A), `B2` (6: 2B), `GND` (7: GND), `A3` (8: 3A), `B3` (9: 3B), `Y3` (10: 3Y), `A4` (11: 4A), `B4` (12: 4B), `Y4` (13: 4Y), `VCC` (14: VCC)

#### `74hc04` — 74HC04 hex inverter (NOT)

Six NOT gates: each output is the opposite of its input. 2–6 V CMOS.

Pins: `A1` (1: 1A), `Y1` (2: 1Y), `A2` (3: 2A), `Y2` (4: 2Y), `A3` (5: 3A), `Y3` (6: 3Y), `GND` (7: GND), `Y4` (8: 4Y), `A4` (9: 4A), `Y5` (10: 5Y), `A5` (11: 5A), `Y6` (12: 6Y), `A6` (13: 6A), `VCC` (14: VCC)

#### `74hc08` — 74HC08 quad AND gate

Four 2-input AND gates (Y = A AND B). 2–6 V CMOS; inputs switch at VCC/2 — never leave unused inputs floating on a real chip.

Pins: `A1` (1: 1A), `B1` (2: 1B), `Y1` (3: 1Y), `A2` (4: 2A), `B2` (5: 2B), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `Y4` (11: 4Y), `A4` (12: 4A), `B4` (13: 4B), `VCC` (14: VCC)

#### `74hc10` — 74HC10 triple 3-input NAND

Three NAND gates with three inputs each: Y is LOW only when A, B and C are all HIGH. Tie an unused input HIGH to use it as a 2-input NAND.

Pins: `A1` (1: 1A), `B1` (2: 1B), `A2` (3: 2A), `B2` (4: 2B), `C2` (5: 2C), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `C3` (11: 3C), `Y1` (12: 1Y), `C1` (13: 1C), `VCC` (14: VCC)

#### `74hc11` — 74HC11 triple 3-input AND

Three AND gates with three inputs each: Y is HIGH only when A, B and C are all HIGH — "all three conditions" in one gate.

Pins: `A1` (1: 1A), `B1` (2: 1B), `A2` (3: 2A), `B2` (4: 2B), `C2` (5: 2C), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `C3` (11: 3C), `Y1` (12: 1Y), `C1` (13: 1C), `VCC` (14: VCC)

#### `74hc125` — 74HC125 quad tri-state buffer

Four buffers whose outputs can be switched off: with OE̅ LOW, Y follows A; with OE̅ HIGH the output floats (high impedance), so several chips can share one wire (a bus) or a 3.3 V line can be level-shifted.

Pins: `OE1` (1: 1OE̅ (LOW = drive)), `A1` (2: 1A), `Y1` (3: 1Y), `OE2` (4: 2OE̅ (LOW = drive)), `A2` (5: 2A), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `OE3` (10: 3OE̅ (LOW = drive)), `Y4` (11: 4Y), `A4` (12: 4A), `OE4` (13: 4OE̅ (LOW = drive)), `VCC` (14: VCC)

#### `74hc138` — 74HC138 3-to-8 decoder / demultiplexer

Drives exactly one of Y0–Y7 LOW, selected by the 3-bit address A2 A1 A0 (all outputs HIGH when disabled). Enable with E1 = E2 = LOW and E3 = HIGH; feed data into an enable to use it as a demultiplexer.

Pins: `A0` (1: A0), `A1` (2: A1), `A2` (3: A2), `E1` (4: Enable 1 (active low)), `E2` (5: Enable 2 (active low)), `E3` (6: Enable 3 (active high)), `Y7` (7: Y7), `GND` (8: GND), `Y6` (9: Y6), `Y5` (10: Y5), `Y4` (11: Y4), `Y3` (12: Y3), `Y2` (13: Y2), `Y1` (14: Y1), `Y0` (15: Y0 (active low)), `VCC` (16: VCC)

#### `74hc14` — 74HC14 hex Schmitt-trigger inverter

Six inverters with hysteresis: the input must rise above ~60 % of VCC to switch the output LOW and fall below ~40 % to switch it back. Cleans up slow or noisy signals (button bounce, RC ramps) and makes a one-gate RC oscillator.

Pins: `A1` (1: 1A), `Y1` (2: 1Y), `A2` (3: 2A), `Y2` (4: 2Y), `A3` (5: 3A), `Y3` (6: 3Y), `GND` (7: GND), `Y4` (8: 4Y), `A4` (9: 4A), `Y5` (10: 5Y), `A5` (11: 5A), `Y6` (12: 6Y), `A6` (13: 6A), `VCC` (14: VCC)

#### `74hc157` — 74HC157 quad 2-to-1 multiplexer

Four switches in one chip, all flipped by one Select pin: S LOW routes the A inputs to Y, S HIGH routes the B inputs. With E̅ HIGH every Y is LOW. Swap between two 4-bit sources (two sets of buttons, two sensors).

Pins: `S` (1: Select (LOW = A, HIGH = B)), `A1` (2: 1A), `B1` (3: 1B), `Y1` (4: 1Y), `A2` (5: 2A), `B2` (6: 2B), `Y2` (7: 2Y), `GND` (8: GND), `Y3` (9: 3Y), `B3` (10: 3B), `A3` (11: 3A), `Y4` (12: 4Y), `B4` (13: 4B), `A4` (14: 4A), `E` (15: Enable (active LOW)), `VCC` (16: VCC)

#### `74hc20` — 74HC20 dual 4-input NAND

Two NAND gates with four inputs each: Y goes LOW only when all four inputs are HIGH — a handy "all keys pressed" or address decoder. Pins 3 and 11 are not connected.

Pins: `A1` (1: 1A), `B1` (2: 1B), `NC1` (3: not connected), `C1` (4: 1C), `D1` (5: 1D), `Y1` (6: 1Y), `GND` (7: GND), `Y2` (8: 2Y), `A2` (9: 2A), `B2` (10: 2B), `NC2` (11: not connected), `C2` (12: 2C), `D2` (13: 2D), `VCC` (14: VCC)

#### `74hc245` — 74HC245 octal bus transceiver

Eight bidirectional buffers: with OE̅ LOW, DIR HIGH copies A to B and DIR LOW copies B to A; with OE̅ HIGH both sides float. Buffers a data bus, drives many LEDs, or connects two buses that must take turns.

Pins: `DIR` (1: Direction (HIGH = A→B, LOW = B→A)), `A1` (2: A1), `A2` (3: A2), `A3` (4: A3), `A4` (5: A4), `A5` (6: A5), `A6` (7: A6), `A7` (8: A7), `A8` (9: A8), `GND` (10: GND), `B8` (11: B8), `B7` (12: B7), `B6` (13: B6), `B5` (14: B5), `B4` (15: B4), `B3` (16: B3), `B2` (17: B2), `B1` (18: B1), `OE` (19: Output enable (active LOW)), `VCC` (20: VCC)

#### `74hc27` — 74HC27 triple 3-input NOR

Three NOR gates with three inputs each: Y is HIGH only when A, B and C are all LOW.

Pins: `A1` (1: 1A), `B1` (2: 1B), `A2` (3: 2A), `B2` (4: 2B), `C2` (5: 2C), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `C3` (11: 3C), `Y1` (12: 1Y), `C1` (13: 1C), `VCC` (14: VCC)

#### `74hc283` — 74HC283 4-bit binary full adder

Adds two 4-bit numbers A and B plus a carry-in: S1–S4 is the 4-bit sum and CO the carry (sum ≥ 16). Chain CO into the next chip's CI for 8, 12, 16 bits — the heart of a home-made calculator or ALU.

Pins: `S2` (1: Sum 2 (2s)), `B2` (2: B2 (2s)), `A2` (3: A2 (2s)), `S1` (4: Sum 1 (1s)), `A1` (5: A1 (1s)), `B1` (6: B1 (1s)), `CI` (7: Carry in), `GND` (8: GND), `CO` (9: Carry out (16s)), `S4` (10: Sum 4 (8s)), `B4` (11: B4 (8s)), `A4` (12: A4 (8s)), `S3` (13: Sum 3 (4s)), `A3` (14: A3 (4s)), `B3` (15: B3 (4s)), `VCC` (16: VCC)

#### `74hc32` — 74HC32 quad OR gate

Four 2-input OR gates (Y = A OR B). 2–6 V CMOS; inputs switch at VCC/2 — never leave unused inputs floating on a real chip.

Pins: `A1` (1: 1A), `B1` (2: 1B), `Y1` (3: 1Y), `A2` (4: 2A), `B2` (5: 2B), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `Y4` (11: 4Y), `A4` (12: 4A), `B4` (13: 4B), `VCC` (14: VCC)

#### `74hc393` — 74HC393 dual 4-bit binary counter

Two ripple counters that count 0–15 in binary on the falling edge of their clock. Q0 toggles at half the clock rate, Q3 at 1/16 — a frequency divider, or chain Q3 of one into the clock of the other to count to 255. MR HIGH clears to 0.

Pins: `CP1` (1: 1 clock (counts on the falling edge)), `MR1` (2: 1 reset (HIGH = clear)), `Q01` (3: 1 Q0 (1s)), `Q11` (4: 1 Q1 (2s)), `Q21` (5: 1 Q2 (4s)), `Q31` (6: 1 Q3 (8s)), `GND` (7: GND), `Q32` (8: 2 Q3 (8s)), `Q22` (9: 2 Q2 (4s)), `Q12` (10: 2 Q1 (2s)), `Q02` (11: 2 Q0 (1s)), `MR2` (12: 2 reset (HIGH = clear)), `CP2` (13: 2 clock (counts on the falling edge)), `VCC` (14: VCC)

#### `74hc4051` — 74HC4051 8-channel analog multiplexer

Connects the common pin Z to one of Y0–Y7 chosen by S2 S1 S0 (a bidirectional analog switch, ~80 Ω on). Read 8 sensors with one analog pin, or route one signal to 8 places. E must be LOW.

Pins: `Y4` (1: Y4), `Y6` (2: Y6), `Z` (3: Common in/out), `Y7` (4: Y7), `Y5` (5: Y5), `E` (6: Enable (active low)), `VEE` (7: VEE (tie to GND)), `GND` (8: GND), `S2` (9: Select bit 2), `S1` (10: Select bit 1), `S0` (11: Select bit 0), `Y3` (12: Y3), `Y0` (13: Y0), `Y1` (14: Y1), `Y2` (15: Y2), `VCC` (16: VCC)

#### `74hc595` — 74HC595 shift register

8-bit serial-in, parallel-out shift register: shift bits in on SER with SRCLK, then pulse RCLK (latch) to show them on QA–QH. Chain chips through QH'. Drive it with shiftOut() — 3 pins give you 8, 16, 24… outputs.

Pins: `QB` (1: QB), `QC` (2: QC), `QD` (3: QD), `QE` (4: QE), `QF` (5: QF), `QG` (6: QG), `QH` (7: QH), `GND` (8: GND), `QHS` (9: QH' serial out (to the next chip's SE), `SRCLR` (10: Clear (active LOW, tie to VCC)), `SRCLK` (11: Shift clock (SH_CP)), `RCLK` (12: Latch clock (ST_CP)), `OE` (13: Output enable (active LOW)), `SER` (14: Serial data in (DS)), `QA` (15: QA), `VCC` (16: VCC)

#### `74hc74` — 74HC74 dual D flip-flop

Two edge-triggered D flip-flops: on each rising CLK edge Q copies D (and Q̅ is its opposite). CLR and PRE are active LOW and override the clock — tie them HIGH (the simulation pulls them up). Wire Q̅ back to D for a divide-by-2.

Pins: `CLR1` (1: 1 CLR (active LOW)), `D1` (2: 1 D), `CK1` (3: 1 CLK (rising edge)), `PR1` (4: 1 PRE (active LOW)), `Q1` (5: 1 Q), `QN1` (6: 1 Q̅), `GND` (7: GND), `QN2` (8: 2 Q̅), `Q2` (9: 2 Q), `PR2` (10: 2 PRE (active LOW)), `CK2` (11: 2 CLK (rising edge)), `D2` (12: 2 D), `CLR2` (13: 2 CLR (active LOW)), `VCC` (14: VCC)

#### `74hc86` — 74HC86 quad XOR gate

Four 2-input XOR gates (Y = A XOR B). 2–6 V CMOS; inputs switch at VCC/2 — never leave unused inputs floating on a real chip.

Pins: `A1` (1: 1A), `B1` (2: 1B), `Y1` (3: 1Y), `A2` (4: 2A), `B2` (5: 2B), `Y2` (6: 2Y), `GND` (7: GND), `Y3` (8: 3Y), `A3` (9: 3A), `B3` (10: 3B), `Y4` (11: 4Y), `A4` (12: 4A), `B4` (13: 4B), `VCC` (14: VCC)

#### `ads1115` — ADC 16-bit, 4-channel (ADS1115)

Precision 16-bit analog-to-digital converter on I2C (0x48): 4 single-ended or 2 differential inputs with a programmable gain (±6.144 V … ±0.256 V). Far finer than analogRead. Use Adafruit_ADS1115.

Pins: `VDD` (+2–5.5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `ADDR` (Address (GND 0x48, VDD 0x49)), `ALRT` (Alert / ready), `A0` (Input 0), `A1` (Input 1), `A2` (Input 2), `A3` (Input 3)

#### `adum1201` — ADuM1201 digital isolator

Two logic channels across a magnetic isolation barrier (A: side 1 → side 2, B: side 2 → side 1). Each side has its own supply and ground — nothing conducts between them. 2.7–5.5 V, up to 10 Mbps.

Pins: `VDD1` (1: Side 1 supply), `VIA` (2: Channel A in (side 1)), `VOB` (3: Channel B out (side 1)), `GND1` (4: Side 1 ground), `GND2` (5: Side 2 ground), `VIB` (6: Channel B in (side 2)), `VOA` (7: Channel A out (side 2)), `VDD2` (8: Side 2 supply)

#### `cd4011` — CD4011 quad NAND (4000-series CMOS)

The classic 4000-series CMOS NAND: runs from 3 to 15 V (handy with a 9 V battery), draws almost nothing, but its outputs are weak (~1 kΩ) — fine for LEDs through a resistor, not for loads.

Pins: `A1` (1: 1A), `B1` (2: 1B), `Y1` (3: 1Y), `Y2` (4: 2Y), `A2` (5: 2A), `B2` (6: 2B), `GND` (7: VSS), `A3` (8: 3A), `B3` (9: 3B), `Y3` (10: 3Y), `Y4` (11: 4Y), `A4` (12: 4A), `B4` (13: 4B), `VCC` (14: VDD (3–15 V))

#### `cd4017` — CD4017 decade counter

Johnson decade counter: one of the ten outputs Q0–Q9 is high, advancing one step on every rising clock edge (the LED-chaser chip — clock it from a 555 or an Arduino pin). RST high returns to Q0.

Pins: `Q5` (1: Q5), `Q1` (2: Q1), `Q0` (3: Q0), `Q2` (4: Q2), `Q6` (5: Q6), `Q7` (6: Q7), `Q3` (7: Q3), `GND` (8: VSS), `Q8` (9: Q8), `Q4` (10: Q4), `Q9` (11: Q9), `CO` (12: Carry out (high for counts 0–4)), `INH` (13: Clock inhibit (active high)), `CLK` (14: Clock (counts rising edges)), `RST` (15: Reset (active high)), `VCC` (16: VDD (3–15 V))

#### `cd4066` — CD4066 quad bilateral analog switch

Four electronically controlled switches: when a control pin is HIGH its switch closes (~100 Ω) and passes signals either way — audio, analog voltages or logic. Keep signals between VSS and VDD.

Pins: `A1` (1: Switch 1 in/out), `B1` (2: Switch 1 out/in), `B2` (3: Switch 2 out/in), `A2` (4: Switch 2 in/out), `C2` (5: Control 2 (HIGH = closed)), `C3` (6: Control 3 (HIGH = closed)), `GND` (7: VSS), `A3` (8: Switch 3 in/out), `B3` (9: Switch 3 out/in), `B4` (10: Switch 4 out/in), `A4` (11: Switch 4 in/out), `C4` (12: Control 4 (HIGH = closed)), `C1` (13: Control 1 (HIGH = closed)), `VCC` (14: VDD (3–15 V))

#### `cd4511` — CD4511 BCD to seven-segment decoder

Turns a 4-bit number (D C B A = 8 4 2 1) into the segment pattern of that digit and drives a common-cathode display directly (through 220–470 Ω resistors) — one digit from only four Arduino pins. Codes above 9 blank the display. Tie LT and BI HIGH and LE LOW for normal use.

Pins: `B` (1: BCD input B (2)), `C` (2: BCD input C (4)), `LT` (3: Lamp test (LOW = all segments on)), `BI` (4: Blanking (LOW = all off)), `LE` (5: Latch enable (HIGH = hold)), `D` (6: BCD input D (8)), `A` (7: BCD input A (1)), `GND` (8: VSS), `SE` (9: Segment e), `SD` (10: Segment d), `SC` (11: Segment c), `SB` (12: Segment b), `SA` (13: Segment a), `SG` (14: Segment g), `SF` (15: Segment f), `VCC` (16: VDD (3–15 V))

#### `mcp4725` — DAC 12-bit (MCP4725)

Digital-to-analog converter on I2C (0x60, or 0x61 with A0 high; some modules are 0x62): a true analog voltage OUT = value / 4096 × VCC. Use Adafruit_MCP4725 setVoltage().

Pins: `VCC` (+3.3–5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `A0` (A0 (address bit)), `OUT` (Analog output (0 … VCC))

Props:
- `base` = 96 — Address; one of 96 (0x60 (MCP4725A0)), 98 (0x62 (MCP4725A1))

#### `pcf8574` — I2C GPIO expander (PCF8574)

8 extra I/O pins over I2C (0x20–0x27 via A0–A2). Quasi-bidirectional: writing 1 releases a pin (weak pull-up — also how you make it an input), writing 0 pulls it LOW (sinks 25 mA: wire LEDs from + to the pin). Read the pin levels back over I2C.

Pins: `VCC` (+3.3–5 V), `GND`, `SDA` (I2C data), `SCL` (I2C clock), `INT` (Interrupt (LOW on input change)), `P0` (P0 (I/O)), `P1` (P1 (I/O)), `P2` (P2 (I/O)), `P3` (P3 (I/O)), `P4` (P4 (I/O)), `P5` (P5 (I/O)), `P6` (P6 (I/O)), `P7` (P7 (I/O))

Props:
- `addr` = 32 — Address (A2 A1 A0); one of 32 (0x20), 33 (0x21), 34 (0x22), 35 (0x23), 36 (0x24), 37 (0x25), 38 (0x26), 39 (0x27)

## Memory & time

#### `24lc256` — I2C EEPROM (24LC256)

32 KB non-volatile memory on I2C (0x50 + A2 A1 A0). Write: two address bytes then up to 64 data bytes (one page); read: set the address, then request bytes. Data survives power-off (and rebuilds). WP HIGH blocks writes.

Pins: `A0` (1: Address bit 0), `A1` (2: Address bit 1), `A2` (3: Address bit 2), `GND` (4: GND), `SDA` (5: I2C data), `SCL` (6: I2C clock), `WP` (7: Write protect (HIGH = read-only)), `VCC` (8: VCC)

#### `ds1307` — Real-time clock IC (DS1307)

Classic I2C real-time clock chip (0x68) — needs a 32.768 kHz crystal on X1/X2 and a 3 V backup cell. Keeps seconds … years in BCD registers. Use RTClib (RTC_DS1307).

Pins: `X1` (1: Crystal), `X2` (2: Crystal), `VBAT` (3: Backup battery (+3 V)), `GND` (4: GND), `SDA` (5: I2C data), `SCL` (6: I2C clock), `SQW` (7: Square wave out), `VCC` (8: +5 V)

Props:
- `start` = 0 — Clock at start; one of 0 (Current time (set)), 1 (Lost power (2000-01-01))

#### `ds3231` — RTC module (DS3231)

Temperature-compensated real-time clock module (±2 ppm) with a coin-cell backup, on I2C (0x68). Keeps date & time; also reports its temperature. Use RTClib (RTC_DS3231).

Pins: `32K` (32 kHz out), `SQW` (Square wave / alarm), `SCL` (I2C clock), `SDA` (I2C data), `VCC` (+3.3–5 V), `GND`

Props:
- `start` = 0 — Clock at start; one of 0 (Current time (set)), 1 (Lost power (2000-01-01))

#### `microsd-module` — MicroSD card module

Micro-SD card socket on SPI (with a level shifter). The card (FAT, 8.3 file names) is simulated in memory: write logs with the SD library and they show up here — they stay until you remove the part. Click to eject / insert the card.

Pins: `GND`, `VCC` (+5 V (on-board 3.3 V regulator)), `MISO`, `MOSI`, `SCK`, `CS` (Chip select)

Props:
- `inserted` = 1 — Card; one of 1 (Inserted), 0 (Ejected)

#### `sd-module` — SD card reader module

Full-size SD card socket on SPI (with a level shifter). The card (FAT, 8.3 file names) is simulated in memory: write logs with the SD library and they show up here — they stay until you remove the part. Click to eject / insert the card.

Pins: `GND`, `VCC` (+5 V (on-board 3.3 V regulator)), `MISO`, `MOSI`, `SCK`, `CS` (Chip select)

Props:
- `inserted` = 1 — Card; one of 1 (Inserted), 0 (Ejected)

#### `w25q32` — SPI flash memory (W25Q32)

4 MB serial NOR flash on SPI (3.3 V!). Commands: 0x9F JEDEC ID, 0x03 read, 0x06 write enable, 0x02 page program (≤ 256 bytes), 0x20 4 KB sector erase, 0xC7 chip erase, 0x05 status (bit 0 = busy). Erased bytes read 0xFF; programming only clears bits.

Pins: `CS` (1: Chip select (active LOW)), `DO` (2: Data out (→ MISO)), `WP` (3: Write protect), `GND` (4: GND), `DI` (5: Data in (← MOSI)), `CLK` (6: SPI clock (SCK)), `HOLD` (7: Hold (tie HIGH)), `VCC` (8: VCC)

## Sensors

#### `acs712` — Current sensor (ACS712)

Hall-effect current sensor: put it in series with the load (IP+ → IP−, 1.2 mΩ, isolated from the logic side). OUT = VCC/2 + sensitivity × current: 185 mV/A (5 A), 100 mV/A (20 A) or 66 mV/A (30 A).

Pins: `VCC` (+5 V), `OUT` (OUT (VCC/2 at 0 A)), `GND`, `IP1` (IP+ (current in)), `IP2` (IP− (current out))

Props:
- `sens` = 0.185 — Version; one of 0.185 (5 A (185 mV/A)), 0.1 (20 A (100 mV/A)), 0.066 (30 A (66 mV/A))

#### `adxl335` — Accelerometer (ADXL335)

3-axis ±3 g analog accelerometer: each output sits at VCC/2 for 0 g and moves ~330 mV per g (at 3.3 V, ratiometric). Lying flat: X = Y = 0 g, Z = +1 g. Set the acceleration of each axis while simulating.

Pins: `VCC` (+3.3 V (1.8–3.6 V)), `X` (X out), `Y` (Y out), `Z` (Z out), `GND`

Props:
- `ax` = 0 — X; -3…3 g
- `ay` = 0 — Y; -3…3 g
- `az` = 1 — Z; -3…3 g

#### `anemometer` — Anemometer (wind speed, reed pulse)

Three spinning cups with a magnet and a reed switch: the two wires close once per turn, and 1 closure per second = 2.4 km/h of wind. Use INPUT_PULLUP and count pulses with an interrupt. Set the wind speed while simulating.

Pins: `1`, `2`

Props:
- `wind` = 10 — Wind speed; 0…100 km/h

#### `bmp280` — Pressure sensor (BMP280)

Barometric pressure + temperature sensor on I2C (0x76 with SDO to GND, 0x77 with SDO high). ±1 hPa ≈ ±8 m of altitude. Use Adafruit_BMP280 (bmp.begin(0x76)).

Pins: `VCC` (+3.3–5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `CSB` (CSB (HIGH for I2C)), `SDO` (SDO (address: GND 0x76, VCC 0x77))

Props:
- `temp` = 22 — Temperature; -40…85 °C
- `hpa` = 1013.25 — Pressure; 300…1100 hPa

#### `capacitive-soil` — Capacitive soil moisture sensor (v1.2)

Measures moisture by capacitance through its coated blade — nothing exposed to corrode, unlike the fork probes. AO falls as the soil gets wetter (~2.9 V dry, ~1.3 V in water); calibrate the two ends in your pot. Set the moisture while simulating.

Pins: `GND`, `VCC` (+3.3–5.5 V), `AO` (Analog out (dry ≈ 2.9 V, wet ≈ 1.3 V))

Props:
- `moist` = 30 — Moisture; 0…100 %

#### `dht` — Temperature & humidity sensor (DHT11 / DHT22)

Digital temperature + humidity sensor on one data wire (needs a 10 kΩ pull-up; modules include it). DHT11: 0–50 °C ±2 °C, 20–90 % RH, whole numbers. DHT22: −40–80 °C ±0.5 °C, 0.1 resolution. Read at most every 2 s with the DHT library.

Pins: `VCC` (+3.3–5 V), `DATA` (Data), `NC` (not connected), `GND`

Props:
- `model` = 22 — Sensor; one of 11 (DHT11 (blue)), 22 (DHT22 / AM2302 (white))
- `temp` = 24 — Temperature; -40…80 °C
- `hum` = 55 — Humidity; 0…100 %

#### `flame-sensor` — Flame sensor (IR, 760–1100 nm)

An IR photodiode tuned to the flicker of flames: AO falls as the flame gets closer / stronger and DO goes LOW when it passes the threshold pot (range up to ~1 m). Set the flame strength while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `flame` = 0 — Flame strength; 0…100 %
- `thr` = 0.5 — Threshold pot; 0.05…0.95

#### `flex-sensor` — Flex sensor (2.2")

A strip whose resistance rises as it bends: ~25 kΩ flat to ~100 kΩ at 90°. Glove controllers and robotic fingers — read it in a divider with a 47 kΩ resistor. Set the bend angle while simulating.

Pins: `1`, `2`

Props:
- `bend` = 0 — Bend; 0…90 °

#### `fsr` — Force-sensitive resistor (FSR402)

A pad whose resistance drops as you press it: >1 MΩ untouched, ~30 kΩ at a light touch, a few kΩ at a firm press. Use a 10 kΩ divider and analogRead. Press it, or set the force, while simulating.

Pins: `1`, `2`

Props:
- `force` = 0 — Force; 0…20 N

#### `hall-49e` — Linear Hall sensor (SS49E)

Analog magnetic-field sensor: OUT sits at VCC/2 with no field and moves ~14 mV per mT (at 5 V) — up for a south pole, down for a north pole. Measures magnet distance, position or current. Press it to bring a magnet close, or set the field.

Pins: `VCC` (+3–6.5 V), `GND`, `OUT` (Analog out (VCC/2 at 0 mT))

Props:
- `field` = 0 — Magnetic field; -150…150 mT

#### `hall-a3144` — Hall-effect sensor (A3144)

Digital Hall switch: OUT pulls LOW when a magnet’s south pole is near (> ~18 mT), releases below ~12 mT. Open collector — use a 10 kΩ pull-up (or INPUT_PULLUP). Press the sensor to bring a magnet close, or set the field.

Pins: `VCC` (+4.5–24 V), `GND`, `OUT` (OUT (open collector, pull-up needed))

Props:
- `field` = 0 — Magnetic field; -50…50 mT

#### `hall-module` — Hall magnetic sensor module (KY-003)

A digital Hall switch with its pull-up and an indicator LED: S goes LOW (and the LED lights) when a magnet’s south pole comes close. Read it like a button. Press it to bring a magnet close, or set the field.

Pins: `S` (S (LOW near a magnet)), `VCC` (+ (3.3–5 V)), `GND` (−)

Props:
- `field` = 0 — Magnetic field; -50…50 mT

#### `hc-sr04` — Ultrasonic distance sensor (HC-SR04)

Sends a 40 kHz ping when TRIG gets a 10 µs pulse; ECHO then goes HIGH for the sound's round-trip time (58 µs per cm, 2–400 cm). Read it with pulseIn(echo, HIGH) or NewPing. Set the obstacle distance while simulating.

Pins: `VCC` (+5 V), `TRIG` (Trigger (10 µs pulse)), `ECHO` (Echo (HIGH for the round-trip time)), `GND`

Props:
- `dist` = 30 — Obstacle distance; 1…450 cm

#### `ina219` — Current & power sensor (INA219)

High-side current/voltage/power monitor on I2C (0x40): put its 0.1 Ω shunt in series with the load (VIN+ from the supply, VIN− to the load). Measures up to 26 V and ±3.2 A. Use Adafruit_INA219.

Pins: `VCC` (+3.3–5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `VINP` (VIN+ (from supply)), `VINN` (VIN− (to load))

#### `ir-obstacle` — IR proximity / obstacle sensor

Infrared LED + photodiode that sees reflections: OUT goes LOW when an object is closer than the range set by the pot (2–30 cm). Set the object distance while simulating.

Pins: `OUT`, `GND`, `VCC` (+3.3–5 V)

Props:
- `dist` = 40 — Object distance; 1…60 cm
- `range` = 10 — Range pot; 2…30 cm

#### `knock-sensor` — Piezo disc (knock / vibration sensor)

A bare piezo disc used as a sensor: a tap makes a sharp voltage spike (several volts, decaying in milliseconds). Put a 1 MΩ resistor across it and read it with analogRead (or a comparator). Press it to knock.

Pins: `P` (+ (red)), `N` (− (black))

Props:
- `hit` = 5 — Knock strength; 0.5…20 V

#### `laser-receiver` — Laser receiver module

A light sensor that only reacts to a strong beam: OUT goes HIGH while a laser dot is on the window. Pair it with a laser module for tripwire alarms or light barriers. Click to aim / block the laser while simulating.

Pins: `OUT` (OUT (HIGH while the laser hits it)), `VCC` (+5 V), `GND`

Props:
- `beam` = 1 — Laser; one of 1 (On the sensor), 0 (Blocked / off)

#### `ldr-module` — Light sensor module (LDR)

Photoresistor + 10 kΩ divider + LM393 comparator. AO rises as it gets darker; DO goes LOW when it is brighter than the threshold pot (the DO LED lights). Change the light level while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `lux` = 300 — Light; 0…2000 lx
- `thr` = 0.5 — Threshold pot; 0.05…0.95

#### `line-tracker` — Line tracking sensor (TCRT5000)

An IR LED and phototransistor looking down 1–15 mm at the floor: a white surface reflects (AO low, DO LOW), a black line absorbs (AO high, DO HIGH). Two or three of them steer a line-following robot. Set the surface reflectance while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `refl` = 90 — Surface reflectance; 0…100 %
- `thr` = 0.5 — Threshold pot; 0.05…0.95

#### `load-cell` — Load cell (5 kg, strain-gauge bridge)

An aluminium bar with four strain gauges in a Wheatstone bridge: power E+/E−, and the output A+ − A− changes by only ~1 mV per volt at full load — far too small for analogRead, so pair it with an HX711 or an instrumentation amp. Set the weight while simulating.

Pins: `EP` (E+ (red, excitation +)), `EN` (E− (black)), `SP` (A+ (green, signal +)), `SN` (A− (white, signal −))

Props:
- `kg` = 0 — Weight; 0…5 kg

#### `mpu6050` — Accelerometer + gyroscope (MPU6050)

6-axis IMU on I2C (0x68, or 0x69 with AD0 high): 3-axis accelerometer (±2–16 g) and gyroscope (±250–2000 °/s) plus a temperature sensor. Use Adafruit_MPU6050 or read registers 0x3B–0x48 with Wire. Set the motion while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `XDA` (Aux I2C data), `XCL` (Aux I2C clock), `AD0` (AD0 (address: LOW 0x68, HIGH 0x69)), `INT` (Interrupt out)

Props:
- `ax` = 0 — Accel X; -4…4 g
- `ay` = 0 — Accel Y; -4…4 g
- `az` = 1 — Accel Z; -4…4 g
- `gx` = 0 — Gyro X; -500…500 °/s
- `gy` = 0 — Gyro Y; -500…500 °/s
- `gz` = 0 — Gyro Z; -500…500 °/s
- `temp` = 25 — Temperature; -40…85 °C

#### `mpx5010` — Pressure sensor (MPX5010DP, 0–10 kPa)

An amplified pressure sensor with a hose port: Vout = VS × (0.09 × P + 0.04), from 0.2 V at 0 kPa to 4.7 V at 10 kPa (at 5 V). Water level in a tank (1 kPa ≈ 10 cm of water), airflow, breath sensing. Set the pressure while simulating.

Pins: `VOUT` (Vout (pin 1)), `GND` (GND (pin 2)), `VS` (Vs 5 V (pin 3))

Props:
- `kpa` = 2 — Pressure; 0…10 kPa

#### `mq135` — Air quality sensor (MQ-135)

Tin-oxide sensor for "bad air" — CO₂, ammonia, benzene, smoke. Its heater needs ~150 mA from 5 V and a few minutes to warm up. AO rises with pollution; DO goes LOW above the threshold. Set the concentration while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `ppm` = 400 — Pollutants; 10…2000 ppm
- `thr` = 1.5 — Threshold pot; 0.2…4.5 V

#### `mq2` — Gas / smoke sensor (MQ-2)

Tin-oxide gas sensor for LPG, propane, methane and smoke. The heater draws ~150 mA (use 5 V, not a pin!). AO rises with gas concentration; DO goes LOW above the threshold pot. Set the concentration while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `ppm` = 100 — Gas concentration; 0…10000 ppm
- `thr` = 1.5 — Threshold pot; 0.2…4.5 V

#### `mq3` — Alcohol sensor (MQ-3)

Breath-alcohol sensor (ethanol vapour, 0.05–10 mg/L). Heater ~150 mA at 5 V. AO rises with the alcohol level; DO goes LOW above the threshold pot. Set the concentration while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `mgl` = 0.1 — Alcohol; 0…10 mg/L
- `thr` = 1.5 — Threshold pot; 0.2…4.5 V

#### `mq4` — Methane / natural gas sensor (MQ-4)

Sensitive to methane (natural gas, 200–10 000 ppm) and much less to alcohol or smoke — the sensor for a gas-leak alarm. Heater ~150 mA at 5 V. AO rises with the gas level; DO goes LOW above the threshold pot. Set the concentration while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `ppm` = 200 — Methane; 0…10000 ppm
- `thr` = 1.5 — Threshold pot; 0.2…4.5 V

#### `mq7` — Carbon monoxide sensor (MQ-7)

Detects carbon monoxide (20–2000 ppm) — the dangerous gas from stoves and exhausts. Its heater should really cycle between 5 V and 1.4 V; this model shows the reading at the end of a cycle. AO rises with CO; DO goes LOW above the threshold. Set the concentration while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `ppm` = 20 — Carbon monoxide; 0…2000 ppm
- `thr` = 1.5 — Threshold pot; 0.2…4.5 V

#### `ntc-module` — Temperature module (KY-013, NTC)

A 10 kΩ NTC thermistor (β = 3950) with a 10 kΩ resistor to + already wired as a divider: S falls as it gets warmer (VCC/2 at 25 °C). Convert with the Steinhart–Hart / β formula. Set the temperature while simulating.

Pins: `S` (S (divider output)), `VCC` (+ (3.3–5 V)), `GND` (−)

Props:
- `temp` = 25 — Temperature; -20…120 °C

#### `photo-interrupter` — Photo interrupter (slot sensor, KY-010)

An IR LED and a photo-transistor facing each other across a 5 mm slot: S is LOW while the beam is clear and goes HIGH when something (a card, a flag on a shaft) blocks it. Endstops, paper detectors, counting slots. Press it to block the slot.

Pins: `S` (S (HIGH when the slot is blocked)), `VCC` (+ (3.3–5 V)), `GND`

#### `pir` — PIR motion sensor (HC-SR501)

Passive-infrared motion detector: OUT goes HIGH (3.3 V) when something warm moves and stays high for the hold time. Hold the dome (press while simulating) to wave a hand in front of it. Needs 5 V+.

Pins: `VCC` (+5–20 V), `OUT` (OUT (3.3 V while motion)), `GND`

Props:
- `hold` = 3 — Hold time; 0.3…20 s

#### `pulse-sensor` — Pulse / heart-rate sensor

Green LED + light sensor that sees the blood pulse in a fingertip: S is a heartbeat waveform around VCC/2 while a finger is on it. Detect the peaks with analogRead to measure BPM. Set the heart rate (and the finger) while simulating.

Pins: `S` (Signal (purple)), `VCC` (+ (red, 3–5 V)), `GND` (− (black))

Props:
- `bpm` = 72 — Heart rate; 40…180 bpm
- `finger` = 1 — Finger; one of 0 (Off the sensor), 1 (On the sensor)

#### `qmc5883l` — Magnetometer / compass (QMC5883L)

3-axis magnetic field sensor (GY-271, QMC5883L at I2C 0x0D). Keep it level and it reads the heading. Use the QMC5883LCompass library. Turn the heading while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `SCL` (I2C clock), `SDA` (I2C data), `DRDY` (Data ready)

Props:
- `heading` = 0 — Heading; 0…359 °

#### `quadrature-encoder` — Quadrature encoder (optical)

Optical shaft encoder with two channels 90° apart (push-pull outputs). Count edges for position; the order of A and B gives the direction. Set the shaft speed (negative = reverse) while simulating.

Pins: `VCC` (+5 V), `GND`, `A` (Channel A), `B` (Channel B (90° behind A))

Props:
- `rpm` = 0 — Shaft speed; -300…300 rpm
- `ppr` = 20 — Pulses per revolution; one of 20 (20), 100 (100), 360 (360)

#### `rain-sensor` — Rain sensor (drop plate)

Interleaved copper traces that conduct when drops land on them, plus an LM393 board: AO drops as the plate gets wetter, and DO goes LOW when rain is detected (threshold pot). Set the wetness while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `wet` = 0 — Wetness; 0…100 %
- `thr` = 0.7 — Threshold pot; 0.05…0.95

#### `rcwl-0516` — Microwave radar motion sensor (RCWL-0516)

Doppler radar at 3.2 GHz: it sees movement up to ~7 m, even through thin walls or a plastic case, and sets OUT HIGH (3.3 V) for about 2 s after the last movement. Power it from VIN (4–28 V). Press it to walk past it while simulating.

Pins: `V3` (3V3 out (up to 100 mA)), `GND`, `OUT` (OUT (3.3 V for ~2 s after motion)), `VIN` (VIN (4–28 V)), `CDS` (CDS (LDR input, leave open))

#### `reed-switch` — Reed switch

Two iron reeds in a glass tube that close when a magnet is brought near (door/window sensors, bike speedometers). Click it while simulating to move the magnet.

Pins: `1`, `2`

Props:
- `magnet` = 0 — Magnet; one of 0 (Away (open)), 1 (Near (closed))

#### `rotary-encoder` — Rotary encoder (KY-040)

Incremental encoder with detents and a push switch. Each click turns CLK and DT through one quadrature cycle (both HIGH at rest); read the direction from DT on each CLK edge. Drag the knob (or set the position) while simulating; press to push the shaft.

Pins: `GND`, `VCC` (+ (3.3–5 V)), `SW` (Push switch (LOW when pressed)), `DT` (DT (B)), `CLK` (CLK (A))

Props:
- `pos` = 0 — Position (clicks); -40…40

#### `sct013` — Split-core current transformer (SCT-013-030)

Clip it around ONE wire of a mains cable to measure AC current safely, without touching the wire: the output is an AC voltage of 1 V RMS at 30 A (built-in burden). Bias it to VCC/2 with a divider and capacitor before analogRead. Set the current while simulating.

Pins: `P` (Output (tip)), `N` (Output (sleeve))

Props:
- `amps` = 5 — Mains current; 0…30 A rms

#### `sharp-ir` — IR distance sensor (Sharp GP2Y0A21)

Measures distance with a triangulating IR beam (10–80 cm): VO is an analog voltage that falls as the object gets further (~2.3 V at 10 cm, ~0.4 V at 80 cm; not linear — fit a curve). Needs 5 V and a 10 µF capacitor nearby. Set the distance while simulating.

Pins: `VO` (Vo (yellow, analog)), `GND` (GND (black)), `VCC` (Vcc 5 V (red))

Props:
- `dist` = 30 — Object distance; 10…80 cm

#### `soil-moisture` — Soil moisture sensor

Fork probe + LM393 board: AO falls as the soil gets wetter (dry ≈ 4.7 V, in water ≈ 1.8 V at 5 V); DO goes LOW once wetter than the threshold pot. Power it only while measuring so the probe does not corrode. Set the moisture while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `moist` = 20 — Moisture; 0…100 %
- `thr` = 0.6 — Threshold pot; 0.05…0.95

#### `sound-sensor` — Sound sensor (KY-038)

Electret microphone + comparator. AO is the (amplified) sound waveform around VCC/2; DO goes HIGH whenever the sound peaks above the threshold pot — great for clap switches. Set the loudness while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (Digital out (threshold pot)), `AO` (Analog out)

Props:
- `db` = 40 — Loudness; 30…110 dB
- `thr` = 0.3 — Threshold pot; 0.02…2.5 V

#### `speed-sensor` — Wheel / motor speed encoder (slot sensor)

Slotted optical sensor (FC-03 style) with a 20-slot encoder wheel: DO pulses once per slot, so pulses per second ÷ 20 = revolutions per second. Count them with an interrupt. Set the wheel speed while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (DO (HIGH while the slot is blocked)), `AO`

Props:
- `rpm` = 0 — Wheel speed; 0…600 rpm

#### `temt6000` — Ambient light sensor (TEMT6000)

A phototransistor tuned to the human eye with a 10 kΩ load: SIG ≈ 5 mV per lux, so it reads indoor light levels (0–1000 lx) straight into analogRead. Set the light level while simulating.

Pins: `VCC` (+3.3–5 V), `GND`, `SIG` (Analog out (≈ 5 mV per lux))

Props:
- `lux` = 200 — Light; 0…1200 lx

#### `tilt-switch` — Tilt switch (SW-520D)

A metal ball in a can: the two leads are connected while it stands upright and open when tilted past ~45°. Click it while simulating to tip it over.

Pins: `1`, `2`

Props:
- `tilted` = 0 — Tilted; one of 0 (Upright (closed)), 1 (Tilted (open))

#### `tmp36` — Temperature sensor (TMP36 / LM35)

Analog temperature sensor. TMP36: Vout = 0.5 V + 10 mV/°C (750 mV at 25 °C, works below 0 °C). LM35: 10 mV/°C from 0 °C. Set the temperature in the inspector while simulating.

Pins: `VS` (+Vs (2.7–5.5 V)), `VOUT` (Vout), `GND`

Props:
- `temp` = 25 — Temperature; -40…125 °C
- `chip` = 0 — Chip; one of 0 (TMP36), 1 (LM35)

#### `uv-sensor` — UV sensor (GUVA-S12SD)

A UV-A/B photodiode with an amplifier: SIG ≈ UV index ÷ 10 volts (0.1 V indoors, ~1 V in strong summer sun). Read it with analogRead. Set the UV index while simulating.

Pins: `GND`, `VCC` (+2.7–5.5 V), `SIG` (Analog out (≈ UV index × 0.1 V))

Props:
- `uvi` = 3 — UV index; 0…12

#### `vibration-sensor` — Vibration sensor (SW-420)

Spring vibration switch + comparator: DO is LOW when still and goes HIGH while the module is shaken or knocked. Press it while simulating to shake it.

Pins: `VCC` (+3.3–5 V), `GND`, `DO` (DO (HIGH while shaking))

#### `voltage-sensor` — Voltage sensor module (0–25 V)

A 30 kΩ / 7.5 kΩ divider: S = VIN ÷ 5, so a 5 V Arduino can measure up to 25 V (analogRead × 25 / 1023). The measured − and the module − are the same ground.

Pins: `S` (S (VIN / 5)), `PLUS` (+ (not connected)), `MINUS` (− (GND)), `VIN` (Measured + (0–25 V)), `GNDIN` (Measured −)

Internally connected: `GNDIN` = `MINUS`

#### `water-flow` — Water flow sensor (YF-S201)

A turbine with a Hall sensor in a ½" pipe fitting: SIG pulses 7.5 times per second for each litre per minute (1–30 L/min). Count the pulses with an interrupt: L/min = Hz ÷ 7.5. Set the flow while simulating.

Pins: `VCC` (Red (+5–18 V)), `SIG` (Yellow (pulses: 7.5 Hz per L/min)), `GND` (Black (−))

Props:
- `flow` = 0 — Flow; 0…30 L/min

#### `water-level` — Water level sensor

Exposed parallel traces that conduct more the deeper they are dipped: S rises from 0 V (dry) to ~70 % of the supply when fully submerged (about 40 mm). Read it with analogRead. Set the water level while simulating.

Pins: `S` (S (analog level)), `VCC` (+ (3–5 V)), `GND` (−)

Props:
- `level` = 0 — Water depth; 0…40 mm

## Displays

#### `led-matrix` — LED matrix 8×8 (1088AS)

64 red LEDs in a grid: row pins are the anodes, column pins the cathodes. Light one LED by driving its row HIGH and its column LOW (through resistors); multiplex rows fast to draw images — or drive it from a MAX7219.

Pins: `R1` (Row 1 (anodes)), `R2` (Row 2 (anodes)), `R3` (Row 3 (anodes)), `R4` (Row 4 (anodes)), `R5` (Row 5 (anodes)), `R6` (Row 6 (anodes)), `R7` (Row 7 (anodes)), `R8` (Row 8 (anodes)), `C1` (Column 1 (cathodes)), `C2` (Column 2 (cathodes)), `C3` (Column 3 (cathodes)), `C4` (Column 4 (cathodes)), `C5` (Column 5 (cathodes)), `C6` (Column 6 (cathodes)), `C7` (Column 7 (cathodes)), `C8` (Column 8 (cathodes))

#### `max7219-matrix` — LED matrix module 8×8 (MAX7219)

MAX7219 driver + 8×8 red LED matrix: 3 wires (DIN, CS, CLK) drive all 64 LEDs, and modules daisy-chain (DOUT → next DIN). Use the LedControl library (or MD_MAX72XX-style raw shifting).

Pins: `VCC` (+5 V), `GND`, `DIN` (Data in), `CS` (Load (CS)), `CLK` (Clock), `VCC2` (+5 V out), `GND2` (GND out), `DOUT` (Data out (to the next module)), `CS2` (CS out), `CLK2` (CLK out)

Internally connected: `VCC` = `VCC2`; `GND` = `GND2`; `CS` = `CS2`; `CLK` = `CLK2`

#### `oled-128x32` — OLED display 0.91" (SSD1306 128×32)

0.91" monochrome OLED, 128 × 32 pixels, SSD1306 controller on I2C (address 0x3C). Draw text and graphics with Adafruit_SSD1306 / Adafruit_GFX (or raw Wire commands).

Pins: `GND`, `VCC` (+3.3–5 V), `SCL` (I2C clock), `SDA` (I2C data)

Props:
- `addr` = 60 — I2C address; one of 60 (0x3C), 61 (0x3D)

#### `oled-128x64` — OLED display 0.96" (SSD1306 128×64)

0.96" monochrome OLED, 128 × 64 pixels, SSD1306 controller on I2C (address 0x3C). Draw text and graphics with Adafruit_SSD1306 / Adafruit_GFX (or raw Wire commands).

Pins: `GND`, `VCC` (+3.3–5 V), `SCL` (I2C clock), `SDA` (I2C data)

Props:
- `addr` = 60 — I2C address; one of 60 (0x3C), 61 (0x3D)

#### `seven-seg-4digit` — 4-digit seven-segment display (5641AS)

Four digits sharing their segment pins (A–G, DP) with one common cathode per digit (D1–D4). Multiplex: light one digit at a time — segment pins HIGH through 220 Ω resistors, that digit’s pin LOW — cycling fast enough (≥ 50 Hz) that all four look lit. Or let a TM1637 / MAX7219 do it.

Pins: `E` (1: E), `D` (2: D), `DP` (3: Decimal point), `C` (4: C), `G` (5: G), `D4` (6: Digit 4 cathode), `B` (7: B), `D3` (8: Digit 3 cathode), `D2` (9: Digit 2 cathode), `F` (10: F), `A` (11: A), `D1` (12: Digit 1 cathode)

#### `seven-seg-ca` — Seven-segment display (common anode)

Single 0.56" digit: the eight LED anodes are tied to COM (connect to +5 V); pull a segment pin LOW through a ~220 Ω resistor to light it.

Pins: `E` (1: E), `D` (2: D), `COM1` (3: Common anode), `C` (4: C), `DP` (5: Decimal point), `B` (6: B), `A` (7: A), `COM2` (8: Common anode), `F` (9: F), `G` (10: G)

Internally connected: `COM1` = `COM2`

#### `seven-seg-cc` — Seven-segment display (common cathode)

Single 0.56" digit: the eight LED cathodes are tied to COM (connect to GND); drive a segment pin HIGH through a ~220 Ω resistor to light it.

Pins: `E` (1: E), `D` (2: D), `COM1` (3: Common cathode), `C` (4: C), `DP` (5: Decimal point), `B` (6: B), `A` (7: A), `COM2` (8: Common cathode), `F` (9: F), `G` (10: G)

Internally connected: `COM1` = `COM2`

#### `touch-panel` — Resistive touchscreen (4-wire)

Two resistive films (X ≈ 300 Ω, Y ≈ 500 Ω) that touch where you press. To read X: put 5 V across X+/X−, and analogRead Y+ (and vice-versa for Y). Set the touch point, then press the panel while simulating.

Pins: `XP` (X+), `YP` (Y+), `XM` (X−), `YM` (Y−)

Props:
- `x` = 0.5 — Touch X; 0…1
- `y` = 0.5 — Touch Y; 0…1

## Communication modules

#### `esp01` — Wi-Fi module (ESP-01, ESP8266 AT)

ESP8266 with the AT-command firmware: drive it over serial (115200 baud by default) — AT+CWJAP="ssid","pass" joins a (simulated) network, AT+CIPSTART / AT+CIPSEND talk to a server that answers HTTP requests with 200 OK. 3.3 V only.

Pins: `GND`, `IO2` (GPIO2), `IO0` (GPIO0 (LOW at boot = flash mode)), `RX` (RX (3.3 V logic)), `TX`, `EN` (CH_PD / EN (HIGH)), `RST` (Reset), `VCC` (3.3 V (up to 300 mA))

#### `gps-neo6m` — GPS module (NEO-6M)

u-blox NEO-6M GPS receiver: once it has a fix it sends NMEA sentences ($GPRMC, $GPGGA …) every second at 9600 baud on TX. Wire TX to a SoftwareSerial RX pin and feed the characters to TinyGPS++. Set the position and fix in the inspector.

Pins: `VCC` (+3.3–5 V), `RX` (RX (from the board's TX)), `TX` (TX (to the board's RX)), `GND`, `PPS` (1 pulse per second (with a fix))

Props:
- `lat` = 51.5074 — Latitude; number in °, ≥ -90
- `lon` = -0.1278 — Longitude; number in °, ≥ -180
- `alt` = 35 — Altitude; number in m, ≥ -400
- `speed` = 0 — Speed; 0…200 km/h
- `course` = 0 — Course; 0…359 °
- `sats` = 8 — Satellites; 0…12
- `fix` = 1 — Fix; one of 1 (Has a fix), 0 (Searching (no fix))

#### `hc05` — Bluetooth module (HC-05)

Bluetooth serial (SPP) module: whatever the board prints to it appears on the paired phone (shown on the module), and what you type in the phone box arrives at the board's RX. 9600 baud. Pull EN high at power-up for AT commands (AT, AT+NAME?, AT+VERSION?).

Pins: `STATE` (State (HIGH when paired)), `RXD` (RX (from the board TX — 3.3 V: use a div), `TXD` (TX (to the board RX)), `GND`, `VCC` (+3.6–6 V), `EN` (EN / KEY (HIGH at power-up = AT mode))

Props:
- `paired` = 1 — Phone; one of 1 (Paired & connected), 0 (Not connected)

#### `logic-level-converter` — Logic-level converter (4-ch, BSS138)

Bidirectional 3.3 V ↔ 5 V level shifter: each channel is a BSS138 MOSFET with 10 kΩ pull-ups on both sides. Works for I2C, UART, SPI and plain GPIO. Power LV with 3.3 V and HV with 5 V and join the grounds.

Pins: `HV1` (High-side 1), `HV2` (High-side 2), `HV` (HV supply (5 V)), `GND`, `HV3` (High-side 3), `HV4` (High-side 4), `LV1` (Low-side 1), `LV2` (Low-side 2), `LV` (LV supply (3.3 V)), `GND2` (GND), `LV3` (Low-side 3), `LV4` (Low-side 4)

Internally connected: `GND` = `GND2`

#### `max485` — RS-485 transceiver (MAX485 module)

Turns a serial port into a long-distance differential RS-485 bus (up to 1.2 km, 32 nodes). Join A to A and B to B between modules; drive DE+RE HIGH to transmit and LOW to listen. Bytes sent on DI appear on RO of the listening modules.

Pins: `RO` (Receiver out (→ board RX)), `RE` (RE (LOW = receive)), `DE` (DE (HIGH = transmit)), `DI` (Driver in (← board TX)), `VCC` (+5 V), `B` (B (−)), `A` (A (+)), `GND`

#### `mcp2515` — CAN bus module (MCP2515 + TJA1050)

CAN controller + transceiver on SPI, as used in cars and industrial networks. Join the CANH and CANL of all nodes (120 Ω at each end); every node sees every frame. Use the mcp_can library: begin(MCP_ANY, CAN_500KBPS, MCP_8MHZ), sendMsgBuf(), readMsgBuf().

Pins: `INT` (Interrupt (LOW = message)), `SCK` (SPI clock), `SI` (MOSI), `SO` (MISO), `CS` (Chip select), `GND`, `VCC` (+5 V), `CANH` (CAN High), `CANL` (CAN Low)

#### `nrf24l01` — 2.4 GHz radio (nRF24L01+)

Low-power 2.4 GHz transceiver: two boards, each with one, can send small packets (≤ 32 bytes — ints, arrays, structs) to each other. Use the RF24 library: same channel, and the writer's address must match a reading pipe on the listener. Power from 3.3 V with a 10 µF capacitor.

Pins: `GND`, `CE` (CE (chip enable)), `SCK` (SPI clock), `MISO`, `VCC` (3.3 V (5 V kills it!)), `CSN` (CSN (SPI chip select)), `MOSI`, `IRQ` (Interrupt)

#### `pn532` — NFC module (PN532)

PN532 NFC/RFID reader in I2C mode (set the DIP switches to I2C): reads MIFARE cards, NTAG stickers and phones. Use Adafruit_PN532 nfc(IRQ, RESET) with readPassiveTargetID(). Hold the module to tap the chosen card.

Pins: `GND`, `VCC` (+3.3–5 V), `SDA` (I2C data), `SCL` (I2C clock), `IRQ` (Interrupt), `RSTO` (Reset out)

Props:
- `card` = 0 — Card / tag; one of 0 (Blue tag DE AD BE EF), 1 (White card 04 A2 2B 7A), 2 (Key fob 93 1C 5F 0B), 3 (NTAG215 (7-byte) 04 5A)
- `present` = 0 — Card on the reader; one of 0 (No (hold the reader to t), 1 (Yes (left on it))

#### `rc522` — RFID reader (RC522, 13.56 MHz)

MFRC522 RFID reader on SPI for MIFARE cards and key fobs (13.56 MHz). Wire SDA to the SS pin you pass to MFRC522(ss, rst) and SCK/MOSI/MISO to the SPI pins; power from 3.3 V. Hold the reader to tap the chosen card.

Pins: `SDA` (SDA / SS (chip select)), `SCK` (SPI clock), `MOSI`, `MISO`, `IRQ` (Interrupt), `GND`, `RST` (Reset), `VCC` (3.3 V (not 5 V!))

Props:
- `card` = 0 — Card / tag; one of 0 (Blue tag DE AD BE EF), 1 (White card 04 A2 2B 7A), 2 (Key fob 93 1C 5F 0B), 3 (NTAG215 (7-byte) 04 5A)
- `present` = 0 — Card on the reader; one of 0 (No (hold the reader to t), 1 (Yes (left on it))

#### `rf-antenna` — RF antenna (433 MHz / 2.4 GHz)

Quarter-wave whip antenna for RF modules (433 MHz spring coil or 2.4 GHz whip). Connect ANT to the module’s antenna pin. Electrically it looks like a few pF here — radio links themselves are not simulated.

Pins: `ANT` (Antenna feed), `GND` (Ground plane)

#### `sim800l` — GSM module (SIM800L)

Quad-band GSM/GPRS modem: AT commands over serial (9600 baud) to send SMS (AT+CMGF=1, AT+CMGS="+number" then the text and Ctrl-Z), place calls (ATD…;) and check the signal (AT+CSQ). Sent messages show on the module; type in the box to receive an SMS. Needs 3.7–4.2 V.

Pins: `NET` (Antenna), `VCC` (3.7–4.2 V (LiPo; peaks 2 A!)), `RST` (Reset), `RXD` (RX), `TXD` (TX), `GND`

#### `spi-monitor` — SPI interface monitor

A tiny protocol analyser: clip it onto an SPI bus (CS, SCK, MOSI, MISO) and it lists the bytes exchanged while that CS is LOW (MOSI → / ← MISO, in hex). Handy for debugging SPI drivers.

Pins: `CS` (Chip select to watch), `SCK`, `MOSI`, `MISO`, `GND`

#### `usb-serial` — USB-to-serial converter (CH340)

USB-to-serial (TTL) adapter with a CH340: a computer terminal on the other end. Cross the wires (adapter TX → board RX, adapter RX → board TX), join the grounds. The module shows what it receives; type in the box to send. It also supplies 5 V / 3.3 V from USB.

Pins: `DTR` (DTR (auto-reset)), `RXD` (RX ← connect to the board's TX), `TXD` (TX → connect to the board's RX), `VCC` (5 V from USB), `V33` (3.3 V out), `GND`

#### `usb-ttl` — USB-to-TTL adapter (CP2102)

USB-to-serial (TTL) adapter with a CP2102: a computer terminal on the other end. Cross the wires (adapter TX → board RX, adapter RX → board TX), join the grounds. The module shows what it receives; type in the box to send. It also supplies 5 V / 3.3 V from USB.

Pins: `DTR` (DTR (auto-reset)), `RXD` (RX ← connect to the board's TX), `TXD` (TX → connect to the board's RX), `VCC` (5 V from USB), `V33` (3.3 V out), `GND`

## Instruments

#### `analog-ammeter` — Analog panel ammeter (moving coil)

A needle ammeter with an internal shunt: put it IN SERIES with the load (+ towards the supply). It adds only ~0.05 V at full scale. Pick the full-scale range.

Pins: `P` (+), `N` (−)

Props:
- `fs` = 1 — Full scale; one of 1 (0–1 A), 0.1 (0–100 mA), 5 (0–5 A)

#### `analog-voltmeter` — Analog panel voltmeter (moving coil)

A classic needle voltmeter (85C1 style) with a 1 mA coil and a built-in series resistor, so it draws 1 mA at full scale. Connect it across what you measure, + to the higher side. Pick the full-scale range.

Pins: `P` (+), `N` (−)

Props:
- `fs` = 5 — Full scale; one of 5 (0–5 V), 15 (0–15 V), 30 (0–30 V)

#### `multimeter` — Multimeter

Digital multimeter. Voltage and resistance: connect across a part. Current: break the circuit and put the meter in series. Click it during simulation to change mode.

Pins: `COM` (COM (black probe)), `+` (V/Ω/A (red probe))

Props:
- `mode` = "V" — Mode; one of "V" (Voltage (V)), "A" (Current (A)), "R" (Resistance (Ω))

#### `oscilloscope` — Oscilloscope

Single-channel oscilloscope. Connect + to the signal and − to ground; set the time base to fit your signal.

Pins: `+` (Probe +), `-` (Probe − (ground))

Props:
- `timeDiv` = 0.01 — Time / div; one of 0.0005 (500 µs), 0.001 (1 ms), 0.002 (2 ms), 0.005 (5 ms), 0.01 (10 ms), 0.02 (20 ms), 0.05 (50 ms), 0.1 (100 ms), 0.2 (200 ms), 0.5 (500 ms), 1 (1 s)
- `voltDiv` = 1 — Volts / div; one of 0.1 (0.1 V), 0.2 (0.2 V), 0.5 (0.5 V), 1 (1 V), 2 (2 V), 5 (5 V)

#### `panel-voltmeter` — Panel voltmeter (3-wire, 0–100 V)

A 0.36" red LED voltmeter for power supplies and battery boxes. Red powers it (4.5–30 V), black is ground, yellow is the voltage to measure (0–100 V, against black). Shows two decimals.

Pins: `VCC` (Red: power (+4.5–30 V)), `GND` (Black: ground), `VIN` (Yellow: measured voltage)
