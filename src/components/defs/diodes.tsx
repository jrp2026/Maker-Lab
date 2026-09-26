import type { ComponentDef } from '../types';
import { Avg, type SimBuilder, type SimWarning } from '../../sim/builder';
import type { Diode } from '../../sim/solver';
import { LED_COLORS, Lead, Label, PinTip, SLine, SText, clamp01, formatSI, ledParams } from '../util';

const DIODE_MODELS: Record<string, { is: number; n: number; imax: number; bv: number; label: string }> = {
  '1N4148': { is: 2.52e-9, n: 1.752, imax: 0.3, bv: 100, label: '1N4148 signal' },
  '1N4001': { is: 14.1e-9, n: 1.984, imax: 1, bv: 50, label: '1N4001 rectifier' },
};

export const diode: ComponentDef = {
  type: 'diode',
  name: 'Diode',
  category: 'diodes',
  description: 'Silicon diode. Current flows from anode to the banded cathode.',
  keywords: ['rectifier', '1n4148', '1n4001'],
  bounds: { x: -2, y: -6, w: 44, h: 12 },
  pins: () => [
    { id: 'A', x: 0, y: 0, kind: 'lead', label: 'Anode (+)' },
    { id: 'K', x: 40, y: 0, kind: 'lead', label: 'Cathode (−)' },
  ],
  defaultProps: { model: '1N4148' },
  fields: [{ key: 'model', label: 'Model', kind: 'select', options: Object.entries(DIODE_MODELS).map(([k, v]) => ({ value: k, label: v.label })) }],
  summary: (p) => String(p.model),
  render: ({ props }) => {
    const glass = props.model === '1N4148';
    return (
      <g>
        <Lead x1={0} y1={0} x2={40} y2={0} />
        {glass ? (
          <>
            <rect x={12} y={-3.6} width={16} height={7.2} rx={3} fill="#e98a4a" opacity={0.85} stroke="#b25d25" strokeWidth={0.5} />
            <rect x={23} y={-3.6} width={2.4} height={7.2} fill="#1d1d1d" />
          </>
        ) : (
          <>
            <rect x={10} y={-4.4} width={20} height={8.8} rx={2} fill="#222" />
            <rect x={25} y={-4.4} width={2.8} height={8.8} fill="#cfd4da" />
          </>
        )}
        <PinTip x={0} y={0} />
        <PinTip x={40} y={0} />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[0, 0], [15, 0]]} />
      <polygon points="15,-6 15,6 25,0" fill="#1f3a5f" />
      <SLine pts={[[25, -6], [25, 6]]} />
      <SLine pts={[[25, 0], [40, 0]]} />
      <SText x={20} y={-9}>{String(props.model)}</SText>
    </g>
  ),
  build: (b, comp) => {
    const m = DIODE_MODELS[String(comp.props.model)] ?? DIODE_MODELS['1N4148'];
    const d = b.diode('A', 'K', { is: m.is, n: m.n, bv: m.bv });
    const i = new Avg();
    let warn: SimWarning[] = [];
    return {
      afterStep(v, h) {
        i.add(d.currents(v)[0], h);
      },
      frame() {
        const cur = i.take();
        warn = cur > m.imax ? [{ level: 'error', message: `Forward current ${formatSI(cur, 'A')} exceeds the ${formatSI(m.imax, 'A')} maximum.` }] : [];
        return { current: cur };
      },
      warnings: () => warn,
    };
  },
};

// ------------------------------------------------------------------ LED

interface LedChannel {
  d: Diode;
  avg: Avg;
  overTime: number;
  reverse: number;
}

function ledChannel(b: SimBuilder, a: string, k: string, vf: number): LedChannel {
  return { d: b.diode(a, k, ledParams(vf)), avg: new Avg(), overTime: 0, reverse: 0 };
}

const BURN_CURRENT = 0.09;

function stepChannel(ch: LedChannel, v: Float64Array, h: number, burnt: boolean) {
  const [cur] = ch.d.currents(v);
  ch.avg.add(burnt ? 0 : cur, h);
  if (cur > BURN_CURRENT) ch.overTime += h;
  const vd = -(ch.d.vd);
  if (vd > ch.reverse) ch.reverse = vd;
}

function killChannel(ch: LedChannel) {
  ch.d.p = { is: 1e-30, n: 2 };
}

export const led: ComponentDef = {
  type: 'led',
  name: 'LED',
  category: 'diodes',
  description: '5 mm light-emitting diode. The longer, bent leg is the anode (+). Needs a series resistor!',
  keywords: ['light', 'diode', 'lamp', 'indicator'],
  bounds: { x: -6, y: -32, w: 22, h: 34 },
  pins: () => [
    { id: 'A', x: 0, y: 0, kind: 'lead', label: 'Anode (+, bent leg)' },
    { id: 'K', x: 10, y: 0, kind: 'lead', label: 'Cathode (−)' },
  ],
  defaultProps: { color: 'red' },
  fields: [{ key: 'color', label: 'Color', kind: 'select', options: Object.entries(LED_COLORS).map(([k, v]) => ({ value: k, label: v.label })) }],
  summary: (p) => `${LED_COLORS[String(p.color)]?.label ?? ''} LED`,
  render: ({ props, sim }) => {
    const c = LED_COLORS[String(props.color)] ?? LED_COLORS.red;
    const br = sim?.brightness ?? 0;
    const burnt = !!sim?.burnt;
    return (
      <g>
        <Lead x1={10} y1={-10} x2={10} y2={0} />
        <path d="M0 -10 L0 -7 L-2.5 -4.5 L0 -2 L0 0" stroke="#6d7680" strokeWidth={2.4} fill="none" strokeLinejoin="round" />
        <path d="M0 -10 L0 -7 L-2.5 -4.5 L0 -2 L0 0" stroke="#9aa3ad" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        {br > 0.01 && <circle cx={5} cy={-20} r={10 + 16 * br} fill={`url(#glow-${props.color})`} opacity={Math.min(1, 0.35 + br)} style={{ pointerEvents: 'none' }} />}
        <rect x={-4.5} y={-13} width={19} height={3.5} rx={1} fill={c.fill} stroke="rgba(0,0,0,.25)" strokeWidth={0.5} />
        <path d="M-3 -12 L-3 -22 A8 8 0 0 1 13 -22 L13 -12 Z" fill={burnt ? '#5a5552' : c.fill} stroke="rgba(0,0,0,.28)" strokeWidth={0.6} opacity={0.93} />
        <path d="M-1 -14 L-1 -22 A6 6 0 0 1 4 -27.6" fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.45} strokeLinecap="round" />
        {br > 0.01 && <path d="M-3 -12 L-3 -22 A8 8 0 0 1 13 -22 L13 -12 Z" fill={c.glow} opacity={br * 0.9} style={{ pointerEvents: 'none' }} />}
        {burnt && (
          <g style={{ pointerEvents: 'none' }}>
            <path d="M5 -38 l3 6 6 -3 -3 6 6 3 -7 1 1 7 -5 -5 -5 5 1 -7 -7 -1 6 -3 -3 -6 6 3z" fill="#ffcc33" stroke="#e05a00" strokeWidth={0.8} transform="translate(0 6) scale(0.9)" />
          </g>
        )}
        <PinTip x={0} y={0} />
        <PinTip x={10} y={0} />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[0, 0], [0, -28], [5, -28], [5, -22]]} />
      <polygon points="0,-22 10,-22 5,-14" fill="#1f3a5f" />
      <SLine pts={[[0, -14], [10, -14]]} />
      <SLine pts={[[5, -14], [5, -8], [10, -8], [10, 0]]} />
      <SLine pts={[[12, -19], [18, -24]]} w={1} />
      <SLine pts={[[16, -24], [18, -24], [18, -22]]} w={1} />
      <SLine pts={[[12, -14], [18, -19]]} w={1} />
      <SLine pts={[[16, -19], [18, -19], [18, -17]]} w={1} />
      <SText x={-3} y={-17} anchor="end" size={5}>{String(props.color)}</SText>
    </g>
  ),
  build: (b, comp) => {
    const c = LED_COLORS[String(comp.props.color)] ?? LED_COLORS.red;
    const ch = ledChannel(b, 'A', 'K', c.vf);
    if (b.state.burnt) killChannel(ch);
    let warn: SimWarning[] = [];
    return {
      afterStep(v, h) {
        stepChannel(ch, v, h, !!b.state.burnt);
        if (!b.state.burnt && ch.overTime > 0.02) {
          b.state.burnt = true;
          killChannel(ch);
        }
      },
      frame() {
        const cur = ch.avg.take();
        warn = [];
        if (b.state.burnt) warn.push({ level: 'error', message: 'Burned out! Too much current flowed. Add a series resistor (≈220 Ω for 5 V), then restart the simulation.' });
        else if (cur > 0.03) warn.push({ level: 'warn', message: `Current ${formatSI(cur, 'A')} exceeds the 20 mA rating — use a larger series resistor.` });
        if (ch.reverse > 5) warn.push({ level: 'warn', message: `Reverse voltage ${ch.reverse.toFixed(1)} V exceeds the 5 V maximum. Check the LED polarity.` });
        ch.reverse = 0;
        return { current: cur, brightness: b.state.burnt ? 0 : ledBrightness(cur), burnt: !!b.state.burnt };
      },
      warnings: () => warn,
    };
  },
};

function ledBrightness(i: number) {
  if (i < 5e-5) return 0;
  return clamp01(Math.sqrt(i / 0.02));
}

// ------------------------------------------------------------------ RGB LED

export const rgbLed: ComponentDef = {
  type: 'rgb-led',
  name: 'RGB LED',
  category: 'diodes',
  description: 'Four-leg RGB LED. The longest leg is the common cathode (or anode).',
  keywords: ['color', 'colour', 'multicolor', 'light'],
  bounds: { x: -6, y: -34, w: 42, h: 36 },
  pins: (p) => [
    { id: 'R', x: 0, y: 0, kind: 'lead', label: 'Red' },
    { id: 'COM', x: 10, y: 0, kind: 'lead', label: p.common === 'anode' ? 'Common anode (+)' : 'Common cathode (−)' },
    { id: 'G', x: 20, y: 0, kind: 'lead', label: 'Green' },
    { id: 'B', x: 30, y: 0, kind: 'lead', label: 'Blue' },
  ],
  defaultProps: { common: 'cathode' },
  fields: [{ key: 'common', label: 'Common pin', kind: 'select', options: [{ value: 'cathode', label: 'Common cathode' }, { value: 'anode', label: 'Common anode' }] }],
  summary: (p) => `Common ${p.common}`,
  render: ({ sim }) => {
    const r = sim?.r ?? 0, g = sim?.g ?? 0, bl = sim?.b ?? 0;
    const lit = Math.max(r, g, bl);
    const mix = `rgb(${Math.round(255 * Math.min(1, r * 1.2))},${Math.round(255 * Math.min(1, g * 1.2))},${Math.round(255 * Math.min(1, bl * 1.2))})`;
    return (
      <g>
        {[0, 10, 20, 30].map((x) => <Lead key={x} x1={x} y1={-12} x2={x} y2={0} />)}
        {lit > 0.01 && <circle cx={15} cy={-22} r={12 + 16 * lit} fill={mix} opacity={0.35 * lit + 0.1} style={{ filter: 'blur(4px)', pointerEvents: 'none' }} />}
        <rect x={0} y={-15} width={30} height={4} rx={1} fill="#e8edf0" stroke="rgba(0,0,0,.2)" strokeWidth={0.5} />
        <path d="M4 -13 L4 -24 A11 11 0 0 1 26 -24 L26 -13 Z" fill="#f1f4f6" stroke="rgba(0,0,0,.2)" strokeWidth={0.6} opacity={0.95} />
        {lit > 0.01 && <path d="M4 -13 L4 -24 A11 11 0 0 1 26 -24 L26 -13 Z" fill={mix} opacity={Math.min(1, lit * 1.1)} style={{ pointerEvents: 'none' }} />}
        <path d="M7 -15 L7 -24 A8 8 0 0 1 13 -31" fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.6} strokeLinecap="round" />
        <Label x={0} y={6} size={3.6} fill="#c0392b">R</Label>
        <Label x={20} y={6} size={3.6} fill="#2e8b57">G</Label>
        <Label x={30} y={6} size={3.6} fill="#2e6fb7">B</Label>
        {[0, 10, 20, 30].map((x) => <PinTip key={x} x={x} y={0} />)}
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      {[0, 20, 30].map((x) => <SLine key={x} pts={[[x, 0], [x, -10]]} />)}
      <SLine pts={[[10, 0], [10, -4], [34, -4]]} />
      {[0, 20, 30].map((x) => (
        <g key={x} transform={`translate(${x} -16)`}>
          {props.common === 'anode' ? <polygon points="-4,0 4,0 0,-6" fill="#1f3a5f" /> : <polygon points="-4,-6 4,-6 0,0" fill="#1f3a5f" />}
          <SLine pts={[[-4, props.common === 'anode' ? -6 : 0], [4, props.common === 'anode' ? -6 : 0]]} />
          <SLine pts={[[0, 0], [0, 6]]} />
        </g>
      ))}
      <SLine pts={[[0, -22], [0, -26], [34, -26], [34, -4]]} />
      <SText x={15} y={-30}>RGB</SText>
    </g>
  ),
  build: (b, comp) => {
    const anode = comp.props.common === 'anode';
    const mk = (pin: string, vf: number) => (anode ? ledChannel(b, 'COM', pin, vf) : ledChannel(b, pin, 'COM', vf));
    const chs = { r: mk('R', 1.9), g: mk('G', 2.9), b: mk('B', 3.0) };
    if (b.state.burnt) Object.values(chs).forEach(killChannel);
    let warn: SimWarning[] = [];
    return {
      afterStep(v, h) {
        for (const ch of Object.values(chs)) stepChannel(ch, v, h, !!b.state.burnt);
        if (!b.state.burnt && Object.values(chs).some((c) => c.overTime > 0.02)) {
          b.state.burnt = true;
          Object.values(chs).forEach(killChannel);
        }
      },
      frame() {
        const r = chs.r.avg.take(), g = chs.g.avg.take(), bl = chs.b.avg.take();
        warn = [];
        if (b.state.burnt) warn.push({ level: 'error', message: 'Burned out! Each colour needs its own series resistor.' });
        else if (Math.max(r, g, bl) > 0.03) warn.push({ level: 'warn', message: 'A channel exceeds 20 mA — use larger series resistors.' });
        return { r: ledBrightness(r), g: ledBrightness(g), b: ledBrightness(bl), burnt: !!b.state.burnt };
      },
      warnings: () => warn,
    };
  },
};
