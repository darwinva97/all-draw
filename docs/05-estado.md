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

Total: 650 tests unitarios en verde (más 45 del worker en workerd) y 15 conjuntos de pruebas de navegador, `tsc` limpio en todos los paquetes, dos pruebas e2e con el chromium del sistema (`e2e/smoke.mjs`, `e2e/sync.mjs`).

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
- Desplegar el worker en Cloudflare y migrar datos (hoy la producción es el VPS con SQLite).
- Herramienta de migración SQLite/Postgres → D1.

## Quinta tanda: internacionalización

- Paquete `packages/i18n`: la clave es el texto en español; diccionario inglés en `src/en.ts` (~600 entradas, incluidos nombres de packs, tipos, categorías y viewpoints, que se aplican al crear el registro con `localizePack`). Selector de idioma en el inicio y en la barra del editor, persistido en `localStorage('alldraw:lang')`; por defecto el idioma del navegador. Test `keys.test.ts` que falla si aparece una clave `t('…')` sin traducción.
- Detalles: título del inspector etiquetado; mensajes a uno mismo en secuencia (handle "self" en la cabecera de la línea de vida).
- Los e2e fuerzan `locale: 'es-ES'`.
- Los nombres ArchiMate se mantienen en inglés en ambos idiomas (así los nombra la especificación). Los valores que se guardan en el modelo (papeles sugeridos, nombres iniciales de capas y etapas) se crean en el idioma activo.

## Sexta tanda: operaciones, rendimiento, seguridad, historial y móvil

- **Operaciones (VPS)**: `apps/server/scripts/backup.mjs` (copia consistente de la SQLite + JSON por espacio, gzip, retención 30 días) en cron diario a las 3:17; `healthcheck.mjs` cada 5 minutos reinicia el servicio tras 3 fallos; `restore.mjs`; `apps/worker/scripts/migrate-from-sqlite.mjs` para migrar a D1. Copias en `~/.alldraw-backups/`.
- **Rendimiento** (`docs/06-rendimiento.md`): generador determinista de 1.000 elementos × 50 vistas (`?bench=1` en el inicio), benchmarks con umbral, `validate` 4× más rápido, lint geométrico con barrido, `list()` cacheado, reglas precompiladas, panel de problemas con debounce y acotado a la vista, React Flow solo pinta lo visible a partir de 300 nodos.
- **Seguridad** (`docs/07-seguridad.md`): CSRF por cabecera/origen, sesiones de 30 días deslizantes y cierre de todas, CSP y cabeceras, rate limit en registro/enlaces, límites de cuerpo, token de enlace fuera de la URL, cambio y restablecimiento de contraseña, pantalla Cuenta con usuarios (admin), `INVITE_CODE`. Producción con `SESSION_SECRET` y `PUBLIC_URL` en la unidad systemd.
- **Historial**: instantáneas automáticas cada 30 min de actividad y manuales con etiqueta, restaurar y descargar (diálogo Historial).
- **Responsive y táctil**: tableta con paneles colapsables; móvil con barra inferior y hojas deslizantes, pulsación larga para el menú, áreas táctiles de 44 px; `e2e/mobile.mjs`.
- **Cloudflare**: el worker está listo pero la cuenta tiene agotada la cuota de bases D1 (10); hace falta liberar una o subir de plan.

## Séptima tanda (29-30 de septiembre de 2026)

- **Cloudflare desplegado**: https://alldraw.darwin-sva-97.workers.dev. Como la cuenta tiene agotada la cuota de D1, el registro de cuentas vive en un Durable Object con SQLite (`RegistryDO`, instancia `registry-2`); D1 sigue siendo opcional con el binding `DB`. Datos migrados desde el VPS (2 usuarios, 3 espacios). Registro cerrado. Endpoint de rescate `POST /api/admin/reset-password` activo solo mientras exista el secreto `RESET_CODE`.
- **Registro cerrado de verdad**: con `ALLOW_REGISTRATION=false` ya no se puede crear el primer usuario salvo con `INVITE_CODE`.
- **Comentarios**: hilos anclados a elementos, nodos, aristas, vistas o puntos, con respuestas, menciones y resolver; burbujas en el lienzo; se reanclan al borrar.
- **Pata de gallo** (notación IE) y cardinalidades en ER y UML, en el editor, SVG, draw.io y Mermaid (`erDiagram`).
- **Cambio de vista**: 60 nodos de 176 a 124 ms y 300 nodos de 717 a 384 ms en producción.

## Octava tanda: listo para producción (3 de octubre de 2026)

- **Documentación dentro de la app** (`#/docs`), en español e inglés: 29 capítulos, conceptos, glosario, FAQ, privacidad, términos, novedades, referencia de notaciones generada de los packs y visor de la API. Búsqueda, índice, impresión.
- **Portada, galería de 12 plantillas, recorrido guiado, ayuda contextual**, iconos propios, avisos y diálogos propios, estados de carga/error/sin conexión, aviso de versión nueva.
- **Producción**: exportar y borrar la cuenta, cambiar nombre/correo, logs JSON, `/api/status`, `/metrics`, errores de cliente, `security.txt`, cierre ordenado, límites anti-abuso (formulario, espacios por cuenta, tamaño de documento, conexiones), IP real tras proxies de confianza, mantenimiento y simulacro de restauración semanales.
- **QA**: informe exploratorio de 82 fallos (`docs/qa/2026-10-03-informe.md`), todos tratados en cinco frentes (lienzo, paneles y accesibilidad, idioma, importar/exportar, servidor y cuenta). Destacan: conectar soltando sobre el nodo, compartimentos UML/ER, menús dentro de pantalla y con teclado, importar se puede deshacer, secuencia en SVG, Mermaid de estados/secuencia/clases, sesiones cerradas que cortan la edición, errores traducidos por código, campos y opciones legibles en ambos idiomas.
