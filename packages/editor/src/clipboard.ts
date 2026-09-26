/**
 * Copiar / pegar / duplicar. Funciones puras sobre el modelo (sin DOM) más un portapapeles en
 * memoria del módulo con espejo best-effort en `navigator.clipboard` (JSON marcado con
 * `application/x-all-draw`, para poder pegar entre pestañas).
 *
 * Dos modos de pegado:
 * - `appearance`: nuevas apariciones (`ViewNode`/`ViewEdge` nuevos) de los **mismos** elementos y
 *   relaciones. Varias apariciones de un elemento en una vista son válidas.
 * - `clone`: elementos y relaciones nuevos (copia de campos, mismo nombre, `templateId`
 *   conservado), y apariciones de esos clones.
 */
import { newId, type Command, type Element, type Relation, type Store, type ViewEdge, type ViewNode } from '@all-draw/core';

export const CLIP_MIME = 'application/x-all-draw';

export interface Clip {
  nodes: ViewNode[];
  edges: ViewEdge[];
  elements: Element[];
  relations: Relation[];
  /** Vista de origen (para decidir el desplazamiento al pegar). */
  viewId?: string;
}

export type PasteMode = 'appearance' | 'clone';

export interface PasteOptions {
  viewId: string;
  offset: { x: number; y: number };
  mode: PasteMode;
  /** La vista destino es una rejilla: se conserva `cell`; si no, se descarta. */
  isGrid?: boolean;
  /**
   * En una rejilla, dónde caen los nodos raíz que no traen celda (o cuya celda ya no existe):
   * la celda bajo el punto de pegado (o la primera) y la posición relativa dentro de ella.
   * Sin `gridTarget`, esos nodos no se pegan: en una rejilla nada queda fuera de una celda.
   */
  gridTarget?: {
    cell: { layerId: string; stageId: string };
    /** Posición del primer nodo dentro de la celda (por defecto 8,8). */
    origin?: { x: number; y: number };
    /** ¿Existe todavía la celda? Si no se da, se aceptan todas. */
    isValidCell?: (cell: { layerId: string; stageId: string }) => boolean;
    /** Tamaño de la celda destino: los nodos se acotan para no sobresalir de ella. */
    size?: { w: number; h: number };
  };
}

export interface PastePlan { commands: Command[]; newNodeIds: string[] }

/** Nodos seleccionados + descendientes anidados + aristas entre los nodos copiados (seleccionadas o no). */
export function copySelection(store: Store, nodeIds: string[], edgeIds: string[]): Clip {
  const wanted = new Set(nodeIds.filter(id => store.get('nodes', id)));
  const all = store.list('nodes');
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of all) if (n.parentNodeId && wanted.has(n.parentNodeId) && !wanted.has(n.id)) { wanted.add(n.id); grew = true; }
  }
  const nodes = all.filter(n => wanted.has(n.id)).map(n => structuredClone(n));
  const edgeSet = new Set(edgeIds);
  const edges = store.list('edges').filter(e => wanted.has(e.fromNodeId) && wanted.has(e.toNodeId) || (edgeSet.has(e.id) && wanted.has(e.fromNodeId) && wanted.has(e.toNodeId))).map(e => structuredClone(e));
  const elements = uniq(nodes.map(n => n.elementId).filter((id): id is string => !!id)).map(id => store.get('elements', id)).filter((e): e is Element => !!e).map(e => structuredClone(e));
  const relations = uniq(edges.map(e => e.relationId).filter((id): id is string => !!id)).map(id => store.get('relations', id)).filter((r): r is Relation => !!r).map(r => structuredClone(r));
  return { nodes, edges, elements, relations, viewId: nodes[0]?.viewId };
}

/** Plan de pegado: comandos primitivos (`set`) e ids de los nodos nuevos. Envuélvelo en un `batch`. */
export function pastePlan(clip: Clip, opts: PasteOptions): PastePlan {
  const commands: Command[] = [];
  const nodeMap = new Map<string, string>();
  for (const n of clip.nodes) nodeMap.set(n.id, newId('vn'));

  // Elementos y relaciones: en `clone` se crean nuevos y se remapean; en `appearance` se reutilizan.
  const elMap = new Map<string, string>();
  const relMap = new Map<string, string>();
  if (opts.mode === 'clone') {
    for (const e of clip.elements) {
      const id = newId('el');
      elMap.set(e.id, id);
      commands.push({ type: 'set', collection: 'elements', id, value: { ...structuredClone(e), id } });
    }
    for (const r of clip.relations) relMap.set(r.id, newId('rel'));
    for (const r of clip.relations) {
      const id = relMap.get(r.id)!;
      const end = (x: Relation['from']): Relation['from'] => ({
        ...x,
        elementId: x.elementId ? (elMap.get(x.elementId) ?? x.elementId) : undefined,
        relationId: x.relationId ? (relMap.get(x.relationId) ?? x.relationId) : undefined,
      });
      commands.push({ type: 'set', collection: 'relations', id, value: { ...structuredClone(r), id, from: end(r.from), to: end(r.to) } });
    }
  }

  // Nodos: padres antes que hijos; el desplazamiento solo a las raíces (los hijos son relativos al padre).
  const byId = new Map(clip.nodes.map(n => [n.id, n]));
  const ordered: ViewNode[] = [];
  const seen = new Set<string>();
  const visit = (n: ViewNode) => { if (seen.has(n.id)) return; if (n.parentNodeId && byId.has(n.parentNodeId)) visit(byId.get(n.parentNodeId)!); seen.add(n.id); ordered.push(n); };
  clip.nodes.forEach(visit);
  const newNodeIds: string[] = [];
  // Rejilla: los nodos raíz sin celda válida van a la celda destino, conservando su disposición relativa.
  const roots = ordered.filter(n => !(n.parentNodeId && byId.has(n.parentNodeId)));
  const ref = { x: Math.min(...roots.map(n => n.x)), y: Math.min(...roots.map(n => n.y)) };
  const validCell = (c: ViewNode['cell']) => !!c && (!opts.gridTarget?.isValidCell || opts.gridTarget.isValidCell(c));
  for (const n of ordered) {
    const parentInClip = !!n.parentNodeId && nodeMap.has(n.parentNodeId);
    if (!parentInClip && n.parentNodeId && byId.has(n.parentNodeId)) { nodeMap.delete(n.id); continue; } // su padre no se pegó
    let cell = opts.isGrid ? n.cell : undefined;
    let x = parentInClip ? n.x : n.x + opts.offset.x, y = parentInClip ? n.y : n.y + opts.offset.y;
    if (opts.isGrid && !parentInClip && !validCell(cell)) {
      const t = opts.gridTarget;
      if (!t) { nodeMap.delete(n.id); continue; } // en una rejilla nada queda fuera de una celda
      cell = t.cell;
      const o = t.origin ?? { x: 8, y: 8 };
      x = o.x + (n.x - ref.x) + opts.offset.x; y = o.y + (n.y - ref.y) + opts.offset.y;
      if (t.size) { x = Math.max(0, Math.min(x, t.size.w - n.w)); y = Math.max(0, Math.min(y, t.size.h - n.h)); }
    }
    const id = nodeMap.get(n.id)!;
    const value: ViewNode = {
      ...structuredClone(n),
      id,
      viewId: opts.viewId,
      elementId: n.elementId ? (opts.mode === 'clone' ? (elMap.get(n.elementId) ?? n.elementId) : n.elementId) : undefined,
      parentNodeId: parentInClip ? nodeMap.get(n.parentNodeId!) : undefined,
      x: Math.round(x), y: Math.round(y),
      cell,
      detailViewId: opts.mode === 'clone' ? undefined : n.detailViewId,
    };
    stripUndefined(value);
    commands.push({ type: 'set', collection: 'nodes', id, value });
    newNodeIds.push(id);
  }

  // Aristas entre los nodos nuevos.
  for (const e of clip.edges) {
    const from = nodeMap.get(e.fromNodeId), to = nodeMap.get(e.toNodeId);
    if (!from || !to) continue;
    const id = newId('ve');
    const value: ViewEdge = {
      ...structuredClone(e),
      id,
      viewId: opts.viewId,
      relationId: e.relationId ? (opts.mode === 'clone' ? (relMap.get(e.relationId) ?? e.relationId) : e.relationId) : undefined,
      fromNodeId: from,
      toNodeId: to,
      bendpoints: e.bendpoints.map(b => ({ x: b.x + opts.offset.x, y: b.y + opts.offset.y })),
    };
    stripUndefined(value);
    commands.push({ type: 'set', collection: 'edges', id, value });
  }
  return { commands, newNodeIds };
}

// ---------------------------------------------------------------- portapapeles
let memory: Clip | null = null;

/** Guarda en memoria y, si se puede, en el portapapeles del sistema (JSON marcado). Nunca lanza. */
export function setClipboard(clip: Clip): void {
  memory = clip;
  try {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    const text = JSON.stringify({ format: CLIP_MIME, ...clip });
    nav?.clipboard?.writeText?.(text)?.catch(() => { /* sin permiso: nos queda la memoria */ });
  } catch { /* entorno sin navigator */ }
}

/** Lee del portapapeles del sistema si contiene un clip marcado; si no, de la memoria del módulo. */
export async function readClipboard(): Promise<Clip | null> {
  try {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    const text = await nav?.clipboard?.readText?.();
    if (text) { const parsed = parseClip(text); if (parsed) return parsed; }
  } catch { /* sin permiso o sin navigator */ }
  return memory;
}

export function parseClip(text: string): Clip | null {
  try {
    const v = JSON.parse(text) as Partial<Clip> & { format?: string };
    if (!v || v.format !== CLIP_MIME || !Array.isArray(v.nodes)) return null;
    return { nodes: v.nodes, edges: v.edges ?? [], elements: v.elements ?? [], relations: v.relations ?? [], viewId: v.viewId };
  } catch { return null; }
}

/** Solo para tests. */
export function _resetClipboard(): void { memory = null; }

function uniq<T>(xs: T[]): T[] { return [...new Set(xs)]; }
function stripUndefined(o: Record<string, unknown>): void { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; }
