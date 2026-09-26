/**
 * Cabeceras de seguridad para todas las respuestas (estáticos de la SPA y API), iguales en Node y en el worker.
 *
 * La CSP está pensada para la SPA compilada con Vite: scripts sólo del propio origen (el registro del service
 * worker va en `/registerSW.js`, no inline), estilos propios más `'unsafe-inline'` (React Flow y el editor
 * ponen estilos en línea), imágenes `data:`/`blob:` (iconos SVG en `data:`, exportación PNG/SVG por `blob:`),
 * conexiones al propio origen incluido el WebSocket de sincronización.
 */
export interface SecurityHeaderOpts {
  /** La petición llegó por https (directo o `x-forwarded-proto`): añade HSTS. */
  https: boolean;
  /** Host público (para `connect-src` del WebSocket en navegadores que no cuentan ws(s) como `'self'`). */
  host?: string | null;
}

export function contentSecurityPolicy(host?: string | null): string {
  const ws = host ? ` ws://${host} wss://${host}` : ' ws: wss:';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${ws}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export function securityHeaders({ https, host }: SecurityHeaderOpts): Record<string, string> {
  const h: Record<string, string> = {
    'content-security-policy': contentSecurityPolicy(host),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'x-frame-options': 'SAMEORIGIN',
  };
  if (https) h['strict-transport-security'] = 'max-age=15552000; includeSubDomains';
  return h;
}

/** Añade las cabeceras a una `Response` (Fetch API) sin tocar las que ya traiga. */
export function withSecurityHeaders(res: Response, opts: SecurityHeaderOpts): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(securityHeaders(opts))) if (!out.headers.has(k)) out.headers.set(k, v);
  return out;
}
