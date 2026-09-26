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

export interface SearchAction { id: string; label: string; hint?: string; keywords?: string }

export interface SearchOptions {
  /** Vista actual: sus elementos puntúan un poco más. */
  viewId?: string | null;
  actions?: SearchAction[];
  limit?: number;
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
  return 0;
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

  if (!q) {
    // Sin consulta: acciones y vistas, para navegar rápido
    for (const a of actions) hits.push({ kind: 'action', id: a.id, label: a.label, hint: a.hint ?? '', score: 1, keywords: a.keywords });
    for (const v of store.list('views')) hits.push({ kind: 'view', id: v.id, label: v.name || t('(sin nombre)'), hint: reg?.pack(v.notationId)?.name ?? v.notationId, score: v.id === opts.viewId ? 0 : 1, view: v });
    return hits.slice(0, limit);
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
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'es')).slice(0, limit);
}
