import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseWorkspace, exampleWorkspace, MemoryStore, History, execute, makeElement, makeView, makeNode, makeRelation, makeEdge,
  NotationRegistry, CORE_PACK, derivePorts, validate, viewsOfElement, migrate, type NotationPack, loadInto,
} from '../src';

const FREEFORM: NotationPack = {
  id: 'freeform', name: 'Libre', categories: [], portTypes: [], viewpoints: [],
  elementTypes: [{ id: 'freeform:box', name: 'Caja', fields: [{ key: 'api', label: 'API', kind: 'json' }] }],
  relationTypes: [{ id: 'freeform:arrow', name: 'Flecha', fields: [] }],
};
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x as object).sort().map(k => [k, (x as Record<string, unknown>)[k]])) : x);
const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM);

describe('modelo', () => {
  it('el ejemplo valida y no tiene diagnósticos de error', () => {
    const ws = parseWorkspace(exampleWorkspace());
    const store = new MemoryStore(ws);
    const diags = validate(store, reg());
    expect(diags.filter(d => d.severity === 'error')).toEqual([]);
    expect(viewsOfElement(store, 'el_alta').details.map(v => v.id)).toEqual(['vw_2']);
    expect(viewsOfElement(store, 'el_alta').appearsIn.map(v => v.id)).toEqual(['vw_1']);
  });
  it('migra desde versión 0', () => {
    const ws = migrate({ elements: {}, meta: { name: 'x' } });
    expect(ws.meta.schemaVersion).toBe(1);
  });
});

describe('puertos', () => {
  it('deriva un puerto por hoja JSON con id estable', () => {
    const e = makeElement('freeform:box', 'CRM', { id: 'el_x', fields: { api: '{"cliente":{"id":1,"tags":["a"]}}' } });
    const ports = derivePorts(e, [{ key: 'api', label: 'API', kind: 'json' }]);
    expect(ports.map(p => p.id)).toEqual(['el_x#api.cliente', 'el_x#api.cliente.id', 'el_x#api.cliente.tags', 'el_x#api.cliente.tags[]']);
    expect(ports.every(p => p.derived)).toBe(true);
  });
});

describe('comandos', () => {
  it('deleteElement borra apariciones, aristas y relaciones; undo lo restaura todo', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const h = new History(store);
    const before = canon(store.snapshot());
    h.run({ type: 'deleteElement', id: 'el_alta' });
    expect(store.get('elements', 'el_alta')).toBeUndefined();
    expect(store.list('nodes').length).toBe(1);
    expect(store.list('edges').length).toBe(0);
    expect(store.list('relations').length).toBe(0);
    expect(store.get('views', 'vw_2')?.rootElementId).toBeUndefined();
    h.undo();
    expect(canon(store.snapshot())).toBe(before);
    h.redo();
    expect(store.get('elements', 'el_alta')).toBeUndefined();
  });
  it('propiedad: cualquier secuencia de comandos seguida de undos vuelve al origen y nunca deja referencias rotas', () => {
    const cmdArb = fc.oneof(
      fc.constant<'add'>('add'), fc.constant<'connect'>('connect'), fc.constant<'delEl'>('delEl'), fc.constant<'delNode'>('delNode'), fc.constant<'move'>('move'),
    );
    fc.assert(fc.property(fc.array(fc.tuple(cmdArb, fc.nat(20)), { maxLength: 30 }), (steps) => {
      const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
      const h = new History(store);
      const r = reg();
      const before = canon(store.snapshot());
      for (const [k, n] of steps) {
        const els = store.list('elements'), nodes = store.list('nodes');
        if (k === 'add') { const e = makeElement('freeform:box', `E${n}`); h.run({ type: 'addElementToView', element: e, node: makeNode('vw_1', undefined, { x: n, y: n }) }); }
        else if (k === 'connect' && nodes.length >= 2) {
          const a = nodes[n % nodes.length]!, b = nodes[(n + 1) % nodes.length]!;
          if (a.viewId === b.viewId && a.elementId && b.elementId)
            h.run({ type: 'connect', relation: makeRelation('core:link', { elementId: a.elementId }, { elementId: b.elementId }), edge: makeEdge(a.viewId, undefined, a.id, b.id) });
        }
        else if (k === 'delEl' && els.length) h.run({ type: 'deleteElement', id: els[n % els.length]!.id });
        else if (k === 'delNode' && nodes.length) h.run({ type: 'deleteNode', id: nodes[n % nodes.length]!.id });
        else if (k === 'move' && nodes.length) h.run({ type: 'moveNodes', moves: [{ id: nodes[n % nodes.length]!.id, x: n * 10, y: n * 5 }] });
        const errs = validate(store, r).filter(d => d.severity === 'error');
        expect(errs).toEqual([]);
      }
      while (h.undo()) { /* deshacer todo */ }
      expect(canon(store.snapshot())).toBe(before);
    }), { numRuns: 60 });
  });
  it('loadInto reemplaza el contenido', () => {
    const store = new MemoryStore();
    loadInto(store, parseWorkspace(exampleWorkspace()));
    expect(store.list('elements').length).toBe(2);
    execute(store, { type: 'set', collection: 'views', id: 'v9', value: makeView('Nueva', { id: 'v9' }) });
    expect(store.get('views', 'v9')?.name).toBe('Nueva');
  });
});

describe('matriz de validez', () => {
  it('entre notaciones distintas solo permite relaciones puente', () => {
    const r = reg().register({ id: 'x', name: 'X', categories: [], portTypes: [], viewpoints: [], elementTypes: [{ id: 'x:A', name: 'A', fields: [] }], relationTypes: [{ id: 'x:r', name: 'r', fields: [] }], validity: { A: { A: ['x:r'] } } });
    expect(r.allowedRelations('x:A', 'x:A')).toContain('x:r');
    expect(r.allowedRelations('x:A', 'freeform:box')).not.toContain('x:r');
    expect(r.allowedRelations('x:A', 'freeform:box')).toContain('core:trace');
  });
});
