/**
 * Comportamiento de los diálogos modales del editor (búsqueda Ctrl+K, atajos, panel Espacio), el mismo que los
 * diálogos propios de `dialog.tsx`: el foco entra al abrir (en `[data-autofocus]` o en el primer control), Tab y
 * Shift+Tab no salen de la caja, Escape cierra y, al cerrar, el foco vuelve a donde estaba.
 *
 *   const box = useModal(open, onClose);
 *   <div ref={box} role="dialog" aria-modal="true">…</div>
 *
 * Si hay varios abiertos (p. ej. Ctrl+K sobre el panel Espacio) solo manda el de arriba. Los diálogos de la capa
 * flotante (confirmar, avisos) tienen su propia trampa y se ignoran aquí.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { FOCUSABLE, inLayer } from './layer';

const stack: object[] = [];

/** Controles enfocables y visibles de `el`, en orden. */
export function focusablesIn(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.getClientRects().length > 0);
}

/**
 * Elemento al que debe ir el foco con Tab dentro de la trampa, o `null` si el navegador puede seguir solo.
 * `current` es el elemento con el foco (puede estar fuera de la caja).
 */
export function trapTarget(items: HTMLElement[], current: Element | null, shift: boolean, inside: boolean): HTMLElement | null {
  if (!items.length) return null;
  const first = items[0]!, last = items[items.length - 1]!;
  if (!inside) return shift ? last : first;
  if (shift && current === first) return last;
  if (!shift && current === last) return first;
  return null;
}

export interface ModalOptions {
  /** Escape: por defecto cierra; la búsqueda lo usa para volver atrás antes de cerrar. */
  onEscape?: () => void;
}

export function useModal<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, opts: ModalOptions = {}): RefObject<T | null> {
  const box = useRef<T | null>(null);
  const latest = useRef({ onClose, onEscape: opts.onEscape });
  latest.current = { onClose, onEscape: opts.onEscape };
  // Efecto de layout: el foco se guarda y se mueve antes de que el navegador pinte (y antes de los `setTimeout`).
  useLayoutEffect(() => {
    if (!open) return;
    const el = box.current; if (!el) return;
    const token = {};
    stack.push(token);
    const opener = document.activeElement instanceof HTMLElement && !el.contains(document.activeElement) ? document.activeElement : null;
    if (!el.contains(document.activeElement)) {
      const start = el.querySelector<HTMLElement>('[data-autofocus]') ?? focusablesIn(el)[0] ?? el;
      if (start === el && !el.hasAttribute('tabindex')) el.tabIndex = -1;
      start.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token || inLayer(e)) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        const { onEscape, onClose: close } = latest.current;
        (onEscape ?? close)();
        return;
      }
      if (e.key !== 'Tab') return;
      const to = trapTarget(focusablesIn(el), document.activeElement, e.shiftKey, el.contains(document.activeElement));
      if (to) { e.preventDefault(); to.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(token); if (i >= 0) stack.splice(i, 1);
      // Solo si el foco se ha quedado en el diálogo (o perdido): si otra cosa lo ha tomado a propósito, se respeta.
      const a = document.activeElement;
      if (!a || a === document.body || el.contains(a)) {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('.ad-canvas')?.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return box;
}
