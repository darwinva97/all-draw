/**
 * Lógica pura del panel de comentarios (sin React): autor, menciones `@persona`, fechas relativas,
 * etiqueta y destino de un ancla. Se prueba en `test/comments.test.ts`.
 */
import { anchorViewIds, indexOf, type Comment, type CommentAnchor, type CommentAuthor, type Person, type Store } from '@all-draw/core';
import type { t as T } from '@all-draw/i18n';
import type { PresenceMe } from '../presence';

export const ME_KEY = 'alldraw:me';

const nameListeners = new Set<() => void>();
const storage = (): Storage | undefined => { try { return globalThis.localStorage ?? undefined; } catch { return undefined; } };

/**
 * Nombre local estable (sin presencia, p. ej. en un espacio local): el guardado en `localStorage('alldraw:me')`
 * o, la primera vez, `generate()` (p. ej. "Anónimo 123"), que se guarda para que no cambie entre sesiones.
 */
export function localAuthorName(generate: () => string): string {
  const ls = storage();
  let stored: string | null = null;
  try { stored = ls?.getItem(ME_KEY) ?? null; } catch { /* sin almacenamiento */ }
  if (stored?.trim()) return stored.trim();
  const name = generate();
  try { ls?.setItem(ME_KEY, name); } catch { /* sin almacenamiento */ }
  return name;
}

/** Cambia el nombre local (campo "Tu nombre"). Vacío no se guarda. Avisa a quien escuche (`onLocalAuthorName`). */
export function saveLocalAuthorName(name: string): void {
  const v = name.trim();
  if (!v) return;
  try { storage()?.setItem(ME_KEY, v); } catch { /* sin almacenamiento */ }
  for (const f of nameListeners) f();
}
export function onLocalAuthorName(f: () => void): () => void { nameListeners.add(f); return () => { nameListeners.delete(f); }; }

/** "Anónimo 123": número de 3 cifras al azar para distinguir a varios anónimos. */
export const anonymousNumber = (): number => 100 + Math.floor(Math.random() * 900);

/**
 * Autor de los comentarios propios: la presencia si la app la da (con `userId` si hay cuenta: así se reconocen los
 * propios aunque cambie el nombre); si no, el nombre local estable (`localAuthorName`), generado con `fallback`.
 */
export function commentAuthor(me: PresenceMe | null | undefined, fallback: string | (() => string)): CommentAuthor {
  if (me?.name) return { name: me.name, color: me.color, ...(me.userId ? { userId: me.userId } : {}) };
  return { name: localAuthorName(typeof fallback === 'function' ? fallback : () => fallback) };
}

/** ¿Lo escribí yo? Por `userId` si ambos lo tienen; si no, por nombre. */
export function isOwn(c: Pick<Comment, 'author'>, me: CommentAuthor): boolean {
  if (c.author.userId && me.userId) return c.author.userId === me.userId;
  return c.author.name === me.name;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `@consulta` que se está escribiendo justo antes del cursor (o null). */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = /(^|[\s(\[{,;])@([^\s@]{0,40})$/u.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[2]!.length - 1, query: m[2]! };
}

/** Sustituye la `@consulta` que empieza en `start` por `@Nombre ` y devuelve el texto y el cursor nuevos. */
export function applyMention(text: string, caret: number, start: number, name: string): { text: string; caret: number } {
  const ins = `@${name} `;
  const rest = text.slice(caret).replace(/^[^\s@]*/u, '').replace(/^ /, '');
  return { text: text.slice(0, start) + ins + rest, caret: start + ins.length };
}

/** Personas que encajan con la consulta (por inicio de cualquier palabra, sin acentos), como mucho `limit`. */
export function matchPeople(people: Person[], query: string, limit = 6): Person[] {
  const q = fold(query.trim());
  const named = people.filter(p => p.name.trim());
  const hit = (p: Person) => !q || fold(p.name).split(/\s+/).some(w => w.startsWith(q)) || fold(p.name).startsWith(q) || (!!p.email && fold(p.email).startsWith(q));
  return named.filter(hit).sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
}

/** ¿Hay `@nombre` en `text` seguido de un final de palabra? */
function hasMention(text: string, name: string): boolean {
  const needle = `@${name}`;
  let i = text.indexOf(needle);
  while (i >= 0) {
    const next = text[i + needle.length];
    if (next === undefined || !/[\p{L}\p{N}_]/u.test(next)) return true;
    i = text.indexOf(needle, i + 1);
  }
  return false;
}

/** Ids de las personas mencionadas en el texto (`@Nombre completo`). Quitar el texto quita la mención. */
export function mentionsIn(text: string, people: Person[]): string[] {
  return people.filter(p => p.name.trim() && hasMention(text, p.name.trim())).map(p => p.id);
}

/** Trocea el texto para pintar las menciones: `[{ text }, { text: '@Ana', person }, …]`. */
export function splitMentions(text: string, people: Person[]): { text: string; person?: Person }[] {
  const byLen = people.filter(p => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
  const out: { text: string; person?: Person }[] = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '@') {
      const p = byLen.find(pp => text.startsWith(`@${pp.name.trim()}`, i) && !/[\p{L}\p{N}_]/u.test(text[i + pp.name.trim().length + 1] ?? ' '));
      if (p) {
        if (buf) { out.push({ text: buf }); buf = ''; }
        const len = p.name.trim().length + 1;
        out.push({ text: text.slice(i, i + len), person: p });
        i += len; continue;
      }
    }
    buf += text[i]; i++;
  }
  if (buf) out.push({ text: buf });
  return out;
}

/** "hace 5 min", "ayer"… con `Intl.RelativeTimeFormat` en el idioma dado. */
export function relativeTime(iso: string, now: number, lang: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return '';
  const s = Math.round((d - now) / 1000);
  const abs = Math.abs(s);
  let rtf: Intl.RelativeTimeFormat;
  try { rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' }); } catch { return new Date(d).toLocaleString(); }
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  try { return new Date(d).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return new Date(d).toDateString(); }
}

/** Icono y nombre legible del ancla de un hilo. */
export function anchorLabel(store: Store, a: CommentAnchor, t: typeof T): { icon: string; label: string; missing: boolean } {
  const elName = (id?: string) => { const e = id ? store.get('elements', id) : undefined; return e ? (e.name || t('(sin nombre)')) : undefined; };
  const relName = (id?: string) => {
    const r = id ? store.get('relations', id) : undefined; if (!r) return undefined;
    return r.name || `${elName(r.from.elementId) ?? '?'} → ${elName(r.to.elementId) ?? '?'}`;
  };
  const missing = (icon: string) => ({ icon, label: t('(ancla borrada)'), missing: true });
  switch (a.kind) {
    case 'element': { const n = elName(a.id); return n ? { icon: '◆', label: n, missing: false } : missing('◆'); }
    case 'relation': { const n = relName(a.id); return n ? { icon: '↗', label: n, missing: false } : missing('↗'); }
    case 'node': {
      const vn = a.id ? store.get('nodes', a.id) : undefined; if (!vn) return missing('▭');
      return { icon: '▭', label: elName(vn.elementId) ?? (vn.text || t('Nota')), missing: false };
    }
    case 'edge': {
      const ve = a.id ? store.get('edges', a.id) : undefined; if (!ve) return missing('↗');
      const name = ve.label || relName(ve.relationId);
      const ends = () => { const f = store.get('nodes', ve.fromNodeId), to = store.get('nodes', ve.toNodeId); return `${elName(f?.elementId) ?? f?.text ?? '?'} → ${elName(to?.elementId) ?? to?.text ?? '?'}`; };
      return { icon: '↗', label: name || ends(), missing: false };
    }
    case 'view': {
      const v = a.id ? store.get('views', a.id) : undefined;
      return v ? { icon: '▦', label: t('Vista {name}', { name: v.name }), missing: false } : { icon: '▦', label: t('Sin ancla (lo comentado se borró)'), missing: true };
    }
    case 'point': {
      const v = a.viewId ? store.get('views', a.viewId) : undefined;
      return v ? { icon: '◎', label: t('Punto en {name}', { name: v.name }), missing: false } : missing('◎');
    }
  }
}

/** Adónde ir para ver un ancla: vista (la actual si el ancla aparece en ella) y qué seleccionar. */
export function anchorTarget(store: Store, a: CommentAnchor, currentViewId: string | null): { viewId: string; nodes: string[]; edges: string[] } | null {
  const views = anchorViewIds(store, a).filter(v => store.get('views', v));
  if (!views.length) return null;
  const viewId = currentViewId && views.includes(currentViewId) ? currentViewId : views[0]!;
  const idx = indexOf(store);
  switch (a.kind) {
    case 'node': return { viewId, nodes: a.id ? [a.id] : [], edges: [] };
    case 'edge': return { viewId, nodes: [], edges: a.id ? [a.id] : [] };
    case 'element': return { viewId, nodes: idx.nodesOfElement(a.id ?? '').filter(n => n.viewId === viewId).slice(0, 1).map(n => n.id), edges: [] };
    case 'relation': return { viewId, nodes: [], edges: idx.edgesOfRelation(a.id ?? '').filter(e => e.viewId === viewId).slice(0, 1).map(e => e.id) };
    default: return { viewId, nodes: [], edges: [] };
  }
}

/** Nodos a encuadrar para un ancla en una vista (vacío = punto o vista entera). */
export function anchorNodesIn(store: Store, a: CommentAnchor, viewId: string): string[] {
  const idx = indexOf(store);
  switch (a.kind) {
    case 'node': return a.id && store.get('nodes', a.id)?.viewId === viewId ? [a.id] : [];
    case 'element': return idx.nodesOfElement(a.id ?? '').filter(n => n.viewId === viewId).map(n => n.id);
    case 'edge': { const e = a.id ? store.get('edges', a.id) : undefined; return e && e.viewId === viewId ? [e.fromNodeId, e.toNodeId] : []; }
    case 'relation': return idx.edgesOfRelation(a.id ?? '').filter(e => e.viewId === viewId).flatMap(e => [e.fromNodeId, e.toNodeId]);
    default: return [];
  }
}
