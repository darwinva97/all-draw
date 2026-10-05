/**
 * Avisos push por https://ntfy.sh (tema privado). El tema es un secreto: se lee de `NTFY_TOPIC` o del fichero
 * `NTFY_TOPIC_FILE` (por defecto `~/.config/alldraw/ntfy-topic`) y nunca se escribe en el log. `NTFY_URL` cambia el
 * servidor (por defecto `https://ntfy.sh`). Sin tema configurado no hace nada (devuelve `false`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function ntfyTopic(env = process.env) {
  if (env.NTFY_TOPIC) return env.NTFY_TOPIC.trim();
  const file = env.NTFY_TOPIC_FILE ?? path.join(os.homedir(), '.config', 'alldraw', 'ntfy-topic');
  try { return fs.readFileSync(file, 'utf8').trim() || null; } catch { return null; }
}

/** Manda un aviso. No lanza: si ntfy falla, lo dice por stderr (sin el tema) y devuelve `false`. */
export async function notify({ title, message, priority = 4, tags = ['warning'] }, env = process.env) {
  const topic = ntfyTopic(env);
  if (!topic) return false;
  const base = (env.NTFY_URL ?? 'https://ntfy.sh').replace(/\/$/, '');
  try {
    // Publicación JSON (admite UTF-8 en el título, a diferencia de las cabeceras). Prioridad 1-5 (4 = alta).
    const res = await fetch(base, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority, tags }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.error(`[ntfy] HTTP ${res.status}`); return false; }
    return true;
  } catch (e) {
    console.error(`[ntfy] no se pudo avisar: ${e?.cause?.code ?? e?.name ?? e}`);
    return false;
  }
}
