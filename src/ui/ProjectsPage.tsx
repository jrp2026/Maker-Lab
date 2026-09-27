import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import type { CircuitDoc } from '../model/types';
import { getDef } from '../components/registry';
import { transformOf, worldPins } from '../model/geometry';
import { loadDoc, showToast, useEditor } from '../model/store';
import { emptyDoc } from '../model/types';
import {
  deleteProject, duplicateProject, exportJson, importJson, listProjects, renameProject, saveProject, uniqueProjectName, type SavedProject,
} from '../model/persistence';
import { EXAMPLES } from '../examples';
import { docBounds, zoomToFit } from './viewport';
import { wirePath } from './ComponentView';
import { toggleSimulation } from '../sim/controller';

/** Is the "Your projects" page showing? */
export const useProjectsPage = create<{ open: boolean }>(() => ({ open: false }));
export const openProjects = () => useProjectsPage.setState({ open: true });
const closeProjects = () => useProjectsPage.setState({ open: false });

/** examples offered as starting points on the page */
const STARTERS = ['blink', 'button', 'intersection', 'half-adder', 'robot-avoider'];

function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} day${s < 86400 * 2 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString();
}

/** "Arduino Uno R3 · 5 parts · 7 wires" */
function summary(doc: CircuitDoc): string {
  const defs = doc.components.map((c) => getDef(c.type)).filter(Boolean);
  const board = defs.find((d) => d!.mcu)?.name;
  const parts = defs.filter((d) => d!.layer !== 0).length;
  return [board, `${parts} part${parts === 1 ? '' : 's'}`, `${doc.wires.length} wire${doc.wires.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
}

/** A small, static drawing of a circuit (breadboards first, then parts, then wires). */
const Thumb = memo(function Thumb({ doc }: { doc: CircuitDoc }) {
  const b = docBounds(doc);
  if (!b) return <div className="proj-thumb empty">Empty circuit</div>;
  const pad = 20;
  const comps = doc.components
    .map((c) => ({ c, def: getDef(c.type) }))
    .filter((x): x is { c: (typeof doc.components)[number]; def: NonNullable<ReturnType<typeof getDef>> } => !!x.def)
    .sort((a, z) => (a.def.layer === 0 ? 0 : 1) - (z.def.layer === 0 ? 0 : 1));
  const pinAt = new Map<string, { x: number; y: number }>();
  for (const { c, def } of comps) for (const p of worldPins(c, def)) pinAt.set(`${c.id}:${p.id}`, { x: p.wx, y: p.wy });
  return (
    <svg className="proj-thumb" viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
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

/** Open a circuit in the editor, offering to save unsaved changes to the current one first. */
function openDoc(doc: CircuitDoc) {
  const cur = useEditor.getState().doc;
  const saved = listProjects().find((p) => p.name === cur.name);
  const dirty = cur.components.length > 0 && (!saved || JSON.stringify(saved.doc) !== JSON.stringify(cur));
  if (dirty && cur !== doc && window.confirm(`Save your current circuit “${cur.name}” before opening another one?\n\nOK = save it, Cancel = open without saving.`)) {
    saveProject(cur);
  }
  if (useEditor.getState().running) toggleSimulation();
  loadDoc(structuredClone(doc), { keepHistory: true });
  requestAnimationFrame(() => zoomToFit(useEditor.getState().doc));
  closeProjects();
}

function ProjectCard({ p, current, onChange }: { p: SavedProject; current: boolean; onChange: () => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, [menu]);
  const act = (fn: () => void) => () => {
    setMenu(false);
    fn();
    onChange();
  };
  return (
    <div className={`proj-card${current ? ' current' : ''}`}>
      <button className="proj-open" onClick={() => openDoc(p.doc)} title={`Open “${p.name}”`}>
        <Thumb doc={p.doc} />
        <div className="proj-info">
          <b>{p.name}</b>
          <span>{summary(p.doc)}</span>
          <span className="muted">{current ? 'Open now · ' : ''}saved {ago(p.savedAt)}</span>
        </div>
      </button>
      <div className="proj-more" ref={ref}>
        <button className="icon-btn" aria-label={`More for ${p.name}`} title="More" onClick={() => setMenu(!menu)}>⋯</button>
        {menu && (
          <div className="menu-pop proj-menu">
            <button className="menu-item" onClick={act(() => openDoc(p.doc))}><b>Open</b></button>
            <button className="menu-item" onClick={act(() => {
              const to = window.prompt('New name:', p.name)?.trim();
              if (!to || to === p.name) return;
              if (!renameProject(p.name, to)) return showToast(`There is already a project called “${to}”`, 'error');
              const cur = useEditor.getState().doc;
              if (cur.name === p.name) useEditor.setState({ doc: { ...cur, name: to } });
            })}><b>Rename…</b></button>
            <button className="menu-item" onClick={act(() => {
              const copy = duplicateProject(p.name);
              if (copy) showToast(`Copied as “${copy}”`);
            })}><b>Duplicate</b></button>
            <button className="menu-item" onClick={act(() => exportJson(p.doc))}><b>Download .json</b></button>
            <div className="menu-sep" />
            <button className="menu-item danger" onClick={act(() => {
              if (window.confirm(`Delete “${p.name}”? This can't be undone.`)) deleteProject(p.name);
            })}><b>Delete</b></button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-page list of the circuits saved in this browser. */
export function ProjectsPage() {
  const open = useProjectsPage((s) => s.open);
  const doc = useEditor((s) => s.doc);
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const fileRef = useRef<HTMLInputElement>(null);
  const projects = useMemo(() => (open ? listProjects() : []), [open, version]);
  // built once per opening: the starter examples' circuits (for their previews)
  const starters = useMemo(
    () => (open ? STARTERS.map((id) => EXAMPLES.find((e) => e.id === id)).filter((e) => !!e).map((ex) => ({ ex, doc: ex.build() })) : []),
    [open],
  );
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeProjects();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!open) return null;

  const query = q.trim().toLowerCase();
  const shown = projects
    .filter((p) => !query || p.name.toLowerCase().includes(query) || summary(p.doc).toLowerCase().includes(query))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.savedAt - a.savedAt));
  const savedCurrent = projects.find((p) => p.name === doc.name);
  const unsaved = doc.components.length > 0 && (!savedCurrent || JSON.stringify(savedCurrent.doc) !== JSON.stringify(doc));

  return (
    <div className="projects-page" role="dialog" aria-label="Your projects">
      <div className="projects-inner">
        <header className="projects-head">
          <div>
            <h2>Your projects</h2>
            <p className="muted">Saved in this browser · {projects.length} project{projects.length === 1 ? '' : 's'}</p>
          </div>
          <span className="grow" />
          <button className="btn" onClick={() => fileRef.current?.click()}>⇪ Import .json</button>
          <button className="btn primary" onClick={() => openDoc({ ...emptyDoc(), name: uniqueProjectName('Untitled circuit') })}>＋ New circuit</button>
          <button className="btn" title="Back to the editor (Esc)" onClick={closeProjects}>← Editor</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const d = await importJson(f);
              const name = uniqueProjectName(d.name);
              saveProject({ ...d, name });
              setVersion((v) => v + 1);
              showToast(`Imported “${name}”`);
            } catch (err) {
              showToast(`Could not import: ${(err as Error).message}`, 'error');
            }
          }} />
        </header>

        {unsaved && (
          <div className="proj-unsaved">
            <span>“{doc.name}” in the editor has unsaved changes.</span>
            <button className="btn primary" onClick={() => { saveProject(doc); setVersion((v) => v + 1); showToast(`Saved “${doc.name}”`); }}>Save it</button>
          </div>
        )}

        {projects.length > 0 ? (
          <>
            <div className="proj-tools">
              <div className="search">
                <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <input placeholder="Search your projects…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="cat-select" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} aria-label="Sort">
                <option value="recent">Last saved</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="proj-grid">
              {shown.map((p) => <ProjectCard key={p.name} p={p} current={p.name === doc.name} onChange={() => setVersion((v) => v + 1)} />)}
            </div>
            {!shown.length && <p className="muted pad">No project matches “{q}”.</p>}
          </>
        ) : (
          <div className="proj-empty">
            <h3>No saved projects yet</h3>
            <p className="muted">Build something and press <kbd>Ctrl</kbd>+<kbd>S</kbd> (or File → Save to browser) — it will show up here.</p>
          </div>
        )}

        <h3 className="proj-section">Start from an example</h3>
        <div className="proj-grid small">
          {starters.map(({ ex, doc: d }) => (
            <div key={ex.id} className="proj-card">
              <button className="proj-open" onClick={() => openDoc(ex.build())} title={ex.description}>
                <Thumb doc={d} />
                <div className="proj-info">
                  <b>{ex.name}</b>
                  <span className="muted">{ex.group ?? 'Getting started'}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
