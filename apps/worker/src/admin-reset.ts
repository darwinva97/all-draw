/**
 * `POST /api/admin/reset-password`: rescate cuando el único admin no puede entrar (por ejemplo, tras migrar
 * desde Node con un hash `scrypt$`, que Workers no verifica). Sólo existe mientras el secreto `RESET_CODE`
 * está configurado (`wrangler secret put RESET_CODE`); bórralo después (`wrangler secret delete RESET_CODE`).
 * Cuerpo: `{ email, code, password }`. Fija la contraseña nueva (mín. 8) y cierra las sesiones de ese usuario.
 */
import { hashPassword, safeEqualString, type WorkspaceStore } from '@all-draw/server-core';

export const RESET_PATH = '/api/admin/reset-password';
const json = (data: unknown, status = 200) => Response.json(data, { status });
let failures = 0;

export async function handleReset(request: Request, store: WorkspaceStore, resetCode: string | null): Promise<Response> {
  if (!resetCode) return json({ error: 'No disponible' }, 404);
  if (request.method !== 'POST') return json({ error: 'usa POST' }, 405);
  if (failures >= 10) return json({ error: 'Demasiados intentos; vuelve a desplegar o cambia RESET_CODE' }, 429);
  let body: { email?: unknown; code?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'JSON no válido' }, 400); }
  if (typeof body.code !== 'string' || !safeEqualString(body.code, resetCode)) { failures++; return json({ error: 'Código incorrecto' }, 403); }
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length < 8) return json({ error: 'email y password (mín. 8) obligatorios' }, 400);
  const user = await store.getUserByEmail(body.email.trim().toLowerCase());
  if (!user) return json({ error: 'No existe ese usuario' }, 404);
  await store.setPasswordHash(user.id, await hashPassword(body.password));
  await store.deleteUserSessions(user.id);
  return json({ ok: true, email: user.email });
}
