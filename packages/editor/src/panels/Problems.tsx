import { useEffect, useState } from 'react';
import { validate, DEFAULT_VALIDATORS, type Diagnostic } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';

/** Espera de silencio antes de recalcular (los arrastres y el tecleo generan ráfagas de cambios). */
export const PROBLEMS_DEBOUNCE_MS = 300;

/** Ejecuta `fn` en un hueco de inactividad (o en el siguiente tick si el navegador no lo ofrece). Devuelve el cancelador. */
function whenIdle(fn: () => void): () => void {
  const g = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (typeof g.requestIdleCallback === 'function') { const id = g.requestIdleCallback(fn, { timeout: 1000 }); return () => g.cancelIdleCallback?.(id); }
  const id = setTimeout(fn, 0); return () => clearTimeout(id);
}

export function Problems() {
  const t = useT();
  const { store, registry, run, readOnly, select, openView, validators, viewId } = useEditor();
  const v = useAnyChange();
  const [open, setOpen] = useState(false);
  const [diags, setDiags] = useState<Diagnostic[]>([]);
  const [computing, setComputing] = useState(true);
  // Recalcular con retardo y en tiempo de inactividad: los validadores por vista (geometría) solo miran la vista actual.
  useEffect(() => {
    setComputing(true);
    let cancelIdle = () => {};
    const timer = setTimeout(() => {
      cancelIdle = whenIdle(() => { setDiags(validate(store, registry, [...DEFAULT_VALIDATORS, ...validators], viewId)); setComputing(false); });
    }, PROBLEMS_DEBOUNCE_MS);
    return () => { clearTimeout(timer); cancelIdle(); };
  }, [store, registry, validators, viewId, v]);
  const errors = diags.filter(d => d.severity === 'error').length, warns = diags.filter(d => d.severity === 'warning').length;
  const notes = diags.length - errors - warns;
  const goTo = (d: Diagnostic) => {
    if (d.subject.collection === 'nodes') { const n = store.get('nodes', d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'edges') { const e = store.get('edges', d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'elements') { const n = store.list('nodes').find(x => x.elementId === d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'relations') { const e = store.list('edges').find(x => x.relationId === d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'views') openView(d.subject.id);
  };
  return (
    <div className={`ad-problems ${open ? 'is-open' : ''}`}>
      <button className="ad-problems__bar" aria-expanded={open} aria-label={t('Problemas: {errors} errores, {warns} avisos, {notes} notas', { errors, warns, notes })} onClick={() => setOpen(o => !o)}>
        <span className={errors ? 'ad-sev-error' : ''}>● {t('{n} errores', { n: errors })}</span> <span className={warns ? 'ad-sev-warning' : ''}>▲ {t('{n} avisos', { n: warns })}</span> <span>ℹ {t('{n} notas', { n: notes })}</span>{computing && <span className="ad-problems__busy" aria-live="polite"> · {t('calculando…')}</span>}
      </button>
      {open && <div className="ad-problems__list" role="region" aria-label={t('Lista de problemas')}>
        {diags.length === 0 && <div className="ad-empty">{t('Sin problemas.')}</div>}
        {diags.map((d, i) => <div key={i} className={`ad-problem ad-sev-${d.severity}`}>
          <button className="ad-link" onClick={() => goTo(d)}><code>{d.code}</code> {d.message}</button>
          {!readOnly && d.supportedFixes.map((f, j) => <button key={j} className="ad-btn" onClick={() => run(f.command)}>{f.label}</button>)}
        </div>)}
      </div>}
    </div>
  );
}
