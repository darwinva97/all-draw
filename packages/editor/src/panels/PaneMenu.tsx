import { useEffect, useRef } from 'react';

export interface PaneMenuItem { label: string; onClick: () => void; disabled?: boolean; hint?: string }

/** Menú contextual del lienzo (botón derecho en zona vacía). Las opciones las decide `Canvas`. */
export function PaneMenu({ x, y, items, onClose }: { x: number; y: number; items: PaneMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="ad-popover ad-menu" style={{ left: x, top: y }} role="menu">
      {items.map(it => (
        <button key={it.label} className="ad-popover__item" role="menuitem" disabled={it.disabled} onClick={() => { it.onClick(); onClose(); }}>
          {it.label}{it.hint && <small>{it.hint}</small>}
        </button>
      ))}
    </div>
  );
}
