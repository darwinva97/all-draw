/**
 * **ArchiMate Model Exchange File Format** 3.x (Open Group; `<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/">`).
 *
 * Mapeo (mismo modelo destino que `archimate.ts`):
 * - `elements/element[identifier, xsi:type]` → `Element` `archimate:<Tipo>` (`AndJunction`/`OrJunction` → `Junction` + `fields.junctionType`).
 *   `name`/`documentation` (con `xml:lang`) → `name`/`doc`; `properties/property[propertyDefinitionRef]/value` → `props` por nombre de definición.
 * - `relationships/relationship` → `Relation`; `accessType` (Write/Read/Access/ReadWrite), `isDirected`, `modifier` → `fields`.
 * - `organizations/item` → `features.archiFolder` (carpetas de usuario bajo la carpeta de capa).
 * - `views/diagrams/view[xsi:type=Diagram, viewpoint]` → `View` freeform de notación `archimate`. `node` de tipo `Element`
 *   → `ViewNode`; `Container` → `core:group`; `Label` → `core:note` (o `core:label` + `detailViewId` si lleva `viewRef`).
 *   Las coordenadas del formato son **absolutas**; se convierten a relativas al padre. `connection` de tipo `Relationship`/`Line` → `ViewEdge`.
 *
 * Al exportar, los ids que no son NCName válidos (empiezan por dígito) se prefijan con `id-`, como hace Archi.
 */
import { parseWorkspace, type Workspace, type Relation, type View, type ViewNode, type ViewEdge, type NodeStyle } from '@all-draw/core';
import { VIEWPOINTS } from '@all-draw/notation-archimate';
import { parseXml, buildXml, attr, attrNum, children, child, attrs, textOf, hexToRgb, rgbToHex, type XmlNode } from './xml';
import { ARCHIMATE_NS, ARCHIMATE_ELEMENT_IDS, ARCHIMATE_RELATION_IDS, localName, emptyWs, makeEl, makeRel, slug, pruneRelations, type ArchimateImport, type TextExport } from './archimate';
import { tr } from './i18n';

export const OEF_XMLNS = 'http://www.opengroup.org/xsd/archimate/3.0/';
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = 'http://www.opengroup.org/xsd/archimate/3.0/ http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd';
const LANG = 'es';
const DEFAULT_W = 120, DEFAULT_H = 55;

/** id de viewpoint (Archi) ↔ nombre en el formato de intercambio. */
export const OEF_VIEWPOINT_NAMES: Record<string, string> = {
  organization: 'Organization', information_structure: 'Information Structure', technology: 'Technology', layered: 'Layered', physical: 'Physical',
  product: 'Product', application_structure: 'Application Structure', application_usage: 'Application Usage', technology_usage: 'Technology Usage',
  business_process_cooperation: 'Business Process Cooperation', application_cooperation: 'Application Cooperation', service_realization: 'Service Realization',
  implementation_deployment: 'Implementation and Deployment', goal_realization: 'Goal Realization', requirements_realization: 'Requirements Realization',
  motivation: 'Motivation', strategy: 'Strategy', capability: 'Capability Map', outcome_realization: 'Outcome Realization', resource: 'Resource Map',
  project: 'Project', migration: 'Migration', implementation_migration: 'Implementation and Migration', stakeholder: 'Stakeholder', value_stream: 'Value Stream',
};
const VIEWPOINT_IDS: Record<string, string> = Object.fromEntries(Object.entries(OEF_VIEWPOINT_NAMES).map(([k, v]) => [v.toLowerCase(), k]));
const ACCESS_FROM_OEF: Record<string, string> = { Write: 'write', Read: 'read', Access: 'access', ReadWrite: 'readwrite' };
const ACCESS_TO_OEF: Record<string, string> = { write: 'Write', read: 'Read', access: 'Access', readwrite: 'ReadWrite' };
const FOLDER_LABELS: Record<string, string> = {
  strategy: 'Strategy', business: 'Business', application: 'Application', technology: 'Technology & Physical', physical: 'Technology & Physical',
  motivation: 'Motivation', 'implementation-migration': 'Implementation & Migration', other: 'Other', connector: 'Other',
};

// ---------------------------------------------------------------- Importador
export function importOpenExchange(xml: string): ArchimateImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const doc = parseXml(xml, { removeNSPrefix: true, arrayTags: ['element', 'relationship', 'view', 'node', 'connection', 'bendpoint', 'property', 'propertyDefinition', 'name', 'documentation', 'label', 'item', 'value'] });
  const root = child(doc, 'model');
  if (!root || !/xmlns\s*=\s*"http:\/\/www\.opengroup\.org\/xsd\/archimate/.test(xml)) throw new Error(tr('El fichero no parece un ArchiMate Open Exchange (falta `model` con el espacio de nombres de The Open Group).'));

  const ws = emptyWs(pickText(root, 'name') || 'Modelo ArchiMate');
  ws.meta.description = pickText(root, 'documentation');

  const propDefs = new Map<string, string>();
  for (const d of children(child(root, 'propertyDefinitions'), 'propertyDefinition')) {
    const id = attr(d, 'identifier'); if (id) propDefs.set(id, pickText(d, 'name') || id);
  }
  const readProps = (n: XmlNode | undefined, where: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const p of children(child(n, 'properties'), 'property')) {
      const ref = attr(p, 'propertyDefinitionRef') ?? '';
      const key = propDefs.get(ref);
      if (!key) { warn(tr('Propiedad con definición inexistente ({ref}) en {where}; se omite', { ref, where })); continue; }
      if (key in out) warn(tr('Propiedad "{key}" repetida en {where}; se conserva la última', { key, where }));
      out[key] = pickText(p, 'value');
    }
    return out;
  };

  // ---- organizaciones → carpeta de usuario por concepto
  const folderOf = new Map<string, string>();
  const walkItems = (item: XmlNode, path: string[]) => {
    const ref = attr(item, 'identifierRef');
    if (ref) { if (path.length > 1) folderOf.set(ref, path.slice(1).join('/')); return; }
    const label = pickText(item, 'label');
    for (const sub of children(item, 'item')) walkItems(sub, [...path, label]);
  };
  for (const it of children(child(root, 'organizations'), 'item')) walkItems(it, []);

  // ---- elementos
  for (const e of children(child(root, 'elements'), 'element')) {
    const id = attr(e, 'identifier'), type = attr(e, 'type') ?? '';
    if (!id) { warn(tr('Elemento sin identifier; se omite')); continue; }
    const junction = type === 'AndJunction' || type === 'OrJunction' || type === 'Junction';
    const typeId = `${ARCHIMATE_NS}:${junction ? 'Junction' : type}`;
    if (!ARCHIMATE_ELEMENT_IDS.has(typeId)) { warn(tr('Tipo ArchiMate desconocido "{type}" (elemento {id}); se omite', { type, id })); continue; }
    if (ws.elements[id]) { warn(tr('Elemento {id} duplicado; se conserva el primero', { id })); continue; }
    const name = pickText(e, 'name');
    // el XSD obliga a un nombre: al exportar los junctions sin nombre llevan el del tipo
    const el = makeEl(id, typeId, junction && ['Junction', 'AndJunction', 'OrJunction'].includes(name) ? '' : name);
    el.doc = pickText(e, 'documentation');
    el.props = readProps(e, `elemento "${el.name}"`);
    if (junction) el.fields = { junctionType: type === 'OrJunction' ? 'or' : 'and' };
    const folder = folderOf.get(id); if (folder) el.features = { archiFolder: folder };
    ws.elements[id] = el;
  }

  // ---- relaciones
  const rawRels = children(child(root, 'relationships'), 'relationship');
  const relIds = new Set(rawRels.map(r => attr(r, 'identifier')).filter((x): x is string => !!x));
  const endOf = (id: string | undefined): Relation['from'] | null => (!id ? null : ws.elements[id] ? { elementId: id } : relIds.has(id) ? { relationId: id } : null);
  for (const r of rawRels) {
    const id = attr(r, 'identifier'), type = attr(r, 'type') ?? '';
    if (!id) { warn(tr('Relación sin identifier; se omite')); continue; }
    const typeId = `${ARCHIMATE_NS}:${type}`;
    if (!ARCHIMATE_RELATION_IDS.has(typeId)) { warn(tr('Relación ArchiMate desconocida "{type}" ({id}); se omite', { type, id })); continue; }
    const from = endOf(attr(r, 'source')), to = endOf(attr(r, 'target'));
    if (!from || !to) { warn(tr('La relación {id} ({type}) apunta a conceptos inexistentes ({from} → {to}); se omite', { id, type, from: attr(r, 'source'), to: attr(r, 'target') })); continue; }
    const rel = makeRel(id, typeId, from, to);
    rel.name = pickText(r, 'name');
    rel.doc = pickText(r, 'documentation');
    rel.props = readProps(r, `relación ${id}`);
    if (type === 'Access') rel.fields.accessType = ACCESS_FROM_OEF[attr(r, 'accessType') ?? 'Write'] ?? 'write';
    if (type === 'Influence' && attr(r, 'modifier')) rel.fields.strength = attr(r, 'modifier');
    if (type === 'Association' && attr(r, 'isDirected') === 'true') rel.fields.directed = true;
    const folder = folderOf.get(id); if (folder) rel.features.archiFolder = folder;
    ws.relations[id] = rel;
  }
  for (const rel of Object.values(ws.relations)) {
    for (const end of [rel.from, rel.to]) if (end.relationId && !ws.relations[end.relationId]) { warn(tr('La relación {id} apunta a la relación omitida {relation}; se omite', { id: rel.id, relation: end.relationId })); delete ws.relations[rel.id]; }
  }

  // ---- vistas
  const rawViews = children(child(child(root, 'views'), 'diagrams'), 'view');
  const viewNames = new Map(rawViews.map(v => [attr(v, 'identifier') ?? '', pickText(v, 'name')]));
  for (const v of rawViews) {
    const id = attr(v, 'identifier');
    if (!id) continue;
    const view: View = { id, kind: 'freeform', notationId: ARCHIMATE_NS, name: pickText(v, 'name') || 'Vista', doc: pickText(v, 'documentation'), style: {}, props: readProps(v, `vista "${pickText(v, 'name')}"`) };
    const vp = attr(v, 'viewpoint');
    if (vp) { const vid = VIEWPOINT_IDS[vp.toLowerCase()] ?? (VIEWPOINTS.some(x => x.id === vp) ? vp : undefined); if (vid) view.viewpointId = vid; else warn(tr('Vista "{view}": viewpoint desconocido "{viewpoint}"', { view: view.name, viewpoint: vp })); }
    const folder = folderOf.get(id); if (folder) view.props.archiFolder = folder;
    ws.views[id] = view;

    const visit = (n: XmlNode, parent: ViewNode | undefined, px: number, py: number) => {
      const nid = attr(n, 'identifier');
      if (!nid) { warn(tr('Vista "{view}": nodo sin identifier; se omite', { view: view.name })); return; }
      if (ws.nodes[nid]) { warn(tr('Vista "{view}": nodo {node} duplicado; se omite', { view: view.name, node: nid })); return; }
      const ax = attrNum(n, 'x'), ay = attrNum(n, 'y');
      const w = attrNum(n, 'w', DEFAULT_W), h = attrNum(n, 'h', DEFAULT_H);
      const vn: ViewNode = { id: nid, viewId: id, x: ax - px, y: ay - py, w: w > 0 ? w : DEFAULT_W, h: h > 0 ? h : DEFAULT_H, style: readStyle(child(n, 'style')) };
      if (parent) vn.parentNodeId = parent.id;
      const type = attr(n, 'type') ?? (attr(n, 'elementRef') ? 'Element' : 'Label');
      if (type === 'Element') {
        const ref = attr(n, 'elementRef');
        if (!ref || !ws.elements[ref]) { warn(tr('Vista "{view}": el nodo {node} apunta al elemento inexistente {ref}; se omite', { view: view.name, node: nid, ref })); return; }
        vn.elementId = ref;
      } else if (type === 'Container') {
        vn.visualType = 'core:group'; vn.text = pickText(n, 'label');
        const d = pickText(n, 'documentation'); if (d) vn.note = d;
      } else {
        const ref = attr(child(n, 'viewRef'), 'ref');
        if (ref) {
          vn.visualType = 'core:label';
          if (viewNames.has(ref)) { vn.detailViewId = ref; vn.text = pickText(n, 'label') || viewNames.get(ref) || ''; }
          else { warn(tr('Vista "{view}": la referencia {node} apunta a la vista inexistente {ref}', { view: view.name, node: nid, ref })); vn.text = pickText(n, 'label'); }
        } else { vn.visualType = 'core:note'; vn.text = pickText(n, 'label'); }
      }
      const props = readProps(n, `nodo ${nid}`);
      if (Object.keys(props).length) vn.meta = { props };
      ws.nodes[nid] = vn;
      const kids = children(n, 'node');
      for (const c of kids) visit(c, vn, ax, ay);
      // Con hijos, el nombre va arriba (como lo dibuja Archi): centrado quedaría tapado por ellos.
      if (kids.length && vn.elementId) vn.style.labelPosition = 'top';
    };
    for (const n of children(v, 'node')) visit(n, undefined, 0, 0);

    for (const c of children(v, 'connection')) {
      const eid = attr(c, 'identifier'), src = attr(c, 'source'), tgt = attr(c, 'target');
      if (!eid) continue;
      if (!src || !tgt || !ws.nodes[src] || !ws.nodes[tgt]) { warn(tr('Vista "{view}": la conexión {id} une nodos inexistentes o conexiones ({from} → {to}); se omite', { view: view.name, id: eid, from: src, to: tgt })); continue; }
      const relId = attr(c, 'relationshipRef');
      if (relId && !ws.relations[relId]) { warn(tr('Vista "{view}": la conexión {id} apunta a la relación inexistente {relation}; se omite', { view: view.name, id: eid, relation: relId })); continue; }
      const edge: ViewEdge = { id: eid, viewId: id, fromNodeId: src, toNodeId: tgt, bendpoints: children(c, 'bendpoint').map(b => ({ x: attrNum(b, 'x'), y: attrNum(b, 'y') })), style: {} };
      if (relId) edge.relationId = relId;
      const st = child(c, 'style');
      const lc = child(st, 'lineColor'); if (lc) edge.style.color = rgbToHex(attrNum(lc, 'r'), attrNum(lc, 'g'), attrNum(lc, 'b'));
      if (attr(st, 'lineWidth')) edge.style.width = attrNum(st, 'lineWidth', 1);
      const label = pickText(c, 'label'); if (label && !relId) edge.label = label;
      ws.edges[eid] = edge;
    }
  }

  ws.meta.currentViewId = Object.keys(ws.views)[0] ?? null;
  return { workspace: parseWorkspace(ws), warnings };
}

// ---------------------------------------------------------------- Exportador
export function exportOpenExchange(ws: Workspace): TextExport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const ncname = (id: string) => (/^[A-Za-z_][\w.-]*$/.test(id) ? id : `id-${id.replace(/[^\w.-]/g, '-')}`);
  const lang = (text: string): XmlNode => ({ '#text': text, '@_xml:lang': LANG });

  const elements = Object.values(ws.elements).filter(e => {
    if (!e.typeId.startsWith(`${ARCHIMATE_NS}:`) || !ARCHIMATE_ELEMENT_IDS.has(e.typeId)) { warn(tr('El elemento "{name}" ({id}) no es ArchiMate ({type}); se omite', { name: e.name, id: e.id, type: e.typeId })); return false; }
    return true;
  });
  const elIds = new Set(elements.map(e => e.id));
  const relations = Object.values(ws.relations).filter(r => {
    if (!r.typeId.startsWith(`${ARCHIMATE_NS}:`) || !ARCHIMATE_RELATION_IDS.has(r.typeId)) { warn(tr('La relación {id} ({type}) no es ArchiMate; se omite', { id: r.id, type: r.typeId })); return false; }
    return true;
  });
  const relIds = new Set(relations.map(r => r.id));
  const okEnd = (e: Relation['from']) => (e.elementId ? elIds.has(e.elementId) : e.relationId ? relIds.has(e.relationId) : false);
  pruneRelations(relations, relIds, okEnd, warn);
  const views = Object.values(ws.views).filter(v => {
    if (v.notationId !== ARCHIMATE_NS || v.kind === 'grid') { warn(tr('La vista "{view}" no es una vista ArchiMate; se omite', { view: v.name })); return false; }
    return true;
  });
  const viewIds = new Set(views.map(v => v.id));

  // ---- definiciones de propiedades
  const propDefs = new Map<string, string>();
  const defId = (key: string) => { let id = propDefs.get(key); if (!id) { id = `propid-${slug(key) || propDefs.size + 1}`; propDefs.set(key, id); } return id; };
  const propsXml = (props: Record<string, string>): XmlNode | undefined => {
    const list = Object.entries(props);
    return list.length ? { property: list.map(([k, v]) => ({ ...attrs({ propertyDefinitionRef: defId(k) }), value: lang(v) })) } : undefined;
  };
  const textNode = (n: XmlNode, tag: string, text: string, withLang = true) => { if (text) n[tag] = withLang ? lang(text) : text; };

  // ---- conceptos
  const elementsXml = elements.map(e => {
    const type = e.typeId === `${ARCHIMATE_NS}:Junction` ? (e.fields.junctionType === 'or' ? 'OrJunction' : 'AndJunction') : localName(e.typeId);
    const x: XmlNode = attrs({ identifier: ncname(e.id), 'xsi:type': type });
    textNode(x, 'name', e.name || type);
    textNode(x, 'documentation', e.doc);
    const p = propsXml(e.props); if (p) x.properties = p;
    return x;
  });
  const relationsXml = relations.map(r => {
    const x: XmlNode = attrs({ identifier: ncname(r.id), source: ncname(r.from.elementId ?? r.from.relationId ?? ''), target: ncname(r.to.elementId ?? r.to.relationId ?? ''), 'xsi:type': localName(r.typeId) });
    if (r.typeId === `${ARCHIMATE_NS}:Access`) x['@_accessType'] = ACCESS_TO_OEF[String(r.fields.accessType ?? 'write')] ?? 'Write';
    if (r.typeId === `${ARCHIMATE_NS}:Influence` && r.fields.strength) x['@_modifier'] = String(r.fields.strength);
    if (r.typeId === `${ARCHIMATE_NS}:Association` && r.fields.directed) x['@_isDirected'] = 'true';
    textNode(x, 'name', r.name);
    textNode(x, 'documentation', r.doc);
    const p = propsXml(r.props); if (p) x.properties = p;
    return x;
  });

  // ---- organizaciones (carpetas)
  const orgRoots = new Map<string, XmlNode>();
  const orgItem = (path: string[]): XmlNode => {
    let cur = orgRoots.get(path[0]!);
    if (!cur) { cur = { label: lang(path[0]!), item: [] }; orgRoots.set(path[0]!, cur); }
    for (const seg of path.slice(1)) {
      const list = cur.item as XmlNode[];
      let next = list.find(i => textOf(i.label) === seg && !i['@_identifierRef']);
      if (!next) { next = { label: lang(seg), item: [] }; list.push(next); }
      cur = next;
    }
    return cur;
  };
  const elementTypes = new Map(elements.map(e => [e.id, e.typeId]));
  const catOf = (typeId: string) => { const local = localName(typeId); const cat = ((): string => { const m = /^(Business|Application|Technology|Capability|Resource|ValueStream|CourseOfAction|Node|Device|SystemSoftware|Path|CommunicationNetwork|Artifact|Equipment|Facility|DistributionNetwork|Material)/.exec(local); return m ? m[1]! : ''; })(); return cat; };
  const folderLabelOf = (typeId: string): string => {
    const local = localName(typeId), c = catOf(typeId);
    if (['Capability', 'Resource', 'ValueStream', 'CourseOfAction'].includes(local)) return FOLDER_LABELS.strategy!;
    if (c === 'Business' || local === 'Contract' || local === 'Representation' || local === 'Product') return FOLDER_LABELS.business!;
    if (c === 'Application' || local === 'DataObject') return FOLDER_LABELS.application!;
    if (['Technology', 'Node', 'Device', 'SystemSoftware', 'Path', 'CommunicationNetwork', 'Artifact', 'Equipment', 'Facility', 'DistributionNetwork', 'Material'].includes(c)) return FOLDER_LABELS.technology!;
    if (['Stakeholder', 'Driver', 'Assessment', 'Goal', 'Outcome', 'Principle', 'Requirement', 'Constraint', 'Meaning', 'Value'].includes(local)) return FOLDER_LABELS.motivation!;
    if (['WorkPackage', 'Deliverable', 'ImplementationEvent', 'Plateau', 'Gap'].includes(local)) return FOLDER_LABELS['implementation-migration']!;
    return FOLDER_LABELS.other!;
  };
  for (const e of elements) if (e.features.archiFolder) (orgItem([folderLabelOf(elementTypes.get(e.id)!), ...String(e.features.archiFolder).split('/')]).item as XmlNode[]).push(attrs({ identifierRef: ncname(e.id) }));
  for (const r of relations) if (r.features.archiFolder) (orgItem(['Relations', ...String(r.features.archiFolder).split('/')]).item as XmlNode[]).push(attrs({ identifierRef: ncname(r.id) }));
  for (const v of views) if (v.props.archiFolder) (orgItem(['Views', ...v.props.archiFolder.split('/')]).item as XmlNode[]).push(attrs({ identifierRef: ncname(v.id) }));

  // ---- vistas
  const viewsXml = views.map(v => {
    const nodes = Object.values(ws.nodes).filter(n => n.viewId === v.id);
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edges = Object.values(ws.edges).filter(e => e.viewId === v.id);
    const abs = new Map<string, { x: number; y: number }>();
    const okNode = (n: ViewNode) => !n.elementId || elIds.has(n.elementId);
    const place = (n: ViewNode, px: number, py: number) => {
      if (!okNode(n)) return;
      abs.set(n.id, { x: px + n.x, y: py + n.y });
      for (const c of nodes) if (c.parentNodeId === n.id) place(c, px + n.x, py + n.y);
    };
    for (const n of nodes) if (!n.parentNodeId || !nodeById.has(n.parentNodeId)) place(n, 0, 0);
    // el formato no admite coordenadas negativas: desplazamiento como hace Archi
    let minX = 0, minY = 0;
    for (const p of abs.values()) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }
    for (const e of edges) for (const b of e.bendpoints) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); }
    const ox = -minX, oy = -minY;

    const build = (n: ViewNode): XmlNode | null => {
      if (!okNode(n)) { warn(tr('Vista "{view}": el nodo {node} apunta a un elemento no exportado; se omite con sus hijos', { view: v.name, node: n.id })); return null; }
      const a = abs.get(n.id)!;
      const x: XmlNode = attrs({ identifier: ncname(n.id) });
      if (n.elementId) { x['@_elementRef'] = ncname(n.elementId); x['@_xsi:type'] = 'Element'; }
      else if (n.visualType === 'core:group') x['@_xsi:type'] = 'Container';
      else x['@_xsi:type'] = 'Label';
      Object.assign(x, attrs({ x: Math.round(a.x + ox), y: Math.round(a.y + oy), w: Math.round(n.w), h: Math.round(n.h) }));
      if (!n.elementId) { textNode(x, 'label', n.text ?? '', true); if (n.visualType === 'core:group' && n.note) textNode(x, 'documentation', n.note); }
      const style = writeStyle(n.style); if (style) x.style = style;
      if (!n.elementId && n.detailViewId && viewIds.has(n.detailViewId)) x.viewRef = attrs({ ref: ncname(n.detailViewId) });
      x.node = nodes.filter(c => c.parentNodeId === n.id).map(build).filter((c): c is XmlNode => !!c);
      return x;
    };
    const vx: XmlNode = attrs({ identifier: ncname(v.id), 'xsi:type': 'Diagram', viewpoint: v.viewpointId ? OEF_VIEWPOINT_NAMES[v.viewpointId] ?? v.viewpointId : undefined });
    textNode(vx, 'name', v.name || 'Vista');
    textNode(vx, 'documentation', v.doc);
    const { archiFolder, ...vprops } = v.props;
    void archiFolder;
    const p = propsXml(vprops); if (p) vx.properties = p;
    vx.node = nodes.filter(n => !n.parentNodeId || !nodeById.has(n.parentNodeId)).map(build).filter((c): c is XmlNode => !!c);
    vx.connection = edges.flatMap(e => {
      if (!abs.has(e.fromNodeId) || !abs.has(e.toNodeId)) { warn(tr('Vista "{view}": la arista {id} une nodos no exportados; se omite', { view: v.name, id: e.id })); return []; }
      if (e.relationId && !relIds.has(e.relationId)) { warn(tr('Vista "{view}": la arista {id} usa una relación no exportada; se omite', { view: v.name, id: e.id })); return []; }
      const c: XmlNode = attrs({ identifier: ncname(e.id), 'xsi:type': e.relationId ? 'Relationship' : 'Line', relationshipRef: e.relationId ? ncname(e.relationId) : undefined, source: ncname(e.fromNodeId), target: ncname(e.toNodeId) });
      if (!e.relationId && e.label) textNode(c, 'label', e.label);
      const st: XmlNode = {};
      const rgb = hexToRgb(e.style.color); if (rgb) st.lineColor = attrs(rgb);
      if (e.style.width !== undefined) st['@_lineWidth'] = String(e.style.width);
      if (Object.keys(st).length) c.style = st;
      c.bendpoint = e.bendpoints.map(b => attrs({ x: Math.round(b.x + ox), y: Math.round(b.y + oy) }));
      return [c];
    });
    return vx;
  });

  const root: XmlNode = {
    ...attrs({ xmlns: OEF_XMLNS, 'xmlns:xsi': XSI, 'xsi:schemaLocation': SCHEMA_LOCATION, identifier: ncname(`model-${slug(ws.meta.name) || 'alldraw'}`) }),
    name: lang(ws.meta.name || 'Modelo'),
  };
  if (ws.meta.description) root.documentation = lang(ws.meta.description);
  if (propDefs.size) root.propertyDefinitions = { propertyDefinition: [...propDefs.entries()].map(([name, id]) => ({ ...attrs({ identifier: id, type: 'string' }), name: lang(name) })) };
  if (elementsXml.length) root.elements = { element: elementsXml };
  if (relationsXml.length) root.relationships = { relationship: relationsXml };
  if (orgRoots.size) root.organizations = { item: [...orgRoots.values()] };
  if (viewsXml.length) root.views = { diagrams: { view: viewsXml } };
  // orden que exige el XSD: name, documentation, elements, relationships, organizations, propertyDefinitions, views
  const ordered: XmlNode = {};
  for (const k of ['@_xmlns', '@_xmlns:xsi', '@_xsi:schemaLocation', '@_identifier', 'name', 'documentation', 'elements', 'relationships', 'organizations', 'propertyDefinitions', 'views']) if (root[k] !== undefined) ordered[k] = root[k];
  return { text: buildXml({ model: ordered }), warnings };
}

// ---------------------------------------------------------------- Ayudantes
/** Primer texto con `xml:lang` preferido (es, en) o el primero que haya. */
function pickText(node: XmlNode | undefined, tag: string): string {
  const list = children(node, tag);
  if (!list.length) return '';
  const by = (l: string) => list.find(n => (attr(n, 'lang') ?? attr(n, 'xml:lang')) === l);
  return textOf(by(LANG) ?? by('en') ?? list[0]);
}
function readStyle(st: XmlNode | undefined): NodeStyle {
  const s: NodeStyle = {};
  const fc = child(st, 'fillColor');
  if (fc) { s.fill = rgbToHex(attrNum(fc, 'r'), attrNum(fc, 'g'), attrNum(fc, 'b')); if (attr(fc, 'a') !== undefined) s.opacity = attrNum(fc, 'a', 100) / 100; }
  const lc = child(st, 'lineColor'); if (lc) s.stroke = rgbToHex(attrNum(lc, 'r'), attrNum(lc, 'g'), attrNum(lc, 'b'));
  const font = child(st, 'font'), col = child(font, 'color'); if (col) s.text = rgbToHex(attrNum(col, 'r'), attrNum(col, 'g'), attrNum(col, 'b'));
  if (attr(font, 'size')) s.fontSize = attrNum(font, 'size', 9);
  return s;
}
function writeStyle(s: NodeStyle): XmlNode | undefined {
  const out: XmlNode = {};
  const fill = hexToRgb(s.fill);
  if (fill) out.fillColor = attrs({ ...fill, a: s.opacity !== undefined ? Math.round(s.opacity * 100) : undefined });
  const line = hexToRgb(s.stroke); if (line) out.lineColor = attrs(line);
  const text = hexToRgb(s.text);
  if (text || s.fontSize !== undefined) { const f: XmlNode = attrs({ name: 'Sans', size: s.fontSize ?? 9 }); if (text) f.color = attrs(text); out.font = f; }
  return Object.keys(out).length ? out : undefined;
}
