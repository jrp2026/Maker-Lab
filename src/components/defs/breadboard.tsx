import { memo } from 'react';
import type { ComponentDef, PinDef } from '../types';
import { Label } from '../util';

const ROWS_TOP = ['a', 'b', 'c', 'd', 'e'];
const ROWS_BOT = ['f', 'g', 'h', 'i', 'j'];
const X0 = 20;
const ROW_Y: Record<string, number> = { a: 60, b: 70, c: 80, d: 90, e: 100, f: 130, g: 140, h: 150, i: 160, j: 170 };
const RAILS = [
  { id: 'tp', y: 20, sign: '+' },
  { id: 'tn', y: 30, sign: '−' },
  { id: 'bp', y: 200, sign: '+' },
  { id: 'bn', y: 210, sign: '−' },
];

function railCols(cols: number): number[] {
  const out: number[] = [];
  for (let c = 1; c < cols - 1; c++) if (c % 6 !== 0) out.push(c);
  return out;
}

interface Layout {
  cols: number;
  width: number;
  pins: PinDef[];
  groups: string[][];
}

const layouts = new Map<number, Layout>();

function layout(cols: number): Layout {
  let l = layouts.get(cols);
  if (l) return l;
  const pins: PinDef[] = [];
  const groups: string[][] = [];
  for (let c = 0; c < cols; c++) {
    const top: string[] = [], bot: string[] = [];
    for (const r of ROWS_TOP) {
      const id = `${c + 1}${r}`;
      pins.push({ id, x: X0 + c * 10, y: ROW_Y[r], kind: 'socket', label: `Column ${c + 1}, row ${r}` });
      top.push(id);
    }
    for (const r of ROWS_BOT) {
      const id = `${c + 1}${r}`;
      pins.push({ id, x: X0 + c * 10, y: ROW_Y[r], kind: 'socket', label: `Column ${c + 1}, row ${r}` });
      bot.push(id);
    }
    groups.push(top, bot);
  }
  const rc = railCols(cols);
  for (const rail of RAILS) {
    const g: string[] = [];
    for (const c of rc) {
      const id = `${rail.id}${c}`;
      pins.push({ id, x: X0 + c * 10, y: rail.y, kind: 'socket', label: `${rail.sign === '+' ? 'Positive' : 'Negative'} rail` });
      g.push(id);
    }
    groups.push(g);
  }
  l = { cols, width: X0 * 2 + (cols - 1) * 10, pins, groups };
  layouts.set(cols, l);
  return l;
}

const Hole = ({ x, y }: { x: number; y: number }) => (
  <rect x={x - 2.1} y={y - 2.1} width={4.2} height={4.2} rx={0.8} fill="#3d3f44" stroke="#d3d0c8" strokeWidth={0.4} />
);

const BoardArt = memo(function BoardArt({ cols }: { cols: number }) {
  const l = layout(cols);
  const w = l.width;
  const rc = railCols(cols);
  return (
    <g>
      <rect x={0} y={0} width={w} height={230} rx={6} fill="#f4f2ec" stroke="#d6d2c7" strokeWidth={1} />
      <rect x={0} y={0} width={w} height={230} rx={6} fill="url(#bbShade)" />
      {/* rail stripes */}
      <line x1={X0} x2={w - X0} y1={13} y2={13} stroke="#e5534b" strokeWidth={1.2} />
      <line x1={X0} x2={w - X0} y1={37} y2={37} stroke="#4a7fd6" strokeWidth={1.2} />
      <line x1={X0} x2={w - X0} y1={193} y2={193} stroke="#e5534b" strokeWidth={1.2} />
      <line x1={X0} x2={w - X0} y1={217} y2={217} stroke="#4a7fd6" strokeWidth={1.2} />
      {RAILS.map((r) => (
        <g key={r.id}>
          <Label x={8} y={r.y + 2.2} size={7} fill={r.sign === '+' ? '#d63c35' : '#3d6fc4'}>{r.sign}</Label>
          <Label x={w - 8} y={r.y + 2.2} size={7} fill={r.sign === '+' ? '#d63c35' : '#3d6fc4'}>{r.sign}</Label>
        </g>
      ))}
      {/* center trench */}
      <rect x={4} y={112} width={w - 8} height={6} rx={2} fill="#e3e0d7" />
      {/* row letters */}
      {[...ROWS_TOP, ...ROWS_BOT].map((r) => (
        <g key={r}>
          <Label x={10} y={ROW_Y[r] + 1.8} size={5} fill="#8b877c" weight={500}>{r}</Label>
          <Label x={w - 10} y={ROW_Y[r] + 1.8} size={5} fill="#8b877c" weight={500}>{r}</Label>
        </g>
      ))}
      {Array.from({ length: cols }, (_, c) =>
        c === 0 || (c + 1) % 5 === 0 ? (
          <g key={c}>
            <Label x={X0 + c * 10} y={50} size={4.5} fill="#8b877c" weight={500}>{c + 1}</Label>
            <Label x={X0 + c * 10} y={184} size={4.5} fill="#8b877c" weight={500}>{c + 1}</Label>
          </g>
        ) : null,
      )}
      {Array.from({ length: cols }, (_, c) =>
        [...ROWS_TOP, ...ROWS_BOT].map((r) => <Hole key={`${c}${r}`} x={X0 + c * 10} y={ROW_Y[r]} />),
      )}
      {RAILS.map((r) => rc.map((c) => <Hole key={`${r.id}${c}`} x={X0 + c * 10} y={r.y} />))}
    </g>
  );
});

function makeBreadboard(type: string, name: string, cols: number, description: string): ComponentDef {
  const l = layout(cols);
  return {
    type,
    name,
    category: 'boards',
    description,
    keywords: ['protoboard', 'prototype', 'solderless'],
    bounds: { x: 0, y: 0, w: l.width, h: 230 },
    pins: () => l.pins,
    internalConnections: () => l.groups,
    defaultProps: {},
    layer: 0,
    thumbScale: cols > 40 ? 0.9 : 1,
    render: () => <BoardArt cols={cols} />,
    schematic: () => null,
  };
}

export const breadboardSmall = makeBreadboard('breadboard', 'Breadboard (half)', 30, 'Half-size solderless breadboard: 30 columns of 5-hole strips plus two power rails on each side.');
export const breadboardFull = makeBreadboard('breadboard-full', 'Breadboard (full)', 63, 'Full-size solderless breadboard: 63 columns plus power rails.');
