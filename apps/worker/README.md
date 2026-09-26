# @all-draw/worker

all-draw en Cloudflare: un Worker con **la misma API Hono** que el servidor Node
(`@all-draw/server-core`), cuentas y permisos en **D1**, un **Durable Object por espacio**
(`WorkspaceDO`) con el `Y.Doc` vivo y el protocolo y-websocket, y la app web servida por **Assets**.

```
src/index.ts          fetch(): /api + /healthz → createApi (D1 + RemoteDocHost); /ws/<id> → autoriza y reenvía al DO; resto → ASSETS
src/do.ts             WorkspaceDO: LiveDoc + attachConnection (server-core) con Hibernation API; storage troceado; fetch interno
src/remote-host.ts    DocHost que traduce init/snapshot/replace/setMeta/commands/validate/renderSvg/drop a stub.fetch
src/store/d1.ts       WorkspaceStore sobre D1 (mismas tablas que SQLite)
src/env.ts            bindings y variables
migrations/           0001_init.sql (mismo SQL que apps/server/src/store/sqlite.ts v1)
wrangler.toml         d1_databases, durable_objects (SQLite-backed), assets, vars
test/api.test.ts      vitest dentro de workerd (@cloudflare/vitest-pool-workers): D1 + DO + WebSocket reales
```

## Qué se comparte y qué no

| Pieza | Node (`apps/server`) | Cloudflare (`apps/worker`) |
|---|---|---|
| API REST/OpenAPI, auth (PBKDF2 WebCrypto), permisos, catálogo | `@all-draw/server-core` | `@all-draw/server-core` (idéntico) |
| Contenido de un espacio (`DocHost`) | `LocalDocHost` sobre `DocManager` en proceso | `RemoteDocHost` → `stub.fetch` al `WorkspaceDO` |
| Protocolo y-websocket | `attachConnection` sobre `ws` | `attachConnection` sobre `WebSocketPair` + hibernación |
| `WorkspaceStore` | SQLite (`node:sqlite`) o Postgres (`DATABASE_URL`) | D1 |
| Doc persistido | tablas `docs`/`doc_updates` | storage del DO (`doc:meta`, `doc:<n>` en trozos de 96 KiB) |
| Estáticos | `STATIC_DIR` (fallback SPA) | `[assets]` con `not_found_handling = "single-page-application"` |
| Hashes `scrypt$` heredados | se verifican (`node:crypto`) y se re-hashean a PBKDF2 en el login | no se pueden verificar: el usuario debe restablecer contraseña (o migra antes con el servidor Node) |

Lo que el worker **no** hace: importar `.yupdate` heredados (`legacy.ts` es sólo Node) y el MCP
(`src/mcp.ts` habla con la API por HTTP, así que corre igual contra el worker).

## Desarrollo local

```bash
pnpm --filter web build                      # la app que sirve Assets (../web/dist)
pnpm --filter @all-draw/worker migrate:local # D1 local (.wrangler/state)
pnpm --filter @all-draw/worker dev           # wrangler dev → http://localhost:8787
pnpm --filter @all-draw/worker test          # vitest 4 + workerd (D1, DO y WebSocket reales, sin red)
pnpm --filter @all-draw/worker typecheck
```

Los tests del worker corren con **vitest 4** (dependencia local: `@cloudflare/vitest-pool-workers`
aún no soporta vitest 5) y por eso el `vitest.config.ts` de la raíz excluye `apps/worker`.

## Despliegue (no automatizado: pasos manuales)

1. **Login**: `npx wrangler login` (o `CLOUDFLARE_API_TOKEN` con permisos Workers Scripts, D1 y
   Durable Objects; el token de DNS del entorno no vale).
2. **Crear la base D1** y copiar su id a `wrangler.toml` (`database_id`):
   ```bash
   npx wrangler d1 create alldraw
   ```
3. **Migrar** el esquema: `pnpm --filter @all-draw/worker migrate` (= `wrangler d1 migrations apply alldraw --remote`).
4. **Compilar la app web**: `pnpm --filter web build` (Assets lee `../web/dist`).
5. **Variables** (`[vars]` en `wrangler.toml` o el panel) y **secretos**:
   | Variable | Uso |
   |---|---|
   | `SESSION_SECRET` | `wrangler secret put SESSION_SECRET`. Los hashes de sesión/API key son HMAC con él; cambiarlo invalida todas las sesiones. Recomendado siempre. |
   | `ALLOW_REGISTRATION` | `"false"` cierra el registro una vez creado el primer usuario (el primero siempre puede y es admin). |
   | `PUBLIC_URL` | Base de los enlaces compartidos (`https://alldraw.example.com`); si falta se deduce de la petición. |
   La cookie de sesión va siempre con `Secure` (en Cloudflare todo es https).
6. **Desplegar**: `pnpm --filter @all-draw/worker deploy`. La primera vez aplica la migración `v1` de
   Durable Objects (`new_sqlite_classes = ["WorkspaceDO"]`).
7. **Dominio**: en el panel del Worker, *Custom domains* (o `routes` en `wrangler.toml`).
8. Regístrate: el primer usuario es admin.

`npx wrangler deploy --dry-run --outdir /tmp/wd` valida configuración y bundle sin desplegar
(≈2,1 MiB / 312 KiB gzip con todos los packs de notación y el render SVG).

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
- Las operaciones de la API son las mismas funciones `op*` de `@all-draw/server-core/ops` que usa
  Node; `CommandError` se traduce a 400/422 igual.

## Migración desde el servidor Node (SQLite → D1 + DO)

`scripts/migrate-from-sqlite.mjs` (el generador SQL puro es `scripts/migrate-sql.mjs`, probado en
`apps/server/test/migrate-sql.test.ts`). La SQLite se abre en solo lectura; el servidor Node puede
seguir en marcha. Dos pasos, con el worker ya desplegado y migrado (`pnpm --filter @all-draw/worker migrate`):

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

- **Contraseñas `scrypt$`** creadas por el servidor Node antes de PBKDF2 no se pueden verificar en el
  worker (no hay scrypt en WebCrypto). Arranca una vez el servidor Node contra la BD y haz login
  (migra al vuelo), o restablece la contraseña.
- **Migrar desde Postgres** → D1 + DO: `scripts/migrate-from-sqlite.mjs` sólo lee SQLite. Con Postgres,
  crea las cuentas a mano y sube cada espacio con `GET /api/workspaces/:id/snapshot` en Node +
  `apps/server/scripts/restore.mjs` contra el worker.
- **Rate limit de login** (`RateLimiter`) es por isolate: en Cloudflare es sólo orientativo. Para uno
  real, usa el binding *Rate Limiting* del Worker.
- `run_worker_first` en Assets requiere wrangler ≥ 4.20; con versiones anteriores hay que servir los
  estáticos desde el worker.
- El bundle incluye todos los packs y `@all-draw/io` (render SVG); el gzip queda muy por debajo del
  límite de 3 MiB, pero cada pack nuevo lo engorda.
- `compatibility_date = "2026-08-22"` es la más reciente que soporta el `workerd` de los tests;
  súbela cuando actualices `wrangler`.
