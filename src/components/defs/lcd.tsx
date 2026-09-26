import type { ComponentDef, PinDef } from '../types';
import type { Props } from '../../model/types';
import { Avg, type SimBuilder, type SimComponent, type SimWarning } from '../../sim/builder';
import { HD44780, lcdChar } from '../../sim/hd44780';
import { Label, PinTip, SLine, SText, clamp01, ledParams } from '../util';

const CELL_W = 10, CELL_H = 15;

function dims(props: Props) {
  const [cols, rows] = String(props.size ?? '16x2').split('x').map(Number);
  const gw = cols * CELL_W + 10, gh = rows * CELL_H + 8;
  const w = Math.max(196, gw + 30);
  const h = gh + 38;
  return { cols, rows, gw, gh, w, h, x0: -20, y0: -h - 4 };
}

const PAR_PINS = ['VSS', 'VDD', 'V0', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'A', 'K'];
const PAR_LABELS: Record<string, string> = {
  VSS: 'VSS (GND)', VDD: 'VDD (+5 V)', V0: 'V0 (contrast)', RS: 'RS (register select)', RW: 'R/W (tie to GND)', E: 'E (enable)',
  A: 'A (backlight +)', K: 'K (backlight −)',
};
const I2C_PINS = ['GND', 'VCC', 'SDA', 'SCL'];

const COLORS: Record<string, { glass: string; glassOff: string; ink: string; inkOff: string; dot: string }> = {
  green: { glass: '#a8d34a', glassOff: '#76894a', ink: '#1d2c0e', inkOff: '#27330f', dot: 'rgba(40,70,10,.10)' },
  blue: { glass: '#2e63f0', glassOff: '#1b2c68', ink: '#f2f6ff', inkOff: 'rgba(210,220,255,.35)', dot: 'rgba(255,255,255,.07)' },
};

interface LcdView {
  rows: number[][];
  glyphs: Record<number, number[]>;
  cursor: [number, number] | null;
  blink: boolean;
  underline: boolean;
  on: boolean;
  backlight: number;
  contrast: number;
}

function Screen({ id, props, view }: { id: string; props: Props; view?: LcdView }) {
  const d = dims(props);
  const c = COLORS[String(props.color)] ?? COLORS.green;
  const gx = d.x0 + (d.w - d.gw) / 2, gy = d.y0 + 14;
  const lit = (view?.backlight ?? 0) > 0.05;
  const glass = lit ? c.glass : c.glassOff;
  const ink = lit ? c.ink : c.inkOff;
  const show = view && view.on;
  const pid = `lcdpx-${id}`;
  return (
    <g>
      <defs>
        <pattern id={pid} width={CELL_W / 5} height={CELL_H / 8} patternUnits="userSpaceOnUse" x={gx + 5} y={gy + 4}>
          <rect width={CELL_W / 5 - 0.35} height={CELL_H / 8 - 0.35} fill={c.dot} />
        </pattern>
      </defs>
      <rect x={gx - 4} y={gy - 4} width={d.gw + 8} height={d.gh + 8} rx={2} fill="#202226" />
      <rect x={gx} y={gy} width={d.gw} height={d.gh} rx={1.5} fill={glass} />
      {lit && <rect x={gx} y={gy} width={d.gw} height={d.gh} rx={1.5} fill="#fff" opacity={0.12 * (view?.backlight ?? 0)} />}
      {Array.from({ length: d.rows }, (_, r) => (
        <rect key={r} x={gx + 5} y={gy + 4 + r * CELL_H} width={d.cols * CELL_W - 1} height={CELL_H - 2} fill={`url(#${pid})`} />
      ))}
      {show &&
        view.rows.map((row, r) =>
          row.map((code, col) => {
            const x = gx + 5 + col * CELL_W, y = gy + 4 + r * CELL_H;
            const op = view.contrast;
            if (code < 16) {
              const g = view.glyphs[code & 7] ?? [];
              return (
                <g key={`${r}-${col}`} opacity={op}>
                  {g.flatMap((bits, py) =>
                    [0, 1, 2, 3, 4].filter((px) => bits & (16 >> px)).map((px) => (
                      <rect key={`${py}-${px}`} x={x + (px * CELL_W) / 5} y={y + (py * (CELL_H - 2)) / 8} width={CELL_W / 5 - 0.3} height={(CELL_H - 2) / 8 - 0.3} fill={ink} />
                    )),
                  )}
                </g>
              );
            }
            const ch = lcdChar(code);
            if (ch === ' ') return null;
            return (
              <text key={`${r}-${col}`} x={x + CELL_W / 2 - 0.5} y={y + CELL_H - 4.2} fontSize={12.5} textAnchor="middle" fontFamily="'JetBrains Mono', ui-monospace, monospace" fontWeight={600} fill={ink} opacity={op} style={{ userSelect: 'none' }}>
                {ch}
              </text>
            );
          }),
        )}
      {show && view.cursor && (view.underline || view.blink) && (
        <rect
          x={gx + 5 + view.cursor[1] * CELL_W}
          y={gy + 4 + view.cursor[0] * CELL_H + (view.blink ? 0 : CELL_H - 3.5)}
          width={CELL_W - 1}
          height={view.blink ? CELL_H - 2 : 1.6}
          fill={ink}
          opacity={view.contrast * (view.blink ? 0.8 : 1)}
          className={view.blink ? 'lcd-blink' : undefined}
        />
      )}
    </g>
  );
}

function lcdFrame(ctrl: HD44780, props: Props, on: boolean, backlight: number, contrast: number): LcdView {
  const d = dims(props);
  const rows = ctrl.visible(d.cols, d.rows);
  const glyphs: Record<number, number[]> = {};
  for (const row of rows) for (const code of row) if (code < 16 && !glyphs[code & 7]) glyphs[code & 7] = ctrl.glyph(code);
  return {
    rows,
    glyphs,
    cursor: ctrl.cursorOn || ctrl.blinkOn ? ctrl.cursorPos(d.cols, d.rows) : null,
    blink: ctrl.blinkOn,
    underline: ctrl.cursorOn,
    on: on && ctrl.displayOn,
    backlight,
    contrast,
  };
}

const sizeField = { key: 'size', label: 'Size', kind: 'select' as const, options: [{ value: '16x2', label: '16 × 2' }, { value: '20x4', label: '20 × 4' }] };
const colorField = { key: 'color', label: 'Colour', kind: 'select' as const, options: [{ value: 'green', label: 'Yellow-green' }, { value: 'blue', label: 'Blue / white text' }] };

function boardArt(props: Props, header: string[], label: string) {
  const d = dims(props);
  return (
    <>
      <rect x={d.x0} y={d.y0} width={d.w} height={d.h} rx={4} fill="#1f7a45" stroke="#145a31" strokeWidth={1} />
      {[[d.x0 + 6, d.y0 + 6], [d.x0 + d.w - 6, d.y0 + 6], [d.x0 + 6, d.y0 + d.h - 6], [d.x0 + d.w - 6, d.y0 + d.h - 6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill="#e9e4d0" />
      ))}
      <rect x={-5} y={-6} width={header.length * 10} height={8} rx={1} fill="#1d1e21" />
      {header.map((p, i) => (
        <text key={p} x={i * 10} y={-9} fontSize={3.6} textAnchor="middle" fill="#e8f3ea" fontFamily="Inter, sans-serif" fontWeight={600} style={{ userSelect: 'none' }}>
          {p}
        </text>
      ))}
      <Label x={d.x0 + d.w - 8} y={-10} size={4.5} fill="#bfe3cc" anchor="end">{label}</Label>
      {header.map((_, i) => <PinTip key={i} x={i * 10} y={0} />)}
    </>
  );
}

function lcdSchematic(props: Props, header: string[], title: string) {
  const d = dims(props);
  return (
    <g>
      <rect x={-10} y={-60} width={Math.max(60, header.length * 10 + 10)} height={46} rx={3} fill="#fff" stroke="#1f3a5f" strokeWidth={1.4} />
      <SText x={-5 + (header.length * 10) / 2} y={-40} size={8}>{title}</SText>
      <SText x={-5 + (header.length * 10) / 2} y={-30} size={5}>{`${d.cols}×${d.rows} HD44780`}</SText>
      {header.map((p, i) => (
        <g key={p}>
          <SLine pts={[[i * 10, 0], [i * 10, -14]]} />
          <text x={i * 10 + 1.5} y={-16} fontSize={3.8} fill="#1f3a5f" fontFamily="monospace" transform={`rotate(-90 ${i * 10 + 1.5} -16)`}>{p}</text>
        </g>
      ))}
    </g>
  );
}

// ------------------------------------------------------------------ parallel LCD

export const lcdParallel: ComponentDef = {
  type: 'lcd',
  name: 'LCD 16×2 (parallel)',
  category: 'output',
  description: 'HD44780 character LCD. Use the LiquidCrystal library, e.g. LiquidCrystal lcd(12, 11, 5, 4, 3, 2) for RS, E, D4–D7. Power VDD/VSS, tie RW to GND, feed V0 from a pot (or GND for full contrast) and the backlight A/K through a resistor.',
  keywords: ['lcd', 'display', '1602', '2004', 'character', 'hd44780', 'liquidcrystal', 'screen'],
  bounds: { x: -20, y: -86, w: 196, h: 90 },
  boundsFor: (p) => {
    const d = dims(p);
    return { x: d.x0, y: d.y0, w: d.w, h: d.h + 6 };
  },
  pins: () => PAR_PINS.map((id, i): PinDef => ({ id, x: i * 10, y: 0, kind: 'lead', label: PAR_LABELS[id] ?? `Data ${id}` })),
  defaultProps: { size: '16x2', color: 'green' },
  fields: [sizeField, colorField],
  summary: (p) => `${String(p.size).replace('x', ' × ')} characters`,
  render: ({ comp, props, sim }) => (
    <g>
      {boardArt(props, PAR_PINS, 'LCD1602')}
      <Screen id={comp.id} props={props} view={sim as LcdView | undefined} />
    </g>
  ),
  schematic: ({ props }) => lcdSchematic(props, PAR_PINS, 'LCD'),
  build: (b, comp) => buildParallel(b, comp.props),
};

function buildParallel(b: SimBuilder, props: Props): SimComponent {
  const ctrl: HD44780 = (b.state.ctrl ??= new HD44780());
  b.resistor('VDD', 'VSS', 2500);
  for (const p of ['RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']) if (b.connected(p)) b.resistor(p, 'VSS', 1e6);
  const v0Connected = b.connected('V0');
  if (v0Connected) b.resistor('V0', 'VSS', 1e5);
  const mid = b.internal();
  b.resistor('A', mid, 100);
  const bl = b.diode(mid, 'K', ledParams(3.0));
  const reg = b.registerLcd({ ctrl, rs: 'RS', en: 'E', data4: ['D4', 'D5', 'D6', 'D7'] });
  const blI = new Avg();
  const vdd = new Avg();
  const v0 = new Avg();
  let wasPowered = true;
  let warn: SimWarning[] = [];
  return {
    afterStep(v, h) {
      const supply = b.volt('VDD') - b.volt('VSS');
      vdd.add(supply, h);
      v0.add(b.volt('V0') - b.volt('VSS'), h);
      blI.add(bl.currents(v)[0], h);
      const powered = supply > 4;
      if (!powered && wasPowered) ctrl.reset();
      wasPowered = powered;
    },
    frame() {
      const supply = vdd.take();
      const vc = v0.take();
      const powered = supply > 4;
      const contrast = !v0Connected ? 1 : clamp01((supply - vc - 0.8) / 2.5);
      const i = blI.take();
      warn = [];
      if (supply > 1 && !powered) warn.push({ level: 'warn', message: `LCD supply is only ${supply.toFixed(1)} V — it needs 5 V on VDD.` });
      if (powered && v0Connected && contrast < 0.15) warn.push({ level: 'warn', message: 'Contrast is too low to see anything: V0 should be near GND (turn the contrast pot).' });
      if (reg.dataMismatch) warn.push({ level: 'error', message: "The LCD's D4–D7 aren't wired to the data pins named in LiquidCrystal lcd(...) — characters will be garbage." });
      if (i > 0.06) warn.push({ level: 'warn', message: 'Backlight current is high — add a resistor on pin A.' });
      return lcdFrame(ctrl, props, powered, clamp01(i / 0.015), contrast) as unknown as Record<string, any>;
    },
    warnings: () => warn,
  };
}

// ------------------------------------------------------------------ I2C LCD

export const lcdI2C: ComponentDef = {
  type: 'lcd-i2c',
  name: 'LCD 16×2 I2C',
  category: 'output',
  description: 'Character LCD with a PCF8574 I2C backpack: only GND, VCC, SDA and SCL. Use LiquidCrystal_I2C lcd(0x27, 16, 2). On the Uno SDA = A4, SCL = A5; on the ESP32 SDA = GPIO21, SCL = GPIO22.',
  keywords: ['lcd', 'i2c', 'display', 'pcf8574', 'liquidcrystal_i2c', 'screen', 'twi'],
  bounds: { x: -20, y: -86, w: 196, h: 90 },
  boundsFor: lcdParallel.boundsFor,
  pins: () => I2C_PINS.map((id, i): PinDef => ({ id, x: i * 10, y: 0, kind: 'lead', label: id === 'VCC' ? 'VCC (+5 V)' : id })),
  defaultProps: { size: '16x2', color: 'blue', address: 0x27 },
  fields: [
    sizeField,
    colorField,
    { key: 'address', label: 'I2C address', kind: 'select', options: [{ value: 0x27, label: '0x27' }, { value: 0x3f, label: '0x3F' }, { value: 0x20, label: '0x20' }] },
  ],
  summary: (p) => `${String(p.size).replace('x', ' × ')} · address 0x${Number(p.address).toString(16).toUpperCase()}`,
  render: ({ comp, props, sim }) => (
    <g>
      {boardArt(props, I2C_PINS, `I2C 0x${Number(props.address).toString(16).toUpperCase()}`)}
      <Screen id={comp.id} props={props} view={sim as LcdView | undefined} />
    </g>
  ),
  schematic: ({ props }) => lcdSchematic(props, I2C_PINS, 'LCD I2C'),
  build: (b, comp) => {
    const ctrl: HD44780 = (b.state.ctrl ??= new HD44780());
    b.resistor('VCC', 'GND', 250);
    b.resistor('SDA', 'GND', 1e6);
    b.resistor('SCL', 'GND', 1e6);
    let powered = false;
    const vcc = new Avg();
    b.registerI2C({
      address: Number(comp.props.address),
      sda: 'SDA',
      scl: 'SCL',
      powered: () => powered,
      device: { write: (bytes) => bytes.forEach((x) => ctrl.pcfWrite(x)), read: (n) => new Array(n).fill(0xff) },
    });
    let warn: SimWarning[] = [];
    return {
      afterStep(_v, h) {
        const s = b.volt('VCC') - b.volt('GND');
        vcc.add(s, h);
        const now = s > 2.7;
        if (!now && powered) ctrl.reset();
        powered = now;
      },
      frame() {
        const s = vcc.take();
        warn = [];
        if (s > 0.5 && s <= 2.7) warn.push({ level: 'warn', message: `Display supply is only ${s.toFixed(1)} V — connect VCC to 5 V.` });
        if (powered && !b.connected('SDA')) warn.push({ level: 'warn', message: 'SDA/SCL are not connected — wire them to the board’s I2C pins.' });
        return lcdFrame(ctrl, comp.props, powered, powered && ctrl.backlight ? 1 : 0, 1) as unknown as Record<string, any>;
      },
      warnings: () => warn,
    };
  },
};
