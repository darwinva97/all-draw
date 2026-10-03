/**
 * `POST /api/admin/import`: carga cuentas, espacios, miembros, enlaces y API keys de otra instalación
 * (filas de SQLite, ver `store/import.ts`) y, opcionalmente, el contenido de los espacios (`docs`).
 * Lo alimenta `scripts/migrate-from-sqlite.mjs --target do`. Sólo existe en el worker.
 *
 * Autorización (una de las dos):
 *   - `Authorization: Bearer <sesión o API key de un admin>` (con cookie de sesión, además, mismo origen);
 *   - `X-Import-Secret: <IMPORT_SECRET>` (`wrangler secret put IMPORT_SECRET`), **sólo mientras el registro
 *     no tenga usuarios**: sirve para la primera carga, cuando aún no hay ningún admin.
 *
 * Cuerpo: `{ users?, workspaces?, members?, links?, apiKeys?, docs?: [{ id, workspace }] }`. Las filas se
 * insertan con `INSERT OR IGNORE` en una transacción (todo o nada); los `docs` después, uno a uno (como
 * `PUT /api/workspaces/:id/snapshot`), sólo para espacios que existan. Respuesta: `{ inserted, skipped,
 * needsReset, docs: { imported, failed } }`.
 */
import type { Workspace } from '@all-draw/core';
import { CommandError, credentialsFromRequest, isTrustedOrigin, resolveToken, safeEqualString, type DocHost, type Hasher, type WorkspaceStore } from '@all-draw/server-core';
import { ImportError, normalizeImport, type ImportResult, type ImportRows } from './store/import';

export const IMPORT_PATH = '/api/admin/import';
export const IMPORT_SECRET_HEADER = 'x-import-secret';
/** Cuentas + documentos en una sola petición; el límite de Workers es 100 MB. */
export const MAX_IMPORT_BYTES = 64 * 1024 * 1024;

export interface ImportDeps {
  store: WorkspaceStore & { importRows(rows: ImportRows): Promise<ImportResult> };
  hash: Hasher;
  docs: DocHost;
  importSecret: string | null;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function authorize(request: Request, deps: ImportDeps): Promise<Response | null> {
  const url = new URL(request.url);
  const secret = request.headers.get(IMPORT_SECRET_HEADER);
  if (secret !== null) {
    if (!deps.importSecret || !safeEqualString(secret, deps.importSecret)) return json({ error: 'X-Import-Secret no válido' }, 403);
    if ((await deps.store.countUsers()) > 0) return json({ error: 'X-Import-Secret sólo vale con el registro vacío; usa un token de admin' }, 403);
    return null;
  }
  const cred = credentialsFromRequest(request.headers, url);
  if (cred.source === 'cookie' && !isTrustedOrigin(request.headers, url)) return json({ error: 'Petición con cookie desde otro origen rechazada (CSRF)' }, 403);
  const p = await resolveToken(deps, cred.token);
  if (!p) return json({ error: 'Identifícate: Authorization: Bearer <token de admin> o X-Import-Secret' }, 401);
  if (p.kind !== 'user' || !p.user.isAdmin) return json({ error: 'Solo administradores' }, 403);
  return null;
}

export async function handleImport(request: Request, deps: ImportDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'usa POST' }, 405);
  const denied = await authorize(request, deps);
  if (denied) return denied;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMPORT_BYTES) return json({ error: 'Cuerpo demasiado grande' }, 413);
  const text = await request.text();
  if (text.length > MAX_IMPORT_BYTES) return json({ error: 'Cuerpo demasiado grande' }, 413);

  let body: Record<string, unknown>;
  let rows: ImportRows;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
    rows = normalizeImport(body);
  } catch (e) {
    return json({ error: e instanceof ImportError ? e.message : 'JSON no válido' }, 400);
  }
  const docs = body.docs === undefined ? [] : body.docs;
  if (!Array.isArray(docs) || docs.some(d => !d || typeof d !== 'object' || typeof (d as { id?: unknown }).id !== 'string' || typeof (d as { workspace?: unknown }).workspace !== 'object')) {
    return json({ error: 'docs: se esperaba [{ id, workspace }]' }, 400);
  }

  let result: ImportResult;
  try { result = await deps.store.importRows(rows); }
  catch (e) { return json({ error: `importación rechazada (no se ha escrito nada): ${e instanceof Error ? e.message : String(e)}` }, 400); }

  const imported: string[] = [], failed: { id: string; error: string }[] = [];
  for (const { id, workspace } of docs as { id: string; workspace: Workspace }[]) {
    try {
      if (!(await deps.store.getWorkspace(id))) throw new Error('el espacio no existe en el registro');
      await deps.docs.replace(id, workspace);
      if (workspace.meta?.name) await deps.store.updateMeta(id, { name: workspace.meta.name });
      imported.push(id);
    } catch (e) {
      failed.push({ id, error: e instanceof CommandError ? `${e.message}${e.issues ? ` ${JSON.stringify(e.issues).slice(0, 500)}` : ''}` : e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ ...result, docs: { imported, failed } });
}
