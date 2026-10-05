/**
 * Servidor MCP por stdio: expone la API REST de all-draw como herramientas para agentes.
 *
 *   ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
 *
 * No toca la base de datos: habla con el servidor HTTP con `Authorization: Bearer $ALLDRAW_API_KEY`,
 * así que puede correr en otra máquina. Las herramientas y recursos están en `mcp-tools.ts` (los mismos que el MCP
 * remoto `POST /mcp`, ver `mcp-http.ts`). Ver `SKILL.md` para modelar con comandos.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer, fetchApiCall } from './mcp-tools';

const BASE = (process.env.ALLDRAW_URL ?? 'http://127.0.0.1:4002').replace(/\/$/, '');
const KEY = process.env.ALLDRAW_API_KEY ?? '';
if (!KEY) console.error('aviso: falta ALLDRAW_API_KEY; las llamadas fallarán con 401');

const server = createMcpServer(fetchApiCall(BASE, KEY));
await server.connect(new StdioServerTransport());
