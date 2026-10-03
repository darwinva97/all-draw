/**
 * Pestaña Librerías: librerías → tipos de elemento (con sus campos) y componentes (plantillas).
 * Los tipos viven dentro del registro `Library`, así que cada cambio hace `set` del registro entero.
 */
import { useState } from 'react';
import type { Library, ElementType, FieldDef, FieldKind, Shape, Element, Command } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useCollection, useAnyChange } from '../hooks';
import { FieldEditor } from './Inspector';
import { propagateTemplate, retypeElements, FALLBACK_TYPE } from '../template';
import {
  FIELD_KINDS, SHAPES, newElementType, newFieldFromLabel, newLibrary, newTemplate, moveItem, withType, withoutType,
  typeUsage, libraryUsage, templateInstances, clean,
} from './workspace-helpers';
import { Icon } from '../icons';
import { confirmDialog } from '../ui/dialog';

export function LibrariesTab() {
  const t = useT();
  const { store, run } = useEditor();
  const libs = useCollection('libraries');
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const lib = libs.find(l => l.id === sel) ?? libs[0];

  const create = () => {
    const l = newLibrary(name || t('Librería nueva'));
    run({ type: 'set', collection: 'libraries', id: l.id, value: l });
    setSel(l.id); setName('');
  };
  const remove = async (l: Library) => {
    const uses = libraryUsage(store, l.id);
    const msg = uses > 0
      ? t('Tiene {n} elemento(s) que la usan (componentes o instancias de sus tipos). Se borrarán sus componentes; las instancias quedarán con un tipo desconocido.', { n: uses })
      : undefined;
    if (!(await confirmDialog({ title: t('¿Borrar la librería "{name}"?', { name: l.name }), message: msg, danger: true }))) return;
    const cmds: Command[] = store.list('elements').filter(e => e.template && e.libraryId === l.id).map(e => ({ type: 'deleteElement', id: e.id }));
    cmds.push({ type: 'delete', collection: 'libraries', id: l.id });
    run({ type: 'batch', label: t('borrar librería'), commands: cmds });
    if (sel === l.id) setSel(null);
  };

  return (
    <>
      <aside className="ad-ws-side">
        <div className="ad-ws-side__new">
          <input className="ad-input" placeholder={t('Nueva librería…')} aria-label={t('Nueva librería')} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} />
          <button className="ad-btn" onClick={create} title={t('Crear librería')}><Icon name="plus" /></button>
        </div>
        <div className="ad-ws-side__list">
          {libs.length === 0 && <div className="ad-empty">{t('Sin librerías. Crea una arriba.')}</div>}
          {libs.map(l => (
            <div key={l.id} className={`ad-ws-item ${lib?.id === l.id ? 'is-active' : ''}`} onClick={() => setSel(l.id)}>
              <span className="ad-ws-item__label">{l.name}</span>
              <small>{l.elementTypes.length === 1 ? t('1 tipo') : t('{n} tipos', { n: l.elementTypes.length })}</small>
              <button className="ad-btn ad-btn--ghost" title={t('Borrar librería')} onClick={e => { e.stopPropagation(); remove(l); }}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      </aside>
      <section className="ad-ws-main">
        {lib ? <LibraryEditor key={lib.id} lib={lib} /> : <div className="ad-empty">{t('Selecciona o crea una librería.')}</div>}
      </section>
    </>
  );
}

function LibraryEditor({ lib }: { lib: Library }) {
  const t = useT();
  const { store, run, registry } = useEditor();
  useAnyChange();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [compType, setCompType] = useState('');
  const [compName, setCompName] = useState('');
  const [compId, setCompId] = useState<string | null>(null);
  const setLib = (l: Library) => run({ type: 'set', collection: 'libraries', id: l.id, value: l });
  const type = lib.elementTypes.find(x => x.id === typeId) ?? null;
  const templates = store.list('elements').filter(e => e.template && e.libraryId === lib.id);
  const comp = templates.find(e => e.id === compId) ?? null;

  const addType = () => {
    const nt = newElementType(lib, typeName || t('Tipo nuevo'));
    setLib(withType(lib, nt)); setTypeId(nt.id); setTypeName('');
  };
  const [removing, setRemoving] = useState<{ type: ElementType; to: string } | null>(null);
  const removeType = async (ty: ElementType) => {
    const uses = typeUsage(store, ty.id);
    if (uses === 0) {
      if (!(await confirmDialog({ title: t('¿Borrar el tipo "{name}"?', { name: ty.name }), danger: true }))) return;
      setLib(withoutType(lib, ty.id)); if (typeId === ty.id) setTypeId(null);
      return;
    }
    // Con usos: se pide a qué tipo pasan sus elementos (otro tipo o caja libre); nunca quedan con tipo desconocido.
    setRemoving({ type: ty, to: lib.elementTypes.find(x => x.id !== ty.id)?.id ?? FALLBACK_TYPE });
  };
  const confirmRemoveType = () => {
    if (!removing) return;
    const cmds: Command[] = [...retypeElements(store, removing.type.id, removing.to), { type: 'set', collection: 'libraries', id: lib.id, value: withoutType(lib, removing.type.id) }];
    run({ type: 'batch', label: t('borrar tipo'), commands: cmds });
    if (typeId === removing.type.id) setTypeId(null);
    setRemoving(null);
  };
  const retypeOptions = (): { id: string; label: string }[] => {
    const out: { id: string; label: string }[] = [];
    for (const ty of lib.elementTypes) if (ty.id !== removing?.type.id) out.push({ id: ty.id, label: `${ty.name} (${lib.name})` });
    for (const l of store.list('libraries')) if (l.id !== lib.id) for (const ty of l.elementTypes) out.push({ id: ty.id, label: `${ty.name} (${l.name})` });
    for (const ty of registry.allElementTypes()) if (ty.notationId && !ty.abstract && !out.some(o => o.id === ty.id)) out.push({ id: ty.id, label: `${ty.name} (${registry.pack(ty.notationId)?.name ?? ty.notationId})` });
    if (!out.some(o => o.id === FALLBACK_TYPE)) out.unshift({ id: FALLBACK_TYPE, label: t('Caja libre (freeform:box)') });
    return out;
  };
  const addComp = () => {
    const ty = lib.elementTypes.find(x => x.id === compType) ?? lib.elementTypes[0];
    if (!ty) return;
    const el = newTemplate(ty, lib.id, compName || undefined);
    run({ type: 'set', collection: 'elements', id: el.id, value: el });
    setCompId(el.id); setCompName('');
  };
  const removeComp = async (e: Element) => {
    const n = templateInstances(store, e.id);
    if (!(await confirmDialog({ title: t('¿Borrar el componente "{name}"?', { name: e.name }), message: n > 0 ? t('Tiene {n} instancia(s) en el modelo, que seguirán existiendo sueltas.', { n }) : undefined, danger: true }))) return;
    run({ type: 'deleteElement', id: e.id }); if (compId === e.id) setCompId(null);
  };
  const instances = (n: number) => (n === 1 ? t('1 instancia') : t('{n} instancias', { n }));

  return (
    <>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>{t('Nombre')}</span><input className="ad-input ad-input--title" value={lib.name} onChange={e => setLib({ ...lib, name: e.target.value })} /></label>
        <label className="ad-field"><span>{t('Descripción')}</span><input className="ad-input" value={lib.description} onChange={e => setLib({ ...lib, description: e.target.value })} /></label>
      </div>
      <div className="ad-hint">Id: <code>{lib.id}</code></div>

      <div className="ad-ws-cols">
        <div>
          <div className="ad-section">{t('Tipos de elemento')} ({lib.elementTypes.length})</div>
          <div className="ad-ws-side__new">
            <input className="ad-input" placeholder={t('Nuevo tipo…')} aria-label={t('Nuevo tipo')} value={typeName} onChange={e => setTypeName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addType(); }} />
            <button className="ad-btn" onClick={addType} title={t('Crear tipo')}><Icon name="plus" /></button>
          </div>
          {lib.elementTypes.map(ty => (
            <div key={ty.id} className={`ad-ws-item ${type?.id === ty.id ? 'is-active' : ''}`} onClick={() => setTypeId(ty.id)}>
              <span className="ad-pal__swatch" style={{ background: ty.color ?? '#eee' }}>{ty.icon ?? ''}</span>
              <span className="ad-ws-item__label">{ty.name}</span>
              <small>{t('{n} campos', { n: ty.fields.length })} · {t('{n} usos', { n: typeUsage(store, ty.id) })}</small>
              <button className="ad-btn ad-btn--ghost" title={t('Borrar tipo')} onClick={e => { e.stopPropagation(); removeType(ty); }}><Icon name="close" size={14} /></button>
            </div>
          ))}
          {lib.elementTypes.length === 0 && <div className="ad-hint">{t('Sin tipos. Un tipo define la forma, el color y los campos de sus elementos.')}</div>}
          {removing && (
            <div className="ad-ws-notice ad-ws-retype" role="dialog" aria-label={t('Borrar tipo')}>
              <div>{t('El tipo')} <b>{removing.type.name}</b> {t('lo usan {n} elemento(s). Antes de borrarlo, ¿a qué tipo pasan?', { n: typeUsage(store, removing.type.id) })}</div>
              <label className="ad-field"><span>{t('Reasignar a…')}</span>
                <select className="ad-input" value={removing.to} onChange={e => setRemoving({ ...removing, to: e.target.value })}>
                  {retypeOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              <div className="ad-row">
                <button className="ad-btn ad-ws-danger" onClick={confirmRemoveType}>{t('Reasignar y borrar el tipo')}</button>
                <button className="ad-btn" onClick={() => setRemoving(null)}>{t('Cancelar')}</button>
              </div>
            </div>
          )}

          <div className="ad-section">{t('Componentes')} ({templates.length})</div>
          <div className="ad-hint">{t('Un componente es un elemento plantilla: al arrastrarlo desde la paleta se crea una instancia con sus datos.')}</div>
          {lib.elementTypes.length > 0 && <div className="ad-ws-side__new">
            <select className="ad-input" aria-label={t('Tipo del componente')} value={compType || lib.elementTypes[0]?.id} onChange={e => setCompType(e.target.value)}>
              {lib.elementTypes.map(ty => <option key={ty.id} value={ty.id}>{ty.name}</option>)}
            </select>
            <input className="ad-input" placeholder={t('Nombre del componente…')} aria-label={t('Nombre del componente')} value={compName} onChange={e => setCompName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComp(); }} />
            <button className="ad-btn" onClick={addComp} title={t('Crear componente')}><Icon name="plus" /></button>
          </div>}
          {templates.map(e => {
            const ty = registry.elementType(e.typeId) ?? lib.elementTypes.find(x => x.id === e.typeId);
            const n = templateInstances(store, e.id);
            return (
              <div key={e.id} className={`ad-ws-item ${comp?.id === e.id ? 'is-active' : ''}`} onClick={() => setCompId(e.id)}>
                <span className="ad-pal__swatch" style={{ background: ty?.color ?? '#eee' }}>{ty?.icon ?? ''}</span>
                <span className="ad-ws-item__label">{e.name || t('(sin nombre)')}</span>
                <small>{ty?.name ?? e.typeId} · {instances(n)}</small>
                <button className="ad-btn ad-btn--ghost" title={t('Borrar componente')} onClick={ev => { ev.stopPropagation(); removeComp(e); }}><Icon name="close" size={14} /></button>
              </div>
            );
          })}
        </div>
        <div className="ad-ws-detail">
          {type && <TypeEditor key={type.id} lib={lib} type={type} onChange={nt => setLib(withType(lib, nt))} />}
          {!type && comp && <TemplateEditor key={comp.id} el={comp} lib={lib} />}
          {!type && !comp && <div className="ad-empty">{t('Elige un tipo o un componente para editarlo.')}</div>}
          {type && comp && <div className="ad-hint"><button className="ad-link" onClick={() => setTypeId(null)}>{t('Cerrar el tipo para editar el componente «{name}»', { name: comp.name })}</button></div>}
        </div>
      </div>
    </>
  );
}

function TypeEditor({ lib, type, onChange }: { lib: Library; type: ElementType; onChange: (t: ElementType) => void }) {
  const t = useT();
  const [label, setLabel] = useState('');
  const p = (patch: Partial<ElementType>) => onChange(clean({ ...type, ...patch }));
  const setFields = (fields: FieldDef[]) => p({ fields });
  const addField = () => { setFields([...type.fields, newFieldFromLabel(label || t('Campo'), type.fields)]); setLabel(''); };
  return (
    <>
      <div className="ad-section">{t('Tipo')} · <code>{type.id}</code></div>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>{t('Nombre')}</span><input className="ad-input" value={type.name} onChange={e => p({ name: e.target.value })} /></label>
        <label className="ad-field"><span>{t('Categoría (paleta)')}</span><input className="ad-input" value={type.category ?? ''} onChange={e => p({ category: e.target.value || undefined })} /></label>
        <label className="ad-field"><span>{t('Color')}</span><span className="ad-row"><input type="color" value={type.color ?? '#e2e8f0'} onChange={e => p({ color: e.target.value })} /><input className="ad-input" value={type.color ?? ''} placeholder="#rrggbb" onChange={e => p({ color: e.target.value || undefined })} /></span></label>
        <label className="ad-field"><span>{t('Icono (texto o emoji)')}</span><input className="ad-input" value={type.icon ?? ''} maxLength={4} onChange={e => p({ icon: e.target.value || undefined })} /></label>
        <label className="ad-field"><span>{t('Forma')}</span><select className="ad-input" value={type.shape ?? 'rounded'} onChange={e => p({ shape: e.target.value as Shape })}>{SHAPES.map(s => <option key={s.id} value={s.id}>{t(s.label)}</option>)}</select></label>
        <label className="ad-field ad-field--inline"><input type="checkbox" checked={!!type.container} onChange={e => p({ container: e.target.checked || undefined })} /> <span>{t('Contenedor (puede contener otros nodos)')}</span></label>
      </div>
      <label className="ad-field"><span>{t('Documentación')}</span><textarea className="ad-input" rows={2} value={type.doc ?? ''} onChange={e => p({ doc: e.target.value || undefined })} /></label>

      <div className="ad-section">{t('Campos')} ({type.fields.length})</div>
      <div className="ad-ws-side__new">
        <input className="ad-input" placeholder={t('Etiqueta del campo nuevo…')} aria-label={t('Etiqueta del campo nuevo')} value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addField(); }} />
        <button className="ad-btn" onClick={addField}><Icon name="plus" size={14} />{t('campo')}</button>
      </div>
      {type.fields.map((f, i) => (
        <FieldDefRow key={i} f={f} first={i === 0} last={i === type.fields.length - 1}
          onChange={nf => setFields(type.fields.map((x, j) => j === i ? nf : x))}
          onMove={dir => setFields(moveItem(type.fields, i, dir))}
          onRemove={() => setFields(type.fields.filter((_, j) => j !== i))} />
      ))}
      {type.fields.length === 0 && <div className="ad-hint">{t('Sin campos. Los campos JSON, lista y clave→valor generan pines automáticamente.')}</div>}
      <div className="ad-hint">{t('Los cambios en el tipo se aplican a todos sus elementos, en todas las vistas (librería')} <b>{lib.name}</b>).</div>
    </>
  );
}

function FieldDefRow({ f, first, last, onChange, onMove, onRemove }: { f: FieldDef; first: boolean; last: boolean; onChange: (f: FieldDef) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const t = useT();
  const p = (patch: Partial<FieldDef>) => onChange(clean({ ...f, ...patch }));
  const auto = ['json', 'list', 'keyvalue'].includes(f.kind);
  const isPin = f.port ?? auto;
  return (
    <div className="ad-ws-fieldrow">
      <div className="ad-ws-fieldrow__main">
        <input className="ad-input" value={f.label} placeholder={t('Etiqueta')} aria-label={t('Etiqueta')} onChange={e => p({ label: e.target.value })} />
        <input className="ad-input ad-ws-mono" value={f.key} placeholder={t('clave')} aria-label={t('Clave interna del campo')} onChange={e => p({ key: e.target.value })} title={t('Clave interna del campo')} />
        <select className="ad-input" aria-label={t('Clase de campo')} value={f.kind} onChange={e => p({ kind: e.target.value as FieldKind })}>{FIELD_KINDS.map(k => <option key={k.id} value={k.id}>{t(k.label)}</option>)}</select>
        <span className="ad-ws-fieldrow__btns">
          <button className="ad-btn ad-btn--ghost" disabled={first} onClick={() => onMove(-1)} title={t('Subir')}><Icon name="arrowUp" size={14} /></button>
          <button className="ad-btn ad-btn--ghost" disabled={last} onClick={() => onMove(1)} title={t('Bajar')}><Icon name="arrowDown" size={14} /></button>
          <button className="ad-btn ad-btn--ghost" onClick={onRemove} title={t('Quitar campo')}><Icon name="close" size={14} /></button>
        </span>
      </div>
      <div className="ad-ws-fieldrow__opts">
        {(f.kind === 'select' || f.kind === 'keyvalue') && <input className="ad-input" value={f.options ?? ''} aria-label={t('Opciones')} placeholder={f.kind === 'select' ? t('Opciones separadas por coma') : t('Etiqueta clave|Etiqueta valor')} onChange={e => p({ options: e.target.value || undefined })} />}
        <label className="ad-field--inline"><input type="checkbox" checked={isPin} onChange={e => p({ port: e.target.checked === auto ? undefined : e.target.checked })} /> <span>{t('genera pines')}</span></label>
        {isPin && <select className="ad-input ad-ws-narrow" aria-label={t('Dirección de los pines')} value={f.direction ?? 'both'} onChange={e => p({ direction: e.target.value as FieldDef['direction'] })}><option value="in">{t('entrada')}</option><option value="out">{t('salida')}</option><option value="both">{t('ambas')}</option></select>}
        <label className="ad-field--inline"><input type="checkbox" checked={!!f.required} onChange={e => p({ required: e.target.checked || undefined })} /> <span>{t('obligatorio')}</span></label>
      </div>
    </div>
  );
}

function TemplateEditor({ el, lib }: { el: Element; lib: Library }) {
  const t = useT();
  const { store, run, registry } = useEditor();
  const defs = registry.fieldsOf(el.typeId).length ? registry.fieldsOf(el.typeId) : (lib.elementTypes.find(x => x.id === el.typeId)?.fields ?? []);
  const patch = (p: Record<string, unknown>) => run({ type: 'patch', collection: 'elements', id: el.id, patch: p });
  const n = templateInstances(store, el.id);
  // Estado de la plantilla desde la última propagación: contra él se decide qué campos siguen "sin tocar" en cada instancia.
  const [baseline, setBaseline] = useState<Element>(() => structuredClone(el));
  const plan = n > 0 ? propagateTemplate(store, baseline, el) : null;
  const dirty = JSON.stringify({ n: el.name, d: el.doc, f: el.fields }) !== JSON.stringify({ n: baseline.name, d: baseline.doc, f: baseline.fields });
  const apply = () => {
    if (!plan) return;
    if (plan.commands.length) run({ type: 'batch', label: t('aplicar plantilla a instancias'), commands: plan.commands });
    setBaseline(structuredClone(el));
  };
  const touched = plan?.touched.length ?? 0;
  return (
    <>
      <div className="ad-section">{t('Componente')} · {registry.elementType(el.typeId)?.name ?? el.typeId} · {n === 1 ? t('1 instancia') : t('{n} instancias', { n })}</div>
      {n > 0 && (
        <div className={`ad-ws-notice ${dirty ? '' : 'is-ok'}`}>
          {dirty
            ? <>{t('Has cambiado el componente.')} <b>{touched}</b> {t('de {n} instancia(s) recibirán los cambios (solo los campos que no habían modificado)', { n })}{plan && plan.skipped.length > 0 ? t('; {n} los tenían sobreescritos', { n: plan.skipped.length }) : ''}.</>
            : <>{t('Las instancias están al día con el componente.')}</>}
          <div className="ad-row"><button className="ad-btn ad-btn--primary" disabled={!dirty || !plan?.commands.length} onClick={apply}>{touched === 1 ? t('Aplicar a 1 instancia') : t('Aplicar a {n} instancias', { n: touched })}</button></div>
        </div>
      )}
      <label className="ad-field"><span>{t('Nombre')}</span><input className="ad-input ad-input--title" value={el.name} onChange={e => patch({ name: e.target.value })} /></label>
      <label className="ad-field"><span>{t('Documentación')}</span><textarea className="ad-input" rows={3} value={el.doc} onChange={e => patch({ doc: e.target.value })} /></label>
      {defs.map(d => <FieldEditor key={d.key} def={d} value={el.fields[d.key]} onChange={v => patch({ fields: { [d.key]: v } })} />)}
      {defs.length === 0 && <div className="ad-hint">{t('El tipo no tiene campos.')}</div>}
      <label className="ad-field"><span>{t('Etiquetas')}</span><input className="ad-input" value={el.tags.join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
      <div className="ad-hint">{t('Las instancias copian los datos del componente al crearse. Con «Aplicar a instancias» reciben los cambios en los campos que no hayan modificado.')}</div>
    </>
  );
}
