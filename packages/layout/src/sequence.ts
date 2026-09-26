/**
 * Layout de vistas de secuencia (`View.kind === 'sequence'`): sin ELK. Ordena las líneas de vida
 * por su `x` y las reparte en columnas de 200 px con `y = 0`; los mensajes (aristas entre líneas
 * de vida o sus activaciones) se apilan de 40 en 40 px por `Relation.fields.order` (y, a igualdad,
 * por orden de creación) escribiendo `bendpoints: [{ x: 0, y }]`; las activaciones se centran en su
 * línea de vida. Copia mínima de la geometría de `@all-draw/editor/views/sequence` (el editor no
 * puede ser dependencia de este paquete).
 */
import type { Command, Store, ViewNode } from '@all-draw/core';

const LIFELINE = 'sequence:Lifeline';
const ACTIVATION = 'sequence:Activation';
export const SEQ_LAYOUT = { headerH: 60, gapY: 40, gapX: 200, left: 40, activationW: 12 } as const;

const typeOf = (store: Store, n: ViewNode | undefined) => (n?.elementId ? store.get('elements', n.elementId)?.typeId : undefined);

function lifelineOf(store: Store, nodeId: string): ViewNode | undefined {
  let n = store.get('nodes', nodeId);
  for (let i = 0; n && i < 16; i++) { if (typeOf(store, n) === LIFELINE) return n; n = n.parentNodeId ? store.get('nodes', n.parentNodeId) : undefined; }
  return undefined;
}

function orderOf(store: Store, relationId: string | undefined): number | undefined {
  const o = relationId ? store.get('relations', relationId)?.fields['order'] : undefined;
  const n = typeof o === 'number' ? o : typeof o === 'string' && o.trim() !== '' ? Number(o) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function sequenceLayoutCommand(store: Store, viewId: string): Command {
  const commands: Command[] = [];
  const nodes = store.list('nodes').filter(n => n.viewId === viewId);
  const lines = nodes.filter(n => typeOf(store, n) === LIFELINE).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const moves: Extract<Command, { type: 'moveNodes' }>['moves'] = [];
  lines.forEach((l, i) => { const x = SEQ_LAYOUT.left + i * SEQ_LAYOUT.gapX; if (x !== l.x || l.y !== 0) moves.push({ id: l.id, x, y: 0 }); });
  for (const n of nodes) {
    if (typeOf(store, n) !== ACTIVATION) continue;
    const p = n.parentNodeId ? store.get('nodes', n.parentNodeId) : undefined;
    if (!p || typeOf(store, p) !== LIFELINE) continue;
    const x = Math.round((p.w - SEQ_LAYOUT.activationW) / 2);
    if (x !== n.x) moves.push({ id: n.id, x, y: n.y });
  }
  if (moves.length) commands.push({ type: 'moveNodes', moves });

  const msgs = store.list('edges')
    .map((e, i) => ({ e, i, order: orderOf(store, e.relationId) }))
    .filter(m => m.e.viewId === viewId && lifelineOf(store, m.e.fromNodeId) && lifelineOf(store, m.e.toNodeId))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.i - b.i);
  msgs.forEach((m, i) => {
    const y = SEQ_LAYOUT.headerH + SEQ_LAYOUT.gapY * (i + 1);
    if (m.e.bendpoints.length !== 1 || m.e.bendpoints[0]!.x !== 0 || m.e.bendpoints[0]!.y !== y) commands.push({ type: 'patch', collection: 'edges', id: m.e.id, patch: { bendpoints: [{ x: 0, y }] } });
  });
  return { type: 'batch', label: 'layout', commands };
}
