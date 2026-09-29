/**
 * **draw.io / diagrams.net**: `exportDrawio(ws, viewId)` escribe un `mxGraphModel` sin comprimir (`.drawio`).
 *
 * - Cada `ViewNode` → `mxCell vertex="1"` con `style` según la forma del tipo (`ellipse`, `rhombus`, `shape=hexagon`,
 *   `shape=cylinder3`, `shape=note`, `shape=umlActor`…), color de relleno del tipo o del nodo, y `mxGeometry` relativa al
 *   padre (`parent` = celda del contenedor; draw.io también usa coordenadas relativas).
 * - En vistas de rejilla las celdas capa×etapa se dibujan como contenedores (swimlane-like) y los nodos cuelgan de su celda.
 * - Cada `ViewEdge` → `mxCell edge="1"` con `edgeStyle=orthogonalEdgeStyle`, estilo de línea y puntas según la relación,
 *   etiqueta (`value`) y `Array as="points"` con los bendpoints (absolutos, como en draw.io).
 * Solo exportación.
 */
import type { Workspace, Element, ViewNode, ArrowHead, LineStyle } from '@all-draw/core';
import { cellRects, cellKey } from '@all-draw/notation-grid';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { C4_PACK } from '@all-draw/notation-c4';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { buildXml, attrs, type XmlNode } from './xml';
import { shapeOf, edgeHeads, ER_RELATION_HEADS } from './mermaid';
import type { TextExport } from './archimate';

const SHAPE_STYLE: Record<string, string> = {
  rect: 'rounded=0;whiteSpace=wrap;html=1;', rounded: 'rounded=1;whiteSpace=wrap;html=1;', ellipse: 'ellipse;whiteSpace=wrap;html=1;',
  diamond: 'rhombus;whiteSpace=wrap;html=1;', hexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
  parallelogram: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;', cylinder: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;',
  note: 'shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;size=14;', actor: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;',
  circle: 'ellipse;aspect=fixed;html=1;', 'double-circle': 'ellipse;shape=doubleEllipse;aspect=fixed;html=1;', bar: 'rounded=0;html=1;fillColor=#000000;',
  pool: 'swimlane;html=1;', lane: 'swimlane;html=1;', group: 'rounded=0;whiteSpace=wrap;html=1;dashed=1;verticalAlign=top;', label: 'text;html=1;align=center;verticalAlign=middle;',
  container: 'rounded=1;whiteSpace=wrap;html=1;verticalAlign=top;',
};
const HEAD: Record<ArrowHead, string> = {
  none: 'none', arrow: 'classic', open: 'open', diamond: 'diamond', 'filled-diamond': 'diamond', triangle: 'block', circle: 'oval', dot: 'oval', half: 'halfCircle',
  // Pata de gallo: flechas ER de draw.io
  one: 'ERone', 'only-one': 'ERmandOne', 'zero-or-one': 'ERzeroToOne', many: 'ERmany', 'one-or-many': 'ERoneToMany', 'zero-or-many': 'ERzeroToMany',
};
const HEAD_FILL: Partial<Record<ArrowHead, number>> = { diamond: 0, triangle: 0, circle: 0, dot: 1, 'filled-diamond': 1, arrow: 1, 'zero-or-one': 0, 'zero-or-many': 0 };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl = (s: string) => esc(s).replace(/\r?\n/g, '<br>');

function colorOf(ws: Workspace, el: Element | undefined): string | undefined {
  if (!el) return undefined;
  for (const lib of Object.values(ws.libraries)) { const t = lib.elementTypes.find(t => t.id === el.typeId); if (t?.color) return t.color; }
  for (const pack of [FREEFORM_PACK, ARCHIMATE_PACK, C4_PACK, STATECHART_PACK]) { const t = pack.elementTypes.find(t => t.id === el.typeId); if (t) return t.color; }
  return undefined;
}
function relStyle(ws: Workspace, typeId: string | undefined): { line?: LineStyle; sourceHead?: ArrowHead; targetHead?: ArrowHead; color?: string } {
  if (!typeId) return {};
  for (const lib of Object.values(ws.libraries)) { const t = lib.relationTypes.find(t => t.id === typeId); if (t) return t; }
  for (const pack of [FREEFORM_PACK, ARCHIMATE_PACK, C4_PACK, STATECHART_PACK]) { const t = pack.relationTypes.find(t => t.id === typeId); if (t) return t; }
  return ER_RELATION_HEADS[typeId] ?? {};
}

export function exportDrawio(ws: Workspace, viewId: string): TextExport {
  const warnings: string[] = [];
  const view = ws.views[viewId];
  if (!view) throw new Error(`No existe la vista ${viewId}`);
  const nodes = Object.values(ws.nodes).filter(n => n.viewId === viewId);
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const cells: XmlNode[] = [attrs({ id: '0' }), attrs({ id: '1', parent: '0' })];
  const cellIdOf = (id: string) => `c_${id.replace(/[^A-Za-z0-9_.-]/g, '_')}`;

  // ---- rejilla: celdas como contenedores
  const gridCellIds = new Map<string, string>();
  if (view.kind === 'grid' && view.grid) {
    const rects = cellRects(view.grid);
    for (const l of view.grid.layers) {
      const r = rects.layers[l.id]!;
      cells.push({ ...attrs({ id: cellIdOf(`layer_${l.id}`), value: esc(l.name), style: `text;html=1;align=center;verticalAlign=middle;fontStyle=1;fillColor=${l.color ?? '#f5f5f5'};strokeColor=#cccccc;`, vertex: '1', parent: '1' }), mxGeometry: attrs({ x: r.x, y: r.y, width: r.w, height: r.h, as: 'geometry' }) });
    }
    for (const s of view.grid.stages) {
      const r = rects.stages[s.id]!;
      cells.push({ ...attrs({ id: cellIdOf(`stage_${s.id}`), value: esc(s.name), style: 'text;html=1;align=center;verticalAlign=middle;fontStyle=1;fillColor=#f5f5f5;strokeColor=#cccccc;', vertex: '1', parent: '1' }), mxGeometry: attrs({ x: r.x, y: r.y, width: r.w, height: r.h, as: 'geometry' }) });
    }
    for (const g of view.grid.stageGroups) {
      const r = rects.groups[g.id]; if (!r) continue;
      cells.push({ ...attrs({ id: cellIdOf(`group_${g.id}`), value: esc(g.name), style: `text;html=1;align=center;verticalAlign=middle;fontStyle=1;fillColor=${g.color ?? '#eeeeee'};strokeColor=#cccccc;`, vertex: '1', parent: '1' }), mxGeometry: attrs({ x: r.x, y: r.y, width: r.w, height: r.h, as: 'geometry' }) });
    }
    for (const c of Object.values(rects.cells)) {
      const id = cellIdOf(`cell_${c.layerId}_${c.stageId}`);
      gridCellIds.set(cellKey(c.layerId, c.stageId), id);
      cells.push({ ...attrs({ id, value: '', style: 'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#dddddd;container=1;', vertex: '1', parent: '1' }), mxGeometry: attrs({ x: c.x, y: c.y, width: c.w, height: c.h, as: 'geometry' }) });
    }
  }

  // ---- vértices (padres antes que hijos)
  const abs = new Map<string, { x: number; y: number }>();
  const parentCell = (n: ViewNode): { id: string; origin: { x: number; y: number } } => {
    if (n.parentNodeId && nodeById.has(n.parentNodeId)) return { id: cellIdOf(n.parentNodeId), origin: abs.get(n.parentNodeId) ?? { x: 0, y: 0 } };
    if (n.cell && gridCellIds.has(cellKey(n.cell.layerId, n.cell.stageId)) && view.grid) {
      const r = cellRects(view.grid).cells[cellKey(n.cell.layerId, n.cell.stageId)]!;
      return { id: gridCellIds.get(cellKey(n.cell.layerId, n.cell.stageId))!, origin: { x: r.x, y: r.y } };
    }
    return { id: '1', origin: { x: 0, y: 0 } };
  };
  const emitted = new Set<string>();
  const emit = (n: ViewNode) => {
    if (emitted.has(n.id)) return;
    if (n.parentNodeId && nodeById.has(n.parentNodeId)) emit(nodeById.get(n.parentNodeId)!);
    emitted.add(n.id);
    const el = n.elementId ? ws.elements[n.elementId] : undefined;
    if (n.elementId && !el) warnings.push(`El nodo ${n.id} apunta al elemento inexistente ${n.elementId}; se exporta vacío`);
    const label = el ? el.name : n.text ?? '';
    const shape = shapeOf(ws, el) ?? (n.visualType === 'core:note' ? 'note' : n.visualType === 'core:group' ? 'group' : n.visualType === 'core:label' ? 'label' : 'rounded');
    const hasKids = nodes.some(k => k.parentNodeId === n.id);
    let style = SHAPE_STYLE[shape] ?? SHAPE_STYLE.rounded!;
    const fill = n.style.fill ?? colorOf(ws, el);
    if (fill && shape !== 'bar' && shape !== 'label') style += `fillColor=${fill};`;
    if (n.style.stroke) style += `strokeColor=${n.style.stroke};`;
    if (n.style.text) style += `fontColor=${n.style.text};`;
    if (n.style.fontSize) style += `fontSize=${n.style.fontSize};`;
    if (n.style.opacity !== undefined) style += `opacity=${Math.round(n.style.opacity * 100)};`;
    if (hasKids) style += 'container=1;verticalAlign=top;';
    if (n.detailViewId) style += 'shape=process;';
    const { id: parent, origin } = parentCell(n);
    abs.set(n.id, { x: origin.x + n.x, y: origin.y + n.y });
    cells.push({ ...attrs({ id: cellIdOf(n.id), value: nl(label), style, vertex: '1', parent }), mxGeometry: attrs({ x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.w), height: Math.round(n.h), as: 'geometry' }) });
  };
  for (const n of nodes) emit(n);

  // ---- aristas
  for (const e of Object.values(ws.edges)) {
    if (e.viewId !== viewId) continue;
    if (!nodeById.has(e.fromNodeId) || !nodeById.has(e.toNodeId)) { warnings.push(`La arista ${e.id} une nodos inexistentes; se omite`); continue; }
    const rel = e.relationId ? ws.relations[e.relationId] : undefined;
    const rs = relStyle(ws, rel?.typeId);
    const line = e.style.line ?? rs.line ?? 'solid';
    const { sourceHead: sh, targetHead: th } = edgeHeads(ws, e, rel, rs);
    let style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';
    if (e.style.router === 'straight') style = 'rounded=0;html=1;';
    if (e.style.router === 'bezier' || e.style.router === 'smoothstep') style = 'edgeStyle=orthogonalEdgeStyle;curved=1;html=1;';
    if (line === 'dashed') style += 'dashed=1;';
    if (line === 'dotted') style += 'dashed=1;dashPattern=1 2;';
    style += `startArrow=${HEAD[sh]};endArrow=${HEAD[th]};`;
    if (HEAD_FILL[sh] !== undefined) style += `startFill=${HEAD_FILL[sh]};`;
    if (HEAD_FILL[th] !== undefined) style += `endFill=${HEAD_FILL[th]};`;
    const color = e.style.color ?? rs.color; if (color) style += `strokeColor=${color};`;
    if (e.style.width) style += `strokeWidth=${e.style.width};`;
    const label = e.label ?? rel?.name ?? '';
    const geometry: XmlNode = attrs({ relative: '1', as: 'geometry' });
    if (e.bendpoints.length) geometry.Array = { '@_as': 'points', mxPoint: e.bendpoints.map(p => attrs({ x: Math.round(p.x), y: Math.round(p.y) })) };
    cells.push({ ...attrs({ id: cellIdOf(e.id), value: nl(label), style, edge: '1', parent: '1', source: cellIdOf(e.fromNodeId), target: cellIdOf(e.toNodeId) }), mxGeometry: geometry });
  }

  const model: XmlNode = {
    mxfile: {
      ...attrs({ host: 'all-draw', version: '1', type: 'device' }),
      diagram: { ...attrs({ id: viewId, name: view.name || 'Vista' }), mxGraphModel: { ...attrs({ dx: 0, dy: 0, grid: 1, gridSize: 10, guides: 1, tooltips: 1, connect: 1, arrows: 1, fold: 1, page: 1, pageScale: 1, pageWidth: 1169, pageHeight: 827 }), root: { mxCell: cells } } },
    },
  };
  return { text: buildXml(model, { declaration: true }), warnings };
}
