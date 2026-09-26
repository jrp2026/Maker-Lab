import { complete, type AiSettings, type ChatMessage } from './providers';
import { extractJson, SpecError, validateSpec, type CustomPartSpec } from './spec';

/** A complete, valid example — also offered as a no-AI sample in the dialog. */
export const EXAMPLE_7805 = {
  name: '7805 voltage regulator',
  description: 'Fixed 5 V linear regulator in a TO-220 package. Pins left→right: IN, GND, OUT. Needs about 2 V of headroom (≥ 7 V in).',
  category: 'power',
  pins: [
    { id: 'IN', x: 0, y: 0, label: 'Input (7–35 V)', kind: 'lead' },
    { id: 'GND', x: 10, y: 0, label: 'Ground', kind: 'lead' },
    { id: 'OUT', x: 20, y: 0, label: 'Output (+5 V)', kind: 'lead' },
  ],
  props: [
    { key: 'vout', label: 'Output voltage', type: 'number', default: 5, unit: 'V', min: 1.2, max: 24 },
    { key: 'dropout', label: 'Dropout', type: 'number', default: 2, unit: 'V', min: 0.1, max: 4 },
  ],
  shapes: [
    { type: 'rect', x: -6, y: -46, w: 32, h: 16, rx: 1.5, fill: '#b8bec6', stroke: '#7d858e', strokeWidth: 0.8 },
    { type: 'circle', cx: 10, cy: -38, r: 4, fill: '#f4f2ec', stroke: '#7d858e', strokeWidth: 0.6 },
    { type: 'rect', x: -6, y: -31, w: 32, h: 23, rx: 1.5, fill: '#26282c', stroke: '#111', strokeWidth: 0.6 },
    { type: 'text', x: 10, y: -20, text: 'L7805', size: 5.5, fill: '#e6e6e6' },
    { type: 'line', x1: 0, y1: -8, x2: 0, y2: 0, stroke: '#9aa3ad', strokeWidth: 2 },
    { type: 'line', x1: 10, y1: -8, x2: 10, y2: 0, stroke: '#9aa3ad', strokeWidth: 2 },
    { type: 'line', x1: 20, y1: -8, x2: 20, y2: 0, stroke: '#9aa3ad', strokeWidth: 2 },
  ],
  symbol: [
    { type: 'rect', x: -8, y: -34, w: 36, h: 18, fill: 'none', strokeWidth: 1.3 },
    { type: 'text', x: 10, y: -23, text: '7805', size: 6 },
    { type: 'line', x1: 0, y1: 0, x2: 0, y2: -16, strokeWidth: 1.3 },
    { type: 'line', x1: 10, y1: 0, x2: 10, y2: -16, strokeWidth: 1.3 },
    { type: 'line', x1: 20, y1: 0, x2: 20, y2: -16, strokeWidth: 1.3 },
  ],
  model: {
    nodes: [],
    elements: [
      { id: 'REG', kind: 'vsource', p: 'OUT', n: 'GND', value: 'min(vout, max(0, v(IN, GND) - dropout))', r: 0.05 },
      { id: 'PASS', kind: 'isource', p: 'GND', n: 'IN', value: 'max(0, -i(REG))' },
      { id: 'IQ', kind: 'resistor', a: 'IN', b: 'GND', value: 1000 },
    ],
  },
  warnings: [
    { when: 'v(IN, GND) > 1 && v(IN, GND) < vout + dropout', level: 'warn', message: 'Input is too low to regulate — the output sags. Feed it at least 7 V.' },
    { when: 'v(IN, GND) > 35', level: 'error', message: 'Input above the 35 V absolute maximum.' },
    { when: '-i(REG) > 1.5', level: 'error', message: 'Output current above 1.5 A: the regulator would go into thermal shutdown.' },
    { when: '(v(IN, GND) - v(OUT, GND)) * -i(REG) > 2', level: 'warn', message: 'Dissipating over 2 W — it needs a heat sink.' },
  ],
};

export const SYSTEM_PROMPT = `You design electronic parts for a browser circuit simulator (Tinkercad-style). The user describes a part; you answer with ONE JSON object describing it. No prose, no markdown fences — only JSON.

COORDINATES: 1 unit = 1/100 inch; the breadboard hole pitch is 10. Pins MUST sit on multiples of 10 and at distinct positions. For breadboard parts put the pins in a row at y = 0 with 10 spacing (x = 0, 10, 20 …) and draw the body above them (negative y); use "kind": "lead". Big modules may use "terminal" pins (wires only). Keep the drawing within about ±200 units.

JSON FIELDS
- name, description (1–3 sentences incl. pinout), category: one of passive | diodes | transistors | switches | power | output | instruments | drivers | ics | logic | memory | sensors | displays | comms
- pins: [{ id (1–10 chars, letters/digits/_+-), x, y, label, kind: "lead" | "terminal" }]
- props (optional, ≤ 8 editable settings): [{ key (identifier), label, type: "number" | "slider" | "select", default, unit?, min?, max?, step?, options?: [{value,label}] }]. Sliders are adjustable live while simulating (great for sensor inputs like light or temperature).
- shapes: the realistic top-down drawing — make it look like the real part (PCB colour, chips, connectors, markings). Shape types:
  rect {x,y,w,h,rx?}  circle {cx,cy,r}  ellipse {cx,cy,rx,ry}  line {x1,y1,x2,y2}  polyline {points:[x1,y1,x2,y2,…]}  path {d}  text {x,y,text,size,anchor?,weight?,font?: "mono"}
  common style keys: fill, stroke, strokeWidth, opacity, dash. Colours as #hex. Draw metal legs as grey lines from the body to each pin.
  realism keys: grad (second colour: the fill fades from fill to grad), gradDir ("v" default, "h", "d" diagonal, "r" radial dome), shadow (0–1 drop shadow), rotate (degrees), z (draw order).
  e.g. a PCB {type:"rect",…,fill:"#1d5bb8",grad:"#153f80",shadow:1}, a metal can {…,fill:"#eef1f4",grad:"#7f8891",gradDir:"d"}, a lit dome {type:"circle",…,gradDir:"r"}.
- symbol (optional): schematic drawing in the same coordinates, lines ending on the pins.
- model: the electrical behaviour, built from these elements (terminals are pin ids or internal node names listed in model.nodes):
  resistor {id,a,b,value}   capacitor {id,a,b,value (farads)}   rvar {id,a,b,value = resistance formula}
  diode {id,a,k,model: silicon|schottky|power|led|zener, vf? (led), vz? (zener)}
  npn / pnp {id,c,b,e,beta?}
  vsource {id,p,n,value = voltage formula (p minus n),r = series ohms}
  isource {id,p,n,value = current formula; pushes that current out of p into the circuit and back into n}
  nmos / pmos {id,d,g,s,vth?,k?}   opamp {id,p,n,out,vcc,vee,gain?,railToRail?}   comparator {id,p,n,out,vee} (open collector)
  inductor {id,a,b,value (henries)}   transformer {id,p1,p2,s1,s2,l1,ratio,k?}
- indicators (optional): [{ shape, color, level: formula 0..1 }] — glows (LEDs, lamps, status lights).
- readouts (optional): [{ label?, value: formula, unit?, x, y, size? }] — numbers shown on the part while simulating.
- warnings (optional): [{ when: formula, level: "warn"|"error", message }] — shown when the formula is non-zero (abuse, wrong polarity, overload).
- interactive (optional): "press" if the user holds the part (buttons); then the name pressed (0/1) is usable in formulas.
- toggle (optional): a 0/1 prop flipped by clicking the part while simulating; drag (optional): a slider prop changed by dragging it.
- states (optional): [{ name, init, next: formula }] — memory updated after every time step, in order (latches, counters, timers, motor speed). Their names are usable in formulas.
- animations (optional): [{ shape, rotate?: degrees formula, cx?, cy?, dx?: formula, dy?: formula }] — moving parts (shafts, needles, plungers).
- sound (optional): formula giving a tone frequency in Hz (0 = silent).

FORMULAS: + - * / ^ %, comparisons, && || !, c ? a : b, functions min max abs clamp exp log sqrt pow sin cos floor ceil sign round atan2 tanh mod bit band bor bxor shl shr hi,
dt = time step (s), edges(PIN) = rising edges seen on a pin so far (clock inputs), freq(PIN) = frequency of a tone/PWM reaching a pin, servo(PIN) = servo pulse width in µs,
v(A) or v(A,B) = voltage at pin/node A (relative to B), i(X) = current through element X from its first terminal (a/p/c) to its second,
t = time in seconds, and the prop keys. Behaviour elements are re-evaluated continuously, so regulators, sensors, comparators, relays and logic can be modelled with vsource/isource/rvar formulas. Keep models small (≤ 15 elements) and physically sensible; add a small resistor in series or to ground where a node could float. Real datasheet numbers please.

EXAMPLE (for "7805 voltage regulator"):
${JSON.stringify(EXAMPLE_7805)}`;

export interface GenerateOptions {
  request: string;
  previous?: CustomPartSpec;
  signal?: AbortSignal;
  onStatus?: (s: string) => void;
}

/** Ask the model for a part, validating and letting it repair its own mistakes (up to 2 rounds). */
export async function generatePart(settings: AiSettings, opts: GenerateOptions): Promise<CustomPartSpec> {
  const ask = opts.previous
    ? `Here is the current part:\n${JSON.stringify(stripMeta(opts.previous))}\n\nChange it as follows: ${opts.request}\nReturn the complete updated JSON object.`
    : `Design this part: ${opts.request}`;
  const messages: ChatMessage[] = [{ role: 'user', content: ask }];
  let lastProblems: string[] = [];
  for (let round = 0; round < 3; round++) {
    opts.onStatus?.(round === 0 ? 'Designing the part…' : `Fixing ${lastProblems.length} problem${lastProblems.length === 1 ? '' : 's'}…`);
    const reply = await complete(settings, SYSTEM_PROMPT, messages, opts.signal);
    try {
      const spec = validateSpec(extractJson(reply));
      spec.prompt = opts.previous?.prompt ? `${opts.previous.prompt}; ${opts.request}` : opts.request;
      return spec;
    } catch (e) {
      if (!(e instanceof SpecError)) throw e;
      lastProblems = e.problems;
      messages.push({ role: 'assistant', content: reply.slice(0, 20000) });
      messages.push({ role: 'user', content: `That JSON can't be used yet:\n- ${e.problems.slice(0, 20).join('\n- ')}\nReply with the corrected, complete JSON object only.` });
    }
  }
  throw new SpecError(lastProblems);
}

function stripMeta(spec: CustomPartSpec) {
  const { type: _t, version: _v, prompt: _p, ...rest } = spec;
  void _t;
  void _v;
  void _p;
  return rest;
}
