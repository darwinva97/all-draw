/**
 * Recorrido guiado del editor: popovers anclados a partes del editor (por selector CSS) con un foco de luz
 * alrededor. Si el ancla no existe o no se ve (móvil, solo lectura), el paso se muestra centrado.
 *
 * Teclado: → / Intro siguiente, ← anterior, Escape salta el recorrido; el foco queda atrapado en el popover.
 * Se ve una vez (`localStorage('alldraw:tour') = 'done'`) y se repite desde Ayuda → "Repetir el recorrido".
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon, FOCUSABLE } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';

export const TOUR_KEY = 'alldraw:tour';
export const tourSeen = (): boolean => { try { return localStorage.getItem(TOUR_KEY) === 'done'; } catch { return true; } };
export const markTourSeen = (): void => { try { localStorage.setItem(TOUR_KEY, 'done'); } catch { /* sin almacenamiento */ } };

export interface TourStep {
  /** Selectores CSS en orden de preferencia: se usa el primero que esté visible. */
  anchor: string[];
  /** Clave en español. */
  title: string;
  /** Clave en español. */
  body: string;
}

const PAD = 6, GAP = 14, POP_W = 340, MARGIN = 12;
interface Box { x: number; y: number; w: number; h: number }

function findAnchor(selectors: string[]): Box | null {
  for (const s of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(s)) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      // Recortado al viewport (paneles altos) y con un poco de aire.
      const x = Math.max(4, r.left - PAD), y = Math.max(4, r.top - PAD);
      return { x, y, w: Math.min(innerWidth - 4, r.right + PAD) - x, h: Math.min(innerHeight - 4, r.bottom + PAD) - y };
    }
  }
  return null;
}

function place(a: Box | null, popH: number): { left: number; top: number } {
  const W = innerWidth, H = innerHeight, w = Math.min(POP_W, W - 2 * MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), H - popH - MARGIN);
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), W - w - MARGIN);
  if (!a) return { left: (W - w) / 2, top: Math.max(MARGIN, (H - popH) / 2) };
  if (a.x + a.w + GAP + w + MARGIN <= W) return { left: a.x + a.w + GAP, top: clampY(a.y + Math.min(24, a.h / 2 - 20)) };
  if (a.x - GAP - w - MARGIN >= 0) return { left: a.x - GAP - w, top: clampY(a.y + Math.min(24, a.h / 2 - 20)) };
  if (a.y + a.h + GAP + popH + MARGIN <= H) return { left: clampX(a.x + a.w / 2 - w / 2), top: a.y + a.h + GAP };
  if (a.y - GAP - popH - MARGIN >= 0) return { left: clampX(a.x + a.w / 2 - w / 2), top: a.y - GAP - popH };
  // El ancla ocupa casi toda la pantalla (lienzo): el popover va dentro, abajo a la derecha.
  return { left: clampX(a.x + a.w - w - 24), top: clampY(a.y + a.h - popH - 24) };
}

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /** Pantalla estrecha: la tarjeta va de lado a lado, arriba o abajo según dónde quede el ancla (para no taparla). */
  const [narrowTop, setNarrowTop] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const titleId = useId(), bodyId = useId();
  const step = steps[i]!;
  const last = i === steps.length - 1;

  const finish = useCallback(() => { markTourSeen(); onClose(); }, [onClose]);
  const next = useCallback(() => { if (last) finish(); else setI(n => n + 1); }, [last, finish]);
  const prev = useCallback(() => setI(n => Math.max(0, n - 1)), []);

  // Medir el ancla (y volver a medir si la ventana cambia o el editor se recoloca).
  useLayoutEffect(() => {
    const measure = () => setAnchor(findAnchor(step.anchor));
    measure();
    const id = setInterval(measure, 400);
    addEventListener('resize', measure);
    return () => { clearInterval(id); removeEventListener('resize', measure); };
  }, [step]);
  useLayoutEffect(() => {
    const h = pop.current?.offsetHeight ?? 180;
    setPos(place(anchor, h));
    setNarrowTop(!!anchor && anchor.y + anchor.h / 2 > innerHeight / 2 && anchor.h < innerHeight * 0.6);
  }, [anchor, i]);

  // Foco: al abrir y en cada paso, al botón principal. Al cerrar, de vuelta a donde estaba.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { pop.current?.querySelector<HTMLElement>('[data-primary]')?.focus(); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = pop.current; if (!el) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); return; }
      const inPop = el.contains(document.activeElement);
      if ((e.key === 'ArrowRight' || (e.key === 'Enter' && !inPop))) { e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); prev(); return; }
      if (e.key === 'Tab') {
        e.stopImmediatePropagation();
        const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]; if (!f.length) return;
        const first = f[0]!, lastEl = f[f.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || !inPop)) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && (document.activeElement === lastEl || !inPop)) { e.preventDefault(); first.focus(); }
        return;
      }
      // El resto de teclas no llegan al editor mientras dura el recorrido.
      if (!inPop) { e.stopImmediatePropagation(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [finish, next, prev]);

  return (
    <div className="tour" data-tour-step={i + 1}>
      <div className="tour__veil" onMouseDown={e => e.preventDefault()} />
      <div className="tour__spot" style={anchor ? { left: anchor.x, top: anchor.y, width: anchor.w, height: anchor.h } : { left: '50%', top: '50%', width: 0, height: 0 }} />
      <div ref={pop} className={`tour__pop ${narrowTop ? 'tour__pop--top' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
        <div className="tour__step">
          <span className="tour__dots" aria-hidden="true">{steps.map((_, n) => <i key={n} className={n === i ? 'is-on' : ''} />)}</span>
          <span>{t('Paso {n} de {total}', { n: i + 1, total: steps.length })}</span>
        </div>
        <h2 id={titleId}>{t(step.title)}</h2>
        <p id={bodyId}>{t(step.body)}</p>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={finish}>{t('Saltar el recorrido')}</button>
          <span className="spacer" />
          {i > 0 && <button type="button" className="btn btn--sm" onClick={prev}>{t('Anterior')}</button>}
          <button type="button" className="btn btn--primary btn--sm" data-primary onClick={next}>{last ? t('Finalizar') : t('Siguiente')}{!last && <Icon name="arrowRight" size={14} />}</button>
        </div>
        <button type="button" className="btn btn--ghost btn--icon btn--sm tour__close" aria-label={t('Cerrar el recorrido')} title={t('Cerrar el recorrido')} onClick={finish}><Icon name="close" size={14} /></button>
      </div>
    </div>
  );
}

/** ¿Pantalla táctil sin ratón? (los pasos hablan de tocar y mantener pulsado en vez de arrastrar y botón derecho). */
const isTouch = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

/** Los pasos del recorrido del editor (anclas: clases del editor y `data-tour` de la barra). */
export function editorTourSteps(mode: 'local' | 'server', touch = isTouch()): TourStep[] {
  return [
    { anchor: ['.ad-views', '.ad-tabbar__btn:nth-child(1)'], title: 'Vistas', body: 'Cada vista dibuja una parte del modelo en una notación. Ábrelas desde aquí; las de detalle cuelgan de un elemento.' },
    touch
      ? { anchor: ['.ad-tabbar__btn:nth-child(2)', '.ad-pal'], title: 'Paleta', body: 'Toca «Añadir» y elige un tipo para crear un elemento en el lienzo. En la pestaña Modelo están los que ya existen, para reutilizarlos en esta vista.' }
      : { anchor: ['.ad-pal', '.ad-tabbar__btn:nth-child(2)'], title: 'Paleta', body: 'Arrastra un tipo al lienzo para crear un elemento. En la pestaña Modelo están los que ya existen, para reutilizarlos en esta vista.' },
    touch
      ? { anchor: ['.ad-canvas'], title: 'Lienzo', body: 'Arrastra con el dedo para mover elementos y pellizca para el zoom. En «Más» están la búsqueda y el resto de acciones.' }
      : { anchor: ['.ad-canvas'], title: 'Lienzo', body: 'Mueve, redimensiona y renombra con doble clic. Rueda o pellizco para el zoom; Ctrl+K busca elementos, vistas y acciones.' },
    touch
      ? { anchor: ['.ad-canvas .react-flow__node:not(.react-flow__node-group)', '.ad-canvas'], title: 'Conectar', body: 'Toca un elemento y arrastra desde uno de sus puntos hasta otro. Solo se ofrecen las relaciones válidas en la notación de la vista.' }
      : { anchor: ['.ad-canvas .react-flow__node:not(.react-flow__node-group)', '.ad-canvas'], title: 'Conectar', body: 'Pasa el puntero por un elemento y arrastra desde uno de sus puntos hasta otro. Solo se ofrecen las relaciones válidas en la notación de la vista.' },
    touch
      ? { anchor: ['.ad-canvas .react-flow__node:not(.react-flow__node-group)', '.ad-canvas'], title: 'Otra dimensión', body: 'Mantén pulsado un elemento y elige «Abrir en otra dimensión» para llevarlo a una vista BPMN, de estados, C4… Es el mismo elemento en todas.' }
      : { anchor: ['.ad-views__dims', '.ad-views'], title: 'Otra dimensión', body: 'Con el botón derecho sobre un elemento, «Abrir en otra dimensión» lo lleva a una vista BPMN, de estados, C4… Es el mismo elemento en todas.' },
    { anchor: ['.ad-insp', '.ad-tabbar__btn:nth-child(3)'], title: 'Inspector', body: 'Muestra lo seleccionado: datos, pines, dónde aparece y estilo. Sin selección, las propiedades de la vista.' },
    mode === 'server'
      ? { anchor: ['[data-tour="share"]'], title: 'Compartir', body: 'Crea enlaces de edición o de lectura: quien los abra trabaja contigo en tiempo real. El historial guarda instantáneas.' }
      : { anchor: ['[data-tour="share"]'], title: 'Compartir', body: 'Este espacio vive en tu navegador y funciona sin conexión. Súbelo al servidor para compartirlo y editar a la vez.' },
    { anchor: ['[data-tour="help"]', '.ad-toolbar--compact .ad-btn[aria-haspopup="dialog"]'], title: 'Ayuda', body: 'La documentación, los atajos de teclado y este recorrido, por si quieres repetirlo.' },
  ];
}
