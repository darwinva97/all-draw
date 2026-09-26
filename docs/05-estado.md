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

Total: 110 tests unitarios en verde, `tsc` limpio en todos los paquetes, dos pruebas e2e con el chromium del sistema (`e2e/smoke.mjs`, `e2e/sync.mjs`).

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
