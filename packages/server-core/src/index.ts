/**
 * `@all-draw/server-core`: todo lo del servidor que no depende del runtime (API Hono, identidad
 * con WebCrypto, documentos Yjs vivos, protocolo y-websocket abstracto, catálogo de notaciones y
 * la interfaz `WorkspaceStore` con su adaptador en memoria). Lo usan `@all-draw/server` (Node)
 * y `@all-draw/worker` (Cloudflare).
 */
export * from './store/types';
export { MemoryWorkspaceStore } from './store/memory';
export * from './auth';
export * from './docs';
export * from './host';
export * from './ops';
export * from './ysync';
export * from './notations';
export { createApi, type ApiConfig, type ApiDeps } from './api';
