/**
 * **Importar draw.io / diagrams.net** (`.drawio`, `.xml`, `.drawio.svg`): `importDrawio(text)`.
 *
 * - Acepta `<mxfile>` con una o varias páginas (`<diagram>`) sin comprimir o comprimidas (deflate «raw» + base64 + URI
 *   encode, lo que draw.io escribe por defecto), un `<mxGraphModel>` suelto y el SVG editable de draw.io (atributo
 *   `content`). Cada página es una vista.
 * - Vértices → elemento + nodo. La forma sale del `style`: rectángulo, redondeado, elipse, rombo, cilindro, actor, nota,
 *   hexágono, paralelogramo; `swimlane`/`group`/`container=1` → anidamiento (`parentNodeId`, coordenadas relativas al
 *   padre, como en draw.io). Las formas de librerías conocidas se pasan a nuestras notaciones cuando no hay duda:
 *   BPMN (`mxgraph.bpmn.*`: tareas, subprocesos, eventos, compuertas, datos, conversaciones; carriles y pools en páginas
 *   BPMN), ArchiMate 3 (`mxgraph.archimate3.*`, la capa por el color de la paleta de draw.io), clases UML (`swimlane`
 *   con filas `text` y separadores `line`) y entidades ER (`shape=table` o la misma pila con flechas ER). El resto va al
 *   pack libre (y a una librería «draw.io» para las figuras que el pack libre no tiene).
 * - Aristas → relación + arista con puntos (`mxPoint` → bendpoints absolutos), etiqueta (también las `edgeLabel`), color,
 *   grosor, discontinua y puntas. El tipo de relación se deduce de la notación de los extremos y del dibujo.
 * - Etiquetas HTML → texto plano. Colores de relleno, borde y texto (salvo los por defecto de draw.io).
 * - `exportDrawio` escribe `allDrawType`/`allDrawRelation` en el estilo: al reimportar se recupera el tipo exacto.
 */
import type { Workspace, Element, ViewNode, ViewEdge, NodeStyle, EdgeStyle, ArrowHead, ElementType } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { C4_PACK } from '@all-draw/notation-c4';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { emptyWs, makeEl, makeRel } from './archimate';
import { parseXmlTree, kids, kid, decodeXmlEntities, type XNode } from './xml-tree';
import { base64ToBytes, inflateRaw, utf8 } from './compress';
import { tr } from './i18n';
import { ImportError } from './errors';

export interface DrawioImport { workspace: Workspace; warnings: string[] }

// ---------------------------------------------------------------- Lectura del fichero
/** ¿Es un fichero de draw.io? (`<mxfile>`, `<mxGraphModel>` o SVG de draw.io con el diagrama dentro). */
export function isDrawio(text: string): boolean {
  const t = text.replace(/^\ufeff/, '').trimStart().replace(/^<\?xml[^>]*>\s*/, '').replace(/^(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*/i, '');
  return /^<(mxfile|mxGraphModel)\b/.test(t) || (/^<svg\b/.test(t) && /\scontent="[^"]*(?:&lt;|<)mxfile/.test(t.slice(0, 200000)));
}

/** Contenido comprimido de un `<diagram>`: base64 → inflate «raw» → `decodeURIComponent` → XML del `mxGraphModel`. */
export function decodeDrawioDiagram(data: string): string {
  const bytes = inflateRaw(base64ToBytes(data.trim()));
  const s = utf8(bytes);
  try { return decodeURIComponent(s); } catch { return s; }
}

/** HTML de una etiqueta de draw.io → texto plano (saltos de `<br>`, `<div>`, `<p>`, `<li>`; sin etiquetas ni entidades). */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<(div|p|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ');
  return decodeXmlEntities(s).split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/\n{2,}/g, '\n').trim();
}

// ---------------------------------------------------------------- Estilos
export interface MxStyle { base: string[]; kv: Record<string, string> }
export function parseMxStyle(s: string | undefined): MxStyle {
  const out: MxStyle = { base: [], kv: {} };
  for (const part of (s ?? '').split(';')) {
    const p = part.trim(); if (!p) continue;
    const i = p.indexOf('=');
    if (i < 0) out.base.push(p); else out.kv[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return out;
}
const has = (st: MxStyle, name: string) => st.base.includes(name) || st.kv.shape === name;
const on = (st: MxStyle, key: string) => st.kv[key] === '1' || st.kv[key] === 'true';

/** Color de draw.io → `#rrggbb` (o undefined si es `none`, `default`, una referencia o no es un color). */
export function mxColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  let s = v.trim();
  const ld = /^light-dark\(\s*([^,]+),/.exec(s); if (ld) s = ld[1]!.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) s = `#${s.slice(1).split('').map(c => c + c).join('')}`;
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const named: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080' };
  return named[s.toLowerCase()];
}

// ---------------------------------------------------------------- Tipos
const DRAWIO_LIB = 'lib_drawio';
const LIB = (k: string) => `lib:${DRAWIO_LIB}:${k}`;
const DRAWIO_LIB_TYPES: ElementType[] = [
  { id: LIB('rect'), name: 'Rectángulo', category: 'draw.io', shape: 'rect', color: '#ffffff', icon: '▭', fields: [] },
  { id: LIB('hexagon'), name: 'Hexágono', category: 'draw.io', shape: 'hexagon', color: '#ffe0b2', icon: '⬡', fields: [] },
  { id: LIB('parallelogram'), name: 'Paralelogramo', category: 'draw.io', shape: 'parallelogram', color: '#e1d5e7', icon: '▱', fields: [] },
];
/** Colores de tipo conocidos (para no copiar al nodo el relleno que ya pone el tipo). */
const KNOWN_TYPES = new Map<string, ElementType>([...FREEFORM_PACK.elementTypes, ...ARCHIMATE_PACK.elementTypes, ...C4_PACK.elementTypes, ...STATECHART_PACK.elementTypes, ...BPMN_PACK.elementTypes, ...DRAWIO_LIB_TYPES].map(t => [t.id, t]));

/** Paleta de capas de la librería ArchiMate 3 de draw.io (`fillColor`). */
const ARCHI_LAYER: Record<string, 'business' | 'application' | 'technology' | 'motivation' | 'strategy' | 'implementation' | 'generic' | 'location'> = {
  '#ffff99': 'business', '#99ffff': 'application', '#afffaf': 'technology', '#ccccff': 'motivation', '#f5deaa': 'strategy', '#ffe0e0': 'implementation', '#ebebeb': 'generic', '#efd1e4': 'location',
};
/** `appType` (o nombre de la figura-icono) → tipo ArchiMate, si no depende de la capa. */
const ARCHI_FIXED: Record<string, string> = {
  actor: 'BusinessActor', contract: 'Contract', representation: 'Representation', product: 'Product',
  resource: 'Resource', capability: 'Capability', valueStream: 'ValueStream', course: 'CourseOfAction',
  node: 'Node', device: 'Device', sysSw: 'SystemSoftware', path: 'Path', netw: 'CommunicationNetwork', network: 'CommunicationNetwork', artifact: 'Artifact',
  equipment: 'Equipment', facility: 'Facility', distribution: 'DistributionNetwork', material: 'Material',
  driver: 'Driver', assess: 'Assessment', goal: 'Goal', outcome: 'Outcome', principle: 'Principle', requirement: 'Requirement', constraint: 'Constraint', meaning: 'Meaning', amValue: 'Value',
  workPackage: 'WorkPackage', deliverable: 'Deliverable', plateau: 'Plateau', gap: 'Gap', gapIcon: 'Gap',
  grouping: 'Grouping', location: 'Location', locationIcon: 'Location', comp: 'ApplicationComponent', component: 'ApplicationComponent',
};
/** `appType` que dependen de la capa → nombre del tipo en cada capa. */
const ARCHI_LAYERED: Record<string, Partial<Record<string, string>>> = {
  collab: { business: 'BusinessCollaboration', application: 'ApplicationCollaboration', technology: 'TechnologyCollaboration' },
  interface: { business: 'BusinessInterface', application: 'ApplicationInterface', technology: 'TechnologyInterface' },
  func: { business: 'BusinessFunction', application: 'ApplicationFunction', technology: 'TechnologyFunction' },
  interaction: { business: 'BusinessInteraction', application: 'ApplicationInteraction', technology: 'TechnologyInteraction' },
  proc: { business: 'BusinessProcess', application: 'ApplicationProcess', technology: 'TechnologyProcess' },
  event: { business: 'BusinessEvent', application: 'ApplicationEvent', technology: 'TechnologyEvent', implementation: 'ImplementationEvent' },
  serv: { business: 'BusinessService', application: 'ApplicationService', technology: 'TechnologyService' },
  passive: { business: 'BusinessObject', application: 'DataObject' },
  role: { business: 'BusinessRole', motivation: 'Stakeholder' },
};
const ARCHI_ICON_ALIAS: Record<string, string> = { collaboration: 'collab', process: 'proc', function: 'func', service: 'serv', businessObject: 'passive' };

function archimateType(st: MxStyle): string | undefined {
  const shape = st.kv.shape ?? '';
  if (!shape.startsWith('mxgraph.archimate3.')) return undefined;
  const fig = shape.slice('mxgraph.archimate3.'.length);
  const key = fig === 'application' ? st.kv.appType ?? '' : (ARCHI_ICON_ALIAS[fig] ?? fig);
  if (fig === 'tech') { const t = ARCHI_FIXED[st.kv.techType ?? '']; return t ? `archimate:${t}` : undefined; }
  if (ARCHI_FIXED[key]) return `archimate:${ARCHI_FIXED[key]}`;
  const layer = ARCHI_LAYER[mxColor(st.kv.fillColor) ?? ''];
  const t = layer ? ARCHI_LAYERED[key]?.[layer] : undefined;
  return t ? `archimate:${t}` : undefined;
}
const ARCHI_DEFAULT_FILLS = new Set(Object.keys(ARCHI_LAYER));

const BPMN_EVENT_SYMBOL: Record<string, string> = {
  message: 'message', timer: 'timer', error: 'error', signal: 'signal', escalation: 'escalation', compensation: 'compensation', conditional: 'conditional',
  link: 'link', cancel: 'cancel', terminate: 'terminate', terminate2: 'terminate', multiple: 'multiple', parallelMultiple: 'parallelMultiple',
};
const TASK_MARKER: Record<string, string> = { service: 'service', send: 'send', receive: 'receive', user: 'user', manual: 'manual', businessRule: 'businessRule', script: 'script' };

/** Tipo BPMN de una figura `mxgraph.bpmn.*` (o undefined). */
function bpmnType(st: MxStyle): { typeId: string; fields?: Record<string, unknown> } | undefined {
  const shape = st.kv.shape ?? '';
  if (!shape.startsWith('mxgraph.bpmn.')) return undefined;
  const fig = shape.slice('mxgraph.bpmn.'.length);
  const outline = st.kv.outline ?? '', symbol = st.kv.symbol ?? '';
  const eventDef = BPMN_EVENT_SYMBOL[symbol];
  if (fig === 'event' || fig === 'shape' && st.kv.perimeter === 'ellipsePerimeter' || (fig === 'shape' && outline && !/gateway/i.test(symbol) && !st.kv.gwType)) {
    const type = outline === 'end' ? 'EndEvent' : outline === 'throwing' ? 'IntermediateThrowEvent' : outline === 'catching' ? 'IntermediateCatchEvent'
      : outline === 'boundInt' || outline === 'boundNonint' ? 'BoundaryEvent' : 'StartEvent';
    const fields: Record<string, unknown> = {};
    if (eventDef) fields.eventDefinition = eventDef;
    if (outline === 'eventNonint' || outline === 'boundNonint') fields.interrupting = false;
    return { typeId: `bpmn:${type}`, fields };
  }
  if (fig === 'gateway2' || fig === 'gateway' || (fig === 'shape' && (st.kv.gwType || symbol === 'exclusiveGw' || symbol === 'parallelGw'))) {
    const gw = st.kv.gwType ?? '';
    const type = gw === 'parallel' || symbol === 'parallelGw' ? 'ParallelGateway' : gw === 'complex' || symbol === 'complexGw' ? 'ComplexGateway'
      : gw === 'exclusive' || symbol === 'none' || symbol === 'exclusiveGw' || !symbol ? 'ExclusiveGateway'
      : outline === 'end' && symbol === 'general' ? 'InclusiveGateway' : 'EventBasedGateway';
    return { typeId: `bpmn:${type}` };
  }
  if (fig === 'task' || fig === 'task2') {
    if (on(st, 'part')) return undefined;
    const sub = st.kv.bpmnShapeType ?? '';
    const fields: Record<string, unknown> = {};
    if (on(st, 'isLoopStandard')) fields.loop = 'standard';
    else if (on(st, 'isLoopMultiParallel')) fields.loop = 'parallelMulti';
    else if (on(st, 'isLoopMultiSeq')) fields.loop = 'sequentialMulti';
    if (on(st, 'isLoopComp')) fields.isForCompensation = true;
    if (sub === 'call') return { typeId: 'bpmn:CallActivity', fields };
    if (sub === 'transaction') return { typeId: 'bpmn:Transaction', fields: { ...fields, ...(on(st, 'isLoopSub') ? { collapsed: true } : {}) } };
    if (sub === 'subprocess') return { typeId: 'bpmn:EventSubProcess', fields: { ...fields, ...(on(st, 'isLoopSub') ? { collapsed: true } : {}) } };
    if (on(st, 'isAdHoc')) return { typeId: 'bpmn:AdHocSubProcess', fields: { ...fields, ...(on(st, 'isLoopSub') ? { collapsed: true } : {}) } };
    if (on(st, 'isLoopSub')) return { typeId: 'bpmn:SubProcess', fields: { ...fields, collapsed: true } };
    const marker = TASK_MARKER[st.kv.taskMarker ?? ''];
    if (marker) fields.taskType = marker;
    return { typeId: 'bpmn:Task', fields };
  }
  if (fig === 'data' || fig === 'data2') {
    const t = st.kv.bpmnTransferType === 'input' ? 'DataInput' : st.kv.bpmnTransferType === 'output' ? 'DataOutput' : 'DataObject';
    return { typeId: `bpmn:${t}`, fields: on(st, 'isCollection') ? { isCollection: true } : {} };
  }
  if (fig === 'conversation2' || fig === 'conversation') {
    const call = st.kv.bpmnConversationType === 'call';
    return { typeId: call ? 'bpmn:CallConversation' : on(st, 'isLoopSub') ? 'bpmn:SubConversation' : 'bpmn:Conversation' };
  }
  return undefined;
}

const FLOWCHART: Record<string, string> = {
  'mxgraph.flowchart.decision': 'freeform:diamond', 'mxgraph.flowchart.terminator': 'freeform:box', 'mxgraph.flowchart.process': LIB('rect'),
  'mxgraph.flowchart.document': 'freeform:note', 'mxgraph.flowchart.multi-document': 'freeform:note', 'mxgraph.flowchart.database': 'freeform:cylinder',
  'mxgraph.flowchart.stored_data': 'freeform:cylinder', 'mxgraph.flowchart.direct_data': 'freeform:cylinder', 'mxgraph.flowchart.start_1': 'freeform:ellipse',
  'mxgraph.flowchart.start_2': 'freeform:ellipse', 'mxgraph.flowchart.on-page_reference': 'freeform:ellipse', 'mxgraph.flowchart.data': LIB('parallelogram'),
  'mxgraph.flowchart.preparation': LIB('hexagon'), 'mxgraph.flowchart.predefined_process': LIB('rect'), 'mxgraph.flowchart.annotation_1': 'freeform:note',
  'mxgraph.flowchart.annotation_2': 'freeform:note', 'mxgraph.flowchart.manual_input': LIB('rect'), 'mxgraph.flowchart.card': LIB('rect'),
};

/** Tipo genérico (pack libre o librería draw.io) por la forma del estilo; `unknown` si la forma es de una librería ajena. */
function genericType(st: MxStyle): { typeId: string; unknown?: string } {
  const shape = st.kv.shape;
  if (shape && FLOWCHART[shape]) return { typeId: FLOWCHART[shape]! };
  if (has(st, 'ellipse') || shape === 'doubleEllipse' || has(st, 'doubleEllipse')) return { typeId: 'freeform:ellipse' };
  if (has(st, 'rhombus')) return { typeId: 'freeform:diamond' };
  if (shape === 'cylinder' || shape === 'cylinder2' || shape === 'cylinder3' || shape === 'datastore' || shape === 'mxgraph.flowchart.database') return { typeId: 'freeform:cylinder' };
  if (shape === 'umlActor' || shape === 'actor') return { typeId: 'freeform:actor' };
  if (shape === 'note' || shape === 'note2' || shape === 'document' || shape === 'card') return { typeId: 'freeform:note' };
  if (shape === 'hexagon' || has(st, 'hexagon')) return { typeId: LIB('hexagon') };
  if (shape === 'parallelogram' || shape === 'trapezoid' || has(st, 'parallelogram')) return { typeId: LIB('parallelogram') };
  if (shape === 'process' || shape === 'step' || shape === 'callout' || shape === 'cube' || shape === 'tape' || shape === 'internalStorage' || shape === 'triangle' || has(st, 'triangle')) return { typeId: LIB('rect') };
  if (shape && shape !== 'rect' && shape !== 'rectangle' && shape !== 'label' && shape !== 'swimlane' && shape !== 'partialRectangle') return { typeId: on(st, 'rounded') ? 'freeform:box' : LIB('rect'), unknown: shape };
  return { typeId: on(st, 'rounded') ? 'freeform:box' : LIB('rect') };
}

// ---------------------------------------------------------------- Celdas
interface Cell {
  id: string; value: string; html: boolean; style: MxStyle; vertex: boolean; edge: boolean;
  parent?: string; source?: string; target?: string;
  geo: { x: number; y: number; w: number; h: number; relative: boolean; points: { x: number; y: number }[]; offset?: { x: number; y: number } };
  /** Atributos propios de `<UserObject>`/`<object>` (propiedades del usuario). */
  props: Record<string, string>;
  tooltip?: string;
  order: number;
}

const num = (v: string | undefined, d = 0) => { const n = Number(v); return v !== undefined && Number.isFinite(n) ? n : d; };

function readCells(model: XNode): Cell[] {
  const root = kid(model, 'root');
  if (!root) return [];
  const out: Cell[] = [];
  let order = 0;
  for (const c of root.children) {
    let cellNode: XNode | undefined, wrapper: XNode | undefined;
    if (c.tag === 'mxCell') cellNode = c;
    else if (c.tag === 'UserObject' || c.tag === 'object') { wrapper = c; cellNode = kid(c, 'mxCell'); }
    if (!cellNode) continue;
    const a = cellNode.attrs;
    const geoNode = kid(cellNode, 'mxGeometry');
    const g = geoNode?.attrs ?? {};
    const pts = kids(geoNode, 'Array').find(x => x.attrs.as === 'points');
    const offset = kids(geoNode, 'mxPoint').find(x => x.attrs.as === 'offset');
    const props: Record<string, string> = {};
    let tooltip: string | undefined;
    if (wrapper) for (const [k, v] of Object.entries(wrapper.attrs)) {
      if (k === 'id' || k === 'label' || k === 'placeholders') continue;
      if (k === 'tooltip') { tooltip = v; continue; }
      props[k] = v;
    }
    const style = parseMxStyle(a.style);
    out.push({
      id: (wrapper?.attrs.id ?? a.id ?? `cell${order}`),
      value: wrapper ? (wrapper.attrs.label ?? '') : (a.value ?? ''),
      html: style.kv.html === '1',
      style,
      vertex: a.vertex === '1', edge: a.edge === '1',
      parent: a.parent, source: a.source, target: a.target,
      geo: {
        x: num(g.x), y: num(g.y), w: num(g.width), h: num(g.height), relative: g.relative === '1',
        points: kids(pts, 'mxPoint').map(p => ({ x: num(p.attrs.x), y: num(p.attrs.y) })),
        offset: offset ? { x: num(offset.attrs.x), y: num(offset.attrs.y) } : undefined,
      },
      props, tooltip, order: order++,
    });
  }
  return out;
}

const labelOf = (c: Cell) => (c.html ? htmlToText(c.value) : c.value.replace(/\r\n?/g, '\n').trim());

/** Páginas del fichero: nombre y `mxGraphModel` ya descomprimido. */
function readPages(text: string, warn: (s: string) => void): { name: string; id: string; model: XNode }[] {
  let src = text.replace(/^\ufeff/, '');
  if (/^\s*(<\?xml[^>]*>\s*)?(<!DOCTYPE[^>]*>\s*)?<svg\b/i.test(src)) {
    const m = /\scontent="([^"]*)"/.exec(src);
    if (!m) throw new ImportError('El SVG no contiene un diagrama de draw.io.');
    src = decodeXmlEntities(m[1]!);
  }
  const root = parseXmlTree(src);
  if (root.tag === 'mxGraphModel') return [{ name: tr('Página {n}', { n: 1 }), id: 'page1', model: root }];
  if (root.tag !== 'mxfile') throw new ImportError('El XML no es un diagrama de draw.io (falta <mxfile> o <mxGraphModel>).');
  const pages: { name: string; id: string; model: XNode }[] = [];
  kids(root, 'diagram').forEach((d, i) => {
    const name = d.attrs.name || tr('Página {n}', { n: i + 1 });
    let model = kid(d, 'mxGraphModel');
    if (!model && d.text.trim()) {
      try { model = parseXmlTree(decodeDrawioDiagram(d.text)); }
      catch (e) { warn(tr('La página «{name}» está comprimida y no se pudo descomprimir: {detail}', { name, detail: (e as Error).message })); return; }
    }
    if (!model) { warn(tr('La página «{name}» está vacía; se omite', { name })); return; }
    pages.push({ name, id: d.attrs.id || `page${i + 1}`, model });
  });
  return pages;
}

// ---------------------------------------------------------------- Aristas: puntas y tipo
const HEAD_FROM_MX: Record<string, ArrowHead> = {
  none: 'none', classic: 'arrow', classicThin: 'arrow', block: 'arrow', blockThin: 'arrow', open: 'open', openThin: 'open', openAsync: 'open', async: 'half',
  diamond: 'diamond', diamondThin: 'diamond', oval: 'circle', dash: 'none', cross: 'none', halfCircle: 'half', circle: 'circle', circlePlus: 'circle',
  ERone: 'one', ERmandOne: 'only-one', ERzeroToOne: 'zero-or-one', ERmany: 'many', ERoneToMany: 'one-or-many', ERzeroToMany: 'zero-or-many',
};
const ER_CARD: Record<string, string> = { ERone: '1', ERmandOne: '1..1', ERzeroToOne: '0..1', ERmany: '*', ERoneToMany: '1..*', ERzeroToMany: '0..*' };
/** Cabeza de un extremo: `endArrow`/`endFill` (block vacío = triángulo; diamante lleno; óvalo lleno = punto). */
function headOf(st: MxStyle, end: 'start' | 'end'): ArrowHead {
  const name = st.kv[`${end}Arrow`] ?? (end === 'end' ? 'classic' : 'none');
  const fill = st.kv[`${end}Fill`];
  if ((name === 'block' || name === 'blockThin') && fill === '0') return 'triangle';
  if ((name === 'diamond' || name === 'diamondThin') && fill !== '0') return 'filled-diamond';
  if (name === 'oval' && fill !== '0') return 'dot';
  return HEAD_FROM_MX[name] ?? 'arrow';
}
const isDashed = (st: MxStyle) => on(st, 'dashed');
const isDotted = (st: MxStyle) => isDashed(st) && /^\s*[12](\s|$)/.test(st.kv.dashPattern ?? '');

function archimateRelation(st: MxStyle, sh: ArrowHead, th: ArrowHead): string {
  if (sh === 'filled-diamond') return 'Composition';
  if (sh === 'diamond') return 'Aggregation';
  if ((sh === 'dot' || sh === 'circle') && (th === 'arrow' || th === 'triangle')) return 'Assignment';
  if (th === 'triangle') return isDashed(st) ? 'Realization' : 'Specialization';
  if (isDotted(st)) return 'Access';
  if (th === 'open' && isDashed(st)) return 'Influence';
  if (th === 'open') return 'Serving';
  if (th === 'arrow') return isDashed(st) ? 'Flow' : 'Triggering';
  return 'Association';
}
function umlRelation(st: MxStyle, sh: ArrowHead, th: ArrowHead): { type: string; swap: boolean } {
  if (th === 'filled-diamond') return { type: 'uml:Composition', swap: true };
  if (sh === 'filled-diamond') return { type: 'uml:Composition', swap: false };
  if (th === 'diamond') return { type: 'uml:Aggregation', swap: true };
  if (sh === 'diamond') return { type: 'uml:Aggregation', swap: false };
  if (th === 'triangle') return { type: isDashed(st) ? 'uml:Realization' : 'uml:Generalization', swap: false };
  if (isDashed(st)) return { type: 'uml:Dependency', swap: false };
  return { type: 'uml:Association', swap: false };
}

// ---------------------------------------------------------------- Importador
export function importDrawio(text: string): DrawioImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const pages = readPages(text, warn);
  if (!pages.length) throw new ImportError('El fichero de draw.io no tiene ninguna página con contenido.');

  const ws = emptyWs(tr('Diagrama'));
  const usedIds = new Set<string>();
  const uniq = (base: string) => { let id = base, i = 2; while (usedIds.has(id)) id = `${base}_${i++}`; usedIds.add(id); return id; };
  let libUsed = false;

  pages.forEach((page, pi) => {
    const cells = readCells(page.model);
    const byId = new Map(cells.map(c => [c.id, c]));
    const viewId = uniq(`view_drawio_${pi + 1}`);
    // Capas: la celda raíz (sin padre) y sus hijas directas que no son vértices ni aristas.
    const rootIds = new Set(cells.filter(c => !c.parent).map(c => c.id));
    const layerIds = new Set(cells.filter(c => c.parent && rootIds.has(c.parent) && !c.vertex && !c.edge).map(c => c.id));
    const isTop = (c: Cell) => !c.parent || rootIds.has(c.parent) || layerIds.has(c.parent);
    const childrenOf = new Map<string, Cell[]>();
    for (const c of cells) if (c.parent) { const l = childrenOf.get(c.parent) ?? []; l.push(c); childrenOf.set(c.parent, l); }
    const vertices = cells.filter(c => c.vertex && !rootIds.has(c.id) && !layerIds.has(c.id));
    const edges = cells.filter(c => c.edge);
    const pageIsBpmn = vertices.some(c => (c.style.kv.shape ?? '').startsWith('mxgraph.bpmn.') || c.style.kv.allDrawType?.startsWith('bpmn:'));
    const pageIsArchi = vertices.some(c => (c.style.kv.shape ?? '').startsWith('mxgraph.archimate3.') || c.style.kv.allDrawType?.startsWith('archimate:'));
    const touchesEr = (id: string) => edges.some(e => (e.source === id || e.target === id || childrenOf.get(id)?.some(k => k.id === e.source || k.id === e.target))
      && `${e.style.kv.startArrow ?? ''}${e.style.kv.endArrow ?? ''}`.replace(/^none/, '').startsWith('ER'));

    /** Celdas consumidas por otra (filas de una clase o tabla, etiquetas de arista). */
    const consumed = new Set<string>();
    /** Fila de una tabla/clase → nodo de su clasificador (y pin, en ER). */
    const rowOwner = new Map<string, { cellId: string; port?: string }>();
    const nodeOfCell = new Map<string, ViewNode>();
    const edgeLabels = new Map<string, string[]>();
    for (const c of cells) if (c.vertex && c.parent && byId.get(c.parent)?.edge && (has(c.style, 'edgeLabel') || c.geo.relative)) {
      consumed.add(c.id);
      const t = labelOf(c); if (t) { const l = edgeLabels.get(c.parent) ?? []; l.push(t); edgeLabels.set(c.parent, l); }
    }

    // ---- clasificadores (clase UML / entidad ER): consumen sus filas
    const classifier = (c: Cell): { typeId: string; name: string; fields: Record<string, unknown>; rows: { cell: Cell; key: string }[] } | undefined => {
      const kidsOf = (childrenOf.get(c.id) ?? []).filter(k => k.vertex);
      if (c.style.kv.shape === 'table') {
        const attrs: { key: string; value: string }[] = []; const pk: string[] = []; const rows: { cell: Cell; key: string }[] = [];
        for (const row of kidsOf) {
          const texts = (childrenOf.get(row.id) ?? []).filter(k => k.vertex).map(labelOf);
          let marker = '', rest = texts;
          if (texts.length >= 2 && /^(PK|FK|UK|PK\s*,\s*FK|)$/i.test(texts[0]!)) { marker = texts[0]!; rest = texts.slice(1); }
          const [name = '', ...type] = rest;
          if (!name) continue;
          attrs.push({ key: name, value: type.join(' ').trim() });
          if (/PK/i.test(marker)) pk.push(name);
          rows.push({ cell: row, key: name });
          for (const k of childrenOf.get(row.id) ?? []) rows.push({ cell: k, key: name });
        }
        return { typeId: 'er:Entity', name: labelOf(c), fields: { attributes: attrs, ...(pk.length ? { pk } : {}) }, rows };
      }
      if (!has(c.style, 'swimlane') || c.style.kv.childLayout !== 'stackLayout' || !kidsOf.length) return undefined;
      const isRow = (k: Cell) => has(k.style, 'text') || k.style.kv.shape === 'text';
      const isSep = (k: Cell) => has(k.style, 'line') || k.style.kv.shape === 'line';
      if (!kidsOf.every(k => isRow(k) || isSep(k))) return undefined;
      const sections: string[][] = [[]];
      const rows: { cell: Cell; key: string }[] = [];
      for (const k of kidsOf) {
        if (isSep(k)) { sections.push([]); continue; }
        for (const line of labelOf(k).split('\n').map(s => s.trim()).filter(Boolean)) sections[sections.length - 1]!.push(line);
        rows.push({ cell: k, key: labelOf(k).split('\n')[0]!.trim() });
      }
      let name = labelOf(c);
      const stereo = /^\s*(?:«|<<)\s*([\w ]+?)\s*(?:»|>>)\s*\n?/.exec(name);
      if (stereo) name = name.slice(stereo[0].length).trim();
      const kind = stereo?.[1]?.toLowerCase();
      if (touchesEr(c.id)) {
        const attrs: { key: string; value: string }[] = []; const pk: string[] = [];
        for (const line of sections.flat()) {
          const m = /^(?:(PK|FK)\s+)?([^:\s]+)\s*:?\s*(.*)$/i.exec(line); if (!m) continue;
          attrs.push({ key: m[2]!, value: m[3]!.trim() }); if (m[1]?.toUpperCase() === 'PK') pk.push(m[2]!);
        }
        rows.forEach(r => { r.key = (/^(?:(?:PK|FK)\s+)?([^:\s]+)/i.exec(r.key)?.[1]) ?? r.key; });
        return { typeId: 'er:Entity', name, fields: { attributes: attrs, ...(pk.length ? { pk } : {}) }, rows };
      }
      const italic = (num(c.style.kv.fontStyle) & 2) === 2;
      if (kind === 'interface') return { typeId: 'uml:Interface', name, fields: { operations: sections.flat() }, rows };
      if (kind === 'enumeration' || kind === 'enum') return { typeId: 'uml:Enum', name, fields: { values: sections.flat() }, rows };
      const fields: Record<string, unknown> = { attributes: sections[0] ?? [], operations: sections.slice(1).flat() };
      if (kind) fields.stereotype = kind;
      if (italic || kind === 'abstract') fields.abstract = true;
      return { typeId: 'uml:Class', name, fields, rows };
    };

    // ---- vértices (padres antes que hijos: se recorren desde arriba)
    const absOrigin = new Map<string, { x: number; y: number }>();
    const visit = (c: Cell, parentNode: ViewNode | undefined, parentCell: Cell | undefined) => {
      if (consumed.has(c.id)) return;
      const st = c.style;
      let { x, y, w, h } = c.geo;
      if (c.geo.relative && parentCell) { x = x * parentCell.geo.w + (c.geo.offset?.x ?? 0); y = y * parentCell.geo.h + (c.geo.offset?.y ?? 0); }
      const label = labelOf(c);
      const nodeId = uniq(`vn_${pi + 1}_${c.id}`);
      const node: ViewNode = { id: nodeId, viewId, x: Math.round(x), y: Math.round(y), w: Math.max(4, Math.round(w || 120)), h: Math.max(4, Math.round(h || 60)), style: {} };
      if (parentNode) node.parentNodeId = parentNode.id;
      const origin = parentCell ? absOrigin.get(parentCell.id) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
      absOrigin.set(c.id, { x: origin.x + x, y: origin.y + y });

      const style: NodeStyle = {};
      const fill = mxColor(st.kv.fillColor), stroke = mxColor(st.kv.strokeColor), font = mxColor(st.kv.fontColor);
      if (st.kv.fontSize && num(st.kv.fontSize) > 0 && num(st.kv.fontSize) !== 12) style.fontSize = num(st.kv.fontSize);
      if (st.kv.opacity && num(st.kv.opacity, 100) < 100) style.opacity = Math.round(num(st.kv.opacity, 100)) / 100;
      if (stroke && stroke !== '#000000') style.stroke = stroke;
      if (font && font !== '#000000') style.text = font;

      let typeId: string | undefined;
      let fields: Record<string, unknown> = {};
      let visual: string | undefined;
      let name = label;
      let recurse = true;
      const explicit = st.kv.allDrawType && !st.kv.allDrawType.startsWith('lib:') ? st.kv.allDrawType : undefined;
      const cls = explicit ? undefined : classifier(c);
      if (st.kv.allDrawVisual) visual = st.kv.allDrawVisual;
      else if (explicit) typeId = explicit;
      else if (cls) {
        typeId = cls.typeId; name = cls.name; fields = cls.fields; recurse = false;
        for (const r of cls.rows) { consumed.add(r.cell.id); rowOwner.set(r.cell.id, { cellId: c.id, port: cls.typeId === 'er:Entity' ? `attributes.${r.key}` : undefined }); }
      } else if (has(st, 'text') && !st.kv.shape || st.kv.shape === 'text') {
        visual = 'core:label';
      } else if (has(st, 'group') && !label) visual = 'core:group';
      else if (st.kv.shape === 'image' || has(st, 'image')) { warn(tr('Las imágenes de draw.io no se importan; quedan como etiqueta con su texto')); visual = 'core:label'; }
      else {
        const b = bpmnType(st);
        const a = b ? undefined : archimateType(st);
        if (b) { typeId = b.typeId; fields = b.fields ?? {}; }
        else if (a) typeId = a;
        else if ((st.kv.shape ?? '').startsWith('mxgraph.archimate3.')) { warn(tr('Figura ArchiMate de draw.io sin capa reconocible ({shape}); se importa como forma libre', { shape: st.kv.shape })); typeId = LIB('rect'); }
        else if (pageIsBpmn && (has(st, 'swimlane') || st.kv.shape === 'mxgraph.bpmn.swimlane')) typeId = parentCell && (has(parentCell.style, 'swimlane') || parentCell.style.kv.shape === 'mxgraph.bpmn.swimlane') ? 'bpmn:Lane' : 'bpmn:Pool';
        else if (pageIsBpmn && st.kv.shape === 'datastore') typeId = 'bpmn:DataStore';
        else if (pageIsBpmn && st.kv.shape === 'mxgraph.flowchart.annotation_2') { typeId = 'bpmn:TextAnnotation'; fields = { text: label }; }
        else if (pageIsArchi && has(st, 'ellipse') && w <= 30 && h <= 30) { typeId = 'archimate:Junction'; if (st.kv.fillColor && st.kv.fillColor !== 'strokeColor' && mxColor(st.kv.fillColor) === '#ffffff') fields = { type: 'or' }; }
        else if (has(st, 'swimlane') || (has(st, 'group') && label) || st.kv.shape === 'swimlane') typeId = 'freeform:group';
        else {
          const g = genericType(st);
          typeId = g.typeId;
          if (g.unknown) warn(tr('Figura de draw.io sin equivalente ({shape}); se importa como rectángulo', { shape: g.unknown }));
        }
      }

      // Relleno: el del usuario, salvo el blanco por defecto y el color de la paleta que ya da el tipo.
      const typeColor = typeId ? KNOWN_TYPES.get(typeId)?.color?.toLowerCase() : undefined;
      const defaultFill = fill === '#ffffff' || (typeId?.startsWith('archimate:') && fill && ARCHI_DEFAULT_FILLS.has(fill)) || (typeColor && fill === typeColor);
      if (fill && !defaultFill && typeId !== 'freeform:group') style.fill = fill;
      if (Object.keys(style).length) node.style = style;

      if (visual) {
        node.visualType = visual;
        if (label) node.text = label;
      } else if (typeId) {
        if (typeId.startsWith(`lib:${DRAWIO_LIB}:`)) libUsed = true;
        const elId = uniq(c.id.replace(/\s+/g, '_') || `el_${pi + 1}_${c.order}`);
        const el: Element = makeEl(elId, typeId, name);
        el.fields = fields;
        if (typeId.startsWith(`lib:${DRAWIO_LIB}:`)) el.libraryId = DRAWIO_LIB;
        if (c.tooltip) el.doc = htmlToText(c.tooltip);
        if (Object.keys(c.props).length) el.props = { ...c.props };
        ws.elements[elId] = el;
        node.elementId = elId;
        if (st.kv.verticalLabelPosition === 'bottom' && !['bpmn:StartEvent', 'bpmn:EndEvent'].includes(typeId) && !typeId.includes('Gateway') && !typeId.includes('Event') && typeId !== 'freeform:actor') node.style = { ...node.style, labelPosition: 'bottom' };
      }
      ws.nodes[nodeId] = node;
      nodeOfCell.set(c.id, node);
      if (recurse) for (const k of childrenOf.get(c.id) ?? []) if (k.vertex) visit(k, node, c);
    };
    for (const c of vertices) if (isTop(c)) visit(c, undefined, undefined);
    // Vértices cuyo padre no existe (fichero editado a mano): arriba del todo.
    for (const c of vertices) if (!nodeOfCell.has(c.id) && !consumed.has(c.id) && c.parent && !byId.has(c.parent)) visit(c, undefined, undefined);

    // ---- aristas
    for (const e of edges) {
      const st = e.style;
      const end = (id: string | undefined): { node: ViewNode; port?: string } | undefined => {
        if (!id) return undefined;
        const owner = rowOwner.get(id);
        if (owner) { const n = nodeOfCell.get(owner.cellId); return n ? { node: n, port: owner.port } : undefined; }
        const n = nodeOfCell.get(id);
        return n ? { node: n } : undefined;
      };
      const a = end(e.source), b = end(e.target);
      if (!a || !b) {
        if (byId.get(e.source ?? '')?.edge || byId.get(e.target ?? '')?.edge) warn(tr('Una arista unida a otra arista no se puede importar; se omite'));
        else warn(tr('Arista sin origen o sin destino en «{page}»; se omite', { page: page.name }));
        continue;
      }
      let sh = headOf(st, 'start'), th = headOf(st, 'end');
      const ea = a.node.elementId ? ws.elements[a.node.elementId] : undefined, eb = b.node.elementId ? ws.elements[b.node.elementId] : undefined;
      const fam = (el: Element | undefined) => el?.typeId.split(':')[0];
      let from = a, to = b;
      let typeId: string | undefined = st.kv.allDrawRelation;
      const fields: Record<string, unknown> = {};
      if (!typeId && ea && eb) {
        const fa = fam(ea), fb = fam(eb);
        if (fa === 'bpmn' && fb === 'bpmn') typeId = isDashed(st) && (sh === 'circle' || sh === 'dot' || st.kv.endArrow === 'blockThin') ? 'bpmn:MessageFlow' : isDashed(st) ? 'bpmn:Association' : 'bpmn:SequenceFlow';
        else if (fa === 'archimate' && fb === 'archimate') typeId = `archimate:${archimateRelation(st, sh, th)}`;
        else if (fa === 'uml' && fb === 'uml') { const r = umlRelation(st, sh, th); typeId = r.type; if (r.swap) { from = b; to = a; [sh, th] = [th, sh]; } }
        else if (fa === 'er' && fb === 'er') {
          const sc = ER_CARD[st.kv.startArrow ?? ''], tc = ER_CARD[st.kv.endArrow ?? ''];
          const many = (c?: string) => !!c && c.includes('*');
          if (th === 'triangle') typeId = 'er:Inherits';
          else { typeId = many(sc) && many(tc) ? 'er:ManyToMany' : many(sc) || many(tc) ? 'er:OneToMany' : 'er:OneToOne'; if (sc) fields.sourceCard = sc; if (tc) fields.targetCard = tc; }
        }
      }
      if (!typeId || (typeId && !ea) || !eb) {
        if (ea && eb) typeId = isDashed(st) ? 'freeform:dashed' : sh !== 'none' && th !== 'none' ? 'freeform:bidirectional' : th === 'none' && sh === 'none' ? 'freeform:line' : 'freeform:arrow';
        else typeId = undefined;
      }
      const label = [labelOf(e), ...(edgeLabels.get(e.id) ?? [])].filter(Boolean).join('\n');
      const edgeId = uniq(`ve_${pi + 1}_${e.id}`);
      const edgeStyle: EdgeStyle = {};
      const color = mxColor(st.kv.strokeColor); if (color && color !== '#000000') edgeStyle.color = color;
      if (st.kv.strokeWidth && num(st.kv.strokeWidth) > 0 && num(st.kv.strokeWidth) !== 1) edgeStyle.width = num(st.kv.strokeWidth);
      const edgeStyleName = st.kv.edgeStyle ?? '';
      if (on(st, 'curved')) edgeStyle.router = 'bezier';
      else if (!edgeStyleName || edgeStyleName === 'none') edgeStyle.router = 'straight';
      // Línea y puntas solo si difieren de las del tipo (el tipo ya las dibuja).
      const relDefaults = typeId ? relationDefaults(typeId) : undefined;
      const line = isDotted(st) ? 'dotted' : isDashed(st) ? 'dashed' : 'solid';
      if (!relDefaults || (relDefaults.line ?? 'solid') !== line) edgeStyle.line = line;
      if (!relDefaults || !typeId?.startsWith('er:')) {
        if (!relDefaults || (relDefaults.sourceHead ?? 'none') !== sh) edgeStyle.sourceHead = sh;
        if (!relDefaults || (relDefaults.targetHead ?? 'arrow') !== th) edgeStyle.targetHead = th;
      }
      // Puntos: relativos al padre de la arista (normalmente la capa: absolutos).
      const po = e.parent && !layerIds.has(e.parent) && !rootIds.has(e.parent) ? absOrigin.get(e.parent) ?? { x: 0, y: 0 } : { x: 0, y: 0 };
      const view: ViewEdge = { id: edgeId, viewId, fromNodeId: from.node.id, toNodeId: to.node.id, bendpoints: e.geo.points.map(p => ({ x: Math.round(p.x + po.x), y: Math.round(p.y + po.y) })), style: edgeStyle };
      if (typeId && ea && eb) {
        const relId = uniq(e.id.replace(/\s+/g, '_'));
        const fromEl = from === a ? ea : eb, toEl = from === a ? eb : ea;
        const rel = makeRel(relId, typeId, { elementId: fromEl.id, ...(from.port ? { portId: `${fromEl.id}#${from.port}` } : {}) }, { elementId: toEl.id, ...(to.port ? { portId: `${toEl.id}#${to.port}` } : {}) });
        rel.name = label;
        rel.fields = fields;
        if (Object.keys(e.props).length) rel.props = { ...e.props };
        if (e.tooltip) rel.doc = htmlToText(e.tooltip);
        ws.relations[relId] = rel;
        view.relationId = relId;
        if (from.port) view.fromPortId = rel.from.portId;
        if (to.port) view.toPortId = rel.to.portId;
      } else if (label) view.label = label;
      if (!Object.keys(edgeStyle).length) view.style = {};
      ws.edges[edgeId] = view;
    }

    // ---- notación de la vista: la de la mayoría de elementos tipados de la página
    const counts = new Map<string, number>();
    for (const n of Object.values(ws.nodes)) {
      if (n.viewId !== viewId || !n.elementId) continue;
      const p = ws.elements[n.elementId]!.typeId.split(':')[0]!;
      const pack = p === 'lib' ? 'freeform' : p;
      counts.set(pack, (counts.get(pack) ?? 0) + 1);
    }
    let notation = 'freeform', best = 0;
    for (const [p, n] of counts) if (p !== 'freeform' && n > best) { notation = p; best = n; }
    ws.views[viewId] = { id: viewId, kind: 'freeform', notationId: notation, name: page.name, doc: '', style: {}, props: {} };
  });

  if (libUsed) ws.libraries[DRAWIO_LIB] = { id: DRAWIO_LIB, name: 'draw.io', description: '', elementTypes: DRAWIO_LIB_TYPES, relationTypes: [], portTypes: [], notations: ['freeform'] };
  ws.meta.currentViewId = Object.keys(ws.views)[0] ?? null;
  if (!Object.keys(ws.nodes).length) warn(tr('El diagrama de draw.io no tiene formas'));
  return { workspace: ws, warnings };
}

/** Línea y puntas por defecto de los tipos de relación que crea el importador (para no repetirlas en la arista). */
function relationDefaults(typeId: string): { line?: string; sourceHead?: ArrowHead; targetHead?: ArrowHead } | undefined {
  for (const p of [FREEFORM_PACK, ARCHIMATE_PACK, BPMN_PACK, C4_PACK, STATECHART_PACK]) { const t = p.relationTypes.find(r => r.id === typeId); if (t) return t; }
  const uml: Record<string, { line?: string; sourceHead?: ArrowHead; targetHead?: ArrowHead }> = {
    'uml:Association': { line: 'solid', sourceHead: 'none', targetHead: 'none' }, 'uml:Aggregation': { line: 'solid', sourceHead: 'diamond', targetHead: 'none' },
    'uml:Composition': { line: 'solid', sourceHead: 'filled-diamond', targetHead: 'none' }, 'uml:Generalization': { line: 'solid', sourceHead: 'none', targetHead: 'triangle' },
    'uml:Realization': { line: 'dashed', sourceHead: 'none', targetHead: 'triangle' }, 'uml:Dependency': { line: 'dashed', sourceHead: 'none', targetHead: 'open' },
    'er:OneToOne': { line: 'solid' }, 'er:OneToMany': { line: 'solid' }, 'er:ManyToMany': { line: 'solid' }, 'er:Inherits': { line: 'solid', sourceHead: 'none', targetHead: 'triangle' },
  };
  return uml[typeId];
}

