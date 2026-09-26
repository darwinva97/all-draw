import { useEffect, useRef } from 'react';
import { dimensionsOfElement, viewsOfElement, makeView, makeNode, newId, type Command } from '@all-draw/core';
import { useEditor } from '../context';
import { topSuggestions, linkCommand } from './traces-helpers';

/** Menú contextual de un nodo: cambiar de dimensión, detalle, puertos, quitar, borrar. */
export function NodeMenu({ x, y, nodeId, onClose }: { x: number; y: number; nodeId: string; onClose: () => void }) {
  const { store, registry, run, openView, readOnly } = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const vn = store.get('nodes', nodeId);
  const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined;
  if (!vn || !el) return null;
  const dims = dimensionsOfElement(store, el.id);
  const { details, appearsIn } = viewsOfElement(store, el.id);
  const packs = registry.allPacks().filter(p => p.id !== 'core');
  const traceSugs = readOnly ? [] : topSuggestions(store, registry, el.id, 3);

  const openIn = (viewId: string) => { openView(viewId, true); onClose(); };
  const createDetail = (notationId: string, viewpointId?: string, dimName?: string) => {
    const pack = registry.pack(notationId);
    const view = makeView(`${el.name} · ${dimName ?? pack?.name ?? notationId}`, { notationId, kind: pack?.viewKind ?? 'freeform', viewpointId, rootElementId: el.id });
    const cmds: Command[] = [{ type: 'set', collection: 'views', id: view.id, value: view }];
    // El elemento aparece también en su propia vista de detalle, como nodo raíz visual
    if (notationId === registry.notationOf(el.typeId) || notationId === 'freeform') cmds.push({ type: 'set', collection: 'nodes', id: newId('vn'), value: makeNode(view.id, el.id, { x: 40, y: 40, w: vn.w, h: vn.h }) });
    if (!vn.detailViewId) cmds.push({ type: 'patch', collection: 'nodes', id: vn.id, patch: { detailViewId: view.id } });
    run({ type: 'batch', label: 'crear vista de detalle', commands: cmds });
    openView(view.id, true); onClose();
  };
  const togglePorts = () => { run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { showPorts: !vn.style.showPorts, visiblePorts: undefined } } }); onClose(); };

  return (
    <div ref={ref} className="ad-popover ad-menu" style={{ left: x, top: y }}>
      <div className="ad-popover__title">{el.name || registry.elementType(el.typeId)?.name}</div>
      {vn.detailViewId && store.get('views', vn.detailViewId) && <button className="ad-popover__item" onClick={() => openIn(vn.detailViewId!)}>⤵ Entrar en el detalle</button>}
      <div className="ad-popover__section">Abrir en otra dimensión</div>
      {dims.map(({ dimension: d, view }) => (
        <button key={d.id} className="ad-popover__item" onClick={() => view ? openIn(view.id) : (!readOnly && createDetail(d.notationId, d.viewpointId, d.name))}>
          <span className="ad-dot" style={{ background: d.color ?? registry.pack(d.notationId)?.color ?? '#999' }} /> {d.name} {view ? '' : <small>(crear)</small>}
        </button>
      ))}
      {details.filter(v => !dims.some(d => d.view?.id === v.id)).map(v => <button key={v.id} className="ad-popover__item" onClick={() => openIn(v.id)}>◇ {v.name}</button>)}
      {!readOnly && (
        <details className="ad-popover__details">
          <summary className="ad-popover__item">＋ Nueva vista de detalle…</summary>
          {packs.map(p => <button key={p.id} className="ad-popover__item ad-popover__item--sub" onClick={() => createDetail(p.id)}>{p.name}</button>)}
        </details>
      )}
      {appearsIn.length > 0 && <div className="ad-popover__section">Aparece en</div>}
      {appearsIn.map(v => <button key={v.id} className="ad-popover__item" onClick={() => openIn(v.id)}>◻ {v.name}</button>)}
      {traceSugs.length > 0 && <div className="ad-popover__section">Trazas</div>}
      {traceSugs.map(s => (
        <button key={s.target.id} className="ad-popover__item" title={`${s.reason} (${Math.round(s.score * 100)} %)`} onClick={() => { run(linkCommand(el.id, s)); onClose(); }}>
          ⇢ Enlazar con {s.target.name || '(sin nombre)'} <small>({registry.pack(registry.notationOf(s.target.typeId))?.name ?? registry.notationOf(s.target.typeId)})</small>
        </button>
      ))}
      {!readOnly && <>
        <div className="ad-popover__section">Nodo</div>
        <button className="ad-popover__item" onClick={togglePorts}>{vn.style.showPorts ? 'Ocultar pines' : 'Mostrar pines'}</button>
        <button className="ad-popover__item" onClick={() => { run({ type: 'deleteNode', id: vn.id }); onClose(); }}>Quitar de esta vista</button>
        <button className="ad-popover__item ad-popover__item--danger" onClick={() => { if (confirm(`¿Borrar "${el.name}" del modelo y de todas las vistas?`)) run({ type: 'deleteElement', id: el.id }); onClose(); }}>Borrar del modelo</button>
      </>}
    </div>
  );
}
