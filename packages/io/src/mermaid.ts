/**
 * **Mermaid**: `exportMermaid(ws, viewId)` escribe `flowchart` (vistas freeform/archimate/c4/grid…) o `stateDiagram-v2`
 * (vistas `statechart`); `importMermaid(text)` lee `flowchart`/`graph` y `stateDiagram(-v2)` básicos.
 *
 * Export flowchart: cada nodo con su forma (`[ ]`, `( )`, `(( ))`, `{ }`, `{{ }}`, `[/ /]`, `[( )]`, `((( )))`), los contenedores
 * (nodos con hijos o grupos) como `subgraph`, y en rejilla un `subgraph` por capa. Aristas `-->`, `-.->`, `---`, `<-->` con etiqueta.
 * Export stateDiagram-v2: `[*] -->` desde los iniciales, `--> [*]` a los finales, `state X { … }` para compuestos, `--` entre regiones
 * paralelas, `<<choice>>`/`<<fork>>`/`<<join>>`, etiquetas `evento [guarda] / acciones`.
 * Import: nodos, aristas con etiqueta y `subgraph` → elementos `freeform:*` (o `statechart:*`) en una vista con layout por niveles.
 */
import { parseWorkspace, type Workspace, type Element, type ElementType, type ViewNode, type ViewEdge, type Shape } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { C4_PACK } from '@all-draw/notation-c4';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { emptyWs, makeEl, makeRel, type TextExport } from './archimate';
import { transitionLabel } from './xstate';

export interface MermaidImport { workspace: Workspace; warnings: string[] }
export const MERMAID_VIEW_ID = 'view_mermaid';

const PACK_TYPES = new Map<string, ElementType>([...FREEFORM_PACK.elementTypes, ...ARCHIMATE_PACK.elementTypes, ...C4_PACK.elementTypes, ...STATECHART_PACK.elementTypes].map(t => [t.id, t]));
const RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'class', 'classDef', 'click', 'direction', 'linkStyle', 'state', 'note']);

/** Forma efectiva de un elemento: tipo de librería del workspace o de los packs conocidos. */
export function shapeOf(ws: Workspace, el: Element | undefined): Shape | undefined {
  if (!el) return undefined;
  for (const lib of Object.values(ws.libraries)) { const t = lib.elementTypes.find(t => t.id === el.typeId); if (t) return t.shape; }
  return PACK_TYPES.get(el.typeId)?.shape;
}

/** Ids seguros para Mermaid (letras, dígitos y `_`), únicos dentro de una exportación. */
function idMapper() {
  const used = new Map<string, string>();
  const taken = new Set<string>();
  return (raw: string): string => {
    const cached = used.get(raw); if (cached) return cached;
    let base = raw.replace(/[^A-Za-z0-9_]/g, '_');
    if (!base || /^\d/.test(base) || RESERVED.has(base)) base = `n_${base}`;
    let id = base, i = 2;
    while (taken.has(id)) id = `${base}_${i++}`;
    taken.add(id); used.set(raw, id);
    return id;
  };
}
const q = (s: string) => `"${s.replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>')}"`;

const BRACKETS: Record<string, [string, string]> = {
  rect: ['[', ']'], rounded: ['(', ')'], ellipse: ['([', '])'], circle: ['((', '))'], 'double-circle': ['(((', ')))'], diamond: ['{', '}'],
  hexagon: ['{{', '}}'], parallelogram: ['[/', '/]'], cylinder: ['[(', ')]'], note: ['>', ']'], actor: ['[', ']'], bar: ['[', ']'],
  pool: ['[', ']'], lane: ['[', ']'], group: ['[', ']'], label: ['[', ']'], container: ['[', ']'],
};

// ---------------------------------------------------------------- Exportador
export function exportMermaid(ws: Workspace, viewId: string): TextExport {
  const warnings: string[] = [];
  const view = ws.views[viewId];
  if (!view) throw new Error(`No existe la vista ${viewId}`);
  const nodes = Object.values(ws.nodes).filter(n => n.viewId === viewId);
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const edges = Object.values(ws.edges).filter(e => e.viewId === viewId && nodeById.has(e.fromNodeId) && nodeById.has(e.toNodeId));
  const mapper = idMapper();
  const elementNodes = new Map<string, string>();     // elementId → primer nodo que lo muestra
  for (const n of nodes) if (n.elementId && !elementNodes.has(n.elementId)) elementNodes.set(n.elementId, n.id);
  /** Id Mermaid de un nodo: el del elemento si es su primera aparición en la vista, si no el del nodo. */
  const mid = (nodeId: string): string => {
    const n = nodeById.get(nodeId);
    const raw = n?.elementId && elementNodes.get(n.elementId) === nodeId ? n.elementId : nodeId;
    return mapper(raw);
  };
  const elOf = (n: ViewNode) => (n.elementId ? ws.elements[n.elementId] : undefined);
  const labelOf = (n: ViewNode) => { const el = elOf(n); const t = el ? el.name : n.text ?? ''; return t || (el ? el.id : n.visualType ?? n.id); };
  const kidsOf = (id: string | undefined) => nodes.filter(n => (n.parentNodeId && nodeById.has(n.parentNodeId) ? n.parentNodeId : undefined) === id).sort((a, b) => a.y - b.y || a.x - b.x);
  const out: string[] = [];
  const isStatechart = view.notationId === 'statechart' || nodes.some(n => elOf(n)?.typeId.startsWith('statechart:'));

  if (isStatechart) {
    out.push('stateDiagram-v2');
    const typeOf = (n: ViewNode) => elOf(n)?.typeId ?? '';
    const local = (n: ViewNode) => typeOf(n).replace(/^statechart:/, '');
    const isPseudoEnd = (n: ViewNode) => ['Final', 'Terminate'].includes(local(n));
    const write = (scope: string | undefined, indent: string) => {
      const kids = kidsOf(scope);
      for (const n of kids) {
        const kind = local(n);
        if (kind === 'Initial' || isPseudoEnd(n)) continue;
        const id = mid(n.id), name = labelOf(n);
        const children = kidsOf(n.id);
        if (['Choice', 'Fork', 'Join'].includes(kind)) { out.push(`${indent}state ${id} <<${kind.toLowerCase()}>>`); continue; }
        if (name !== id) out.push(`${indent}state ${q(name)} as ${id}`);
        if (children.length) {
          out.push(`${indent}state ${id} {`);
          if (kind === 'Parallel') {
            children.forEach((region, i) => { if (i) out.push(`${indent}  --`); write(region.id, `${indent}  `); });
          } else write(n.id, `${indent}  `);
          out.push(`${indent}}`);
        }
      }
      for (const e of edges) {
        const a = nodeById.get(e.fromNodeId)!, b = nodeById.get(e.toNodeId)!;
        const scopeOf = (n: ViewNode) => (n.parentNodeId && nodeById.has(n.parentNodeId) ? n.parentNodeId : undefined);
        if (local(a) === 'Initial' && scopeOf(a) === scope) out.push(`${indent}[*] --> ${mid(b.id)}${edgeLabel(e)}`);
        else if (isPseudoEnd(b) && scopeOf(b) === scope) out.push(`${indent}${mid(a.id)} --> [*]${edgeLabel(e)}`);
      }
    };
    const edgeLabel = (e: ViewEdge) => { const rel = e.relationId ? ws.relations[e.relationId] : undefined; const l = e.label ?? (rel ? transitionLabel(rel) : ''); return l ? `: ${l}` : ''; };
    write(undefined, '    ');
    for (const e of edges) {
      const a = nodeById.get(e.fromNodeId)!, b = nodeById.get(e.toNodeId)!;
      if (local(a) === 'Initial' || isPseudoEnd(b)) continue;
      out.push(`    ${mid(a.id)} --> ${mid(b.id)}${edgeLabel(e)}`);
    }
    return { text: out.join('\n') + '\n', warnings };
  }

  out.push('flowchart TD');
  const writeNode = (n: ViewNode, indent: string) => {
    const id = mid(n.id), label = labelOf(n);
    const kids = kidsOf(n.id);
    if (kids.length || n.visualType === 'core:group') {
      out.push(`${indent}subgraph ${id}[${q(label)}]`);
      for (const k of kids) writeNode(k, indent + '  ');
      out.push(`${indent}end`);
      return;
    }
    const shape = shapeOf(ws, elOf(n)) ?? (n.visualType === 'core:note' ? 'note' : 'rounded');
    const [o, c] = BRACKETS[shape] ?? ['[', ']'];
    out.push(`${indent}${id}${o}${q(label)}${c}`);
  };
  const roots = kidsOf(undefined);
  if (view.kind === 'grid' && view.grid) {
    const layers = view.grid.layers;
    const stageIndex = new Map(view.grid.stages.map((s, i) => [s.id, i]));
    for (const layer of layers) {
      const inLayer = roots.filter(n => n.cell?.layerId === layer.id).sort((a, b) => (stageIndex.get(a.cell!.stageId) ?? 0) - (stageIndex.get(b.cell!.stageId) ?? 0) || a.x - b.x);
      if (!inLayer.length) continue;
      out.push(`    subgraph ${mapper(`layer:${layer.id}`)}[${q(layer.name)}]`);
      for (const n of inLayer) writeNode(n, '      ');
      out.push('    end');
    }
    for (const n of roots.filter(n => !n.cell || !layers.some(l => l.id === n.cell!.layerId))) writeNode(n, '    ');
  } else for (const n of roots) writeNode(n, '    ');

  for (const e of edges) {
    const rel = e.relationId ? ws.relations[e.relationId] : undefined;
    const relType = rel ? relTypeStyle(rel.typeId) : undefined;
    const line = e.style.line ?? relType?.line ?? 'solid';
    const isArrow = (h: string | undefined) => !!h && ['arrow', 'open', 'triangle', 'half'].includes(h);
    const sh = isArrow(e.style.sourceHead ?? relType?.sourceHead) ? 'arrow' : 'none', th = isArrow(e.style.targetHead ?? relType?.targetHead ?? 'arrow') ? 'arrow' : 'none';
    const label = e.label ?? rel?.name ?? '';
    const tail = th === 'none' && sh === 'none' ? (line === 'solid' ? '---' : '-.-') : line === 'solid' ? '-->' : '-.->';
    const arrow = `${sh !== 'none' && th !== 'none' ? '<' : ''}${tail}${label ? `|${q(label)}|` : ''}`;
    out.push(`    ${mid(e.fromNodeId)} ${arrow} ${mid(e.toNodeId)}`);
  }
  return { text: out.join('\n') + '\n', warnings };
}

function relTypeStyle(typeId: string) {
  for (const pack of [FREEFORM_PACK, ARCHIMATE_PACK, C4_PACK, STATECHART_PACK]) { const t = pack.relationTypes.find(r => r.id === typeId); if (t) return t; }
  return undefined;
}

// ---------------------------------------------------------------- Importador
const OPENERS: [string, string, string][] = [
  ['(((', ')))', 'freeform:ellipse'], ['([', '])', 'freeform:ellipse'], ['[[', ']]', 'freeform:box'], ['[(', ')]', 'freeform:cylinder'],
  ['[/', '/]', 'freeform:box'], ['[\\', '\\]', 'freeform:box'], ['((', '))', 'freeform:ellipse'], ['{{', '}}', 'freeform:box'],
  ['{', '}', 'freeform:diamond'], ['(', ')', 'freeform:box'], ['[', ']', 'freeform:box'], ['>', ']', 'freeform:note'],
];
const LINK = /^\s*(<?)(-{2,}|={2,}|-\.+-?)(?:\s*([^-=.<>|]+?)\s*(-{2,}|={2,}|\.-+))?([>xo])?(?:\s*\|([^|]*)\|)?\s*/;
const unquote = (s: string) => { const t = s.trim(); return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t; };

export function importMermaid(text: string): MermaidImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const lines = text.split(/\r?\n/).map(l => l.replace(/%%.*$/, '').trim()).filter(Boolean);
  const header = lines.shift() ?? '';
  const m = /^(flowchart|graph|stateDiagram(?:-v2)?)\b\s*(TD|TB|LR|RL|BT)?/.exec(header);
  if (!m) throw new Error('El texto no parece un diagrama Mermaid soportado (`flowchart`, `graph` o `stateDiagram-v2`).');
  const isState = m[1]!.startsWith('stateDiagram');
  const horizontal = m[2] === 'LR' || m[2] === 'RL';
  const ws = emptyWs(isState ? 'Máquina de estados' : 'Diagrama');
  const notation = isState ? 'statechart' : 'freeform';
  ws.views[MERMAID_VIEW_ID] = { id: MERMAID_VIEW_ID, kind: 'freeform', notationId: notation, name: ws.meta.name, doc: '', style: {}, props: {} };

  // ---- árbol de scopes (subgraphs / estados compuestos)
  interface Scope { id: string | undefined; members: string[]; parallelRegions?: string[][] }
  const scopes = new Map<string | undefined, Scope>([[undefined, { id: undefined, members: [] }]]);
  const stack: Scope[] = [scopes.get(undefined)!];
  const parentOf = new Map<string, string | undefined>();
  const edgeList: { from: string; to: string; typeId: string; label: string }[] = [];
  const ensure = (id: string, typeId: string, name?: string): Element => {
    let el = ws.elements[id];
    if (!el) {
      el = makeEl(id, typeId, name ?? id); ws.elements[id] = el;
      const scope = stack[stack.length - 1]!;
      scope.members.push(id); parentOf.set(id, scope.id);
      if (scope.parallelRegions) scope.parallelRegions[scope.parallelRegions.length - 1]!.push(id);
    } else {
      if (name !== undefined) { el.name = name; if (typeId !== 'freeform:box' && typeId !== 'statechart:State') el.typeId = typeId; }
      // un nodo mencionado antes en la raíz y vuelto a nombrar dentro de un subgraph pertenece al subgraph
      const scope = stack[stack.length - 1]!;
      if (scope.id !== undefined && parentOf.get(id) === undefined && scope.id !== id) {
        const root = scopes.get(undefined)!;
        root.members = root.members.filter(m => m !== id);
        scope.members.push(id); parentOf.set(id, scope.id);
        if (scope.parallelRegions) scope.parallelRegions[scope.parallelRegions.length - 1]!.push(id);
      }
    }
    return el;
  };
  const openScope = (id: string, typeId: string, name?: string) => {
    ensure(id, typeId, name);
    const s: Scope = { id, members: [] }; scopes.set(id, s); stack.push(s);
  };
  const closeScope = () => { if (stack.length > 1) stack.pop(); else warn('`end` sin `subgraph` abierto'); };
  let counter = 0;
  let skippingNote = false;

  if (isState) {
    const label = (s: string | undefined) => (s ?? '').trim();
    for (const raw of lines) {
      if (skippingNote) { if (/^end note$/.test(raw)) skippingNote = false; continue; }
      if (/^(direction|classDef|class|style|hide|show)\b/.test(raw)) continue;
      if (/^note\b/.test(raw)) { if (!/:/.test(raw)) skippingNote = true; continue; }
      if (raw === '}') { closeScope(); continue; }
      if (raw === '--') { const s = stack[stack.length - 1]!; if (!s.parallelRegions) s.parallelRegions = [s.members.slice()]; s.parallelRegions.push([]); continue; }
      let mm: RegExpExecArray | null;
      if ((mm = /^state\s+"([^"]*)"\s+as\s+([\w.-]+)\s*(\{)?$/.exec(raw))) { if (mm[3]) openScope(mm[2]!, 'statechart:State', mm[1]); else ensure(mm[2]!, 'statechart:State', mm[1]); continue; }
      if ((mm = /^state\s+([\w.-]+)\s+<<(choice|fork|join|end)>>$/.exec(raw))) { ensure(mm[1]!, mm[2] === 'end' ? 'statechart:Final' : `statechart:${mm[2]![0]!.toUpperCase()}${mm[2]!.slice(1)}`); continue; }
      if ((mm = /^state\s+([\w.-]+)\s*\{$/.exec(raw))) { openScope(mm[1]!, 'statechart:State'); continue; }
      if ((mm = /^state\s+([\w.-]+)$/.exec(raw))) { ensure(mm[1]!, 'statechart:State'); continue; }
      if ((mm = /^(\[\*\]|[\w.-]+)\s*-->\s*(\[\*\]|[\w.-]+)\s*(?::\s*(.*))?$/.exec(raw))) {
        const scope = stack[stack.length - 1]!.id;
        let from = mm[1]!, to = mm[2]!;
        if (from === '[*]') { from = `${scope ?? 'root'}._initial`; ensure(from, 'statechart:Initial', ''); }
        else ensure(from, 'statechart:State');
        if (to === '[*]') { to = `${scope ?? 'root'}._final`; ensure(to, 'statechart:Final', ''); }
        else ensure(to, 'statechart:State');
        edgeList.push({ from, to, typeId: 'statechart:Transition', label: label(mm[3]) });
        continue;
      }
      warn(`Línea no reconocida: ${raw}`);
    }
    // estados compuestos con regiones `--` → Parallel con una región (State) por bloque
    for (const s of scopes.values()) {
      if (!s.id || !s.parallelRegions || s.parallelRegions.length < 2) continue;
      ws.elements[s.id]!.typeId = 'statechart:Parallel';
      s.parallelRegions.forEach((members, i) => {
        const rid = `${s.id}.region${i + 1}`;
        ws.elements[rid] = makeEl(rid, 'statechart:State', `Región ${i + 1}`);
        parentOf.set(rid, s.id);
        const region: Scope = { id: rid, members }; scopes.set(rid, region);
        for (const mId of members) parentOf.set(mId, rid);
      });
      s.members = s.parallelRegions.map((_, i) => `${s.id}.region${i + 1}`);
    }
  } else {
    for (const raw of lines) {
      for (const stmt of raw.split(';').map(s => s.trim()).filter(Boolean)) {
        let mm: RegExpExecArray | null;
        if ((mm = /^subgraph\s+(.+)$/.exec(stmt))) {
          const spec = mm[1]!.trim();
          const b = /^([\w.-]+)\s*\[(.*)\]$/.exec(spec);
          if (b) openScope(b[1]!, 'freeform:group', unquote(b[2]!));
          else { const id = /^[\w.-]+$/.test(spec) ? spec : `sg${++counter}`; openScope(id, 'freeform:group', unquote(spec)); }
          continue;
        }
        if (stmt === 'end') { closeScope(); continue; }
        if (/^(classDef|class|style|linkStyle|click|direction)\b/.test(stmt)) continue;
        parseChain(stmt, warn, ensure, edgeList);
      }
    }
  }
  if (stack.length > 1) warn('Faltan `end` de cierre; se cierran al final');

  // ---- relaciones
  edgeList.forEach((e, i) => {
    const rel = makeRel(`r${i + 1}`, e.typeId, { elementId: e.from }, { elementId: e.to });
    if (e.typeId === 'statechart:Transition') { const p = parseTransition(e.label); rel.name = p.event; rel.fields = p; }
    else rel.name = e.label;
    ws.relations[rel.id] = rel;
  });

  // ---- layout por niveles dentro de cada scope
  const NODE_W = 160, NODE_H = 56, PSEUDO = 28, GAP_X = 60, GAP_Y = 70, PAD = 24, HEADER = 36;
  const size = new Map<string, { w: number; h: number }>();
  const kidsOf = (scope: string | undefined): string[] => Object.keys(ws.elements).filter(id => parentOf.get(id) === scope);
  const measure = (scope: string | undefined): { w: number; h: number } => {
    const kids = kidsOf(scope);
    const el = scope ? ws.elements[scope] : undefined;
    if (!kids.length) {
      const s = el?.typeId === 'statechart:Initial' || el?.typeId === 'statechart:Final' ? { w: PSEUDO, h: PSEUDO } : { w: NODE_W, h: NODE_H };
      if (scope) size.set(scope, s); return s;
    }
    for (const k of kids) measure(k);
    const pos = levelLayout(kids, edgeList.filter(e => kids.includes(e.from) && kids.includes(e.to)), id => size.get(id)!, horizontal, GAP_X, GAP_Y);
    let w = 0, h = 0;
    for (const k of kids) { const p = pos.get(k)!, s = size.get(k)!; w = Math.max(w, p.x + s.w); h = Math.max(h, p.y + s.h); }
    const s = { w: w + PAD * 2, h: h + PAD + (scope ? HEADER : PAD) };
    if (scope) { size.set(scope, s); layoutPos.set(scope, pos); } else layoutPos.set('', pos);
    return s;
  };
  const layoutPos = new Map<string, Map<string, { x: number; y: number }>>();
  measure(undefined);
  const place = (scope: string | undefined, parentNodeId: string | undefined) => {
    const pos = layoutPos.get(scope ?? '');
    if (!pos) return;
    for (const id of kidsOf(scope)) {
      const p = pos.get(id)!, s = size.get(id)!;
      const node: ViewNode = { id: `n:${id}`, viewId: MERMAID_VIEW_ID, elementId: id, x: p.x + PAD, y: p.y + (scope ? HEADER : PAD), w: s.w, h: s.h, style: {} };
      if (parentNodeId) node.parentNodeId = parentNodeId;
      ws.nodes[node.id] = node;
      place(id, node.id);
    }
  };
  place(undefined, undefined);
  for (const rel of Object.values(ws.relations)) {
    const edge: ViewEdge = { id: `e:${rel.id}`, viewId: MERMAID_VIEW_ID, relationId: rel.id, fromNodeId: `n:${rel.from.elementId}`, toNodeId: `n:${rel.to.elementId}`, bendpoints: [], style: {} };
    const label = rel.typeId === 'statechart:Transition' ? transitionLabel(rel) : rel.name;
    if (label) edge.label = label;
    ws.edges[edge.id] = edge;
  }
  ws.meta.currentViewId = MERMAID_VIEW_ID;
  return { workspace: parseWorkspace(ws), warnings };
}

/** `A[x] --> B & C -.->|l| D` → nodos y aristas. */
function parseChain(stmt: string, warn: (s: string) => void, ensure: (id: string, typeId: string, name?: string) => Element, edges: { from: string; to: string; typeId: string; label: string }[]) {
  let rest = stmt;
  let prev: string[] | null = null;
  let pendingLink = { typeId: 'freeform:arrow', label: '' };
  let guard = 0;
  while (rest.length && guard++ < 200) {
    const group: string[] = [];
    // uno o varios nodos separados por &
    for (;;) {
      const node = readNode(rest);
      if (!node) { warn(`No se entiende: "${rest}"`); return; }
      ensure(node.id, node.typeId, node.label);
      group.push(node.id);
      rest = rest.slice(node.length).replace(/^\s*:::[\w-]+/, '');
      const amp = /^\s*&\s*/.exec(rest);
      if (!amp) break;
      rest = rest.slice(amp[0].length);
    }
    if (prev) for (const a of prev) for (const b of group) edges.push({ from: a, to: b, ...pendingLink });
    if (!rest.trim()) return;
    const l = LINK.exec(rest);
    if (!l) { warn(`No se entiende: "${rest}"`); return; }
    const body = l[2]!, head = l[5], back = l[1] === '<';
    const dashed = body.includes('.');
    const typeId = back && head ? 'freeform:bidirectional' : !head ? 'freeform:line' : dashed ? 'freeform:dashed' : 'freeform:arrow';
    pendingLink = { typeId, label: unquote(l[3] ?? l[6] ?? '') };
    rest = rest.slice(l[0].length);
    prev = group;
  }
}

function readNode(s: string): { id: string; typeId: string; label?: string; length: number } | null {
  const m = /^\s*([\w.-]+)/.exec(s);
  if (!m) return null;
  const id = m[1]!;
  const rest = s.slice(m[0].length);
  for (const [open, close, typeId] of OPENERS) {
    if (!rest.startsWith(open)) continue;
    const end = rest.indexOf(close, open.length);
    if (end < 0) return null;
    return { id, typeId, label: unquote(rest.slice(open.length, end)), length: m[0].length + end + close.length };
  }
  return { id, typeId: 'freeform:box', length: m[0].length };
}

/** `EV [guard] / a, b` → campos de una transición. */
export function parseTransition(label: string): { event: string; guard: string; actions: string[]; delay?: string } {
  let s = label.trim();
  const out: { event: string; guard: string; actions: string[]; delay?: string } = { event: '', guard: '', actions: [] };
  const slash = s.indexOf('/');
  if (slash >= 0) { out.actions = s.slice(slash + 1).split(',').map(a => a.trim()).filter(Boolean); s = s.slice(0, slash); }
  const g = /\[([^\]]*)\]/.exec(s);
  if (g) { out.guard = g[1]!.trim(); s = s.replace(g[0], ''); }
  s = s.trim();
  const after = /^after\s+(.+)$/.exec(s);
  if (after) out.delay = after[1]!.trim(); else out.event = s;
  return out;
}

/** Layout por niveles (camino más largo desde las fuentes); devuelve posiciones relativas al scope. */
function levelLayout(ids: string[], edges: { from: string; to: string }[], sizeOf: (id: string) => { w: number; h: number }, horizontal: boolean, gapX: number, gapY: number): Map<string, { x: number; y: number }> {
  const level = new Map<string, number>(ids.map(id => [id, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) if (e.from !== e.to) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  const visiting = new Set<string>();
  const visit = (id: string, depth: number, path: Set<string>) => {
    if (path.has(id)) return;
    if ((level.get(id) ?? 0) < depth) level.set(id, depth);
    if (visiting.has(`${id}:${depth}`)) return;
    visiting.add(`${id}:${depth}`);
    const next = new Set(path); next.add(id);
    for (const t of out.get(id) ?? []) visit(t, depth + 1, next);
  };
  const targets = new Set(edges.map(e => e.to));
  for (const id of ids) if (!targets.has(id)) visit(id, 0, new Set());
  for (const id of ids) if (!visiting.has(`${id}:${level.get(id)}`)) visit(id, level.get(id) ?? 0, new Set());
  const rows = new Map<number, string[]>();
  for (const id of ids) rows.set(level.get(id) ?? 0, [...(rows.get(level.get(id) ?? 0) ?? []), id]);
  const pos = new Map<string, { x: number; y: number }>();
  let offset = 0;
  for (const lv of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(lv)!;
    let cursor = 0, thick = 0;
    for (const id of row) {
      const s = sizeOf(id);
      pos.set(id, horizontal ? { x: offset, y: cursor } : { x: cursor, y: offset });
      cursor += (horizontal ? s.h : s.w) + (horizontal ? gapY : gapX);
      thick = Math.max(thick, horizontal ? s.w : s.h);
    }
    offset += thick + (horizontal ? gapX : gapY);
  }
  return pos;
}
