import type { ComponentDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import { Label, SLine, SText, formatSI } from '../util';

const BATTERIES: Record<string, { v: number; r: number; label: string; imax: number }> = {
  '9V': { v: 9, r: 1.7, label: '9 V battery', imax: 0.5 },
  AA2: { v: 3, r: 0.3, label: '2 × AA (3 V)', imax: 2 },
  AA4: { v: 6, r: 0.6, label: '4 × AA (6 V)', imax: 2 },
  coin: { v: 3, r: 18, label: 'CR2032 coin cell (3 V)', imax: 0.03 },
};

function Terminal({ x, y, plus }: { x: number; y: number; plus: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3.4} fill={plus ? '#d63c35' : '#2b2d31'} stroke="#111" strokeWidth={0.5} />
      <circle cx={x} cy={y} r={1.6} fill="#d8dde2" />
    </g>
  );
}

export const battery: ComponentDef = {
  type: 'battery',
  name: 'Battery',
  category: 'power',
  description: 'Battery with realistic internal resistance. Choose 9 V, 2×AA, 4×AA or a coin cell. Wire from its terminals.',
  keywords: ['power', 'cell', '9v', 'aa', 'coin', 'source', 'supply'],
  bounds: { x: 0, y: -8, w: 60, h: 98 },
  pins: () => [
    { id: '+', x: 20, y: 0, kind: 'terminal', label: 'Positive (+)' },
    { id: '-', x: 40, y: 0, kind: 'terminal', label: 'Negative (−)' },
  ],
  defaultProps: { kind: '9V' },
  fields: [{ key: 'kind', label: 'Type', kind: 'select', options: Object.entries(BATTERIES).map(([k, v]) => ({ value: k, label: v.label })) }],
  summary: (p) => BATTERIES[String(p.kind)]?.label ?? '',
  render: ({ props }) => {
    const k = String(props.kind);
    if (k === 'coin') {
      return (
        <g>
          <rect x={4} y={6} width={52} height={60} rx={6} fill="#2b2d31" />
          <circle cx={30} cy={40} r={22} fill="#c9ced4" stroke="#8d949c" strokeWidth={1} />
          <circle cx={30} cy={40} r={17} fill="none" stroke="#adb3ba" strokeWidth={0.8} />
          <Label x={30} y={38} size={6} fill="#4a5058">CR2032</Label>
          <Label x={30} y={47} size={6} fill="#4a5058">3V +</Label>
          <Terminal x={20} y={0} plus />
          <Terminal x={40} y={0} plus={false} />
        </g>
      );
    }
    if (k === 'AA2' || k === 'AA4') {
      const n = k === 'AA2' ? 2 : 4;
      const w = 52 / n;
      return (
        <g>
          <rect x={2} y={6} width={56} height={82} rx={4} fill="#2b2d31" />
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <rect x={4 + i * w + 1} y={12} width={w - 2} height={70} rx={3} fill={i % 2 ? '#e2b33b' : '#1f1f22'} stroke="#555" strokeWidth={0.4} />
              <rect x={4 + i * w + 1} y={12} width={w - 2} height={18} rx={3} fill="#c6ccd2" />
              <Label x={4 + i * w + w / 2} y={60} size={5} fill={i % 2 ? '#1f1f22' : '#e2b33b'}>AA</Label>
            </g>
          ))}
          <Label x={30} y={96} size={6} fill="#555">{BATTERIES[k].v} V</Label>
          <Terminal x={20} y={0} plus />
          <Terminal x={40} y={0} plus={false} />
        </g>
      );
    }
    return (
      <g>
        <rect x={6} y={8} width={48} height={80} rx={4} fill="#26282c" />
        <rect x={6} y={30} width={48} height={58} rx={4} fill="#2f6fb7" />
        <rect x={6} y={30} width={48} height={14} fill="#f2c230" />
        <Label x={30} y={40} size={8} fill="#1a2433" weight={800}>9V</Label>
        <Label x={30} y={64} size={6} fill="#dfe8f5">ALKALINE</Label>
        <rect x={14} y={3} width={12} height={6} rx={1} fill="#b8bec6" />
        <rect x={34} y={3} width={12} height={6} rx={1} fill="#b8bec6" />
        <Terminal x={20} y={0} plus />
        <Terminal x={40} y={0} plus={false} />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <SLine pts={[[20, 0], [20, 30]]} />
      <SLine pts={[[40, 0], [40, 6], [30, 6], [30, 40]]} />
      <SLine pts={[[12, 30], [28, 30]]} />
      <SLine pts={[[16, 34], [24, 34]]} w={2.2} />
      <SLine pts={[[12, 38], [28, 38]]} />
      <SLine pts={[[16, 42], [24, 42]]} w={2.2} />
      <SLine pts={[[20, 42], [20, 50], [30, 50], [30, 40]]} />
      <SText x={20} y={60}>{`${BATTERIES[String(props.kind)]?.v ?? '?'} V`}</SText>
      <SText x={9} y={27} size={6}>+</SText>
    </g>
  ),
  build: (b, comp) => {
    const spec = BATTERIES[String(comp.props.kind)] ?? BATTERIES['9V'];
    const s = b.source('+', '-', spec.v, spec.r);
    b.markGround('-');
    const i = new Avg();
    let warn: SimWarning[] = [];
    return {
      afterStep(v, h) {
        i.add(-s.currents(v)[0], h);
      },
      frame() {
        const cur = i.take();
        warn = [];
        const short = spec.v / spec.r;
        if (Math.abs(cur) > Math.max(spec.imax, short * 0.5)) warn.push({ level: 'error', message: `Short circuit! The battery is delivering ${formatSI(Math.abs(cur), 'A')}. Check for a wire straight across + and −.` });
        else if (Math.abs(cur) > spec.imax) warn.push({ level: 'warn', message: `Drawing ${formatSI(Math.abs(cur), 'A')} — more than this battery can supply for long.` });
        if (cur < -0.01) warn.push({ level: 'warn', message: 'Current is being forced backwards into the battery (another source is fighting it).' });
        return { current: cur };
      },
      warnings: () => warn,
    };
  },
};
