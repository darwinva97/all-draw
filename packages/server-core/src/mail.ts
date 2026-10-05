/**
 * Correo saliente, agnóstico del proveedor y del runtime. La API sólo conoce `Mailer.send({ to, subject, text, html })`.
 *
 * Implementaciones (`MAIL_PROVIDER`):
 *   - `none`: no hay correo (por defecto en producción). `GET /api/auth/config` anuncia `email: false` y la recuperación
 *     de contraseña y la verificación del correo quedan apagadas.
 *   - `log`: no envía nada; escribe el mensaje entero en el log (por defecto en desarrollo y en las pruebas e2e, que leen
 *     de ahí los enlaces). Nunca en producción: los enlaces de restablecimiento quedarían en el log.
 *   - `http`: API HTTP tipo Resend, Postmark o Mailgun (`MAIL_HTTP_URL`, `MAIL_HTTP_TOKEN`, `MAIL_HTTP_FORMAT`). Es la
 *     única real en Cloudflare Workers (no hay sockets TCP salientes de uso general).
 *   - `smtp`: sólo en Node (`apps/server/src/smtp.ts`, cliente propio con STARTTLS y AUTH PLAIN/LOGIN).
 *
 * Sin dependencias de Node: `fetch` y nada más.
 */
import type { Logger } from './log';

export interface MailMessage { to: string; subject: string; text: string; html: string }
export interface Mailer {
  /** `none`, `log`, `http`, `smtp`. */
  readonly kind: string;
  /** ¿Hay correo? (`log` cuenta como sí: el flujo completo funciona y el enlace queda en el log). */
  readonly enabled: boolean;
  /** Lanza si el proveedor rechaza el mensaje. */
  send(m: MailMessage): Promise<void>;
}

export const noneMailer: Mailer = { kind: 'none', enabled: false, async send() { throw new Error('correo desactivado (MAIL_PROVIDER=none)'); } };

/** Escribe el mensaje en el log (nivel info, `msg: "correo"`). Para desarrollo y pruebas. */
export function logMailer(logger: Logger, from = DEFAULT_FROM): Mailer {
  return {
    kind: 'log', enabled: true,
    async send(m) { logger.info('correo', { provider: 'log', from, to: m.to, subject: m.subject, text: m.text }); },
  };
}

/** Formatos de cuerpo de `MAIL_HTTP_FORMAT`. `json` usa `MAIL_HTTP_TEMPLATE`. */
export type HttpMailFormat = 'resend' | 'postmark' | 'mailgun' | 'json';
export interface HttpMailerOptions {
  url: string;
  token: string;
  from: string;
  format?: HttpMailFormat;
  /**
   * Con `format: 'json'`: plantilla JSON del cuerpo; cada texto `{{from}}`, `{{to}}`, `{{subject}}`, `{{text}}`, `{{html}}`
   * se sustituye por el valor (escapado como JSON). P. ej. Brevo: `{"sender":{"email":"{{from}}"},"to":[{"email":"{{to}}"}],"subject":"{{subject}}","textContent":"{{text}}","htmlContent":"{{html}}"}`.
   */
  template?: string;
  /** Cabecera del token: por defecto `Authorization: Bearer <token>` (Postmark: `X-Postmark-Server-Token`; Mailgun: Basic `api:<token>`). */
  authHeader?: string;
  fetch?: typeof fetch;
  /** Milisegundos antes de abandonar la petición (15 s). */
  timeoutMs?: number;
}

/** Sustituye `{{campo}}` en todos los textos de un valor JSON ya parseado (sin tocar las claves). */
export function fillTemplate(tpl: unknown, vars: Record<string, string>): unknown {
  if (typeof tpl === 'string') return tpl.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
  if (Array.isArray(tpl)) return tpl.map(x => fillTemplate(x, vars));
  if (tpl && typeof tpl === 'object') return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, fillTemplate(v, vars)]));
  return tpl;
}

/** Petición HTTP que corresponde a un mensaje en cada formato (separada para poder probarla). */
export function httpMailRequest(o: HttpMailerOptions, m: MailMessage): { headers: Record<string, string>; body: string } {
  const format = o.format ?? 'resend';
  const vars = { from: o.from, to: m.to, subject: m.subject, text: m.text, html: m.html };
  if (format === 'mailgun') {
    const body = new URLSearchParams(vars).toString();
    return { headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${btoa(`api:${o.token}`)}` }, body };
  }
  const auth: Record<string, string> = o.authHeader && o.authHeader.toLowerCase() !== 'authorization'
    ? { [o.authHeader]: o.token }
    : format === 'postmark' && !o.authHeader ? { 'x-postmark-server-token': o.token } : { authorization: `Bearer ${o.token}` };
  const json = format === 'postmark' ? { From: o.from, To: m.to, Subject: m.subject, TextBody: m.text, HtmlBody: m.html, MessageStream: 'outbound' }
    : format === 'json' ? fillTemplate(JSON.parse(o.template ?? '{}'), vars)
    : { from: o.from, to: [m.to], subject: m.subject, text: m.text, html: m.html };
  return { headers: { 'content-type': 'application/json', accept: 'application/json', ...auth }, body: JSON.stringify(json) };
}

export function httpMailer(o: HttpMailerOptions): Mailer {
  const doFetch = o.fetch ?? globalThis.fetch.bind(globalThis);
  if (o.format === 'json') JSON.parse(o.template ?? ''); // mejor fallar al arrancar que al primer correo
  return {
    kind: 'http', enabled: true,
    async send(m) {
      const { headers, body } = httpMailRequest(o, m);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 15_000);
      try {
        const r = await doFetch(o.url, { method: 'POST', headers, body, signal: ctl.signal });
        if (!r.ok) throw new Error(`proveedor de correo: HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
      } finally { clearTimeout(timer); }
    },
  };
}

export const DEFAULT_FROM = 'all-draw <no-reply@localhost>';
export type MailProvider = 'none' | 'log' | 'http' | 'smtp';
/** Variables de entorno del correo (las mismas en Node y en el worker; `SMTP_*` sólo en Node). */
export interface MailEnv {
  MAIL_PROVIDER?: string; MAIL_FROM?: string;
  MAIL_HTTP_URL?: string; MAIL_HTTP_TOKEN?: string; MAIL_HTTP_FORMAT?: string; MAIL_HTTP_TEMPLATE?: string; MAIL_HTTP_AUTH_HEADER?: string;
  SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASS?: string; SMTP_SECURE?: string;
}
export interface SmtpSettings { host: string; port: number; secure: boolean; user: string | null; pass: string | null; from: string }

/**
 * Elige el proveedor según `MAIL_PROVIDER` (o el de por defecto: `log` en desarrollo, `none` en producción) y comprueba
 * que estén las variables que necesita. Lanza con un mensaje claro si falta algo: mejor no arrancar que creer que hay
 * correo. `smtp` lo construye el runtime (`makeSmtp`); si no lo da (worker), `smtp` no se admite.
 */
export function mailerFromEnv(env: MailEnv, opts: { logger: Logger; production: boolean; makeSmtp?: (s: SmtpSettings) => Mailer; fetch?: typeof fetch }): Mailer {
  const raw = (env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  const provider = (raw || (opts.production ? 'none' : 'log')) as MailProvider;
  const from = env.MAIL_FROM?.trim() || '';
  switch (provider) {
    case 'none': return noneMailer;
    case 'log': return logMailer(opts.logger, from || DEFAULT_FROM);
    case 'http': {
      if (!env.MAIL_HTTP_URL || !env.MAIL_HTTP_TOKEN) throw new Error('MAIL_PROVIDER=http necesita MAIL_HTTP_URL y MAIL_HTTP_TOKEN');
      if (!from) throw new Error('MAIL_PROVIDER=http necesita MAIL_FROM (p. ej. "all-draw <no-reply@tu-dominio>")');
      const format = (env.MAIL_HTTP_FORMAT?.trim().toLowerCase() || 'resend') as HttpMailFormat;
      if (!['resend', 'postmark', 'mailgun', 'json'].includes(format)) throw new Error(`MAIL_HTTP_FORMAT: «${env.MAIL_HTTP_FORMAT}» no es resend, postmark, mailgun ni json`);
      if (format === 'json' && !env.MAIL_HTTP_TEMPLATE) throw new Error('MAIL_HTTP_FORMAT=json necesita MAIL_HTTP_TEMPLATE');
      try {
        return httpMailer({ url: env.MAIL_HTTP_URL, token: env.MAIL_HTTP_TOKEN, from, format, ...(env.MAIL_HTTP_TEMPLATE ? { template: env.MAIL_HTTP_TEMPLATE } : {}), ...(env.MAIL_HTTP_AUTH_HEADER ? { authHeader: env.MAIL_HTTP_AUTH_HEADER } : {}), ...(opts.fetch ? { fetch: opts.fetch } : {}) });
      } catch { throw new Error('MAIL_HTTP_TEMPLATE no es JSON válido'); }
    }
    case 'smtp': {
      if (!opts.makeSmtp) throw new Error('MAIL_PROVIDER=smtp no está disponible en este runtime (en Cloudflare usa MAIL_PROVIDER=http)');
      if (!env.SMTP_HOST) throw new Error('MAIL_PROVIDER=smtp necesita SMTP_HOST');
      if (!from) throw new Error('MAIL_PROVIDER=smtp necesita MAIL_FROM (p. ej. "all-draw <no-reply@tu-dominio>")');
      const secure = env.SMTP_SECURE === 'true';
      const port = Number(env.SMTP_PORT || (secure ? 465 : 587));
      if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`SMTP_PORT: «${env.SMTP_PORT}» no es un puerto`);
      if (!!env.SMTP_USER !== !!env.SMTP_PASS) throw new Error('SMTP_USER y SMTP_PASS van juntos');
      return opts.makeSmtp({ host: env.SMTP_HOST, port, secure, user: env.SMTP_USER || null, pass: env.SMTP_PASS || null, from });
    }
    default: throw new Error(`MAIL_PROVIDER: «${env.MAIL_PROVIDER}» no es none, log, http ni smtp`);
  }
}

/** Dirección pura de un `Nombre <correo>` (para el sobre SMTP). */
export const addressOf = (from: string): string => /<([^>]+)>/.exec(from)?.[1]?.trim() ?? from.trim();
