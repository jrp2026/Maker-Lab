import { useState } from 'react';
import { useSimView } from '../sim/controller';
import { select, useEditor } from '../model/store';
import { getDef } from '../components/registry';

export function IssuesBar() {
  const warnings = useSimView((s) => s.snap?.warnings);
  const doc = useEditor((s) => s.doc);
  const [open, setOpen] = useState(true);
  if (!warnings?.length) return null;
  const errors = warnings.filter((w) => w.level === 'error').length;
  const nameOf = (id?: string) => {
    const c = id && doc.components.find((x) => x.id === id);
    return c ? getDef(c.type)?.name ?? '' : 'Circuit';
  };
  // de-duplicate identical messages
  const seen = new Set<string>();
  const list = warnings.filter((w) => {
    const k = `${w.comp}|${w.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div className={`issues ${errors ? 'has-errors' : ''}`}>
      <button className="issues-head" onClick={() => setOpen(!open)}>
        <span className="dot" />
        {errors ? `${errors} problem${errors > 1 ? 's' : ''}` : ''}{errors && list.length - errors ? ', ' : ''}
        {list.length - errors ? `${list.length - errors} warning${list.length - errors > 1 ? 's' : ''}` : ''}
        <span className="caret">{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <ul>
          {list.map((w, i) => (
            <li key={i} className={w.level} onClick={() => w.comp && select({ comps: [w.comp] })}>
              <b>{nameOf(w.comp)}</b> {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
