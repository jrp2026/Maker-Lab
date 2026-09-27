import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOCKS, sketchFromJson } from '../src/blocks/arduino';
import { UNO, ESP32 } from '../src/mcu/boards';
import { McuRuntime } from '../src/mcu/runtime';

describe('blocks → Arduino code', () => {
  it('generates a compilable blink sketch from the default blocks', () => {
    const code = sketchFromJson(DEFAULT_BLOCKS, UNO);
    expect(code).toContain('pinMode(LED_BUILTIN, OUTPUT);');
    expect(code).toContain('digitalWrite(LED_BUILTIN, HIGH);');
    expect(code).toContain('delay(1000 * 1);');
    const r = new McuRuntime(UNO);
    expect(r.load(code)).toBeNull();
    r.runUntil(500_000);
    expect(r.pins[13].value).toBe(1);
    r.runUntil(1_500_000);
    expect(r.pins[13].value).toBe(0);
  });

  it('handles variables, loops, conditions, servo, LCD and serial', () => {
    const json = {
      variables: [{ name: 'level', id: 'v1' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_start', x: 0, y: 0,
            inputs: { DO: { block: { type: 'lcd_print', inputs: { TEXT: { block: { type: 'text', fields: { TEXT: 'Hi' } } } } } } },
          },
          {
            type: 'arduino_forever', x: 0, y: 200,
            inputs: {
              DO: {
                block: {
                  type: 'variables_set', fields: { VAR: { id: 'v1' } },
                  inputs: { VALUE: { block: { type: 'io_analog_read', fields: { PIN: '34' } } } },
                  next: {
                    block: {
                      type: 'controls_if',
                      inputs: {
                        IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } }, B: { block: { type: 'math_number', fields: { NUM: 2000 } } } } } },
                        DO0: { block: { type: 'servo_write', fields: { PIN: 18 }, inputs: { ANGLE: { block: { type: 'math_number', fields: { NUM: 180 } } } } } },
                      },
                      next: {
                        block: {
                          type: 'controls_repeat_ext', inputs: { TIMES: { block: { type: 'math_number', fields: { NUM: 3 } } } },
                          inputs2: {},
                          next: { block: { type: 'serial_print', fields: { NL: 'LN' }, inputs: { TEXT: { block: { type: 'variables_get', fields: { VAR: { id: 'v1' } } } } } } },
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
    const code = sketchFromJson(json, ESP32);
    expect(code).toContain('#include <ESP32Servo.h>');
    expect(code).toContain('LiquidCrystal_I2C lcd(0x27, 16, 2);');
    expect(code).toContain('long level = 0;');
    expect(code).toContain('if (level > 2000) {');
    expect(code).toContain('Serial.begin(115200);');
    const r = new McuRuntime(ESP32);
    expect(r.load(code)).toBeNull();
    r.pins[34].volts = 3;
    r.runUntil(100_000);
    expect(r.error).toBeNull();
    expect(r.pins[18].servo).toBe(2400);
  });

  const B = (type: string, extra: Record<string, unknown> = {}) => ({ block: { type, ...extra } });
  const N = (n: number) => B('math_number', { fields: { NUM: n } });

  it('new blocks: functions, a non-blocking timer, TMP36 into a float variable, button, toggle', () => {
    const json = {
      variables: [{ name: 'temp', id: 't' }, { name: 'x', id: 'px' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          // function "twice(x)" returning x * 2
          {
            type: 'procedures_defreturn', x: 400, y: 0, fields: { NAME: 'twice' }, extraState: { params: [{ name: 'x', id: 'px' }] },
            inputs: { RETURN: B('math_arithmetic', { fields: { OP: 'MULTIPLY' }, inputs: { A: B('variables_get', { fields: { VAR: { id: 'px' } } }), B: N(2) } }) },
          },
          {
            type: 'arduino_forever', x: 0, y: 0,
            inputs: {
              DO: B('variables_set', {
                fields: { VAR: { id: 't' } }, inputs: { VALUE: B('sensor_tmp36', { fields: { PIN: 'A0' } }) },
                next: B('control_every', {
                  inputs: { MS: N(250), DO: B('io_toggle', { fields: { PIN: 13 } }) },
                  next: B('controls_if', {
                    inputs: {
                      IF0: B('sensor_button', { fields: { PIN: '2' } }),
                      DO0: B('serial_print_value', { fields: { LABEL: 'double' }, inputs: { VALUE: B('procedures_callreturn', { extraState: { name: 'twice', params: ['x'] }, inputs: { ARG0: B('variables_get', { fields: { VAR: { id: 't' } } }) } }) } }),
                    },
                  }),
                }),
              }),
            },
          },
        ],
      },
    };
    const code = sketchFromJson(json, UNO);
    expect(code).toContain('float temp = 0;');
    expect(code).toMatch(/float twice\(float x\) \{/);
    expect(code).toContain('if (millis() - lastRun1 >= 250) {');
    expect(code).toContain('digitalWrite(13, !digitalRead(13));');
    expect(code).toContain('pinMode(2, INPUT_PULLUP);');
    const r = new McuRuntime(UNO);
    expect(r.load(code)).toBeNull();
    r.pins[14].volts = 0.75; // TMP36 at 25 °C
    r.pins[2].volts = 0; // button pressed
    r.runUntil(1_100_000);
    expect(r.error).toBeNull();
    expect(r.serialOut).toMatch(/double = 49\.\d\d|double = 50\.\d\d/);
    // the timer toggled pin 13 about four times a second without blocking the loop
    expect(r.serialOut.split('double').length).toBeGreaterThan(20);
  });

  it('distance sensor block generates a working pulseIn helper', () => {
    const json = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'arduino_forever', x: 0, y: 0, inputs: { DO: B('serial_print_value', { fields: { LABEL: 'cm' }, inputs: { VALUE: B('sensor_distance', { fields: { TRIG: '7', ECHO: '6' } }) } }) } }],
      },
    };
    const code = sketchFromJson(json, UNO);
    expect(code).toContain('long readDistanceCm(int trig, int echo) {');
    expect(code).toContain('Serial.println(readDistanceCm(7, 6));');
    const r = new McuRuntime(UNO);
    expect(r.load(code)).toBeNull();
  });

  it('pins saved as numbers by older block programs still load into the pin dropdowns', () => {
    const code = sketchFromJson({ blocks: { languageVersion: 0, blocks: [{ type: 'arduino_forever', x: 0, y: 0, inputs: { DO: B('io_digital_write', { fields: { PIN: 7, STATE: 'HIGH' } }) } }] } }, UNO);
    expect(code).toContain('digitalWrite(7, HIGH);');
  });
});
