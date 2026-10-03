/**
 * **XState** (configuración de máquina, `createMachine({...})` como JSON) ↔ notación `statechart`.
 *
 * Mapeo:
 * - Cada estado → `statechart:State` (`type: 'parallel'` → `statechart:Parallel`, `type: 'final'` → `statechart:Final`,
 *   `type: 'history'` → `statechart:History`). El id del elemento es la **ruta** del estado (`a.b.c`) y su nombre, la clave.
 *   `entry`/`exit` → `fields.entry`/`fields.exit` (una acción por línea); `description` → `doc`; `meta` → `props`.
 * - `initial` de cada estado compuesto (y de la máquina) → pseudoestado `statechart:Initial` (`<ruta>._initial`) con una transición al hijo.
 * - `on: { EV: destino | { target, cond|guard, actions, internal } | [...] }` → `statechart:Transition` con `fields.event/guard/actions/internal`.
 *   `after: { 500: ... }` → `fields.delay = '500ms'`; `always` → transición sin evento. Destinos: `hermano`, `.hijo`, `#id`, `#maquina.ruta`.
 * - Una sola vista freeform `statechart` con los estados anidados y un layout en rejilla (los compuestos abarcan a sus hijos).
 * - Exportar: se toma la vista indicada (o la primera de `statechart`); las claves son los nombres de los elementos.
 *   Los destinos no hermanos se escriben como `#<id del elemento>` y el estado destino recibe `id`.
 */
import { parseWorkspace, type Workspace, type Element, type Relation, type ViewNode, type ViewEdge } from '@all-draw/core';
import { emptyWs, makeEl, makeRel } from './archimate';
import { tr } from './i18n';

export type XStateActions = string | { type: string; [k: string]: unknown } | (string | { type: string; [k: string]: unknown })[];
export interface XStateTransitionObject { target?: string | string[]; cond?: string | { type: string }; guard?: string | { type: string }; actions?: XStateActions; internal?: boolean; reenter?: boolean; description?: string }
export type XStateTransition = string | XStateTransitionObject | (string | XStateTransitionObject)[];
export interface XStateConfig {
  id?: string; initial?: string; type?: 'parallel' | 'final' | 'compound' | 'atomic' | 'history';
  history?: 'shallow' | 'deep' | boolean; target?: string;
  states?: Record<string, XStateConfig>;
  on?: Record<string, XStateTransition>;
  after?: Record<string | number, XStateTransition>;
  always?: XStateTransition;
  entry?: XStateActions; exit?: XStateActions;
  description?: string; meta?: Record<string, unknown>; tags?: string | string[];
}
export interface XStateImport { workspace: Workspace; warnings: string[] }
export interface XStateExport { config: XStateConfig; text: string; warnings: string[] }

const SC = 'statechart';
const T = { state: `${SC}:State`, initial: `${SC}:Initial`, final: `${SC}:Final`, parallel: `${SC}:Parallel`, history: `${SC}:History`, choice: `${SC}:Choice`, fork: `${SC}:Fork`, join: `${SC}:Join`, terminate: `${SC}:Terminate`, transition: `${SC}:Transition` };
export const XSTATE_VIEW_ID = 'view_xstate';
const LEAF_W = 160, LEAF_H = 56, PSEUDO = 28, PAD = 24, HEADER = 36, GAP = 40;

const actionsToList = (a: XStateActions | undefined): string[] => {
  if (a === undefined || a === null) return [];
  const list = Array.isArray(a) ? a : [a];
  return list.map(x => (typeof x === 'string' ? x : x.type)).filter(Boolean);
};
const guardName = (t: XStateTransitionObject): string => { const g = t.guard ?? t.cond; return g === undefined ? '' : typeof g === 'string' ? g : g.type; };
const initialId = (path: string) => (path ? `${path}._initial` : '_initial');

// ---------------------------------------------------------------- Importador
export function importXState(input: string | XStateConfig): XStateImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const cfg = (typeof input === 'string' ? JSON.parse(input) : input) as XStateConfig | null;
  if (!cfg || typeof cfg !== 'object' || (!cfg.states && !cfg.initial && !cfg.id)) throw new Error(tr('El JSON no parece una configuración de XState (faltan `states`/`initial`).'));
  const machineId = cfg.id || 'maquina';
  const ws = emptyWs(machineId);

  const customIds = new Map<string, string>();   // id explícito → ruta
  const parentOf = new Map<string, string | null>();
  const order: string[] = [];
  const declare = (path: string, node: XStateConfig, parent: string | null) => {
    if (path) { parentOf.set(path, parent); order.push(path); if (node.id) customIds.set(node.id, path); }
    for (const [k, child] of Object.entries(node.states ?? {})) declare(path ? `${path}.${k}` : k, child ?? {}, path || null);
  };
  declare('', cfg, null);

  const resolveTarget = (from: string, target: string): string | null => {
    if (target.startsWith('#')) {
      const raw = target.slice(1);
      const dot = raw.indexOf('.');
      const head = dot < 0 ? raw : raw.slice(0, dot), tail = dot < 0 ? '' : raw.slice(dot + 1);
      if (customIds.has(raw)) return customIds.get(raw)!;
      if (head === machineId) return tail === '' ? '' : parentOf.has(tail) ? tail : null;
      const base = customIds.get(head);
      if (base !== undefined) { const p = tail ? `${base}.${tail}` : base; return parentOf.has(p) ? p : null; }
      return parentOf.has(raw) ? raw : null;
    }
    if (target.startsWith('.')) { const p = from ? `${from}${target}` : target.slice(1); return parentOf.has(p) ? p : null; }
    const parent = parentOf.get(from) ?? null;
    const sibling = parent ? `${parent}.${target}` : target;
    if (parentOf.has(sibling)) return sibling;
    return parentOf.has(target) ? target : null;
  };

  const addTransition = (from: string, event: string, t: string | XStateTransitionObject, extra: Record<string, unknown> = {}) => {
    const obj: XStateTransitionObject = typeof t === 'string' ? { target: t } : t;
    const targets = obj.target === undefined ? [undefined] : Array.isArray(obj.target) ? obj.target : [obj.target];
    for (const target of targets) {
      const to = target === undefined ? from : resolveTarget(from, target);
      if (to === null || to === '') { warn(tr('Estado "{from}": el destino "{target}" del evento "{event}" no existe; se omite', { from, target, event })); continue; }
      const id = `${from || machineId}--${event || extra.delay || 'always'}-->${to}`;
      const rel = makeRel(ws.relations[id] ? `${id}#${Object.keys(ws.relations).length}` : id, T.transition, { elementId: from }, { elementId: to });
      rel.name = event;
      rel.fields = { event, guard: guardName(obj), actions: actionsToList(obj.actions), ...extra };
      if (target === undefined || obj.internal) rel.fields.internal = true;
      if (obj.description) rel.doc = obj.description;
      ws.relations[rel.id] = rel;
    }
  };
  const addTransitions = (from: string, event: string, t: XStateTransition, extra: Record<string, unknown> = {}) => {
    for (const x of Array.isArray(t) ? t : [t]) addTransition(from, event, x, extra);
  };

  const build = (path: string, node: XStateConfig) => {
    if (path) {
      const typeId = node.type === 'parallel' ? T.parallel : node.type === 'final' ? T.final : node.type === 'history' ? T.history : T.state;
      const name = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : path;
      const el = makeEl(path, typeId, name);
      el.doc = node.description ?? '';
      if (typeId === T.history) el.fields.deep = node.history === 'deep';
      else if (typeId !== T.final || node.entry || node.exit) {
        const entry = actionsToList(node.entry).join('\n'), exit = actionsToList(node.exit).join('\n');
        if (entry) el.fields.entry = entry;
        if (exit) el.fields.exit = exit;
      }
      if (node.meta) el.props = Object.fromEntries(Object.entries(node.meta).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
      if (node.tags) el.tags = Array.isArray(node.tags) ? node.tags : [node.tags];
      ws.elements[path] = el;
      for (const [ev, t] of Object.entries(node.on ?? {})) addTransitions(path, ev, t);
      for (const [d, t] of Object.entries(node.after ?? {})) addTransitions(path, '', t, { delay: /^\d+$/.test(String(d)) ? `${d}ms` : String(d) });
      if (node.always !== undefined) addTransitions(path, '', node.always);
      if (typeId === T.history && node.target) addTransition(path, '', { target: node.target });
    }
    const states = Object.entries(node.states ?? {});
    for (const [k, child] of states) build(path ? `${path}.${k}` : k, child ?? {});
    if (node.initial !== undefined && states.length) {
      const target = path ? `${path}.${node.initial}` : node.initial;
      if (!ws.elements[target]) { warn(tr('Estado "{state}": el estado inicial "{initial}" no existe', { state: path || machineId, initial: node.initial })); return; }
      const iid = initialId(path);
      ws.elements[iid] = makeEl(iid, T.initial, '');
      const rel = makeRel(`${iid}-->${target}`, T.transition, { elementId: iid }, { elementId: target });
      rel.fields = { event: '', guard: '', actions: [] };
      ws.relations[rel.id] = rel;
    } else if (states.length && node.type !== 'parallel' && !path) warn(tr('La máquina no declara `initial`'));
  };
  build('', cfg);

  // ---- vista con layout en rejilla
  const view = { id: XSTATE_VIEW_ID, kind: 'freeform' as const, notationId: SC, name: machineId, doc: cfg.description ?? '', style: {}, props: {} };
  ws.views[view.id] = view;
  const childrenOf = (path: string): string[] => {
    const kids = order.filter(p => (parentOf.get(p) ?? '') === path && p !== path);
    const init = initialId(path);
    return ws.elements[init] ? [init, ...kids] : kids;
  };
  const sizes = new Map<string, { w: number; h: number }>();
  const measure = (path: string): { w: number; h: number } => {
    const el = ws.elements[path];
    const kids = childrenOf(path);
    if (!kids.length) {
      const s = el?.typeId === T.initial || el?.typeId === T.history ? { w: PSEUDO, h: PSEUDO } : el?.typeId === T.final ? { w: PSEUDO + 6, h: PSEUDO + 6 } : { w: LEAF_W, h: LEAF_H };
      sizes.set(path, s); return s;
    }
    const ks = kids.map(measure);
    const cols = Math.ceil(Math.sqrt(kids.length)), rows = Math.ceil(kids.length / cols);
    const cw = Math.max(...ks.map(k => k.w)), ch = Math.max(...ks.map(k => k.h));
    const s = { w: PAD * 2 + cols * cw + (cols - 1) * GAP, h: HEADER + PAD + rows * ch + (rows - 1) * GAP };
    sizes.set(path, s); return s;
  };
  const place = (path: string, parentNodeId: string | undefined) => {
    const kids = childrenOf(path);
    if (!kids.length) return;
    const cols = Math.ceil(Math.sqrt(kids.length));
    const cw = Math.max(...kids.map(k => sizes.get(k)!.w)), ch = Math.max(...kids.map(k => sizes.get(k)!.h));
    kids.forEach((k, i) => {
      const s = sizes.get(k)!;
      const col = i % cols, row = Math.floor(i / cols);
      const node: ViewNode = { id: `n:${k}`, viewId: view.id, elementId: k, x: PAD + col * (cw + GAP), y: (path ? HEADER : PAD) + row * (ch + GAP), w: s.w, h: s.h, style: {} };
      if (parentNodeId) node.parentNodeId = parentNodeId;
      ws.nodes[node.id] = node;
      place(k, node.id);
    });
  };
  measure('');
  place('', undefined);
  for (const rel of Object.values(ws.relations)) {
    const a = `n:${rel.from.elementId}`, b = `n:${rel.to.elementId}`;
    if (!ws.nodes[a] || !ws.nodes[b]) continue;
    const edge: ViewEdge = { id: `e:${rel.id}`, viewId: view.id, relationId: rel.id, fromNodeId: a, toNodeId: b, bendpoints: [], style: {} };
    const label = transitionLabel(rel);
    if (label) edge.label = label;
    ws.edges[edge.id] = edge;
  }
  ws.meta.currentViewId = view.id;
  return { workspace: parseWorkspace(ws), warnings };
}

/** `evento [guarda] / acciones`, o `after 500ms` para las temporizadas. */
export function transitionLabel(rel: Relation): string {
  const f = rel.fields;
  const ev = f.delay ? `after ${f.delay}` : String(f.event ?? rel.name ?? '');
  const guard = f.guard ? ` [${f.guard}]` : '';
  const actions = Array.isArray(f.actions) && f.actions.length ? ` / ${f.actions.join(', ')}` : '';
  return `${ev}${guard}${actions}`.trim();
}

// ---------------------------------------------------------------- Exportador
export function exportXState(ws: Workspace, viewId?: string): XStateExport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const view = viewId ? ws.views[viewId] : Object.values(ws.views).find(v => v.notationId === SC) ?? Object.values(ws.views).find(v => Object.values(ws.nodes).some(n => n.viewId === v.id && n.elementId && ws.elements[n.elementId]?.typeId.startsWith(`${SC}:`)));
  if (!view) throw new Error(viewId ? `No existe la vista ${viewId}` : 'El espacio no tiene ninguna vista de máquina de estados.');
  const nodes = Object.values(ws.nodes).filter(n => n.viewId === view.id && n.elementId && ws.elements[n.elementId]);
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const elOf = (n: ViewNode): Element => ws.elements[n.elementId!]!;
  const kidsOf = (parentId: string | undefined) => nodes.filter(n => (n.parentNodeId && nodeById.has(n.parentNodeId) ? n.parentNodeId : undefined) === parentId).sort((a, b) => a.y - b.y || a.x - b.x);
  const isState = (n: ViewNode) => [T.state, T.parallel, T.final, T.history, T.choice].includes(elOf(n).typeId);
  const edges = Object.values(ws.edges).filter(e => e.viewId === view.id && e.relationId && ws.relations[e.relationId]?.typeId === T.transition && nodeById.has(e.fromNodeId) && nodeById.has(e.toNodeId));
  const nameOf = (n: ViewNode) => elOf(n).name || elOf(n).id;
  const needsId = new Set<string>();

  const targetExpr = (from: ViewNode, to: ViewNode): string => {
    const fp = from.parentNodeId && nodeById.has(from.parentNodeId) ? from.parentNodeId : undefined;
    const tp = to.parentNodeId && nodeById.has(to.parentNodeId) ? to.parentNodeId : undefined;
    if (fp === tp) return nameOf(to);
    if (tp === from.id) return `.${nameOf(to)}`;
    needsId.add(to.id);
    return `#${elOf(to).id}`;
  };
  const transitionsOf = (n: ViewNode): { on: Record<string, XStateTransition>; after: Record<string, XStateTransition>; always: XStateTransitionObject[] } => {
    const on: Record<string, XStateTransitionObject[]> = {}, after: Record<string, XStateTransitionObject[]> = {}, always: XStateTransitionObject[] = [];
    for (const e of edges.filter(e => e.fromNodeId === n.id)) {
      const rel = ws.relations[e.relationId!]!, to = nodeById.get(e.toNodeId)!;
      if (!isState(to)) { warn(tr('La transición {id} apunta a un pseudoestado {type} que XState no representa; se omite', { id: rel.id, type: elOf(to).typeId })); continue; }
      const t: XStateTransitionObject = {};
      if (!(rel.fields.internal && to.id === n.id)) t.target = targetExpr(n, to);
      if (rel.fields.guard) t.guard = String(rel.fields.guard);
      const actions = Array.isArray(rel.fields.actions) ? (rel.fields.actions as string[]) : [];
      if (actions.length) t.actions = actions;
      if (rel.doc) t.description = rel.doc;
      const event = String(rel.fields.event ?? rel.name ?? '');
      if (rel.fields.delay) { const d = String(rel.fields.delay).replace(/ms$/, ''); (after[d] ??= []).push(t); }
      else if (event) (on[event] ??= []).push(t);
      else always.push(t);
    }
    const simplify = (list: XStateTransitionObject[]): XStateTransition => { const s = list.map(t => (Object.keys(t).length === 1 && t.target !== undefined ? t.target as string : t)); return s.length === 1 ? s[0]! : s; };
    return { on: Object.fromEntries(Object.entries(on).map(([k, v]) => [k, simplify(v)])), after: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, simplify(v)])), always };
  };

  const stateConfig = (n: ViewNode): XStateConfig | null => {
    const el = elOf(n);
    if (!isState(n)) { if (el.typeId !== T.initial) warn(tr('El pseudoestado "{name}" ({type}) no tiene equivalente en XState; se omite', { name: el.name || el.id, type: el.typeId })); return null; }
    const cfg: XStateConfig = {};
    if (needsId.has(n.id)) cfg.id = el.id;
    if (el.typeId === T.parallel) cfg.type = 'parallel';
    if (el.typeId === T.final) cfg.type = 'final';
    if (el.typeId === T.history) { cfg.type = 'history'; cfg.history = el.fields.deep ? 'deep' : 'shallow'; }
    if (el.doc) cfg.description = el.doc;
    const entry = String(el.fields.entry ?? '').split('\n').filter(Boolean), exit = String(el.fields.exit ?? '').split('\n').filter(Boolean);
    if (entry.length) cfg.entry = entry.length === 1 ? entry[0]! : entry;
    if (exit.length) cfg.exit = exit.length === 1 ? exit[0]! : exit;
    if (Object.keys(el.props).length) cfg.meta = { ...el.props };
    if (el.tags.length) cfg.tags = el.tags;
    const { on, after, always } = transitionsOf(n);
    if (el.typeId === T.history) { const tgt = always[0]?.target; if (typeof tgt === 'string') cfg.target = tgt; return cfg; }
    fillChildren(cfg, kidsOf(n.id));
    if (Object.keys(on).length) cfg.on = on;
    if (Object.keys(after).length) cfg.after = after;
    if (always.length) cfg.always = always.length === 1 ? always[0]! : always;
    return cfg;
  };
  const fillChildren = (cfg: XStateConfig, kids: ViewNode[]) => {
    const states: Record<string, XStateConfig> = {};
    for (const k of kids) {
      if (!isState(k)) continue;
      const name = nameOf(k);
      if (states[name]) warn(tr('Dos estados hermanos se llaman "{name}"; XState exige nombres únicos', { name }));
      const c = stateConfig(k); if (c) states[name] = c;
    }
    const init = kids.find(k => elOf(k).typeId === T.initial);
    if (init) {
      const e = edges.find(e => e.fromNodeId === init.id);
      const to = e ? nodeById.get(e.toNodeId) : undefined;
      if (to && kids.includes(to)) cfg.initial = nameOf(to); else warn(tr('El pseudoestado inicial {id} no apunta a un estado hermano', { id: init.id }));
    }
    if (Object.keys(states).length) { cfg.states = states; if (!cfg.initial && cfg.type !== 'parallel') cfg.initial = Object.keys(states)[0]; }
  };

  // dos pasadas: la primera descubre qué estados necesitan `id` explícito
  const root = (): XStateConfig => { const cfg: XStateConfig = { id: view.name || 'maquina' }; fillChildren(cfg, kidsOf(undefined)); return cfg; };
  root(); warnings.length = 0;
  const config = root();
  if (view.doc) config.description = view.doc;
  return { config, text: JSON.stringify(config, null, 2) + '\n', warnings };
}
