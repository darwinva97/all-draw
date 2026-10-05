/**
 * Webhooks en el worker. Las entregas salen **del Durable Object del espacio** con `ctx.waitUntil` (los eventos de la API
 * se le reenvían con `RemoteDocHost.emitWebhook`; `comment.created` y `workspace.changed` nacen en su doc vivo). La API
 * del worker sólo hace en su propio isolate la prueba («Probar») y la comprobación de la URL al registrarla. El DNS se
 * comprueba por DoH (Workers no tiene DNS propio) y, además, Cloudflare no deja conectar con redes privadas. En la copia
 * de respaldo (`STANDBY="true"`) no se envía nada.
 */
import { WebhookDispatcher, dohResolver, fetchTransport, jsonLogger, parseLogLevel, type WebhookService, type WorkspaceStore } from '@all-draw/server-core';
import type { Env } from './env';
import type { RemoteDocHost } from './remote-host';

export const webhooksAllowPrivate = (env: Env) => env.WEBHOOKS_ALLOW_PRIVATE === '1' || env.WEBHOOKS_ALLOW_PRIVATE === 'true';

/** Repartidor para el worker o un DO (`schedule` = `ctx.waitUntil`). */
export function workerDispatcher(env: Env, store: WorkspaceStore, schedule?: (p: Promise<unknown>) => void): WebhookDispatcher {
  const allowPrivate = webhooksAllowPrivate(env);
  const resolve = dohResolver();
  return new WebhookDispatcher({
    store, logger: jsonLogger({ level: parseLogLevel(env.LOG_LEVEL) }), publicUrl: env.PUBLIC_URL || null,
    transport: fetchTransport({ ...(allowPrivate ? { allowPrivate: true } : { resolve }) }), ...(allowPrivate ? { allowPrivate: true } : { resolve }),
    enabled: env.STANDBY !== 'true', ...(schedule ? { schedule } : {}),
  });
}

/** El `WebhookService` de la API del worker: emitir lo hace el DO; probar y comprobar la URL, aquí mismo. */
export function workerWebhooks(env: Env, store: WorkspaceStore, docs: RemoteDocHost): WebhookService {
  const local = workerDispatcher(env, store);
  return {
    emit: (workspaceId, event, data, baseUrl) => docs.emitWebhook(workspaceId, event, data, baseUrl),
    test: (hook, baseUrl) => local.test(hook, baseUrl),
    checkUrl: url => local.checkUrl(url),
    invalidate: workspaceId => docs.refreshWebhooks(workspaceId),
  };
}
