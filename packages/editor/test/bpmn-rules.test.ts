/** Al conectar en el lienzo: no hay flujo de secuencia entre pools distintas ni flujo de mensaje dentro de una. */
import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeNode, makeView, type Store } from '@all-draw/core';
import { BPMN_PACK } from '../../notations/bpmn/src';
import { bpmnConnectionAllowed, filterBpmnConnections, poolOfNode } from '../src/bpmn-rules';

function scene(): Store {
  const s = new MemoryStore();
  s.set('views', 'v', makeView('V', { id: 'v', notationId: 'bpmn' }));
  const add = (id: string, typeId: string, parent?: string) => {
    const el = makeElement(typeId, id, { id: `el_${id}` }); s.set('elements', el.id, el);
    s.set('nodes', id, makeNode('v', el.id, { x: 0, y: 0, w: 100, h: 60 }, { id, parentNodeId: parent }));
  };
  add('poolA', 'bpmn:Pool'); add('laneA', 'bpmn:Lane', 'poolA'); add('t1', 'bpmn:Task', 'laneA'); add('sub', 'bpmn:SubProcess', 'laneA'); add('t2', 'bpmn:Task', 'sub');
  add('poolB', 'bpmn:Pool'); add('t3', 'bpmn:Task', 'poolB');
  add('black', 'bpmn:Participant');
  add('free1', 'bpmn:Task'); add('free2', 'bpmn:Task');
  return s;
}

describe('reglas BPMN al conectar', () => {
  it('pool de un nodo: saltando lanes y subprocesos; la pool colapsada es su propia pool', () => {
    const s = scene();
    expect(poolOfNode(s, 't2')).toBe('el_poolA');
    expect(poolOfNode(s, 't3')).toBe('el_poolB');
    expect(poolOfNode(s, 'black')).toBe('el_black');
    expect(poolOfNode(s, 'free1')).toBeUndefined();
  });

  it('rechaza el flujo de secuencia entre pools distintas y lo acepta dentro de la misma (o sin pools)', () => {
    const s = scene();
    expect(bpmnConnectionAllowed(s, 't1', 't2', 'bpmn:SequenceFlow')).toBe(true);
    expect(bpmnConnectionAllowed(s, 't1', 't3', 'bpmn:SequenceFlow')).toBe(false);
    expect(bpmnConnectionAllowed(s, 't1', 'free1', 'bpmn:SequenceFlow')).toBe(false);
    expect(bpmnConnectionAllowed(s, 'free1', 'free2', 'bpmn:SequenceFlow')).toBe(true);
  });

  it('el flujo de mensaje va entre pools distintas, nunca dentro de una', () => {
    const s = scene();
    expect(bpmnConnectionAllowed(s, 't1', 't3', 'bpmn:MessageFlow')).toBe(true);
    expect(bpmnConnectionAllowed(s, 't1', 'black', 'bpmn:MessageFlow')).toBe(true);
    expect(bpmnConnectionAllowed(s, 't1', 't2', 'bpmn:MessageFlow')).toBe(false);
    expect(bpmnConnectionAllowed(s, 't1', 't3', 'bpmn:Association')).toBe(true);
  });

  it('con los tipos que propone la matriz del pack: entre pools solo queda el mensaje; dentro, no hay mensaje', () => {
    const s = scene();
    const reg = new NotationRegistry().register(CORE_PACK).register(BPMN_PACK);
    const allowed = reg.allowedRelations('bpmn:Task', 'bpmn:Task');
    expect(allowed).toContain('bpmn:SequenceFlow');
    expect(allowed).toContain('bpmn:MessageFlow');
    const across = filterBpmnConnections(s, 't1', 't3', allowed);
    expect(across).not.toContain('bpmn:SequenceFlow');
    expect(across).toContain('bpmn:MessageFlow');
    const within = filterBpmnConnections(s, 't1', 't2', allowed);
    expect(within).toContain('bpmn:SequenceFlow');
    expect(within).not.toContain('bpmn:MessageFlow');
    // Si solo cabía un flujo de secuencia (p. ej. desde un evento de inicio), entre pools no queda nada: isValidConnection rechaza
    expect(filterBpmnConnections(s, 't1', 't3', ['bpmn:SequenceFlow'])).toEqual([]);
    // Otras notaciones no se tocan
    expect(filterBpmnConnections(s, 't1', 't3', ['core:link'])).toEqual(['core:link']);
  });
});
