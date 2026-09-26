/**
 * Espacio de trabajo grande y determinista para medir rendimiento (objetivo del plan: 1.000
 * elementos × 50 vistas fluido). El generador usa un PRNG con semilla, así que la misma
 * configuración produce siempre el mismo workspace (ids incluidos): los benchmarks y las pruebas en
 * navegador comparan números sobre datos idénticos.
 *
 * Con `pack` (o `registry`) las relaciones respetan la matriz de validez de la notación y se anidan
 * nodos con la relación de anidamiento del pack; sin pack se usan tipos genéricos
 * (`<notation>:Box`, `<notation>:Link`) sin restricciones.
 */
import { emptyWorkspace, type Element, type Relation, type View, type ViewNode, type ViewEdge, type Workspace } from './model';
import type { NotationPack, NotationRegistry } from './notation';

export interface LargeWorkspaceOptions {
  /** Elementos del modelo. */
  elements?: number;
  /** Vistas. */
  views?: number;
  /** Nodos por vista (contenedores y sus hijos incluidos). */
  perView?: number;
  /** Notación de elementos y vistas. */
  notation?: string;
  /** Semilla del PRNG. */
  seed?: number;
  /** Pack de la notación: tipos, matriz de validez y anidamiento. */
  pack?: NotationPack;
  /** Alternativa a `pack`: registro del que sacar el pack de `notation`. */
  registry?: NotationRegistry;
  /** Relaciones por elemento (aprox.), además de las de anidamiento. */
  relationsPerElement?: number;
  /** Fracción de nodos que son contenedores con hijos anidados. */
  nestedFraction?: number;
  /** Nombre del espacio. */
  name?: string;
}

/** PRNG mulberry32: rápido, determinista y suficiente para datos de prueba. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const local = (typeId: string): string => { const i = typeId.indexOf(':'); return i < 0 ? typeId : typeId.slice(i + 1); };

/** Espacio grande determinista. Cada elemento aparece al menos en una vista; las vistas tienen nodos anidados y aristas de relaciones válidas. */
export function generateLargeWorkspace(opts: LargeWorkspaceOptions = {}): Workspace {
  const nElements = opts.elements ?? 1000;
  const nViews = opts.views ?? 50;
  const perView = opts.perView ?? 60;
  const notation = opts.notation ?? 'archimate';
  const rnd = seededRandom(opts.seed ?? 42);
  const pack = opts.pack ?? opts.registry?.pack(notation);
  const relationsPerElement = opts.relationsPerElement ?? 1.5;
  const nestedFraction = opts.nestedFraction ?? 0.1;

  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const int = (n: number) => Math.floor(rnd() * n);

  // ---- tipos
  const elementTypes = (pack?.elementTypes ?? []).filter(t => !t.abstract && local(t.id) !== 'Junction');
  const typeIds = elementTypes.length ? elementTypes.map(t => t.id) : [`${notation}:Box`, `${notation}:Actor`, `${notation}:Service`];
  const typeName = new Map(elementTypes.map(t => [t.id, t.name]));
  const containerTypes = elementTypes.filter(t => t.container).map(t => t.id);
  const relationTypeIds = (pack?.relationTypes ?? []).map(r => r.id);
  const validity = pack?.validity;
  const allowed = (a: string, b: string): string[] => {
    if (!validity) return relationTypeIds.length ? relationTypeIds : [`${notation}:Link`];
    const row = validity[local(a)] ?? validity[a];
    return row?.[local(b)] ?? row?.[b] ?? [];
  };
  const nestingRelation = (parent: string, child: string): string | undefined => {
    const list = allowed(parent, child);
    const prefs = [...(pack?.nesting ?? []).filter(r => (r.parent === '*' || r.parent === local(parent)) && (r.child === '*' || r.child === local(child))).flatMap(r => r.relationTypes)];
    if (pack?.defaultNestingRelation) prefs.push(pack.defaultNestingRelation);
    return prefs.find(p => list.includes(p)) ?? list[0];
  };

  const ws = emptyWorkspace(opts.name ?? `Prueba ${nElements} × ${nViews}`);
  ws.meta.createdAt = '2026-01-01T00:00:00.000Z';

  // ---- elementos
  const elements: Element[] = [];
  for (let i = 0; i < nElements; i++) {
    const typeId = pick(typeIds);
    const e: Element = {
      id: `el_b${i}`, typeId, name: `${typeName.get(typeId) ?? local(typeId)} ${i}`, doc: i % 7 === 0 ? `Elemento ${i} generado para pruebas de rendimiento.` : '',
      fields: {}, ports: [], profiles: [], props: i % 5 === 0 ? { owner: `equipo-${i % 13}` } : {}, features: {}, tags: i % 3 === 0 ? [`tag-${i % 11}`] : [],
    };
    ws.elements[e.id] = e; elements.push(e);
  }
  const byType = new Map<string, Element[]>();
  for (const e of elements) byType.set(e.typeId, [...(byType.get(e.typeId) ?? []), e]);
  const containers = containerTypes.flatMap(t => byType.get(t) ?? []);

  // ---- relaciones: índice por pareja para no duplicar
  const relations: Relation[] = [];
  const pairKey = (a: string, b: string, t: string) => `${a}|${b}|${t}`;
  const seenPairs = new Set<string>();
  const relOf = new Map<string, Relation[]>(); // from → relaciones
  let relSeq = 0;
  const addRelation = (a: Element, b: Element, typeId: string): Relation | undefined => {
    if (a.id === b.id) return undefined;
    const k = pairKey(a.id, b.id, typeId);
    if (seenPairs.has(k)) return relOf.get(a.id)?.find(r => r.to.elementId === b.id && r.typeId === typeId);
    seenPairs.add(k);
    const r: Relation = { id: `rel_b${relSeq++}`, typeId, name: '', doc: '', from: { elementId: a.id }, to: { elementId: b.id }, mappings: [], fields: {}, props: {}, features: {} };
    ws.relations[r.id] = r; relations.push(r);
    relOf.set(a.id, [...(relOf.get(a.id) ?? []), r]);
    return r;
  };

  // ---- vistas: reparto de elementos (cada uno aparece al menos una vez) y nodos anidados
  const views: View[] = [];
  let nodeSeq = 0, edgeSeq = 0;
  const cols = 8, cellW = 220, cellH = 120;
  let cursor = 0; // siguiente elemento no colocado todavía
  for (let v = 0; v < nViews; v++) {
    const view: View = { id: `vw_b${v}`, kind: 'freeform', notationId: notation, name: `Vista ${v + 1}`, doc: '', style: {}, props: {} };
    ws.views[view.id] = view; views.push(view);
    const placed = new Set<string>();
    const nodes: ViewNode[] = [];
    const nodeOfElement = new Map<string, ViewNode>();
    const addNode = (e: Element, x: number, y: number, w: number, h: number, parentNodeId?: string): ViewNode => {
      const n: ViewNode = { id: `vn_b${nodeSeq++}`, viewId: view.id, elementId: e.id, x, y, w, h, style: {}, ...(parentNodeId ? { parentNodeId } : {}) };
      ws.nodes[n.id] = n; nodes.push(n); placed.add(e.id); nodeOfElement.set(e.id, n);
      return n;
    };
    const nextElement = (): Element => {
      // Primero los que aún no aparecen en ninguna vista; después, al azar.
      while (cursor < elements.length && placed.has(elements[cursor]!.id)) cursor++;
      if (cursor < elements.length && rnd() < 0.7) return elements[cursor++]!;
      let e = pick(elements), guard = 0;
      while (placed.has(e.id) && guard++ < 20) e = pick(elements);
      return e;
    };
    let slot = 0;
    while (nodes.length < perView) {
      const col = slot % cols, row = Math.floor(slot / cols);
      slot++;
      const asContainer = containers.length > 0 && rnd() < nestedFraction && nodes.length + 3 <= perView;
      if (asContainer) {
        let parentEl = pick(containers), guard = 0;
        while (placed.has(parentEl.id) && guard++ < 10) parentEl = pick(containers);
        if (placed.has(parentEl.id)) continue;
        const kids = 2 + int(2);
        const p = addNode(parentEl, col * cellW, row * cellH, 200, 40 + kids * 70);
        for (let k = 0; k < kids && nodes.length < perView; k++) {
          const childEl = nextElement();
          if (placed.has(childEl.id)) continue;
          addNode(childEl, 20, 36 + k * 70, 160, 56, p.id);
          const rt = nestingRelation(parentEl.typeId, childEl.typeId);
          if (rt) addRelation(parentEl, childEl, rt);
        }
        // El contenedor ocupa varias filas de la rejilla de colocación.
        slot += cols * Math.ceil((40 + kids * 70) / cellH) - 1;
      } else {
        const e = nextElement();
        if (placed.has(e.id)) continue;
        addNode(e, col * cellW, row * cellH, 160, 56);
      }
    }
    // Relaciones entre elementos de la misma vista (así hay aristas), válidas según la matriz.
    const wanted = Math.round(nodes.length * relationsPerElement * 0.6);
    const edges: ViewEdge[] = [];
    const edgeSeen = new Set<string>();
    let tries = 0;
    while (edges.length < wanted && tries++ < wanted * 6) {
      const a = pick(nodes), b = pick(nodes);
      if (a.id === b.id || a.parentNodeId === b.id || b.parentNodeId === a.id) continue;
      const ea = ws.elements[a.elementId!]!, eb = ws.elements[b.elementId!]!;
      const opts = allowed(ea.typeId, eb.typeId);
      if (!opts.length) continue;
      const r = addRelation(ea, eb, pick(opts));
      if (!r || edgeSeen.has(r.id)) continue;
      edgeSeen.add(r.id);
      const e: ViewEdge = { id: `ve_b${edgeSeq++}`, viewId: view.id, relationId: r.id, fromNodeId: a.id, toNodeId: b.id, bendpoints: [], style: {} };
      ws.edges[e.id] = e; edges.push(e);
    }
    // Aristas para relaciones ya existentes entre nodos de la vista (las de anidamiento, por ejemplo).
    for (const n of nodes) {
      for (const r of relOf.get(n.elementId!) ?? []) {
        const m = nodeOfElement.get(r.to.elementId!);
        if (!m || edgeSeen.has(r.id)) continue;
        edgeSeen.add(r.id);
        const e: ViewEdge = { id: `ve_b${edgeSeq++}`, viewId: view.id, relationId: r.id, fromNodeId: n.id, toNodeId: m.id, bendpoints: [], style: {} };
        ws.edges[e.id] = e; edges.push(e);
      }
    }
  }

  // ---- relaciones sueltas entre elementos cualesquiera hasta la cuota (parte no se dibuja)
  const target = Math.round(nElements * relationsPerElement);
  let tries = 0;
  while (relations.length < target && tries++ < target * 4) {
    const a = pick(elements), b = pick(elements);
    const opts = allowed(a.typeId, b.typeId);
    if (opts.length) addRelation(a, b, pick(opts));
  }

  // ---- reglas de estilo: unas cuantas para que `resolveStyle` tenga trabajo real
  const ruleDefs: { id: string; conditions: { source: 'name' | 'tag' | 'prop' | 'type' | 'doc'; op: 'contains' | 'eq' | 'regex' | 'notEmpty'; key?: string; value?: string }[]; style: Record<string, unknown>; priority: number; match?: 'any' | 'all' }[] = [
    { id: 'rule_b0', conditions: [{ source: 'tag', op: 'eq', value: 'tag-3' }], style: { bg: '#fde68a' }, priority: 1 },
    { id: 'rule_b1', conditions: [{ source: 'prop', op: 'eq', key: 'owner', value: 'equipo-2' }], style: { border: '#dc2626', borderWidth: 2 }, priority: 2 },
    { id: 'rule_b2', conditions: [{ source: 'name', op: 'regex', value: '\\b(1|2)\\d\\d\\b' }], style: { bold: true }, priority: 3 },
    { id: 'rule_b3', conditions: [{ source: 'doc', op: 'notEmpty' }], style: { badge: '#2563eb', badgeText: 'doc' }, priority: 4 },
    { id: 'rule_b4', conditions: [{ source: 'type', op: 'contains', value: 'Service' }, { source: 'name', op: 'contains', value: '7' }], style: { bg: '#bbf7d0' }, priority: 5, match: 'all' },
  ];
  for (const r of ruleDefs) {
    ws.rules[r.id] = { id: r.id, name: r.id, enabled: true, target: 'element', match: r.match ?? 'any', priority: r.priority, conditions: r.conditions.map(c => ({ ...c })), style: r.style } as Workspace['rules'][string];
  }
  ws.meta.currentViewId = views[0]?.id ?? null;
  return ws;
}
