/**
 * Avisos efímeros ("toasts"): `toast('Guardado')`, `toast.error('No se pudo…', { action: { label: 'Reintentar', onClick } })`.
 *
 * - Abajo a la derecha (abajo al centro en móvil), como mucho 4 a la vez; el más nuevo, abajo.
 * - Se cierran solos (5 s; 8 s los errores; 10 s si llevan acción; `duration: Infinity` para fijos). El tiempo se
 *   detiene con el puntero o el foco encima y con la pestaña oculta.
 * - Región `aria-live` siempre montada (los errores, `role="alert"`). Sin dependencias.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useT } from '@all-draw/i18n';
import { Icon, type IconName } from '../icons';
import { mountInLayer } from './layer';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface ToastAction { label: string; onClick: () => void }
export interface ToastOptions {
  kind?: ToastKind;
  /** Segunda línea, más pequeña. */
  description?: string;
  action?: ToastAction;
  /** Milisegundos; `Infinity` = hasta que se cierre a mano. */
  duration?: number;
  /** Un aviso con el mismo id sustituye al anterior (p. ej. "sin conexión" repetido). */
  id?: string;
}
interface ToastItem extends Required<Pick<ToastOptions, 'kind' | 'duration'>> { id: string; message: string; description?: string; action?: ToastAction; leaving: boolean }

const MAX = 4;
const EXIT_MS = 180;
let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snapshot = () => items;

function show(message: string, opts: ToastOptions = {}): string {
  mountUiLayer();
  const kind = opts.kind ?? 'info';
  const id = opts.id ?? `toast-${++seq}`;
  const duration = opts.duration ?? (opts.action ? 10_000 : kind === 'error' ? 8_000 : 5_000);
  const item: ToastItem = { id, message, description: opts.description, action: opts.action, kind, duration, leaving: false };
  const i = items.findIndex(x => x.id === id);
  items = i >= 0 ? items.map(x => (x.id === id ? item : x)) : [...items, item];
  const live = items.filter(x => !x.leaving);
  if (live.length > MAX) for (const x of live.slice(0, live.length - MAX)) dismissToast(x.id);
  emit();
  return id;
}

/** Cierra un aviso (con su animación de salida). */
export function dismissToast(id: string): void {
  if (!items.some(x => x.id === id && !x.leaving)) return;
  items = items.map(x => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  setTimeout(() => { items = items.filter(x => x.id !== id || !x.leaving); emit(); }, EXIT_MS);
}

type ToastFn = ((message: string, opts?: ToastOptions) => string) & {
  success(message: string, opts?: ToastOptions): string;
  error(message: string, opts?: ToastOptions): string;
  warning(message: string, opts?: ToastOptions): string;
  info(message: string, opts?: ToastOptions): string;
  dismiss(id: string): void;
};
export const toast: ToastFn = Object.assign(show, {
  success: (m: string, o?: ToastOptions) => show(m, { ...o, kind: 'success' }),
  error: (m: string, o?: ToastOptions) => show(m, { ...o, kind: 'error' }),
  warning: (m: string, o?: ToastOptions) => show(m, { ...o, kind: 'warning' }),
  info: (m: string, o?: ToastOptions) => show(m, { ...o, kind: 'info' }),
  dismiss: dismissToast,
});

const ICON: Record<ToastKind, IconName> = { info: 'info', success: 'success', warning: 'warning', error: 'error' };

function ToastView({ item }: { item: ToastItem }) {
  const t = useT();
  const hold = useRef(0);
  const left = useRef(item.duration);
  useEffect(() => {
    if (!Number.isFinite(item.duration) || item.leaving) return;
    left.current = item.duration;
    let start = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => { if (timer || hold.current > 0 || document.hidden) return; start = Date.now(); timer = setTimeout(() => dismissToast(item.id), left.current); };
    const pause = () => { if (!timer) return; clearTimeout(timer); timer = null; left.current = Math.max(800, left.current - (Date.now() - start)); };
    const onVis = () => (document.hidden ? pause() : arm());
    const onHold = (e: Event) => { hold.current = (e as CustomEvent<number>).detail; if (hold.current > 0) pause(); else arm(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('ad-toast-hold', onHold);
    arm();
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('ad-toast-hold', onHold); };
  }, [item.id, item.duration, item.leaving, item.message]);
  return (
    <li className={`ad-toast ad-toast--${item.kind}`} data-leaving={item.leaving || undefined} role={item.kind === 'error' ? 'alert' : 'status'}>
      <span className="ad-toast__icon"><Icon name={ICON[item.kind]} /></span>
      <div className="ad-toast__body">
        <p className="ad-toast__msg">{item.message}</p>
        {item.description && <p className="ad-toast__desc">{item.description}</p>}
      </div>
      {item.action && <button type="button" className="ad-toast__action" onClick={() => { item.action!.onClick(); dismissToast(item.id); }}>{item.action.label}</button>}
      <button type="button" className="ad-toast__close" aria-label={t('Cerrar aviso')} title={t('Cerrar aviso')} onClick={() => dismissToast(item.id)}><Icon name="close" size={14} /></button>
    </li>
  );
}

/** Pila de avisos. Va en la capa flotante; no hace falta montarlo a mano. */
export function Toaster() {
  const t = useT();
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  // Con el puntero o el foco dentro de la pila, todos los temporizadores se detienen (como Sonner).
  const hold = (n: number) => window.dispatchEvent(new CustomEvent('ad-toast-hold', { detail: n }));
  return (
    <section className="ad-toasts" aria-label={t('Notificaciones')} aria-live="polite" aria-relevant="additions"
      onMouseEnter={() => hold(1)} onMouseLeave={() => hold(0)} onFocus={() => hold(1)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold(0); }}>
      <ol className="ad-toasts__list">{list.map(it => <ToastView key={it.id} item={it} />)}</ol>
    </section>
  );
}

/** Monta la capa de avisos y diálogos (idempotente). Conviene llamarlo al arrancar para que la región `aria-live` exista antes del primer aviso. */
export function mountUiLayer(): void {
  mountInLayer('toasts', Toaster);
  mountDialogHost?.();
}
/** Lo rellena `dialog.tsx` al cargarse (evita la importación circular). */
let mountDialogHost: (() => void) | undefined;
export function registerDialogHost(f: () => void): void { mountDialogHost = f; }
