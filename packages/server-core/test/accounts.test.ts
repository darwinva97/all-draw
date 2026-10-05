/**
 * Cuentas con correo (apagado por defecto): configuración anunciada, recuperar la contraseña, verificar y cambiar el
 * correo, `REQUIRE_EMAIL_VERIFICATION`, sesiones activas y centro de notificaciones (incluidas las menciones).
 */
import { describe, expect, it } from 'vitest';
import { captureMailer, makeApi, tokenIn } from './helpers';
import { attachConnection, type SyncSocket } from '../src/ysync';
import { sessionIdOf, type ConnIdentity } from '../src/docs';
import { makeHasher } from '../src/auth';
import { mentionNotificationId } from '../src/notifications';

const PW = 'contraseña-larga';
const until = async (fn: () => boolean | Promise<boolean>, ms = 2000) => {
  const t0 = Date.now();
  while (!(await fn())) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 10)); }
};
type T = ReturnType<typeof makeApi>;
async function connect(t: T, id: string, identity: ConnIdentity) {
  const live = await t.docs.get(id);
  const out = { closed: null as null | { code?: number; reason?: string } };
  const conn: SyncSocket = { identity, send() {}, isOpen: () => out.closed === null, close: (code, reason) => { out.closed ??= { code, reason }; } };
  attachConnection(conn, live, 'editor');
  return out;
}

describe('correo apagado (por defecto)', () => {
  it('config anuncia email: false; forgot responde 503 email_disabled; registro sin correos', async () => {
    const t = makeApi();
    const cfg = await t.client().get('/api/auth/config');
    expect(cfg.body).toMatchObject({ email: false, emailVerificationRequired: false });
    expect((await t.client().post('/api/auth/forgot', { email: 'x@x.io' })).body).toMatchObject({ code: 'email_disabled' });
    const a = await t.register('ana@x.io');
    expect(a.user).toMatchObject({ emailVerified: false, locale: 'es', notifyEmail: true });
    // Cambiar el correo sin servidor de correo: inmediato y queda sin verificar
    const r = await a.api.patch('/api/auth/me', { email: 'nueva@x.io', password: PW });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ email: 'nueva@x.io', emailVerified: false });
    expect(r.body.pendingEmail).toBeUndefined();
    // REQUIRE_EMAIL_VERIFICATION sin correo no bloquea (nadie podría verificar)
    const t2 = makeApi({ requireEmailVerification: true });
    await t2.register('admin@x.io');
    const b = await t2.register('bea@x.io');
    expect((await t2.client().get('/api/auth/config')).body.emailVerificationRequired).toBe(false);
    expect((await b.api.post('/api/workspaces', { name: 'W' })).status).toBe(201);
    await t.close(); await t2.close();
  });
});

describe('recuperar la contraseña por correo', () => {
  it('respuesta idéntica exista o no la cuenta; enlace de un solo uso; cierra sesiones y WebSockets', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail });
    expect((await t.client().get('/api/auth/config')).body.email).toBe(true);
    const a = await t.register('ana@x.io', 'Ana');
    mail.sent.length = 0;
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const ws = await connect(t, id, { userId: a.user.id, linkToken: null, sessionId: sessionIdOf(await makeHasher(null)(a.token)), keyId: null });

    const yes = await t.client().post('/api/auth/forgot', { email: 'ANA@x.io' });
    const no = await t.client().post('/api/auth/forgot', { email: 'nadie@x.io' });
    expect(yes.status).toBe(202); expect(no.status).toBe(202);
    expect(yes.body).toEqual(no.body);
    await until(() => mail.sent.length === 1);
    await new Promise(r => setTimeout(r, 30));
    expect(mail.sent).toHaveLength(1); // a quien no tiene cuenta no se le escribe
    const m = mail.sent[0]!;
    expect(m.to).toBe('ana@x.io');
    expect(m.subject).toMatch(/Restablece/);
    expect(m.html).toMatch(/#\/restablecer\?token=rst_/);
    expect(m.html).not.toMatch(/<img|<link|https?:\/\/(?!localhost)/); // sin recursos externos
    const token = tokenIn(m);
    expect(token).toMatch(/^rst_[A-Za-z0-9]{32}$/);
    // En la BD sólo el hash
    expect([...t.store.accountTokens.keys()].some(k => k.includes(token))).toBe(false);

    expect((await t.client().post('/api/auth/reset', { token, password: 'corta' })).status).toBe(400);
    const r = await t.client().post('/api/auth/reset', { token, password: 'otra-contraseña-larga' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, email: 'ana@x.io' });
    expect((await t.client().post('/api/auth/reset', { token, password: 'tercera-contraseña' })).body.code).toBe('token_invalid'); // un solo uso
    expect((await a.api.get('/api/auth/me')).status).toBe(401); // sesiones cerradas
    expect(ws.closed).toMatchObject({ code: 4402 });
    expect((await t.client().post('/api/auth/login', { email: 'ana@x.io', password: PW })).status).toBe(401);
    const login = await t.client().post('/api/auth/login', { email: 'ana@x.io', password: 'otra-contraseña-larga' });
    expect(login.status).toBe(200);
    expect(login.body.user.emailVerified).toBe(true); // restablecer por correo demuestra que lo lee
    await t.close();
  });

  it('tokens falsos, caducados, de otro tipo o enviados a un correo que ya cambió no valen', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail });
    const a = await t.register('ana@x.io');
    expect((await t.client().post('/api/auth/reset', { token: 'rst_inventadoinventadoinventado12', password: PW + 'x' })).body.code).toBe('token_invalid');
    // El de verificación del registro no sirve para restablecer
    const verify = tokenIn(mail.sent.find(m => /verificar/.test(m.text)));
    expect((await t.client().post('/api/auth/reset', { token: verify, password: PW + 'x' })).body.code).toBe('token_invalid');
    // Caducado
    mail.sent.length = 0;
    await t.client().post('/api/auth/forgot', { email: 'ana@x.io' });
    await until(() => mail.sent.length === 1);
    for (const v of t.store.accountTokens.values()) if (v.kind === 'reset') v.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect((await t.client().post('/api/auth/reset', { token: tokenIn(mail.sent[0]), password: PW + 'x' })).body.code).toBe('token_invalid');
    // Pedido antes de cambiar el correo: ya no vale
    mail.sent.length = 0;
    await t.client().post('/api/auth/forgot', { email: 'ana@x.io' });
    await until(() => mail.sent.length === 1);
    const old = tokenIn(mail.sent[0]);
    await t.store.updateUser(a.user.id, { email: 'otra@x.io' });
    expect((await t.client().post('/api/auth/reset', { token: old, password: PW + 'x' })).body.code).toBe('token_invalid');
    // Sólo vale el último enlace pedido
    await t.register('bea@x.io');
    mail.sent.length = 0;
    await t.client().post('/api/auth/forgot', { email: 'bea@x.io' });
    await until(() => mail.sent.length === 1);
    await t.client().post('/api/auth/forgot', { email: 'bea@x.io' });
    await until(() => mail.sent.length === 2);
    expect((await t.client().post('/api/auth/reset', { token: tokenIn(mail.sent[0]), password: PW + 'x' })).body.code).toBe('token_invalid');
    expect((await t.client().post('/api/auth/reset', { token: tokenIn(mail.sent[1]), password: PW + 'x' })).status).toBe(200);
    await t.close();
  });

  it('rate limit por correo (igual exista o no) y por IP; tiempo mínimo de respuesta', async () => {
    const mail = captureMailer();
    let ip = '203.0.113.1';
    const t = makeApi({ mailer: mail, forgotMinMs: 60, clientIp: () => ip });
    await t.register('ana@x.io');
    for (const email of ['ana@x.io', 'nadie@x.io']) {
      for (let i = 0; i < 3; i++) expect((await t.client().post('/api/auth/forgot', { email })).status).toBe(202);
      const blocked = await t.client().post('/api/auth/forgot', { email });
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('too_many_attempts');
    }
    ip = '203.0.113.2';
    for (let i = 0; i < 10; i++) await t.client().post('/api/auth/forgot', { email: `x${i}@x.io` });
    expect((await t.client().post('/api/auth/forgot', { email: 'y@x.io' })).status).toBe(429);
    ip = '203.0.113.3';
    const t0 = Date.now();
    await t.client().post('/api/auth/forgot', { email: 'otro@x.io' });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55);
    await t.close();
  });
});

describe('verificar el correo', () => {
  it('el registro manda el enlace (24 h, en el idioma de la cuenta); verificar; reenviar', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail });
    const r = await t.client(undefined, { 'accept-language': 'en-GB,en;q=0.9' }).post('/api/auth/register', { email: 'eva@x.io', name: 'Eva', password: PW });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ locale: 'en', emailVerified: false });
    const m = mail.sent.at(-1)!;
    expect(m).toMatchObject({ to: 'eva@x.io', subject: 'Confirm your all-draw email' });
    expect(m.text).toMatch(/24 hours/);
    const token = tokenIn(m);
    expect(token).toMatch(/^vfy_/);
    const v = await t.client().post('/api/auth/verify', { token });
    expect(v.status).toBe(200);
    expect(v.body).toMatchObject({ changed: false, user: { email: 'eva@x.io', emailVerified: true } });
    expect((await t.client().post('/api/auth/verify', { token })).body.code).toBe('token_invalid');
    const api = t.client(r.body.token);
    expect((await api.post('/api/auth/verify/resend')).body).toEqual({ ok: true, alreadyVerified: true });
    // Reenviar a quien no ha verificado: invalida el anterior
    const b = await t.register('bea@x.io');
    const first = tokenIn(mail.sent.at(-1));
    expect((await b.api.post('/api/auth/verify/resend')).status).toBe(202);
    const second = tokenIn(mail.sent.at(-1));
    expect(second).not.toBe(first);
    expect((await t.client().post('/api/auth/verify', { token: first })).body.code).toBe('token_invalid');
    expect((await t.client().post('/api/auth/verify', { token: second })).status).toBe(200);
    // Caducado
    const c = await t.register('cai@x.io');
    for (const tok of t.store.accountTokens.values()) if (tok.userId === c.user.id) tok.expiresAt = new Date(Date.now() - 1).toISOString();
    expect((await t.client().post('/api/auth/verify', { token: tokenIn(mail.sent.at(-1)) })).body.code).toBe('token_invalid');
    await t.close();
  });

  it('REQUIRE_EMAIL_VERIFICATION: no deja crear espacios en el servidor hasta verificar (los admins sí)', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail, requireEmailVerification: true });
    expect((await t.client().get('/api/auth/config')).body.emailVerificationRequired).toBe(true);
    const admin = await t.register('admin@x.io');
    expect((await admin.api.post('/api/workspaces', { name: 'A' })).status).toBe(201);
    const b = await t.register('bea@x.io');
    const no = await b.api.post('/api/workspaces', { name: 'B' });
    expect(no.status).toBe(403);
    expect(no.body.code).toBe('email_unverified');
    await t.client().post('/api/auth/verify', { token: tokenIn(mail.sent.at(-1)) });
    expect((await b.api.post('/api/workspaces', { name: 'B' })).status).toBe(201);
    await t.close();
  });

  it('cambiar el correo exige confirmar el nuevo; se avisa al anterior', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail });
    const a = await t.register('ana@x.io', 'Ana');
    await t.register('ocupado@x.io');
    mail.sent.length = 0;
    expect((await a.api.patch('/api/auth/me', { email: 'nueva@x.io' })).status).toBe(403); // sin contraseña
    const r = await a.api.patch('/api/auth/me', { email: 'nueva@x.io', password: PW });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pendingEmail: 'nueva@x.io', user: { email: 'ana@x.io' } });
    expect(mail.sent.map(m => m.to).sort()).toEqual(['ana@x.io', 'nueva@x.io']);
    const toNew = mail.sent.find(m => m.to === 'nueva@x.io')!;
    expect(toNew.subject).toMatch(/nuevo correo/);
    expect(mail.sent.find(m => m.to === 'ana@x.io')!.text).toMatch(/nueva@x\.io/);
    const v = await t.client().post('/api/auth/verify', { token: tokenIn(toNew) });
    expect(v.body).toMatchObject({ changed: true, user: { email: 'nueva@x.io', emailVerified: true } });
    expect((await t.client().post('/api/auth/login', { email: 'nueva@x.io', password: PW })).status).toBe(200);
    // Si mientras tanto otra cuenta coge el correo: 409
    mail.sent.length = 0;
    await a.api.patch('/api/auth/me', { email: 'pronto@x.io', password: PW });
    const tok = tokenIn(mail.sent.find(m => m.to === 'pronto@x.io'));
    await t.register('pronto@x.io');
    expect((await t.client().post('/api/auth/verify', { token: tok })).status).toBe(409);
    // Idioma y preferencia
    const p = await a.api.patch('/api/auth/me', { locale: 'en', notifyEmail: false });
    expect(p.body.user).toMatchObject({ locale: 'en', notifyEmail: false });
    await t.close();
  });

  it('si el proveedor falla, el registro sigue y el reenvío responde 503', async () => {
    const mail = captureMailer();
    mail.fail = true;
    const t = makeApi({ mailer: mail });
    const a = await t.register('ana@x.io');
    expect((await a.api.post('/api/auth/verify/resend')).body.code).toBe('email_failed');
    await t.close();
  });
});

describe('sesiones activas', () => {
  it('lista con dispositivo resumido, IP truncada y la actual marcada; cerrar una corta su WebSocket', async () => {
    const t = makeApi({ clientIp: () => '198.51.100.77' });
    const a = await t.register('ana@x.io');
    const ff = await t.client(undefined, { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0' }).post('/api/auth/login', { email: 'ana@x.io', password: PW });
    const phone = await t.client(undefined, { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }).post('/api/auth/login', { email: 'ana@x.io', password: PW });
    const me = t.client(ff.body.token);
    const list = await me.get('/api/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(3);
    const cur = list.body.sessions.find((s: { current: boolean }) => s.current);
    expect(cur).toMatchObject({ device: { browser: 'Firefox', os: 'Linux', type: 'desktop' }, ip: '198.51.100.0' });
    const hash = makeHasher(null);
    expect(cur.id).toBe(sessionIdOf(await hash(ff.body.token)));
    const ios = list.body.sessions.find((s: { device: { os: string } }) => s.device.os === 'iOS');
    expect(ios.device).toEqual({ browser: 'Safari', os: 'iOS', type: 'mobile' });
    expect(JSON.stringify(list.body)).not.toMatch(/Gecko|AppleWebKit/); // el user-agent entero no se guarda

    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const wsPhone = await connect(t, id, { userId: a.user.id, linkToken: null, sessionId: ios.id, keyId: null });
    const wsMine = await connect(t, id, { userId: a.user.id, linkToken: null, sessionId: cur.id, keyId: null });
    expect((await me.del(`/api/auth/sessions/${ios.id}`)).status).toBe(204);
    expect(wsPhone.closed).toMatchObject({ code: 4402 });
    expect(wsMine.closed).toBeNull();
    expect((await t.client(phone.body.token).get('/api/auth/me')).status).toBe(401);
    expect((await me.del(`/api/auth/sessions/${ios.id}`)).body.code).toBe('session_not_found');
    expect((await me.get('/api/auth/sessions')).body.sessions).toHaveLength(2);
    // Una API key no lista ni cierra sesiones
    const key = (await a.api.post('/api/keys', { name: 'k' })).body.key as string;
    expect((await t.client(key).get('/api/auth/sessions')).body.code).toBe('session_required');
    // Cerrar la propia: borra la cookie
    const self = await me.del(`/api/auth/sessions/${cur.id}`);
    expect(self.status).toBe(204);
    expect(self.headers.get('set-cookie')).toMatch(/alldraw_session=;/);
    expect((await me.get('/api/auth/me')).status).toBe(401);
    // No se cierran sesiones de otra cuenta
    const b = await t.register('bea@x.io');
    const aSessions = (await a.api.get('/api/auth/sessions')).body.sessions as { id: string }[];
    expect((await b.api.del(`/api/auth/sessions/${aSessions[0]!.id}`)).status).toBe(404);
    await t.close();
  });
});

describe('notificaciones', () => {
  it('compartir, cambiar el rol y restaurar una instantánea; leer y marcar como leídas', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io', 'Ana');
    const b = await t.register('bea@x.io', 'Bea');
    const id = (await a.api.post('/api/workspaces', { name: 'Proyecto' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'viewer' });
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'viewer' }); // sin cambio: nada
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' });
    let r = await b.api.get('/api/notifications');
    expect(r.body.unread).toBe(2);
    expect(r.body.notifications.map((n: { kind: string }) => n.kind)).toEqual(['role', 'shared']);
    expect(r.body.notifications[0]).toMatchObject({ workspaceId: id, href: `#/s/${id}`, readAt: null, payload: { workspaceName: 'Proyecto', actorName: 'Ana', role: 'editor', previousRole: 'viewer' } });
    expect(r.body.notifications[1].payload).toMatchObject({ role: 'viewer', actorId: a.user.id });
    // Restaurar: avisa a la dueña si lo hace otra persona, no si lo hace ella
    const snap = (await a.api.post(`/api/workspaces/${id}/snapshots`, { label: 'hito' })).body.id as string;
    await a.api.post(`/api/workspaces/${id}/snapshots/${snap}/restore`);
    expect((await a.api.get('/api/notifications')).body.unread).toBe(0);
    await b.api.post(`/api/workspaces/${id}/snapshots/${snap}/restore`);
    const ra = await a.api.get('/api/notifications');
    expect(ra.body.notifications[0]).toMatchObject({ kind: 'restored', payload: { actorName: 'Bea', snapshotId: snap, snapshotLabel: 'hito' } });
    // Transferir la propiedad: avisa a la nueva dueña
    await a.api.patch(`/api/workspaces/${id}`, { ownerId: b.user.id });
    r = await b.api.get('/api/notifications');
    expect(r.body.notifications[0]).toMatchObject({ kind: 'role', payload: { role: 'owner' } });
    // Leer
    const first = r.body.notifications[0].id as string;
    expect((await b.api.post('/api/notifications/read', { ids: [first] })).body).toEqual({ updated: 1, unread: 2 });
    expect((await b.api.post('/api/notifications/read', {})).body).toEqual({ updated: 2, unread: 0 });
    expect((await b.api.get('/api/notifications?limit=1')).body.notifications).toHaveLength(1);
    expect((await t.client().get('/api/notifications')).status).toBe(401);
    await t.close();
  });

  it('menciones: por correo de la Persona, por nombre de autor con cuenta y por id de cuenta; sin acceso, propias o antiguas no', async () => {
    const mail = captureMailer();
    const t = makeApi({ mailer: mail, publicUrl: 'https://draw.example' });
    const a = await t.register('ana@x.io', 'Ana');
    const b = await t.register('bea@x.io', 'Bea');
    const c = await t.register('carla@x.io', 'Carla');
    const out = await t.register('fuera@x.io', 'Fuera');
    const id = (await a.api.post('/api/workspaces', { name: 'Proyecto' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' });
    await a.api.put(`/api/workspaces/${id}/members/${c.user.id}`, { role: 'viewer' });
    await t.store.updateUser(c.user.id, { notifyEmail: false });
    mail.sent.length = 0;
    const mentionsOf = async (uid: string) => (await t.store.listNotifications(uid, 50)).filter(n => n.kind === 'mention');
    const live = await t.docs.get(id);
    const now = new Date().toISOString();
    const person = (pid: string, name: string, email?: string) => live.store.set('people', pid, { id: pid, name, ...(email ? { email } : {}), assignments: [] } as never);
    const comment = (cid: string, mentions: string[], author: { name: string; userId?: string }, createdAt = now, text = 'Mirad esto @Bea @Carla') =>
      live.store.set('comments', cid, { id: cid, threadId: cid, anchor: { kind: 'view', id: 'v1' }, author, text, mentions, createdAt } as never);
    person('p_bea', 'Bea', 'BEA@x.io');
    person('p_carla', 'Cárla'); // sin correo: por el nombre de quien firma comentarios con su cuenta
    person('p_fuera', 'Fuera', 'fuera@x.io');
    person('p_ana', 'Ana', 'ana@x.io');
    comment('c0', [], { name: 'Carla', userId: c.user.id }); // Carla ha comentado con su cuenta
    comment('c1', ['p_bea', 'p_carla', 'p_fuera', 'p_ana', 'p_nadie'], { name: 'Ana', userId: a.user.id });
    await until(async () => (await mentionsOf(b.user.id)).length === 1 && (await mentionsOf(c.user.id)).length === 1);
    await new Promise(r => setTimeout(r, 30));
    expect(await mentionsOf(out.user.id)).toHaveLength(0); // sin acceso al espacio
    expect(await mentionsOf(a.user.id)).toHaveLength(0); // la autora
    const nb = (await b.api.get('/api/notifications')).body.notifications.find((n: { kind: string }) => n.kind === 'mention');
    expect(nb).toMatchObject({ kind: 'mention', href: `#/s/${id}/v/v1`, payload: { workspaceName: 'Proyecto', actorName: 'Ana', commentId: 'c1', excerpt: 'Mirad esto @Bea @Carla', viewId: 'v1' } });
    expect(nb.id).toBe(await mentionNotificationId(id, 'c1', b.user.id));
    // Correo inmediato sólo a quien lo tiene activado
    await until(() => mail.sent.length === 1);
    expect(mail.sent[0]).toMatchObject({ to: 'bea@x.io', subject: 'Ana te ha mencionado en «Proyecto»' });
    expect(mail.sent[0]!.text).toContain(`https://draw.example/#/s/${id}/v/v1`);
    expect(mail.sent[0]!.text).toContain('https://draw.example/#/keys');

    // Idempotente: el mismo comentario otra vez (borrado y vuelto a añadir, p. ej. deshacer) no repite
    live.store.delete('comments', 'c1');
    comment('c1', ['p_bea'], { name: 'Ana', userId: a.user.id });
    // Antiguo (> 24 h): no se notifica
    comment('c2', ['p_bea'], { name: 'Ana', userId: a.user.id }, new Date(Date.now() - 25 * 3_600_000).toISOString());
    // Mención directa a una cuenta por su id
    comment('c3', [b.user.id], { name: 'Carla', userId: c.user.id });
    // Editar un comentario existente (añadir una mención) no es un comentario nuevo
    live.store.set('comments', 'c0', { id: 'c0', threadId: 'c0', anchor: { kind: 'view', id: 'v1' }, author: { name: 'Carla', userId: c.user.id }, text: '@Bea', mentions: ['p_bea'], createdAt: now } as never);
    await until(async () => (await mentionsOf(b.user.id)).length === 2);
    await new Promise(r => setTimeout(r, 50));
    expect((await mentionsOf(b.user.id)).map(n => n.payload.commentId)).toEqual(['c3', 'c1']);
    // Nombre ambiguo (dos cuentas firman como «Dani»): no se notifica a ninguna
    const d1 = await t.register('d1@x.io', 'Dani'); const d2 = await t.register('d2@x.io', 'Dani');
    for (const d of [d1, d2]) await a.api.put(`/api/workspaces/${id}/members/${d.user.id}`, { role: 'editor' });
    comment('c4', [], { name: 'Dani', userId: d1.user.id }); comment('c5', [], { name: 'Dani', userId: d2.user.id });
    person('p_dani', 'Dani');
    comment('c6', ['p_dani'], { name: 'Ana', userId: a.user.id });
    await new Promise(r => setTimeout(r, 50));
    expect((await t.store.listNotifications(d1.user.id, 10)).filter(n => n.kind === 'mention')).toHaveLength(0);
    // Restaurar una instantánea que trae comentarios no los cuenta como nuevos
    const snap = (await a.api.post(`/api/workspaces/${id}/snapshots`, {})).body.id as string;
    live.store.delete('comments', 'c3');
    await a.api.post(`/api/workspaces/${id}/snapshots/${snap}/restore`);
    await new Promise(r => setTimeout(r, 50));
    expect(await mentionsOf(b.user.id)).toHaveLength(2);
    await t.close();
  });
});
