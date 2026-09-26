/**
 * Benchmarks del núcleo sobre el espacio grande (1.000 elementos × 50 vistas). Los umbrales son
 * generosos (10× el objetivo de `docs/06-rendimiento.md`) para que no fallen por ruido de la máquina
 * de CI, pero sí ante una regresión cuadrática.
 */
import { describe, it, expect } from 'vitest';
import {
  generateLargeWorkspace, parseWorkspace, MemoryStore, NotationRegistry, CORE_PACK, validate, resolveStyle, createIndex, execute, indexOf,
  type Workspace,
} from '../src';
import { ARCHIMATE_PACK } from '../../notations/archimate/src';

const reg = new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK);
const ws: Workspace = generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', pack: ARCHIMATE_PACK });

/** Ejecuta `fn` tres veces: informa de la primera (en frío) y de la mejor; el umbral se aplica a la mejor. */
function time<T>(label: string, fn: () => T, runs = 3): { ms: number; first: number; result: T } {
  let best = Infinity, first = 0, result!: T;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now(); result = fn(); const ms = performance.now() - t0;
    if (i === 0) first = ms;
    if (ms < best) best = ms;
  }
  console.log(`[bench core] ${label}: ${best.toFixed(1)} ms (primera ${first.toFixed(1)} ms)`);
  return { ms: best, first, result };
}

describe('espacio grande', () => {
  it('es determinista y tiene el tamaño pedido', () => {
    const again = generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', pack: ARCHIMATE_PACK });
    expect(Object.keys(ws.elements).length).toBe(1000);
    expect(Object.keys(ws.views).length).toBe(50);
    expect(Object.keys(ws.nodes).length).toBe(3000);
    expect(JSON.stringify(again)).toBe(JSON.stringify(ws));
    expect(() => parseWorkspace(ws)).not.toThrow();
    // Cada elemento aparece en alguna vista y hay nodos anidados
    const used = new Set(Object.values(ws.nodes).map(n => n.elementId));
    expect(Object.keys(ws.elements).every(id => used.has(id))).toBe(true);
    expect(Object.values(ws.nodes).some(n => n.parentNodeId)).toBe(true);
    expect(Object.keys(ws.edges).length).toBeGreaterThan(1000);
  });

  it('las relaciones son válidas según la matriz (sin errores del validador)', () => {
    const store = new MemoryStore(structuredClone(ws));
    const diags = validate(store, reg);
    expect(diags.filter(d => d.severity === 'error')).toEqual([]);
  });

  it('validate() completo < 1 s', () => {
    const store = new MemoryStore(structuredClone(ws));
    indexOf(store);
    const { ms } = time('validate', () => validate(store, reg));
    expect(ms).toBeLessThan(10_000);
  });

  it('resolveStyle de todos los elementos < 200 ms', () => {
    const store = new MemoryStore(structuredClone(ws));
    const els = store.list('elements');
    const { ms, result } = time('resolveStyle ×1000', () => els.map(e => resolveStyle(store, reg, e, 'vw_b0').style));
    expect(result.some(s => Object.keys(s).length > 0)).toBe(true);
    expect(ms).toBeLessThan(2_000);
  });

  it('createIndex < 200 ms', () => {
    const store = new MemoryStore(structuredClone(ws));
    const { ms, result } = time('createIndex', () => createIndex(store));
    expect(result.nodesOfView('vw_b0').length).toBe(60);
    expect(ms).toBeLessThan(2_000);
  });

  it('execute(moveNodes) de 100 nodos < 50 ms', () => {
    const store = new MemoryStore(structuredClone(ws));
    indexOf(store);
    const ids = store.list('nodes').slice(0, 100).map(n => n.id);
    const { ms } = time('moveNodes ×100', () => execute(store, { type: 'moveNodes', moves: ids.map((id, i) => ({ id, x: i * 10, y: i * 5 })) }));
    expect(store.get('nodes', ids[99]!)!.x).toBe(990);
    expect(ms).toBeLessThan(500);
  });

  it('MemoryStore.list() repetido es barato (caché por colección)', () => {
    const store = new MemoryStore(structuredClone(ws));
    const { ms } = time('list(nodes) ×1000', () => { let n = 0; for (let i = 0; i < 1000; i++) n += store.list('nodes').length; return n; });
    expect(ms).toBeLessThan(500);
  });
});
