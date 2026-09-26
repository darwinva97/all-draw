import { describe, it, expect } from 'vitest';
import {
  MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, execute,
  type NotationPack, type Element, type Command,
} from '@all-draw/core';
import {
  notationsInModel, elementTraces, crossTraceCount, firstNodeOf, topSuggestions, linkCommand,
  matrixRows, coverage, gapsBetween, bestSuggestionCommand, bestSuggestionsBatch, scoreLabel,
} from '../src/panels/traces-helpers';

/** Packs mínimos con los ids reales de los packs de notación. */
const pack = (id: string, name: string, types: string[]): NotationPack => ({
  id, name, categories: [], portTypes: [], viewpoints: [],
  elementTypes: types.map(t => ({ id: `${id}:${t}`, name: t, fields: [] })),
  relationTypes: [],
});
const ARCHIMATE = pack('archimate', 'ArchiMate', ['BusinessProcess', 'BusinessActor', 'BusinessObject']);
const BPMN = pack('bpmn', 'BPMN', ['Task', 'Pool', 'DataObject']);
const FREEFORM = pack('freeform', 'Libre', ['box']);
const reg = () => new NotationRegistry().register(CORE_PACK).register(ARCHIMATE).register(BPMN).register(FREEFORM);

/** BPMN + ArchiMate: "Alta de cliente" en ambos (ya trazado), "Verificar identidad" (sugerible), un pool y un actor, ruido. */
function workspace() {
  const store = new MemoryStore();
  const put = (e: Element) => { store.set('elements', e.id, e); return e; };
  const amAlta = put(makeElement('archimate:BusinessProcess', 'Alta de cliente', { id: 'am_alta' }));
  const bpAlta = put(makeElement('bpmn:Task', 'Alta de Cliente', { id: 'bp_alta' }));
  const amVerif = put(makeElement('archimate:BusinessProcess', 'Verificar identidad', { id: 'am_verif' }));
  const bpVerif = put(makeElement('bpmn:Task', 'Verificar identidad', { id: 'bp_verif' }));
  const amActor = put(makeElement('archimate:BusinessActor', 'Comercial', { id: 'am_comercial' }));
  const bpPool = put(makeElement('bpmn:Pool', 'Departamento comercial', { id: 'bp_pool' }));
  put(makeElement('freeform:box', 'Nota', { id: 'ff_box' }));
  put(makeElement('bpmn:Task', 'Plantilla', { id: 'bp_tpl', template: true }));

  const view = makeView('Proceso', { id: 'v_bpmn', notationId: 'bpmn', kind: 'freeform' });
  store.set('views', view.id, view);
  const node = makeNode(view.id, bpAlta.id, { x: 0, y: 0 }, { id: 'n_alta' });
  store.set('nodes', node.id, node);
  const amView = makeView('Arquitectura', { id: 'v_am', notationId: 'archimate', kind: 'freeform' });
  store.set('views', amView.id, amView);
  store.set('nodes', 'n_am_alta', makeNode(amView.id, amAlta.id, { x: 0, y: 0 }, { id: 'n_am_alta' }));

  const rel = makeRelation('core:realizes', { elementId: bpAlta.id }, { elementId: amAlta.id }, { id: 'r_alta' });
  store.set('relations', rel.id, rel);
  return { store, amAlta, bpAlta, amVerif, bpVerif, amActor, bpPool, rel };
}

describe('notaciones y trazas de un elemento', () => {
  it('notationsInModel ignora freeform, core y plantillas; ordena por nombre del pack', () => {
    const { store } = workspace();
    expect(notationsInModel(store, reg())).toEqual(['archimate', 'bpmn']);
  });
  it('elementTraces resuelve el otro extremo y el sentido', () => {
    const { store, bpAlta, amAlta, rel } = workspace();
    const out = elementTraces(store, bpAlta.id);
    expect(out).toHaveLength(1);
    expect(out[0]!.partner.id).toBe(amAlta.id);
    expect(out[0]!.direction).toBe('out');
    expect(out[0]!.relation.id).toBe(rel.id);
    expect(elementTraces(store, amAlta.id)[0]!.direction).toBe('in');
    expect(elementTraces(store, 'bp_verif')).toEqual([]);
  });
  it('crossTraceCount cuenta solo puentes entre notaciones distintas', () => {
    const { store, amAlta, amVerif } = workspace();
    const r = reg();
    expect(crossTraceCount(store, r)).toBe(1);
    const same = makeRelation('core:trace', { elementId: amAlta.id }, { elementId: amVerif.id }, { id: 'r_same' });
    store.set('relations', same.id, same);
    expect(crossTraceCount(store, r)).toBe(1);
  });
  it('firstNodeOf da vista y nodo, o null', () => {
    const { store } = workspace();
    expect(firstNodeOf(store, 'bp_alta')).toEqual({ viewId: 'v_bpmn', nodeId: 'n_alta' });
    expect(firstNodeOf(store, 'bp_verif')).toBeNull();
  });
  it('topSuggestions limita y linkCommand crea un set de relación aplicable', () => {
    const { store, bpVerif, amVerif } = workspace();
    const sugs = topSuggestions(store, reg(), bpVerif.id, 3);
    expect(sugs.length).toBeLessThanOrEqual(3);
    expect(sugs[0]!.target.id).toBe(amVerif.id);
    expect(sugs[0]!.score).toBe(1);
    const cmd = linkCommand(bpVerif.id, sugs[0]!);
    expect(cmd.type).toBe('set');
    execute(store, cmd);
    expect(elementTraces(store, bpVerif.id).map(t => t.partner.id)).toEqual([amVerif.id]);
    // Ya trazado: deja de sugerirse
    expect(topSuggestions(store, reg(), bpVerif.id).some(s => s.target.id === amVerif.id)).toBe(false);
  });
});

describe('matriz, cobertura y huecos', () => {
  it('matrixRows cruza filas BPMN con columnas ArchiMate: ● existente, ○ sugerida, vacío', () => {
    const { store } = workspace();
    const m = matrixRows(store, reg(), 'bpmn', 'archimate');
    expect(m.rows.map(r => r.element.id)).toEqual(['bp_alta', 'bp_pool', 'bp_verif']);
    expect(m.cols.map(c => c.id)).toEqual(['am_alta', 'am_comercial', 'am_verif']);
    expect(m.totalRows).toBe(3); expect(m.totalCols).toBe(3);
    const row = (id: string) => m.rows.find(r => r.element.id === id)!;
    const cell = (r: string, c: string) => row(r).cells.find(x => x.col.id === c)!;
    expect(cell('bp_alta', 'am_alta').relations.map(x => x.id)).toEqual(['r_alta']);
    expect(cell('bp_alta', 'am_alta').suggestion).toBeUndefined();
    expect(cell('bp_verif', 'am_verif').relations).toEqual([]);
    expect(cell('bp_verif', 'am_verif').suggestion?.score).toBe(1);
    expect(cell('bp_pool', 'am_comercial').suggestion?.relationTypeId).toBe('core:trace');
    expect(cell('bp_pool', 'am_alta').relations).toEqual([]);
    expect(cell('bp_pool', 'am_alta').suggestion).toBeUndefined();
  });
  it('matrixRows filtra por texto en cada eje y muestra el eje entero si no hay coincidencias en él', () => {
    const { store } = workspace();
    const m = matrixRows(store, reg(), 'bpmn', 'archimate', 'ALTA');
    expect(m.rows.map(r => r.element.id)).toEqual(['bp_alta']);
    expect(m.cols.map(c => c.id)).toEqual(['am_alta']);
    const only = matrixRows(store, reg(), 'bpmn', 'archimate', 'departamento');
    expect(only.rows.map(r => r.element.id)).toEqual(['bp_pool']);
    expect(only.cols).toHaveLength(3);
    expect(matrixRows(store, reg(), 'bpmn', 'archimate', 'zzz').rows).toHaveLength(3);
  });
  it('coverage cuenta filas con alguna relación', () => {
    const { store } = workspace();
    expect(coverage(store, reg(), 'bpmn', 'archimate')).toEqual({ traced: 1, total: 3 });
    expect(coverage(store, reg(), 'archimate', 'bpmn')).toEqual({ traced: 1, total: 3 });
  });
  it('gapsBetween lista los huecos de la pareja con sugerencias hacia la otra notación', () => {
    const { store } = workspace();
    const gaps = gapsBetween(store, reg(), 'bpmn', 'archimate');
    expect(gaps.map(g => g.element.id)).toEqual(['am_comercial', 'am_verif', 'bp_pool', 'bp_verif']);
    for (const g of gaps) for (const s of g.suggestions) expect(reg().notationOf(s.target.typeId)).toBe(g.notationId === 'bpmn' ? 'archimate' : 'bpmn');
    const verif = gaps.find(g => g.element.id === 'bp_verif')!;
    expect(bestSuggestionCommand(verif)?.type).toBe('set');
    expect(bestSuggestionCommand({ ...verif, suggestions: [] })).toBeNull();
  });
  it('bestSuggestionsBatch: un solo batch, sin duplicar parejas mutuas, respetando el score mínimo', () => {
    const { store } = workspace();
    const r = reg();
    const batch = bestSuggestionsBatch(store, r, 0.8);
    expect(batch?.type).toBe('batch');
    const cmds = (batch as Extract<Command, { type: 'batch' }>).commands;
    // bp_verif ↔ am_verif se sugieren mutuamente con score 1: entra una sola relación
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.type).toBe('set');
    execute(store, batch!);
    expect(crossTraceCount(store, r)).toBe(2);
    expect(bestSuggestionsBatch(store, r, 0.8)).toBeNull();
    // Con umbral bajo entran también pool ↔ actor (afinidad de tipos, 0.3 + palabras)
    const low = bestSuggestionsBatch(store, r, 0.3);
    expect(low && low.type === 'batch' ? low.commands.length : 0).toBe(1);
  });
  it('scoreLabel redondea a porcentaje', () => {
    expect(scoreLabel(1)).toBe('100 %');
    expect(scoreLabel(0.8)).toBe('80 %');
    expect(scoreLabel(0.333)).toBe('33 %');
  });
});
