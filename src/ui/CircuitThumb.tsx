import { memo } from 'react';
import type { CircuitDoc } from '../model/types';
import { getDef } from '../components/registry';
import { transformOf, worldPins } from '../model/geometry';
import { docBounds } from './viewport';
import { wirePath } from './ComponentView';

/** A small, static drawing of a circuit (breadboards first, then parts, then wires). */
export const CircuitThumb = memo(function CircuitThumb({ doc, className = 'proj-thumb' }: { doc: CircuitDoc; className?: string }) {
  const b = docBounds(doc);
  if (!b) return <div className={`${className} empty`}>Empty circuit</div>;
  const pad = 20;
  const comps = doc.components
    .map((c) => ({ c, def: getDef(c.type) }))
    .filter((x): x is { c: (typeof doc.components)[number]; def: NonNullable<ReturnType<typeof getDef>> } => !!x.def)
    .sort((a, z) => (a.def.layer === 0 ? 0 : 1) - (z.def.layer === 0 ? 0 : 1));
  const pinAt = new Map<string, { x: number; y: number }>();
  for (const { c, def } of comps) for (const p of worldPins(c, def)) pinAt.set(`${c.id}:${p.id}`, { x: p.wx, y: p.wy });
  return (
    <svg className={className} viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {comps.map(({ c, def }) => (
        <g key={c.id} transform={transformOf(c, def)}>{def.render({ comp: c, props: c.props })}</g>
      ))}
      {doc.wires.map((w) => {
        const a = pinAt.get(`${w.a.comp}:${w.a.pin}`), z = pinAt.get(`${w.b.comp}:${w.b.pin}`);
        if (!a || !z) return null;
        return <path key={w.id} d={wirePath([a, ...w.points, z])} fill="none" stroke={w.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
});
