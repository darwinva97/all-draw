import { describe, it, expect } from 'vitest';
import {
  MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, execute,
  suggestTraces, traceMatrix, traceGaps, traceCoverage, relationFromSuggestion, normalizeName, significantWords, TYPE_AFFINITIES,
  type NotationPack, type Element,
} from '../src';

/** Packs mínimos con los ids reales de los packs de notación (sin depender de sus paquetes). */
const pack = (id: string, types: string[]): NotationPack => ({
  id, name: id, categories: [], portTypes: [], viewpoints: [],
  elementTypes: types.map(t => ({ id: `${id}:${t}`, name: t, fields: [] })),
  relationTypes: [],
});
const ARCHIMATE = pack('archimate', ['BusinessProcess', 'BusinessActor', 'BusinessObject', 'ApplicationComponent', 'DataObject']);
const BPMN = pack('bpmn', ['Task', 'Pool', 'DataObject']);
const C4 = pack('c4', ['SoftwareSystem', 'Person']);
const UML = pack('uml', ['Class']);
const ER = pack('er', ['Entity']);
const FREEFORM = pack('freeform', ['box']);

const reg = () => new NotationRegistry().register(CORE_PACK).register(ARCHIMATE).register(BPMN).register(C4).register(UML).register(ER).register(FREEFORM);

/** Workspace sintético: un proceso "Alta de cliente" en ArchiMate y en BPMN, más ruido. */
function workspace() {
  const store = new MemoryStore();
  const put = (e: Element) => { store.set('elements', e.id, e); return e; };
  const archiProcess = put(makeElement('archimate:BusinessProcess', 'Alta de cliente', { id: 'am_alta' }));
  const bpmnTask = put(makeElement('bpmn:Task', 'Alta de Cliente', { id: 'bp_alta' }));
  const bpmnVerify = put(makeElement('bpmn:Task', 'Verificar identidad del cliente', { id: 'bp_verif' }));
  const archiActor = put(makeElement('archimate:BusinessActor', 'Comercial', { id: 'am_comercial' }));
  const bpmnPool = put(makeElement('bpmn:Pool', 'Departamento comercial', { id: 'bp_pool' }));
  const archiCheck = put(makeElement('archimate:BusinessProcess', 'Verificar identidad', { id: 'am_verif' }));
  const c4System = put(makeElement('c4:SoftwareSystem', 'CRM', { id: 'c4_crm' }));
  const archiApp = put(makeElement('archimate:ApplicationComponent', 'CRM', { id: 'am_crm' }));
  const umlClass = put(makeElement('uml:Class', 'Cliente', { id: 'uml_cliente' }));
  const erEntity = put(makeElement('er:Entity', 'cliente', { id: 'er_cliente' }));
  const box = put(makeElement('freeform:box', 'Alta de cliente', { id: 'ff_box' }));
  const tpl = put(makeElement('bpmn:Task', 'Alta de cliente', { id: 'bp_tpl', template: true }));

  // Vista BPMN de detalle del proceso ArchiMate: contiene la tarea de verificación.
  const detail = makeView('Alta de cliente (BPMN)', { id: 'vw_detail', notationId: 'bpmn', rootElementId: archiProcess.id });
  store.set('views', detail.id, detail);
  const n = makeNode(detail.id, bpmnVerify.id, { x: 0, y: 0 }, { id: 'vn_verif' });
  store.set('nodes', n.id, n);

  return { store, archiProcess, bpmnTask, bpmnVerify, archiActor, bpmnPool, archiCheck, c4System, archiApp, umlClass, erEntity, box, tpl };
}

describe('nombres', () => {
  it('normaliza acentos, mayúsculas y signos', () => {
    expect(normalizeName('  Alta de Cliente!  ')).toBe('alta de cliente');
    expect(normalizeName('Verificación')).toBe('verificacion');
    expect([...significantWords('Verificar identidad del cliente')]).toEqual(['verificar', 'identidad', 'cliente']);
  });
  it('la tabla de afinidades cubre las parejas del enunciado', () => {
    const has = (a: string, b: string) => TYPE_AFFINITIES.some(t => t.a === a && t.b === b);
    expect(has('bpmn:Task', 'archimate:BusinessProcess')).toBe(true);
    expect(has('bpmn:Task', 'archimate:ApplicationService')).toBe(true);
    expect(has('bpmn:Pool', 'archimate:BusinessActor')).toBe(true);
    expect(has('bpmn:Lane', 'archimate:BusinessRole')).toBe(true);
    expect(has('bpmn:DataObject', 'archimate:DataObject')).toBe(true);
    expect(has('c4:SoftwareSystem', 'archimate:ApplicationComponent')).toBe(true);
    expect(has('c4:Container', 'archimate:ApplicationComponent')).toBe(true);
    expect(has('c4:Person', 'archimate:BusinessActor')).toBe(true);
    expect(has('statechart:State', 'archimate:BusinessObject')).toBe(true);
    expect(has('uml:Class', 'er:Entity')).toBe(true);
    expect(has('uml:Class', 'archimate:DataObject')).toBe(true);
    expect(has('er:Entity', 'archimate:DataObject')).toBe(true);
  });
});

describe('suggestTraces', () => {
  it('mismo nombre normalizado → score 1, con afinidad de tipos → realizes', () => {
    const { store, archiProcess, bpmnTask } = workspace();
    const s = suggestTraces(store, reg(), bpmnTask.id);
    expect(s[0]?.target.id).toBe(archiProcess.id);
    expect(s[0]?.score).toBe(1);
    expect(s[0]?.relationTypeId).toBe('core:realizes');
    expect(s[0]?.direction).toBe('out');
    expect(s[0]?.reason).toContain('mismo nombre');
    // Desde el lado ArchiMate la misma pareja sale con dirección invertida.
    const back = suggestTraces(store, reg(), archiProcess.id).find(x => x.target.id === bpmnTask.id);
    expect(back).toMatchObject({ score: 1, relationTypeId: 'core:realizes', direction: 'in' });
    const rel = relationFromSuggestion(archiProcess.id, back!);
    expect(rel.from.elementId).toBe(bpmnTask.id);
    expect(rel.to.elementId).toBe(archiProcess.id);
  });

  it('ignora la misma notación, las plantillas y las parejas ya trazadas', () => {
    const { store, archiProcess, bpmnTask, bpmnVerify, tpl } = workspace();
    const ids = (id: string) => suggestTraces(store, reg(), id).map(x => x.target.id);
    expect(ids(bpmnTask.id)).not.toContain(bpmnVerify.id);
    expect(ids(archiProcess.id)).not.toContain(tpl.id);
    const r = makeRelation('core:trace', { elementId: bpmnTask.id }, { elementId: archiProcess.id });
    store.set('relations', r.id, r);
    expect(ids(bpmnTask.id)).not.toContain(archiProcess.id);
    expect(ids(archiProcess.id)).not.toContain(bpmnTask.id);
  });

  it('un elemento de la vista de detalle refina la raíz (score .8) y las palabras compartidas dan .5', () => {
    const { store, archiProcess, bpmnVerify, archiCheck } = workspace();
    const s = suggestTraces(store, reg(), bpmnVerify.id);
    const root = s.find(x => x.target.id === archiProcess.id)!;
    expect(root.score).toBeCloseTo(0.9); // .8 + .1 por afinidad Task↔BusinessProcess
    expect(root.relationTypeId).toBe('core:refines');
    expect(root.reason).toContain('aparece en el detalle de');
    const words = s.find(x => x.target.id === archiCheck.id)!;
    expect(words.score).toBeCloseTo(0.6); // .5 + .1 por afinidad
    expect(words.reason).toContain('verificar');
    expect(s.map(x => x.target.id).indexOf(archiProcess.id)).toBeLessThan(s.map(x => x.target.id).indexOf(archiCheck.id));
    // Desde la raíz, el elemento del detalle sale con dirección `in`.
    const fromRoot = suggestTraces(store, reg(), archiProcess.id).find(x => x.target.id === bpmnVerify.id)!;
    expect(fromRoot).toMatchObject({ relationTypeId: 'core:refines', direction: 'in' });
  });

  it('afinidad de tipos sola → .3; nombre igual entre notaciones sin afinidad → trace', () => {
    const { store, bpmnPool, archiActor, c4System, archiApp, umlClass, erEntity } = workspace();
    const pool = suggestTraces(store, reg(), bpmnPool.id).find(x => x.target.id === archiActor.id)!;
    expect(pool).toMatchObject({ score: 0.3, relationTypeId: 'core:trace' });
    const crm = suggestTraces(store, reg(), c4System.id).find(x => x.target.id === archiApp.id)!;
    expect(crm).toMatchObject({ score: 1, relationTypeId: 'core:realizes' });
    const cls = suggestTraces(store, reg(), umlClass.id).find(x => x.target.id === erEntity.id)!;
    expect(cls).toMatchObject({ score: 1, relationTypeId: 'core:trace' });
  });

  it('elemento inexistente → []', () => {
    expect(suggestTraces(workspace().store, reg(), 'nope')).toEqual([]);
  });
});

describe('traceMatrix', () => {
  it('cruza BPMN con ArchiMate con relaciones existentes y sugerencias', () => {
    const { store, archiProcess, bpmnTask, bpmnPool, archiActor } = workspace();
    const r = makeRelation('core:trace', { elementId: bpmnPool.id }, { elementId: archiActor.id });
    store.set('relations', r.id, r);
    const m = traceMatrix(store, reg(), 'bpmn', 'archimate');
    expect(m.rows.map(e => e.id)).toEqual(['bp_alta', 'bp_pool', 'bp_verif']);
    expect(m.cols.map(e => e.id)).toEqual(['am_alta', 'am_comercial', 'am_crm', 'am_verif']);
    expect(m.cells).toHaveLength(3);
    expect(m.cells[0]).toHaveLength(4);
    const cell = (row: string, col: string) => m.cells[m.rows.findIndex(e => e.id === row)]![m.cols.findIndex(e => e.id === col)]!;
    expect(cell(bpmnTask.id, archiProcess.id).relations).toEqual([]);
    expect(cell(bpmnTask.id, archiProcess.id).suggested).toBe(1);
    expect(cell(bpmnPool.id, archiActor.id).relations.map(x => x.id)).toEqual([r.id]);
    expect(cell(bpmnPool.id, archiActor.id).suggested).toBe(0);
    expect(cell(bpmnPool.id, 'am_crm').suggested).toBe(0);
    // Las plantillas no entran.
    expect(m.rows.some(e => e.template)).toBe(false);
  });
});

describe('traceGaps y traceCoverage', () => {
  it('lista los elementos sin traza cruzada; freeform no cuenta', () => {
    const { store, bpmnTask, archiProcess, box } = workspace();
    let gaps = traceGaps(store, reg());
    expect(gaps.map(g => g.element.id)).not.toContain(box.id);
    expect(gaps.map(g => g.element.id)).toContain(bpmnTask.id);
    expect(gaps.find(g => g.element.id === bpmnTask.id)?.suggestions[0]?.target.id).toBe(archiProcess.id);
    const r = makeRelation('core:realizes', { elementId: bpmnTask.id }, { elementId: archiProcess.id });
    store.set('relations', r.id, r);
    gaps = traceGaps(store, reg());
    expect(gaps.map(g => g.element.id)).not.toContain(bpmnTask.id);
    expect(gaps.map(g => g.element.id)).not.toContain(archiProcess.id);
    // Una traza dentro de la misma notación no cuenta.
    const same = makeRelation('core:trace', { elementId: 'bp_verif' }, { elementId: 'bp_pool' });
    store.set('relations', same.id, same);
    expect(traceGaps(store, reg()).map(g => g.element.id)).toContain('bp_verif');
  });

  it('con una sola notación no hay huecos', () => {
    const store = new MemoryStore();
    const e = makeElement('bpmn:Task', 'Solo');
    store.set('elements', e.id, e);
    expect(traceGaps(store, reg())).toEqual([]);
    expect(traceCoverage.run({ store, reg: reg() })).toEqual([]);
  });

  it('el validador emite info trace-missing con un arreglo aplicable', () => {
    const { store, bpmnTask, archiProcess } = workspace();
    const diags = traceCoverage.run({ store, reg: reg() });
    expect(diags.every(d => d.code === 'trace-missing' && d.severity === 'info' && d.subject.collection === 'elements')).toBe(true);
    const d = diags.find(x => x.subject.id === bpmnTask.id)!;
    expect(d.message).toContain('Alta de Cliente');
    expect(d.supportedFixes).toHaveLength(1);
    execute(store, d.supportedFixes[0]!.command);
    const rel = store.list('relations').find(x => x.from.elementId === bpmnTask.id && x.to.elementId === archiProcess.id);
    expect(rel?.typeId).toBe('core:realizes');
    expect(traceCoverage.run({ store, reg: reg() }).some(x => x.subject.id === bpmnTask.id)).toBe(false);
  });
});
