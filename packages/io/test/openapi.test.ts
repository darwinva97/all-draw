import { describe, it, expect } from 'vitest';
import { importOpenApi, API_TYPE_ID, API_OPERATION_TYPE_ID, OPENAPI_LIB_ID, apiElementId } from '../src';

const SPEC = {
  openapi: '3.0.3',
  info: { title: 'Clientes API', version: '2.1', description: 'Gestión de clientes', contact: { url: 'https://github.com/x/clientes' } },
  servers: [{ url: 'https://api.ejemplo.com/v2', description: 'prod' }, { url: 'http://localhost:8080', description: 'dev' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    schemas: {
      Direccion: { type: 'object', properties: { calle: { type: 'string', example: 'Mayor 1' }, cp: { type: 'string' } } },
      Base: { type: 'object', properties: { id: { type: 'integer' }, creado: { type: 'string', format: 'date-time' } } },
      Cliente: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', properties: { email: { type: 'string', format: 'email' }, direcciones: { type: 'array', items: { $ref: '#/components/schemas/Direccion' } }, estado: { type: 'string', enum: ['activo', 'baja'] }, jefe: { $ref: '#/components/schemas/Cliente' } } }] },
      Error: { type: 'object', properties: { code: { type: 'integer', default: 400 }, msg: { oneOf: [{ type: 'string' }, { type: 'null' }] } } },
    },
    parameters: { Trace: { name: 'X-Trace', in: 'header', schema: { type: 'string' }, description: 'traza' } },
  },
  paths: {
    '/clientes': {
      parameters: [{ $ref: '#/components/parameters/Trace' }],
      get: { operationId: 'listClientes', summary: 'Lista clientes', tags: ['clientes'], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Cliente' } } } } }, '500': { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      post: { operationId: 'createCliente', summary: 'Crea', description: 'Crea un cliente', deprecated: true, requestBody: { description: 'cuerpo', content: { 'application/json': { schema: { $ref: '#/components/schemas/Cliente' } } } }, responses: { '201': { description: 'Creado', content: { 'application/json': { example: { id: 7 } } } } } },
    },
    '/clientes/{id}': { delete: { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'identificador' }], responses: { '204': { description: 'Sin contenido' }, '404': { $ref: '#/components/responses/Nada' } } } },
  },
};

describe('importOpenApi', () => {
  const { workspace: ws, warnings, apiId } = importOpenApi(SPEC);

  it('crea la librería lib:apis, la API plantilla y una operación por path+método enlazada a la API', () => {
    expect(ws.libraries[OPENAPI_LIB_ID]!.elementTypes.map(t => t.id)).toEqual([API_TYPE_ID, API_OPERATION_TYPE_ID]);
    expect(apiId).toBe(apiElementId('clientes-api'));
    const api = ws.elements[apiId]!;
    expect(api).toMatchObject({ typeId: API_TYPE_ID, name: 'Clientes API', template: true, libraryId: OPENAPI_LIB_ID, doc: 'Gestión de clientes' });
    expect(api.fields).toMatchObject({ version: '2.1', auth: 'bearer (http bearer)', repoUrl: 'https://github.com/x/clientes', tags: 'clientes', baseUrls: [{ key: 'prod', value: 'https://api.ejemplo.com/v2' }, { key: 'dev', value: 'http://localhost:8080' }] });
    const ops = Object.values(ws.elements).filter(e => e.typeId === API_OPERATION_TYPE_ID);
    expect(ops).toHaveLength(3);
    for (const op of ops) {
      const rel = Object.values(ws.relations).find(r => r.from.elementId === op.id)!;
      expect(rel).toMatchObject({ typeId: 'core:link', name: 'operación de', to: { elementId: apiId } });
      expect(op.template).toBe(true);
    }
  });

  it('genera ejemplos JSON resolviendo $ref, allOf, arrays, enum, default, formatos y ciclos', () => {
    const list = Object.values(ws.elements).find(e => e.fields.method === 'GET')!;
    const res = JSON.parse(list.fields.responseBody as string);
    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toMatchObject({ id: 1, creado: '2026-01-01T00:00:00Z', email: 'usuario@ejemplo.com', estado: 'activo', direcciones: [{ calle: 'Mayor 1', cp: 'texto' }], jefe: {} });
    expect(list.fields.queryParams).toEqual([{ key: 'page', value: 'integer' }]);
    expect(list.fields.headers).toEqual([{ key: 'X-Trace', value: 'string · traza' }]);
    expect(list.fields.codes).toEqual([{ key: '200', value: 'OK' }, { key: '500', value: 'Error' }]);
    expect(list.fields.requestBody).toBe('');
    expect(list.tags).toEqual(['clientes']);

    const create = Object.values(ws.elements).find(e => e.fields.method === 'POST')!;
    expect(JSON.parse(create.fields.requestBody as string)).toMatchObject({ email: 'usuario@ejemplo.com' });
    expect(JSON.parse(create.fields.responseBody as string)).toEqual({ id: 7 });
    expect(create.tags).toContain('deprecated');
    expect(create.doc).toBe('Crea un cliente');
    expect(create.fields.notes).toBe('cuerpo');

    const del = Object.values(ws.elements).find(e => e.fields.method === 'DELETE')!;
    expect(del.name).toBe('DELETE /clientes/{id}');
    expect(del.fields.pathParams).toEqual([{ key: 'id', value: 'integer · obligatorio · identificador' }]);
    expect(del.fields.codes).toEqual([{ key: '204', value: 'Sin contenido' }, { key: '404', value: '' }]);
    expect(warnings.some(w => w.includes('#/components/responses/Nada'))).toBe(true);
  });

  it('lee YAML y Swagger 2.0 (host/basePath, parámetros body y definitions)', () => {
    const yaml = `swagger: "2.0"
info:
  title: Legacy
  version: "1"
host: legacy.example.com
basePath: /api
schemes: [https]
definitions:
  Pedido:
    type: object
    properties:
      total: { type: number }
paths:
  /pedidos:
    post:
      parameters:
        - name: body
          in: body
          schema: { $ref: "#/definitions/Pedido" }
      responses:
        "200":
          description: ok
          schema: { $ref: "#/definitions/Pedido" }
`;
    const { workspace } = importOpenApi(yaml);
    const api = Object.values(workspace.elements).find(e => e.typeId === API_TYPE_ID)!;
    expect(api.fields.baseUrls).toEqual([{ key: 'servidor', value: 'https://legacy.example.com/api' }]);
    const op = Object.values(workspace.elements).find(e => e.typeId === API_OPERATION_TYPE_ID)!;
    expect(JSON.parse(op.fields.requestBody as string)).toEqual({ total: 1.5 });
    expect(JSON.parse(op.fields.responseBody as string)).toEqual({ total: 1.5 });
  });

  it('rechaza lo que no es OpenAPI', () => {
    expect(() => importOpenApi('{"foo":1}')).toThrow(/OpenAPI/);
    expect(() => importOpenApi('nope: [')).toThrow(/No se puede leer/);
  });
});
