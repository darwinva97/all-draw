/**
 * Modelo de un espacio de trabajo. Regla de oro: **el modelo no sabe de píxeles y las vistas
 * no saben de semántica**. Un `Element` vive en el modelo una vez y aparece en N `ViewNode`
 * de N vistas de N notaciones. El núcleo no conoce ninguna notación: los tipos (`typeId`)
 * son cadenas `pack:Tipo` resueltas contra el registro de packs.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------- Campos tipados
export const FieldKind = z.enum([
  'text', 'textarea', 'number', 'select', 'checkbox', 'url', 'date',
  'list',      // array de textos
  'keyvalue',  // array de { key, value }
  'json',      // texto JSON: cada hoja es un puerto
  'ref',       // referencia a otro elemento (id)
]);
export type FieldKind = z.infer<typeof FieldKind>;

export const KeyValue = z.object({ key: z.string(), value: z.string() });
export type KeyValue = z.infer<typeof KeyValue>;

export const FieldDef = z.object({
  key: z.string().min(1),
  label: z.string(),
  kind: FieldKind,
  /** 'select': opciones separadas por coma. 'keyvalue': "Etiqueta clave|Etiqueta valor". */
  options: z.string().optional(),
  /** Si el campo genera puertos (pines). Por defecto sí para json/list/keyvalue, no para el resto. */
  port: z.boolean().optional(),
  /** Tipo de puerto que producen sus hojas (para la matriz de compatibilidad). */
  portTypeId: z.string().optional(),
  direction: z.enum(['in', 'out', 'both']).optional(),
  required: z.boolean().optional(),
  doc: z.string().optional(),
});
export type FieldDef = z.infer<typeof FieldDef>;

// ---------------------------------------------------------------- Tipos (de una librería o de un pack)
export const Shape = z.enum([
  'rect', 'rounded', 'ellipse', 'diamond', 'hexagon', 'parallelogram', 'cylinder', 'note',
  'actor', 'circle', 'double-circle', 'bar', 'pool', 'lane', 'group', 'label', 'container',
]);
export type Shape = z.infer<typeof Shape>;

export const ElementType = z.object({
  id: z.string().min(1),          // `archimate:BusinessProcess`, `lib_x:Microservicio`
  name: z.string(),
  notationId: z.string().optional(),
  /** Agrupación en la paleta: capa ArchiMate, categoría BPMN, "Tipos de la librería"… */
  category: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  shape: Shape.optional(),
  /** Puede contener otros nodos en una vista (pool, lane, subproceso, celda, grupo). */
  container: z.boolean().optional(),
  fields: z.array(FieldDef).default([]),
  /** Tipo del que hereda campos y validez (especialización). */
  extends: z.string().optional(),
  abstract: z.boolean().optional(),
  doc: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ElementType = z.infer<typeof ElementType>;

export const LineStyle = z.enum(['solid', 'dashed', 'dotted']);
export type LineStyle = z.infer<typeof LineStyle>;
export const ArrowHead = z.enum(['none', 'arrow', 'open', 'diamond', 'filled-diamond', 'triangle', 'circle', 'dot', 'half']);
export type ArrowHead = z.infer<typeof ArrowHead>;

export const RelationType = z.object({
  id: z.string().min(1),          // `archimate:Serving`, `bpmn:SequenceFlow`, `core:link`
  name: z.string(),
  notationId: z.string().optional(),
  category: z.string().optional(),
  line: LineStyle.optional(),
  sourceHead: ArrowHead.optional(),
  targetHead: ArrowHead.optional(),
  color: z.string().optional(),
  fields: z.array(FieldDef).default([]),
  /** Puede unir dos relaciones (ArchiMate lo permite con Association). */
  relationEnds: z.boolean().optional(),
  doc: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type RelationType = z.infer<typeof RelationType>;

export const PortType = z.object({
  id: z.string().min(1),
  name: z.string(),
  notationId: z.string().optional(),
  color: z.string().optional(),
  doc: z.string().optional(),
});
export type PortType = z.infer<typeof PortType>;

/** Un componente reutilizable de una librería es un `Element` marcado como `template`. */
export const Library = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().default(''),
  elementTypes: z.array(ElementType).default([]),
  relationTypes: z.array(RelationType).default([]),
  portTypes: z.array(PortType).default([]),
  /** Packs de notación que la librería activa (por id). */
  notations: z.array(z.string()).default([]),
});
export type Library = z.infer<typeof Library>;

// ---------------------------------------------------------------- Modelo semántico
export const Direction = z.enum(['in', 'out', 'both']);
export type Direction = z.infer<typeof Direction>;

export const Port = z.object({
  id: z.string().min(1),
  /** Clave estable: `fieldKey` o `fieldKey.path.a.b` para hojas JSON. */
  key: z.string().min(1),
  label: z.string().optional(),
  group: z.string().optional(),
  portTypeId: z.string().optional(),
  direction: Direction.default('both'),
  /** Ruta dentro del campo (hojas JSON). */
  path: z.string().optional(),
  /** Tipo de dato observado (`string`, `number`, `array[3]`…). */
  dataType: z.string().optional(),
  /** true = calculado a partir de los campos; no se edita. */
  derived: z.boolean().default(false),
});
export type Port = z.infer<typeof Port>;

export const Element = z.object({
  id: z.string().min(1),
  typeId: z.string().min(1),
  name: z.string().default(''),
  doc: z.string().default(''),
  libraryId: z.string().optional(),
  /** Plantilla de librería (componente reutilizable): no es una instancia del modelo. */
  template: z.boolean().optional(),
  /** Instancia creada a partir de una plantilla; hereda campos no sobreescritos. */
  templateId: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  /** Puertos declarados a mano; los derivados de campos se calculan. */
  ports: z.array(Port).default([]),
  /** Perfiles/especializaciones (ArchiMate) por id de perfil. */
  profiles: z.array(z.string()).default([]),
  /** Propiedades libres del usuario (clave → valor). */
  props: z.record(z.string(), z.string()).default({}),
  /** Rasgos de la aplicación (no se muestran como propiedades). */
  features: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
});
export type Element = z.infer<typeof Element>;

export const End = z.object({
  elementId: z.string().optional(),
  /** Relación como extremo (relación sobre relación). */
  relationId: z.string().optional(),
  portId: z.string().optional(),
});
export type End = z.infer<typeof End>;

export const Mapping = z.object({ fromPath: z.string(), toPath: z.string(), label: z.string().optional() });
export type Mapping = z.infer<typeof Mapping>;

export const Relation = z.object({
  id: z.string().min(1),
  typeId: z.string().min(1),
  name: z.string().default(''),
  doc: z.string().default(''),
  from: End,
  to: End,
  /** Conexiones campo a campo además de los extremos. */
  mappings: z.array(Mapping).default([]),
  fields: z.record(z.string(), z.unknown()).default({}),
  props: z.record(z.string(), z.string()).default({}),
  features: z.record(z.string(), z.unknown()).default({}),
});
export type Relation = z.infer<typeof Relation>;

// ---------------------------------------------------------------- Vistas
export const ViewKind = z.enum(['freeform', 'grid', 'sequence', 'tree', 'matrix']);
export type ViewKind = z.infer<typeof ViewKind>;

export const Layer = z.object({ id: z.string(), name: z.string(), color: z.string().optional(), size: z.number().optional() });
export const Stage = z.object({ id: z.string(), name: z.string(), size: z.number().optional(), groupId: z.string().nullable().optional() });
export const StageGroup = z.object({ id: z.string(), name: z.string(), color: z.string().optional() });

export const GridLayout = z.object({
  layers: z.array(Layer).default([]),
  stages: z.array(Stage).default([]),
  stageGroups: z.array(StageGroup).default([]),
});
export type GridLayout = z.infer<typeof GridLayout>;

export const View = z.object({
  id: z.string().min(1),
  kind: ViewKind.default('freeform'),
  /** Notación principal (pack). Otras notaciones pueden aparecer atenuadas. */
  notationId: z.string().default('freeform'),
  viewpointId: z.string().optional(),
  name: z.string().default(''),
  doc: z.string().default(''),
  /** Elemento que la vista detalla (una vista BPMN "de" un proceso). */
  rootElementId: z.string().optional(),
  grid: GridLayout.optional(),
  public: z.boolean().optional(),
  style: z.record(z.string(), z.unknown()).default({}),
  props: z.record(z.string(), z.string()).default({}),
});
export type View = z.infer<typeof View>;

export const NodeStyle = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  opacity: z.number().optional(),
  /** Figura alternativa (ArchiMate: rectángulo con icono vs figura). */
  figure: z.number().optional(),
  labelPosition: z.enum(['inside', 'top', 'bottom', 'left', 'right']).optional(),
  showPorts: z.boolean().optional(),
  /** Puertos visibles (por clave); vacío = todos los usados. */
  visiblePorts: z.array(z.string()).optional(),
  collapsed: z.boolean().optional(),
});
export type NodeStyle = z.infer<typeof NodeStyle>;

export const ViewNode = z.object({
  id: z.string().min(1),
  viewId: z.string().min(1),
  /** Sin elemento = nodo puramente visual (nota, grupo, imagen, etiqueta). */
  elementId: z.string().optional(),
  /** Tipo visual si no hay elemento: `core:note`, `core:group`, `core:image`, `core:label`. */
  visualType: z.string().optional(),
  text: z.string().optional(),
  parentNodeId: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  w: z.number().default(160),
  h: z.number().default(56),
  z: z.number().optional(),
  style: NodeStyle.default({}),
  /** Vista que se abre al entrar (drill-down explícito). */
  detailViewId: z.string().optional(),
  /** Celda en una vista grid. */
  cell: z.object({ layerId: z.string(), stageId: z.string() }).optional(),
  /** Para elementos de API: operación usada aquí. Notas de instancia. */
  note: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ViewNode = z.infer<typeof ViewNode>;

export const Point = z.object({ x: z.number(), y: z.number() });
export const EdgeStyle = z.object({
  line: LineStyle.optional(),
  color: z.string().optional(),
  width: z.number().optional(),
  sourceHead: ArrowHead.optional(),
  targetHead: ArrowHead.optional(),
  router: z.enum(['straight', 'orthogonal', 'bezier', 'smoothstep']).optional(),
  labelPosition: z.number().optional(),
});
export type EdgeStyle = z.infer<typeof EdgeStyle>;

export const ViewEdge = z.object({
  id: z.string().min(1),
  viewId: z.string().min(1),
  /** Sin relación = conexión puramente visual (línea a una nota). */
  relationId: z.string().optional(),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  fromPortId: z.string().optional(),
  toPortId: z.string().optional(),
  label: z.string().optional(),
  bendpoints: z.array(Point).default([]),
  style: EdgeStyle.default({}),
});
export type ViewEdge = z.infer<typeof ViewEdge>;

/** Eje navegable: "ver este elemento en BPMN / en estados / en ArchiMate". */
export const Dimension = z.object({
  id: z.string().min(1),
  name: z.string(),
  notationId: z.string(),
  viewpointId: z.string().optional(),
  kind: ViewKind.optional(),
  color: z.string().optional(),
});
export type Dimension = z.infer<typeof Dimension>;

// ---------------------------------------------------------------- Personas y reglas
export const AssignKind = z.enum(['element', 'view', 'layer', 'stage', 'type', 'relation']);
export const Assignment = z.object({ id: z.string(), role: z.string(), kind: AssignKind, targetId: z.string(), notes: z.string().optional() });
export type Assignment = z.infer<typeof Assignment>;
export const Person = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().optional(),
  team: z.string().optional(),
  notes: z.string().optional(),
  assignments: z.array(Assignment).default([]),
});
export type Person = z.infer<typeof Person>;

export const RuleSource = z.enum(['field', 'name', 'doc', 'type', 'library', 'notation', 'people', 'role', 'tag', 'prop', 'view', 'port']);
export type RuleSource = z.infer<typeof RuleSource>;
export const RuleOp = z.enum(['eq', 'ne', 'contains', 'notContains', 'in', 'empty', 'notEmpty', 'gt', 'lt', 'regex']);
export type RuleOp = z.infer<typeof RuleOp>;
export const Condition = z.object({
  source: RuleSource,
  key: z.string().optional(),
  op: RuleOp,
  value: z.string().optional(),
  caseSensitive: z.boolean().optional(),
});
export type Condition = z.infer<typeof Condition>;
export const RuleStyle = z.object({
  bg: z.string().optional(), text: z.string().optional(), border: z.string().optional(),
  borderWidth: z.number().optional(), borderStyle: LineStyle.optional(),
  accent: z.string().optional(), accentWidth: z.number().optional(),
  top: z.string().optional(), topWidth: z.number().optional(),
  opacity: z.number().optional(), glow: z.string().optional(),
  badge: z.string().optional(), badgeText: z.string().optional(),
  icon: z.string().optional(), bold: z.boolean().optional(), strike: z.boolean().optional(),
});
export type RuleStyle = z.infer<typeof RuleStyle>;
export const StyleRule = z.object({
  id: z.string().min(1),
  name: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  match: z.enum(['all', 'any']).default('all'),
  /** A qué se aplica. */
  target: z.enum(['element', 'relation']).default('element'),
  conditions: z.array(Condition).default([]),
  style: RuleStyle.default({}),
  viewId: z.string().nullable().optional(),
});
export type StyleRule = z.infer<typeof StyleRule>;

// ---------------------------------------------------------------- Workspace
export const WorkspaceMeta = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  name: z.string().default('Sin nombre'),
  description: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  currentViewId: z.string().nullable().optional(),
});
export type WorkspaceMeta = z.infer<typeof WorkspaceMeta>;

/** Colecciones planas indexadas por id: se sincronizan registro a registro. */
const byId = <T extends z.ZodTypeAny>(s: T) => z.record(z.string(), s).default({});

export const Workspace = z.object({
  meta: WorkspaceMeta.default({}),
  libraries: byId(Library),
  elements: byId(Element),
  relations: byId(Relation),
  views: byId(View),
  nodes: byId(ViewNode),
  edges: byId(ViewEdge),
  dimensions: byId(Dimension),
  people: byId(Person),
  rules: byId(StyleRule),
});
export type Workspace = z.infer<typeof Workspace>;

export const COLLECTIONS = ['libraries', 'elements', 'relations', 'views', 'nodes', 'edges', 'dimensions', 'people', 'rules'] as const;
export type Collection = (typeof COLLECTIONS)[number];
export type RecordOf<C extends Collection> = Workspace[C][string];

export function emptyWorkspace(name = 'Sin nombre'): Workspace {
  return Workspace.parse({ meta: { name, createdAt: new Date().toISOString() } });
}

/** Valida y normaliza (rellena valores por defecto). Lanza ZodError si no cuadra. */
export function parseWorkspace(input: unknown): Workspace {
  return Workspace.parse(input);
}
