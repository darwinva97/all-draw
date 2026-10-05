/**
 * MCP remoto: `POST /mcp` con el transporte *Streamable HTTP* del SDK (modo sin estado y respuestas JSON: cada petición
 * crea su servidor MCP), autenticado con `Authorization: Bearer <API key>` (`adk_…`; ni sesiones, ni cookies, ni enlaces).
 * Las herramientas son las del MCP por stdio (`mcp-tools.ts`) y llaman a la API REST **en el mismo proceso** con esa clave,
 * así que no pueden hacer nada que la clave no pueda hacer por la API. Sólo en el servidor Node (ver `docs/manual/agentes-y-api.md`).
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { APIKEY_PREFIX, resolveToken, type Hasher, type Logger, type WorkspaceStore } from '@all-draw/server-core';
import { createMcpServer, toResult, type ApiCall } from './mcp-tools';

export const MCP_PATH = '/mcp';

export interface McpHttpDeps {
  /** La API (`createApi`): se le pasan peticiones `Request` con la misma clave. */
  api: { fetch(req: Request): Response | Promise<Response> };
  store: WorkspaceStore;
  hash: Hasher;
  logger: Logger;
  version?: string;
}

const rpcError = (status: number, code: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers: { 'cache-control': 'no-store', ...headers } });

export function createMcpHttpHandler(deps: McpHttpDeps): (req: Request) => Promise<Response> {
  return async req => {
    if (req.method !== 'POST') return rpcError(405, -32000, 'Este servidor MCP no tiene sesiones: sólo POST', { allow: 'POST' });
    const auth = req.headers.get('authorization') ?? '';
    const key = /^bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? '';
    const unauthorized = (msg: string) => rpcError(401, -32001, msg, { 'www-authenticate': 'Bearer realm="all-draw", error="invalid_token"' });
    if (!key) return unauthorized('Falta Authorization: Bearer <API key> (créala en Cuenta → Claves API)');
    if (!key.startsWith(APIKEY_PREFIX)) return unauthorized('El MCP remoto sólo acepta API keys (adk_…)');
    const principal = await resolveToken({ store: deps.store, hash: deps.hash }, key);
    if (principal?.kind !== 'user' || principal.via !== 'apikey') return unauthorized('API key no válida o revocada');

    // La API ve la petición con el mismo origen público (enlaces y `baseUrl`) y la misma clave.
    const fwd: Record<string, string> = {};
    for (const h of ['host', 'x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-for', 'accept-language']) { const v = req.headers.get(h); if (v) fwd[h] = v; }
    const call: ApiCall = async (method, path, body) => toResult(await deps.api.fetch(new Request(new URL(path, req.url), {
      method, headers: { ...fwd, authorization: `Bearer ${key}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })));
    const server = createMcpServer(call, deps.version ? { version: deps.version } : {});
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const res = await transport.handleRequest(req);
      const out = new Response(res.body, res);
      out.headers.set('cache-control', 'no-store');
      return out;
    } catch (e) {
      deps.logger.error('mcp: error', { err: e, user: principal.user.id });
      return rpcError(500, -32603, 'error interno');
    } finally {
      void server.close().catch(() => { /* ya cerrado */ });
    }
  };
}
