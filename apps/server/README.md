# @all-draw/server

Servidor de all-draw en **Node** (≥ 22.13, usa `node:sqlite`): sirve la app web compilada, sincroniza
documentos Yjs por WebSocket y expone una API REST (con OpenAPI) y un servidor MCP para agentes.

Todo lo que no depende del runtime vive en **`packages/server-core`** (`@all-draw/server-core`) y lo
comparte con **`apps/worker`** (Cloudflare Workers + D1 + Durable Objects, ver su README):

```
packages/server-core/src/
  api.ts            rutas REST con @hono/zod-openapi → /api/openapi.json (createApi({ store, docs, hash, config }))
  auth.ts           PBKDF2 y tokens con WebCrypto, cookies, principal, roles, authorizeConnection, rate limit
  docs.ts           LiveDoc / DocManager: doc Yjs vivo por espacio, persistencia con debounce
  host.ts           DocHost: lo que la API pide al contenido (snapshot, commands, validate, svg, …) + LocalDocHost
  ops.ts            las operaciones anteriores como funciones sobre un YjsStore (las usa Node y el DO)
  ysync.ts          protocolo y-websocket con roles sobre un SyncSocket mínimo (viewer = sólo lectura)
  notations.ts      registro con todos los packs → GET /api/notations
  store/types.ts    interfaz WorkspaceStore · store/memory.ts adaptador en memoria
packages/server-core/test/store-contract.ts   batería de contrato que corre contra cada adaptador

apps/server/src/
  server.mjs        entrada estable (systemd): registra el loader tsx y carga server.ts
  server.ts         arranque: config, Postgres (DATABASE_URL) o SQLite, migración de ficheros antiguos, listen, apagado limpio
  app.ts            http.Server = API (server-core) + estáticos SPA + WebSocket /ws/<id> sobre `ws`
  ysync.ts          adaptador de `ws` al protocolo de server-core (+ ping/pong)
  auth.ts           registra el verificador de hashes heredados `scrypt$` (node:crypto) y re-exporta server-core
  store/sqlite.ts   adaptador node:sqlite · store/postgres.ts adaptador pg (pool, migraciones idempotentes)
  legacy.ts         importación de ~/.alldraw-data/<id>.yupdate
  mcp.ts            servidor MCP (stdio) que habla con la API REST
  api.ts, docs.ts, notations.ts, store/{types,memory}.ts   re-exportan server-core
test/               vitest (servidor real en puerto libre; contrato del store para memory, sqlite y postgres)
SKILL.md            guía para agentes: cómo modelar con comandos
```

¿Por qué `tsx` y no `--experimental-strip-types`? Los paquetes del monorepo se importan desde sus
fuentes `.ts` con imports sin extensión (`./ids`), que Node no resuelve; `tsx` sí. Vitest lo
compila con Vite igualmente.

## Arranque

```bash
pnpm --filter @all-draw/server start          # node src/server.mjs
PORT=4002 HOST=127.0.0.1 DATA_DIR=~/.alldraw-data node src/server.mjs
```

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` / `HOST` | `4002` / `127.0.0.1` | Escucha |
| `DATA_DIR` | `~/.alldraw-data` | Directorio de datos (BD y ficheros heredados) |
| `DB_PATH` | `$DATA_DIR/alldraw.sqlite` | Fichero SQLite (WAL) |
| `DATABASE_URL` | *(vacío)* | Si se define (`postgres://user:pass@host:5432/db`), se usa Postgres en vez de SQLite; las migraciones se aplican al arrancar (`schema_migrations`, con advisory lock). |
| `STATIC_DIR` | `../web/dist` | App web compilada (fallback SPA a `index.html`) |
| `SESSION_SECRET` | *(vacío)* | Si se define, los hashes de tokens en la BD son HMAC con este secreto en lugar de SHA-256: una copia de la BD no sirve para suplantar sesiones. Cambiarlo invalida todas las sesiones y API keys. |
| `ALLOW_REGISTRATION` | `true` | `false` cierra `POST /api/auth/register` (salvo si aún no hay usuarios) |
| `COOKIE_SECURE` | `false` | Fuerza `Secure` en la cookie. Detrás de Caddy no hace falta: se activa solo cuando llega `x-forwarded-proto: https`. |
| `PUBLIC_URL` | *(de la petición)* | Base para las URLs de los enlaces compartidos |

Unidad systemd de usuario (`~/.config/systemd/user/alldraw.service`): sigue valiendo tal cual
(`ExecStart=node src/server.mjs` en `apps/server`). Al primer arranque crea la BD e importa los
`.yupdate` (ver *Migración*).

## Identidad y permisos

- **Registro/login** con email y contraseña: PBKDF2-HMAC-SHA256 (100 000 iteraciones, WebCrypto, el
  mismo código en Node y en Workers) → `pbkdf2$<iter>$<sal>$<hash>`. Los hashes `scrypt$…` de versiones
  anteriores siguen valiendo en Node y se **re-hashean a PBKDF2 en el primer login correcto**
  (`setPasswordHash`). El primer usuario real es **admin**
  (ve y administra todos los espacios). Login limitado a 10 intentos / 15 min por IP y por email.
- **Sesión**: token `ads_…` (30 días) en cookie `alldraw_session` (`HttpOnly; SameSite=Lax; Path=/;
  Secure` en https) y también en el cuerpo de la respuesta para clientes no navegador.
- **API keys** `adk_…`: para agentes; se crean desde una sesión y el secreto sólo se devuelve al crearlas.
- **Enlaces compartidos** `lnk_…`: token con rol (`editor` o `viewer`) y caducidad opcional. Vale en
  el WebSocket y en las rutas de *ese* espacio (leer meta, snapshot, validate, svg; comandos si es editor).
- Cómo se envía: `Authorization: Bearer <token>` (cualquiera de los tres), cookie, o `?token=`
  (el WebSocket usa `?token=`; el navegador manda además la cookie).

Roles por espacio: `owner` (dueño en `workspaces.owner_id`) > `editor` > `viewer`.

| Acción | viewer | editor | owner |
|---|---|---|---|
| GET meta, snapshot, validate, svg, miembros; WebSocket (recibir) | ✓ | ✓ | ✓ |
| WebSocket (escribir), `POST commands`, `PUT snapshot`, `PATCH {name}` | | ✓ | ✓ |
| miembros, enlaces, `PATCH {ownerId}`, `DELETE` | | | ✓ |

Un viewer conectado por WebSocket recibe todos los cambios; los suyos **no se aplican ni se
retransmiten** y el servidor le contesta con un mensaje y-websocket de tipo 2 (`auth`,
`permissionDenied`) cuya razón es `{"error":"read-only"}`. Sin permiso: cierre `4401`; espacio
inexistente: `4404`; espacio borrado mientras estabas dentro: `4410`.

## API

Documento completo en `GET /api/openapi.json` (OpenAPI 3.1). Resumen:

```
GET    /healthz
GET    /api/notations                                 packs y tipos (público)
POST   /api/auth/register {email,name,password}       201 {user, token} + cookie
POST   /api/auth/login    {email,password}            200 {user, token} + cookie · 401 · 429
POST   /api/auth/logout                               204
GET    /api/auth/me                                   {user, via: 'session'|'apikey'}
GET    /api/keys · POST /api/keys {name} → {key} · DELETE /api/keys/:id
GET    /api/workspaces                                {workspaces:[{id,name,ownerId,…,role}]}
POST   /api/workspaces {name?, initial?: Workspace}   201
GET    /api/workspaces/:id                            meta + role (vale con enlace)
PATCH  /api/workspaces/:id {name?, ownerId?}
DELETE /api/workspaces/:id
GET    /api/workspaces/:id/members                    {ownerId, members:[{userId,role,user}]}
PUT    /api/workspaces/:id/members/:userId {role}     · DELETE …/members/:userId
POST   /api/workspaces/:id/links {role, expiresAt?}   201 {token, url, …}
GET    /api/workspaces/:id/links · DELETE …/links/:token
GET    /api/workspaces/:id/snapshot                   Workspace JSON
PUT    /api/workspaces/:id/snapshot  (Workspace)      reemplaza todo el contenido
POST   /api/workspaces/:id/commands {commands, label?} {applied, inverse} · 400 inválido · 422 no aplicable
GET    /api/workspaces/:id/validate                   {diagnostics, summary}
GET    /api/workspaces/:id/views/:viewId/svg?theme=   image/svg+xml
WS     /ws/:id?token=                                 protocolo y-websocket
```

Errores siempre como `{ "error": "…", "issues"?: [...] }`.

## Persistencia

Cada espacio es un `Y.Doc` (un `Y.Map` por colección, ver `@all-draw/sync`). El servidor mantiene
en memoria los docs abiertos (`DocManager`), guarda 500 ms después del último cambio
(`saveDoc` = update completo) y descarga el doc a los 60 s sin conexiones. La API REST y el
WebSocket comparten el mismo doc, por eso un `POST commands` llega al instante a los clientes.

### Esquema (`store/sqlite.ts` y `store/postgres.ts`, migración v1; `apps/worker/migrations/0001_init.sql` para D1)

```
users              id PK, email UNIQUE, name, password_hash, is_admin, created_at
sessions           token_hash PK, user_id FK→users (cascade), created_at, expires_at
api_keys           id PK, user_id FK, name, prefix, key_hash UNIQUE, created_at, last_used_at
workspaces         id PK, owner_id FK→users, name, created_at, updated_at
workspace_members  (workspace_id FK cascade, user_id FK cascade) PK, role ∈ {editor, viewer}, created_at
share_links        token PK, workspace_id FK cascade, role, created_by, created_at, expires_at NULL
docs               workspace_id PK FK cascade, state BLOB, updated_at
doc_updates        id AUTOINCREMENT, workspace_id FK cascade, data BLOB, created_at
schema_migrations  version PK, applied_at
```

Todas las fechas son ISO-8601 en texto; los tokens nunca se guardan en claro (sólo los de enlace,
que se listan). `loadDoc` funde `docs.state` con los `doc_updates` pendientes (`Y.mergeUpdates`);
`saveDoc` reemplaza el estado y vacía la cola. Así un adaptador puede elegir entre escribir el
estado completo o encolar incrementales.

### Adaptadores

La interfaz `WorkspaceStore` (`server-core/store/types.ts`) es asíncrona y no expone SQL.

| Adaptador | Dónde | Selección |
|---|---|---|
| `MemoryWorkspaceStore` | `server-core/store/memory.ts` | tests |
| `SqliteWorkspaceStore` | `store/sqlite.ts` (`node:sqlite`, migra al abrir) | por defecto (`DB_PATH`) |
| `PostgresWorkspaceStore` | `store/postgres.ts` (`pg`, pool, `BYTEA`/`BOOLEAN`/`BIGSERIAL`, `$n`) | `DATABASE_URL` |
| `D1WorkspaceStore` | `apps/worker/src/store/d1.ts` (migra `wrangler d1 migrations apply`) | worker |

`memory.ts` es la referencia de semántica y la batería `@all-draw/server-core/test/store-contract`
(`storeContractTests(name, factory)`) corre contra todos: `test/store.test.ts` (memory + sqlite),
`test/store-postgres.test.ts` (se salta sin `TEST_DATABASE_URL`) y, en el worker, el contrato
implícito de `test/api.test.ts` sobre D1 real.

En el worker el documento no vive en el store sino en el Durable Object del espacio (`WorkspaceDO`):
`DocHost` (`server-core/host.ts`) es la costura: `LocalDocHost` (Node, sobre `DocManager`) o
`RemoteDocHost` (worker, `stub.fetch`). La API es la misma.

## Migración desde la versión anterior

La versión anterior guardaba una sala por fichero `$DATA_DIR/<id>.yupdate` sin dueño. Al arrancar,
`importLegacyFiles` crea el usuario técnico `legacy@alldraw.local` (sin contraseña: no puede iniciar
sesión y no cuenta para decidir quién es admin) y, para cada fichero sin fila en `workspaces`, crea el
espacio con ese mismo id y guarda el doc. **El fichero no se modifica ni se borra.**

Pasos para el despliegue:

1. `systemctl --user restart alldraw` (misma unidad). Comprueba en el journal `legacy: importados N espacios`.
2. Regístrate: el primer usuario es admin y ve los espacios heredados en `GET /api/workspaces`.
3. Reclama cada uno: `PATCH /api/workspaces/<id> {"ownerId":"<tu id>"}` (o repártelos con `PUT …/members`).
4. Los enlaces antiguos `#/w/<id>?room=<id>` ya no conectan: sin token el WebSocket cierra con 4401.
   Crea enlaces nuevos con `POST …/links`.
5. Opcional: define `SESSION_SECRET` y `ALLOW_REGISTRATION=false` una vez creadas las cuentas.

## MCP

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
```

Herramientas: `list_workspaces`, `get_snapshot`, `run_commands`, `validate`, `list_notations`,
`render_svg`. Todas pasan por la API REST con `Authorization: Bearer $ALLDRAW_API_KEY`, así que el
MCP puede correr en la máquina del agente. Ver `SKILL.md`.

## Tests

```bash
pnpm --filter @all-draw/server test        # vitest: servidor real (store en memoria) + contrato memory/sqlite
TEST_DATABASE_URL=postgres://u:p@127.0.0.1:5432/alldraw_test pnpm --filter @all-draw/server test   # + contrato Postgres (vacía las tablas)
pnpm --filter @all-draw/server-core test   # API sin servidor HTTP (app.request), auth WebCrypto, contrato memory
pnpm --filter @all-draw/server typecheck
```
