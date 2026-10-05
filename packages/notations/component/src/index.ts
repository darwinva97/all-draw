/**
 * Pack `component`: diagrama de componentes de UML 2.5 como datos puros.
 *
 * - **Componente**: rectángulo con el icono de componente (caja con dos pestañas) arriba a la derecha; es contenedor
 *   (subcomponentes, puertos e interfaces van dentro).
 * - **Interfaz proporcionada** (círculo, «lollipop») e **interfaz requerida** (semicírculo, «socket»): se unen al
 *   componente o al puerto con una línea continua (Proporciona / Requiere). El **ensamblaje** encaja una requerida con
 *   una proporcionada (o une dos componentes o dos puertos); la **delegación** reenvía de un puerto a la parte que hace
 *   el trabajo.
 * - **Puerto**: cuadrado pequeño sobre el borde del componente. **Artefacto**: rectángulo con el icono de documento.
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType } from '@all-draw/core';

const NS = 'component';
export const COMPONENT_PACK_ID = NS;
const CAT = { components: 'components', interfaces: 'interfaces', structure: 'structure', relations: 'relations' } as const;
export const PROVIDES = `${NS}:Provides`;
export const REQUIRES = `${NS}:Requires`;
export const ASSEMBLY = `${NS}:Assembly`;
export const DELEGATION = `${NS}:Delegation`;
export const REALIZATION = `${NS}:Realization`;
export const DEPENDENCY = `${NS}:Dependency`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

const stereotype = { key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«subsystem», «service», «library»…' } as const;

export const COMPONENT_ELEMENT_TYPES: ElementType[] = [
  el('Component', 'Componente', CAT.components, {
    shape: 'rect', container: true, color: '#DAE8FC', icon: '▣',
    doc: 'Parte modular y reemplazable del sistema que ofrece y requiere interfaces. Rectángulo con el icono de componente; contiene subcomponentes, puertos e interfaces.',
    fields: [stereotype, { key: 'technology', label: 'Tecnología', kind: 'text' }],
  }),
  el('ProvidedInterface', 'Interfaz proporcionada', CAT.interfaces, {
    shape: 'circle', color: '#FFFFFF',
    doc: 'Interfaz que el componente ofrece (círculo, «lollipop»). Se une a su componente o puerto con Proporciona.',
    fields: [{ key: 'operations', label: 'Operaciones', kind: 'list', port: false, doc: 'Una por línea: "+ consultar(id): Pedido".' }],
  }),
  el('RequiredInterface', 'Interfaz requerida', CAT.interfaces, {
    shape: 'circle', color: '#FFFFFF',
    doc: 'Interfaz que el componente necesita (semicírculo, «socket»). Se une a su componente o puerto con Requiere y a la interfaz proporcionada que la satisface con Ensamblaje.',
    fields: [{ key: 'operations', label: 'Operaciones', kind: 'list', port: false, doc: 'Una por línea: "+ consultar(id): Pedido".' }],
  }),
  el('Port', 'Puerto', CAT.interfaces, {
    shape: 'circle', color: '#FFFFFF',
    doc: 'Punto de interacción del componente con su entorno: cuadrado pequeño sobre el borde. Agrupa interfaces proporcionadas y requeridas.',
  }),
  el('Artifact', 'Artefacto', CAT.structure, {
    shape: 'rect', color: '#FFFFFF',
    doc: 'Pieza física (fichero, librería, imagen) que implementa un componente. Rectángulo con el icono de documento.',
    fields: [{ key: 'fileName', label: 'Fichero', kind: 'text', doc: 'pedidos.jar, api:1.4.2…' }],
  }),
  el('Package', 'Paquete', CAT.structure, {
    shape: 'group', container: true, color: '#F5F5F5', icon: '▱',
    doc: 'Carpeta con pestaña que agrupa componentes, interfaces y artefactos.',
  }),
];

export const COMPONENT_RELATION_TYPES: RelationType[] = [
  {
    id: PROVIDES, name: 'Proporciona', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [],
    doc: 'Une un componente o puerto con la interfaz que ofrece (el palo del «lollipop»).',
  },
  {
    id: REQUIRES, name: 'Requiere', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [],
    doc: 'Une un componente o puerto con la interfaz que necesita (el palo del «socket»).',
  },
  {
    id: ASSEMBLY, name: 'Ensamblaje', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [],
    doc: 'Conector de ensamblaje: la interfaz requerida (origen) queda satisfecha por la proporcionada (destino); también entre dos componentes o dos puertos.',
  },
  {
    id: DELEGATION, name: 'Delegación', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'open', fields: [], meta: { keyword: '«delegate»' },
    doc: 'Conector de delegación: lo que llega a un puerto del componente lo atiende una de sus partes (flecha continua rotulada «delegate»).',
  },
  {
    id: REALIZATION, name: 'Realización', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'triangle', fields: [],
    doc: 'El componente origen implementa la interfaz o la especificación de componente del destino (discontinua con triángulo hueco).',
  },
  {
    id: DEPENDENCY, name: 'Dependencia', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«use», «import», «manifest»…' }],
    doc: 'El origen necesita al destino para funcionar (discontinua con flecha abierta).',
  },
];

const T = { C: 'Component', PI: 'ProvidedInterface', RI: 'RequiredInterface', P: 'Port', A: 'Artifact', K: 'Package' } as const;

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  const add = (s: string, t: string, ...rels: string[]) => { const row = (m[s] ??= {}); row[t] = [...new Set([...(row[t] ?? []), ...rels])]; };
  for (const s of Object.values(T)) m[s] = {};
  for (const s of [T.C, T.P]) { add(s, T.PI, PROVIDES); add(s, T.RI, REQUIRES); }
  add(T.RI, T.PI, ASSEMBLY);
  add(T.C, T.C, ASSEMBLY, REALIZATION, DEPENDENCY);
  add(T.P, T.P, ASSEMBLY, DELEGATION);
  add(T.P, T.C, DELEGATION);
  add(T.C, T.P, DELEGATION);
  add(T.C, T.PI, REALIZATION, DEPENDENCY);
  add(T.C, T.RI, DEPENDENCY);
  add(T.A, T.C, DEPENDENCY);
  add(T.A, T.A, DEPENDENCY);
  add(T.C, T.A, DEPENDENCY);
  add(T.K, T.K, DEPENDENCY);
  return m;
}

export const COMPONENT_VALIDITY: ValidityMatrix = buildValidity();

export const COMPONENT_NESTING: NestingRule[] = [
  ...[T.C, T.P, T.PI, T.RI, T.A].map(child => ({ parent: T.C, child, relationTypes: [] })),
  { parent: T.K, child: '*', relationTypes: [] },
];

export const COMPONENT_PACK: NotationPack = {
  id: NS,
  name: 'Componentes (UML)',
  version: '0.1.0',
  doc: 'Componentes, interfaces proporcionadas y requeridas, puertos, artefactos y paquetes con ensamblaje, delegación, realización y dependencia.',
  color: '#6C8EBF',
  viewKind: 'freeform',
  categories: [
    { id: CAT.components, name: 'Componentes', order: 0 },
    { id: CAT.interfaces, name: 'Interfaces y puertos', order: 1 },
    { id: CAT.structure, name: 'Estructura', order: 2 },
    { id: CAT.relations, name: 'Relaciones', order: 3 },
  ],
  elementTypes: COMPONENT_ELEMENT_TYPES,
  relationTypes: COMPONENT_RELATION_TYPES,
  portTypes: [],
  validity: COMPONENT_VALIDITY,
  viewpoints: [],
  nesting: COMPONENT_NESTING,
  defaultRelation: ASSEMBLY,
};

export default COMPONENT_PACK;
