import { create } from 'zustand';
import { Simulator, type SimSnapshot } from './simulator';
import { useEditor, showToast } from '../model/store';
import { audio } from '../ui/audio';

interface SimView {
  snap: SimSnapshot | null;
}

export const useSimView = create<SimView>(() => ({ snap: null }));

let sim: Simulator | null = null;
let raf = 0;
let last = 0;

export function getSimulator() {
  return sim;
}

export function startSimulation(): boolean {
  const { doc } = useEditor.getState();
  sim = new Simulator(doc);
  const errors = sim.start();
  if (errors.size) {
    const compileErrors = Object.fromEntries(errors);
    const [id] = errors.keys();
    useEditor.setState({ compileErrors, codeOpen: true, codeTarget: id });
    const e = errors.get(id)!;
    showToast(`Compile error${e.line ? ` (line ${e.line})` : ''}: ${e.message}`, 'error');
    sim = null;
    return false;
  }
  useEditor.setState({ running: true, compileErrors: {}, simEpoch: useEditor.getState().simEpoch + 1 });
  last = performance.now();
  const tick = (now: number) => {
    if (!sim) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    sim.advance(dt);
    const snap = sim.snapshot();
    useSimView.setState({ snap });
    audio.update(snap, useEditor.getState().muted);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return true;
}

export function stopSimulation() {
  cancelAnimationFrame(raf);
  sim = null;
  audio.stopAll();
  useSimView.setState({ snap: null });
  useEditor.setState({ running: false });
}

export function toggleSimulation() {
  if (useEditor.getState().running) stopSimulation();
  else startSimulation();
}

// Rebuild the electrical model whenever the document changes mid-simulation.
useEditor.subscribe((s, prev) => {
  if (sim && s.running && s.doc !== prev.doc) sim.rebuild(s.doc);
});
