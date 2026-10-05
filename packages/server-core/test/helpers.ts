/** API en memoria sin servidor HTTP: `app.request()` de Hono. Sirve para probar auth, permisos y comandos en cualquier runtime. */
import { createApi } from '../src/api';
import { makeHasher } from '../src/auth';
import { DocManager } from '../src/docs';
import { LocalDocHost } from '../src/host';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { jsonLogger, type LogLevel } from '../src/log';
import { noneMailer } from '../src/mail';
import { Notifier, mentionContextOf } from '../src/notifications';
import type { ApiConfig, ApiDeps } from '../src/api';
import type { MailMessage, Mailer } from '../src/mail';

/** Correo de prueba: guarda los mensajes en `sent`. */
export function captureMailer(): Mailer & { sent: MailMessage[]; fail: boolean } {
  const m = { kind: 'test', enabled: true, sent: [] as MailMessage[], fail: false, async send(msg: MailMessage) { if (m.fail) throw new Error('proveedor caído'); m.sent.push(msg); } };
  return m;
}
/** Enlace con token (`#/restablecer?token=…` o `#/verificar?token=…`) del texto de un correo. */
export const tokenIn = (m: MailMessage | undefined): string => decodeURIComponent(/[?&]token=([^\s&]+)/.exec(m?.text ?? '')?.[1] ?? '');

export interface MakeApiOpts extends Partial<Pick<ApiConfig, 'maxWorkspacesPerUser' | 'maxDocBytes' | 'registerMinMs' | 'requireEmailVerification' | 'forgotMinMs'>> {
  mailer?: Mailer;
  /** IP de cada petición (por defecto `unknown`). */
  clientIp?: ApiDeps['clientIp'];
  allowRegistration?: boolean; secret?: string | null; publicUrl?: string | null; inviteCode?: string | null;
  /** Líneas de log capturadas (por defecto no se imprime nada). */
  logs?: Record<string, unknown>[]; logLevel?: LogLevel;
  archiveWorkspace?: ApiDeps['archiveWorkspace']; build?: ApiDeps['build'];
}

export function makeApi(opts: MakeApiOpts = {}) {
  const store = new MemoryWorkspaceStore();
  const logger = jsonLogger({ level: opts.logLevel ?? 'debug', write: line => { opts.logs?.push(JSON.parse(line) as Record<string, unknown>); } });
  // Como el servidor Node: las menciones de los comentarios nuevos del doc vivo pasan por el mismo `Notifier` que la API.
  const notifier = new Notifier({ store, mailer: opts.mailer ?? noneMailer, logger, publicUrl: opts.publicUrl ?? null });
  const docs = new DocManager(store, { maxDocBytes: opts.maxDocBytes ?? 0, onNewComments: (id, cs, live) => { void notifier.mentions(id, cs, mentionContextOf(live.doc)); } });
  const app = createApi({
    store, docs: new LocalDocHost(docs), hash: makeHasher(opts.secret ?? null), logger, notifier,
    ...(opts.archiveWorkspace ? { archiveWorkspace: opts.archiveWorkspace } : {}), ...(opts.build ? { build: opts.build } : {}),
    ...(opts.mailer ? { mailer: opts.mailer } : {}), ...(opts.clientIp ? { clientIp: opts.clientIp } : {}),
    config: {
      allowRegistration: opts.allowRegistration ?? true, cookieSecure: false, publicUrl: opts.publicUrl ?? null, inviteCode: opts.inviteCode ?? null,
      registerMinMs: opts.registerMinMs ?? 0, maxWorkspacesPerUser: opts.maxWorkspacesPerUser ?? 100, maxDocBytes: opts.maxDocBytes ?? 20 * 1024 * 1024,
      requireEmailVerification: opts.requireEmailVerification ?? false, forgotMinMs: opts.forgotMinMs ?? 0,
    },
  });
  const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
  const req = (p: string, init: RequestInit) => Promise.resolve(app.request(p, init));
  const client = (token?: string, base: Record<string, string> = {}) => {
    const headers = (extra: Record<string, string> = {}) => ({ ...base, ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
    return {
      get: (p: string) => req(p, { headers: headers() }).then(j),
      del: (p: string) => req(p, { method: 'DELETE', headers: headers() }).then(j),
      post: (p: string, body?: unknown) => req(p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
      put: (p: string, body: unknown) => req(p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
      patch: (p: string, body: unknown) => req(p, { method: 'PATCH', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
    };
  };
  const register = async (email: string, name = email.split('@')[0]!, password = 'contraseña-larga') => {
    const r = await client().post('/api/auth/register', { email, name, password });
    if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
    return { token: r.body.token as string, user: r.body.user as { id: string; email: string; isAdmin: boolean }, api: client(r.body.token) };
  };
  return { app, store, docs, client, register, close: () => docs.closeAll() };
}
