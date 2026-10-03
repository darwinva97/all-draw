/**
 * Versión y commit del servidor, para `GET /api/status`, la métrica `alldraw_build_info` y la primera línea
 * del log. La versión sale del `package.json` raíz; el commit de `ALLDRAW_COMMIT` (si el despliegue lo
 * inyecta) o de `git rev-parse --short HEAD` al arrancar (el VPS ejecuta desde el checkout del repo).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuildInfo } from '@all-draw/server-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function readVersion(root = ROOT): string {
  try { return String((JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string }).version ?? '0.0.0'); }
  catch { return '0.0.0'; }
}

export function readCommit(env: NodeJS.ProcessEnv = process.env, root = ROOT): string | null {
  const fromEnv = env.ALLDRAW_COMMIT?.trim();
  if (fromEnv) return fromEnv.slice(0, 40);
  try {
    const out = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim();
    return /^[0-9a-f]{4,40}$/.test(out) ? out : null;
  } catch { return null; }
}

let cached: { version: string; commit: string | null } | null = null;
export function buildInfo(db: string, env: NodeJS.ProcessEnv = process.env): BuildInfo {
  cached ??= { version: readVersion(), commit: readCommit(env) };
  return { ...cached, runtime: 'node', db, startedAt: new Date().toISOString() };
}
