/**
 * Lógica de la paleta sin React: agrupar por categoría con su nombre (traducido por `localizePack`) y su orden, y
 * elegir un hueco libre cerca del centro del lienzo para añadir con un clic, Intro o un toque (sin arrastrar).
 */
import type { ElementType, NotationCategory, NotationRegistry, Store } from '@all-draw/core';
import { DND_TYPE, DND_TEMPLATE, DND_ELEMENT, DND_VISUAL, defaultSize } from '../Canvas';

export interface CategoryGroup<T> { key: string; name: string; items: T[] }

/**
 * Agrupa `items` por `category` del tipo. La categoría de un tipo puede ser el id de una categoría del pack
 * (`events`) o ya su nombre: se pinta siempre el **nombre** del pack y los grupos siguen su `order` (los que no
 * están en el pack, como las categorías libres de las librerías, van detrás, por orden de aparición).
 */
export function categoryGroups<T extends { type: ElementType }>(items: T[], categories: NotationCategory[] | undefined, fallback: string): CategoryGroup<T>[] {
  const cats = categories ?? [];
  const find = (c: string) => cats.find(x => x.id === c) ?? cats.find(x => x.name === c);
  const groups = new Map<string, CategoryGroup<T> & { rank: number; seen: number }>();
  for (const it of items) {
    const raw = it.type.category;
    const cat = raw ? find(raw) : undefined;
    const key = cat?.id ?? raw ?? '';
    let g = groups.get(key);
    if (!g) {
      const idx = cat ? cats.indexOf(cat) : -1;
      g = { key, name: cat?.name ?? raw ?? fallback, items: [], rank: cat ? (cat.order ?? idx) : Number.POSITIVE_INFINITY, seen: groups.size };
      groups.set(key, g);
    }
    g.items.push(it);
  }
  return [...groups.values()].sort((a, b) => a.rank - b.rank || a.seen - b.seen).map(({ key, name, items: xs }) => ({ key, name, items: xs }));
}

export interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/**
 * Centro de un hueco de `size` lo más cerca posible de `center` (todo en píxeles de pantalla):
 * - no pisa ningún `obstacles` (con `gap` de aire);
 * - puede caer dentro de un `containers` (pool, grupo, celda), pero no a caballo de su borde;
 * - queda dentro de `bounds`.
 * Prueba puntos de una rejilla de paso `step` ordenados por distancia; si no hay hueco, devuelve `center`.
 */
export function freeSpot(center: { x: number; y: number }, size: { w: number; h: number }, obstacles: Rect[], containers: Rect[], bounds: Rect, gap = 16, step = 24): { x: number; y: number } {
  const fits = (cx: number, cy: number) => {
    const r = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
    if (!inside(r, bounds)) return false;
    const padded = { x: r.x - gap, y: r.y - gap, w: r.w + 2 * gap, h: r.h + 2 * gap };
    if (obstacles.some(o => overlaps(padded, o))) return false;
    return containers.every(c => !overlaps(r, c) || inside(r, c));
  };
  if (fits(center.x, center.y)) return center;
  const maxR = Math.ceil(Math.max(bounds.w, bounds.h) / step);
  const pts: { x: number; y: number; d: number }[] = [];
  for (let i = -maxR; i <= maxR; i++) for (let j = -maxR; j <= maxR; j++) {
    if (!i && !j) continue;
    const x = center.x + i * step, y = center.y + j * step;
    if (x < bounds.x || x > bounds.x + bounds.w || y < bounds.y || y > bounds.y + bounds.h) continue;
    pts.push({ x, y, d: Math.hypot(i * step * 0.8, j * step) }); // un poco antes a los lados que arriba/abajo
  }
  pts.sort((a, b) => a.d - b.d);
  for (const p of pts) if (fits(p.x, p.y)) return { x: p.x, y: p.y };
  return center;
}

/** Lo que lleva un elemento de la paleta (igual que en el arrastre). */
export type PaletteDrag = { kind: typeof DND_TYPE | typeof DND_TEMPLATE | typeof DND_ELEMENT | typeof DND_VISUAL; data: string };

/** Tamaño (en unidades del modelo) del nodo que creará un elemento de la paleta; igual que `Canvas` al soltar. */
export function paletteItemSize(drag: PaletteDrag, store: Store, registry: NotationRegistry): { w: number; h: number } {
  if (drag.kind === DND_VISUAL) {
    let vt = '';
    try { vt = (JSON.parse(drag.data) as { visualType?: string }).visualType ?? ''; } catch { /* payload inválido */ }
    return vt === 'core:group' ? { w: 320, h: 220 } : vt === 'core:image' ? { w: 200, h: 150 } : vt === 'core:label' ? { w: 140, h: 28 } : { w: 180, h: 90 };
  }
  const typeId = drag.kind === DND_TYPE ? drag.data : store.get('elements', drag.data)?.typeId;
  const type = typeId ? registry.elementType(typeId) : undefined;
  return defaultSize(type?.shape, !!type?.container, typeId);
}

/** Ids de los nodos de la vista que hacen de contenedor (grupos, celdas, tipos contenedor o padres de otros nodos). */
export function containerNodeIds(store: Store, registry: NotationRegistry, viewId: string): Set<string> {
  const nodes = store.list('nodes').filter(n => n.viewId === viewId);
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.parentNodeId) out.add(n.parentNodeId);
    if (n.visualType === 'core:group' || n.visualType === 'core:cell') out.add(n.id);
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    if (el && registry.elementType(el.typeId)?.container) out.add(n.id);
  }
  return out;
}

/**
 * Añade al lienzo visible lo que lleva `item` (un elemento de la paleta), en un hueco libre cerca del centro.
 * Reutiliza el mismo `dragstart`/`drop` que el arrastre (con un `DataTransfer` sintético), así el lienzo decide el
 * nodo igual que al soltar. `spread` = false lo deja en el centro (vistas de secuencia, que colocan ellas).
 */
export function addToCanvas(item: HTMLElement, sizeModel: { w: number; h: number }, containers: Set<string>, spread = true): boolean {
  const pane = document.querySelector<HTMLElement>('.ad-canvas .react-flow__pane');
  if (!pane || typeof DataTransfer === 'undefined' || typeof DragEvent === 'undefined') return false;
  const r = pane.getBoundingClientRect();
  const bounds = { x: r.left, y: r.top, w: r.width, h: r.height };
  const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  let at = center;
  if (spread) {
    const vp = document.querySelector<HTMLElement>('.ad-canvas .react-flow__viewport');
    let zoom = 1;
    try { zoom = vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform).a || 1 : 1; } catch { /* sin transform */ }
    const obstacles: Rect[] = [], boxes: Rect[] = [];
    for (const n of document.querySelectorAll<HTMLElement>('.ad-canvas .react-flow__node')) {
      const b = n.getBoundingClientRect();
      if (!b.width || !overlaps({ x: b.left, y: b.top, w: b.width, h: b.height }, bounds)) continue;
      (containers.has(n.dataset.id ?? '') ? boxes : obstacles).push({ x: b.left, y: b.top, w: b.width, h: b.height });
    }
    // Lo que tapa el lienzo (minimapa, controles, barra de alinear) también cuenta como ocupado.
    for (const o of document.querySelectorAll<HTMLElement>('.ad-canvas .react-flow__minimap, .ad-canvas .react-flow__controls')) {
      const b = o.getBoundingClientRect(); if (b.width) obstacles.push({ x: b.left, y: b.top, w: b.width, h: b.height });
    }
    at = freeSpot(center, { w: sizeModel.w * zoom, h: sizeModel.h * zoom }, obstacles, boxes, bounds);
  }
  const dt = new DataTransfer();
  item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: at.x, clientY: at.y }));
  return true;
}

/**
 * Añade al lienzo visible un elemento de la paleta sin que haya un elemento de la paleta en pantalla (Ctrl+K →
 * «Añadir <tipo>»): un emisor temporal hace el mismo `dragstart` que la paleta y se suelta igual que con un clic.
 */
export function addPayloadToCanvas(payload: PaletteDrag, store: Store, registry: NotationRegistry, viewId: string, spread = true): boolean {
  if (typeof document === 'undefined') return false;
  const source = document.createElement('div');
  source.addEventListener('dragstart', e => { e.dataTransfer?.setData(payload.kind, payload.data); });
  return addToCanvas(source, paletteItemSize(payload, store, registry), containerNodeIds(store, registry, viewId), spread);
}
