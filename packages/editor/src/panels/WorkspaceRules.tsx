/**
 * Pestaña Reglas: lista (activa, prioridad, nombre, impacto) y editor de condiciones y estilo,
 * con vista previa de un nodo de ejemplo. La resolución vive en `@all-draw/core` (`rules.ts`).
 */
import { useMemo, useState } from 'react';
import { ruleImpact, overriddenBy, type StyleRule, type Condition, type RuleSource, type RuleOp, type RuleStyle, type ViewNode } from '@all-draw/core';
import { useEditor } from '../context';
import { useCollection, useAnyChange } from '../hooks';
import { shapeStyle } from '../nodes/shapes';
import { RULE_SOURCES, RULE_OPS, OPS_SIN_VALOR, SOURCES_CON_CLAVE, STYLE_PARTS, STYLE_DEFAULTS, newRule, newCondition, duplicateRule, fieldKeys, clean } from './workspace-helpers';

export function RulesTab() {
  const { store, registry, run } = useEditor();
  const rules = useCollection('rules');
  useAnyChange();
  const [sel, setSel] = useState<string | null>(null);
  const sorted = useMemo(() => [...rules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name, 'es')), [rules]);
  const rule = rules.find(r => r.id === sel) ?? sorted[0];

  const create = () => { const r = newRule(); run({ type: 'set', collection: 'rules', id: r.id, value: r }); setSel(r.id); };
  const dup = (r: StyleRule) => { const c = duplicateRule(r); run({ type: 'set', collection: 'rules', id: c.id, value: c }); setSel(c.id); };
  const remove = (r: StyleRule) => { if (!confirm(`¿Borrar la regla "${r.name}"?`)) return; run({ type: 'delete', collection: 'rules', id: r.id }); if (sel === r.id) setSel(null); };

  return (
    <>
      <aside className="ad-ws-side">
        <div className="ad-ws-side__new"><button className="ad-btn ad-btn--primary" onClick={create}>＋ Nueva regla</button></div>
        <div className="ad-ws-side__list">
          {sorted.length === 0 && <div className="ad-empty">Sin reglas. Una regla pinta los elementos que cumplen sus condiciones.</div>}
          {sorted.map(r => {
            const n = ruleImpact(store, registry, r);
            const warn = r.conditions.length === 0 || overriddenBy(store, r).length > 0;
            return (
              <div key={r.id} className={`ad-ws-item ${rule?.id === r.id ? 'is-active' : ''} ${r.enabled ? '' : 'is-off'}`} onClick={() => setSel(r.id)}>
                <input type="checkbox" checked={r.enabled} title="Activa" onClick={e => e.stopPropagation()} onChange={e => run({ type: 'patch', collection: 'rules', id: r.id, patch: { enabled: e.target.checked } })} />
                <span className="ad-ws-swatch" style={{ background: r.style.bg ?? r.style.accent ?? r.style.border ?? '#e5e7eb', borderColor: r.style.border ?? 'transparent' }} />
                <span className="ad-ws-item__label">{r.name || '(sin nombre)'}</span>
                <small title="Prioridad · elementos afectados">{r.priority} · {n}{warn ? ' ⚠' : ''}</small>
              </div>
            );
          })}
        </div>
      </aside>
      <section className="ad-ws-main">
        {rule ? <RuleEditor key={rule.id} r={rule} onSelect={setSel} onDuplicate={() => dup(rule)} onDelete={() => remove(rule)} /> : <div className="ad-empty">Crea una regla para empezar.</div>}
      </section>
    </>
  );
}

const PREVIEW_NODE: ViewNode = { id: 'preview', viewId: 'preview', x: 0, y: 0, w: 170, h: 60, style: {} };

/** Nodo de ejemplo pintado con el estilo de la regla (mismo cálculo que el lienzo). */
export function RulePreview({ style, label = 'Ejemplo' }: { style: RuleStyle; label?: string }) {
  const css = shapeStyle('rounded', undefined, PREVIEW_NODE, style);
  return (
    <div className="ad-ws-preview">
      <div className={`ad-node ad-shape-rounded ${style.bold ? 'r-bold' : ''} ${style.strike ? 'r-strike' : ''}`} style={css}>
        <div className="ad-node__body">
          {style.icon && <span className="ad-node__icon">{style.icon}</span>}
          <span className="ad-node__label">{label}</span>
          {style.badge && <span className="ad-node__badge" style={{ background: style.badge }}>{style.badgeText}</span>}
          <span className="ad-node__type">Tipo</span>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ r, onSelect, onDuplicate, onDelete }: { r: StyleRule; onSelect: (id: string) => void; onDuplicate: () => void; onDelete: () => void }) {
  const { store, registry, run } = useEditor();
  const views = useCollection('views');
  const p = (patch: Record<string, unknown>) => run({ type: 'patch', collection: 'rules', id: r.id, patch });
  const setConds = (conditions: Condition[]) => p({ conditions });
  const impact = ruleImpact(store, registry, r);
  const pisadas = overriddenBy(store, r);
  const keys = useMemo(() => fieldKeys(store, registry), [store, registry]);
  const activa = (k: keyof RuleStyle) => r.style[k] !== undefined;
  const setStyle = (k: keyof RuleStyle, v: unknown) => p({ style: { [k]: v } });

  return (
    <>
      <div className="ad-ws-grid2">
        <label className="ad-field"><span>Nombre</span><input className="ad-input ad-input--title" value={r.name} onChange={e => p({ name: e.target.value })} /></label>
        <div className="ad-row ad-ws-rowfields">
          <label className="ad-field ad-field--inline"><input type="checkbox" checked={r.enabled} onChange={e => p({ enabled: e.target.checked })} /> <span>Activa</span></label>
          <label className="ad-field"><span>Prioridad</span><input className="ad-input ad-ws-narrow" type="number" value={r.priority} title="Mayor número = manda sobre las demás" onChange={e => p({ priority: Number(e.target.value) || 0 })} /></label>
          <label className="ad-field"><span>Se aplica a</span><select className="ad-input" value={r.target} onChange={e => p({ target: e.target.value })}><option value="element">Elementos</option><option value="relation">Relaciones</option></select></label>
          <label className="ad-field"><span>En la vista</span><select className="ad-input" value={r.viewId ?? ''} onChange={e => p({ viewId: e.target.value || null })}><option value="">Todas las vistas</option>{views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        </div>
      </div>
      {r.target === 'relation' && <div className="ad-hint">Sobre relaciones se evalúan Nombre, Documentación, Tipo, Notación, Propiedad y Campo. Se pintan: Borde → color de la línea, Grosor y Estilo del borde → la línea, Fondo/Texto/Punto/Icono/Negrita/Tachado → la etiqueta.</div>}

      <div className="ad-section">Condiciones ({r.conditions.length})</div>
      <label className="ad-field"><span>Debe cumplirse</span><select className="ad-input ad-ws-narrow3" value={r.match} onChange={e => p({ match: e.target.value })}><option value="all">Todas las condiciones</option><option value="any">Alguna condición</option></select></label>
      {r.conditions.map((c, i) => (
        <CondRow key={i} c={c} keys={keys} idx={`${r.id}-${i}`}
          onChange={nc => setConds(r.conditions.map((x, j) => j === i ? nc : x))}
          onRemove={() => setConds(r.conditions.filter((_, j) => j !== i))} />
      ))}
      <button className="ad-btn" onClick={() => setConds([...r.conditions, newCondition()])}>＋ Añadir condición</button>
      <div className={`ad-ws-notice ${impact > 0 ? 'is-ok' : ''}`}>
        {r.conditions.length === 0 ? 'Sin condiciones la regla no pinta nada. Añade al menos una.' : `Ahora mismo casa con ${impact} elemento(s)${r.enabled ? '' : ' (pero está desactivada)'}.`}
      </div>

      <div className="ad-section">Qué se pinta</div>
      <RulePreview style={r.style} />
      <div className="ad-ws-stylegrid">
        {STYLE_PARTS.map(({ key, label, kind }) => (
          <div key={key} className={`ad-ws-stylerow ${activa(key) ? 'is-on' : ''}`}>
            <label className="ad-field--inline"><input type="checkbox" checked={activa(key)} onChange={() => setStyle(key, activa(key) ? undefined : STYLE_DEFAULTS[key])} /> <span>{label}</span></label>
            {activa(key) && kind === 'color' && <input type="color" value={String(r.style[key] ?? '#000000')} onChange={e => setStyle(key, e.target.value)} />}
            {activa(key) && kind === 'number' && <input className="ad-input ad-ws-narrow" type="number" step={key === 'opacity' ? 0.1 : 1} min={0} max={key === 'opacity' ? 1 : 20} value={Number(r.style[key] ?? 0)} onChange={e => setStyle(key, Number(e.target.value))} />}
            {activa(key) && kind === 'text' && <input className="ad-input ad-ws-narrow" value={String(r.style[key] ?? '')} maxLength={key === 'icon' ? 4 : 6} onChange={e => setStyle(key, e.target.value)} />}
            {activa(key) && kind === 'select' && <select className="ad-input ad-ws-narrow2" value={String(r.style[key] ?? 'solid')} onChange={e => setStyle(key, e.target.value)}><option value="solid">Continuo</option><option value="dashed">Discontinuo</option><option value="dotted">Punteado</option></select>}
          </div>
        ))}
      </div>

      {pisadas.length > 0 && <>
        <div className="ad-section">Se la pisan ({pisadas.length})</div>
        <div className="ad-hint">Estas reglas tienen más prioridad y ganan en las propiedades indicadas.</div>
        {pisadas.map(({ rule, props }) => (
          <div key={rule.id} className="ad-row"><button className="ad-link ad-ws-inline" onClick={() => onSelect(rule.id)}>{rule.name} <small>({rule.priority})</small></button><small className="ad-hint">{props.map(k => STYLE_PARTS.find(s => s.key === k)?.label ?? k).join(', ')}</small></div>
        ))}
      </>}

      <div className="ad-row ad-ws-actions">
        <button className="ad-btn" onClick={onDuplicate}>⧉ Duplicar</button>
        <button className="ad-btn ad-ws-danger" onClick={onDelete}>Eliminar regla</button>
      </div>
    </>
  );
}

function CondRow({ c, keys, idx, onChange, onRemove }: { c: Condition; keys: { key: string; label: string }[]; idx: string; onChange: (c: Condition) => void; onRemove: () => void }) {
  const p = (patch: Partial<Condition>) => onChange(clean({ ...c, ...patch }));
  const sinValor = OPS_SIN_VALOR.has(c.op);
  return (
    <div className="ad-ws-cond">
      <select className="ad-input" value={c.source} onChange={e => p({ source: e.target.value as RuleSource })}>
        {(Object.keys(RULE_SOURCES) as RuleSource[]).map(k => <option key={k} value={k}>{RULE_SOURCES[k]}</option>)}
      </select>
      {SOURCES_CON_CLAVE.has(c.source) && <>
        <input className="ad-input" list={`ad-ws-keys-${idx}`} value={c.key ?? ''} placeholder={c.source === 'field' ? 'clave del campo' : 'nombre de la propiedad'} onChange={e => p({ key: e.target.value })} />
        {c.source === 'field' && <datalist id={`ad-ws-keys-${idx}`}>{keys.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}</datalist>}
      </>}
      <select className="ad-input" value={c.op} onChange={e => p({ op: e.target.value as RuleOp })}>
        {(Object.keys(RULE_OPS) as RuleOp[]).map(k => <option key={k} value={k}>{RULE_OPS[k]}</option>)}
      </select>
      {!sinValor && <input className="ad-input" value={c.value ?? ''} placeholder={c.op === 'in' ? 'valor 1, valor 2…' : c.op === 'regex' ? 'expresión' : 'valor'} onChange={e => p({ value: e.target.value })} />}
      <label className="ad-field--inline" title="Distinguir mayúsculas y tildes"><input type="checkbox" checked={!!c.caseSensitive} onChange={e => p({ caseSensitive: e.target.checked || undefined })} /> <span>Aa</span></label>
      <button className="ad-btn ad-btn--ghost" title="Quitar condición" onClick={onRemove}>×</button>
    </div>
  );
}
