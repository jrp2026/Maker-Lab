import type { ComponentDef } from '../types';
import { Avg, type SimWarning } from '../../sim/builder';
import { DropShadow, Label, PinTip, SLine, SText, Sheen, formatSI } from '../util';

const MODELS: Record<string, { label: string; speed: number; continuous: boolean; moveAmps: number; minV: number; body: string }> = {
  sg90: { label: 'SG90 micro (180°)', speed: 600, continuous: false, moveAmps: 0.25, minV: 4, body: '#2f6fd6' },
  mg996r: { label: 'MG996R high-torque (180°)', speed: 350, continuous: false, moveAmps: 0.9, minV: 4.8, body: '#1f2226' },
  fs90r: { label: 'FS90R continuous rotation', speed: 0, continuous: true, moveAmps: 0.2, minV: 4, body: '#e36f2c' },
};
const MIN_US = 544, MAX_US = 2400;

export const servo: ComponentDef = {
  type: 'servo',
  name: 'Servo motor',
  category: 'output',
  description: 'Hobby servo. Brown = GND, red = +5 V, orange = signal. Drive it with the Servo library: servo.attach(pin); servo.write(angle). Continuous-rotation servos turn at a speed set by the angle (90 = stop).',
  keywords: ['servo', 'sg90', 'mg996r', 'actuator', 'motor', 'continuous rotation', 'high torque'],
  bounds: { x: -30, y: -96, w: 90, h: 100 },
  pins: () => [
    { id: '-', x: 0, y: 0, kind: 'lead', label: 'GND (brown)' },
    { id: '+', x: 10, y: 0, kind: 'lead', label: '+5 V (red)' },
    { id: 'SIG', x: 20, y: 0, kind: 'lead', label: 'Signal (orange)' },
  ],
  defaultProps: { model: 'sg90' },
  fields: [{ key: 'model', label: 'Model', kind: 'select', options: Object.entries(MODELS).map(([k, v]) => ({ value: k, label: v.label })) }],
  summary: (p) => MODELS[String(p.model)]?.label ?? '',
  render: ({ props, sim }) => {
    const m = MODELS[String(props.model)] ?? MODELS.sg90;
    const angle = sim?.angle ?? 90;
    const big = props.model === 'mg996r';
    return (
      <g>
        {/* cable */}
        <path d="M-1 -4 C-1 -18 4 -26 4 -38" stroke="#6b3e22" strokeWidth={2.4} fill="none" />
        <path d="M10 -4 C10 -18 10 -26 10 -38" stroke="#d63c35" strokeWidth={2.4} fill="none" />
        <path d="M21 -4 C21 -18 16 -26 16 -38" stroke="#f08a24" strokeWidth={2.4} fill="none" />
        <rect x={-4} y={-6} width={28} height={8} rx={1.5} fill="#1d1e21" />
        {/* body */}
        <DropShadow x={big ? -26 : -20} y={-84} w={big ? 82 : 70} h={46} rx={4} />
        <rect x={big ? -26 : -20} y={-84} width={big ? 82 : 70} height={46} rx={4} fill={m.body} stroke="rgba(0,0,0,.35)" strokeWidth={0.8} />
        <Sheen x={big ? -26 : -20} y={-84} w={big ? 82 : 70} h={46} rx={4} />
        <DropShadow x={big ? -34 : -28} y={-66} w={big ? 98 : 86} h={10} rx={2} />
        <rect x={big ? -34 : -28} y={-66} width={big ? 98 : 86} height={10} rx={2} fill={m.body} stroke="rgba(0,0,0,.35)" strokeWidth={0.8} />
        <Sheen x={big ? -34 : -28} y={-66} w={big ? 98 : 86} h={10} rx={2} strength={1.3} />
        <circle cx={big ? -30 : -24} cy={-61} r={2.2} fill="#f4f2ec" />
        <circle cx={big ? 60 : 54} cy={-61} r={2.2} fill="#f4f2ec" />
        <Label x={20} y={-44} size={5.5} fill="rgba(255,255,255,.85)">{props.model === 'fs90r' ? 'FS90R 360°' : big ? 'MG996R' : 'SG90'}</Label>
        {/* output shaft + horn */}
        <circle cx={0} cy={-68} r={9} fill="rgba(0,0,0,.25)" />
        <g transform={`rotate(${angle - 90} 0 -68)`} style={{ transition: 'transform 40ms linear' }}>
          <path d="M-4 -68 L-2.6 -96 A2.6 2.6 0 0 1 2.6 -96 L4 -68 A4 4 0 0 1 -4 -68 Z" fill="#f4f6f8" stroke="#9aa3ad" strokeWidth={0.7} />
          {[-92, -86, -80].map((y) => <circle key={y} cx={0} cy={y} r={0.9} fill="#9aa3ad" />)}
        </g>
        <circle cx={0} cy={-68} r={5} fill="#f4f6f8" stroke="#9aa3ad" strokeWidth={0.7} />
        <circle cx={0} cy={-68} r={1.6} fill="#9aa3ad" />
        {sim && !m.continuous && <Label x={40} y={-90} size={6} fill="#333">{Math.round(angle)}°</Label>}
        {sim && m.continuous && Math.abs(sim.rpm ?? 0) > 1 && <Label x={40} y={-90} size={6} fill="#333">{Math.round(sim.rpm)} rpm</Label>}
        <PinTip x={0} y={0} />
        <PinTip x={10} y={0} />
        <PinTip x={20} y={0} />
      </g>
    );
  },
  schematic: () => (
    <g>
      <SLine pts={[[0, 0], [0, -20]]} />
      <SLine pts={[[10, 0], [10, -20]]} />
      <SLine pts={[[20, 0], [20, -20]]} />
      <rect x={-10} y={-50} width={40} height={30} rx={3} fill="none" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={10} y={-31} size={9}>M</SText>
      <SText x={10} y={-54} size={6}>SERVO</SText>
      <SText x={-4} y={-4} size={5}>−</SText>
      <SText x={26} y={-4} size={5}>S</SText>
    </g>
  ),
  build: (b, comp) => {
    const m = MODELS[String(comp.props.model)] ?? MODELS.sg90;
    b.resistor('SIG', '-', 1e6);
    const load = b.resistor('+', '-', 500);
    let angle: number = b.state.angle ?? 90;
    let target: number = b.state.target ?? angle;
    let rpm = 0;
    let moving = false;
    let sigEma = 0;
    const sigV = new Avg();
    const pwr = new Avg();
    let warn: SimWarning[] = [];
    return {
      beforeStep() {
        load.r = moving ? Math.max(5, 5 / m.moveAmps) : 500;
      },
      afterStep(_v, h) {
        const vp = b.volt('+') - b.volt('-');
        const vs = b.volt('SIG') - b.volt('-');
        pwr.add(vp, h);
        sigV.add(vs, h);
        sigEma += (vs - sigEma) * Math.min(1, h / 0.06);
        const info = b.signalInfo('SIG');
        const powered = vp >= m.minV - 0.6;
        // pulses must actually reach the signal pin (checked through the averaged voltage)
        const pulse = info?.servoUs != null && sigEma > 0.02 ? info.servoUs : null;
        if (pulse !== null) {
          if (m.continuous) {
            const speed = Math.max(-1, Math.min(1, (pulse - 1500) / 500));
            rpm = Math.abs(speed) < 0.03 ? 0 : speed * 110;
          } else target = Math.max(0, Math.min(180, ((pulse - MIN_US) * 180) / (MAX_US - MIN_US)));
        } else if (m.continuous) rpm = 0;
        if (!powered) {
          moving = false;
          rpm = 0;
          return;
        }
        if (m.continuous) {
          angle = (angle + (rpm / 60) * 360 * h) % 360;
          moving = rpm !== 0;
        } else {
          const d = target - angle;
          const step = m.speed * h;
          moving = Math.abs(d) > 0.5;
          angle = Math.abs(d) <= step ? target : angle + Math.sign(d) * step;
        }
        b.state.angle = angle;
        b.state.target = target;
      },
      frame() {
        const vp = pwr.take();
        sigV.take();
        warn = [];
        if (vp < m.minV - 0.6) warn.push({ level: 'warn', message: `Servo has no power (${vp.toFixed(1)} V). Connect + (red) to 5 V and − (brown) to GND.` });
        else if (vp > 7.2) warn.push({ level: 'error', message: `${vp.toFixed(1)} V on the servo supply — above its 6 V rating.` });
        return { angle, rpm, supply: vp, current: moving ? formatSI(m.moveAmps, 'A') : undefined };
      },
      warnings: () => warn,
    };
  },
};
