/**
 * **Structurizr** (workspace JSON, https://structurizr.com) ↔ notación `c4`.
 *
 * Mapeo:
 * - `model.people` → `c4:Person`; `softwareSystems` → `c4:SoftwareSystem`; sus `containers` → `c4:Container` y
 *   `components` → `c4:Component`; `deploymentNodes` (recursivos) e `infrastructureNodes` → `c4:DeploymentNode`.
 *   `location: "External"` o etiqueta `External` → `fields.external`. `description` → `doc`, `technology` → `fields.technology`,
 *   `tags` → `tags`, `properties` → `props`. Los ids de Structurizr se conservan (como cadenas).
 * - `relationships` de cualquier elemento → `c4:Relationship` (nombre = descripción, `fields.technology`). Las relaciones
 *   de instancias (`linkedRelationshipId`) se resuelven a la relación del contenedor.
 * - Vistas: `systemLandscapeViews`/`systemContextViews` → viewpoint `context`; `containerViews` → `container`;
 *   `componentViews` → `component`; `deploymentViews` → `deployment` (`props.environment`). `elements[{id,x,y}]` → nodos
 *   (coordenadas absolutas → relativas si el padre está en la vista); `containerInstances` → nodo del contenedor dentro del
 *   nodo de despliegue. Las vistas dinámicas y filtradas no se importan.
 * - La jerarquía sistema ⊃ contenedor ⊃ componente ⊃ (nodo de despliegue ⊃ nodo) se guarda en `features.parentId`.
 *   Al exportar se usa eso y, si falta, el anidamiento en las vistas; los contenedores sin sistema van a uno sintético con aviso.
 */
import { parseWorkspace, type Workspace, type Element, type View, type ViewNode, type ViewEdge } from '@all-draw/core';
import { emptyWs, makeEl, makeRel } from './archimate';

// ---------------------------------------------------------------- Formato de origen (subconjunto)
export interface SzRelationship { id: string | number; sourceId: string | number; destinationId: string | number; description?: string; technology?: string; tags?: string; linkedRelationshipId?: string | number; properties?: Record<string, string> }
export interface SzElement { id: string | number; name?: string; description?: string; technology?: string; tags?: string; location?: string; url?: string; properties?: Record<string, string>; relationships?: SzRelationship[] }
export interface SzComponent extends SzElement { }
export interface SzContainer extends SzElement { components?: SzComponent[] }
export interface SzSoftwareSystem extends SzElement { containers?: SzContainer[] }
export interface SzInstance extends SzElement { containerId?: string | number; softwareSystemId?: string | number; instanceId?: number; environment?: string }
export interface SzDeploymentNode extends SzElement { environment?: string; instances?: string | number; children?: SzDeploymentNode[]; infrastructureNodes?: SzElement[]; containerInstances?: SzInstance[]; softwareSystemInstances?: SzInstance[] }
export interface SzViewElement { id: string | number; x?: number; y?: number }
export interface SzViewRelationship { id: string | number; vertices?: { x: number; y: number }[]; routing?: string; position?: number }
export interface SzView { key: string; title?: string; description?: string; softwareSystemId?: string | number; containerId?: string | number; environment?: string; elements?: SzViewElement[]; relationships?: SzViewRelationship[]; properties?: Record<string, string> }
export interface SzViews { systemLandscapeViews?: SzView[]; systemContextViews?: SzView[]; containerViews?: SzView[]; componentViews?: SzView[]; deploymentViews?: SzView[]; dynamicViews?: SzView[]; filteredViews?: SzView[]; configuration?: unknown }
export interface StructurizrWorkspace { id?: number; name?: string; description?: string; version?: string; model?: { people?: SzElement[]; softwareSystems?: SzSoftwareSystem[]; deploymentNodes?: SzDeploymentNode[] }; views?: SzViews }

export interface StructurizrImport { workspace: Workspace; warnings: string[] }
export interface StructurizrExport { text: string; data: StructurizrWorkspace; warnings: string[] }

const C4 = 'c4';
const T = { person: `${C4}:Person`, system: `${C4}:SoftwareSystem`, container: `${C4}:Container`, component: `${C4}:Component`, code: `${C4}:Code`, node: `${C4}:DeploymentNode`, boundary: `${C4}:Boundary` };
const REL = `${C4}:Relationship`;
export const STRUCTURIZR_DIMENSION_ID = 'dim_c4';
const NODE_W = 220, NODE_H = 140, PAD = 30, HEADER = 40;

const sid = (v: string | number | undefined) => (v === undefined || v === null ? '' : String(v));
const splitTags = (s: string | undefined) => (s ?? '').split(',').map(t => t.trim()).filter(Boolean);

// ---------------------------------------------------------------- Importador
export function importStructurizr(input: string | StructurizrWorkspace): StructurizrImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const src = (typeof input === 'string' ? JSON.parse(input) : input) as StructurizrWorkspace | null;
  if (!src || typeof src !== 'object' || (!src.model && !src.views)) throw new Error('El fichero no parece un workspace de Structurizr (faltan `model` y `views`).');

  const ws = emptyWs(src.name || 'Workspace Structurizr');
  ws.meta.description = src.description ?? '';
  const parentOf = new Map<string, string>();          // hijo → padre (jerarquía del modelo)
  const instanceOf = new Map<string, string>();        // instancia → elemento (contenedor / sistema)
  const rawRels: SzRelationship[] = [];

  const add = (raw: SzElement, typeId: string, parent?: string, extra: Partial<Element> = {}): string | null => {
    const id = sid(raw.id);
    if (!id) { warn(`Elemento "${raw.name}" sin id; se omite`); return null; }
    if (ws.elements[id]) { warn(`Elemento ${id} duplicado; se conserva el primero`); return id; }
    const el = makeEl(id, typeId, raw.name ?? '');
    el.doc = raw.description ?? '';
    el.tags = splitTags(raw.tags).filter(t => !['Element', 'Person', 'Software System', 'Container', 'Component', 'Deployment Node', 'Infrastructure Node', 'External', 'Container Instance', 'Software System Instance'].includes(t));
    el.props = { ...raw.properties };
    if (raw.url) el.props.url = raw.url;
    const external = raw.location === 'External' || splitTags(raw.tags).includes('External');
    if (typeId === T.person || typeId === T.system) el.fields.external = external;
    if (raw.technology) el.fields.technology = raw.technology;
    Object.assign(el, extra);
    if (parent) { el.features.parentId = parent; parentOf.set(id, parent); }
    ws.elements[id] = el;
    for (const r of raw.relationships ?? []) rawRels.push(r);
    return id;
  };

  for (const p of src.model?.people ?? []) add(p, T.person);
  for (const s of src.model?.softwareSystems ?? []) {
    const sysId = add(s, T.system);
    for (const c of s.containers ?? []) {
      const kind = splitTags(c.tags).map(t => t.toLowerCase()).find(t => ['database', 'queue', 'browser', 'mobile', 'filesystem', 'microservice'].includes(t));
      const cId = add(c, T.container, sysId ?? undefined, { fields: { technology: c.technology ?? '', ...(kind ? { kind } : {}) } });
      if (cId && kind) ws.elements[cId]!.tags = ws.elements[cId]!.tags.filter(t => t.toLowerCase() !== kind);
      for (const k of c.components ?? []) add(k, T.component, cId ?? undefined);
    }
  }
  const walkNode = (n: SzDeploymentNode, parent?: string) => {
    const id = add(n, T.node, parent, { fields: { technology: n.technology ?? '', instances: Number(n.instances ?? 1) || 1 }, props: { ...n.properties, ...(n.environment ? { environment: n.environment } : {}) } });
    if (!id) return;
    for (const c of n.children ?? []) walkNode(c, id);
    for (const i of n.infrastructureNodes ?? []) add(i, T.node, id);
    for (const ci of [...(n.containerInstances ?? []), ...(n.softwareSystemInstances ?? [])]) {
      const target = sid(ci.containerId ?? ci.softwareSystemId);
      if (!target) continue;
      instanceOf.set(sid(ci.id), target);
      parentOf.set(sid(ci.id), id);
      for (const r of ci.relationships ?? []) rawRels.push(r);
    }
  };
  for (const n of src.model?.deploymentNodes ?? []) walkNode(n);

  // ---- relaciones
  const relAlias = new Map<string, string>();
  const resolve = (id: string) => instanceOf.get(id) ?? id;
  for (const r of rawRels) {
    const id = sid(r.id);
    if (!id) continue;
    if (r.linkedRelationshipId !== undefined) { relAlias.set(id, sid(r.linkedRelationshipId)); continue; }
    const from = resolve(sid(r.sourceId)), to = resolve(sid(r.destinationId));
    if (!ws.elements[from] || !ws.elements[to]) { warn(`La relación ${id} une elementos inexistentes (${r.sourceId} → ${r.destinationId}); se omite`); continue; }
    if (ws.relations[id]) { warn(`Relación ${id} duplicada; se conserva la primera`); continue; }
    const rel = makeRel(id, REL, { elementId: from }, { elementId: to });
    rel.name = r.description ?? '';
    rel.fields = { description: r.description ?? '', technology: r.technology ?? '' };
    rel.props = { ...r.properties };
    const tags = splitTags(r.tags).filter(t => t !== 'Relationship');
    if (tags.length) rel.props.tags = tags.join(', ');
    ws.relations[id] = rel;
  }
  for (const [alias, target] of relAlias) if (!ws.relations[target]) warn(`La relación ${alias} enlaza con la relación inexistente ${target}`);

  // ---- vistas
  const kinds: ['systemLandscapeViews' | 'systemContextViews' | 'containerViews' | 'componentViews' | 'deploymentViews', string][] = [['systemLandscapeViews', 'context'], ['systemContextViews', 'context'], ['containerViews', 'container'], ['componentViews', 'component'], ['deploymentViews', 'deployment']];
  for (const key of ['dynamicViews', 'filteredViews'] as const) for (const v of src.views?.[key] ?? []) warn(`La vista "${v.key}" es ${key === 'dynamicViews' ? 'dinámica' : 'filtrada'} y no se importa`);
  for (const [key, viewpointId] of kinds) {
    for (const v of src.views?.[key] ?? []) {
      if (!v?.key) continue;
      if (ws.views[v.key]) { warn(`Vista "${v.key}" duplicada; se ignora la segunda`); continue; }
      const view: View = { id: v.key, kind: 'freeform', notationId: C4, viewpointId, name: v.title || v.key, doc: v.description ?? '', style: {}, props: { ...v.properties } };
      if (key === 'systemLandscapeViews') view.props.landscape = 'true';
      const root = sid(key === 'componentViews' ? v.containerId : v.softwareSystemId);
      if (root && ws.elements[root]) view.rootElementId = root;
      if (v.environment) view.props.environment = v.environment;
      ws.views[v.key] = view;

      const present = new Map<string, SzViewElement>();
      for (const e of v.elements ?? []) present.set(sid(e.id), e);
      const nodeOf = new Map<string, ViewNode>();    // id de Structurizr (elemento o instancia) → nodo
      for (const [id, e] of present) {
        const elId = instanceOf.get(id) ?? id;
        if (!ws.elements[elId]) { warn(`Vista "${v.key}": el elemento ${id} no existe en el modelo; se omite`); continue; }
        const nid = `${v.key}:${id}`;
        const n: ViewNode = { id: nid, viewId: v.key, elementId: elId, x: e.x ?? 0, y: e.y ?? 0, w: NODE_W, h: NODE_H, style: {} };
        if (instanceOf.has(id)) n.meta = { instanceId: id };
        ws.nodes[nid] = n;
        nodeOf.set(id, n);
      }
      // anidamiento: si el padre del modelo está en la vista, coordenadas relativas
      const absOf = new Map<string, { x: number; y: number }>();
      for (const [id, n] of nodeOf) absOf.set(id, { x: n.x, y: n.y });
      for (const [id, n] of nodeOf) {
        const p = parentOf.get(id);
        const pn = p ? nodeOf.get(p) : undefined;
        if (!pn) continue;
        n.parentNodeId = pn.id;
        const a = absOf.get(id)!, pa = absOf.get(p!)!;
        n.x = a.x - pa.x; n.y = a.y - pa.y;
      }
      // tamaño de los contenedores para abarcar a sus hijos
      const fit = (n: ViewNode): void => {
        const kids = [...nodeOf.values()].filter(k => k.parentNodeId === n.id);
        if (!kids.length) return;
        for (const k of kids) fit(k);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const k of kids) { minX = Math.min(minX, k.x); minY = Math.min(minY, k.y); maxX = Math.max(maxX, k.x + k.w); maxY = Math.max(maxY, k.y + k.h); }
        const dx = Math.min(0, minX - PAD), dy = Math.min(0, minY - PAD - HEADER);
        if (dx || dy) { n.x += dx; n.y += dy; for (const k of kids) { k.x -= dx; k.y -= dy; } maxX -= dx; maxY -= dy; }
        n.w = Math.max(n.w, maxX + PAD); n.h = Math.max(n.h, maxY + PAD);
      };
      for (const n of nodeOf.values()) if (!n.parentNodeId) fit(n);

      const edgesWanted: SzViewRelationship[] = v.relationships ?? Object.values(ws.relations).filter(r => [...nodeOf.values()].some(n => n.elementId === r.from.elementId) && [...nodeOf.values()].some(n => n.elementId === r.to.elementId)).map(r => ({ id: r.id }));
      for (const vr of edgesWanted) {
        const rid = relAlias.get(sid(vr.id)) ?? sid(vr.id);
        const rel = ws.relations[rid];
        if (!rel) { warn(`Vista "${v.key}": la relación ${vr.id} no existe en el modelo; se omite`); continue; }
        const a = [...nodeOf.values()].find(n => n.elementId === rel.from.elementId), b = [...nodeOf.values()].find(n => n.elementId === rel.to.elementId);
        if (!a || !b) { warn(`Vista "${v.key}": la relación ${vr.id} une elementos que no están en la vista; se omite`); continue; }
        const eid = `${v.key}:${vr.id}`;
        const edge: ViewEdge = { id: eid, viewId: v.key, relationId: rid, fromNodeId: a.id, toNodeId: b.id, bendpoints: (vr.vertices ?? []).map(p => ({ x: p.x, y: p.y })), style: {} };
        if (vr.routing === 'Orthogonal') edge.style.router = 'orthogonal';
        if (vr.routing === 'Curved') edge.style.router = 'bezier';
        if (rel.name) edge.label = rel.name;
        ws.edges[eid] = edge;
      }
    }
  }

  ws.dimensions[STRUCTURIZR_DIMENSION_ID] = { id: STRUCTURIZR_DIMENSION_ID, name: 'C4', notationId: C4, kind: 'freeform' };
  ws.meta.currentViewId = Object.keys(ws.views)[0] ?? null;
  return { workspace: parseWorkspace(ws), warnings };
}

// ---------------------------------------------------------------- Exportador
export function exportStructurizr(ws: Workspace): StructurizrExport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const els = Object.values(ws.elements).filter(e => {
    if (!e.typeId.startsWith(`${C4}:`)) { warn(`El elemento "${e.name}" (${e.id}) no es C4 (${e.typeId}); se omite`); return false; }
    if (e.typeId === T.boundary || e.typeId === T.code) { warn(`El elemento "${e.name}" es un ${e.typeId === T.code ? 'código' : 'límite'} y Structurizr no lo modela; se omite`); return false; }
    return true;
  });
  const byType = (t: string) => els.filter(e => e.typeId === t);
  const nodes = Object.values(ws.nodes);
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  /** Padre en el modelo: `features.parentId` si existe; si no, el anidamiento en cualquier vista (primer padre del tipo pedido). */
  const parentOf = (elId: string, parentType: string): string | undefined => {
    const declared = ws.elements[elId]?.features.parentId;
    if (typeof declared === 'string' && ws.elements[declared]?.typeId === parentType && elIds.has(declared)) return declared;
    for (const n of nodes) {
      if (n.elementId !== elId || !n.parentNodeId) continue;
      const p = nodeById.get(n.parentNodeId);
      const pe = p?.elementId ? ws.elements[p.elementId] : undefined;
      if (pe && pe.typeId === parentType) return pe.id;
    }
    return undefined;
  };
  const props = (e: Element) => { const { url, environment, ...rest } = e.props; void environment; return { ...(Object.keys(rest).length ? { properties: rest } : {}), ...(url ? { url } : {}) }; };
  const base = (e: Element): SzElement => ({ id: e.id, name: e.name, description: e.doc, ...(e.tags.length ? { tags: e.tags.join(',') } : {}), ...props(e) });
  const withTech = (e: Element): SzElement => ({ ...base(e), ...(e.fields.technology ? { technology: String(e.fields.technology) } : {}) });
  const relsBySource = new Map<string, SzRelationship[]>();
  const elIds = new Set(els.map(e => e.id));
  for (const r of Object.values(ws.relations)) {
    if (!r.typeId.startsWith(`${C4}:`)) continue;
    const from = r.from.elementId, to = r.to.elementId;
    if (!from || !to || !elIds.has(from) || !elIds.has(to)) { warn(`La relación ${r.id} une elementos no exportados; se omite`); continue; }
    const sz: SzRelationship = { id: r.id, sourceId: from, destinationId: to, description: r.name || String(r.fields.description ?? '') };
    if (r.fields.technology) sz.technology = String(r.fields.technology);
    if (r.props.tags) sz.tags = r.props.tags;
    relsBySource.set(from, [...(relsBySource.get(from) ?? []), sz]);
  }
  const withRels = <E extends SzElement>(e: Element, x: E): E => { const rs = relsBySource.get(e.id); return rs ? { ...x, relationships: rs } : x; };
  const tagsExternal = (e: Element, x: SzElement): SzElement => (e.fields.external ? { ...x, location: 'External', tags: [x.tags, 'External'].filter(Boolean).join(',') } : x);

  const people = byType(T.person).map(e => withRels(e, tagsExternal(e, base(e))));
  const systems: SzSoftwareSystem[] = byType(T.system).map(e => withRels(e, { ...tagsExternal(e, base(e)), containers: [] }));
  const synthetic = (): SzSoftwareSystem => {
    let s = systems.find(x => x.id === 'sin-sistema');
    if (!s) { s = { id: 'sin-sistema', name: 'Sin sistema', description: 'Contenedores que no están anidados en ningún sistema.', containers: [] }; systems.push(s); }
    return s;
  };
  const containers = new Map<string, SzContainer>();
  for (const e of byType(T.container)) {
    const c: SzContainer = withRels(e, { ...withTech(e), components: [] });
    if (e.fields.kind && !e.tags.some(t => t.toLowerCase() === String(e.fields.kind))) c.tags = [c.tags, String(e.fields.kind)].filter(Boolean).join(',');
    const sys = parentOf(e.id, T.system);
    const owner = sys ? systems.find(s => s.id === sys) : undefined;
    if (!owner) warn(`El contenedor "${e.name}" no está anidado en ningún sistema; va a "Sin sistema"`);
    (owner ?? synthetic()).containers!.push(c);
    containers.set(e.id, c);
  }
  for (const e of byType(T.component)) {
    const cont = parentOf(e.id, T.container);
    const owner = cont ? containers.get(cont) : undefined;
    if (!owner) { warn(`El componente "${e.name}" no está anidado en ningún contenedor; se omite`); continue; }
    owner.components!.push(withRels(e, withTech(e)));
  }
  // nodos de despliegue: árbol por anidamiento; las instancias salen de contenedores/sistemas anidados en un nodo
  const dnodes = new Map<string, SzDeploymentNode>();
  for (const e of byType(T.node)) dnodes.set(e.id, withRels(e, { ...withTech(e), environment: e.props.environment || 'Default', instances: String(e.fields.instances ?? 1), children: [], containerInstances: [], softwareSystemInstances: [] }));
  const deploymentNodes: SzDeploymentNode[] = [];
  for (const [id, dn] of dnodes) { const p = parentOf(id, T.node); const parent = p ? dnodes.get(p) : undefined; (parent ? parent.children! : deploymentNodes).push(dn); }
  const instanceIds = new Map<string, string>();   // nodeId → id de instancia
  for (const n of nodes) {
    if (!n.elementId || !n.parentNodeId) continue;
    const e = ws.elements[n.elementId], p = nodeById.get(n.parentNodeId);
    const pe = p?.elementId ? ws.elements[p.elementId] : undefined;
    if (!e || !pe || pe.typeId !== T.node || !dnodes.has(pe.id)) continue;
    if (e.typeId !== T.container && e.typeId !== T.system) continue;
    const iid = (n.meta?.instanceId as string | undefined) ?? `${pe.id}_${e.id}`;
    instanceIds.set(n.id, iid);
    const dn = dnodes.get(pe.id)!;
    const list = e.typeId === T.container ? dn.containerInstances! : dn.softwareSystemInstances!;
    if (!list.some(i => sid(i.id) === iid)) list.push({ id: iid, ...(e.typeId === T.container ? { containerId: e.id } : { softwareSystemId: e.id }), environment: dn.environment, instanceId: list.length + 1 });
  }

  // ---- vistas
  const views: SzViews = { systemLandscapeViews: [], systemContextViews: [], containerViews: [], componentViews: [], deploymentViews: [] };
  for (const v of Object.values(ws.views)) {
    if (v.notationId !== C4) { warn(`La vista "${v.name}" no es C4; se omite`); continue; }
    if (v.viewpointId === 'code') { warn(`La vista "${v.name}" es de código y Structurizr no la tiene; se omite`); continue; }
    const vnodes = nodes.filter(n => n.viewId === v.id);
    const abs = new Map<string, { x: number; y: number }>();
    const absOf = (n: ViewNode): { x: number; y: number } => {
      const cached = abs.get(n.id); if (cached) return cached;
      const p = n.parentNodeId ? nodeById.get(n.parentNodeId) : undefined;
      const pa = p && p.viewId === v.id ? absOf(p) : { x: 0, y: 0 };
      const r = { x: pa.x + n.x, y: pa.y + n.y }; abs.set(n.id, r); return r;
    };
    const elements: SzViewElement[] = [];
    const seen = new Set<string>();
    for (const n of vnodes) {
      if (!n.elementId || !elIds.has(n.elementId)) { if (n.elementId) warn(`Vista "${v.name}": el nodo ${n.id} apunta a un elemento no exportado; se omite`); continue; }
      const id = instanceIds.get(n.id) ?? n.elementId;
      if (seen.has(id)) { warn(`Vista "${v.name}": el elemento ${id} aparece dos veces; Structurizr solo admite una`); continue; }
      seen.add(id);
      const a = absOf(n);
      elements.push({ id, x: Math.round(a.x), y: Math.round(a.y) });
    }
    const relationships: SzViewRelationship[] = [];
    for (const e of Object.values(ws.edges)) {
      if (e.viewId !== v.id || !e.relationId) continue;
      const r = ws.relations[e.relationId];
      if (!r || !r.from.elementId || !relsBySource.get(r.from.elementId)?.some(x => x.id === r.id)) continue;
      const vr: SzViewRelationship = { id: r.id };
      if (e.bendpoints.length) vr.vertices = e.bendpoints.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
      if (e.style.router === 'orthogonal') vr.routing = 'Orthogonal';
      relationships.push(vr);
    }
    const { environment, landscape, ...rest } = v.props;
    const sz: SzView = { key: v.id, title: v.name, description: v.doc, elements, relationships, ...(Object.keys(rest).length ? { properties: rest } : {}) };
    const firstOf = (t: string): string | undefined => vnodes.map(n => (n.elementId ? ws.elements[n.elementId] : undefined)).find(e => e && e.typeId === t)?.id;
    const root = v.rootElementId && elIds.has(v.rootElementId) ? v.rootElementId : undefined;
    switch (v.viewpointId) {
      case 'container': views.containerViews!.push({ ...sz, softwareSystemId: root ?? firstOf(T.system) ?? systems[0]?.id ?? '' }); break;
      case 'component': views.componentViews!.push({ ...sz, containerId: root ?? firstOf(T.container) ?? '' }); break;
      case 'deployment': views.deploymentViews!.push({ ...sz, environment: environment || 'Default', ...(root ? { softwareSystemId: root } : {}) }); break;
      case 'context': if (landscape === 'true' || !(root ?? firstOf(T.system))) views.systemLandscapeViews!.push(sz); else views.systemContextViews!.push({ ...sz, softwareSystemId: root ?? firstOf(T.system)! }); break;
      default: views.systemLandscapeViews!.push(sz);
    }
  }

  const data: StructurizrWorkspace = {
    id: 1, name: ws.meta.name, description: ws.meta.description,
    model: { people, softwareSystems: systems, deploymentNodes },
    views,
  };
  return { text: JSON.stringify(data, null, 2) + '\n', data, warnings };
}
