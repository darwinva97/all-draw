/**
 * Diagnósticos con el contrato de archify: `{ code, severity, subject, message, evidence, supportedFixes }`.
 * Un agente puede leerlos y aplicar `supportedFixes` como comandos.
 */
import type { Command } from './commands';
import { allPorts, compatibleRelationTypes } from './ports';
import type { NotationRegistry } from './notation';
import type { Store } from './store';
import { indexOf } from './query';

export type Severity = 'error' | 'warning' | 'info';
export interface Diagnostic {
  code: string;
  severity: Severity;
  subject: { collection: string; id: string };
  message: string;
  evidence?: Record<string, unknown>;
  supportedFixes: { label: string; command: Command }[];
}

/**
 * Contexto de un validador. `viewId` es opcional: los validadores geométricos (por vista) pueden
 * limitarse a esa vista cuando la interfaz lo pide; los del modelo lo ignoran.
 */
export interface ValidatorContext { store: Store; reg: NotationRegistry; viewId?: string | null }
export interface Validator { id: string; run(ctx: ValidatorContext): Diagnostic[] }

const fix = (label: string, command: Command) => ({ label, command });

/** Integridad referencial: todo id apuntado existe. */
export const referentialIntegrity: Validator = {
  id: 'core.refs',
  run({ store }) {
    const out: Diagnostic[] = [];
    const has = (c: 'elements' | 'relations' | 'views' | 'nodes', id?: string) => !id || store.get(c, id) !== undefined;
    for (const n of store.list('nodes')) {
      if (!has('views', n.viewId)) out.push({ code: 'node-without-view', severity: 'error', subject: { collection: 'nodes', id: n.id }, message: `El nodo ${n.id} apunta a una vista inexistente`, supportedFixes: [fix('Borrar nodo', { type: 'deleteNode', id: n.id })] });
      if (!has('elements', n.elementId)) out.push({ code: 'node-without-element', severity: 'error', subject: { collection: 'nodes', id: n.id }, message: `El nodo ${n.id} apunta a un elemento inexistente`, supportedFixes: [fix('Borrar nodo', { type: 'deleteNode', id: n.id })] });
      if (n.parentNodeId && !has('nodes', n.parentNodeId)) out.push({ code: 'node-orphan-parent', severity: 'warning', subject: { collection: 'nodes', id: n.id }, message: `El nodo ${n.id} tiene un padre inexistente`, supportedFixes: [fix('Desanidar', { type: 'patch', collection: 'nodes', id: n.id, patch: { parentNodeId: undefined } })] });
      if (n.detailViewId && !has('views', n.detailViewId)) out.push({ code: 'node-dangling-detail', severity: 'warning', subject: { collection: 'nodes', id: n.id }, message: `El nodo ${n.id} enlaza a una vista de detalle inexistente`, supportedFixes: [fix('Quitar enlace', { type: 'patch', collection: 'nodes', id: n.id, patch: { detailViewId: undefined } })] });
    }
    for (const e of store.list('edges')) {
      const bad = !has('views', e.viewId) || !has('nodes', e.fromNodeId) || !has('nodes', e.toNodeId) || !has('relations', e.relationId);
      if (bad) out.push({ code: 'edge-dangling', severity: 'error', subject: { collection: 'edges', id: e.id }, message: `La arista ${e.id} apunta a algo inexistente`, supportedFixes: [fix('Borrar arista', { type: 'delete', collection: 'edges', id: e.id })] });
      else {
        const a = store.get('nodes', e.fromNodeId)!, b = store.get('nodes', e.toNodeId)!;
        if (a.viewId !== e.viewId || b.viewId !== e.viewId) out.push({ code: 'edge-cross-view', severity: 'error', subject: { collection: 'edges', id: e.id }, message: `La arista ${e.id} une nodos de otra vista`, supportedFixes: [fix('Borrar arista', { type: 'delete', collection: 'edges', id: e.id })] });
        const r = e.relationId ? store.get('relations', e.relationId) : undefined;
        if (r && a.elementId && b.elementId && r.from.elementId && r.to.elementId && (r.from.elementId !== a.elementId || r.to.elementId !== b.elementId))
          out.push({ code: 'edge-relation-mismatch', severity: 'error', subject: { collection: 'edges', id: e.id }, message: `La arista ${e.id} dibuja una relación entre otros elementos`, supportedFixes: [fix('Borrar arista', { type: 'delete', collection: 'edges', id: e.id })] });
      }
    }
    for (const r of store.list('relations')) {
      const okFrom = r.from.elementId ? has('elements', r.from.elementId) : has('relations', r.from.relationId) && !!r.from.relationId;
      const okTo = r.to.elementId ? has('elements', r.to.elementId) : has('relations', r.to.relationId) && !!r.to.relationId;
      if (!okFrom || !okTo) out.push({ code: 'relation-dangling', severity: 'error', subject: { collection: 'relations', id: r.id }, message: `La relación ${r.id} apunta a un extremo inexistente`, supportedFixes: [fix('Borrar relación', { type: 'deleteRelation', id: r.id })] });
    }
    for (const v of store.list('views')) if (v.rootElementId && !has('elements', v.rootElementId))
      out.push({ code: 'view-dangling-root', severity: 'warning', subject: { collection: 'views', id: v.id }, message: `La vista ${v.name} detalla un elemento inexistente`, supportedFixes: [fix('Quitar raíz', { type: 'patch', collection: 'views', id: v.id, patch: { rootElementId: undefined } })] });
    return out;
  },
};

/** Tipos conocidos y relaciones válidas según la matriz del pack. */
export const typeValidity: Validator = {
  id: 'core.types',
  run({ store, reg }) {
    const out: Diagnostic[] = [];
    let portRules: ReturnType<typeof reg.allPacks>[number]['portRules'] | undefined;
    for (const e of store.list('elements')) if (!reg.elementType(e.typeId))
      out.push({ code: 'unknown-element-type', severity: 'warning', subject: { collection: 'elements', id: e.id }, message: `"${e.name}" es de un tipo desconocido (${e.typeId})`, evidence: { typeId: e.typeId }, supportedFixes: [] });
    for (const r of store.list('relations')) {
      if (!reg.relationType(r.typeId)) { out.push({ code: 'unknown-relation-type', severity: 'warning', subject: { collection: 'relations', id: r.id }, message: `Relación de tipo desconocido (${r.typeId})`, supportedFixes: [] }); continue; }
      const a = r.from.elementId ? store.get('elements', r.from.elementId) : undefined;
      const b = r.to.elementId ? store.get('elements', r.to.elementId) : undefined;
      if (!a || !b) continue;
      const allowed = reg.allowedRelations(a.typeId, b.typeId);
      if (!allowed.includes(r.typeId)) {
        out.push({
          code: 'invalid-relation', severity: 'error', subject: { collection: 'relations', id: r.id },
          message: `${reg.relationType(r.typeId)?.name} no es válida entre ${reg.elementType(a.typeId)?.name ?? a.typeId} y ${reg.elementType(b.typeId)?.name ?? b.typeId}`,
          evidence: { allowed },
          supportedFixes: [
            ...allowed.slice(0, 3).map(t => fix(`Cambiar a ${reg.relationType(t)?.name ?? t}`, { type: 'patch', collection: 'relations', id: r.id, patch: { typeId: t } } as Command)),
            fix('Borrar relación', { type: 'deleteRelation', id: r.id }),
          ],
        });
      }
      // Puertos
      if (r.from.portId || r.to.portId) {
        const pf = a && r.from.portId ? allPorts(a, reg.fieldsOf(a.typeId)).find(p => p.id === r.from.portId) : undefined;
        const pt = b && r.to.portId ? allPorts(b, reg.fieldsOf(b.typeId)).find(p => p.id === r.to.portId) : undefined;
        if ((r.from.portId && !pf) || (r.to.portId && !pt))
          out.push({ code: 'relation-missing-port', severity: 'warning', subject: { collection: 'relations', id: r.id }, message: `La relación usa un puerto que ya no existe`, supportedFixes: [fix('Quitar puertos', { type: 'patch', collection: 'relations', id: r.id, patch: { from: { portId: undefined }, to: { portId: undefined } } })] });
        portRules ??= reg.allPacks().flatMap(p => p.portRules ?? []);
        const compat = compatibleRelationTypes(portRules, pf?.portTypeId, pt?.portTypeId);
        if (compat && !compat.includes(r.typeId))
          out.push({ code: 'incompatible-ports', severity: 'warning', subject: { collection: 'relations', id: r.id }, message: `Los puertos ${pf?.key} y ${pt?.key} no admiten ${r.typeId}`, evidence: { compat }, supportedFixes: [] });
      }
    }
    return out;
  },
};

/** Higiene del modelo (inspirado en el validador de Archi). */
export const hygiene: Validator = {
  id: 'core.hygiene',
  run({ store, reg }) {
    const out: Diagnostic[] = [];
    const index = indexOf(store);
    const used = new Set(store.list('nodes').map(n => n.elementId));
    for (const e of store.list('elements')) {
      if (e.template) continue;
      if (!used.has(e.id)) out.push({ code: 'element-unused', severity: 'info', subject: { collection: 'elements', id: e.id }, message: `"${e.name}" no aparece en ninguna vista`, supportedFixes: [fix('Borrar elemento', { type: 'deleteElement', id: e.id })] });
      if (!e.name.trim()) out.push({ code: 'element-empty-name', severity: 'warning', subject: { collection: 'elements', id: e.id }, message: `Elemento sin nombre (${reg.elementType(e.typeId)?.name ?? e.typeId})`, supportedFixes: [] });
    }
    const byKey = new Map<string, string[]>();
    for (const e of store.list('elements')) { const k = `${e.typeId}|${e.name.trim().toLowerCase()}`; if (e.name.trim()) byKey.set(k, [...(byKey.get(k) ?? []), e.id]); }
    for (const [, ids] of byKey) if (ids.length > 1) for (const id of ids)
      out.push({ code: 'element-duplicate', severity: 'info', subject: { collection: 'elements', id }, message: `Hay ${ids.length} elementos con el mismo tipo y nombre`, evidence: { ids }, supportedFixes: [] });
    const usedRel = new Set(store.list('edges').map(e => e.relationId));
    for (const r of store.list('relations')) if (!usedRel.has(r.id))
      out.push({ code: 'relation-unused', severity: 'info', subject: { collection: 'relations', id: r.id }, message: `Relación no dibujada en ninguna vista`, supportedFixes: [fix('Borrar relación', { type: 'deleteRelation', id: r.id })] });
    for (const v of store.list('views')) if (index.nodesOfView(v.id).length === 0)
      out.push({ code: 'view-empty', severity: 'info', subject: { collection: 'views', id: v.id }, message: `La vista "${v.name}" está vacía`, supportedFixes: [] });
    // Viewpoint
    for (const v of store.list('views')) {
      if (!v.viewpointId) continue;
      for (const n of index.nodesOfView(v.id)) {
        if (!n.elementId) continue;
        const e = store.get('elements', n.elementId); if (!e) continue;
        if (reg.notationOf(e.typeId) === v.notationId && !reg.inViewpoint(v.notationId, v.viewpointId, e.typeId))
          out.push({ code: 'viewpoint-violation', severity: 'warning', subject: { collection: 'nodes', id: n.id }, message: `"${e.name}" no pertenece al viewpoint de la vista`, supportedFixes: [fix('Quitar de la vista', { type: 'deleteNode', id: n.id })] });
      }
    }
    return out;
  },
};

export const DEFAULT_VALIDATORS: Validator[] = [referentialIntegrity, typeValidity, hygiene];

/** Ejecuta los validadores. `viewId` (opcional) acota los validadores por vista a esa vista. */
export function validate(store: Store, reg: NotationRegistry, validators = DEFAULT_VALIDATORS, viewId?: string | null): Diagnostic[] {
  return validators.flatMap(v => v.run({ store, reg, viewId }));
}
