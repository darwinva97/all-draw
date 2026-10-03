/**
 * Miniaturas SVG generadas con la propia app (`renderSvg` de `@all-draw/io`, que se carga bajo demanda).
 * Se cachean en memoria por clave (plantilla/idioma/tema o espacio/fecha/tema) y se calculan de una en una en
 * huecos de inactividad para no trabar la página.
 */
import { MemoryStore, loadInto, type NotationRegistry, type Store, type Workspace } from '@all-draw/core';
import { openLocalWorkspace } from '@all-draw/sync';
import type { Lang } from '@all-draw/i18n';
import { createRegistry } from './registry';

export type ThumbTheme = 'light' | 'dark';
const cache = new Map<string, string | null>();
const regs = new Map<Lang, NotationRegistry>();
const io = () => import('@all-draw/io');
let chain: Promise<unknown> = Promise.resolve();

function idle(): Promise<void> {
  return new Promise(res => {
    const g = globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (g.requestIdleCallback) g.requestIdleCallback(() => res(), { timeout: 400 }); else setTimeout(res, 16);
  });
}
/** Ejecuta las tareas de una en una (en orden de petición). */
function queue<T>(job: () => Promise<T>): Promise<T> {
  const p = chain.then(idle).then(job);
  chain = p.catch(() => undefined);
  return p;
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Vista principal: la actual del espacio o la primera con nodos. */
export function mainViewId(store: Store): string | null {
  const cur = store.meta().currentViewId;
  if (cur && store.get('views', cur)) return cur;
  const views = store.list('views');
  const withNodes = new Set(store.list('nodes').map(n => n.viewId));
  return (views.find(v => withNodes.has(v.id)) ?? views[0])?.id ?? null;
}

async function render(store: Store, lang: Lang, theme: ThumbTheme, viewId?: string | null): Promise<string | null> {
  const vid = viewId ?? mainViewId(store);
  if (!vid) return null;
  if (!store.list('nodes').some(n => n.viewId === vid)) return null;
  let reg = regs.get(lang);
  if (!reg) { reg = createRegistry(lang); regs.set(lang, reg); }
  reg.syncLibraryTypes(store.list('libraries'));
  const { renderSvg } = await io();
  return svgDataUrl(renderSvg(store, reg, vid, { theme, padding: 18, background: 'transparent', bare: true, idPrefix: `th-${vid}` }));
}

/** Miniatura de un espacio en memoria (plantillas, demo de la portada). `null` si la vista está vacía. */
export function workspaceThumb(key: string, ws: Workspace, lang: Lang, theme: ThumbTheme, viewId?: string): Promise<string | null> {
  const k = `${key}|${lang}|${theme}|${viewId ?? ''}`;
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  return queue(async () => {
    if (cache.has(k)) return cache.get(k)!;
    const store = new MemoryStore(); loadInto(store, ws);
    const url = await render(store, lang, theme, viewId).catch(() => null);
    cache.set(k, url); return url;
  });
}

/** Miniatura de un espacio guardado en este navegador (IndexedDB). */
export function localThumb(id: string, stamp: string, lang: Lang, theme: ThumbTheme): Promise<string | null> {
  const k = `local:${id}|${stamp}|${lang}|${theme}`;
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  return queue(async () => {
    if (cache.has(k)) return cache.get(k)!;
    let url: string | null = null;
    const lw = await openLocalWorkspace(id);
    try { await lw.whenSynced; url = await render(lw.store, lang, theme).catch(() => null); }
    finally { lw.destroy(); }
    cache.set(k, url); return url;
  });
}

