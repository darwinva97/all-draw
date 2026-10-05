/**
 * Rutas del centro de documentación. Sin dependencias: cualquier pantalla puede importarlo para enlazar a la ayuda
 * sin arrastrar el visor (que se carga perezosamente desde `App.tsx`).
 *
 *   docHref()                         → '#/docs'
 *   docHref('conceptos')              → '#/docs/conceptos'
 *   docHref('conceptos', 'pines')     → '#/docs/conceptos#pines'
 *   docHref('notaciones/bpmn')        → '#/docs/notaciones/bpmn'
 */

export const DOC_NOTATION_IDS = ['archimate', 'bpmn', 'statechart', 'c4', 'grid', 'freeform', 'sequence', 'er', 'uml', 'mindmap', 'flow', 'dfd', 'usecase', 'component', 'deployment', 'activity', 'gantt', 'ddd'] as const;
export type DocNotationId = (typeof DOC_NOTATION_IDS)[number];

export type DocSlug =
  | 'primeros-pasos' | 'conceptos' | 'modelo-y-vistas' | 'editor' | 'notaciones' | `notaciones/${DocNotationId}`
  | 'librerias-reglas-personas' | 'compartir-y-colaborar' | 'comentarios' | 'historial' | 'importar-exportar'
  | 'agentes-y-api' | 'simulacion' | 'generar-codigo' | 'dsl' | 'atajos' | 'glosario' | 'faq' | 'privacidad' | 'terminos' | 'novedades';

/** Todos los capítulos, en el orden de lectura del índice. */
export const DOC_SLUGS: readonly DocSlug[] = [
  'primeros-pasos', 'conceptos', 'modelo-y-vistas', 'faq', 'glosario',
  'editor', 'librerias-reglas-personas', 'importar-exportar', 'atajos',
  'notaciones', ...DOC_NOTATION_IDS.map((id): DocSlug => `notaciones/${id}`),
  'compartir-y-colaborar', 'comentarios', 'historial',
  'agentes-y-api', 'simulacion', 'generar-codigo', 'dsl', 'novedades',
  'privacidad', 'terminos',
];

export function isDocSlug(s: string): s is DocSlug { return (DOC_SLUGS as readonly string[]).includes(s); }

/** Enlace a un capítulo (o al índice) y, opcionalmente, a un ancla `{#id}` dentro de él. */
/** Acepta también `notaciones/${string}` para poder construir el enlace desde el id de un pack. */
export function docHref(slug?: DocSlug | `notaciones/${string}` | '', anchor?: string, query?: string): string {
  let h = slug ? `#/docs/${slug}` : '#/docs';
  if (query) h += `?q=${encodeURIComponent(query)}`;
  if (anchor) h += `#${anchor}`;
  return h;
}

export interface DocsRoute { slug: string; anchor: string | null; q: string | null }

/**
 * Interpreta `location.hash`. Devuelve `null` si no es del centro de documentación.
 * Acepta `#/docs/<slug>#<id>` (forma canónica) y `#/docs/<slug>?h=<id>`; `?q=` lleva el texto a resaltar.
 */
export function parseDocsHash(hash: string): DocsRoute | null {
  if (!hash.startsWith('#/docs')) return null;
  let rest = hash.slice('#/docs'.length);
  if (rest && !/^[/?#]/.test(rest)) return null;
  let anchor: string | null = null;
  const hashAt = rest.indexOf('#');
  if (hashAt >= 0) { anchor = rest.slice(hashAt + 1) || null; rest = rest.slice(0, hashAt); }
  let query = '';
  const qAt = rest.indexOf('?');
  if (qAt >= 0) { query = rest.slice(qAt + 1); rest = rest.slice(0, qAt); }
  const params = new URLSearchParams(query);
  const slug = decodeURIComponent(rest.replace(/^\/+|\/+$/g, ''));
  if (!anchor) anchor = params.get('h');
  if (anchor) { try { anchor = decodeURIComponent(anchor); } catch { /* ancla tal cual */ } }
  return { slug, anchor, q: params.get('q') };
}
