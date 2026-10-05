/**
 * Resumen de diferencias entre dos estados de un espacio (p. ej. una instantánea del historial y el estado actual):
 * elementos, relaciones y vistas añadidos, borrados y cambiados, con sus nombres y qué cambió.
 */
import type { Workspace } from '@all-draw/core';
import { jsonEqual } from './ydoc';

export interface DiffItem {
  id: string;
  name: string;
  /** Solo en `changed`: claves de primer nivel que cambiaron (`name`, `doc`, `fields`…; `content` = sus nodos o aristas en una vista). */
  keys?: string[];
  /** Solo en `changed`, si cambió el nombre: el de antes. */
  was?: string;
}
export interface DiffGroup { added: DiffItem[]; removed: DiffItem[]; changed: DiffItem[] }
export interface WorkspaceDiff {
  elements: DiffGroup;
  relations: DiffGroup;
  views: DiffGroup;
  /** Cambios en el resto (librerías, personas, reglas, comentarios, dimensiones), solo el número. */
  other: number;
  /** ¿Cambió el nombre o la descripción del espacio? */
  meta: boolean;
}

const byName = (a: DiffItem, b: DiffItem) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
const emptyGroup = (): DiffGroup => ({ added: [], removed: [], changed: [] });

function changedKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(k => !jsonEqual(a[k], b[k])).sort();
}

/**
 * Qué cambió de `before` a `after`. Las relaciones sin nombre se describen como «origen → destino» (con los nombres
 * de los elementos de `after` o, si ya no existen, de `before`). Una vista cuenta como cambiada si cambia su registro
 * o cualquiera de sus nodos o aristas.
 */
export function diffWorkspaces(before: Workspace, after: Workspace): WorkspaceDiff {
  const out: WorkspaceDiff = { elements: emptyGroup(), relations: emptyGroup(), views: emptyGroup(), other: 0, meta: false };
  const elName = (id: string | undefined) => (id ? (after.elements[id] ?? before.elements[id])?.name || id : '?');
  const nameOf = {
    elements: (r: Workspace['elements'][string]) => r.name || r.id,
    relations: (r: Workspace['relations'][string]) => r.name || `${elName(r.from.elementId)} → ${elName(r.to.elementId)}`,
    views: (r: Workspace['views'][string]) => r.name || r.id,
  };
  for (const c of ['elements', 'relations', 'views'] as const) {
    const a = before[c] as Record<string, Record<string, unknown>>, b = after[c] as Record<string, Record<string, unknown>>;
    const name = nameOf[c] as (r: Record<string, unknown>) => string;
    const g = out[c];
    for (const [id, rec] of Object.entries(b)) {
      const prev = a[id];
      if (!prev) { g.added.push({ id, name: name(rec) }); continue; }
      const keys = changedKeys(prev, rec);
      if (!keys.length) continue;
      const item: DiffItem = { id, name: name(rec), keys };
      const old = name(prev);
      if (old !== item.name) item.was = old;
      g.changed.push(item);
    }
    for (const [id, rec] of Object.entries(a)) if (!b[id]) g.removed.push({ id, name: name(rec) });
  }
  // Contenido de las vistas (nodos y aristas), agrupado por vista.
  const contentOf = (ws: Workspace) => {
    const m = new Map<string, Record<string, unknown>>();
    for (const c of ['nodes', 'edges'] as const) for (const r of Object.values(ws[c])) {
      let o = m.get(r.viewId); if (!o) m.set(r.viewId, (o = {}));
      o[`${c}:${r.id}`] = r;
    }
    return m;
  };
  const ca = contentOf(before), cb = contentOf(after);
  for (const [id, v] of Object.entries(after.views)) {
    if (!before.views[id] || jsonEqual(ca.get(id) ?? {}, cb.get(id) ?? {})) continue;
    const hit = out.views.changed.find(x => x.id === id);
    if (hit) hit.keys = [...hit.keys!, 'content'];
    else out.views.changed.push({ id, name: nameOf.views(v), keys: ['content'] });
  }
  for (const g of [out.elements, out.relations, out.views]) { g.added.sort(byName); g.removed.sort(byName); g.changed.sort(byName); }
  for (const c of ['libraries', 'people', 'rules', 'comments', 'dimensions'] as const) {
    const a = before[c] as Record<string, unknown>, b = after[c] as Record<string, unknown>;
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) if (!jsonEqual(a[id], b[id])) out.other++;
  }
  out.meta = before.meta.name !== after.meta.name || before.meta.description !== after.meta.description;
  return out;
}

/** ¿No hay ninguna diferencia? */
export function isEmptyDiff(d: WorkspaceDiff): boolean {
  return !d.meta && d.other === 0 && [d.elements, d.relations, d.views].every(g => !g.added.length && !g.removed.length && !g.changed.length);
}
