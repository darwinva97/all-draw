/**
 * Importación de cuentas y permisos desde otra instalación (SQLite del servidor Node) al registro del
 * worker (D1 o el `RegistryDO`). Lo usa `POST /api/admin/import` (`src/admin-import.ts`), alimentado por
 * `scripts/migrate-from-sqlite.mjs --target do`.
 *
 * Las filas llegan con los nombres de columna de SQLite (`password_hash`, `owner_id`, …). Se insertan con
 * `INSERT OR IGNORE` (reaplicable sin duplicar) en una sola transacción, en orden de dependencias. Las
 * sesiones y los documentos no van aquí. Los hashes `scrypt$` (no verificables en Workers) se guardan como
 * `reset$scrypt$…`, igual que `scripts/migrate-sql.mjs`.
 */
import type { SqlDriver, SqlStatement } from './sql';

type Col = { name: string; kind: 'text' | 'text?' | 'bool' | 'bool1' };
const t = (name: string): Col => ({ name, kind: 'text' });
const opt = (name: string): Col => ({ name, kind: 'text?' });

/** Tabla destino y columnas de cada grupo del cuerpo, en orden de inserción (claves foráneas). */
export const IMPORT_TABLES = {
  users: { table: 'users', cols: [t('id'), t('email'), t('name'), t('password_hash'), { name: 'is_admin', kind: 'bool' }, t('created_at'), opt('email_verified_at'), opt('locale'), { name: 'notify_email', kind: 'bool1' }] },
  workspaces: { table: 'workspaces', cols: [t('id'), t('owner_id'), t('name'), t('created_at'), t('updated_at')] },
  members: { table: 'workspace_members', cols: [t('workspace_id'), t('user_id'), t('role'), t('created_at')] },
  links: { table: 'share_links', cols: [t('token'), t('workspace_id'), t('role'), t('created_by'), t('created_at'), opt('expires_at')] },
  apiKeys: { table: 'api_keys', cols: [t('id'), t('user_id'), t('name'), t('prefix'), t('key_hash'), t('created_at'), opt('last_used_at')] },
} as const satisfies Record<string, { table: string; cols: Col[] }>;
export type ImportGroup = keyof typeof IMPORT_TABLES;
/** Clave primaria de cada grupo (para el modo `replace`: upsert y borrado de lo que no está en el origen). */
export const IMPORT_KEYS: Record<ImportGroup, readonly string[]> = {
  users: ['id'], workspaces: ['id'], members: ['workspace_id', 'user_id'], links: ['token'], apiKeys: ['id'],
};
export const IMPORT_GROUPS = Object.keys(IMPORT_TABLES) as ImportGroup[];

type ImportValue = string | number | null;
export type ImportRows = Partial<Record<ImportGroup, Record<string, ImportValue>[]>>;
export interface ImportResult {
  inserted: Record<ImportGroup, number>;
  /** Filas que ya existían (mismo id/clave): no se tocan. */
  skipped: Record<ImportGroup, number>;
  /** Usuarios con hash `scrypt$` guardados como `reset$…`: deben restablecer la contraseña. */
  needsReset: { id: string; email: string }[];
}

export const RESET_PREFIX = 'reset$';
const MAX_ROWS = 50_000;

export class ImportError extends Error {}

/** Valida y normaliza el cuerpo de la petición. Lanza `ImportError` con el primer problema. */
export function normalizeImport(body: unknown): ImportRows {
  if (!body || typeof body !== 'object') throw new ImportError('se esperaba un objeto JSON');
  const src = body as Record<string, unknown>;
  const out: ImportRows = {};
  let total = 0;
  for (const group of IMPORT_GROUPS) {
    const rows = src[group];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new ImportError(`${group}: se esperaba un array`);
    total += rows.length;
    if (total > MAX_ROWS) throw new ImportError(`demasiadas filas (máximo ${MAX_ROWS} por petición)`);
    out[group] = rows.map((r, i) => {
      if (!r || typeof r !== 'object') throw new ImportError(`${group}[${i}]: se esperaba un objeto`);
      const row: Record<string, ImportValue> = {};
      for (const c of IMPORT_TABLES[group].cols) {
        const v = (r as Record<string, unknown>)[c.name];
        if (c.kind === 'bool') row[c.name] = v === true || v === 1 || v === '1' ? 1 : 0;
        // Booleano que vale 1 si el origen no lo tiene (columnas añadidas después, como `notify_email`).
        else if (c.kind === 'bool1') row[c.name] = v === false || v === 0 || v === '0' ? 0 : 1;
        else if (c.kind === 'text?' && (v === null || v === undefined)) row[c.name] = null;
        else if (typeof v === 'string' && (c.kind === 'text?' || v.length > 0 || c.name === 'password_hash')) row[c.name] = v;
        else throw new ImportError(`${group}[${i}].${c.name}: se esperaba un texto`);
      }
      if (group === 'users') row.email = String(row.email).trim().toLowerCase();
      if ((group === 'members' || group === 'links') && row.role !== 'editor' && row.role !== 'viewer') throw new ImportError(`${group}[${i}].role: editor o viewer`);
      return row;
    });
  }
  return out;
}

const zero = () => Object.fromEntries(IMPORT_GROUPS.map(g => [g, 0])) as Record<ImportGroup, number>;

/** INSERT de cada fila (`OR IGNORE`, o upsert con `replace`), con `scrypt$` → `reset$scrypt$`. */
function insertStatements(rows: ImportRows, upsert: boolean) {
  const needsReset: ImportResult['needsReset'] = [];
  const statements: SqlStatement[] = [];
  const owner: ImportGroup[] = [];
  for (const group of IMPORT_GROUPS) {
    const { table, cols } = IMPORT_TABLES[group];
    const keys = IMPORT_KEYS[group];
    const names = cols.map(c => c.name);
    const values = `(${names.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const sql = upsert
      ? `INSERT INTO ${table} ${values} ON CONFLICT(${keys.join(', ')}) DO UPDATE SET ${names.filter(n => !keys.includes(n)).map(n => `${n} = excluded.${n}`).join(', ')}`
      : `INSERT OR IGNORE INTO ${table} ${values}`;
    for (const r of rows[group] ?? []) {
      const row = { ...r };
      if (group === 'users' && typeof row.password_hash === 'string' && row.password_hash.startsWith('scrypt$')) {
        row.password_hash = RESET_PREFIX + row.password_hash;
        needsReset.push({ id: String(row.id), email: String(row.email) });
      }
      statements.push({ sql, params: cols.map(c => row[c.name] ?? null) });
      owner.push(group);
    }
  }
  return { statements, owner, needsReset };
}

/** Inserta las filas (ya normalizadas) en una transacción. */
export async function importRows(driver: SqlDriver, rows: ImportRows): Promise<ImportResult> {
  const { statements, owner, needsReset } = insertStatements(rows, false);
  const changes = await driver.batch(statements);
  const inserted = zero(), skipped = zero();
  changes.forEach((n, i) => { if (n > 0) inserted[owner[i]!]++; else skipped[owner[i]!]++; });
  return { inserted, skipped, needsReset };
}

export interface ReplaceResult extends ImportResult {
  /** Filas borradas por no estar en el origen (las sesiones de usuarios borrados caen en cascada). */
  deleted: Record<ImportGroup, number>;
  /** Espacios borrados: el llamador debe vaciar su Durable Object (`DocHost.drop`). */
  removedWorkspaces: string[];
}

/** Clave de una fila como texto (`json_each` no compara tuplas): las claves compuestas se unen con un tabulador. */
const keyOf = (group: ImportGroup, row: Record<string, unknown>) => IMPORT_KEYS[group].map(k => String(row[k])).join('\t');
const keyExpr = (group: ImportGroup) => IMPORT_KEYS[group].join(" || char(9) || ");

/**
 * Modo `replace` (copia de respaldo): deja el registro **idéntico** al origen en una transacción. Borra cuentas,
 * espacios, miembros, enlaces y API keys que no estén en `rows` (en cascada: sesiones, documentos e instantáneas de la
 * tabla) y sobrescribe el resto (upsert). Las claves foráneas se comprueban al final (`defer_foreign_keys`), y los
 * correos de las cuentas que siguen se apartan antes del upsert para que dos cuentas puedan intercambiarlos sin chocar
 * con `UNIQUE`. Las sesiones de las cuentas que siguen se conservan.
 */
export async function replaceRows(driver: SqlDriver, rows: ImportRows): Promise<ReplaceResult> {
  const keep = (g: ImportGroup) => JSON.stringify((rows[g] ?? []).map(r => keyOf(g, r)));
  const removedWorkspaces = (await driver.all<{ id: string }>('SELECT id FROM workspaces WHERE id NOT IN (SELECT value FROM json_each(?)) ORDER BY id', [keep('workspaces')])).map(r => r.id);
  const del = (g: ImportGroup): SqlStatement => ({ sql: `DELETE FROM ${IMPORT_TABLES[g].table} WHERE ${keyExpr(g)} NOT IN (SELECT value FROM json_each(?))`, params: [keep(g)] });
  const order: ImportGroup[] = ['links', 'members', 'apiKeys', 'workspaces', 'users'];
  const pre: SqlStatement[] = [
    { sql: 'PRAGMA defer_foreign_keys = ON', params: [] },
    ...order.map(g => (g === 'users'
      ? [{ sql: 'UPDATE snapshots SET author_id = NULL WHERE author_id IS NOT NULL AND author_id NOT IN (SELECT value FROM json_each(?))', params: [keep('users')] }, del(g)]
      : [del(g)])).flat(),
    { sql: "UPDATE users SET email = id || '@sync.invalid' WHERE id IN (SELECT value FROM json_each(?))", params: [keep('users')] },
  ];
  const { statements, owner, needsReset } = insertStatements(rows, true);
  const changes = await driver.batch([...pre, ...statements]);
  const deleted = zero(), inserted = zero();
  // pre: [pragma, links, members, apiKeys, workspaces, snapshots-autor, users, emails]
  const preChanges = changes.slice(0, pre.length);
  deleted.links = preChanges[1]!; deleted.members = preChanges[2]!; deleted.apiKeys = preChanges[3]!; deleted.workspaces = preChanges[4]!; deleted.users = preChanges[6]!;
  changes.slice(pre.length).forEach((n, i) => { if (n > 0) inserted[owner[i]!]++; });
  return { inserted, skipped: zero(), needsReset, deleted, removedWorkspaces };
}
