import { describe, expect, it } from 'vitest';
import { McuRuntime } from '../src/mcu/runtime';
import { UNO } from '../src/mcu/boards';

/** sketch → what it prints on the serial monitor within about a second */
const cases: Record<string, string> = {
  class_basic: `class Blinker { public: Blinker(int p) : pin(p), n(0) {} void tick() { n++; } int count() { return n; } private: int pin; int n; }; Blinker b(13); void setup(){Serial.begin(9600); b.tick(); b.tick(); Serial.println(b.count());} void loop(){}`,
  out_of_line: `class Led { public: Led(int p); void on(); bool isOn() const; private: int pin; bool state = false; };
Led::Led(int p) : pin(p) { pinMode(pin, OUTPUT); }
void Led::on() { digitalWrite(pin, HIGH); state = true; }
bool Led::isOn() const { return state; }
Led led(13);
void setup(){ Serial.begin(9600); led.on(); Serial.println(led.isOn()); Serial.println(digitalRead(13)); } void loop(){}`,
  this_and_methods: `class Counter { int v; public: Counter() { v = 10; } void add(int d = 1) { this->v += d; bump(); } void bump() { v++; } int get() { return this->v; } }; Counter c;
void setup(){ Serial.begin(9600); c.add(); c.add(5); Serial.println(c.get()); } void loop(){}`,
  array_of_objects: `class Btn { public: Btn() : presses(0) {} void press() { presses++; } int presses; }; Btn btns[3];
void setup(){ Serial.begin(9600); btns[1].press(); btns[1].press(); btns[2].press(); for (auto &b : btns) Serial.print(b.presses); Serial.println(); } void loop(){}`,
  inheritance: `class Shape { public: Shape(int s) : sides(s) {} int getSides() { return sides; } protected: int sides; };
class Square : public Shape { public: Square() : Shape(4), size(2) {} int area() { return size * size; } private: int size; };
Square sq; void setup(){ Serial.begin(9600); Serial.println(sq.getSides()); Serial.println(sq.area()); } void loop(){}`,
  member_objects: `#include <Servo.h>
class Arm { public: Arm(int p) : pin(p) {} void begin() { s.attach(pin); } void move(int a) { s.write(a); angle = a; } int angle = 0; private: Servo s; int pin; };
Arm arm(9); void setup(){ Serial.begin(9600); arm.begin(); arm.move(45); Serial.println(arm.angle); } void loop(){}`,
  pointer_to_obj: `class Acc { public: int total = 0; void add(int x) { total += x; } }; Acc a; Acc *p = &a;
void setup(){ Serial.begin(9600); p->add(3); p->add(4); Serial.println(a.total); Serial.println(p->total); } void loop(){}`,
  pass_by_ref: `class Acc { public: int total = 0; void add(int x) { total += x; } }; void fill(Acc &acc) { acc.add(5); } Acc a;
void setup(){ Serial.begin(9600); fill(a); fill(a); Serial.println(a.total); } void loop(){}`,
  temp_ctor: `class P { public: P(int a, int b) : x(a), y(b) {} int sum() { return x + y; } int x; int y; };
void setup(){ Serial.begin(9600); P p = P(2, 3); Serial.println(p.sum()); P q{4, 5}; Serial.println(q.sum()); } void loop(){}`,
  struct_method: `struct Vec { float x, y; float len2() { return x * x + y * y; } }; Vec v = {3, 4};
void setup(){ Serial.begin(9600); Serial.println(v.len2()); } void loop(){}`,
  millis_class: `class Flasher { unsigned long last = 0; int pin; long ms; public: Flasher(int p, long m) : pin(p), ms(m) { pinMode(p, OUTPUT); } void update() { if (millis() - last >= ms) { last = millis(); digitalWrite(pin, !digitalRead(pin)); n++; } } int n = 0; };
Flasher f1(12, 100), f2(13, 250); void setup(){ Serial.begin(9600); } void loop(){ f1.update(); f2.update(); if (millis() > 1000 && millis() < 1003) { Serial.println(f1.n); Serial.println(f2.n); delay(5); } }`,
  auto_range_for: `int a[] = {1,2,3}; void setup(){Serial.begin(9600); int s=0; for (int v : a) s += v; Serial.println(s); auto k = 5; Serial.println(k); for (auto &v : a) v *= 2; Serial.println(a[2]); auto str = String("hi"); Serial.println(str.length());} void loop(){}`,
  err_no_member: `class A { public: void f() {} }; A a; void setup(){ a.g(); } void loop(){}`,
  err_ctor_args: `class A { public: A(int x) {} }; A a; void setup(){} void loop(){}`,
  err_template: `template <typename T> T mx(T a, T b){ return a; } void setup(){} void loop(){}`,
  macro_args: `#define LED_ON(p) digitalWrite(p, HIGH)\n#define MAX3(a,b,c) max(max(a,b),c)\nvoid setup(){ Serial.begin(9600); pinMode(13, OUTPUT); LED_ON(13); Serial.println(MAX3(4, 9, 2)); Serial.println(digitalRead(13)); } void loop(){}`,
  overload_prints: `void show(int v){ Serial.print("int "); Serial.println(v); } void show(float v){ Serial.print("float "); Serial.println(v); } void show(String s){ Serial.print("str "); Serial.println(s); }
void setup(){ Serial.begin(9600); show(3); show(2.5); show("x"); } void loop(){}`,
};

const EXPECT: Record<string, string> = {
  class_basic: '2\n',
  out_of_line: '1\n1\n',
  this_and_methods: '18\n',
  array_of_objects: '021\n',
  inheritance: '4\n4\n',
  member_objects: '45\n',
  pointer_to_obj: '7\n7\n',
  pass_by_ref: '10\n',
  temp_ctor: '5\n9\n',
  struct_method: '25.00\n',
  millis_class: '10\n4\n',
  auto_range_for: '6\n5\n6\n2\n',
  macro_args: '9\n1\n',
  overload_prints: 'int 3\nfloat 2.50\nstr x\n',
};
const ERRORS: Record<string, string> = {
  err_no_member: "'A' has no member function named 'g'",
  err_ctor_args: "wrong number of arguments to function 'A::A'",
  err_template: "templates are not supported",
};

function run(src: string) {
  const r = new McuRuntime(UNO);
  const err = r.load(src);
  if (err) return { err: err.message, out: '' };
  r.runUntil(1_100_000);
  return { err: r.error?.message ?? null, out: r.serialOut };
}

describe('compiler: classes, overloads, default arguments, macros, auto / range-for', () => {
  it.each(Object.keys(EXPECT))('%s', (name) => {
    const r = run(cases[name]);
    expect(r.err).toBeNull();
    expect(r.out).toBe(EXPECT[name]);
  });
  it.each(Object.keys(ERRORS))('%s gives a clear error', (name) => {
    expect(run(cases[name]).err).toContain(ERRORS[name]);
  });
  it('picks the overload by argument type, and reports ambiguous calls', () => {
    expect(run(`int add(int a, int b){return a+b;} float add(float a, float b){return a+b+0.5;} void setup(){Serial.begin(9600); Serial.println(add(1,2)); Serial.println(add(1.0,2.0));} void loop(){}`).out).toBe('3\n3.50\n');
    expect(run(`void f(long a){} void f(unsigned long a){} void setup(){ f(1); } void loop(){}`).err).toContain('ambiguous');
  });
  it('default arguments given in a prototype apply to the definition', () => {
    expect(run(`int f(int a, int b = 10); void setup(){Serial.begin(9600); Serial.println(f(1)); Serial.println(f(1,2));} void loop(){} int f(int a, int b){return a+b;}`).out).toBe('11\n3\n');
  });
  it('lambdas and goto get a helpful message', () => {
    expect(run(`void setup(){ auto f = [](int x){ return x; }; } void loop(){}`).err).toContain('lambda');
    expect(run(`void setup(){ a: ; goto a; } void loop(){}`).err).toContain('goto');
  });
});
