/**
 * Búsqueda global (paleta de comandos, Ctrl+K). Funciones puras: buscan elementos por nombre,
 * documentación, etiquetas, propiedades y valores de campo; vistas por nombre; y acciones por
 * su etiqueta. La interfaz decide qué hacer con cada resultado.
 */
import { fieldText, normText, type Element, type NotationRegistry, type Store, type View } from '@all-draw/core';
import { t } from '@all-draw/i18n';

export type SearchHit =
  | { kind: 'element'; id: string; label: string; hint: string; score: number; element: Element; /** Vistas en las que aparece. */ viewIds: string[] }
  | { kind: 'view'; id: string; label: string; hint: string; score: number; view: View }
  | { kind: 'action'; id: string; label: string; hint: string; score: number; keywords?: string };

export interface SearchAction {
  id: string; label: string; hint?: string; keywords?: string;
  /** Solo aparece al buscar (no en la lista inicial): p. ej. «Añadir <tipo>», uno por tipo de la notación. */
  searchOnly?: boolean;
}

export interface SearchOptions {
  /** Vista actual: sus elementos puntúan un poco más. */
  viewId?: string | null;
  actions?: SearchAction[];
  limit?: number;
  /** Claves `kind:id` de lo elegido hace poco (la primera, la más reciente): van arriba. */
  recent?: readonly string[];
  /** Solo vistas (modo «Ir a la vista…»). */
  only?: 'views';
}

/**
 * Puntuación de una consulta contra un texto (0 = no casa). Coincidencia exacta > empieza por >
 * empieza una palabra > contiene. Todo normalizado (sin tildes ni mayúsculas).
 */
export function scoreText(query: string, text: string): number {
  const q = normText(query), t = normText(text);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.split(/[\s\-_.:/]+/).some(w => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  // Todas las palabras de la consulta aparecen (en cualquier orden)
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every(w => t.includes(w))) return 30;
  // Con una errata por palabra (letra cambiada, de más, de menos o dos vecinas cruzadas): «conetar», «tarae».
  const tw = t.split(/[\s\-_.:/()«»"',;]+/).filter(Boolean);
  if (words.length && words.every(w => tw.some(x => x.startsWith(w) || fuzzyWord(w, x)))) return 20;
  return 0;
}

/** ¿`a` y `b` están a una edición como mucho? Sustituir, insertar o borrar una letra, o cruzar dos vecinas. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let i = 0; while (i < la && a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [sh, lo] = la < lb ? [a, b] : [b, a];
  let i = 0; while (i < sh.length && sh[i] === lo[i]) i++;
  return sh.slice(i) === lo.slice(i + 1);
}

/** Palabra de la consulta (≥ 3 letras) que casa con `w` entera o con su principio salvo una errata. */
function fuzzyWord(q: string, w: string): boolean {
  if (q.length < 3) return false;
  if (withinOneEdit(q, w)) return true;
  for (const len of [q.length - 1, q.length, q.length + 1]) if (len >= 3 && len < w.length && withinOneEdit(q, w.slice(0, len))) return true;
  return false;
}

const best = (query: string, texts: string[]): number => texts.reduce((m, t) => Math.max(m, scoreText(query, t)), 0);

/** Textos de búsqueda de un elemento: nombre, doc, etiquetas, propiedades y valores de campos. */
export function elementTexts(e: Element): { primary: string[]; secondary: string[] } {
  const props = Object.entries(e.props).map(([k, v]) => `${k} ${v}`);
  const fields = Object.values(e.fields).map(fieldText).filter(Boolean);
  return { primary: [e.name], secondary: [e.doc, ...e.tags, ...props, ...fields] };
}

export function searchWorkspace(store: Store, reg: NotationRegistry | undefined, query: string, opts: SearchOptions = {}): SearchHit[] {
  const q = query.trim();
  const limit = opts.limit ?? 30;
  const hits: SearchHit[] = [];
  const actions = opts.actions ?? [];

  const recent = opts.recent ?? [];
  const recentRank = (h: SearchHit) => { const i = recent.indexOf(`${h.kind}:${h.id}`); return i < 0 ? -1 : recent.length - i; };

  if (!q) {
    // Sin consulta: lo reciente arriba y después acciones y vistas, para navegar rápido
    if (opts.only !== 'views') for (const a of actions) if (!a.searchOnly || recent.includes(`action:${a.id}`)) hits.push({ kind: 'action', id: a.id, label: a.label, hint: a.hint ?? '', score: 1, keywords: a.keywords });
    for (const v of store.list('views')) hits.push({ kind: 'view', id: v.id, label: v.name || t('(sin nombre)'), hint: reg?.pack(v.notationId)?.name ?? v.notationId, score: v.id === opts.viewId ? 0 : 1, view: v });
    if (opts.only !== 'views') {
      for (const key of recent) {
        if (!key.startsWith('element:')) continue;
        const e = store.get('elements', key.slice('element:'.length));
        if (!e || e.template) continue;
        const viewIds = [...new Set(store.list('nodes').filter(n => n.elementId === e.id).map(n => n.viewId))];
        hits.push({ kind: 'element', id: e.id, label: e.name || t('(sin nombre)'), hint: reg?.elementType(e.typeId)?.name ?? e.typeId, score: 1, element: e, viewIds });
      }
    }
    // Orden estable: primero lo reciente (por recencia), el resto como venía.
    const ranked = hits.map((h, i) => ({ h, i, r: recentRank(h) }));
    ranked.sort((a, b) => (b.r - a.r) || (a.i - b.i));
    return ranked.map(x => x.h).slice(0, limit);
  }

  if (opts.only === 'views') {
    for (const v of store.list('views')) {
      const s = Math.max(scoreText(q, v.name), scoreText(q, reg?.pack(v.notationId)?.name ?? '') * 0.5, scoreText(q, v.doc) * 0.6);
      if (s) hits.push({ kind: 'view', id: v.id, label: v.name || t('(sin nombre)'), hint: reg?.pack(v.notationId)?.name ?? v.notationId, score: s + Math.max(0, recentRank({ kind: 'view', id: v.id } as SearchHit)), view: v });
    }
    return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'es')).slice(0, limit);
  }

  for (const a of actions) {
    const s = best(q, [a.label, a.keywords ?? '']);
    if (s) hits.push({ kind: 'action', id: a.id, label: a.label, hint: a.hint ?? '', score: s + 5, keywords: a.keywords });
  }
  for (const v of store.list('views')) {
    const s = Math.max(scoreText(q, v.name), scoreText(q, v.doc) * 0.6);
    if (s) hits.push({ kind: 'view', id: v.id, label: v.name || t('(sin nombre)'), hint: `${t('Vista')} · ${reg?.pack(v.notationId)?.name ?? v.notationId}`, score: s + 2, view: v });
  }
  const byElement = new Map<string, string[]>();
  for (const n of store.list('nodes')) if (n.elementId) { const l = byElement.get(n.elementId) ?? []; if (!l.includes(n.viewId)) l.push(n.viewId); byElement.set(n.elementId, l); }
  for (const e of store.list('elements')) {
    if (e.template) continue;
    const { primary, secondary } = elementTexts(e);
    const s = Math.max(best(q, primary), best(q, secondary) * 0.7);
    if (!s) continue;
    const viewIds = byElement.get(e.id) ?? [];
    const typeName = reg?.elementType(e.typeId)?.name ?? e.typeId;
    const where = viewIds.length === 0 ? t('sin vista') : viewIds.includes(opts.viewId ?? '') ? t('en esta vista') : viewIds.length === 1 ? t('1 vista') : t('{n} vistas', { n: viewIds.length });
    hits.push({ kind: 'element', id: e.id, label: e.name || t('(sin nombre)'), hint: `${typeName} · ${where}`, score: s + (viewIds.includes(opts.viewId ?? '') ? 3 : 0), element: e, viewIds });
  }
  // Lo elegido hace poco sube un poco (sin pasar por delante de una coincidencia claramente mejor).
  for (const h of hits) { const r = recentRank(h); if (r > 0) h.score += 4 + r; }
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'es')).slice(0, limit);
}
