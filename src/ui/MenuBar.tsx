import { Fragment, useEffect, useRef, useState } from 'react';

export type BarItem = { label: string; keys?: string; disabled?: boolean; title?: string; run: () => void } | 'sep';
export interface BarMenu { label: string; alt: string; items: () => BarItem[] }

/**
 * Windows-style menu bar ("File  Edit"): click a title to open it, then hover the other titles to
 * switch; Alt+letter opens a menu from the keyboard, arrows move around, Esc closes.
 */
export function MenuBar({ menus }: { menus: BarMenu[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const viaKeys = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const i = menus.findIndex((m) => m.alt === e.key.toLowerCase());
        if (i >= 0) {
          e.preventDefault();
          viaKeys.current = true;
          setOpen(i);
          return;
        }
      }
      if (open === null) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(null);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        viaKeys.current = true;
        setOpen((open + (e.key === 'ArrowRight' ? 1 : menus.length - 1)) % menus.length);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.bar-item:not(:disabled)') ?? [])];
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = at < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items[next].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [menus, open]);

  useEffect(() => {
    if (open === null) return;
    const h = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('pointerdown', h);
    if (viaKeys.current) {
      viaKeys.current = false;
      ref.current?.querySelector<HTMLButtonElement>('.menubar-pop .bar-item:not(:disabled)')?.focus();
    }
    return () => window.removeEventListener('pointerdown', h);
  }, [open]);

  return (
    <nav className="menubar" ref={ref} aria-label="Menu bar" role="menubar">
      {menus.map((m, i) => (
        <div className="menu" key={m.label}>
          <button
            className={`menubar-title${open === i ? ' open' : ''}`}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            title={`${m.label} (Alt+${m.alt.toUpperCase()})`}
            onClick={() => setOpen(open === i ? null : i)}
            onPointerEnter={() => open !== null && open !== i && setOpen(i)}
          >
            {m.label}
          </button>
          {open === i && (
            <div className="menubar-pop" role="menu">
              {m.items().map((it, k) => (
                <Fragment key={k}>
                  {it === 'sep' ? <div className="menu-sep" role="separator" /> : (
                    <button className="bar-item" role="menuitem" disabled={it.disabled} title={it.title} onClick={() => { setOpen(null); it.run(); }}>
                      <span>{it.label}</span>
                      {it.keys && <kbd>{it.keys}</kbd>}
                    </button>
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
