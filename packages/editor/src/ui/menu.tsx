/**
 * Menús contextuales (nodo, arista, lienzo): siempre dentro de la pantalla y usables con teclado.
 *
 * - **Posición**: se abre en el punto pedido; si no cabe por abajo o por la derecha se voltea hacia arriba o hacia
 *   la izquierda y, si aun así no cabe, se pega al borde con altura máxima y desplazamiento propio.
 * - **Móvil** (< 700 px): hoja inferior a todo el ancho, con fondo que la cierra al tocarlo.
 * - **Teclado** (patrón WAI-ARIA "menu"): el foco entra en la primera opción; ↑ ↓ Inicio Fin se mueven, Intro o
 *   Espacio eligen, Escape o Tab cierran y el foco vuelve a donde estaba (o al lienzo, si eso ya no existe).
 */
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { moveIndex, isShown } from './roving';

/** Opciones navegables dentro de un menú. */
export const MENU_ITEMS = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';
const MQ_SHEET = '(max-width: 699px)';
const MARGIN = 8;
/** Tiempo tras levantar el dedo en el que se ignoran los clics del puntero (el "clic fantasma" de la pulsación larga). */
const GHOST_MS = 450;

export interface Placement { left: number; top: number; maxHeight: number }

/**
 * Dónde pintar un menú de `w`×`h` abierto en (`x`, `y`) dentro de una ventana `vw`×`vh`: voltea si no cabe y,
 * si no cabe de ninguna forma, lo pega al margen y limita su alto (con desplazamiento interno).
 */
export function placeMenu(x: number, y: number, w: number, h: number, vw: number, vh: number, margin = MARGIN): Placement {
  const maxHeight = Math.max(80, vh - 2 * margin);
  const hh = Math.min(h, maxHeight);
  let top = y;
  if (top + hh > vh - margin) top = y - hh >= margin ? y - hh : vh - margin - hh;
  top = Math.max(margin, top);
  const ww = Math.min(w, vw - 2 * margin);
  let left = x;
  if (left + ww > vw - margin) left = x - ww >= margin ? x - ww : vw - margin - ww;
  left = Math.max(margin, left);
  return { left: Math.round(left), top: Math.round(top), maxHeight: Math.round(maxHeight) };
}

function sheetMode(): boolean {
  try { return !!globalThis.matchMedia?.(MQ_SHEET).matches; } catch { return false; }
}

export interface MenuState {
  ref: RefObject<HTMLDivElement | null>;
  /** Hoja inferior (móvil) en vez de menú flotante. */
  sheet: boolean;
  style: CSSProperties;
  onKeyDown: (e: ReactKeyboardEvent) => void;
}

/**
 * Posición, foco y teclado de un menú abierto en (`x`, `y`). `onClose` se llama al pulsar fuera, Escape o Tab.
 * Pinta `ref` en la caja del menú, `style` como estilo y `onKeyDown` como manejador.
 */
export function useMenu(x: number, y: number, onClose: () => void): MenuState {
  const ref = useRef<HTMLDivElement | null>(null);
  const [sheet] = useState(sheetMode);
  const close = useRef(onClose); close.current = onClose;

  // Medir y colocar antes de pintar (sin parpadeo fuera de la pantalla), escribiendo en el DOM: así el menú es
  // visible (y enfocable) desde el primer momento. Al desplegar un submenú (`<details>`) crece: se vuelve a colocar.
  useLayoutEffect(() => {
    const el = ref.current; if (!el || sheet) return;
    const place = () => {
      el.style.maxHeight = '';
      const r = el.getBoundingClientRect();
      const p = placeMenu(x, y, r.width, el.scrollHeight || r.height, window.innerWidth, window.innerHeight);
      el.style.left = `${p.left}px`; el.style.top = `${p.top}px`; el.style.maxHeight = `${p.maxHeight}px`;
    };
    place();
    el.addEventListener('toggle', place, true);
    window.addEventListener('resize', place);
    return () => { el.removeEventListener('toggle', place, true); window.removeEventListener('resize', place); };
  }, [x, y, sheet]);

  // Foco dentro al abrir; al cerrar vuelve a quien lo tenía (si sigue existiendo) o al lienzo.
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const opener = document.activeElement instanceof HTMLElement && !el.contains(document.activeElement) ? document.activeElement : null;
    const first = [...el.querySelectorAll<HTMLElement>(MENU_ITEMS)].find(isShown);
    (first ?? el).focus({ preventScroll: true });
    // Al soltar el dedo tras la pulsación larga que abre el menú, el navegador puede emitir un clic "fantasma" justo
    // donde estaba el dedo (ahora encima del menú o de su fondo): si se abrió con el dedo puesto, el primer `touchend`
    // es el de esa pulsación y, durante un instante, ni cierra ni elige nada. (Los clics de teclado, Intro o Espacio,
    // tienen `detail` 0 y nunca se ignoran; con ratón no hay `touchend` y no hay espera.)
    let quietUntil = 0;
    const settling = () => Date.now() < quietUntil;
    const lift = () => { quietUntil = Date.now() + GHOST_MS; };
    const outside = (e: Event) => { if (!settling() && !el.contains(e.target as globalThis.Node)) close.current(); };
    const ghost = (e: MouseEvent) => { if (e.detail > 0 && settling()) { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchend', lift, { capture: true, once: true });
    el.addEventListener('click', ghost, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchend', lift, { capture: true });
      el.removeEventListener('click', ghost, true);
      const a = document.activeElement;
      if (a && a !== document.body && !el.contains(a)) return; // otra cosa (un panel, un campo) ha tomado el foco a propósito
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('.ad-canvas')?.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = useCallback((e: ReactKeyboardEvent) => {
    // Nada de lo que se pulsa en el menú llega al lienzo (las flechas moverían el nodo, Supr lo borraría).
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close.current(); return; }
    const el = ref.current; if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>(MENU_ITEMS)].filter(isShown);
    const j = moveIndex(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);
    if (j === null) return;
    e.preventDefault();
    items[j]!.focus();
    items[j]!.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const style: CSSProperties = sheet ? {} : { left: x, top: y };
  return { ref, sheet, style, onKeyDown };
}

/** ¿Abre el menú contextual esta tecla? Shift+F10 o la tecla Menú (`ContextMenu`). */
export const isContextMenuKey = (e: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) =>
  !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey));

/**
 * Abre con el teclado el menú contextual de lo seleccionado en el lienzo: el del primer nodo seleccionado, si no el
 * de la primera arista y, si no hay selección, el del lienzo (en su centro). Reutiliza el `contextmenu` de React Flow
 * con un evento sintético anclado bajo el nodo. Devuelve `false` si no hay lienzo.
 */
export function openContextMenuFor(sel: { nodes: string[]; edges: string[] }, root: ParentNode = document): boolean {
  const canvas = root.querySelector<HTMLElement>('.ad-canvas'); if (!canvas) return false;
  const byId = (cls: string, id: string | undefined) => (id ? [...canvas.querySelectorAll<HTMLElement | SVGElement>(cls)].find(n => n.dataset.id === id) : undefined);
  const pane = canvas.querySelector<HTMLElement>('.react-flow__pane'); if (!pane) return false;
  const pr = pane.getBoundingClientRect();
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  let target: Element | undefined = byId('.react-flow__node', sel.nodes[0]);
  let x: number, y: number;
  if (target) { const r = target.getBoundingClientRect(); x = r.left + Math.min(r.width / 2, 24); y = r.bottom + 4; }
  else if ((target = byId('.react-flow__edge', sel.edges[0]))) { const r = target.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else { target = pane; x = pr.left + pr.width / 2; y = pr.top + pr.height / 2; }
  x = clamp(x, pr.left, pr.right); y = clamp(y, pr.top, pr.bottom);
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
  return true;
}

/** Fondo de la hoja inferior (móvil): tocarlo cierra el menú (el `mousedown` fuera ya lo hace). */
export function MenuBackdrop() {
  return <div className="ad-menu-backdrop" aria-hidden="true" />;
}
