/** Crear espacios desde la portada y el inicio (local en IndexedDB o en el servidor). */
import { loadInto, newId, type Workspace } from '@all-draw/core';
import { openLocalWorkspace } from '@all-draw/sync';
import { api } from './api';

/** Crea un espacio local con el contenido dado y devuelve su id (`#/w/<id>`). */
export async function createLocalWorkspace(ws: Workspace): Promise<string> {
  const id = newId('ws');
  const lw = await openLocalWorkspace(id);
  await lw.whenSynced;
  loadInto(lw.store, ws);
  lw.destroy();
  return id;
}

/** Crea un espacio en el servidor y devuelve su id (`#/s/<id>`). */
export async function createServerWorkspace(ws: Workspace): Promise<string> {
  const w = await api.createWorkspace(ws.meta.name, ws);
  return w.id;
}
