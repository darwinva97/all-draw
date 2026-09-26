/**
 * Un **pack de notación** es datos: tipos de elemento, tipos de relación, tipos de puerto, matriz de
 * validez, viewpoints, categorías. El render (componentes React) vive en el editor y se asocia por
 * `notationId`. Así el núcleo y los agentes pueden validar sin DOM.
 */
import type { ElementType, RelationType, PortType, ViewKind } from './model';
import type { PortRule } from './ports';

/** `matrix[sourceTypeId][targetTypeId]` = ids de relación permitidos. Ausente = sin restricción. */
export type ValidityMatrix = Record<string, Record<string, string[]>>;

export interface Viewpoint {
  id: string;
  name: string;
  doc?: string;
  /** Tipos de elemento permitidos (ids completos). Vacío = todos. */
  elementTypes: string[];
  relationTypes?: string[];
}

export interface NotationCategory { id: string; name: string; color?: string; order?: number }

/** Regla de anidamiento: qué relación se propone al meter `child` dentro de `parent`. */
export interface NestingRule { parent: string | '*'; child: string | '*'; relationTypes: string[] }

export interface NotationPack {
  id: string;                 // `archimate`, `bpmn`, `statechart`, `c4`, `grid`, `freeform`
  name: string;
  version?: string;
  doc?: string;
  color?: string;
  /** Clase de vista que crea por defecto. */
  viewKind?: ViewKind;
  categories: NotationCategory[];
  elementTypes: ElementType[];
  relationTypes: RelationType[];
  portTypes: PortType[];
  /** Vacía = cualquier relación entre cualquier par (freeform). */
  validity?: ValidityMatrix;
  portRules?: PortRule[];
  viewpoints: Viewpoint[];
  nesting?: NestingRule[];
  /** Relación implícita por defecto al anidar (si `nesting` no dice otra cosa). */
  defaultNestingRelation?: string;
  /** Tipo de relación por defecto al conectar dos nodos sin elegir. */
  defaultRelation?: string;
}

// ---------------------------------------------------------------- Registro
export class NotationRegistry {
  private packs = new Map<string, NotationPack>();
  private elementTypes = new Map<string, ElementType>();
  private relationTypes = new Map<string, RelationType>();
  private portTypes = new Map<string, PortType>();

  register(pack: NotationPack): this {
    this.packs.set(pack.id, pack);
    for (const t of pack.elementTypes) this.elementTypes.set(t.id, { ...t, notationId: t.notationId ?? pack.id });
    for (const t of pack.relationTypes) this.relationTypes.set(t.id, { ...t, notationId: t.notationId ?? pack.id });
    for (const t of pack.portTypes) this.portTypes.set(t.id, { ...t, notationId: t.notationId ?? pack.id });
    return this;
  }

  /** Tipos definidos en librerías del workspace (no en packs). */
  registerLibraryTypes(lib: { id: string; elementTypes: ElementType[]; relationTypes: RelationType[]; portTypes: PortType[] }): this {
    for (const t of lib.elementTypes) this.elementTypes.set(t.id, t);
    for (const t of lib.relationTypes) this.relationTypes.set(t.id, t);
    for (const t of lib.portTypes) this.portTypes.set(t.id, t);
    return this;
  }

  pack(id: string): NotationPack | undefined { return this.packs.get(id); }
  allPacks(): NotationPack[] { return [...this.packs.values()]; }
  elementType(id: string): ElementType | undefined { return this.elementTypes.get(id); }
  relationType(id: string): RelationType | undefined { return this.relationTypes.get(id); }
  portType(id: string): PortType | undefined { return this.portTypes.get(id); }
  allElementTypes(): ElementType[] { return [...this.elementTypes.values()]; }
  allRelationTypes(): RelationType[] { return [...this.relationTypes.values()]; }

  /** Campos efectivos de un tipo, incluyendo los heredados por `extends`. */
  fieldsOf(typeId: string): ElementType['fields'] {
    const seen = new Set<string>();
    const out: ElementType['fields'] = [];
    let cur = this.elementTypes.get(typeId);
    let guard = 0;
    const chain: ElementType[] = [];
    while (cur && guard++ < 20) { chain.unshift(cur); cur = cur.extends ? this.elementTypes.get(cur.extends) : undefined; }
    for (const t of chain) for (const f of t.fields) if (!seen.has(f.key)) { seen.add(f.key); out.push(f); }
    return out;
  }

  notationOf(typeId: string): string {
    const i = typeId.indexOf(':');
    return i < 0 ? 'freeform' : typeId.slice(0, i);
  }

  /**
   * Relaciones permitidas entre dos tipos de elemento. Si ambos son de la misma notación y ésta
   * tiene matriz, manda la matriz. Entre notaciones distintas se permiten las relaciones "puente"
   * de `core` (trace, realizes, refines) y cualquier relación sin notación.
   */
  allowedRelations(sourceTypeId: string, targetTypeId: string): string[] {
    const ns = this.notationOf(sourceTypeId), nt = this.notationOf(targetTypeId);
    const bridge = this.allRelationTypes().filter(r => !r.notationId || r.notationId === 'core').map(r => r.id);
    if (ns !== nt) return bridge;
    const pack = this.packs.get(ns);
    if (!pack?.validity) return [...pack?.relationTypes.map(r => r.id) ?? [], ...bridge];
    const row = pack.validity[this.localName(sourceTypeId)] ?? pack.validity[sourceTypeId];
    const cell = row?.[this.localName(targetTypeId)] ?? row?.[targetTypeId];
    return [...(cell ?? []), ...bridge];
  }

  isValidRelation(sourceTypeId: string, targetTypeId: string, relationTypeId: string): boolean {
    return this.allowedRelations(sourceTypeId, targetTypeId).includes(relationTypeId);
  }

  /** Relación implícita propuesta al anidar un nodo dentro de otro. */
  nestingRelations(parentTypeId: string, childTypeId: string): string[] {
    const pack = this.packs.get(this.notationOf(parentTypeId));
    if (!pack) return [];
    const p = this.localName(parentTypeId), c = this.localName(childTypeId);
    const hits = (pack.nesting ?? []).filter(r => (r.parent === '*' || r.parent === p || r.parent === parentTypeId) && (r.child === '*' || r.child === c || r.child === childTypeId));
    const list = hits.flatMap(r => r.relationTypes);
    if (list.length) return list.filter(r => this.isValidRelation(parentTypeId, childTypeId, r));
    if (pack.defaultNestingRelation) return this.allowedRelations(parentTypeId, childTypeId).filter(r => r === pack.defaultNestingRelation);
    return [];
  }

  /** Viewpoint: ¿el tipo pertenece? (vacío = todos). */
  inViewpoint(notationId: string, viewpointId: string | undefined, typeId: string): boolean {
    if (!viewpointId) return true;
    const vp = this.packs.get(notationId)?.viewpoints.find(v => v.id === viewpointId);
    if (!vp || vp.elementTypes.length === 0) return true;
    return vp.elementTypes.includes(typeId);
  }

  private localName(typeId: string): string {
    const i = typeId.indexOf(':');
    return i < 0 ? typeId : typeId.slice(i + 1);
  }
}

/** Relaciones y tipos visuales del núcleo, disponibles en cualquier notación. */
export const CORE_PACK: NotationPack = {
  id: 'core',
  name: 'Núcleo',
  categories: [{ id: 'visual', name: 'Visual' }, { id: 'bridge', name: 'Trazabilidad' }],
  elementTypes: [],
  relationTypes: [
    { id: 'core:link', name: 'Enlace', category: 'bridge', line: 'solid', targetHead: 'arrow', fields: [] },
    { id: 'core:trace', name: 'Traza', category: 'bridge', line: 'dashed', targetHead: 'open', fields: [], doc: 'Une el mismo concepto modelado en dos notaciones.' },
    { id: 'core:realizes', name: 'Realiza', category: 'bridge', line: 'dashed', targetHead: 'triangle', fields: [] },
    { id: 'core:refines', name: 'Refina', category: 'bridge', line: 'dotted', targetHead: 'open', fields: [] },
    { id: 'core:flow', name: 'Flujo de datos', category: 'bridge', line: 'solid', targetHead: 'arrow', fields: [{ key: 'contract', label: 'Contrato', kind: 'json' }] },
  ],
  portTypes: [
    { id: 'field:json', name: 'Campo JSON' }, { id: 'field:list', name: 'Lista' }, { id: 'field:keyvalue', name: 'Clave→valor' },
    { id: 'field:text', name: 'Texto' }, { id: 'field:number', name: 'Número' }, { id: 'field:url', name: 'URL' }, { id: 'field:ref', name: 'Referencia' },
  ],
  portRules: [{ from: '*', to: '*', relationTypes: ['core:flow', 'core:link', 'core:trace'] }],
  viewpoints: [],
};
