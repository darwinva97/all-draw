# Agents and API

Everything you do in the editor (adding an element, connecting, moving, renaming) is stored as a
**command**: a small, serializable instruction such as `addElementToView` or `connect`. The REST API and
the MCP server send those very same commands to the same document. That is why whatever a script or an
AI assistant does shows up **instantly** in the browser of anyone who has the workspace open, and can be
undone like any other change.

This chapter is for anyone who wants to automate all-draw: scripts, integrations or AI agents. At the end
it also explains how to install your own server.

## API keys {#claves}

For a program to act on your behalf it needs an **API key**. You create it from the app, while signed in:

![API keys screen after creating a key](../img/12-claves-api-en.png)

1. Click your name (top right) and, in the menu, **Account and API keys**. The **Account** screen opens
   (`#/keys`).
2. Under **API keys**, type a name that tells you what it is for (for example `claude-agent`) and click
   **Create**.
3. Copy the `adk_…` key **right away**: it is never shown again. The list only keeps the name, the prefix,
   the creation date and the date it was last used.
4. When you no longer need it, or if you think someone has seen it, click **Revoke**: it stops working
   immediately.

What a key can do:

- It has **exactly your permissions**: in each workspace, the role you have: **owner** (`owner`), **can
  edit** (`editor`) or **read-only** (`viewer`). Changing a workspace requires `editor` or `owner`.
- It is sent in the header `Authorization: Bearer adk_…`.
- Keys can only be created from a browser session; a key cannot create other keys.
- A key cannot **close sessions** or **change the password** either: that is only possible with a signed-in
  browser session. The other way round does work: **Change password** and **Sign out everywhere** (and a reset by
  an administrator) also revoke your keys if you leave the **Also revoke API keys** checkbox ticked, which it is
  by default. See [what happens when sessions are closed](compartir-y-colaborar.md#cerrar-sesiones).
- A **shared link** (`lnk_…`, see [Sharing and collaborating](compartir-y-colaborar.md)) also works as a
  `Bearer`, but limited to its workspace and its role.

> [!WARNING]
> Treat the key like a password. Keep it in an environment variable or a secrets manager; never in code,
> in a repository or in a chat.

## REST API {#rest}

The API lives on the same server as the app, under `/api`. On the public server the base is
`https://alldraw.bezenti.com`; if you run your own, your installation's URL. The full OpenAPI 3.1 document
is at [/api/openapi.json](/api/openapi.json): any OpenAPI client (Swagger UI, Postman, Insomnia, code
generators) can read it.

The usual flow has five steps:

1. **Learn the types**: `GET /api/notations` returns each notation with the exact identifiers of its types
   (`bpmn:Task`, `archimate:ApplicationComponent`…) and their fields. No key needed.
2. **Read the workspace**: `GET /api/workspaces/:id/snapshot` returns the whole workspace as JSON
   (elements, relations, views, nodes…). That way you reuse what already exists instead of duplicating it.
3. **Change it**: `POST /api/workspaces/:id/commands` with a list of commands. The batch is **atomic**:
   either all of it is applied or nothing is.
4. **Check it**: `GET /api/workspaces/:id/validate` returns the same diagnostics as the problems panel,
   each with proposed fixes (`supportedFixes`) ready to send back as commands.
5. **See it**: `GET /api/workspaces/:id/views/:viewId/svg?theme=light|dark|dual` returns the view as an
   SVG image.

Summary of the most used routes:

```
GET    /api/notations                                  notations and types (public)
GET    /api/auth/me                                    who am I and how (session | apikey)
GET    /api/workspaces                                 my workspaces, with my role in each
POST   /api/workspaces {name?, initial?}               create (initial: a complete Workspace JSON)
GET    /api/workspaces/:id/snapshot                    complete Workspace JSON
PUT    /api/workspaces/:id/snapshot                    replace all the content
POST   /api/workspaces/:id/commands {commands, label?} apply an atomic batch → {applied, inverse}
GET    /api/workspaces/:id/validate                    {diagnostics, summary}
GET    /api/workspaces/:id/views/:viewId/svg?theme=    SVG of a view
GET    /api/workspaces/:id/snapshots                   history snapshots
POST   /api/workspaces/:id/links {role, expiresAt?}    create a shared link (owner)
PUT    /api/workspaces/:id/members/:userId {role}      give or change a user's role (owner)
```

Errors always come as `{"error": "…", "issues"?: [...]}`:

| Code | Meaning |
|---|---|
| `400` | Malformed request or command (`issues` tells you which field) |
| `401` | The key is missing or invalid |
| `403` | You don't have permission: for example, your role in that workspace is **read-only** (`viewer`) |
| `404` | The workspace or view doesn't exist |
| `413` | Body too large (1 MB for commands, 5 MB for a complete Workspace JSON) |
| `422` | A command in the batch could not be applied (for example, `patch` on an id that doesn't exist). **Nothing in the batch was applied** |
| `429` | Too many attempts (sign-in, registration) |

### Example: create a BPMN process with curl {#ejemplo-curl}

This example creates a workspace, draws a three-step process, validates it and downloads the image. It
needs `curl` and `jq`.

```bash
export ALLDRAW_URL=https://alldraw.bezenti.com
export ALLDRAW_API_KEY=adk_...            # from the API keys screen

# 1. Create the workspace
WS=$(curl -s -X POST "$ALLDRAW_URL/api/workspaces" \
  -H "Authorization: Bearer $ALLDRAW_API_KEY" -H 'content-type: application/json' \
  -d '{"name":"Customer onboarding (API)"}' | jq -r .id)

# 2. Send a batch of commands (atomic)
curl -s -X POST "$ALLDRAW_URL/api/workspaces/$WS/commands" \
  -H "Authorization: Bearer $ALLDRAW_API_KEY" -H 'content-type: application/json' \
  -d '{
  "label": "onboarding process",
  "commands": [
    { "type": "set", "collection": "views", "id": "vw_bpmn",
      "value": { "id": "vw_bpmn", "kind": "freeform", "notationId": "bpmn", "viewpointId": "process", "name": "Customer onboarding" } },
    { "type": "addElementToView",
      "element": { "id": "el_start", "typeId": "bpmn:StartEvent", "name": "Application received" },
      "node": { "id": "vn_start", "viewId": "vw_bpmn", "x": 40, "y": 100, "w": 40, "h": 40 } },
    { "type": "addElementToView",
      "element": { "id": "el_verify", "typeId": "bpmn:Task", "name": "Verify identity", "fields": { "taskType": "service" } },
      "node": { "id": "vn_verify", "viewId": "vw_bpmn", "x": 140, "y": 90, "w": 160, "h": 60 } },
    { "type": "addElementToView",
      "element": { "id": "el_end", "typeId": "bpmn:EndEvent", "name": "Customer active" },
      "node": { "id": "vn_end", "viewId": "vw_bpmn", "x": 360, "y": 100, "w": 40, "h": 40 } },
    { "type": "connect",
      "relation": { "id": "rel_1", "typeId": "bpmn:SequenceFlow", "from": { "elementId": "el_start" }, "to": { "elementId": "el_verify" } },
      "edge": { "id": "ve_1", "viewId": "vw_bpmn", "fromNodeId": "vn_start", "toNodeId": "vn_verify" } },
    { "type": "connect",
      "relation": { "id": "rel_2", "typeId": "bpmn:SequenceFlow", "from": { "elementId": "el_verify" }, "to": { "elementId": "el_end" } },
      "edge": { "id": "ve_2", "viewId": "vw_bpmn", "fromNodeId": "vn_verify", "toNodeId": "vn_end" } },
    { "type": "meta", "patch": { "currentViewId": "vw_bpmn" } }
  ]}'
# → {"applied": 7, "inverse": {...}}   keep "inverse" if you want to be able to revert the batch

# 3. Validate and get the image
curl -s "$ALLDRAW_URL/api/workspaces/$WS/validate" -H "Authorization: Bearer $ALLDRAW_API_KEY" | jq .summary
curl -s "$ALLDRAW_URL/api/workspaces/$WS/views/vw_bpmn/svg" -H "Authorization: Bearer $ALLDRAW_API_KEY" > onboarding.svg
```

Open `https://alldraw.bezenti.com/#/s/<id>` in the browser: the view is already there and, if you had it
open, you saw it appear node by node.

> [!TIP]
> You choose the ids. Use readable prefixes (`el_` elements, `rel_` relations, `vw_` views, `vn_` nodes,
> `ve_` edges): they will come in handy later for fixing and tracing.

## Commands {#comandos}

| Command | What for |
|---|---|
| `set` (`collection`, `id`, `value`) | Create or replace a whole record in `views`, `elements`, `relations`, `nodes`, `edges`, `dimensions`, `libraries`, `people` or `rules` |
| `patch` (`collection`, `id`, `patch`) | Change some fields of an existing record (fails if it doesn't exist) |
| `delete` (`collection`, `id`) | Delete a record without cleaning up references (prefer the `delete…` commands below) |
| `addElementToView` (`element`, `node`) | A new element **and** its node in a view. With `parentNodeId` it is nested; coordinates are then relative to the parent |
| `connect` (`relation`, `edge`) | A new relation **and** its edge in a view |
| `moveNodes` (`moves`) | Move or re-parent several nodes |
| `deleteElement` / `deleteNode` / `deleteRelation` / `deleteView` | Delete, cleaning up whatever depends on it (`deleteNode` removes the occurrence; the element stays in the model) |
| `meta` (`patch`) | The workspace's name, description and current view (`currentViewId`) |
| `batch` (`commands`) | Group commands (the API already wraps your list in one) |

The minimum for an element is `{id, typeId, name}`; for a view, `{id, kind, notationId, name}`. The rest
of the fields are filled in automatically. To link notations use the
[bridge relations](notaciones.md#relaciones-puente) (`core:trace`, `core:realizes`…); for drill-down, a
`patch` on the node with `detailViewId`. The `SKILL.md` guide (below) covers this in detail.

## MCP: connecting an AI assistant {#mcp}

**MCP** (*Model Context Protocol*) is an open standard that lets AI assistants such as Claude use
external tools. Instead of writing HTTP requests, you give the assistant a small program —the *MCP
server*— that offers it named actions ("list workspaces", "apply commands"). The assistant decides when
to use them and you see every call. With the all-draw MCP server you can ask in plain language "draw the
customer onboarding process in BPMN" and watch it appear in the browser.

There are two ways to connect it, with the same tools:

- **Remote over HTTP** (the easiest): the assistant connects to `https://<your-server>/mcp` with one of your
  API keys. Nothing to install. See [Remote MCP over HTTP](#mcp-remoto).
- **Local over stdio**: the assistant starts a small program on your machine that talks to the REST API with
  your key; it can point at any all-draw server (the public one, your own or one on Cloudflare).

**Tools it offers:**

| Tool | What it does |
|---|---|
| `list_workspaces` | Lists the workspaces the key can access, with your role in each |
| `get_snapshot` | Reads a whole workspace (Workspace JSON) |
| `run_commands` | Applies a list of commands (needs the `editor` role); returns the inverse command |
| `validate` | Returns the model's diagnostics with proposed fixes |
| `list_notations` | Lists the notations with their element and relation types (all of them, or just `packId`) |
| `list_views` | Lists the views of a workspace (id, name, notation and number of nodes) without reading all of it |
| `render_svg` | Returns the SVG of a view (light, dark or `dual` theme) |

**Resources** (for clients that show them as "attachments"): `alldraw://workspaces` (your workspaces),
`alldraw://workspaces/{id}/snapshot` (the Workspace JSON of each one) and
`alldraw://workspaces/{id}/views/{viewId}.svg` (the SVG of a view).

### Remote MCP over HTTP {#mcp-remoto}

The main server publishes MCP at **`POST /mcp`** (the standard *Streamable HTTP* transport, without
sessions). Access is **only with an API key** (`Authorization: Bearer adk_…`): neither the browser session
nor a shared link work. Every tool calls the API with that key, so the assistant can't do anything you
can't do. In **Account → API keys → Remote MCP** you have this block already filled in with your server's
address (and with the key you just created, if you just created one).

**Claude Code, Cursor and other clients** with HTTP transport: add this to their MCP configuration (in Claude
Code, `.mcp.json` at the project root; in Cursor, `~/.cursor/mcp.json`; in VS Code, `.vscode/mcp.json` with the
`servers` key instead of `mcpServers`):

```json
{
  "mcpServers": {
    "all-draw": {
      "type": "http",
      "url": "https://alldraw.bezenti.com/mcp",
      "headers": { "Authorization": "Bearer adk_…" }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add --transport http all-draw https://alldraw.bezenti.com/mcp \
  --header "Authorization: Bearer adk_…"
```

**Claude Desktop** (and any client that only starts local programs): its `claude_desktop_config.json` does not
accept HTTP servers with headers, so use the `mcp-remote` bridge (needs Node on that machine):

```json
{
  "mcpServers": {
    "all-draw": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://alldraw.bezenti.com/mcp", "--header", "Authorization:${ALLDRAW_AUTH}"],
      "env": { "ALLDRAW_AUTH": "Bearer adk_…" }
    }
  }
}
```

> [!NOTE]
> Remote MCP only exists on the **main server** (Node). The backup copy on Cloudflare Workers does not
> publish it: it is read-only and the MCP SDK would add dependencies the worker doesn't need. You can still
> use the stdio MCP pointing at it from any machine.

### Local MCP over stdio {#mcp-stdio}

**Requirements** on the machine where the assistant runs: Node 22.13 or later, pnpm and a copy of the
repository with its dependencies installed:

```bash
git clone https://github.com/darwinva97/all-draw && cd all-draw
pnpm install
```

**Try it by hand** (it waits for input on stdin; exit with Ctrl+C):

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
```

**Claude Desktop**: add this to its configuration file (`claude_desktop_config.json`), changing the
repository path and the key:

```json
{
  "mcpServers": {
    "all-draw": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/all-draw", "--filter", "@all-draw/server", "mcp"],
      "env": {
        "ALLDRAW_URL": "https://alldraw.bezenti.com",
        "ALLDRAW_API_KEY": "adk_…"
      }
    }
  }
}
```

**Claude Code**: the same block works in a `.mcp.json` file at the root of your project, or register it
with a command:

```bash
claude mcp add all-draw \
  -e ALLDRAW_URL=https://alldraw.bezenti.com -e ALLDRAW_API_KEY=adk_… \
  -- pnpm --dir /path/to/all-draw --filter @all-draw/server mcp
```

Other MCP clients (Cursor, VS Code, etc.) use the same scheme: the `pnpm` command, those arguments and the
two environment variables.

> [!NOTE]
> If `ALLDRAW_API_KEY` is missing, the server still starts but every call fails with `401`. If
> `ALLDRAW_URL` is missing, it uses `http://127.0.0.1:4002` (a local server).

## Webhooks {#webhooks}

A **webhook** notifies another application when something happens in a workspace: all-draw sends a `POST`
request to the URL you register. Use it to receive changes in **Slack**, **Microsoft Teams** or
**Discord**, or to trigger your own process (regenerate documentation, open a ticket…).

They are configured in **Share → Webhooks** (only the workspace owner) or through the API:
`GET`/`POST /api/workspaces/{id}/webhooks`, `DELETE /api/workspaces/{id}/webhooks/{hid}` and
`POST /api/workspaces/{id}/webhooks/{hid}/test` ("Test"). Each workspace allows **10 webhooks**.

**Events** (you choose which):

| Event | When |
|---|---|
| `workspace.changed` | Content changes. They are **grouped**: a single notice goes out 30 s after the last change (at most 5 min after the first), with the elements, relations and views added, changed and deleted |
| `comment.created` | A new comment |
| `snapshot.created` | Someone saves a version by hand (automatic ones don't notify) |
| `snapshot.restored` | Someone restores a version |
| `member.added` | Someone is given access as a member (role changes don't notify) |

**Format.** If the URL belongs to Slack (`hooks.slack.com`), Teams (`*.webhook.office.com`, Power Automate
flows on `*.logic.azure.com`) or Discord (`discord.com/api/webhooks/…`), the body is a **readable message**
for that app (Slack: `text` + `blocks`; Teams: an *Adaptive Card*; Discord: an *embed*) with an "Open in
all-draw" button. For any other URL it is **JSON**:

```json
{
  "id": "dlv_…",
  "event": "workspace.changed",
  "sentAt": "2026-10-05T10:00:00.000Z",
  "workspace": { "id": "ws_…", "name": "Payments", "url": "https://alldraw.bezenti.com/#/s/ws_…" },
  "data": {
    "since": "…", "until": "…",
    "counts": { "elements": { "added": 1, "changed": 2, "deleted": 0 }, "relations": { … }, "views": { … } },
    "elements": { "added": [{ "id": "el_…", "name": "Charge" }], "changed": […], "deleted": [] },
    "relations": { … }, "views": { … }
  },
  "text": "Changes in “Payments”\nElements: 1 added (Charge); 2 changed (…)"
}
```

You can force the format when creating it (`format`: `json`, `slack`, `teams` or `discord`) and the language
of the messages (`lang`: `es` or `en`; by default, your account's).

**Signature.** When the webhook is created its secret (`whsec_…`) is shown **only once**. Every request
carries:

- `X-AllDraw-Signature: sha256=<hex>`: HMAC-SHA256 of the **exact body** with that secret;
- `X-AllDraw-Event`: the event (`ping` for "Test");
- `X-AllDraw-Delivery`: a unique id per delivery (the same across its retries: use it to drop duplicates).

To check it (Node):

```js
import crypto from 'node:crypto';
const expected = 'sha256=' + crypto.createHmac('sha256', process.env.ALLDRAW_WEBHOOK_SECRET).update(rawBody).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-alldraw-signature'] ?? ''));
```

**Deliveries and retries.** The response is awaited for 10 s at most. If it doesn't arrive, or it is a
`5xx`, `408` or `429`, it is retried up to **5 attempts** with exponential backoff (2, 4, 8 and 16 s); a `4xx`
is not retried and redirects are not followed. The tab shows the **last 20 deliveries** of each webhook with
their HTTP status, latency and attempts.

**Security.** Only `https://` URLs to **public addresses** are accepted: no `localhost`, no private or
link-local IPs (such as the cloud metadata one), and no names that resolve to them; the IP is checked again
when connecting. The read-only backup copy does not send webhooks. Details in
[`docs/07-seguridad.md`](https://github.com/darwinva97/all-draw/blob/main/docs/07-seguridad.md).

## SKILL.md: the guide for agents {#skill}

[`apps/server/SKILL.md`](https://github.com/darwinva97/all-draw/blob/main/apps/server/SKILL.md) is a guide
written so that an AI agent knows how to model in all-draw without being told every time. It includes:

- the recommended flow (`notations` → `snapshot` → `commands` in a single batch → `validate` → `svg`);
- the command table with their fields;
- id conventions, how to nest, the bridge relations between notations, drill-down and dimensions;
- common errors and how to fix them.

It comes with a complete example,
[`apps/server/examples/bpmn-archimate-trazas.json`](https://github.com/darwinva97/all-draw/blob/main/apps/server/examples/bpmn-archimate-trazas.json):
a batch that creates a process in BPMN and in ArchiMate and links them with traces.

To use it, copy `SKILL.md` to your agent's skills folder (in Claude Code,
`.claude/skills/all-draw/SKILL.md` inside your project, or `~/.claude/skills/all-draw/SKILL.md` for all
projects) or paste it into the assistant's instructions. Together with the MCP server, the agent has
everything it needs to model. The guide is written in Spanish; agents read it without trouble.

## Endpoint reference {#endpoints}

The following list is read live from the server (`/api/openapi.json`), so it always matches the installed
version:

<!-- docs:api-ref -->

## Install your own server {#autoalojar}

all-draw installs as **a single Node process** that serves the web app, the REST API and real-time sync,
and stores everything in a SQLite file. It needs no external database or Redis (although it can use
Postgres). It can also be deployed on Cloudflare Workers (see the end).

### Requirements {#requisitos}

- **Node 22.13 or later** (it uses Node's built-in SQLite).
- **pnpm** (`corepack enable` turns it on) and **git**.
- A domain and a reverse proxy with HTTPS (Caddy, nginx…) if you are going to publish it.

### Build and run {#compilar}

```bash
git clone https://github.com/darwinva97/all-draw && cd all-draw
pnpm install
pnpm --filter web build          # builds the app into apps/web/dist
pnpm start                       # = node apps/server/src/server.mjs → http://127.0.0.1:4002
```

Check it responds: `curl http://127.0.0.1:4002/healthz` returns `ok`. The **first user** to register is
an administrator.

### Environment variables {#variables}

| Variable | Default | What for |
|---|---|---|
| `PORT` / `HOST` | `4002` / `127.0.0.1` | Where it listens. Keep it on `127.0.0.1` and put a proxy in front |
| `DATA_DIR` | `~/.alldraw-data` | Data folder |
| `DB_PATH` | `$DATA_DIR/alldraw.sqlite` | SQLite file |
| `DATABASE_URL` | *(empty)* | If set (`postgres://user:password@host:5432/db`), Postgres is used instead of SQLite |
| `STATIC_DIR` | `apps/web/dist` | Folder of the built app |
| `SESSION_SECRET` | *(empty)* | **Recommended.** Sessions and keys are stored as a hash that depends on this secret, so a copy of the database can't be used to impersonate anyone. Changing it signs everyone out and invalidates every API key |
| `ALLOW_REGISTRATION` | `true` | `false` closes registration. With registration closed not even the first user can be created, unless `INVITE_CODE` is set |
| `INVITE_CODE` | *(empty)* | If set, registering requires this code |
| `COOKIE_SECURE` | `false` | Forces the `Secure` cookie. Not needed behind an HTTPS proxy that sends `x-forwarded-proto` |
| `PUBLIC_URL` | *(from the request)* | Public URL used to build shared links, embed links, the "Open in all-draw" buttons of webhooks and oEmbed. **Recommended** if you use webhooks: notices that come from an edit have no request to infer it from |
| `WEBHOOKS_ALLOW_PRIVATE` | *(empty)* | **Testing only, insecure.** `1` allows webhooks to `http:`, `localhost` and private IPs (used by `e2e/integrations.mjs`). In production it would let whoever creates a webhook make the server call internal services |
| `WEBHOOKS_DEBOUNCE_MS` / `WEBHOOKS_RETRY_BASE_MS` | `30000` / `2000` | Wait of `workspace.changed` and of the first retry. For testing |

### systemd service {#systemd}

To have it start on its own and restart if it fails, create a user unit (no root needed) in
`~/.config/systemd/user/alldraw.service`:

```ini
[Unit]
Description=all-draw
After=network.target

[Service]
WorkingDirectory=/home/<user>/all-draw/apps/server
Environment=PORT=4002 HOST=127.0.0.1 DATA_DIR=/home/<user>/.alldraw-data
Environment=SESSION_SECRET=change-me PUBLIC_URL=https://alldraw.example.com
ExecStart=/usr/bin/env node src/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now alldraw
loginctl enable-linger $USER        # keep it running without an open session
journalctl --user -u alldraw -f     # follow the log
```

To update: `git pull && pnpm install && pnpm deploy` (builds the app and restarts the service).

### Reverse proxy with Caddy {#caddy}

```
alldraw.example.com {
    reverse_proxy 127.0.0.1:4002
}
```

Caddy gets the certificate and passes the sync WebSocket (`/ws/<id>`) through with no extra
configuration. With nginx, add the `Upgrade` and `Connection "upgrade"` headers in the `location /ws/`
block, and `X-Forwarded-Proto https` so the cookie is `Secure`.

The security headers are set by the application: don't add `X-Frame-Options` or `frame-ancestors` in the
proxy, or the embed pages (`/embed/…`, the only ones that can be embedded in other sites) will stop showing
in Confluence, Notion or Jira.

### Backups {#copias}

```bash
pnpm --filter @all-draw/server backup
```

It writes to `~/.alldraw-backups/<date>/` a consistent (compressed) copy of the database and one JSON per
workspace, without stopping the server. It deletes copies older than 30 days (`KEEP_DAYS`; `BACKUP_DIR`
changes the folder). Schedule it with cron, for example every night:

```
17 3 * * * cd /home/<user>/all-draw/apps/server && node scripts/backup.mjs >> ~/.alldraw-backups/backup.log 2>&1
```

To recover a workspace, `apps/server/scripts/restore.mjs` uploads one of those JSON files to a running
server (as a new workspace, or over an existing one with `--into ws_…`) using `ALLDRAW_URL` and
`ALLDRAW_API_KEY`. `apps/server/scripts/healthcheck.mjs` acts as a watchdog: run from cron every few
minutes, it restarts the service if `/healthz` fails three times in a row.

Without server access, any user can save a workspace from **Import / Export → all-draw JSON** or from the
[history](historial.md).

### Cloudflare Workers {#cloudflare}

all-draw also runs on **Cloudflare Workers**, with the same API: each workspace lives in a Durable Object
and accounts in another one (or in D1, optionally). It fits in the free plan. Roughly:

```bash
pnpm --filter web build
cd apps/worker
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

Variables (`ALLOW_REGISTRATION`, `PUBLIC_URL`, `INVITE_CODE`) go in `wrangler.toml` or the Cloudflare
dashboard. To move the data of an existing Node server there is a migration script
(`apps/worker/scripts/migrate-from-sqlite.mjs`). All the steps, options and limits are in the
[worker README](https://github.com/darwinva97/all-draw/blob/main/apps/worker/README.md).
