---
name: all-draw
description: Modelar diagramas (BPMN, ArchiMate, C4, statecharts, libres) en un espacio de all-draw mediante comandos, por la API REST o el MCP. Úsalo cuando te pidan crear o modificar un modelo/diagrama en all-draw, validarlo o exportar una vista.
---

# Modelar en all-draw con comandos

all-draw es un diagramador donde **el modelo y las vistas están separados**: un `Element`
(semántica: "Alta de cliente", tipo `archimate:BusinessProcess`) existe una vez y puede aparecer
en varias `View` como `ViewNode` (posición y tamaño). Una `Relation` une elementos; un `ViewEdge`
la dibuja en una vista. Todo cambio es un **comando** serializable: el editor, la API y tú emitís
los mismos comandos, y todos los clientes conectados ven el resultado al instante.

## Acceso

- REST: `Authorization: Bearer $ALLDRAW_API_KEY` contra `$ALLDRAW_URL` (p. ej. `https://alldraw.bezenti.com`).
  Referencia completa en `GET /api/openapi.json`.
- MCP (stdio): `ALLDRAW_URL=… ALLDRAW_API_KEY=… pnpm --filter @all-draw/server mcp` expone
  `list_workspaces`, `get_snapshot`, `run_commands`, `validate`, `list_notations`, `render_svg`.
- La API key se crea desde la web (o `POST /api/keys` con sesión). Tu rol en cada espacio lo dice
  `GET /api/workspaces`; para escribir necesitas `editor` u `owner`.

## Flujo recomendado

1. `GET /api/notations` (o `list_notations`) para conocer los **ids exactos** de tipos: `bpmn:Task`,
   `archimate:ApplicationComponent`, `c4:Container`, `statechart:State`, `freeform:box`… y las
   relaciones de cada pack. Los ids son `pack:Tipo`; los inventados aparecen en `validate` como
   `unknown-element-type`.
2. `GET /api/workspaces/:id/snapshot` (o `get_snapshot`) antes de tocar nada: ids existentes, vistas,
   posiciones. No dupliques elementos que ya existen: reutilízalos en una vista nueva con un `ViewNode`.
3. Construye la lista de comandos y envíala **en una sola llamada** a `POST …/commands`
   (`run_commands`). Es atómica: si un comando falla (422), no se aplica ninguno. La respuesta trae
   `inverse`, un comando que deshace todo el lote (guárdalo si quieres poder revertir).
4. `GET …/validate` (`validate`). Corrige los `error` (relación inválida para esa notación,
   referencias rotas); los `warning`/`info` son sugerencias. Cada diagnóstico incluye
   `supportedFixes` con comandos listos para enviar.
5. `GET …/views/:viewId/svg` (`render_svg`) para comprobar visualmente o entregar la imagen.

## Comandos

| Comando | Para qué |
|---|---|
| `{type:'set', collection, id, value}` | Crear o reemplazar un registro entero (`views`, `elements`, `relations`, `nodes`, `edges`, `dimensions`, `libraries`, `people`, `rules`) |
| `{type:'patch', collection, id, patch}` | Cambiar campos (fusión profunda; `undefined`/omitir no borra, `null` sí lo pone a null). Falla si no existe |
| `{type:'delete', collection, id}` | Borrar un registro sin limpiar referencias (prefiere los de abajo) |
| `{type:'addElementToView', element, node}` | Elemento nuevo **y** su aparición en una vista (`node.viewId`, `x`, `y`, `w`, `h`, `parentNodeId?`) |
| `{type:'connect', relation, edge}` | Relación nueva entre elementos **y** su arista en una vista (`edge.fromNodeId`, `toNodeId`) |
| `{type:'moveNodes', moves:[{id,x,y,parentNodeId?}]}` | Mover/anidar nodos |
| `{type:'deleteElement', id}` | Borra el elemento, sus nodos, sus relaciones y aristas |
| `{type:'deleteNode', id}` | Quita la aparición (y descendientes/aristas); el elemento sigue en el modelo |
| `{type:'deleteRelation', id}` / `{type:'deleteView', id}` | Con limpieza de aristas/nodos |
| `{type:'meta', patch}` | Nombre, descripción, `currentViewId` del espacio |
| `{type:'batch', label?, commands}` | Agrupar (la API ya envuelve tu lista en un batch) |

Reglas prácticas:

- **Ids**: cadenas estables; usa prefijos legibles `el_`, `rel_`, `vw_`, `vn_`, `ve_`. Los ids que
  tú pones son los que después usarás para trazar y corregir.
- **Elemento mínimo**: `{id, typeId, name}`; el servidor rellena `doc`, `fields`, `ports`, `props`, `tags`…
  Los campos tipados del tipo (`fields`) los dice `GET /api/notations` (p. ej. `bpmn:Task` tiene `taskType`).
- **Vista mínima**: `{id, kind:'freeform', notationId:'bpmn', name}`. `notationId` decide qué paleta y
  matriz de validez manda en esa vista; `viewpointId` (p. ej. `process`, `collaboration`) restringe tipos.
- **Contenedores**: pools, lanes, subprocesos, nodos C4… un nodo hijo lleva `parentNodeId` y
  coordenadas **relativas al padre**.
- **Relaciones entre notaciones** (trazabilidad): usa las del núcleo `core:trace` (mismo concepto en
  dos notaciones), `core:realizes`, `core:refines`, `core:link`, `core:flow`. Dentro de una notación
  la matriz de validez manda: `bpmn:SequenceFlow` sólo entre nodos de flujo del mismo pool,
  `archimate:Serving` de servicio a proceso, etc. Si dudas, envía y mira `validate`.
- **Drill-down**: `patch` en un nodo con `detailViewId` abre otra vista al entrar (el proceso ArchiMate
  que se detalla en BPMN).
- **Dimensiones**: `set` en `dimensions` (`{id, name, notationId}`) da a la interfaz el eje "ver este
  concepto en BPMN / en ArchiMate".
- Cambios masivos o importaciones: `PUT …/snapshot` con un Workspace JSON completo (reemplaza todo).

## Ejemplo completo: proceso de alta en BPMN + ArchiMate + trazas

El lote de `examples/bpmn-archimate-trazas.json` (junto a este fichero) crea en un espacio vacío:

1. Tres vistas: `vw_bpmn` (notación `bpmn`, viewpoint `process`), `vw_arch` (`archimate`) y `vw_trace` (`freeform`).
2. En BPMN: un `bpmn:Pool` "Banco" y dentro (con `parentNodeId: 'vn_pool'`) `StartEvent → Task
   "Verificar identidad" → ExclusiveGateway → Task "Abrir cuenta" → EndEvent`, más la rama "no" a un
   segundo `EndEvent`; todo unido con `bpmn:SequenceFlow` vía `connect`.
3. En ArchiMate: `BusinessRole` —`Assignment`→ `BusinessProcess` "Alta de cliente";
   `ApplicationService` —`Serving`→ ese proceso; `ApplicationComponent` "CRM" —`Realization`→ el servicio.
4. Trazas: en `vw_trace` se reutilizan los **mismos elementos** (`set` de nodos con `elementId`
   existente, sin crear elementos nuevos) y se conectan con `core:trace` (pool ↔ proceso ArchiMate) y
   `core:realizes` (tarea "Abrir cuenta" ↔ servicio de onboarding).
5. `patch` del nodo del proceso ArchiMate con `detailViewId: 'vw_bpmn'`, dos `dimensions` y `meta.currentViewId`.

Ejecutarlo:

```bash
curl -s -X POST "$ALLDRAW_URL/api/workspaces" -H "Authorization: Bearer $ALLDRAW_API_KEY" \
  -H 'content-type: application/json' -d '{"name":"Alta de cliente"}'          # → {"id":"ws_…"}
curl -s -X POST "$ALLDRAW_URL/api/workspaces/ws_…/commands" -H "Authorization: Bearer $ALLDRAW_API_KEY" \
  -H 'content-type: application/json' --data @apps/server/examples/bpmn-archimate-trazas.json
curl -s "$ALLDRAW_URL/api/workspaces/ws_…/validate" -H "Authorization: Bearer $ALLDRAW_API_KEY"   # summary.error debe ser 0
curl -s "$ALLDRAW_URL/api/workspaces/ws_…/views/vw_bpmn/svg" -H "Authorization: Bearer $ALLDRAW_API_KEY" > alta.svg
```

Fragmento representativo del lote (el resto sigue el mismo patrón):

```json
{ "type": "addElementToView",
  "element": { "id": "el_verificar", "typeId": "bpmn:Task", "name": "Verificar identidad", "fields": { "taskType": "User" } },
  "node": { "id": "vn_verificar", "viewId": "vw_bpmn", "parentNodeId": "vn_pool", "x": 180, "y": 100, "w": 160, "h": 80 } }
{ "type": "connect",
  "relation": { "id": "rel_f2", "typeId": "bpmn:SequenceFlow", "from": { "elementId": "el_verificar" }, "to": { "elementId": "el_gw" } },
  "edge": { "id": "ve_f2", "viewId": "vw_bpmn", "fromNodeId": "vn_verificar", "toNodeId": "vn_gw" } }
{ "type": "connect",
  "relation": { "id": "rel_t1", "typeId": "core:trace", "name": "es el mismo proceso", "from": { "elementId": "el_pool" }, "to": { "elementId": "el_proc" } },
  "edge": { "id": "ve_t1", "viewId": "vw_trace", "fromNodeId": "vn_t_pool", "toNodeId": "vn_t_proc" } }
```

## Errores habituales

- `400 validación`: un comando no cumple el esquema (`type` desconocido, falta `collection`, `moves` sin `x`).
- `422 No se pudo aplicar`: `patch` sobre un id inexistente. Nada del lote se aplicó.
- `403`: tu rol es `viewer` (o usas un enlace de sólo lectura). Pide un rol `editor`.
- `invalid-relation` en `validate`: esa relación no es válida entre esos tipos en esa notación;
  `evidence.allowed` lista las permitidas y `supportedFixes` trae el `patch` para cambiarla.
- Nodos que "no se ven": `viewId` equivocado o coordenadas fuera del contenedor padre.
