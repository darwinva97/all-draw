/**
 * Servidor MCP por stdio: expone la API REST de all-draw como herramientas para agentes.
 *
 *   ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
 *
 * No toca la base de datos: habla con el servidor HTTP con `Authorization: Bearer $ALLDRAW_API_KEY`,
 * así que puede correr en otra máquina. Ver `SKILL.md` para modelar con comandos.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.ALLDRAW_URL ?? 'http://127.0.0.1:4002').replace(/\/$/, '');
const KEY = process.env.ALLDRAW_API_KEY ?? '';
if (!KEY) console.error('aviso: falta ALLDRAW_API_KEY; las llamadas fallarán con 401');

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${KEY}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: res.status, text, json };
}

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const err = (r: { status: number; text: string }) => ({ isError: true, content: [{ type: 'text' as const, text: `HTTP ${r.status}: ${r.text.slice(0, 4000)}` }] });
const pass = (r: { status: number; text: string; json: unknown }) => (r.status >= 200 && r.status < 300 ? ok(r.json ?? r.text) : err(r));

const server = new McpServer({ name: 'all-draw', version: '0.1.0' });

server.registerTool('list_workspaces', {
  title: 'Listar espacios', description: 'Espacios a los que tiene acceso la API key, con el rol en cada uno.',
  inputSchema: {},
}, async () => pass(await call('GET', '/api/workspaces')));

server.registerTool('get_snapshot', {
  title: 'Leer espacio', description: 'Workspace JSON completo (meta, libraries, elements, relations, views, nodes, edges, dimensions, people, rules).',
  inputSchema: { workspaceId: z.string().describe('Id del espacio (ws_…)') },
}, async ({ workspaceId }) => pass(await call('GET', `/api/workspaces/${encodeURIComponent(workspaceId)}/snapshot`)));

server.registerTool('run_commands', {
  title: 'Aplicar comandos', description: 'Aplica una lista de comandos (set/patch/delete/batch/meta/addElementToView/connect/deleteElement/deleteNode/deleteRelation/deleteView/moveNodes) sobre el documento vivo. Requiere rol editor. Devuelve el comando inverso.',
  inputSchema: {
    workspaceId: z.string(),
    commands: z.array(z.record(z.string(), z.unknown())).min(1).describe('Comandos con la forma de `Command` de @all-draw/core'),
    label: z.string().optional().describe('Etiqueta para el historial'),
  },
}, async ({ workspaceId, commands, label }) => pass(await call('POST', `/api/workspaces/${encodeURIComponent(workspaceId)}/commands`, { commands, label })));

server.registerTool('validate', {
  title: 'Validar', description: 'Diagnósticos del modelo (integridad referencial, matriz de validez de cada notación, higiene) con arreglos propuestos como comandos.',
  inputSchema: { workspaceId: z.string() },
}, async ({ workspaceId }) => pass(await call('GET', `/api/workspaces/${encodeURIComponent(workspaceId)}/validate`)));

server.registerTool('list_notations', {
  title: 'Catálogo de notaciones', description: 'Packs (bpmn, archimate, c4, statechart, freeform, grid, core) con los ids de tipos de elemento y relación que aceptan los comandos.',
  inputSchema: { packId: z.string().optional().describe('Si se da, sólo ese pack') },
}, async ({ packId }) => {
  const r = await call('GET', '/api/notations');
  if (r.status !== 200) return err(r);
  const packs = (r.json as { packs: { id: string }[] }).packs;
  return ok(packId ? packs.find(p => p.id === packId) ?? { error: `pack ${packId} desconocido`, packs: packs.map(p => p.id) } : packs);
});

server.registerTool('render_svg', {
  title: 'Render SVG', description: 'SVG de una vista del espacio (501 si el render no está disponible en el servidor).',
  inputSchema: { workspaceId: z.string(), viewId: z.string() },
}, async ({ workspaceId, viewId }) => {
  const r = await call('GET', `/api/workspaces/${encodeURIComponent(workspaceId)}/views/${encodeURIComponent(viewId)}/svg`);
  return r.status === 200 ? ok(r.text) : err(r);
});

await server.connect(new StdioServerTransport());
