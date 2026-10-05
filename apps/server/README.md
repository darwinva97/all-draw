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
  mcp-tools.ts      herramientas y recursos MCP (compartidos por stdio y `POST /mcp`)
  mcp-http.ts       MCP remoto: `POST /mcp` (Streamable HTTP sin estado, sólo con API key)
  webhook-transport.ts  envío de webhooks con node:http(s): IP comprobada en el `lookup` del socket (SSRF)
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
| `LOG_LEVEL` | `info` | Log JSON en stdout: `debug` · `info` (una línea por petición) · `warn` · `error` · `silent` |
| `METRICS_TOKEN` | *(vacío)* | `/metrics` responde desde 127.0.0.1 sin proxy; con esto, también con `Authorization: Bearer <token>` |
| `ALLDRAW_COMMIT` | `git rev-parse --short HEAD` | Commit que publican `/api/status` y `alldraw_build_info` |
| `MAX_WORKSPACES_PER_USER` | `100` | Espacios propios por cuenta (los admins sin límite; `0` = sin límite) |
| `MAX_DOC_BYTES` | `20971520` (20 MB) | Tamaño máximo de un espacio (update Yjs completo); `0` = sin límite |
| `REGISTER_MIN_MS` | `2000` | Tiempo mínimo entre `GET /api/auth/config` (da el `formToken`) y el registro; `0` lo desactiva |
| `MAX_WS_PER_IP` / `MAX_WS_PER_WORKSPACE` | `30` / `100` | WebSockets simultáneos; al pasarse, cierre `4429` |
| `TRUSTED_PROXIES` | `loopback,cloudflare` | de quién se creen `X-Forwarded-For` / `CF-Connecting-IP` para la IP real del cliente (IPs, CIDR, `loopback`, `private`, `cloudflare`; vacío = nadie). Ver `docs/07-seguridad.md` |
| `BACKUP_DIR` | `~/.alldraw-backups` | Copias; el servidor deja aquí (`deleted/`) la copia final de los espacios borrados con su cuenta |
| `MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*`, `MAIL_HTTP_*`, `REQUIRE_EMAIL_VERIFICATION` | correo apagado | Ver *Correo* abajo |

Unidad systemd de usuario (`~/.config/systemd/user/alldraw.service`): sigue valiendo tal cual
(`ExecStart=node src/server.mjs` en `apps/server`). Al primer arranque crea la BD e importa los
`.yupdate` (ver *Migración*).

### Correo (apagado por defecto)

El servidor sólo manda correos de cuenta: verificar el correo, restablecer la contraseña y el aviso inmediato de las
menciones. **Sin proveedor configurado no hay correo**: `GET /api/auth/config` anuncia `email: false`, «¿Olvidaste tu
contraseña?» explica que se pida a un administrador y nada se intenta enviar. El proveedor por defecto es `none` en
producción (`NODE_ENV=production` o `PUBLIC_URL` con `https://`) y `log` en desarrollo.

| Variable | Por defecto | Uso |
|---|---|---|
| `MAIL_PROVIDER` | `none` (producción) · `log` (desarrollo) | `none`: sin correo. `log`: no envía; escribe el mensaje entero en el log (`"msg":"correo"`), para desarrollo y e2e. `smtp`: servidor SMTP. `http`: API HTTP (Resend, Postmark, Mailgun u otra). |
| `MAIL_FROM` | *(obligatoria con `smtp`/`http`)* | Remitente, p. ej. `all-draw <no-reply@tu-dominio>` |
| `SMTP_HOST` / `SMTP_PORT` | — / `587` (`465` con `SMTP_SECURE`) | Servidor SMTP |
| `SMTP_SECURE` | `false` | `true`: TLS directo (465). Con `false` se exige **STARTTLS** si el servidor lo anuncia; sin STARTTLS sólo se acepta un relé en `localhost`. |
| `SMTP_USER` / `SMTP_PASS` | *(vacío)* | `AUTH PLAIN` o `AUTH LOGIN` (la que anuncie el servidor); nunca sin cifrar salvo a `localhost`. Van juntas. |
| `MAIL_HTTP_URL` / `MAIL_HTTP_TOKEN` | — | Con `http`: URL del endpoint de envío y token de la API |
| `MAIL_HTTP_FORMAT` | `resend` | Cuerpo: `resend` (`{from,to:[…],subject,text,html}` + `Authorization: Bearer`), `postmark` (`X-Postmark-Server-Token`), `mailgun` (formulario + Basic `api:<token>`) o `json` (plantilla propia) |
| `MAIL_HTTP_TEMPLATE` | — | Con `json`: cuerpo JSON en el que `{{from}}`, `{{to}}`, `{{subject}}`, `{{text}}`, `{{html}}` se sustituyen (escapados). P. ej. Brevo: `{"sender":{"email":"{{from}}"},"to":[{"email":"{{to}}"}],"subject":"{{subject}}","textContent":"{{text}}","htmlContent":"{{html}}"}` |
| `MAIL_HTTP_AUTH_HEADER` | `Authorization` | Cabecera del token si no es `Authorization: Bearer` (p. ej. `api-key`) |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | `true`: sin el correo verificado no se pueden crear espacios en el servidor (403 `email_unverified`; los locales siguen; los admins no lo necesitan). Sólo tiene efecto con correo. |

Si falta una variable o un valor no se entiende, el servidor **no arranca** y lo dice (mejor que creer que hay correo).
El log de arranque dice el proveedor (`"mail":"smtp"`). Los correos van en el idioma de la cuenta (`users.locale`: el de
la interfaz con la que se registró, editable en **Cuenta → Correo y notificaciones**), en texto y en HTML sencillo sin
recursos externos. Ejemplos:

```bash
# SMTP con STARTTLS (587)
MAIL_PROVIDER=smtp MAIL_FROM='all-draw <no-reply@ejemplo.com>' SMTP_HOST=smtp.ejemplo.com SMTP_USER=… SMTP_PASS=…
# Resend
MAIL_PROVIDER=http MAIL_HTTP_URL=https://api.resend.com/emails MAIL_HTTP_TOKEN=re_… MAIL_FROM='all-draw <no-reply@ejemplo.com>'
# Postmark
MAIL_PROVIDER=http MAIL_HTTP_FORMAT=postmark MAIL_HTTP_URL=https://api.postmarkapp.com/email MAIL_HTTP_TOKEN=… MAIL_FROM=…
# Mailgun (región UE)
MAIL_PROVIDER=http MAIL_HTTP_FORMAT=mailgun MAIL_HTTP_URL=https://api.eu.mailgun.net/v3/mg.ejemplo.com/messages MAIL_HTTP_TOKEN=key-… MAIL_FROM=…
```

Los secretos (`SMTP_PASS`, `MAIL_HTTP_TOKEN`) van en un `EnvironmentFile=` de la unidad systemd con permisos `600`, no en
la línea `Environment=`.

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
- **Enlaces que caducan con la conexión abierta**: al aceptar un WebSocket abierto con un enlace con `expiresAt` se
  arma un temporizador; a esa hora se cierra con `4401` y motivo `expired` (el cliente muestra «Ya no tienes acceso»).
- **Correo** (si hay, ver *Correo*): `POST /api/auth/forgot` → enlace `#/restablecer?token=rst_…` (1 h, un solo uso;
  misma respuesta exista o no la cuenta, tiempo mínimo de 400 ms y límites por IP y por correo) → `POST /api/auth/reset`
  (cierra sesiones y WebSockets como cambiar la contraseña). Al registrarse, enlace `#/verificar?token=vfy_…` (24 h) →
  `POST /api/auth/verify`; `POST /api/auth/verify/resend` lo reenvía; cambiar el correo con correo activo no es
  inmediato (`pendingEmail`: se confirma con el enlace enviado al nuevo y se avisa al anterior).
- **Sesiones activas**: `GET /api/auth/sessions` (navegador y sistema resumidos, IP truncada, creada, último uso —
  apuntado como mucho cada 5 min—, `current`) y `DELETE /api/auth/sessions/{id}` (corta sus WebSockets con `4402`).
- **Integraciones** (`docs/07-seguridad.md`, manual *Agentes y API → Webhooks* y *Compartir → Insertar*): webhooks por
  espacio (`/api/workspaces/{id}/webhooks`, firma HMAC, reintentos, `workspace.changed` agregado 30 s con
  `ChangeAggregator`), enlaces de inserción (`/api/workspaces/{id}/embeds`, `GET /embed/<id>/<vista>[.svg]`, oEmbed en
  `/api/oembed`) y MCP remoto (`POST /mcp`).
- **Notificaciones**: `GET /api/notifications`, `POST /api/notifications/read`. Se crean al mencionar a alguien en un
  comentario nuevo (regla en `packages/server-core/src/notifications.ts` y en el manual, *Comentarios*), al añadir un
  miembro, al cambiarle el rol o pasarle la propiedad y al restaurar una instantánea de un espacio ajeno.

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
GET    /api/status                                    versión, commit, uptime, BD (público; 503 si la BD falla)
GET    /metrics                                       Prometheus (sólo 127.0.0.1 sin proxy o Bearer METRICS_TOKEN; no está bajo /api)
GET    /.well-known/security.txt
POST   /api/client-errors {message, stack?, …}        errores de la web → log (8 KB, 30/10 min por IP)
GET    /api/notations                                 packs y tipos (público)
POST   /api/auth/register {email,name,password}       201 {user, token} + cookie
POST   /api/auth/login    {email,password}            200 {user, token} + cookie · 401 · 429
POST   /api/auth/logout                               204
GET    /api/auth/config                               {registration, passwordMinLength, formToken, formMinMs}
GET    /api/auth/me                                   {user, via: 'session'|'apikey', quotas}
PATCH  /api/auth/me {name?, email?, password?}        el email exige sesión y contraseña
GET    /api/auth/export                               JSON con la cuenta y sus espacios (RGPD)
DELETE /api/auth/account {password}                   borra la cuenta (regla en docs/07-seguridad.md)
PATCH  /api/admin/users/:id {isAdmin}                 admin
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
share_links        token PK, workspace_id FK cascade, role, created_by, created_at, expires_at NULL, view_id NULL (v5: enlaces de inserción `emb_…`)
account_tokens     token_hash PK, user_id FK cascade, kind ∈ {reset, verify}, email, created_at, expires_at   (v4)
notifications      id PK, user_id FK cascade, kind, workspace_id FK cascade NULL, payload JSON, created_at, read_at   (v4)
webhooks           id PK, workspace_id FK cascade, url, events JSON, format, lang, secret, created_by, created_at, deliveries JSON (últimas 20)   (v5)
docs               workspace_id PK FK cascade, state BLOB, updated_at
doc_updates        id AUTOINCREMENT, workspace_id FK cascade, data BLOB, created_at
schema_migrations  version PK, applied_at
```

La migración **v4** (`0004_accounts.sql` en el worker) añade además `users.email_verified_at`, `users.locale`,
`users.notify_email` (1 por defecto) y `sessions.device` (navegador;sistema;tipo, nunca el user-agent entero),
`sessions.ip` (truncada) y `sessions.last_used_at`. Las cuentas que ya existían quedan **sin verificar**.

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

## Operaciones (VPS)

Producción: unidad de usuario `alldraw` (puerto 4002, `DB_PATH=~/.alldraw-data/alldraw.sqlite`). Los
scripts de `scripts/` no necesitan parar el servicio: abren la SQLite en solo lectura y usan la API.

### Copias de seguridad (`scripts/backup.mjs`)

```bash
pnpm --filter @all-draw/server backup        # = node scripts/backup.mjs
```

Escribe `~/.alldraw-backups/<fecha>/` (`BACKUP_DIR`) con:

- `alldraw.sqlite.gz`: copia consistente de la BD con `sqlite.backup()` de `node:sqlite` (no bloquea
  al servidor; si el Node no la tuviera, `VACUUM INTO`), pasada a journal `DELETE` y comprobada con
  `integrity_check`.
- `<workspaceId>.json.gz` por espacio: `{ format: "all-draw-backup/1", workspace: {id, name, dueño,
  members, links}, snapshot: Workspace }` con el Workspace JSON sacado del doc Yjs (`docs.state` +
  `doc_updates`, `YjsStore.snapshot()`). Si un doc no valida, se guarda el update crudo como
  `<id>.yupdate.gz` y el script sale con 1.
- `manifest.json` con el resumen.

Variables: `DB_PATH`/`DATA_DIR` (como el servidor), `BACKUP_DIR` (`~/.alldraw-backups`), `KEEP_DAYS`
(30; `0` desactiva el borrado). Se borran las carpetas `<fecha>` más antiguas que `KEEP_DAYS` días.

Cron (instalado en el crontab de `maka`, a las 03:17):

```
17 3 * * * cd /home/maka/projects/all-draw/apps/server && node scripts/backup.mjs >> ~/.alldraw-backups/backup.log 2>&1
```

Al terminar, `backup.mjs` sube la copia fuera del servidor (siguiente apartado). Si esa subida falla, la copia local
sigue valiendo y el código de salida no cambia: se anota `offsite ERROR: …` en `backup.log` y se avisa por ntfy.
`OFFSITE=0` la salta.

### Copias fuera del servidor (`scripts/offsite.mjs`, Backblaze B2)

Bucket privado de Backblaze B2 (`us-east-005`, cifrado en reposo SSE-B2, regla de ciclo de vida: cada fichero se
oculta a los 90 días y se borra al día siguiente). Credenciales en `~/.config/alldraw/b2.env` (`B2_KEY_ID`,
`B2_APP_KEY`, `B2_BUCKET`, `B2_S3_ENDPOINT`, `B2_REGION`; otra ruta con `B2_ENV_FILE`); la clave sólo vale para ese
bucket. API S3 compatible con firma SigV4 hecha con `node:crypto` (`scripts/lib/s3.mjs`, sin dependencias; probada con
el ejemplo de la documentación de AWS).

```bash
node scripts/offsite.mjs                          # sube la última ~/.alldraw-backups/<fecha>/
node scripts/offsite.mjs --dir <carpeta> --weekly always|never|auto --notify
node scripts/offsite-restore.mjs --list           # copias diarias y semanales del bucket
node scripts/offsite-restore.mjs --date latest --into /tmp/restaurada [--weekly]
node scripts/offsite-restore.mjs --date 2026-10-05T01-17-06Z --into /tmp/restaurada
```

- **Qué sube**: todos los ficheros de la carpeta (`alldraw.sqlite.gz`, un `<id>.json.gz` por espacio y `manifest.json`)
  a `daily/<fecha>/`; si la última copia de `weekly/` tiene 6 días o más, también a `weekly/<fecha>/`. Como la regla
  del bucket es la misma para todo, hoy las semanales también duran 90 días (para guardarlas más tiempo basta una regla
  propia para `weekly/` en el panel de B2).
- **Verificación**: cada fichero va con `Content-MD5` (B2 rechaza la subida si no coincide) y metadatos `sha256` y `sha1`;
  después un `HEAD` comprueba tamaño, ETag (= MD5) y `sha256`. Lo que ya está idéntico no se vuelve a subir. Al final se
  sube `offsite.json` con la lista y las sumas: sin él la copia cuenta como incompleta.
- **Restaurar**: `offsite-restore.mjs` descarga, comprueba cada fichero contra `offsite.json` (sha256, tamaño) y el ETag,
  y pasa `PRAGMA integrity_check` a la `alldraw.sqlite.gz` descomprimida en un temporal. La carpeta tiene el formato de
  `~/.alldraw-backups/<fecha>/`: vale para `restore.mjs`, para `restore-drill.mjs --from <carpeta>` o para restaurar
  la instalación entera (abajo). Sale con 1 si algo no cuadra.
- **Avisos**: `scripts/lib/ntfy.mjs` publica en el tema privado de https://ntfy.sh de `~/.config/alldraw/ntfy-topic`
  (`NTFY_TOPIC` / `NTFY_TOPIC_FILE`); el tema no se escribe nunca en el log.

Comprobado el 5 de octubre de 2026: subida real de `2026-10-05T01-17-06Z` (5 ficheros, 31,6 KiB) a `daily/` y `weekly/`,
segunda pasada sin resubir nada, descarga verificada con `integrity_check` y `restore-drill.mjs --from` sobre la carpeta
descargada (3/3 espacios validados).

### Restaurar un espacio (`scripts/restore.mjs`)

Sube un JSON de la copia a un servidor en marcha (Node o worker) con una API key:

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… \
  node scripts/restore.mjs ~/.alldraw-backups/<fecha>/<id>.json.gz            # crea un espacio nuevo (POST /api/workspaces {initial})
ALLDRAW_URL=… ALLDRAW_API_KEY=… node scripts/restore.mjs <fichero> --into ws_… # reemplaza el contenido (PUT /api/workspaces/:id/snapshot)
```

`--name` cambia el nombre. Miembros y enlaces no se restauran (se listan). Acepta también un Workspace
JSON a secas (la exportación de la app). Para restaurar **toda** la instalación, para el servicio,
descomprime `alldraw.sqlite.gz` sobre `DB_PATH` (borrando `-wal`/`-shm`) y arranca.

### Vigilante (`scripts/healthcheck.mjs`)

Pide `GET /healthz` (`ALLDRAW_URL`, por defecto `http://127.0.0.1:4002`); a la tercera falta seguida
(`HEALTH_FAILS`) hace `systemctl --user restart alldraw` (`ALLDRAW_UNIT`). El contador vive en
`~/.alldraw-backups/health.state`; sólo escribe en el log cuando falla, reinicia o se recupera. Cron
instalado (cada 5 minutos):

```
*/5 * * * * cd /home/maka/projects/all-draw/apps/server && node scripts/healthcheck.mjs >> ~/.alldraw-backups/health.log 2>&1
```

### Mantenimiento semanal (`scripts/maintenance.mjs`)

`quick_check`, compactación de `doc_updates` en `docs.state`, purga de sesiones caducadas, `ANALYZE`, `PRAGMA optimize`,
`VACUUM` y checkpoint del WAL, con el servidor en marcha (lógica en `src/maintenance.ts`; `--no-vacuum` se lo salta).

### Simulacro de restauración (`scripts/restore-drill.mjs`)

Toma la última copia de `BACKUP_DIR` (o `--from <carpeta>`), la descomprime en un `DATA_DIR` temporal, crea **en la
copia** un admin técnico con API key, arranca `src/server.mjs` en un puerto alto libre de 127.0.0.1, comprueba
`/api/status`, que estén todos los espacios del `manifest.json` y `GET /api/workspaces/:id/validate` y `…/snapshot` de
cada uno (mismos elementos y vistas), lo para con SIGTERM (debe salir con 0) y borra el temporal (`--keep` lo deja).
Escribe `BACKUP_DIR/restore-drill.last.json`; sale con 1 si algo falla y con 2 si no hay copias.

Cron (instalado, domingos, después de la copia diaria):

```
37 3 * * 0 cd /home/maka/projects/all-draw/apps/server && /usr/bin/node scripts/maintenance.mjs >> /home/maka/.alldraw-backups/maintenance.log 2>&1
57 3 * * 0 cd /home/maka/projects/all-draw/apps/server && /usr/bin/node scripts/restore-drill.mjs >> /home/maka/.alldraw-backups/restore-drill.log 2>&1
```

`backup.mjs` borra también, pasados `KEEP_DAYS`, las copias finales de `BACKUP_DIR/deleted/` (espacios borrados con la
cuenta de su dueño; se restauran con `restore.mjs` como cualquier otra).

### Logs y métricas

Una línea JSON por petición en el journal (`journalctl --user -u alldraw -o cat | jq …`): método, ruta sin tokens, estado,
ms, usuario (`id`/`link`/`anon`) e IP truncada. `curl -s 127.0.0.1:4002/metrics` desde el VPS (a través de Caddy da 403).
Apagado: SIGTERM cierra los WebSockets con 1012, guarda los docs y cierra la BD (máx. 10 s).

### Migrar a Cloudflare

`apps/worker/scripts/migrate-from-sqlite.mjs` (ver `apps/worker/README.md`, sección *Migración*).

### Copia de respaldo en Cloudflare y monitor externo

El VPS es el entorno principal. El worker (`https://alldraw.darwin-sva-97.workers.dev`) es una **copia de respaldo de
solo lectura** (`STANDBY="true"`) que `apps/worker/scripts/sync-standby.mjs` deja idéntica al VPS cada noche (ver
`apps/worker/README.md`, *Copia de respaldo*). Cron instalado, después de la copia de las 03:17:

```
47 3 * * * cd /home/maka/projects/all-draw/apps/worker && /usr/bin/node scripts/sync-standby.mjs >> /home/maka/.alldraw-backups/sync-standby.log 2>&1
```

Lee el secreto de `~/.config/alldraw/cf-import-secret` (el mismo valor que `IMPORT_SECRET` del worker), se niega a
escribir si el destino no publica `standby: true`, deja el resumen en `~/.alldraw-backups/sync-standby.last.json` y
avisa por ntfy si falla.

`apps/monitor` (worker `alldraw-monitor`) comprueba cada 5 minutos `/api/status` de los dos entornos, avisa por ntfy
al caer (2 fallos seguidos) y al recuperarse, y publica la página de estado
https://alldraw-monitor.darwin-sva-97.workers.dev (ver `apps/monitor/README.md`). Complementa al vigilante local
(`healthcheck.mjs`), que reinicia el servicio pero no ve fallos de red, DNS, Caddy o del propio VPS.

## MCP

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
```

Herramientas: `list_workspaces`, `get_snapshot`, `list_views`, `run_commands`, `validate`, `list_notations`,
`render_svg`; recursos `alldraw://workspaces`, `alldraw://workspaces/{id}/snapshot` y `…/views/{viewId}.svg`
(`mcp-tools.ts`). Todas pasan por la API REST con `Authorization: Bearer $ALLDRAW_API_KEY`, así que el
MCP puede correr en la máquina del agente. Ver `SKILL.md`.

**Remoto**: el servidor publica lo mismo en `POST /mcp` (Streamable HTTP, sin sesiones, respuestas JSON), sólo con
`Authorization: Bearer adk_…`; las herramientas llaman a la API en el mismo proceso con esa clave. Configuración de los
clientes en `docs/manual/agentes-y-api.md#mcp-remoto`. No existe en el worker.

## Tests

```bash
pnpm --filter @all-draw/server test        # vitest: servidor real (store en memoria) + contrato memory/sqlite
TEST_DATABASE_URL=postgres://u:p@127.0.0.1:5432/alldraw_test pnpm --filter @all-draw/server test   # + contrato Postgres (vacía las tablas)
pnpm --filter @all-draw/server-core test   # API sin servidor HTTP (app.request), auth WebCrypto, contrato memory
pnpm --filter @all-draw/server typecheck
```
