import { memo, useMemo, useState } from 'react';
import { CATALOG } from '../components/catalog';
import { DEFS, getDef } from '../components/registry';
import { boundsOf } from '../components/types';
import { addComponent, showToast } from '../model/store';
import { getCanvasSize, useViewport } from './viewport';
import type { ComponentInstance } from '../model/types';
import { forgetPart, useAiParts } from '../ai/library';
import { AiPartDialog } from './AiPartDialog';

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

type Entry = { name: string; type?: string; phase?: number; category: string; saved?: boolean };

function LibItem({ e }: { e: Entry }) {
  const def = getDef(e.type!);
  if (!def) return null;
  return (
    <button
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
      {e.saved && (
        <em
          className="lib-del"
          title="Remove from My AI parts"
          onClick={(ev) => {
            ev.stopPropagation();
            forgetPart(e.type!);
          }}
        >
          ✕
        </em>
      )}
    </button>
  );
}

function PlannedList({ items, open, onToggle }: { items: Entry[]; open: boolean; onToggle: () => void }) {
  if (!items.length) return null;
  return (
    <div className="planned">
      <button className="planned-toggle" onClick={onToggle}>
        {open ? '▾' : '▸'} On the roadmap ({items.length})
      </button>
      {open && (
        <ul>
          {items.map((e) => (
            <li key={e.name} onClick={() => showToast(`${e.name} is planned for Phase ${e.phase}.`)}>
              <span>{e.name}</span>
              <em className={`phase p${e.phase}`}>Phase {e.phase}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every ready part grouped by category (no duplicates), plus the whole roadmap. */
function allSections(aiEntries: Entry[]) {
  const seen = new Set<string>();
  const sections: { name: string; entries: Entry[] }[] = [];
  const planned: Entry[] = [];
  const seenPlanned = new Set<string>();
  for (const c of CATALOG) {
    if (c.id === 'basic') continue;
    const entries: Entry[] = [];
    for (const e of c.entries) {
      if (e.type) {
        if (seen.has(e.type)) continue;
        seen.add(e.type);
        entries.push({ ...e, category: c.name });
      } else if (!seenPlanned.has(e.name)) {
        seenPlanned.add(e.name);
        planned.push({ ...e, category: c.name });
      }
    }
    if (entries.length) sections.push({ name: c.name, entries });
  }
  // parts that exist but aren't listed in the catalog still show up
  const rest = DEFS.filter((d) => !seen.has(d.type)).map((d) => ({ name: d.name, type: d.type, category: 'Other' }));
  if (rest.length) sections.push({ name: 'Other', entries: rest });
  if (aiEntries.length) sections.push({ name: '✨ AI parts', entries: aiEntries });
  return { sections, planned, count: sections.reduce((n, s) => n + s.entries.length, 0) };
}

export function LibraryPanel() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('basic');
  const [showPlanned, setShowPlanned] = useState(true);
  const [showAllPlanned, setShowAllPlanned] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const saved = useAiParts((s) => s.saved);
  const known = useAiParts((s) => s.known);
  const aiEntries = useMemo(() => {
    const list = [...saved, ...Object.values(known).filter((k) => !saved.some((s) => s.type === k.type))];
    return list.map((p) => ({ name: p.name, type: p.type, category: '✨ AI parts', saved: saved.some((s) => s.type === p.type) }));
  }, [saved, known]);

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
    for (const e of aiEntries) if (`${e.name} ai`.toLowerCase().includes(query)) out.unshift(e);
    return out.sort((a, b) => Number(!a.type) - Number(!b.type));
  }, [q, aiEntries]);

  const all = useMemo(() => allSections(aiEntries), [aiEntries]);
  const showAll = !results && cat === 'all';
  const current = CATALOG.find((c) => c.id === cat);
  const entries: Entry[] =
    results ?? (cat === 'ai' ? aiEntries : cat === 'all' ? [] : current!.entries.map((e) => ({ ...e, category: current!.name })));
  const available = entries.filter((e) => e.type);
  const planned = entries.filter((e) => !e.type);

  return (
    <aside className="library">
      <div className="panel-head">
        <h3>Components</h3>
        <span className="muted small">{DEFS.length} ready · {CATALOG.reduce((n, c) => n + c.entries.filter((e) => !e.type).length, 0)} planned</span>
      </div>
      <button className="ai-cta" onClick={() => setAiOpen(true)}>
        <span>✨</span>
        <div>
          <b>Make a part with AI</b>
          <small>Claude · ChatGPT · Gemini · Ollama · LM Studio</small>
        </div>
      </button>
      {aiOpen && <AiPartDialog onClose={() => { setAiOpen(false); if (useAiParts.getState().saved.length) setCat('ai'); }} />}
      <div className="search">
        <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <input placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear" onClick={() => setQ('')}>×</button>}
      </div>
      {!results && (
        <select className="cat-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All components ({all.count})</option>
          <option value="ai">✨ AI parts ({aiEntries.length})</option>
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
        {results && !results.length && <p className="muted small pad">No components match “{q}”. <button className="link" onClick={() => setAiOpen(true)}>Ask AI to make it ✨</button></p>}
        {!results && cat === 'ai' && !aiEntries.length && (
          <p className="muted small pad">No AI parts yet. Click <b>Make a part with AI</b> above — e.g. “7805 voltage regulator”.</p>
        )}
        {showAll ? (
          <>
            {all.sections.map((sec) => (
              <section key={sec.name} className="lib-section">
                <h4>
                  {sec.name} <span>{sec.entries.length}</span>
                </h4>
                <div className="lib-grid">
                  {sec.entries.map((e) => <LibItem key={e.type} e={e} />)}
                </div>
              </section>
            ))}
            <PlannedList items={all.planned} open={showAllPlanned} onToggle={() => setShowAllPlanned(!showAllPlanned)} />
          </>
        ) : (
          <>
            <div className="lib-grid">
              {available.map((e) => <LibItem key={e.type} e={e} />)}
            </div>
            <PlannedList items={planned} open={showPlanned} onToggle={() => setShowPlanned(!showPlanned)} />
          </>
        )}
      </div>
    </aside>
  );
}
