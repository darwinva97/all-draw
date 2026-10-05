/**
 * Lógica pura del **panel de texto en vivo** (`panels/TextPanel.tsx`): qué parte del espacio se escribe como texto,
 * cómo se compara lo escrito con el modelo y qué comandos lo aplican, y cómo se enlaza una posición del texto con un
 * registro (para la selección cruzada texto ↔ lienzo). Sin React ni DOM: se prueba en `test/text-sync.test.ts`.
 *
 * ## Sincronización (fusión a tres bandas)
 *
 * - **base**: el texto tal y como estaba la última vez que texto y modelo coincidían, leído con `parseDsl`.
 * - **mío**: el texto actual del panel, leído igual.
 * - **suyo**: el modelo actual (puede haber cambiado desde la base: lienzo, otra persona, deshacer).
 *
 * Por cada registro y cada campo: si el texto no cambió el campo respecto a la base, se queda el valor del modelo
 * (así no se pisa lo que cambió fuera); si lo cambió, gana el texto. Si el modelo también lo cambió a otro valor hay
 * **conflicto** (el panel pregunta: recargar el texto o mantener el mío). Las comparaciones se hacen sobre registros
 * leídos del mismo modo (texto → `parseDsl`), así que los valores por defecto no cuentan como cambios.
 *
 * Geometría: la posición (`at`), el tamaño (`size`) y los quiebros (`via`) solo se aplican si están **escritos** en esa
 * línea del texto; si no, se conserva lo del lienzo. Los nodos nuevos sin `at` se colocan junto a lo que ya hay (o, si
 * la vista entera es nueva, se piden al layout automático: `layoutViews`). Un nodo que cambia de contenedor conserva
 * su posición absoluta.
 *
 * Borrados: quitar la declaración de un elemento (o relación, vista) lo borra del modelo con sus dependencias en todo
 * el espacio (los mismos borrados en cascada que el lienzo, vía `expand`); quitar solo su `include` lo quita de la vista.
 */
import { COLLECTIONS, MemoryStore, execute, expand, type Collection, type Command, type Element, type ViewNode, type Workspace } from '@all-draw/core';
import { dslId, parseDsl, serializeDsl, type DslDiagnostic, type DslParseResult } from '@all-draw/io/dsl';

// ================================================================ Alcance y texto
export type TextScope = { kind: 'workspace' } | { kind: 'view'; viewId: string };

const EMPTY_COLLS = (): Pick<Workspace, Collection> => ({ libraries: {}, elements: {}, relations: {}, views: {}, nodes: {}, edges: {}, dimensions: {}, people: {}, rules: {}, comments: {} });

/**
 * Parte del espacio que muestra el texto. Todo el espacio, o una vista: la vista, sus nodos y aristas, los elementos
 * que aparecen en ella, las relaciones dibujadas y los extremos de esas relaciones (para que el texto se lea solo).
 * La metainformación volátil (vista actual, fechas) no entra: cambiaría el texto sin que cambie nada del modelo.
 */
export function scopeWorkspace(ws: Workspace, scope: TextScope): Workspace {
  const meta = { schemaVersion: ws.meta.schemaVersion, name: ws.meta.name, description: ws.meta.description };
  if (scope.kind === 'workspace') return { ...ws, meta };
  const out: Workspace = { meta, ...EMPTY_COLLS() };
  const v = ws.views[scope.viewId];
  if (!v) return out;
  const els = new Set<string>(), rels = new Set<string>();
  const addRel = (id: string) => {
    const r = ws.relations[id];
    if (!r || rels.has(id)) return;
    rels.add(id);
    for (const end of [r.from, r.to]) { if (end.elementId && ws.elements[end.elementId]) els.add(end.elementId); if (end.relationId) addRel(end.relationId); }
  };
  out.views[v.id] = v;
  if (v.rootElementId && ws.elements[v.rootElementId]) els.add(v.rootElementId);
  for (const n of Object.values(ws.nodes)) if (n.viewId === v.id) { out.nodes[n.id] = n; if (n.elementId && ws.elements[n.elementId]) els.add(n.elementId); }
  for (const e of Object.values(ws.edges)) if (e.viewId === v.id) { out.edges[e.id] = e; if (e.relationId) addRel(e.relationId); }
  // en el orden del espacio: el texto de una vista se escribe igual que en el del espacio entero
  for (const el of Object.values(ws.elements)) if (els.has(el.id)) out.elements[el.id] = el;
  for (const r of Object.values(ws.relations)) if (rels.has(r.id)) out.relations[r.id] = r;
  return out;
}

export interface PanelTextOptions {
  /** Escribir posiciones, tamaños y quiebros (por defecto no: el texto queda limpio y el lienzo conserva la geometría). */
  positions?: boolean;
}

/** Texto del panel para un alcance (determinista). */
export function panelText(ws: Workspace, scope: TextScope, opts: PanelTextOptions = {}): string {
  return serializeDsl(scopeWorkspace(ws, scope), { positions: !!opts.positions, header: false });
}

// ================================================================ Lectura del texto
/** Ids de nodos con `at`/`size` escritos y de aristas con `via` escrito. */
export interface Explicit { at: Set<string>; size: Set<string>; via: Set<string> }

/** El texto leído: espacio, diagnósticos (ya clasificados para el panel), dónde empieza cada registro y qué geometría está escrita. */
export interface TextSnapshot {
  text: string;
  ws: Workspace;
  locations: DslParseResult['locations'];
  explicit: Explicit;
  errors: DslDiagnostic[];
  warnings: DslDiagnostic[];
}

/** Cabecera de la instrucción que empieza en `col` (hasta `{`, `;` o un comentario), con los textos vaciados. */
function statementHead(line: string, col: number): string {
  let out = '';
  for (let i = col; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      out += ch + ch; i = j; continue;
    }
    if (ch === '{' || ch === ';') break;
    if (ch === '/' && (line[i + 1] === '/' || line[i + 1] === '*')) break;
    out += ch;
  }
  return out;
}

/** Qué nodos llevan `at` / `size` y qué aristas `via` escritos en su línea. */
export function explicitGeometry(text: string, locations: DslParseResult['locations']): Explicit {
  const lines = text.split('\n');
  const out: Explicit = { at: new Set(), size: new Set(), via: new Set() };
  for (const [key, p] of Object.entries(locations)) {
    const slash = key.indexOf('/');
    const c = key.slice(0, slash), id = key.slice(slash + 1);
    if (c !== 'nodes' && c !== 'edges') continue;
    const head = statementHead(lines[p.line - 1] ?? '', p.col - 1);
    if (c === 'nodes') {
      if (/(^|[\s,])at\s+[-.\d]/.test(head)) out.at.add(id);
      if (/(^|[\s,])size\s+[-.\d]/.test(head)) out.size.add(id);
    } else if (/(^|[\s,])via\s+[-.\d]/.test(head)) out.via.add(id);
  }
  return out;
}

/** Avisos de io sobre referencias: el panel los resuelve contra el espacio entero (`checkRefs`), no contra el texto solo. */
const REF_WARNINGS = new Set(['El elemento «{id}» no existe', '«{ref}» no es un elemento ni una relación', 'La vista «{id}» no existe']);
/** Error de io que en el panel es un aviso: al quitar el `include` de un extremo, su arista se quita también. */
const EDGE_DROPPED = 'La relación «{id}» no tiene nodos en la vista «{view}»: indica from y to';

/** Lee el texto. Con `current`, los extremos que nombran relaciones de fuera del texto se resuelven como relaciones. */
export function readText(text: string, current?: Workspace): TextSnapshot {
  const r = parseDsl(text);
  const ws = r.workspace;
  if (current) {
    for (const rel of Object.values(ws.relations)) {
      for (const k of ['from', 'to'] as const) {
        const end = rel[k];
        const id = end.elementId;
        if (id && !ws.elements[id] && !current.elements[id] && (current.relations[id] || ws.relations[id])) rel[k] = { relationId: id, ...(end.portId !== undefined ? { portId: end.portId } : {}) };
      }
    }
  }
  const errors: DslDiagnostic[] = [], warnings: DslDiagnostic[] = [];
  for (const d of r.diagnostics) {
    if (d.severity === 'warning' && REF_WARNINGS.has(d.key)) continue;
    if (d.severity === 'error' && d.key !== EDGE_DROPPED) errors.push(d);
    else warnings.push(d.severity === 'warning' ? d : { ...d, severity: 'warning' });
  }
  return { text, ws, locations: r.locations, explicit: explicitGeometry(text, r.locations), errors, warnings };
}

// ================================================================ Comparación y fusión
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Igualdad estructural (las claves con `undefined` cuentan como ausentes). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { const bb = b as unknown[]; return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i])); }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  const ka = Object.keys(ao).filter(k => ao[k] !== undefined), kb = Object.keys(bo).filter(k => bo[k] !== undefined);
  return ka.length === kb.length && ka.every(k => deepEqual(ao[k], bo[k]));
}

/**
 * Fusión a tres bandas de un valor: `b` base, `m` mío (texto), `n` suyo normalizado (modelo leído como texto), `r` el
 * valor real del modelo (lo que se conserva si el texto no lo tocó). Los objetos se fusionan clave a clave; las listas y
 * los valores sueltos, enteros. Los conflictos (texto y modelo cambiaron lo mismo a valores distintos) van a `conflicts`.
 */
function merge3(b: unknown, m: unknown, n: unknown, r: unknown, path: string, conflicts: string[]): unknown {
  if (deepEqual(m, b)) return r;
  if (isObj(b) && isObj(m) && isObj(n) && (r === undefined || isObj(r))) {
    const out: Record<string, unknown> = { ...(r as Record<string, unknown> | undefined) };
    for (const k of new Set([...Object.keys(b), ...Object.keys(m)])) {
      const v = merge3(b[k], m[k], n[k], (r as Record<string, unknown> | undefined)?.[k], `${path}.${k}`, conflicts);
      if (v === undefined) delete out[k]; else out[k] = v;
    }
    return out;
  }
  if (!deepEqual(n, b) && !deepEqual(n, m)) conflicts.push(path);
  return m;
}

/** Parche mínimo de `a` a `b` para `patch` (que fusiona objetos en profundidad): lo que sobra va como `undefined`. */
export function diffPatch(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> | null {
  const p: Record<string, unknown> = {};
  let any = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (deepEqual(a[k], b[k])) continue;
    any = true;
    const sub = isObj(a[k]) && isObj(b[k]) ? diffPatch(a[k] as Record<string, unknown>, b[k] as Record<string, unknown>) : null;
    p[k] = sub ?? b[k];
  }
  return any ? p : null;
}

const GEOMETRY: Partial<Record<Collection, string[]>> = { nodes: ['x', 'y', 'w', 'h'], edges: ['bendpoints'] };
function omit<T>(rec: T, keys: string[] | undefined): T {
  if (!keys || !isObj(rec)) return rec;
  const out = { ...rec } as Record<string, unknown>;
  for (const k of keys) delete out[k];
  return out as T;
}

// ================================================================ Sincronización
/** Problema que impide aplicar el texto (o aviso), con su posición en el texto. */
export interface SyncIssue { severity: 'error' | 'warning'; key: string; vars: Record<string, string | number>; line: number; col: number }

export interface SyncOptions {
  /** El modelo ahora (`store.snapshot()`). */
  current: Workspace;
  /** El texto en el último punto en que texto y modelo coincidían. */
  base: TextSnapshot;
  /** El texto ahora (sin errores). */
  mine: TextSnapshot;
  scope: TextScope;
  /** El modelo actual leído como texto (`readText(panelText(current, scope), current).ws`); se calcula si falta. */
  theirs?: Workspace;
  /** Tamaño por defecto de un nodo nuevo sin `size` (el mismo que usaría el lienzo). */
  sizeOf?: (node: ViewNode, element: Element | undefined) => { w: number; h: number } | undefined;
  /** Resolver los conflictos a favor del texto ("mantener el mío"). */
  keepMine?: boolean;
}

export interface SyncResult {
  /** Comandos primitivos (`set`/`patch`/`delete`/`meta`) para un único `batch`. */
  commands: Command[];
  /** Registros o campos que el texto y el modelo cambiaron a la vez (`elements/x.name`). Vacío con `keepMine`. */
  conflicts: string[];
  /** Referencias rotas o ids ocupados: si hay alguno con `severity: 'error'`, no se aplica. */
  problems: SyncIssue[];
  /** Vistas cuyos nodos son todos nuevos y sin posición: conviene aplicarles el layout automático. */
  layoutViews: string[];
}

const DELETE_ORDER: Collection[] = ['edges', 'nodes', 'relations', 'elements', 'views', 'comments', 'rules', 'people', 'dimensions', 'libraries'];

/** Comando de borrado con sus cascadas (las mismas que en el lienzo). */
function deleteCommand(c: Collection, id: string): Command {
  switch (c) {
    case 'elements': return { type: 'deleteElement', id };
    case 'relations': return { type: 'deleteRelation', id };
    case 'views': return { type: 'deleteView', id };
    case 'nodes': return { type: 'deleteNode', id };
    default: return { type: 'delete', collection: c, id };
  }
}

/** Posición absoluta de un nodo (sumando la de sus contenedores). */
function absPos(nodes: Map<string, ViewNode> | Record<string, ViewNode>, n: ViewNode): { x: number; y: number } {
  const get = (id: string) => (nodes instanceof Map ? nodes.get(id) : nodes[id]);
  let x = n.x, y = n.y, p = n.parentNodeId ? get(n.parentNodeId) : undefined, guard = 0;
  while (p && guard++ < 50) { x += p.x; y += p.y; p = p.parentNodeId ? get(p.parentNodeId) : undefined; }
  return { x, y };
}

/** Compara el texto con el modelo y devuelve los comandos que llevan el texto al modelo (ver la cabecera). */
export function computeSync(o: SyncOptions): SyncResult {
  const cur = o.current, B = o.base.ws, M = o.mine.ws;
  const N = o.theirs ?? readText(panelText(cur, o.scope), cur).ws;
  const conflicts: string[] = [], problems: SyncIssue[] = [];
  const sets: Command[] = [], patches: Command[] = [];
  const deletes: { c: Collection; id: string }[] = [];
  const created = new Map<string, unknown>();
  const at = (c: string, id: string) => o.mine.locations[`${c}/${id}`] ?? { line: 1, col: 1 };
  const err = (msg: { key: string; vars: Record<string, string | number> }, p: { line: number; col: number }) => problems.push({ severity: 'error', ...msg, line: p.line, col: p.col });

  // Nodos: se deciden al final (geometría); aquí se guarda su estado final y el real.
  const finalNodes = new Map<string, ViewNode>(Object.values(cur.nodes).map(n => [n.id, n]));
  const newNodes: ViewNode[] = [];
  const keptChanged = new Set<string>();
  const deletedNodes: ViewNode[] = [];
  /** Nodos que cambian de contenedor sin `at` escrito (con su estado anterior). */
  const reparented: { id: string; old: ViewNode }[] = [];

  for (const c of COLLECTIONS) {
    const Bc = B[c] as Record<string, unknown>, Mc = M[c] as Record<string, unknown>, Nc = N[c] as Record<string, unknown>, Rc = cur[c] as Record<string, unknown>;
    const g = GEOMETRY[c];
    for (const id of new Set([...Object.keys(Bc), ...Object.keys(Mc)])) {
      const b = Bc[id], m = Mc[id], n = Nc[id], r = Rc[id];
      const key = `${c}/${id}`;
      const create = () => {
        created.set(key, m);
        if (c === 'nodes') { const node = { ...(m as ViewNode) }; newNodes.push(node); finalNodes.set(id, node); }
        else sets.push({ type: 'set', collection: c, id, value: m });
      };
      if (b === undefined && m !== undefined) {
        // nuevo en el texto
        if (r !== undefined && n === undefined) { err({ key: 'El id «{id}» ya existe en el espacio, fuera de este texto: usa otro id', vars: { id } }, at(c, id)); continue; }
        if (r !== undefined) {
          // el modelo también lo creó (a la vez): igual → nada; distinto → conflicto, o gana el texto
          if (deepEqual(omit(n, g), omit(m, g))) continue;
          if (!o.keepMine) { conflicts.push(key); continue; }
          if (c === 'nodes') { const node = { ...(m as ViewNode) }; finalNodes.set(id, node); keptChanged.add(id); continue; }
          sets.push({ type: 'set', collection: c, id, value: m });
          continue;
        }
        create();
      } else if (b !== undefined && m === undefined) {
        // borrado en el texto
        if (r === undefined) continue;
        if (n !== undefined && !deepEqual(omit(n, g), omit(b, g)) && !o.keepMine) { conflicts.push(key); continue; }
        deletes.push({ c, id });
        if (c === 'nodes') { deletedNodes.push(r as ViewNode); finalNodes.delete(id); }
      } else if (b !== undefined && m !== undefined) {
        if (r === undefined) {
          // el modelo lo borró: si el texto no lo cambió, se acepta el borrado
          if (deepEqual(omit(b, g), omit(m, g))) continue;
          if (!o.keepMine) { conflicts.push(key); continue; }
          create();
          continue;
        }
        const local: string[] = [];
        const merged = merge3(omit(b, g), omit(m, g), omit(n ?? b, g), omit(r, g), key, local) as Record<string, unknown>;
        if (!o.keepMine) conflicts.push(...local);
        if (c === 'nodes') {
          const rn = r as ViewNode, mn = m as ViewNode, bn = b as ViewNode;
          const node = { ...merged } as ViewNode;
          const atChanged = o.mine.explicit.at.has(id) && (!o.base.explicit.at.has(id) || mn.x !== bn.x || mn.y !== bn.y);
          const sizeChanged = o.mine.explicit.size.has(id) && (!o.base.explicit.size.has(id) || mn.w !== bn.w || mn.h !== bn.h);
          node.x = atChanged ? mn.x : rn.x; node.y = atChanged ? mn.y : rn.y;
          node.w = sizeChanged ? mn.w : rn.w; node.h = sizeChanged ? mn.h : rn.h;
          if (!atChanged && (node.parentNodeId ?? null) !== (rn.parentNodeId ?? null)) reparented.push({ id, old: rn });
          finalNodes.set(id, node);
          keptChanged.add(id);
          continue;
        }
        if (c === 'edges') {
          const viaChanged = o.mine.explicit.via.has(id) && (!o.base.explicit.via.has(id) || !deepEqual((m as { bendpoints: unknown }).bendpoints, (b as { bendpoints: unknown }).bendpoints));
          merged.bendpoints = viaChanged ? (m as { bendpoints: unknown }).bendpoints : (r as { bendpoints: unknown }).bendpoints;
        }
        const p = diffPatch(r as Record<string, unknown>, merged);
        if (p) patches.push({ type: 'patch', collection: c, id, patch: p });
      }
    }
  }

  // ---- meta (nombre y descripción)
  {
    const pick = (w: Workspace) => ({ name: w.meta.name, description: w.meta.description });
    const local: string[] = [];
    const merged = merge3(pick(B), pick(M), pick(N), pick(cur), 'meta', local) as Record<string, unknown>;
    if (!o.keepMine) conflicts.push(...local);
    const p = diffPatch(pick(cur), merged);
    if (p) sets.push({ type: 'meta', patch: p });
  }

  // ---- geometría de nodos nuevos y de los que cambian de contenedor
  const isNew = new Set(newNodes.map(n => n.id));
  const elementOf = (n: ViewNode) => (n.elementId ? (M.elements[n.elementId] ?? cur.elements[n.elementId]) : undefined);
  // Renombrados de id: elemento borrado ↔ elemento nuevo del mismo tipo (y, si hay varios, del mismo nombre).
  const renamed = new Map<string, string>();
  {
    const gone = deletes.filter(d => d.c === 'elements').map(d => cur.elements[d.id]!).filter(Boolean);
    const born = [...created.entries()].filter(([k]) => k.startsWith('elements/')).map(([, v]) => v as Element);
    const used = new Set<string>();
    for (const pass of [true, false]) for (const g of gone) {
      if (renamed.has(g.id)) continue;
      const cands = born.filter(e => !used.has(e.id) && e.typeId === g.typeId && (!pass || e.name === g.name));
      if (cands.length === 1 || (pass && cands.length)) { renamed.set(g.id, cands[0]!.id); used.add(cands[0]!.id); }
    }
  }
  // Nodos nuevos que sustituyen a uno borrado (mismo elemento, elemento renombrado o nota igual): heredan su sitio.
  const usedOld = new Set<string>();
  const carried = new Set<string>();
  for (const nn of newNodes) {
    if (o.mine.explicit.at.has(nn.id)) continue;
    const d = deletedNodes.find(dn => !usedOld.has(dn.id) && dn.viewId === nn.viewId && (
      (nn.elementId !== undefined && (dn.elementId === nn.elementId || (dn.elementId !== undefined && renamed.get(dn.elementId) === nn.elementId)))
      || (nn.elementId === undefined && dn.elementId === undefined && dn.visualType === nn.visualType && dn.text === nn.text)));
    if (!d) continue;
    usedOld.add(d.id); carried.add(nn.id);
    nn.x = d.x; nn.y = d.y;
    if (!o.mine.explicit.size.has(nn.id)) { nn.w = d.w; nn.h = d.h; }
    if ((nn.parentNodeId ?? null) !== (d.parentNodeId ?? null)) reparented.push({ id: nn.id, old: d });
  }
  // Tamaño por defecto de los nuevos sin `size` (los contenedores nuevos crecen luego al colocar a sus hijos).
  for (const nn of newNodes) {
    if (o.mine.explicit.size.has(nn.id) || carried.has(nn.id)) continue;
    const s = o.sizeOf?.(nn, elementOf(nn));
    if (s) { nn.w = s.w; nn.h = s.h; }
  }
  // Cambio de contenedor sin `at`: se conserva la posición absoluta; si no cae dentro del nuevo contenedor, se coloca dentro.
  const loose = new Set<string>(newNodes.filter(n => !o.mine.explicit.at.has(n.id) && !carried.has(n.id)).map(n => n.id));
  for (const { id, old } of reparented) {
    const node = finalNodes.get(id); if (!node) continue;
    const oldAbs = absPos(cur.nodes, old);
    const parent = node.parentNodeId ? finalNodes.get(node.parentNodeId) : undefined;
    if (!parent) { node.x = oldAbs.x; node.y = oldAbs.y; continue; }
    if (loose.has(parent.id)) { loose.add(id); continue; }
    const pAbs = absPos(finalNodes, parent);
    const x = oldAbs.x - pAbs.x, y = oldAbs.y - pAbs.y;
    if (x >= 0 && y >= 0 && x + node.w <= parent.w && y + node.h <= parent.h) { node.x = x; node.y = y; }
    else loose.add(id);
  }
  const layoutViews: string[] = [];
  {
    const views = new Set([...loose].map(id => finalNodes.get(id)!.viewId));
    for (const viewId of views) {
      const inView = [...finalNodes.values()].filter(n => n.viewId === viewId);
      const fixed = inView.filter(n => !loose.has(n.id));
      const kidsOf = (pid: string | undefined) => inView.filter(n => (n.parentNodeId ?? undefined) === pid && finalNodes.has(n.id));
      // Coloca los sueltos de un contenedor (primero sus propios hijos, para conocer su tamaño final).
      const place = (pid: string | undefined) => {
        const kids = kidsOf(pid);
        for (const k of kids) place(k.id);
        const free = kids.filter(k => loose.has(k.id));
        if (!free.length) return;
        const settled = kids.filter(k => !loose.has(k.id));
        const parent = pid ? finalNodes.get(pid) : undefined;
        const x0 = parent ? 20 : settled.length ? Math.min(...settled.map(n => n.x)) : 40;
        let y = parent ? (settled.length ? Math.max(...settled.map(n => n.y + n.h)) + 20 : 40) : (settled.length ? Math.max(...settled.map(n => n.y + n.h)) + 60 : 40);
        const perRow = parent ? 3 : 4;
        let x = x0, rowH = 0, right = 0, bottom = 0;
        free.forEach((n, i) => {
          if (i && i % perRow === 0) { x = x0; y += rowH + 40; rowH = 0; }
          n.x = x; n.y = y;
          x += n.w + 40; rowH = Math.max(rowH, n.h); right = Math.max(right, n.x + n.w); bottom = Math.max(bottom, n.y + n.h);
        });
        if (parent && (right + 20 > parent.w || bottom + 20 > parent.h)) {
          parent.w = Math.max(parent.w, right + 20); parent.h = Math.max(parent.h, bottom + 20);
          if (!isNew.has(parent.id)) keptChanged.add(parent.id);
        }
      };
      place(undefined);
      if (!fixed.length && inView.filter(n => !n.parentNodeId).length > 1) layoutViews.push(viewId);
    }
  }
  for (const nn of newNodes) sets.push({ type: 'set', collection: 'nodes', id: nn.id, value: nn });
  for (const id of keptChanged) {
    const r = cur.nodes[id], node = finalNodes.get(id);
    if (!node) continue;
    if (!r) { sets.push({ type: 'set', collection: 'nodes', id, value: node }); continue; }
    const p = diffPatch(r as unknown as Record<string, unknown>, node as unknown as Record<string, unknown>);
    if (p) patches.push({ type: 'patch', collection: 'nodes', id, patch: p });
  }

  // ---- referencias: todo lo del texto debe apuntar a algo que exista después de aplicarlo
  const doomed = new Set(deletes.map(d => `${d.c}/${d.id}`));
  const exists = (c: Collection, id: string) => !doomed.has(`${c}/${id}`) && ((cur[c] as Record<string, unknown>)[id] !== undefined || created.has(`${c}/${id}`) || (M[c] as Record<string, unknown>)[id] !== undefined);
  const need = (c: Collection, id: string | undefined, from: { c: string; id: string }) => {
    if (id === undefined || exists(c, id)) return;
    const msg: { key: string; vars: Record<string, string | number> } = c === 'elements' ? { key: 'El elemento «{id}» no existe', vars: { id } } : c === 'relations' ? { key: 'La relación «{id}» no existe', vars: { id } } : c === 'views' ? { key: 'La vista «{id}» no existe', vars: { id } } : { key: 'El nodo «{id}» no existe en la vista «{view}»', vars: { id, view: from.id } };
    err(msg, at(from.c, from.id));
  };
  for (const r of Object.values(M.relations)) for (const end of [r.from, r.to]) { need('elements', end.elementId, { c: 'relations', id: r.id }); need('relations', end.relationId, { c: 'relations', id: r.id }); }
  for (const v of Object.values(M.views)) need('elements', v.rootElementId, { c: 'views', id: v.id });
  for (const n of Object.values(M.nodes)) { need('elements', n.elementId, { c: 'nodes', id: n.id }); need('views', n.detailViewId, { c: 'nodes', id: n.id }); }
  for (const e of Object.values(M.edges)) need('relations', e.relationId, { c: 'edges', id: e.id });
  if (problems.length || (conflicts.length && !o.keepMine)) return { commands: [], conflicts, problems, layoutViews: [] };

  // ---- borrados con sus cascadas, calculadas sobre el estado ya modificado
  const commands: Command[] = [...sets, ...patches];
  if (deletes.length) {
    const tmp = new MemoryStore(structuredClone(cur));
    if (commands.length) execute(tmp, { type: 'batch', commands });
    deletes.sort((a, b) => DELETE_ORDER.indexOf(a.c) - DELETE_ORDER.indexOf(b.c));
    for (const d of deletes) {
      if (tmp.get(d.c, d.id) === undefined) continue;
      const prims = expand(tmp, deleteCommand(d.c, d.id));
      execute(tmp, { type: 'batch', commands: prims });
      commands.push(...prims);
    }
  }
  return { commands, conflicts: [], problems, layoutViews };
}

// ================================================================ Posiciones en el texto ↔ registros
/** Tramo del texto de la declaración de un registro (`elements/x`…), en desplazamientos. */
export interface RecordRange { key: string; start: number; end: number }

/** Desplazamiento de cada principio de línea. */
export function lineStarts(text: string): number[] {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) out.push(i + 1);
  return out;
}
export function offsetOf(starts: number[], line: number, col: number): number {
  return (starts[Math.max(0, Math.min(starts.length - 1, line - 1))] ?? 0) + Math.max(0, col - 1);
}
/** Línea y columna (1-based) de un desplazamiento. */
export function lineColOf(starts: number[], offset: number): { line: number; col: number } {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid]! <= offset) lo = mid; else hi = mid - 1; }
  return { line: lo + 1, col: offset - starts[lo]! + 1 };
}

/** Fin de la instrucción que empieza en `start`: fin de línea (o `;`), o la `}` que cierra su bloque. */
function statementEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"' || ch === '`') { let j = i + 1; while (j < text.length && text[j] !== ch && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1; i = j; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; i--; continue; }
    if (ch === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? text.length : e + 1; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { depth--; if (depth <= 0) { if (depth < 0) return i; if (ch === '}') return i + 1; } }
    else if ((ch === '\n' || ch === ';') && depth === 0) return i;
  }
  return text.length;
}

/** Tramos de las declaraciones (para saber qué registro hay bajo el cursor). */
export function recordRanges(text: string, locations: DslParseResult['locations']): RecordRange[] {
  const starts = lineStarts(text);
  const viewStarts = new Set(Object.entries(locations).filter(([k]) => k.startsWith('views/')).map(([, p]) => `${p.line}:${p.col}`));
  const out: RecordRange[] = [];
  for (const [key, p] of Object.entries(locations)) {
    // nodos de `include *`: su posición es la de la vista; no se pueden señalar en el texto
    if (!key.startsWith('views/') && (key.startsWith('nodes/') || key.startsWith('edges/')) && viewStarts.has(`${p.line}:${p.col}`)) continue;
    const start = offsetOf(starts, p.line, p.col);
    out.push({ key, start, end: statementEnd(text, start) });
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

/** Registro más interior cuya declaración contiene el desplazamiento. */
export function recordAt(ranges: RecordRange[], offset: number): RecordRange | undefined {
  let best: RecordRange | undefined;
  for (const r of ranges) {
    if (r.start > offset) break;
    if (offset <= r.end && (!best || r.end - r.start <= best.end - best.start)) best = r;
  }
  return best;
}

/** Selección del lienzo (en la vista `viewId`) que corresponde a un registro del texto. */
export function selectionForRecord(key: string, ws: Pick<Workspace, 'nodes' | 'edges'>, viewId: string | null): { nodes: string[]; edges: string[] } | null {
  if (!viewId) return null;
  const slash = key.indexOf('/');
  const c = key.slice(0, slash), id = key.slice(slash + 1);
  const nodes = Object.values(ws.nodes), edges = Object.values(ws.edges);
  if (c === 'nodes') return ws.nodes[id]?.viewId === viewId ? { nodes: [id], edges: [] } : null;
  if (c === 'edges') return ws.edges[id]?.viewId === viewId ? { nodes: [], edges: [id] } : null;
  if (c === 'elements') { const ns = nodes.filter(n => n.viewId === viewId && n.elementId === id).map(n => n.id); return ns.length ? { nodes: ns, edges: [] } : null; }
  if (c === 'relations') { const es = edges.filter(e => e.viewId === viewId && e.relationId === id).map(e => e.id); return es.length ? { nodes: [], edges: es } : null; }
  return null;
}

/** Registros del texto (por orden de preferencia) que corresponden a lo seleccionado en el lienzo. */
export function recordsForSelection(sel: { nodes: string[]; edges: string[] }, ws: Pick<Workspace, 'nodes' | 'edges'>): string[] {
  const out: string[] = [];
  const n = sel.nodes[0] ? ws.nodes[sel.nodes[0]] : undefined;
  if (n) { if (n.elementId) out.push(`elements/${n.elementId}`); out.push(`nodes/${n.id}`); return out; }
  const e = sel.edges[0] ? ws.edges[sel.edges[0]] : undefined;
  if (e) { if (e.relationId) out.push(`relations/${e.relationId}`); out.push(`edges/${e.id}`); }
  return out;
}

/**
 * Lleva el cursor del texto viejo al nuevo (al recargar el texto por un cambio del modelo): misma declaración y mismo
 * desplazamiento dentro de ella si sigue existiendo; si no, misma línea y columna.
 */
export function mapOffset(oldText: string, oldRanges: RecordRange[], newText: string, newRanges: RecordRange[], offset: number): number {
  const r = recordAt(oldRanges, offset);
  const nr = r && newRanges.find(x => x.key === r.key);
  if (r && nr) return Math.min(nr.start + (offset - r.start), nr.end, newText.length);
  const { line, col } = lineColOf(lineStarts(oldText), offset);
  const starts = lineStarts(newText);
  const l = Math.min(line, starts.length);
  const lineEnd = l < starts.length ? starts[l]! - 1 : newText.length;
  return Math.min(offsetOf(starts, l, col), lineEnd);
}

/**
 * Inserciones que hacen explícitos los ids que el texto dejó al lenguaje (`archimate:BusinessActor "Ana"` →
 * `ana = archimate:BusinessActor "Ana"`), para que renombrar después no cambie el id. De abajo arriba.
 */
export function explicitIdEdits(text: string, snap: Pick<TextSnapshot, 'ws' | 'locations'>): { offset: number; insert: string }[] {
  const starts = lineStarts(text);
  const out: { offset: number; insert: string }[] = [];
  const HEAD = /^(?:`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$.-]*(?::[\w$.-]+)*)\s*=(?!=)/;
  for (const [key, p] of Object.entries(snap.locations)) {
    const slash = key.indexOf('/');
    const c = key.slice(0, slash), id = key.slice(slash + 1);
    const off = offsetOf(starts, p.line, p.col);
    const rest = text.slice(off, off + 400);
    if (c === 'elements' || c === 'relations') {
      if (!(snap.ws[c] as Record<string, unknown>)[id] || HEAD.test(rest)) continue;
      out.push({ offset: off, insert: `${dslId(id)} = ` });
    } else if (c === 'views') {
      const m = /^view(\s*)(?=["{]|$)/.exec(rest);
      if (m && snap.ws.views[id]) out.push({ offset: off + 4, insert: ` ${dslId(id)}${m[1] ? '' : ' '}` });
    }
  }
  return out.sort((a, b) => b.offset - a.offset);
}

/** Aplica inserciones (de abajo arriba) a un texto. */
export function applyEdits(text: string, edits: { offset: number; insert: string }[]): string {
  let out = text;
  for (const e of edits) out = out.slice(0, e.offset) + e.insert + out.slice(e.offset);
  return out;
}
