/**
 * Cliente SMTP mínimo sobre `node:net` / `node:tls`, sin dependencias: lo justo para mandar los correos de cuenta.
 *
 *   - TLS directo (`SMTP_SECURE=true`, puerto 465) o texto plano con **STARTTLS** obligatorio si el servidor lo anuncia
 *     (puerto 587). Sin STARTTLS anunciado sólo se sigue sin cifrar contra `localhost` (un relé local); si no, error.
 *   - Autenticación `AUTH PLAIN` o `AUTH LOGIN` (la que anuncie el servidor) con `SMTP_USER` / `SMTP_PASS`, sólo cifrado
 *     (o contra localhost).
 *   - Mensaje MIME `multipart/alternative` (texto + HTML) en UTF-8 y base64; asunto codificado (RFC 2047).
 *   - Una conexión por mensaje (son pocos y esporádicos), con timeout.
 */
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { addressOf, type MailMessage, type Mailer, type SmtpSettings } from '@all-draw/server-core';

export interface SmtpOptions extends SmtpSettings {
  /** Milisegundos máximos por conversación (30 s). */
  timeoutMs?: number;
  /** Opciones extra de TLS (los tests pasan `ca` o `rejectUnauthorized: false` con un certificado propio). */
  tls?: tls.ConnectionOptions;
  /** Nombre que se anuncia en `EHLO` (por defecto el del servidor de `MAIL_FROM` o `localhost`). */
  clientName?: string;
}

class SmtpError extends Error {}

/** Lector de respuestas SMTP (líneas `250-…` hasta `250 …`) sobre un socket que se puede cambiar (STARTTLS). */
class Conversation {
  private buf = '';
  private waiters: ((r: { code: number; lines: string[] } | Error) => void)[] = [];
  private pending: { code: number; lines: string[] }[] = [];
  private lines: string[] = [];
  private failed: Error | null = null;
  constructor(public socket: net.Socket | tls.TLSSocket) { this.listen(socket); }

  listen(s: net.Socket | tls.TLSSocket) {
    this.socket = s;
    s.setEncoding('utf8');
    s.on('data', (d: string) => this.onData(d));
    s.on('error', e => this.fail(e));
    s.on('close', () => this.fail(new SmtpError('el servidor SMTP cerró la conexión')));
  }
  /** Deja de escuchar el socket actual (antes de envolverlo en TLS). */
  detach() { this.socket.removeAllListeners('data'); this.socket.removeAllListeners('error'); this.socket.removeAllListeners('close'); }

  private fail(e: Error) {
    if (this.failed) return;
    this.failed = e;
    for (const w of this.waiters.splice(0)) w(e);
  }
  private onData(d: string) {
    this.buf += d;
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      const m = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!m) continue;
      this.lines.push(m[3]!);
      if (m[2] === ' ') {
        const r = { code: Number(m[1]), lines: this.lines };
        this.lines = [];
        const w = this.waiters.shift();
        if (w) w(r); else this.pending.push(r);
      }
    }
  }
  read(): Promise<{ code: number; lines: string[] }> {
    const p = this.pending.shift();
    if (p) return Promise.resolve(p);
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((res, rej) => this.waiters.push(r => (r instanceof Error ? rej(r) : res(r))));
  }
  async cmd(line: string | null, expect: number[], what = line?.split(' ')[0] ?? 'saludo'): Promise<{ code: number; lines: string[] }> {
    if (line !== null) this.socket.write(`${line}\r\n`);
    const r = await this.read();
    if (!expect.includes(r.code)) throw new SmtpError(`SMTP ${what}: ${r.code} ${r.lines.join(' ').slice(0, 200)}`);
    return r;
  }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s: string) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
/** `=?UTF-8?B?…?=` si hace falta (asuntos con acentos). */
export const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
/** `Nombre <correo>` con el nombre codificado si lleva acentos. */
const encodeAddress = (from: string) => {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m && m[1] ? `${encodeHeader(m[1])} <${m[2]}>` : from.trim();
};
const LINE = /[\r\n]/;

/** Mensaje RFC 5322 completo (cabeceras + MIME), con CRLF. */
export function buildMime(from: string, m: MailMessage, now = new Date()): string {
  if (LINE.test(m.to) || LINE.test(m.subject) || LINE.test(from)) throw new SmtpError('cabecera con salto de línea');
  const boundary = `=_alldraw_${randomBytes(12).toString('hex')}`;
  const domain = addressOf(from).split('@')[1] ?? 'localhost';
  return [
    `From: ${encodeAddress(from)}`, `To: ${m.to}`, `Subject: ${encodeHeader(m.subject)}`, `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`, 'MIME-Version: 1.0', 'Auto-Submitted: auto-generated',
    `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.text)),
    `--${boundary}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.html)),
    `--${boundary}--`, '',
  ].join('\r\n');
}

const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '::1';

export async function sendSmtp(o: SmtpOptions, m: MailMessage): Promise<void> {
  const timeoutMs = o.timeoutMs ?? 30_000;
  const tlsOpts = { servername: net.isIP(o.host) ? undefined : o.host, ...o.tls };
  const socket = o.secure ? tls.connect({ host: o.host, port: o.port, ...tlsOpts }) : net.connect({ host: o.host, port: o.port });
  socket.setTimeout(timeoutMs, () => socket.destroy(new SmtpError(`SMTP: sin respuesta en ${timeoutMs} ms`)));
  const conv = new Conversation(socket);
  let encrypted = o.secure;
  const name = o.clientName ?? (addressOf(o.from).split('@')[1] || 'localhost');
  try {
    await conv.cmd(null, [220]);
    let ehlo = await conv.cmd(`EHLO ${name}`, [250]);
    const has = (ext: string) => ehlo.lines.some(l => l.toUpperCase().startsWith(ext));
    if (!encrypted) {
      if (has('STARTTLS')) {
        await conv.cmd('STARTTLS', [220]);
        conv.detach();
        const raw = conv.socket;
        const secure = tls.connect({ socket: raw, ...tlsOpts });
        await new Promise<void>((res, rej) => { secure.once('secureConnect', () => res()); secure.once('error', rej); });
        secure.setTimeout(timeoutMs, () => secure.destroy(new SmtpError(`SMTP: sin respuesta en ${timeoutMs} ms`)));
        conv.listen(secure);
        encrypted = true;
        ehlo = await conv.cmd(`EHLO ${name}`, [250]);
      } else if (!isLocal(o.host)) throw new SmtpError('SMTP: el servidor no ofrece STARTTLS; usa SMTP_SECURE=true (puerto 465) o un servidor con STARTTLS');
    }
    if (o.user && o.pass) {
      if (!encrypted && !isLocal(o.host)) throw new SmtpError('SMTP: no se manda la contraseña sin cifrar');
      const auth = ehlo.lines.find(l => /^AUTH\b/i.test(l))?.toUpperCase() ?? '';
      if (/\bPLAIN\b/.test(auth) || !/\bLOGIN\b/.test(auth)) {
        await conv.cmd(`AUTH PLAIN ${Buffer.from(`\u0000${o.user}\u0000${o.pass}`, 'utf8').toString('base64')}`, [235], 'AUTH');
      } else {
        await conv.cmd('AUTH LOGIN', [334], 'AUTH');
        await conv.cmd(b64(o.user), [334], 'AUTH');
        await conv.cmd(b64(o.pass), [235], 'AUTH');
      }
    }
    const to = addressOf(m.to);
    if (LINE.test(to) || !/^[^\s<>@]+@[^\s<>@]+$/.test(to)) throw new SmtpError('SMTP: destinatario no válido');
    await conv.cmd(`MAIL FROM:<${addressOf(o.from)}>`, [250]);
    await conv.cmd(`RCPT TO:<${to}>`, [250, 251]);
    await conv.cmd('DATA', [354]);
    // Transparencia (RFC 5321 4.5.2): una línea que empieza por «.» se dobla. Con base64 no pasa, pero por si acaso.
    const data = buildMime(o.from, m).replace(/\r\n\./g, '\r\n..');
    await conv.cmd(`${data}\r\n.`, [250], 'DATA');
    await conv.cmd('QUIT', [221]).catch(() => { /* da igual */ });
  } finally {
    conv.socket.destroy();
  }
}

export function smtpMailer(o: SmtpOptions): Mailer {
  return { kind: 'smtp', enabled: true, send: m => sendSmtp(o, m) };
}
