/**
 * Diálogos propios que sustituyen a `confirm()`, `prompt()` y `alert()` del navegador:
 *
 *   if (!(await confirmDialog({ title: '¿Borrar la vista?', danger: true }))) return;
 *   const url = await promptDialog({ title: 'Añadir imagen', label: 'URL de la imagen' });
 *   await noticeDialog({ title: 'Avisos', items: warnings });
 *
 * (Los textos se pasan ya traducidos con `t()`.)
 *
 * Accesibles: `role="alertdialog"` (o `dialog` con campo), `aria-modal`, título y descripción enlazados,
 * foco atrapado, Escape cancela y el foco vuelve a donde estaba. Uno a la vez (cola). Van en la capa flotante.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useT } from '@all-draw/i18n';
import { Icon } from '../icons';
import { mountInLayer, FOCUSABLE } from './layer';
import { mountUiLayer, registerDialogHost } from './toast';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Texto del botón de aceptar (por defecto "Aceptar"; con `danger`, "Borrar"). */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva: botón rojo y el foco empieza en Cancelar. */
  danger?: boolean;
}
export interface PromptOptions {
  title: string;
  message?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'url' | 'email';
  /** Devuelve un mensaje de error para impedir aceptar, o null si vale. */
  validate?: (value: string) => string | null;
}
export interface NoticeOptions {
  title: string;
  message?: string;
  /** Lista (p. ej. avisos de una importación); se recorta a `max` con "… y N más". */
  items?: string[];
  max?: number;
  okLabel?: string;
}

type Req =
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { id: number; kind: 'notice'; opts: NoticeOptions; resolve: () => void };

let queue: Req[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => { for (const f of subs) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const current = () => queue[0] ?? null;

type Resolver<T> = (v: T) => void;
function push<T>(make: (id: number, resolve: Resolver<T>) => Req): Promise<T> {
  // Sin DOM (tests, servidor) no hay a quién preguntar: se cancela.
  if (typeof document === 'undefined') return Promise.resolve(undefined as T);
  mountUiLayer();
  return new Promise<T>(resolve => {
    const id = ++seq;
    queue = [...queue, make(id, v => { queue = queue.filter(r => r.id !== id); emit(); resolve(v); })];
    emit();
  });
}

/** Confirmación (sí/no). Resuelve `true` si se acepta. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return push<boolean>((id, resolve) => ({ id, kind: 'confirm', opts, resolve }));
}
/** Pide un texto. Resuelve el texto (sin recortar) o `null` si se cancela. */
export function promptDialog(opts: PromptOptions): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return push<string | null>((id, resolve) => ({ id, kind: 'prompt', opts, resolve }));
}
/** Aviso informativo con un solo botón. */
export function noticeDialog(opts: NoticeOptions): Promise<void> {
  return push<void>((id, resolve) => ({ id, kind: 'notice', opts, resolve: () => resolve() }));
}
/** ¿Hay un diálogo propio abierto? */
export function isDialogOpen(): boolean { return queue.length > 0; }

function DialogView({ req }: { req: Req }) {
  const t = useT();
  const titleId = useId(), descId = useId(), inputId = useId(), errId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(req.kind === 'prompt' ? req.opts.defaultValue ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  const cancel = () => {
    if (req.kind === 'confirm') req.resolve(false);
    else if (req.kind === 'prompt') req.resolve(null);
    else req.resolve();
  };
  const cancelRef = useRef(cancel); cancelRef.current = cancel;

  useEffect(() => {
    const el = box.current; if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    const start = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
    start?.focus();
    if (start instanceof HTMLInputElement) start.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancelRef.current(); return; }
      if (e.key !== 'Tab') return;
      e.stopImmediatePropagation(); // las trampas de foco de otros modales (debajo) no deben robar el Tab
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]; if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); if (opener?.isConnected) opener.focus?.(); };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (req.kind === 'confirm') req.resolve(true);
    else if (req.kind === 'notice') req.resolve();
    else {
      const msg = req.opts.validate?.(value) ?? null;
      if (msg) { setError(msg); return; }
      req.resolve(value);
    }
  };
  const o = req.opts;
  const danger = req.kind === 'confirm' && !!req.opts.danger;
  const okLabel = req.kind === 'confirm' ? req.opts.confirmLabel ?? (danger ? t('Borrar') : t('Aceptar'))
    : req.kind === 'prompt' ? req.opts.confirmLabel ?? t('Aceptar') : req.opts.okLabel ?? t('Entendido');
  const items = req.kind === 'notice' ? req.opts.items ?? [] : [];
  const max = req.kind === 'notice' ? req.opts.max ?? 12 : 0;
  return (
    <div className="ad-dlg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
      <form ref={box} className={`ad-dlg ${danger ? 'ad-dlg--danger' : ''}`} role={req.kind === 'prompt' ? 'dialog' : 'alertdialog'} aria-modal="true"
        aria-labelledby={titleId} aria-describedby={o.message || items.length ? descId : undefined} onSubmit={submit} noValidate>
        <div className="ad-dlg__head">
          {danger && <span className="ad-dlg__badge" aria-hidden="true"><Icon name="warning" size={18} /></span>}
          {req.kind === 'notice' && <span className="ad-dlg__badge ad-dlg__badge--info" aria-hidden="true"><Icon name="info" size={18} /></span>}
          <h2 id={titleId} className="ad-dlg__title">{o.title}</h2>
        </div>
        {(o.message || items.length > 0) && <div id={descId} className="ad-dlg__desc">
          {o.message && <p>{o.message}</p>}
          {items.length > 0 && <ul className="ad-dlg__list">
            {items.slice(0, max).map((w, i) => <li key={i}>{w}</li>)}
            {items.length > max && <li className="ad-dlg__more">{t('… y {n} más', { n: items.length - max })}</li>}
          </ul>}
        </div>}
        {req.kind === 'prompt' && <div className="ad-dlg__field">
          <label htmlFor={inputId}>{req.opts.label}</label>
          <input id={inputId} type={req.opts.inputType ?? 'text'} value={value} placeholder={req.opts.placeholder} autoComplete="off" spellCheck={false}
            aria-invalid={!!error} aria-describedby={error ? errId : undefined} data-autofocus onChange={e => { setValue(e.target.value); setError(null); }} />
          {error && <p id={errId} className="ad-dlg__error" role="alert">{error}</p>}
        </div>}
        <div className="ad-dlg__actions">
          {req.kind !== 'notice' && <button type="button" className="ad-dlg__btn" onClick={cancel} data-autofocus={danger || undefined}>{(req.kind === 'confirm' ? req.opts.cancelLabel : req.opts.cancelLabel) ?? t('Cancelar')}</button>}
          <button type="submit" className={`ad-dlg__btn ${danger ? 'ad-dlg__btn--danger' : 'ad-dlg__btn--primary'}`} data-autofocus={(!danger && req.kind !== 'prompt') || undefined}>{okLabel}</button>
        </div>
      </form>
    </div>
  );
}

/** Muestra el primer diálogo de la cola. Va en la capa flotante; no hace falta montarlo a mano. */
export function DialogHost() {
  const req = useSyncExternalStore(subscribe, current, current);
  return req ? <DialogView key={req.id} req={req} /> : null;
}

registerDialogHost(() => mountInLayer('dialogs', DialogHost));
