/**
 * Espacios de prueba con ids fijos (para que las instantáneas sean estables).
 */
import { emptyWorkspace, makeEdge, makeElement, makeNode, makeRelation, makeView, type Element, type Relation, type View, type Workspace } from '@all-draw/core';
import { importXState, type XStateConfig } from '@all-draw/io';

export function builder(name: string) {
  const ws = emptyWorkspace(name);
  delete ws.meta.createdAt;
  let y = 0;
  const api = {
    ws,
    el(id: string, typeId: string, elName: string, extra: Partial<Element> = {}): Element {
      ws.elements[id] = makeElement(typeId, elName, { id, ...extra });
      return ws.elements[id]!;
    },
    view(id: string, viewName: string, notationId: string, extra: Partial<View> = {}): View {
      ws.views[id] = makeView(viewName, { id, notationId, ...extra });
      return ws.views[id]!;
    },
    /** Nodo `<vista>/<elemento>`; `parent` = id del elemento padre en esa vista. */
    node(viewId: string, elementId: string, parent?: string): string {
      const id = `${viewId}/${elementId}`;
      ws.nodes[id] = makeNode(viewId, elementId, { x: 0, y: (y += 80) }, { id, ...(parent ? { parentNodeId: `${viewId}/${parent}` } : {}) });
      return id;
    },
    rel(id: string, typeId: string, from: string, to: string, extra: Partial<Relation> = {}, views: string[] = []): Relation {
      const fromEnd = { elementId: from, ...(extra.from ?? {}) }, toEnd = { elementId: to, ...(extra.to ?? {}) };
      ws.relations[id] = makeRelation(typeId, fromEnd, toEnd, { id, ...extra, from: fromEnd, to: toEnd });
      for (const v of views) ws.edges[`${v}/${id}`] = makeEdge(v, id, `${v}/${from}`, `${v}/${to}`, { id: `${v}/${id}` });
      return ws.relations[id]!;
    },
  };
  return api;
}

// ---------------------------------------------------------------- UML
export function umlWorkspace(): Workspace {
  const b = builder('Tienda');
  const V = 'v-uml';
  b.view(V, 'Clases de la tienda', 'uml');
  b.el('pkg', 'uml:Package', 'Ventas', { fields: { namespace: 'com.acme.ventas' } });
  b.el('persona', 'uml:Class', 'Persona', {
    doc: 'Alguien que interactúa con la tienda.',
    fields: { abstract: true, attributes: ['- nombre: String', '# fechaAlta: Date', '+ {static} contador: int = 0'], operations: ['+ describir(): String {abstract}', '+ saludar(otro: Persona): void'] },
  });
  b.el('cliente', 'uml:Class', 'Cliente', {
    fields: { stereotype: 'entity', attributes: ['- email: String [0..1]', '- puntos: Integer = 0', '/nivel: Nivel'], operations: ['+ comprar(pedido: Pedido, n: int): void', '- recalcular()'] },
  });
  b.el('pagable', 'uml:Interface', 'Pagable', { fields: { operations: ['pagar(importe: Decimal): boolean'] } });
  b.el('facturable', 'uml:Interface', 'Facturable', { fields: { operations: ['facturar(): String'] } });
  b.el('pedido', 'uml:Class', 'Pedido', {
    fields: {
      attributes: ['- id: UUID', '- total: double = 0', '- estado: EstadoPedido = PENDIENTE', '- etiquetas: List<String>', '- extra: Mapa', '~ creado: LocalDate', '- descuento: float = 0.5'],
      operations: ['+ pagar(importe: Decimal): boolean', '+ buscar(codigo: String): LineaDePedido[0..1]'],
    },
  });
  b.el('linea', 'uml:Class', 'Línea de pedido', { fields: { attributes: ['- cantidad: int', '- nombre del producto: String', '# precios: double[*]'] } });
  b.el('estado', 'uml:Enum', 'EstadoPedido', { fields: { values: ['PENDIENTE', 'PAGADO', 'en envío'] } });
  b.el('nivel', 'uml:Enum', 'Nivel', { fields: { values: ['BRONCE', 'PLATA'] } });
  b.node(V, 'pkg');
  for (const id of ['pedido', 'linea', 'estado']) b.node(V, id, 'pkg');
  for (const id of ['persona', 'cliente', 'pagable', 'facturable', 'nivel']) b.node(V, id);
  b.rel('r-gen', 'uml:Generalization', 'cliente', 'persona', {}, [V]);
  b.rel('r-ext', 'uml:Generalization', 'facturable', 'pagable', {}, [V]);
  b.rel('r-real', 'uml:Realization', 'pedido', 'facturable', {}, [V]);
  b.rel('r-comp', 'uml:Composition', 'pedido', 'linea', { fields: { targetRole: 'lineas', targetCard: '1..*' } }, [V]);
  b.rel('r-asoc', 'uml:Association', 'cliente', 'pedido', { name: 'realiza', fields: { navigable: 'both', targetCard: '0..*', sourceRole: 'cliente', sourceCard: '1' } }, [V]);
  return b.ws;
}

/** Casos límite: ciclo de herencia, herencia múltiple, nombres duplicados y raros, tipo fuera de la vista. */
export function umlEdgeWorkspace(): Workspace {
  const b = builder('Raro');
  const V = 'v-raro';
  b.view(V, 'Raro', 'uml');
  b.view('v-vacia', 'Vacía', 'uml');
  b.el('a', 'uml:Class', 'A', { fields: { attributes: ['x: B', 'y: Fuera'] } });
  b.el('b', 'uml:Class', 'B');
  b.el('c', 'uml:Class', 'C', { fields: { attributes: ['class: int', 'class: String', 'sin tipo'] } });
  b.el('d1', 'uml:Class', 'Cosa');
  b.el('d2', 'uml:Class', 'cosa?');
  b.el('d3', 'uml:Class', 'Cosa');
  b.el('fuera', 'uml:Class', 'Fuera');
  b.el('i', 'uml:Interface', 'I');
  b.el('e', 'uml:Class', 'E', { fields: { attributes: [': int'], operations: ['calcular(): int {abstract}'] } });
  for (const id of ['a', 'b', 'c', 'd1', 'd2', 'd3', 'i', 'e']) b.node(V, id);
  b.rel('g1', 'uml:Generalization', 'a', 'b', {}, [V]);
  b.rel('g2', 'uml:Generalization', 'b', 'a', {}, [V]);
  b.rel('g3', 'uml:Generalization', 'c', 'b', {}, [V]);
  b.rel('g4', 'uml:Generalization', 'c', 'd1', {}, [V]);
  b.rel('g5', 'uml:Generalization', 'i', 'c', {}, [V]);
  b.rel('re', 'uml:Realization', 'a', 'b', {}, [V]);
  return b.ws;
}

// ---------------------------------------------------------------- ER
export function erWorkspace(): Workspace {
  const b = builder('Comercio');
  const V = 'v-er';
  b.view(V, 'Modelo de datos', 'er');
  b.el('cliente', 'er:Entity', 'Cliente', {
    doc: 'Clientes registrados.',
    fields: { attributes: [{ key: 'id', value: 'serial' }, { key: 'nombre', value: 'varchar(100) not null' }, { key: 'email', value: 'varchar(200) unique' }], pk: ['id'] },
  });
  b.el('pedido', 'er:Entity', 'Pedido', { fields: { attributes: [{ key: 'id', value: 'int' }, { key: 'fecha', value: 'datetime' }, { key: 'total', value: 'decimal(10,2)' }, { key: 'meta', value: 'hstore' }], pk: [] } });
  b.el('producto', 'er:Entity', 'Producto', { fields: { table: 'productos', attributes: [{ key: 'codigo', value: 'varchar(20)' }, { key: 'precio', value: 'money' }, { key: 'activo', value: 'bool' }], pk: ['codigo'] } });
  b.el('linea', 'er:Entity', 'Línea de pedido', { fields: { attributes: [{ key: 'pedido_id', value: 'int' }, { key: 'num', value: 'int' }, { key: 'cantidad', value: 'int' }], pk: ['pedido_id', 'num'] } });
  b.el('perfil', 'er:Entity', 'Perfil', { fields: { attributes: [{ key: 'id', value: 'uuid' }, { key: 'Fecha alta', value: 'date' }, { key: 'order', value: 'int' }, { key: 'datos', value: 'jsonb' }], pk: ['id'] } });
  b.el('empresa', 'er:Entity', 'Empresa', { fields: { attributes: [{ key: 'cif', value: 'varchar(9)' }] } });
  b.el('sinpk', 'er:Entity', 'Nota', { fields: { attributes: [{ key: 'texto', value: '' }] } });
  b.el('vista', 'er:View', 'Ventas por cliente', { fields: { query: 'SELECT cliente_id, sum(total) FROM pedido GROUP BY cliente_id', materialized: true } });
  for (const id of ['cliente', 'pedido', 'producto', 'linea', 'perfil', 'empresa', 'sinpk', 'vista']) b.node(V, id);
  b.rel('r1', 'er:OneToMany', 'cliente', 'pedido', { name: 'realiza', fields: { sourceCard: '0..1', targetCard: '0..*', onDelete: 'set null' } }, [V]);
  b.rel('r2', 'er:OneToMany', 'pedido', 'linea', { from: { portId: 'pedido#attributes.id' }, to: { portId: 'linea#attributes.pedido_id' }, fields: { onDelete: 'cascade' } }, [V]);
  b.rel('r3', 'er:OneToMany', 'producto', 'linea', { fields: { sourceCard: '1', targetCard: '0..*' } }, [V]);
  b.rel('r4', 'er:ManyToMany', 'cliente', 'producto', { name: 'favoritos' }, [V]);
  b.rel('r5', 'er:OneToOne', 'cliente', 'perfil', {}, [V]);
  b.rel('r6', 'er:Inherits', 'empresa', 'cliente', { fields: { kind: 'joined' } }, [V]);
  b.rel('r7', 'er:OneToMany', 'cliente', 'cliente', { name: 'recomendado por', fields: { sourceCard: '0..1' } }, [V]);
  return b.ws;
}

export function erCycleWorkspace(): Workspace {
  const b = builder('Ciclo');
  b.view('v', 'Ciclo', 'er');
  b.el('dep', 'er:Entity', 'Departamento', { fields: { attributes: [{ key: 'id', value: 'int' }] } });
  b.el('emp', 'er:Entity', 'Empleado', { fields: { attributes: [{ key: 'id', value: 'int' }] } });
  b.node('v', 'dep'); b.node('v', 'emp');
  b.rel('c1', 'er:OneToMany', 'dep', 'emp', { name: 'trabaja en' }, ['v']);
  b.rel('c2', 'er:OneToMany', 'emp', 'dep', { name: 'dirige', fields: { sourceCard: '0..1', targetCard: '0..1' } }, ['v']);
  return b.ws;
}

/** Casos límite ER: PK inexistente, FK a tabla sin PK, columnas de puertos que no encajan, SET NULL imposible, herencias. */
export function erEdgeWorkspace(): Workspace {
  const b = builder('ER raro');
  b.view('v', 'ER raro', 'er');
  b.el('a', 'er:Entity', 'A', { fields: { attributes: [{ key: 'id', value: 'int' }, { key: 'codigo', value: 'text' }], pk: ['id', 'falta'] } });
  b.el('b', 'er:Entity', 'B', { fields: { attributes: [{ key: 'x', value: 'int' }, { key: 'y', value: 'int' }] } });
  b.el('c', 'er:Entity', 'C', { fields: { attributes: [{ key: 'k1', value: 'int' }, { key: 'k2', value: 'int' }], pk: ['k1', 'k2'] } });
  b.el('d', 'er:Entity', 'D', { fields: { attributes: [{ key: 'id', value: 'int' }] } });
  for (const id of ['a', 'b', 'c', 'd']) b.node('v', id);
  b.rel('e1', 'er:OneToMany', 'b', 'a', {}, ['v']);
  b.rel('e2', 'er:OneToMany', 'a', 'd', { mappings: [{ fromPath: 'attributes.id', toPath: 'attributes.a1' }, { fromPath: 'attributes.codigo', toPath: 'attributes.a2' }] }, ['v']);
  b.rel('e3', 'er:OneToMany', 'a', 'c', { from: { portId: 'a#attributes.codigo' }, fields: { onDelete: 'set null' } }, ['v']);
  b.rel('e4', 'er:Inherits', 'd', 'a', { fields: { kind: 'single table' } }, ['v']);
  b.rel('e5', 'er:Inherits', 'c', 'd', {}, ['v']);
  b.rel('e6', 'er:OneToMany', 'c', 'd', { to: { portId: 'd#attributes.cref' } }, ['v']);
  return b.ws;
}

// ---------------------------------------------------------------- Máquina de estados
export const CAJERO: XStateConfig = {
  id: 'cajero',
  initial: 'inactivo',
  states: {
    inactivo: { entry: 'apagarPantalla', on: { TARJETA: { target: 'operando', actions: ['leer tarjeta'] }, REVISAR: 'revisando' } },
    revisando: { always: [{ target: 'operando', guard: 'tieneTarjeta' }, { target: 'inactivo' }] },
    operando: {
      initial: 'pin',
      exit: 'expulsarTarjeta',
      states: {
        pin: { on: { PIN_OK: 'menu', PIN_KO: { target: 'pin', actions: ['x = x + 1'] } }, after: { '5s': '#cajero.inactivo' } },
        menu: { on: { RETIRAR: { target: 'dispensando', guard: 'saldo > 0' } } },
        dispensando: { after: { 2000: 'fin' } },
        fin: { type: 'final' },
      },
      on: { CANCELAR: 'inactivo' },
    },
  },
};

export function statechartWorkspace(): Workspace {
  return importXState(CAJERO).workspace;
}

/** Máquina con un pseudoestado sin equivalente en XState (Fork) y un retardo ilegible. */
export function statechartEdgeWorkspace(): Workspace {
  const b = builder('Rara');
  b.view('v-sc', 'Rara', 'statechart');
  b.el('ini', 'statechart:Initial', '');
  b.el('s1', 'statechart:State', 'uno');
  b.el('s2', 'statechart:State', 'dos');
  b.el('fk', 'statechart:Fork', 'bifurca');
  for (const id of ['ini', 's1', 's2', 'fk']) b.node('v-sc', id);
  b.rel('t0', 'statechart:Transition', 'ini', 's1', { fields: { event: '' } }, ['v-sc']);
  b.rel('t1', 'statechart:Transition', 's1', 's2', { fields: { delay: 'pronto' } }, ['v-sc']);
  b.rel('t2', 'statechart:Transition', 's2', 'fk', { fields: { event: 'IR' } }, ['v-sc']);
  return b.ws;
}

// ---------------------------------------------------------------- APIs
export function apiWorkspace(): Workspace {
  const b = builder('Plataforma');
  b.el('api-cli', 'lib:api', 'Clientes API', {
    template: true, libraryId: 'lib:apis', doc: 'Gestión de clientes.',
    fields: { version: '2.1', docsUrl: 'https://docs.ejemplo.com', baseUrls: [{ key: 'prod', value: 'https://api.ejemplo.com/v2' }, { key: 'dev', value: 'http://localhost:8080' }] },
  });
  const op = (id: string, name: string, fields: Record<string, unknown>, extra: Partial<Element> = {}) => {
    b.el(id, 'lib:apiOperation', name, { template: true, libraryId: 'lib:apis', fields, ...extra });
  };
  op('op-list', 'Lista clientes', {
    method: 'GET', path: '/clientes', summary: 'Lista paginada de clientes',
    queryParams: [{ key: 'page', value: 'integer · número de página' }, { key: 'q', value: 'texto libre' }],
    headers: [{ key: 'X-Trace', value: 'string · obligatorio · traza' }],
    responseBody: JSON.stringify([{ id: 1, nombre: 'Ana', alta: '2026-01-01T10:00:00Z', saldo: 10.5, vip: false, jefe: null }]),
    codes: [{ key: '200', value: 'OK' }, { key: '500', value: 'Error interno' }],
  }, { tags: ['clientes'] });
  op('op-create', 'Crea cliente', {
    method: 'POST', path: '/clientes', requestBody: '{"nombre":"Ana","email":"ana@ejemplo.com"}', responseBody: '{"id":7}',
    codes: [{ key: '201', value: 'Creado' }, { key: '400', value: '' }],
  }, { tags: ['clientes', 'deprecated'], doc: 'Da de alta un cliente.' });
  op('op-del', 'Borra cliente', {
    method: 'delete', path: '/clientes/{id}/{rama}', pathParams: [{ key: 'id', value: 'integer · obligatorio · identificador' }],
    codes: [{ key: '204', value: 'Sin contenido' }, { key: '404', value: 'No existe' }],
  });
  op('op-bad', 'Importa clientes', { method: 'PUT', path: 'clientes/import', requestBody: '{roto', codes: [] });
  op('op-sola', 'Salud', { method: 'GET', path: '/health', responseBody: '{"ok":true}' });
  op('op-dup', 'Lista clientes otra vez', { method: 'GET', path: '/clientes' });
  op('op-nopath', 'Sin path', { method: 'GET' });
  for (const id of ['op-list', 'op-create', 'op-del', 'op-bad', 'op-dup', 'op-nopath']) {
    b.rel(`rel-${id}`, 'core:link', id, 'api-cli', { name: 'operación de' });
  }
  // una vista con una instancia de una operación (hereda los campos de la plantilla)
  b.view('v-grid', 'Arquitectura', 'grid', { kind: 'grid' });
  b.el('inst-list', 'lib:apiOperation', '', { templateId: 'op-list', fields: { summary: '' } });
  b.node('v-grid', 'inst-list');
  b.view('v-salud', 'Salud', 'freeform');
  b.node('v-salud', 'op-sola');
  return b.ws;
}

// ---------------------------------------------------------------- C4 y ArchiMate
export function c4Workspace(): Workspace {
  const b = builder('Tienda "online"');
  b.ws.meta.description = 'Arquitectura de la tienda.';
  b.el('cliente', 'c4:Person', 'Cliente', { doc: 'Compra productos.' });
  b.el('admin', 'c4:Person', 'Administrador');
  b.el('tienda', 'c4:SoftwareSystem', 'Tienda online', { doc: 'Vende productos.' });
  b.el('pasarela', 'c4:SoftwareSystem', 'Pasarela de pago', { fields: { external: true } });
  b.el('web', 'c4:Container', 'Web', { fields: { technology: 'React' }, features: { parentId: 'tienda' } });
  b.el('api', 'c4:Container', 'API', { fields: { technology: 'Node.js' }, doc: 'API "REST".' });
  b.el('bd', 'c4:Container', 'Base de datos', { fields: { technology: 'PostgreSQL', kind: 'database' }, features: { parentId: 'tienda' } });
  b.el('ctrl', 'c4:Component', 'Controlador de pedidos', { fields: { technology: 'Express' } });
  b.el('huerfano', 'c4:Component', 'Huérfano');
  b.el('codigo', 'c4:Code', 'Pedido.ts');
  b.el('aws', 'c4:DeploymentNode', 'AWS', { fields: { technology: 'Cloud' } });
  b.el('ec2', 'c4:DeploymentNode', 'EC2', { fields: { technology: 'Ubuntu', instances: 2 } });
  // contexto
  b.view('v-ctx', 'Contexto', 'c4', { viewpointId: 'context' });
  for (const id of ['cliente', 'admin', 'tienda', 'pasarela']) b.node('v-ctx', id);
  b.rel('u1', 'c4:Uses', 'cliente', 'tienda', { name: 'Compra en' }, ['v-ctx']);
  b.rel('u2', 'c4:Relationship', 'tienda', 'pasarela', { name: 'Cobra con', fields: { technology: 'HTTPS' } }, ['v-ctx']);
  // contenedores
  b.view('v-cont', 'Contenedores', 'c4', { viewpointId: 'container' });
  b.node('v-cont', 'cliente');
  b.node('v-cont', 'tienda');
  for (const id of ['web', 'api', 'bd']) b.node('v-cont', id, 'tienda');
  b.rel('u3', 'c4:Uses', 'cliente', 'web', { name: 'Usa' }, ['v-cont']);
  b.rel('u4', 'c4:Uses', 'web', 'api', { name: 'Llama a', fields: { technology: 'JSON/HTTPS' } }, ['v-cont']);
  b.rel('u5', 'c4:Uses', 'api', 'bd', { fields: { description: 'Lee y escribe' } }, ['v-cont']);
  // componentes
  b.view('v-comp', 'Componentes de la API', 'c4', { viewpointId: 'component' });
  b.node('v-comp', 'api');
  b.node('v-comp', 'ctrl', 'api');
  b.node('v-comp', 'huerfano');
  b.node('v-comp', 'codigo');
  b.rel('u6', 'c4:Uses', 'ctrl', 'bd', { name: 'Consulta' });
  b.rel('u7', 'c4:Uses', 'ctrl', 'codigo', { name: 'Usa' }, ['v-comp']);
  // contexto sin sistema de referencia
  b.view('v-solo', 'Solo personas', 'c4', { viewpointId: 'context' });
  b.node('v-solo', 'admin');
  // despliegue
  b.view('v-dep', 'Despliegue', 'c4', { viewpointId: 'deployment', props: { environment: 'Producción' } });
  b.node('v-dep', 'aws');
  b.node('v-dep', 'ec2', 'aws');
  b.node('v-dep', 'api', 'ec2');
  return b.ws;
}

export function archimateWorkspace(): Workspace {
  const b = builder('Empresa');
  b.view('v-am', 'Visión general', 'archimate');
  b.el('actor', 'archimate:BusinessActor', 'Cliente');
  b.el('crm', 'archimate:ApplicationComponent', 'CRM');
  b.el('proc', 'archimate:BusinessProcess', 'Alta de cliente', { doc: 'Registrar un cliente nuevo.' });
  b.el('srv', 'archimate:ApplicationService', 'Gestión de clientes');
  for (const id of ['actor', 'crm', 'proc', 'srv']) b.node('v-am', id);
  b.rel('a1', 'archimate:Assignment', 'actor', 'proc', {}, ['v-am']);
  b.rel('a2', 'archimate:Serving', 'srv', 'proc', { name: 'soporta' }, ['v-am']);
  b.rel('a3', 'archimate:Realization', 'crm', 'srv', {}, ['v-am']);
  return b.ws;
}
