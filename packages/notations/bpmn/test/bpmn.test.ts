import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { BPMN_PACK, BPMN_FLOW_NODES } from '../src';

const SEQ = 'bpmn:SequenceFlow', MSG = 'bpmn:MessageFlow', ASSOC = 'bpmn:Association';
const DIN = 'bpmn:DataInputAssociation', DOUT = 'bpmn:DataOutputAssociation';
const reg = () => new NotationRegistry().register(BPMN_PACK);

describe('pack bpmn', () => {
  it('tiene 19 tipos de elemento, 5 de relación y 6 categorías, válidos según el esquema', () => {
    expect(BPMN_PACK.id).toBe('bpmn');
    expect(BPMN_PACK.elementTypes).toHaveLength(19);
    expect(BPMN_PACK.relationTypes).toHaveLength(5);
    expect(BPMN_PACK.categories.map(c => c.name)).toEqual(['Participantes', 'Actividades', 'Eventos', 'Compuertas', 'Datos', 'Artefactos']);
    for (const t of BPMN_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of BPMN_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    const cats = new Set(BPMN_PACK.categories.map(c => c.id));
    for (const t of BPMN_PACK.elementTypes) expect(cats.has(t.category!), t.id).toBe(true);
    expect(BPMN_PACK.defaultRelation).toBe(SEQ);
    expect(BPMN_FLOW_NODES).toHaveLength(13);
  });

  it('se registra y expone formas, contenedores y campos', () => {
    const r = reg();
    expect(r.pack('bpmn')).toBe(BPMN_PACK);
    expect(r.elementType('bpmn:Pool')).toMatchObject({ shape: 'pool', container: true });
    expect(r.elementType('bpmn:Lane')).toMatchObject({ shape: 'lane', container: true });
    expect(r.elementType('bpmn:SubProcess')).toMatchObject({ shape: 'rounded', container: true });
    expect(r.elementType('bpmn:DataStore')?.shape).toBe('cylinder');
    expect(r.elementType('bpmn:ComplexGateway')?.shape).toBe('diamond');
    expect(r.elementType('bpmn:TextAnnotation')?.shape).toBe('note');
    expect(r.fieldsOf('bpmn:Task').map(f => f.key)).toEqual(['taskType', 'loop']);
    expect(r.fieldsOf('bpmn:Task')[0]?.options).toBe('none,user,service,script,manual,businessRule,send,receive');
    expect(r.fieldsOf('bpmn:BoundaryEvent').map(f => f.key)).toEqual(['eventDefinition', 'interrupting', 'attachedTo']);
    expect(r.fieldsOf('bpmn:BoundaryEvent').find(f => f.key === 'attachedTo')?.kind).toBe('ref');
    expect(r.fieldsOf('bpmn:EndEvent')[0]?.options).toContain('terminate');
    expect(r.relationType(MSG)).toMatchObject({ line: 'dashed', sourceHead: 'circle', targetHead: 'open' });
    expect(r.relationType(ASSOC)).toMatchObject({ line: 'dotted', targetHead: 'none' });
    expect(r.relationType(SEQ)?.fields.map(f => f.key)).toEqual(['condition', 'default']);
  });

  it('SequenceFlow: solo entre nodos de flujo, EndEvent no origen, StartEvent no destino', () => {
    const r = reg();
    expect(r.allowedRelations('bpmn:StartEvent', 'bpmn:Task')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:ExclusiveGateway')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:ParallelGateway', 'bpmn:SubProcess')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:CallActivity', 'bpmn:EndEvent')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:BoundaryEvent', 'bpmn:Task')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:EventBasedGateway', 'bpmn:IntermediateCatchEvent')).toContain(SEQ);

    expect(r.allowedRelations('bpmn:EndEvent', 'bpmn:Task')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:StartEvent')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:BoundaryEvent')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:DataObject')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Pool', 'bpmn:Task')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:TextAnnotation')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Lane', 'bpmn:Lane')).toEqual([]);
  });

  it('MessageFlow: entre Task/eventos/Pool (pools distintas las valida el editor)', () => {
    const r = reg();
    expect(r.allowedRelations('bpmn:Pool', 'bpmn:Pool')).toEqual([MSG]);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:Pool')).toContain(MSG);
    expect(r.allowedRelations('bpmn:Pool', 'bpmn:StartEvent')).toContain(MSG);
    expect(r.allowedRelations('bpmn:EndEvent', 'bpmn:Task')).toContain(MSG);
    expect(r.allowedRelations('bpmn:IntermediateThrowEvent', 'bpmn:IntermediateCatchEvent')).toContain(MSG);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:Task')).toEqual(expect.arrayContaining([SEQ, MSG]));

    expect(r.allowedRelations('bpmn:ExclusiveGateway', 'bpmn:Pool')).not.toContain(MSG);
    expect(r.allowedRelations('bpmn:Pool', 'bpmn:EndEvent')).not.toContain(MSG);
    expect(r.allowedRelations('bpmn:DataObject', 'bpmn:Pool')).not.toContain(MSG);
    expect(BPMN_PACK.doc).toMatch(/misma pool/);
  });

  it('Association: cualquier cosa ↔ TextAnnotation/Group; Data*Association entre actividades y datos', () => {
    const r = reg();
    for (const t of BPMN_PACK.elementTypes) {
      expect(r.allowedRelations(t.id, 'bpmn:TextAnnotation'), t.id).toContain(ASSOC);
      expect(r.allowedRelations('bpmn:Group', t.id), t.id).toContain(ASSOC);
    }
    expect(r.allowedRelations('bpmn:Task', 'bpmn:Task')).not.toContain(ASSOC);

    expect(r.allowedRelations('bpmn:DataObject', 'bpmn:Task')).toEqual([DIN]);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:DataStore')).toEqual([DOUT]);
    expect(r.allowedRelations('bpmn:DataStore', 'bpmn:SubProcess')).toContain(DIN);
    expect(r.allowedRelations('bpmn:ExclusiveGateway', 'bpmn:DataObject')).toEqual([]);
    expect(r.allowedRelations('bpmn:DataObject', 'bpmn:DataStore')).toEqual([]);
  });

  it('con CORE_PACK los puentes se suman sin romper la matriz', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(BPMN_PACK);
    const rels = r.allowedRelations('bpmn:EndEvent', 'bpmn:Task');
    expect(rels).not.toContain(SEQ);
    expect(rels).toContain('core:trace');
  });

  it('anidamiento: Pool ⊃ Lane y nodos de flujo; Lane ⊃ Lane; SubProcess ⊃ nodos; Group ⊃ todo', () => {
    const r = reg();
    const has = (p: string, c: string) => BPMN_PACK.nesting!.some(n => n.parent === p && (n.child === c || n.child === '*'));
    expect(has('Pool', 'Lane')).toBe(true);
    expect(has('Lane', 'Lane')).toBe(true);
    expect(has('SubProcess', 'Lane')).toBe(false);
    expect(has('SubProcess', 'Pool')).toBe(false);
    expect(has('Lane', 'Pool')).toBe(false);
    for (const n of BPMN_FLOW_NODES) for (const p of ['Pool', 'Lane', 'SubProcess']) expect(has(p, n), `${p} ⊃ ${n}`).toBe(true);
    expect(has('Group', 'Pool')).toBe(true);
    for (const n of BPMN_PACK.nesting!) expect(n.relationTypes).toEqual([]);
    expect(r.nestingRelations('bpmn:Pool', 'bpmn:Task')).toEqual([]);
    expect(r.nestingRelations('bpmn:Group', 'bpmn:Pool')).toEqual([]);
  });

  it('viewpoints: Colaboración todo, Proceso sin Pool/Lane/MessageFlow', () => {
    const r = reg();
    expect(BPMN_PACK.viewpoints.map(v => v.name)).toEqual(['Colaboración', 'Proceso']);
    expect(r.inViewpoint('bpmn', 'collaboration', 'bpmn:Pool')).toBe(true);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Pool')).toBe(false);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Lane')).toBe(false);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Task')).toBe(true);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:DataStore')).toBe(true);
    const process = BPMN_PACK.viewpoints.find(v => v.id === 'process')!;
    expect(process.elementTypes).toHaveLength(17);
    expect(process.relationTypes).not.toContain(MSG);
    expect(process.relationTypes).toContain(SEQ);
  });
});
