import { describe, it, expect, vi } from 'vitest';
import { tIn } from '@all-draw/i18n';
import { peersOf, remoteSelection, selectionSignature, throttle, initials, colorFor, type AwarenessLike } from '../src/presence';

/** Awareness en memoria con la forma mínima que necesita el editor. */
function fakeAwareness(clientID: number, states: Record<number, unknown>): AwarenessLike {
  const m = new Map<number, unknown>(Object.entries(states).map(([k, v]) => [Number(k), v]));
  const cbs = new Set<() => void>();
  return {
    clientID,
    getStates: () => m,
    setLocalStateField: (k, v) => { m.set(clientID, { ...(m.get(clientID) as object), [k]: v }); cbs.forEach(cb => cb()); },
    on: (_e, cb) => cbs.add(cb),
    off: (_e, cb) => cbs.delete(cb),
  };
}

describe('presencia', () => {
  it('peersOf excluye al propio cliente y rellena nombre y color', () => {
    const aw = fakeAwareness(1, { 1: { name: 'Yo', color: '#000' }, 2: { name: 'Ana', color: '#f00', viewId: 'v1', selection: ['n1'] }, 3: {}, 4: null });
    const peers = peersOf(aw);
    expect(peers.map(p => p.clientId)).toEqual([2, 3]);
    expect(peers[0]).toMatchObject({ name: 'Ana', color: '#f00', viewId: 'v1', selection: ['n1'] });
    // El nombre por defecto se traduce al idioma activo (el entorno de test puede detectar inglés)
    expect([tIn('es', 'Invitado {n}', { n: 3 }), tIn('en', 'Invitado {n}', { n: 3 })]).toContain(peers[1]!.name);
    expect(peers[1]!.color).toBe(colorFor(3));
  });
  it('remoteSelection solo cuenta a los que están en la misma vista; selectionSignature ignora el cursor', () => {
    const aw = fakeAwareness(1, { 2: { name: 'A', color: '#f00', viewId: 'v1', selection: ['n1', 'n2'], cursor: { x: 1, y: 1 } }, 3: { name: 'B', color: '#0f0', viewId: 'v2', selection: ['n2'] } });
    const peers = peersOf(aw);
    expect([...remoteSelection(peers, 'v1').entries()]).toEqual([['n1', '#f00'], ['n2', '#f00']]);
    expect([...remoteSelection(peers, 'v2').entries()]).toEqual([['n2', '#0f0']]);
    const sig = selectionSignature(peers);
    aw.setLocalStateField('x', 1); // cambio propio: no afecta
    (aw.getStates().get(2) as { cursor: unknown }).cursor = { x: 9, y: 9 };
    expect(selectionSignature(peersOf(aw))).toBe(sig);
  });
  it('throttle emite la primera llamada al momento y la última pendiente al final', () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const t = throttle((n: number) => calls.push(n), 50);
    t(1); t(2); t(3);
    expect(calls).toEqual([1]);
    vi.advanceTimersByTime(50);
    expect(calls).toEqual([1, 3]);
    vi.advanceTimersByTime(50);
    t(4); // ha pasado el intervalo: inmediata
    vi.advanceTimersByTime(10);
    t(5); t.cancel();
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([1, 3, 4]);
    vi.useRealTimers();
  });
  it('initials', () => {
    expect(initials('Ana López')).toBe('AL');
    expect(initials('ana')).toBe('A');
    expect(initials('  ')).toBe('?');
  });
});
