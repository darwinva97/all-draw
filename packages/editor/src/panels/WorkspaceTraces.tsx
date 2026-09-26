/**
 * Trazabilidad entre dimensiones: matriz de dos notaciones (● relación puente, ○ sugerencia),
 * cobertura y huecos con enlace automático. `ElementTraces` es la sección de trazas del inspector.
 */
import { useMemo, useState } from 'react';
import type { TraceSuggestion } from '@all-draw/core';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';
import {
  notationsInModel, matrixRows, coverage, gapsBetween, bestSuggestionCommand, bestSuggestionsBatch,
  elementTraces, topSuggestions, linkCommand, firstNodeOf, scoreLabel,
} from './traces-helpers';

const MIN_BATCH_SCORE = 0.8;

/** Pestaña Trazabilidad del panel Espacio. `onNavigate` cierra el panel al saltar a una vista. */
export function TracesTab({ onNavigate }: { onNavigate?: () => void }) {
  const { store, registry, run, readOnly, openView, select } = useEditor();
  const version = useAnyChange();
  const notations = useMemo(() => notationsInModel(store, registry), [store, registry, version]);
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [filter, setFilter] = useState('');
  const na = notations.includes(a) ? a : (notations[0] ?? '');
  const nb = notations.includes(b) && b !== na ? b : (notations.find(n => n !== na) ?? '');
  const ready = !!na && !!nb;
  const packName = (id: string) => registry.pack(id)?.name ?? id;

  const view = useMemo(() => (ready ? matrixRows(store, registry, na, nb, filter) : null), [store, registry, na, nb, filter, version]);
  const cov = useMemo(() => (ready ? coverage(store, registry, na, nb) : null), [store, registry, na, nb, version]);
  const gaps = useMemo(() => (ready ? gapsBetween(store, registry, na, nb) : []), [store, registry, na, nb, version]);
  const batch = useMemo(() => (ready ? bestSuggestionsBatch(store, registry, MIN_BATCH_SCORE, gaps) : null), [store, registry, gaps, ready]);

  const goTo = (elementId: string) => {
    const hit = firstNodeOf(store, elementId);
    if (!hit) return;
    openView(hit.viewId);
    select({ nodes: [hit.nodeId], edges: [] });
    onNavigate?.();
  };
  const link = (sourceId: string, s: TraceSuggestion) => { if (!readOnly) run(linkCommand(sourceId, s)); };

  if (notations.length < 2) {
    return <div className="ad-ws-main ad-tr-main"><div className="ad-empty">La trazabilidad cruza dos notaciones: el modelo solo tiene {notations.length === 1 ? packName(notations[0]!) : 'elementos sin notación'}.</div></div>;
  }

  return (
    <div className="ad-ws-main ad-tr-main">
      <div className="ad-tr-bar">
        <label className="ad-tr-sel">Filas
          <select className="ad-input" value={na} onChange={e => setA(e.target.value)}>{notations.map(n => <option key={n} value={n}>{packName(n)}</option>)}</select>
        </label>
        <button className="ad-btn ad-btn--ghost" title="Intercambiar" aria-label="Intercambiar filas y columnas" onClick={() => { setA(nb); setB(na); }}>⇄</button>
        <label className="ad-tr-sel">Columnas
          <select className="ad-input" value={nb} onChange={e => setB(e.target.value)}>{notations.filter(n => n !== na).map(n => <option key={n} value={n}>{packName(n)}</option>)}</select>
        </label>
        <input className="ad-input ad-tr-filter" placeholder="Filtrar por nombre…" value={filter} onChange={e => setFilter(e.target.value)} />
        {cov && <span className="ad-tr-cov" data-testid="ad-tr-coverage">{cov.traced} de {cov.total} elementos {packName(na)} tienen traza en {packName(nb)}</span>}
      </div>

      {view && view.rows.length > 0 && view.cols.length > 0 && (
        <div className="ad-tr-scroll">
          <table className="ad-tr-matrix">
            <thead>
              <tr>
                <th className="ad-tr-corner"><small>{packName(na)} ↓ · {packName(nb)} →</small></th>
                {view.cols.map(c => <th key={c.id} className="ad-tr-colhead"><button className="ad-tr-head" title={`${c.name} · ${registry.elementType(c.typeId)?.name ?? c.typeId}`} onClick={() => goTo(c.id)}><span>{c.name || '(sin nombre)'}</span></button></th>)}
              </tr>
            </thead>
            <tbody>
              {view.rows.map(r => (
                <tr key={r.element.id}>
                  <th className="ad-tr-rowhead"><button className="ad-tr-head" title={`${r.element.name} · ${registry.elementType(r.element.typeId)?.name ?? r.element.typeId}`} onClick={() => goTo(r.element.id)}>{r.element.name || '(sin nombre)'}</button></th>
                  {r.cells.map(c => {
                    if (c.relations.length) {
                      const types = c.relations.map(x => registry.relationType(x.typeId)?.name ?? x.typeId).join(', ');
                      return <td key={c.col.id} className="ad-tr-cell is-linked" title={types}><span aria-label={types}>●</span></td>;
                    }
                    if (c.suggestion) {
                      const s = c.suggestion;
                      const tip = `Sugerencia ${scoreLabel(s.score)}: ${s.reason}${readOnly ? '' : ' (clic para enlazar)'}`;
                      return <td key={c.col.id} className="ad-tr-cell is-suggested" title={tip} style={{ opacity: 0.45 + s.score * 0.55 }}>
                        {readOnly ? <span>○</span> : <button className="ad-tr-sug" aria-label={tip} onClick={() => link(r.element.id, s)}>○</button>}
                      </td>;
                    }
                    return <td key={c.col.id} className="ad-tr-cell" />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view && (view.rows.length === 0 || view.cols.length === 0) && <div className="ad-empty">No hay elementos que cruzar.</div>}
      {view && (view.rows.length < view.totalRows || view.cols.length < view.totalCols) && <div className="ad-hint">Mostrando {view.rows.length} de {view.totalRows} filas y {view.cols.length} de {view.totalCols} columnas.</div>}

      <div className="ad-tr-gaps">
        <div className="ad-section">Huecos <small>({gaps.length})</small></div>
        {gaps.length === 0 && <div className="ad-hint">Todos los elementos de {packName(na)} y {packName(nb)} tienen alguna traza a otra notación.</div>}
        {!readOnly && batch && batch.type === 'batch' && (
          <div className="ad-row ad-tr-gaps__actions">
            <button className="ad-btn ad-btn--primary" onClick={() => run(batch)}>Enlazar todas las sugerencias con score ≥ {scoreLabel(MIN_BATCH_SCORE)} ({batch.commands.length})</button>
          </div>
        )}
        <ul className="ad-tr-gaplist">
          {gaps.map(g => {
            const top = g.suggestions[0];
            const cmd = bestSuggestionCommand(g);
            return (
              <li key={g.element.id} className="ad-tr-gap">
                <button className="ad-tr-head ad-tr-gap__name" onClick={() => goTo(g.element.id)}>{g.element.name || '(sin nombre)'}</button>
                <small className="ad-tr-gap__meta">{packName(g.notationId)} · {registry.elementType(g.element.typeId)?.name ?? g.element.typeId}</small>
                {top
                  ? <span className="ad-tr-gap__sug" title={top.reason}>→ {top.target.name} <small>({registry.relationType(top.relationTypeId)?.name ?? top.relationTypeId}, {scoreLabel(top.score)})</small></span>
                  : <span className="ad-tr-gap__sug ad-tr-muted">sin sugerencias</span>}
                {!readOnly && cmd && <button className="ad-btn" onClick={() => run(cmd)}>Enlazar mejor sugerencia</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Sección "Trazas" + "Sugerencias" de un elemento (pestaña Dónde del inspector). */
export function ElementTraces({ elementId }: { elementId: string }) {
  const { store, registry, run, readOnly, openView, select } = useEditor();
  const version = useAnyChange();
  const traces = useMemo(() => elementTraces(store, elementId), [store, elementId, version]);
  const suggestions = useMemo(() => topSuggestions(store, registry, elementId, 5), [store, registry, elementId, version]);
  const notationName = (typeId: string) => registry.pack(registry.notationOf(typeId))?.name ?? registry.notationOf(typeId);
  const jump = (partnerId: string) => {
    const hit = firstNodeOf(store, partnerId);
    if (hit) { openView(hit.viewId); select({ nodes: [hit.nodeId], edges: [] }); }
  };
  return <>
    <div className="ad-section">Trazas <small>({traces.length})</small></div>
    {traces.length === 0 && <div className="ad-hint">Sin relaciones puente (traza, realiza, refina) con otras notaciones.</div>}
    {traces.map(t => {
      const typeName = registry.relationType(t.relation.typeId)?.name ?? t.relation.typeId;
      const hit = firstNodeOf(store, t.partner.id);
      return (
        <div key={t.relation.id} className="ad-tr-row">
          <span className="ad-tr-row__main" title={t.relation.doc || typeName}>
            <small className="ad-tr-muted">{t.direction === 'out' ? typeName + ' →' : '← ' + typeName}</small> {t.partner.name || '(sin nombre)'} <small>{notationName(t.partner.typeId)}</small>
          </span>
          {hit && <button className="ad-btn ad-btn--ghost" title="Ir a una vista donde aparece" aria-label={`Ir a ${t.partner.name}`} onClick={() => jump(t.partner.id)}>↗</button>}
          {!readOnly && <button className="ad-btn ad-btn--ghost" title="Quitar la traza" aria-label={`Quitar traza con ${t.partner.name}`} onClick={() => run({ type: 'delete', collection: 'relations', id: t.relation.id })}>×</button>}
        </div>
      );
    })}
    <div className="ad-section">Sugerencias <small>({suggestions.length})</small></div>
    {suggestions.length === 0 && <div className="ad-hint">Ninguna: no hay elementos parecidos en otras notaciones.</div>}
    {suggestions.map(s => (
      <div key={s.target.id} className="ad-tr-row" title={s.reason}>
        <span className="ad-tr-row__main">
          <span className="ad-tr-score">{scoreLabel(s.score)}</span> {s.target.name || '(sin nombre)'} <small>{notationName(s.target.typeId)}</small>
          <div className="ad-tr-reason">{s.reason}</div>
        </span>
        {!readOnly && <button className="ad-btn" onClick={() => run(linkCommand(elementId, s))}>Enlazar</button>}
      </div>
    ))}
  </>;
}
