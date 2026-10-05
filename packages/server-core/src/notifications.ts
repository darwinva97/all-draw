/**
 * Centro de notificaciones: qué se notifica, a quién, y el correo opcional de las menciones.
 *
 * Tipos (`Notification.kind`):
 *   - `mention`: te mencionan con `@` en un comentario nuevo (ver la regla abajo).
 *   - `shared`: te añaden como miembro de un espacio (`PUT /api/workspaces/:id/members/:userId` sin rol previo).
 *   - `role`: te cambian el rol en un espacio (o te pasan a ser dueño).
 *   - `restored`: alguien restaura una instantánea de un espacio tuyo (no se notifica si lo restauras tú).
 *
 * **Regla de las menciones.** El servidor mira los comentarios que se **añaden** al documento (no los que llegan al
 * cargarlo, al restaurar una instantánea ni al reemplazar o importar el espacio entero) con `createdAt` de las últimas
 * 24 h. Cada id de `mentions` se resuelve a una cuenta así, por orden:
 *   1. La `Person` con ese id tiene `email` y hay una cuenta con ese correo → esa cuenta.
 *   2. La `Person` no tiene correo (o no hay cuenta con él) pero su nombre coincide (sin mayúsculas ni acentos) con el
 *      `author.name` de comentarios firmados con cuenta (`author.userId`) en el mismo espacio, y todos esos comentarios
 *      son de la misma cuenta → esa cuenta (`userId`). Si el nombre lo usan varias cuentas, no se notifica a nadie.
 *   3. No hay `Person` con ese id pero el id es el de una cuenta (`usr_…`) → esa cuenta (menciones directas a cuentas).
 * Después se descartan el propio autor (`author.userId`) y quien no tenga acceso al espacio (dueño, miembro o
 * administrador): una mención no da acceso ni filtra el contenido a quien no lo tiene. Cada mención se notifica una
 * sola vez (id determinista por espacio, comentario y cuenta). Con correo y la preferencia «recibir por correo», se
 * envía además un correo inmediato con el extracto.
 */
import type { Logger } from './log';
import type { Mailer } from './mail';
import { mailLang, mentionEmail } from './mail-templates';
import type { Notification, NotificationKind, User, WorkspaceStore } from './store/types';
import { toHex } from './auth';

/** Lo que el servidor lee de un comentario y de una persona del documento (JSON del `Y.Map`). */
export interface CommentLike { id?: unknown; threadId?: unknown; text?: unknown; mentions?: unknown; createdAt?: unknown; anchor?: unknown; author?: unknown }
export interface PersonLike { id?: unknown; name?: unknown; email?: unknown }
export interface MentionContext { people: Record<string, PersonLike>; comments: Record<string, CommentLike> }

/** Ventana de «comentario nuevo» (las menciones en comentarios más antiguos no se notifican). */
export const MENTION_WINDOW_MS = 24 * 3_600_000;
const MAX_MENTIONS = 20;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const authorOf = (c: CommentLike): { name: string; userId: string } => {
  const a = (c.author && typeof c.author === 'object' ? c.author : {}) as Record<string, unknown>;
  return { name: str(a.name), userId: str(a.userId) };
};

/** ¿Es un comentario «nuevo» (creado hace menos de `MENTION_WINDOW_MS`; se toleran 5 min de reloj adelantado)? */
export function isFreshComment(c: CommentLike, now = Date.now()): boolean {
  const t = Date.parse(str(c.createdAt));
  return Number.isFinite(t) && t > now - MENTION_WINDOW_MS && t < now + 5 * 60_000;
}

/** Cuentas mencionadas en un comentario según la regla de arriba (sin filtrar aún por acceso ni autor). */
export async function resolveMentions(store: Pick<WorkspaceStore, 'getUser' | 'getUserByEmail'>, comment: CommentLike, ctx: MentionContext): Promise<User[]> {
  const ids = [...new Set((Array.isArray(comment.mentions) ? comment.mentions : []).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))].slice(0, MAX_MENTIONS);
  const out = new Map<string, User>();
  for (const id of ids) {
    const person = ctx.people[id];
    let user: User | null = null;
    if (person) {
      const email = str(person.email).trim();
      if (email) user = await store.getUserByEmail(email);
      const name = fold(str(person.name));
      if (!user && name) {
        const owners = new Set(Object.values(ctx.comments).map(authorOf).filter(a => a.userId && fold(a.name) === name).map(a => a.userId));
        if (owners.size === 1) user = await store.getUser([...owners][0]!);
      }
    } else if (/^usr_/.test(id)) user = await store.getUser(id);
    if (user) out.set(user.id, user);
  }
  return [...out.values()];
}

/** Id determinista de la notificación de una mención (idempotente: restaurar o reenviar el comentario no la repite). */
export async function mentionNotificationId(workspaceId: string, commentId: string, userId: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mention\u0000${workspaceId}\u0000${commentId}\u0000${userId}`));
  return `ntf_m${toHex(d).slice(0, 30)}`;
}

/** Ruta de la app (hash) a lo notificado: el espacio y, en las menciones con vista conocida, esa vista. */
export function notificationHref(n: Pick<Notification, 'workspaceId' | 'payload'>): string | null {
  if (!n.workspaceId) return null;
  const view = typeof n.payload.viewId === 'string' && n.payload.viewId ? `/v/${encodeURIComponent(n.payload.viewId)}` : '';
  return `#/s/${encodeURIComponent(n.workspaceId)}${view}`;
}

export interface NotifierDeps { store: WorkspaceStore; mailer: Mailer; logger: Logger; publicUrl: string | null }
export interface NotifyInput { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }

export class Notifier {
  constructor(private deps: NotifierDeps) {}
  get mailer() { return this.deps.mailer; }

  /**
   * Guarda una notificación (y, si es una mención y la cuenta quiere correo, lo envía). Nunca lanza: es un efecto
   * secundario de otra operación ya hecha. `baseUrl` (de la petición) para los enlaces si no hay `PUBLIC_URL`.
   */
  async notify(n: NotifyInput, baseUrl?: string): Promise<Notification | null> {
    const { store, logger } = this.deps;
    try {
      const row = await store.createNotification(n);
      if (row && n.kind === 'mention') await this.mailMention(row, baseUrl);
      return row;
    } catch (e) {
      logger.error('no se pudo guardar la notificación', { kind: n.kind, user: n.userId, err: e });
      return null;
    }
  }

  private async mailMention(n: Notification, baseUrl?: string) {
    const { store, mailer, logger, publicUrl } = this.deps;
    if (!mailer.enabled) return;
    const u = await store.getUser(n.userId);
    if (!u?.notifyEmail) return;
    const base = (publicUrl ?? baseUrl ?? '').replace(/\/+$/, '');
    const href = notificationHref(n);
    const p = n.payload;
    const lang = mailLang(u.locale);
    const body = mentionEmail({
      lang, name: u.name, actor: str(p.actorName) || (lang === 'en' ? 'Someone' : 'Alguien'), workspace: str(p.workspaceName) || (lang === 'en' ? 'Untitled' : 'Sin nombre'),
      excerpt: str(p.excerpt), url: `${base}/${href ?? '#/'}`, prefsUrl: `${base}/#/keys`,
    });
    try { await mailer.send({ to: u.email, ...body }); logger.info('correo de mención enviado', { user: u.id }); }
    catch (e) { logger.error('no se pudo enviar el correo de mención', { user: u.id, err: e }); }
  }

  /** Notifica las menciones de comentarios recién añadidos a un espacio (`LiveDoc.onNewComments`). */
  async mentions(workspaceId: string, comments: CommentLike[], ctx: MentionContext, baseUrl?: string): Promise<number> {
    const { store, logger } = this.deps;
    let n = 0;
    try {
      const ws = await store.getWorkspace(workspaceId);
      if (!ws) return 0;
      for (const c of comments) {
        const commentId = str(c.id);
        if (!commentId || !isFreshComment(c)) continue;
        const author = authorOf(c);
        for (const u of await resolveMentions(store, c, ctx)) {
          if (u.id === author.userId) continue;
          if (!u.isAdmin && !(await store.getRole(workspaceId, u.id))) continue;
          const anchor = (c.anchor && typeof c.anchor === 'object' ? c.anchor : {}) as Record<string, unknown>;
          const viewId = str(anchor.viewId) || (anchor.kind === 'view' ? str(anchor.id) : '');
          const text = str(c.text).replace(/\s+/g, ' ').trim();
          const row = await this.notify({
            id: await mentionNotificationId(workspaceId, commentId, u.id), userId: u.id, kind: 'mention', workspaceId,
            payload: { workspaceName: ws.name, actorName: author.name || null, actorId: author.userId || null, commentId, threadId: str(c.threadId) || commentId, excerpt: text.length > 200 ? `${text.slice(0, 199)}…` : text, ...(viewId ? { viewId } : {}) },
          }, baseUrl);
          if (row) n++;
        }
      }
    } catch (e) { logger.error('no se pudieron procesar las menciones', { workspace: workspaceId, err: e }); }
    return n;
  }
}

/** Lo que `Notifier.mentions` necesita del documento vivo (personas y comentarios como JSON). */
export function mentionContextOf(doc: { getMap(name: string): { toJSON(): Record<string, unknown> } }): MentionContext {
  return { people: doc.getMap('people').toJSON() as Record<string, PersonLike>, comments: doc.getMap('comments').toJSON() as Record<string, CommentLike> };
}
