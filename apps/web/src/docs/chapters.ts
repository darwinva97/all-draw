/**
 * Índice del manual: grupos de la barra lateral, títulos y descripciones (en español; se traducen con `t()` al
 * pintarlos) y carga perezosa de los `.md` de `docs/manual/` (cada fichero es un trozo aparte del paquete).
 */
import type { Lang } from '@all-draw/i18n';
import { DOC_SLUGS, type DocSlug } from './links';

export type GroupId = 'start' | 'use' | 'notations' | 'collaborate' | 'advanced' | 'legal';

export interface ChapterDef { slug: DocSlug; group: GroupId; title: string; summary: string; packId?: string }

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: 'start', name: 'Empezar' },
  { id: 'use', name: 'Usar' },
  { id: 'notations', name: 'Notaciones' },
  { id: 'collaborate', name: 'Colaborar' },
  { id: 'advanced', name: 'Avanzado' },
  { id: 'legal', name: 'Legal' },
];

const C = (slug: DocSlug, group: GroupId, title: string, summary: string, packId?: string): ChapterDef => ({ slug, group, title, summary, packId });

/** En el mismo orden que `DOC_SLUGS` (orden de lectura, anterior/siguiente). */
export const CHAPTERS: ChapterDef[] = [
  C('primeros-pasos', 'start', 'Primeros pasos', 'Crea tu primer espacio, abre la demo y aprende a moverte.'),
  C('conceptos', 'start', 'Conceptos', 'Modelo y vistas, dimensiones, pines, trazas y viewpoints.'),
  C('modelo-y-vistas', 'start', 'Modelo y vistas', 'Crear vistas, saltar entre dimensiones y entrar en el detalle.'),
  C('faq', 'start', 'Preguntas frecuentes', 'Respuestas cortas a las dudas más habituales.'),
  C('glosario', 'start', 'Glosario', 'Cada término de all-draw explicado en una frase.'),
  C('editor', 'use', 'El editor', 'Paleta, lienzo, inspector, conexiones, alineación y problemas.'),
  C('librerias-reglas-personas', 'use', 'Librerías, reglas y personas', 'Tipos propios, componentes reutilizables, colores por datos y responsables.'),
  C('importar-exportar', 'use', 'Importar y exportar', 'Archi, BPMN, Mermaid, Drawer, OpenAPI, imágenes y copias de seguridad.'),
  C('atajos', 'use', 'Atajos de teclado', 'Teclas y gestos para trabajar más rápido.'),
  C('notaciones', 'notations', 'Elegir una notación', 'Qué notación usar para cada cosa y cómo se combinan.'),
  C('notaciones/archimate', 'notations', 'ArchiMate', 'Arquitectura empresarial: negocio, aplicaciones y tecnología.', 'archimate'),
  C('notaciones/bpmn', 'notations', 'BPMN', 'Procesos de negocio paso a paso.', 'bpmn'),
  C('notaciones/statechart', 'notations', 'Máquina de estados', 'Ciclos de vida con estados y transiciones.', 'statechart'),
  C('notaciones/c4', 'notations', 'C4', 'Arquitectura de software en cuatro niveles.', 'c4'),
  C('notaciones/grid', 'notations', 'Capas × etapas', 'Tableros y mapas en rejilla.', 'grid'),
  C('notaciones/freeform', 'notations', 'Libre', 'Formas y flechas sin reglas.', 'freeform'),
  C('notaciones/sequence', 'notations', 'Secuencia', 'Mensajes entre participantes a lo largo del tiempo.', 'sequence'),
  C('notaciones/er', 'notations', 'Entidad-relación', 'Modelos de datos con cardinalidades.', 'er'),
  C('notaciones/uml', 'notations', 'Clases UML', 'Clases, interfaces y sus relaciones.', 'uml'),
  C('notaciones/mindmap', 'notations', 'Mapa mental', 'Ideas que se ramifican desde un centro.', 'mindmap'),
  C('notaciones/flow', 'notations', 'Diagrama de flujo', 'Algoritmos y decisiones.', 'flow'),
  C('notaciones/dfd', 'notations', 'Flujo de datos (DFD)', 'Procesos, almacenes y flujos de datos.', 'dfd'),
  C('compartir-y-colaborar', 'collaborate', 'Compartir y colaborar', 'Cuentas, roles, enlaces, presencia y trabajo sin conexión.'),
  C('comentarios', 'collaborate', 'Comentarios', 'Conversaciones ancladas a lo que estás dibujando.'),
  C('historial', 'collaborate', 'Historial', 'Instantáneas para volver a una versión anterior.'),
  C('agentes-y-api', 'advanced', 'Agentes y API', 'Claves API, REST, MCP y tu propio servidor.'),
  C('novedades', 'advanced', 'Novedades', 'Qué ha cambiado en cada versión.'),
  C('privacidad', 'legal', 'Privacidad', 'Qué datos se guardan, dónde y cómo borrarlos.'),
  C('terminos', 'legal', 'Términos de uso', 'Condiciones del servicio.'),
];

if (import.meta.env.DEV && CHAPTERS.map(c => c.slug).join() !== DOC_SLUGS.join()) console.warn('docs: CHAPTERS y DOC_SLUGS no coinciden');

export const chapterOf = (slug: string): ChapterDef | undefined => CHAPTERS.find(c => c.slug === slug);

// ---------------------------------------------------------------- Ficheros
/** `../../../../docs/manual/en/conceptos.md` → `() => import(…?raw)`. Un trozo por fichero. */
const FILES = import.meta.glob<string>('../../../../docs/manual/**/*.md', { query: '?raw', import: 'default' });
const PREFIX = '../../../../docs/manual/';

/** Ruta del fichero relativa a `docs/manual/` (p. ej. `en/notaciones/bpmn.md`). */
export function fileFor(lang: Lang, slug: string): string { return `${lang === 'es' ? '' : `${lang}/`}${slug}.md`; }
export function hasFile(lang: Lang, slug: string): boolean { return `${PREFIX}${fileFor(lang, slug)}` in FILES; }

export interface LoadedChapter { slug: string; source: string; file: string; lang: Lang; fallback: boolean }

const cache = new Map<string, Promise<LoadedChapter | null>>();

/** Carga el capítulo en `lang`; si no existe, en español (`fallback: true`). `null` si no existe en ninguno. */
export function loadChapter(lang: Lang, slug: string): Promise<LoadedChapter | null> {
  const key = `${lang}:${slug}`;
  let p = cache.get(key);
  if (!p) {
    const pick: Lang | null = hasFile(lang, slug) ? lang : hasFile('es', slug) ? 'es' : null;
    p = pick
      ? FILES[`${PREFIX}${fileFor(pick, slug)}`]!().then(source => ({ slug, source, file: fileFor(pick, slug), lang: pick, fallback: pick !== lang }))
      : Promise.resolve(null);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Todos los capítulos de un idioma (para la búsqueda). */
export async function loadAll(lang: Lang): Promise<LoadedChapter[]> {
  const all = await Promise.all(CHAPTERS.map(c => loadChapter(lang, c.slug).catch(() => null)));
  return all.filter((c): c is LoadedChapter => !!c);
}

export const GITHUB_REPO = 'https://github.com/darwinva97/all-draw';
export const editUrl = (file: string): string => `${GITHUB_REPO}/edit/main/docs/manual/${file}`;
