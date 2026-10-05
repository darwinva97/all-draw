import { useId, useMemo, useState } from 'react';
import { relationsOfElement, viewsOfElement, type Element, type FieldDef, type KeyValue, type Relation, type ViewNode } from '@all-draw/core';
import { tn, useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { ElementTraces } from './WorkspaceTraces';
import { CommentsSection } from './Comments';
import { addLayer, addStage, removeLayer, removeStage, updateLayer, updateStage, normalizeGrid, LAYER_COLORS } from '@all-draw/notation-grid';
import { useRecord, usePorts, useAnyChange, useCollection } from '../hooks';
import { assignmentsTo, suggestedRoles, newAssignment } from './workspace-helpers';
import { Icon } from '../icons';
import { deleteSelection } from '../delete-selection';
import { TabList, tabPanelProps, useTabIds } from '../ui/tabs';
import { showTypeNamesOf } from '../nodes/label';

/** Inspector: lo seleccionado (nodo→elemento, arista→relación) o la vista. */
export function Inspector() {
  const { selection, viewId } = useEditor();
  const nodeId = selection.nodes[0];
  const edgeId = selection.edges[0];
  if (edgeId) return <aside className="ad-insp"><EdgeInspector edgeId={edgeId} /></aside>;
  if (nodeId) return <aside className="ad-insp"><NodeInspector nodeId={nodeId} /></aside>;
  return <aside className="ad-insp"><ViewInspector viewId={viewId} /></aside>;
}

export function NodeInspector({ nodeId }: { nodeId: string }) {
  const t = useT();
  const { store, registry, run, readOnly, openView } = useEditor();
  const vn = useRecord('nodes', nodeId);
  const el = useRecord('elements', vn?.elementId);
  const ports = usePorts(el);
  useAnyChange();
  const [tab, setTab] = useState<'data' | 'ports' | 'where' | 'style'>('data');
  const tabIds = useTabIds();
  if (!vn) return null;
  if (!el) return <VisualInspector vn={vn} />;
  const type = registry.elementType(el.typeId);
  const defs = registry.fieldsOf(el.typeId);
  const patchEl = (patch: Record<string, unknown>) => run({ type: 'patch', collection: 'elements', id: el.id, patch });
  const rels = relationsOfElement(store, el.id);
  const { details, appearsIn } = viewsOfElement(store, el.id);
  const nodeCount = store.list('nodes').filter(n => n.elementId === el.id).length;
  return (
    <>
      <header className="ad-insp__head" style={{ borderColor: type?.color }}>
        <input className="ad-input ad-input--title" aria-label={t('Nombre')} value={el.name} disabled={readOnly} onChange={e => patchEl({ name: e.target.value })} placeholder={type?.name} />
        <div className="ad-insp__meta">{type?.name ?? el.typeId} · {registry.pack(registry.notationOf(el.typeId))?.name ?? registry.notationOf(el.typeId)}{nodeCount > 1 && <> · {t('en {n} vistas', { n: nodeCount })}</>}</div>
      </header>
      <TabList ids={tabIds} label={t('Secciones del inspector')} value={tab} onChange={setTab} tabs={[
        { id: 'data', label: t('Datos') },
        { id: 'ports', label: <>{t('Pines')} {ports.length ? `(${ports.length})` : ''}</> },
        { id: 'where', label: t('Dónde') },
        { id: 'style', label: t('Estilo') },
      ]} />
      <div className="ad-insp__scroll" {...tabPanelProps(tabIds, tab)}>
        {tab === 'data' && <>
          <label className="ad-field"><span>{t('Documentación')}</span><textarea className="ad-input" rows={3} value={el.doc} disabled={readOnly} onChange={e => patchEl({ doc: e.target.value })} /></label>
          {defs.map(d => <FieldEditor key={d.key} def={d} value={el.fields[d.key]} disabled={readOnly} onChange={v => patchEl({ fields: { [d.key]: v } })} />)}
          {type?.fields.length === 0 && defs.length === 0 && <div className="ad-hint">{t('Este tipo no tiene campos. Añade propiedades libres abajo.')}</div>}
          <PropsEditor props={el.props} disabled={readOnly} onChange={props => run({ type: 'set', collection: 'elements', id: el.id, value: { ...el, props } })} />
          <label className="ad-field"><span>{t('Etiquetas')}</span><input className="ad-input" value={el.tags.join(', ')} disabled={readOnly} onChange={e => patchEl({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
          {rels.length > 0 && <div className="ad-section">{t('Relaciones')} ({rels.length})</div>}
          {rels.map(r => <RelationRow key={r.id} r={r} el={el} />)}
          <PeopleSection elementId={el.id} />
          <CommentsSection anchors={[{ kind: 'element', id: el.id }, { kind: 'node', id: vn.id }]} newAnchor={{ kind: 'element', id: el.id }} />
        </>}
        {tab === 'ports' && <PortsTab el={el} vn={vn} />}
        {tab === 'where' && <>
          <div className="ad-section">{t('Vistas de detalle')}</div>
          {details.length === 0 && <div className="ad-hint">{t('Ninguna. Botón derecho sobre el nodo → "Abrir en otra dimensión".')}</div>}
          {details.map(v => <button key={v.id} className="ad-link" onClick={() => openView(v.id, true)}><Icon name="diamond" size={12} />{v.name} <small>{registry.pack(v.notationId)?.name}</small></button>)}
          <div className="ad-section">{t('Aparece en')}</div>
          {appearsIn.map(v => <button key={v.id} className="ad-link" onClick={() => openView(v.id)}><Icon name="view" size={12} />{v.name} <small>{registry.pack(v.notationId)?.name}</small></button>)}
          {vn.detailViewId && <div className="ad-hint">{t('Doble clic entra en: {name}', { name: store.get('views', vn.detailViewId)?.name ?? '' })}</div>}
          {!readOnly && details.length > 0 && <label className="ad-field"><span>{t('Vista al hacer doble clic')}</span>
            <select className="ad-input" value={vn.detailViewId ?? ''} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { detailViewId: e.target.value || undefined } })}>
              <option value="">{t('(ninguna)')}</option>{details.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></label>}
          <ElementTraces elementId={el.id} />
        </>}
        {tab === 'style' && <NodeStyleTab vn={vn} />}
      </div>
    </>
  );
}

function PortsTab({ el, vn }: { el: Element; vn: ViewNode }) {
  const t = useT();
  const { run, readOnly, store } = useEditor();
  const ports = usePorts(el);
  const used = useMemo(() => new Set(store.list('relations').flatMap(r => [r.from.portId, r.to.portId]).filter(Boolean)), [store, el.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = new Set(vn.style.visiblePorts ?? []);
  const toggle = (key: string) => {
    const next = new Set(vn.style.visiblePorts ?? (vn.style.showPorts ? ports.map(p => p.key) : []));
    if (next.has(key)) next.delete(key); else next.add(key);
    run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { visiblePorts: [...next], showPorts: next.size > 0 } } });
  };
  const groups = new Map<string, typeof ports>();
  const defaultGroup = t('Puertos');
  for (const p of ports) groups.set(p.group ?? defaultGroup, [...(groups.get(p.group ?? defaultGroup) ?? []), p]);
  if (ports.length === 0) return <div className="ad-hint">{t('Sin pines. Los campos JSON, lista y clave→valor generan pines automáticamente; también puedes marcar `port` en la definición del campo.')}</div>;
  return <>
    <div className="ad-hint">{t('Marca los pines que quieres ver en este nodo. Los que ya usa una relación se marcan con ●.')}</div>
    {!readOnly && <div className="ad-row"><button className="ad-btn" onClick={() => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { showPorts: true, visiblePorts: undefined } } })}>{t('Todos')}</button><button className="ad-btn" onClick={() => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { showPorts: false, visiblePorts: undefined } } })}>{t('Ninguno')}</button></div>}
    {[...groups.entries()].map(([g, ps]) => <details key={g} open><summary className="ad-pal__cat">{g}</summary>
      {ps.map(p => <label key={p.id} className="ad-port-row"><input type="checkbox" disabled={readOnly} checked={vn.style.showPorts === true && (!vn.style.visiblePorts?.length || visible.has(p.key) || visible.has(p.id))} onChange={() => toggle(p.key)} /> <code>{p.path ?? p.key}</code> <small>{p.dataType}</small> {used.has(p.id) && '●'}</label>)}
    </details>)}
  </>;
}

function NodeStyleTab({ vn }: { vn: ViewNode }) {
  const t = useT();
  const { run, readOnly, registry, store } = useEditor();
  const el = vn.elementId ? store.get('elements', vn.elementId) : undefined;
  const archiFigure = !!el && registry.notationOf(el.typeId) === 'archimate' && !!registry.elementType(el.typeId)?.meta?.alternateFigure;
  const p = (patch: Record<string, unknown>) => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: patch } });
  return <>
    <div className="ad-hint">{t('Solo afecta a esta aparición. Para pintar por datos usa las reglas.')}</div>
    <label className="ad-field"><span>{t('Relleno')}</span><input type="color" disabled={readOnly} value={vn.style.fill ?? '#ffffff'} onChange={e => p({ fill: e.target.value })} /><button className="ad-btn" title={t('Quitar')} onClick={() => p({ fill: undefined })}><Icon name="close" size={14} /></button></label>
    <label className="ad-field"><span>{t('Borde')}</span><input type="color" disabled={readOnly} value={vn.style.stroke ?? '#444444'} onChange={e => p({ stroke: e.target.value })} /><button className="ad-btn" title={t('Quitar')} onClick={() => p({ stroke: undefined })}><Icon name="close" size={14} /></button></label>
    <label className="ad-field"><span>{t('Texto')}</span><input type="color" disabled={readOnly} value={vn.style.text ?? '#111111'} onChange={e => p({ text: e.target.value })} /><button className="ad-btn" title={t('Quitar')} onClick={() => p({ text: undefined })}><Icon name="close" size={14} /></button></label>
    <label className="ad-field"><span>{t('Tamaño')}</span><input className="ad-input" type="number" disabled={readOnly} value={vn.w} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { w: Number(e.target.value) } })} /> × <input className="ad-input" type="number" disabled={readOnly} value={vn.h} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { h: Number(e.target.value) } })} /></label>
    <label className="ad-field"><span>{t('Texto alternativo')}</span><input className="ad-input" disabled={readOnly} value={vn.text ?? ''} placeholder={t('(nombre del elemento)')} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { text: e.target.value || undefined } })} /></label>
    <label className="ad-field"><span>{t('Figura')}</span><select className="ad-input" disabled={readOnly} value={vn.style.figure ?? 0} onChange={e => p({ figure: Number(e.target.value) })}><option value={0}>{archiFigure ? t('Rectángulo con icono') : t('Por defecto')}</option><option value={1}>{archiFigure ? t('Figura ArchiMate') : t('Alternativa')}</option></select></label>
  </>;
}

function VisualInspector({ vn }: { vn: ViewNode }) {
  const t = useT();
  const { run, readOnly } = useEditor();
  return <>
    <header className="ad-insp__head"><div className="ad-insp__meta">{vn.visualType ?? t('Nota')}</div></header>
    <div className="ad-insp__scroll">
      <label className="ad-field"><span>{t('Texto')}</span><textarea className="ad-input" rows={4} disabled={readOnly} value={vn.text ?? ''} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { text: e.target.value } })} /></label>
      <label className="ad-field"><span>{t('Fondo')}</span><input type="color" disabled={readOnly} value={vn.style.fill ?? '#fff8c5'} onChange={e => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { fill: e.target.value } } })} /></label>
      <CommentsSection anchors={[{ kind: 'node', id: vn.id }]} newAnchor={{ kind: 'node', id: vn.id, viewId: vn.viewId }} />
    </div>
  </>;
}

function EdgeInspector({ edgeId }: { edgeId: string }) {
  const t = useT();
  const { store, registry, run, readOnly, select } = useEditor();
  const ve = useRecord('edges', edgeId);
  const rel = useRecord('relations', ve?.relationId);
  if (!ve) return null;
  const type = rel ? registry.relationType(rel.typeId) : undefined;
  const a = rel?.from.elementId ? store.get('elements', rel.from.elementId) : undefined;
  const b = rel?.to.elementId ? store.get('elements', rel.to.elementId) : undefined;
  const allowed = a && b ? registry.allowedRelations(a.typeId, b.typeId) : [];
  const patchRel = (patch: Record<string, unknown>) => rel && run({ type: 'patch', collection: 'relations', id: rel.id, patch });
  const patchEdge = (patch: Record<string, unknown>) => run({ type: 'patch', collection: 'edges', id: ve.id, patch });
  const remove = (fromModel: boolean) => { void deleteSelection(store, run, { nodes: [], edges: [ve.id] }, fromModel, t).then(done => { if (done) select({ nodes: [], edges: [] }); }); };
  return <>
    <header className="ad-insp__head"><div className="ad-insp__meta">{t('Relación')} · {type?.name ?? rel?.typeId}</div>
      <div className="ad-insp__ends">{a?.name ?? '?'} → {b?.name ?? '?'}</div></header>
    <div className="ad-insp__scroll">
      {rel && <>
        <label className="ad-field"><span>{t('Tipo')}</span><select className="ad-input" disabled={readOnly} value={rel.typeId} onChange={e => patchRel({ typeId: e.target.value })}>
          {[rel.typeId, ...allowed.filter(x => x !== rel.typeId)].map(id => <option key={id} value={id}>{registry.relationType(id)?.name ?? id}</option>)}</select></label>
        <label className="ad-field"><span>{t('Nombre')}</span><input className="ad-input" disabled={readOnly} value={rel.name} onChange={e => patchRel({ name: e.target.value })} /></label>
        <label className="ad-field"><span>{t('Documentación')}</span><textarea className="ad-input" rows={2} disabled={readOnly} value={rel.doc} onChange={e => patchRel({ doc: e.target.value })} /></label>
        {(type?.fields ?? []).map(d => <FieldEditor key={d.key} def={d} value={rel.fields[d.key]} disabled={readOnly} onChange={v => patchRel({ fields: { [d.key]: v } })} />)}
        {(rel.from.portId || rel.to.portId || rel.mappings.length > 0) && <>
          <div className="ad-section">{t('Pines')}</div>
          <div className="ad-hint">{rel.from.portId?.split('#')[1] ?? t('(elemento)')} → {rel.to.portId?.split('#')[1] ?? t('(elemento)')}</div>
          {rel.mappings.map((m, i) => <div key={i} className="ad-row"><code>{m.fromPath}</code> → <code>{m.toPath}</code>{!readOnly && <button className="ad-btn" title={t('Quitar')} onClick={() => patchRel({ mappings: rel.mappings.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>}</div>)}
        </>}
        <PropsEditor props={rel.props} disabled={readOnly} onChange={props => run({ type: 'set', collection: 'relations', id: rel.id, value: { ...rel, props } })} />
      </>}
      <div className="ad-section">{t('Esta arista')}</div>
      <label className="ad-field"><span>{t('Etiqueta')}</span><input className="ad-input" disabled={readOnly} value={ve.label ?? ''} placeholder={rel?.name || type?.name} onChange={e => patchEdge({ label: e.target.value || undefined })} /></label>
      <label className="ad-field"><span>{t('Trazado')}</span><select className="ad-input" disabled={readOnly} value={ve.style.router ?? 'smoothstep'} onChange={e => patchEdge({ style: { router: e.target.value } })}><option value="smoothstep">{t('Ortogonal')}</option><option value="bezier">{t('Curva')}</option><option value="straight">{t('Recta')}</option></select></label>
      <label className="ad-field"><span>{t('Línea')}</span><select className="ad-input" disabled={readOnly} value={ve.style.line ?? ''} onChange={e => patchEdge({ style: { line: e.target.value || undefined } })}><option value="">{t('(del tipo)')}</option><option value="solid">{t('Continua')}</option><option value="dashed">{t('Discontinua')}</option><option value="dotted">{t('Punteada')}</option></select></label>
      <label className="ad-field"><span>{t('Color')}</span><input type="color" disabled={readOnly} value={ve.style.color ?? type?.color ?? '#444444'} onChange={e => patchEdge({ style: { color: e.target.value } })} /><button className="ad-btn" title={t('Quitar')} onClick={() => patchEdge({ style: { color: undefined } })}><Icon name="close" size={14} /></button></label>
      {!readOnly && <div className="ad-row ad-insp__danger">
        <button className="ad-btn" onClick={() => remove(false)} title={t('Solo esta arista; la relación sigue en el modelo (Supr)')}>{t('Quitar de esta vista')}</button>
        {rel && <button className="ad-btn ad-btn--danger" onClick={() => remove(true)} title={t('La relación y todas sus aristas, en todas las vistas (Shift+Supr)')}>{t('Borrar del modelo')}</button>}
      </div>}
      <CommentsSection anchors={[{ kind: 'edge', id: ve.id }, ...(rel ? [{ kind: 'relation' as const, id: rel.id }] : [])]} newAnchor={{ kind: 'edge', id: ve.id, viewId: ve.viewId }} />
    </div>
  </>;
}

function ViewInspector({ viewId }: { viewId: string | null }) {
  const t = useT();
  const { registry, run, readOnly, store, share } = useEditor();
  const view = useRecord('views', viewId);
  useAnyChange();
  if (!view) return <div className="ad-empty">{t('Nada seleccionado')}</div>;
  const pack = registry.pack(view.notationId);
  const root = view.rootElementId ? store.get('elements', view.rootElementId) : undefined;
  const patch = (p: Record<string, unknown>) => run({ type: 'patch', collection: 'views', id: view.id, patch: p });
  const n = store.list('nodes').filter(x => x.viewId === view.id).length;
  return <>
    <header className="ad-insp__head"><input className="ad-input ad-input--title" aria-label={t('Nombre')} disabled={readOnly} value={view.name} onChange={e => patch({ name: e.target.value })} />
      <div className="ad-insp__meta">{t('Vista')} · {pack?.name ?? view.notationId} · {tn('{n} nodo', '{n} nodos', n)}{root && <> · {t('detalle de')} <b>{root.name}</b></>}</div></header>
    <div className="ad-insp__scroll">
      <label className="ad-field"><span>{t('Descripción')}</span><textarea className="ad-input" rows={3} disabled={readOnly} value={view.doc} onChange={e => patch({ doc: e.target.value })} /></label>
      {pack && pack.viewpoints.length > 0 && <label className="ad-field"><span>{t('Viewpoint')}</span><select className="ad-input" disabled={readOnly} value={view.viewpointId ?? ''} onChange={e => patch({ viewpointId: e.target.value || undefined })}>
        <option value="">{t('(ninguno: todo)')}</option>{pack.viewpoints.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
      <label className="ad-field"><span>{t('Elemento raíz')}</span><select className="ad-input" disabled={readOnly} value={view.rootElementId ?? ''} onChange={e => patch({ rootElementId: e.target.value || undefined })}>
        <option value="">{t('(ninguno)')}</option>{store.list('elements').filter(e => !e.template).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label className="ad-field ad-field--inline" title={t('En ArchiMate, el icono de la esquina ya dice el tipo (como en Archi).')}><input type="checkbox" disabled={readOnly} checked={showTypeNamesOf(view)} onChange={e => patch({ style: { showTypeNames: e.target.checked } })} /><span>{t('Mostrar el nombre del tipo')}</span></label>
      {view.kind === 'grid' && <GridEditor viewId={view.id} grid={normalizeGrid(view.grid)} />}
      {!readOnly && (share
        ? <button type="button" className="ad-link ad-insp__share" onClick={share}><Icon name="link" size={14} />{t('Compartir en solo lectura…')}</button>
        : <div className="ad-hint ad-insp__share">{t('Para enseñar esta vista a alguien en solo lectura, usa el botón Compartir de la barra superior (espacios del servidor).')}</div>)}
      <CommentsSection anchors={[{ kind: 'view', id: view.id }, { kind: 'point', viewId: view.id }]} newAnchor={{ kind: 'view', id: view.id, viewId: view.id }} />
      <div className="ad-hint">{t('Arrastra tipos desde la paleta. Conecta arrastrando desde el borde inferior de un nodo, o desde un pin. Botón derecho para cambiar de dimensión.')}</div>
    </div>
  </>;
}

function GridEditor({ viewId, grid }: { viewId: string; grid: ReturnType<typeof normalizeGrid> }) {
  const t = useT();
  const { run, readOnly } = useEditor();
  const set = (g: ReturnType<typeof normalizeGrid>) => run({ type: 'set', collection: 'views', id: viewId, value: { ...useEditor_store_get(viewId), grid: g } });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { store } = useEditor();
  function useEditor_store_get(id: string) { return store.get('views', id)!; }
  return <>
    <div className="ad-section">{t('Capas')}</div>
    {grid.layers.map((l, i) => <div key={l.id} className="ad-row"><input type="color" disabled={readOnly} value={l.color ?? LAYER_COLORS[i % LAYER_COLORS.length]} onChange={e => set(updateLayer(grid, l.id, { color: e.target.value }))} /><input className="ad-input" disabled={readOnly} value={l.name} onChange={e => set(updateLayer(grid, l.id, { name: e.target.value }))} /><input className="ad-input" type="number" style={{ width: 70 }} disabled={readOnly} value={l.size ?? ''} placeholder={t('alto')} onChange={e => set(updateLayer(grid, l.id, { size: e.target.value ? Number(e.target.value) : undefined }))} />{!readOnly && <button className="ad-btn" title={t('Quitar')} onClick={() => set(removeLayer(grid, l.id))}><Icon name="close" size={14} /></button>}</div>)}
    {!readOnly && <button className="ad-btn" onClick={() => set(addLayer(grid, { name: t('Capa {n}', { n: grid.layers.length + 1 }), color: LAYER_COLORS[grid.layers.length % LAYER_COLORS.length] }))}><Icon name="plus" size={14} />{t('capa')}</button>}
    <div className="ad-section">{t('Etapas')}</div>
    {grid.stages.map(st => <div key={st.id} className="ad-row"><input className="ad-input" disabled={readOnly} value={st.name} onChange={e => set(updateStage(grid, st.id, { name: e.target.value }))} /><input className="ad-input" type="number" style={{ width: 70 }} disabled={readOnly} value={st.size ?? ''} placeholder={t('ancho')} onChange={e => set(updateStage(grid, st.id, { size: e.target.value ? Number(e.target.value) : undefined }))} />{!readOnly && <button className="ad-btn" title={t('Quitar')} onClick={() => set(removeStage(grid, st.id))}><Icon name="close" size={14} /></button>}</div>)}
    {!readOnly && <button className="ad-btn" onClick={() => set(addStage(grid, { name: t('Etapa {n}', { n: grid.stages.length + 1 }) }))}><Icon name="plus" size={14} />{t('etapa')}</button>}
    <div className="ad-hint">{t('Los nodos de una capa o etapa borrada quedan fuera de la rejilla hasta que los muevas a otra celda.')}</div>
  </>;
}

function RelationRow({ r, el }: { r: Relation; el: Element }) {
  const t = useT();
  const { store, registry, select, viewId } = useEditor();
  const out = r.from.elementId === el.id;
  const other = store.get('elements', (out ? r.to.elementId : r.from.elementId) ?? '');
  const edge = store.list('edges').find(e => e.relationId === r.id && e.viewId === viewId);
  return <button className="ad-link" onClick={() => edge && select({ nodes: [], edges: [edge.id] })} title={edge ? t('Seleccionar en esta vista') : t('No está dibujada en esta vista')}>
    {out ? '→' : '←'} {registry.relationType(r.typeId)?.name ?? r.typeId} <b>{other?.name ?? '?'}</b> {r.name && <small>{r.name}</small>}{!edge && <small> {t('(no en esta vista)')}</small>}
  </button>;
}

/** Personas asignadas a un elemento (persona · papel) y alta rápida de una asignación. */
function PeopleSection({ elementId }: { elementId: string }) {
  const t = useT();
  const { run, readOnly } = useEditor();
  const people = useCollection('people');
  const [pid, setPid] = useState('');
  const [role, setRole] = useState('Owner');
  const list = assignmentsTo(people, 'element', elementId);
  const personId = people.some(p => p.id === pid) ? pid : (people[0]?.id ?? '');
  const add = () => {
    const p = people.find(x => x.id === personId); if (!p) return;
    run({ type: 'patch', collection: 'people', id: p.id, patch: { assignments: [...p.assignments, newAssignment('element', elementId, role)] } });
  };
  const remove = (personId: string, assignmentId: string) => {
    const p = people.find(x => x.id === personId); if (!p) return;
    run({ type: 'patch', collection: 'people', id: p.id, patch: { assignments: p.assignments.filter(a => a.id !== assignmentId) } });
  };
  return <>
    <div className="ad-section">{t('Personas')} ({list.length})</div>
    {list.length === 0 && <div className="ad-hint">{t('Nadie asignado todavía.')}</div>}
    {list.map(({ person, assignment }) => <div key={assignment.id} className="ad-row ad-ws-personrow"><span className="ad-ws-avatar">{person.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'}</span><span className="ad-ws-item__label">{person.name} <small>· {assignment.role}</small></span>{!readOnly && <button className="ad-btn ad-btn--ghost" title={t('Quitar')} onClick={() => remove(person.id, assignment.id)}><Icon name="close" size={14} /></button>}</div>)}
    {!readOnly && people.length > 0 && <div className="ad-row">
      <select className="ad-input" aria-label={t('Persona')} value={personId} onChange={e => setPid(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input className="ad-input" list="ad-insp-roles" value={role} placeholder={t('papel')} aria-label={t('Papel')} onChange={e => setRole(e.target.value)} />
      <datalist id="ad-insp-roles">{suggestedRoles(people).map(r => <option key={r} value={r} />)}</datalist>
      <button className="ad-btn" disabled={!personId} onClick={add} title={t('Asignar')}><Icon name="plus" /></button>
    </div>}
    {!readOnly && people.length === 0 && <div className="ad-hint">{t('No hay personas: créalas en Espacio → Personas.')}</div>}
  </>;
}

// ---------------------------------------------------------------- editores de campos
export function FieldEditor({ def, value, onChange, disabled }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const t = useT();
  const helpId = useId();
  const help = def.doc?.trim();
  const common = { className: 'ad-input', disabled, 'aria-describedby': help ? helpId : undefined };
  let input: React.ReactNode;
  switch (def.kind) {
    case 'textarea': case 'json': input = <textarea {...common} rows={def.kind === 'json' ? 5 : 3} value={String(value ?? '')} onChange={e => onChange(e.target.value)} spellCheck={false} style={def.kind === 'json' ? { fontFamily: 'monospace' } : undefined} />; break;
    case 'number': input = <input {...common} type="number" value={value === undefined || value === null ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />; break;
    case 'checkbox': input = <input type="checkbox" disabled={disabled} aria-describedby={common['aria-describedby']} checked={!!value} onChange={e => onChange(e.target.checked)} />; break;
    case 'date': input = <input {...common} type="date" value={String(value ?? '')} onChange={e => onChange(e.target.value)} />; break;
    case 'url': input = <input {...common} type="url" value={String(value ?? '')} onChange={e => onChange(e.target.value)} />; break;
    case 'select': {
      // Se guarda el valor interno (`businessRule`); se muestra su nombre legible traducido. Un valor que ya no está entre las opciones se conserva.
      const opts = (def.options ?? '').split(',').map(o => o.trim()).filter(Boolean);
      const cur = String(value ?? '');
      const name = (o: string) => (def.optionLabels?.[o] ? t(def.optionLabels[o]!) : o);
      input = <select {...common} value={cur} onChange={e => onChange(e.target.value)}><option value="">—</option>{cur && !opts.includes(cur) && <option value={cur}>{cur}</option>}{opts.map(o => <option key={o} value={o}>{name(o)}</option>)}</select>; break;
    }
    case 'list': input = <ListEditor value={Array.isArray(value) ? value as string[] : []} onChange={onChange} disabled={disabled} />; break;
    case 'keyvalue': input = <KeyValueEditor value={Array.isArray(value) ? value as KeyValue[] : []} onChange={onChange} disabled={disabled} labels={def.options} />; break;
    default: input = <input {...common} value={String(value ?? '')} onChange={e => onChange(e.target.value)} />;
  }
  const isPin = def.port ?? ['json', 'list', 'keyvalue'].includes(def.kind);
  // Ayuda del campo (`FieldDef.doc`): texto bajo el campo (asociado con `aria-describedby`) e icono con la misma ayuda.
  return <label className={`ad-field ${def.kind === 'checkbox' ? 'ad-field--inline' : ''}`}>
    <span className="ad-field__label">{def.label}{isPin && <small className="ad-pin-mark" title={t('Genera pines')}><Icon name="pin" size={12} /></small>}{help && <small className="ad-field__info" title={help} aria-hidden="true"><Icon name="info" size={12} /></small>}</span>
    {input}
    {help && <small id={helpId} className="ad-field__help">{help}</small>}
  </label>;
}

function ListEditor({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const t = useT();
  return <div className="ad-list">
    {value.map((v, i) => <div key={i} className="ad-row"><input className="ad-input" disabled={disabled} value={v} onChange={e => onChange(value.map((x, j) => j === i ? e.target.value : x))} />{!disabled && <button className="ad-btn" title={t('Quitar')} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>}</div>)}
    {!disabled && <button className="ad-btn" onClick={() => onChange([...value, ''])}><Icon name="plus" size={14} />{t('añadir')}</button>}
  </div>;
}

export function KeyValueEditor({ value, onChange, disabled, labels }: { value: KeyValue[]; onChange: (v: KeyValue[]) => void; disabled?: boolean; labels?: string }) {
  const t = useT();
  const [lk, lv] = labels ? labels.split('|') : [t('Clave'), t('Valor')];
  return <div className="ad-list">
    {value.map((kv, i) => <div key={i} className="ad-row"><input className="ad-input" placeholder={lk} disabled={disabled} value={kv.key} onChange={e => onChange(value.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} /><input className="ad-input" placeholder={lv} disabled={disabled} value={kv.value} onChange={e => onChange(value.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />{!disabled && <button className="ad-btn" title={t('Quitar')} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>}</div>)}
    {!disabled && <button className="ad-btn" onClick={() => onChange([...value, { key: '', value: '' }])}><Icon name="plus" size={14} />{t('añadir')}</button>}
  </div>;
}

function PropsEditor({ props, onChange, disabled }: { props: Record<string, string>; onChange: (p: Record<string, string>) => void; disabled?: boolean }) {
  const t = useT();
  const entries = Object.entries(props);
  return <details className="ad-details" open={entries.length > 0}><summary className="ad-section">{t('Propiedades')} ({entries.length})</summary>
    <KeyValueEditor value={entries.map(([key, value]) => ({ key, value }))} disabled={disabled} onChange={list => onChange(Object.fromEntries(list.filter(kv => kv.key).map(kv => [kv.key, kv.value])))} />
  </details>;
}
