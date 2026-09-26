import { useEffect } from 'react';
import { Toolbar } from './ui/Toolbar';
import { Canvas } from './ui/Canvas';
import { LibraryPanel } from './ui/LibraryPanel';
import { Inspector } from './ui/Inspector';
import { CodePanel } from './ui/CodePanel';
import { IssuesBar } from './ui/IssuesBar';
import {
  copySelection, deleteSelection, flipSelection, loadDoc, paste, redo, rotateSelection, select, showToast, undo, useEditor,
} from './model/store';
import { autosave, docFromHash, loadAutosave, saveProject } from './model/persistence';
import { EXAMPLES } from './examples';
import { zoomToFit } from './ui/viewport';
import { toggleSimulation } from './sim/controller';

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('.cm-editor');
}

export function App() {
  const codeOpen = useEditor((s) => s.codeOpen);
  const toast = useEditor((s) => s.toast);
  const running = useEditor((s) => s.running);

  // initial document: share link > autosave > first example
  useEffect(() => {
    (async () => {
      let doc = null;
      try {
        doc = await docFromHash(location.hash);
        if (doc) history.replaceState(null, '', location.pathname + location.search);
      } catch {
        showToast('That share link could not be read', 'error');
      }
      doc ??= loadAutosave();
      doc ??= EXAMPLES[0].build();
      loadDoc(doc);
      requestAnimationFrame(() => zoomToFit(doc!));
    })();
  }, []);

  // autosave
  useEffect(() => {
    let t = 0;
    return useEditor.subscribe((s, p) => {
      if (s.doc === p.doc) return;
      clearTimeout(t);
      t = window.setTimeout(() => autosave(s.doc), 400);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject(useEditor.getState().doc);
        showToast('Saved in this browser');
        return;
      }
      if (isTyping(e)) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        paste();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (copySelection()) paste();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        select({ comps: useEditor.getState().doc.components.map((c) => c.id) });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (!mod && e.key.toLowerCase() === 'r') {
        rotateSelection(e.shiftKey ? -1 : 1);
      } else if (!mod && e.key.toLowerCase() === 'f') {
        flipSelection();
      } else if (e.key === 'Escape') {
        select({});
      } else if (!mod && e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        toggleSimulation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app${running ? ' is-running' : ''}`}>
      <Toolbar />
      <main className="workspace">
        <div className="stage">
          <Canvas />
          <div className="overlay-right"><Inspector /></div>
          <IssuesBar />
        </div>
        {codeOpen ? <CodePanel /> : <LibraryPanel />}
      </main>
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}
