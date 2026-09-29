/** Bindings y variables del worker (ver `wrangler.toml`). */
export interface Env {
  /** Opcional: si está, el registro (cuentas, espacios, permisos) va en D1; si no, en el `RegistryDO`. */
  DB?: D1Database;
  /** Registro en el SQLite de un Durable Object (una sola instancia, `idFromName('registry')`). */
  REGISTRY: DurableObjectNamespace;
  WORKSPACES: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Si está, los hashes de sesión son HMAC con este secreto (`wrangler secret put SESSION_SECRET`). */
  SESSION_SECRET?: string;
  /** `"false"` cierra el registro una vez creado el primer usuario. */
  ALLOW_REGISTRATION?: string;
  /** Nombre de la instancia del `RegistryDO` (por defecto `registry`). Cambiarlo empieza con un registro vacío. */
  REGISTRY_NAME?: string;
  /** Base de las URLs de los enlaces compartidos; si falta se deduce de la petición. */
  PUBLIC_URL?: string;
  /** Si está, el registro exige este código de invitación (`wrangler secret put INVITE_CODE`). */
  INVITE_CODE?: string;
  /** Si está, `POST /api/admin/import` acepta `X-Import-Secret` mientras no haya usuarios (`wrangler secret put IMPORT_SECRET`). */
  IMPORT_SECRET?: string;
  /** Si está, `POST /api/admin/reset-password` permite fijar la contraseña de un usuario con este código (rescate). */
  RESET_CODE?: string;
}
