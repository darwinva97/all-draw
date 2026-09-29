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

type Col = { name: string; kind: 'text' | 'text?' | 'bool' };
const t = (name: string): Col => ({ name, kind: 'text' });
const opt = (name: string): Col => ({ name, kind: 'text?' });

/** Tabla destino y columnas de cada grupo del cuerpo, en orden de inserción (claves foráneas). */
export const IMPORT_TABLES = {
  users: { table: 'users', cols: [t('id'), t('email'), t('name'), t('password_hash'), { name: 'is_admin', kind: 'bool' }, t('created_at')] },
  workspaces: { table: 'workspaces', cols: [t('id'), t('owner_id'), t('name'), t('created_at'), t('updated_at')] },
  members: { table: 'workspace_members', cols: [t('workspace_id'), t('user_id'), t('role'), t('created_at')] },
  links: { table: 'share_links', cols: [t('token'), t('workspace_id'), t('role'), t('created_by'), t('created_at'), opt('expires_at')] },
  apiKeys: { table: 'api_keys', cols: [t('id'), t('user_id'), t('name'), t('prefix'), t('key_hash'), t('created_at'), opt('last_used_at')] },
} as const satisfies Record<string, { table: string; cols: Col[] }>;
export type ImportGroup = keyof typeof IMPORT_TABLES;
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

/** Inserta las filas (ya normalizadas) en una transacción. */
export async function importRows(driver: SqlDriver, rows: ImportRows): Promise<ImportResult> {
  const needsReset: ImportResult['needsReset'] = [];
  const statements: SqlStatement[] = [];
  const owner: ImportGroup[] = [];
  for (const group of IMPORT_GROUPS) {
    const { table, cols } = IMPORT_TABLES[group];
    const sql = `INSERT OR IGNORE INTO ${table} (${cols.map(c => c.name).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
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
  const changes = await driver.batch(statements);
  const zero = () => Object.fromEntries(IMPORT_GROUPS.map(g => [g, 0])) as Record<ImportGroup, number>;
  const inserted = zero(), skipped = zero();
  changes.forEach((n, i) => { if (n > 0) inserted[owner[i]!]++; else skipped[owner[i]!]++; });
  return { inserted, skipped, needsReset };
}
