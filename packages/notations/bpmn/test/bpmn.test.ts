import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { BPMN_PACK, BPMN_FLOW_NODES, BPMN_SUBPROCESSES, BPMN_CHOREOGRAPHY_ACTIVITIES, BPMN_EVENT_DEFINITIONS } from '../src';

const SEQ = 'bpmn:SequenceFlow', MSG = 'bpmn:MessageFlow', ASSOC = 'bpmn:Association';
const DIN = 'bpmn:DataInputAssociation', DOUT = 'bpmn:DataOutputAssociation';
const reg = () => new NotationRegistry().register(BPMN_PACK);

describe('pack bpmn', () => {
  it('tiene ≥ 35 tipos de elemento, 6 de relación y 9 categorías, válidos según el esquema', () => {
    expect(BPMN_PACK.id).toBe('bpmn');
    expect(BPMN_PACK.elementTypes.length).toBeGreaterThanOrEqual(35);
    expect(new Set(BPMN_PACK.elementTypes.map(t => t.id)).size).toBe(BPMN_PACK.elementTypes.length);
    expect(BPMN_PACK.relationTypes).toHaveLength(6);
    expect(BPMN_PACK.categories.map(c => c.name)).toEqual(['Participantes', 'Actividades', 'Eventos', 'Compuertas', 'Datos', 'Artefactos', 'Coreografía', 'Conversaciones', 'Definiciones']);
    for (const t of BPMN_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of BPMN_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    const cats = new Set(BPMN_PACK.categories.map(c => c.id));
    for (const t of BPMN_PACK.elementTypes) expect(cats.has(t.category!), t.id).toBe(true);
    expect(BPMN_PACK.defaultRelation).toBe(SEQ);
    expect(BPMN_FLOW_NODES).toHaveLength(19);
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
    expect(r.fieldsOf('bpmn:Task').map(f => f.key)).toEqual(['taskType', 'loop', 'isForCompensation', 'instantiate']);
    expect(r.fieldsOf('bpmn:Task')[0]?.options).toBe('none,user,service,script,manual,businessRule,send,receive');
    expect(r.fieldsOf('bpmn:BoundaryEvent').map(f => f.key).slice(0, 3)).toEqual(['eventDefinition', 'interrupting', 'attachedTo']);
    expect(r.fieldsOf('bpmn:BoundaryEvent').find(f => f.key === 'attachedTo')?.kind).toBe('ref');
    expect(r.fieldsOf('bpmn:EndEvent')[0]?.options).toContain('terminate');
    expect(r.relationType(MSG)).toMatchObject({ line: 'dashed', sourceHead: 'circle', targetHead: 'open' });
    expect(r.relationType(ASSOC)).toMatchObject({ line: 'dotted', targetHead: 'none' });
    expect(r.relationType(SEQ)?.fields.map(f => f.key)).toEqual(['condition', 'default', 'immediate']);
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
    // DataInput solo es origen, DataOutput solo destino; los eventos también leen/escriben datos.
    expect(r.allowedRelations('bpmn:DataInput', 'bpmn:Transaction')).toEqual([DIN]);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:DataInput')).toEqual([]);
    expect(r.allowedRelations('bpmn:AdHocSubProcess', 'bpmn:DataOutput')).toEqual([DOUT]);
    expect(r.allowedRelations('bpmn:DataOutput', 'bpmn:Task')).toEqual([]);
    expect(r.allowedRelations('bpmn:DataObject', 'bpmn:IntermediateThrowEvent')).toEqual([DIN]);
    expect(r.allowedRelations('bpmn:IntermediateCatchEvent', 'bpmn:DataObject')).toEqual([DOUT]);
    expect(r.allowedRelations('bpmn:DataObject', 'bpmn:StartEvent')).toEqual([]);
  });

  it('con CORE_PACK los puentes se suman sin romper la matriz', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(BPMN_PACK);
    const rels = r.allowedRelations('bpmn:EndEvent', 'bpmn:Task');
    expect(rels).not.toContain(SEQ);
    expect(rels).toContain('core:trace');
  });

  it('anidamiento: Pool ⊃ Lane y nodos de flujo; Lane ⊃ Lane; subprocesos ⊃ nodos; Group ⊃ todo', () => {
    const r = reg();
    const has = (p: string, c: string) => BPMN_PACK.nesting!.some(n => n.parent === p && (n.child === c || n.child === '*'));
    expect(has('Pool', 'Lane')).toBe(true);
    expect(has('Lane', 'Lane')).toBe(true);
    expect(has('SubProcess', 'Lane')).toBe(false);
    expect(has('SubProcess', 'Pool')).toBe(false);
    expect(has('Lane', 'Pool')).toBe(false);
    const process = BPMN_FLOW_NODES.filter(n => !BPMN_CHOREOGRAPHY_ACTIVITIES.includes(n));
    for (const n of process) for (const p of ['Pool', 'Lane', ...BPMN_SUBPROCESSES]) expect(has(p, n), `${p} ⊃ ${n}`).toBe(true);
    expect(has('Transaction', 'EventSubProcess')).toBe(true);
    expect(has('Pool', 'ChoreographyTask')).toBe(false);
    expect(has('SubChoreography', 'ChoreographyTask')).toBe(true);
    expect(has('SubChoreography', 'ExclusiveGateway')).toBe(true);
    expect(has('SubChoreography', 'Task')).toBe(false);
    expect(has('SubConversation', 'Conversation')).toBe(true);
    expect(has('SubConversation', 'Participant')).toBe(true);
    expect(has('Group', 'Pool')).toBe(true);
    for (const n of BPMN_PACK.nesting!) expect(n.relationTypes).toEqual([]);
    expect(r.nestingRelations('bpmn:Pool', 'bpmn:Task')).toEqual([]);
    expect(r.nestingRelations('bpmn:Group', 'bpmn:Pool')).toEqual([]);
  });

  it('viewpoints: Colaboración todo, Proceso sin Pool/Lane/MessageFlow, Coreografía aparte', () => {
    const r = reg();
    expect(BPMN_PACK.viewpoints.map(v => v.name)).toEqual(['Colaboración', 'Proceso', 'Coreografía']);
    expect(r.inViewpoint('bpmn', 'collaboration', 'bpmn:Pool')).toBe(true);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Pool')).toBe(false);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Lane')).toBe(false);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:Task')).toBe(true);
    expect(r.inViewpoint('bpmn', 'process', 'bpmn:DataStore')).toBe(true);
    const process = BPMN_PACK.viewpoints.find(v => v.id === 'process')!;
    expect(process.elementTypes).toHaveLength(BPMN_PACK.elementTypes.length - 9);
    expect(process.elementTypes).not.toContain('bpmn:Participant');
    expect(process.elementTypes).not.toContain('bpmn:ChoreographyTask');
    expect(process.elementTypes).toContain('bpmn:Transaction');
    expect(process.relationTypes).not.toContain(MSG);
    expect(process.relationTypes).not.toContain('bpmn:ConversationLink');
    expect(process.relationTypes).toContain(SEQ);
    expect(r.inViewpoint('bpmn', 'choreography', 'bpmn:ChoreographyTask')).toBe(true);
    expect(r.inViewpoint('bpmn', 'choreography', 'bpmn:Participant')).toBe(true);
    expect(r.inViewpoint('bpmn', 'choreography', 'bpmn:ExclusiveGateway')).toBe(true);
    expect(r.inViewpoint('bpmn', 'choreography', 'bpmn:Task')).toBe(false);
    expect(r.inViewpoint('bpmn', 'choreography', 'bpmn:Pool')).toBe(false);
  });

  it('cubre los modelables de bpmn-js: subprocesos, pool colapsada, datos, coreografía, conversación, definiciones', () => {
    const r = reg();
    for (const id of ['Transaction', 'AdHocSubProcess', 'EventSubProcess', 'Participant', 'DataInput', 'DataOutput', 'Message', 'ChoreographyTask', 'SubChoreography', 'CallChoreography', 'Conversation', 'SubConversation', 'CallConversation', 'Signal', 'Error', 'Escalation', 'Process'])
      expect(r.elementType(`bpmn:${id}`), id).toBeDefined();
    expect(r.elementType('bpmn:Transaction')).toMatchObject({ container: true });
    expect(r.elementType('bpmn:AdHocSubProcess')).toMatchObject({ container: true });
    expect(r.elementType('bpmn:EventSubProcess')).toMatchObject({ container: true });
    expect(r.elementType('bpmn:Participant')?.container).toBeFalsy();
    expect(r.fieldsOf('bpmn:Participant').map(f => f.key)).toEqual(['collapsed', 'multiplicity']);
    expect(r.fieldsOf('bpmn:Transaction').map(f => f.key)).toEqual(['collapsed', 'loop', 'isForCompensation', 'method']);
    expect(r.fieldsOf('bpmn:AdHocSubProcess').map(f => f.key)).toContain('ordering');
    expect(r.fieldsOf('bpmn:CallActivity').map(f => f.key)).toContain('isForCompensation');
    expect(r.fieldsOf('bpmn:ChoreographyTask').map(f => f.key)).toContain('initiatingParticipant');
    expect(r.relationType('bpmn:ConversationLink')).toBeDefined();
    expect(r.relationType(ASSOC)?.fields.map(f => f.key)).toEqual(['direction']);
  });

  it('eventos: definiciones por clase según el replace menu de bpmn-js', () => {
    const opts = (t: string) => reg().fieldsOf(`bpmn:${t}`)[0]!.options!.split(',');
    expect(opts('StartEvent')).toEqual(BPMN_EVENT_DEFINITIONS.StartEvent.split(','));
    expect(opts('StartEvent')).toEqual(expect.arrayContaining(['none', 'message', 'timer', 'signal', 'conditional', 'error', 'escalation', 'compensation', 'multiple', 'parallelMultiple']));
    expect(opts('EndEvent')).toEqual(expect.arrayContaining(['cancel', 'terminate', 'compensation', 'multiple']));
    expect(opts('EndEvent')).not.toContain('timer');
    expect(opts('IntermediateCatchEvent')).toEqual(expect.arrayContaining(['link', 'conditional', 'parallelMultiple']));
    expect(opts('IntermediateCatchEvent')).not.toContain('none');
    expect(opts('IntermediateThrowEvent')).toEqual(expect.arrayContaining(['none', 'compensation', 'escalation', 'link']));
    expect(opts('IntermediateThrowEvent')).not.toContain('timer');
    expect(opts('BoundaryEvent')).toEqual(expect.arrayContaining(['cancel', 'compensation', 'error', 'multiple', 'parallelMultiple']));
    expect(opts('BoundaryEvent')).not.toContain('terminate');
    expect(reg().fieldsOf('bpmn:StartEvent').map(f => f.key)).toContain('interrupting');
  });

  it('matriz: eventos de borde, compensación, MessageFlow con Participant, coreografía y conversación', () => {
    const r = reg();
    // Borde: origen de secuencia, nunca destino; destino de mensaje.
    expect(r.allowedRelations('bpmn:BoundaryEvent', 'bpmn:EndEvent')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:SubProcess', 'bpmn:BoundaryEvent')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:BoundaryEvent')).toContain(MSG);
    // Compensación: Association dirigida del borde a la actividad compensadora.
    expect(r.allowedRelations('bpmn:BoundaryEvent', 'bpmn:Task')).toContain(ASSOC);
    expect(r.allowedRelations('bpmn:BoundaryEvent', 'bpmn:CallActivity')).toContain(ASSOC);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:BoundaryEvent')).not.toContain(ASSOC);
    expect(r.allowedRelations('bpmn:BoundaryEvent', 'bpmn:ExclusiveGateway')).not.toContain(ASSOC);
    // Subproceso de evento: sin flujos de secuencia; sí contiene.
    expect(r.allowedRelations('bpmn:Task', 'bpmn:EventSubProcess')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:EventSubProcess', 'bpmn:Task')).not.toContain(SEQ);
    expect(r.allowedRelations('bpmn:Transaction', 'bpmn:AdHocSubProcess')).toContain(SEQ);
    // MessageFlow con Participant (pool colapsada) en ambos sentidos y con Pool.
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:Pool')).toEqual(expect.arrayContaining([MSG]));
    expect(r.allowedRelations('bpmn:Task', 'bpmn:Participant')).toContain(MSG);
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:StartEvent')).toContain(MSG);
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:EndEvent')).not.toContain(MSG);
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:Task')).not.toContain(SEQ);
    // Coreografía: flujo de secuencia entre tareas de coreografía, eventos y compuertas.
    expect(r.allowedRelations('bpmn:StartEvent', 'bpmn:ChoreographyTask')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:ChoreographyTask', 'bpmn:ExclusiveGateway')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:SubChoreography', 'bpmn:CallChoreography')).toContain(SEQ);
    expect(r.allowedRelations('bpmn:ChoreographyTask', 'bpmn:Pool')).not.toContain(MSG);
    expect(r.allowedRelations('bpmn:Message', 'bpmn:ChoreographyTask')).toContain(ASSOC);
    // Conversación: enlace participante ↔ conversación, nada más.
    expect(r.allowedRelations('bpmn:Participant', 'bpmn:Conversation')).toEqual(['bpmn:ConversationLink']);
    expect(r.allowedRelations('bpmn:SubConversation', 'bpmn:Pool')).toEqual(['bpmn:ConversationLink']);
    expect(r.allowedRelations('bpmn:Task', 'bpmn:Conversation')).toEqual([]);
    expect(r.allowedRelations('bpmn:Conversation', 'bpmn:CallConversation')).toEqual([]);
    // Definiciones no se conectan con flujo alguno.
    expect(r.allowedRelations('bpmn:Signal', 'bpmn:Task')).toEqual([]);
    expect(r.allowedRelations('bpmn:Error', 'bpmn:TextAnnotation')).toEqual([ASSOC]);
  });
});
