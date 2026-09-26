import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK } from '@all-draw/core';
import { CATALOG_PACK, DIAGRAM_KINDS, KNOWN_PACKS, FAMILIES, kindsFor, kindById, kindsByFamily, kindsWithoutPack } from '../src';

/** Ids reales de los packs de all-draw (`NotationPack.id`). Mantener en sincronía con scripts/seed.mjs. */
const PACK_IDS = ['archimate', 'bpmn', 'statechart', 'c4', 'sequence', 'er', 'uml', 'mindmap', 'flow', 'dfd', 'grid', 'freeform'];

describe('pack catalog', () => {
  it('es un pack vacío con nombre y se registra sin tipos', () => {
    expect(CATALOG_PACK.id).toBe('catalog');
    expect(CATALOG_PACK.name).toBe('Catálogo de diagramas');
    expect(CATALOG_PACK.elementTypes).toEqual([]);
    expect(CATALOG_PACK.relationTypes).toEqual([]);
    const r = new NotationRegistry().register(CORE_PACK).register(CATALOG_PACK);
    expect(r.pack('catalog')).toBe(CATALOG_PACK);
    expect(r.allElementTypes()).toEqual([]);
  });

  it('≥ 50 entradas con id único y campos completos', () => {
    expect(DIAGRAM_KINDS.length).toBeGreaterThanOrEqual(50);
    const ids = DIAGRAM_KINDS.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of DIAGRAM_KINDS) {
      expect(k.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(k.name.trim()).not.toBe('');
      expect(k.family.trim()).not.toBe('');
      expect(k.description.trim()).not.toBe('');
      expect(FAMILIES).toContain(k.family);
      if (k.url) expect(k.url).toMatch(/^https:\/\//);
    }
    expect(new Set(DIAGRAM_KINDS.map(k => k.n)).size).toBe(DIAGRAM_KINDS.length);
  });

  it('las entradas con notationId apuntan a un pack existente', () => {
    expect([...KNOWN_PACKS]).toEqual(PACK_IDS);
    const withPack = DIAGRAM_KINDS.filter(k => k.notationId);
    expect(withPack.length).toBeGreaterThanOrEqual(50);
    for (const k of withPack) expect(PACK_IDS, k.id).toContain(k.notationId);
  });

  it('helpers', () => {
    expect(kindsFor('bpmn').map(k => k.id)).toContain('bpmn-diagram');
    expect(kindsFor('er').map(k => k.id)).toContain('entity-relationship-diagram-erd');
    expect(kindsFor('uml').map(k => k.id)).toContain('uml-class-diagram');
    expect(kindsFor('sequence').map(k => k.id)).toContain('uml-sequence-diagram');
    expect(kindsFor('statechart').map(k => k.id)).toContain('uml-state-machine-diagram');
    expect(kindsFor('c4').map(k => k.id)).toContain('c4-container-diagram');
    expect(kindsFor('dfd').map(k => k.id)).toContain('data-flow-diagram-dfd');
    expect(kindsFor('flow').map(k => k.id)).toContain('process-flow-diagram');
    expect(kindsFor('mindmap').map(k => k.id)).toContain('work-breakdown-structure-wbs');
    expect(kindsFor('grid').map(k => k.id)).toContain('raci-matrix');
    expect(kindsFor('archimate').map(k => k.id)).toContain('capability-map');
    expect(kindsFor('nope')).toEqual([]);
    expect(kindById('bpmn-diagram')?.name).toBe('BPMN Diagram');
    expect(kindById('x')).toBeUndefined();
    expect(kindsByFamily().reduce((n, f) => n + f.kinds.length, 0)).toBe(DIAGRAM_KINDS.length);
    expect(kindsWithoutPack().every(k => !k.notationId)).toBe(true);
    expect(kindsWithoutPack().map(k => k.id)).toContain('uml-use-case-diagram');
  });
});
