# Agentes y API

Todo lo que haces en el editor (añadir un elemento, conectar, mover, renombrar) se guarda como un
**comando**: una instrucción pequeña y serializable como `addElementToView` o `connect`. La API REST y el
servidor MCP envían esos mismos comandos al mismo documento. Por eso lo que hace un script o un
asistente de IA aparece **al instante** en el navegador de quien tenga el espacio abierto, y se puede
deshacer como cualquier otro cambio.

Este capítulo es para quien quiera automatizar all-draw: scripts, integraciones o agentes de IA. Al
final explica también cómo instalar tu propio servidor.

## Claves API {#claves}

Para que un programa actúe en tu nombre necesita una **clave API**. Se crea desde la aplicación, con la
sesión iniciada:

![Pantalla de claves API tras crear una clave](img/12-claves-api.png)

1. En el inicio, pulsa **claves API**. Se abre la pantalla **Cuenta** (`#/keys`).
2. En **Claves API**, escribe un nombre que te diga para qué es (por ejemplo `agente-claude`) y pulsa
   **Crear**.
3. Copia la clave `adk_…` **en ese momento**: no se vuelve a mostrar. La lista solo guarda el nombre, el
   prefijo, la fecha de creación y la del último uso.
4. Cuando ya no la necesites, o si crees que alguien la ha visto, pulsa **Revocar**: deja de valer al
   instante.

Qué puede hacer una clave:

- Tiene **exactamente tus permisos**: en cada espacio, el rol que tú tengas (`owner`, `editor` o
  `viewer`). Para modificar un espacio hace falta `editor` u `owner`.
- Se envía en la cabecera `Authorization: Bearer adk_…`.
- Las claves solo se crean desde una sesión del navegador; una clave no puede crear otras claves.
- Un **enlace compartido** (`lnk_…`, ver [Compartir y colaborar](compartir-y-colaborar.md)) también vale
  como `Bearer`, pero limitado a su espacio y a su rol.

> [!WARNING]
> Trata la clave como una contraseña. Guárdala en una variable de entorno o en un gestor de secretos;
> nunca en el código, en un repositorio ni en un chat.

## API REST {#rest}

La API vive en el mismo servidor que la aplicación, bajo `/api`. En el servidor público la base es
`https://alldraw.bezenti.com`; si tienes el tuyo, la URL de tu instalación. El documento completo en
formato OpenAPI 3.1 está en [/api/openapi.json](/api/openapi.json): cualquier cliente de OpenAPI
(Swagger UI, Postman, Insomnia, generadores de código) lo puede leer.

El flujo habitual tiene cinco pasos:

1. **Conocer los tipos**: `GET /api/notations` devuelve cada notación con los identificadores exactos de
   sus tipos (`bpmn:Task`, `archimate:ApplicationComponent`…) y sus campos. No necesita clave.
2. **Leer el espacio**: `GET /api/workspaces/:id/snapshot` devuelve el espacio entero en JSON (elementos,
   relaciones, vistas, nodos…). Así reutilizas lo que ya existe en vez de duplicarlo.
3. **Cambiarlo**: `POST /api/workspaces/:id/commands` con una lista de comandos. El lote es **atómico**:
   o se aplica entero o no se aplica nada.
4. **Comprobarlo**: `GET /api/workspaces/:id/validate` devuelve los mismos diagnósticos que el panel de
   problemas, cada uno con arreglos propuestos (`supportedFixes`) listos para reenviar como comandos.
5. **Verlo**: `GET /api/workspaces/:id/views/:viewId/svg?theme=light|dark|dual` devuelve la vista como
   imagen SVG.

Resumen de las rutas más usadas:

```
GET    /api/notations                                  notaciones y tipos (público)
GET    /api/auth/me                                    quién soy y cómo (session | apikey)
GET    /api/workspaces                                 mis espacios, con mi rol en cada uno
POST   /api/workspaces {name?, initial?}               crear (initial: un Workspace JSON completo)
GET    /api/workspaces/:id/snapshot                    Workspace JSON completo
PUT    /api/workspaces/:id/snapshot                    reemplazar todo el contenido
POST   /api/workspaces/:id/commands {commands, label?} aplicar un lote atómico → {applied, inverse}
GET    /api/workspaces/:id/validate                    {diagnostics, summary}
GET    /api/workspaces/:id/views/:viewId/svg?theme=    SVG de una vista
GET    /api/workspaces/:id/snapshots                   instantáneas del historial
POST   /api/workspaces/:id/links {role, expiresAt?}    crear un enlace compartido (owner)
PUT    /api/workspaces/:id/members/:userId {role}      dar o cambiar el rol de un usuario (owner)
```

Los errores llegan siempre como `{"error": "…", "issues"?: [...]}`:

| Código | Qué significa |
|---|---|
| `400` | Petición o comando mal formado (`issues` dice qué campo) |
| `401` | Falta la clave o no es válida |
| `403` | No tienes permiso: por ejemplo, tu rol en ese espacio es `viewer` |
| `404` | El espacio o la vista no existen |
| `413` | Cuerpo demasiado grande (1 MB para comandos, 5 MB para un Workspace JSON completo) |
| `422` | Un comando del lote no se pudo aplicar (por ejemplo, `patch` sobre un id que no existe). **No se aplicó nada del lote** |
| `429` | Demasiados intentos (inicio de sesión, registro) |

### Ejemplo: crear un proceso BPMN con curl {#ejemplo-curl}

Este ejemplo crea un espacio, dibuja un proceso de tres pasos, lo valida y descarga la imagen. Necesita
`curl` y `jq`.

```bash
export ALLDRAW_URL=https://alldraw.bezenti.com
export ALLDRAW_API_KEY=adk_...            # la de la pantalla de claves API

# 1. Crear el espacio
WS=$(curl -s -X POST "$ALLDRAW_URL/api/workspaces" \
  -H "Authorization: Bearer $ALLDRAW_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"Alta de cliente (API)"}' | jq -r .id)

# 2. Enviar un lote de comandos (atómico)
curl -s -X POST "$ALLDRAW_URL/api/workspaces/$WS/commands" \
  -H "Authorization: Bearer $ALLDRAW_API_KEY" -H 'content-type: application/json' \
  -d '{
  "label": "proceso de alta",
  "commands": [
    { "type": "set", "collection": "views", "id": "vw_bpmn",
      "value": { "id": "vw_bpmn", "kind": "freeform", "notationId": "bpmn", "viewpointId": "process", "name": "Alta de cliente" } },
    { "type": "addElementToView",
      "element": { "id": "el_start", "typeId": "bpmn:StartEvent", "name": "Solicitud recibida" },
      "node": { "id": "vn_start", "viewId": "vw_bpmn", "x": 40, "y": 100, "w": 40, "h": 40 } },
    { "type": "addElementToView",
      "element": { "id": "el_verificar", "typeId": "bpmn:Task", "name": "Verificar identidad", "fields": { "taskType": "service" } },
      "node": { "id": "vn_verificar", "viewId": "vw_bpmn", "x": 140, "y": 90, "w": 160, "h": 60 } },
    { "type": "addElementToView",
      "element": { "id": "el_end", "typeId": "bpmn:EndEvent", "name": "Cliente activo" },
      "node": { "id": "vn_end", "viewId": "vw_bpmn", "x": 360, "y": 100, "w": 40, "h": 40 } },
    { "type": "connect",
      "relation": { "id": "rel_1", "typeId": "bpmn:SequenceFlow", "from": { "elementId": "el_start" }, "to": { "elementId": "el_verificar" } },
      "edge": { "id": "ve_1", "viewId": "vw_bpmn", "fromNodeId": "vn_start", "toNodeId": "vn_verificar" } },
    { "type": "connect",
      "relation": { "id": "rel_2", "typeId": "bpmn:SequenceFlow", "from": { "elementId": "el_verificar" }, "to": { "elementId": "el_end" } },
      "edge": { "id": "ve_2", "viewId": "vw_bpmn", "fromNodeId": "vn_verificar", "toNodeId": "vn_end" } },
    { "type": "meta", "patch": { "currentViewId": "vw_bpmn" } }
  ]}'
# → {"applied": 7, "inverse": {...}}   guarda "inverse" si quieres poder revertir el lote

# 3. Validar y obtener la imagen
curl -s "$ALLDRAW_URL/api/workspaces/$WS/validate" -H "Authorization: Bearer $ALLDRAW_API_KEY" | jq .summary
curl -s "$ALLDRAW_URL/api/workspaces/$WS/views/vw_bpmn/svg" -H "Authorization: Bearer $ALLDRAW_API_KEY" > alta.svg
```

Abre `https://alldraw.bezenti.com/#/s/<id>` en el navegador: la vista ya está ahí y, si la tenías
abierta, la has visto aparecer nodo a nodo.

> [!TIP]
> Los ids los eliges tú. Usa prefijos legibles (`el_` elementos, `rel_` relaciones, `vw_` vistas, `vn_`
> nodos, `ve_` aristas): luego te servirán para corregir y trazar.

## Comandos {#comandos}

| Comando | Para qué |
|---|---|
| `set` (`collection`, `id`, `value`) | Crear o reemplazar un registro entero de `views`, `elements`, `relations`, `nodes`, `edges`, `dimensions`, `libraries`, `people` o `rules` |
| `patch` (`collection`, `id`, `patch`) | Cambiar algunos campos de un registro existente (falla si no existe) |
| `delete` (`collection`, `id`) | Borrar un registro sin limpiar referencias (mejor los `delete…` de abajo) |
| `addElementToView` (`element`, `node`) | Un elemento nuevo **y** su nodo en una vista. Con `parentNodeId` se anida; las coordenadas son entonces relativas al padre |
| `connect` (`relation`, `edge`) | Una relación nueva **y** su arista en una vista |
| `moveNodes` (`moves`) | Mover o cambiar de padre varios nodos |
| `deleteElement` / `deleteNode` / `deleteRelation` / `deleteView` | Borrar limpiando lo que dependa (un `deleteNode` quita la aparición; el elemento sigue en el modelo) |
| `meta` (`patch`) | Nombre, descripción y vista actual (`currentViewId`) del espacio |
| `batch` (`commands`) | Agrupar comandos (la API ya envuelve tu lista en uno) |

Lo mínimo para un elemento es `{id, typeId, name}`; para una vista, `{id, kind, notationId, name}`. El
resto de campos se rellenan solos. Para enlazar notaciones usa las
[relaciones puente](notaciones.md#relaciones-puente) (`core:trace`, `core:realizes`…); para el
drill-down, un `patch` en el nodo con `detailViewId`. La guía `SKILL.md` (más abajo) lo detalla.

## MCP: conectar un asistente de IA {#mcp}

**MCP** (*Model Context Protocol*) es un estándar abierto para que los asistentes de IA, como Claude,
usen herramientas externas. En vez de escribir peticiones HTTP, le das al asistente un pequeño
programa —el *servidor MCP*— que le ofrece acciones con nombre ("listar espacios", "aplicar comandos").
El asistente decide cuándo usarlas y tú ves cada llamada. Con el servidor MCP de all-draw puedes pedir
en lenguaje natural "dibújame en BPMN el proceso de alta de cliente" y verlo aparecer en el navegador.

El servidor MCP de all-draw funciona por **stdio** (el asistente lo arranca como un programa local) y
habla con la API REST usando tu clave, así que corre en tu máquina y puede apuntar a cualquier servidor
de all-draw (el público, el tuyo o uno en Cloudflare).

**Herramientas que ofrece:**

| Herramienta | Qué hace |
|---|---|
| `list_workspaces` | Lista los espacios a los que tiene acceso la clave, con tu rol en cada uno |
| `get_snapshot` | Lee un espacio completo (Workspace JSON) |
| `run_commands` | Aplica una lista de comandos (necesita rol `editor`); devuelve el comando inverso |
| `validate` | Devuelve los diagnósticos del modelo con los arreglos propuestos |
| `list_notations` | Lista las notaciones con sus tipos de elemento y relación (todas, o solo `packId`) |
| `render_svg` | Devuelve el SVG de una vista |

**Requisitos** en la máquina donde corre el asistente: Node 22.13 o superior, pnpm y una copia del
repositorio con las dependencias instaladas:

```bash
git clone https://github.com/darwinva97/all-draw && cd all-draw
pnpm install
```

**Probarlo a mano** (se queda esperando órdenes por la entrada estándar; sal con Ctrl+C):

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
```

**Claude Desktop**: añade esto a su fichero de configuración (`claude_desktop_config.json`), cambiando la
ruta del repositorio y la clave:

```json
{
  "mcpServers": {
    "all-draw": {
      "command": "pnpm",
      "args": ["--dir", "/ruta/a/all-draw", "--filter", "@all-draw/server", "mcp"],
      "env": {
        "ALLDRAW_URL": "https://alldraw.bezenti.com",
        "ALLDRAW_API_KEY": "adk_…"
      }
    }
  }
}
```

**Claude Code**: el mismo bloque vale en un fichero `.mcp.json` en la raíz de tu proyecto, o regístralo
con un comando:

```bash
claude mcp add all-draw \
  -e ALLDRAW_URL=https://alldraw.bezenti.com -e ALLDRAW_API_KEY=adk_… \
  -- pnpm --dir /ruta/a/all-draw --filter @all-draw/server mcp
```

Otros clientes MCP (Cursor, VS Code, etc.) usan el mismo esquema: comando `pnpm`, esos argumentos y las
dos variables de entorno.

> [!NOTE]
> Si falta `ALLDRAW_API_KEY`, el servidor arranca igual pero todas las llamadas fallan con `401`. Si
> falta `ALLDRAW_URL`, usa `http://127.0.0.1:4002` (un servidor local).

## SKILL.md: la guía para agentes {#skill}

[`apps/server/SKILL.md`](https://github.com/darwinva97/all-draw/blob/main/apps/server/SKILL.md) es una
guía escrita para que un agente de IA sepa modelar en all-draw sin explicárselo cada vez. Incluye:

- el flujo recomendado (`notations` → `snapshot` → `commands` en un solo lote → `validate` → `svg`);
- la tabla de comandos con sus campos;
- las convenciones de ids, cómo anidar, las relaciones puente entre notaciones, el drill-down y las
  dimensiones;
- los errores habituales y cómo corregirlos.

La acompaña un ejemplo completo,
[`apps/server/examples/bpmn-archimate-trazas.json`](https://github.com/darwinva97/all-draw/blob/main/apps/server/examples/bpmn-archimate-trazas.json):
un lote que crea un proceso en BPMN y en ArchiMate y los enlaza con trazas.

Para usarla, copia `SKILL.md` a la carpeta de skills de tu agente (en Claude Code,
`.claude/skills/all-draw/SKILL.md` dentro de tu proyecto o `~/.claude/skills/all-draw/SKILL.md` para
todos) o pégala en las instrucciones del asistente. Junto con el servidor MCP, el agente tiene todo lo
necesario para modelar.

## Referencia de endpoints {#endpoints}

La lista siguiente se lee en directo del servidor (`/api/openapi.json`), así que siempre está al día con
la versión instalada:

<!-- docs:api-ref -->

## Instalar tu propio servidor {#autoalojar}

all-draw se instala como **un solo proceso Node** que sirve la aplicación web, la API REST y la
sincronización en tiempo real, y guarda todo en un fichero SQLite. No necesita base de datos externa
ni Redis (aunque puede usar Postgres). También puede desplegarse en Cloudflare Workers (ver al final).

### Requisitos {#requisitos}

- **Node 22.13 o superior** (usa el SQLite que trae Node).
- **pnpm** (`corepack enable` lo activa) y **git**.
- Un dominio y un proxy inverso con HTTPS (Caddy, nginx…) si lo vas a publicar.

### Compilar y arrancar {#compilar}

```bash
git clone https://github.com/darwinva97/all-draw && cd all-draw
pnpm install
pnpm --filter web build          # compila la aplicación en apps/web/dist
pnpm start                       # = node apps/server/src/server.mjs → http://127.0.0.1:4002
```

Comprueba que responde: `curl http://127.0.0.1:4002/healthz` devuelve `ok`. El **primer usuario** que
se registra es administrador.

### Variables de entorno {#variables}

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` / `HOST` | `4002` / `127.0.0.1` | Dónde escucha. Déjalo en `127.0.0.1` y pon un proxy delante |
| `DATA_DIR` | `~/.alldraw-data` | Carpeta de datos |
| `DB_PATH` | `$DATA_DIR/alldraw.sqlite` | Fichero SQLite |
| `DATABASE_URL` | *(vacío)* | Si la defines (`postgres://usuario:clave@host:5432/bd`), usa Postgres en vez de SQLite |
| `STATIC_DIR` | `apps/web/dist` | Carpeta de la aplicación compilada |
| `SESSION_SECRET` | *(vacío)* | **Recomendado.** Las sesiones y claves se guardan como un hash que depende de este secreto, así una copia de la base de datos no sirve para suplantar a nadie. Cambiarlo cierra todas las sesiones y anula todas las claves API |
| `ALLOW_REGISTRATION` | `true` | `false` cierra el registro. Con el registro cerrado ni siquiera se puede crear el primer usuario, salvo con `INVITE_CODE` |
| `INVITE_CODE` | *(vacío)* | Si lo defines, registrarse exige este código |
| `COOKIE_SECURE` | `false` | Fuerza la cookie `Secure`. Detrás de un proxy HTTPS que envíe `x-forwarded-proto` no hace falta |
| `PUBLIC_URL` | *(de la petición)* | URL pública para construir los enlaces compartidos, si el proxy no la transmite bien |

### Servicio systemd {#systemd}

Para que arranque solo y se reinicie si falla, crea una unidad de usuario (no hace falta ser root) en
`~/.config/systemd/user/alldraw.service`:

```ini
[Unit]
Description=all-draw
After=network.target

[Service]
WorkingDirectory=/home/<usuario>/all-draw/apps/server
Environment=PORT=4002 HOST=127.0.0.1 DATA_DIR=/home/<usuario>/.alldraw-data
Environment=SESSION_SECRET=cambia-esto PUBLIC_URL=https://alldraw.ejemplo.com
ExecStart=/usr/bin/env node src/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now alldraw
loginctl enable-linger $USER        # que siga corriendo sin sesión abierta
journalctl --user -u alldraw -f     # ver el registro
```

Para actualizar: `git pull && pnpm install && pnpm deploy` (compila la aplicación y reinicia el
servicio).

### Proxy inverso con Caddy {#caddy}

```
alldraw.ejemplo.com {
    reverse_proxy 127.0.0.1:4002
}
```

Caddy obtiene el certificado y pasa el WebSocket de sincronización (`/ws/<id>`) sin configuración
extra. Con nginx, añade en la `location /ws/` las cabeceras `Upgrade` y `Connection "upgrade"`, y
`X-Forwarded-Proto https` para que la cookie sea `Secure`.

### Copias de seguridad {#copias}

```bash
pnpm --filter @all-draw/server backup
```

Deja en `~/.alldraw-backups/<fecha>/` una copia consistente de la base de datos (comprimida) y un JSON
por espacio, sin parar el servidor. Borra las copias de más de 30 días (`KEEP_DAYS`; `BACKUP_DIR` cambia
la carpeta). Prográmalo con cron, por ejemplo cada noche:

```
17 3 * * * cd /home/<usuario>/all-draw/apps/server && node scripts/backup.mjs >> ~/.alldraw-backups/backup.log 2>&1
```

Para recuperar un espacio, `apps/server/scripts/restore.mjs` sube uno de esos JSON a un servidor en
marcha (como espacio nuevo, o sobre uno existente con `--into ws_…`) usando `ALLDRAW_URL` y
`ALLDRAW_API_KEY`. `apps/server/scripts/healthcheck.mjs` sirve de vigilante: puesto en cron cada pocos
minutos, reinicia el servicio si `/healthz` falla tres veces seguidas.

Sin acceso al servidor, cualquier usuario puede guardar un espacio desde **Importar / Exportar → JSON de
all-draw** o desde el [historial](historial.md).

### Cloudflare Workers {#cloudflare}

all-draw también funciona en **Cloudflare Workers**, con la misma API: cada espacio vive en un Durable
Object y las cuentas en otro (o en D1, opcional). Cabe en el plan gratuito. A grandes rasgos:

```bash
pnpm --filter web build
cd apps/worker
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

Las variables (`ALLOW_REGISTRATION`, `PUBLIC_URL`, `INVITE_CODE`) van en `wrangler.toml` o en el panel de
Cloudflare. Para pasar los datos de un servidor Node existente hay un script de migración
(`apps/worker/scripts/migrate-from-sqlite.mjs`). Todos los pasos, opciones y límites están en el
[README del worker](https://github.com/darwinva97/all-draw/blob/main/apps/worker/README.md).
