/**
 * **Mermaid**: `exportMermaid(ws, viewId)` escribe `stateDiagram-v2` (vistas `statechart`), `sequenceDiagram` (vistas de
 * secuencia), `classDiagram` (vistas `uml`), `erDiagram` (vistas `er`) o `flowchart` (el resto; si la notación no es un
 * diagrama de flujo, con un aviso: Mermaid no tiene equivalente). `importMermaid(text)` lee `flowchart`/`graph`,
 * `stateDiagram(-v2)`, `sequenceDiagram` y `classDiagram`; los demás tipos dan un error que lo dice.
 *
 * Export flowchart: cada nodo con su forma (`[ ]`, `( )`, `(( ))`, `{ }`, `{{ }}`, `[/ /]`, `[( )]`, `((( )))`), los contenedores
 * (nodos con hijos o grupos) como `subgraph`, y en rejilla un `subgraph` por capa. Aristas `-->`, `-.->`, `---`, `<-->` con etiqueta.
 * Export stateDiagram-v2: `[*] -->` desde los iniciales, `--> [*]` a los finales, `state X { … }` para compuestos, `--` entre regiones
 * paralelas, `<<choice>>`/`<<fork>>`/`<<join>>`, etiquetas `evento [guarda] / acciones`; cada estado se declara en su bloque y
 * cada transición va en el bloque del ámbito común de sus extremos (si no, Mermaid aplana la estructura).
 * Export sequenceDiagram: participantes por columnas, mensajes por orden (`->>`, `-)`, `-->>`, `-x`), `activate`/`deactivate`
 * y fragmentos `alt`/`loop`/… alrededor de los mensajes que encierran. Export classDiagram: miembros, `<<interface>>`,
 * `<<enumeration>>`, `<<abstract>>`, `namespace` para paquetes y relaciones con multiplicidades.
 * Export erDiagram: entidades (y vistas de BD) con sus atributos (`tipo nombre PK`), relaciones con la cardinalidad de pata
 * de gallo de cada extremo (`||--o{`…, la misma que dibuja el editor: tipo + `sourceCard`/`targetCard`), `..` si la línea es discontinua.
 * Los ids de Mermaid salen del id interno o, si es uno generado (`el_x8Kq…`), del nombre.
 * Import: nodos, aristas con etiqueta y `subgraph` → elementos `freeform:*` (o `statechart:*`, `sequence:*`, `uml:*`) en una vista
 * con layout por niveles; hexágonos y paralelogramos van a una librería «Mermaid» del espacio para no perder la figura.
 */
import { MemoryStore, parseWorkspace, type Workspace, type Element, type ElementType, type ViewNode, type ViewEdge, type Shape, type ArrowHead, type Relation } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { C4_PACK } from '@all-draw/notation-c4';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { emptyWs, makeEl, makeRel, type TextExport } from './archimate';
import { transitionLabel } from './xstate';
import { cardToHead } from './svg';
import { tr } from './i18n';
import { ImportError } from './errors';
import { isSequenceView, sequenceGeometry, type MessageKind } from './svg-sequence';

export interface MermaidImport { workspace: Workspace; warnings: string[] }
export const MERMAID_VIEW_ID = 'view_mermaid';

const PACK_TYPES = new Map<string, ElementType>([...FREEFORM_PACK.elementTypes, ...ARCHIMATE_PACK.elementTypes, ...C4_PACK.elementTypes, ...STATECHART_PACK.elementTypes, ...BPMN_PACK.elementTypes].map(t => [t.id, t]));
/** Figuras del pack de diagrama de flujo (io no depende de él): terminales como estadio, decisión, E/S, documento… */
const FLOW_SHAPES: Record<string, Shape | 'stadium' | 'subroutine'> = {
  'flow:Start': 'stadium', 'flow:End': 'stadium', 'flow:Process': 'rect', 'flow:Decision': 'diamond', 'flow:IO': 'parallelogram',
  'flow:Document': 'note', 'flow:Database': 'cylinder', 'flow:Connector': 'circle', 'flow:Subroutine': 'subroutine',
};
const RESERVED = new Set(['end', 'graph', 'flowchart', 'subgraph', 'style', 'class', 'classDef', 'click', 'direction', 'linkStyle', 'state', 'note']);

/** Forma efectiva de un elemento: tipo de librería del workspace o de los packs conocidos. */
export function shapeOf(ws: Workspace, el: Element | undefined): Shape | undefined {
  if (!el) return undefined;
  for (const lib of Object.values(ws.libraries)) { const t = lib.elementTypes.find(t => t.id === el.typeId); if (t) return t.shape; }
  return PACK_TYPES.get(el.typeId)?.shape ?? (FLOW_SHAPES[el.typeId] as Shape | undefined);
}

/** Ids seguros para Mermaid (letras, dígitos y `_`), únicos dentro de una exportación. */
function idMapper() {
  const used = new Map<string, string>();
  const taken = new Set<string>();
  /**
   * `prefer`: texto legible (el nombre) del que sacar el id cuando el interno es uno generado (`el_x8Kq…`), que en
   * Mermaid no dice nada. Los ids con significado (de ficheros importados) se conservan. `raw` sigue siendo la clave.
   */
  return (raw: string, prefer?: string): string => {
    const cached = used.get(raw); if (cached) return cached;
    const generated = /^[a-z]{1,6}_[0-9A-Za-z]{12}$/.test(raw);
    const nice = generated ? (prefer ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) : '';
    let base = nice || raw.replace(/^(l|c|ns):/, '').replace(/[^A-Za-z0-9_]/g, '_');
    if (!base || /^\d/.test(base) || RESERVED.has(base)) base = `n_${base}`;
    let id = base, i = 2;
    while (taken.has(id)) id = `${base}_${i++}`;
    taken.add(id); used.set(raw, id);
    return id;
  };
}
const q = (s: string) => `"${s.replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>')}"`;

/** Notaciones que en Mermaid son, de verdad, un `flowchart` (las demás se exportan así con un aviso). */
const FLOWCHART_NATIVE = new Set(['freeform', 'flow']);

const BRACKETS: Record<string, [string, string]> = {
  rect: ['[', ']'], rounded: ['(', ')'], ellipse: ['([', '])'], circle: ['((', '))'], 'double-circle': ['(((', ')))'], diamond: ['{', '}'],
  hexagon: ['{{', '}}'], parallelogram: ['[/', '/]'], cylinder: ['[(', ')]'], note: ['>', ']'], actor: ['[', ']'], bar: ['[', ']'],
  pool: ['[', ']'], lane: ['[', ']'], group: ['[', ']'], label: ['[', ']'], container: ['[', ']'], stadium: ['([', '])'], subroutine: ['[[', ']]'],
};

// ---------------------------------------------------------------- Exportador
export function exportMermaid(ws: Workspace, viewId: string): TextExport {
  const warnings: string[] = [];
  const view = ws.views[viewId];
  if (!view) throw new Error(tr('No existe la vista {view}', { view: viewId }));
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
    return mapper(raw, n ? labelOf(n) : undefined);
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
    const scopeOf = (n: ViewNode) => (n.parentNodeId && nodeById.has(n.parentNodeId) ? n.parentNodeId : undefined);
    /** Ámbitos que contienen a un nodo, del más cercano a la raíz (`undefined`). */
    const scopesOf = (n: ViewNode): (string | undefined)[] => { const out: (string | undefined)[] = []; let s = scopeOf(n), guard = 0; while (s && guard++ < 50) { out.push(s); s = scopeOf(nodeById.get(s)!); } out.push(undefined); return out; };
    /**
     * Cada transición se escribe dentro del bloque del ámbito común más cercano a sus dos extremos: así Mermaid la
     * deja dentro del estado compuesto o de la región paralela a la que pertenece (fuera, aplanaría la estructura).
     */
    const edgeScope = new Map<string, string | undefined>();
    for (const e of edges) {
      const a = nodeById.get(e.fromNodeId)!, b = nodeById.get(e.toNodeId)!;
      const sb = new Set(scopesOf(b));
      const common = scopesOf(a).find(s => sb.has(s));
      edgeScope.set(e.id, common);
      if (common !== scopeOf(a) && common !== scopeOf(b) && local(a) !== 'Initial' && !isPseudoEnd(b))
        warnings.push(tr('La transición «{from}» → «{to}» une estados de compuestos distintos: Mermaid no lo admite y puede dibujarla fuera de ellos', { from: labelOf(a), to: labelOf(b) }));
    }
    const edgeLabel = (e: ViewEdge) => { const rel = e.relationId ? ws.relations[e.relationId] : undefined; const l = e.label ?? (rel ? transitionLabel(rel) : ''); return l ? `: ${l}` : ''; };
    const write = (scope: string | undefined, indent: string) => {
      for (const n of kidsOf(scope)) {
        const kind = local(n);
        if (kind === 'Initial' || isPseudoEnd(n)) continue;
        const id = mid(n.id), name = labelOf(n);
        const children = kidsOf(n.id);
        if (['Choice', 'Fork', 'Join'].includes(kind)) { out.push(`${indent}state ${id} <<${kind.toLowerCase()}>>`); continue; }
        // Declarado en su bloque antes de cualquier transición: Mermaid lo crea en el ámbito donde aparece por primera vez.
        if (name !== id) out.push(`${indent}state ${q(name)} as ${id}`);
        else if (!children.length) out.push(`${indent}${id}`);
        if (children.length) {
          out.push(`${indent}state ${id} {`);
          if (kind === 'Parallel') {
            // Cada región es un bloque separado por `--` (con su contenido; la región en sí no tiene nombre en Mermaid).
            children.forEach((region, i) => {
              if (i) out.push(`${indent}  --`);
              if (kidsOf(region.id).length) write(region.id, `${indent}  `);
              else out.push(`${indent}  ${mid(region.id)}`);
            });
            writeEdges(n.id, `${indent}  `);
          } else write(n.id, `${indent}  `);
          out.push(`${indent}}`);
        }
      }
      writeEdges(scope, indent);
    };
    function writeEdges(scope: string | undefined, indent: string) {
      for (const e of edges) {
        if (edgeScope.get(e.id) !== scope) continue;
        const a = nodeById.get(e.fromNodeId)!, b = nodeById.get(e.toNodeId)!;
        const from = local(a) === 'Initial' ? '[*]' : mid(a.id), to = isPseudoEnd(b) ? '[*]' : mid(b.id);
        out.push(`${indent}${from} --> ${to}${edgeLabel(e)}`);
      }
    }
    write(undefined, '    ');
    return { text: out.join('\n') + '\n', warnings };
  }

  // Secuencia: participantes por columnas y mensajes por orden (los mismos que dibuja el lienzo).
  if (isSequenceView(view) || view.notationId === 'sequence') return exportSequenceDiagram(ws, view.id, warnings);
  // Clases UML: clases con atributos y operaciones, interfaces, enumeraciones y sus relaciones.
  if (view.notationId === 'uml' || nodes.some(n => elOf(n)?.typeId.startsWith('uml:'))) return exportClassDiagram(ws, nodes, edges, warnings);

  const isEr = view.notationId === 'er' || nodes.some(n => elOf(n)?.typeId.startsWith('er:'));
  if (isEr) return exportErDiagram(ws, nodes, edges, warnings);

  out.push('flowchart TD');
  if (!FLOWCHART_NATIVE.has(view.notationId)) {
    const kind = view.kind === 'grid' ? tr('Capas × etapas') : view.notationId;
    warnings.push(tr('La vista «{view}» ({notation}) no tiene equivalente en Mermaid: se exporta como flowchart (cajas y flechas, sin la semántica de la notación)', { view: view.name, notation: kind }));
  }
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
      out.push(`    subgraph ${mapper(`layer:${layer.id}`, layer.name)}[${q(layer.name)}]`);
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

// ---------------------------------------------------------------- Entidad-relación
/**
 * Cabezas de los tipos del pack `er` (io no depende del pack; réplica de `packages/notations/er`).
 * Sus campos `sourceCard`/`targetCard` son select y sustituyen la cabeza del extremo.
 */
export const ER_RELATION_HEADS: Record<string, { sourceHead: ArrowHead; targetHead: ArrowHead }> = {
  'er:OneToOne': { sourceHead: 'only-one', targetHead: 'only-one' },
  'er:OneToMany': { sourceHead: 'only-one', targetHead: 'one-or-many' },
  'er:ManyToMany': { sourceHead: 'one-or-many', targetHead: 'one-or-many' },
  'er:Inherits': { sourceHead: 'none', targetHead: 'triangle' },
  'er:Has': { sourceHead: 'none', targetHead: 'none' },
};

/** Cabezas efectivas de una arista sin registro: estilo de la arista > cardinalidad ER > tipo (librería o pack conocido). */
export function edgeHeads(ws: Workspace, e: ViewEdge, rel: Relation | undefined, type?: { sourceHead?: ArrowHead; targetHead?: ArrowHead }): { sourceHead: ArrowHead; targetHead: ArrowHead } {
  const er = rel ? ER_RELATION_HEADS[rel.typeId] : undefined;
  const card = (k: 'sourceCard' | 'targetCard') => (er && rel ? cardToHead(rel.fields[k]) : undefined);
  const t = type ?? (rel ? libRelType(ws, rel.typeId) ?? relTypeStyle(rel.typeId) : undefined) ?? er;
  return {
    sourceHead: e.style.sourceHead ?? card('sourceCard') ?? t?.sourceHead ?? 'none',
    targetHead: e.style.targetHead ?? card('targetCard') ?? t?.targetHead ?? 'arrow',
  };
}
function libRelType(ws: Workspace, typeId: string) {
  for (const lib of Object.values(ws.libraries)) { const t = lib.relationTypes.find(r => r.id === typeId); if (t) return t; }
  return undefined;
}

/** Marcador Mermaid de un extremo: `left` es el del origen (`||`, `|o`, `}|`, `}o`), el destino va espejado. */
const ER_LEFT: Partial<Record<ArrowHead, string>> = { one: '||', 'only-one': '||', 'zero-or-one': '|o', many: '}o', 'one-or-many': '}|', 'zero-or-many': '}o' };
const mirror = (m: string) => m.split('').reverse().map(c => (c === '}' ? '{' : c)).join('');
export function erMarker(head: ArrowHead, side: 'left' | 'right'): string {
  const m = ER_LEFT[head] ?? '||';
  return side === 'left' ? m : mirror(m);
}

function exportErDiagram(ws: Workspace, nodes: ViewNode[], edges: ViewEdge[], warnings: string[]): TextExport {
  const out = ['erDiagram'];
  const taken = new Set<string>();
  const names = new Map<string, string>();       // elementId → nombre de entidad Mermaid
  const word = (s: string, fallback: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || fallback;
  const nameOf = (el: Element): string => {
    const cached = names.get(el.id); if (cached) return cached;
    let base = word(el.name, word(el.id, 'Entidad'));
    if (!/^[\p{L}_]/u.test(base)) base = `E_${base}`;
    let n = base, i = 2;
    while (taken.has(n)) n = `${base}_${i++}`;
    taken.add(n); names.set(el.id, n);
    return n;
  };
  const seen = new Set<string>();
  const entities: Element[] = [];
  for (const n of nodes) {
    const el = n.elementId ? ws.elements[n.elementId] : undefined;
    if (!el || seen.has(el.id)) continue;
    seen.add(el.id);
    if (el.typeId === 'er:Attribute') continue;
    if (!el.typeId.startsWith('er:')) warnings.push(tr('"{name}" no es de la notación ER; se exporta como entidad', { name: el.name || el.id }));
    entities.push(el);
  }
  // Atributos sueltos (estilo Chen) unidos con er:Has a su entidad
  const chen = new Map<string, { type: string; name: string; key?: string }[]>();
  const isShown = (id: string | undefined) => !!id && seen.has(id);
  for (const e of edges) {
    const rel = e.relationId ? ws.relations[e.relationId] : undefined;
    if (!rel || rel.typeId !== 'er:Has') continue;
    const a = rel.from.elementId ? ws.elements[rel.from.elementId] : undefined, b = rel.to.elementId ? ws.elements[rel.to.elementId] : undefined;
    const [ent, attr] = a?.typeId === 'er:Attribute' ? [b, a] : [a, b];
    if (!ent || attr?.typeId !== 'er:Attribute') continue;
    const key = typeof attr.fields['key'] === 'string' ? ({ pk: 'PK', fk: 'FK', unique: 'UK' } as Record<string, string>)[attr.fields['key'] as string] : undefined;
    const list = chen.get(ent.id) ?? [];
    list.push({ type: String(attr.fields['type'] ?? '') || 'string', name: attr.name || attr.id, key });
    chen.set(ent.id, list);
  }
  for (const el of entities) {
    const pk = new Set(Array.isArray(el.fields['pk']) ? (el.fields['pk'] as unknown[]).map(String) : []);
    const attrs: { type: string; name: string; key?: string }[] = [];
    const kv = el.fields['attributes'];
    if (Array.isArray(kv)) for (const a of kv as { key?: unknown; value?: unknown }[]) {
      const name = String(a?.key ?? '').trim(); if (!name) continue;
      attrs.push({ type: String(a?.value ?? '').trim() || 'string', name, key: pk.has(name) ? 'PK' : undefined });
    }
    attrs.push(...(chen.get(el.id) ?? []));
    const id = nameOf(el);
    if (!attrs.length) { out.push(`    ${id}`); continue; }
    out.push(`    ${id} {`);
    for (const a of attrs) out.push(`        ${a.type.replace(/[^\p{L}\p{N}_()[\]-]+/gu, '_').replace(/^(?=[^\p{L}])/u, 't')} ${word(a.name, 'attr')}${a.key ? ` ${a.key}` : ''}`);
    out.push('    }');
  }
  for (const e of edges) {
    const rel = e.relationId ? ws.relations[e.relationId] : undefined;
    if (rel?.typeId === 'er:Has' && [rel.from.elementId, rel.to.elementId].some(id => id && ws.elements[id]?.typeId === 'er:Attribute')) continue;
    const a = nodes.find(n => n.id === e.fromNodeId)?.elementId, b = nodes.find(n => n.id === e.toNodeId)?.elementId;
    if (!isShown(a) || !isShown(b) || ws.elements[a!]!.typeId === 'er:Attribute' || ws.elements[b!]!.typeId === 'er:Attribute') continue;
    const { sourceHead, targetHead } = edgeHeads(ws, e, rel);
    if (!ER_LEFT[sourceHead] && !ER_LEFT[targetHead]) warnings.push(tr('La arista {id}{type} no tiene cardinalidad; se exporta como ||--||', { id: e.id, type: rel ? ` (${rel.typeId})` : '' }));
    const line = e.style.line ?? (rel ? libRelType(ws, rel.typeId)?.line : undefined) ?? 'solid';
    const label = e.label ?? rel?.name ?? '';
    out.push(`    ${nameOf(ws.elements[a!]!)} ${erMarker(sourceHead, 'left')}${line === 'solid' ? '--' : '..'}${erMarker(targetHead, 'right')} ${nameOf(ws.elements[b!]!)} : ${q(label)}`);
  }
  return { text: out.join('\n') + '\n', warnings };
}

function relTypeStyle(typeId: string) {
  for (const pack of [FREEFORM_PACK, ARCHIMATE_PACK, C4_PACK, STATECHART_PACK]) { const t = pack.relationTypes.find(r => r.id === typeId); if (t) return t; }
  return undefined;
}

// ---------------------------------------------------------------- Secuencia
/** Texto seguro en una línea de Mermaid (`;` separa sentencias y `#` abre entidades). */
const mtext = (s: string) => s.replace(/\r?\n/g, ' ').replace(/#/g, '#35;').replace(/;/g, '#59;').trim();
const SEQ_ARROW: Record<MessageKind, string> = { sync: '->>', async: '-)', return: '-->>', create: '->>', destroy: '-x' };
const FRAGMENT_KINDS = new Set(['alt', 'opt', 'loop', 'par', 'break', 'critical']);

/**
 * `sequenceDiagram`: participantes (`actor` o `participant`) en el orden de las columnas, mensajes en el orden del lienzo
 * (flecha según la clase: `->>` síncrono, `-)` asíncrono, `-->>` respuesta, `-x` destrucción), activaciones como
 * `activate`/`deactivate` y fragmentos (`alt`, `loop`…) como bloques alrededor de los mensajes que encierran.
 */
function exportSequenceDiagram(ws: Workspace, viewId: string, warnings: string[]): TextExport {
  const store = new MemoryStore(ws);
  const geo = sequenceGeometry(store, viewId);
  const mapper = idMapper();
  const out = ['sequenceDiagram'];
  const pid = (n: ViewNode) => mapper(n.elementId ?? n.id, n.elementId ? ws.elements[n.elementId]?.name : n.text);
  for (const l of geo.lifelines) {
    const el = ws.elements[l.node.elementId!]!;
    const type = typeof el.fields['type'] === 'string' && el.fields['type'] ? `: ${el.fields['type']}` : '';
    const label = mtext(`${l.node.text ?? el.name}${type}`) || pid(l.node);
    const kw = el.fields['kind'] === 'actor' ? 'actor' : 'participant';
    out.push(`    ${kw} ${pid(l.node)}${label !== pid(l.node) ? ` as ${label}` : ''}`);
  }
  // Eventos por altura: abrir fragmento/activación antes de los mensajes a esa altura; cerrarlos después.
  type Ev = { y: number; rank: number; line: string };
  const ev: Ev[] = [];
  for (const m of geo.messages) {
    if (m.kind === 'create') warnings.push(tr('El mensaje de creación «{text}» se exporta como síncrono (Mermaid exige declarar el participante en ese punto)', { text: m.text || String(m.order ?? '') }));
    ev.push({ y: m.y, rank: 2, line: `${pid(m.from)}${SEQ_ARROW[m.kind]}${pid(m.to)}: ${mtext(m.text)}` });
  }
  const nodes = Object.values(ws.nodes).filter(n => n.viewId === viewId);
  for (const n of nodes) {
    const el = n.elementId ? ws.elements[n.elementId] : undefined;
    if (el?.typeId === 'sequence:Activation') {
      const life = n.parentNodeId ? ws.nodes[n.parentNodeId] : undefined;
      if (!life?.elementId || ws.elements[life.elementId]?.typeId !== 'sequence:Lifeline') continue;
      ev.push({ y: n.y, rank: 1, line: `activate ${pid(life)}` }, { y: n.y + n.h, rank: 3, line: `deactivate ${pid(life)}` });
    } else if (el?.typeId === 'sequence:Fragment') {
      const kind = String(el.fields['kind'] ?? 'alt');
      const cond = typeof el.fields['condition'] === 'string' ? el.fields['condition'].replace(/^\[|\]$/g, '') : '';
      if (!FRAGMENT_KINDS.has(kind)) { warnings.push(tr('El fragmento «{kind}» no existe en Mermaid; se omite (sus mensajes sí se exportan)', { kind })); continue; }
      ev.push({ y: n.y, rank: 0, line: `${kind}${cond || el.name !== kind ? ` ${mtext(cond || el.name)}` : ''}` }, { y: n.y + n.h, rank: 4, line: 'end' });
    } else if (el?.typeId === 'sequence:Note') {
      const text = String(el.fields['text'] ?? el.name ?? '');
      const near = [...geo.lifelines].sort((a, b) => Math.abs(a.x + a.w / 2 - (n.x + n.w / 2)) - Math.abs(b.x + b.w / 2 - (n.x + n.w / 2)))[0];
      if (near && text) ev.push({ y: n.y, rank: 1, line: `Note over ${pid(near.node)}: ${mtext(text)}` });
    } else if (el && el.typeId !== 'sequence:Lifeline') warnings.push(tr('«{name}» no es una pieza de secuencia y no se exporta', { name: el.name || el.id }));
  }
  ev.sort((a, b) => a.y - b.y || a.rank - b.rank);
  let depth = 1;
  for (const e of ev) {
    if (e.line === 'end') depth = Math.max(1, depth - 1);
    out.push(`${'    '.repeat(depth)}${e.line}`);
    if (e.rank === 0) depth++;
  }
  return { text: out.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------- Clases UML
/** Conector Mermaid de cada relación UML (origen a la izquierda). */
const UML_CONNECTOR: Record<string, string> = {
  'uml:Generalization': '--|>', 'uml:Realization': '..|>', 'uml:Composition': '*--', 'uml:Aggregation': 'o--', 'uml:Dependency': '..>', 'uml:Association': '--',
};
/** Miembro UML del editor (`+ crear(p: Pedido): void`, `- nombre: String`) en la sintaxis de Mermaid (`+crear(p: Pedido) void`). */
export function umlMember(text: string): string {
  let t = text.trim().replace(/^([-+#~])\s+/, '$1');
  t = t.replace(/^(\S*\([^)]*\))\s*:\s*(.+)$/, '$1 $2');
  return mtext(t);
}

/**
 * `classDiagram`: clases (atributos y operaciones), interfaces (`<<interface>>`), enumeraciones (`<<enumeration>>` y sus
 * literales), clases abstractas (`<<abstract>>`), paquetes como `namespace` y las relaciones con multiplicidades.
 */
function exportClassDiagram(ws: Workspace, nodes: ViewNode[], edges: ViewEdge[], warnings: string[]): TextExport {
  const mapper = idMapper();
  const out = ['classDiagram'];
  const seen = new Set<string>();
  const cid = (el: Element) => mapper(el.id, el.name);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x)).filter(x => x.trim()) : []);
  const writeClass = (el: Element, indent: string) => {
    if (seen.has(el.id)) return;
    seen.add(el.id);
    const id = cid(el);
    const head = `${indent}class ${id}${el.name && el.name !== id ? `[${q(el.name)}]` : ''}`;
    const body: string[] = [];
    const stereo = typeof el.fields['stereotype'] === 'string' ? el.fields['stereotype'].trim() : '';
    if (el.typeId === 'uml:Interface') body.push(`<<${stereo || 'interface'}>>`);
    else if (el.typeId === 'uml:Enum') body.push(`<<${stereo || 'enumeration'}>>`);
    else if (el.fields['abstract'] === true) body.push('<<abstract>>');
    else if (stereo) body.push(`<<${mtext(stereo)}>>`);
    for (const a of list(el.fields['attributes'])) body.push(umlMember(a));
    for (const o of list(el.fields['operations'])) body.push(umlMember(o));
    for (const v of list(el.fields['values'])) body.push(mtext(v));
    if (!body.length) { out.push(head); return; }
    out.push(`${head} {`);
    for (const b of body) out.push(`${indent}  ${b}`);
    out.push(`${indent}}`);
  };
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) {
    const el = n.elementId ? ws.elements[n.elementId] : undefined;
    if (!el || el.typeId !== 'uml:Package') continue;
    const kids = nodes.filter(k => k.parentNodeId === n.id).map(k => (k.elementId ? ws.elements[k.elementId] : undefined)).filter((e): e is Element => !!e && e.typeId !== 'uml:Package');
    seen.add(el.id);
    if (!kids.length) continue;
    out.push(`    namespace ${cid(el)} {`);
    for (const k of kids) writeClass(k, '        ');
    out.push('    }');
  }
  for (const n of nodes) {
    const el = n.elementId ? ws.elements[n.elementId] : undefined;
    if (!el || seen.has(el.id)) continue;
    if (!el.typeId.startsWith('uml:')) warnings.push(tr('«{name}» no es UML; se exporta como clase', { name: el.name || el.id }));
    writeClass(el, '    ');
  }
  for (const e of edges) {
    const rel = e.relationId ? ws.relations[e.relationId] : undefined;
    const a = byId.get(e.fromNodeId)?.elementId, b = byId.get(e.toNodeId)?.elementId;
    if (!a || !b || !ws.elements[a] || !ws.elements[b]) continue;
    const ea = ws.elements[a]!, eb = ws.elements[b]!;
    if (ea.typeId === 'uml:Package' || eb.typeId === 'uml:Package') { warnings.push(tr('La relación con el paquete «{name}» no tiene equivalente en Mermaid; se omite', { name: (ea.typeId === 'uml:Package' ? ea : eb).name })); continue; }
    const f = rel?.fields ?? {};
    const card = (k: string) => (typeof f[k] === 'string' ? (f[k] as string).trim() : '');
    let [l, r, lc, rc] = [cid(ea), cid(eb), card('sourceCard'), card('targetCard')];
    let conn = UML_CONNECTOR[rel?.typeId ?? ''] ?? '--';
    if (conn === '--') {
      const nav = f['navigable'];
      if (nav === 'target') conn = '-->';
      else if (nav === 'both') conn = '<-->';
      else if (nav === 'source') { conn = '-->'; [l, r, lc, rc] = [r, l, rc, lc]; }
    }
    const line = `${l}${lc ? ` ${q(lc)}` : ''} ${conn} ${rc ? `${q(rc)} ` : ''}${r}`;
    const label = e.label ?? rel?.name ?? '';
    out.push(`    ${line}${label ? ` : ${mtext(label)}` : ''}`);
  }
  return { text: out.join('\n') + '\n', warnings };
}

// ---------------------------------------------------------------- Importador
/**
 * Figuras de flowchart sin tipo en el pack libre: van a una librería «Mermaid» del espacio importado, para que la ida y
 * vuelta las conserve (antes volvían como cajas redondeadas).
 */
const MERMAID_LIB = 'lib_mermaid', MERMAID_HEXAGON = `lib:${MERMAID_LIB}:hexagon`, MERMAID_PARALLELOGRAM = `lib:${MERMAID_LIB}:parallelogram`;
const MERMAID_LIB_TYPES: ElementType[] = [
  { id: MERMAID_HEXAGON, name: 'Hexágono', category: 'Mermaid', shape: 'hexagon', color: '#ffe0b2', icon: '⬡', fields: [] },
  { id: MERMAID_PARALLELOGRAM, name: 'Paralelogramo', category: 'Mermaid', shape: 'parallelogram', color: '#e1d5e7', icon: '▱', fields: [] },
];

const OPENERS: [string, string, string][] = [
  ['(((', ')))', 'freeform:ellipse'], ['([', '])', 'freeform:ellipse'], ['[[', ']]', 'freeform:box'], ['[(', ')]', 'freeform:cylinder'],
  ['[/', '/]', MERMAID_PARALLELOGRAM], ['[\\', '\\]', MERMAID_PARALLELOGRAM], ['((', '))', 'freeform:ellipse'], ['{{', '}}', MERMAID_HEXAGON],
  ['{', '}', 'freeform:diamond'], ['(', ')', 'freeform:box'], ['[', ']', 'freeform:box'], ['>', ']', 'freeform:note'],
];
const LINK = /^\s*(<?)(-{2,}|={2,}|-\.+-?)(?:\s*([^-=.<>|]+?)\s*(-{2,}|={2,}|\.-+))?([>xo])?(?:\s*\|([^|]*)\|)?\s*/;
const unquote = (s: string) => { const t = s.trim(); return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t; };

export function importMermaid(text: string): MermaidImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const lines = text.split(/\r?\n/).map(l => l.replace(/%%.*$/, '').trim()).filter(Boolean);
  const header = lines.shift() ?? '';
  const done = (w: Workspace): MermaidImport => { w.meta.currentViewId = MERMAID_VIEW_ID; return { workspace: parseWorkspace(w), warnings }; };
  if (/^sequenceDiagram\b/.test(header)) return done(importSequenceDiagram(lines, warn));
  if (/^classDiagram(-v2)?\b/.test(header)) return done(importClassDiagram(lines, warn));
  const m = /^(flowchart|graph|stateDiagram(?:-v2)?)\b\s*(TD|TB|LR|RL|BT)?/.exec(header);
  if (!m) {
    const kind = /^[\w-]+/.exec(header)?.[0];
    if (kind && /^(erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4\w+|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban)$/.test(kind))
      throw new ImportError('Los diagramas Mermaid «{kind}» no se pueden importar; se admiten flowchart/graph, stateDiagram, sequenceDiagram y classDiagram.', { kind });
    throw new ImportError('El texto no parece un diagrama Mermaid: la primera línea debería ser flowchart, graph, stateDiagram-v2, sequenceDiagram o classDiagram (es «{line}»).', { line: header.slice(0, 60) });
  }
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
  const closeScope = () => { if (stack.length > 1) stack.pop(); else warn(tr('`end` sin `subgraph` abierto')); };
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
      if ((mm = /^([\w.-]+)$/.exec(raw))) { ensure(mm[1]!, 'statechart:State'); continue; }
      if ((mm = /^([\w.-]+)\s*:\s*(.*)$/.exec(raw))) { const el = ensure(mm[1]!, 'statechart:State'); if (!el.doc) el.doc = mm[2]!.trim(); continue; }
      warn(tr('Línea no reconocida: {line}', { line: raw }));
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
  if (stack.length > 1) warn(tr('Faltan `end` de cierre; se cierran al final'));

  // ---- figuras sin tipo en el pack libre: librería «Mermaid»
  const libTypes = MERMAID_LIB_TYPES.filter(t => Object.values(ws.elements).some(e => e.typeId === t.id));
  if (libTypes.length) {
    ws.libraries[MERMAID_LIB] = { id: MERMAID_LIB, name: 'Mermaid', description: '', elementTypes: libTypes, relationTypes: [], portTypes: [], notations: ['freeform'] };
    for (const e of Object.values(ws.elements)) if (e.typeId.startsWith(`lib:${MERMAID_LIB}:`)) e.libraryId = MERMAID_LIB;
  }

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

// ---------------------------------------------------------------- Importar sequenceDiagram / classDiagram
const SEQ_LINK = /^([^\s;:+-][^;:]*?)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([^;:]+?)\s*:\s*(.*)$/;
const FRAGMENT_OPEN = /^(alt|opt|loop|par|critical|break)\b\s*(.*)$/;

/** `sequenceDiagram` → líneas de vida en columnas, mensajes con `order` y altura, activaciones, fragmentos y notas. */
function importSequenceDiagram(lines: string[], warn: (s: string) => void): Workspace {
  const ws = emptyWs('Diagrama');
  ws.views[MERMAID_VIEW_ID] = { id: MERMAID_VIEW_ID, kind: 'sequence', notationId: 'sequence', name: ws.meta.name, doc: '', style: {}, props: {} };
  const lifes = new Map<string, ViewNode>();
  const life = (raw: string, label?: string, kind = 'participant'): ViewNode => {
    const id = raw.trim();
    let n = lifes.get(id);
    if (!n) {
      const el = makeEl(`l:${id}`, 'sequence:Lifeline', label ?? id); el.fields = { kind };
      ws.elements[el.id] = el;
      n = { id: `n:${el.id}`, viewId: MERMAID_VIEW_ID, elementId: el.id, x: 40 + lifes.size * 200, y: 0, w: 140, h: 60, style: {} };
      ws.nodes[n.id] = n; lifes.set(id, n);
    } else if (label !== undefined) { ws.elements[n.elementId!]!.name = label; ws.elements[n.elementId!]!.fields['kind'] = kind; }
    return n;
  };
  let y = 60, order = 0, k = 0;
  const open = new Map<string, number[]>();                         // línea de vida → alturas de `activate` abiertos
  const frames: { kind: string; cond: string; y: number; lifes: Set<string> }[] = [];
  const activate = (id: string) => { const l = open.get(id) ?? []; l.push(y + 10); open.set(id, l); };
  const deactivate = (id: string) => {
    const start = open.get(id)?.pop(); if (start === undefined) return;
    const parent = life(id);
    const el = makeEl(`act${++k}`, 'sequence:Activation', ''); ws.elements[el.id] = el;
    const node: ViewNode = { id: `n:${el.id}`, viewId: MERMAID_VIEW_ID, elementId: el.id, parentNodeId: parent.id, x: 64, y: start - 20, w: 12, h: Math.max(30, y - start + 30), style: {} };
    ws.nodes[node.id] = node;
  };
  for (const raw of lines) {
    let m: RegExpExecArray | null;
    if (/^(autonumber|title|accTitle|accDescr|box\b|rect\b|links?\b|properties\b|details\b)/.test(raw)) { if (/^(box|rect)\b/.test(raw)) frames.push({ kind: '', cond: '', y, lifes: new Set() }); continue; }
    if ((m = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/.exec(raw))) { life(m[2]!, (m[3] ?? m[2])!.trim(), m[1] === 'actor' ? 'actor' : 'participant'); continue; }
    if ((m = /^create\s+(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/.exec(raw))) { life(m[2]!, (m[3] ?? m[2])!.trim(), m[1] === 'actor' ? 'actor' : 'participant'); continue; }
    if (/^destroy\s+/.test(raw)) continue;
    if ((m = /^activate\s+(.+)$/.exec(raw))) { life(m[1]!); activate(m[1]!.trim()); continue; }
    if ((m = /^deactivate\s+(.+)$/.exec(raw))) { deactivate(m[1]!.trim()); continue; }
    if ((m = FRAGMENT_OPEN.exec(raw))) { y += 20; frames.push({ kind: m[1]!, cond: m[2]!.trim(), y, lifes: new Set() }); continue; }
    if (/^(else|and|option)\b/.test(raw)) { y += 20; continue; }
    if (raw === 'end') {
      const f = frames.pop(); if (!f) { warn(tr('`end` sin bloque abierto')); continue; }
      if (!f.kind) continue;
      y += 20;
      const xs = [...f.lifes].map(id => lifes.get(id)!).filter(Boolean);
      const x0 = xs.length ? Math.min(...xs.map(n => n.x)) - 10 : 20, x1 = xs.length ? Math.max(...xs.map(n => n.x + n.w)) + 10 : 300;
      const el = makeEl(`frag${++k}`, 'sequence:Fragment', f.kind); el.fields = { kind: f.kind, condition: f.cond ? `[${f.cond}]` : '' };
      ws.elements[el.id] = el;
      ws.nodes[`n:${el.id}`] = { id: `n:${el.id}`, viewId: MERMAID_VIEW_ID, elementId: el.id, x: x0, y: f.y - 10, w: x1 - x0, h: y - f.y, style: {} };
      for (const outer of frames) for (const id of f.lifes) outer.lifes.add(id);
      continue;
    }
    if ((m = /^note\s+(?:over|left of|right of)\s+([^:]+):\s*(.*)$/i.exec(raw))) {
      const who = m[1]!.split(',').map(s => life(s));
      y += 30;
      const el = makeEl(`note${++k}`, 'sequence:Note', m[2]!.replace(/<br\s*\/?>/g, '\n')); el.fields = { text: el.name };
      ws.elements[el.id] = el;
      const x0 = Math.min(...who.map(n => n.x)), x1 = Math.max(...who.map(n => n.x + n.w));
      ws.nodes[`n:${el.id}`] = { id: `n:${el.id}`, viewId: MERMAID_VIEW_ID, elementId: el.id, x: x0, y: y - 15, w: Math.max(120, x1 - x0), h: 30, style: {} };
      y += 10;
      continue;
    }
    if ((m = SEQ_LINK.exec(raw))) {
      const [, a, arrow, mark, b, text] = m;
      const from = life(a!), to = life(b!);
      y += 40;
      const kind: MessageKind = arrow!.endsWith(')') ? 'async' : arrow!.endsWith('x') ? 'destroy' : arrow!.startsWith('--') ? 'return' : 'sync';
      const rel = makeRel(`m${++order}`, kind === 'return' ? 'sequence:Return' : 'sequence:Message', { elementId: from.elementId! }, { elementId: to.elementId! });
      rel.fields = kind === 'return' ? { order, text: unquote(text!) } : { kind, order, text: unquote(text!) };
      ws.relations[rel.id] = rel;
      ws.edges[`e:${rel.id}`] = { id: `e:${rel.id}`, viewId: MERMAID_VIEW_ID, relationId: rel.id, fromNodeId: from.id, toNodeId: to.id, bendpoints: [{ x: 0, y }], style: {} };
      for (const f of frames) { f.lifes.add(a!.trim()); f.lifes.add(b!.trim()); }
      if (mark === '+') activate(b!.trim()); else if (mark === '-') deactivate(a!.trim());
      continue;
    }
    warn(tr('Línea no reconocida: {line}', { line: raw }));
  }
  for (const [id, starts] of open) while (starts.length) deactivate(id);
  if (frames.length) warn(tr('Faltan `end` de cierre; se cierran al final'));
  return ws;
}

/** Miembro de Mermaid (`+String nombre`, `+nombre : String`, `+comer(x) Tipo`) en la forma del editor (`+ nombre: String`). */
export function mermaidMember(raw: string): string {
  const t = raw.trim().replace(/[$*]$/, '');
  const vis = /^[-+#~]/.test(t) ? t[0]! : '';
  const rest = t.slice(vis.length).trim();
  const p = vis ? `${vis} ` : '';
  let m: RegExpExecArray | null;
  if ((m = /^(.+?\))\s*:?\s*(\S.*)?$/.exec(rest)) && rest.includes('(')) return `${p}${m[1]}${m[2] ? `: ${m[2].replace(/[$*]$/, '')}` : ''}`;
  if ((m = /^([\w.]+)\s*:\s*(.+)$/.exec(rest))) return `${p}${m[1]}: ${m[2]}`;
  if ((m = /^([\w.<>\[\],~]+)\s+(\w+)$/.exec(rest))) return `${p}${m[2]}: ${m[1]!.replace(/~([^~]+)~/g, '<$1>')}`;
  return `${p}${rest}`;
}

const CLASS_REL = /^([\w.-]+)\s*(?:"([^"]*)")?\s*(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<-->|<--|-->|<\.\.|\.\.>|--|\.\.)\s*(?:"([^"]*)")?\s*([\w.-]+)\s*(?::\s*(.*))?$/;

/** `classDiagram` → clases, interfaces y enumeraciones UML con sus miembros, `namespace` como paquete y relaciones. */
function importClassDiagram(lines: string[], warn: (s: string) => void): Workspace {
  const ws = emptyWs('Diagrama');
  ws.views[MERMAID_VIEW_ID] = { id: MERMAID_VIEW_ID, kind: 'freeform', notationId: 'uml', name: ws.meta.name, doc: '', style: {}, props: {} };
  const classes = new Map<string, Element>();
  const nsOf = new Map<string, string>();
  const cls = (raw: string, label?: string): Element => {
    const id = raw.replace(/~[^~]*~$/, '').trim();
    let el = classes.get(id);
    if (!el) { el = makeEl(`c:${id}`, 'uml:Class', label ?? id); el.fields = { attributes: [], operations: [] }; ws.elements[el.id] = el; classes.set(id, el); if (ns) nsOf.set(id, ns); }
    else if (label) el.name = label;
    return el;
  };
  const annotate = (el: Element, a: string) => {
    const s = a.trim().toLowerCase();
    if (s === 'interface') { el.typeId = 'uml:Interface'; el.fields = { stereotype: 'interface', operations: el.fields['operations'] ?? [] }; }
    else if (s === 'enumeration' || s === 'enum') { el.typeId = 'uml:Enum'; el.fields = { values: [...(el.fields['attributes'] as string[] ?? [])] }; }
    else if (s === 'abstract') el.fields['abstract'] = true;
    else el.fields['stereotype'] = a.trim();
  };
  const member = (el: Element, raw: string) => {
    const line = raw.trim(); if (!line) return;
    const an = /^<<(.+)>>$/.exec(line); if (an) { annotate(el, an[1]!); return; }
    if (el.typeId === 'uml:Enum') { (el.fields['values'] as string[]).push(line); return; }
    const key = line.includes('(') ? 'operations' : 'attributes';
    if (el.typeId === 'uml:Interface' && key === 'attributes') return;
    const list = Array.isArray(el.fields[key]) ? (el.fields[key] as string[]) : ((el.fields[key] = []) as string[]);
    list.push(mermaidMember(line));
  };
  let ns: string | undefined, open: Element | undefined;
  const namespaces: string[] = [];
  let r = 0;
  for (const raw of lines) {
    let m: RegExpExecArray | null;
    if (open) { if (raw === '}') open = undefined; else member(open, raw); continue; }
    if (/^(direction|note|style|classDef|cssClass|click|callback|link|title|accTitle|accDescr)\b/.test(raw)) continue;
    if ((m = /^namespace\s+([\w.-]+)\s*\{$/.exec(raw))) { ns = m[1]!; namespaces.push(ns); continue; }
    if (raw === '}') { ns = undefined; continue; }
    if ((m = /^class\s+([\w.-]+(?:~[^~]*~)?)\s*(?:\["([^"]*)"\])?\s*(?::::\s*\w+)?\s*(\{)?\s*(\})?$/.exec(raw))) { const el = cls(m[1]!, m[2]); if (m[3] && !m[4]) open = el; continue; }
    if ((m = /^<<(.+)>>\s+([\w.-]+)$/.exec(raw))) { annotate(cls(m[2]!), m[1]!); continue; }
    if ((m = CLASS_REL.exec(raw))) {
      const [, a, ca, op, cb, b, label] = m;
      let from = cls(a!), to = cls(b!), fc = ca, tc = cb;
      const flip = () => { [from, to] = [to, from]; [fc, tc] = [tc, fc]; };
      let typeId = 'uml:Association'; const fields: Record<string, unknown> = {};
      switch (op) {
        case '<|--': flip(); typeId = 'uml:Generalization'; break;
        case '--|>': typeId = 'uml:Generalization'; break;
        case '<|..': flip(); typeId = 'uml:Realization'; break;
        case '..|>': typeId = 'uml:Realization'; break;
        case '*--': typeId = 'uml:Composition'; break;
        case '--*': flip(); typeId = 'uml:Composition'; break;
        case 'o--': typeId = 'uml:Aggregation'; break;
        case '--o': flip(); typeId = 'uml:Aggregation'; break;
        case '-->': fields.navigable = 'target'; break;
        case '<--': flip(); fields.navigable = 'target'; break;
        case '<-->': fields.navigable = 'both'; break;
        case '..>': typeId = 'uml:Dependency'; break;
        case '<..': flip(); typeId = 'uml:Dependency'; break;
        case '..': typeId = 'uml:Dependency'; break;
      }
      if (fc) fields.sourceCard = fc;
      if (tc) fields.targetCard = tc;
      const rel = makeRel(`r${++r}`, typeId, { elementId: from.id }, { elementId: to.id });
      rel.name = label ? unquote(label) : ''; rel.fields = fields;
      ws.relations[rel.id] = rel;
      continue;
    }
    if ((m = /^([\w.-]+)\s*:\s*(.+)$/.exec(raw))) { member(cls(m[1]!), m[2]!); continue; }
    warn(tr('Línea no reconocida: {line}', { line: raw }));
  }
  // Layout: rejilla de 3 columnas (dentro de cada paquete y en la raíz); alto según el número de miembros.
  const W = 220, GAP = 60;
  const height = (el: Element) => 50 + 18 * ((el.fields['attributes'] as string[] | undefined)?.length ?? 0) + 18 * ((el.fields['operations'] as string[] | undefined)?.length ?? 0) + 18 * ((el.fields['values'] as string[] | undefined)?.length ?? 0) + (el.typeId === 'uml:Class' ? 0 : 14);
  const place = (els: Element[], ox: number, oy: number, parentNodeId?: string): { w: number; h: number } => {
    let rowY = 0, rowH = 0, maxW = 0;
    els.forEach((el, i) => {
      const col = i % 3; if (col === 0 && i) { rowY += rowH + GAP; rowH = 0; }
      const h = height(el);
      ws.nodes[`n:${el.id}`] = { id: `n:${el.id}`, viewId: MERMAID_VIEW_ID, elementId: el.id, x: ox + col * (W + GAP), y: oy + rowY, w: W, h, style: {}, ...(parentNodeId ? { parentNodeId } : {}) };
      rowH = Math.max(rowH, h); maxW = Math.max(maxW, (col + 1) * (W + GAP) - GAP);
    });
    return { w: maxW, h: rowY + rowH };
  };
  let y = 0;
  for (const name of namespaces) {
    const pkg = makeEl(`ns:${name}`, 'uml:Package', name); pkg.fields = { namespace: name }; ws.elements[pkg.id] = pkg;
    const node: ViewNode = { id: `n:${pkg.id}`, viewId: MERMAID_VIEW_ID, elementId: pkg.id, x: 0, y, w: 0, h: 0, style: {} };
    ws.nodes[node.id] = node;
    const size = place([...classes].filter(([id]) => nsOf.get(id) === name).map(([, el]) => el), 20, 40, node.id);
    node.w = Math.max(240, size.w + 40); node.h = size.h + 60;
    y += node.h + GAP;
  }
  place([...classes].filter(([id]) => !nsOf.has(id)).map(([, el]) => el), 0, y);
  for (const rel of Object.values(ws.relations)) {
    const edge: ViewEdge = { id: `e:${rel.id}`, viewId: MERMAID_VIEW_ID, relationId: rel.id, fromNodeId: `n:${rel.from.elementId}`, toNodeId: `n:${rel.to.elementId}`, bendpoints: [], style: {} };
    if (rel.name) edge.label = rel.name;
    ws.edges[edge.id] = edge;
  }
  return ws;
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
      if (!node) { warn(tr('No se entiende: "{text}"', { text: rest })); return; }
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
    if (!l) { warn(tr('No se entiende: "{text}"', { text: rest })); return; }
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
