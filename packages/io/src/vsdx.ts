/**
 * **Importar Visio** (`.vsdx`, Office Open XML): `importVsdx(bytes)`.
 *
 * El `.vsdx` es un ZIP: `visio/pages/pages.xml` lista las páginas (y sus `_rels` dicen en qué `pageN.xml` está cada
 * una), `visio/masters/masters.xml` los maestros (la forma de la plantilla de la que sale cada forma) y cada página
 * tiene `<Shapes>` y `<Connects>`.
 *
 * - Cada página (no de fondo) → una vista. Cada forma 2-D → elemento + nodo; los grupos anidan (`parentNodeId`).
 * - Geometría: `PinX/PinY/Width/Height/LocPinX/LocPinY` en pulgadas con la Y hacia arriba (relativas al grupo, si lo
 *   hay) → píxeles a 96 por pulgada con la Y hacia abajo; lo que falte se hereda del maestro.
 * - Tipo por el nombre del maestro: diagrama de flujo de Visio → pack `flow`; formas BPMN → pack `bpmn`; formas básicas
 *   (rectángulo, elipse, rombo…) → pack libre. El resto, rectángulo con aviso.
 * - Conectores (formas 1-D con `BeginX`): sus extremos salen de `<Connects>`; los puntos intermedios de su geometría →
 *   bendpoints; flecha, línea discontinua y color. Texto (sin formato), datos de forma (`Property`) → propiedades.
 * - No se importan (con aviso): páginas de fondo, imágenes y objetos incrustados, giros, colores del tema.
 */
import type { Workspace, Element, ViewNode, ViewEdge, NodeStyle, EdgeStyle, ArrowHead, ElementType } from '@all-draw/core';
import { emptyWs, makeEl, makeRel } from './archimate';
import { parseXmlTree, kids, kid, type XNode } from './xml-tree';
import { unzip, utf8 } from './compress';
import { tr } from './i18n';
import { ImportError } from './errors';

export interface VsdxImport { workspace: Workspace; warnings: string[] }

/** Píxeles por pulgada. */
const PX = 96;
const VISIO_LIB = 'lib_visio';
const LIB = (k: string) => `lib:${VISIO_LIB}:${k}`;
const VISIO_LIB_TYPES: ElementType[] = [
  { id: LIB('rect'), name: 'Rectángulo', category: 'Visio', shape: 'rect', color: '#ffffff', icon: '▭', fields: [] },
  { id: LIB('hexagon'), name: 'Hexágono', category: 'Visio', shape: 'hexagon', color: '#ffe0b2', icon: '⬡', fields: [] },
  { id: LIB('parallelogram'), name: 'Paralelogramo', category: 'Visio', shape: 'parallelogram', color: '#e1d5e7', icon: '▱', fields: [] },
];

/** ¿Son los bytes de un `.vsdx`? (ZIP con `visio/document.xml`). */
export function isVsdx(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) return false;
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 1 << 20)));
  return head.includes('visio/');
}

// ---------------------------------------------------------------- Maestros → tipos
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const FLOW: Record<string, string> = {
  'process': 'flow:Process', 'decision': 'flow:Decision', 'document': 'flow:Document', 'multiple documents': 'flow:Document',
  'data': 'flow:IO', 'database': 'flow:Database', 'stored data': 'flow:Database', 'predefined process': 'flow:Subroutine', 'subprocess': 'flow:Subroutine',
  'on page reference': 'flow:Connector', 'off page reference': 'flow:Connector', 'start': 'flow:Start', 'end': 'flow:End',
};
const TERMINATOR = new Set(['start end', 'terminator', 'start or end']);
const BPMN: Record<string, { typeId: string; fields?: Record<string, unknown> }> = {
  'task': { typeId: 'bpmn:Task' }, 'collapsed sub process': { typeId: 'bpmn:SubProcess', fields: { collapsed: true } }, 'expanded sub process': { typeId: 'bpmn:SubProcess' },
  'sub process': { typeId: 'bpmn:SubProcess' }, 'start event': { typeId: 'bpmn:StartEvent' }, 'intermediate event': { typeId: 'bpmn:IntermediateCatchEvent' },
  'end event': { typeId: 'bpmn:EndEvent' }, 'gateway': { typeId: 'bpmn:ExclusiveGateway' }, 'exclusive gateway': { typeId: 'bpmn:ExclusiveGateway' },
  'parallel gateway': { typeId: 'bpmn:ParallelGateway' }, 'inclusive gateway': { typeId: 'bpmn:InclusiveGateway' }, 'event based gateway': { typeId: 'bpmn:EventBasedGateway' },
  'complex gateway': { typeId: 'bpmn:ComplexGateway' }, 'data object': { typeId: 'bpmn:DataObject' }, 'data store': { typeId: 'bpmn:DataStore' },
  'text annotation': { typeId: 'bpmn:TextAnnotation' }, 'call activity': { typeId: 'bpmn:CallActivity' }, 'transaction': { typeId: 'bpmn:Transaction' },
  'pool lane': { typeId: 'bpmn:Pool' }, 'pool': { typeId: 'bpmn:Pool' }, 'lane': { typeId: 'bpmn:Lane' }, 'message': { typeId: 'bpmn:Message' },
};
const BPMN_CONNECTOR: Record<string, string> = { 'sequence flow': 'bpmn:SequenceFlow', 'message flow': 'bpmn:MessageFlow', 'association': 'bpmn:Association' };
const BASIC: Record<string, string> = {
  'rectangle': LIB('rect'), 'square': LIB('rect'), 'box': LIB('rect'), 'rounded rectangle': 'freeform:box', 'circle': 'freeform:ellipse', 'ellipse': 'freeform:ellipse',
  'diamond': 'freeform:diamond', 'hexagon': LIB('hexagon'), 'parallelogram': LIB('parallelogram'), 'can': 'freeform:cylinder', 'cylinder': 'freeform:cylinder',
  'actor': 'freeform:actor', 'person': 'freeform:actor', 'note': 'freeform:note', 'swimlane': 'freeform:group', 'swimlane vertical': 'freeform:group',
  'cff container': 'freeform:group', 'container': 'freeform:group', 'phase list': 'freeform:group', 'text': '', 'callout': 'freeform:note',
};

// ---------------------------------------------------------------- Celdas con herencia del maestro
interface Sheet { node: XNode; master?: XNode }
const cellOf = (n: XNode | undefined, name: string): XNode | undefined => n?.children.find(c => c.tag === 'Cell' && c.attrs.N === name);
function cellV(s: Sheet, name: string): string | undefined {
  return cellOf(s.node, name)?.attrs.V ?? cellOf(s.master, name)?.attrs.V;
}
function cellNum(s: Sheet, name: string, def: number): number {
  const v = cellV(s, name); const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
}
const section = (n: XNode | undefined, name: string) => n?.children.filter(c => c.tag === 'Section' && c.attrs.N === name) ?? [];
const color = (v: string | undefined) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined);
function textOf(n: XNode | undefined): string {
  const t = kid(n, 'Text');
  if (!t) return '';
  // El texto puede venir partido por marcas de formato (`<cp/>`, `<pp/>`, `<fld>`): basta con el texto directo.
  const s = t.text + t.children.filter(c => c.tag === 'fld').map(c => c.text).join('');
  return s.replace(/\r\n?/g, '\n').replace(/\u2028/g, '\n').trim();
}

const VISIO_ARROW: (v: string | undefined) => ArrowHead = v => {
  const n = Number(v ?? 0);
  if (!n) return 'none';
  if ([1, 2, 3, 6, 7, 8, 9, 10].includes(n)) return 'open';
  if ([11, 12, 15].includes(n)) return 'triangle';
  if ([20, 21, 22, 23, 39, 40, 41].includes(n)) return 'circle';
  if ([24, 25, 26].includes(n)) return 'diamond';
  return 'arrow';
};

// ---------------------------------------------------------------- ZIP y relaciones
function relTargets(files: Record<string, Uint8Array>, relsPath: string, baseDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const f = files[relsPath];
  if (!f) return out;
  const root = parseXmlTree(utf8(f));
  for (const r of kids(root, 'Relationship')) {
    const target = r.attrs.Target ?? '';
    out.set(r.attrs.Id ?? '', target.startsWith('/') ? target.slice(1) : `${baseDir}/${target}`.replace(/[^/]+\/\.\.\//g, ''));
  }
  return out;
}

// ---------------------------------------------------------------- Importador
export function importVsdx(bytes: Uint8Array): VsdxImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  let files: Record<string, Uint8Array>;
  try { files = unzip(bytes); } catch (e) { throw new ImportError('El fichero no es un ZIP válido de Visio (.vsdx): {detail}', { detail: (e as Error).message }); }
  const pagesXml = files['visio/pages/pages.xml'];
  if (!pagesXml) throw new ImportError('Falta visio/pages/pages.xml: no parece un .vsdx de Visio 2013 o posterior (los .vsd antiguos no se admiten).');

  // ---- maestros: id → { nombre, forma principal (y sus formas por id) }
  const masters = new Map<string, { name: string; shapes: Map<string, XNode>; main?: XNode }>();
  const mXml = files['visio/masters/masters.xml'];
  if (mXml) {
    const rels = relTargets(files, 'visio/masters/_rels/masters.xml.rels', 'visio/masters');
    for (const m of kids(parseXmlTree(utf8(mXml)), 'Master')) {
      const rid = kid(m, 'Rel')?.attrs['r:id'];
      const path = rid ? rels.get(rid) : undefined;
      const shapes = new Map<string, XNode>();
      let main: XNode | undefined;
      if (path && files[path]) {
        const contents = parseXmlTree(utf8(files[path]!));
        const top = kids(kid(contents, 'Shapes'), 'Shape');
        main = top[0];
        const walk = (list: XNode[]) => { for (const s of list) { shapes.set(s.attrs.ID ?? '', s); walk(kids(kid(s, 'Shapes'), 'Shape')); } };
        walk(top);
      }
      masters.set(m.attrs.ID ?? '', { name: m.attrs.NameU ?? m.attrs.Name ?? '', shapes, main });
    }
  }

  const ws = emptyWs(tr('Diagrama'));
  const docProps = files['docProps/core.xml'];
  if (docProps) { const title = /<dc:title>([^<]*)<\/dc:title>/.exec(utf8(docProps))?.[1]?.trim(); if (title) ws.meta.name = title; }
  const pageRels = relTargets(files, 'visio/pages/_rels/pages.xml.rels', 'visio/pages');
  const used = new Set<string>();
  const uniq = (base: string) => { let id = base, i = 2; while (used.has(id)) id = `${base}_${i++}`; used.add(id); return id; };
  let libUsed = false;

  kids(parseXmlTree(utf8(pagesXml)), 'Page').forEach((page, pi) => {
    const pageName = page.attrs.NameU ?? page.attrs.Name ?? tr('Página {n}', { n: pi + 1 });
    if (page.attrs.Background === '1') { warn(tr('La página de fondo «{name}» no se importa', { name: pageName })); return; }
    const rid = kid(page, 'Rel')?.attrs['r:id'];
    const path = rid ? pageRels.get(rid) : undefined;
    const content = path ? files[path] : undefined;
    if (!content) { warn(tr('No se encuentra el contenido de la página «{name}»; se omite', { name: pageName })); return; }
    if (kids(section(kid(page, 'PageSheet'), 'Layer')[0], 'Row').length > 1) warn(tr('Las capas de Visio no se importan: todas las formas quedan en la misma vista'));
    const pageH = Number(cellOf(kid(page, 'PageSheet'), 'PageHeight')?.attrs.V ?? 11) || 11;
    const root = parseXmlTree(utf8(content));
    const viewId = uniq(`view_visio_${pi + 1}`);
    const nodeOfShape = new Map<string, ViewNode>();
    const connectors: { sheet: Sheet; id: string; origin: { x: number; y: number }; masterName: string }[] = [];
    const sheetOf = (s: XNode): Sheet => {
      const m = s.attrs.Master ? masters.get(s.attrs.Master) : undefined;
      const inherited = s.attrs.MasterShape ? m?.shapes.get(s.attrs.MasterShape) : m?.main;
      return { node: s, master: inherited };
    };
    /** Nombre del maestro de la forma (o del de su grupo, para las subformas de un maestro). */
    const masterName = (s: XNode, inheritedFrom?: string) => (s.attrs.Master ? masters.get(s.attrs.Master)?.name ?? '' : inheritedFrom ?? '');
    const counts = new Map<string, number>();

    /** `origin`: esquina inferior izquierda del sistema local (pulgadas de página); `parentH`: alto del padre. */
    const visit = (s: XNode, origin: { x: number; y: number }, parent: { node: ViewNode; h: number } | undefined, inheritedMaster?: string) => {
      const sheet = sheetOf(s);
      const mname = masterName(s, inheritedMaster);
      const id = s.attrs.ID ?? '';
      if (s.attrs.Type === 'Foreign') { warn(tr('Las imágenes y objetos incrustados de Visio no se importan')); return; }
      if (s.attrs.Type === 'Guide') return;
      if (cellOf(s, 'BeginX') || cellOf(sheet.master, 'BeginX')) { connectors.push({ sheet, id, origin, masterName: mname }); return; }
      const w = cellNum(sheet, 'Width', 1), h = cellNum(sheet, 'Height', 0.75);
      const pinX = cellNum(sheet, 'PinX', 0), pinY = cellNum(sheet, 'PinY', 0);
      const locX = cellNum(sheet, 'LocPinX', w / 2), locY = cellNum(sheet, 'LocPinY', h / 2);
      if (Math.abs(cellNum(sheet, 'Angle', 0)) > 1e-6) warn(tr('Los giros de las formas de Visio no se importan'));
      const left = pinX - locX, bottom = pinY - locY;            // en el sistema local del padre
      const absLeft = origin.x + left, absBottom = origin.y + bottom;
      const x = parent ? left * PX : absLeft * PX;
      const y = parent ? (parent.h - (bottom + h)) * PX : (pageH - (absBottom + h)) * PX;
      const label = textOf(s) || textOf(sheet.master);
      const nodeId = uniq(`vn_${pi + 1}_${id}`);
      const node: ViewNode = { id: nodeId, viewId, x: Math.round(x), y: Math.round(y), w: Math.max(4, Math.round(Math.abs(w) * PX)), h: Math.max(4, Math.round(Math.abs(h) * PX)), style: {} };
      if (parent) node.parentNodeId = parent.node.id;
      const style: NodeStyle = {};
      const fill = color(cellV(sheet, 'FillForegnd')), stroke = color(cellV(sheet, 'LineColor'));
      const font = color(section(s, 'Character')[0]?.children.find(r => r.tag === 'Row')?.children.find(c => c.attrs.N === 'Color')?.attrs.V);
      if (fill && fill !== '#ffffff') style.fill = fill;
      if (stroke && stroke !== '#000000') style.stroke = stroke;
      if (font && font !== '#000000') style.text = font;
      if (Object.keys(style).length) node.style = style;
      if (s.children.some(c => c.tag === 'Cell' && ((c.attrs.N ?? '').startsWith('QuickStyle') || /THEME/i.test(c.attrs.F ?? '')))) warn(tr('Los colores del tema de Visio no se importan; solo los colores puestos a mano'));

      // Tipo: maestro conocido; si no, por la geometría (elipse) o rectángulo.
      const key = norm(mname);
      let typeId: string | undefined, fields: Record<string, unknown> = {};
      const geo = section(s, 'Geometry').length ? section(s, 'Geometry') : section(sheet.master, 'Geometry');
      const isGroup = s.attrs.Type === 'Group';
      if (FLOW[key]) typeId = FLOW[key];
      else if (TERMINATOR.has(key)) typeId = 'flow:Start';           // se decide Start/End por las conexiones, más abajo
      else if (BPMN[key]) { typeId = BPMN[key]!.typeId; fields = { ...BPMN[key]!.fields }; if (typeId === 'bpmn:Pool' && parent) typeId = 'bpmn:Lane'; }
      else if (key in BASIC) typeId = BASIC[key] || undefined;
      else if (isGroup && !mname) typeId = undefined;
      else if (!mname && !geo.length && label) typeId = undefined;     // texto suelto
      else if (geo.some(g => g.children.some(r => r.tag === 'Row' && r.attrs.T === 'Ellipse'))) typeId = 'freeform:ellipse';
      else {
        typeId = LIB('rect');
        if (mname) warn(tr('La forma «{name}» de Visio no tiene equivalente; se importa como rectángulo', { name: mname }));
      }
      if (typeId === 'freeform:group' || (isGroup && !typeId)) {
        // Grupo sin maestro: contenedor visual (si tiene texto, un grupo con nombre).
        if (!typeId) { node.visualType = 'core:group'; if (label) node.text = label; }
      }
      if (!typeId && !node.visualType) { node.visualType = 'core:label'; node.text = label; }
      if (typeId) {
        if (typeId.startsWith(`lib:${VISIO_LIB}:`)) libUsed = true;
        const elId = uniq(`shape_${pi + 1}_${id}`);
        const el: Element = makeEl(elId, typeId, label);
        el.fields = fields;
        if (typeId.startsWith(`lib:${VISIO_LIB}:`)) el.libraryId = VISIO_LIB;
        // Datos de forma (Shape Data) → propiedades.
        for (const sec of section(s, 'Property')) for (const row of kids(sec, 'Row')) {
          const label = row.children.find(c => c.attrs.N === 'Label')?.attrs.V || row.attrs.N || '';
          const value = row.children.find(c => c.attrs.N === 'Value')?.attrs.V ?? '';
          if (label && value !== '') el.props[label] = value;
        }
        if (typeId === 'bpmn:TextAnnotation') el.fields = { text: label };
        ws.elements[elId] = el;
        node.elementId = elId;
        const pack = typeId.split(':')[0]!;
        counts.set(pack, (counts.get(pack) ?? 0) + 1);
      }
      ws.nodes[nodeId] = node;
      nodeOfShape.set(id, node);
      // Subformas de un grupo: su sistema local tiene el origen en la esquina inferior izquierda del grupo.
      const children = kids(kid(s, 'Shapes'), 'Shape');
      if (children.length) {
        // Un grupo con maestro (una forma de plantilla hecha de piezas) es una sola forma: no se baja a sus piezas.
        if (typeId && mname && !(typeId === 'freeform:group' || typeId === 'bpmn:Pool' || typeId === 'bpmn:Lane' || typeId === 'bpmn:SubProcess')) return;
        for (const c of children) visit(c, { x: absLeft, y: absBottom }, { node, h }, mname);
      }
    };
    for (const s of kids(kid(root, 'Shapes'), 'Shape')) visit(s, { x: 0, y: 0 }, undefined);

    // ---- conectores
    const ends = new Map<string, { begin?: string; end?: string }>();
    for (const c of kids(kid(root, 'Connects'), 'Connect')) {
      const from = c.attrs.FromSheet ?? '', to = c.attrs.ToSheet ?? '';
      const e = ends.get(from) ?? {};
      if (c.attrs.FromCell === 'BeginX') e.begin = to; else if (c.attrs.FromCell === 'EndX') e.end = to;
      ends.set(from, e);
    }
    const toPx = (x: number, y: number) => ({ x: Math.round(x * PX), y: Math.round((pageH - y) * PX) });
    const outgoing = new Map<string, number>(), incoming = new Map<string, number>();
    for (const c of connectors) {
      const e = ends.get(c.id);
      const a = e?.begin ? nodeOfShape.get(e.begin) : undefined, b = e?.end ? nodeOfShape.get(e.end) : undefined;
      if (!a || !b) { warn(tr('Conector de Visio sin forma en uno de sus extremos en «{page}»; se omite', { page: pageName })); continue; }
      const ea = a.elementId ? ws.elements[a.elementId] : undefined, eb = b.elementId ? ws.elements[b.elementId] : undefined;
      const s = c.sheet;
      // Puntos intermedios: filas de la geometría del conector (en su sistema local), sin el primero ni el último.
      const pinX = cellNum(s, 'PinX', 0), pinY = cellNum(s, 'PinY', 0), w = cellNum(s, 'Width', 0), h = cellNum(s, 'Height', 0);
      const ox = c.origin.x + pinX - cellNum(s, 'LocPinX', w / 2), oy = c.origin.y + pinY - cellNum(s, 'LocPinY', h / 2);
      // Solo la geometría propia: la del maestro es la de muestra de la plantilla, no la de este trazado.
      const geo = section(s.node, 'Geometry')[0];
      const rows = (geo ? kids(geo, 'Row') : []).filter(r => r.attrs.T === 'LineTo' || r.attrs.T === 'MoveTo' || r.attrs.T === 'RelLineTo' || r.attrs.T === 'RelMoveTo');
      const pts = rows.map(r => {
        const X = Number(r.children.find(x => x.attrs.N === 'X')?.attrs.V ?? 0), Y = Number(r.children.find(x => x.attrs.N === 'Y')?.attrs.V ?? 0);
        const rel = (r.attrs.T ?? '').startsWith('Rel');
        return toPx(ox + (rel ? X * w : X), oy + (rel ? Y * h : Y));
      });
      const begin = toPx(c.origin.x + cellNum(s, 'BeginX', 0), c.origin.y + cellNum(s, 'BeginY', 0)), finish = toPx(c.origin.x + cellNum(s, 'EndX', 0), c.origin.y + cellNum(s, 'EndY', 0));
      const near = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.abs(p.x - q.x) <= 2 && Math.abs(p.y - q.y) <= 2;
      const bendpoints = (pts.length > 2 ? pts.slice(1, -1) : []).filter(p => !near(p, begin) && !near(p, finish));
      const label = textOf(s.node);
      const style: EdgeStyle = {};
      const lc = color(cellV(s, 'LineColor')); if (lc && lc !== '#000000') style.color = lc;
      const pattern = Number(cellV(s, 'LinePattern') ?? 1);
      const line = pattern === 3 || pattern === 10 ? 'dotted' : pattern >= 2 ? 'dashed' : 'solid';
      const sh = VISIO_ARROW(cellV(s, 'BeginArrow')), th = VISIO_ARROW(cellV(s, 'EndArrow'));
      const edgeId = uniq(`ve_${pi + 1}_${c.id}`);
      const view: ViewEdge = { id: edgeId, viewId, fromNodeId: a.id, toNodeId: b.id, bendpoints, style };
      if (bendpoints.length) style.router = 'straight';
      const fam = (el?: Element) => el?.typeId.split(':')[0];
      let typeId: string | undefined;
      if (ea && eb) {
        const bpmnConn = BPMN_CONNECTOR[norm(c.masterName)];
        if (bpmnConn) typeId = bpmnConn;
        else if (fam(ea) === 'bpmn' && fam(eb) === 'bpmn') typeId = line === 'dashed' ? 'bpmn:MessageFlow' : line === 'dotted' ? 'bpmn:Association' : 'bpmn:SequenceFlow';
        else if (fam(ea) === 'flow' && fam(eb) === 'flow') typeId = 'flow:Arrow';
        else typeId = line !== 'solid' ? 'freeform:dashed' : sh !== 'none' && th !== 'none' ? 'freeform:bidirectional' : th === 'none' && sh === 'none' ? 'freeform:line' : 'freeform:arrow';
        if (typeId.startsWith('freeform:')) { if (line !== 'solid' && line !== 'dashed') style.line = line; }
        else if (typeId === 'flow:Arrow' && line !== 'solid') style.line = line;
        if (typeId === 'freeform:dashed' && th === 'none') style.targetHead = 'none';
        const rel = makeRel(uniq(`conn_${pi + 1}_${c.id}`), typeId, { elementId: ea.id }, { elementId: eb.id });
        rel.name = label;
        ws.relations[rel.id] = rel;
        view.relationId = rel.id;
        outgoing.set(ea.id, (outgoing.get(ea.id) ?? 0) + 1); incoming.set(eb.id, (incoming.get(eb.id) ?? 0) + 1);
      } else {
        if (label) view.label = label;
        style.sourceHead = sh; style.targetHead = th; if (line !== 'solid') style.line = line;
      }
      ws.edges[edgeId] = view;
    }
    // Terminales «Start/End» de Visio: inicio si no le llega nada, fin si no sale nada.
    for (const n of nodeOfShape.values()) {
      const el = n.elementId ? ws.elements[n.elementId] : undefined;
      if (!el || el.typeId !== 'flow:Start') continue;
      const shape = el.id;
      if (!incoming.get(shape) && outgoing.get(shape)) continue;
      if (incoming.get(shape) && !outgoing.get(shape)) el.typeId = 'flow:End';
    }
    let notation = 'freeform', best = 0;
    for (const [p, n] of counts) if (p !== 'freeform' && p !== 'lib' && n > best) { notation = p; best = n; }
    ws.views[viewId] = { id: viewId, kind: 'freeform', notationId: notation, name: pageName, doc: '', style: {}, props: {} };
  });

  if (!Object.keys(ws.views).length) throw new ImportError('El fichero de Visio no tiene páginas que importar.');
  if (libUsed) ws.libraries[VISIO_LIB] = { id: VISIO_LIB, name: 'Visio', description: '', elementTypes: VISIO_LIB_TYPES, relationTypes: [], portTypes: [], notations: ['freeform'] };
  ws.meta.currentViewId = Object.keys(ws.views)[0] ?? null;
  return { workspace: ws, warnings };
}
