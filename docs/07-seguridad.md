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
- Desde el 3 de octubre de 2026 las tres, y «Cerrar sesión», **cortan al momento los WebSockets** de las sesiones
  cerradas y pueden **revocar también las API keys** (ver «Sesiones, API keys y WebSockets (QA2)», más abajo).
- Migración **v2** (`sqlite.ts`/`postgres.ts` `MIGRATIONS[1]`, `apps/worker/migrations/0002_sessions_expiry.sql`): índice
  `sessions(expires_at)` para la purga. La columna `expires_at NOT NULL` ya existía desde v1.

### 3. Cabeceras

`securityHeaders()` (`server-core/src/headers.ts`) se aplica a estáticos y API en Node (`app.ts`) y a Assets y API en el
worker (`withSecurityHeaders`):

| Cabecera | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws://<host> wss://<host>; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Cross-Origin-Opener-Policy` | `same-origin` (desde el 3-10-2026) |
| `Cross-Origin-Resource-Policy` | `same-origin`; **excepción**: `GET /api/workspaces/:id/views/:viewId/svg` va con `cross-origin` para poder incrustar el SVG (`<img src=…?token=lnk_…>`) en otras webs |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` **sólo** si la petición llegó por https (`x-forwarded-proto: https` o `COOKIE_SECURE=true`); en el worker siempre. |

Por qué así: `vite-plugin-pwa` registra el service worker desde `/registerSW.js` (fichero, no inline), así que
`script-src 'self'` basta; React Flow y el editor ponen estilos en línea → `style-src 'unsafe-inline'`; los iconos SVG van
en `data:` y la exportación PNG/SVG usa `blob:`; el WebSocket de sincronización va al mismo host.

**`img-src … https:` (desde el 3-10-2026).** El nodo visual «imagen» acepta una URL externa (logotipos, capturas,
fotos alojadas en otra web) y con `img-src 'self' data: blob:` el navegador la bloqueaba: el nodo salía vacío. Se
admite cualquier origen **https** sólo para imágenes. Riesgo asumido: una imagen no ejecuta código (`script-src` y
`object-src` no cambian) ni puede leer la página; lo único que revela es una petición GET al servidor de la imagen
(IP, `User-Agent` y, por `Referrer-Policy: strict-origin-when-cross-origin`, sólo el origen, nunca la ruta con el id del
espacio ni un `?token=`). Quien ve un diagrama con una imagen externa hace esa petición, igual que en cualquier web con
imágenes de terceros. `http:` sigue bloqueado (contenido mixto) y `connect-src` sigue cerrado al propio origen, así que
una URL de imagen no sirve para sacar datos con `fetch`. Si se quiere evitar del todo, basta quitar `https:` en
`contentSecurityPolicy()` (`server-core/src/headers.ts`): las imágenes externas volverán a no verse y las de `data:`
seguirán funcionando.

Comprobado con Chromium (playwright-core) contra un build en `/tmp/alldraw-dist` servido por un servidor temporal:
portada, demo, cambio de vista, pantalla Cuenta, registro, espacio en servidor con WebSocket «en línea», diálogo
Historial y creación de instantánea, **sin errores de consola ni violaciones que rompan nada**. Única anotación: zod 4
sondea una vez `Function("")` para decidir si compila validadores; con esta CSP la sonda falla (zod la captura y sigue en
modo interpretado) y Chromium registra un `securitypolicyviolation` informativo. Para evitar hasta ese aviso basta
`z.config({ jitless: true })` al arrancar la app (añadir `zod` a `apps/web` o exponerlo desde `@all-draw/core`;
pendiente, fuera del alcance de esta revisión).

### 4. Límites y validación

- **Rate limit** (memoria, por proceso): login por intentos **fallidos** (10/15 min por IP+correo, 30 por IP, 100 por
  correo desde cualquier IP; ver «IP real del cliente» más abajo); **registro** 10/hora por IP;
  **creación de enlaces** 30/15 min por usuario; **cambio de contraseña** 10 intentos/15 min por usuario.
- **Tamaño de cuerpo** (`hono/body-limit`, 413): 5 MB para `PUT …/snapshot`, `POST /api/workspaces` (con `initial`) y
  `…/snapshots/:sid/restore`; 1 MB para todo lo demás (comandos incluidos). Se comprueba por `Content-Length` o
  leyendo el stream si viene troceado.
- **Ids en rutas**: `id` de espacio y `sid` de instantánea validados con `SAFE_ID` (`^[A-Za-z0-9_\-:.]{1,120}$`) →
  400 antes de tocar la BD. El WebSocket ya lo hacía.
- **Enlaces caducados**: `resolveShareLink` ya devolvía `null` pasado `expires_at`; ahora hay test de que el WebSocket
  cierra con `4401` con un enlace caducado. Una conexión ya abierta no se corta al caducar (pendiente: no hay temporizador
  por conexión); la **revocación** sí la corta al momento (ver «Revocación con el WebSocket abierto», más abajo).
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
- ~~`x-forwarded-for` se confía tal cual para el rate limit por IP~~: corregido el 3 de octubre de 2026 con
  `TRUSTED_PROXIES` (ver «IP real del cliente»).
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

## Revisión de producción (3 de octubre de 2026)

Cuentas y datos del usuario (RGPD), observabilidad, robustez del servidor, dependencias y anti-abuso. Tests:
`packages/server-core/test/production.test.ts` (API en memoria), `apps/server/test/{production,ops}.test.ts` (servidor
Node real, SQLite, scripts), `apps/worker/test/production.test.ts` (workerd) y el contrato de `WorkspaceStore`
(`updateUser`, `deleteUser`, `countOwnedWorkspaces` en memoria, SQLite, Postgres, RegistryDO y D1).

### Datos del usuario (RGPD)

| Ruta | Quién | Qué |
|---|---|---|
| `GET /api/auth/me` | sesión o API key | ahora también `quotas: { workspaces: { used, limit }, docBytes: { limit } }` (`limit: null` = sin límite) |
| `PATCH /api/auth/me {name?, email?, password?}` | nombre: sesión o API key; **email: sólo sesión y con la contraseña actual** | 409 si el email está cogido; 10 intentos/15 min |
| `GET /api/auth/export` | sesión o API key | JSON descargable `all-draw-account/1`: cuenta, API keys (sin hash), cuotas y, por espacio propio, el Workspace JSON + miembros + enlaces (sólo el **prefijo** del token: el enlace no viaja en un fichero que puede acabar en cualquier sitio). Los espacios compartidos contigo se listan (id, nombre, rol) **sin** contenido: son datos de otros |
| `DELETE /api/auth/account {password}` | sólo sesión, con la contraseña | borra la cuenta (ver la regla); 10 intentos/15 min |
| `PATCH /api/admin/users/:id {isAdmin}` | admin desde sesión | nombrar o quitar administradores; nunca deja el servidor sin ninguno (409) |

**Regla al borrar una cuenta** (`DELETE /api/auth/account`, en `server-core/src/api.ts`):

1. Si eres el **único administrador** y hay más cuentas → 409 `last_admin`: nombra antes a otro (Cuenta → Usuarios del
   servidor → «Hacer administrador»). Si eres la única cuenta, se borra sin más.
2. Cada espacio del que eres **dueño**:
   - si tiene **editores**, pasa al **editor más antiguo** (el que lleva más tiempo como miembro) y éste deja de figurar
     como miembro (ahora es el dueño). Los demás miembros y los enlaces se conservan: son del espacio, y el nuevo dueño
     puede revocarlos;
   - si **no** tiene editores (sólo lectores o nadie), **se borra**. En el VPS antes se escribe una copia final en
     `$BACKUP_DIR/deleted/<fecha>-<id>.json.gz` (formato `all-draw-backup/1`, restaurable con `scripts/restore.mjs`;
     ficheros `0600`), que `backup.mjs` borra a los `KEEP_DAYS` días (30) como el resto de copias. **Si una copia final
     falla, no se borra nada** (500). En Cloudflare no hay copias del VPS: el espacio se borra con su Durable Object.
3. Se borran tus sesiones, tus API keys y tus membresías en espacios ajenos; las instantáneas que firmaste quedan con
   autor `null` (en el worker las instantáneas viven en el DO y conservan el id, que ya no resuelve a ningún nombre).
4. Las conexiones WebSocket ya abiertas **se cortan al momento** (desde el 3-10-2026): las del usuario en sus espacios
   y en los ajenos (4401), las de los espacios borrados (4410) y las del heredero (4205, reconecta como dueño).

**Revocación con el WebSocket abierto** (desde el 3-10-2026). Al aceptar un WebSocket se guarda en la conexión con qué
entró: `{ userId }` (sesión o API key) o `{ linkToken }` (enlace) — `authorizeConnection` → `identity`. Cuando un acceso
cambia, la API llama a `DocHost.revoke(id, { userId | linkToken }, código, motivo)`:

| Operación | Conexiones afectadas | Código |
|---|---|---|
| `DELETE /api/workspaces/:id/links/:token` | las abiertas con ese enlace | `4401` «enlace revocado» |
| `PUT /api/workspaces/:id/members/:userId` (rol distinto) | las de ese usuario en el espacio | `4205` «rol cambiado» |
| `DELETE /api/workspaces/:id/members/:userId` | las de ese usuario en el espacio | `4401` «acceso revocado» |
| `PATCH /api/workspaces/:id` con `ownerId` | dueño anterior y nuevo | `4205` |
| `DELETE /api/workspaces/:id` | todas | `4410` «espacio borrado» |
| `DELETE /api/auth/account` | las del usuario en todos los espacios a los que llegaba (todos, si era admin) | `4401` (y `4205` al heredero) |

- `4205` está fuera de 4400–4499 a propósito: y-websocket (≥ 3.1) no reconecta ante 44xx y sí ante el resto, así que
  con un cambio de rol el cliente reconecta solo y el servidor vuelve a autorizar con el rol nuevo (o responde 4401).
  La app web vuelve a pedir `GET /api/workspaces/:id` para actualizar el modo de solo lectura.
- Ante `4401`/`4403`/`4404`/`4410` la app muestra «Ya no tienes acceso a este espacio» / «Este espacio se ha borrado»,
  deja de sincronizar, pone el editor en solo lectura y olvida el rol guardado de la copia local (para que no se abra
  sin conexión con un permiso que ya no tiene).
- Node (`LocalDocHost.revoke` → `revokeConnections`): saca la conexión del doc y de la presencia **antes** de cerrar el
  socket, y `onMessage` ignora lo que llegue de una conexión que ya no está registrada (un update rezagado no se aplica).
  Sólo mira docs cargados: sin doc vivo no hay conexiones.
- Cloudflare: el worker pasa la identidad al `WorkspaceDO` en `x-alldraw-user`/`x-alldraw-link` (borra las que mande
  el cliente) y el DO acepta el socket con etiquetas de hibernación `[rol, "u:<userId>" | "l:<token>"]`; `POST /revoke`
  cierra `ctx.getWebSockets(etiqueta)` (vale también tras hibernar) sin cargar el doc. `webSocketMessage` ignora sockets
  que ya no están abiertos.
- ~~No cubierto: cerrar sesión, «Cerrar todas las sesiones», cambiar la contraseña o que un admin la restablezca no
  cortan los WebSockets ya abiertos~~: cubierto desde el 3 de octubre de 2026 (código `4402`, ver «Sesiones, API keys y
  WebSockets (QA2)»). Sigue la pequeña ventana entre autorizar el upgrade y registrar la conexión.

Interfaz: «Cuenta» (`Keys.tsx`) tiene «Perfil» (nombre, email y cuotas) y «Tus datos» (Exportar mis datos; Eliminar
cuenta… → formulario con la contraseña y botón «Eliminar mi cuenta definitivamente»).

### Registro: anti-abuso (el registro sigue abierto en el VPS y cerrado en el worker)

- **Trampa** (`website`): campo que una persona deja vacío; si llega con algo → 400 y aviso en el log. *Pendiente*: el
  campo oculto en `Auth.tsx` (otro agente); `api.register(…, website)` ya lo envía.
- **Tiempo mínimo**: `GET /api/auth/config` da `formToken` = `<ms>.<HMAC('register-form:<ms>')>` (con `SESSION_SECRET`;
  sin él es SHA-256 y falsificable) y `formMinMs`. El registro exige ese token con al menos `REGISTER_MIN_MS` (2000) de
  antigüedad y como mucho un día → 400 `form_token`. La SPA lo pide al abrir el formulario y, si alguien envía antes,
  espera lo que falte (nadie lo nota); un script tiene que pedir el token y esperar. `REGISTER_MIN_MS=0` lo desactiva.
- **Cuotas**: `MAX_WORKSPACES_PER_USER` (100) espacios propios por cuenta → 403 `quota_workspaces` con mensaje claro (los
  admins no tienen límite); `MAX_DOC_BYTES` (20 MB) por espacio → 413 `doc_too_large` (ver *Robustez*).
- Siguen el rate limit de 10 registros/hora por IP y `INVITE_CODE`.

### Observabilidad (Node)

- **Log de accesos** JSON en stdout (journal de systemd), una línea por petición:
  `{"t","level":"info","msg":"http","method","path","status","ms","user","ip"}`. `path` sin query y con los tokens de
  la ruta como `:token`; `user` = id, `link` o `anon`; `ip` truncada (IPv4 /24 → `203.0.113.0`, IPv6 /48). `LOG_LEVEL`
  (`debug|info|warn|error|silent`, por defecto `info`; `/healthz` y `/metrics` sólo en `debug`). Errores 500 con la pila.
- `GET /api/status` (público, también en el worker): versión, commit (`ALLDRAW_COMMIT` o `git rev-parse --short HEAD` al
  arrancar), runtime, `uptimeS` y si la BD responde (503 si no). No expone recuentos ni datos.
- `GET /metrics` (Prometheus, sólo Node): **sólo** desde 127.0.0.1 **sin** `X-Forwarded-For`/`X-Real-IP` (Caddy también
  conecta desde 127.0.0.1, pero añade esas cabeceras) o con `Authorization: Bearer $METRICS_TOKEN`; si no, 403. Peticiones
  por ruta normalizada/estado, p50/p95 por ruta, docs vivos, conexiones WS, rechazos de WS por motivo, errores de
  cliente, tamaño de la BD, memoria, uptime y `alldraw_build_info`.
- **Errores del cliente**: `POST /api/client-errors` (público, 8 KB máx., 30 por IP cada 10 min; esquema cerrado —
  mensaje, pila, pila de componentes, origen, URL, user-agent, repeticiones—: cualquier otro campo se descarta, así que
  no puede colarse contenido del diagrama). Se registra como `client-error` con los tokens borrados de mensaje, pila y
  URL. En la web, `apps/web/src/errors.ts`: `ErrorBoundary` para toda la app («Algo salió mal» con Recargar, Informar
  del error, Ir al inicio y detalles plegados) y `window.onerror`/`unhandledrejection` con deduplicación por firma,
  muestreo del 50 % y 20 informes por pestaña como mucho; la URL se manda sin query (adiós `?token=`).

### Robustez (Node)

- **Apagado ordenado** (SIGTERM/SIGINT): deja de aceptar conexiones, rechaza upgrades nuevos con 1012, cierra los
  WebSockets con **1012** (los clientes y-websocket reconectan solos al proceso nuevo), guarda los docs con cambios,
  corta las keep-alive ociosas (todas a los 3 s), cierra la BD (`PRAGMA optimize`). Si algo se cuelga, sale a los 10 s.
  `uncaughtException` → log + apagado ordenado con código 1 (systemd lo levanta: `Restart=always`).
- **Límites de WebSocket**: `MAX_WS_PER_IP` (30) y `MAX_WS_PER_WORKSPACE` (100) conexiones simultáneas → cierre `4429`.
  En el worker sólo por espacio (en el DO; por IP no tiene sentido entre isolates). `maxPayload` de 16 MB por mensaje.
- **Timeouts HTTP**: `headersTimeout` 15 s, `requestTimeout` 60 s (cuerpo incluido), `keepAliveTimeout` 10 s,
  `maxHeadersCount` 100 (contra slowloris). Los WebSockets aceptados no los heredan.
- **Tamaño por espacio** (`MAX_DOC_BYTES`, 20 MB; `LiveDoc.maxBytes`): por la API, `PUT …/snapshot`, `POST /api/workspaces
  {initial}`, comandos y restaurar → 413 `doc_too_large` si el doc ya está en el límite o el Workspace JSON lo supera; por
  WebSocket, un update que haría crecer el doc por encima se **descarta** y se avisa con `permissionDenied`
  `{"error":"doc_too_large","limit":N}` (lo que el doc ya tiene no cuenta —se mide con `Y.diffUpdate`— y los updates que
  sólo borran se aceptan siempre, para poder volver por debajo).
- **SQLite**: `journal_mode=WAL`, `synchronous=NORMAL` (seguro con WAL ante caídas del proceso), `foreign_keys=ON`,
  `busy_timeout=5000`, `journal_size_limit=64 MB`, `temp_store=MEMORY` (`SQLITE_PRAGMAS` en `store/sqlite.ts`).
- **Mantenimiento semanal** (`scripts/maintenance.mjs`, cron domingos 03:37): `quick_check`, compactación de
  `doc_updates` en `docs.state` (transacción `IMMEDIATE` por espacio; sólo borra los updates leídos), purga de sesiones
  caducadas, `ANALYZE`, `PRAGMA optimize`, `VACUUM` y `wal_checkpoint(TRUNCATE)`. Con el servidor en marcha.
- **Simulacro de restauración** (`scripts/restore-drill.mjs`, cron domingos 03:57): restaura la última copia en un
  `DATA_DIR` temporal, crea en esa copia un admin técnico y una API key, arranca el servidor en un puerto alto libre,
  comprueba `/api/status`, que estén todos los espacios del manifiesto y `GET /api/workspaces/:id/validate` +
  `…/snapshot` de cada uno (mismo nº de elementos y vistas), lo para con SIGTERM (exige salida 0) y borra el temporal.
  Resultado en `~/.alldraw-backups/restore-drill.last.json` y `restore-drill.log`. Probado contra la copia real del
  3-10-2026: 3/3 espacios, 1,4 s.

### `security.txt`

`/.well-known/security.txt` (RFC 9116) en Node y en el worker: `Contact: https://github.com/darwinva97/all-draw/security`,
`Expires` a un año vista (se genera en cada petición), `Preferred-Languages: es, en` y `Canonical` (con `PUBLIC_URL`).

### Comprobado en Chromium

Build en `/tmp/alldraw-dist` servido por un servidor temporal (puerto 4890, `DATA_DIR` temporal) con COOP y CORP:
portada, registro por la interfaz (el cliente esperó los 2 s del token), demo en el servidor con WebSocket «en línea»,
Cuenta (Perfil con cuotas, Tus datos), exportación descargada (37 elementos), errores globales llegando a
`/api/client-errors` (y a `alldraw_client_errors_total`), borrado de la cuenta (401 después) y apagado con SIGTERM.
Sin errores de consola salvo los 401 esperados. Sigue el aviso informativo de CSP por la sonda `Function("")` de zod
(`script-src eval`, capturado; también en producción): `z.config({ jitless: true })` en `main.tsx` no alcanza a la otra
copia de zod del bundle.

### Dependencias

`pnpm audit --prod`: **sin vulnerabilidades**. Actualizado dentro de rango en server, server-core y worker: `hono`
4.13.12, `@hono/node-server` 2.1.3, `ws` 8.22.0, `pg` 8.23.1, `lib0` 0.2.119, `@modelcontextprotocol/sdk` 1.31.0,
`wrangler` 4.147.0, `@cloudflare/workers-types`. Quedan avisos **sólo de desarrollo** (`undici` < 7.29.1 y `sharp`
< 0.35.4, 3 altos) que llegan por `@cloudflare/vitest-pool-workers` 0.22.0, que fija versiones exactas de `miniflare`
y `wrangler`: no tienen arreglo hasta una versión nueva de ese paquete (o un `overrides` en `pnpm-workspace.yaml`). CI
ejecuta `pnpm audit --prod --audit-level high` como job informativo (`continue-on-error`).

### Variables de entorno nuevas

| Variable | Defecto | Dónde | Uso |
|---|---|---|---|
| `LOG_LEVEL` | `info` | Node, worker | nivel del log JSON |
| `METRICS_TOKEN` | — | Node | `/metrics` también con `Authorization: Bearer` |
| `ALLDRAW_COMMIT` | `git rev-parse` | Node, worker | commit en `/api/status` (en el worker: `wrangler deploy --var ALLDRAW_COMMIT:…`, ya en `pnpm deploy`) |
| `ALLDRAW_VERSION` | `0.1.0` | worker | versión en `/api/status` (Node la lee del `package.json`) |
| `MAX_WORKSPACES_PER_USER` | `100` | Node, worker | espacios propios por cuenta (`0` = sin límite) |
| `MAX_DOC_BYTES` | `20971520` | Node, worker | tamaño máximo por espacio (`0` = sin límite) |
| `REGISTER_MIN_MS` | `2000` | Node, worker | tiempo mínimo del formulario de registro (`0` lo desactiva) |
| `MAX_WS_PER_IP` / `MAX_WS_PER_WORKSPACE` | `30` / `100` | Node (el segundo también worker) | conexiones WebSocket simultáneas |
| `BACKUP_DIR` | `~/.alldraw-backups` | Node | ya lo usaba `backup.mjs`; ahora también el servidor (copias finales en `deleted/`) |
| `TRUSTED_PROXIES` | `loopback,cloudflare` | Node | de quién se creen `X-Forwarded-For` / `CF-Connecting-IP` (ver «IP real del cliente») |

### Qué debe hacer quien despliega

1. **VPS**: reiniciar `alldraw` (no hay migraciones de esquema; los PRAGMA se aplican al abrir) y reconstruir la web
   (`pnpm --filter web build`) para tener Cuenta → Perfil/Tus datos, la pantalla de error y el `formToken` del registro.
   **Ojo: sin reconstruir la web, el registro desde la SPA antigua falla** (no manda `formToken`); o se reconstruye a la
   vez o se arranca temporalmente con `REGISTER_MIN_MS=0`. El cron semanal ya está instalado (ver `apps/server/README.md`).
2. **Cloudflare**: `pnpm --filter @all-draw/worker deploy` (inyecta `ALLDRAW_COMMIT`); `run_worker_first` incluye ahora
   `/.well-known/security.txt`. El registro sigue cerrado (`ALLOW_REGISTRATION=false`).

## Revisión QA2 (3 de octubre de 2026): sesiones, IP real y privacidad

Respuesta a los fallos 8, 9, 30, 31, 32, 50–54 del informe `docs/qa/2026-10-03-informe.md`.

### Sesiones, API keys y WebSockets (QA2)

Cada conexión WebSocket guarda con qué credencial se abrió (`ConnIdentity` en `server-core/src/docs.ts`): usuario o
enlace y, para un usuario, la **sesión** (`sessionId` = primeros 32 caracteres del hash del token, nunca el token) o la
**API key** (`keyId`). En Cloudflare viaja del worker al `WorkspaceDO` en `x-alldraw-session` / `x-alldraw-key` (se
borran las que mande el cliente) y queda en las etiquetas de hibernación `s:<sesión>` / `k:<clave>`.

| Acción | Sesiones | API keys | WebSockets cerrados |
|---|---|---|---|
| `POST /api/auth/logout` (Cerrar sesión) | la actual | — | los de esa sesión (`4402`) |
| `DELETE /api/auth/sessions[?revokeKeys=true]` | todas | con `revokeKeys`, todas | los de todas sus sesiones; con `revokeKeys`, también los de sus claves (`4402`) |
| `POST /api/auth/password {current, password, revokeKeys?}` | las demás | con `revokeKeys`, todas | los de las demás sesiones (y de las claves con `revokeKeys`); el navegador que la cambia sigue (`4402`) |
| `POST /api/admin/users/:id/reset[?revokeKeys=true]` | todas las suyas | con `revokeKeys`, todas | los suyos de sesión (y de clave con `revokeKeys`) (`4402`) |
| `DELETE /api/keys/:id` | — | esa | los abiertos con esa clave (`4401`) |

- Los WebSockets se buscan en todos los espacios a los que llega el usuario (`listWorkspaces`; un admin, todos).
- `4402` («sesión cerrada») está en el rango 44xx: y-websocket no reconecta. La app muestra «Se ha cerrado tu sesión»
  con «Entrar» (vuelve a abrir el espacio tras entrar) y el editor queda en solo lectura.
- En «Cuenta», «Cambiar contraseña», «Cerrar todas las sesiones» y «Restablecer» (admin) llevan la casilla «Revocar
  también las claves API», **marcada por defecto**: quien cierra sesiones suele sospechar un robo, y una sesión robada
  puede haberse creado una clave. La API, sin el parámetro, no revoca claves (compatibilidad).
- **Una API key no puede** cerrar sesiones ni cambiar la contraseña (`403`, `code: session_required`), igual que ya no
  podía crear claves, cambiar el email ni borrar la cuenta.

### Contraseñas y login

- Contraseña nueva (registro, cambio): 8+ caracteres **sin contar los espacios de los extremos** (ocho espacios no
  valen) y, al cambiarla, distinta de la actual (`400`, `code: password_same`).
- **Tiempo constante**: si el correo no existe se verifica igualmente una contraseña contra un hash PBKDF2 de relleno
  (mismo coste, 100 000 iteraciones): el tiempo de respuesta no dice si hay cuenta.
- Los límites del login sólo cuentan **fallos** y se cuentan por IP+correo (10/15 min), por IP (30) y por correo desde
  cualquier IP (100). Desde una sola dirección ya no se puede bloquear la cuenta de otra persona; un ataque repartido
  entre muchas IP sí acaba bloqueando el correo (a propósito).
- Errores de validación: `400 {error: "Datos no válidos (email: …)", code: 'validation', fields: ['email', 'name']}`
  en vez de la palabra «validación»; los formularios de la web dicen qué campo revisar y tienen `maxLength`.

### IP real del cliente (`TRUSTED_PROXIES`)

Antes se tomaba el primer valor de `X-Forwarded-For`: cualquiera lo falseaba (y se saltaba los límites por IP), y en
producción todos los que pasan por el mismo nodo de Cloudflare compartían «IP». Ahora (`server-core/src/net.ts`):

1. Se parte de la IP del **socket**.
2. Mientras esa IP sea un proxy de confianza, se retrocede un salto en `X-Forwarded-For` (de **derecha** a izquierda:
   cada proxy añade al final lo que vio).
3. Si el salto es un nodo de **Cloudflare** (redes publicadas en cloudflare.com/ips, `cloudflare` en la lista) y la
   petición trae `CF-Connecting-IP`, esa es la IP del cliente.
4. El primer salto que no es de confianza es el cliente. Lo que el cliente ponga a la izquierda no se mira nunca.

`TRUSTED_PROXIES` (Node): lista separada por comas de IPs, redes CIDR y `loopback` (127.0.0.0/8, ::1), `private` (redes
privadas) y `cloudflare`. Por defecto `loopback,cloudflare`; vacía = nadie (vale la IP del socket). Una entrada que no
se entiende impide arrancar. En el VPS: Cloudflare → Caddy (127.0.0.1) → Node. Caddy, sin `trusted_proxies` propio,
**reemplaza** el `X-Forwarded-For` entrante por la IP que ve (el nodo de Cloudflare) y deja pasar `CF-Connecting-IP`.
Quien llame a la IP del VPS saltándose Cloudflare con un `CF-Connecting-IP` inventado no cuela: el salto que ve Caddy
no es de Cloudflare. Si se añade otro proxy delante, hay que incluir su red.

En el worker la IP es `CF-Connecting-IP` (la pone el borde de Cloudflare; el cliente no puede cambiarla). La API recibe
la función como `ApiDeps.clientIp`; sin ella todo cuenta como la misma IP (`unknown`): nunca se lee `X-Forwarded-For`
sin saber quién lo pone. El log de accesos, los límites de WebSocket por IP (`MAX_WS_PER_IP`) y los de la API usan la
misma IP. Tests: `server-core/test/net.test.ts`.

### Privacidad y enlaces

- `GET /api/workspaces/:id/members` con un **enlace** (de lectura o de edición, con o sin cuenta) devuelve el nombre de
  los miembros pero **no su correo**; las cuentas con acceso siguen viéndolo.
- No se pueden crear enlaces ya caducados (`400`, `code: link_expires_past`). Al usar un enlace caducado o revocado,
  la API responde `401` con `code: link_expired` (y `expiresAt`) o `link_invalid` y un mensaje que lo dice; la app
  muestra «Este enlace ya no sirve» en vez de «Entra para abrir este espacio».
- `GET /api/auth/session` responde `200 {user: null}` sin sesión: la app lo usa en cada carga (sin 401 en la consola ni
  la sonda `HEAD /api/notations`). `GET /api/auth/me` sigue respondiendo 401 sin identidad.
- Un enlace de **edición** puede renombrar el espacio (`PATCH /api/workspaces/:id {name}`), no cambiar el dueño; el
  editor llama a esa ruta (con 800 ms de espera) al renombrar un espacio del servidor.

### Historial

- Instantáneas automáticas: la referencia de los 30 minutos es la **última instantánea guardada** (se lee del historial
  al cargar el doc), no el momento de cargarlo; antes, como el doc se descarga a los 60 s sin conexiones, casi nunca se
  llegaba a los 30 min. Un espacio con contenido y sin ninguna instantánea guarda la primera con el primer cambio; uno
  recién creado espera los 30 min. Test con reloj falso en `server-core/test/snapshots.test.ts`.
- Una instantánea manual sin etiqueta se guarda con `label: ""` (antes `null`, como las automáticas): el historial la
  muestra como «Manual, sin etiqueta» y la poda (que sólo borra `label IS NULL`) no la toca.

