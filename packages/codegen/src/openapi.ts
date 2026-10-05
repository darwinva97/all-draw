/**
 * APIs del catálogo → OpenAPI 3.1 en YAML (`openapi`): un fichero `openapi/<slug-de-la-api>.yaml` por API.
 *
 * - APIs (`lib:api`) y operaciones (`lib:apiOperation`), también como instancias de plantilla (`templateId`).
 *   Una operación pertenece a la API a la que la une un `core:link` ("operación de"). Las que no tienen API van a
 *   `openapi/api.yaml` (con aviso).
 * - Con vista: las operaciones de sus nodos y todas las de las APIs que aparecen. Sin vista: todas las operaciones
 *   del espacio (plantillas incluidas; una instancia y su plantilla cuentan como una).
 * - `info` (título = nombre de la API, `version` o `1.0.0`, `description` = doc), `servers` desde `baseUrls`,
 *   `externalDocs` desde `docsUrl`, `paths` por `path` y método en minúsculas, `operationId` (camelCase del nombre),
 *   `summary` (nombre), `description` (resumen y doc), `tags` (las del elemento salvo `deprecated`, que pone
 *   `deprecated: true`) y `parameters` desde `pathParams`/`queryParams`/`headers` con el tipo deducido del texto
 *   (`integer · obligatorio · id del cliente`).
 * - `requestBody` y la respuesta del primer código 2xx (o `200`) llevan el JSON de ejemplo y un JSON Schema
 *   deducido de él; el resto de `codes`, su descripción.
 *
 * Lo generado se puede volver a importar con `importOpenApi` de `@all-draw/io` (mismos métodos, paths y cuerpos).
 */
import type { Element, Workspace } from '@all-draw/core';
import type { CodeFile, CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { byNameThenId, camelCase, generatedBy, keyValues, resolveElement, slug, str, uniqueName, type KV } from './util';
import { toYaml } from './yaml';

export const API_TYPE = 'lib:api';
export const OPERATION_TYPE = 'lib:apiOperation';
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

const baseOf = (ws: Workspace, el: Element): Element => (el.templateId && ws.elements[el.templateId] ? ws.elements[el.templateId]! : el);
const typeIs = (ws: Workspace, el: Element, t: string): boolean => el.typeId === t || baseOf(ws, el).typeId === t;
export const isOperation = (ws: Workspace, el: Element) => typeIs(ws, el, OPERATION_TYPE);
export const isApi = (ws: Workspace, el: Element) => typeIs(ws, el, API_TYPE);

/** API de una operación (por `core:link` en cualquier sentido, desde la operación o su plantilla). */
function apiOf(ws: Workspace, op: Element, links: { from: string; to: string }[]): Element | undefined {
  const ids = new Set([op.id, baseOf(ws, op).id]);
  const cands: Element[] = [];
  for (const l of links) {
    const other = ids.has(l.from) ? l.to : ids.has(l.to) ? l.from : undefined;
    const el = other ? ws.elements[other] : undefined;
    if (el && isApi(ws, el)) cands.push(baseOf(ws, el));
  }
  return cands.sort(byNameThenId)[0];
}

type Schema = Record<string, unknown>;
const REASONS: Record<string, string> = {
  '200': 'OK', '201': 'Created', '202': 'Accepted', '204': 'No Content', '301': 'Moved Permanently', '302': 'Found', '304': 'Not Modified',
  '400': 'Bad Request', '401': 'Unauthorized', '403': 'Forbidden', '404': 'Not Found', '405': 'Method Not Allowed', '409': 'Conflict',
  '410': 'Gone', '415': 'Unsupported Media Type', '422': 'Unprocessable Entity', '429': 'Too Many Requests', '500': 'Internal Server Error',
  '502': 'Bad Gateway', '503': 'Service Unavailable', '504': 'Gateway Timeout', default: 'Respuesta por defecto',
};

/** JSON Schema deducido de un valor de ejemplo. */
export function inferSchema(v: unknown): Schema {
  if (v === null || v === undefined) return { type: 'null' };
  if (Array.isArray(v)) return { type: 'array', items: v.length ? inferSchema(v[0]) : {} };
  if (typeof v === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, inferSchema(x)])) };
  if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' };
  if (typeof v === 'boolean') return { type: 'boolean' };
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return { type: 'string', format: 'date-time' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { type: 'string', format: 'date' };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return { type: 'string', format: 'uuid' };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { type: 'string', format: 'email' };
  return { type: 'string' };
}

const PARAM_TYPES: Record<string, Schema> = {
  string: { type: 'string' },
  integer: { type: 'integer' }, int: { type: 'integer' }, long: { type: 'integer' },
  number: { type: 'number' }, float: { type: 'number' }, double: { type: 'number' }, decimal: { type: 'number' },
  boolean: { type: 'boolean' }, bool: { type: 'boolean' },
  uuid: { type: 'string', format: 'uuid' }, date: { type: 'string', format: 'date' }, datetime: { type: 'string', format: 'date-time' },
  'date-time': { type: 'string', format: 'date-time' },
};
const REQUIRED_WORDS = /^(obligatorio|obligatoria|required|requerido|requerida)$/i;

/** `integer · obligatorio · id del cliente` → esquema, obligatoriedad y descripción. */
export function parseParamText(text: string): { schema: Schema; required: boolean; description: string } {
  const m = /^\s*([A-Za-z][A-Za-z-]*)(?=$|[\s·,:|;()-])(.*)$/s.exec(text);
  const known = m ? PARAM_TYPES[m[1]!.toLowerCase()] : undefined;
  const rest = known ? m![2]! : text;
  let required = false;
  const parts = rest.split(/\s*[·|;]\s*/).map(p => p.replace(/^[\s,:\-–—()]+|[\s,]+$/g, '').trim()).filter(p => {
    if (REQUIRED_WORDS.test(p)) { required = true; return false; }
    return !!p;
  });
  return { schema: known ? { ...known } : { type: 'string' }, required, description: parts.join(' · ') };
}

function parameter(kv: KV, where: 'path' | 'query' | 'header'): Schema {
  const p = parseParamText(kv.value);
  return {
    name: kv.key, in: where,
    ...(where === 'path' || p.required ? { required: true } : {}),
    ...(p.description ? { description: p.description } : {}),
    schema: p.schema,
  };
}

function buildDoc(api: Element | null, ops: Element[], title: string, warnings: Warnings): Schema {
  const info: Schema = { title: api ? api.name || 'API' : title, version: (api && str(api.fields.version).trim()) || '1.0.0' };
  if (api?.doc.trim()) info.description = api.doc.trim();
  const doc: Schema = { openapi: '3.1.0', info };
  const servers = api ? keyValues(api.fields.baseUrls).filter(s => s.value).map(s => ({ url: s.value, description: s.key })) : [];
  if (servers.length) doc.servers = servers;
  const docsUrl = api ? str(api.fields.docsUrl).trim() : '';
  if (docsUrl) doc.externalDocs = { url: docsUrl };
  const paths: Record<string, Record<string, Schema>> = {};
  const usedIds = new Set<string>();
  const apiName = api?.name || title;
  const sorted = ops.map(op => {
    const path = str(op.fields.path).trim();
    const m = str(op.fields.method).trim().toLowerCase();
    return { op, path: path && !path.startsWith('/') ? `/${path}` : path, method: METHODS.includes(m) ? m : 'get' };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : METHODS.indexOf(a.method) - METHODS.indexOf(b.method) || byNameThenId(a.op, b.op)));
  for (const { op, path, method } of sorted) {
    const name = op.name || str(op.fields.summary) || `${method.toUpperCase()} ${path}`;
    if (!path) { warnings.add(W.opWithoutPath, { operation: name }); continue; }
    const item = paths[path] ?? (paths[path] = {});
    if (item[method]) { warnings.add(W.duplicateOperation, { method: method.toUpperCase(), path, api: apiName, operation: name }); continue; }
    const o: Schema = {};
    o.operationId = uniqueName(camelCase(name) || camelCase(`${method} ${path}`) || 'operacion', usedIds);
    o.summary = name;
    const summary = str(op.fields.summary).trim();
    const description = [summary && summary !== name ? summary : '', op.doc.trim()].filter(Boolean).join('\n\n');
    if (description) o.description = description;
    const tags = op.tags.filter(t => t !== 'deprecated');
    if (tags.length) o.tags = tags;
    if (op.tags.includes('deprecated')) o.deprecated = true;

    const params: Schema[] = [];
    const declared = keyValues(op.fields.pathParams);
    for (const kv of declared) params.push(parameter(kv, 'path'));
    for (const [, p] of path.matchAll(/\{([^}]+)\}/g)) {
      if (declared.some(d => d.key === p)) continue;
      warnings.add(W.undeclaredPathParam, { param: p!, path, operation: name });
      params.push({ name: p, in: 'path', required: true, schema: { type: 'string' } });
    }
    for (const kv of keyValues(op.fields.queryParams)) params.push(parameter(kv, 'query'));
    for (const kv of keyValues(op.fields.headers)) params.push(parameter(kv, 'header'));
    if (params.length) o.parameters = params;

    const body = (text: string, which: string): Schema => {
      try {
        const value = JSON.parse(text) as unknown;
        return { 'application/json': { schema: inferSchema(value), example: value } };
      } catch {
        warnings.add(W.invalidJson, { body: which, operation: name });
        return { 'application/json': { schema: { type: 'string' }, example: text } };
      }
    };
    const req = str(op.fields.requestBody).trim();
    if (req) o.requestBody = { content: body(req, 'requestBody') };

    const codes = keyValues(op.fields.codes);
    const res = str(op.fields.responseBody).trim();
    const okCode = codes.find(c => c.key.startsWith('2'))?.key ?? '200';
    const list = codes.some(c => c.key === okCode) ? codes : [{ key: okCode, value: '' }, ...codes];
    const responses: Record<string, Schema> = {};
    for (const c of list) {
      if (responses[c.key]) continue;
      const r: Schema = { description: c.value || REASONS[c.key] || `Respuesta ${c.key}` };
      if (c.key === okCode && res) r.content = body(res, 'responseBody');
      responses[c.key] = r;
    }
    o.responses = responses;
    item[method] = o;
  }
  // `paths` ordenado por clave (ya se insertaron en orden)
  doc.paths = paths;
  return doc;
}

export function generateOpenApi(ws: Workspace, opts: CodegenOptions = {}): CodegenResult {
  const warnings = new Warnings();
  const links = Object.values(ws.relations).filter(r => r.typeId === 'core:link' && r.from.elementId && r.to.elementId).map(r => ({ from: r.from.elementId!, to: r.to.elementId! }));
  const opsByBase = new Map<string, Element>();
  const apis = new Map<string, Element>();
  const addOp = (el: Element) => { const base = baseOf(ws, el); if (!opsByBase.has(base.id)) opsByBase.set(base.id, resolveElement(ws, el)); };
  let title = ws.meta.name || 'Sin nombre';
  if (opts.viewId) {
    const view = ws.views[opts.viewId];
    if (!view) { warnings.add(W.viewMissing, { view: opts.viewId }); return { files: [], warnings: warnings.list }; }
    title = view.name || view.id;
    const nodes = Object.values(ws.nodes).filter(n => n.viewId === view.id && n.elementId).sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const n of nodes) {
      const el = ws.elements[n.elementId!];
      if (!el) continue;
      if (isOperation(ws, el)) addOp(el);
      else if (isApi(ws, el)) apis.set(baseOf(ws, el).id, baseOf(ws, el));
    }
    for (const api of apis.values()) {
      for (const el of Object.values(ws.elements).sort(byNameThenId)) if (isOperation(ws, el) && apiOf(ws, el, links)?.id === api.id) addOp(el);
    }
  } else {
    for (const el of Object.values(ws.elements).sort(byNameThenId)) if (isOperation(ws, el)) addOp(el);
  }
  // agrupar por API
  const groups = new Map<string, { api: Element | null; ops: Element[] }>();
  for (const api of apis.values()) groups.set(api.id, { api, ops: [] });
  const orphans: Element[] = [];
  for (const op of opsByBase.values()) {
    const api = apiOf(ws, op, links);
    if (!api) { orphans.push(op); continue; }
    const g = groups.get(api.id) ?? groups.set(api.id, { api, ops: [] }).get(api.id)!;
    g.ops.push(op);
  }
  if (!groups.size && !orphans.length) { warnings.add(W.nothing, { scope: title }); return { files: [], warnings: warnings.list }; }
  const usedFiles = new Set<string>();
  const files: CodeFile[] = [];
  if (orphans.length) usedFiles.add('api');   // reservado para las operaciones sin API
  const emit = (api: Element | null, ops: Element[], base: string) => {
    const doc = buildDoc(api, ops, title, warnings);
    const name = api ? uniqueName(base, usedFiles, '-') : base;
    const content = `# ${generatedBy(api ? api.name || title : title)}\n${toYaml(doc)}`;
    files.push({ path: `openapi/${name}.yaml`, content, language: 'yaml' });
  };
  for (const g of [...groups.values()].sort((a, b) => byNameThenId(a.api!, b.api!))) emit(g.api, g.ops, slug(g.api!.name) || 'api');
  if (orphans.length) {
    warnings.add(W.opWithoutApi, { count: orphans.length });
    emit(null, orphans, 'api');
  }
  return { files, warnings: warnings.list };
}
