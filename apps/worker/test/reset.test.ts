import { describe, it, expect } from 'vitest';
import { handleReset } from '../src/admin-reset';
import { MemoryWorkspaceStore, verifyPassword, hashPassword } from '@all-draw/server-core';

const req = (body: unknown) => new Request('https://x/api/admin/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('rescate de contraseña', () => {
  it('sólo con RESET_CODE; código correcto fija la contraseña', async () => {
    const store = new MemoryWorkspaceStore();
    const u = await store.createUser({ email: 'a@b.c', name: 'a', passwordHash: 'reset$scrypt$x', isAdmin: true });
    expect((await handleReset(req({}), store, null)).status).toBe(404);
    expect((await handleReset(req({ email: 'a@b.c', code: 'mal', password: 'contraseña-nueva' }), store, 'bien')).status).toBe(403);
    expect((await handleReset(req({ email: 'a@b.c', code: 'bien', password: 'corta' }), store, 'bien')).status).toBe(400);
    expect((await handleReset(req({ email: 'a@b.c', code: 'bien', password: 'contraseña-nueva' }), store, 'bien')).status).toBe(200);
    const after = await store.getUser(u.id);
    expect(await verifyPassword('contraseña-nueva', (after as { passwordHash: string }).passwordHash)).toBe(true);
    void hashPassword;
  });
});
