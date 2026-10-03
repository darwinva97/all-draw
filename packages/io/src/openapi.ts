/**
 * **OpenAPI** (2.0 / 3.x, JSON o YAML) → librería `lib:apis` con un elemento **API** (plantilla) por documento y un
 * elemento **operación** (plantilla) por `path + método`, unido a su API con `core:link` "operación de", como hace
 * `importDrawer`. Mismos tipos (`API_ELEMENT_TYPE`, `API_OPERATION_ELEMENT_TYPE`) para que el editor los trate igual.
 *
 * `requestBody`/`responseBody` son JSON de ejemplo generados desde el esquema (`$ref` a `components/schemas` o
 * `definitions`, `allOf`/`oneOf`/`anyOf`, arrays, `example`/`examples`/`default`/`enum`, formatos comunes), así que sus
 * hojas son pines. `headers`, `pathParams`, `queryParams` y `codes` van como listas clave→valor.
 */
import { parse as parseYaml } from 'yaml';
import { parseWorkspace, type Workspace, type KeyValue, type Library } from '@all-draw/core';
import { API_ELEMENT_TYPE, API_OPERATION_ELEMENT_TYPE, API_TYPE_ID, API_OPERATION_TYPE_ID, OPERATION_RELATION_NAME, apiElementId, operationElementId } from './drawer';
import { emptyWs, makeEl, makeRel, slug } from './archimate';
import { tr } from './i18n';

export interface OpenApiImport { workspace: Workspace; warnings: string[]; apiId: string }
export const OPENAPI_LIB_ID = 'lib:apis';
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

type Json = Record<string, unknown>;
interface Schema extends Json { $ref?: string; type?: string | string[]; properties?: Record<string, Schema>; items?: Schema; allOf?: Schema[]; oneOf?: Schema[]; anyOf?: Schema[]; example?: unknown; examples?: unknown; default?: unknown; enum?: unknown[]; format?: string; additionalProperties?: Schema | boolean; nullable?: boolean; required?: string[] }
interface Parameter { name?: string; in?: string; description?: string; required?: boolean; schema?: Schema; type?: string; $ref?: string }
interface MediaType { schema?: Schema; example?: unknown; examples?: Record<string, { value?: unknown }> }
interface Operation { operationId?: string; summary?: string; description?: string; deprecated?: boolean; tags?: string[]; parameters?: Parameter[]; requestBody?: { $ref?: string; content?: Record<string, MediaType>; description?: string }; responses?: Record<string, { $ref?: string; description?: string; content?: Record<string, MediaType>; schema?: Schema; headers?: Record<string, unknown> }>; consumes?: string[]; produces?: string[] }
interface Doc { openapi?: string; swagger?: string; info?: { title?: string; version?: string; description?: string; contact?: { url?: string }; 'x-repository'?: string }; servers?: { url?: string; description?: string }[]; host?: string; basePath?: string; schemes?: string[]; paths?: Record<string, Record<string, unknown> & { parameters?: Parameter[] }>; components?: { schemas?: Record<string, Schema>; parameters?: Record<string, Parameter>; requestBodies?: Record<string, Operation['requestBody']>; responses?: Record<string, unknown>; securitySchemes?: Record<string, { type?: string; scheme?: string }> }; definitions?: Record<string, Schema>; parameters?: Record<string, Parameter>; securityDefinitions?: Record<string, { type?: string }>; externalDocs?: { url?: string } }

export function importOpenApi(input: string | object, opts: { name?: string } = {}): OpenApiImport {
  const warnings: string[] = [];
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s); };
  const doc = readDoc(input);
  const title = doc.info?.title || opts.name || 'API importada';
  const ws = emptyWs(title);
  ws.meta.description = doc.info?.description ?? '';

  const lib: Library = { id: OPENAPI_LIB_ID, name: 'APIs (catálogo)', description: 'APIs importadas de OpenAPI.', elementTypes: [API_ELEMENT_TYPE, API_OPERATION_ELEMENT_TYPE], relationTypes: [], portTypes: [], notations: ['grid', 'freeform'] };
  ws.libraries[lib.id] = lib;

  // ---- resolución de $ref (solo referencias locales)
  const resolve = <T>(obj: T, seen = new Set<string>()): T => {
    const ref = (obj as { $ref?: unknown } | null)?.$ref;
    if (typeof ref !== 'string') return obj;
    if (!ref.startsWith('#/')) { warn(tr('Referencia externa no soportada: {ref}', { ref })); return {} as T; }
    if (seen.has(ref)) return {} as T;
    let cur: unknown = doc;
    for (const seg of ref.slice(2).split('/')) cur = (cur as Json | undefined)?.[seg.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (cur === undefined) { warn(tr('Referencia no encontrada: {ref}', { ref })); return {} as T; }
    return resolve(cur as T, new Set([...seen, ref]));
  };

  // ---- ejemplos desde esquemas
  const exampleOf = (schema: Schema | undefined, depth = 0, stack: string[] = []): unknown => {
    if (!schema || typeof schema !== 'object' || depth > 12) return null;
    if (schema.$ref) {
      if (stack.includes(schema.$ref)) return {};
      return exampleOf(resolve(schema), depth + 1, [...stack, schema.$ref]);
    }
    if (schema.example !== undefined) return schema.example;
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    if (schema.allOf) { const out: Json = {}; for (const s of schema.allOf) { const v = exampleOf(s, depth + 1, stack); if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, v); } return out; }
    const alt = schema.oneOf?.[0] ?? schema.anyOf?.[0];
    if (alt) return exampleOf(alt, depth + 1, stack);
    const type = Array.isArray(schema.type) ? schema.type.find(t => t !== 'null') : schema.type;
    if (type === 'object' || schema.properties) {
      const out: Json = {};
      for (const [k, s] of Object.entries(schema.properties ?? {})) out[k] = exampleOf(s, depth + 1, stack);
      if (!Object.keys(out).length && schema.additionalProperties && typeof schema.additionalProperties === 'object') out.clave = exampleOf(schema.additionalProperties, depth + 1, stack);
      return out;
    }
    if (type === 'array') return [exampleOf(schema.items, depth + 1, stack)];
    if (type === 'integer') return 1;
    if (type === 'number') return 1.5;
    if (type === 'boolean') return true;
    if (type === 'string' || type === undefined) {
      switch (schema.format) {
        case 'date': return '2026-01-01';
        case 'date-time': return '2026-01-01T00:00:00Z';
        case 'email': return 'usuario@ejemplo.com';
        case 'uuid': return '00000000-0000-4000-8000-000000000000';
        case 'uri': case 'url': return 'https://ejemplo.com';
        case 'binary': case 'byte': return 'base64';
        default: return type === undefined ? null : 'texto';
      }
    }
    return null;
  };
  const bodyExample = (content: Record<string, MediaType> | undefined, fallbackSchema?: Schema): string => {
    const mt = content ? (content['application/json'] ?? Object.values(content).find(m => m && typeof m === 'object')) : undefined;
    const schema = mt?.schema ?? fallbackSchema;
    const example = mt?.example ?? (mt?.examples ? Object.values(mt.examples)[0]?.value : undefined);
    const value = example !== undefined ? example : schema ? exampleOf(schema) : undefined;
    return value === undefined ? '' : JSON.stringify(value, null, 2);
  };

  // ---- API
  const apiId = slug(title) || 'api';
  const servers: KeyValue[] = (doc.servers ?? []).filter(s => s?.url).map(s => ({ key: s.description ?? 'servidor', value: String(s.url) }));
  if (!servers.length && doc.host) servers.push({ key: 'servidor', value: `${doc.schemes?.[0] ?? 'https'}://${doc.host}${doc.basePath ?? ''}` });
  const security = Object.entries(doc.components?.securitySchemes ?? doc.securityDefinitions ?? {}).map(([k, v]) => `${k} (${[v?.type, (v as { scheme?: string })?.scheme].filter(Boolean).join(' ')})`).join(', ');
  const tags = new Set<string>();
  const apiEl = makeEl(apiElementId(apiId), API_TYPE_ID, title);
  apiEl.doc = doc.info?.description ?? '';
  apiEl.libraryId = lib.id;
  apiEl.template = true;
  apiEl.fields = { repoUrl: doc.info?.['x-repository'] ?? doc.info?.contact?.url ?? '', docsUrl: doc.externalDocs?.url ?? '', version: doc.info?.version ?? '', auth: security, baseUrls: servers, tags: '' };
  ws.elements[apiEl.id] = apiEl;

  // ---- operaciones
  let n = 0;
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item || typeof item !== 'object') continue;
    const shared = (item.parameters ?? []).map(p => resolve(p));
    for (const [method, raw] of Object.entries(item)) {
      if (!METHODS.includes(method.toLowerCase()) || !raw || typeof raw !== 'object') continue;
      const op = raw as Operation;
      const params = [...shared, ...(op.parameters ?? []).map(p => resolve(p))].filter(p => p?.name);
      const byIn = (where: string): KeyValue[] => params.filter(p => p.in === where).map(p => ({ key: String(p.name), value: paramDoc(p, resolve) }));
      const responses = Object.entries(op.responses ?? {}).map(([code, r]) => [code, resolve(r)] as const);
      const ok = responses.find(([c]) => c.startsWith('2')) ?? responses.find(([c]) => c === 'default');
      const bodyParam = params.find(p => p.in === 'body');
      const rb = op.requestBody ? resolve(op.requestBody) : undefined;
      const opKey = op.operationId || `${method}-${path}`;
      const oid = operationElementId(slug(`${apiId}-${opKey}`) || `op${++n}`);
      if (ws.elements[oid]) { warn(tr('Operación {operation} repetida; se omite', { operation: opKey })); continue; }
      const el = makeEl(oid, API_OPERATION_TYPE_ID, op.summary || op.operationId || `${method.toUpperCase()} ${path}`);
      el.libraryId = lib.id;
      el.template = true;
      el.doc = op.description && op.description !== op.summary ? op.description : '';
      el.fields = {
        method: method.toUpperCase(), path, summary: op.summary ?? '',
        headers: byIn('header'), pathParams: byIn('path'), queryParams: byIn('query'),
        requestBody: rb ? bodyExample(rb.content) : bodyParam ? bodyExample(undefined, bodyParam.schema) : '',
        responseBody: ok ? bodyExample(ok[1]?.content, ok[1]?.schema) : '',
        codes: responses.map(([code, r]) => ({ key: code, value: r?.description ?? '' })),
        notes: [rb?.description, ...Object.keys(ok?.[1]?.headers ?? {}).map(h => `Cabecera de respuesta: ${h}`)].filter(Boolean).join('\n'),
      };
      el.tags = [...(op.tags ?? []), ...(op.deprecated ? ['deprecated'] : [])];
      for (const t of op.tags ?? []) tags.add(t);
      ws.elements[oid] = el;
      const rid = `rel-op-${oid.slice(3)}`;
      ws.relations[rid] = makeRel(rid, 'core:link', { elementId: oid }, { elementId: apiEl.id });
      ws.relations[rid].name = OPERATION_RELATION_NAME;
    }
  }
  if (!Object.keys(doc.paths ?? {}).length) warn(tr('El documento no tiene `paths`; solo se crea la API'));
  apiEl.fields.tags = [...tags].join(', ');
  apiEl.tags = [...tags];
  return { workspace: parseWorkspace(ws), warnings, apiId: apiEl.id };
}

function paramDoc(p: Parameter, resolve: <T>(o: T) => T): string {
  const schema = p.schema ? resolve(p.schema) : undefined;
  const type = schema?.type ?? p.type;
  const t = Array.isArray(type) ? type.join('|') : type;
  return [t, p.required ? 'obligatorio' : '', p.description].filter(Boolean).join(' · ');
}

function readDoc(input: string | object): Doc {
  let raw: unknown = input;
  if (typeof input === 'string') {
    const t = input.trim();
    try { raw = t.startsWith('{') ? JSON.parse(t) : parseYaml(t); } catch (e) { throw new Error(tr('No se puede leer el documento OpenAPI: {error}', { error: (e as Error).message })); }
  }
  const doc = raw as Doc | null;
  if (!doc || typeof doc !== 'object' || (!doc.openapi && !doc.swagger && !doc.paths)) throw new Error(tr('El documento no parece un OpenAPI (faltan `openapi`/`swagger` y `paths`).'));
  return doc;
}
