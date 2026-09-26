/**
 * Formato nativo de **Archi** (`.archimate`, XML EMF con `xmlns:archimate="http://www.archimatetool.com/archimate"`).
 *
 * Mapeo:
 * - `element xsi:type="archimate:BusinessActor"`  → `Element` con `typeId: 'archimate:BusinessActor'` (mismo id).
 *   `documentation` → `doc`, `property` → `props`, `profiles="p1 p2"` → `profiles`, Junction `type="or"` → `fields.junctionType`.
 *   La carpeta de usuario en la que vive (bajo la carpeta de capa) se guarda en `features.archiFolder`.
 * - `element xsi:type="archimate:ServingRelationship"` → `Relation` `archimate:Serving`; `accessType` (0..3),
 *   `strength` y `directed` van a `fields`. Los extremos pueden ser elementos o relaciones.
 * - `profile` (raíz) → tipo de elemento de la librería `ARCHIMATE_PROFILES_LIB` (`extends` el concepto base).
 * - `ArchimateDiagramModel` → `View` freeform de notación `archimate` con `viewpointId`.
 *   `child DiagramObject` → `ViewNode` (coordenadas relativas al padre, como en Archi);
 *   `Group` → nodo visual `core:group`; `Note` → `core:note`; `DiagramModelReference` → `core:label` + `detailViewId`.
 *   `sourceConnection` → `ViewEdge`; los `bendpoint` (relativos al centro del origen) se pasan a absolutos.
 *
 * Las referencias rotas producen **warnings**, nunca errores. Los ids se conservan en ambos sentidos.
 */
import { parseWorkspace, type Workspace, type Element, type Relation, type View, type ViewNode, type ViewEdge, type ElementType, type Library, type NodeStyle } from '@all-draw/core';
import { ELEMENTS, RELATIONS } from '@all-draw/notation-archimate';
import { parseXml, buildXml, attr, attrNum, children, child, childText, attrs, type XmlNode } from './xml';

export interface ArchimateImport { workspace: Workspace; warnings: string[] }
export interface TextExport { text: string; warnings: string[] }

export const ARCHIMATE_NS = 'archimate';
export const ARCHIMATE_PROFILES_LIB = 'lib:archimate-profiles';
const ARCHI_XMLNS = 'http://www.archimatetool.com/archimate';
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const DEFAULT_W = 120, DEFAULT_H = 55;

export const ARCHIMATE_ELEMENT_IDS = new Set(ELEMENTS.map(e => e.id));
export const ARCHIMATE_RELATION_IDS = new Set(RELATIONS.map(r => r.id));

/** Carpeta de Archi por categoría del pack. */
const FOLDER_OF_CATEGORY: Record<string, string> = {
  strategy: 'strategy', business: 'business', application: 'application', technology: 'technology', physical: 'technology',
  motivation: 'motivation', 'implementation-migration': 'implementation_migration', other: 'other', connector: 'other',
};
const FOLDER_NAMES: Record<string, string> = {
  strategy: 'Strategy', business: 'Business', application: 'Application', technology: 'Technology & Physical', motivation: 'Motivation',
  implementation_migration: 'Implementation & Migration', other: 'Other', relations: 'Relations', diagrams: 'Views',
};
const FOLDER_ORDER = ['strategy', 'business', 'application', 'technology', 'motivation', 'implementation_migration', 'other', 'relations', 'diagrams'];

const ACCESS_FROM_ARCHI: Record<string, string> = { '0': 'write', '1': 'read', '2': 'access', '3': 'readwrite' };
const ACCESS_TO_ARCHI: Record<string, string> = { write: '0', read: '1', access: '2', readwrite: '3' };

export const localName = (typeId: string): string => { const i = typeId.indexOf(':'); return i < 0 ? typeId : typeId.slice(i + 1); };

// ---------------------------------------------------------------- Importador
export function importArchimate(xml: string): ArchimateImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const doc = parseXml(xml, { arrayTags: ['folder', 'element', 'child', 'sourceConnection', 'bendpoint', 'property', 'profile', 'feature'] });
  const root = child(doc, 'archimate:model') ?? child(doc, 'model');
  if (!root || !attr(root, 'xmlns:archimate') && !doc['archimate:model']) throw new Error('El fichero no parece un modelo de Archi (falta `archimate:model`).');

  const ws = emptyWs(attr(root, 'name') || 'Modelo ArchiMate');
  ws.meta.description = childText(root, 'purpose');

  // ---- perfiles
  const profiles = children(root, 'profile');
  if (profiles.length) {
    const lib: Library = { id: ARCHIMATE_PROFILES_LIB, name: 'Especializaciones ArchiMate', description: 'Perfiles (especializaciones) importados de Archi.', elementTypes: [], relationTypes: [], portTypes: [], notations: [ARCHIMATE_NS] };
    for (const p of profiles) {
      const id = attr(p, 'id'), concept = attr(p, 'conceptType');
      if (!id) continue;
      const base = concept ? `${ARCHIMATE_NS}:${concept.replace(/Relationship$/, '')}` : undefined;
      const t: ElementType = { id, name: attr(p, 'name') || id, notationId: ARCHIMATE_NS, category: 'Especializaciones', fields: [], meta: { profile: true, conceptType: concept ?? '' } };
      if (base && (ARCHIMATE_ELEMENT_IDS.has(base) || ARCHIMATE_RELATION_IDS.has(base))) t.extends = base;
      if (attr(p, 'specialization') === 'false') t.meta = { ...t.meta, specialization: false };
      if (attr(p, 'imagePath')) t.meta = { ...t.meta, imagePath: attr(p, 'imagePath') };
      lib.elementTypes.push(t);
    }
    ws.libraries[lib.id] = lib;
  }
  const profileIds = new Set(Object.values(ws.libraries).flatMap(l => l.elementTypes.map(t => t.id)));

  // ---- recorrido de carpetas: primero se recogen conceptos y diagramas
  const rawElements: { node: XmlNode; type: string; folder: string }[] = [];
  const rawRelations: { node: XmlNode; type: string; folder: string }[] = [];
  const rawDiagrams: { node: XmlNode; folder: string }[] = [];
  const walk = (folder: XmlNode, path: string[]) => {
    for (const el of children(folder, 'element')) {
      const type = attr(el, 'xsi:type') ?? '';
      const local = localName(type);
      if (local === 'ArchimateDiagramModel') rawDiagrams.push({ node: el, folder: path.join('/') });
      else if (local === 'SketchModel' || local === 'CanvasModel') warn(`La vista "${attr(el, 'name') ?? attr(el, 'id')}" es un ${local === 'SketchModel' ? 'boceto' : 'lienzo'} de Archi y no se importa`);
      else if (local.endsWith('Relationship')) rawRelations.push({ node: el, type: local, folder: path.join('/') });
      else rawElements.push({ node: el, type: local, folder: path.join('/') });
    }
    for (const sub of children(folder, 'folder')) walk(sub, attr(sub, 'type') ? path : [...path, attr(sub, 'name') ?? '']);
  };
  for (const f of children(root, 'folder')) walk(f, []);

  // ---- elementos
  for (const { node, type, folder } of rawElements) {
    const id = attr(node, 'id');
    if (!id) { warn(`Elemento ${type} sin id; se omite`); continue; }
    const typeId = `${ARCHIMATE_NS}:${type}`;
    if (!ARCHIMATE_ELEMENT_IDS.has(typeId)) { warn(`Tipo ArchiMate desconocido "${type}" (elemento ${id}); se omite`); continue; }
    if (ws.elements[id]) { warn(`Elemento ${id} duplicado; se conserva el primero`); continue; }
    const el = makeEl(id, typeId, attr(node, 'name') ?? '');
    el.doc = childText(node, 'documentation');
    el.props = readProps(node, warn, `elemento "${el.name}"`);
    if (type === 'Junction') el.fields = { junctionType: attr(node, 'type') === 'or' ? 'or' : 'and' };
    for (const p of (attr(node, 'profiles') ?? '').split(/\s+/).filter(Boolean)) {
      if (profileIds.has(p)) el.profiles.push(p); else warn(`El elemento "${el.name}" (${id}) usa el perfil inexistente ${p}`);
    }
    if (folder) el.features = { archiFolder: folder };
    ws.elements[id] = el;
  }

  // ---- relaciones (dos pasadas: los extremos pueden ser otras relaciones)
  const relIds = new Set(rawRelations.map(r => attr(r.node, 'id')).filter((x): x is string => !!x));
  const endOf = (id: string | undefined): Relation['from'] | null => {
    if (!id) return null;
    if (ws.elements[id]) return { elementId: id };
    if (relIds.has(id)) return { relationId: id };
    return null;
  };
  for (const { node, type, folder } of rawRelations) {
    const id = attr(node, 'id');
    if (!id) { warn(`Relación ${type} sin id; se omite`); continue; }
    const typeId = `${ARCHIMATE_NS}:${type.replace(/Relationship$/, '')}`;
    if (!ARCHIMATE_RELATION_IDS.has(typeId)) { warn(`Relación ArchiMate desconocida "${type}" (${id}); se omite`); continue; }
    const from = endOf(attr(node, 'source')), to = endOf(attr(node, 'target'));
    if (!from || !to) { warn(`La relación ${id} (${type}) apunta a conceptos inexistentes (${attr(node, 'source')} → ${attr(node, 'target')}); se omite`); continue; }
    const rel = makeRel(id, typeId, from, to);
    rel.name = attr(node, 'name') ?? '';
    rel.doc = childText(node, 'documentation');
    rel.props = readProps(node, warn, `relación ${id}`);
    if (type === 'AccessRelationship') rel.fields.accessType = ACCESS_FROM_ARCHI[attr(node, 'accessType') ?? '0'] ?? 'write';
    if (type === 'InfluenceRelationship' && attr(node, 'strength')) rel.fields.strength = attr(node, 'strength');
    if (type === 'AssociationRelationship' && attr(node, 'directed') === 'true') rel.fields.directed = true;
    for (const p of (attr(node, 'profiles') ?? '').split(/\s+/).filter(Boolean)) if (profileIds.has(p)) rel.features.profiles = [...((rel.features.profiles as string[] | undefined) ?? []), p];
    if (folder) rel.features.archiFolder = folder;
    ws.relations[id] = rel;
  }
  // extremos que apuntan a relaciones que al final no se importaron
  for (const rel of Object.values(ws.relations)) {
    for (const end of [rel.from, rel.to]) if (end.relationId && !ws.relations[end.relationId]) { warn(`La relación ${rel.id} apunta a la relación omitida ${end.relationId}; se omite`); delete ws.relations[rel.id]; }
  }

  // ---- diagramas
  const diagramNames = new Map(rawDiagrams.map(d => [attr(d.node, 'id') ?? '', attr(d.node, 'name') ?? '']));
  for (const { node: dg, folder } of rawDiagrams) {
    const id = attr(dg, 'id');
    if (!id) continue;
    const view: View = { id, kind: 'freeform', notationId: ARCHIMATE_NS, name: attr(dg, 'name') ?? 'Vista', doc: childText(dg, 'documentation'), style: {}, props: readProps(dg, warn, `vista "${attr(dg, 'name')}"`) };
    if (attr(dg, 'viewpoint')) view.viewpointId = attr(dg, 'viewpoint');
    if (folder) view.props = { ...view.props, archiFolder: folder };
    ws.views[id] = view;
    const abs = new Map<string, { x: number; y: number; w: number; h: number }>();
    const pendingConnections: { node: XmlNode; sourceNodeId: string }[] = [];

    const visit = (c: XmlNode, parent: ViewNode | undefined, ax: number, ay: number) => {
      const nid = attr(c, 'id');
      if (!nid) { warn(`Vista "${view.name}": objeto sin id; se omite`); return; }
      if (ws.nodes[nid]) { warn(`Vista "${view.name}": nodo ${nid} duplicado; se omite`); return; }
      const type = localName(attr(c, 'xsi:type') ?? 'DiagramObject');
      const b = child(c, 'bounds');
      const w = attrNum(b, 'width', -1), h = attrNum(b, 'height', -1);
      const vn: ViewNode = { id: nid, viewId: id, x: attrNum(b, 'x'), y: attrNum(b, 'y'), w: w > 0 ? w : DEFAULT_W, h: h > 0 ? h : DEFAULT_H, style: readNodeStyle(c) };
      if (parent) vn.parentNodeId = parent.id;
      if (type === 'DiagramObject') {
        const elId = attr(c, 'archimateElement');
        if (!elId || !ws.elements[elId]) { warn(`Vista "${view.name}": el nodo ${nid} apunta al elemento inexistente ${elId}; se omite`); return; }
        vn.elementId = elId;
        if (attr(c, 'type') === '1') vn.style.figure = 1;
      } else if (type === 'Group') {
        vn.visualType = 'core:group'; vn.text = attr(c, 'name') ?? '';
        const d = childText(c, 'documentation'); if (d) vn.note = d;
      } else if (type === 'Note') {
        vn.visualType = 'core:note'; vn.text = childText(c, 'content');
      } else if (type === 'DiagramModelReference') {
        const ref = attr(c, 'model');
        vn.visualType = 'core:label';
        if (ref && diagramNames.has(ref)) { vn.detailViewId = ref; vn.text = diagramNames.get(ref) ?? ''; }
        else { warn(`Vista "${view.name}": la referencia ${nid} apunta a la vista inexistente ${ref}`); vn.text = attr(c, 'name') ?? ''; }
      } else { warn(`Vista "${view.name}": objeto ${type} no soportado; se importa como nota`); vn.visualType = 'core:note'; vn.text = attr(c, 'name') ?? ''; }
      const props = readProps(c, warn, `nodo ${nid}`);
      if (Object.keys(props).length) vn.meta = { props };
      ws.nodes[nid] = vn;
      abs.set(nid, { x: ax + vn.x, y: ay + vn.y, w: vn.w, h: vn.h });
      for (const sc of children(c, 'sourceConnection')) pendingConnections.push({ node: sc, sourceNodeId: nid });
      for (const cc of children(c, 'child')) visit(cc, vn, ax + vn.x, ay + vn.y);
    };
    for (const c of children(dg, 'child')) visit(c, undefined, 0, 0);

    for (const { node: sc, sourceNodeId } of pendingConnections) {
      const eid = attr(sc, 'id'), src = attr(sc, 'source') ?? sourceNodeId, tgt = attr(sc, 'target');
      if (!eid) continue;
      const a = abs.get(src), b = tgt ? abs.get(tgt) : undefined;
      if (!a || !b || !tgt) { warn(`Vista "${view.name}": la conexión ${eid} une objetos inexistentes o conexiones (${src} → ${tgt}); se omite`); continue; }
      const relId = attr(sc, 'archimateRelationship');
      if (relId && !ws.relations[relId]) { warn(`Vista "${view.name}": la conexión ${eid} apunta a la relación inexistente ${relId}; se omite`); continue; }
      const edge: ViewEdge = { id: eid, viewId: id, fromNodeId: src, toNodeId: tgt, bendpoints: [], style: {} };
      if (relId) edge.relationId = relId;
      if (attr(sc, 'lineColor')) edge.style.color = attr(sc, 'lineColor');
      if (attr(sc, 'lineWidth')) edge.style.width = attrNum(sc, 'lineWidth', 1);
      const label = attr(sc, 'text'); if (label) edge.label = label;
      const scx = a.x + a.w / 2, scy = a.y + a.h / 2;
      for (const bp of children(sc, 'bendpoint')) edge.bendpoints.push({ x: scx + attrNum(bp, 'startX'), y: scy + attrNum(bp, 'startY') });
      ws.edges[eid] = edge;
    }
  }

  ws.meta.currentViewId = Object.keys(ws.views)[0] ?? null;
  return { workspace: parseWorkspace(ws), warnings };
}

// ---------------------------------------------------------------- Exportador
export function exportArchimate(ws: Workspace): TextExport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const typeOf = (id: string) => ELEMENTS.find(e => e.id === id);

  // ---- elementos exportables
  const elements = Object.values(ws.elements).filter(e => {
    if (!e.typeId.startsWith(`${ARCHIMATE_NS}:`)) { warn(`El elemento "${e.name}" (${e.id}) no es ArchiMate (${e.typeId}); se omite`); return false; }
    if (!ARCHIMATE_ELEMENT_IDS.has(e.typeId)) { warn(`El elemento "${e.name}" (${e.id}) tiene un tipo ArchiMate desconocido (${e.typeId}); se omite`); return false; }
    return true;
  });
  const elIds = new Set(elements.map(e => e.id));
  const relations = Object.values(ws.relations).filter(r => r.typeId.startsWith(`${ARCHIMATE_NS}:`) && ARCHIMATE_RELATION_IDS.has(r.typeId));
  for (const r of Object.values(ws.relations)) if (!relations.includes(r)) warn(`La relación ${r.id} (${r.typeId}) no es ArchiMate; se omite`);
  const relIds = new Set(relations.map(r => r.id));
  const okEnd = (e: Relation['from']) => (e.elementId ? elIds.has(e.elementId) : e.relationId ? relIds.has(e.relationId) : false);
  pruneRelations(relations, relIds, okEnd, warn);

  // ---- carpetas
  const folders: Record<string, XmlNode> = {};
  for (const t of FOLDER_ORDER) folders[t] = { ...attrs({ name: FOLDER_NAMES[t], id: `folder-${t}`, type: t }), folder: [] as XmlNode[], element: [] as XmlNode[] };
  const subfolder = (top: string, path: string | undefined): XmlNode => {
    let cur = folders[top]!;
    if (!path) return cur;
    const segs = path.split('/').filter(Boolean);
    let acc = top;
    for (const s of segs) {
      acc += '/' + s;
      const list = cur.folder as XmlNode[];
      let next = list.find(f => f['@_name'] === s);
      if (!next) { next = { ...attrs({ name: s, id: `folder-${acc.replace(/[^a-zA-Z0-9]+/g, '-')}` }), folder: [], element: [] }; list.push(next); }
      cur = next;
    }
    return cur;
  };
  const profileLib = ws.libraries[ARCHIMATE_PROFILES_LIB];
  const profileIds = new Set(profileLib?.elementTypes.map(t => t.id) ?? []);

  for (const e of elements) {
    const top = FOLDER_OF_CATEGORY[typeOf(e.typeId)?.category ?? 'other'] ?? 'other';
    const x: XmlNode = attrs({ 'xsi:type': `${ARCHIMATE_NS}:${localName(e.typeId)}`, name: e.name, id: e.id });
    if (e.typeId === `${ARCHIMATE_NS}:Junction` && e.fields.junctionType === 'or') x['@_type'] = 'or';
    const profs = e.profiles.filter(p => profileIds.has(p));
    if (profs.length) x['@_profiles'] = profs.join(' ');
    if (e.doc) x.documentation = e.doc;
    x.property = propsXml(e.props);
    (subfolder(top, e.features.archiFolder as string | undefined).element as XmlNode[]).push(x);
  }
  for (const r of relations) {
    const x: XmlNode = attrs({ 'xsi:type': `${ARCHIMATE_NS}:${localName(r.typeId)}Relationship`, name: r.name || undefined, id: r.id, source: r.from.elementId ?? r.from.relationId, target: r.to.elementId ?? r.to.relationId });
    if (r.typeId === `${ARCHIMATE_NS}:Access`) x['@_accessType'] = ACCESS_TO_ARCHI[String(r.fields.accessType ?? 'write')] ?? '0';
    if (r.typeId === `${ARCHIMATE_NS}:Influence` && r.fields.strength) x['@_strength'] = String(r.fields.strength);
    if (r.typeId === `${ARCHIMATE_NS}:Association` && r.fields.directed) x['@_directed'] = 'true';
    const profs = ((r.features.profiles as string[] | undefined) ?? []).filter(p => profileIds.has(p));
    if (profs.length) x['@_profiles'] = profs.join(' ');
    if (r.doc) x.documentation = r.doc;
    x.property = propsXml(r.props);
    (subfolder('relations', r.features.archiFolder as string | undefined).element as XmlNode[]).push(x);
  }

  // ---- vistas
  const views = Object.values(ws.views).filter(v => {
    if (v.notationId !== ARCHIMATE_NS) { warn(`La vista "${v.name}" es de la notación ${v.notationId}; se omite`); return false; }
    if (v.kind === 'grid') { warn(`La vista "${v.name}" es una rejilla; se omite`); return false; }
    return true;
  });
  const viewIds = new Set(views.map(v => v.id));
  for (const v of views) {
    const nodes = Object.values(ws.nodes).filter(n => n.viewId === v.id);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const exported = new Map<string, XmlNode>();
    const abs = new Map<string, { cx: number; cy: number }>();
    const targetConnections = new Map<string, string[]>();
    const edges = Object.values(ws.edges).filter(e => e.viewId === v.id);
    const okNode = (n: ViewNode): boolean => {
      if (n.elementId) return elIds.has(n.elementId);
      return true;
    };
    for (const e of edges) {
      const a = nodeById.get(e.fromNodeId), b = nodeById.get(e.toNodeId);
      if (a && b && okNode(a) && okNode(b) && (!e.relationId || relIds.has(e.relationId))) targetConnections.set(b.id, [...(targetConnections.get(b.id) ?? []), e.id]);
    }
    const build = (n: ViewNode, ax: number, ay: number): XmlNode | null => {
      if (!okNode(n)) { warn(`Vista "${v.name}": el nodo ${n.id} apunta a un elemento no exportado; se omite con sus hijos`); return null; }
      const x: XmlNode = {};
      if (n.elementId) { x['@_xsi:type'] = `${ARCHIMATE_NS}:DiagramObject`; x['@_id'] = n.id; }
      else if (n.detailViewId && viewIds.has(n.detailViewId)) { x['@_xsi:type'] = `${ARCHIMATE_NS}:DiagramModelReference`; x['@_id'] = n.id; }
      else if (n.visualType === 'core:group') { x['@_xsi:type'] = `${ARCHIMATE_NS}:Group`; x['@_id'] = n.id; x['@_name'] = n.text ?? ''; }
      else { x['@_xsi:type'] = `${ARCHIMATE_NS}:Note`; x['@_id'] = n.id; }
      const tc = targetConnections.get(n.id);
      if (tc?.length) x['@_targetConnections'] = tc.join(' ');
      writeNodeStyle(n, x);
      if (n.elementId) { x['@_archimateElement'] = n.elementId; if (n.style.figure === 1) x['@_type'] = '1'; }
      if (x['@_xsi:type'] === `${ARCHIMATE_NS}:DiagramModelReference`) x['@_model'] = n.detailViewId;
      x.bounds = attrs({ x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.w), height: Math.round(n.h) });
      if (x['@_xsi:type'] === `${ARCHIMATE_NS}:Note`) x.content = n.text ?? '';
      if (x['@_xsi:type'] === `${ARCHIMATE_NS}:Group` && n.note) x.documentation = n.note;
      const props = (n.meta?.props as Record<string, string> | undefined);
      if (props) x.property = propsXml(props);
      abs.set(n.id, { cx: ax + n.x + n.w / 2, cy: ay + n.y + n.h / 2 });
      x.sourceConnection = [];
      x.child = nodes.filter(c => c.parentNodeId === n.id).map(c => build(c, ax + n.x, ay + n.y)).filter((c): c is XmlNode => !!c);
      exported.set(n.id, x);
      return x;
    };
    const roots = nodes.filter(n => !n.parentNodeId || !nodeById.has(n.parentNodeId));
    const dx: XmlNode = attrs({ 'xsi:type': `${ARCHIMATE_NS}:ArchimateDiagramModel`, name: v.name, id: v.id, viewpoint: v.viewpointId });
    dx.child = roots.map(n => build(n, 0, 0)).filter((c): c is XmlNode => !!c);
    if (v.doc) dx.documentation = v.doc;
    const { archiFolder, ...vprops } = v.props;
    dx.property = propsXml(vprops);
    for (const e of edges) {
      const sx = exported.get(e.fromNodeId), a = abs.get(e.fromNodeId), b = abs.get(e.toNodeId);
      if (!sx || !a || !b) { warn(`Vista "${v.name}": la arista ${e.id} une nodos no exportados; se omite`); continue; }
      if (e.relationId && !relIds.has(e.relationId)) { warn(`Vista "${v.name}": la arista ${e.id} usa una relación no exportada; se omite`); continue; }
      const cx: XmlNode = attrs({ 'xsi:type': `${ARCHIMATE_NS}:Connection`, id: e.id, lineColor: e.style.color, lineWidth: e.style.width, text: e.relationId ? undefined : e.label, source: e.fromNodeId, target: e.toNodeId, archimateRelationship: e.relationId });
      cx.bendpoint = e.bendpoints.map(p => attrs({ startX: Math.round(p.x - a.cx), startY: Math.round(p.y - a.cy), endX: Math.round(p.x - b.cx), endY: Math.round(p.y - b.cy) }));
      (sx.sourceConnection as XmlNode[]).push(cx);
    }
    (subfolder('diagrams', archiFolder).element as XmlNode[]).push(dx);
  }

  const root: XmlNode = {
    ...attrs({ 'xmlns:xsi': XSI, 'xmlns:archimate': ARCHI_XMLNS, name: ws.meta.name, id: `model-${slug(ws.meta.name) || 'alldraw'}`, version: '5.0.0' }),
    folder: FOLDER_ORDER.map(t => folders[t]!),
    profile: (profileLib?.elementTypes ?? []).map(t => attrs({ name: t.name, id: t.id, conceptType: (t.meta?.conceptType as string) || (t.extends ? localName(t.extends) : undefined), specialization: t.meta?.specialization === false ? 'false' : undefined, imagePath: t.meta?.imagePath as string | undefined })),
    purpose: ws.meta.description || undefined,
  };
  return { text: buildXml({ 'archimate:model': root }), warnings };
}

// ---------------------------------------------------------------- Ayudantes
/** Quita (en cascada) las relaciones con algún extremo no exportado; muta `relations` y `relIds`. */
export function pruneRelations(relations: Relation[], relIds: Set<string>, okEnd: (e: Relation['from']) => boolean, warn: (s: string) => void): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = relations.length - 1; i >= 0; i--) {
      const r = relations[i]!;
      if (okEnd(r.from) && okEnd(r.to)) continue;
      warn(`La relación ${r.id} une conceptos no exportados; se omite`);
      relations.splice(i, 1); relIds.delete(r.id); changed = true;
    }
  }
}
export function emptyWs(name: string): Workspace {
  return { meta: { schemaVersion: 1, name, description: '' }, libraries: {}, elements: {}, relations: {}, views: {}, nodes: {}, edges: {}, dimensions: {}, people: {}, rules: {} };
}
export function makeEl(id: string, typeId: string, name: string): Element {
  return { id, typeId, name, doc: '', fields: {}, ports: [], profiles: [], props: {}, features: {}, tags: [] };
}
export function makeRel(id: string, typeId: string, from: Relation['from'], to: Relation['to']): Relation {
  return { id, typeId, name: '', doc: '', from, to, mappings: [], fields: {}, props: {}, features: {} };
}
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function readProps(node: XmlNode, warn: (s: string) => void, where: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of children(node, 'property')) {
    const k = attr(p, 'key');
    if (!k) continue;
    if (k in out) warn(`Propiedad "${k}" repetida en ${where}; se conserva la última`);
    out[k] = attr(p, 'value') ?? '';
  }
  return out;
}
function propsXml(props: Record<string, string>): XmlNode[] {
  return Object.entries(props).map(([key, value]) => attrs({ key, value: value || undefined }));
}
function readNodeStyle(c: XmlNode): NodeStyle {
  const s: NodeStyle = {};
  if (attr(c, 'fillColor')) s.fill = attr(c, 'fillColor');
  if (attr(c, 'lineColor')) s.stroke = attr(c, 'lineColor');
  if (attr(c, 'fontColor')) s.text = attr(c, 'fontColor');
  if (attr(c, 'alpha') !== undefined) s.opacity = Math.round((attrNum(c, 'alpha', 255) / 255) * 100) / 100;
  return s;
}
function writeNodeStyle(n: ViewNode, x: XmlNode) {
  if (n.style.fill) x['@_fillColor'] = n.style.fill;
  if (n.style.stroke) x['@_lineColor'] = n.style.stroke;
  if (n.style.text) x['@_fontColor'] = n.style.text;
  if (n.style.opacity !== undefined) x['@_alpha'] = String(Math.round(n.style.opacity * 255));
}
