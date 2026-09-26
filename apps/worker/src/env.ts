/** Bindings y variables del worker (ver `wrangler.toml`). */
export interface Env {
  DB: D1Database;
  WORKSPACES: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Si está, los hashes de sesión son HMAC con este secreto (`wrangler secret put SESSION_SECRET`). */
  SESSION_SECRET?: string;
  /** `"false"` cierra el registro una vez creado el primer usuario. */
  ALLOW_REGISTRATION?: string;
  /** Base de las URLs de los enlaces compartidos; si falta se deduce de la petición. */
  PUBLIC_URL?: string;
}
