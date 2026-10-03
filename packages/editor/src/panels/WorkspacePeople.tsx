/**
 * Pestaña Personas: lista de personas y sus asignaciones (a elementos, vistas, capas, etapas,
 * tipos o relaciones) con un papel.
 */
import { useMemo, useState } from 'react';
import type { Person, Assignment } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useCollection, useAnyChange } from '../hooks';
import { ASSIGN_KINDS, assignmentTargets, targetLabel, newPerson, newAssignment, suggestedRoles, clean, type AssignKind } from './workspace-helpers';
import { Icon } from '../icons';
import { confirmDialog } from '../ui/dialog';

export function PeopleTab() {
  const t = useT();
  const { run } = useEditor();
  const people = useCollection('people');
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const sorted = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name, 'es')), [people]);
  const person = people.find(p => p.id === sel) ?? sorted[0];

  const create = () => { const p = newPerson(name || t('Persona nueva')); run({ type: 'set', collection: 'people', id: p.id, value: p }); setSel(p.id); setName(''); };
  const remove = async (p: Person) => {
    const n = p.assignments.length;
    if (!(await confirmDialog({ title: t('¿Borrar a "{name}"?', { name: p.name }), message: n > 0 ? t('Tiene {n} asignación(es), que también se borrarán.', { n }) : undefined, danger: true }))) return;
    run({ type: 'delete', collection: 'people', id: p.id }); if (sel === p.id) setSel(null);
  };

  return (
    <>
      <aside className="ad-ws-side">
        <div className="ad-ws-side__new">
          <input className="ad-input" placeholder={t('Nueva persona…')} aria-label={t('Nueva persona')} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} />
          <button className="ad-btn" onClick={create} title={t('Crear persona')}><Icon name="plus" /></button>
        </div>
        <div className="ad-ws-side__list">
          {sorted.length === 0 && <div className="ad-empty">{t('Sin personas. Añade a quien participa en el modelo.')}</div>}
          {sorted.map(p => (
            <div key={p.id} className={`ad-ws-item ${person?.id === p.id ? 'is-active' : ''}`} onClick={() => setSel(p.id)}>
              <span className="ad-ws-avatar">{initials(p.name)}</span>
              <span className="ad-ws-item__label">{p.name || t('(sin nombre)')}<small>{p.team ?? p.email ?? ''}</small></span>
              <small>{p.assignments.length}</small>
              <button className="ad-btn ad-btn--ghost" title={t('Borrar persona')} onClick={e => { e.stopPropagation(); remove(p); }}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      </aside>
      <section className="ad-ws-main">
        {person ? <PersonEditor key={person.id} p={person} /> : <div className="ad-empty">{t('Crea una persona para empezar.')}</div>}
      </section>
    </>
  );
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function PersonEditor({ p }: { p: Person }) {
  const t = useT();
  const { store, registry, run } = useEditor();
  const people = useCollection('people');
  useAnyChange();
  const patch = (patch: Record<string, unknown>) => run({ type: 'patch', collection: 'people', id: p.id, patch });
  const setAssignments = (assignments: Assignment[]) => patch({ assignments });
  const [kind, setKind] = useState<AssignKind>('element');
  const [target, setTarget] = useState('');
  const [role, setRole] = useState('Owner');
  const targets = useMemo(() => assignmentTargets(store, registry, kind), [store, registry, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = suggestedRoles(people);
  const targetId = targets.some(x => x.id === target) ? target : (targets[0]?.id ?? '');
  const add = () => {
    if (!targetId) return;
    setAssignments([...p.assignments, newAssignment(kind, targetId, role)]);
  };
  return (
    <>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>{t('Nombre')}</span><input className="ad-input ad-input--title" value={p.name} onChange={e => patch({ name: e.target.value })} /></label>
        <label className="ad-field"><span>{t('Correo')}</span><input className="ad-input" type="email" value={p.email ?? ''} onChange={e => patch({ email: e.target.value || undefined })} /></label>
        <label className="ad-field"><span>{t('Equipo')}</span><input className="ad-input" value={p.team ?? ''} onChange={e => patch({ team: e.target.value || undefined })} /></label>
      </div>
      <label className="ad-field"><span>{t('Notas')}</span><textarea className="ad-input" rows={2} value={p.notes ?? ''} onChange={e => patch({ notes: e.target.value || undefined })} /></label>

      <div className="ad-section">{t('Asignaciones')} ({p.assignments.length})</div>
      {p.assignments.length === 0 && <div className="ad-hint">{t('Sin asignaciones. Añade abajo dónde participa esta persona y con qué papel.')}</div>}
      {p.assignments.map((a, i) => (
        <div key={a.id} className="ad-ws-assign">
          <span className="ad-ws-chip">{t(ASSIGN_KINDS[a.kind])}</span>
          <span className="ad-ws-item__label" title={a.targetId}>{targetLabel(store, registry, a)}</span>
          <input className="ad-input ad-ws-narrow2" list="ad-ws-roles" value={a.role} placeholder={t('papel')} aria-label={t('Papel')} onChange={e => setAssignments(p.assignments.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
          <input className="ad-input" value={a.notes ?? ''} placeholder={t('notas')} aria-label={t('Notas')} onChange={e => setAssignments(p.assignments.map((x, j) => j === i ? clean({ ...x, notes: e.target.value || undefined }) : x))} />
          <button className="ad-btn ad-btn--ghost" title={t('Quitar asignación')} onClick={() => setAssignments(p.assignments.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
        </div>
      ))}
      <div className="ad-ws-assign ad-ws-assign--new">
        <select className="ad-input ad-ws-narrow2" aria-label={t('Clase de destino')} value={kind} onChange={e => setKind(e.target.value as AssignKind)}>
          {(Object.keys(ASSIGN_KINDS) as AssignKind[]).map(k => <option key={k} value={k}>{t(ASSIGN_KINDS[k])}</option>)}
        </select>
        <select className="ad-input" aria-label={t('Destino')} value={targetId} onChange={e => setTarget(e.target.value)}>
          {targets.length === 0 && <option value="">{t('(no hay {kind})', { kind: t(ASSIGN_KINDS[kind]).toLowerCase() })}</option>}
          {targets.map(x => <option key={x.id} value={x.id}>{x.label}{x.hint ? ` · ${x.hint}` : ''}</option>)}
        </select>
        <input className="ad-input ad-ws-narrow2" list="ad-ws-roles" value={role} placeholder={t('papel')} aria-label={t('Papel')} onChange={e => setRole(e.target.value)} />
        <button className="ad-btn ad-btn--primary" disabled={!targetId} onClick={add}><Icon name="plus" size={14} />{t('Asignar')}</button>
      </div>
      <datalist id="ad-ws-roles">{roles.map(r => <option key={r} value={r} />)}</datalist>
    </>
  );
}
