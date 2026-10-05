/**
 * Pack `ddd`: diseño guiado por el dominio (Evans; mapa de contextos de Context Mapper) como datos puros.
 *
 * - **Estratégico**: dominio (contenedor) con sus subdominios (núcleo, de soporte o genérico) y contextos acotados
 *   (contenedores) unidos por relaciones con **patrón** (Partnership, Shared Kernel, Customer/Supplier, Conformist,
 *   Anticorruption Layer, Open Host Service, Published Language, Separate Ways). El patrón se rotula sobre la arista y
 *   cada extremo lleva su papel **U** (upstream) o **D** (downstream).
 * - **Táctico**: agregados (contenedores) con entidades, objetos de valor, eventos de dominio y servicios, que se pintan
 *   como clasificadores con «estereotipo» y compartimentos (atributos, operaciones).
 *
 * Los viewpoints separan el mapa de contextos (estratégico) del modelo de cada contexto (táctico).
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType, Viewpoint, FieldDef } from '@all-draw/core';

const NS = 'ddd';
export const DDD_PACK_ID = NS;
const CAT = { strategic: 'strategic', tactical: 'tactical', relations: 'relations' } as const;
export const CONTEXT_RELATION = `${NS}:ContextRelation`;
export const IMPLEMENTS = `${NS}:Implements`;
export const REFERENCE = `${NS}:Reference`;
export const PUBLISHES = `${NS}:Publishes`;
export const TRIGGERS = `${NS}:Triggers`;

/** Patrones de relación entre contextos: valor interno (el nombre canónico, que se rotula en la arista) → nombre legible. */
export const CONTEXT_PATTERNS = {
  'Partnership': 'Asociación (Partnership)',
  'Shared Kernel': 'Núcleo compartido (Shared Kernel)',
  'Customer/Supplier': 'Cliente/proveedor (Customer/Supplier)',
  'Conformist': 'Conformista (Conformist)',
  'Anticorruption Layer': 'Capa anticorrupción (Anticorruption Layer)',
  'Open Host Service': 'Servicio de host abierto (Open Host Service)',
  'Published Language': 'Lenguaje publicado (Published Language)',
  'Separate Ways': 'Caminos separados (Separate Ways)',
} as const;
export type ContextPattern = keyof typeof CONTEXT_PATTERNS;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

const stereotype: FieldDef = { key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: 'Sustituye al de por defecto («Aggregate Root», «Repository»…).' };
const attributes: FieldDef = { key: 'attributes', label: 'Atributos', kind: 'list', port: false, doc: 'Uno por línea: "importe: Dinero".' };
const operations: FieldDef = { key: 'operations', label: 'Operaciones', kind: 'list', port: false, doc: 'Una por línea: "confirmar(): void".' };
const role = (key: 'sourceRole' | 'targetRole', label: string): FieldDef => ({
  key, label, kind: 'select', options: 'U,D', optionLabels: { U: 'Upstream (U)', D: 'Downstream (D)' }, doc: 'Se rotula junto a ese extremo de la línea.',
});

export const DDD_ELEMENT_TYPES: ElementType[] = [
  el('Domain', 'Dominio', CAT.strategic, {
    shape: 'group', container: true, color: '#F5F5F5', icon: '◫',
    doc: 'Área de negocio que se modela (problema). Contiene sus subdominios y los contextos acotados que los resuelven.',
    fields: [{ key: 'vision', label: 'Visión', kind: 'textarea', doc: 'Para qué existe el dominio, en una o dos frases.' }],
  }),
  el('Subdomain', 'Subdominio', CAT.strategic, {
    shape: 'ellipse', color: '#FFF2CC',
    doc: 'Parte del dominio con su propio peso: núcleo (lo que diferencia al negocio), de soporte o genérico (se puede comprar).',
    fields: [
      { key: 'kind', label: 'Tipo de subdominio', kind: 'select', options: 'core,supporting,generic', optionLabels: { core: 'Núcleo (core)', supporting: 'De soporte (supporting)', generic: 'Genérico (generic)' }, required: true, doc: 'Núcleo: lo que diferencia al negocio. De soporte: necesario y propio. Genérico: se puede comprar o reutilizar.' },
      { key: 'vision', label: 'Visión', kind: 'textarea', doc: 'Qué aporta este subdominio y por qué importa.' },
    ],
  }),
  el('BoundedContext', 'Contexto acotado', CAT.strategic, {
    shape: 'rounded', container: true, color: '#EAF4FF',
    doc: 'Frontera dentro de la cual un modelo y su lenguaje ubicuo son coherentes (solución). Contiene agregados, entidades, eventos y servicios.',
    fields: [
      { key: 'team', label: 'Equipo', kind: 'text', doc: 'Equipo dueño del contexto.' },
      { key: 'responsibilities', label: 'Responsabilidades', kind: 'list', port: false, doc: 'Una por línea: de qué se encarga el contexto.' },
      { key: 'vision', label: 'Visión', kind: 'textarea', doc: 'Propósito del contexto en una frase.' },
    ],
  }),
  el('Aggregate', 'Agregado', CAT.tactical, {
    shape: 'rounded', container: true, color: '#FFF8E1',
    doc: 'Grupo de entidades y objetos de valor que cambia como una unidad y protege sus invariantes. Se accede solo por su raíz.',
    fields: [
      { key: 'root', label: 'Raíz', kind: 'text', doc: 'Entidad raíz del agregado.' },
      { key: 'invariants', label: 'Invariantes', kind: 'list', port: false, doc: 'Reglas que siempre se cumplen dentro del agregado.' },
    ],
  }),
  el('Entity', 'Entidad', CAT.tactical, {
    shape: 'rect', color: '#FFF2CC', icon: 'E',
    doc: 'Objeto con identidad propia que perdura aunque cambien sus atributos («Entity»).',
    fields: [stereotype, { key: 'identity', label: 'Identidad', kind: 'text', doc: 'Atributo que la identifica ("pedidoId").' }, attributes, operations],
    meta: { stereotypeDefault: 'Entity', compartments: { sections: ['attributes', 'operations'], stereotype: 'stereotype' } },
  }),
  el('ValueObject', 'Objeto de valor', CAT.tactical, {
    shape: 'rect', color: '#E8F5E9', icon: 'V',
    doc: 'Objeto inmutable sin identidad que se define por sus atributos ("Dinero", "Dirección") («Value Object»).',
    fields: [stereotype, attributes],
    meta: { stereotypeDefault: 'Value Object', compartments: { sections: ['attributes'], stereotype: 'stereotype' } },
  }),
  el('DomainEvent', 'Evento de dominio', CAT.tactical, {
    shape: 'rect', color: '#FFE0B2', icon: '⚡',
    doc: 'Algo relevante que ya ha ocurrido en el dominio, en pasado ("Pedido confirmado") («Domain Event»).',
    fields: [stereotype, attributes],
    meta: { stereotypeDefault: 'Domain Event', compartments: { sections: ['attributes'], stereotype: 'stereotype' } },
  }),
  el('Service', 'Servicio', CAT.tactical, {
    shape: 'rect', color: '#F3E5F5', icon: 'S',
    doc: 'Operación del dominio que no pertenece a ninguna entidad ni objeto de valor («Service»).',
    fields: [
      stereotype,
      { key: 'layer', label: 'Capa', kind: 'select', options: 'domain,application,infrastructure', optionLabels: { domain: 'Dominio', application: 'Aplicación', infrastructure: 'Infraestructura' }, doc: 'Dominio (reglas del negocio), aplicación (orquesta los casos de uso) o infraestructura (lo técnico).' },
      operations,
    ],
    meta: { stereotypeDefault: 'Service', compartments: { sections: ['operations'], stereotype: 'stereotype' } },
  }),
];

export const DDD_RELATION_TYPES: RelationType[] = [
  {
    id: CONTEXT_RELATION, name: 'Relación entre contextos', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none',
    doc: 'Cómo se relacionan dos contextos acotados: el patrón se rotula sobre la línea y cada extremo lleva U (upstream, del que se depende) o D (downstream).',
    fields: [
      { key: 'pattern', label: 'Patrón', kind: 'select', options: Object.keys(CONTEXT_PATTERNS).join(','), optionLabels: { ...CONTEXT_PATTERNS }, required: true, doc: 'Cómo se relacionan los dos equipos y sus modelos: socios, núcleo compartido, cliente/proveedor, conformista, capa anticorrupción…' },
      role('sourceRole', 'Papel del origen'),
      role('targetRole', 'Papel del destino'),
      { key: 'description', label: 'Descripción', kind: 'textarea', doc: 'Qué se intercambian los contextos y en qué condiciones.' },
    ],
  },
  {
    id: IMPLEMENTS, name: 'Implementa', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', fields: [],
    doc: 'El contexto acotado origen resuelve (total o parcialmente) el subdominio destino.',
  },
  {
    id: REFERENCE, name: 'Referencia', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'sourceCard', label: 'Multiplicidad origen', kind: 'text', doc: '"1", "0..1", "*", "1..*", "0..*" (se rotula junto al extremo origen).' }, { key: 'targetCard', label: 'Multiplicidad destino', kind: 'text', doc: '"1", "0..1", "*", "1..*", "0..*" (se rotula junto al extremo destino).' }],
    doc: 'El origen conoce o usa al destino. Entre agregados, solo por identidad.',
  },
  {
    id: PUBLISHES, name: 'Publica', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'arrow', fields: [],
    doc: 'El agregado, entidad o servicio origen emite el evento de dominio destino.',
  },
  {
    id: TRIGGERS, name: 'Desencadena', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'arrow', fields: [],
    doc: 'El evento de dominio origen pone en marcha el servicio, agregado o contexto destino (que lo escucha).',
  },
];

const MODEL = ['Aggregate', 'Entity', 'ValueObject'];

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  const add = (s: string, t: string, rel: string) => { const row = (m[s] ??= {}); row[t] = [...new Set([...(row[t] ?? []), rel])]; };
  for (const t of DDD_ELEMENT_TYPES) m[t.id.slice(NS.length + 1)] = {};
  add('BoundedContext', 'BoundedContext', CONTEXT_RELATION);
  add('BoundedContext', 'Subdomain', IMPLEMENTS);
  for (const s of [...MODEL, 'Service']) for (const t of MODEL) if (!(s === 'ValueObject' && t !== 'ValueObject')) add(s, t, REFERENCE);
  for (const s of ['Aggregate', 'Entity', 'Service']) add(s, 'DomainEvent', PUBLISHES);
  for (const t of ['Service', 'Aggregate', 'BoundedContext']) add('DomainEvent', t, TRIGGERS);
  return m;
}

export const DDD_VALIDITY: ValidityMatrix = buildValidity();

export const DDD_NESTING: NestingRule[] = [
  ...['Subdomain', 'BoundedContext'].map(child => ({ parent: 'Domain', child, relationTypes: [] })),
  ...['Aggregate', 'Entity', 'ValueObject', 'DomainEvent', 'Service'].map(child => ({ parent: 'BoundedContext', child, relationTypes: [] })),
  ...['Entity', 'ValueObject', 'DomainEvent'].map(child => ({ parent: 'Aggregate', child, relationTypes: [] })),
];

const id = (n: string) => `${NS}:${n}`;
export const DDD_VIEWPOINTS: Viewpoint[] = [
  {
    id: 'contextMap', name: 'Mapa de contextos', doc: 'Diseño estratégico: dominio, subdominios y contextos acotados con sus patrones de relación.',
    elementTypes: ['Domain', 'Subdomain', 'BoundedContext'].map(id), relationTypes: [CONTEXT_RELATION, IMPLEMENTS],
  },
  {
    id: 'tactical', name: 'Modelo táctico', doc: 'Diseño táctico de un contexto: agregados, entidades, objetos de valor, eventos de dominio y servicios.',
    elementTypes: ['BoundedContext', 'Aggregate', 'Entity', 'ValueObject', 'DomainEvent', 'Service'].map(id), relationTypes: [REFERENCE, PUBLISHES, TRIGGERS],
  },
];

export const DDD_PACK: NotationPack = {
  id: NS,
  name: 'DDD: mapa de contextos',
  version: '0.1.0',
  doc: 'Diseño guiado por el dominio: subdominios y contextos acotados con sus patrones de relación (upstream/downstream), y el modelo táctico de agregados, entidades, objetos de valor, eventos y servicios.',
  color: '#7E57C2',
  viewKind: 'freeform',
  categories: [
    { id: CAT.strategic, name: 'Estratégico', order: 0 },
    { id: CAT.tactical, name: 'Táctico', order: 1 },
    { id: CAT.relations, name: 'Relaciones', order: 2 },
  ],
  elementTypes: DDD_ELEMENT_TYPES,
  relationTypes: DDD_RELATION_TYPES,
  portTypes: [],
  validity: DDD_VALIDITY,
  viewpoints: DDD_VIEWPOINTS,
  nesting: DDD_NESTING,
  defaultRelation: CONTEXT_RELATION,
};

export default DDD_PACK;
