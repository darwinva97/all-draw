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
  /** Espacios por cuenta (por defecto 100; `0` sin límite). */
  MAX_WORKSPACES_PER_USER?: string;
  /** Tamaño máximo de un espacio en bytes (por defecto 20 MB; `0` sin límite). Lo aplica cada `WorkspaceDO`. */
  MAX_DOC_BYTES?: string;
  /** WebSockets simultáneos por espacio (por defecto 100; `0` sin límite). */
  MAX_WS_PER_WORKSPACE?: string;
  /** Tiempo mínimo del formulario de registro en ms (por defecto 2000; `0` lo desactiva). */
  REGISTER_MIN_MS?: string;
  /** Versión y commit desplegados (`GET /api/status`): `wrangler deploy --var ALLDRAW_COMMIT:$(git rev-parse --short HEAD)`. */
  ALLDRAW_VERSION?: string;
  ALLDRAW_COMMIT?: string;
  /** Nivel del log JSON (`console`, lo recoge Workers Observability): debug | info | warn | error. */
  LOG_LEVEL?: string;
}

/** Entero de una variable (`undefined` si falta o no es un número ≥ 0). */
export function envInt(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}
