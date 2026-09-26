/**
 * Importador de ficheros **Drawer** (`.drawer` / JSON exportado por el diagramador de capas×etapas).
 *
 * Mapeo:
 * - `Library`         → `Library` (tipos `lib:<libId>:<typeId>`), `Component` → `Element` (mismo id).
 *   Un componente de Drawer es **un** elemento del modelo, aunque aparezca en varias celdas o
 *   diagramas. Los usados quedan `template: false`; los no usados, `template: true`.
 * - `Api`             → `Element` de tipo `lib:api` (id = componente espejo `api-<apiId>`), y cada
 *   `ApiOperation` → `Element` de tipo `lib:apiOperation` unido a su API con `core:link`
 *   "operación de". Un placement con `operationId` apunta al elemento de la operación, así que
 *   sus pines son los del contrato (request/response) y no los del espejo.
 * - `Diagram`         → `View` grid (mismo id) con `grid: { layers, stages, stageGroups }`.
 * - `Placement`       → `ViewNode` (mismo id) con `cell`, `x`, `y`, `parentNodeId`, `note`, `meta`.
 * - `Relation`        → `Relation` `core:link` entre elementos (+ `from.portId`/`to.portId` si el
 *   campo existe como puerto) y un `ViewEdge`. Relaciones equivalentes se reutilizan entre diagramas.
 * - `people`, `rules`, `currentDiagramId` → `Person`, `StyleRule`, `meta.currentViewId`.
 *
 * Las referencias rotas del origen producen **warnings**, nunca errores.
 */
import {
  parseWorkspace, allPorts, portId, NotationRegistry, CORE_PACK,
  type Workspace, type Library, type Element, type ElementType, type FieldDef, type Relation, type View, type ViewNode,
  type ViewEdge, type Person, type StyleRule, type KeyValue, type ArrowHead,
} from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK, normalizeGrid } from '@all-draw/notation-grid';

// ---------------------------------------------------------------- Formato de origen (Drawer v1)
export interface DrawerFieldDef { key: string; label: string; kind: string; options?: string }
export interface DrawerType { id: string; name: string; color?: string; icon?: string; fields?: DrawerFieldDef[] }
export interface DrawerComponent { id: string; name: string; typeId: string | null; description?: string; fields?: Record<string, unknown>; apiId?: string | null }
export interface DrawerLibrary { id: string; name: string; types?: DrawerType[]; components?: DrawerComponent[] }
export interface DrawerLayer { id: string; name: string; color?: string; height?: number }
export interface DrawerStage { id: string; name: string; width?: number; groupId?: string | null }
export interface DrawerStageGroup { id: string; name: string; color?: string }
export interface DrawerPlacement { id: string; componentId: string; layerId: string; stageId: string; x?: number; y?: number; parentId?: string | null; operationId?: string | null; note?: string }
export interface DrawerRelation { id: string; from: string; to: string; fromField?: string; toField?: string; style?: string; dir?: string; color?: string; width?: number; label?: string }
export interface DrawerDiagram { id: string; name: string; description?: string; layers?: DrawerLayer[]; stages?: DrawerStage[]; stageGroups?: DrawerStageGroup[]; public?: boolean; placements?: DrawerPlacement[]; relations?: DrawerRelation[] }
export interface DrawerOperation { id: string; name?: string; method?: string; path?: string; summary?: string; deprecated?: boolean; headers?: KeyValue[]; pathParams?: KeyValue[]; queryParams?: KeyValue[]; requestBody?: string; responseBody?: string; codes?: KeyValue[]; notes?: string }
export interface DrawerApi { id: string; name: string; description?: string; repoUrl?: string; docsUrl?: string; version?: string; auth?: string; baseUrls?: KeyValue[]; operations?: DrawerOperation[]; color?: string; icon?: string; tags?: string }
export interface DrawerAssignment { id: string; role: string; kind: string; targetId: string; notes?: string }
export interface DrawerPerson { id: string; name: string; email?: string; title?: string; team?: string; color?: string; notes?: string; assignments?: DrawerAssignment[] }
export interface DrawerRule { id: string; name: string; enabled?: boolean; priority?: number; match?: string; conditions?: { source: string; key?: string; op: string; value?: string; caseSensitive?: boolean }[]; style?: Record<string, unknown>; diagramId?: string | null }
/** `AppData` o `ExportFile`: mismas colecciones; el fichero `.drawer` añade `app`, `version`, `exportedAt`. */
export interface DrawerFile {
  app?: string; version?: number; exportedAt?: string;
  libraries?: DrawerLibrary[]; diagrams?: DrawerDiagram[]; diagram?: DrawerDiagram;
  people?: DrawerPerson[]; rules?: DrawerRule[]; apis?: DrawerApi[]; currentDiagramId?: string | null;
}

export interface DrawerImport { workspace: Workspace; warnings: string[] }

// ---------------------------------------------------------------- Constantes de mapeo
/** Librería del catálogo de APIs en Drawer y prefijo de sus componentes espejo. */
export const DRAWER_API_LIB_ID = 'lib-apis';
export const API_TYPE_ID = 'lib:api';
export const API_OPERATION_TYPE_ID = 'lib:apiOperation';
export const GRID_DIMENSION_ID = 'dim_grid';
export const OPERATION_RELATION_NAME = 'operación de';

const FIELD_KINDS = new Set(['text', 'textarea', 'number', 'select', 'checkbox', 'url', 'date', 'list', 'keyvalue', 'json', 'ref']);
const LINE_STYLES = new Set(['solid', 'dashed', 'dotted']);

export const API_FIELDS: FieldDef[] = [
  { key: 'repoUrl', label: 'Repositorio', kind: 'url' },
  { key: 'docsUrl', label: 'Documentación', kind: 'url' },
  { key: 'version', label: 'Versión', kind: 'text' },
  { key: 'auth', label: 'Autenticación', kind: 'text' },
  { key: 'baseUrls', label: 'Base URL por entorno', kind: 'keyvalue', options: 'Entorno|Base URL' },
  { key: 'tags', label: 'Etiquetas', kind: 'text' },
];

export const API_OPERATION_FIELDS: FieldDef[] = [
  { key: 'method', label: 'Método', kind: 'select', options: 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS' },
  { key: 'path', label: 'Path', kind: 'text' },
  { key: 'summary', label: 'Resumen', kind: 'textarea' },
  { key: 'headers', label: 'Cabeceras', kind: 'keyvalue', options: 'Cabecera|Valor / descripción' },
  { key: 'pathParams', label: 'Parámetros de path', kind: 'keyvalue', options: 'Parámetro|Tipo / descripción' },
  { key: 'queryParams', label: 'Parámetros de query', kind: 'keyvalue', options: 'Parámetro|Tipo / descripción' },
  { key: 'requestBody', label: 'Request body (JSON)', kind: 'json', direction: 'in' },
  { key: 'responseBody', label: 'Response body (JSON)', kind: 'json', direction: 'out' },
  { key: 'codes', label: 'Códigos de respuesta', kind: 'keyvalue', options: 'Código|Significado' },
  { key: 'notes', label: 'Notas', kind: 'textarea' },
];

export const API_ELEMENT_TYPE: ElementType = {
  id: API_TYPE_ID, name: 'API', category: 'APIs', color: '#2563eb', icon: '🔌', shape: 'rounded', container: false, fields: API_FIELDS,
  doc: 'API del catálogo: se define una vez y se usa en tantas celdas como haga falta.',
};
export const API_OPERATION_ELEMENT_TYPE: ElementType = {
  id: API_OPERATION_TYPE_ID, name: 'Operación de API', category: 'APIs', color: '#3b82f6', icon: '⇄', shape: 'rounded', fields: API_OPERATION_FIELDS,
  doc: 'Un path + método de una API, con su contrato. Sus campos JSON son pines.',
};

/** Claves del tipo "API con contrato" de Drawer → campos de nuestra operación. */
const CONTRACT_KEY_MAP: Record<string, string> = {
  request_body: 'requestBody', response_body: 'responseBody', path_params: 'pathParams',
  query_params: 'queryParams', response_codes: 'codes', headers: 'headers', method: 'method', path: 'path', notas: 'notes',
};

export const libTypeId = (libId: string, typeId: string) => `lib:${libId}:${typeId}`;
export const apiElementId = (apiId: string) => `api-${apiId}`;
export const operationElementId = (opId: string) => `op-${opId}`;

// ---------------------------------------------------------------- Importador
export function importDrawer(input: unknown): DrawerImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const src = readInput(input);

  const ws: Workspace = {
    meta: { schemaVersion: 1, name: 'Importado de Drawer', description: '' },
    libraries: {}, elements: {}, relations: {}, views: {}, nodes: {}, edges: {}, dimensions: {}, people: {}, rules: {},
  };
  const reg = new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(GRID_PACK);

  // ---- tipos de librería
  const typeIndex = new Map<string, string>();                  // typeId de Drawer → id nuestro
  for (const lib of src.libraries) {
    const elementTypes: ElementType[] = [];
    for (const t of lib.types ?? []) {
      if (!t?.id) continue;
      const id = libTypeId(lib.id, t.id);
      if (typeIndex.has(t.id)) warn(`Tipo ${t.id} repetido entre librerías; gana el de "${lib.name}"`);
      typeIndex.set(t.id, id);
      elementTypes.push({
        id, name: t.name || t.id, category: lib.name, color: t.color, icon: t.icon, shape: 'rounded',
        fields: (t.fields ?? []).filter(f => f && f.key).map(f => mapFieldDef(f, warn, `${lib.name}/${t.name}`)),
      });
    }
    ws.libraries[lib.id] = { id: lib.id, name: lib.name || 'Librería', description: '', elementTypes, relationTypes: [], portTypes: [], notations: ['grid', 'freeform'] };
  }

  // ---- catálogo de APIs (Drawer no lo guarda siempre: si falta, se reconstruye desde los espejos)
  const mirrors = src.libraries.flatMap(l => (l.components ?? []).filter(c => c?.apiId).map(c => ({ lib: l, c })));
  const apis = new Map<string, DrawerApi>(src.apis.map(a => [a.id, a]));
  for (const { c } of mirrors) {
    const apiId = c.apiId!;
    if (apis.has(apiId)) continue;
    const f = c.fields ?? {};
    warn(`La API "${c.name}" (${apiId}) no está en el catálogo del fichero; se reconstruye sin operaciones`);
    apis.set(apiId, { id: apiId, name: c.name, description: c.description ?? '', repoUrl: str(f.repo), docsUrl: str(f.docs), version: str(f.version), auth: str(f.auth), tags: str(f.tags), baseUrls: [], operations: [] });
  }
  const apiLibId = apis.size ? (ws.libraries[DRAWER_API_LIB_ID] ? DRAWER_API_LIB_ID : 'lib:apis') : null;
  if (apiLibId) {
    const lib: Library = ws.libraries[apiLibId] ?? { id: apiLibId, name: 'APIs (catálogo)', description: '', elementTypes: [], relationTypes: [], portTypes: [], notations: ['grid', 'freeform'] };
    lib.elementTypes = [...lib.elementTypes, API_ELEMENT_TYPE, API_OPERATION_ELEMENT_TYPE];
    ws.libraries[apiLibId] = lib;
  }
  for (const lib of Object.values(ws.libraries)) reg.registerLibraryTypes(lib);

  // ---- elementos: componentes
  const compIndex = new Map<string, string>();                  // componentId de Drawer → elementId
  const opIndex = new Map<string, Map<string, string>>();       // apiId → (operationId → elementId)
  const addElement = (e: Element) => {
    if (ws.elements[e.id]) warn(`Elemento ${e.id} duplicado; se conserva el primero`);
    else ws.elements[e.id] = e;
  };
  for (const lib of src.libraries) {
    for (const c of lib.components ?? []) {
      if (!c?.id) continue;
      if (c.apiId) { compIndex.set(c.id, apiElementId(c.apiId)); continue; }   // los espejos se crean con su API
      let typeId = 'freeform:box';
      if (c.typeId) {
        const t = typeIndex.get(c.typeId);
        if (t) typeId = t; else warn(`El componente "${c.name}" (${c.id}) usa un tipo inexistente (${c.typeId}); pasa a freeform:box`);
      }
      compIndex.set(c.id, c.id);
      addElement(element(c.id, typeId, c.name, { doc: c.description ?? '', libraryId: lib.id, template: true, fields: { ...c.fields } }));
    }
  }

  // ---- elementos: APIs y operaciones
  for (const api of apis.values()) {
    const id = apiElementId(api.id);
    addElement(element(id, API_TYPE_ID, api.name, {
      doc: api.description ?? '', libraryId: apiLibId!, template: true,
      fields: { repoUrl: api.repoUrl ?? '', docsUrl: api.docsUrl ?? '', version: api.version ?? '', auth: api.auth ?? '', baseUrls: api.baseUrls ?? [], tags: api.tags ?? '' },
      tags: splitTags(api.tags),
    }));
    const ops = new Map<string, string>();
    opIndex.set(api.id, ops);
    for (const op of api.operations ?? []) {
      if (!op?.id) continue;
      const oid = operationElementId(op.id);
      ops.set(op.id, oid);
      const label = [op.method, op.path].filter(Boolean).join(' ');
      addElement(element(oid, API_OPERATION_TYPE_ID, op.name || label || 'Operación', {
        doc: '', libraryId: apiLibId!, template: true,
        fields: {
          method: op.method ?? 'GET', path: op.path ?? '', summary: op.summary ?? '', headers: op.headers ?? [], pathParams: op.pathParams ?? [],
          queryParams: op.queryParams ?? [], requestBody: op.requestBody ?? '', responseBody: op.responseBody ?? '', codes: op.codes ?? [], notes: op.notes ?? '',
        },
        tags: op.deprecated ? ['deprecated'] : [],
      }));
      const rid = `rel-op-${op.id}`;
      ws.relations[rid] = relation(rid, OPERATION_RELATION_NAME, { elementId: oid }, { elementId: id });
    }
  }

  // ---- vistas, nodos y aristas
  const relationKeys = new Map<string, string>();               // clave de equivalencia → relationId
  const usedElements = new Set<string>();
  const portCache = new Map<string, Set<string>>();
  const portsOf = (el: Element) => {
    let s = portCache.get(el.id);
    if (!s) { s = new Set(allPorts(el, reg.fieldsOf(el.typeId)).map(p => p.id)); portCache.set(el.id, s); }
    return s;
  };

  for (const dg of src.diagrams) {
    if (!dg?.id) continue;
    if (ws.views[dg.id]) { warn(`Diagrama ${dg.id} duplicado; se ignora el segundo`); continue; }
    const grid = normalizeGrid({
      layers: (dg.layers ?? []).map(l => ({ id: l.id, name: l.name, color: l.color, ...(num(l.height) ? { size: l.height } : {}) })),
      stages: (dg.stages ?? []).map(s => ({ id: s.id, name: s.name, groupId: s.groupId ?? null, ...(num(s.width) ? { size: s.width } : {}) })),
      stageGroups: (dg.stageGroups ?? []).map(g => ({ id: g.id, name: g.name, ...(g.color ? { color: g.color } : {}) })),
    });
    for (const s of dg.stages ?? []) if (s.groupId && !grid.stageGroups.some(g => g.id === s.groupId)) warn(`Diagrama "${dg.name}": la etapa "${s.name}" apunta al grupo inexistente ${s.groupId}`);
    const view: View = { id: dg.id, kind: 'grid', notationId: 'grid', name: dg.name || 'Diagrama', doc: dg.description ?? '', grid, style: {}, props: {} };
    if (dg.public) view.public = true;
    ws.views[dg.id] = view;

    const layerIds = new Set(grid.layers.map(l => l.id)), stageIds = new Set(grid.stages.map(s => s.id));
    const placements = (dg.placements ?? []).filter(p => p?.id);
    const placementIds = new Set(placements.map(p => p.id));
    const nodeOf = new Map<string, ViewNode>();               // placementId → nodo

    for (const p of placements) {
      const nid = ws.nodes[p.id] ? `${dg.id}:${p.id}` : p.id;
      if (nid !== p.id) warn(`Diagrama "${dg.name}": placement ${p.id} repetido en otro diagrama; se renombra a ${nid}`);
      let elementId = compIndex.get(p.componentId);
      if (!elementId || !ws.elements[elementId]) { warn(`Diagrama "${dg.name}": placement ${p.id} apunta al componente inexistente ${p.componentId}; se omite`); continue; }
      const meta: Record<string, unknown> = {};
      const apiId = elementId.startsWith('api-') && ws.elements[elementId]!.typeId === API_TYPE_ID ? elementId.slice(4) : null;
      if (apiId) {
        meta.apiId = apiId;
        if (p.operationId) {
          const oid = opIndex.get(apiId)?.get(p.operationId);
          if (oid) { elementId = oid; meta.operationId = p.operationId; }
          else warn(`Diagrama "${dg.name}": placement ${p.id} usa la operación inexistente ${p.operationId} de la API ${apiId}; se enlaza a la API`);
        }
      } else if (p.operationId) meta.operationId = p.operationId;
      if (!layerIds.has(p.layerId) || !stageIds.has(p.stageId)) warn(`Diagrama "${dg.name}": placement ${p.id} está en una celda inexistente (${p.layerId} × ${p.stageId})`);
      const node: ViewNode = {
        id: nid, viewId: dg.id, elementId, x: num(p.x) ? p.x! : 0, y: num(p.y) ? p.y! : 0, w: 160, h: 56, style: {},
        cell: { layerId: p.layerId, stageId: p.stageId },
      };
      if (p.note) node.note = p.note;
      if (Object.keys(meta).length) node.meta = meta;
      ws.nodes[nid] = node;
      nodeOf.set(p.id, node);
      usedElements.add(elementId);
    }
    for (const p of placements) {
      const node = nodeOf.get(p.id);
      if (!node || !p.parentId || p.parentId === p.id) continue;
      const parent = nodeOf.get(p.parentId);
      if (parent) node.parentNodeId = parent.id;
      else warn(`Diagrama "${dg.name}": placement ${p.id} tiene un padre ${placementIds.has(p.parentId) ? 'omitido' : 'inexistente'} (${p.parentId})`);
    }

    for (const r of dg.relations ?? []) {
      if (!r?.id) continue;
      const a = nodeOf.get(r.from), b = nodeOf.get(r.to);
      if (!a || !b) { warn(`Diagrama "${dg.name}": relación ${r.id} une placements inexistentes (${r.from} → ${r.to}); se omite`); continue; }
      const ea = ws.elements[a.elementId!]!, eb = ws.elements[b.elementId!]!;
      const fromPort = resolvePort(ea, r.fromField, portsOf(ea));
      const toPort = resolvePort(eb, r.toField, portsOf(eb));
      if (r.fromField && !fromPort) warn(`Diagrama "${dg.name}": relación ${r.id}: el campo de origen "${r.fromField}" no es un puerto de "${ea.name}"`);
      if (r.toField && !toPort) warn(`Diagrama "${dg.name}": relación ${r.id}: el campo de destino "${r.toField}" no es un puerto de "${eb.name}"`);
      const label = r.label ?? '';
      const key = [ea.id, eb.id, fromPort ?? '', toPort ?? '', label].join('|');
      let relId = relationKeys.get(key);
      if (!relId) {
        relId = ws.relations[r.id] ? `${dg.id}:${r.id}` : r.id;
        const rel = relation(relId, label, { elementId: ea.id, ...(fromPort ? { portId: fromPort } : {}) }, { elementId: eb.id, ...(toPort ? { portId: toPort } : {}) }, {
          fields: { style: lineStyle(r.style), dir: r.dir ?? 'fwd', color: r.color ?? '#475569', width: num(r.width) ? r.width! : 2 },
          mappings: r.fromField || r.toField ? [{ fromPath: r.fromField ?? '', toPath: r.toField ?? '' }] : [],
        });
        ws.relations[relId] = rel;
        relationKeys.set(key, relId);
      }
      const eid = ws.edges[r.id] ? `${dg.id}:${r.id}` : r.id;
      const dir = r.dir ?? 'fwd';
      const edge: ViewEdge = {
        id: eid, viewId: dg.id, relationId: relId, fromNodeId: a.id, toNodeId: b.id, bendpoints: [],
        style: {
          line: lineStyle(r.style), color: r.color ?? '#475569', width: num(r.width) ? r.width! : 2,
          targetHead: (dir === 'none' ? 'none' : 'arrow') as ArrowHead, sourceHead: (dir === 'both' ? 'arrow' : 'none') as ArrowHead,
        },
      };
      if (fromPort) edge.fromPortId = fromPort;
      if (toPort) edge.toPortId = toPort;
      if (label) edge.label = label;
      ws.edges[eid] = edge;
    }
  }

  // ---- los componentes usados son elementos del modelo; los demás siguen siendo plantillas
  for (const id of usedElements) { const e = ws.elements[id]; if (e) e.template = false; }
  // una API cuyas operaciones se usan también es "del modelo"
  for (const e of Object.values(ws.elements)) {
    if (e.typeId !== API_OPERATION_TYPE_ID || e.template) continue;
    const rel = ws.relations[`rel-op-${e.id.slice(3)}`];
    const api = rel?.to.elementId ? ws.elements[rel.to.elementId] : undefined;
    if (api) api.template = false;
  }

  // ---- personas
  const ASSIGN: Record<string, Person['assignments'][number]['kind']> = { component: 'element', diagram: 'view', layer: 'layer', stage: 'stage', type: 'type' };
  for (const p of src.people) {
    if (!p?.id) continue;
    const notes = [p.title, p.notes].filter(Boolean).join(' · ');
    const person: Person = { id: p.id, name: p.name || 'Sin nombre', assignments: [] };
    if (p.email) person.email = p.email;
    if (p.team) person.team = p.team;
    if (notes) person.notes = notes;
    for (const a of p.assignments ?? []) {
      if (!a) continue;
      const kind = ASSIGN[a.kind];
      if (!kind) { warn(`Persona "${p.name}": asignación de clase desconocida (${a.kind}); se omite`); continue; }
      let targetId = a.targetId;
      if (kind === 'element') { const el = compIndex.get(targetId); if (!el || !ws.elements[el]) { warn(`Persona "${p.name}": asignada a un componente inexistente (${targetId}); se omite`); continue; } targetId = el; }
      if (kind === 'view' && !ws.views[targetId]) { warn(`Persona "${p.name}": asignada a un diagrama inexistente (${targetId}); se omite`); continue; }
      if (kind === 'type') targetId = typeIndex.get(targetId) ?? targetId;
      const asg: Person['assignments'][number] = { id: a.id || `${p.id}:${person.assignments.length}`, role: a.role || 'Participante', kind, targetId };
      if (a.notes) asg.notes = a.notes;
      person.assignments.push(asg);
    }
    ws.people[p.id] = person;
  }

  // ---- reglas de estilo
  const RULE_SOURCE: Record<string, StyleRule['conditions'][number]['source']> = { field: 'field', name: 'name', description: 'doc', type: 'type', library: 'library', people: 'people', role: 'role' };
  for (const r of src.rules) {
    if (!r?.id) continue;
    const conditions: StyleRule['conditions'] = [];
    for (const c of r.conditions ?? []) {
      const source = RULE_SOURCE[c.source];
      if (!source) { warn(`Regla "${r.name}": condición con origen desconocido (${c.source}); se omite`); continue; }
      const cond: StyleRule['conditions'][number] = { source, op: c.op as StyleRule['conditions'][number]['op'] };
      if (c.key) cond.key = c.key;
      if (c.value !== undefined) cond.value = c.value;
      if (c.caseSensitive !== undefined) cond.caseSensitive = c.caseSensitive;
      conditions.push(cond);
    }
    const rule: StyleRule = {
      id: r.id, name: r.name || 'Regla', enabled: r.enabled !== false, priority: num(r.priority) ? r.priority! : 0,
      match: r.match === 'any' ? 'any' : 'all', target: 'element', conditions, style: (r.style ?? {}) as StyleRule['style'],
    };
    if (r.diagramId) {
      if (ws.views[r.diagramId]) rule.viewId = r.diagramId;
      else warn(`Regla "${r.name}": limitada a un diagrama inexistente (${r.diagramId}); pasa a todos`);
    }
    ws.rules[r.id] = rule;
  }

  // ---- meta y dimensión
  ws.dimensions[GRID_DIMENSION_ID] = { id: GRID_DIMENSION_ID, name: 'Capas × etapas', notationId: 'grid', kind: 'grid' };
  const current = src.currentDiagramId && ws.views[src.currentDiagramId] ? src.currentDiagramId : Object.keys(ws.views)[0] ?? null;
  ws.meta.currentViewId = current;
  if (current) ws.meta.name = ws.views[current]!.name;
  if (src.exportedAt) ws.meta.createdAt = src.exportedAt;

  return { workspace: parseWorkspace(ws), warnings };
}

// ---------------------------------------------------------------- Ayudantes
function readInput(input: unknown) {
  const raw = (typeof input === 'string' ? JSON.parse(input) : input) as DrawerFile | null;
  if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.libraries) && !Array.isArray(raw.diagrams) && !raw.diagram))
    throw new Error('El fichero no parece un espacio de trabajo de Drawer (faltan `libraries` y `diagrams`).');
  if (raw.version !== undefined && raw.version !== 1) throw new Error(`Versión de Drawer no soportada: ${raw.version}`);
  return {
    libraries: arr(raw.libraries).filter(l => l?.id),
    diagrams: raw.diagram ? [raw.diagram] : arr(raw.diagrams),
    people: arr(raw.people), rules: arr(raw.rules), apis: arr(raw.apis).filter(a => a?.id),
    currentDiagramId: raw.currentDiagramId ?? null, exportedAt: raw.exportedAt,
  };
}

const arr = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const splitTags = (s: string | undefined) => (s ?? '').split(',').map(t => t.trim()).filter(Boolean);
const lineStyle = (s: string | undefined): 'solid' | 'dashed' | 'dotted' => (s && LINE_STYLES.has(s) ? (s as 'solid' | 'dashed' | 'dotted') : 'solid');

function mapFieldDef(f: DrawerFieldDef, warn: (s: string) => void, where: string): FieldDef {
  let kind = f.kind as FieldDef['kind'];
  if (!FIELD_KINDS.has(kind)) { warn(`Tipo ${where}: el campo "${f.key}" tiene una clase desconocida (${f.kind}); pasa a texto`); kind = 'text'; }
  const def: FieldDef = { key: f.key, label: f.label || f.key, kind };
  if (f.options) def.options = f.options;
  return def;
}

function element(id: string, typeId: string, name: string, extra: Partial<Element>): Element {
  return { id, typeId, name: name ?? '', doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [], ...extra };
}

function relation(id: string, name: string, from: Relation['from'], to: Relation['to'], extra: Partial<Relation> = {}): Relation {
  return { id, typeId: 'core:link', name, doc: '', from, to, mappings: [], fields: {}, props: {}, features: {}, ...extra };
}

/**
 * Id del puerto que corresponde a una ruta de campo de Drawer (`campo` o `campo.hoja.json`),
 * o undefined si el elemento no tiene tal puerto. Para operaciones de API traduce las claves del
 * tipo "API con contrato" de Drawer (`response_body` → `responseBody`).
 */
function resolvePort(el: Element, path: string | undefined, ports: Set<string>): string | undefined {
  if (!path) return undefined;
  const candidates = [path];
  if (el.typeId === API_OPERATION_TYPE_ID) {
    const dot = path.indexOf('.');
    const head = dot < 0 ? path : path.slice(0, dot), tail = dot < 0 ? '' : path.slice(dot);
    const mapped = CONTRACT_KEY_MAP[head];
    if (mapped) candidates.unshift(mapped + tail);
  }
  for (const c of candidates) { const id = portId(el.id, c); if (ports.has(id)) return id; }
  return undefined;
}
