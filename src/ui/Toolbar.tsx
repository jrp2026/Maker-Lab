import { Fragment, useEffect, useRef, useState } from 'react';
import {
  copySelection, cutSelection, deleteSelection, flipSelection, hasClipboard, loadDoc, paste, redo, rotateSelection, select, showToast, undo,
  updateDoc, useEditor,
} from '../model/store';
import { MenuBar, type BarMenu } from './MenuBar';
import { toggleSimulation } from '../sim/controller';
import { EXAMPLES } from '../examples';
import { openWelcome } from './Onboarding';
import { openProjects } from './ProjectsPage';
import { exportJson, exportPng, importJson, listProjects, shareLink } from '../model/persistence';
import { openAccountDialog, saveAndReport, useAccount } from '../cloud/account';
import { emptyDoc } from '../model/types';
import { docBounds, zoomBy, zoomToFit } from './viewport';

function Menu({ label, children, icon, tour }: { label: string; icon?: string; tour?: string; children: (close: () => void) => React.ReactNode }) {
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
    <div className="menu" ref={ref} data-tour={tour}>
      <button className={`btn${open ? ' active' : ''}`} onClick={() => setOpen(!open)}>
        {icon && <span className="ico">{icon}</span>}
        {label} <span className="caret">▾</span>
      </button>
      {open && <div className="menu-pop">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Toolbar() {
  const accountStatus = useAccount((s) => s.status);
  const signedIn = useAccount((s) => s.status === 'signed-in' && s.verified);
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

  const exportImage = async () => {
    const svg = document.querySelector('svg.canvas') as SVGSVGElement | null;
    const b = docBounds(doc);
    if (!svg || !b) return showToast('Nothing to export yet', 'error');
    try {
      await exportPng(svg, b, doc.name);
    } catch (e) {
      showToast(String((e as Error).message), 'error');
    }
  };
  const exportKicad = async () => {
    if (!doc.components.length) return showToast('Nothing to export yet', 'error');
    try {
      const { downloadKicadProject } = await import('../kicad');
      showToast(downloadKicadProject(doc));
    } catch (e) {
      showToast(`KiCad export failed: ${(e as Error).message}`, 'error');
    }
  };
  const hasComps = useEditor((s) => s.selection.comps.length > 0);
  const menus: BarMenu[] = [
    {
      label: 'File', alt: 'f', items: () => [
        { label: 'New circuit', run: () => { if (running) toggleSimulation(); loadDoc(emptyDoc(), { keepHistory: true }); } },
        { label: 'Your projects…', keys: 'Ctrl+O', run: openProjects, title: `${listProjects().length} saved` },
        { label: signedIn ? 'Save' : 'Save to browser', keys: 'Ctrl+S', run: () => void saveAndReport(doc), title: signedIn ? 'Also saves to your account' : undefined },
        ...(accountStatus !== 'off' && !signedIn ? [{ label: 'Sign in to sync…', run: () => openAccountDialog('signin'), title: 'Save projects in the cloud' }] : []),
        'sep',
        { label: 'Import .json…', run: () => fileRef.current?.click() },
        { label: 'Export .json', run: () => exportJson(doc) },
        { label: 'Export image (.png)', run: () => void exportImage() },
        { label: 'Export KiCad project (.zip)', run: () => void exportKicad(), title: 'Schematic + symbols + footprints' },
      ],
    },
    {
      label: 'Edit', alt: 'e', items: () => [
        { label: 'Undo', keys: 'Ctrl+Z', disabled: !canUndo, run: undo },
        { label: 'Redo', keys: 'Ctrl+Y', disabled: !canRedo, run: redo },
        'sep',
        { label: 'Cut', keys: 'Ctrl+X', disabled: !hasComps, run: () => cutSelection() },
        { label: 'Copy', keys: 'Ctrl+C', disabled: !hasComps, run: () => copySelection() },
        { label: 'Paste', keys: 'Ctrl+V', disabled: !hasClipboard(), run: () => paste() },
        { label: 'Duplicate', keys: 'Ctrl+D', disabled: !hasComps, run: () => { if (copySelection()) paste(); } },
        { label: 'Delete', keys: 'Del', disabled: !hasSel, run: deleteSelection },
        'sep',
        { label: 'Select all', keys: 'Ctrl+A', disabled: !doc.components.length, run: () => select({ comps: doc.components.map((c) => c.id) }) },
        'sep',
        { label: 'Rotate right', keys: 'R', disabled: !hasComps, run: () => rotateSelection(1) },
        { label: 'Rotate left', keys: 'Shift+R', disabled: !hasComps, run: () => rotateSelection(-1) },
        { label: 'Flip', keys: 'F', disabled: !hasComps, run: flipSelection },
      ],
    },
  ];

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
        <button className="brand-home" onClick={openProjects} title="Your projects (Ctrl+O)" aria-label="Your projects">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="26" height="26"><rect width="32" height="32" rx="8" fill="#00a39a" /><path d="M6 16h6l2-6 4 12 2-6h6" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="brand-name">MakerLab</span>
        </button>
        <MenuBar menus={menus} />
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
        <button className="icon-btn zoom-btn" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <button className="icon-btn zoom-btn" title="Zoom to fit" onClick={() => zoomToFit(doc)}>⤢</button>
        <button className="icon-btn zoom-btn" title="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
      </div>

      <div className="view-toggle" role="tablist">
        <button className={view === 'breadboard' ? 'on' : ''} onClick={() => useEditor.setState({ view: 'breadboard' })}>Breadboard</button>
        <button className={view === 'schematic' ? 'on' : ''} onClick={() => useEditor.setState({ view: 'schematic' })}>Schematic</button>
      </div>

      <span className="grow" />

      <Menu label="Examples" icon="✦" tour="examples">
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

      <button className="btn" onClick={async () => {
        const url = await shareLink(doc);
        try {
          await navigator.clipboard.writeText(url);
          showToast('Share link copied to clipboard');
        } catch {
          window.prompt('Copy this link:', url);
        }
      }} title="Copy a link that contains this whole circuit" aria-label="Share">⤴ <span className="lbl-share">Share</span></button>

      <button className="icon-btn help-btn" data-tour="help" title="Help: welcome screen and tour" aria-label="Help" onClick={openWelcome}>?</button>
      <button className={`icon-btn${muted ? '' : ' on'}`} title={muted ? 'Sound off' : 'Sound on'} onClick={() => useEditor.setState({ muted: !muted })}>{muted ? '🔇' : '🔊'}</button>

      <button className={`btn${codeOpen ? ' active' : ''}`} data-tour="code" onClick={() => useEditor.setState({ codeOpen: !codeOpen })}>{'</>'} Code</button>

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
