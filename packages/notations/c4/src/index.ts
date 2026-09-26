/**
 * Pack `c4`: modelo C4 (Simon Brown) como datos puros. Colores oficiales de las plantillas C4-PlantUML /
 * Structurizr. Los niveles (contexto, contenedor, componente, código, despliegue) son viewpoints; la
 * jerarquía sistema ⊃ contenedor ⊃ componente ⊃ código se expresa por anidamiento sin relación implícita.
 */
import type { NotationPack, ValidityMatrix, NestingRule, Viewpoint } from '@all-draw/core';
import type { ElementType, RelationType, FieldDef } from '@all-draw/core';

export const C4_COLORS = {
  person: '#08427B',
  system: '#1168BD',
  container: '#438DD5',
  component: '#85BBF0',
  code: '#B7D3F3',
  deployment: '#FFFFFF',
  boundary: '#F5F5F5',
  external: '#999999',
} as const;

const CAT = { people: 'people', static: 'static', deployment: 'deployment' } as const;
const REL = 'c4:Relationship';
const USES = 'c4:Uses';

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `c4:${id}`, name, category, fields: [], ...extra,
});

const external: FieldDef = { key: 'external', label: 'Externo', kind: 'checkbox', doc: 'Fuera del alcance del equipo: se pinta en gris (#999999).' };
const technology: FieldDef = { key: 'technology', label: 'Tecnología', kind: 'text' };

export const C4_ELEMENT_TYPES: ElementType[] = [
  el('Person', 'Persona', CAT.people, {
    shape: 'actor', color: C4_COLORS.person, icon: '👤',
    doc: 'Usuario humano del sistema (rol, persona, actor).',
    fields: [external],
    meta: { externalColor: C4_COLORS.external },
  }),
  el('SoftwareSystem', 'Sistema de software', CAT.static, {
    shape: 'rounded', container: true, color: C4_COLORS.system, icon: '▣',
    doc: 'Nivel más alto de abstracción: entrega valor a sus usuarios. Contiene contenedores.',
    fields: [external],
    meta: { externalColor: C4_COLORS.external, level: 1 },
  }),
  el('Container', 'Contenedor', CAT.static, {
    shape: 'rounded', container: true, color: C4_COLORS.container, icon: '▤',
    doc: 'Aplicación o almacén de datos desplegable por separado. Contiene componentes.',
    fields: [
      technology,
      { key: 'kind', label: 'Clase', kind: 'select', options: 'app,database,queue,filesystem,browser,mobile,microservice' },
    ],
    meta: { level: 2 },
  }),
  el('Component', 'Componente', CAT.static, {
    shape: 'rounded', container: true, color: C4_COLORS.component, icon: '▥',
    doc: 'Agrupación de funcionalidad con interfaz bien definida dentro de un contenedor.',
    fields: [technology],
    meta: { level: 3 },
  }),
  el('Code', 'Código', CAT.static, {
    shape: 'rect', color: C4_COLORS.code, icon: '{ }',
    doc: 'Clase, interfaz, módulo o función. Nivel 4, opcional.',
    fields: [{ key: 'kind', label: 'Clase', kind: 'select', options: 'class,interface,module,function,enum' }],
    meta: { level: 4 },
  }),
  el('DeploymentNode', 'Nodo de despliegue', CAT.deployment, {
    shape: 'rect', container: true, color: C4_COLORS.deployment, icon: 'deployment-node',
    doc: 'Infraestructura donde se despliegan contenedores: servidor, VM, contenedor Docker, cloud. Se anidan.',
    fields: [technology, { key: 'instances', label: 'Instancias', kind: 'number' }],
  }),
  el('Boundary', 'Límite', CAT.static, {
    shape: 'group', container: true, color: C4_COLORS.boundary, icon: '▢',
    doc: 'Límite visual (empresa, sistema, contenedor) para agrupar elementos en una vista.',
    fields: [{ key: 'kind', label: 'Clase', kind: 'select', options: 'enterprise,system,container,group' }],
    meta: { borderStyle: 'dashed' },
  }),
];

const relFields: FieldDef[] = [
  technology,
  { key: 'description', label: 'Descripción', kind: 'textarea' },
];

export const C4_RELATION_TYPES: RelationType[] = [
  {
    id: REL, name: 'Relación', category: CAT.static, line: 'solid', targetHead: 'arrow', color: '#707070',
    doc: 'Relación genérica C4: etiqueta con descripción y tecnología ("Lee de [JDBC]").',
    fields: relFields,
  },
  {
    id: USES, name: 'Usa', category: CAT.static, line: 'solid', targetHead: 'arrow', color: '#707070',
    doc: 'Alias semántico de Relación con la dirección "el origen usa al destino". Misma pinta; sirve para exportar a Structurizr/LikeC4 con verbo explícito.',
    fields: relFields,
  },
];

// ---------------------------------------------------------------- Matriz
const ALL = C4_ELEMENT_TYPES.map(t => t.id.slice('c4:'.length));
const CODE_PEERS = ['Code', 'Component'];

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  for (const s of ALL) {
    m[s] = {};
    for (const t of ALL) {
      if (s === 'Person' && t === 'Person') continue;
      if (s === 'Code' && !CODE_PEERS.includes(t)) continue;
      if (t === 'Code' && !CODE_PEERS.includes(s)) continue;
      m[s]![t] = [REL, USES];
    }
  }
  return m;
}

export const C4_VALIDITY: ValidityMatrix = buildValidity();

// ---------------------------------------------------------------- Anidamiento
export const C4_NESTING: NestingRule[] = [
  { parent: 'SoftwareSystem', child: 'Container', relationTypes: [] },
  { parent: 'Container', child: 'Component', relationTypes: [] },
  { parent: 'Component', child: 'Code', relationTypes: [] },
  { parent: 'DeploymentNode', child: 'DeploymentNode', relationTypes: [] },
  { parent: 'DeploymentNode', child: 'Container', relationTypes: [] },
  { parent: 'Boundary', child: '*', relationTypes: [] },
];

// ---------------------------------------------------------------- Viewpoints (niveles C4)
const P = 'c4:Person', S = 'c4:SoftwareSystem', C = 'c4:Container', K = 'c4:Component', D = 'c4:Code', N = 'c4:DeploymentNode', B = 'c4:Boundary';
export const C4_VIEWPOINTS: Viewpoint[] = [
  { id: 'context', name: 'Contexto', doc: 'Nivel 1: el sistema y su entorno (personas y otros sistemas).', elementTypes: [P, S, B] },
  { id: 'container', name: 'Contenedor', doc: 'Nivel 2: contenedores dentro de un sistema.', elementTypes: [P, S, C, B] },
  { id: 'component', name: 'Componente', doc: 'Nivel 3: componentes dentro de un contenedor.', elementTypes: [P, S, C, K, B] },
  { id: 'code', name: 'Código', doc: 'Nivel 4: código de un componente.', elementTypes: [P, S, C, K, D, B] },
  { id: 'deployment', name: 'Despliegue', doc: 'Nodos de despliegue con instancias de contenedores y sistemas.', elementTypes: [N, C, S, B] },
];

export const C4_PACK: NotationPack = {
  id: 'c4',
  name: 'C4',
  version: '0.1.0',
  doc: 'Modelo C4: contexto, contenedores, componentes, código y despliegue. Cada nivel es un viewpoint; la jerarquía se expresa anidando.',
  color: C4_COLORS.system,
  viewKind: 'freeform',
  categories: [
    { id: CAT.people, name: 'Personas', color: C4_COLORS.person, order: 0 },
    { id: CAT.static, name: 'Estructura', color: C4_COLORS.system, order: 1 },
    { id: CAT.deployment, name: 'Despliegue', order: 2 },
  ],
  elementTypes: C4_ELEMENT_TYPES,
  relationTypes: C4_RELATION_TYPES,
  portTypes: [],
  validity: C4_VALIDITY,
  viewpoints: C4_VIEWPOINTS,
  nesting: C4_NESTING,
  defaultRelation: REL,
};

export default C4_PACK;
