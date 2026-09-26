# 8. Agentes y API

Todo lo que hace el editor son **comandos** serializables (`addElementToView`, `connect`,
`moveNodes`, `patch`…). La API REST y el servidor MCP emiten esos mismos comandos sobre el mismo
documento, así que lo que hace un agente aparece al instante en el navegador de quien tenga el
espacio abierto, y se puede deshacer.

## Claves API

Inicio → **claves API** (`#/keys`), con sesión iniciada:

![Pantalla de claves API tras crear una clave](img/12-claves-api.png)

1. Escribe un nombre (por ejemplo `agente-claude`) y pulsa **Crear**.
2. Copia la clave `adk_…` **en ese momento**: no se vuelve a mostrar. La lista guarda solo el
   prefijo, la fecha de creación y el último uso.
3. **Revocar** la invalida al instante.

La clave tiene exactamente tus permisos: en cada espacio, el rol que tengas (`owner`, `editor`,
`viewer`). Se envía como `Authorization: Bearer adk_…`. Un enlace compartido `lnk_…` también vale
como bearer, limitado a su espacio y su rol.

Guarda las claves en variables de entorno o en un vault; nunca en el código ni en el chat.

## API REST y OpenAPI

Base: `https://alldraw.bezenti.com` (o tu servidor). Documento completo en
`GET /api/openapi.json` (OpenAPI 3.1; cualquier cliente o UI de Swagger lo lee). Resumen:

```
GET    /api/notations                                 packs y tipos (público)
GET    /api/auth/me                                   quién soy y cómo (session | apikey)
GET    /api/workspaces                                mis espacios con mi rol
POST   /api/workspaces {name?, initial?}              crear (initial: Workspace JSON)
GET    /api/workspaces/:id/snapshot                   Workspace JSON completo
PUT    /api/workspaces/:id/snapshot                   reemplazar todo el contenido
POST   /api/workspaces/:id/commands {commands, label?} aplicar un lote atómico → {applied, inverse}
GET    /api/workspaces/:id/validate                   {diagnostics, summary}
GET    /api/workspaces/:id/views/:viewId/svg?theme=   SVG de una vista
POST   /api/workspaces/:id/links {role, expiresAt?}   enlace compartido (owner)
PUT    /api/workspaces/:id/members/:userId {role}     miembros (owner)
```

Errores siempre como `{"error": "…", "issues"?: [...]}`: `400` comando mal formado, `403` sin
permiso (rol `viewer`), `422` lote no aplicable (por ejemplo `patch` sobre un id inexistente;
**no se aplica nada** del lote), `429` demasiados intentos de login.

### Ejemplo: crear un proceso BPMN con curl

```bash
export ALLDRAW_URL=https://alldraw.bezenti.com
export ALLDRAW_API_KEY=adk_...            # de la pantalla de claves API

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

### Comandos

| Comando | Para qué |
|---|---|
| `set` / `patch` / `delete` (`collection`, `id`) | Crear o reemplazar, fusionar campos, borrar un registro de `views`, `elements`, `relations`, `nodes`, `edges`, `dimensions`, `libraries`, `people`, `rules` |
| `addElementToView` | Elemento nuevo **y** su nodo en una vista (`parentNodeId` para anidar; coordenadas relativas al padre) |
| `connect` | Relación nueva **y** su arista en una vista |
| `moveNodes` | Mover o reanidar nodos |
| `deleteElement` / `deleteNode` / `deleteRelation` / `deleteView` | Borrado con limpieza de referencias |
| `meta` | Nombre, descripción, `currentViewId` |
| `batch` | Agrupar (la API ya envuelve tu lista en uno) |

Los diagnósticos de `validate` traen `supportedFixes` con comandos listos para reenviar.

## MCP

El servidor MCP (stdio) habla con la API REST, así que puede correr en la máquina del agente:

```bash
ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… pnpm --filter @all-draw/server mcp
```

Herramientas: `list_workspaces`, `get_snapshot`, `run_commands`, `validate`, `list_notations`,
`render_svg`. Configuración típica en un cliente MCP:

```json
{ "mcpServers": { "all-draw": {
    "command": "pnpm", "args": ["--filter", "@all-draw/server", "mcp"],
    "cwd": "/ruta/a/all-draw",
    "env": { "ALLDRAW_URL": "https://alldraw.bezenti.com", "ALLDRAW_API_KEY": "adk_…" } } } }
```

## SKILL.md

`apps/server/SKILL.md` es la guía para agentes: flujo recomendado (`notations` → `snapshot` →
`commands` en un solo lote → `validate` → `svg`), la tabla de comandos, convenciones de ids,
anidamiento, relaciones puente entre notaciones, drill-down y dimensiones, y los errores
habituales. Va acompañado de `apps/server/examples/bpmn-archimate-trazas.json`, un lote completo
que crea un proceso en BPMN y ArchiMate con trazas entre ambos. Copia el `SKILL.md` a la carpeta de
skills de tu agente (o apúntalo desde su configuración) y tendrá lo necesario para modelar.
