/**
 * Rate limit «real» en Cloudflare con el binding de Workers (`[[ratelimits]]` en `wrangler.toml`): a diferencia del
 * `RateLimiter` en memoria de la API (por isolate, orientativo), los contadores los comparte el punto de presencia de
 * Cloudflare. Se aplica **antes** de la API y sólo a lo que interesa a un atacante:
 *
 *   POST /api/auth/login, /api/admin/reset-password, /api/admin/import   → RL_LOGIN    (por IP)
 *   POST /api/auth/register                                            → RL_REGISTER (por IP)
 *   POST /api/workspaces/:id/links                                     → RL_LINKS    (por IP)
 *
 * Los límites (`limit`/`period`, 10 o 60 s) se fijan en `wrangler.toml`. Son por ubicación de Cloudflare y
 * eventualmente consistentes (Cloudflare lo documenta así): frenan la fuerza bruta, no son una contabilidad exacta.
 * Los tres bindings son **opcionales**: sin ellos (o si `limit()` falla) no se limita aquí y siguen valiendo los
 * límites en memoria de la API. Sin `CF-Connecting-IP` (sólo en `wrangler dev` y los tests) tampoco se limita.
 * La respuesta 429 usa los mismos textos y `code` que la API, para que la web los traduzca.
 */
import type { Env } from './env';

type Rule = { binding: 'RL_LOGIN' | 'RL_REGISTER' | 'RL_LINKS'; scope: string; error: string; code: string };

const LOGIN: Omit<Rule, 'scope'> = { binding: 'RL_LOGIN', error: 'Demasiados intentos; espera unos minutos', code: 'too_many_attempts' };

export function rateLimitRule(method: string, pathname: string): Rule | null {
  if (method !== 'POST') return null;
  if (pathname === '/api/auth/login') return { ...LOGIN, scope: 'login' };
  if (pathname === '/api/admin/reset-password' || pathname === '/api/admin/import') return { ...LOGIN, scope: 'admin' };
  if (pathname === '/api/auth/register') return { binding: 'RL_REGISTER', scope: 'register', error: 'Demasiados registros desde esta dirección; espera un rato', code: 'too_many_registrations' };
  if (/^\/api\/workspaces\/[^/]+\/links$/.test(pathname)) return { binding: 'RL_LINKS', scope: 'links', error: 'Demasiados enlaces creados; espera unos minutos', code: 'too_many_links' };
  return null;
}

/** `Response` 429 si la petición supera su límite; `null` si pasa (o no hay binding). */
export async function checkRateLimit(request: Request, pathname: string, env: Env): Promise<Response | null> {
  const rule = rateLimitRule(request.method, pathname);
  if (!rule) return null;
  const limiter = env[rule.binding];
  const ip = request.headers.get('cf-connecting-ip');
  if (!limiter || !ip) return null;
  try {
    const { success } = await limiter.limit({ key: `${rule.scope}:${ip}` });
    if (success) return null;
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'rate limit no disponible', binding: rule.binding, err: String(e) }));
    return null;
  }
  return Response.json({ error: rule.error, code: rule.code }, { status: 429, headers: { 'retry-after': '60' } });
}
