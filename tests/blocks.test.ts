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
});
