import type { ComponentDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import { Label, Lead, PinTip, SLine, SText, formatSI } from '../util';

// ------------------------------------------------------------------ BJT

const BJT_MODELS: Record<string, { pnp: boolean; is: number; bf: number; br: number; icmax: number }> = {
  '2N2222': { pnp: false, is: 1e-14, bf: 200, br: 3, icmax: 0.8 },
  BC547: { pnp: false, is: 7e-15, bf: 300, br: 5, icmax: 0.1 },
  '2N3906': { pnp: true, is: 1.4e-14, bf: 180, br: 4, icmax: 0.2 },
  BC557: { pnp: true, is: 7e-15, bf: 250, br: 5, icmax: 0.1 },
};

function bjtDef(type: string, name: string, pnp: boolean, models: string[]): ComponentDef {
  return {
    type,
    name,
    category: 'transistors',
    description: `${pnp ? 'PNP' : 'NPN'} bipolar junction transistor in a TO-92 package. Pins left→right: Emitter, Base, Collector (flat face towards you).`,
    keywords: ['bjt', 'transistor', pnp ? 'pnp' : 'npn', ...models.map((m) => m.toLowerCase())],
    bounds: { x: -6, y: -26, w: 32, h: 28 },
    pins: () => [
      { id: 'E', x: 0, y: 0, kind: 'lead', label: 'Emitter' },
      { id: 'B', x: 10, y: 0, kind: 'lead', label: 'Base' },
      { id: 'C', x: 20, y: 0, kind: 'lead', label: 'Collector' },
    ],
    defaultProps: { model: models[0] },
    fields: [{ key: 'model', label: 'Model', kind: 'select', options: models.map((m) => ({ value: m, label: m })) }],
    summary: (p) => String(p.model),
    render: ({ props, sim }) => {
      const on = (sim?.ic ?? 0) > 1e-4;
      return (
        <g>
          {[0, 10, 20].map((x) => <Lead key={x} x1={x} y1={-8} x2={x} y2={0} />)}
          <path d="M-4 -9 L24 -9 L24 -18 A14 11 0 0 0 -4 -18 Z" fill="#2a2a2e" stroke="#111" strokeWidth={0.6} />
          <rect x={-4} y={-11} width={28} height={2} fill="#3b3b40" />
          <Label x={10} y={-15} size={3.8} fill="#cfd3d8">{String(props.model)}</Label>
          {on && <circle cx={20} cy={-21} r={1.4} fill="#7cff8a" opacity={0.8} />}
          <Label x={0} y={6} size={3.6} fill="#555">E</Label>
          <Label x={10} y={6} size={3.6} fill="#555">B</Label>
          <Label x={20} y={6} size={3.6} fill="#555">C</Label>
          {[0, 10, 20].map((x) => <PinTip key={x} x={x} y={0} />)}
        </g>
      );
    },
    schematic: ({ props }) => (
      <g>
        <circle cx={10} cy={-20} r={11} fill="none" stroke="#1f3a5f" strokeWidth={1.2} />
        <SLine pts={[[10, 0], [10, -12], [6, -12], [6, -20]]} />
        <SLine pts={[[6, -26], [6, -14]]} w={2} />
        <SLine pts={[[6, -23], [14, -29], [20, -29], [20, 0]]} />
        <SLine pts={[[6, -17], [14, -11], [14, -6], [0, -6], [0, 0]]} />
        {pnp ? <polygon points="7,-18 11,-17 9,-14" fill="#1f3a5f" /> : <polygon points="14,-11 10,-11.5 12,-14.5" fill="#1f3a5f" />}
        <SText x={24} y={-34} anchor="start" size={5}>{String(props.model)}</SText>
      </g>
    ),
    build: (b, comp) => {
      const m = BJT_MODELS[String(comp.props.model)] ?? BJT_MODELS[models[0]];
      const q = b.bjt('C', 'B', 'E', { pnp: m.pnp, is: m.is, bf: m.bf, br: m.br });
      const ic = new Avg();
      let warn: SimWarning[] = [];
      return {
        afterStep(v, h) {
          const [c] = q.currents(v);
          ic.add(pnp ? -c : c, h);
        },
        frame() {
          const i = ic.take();
          warn = Math.abs(i) > m.icmax ? [{ level: 'error', message: `Collector current ${formatSI(Math.abs(i), 'A')} exceeds the ${formatSI(m.icmax, 'A')} maximum.` }] : [];
          return { ic: i };
        },
        warnings: () => warn,
      };
    },
  };
}

export const npn = bjtDef('npn', 'NPN transistor', false, ['2N2222', 'BC547']);
export const pnp = bjtDef('pnp', 'PNP transistor', true, ['2N3906', 'BC557']);

// ------------------------------------------------------------------ Push button

export const pushbutton: ComponentDef = {
  type: 'pushbutton',
  name: 'Push button',
  category: 'switches',
  description: 'Momentary tactile switch. Legs 1a/1b and 2a/2b are always connected; pressing connects side 1 to side 2. Click and hold it during simulation.',
  keywords: ['button', 'tactile', 'momentary', 'switch'],
  bounds: { x: -4, y: -4, w: 28, h: 38 },
  pins: () => [
    { id: '1a', x: 0, y: 0, kind: 'lead', label: 'Terminal 1a' },
    { id: '2a', x: 20, y: 0, kind: 'lead', label: 'Terminal 2a' },
    { id: '1b', x: 0, y: 30, kind: 'lead', label: 'Terminal 1b' },
    { id: '2b', x: 20, y: 30, kind: 'lead', label: 'Terminal 2b' },
  ],
  internalConnections: () => [['1a', '1b'], ['2a', '2b']],
  defaultProps: { cap: '#e74c3c' },
  fields: [{ key: 'cap', label: 'Cap colour', kind: 'select', options: [{ value: '#e74c3c', label: 'Red' }, { value: '#3b82f6', label: 'Blue' }, { value: '#22c55e', label: 'Green' }, { value: '#f5c518', label: 'Yellow' }, { value: '#374151', label: 'Black' }] }],
  interactive: 'press',
  render: ({ props, sim }) => {
    const pressed = !!sim?.pressed;
    return (
      <g>
        <rect x={-3} y={3} width={26} height={24} rx={2} fill="#3a3d42" stroke="#23252a" strokeWidth={0.8} />
        {[[0, 3], [20, 3], [0, 27], [20, 27]].map(([x, y], i) => (
          <rect key={i} x={x - 2.5} y={y - 2.5} width={5} height={5} fill="#a4acb5" />
        ))}
        <circle cx={10} cy={15} r={pressed ? 7 : 8} fill="#1f2125" />
        <circle cx={10} cy={15} r={pressed ? 6 : 7} fill={String(props.cap)} stroke="rgba(0,0,0,.35)" strokeWidth={0.6} />
        {!pressed && <circle cx={8} cy={13} r={2.5} fill="#fff" opacity={0.3} />}
        {[[0, 0], [20, 0], [0, 30], [20, 30]].map(([x, y], i) => <PinTip key={i} x={x} y={y} />)}
      </g>
    );
  },
  schematic: () => (
    <g>
      <SLine pts={[[0, 0], [0, 30]]} />
      <SLine pts={[[20, 0], [20, 30]]} />
      <SLine pts={[[0, 15], [4, 15]]} />
      <SLine pts={[[16, 15], [20, 15]]} />
      <circle cx={4} cy={15} r={1.3} fill="#1f3a5f" />
      <circle cx={16} cy={15} r={1.3} fill="#1f3a5f" />
      <SLine pts={[[3, 10], [17, 10]]} />
      <SLine pts={[[10, 10], [10, 5]]} />
      <SLine pts={[[7, 5], [13, 5]]} />
    </g>
  ),
  build: (b) => {
    const sw = b.resistor('1a', '2a', 1e9);
    return {
      beforeStep() {
        sw.r = b.input.pressed ? 0.01 : 1e9;
      },
      frame: () => ({ pressed: !!b.input.pressed }),
    };
  },
};

// ------------------------------------------------------------------ Slide switch

export const slideSwitch: ComponentDef = {
  type: 'slide-switch',
  name: 'Slide switch',
  category: 'switches',
  description: 'SPDT slide switch. The middle pin (common) connects to the left or right pin. Click to flip it.',
  keywords: ['spdt', 'toggle', 'switch', 'selector'],
  bounds: { x: -8, y: -18, w: 36, h: 20 },
  pins: () => [
    { id: '1', x: 0, y: 0, kind: 'lead', label: 'Terminal 1' },
    { id: 'C', x: 10, y: 0, kind: 'lead', label: 'Common' },
    { id: '2', x: 20, y: 0, kind: 'lead', label: 'Terminal 2' },
  ],
  defaultProps: { position: 0 },
  fields: [{ key: 'position', label: 'Position', kind: 'select', options: [{ value: 0, label: 'Left (C–1)' }, { value: 1, label: 'Right (C–2)' }], live: true }],
  interactive: 'toggle',
  render: ({ props }) => {
    const right = Number(props.position) === 1;
    return (
      <g>
        {[0, 10, 20].map((x) => <Lead key={x} x1={x} y1={-5} x2={x} y2={0} />)}
        <rect x={-7} y={-16} width={34} height={12} rx={2} fill="#2f3237" stroke="#1d1f23" strokeWidth={0.6} />
        <rect x={-3} y={-13} width={26} height={6} rx={1.5} fill="#16181b" />
        <rect x={right ? 11 : -2} y={-15} width={11} height={10} rx={1.5} fill="#e9ecef" stroke="#9aa3ad" strokeWidth={0.6} style={{ transition: 'x 120ms' }} />
        <line x1={right ? 14.5 : 1.5} x2={right ? 14.5 : 1.5} y1={-13} y2={-7} stroke="#b5bcc4" strokeWidth={0.6} />
        <line x1={right ? 18.5 : 5.5} x2={right ? 18.5 : 5.5} y1={-13} y2={-7} stroke="#b5bcc4" strokeWidth={0.6} />
        {[0, 10, 20].map((x) => <PinTip key={x} x={x} y={0} />)}
      </g>
    );
  },
  schematic: ({ props }) => {
    const right = Number(props.position) === 1;
    return (
      <g>
        <SLine pts={[[0, 0], [0, -14]]} />
        <SLine pts={[[20, 0], [20, -14]]} />
        <SLine pts={[[10, 0], [10, -6]]} />
        <circle cx={0} cy={-14} r={1.3} fill="#1f3a5f" />
        <circle cx={20} cy={-14} r={1.3} fill="#1f3a5f" />
        <SLine pts={[[10, -6], [right ? 19 : 1, -14]]} />
      </g>
    );
  },
  build: (b, comp) => {
    const right = Number(comp.props.position) === 1;
    b.resistor('C', '1', right ? 1e9 : 0.01);
    b.resistor('C', '2', right ? 0.01 : 1e9);
    return {};
  },
};
