/**
 * Moverse por el lienzo sin arrastrar nodos sin querer (como Figma o Illustrator):
 * - Espacio mantenido + arrastrar, o la herramienta mano (H), desplazan la vista aunque el puntero esté sobre un nodo
 *   o una arista: no se selecciona, no se mueve y no se conecta nada.
 * - Botón central + arrastrar desplaza en cualquier sitio.
 * - En el interior de un contenedor (grupo, Grouping, nodo con hijos) que no está seleccionado, arrastrar desplaza la
 *   vista; se mueve arrastrando su título o su borde, o arrastrando por dentro una vez seleccionado. Un clic sin mover
 *   lo selecciona como siempre. Con un diagrama ampliado, los contenedores ocupan casi toda la pantalla.
 * - Rueda: desplaza (Shift+rueda en horizontal) y Ctrl/⌘+rueda o el pellizco hacen zoom; con la preferencia «zoom»,
 *   la rueda hace zoom como antes. React Flow no desplaza con la rueda sobre los nodos (llevan la clase `nopan`), así
 *   que el desplazamiento es propio.
 * Todo se captura en el envoltorio del lienzo antes de que llegue a React Flow.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import type { WheelMode } from './prefs';

/** Píxeles que hay que mover antes de que un arrastre cuente como desplazamiento (si no, es un clic). */
const PAN_THRESHOLD = 3;
/** Franja del borde de un contenedor que sigue sirviendo para moverlo. */
const CONTAINER_EDGE = 6;
/** Zonas del lienzo que no son lienzo: controles, minimapa, menús, campos de texto. */
const NOT_CANVAS = '.react-flow__controls, .react-flow__minimap, .react-flow__panel, input, textarea, select, [contenteditable="true"], .ad-menu, .ad-cmenu, .ad-picker';
/** Partes de un contenedor desde las que se arrastra el contenedor (título, manejadores, redimensionado, pines). */
const CONTAINER_GRIP = '.ad-node__label, .ad-node__type, .ad-node__icon, .ad-node__drill, .ad-visual__title, .react-flow__handle, .react-flow__resize-control, .ad-port, .ad-cls__head';

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** ¿El punto cae en el interior «vacío» de un contenedor sin seleccionar? Ahí arrastrar desplaza en vez de mover. */
export function inContainerInterior(target: Element, x: number, y: number): boolean {
  const node = target.closest('.react-flow__node');
  if (!node || node.classList.contains('selected')) return false;
  const container = node.classList.contains('parent') || !!node.querySelector(':scope > .is-container, :scope > .ad-visual--core-group');
  if (!container || target.closest(CONTAINER_GRIP)) return false;
  const r = node.getBoundingClientRect();
  return x - r.left > CONTAINER_EDGE && r.right - x > CONTAINER_EDGE && y - r.top > CONTAINER_EDGE && r.bottom - y > CONTAINER_EDGE;
}

/** Desplazamiento de la rueda en píxeles (algunos ratones lo dan en líneas o páginas). */
export function wheelDelta(e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>, page: number): { dx: number; dy: number } {
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? page : 1;
  let dx = e.deltaX * k, dy = e.deltaY * k;
  // Shift+rueda: horizontal (los navegadores solo lo hacen solos en algunos sistemas).
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  return { dx, dy };
}

type Opts = { hand: boolean; wheel: WheelMode; onPanEnd?: (vp: Viewport) => void };

/** Devuelve si Espacio está pulsado (para el cursor) y si se está desplazando ahora. */
export function usePanGestures(wrapper: RefObject<HTMLDivElement | null>, rf: ReactFlowInstance, opts: Opts): { spaceHeld: boolean; panning: boolean } {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const live = useRef({ ...opts, spaceHeld, rf });
  live.current = { ...opts, spaceHeld, rf };

  // Espacio: solo con el puntero sobre el lienzo o el foco en él, y nunca escribiendo.
  useEffect(() => {
    let over = false;
    const el = wrapper.current;
    const enter = () => { over = true; }, leave = () => { over = false; };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const focusIn = !!el && el.contains(document.activeElement);
      if (!over && !focusIn) return;
      e.preventDefault(); // ni desplazar la página ni pulsar el botón con el foco
      if (!e.repeat) setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    const reset = () => setSpaceHeld(false);
    el?.addEventListener('pointerenter', enter); el?.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', reset);
    return () => {
      el?.removeEventListener('pointerenter', enter); el?.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', reset);
    };
  }, [wrapper]);

  // Arrastrar para desplazar.
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const start = (target: Element, x: number, y: number, button: number, mods: boolean, touch: boolean): boolean => {
      if (target.closest(NOT_CANVAS) || !target.closest('.react-flow__renderer, .react-flow__pane')) return false;
      const { hand, spaceHeld: space } = live.current;
      if (button === 1 && !touch) return true;
      if (button !== 0) return false;
      if (hand || space) return true;
      return !mods && inContainerInterior(target, x, y);
    };
    const run = (x0: number, y0: number, force: boolean, moveEv: 'mousemove' | 'touchmove', upEv: 'mouseup' | 'touchend', point: (e: Event) => { x: number; y: number } | null) => {
      const r = live.current.rf;
      const v0 = r.getViewport();
      let moved = force;
      if (force) setPanning(true);
      const move = (e: Event) => {
        const p = point(e);
        if (!p) { end(); return; }
        const dx = p.x - x0, dy = p.y - y0;
        if (!moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
        if (!moved) { moved = true; setPanning(true); }
        if (e.cancelable) e.preventDefault();
        void r.setViewport({ x: v0.x + dx, y: v0.y + dy, zoom: v0.zoom });
      };
      const end = () => {
        window.removeEventListener(moveEv, move, true); window.removeEventListener(upEv, end, true);
        if (upEv === 'touchend') window.removeEventListener('touchcancel', end, true);
        setPanning(false);
        if (!moved) return;
        live.current.onPanEnd?.(r.getViewport());
        // El clic que sigue a un desplazamiento no selecciona nada.
        const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      };
      window.addEventListener(moveEv, move, { capture: true, passive: false }); window.addEventListener(upEv, end, true);
      if (upEv === 'touchend') window.addEventListener('touchcancel', end, true);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!start(target, e.clientX, e.clientY, e.button, e.shiftKey || e.ctrlKey || e.metaKey || e.altKey, false)) return;
      // Antes de React Flow: ni arrastre de nodo, ni selección por área, ni conexión.
      e.stopPropagation(); e.preventDefault();
      // Espacio, mano y botón central desplazan ya; el interior de un contenedor espera a que se mueva (un clic selecciona).
      const force = e.button === 1 || live.current.hand || live.current.spaceHeld;
      el.focus({ preventScroll: true }); // `preventDefault` evita que el lienzo tome el foco: sin él no irían los atajos
      run(e.clientX, e.clientY, force, 'mousemove', 'mouseup', ev => ({ x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY }));
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // pellizco: React Flow
      const t = e.touches[0]!;
      if (!start(e.target as Element, t.clientX, t.clientY, 0, false, true)) return;
      e.stopPropagation();
      const id = t.identifier;
      run(t.clientX, t.clientY, false, 'touchmove', 'touchend', ev => {
        const te = ev as TouchEvent;
        if (te.touches.length > 1) return null; // segundo dedo: se deja de desplazar
        const p = [...te.touches].find(x => x.identifier === id);
        return p ? { x: p.clientX, y: p.clientY } : null;
      });
    };
    // Rueda: desplazar (o zoom si se eligió así; Ctrl/⌘ y el pellizco siempre hacen zoom, lo resuelve React Flow).
    const onWheel = (e: WheelEvent) => {
      if (live.current.wheel !== 'pan' || e.ctrlKey || e.metaKey) return;
      const target = e.target as Element;
      if (target.closest(NOT_CANVAS + ', .nowheel') || !target.closest('.react-flow__renderer, .react-flow__pane')) return;
      e.preventDefault(); e.stopPropagation();
      const r = live.current.rf, v = r.getViewport();
      const { dx, dy } = wheelDelta(e, el.clientHeight);
      void r.setViewport({ x: v.x - dx, y: v.y - dy, zoom: v.zoom });
      live.current.onPanEnd?.(r.getViewport());
    };
    el.addEventListener('mousedown', onMouseDown, true);
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      el.removeEventListener('mousedown', onMouseDown, true);
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('wheel', onWheel, true);
    };
  }, [wrapper]);

  return { spaceHeld, panning };
}
