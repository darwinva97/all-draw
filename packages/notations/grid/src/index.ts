/**
 * Pack **capas × etapas**: no es una notación con tipos propios sino una **clase de vista**
 * (`View.kind = 'grid'`) en la que cada nodo vive en una celda `{ layerId, stageId }`. Los
 * elementos que aparecen en ella son de cualquier otra notación (freeform, librerías…).
 *
 * Aquí viven también los helpers puros de geometría (`cellRects`, `cellAt`) y las operaciones
 * inmutables sobre el `GridLayout` (`addLayer`, `removeStage`…): sin DOM, usables por el editor,
 * el servidor y los agentes.
 */
import type { GridLayout, NotationPack } from '@all-draw/core';

type Layer = GridLayout['layers'][number];
type Stage = GridLayout['stages'][number];
type StageGroup = GridLayout['stageGroups'][number];

export const GRID_PACK: NotationPack = {
  id: 'grid',
  name: 'Capas × etapas',
  version: '1.0',
  doc: 'Tablero de capas (filas) por etapas (columnas). Los nodos se colocan en celdas; los elementos son de cualquier notación.',
  color: '#0891b2',
  viewKind: 'grid',
  categories: [],
  elementTypes: [],
  relationTypes: [],
  portTypes: [],
  viewpoints: [],
  defaultRelation: 'core:link',
};

export default GRID_PACK;

// ---------------------------------------------------------------- Layout por defecto
export const LAYER_COLORS = ['#fef3c7', '#ede9fe', '#dbeafe', '#d1fae5', '#fce7f3', '#e0f2fe', '#fee2e2', '#ecfccb'];

export const DEFAULT_GRID: GridLayout = {
  layers: [
    { id: 'layer:negocio', name: 'Negocio', color: LAYER_COLORS[0] },
    { id: 'layer:aplicacion', name: 'Aplicación', color: LAYER_COLORS[1] },
    { id: 'layer:tecnologia', name: 'Tecnología', color: LAYER_COLORS[2] },
  ],
  stages: [
    { id: 'stage:1', name: 'Etapa 1', groupId: null },
    { id: 'stage:2', name: 'Etapa 2', groupId: null },
    { id: 'stage:3', name: 'Etapa 3', groupId: null },
    { id: 'stage:4', name: 'Etapa 4', groupId: null },
  ],
  stageGroups: [],
};

// ---------------------------------------------------------------- Geometría
export interface GridOpts {
  /** Ancho de la cabecera de capas (columna izquierda). */
  headerW: number;
  /** Alto de la cabecera de etapas. */
  headerH: number;
  /** Alto de la banda de grupos de etapas (solo si hay grupos). */
  groupH: number;
  defaultLayerH: number;
  defaultStageW: number;
}

export const DEFAULT_GRID_OPTS: GridOpts = { headerW: 140, headerH: 40, groupH: 28, defaultLayerH: 180, defaultStageW: 240 };

export interface Rect { x: number; y: number; w: number; h: number }
export interface CellRect extends Rect { layerId: string; stageId: string }
export interface GroupSpan { groupId: string; stageIds: string[]; rect: Rect }

export interface GridRects {
  /** Tamaño total del tablero (cabeceras incluidas). */
  width: number;
  height: number;
  /** Alto que ocupa la parte superior (banda de grupos + cabecera de etapas). */
  top: number;
  /** Ancho de la cabecera de capas. */
  left: number;
  /** Rect de la cabecera de cada capa (columna izquierda) y de cada etapa (fila superior). */
  layers: Record<string, Rect>;
  stages: Record<string, Rect>;
  /** Caja envolvente de cada grupo de etapas y sus tramos contiguos. */
  groups: Record<string, Rect>;
  spans: GroupSpan[];
  /** Celdas por clave `layerId|stageId`. */
  cells: Record<string, CellRect>;
}

export const cellKey = (layerId: string, stageId: string) => `${layerId}|${stageId}`;

const px = (n: number | undefined, def: number) => (typeof n === 'number' && n > 0 ? n : def);

/** Posición y tamaño en píxeles de cada celda, capa, etapa y grupo. Puro. */
export function cellRects(grid: GridLayout, opts: Partial<GridOpts> = {}): GridRects {
  const o = { ...DEFAULT_GRID_OPTS, ...opts };
  const spans = stageSpans(grid);
  const hasGroups = spans.some(s => s.group !== null);
  const top = o.headerH + (hasGroups ? o.groupH : 0);
  const left = o.headerW;

  const stages: Record<string, Rect> = {};
  let x = left;
  for (const s of grid.stages) {
    const w = px(s.size, o.defaultStageW);
    stages[s.id] = { x, y: hasGroups ? o.groupH : 0, w, h: o.headerH };
    x += w;
  }
  const width = x;

  const layers: Record<string, Rect> = {};
  let y = top;
  for (const l of grid.layers) {
    const h = px(l.size, o.defaultLayerH);
    layers[l.id] = { x: 0, y, w: left, h };
    y += h;
  }
  const height = y;

  const cells: Record<string, CellRect> = {};
  for (const l of grid.layers) for (const s of grid.stages) {
    const L = layers[l.id]!, S = stages[s.id]!;
    cells[cellKey(l.id, s.id)] = { layerId: l.id, stageId: s.id, x: S.x, y: L.y, w: S.w, h: L.h };
  }

  const groups: Record<string, Rect> = {};
  const groupSpans: GroupSpan[] = [];
  for (const sp of spans) {
    if (!sp.group) continue;
    const first = stages[sp.stageIds[0]!]!, last = stages[sp.stageIds[sp.stageIds.length - 1]!]!;
    const rect: Rect = { x: first.x, y: 0, w: last.x + last.w - first.x, h: o.groupH };
    groupSpans.push({ groupId: sp.group.id, stageIds: sp.stageIds, rect });
    const g = groups[sp.group.id];
    groups[sp.group.id] = g ? union(g, rect) : rect;
  }

  return { width, height, top, left, layers, stages, groups, spans: groupSpans, cells };
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Tramos de etapas contiguas por grupo (una banda por tramo). Las etapas sin grupo van sueltas. */
export function stageSpans(grid: GridLayout): { group: StageGroup | null; stageIds: string[] }[] {
  const out: { group: StageGroup | null; stageIds: string[] }[] = [];
  const byId = new Map(grid.stageGroups.map(g => [g.id, g] as const));
  for (const s of grid.stages) {
    const g = s.groupId ? byId.get(s.groupId) ?? null : null;
    const last = out[out.length - 1];
    if (last && g && last.group?.id === g.id) last.stageIds.push(s.id);
    else out.push({ group: g, stageIds: [s.id] });
  }
  return out;
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Celda bajo un punto (coordenadas del tablero), o null si cae en cabeceras o fuera. */
export function cellAt(grid: GridLayout, rects: GridRects, x: number, y: number): { layerId: string; stageId: string } | null {
  if (x < rects.left || y < rects.top || x >= rects.width || y >= rects.height) return null;
  const layer = grid.layers.find(l => { const r = rects.layers[l.id]; return r && y >= r.y && y < r.y + r.h; });
  const stage = grid.stages.find(s => { const r = rects.stages[s.id]; return r && x >= r.x && x < r.x + r.w; });
  if (!layer || !stage) return null;
  return { layerId: layer.id, stageId: stage.id };
}

/** Qué hay bajo un punto: celda, cabecera de capa/etapa, banda de grupo o nada. */
export function hitTest(grid: GridLayout, rects: GridRects, x: number, y: number):
  | { kind: 'cell'; layerId: string; stageId: string }
  | { kind: 'layer'; layerId: string }
  | { kind: 'stage'; stageId: string }
  | { kind: 'group'; groupId: string }
  | null {
  const cell = cellAt(grid, rects, x, y);
  if (cell) return { kind: 'cell', ...cell };
  for (const [layerId, r] of Object.entries(rects.layers)) if (inside(r, x, y)) return { kind: 'layer', layerId };
  for (const [stageId, r] of Object.entries(rects.stages)) if (inside(r, x, y)) return { kind: 'stage', stageId };
  for (const sp of rects.spans) if (inside(sp.rect, x, y)) return { kind: 'group', groupId: sp.groupId };
  return null;
}

// ---------------------------------------------------------------- Operaciones inmutables
let seq = 0;
const nextId = (prefix: string, taken: { id: string }[]) => {
  const has = new Set(taken.map(t => t.id));
  let id: string;
  do { id = `${prefix}:${(++seq).toString(36)}${Date.now().toString(36).slice(-3)}`; } while (has.has(id));
  return id;
};

function insertAt<T>(arr: T[], item: T, index?: number): T[] {
  const i = index === undefined || index < 0 || index > arr.length ? arr.length : index;
  return [...arr.slice(0, i), item, ...arr.slice(i)];
}

export function addLayer(grid: GridLayout, layer: Partial<Layer> = {}, index?: number): GridLayout {
  const n = grid.layers.length;
  const item: Layer = { id: layer.id ?? nextId('layer', grid.layers), name: layer.name ?? `Capa ${n + 1}`, color: layer.color ?? LAYER_COLORS[n % LAYER_COLORS.length], ...(layer.size !== undefined ? { size: layer.size } : {}) };
  if (grid.layers.some(l => l.id === item.id)) throw new Error(`Ya existe la capa ${item.id}`);
  return { ...grid, layers: insertAt(grid.layers, item, index) };
}

export function addStage(grid: GridLayout, stage: Partial<Stage> = {}, index?: number): GridLayout {
  const n = grid.stages.length;
  const item: Stage = { id: stage.id ?? nextId('stage', grid.stages), name: stage.name ?? `Etapa ${n + 1}`, groupId: stage.groupId ?? null, ...(stage.size !== undefined ? { size: stage.size } : {}) };
  if (grid.stages.some(s => s.id === item.id)) throw new Error(`Ya existe la etapa ${item.id}`);
  if (item.groupId && !grid.stageGroups.some(g => g.id === item.groupId)) item.groupId = null;
  return { ...grid, stages: insertAt(grid.stages, item, index) };
}

export function addStageGroup(grid: GridLayout, group: Partial<StageGroup> = {}, stageIds: string[] = []): GridLayout {
  const item: StageGroup = { id: group.id ?? nextId('group', grid.stageGroups), name: group.name ?? `Grupo ${grid.stageGroups.length + 1}`, ...(group.color ? { color: group.color } : {}) };
  if (grid.stageGroups.some(g => g.id === item.id)) throw new Error(`Ya existe el grupo ${item.id}`);
  const set = new Set(stageIds);
  return {
    ...grid,
    stageGroups: [...grid.stageGroups, item],
    stages: grid.stages.map(s => (set.has(s.id) ? { ...s, groupId: item.id } : s)),
  };
}

export function removeLayer(grid: GridLayout, layerId: string): GridLayout {
  return { ...grid, layers: grid.layers.filter(l => l.id !== layerId) };
}

export function removeStage(grid: GridLayout, stageId: string): GridLayout {
  return { ...grid, stages: grid.stages.filter(s => s.id !== stageId) };
}

/** Quita el grupo; sus etapas quedan sueltas. */
export function removeStageGroup(grid: GridLayout, groupId: string): GridLayout {
  return {
    ...grid,
    stageGroups: grid.stageGroups.filter(g => g.id !== groupId),
    stages: grid.stages.map(s => (s.groupId === groupId ? { ...s, groupId: null } : s)),
  };
}

export function updateLayer(grid: GridLayout, layerId: string, patch: Partial<Omit<Layer, 'id'>>): GridLayout {
  return { ...grid, layers: grid.layers.map(l => (l.id === layerId ? { ...l, ...patch } : l)) };
}

export function updateStage(grid: GridLayout, stageId: string, patch: Partial<Omit<Stage, 'id'>>): GridLayout {
  return { ...grid, stages: grid.stages.map(s => (s.id === stageId ? { ...s, ...patch } : s)) };
}

export function updateStageGroup(grid: GridLayout, groupId: string, patch: Partial<Omit<StageGroup, 'id'>>): GridLayout {
  return { ...grid, stageGroups: grid.stageGroups.map(g => (g.id === groupId ? { ...g, ...patch } : g)) };
}

/** Mete o saca una etapa de un grupo (`null` = sin grupo). */
export function setStageGroup(grid: GridLayout, stageId: string, groupId: string | null): GridLayout {
  if (groupId && !grid.stageGroups.some(g => g.id === groupId)) throw new Error(`No existe el grupo ${groupId}`);
  return updateStage(grid, stageId, { groupId });
}

function move<T extends { id: string }>(arr: T[], id: string, to: number): T[] {
  const from = arr.findIndex(x => x.id === id);
  if (from < 0) return arr;
  const target = Math.max(0, Math.min(arr.length - 1, to));
  if (from === target) return arr;
  const out = [...arr];
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item!);
  return out;
}

export function moveLayer(grid: GridLayout, layerId: string, toIndex: number): GridLayout {
  return { ...grid, layers: move(grid.layers, layerId, toIndex) };
}

export function moveStage(grid: GridLayout, stageId: string, toIndex: number): GridLayout {
  return { ...grid, stages: move(grid.stages, stageId, toIndex) };
}

/** Un `GridLayout` copiado y saneado: etapas con grupo inexistente quedan sueltas, ids duplicados fuera. */
export function normalizeGrid(grid: Partial<GridLayout> | undefined): GridLayout {
  const groups = dedupe(grid?.stageGroups ?? []);
  const gids = new Set(groups.map(g => g.id));
  return {
    layers: dedupe(grid?.layers ?? []).map(l => ({ ...l })),
    stages: dedupe(grid?.stages ?? []).map(s => ({ ...s, groupId: s.groupId && gids.has(s.groupId) ? s.groupId : null })),
    stageGroups: groups.map(g => ({ ...g })),
  };
}

function dedupe<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}
