import { Fragment, useEffect, useRef, useState } from 'react';
import {
  deleteSelection, flipSelection, loadDoc, redo, rotateSelection, showToast, undo, updateDoc, useEditor,
} from '../model/store';
import { toggleSimulation, useSimView } from '../sim/controller';
import { EXAMPLES } from '../examples';
import { deleteProject, exportJson, exportPng, importJson, listProjects, saveProject, shareLink } from '../model/persistence';
import { emptyDoc } from '../model/types';
import { docBounds, zoomBy, zoomToFit } from './viewport';

function Menu({ label, children, icon }: { label: string; icon?: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button className={`btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
        {icon && <span className="ico">{icon}</span>}
        {label} <span className="caret">▾</span>
      </button>
      {open && <div className="menu-pop">{children(() => setOpen(false))}</div>}
    </div>
  );
}

function SimClock() {
  const t = useSimView((s) => s.snap?.time ?? 0);
  const slow = useSimView((s) => s.snap?.slow);
  const m = Math.floor(t / 60);
  const sec = (t % 60).toFixed(1).padStart(4, '0');
  return (
    <span className={`sim-clock${slow ? ' slow' : ''}`} title={slow ? 'Simulation is running slower than real time' : 'Simulated time'}>
      {String(m).padStart(2, '0')}:{sec}
    </span>
  );
}

export function Toolbar() {
  const doc = useEditor((s) => s.doc);
  const running = useEditor((s) => s.running);
  const view = useEditor((s) => s.view);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSel = useEditor((s) => s.selection.comps.length > 0 || !!s.selection.wire);
  const codeOpen = useEditor((s) => s.codeOpen);
  const muted = useEditor((s) => s.muted);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    if (running) toggleSimulation();
    loadDoc(ex.build(), { keepHistory: true });
    requestAnimationFrame(() => zoomToFit(useEditor.getState().doc));
  };

  // the toolbar wraps onto several rows on phones; panels that sit under it need its height
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header className="toolbar" ref={headerRef}>
      <div className="brand">
        <div className="logo" aria-hidden>
          <svg viewBox="0 0 32 32" width="26" height="26"><rect width="32" height="32" rx="8" fill="#00a39a" /><path d="M6 16h6l2-6 4 12 2-6h6" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <span className="brand-name">MakerLab</span>
        <input className="doc-name" value={doc.name} onChange={(e) => updateDoc((d) => ({ ...d, name: e.target.value }))} aria-label="Project name" spellCheck={false} />
      </div>

      <div className="tool-group">
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}>↶</button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>↷</button>
        <span className="sep" />
        <button className="icon-btn" title="Rotate (R)" disabled={!hasSel} onClick={() => rotateSelection(1)}>⟳</button>
        <button className="icon-btn" title="Flip (F)" disabled={!hasSel} onClick={flipSelection}>⇋</button>
        <button className="icon-btn" title="Delete (Del)" disabled={!hasSel} onClick={deleteSelection}>🗑</button>
        <span className="sep" />
        <button className="icon-btn" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <button className="icon-btn" title="Zoom to fit" onClick={() => zoomToFit(doc)}>⤢</button>
        <button className="icon-btn" title="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
      </div>

      <div className="view-toggle" role="tablist">
        <button className={view === 'breadboard' ? 'on' : ''} onClick={() => useEditor.setState({ view: 'breadboard' })}>Breadboard</button>
        <button className={view === 'schematic' ? 'on' : ''} onClick={() => useEditor.setState({ view: 'schematic' })}>Schematic</button>
      </div>

      <span className="grow" />

      <Menu label="Examples" icon="✦">
        {(close) => (
          <>
            {EXAMPLES.map((ex, i) => {
              const group = ex.group ?? 'Getting started';
              const heading = i === 0 || group !== (EXAMPLES[i - 1].group ?? 'Getting started');
              return (
                <Fragment key={ex.id}>
                  {heading && <div className="menu-heading">{group}</div>}
                  <button className="menu-item" onClick={() => { loadExample(ex.id); close(); }}>
                    <b>{ex.name}</b>
                    <span>{ex.description}</span>
                  </button>
                </Fragment>
              );
            })}
          </>
        )}
      </Menu>

      <Menu label="File" icon="▤">
        {(close) => (
          <>
            <button className="menu-item" onClick={() => { if (running) toggleSimulation(); loadDoc(emptyDoc(), { keepHistory: true }); close(); }}><b>New circuit</b></button>
            <button className="menu-item" onClick={() => { saveProject(doc); showToast(`Saved “${doc.name}” in this browser`); close(); }}><b>Save to browser</b><span>Ctrl+S</span></button>
            {listProjects().length > 0 && <div className="menu-sub">Open saved</div>}
            {listProjects().map((p) => (
              <div key={p.name} className="menu-item row-item">
                <button className="link grow-left" onClick={() => { if (running) toggleSimulation(); loadDoc(p.doc, { keepHistory: true }); requestAnimationFrame(() => zoomToFit(p.doc)); close(); }}>
                  {p.name} <em>{new Date(p.savedAt).toLocaleString()}</em>
                </button>
                <button className="link danger" title="Delete" onClick={() => { deleteProject(p.name); close(); }}>✕</button>
              </div>
            ))}
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { exportJson(doc); close(); }}><b>Export .json</b></button>
            <button className="menu-item" onClick={() => { fileRef.current?.click(); close(); }}><b>Import .json…</b></button>
            <button className="menu-item" onClick={async () => {
              close();
              const svg = document.querySelector('svg.canvas') as SVGSVGElement | null;
              const b = docBounds(doc);
              if (!svg || !b) return showToast('Nothing to export yet', 'error');
              try {
                await exportPng(svg, b, doc.name);
              } catch (e) {
                showToast(String((e as Error).message), 'error');
              }
            }}><b>Export image (.png)</b></button>
          </>
        )}
      </Menu>

      <button className="btn" onClick={async () => {
        const url = await shareLink(doc);
        try {
          await navigator.clipboard.writeText(url);
          showToast('Share link copied to clipboard');
        } catch {
          window.prompt('Copy this link:', url);
        }
      }} title="Copy a link that contains this whole circuit">⤴ Share</button>

      <button className={`icon-btn${muted ? '' : ' on'}`} title={muted ? 'Sound off' : 'Sound on'} onClick={() => useEditor.setState({ muted: !muted })}>{muted ? '🔇' : '🔊'}</button>

      <button className={`btn${codeOpen ? ' active' : ''}`} onClick={() => useEditor.setState({ codeOpen: !codeOpen })}>{'</>'} Code</button>

      {running && <SimClock />}
      <button className={`btn sim-btn${running ? ' running' : ''}`} onClick={toggleSimulation} aria-label={running ? 'Stop Simulation' : 'Start Simulation'}>
        {running ? '■' : '▶'} <span className="lbl-lg">{running ? 'Stop Simulation' : 'Start Simulation'}</span>
        <span className="lbl-sm">{running ? 'Stop' : 'Run'}</span>
      </button>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          const d = await importJson(f);
          if (running) toggleSimulation();
          loadDoc(d, { keepHistory: true });
          requestAnimationFrame(() => zoomToFit(d));
        } catch (err) {
          showToast(`Import failed: ${(err as Error).message}`, 'error');
        }
      }} />
    </header>
  );
}
