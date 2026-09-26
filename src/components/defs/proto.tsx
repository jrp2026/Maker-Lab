/** Prototyping surfaces: perfboard, stripboard (prototype PCB) and a DIP IC socket. */
import { memo } from 'react';
import type { ComponentDef, PinDef } from '../types';
import { Label } from '../util';

const COLS = 24, ROWS = 16, X0 = 10, Y0 = 10;

function grid(prefix = ''): PinDef[] {
  const pins: PinDef[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) pins.push({ id: `${prefix}${String.fromCharCode(65 + r)}${c + 1}`, x: X0 + c * 10, y: Y0 + r * 10, kind: 'socket', label: `Row ${String.fromCharCode(65 + r)}, hole ${c + 1}` });
  return pins;
}
const W = X0 * 2 + (COLS - 1) * 10, H = Y0 * 2 + (ROWS - 1) * 10;

const Holes = memo(function Holes({ strips }: { strips: boolean }) {
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} rx={3} fill={strips ? '#d8b98a' : '#3f8f5a'} stroke="rgba(0,0,0,.3)" strokeWidth={0.8} />
      {strips && Array.from({ length: ROWS }, (_, r) => <rect key={r} x={X0 - 5} y={Y0 + r * 10 - 3.6} width={W - 2 * X0 + 10} height={7.2} rx={1} fill="#c98a3c" opacity={0.85} />)}
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => (
          <g key={`${r}-${c}`}>
            {!strips && <circle cx={X0 + c * 10} cy={Y0 + r * 10} r={3.2} fill="#d9a54a" />}
            <circle cx={X0 + c * 10} cy={Y0 + r * 10} r={1.5} fill="#1b1d20" />
          </g>
        )),
      )}
      {Array.from({ length: ROWS }, (_, r) => <Label key={r} x={4} y={Y0 + r * 10 + 1.6} size={4} fill={strips ? '#6b4e22' : '#d8f0dc'}>{String.fromCharCode(65 + r)}</Label>)}
    </g>
  );
});

function surface(type: string, name: string, strips: boolean, description: string): ComponentDef {
  const pins = grid();
  const groups = strips ? Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => `${String.fromCharCode(65 + r)}${c + 1}`)) : [];
  return {
    type, name, category: 'boards', description,
    keywords: strips ? ['stripboard', 'veroboard', 'prototype pcb', 'protoboard', 'solder'] : ['perfboard', 'perf board', 'dot board', 'prototype', 'solder'],
    bounds: { x: 0, y: 0, w: W, h: H },
    pins: () => pins,
    internalConnections: () => groups,
    defaultProps: {},
    layer: 0,
    render: () => <Holes strips={strips} />,
    schematic: () => null,
  };
}

export const perfboard = surface('perfboard', 'Perfboard', false,
  'Solderable dot board (24 × 16 holes, 0.1" pitch): every hole is isolated — parts plug in like on a breadboard, and you make the connections yourself with wires. Good for making a circuit permanent.');
export const stripboard = surface('stripboard', 'Prototype PCB (stripboard)', true,
  'Stripboard / Veroboard: each lettered row (24 holes) is a copper strip, so parts in the same row are connected — cut strips mentally by using separate rows. The classic way to turn a breadboard circuit into a soldered one.');

const SOCKETS = [8, 14, 16, 18, 20, 28, 40];

function socketPins(n: number): PinDef[] {
  const half = n / 2, gap = n >= 24 ? 60 : 30;
  const out: PinDef[] = [];
  for (let i = 0; i < n; i++) {
    const bottom = i < half;
    const x = bottom ? i * 10 : (n - 1 - i) * 10, y = bottom ? gap : 0;
    out.push({ id: `S${i + 1}`, x, y, kind: 'socket', label: `Socket pin ${i + 1}` });
    out.push({ id: `L${i + 1}`, x, y, kind: 'lead', label: `Leg ${i + 1}` });
  }
  return out;
}

export const icSocket: ComponentDef = {
  type: 'ic-socket', name: 'IC socket (DIP)', category: 'boards',
  description: 'DIP socket (8–40 pins): solder the socket and plug the chip into it, so the chip can be swapped. Place it on a breadboard or perfboard, then drop a DIP chip on top — each socket contact is connected to the leg below it.',
  keywords: ['ic socket', 'dip socket', 'chip socket', 'zif', 'dil socket'],
  bounds: { x: -8, y: -6, w: 216, h: 72 },
  boundsFor: (p) => {
    const n = Number(p.pins ?? 8), gap = n >= 24 ? 60 : 30;
    return { x: -8, y: -6, w: (n / 2 - 1) * 10 + 16, h: gap + 12 };
  },
  pins: (p) => socketPins(Number(p.pins ?? 8)),
  internalConnections: (p) => Array.from({ length: Number(p.pins ?? 8) }, (_, i) => [`S${i + 1}`, `L${i + 1}`]),
  defaultProps: { pins: 8 },
  fields: [{ key: 'pins', label: 'Pins', kind: 'select', options: SOCKETS.map((n) => ({ value: n, label: `DIP-${n}` })) }],
  layer: 0.5,
  render: ({ props }) => {
    const n = Number(props.pins ?? 8), half = n / 2, gap = n >= 24 ? 60 : 30, w = (half - 1) * 10 + 16;
    return (
      <g>
        <rect x={-8} y={-6} width={w} height={gap + 12} rx={2} fill="#2b2d31" stroke="#111" strokeWidth={0.6} />
        <rect x={-2} y={8} width={w - 12} height={gap - 16} rx={1} fill="#1d1e21" />
        <path d={`M -8 ${gap / 2 - 4} A 4 4 0 0 1 -8 ${gap / 2 + 4}`} fill="#3b3d42" />
        {Array.from({ length: half }, (_, i) => (
          <g key={i}>
            <rect x={i * 10 - 2.5} y={-2.5} width={5} height={5} rx={1} fill="#c9a24a" />
            <rect x={i * 10 - 2.5} y={gap - 2.5} width={5} height={5} rx={1} fill="#c9a24a" />
            <circle cx={i * 10} cy={0} r={1.3} fill="#111" />
            <circle cx={i * 10} cy={gap} r={1.3} fill="#111" />
          </g>
        ))}
      </g>
    );
  },
  schematic: () => null,
};
