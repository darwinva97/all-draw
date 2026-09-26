# Plan: diagramador transversal ("all-draw")

Objetivo: un editor web, offline y online, donde un mismo modelo se ve a través de varias notaciones (BPMN, máquinas de estado, ArchiMate, C4, capas×etapas…) que conviven como **dimensiones** de un mismo suceso/proceso, con librerías de tipos de componente cuyos valores de campo actúan como **pines** conectables.

## 0. Decisiones de partida (recomendación; ver §8 para las que conviene confirmar)

| Decisión | Elección | Por qué |
|---|---|---|
| Punto de partida | **Proyecto nuevo**, migrando piezas del diagramador | El lienzo capa×etapa, `Relation` sin tipo y el blob global son estructurales; se reescriben, no se parchean. Se conservan como código: `lib/schema.ts`, `lib/rules.ts`, `lib/api.ts` (OpenAPI), `local.ts` (archivo/PWA), `cloud.ts` (patrón flush-antes-de-pull), inspector, sidebar. |
| Arquitectura del modelo | **Modelo ≠ vistas** (patrón Archi/Structurizr/Gaphor) | Es la única forma de que un elemento viva en N diagramas de N notaciones. |
| Canvas | **React Flow (@xyflow/react)** | MIT sin features cerradas; handles con id = pines; `parentId/extent` = contenedores (pools, lanes, celdas, boundaries); cada notación es un conjunto de `nodeTypes`/`edgeTypes`. |
| Layout | **elkjs** en Web Worker + layouts propios (rejilla, secuencia) | Jerarquía + puertos + hyperedges. |
| Local-first | **Yjs** + `y-indexeddb` + servidor Yjs sobre Cloudflare Durable Objects | Ecosistema más amplio, `UndoManager`, awareness. Loro queda como alternativa si el reparentado de árboles pesa más de lo previsto. |
| Esquemas | **Zod** (tipos + validación en cliente, worker y agentes) | Elimina la duplicación cliente/servidor del diagramador. |
| Stack | Vite + React 19 + TS, monorepo pnpm, Vitest, Playwright | Mismo stack conocido; tests desde el día 1. |
| Idioma UI | Español (como Drawer); código en inglés, coherente | |

## 1. Modelo conceptual (el núcleo)

```
Workspace
├── libraries[]            (Library: notationPacks[], elementTypes[], relationTypes[], portTypes[], components[])
├── model                  (el grafo semántico; una sola vez)
│   ├── elements[]         Element { id, typeId, name, doc, fields{}, ports[], profiles[], props{}, features{} }
│   ├── relations[]        Relation { id, typeId, from: End, to: End, fields{}, props{} }   End = { elementId, portId? }
│   └── ports (dentro del element)  Port { id, key, portTypeId, direction: in|out|both, path?: "response.userId", derived: bool }
├── views[]                View { id, kind, notationId, viewpointId?, name, layout?, nodes[], edges[], rootElementId? }
│   ├── nodes[]            ViewNode { id, elementId?, parentNodeId?, x, y, w, h, style{}, detailViewId?, cell?: {layerId, stageId} }
│   └── edges[]            ViewEdge { id, relationId?, fromNodeId, toNodeId, fromPortId?, toPortId?, bendpoints[], style{} }
├── dimensions[]           Dimension { id, name, notationId, viewpointId } — "eje" navegable (BPMN, Estados, ArchiMate…)
├── people[], rules[]      (migrados del diagramador; rules aplican a elementos, relaciones y vistas)
└── meta                   { schemaVersion, name, ... }
```

Reglas clave:
- **Un elemento, muchas apariciones.** `ViewNode.elementId` apunta al elemento; posición y estilo son por vista. Índice inverso elemento → nodos de vista, mantenido en memoria (derived store).
- **Aristas de vista unen nodos de vista; relaciones unen elementos.** Una relación puede dibujarse en varias vistas con bendpoints distintos.
- **Pines = `Port` del elemento** (identidad semántica compartida entre vistas; posición por vista). Se **derivan** de los campos tipados (`json` → un puerto por hoja, con `path`; `list`, `keyvalue`, campos simples → puerto plano) y se pueden declarar a mano. Compatibilidad `(portType origen, portType destino) → relationTypes permitidos` como datos, igual que la matriz de Archi. Una relación tiene N `mappings[{fromPath,toPath}]` además de los extremos, para conectar varios campos en un solo enlace.
- **Notation pack** (plugin de datos + render): `{ id, elementTypes[], relationTypes[], portTypes[], validityMatrix, viewpoints[], nodeRenderers, edgeRenderers, layout, importers, exporters }`. Cada notación es una carpeta en `packages/notations/*`. El pack "grid" (capa×etapa) es una **clase de vista**, no el editor entero.
- **Dimensiones y navegación.** Un elemento "Proceso de alta" puede tener: una vista BPMN (`View.rootElementId = proceso`), una vista de máquina de estados del mismo elemento, y aparecer en una vista ArchiMate como `BusinessProcess`. La UI ofrece, sobre cualquier nodo, "abrir en otra dimensión": lista las vistas cuyo `rootElementId` es ese elemento o que lo contienen, agrupadas por notación. `ViewNode.detailViewId` es el drill-down explícito (equivalente a `DiagramModelReference` de Archi / `navigateTo` de LikeC4). Un breadcrumb muestra la pila de vistas.
- **Viewpoints** filtran suave (atenúan) la paleta y los nodos que no pertenecen a la notación, no prohíben.
- **Properties (usuario) y Features (app)** separados; profiles/specializations sin crear tipos nuevos.
- **Toda mutación es un Command** con inverso (undo por comando, no por snapshot) aplicado sobre el `Y.Doc`; los agentes usan los mismos comandos vía API.

## 2. Estructura del repositorio

```
all-draw/
  package.json, pnpm-workspace.yaml, tsconfig.base.json
  packages/
    core/          modelo (Zod), comandos, índices, validación, matriz de puertos, migraciones de esquema
    notations/     archimate/, bpmn/, statechart/, c4/, grid/ (capa×etapa), freeform/, sequence/
    editor/        React Flow: nodos/aristas genéricos, paleta, inspector, reglas, personas, navegación de dimensiones
    layout/        elkjs en worker + layouts propios; lint geométrico (portado de archify/geometry.mjs)
    io/            importers/exporters: .drawer (Drawer), BPMN XML, ArchiMate OEF, Structurizr JSON, XState, draw.io, Mermaid, SVG/PNG, HTML autocontenido
    sync/          Yjs: y-indexeddb, provider WebSocket, awareness, File System Access, single-file
    agent/         cliente TS de la API, generador de openapi.json desde Zod, SKILL.md/agent.md
  apps/
    web/           Vite SPA + PWA (draw2.bezenti.com o similar)
    worker/        Cloudflare Worker: Hono API REST + Durable Object por workspace (Yjs) + auth (portada del diagramador)
  docs/            01-analisis.md, 02-plan.md, ADRs
  _research/       clones de referencia (ignorados en git)
```

## 3. Fases

Cada fase termina con algo usable y con tests. Estimación en semanas de trabajo de una persona con agentes.

### Fase 0 — Fundación (1 sem)
- `git init`, monorepo pnpm, Vite + React 19 (instalador oficial), Vitest, ESLint/Prettier, CI con `pnpm test`.
- `packages/core`: esquemas Zod del modelo del §1, `schemaVersion`, migraciones, ids estables.
- Tests de propiedad sobre normalización e integridad referencial.
- **Entrega:** `pnpm test` verde; un JSON de ejemplo válido con un elemento en dos vistas.

### Fase 1 — Núcleo de modelo y comandos (2 sem)
- Comandos con inverso (crear/borrar/mover elemento, nodo, relación, puerto; reparentar; cambiar campo) sobre `Y.Doc`.
- Derived stores: índice elemento→nodos, relación→aristas, puertos derivados de campos (portar `lib/schema.ts`).
- Matriz de compatibilidad de puertos y de relaciones; validación con diagnósticos `{code, severity, subject, supportedFixes}` (contrato de archify).
- Notation pack `freeform` (tipos genéricos) y `grid` (capa×etapa) como datos.
- **Entrega:** librería `core` documentada; importador `.drawer` → workspace (reutiliza componentes, tipos, APIs, reglas, personas; cada diagrama → vista `grid`; `fromField/toField` → puertos derivados + mapping).

### Fase 2 — Editor mínimo (3 sem)
- `packages/editor` con React Flow: nodo genérico que pinta según tipo + reglas de estilo; handles = puertos (mostrar/ocultar por campo, agrupados); `isValidConnection` según matriz; contenedores con `parentId/extent`.
- Paleta (librerías, tipos, componentes, APIs), inspector por pestañas (portado), reglas, personas, atajos, menú contextual, undo/redo, copiar/pegar, zoom doble.
- Vista `grid`: celdas como contenedores React Flow con cabeceras fijas, redimensionado, grupos de etapas.
- Vista `freeform`: lienzo libre con las mismas piezas.
- Persistencia local: Yjs + y-indexeddb (multi-pestaña gratis), export/import JSON.
- **Entrega:** paridad funcional aproximada con Drawer en modo local, más lienzo libre y pines reales (también sobre APIs del catálogo).

### Fase 3 — Dimensiones y notaciones (4 sem)
- Navegación: "abrir en otra dimensión", `detailViewId`, breadcrumb, panel "dónde aparece", crear vista de otra notación a partir de un elemento.
- Packs, en este orden: **ArchiMate** (tipos y matriz generados desde `relationships.xml` y `viewpoints.xml` de Archi por script), **Statechart** (estados, compuestos, transiciones con guarda/evento/acción), **BPMN** (subconjunto: pool, lane, tarea, subproceso colapsado → `detailViewId`, gateways, eventos inicio/fin/intermedio, flujos de secuencia y mensaje), **C4** (contexto/contenedor/componente con anidamiento).
- Correspondencia entre niveles: relación `realizes/refines` entre elementos de distinta notación para que "Pedido" en C4 sea trazable al `BusinessProcess` ArchiMate sin compartir nombre y campos.
- Semilla de tipos de diagrama desde `catalogo-corporativo-ti` (solo las ~100 entradas que son notaciones formales, con ids estables generados).
- **Entrega:** un mismo proceso modelado en BPMN + estados + ArchiMate, navegable.

### Fase 4 — Offline y online (2 sem)
- `apps/worker`: Durable Object por workspace con Yjs (y-websocket compatible), auth y API keys portadas, API REST de comandos generada desde Zod (openapi.json automático).
- Cliente: provider WebSocket con reconexión, awareness (cursores), estado "pendiente de subir".
- PWA, archivo `.alldraw` con File System Access, HTML autocontenido con test de autocontención (portado de archify).
- Vistas públicas de solo lectura.
- **Entrega:** editar sin red, sincronizar al volver, dos personas a la vez sin pisarse.

### Fase 5 — Import/export y layout (3 sem)
- Importar/exportar: BPMN 2.0 XML (`bpmn-moddle`), ArchiMate Open Exchange, Structurizr JSON, XState JSON, draw.io XML, Mermaid (flowchart, stateDiagram, sequence), OpenAPI (ya existe).
- Exportar: SVG dual-theme, PNG, PDF, JSON Canvas.
- elkjs en worker para vistas libres, ArchiMate y C4; layout propio para estados y secuencia; lint geométrico de archify como panel de problemas con "arreglar".
- **Entrega:** ida y vuelta con Archi y bpmn.io.

### Fase 6 — Agentes y pulido (2 sem)
- `SKILL.md`, `agent.md`, servidor MCP sobre la misma API de comandos; ejemplos.
- Rendimiento con 1.000 elementos × 50 vistas (virtualización, índices).
- Accesibilidad, atajos, tema, documentación de usuario.

## 4. Qué se migra literalmente del diagramador

| Pieza | Destino | Cambios |
|---|---|---|
| `lib/schema.ts` | `core/ports/derive.ts` | Devuelve `Port[]` con id estable por `path`; se aplica también a `ApiOperation.requestBody/responseBody`. |
| `lib/rules.ts` + `Rules.tsx` | `core/rules`, `editor/rules` | Fuentes nuevas: `relation`, `view`, `notation`, `port`. |
| `lib/api.ts` (OpenAPI) | `io/openapi` | Resolver `$ref` y `components/schemas`. |
| `local.ts`, `sw.js`, manifest | `sync/file`, `apps/web` | Formato nuevo; firma por `Y.Doc` state vector. |
| `cloud.ts` | `sync/remote` | Sustituido por provider Yjs; se conserva la lógica de sesión y "pendientes". |
| `worker/auth.ts`, API keys | `apps/worker` | Igual. |
| `Inspector.tsx`, `Sidebar.tsx`, `People.tsx`, `Shortcuts.tsx` | `editor/*` | Adaptados al nuevo store. |
| `geometry.ts` | descartado | React Flow + archify geometry. |
| `Board.tsx` | descartado | Reescrito como vista `grid` sobre React Flow. |

Bugs del diagramador que conviene arreglar allí mientras tanto: `local.ts` no guarda `apis`; `GET /diagrams/:id/export` no devuelve `apis`.

## 5. Qué se toma de archify

- `renderers/shared/geometry.mjs` → `packages/layout/lint` (MIT; se conserva la atribución).
- Contrato de diagnósticos y perfil de calidad `standard|showcase`.
- Test de autocontención offline y empaquetado single-file.
- Export SVG dual-theme y guardas de canvas.
- Tokens visuales (4 presets light/dark) como punto de partida del tema.

## 6. Qué se toma de Archi

- `relationships.xml`, `relationships-keys.xml`, `viewpoints.xml` → generador de datos del pack ArchiMate (script en `packages/notations/archimate/scripts`).
- Patrón `DiagramModelReference` → `ViewNode.detailViewId`.
- Properties vs Features, Profiles, Commands.
- Importador/exportador Open Exchange Format (XSD 3.1/3.2 disponibles en `org.opengroup.archimate.xmlexchange/xsd`).

## 7. Riesgos

- **Alcance de notaciones.** BPMN completo es enorme; se fija un subconjunto útil y se documenta. UML/XMI se difiere.
- **React Flow y rendimiento** con miles de nodos: virtualizar por vista; una vista nunca carga el modelo entero.
- **Yjs y documentos grandes**: un `Y.Doc` por workspace puede crecer; plan B: un `Y.Doc` por vista + uno para el modelo.
- **Semántica cruzada** (¿un `BusinessProcess` ArchiMate "es" un proceso BPMN?): se resuelve con relaciones de trazabilidad explícitas, no con identidad forzada.
- **Licencias**: React Flow MIT, elkjs EPL (uso sin modificar, ok), bpmn-moddle MIT, Yjs MIT, archify MIT con doble copyright, iconos de Simple Icons con licencias por marca.

## 8. Decisiones (confirmadas; ver 03-decisiones.md)

1. Proyecto nuevo (`all-draw`) vs. evolucionar `diagramador` in situ. Recomendación: nuevo, con importador `.drawer`.
2. React Flow vs. tldraw (mejor motor, licencia propietaria con clave). Recomendación: React Flow.
3. Yjs vs. Loro. Recomendación: Yjs.
4. Backend: seguir en Cloudflare Workers + Durable Objects (como Drawer) vs. Node en esta VPS. Recomendación: Cloudflare, por continuidad; la VPS sirve para staging.
5. Orden de notaciones en la Fase 3 (propuesto: ArchiMate → Statechart → BPMN → C4).
6. Nombre del producto y dominio (`draw.bezenti.com` ya lo usa Drawer).
