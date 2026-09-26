# Seguridad del servidor e historial de versiones

Revisión del 26 de septiembre de 2026 sobre `packages/server-core` (API Hono compartida), `apps/server` (Node,
SQLite/Postgres) y `apps/worker` (Cloudflare: D1 + Durable Objects). Todo lo descrito está cubierto por
`packages/server-core/test/{security,snapshots}.test.ts` (memoria) y `apps/server/test/security.test.ts` (SQLite y
servidor HTTP/WebSocket reales). La batería de contrato `store-contract.ts` cubre los métodos nuevos de los adaptadores.

## Modelo de identidad (recordatorio)

- **Sesión**: token `ads_…` aleatorio; en la BD sólo su hash (SHA-256, o HMAC-SHA-256 si hay `SESSION_SECRET`).
  Viaja en la cookie `alldraw_session` (`HttpOnly`, `SameSite=Lax`, `Secure` tras https) o como `Authorization: Bearer`.
- **API key** `adk_…`: para agentes y scripts, siempre `Bearer`. No puede crear otras claves ni cambiar contraseñas.
- **Enlace compartido** `lnk_…`: rol fijo (editor/lector) sobre un único espacio, con caducidad opcional.
- Contraseñas: PBKDF2-HMAC-SHA256, 100 000 iteraciones, sal aleatoria; mínimo 8 caracteres. Los hashes `scrypt$`
  heredados se re-hashean en el primer login correcto.

## Qué se ha endurecido

### 1. CSRF

La cookie `SameSite=Lax` ya impide que un formulario de otra web haga `POST` con ella en la mayoría de navegadores, pero
no en todos los casos (navegadores antiguos, `Lax` permite navegaciones top-level GET, y el WebSocket no la respeta).
Ahora, para toda petición **no segura** (`POST/PUT/PATCH/DELETE`) cuya credencial venga **de la cookie**, el servidor
exige una de estas señales (`isTrustedOrigin` en `auth.ts`):

1. cabecera `X-Requested-With: all-draw` (la manda siempre `apps/web/src/api.ts`; otro origen no puede añadirla sin CORS);
2. `Sec-Fetch-Site: same-origin` o `none` (si el navegador manda `cross-site`/`same-site`, se rechaza sin mirar más);
3. `Origin` o `Referer` con el mismo host que la petición (`X-Forwarded-Host` primero, luego `Host`).

Sin ninguna → `403 {"error":"Petición con cookie desde otro origen rechazada (CSRF)…"}`. Las peticiones con `Bearer`
(API keys, scripts, MCP) no lo necesitan: el token es el secreto. Las `GET` nunca se bloquean.

El **WebSocket** `/ws/<id>` con cookie sólo se acepta si el `Origin` (cuando el navegador lo manda) es el propio; si no,
se cierra con `4403`. Con token de enlace o Bearer se acepta desde cualquier origen.

### 2. Sesiones con caducidad deslizante

- Caducidad de **30 días** (`SESSION_MS`) desde el último uso: cada petición autenticada renueva la fecha si ha pasado
  más de un día desde la última renovación (`SESSION_RENEW_MS`) y, cuando la credencial viene por cookie, reenvía la
  cookie con la nueva fecha. Una sesión sin usar 30 días muere.
- `getSession` nunca devuelve caducadas (las borra al encontrarlas); además `purgeExpiredSessions()` corre cada hora
  en el servidor Node y en cada login/registro en ambos runtimes.
- `DELETE /api/auth/sessions`: cierra **todas** las sesiones del usuario (botón «Cerrar todas las sesiones» en Cuenta).
- Cambiar la contraseña cierra las demás sesiones; el restablecimiento por admin cierra todas.
- Migración **v2** (`sqlite.ts`/`postgres.ts` `MIGRATIONS[1]`, `apps/worker/migrations/0002_sessions_expiry.sql`): índice
  `sessions(expires_at)` para la purga. La columna `expires_at NOT NULL` ya existía desde v1.

### 3. Cabeceras

`securityHeaders()` (`server-core/src/headers.ts`) se aplica a estáticos y API en Node (`app.ts`) y a Assets y API en el
worker (`withSecurityHeaders`):

| Cabecera | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://<host> wss://<host>; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` **sólo** si la petición llegó por https (`x-forwarded-proto: https` o `COOKIE_SECURE=true`); en el worker siempre. |

Por qué así: `vite-plugin-pwa` registra el service worker desde `/registerSW.js` (fichero, no inline), así que
`script-src 'self'` basta; React Flow y el editor ponen estilos en línea → `style-src 'unsafe-inline'`; los iconos SVG van
en `data:` y la exportación PNG/SVG usa `blob:`; el WebSocket de sincronización va al mismo host.

Comprobado con Chromium (playwright-core) contra un build en `/tmp/alldraw-dist` servido por un servidor temporal:
portada, demo, cambio de vista, pantalla Cuenta, registro, espacio en servidor con WebSocket «en línea», diálogo
Historial y creación de instantánea, **sin errores de consola ni violaciones que rompan nada**. Única anotación: zod 4
sondea una vez `Function("")` para decidir si compila validadores; con esta CSP la sonda falla (zod la captura y sigue en
modo interpretado) y Chromium registra un `securitypolicyviolation` informativo. Para evitar hasta ese aviso basta
`z.config({ jitless: true })` al arrancar la app (añadir `zod` a `apps/web` o exponerlo desde `@all-draw/core`;
pendiente, fuera del alcance de esta revisión).

### 4. Límites y validación

- **Rate limit** (memoria, por proceso): login 10/15 min por IP y por email (ya existía); **registro** 10/hora por IP;
  **creación de enlaces** 30/15 min por usuario; **cambio de contraseña** 10 intentos/15 min por usuario.
- **Tamaño de cuerpo** (`hono/body-limit`, 413): 5 MB para `PUT …/snapshot`, `POST /api/workspaces` (con `initial`) y
  `…/snapshots/:sid/restore`; 1 MB para todo lo demás (comandos incluidos). Se comprueba por `Content-Length` o
  leyendo el stream si viene troceado.
- **Ids en rutas**: `id` de espacio y `sid` de instantánea validados con `SAFE_ID` (`^[A-Za-z0-9_\-:.]{1,120}$`) →
  400 antes de tocar la BD. El WebSocket ya lo hacía.
- **Enlaces caducados**: `resolveShareLink` ya devolvía `null` pasado `expires_at`; ahora hay test de que el WebSocket
  cierra con `4401` con un enlace caducado. Una conexión ya abierta no se corta al caducar (la revocación tampoco lo
  hacía); es una mejora pendiente.
- **Token fuera de la URL**: la SPA (`share.ts: takeShareToken`) lee `?token=` del hash, lo guarda en
  `sessionStorage` (`alldraw:token:<id>`) y lo **borra de la URL** con `history.replaceState`: no queda en historial,
  marcadores ni capturas. (El fragmento nunca viaja en `Referer`, pero así tampoco se copia por accidente.) Al recargar
  la pestaña se recupera de `sessionStorage`.

### 5. Contraseñas

- `POST /api/auth/password {current, password}` (sólo desde sesión, no con API key): verifica la actual, guarda PBKDF2
  de la nueva y cierra las demás sesiones. Pantalla: «Cuenta» (`#/keys`, `Keys.tsx`), sección «Cambiar contraseña».
- `GET /api/admin/users` (admin): cuentas sin hashes.
- `POST /api/admin/users/:id/reset` (admin, desde sesión): genera una contraseña temporal aleatoria (16 caracteres
  alfanuméricos, ~95 bits), la guarda y cierra las sesiones del usuario; se devuelve una sola vez. En «Cuenta», los
  administradores ven la lista de usuarios con «Restablecer».
- No hay recuperación por correo (el servidor no envía correo): el camino es admin → contraseña temporal → el usuario la
  cambia desde Cuenta.

### 6. Registro

- `ALLOW_REGISTRATION=false` cierra el registro una vez existe el primer usuario (ya existía).
- `INVITE_CODE` (Node: variable de entorno; worker: `wrangler secret put INVITE_CODE`): el registro exige `inviteCode`
  igual (comparación en tiempo constante) — también para el primer usuario, para que nadie se adelante en un despliegue
  nuevo.
- `GET /api/auth/config → { registration: 'open'|'invite'|'closed', passwordMinLength: 8 }`. `Auth.tsx` lo consulta y
  muestra el campo «Código de invitación» o el aviso de registro cerrado.

### Otras observaciones de la revisión (sin cambios)

- Los hashes de tokens son SHA-256 sin clave si no hay `SESSION_SECRET`: una copia de la BD no revela tokens (son
  aleatorios de 32 bytes), pero con `SESSION_SECRET` ni siquiera un volcado + acceso al código sirve. **Defínelo.**
- `x-forwarded-for` se confía tal cual para el rate limit por IP: correcto detrás de Caddy (lo sobrescribe), no exponer
  el puerto 4002 directamente.
- El primer usuario registrado es admin: en un despliegue nuevo, registra la cuenta admin antes de publicar el subdominio
  o usa `INVITE_CODE`.
- Los rate limits viven en memoria del proceso (en el worker, por isolate): suficientes contra fuerza bruta casual, no
  contra ataques distribuidos; para eso, limitar en Caddy/Cloudflare.

## Historial de versiones (instantáneas)

El servidor ya persistía el doc Yjs (`docs.state` + cola `doc_updates`), pero sin versiones: `saveDoc` sobrescribe.
Ahora cada espacio tiene **instantáneas**: un update Yjs completo del doc en ese momento.

### Almacenamiento

- Tabla `snapshots(id, workspace_id, created_at, author_id, label, data BLOB, size)` — migración **v3**
  (`MIGRATIONS[2]` en SQLite y Postgres; `apps/worker/migrations/0003_snapshots.sql` en D1). Se borra en cascada con el
  espacio.
- Interfaz `SnapshotStore` (`store/types.ts`), parte de `WorkspaceStore` y de `DocPersistence`: la implementan memoria,
  SQLite, Postgres, D1 y el **storage del Durable Object** (`do.ts`: `snap:<id>` meta + `snapd:<id>:<n>` trozos
  < 128 KiB). En Cloudflare las instantáneas viven en el DO, junto al doc; la tabla D1 queda para copias/migraciones.
- La lógica está en `LiveDoc` (`docs.ts`): `createSnapshot`, `snapshotWorkspace`, `restoreSnapshot`, `deleteSnapshot`,
  poda; el `DocHost` la expone a la API (local en Node, por `fetch` al DO en el worker).

### Reglas

- **Automática** cada **30 minutos de actividad**: al llegar un cambio (no la carga inicial) si han pasado ≥ 30 min desde
  la última instantánea. También **antes de cada restauración** (estado previo, sin etiqueta).
- **Máximo 100 por espacio**: al pasarse se podan las **más antiguas sin etiqueta**. Las etiquetadas nunca se podan
  (las borra el dueño).
- **Restaurar** aplica el Workspace de la instantánea sobre el doc vivo con `loadInto` (una transacción Yjs): los
  clientes conectados lo ven al instante, el historial Yjs y los `clientID` se conservan y deshacer local sigue
  funcionando. También actualiza el nombre del espacio en la BD.

### API

| Método y ruta | Rol | Descripción |
|---|---|---|
| `GET  /api/workspaces/:id/snapshots` | viewer+ | Lista (más reciente primero) con `author {id,name}`, `label`, `size`, `createdAt` |
| `POST /api/workspaces/:id/snapshots {label?}` | editor+ | Crea una instantánea del estado actual (`201`) |
| `GET  /api/workspaces/:id/snapshots/:sid` | viewer+ | Workspace JSON de la instantánea |
| `POST /api/workspaces/:id/snapshots/:sid/restore` | editor+ | Restaura (guardando antes una automática) |
| `DELETE /api/workspaces/:id/snapshots/:sid` | owner | Borra |

Interfaz: botón **Historial** en la barra del espacio (`History.tsx`): lista con fecha, autor, etiqueta y tamaño;
«Crear instantánea» con etiqueta (editor+), «Restaurar» con confirmación (editor+), «Descargar JSON» (todos) y «Borrar»
(dueño). Textos en español e inglés (`packages/i18n/src/en.ts`, bloque `enSecurity`).

## Endpoints nuevos (resumen)

```
GET    /api/auth/config                     { registration, passwordMinLength }
POST   /api/auth/password                   { current, password }          sesión
DELETE /api/auth/sessions                   cerrar todas mis sesiones
GET    /api/admin/users                     admin
POST   /api/admin/users/:id/reset           admin + sesión → { password }
GET    /api/workspaces/:id/snapshots
POST   /api/workspaces/:id/snapshots        { label? }                     editor+
GET    /api/workspaces/:id/snapshots/:sid   Workspace JSON
POST   /api/workspaces/:id/snapshots/:sid/restore                          editor+
DELETE /api/workspaces/:id/snapshots/:sid   owner
```

Todo está en `/api/openapi.json`.

## Qué debe hacer quien despliega

1. **Node (VPS)**: las migraciones v2 y v3 se aplican solas al arrancar (SQLite y Postgres). Añade a la unidad systemd:
   `SESSION_SECRET=<aleatorio largo>` (cierra las sesiones y API keys existentes: avisa), y si procede
   `ALLOW_REGISTRATION=false` o `INVITE_CODE=<código>`. Reconstruye la web (`pnpm --filter web build`) para que el
   cliente mande `X-Requested-With` — **sin reconstruir, la SPA antigua seguirá funcionando** porque Chromium/Firefox
   mandan `Sec-Fetch-Site: same-origin`, pero conviene hacerlo.
2. **Cloudflare**: `wrangler d1 migrations apply alldraw --remote` (0002 y 0003), `wrangler secret put SESSION_SECRET`,
   opcionalmente `wrangler secret put INVITE_CODE`, y `wrangler deploy`.
3. Copias de seguridad: la tabla `snapshots` es nueva; si el script de copia enumera tablas, incluirla (o basta con el
   Workspace JSON actual, las instantáneas son recuperables desde la interfaz mientras la BD exista).
4. Si un usuario olvida la contraseña: un admin entra en **Cuenta** y pulsa «Restablecer» junto a su correo.
