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

/**
 * Lee un fichero de cualquier formato importable (Drawer, Archi, BPMN, Structurizr, Mermaid, XState, OpenAPI, JSON de
 * all-draw) y avisa de lo que no tiene equivalente exacto. Lo usan el inicio y la portada.
 */
export async function importWorkspaceFile(f: File, t: (k: string, v?: Record<string, string | number>) => string): Promise<Workspace> {
  const [{ importFile }, { formatLabel }, { createRegistry }, { toast, noticeDialog }, { tn }] = await Promise.all([import('./io-text'), import('@all-draw/io'), import('./registry'), import('@all-draw/editor'), import('@all-draw/i18n')]);
  // Mismo camino que el inicio: binarios (Visio), draw.io comprimido, DSL con layout automático.
  const { workspace, warnings, format: fmt } = await importFile(f, createRegistry());
  const format = t(formatLabel(fmt));
  if (warnings.length) {
    toast.warning(tn('Importado desde {format} con {n} aviso', 'Importado desde {format} con {n} avisos', warnings.length, { format }), {
      description: f.name, action: { label: t('Ver avisos'), onClick: () => void noticeDialog({ title: t('Avisos de la importación'), message: t('El fichero se importó, pero algunas partes no tienen equivalente exacto.'), items: warnings }) },
    });
  } else toast.success(t('Importado desde {format}', { format }), { description: f.name });
  return workspace;
}

/** Formatos que aceptan los selectores de fichero de importar. */
export { IMPORT_FILE_ACCEPT as IMPORT_ACCEPT } from './io-text';

