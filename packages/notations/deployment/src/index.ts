/**
 * Pack `deployment`: diagrama de despliegue de UML 2.5 como datos puros.
 *
 * - **Nodo**, **dispositivo** («device») y **entorno de ejecución** («executionEnvironment») son cajas 3D anidables:
 *   un servidor contiene un contenedor Docker que contiene una JVM…
 * - **Artefacto** y **especificación de despliegue** («deployment spec»): rectángulo con el icono de documento.
 *   **Componente**: el que el artefacto manifiesta (rectángulo con el icono de componente).
 * - Relaciones: **ruta de comunicación** entre nodos (línea continua con el protocolo), **despliegue** («deploy») de un
 *   artefacto en un nodo, **manifestación** («manifest») de un componente en un artefacto y **dependencia** (la
 *   especificación de despliegue que configura un artefacto o un nodo).
 * - Anidar un artefacto dentro de un nodo equivale a desplegarlo allí (no se crea relación).
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType } from '@all-draw/core';

const NS = 'deployment';
export const DEPLOYMENT_PACK_ID = NS;
const CAT = { nodes: 'nodes', artifacts: 'artifacts', relations: 'relations' } as const;
export const COMMUNICATION = `${NS}:CommunicationPath`;
export const DEPLOY = `${NS}:Deploy`;
export const MANIFESTATION = `${NS}:Manifestation`;
export const DEPENDENCY = `${NS}:Dependency`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

const stereotype = { key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«server», «cloud», «container»…' } as const;

export const DEPLOYMENT_ELEMENT_TYPES: ElementType[] = [
  el('Node', 'Nodo', CAT.nodes, {
    shape: 'rect', container: true, color: '#F5F5F5', icon: '▦',
    doc: 'Recurso de cómputo donde se despliegan artefactos (servidor, máquina virtual, clúster). Caja 3D; contiene otros nodos, dispositivos, entornos y artefactos.',
    fields: [stereotype, { key: 'os', label: 'Sistema operativo', kind: 'text' }, { key: 'instances', label: 'Instancias', kind: 'number' }],
  }),
  el('Device', 'Dispositivo', CAT.nodes, {
    shape: 'rect', container: true, color: '#DAE8FC', icon: '▣',
    doc: 'Nodo físico («device»): servidor, móvil, router, sensor. Caja 3D; contiene entornos de ejecución y artefactos.',
    fields: [stereotype],
    meta: { stereotypeDefault: 'device' },
  }),
  el('ExecutionEnvironment', 'Entorno de ejecución', CAT.nodes, {
    shape: 'rect', container: true, color: '#E8F5E9', icon: '▤',
    doc: 'Software que aloja artefactos («executionEnvironment»): sistema operativo, contenedor, JVM, servidor de aplicaciones, navegador. Caja 3D anidable.',
    fields: [stereotype, { key: 'technology', label: 'Tecnología', kind: 'text', doc: 'Docker 27, OpenJDK 21, Node 24…' }],
    meta: { stereotypeDefault: 'executionEnvironment' },
  }),
  el('Artifact', 'Artefacto', CAT.artifacts, {
    shape: 'rect', color: '#FFFFFF',
    doc: 'Pieza física que se despliega («artifact»): ejecutable, librería, imagen de contenedor, script, fichero de configuración. Rectángulo con el icono de documento.',
    fields: [{ key: 'fileName', label: 'Fichero', kind: 'text', doc: 'pedidos.jar, api:1.4.2…' }, { key: 'version', label: 'Versión', kind: 'text' }],
  }),
  el('DeploymentSpecification', 'Especificación de despliegue', CAT.artifacts, {
    shape: 'rect', color: '#FFF2CC',
    doc: 'Parámetros con los que se despliega un artefacto en un nodo («deployment spec»): puertos, réplicas, variables. Se une con una dependencia al artefacto o al nodo.',
    fields: [{ key: 'properties', label: 'Propiedades', kind: 'keyvalue', options: 'Propiedad|Valor', port: false }],
    meta: { stereotypeDefault: 'deployment spec' },
  }),
  el('Component', 'Componente', CAT.artifacts, {
    shape: 'rect', color: '#DAE8FC',
    doc: 'Componente lógico que un artefacto manifiesta. Se detalla en un diagrama de componentes.',
  }),
];

export const DEPLOYMENT_RELATION_TYPES: RelationType[] = [
  {
    id: COMMUNICATION, name: 'Ruta de comunicación', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none',
    fields: [{ key: 'protocol', label: 'Protocolo', kind: 'text', doc: 'HTTPS, JDBC, AMQP, gRPC…' }],
    doc: 'Canal por el que dos nodos intercambian mensajes (línea continua, con el protocolo).',
  },
  {
    id: DEPLOY, name: 'Despliegue', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', fields: [], meta: { keyword: '«deploy»' },
    doc: 'El artefacto origen se instala en el nodo destino: flecha discontinua rotulada «deploy» (equivale a dibujarlo dentro).',
  },
  {
    id: MANIFESTATION, name: 'Manifestación', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', fields: [], meta: { keyword: '«manifest»' },
    doc: 'El artefacto origen es la forma física del componente destino: flecha discontinua rotulada «manifest».',
  },
  {
    id: DEPENDENCY, name: 'Dependencia', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«use», «configure»…' }],
    doc: 'La especificación de despliegue configura un artefacto o un nodo; o un artefacto necesita a otro.',
  },
];

const NODES = ['Node', 'Device', 'ExecutionEnvironment'];

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  const add = (s: string, t: string, rel: string) => { const row = (m[s] ??= {}); row[t] = [...new Set([...(row[t] ?? []), rel])]; };
  for (const t of DEPLOYMENT_ELEMENT_TYPES) m[t.id.slice(NS.length + 1)] = {};
  for (const a of NODES) for (const b of NODES) add(a, b, COMMUNICATION);
  for (const n of NODES) { add('Artifact', n, DEPLOY); add('DeploymentSpecification', n, DEPLOY); add('DeploymentSpecification', n, DEPENDENCY); }
  add('Artifact', 'Component', MANIFESTATION);
  add('DeploymentSpecification', 'Artifact', DEPENDENCY);
  add('Artifact', 'Artifact', DEPENDENCY);
  return m;
}

export const DEPLOYMENT_VALIDITY: ValidityMatrix = buildValidity();

export const DEPLOYMENT_NESTING: NestingRule[] = [
  ...['Node', 'Device'].flatMap(parent => ['Node', 'Device', 'ExecutionEnvironment', 'Artifact', 'DeploymentSpecification', 'Component'].map(child => ({ parent, child, relationTypes: [] }))),
  ...['ExecutionEnvironment', 'Artifact', 'DeploymentSpecification', 'Component'].map(child => ({ parent: 'ExecutionEnvironment', child, relationTypes: [] })),
];

export const DEPLOYMENT_PACK: NotationPack = {
  id: NS,
  name: 'Despliegue (UML)',
  version: '0.1.0',
  doc: 'Nodos, dispositivos y entornos de ejecución (cajas 3D anidables) con los artefactos que se despliegan en ellos, rutas de comunicación, «deploy» y «manifest».',
  color: '#82B366',
  viewKind: 'freeform',
  categories: [
    { id: CAT.nodes, name: 'Nodos', order: 0 },
    { id: CAT.artifacts, name: 'Artefactos', order: 1 },
    { id: CAT.relations, name: 'Relaciones', order: 2 },
  ],
  elementTypes: DEPLOYMENT_ELEMENT_TYPES,
  relationTypes: DEPLOYMENT_RELATION_TYPES,
  portTypes: [],
  validity: DEPLOYMENT_VALIDITY,
  viewpoints: [],
  nesting: DEPLOYMENT_NESTING,
  defaultRelation: COMMUNICATION,
};

export default DEPLOYMENT_PACK;
