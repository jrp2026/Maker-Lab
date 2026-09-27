import type { ComponentDef } from '../types';
import { Avg } from '../../sim/builder';
import { DropShadow, formatSI, Label, Sheen, SLine, SText } from '../util';

// ------------------------------------------------------------------ Multimeter

const MODES: Record<string, { label: string; unit: string }> = {
  V: { label: 'Voltage (V)', unit: 'V' },
  A: { label: 'Current (A)', unit: 'A' },
  R: { label: 'Resistance (Ω)', unit: 'Ω' },
};
const OHM_TEST_CURRENT = 10e-6;

function Jack({ x, y, color, text }: { x: number; y: number; color: string; text: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill="#1d1f23" />
      <circle cx={x} cy={y} r={3.4} fill={color} stroke="#111" strokeWidth={0.5} />
      <circle cx={x} cy={y} r={1.4} fill="#111" />
      <Label x={x} y={y - 8} size={4.4} fill="#2b2d31">{text}</Label>
    </g>
  );
}

export function formatMeter(mode: string, value: number | undefined): string {
  if (value === undefined) return '- - - -';
  if (mode === 'R') {
    if (!Number.isFinite(value) || value > 40e6 || value < 0) return 'OL';
    return formatSI(value, 'Ω', 4);
  }
  if (Math.abs(value) < (mode === 'A' ? 1e-7 : 1e-4)) return `0.00 ${MODES[mode].unit}`;
  return formatSI(value, MODES[mode].unit, 4);
}

export const multimeter: ComponentDef = {
  type: 'multimeter',
  name: 'Multimeter',
  category: 'instruments',
  description: 'Digital multimeter. Voltage and resistance: connect across a part. Current: break the circuit and put the meter in series. Click it during simulation to change mode.',
  keywords: ['dmm', 'voltmeter', 'ammeter', 'ohmmeter', 'meter', 'probe'],
  bounds: { x: 0, y: 0, w: 70, h: 110 },
  pins: () => [
    { id: 'COM', x: 20, y: 100, kind: 'terminal', label: 'COM (black probe)' },
    { id: '+', x: 50, y: 100, kind: 'terminal', label: 'V/Ω/A (red probe)' },
  ],
  defaultProps: { mode: 'V' },
  fields: [{ key: 'mode', label: 'Mode', kind: 'select', options: Object.entries(MODES).map(([k, v]) => ({ value: k, label: v.label })), live: true }],
  interactive: 'toggle',
  summary: (p) => MODES[String(p.mode)]?.label ?? '',
  render: ({ props, sim }) => {
    const mode = String(props.mode);
    const text = sim ? formatMeter(mode, sim.value) : '';
    const knob = { V: -40, A: 0, R: 40 }[mode] ?? 0;
    return (
      <g>
        <DropShadow x={0} y={0} w={70} h={110} rx={9} />
        <rect x={0} y={0} width={70} height={110} rx={9} fill="#f3c534" stroke="#c49a1b" strokeWidth={1} />
        <Sheen x={0} y={0} w={70} h={110} rx={9} />
        <rect x={4} y={4} width={62} height={102} rx={7} fill="#2e3136" />
        <rect x={9} y={10} width={52} height={24} rx={3} fill={sim ? '#c8e6c0' : '#9fb39a'} stroke="#1a1c1f" strokeWidth={1} />
        <text x={57} y={27} fontSize={text.length > 9 ? 7 : 9} textAnchor="end" fontFamily="'JetBrains Mono', ui-monospace, monospace" fontWeight={700} fill="#1c2a1a" style={{ userSelect: 'none' }}>
          {text}
        </text>
        <Label x={35} y={45} size={4.5} fill="#cfd3d8">{MODES[mode]?.label}</Label>
        <circle cx={35} cy={66} r={14} fill="#1d1f23" stroke="#4b4f56" strokeWidth={1} />
        <g transform={`rotate(${knob} 35 66)`}>
          <rect x={33} y={53} width={4} height={14} rx={2} fill="#e5e7ea" />
        </g>
        <Label x={17} y={56} size={5} fill="#f3c534">V</Label>
        <Label x={35} y={49} size={5} fill="#f3c534">A</Label>
        <Label x={53} y={56} size={5} fill="#f3c534">Ω</Label>
        <rect x={6} y={86} width={58} height={20} rx={4} fill="#f3f4f6" />
        <Jack x={20} y={100} color="#222" text="COM" />
        <Jack x={50} y={100} color="#d63c35" text="VΩA" />
      </g>
    );
  },
  schematic: ({ props }) => (
    <g>
      <circle cx={35} cy={60} r={18} fill="none" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={35} y={65} size={14}>{String(props.mode) === 'R' ? 'Ω' : String(props.mode)}</SText>
      <SLine pts={[[20, 100], [20, 72]]} />
      <SLine pts={[[50, 100], [50, 72]]} />
      <SText x={14} y={96} size={6}>−</SText>
      <SText x={56} y={96} size={6}>+</SText>
    </g>
  ),
  build: (b, comp) => {
    const mode = String(comp.props.mode);
    const avg = new Avg();
    if (mode === 'A') {
      const r = b.resistor('+', 'COM', 0.01);
      return {
        afterStep(v, h) {
          avg.add(r.currents(v)[0], h);
        },
        frame: () => ({ value: avg.take() }),
      };
    }
    if (mode === 'R') {
      b.currentSource('+', 'COM', OHM_TEST_CURRENT);
      const leak = b.resistor('+', 'COM', 1e9);
      return {
        afterStep(v, h) {
          avg.add(leak.currents(v)[0] * leak.r, h);
        },
        frame() {
          const vv = avg.take();
          const r = vv / (OHM_TEST_CURRENT - vv / 1e9);
          return { value: vv > 0.95 * OHM_TEST_CURRENT * 1e9 ? Infinity : r };
        },
      };
    }
    const r = b.resistor('+', 'COM', 10e6);
    return {
      afterStep(v, h) {
        avg.add(r.currents(v)[0] * r.r, h);
      },
      frame: () => ({ value: avg.take() }),
    };
  },
};

// ------------------------------------------------------------------ Oscilloscope

const SCOPE_W = 150, SCOPE_H = 100;
const SCREEN = { x: 8, y: 8, w: 120, h: 80 };

export const oscilloscope: ComponentDef = {
  type: 'oscilloscope',
  name: 'Oscilloscope',
  category: 'instruments',
  description: 'Single-channel oscilloscope. Connect + to the signal and − to ground; set the time base to fit your signal.',
  keywords: ['scope', 'waveform', 'probe', 'signal', 'plot'],
  bounds: { x: 0, y: 0, w: SCOPE_W, h: SCOPE_H + 20 },
  pins: () => [
    { id: '+', x: 140, y: 40, kind: 'terminal', label: 'Probe +' },
    { id: '-', x: 140, y: 70, kind: 'terminal', label: 'Probe − (ground)' },
  ],
  defaultProps: { timeDiv: 0.01, voltDiv: 1 },
  fields: [
    { key: 'timeDiv', label: 'Time / div', kind: 'select', options: [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].map((t) => ({ value: t, label: formatSI(t, 's') })), live: true },
    { key: 'voltDiv', label: 'Volts / div', kind: 'select', options: [0.1, 0.2, 0.5, 1, 2, 5].map((v) => ({ value: v, label: `${v} V` })), live: true },
  ],
  summary: (p) => `${formatSI(Number(p.timeDiv), 's')}/div · ${p.voltDiv} V/div`,
  render: ({ props, sim }) => {
    const vd = Number(props.voltDiv) || 1;
    const trace: number[] = sim?.trace ?? [];
    const n = trace.length;
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = SCREEN.x + (i / Math.max(1, n - 1)) * SCREEN.w;
      const y = SCREEN.y + SCREEN.h / 2 - (trace[i] / vd) * (SCREEN.h / 8);
      pts.push(`${x.toFixed(1)},${Math.max(SCREEN.y, Math.min(SCREEN.y + SCREEN.h, y)).toFixed(1)}`);
    }
    return (
      <g>
        <DropShadow x={0} y={0} w={SCOPE_W} h={SCOPE_H + 20} rx={8} />
        <rect x={0} y={0} width={SCOPE_W} height={SCOPE_H + 20} rx={8} fill="#d9dde2" stroke="#9aa3ad" strokeWidth={1} />
        <Sheen x={0} y={0} w={SCOPE_W} h={SCOPE_H + 20} rx={8} />
        <rect x={SCREEN.x - 2} y={SCREEN.y - 2} width={SCREEN.w + 4} height={SCREEN.h + 4} rx={3} fill="#101a14" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={SCREEN.x + (i * SCREEN.w) / 10} x2={SCREEN.x + (i * SCREEN.w) / 10} y1={SCREEN.y} y2={SCREEN.y + SCREEN.h} stroke="#1f3b2a" strokeWidth={i === 5 ? 0.8 : 0.4} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} y1={SCREEN.y + (i * SCREEN.h) / 8} y2={SCREEN.y + (i * SCREEN.h) / 8} x1={SCREEN.x} x2={SCREEN.x + SCREEN.w} stroke="#1f3b2a" strokeWidth={i === 4 ? 0.8 : 0.4} />
        ))}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="#5dff8c" strokeWidth={1.2} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 1.5px #3dff7a)' }} />}
        <Label x={SCREEN.x + 2} y={SCREEN.y + SCREEN.h + 12} size={5.5} fill="#333" anchor="start">
          {formatSI(Number(props.timeDiv), 's')}/div  {vd} V/div
        </Label>
        {sim && <Label x={SCREEN.x + SCREEN.w} y={SCREEN.y + SCREEN.h + 12} size={5.5} fill="#333" anchor="end">{`${(sim.vpp ?? 0).toFixed(2)} Vpp`}</Label>}
        <Jackish y={40} color="#d63c35" text="+" />
        <Jackish y={70} color="#222" text="−" />
      </g>
    );
  },
  schematic: ({ props, sim }) => {
    // instrument box: a graticule screen (showing the live trace while simulating) and labelled inputs
    const S = { x: 30, y: 26, w: 80, h: 50 };
    const vd = Number(props.voltDiv) || 1;
    const trace: number[] = sim?.trace ?? [];
    const pts = trace.length > 1
      ? trace.map((v, i) => `${(S.x + (i / (trace.length - 1)) * S.w).toFixed(1)},${Math.max(S.y, Math.min(S.y + S.h, S.y + S.h / 2 - (v / vd) * (S.h / 8))).toFixed(1)}`).join(' ')
      : `${S.x},${S.y + S.h / 2} ${S.x + S.w},${S.y + S.h / 2}`;
    return (
      <g>
        <rect x={18} y={14} width={104} height={82} rx={5} fill="#fff" stroke="#1f3a5f" strokeWidth={1.4} />
        <rect x={S.x} y={S.y} width={S.w} height={S.h} fill="none" stroke="#1f3a5f" strokeWidth={1} />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <line key={`v${i}`} x1={S.x + (i * S.w) / 10} x2={S.x + (i * S.w) / 10} y1={S.y} y2={S.y + S.h} stroke="#1f3a5f" strokeWidth={0.3} opacity={0.45} />)}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => <line key={`h${i}`} y1={S.y + (i * S.h) / 8} y2={S.y + (i * S.h) / 8} x1={S.x} x2={S.x + S.w} stroke="#1f3a5f" strokeWidth={0.3} opacity={0.45} />)}
        <polyline points={pts} fill="none" stroke="#1f3a5f" strokeWidth={1.2} strokeLinejoin="round" />
        <SText x={70} y={89} size={8}>SCOPE</SText>
        <SText x={116} y={43} size={7} anchor="end">IN</SText>
        <SText x={116} y={73} size={7} anchor="end">⏚</SText>
        <SLine pts={[[122, 40], [140, 40]]} />
        <SLine pts={[[122, 70], [140, 70]]} />
      </g>
    );
  },
  build: (b, comp) => {
    const r = b.resistor('+', '-', 10e6);
    const timeDiv = Number(comp.props.timeDiv) || 0.01;
    const window = timeDiv * 10;
    const BUF = 400;
    const buf = new Float32Array(BUF);
    const dtSample = window / BUF;
    let acc = 0, accT = 0, head = 0, filled = 0;
    return {
      maxStep: () => Math.max(2e-5, dtSample),
      afterStep(v, h) {
        acc += r.currents(v)[0] * r.r * h;
        accT += h;
        if (accT >= dtSample) {
          buf[head] = acc / accT;
          head = (head + 1) % BUF;
          filled = Math.min(BUF, filled + 1);
          acc = 0;
          accT = 0;
        }
      },
      frame() {
        const trace: number[] = [];
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < filled; i++) {
          const x = buf[(head - filled + i + BUF) % BUF];
          trace.push(x);
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
        return { trace, vpp: filled ? hi - lo : 0 };
      },
    };
  },
};

function Jackish({ y, color, text }: { y: number; color: string; text: string }) {
  return (
    <g>
      <circle cx={140} cy={y} r={5} fill="#1d1f23" />
      <circle cx={140} cy={y} r={3.4} fill={color} />
      <circle cx={140} cy={y} r={1.4} fill="#111" />
      <Label x={140} y={y - 8} size={6} fill="#333">{text}</Label>
    </g>
  );
}
