import { useEffect, useLayoutEffect, useState } from 'react';
import { create } from 'zustand';
import { loadDoc, showToast, useEditor } from '../model/store';
import { EXAMPLES } from '../examples';
import { zoomToFit } from './viewport';
import { toggleSimulation } from '../sim/controller';
import { DEFS } from '../components/registry';

const SEEN_KEY = 'makerlab.welcomed';

/** Which help surface is showing: the first-visit welcome card, the guided tour, or nothing. */
export const useHelp = create<{ mode: 'welcome' | 'tour' | null; step: number }>(() => ({ mode: null, step: 0 }));

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode: the welcome just shows again next time */
  }
}

/** Show the welcome card on a browser's first visit. */
export function maybeWelcome() {
  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    seen = false;
  }
  if (!seen) useHelp.setState({ mode: 'welcome', step: 0 });
}

export const openWelcome = () => useHelp.setState({ mode: 'welcome', step: 0 });
export const startTour = () => {
  markSeen();
  useHelp.setState({ mode: 'tour', step: 0 });
};
const closeHelp = () => {
  markSeen();
  useHelp.setState({ mode: null, step: 0 });
};

function load(id: string) {
  const ex = EXAMPLES.find((e) => e.id === id)!;
  if (useEditor.getState().running) toggleSimulation();
  loadDoc(ex.build(), { keepHistory: true });
  requestAnimationFrame(() => zoomToFit(useEditor.getState().doc));
}

/** "Try this first": load the Blink example and run it. */
export function tryBlink() {
  closeHelp();
  load('blink');
  setTimeout(() => {
    if (!useEditor.getState().running) toggleSimulation();
    showToast('The LED on pin 13 is blinking. Open </> Code to see the sketch, or Stop to edit the circuit.');
  }, 350);
}

export function Welcome() {
  const mode = useHelp((s) => s.mode);
  useEffect(() => {
    if (mode !== 'welcome') return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeHelp();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [mode]);
  if (mode !== 'welcome') return null;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && closeHelp()}>
      <div className="modal welcome" role="dialog" aria-label="Welcome to MakerLab">
        <div className="welcome-hero" aria-hidden>
          <svg viewBox="0 0 120 60" width="120" height="60">
            <rect x="4" y="18" width="52" height="30" rx="4" fill="#1f7a8c" />
            <rect x="10" y="24" width="14" height="10" rx="1.5" fill="#d9dde2" />
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={28 + i * 4} y="20" width="2.4" height="4" fill="#f3c534" />)}
            <path d="M56 30 H78" stroke="#e53935" strokeWidth="2.4" fill="none" />
            <path d="M56 40 H92 V34" stroke="#212121" strokeWidth="2.4" fill="none" />
            <path d="M78 30 l3 -4 l3 8 l3 -8 l3 8 l3 -4" stroke="#b58b52" strokeWidth="2.2" fill="none" />
            <circle cx="104" cy="24" r="8" fill="#ff4d4d" className="welcome-led" />
            <path d="M98 30 V36 H96 M110 30 V34 H92" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
          </svg>
        </div>
        <h2>Welcome to MakerLab</h2>
        <p className="muted">
          Build circuits on a breadboard, program an Arduino or ESP32, and press Run — {DEFS.length} real parts, all simulated in your browser.
          Nothing to install, nothing to buy.
        </p>
        <div className="welcome-actions">
          <button className="btn primary big" onClick={tryBlink}>
            ▶ Try this first: blink an LED
            <small>loads a ready-made circuit and runs it</small>
          </button>
          <button className="btn big" onClick={startTour}>
            🧭 Take the 30-second tour
            <small>where the parts, wires, code and Run button are</small>
          </button>
        </div>
        <button className="link" onClick={closeHelp}>Skip — let me explore on my own</button>
      </div>
    </div>
  );
}

interface Step { targets: string[]; title: string; text: string }

const STEPS: Step[] = [
  { targets: ['.library', '.fab-parts'], title: 'Parts', text: 'Drag any part onto the canvas. Search by name or job (“motor”, “temperature”), or pick a category. ✨ can even make new parts with AI.' },
  { targets: ['.stage'], title: 'Build and wire', text: 'Drag parts to move them, R rotates, Delete removes. Click a pin or breadboard hole, then another, to run a wire. Scroll or pinch to zoom.' },
  { targets: ['[data-tour="code"]'], title: 'Code', text: 'Boards run real Arduino sketches (C++), or snap blocks together. The code panel shows the Serial Monitor too.' },
  { targets: ['.sim-btn'], title: 'Run it', text: 'Start the simulation: LEDs glow, motors spin, meters read. Click buttons and switches, or drag sliders, while it runs. Warnings tell you when a part would burn out.' },
  { targets: ['.view-toggle'], title: 'Breadboard or schematic', text: 'The same circuit as a clean schematic, with part names, values and power symbols.' },
  { targets: ['[data-tour="examples"]'], title: 'Examples', text: `${EXAMPLES.length} ready-made projects, from a blinking LED to logic gates and a self-driving robot car. Open one, press Run, then change it.` },
  { targets: ['[data-tour="help"]'], title: 'Help any time', text: 'Click ? to see this tour or the welcome screen again. Have fun building!' },
];

function visibleRect(sel: string[]) {
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // must be on screen (the phone parts sheet is parked below the viewport while closed)
    if (r.width > 0 && r.height > 0 && r.top < window.innerHeight - 4 && r.bottom > 4 && r.left < window.innerWidth - 4 && r.right > 4) return r;
  }
  return null;
}

export function Tour() {
  const { mode, step } = useHelp();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const s = STEPS[step];
  useLayoutEffect(() => {
    if (mode !== 'tour') return;
    const upd = () => {
      setRect(visibleRect(s.targets));
      setVw({ w: window.innerWidth, h: window.innerHeight });
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [mode, step, s]);
  useEffect(() => {
    if (mode !== 'tour') return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHelp();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') useHelp.setState({ step: Math.max(0, step - 1) });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  if (mode !== 'tour') return null;
  const next = () => (step + 1 < STEPS.length ? useHelp.setState({ step: step + 1 }) : closeHelp());

  // the card sits below the highlighted element when there is room, otherwise above / beside it
  const W = Math.min(320, vw.w - 24);
  let left = (vw.w - W) / 2, top = vw.h / 2 - 90;
  if (rect) {
    const big = rect.height > vw.h * 0.5;
    if (big) {
      // a panel filling the height: put the card beside it
      const right = rect.right + 14 + W < vw.w;
      left = right ? rect.right + 14 : Math.max(12, rect.left - W - 14);
      if (!right && rect.left - W - 14 < 12) left = rect.left + (rect.width - W) / 2;
      top = Math.min(vw.h - 220, rect.top + 60);
    } else {
      left = Math.min(vw.w - W - 12, Math.max(12, rect.left + rect.width / 2 - W / 2));
      top = rect.bottom + 14 + 200 < vw.h ? rect.bottom + 14 : Math.max(12, rect.top - 214);
    }
  }
  const pad = 6;
  return (
    <div className="tour" role="dialog" aria-label={`Tour step ${step + 1}: ${s.title}`}>
      <div className="tour-block" onPointerDown={closeHelp} />
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={{ left, top, width: W }}>
        <div className="tour-count">{step + 1} / {STEPS.length}</div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        <div className="row gap">
          <button className="link" onClick={closeHelp}>Skip tour</button>
          <span className="grow" />
          {step > 0 && <button className="btn" onClick={() => useHelp.setState({ step: step - 1 })}>Back</button>}
          <button className="btn primary" onClick={next}>{step + 1 < STEPS.length ? 'Next' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}

/** Shown over an empty canvas: a few ways to get going. */
export function EmptyCanvas() {
  const empty = useEditor((s) => s.doc.components.length === 0);
  const running = useEditor((s) => s.running);
  const mode = useHelp((s) => s.mode);
  if (!empty || running || mode) return null;
  return (
    <div className="empty-canvas">
      <div className="empty-card">
        <h3>Your canvas is empty</h3>
        <p className="muted">Drag a part in from the <b>Components</b> list, or start from something that works:</p>
        <div className="empty-actions">
          <button className="btn primary" onClick={tryBlink}>▶ Blink an LED (try this first)</button>
          {['button', 'dimmer'].map((id) => (
            <button key={id} className="btn" onClick={() => load(id)}>{EXAMPLES.find((e) => e.id === id)?.name}</button>
          ))}
        </div>
        <button className="link" onClick={startTour}>🧭 Take the 30-second tour</button>
      </div>
    </div>
  );
}
