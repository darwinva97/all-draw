/**
 * Migración de la persistencia antigua (`$DATA_DIR/<id>.yupdate`, una sala por fichero, sin dueño).
 * Cada fichero sin fila en `workspaces` se importa como espacio del usuario `legacy@alldraw.local`
 * (sin contraseña: nadie puede entrar con él). Un admin lo transfiere con
 * `PATCH /api/workspaces/:id {ownerId}`. El fichero original no se toca.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as Y from 'yjs';
import { LEGACY_EMAIL, type WorkspaceStore } from '@all-draw/server-core';

export { LEGACY_EMAIL };

export async function importLegacyFiles(store: WorkspaceStore, dataDir: string): Promise<string[]> {
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.yupdate'));
  const imported: string[] = [];
  let legacy = await store.getUserByEmail(LEGACY_EMAIL);
  for (const f of files) {
    const id = f.slice(0, -'.yupdate'.length);
    if (await store.getWorkspace(id)) continue;
    let update: Uint8Array;
    try { update = new Uint8Array(fs.readFileSync(path.join(dataDir, f))); } catch (e) { console.error('legacy: no se pudo leer', f, e); continue; }
    let name = id;
    try { const d = new Y.Doc(); Y.applyUpdate(d, update); name = String(d.getMap('meta').get('name') ?? id); d.destroy(); } catch { /* nombre por defecto */ }
    legacy ??= await store.createUser({ email: LEGACY_EMAIL, name: 'Espacios heredados', passwordHash: '' });
    await store.createWorkspace({ id, ownerId: legacy.id, name });
    await store.saveDoc(id, update);
    imported.push(id);
  }
  if (imported.length) console.log(`legacy: importados ${imported.length} espacios (${imported.join(', ')}) → dueño ${LEGACY_EMAIL}`);
  return imported;
}
