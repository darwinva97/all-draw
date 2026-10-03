// Copias locales de espacios del servidor: último rol conocido en el índice y proveedor creado sin conectar.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { connectRemote, deleteLocalWorkspace, listLocalWorkspaces, localWorkspaceRole, openLocalWorkspace, setLocalWorkspaceRole } from '../src';

describe('rol en caché de las copias locales', () => {
  it('sólo se guarda si la copia existe; sobrevive a los cambios de nombre; se olvida con null y al borrar', async () => {
    const id = `srv_ws_${Math.random().toString(36).slice(2)}`;
    setLocalWorkspaceRole(id, 'editor'); // aún no hay copia: no se crea una entrada falsa
    expect(localWorkspaceRole(id)).toBeNull();
    expect((await listLocalWorkspaces()).some(w => w.id === id)).toBe(false);

    const lw = await openLocalWorkspace(id);
    await lw.whenSynced;
    setLocalWorkspaceRole(id, 'viewer');
    expect(localWorkspaceRole(id)).toBe('viewer');
    lw.store.setMeta({ name: 'Renombrado', updatedAt: new Date().toISOString() });
    lw.destroy(); // vuelca el índice con el nombre nuevo
    expect(localWorkspaceRole(id)).toBe('viewer');
    expect((await listLocalWorkspaces()).find(w => w.id === id)).toMatchObject({ name: 'Renombrado', role: 'viewer' });

    setLocalWorkspaceRole(id, null);
    expect(localWorkspaceRole(id)).toBeNull();
    setLocalWorkspaceRole(id, 'owner');
    await deleteLocalWorkspace(id);
    expect(localWorkspaceRole(id)).toBeNull();
  });
});

describe('connectRemote({ connect: false })', () => {
  it('crea proveedor y awareness sin abrir el WebSocket hasta connect()', () => {
    const opened: string[] = [];
    class FakeWs {
      static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
      readyState = 0; binaryType = 'arraybuffer';
      onopen: (() => void) | null = null; onclose: (() => void) | null = null; onmessage: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(url: string) { opened.push(url); }
      send() {} close() { this.readyState = 3; }
    }
    const c = connectRemote(new Y.Doc(), { url: 'ws://x.invalid/ws', room: 'ws_1', token: 'lnk_a', connect: false, WebSocketPolyfill: FakeWs as unknown as typeof WebSocket });
    expect(opened).toEqual([]);
    expect(c.status()).toBe('disconnected');
    expect(c.awareness).toBeDefined();
    c.connect();
    expect(opened).toHaveLength(1);
    expect(opened[0]).toContain('ws_1?token=lnk_a');
    c.connect(); // ya conectando: no abre otro
    expect(opened).toHaveLength(1);
    c.disconnect();
  });
});
