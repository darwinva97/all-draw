import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, parseWorkspace, validate, type Workspace } from '@all-draw/core';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { BPMNLINT_VALIDATORS, importBpmn, indexBpmn } from '../src';

const reg = new NotationRegistry().register(CORE_PACK).register(BPMN_PACK);
type El = { id: string; typeId: string; name?: string; fields?: Record<string, unknown>; features?: Record<string, unknown> };
type Fl = [string, string, string, Record<string, unknown>?, string?];

/** Workspace mínimo: elementos planos (sin vistas) y flujos de secuencia `[id, from, to, fields, name]`. */
function ws(els: El[], flows: Fl[] = []): Workspace {
  return parseWorkspace({
    meta: { name: 't' },
    elements: Object.fromEntries(els.map(e => [e.id, { name: '', fields: {}, ...e, typeId: e.typeId.includes(':') ? e.typeId : `bpmn:${e.typeId}` }])),
    relations: Object.fromEntries(flows.map(([id, from, to, fields, name]) => [id, { id, typeId: 'bpmn:SequenceFlow', from: { elementId: from }, to: { elementId: to }, fields: fields ?? {}, name: name ?? '' }])),
  });
}
const lint = (w: Workspace, ids?: string[]) => {
  const vs = ids ? BPMNLINT_VALIDATORS.filter(v => ids.includes(v.id.slice('bpmnlint.'.length))) : BPMNLINT_VALIDATORS;
  return validate(new MemoryStore(w), reg, vs);
};
const codes = (w: Workspace, ids?: string[]) => lint(w, ids).map(d => `${d.code}:${d.subject.id}`).sort();

/** Proceso correcto: inicio → tarea → XOR → (sí: tarea B | no: fin) → fin. */
const GOOD = ws(
  [
    { id: 'p', typeId: 'Process', name: 'Proceso' },
    { id: 's', typeId: 'StartEvent', name: 'Inicio', features: { bpmnParent: 'p' } },
    { id: 'a', typeId: 'Task', name: 'A', features: { bpmnParent: 'p' } },
    { id: 'g', typeId: 'ExclusiveGateway', name: '¿Ok?', features: { bpmnParent: 'p' } },
    { id: 'b', typeId: 'Task', name: 'B', features: { bpmnParent: 'p' } },
    { id: 'e1', typeId: 'EndEvent', name: 'Fin', features: { bpmnParent: 'p' } },
    { id: 'e2', typeId: 'EndEvent', name: 'Fin no', features: { bpmnParent: 'p' } },
  ],
  [['f1', 's', 'a'], ['f2', 'a', 'g'], ['f3', 'g', 'b', { condition: 'ok' }, 'sí'], ['f4', 'g', 'e2', { default: true }], ['f5', 'b', 'e1']],
);

describe('bpmnlint', () => {
  it('expone 10 validadores con ids bpmnlint.* y un proceso correcto no produce diagnósticos', () => {
    expect(BPMNLINT_VALIDATORS.map(v => v.id)).toEqual([
      'bpmnlint.start-event-required', 'bpmnlint.end-event-required', 'bpmnlint.no-disconnected', 'bpmnlint.single-blank-start-event',
      'bpmnlint.no-implicit-split', 'bpmnlint.no-duplicate-sequence-flows', 'bpmnlint.label-required', 'bpmnlint.superfluous-gateway',
      'bpmnlint.fake-join', 'bpmnlint.no-inclusive-gateway-without-condition',
    ]);
    expect(lint(GOOD)).toEqual([]);
  });

  it('indexBpmn: ámbitos por bpmnParent y por nodos de las vistas (saltando grupos y lanes)', () => {
    const w = parseWorkspace({
      meta: { name: 'ix' },
      views: { v: { id: 'v', notationId: 'bpmn', name: 'v' } },
      elements: {
        pool: { id: 'pool', typeId: 'bpmn:Pool', name: 'P' }, lane: { id: 'lane', typeId: 'bpmn:Lane', name: 'L' }, grp: { id: 'grp', typeId: 'bpmn:Group' },
        sp: { id: 'sp', typeId: 'bpmn:SubProcess', name: 'S' }, t1: { id: 't1', typeId: 'bpmn:Task', name: 'T1' }, t2: { id: 't2', typeId: 'bpmn:Task', name: 'T2' },
        t3: { id: 't3', typeId: 'bpmn:Task', name: 'T3', features: { bpmnParent: 'sp' } },
      },
      nodes: {
        npool: { id: 'npool', viewId: 'v', elementId: 'pool' }, nlane: { id: 'nlane', viewId: 'v', elementId: 'lane', parentNodeId: 'npool' },
        ngrp: { id: 'ngrp', viewId: 'v', elementId: 'grp', parentNodeId: 'nlane' }, nt1: { id: 'nt1', viewId: 'v', elementId: 't1', parentNodeId: 'ngrp' },
        nsp: { id: 'nsp', viewId: 'v', elementId: 'sp', parentNodeId: 'nlane' }, nt2: { id: 'nt2', viewId: 'v', elementId: 't2', parentNodeId: 'nsp' },
      },
    });
    const ix = indexBpmn(new MemoryStore(w));
    expect(ix.scopeOf('t1')).toBe('pool');
    expect(ix.scopeOf('sp')).toBe('pool');
    expect(ix.scopeOf('t2')).toBe('sp');
    expect(ix.scopeOf('t3')).toBe('sp');
    expect(ix.scopeOf('pool')).toBeUndefined();
    expect([...ix.scopes.keys()].sort()).toEqual(['pool', 'sp']);
  });

  it('start-event-required / end-event-required: por proceso y por subproceso; no en ad hoc ni en subproceso de evento', () => {
    const w = ws([
      { id: 'p', typeId: 'Process', name: 'P' },
      { id: 'a', typeId: 'Task', name: 'A', features: { bpmnParent: 'p' } },
      { id: 'sp', typeId: 'SubProcess', name: 'Sub', features: { bpmnParent: 'p' } },
      { id: 'b', typeId: 'Task', name: 'B', features: { bpmnParent: 'sp' } },
      { id: 'ah', typeId: 'AdHocSubProcess', name: 'AdHoc', features: { bpmnParent: 'p' } },
      { id: 'c', typeId: 'Task', name: 'C', features: { bpmnParent: 'ah' } },
      { id: 'es', typeId: 'EventSubProcess', name: 'Ev', features: { bpmnParent: 'p' } },
      { id: 'd', typeId: 'Task', name: 'D', features: { bpmnParent: 'es' } },
    ], [['f1', 'a', 'sp'], ['f2', 'sp', 'ah']]);
    expect(codes(w, ['start-event-required'])).toEqual(['start-event-required:p', 'start-event-required:sp']);
    expect(codes(w, ['end-event-required'])).toEqual(['end-event-required:p', 'end-event-required:sp']);
    // Sin proceso explícito (raíz): el diagnóstico apunta al primer nodo con evidencia scope=root.
    const root = ws([{ id: 'a', typeId: 'Task', name: 'A' }, { id: 'e', typeId: 'EndEvent', name: 'E' }], [['f', 'a', 'e']]);
    const d = lint(root, ['start-event-required', 'end-event-required']);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: 'start-event-required', subject: { id: 'a' }, evidence: { scope: 'root' } });
  });

  it('no-disconnected: nodos sin flujos, salvo eventos de borde adheridos, compensación, link y subprocesos de evento', () => {
    const w = ws([
      { id: 's', typeId: 'StartEvent', name: 'S' }, { id: 'a', typeId: 'Task', name: 'A' }, { id: 'e', typeId: 'EndEvent', name: 'E' },
      { id: 'lonely', typeId: 'Task', name: 'Sola' },
      { id: 'bnd', typeId: 'BoundaryEvent', name: 'B', fields: { attachedTo: 'a', eventDefinition: 'timer' } },
      { id: 'bnd2', typeId: 'BoundaryEvent', name: 'B2', fields: { eventDefinition: 'error' } },
      { id: 'comp', typeId: 'Task', name: 'Comp', fields: { isForCompensation: true } },
      { id: 'lnk', typeId: 'IntermediateThrowEvent', name: 'L', fields: { eventDefinition: 'link' } },
      { id: 'es', typeId: 'EventSubProcess', name: 'ES' },
      { id: 'data', typeId: 'DataObject', name: 'D' },
    ], [['f1', 's', 'a'], ['f2', 'a', 'e']]);
    const d = lint(w, ['no-disconnected']);
    expect(d.map(x => x.subject.id).sort()).toEqual(['bnd2', 'lonely']);
    expect(d[0]!.supportedFixes[0]).toMatchObject({ command: { type: 'deleteElement' } });
  });

  it('single-blank-start-event: más de un inicio sin definición en el mismo ámbito', () => {
    const w = ws([
      { id: 'p', typeId: 'Process', name: 'P' },
      { id: 's1', typeId: 'StartEvent', name: 'S1', features: { bpmnParent: 'p' } },
      { id: 's2', typeId: 'StartEvent', name: 'S2', features: { bpmnParent: 'p' } },
      { id: 's3', typeId: 'StartEvent', name: 'S3', fields: { eventDefinition: 'message' }, features: { bpmnParent: 'p' } },
      { id: 'q', typeId: 'Process', name: 'Q' },
      { id: 's4', typeId: 'StartEvent', name: 'S4', features: { bpmnParent: 'q' } },
      { id: 'e', typeId: 'EndEvent', name: 'E', features: { bpmnParent: 'p' } },
      { id: 'e2', typeId: 'EndEvent', name: 'E2', features: { bpmnParent: 'q' } },
    ], [['f1', 's1', 'e'], ['f2', 's2', 'e'], ['f3', 's3', 'e'], ['f4', 's4', 'e2']]);
    expect(codes(w, ['single-blank-start-event'])).toEqual(['single-blank-start-event:s1', 'single-blank-start-event:s2']);
  });

  it('no-implicit-split y fake-join: varias salidas/entradas sin compuerta', () => {
    const w = ws([
      { id: 's', typeId: 'StartEvent', name: 'S' }, { id: 'a', typeId: 'Task', name: 'A' }, { id: 'b', typeId: 'Task', name: 'B' },
      { id: 'c', typeId: 'Task', name: 'C' }, { id: 'j', typeId: 'Task', name: 'J' }, { id: 'e', typeId: 'EndEvent', name: 'E' },
      { id: 'g', typeId: 'ParallelGateway', name: 'G' },
    ], [
      ['f1', 's', 'a'], ['f2', 'a', 'b'], ['f3', 'a', 'c'],          // split implícito en A
      ['f4', 'b', 'j'], ['f5', 'c', 'j'],                            // fake join en J
      ['f6', 'j', 'g'], ['f7', 'g', 'e'],
      ['f8', 'j', 'e', { condition: 'x' }],                          // J tiene 2 salidas pero... f6 sin condición → también split implícito
    ]);
    expect(codes(w, ['no-implicit-split'])).toEqual(['no-implicit-split:a', 'no-implicit-split:j']);
    expect(codes(w, ['fake-join'])).toEqual(['fake-join:j']);
    // Con condiciones en todas las salidas no hay split implícito; una compuerta que une no es fake-join.
    const ok = ws([{ id: 'a', typeId: 'Task', name: 'A' }, { id: 'b', typeId: 'Task', name: 'B' }, { id: 'c', typeId: 'Task', name: 'C' }, { id: 'g', typeId: 'ExclusiveGateway', name: 'G' }],
      [['f1', 'a', 'b', { condition: 'x' }], ['f2', 'a', 'c', { condition: 'y' }], ['f3', 'b', 'g'], ['f4', 'c', 'g']]);
    expect(codes(ok, ['no-implicit-split', 'fake-join'])).toEqual([]);
  });

  it('no-duplicate-sequence-flows: mismo origen y destino; propone borrar el duplicado', () => {
    const w = ws([{ id: 'a', typeId: 'Task', name: 'A' }, { id: 'b', typeId: 'Task', name: 'B' }], [['f1', 'a', 'b'], ['f2', 'a', 'b'], ['f3', 'b', 'a']]);
    const d = lint(w, ['no-duplicate-sequence-flows']);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ subject: { collection: 'relations', id: 'f2' }, evidence: { duplicateOf: 'f1' }, supportedFixes: [{ command: { type: 'deleteRelation', id: 'f2' } }] });
  });

  it('label-required: actividades, eventos (no de borde), pools/lanes, compuertas divergentes y sus flujos no por defecto', () => {
    const w = ws([
      { id: 'pool', typeId: 'Pool' }, { id: 'lane', typeId: 'Lane', name: 'L' },
      { id: 's', typeId: 'StartEvent' }, { id: 'a', typeId: 'Task' }, { id: 'bnd', typeId: 'BoundaryEvent', fields: { attachedTo: 'a' } },
      { id: 'g', typeId: 'ExclusiveGateway' }, { id: 'j', typeId: 'ExclusiveGateway' }, { id: 'pg', typeId: 'ParallelGateway' },
      { id: 'b', typeId: 'Task', name: 'B' }, { id: 'c', typeId: 'Task', name: 'C' }, { id: 'e', typeId: 'EndEvent', name: 'E' },
      { id: 'es', typeId: 'EventSubProcess' },
    ], [
      ['f1', 's', 'a'], ['f2', 'a', 'g'], ['f3', 'g', 'b', { condition: 'x' }], ['f4', 'g', 'c', { default: true }], ['f5', 'b', 'j'], ['f6', 'c', 'j'], ['f7', 'j', 'pg'], ['f8', 'pg', 'e'], ['f9', 'pg', 'e'],
    ]);
    expect(codes(w, ['label-required'])).toEqual(['label-required:a', 'label-required:f3', 'label-required:g', 'label-required:pool', 'label-required:s']);
  });

  it('superfluous-gateway: una entrada y una salida', () => {
    const w = ws([{ id: 'a', typeId: 'Task', name: 'A' }, { id: 'g', typeId: 'ExclusiveGateway', name: 'G' }, { id: 'b', typeId: 'Task', name: 'B' }, { id: 'c', typeId: 'Task', name: 'C' }, { id: 'h', typeId: 'ParallelGateway', name: 'H' }],
      [['f1', 'a', 'g'], ['f2', 'g', 'b'], ['f3', 'b', 'h'], ['f4', 'h', 'c'], ['f5', 'h', 'a']]);
    expect(codes(w, ['superfluous-gateway'])).toEqual(['superfluous-gateway:g']);
  });

  it('no-inclusive-gateway-without-condition: salidas sin condición ni default de una OR divergente', () => {
    const w = ws([{ id: 'a', typeId: 'Task', name: 'A' }, { id: 'g', typeId: 'InclusiveGateway', name: 'OR' }, { id: 'b', typeId: 'Task', name: 'B' }, { id: 'c', typeId: 'Task', name: 'C' }, { id: 'd', typeId: 'Task', name: 'D' }, { id: 'x', typeId: 'ExclusiveGateway', name: 'X' }],
      [['f1', 'a', 'g'], ['f2', 'g', 'b', { condition: 'p' }], ['f3', 'g', 'c'], ['f4', 'g', 'd', { default: true }], ['f5', 'b', 'x'], ['f6', 'x', 'c'], ['f7', 'x', 'd']]);
    const d = lint(w, ['no-inclusive-gateway-without-condition']);
    expect(d.map(x => x.subject.id)).toEqual(['f3']);
    expect(d[0]).toMatchObject({ severity: 'error', subject: { collection: 'relations' }, evidence: { gateway: 'g' } });
  });

  it('funciona sobre un BPMN importado: detecta lo que bpmnlint detectaría', async () => {
    const xml = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" name="P">
    <bpmn:startEvent id="s1" /><bpmn:startEvent id="s2" />
    <bpmn:task id="t" name="T" />
    <bpmn:exclusiveGateway id="g" name="G" />
    <bpmn:task id="orphan" name="Huérfana" />
    <bpmn:sequenceFlow id="f1" sourceRef="s1" targetRef="t" />
    <bpmn:sequenceFlow id="f2" sourceRef="s2" targetRef="t" />
    <bpmn:sequenceFlow id="f3" sourceRef="t" targetRef="g" />
    <bpmn:sequenceFlow id="f4" sourceRef="g" targetRef="t" />
  </bpmn:process>
</bpmn:definitions>`;
    const { workspace } = await importBpmn(xml);
    const c = codes(workspace);
    expect(c).toEqual(expect.arrayContaining(['end-event-required:P', 'single-blank-start-event:s1', 'single-blank-start-event:s2', 'no-disconnected:orphan', 'fake-join:t', 'superfluous-gateway:g', 'label-required:s1', 'label-required:s2']));
    expect(c).not.toContain('start-event-required:P');
    expect(c.filter(x => x.startsWith('no-implicit-split'))).toEqual([]);
  });
});
