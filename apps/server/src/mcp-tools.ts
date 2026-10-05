/**
 * Definición única del servidor MCP de all-draw (herramientas y recursos), compartida por el MCP por **stdio**
 * (`mcp.ts`, habla con la API por HTTP) y el MCP remoto por **HTTP** (`mcp-http.ts`, `POST /mcp`, llama a la API en el
 * mismo proceso). Ambos van con una API key y no pueden hacer nada que esa clave no pueda hacer por la API REST.
 *
 * Herramientas: `list_workspaces`, `get_snapshot`, `list_views`, `run_commands`, `validate`, `list_notations`, `render_svg`.
 * Recursos: `alldraw://workspaces` (lista) y `alldraw://workspaces/{workspaceId}/snapshot` (Workspace JSON) y
 * `alldraw://workspaces/{workspaceId}/views/{viewId}.svg` (SVG de una vista).
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export interface ApiResult { status: number; text: string; json: unknown }
/** Una llamada a la API REST con la API key (por red o en el mismo proceso). */
export type ApiCall = (method: string, path: string, body?: unknown) => Promise<ApiResult>;

export const MCP_INSTRUCTIONS = 'all-draw: modelado con un modelo y varias notaciones. Flujo: list_notations → get_snapshot (o list_views) → run_commands en un solo lote → validate → render_svg. Guía completa: apps/server/SKILL.md.';

/** `ApiCall` por HTTP contra `base` con `Authorization: Bearer <key>`. */
export function fetchApiCall(base: string, key: string, f: typeof fetch = fetch): ApiCall {
  const root = base.replace(/\/+$/, '');
  return async (method, path, body) => {
    const res = await f(root + path, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return toResult(res);
  };
}

export async function toResult(res: Response): Promise<ApiResult> {
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: res.status, text, json };
}

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const err = (r: { status: number; text: string }) => ({ isError: true, content: [{ type: 'text' as const, text: `HTTP ${r.status}: ${r.text.slice(0, 4000)}` }] });
const pass = (r: ApiResult) => (r.status >= 200 && r.status < 300 ? ok(r.json ?? r.text) : err(r));
const enc = encodeURIComponent;

interface ViewLike { id: string; name?: string; notationId?: string; kind?: string }
/** Resumen de las vistas de un Workspace JSON (id, nombre, notación, tipo y nº de nodos). */
export function viewsOf(ws: unknown): { id: string; name: string; notationId: string | null; kind: string | null; nodes: number }[] {
  const w = (ws && typeof ws === 'object' ? ws : {}) as { views?: Record<string, ViewLike> | ViewLike[]; nodes?: Record<string, { viewId?: string }> | { viewId?: string }[] };
  const list = <T>(v: Record<string, T> | T[] | undefined): T[] => (Array.isArray(v) ? v : Object.values(v ?? {}));
  const nodes = list(w.nodes);
  return list(w.views).map(v => ({ id: v.id, name: v.name ?? '', notationId: v.notationId ?? null, kind: v.kind ?? null, nodes: nodes.filter(n => n.viewId === v.id).length }));
}

/** Servidor MCP con todas las herramientas y recursos sobre `call`. */
export function createMcpServer(call: ApiCall, opts: { version?: string } = {}): McpServer {
  const server = new McpServer({ name: 'all-draw', version: opts.version ?? '0.1.0' }, { instructions: MCP_INSTRUCTIONS });

  server.registerTool('list_workspaces', {
    title: 'Listar espacios', description: 'Espacios a los que tiene acceso la API key, con el rol en cada uno.',
    inputSchema: {},
  }, async () => pass(await call('GET', '/api/workspaces')));

  server.registerTool('get_snapshot', {
    title: 'Leer espacio', description: 'Workspace JSON completo (meta, libraries, elements, relations, views, nodes, edges, dimensions, people, rules).',
    inputSchema: { workspaceId: z.string().describe('Id del espacio (ws_…)') },
  }, async ({ workspaceId }) => pass(await call('GET', `/api/workspaces/${enc(workspaceId)}/snapshot`)));

  server.registerTool('list_views', {
    title: 'Listar vistas', description: 'Vistas del espacio (id, nombre, notación, tipo y número de nodos), sin leer el espacio entero. Úsalo para elegir la vista de `render_svg` o de un comando.',
    inputSchema: { workspaceId: z.string().describe('Id del espacio (ws_…)') },
  }, async ({ workspaceId }) => {
    const r = await call('GET', `/api/workspaces/${enc(workspaceId)}/snapshot`);
    return r.status === 200 ? ok({ views: viewsOf(r.json) }) : err(r);
  });

  server.registerTool('run_commands', {
    title: 'Aplicar comandos', description: 'Aplica una lista de comandos (set/patch/delete/batch/meta/addElementToView/connect/deleteElement/deleteNode/deleteRelation/deleteView/moveNodes) sobre el documento vivo. Requiere rol editor. Devuelve el comando inverso.',
    inputSchema: {
      workspaceId: z.string(),
      commands: z.array(z.record(z.string(), z.unknown())).min(1).describe('Comandos con la forma de `Command` de @all-draw/core'),
      label: z.string().optional().describe('Etiqueta para el historial'),
    },
  }, async ({ workspaceId, commands, label }) => pass(await call('POST', `/api/workspaces/${enc(workspaceId)}/commands`, { commands, label })));

  server.registerTool('validate', {
    title: 'Validar', description: 'Diagnósticos del modelo (integridad referencial, matriz de validez de cada notación, higiene) con arreglos propuestos como comandos.',
    inputSchema: { workspaceId: z.string() },
  }, async ({ workspaceId }) => pass(await call('GET', `/api/workspaces/${enc(workspaceId)}/validate`)));

  server.registerTool('list_notations', {
    title: 'Catálogo de notaciones', description: 'Packs (bpmn, archimate, c4, statechart, freeform, grid, core…) con los ids de tipos de elemento y relación que aceptan los comandos.',
    inputSchema: { packId: z.string().optional().describe('Si se da, sólo ese pack') },
  }, async ({ packId }) => {
    const r = await call('GET', '/api/notations');
    if (r.status !== 200) return err(r);
    const packs = (r.json as { packs: { id: string }[] }).packs;
    return ok(packId ? packs.find(p => p.id === packId) ?? { error: `pack ${packId} desconocido`, packs: packs.map(p => p.id) } : packs);
  });

  server.registerTool('render_svg', {
    title: 'Render SVG', description: 'SVG de una vista del espacio (tema claro, oscuro o `dual`, que sigue al sistema).',
    inputSchema: { workspaceId: z.string(), viewId: z.string(), theme: z.enum(['light', 'dark', 'dual']).optional() },
  }, async ({ workspaceId, viewId, theme }) => {
    const r = await call('GET', `/api/workspaces/${enc(workspaceId)}/views/${enc(viewId)}/svg${theme ? `?theme=${theme}` : ''}`);
    return r.status === 200 ? ok(r.text) : err(r);
  });

  // ---- recursos
  const listWorkspaces = async (): Promise<{ id: string; name: string; role: string }[]> => {
    const r = await call('GET', '/api/workspaces');
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 500)}`);
    return (r.json as { workspaces: { id: string; name: string; role: string }[] }).workspaces;
  };
  server.registerResource('workspaces', 'alldraw://workspaces', {
    title: 'Espacios', description: 'Espacios a los que tiene acceso la API key (id, nombre, rol).', mimeType: 'application/json',
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await listWorkspaces(), null, 2) }] }));

  server.registerResource('snapshot', new ResourceTemplate('alldraw://workspaces/{workspaceId}/snapshot', {
    list: async () => ({ resources: (await listWorkspaces()).map(w => ({ uri: `alldraw://workspaces/${enc(w.id)}/snapshot`, name: w.name || w.id, mimeType: 'application/json', description: `Workspace JSON (${w.role})` })) }),
  }), {
    title: 'Workspace JSON', description: 'Contenido completo de un espacio (el mismo que `get_snapshot`).', mimeType: 'application/json',
  }, async (uri, vars) => {
    const id = String(vars.workspaceId ?? '');
    const r = await call('GET', `/api/workspaces/${enc(decodeURIComponent(id))}/snapshot`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 500)}`);
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: r.text }] };
  });

  server.registerResource('view-svg', new ResourceTemplate('alldraw://workspaces/{workspaceId}/views/{viewId}.svg', { list: undefined }), {
    title: 'SVG de una vista', description: 'Render SVG de una vista (tema `dual`).', mimeType: 'image/svg+xml',
  }, async (uri, vars) => {
    const r = await call('GET', `/api/workspaces/${enc(decodeURIComponent(String(vars.workspaceId ?? '')))}/views/${enc(decodeURIComponent(String(vars.viewId ?? '')))}/svg?theme=dual`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.text.slice(0, 500)}`);
    return { contents: [{ uri: uri.href, mimeType: 'image/svg+xml', text: r.text }] };
  });

  return server;
}
