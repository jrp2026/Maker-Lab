import { memo } from 'react';
import type { ComponentInstance, Point, Wire } from '../model/types';
import { getDef } from '../components/registry';
import { transformOf, worldBounds, localToWorld } from '../model/geometry';
import { useSimView } from '../sim/controller';
import type { ViewMode } from '../model/store';

export const ComponentView = memo(function ComponentView({ comp, view, selected, running }: { comp: ComponentInstance; view: ViewMode; selected: boolean; running: boolean }) {
  const def = getDef(comp.type);
  const sim = useSimView((s) => s.snap?.comps[comp.id]);
  if (!def) return null;
  if (view === 'schematic' && def.layer === 0) return null;
  const body = view === 'schematic' ? def.schematic({ comp, props: comp.props, sim }) : def.render({ comp, props: comp.props, sim });
  const b = def.bounds;
  const interactive = running && def.interactive;
  return (
    <g
      transform={transformOf(comp, def)}
      data-kind="comp"
      data-id={comp.id}
      className={`comp${interactive ? ' interactive' : ''}${selected ? ' selected' : ''}`}
    >
      {/* hit area */}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />
      {body}
      {selected && <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} rx={4} fill="none" stroke="#1e88e5" strokeWidth={1.2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'none' }} />}
    </g>
  );
});

export function WarningBadge({ comp, level, messages }: { comp: ComponentInstance; level: 'error' | 'warn'; messages: string[] }) {
  const def = getDef(comp.type);
  if (!def) return null;
  const b = worldBounds(comp, def);
  const x = b.x + b.w, y = b.y;
  return (
    <g className={`warn-badge ${level}`} transform={`translate(${x} ${y})`} data-kind="badge" data-id={comp.id}>
      <title>{messages.join('\n')}</title>
      <circle r={9} className="pulse" />
      <circle r={7} fill={level === 'error' ? '#e53935' : '#f59e0b'} stroke="#fff" strokeWidth={1.5} />
      <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>!</text>
    </g>
  );
}

export function wirePath(pts: Point[]): string {
  if (pts.length < 2) return '';
  const r = 6;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1], p = pts[i], p1 = pts[i + 1];
    const l0 = Math.hypot(p.x - p0.x, p.y - p0.y), l1 = Math.hypot(p1.x - p.x, p1.y - p.y);
    const k0 = Math.min(r, l0 / 2) / (l0 || 1), k1 = Math.min(r, l1 / 2) / (l1 || 1);
    d += ` L${p.x - (p.x - p0.x) * k0} ${p.y - (p.y - p0.y) * k0} Q${p.x} ${p.y} ${p.x + (p1.x - p.x) * k1} ${p.y + (p1.y - p.y) * k1}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last.x} ${last.y}`;
  return d;
}

function flowDuration(i: number) {
  const a = Math.abs(i);
  // ~0.1 mA → slow, ~100 mA → fast
  const t = 2.4 - 0.55 * Math.log10(a / 1e-4 + 1) * 2;
  return Math.max(0.18, Math.min(2.4, t));
}

export const WireView = memo(function WireView({ wire, pts, selected, flow }: { wire: Wire; pts: Point[]; selected: boolean; flow: number }) {
  const d = wirePath(pts);
  const white = wire.color.toLowerCase() === '#ffffff';
  const showFlow = Math.abs(flow) > 2e-5;
  return (
    <g data-kind="wire" data-id={wire.id} className={`wire${selected ? ' selected' : ''}`}>
      <path d={d} className="wire-hit" />
      {selected && <path d={d} fill="none" stroke="#1e88e5" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} style={{ pointerEvents: 'none' }} />}
      <path d={d} fill="none" stroke={white ? '#9aa3ad' : 'rgba(0,0,0,.45)'} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
      <path d={d} fill="none" stroke={wire.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
      <path d={d} fill="none" stroke="#fff" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} transform="translate(-0.4 -0.5)" style={{ pointerEvents: 'none' }} />
      {showFlow && (
        <path
          d={d}
          className={`flow ${flow < 0 ? 'rev' : ''}`}
          style={{ animationDuration: `${flowDuration(flow)}s`, pointerEvents: 'none' }}
        />
      )}
      <circle cx={pts[0].x} cy={pts[0].y} r={1.9} fill={wire.color} stroke="rgba(0,0,0,.5)" strokeWidth={0.6} style={{ pointerEvents: 'none' }} />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={1.9} fill={wire.color} stroke="rgba(0,0,0,.5)" strokeWidth={0.6} style={{ pointerEvents: 'none' }} />
    </g>
  );
});

/** Resolve a pin's world position. */
export function pinWorld(comp: ComponentInstance, pinId: string): Point | null {
  const def = getDef(comp.type);
  if (!def) return null;
  const p = def.pins(comp.props).find((x) => x.id === pinId);
  if (!p) return null;
  return localToWorld(comp, def, p);
}
