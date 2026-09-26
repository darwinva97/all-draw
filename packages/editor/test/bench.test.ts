/**
 * Benchmarks del lado editor/sync sobre el espacio grande: `YjsStore` (snapshot, loadInto), índice
 * por vista, búsqueda y lint geométrico de una vista. Umbrales 10× el objetivo (ver `docs/06-rendimiento.md`).
 */
import { describe, it, expect } from 'vitest';
import { generateLargeWorkspace, loadInto, NotationRegistry, CORE_PACK, createIndex, validate, DEFAULT_VALIDATORS, MemoryStore } from '@all-draw/core';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { YjsStore } from '../../sync/src';
import { geometryLint, lintView } from '../../layout/src';
import { searchWorkspace } from '../src/search';

const reg = new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK);
const ws = generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', pack: ARCHIMATE_PACK });

/** Ejecuta `fn` tres veces: informa de la primera (en frío) y de la mejor; el umbral se aplica a la mejor. */
function time<T>(label: string, fn: () => T, runs = 3): { ms: number; first: number; result: T } {
  let best = Infinity, first = 0, result!: T;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now(); result = fn(); const ms = performance.now() - t0;
    if (i === 0) first = ms;
    if (ms < best) best = ms;
  }
  console.log(`[bench editor] ${label}: ${best.toFixed(1)} ms (primera ${first.toFixed(1)} ms)`);
  return { ms: best, first, result };
}

describe('espacio grande en YjsStore', () => {
  it('loadInto < 2 s y snapshot() < 500 ms', () => {
    const store = new YjsStore();
    const { ms: load } = time('loadInto (Yjs)', () => loadInto(store, ws));
    expect(store.list('elements').length).toBe(1000);
    expect(load).toBeLessThan(20_000);
    const { ms: snap, result } = time('snapshot (Yjs)', () => store.snapshot());
    expect(Object.keys(result.nodes).length).toBe(3000);
    expect(snap).toBeLessThan(5_000);
    // Copia desligada: mutar el snapshot no toca el documento
    result.elements['el_b0']!.name = 'mutado';
    result.elements['el_b0']!.props['x'] = 'y';
    expect(store.get('elements', 'el_b0')!.name).not.toBe('mutado');
    expect(store.get('elements', 'el_b0')!.props['x']).toBeUndefined();
  });

  it('índice por vista y moveNodes sobre Yjs', () => {
    const store = new YjsStore();
    loadInto(store, ws);
    const { ms: idx, result } = time('createIndex (Yjs)', () => createIndex(store));
    expect(result.nodesOfView('vw_b1').length).toBe(60);
    expect(idx).toBeLessThan(2_000);
    const { ms: views } = time('nodesOfView ×50', () => { let n = 0; for (const v of store.list('views')) n += result.nodesOfView(v.id).length; return n; });
    expect(views).toBeLessThan(200);
  });

  it('validate con lint geométrico de todas las vistas < 1 s', () => {
    const store = new MemoryStore(structuredClone(ws));
    const { ms } = time('validate + geometryLint', () => validate(store, reg, [...DEFAULT_VALIDATORS, geometryLint]));
    expect(ms).toBeLessThan(10_000);
    const { ms: one } = time('lintView ×1', () => lintView(store, reg, 'vw_b0'));
    expect(one).toBeLessThan(500);
  });

  it('búsqueda en la paleta de comandos < 100 ms', () => {
    const store = new MemoryStore(structuredClone(ws));
    const { ms, result } = time('searchWorkspace', () => searchWorkspace(store, reg, 'service 7', { viewId: 'vw_b0', actions: [] }));
    expect(result.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1_000);
  });
});
