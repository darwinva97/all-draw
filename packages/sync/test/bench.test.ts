// @vitest-environment node
/**
 * `YjsStore` con registros `Y.Map` (formato 2) sobre el espacio grande (1.000 elementos × 50 vistas): abrir un doc,
 * cargar en frío y en caliente, editar y tamaño. Umbrales 10× lo medido (ver `docs/06-rendimiento.md`, «Formato de
 * registros 2»): fallan ante una regresión cuadrática, no por ruido.
 */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { COLLECTIONS, createIndex, execute, generateLargeWorkspace, loadInto } from '@all-draw/core';
import { ARCHIMATE_PACK } from '../../notations/archimate/src';
import { YjsStore } from '../src';

const ws = generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', pack: ARCHIMATE_PACK });

function time<T>(label: string, fn: () => T, runs = 3): { ms: number; first: number; result: T } {
  let best = Infinity, first = 0, result!: T;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now(); result = fn(); const ms = performance.now() - t0;
    if (i === 0) first = ms;
    if (ms < best) best = ms;
  }
  console.log(`[bench sync] ${label}: ${best.toFixed(1)} ms (primera ${first.toFixed(1)} ms)`);
  return { ms: best, first, result };
}

describe('YjsStore (formato 2) con el espacio grande', () => {
  it('cargar en frío, abrir (update completo + listas), tamaño', () => {
    const { ms: cold, result: store } = time('loadInto en un store vacío', () => { const s = new YjsStore(); loadInto(s, ws); return s; });
    expect(cold).toBeLessThan(1_500);
    const update = Y.encodeStateAsUpdate(store.doc);
    console.log(`[bench sync] tamaño del doc: ${(update.byteLength / 1024).toFixed(0)} KB, ${Y.decodeUpdate(update).structs.length} structs`);
    expect(update.byteLength).toBeLessThan(2_000_000);
    const { ms: open, result: opened } = time('abrir (applyUpdate + list de todo)', () => {
      const d = new Y.Doc(); Y.applyUpdate(d, update);
      const s = new YjsStore(d);
      for (const c of COLLECTIONS) s.list(c);
      return s;
    });
    expect(open).toBeLessThan(2_000);
    expect(opened.list('nodes')).toHaveLength(3000);
    expect(createIndex(opened).nodesOfView('vw_b0')).toHaveLength(60);
  });

  it('loadInto en caliente (mismo contenido) no escribe nada; editar es barato', () => {
    const s = new YjsStore(); loadInto(s, ws);
    let updates = 0;
    s.doc.on('update', () => { updates++; });
    const { ms: warm } = time('loadInto con el mismo contenido', () => loadInto(s, ws));
    expect(updates).toBe(0);
    expect(warm).toBeLessThan(500);
    const ids = s.list('nodes').slice(0, 100).map(n => n.id);
    let k = 0;
    const { ms: move } = time('moveNodes ×100', () => { k++; execute(s, { type: 'moveNodes', moves: ids.map((id, i) => ({ id, x: i * 10 + k, y: i })) }); });
    expect(move).toBeLessThan(100);
    expect(s.get('nodes', ids[99]!)!.x).toBe(990 + k);
    const { ms: rename } = time('renombrar un elemento + list + get', () => { k++; execute(s, { type: 'patch', collection: 'elements', id: 'el_b0', patch: { name: `n${k}` } }); s.list('elements'); return s.get('elements', 'el_b0'); }, 20);
    expect(rename).toBeLessThan(20);
  });
});
