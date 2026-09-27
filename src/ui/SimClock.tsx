import { useSimView } from '../sim/controller';
import { useEditor } from '../model/store';

/** Simulated time, shown over the canvas corner while running (outside the toolbar, so nothing shifts). */
export function SimClock() {
  const running = useEditor((s) => s.running);
  const t = useSimView((s) => s.snap?.time ?? 0);
  const slow = useSimView((s) => s.snap?.slow);
  if (!running) return null;
  const m = Math.floor(t / 60);
  const sec = (t % 60).toFixed(1).padStart(4, '0');
  return (
    <span className={`sim-clock${slow ? ' slow' : ''}`} title={slow ? 'Simulation is running slower than real time' : 'Simulated time'}>
      ⏱ {String(m).padStart(2, '0')}:{sec}
    </span>
  );
}
