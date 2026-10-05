import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { importOpenApi, API_OPERATION_TYPE_ID } from '@all-draw/io';
import type { Element, KeyValue } from '@all-draw/core';
import { generate, warningText, inferSchema, parseParamText, toYaml } from '../src';
import { apiWorkspace } from './fixtures';

describe('openapi', () => {
  const ws = apiWorkspace();
  const res = generate('openapi', ws);

  it('un YAML por API y openapi/api.yaml para las operaciones sin API', () => {
    expect(res.files.map(f => [f.path, f.language])).toEqual([['openapi/clientes-api.yaml', 'yaml'], ['openapi/api.yaml', 'yaml']]);
    for (const f of res.files) expect(f.content).toMatchSnapshot(f.path);
    expect(res.warnings.map(warningText)).toEqual([
      'La operación "Sin path" no tiene path; se omite',
      'La operación GET /clientes está repetida en Clientes API; se omite "Lista clientes otra vez"',
      'El cuerpo requestBody de "Importa clientes" no es JSON válido; se declara como texto',
      'El parámetro rama del path /clientes/{id}/{rama} no está declarado en "Borra cliente"; se añade como texto',
      'Hay 1 operaciones sin API; van a openapi/api.yaml',
    ]);
  });

  it('documento OpenAPI 3.1: info, servers, paths, parámetros, cuerpos y respuestas', () => {
    const doc = parseYaml(res.files[0]!.content);
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'Clientes API', version: '2.1', description: 'Gestión de clientes.' });
    expect(doc.servers).toEqual([{ url: 'https://api.ejemplo.com/v2', description: 'prod' }, { url: 'http://localhost:8080', description: 'dev' }]);
    expect(Object.keys(doc.paths)).toEqual(['/clientes', '/clientes/import', '/clientes/{id}/{rama}']);
    const list = doc.paths['/clientes'].get;
    expect(list).toMatchObject({ operationId: 'listaClientes', summary: 'Lista clientes', description: 'Lista paginada de clientes', tags: ['clientes'] });
    expect(list.parameters).toEqual([
      { name: 'page', in: 'query', description: 'número de página', schema: { type: 'integer' } },
      { name: 'q', in: 'query', description: 'texto libre', schema: { type: 'string' } },
      { name: 'X-Trace', in: 'header', required: true, description: 'traza', schema: { type: 'string' } },
    ]);
    expect(list.responses['200'].content['application/json'].schema).toEqual({
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'integer' }, nombre: { type: 'string' }, alta: { type: 'string', format: 'date-time' }, saldo: { type: 'number' }, vip: { type: 'boolean' }, jefe: { type: 'null' } } },
    });
    expect(list.responses['500']).toEqual({ description: 'Error interno' });
    const create = doc.paths['/clientes'].post;
    expect(create).toMatchObject({ deprecated: true, tags: ['clientes'], description: 'Da de alta un cliente.' });
    expect(create.requestBody.content['application/json'].example).toEqual({ nombre: 'Ana', email: 'ana@ejemplo.com' });
    expect(Object.keys(create.responses)).toEqual(['201', '400']);
    expect(create.responses['201'].content['application/json'].example).toEqual({ id: 7 });
    expect(create.responses['400'].description).toBe('Bad Request');
    const del = doc.paths['/clientes/{id}/{rama}'].delete;
    expect(del.parameters).toEqual([
      { name: 'id', in: 'path', required: true, description: 'identificador', schema: { type: 'integer' } },
      { name: 'rama', in: 'path', required: true, schema: { type: 'string' } },
    ]);
    expect(doc.paths['/clientes/import'].put.requestBody.content['application/json'].schema).toEqual({ type: 'string' });
  });

  it('round-trip: importOpenApi conserva métodos, paths, parámetros y cuerpos', () => {
    const originals = Object.values(ws.elements).filter(e => e.typeId === API_OPERATION_TYPE_ID && e.template && !['op-sola', 'op-bad', 'op-dup', 'op-nopath'].includes(e.id));
    const { workspace: back, warnings } = importOpenApi(res.files[0]!.content);
    expect(warnings).toEqual([]);
    const imported = Object.values(back.elements).filter(e => e.typeId === API_OPERATION_TYPE_ID);
    expect(imported).toHaveLength(4);
    const api = Object.values(back.elements).find(e => e.typeId === 'lib:api')!;
    expect(api.name).toBe('Clientes API');
    expect(api.fields.version).toBe('2.1');
    const json = (s: unknown) => (String(s ?? '').trim() ? JSON.parse(String(s)) : null);
    const path = (e: Element) => { const p = String(e.fields.path); return p.startsWith('/') ? p : `/${p}`; };
    for (const o of originals) {
      const i = imported.find(x => x.fields.method === String(o.fields.method).toUpperCase() && x.fields.path === path(o))!;
      expect(i, `${o.fields.method} ${o.fields.path}`).toBeDefined();
      expect(i.name).toBe(o.name);
      expect(json(i.fields.requestBody)).toEqual(json(o.fields.requestBody));
      expect(json(i.fields.responseBody)).toEqual(json(o.fields.responseBody));
      expect(i.tags.sort()).toEqual([...o.tags].sort());
    }
    const list = imported.find(x => x.fields.method === 'GET')!;
    expect(list.fields.queryParams).toContainEqual({ key: 'page', value: 'integer · número de página' });
    expect(list.fields.headers).toEqual([{ key: 'X-Trace', value: 'string · obligatorio · traza' }]);
    expect((imported.find(x => x.fields.method === 'DELETE')!.fields.pathParams as KeyValue[])[0]).toEqual({ key: 'id', value: 'integer · obligatorio · identificador' });
    expect((imported.find(x => x.fields.method === 'POST')!.fields.codes as KeyValue[]).map(c => c.key)).toEqual(['201', '400']);
  });

  it('con vista: la instancia de una plantilla hereda sus campos y arrastra su API', () => {
    const r = generate('openapi', ws, { viewId: 'v-grid' });
    expect(r.files.map(f => f.path)).toEqual(['openapi/clientes-api.yaml']);
    const doc = parseYaml(r.files[0]!.content);
    expect(Object.keys(doc.paths)).toEqual(['/clientes']);
    expect(doc.paths['/clientes'].get.summary).toBe('Lista clientes');
    const solo = generate('openapi', ws, { viewId: 'v-salud' });
    expect(solo.files.map(f => f.path)).toEqual(['openapi/api.yaml']);
    expect(parseYaml(solo.files[0]!.content).info.title).toBe('Salud');
  });

  it('ayudantes: esquema inferido, tipo de parámetros y YAML', () => {
    expect(inferSchema({ a: [1.5], b: '00000000-0000-4000-8000-000000000000', c: [] })).toEqual({
      type: 'object', properties: { a: { type: 'array', items: { type: 'number' } }, b: { type: 'string', format: 'uuid' }, c: { type: 'array', items: {} } },
    });
    expect(parseParamText('boolean, activo o no')).toEqual({ schema: { type: 'boolean' }, required: false, description: 'activo o no' });
    expect(parseParamText('required')).toEqual({ schema: { type: 'string' }, required: true, description: '' });
    const tricky = { a: 'true', b: 'x: y', c: 'línea 1\nlínea 2', d: ['', '-', { e: null }], '200': 1, f: ' borde ' };
    expect(parseYaml(toYaml(tricky))).toEqual(tricky);
  });
});
