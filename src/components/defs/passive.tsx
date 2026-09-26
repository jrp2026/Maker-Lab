import type { ComponentDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import { Label, Lead, PinTip, SLine, SText, clamp01, formatSI, resistorBands, zigzag } from '../util';

// ------------------------------------------------------------------ Resistor

export const resistor: ComponentDef = {
  type: 'resistor',
  name: 'Resistor',
  category: 'passive',
  description: 'Fixed carbon-film resistor. Colour bands update with the value.',
  keywords: ['ohm', 'r'],
  bounds: { x: -2, y: -6, w: 44, h: 12 },
  pins: () => [
    { id: '1', x: 0, y: 0, kind: 'lead', label: 'Terminal 1' },
    { id: '2', x: 40, y: 0, kind: 'lead', label: 'Terminal 2' },
  ],
  defaultProps: { resistance: 220, power: 0.25 },
  fields: [
    { key: 'resistance', label: 'Resistance', kind: 'number', unit: 'Ω', si: true, min: 0.01, live: true },
    { key: 'power', label: 'Power rating', kind: 'select', options: [{ value: 0.125, label: '1/8 W' }, { value: 0.25, label: '1/4 W' }, { value: 0.5, label: '1/2 W' }, { value: 1, label: '1 W' }] },
  ],
  summary: (p) => formatSI(Number(p.resistance), 'Ω'),
  render: ({ props, sim }) => {
    const bands = resistorBands(Number(props.resistance));
    const heat = sim ? clamp01((sim.power ?? 0) / Number(props.power) - 0.5) : 0;
    return (
      <g>
        <Lead x1={0} y1={0} x2={40} y2={0} />
        <rect x={8} y={-4.2} width={24} height={8.4} rx={4} fill="#e4cfa4" stroke="#b79a64" strokeWidth={0.6} />
        {bands.map((c, i) => (
          <rect key={i} x={i === 3 ? 26.5 : 11.5 + i * 3.6} y={-4.1} width={2.2} height={8.2} fill={c} />
        ))}
        <rect x={9} y={-3.6} width={22} height={2.2} rx={1.1} fill="#fff" opacity={0.35} />
        {heat > 0 && <rect x={8} y={-4.2} width={24} height={8.4} rx={4} fill="#ff4a1a" opacity={heat * 0.7} />}
        <PinTip x={0} y={0} />
        <PinTip x={40} y={0} />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={zigzag(0, 40, 0)} />
      <SText x={20} y={-7}>{formatSI(Number(props.resistance), 'Ω')}</SText>
    </g>
  ),
  build: (b, comp) => {
    const r = b.resistor('1', '2', Math.max(0.01, Number(comp.props.resistance)));
    const p = new Avg();
    const i = new Avg();
    let warn: SimWarning[] = [];
    return {
      afterStep(v, h) {
        const cur = r.currents(v)[0];
        i.add(cur, h);
        p.add(cur * cur * r.r, h);
      },
      frame() {
        const power = p.take();
        const rating = Number(comp.props.power) || 0.25;
        warn = [];
        if (power > rating * 3) warn.push({ level: 'error', message: `Burning up: dissipating ${formatSI(power, 'W')} (rated ${rating} W). Use a larger resistance.` });
        else if (power > rating) warn.push({ level: 'warn', message: `Dissipating ${formatSI(power, 'W')}, above its ${rating} W rating.` });
        return { current: i.take(), power };
      },
      warnings: () => warn,
    };
  },
};

// ------------------------------------------------------------------ Potentiometer

export const potentiometer: ComponentDef = {
  type: 'potentiometer',
  name: 'Potentiometer',
  category: 'passive',
  description: 'Rotary potentiometer. Drag the knob up/down during simulation (or use the slider) to turn it.',
  keywords: ['pot', 'variable resistor', 'knob', 'trimmer'],
  bounds: { x: -6, y: -40, w: 32, h: 44 },
  pins: () => [
    { id: '1', x: 0, y: 0, kind: 'lead', label: 'Terminal 1' },
    { id: 'W', x: 10, y: 0, kind: 'lead', label: 'Wiper' },
    { id: '2', x: 20, y: 0, kind: 'lead', label: 'Terminal 2' },
  ],
  defaultProps: { resistance: 10000, position: 0.5 },
  fields: [
    { key: 'resistance', label: 'Resistance', kind: 'number', unit: 'Ω', si: true, min: 1, live: true },
    { key: 'position', label: 'Position', kind: 'slider', min: 0, max: 1, step: 0.01, live: true },
  ],
  interactive: 'drag',
  summary: (p) => formatSI(Number(p.resistance), 'Ω'),
  render: ({ props }) => {
    const pos = Number(props.position);
    const ang = -135 + pos * 270;
    return (
      <g>
        {[0, 10, 20].map((x) => <Lead key={x} x1={x} y1={-8} x2={x} y2={0} />)}
        <rect x={-5} y={-38} width={30} height={31} rx={3} fill="#2e6fb7" stroke="#1f4f87" strokeWidth={0.8} />
        <circle cx={10} cy={-22} r={11} fill="#dfe3e8" stroke="#9aa3ad" strokeWidth={0.8} />
        <g transform={`rotate(${ang} 10 -22)`}>
          <circle cx={10} cy={-22} r={8} fill="#f4f6f8" stroke="#b6bec7" strokeWidth={0.6} />
          <rect x={9} y={-30} width={2} height={7} rx={1} fill="#39424c" />
        </g>
        {[0, 10, 20].map((x) => <PinTip key={x} x={x} y={0} />)}
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[0, 0], [0, -20], [3, -20]]} />
      <SLine pts={zigzag(3, 17, -20, 3, 5)} />
      <SLine pts={[[17, -20], [20, -20], [20, 0]]} />
      <SLine pts={[[10, 0], [10, -14]]} />
      <SLine pts={[[7, -16], [10, -14], [13, -16]]} />
      <SText x={10} y={-27}>{formatSI(Number(props.resistance), 'Ω')}</SText>
    </g>
  ),
  build: (b, comp) => {
    const R = Math.max(1, Number(comp.props.resistance));
    const pos = clamp01(Number(comp.props.position));
    b.resistor('1', 'W', Math.max(0.5, R * pos));
    b.resistor('W', '2', Math.max(0.5, R * (1 - pos)));
    return {};
  },
};

// ------------------------------------------------------------------ Photoresistor

export const photoresistor: ComponentDef = {
  type: 'photoresistor',
  name: 'Photoresistor (LDR)',
  category: 'passive',
  description: 'Light-dependent resistor: ~1 MΩ in the dark, ~1 kΩ in bright light. Adjust the light level while simulating.',
  keywords: ['ldr', 'light sensor', 'photocell', 'cds'],
  bounds: { x: -8, y: -30, w: 26, h: 32 },
  pins: () => [
    { id: '1', x: 0, y: 0, kind: 'lead', label: 'Terminal 1' },
    { id: '2', x: 10, y: 0, kind: 'lead', label: 'Terminal 2' },
  ],
  defaultProps: { light: 0.5 },
  fields: [{ key: 'light', label: 'Light level', kind: 'slider', min: 0, max: 1, step: 0.01, live: true }],
  interactive: 'drag',
  summary: (p) => `Light ${Math.round(Number(p.light) * 100)}%`,
  render: ({ props }) => {
    const light = clamp01(Number(props.light));
    return (
      <g>
        <Lead x1={0} y1={-10} x2={0} y2={0} />
        <Lead x1={10} y1={-10} x2={10} y2={0} />
        <circle cx={5} cy={-17} r={10} fill="#f2e6c9" stroke="#b39d68" strokeWidth={0.8} />
        <path d="M-1 -21 h9 v3 h-9 v3 h9 v3 h-9" fill="none" stroke="#c0552d" strokeWidth={1.3} transform="translate(1.5 0)" />
        <circle cx={5} cy={-17} r={10} fill="#fff8b0" opacity={light * 0.45} />
        {light > 0.05 && [0, 1, 2].map((i) => (
          <line key={i} x1={16 + i * 0} y1={-27 + i * 4} x2={13} y2={-24 + i * 4} stroke="#f2b01e" strokeWidth={1} opacity={light} strokeLinecap="round" />
        ))}
        <PinTip x={0} y={0} />
        <PinTip x={10} y={0} />
      </g>
    );
  },
  schematic: () => (
    <g>
      <SLine pts={[[0, 0], [0, -8]]} />
      <SLine pts={[[10, 0], [10, -8]]} />
      <rect x={-3} y={-24} width={16} height={16} rx={8} fill="none" stroke="#1f3a5f" strokeWidth={1.2} />
      <SLine pts={zigzag(0, 10, -16, 2.5, 4)} w={1} />
      <SLine pts={[[18, -30], [13, -24]]} w={1} />
      <SLine pts={[[22, -26], [17, -20]]} w={1} />
    </g>
  ),
  build: (b, comp) => {
    const light = clamp01(Number(comp.props.light));
    b.resistor('1', '2', Math.pow(10, 6 - 3 * light));
    return {};
  },
};

// ------------------------------------------------------------------ Capacitors

function capBuild(polarized: boolean): ComponentDef['build'] {
  return (b, comp) => {
    const c = b.capacitor(polarized ? '+' : '1', polarized ? '-' : '2', Math.max(1e-12, Number(comp.props.capacitance)));
    const vAvg = new Avg();
    let warn: SimWarning[] = [];
    let minV = 0;
    return {
      afterStep(_v, h) {
        b.state.cap = c.vPrev;
        vAvg.add(c.vPrev, h);
        if (c.vPrev < minV) minV = c.vPrev;
      },
      frame() {
        const v = vAvg.take();
        warn = [];
        const rating = Number(comp.props.voltage) || 16;
        if (polarized && minV < -1) warn.push({ level: 'error', message: `Reversed polarity: ${(-minV).toFixed(1)} V across it the wrong way. The stripe (−) leg must go to the lower voltage.` });
        if (Math.abs(v) > rating) warn.push({ level: 'warn', message: `${Math.abs(v).toFixed(1)} V exceeds the ${rating} V rating.` });
        minV = 0;
        return { volts: v, charge: v * c.c };
      },
      warnings: () => warn,
    };
  };
}

export const ceramicCapacitor: ComponentDef = {
  type: 'capacitor',
  name: 'Ceramic capacitor',
  category: 'passive',
  description: 'Non-polarised ceramic capacitor.',
  keywords: ['cap', 'c', 'decoupling'],
  bounds: { x: -6, y: -22, w: 22, h: 24 },
  pins: () => [
    { id: '1', x: 0, y: 0, kind: 'lead', label: 'Terminal 1' },
    { id: '2', x: 10, y: 0, kind: 'lead', label: 'Terminal 2' },
  ],
  defaultProps: { capacitance: 100e-9, voltage: 50 },
  fields: [{ key: 'capacitance', label: 'Capacitance', kind: 'number', unit: 'F', si: true, min: 1e-12, live: true }],
  summary: (p) => formatSI(Number(p.capacitance), 'F'),
  render: ({ props }) => (
    <g>
      <Lead x1={0} y1={-8} x2={0} y2={0} />
      <Lead x1={10} y1={-8} x2={10} y2={0} />
      <ellipse cx={5} cy={-14} rx={9} ry={7.5} fill="#f2a23a" stroke="#c47a17" strokeWidth={0.8} />
      <ellipse cx={3} cy={-17} rx={4} ry={2} fill="#fff" opacity={0.3} />
      <Label x={5} y={-12} size={4.2} fill="#5b3509">{capCode(Number(props.capacitance))}</Label>
      <PinTip x={0} y={0} />
      <PinTip x={10} y={0} />
    </g>
  ),
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[0, 0], [0, -6], [3, -6], [3, -18]]} />
      <SLine pts={[[10, 0], [10, -6], [7, -6], [7, -18]]} />
      <SText x={5} y={-22}>{formatSI(Number(props.capacitance), 'F')}</SText>
    </g>
  ),
  build: capBuild(false),
};

function capCode(c: number): string {
  const pf = c / 1e-12;
  if (pf < 100) return String(Math.round(pf));
  const exp = Math.floor(Math.log10(pf)) - 1;
  return `${Math.round(pf / Math.pow(10, exp))}${exp}`;
}

export const electrolyticCapacitor: ComponentDef = {
  type: 'electrolytic',
  name: 'Electrolytic capacitor',
  category: 'passive',
  description: 'Polarised aluminium electrolytic capacitor. The striped leg is negative.',
  keywords: ['cap', 'polarized', 'polarised', 'c'],
  bounds: { x: -6, y: -30, w: 22, h: 32 },
  pins: () => [
    { id: '+', x: 0, y: 0, kind: 'lead', label: 'Positive (+)' },
    { id: '-', x: 10, y: 0, kind: 'lead', label: 'Negative (−)' },
  ],
  defaultProps: { capacitance: 100e-6, voltage: 16 },
  fields: [
    { key: 'capacitance', label: 'Capacitance', kind: 'number', unit: 'F', si: true, min: 1e-9, live: true },
    { key: 'voltage', label: 'Voltage rating', kind: 'number', unit: 'V', min: 1 },
  ],
  summary: (p) => `${formatSI(Number(p.capacitance), 'F')} ${p.voltage} V`,
  render: ({ sim }) => {
    const charge = sim ? clamp01(Math.abs(sim.volts ?? 0) / 10) : 0;
    return (
      <g>
        <Lead x1={0} y1={-8} x2={0} y2={0} />
        <Lead x1={10} y1={-8} x2={10} y2={0} />
        <rect x={-4} y={-29} width={18} height={22} rx={3} fill="#2b3f8f" stroke="#1b2a66" strokeWidth={0.8} />
        <rect x={8} y={-29} width={6} height={22} rx={2} fill="#c9d3ee" />
        <Label x={11} y={-20} size={5} fill="#2b3f8f">−</Label>
        <Label x={11} y={-12} size={5} fill="#2b3f8f">−</Label>
        <rect x={-3} y={-28} width={3} height={20} rx={1.5} fill="#fff" opacity={0.15} />
        {charge > 0.02 && <rect x={-4} y={-29} width={18} height={22} rx={3} fill="#7ee0ff" opacity={charge * 0.35} />}
        <PinTip x={0} y={0} />
        <PinTip x={10} y={0} />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[0, 0], [0, -6], [3, -6], [3, -18]]} />
      <path d="M8 -18 Q6 -12 8 -6" fill="none" stroke="#1f3a5f" strokeWidth={1.4} />
      <SLine pts={[[10, 0], [10, -6], [7, -6]]} />
      <SText x={-3} y={-12} size={6}>+</SText>
      <SText x={5} y={-22}>{formatSI(Number(props.capacitance), 'F')}</SText>
    </g>
  ),
  build: capBuild(true),
};
