import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, validate, allPorts, portId } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK } from '@all-draw/notation-grid';
import { importDrawer, exportWorkspace, importWorkspace, API_TYPE_ID, API_OPERATION_TYPE_ID, type DrawerFile } from '../src';

/** Fichero `.drawer` (formato `ExportFile` de Drawer v1) construido a mano. */
const FIXTURE: DrawerFile = {
  app: 'diagramador', version: 1, exportedAt: '2026-09-01T10:00:00.000Z',
  libraries: [
    {
      id: 'lib-sis', name: 'Sistemas',
      types: [{
        id: 't-svc', name: 'Microservicio', color: '#2563eb', icon: '⚙️',
        fields: [
          { key: 'lenguaje', label: 'Lenguaje', kind: 'select', options: 'Java, Go, Node' },
          { key: 'response_body', label: 'Response body (JSON)', kind: 'json' },
          { key: 'entornos', label: 'Entornos', kind: 'keyvalue', options: 'Entorno|URL' },
          { key: 'raro', label: 'Raro', kind: 'color' },
        ],
      }],
      components: [
        { id: 'c-crm', name: 'CRM', typeId: 't-svc', description: 'Clientes', fields: { lenguaje: 'Java', response_body: '{"cliente":{"id":1,"email":"a@b.c"}}', entornos: [{ key: 'dev', value: 'http://dev' }] } },
        { id: 'c-bff', name: 'BFF Web', typeId: 't-svc', description: '', fields: { response_body: '{"cliente":{"id":"x"}}' } },
        { id: 'c-legacy', name: 'Legacy', typeId: null, description: 'Sin tipo', fields: {} },
        { id: 'c-huerfano', name: 'Huérfano', typeId: 't-no-existe', description: '', fields: {} },
      ],
    },
    {
      id: 'lib-proc', name: 'Procesos',
      types: [{ id: 't-proc', name: 'Proceso', color: '#059669', icon: '📋', fields: [{ key: 'owner', label: 'Owner', kind: 'text' }] }],
      components: [
        { id: 'c-alta', name: 'Alta de cliente', typeId: 't-proc', description: '', fields: { owner: 'Ventas' } },
        { id: 'c-kyc', name: 'Verificación KYC', typeId: 't-proc', description: '', fields: {} },
      ],
    },
    {
      id: 'lib-apis', name: 'APIs (catálogo)', types: [],
      components: [{ id: 'api-A1', name: 'API Clientes', typeId: null, description: 'Catálogo de clientes', fields: { api: 'API Clientes', repo: 'https://git/x', version: 'v2' }, apiId: 'A1' }],
    },
  ],
  apis: [{
    id: 'A1', name: 'API Clientes', description: 'Catálogo de clientes', repoUrl: 'https://git/x', docsUrl: 'https://docs/x', version: 'v2', auth: 'Bearer JWT',
    baseUrls: [{ key: 'dev', value: 'https://dev.api' }, { key: 'prod', value: 'https://api' }], color: '#2563eb', icon: '🔌', tags: 'core, clientes',
    operations: [
      { id: 'o1', name: 'Obtener cliente', method: 'GET', path: '/clientes/{id}', summary: 'Devuelve un cliente', headers: [], pathParams: [{ key: 'id', value: 'string' }], queryParams: [], requestBody: '', responseBody: '{"cliente":{"id":1,"nombre":"Ana"}}', codes: [{ key: '200', value: 'OK' }], notes: '' },
      { id: 'o2', name: 'Crear cliente', method: 'POST', path: '/clientes', summary: '', deprecated: true, headers: [], pathParams: [], queryParams: [], requestBody: '{"nombre":"Ana"}', responseBody: '', codes: [], notes: '' },
    ],
  }],
  diagrams: [
    {
      id: 'd1', name: 'Alta', description: 'Flujo de alta', public: true,
      layers: [{ id: 'L1', name: 'Negocio', color: '#fef3c7', height: 200 }, { id: 'L2', name: 'Aplicación', color: '#ede9fe' }],
      stages: [{ id: 'S1', name: 'Captura', groupId: 'G1' }, { id: 'S2', name: 'Validación', width: 300, groupId: 'G1' }, { id: 'S3', name: 'Persistencia', groupId: 'G-roto' }],
      stageGroups: [{ id: 'G1', name: 'Front', color: '#dbeafe' }],
      placements: [
        { id: 'p-alta', componentId: 'c-alta', layerId: 'L1', stageId: 'S1', x: 8, y: 8 },
        { id: 'p-kyc', componentId: 'c-kyc', layerId: 'L1', stageId: 'S1', x: 16, y: 40, parentId: 'p-alta' },
        { id: 'p-crm', componentId: 'c-crm', layerId: 'L2', stageId: 'S2', x: 8, y: 8 },
        { id: 'p-api', componentId: 'api-A1', layerId: 'L2', stageId: 'S3', x: 8, y: 8, operationId: 'o1', note: 'lectura' },
        { id: 'p-fantasma', componentId: 'c-no-existe', layerId: 'L2', stageId: 'S3', x: 0, y: 0 },
      ],
      relations: [
        { id: 'r1', from: 'p-crm', to: 'p-api', fromField: 'response_body.cliente.id', toField: 'response_body.cliente.id', style: 'solid', dir: 'fwd', color: '#475569', width: 2, label: 'sincroniza' },
        { id: 'r2', from: 'p-alta', to: 'p-crm', style: 'dashed', dir: 'both', color: '#dc2626', width: 3, label: 'usa' },
        { id: 'r3', from: 'p-alta', to: 'p-fantasma', style: 'solid', dir: 'none', color: '#000', width: 1, label: '' },
        { id: 'r4', from: 'p-kyc', to: 'p-crm', fromField: 'owner', style: 'dotted', dir: 'fwd', color: '#000', width: 1, label: '' },
      ],
    },
    {
      id: 'd2', name: 'Resumen', description: '',
      layers: [{ id: 'L1', name: 'Todo', color: '#fff' }],
      stages: [{ id: 'S1', name: 'Única' }],
      placements: [
        { id: 'q-alta', componentId: 'c-alta', layerId: 'L1', stageId: 'S1', x: 0, y: 0 },
        { id: 'q-crm', componentId: 'c-crm', layerId: 'L1', stageId: 'S1', x: 200, y: 0 },
      ],
      relations: [{ id: 'r5', from: 'q-alta', to: 'q-crm', style: 'dashed', dir: 'both', color: '#dc2626', width: 3, label: 'usa' }],
    },
  ],
  people: [{
    id: 'per-1', name: 'Ana', email: 'ana@x.com', title: 'Arquitecta', team: 'Plataforma', color: '#2563eb',
    assignments: [
      { id: 'as-1', role: 'Owner', kind: 'component', targetId: 'c-crm' },
      { id: 'as-2', role: 'Stakeholder', kind: 'diagram', targetId: 'd1', notes: 'revisa' },
      { id: 'as-3', role: 'QA', kind: 'type', targetId: 't-svc' },
      { id: 'as-4', role: 'Owner', kind: 'component', targetId: 'c-no-existe' },
    ],
  }],
  rules: [
    { id: 'rule-1', name: 'Java en azul', enabled: true, priority: 1, match: 'all', conditions: [{ source: 'field', key: 'lenguaje', op: 'eq', value: 'Java' }, { source: 'description', op: 'notEmpty' }], style: { bg: '#dbeafe' }, diagramId: 'd1' },
    { id: 'rule-2', name: 'Fuera', enabled: false, priority: 0, match: 'any', conditions: [], style: {}, diagramId: 'd-no-existe' },
  ],
  currentDiagramId: 'd1',
};

const registryFor = (ws: ReturnType<typeof importDrawer>['workspace']) => {
  const reg = new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(GRID_PACK);
  for (const lib of Object.values(ws.libraries)) reg.registerLibraryTypes(lib);
  return reg;
};

describe('importDrawer', () => {
  const { workspace: ws, warnings } = importDrawer(FIXTURE);
  const reg = registryFor(ws);

  it('produce un workspace válido sin diagnósticos de error', () => {
    const diags = validate(new MemoryStore(ws), reg);
    expect(diags.filter(d => d.severity === 'error')).toEqual([]);
    expect(diags.filter(d => d.code === 'relation-missing-port')).toEqual([]);
    expect(diags.filter(d => d.code === 'unknown-element-type')).toEqual([]);
  });

  it('acepta el texto del fichero tal cual', () => {
    expect(importDrawer(JSON.stringify(FIXTURE)).workspace).toEqual(ws);
    expect(() => importDrawer({ foo: 1 })).toThrow();
  });

  it('librerías y tipos con ids estables y campos respetados', () => {
    expect(Object.keys(ws.libraries).sort()).toEqual(['lib-apis', 'lib-proc', 'lib-sis']);
    const svc = reg.elementType('lib:lib-sis:t-svc')!;
    expect(svc.name).toBe('Microservicio');
    expect(svc.fields.map(f => [f.key, f.kind, f.options])).toEqual([
      ['lenguaje', 'select', 'Java, Go, Node'], ['response_body', 'json', undefined], ['entornos', 'keyvalue', 'Entorno|URL'], ['raro', 'text', undefined],
    ]);
    expect(ws.libraries['lib-apis']!.elementTypes.map(t => t.id)).toEqual([API_TYPE_ID, API_OPERATION_TYPE_ID]);
  });

  it('componentes → un elemento por componente; usados no son plantilla, sin tipo → freeform:box', () => {
    expect(ws.elements['c-crm']).toMatchObject({ typeId: 'lib:lib-sis:t-svc', libraryId: 'lib-sis', template: false, doc: 'Clientes', fields: { lenguaje: 'Java' } });
    expect(ws.elements['c-bff']!.template).toBe(true);
    expect(ws.elements['c-legacy']!.typeId).toBe('freeform:box');
    expect(ws.elements['c-huerfano']!.typeId).toBe('freeform:box');
    expect(Object.values(ws.elements).filter(e => e.libraryId === 'lib-sis')).toHaveLength(4);
  });

  it('APIs → elemento API + elementos de operación enlazados con "operación de"', () => {
    const api = ws.elements['api-A1']!;
    expect(api).toMatchObject({ typeId: API_TYPE_ID, name: 'API Clientes', template: false, libraryId: 'lib-apis', tags: ['core', 'clientes'] });
    expect(api.fields).toMatchObject({ repoUrl: 'https://git/x', docsUrl: 'https://docs/x', version: 'v2', auth: 'Bearer JWT', baseUrls: [{ key: 'dev', value: 'https://dev.api' }, { key: 'prod', value: 'https://api' }] });
    const o1 = ws.elements['op-o1']!, o2 = ws.elements['op-o2']!;
    expect(o1).toMatchObject({ typeId: API_OPERATION_TYPE_ID, name: 'Obtener cliente', template: false, fields: { method: 'GET', path: '/clientes/{id}' } });
    expect(o2).toMatchObject({ template: true, tags: ['deprecated'] });
    const links = Object.values(ws.relations).filter(r => r.name === 'operación de');
    expect(links.map(r => [r.from.elementId, r.to.elementId]).sort()).toEqual([['op-o1', 'api-A1'], ['op-o2', 'api-A1']]);
    // los pines del contrato existen de verdad
    const ports = allPorts(o1, reg.fieldsOf(o1.typeId)).map(p => p.id);
    expect(ports).toContain(portId('op-o1', 'responseBody.cliente.id'));
    expect(ports).toContain(portId('op-o1', 'pathParams.id'));
    expect(ports).toContain(portId('op-o1', 'codes.200'));
  });

  it('diagramas → vistas grid conservando ids, tamaños y grupos', () => {
    const v = ws.views['d1']!;
    expect(v).toMatchObject({ kind: 'grid', notationId: 'grid', name: 'Alta', doc: 'Flujo de alta', public: true });
    expect(v.grid!.layers).toEqual([{ id: 'L1', name: 'Negocio', color: '#fef3c7', size: 200 }, { id: 'L2', name: 'Aplicación', color: '#ede9fe' }]);
    expect(v.grid!.stages).toEqual([{ id: 'S1', name: 'Captura', groupId: 'G1' }, { id: 'S2', name: 'Validación', size: 300, groupId: 'G1' }, { id: 'S3', name: 'Persistencia', groupId: null }]);
    expect(v.grid!.stageGroups).toEqual([{ id: 'G1', name: 'Front', color: '#dbeafe' }]);
    expect(ws.dimensions['dim_grid']).toMatchObject({ notationId: 'grid', kind: 'grid' });
    expect(ws.meta.currentViewId).toBe('d1');
  });

  it('placements → nodos con celda, anidamiento, nota y operación', () => {
    expect(ws.nodes['p-alta']).toMatchObject({ viewId: 'd1', elementId: 'c-alta', cell: { layerId: 'L1', stageId: 'S1' }, x: 8, y: 8 });
    expect(ws.nodes['p-kyc']).toMatchObject({ elementId: 'c-kyc', parentNodeId: 'p-alta' });
    expect(ws.nodes['p-api']).toMatchObject({ elementId: 'op-o1', note: 'lectura', meta: { apiId: 'A1', operationId: 'o1' } });
    expect(ws.nodes['p-fantasma']).toBeUndefined();
    expect(Object.values(ws.nodes).filter(n => n.viewId === 'd1')).toHaveLength(4);
    // el mismo elemento en dos vistas
    expect(ws.nodes['q-crm']!.elementId).toBe('c-crm');
  });

  it('relaciones con campos → puertos reales, mapeos y aristas con estilo', () => {
    const r1 = ws.relations['r1']!;
    expect(r1.typeId).toBe('core:link');
    expect(r1.name).toBe('sincroniza');
    expect(r1.from).toEqual({ elementId: 'c-crm', portId: 'c-crm#response_body.cliente.id' });
    expect(r1.to).toEqual({ elementId: 'op-o1', portId: 'op-o1#responseBody.cliente.id' });
    expect(r1.mappings).toEqual([{ fromPath: 'response_body.cliente.id', toPath: 'response_body.cliente.id' }]);
    expect(r1.fields).toEqual({ style: 'solid', dir: 'fwd', color: '#475569', width: 2 });
    const crm = ws.elements['c-crm']!;
    expect(allPorts(crm, reg.fieldsOf(crm.typeId)).some(p => p.id === r1.from.portId)).toBe(true);
    const op = ws.elements['op-o1']!;
    expect(allPorts(op, reg.fieldsOf(op.typeId)).some(p => p.id === r1.to.portId)).toBe(true);

    expect(ws.edges['r1']).toMatchObject({ viewId: 'd1', relationId: 'r1', fromNodeId: 'p-crm', toNodeId: 'p-api', fromPortId: r1.from.portId, toPortId: r1.to.portId, label: 'sincroniza', style: { line: 'solid', targetHead: 'arrow', sourceHead: 'none' } });
    expect(ws.edges['r2']!.style).toEqual({ line: 'dashed', color: '#dc2626', width: 3, targetHead: 'arrow', sourceHead: 'arrow' });
    // r3 apunta a un placement omitido; r4 usa un campo que no es puerto (texto): relación sin puerto
    expect(ws.edges['r3']).toBeUndefined();
    expect(ws.relations['r4']!.from).toEqual({ elementId: 'c-kyc' });
    expect(ws.relations['r4']!.mappings).toEqual([{ fromPath: 'owner', toPath: '' }]);
  });

  it('reutiliza una relación equivalente en el segundo diagrama', () => {
    expect(ws.relations['r5']).toBeUndefined();
    expect(ws.edges['r5']).toMatchObject({ viewId: 'd2', relationId: 'r2', fromNodeId: 'q-alta', toNodeId: 'q-crm' });
  });

  it('personas y reglas', () => {
    const ana = ws.people['per-1']!;
    expect(ana).toMatchObject({ name: 'Ana', email: 'ana@x.com', team: 'Plataforma', notes: 'Arquitecta' });
    expect(ana.assignments.map(a => [a.kind, a.targetId])).toEqual([['element', 'c-crm'], ['view', 'd1'], ['type', 'lib:lib-sis:t-svc']]);
    expect(ws.rules['rule-1']).toMatchObject({ viewId: 'd1', target: 'element', conditions: [{ source: 'field', key: 'lenguaje', op: 'eq', value: 'Java' }, { source: 'doc', op: 'notEmpty' }], style: { bg: '#dbeafe' } });
    expect(ws.rules['rule-2']!.viewId).toBeUndefined();
    expect(ws.rules['rule-2']!.enabled).toBe(false);
  });

  it('avisa (sin fallar) de las referencias rotas del origen', () => {
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('c-huerfano'),
      expect.stringContaining('G-roto'),
      expect.stringContaining('p-fantasma'),
      expect.stringContaining('r3'),
      expect.stringContaining('"owner" no es un puerto'),
      expect.stringContaining('c-no-existe'),
      expect.stringContaining('d-no-existe'),
      expect.stringContaining('clase desconocida (color)'),
    ]));
    expect(warnings.some(w => w.includes('p-kyc'))).toBe(false);
  });

  it('reconstruye una API mínima cuando el fichero no trae el catálogo', () => {
    const { workspace, warnings: w } = importDrawer({ ...FIXTURE, apis: undefined });
    expect(workspace.elements['api-A1']).toMatchObject({ typeId: API_TYPE_ID, fields: { repoUrl: 'https://git/x', version: 'v2' } });
    expect(workspace.nodes['p-api']).toMatchObject({ elementId: 'api-A1', meta: { apiId: 'A1' } });
    expect(w.some(x => x.includes('no está en el catálogo'))).toBe(true);
    expect(w.some(x => x.includes('operación inexistente o1'))).toBe(true);
  });

  it('ida y vuelta por JSON estable', () => {
    const text = exportWorkspace(ws);
    expect(importWorkspace(text)).toEqual(ws);
    expect(exportWorkspace(importWorkspace(text))).toBe(text);
    const lines = text.split('\n');
    expect(lines[0]).toBe('{');
    expect(lines[1]).toBe('  "comments": {},');
  });
});
