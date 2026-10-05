# @all-draw/worker

all-draw en Cloudflare: un Worker con **la misma API Hono** que el servidor Node
(`@all-draw/server-core`), cuentas y permisos en el **SQLite de un Durable Object** (`RegistryDO`;
D1 es opcional), un **Durable Object por espacio** (`WorkspaceDO`) con el `Y.Doc` vivo y el protocolo
y-websocket, y la app web servida por **Assets**. Todo cabe en el plan gratuito y no hace falta crear
ninguna base D1.

```
src/index.ts          fetch(): /api + /healthz → createApi (store RegistryDO o D1 + RemoteDocHost); /ws/<id> → autoriza y reenvía al DO; resto → ASSETS
src/registry.ts       RegistryDO: registro (cuentas, sesiones, keys, espacios, permisos, enlaces) en ctx.storage.sql; RPC invoke(método, args)
src/do.ts             WorkspaceDO: LiveDoc + attachConnection (server-core) con Hibernation API; storage troceado; fetch interno
src/remote-host.ts    DocHost que traduce init/snapshot/replace/setMeta/commands/validate/renderSvg/drop a stub.fetch
src/store/sql.ts      SqlWorkspaceStore: todo el SQL del WorkspaceStore sobre un SqlDriver (one/all/run/batch)
src/store/do-sql.ts   SqlDriver sobre ctx.storage.sql + registryStore() (cliente RPC del RegistryDO)
src/store/d1.ts       SqlDriver sobre D1 (opcional, binding DB)
src/store/import.ts   validación e INSERT OR IGNORE de las filas de POST /api/admin/import
src/admin-import.ts   POST /api/admin/import (admin, o X-Import-Secret con el registro vacío o con STANDBY; replace: true con STANDBY)
src/ratelimit.ts      rate limit con el binding de Workers (login, registro, enlaces), antes de la API
src/migrations.ts     migraciones del RegistryDO (= migrations/*.sql; un test lo comprueba)
src/env.ts            bindings y variables
migrations/           0001–0003 *.sql (mismo SQL que apps/server/src/store/sqlite.ts v1–v3); para D1
wrangler.toml         durable_objects (WorkspaceDO, RegistryDO; SQLite), assets, vars; d1_databases comentado
test/                 vitest dentro de workerd: api (API + WebSocket), registry (contrato WorkspaceStore), import
```

## Qué se comparte y qué no

| Pieza | Node (`apps/server`) | Cloudflare (`apps/worker`) |
|---|---|---|
| API REST/OpenAPI, auth (PBKDF2 WebCrypto), permisos, catálogo | `@all-draw/server-core` | `@all-draw/server-core` (idéntico) |
| Contenido de un espacio (`DocHost`) | `LocalDocHost` sobre `DocManager` en proceso | `RemoteDocHost` → `stub.fetch` al `WorkspaceDO` |
| Protocolo y-websocket | `attachConnection` sobre `ws` | `attachConnection` sobre `WebSocketPair` + hibernación |
| `WorkspaceStore` | SQLite (`node:sqlite`) o Postgres (`DATABASE_URL`) | SQLite del `RegistryDO` (por defecto) o D1 (si hay binding `DB`); mismo SQL (`store/sql.ts`) |
| Doc persistido | tablas `docs`/`doc_updates` | storage del DO (`doc:meta`, `doc:<n>` en trozos de 96 KiB) |
| Estáticos | `STATIC_DIR` (fallback SPA) | `[assets]` con `not_found_handling = "single-page-application"` |
| Hashes `scrypt$` heredados | se verifican (`node:crypto`) y se re-hashean a PBKDF2 en el login | no se pueden verificar: el usuario debe restablecer contraseña (o migra antes con el servidor Node) |

Lo que el worker **no** hace: importar `.yupdate` heredados (`legacy.ts` es sólo Node) y el MCP
(`src/mcp.ts` habla con la API por HTTP, así que corre igual contra el worker).

## Desarrollo local

```bash
pnpm --filter web build                      # la app que sirve Assets (../web/dist)
pnpm --filter @all-draw/worker dev           # wrangler dev → http://localhost:8787 (el RegistryDO migra solo)
pnpm --filter @all-draw/worker test          # vitest 4 + workerd (DO, D1 y WebSocket reales, sin red)
pnpm --filter @all-draw/worker typecheck
```

Los tests del worker corren con **vitest 4** (dependencia local: `@cloudflare/vitest-pool-workers`
aún no soporta vitest 5) y por eso el `vitest.config.ts` de la raíz excluye `apps/worker`. Hay dos
proyectos con los mismos tests: `do` (la configuración de `wrangler.toml`, sin D1) y `d1` (añade un
binding `DB` local con `migrations/` aplicadas). `test/registry.test.ts` pasa el contrato completo de
`WorkspaceStore` (`storeContractTests` de server-core) sobre el `RegistryDO` y, en `d1`, sobre D1.

## Despliegue (sin D1)

El registro vive en el `RegistryDO`: no hay que crear bases ni aplicar migraciones a mano (el DO las
aplica al arrancar). Desde la raíz del monorepo:

```bash
pnpm --filter web build                                   # Assets lee apps/web/dist
cd apps/worker
npx wrangler secret put SESSION_SECRET                    # una vez; recomendado siempre
npx wrangler deploy                                       # = pnpm --filter @all-draw/worker deploy
```

1. **Credenciales**: `npx wrangler login` o `CLOUDFLARE_API_TOKEN` con permiso *Workers Scripts: Edit*
   (no hace falta D1); el token de DNS del entorno no vale. Si la cuenta tiene
   varias, `CLOUDFLARE_ACCOUNT_ID`.
2. El primer `wrangler deploy` aplica las migraciones de Durable Objects `v1`
   (`new_sqlite_classes = ["WorkspaceDO"]`) y `v2` (`["RegistryDO"]`). Si ya estaba desplegado con D1
   sólo se aplica la `v2`.
3. **Variables** (`[vars]` en `wrangler.toml` o el panel) y **secretos**:
   | Variable | Uso |
   |---|---|
   | `SESSION_SECRET` | `wrangler secret put SESSION_SECRET`. Los hashes de sesión/API key son HMAC con él; cambiarlo invalida todas las sesiones. Recomendado siempre. |
   | `ALLOW_REGISTRATION` | `"false"` cierra el registro una vez creado el primer usuario (el primero siempre puede y es admin). |
   | `PUBLIC_URL` | Base de los enlaces compartidos (`https://alldraw.example.com`); si falta se deduce de la petición. |
   | `INVITE_CODE` | Opcional: el registro exige este código. |
   | `MAX_WORKSPACES_PER_USER` / `MAX_DOC_BYTES` / `REGISTER_MIN_MS` | Cuotas y anti-abuso del registro (100 / 20 MB / 2000 ms), igual que en Node. `MAX_DOC_BYTES` lo aplica cada `WorkspaceDO`. |
   | `MAX_WS_PER_WORKSPACE` | WebSockets por espacio (100) en el DO; al pasarse, cierre `4429`. |
   | `ALLDRAW_COMMIT` / `ALLDRAW_VERSION` | Lo que publica `GET /api/status`. `pnpm --filter @all-draw/worker deploy` pasa `--var ALLDRAW_COMMIT:$(git rev-parse --short HEAD)`. |
   | `LOG_LEVEL` | Log JSON por `console` (Workers Observability): errores internos, `client-error`, cuentas borradas. |
   | `IMPORT_SECRET` | Con `STANDBY`: la clave de la sincronización nocturna (`wrangler secret put IMPORT_SECRET`; el VPS la lee de `~/.config/alldraw/cf-import-secret`). Sin `STANDBY`, sólo para migrar (vale mientras no haya usuarios): bórralo después con `wrangler secret delete IMPORT_SECRET`. |
   | `STANDBY` / `PRIMARY_URL` | `"true"`: copia de respaldo de solo lectura (ver *Copia de respaldo*); `PRIMARY_URL` es el entorno principal que anuncia. |
   | `MAIL_PROVIDER` y compañía | Correo, **apagado por defecto** (ver *Correo* abajo). |
   La cookie de sesión va siempre con `Secure` (en Cloudflare todo es https).
4. **Dominio**: en el panel del Worker, *Custom domains* (o `routes` en `wrangler.toml`).
5. Regístrate: el primer usuario es admin (o importa las cuentas, ver abajo).

`npx wrangler deploy --dry-run --outdir /tmp/wd` valida configuración y bundle sin desplegar
(≈2,1 MiB / 325 KiB gzip con todos los packs de notación y el render SVG).

### Opción: registro en D1

Si prefieres D1 (consultas desde el panel, `wrangler d1 export`, Time Travel):

1. `npx wrangler d1 create alldraw` y copia el id a `database_id`.
2. Descomenta el bloque `[[d1_databases]]` de `wrangler.toml`.
3. `pnpm --filter @all-draw/worker migrate` (= `wrangler d1 migrations apply alldraw --remote`).
4. `wrangler deploy`. Con el binding `DB` presente el worker usa D1 y el `RegistryDO` queda sin uso: sus
   datos **no** se copian solos (exporta e importa con `POST /api/admin/import` si hiciera falta).

## Correo (apagado por defecto)

Igual que en Node (verificar el correo, restablecer la contraseña, aviso de menciones), pero en Workers **no hay SMTP**
(sin sockets TCP de uso general): sólo `none` (por defecto), `log` y `http`.

| Variable | Uso |
|---|---|
| `MAIL_PROVIDER` | `none` (por defecto: `GET /api/auth/config` → `email: false`), `log` (sólo registra el mensaje en Workers Observability; pruebas) o `http`. |
| `MAIL_FROM` | Remitente, `all-draw <no-reply@tu-dominio>` (dominio verificado en el proveedor). |
| `MAIL_HTTP_URL` | Endpoint de envío (`https://api.resend.com/emails`, `https://api.postmarkapp.com/email`, `https://api.mailgun.net/v3/<dominio>/messages`…). |
| `MAIL_HTTP_TOKEN` | **Secreto**: `wrangler secret put MAIL_HTTP_TOKEN`. |
| `MAIL_HTTP_FORMAT` | `resend` (por defecto), `postmark`, `mailgun` o `json` con `MAIL_HTTP_TEMPLATE` (`{{from}}`, `{{to}}`, `{{subject}}`, `{{text}}`, `{{html}}`). |
| `MAIL_HTTP_AUTH_HEADER` | Cabecera del token si no es `Authorization: Bearer`. |
| `REQUIRE_EMAIL_VERIFICATION` | `"true"`: hace falta el correo verificado para crear espacios en el servidor (sólo con correo). |

Para encenderlo: `[vars]` `MAIL_PROVIDER = "http"`, `MAIL_FROM` y `MAIL_HTTP_URL` en `wrangler.toml`, el token como
secreto y desplegar. Si la configuración está mal, el worker **sigue sin correo** y registra el error (no se cae la web).
Las menciones las detecta el `WorkspaceDO` (que tiene el doc vivo): lee el registro (D1 o `RegistryDO`) y manda el correo
con la misma configuración. La migración `0004_accounts.sql` añade las columnas y tablas (en el `RegistryDO` se aplica sola
al arrancar; con D1, `pnpm --filter @all-draw/worker migrate`).

## Copia de respaldo de solo lectura (`STANDBY`)

El entorno principal es el VPS (https://alldraw.bezenti.com). Este worker, con `STANDBY = "true"` en `wrangler.toml`,
es una copia de respaldo que se actualiza cada noche:

- **API**: toda escritura responde **503** `{ code: "standby", primaryUrl }` (middleware de `createApi` con
  `config.standby`, `packages/server-core/src/api.ts`) salvo `POST /api/auth/login`, `POST /api/auth/logout`,
  `DELETE /api/auth/sessions` y `POST /api/client-errors`. Las lecturas funcionan igual.
- **WebSocket**: todos entran como `viewer` (sus cambios se rechazan con `read-only`), también los dueños.
- **`GET /api/status`** añade `standby: true` y `primaryUrl`; la web lo lee (`apps/web/src/StandbyBanner.tsx`) y muestra
  un aviso fijo «Copia de respaldo de solo lectura, actualizada cada noche — usa alldraw.bezenti.com».
- **Sincronización** (`scripts/sync-standby.mjs`, cron del VPS a las 03:47): lee la SQLite del VPS en solo lectura y
  llama a `POST /api/admin/import` con `X-Import-Secret` (con `STANDBY` vale aunque haya usuarios) y `replace: true`:
  en una transacción borra cuentas, espacios, miembros, enlaces y API keys que ya no están en el VPS (las sesiones de
  esas cuentas caen en cascada; el Durable Object de cada espacio borrado se vacía) y sobrescribe el resto (upsert); los
  documentos que cambiaron se sobrescriben y los idénticos no se tocan (para no engordar el doc Yjs cada noche). Las
  sesiones abiertas en el worker de quien sigue existiendo se conservan. `replace` sólo existe con `STANDBY` y exige
  los cinco grupos (aunque vayan vacíos). Antes de escribir, el script comprueba que el destino publica
  `standby: true`; si algo falla avisa por ntfy y el worker se queda con los datos de la noche anterior.

  ```bash
  node scripts/sync-standby.mjs --dry-run                       # qué mandaría
  node scripts/sync-standby.mjs                                 # al worker de producción
  node scripts/sync-standby.mjs --url http://127.0.0.1:8787     # a un wrangler dev local con STANDBY
  ```

  No viajan las columnas de cuenta nuevas de la migración 0004 (`email_verified_at`, `locale`, `notify_email`) ni las
  instantáneas del historial: el worker conserva las suyas.

Para volver a usarlo como entorno con escritura: `STANDBY = "false"` (o quítalo), despliega y desactiva la línea de
cron de `sync-standby.mjs` en el VPS (si no, se niega a escribir y avisa cada noche).

## Rate limit (binding de Workers)

`src/ratelimit.ts`, antes de la API, con los bindings `[[ratelimits]]` de `wrangler.toml` (por IP de
`CF-Connecting-IP`, por ubicación de Cloudflare, eventualmente consistentes):

| Binding | Rutas (POST) | Límite |
|---|---|---|
| `RL_LOGIN` | `/api/auth/login`, `/api/admin/reset-password`, `/api/admin/import` | 10/min |
| `RL_REGISTER` | `/api/auth/register` | 5/min |
| `RL_LINKS` | `/api/workspaces/:id/links` | 20/min |

Responde 429 con los mismos `code` que la API (`too_many_attempts`, `too_many_registrations`, `too_many_links`) y
`Retry-After: 60`. Los bindings son opcionales: sin ellos (o si `limit()` falla) no se limita aquí y siguen los
límites en memoria de la API; sin `CF-Connecting-IP` (sólo `wrangler dev` y tests) tampoco. Los `namespace_id`
(1001–1003) son de la cuenta: el monitor usa el 1101. Disponible en el plan gratuito (el monitor ya se desplegó con uno).

## Cómo funciona el Durable Object

- `env.WORKSPACES.idFromName(workspaceId)`: un DO por espacio; el worker autoriza el WebSocket
  (`authorizeConnection`, mismos códigos 4400/4401/4404 que Node) y reenvía el upgrade con el rol en
  la cabecera `x-alldraw-role`. El DO no vuelve a comprobar permisos: sólo el worker puede llamarle.
- `ctx.acceptWebSocket(server, [role])`: **Hibernation API**. Si el DO se descarga, al llegar el
  siguiente mensaje se reconstruye el `LiveDoc` desde el storage y la conexión se re-registra con el
  rol guardado en la etiqueta. Las presencias (awareness) se pierden en la hibernación y el cliente
  las vuelve a mandar solo.
- Persistencia: el `LiveDoc` de server-core hace debounce de 500 ms, pero además el DO hace
  `flush()` tras cada mensaje con cambios y tras cada operación de la API, para no depender de que el
  DO siga vivo. El estado completo se trocea en claves `doc:<n>` (96 KiB) y `doc:meta` `{chunks, size}`.
- `POST /drop` (al borrar el espacio): cierra los sockets con `4410` y `storage.deleteAll()`.
- **Enlaces que caducan**: el worker pasa la caducidad del enlace (`x-alldraw-expires`) y el DO la guarda en la etiqueta
  `e:<ms>` del socket y programa `alarm()` para la más próxima; al sonar cierra con `4401` `expired` los sockets ya
  caducados y reprograma (sobrevive a la hibernación).
- **Id del espacio**: el DO no conoce el nombre con que se creó su id; el worker y `RemoteDocHost` lo mandan en
  `x-alldraw-workspace` y el DO lo guarda en `ws:id` (lo necesita para notificar las menciones de comentarios nuevos).
- Las operaciones de la API son las mismas funciones `op*` de `@all-draw/server-core/ops` que usa
  Node; `CommandError` se traduce a 400/422 igual.

## Migración desde el servidor Node (SQLite → Cloudflare)

`scripts/migrate-from-sqlite.mjs` (las filas y el SQL los genera `scripts/migrate-sql.mjs`, probado en
`apps/server/test/migrate-sql.test.ts`). La SQLite se abre en solo lectura; el servidor Node puede
seguir en marcha.

### Sin D1 (`--target do`)

Todo por `POST /api/admin/import` del worker ya desplegado. La primera vez, con el registro vacío, se
autoriza con `IMPORT_SECRET`; va todo en una petición (cuentas + documentos, hasta 64 MiB):

```bash
cd apps/worker
npx wrangler secret put IMPORT_SECRET
node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --target do --dry-run
node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --target do --url https://alldraw.example.com --secret "$IMPORT_SECRET"
npx wrangler secret delete IMPORT_SECRET
```

En cuanto hay usuarios el secreto deja de valer; para repetir (es idempotente: `INSERT OR IGNORE`) o
subir sólo algunos documentos (`--only id,id`), usa `--key <token>` con una sesión o API key de un
**admin** del worker: entonces van primero las cuentas y luego un documento por petición. `--no-docs`
sube sólo las cuentas. El endpoint también acepta un token de admin con el registro en D1.

### Con D1 (`--target d1`, por defecto)

Dos pasos, con el worker ya desplegado y migrado (`pnpm --filter @all-draw/worker migrate`):

```bash
cd apps/worker
node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --dry-run          # cuenta y avisa, no escribe nada

# 1. cuentas y permisos → D1
node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --out migrate.sql
npx wrangler d1 execute alldraw --remote --file migrate.sql

# 2. documentos Yjs → Durable Object de cada espacio, por la API del worker
node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --url https://alldraw.example.com --key adk_…
```

| Qué | Cómo |
|---|---|
| `users`, `workspaces`, `workspace_members`, `share_links`, `api_keys` | `INSERT OR IGNORE` con los mismos ids (se puede reaplicar sin duplicar). |
| `sessions` | No se migran: caducan y el worker tiene su propio `SESSION_SECRET`. |
| `docs` / `doc_updates` | No van al SQL: el DO guarda el doc en su storage. El script funde el update, lo convierte a Workspace JSON (`@all-draw/sync`) y hace `PUT /api/workspaces/:id/snapshot`. `--only id,id` limita los espacios. |
| Contraseñas `pbkdf2$` | Tal cual (WebCrypto en el worker). |
| Contraseñas `scrypt$` | No se pueden verificar en Workers. Se guardan como `reset$scrypt$…` (login imposible, hash original conservado) y el script lista los emails: **haz login una vez en Node antes de migrar** (re-hashea a PBKDF2) o restablece la contraseña. |

La `--key` del paso 2 debe ser de un **admin** en el worker (escribe en todos los espacios) o del dueño
de cada uno. Las API keys migradas sólo funcionan si el worker tiene **el mismo `SESSION_SECRET`** que
el servidor Node (los hashes son HMAC con él); si no, crea una key nueva en el worker con una sesión
(`POST /api/keys`) y úsala. El script usa `apps/server/scripts/lib/doc-json.mjs` (loader `tsx` del
servidor Node) para la conversión Yjs → JSON, así que hay que ejecutarlo desde el monorepo.

Comprobación tras migrar: `GET /api/workspaces` con la key y `GET /api/workspaces/:id/snapshot`
deben devolver lo mismo que en Node; `apps/server/scripts/backup.mjs` deja un JSON por espacio con el
que comparar (o restaurar con `restore.mjs --into` contra el worker).

## Límites conocidos

- **Un único `RegistryDO`**: todas las operaciones de cuentas, sesiones y permisos (incluida la
  autorización de cada petición de la API y de cada WebSocket) pasan por una sola instancia, que las
  ejecuta en serie. Cada una es una consulta SQLite local de microsegundos más un viaje RPC, así que
  aguanta del orden de cientos a pocos miles de operaciones por segundo: de sobra a esta escala, pero
  es un cuello de botella de escrituras y un punto único (si el DO se reinicia, las peticiones esperan
  a que vuelva). La instancia vive en una región (la de la primera petición); desde lejos se nota la
  latencia. El almacenamiento del DO tiene el límite por objeto de Cloudflare (el registro ocupa poco:
  las instantáneas y los documentos viven en cada `WorkspaceDO`). Si crece, D1 (binding `DB`) es la
  alternativa sin tocar el código.

- **Contraseñas `scrypt$`** creadas por el servidor Node antes de PBKDF2 no se pueden verificar en el
  worker (no hay scrypt en WebCrypto). Arranca una vez el servidor Node contra la BD y haz login
  (migra al vuelo), o restablece la contraseña.
- **Migrar desde Postgres** → Cloudflare: `scripts/migrate-from-sqlite.mjs` sólo lee SQLite. Con Postgres,
  crea las cuentas a mano y sube cada espacio con `GET /api/workspaces/:id/snapshot` en Node +
  `apps/server/scripts/restore.mjs` contra el worker.
- **Rate limit**: el `RateLimiter` de la API es por isolate (orientativo); el real es el binding de Workers
  (*Rate limit*, arriba), por ubicación de Cloudflare y eventualmente consistente.
- `run_worker_first` en Assets requiere wrangler ≥ 4.20; con versiones anteriores hay que servir los
  estáticos desde el worker.
- El bundle incluye todos los packs y `@all-draw/io` (render SVG); el gzip queda muy por debajo del
  límite de 3 MiB, pero cada pack nuevo lo engorda.
- `compatibility_date = "2026-08-22"` es la más reciente que soporta el `workerd` de los tests;
  súbela cuando actualices `wrangler`.
