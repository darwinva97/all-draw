/**
 * Copia final de los espacios que se borran junto con la cuenta de su dueño (`DELETE /api/auth/account`):
 * `$BACKUP_DIR/deleted/<fecha>-<workspaceId>.json.gz`, en el mismo formato que `scripts/backup.mjs`
 * (`all-draw-backup/1`), así que `scripts/restore.mjs` la restaura igual. `backup.mjs` las borra pasados
 * `KEEP_DAYS` días, como al resto de copias.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { WorkspaceArchive } from '@all-draw/server-core';

export const DELETED_DIR = 'deleted';

export function archiveWriter(backupDir: string) {
  const dir = path.join(backupDir, DELETED_DIR);
  return async (a: WorkspaceArchive): Promise<void> => {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const stamp = a.exportedAt.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
    const file = path.join(dir, `${stamp}-${a.workspace.id.replace(/[^A-Za-z0-9_.-]/g, '_')}.json.gz`);
    await fs.writeFile(file, gzipSync(JSON.stringify(a)), { mode: 0o600 });
  };
}
