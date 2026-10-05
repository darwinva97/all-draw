/**
 * Cabeceras de seguridad para todas las respuestas (estáticos de la SPA y API), iguales en Node y en el worker.
 *
 * La CSP está pensada para la SPA compilada con Vite: scripts sólo del propio origen (el registro del service
 * worker va en `/registerSW.js`, no inline), estilos propios más `'unsafe-inline'` (React Flow y el editor
 * ponen estilos en línea), imágenes `data:`/`blob:` (iconos SVG en `data:`, exportación PNG/SVG por `blob:`) y
 * `https:` (el nodo visual «imagen» acepta una URL externa: sin esto el navegador la bloquea; una imagen no ejecuta
 * código y `connect-src` sigue cerrado al propio origen, ver docs/07-seguridad.md), conexiones al propio origen
 * incluido el WebSocket de sincronización.
 */
export interface SecurityHeaderOpts {
  /** La petición llegó por https (directo o `x-forwarded-proto`): añade HSTS. */
  https: boolean;
  /** Host público (para `connect-src` del WebSocket en navegadores que no cuentan ws(s) como `'self'`). */
  host?: string | null;
  /**
   * Rutas de inserción (`/embed/*`): otras webs pueden incrustarlas (`frame-ancestors *`, sin `X-Frame-Options`,
   * `Cross-Origin-Resource-Policy: cross-origin`), con su propia CSP mínima y sin `Referer` (el token va en la URL).
   */
  embed?: boolean;
}

/** Nonce por respuesta: Cloudflare (y otros proxies) lo copian a los scripts que inyectan (detección de bots), que si no violarían la CSP. */
export function cspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function contentSecurityPolicy(host?: string | null, nonce?: string): string {
  const ws = host ? ` ws://${host} wss://${host}` : ' ws: wss:';
  return [
    "default-src 'self'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
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

/**
 * CSP de las páginas de inserción (`/embed/*`): sin nada externo salvo imágenes `https:` (nodos «imagen»), el único script
 * es el propio con `nonce`, `fetch` sólo al propio origen (sondeo del SVG) y se deja incrustar desde cualquier web.
 */
export function embedContentSecurityPolicy(nonce?: string): string {
  return [
    "default-src 'none'",
    `script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}`,
    "style-src 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    'frame-ancestors *',
  ].join('; ');
}

export function securityHeaders({ https, host, embed }: SecurityHeaderOpts): Record<string, string> {
  if (embed) {
    const e: Record<string, string> = {
      'content-security-policy': embedContentSecurityPolicy(),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'cross-origin-resource-policy': 'cross-origin',
    };
    if (https) e['strict-transport-security'] = 'max-age=15552000; includeSubDomains';
    return e;
  }
  const h: Record<string, string> = {
    'content-security-policy': contentSecurityPolicy(host, cspNonce()),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'x-frame-options': 'SAMEORIGIN',
    // Aísla la ventana de otras (sin `window.opener` cruzado) y prohíbe que otras webs incrusten nuestros
    // recursos por `no-cors`. La única excepción es el SVG de una vista, que la API marca `cross-origin`.
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
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

/** Ruta de `security.txt` (RFC 9116). */
export const SECURITY_TXT_PATH = '/.well-known/security.txt';
/** Dónde informar de vulnerabilidades (avisos privados de GitHub). */
export const SECURITY_CONTACT = 'https://github.com/darwinva97/all-draw/security';

/** `security.txt` con caducidad a un año vista (se genera en cada petición, así nunca caduca). */
export function securityTxt(baseUrl?: string | null, now = new Date()): string {
  const expires = new Date(now.getTime() + 365 * 86_400_000);
  expires.setUTCHours(0, 0, 0, 0);
  return [
    `Contact: ${SECURITY_CONTACT}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: es, en',
    ...(baseUrl ? [`Canonical: ${baseUrl.replace(/\/$/, '')}${SECURITY_TXT_PATH}`] : []),
    '',
  ].join('\n');
}

export function securityTxtResponse(baseUrl?: string | null): Response {
  return new Response(securityTxt(baseUrl), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
