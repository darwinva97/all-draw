import { useMenu, MenuBackdrop } from '../ui/menu';

export interface PaneMenuItem { label: string; onClick: () => void; disabled?: boolean; hint?: string; danger?: boolean }

/**
 * Menú contextual del lienzo (botón derecho en zona vacía) y de las aristas. Las opciones las decide `Canvas`.
 * Dentro de la pantalla, con teclado y, en móvil, como hoja inferior (ver `ui/menu.tsx`).
 */
export function PaneMenu({ x, y, items, onClose, label }: { x: number; y: number; items: PaneMenuItem[]; onClose: () => void; label?: string }) {
  const m = useMenu(x, y, onClose);
  return <>
    {m.sheet && <MenuBackdrop />}
    <div ref={m.ref} className={`ad-popover ad-menu${m.sheet ? ' ad-menu--sheet' : ''}`} style={m.style} role="menu" aria-label={label} onKeyDown={m.onKeyDown}>
      {items.map(it => (
        <button key={it.label} type="button" className={`ad-popover__item${it.danger ? ' ad-popover__item--danger' : ''}`} role="menuitem" tabIndex={-1} disabled={it.disabled} onClick={() => { it.onClick(); onClose(); }}>
          {it.label}{it.hint && <small>{it.hint}</small>}
        </button>
      ))}
    </div>
  </>;
}
