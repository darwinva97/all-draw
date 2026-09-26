import { describe, it, expect } from 'vitest';
import {
  MemoryStore, NotationRegistry, CORE_PACK, makeRelation, resolveRelationStyle, relationRuleMatches, ruleImpact, isRelationSource, resolveStyle,
  makeElement, type StyleRule, type Library,
} from '@all-draw/core';

const rule = (extra: Partial<StyleRule>): StyleRule => ({ id: 'r', name: 'r', enabled: true, priority: 0, match: 'all', target: 'relation', conditions: [], style: {}, viewId: null, ...extra });

function setup() {
  const store = new MemoryStore();
  const reg = new NotationRegistry().register(CORE_PACK);
  store.set('elements', 'a', makeElement('freeform:box', 'A', { id: 'a' }));
  store.set('elements', 'b', makeElement('freeform:box', 'B', { id: 'b' }));
  store.set('relations', 'r1', makeRelation('core:flow', { elementId: 'a' }, { elementId: 'b' }, { id: 'r1', name: 'pedidos', doc: 'Flujo crítico', props: { sla: 'oro' }, fields: { contract: '{"v":1}' } }));
  store.set('relations', 'r2', makeRelation('core:trace', { elementId: 'a' }, { elementId: 'b' }, { id: 'r2', name: 'traza' }));
  return { store, reg };
}

describe('reglas sobre relaciones', () => {
  it('casan por nombre, doc, tipo, notación, propiedad y campo', () => {
    const { store, reg } = setup();
    const r1 = store.get('relations', 'r1')!, r2 = store.get('relations', 'r2')!;
    const cases: [StyleRule['conditions'][number], boolean, boolean][] = [
      [{ source: 'name', op: 'contains', value: 'pedi' }, true, false],
      [{ source: 'doc', op: 'contains', value: 'crítico' }, true, false],
      [{ source: 'type', op: 'eq', value: 'Flujo de datos' }, true, false],
      [{ source: 'notation', op: 'eq', value: 'core' }, true, true],
      [{ source: 'prop', key: 'sla', op: 'eq', value: 'oro' }, true, false],
      [{ source: 'field', key: 'contract', op: 'notEmpty' }, true, false],
      [{ source: 'field', key: 'contract', op: 'empty' }, false, true],
      [{ source: 'tag', op: 'notEmpty' }, false, false], // fuente sin sentido para relaciones
    ];
    for (const [c, m1, m2] of cases) {
      const r = rule({ conditions: [c] });
      expect(relationRuleMatches(store, reg, r1, r), JSON.stringify(c)).toBe(m1);
      expect(relationRuleMatches(store, reg, r2, r), JSON.stringify(c)).toBe(m2);
    }
  });
  it('resuelve el estilo por prioridad y solo con reglas de destino relación; ruleImpact cuenta relaciones', () => {
    const { store, reg } = setup();
    store.set('rules', 'baja', rule({ id: 'baja', priority: 0, conditions: [{ source: 'notation', op: 'eq', value: 'core' }], style: { border: '#00f', borderWidth: 3, badge: '#f00', badgeText: '!' } }));
    store.set('rules', 'alta', rule({ id: 'alta', priority: 5, conditions: [{ source: 'name', op: 'eq', value: 'pedidos' }], style: { border: '#0f0', borderStyle: 'dashed' } }));
    store.set('rules', 'el', rule({ id: 'el', target: 'element', priority: 9, conditions: [{ source: 'name', op: 'notEmpty' }], style: { border: '#000' } }));
    store.set('rules', 'off', rule({ id: 'off', enabled: false, priority: 9, conditions: [{ source: 'name', op: 'notEmpty' }], style: { border: '#000' } }));
    const r1 = store.get('relations', 'r1')!;
    const { style, rules } = resolveRelationStyle(store, reg, r1);
    expect(rules.map(r => r.id)).toEqual(['baja', 'alta']);
    expect(style).toEqual({ border: '#0f0', borderWidth: 3, badge: '#f00', badgeText: '!', borderStyle: 'dashed' });
    expect(ruleImpact(store, reg, store.get('rules', 'baja')!)).toBe(2);
    expect(ruleImpact(store, reg, store.get('rules', 'alta')!)).toBe(1);
    // Las reglas de relación no afectan a elementos, ni al revés
    expect(resolveStyle(store, reg, store.get('elements', 'a')!).rules.map(r => r.id)).toEqual(['el']);
  });
  it('respeta el filtro por vista', () => {
    const { store, reg } = setup();
    store.set('rules', 'v', rule({ id: 'v', viewId: 'vw_x', conditions: [{ source: 'name', op: 'notEmpty' }], style: { border: '#000' } }));
    const r1 = store.get('relations', 'r1')!;
    expect(resolveRelationStyle(store, reg, r1, 'vw_x').rules).toHaveLength(1);
    expect(resolveRelationStyle(store, reg, r1, 'vw_y').rules).toHaveLength(0);
    expect(resolveRelationStyle(store, reg, r1).rules).toHaveLength(1);
  });
  it('isRelationSource', () => {
    expect(['name', 'doc', 'type', 'notation', 'prop', 'field'].every(s => isRelationSource(s as never))).toBe(true);
    expect(['tag', 'people', 'role', 'port', 'library', 'view'].some(s => isRelationSource(s as never))).toBe(false);
  });
});

describe('registro: tipos de librería', () => {
  const lib = (id: string, types: string[]): Library => ({ id, name: id, description: '', elementTypes: types.map(t => ({ id: `lib:${id}:${t}`, name: t, fields: [] })), relationTypes: [{ id: `lib:${id}:rel`, name: 'rel', fields: [] }], portTypes: [], notations: [] });
  it('registerLibraryTypes retira los tipos anteriores de la misma librería', () => {
    const reg = new NotationRegistry().register(CORE_PACK);
    reg.registerLibraryTypes(lib('a', ['x', 'y']));
    expect(reg.elementType('lib:a:x')).toBeDefined();
    reg.registerLibraryTypes(lib('a', ['y']));
    expect(reg.elementType('lib:a:x')).toBeUndefined();
    expect(reg.elementType('lib:a:y')).toBeDefined();
    expect(reg.relationType('lib:a:rel')).toBeDefined();
  });
  it('syncLibraryTypes deja exactamente las librerías dadas y no toca los packs', () => {
    const reg = new NotationRegistry().register(CORE_PACK);
    reg.syncLibraryTypes([lib('a', ['x']), lib('b', ['z'])]);
    expect(reg.libraryIds().sort()).toEqual(['a', 'b']);
    reg.syncLibraryTypes([lib('b', ['z', 'w'])]);
    expect(reg.libraryIds()).toEqual(['b']);
    expect(reg.elementType('lib:a:x')).toBeUndefined();
    expect(reg.elementType('lib:b:w')).toBeDefined();
    expect(reg.relationType('lib:a:rel')).toBeUndefined();
    expect(reg.relationType('core:link')).toBeDefined();
    reg.unregisterLibraryTypes('no-existe');
    reg.syncLibraryTypes([]);
    expect(reg.allElementTypes()).toEqual([]);
    expect(reg.relationType('core:link')).toBeDefined();
  });
});
