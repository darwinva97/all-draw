import { useMemo, useState } from 'react';
import { validate, type Diagnostic } from '@all-draw/core';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';

export function Problems() {
  const { store, registry, run, readOnly, select, openView } = useEditor();
  const v = useAnyChange();
  const [open, setOpen] = useState(false);
  const diags = useMemo(() => validate(store, registry), [store, registry, v]);
  const errors = diags.filter(d => d.severity === 'error').length, warns = diags.filter(d => d.severity === 'warning').length;
  const goTo = (d: Diagnostic) => {
    if (d.subject.collection === 'nodes') { const n = store.get('nodes', d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'edges') { const e = store.get('edges', d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'elements') { const n = store.list('nodes').find(x => x.elementId === d.subject.id); if (n) { openView(n.viewId); select({ nodes: [n.id], edges: [] }); } }
    else if (d.subject.collection === 'relations') { const e = store.list('edges').find(x => x.relationId === d.subject.id); if (e) { openView(e.viewId); select({ nodes: [], edges: [e.id] }); } }
    else if (d.subject.collection === 'views') openView(d.subject.id);
  };
  return (
    <div className={`ad-problems ${open ? 'is-open' : ''}`}>
      <button className="ad-problems__bar" onClick={() => setOpen(o => !o)}>
        <span className={errors ? 'ad-sev-error' : ''}>● {errors} errores</span> <span className={warns ? 'ad-sev-warning' : ''}>▲ {warns} avisos</span> <span>ℹ {diags.length - errors - warns} notas</span>
      </button>
      {open && <div className="ad-problems__list">
        {diags.length === 0 && <div className="ad-empty">Sin problemas.</div>}
        {diags.map((d, i) => <div key={i} className={`ad-problem ad-sev-${d.severity}`}>
          <button className="ad-link" onClick={() => goTo(d)}><code>{d.code}</code> {d.message}</button>
          {!readOnly && d.supportedFixes.map((f, j) => <button key={j} className="ad-btn" onClick={() => run(f.command)}>{f.label}</button>)}
        </div>)}
      </div>}
    </div>
  );
}
