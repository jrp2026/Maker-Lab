/**
 * Block-based programming (Tinkercad-style). Block definitions + a generator that
 * turns a Blockly workspace into an Arduino C++ sketch for the board being programmed.
 * No DOM here, so it can run headless in tests.
 */
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import type { BoardSpec } from '../mcu/boards';

// ------------------------------------------------------------------ board context for dropdowns

let board: BoardSpec | null = null;
export function setBlocksBoard(b: BoardSpec) {
  board = b;
}

function analogOptions(): [string, string][] {
  if (!board || board.id === 'uno' || board.id === 'atmega328p') return ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((a) => [a, a]);
  if (board.analogNames) return board.analogNames;
  if (board.analogChannelBase !== null) return board.adcPins.map((_, i) => [`A${i}`, `A${i}`]);
  return board.adcPins.map((p) => [`GPIO${p}`, String(p)]);
}

// ------------------------------------------------------------------ block definitions

const C = { output: '#3d8fd6', input: '#9b59b6', control: '#f2a93b', math: '#4caf6e', text: '#5f7a8c', device: '#16a085', hat: '#e05a47' };

const HL = [['HIGH', 'HIGH'], ['LOW', 'LOW']];

const DEFS = [
  { type: 'arduino_start', message0: 'on start %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.hat, tooltip: 'Runs once when the board starts (setup).' },
  { type: 'arduino_forever', message0: 'forever %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.hat, tooltip: 'Repeats forever (loop).' },

  { type: 'io_digital_write', message0: 'set pin %1 to %2', args0: [{ type: 'field_number', name: 'PIN', value: 13, min: 0, max: 39, precision: 1 }, { type: 'field_dropdown', name: 'STATE', options: HL }], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_builtin_led', message0: 'set built-in LED to %1', args0: [{ type: 'field_dropdown', name: 'STATE', options: HL }], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_analog_write', message0: 'set pin %1 PWM to %2', args0: [{ type: 'field_number', name: 'PIN', value: 9, min: 0, max: 39, precision: 1 }, { type: 'input_value', name: 'VALUE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.output, tooltip: '0 = off … 255 = fully on' },
  { type: 'io_tone', message0: 'play tone on pin %1 at %2 Hz for %3 ms', args0: [{ type: 'field_number', name: 'PIN', value: 8, min: 0, max: 39, precision: 1 }, { type: 'input_value', name: 'FREQ', check: 'Number' }, { type: 'input_value', name: 'MS', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_notone', message0: 'stop tone on pin %1', args0: [{ type: 'field_number', name: 'PIN', value: 8, min: 0, max: 39, precision: 1 }], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'serial_print', message0: 'print to serial monitor %1 %2', args0: [{ type: 'input_value', name: 'TEXT' }, { type: 'field_dropdown', name: 'NL', options: [['with newline', 'LN'], ['without newline', 'NONE']] }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.text },

  { type: 'servo_write', message0: 'rotate servo on pin %1 to %2 degrees', args0: [{ type: 'field_number', name: 'PIN', value: 9, min: 0, max: 39, precision: 1 }, { type: 'input_value', name: 'ANGLE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_print', message0: 'LCD (I2C 0x27) print %1', args0: [{ type: 'input_value', name: 'TEXT' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_cursor', message0: 'LCD set cursor column %1 row %2', args0: [{ type: 'input_value', name: 'COL', check: 'Number' }, { type: 'input_value', name: 'ROW', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_clear', message0: 'LCD clear', previousStatement: null, nextStatement: null, colour: C.device },

  { type: 'io_digital_read', message0: 'read digital pin %1 %2', args0: [{ type: 'field_number', name: 'PIN', value: 2, min: 0, max: 39, precision: 1 }, { type: 'field_dropdown', name: 'MODE', options: [['', 'INPUT'], ['with pull-up', 'INPUT_PULLUP']] }], output: 'Number', colour: C.input },
  { type: 'io_analog_read', message0: 'read analog pin %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: analogOptions }], output: 'Number', colour: C.input },
  { type: 'time_millis', message0: 'milliseconds since start', output: 'Number', colour: C.input },

  { type: 'control_wait', message0: 'wait %1 %2', args0: [{ type: 'input_value', name: 'TIME', check: 'Number' }, { type: 'field_dropdown', name: 'UNIT', options: [['seconds', 'S'], ['milliseconds', 'MS']] }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.control },
  { type: 'math_map', message0: 'map %1 from %2 – %3 to %4 – %5', args0: [{ type: 'input_value', name: 'V' }, { type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }, { type: 'input_value', name: 'C' }, { type: 'input_value', name: 'D' }], inputsInline: true, output: 'Number', colour: C.math },
];

let defined = false;
export function defineArduinoBlocks() {
  if (defined) return;
  defined = true;
  Blockly.setLocale(En as unknown as Record<string, string>);
  Blockly.common.defineBlocksWithJsonArray(DEFS as any);
}

// ------------------------------------------------------------------ generator

const O = { ATOMIC: 0, POSTFIX: 1, UNARY: 2, MUL: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, COND: 13, ASSIGN: 14, NONE: 99 };

const RESERVED = 'setup,loop,if,else,for,while,do,switch,case,break,continue,return,int,long,float,double,char,byte,bool,boolean,void,String,const,static,true,false,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,Serial,delay,millis,lcd,random,map,min,max,abs,count';

class ArduinoGenerator extends Blockly.CodeGenerator {
  setups = new Map<string, string>();
  globals = new Map<string, string>();
  includes = new Set<string>();
  spec!: BoardSpec;
  constructor() {
    super('Arduino');
    this.INDENT = '  ';
    this.addReservedWords(RESERVED);
  }
  init(ws: Blockly.Workspace) {
    super.init(ws);
    this.setups.clear();
    this.globals.clear();
    this.includes.clear();
    if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
    else this.nameDB_.reset();
    this.nameDB_.setVariableMap(ws.getVariableMap());
    this.nameDB_.populateVariables(ws);
    this.nameDB_.populateProcedures(ws);
  }
  scrub_(block: Blockly.Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock();
    return code + (thisOnly || !next ? '' : this.blockToCode(next));
  }
  value(block: Blockly.Block, name: string, order: number, dflt = '0'): string {
    return this.valueToCode(block, name, order) || dflt;
  }
  pinMode(pin: string | number, mode: string) {
    this.setups.set(`pinMode${pin}`, `pinMode(${pin}, ${mode});`);
  }
  lcd() {
    this.includes.add('#include <Wire.h>');
    this.includes.add('#include <LiquidCrystal_I2C.h>');
    this.globals.set('lcd', 'LiquidCrystal_I2C lcd(0x27, 16, 2);');
    this.setups.set('lcd', 'lcd.init();\n  lcd.backlight();');
  }
}

export const arduinoGenerator = new ArduinoGenerator();
const g = arduinoGenerator;
type Gen = typeof g;
type Fn = (b: Blockly.Block, gen: Gen) => string | [string, number] | null;
const F = g.forBlock as unknown as Record<string, Fn>;

F.arduino_start = () => '';
F.arduino_forever = () => '';

F.io_digital_write = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.pinMode(pin, 'OUTPUT');
  return `digitalWrite(${pin}, ${b.getFieldValue('STATE')});\n`;
};
F.io_builtin_led = (b, gen) => {
  gen.pinMode('LED_BUILTIN', 'OUTPUT');
  return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('STATE')});\n`;
};
F.io_analog_write = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.pinMode(pin, 'OUTPUT');
  return `analogWrite(${pin}, ${gen.value(b, 'VALUE', O.NONE)});\n`;
};
F.io_tone = (b, gen) => `tone(${b.getFieldValue('PIN')}, ${gen.value(b, 'FREQ', O.NONE, '440')}, ${gen.value(b, 'MS', O.NONE, '500')});\n`;
F.io_notone = (b) => `noTone(${b.getFieldValue('PIN')});\n`;
F.serial_print = (b, gen) => {
  gen.setups.set('serial', `Serial.begin(${gen.spec.baud});`);
  const text = gen.value(b, 'TEXT', O.NONE, '""');
  return `Serial.${b.getFieldValue('NL') === 'LN' ? 'println' : 'print'}(${text});\n`;
};
F.servo_write = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.includes.add(gen.spec.family === 'esp32' ? '#include <ESP32Servo.h>' : '#include <Servo.h>');
  gen.globals.set(`servo${pin}`, `Servo servo_${pin};`);
  gen.setups.set(`servo${pin}`, `servo_${pin}.attach(${pin});`);
  return `servo_${pin}.write(${gen.value(b, 'ANGLE', O.NONE, '90')});\n`;
};
F.lcd_print = (b, gen) => {
  gen.lcd();
  return `lcd.print(${gen.value(b, 'TEXT', O.NONE, '""')});\n`;
};
F.lcd_cursor = (b, gen) => {
  gen.lcd();
  return `lcd.setCursor(${gen.value(b, 'COL', O.NONE)}, ${gen.value(b, 'ROW', O.NONE)});\n`;
};
F.lcd_clear = (_b, gen) => {
  gen.lcd();
  return 'lcd.clear();\n';
};
F.io_digital_read = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.pinMode(pin, b.getFieldValue('MODE'));
  return [`digitalRead(${pin})`, O.POSTFIX];
};
F.io_analog_read = (b) => [`analogRead(${b.getFieldValue('PIN')})`, O.POSTFIX];
F.time_millis = () => ['millis()', O.POSTFIX];
F.control_wait = (b, gen) => {
  const t = gen.value(b, 'TIME', O.MUL, '1');
  return b.getFieldValue('UNIT') === 'S' ? `delay(1000 * ${t});\n` : `delay(${t});\n`;
};
F.math_map = (b, gen) => [`map(${['V', 'A', 'B', 'C', 'D'].map((n) => gen.value(b, n, O.NONE)).join(', ')})`, O.POSTFIX];

// ---- standard Blockly blocks

F.controls_if = (b, gen) => {
  let n = 0;
  let code = '';
  while (b.getInput(`IF${n}`)) {
    const cond = gen.value(b, `IF${n}`, O.NONE, 'false');
    code += `${n ? ' else ' : ''}if (${cond}) {\n${gen.statementToCode(b, `DO${n}`)}}`;
    n++;
  }
  if (b.getInput('ELSE')) code += ` else {\n${gen.statementToCode(b, 'ELSE')}}`;
  return code + '\n';
};
F.controls_repeat_ext = (b, gen) => {
  const times = gen.value(b, 'TIMES', O.REL, '10');
  const v = gen.nameDB_!.getDistinctName('count', Blockly.Names.NameType.VARIABLE);
  return `for (int ${v} = 0; ${v} < ${times}; ${v}++) {\n${gen.statementToCode(b, 'DO')}}\n`;
};
F.controls_whileUntil = (b, gen) => {
  const until = b.getFieldValue('MODE') === 'UNTIL';
  let cond = gen.value(b, 'BOOL', until ? O.UNARY : O.NONE, 'false');
  if (until) cond = `!${cond}`;
  return `while (${cond}) {\n${gen.statementToCode(b, 'DO')}}\n`;
};
F.controls_for = (b, gen) => {
  const v = gen.getVariableName(b.getFieldValue('VAR'));
  const from = gen.value(b, 'FROM', O.ASSIGN), to = gen.value(b, 'TO', O.REL), by = gen.value(b, 'BY', O.ASSIGN, '1');
  const up = !/^-/.test(by);
  return `for (${v} = ${from}; ${v} ${up ? '<=' : '>='} ${to}; ${v} += ${by}) {\n${gen.statementToCode(b, 'DO')}}\n`;
};
F.controls_flow_statements = (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
F.logic_compare = (b, gen) => {
  const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP') as string]!;
  const ord = op === '==' || op === '!=' ? O.EQ : O.REL;
  return [`${gen.value(b, 'A', ord)} ${op} ${gen.value(b, 'B', ord)}`, ord];
};
F.logic_operation = (b, gen) => {
  const and = b.getFieldValue('OP') === 'AND';
  const ord = and ? O.AND : O.OR;
  return [`${gen.value(b, 'A', ord, 'false')} ${and ? '&&' : '||'} ${gen.value(b, 'B', ord, 'false')}`, ord];
};
F.logic_negate = (b, gen) => [`!${gen.value(b, 'BOOL', O.UNARY, 'true')}`, O.UNARY];
F.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
F.math_number = (b) => {
  const n = Number(b.getFieldValue('NUM'));
  return [String(n), n < 0 ? O.UNARY : O.ATOMIC];
};
F.math_arithmetic = (b, gen) => {
  const op = b.getFieldValue('OP') as string;
  if (op === 'POWER') return [`pow(${gen.value(b, 'A', O.NONE)}, ${gen.value(b, 'B', O.NONE)})`, O.POSTFIX];
  const [sym, ord] = ({ ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MUL], DIVIDE: ['/', O.MUL] } as Record<string, [string, number]>)[op];
  return [`${gen.value(b, 'A', ord)} ${sym} ${gen.value(b, 'B', ord + 0.5)}`, ord];
};
F.math_modulo = (b, gen) => [`${gen.value(b, 'DIVIDEND', O.MUL)} % ${gen.value(b, 'DIVISOR', O.MUL, '1')}`, O.MUL];
F.math_random_int = (b, gen) => [`random(${gen.value(b, 'FROM', O.NONE)}, ${gen.value(b, 'TO', O.ADD, '100')} + 1)`, O.POSTFIX];
F.math_constrain = (b, gen) => [`constrain(${gen.value(b, 'VALUE', O.NONE)}, ${gen.value(b, 'LOW', O.NONE)}, ${gen.value(b, 'HIGH', O.NONE, '100')})`, O.POSTFIX];
F.text = (b) => [JSON.stringify(String(b.getFieldValue('TEXT'))), O.ATOMIC];
F.text_join = (b, gen) => {
  const n = (b as any).itemCount_ ?? 0;
  if (!n) return ['""', O.ATOMIC];
  const parts = Array.from({ length: n }, (_, i) => gen.value(b, `ADD${i}`, O.ADD, '""'));
  return [`String(${parts[0]})${parts.slice(1).map((p) => ` + String(${p})`).join('')}`, O.ADD];
};
F.variables_get = (b, gen) => [gen.getVariableName(b.getFieldValue('VAR')), O.ATOMIC];
F.variables_set = (b, gen) => `${gen.getVariableName(b.getFieldValue('VAR'))} = ${gen.value(b, 'VALUE', O.ASSIGN)};\n`;
F.math_change = (b, gen) => `${gen.getVariableName(b.getFieldValue('VAR'))} += ${gen.value(b, 'DELTA', O.ASSIGN, '1')};\n`;

/** Turn a workspace into a complete sketch. */
export function generateSketch(ws: Blockly.Workspace, spec: BoardSpec): string {
  g.spec = spec;
  g.init(ws);
  let setupBody = '';
  let loopBody = '';
  for (const top of ws.getTopBlocks(true)) {
    if (top.type === 'arduino_start') setupBody += g.statementToCode(top, 'DO');
    else if (top.type === 'arduino_forever') loopBody += g.statementToCode(top, 'DO');
  }
  const vars = ws.getVariableMap().getAllVariables().map((v) => `long ${g.getVariableName(v.getId())} = 0;`);
  const head = [...g.includes, ...(g.includes.size ? [''] : []), ...g.globals.values(), ...vars];
  const setups = [...g.setups.values()].map((l) => `  ${l}`);
  return [
    '// Generated from blocks — switch to Text mode to edit the code directly.',
    ...head,
    ...(head.length ? [''] : []),
    'void setup() {',
    ...setups,
    ...(setupBody ? [setupBody.replace(/\n$/, '')] : []),
    '}',
    '',
    'void loop() {',
    ...(loopBody ? [loopBody.replace(/\n$/, '')] : []),
    '}',
    '',
  ].join('\n');
}

// ------------------------------------------------------------------ toolbox & defaults

export function toolbox(spec: BoardSpec) {
  const num = (n: number) => ({ kind: 'block', type: 'math_number', fields: { NUM: n } });
  const shadow = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const txt = (s: string) => ({ shadow: { type: 'text', fields: { TEXT: s } } });
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Output', colour: C.output,
        contents: [
          { kind: 'block', type: 'io_builtin_led' },
          { kind: 'block', type: 'io_digital_write' },
          { kind: 'block', type: 'io_analog_write', inputs: { VALUE: shadow(128) } },
          { kind: 'block', type: 'io_tone', inputs: { FREQ: shadow(440), MS: shadow(500) } },
          { kind: 'block', type: 'io_notone' },
          { kind: 'block', type: 'serial_print', inputs: { TEXT: txt('hello world') } },
        ],
      },
      {
        kind: 'category', name: 'Devices', colour: C.device,
        contents: [
          { kind: 'block', type: 'servo_write', fields: { PIN: spec.family === 'esp32' ? 18 : spec.pwmPins === 'all' ? spec.pins[2] : spec.pwmPins[Math.min(3, spec.pwmPins.length - 1)] }, inputs: { ANGLE: shadow(90) } },
          { kind: 'block', type: 'lcd_print', inputs: { TEXT: txt('Hello!') } },
          { kind: 'block', type: 'lcd_cursor', inputs: { COL: shadow(0), ROW: shadow(1) } },
          { kind: 'block', type: 'lcd_clear' },
        ],
      },
      {
        kind: 'category', name: 'Input', colour: C.input,
        contents: [
          { kind: 'block', type: 'io_digital_read' },
          { kind: 'block', type: 'io_analog_read' },
          { kind: 'block', type: 'time_millis' },
        ],
      },
      {
        kind: 'category', name: 'Control', colour: C.control,
        contents: [
          { kind: 'block', type: 'arduino_start' },
          { kind: 'block', type: 'arduino_forever' },
          { kind: 'block', type: 'control_wait', inputs: { TIME: shadow(1) } },
          { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadow(10) } },
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
          { kind: 'block', type: 'controls_whileUntil' },
          { kind: 'block', type: 'controls_for', inputs: { FROM: shadow(1), TO: shadow(10), BY: shadow(1) } },
          { kind: 'block', type: 'controls_flow_statements' },
        ],
      },
      {
        kind: 'category', name: 'Math', colour: C.math,
        contents: [
          num(0),
          { kind: 'block', type: 'math_arithmetic', inputs: { A: shadow(1), B: shadow(1) } },
          { kind: 'block', type: 'logic_compare', inputs: { A: shadow(0), B: shadow(0) } },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_negate' },
          { kind: 'block', type: 'logic_boolean' },
          { kind: 'block', type: 'math_random_int', inputs: { FROM: shadow(1), TO: shadow(100) } },
          { kind: 'block', type: 'math_map', inputs: { V: shadow(0), A: shadow(0), B: shadow(spec.adcBits === 12 ? 4095 : 1023), C: shadow(0), D: shadow(255) } },
          { kind: 'block', type: 'math_constrain', inputs: { VALUE: shadow(50), LOW: shadow(0), HIGH: shadow(100) } },
          { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: shadow(10), DIVISOR: shadow(3) } },
        ],
      },
      {
        kind: 'category', name: 'Text', colour: C.text,
        contents: [{ kind: 'block', type: 'text' }, { kind: 'block', type: 'text_join' }],
      },
      { kind: 'category', name: 'Variables', colour: '#e67e22', custom: 'VARIABLE' },
    ],
  };
}

/** Default program: blink the built-in LED (like Tinkercad's starter blocks). */
export const DEFAULT_BLOCKS = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'arduino_forever', x: 30, y: 30,
        inputs: {
          DO: {
            block: {
              type: 'io_builtin_led', fields: { STATE: 'HIGH' },
              next: {
                block: {
                  type: 'control_wait', fields: { UNIT: 'S' }, inputs: { TIME: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
                  next: {
                    block: {
                      type: 'io_builtin_led', fields: { STATE: 'LOW' },
                      next: { block: { type: 'control_wait', fields: { UNIT: 'S' }, inputs: { TIME: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } } },
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

/** Headless: blocks JSON → sketch (used for tests and when loading a project). */
export function sketchFromJson(json: unknown, spec: BoardSpec): string {
  defineArduinoBlocks();
  setBlocksBoard(spec);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json as any, ws);
    return generateSketch(ws, spec);
  } finally {
    ws.dispose();
  }
}
