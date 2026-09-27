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

/** every I/O pin of the board, labelled like its header ("D13", "A0", "GPIO23") */
function pinLabel(n: number): string {
  if (!board) return String(n);
  const id = board.pinId(n);
  return id && id !== String(n) ? `${id}` : String(n);
}
function digitalOptions(): [string, string][] {
  if (!board) return Array.from({ length: 20 }, (_, i) => [String(i), String(i)]);
  return board.pins.filter((n) => !board!.inputOnly.includes(n)).map((n) => [pinLabel(n), String(n)]);
}
function inputOptions(): [string, string][] {
  if (!board) return Array.from({ length: 20 }, (_, i) => [String(i), String(i)]);
  return board.pins.map((n) => [pinLabel(n), String(n)]);
}
function pwmOptions(): [string, string][] {
  if (!board || board.pwmPins === 'all') return digitalOptions();
  return board.pwmPins.map((n) => [`~${pinLabel(n)}`, String(n)]);
}
/**
 * Pin dropdown. Programs saved before pins were dropdowns store numbers (18), so values are
 * compared as text.
 */
class FieldPin extends Blockly.FieldDropdown {
  static fromJson(options: any) {
    return new FieldPin(options.options, undefined, options);
  }
  protected override doClassValidation_(v?: any): string | null {
    return super.doClassValidation_(v === undefined || v === null ? v : String(v)) ?? null;
  }
}
let pinFieldRegistered = false;
const pinField = (name: string, options: () => [string, string][]) => ({ type: 'field_pin', name, options });

// ------------------------------------------------------------------ block definitions

const C = { output: '#3d8fd6', input: '#9b59b6', control: '#f2a93b', math: '#4caf6e', text: '#5f7a8c', device: '#16a085', hat: '#e05a47' };

const HL = [['HIGH', 'HIGH'], ['LOW', 'LOW']];

const DEFS = [
  { type: 'arduino_start', message0: 'on start %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.hat, tooltip: 'Runs once when the board starts (setup).' },
  { type: 'arduino_forever', message0: 'forever %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], colour: C.hat, tooltip: 'Repeats forever (loop).' },

  { type: 'io_digital_write', message0: 'set pin %1 to %2', args0: [pinField('PIN', digitalOptions), { type: 'field_dropdown', name: 'STATE', options: HL }], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_builtin_led', message0: 'set built-in LED to %1', args0: [{ type: 'field_dropdown', name: 'STATE', options: HL }], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_analog_write', message0: 'set pin %1 PWM to %2', args0: [pinField('PIN', pwmOptions), { type: 'input_value', name: 'VALUE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.output, tooltip: '0 = off … 255 = fully on' },
  { type: 'io_tone', message0: 'play tone on pin %1 at %2 Hz for %3 ms', args0: [pinField('PIN', digitalOptions), { type: 'input_value', name: 'FREQ', check: 'Number' }, { type: 'input_value', name: 'MS', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'io_notone', message0: 'stop tone on pin %1', args0: [pinField('PIN', digitalOptions)], previousStatement: null, nextStatement: null, colour: C.output },
  { type: 'serial_print', message0: 'print to serial monitor %1 %2', args0: [{ type: 'input_value', name: 'TEXT' }, { type: 'field_dropdown', name: 'NL', options: [['with newline', 'LN'], ['without newline', 'NONE']] }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.text },

  { type: 'servo_write', message0: 'rotate servo on pin %1 to %2 degrees', args0: [pinField('PIN', digitalOptions), { type: 'input_value', name: 'ANGLE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_print', message0: 'LCD (I2C 0x27) print %1', args0: [{ type: 'input_value', name: 'TEXT' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_cursor', message0: 'LCD set cursor column %1 row %2', args0: [{ type: 'input_value', name: 'COL', check: 'Number' }, { type: 'input_value', name: 'ROW', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.device },
  { type: 'lcd_clear', message0: 'LCD clear', previousStatement: null, nextStatement: null, colour: C.device },

  { type: 'io_digital_read', message0: 'read digital pin %1 %2', args0: [pinField('PIN', inputOptions), { type: 'field_dropdown', name: 'MODE', options: [['', 'INPUT'], ['with pull-up', 'INPUT_PULLUP']] }], output: 'Number', colour: C.input },
  { type: 'io_analog_read', message0: 'read analog pin %1', args0: [{ type: 'field_dropdown', name: 'PIN', options: analogOptions }], output: 'Number', colour: C.input },
  { type: 'time_millis', message0: 'milliseconds since start', output: 'Number', colour: C.input },

  { type: 'control_wait', message0: 'wait %1 %2', args0: [{ type: 'input_value', name: 'TIME', check: 'Number' }, { type: 'field_dropdown', name: 'UNIT', options: [['seconds', 'S'], ['milliseconds', 'MS']] }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.control },
  // more output
  { type: 'io_toggle', message0: 'toggle pin %1', args0: [pinField('PIN', digitalOptions)], previousStatement: null, nextStatement: null, colour: C.output, tooltip: 'HIGH becomes LOW and LOW becomes HIGH.' },
  { type: 'io_rgb', message0: 'RGB LED on pins R %1 G %2 B %3 %4', args0: [pinField('R', pwmOptions), pinField('G', pwmOptions), pinField('B', pwmOptions), { type: 'input_dummy' }], message1: 'red %1', args1: [{ type: 'input_value', name: 'RV', check: 'Number', align: 'RIGHT' }], message2: 'green %1', args2: [{ type: 'input_value', name: 'GV', check: 'Number', align: 'RIGHT' }], message3: 'blue %1', args3: [{ type: 'input_value', name: 'BV', check: 'Number', align: 'RIGHT' }], inputsInline: false, previousStatement: null, nextStatement: null, colour: C.output, tooltip: 'Common-cathode RGB LED: 0 = off … 255 = full brightness for each colour.' },
  { type: 'serial_print_value', message0: 'print %1 = %2 to serial monitor', args0: [{ type: 'field_input', name: 'LABEL', text: 'value' }, { type: 'input_value', name: 'VALUE' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.text, tooltip: 'Prints a label and a value on one line, e.g. "light = 512".' },

  // sensors
  { type: 'sensor_button', message0: 'button on pin %1 is pressed', args0: [pinField('PIN', inputOptions)], output: 'Boolean', colour: C.input, tooltip: 'Wire the button between the pin and GND: the internal pull-up keeps the pin HIGH until it is pressed.' },
  { type: 'sensor_distance', message0: 'distance in cm (HC-SR04 trig %1 echo %2)', args0: [pinField('TRIG', digitalOptions), pinField('ECHO', inputOptions)], output: 'Number', colour: C.input, tooltip: 'Ultrasonic distance sensor. 0 = nothing in range.' },
  { type: 'sensor_tmp36', message0: 'temperature in °C (TMP36 on %1)', args0: [{ type: 'field_dropdown', name: 'PIN', options: analogOptions }], output: 'Number', colour: C.input, tooltip: 'TMP36 analog temperature sensor: 10 mV per °C with 0.5 V at 0 °C.' },
  { type: 'sensor_percent', message0: 'analog pin %1 in percent', args0: [{ type: 'field_dropdown', name: 'PIN', options: analogOptions }], output: 'Number', colour: C.input, tooltip: 'analogRead scaled to 0 – 100 (a potentiometer, light sensor…).' },

  // control
  { type: 'control_every', message0: 'every %1 milliseconds %2 %3', args0: [{ type: 'input_value', name: 'MS', check: 'Number' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: C.control, tooltip: 'Runs the blocks inside every so often without stopping the rest of the program (no wait). Put it in "forever".' },
  { type: 'control_wait_until', message0: 'wait until %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], previousStatement: null, nextStatement: null, colour: C.control },

  // math
  { type: 'math_minmax', message0: '%1 of %2 and %3', args0: [{ type: 'field_dropdown', name: 'OP', options: [['smaller', 'min'], ['bigger', 'max']] }, { type: 'input_value', name: 'A', check: 'Number' }, { type: 'input_value', name: 'B', check: 'Number' }], inputsInline: true, output: 'Number', colour: C.math },
  { type: 'math_map', message0: 'map %1 from %2 – %3 to %4 – %5', args0: [{ type: 'input_value', name: 'V' }, { type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }, { type: 'input_value', name: 'C' }, { type: 'input_value', name: 'D' }], inputsInline: true, output: 'Number', colour: C.math },
];

let defined = false;
export function defineArduinoBlocks() {
  if (defined) return;
  defined = true;
  Blockly.setLocale(En as unknown as Record<string, string>);
  if (!pinFieldRegistered) {
    pinFieldRegistered = true;
    Blockly.fieldRegistry.register('field_pin', FieldPin);
  }
  Blockly.common.defineBlocksWithJsonArray(DEFS as any);
}

// ------------------------------------------------------------------ generator

const O = { ATOMIC: 0, POSTFIX: 1, UNARY: 2, MUL: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, COND: 13, ASSIGN: 14, NONE: 99 };

const RESERVED = 'setup,loop,if,else,for,while,do,switch,case,break,continue,return,int,long,float,double,char,byte,bool,boolean,void,String,const,static,true,false,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,Serial,delay,millis,lcd,random,map,min,max,abs,count';

class ArduinoGenerator extends Blockly.CodeGenerator {
  setups = new Map<string, string>();
  globals = new Map<string, string>();
  includes = new Set<string>();
  /** helper functions a block needs (distance sensor…) */
  helpers = new Map<string, string>();
  /** the user's own functions */
  functions = new Map<string, string>();
  /** variables that hold fractions (decimal numbers or division) → declared float, not long */
  floatVars = new Set<string>();
  timers = 0;
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
    this.helpers.clear();
    this.functions.clear();
    this.timers = 0;
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
  getProcedureName(name: string): string {
    return this.nameDB_!.getName(name, Blockly.Names.NameType.PROCEDURE);
  }
  varType(nameOrId: string): string {
    const v = this.nameDB_ ? this.getVariableName(nameOrId) : nameOrId;
    return this.floatVars.has(v) ? 'float' : 'long';
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

F.io_toggle = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.pinMode(pin, 'OUTPUT');
  return `digitalWrite(${pin}, !digitalRead(${pin}));\n`;
};
F.io_rgb = (b, gen) =>
  (['R', 'G', 'B'] as const)
    .map((c) => {
      const pin = b.getFieldValue(c);
      gen.pinMode(pin, 'OUTPUT');
      return `analogWrite(${pin}, ${gen.value(b, `${c}V`, O.NONE)});\n`;
    })
    .join('');
F.serial_print_value = (b, gen) => {
  gen.setups.set('serial', `Serial.begin(${gen.spec.baud});`);
  return `Serial.print(${JSON.stringify(`${b.getFieldValue('LABEL')} = `)});\nSerial.println(${gen.value(b, 'VALUE', O.NONE)});\n`;
};
F.sensor_button = (b, gen) => {
  const pin = b.getFieldValue('PIN');
  gen.pinMode(pin, 'INPUT_PULLUP');
  return [`digitalRead(${pin}) == LOW`, O.EQ];
};
F.sensor_distance = (b, gen) => {
  const trig = b.getFieldValue('TRIG'), echo = b.getFieldValue('ECHO');
  gen.pinMode(trig, 'OUTPUT');
  gen.pinMode(echo, 'INPUT');
  gen.helpers.set('distance', [
    '// HC-SR04: a 10 µs trigger pulse, then the echo pulse length is the round trip (58 µs per cm)',
    'long readDistanceCm(int trig, int echo) {',
    '  digitalWrite(trig, LOW);',
    '  delayMicroseconds(2);',
    '  digitalWrite(trig, HIGH);',
    '  delayMicroseconds(10);',
    '  digitalWrite(trig, LOW);',
    '  return pulseIn(echo, HIGH, 30000) / 58;',
    '}',
  ].join('\n'));
  return [`readDistanceCm(${trig}, ${echo})`, O.POSTFIX];
};
F.sensor_tmp36 = (b, gen) => {
  const max = 2 ** gen.spec.adcBits - 1;
  return [`(analogRead(${b.getFieldValue('PIN')}) * ${gen.spec.vcc.toFixed(1)} / ${max}.0 - 0.5) * 100`, O.MUL];
};
F.sensor_percent = (b, gen) => [`analogRead(${b.getFieldValue('PIN')}) * 100 / ${2 ** gen.spec.adcBits - 1}`, O.MUL];
F.control_every = (b, gen) => {
  const n = ++gen.timers;
  gen.globals.set(`timer${n}`, `unsigned long lastRun${n} = 0;`);
  const ms = gen.value(b, 'MS', O.REL, '1000');
  return `if (millis() - lastRun${n} >= ${ms}) {\n${gen.INDENT}lastRun${n} = millis();\n${gen.statementToCode(b, 'DO')}}\n`;
};
F.control_wait_until = (b, gen) => `while (!(${gen.value(b, 'COND', O.NONE, 'true')})) {\n${gen.INDENT}delay(1);\n}\n`;
F.math_minmax = (b, gen) => [`${b.getFieldValue('OP')}(${gen.value(b, 'A', O.NONE)}, ${gen.value(b, 'B', O.NONE)})`, O.POSTFIX];
F.math_round = (b, gen) => {
  const fn = ({ ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' } as Record<string, string>)[b.getFieldValue('OP')] ?? 'round';
  return [`${fn}(${gen.value(b, 'NUM', O.NONE)})`, O.POSTFIX];
};
F.math_single = (b, gen) => {
  const op = b.getFieldValue('OP') as string;
  const x = gen.value(b, 'NUM', op === 'NEG' ? O.UNARY : O.NONE);
  const code = ({ ROOT: `sqrt(${x})`, ABS: `abs(${x})`, NEG: `-${x}`, LN: `log(${x})`, LOG10: `log10(${x})`, EXP: `exp(${x})`, POW10: `pow(10, ${x})` } as Record<string, string>)[op] ?? x;
  return [code, op === 'NEG' ? O.UNARY : O.POSTFIX];
};

// ---- functions (Blockly's procedure blocks)

function procedureCode(b: Blockly.Block, gen: Gen): string {
  const name = gen.getProcedureName(b.getFieldValue('NAME'));
  const params = ((b as any).arguments_ ?? []) as string[];
  const returns = b.type === 'procedures_defreturn';
  let body = gen.statementToCode(b, 'STACK');
  if (returns) body += `${gen.INDENT}return ${gen.value(b, 'RETURN', O.NONE)};\n`;
  // parameters take any number, whole or fractional
  const args = params.map((p) => `float ${gen.getVariableName(p)}`).join(', ');
  return `${returns ? 'float' : 'void'} ${name}(${args}) {\n${body}}`;
}
F.procedures_defnoreturn = (b, gen) => {
  gen.functions.set(b.getFieldValue('NAME'), procedureCode(b, gen));
  return null;
};
F.procedures_defreturn = F.procedures_defnoreturn;
function callArgs(b: Blockly.Block, gen: Gen) {
  const params = ((b as any).arguments_ ?? []) as string[];
  return params.map((_, i) => gen.value(b, `ARG${i}`, O.NONE)).join(', ');
}
F.procedures_callnoreturn = (b, gen) => `${gen.getProcedureName(b.getFieldValue('NAME'))}(${callArgs(b, gen)});\n`;
F.procedures_callreturn = (b, gen) => [`${gen.getProcedureName(b.getFieldValue('NAME'))}(${callArgs(b, gen)})`, O.POSTFIX];
F.procedures_ifreturn = (b, gen) => {
  const cond = gen.value(b, 'CONDITION', O.NONE, 'false');
  const ret = (b as any).hasReturnValue_ ? ` ${gen.value(b, 'VALUE', O.NONE)}` : '';
  return `if (${cond}) {\n${gen.INDENT}return${ret};\n}\n`;
};

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
F.math_modulo = (b, gen) => [`(long)(${gen.value(b, 'DIVIDEND', O.NONE)}) % (long)(${gen.value(b, 'DIVISOR', O.NONE, '1')})`, O.MUL];
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
  g.floatVars = floatVariables(ws);
  let setupBody = '';
  let loopBody = '';
  for (const top of ws.getTopBlocks(true)) {
    if (!top.isEnabled()) continue;
    if (top.type === 'arduino_start') setupBody += g.statementToCode(top, 'DO');
    else if (top.type === 'arduino_forever') loopBody += g.statementToCode(top, 'DO');
    else if (top.type.startsWith('procedures_def')) g.blockToCode(top);
  }
  const vars = ws.getVariableMap().getAllVariables().map((v) => `${g.varType(v.getId())} ${g.getVariableName(v.getId())} = 0;`);
  const head = [...g.includes, ...(g.includes.size ? [''] : []), ...g.globals.values(), ...vars];
  const setups = [...g.setups.values()].map((l) => `  ${l}`);
  const fns = [...g.helpers.values(), ...g.functions.values()];
  return [
    '// Generated from blocks — switch to Text mode to edit the code directly.',
    ...head,
    ...(head.length ? [''] : []),
    ...fns.flatMap((f) => [f, '']),
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

/**
 * Variables that ever get a fractional value (a decimal number, a division, a temperature…) are
 * declared float so 23.5 °C doesn't become 23; everything else stays a whole number (long).
 */
function floatVariables(ws: Blockly.Workspace): Set<string> {
  const out = new Set<string>();
  const fractional = (blk: Blockly.Block | null): boolean => {
    if (!blk) return false;
    if (blk.type === 'math_number' && !Number.isInteger(Number(blk.getFieldValue('NUM')))) return true;
    if (blk.type === 'math_arithmetic' && ['DIVIDE', 'POWER'].includes(blk.getFieldValue('OP'))) return true;
    if (['sensor_tmp36', 'math_single', 'procedures_callreturn'].includes(blk.type)) return true;
    return blk.getChildren(false).some(fractional);
  };
  for (const blk of ws.getAllBlocks(false)) {
    if (blk.type === 'variables_set' || blk.type === 'math_change') {
      const input = blk.type === 'variables_set' ? 'VALUE' : 'DELTA';
      if (fractional(blk.getInputTargetBlock(input))) out.add(g.getVariableName(blk.getFieldValue('VAR')));
    }
  }
  return out;
}

// ------------------------------------------------------------------ toolbox & defaults

export function toolbox(spec: BoardSpec) {
  setBlocksBoard(spec);
  const num = (n: number) => ({ kind: 'block', type: 'math_number', fields: { NUM: n } });
  const shadow = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const txt = (s: string) => ({ shadow: { type: 'text', fields: { TEXT: s } } });
  /** first of the preferred pins that this board has in the dropdown */
  const pick = (opts: [string, string][], ...pref: number[]) => pref.map(String).find((p) => opts.some(([, v]) => v === p)) ?? opts[Math.min(2, opts.length - 1)]?.[1] ?? '0';
  const d = digitalOptions(), pw = pwmOptions(), inp = inputOptions();
  const esp = spec.family === 'esp32';
  const led = pick(d, 13, 25, 2), pwm = pick(pw, 9, 5, 25, 3), buzz = pick(d, 8, 26, 4), btn = pick(inp, 2, 4, 0);
  const servo = esp ? pick(d, 18) : pick(pw, 9, 3, 5);
  const [r, gg, bb] = esp ? [pick(pw, 25), pick(pw, 26), pick(pw, 27)] : [pick(pw, 9), pick(pw, 10), pick(pw, 11)];
  const trig = pick(d, esp ? 5 : 7, 3), echo = pick(inp, esp ? 18 : 6, 4);
  const adcMax = spec.adcBits === 12 ? 4095 : 1023;
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category', name: 'Output', colour: C.output,
        contents: [
          { kind: 'block', type: 'io_builtin_led' },
          { kind: 'block', type: 'io_digital_write', fields: { PIN: led } },
          { kind: 'block', type: 'io_toggle', fields: { PIN: led } },
          { kind: 'block', type: 'io_analog_write', fields: { PIN: pwm }, inputs: { VALUE: shadow(128) } },
          { kind: 'block', type: 'io_rgb', fields: { R: r, G: gg, B: bb }, inputs: { RV: shadow(255), GV: shadow(0), BV: shadow(128) } },
          { kind: 'block', type: 'io_tone', fields: { PIN: buzz }, inputs: { FREQ: shadow(440), MS: shadow(500) } },
          { kind: 'block', type: 'io_notone', fields: { PIN: buzz } },
        ],
      },
      {
        kind: 'category', name: 'Input & sensors', colour: C.input,
        contents: [
          { kind: 'block', type: 'sensor_button', fields: { PIN: btn } },
          { kind: 'block', type: 'io_digital_read', fields: { PIN: btn } },
          { kind: 'block', type: 'io_analog_read' },
          { kind: 'block', type: 'sensor_percent' },
          { kind: 'block', type: 'sensor_tmp36' },
          { kind: 'block', type: 'sensor_distance', fields: { TRIG: trig, ECHO: echo } },
          { kind: 'block', type: 'time_millis' },
        ],
      },
      {
        kind: 'category', name: 'Devices', colour: C.device,
        contents: [
          { kind: 'block', type: 'servo_write', fields: { PIN: servo }, inputs: { ANGLE: shadow(90) } },
          { kind: 'block', type: 'lcd_print', inputs: { TEXT: txt('Hello!') } },
          { kind: 'block', type: 'lcd_cursor', inputs: { COL: shadow(0), ROW: shadow(1) } },
          { kind: 'block', type: 'lcd_clear' },
        ],
      },
      {
        kind: 'category', name: 'Serial monitor', colour: C.text,
        contents: [
          { kind: 'block', type: 'serial_print', inputs: { TEXT: txt('hello world') } },
          { kind: 'block', type: 'serial_print_value', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
        ],
      },
      {
        kind: 'category', name: 'Control', colour: C.control,
        contents: [
          { kind: 'block', type: 'arduino_start' },
          { kind: 'block', type: 'arduino_forever' },
          { kind: 'block', type: 'control_wait', inputs: { TIME: shadow(1) } },
          { kind: 'block', type: 'control_every', inputs: { MS: shadow(500) } },
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
          { kind: 'block', type: 'control_wait_until' },
          { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadow(10) } },
          { kind: 'block', type: 'controls_whileUntil' },
          { kind: 'block', type: 'controls_for', inputs: { FROM: shadow(1), TO: shadow(10), BY: shadow(1) } },
          { kind: 'block', type: 'controls_flow_statements' },
        ],
      },
      {
        kind: 'category', name: 'Math & logic', colour: C.math,
        contents: [
          num(0),
          { kind: 'block', type: 'math_arithmetic', inputs: { A: shadow(1), B: shadow(1) } },
          { kind: 'block', type: 'logic_compare', inputs: { A: shadow(0), B: shadow(0) } },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_negate' },
          { kind: 'block', type: 'logic_boolean' },
          { kind: 'block', type: 'math_random_int', inputs: { FROM: shadow(1), TO: shadow(100) } },
          { kind: 'block', type: 'math_map', inputs: { V: shadow(0), A: shadow(0), B: shadow(adcMax), C: shadow(0), D: shadow(255) } },
          { kind: 'block', type: 'math_constrain', inputs: { VALUE: shadow(50), LOW: shadow(0), HIGH: shadow(100) } },
          { kind: 'block', type: 'math_minmax', inputs: { A: shadow(1), B: shadow(2) } },
          { kind: 'block', type: 'math_round', inputs: { NUM: shadow(3.1) } },
          { kind: 'block', type: 'math_single', inputs: { NUM: shadow(9) } },
          { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: shadow(10), DIVISOR: shadow(3) } },
        ],
      },
      {
        kind: 'category', name: 'Text', colour: C.text,
        contents: [{ kind: 'block', type: 'text' }, { kind: 'block', type: 'text_join' }],
      },
      { kind: 'category', name: 'Variables', colour: '#e67e22', custom: 'VARIABLE' },
      { kind: 'category', name: 'Functions', colour: '#8e5bd6', custom: 'PROCEDURE' },
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
