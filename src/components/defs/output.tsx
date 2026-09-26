import type { ComponentDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import { Label, Lead, PinTip, SLine, SText, formatSI } from '../util';

// ------------------------------------------------------------------ DC motor

const MOTOR = { R: 8, K: 0.0095, J: 1.2e-6, B: 1.5e-7, noLoadCurrent: 0.04 };

export const dcMotor: ComponentDef = {
  type: 'dc-motor',
  name: 'DC motor',
  category: 'output',
  description: 'Small brushed hobby motor (≈6 V, ~6000 rpm no-load) with back-EMF and inertia. Drive it through a transistor, not straight from a pin.',
  keywords: ['motor', 'actuator', 'hobby motor', 'fan'],
  bounds: { x: -10, y: -62, w: 60, h: 70 },
  pins: () => [
    { id: '+', x: 10, y: 0, kind: 'terminal', label: 'Terminal + (red)' },
    { id: '-', x: 30, y: 0, kind: 'terminal', label: 'Terminal − (black)' },
  ],
  defaultProps: {},
  render: ({ sim }) => {
    const angle = sim?.angle ?? 0;
    const rpm = sim?.rpm ?? 0;
    return (
      <g>
        <path d="M10 0 C10 -6 12 -8 14 -12" stroke="#d63c35" strokeWidth={2.2} fill="none" />
        <path d="M30 0 C30 -6 28 -8 26 -12" stroke="#2b2d31" strokeWidth={2.2} fill="none" />
        <circle cx={20} cy={-34} r={24} fill="#c3c9cf" stroke="#7d858e" strokeWidth={1} />
        <circle cx={20} cy={-34} r={19} fill="#aeb5bd" />
        <rect x={10} y={-14} width={20} height={6} rx={2} fill="#e9d5a2" stroke="#a88f53" strokeWidth={0.6} />
        <g transform={`rotate(${angle} 20 -34)`}>
          <rect x={3} y={-36.5} width={34} height={5} rx={2.5} fill="#f2f4f6" stroke="#8d949c" strokeWidth={0.6} />
          <circle cx={20} cy={-34} r={4} fill="#5f6770" />
          <circle cx={36} cy={-34} r={1.6} fill="#e25b45" />
        </g>
        {Math.abs(rpm) > 50 && <Label x={20} y={-62} size={6} fill="#333">{Math.round(rpm)} rpm</Label>}
        <PinTip x={10} y={0} />
        <PinTip x={30} y={0} />
      </g>
    );
  },
  schematic: () => (
    <g>
      <SLine pts={[[10, 0], [10, -14]]} />
      <SLine pts={[[30, 0], [30, -14]]} />
      <SLine pts={[[10, -14], [14, -22]]} />
      <SLine pts={[[30, -14], [26, -22]]} />
      <circle cx={20} cy={-32} r={12} fill="none" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={20} y={-29} size={9}>M</SText>
    </g>
  ),
  build: (b) => {
    const src = b.source('+', '-', 0, MOTOR.R);
    let omega = b.state.omega ?? 0;
    let angle = b.state.angle ?? 0;
    const cur = new Avg();
    const w = new Avg();
    let warn: SimWarning[] = [];
    return {
      beforeStep() {
        src.volts = MOTOR.K * omega;
      },
      afterStep(v, h) {
        const i = src.currents(v)[0];
        const tm = MOTOR.K * i;
        const tf = MOTOR.K * MOTOR.noLoadCurrent;
        if (omega === 0 && Math.abs(tm) <= tf) omega = 0;
        else {
          const fr = (omega !== 0 ? Math.sign(omega) : Math.sign(tm)) * tf;
          const next = omega + ((tm - fr - MOTOR.B * omega) / MOTOR.J) * h;
          // friction stops the rotor rather than reversing it
          omega = omega !== 0 && Math.sign(next) !== Math.sign(omega) ? 0 : next;
        }
        b.state.omega = omega;
        cur.add(i, h);
        w.add(omega, h);
      },
      frame(dt) {
        const om = w.take();
        const rpm = (om * 60) / (2 * Math.PI);
        // Visual rotation deliberately slowed so it's readable (≈ rpm/40 turns per second)
        angle = (angle + (rpm / 40) * 360 * Math.min(dt, 0.1)) % 360;
        b.state.angle = angle;
        const i = cur.take();
        warn = Math.abs(i) > 1.5 ? [{ level: 'warn', message: `Stall-level current ${formatSI(Math.abs(i), 'A')}.` }] : [];
        return { rpm, angle, current: i };
      },
      warnings: () => warn,
    };
  },
};

// ------------------------------------------------------------------ Piezo buzzer

export const piezo: ComponentDef = {
  type: 'piezo',
  name: 'Piezo buzzer',
  category: 'output',
  description: 'Passive piezo buzzer. It sounds when driven with a changing signal, e.g. tone(pin, 440) or PWM. Sound can be muted from the toolbar.',
  keywords: ['buzzer', 'speaker', 'sound', 'tone', 'beeper'],
  bounds: { x: -12, y: -38, w: 44, h: 40 },
  pins: () => [
    { id: '+', x: 0, y: 0, kind: 'lead', label: 'Positive (+)' },
    { id: '-', x: 20, y: 0, kind: 'lead', label: 'Negative (−)' },
  ],
  defaultProps: {},
  render: ({ sim }) => {
    const on = !!sim?.freq;
    return (
      <g>
        <Lead x1={0} y1={-8} x2={0} y2={0} />
        <Lead x1={20} y1={-8} x2={20} y2={0} />
        <circle cx={10} cy={-22} r={16} fill="#232428" stroke="#0e0f11" strokeWidth={0.8} />
        <circle cx={10} cy={-22} r={11} fill="#2d2f34" />
        <circle cx={10} cy={-22} r={2.5} fill="#0e0f11" />
        <Label x={0} y={-30} size={6} fill="#e6e6e6">+</Label>
        {on && (
          <g className="sound-waves" style={{ pointerEvents: 'none' }}>
            <path d="M28 -30 q5 8 0 16" stroke="#ff9f1c" strokeWidth={1.4} fill="none" />
            <path d="M32 -34 q8 12 0 24" stroke="#ff9f1c" strokeWidth={1.4} fill="none" opacity={0.7} />
            <path d="M-8 -30 q-5 8 0 16" stroke="#ff9f1c" strokeWidth={1.4} fill="none" />
          </g>
        )}
        {on && <Label x={10} y={-42} size={5.5} fill="#333">{Math.round(sim!.freq)} Hz</Label>}
        <PinTip x={0} y={0} />
        <PinTip x={20} y={0} />
      </g>
    );
  },
  schematic: () => (
    <g>
      <SLine pts={[[0, 0], [0, -12], [4, -12]]} />
      <SLine pts={[[20, 0], [20, -12], [16, -12]]} />
      <path d="M4 -8 L4 -22 L16 -22 L16 -8 Z" fill="none" stroke="#1f3a5f" strokeWidth={1.3} />
      <path d="M2 -26 L18 -26 L10 -32 Z" fill="none" stroke="#1f3a5f" strokeWidth={1.2} />
      <SText x={-3} y={-14} size={6}>+</SText>
    </g>
  ),
  build: (b) => {
    const r = b.resistor('+', '-', 20000);
    const v = new Avg();
    return {
      afterStep(volts, h) {
        const [i] = r.currents(volts);
        v.add(i * r.r, h);
      },
      frame() {
        const avg = v.take();
        const f = b.signalFrequency('+') || b.signalFrequency('-');
        return { freq: Math.abs(avg) > 0.3 && f ? f : 0 };
      },
    };
  },
};
