/**
 * Pestaña Librerías: librerías → tipos de elemento (con sus campos) y componentes (plantillas).
 * Los tipos viven dentro del registro `Library`, así que cada cambio hace `set` del registro entero.
 */
import { useState } from 'react';
import type { Library, ElementType, FieldDef, FieldKind, Shape, Element, Command } from '@all-draw/core';
import { useEditor } from '../context';
import { useCollection, useAnyChange } from '../hooks';
import { FieldEditor } from './Inspector';
import {
  FIELD_KINDS, SHAPES, newElementType, newFieldFromLabel, newLibrary, newTemplate, moveItem, withType, withoutType,
  typeUsage, libraryUsage, templateInstances, clean,
} from './workspace-helpers';

export function LibrariesTab() {
  const { store, run } = useEditor();
  const libs = useCollection('libraries');
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const lib = libs.find(l => l.id === sel) ?? libs[0];

  const create = () => {
    const l = newLibrary(name || 'Librería nueva');
    run({ type: 'set', collection: 'libraries', id: l.id, value: l });
    setSel(l.id); setName('');
  };
  const remove = (l: Library) => {
    const uses = libraryUsage(store, l.id);
    const msg = uses > 0
      ? `La librería "${l.name}" tiene ${uses} elemento(s) que la usan (componentes o instancias de sus tipos). Se borrarán sus componentes; las instancias quedarán con un tipo desconocido. ¿Borrar?`
      : `¿Borrar la librería "${l.name}"?`;
    if (!confirm(msg)) return;
    const cmds: Command[] = store.list('elements').filter(e => e.template && e.libraryId === l.id).map(e => ({ type: 'deleteElement', id: e.id }));
    cmds.push({ type: 'delete', collection: 'libraries', id: l.id });
    run({ type: 'batch', label: 'borrar librería', commands: cmds });
    if (sel === l.id) setSel(null);
  };

  return (
    <>
      <aside className="ad-ws-side">
        <div className="ad-ws-side__new">
          <input className="ad-input" placeholder="Nueva librería…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} />
          <button className="ad-btn" onClick={create} title="Crear librería">＋</button>
        </div>
        <div className="ad-ws-side__list">
          {libs.length === 0 && <div className="ad-empty">Sin librerías. Crea una arriba.</div>}
          {libs.map(l => (
            <div key={l.id} className={`ad-ws-item ${lib?.id === l.id ? 'is-active' : ''}`} onClick={() => setSel(l.id)}>
              <span className="ad-ws-item__label">{l.name}</span>
              <small>{l.elementTypes.length} tipo{l.elementTypes.length === 1 ? '' : 's'}</small>
              <button className="ad-btn ad-btn--ghost" title="Borrar librería" onClick={e => { e.stopPropagation(); remove(l); }}>×</button>
            </div>
          ))}
        </div>
      </aside>
      <section className="ad-ws-main">
        {lib ? <LibraryEditor key={lib.id} lib={lib} /> : <div className="ad-empty">Selecciona o crea una librería.</div>}
      </section>
    </>
  );
}

function LibraryEditor({ lib }: { lib: Library }) {
  const { store, run, registry } = useEditor();
  useAnyChange();
  const [typeId, setTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [compType, setCompType] = useState('');
  const [compName, setCompName] = useState('');
  const [compId, setCompId] = useState<string | null>(null);
  const setLib = (l: Library) => run({ type: 'set', collection: 'libraries', id: l.id, value: l });
  const type = lib.elementTypes.find(t => t.id === typeId) ?? null;
  const templates = store.list('elements').filter(e => e.template && e.libraryId === lib.id);
  const comp = templates.find(e => e.id === compId) ?? null;

  const addType = () => {
    const t = newElementType(lib, typeName || 'Tipo nuevo');
    setLib(withType(lib, t)); setTypeId(t.id); setTypeName('');
  };
  const removeType = (t: ElementType) => {
    const uses = typeUsage(store, t.id);
    if (!confirm(uses > 0 ? `El tipo "${t.name}" lo usan ${uses} elemento(s), que quedarán con tipo desconocido. ¿Borrar?` : `¿Borrar el tipo "${t.name}"?`)) return;
    setLib(withoutType(lib, t.id)); if (typeId === t.id) setTypeId(null);
  };
  const addComp = () => {
    const t = lib.elementTypes.find(x => x.id === compType) ?? lib.elementTypes[0];
    if (!t) return;
    const el = newTemplate(t, lib.id, compName || undefined);
    run({ type: 'set', collection: 'elements', id: el.id, value: el });
    setCompId(el.id); setCompName('');
  };
  const removeComp = (e: Element) => {
    const n = templateInstances(store, e.id);
    if (!confirm(n > 0 ? `El componente "${e.name}" tiene ${n} instancia(s) en el modelo, que seguirán existiendo sueltas. ¿Borrar el componente?` : `¿Borrar el componente "${e.name}"?`)) return;
    run({ type: 'deleteElement', id: e.id }); if (compId === e.id) setCompId(null);
  };

  return (
    <>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>Nombre</span><input className="ad-input ad-input--title" value={lib.name} onChange={e => setLib({ ...lib, name: e.target.value })} /></label>
        <label className="ad-field"><span>Descripción</span><input className="ad-input" value={lib.description} onChange={e => setLib({ ...lib, description: e.target.value })} /></label>
      </div>
      <div className="ad-hint">Id: <code>{lib.id}</code></div>

      <div className="ad-ws-cols">
        <div>
          <div className="ad-section">Tipos de elemento ({lib.elementTypes.length})</div>
          <div className="ad-ws-side__new">
            <input className="ad-input" placeholder="Nuevo tipo…" value={typeName} onChange={e => setTypeName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addType(); }} />
            <button className="ad-btn" onClick={addType}>＋</button>
          </div>
          {lib.elementTypes.map(t => (
            <div key={t.id} className={`ad-ws-item ${type?.id === t.id ? 'is-active' : ''}`} onClick={() => setTypeId(t.id)}>
              <span className="ad-pal__swatch" style={{ background: t.color ?? '#eee' }}>{t.icon ?? ''}</span>
              <span className="ad-ws-item__label">{t.name}</span>
              <small>{t.fields.length} campos · {typeUsage(store, t.id)} usos</small>
              <button className="ad-btn ad-btn--ghost" title="Borrar tipo" onClick={e => { e.stopPropagation(); removeType(t); }}>×</button>
            </div>
          ))}
          {lib.elementTypes.length === 0 && <div className="ad-hint">Sin tipos. Un tipo define la forma, el color y los campos de sus elementos.</div>}

          <div className="ad-section">Componentes ({templates.length})</div>
          <div className="ad-hint">Un componente es un elemento plantilla: al arrastrarlo desde la paleta se crea una instancia con sus datos.</div>
          {lib.elementTypes.length > 0 && <div className="ad-ws-side__new">
            <select className="ad-input" value={compType || lib.elementTypes[0]?.id} onChange={e => setCompType(e.target.value)}>
              {lib.elementTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className="ad-input" placeholder="Nombre del componente…" value={compName} onChange={e => setCompName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComp(); }} />
            <button className="ad-btn" onClick={addComp}>＋</button>
          </div>}
          {templates.map(e => {
            const t = registry.elementType(e.typeId) ?? lib.elementTypes.find(x => x.id === e.typeId);
            const n = templateInstances(store, e.id);
            return (
              <div key={e.id} className={`ad-ws-item ${comp?.id === e.id ? 'is-active' : ''}`} onClick={() => setCompId(e.id)}>
                <span className="ad-pal__swatch" style={{ background: t?.color ?? '#eee' }}>{t?.icon ?? ''}</span>
                <span className="ad-ws-item__label">{e.name || '(sin nombre)'}</span>
                <small>{t?.name ?? e.typeId} · {n} instancia{n === 1 ? '' : 's'}</small>
                <button className="ad-btn ad-btn--ghost" title="Borrar componente" onClick={ev => { ev.stopPropagation(); removeComp(e); }}>×</button>
              </div>
            );
          })}
        </div>
        <div className="ad-ws-detail">
          {type && <TypeEditor key={type.id} lib={lib} type={type} onChange={t => setLib(withType(lib, t))} />}
          {!type && comp && <TemplateEditor key={comp.id} el={comp} lib={lib} />}
          {!type && !comp && <div className="ad-empty">Elige un tipo o un componente para editarlo.</div>}
          {type && comp && <div className="ad-hint"><button className="ad-link" onClick={() => setTypeId(null)}>Cerrar el tipo para editar el componente «{comp.name}»</button></div>}
        </div>
      </div>
    </>
  );
}

function TypeEditor({ lib, type, onChange }: { lib: Library; type: ElementType; onChange: (t: ElementType) => void }) {
  const [label, setLabel] = useState('');
  const p = (patch: Partial<ElementType>) => onChange(clean({ ...type, ...patch }));
  const setFields = (fields: FieldDef[]) => p({ fields });
  const addField = () => { setFields([...type.fields, newFieldFromLabel(label || 'Campo', type.fields)]); setLabel(''); };
  return (
    <>
      <div className="ad-section">Tipo · <code>{type.id}</code></div>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>Nombre</span><input className="ad-input" value={type.name} onChange={e => p({ name: e.target.value })} /></label>
        <label className="ad-field"><span>Categoría (paleta)</span><input className="ad-input" value={type.category ?? ''} onChange={e => p({ category: e.target.value || undefined })} /></label>
        <label className="ad-field"><span>Color</span><span className="ad-row"><input type="color" value={type.color ?? '#e2e8f0'} onChange={e => p({ color: e.target.value })} /><input className="ad-input" value={type.color ?? ''} placeholder="#rrggbb" onChange={e => p({ color: e.target.value || undefined })} /></span></label>
        <label className="ad-field"><span>Icono (texto o emoji)</span><input className="ad-input" value={type.icon ?? ''} maxLength={4} onChange={e => p({ icon: e.target.value || undefined })} /></label>
        <label className="ad-field"><span>Forma</span><select className="ad-input" value={type.shape ?? 'rounded'} onChange={e => p({ shape: e.target.value as Shape })}>{SHAPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="ad-field ad-field--inline"><input type="checkbox" checked={!!type.container} onChange={e => p({ container: e.target.checked || undefined })} /> <span>Contenedor (puede contener otros nodos)</span></label>
      </div>
      <label className="ad-field"><span>Documentación</span><textarea className="ad-input" rows={2} value={type.doc ?? ''} onChange={e => p({ doc: e.target.value || undefined })} /></label>

      <div className="ad-section">Campos ({type.fields.length})</div>
      <div className="ad-ws-side__new">
        <input className="ad-input" placeholder="Etiqueta del campo nuevo…" value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addField(); }} />
        <button className="ad-btn" onClick={addField}>＋ campo</button>
      </div>
      {type.fields.map((f, i) => (
        <FieldDefRow key={i} f={f} first={i === 0} last={i === type.fields.length - 1}
          onChange={nf => setFields(type.fields.map((x, j) => j === i ? nf : x))}
          onMove={dir => setFields(moveItem(type.fields, i, dir))}
          onRemove={() => setFields(type.fields.filter((_, j) => j !== i))} />
      ))}
      {type.fields.length === 0 && <div className="ad-hint">Sin campos. Los campos JSON, lista y clave→valor generan pines automáticamente.</div>}
      <div className="ad-hint">Los cambios en el tipo se aplican a todos sus elementos, en todas las vistas (librería <b>{lib.name}</b>).</div>
    </>
  );
}

function FieldDefRow({ f, first, last, onChange, onMove, onRemove }: { f: FieldDef; first: boolean; last: boolean; onChange: (f: FieldDef) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const p = (patch: Partial<FieldDef>) => onChange(clean({ ...f, ...patch }));
  const auto = ['json', 'list', 'keyvalue'].includes(f.kind);
  const isPin = f.port ?? auto;
  return (
    <div className="ad-ws-fieldrow">
      <div className="ad-ws-fieldrow__main">
        <input className="ad-input" value={f.label} placeholder="Etiqueta" onChange={e => p({ label: e.target.value })} />
        <input className="ad-input ad-ws-mono" value={f.key} placeholder="clave" onChange={e => p({ key: e.target.value })} title="Clave interna del campo" />
        <select className="ad-input" value={f.kind} onChange={e => p({ kind: e.target.value as FieldKind })}>{FIELD_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        <span className="ad-ws-fieldrow__btns">
          <button className="ad-btn ad-btn--ghost" disabled={first} onClick={() => onMove(-1)} title="Subir">↑</button>
          <button className="ad-btn ad-btn--ghost" disabled={last} onClick={() => onMove(1)} title="Bajar">↓</button>
          <button className="ad-btn ad-btn--ghost" onClick={onRemove} title="Quitar campo">×</button>
        </span>
      </div>
      <div className="ad-ws-fieldrow__opts">
        {(f.kind === 'select' || f.kind === 'keyvalue') && <input className="ad-input" value={f.options ?? ''} placeholder={f.kind === 'select' ? 'Opciones separadas por coma' : 'Etiqueta clave|Etiqueta valor'} onChange={e => p({ options: e.target.value || undefined })} />}
        <label className="ad-field--inline"><input type="checkbox" checked={isPin} onChange={e => p({ port: e.target.checked === auto ? undefined : e.target.checked })} /> <span>genera pines</span></label>
        {isPin && <select className="ad-input ad-ws-narrow" value={f.direction ?? 'both'} onChange={e => p({ direction: e.target.value as FieldDef['direction'] })}><option value="in">entrada</option><option value="out">salida</option><option value="both">ambas</option></select>}
        <label className="ad-field--inline"><input type="checkbox" checked={!!f.required} onChange={e => p({ required: e.target.checked || undefined })} /> <span>obligatorio</span></label>
      </div>
    </div>
  );
}

function TemplateEditor({ el, lib }: { el: Element; lib: Library }) {
  const { store, run, registry } = useEditor();
  const defs = registry.fieldsOf(el.typeId).length ? registry.fieldsOf(el.typeId) : (lib.elementTypes.find(t => t.id === el.typeId)?.fields ?? []);
  const patch = (p: Record<string, unknown>) => run({ type: 'patch', collection: 'elements', id: el.id, patch: p });
  const n = templateInstances(store, el.id);
  return (
    <>
      <div className="ad-section">Componente · {registry.elementType(el.typeId)?.name ?? el.typeId} · {n} instancia{n === 1 ? '' : 's'}</div>
      <label className="ad-field"><span>Nombre</span><input className="ad-input ad-input--title" value={el.name} onChange={e => patch({ name: e.target.value })} /></label>
      <label className="ad-field"><span>Documentación</span><textarea className="ad-input" rows={3} value={el.doc} onChange={e => patch({ doc: e.target.value })} /></label>
      {defs.map(d => <FieldEditor key={d.key} def={d} value={el.fields[d.key]} onChange={v => patch({ fields: { [d.key]: v } })} />)}
      {defs.length === 0 && <div className="ad-hint">El tipo no tiene campos.</div>}
      <label className="ad-field"><span>Etiquetas</span><input className="ad-input" value={el.tags.join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
      <div className="ad-hint">Las instancias ya creadas no cambian al editar el componente: copian sus datos al crearse.</div>
    </>
  );
}
