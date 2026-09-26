# Estado del proyecto (26 de septiembre de 2026)

Primera implementación funcional de all-draw. Cubre las fases F0, F1 y F2 del plan y buena parte de F3 y F4.

## Qué existe

| Paquete | Contenido | Tests |
|---|---|---|
| `packages/core` | Modelo Zod (`Workspace` con colecciones planas por id), ids, campos JSON → pines (`derivePorts`), `NotationRegistry` con matriz de validez, viewpoints y anidamiento, `Store` en memoria, comandos con inverso (`execute`, `History`), consultas (vistas de un elemento, dimensiones), reglas de estilo, diagnósticos con `supportedFixes`, migraciones. | 7 (incluida propiedad con fast-check: cualquier secuencia de comandos + undo vuelve al origen sin referencias rotas) |
| `packages/notations/archimate` | Pack generado por `scripts/generate.mjs` desde `relationships.xml`, `relationships-keys.xml`, `viewpoints.xml`, `archimate.ecore` y `ArchimateModelUtils.java` de Archi: 61 elementos, 11 relaciones, matriz 62×62, 25 viewpoints, reglas de anidamiento, colores de Archi. | 10 |
| `packages/notations/bpmn` | Subconjunto F3: 19 elementos, 5 relaciones, matriz por roles, 2 viewpoints, anidamiento pool/lane/subproceso. | 8 |
| `packages/notations/statechart` | 9 elementos, transición con evento/guarda/acciones, estados compuestos y paralelos. | 7 |
| `packages/notations/c4` | 7 elementos, 5 viewpoints (contexto … despliegue), colores C4. | 7 |
| `packages/notations/grid` | Vista capas×etapas: geometría pura de celdas, operaciones inmutables. | 10 |
| `packages/notations/freeform` | Tipos genéricos y conectores libres. | — |
| `packages/io` | Importador `.drawer` (Drawer) → workspace: librerías, componentes, APIs con operaciones (pines reales sobre request/response, arreglando el bug de Drawer), diagramas → vistas grid, relaciones con `fromField/toField` → puertos y mappings, personas, reglas. Export/import JSON estable. | 13 |
| `packages/sync` | `YjsStore` (Store sobre `Y.Doc`, un `Y.Map` por colección), `YjsHistory` (`Y.UndoManager`), IndexedDB local (`openLocalWorkspace`), proveedor WebSocket, presencia, ficheros. | 9 |
| `packages/editor` | React Flow: nodo genérico por tipo (forma, color, icono, reglas de estilo, pines como handles), arista de relación con marcadores por tipo y extremos flotantes, lienzo con drop desde paleta, conexión validada por matriz y por compatibilidad de pines (selector si hay varias relaciones posibles), anidamiento con relación implícita, rejilla capas×etapas como celdas contenedoras, menú contextual "abrir en otra dimensión" / crear vista de detalle, breadcrumb de drill-down, inspector (datos, pines, dónde aparece, estilo; relaciones; vista con viewpoint y editor de rejilla), panel de vistas y dimensiones, panel de problemas con arreglos. | prueba de humo e2e |
| `apps/web` | Vite + React 19, PWA, espacios locales en IndexedDB, demo "Alta de cliente" en 5 dimensiones, importar `.drawer`/JSON, exportar, compartir en línea (sala = id del espacio). | e2e sync |
| `apps/server` | Node: sirve `apps/web/dist` y sincroniza Yjs por WebSocket en `/ws/<sala>` con persistencia en disco (`~/.alldraw-data`). Sin dependencias de despliegue: el mismo protocolo vale para Durable Objects. | e2e sync |

Total: 347 tests unitarios en verde (más 3 del worker en workerd), `tsc` limpio en todos los paquetes, dos pruebas e2e con el chromium del sistema (`e2e/smoke.mjs`, `e2e/sync.mjs`).

## Cómo ejecutarlo

```bash
pnpm install
pnpm test                       # vitest
pnpm dev                        # http://127.0.0.1:4173
pnpm --filter web build         # apps/web/dist
node apps/server/src/server.mjs # http://127.0.0.1:4002 (estáticos + /ws)
node e2e/smoke.mjs              # BASE=http://127.0.0.1:4173 por defecto
BASE=http://127.0.0.1:4002 node e2e/sync.mjs
pnpm gen:archimate              # regenera el pack desde _research/archi
```

## Staging

- URL: https://alldraw.bezenti.com (Caddy → `127.0.0.1:4002`).
- Servicio: `systemctl --user status alldraw` (unidad en `~/.config/systemd/user/alldraw.service`, lingering activo).
- Desplegar cambios: `pnpm --filter web build && systemctl --user restart alldraw`.
- Datos de salas: `~/.alldraw-data/<sala>.yupdate`.

## Lo que falta respecto al plan

- F3: correspondencia entre niveles guiada (hoy existen las relaciones puente `core:trace/realizes/refines` y se pueden crear a mano); semilla de tipos desde `catalogo-corporativo-ti`.
- F4: autenticación y API keys, vistas públicas de solo lectura por enlace, fichero `.alldraw` con File System Access, HTML autocontenido, adaptador Durable Object.
- F5: import/export BPMN XML, ArchiMate Open Exchange, Structurizr, XState, draw.io, Mermaid; SVG/PNG; elkjs; lint geométrico de archify.
- F6: SKILL.md/MCP, rendimiento con miles de elementos, accesibilidad, tema oscuro.
- Editor: figuras alternativas ArchiMate con iconos propios; reglas con target relación (se guardan pero no se pintan); tipos de relación y de puerto de librería desde la interfaz.

## Añadido el mismo día (segunda tanda)

- Repositorio público https://github.com/darwinva97/all-draw.
- Panel **Espacio** (botón en la barra): pestañas Librerías (librerías, tipos con campos y pines, componentes reutilizables), Reglas (condiciones, estilo con vista previa, impacto, colisiones) y Personas (asignaciones a elementos, vistas, capas, etapas, tipos, relaciones). Sección Personas en el inspector de elemento.
- Copiar/pegar (Ctrl+C/V: nuevas apariciones de los mismos elementos; Ctrl+Shift+V y Ctrl+D: clonar), barra de alinear/distribuir/igualar tamaño con ≥2 nodos, bendpoints editables (doble clic en arista inserta, arrastrar mueve, doble clic en manejador elimina).
- e2e `e2e/ui.mjs` cubre estas funciones; `pnpm e2e` incluye humo y sync.

## Tercera tanda (26 de septiembre de 2026, tarde)

- **Servidor** (`apps/server`, TypeScript con `tsx`): cuentas (registro/login con scrypt, cookie de sesión), API keys, espacios con roles owner/editor/viewer, enlaces compartidos con rol y caducidad, `WorkspaceStore` con adaptadores SQLite (`node:sqlite`) y memoria (esquema pensado para Postgres/Durable Objects, ver `apps/server/README.md`), WebSocket Yjs que descarta escrituras de viewers, API REST de comandos (`POST /api/workspaces/:id/commands`, validada con `CommandSchema` de core), `validate`, SVG por vista, `GET /api/openapi.json`, servidor MCP (`pnpm --filter @all-draw/server mcp`) y `SKILL.md` para agentes. Migración automática de los `.yupdate` antiguos a un usuario `legacy@alldraw.local`. El primer usuario registrado es admin.
- **Web**: inicio con cuenta (espacios en el servidor + locales, subir un local al servidor), ruta `#/s/<id>` para espacios del servidor (caché IndexedDB local, funciona offline y sincroniza al volver), diálogo Compartir con enlaces de edición/lectura, pantalla de claves API, presencia (cursores y avatares), tema oscuro, layout automático (elkjs, `onRequestLayout`), menú Importar/Exportar con todos los formatos, validadores extra (geometría, bpmnlint, cobertura de trazas). Paquete inicial partido: layout e io se cargan bajo demanda.
- **io**: importar/exportar `.archimate` (Archi nativo, probado con Archisurance), ArchiMate Open Exchange, BPMN 2.0 XML con DI (`bpmn-moddle`), Structurizr JSON, XState JSON, Mermaid (flowchart y stateDiagram-v2, import y export), draw.io (export), OpenAPI → librería de APIs con pines, `importAny` con detección de formato; SVG (claro/oscuro/dual) y PNG sin DOM; HTML autocontenido navegable; 10 reglas de bpmnlint.
- **layout**: elkjs (layered/stress/mrtree/force, jerarquía, puertos, por celda en rejilla) y lint geométrico portado de archify.
- **Notaciones**: BPMN completo (36 tipos, coreografías y conversaciones), y packs nuevos `sequence`, `er`, `uml` (clases), `mindmap`, `flow` (flowchart), `dfd`, más `catalog` con 162 tipos de diagrama del catálogo corporativo. Trazabilidad entre niveles en core (`suggestTraces`, `traceMatrix`, `traceCoverage`).
- **Editor**: búsqueda global (Ctrl+K), renombrar en línea (F2), visuales (nota, grupo, etiqueta, imagen), redimensionar arrastrando, ajuste a rejilla, menú del lienzo, panel de atajos (?), reglas sobre relaciones, propagación de plantillas a instancias, reasignar tipo al borrarlo, índices en memoria para vistas grandes.
- **Deudas resueltas**: tipos de librería se desregistran al borrarlos; plantillas propagan; pegado en rejilla asigna celda; bundle partido; `deleteView` ya no falla con nodos de la propia vista.
- e2e: `smoke`, `ui`, `sync` (cuentas + enlace de edición + presencia) y `readonly` (enlace de lectura). CI en GitHub Actions.

### Pendiente todavía
- Adaptadores Postgres y Cloudflare Durable Object (interfaz lista, sin implementar).
- Figuras ArchiMate con iconos propios; matriz de trazabilidad como panel en la interfaz (existe en core y en el validador).
- Vistas de secuencia con lienzo propio (hoy se pintan como libres).
- Documentación de usuario, accesibilidad, i18n.

## Cuarta tanda (26 de septiembre de 2026, noche)

- **Figuras ArchiMate** fieles a Archi: 61 iconos y figuras alternativas (`packages/notations/archimate/src/figures.ts`) usadas por el editor y por el SVG exportado; selector "Rectángulo con icono / Figura ArchiMate" en el inspector.
- **Trazabilidad en la interfaz**: pestaña Trazabilidad en el panel Espacio (matriz entre dos notaciones, cobertura, huecos, enlazar sugerencias en lote), sección Trazas y Sugerencias en el inspector, y sugerencias en el menú del nodo.
- **Diagramas de secuencia** con lienzo propio: líneas de vida como columnas, mensajes horizontales ordenables arrastrando, activaciones, fragmentos; layout propio; vista de secuencia en la demo.
- **Despliegue agnóstico**: `packages/server-core` (API, auth con WebCrypto PBKDF2, protocolo Yjs, docs) compartido por `apps/server` (Node: SQLite o Postgres con `DATABASE_URL`) y `apps/worker` (Cloudflare: D1 + un Durable Object por espacio con hibernación, assets estáticos). Probado en workerd; no desplegado en Cloudflare todavía (pasos en `apps/worker/README.md`).
- **Manual de usuario** en `docs/manual/` (9 capítulos con capturas) y pasada de accesibilidad (diálogos con foco atrapado, etiquetas, contraste, `e2e/a11y.mjs`).

### Pendiente
- Internacionalización (la interfaz es solo en español).
- Desplegar el worker en Cloudflare y migrar datos (hoy la producción es el VPS con SQLite).
- Herramienta de migración SQLite/Postgres → D1.
- Etiquetar el input de título del inspector (aviso del script de accesibilidad).
