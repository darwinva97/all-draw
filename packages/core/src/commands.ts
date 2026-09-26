/**
 * Toda mutación es un **comando** con inverso. Los comandos son datos (serializables): el editor,
 * la API REST y los agentes emiten exactamente los mismos. `execute` aplica sobre un `Store` y
 * devuelve el inverso, así que el historial de deshacer es una pila de comandos.
 */
import { newId } from './ids';
import type { Collection, Element, Relation, View, ViewEdge, ViewNode, RecordOf } from './model';
import type { Store } from './store';

export type Command =
  | { type: 'set'; collection: Collection; id: string; value: unknown }          // crear o reemplazar
  | { type: 'patch'; collection: Collection; id: string; patch: Record<string, unknown> }
  | { type: 'delete'; collection: Collection; id: string }
  | { type: 'batch'; label?: string; commands: Command[] }
  | { type: 'meta'; patch: Record<string, unknown> }
  // Comandos de alto nivel (se expanden en primitivos):
  | { type: 'addElementToView'; element: Element; node: Omit<ViewNode, 'elementId'> }
  | { type: 'deleteElement'; id: string }        // borra también sus apariciones y relaciones
  | { type: 'deleteNode'; id: string }           // borra la aparición, no el elemento, más aristas y descendientes
  | { type: 'deleteRelation'; id: string }       // borra la relación y todas sus aristas
  | { type: 'deleteView'; id: string }
  | { type: 'moveNodes'; moves: { id: string; x: number; y: number; parentNodeId?: string | null; cell?: ViewNode['cell'] | null }[] }
  | { type: 'connect'; relation: Relation; edge: Omit<ViewEdge, 'relationId'> };

function deepPatch<T extends object>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)) out[k] = deepPatch(cur as object, v as Record<string, unknown>);
    else if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out as T;
}

/** Expande un comando de alto nivel en primitivos, leyendo el estado actual. */
export function expand(store: Store, cmd: Command): Command[] {
  switch (cmd.type) {
    case 'addElementToView':
      return [
        { type: 'set', collection: 'elements', id: cmd.element.id, value: cmd.element },
        { type: 'set', collection: 'nodes', id: cmd.node.id, value: { ...cmd.node, elementId: cmd.element.id } },
      ];
    case 'connect':
      return [
        { type: 'set', collection: 'relations', id: cmd.relation.id, value: cmd.relation },
        { type: 'set', collection: 'edges', id: cmd.edge.id, value: { ...cmd.edge, relationId: cmd.relation.id } },
      ];
    case 'deleteNode': {
      const out: Command[] = [];
      const nodes = store.list('nodes');
      const doomed = new Set<string>([cmd.id]);
      let grew = true;
      while (grew) { grew = false; for (const n of nodes) if (n.parentNodeId && doomed.has(n.parentNodeId) && !doomed.has(n.id)) { doomed.add(n.id); grew = true; } }
      for (const e of store.list('edges')) if (doomed.has(e.fromNodeId) || doomed.has(e.toNodeId)) out.push({ type: 'delete', collection: 'edges', id: e.id });
      for (const id of doomed) out.push({ type: 'delete', collection: 'nodes', id });
      return out;
    }
    case 'deleteRelation': {
      const out: Command[] = [];
      for (const e of store.list('edges')) if (e.relationId === cmd.id) out.push({ type: 'delete', collection: 'edges', id: e.id });
      for (const r of store.list('relations')) if (r.from.relationId === cmd.id || r.to.relationId === cmd.id) out.push(...expand(store, { type: 'deleteRelation', id: r.id }));
      out.push({ type: 'delete', collection: 'relations', id: cmd.id });
      return out;
    }
    case 'deleteElement': {
      const out: Command[] = [];
      for (const n of store.list('nodes')) if (n.elementId === cmd.id) out.push(...expand(store, { type: 'deleteNode', id: n.id }));
      for (const r of store.list('relations')) if (r.from.elementId === cmd.id || r.to.elementId === cmd.id) out.push(...expand(store, { type: 'deleteRelation', id: r.id }));
      for (const v of store.list('views')) if (v.rootElementId === cmd.id) out.push({ type: 'patch', collection: 'views', id: v.id, patch: { rootElementId: undefined } });
      out.push({ type: 'delete', collection: 'elements', id: cmd.id });
      return dedupe(out);
    }
    case 'deleteView': {
      const out: Command[] = [];
      for (const e of store.list('edges')) if (e.viewId === cmd.id) out.push({ type: 'delete', collection: 'edges', id: e.id });
      for (const n of store.list('nodes')) if (n.viewId === cmd.id) out.push({ type: 'delete', collection: 'nodes', id: n.id });
      for (const n of store.list('nodes')) if (n.detailViewId === cmd.id) out.push({ type: 'patch', collection: 'nodes', id: n.id, patch: { detailViewId: undefined } });
      out.push({ type: 'delete', collection: 'views', id: cmd.id });
      return out;
    }
    case 'moveNodes':
      return cmd.moves.map(m => {
        const patch: Record<string, unknown> = { x: m.x, y: m.y };
        if (m.parentNodeId !== undefined) patch.parentNodeId = m.parentNodeId ?? undefined;
        if (m.cell !== undefined) patch.cell = m.cell ?? undefined;
        return { type: 'patch', collection: 'nodes', id: m.id, patch } as Command;
      });
    case 'batch':
      return cmd.commands.flatMap(c => expand(store, c));
    default:
      return [cmd];
  }
}

function dedupe(cmds: Command[]): Command[] {
  const seen = new Set<string>();
  return cmds.filter(c => {
    const k = c.type === 'delete' ? `d:${c.collection}:${c.id}` : JSON.stringify(c);
    if (seen.has(k)) return false; seen.add(k); return true;
  });
}

/** Aplica un primitivo y devuelve su inverso. */
function applyPrimitive(store: Store, cmd: Command): Command {
  switch (cmd.type) {
    case 'set': {
      const prev = store.get(cmd.collection, cmd.id);
      store.set(cmd.collection, cmd.id, cmd.value as never);
      return prev === undefined ? { type: 'delete', collection: cmd.collection, id: cmd.id } : { type: 'set', collection: cmd.collection, id: cmd.id, value: prev };
    }
    case 'patch': {
      const prev = store.get(cmd.collection, cmd.id);
      if (prev === undefined) throw new Error(`patch: ${cmd.collection}/${cmd.id} no existe`);
      store.set(cmd.collection, cmd.id, deepPatch(prev as object, cmd.patch) as never);
      return { type: 'set', collection: cmd.collection, id: cmd.id, value: prev };
    }
    case 'delete': {
      const prev = store.get(cmd.collection, cmd.id);
      store.delete(cmd.collection, cmd.id);
      return prev === undefined ? { type: 'batch', commands: [] } : { type: 'set', collection: cmd.collection, id: cmd.id, value: prev };
    }
    case 'meta': {
      const prev = { ...store.meta() } as Record<string, unknown>;
      store.setMeta(cmd.patch);
      return { type: 'meta', patch: Object.fromEntries(Object.keys(cmd.patch).map(k => [k, prev[k]])) };
    }
    default:
      throw new Error(`no es primitivo: ${cmd.type}`);
  }
}

/** Ejecuta un comando (de cualquier nivel) y devuelve el comando inverso. */
export function execute(store: Store, cmd: Command, origin = 'local'): Command {
  return store.transact(() => {
    const prims = expand(store, cmd);
    const inverses = prims.map(p => applyPrimitive(store, p)).reverse();
    return inverses.length === 1 ? inverses[0]! : { type: 'batch', label: cmd.type === 'batch' ? cmd.label : cmd.type, commands: inverses };
  }, origin);
}

/** Historial de deshacer/rehacer sobre un store cualquiera. */
export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  constructor(private store: Store, public limit = 500) {}
  run(cmd: Command): void {
    const inv = execute(this.store, cmd);
    this.undoStack.push(inv);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(): boolean {
    const inv = this.undoStack.pop(); if (!inv) return false;
    this.redoStack.push(execute(this.store, inv, 'undo')); return true;
  }
  redo(): boolean {
    const c = this.redoStack.pop(); if (!c) return false;
    this.undoStack.push(execute(this.store, c, 'redo')); return true;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack = []; this.redoStack = []; }
}

// ---------------------------------------------------------------- Fábricas cómodas
export function makeElement(typeId: string, name: string, extra: Partial<Element> = {}): Element {
  return { id: newId('el'), typeId, name, doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [], ...extra };
}
export function makeView(name: string, extra: Partial<View> = {}): View {
  return { id: newId('vw'), kind: 'freeform', notationId: 'freeform', name, doc: '', style: {}, props: {}, ...extra };
}
export function makeNode(viewId: string, elementId: string | undefined, pos: { x: number; y: number; w?: number; h?: number }, extra: Partial<ViewNode> = {}): ViewNode {
  return { id: newId('vn'), viewId, elementId, x: pos.x, y: pos.y, w: pos.w ?? 160, h: pos.h ?? 56, style: {}, ...extra };
}
export function makeRelation(typeId: string, from: Relation['from'], to: Relation['to'], extra: Partial<Relation> = {}): Relation {
  return { id: newId('rel'), typeId, name: '', doc: '', from, to, mappings: [], fields: {}, props: {}, features: {}, ...extra };
}
export function makeEdge(viewId: string, relationId: string | undefined, fromNodeId: string, toNodeId: string, extra: Partial<ViewEdge> = {}): ViewEdge {
  return { id: newId('ve'), viewId, relationId, fromNodeId, toNodeId, bendpoints: [], style: {}, ...extra };
}
export type { RecordOf };
