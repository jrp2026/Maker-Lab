import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { EditorSelection } from '@codemirror/state';
import { getDef } from '../components/registry';
import { setPropSilent, useEditor } from '../model/store';
import { getSimulator, useSimView } from '../sim/controller';
import { McuRuntime, type McuError } from '../mcu/runtime';

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: '#fbfcfd' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: '#f1f4f7', borderRight: '1px solid #e2e7ec', color: '#9aa5b1' },
  '.cm-activeLine': { backgroundColor: '#eef6ff' },
  '.cm-activeLineGutter': { backgroundColor: '#e3eefa' },
});

function SerialMonitor({ target }: { target: string }) {
  const snap = useSimView((s) => s.snap);
  const running = useEditor((s) => s.running);
  const [input, setInput] = useState('');
  const [cleared, setCleared] = useState(0);
  const boxRef = useRef<HTMLPreElement>(null);
  const mcu = getSimulator()?.mcus.get(target);
  const text = mcu ? mcu.serialOut.slice(cleared > mcu.serialOut.length ? 0 : cleared) : '';
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, snap?.time]);
  useEffect(() => setCleared(0), [running]);
  const send = () => {
    if (mcu && input) mcu.serialIn += input + '\n';
    setInput('');
  };
  return (
    <div className="serial">
      <div className="serial-head">
        <span>Serial Monitor</span>
        <span className="muted small">{running ? (mcu?.spec.id === 'esp32' ? '115200 baud' : '9600 baud') : 'start the simulation to see output'}</span>
        <button className="link" onClick={() => setCleared(mcu?.serialOut.length ?? 0)}>Clear</button>
      </div>
      <pre ref={boxRef} className="serial-out">{text || (running ? '' : ' ')}</pre>
      <div className="serial-in">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={running ? 'Send to Serial…' : 'Not running'} disabled={!running} />
        <button className="btn" onClick={send} disabled={!running}>Send</button>
      </div>
    </div>
  );
}

export function CodePanel() {
  const doc = useEditor((s) => s.doc);
  const target = useEditor((s) => s.codeTarget);
  const running = useEditor((s) => s.running);
  const compileErrors = useEditor((s) => s.compileErrors);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [check, setCheck] = useState<{ ok: boolean; err?: McuError } | null>(null);

  const mcus = doc.components.filter((c) => getDef(c.type)?.mcu);
  const comp = mcus.find((c) => c.id === target) ?? mcus[0];
  const compId = comp?.id;
  const runtimeErr = useSimView((s) => (compId ? s.snap?.warnings.find((w) => w.comp === compId && /Runtime error/.test(w.message))?.message : undefined));

  useEffect(() => {
    if (!hostRef.current || !comp) return;
    const view = new EditorView({
      doc: String(comp.props.code ?? ''),
      extensions: [
        basicSetup,
        cpp(),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            setPropSilent(comp.id, 'code', u.state.doc.toString());
            setCheck(null);
          }
        }),
      ],
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
    // re-create the editor only when switching boards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compId]);

  // keep the editor in sync if the code changes from outside (undo, example load)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !comp) return;
    const code = String(comp.props.code ?? '');
    if (view.state.doc.toString() !== code) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
  }, [comp]);

  const err = (compId && compileErrors[compId]) || (check && !check.ok ? check.err : undefined);

  const goTo = (line?: number) => {
    const view = viewRef.current;
    if (!view || !line) return;
    const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
    view.dispatch({ selection: EditorSelection.range(l.from, l.to), scrollIntoView: true });
    view.focus();
  };

  const verify = () => {
    if (!comp) return;
    const rt = new McuRuntime(getDef(comp.type)!.mcu!.board);
    const e = rt.load(String(comp.props.code ?? ''));
    setCheck(e ? { ok: false, err: e } : { ok: true });
    if (e) goTo(e.line);
  };

  return (
    <aside className="code-panel">
      <div className="panel-head">
        <h3>Code</h3>
        {mcus.length > 1 && (
          <select value={compId} onChange={(e) => useEditor.setState({ codeTarget: e.target.value })}>
            {mcus.map((m, i) => <option key={m.id} value={m.id}>{getDef(m.type)!.name} #{i + 1}</option>)}
          </select>
        )}
        <span className="grow" />
        {comp && <button className="btn" onClick={verify} title="Compile without running">✓ Verify</button>}
        <button className="icon-btn" title="Close code panel" onClick={() => useEditor.setState({ codeOpen: false })}>✕</button>
      </div>
      {!comp ? (
        <div className="pad muted">
          <p>Add an <b>Arduino Uno</b> to the canvas to write code for it.</p>
        </div>
      ) : (
        <>
          <div className="code-meta">
            <span className="chip">Text (Arduino C++)</span>
            <span className="chip disabled" title="Block-based coding is planned">Blocks · soon</span>
            {running && <span className="muted small">Code changes apply when you restart the simulation.</span>}
          </div>
          {err && (
            <div className="code-error" onClick={() => goTo(err.line)}>
              <b>{err.kind === 'compile' ? 'Compile error' : 'Error'}{err.line ? ` · line ${err.line}` : ''}</b>
              <span>{err.message}</span>
            </div>
          )}
          {runtimeErr && <div className="code-error"><span>{runtimeErr}</span></div>}
          {check?.ok && <div className="code-ok">Compiled successfully.</div>}
          <div className="editor-host" ref={hostRef} />
          <SerialMonitor target={comp.id} />
        </>
      )}
    </aside>
  );
}
