import { memo, useMemo, useState } from 'react';
import { CATALOG } from '../components/catalog';
import { DEFS, getDef } from '../components/registry';
import { boundsOf } from '../components/types';
import { addComponent, showToast } from '../model/store';
import { getCanvasSize, useViewport } from './viewport';
import type { ComponentInstance } from '../model/types';

const Thumb = memo(function Thumb({ type }: { type: string }) {
  const def = getDef(type);
  if (!def) return null;
  const b = boundsOf(def, def.defaultProps);
  const pad = 4;
  const comp: ComponentInstance = { id: 'thumb', type, x: 0, y: 0, rot: 0, flip: false, props: def.defaultProps };
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} className="thumb-svg" aria-hidden>
      {def.render({ comp, props: def.defaultProps })}
    </svg>
  );
});

function placeAtCenter(type: string) {
  const def = getDef(type);
  if (!def) return;
  const v = useViewport.getState();
  const { w, h } = getCanvasSize();
  const cx = (w / 2 - v.x) / v.s, cy = (h / 2 - v.y) / v.s;
  const b = boundsOf(def, def.defaultProps);
  addComponent(type, cx - (b.x + b.w / 2), cy - (b.y + b.h / 2));
}

export function LibraryPanel() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('basic');
  const [showPlanned, setShowPlanned] = useState(true);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const seen = new Set<string>();
    const out: { name: string; type?: string; phase?: number; category: string }[] = [];
    for (const c of CATALOG) {
      for (const e of c.entries) {
        const def = e.type ? getDef(e.type) : undefined;
        const hay = [e.name, c.name, def?.description ?? '', ...(def?.keywords ?? [])].join(' ').toLowerCase();
        if (!hay.includes(query)) continue;
        const key = e.type ?? e.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...e, category: c.name });
      }
    }
    return out.sort((a, b) => Number(!a.type) - Number(!b.type));
  }, [q]);

  const current = CATALOG.find((c) => c.id === cat)!;
  const entries = results ?? current.entries.map((e) => ({ ...e, category: current.name }));
  const available = entries.filter((e) => e.type);
  const planned = entries.filter((e) => !e.type);

  return (
    <aside className="library">
      <div className="panel-head">
        <h3>Components</h3>
        <span className="muted small">{DEFS.length} ready · {CATALOG.reduce((n, c) => n + c.entries.filter((e) => !e.type).length, 0)} planned</span>
      </div>
      <div className="search">
        <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <input placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear" onClick={() => setQ('')}>×</button>}
      </div>
      {!results && (
        <select className="cat-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATALOG.map((c) => {
            const ready = c.entries.filter((e) => e.type).length;
            return (
              <option key={c.id} value={c.id}>
                {c.name} {ready ? `(${ready})` : '— planned'}
              </option>
            );
          })}
        </select>
      )}
      <div className="lib-scroll">
        {results && !results.length && <p className="muted small pad">No components match “{q}”.</p>}
        <div className="lib-grid">
          {available.map((e) => {
            const def = getDef(e.type!)!;
            return (
              <button
                key={e.type}
                className="lib-item"
                draggable
                title={`${def.description}\n\nDrag onto the canvas, or click to add.`}
                onDragStart={(ev) => {
                  ev.dataTransfer.setData('text/x-component', e.type!);
                  ev.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => placeAtCenter(e.type!)}
              >
                <div className="thumb"><Thumb type={e.type!} /></div>
                <span>{e.name}</span>
              </button>
            );
          })}
        </div>
        {planned.length > 0 && (
          <div className="planned">
            <button className="planned-toggle" onClick={() => setShowPlanned(!showPlanned)}>
              {showPlanned ? '▾' : '▸'} On the roadmap ({planned.length})
            </button>
            {showPlanned && (
              <ul>
                {planned.map((e) => (
                  <li key={e.name} onClick={() => showToast(`${e.name} is planned for Phase ${e.phase}.`)}>
                    <span>{e.name}</span>
                    <em className={`phase p${e.phase}`}>Phase {e.phase}</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
