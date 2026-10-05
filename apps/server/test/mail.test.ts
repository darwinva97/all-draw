/**
 * Correo en el servidor Node: elección del proveedor por entorno (apagado en producción), cliente SMTP propio contra un
 * servidor SMTP falso (AUTH PLAIN/LOGIN, STARTTLS con certificado de prueba, MIME), proveedor HTTP, y de punta a punta
 * con `MAIL_PROVIDER=log`: el enlace de restablecer sale en el log. También: un enlace que caduca con el WebSocket
 * abierto lo corta (4401 `expired`) y las menciones del doc vivo llegan como notificación.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { afterAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { httpMailRequest, jsonLogger, mailerFromEnv, noneMailer, type MailMessage } from '@all-draw/server-core';
import { configFromEnv } from '../src/config';
import { buildMime, encodeHeader, sendSmtp } from '../src/smtp';
import { register, startServer, until, wait } from './helpers';

const logger = jsonLogger({ level: 'silent' });
const msg: MailMessage = { to: 'ana@x.io', subject: 'Confirma tu correo de all-draw', text: 'Hola:\n.línea con punto\nhttps://x/#/verificar?token=vfy_abc', html: '<p>Hola</p>' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-smtp-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('MAIL_PROVIDER', () => {
  it('por defecto: log en desarrollo, none en producción (NODE_ENV o PUBLIC_URL https)', () => {
    expect(configFromEnv({}).production).toBe(false);
    expect(configFromEnv({ PUBLIC_URL: 'https://alldraw.example' }).production).toBe(true);
    expect(configFromEnv({ NODE_ENV: 'production' }).production).toBe(true);
    expect(mailerFromEnv({}, { logger, production: false }).kind).toBe('log');
    expect(mailerFromEnv({}, { logger, production: true })).toBe(noneMailer);
    expect(mailerFromEnv({ MAIL_PROVIDER: 'log' }, { logger, production: true }).enabled).toBe(true);
    const c = configFromEnv({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', MAIL_FROM: 'a@b.c', REQUIRE_EMAIL_VERIFICATION: 'true', OTRA: 'x' });
    expect(c.mail).toEqual({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', MAIL_FROM: 'a@b.c' });
    expect(c.requireEmailVerification).toBe(true);
  });

  it('faltan variables o hay valores raros → error claro al arrancar', () => {
    const make = (env: Record<string, string>) => () => mailerFromEnv(env, { logger, production: true, makeSmtp: () => noneMailer });
    expect(make({ MAIL_PROVIDER: 'carta' })).toThrow(/no es none, log, http ni smtp/);
    expect(make({ MAIL_PROVIDER: 'http', MAIL_FROM: 'a@b.c' })).toThrow(/MAIL_HTTP_URL/);
    expect(make({ MAIL_PROVIDER: 'http', MAIL_HTTP_URL: 'https://api', MAIL_HTTP_TOKEN: 't' })).toThrow(/MAIL_FROM/);
    expect(make({ MAIL_PROVIDER: 'http', MAIL_HTTP_URL: 'https://api', MAIL_HTTP_TOKEN: 't', MAIL_FROM: 'a@b.c', MAIL_HTTP_FORMAT: 'fax' })).toThrow(/MAIL_HTTP_FORMAT/);
    expect(make({ MAIL_PROVIDER: 'http', MAIL_HTTP_URL: 'https://api', MAIL_HTTP_TOKEN: 't', MAIL_FROM: 'a@b.c', MAIL_HTTP_FORMAT: 'json', MAIL_HTTP_TEMPLATE: '{no' })).toThrow(/JSON/);
    expect(make({ MAIL_PROVIDER: 'smtp', MAIL_FROM: 'a@b.c' })).toThrow(/SMTP_HOST/);
    expect(make({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', MAIL_FROM: 'a@b.c', SMTP_USER: 'u' })).toThrow(/juntos/);
    expect(make({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', MAIL_FROM: 'a@b.c', SMTP_PORT: '99999' })).toThrow(/puerto/);
    expect(() => mailerFromEnv({ MAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', MAIL_FROM: 'a@b.c' }, { logger, production: true })).toThrow(/Cloudflare/);
  });

  it('http: cuerpos de Resend, Postmark, Mailgun y plantilla JSON; errores del proveedor', async () => {
    const base = { url: 'https://api.example/send', token: 'tok', from: 'all-draw <no-reply@x.io>' };
    const resend = httpMailRequest(base, msg);
    expect(resend.headers.authorization).toBe('Bearer tok');
    expect(JSON.parse(resend.body)).toEqual({ from: base.from, to: ['ana@x.io'], subject: msg.subject, text: msg.text, html: msg.html });
    const pm = httpMailRequest({ ...base, format: 'postmark' }, msg);
    expect(pm.headers['x-postmark-server-token']).toBe('tok');
    expect(JSON.parse(pm.body)).toMatchObject({ From: base.from, To: 'ana@x.io', TextBody: msg.text, HtmlBody: msg.html });
    const mg = httpMailRequest({ ...base, format: 'mailgun' }, msg);
    expect(mg.headers.authorization).toBe(`Basic ${Buffer.from('api:tok').toString('base64')}`);
    expect(new URLSearchParams(mg.body).get('to')).toBe('ana@x.io');
    const tpl = httpMailRequest({ ...base, format: 'json', template: '{"sender":{"email":"{{from}}"},"to":[{"email":"{{to}}"}],"subject":"[x] {{subject}}","htmlContent":"{{html}}"}', authHeader: 'api-key' }, { ...msg, html: '<p>"comillas"</p>' });
    expect(tpl.headers['api-key']).toBe('tok');
    expect(JSON.parse(tpl.body)).toEqual({ sender: { email: base.from }, to: [{ email: 'ana@x.io' }], subject: `[x] ${msg.subject}`, htmlContent: '<p>"comillas"</p>' });

    const seen: { url: string; init: RequestInit }[] = [];
    const ok = mailerFromEnv({ MAIL_PROVIDER: 'http', MAIL_HTTP_URL: base.url, MAIL_HTTP_TOKEN: 'tok', MAIL_FROM: base.from }, { logger, production: true, fetch: (async (url: string, init: RequestInit) => { seen.push({ url, init }); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch });
    await ok.send(msg);
    expect(seen[0]!.url).toBe(base.url);
    const bad = mailerFromEnv({ MAIL_PROVIDER: 'http', MAIL_HTTP_URL: base.url, MAIL_HTTP_TOKEN: 'tok', MAIL_FROM: base.from }, { logger, production: true, fetch: (async () => new Response('dominio sin verificar', { status: 422 })) as unknown as typeof fetch });
    await expect(bad.send(msg)).rejects.toThrow(/HTTP 422 dominio sin verificar/);
  });
});

// ---------------------------------------------------------------- SMTP falso
interface FakeOpts { starttls?: boolean; auth?: 'PLAIN' | 'LOGIN' | null; implicitTls?: boolean; rejectAuth?: boolean }
interface Session { lines: string[]; data: string; tls: boolean }
let cert: { key: string; cert: string } | null = null;
function selfSigned() {
  if (cert) return cert;
  const key = path.join(tmp, 'key.pem'), crt = path.join(tmp, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  return (cert = { key: fs.readFileSync(key, 'utf8'), cert: fs.readFileSync(crt, 'utf8') });
}
async function fakeSmtp(o: FakeOpts) {
  const sessions: Session[] = [];
  const handle = (sock: net.Socket | tls.TLSSocket, sess: Session) => {
    let buf = '', inData = false;
    const say = (s: string) => sock.write(`${s}\r\n`);
    sock.setEncoding('utf8');
    sock.on('data', (d: string) => {
      buf += d;
      let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) { if (line === '.') { inData = false; say('250 2.0.0 encolado'); } else sess.data += `${line}\r\n`; continue; }
        sess.lines.push(line);
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) {
          const ext = [...(o.starttls && !sess.tls ? ['STARTTLS'] : []), ...(o.auth && (sess.tls || !o.starttls) ? [`AUTH ${o.auth}`] : []), '8BITMIME'];
          say('250-fake.smtp hola'); ext.forEach((e, k) => say(`250${k === ext.length - 1 ? ' ' : '-'}${e}`));
        } else if (up === 'STARTTLS') {
          say('220 adelante');
          sock.removeAllListeners('data');
          const secure = new tls.TLSSocket(sock, { isServer: true, ...selfSigned() });
          sess.tls = true;
          handle(secure, sess);
          return;
        } else if (up.startsWith('AUTH PLAIN')) say(o.rejectAuth ? '535 5.7.8 credenciales malas' : '235 ok');
        else if (up === 'AUTH LOGIN') say('334 VXNlcm5hbWU6');
        else if (sess.lines.at(-2)?.toUpperCase() === 'AUTH LOGIN') say('334 UGFzc3dvcmQ6');
        else if (sess.lines.at(-3)?.toUpperCase() === 'AUTH LOGIN') say('235 ok');
        else if (up.startsWith('MAIL FROM') || up.startsWith('RCPT TO')) say('250 ok');
        else if (up === 'DATA') { inData = true; say('354 adelante'); }
        else if (up === 'QUIT') { say('221 adiós'); sock.end(); }
        else say('500 ¿qué?');
      }
    });
    sock.on('error', () => {});
  };
  const onConn = (sock: net.Socket | tls.TLSSocket) => { const sess: Session = { lines: [], data: '', tls: !!o.implicitTls }; sessions.push(sess); handle(sock, sess); sock.write('220 fake.smtp ESMTP\r\n'); };
  const server = o.implicitTls ? tls.createServer(selfSigned(), onConn) : net.createServer(onConn);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  return { port: (server.address() as net.AddressInfo).port, sessions, close: () => new Promise<void>(r => server.close(() => r())) };
}
const decodeParts = (data: string) => [...data.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map(m => Buffer.from(m[1]!.replace(/\r\n/g, ''), 'base64').toString('utf8'));

describe('cliente SMTP', () => {
  it('MIME: multipart texto + HTML en base64, asunto RFC 2047, sin saltos de línea en cabeceras', () => {
    const mime = buildMime('all-draw <no-reply@x.io>', msg);
    expect(mime).toMatch(/^From: all-draw <no-reply@x\.io>\r\nTo: ana@x\.io\r\n/);
    expect(mime).toContain('Content-Type: multipart/alternative');
    expect(decodeParts(mime)).toEqual([msg.text, msg.html]);
    expect(encodeHeader('Restablece tu contraseña')).toBe(`=?UTF-8?B?${Buffer.from('Restablece tu contraseña').toString('base64')}?=`);
    expect(encodeHeader('plain ascii')).toBe('plain ascii');
    expect(() => buildMime('a@b.c', { ...msg, subject: 'x\r\nBcc: otro@x.io' })).toThrow(/salto de línea/);
  });

  it('STARTTLS + AUTH PLAIN: cifra antes de mandar la contraseña', async () => {
    const f = await fakeSmtp({ starttls: true, auth: 'PLAIN' });
    await sendSmtp({ host: '127.0.0.1', port: f.port, secure: false, user: 'yo', pass: 'secreto', from: 'all-draw <no-reply@x.io>', tls: { rejectUnauthorized: false } }, msg);
    const s = f.sessions[0]!;
    expect(s.tls).toBe(true);
    const i = s.lines.findIndex(l => l === 'STARTTLS');
    expect(i).toBeGreaterThan(0);
    const auth = s.lines.findIndex(l => l.startsWith('AUTH PLAIN'));
    expect(auth).toBeGreaterThan(i);
    expect(Buffer.from(s.lines[auth]!.slice(11), 'base64').toString()).toBe('\u0000yo\u0000secreto');
    expect(s.lines).toEqual(expect.arrayContaining(['MAIL FROM:<no-reply@x.io>', 'RCPT TO:<ana@x.io>', 'QUIT']));
    expect(decodeParts(s.data)).toEqual([msg.text, msg.html]);
    await f.close();
  });

  it('TLS directo (465) + AUTH LOGIN', async () => {
    const f = await fakeSmtp({ implicitTls: true, auth: 'LOGIN' });
    await sendSmtp({ host: '127.0.0.1', port: f.port, secure: true, user: 'yo', pass: 'secreto', from: 'no-reply@x.io', tls: { rejectUnauthorized: false } }, msg);
    const s = f.sessions[0]!;
    const i = s.lines.indexOf('AUTH LOGIN');
    expect(Buffer.from(s.lines[i + 1]!, 'base64').toString()).toBe('yo');
    expect(Buffer.from(s.lines[i + 2]!, 'base64').toString()).toBe('secreto');
    expect(s.lines).toContain('DATA');
    await f.close();
  });

  it('errores: credenciales rechazadas, certificado no válido, destinatario raro', async () => {
    const f = await fakeSmtp({ starttls: true, auth: 'PLAIN', rejectAuth: true });
    await expect(sendSmtp({ host: '127.0.0.1', port: f.port, secure: false, user: 'yo', pass: 'mal', from: 'a@x.io', tls: { rejectUnauthorized: false } }, msg)).rejects.toThrow(/AUTH: 535/);
    // Certificado autofirmado sin `rejectUnauthorized: false`: no se acepta
    await expect(sendSmtp({ host: '127.0.0.1', port: f.port, secure: false, user: null, pass: null, from: 'a@x.io' }, msg)).rejects.toThrow();
    await f.close();
    // Relé local sin STARTTLS: vale (localhost)
    const plain = await fakeSmtp({});
    await sendSmtp({ host: '127.0.0.1', port: plain.port, secure: false, user: null, pass: null, from: 'a@x.io' }, msg);
    expect(plain.sessions[0]!.data).toContain('multipart/alternative');
    await expect(sendSmtp({ host: '127.0.0.1', port: plain.port, secure: false, user: null, pass: null, from: 'a@x.io' }, { ...msg, to: 'no es un correo' })).rejects.toThrow(/destinatario/);
    await plain.close();
  });
});

describe('servidor Node con correo', () => {
  it('MAIL_PROVIDER=log (desarrollo): el enlace de restablecer queda en el log y funciona', async () => {
    const s = await startServer({ config: { forgotMinMs: 0 } });
    expect(s.app.mailer.kind).toBe('log');
    const a = await register(s.url, 'ana@example.com');
    expect((await a.api.get('/api/auth/config')).body.email).toBe(true);
    await a.api.post('/api/auth/forgot', { email: 'ana@example.com' });
    await until(() => s.logs.some(l => l.msg === 'correo' && /restablecer/.test(String(l.text))));
    const line = s.logs.find(l => l.msg === 'correo' && /restablecer/.test(String(l.text)))!;
    expect(line).toMatchObject({ provider: 'log', to: 'ana@example.com' });
    const token = /token=(rst_[A-Za-z0-9]+)/.exec(String(line.text))![1]!;
    expect((await a.api.post('/api/auth/reset', { token, password: 'nueva-contraseña-larga' })).status).toBe(200);
    // El token no aparece en el log de accesos
    expect(s.logs.filter(l => l.msg === 'http').some(l => JSON.stringify(l).includes(token))).toBe(false);
    await s.close();
  });

  it('un enlace que caduca con el WebSocket abierto lo corta con 4401 «expired»', async () => {
    const s = await startServer();
    const a = await register(s.url, 'own@example.com');
    const id = (await a.api.post('/api/workspaces', { name: 'Sala' })).body.id as string;
    const soon = new Date(Date.now() + 700).toISOString();
    const tok = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor', expiresAt: soon })).body.token as string;
    const forever = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const open = (token: string) => { const w = new WebSocket(`${s.wsUrl}/${id}?token=${token}`); const st = { code: 0, reason: '' }; w.on('close', (c: number, r: Buffer) => { st.code = c; st.reason = r.toString(); }); w.on('error', () => {}); return { w, st }; };
    const x = open(tok), y = open(forever);
    await until(() => x.w.readyState === WebSocket.OPEN && y.w.readyState === WebSocket.OPEN);
    await until(() => x.st.code !== 0, 3000);
    expect(x.st).toEqual({ code: 4401, reason: 'expired' });
    await wait(100);
    expect(y.w.readyState).toBe(WebSocket.OPEN);
    // Reabrir con el enlace caducado: 4401 desde el principio
    const again = open(tok);
    await until(() => again.st.code !== 0);
    expect(again.st.code).toBe(4401);
    y.w.close();
    await s.close();
  });

  it('menciones en el doc vivo (servidor Node) → notificación y correo para la cuenta mencionada', async () => {
    const s = await startServer();
    const a = await register(s.url, 'ana@example.com', 'Ana');
    const b = await register(s.url, 'bea@example.com', 'Bea');
    const id = (await a.api.post('/api/workspaces', { name: 'Sala' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' });
    const live = await s.app.docs.get(id);
    live.store.set('people', 'p1', { id: 'p1', name: 'Bea', email: 'bea@example.com', assignments: [] } as never);
    live.store.set('comments', 'c1', { id: 'c1', threadId: 'c1', anchor: { kind: 'view', id: 'v' }, author: { name: 'Ana', userId: a.user.id }, text: '@Bea mira', mentions: ['p1'], createdAt: new Date().toISOString() } as never);
    await until(() => s.logs.some(l => l.msg === 'correo' && l.to === 'bea@example.com' && /mencionado/.test(String(l.subject))));
    const n = await b.api.get('/api/notifications');
    expect(n.body.notifications.find((x: { kind: string }) => x.kind === 'mention')).toMatchObject({ payload: { actorName: 'Ana', excerpt: '@Bea mira' } });
    await s.close();
  });
});
