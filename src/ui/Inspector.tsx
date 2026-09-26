import { useEffect, useState } from 'react';
import { getDef } from '../components/registry';
import type { PropField } from '../components/types';
import { WIRE_COLORS, deleteSelection, flipSelection, rotateSelection, setProp, updateWire, useEditor, beginGesture, endGesture } from '../model/store';
import { formatSI, parseSI } from '../components/util';
import type { ComponentInstance } from '../model/types';
import { getSimulator, useSimView } from '../sim/controller';

/** Queue text for a running part (it drains `input[key]` while simulating). */
function SendField({ comp, f }: { comp: ComponentInstance; f: Extract<PropField, { kind: 'send' }> }) {
  const running = useEditor((s) => s.running);
  const [text, setText] = useState('');
  const send = () => {
    const sim = getSimulator();
    if (!sim || !text) return;
    const inp = sim.input(comp.id);
    (inp[f.key] ??= [] as string[]).push(f.newline === false ? text : `${text}\r\n`);
    setText('');
  };
  return (
    <div className="send-row">
      <input value={text} placeholder={running ? f.placeholder ?? 'type and press Enter' : 'start the simulation first'} disabled={!running} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
      <button className="btn small" disabled={!running || !text} onClick={send}>Send</button>
    </div>
  );
}

function NumberField({ comp, f }: { comp: ComponentInstance; f: Extract<PropField, { kind: 'number' }> }) {
  const value = Number(comp.props[f.key]);
  const shown = f.si ? formatSI(value, '', 4) : String(value);
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => setText(shown), [shown]);
  const apply = () => {
    const v = f.si ? parseSI(text) : parseFloat(text);
    if (!Number.isFinite(v) || (f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
      setBad(true);
      return;
    }
    setBad(false);
    if (v !== value) setProp(comp.id, f.key, v);
  };
  return (
    <div className={`num-field${bad ? ' bad' : ''}`}>
      <input value={text} onChange={(e) => setText(e.target.value)} onBlur={apply} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} spellCheck={false} />
      {f.unit && <span className="unit">{f.unit}</span>}
    </div>
  );
}

function Field({ comp, f }: { comp: ComponentInstance; f: PropField }) {
  const v = comp.props[f.key];
  switch (f.kind) {
    case 'number':
      return <NumberField comp={comp} f={f} />;
    case 'select':
      return (
        <select value={String(v)} onChange={(e) => {
          const opt = f.options.find((o) => String(o.value) === e.target.value);
          if (opt) setProp(comp.id, f.key, opt.value);
        }}>
          {f.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
    case 'slider':
      return (
        <div className="slider-row">
          <input type="range" min={f.min} max={f.max} step={f.step} value={Number(v)} onPointerDown={beginGesture} onPointerUp={endGesture} onChange={(e) => setProp(comp.id, f.key, Number(e.target.value))} />
          <span className="slider-val">{f.unit ? `${+Number(v).toFixed(2)}${f.unit}` : f.max === 1 && f.min === 0 ? `${Math.round(Number(v) * 100)}%` : +Number(v).toFixed(2)}</span>
        </div>
      );
    case 'bool':
      return <input type="checkbox" checked={!!v} onChange={(e) => setProp(comp.id, f.key, e.target.checked)} />;
    case 'text':
      return <input value={String(v)} onChange={(e) => setProp(comp.id, f.key, e.target.value)} />;
    case 'send':
      return <SendField comp={comp} f={f} />;
  }
}

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const running = useEditor((s) => s.running);
  const warnings = useSimView((s) => s.snap?.warnings);

  if (selection.wire) {
    const wire = doc.wires.find((w) => w.id === selection.wire);
    if (!wire) return null;
    return (
      <div className="inspector">
        <div className="insp-head">
          <div>
            <h4>Wire</h4>
            <span className="muted small">{wire.a.pin} → {wire.b.pin}</span>
          </div>
          <button className="icon-btn danger" title="Delete wire (Del)" onClick={deleteSelection}>🗑</button>
        </div>
        <label className="field-label">Color</label>
        <div className="swatches">
          {WIRE_COLORS.map((c) => (
            <button key={c} className={`swatch${wire.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => {
              updateWire(wire.id, { color: c });
              useEditor.setState({ wireColor: c });
            }} title={c} />
          ))}
        </div>
        <p className="muted small">Drag the round handles to reshape; double-click the wire to add a bend, double-click a bend to remove it. Drag an end onto another pin to reconnect.</p>
      </div>
    );
  }

  if (selection.comps.length !== 1) {
    if (selection.comps.length > 1) {
      return (
        <div className="inspector">
          <div className="insp-head">
            <h4>{selection.comps.length} parts selected</h4>
            <div className="row">
              <button className="icon-btn" title="Rotate (R)" onClick={() => rotateSelection(1)}>⟳</button>
              <button className="icon-btn danger" title="Delete (Del)" onClick={deleteSelection}>🗑</button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }
  const comp = doc.components.find((c) => c.id === selection.comps[0]);
  if (!comp) return null;
  const def = getDef(comp.type)!;
  const myWarnings = (warnings ?? []).filter((w) => w.comp === comp.id);
  return (
    <div className="inspector">
      <div className="insp-head">
        <div>
          <h4>{def.name}</h4>
          {def.summary && <span className="muted small">{def.summary(comp.props)}</span>}
        </div>
        <div className="row">
          <button className="icon-btn" title="Rotate (R)" onClick={() => rotateSelection(1)}>⟳</button>
          <button className="icon-btn" title="Flip (F)" onClick={flipSelection}>⇋</button>
          <button className="icon-btn danger" title="Delete (Del)" onClick={deleteSelection}>🗑</button>
        </div>
      </div>
      {myWarnings.map((w, i) => (
        <div key={i} className={`insp-warn ${w.level}`}>{w.message}</div>
      ))}
      {def.fields?.map((f) => (
        <div key={f.key} className="field">
          <label className="field-label">{f.label}{running && 'live' in f && f.live ? <span className="live-dot" title="Adjustable while simulating" /> : null}</label>
          <Field comp={comp} f={f} />
        </div>
      ))}
      {def.mcu && (
        <button className="btn primary block" onClick={() => useEditor.setState({ codeOpen: true, codeTarget: comp.id })}>
          {'</>'} Edit code
        </button>
      )}
      {running && def.interactive && (
        <p className="hint small">
          {def.interactive === 'press' && 'Press and hold it on the canvas to push the button.'}
          {def.interactive === 'toggle' && 'Click it on the canvas to switch.'}
          {def.interactive === 'drag' && 'Drag it up/down on the canvas to adjust.'}
        </p>
      )}
      <p className="muted small desc">{def.description}</p>
    </div>
  );
}
