/**
 * Reglas de BPMN al conectar en el lienzo (las que la matriz de validez no expresa), con la estructura de la vista:
 * un **flujo de secuencia** no sale de su pool y un **flujo de mensaje** no se queda dentro de una. El panel de problemas
 * las comprueba en todo el modelo con `bpmn-pool-rules` (`packages/io/src/bpmnlint.ts`).
 */
import type { Store } from '@all-draw/core';

export const BPMN_SEQUENCE_FLOW = 'bpmn:SequenceFlow';
export const BPMN_MESSAGE_FLOW = 'bpmn:MessageFlow';
const PARTICIPANTS = new Set(['bpmn:Pool', 'bpmn:Participant']);

/**
 * Pool del nodo de una vista: el propio nodo si es una pool (o pool colapsada), o el antepasado más cercano que lo sea
 * (saltando lanes, subprocesos y grupos). `undefined` si no está dentro de ninguna.
 */
export function poolOfNode(store: Store, nodeId: string): string | undefined {
  let cur = store.get('nodes', nodeId), guard = 0;
  while (cur && guard++ < 50) {
    const el = cur.elementId ? store.get('elements', cur.elementId) : undefined;
    if (el && PARTICIPANTS.has(el.typeId)) return el.id;
    cur = cur.parentNodeId ? store.get('nodes', cur.parentNodeId) : undefined;
  }
  return undefined;
}

/** ¿Se puede crear una relación de tipo `relationTypeId` entre esos dos nodos según las reglas de pools? */
export function bpmnConnectionAllowed(store: Store, sourceNodeId: string, targetNodeId: string, relationTypeId: string): boolean {
  if (relationTypeId !== BPMN_SEQUENCE_FLOW && relationTypeId !== BPMN_MESSAGE_FLOW) return true;
  const a = poolOfNode(store, sourceNodeId), b = poolOfNode(store, targetNodeId);
  if (relationTypeId === BPMN_SEQUENCE_FLOW) return a === b;
  return !(a && a === b);
}

/** Filtra los tipos de relación propuestos al conectar: quita el flujo de secuencia entre pools y el de mensaje dentro de una. */
export function filterBpmnConnections(store: Store, sourceNodeId: string, targetNodeId: string, relationTypeIds: string[]): string[] {
  if (!relationTypeIds.some(r => r === BPMN_SEQUENCE_FLOW || r === BPMN_MESSAGE_FLOW)) return relationTypeIds;
  return relationTypeIds.filter(r => bpmnConnectionAllowed(store, sourceNodeId, targetNodeId, r));
}
