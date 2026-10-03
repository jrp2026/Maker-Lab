import { useEffect, useMemo, useRef, useState } from 'react';
import { PROVIDERS, baseOf, listModels, loadSettings, modelOf, saveSettings, type AiSettings, type ProviderId } from '../ai/providers';
import { generatePart } from '../ai/prompt';
import { TELEGRAPH_KEY_SPEC } from '../ai/samplePart';
import { SpecError, validateSpec, type CustomPartSpec } from '../ai/spec';
import { defFromSpec } from '../ai/customPart';
import { registerSpec, savePart } from '../ai/library';
import { addComponent, showToast } from '../model/store';
import { getCanvasSize, useViewport } from './viewport';
import type { ComponentInstance } from '../model/types';
import { KicadButtons } from './KicadButtons';

const IDEAS = ['Morse telegraph key', 'Nixie tube showing one digit', '5 V reed relay', 'K-type thermocouple with a temperature slider', 'small wind turbine generator', 'doorbell chime (ding-dong)', 'Geiger counter module that clicks', 'BH1750 light sensor module'];

function Preview({ spec, view }: { spec: CustomPartSpec; view: 'breadboard' | 'schematic' }) {
  const def = useMemo(() => defFromSpec(spec), [spec]);
  const b = def.bounds;
  const pad = 12;
  const comp: ComponentInstance = { id: 'preview', type: spec.type, x: 0, y: 0, rot: 0, flip: false, props: def.defaultProps };
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} className="ai-preview-svg">
      {view === 'breadboard' ? def.render({ comp, props: def.defaultProps }) : def.schematic({ comp, props: def.defaultProps })}
      {spec.pins.map((p) => (
        <text key={p.id} x={p.x} y={p.y + 8} fontSize={4} textAnchor="middle" fill="#1e88e5" fontFamily="Inter, sans-serif" fontWeight={700}>{p.id}</text>
      ))}
    </svg>
  );
}

export function AiPartDialog({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(() => {
    const s = loadSettings();
    return PROVIDERS[s.provider].needsKey && !s.keys[s.provider];
  });
  const [request, setRequest] = useState('');
  const [refine, setRefine] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [spec, setSpec] = useState<CustomPartSpec | null>(null);
  const specDef = useMemo(() => (spec ? defFromSpec(spec) : null), [spec]);
  const [view, setView] = useState<'breadboard' | 'schematic'>('breadboard');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => setModels([]), [settings.provider]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const info = PROVIDERS[settings.provider];
  const set = (patch: Partial<Record<'models' | 'keys' | 'baseUrls', string>>) =>
    setSettings((s) => ({
      ...s,
      models: 'models' in patch ? { ...s.models, [s.provider]: patch.models } : s.models,
      keys: 'keys' in patch ? { ...s.keys, [s.provider]: patch.keys } : s.keys,
      baseUrls: 'baseUrls' in patch ? { ...s.baseUrls, [s.provider]: patch.baseUrls } : s.baseUrls,
    }));

  const run = async (text: string, previous?: CustomPartSpec) => {
    if (!text.trim()) return;
    setError(null);
    setProblems([]);
    abort.current = new AbortController();
    try {
      const out = await generatePart(settings, { request: text.trim(), previous, signal: abort.current.signal, onStatus: setBusy });
      setSpec(out);
      setJsonText(JSON.stringify(out, null, 2));
      setRefine('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError('Cancelled.');
      else if (e instanceof SpecError) {
        setError('The model could not produce a usable part after a few tries. Try rephrasing, or a larger model.');
        setProblems(e.problems);
      } else setError((e as Error).message);
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const applyJson = () => {
    try {
      const s = validateSpec(JSON.parse(jsonText), { keepType: false });
      s.prompt = spec?.prompt;
      setSpec(s);
      setProblems([]);
      setError(null);
    } catch (e) {
      setProblems(e instanceof SpecError ? e.problems : [(e as Error).message]);
    }
  };

  const place = () => {
    if (!spec) return;
    registerSpec(spec);
    const def = defFromSpec(spec);
    const v = useViewport.getState();
    const { w, h } = getCanvasSize();
    addComponent(spec.type, (w / 2 - v.x) / v.s - (def.bounds.x + def.bounds.w / 2), (h / 2 - v.y) / v.s - (def.bounds.y + def.bounds.h / 2));
    showToast(`Added “${spec.name}”`);
    onClose();
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal ai-modal" role="dialog" aria-label="Create a part with AI">
        <div className="modal-head">
          <div>
            <h3>✨ Create a part with AI</h3>
            <span className="muted small">Describe any component — the model draws it and writes its electrical model for the simulator.</span>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={!!busy} title="Close">✕</button>
        </div>

        <div className="ai-provider">
          <label>
            <span>Model provider</span>
            <select value={settings.provider} onChange={(e) => setSettings((s) => ({ ...s, provider: e.target.value as ProviderId }))}>
              {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => <option key={id} value={id}>{PROVIDERS[id].label}</option>)}
            </select>
          </label>
          <label className="grow">
            <span>Model</span>
            <input list="ai-models" value={modelOf(settings)} placeholder={info.defaultModel || 'loaded model'} onChange={(e) => set({ models: e.target.value })} spellCheck={false} />
            <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <button className="btn" onClick={async () => {
            setError(null);
            try {
              const list = await listModels(settings);
              setModels(list);
              showToast(list.length ? `${list.length} models available — pick one in the Model box` : 'No models found');
            } catch (e) {
              setError((e as Error).message);
            }
          }}>Load models</button>
          <button className="link" onClick={() => setShowSettings(!showSettings)}>{showSettings ? 'Hide' : 'Key & server'} ▾</button>
        </div>
        {showSettings && (
          <div className="ai-settings">
            {info.needsKey && (
              <label>
                <span>API key {info.keyUrl && <a href={info.keyUrl} target="_blank" rel="noreferrer">get one ↗</a>}</span>
                <input type="password" value={settings.keys[settings.provider] ?? ''} onChange={(e) => set({ keys: e.target.value })} placeholder="Paste your key" autoComplete="off" spellCheck={false} />
              </label>
            )}
            <label>
              <span>{info.needsKey ? 'API base URL (advanced)' : 'Server URL'}</span>
              <input value={settings.baseUrls[settings.provider] ?? ''} placeholder={info.defaultBaseUrl} onChange={(e) => set({ baseUrls: e.target.value })} spellCheck={false} />
            </label>
            <p className="muted small">
              {info.help} {info.needsKey ? `Your key stays in this browser (localStorage) and is sent only to ${baseOf(settings)}.` : ''}
            </p>
          </div>
        )}

        <div className="ai-body">
          <div className="ai-left">
            <label className="field-label">What part do you need?</label>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="e.g. Morse telegraph key, Nixie tube, 5 V reed relay…"
              rows={3}
              onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && run(request)}
              disabled={!!busy}
            />
            <div className="chips">
              {IDEAS.map((i) => <button key={i} className="chip-btn" onClick={() => setRequest(i)} disabled={!!busy}>{i}</button>)}
            </div>
            <div className="row gap">
              {busy ? (
                <>
                  <span className="spinner" /> <span className="muted">{busy}</span>
                  <button className="btn" onClick={() => abort.current?.abort()}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn primary" onClick={() => run(request)} disabled={!request.trim()}>✨ Generate</button>
                  <button className="link" onClick={() => {
                    const s = validateSpec(TELEGRAPH_KEY_SPEC);
                    s.prompt = 'Morse telegraph key (sample)';
                    setSpec(s);
                    setJsonText(JSON.stringify(s, null, 2));
                    setError(null);
                  }}>or load an example without AI</button>
                </>
              )}
            </div>
            {error && <div className="insp-warn error">{error}</div>}
            {problems.length > 0 && (
              <ul className="problems">{problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}</ul>
            )}
          </div>

          <div className="ai-right">
            {!spec ? (
              <div className="ai-empty muted">The generated part appears here for review before you add it.</div>
            ) : (
              <>
                <div className="row between">
                  <div>
                    <h4>{spec.name}</h4>
                    <span className="muted small">{spec.pins.length} pins · {spec.model.elements.length} model elements{spec.props.length ? ` · ${spec.props.length} settings` : ''}</span>
                  </div>
                  <div className="view-toggle small">
                    <button className={view === 'breadboard' ? 'on' : ''} onClick={() => setView('breadboard')}>Part</button>
                    <button className={view === 'schematic' ? 'on' : ''} onClick={() => setView('schematic')}>Symbol</button>
                  </div>
                </div>
                <div className="ai-preview"><Preview spec={spec} view={view} /></div>
                <p className="small desc">{spec.description}</p>
                <div className="pin-table">
                  {spec.pins.map((p) => <span key={p.id}><b>{p.id}</b> {p.label}</span>)}
                </div>
                <div className="row gap wrap">
                  <button className="btn primary" onClick={place}>Add to canvas</button>
                  <button className="btn" onClick={() => { savePart(spec); showToast('Saved to My AI parts'); }}>Save to My AI parts</button>
                  <button className="link" onClick={() => setJsonOpen(!jsonOpen)}>{jsonOpen ? 'Hide' : 'Edit'} JSON</button>
                </div>
                {specDef && <KicadButtons def={specDef} props={specDef.defaultProps} />}
                <div className="refine">
                  <input value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="Refine: “make the body blue”, “add a power LED”…" onKeyDown={(e) => e.key === 'Enter' && run(refine, spec)} disabled={!!busy} />
                  <button className="btn" onClick={() => run(refine, spec)} disabled={!!busy || !refine.trim()}>Refine</button>
                </div>
                {jsonOpen && (
                  <div className="json-edit">
                    <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} rows={12} />
                    <button className="btn" onClick={applyJson}>Apply JSON</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <p className="muted small foot">AI parts are approximations: check pinouts and behaviour against the datasheet. They're saved inside your project, so exports and share links include them.</p>
      </div>
    </div>
  );
}
