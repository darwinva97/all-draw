import { useEffect, useRef, useState } from 'react';
import { DEFAULT_VALIDATORS, type Diagnostic, type Validator, type ValidatorContext } from '@all-draw/core';
import { useT, tMsg, tn } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';
import { Icon } from '../icons';
import { HelpLink } from './HelpLink';

/** Espera de silencio antes de recalcular (los arrastres y el tecleo generan ráfagas de cambios). */
export const PROBLEMS_DEBOUNCE_MS = 300;
/**
 * Un validador que tardó más que esto (ms) la última vez espera a `SLOW_DEBOUNCE_MS` de calma (la geometría de una vista
 * de 600 nodos: 150–450 ms de una tirada). Así no se cruza con cada arrastre o tecla; mientras, cuenta su último resultado.
 */
export const SLOW_VALIDATOR_MS = 80;
export const SLOW_DEBOUNCE_MS = 1000;
/** Problemas que se pintan de golpe en la lista; el resto sale con "mostrar más" (un espacio grande da miles de notas). */
export const PROBLEMS_PAGE = 200;

/** Hueco de inactividad: `timeRemaining()` ms libres antes del siguiente frame (sin `requestIdleCallback`, 0). */
export interface IdleSlot { timeRemaining(): number }
type Schedule = (fn: (slot?: IdleSlot) => void) => () => void;

/** Ejecuta `fn` en un hueco de inactividad (o en el siguiente tick si el navegador no lo ofrece). Devuelve el cancelador. */
function whenIdle(fn: (slot?: IdleSlot) => void): () => void {
  const g = globalThis as { requestIdleCallback?: (cb: (d: IdleSlot) => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (typeof g.requestIdleCallback === 'function') { const id = g.requestIdleCallback(fn, { timeout: 2000 }); return () => g.cancelIdleCallback?.(id); }
  const id = setTimeout(() => fn(), 0); return () => clearTimeout(id);
}

/** Margen que se deja libre en cada hueco (ms): si queda menos, el siguiente validador espera a otro hueco. */
export const IDLE_MARGIN_MS = 6;

/**
 * Valida troceado: un validador por hueco de inactividad (y más en el mismo hueco mientras quede tiempo), en vez de
 * todos de golpe. Con vistas grandes la geometría y bpmnlint cuestan decenas de ms cada uno; así ninguna tarea larga
 * se cruza con un clic o un arrastre. Devuelve el cancelador; `onDone` recibe todos los diagnósticos, en el orden de
 * `validators` (igual que `validate` del núcleo).
 */
export function validateInSlices(validators: Validator[], ctx: ValidatorContext, onDone: (d: Diagnostic[]) => void, schedule: Schedule = whenIdle,
  onEach?: (v: Validator, out: Diagnostic[], ms: number) => void): () => void {
  let i = 0, cancelled = false, cancel = () => {};
  const out: Diagnostic[] = [];
  const now = () => globalThis.performance?.now() ?? Date.now();
  const step = (slot?: IdleSlot) => {
    if (cancelled) return;
    do { const v = validators[i]!, t0 = now(), d = v.run(ctx); out.push(...d); onEach?.(v, d, now() - t0); i++; }
    while (i < validators.length && !!slot && slot.timeRemaining() > IDLE_MARGIN_MS);
    if (i < validators.length) cancel = schedule(step);
    else onDone(out);
  };
  if (validators.length) cancel = schedule(step); else onDone(out);
  return () => { cancelled = true; cancel(); };
}

const SEV_RANK: Record<string, number> = { error: 0, warning: 1 };
/** Errores, después avisos y después notas (orden estable dentro de cada grupo): con la lista paginada, lo grave arriba. */
export function bySeverity(d: Diagnostic[]): Diagnostic[] {
  return d.map((x, i) => ({ x, i })).sort((a, b) => (SEV_RANK[a.x.severity] ?? 2) - (SEV_RANK[b.x.severity] ?? 2) || a.i - b.i).map(o => o.x);
}

export function Problems() {
  const t = useT();
  const { store, registry, run, readOnly, select, openView, validators, viewId } = useEditor();
  const v = useAnyChange();
  const [open, setOpen] = useState(false);
  const [diags, setDiags] = useState<Diagnostic[]>([]);
  const [computing, setComputing] = useState(true);
  const [shown, setShown] = useState(PROBLEMS_PAGE);
  /** Lo que tardó cada validador la última vez y su último resultado (por vista: los de geometría solo miran la actual). */
  const cost = useRef(new Map<string, number>());
  const results = useRef(new Map<string, Diagnostic[]>());
  // Recalcular con retardo y en huecos de inactividad, un validador por hueco; los lentos, tras más calma.
  useEffect(() => {
    setComputing(true);
    const all = [...DEFAULT_VALIDATORS, ...validators];
    const key = (x: Validator) => `${viewId ?? ''}|${x.id}`;
    const slow = all.filter(x => (cost.current.get(x.id) ?? 0) > SLOW_VALIDATOR_MS);
    const fast = all.filter(x => !slow.includes(x));
    const ctx = { store, reg: registry, viewId };
    const onEach = (x: Validator, d: Diagnostic[], ms: number) => { cost.current.set(x.id, ms); results.current.set(key(x), d); };
    const publish = () => setDiags(bySeverity(all.flatMap(x => results.current.get(key(x)) ?? [])));
    let parts = slow.length ? 2 : 1;
    const partDone = () => { publish(); if (--parts === 0) setComputing(false); };
    const cancels: (() => void)[] = [];
    const later = (list: Validator[], ms: number) => { const timer = setTimeout(() => cancels.push(validateInSlices(list, ctx, partDone, undefined, onEach)), ms); cancels.push(() => clearTimeout(timer)); };
    later(fast, PROBLEMS_DEBOUNCE_MS);
    if (slow.length) later(slow, SLOW_DEBOUNCE_MS);
    return () => { for (const c of cancels) c(); };
  }, [store, registry, validators, viewId, v]);
  const errors = diags.filter(d => d.severity === 'error').length, warns = diags.filter(d => d.severity === 'warning').length;
  const notes = diags.length - errors - warns;
  const nErrors = tn('{n} error', '{n} errores', errors), nWarns = tn('{n} aviso', '{n} avisos', warns), nNotes = tn('{n} nota', '{n} notas', notes);
  const goTo = (d: Diagnostic) => {
    if (d.subject.collection === 'nodes') { const n = store.get('nodes', d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'edges') { const e = store.get('edges', d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'elements') { const n = store.list('nodes').find(x => x.elementId === d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'relations') { const e = store.list('edges').find(x => x.relationId === d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'views') openView(d.subject.id);
  };
  return (
    <div className={`ad-problems ${open ? 'is-open' : ''}`}>
      <button className="ad-problems__bar" aria-expanded={open} aria-label={t('Problemas: {list}', { list: `${nErrors}, ${nWarns}, ${nNotes}` })} onClick={() => setOpen(o => !o)}>
        <span className={`ad-problems__count ${errors ? 'ad-sev-error' : ''}`}><Icon name="error" size={14} />{nErrors}</span><span className={`ad-problems__count ${warns ? 'ad-sev-warning' : ''}`}><Icon name="warning" size={14} />{nWarns}</span><span className="ad-problems__count"><Icon name="info" size={14} />{nNotes}</span>{computing && <span className="ad-problems__busy" aria-live="polite"> · {t('calculando…')}</span>}
      </button>
      {open && <div className="ad-problems__list" role="region" aria-label={t('Lista de problemas')}>
        <div className="ad-problems__head"><span>{t('El validador revisa el modelo y la vista actual mientras editas.')}</span><HelpLink slug="editor" /></div>
        {diags.length === 0 && <div className="ad-empty ad-empty--ok"><Icon name="success" size={18} />{t('Sin problemas.')}</div>}
        {diags.slice(0, shown).map((d, i) => <div key={i} className={`ad-problem ad-sev-${d.severity}`}>
          <button className="ad-link" onClick={() => goTo(d)}><code>{d.code}</code> {d.messageKey ? tMsg(d.messageKey, d.vars) : d.message}</button>
          {!readOnly && d.supportedFixes.map((f, j) => <button key={j} className="ad-btn" onClick={() => run(f.command)}>{f.labelKey ? tMsg(f.labelKey, f.vars) : f.label}</button>)}
        </div>)}
        {diags.length > shown && <button className="ad-btn ad-problems__more" onClick={() => setShown(n => n + PROBLEMS_PAGE)}>{t('Mostrar más ({n} de {total})', { n: shown, total: diags.length })}</button>}
      </div>}
    </div>
  );
}
