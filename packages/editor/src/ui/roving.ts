/**
 * Navegación con flechas dentro de una lista (paleta, vistas, menús, pestañas) con un único punto de Tab
 * ("roving tabindex"): la lista entera es una parada de Tab y las flechas, Inicio y Fin se mueven por dentro.
 */
import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

export type Orientation = 'vertical' | 'horizontal';

/**
 * Índice siguiente para una tecla de navegación, o `null` si la tecla no navega. Da la vuelta en los extremos.
 * Vertical: ↑ ↓; horizontal: ← →; ambas: Inicio y Fin.
 */
export function moveIndex(key: string, i: number, n: number, orientation: Orientation = 'vertical'): number | null {
  if (n <= 0) return null;
  const prev = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  if (key === next) return i < 0 ? 0 : (i + 1) % n;
  if (key === prev) return i < 0 ? n - 1 : (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

/** ¿Se ve el elemento? (dentro de un `<details>` cerrado o con `display: none` no tiene cajas). */
export const isShown = (el: Element): boolean => el.getClientRects().length > 0;

/**
 * Lista con una sola parada de Tab. `selector` elige los elementos navegables dentro de `ref` (p. ej.
 * `.ad-pal__item, summary`). Devuelve el `onKeyDown` y el `onFocus` para el contenedor.
 */
export function useRoving(ref: RefObject<HTMLElement | null>, selector: string) {
  const active = useRef<HTMLElement | null>(null);
  const sync = useCallback(() => {
    const el = ref.current; if (!el) return;
    const all = [...el.querySelectorAll<HTMLElement>(selector)];
    const shown = all.filter(isShown);
    if (!active.current || !shown.includes(active.current)) active.current = shown[0] ?? null;
    for (const it of all) it.tabIndex = it === active.current ? 0 : -1;
  }, [ref, selector]);
  // Tras cada render (filtrar, cambiar de pestaña) y al plegar/desplegar una categoría (`toggle` no burbujea).
  useEffect(() => { sync(); });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.addEventListener('toggle', sync, true);
    return () => el.removeEventListener('toggle', sync, true);
  }, [ref, sync]);
  const onFocus = useCallback((e: { target: EventTarget | null }) => {
    const t = e.target as HTMLElement | null;
    if (t && ref.current && t.matches?.(selector)) { active.current = t; sync(); }
  }, [ref, selector, sync]);
  const onKeyDown = useCallback((e: ReactKeyboardEvent) => {
    const el = ref.current; if (!el || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (!t.matches?.(selector)) return; // dentro de un campo o un botón interior: no se navega
    const items = [...el.querySelectorAll<HTMLElement>(selector)].filter(isShown);
    const j = moveIndex(e.key, items.indexOf(t), items.length);
    if (j === null) return;
    e.preventDefault();
    const to = items[j]!;
    active.current = to; sync();
    to.focus();
    to.scrollIntoView?.({ block: 'nearest' });
  }, [ref, selector, sync]);
  return { onKeyDown, onFocus };
}
