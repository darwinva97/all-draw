import { describe, it, expect } from 'vitest';
import { MemoryStore, History, makeElement, type Element } from '@all-draw/core';
import { propagateTemplate, retypeElements, libraryOfTypeId, FALLBACK_TYPE } from '../src/template';

function setup() {
  const store = new MemoryStore();
  const h = new History(store);
  const tpl: Element = makeElement('lib:acme:micro', 'Micro', { id: 'tpl', template: true, libraryId: 'acme', doc: 'doc v1', fields: { port: 8080, lang: 'go', tags: ['a'] } });
  store.set('elements', 'tpl', tpl);
  // i1: sin tocar. i2: cambió port y nombre. i3: instancia de otra plantilla.
  store.set('elements', 'i1', makeElement('lib:acme:micro', 'Micro', { id: 'i1', templateId: 'tpl', libraryId: 'acme', doc: 'doc v1', fields: { port: 8080, lang: 'go', tags: ['a'] } }));
  store.set('elements', 'i2', makeElement('lib:acme:micro', 'Pagos', { id: 'i2', templateId: 'tpl', libraryId: 'acme', doc: 'doc v1', fields: { port: 9090, lang: 'go', tags: ['a'] } }));
  store.set('elements', 'i3', makeElement('lib:acme:micro', 'Micro', { id: 'i3', templateId: 'otra', fields: { port: 8080 } }));
  return { store, h, tpl };
}

describe('propagateTemplate', () => {
  it('actualiza solo los campos que la instancia no había cambiado, y el nombre si era el de la plantilla', () => {
    const { store, h, tpl } = setup();
    const next: Element = { ...tpl, name: 'Microservicio', fields: { ...tpl.fields, port: 8081, lang: 'rust' } };
    const plan = propagateTemplate(store, tpl, next);
    expect(plan.touched.sort()).toEqual(['i1', 'i2']);
    expect(plan.skipped).toEqual([]);
    h.run({ type: 'batch', commands: plan.commands });
    const i1 = store.get('elements', 'i1')!, i2 = store.get('elements', 'i2')!, i3 = store.get('elements', 'i3')!;
    expect(i1.name).toBe('Microservicio'); expect(i1.fields).toEqual({ port: 8081, lang: 'rust', tags: ['a'] });
    expect(i2.name).toBe('Pagos'); expect(i2.fields).toEqual({ port: 9090, lang: 'rust', tags: ['a'] }); // port respetado
    expect(i3.fields).toEqual({ port: 8080 }); // otra plantilla: intacta
    h.undo();
    expect(store.get('elements', 'i1')!.fields.port).toBe(8080);
  });
  it('sin cambios no genera comandos; instancias con todo sobreescrito van a skipped', () => {
    const { store, tpl } = setup();
    expect(propagateTemplate(store, tpl, { ...tpl }).commands).toEqual([]);
    const next: Element = { ...tpl, fields: { ...tpl.fields, port: 1 } };
    const plan = propagateTemplate(store, tpl, next);
    expect(plan.touched).toEqual(['i1']);
    expect(plan.skipped).toEqual(['i2']);
  });
  it('compara valores estructurados (listas) por contenido y propaga doc y campos nuevos/borrados', () => {
    const { store, tpl } = setup();
    const next: Element = { ...tpl, doc: 'doc v2', fields: { port: 8080, lang: 'go', tags: ['a', 'b'], extra: 'x' } };
    const plan = propagateTemplate(store, tpl, next);
    const p1 = plan.commands.find(c => c.type === 'patch' && c.id === 'i1');
    expect(p1 && p1.type === 'patch' ? p1.patch : null).toEqual({ fields: { tags: ['a', 'b'], extra: 'x' }, doc: 'doc v2' });
    const removed: Element = { ...tpl, fields: { port: 8080, lang: 'go' } };
    const p2 = propagateTemplate(store, tpl, removed).commands.find(c => c.type === 'patch' && c.id === 'i1');
    expect(p2 && p2.type === 'patch' ? p2.patch : null).toEqual({ fields: { tags: undefined } });
  });
  it('ignora plantillas con id distinto', () => {
    const { store, tpl } = setup();
    expect(propagateTemplate(store, tpl, { ...tpl, id: 'zzz', name: 'X' }).commands).toEqual([]);
  });
});

describe('retypeElements', () => {
  it('cambia el tipo de todos los que lo usan; a un tipo de pack quita la librería, a otra librería la cambia', () => {
    const { store, h } = setup();
    const cmds = retypeElements(store, 'lib:acme:micro', FALLBACK_TYPE);
    expect(cmds.map(c => (c as { id: string }).id).sort()).toEqual(['i1', 'i2', 'i3', 'tpl']);
    h.run({ type: 'batch', commands: cmds });
    expect(store.get('elements', 'i1')).toMatchObject({ typeId: 'freeform:box' });
    expect(store.get('elements', 'i1')!.libraryId).toBeUndefined();
    h.undo();
    expect(store.get('elements', 'i1')!.libraryId).toBe('acme');
    h.run({ type: 'batch', commands: retypeElements(store, 'lib:acme:micro', 'lib:otra:db') });
    expect(store.get('elements', 'i1')).toMatchObject({ typeId: 'lib:otra:db', libraryId: 'otra' });
    expect(retypeElements(store, 'x', 'x')).toEqual([]);
  });
  it('dentro de la misma librería conserva libraryId', () => {
    const { store } = setup();
    const c = retypeElements(store, 'lib:acme:micro', 'lib:acme:db').find(c => (c as { id: string }).id === 'i1');
    expect(c && c.type === 'patch' ? c.patch : null).toEqual({ typeId: 'lib:acme:db' });
  });
  it('libraryOfTypeId', () => {
    expect(libraryOfTypeId('lib:acme:micro')).toBe('acme');
    expect(libraryOfTypeId('archimate:BusinessProcess')).toBe('');
    expect(libraryOfTypeId('raro')).toBeUndefined();
  });
});
