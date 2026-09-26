# Inventario: Drawer (diagramador) y archify

He completado el inventario de ambos repositorios. Aquí van las listas exhaustivas.

---

# PARTE 1 — DRAWER (diagramador)

Raíz: `/home/maka/projects/all-draw/_research/diagramador`

## 1.1 Modelo de datos

Fuente: `/home/maka/projects/all-draw/_research/diagramador/src/types.ts`

Entidades: `Library`, `ComponentType`, `Component`, `FieldDef`, `KeyValue`, `Layer`, `Stage`, `StageGroup`, `Placement`, `Api`, `ApiOperation`, `Relation`, `Diagram`, `AppData`, `Condition`, `RuleStyle`, `StyleRule`, `Assignment`, `Person`, `Selection`, `LinkDefaults`.

**Los 10 `FieldKind`** (constante `KINDS`):
1. `text` — Texto
2. `textarea` — Texto largo
3. `number` — Número
4. `select` — Lista (desplegable)
5. `checkbox` — Casilla
6. `url` — URL
7. `date` — Fecha
8. `list` — Lista de textos
9. `keyvalue` — Clave → valor
10. `json` — JSON (con validación y formateo)

**Relaciones** — `LineStyle` (3): `solid` (Directa/continua), `dashed` (Troceada), `dotted` (Punteada). `Dir` (3): `fwd` (→ Una dirección), `both` (↔ Ambas), `none` (— Sin flecha). Otros campos: `color`, `width`, `label`, `fromField`, `toField` (mapeo campo→campo, ruta hasta hoja en JSON, p. ej. `response_body.datos.id`).

**Métodos HTTP** (`METHODS`, 7): GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.

**`RuleSource`** (7 fuentes de condición): `field` (Campo del componente), `name` (Nombre), `description` (Descripción), `type` (Tipo), `library` (Librería), `people` (Persona asignada), `role` (Papel asignado).

**`RuleOp`** (10 operadores): `eq` (es igual a), `ne` (no es igual a), `contains` (contiene), `notContains` (no contiene), `in` (es alguno de), `empty` (está vacío), `notEmpty` (tiene algún valor), `gt` (es mayor que), `lt` (es menor que), `regex` (cumple la expresión regular). Sin valor: `empty`, `notEmpty`. Opción `caseSensitive`.

**`STYLE_PARTS`** (16 propiedades pintables): `bg` Fondo · `text` Color del texto · `border` Borde · `borderWidth` Grosor del borde · `borderStyle` Estilo del borde (solid/dashed/dotted) · `accent` Franja izquierda · `accentWidth` Ancho de la franja · `top` Franja superior · `topWidth` Alto de la franja superior · `opacity` Opacidad · `glow` Brillo · `badge` Punto · `badgeText` Texto del punto · `icon` Icono · `bold` Negrita · `strike` Tachado. Fusión de menor a mayor `priority`, propiedad a propiedad; `match: all|any`; `diagramId` limita la regla a un diagrama.

**`AssignKind`** (5): `component` (Componente), `diagram` (Diagrama), `layer` (Capa), `stage` (Etapa), `type` (Tipo).

**`ROLES`** sugeridos (11, campo libre): Owner, Stakeholder, Líder técnico, Product Owner, Arquitecto, Analista funcional, Desarrollo, QA, Seguridad, Infraestructura, Contacto.

**`API_CONTRACT_FIELDS`** (19 campos de la plantilla Tipo API): `capa` (select EXP/PROC/SD/SYS), `estado` (select Existente/Nuevo/Modificado), `version`, `method` (select 7 métodos), `path`, `base_url_entornos` (keyvalue Entorno|Base URL), `auth` (select: Ninguna, API Key, Basic, Bearer JWT, OAuth2 client credentials, mTLS), `content_type`, `headers` (keyvalue), `path_params` (keyvalue), `query_params` (keyvalue), `request_body` (json), `response_body` (json), `response_codes` (keyvalue Código|Significado), `errores` (json), `timeout_ms` (number), `tags` (list), `documentacion` (url), `notas` (textarea).

**`Selection`** (7 tipos seleccionables): person, rule, placement, component, relation, api, type.

## 1.2 Lista completa de funciones de usuario

Fuentes: `/home/maka/projects/all-draw/_research/diagramador/README.md` y `/home/maka/projects/all-draw/_research/diagramador/CONTEXT.md`

**Tablero y estructura**
1. Editor de diagramas en cuadrícula capas (filas) × etapas (columnas).
2. Varios diagramas: crear, duplicar, eliminar, cambiar entre ellos; guardado automático.
3. Capas: añadir, renombrar en la cabecera, reordenar arrastrando ⋮⋮, color por capa, alto fijable.
4. Etapas: añadir, renombrar, reordenar, ancho fijable.
5. Grupos de etapas (`StageGroup`): banda por encima de las columnas; se crean arrastrando sobre la franja gris, se redimensionan arrastrando sus bordes, también desde menú contextual de etapa o casillas del inspector; sólo se funden etapas contiguas; color propio.
6. Redimensionar celdas: borde derecho = ancho de etapa, borde inferior = alto de capa; doble clic = automático.
7. Posición libre dentro de la celda (rejilla de 8 px).
8. Flechas del teclado mueven la instancia (Shift = 1 px).
9. ⊞ Apilar/ordenar los componentes de una celda (`tidyCell`).
10. Mover el lienzo: barra espaciadora + arrastre, botón central del ratón, o arrastre desde zona libre.
11. Texto legible al alejar: por debajo de 11 px los nombres dejan de encoger y crecen hasta ×2,5 (`--lf = min(2.5, max(1, 11/(13·zoom)))`); nombres largos con «…».

**Librerías, tipos y componentes**
12. Librerías de componentes y tipos, globales y compartidas entre todos los diagramas.
13. Librerías plegables en el panel lateral (clic en el título); plegar todas / desplegar todas; ver sólo esta librería.
14. Tipos de componente: icono, color y campos específicos (los 10 kinds).
15. Plantilla **Tipo API** en la pestaña Tipos, con los 19 campos de contrato; «+ Campos de contrato API» los añade a un tipo existente.
16. Componentes: nombre, tipo opcional, descripción y valores de campos; se pueden mover de librería y usar tipos de cualquier librería.
17. Drag & drop: librería → celda, celda → celda, Ctrl+arrastrar = clonar, soltar en la librería = quitar.
18. Buscar en la librería (Ctrl+K).
19. Pestañas de la librería: Componentes (Alt+1) / Tipos (Alt+2) / APIs / Personas.

**Catálogo de APIs y OpenAPI**
20. Catálogo de APIs (`data.apis`): una API se define una vez con nombre, descripción, repositorio, docs, versión, autenticación, `baseUrls[]` (entorno → URL), color, icono, etiquetas y `operations[]`.
21. Cada `ApiOperation`: nombre, método, ruta, resumen, `deprecated`, cabeceras, parámetros de path, parámetros de query, request body JSON, response body JSON, códigos de respuesta, notas.
22. Se arrastra a una celda y allí se elige **qué operación** usa; el chip muestra `MÉTODO /ruta` bajo el nombre.
23. Desde la celda sólo se elige operación (`placement.operationId`) y se escribe una **nota propia de esa instancia** (`placement.note`); editar la API cambia todos sus usos y el panel dice en cuántos.
24. Componente espejo fijo en la librería `lib-apis` (id `api-{apiId}`) mantenido por `syncApiComponent`, para que tablero, flechas, reglas y personas funcionen igual.
25. Dos paneles distintos a propósito: `ApiPanel` (edita la API) y `ApiInstancePanel` (sólo operación + nota).
26. **Importar OpenAPI/Swagger** para crear la API con sus operaciones (`fromOpenApi`); importar OpenAPI directamente en una celda.
27. **Exportar como OpenAPI 3.1** (`toOpenApi`).
28. Duplicar API, eliminar API, duplicar/mover/eliminar operaciones.

**Relaciones**
29. Crear relación arrastrando desde el punto ● de un componente hasta otro; puede saltar capas y etapas.
30. Estilos: directa / troceada / punteada. Dirección: →, ↔, ninguna. Color, grosor y etiqueta.
31. Conexión **campo → campo** entre origen y destino, con rutas hasta la hoja en campos JSON; «Quitar conexión por campos».
32. Invertir sentido de una flecha (`swapRelation`).
33. Los campos JSON muestran la estructura reconocida (campo, tipo, ejemplo) mediante `lib/schema.ts`.

**Subcomponentes y clones**
34. Subcomponentes: soltar un chip encima de otro lo anida (`parentId`); arrastrarlo a la celda lo saca. «Sacar del contenedor».
35. Añadir hijo rápido (`quickAddChild`).
36. Un componente puede estar en varias etapas/capas: al pasar el ratón brillan todos sus clones.
37. Duplicar (Ctrl+D), desvincular una instancia (Ctrl+Shift+D), «Desvincular en este diagrama», «Separar todas las instancias de este componente» (`splitInstances`), «Colocar como copia independiente».

**Reglas de estilo**
38. Editor de reglas (`Rules.tsx`): condiciones (7 fuentes × 10 operadores), estilo (16 propiedades), prioridad, `match all|any`, activar/desactivar, limitar a un diagrama.
39. Resolución por prioridad: se aplican de menor a mayor y la de más prioridad manda propiedad a propiedad; el editor muestra qué reglas la pisan.
40. Botón ⚡ (`rulesFromField`): crea de golpe una regla por cada valor de un campo de lista.
41. Duplicar regla, más/menos prioridad, eliminar regla.
42. Leyenda de colores del diagrama (también visible en la vista pública).

**Personas**
43. Registro de personas: nombre, cargo, equipo, correo, color, notas. Globales, sincronizadas como documentos `kind: 'person'`.
44. Asignación con papel a componente, diagrama, capa, etapa o tipo; papel libre con 11 sugeridos.
45. El tablero muestra avatares sobre cada componente; la ficha de persona lista dónde participa y con quién coincide; la pestaña Personas de la cuenta da vista global y reparto por papel.

**Exportar imagen** (botón 🖼)
46. PNG ×1, PNG ×2, PNG ×3 (resolución de pantalla).
47. SVG escalable.
48. Copiar al portapapeles.
49. Imprimir o guardar en PDF.
50. Captura el tablero entero siempre al 100 % (independiente del zoom), suelta cabeceras fijas, aplica `body.exporting` para esconder tiradores, puertos y botones; la escala se recorta sola si el lienzo pasa de 16 000 px de lado o 120 M de píxeles, y se avisa.

**Persistencia — 5 modos**
51. **Este navegador** (por defecto): `localStorage`, clave `diagramador.v2`, sin cuenta ni red.
52. **Un archivo de tu equipo**: `.drawer` (JSON) vinculado vía File System Access; autoguardado con debounce (desactivable) o Ctrl+S; Ctrl+O abre otro archivo; el vínculo se recuerda en IndexedDB; reconexión desde el chip. Acciones: Guardar en un archivo…, Abrir un archivo…, Guardar en el archivo, Guardar una copia como…, Recargar desde el archivo, Desvincular el archivo.
53. **App suelta sin servidor**: «Descargar Drawer como archivo» produce un `drawer.html` único que se abre con doble clic, sin red (router en hash), con datos separados.
54. **Con cuenta en la nube**: sincronización automática con debounce; la cuenta es la fuente de verdad; al entrar por primera vez, si la cuenta está vacía se suben los datos locales, si no se cargan los de la cuenta.
55. **Con cuenta y sin red**: sesión recordada en `drawer.user`, instantánea en IndexedDB, el chip cuenta cambios pendientes, y al volver la red se hace `flush()` **antes** de `pullAll()`.
56. `file_handlers` del manifiesto: doble clic en un `.drawer` lo abre en la app instalada.

**PWA, ventanas, temas y vista**
57. PWA instalable: `manifest.webmanifest`, iconos, service worker `public/sw.js` que sirve lo cacheado si la red falla o tarda más de 4 s.
58. **Ventanas separadas**: `/ventana/sidebar`, `/ventana/inspector`, `/ventana/board`; comparten datos y selección en tiempo real (localStorage + BroadcastChannel) y se puede arrastrar de una ventana a otra.
59. **Tema** claro / oscuro / sistema (☀ ☾ ◐, ciclo system → light → dark → system).
60. **Modo zen** (◻ Zen o Ctrl+Shift+F, Esc para salir) y **pantalla completa** (⤢).
61. Paneles laterales plegables: ◧ librería (Ctrl+J), ◨ inspector (Ctrl+B), Ctrl+\ ambos; doble clic en un componente reabre el inspector.
62. Paneles redimensionables arrastrando la barra (mínimo 200 px librería, 260 px inspector; doble clic = ancho por defecto).
63. **Dos zooms independientes**: Diagrama 25 %–200 % (Ctrl+rueda centrado en el puntero, Ctrl+, Ctrl−, Ctrl 0, ajuste al ancho) y Títulos 50 %–300 % (capas, etapas y grupos, compensado).
64. **Cabeceras fijas** (⇤ columna de capas, ⤒ fila de etapas y grupos), activables por separado, también desde el clic derecho; nombres pegajosos dentro de su bloque (`.lh-stick`, `.sh-stick`). Vienen activadas. La columna de capas se suelta por encima del 100 % por un fallo de hit-testing de Chrome con `sticky` + `zoom`.
65. **Inspector por pestañas** en un componente: 📋 Datos · ◫ Sitio · 👥 Personas · 🎨 Estilo · ⚙ Más; el nombre siempre a la vista y cada pestaña con su contador.
66. **Menú contextual** (clic derecho) sobre componente, celda, capa, etapa, flecha, tipo, componente de librería o título de librería.
67. **Diagramas públicos** `/p/<id>`: botón 🔗 Compartir (barra, inspector del diagrama y lista `/cuenta/diagramas` con columna de publicados). El visitante ve ficha de componente, leyenda de colores, zoom, mover lienzo y **recolocar un componente dentro de su propia celda** (cambio local, se pierde al recargar). Se publica sólo diagrama + componentes usados + personas asignadas sin correo + reglas. Requiere sincronización con cuenta.
68. Deshacer / rehacer con historial (`past` / `future`).
69. Import/export JSON: exportar todo, exportar sólo el diagrama actual (con los componentes/tipos que usa), importar JSON (fusiona). Formato `{ app: 'diagramador', version: 1, libraries, diagrams }`, el mismo para app, `/export`, `/import` y ficheros `.drawer` (que añaden `currentDiagramId`).
70. Ejemplos incluidos (menú Ejemplos…): «Ejemplo básico: flujo de pedido».
71. Capas por defecto en diagramas nuevos: Sub Procesos, APIs Experiencia, APIs Proceso, APIs Negocio, APIs Sistema (SYS), BACKEND.
72. Copiar / cortar / pegar instancias y componentes en la celda activa; `paste(true)` pega ya desvinculado.
73. Impresión sólo del tablero.

**Cuenta y plataforma**
74. Registro e inicio de sesión con correo y contraseña (👤).
75. Páginas `/cuenta/:tab`: 👤 perfil · 🔑 keys · ◫ diagramas · 📚 bibliotecas · 🏷 tipos · ⚙ config · 🤖 agentes.
76. API keys `dgk_…` (guardadas como hash SHA-256): crear y eliminar.
77. Cambio de contraseña, ajustes de cuenta y borrado de cuenta.
78. Documentación para agentes: `public/agent.md` (https://draw.bezenti.com/agent.md), `public/openapi.json`, `SKILL.md` (skill `diagramador` para agentes vía API key) y `CONTEXT.md` (contexto del dominio).
79. Backend: Cloudflare Worker + Hono; Durable Object con SQLite (`users`, `api_keys`, `docs`); contraseñas PBKDF2, sesiones HMAC con `SESSION_SECRET`.

## 1.3 Rutas de la app (React Router)

`/home/maka/projects/all-draw/_research/diagramador/src/routes.tsx`

- `/d/:id` — editor (`/` redirige al diagrama actual)
- `/cuenta/:tab` — perfil · keys · diagramas · bibliotecas · tipos · config · agentes
- `/ventana/:view` — sidebar · inspector · board
- `/p/:id` — vista pública de sólo lectura
- Cualquier otra ruta redirige a `/`

## 1.4 Atajos de teclado — LISTA COMPLETA (35 filas)

`/home/maka/projects/all-draw/_research/diagramador/src/components/Shortcuts.tsx` (`MOD` = ⌘ en Mac, Ctrl en el resto)

**Grupo «Tablero» (16)**
1. Clic en una celda — Activa la celda (destino de pegar y de nuevos componentes)
2. Ctrl+C / Ctrl+X — Copiar / cortar la instancia o el componente seleccionado
3. Ctrl+V — Pegar en la celda activa (o junto a la instancia seleccionada)
4. Ctrl+Shift+V — Pegar como copia independiente (pega y desvincula de una vez)
5. Ctrl+D — Duplicar la instancia seleccionada en su celda
6. Ctrl+Shift+D — Desvincular: la instancia pasa a una copia independiente del componente
7. Ctrl+Enter — Nuevo componente en la celda activa
8. Flechas · Shift+flechas — Mover la instancia 8 px · 1 px
9. Supr / Retroceso — Borrar la instancia o relación seleccionada
10. F2 — Editar el nombre de lo seleccionado (en el inspector)
11. Doble clic — Abrir el inspector sobre ese componente
12. Clic derecho — Menú contextual del componente, celda, capa, etapa o flecha
13. Ctrl+arrastrar — Clonar la instancia al soltarla
14. Arrastrar desde ● — Crear una relación hasta otro componente
15. Espacio + arrastrar — Mover el lienzo (también con el botón central o arrastrando en zona libre)
16. Esc — Quitar selección · cerrar ayuda / cuenta / zen

**Grupo «Edición» (3)**
17. Ctrl+Z — Deshacer
18. Ctrl+Shift+Z · Ctrl+Y — Rehacer
19. Alt+N — Nuevo diagrama

**Grupo «Archivos y modo local» (6)**
20. Ctrl+S — Guardar en el archivo vinculado (o elegir uno la primera vez)
21. Ctrl+O — Abrir un archivo de tu equipo y trabajar sobre él
22. Ctrl+Shift+O — Importar un JSON y fusionarlo con lo que ya tienes
23. Ctrl+E · Ctrl+Shift+E — Descargar el diagrama actual · descargar todo
24. Chip 💾 / 📄 de la barra — Dónde se guardan los datos: navegador, archivo o cuenta
25. Botón 🖼 Imagen — PNG ×1 / ×2 / ×3, SVG, copiar al portapapeles o imprimir en PDF

**Grupo «Paneles y vista» (10)**
26. Ctrl+B · Ctrl+J — Mostrar/ocultar inspector · librería
27. Ctrl+\ — Mostrar/ocultar ambos paneles
28. Ctrl+K — Buscar en la librería
29. Alt+1 · Alt+2 — Pestaña Componentes · Tipos de la librería
30. Clic en el título de una librería — Plegar / desplegar esa librería
31. Botones ⇤ ⤒ — Fijar la columna de capas y la fila de etapas al hacer scroll
32. Ctrl+rueda — Zoom del diagrama (no de la interfaz)
33. Ctrl++ · Ctrl+− · Ctrl+0 — Acercar · alejar · volver al 100 %
34. Ctrl+Shift+F — Modo zen (sólo el tablero)
35. ? — Esta ayuda

## 1.5 Barra superior (TopBar) — controles completos

`/home/maka/projects/all-draw/_research/diagramador/src/components/TopBar.tsx`

Marca «◫ Drawer» · selector de diagrama actual · + Nuevo · Duplicar · Eliminar · selector de Ejemplos · ↶ Deshacer · ↷ Rehacer · ⤓ Importar · ⤒ Diagrama · ⤒ Todo · chip de almacenamiento (`StorageChip`) · botón de imagen (`ExportImageButton`) · botón compartir (`ShareButton`) · ◧ librería + ⧉ ventana · ◨ inspector + ⧉ ventana · ▣⧉ tablero en otra ventana · ⇤ fijar capas · ⤒ fijar etapas · ◻ Zen · ⤢ pantalla completa · ⌨ atajos · ☀/☾/◐ tema · 👤 Cuenta (con ● si hay cambios pendientes).

## 1.6 Menú contextual

`/home/maka/projects/all-draw/_research/diagramador/src/components/ContextMenu.tsx` es sólo el renderizador genérico (`openMenu(e, items, title)`, items con `label`, `hint`, `title`, `danger`, `disabled`, separadores `sep`, autocolocación dentro de la ventana, cierre con Esc / pointerdown fuera / blur / resize / scroll).

Zonas que lo abren (9 puntos de llamada): `ExportImage.tsx` (título «Imagen del diagrama»), `Storage.tsx` («Dónde se guarda»), `Board.tsx` ×6 (instancia, celda, capa, etapa, flecha, grupo) y `Sidebar.tsx` ×6 (componente, tipo, API, librería, personas, cabecera).

Etiquetas presentes en el código: Editar en el inspector (×6) · Personas… (×5) · Renombrar (×3) · Ordenar celda (×3) · Copiar (×3) · 👥 Personas (×2) · Ver y editar la API… (×2) · Quitar de la celda (×2) · Eliminar de la librería (×2) · Duplicar aquí (×2) · Cortar · Pegar aquí · Pegar en esta celda · Pegar aquí como copia independiente · Colocar como copia independiente · Duplicar · Duplicar componente · Desvincular esta instancia · Desvincular en este diagrama · Separar todas las instancias de este componente · Nuevo componente aquí · Nueva librería · Renombrar librería · Ver sólo esta librería · Plegar todas · Desplegar todas · Añadir capa · Añadir etapa · Eliminar capa · Eliminar etapa · Ancho de la etapa automático · Ancho automático · Nuevo grupo con esta etapa · Sacar del grupo · Deshacer el grupo · Editar grupos en el inspector · Sacar del contenedor · Invertir sentido · Eliminar flecha · Quitar conexión por campos · Request body · Response body · Nota de esta instancia… · Esta API aún no tiene operaciones · ⧉ Duplicar API · ⤓ Importar OpenAPI aquí · ⤒ Exportar OpenAPI · Eliminar API · Eliminar tipo · Eliminar regla · Eliminar persona · Eliminar librería · Más prioridad · Menos prioridad · 📋 Datos · ◫ Sitio · 🎨 Estilo · ⚙ Más · 🖼 PNG ×1 / ×2 / ×3 · ◇ SVG · 📋 Copiar al portapapeles · 🖨 Imprimir o guardar en PDF · 💾 Guardar en el archivo · 📄 Guardar en un archivo… · 📂 Abrir un archivo… · ⇲ Guardar una copia como… · ↻ Recargar desde el archivo · ✕ Desvincular el archivo · ⤓ Importar y fusionar JSON… · ⤒ Descargar copia de todo · ⬇ Descargar Drawer como archivo · 👤 Perfil · 🔑 API keys · ◫ Diagramas · 📚 Bibliotecas · 🏷 Tipos · ⚙ Configuración · 🤖 Agentes / API.

## 1.7 Acciones de `actions.ts` — LISTA COMPLETA (98)

`/home/maka/projects/all-draw/_research/diagramador/src/actions.ts` — 757 líneas, objeto `actions` exportado (97 públicas + 1 helper interno `_cloneTree`).

*Diagramas (5):* newDiagram, duplicateDiagram, deleteDiagram, setCurrent, setPublic
*Capas y etapas (9):* addStage, addLayer, deleteStage, deleteLayer, reorder, renameStage, renameLayer, setStageWidth, setLayerHeight
*Grupos de etapas (6):* addStageGroup, renameStageGroup, colorStageGroup, setStageGroupRange, setStageGroup, deleteStageGroup
*Capas (1):* colorLayer
*Instancias (13):* place, placeInto, _cloneTree (interna), clonePlacement, movePlacement, nestPlacement, unnest, quickAddChild, nudge, setPos, tidyCell, removePlacement, quickAdd
*Relaciones (4):* addRelation, updateRelation, swapRelation, deleteRelation
*Librerías (3):* newLibrary, renameLibrary, deleteLibrary
*Componentes (12):* addComponent, updateComponent, setField, duplicateComponent, detachComponent, canDetach, usedInDiagrams, instancesHere, splitInstances, detachSelected, moveComponentToLib, deleteComponent
*Tipos y campos (8):* addType, addApiType, addContractFields, updateType, addField, updateField, deleteField, deleteType
*Reglas de estilo (10):* addRule, updateRule, setRuleStyle, duplicateRule, deleteRule, addCondition, updateCondition, deleteCondition, moveRule, rulesFromField
*Personas (7):* addPerson, updatePerson, deletePerson, assign, unassign, updateAssignment, usedRoles
*APIs y operaciones (14):* addApi, updateApi, duplicateApi, deleteApi, addOperation, updateOperation, duplicateOperation, deleteOperation, moveOperation, placeApi, setPlacementOperation, setPlacementNote, importOpenApi, exportOpenApi
*Import/export y ejemplos (4):* exportAll, exportCurrent, importJson, loadExample
*Historial (2):* redo, undo

## 1.8 API REST `/api/v1` — LISTA COMPLETA DE ENDPOINTS (72)

`/home/maka/projects/all-draw/_research/diagramador/worker/index.ts` (Hono; auth por cookie de sesión HMAC o `Authorization: Bearer dgk_…`)

*Salud y auth (8):*
1. `GET /health`
2. `POST /auth/register`
3. `POST /auth/login`
4. `POST /auth/logout`
5. `GET /auth/me`
6. `PUT /auth/password`
7. `PUT /auth/settings`
8. `DELETE /auth/account`

*API keys (3):*
9. `GET /api-keys`
10. `POST /api-keys`
11. `DELETE /api-keys/:id`

*Reglas de estilo (6):*
12. `GET /rules`
13. `POST /rules`
14. `GET /rules/:id`
15. `PUT /rules/:id`
16. `PATCH /rules/:id`
17. `DELETE /rules/:id`

*APIs del catálogo (10):*
18. `GET /apis`
19. `POST /apis`
20. `GET /apis/:id`
21. `PUT /apis/:id`
22. `PATCH /apis/:id`
23. `DELETE /apis/:id`
24. `GET /apis/:id/operations`
25. `POST /apis/:id/operations`
26. `PUT /apis/:id/operations/:opId`
27. `DELETE /apis/:id/operations/:opId`

*Personas (9):*
28. `GET /people`
29. `POST /people`
30. `GET /people/:id`
31. `PUT /people/:id`
32. `PATCH /people/:id`
33. `DELETE /people/:id`
34. `POST /people/:id/assignments`
35. `DELETE /people/:id/assignments/:aid`

*Bibliotecas (6 + 6 sub-recursos generados en bucle sobre `['types','components']`):*
36. `GET /libraries`
37. `POST /libraries`
38. `GET /libraries/:id`
39. `PUT /libraries/:id`
40. `PATCH /libraries/:id`
41. `DELETE /libraries/:id`
42. `POST /libraries/:id/types`
43. `PUT /libraries/:id/types/:itemId`
44. `DELETE /libraries/:id/types/:itemId`
45. `POST /libraries/:id/components`
46. `PUT /libraries/:id/components/:itemId`
47. `DELETE /libraries/:id/components/:itemId` (borra en cascada sus instancias y relaciones en todos los diagramas)

*Diagramas (6 + 15 sub-recursos generados en bucle sobre `SUBS` = layers, stages, stageGroups, placements, relations):*
48. `GET /diagrams`
49. `POST /diagrams`
50. `GET /diagrams/:id`
51. `PUT /diagrams/:id`
52. `PATCH /diagrams/:id`
53. `DELETE /diagrams/:id`
54. `POST /diagrams/:id/layers` · 55. `PUT /diagrams/:id/layers/:itemId` · 56. `DELETE /diagrams/:id/layers/:itemId`
57. `POST /diagrams/:id/stages` · 58. `PUT /diagrams/:id/stages/:itemId` · 59. `DELETE /diagrams/:id/stages/:itemId`
60. `POST /diagrams/:id/stageGroups` · 61. `PUT /diagrams/:id/stageGroups/:itemId` · 62. `DELETE /diagrams/:id/stageGroups/:itemId`
63. `POST /diagrams/:id/placements` · 64. `PUT /diagrams/:id/placements/:itemId` · 65. `DELETE /diagrams/:id/placements/:itemId` (cascada a hijos y relaciones)
66. `POST /diagrams/:id/relations` · 67. `PUT /diagrams/:id/relations/:itemId` · 68. `DELETE /diagrams/:id/relations/:itemId`

*Export / import / público (4):*
69. `GET /export` (libraries, diagrams, people, rules, apis)
70. `GET /diagrams/:id/export` (sólo los componentes/tipos usados)
71. `POST /import`
72. `GET /public/diagrams/:id` (sin sesión, sólo si `diagram.public === true`)

Validaciones del Worker: `placements` exige que `layerId` y `stageId` existan en el diagrama; `relations` exige que `from`/`to` sean ids de placements del diagrama. `ASSIGN_KINDS` = component, diagram, layer, stage, type. Tipos de documento (`Kind`, 5): library, diagram, person, rule, api.

## 1.9 Conteos Drawer

| Métrica | Valor |
|---|---|
| Acciones en `actions.ts` | **98** (97 públicas + 1 interna) |
| Endpoints REST (expandiendo bucles) | **72** (57 declaraciones `app.*` en el fichero) |
| Filas de atajos en `Shortcuts.tsx` | **35** (4 grupos: 16 / 3 / 6 / 10) |
| Tipos de campo (`FieldKind`) | 10 |
| Campos de contrato API | 19 |
| Propiedades pintables (`STYLE_PARTS`) | 16 |
| Fuentes de condición / operadores | 7 / 10 |
| Tipos de asignación / roles sugeridos | 5 / 11 |
| Modos de persistencia | 5 |
| Formatos de exportación de imagen | 6 (PNG ×1/×2/×3, SVG, portapapeles, PDF) |
| Estilos / direcciones de relación | 3 / 3 |
| Métodos HTTP | 7 |
| Rutas de app (patrones) | 4 + fallback |
| Pestañas de cuenta | 7 |
| Vistas de ventana separada | 3 |
| Pestañas del inspector de componente | 5 |
| Tipos de documento del backend | 5 |

---

# PARTE 2 — ARCHIFY (skill)

Raíz: `/home/maka/projects/all-draw/_research/archify/archify` — versión **2.17**, autor tt-a1i, licencia MIT, basado en Cocoon-AI/architecture-diagram-generator v1.0.

Nota: no existe directorio `viewer/` ni `README.md` raíz. El runtime del viewer está embebido en `assets/template.html` (774 KB) y documentado en `references/viewer-runtime.md`. Los READMEs son: `schemas/README.md`, `brand-marks/README.md`, `renderers/{workflow,sequence,dataflow,lifecycle}/README.md`.

## 2.1 Comandos CLI — LISTA COMPLETA CON FLAGS (17)

`/home/maka/projects/all-draw/_research/archify/archify/bin/archify.mjs` (función `usage()` líneas 15-36, dispatch líneas 2079-2130)

1. `archify render <type> <input.json> [output.html]` — `--quality standard|showcase`, `--repo-root <path>` (sólo architecture)
2. `archify compare architecture <base.json> <head.json> [output.html]` — `--receipt <path>`, `--json`, `--quality standard|showcase`, `--repo-root <path>`
3. `archify deliver <type> <input.json> [output.html]` — `--json`, `--open`, `--quality standard|showcase`, `--repo-root <path>` (sólo architecture)
4. `archify preview <type> <input.json> [output.html]` — `--no-open`, `--quality standard|showcase`, `--repo-root <path>` (sólo architecture)
5. `archify validate <type> <input.json>` — `--json`, `--layout-json`, `--quality standard|showcase`, `--repo-root <path>` (sólo architecture)
6. `archify migrate workflow <old.json> <new.json>` — `--to-schema 2` (obligatorio), `--json`
7. `archify inspect <type> <input.json>`
8. `archify check <output.html>`
9. `archify visual-check <output.html>` — `--json`
10. `archify guide [escenario o pregunta]` — `--json`, `--lang en|zh`
11. `archify brands [nombre, alias, dominio o categoría]` — `--json`
12. `archify brands capture <url>` — `--json`
13. `archify examples`
14. `archify doctor`
15. `archify demo [directorio-de-salida]`
16. `archify help` / `-h` / `--help`
17. (auxiliar interno, no en `usage()`): `scripts/check-update.mjs` — `--ack "<eventKey>"`

Tipos aceptados (5): `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`.
Binarios auxiliares: `bin/open-artifact.mjs`, `bin/preview.mjs`, `bin/visual-check.mjs`.

## 2.2 Enums compartidos (`common.schema.json`)

`/home/maka/projects/all-draw/_research/archify/archify/schemas/common.schema.json`

- `componentType` (7): `frontend`, `backend`, `database`, `cloud`, `security`, `messagebus`, `external`
- `variant` (4): `default`, `emphasis`, `security`, `dashed`
- `side` (4): `left`, `right`, `top`, `bottom`
- `locale` (2): `en`, `zh-CN`
- `animation` (2): `trace`, `none`
- `visualPreset` (4): `classic`, `signal-flow`, `blueprint`, `editorial`
- `qualityProfile` (2): `standard`, `showcase`
- `legendMode` (3): `auto`, `all`, `hidden`
- `cards[].dot` (7 colores): `cyan`, `emerald`, `violet`, `amber`, `rose`, `orange`, `slate`
- `legendEntry`: `label` (string), `visible` (boolean)
- `guidedViews[]`: `id`*, `label`*, `focus`* (array de IDs), `note` — máximo 5
- `cards[]`: `dot`*, `title`*, `items`*
- `brandMark`: `{ url`*, `sha256`* `}`
- `point`: array [x, y]; `id`: string con patrón; `relationshipWidth`: number

**`meta` común a los 5 tipos**: `title`*, `locale`, `subtitle`, `output`, `animation`, `visual_preset`, `quality_profile`, `views`, `legend {mode, entries}`, `viewBox`. `additionalProperties: false` en todos los niveles.

## 2.3 ARCHITECTURE

`/home/maka/projects/all-draw/_research/archify/archify/schemas/architecture.schema.json` — `schema_version: 1` (const)

**Arrays estructurales**: `components`*, `boundaries`, `connections`, `cards`

**Nodo (`components[]`)**: `id`*, `type`* (7 componentType), `label`*, `sublabel`, `tag`, `brand`, `sources[]` (`path`*, `line`, `end_line`, `label`), `row`, `col`, `pos` (point), `size` (array)

**Arista (`connections[]`)**: `id`, `from`*, `to`*, `label`, `variant` (4), `fromSide`, `toSide` (4 sides), `route` (**4**: `auto`, `straight`, `orthogonal-h`, `orthogonal-v`), `via[]`, `labelAt` (point), `labelDx`, `labelDy`, `labelSegment`, `width`

**Contenedor (`boundaries[]`)**: `kind`* (**2**: `region`, `security-group`), `label`*, `wraps`* (array de IDs), `pad`

**`layout`**: `mode`* (**1**: `grid`), `origin`, `cols`, `gapX`, `gapY`, `cellW`, `cellH`

**`meta` propio**: `engineering_profile` (**1**: `deployment-ownership`), `repository { url`*, `provider` (`github`|`gitee`), `link_mode` (`web`|`local-only`), `revision`* `}`

**Claves de leyenda (7)**: frontend, backend, database, cloud, security, messagebus, external

## 2.4 WORKFLOW

`/home/maka/projects/all-draw/_research/archify/archify/schemas/workflow.schema.json` — `schema_version`: **1 o 2** (único tipo con dos versiones)

**Arrays estructurales**: `lanes`*, `phases`, `groups`, `mainPath`, `nodes`*, `edges`*, `semanticChecks`, `cards`

**Nodo (`nodes[]`)**: `id`*, `lane`*, `col`*, `type`* (7 componentType), `label`*, `sublabel`, `tag`, `brand`, `width`, `height`, `yOffset`

**Arista (`edges[]`)**: `id`, `from`*, `to`*, `label`, `variant` (4), `role` (**5**: `main`, `branch`, `async`, `return`, `error`), `fromSide`, `toSide`, `route` (**7**: `auto`, `straight`, `drop`, `outside-right`, `return-left`, `bottom-channel`, `up-channel`), `via[]`, `labelAt`, `labelDx`, `labelDy`, `labelSegment`, `channelX`, `channelY`, `bias`, `width`

**Contenedores**: `lanes[]` = `id`*, `label`*, `variant` (**2**: `normal`, `exception`) · `phases[]` = `id`*, `label`*, `fromCol`*, `toCol`*, `variant` (4) · `groups[]` = `id`*, `label`*, `lane`*, `fromCol`*, `toCol`*, `variant` (4)

**`semanticChecks`**: `allowedRoots[]`, `allowedTerminals[]`, `requiredEdges[]` (`semanticRelation {from*, to*}`), `requiredPaths[]`

**Claves de leyenda (7)**: frontend, backend, security, messagebus, database, cloud, external

## 2.5 SEQUENCE

`/home/maka/projects/all-draw/_research/archify/archify/schemas/sequence.schema.json` — `schema_version: 1`

**Arrays estructurales**: `participants`*, `segments`, `messages`*, `activations`, `cards`

**Nodo (`participants[]`)**: `id`*, `type`* (7 componentType), `label`*, `sublabel`, `brand`

**Arista (`messages[]`)**: `id`, `from`*, `to`*, `y`*, `label`*, `variant` (**5**, propio: `default`, `emphasis`, `security`, `dashed`, **`return`**), `note`

**Contenedores**: `segments[]` = `from`*, `to`*, `label`* · `activations[]` = `participant`*, `from`*, `to`*, `type` (7 componentType)

**`meta` propio**: `column_fit` (**2**: `fixed` por defecto — gap 108 px y cajas 86 px fijos —, `spread` — deriva gap y anchura del viewBox)

**Claves de leyenda (5)**: emphasis, return, security, dashed, default

## 2.6 DATAFLOW

`/home/maka/projects/all-draw/_research/archify/archify/schemas/dataflow.schema.json` — `schema_version: 1`

**Arrays estructurales**: `stages`*, `nodes`*, `flows`*, `cards`

**Nodo (`nodes[]`)**: `id`*, `type`* (7 componentType), `label`*, `sublabel`, `tag`, `brand`, `stage`*, `row`*, `width`, `height`, `yOffset`

**Arista (`flows[]`)**: `id`, `from`*, `to`*, `label`* (obligatorio aquí), `classification`, `variant` (4), `route` (**5**: `auto`, `straight`, `vertical-channel`, `bottom-channel`, `top-channel`), `fromSide`, `toSide`, `channelX`, `channelY`, `labelAt`, `labelDx`, `labelDy`, `labelSegment`, `via[]`, `width`

**Contenedor**: `stages[]` = `label`*

**Claves de leyenda (5)**: emphasis, security, dashed, database, default

## 2.7 LIFECYCLE

`/home/maka/projects/all-draw/_research/archify/archify/schemas/lifecycle.schema.json` — `schema_version: 1`

**Arrays estructurales**: `lanes`*, `states`*, `transitions`*, `cards`

**Nodo (`states[]`)**: `id`*, `type`* (**8 propios**: `start`, `active`, `waiting`, `decision`, `success`, `failure`, `neutral`, `external`), `label`*, `sublabel`, `tag`, `brand`, `step`, `lane`*, `col`*, `width`, `height`, `yOffset`

**Arista (`transitions[]`)**: `id`, `from`*, `to`*, `label`, `note`, `variant` (4), `route` (**7**: `auto`, `straight`, `drop`, `bottom-channel`, `top-channel`, `right-channel`, `left-channel`), `fromSide`, `toSide`, `channelX`, `channelY`, `cornerRadius`, `labelAt`, `labelDx`, `labelDy`, `labelSegment`, `via[]`, `width`

**Contenedor**: `lanes[]` = `id`*, `label`*

**Claves de leyenda (8)**: start, active, waiting, decision, success, failure, neutral, external

**Regla de geometría**: columnas de fase `0..4` ocupan el raíl principal; columna de evento/terminal `N` en `0..2` se alinea exactamente bajo la columna principal `N + 2`. Un estado recuperable usa `type: "failure"` más una transición real de vuelta al estado activo.

## 2.8 Funciones del viewer HTML — LISTA COMPLETA

Fuentes: `/home/maka/projects/all-draw/_research/archify/archify/references/viewer-runtime.md` y los IDs/handlers de `/home/maka/projects/all-draw/_research/archify/archify/assets/template.html`

**Tema y presentación visual**
1. **Theme light/dark** — botón `#btn-theme` (`#theme-icon`, `#theme-label`); respeta `prefers-color-scheme` (7 apariciones) y persiste en `localStorage`.
2. **Presets visuales (4)** — botón `#btn-preset` + menú `#preset-menu` (`#preset-label`): `classic` (defecto estable), `signal-flow` (luminoso, orientado a movimiento), `blueprint` (alto contraste, revisión de ingeniería), `editorial` (cálido, publicación/documentación). Independiente del modo de color: cambiar Light/Dark conserva el preset.
3. **Present mode / Presentation Stage** — botón `#btn-present` (`#present-icon`, `#present-label`). Cambia el cromo y el encuadre del viewer, nunca la geometría autoral. No es una función móvil.

**Exportación (menú `#btn-export` → `#export-menu`)**
4. **PNG de diagrama completo** — copiar al portapapeles y descargar.
5. **JPEG** (`image/jpeg`).
6. **WebP** (`image/webp`).
7. **SVG dual-theme** (un solo SVG válido en claro y oscuro).
8. **WebM** — grabación del trace vía `MediaRecorder` (sólo con `animation: "trace"`).
9. **Share Card** — PNG 1200×630 para README, release, social o launch; usa el tema y preset actuales, contiene el diagrama canónico completo sin recortar, nunca reclama validación. `data-action="copy-share-card"` reutiliza el mismo PNG canónico cuando el portapapeles admite imágenes.
10. **Route Share Card** — `data-action="route-share-card"`; tras un Route Probe dirigido real. Reutiliza la instantánea ordenada exacta de la ruta, seam `format=share-card`, `variant=route`, decoración estática `data-share-route-*`. Sólo descarga; falla cerrado ante rutas obsoletas/inalcanzables/conflictivas.
11. **Reach Share Card** — `data-action="reach-share-card"`; tras una consulta de alcanzabilidad autoral no vacía. Consume el conjunto ya resuelto de nodos/aristas upstream/downstream sin re-recorrer; `format=share-card`, `variant=reach`, decoración `data-share-reach-*`. Sólo descarga. Se llama *alcanzabilidad autoral*, no impacto ni blast radius.
12. **Higiene de exportación canónica** — Guide, Lens, finder, focus, route, story, cámara, radar, presentación, propiedad de movimiento y superposiciones temporales se eliminan de la exportación canónica.

**Exploración y semántica**
13. **Diagram Guide** — panel `#diagram-guide` (`#diagram-guide-title`, `#diagram-guide-actions`, `#diagram-guide-stats`, `#diagram-guide-feedback`, `#diagram-guide-story-copy`, `#diagram-guide-close`); lista acciones y atajos actuales.
14. **Reading Depth** — arranca en READ al 100 %, revela FULL detail al 175 %, cae a MAP por debajo del 100 %. Focus, story, route y semantic revelan sus hechos exactos a cualquier escala.
15. **Semantic Lens** — `#btn-semantic-lens`, panel `#semantic-lens` (`#semantic-lens-kinds`, `#semantic-lens-status`, `#semantic-lens-copy`, `#semantic-lens-clear`, `#semantic-lens-close`, `#relationship-lens-list`, `#relationship-lens-title`). Resume tipos de nodo/relación seleccionados sin alterar la geometría autoral.
16. **Intent Trace** — `#intent-trace-status`; previsualiza el objetivo de puntero fino o teclado antes del focus comprometido.
17. **Node Finder** — `#btn-node-finder`, panel `#node-finder` (`#node-finder-input`, `#node-finder-results`, `#node-finder-status`, `#node-finder-empty`, `#node-finder-title`, `#node-finder-close`). Busca por etiquetas e IDs estables.
18. **Semantic Passport / Focus** — se abre al hacer focus: `#focus-label`, `#focus-kind`, `#focus-id`, `#focus-tag`, `#focus-brand`, `#focus-summary`, `#focus-detail`, `#focus-context`, `#focus-chip`, `#focus-passport-meta`, `#focus-evidence`, `#focus-evidence-links`, `#focus-repository`. Muestra hechos autorales upstream/downstream, admite enlace profundo copiable (`#btn-focus-copy`), acción explícita de cierre (`#btn-focus-clear`), se cierra por activación externa real y Escape, y nunca entra en la exportación canónica. `#btn-focus-relations` traza relaciones.
19. **Reachability (upstream/downstream)** — `#btn-reach-upstream`, `#btn-reach-downstream`, `#focus-reach`, `#focus-reach-upstream-count`, `#focus-reach-downstream-count`, `#focus-reach-status`.
20. **Semantic Radar / Overview Map (minimapa)** — `#btn-overview-map`, `#overview-map` (`#overview-map-surface`, `#overview-map-status`, `#overview-map-expand`, `#overview-map-feedback`, `#overview-map-title`, `#overview-map-close`). Refleja el viewport visible y el grafo autoral sin convertirse en segunda fuente de verdad.
21. **Route Probe** — `#btn-route-probe`, panel `#route-probe` (`#route-probe-find`, `#route-probe-path`, `#route-probe-status`, `#route-probe-copy`, `#route-probe-clear`, `#route-probe-title`). Resuelve exactamente dos extremos sobre relaciones dirigidas autorales; nunca infiere una ruta desde la geometría.
22. **Route Journey** — reproducción de ruta: `#route-journey-controls`, `#route-journey-play` (`#route-journey-play-icon`, `#route-journey-play-label`), `#route-journey-prev`, `#route-journey-next`, `#route-journey-overview`.
23. **Direct Relationship Pin** — hace operable una relación compilada única preservando la línea autoral y la identidad estable de la relación; falla cerrado ante metadatos de origen/destino/etiqueta/ID en conflicto.

**Guided views / chapters / story**
24. **Guided views (máx. 5 capítulos)** desde `meta.views` — `#guided-views`, `#guided-view-chapters`, `#guided-view-label`, `#guided-view-note`, `#guided-view-index`, `#guided-view-count`, `#guided-view-all`, `#guided-view-prev`, `#guided-view-next`, `#guided-view-trail`, `#guided-view-progress-bar`, `#guided-view-handoff`.
25. **Named Chapter Rail** — raíl de capítulos nombrados.
26. **Chapter Delta Preview** — previsualización del delta entre capítulos.
27. **Story Beat Navigator** — `#guided-view-beat-link`, `#guided-view-beat-link-label`, `#resetBeatLinkFeedback`.
28. **Story Follow Camera** — cámara que sigue la historia.
29. **Story Director Strip** — tira de dirección.
30. **Story Horizon**.
31. **Shareable Story Moment** — enlaces de momento compartible; `#share-chapter-label`, `#share-chapter-count`, `#share-chapter-cue`, `#share-chapter-note`, `#share-chapter-route`, `#share-chapter-state`, `#share-chapter-progress-bar`.
32. **Story caption** — `#guided-story-caption` (`-index`, `-detail`, `-next`, `-next-label`, `-route`).
33. **Playback** — `#guided-view-play` (`-icon`, `-label`); iniciado por el lector, acotado, a prueba de estado obsoleto y gobernado por movimiento. Las transiciones clasifican sólo la relación exacta entre paradas adyacentes: forward, reverse, multiple, o agrupada/sin enlace directo. Nunca se infiere arista transitiva, verbo, causalidad ni comportamiento en ejecución.

**Cámara, zoom y navegación**
34. **Zoom in / out / reset** — `zoomIn()`, `zoomOut()`, `zoom()`, tecla `0` para reset.
35. **Pan** y **fit** — `fitCanvasText()`, `panelRectAt()`, `resetDockingStyles()`.
36. **Recibo de cámara** — `cameraReceipt()`, `cameraAtBaseline()`, `cameraSettled()`.
37. **Navegación por teclado** — ArrowUp/Down/Left/Right, Home, End, Tab, Enter, Escape.

**Movimiento**
38. **Trace motion Live/Still** — `#btn-motion`, `#motion-label`; `meta.animation: "trace"` habilita un trace finito controlado por el lector. Estático es el defecto.
39. **Reduced motion** — `prefers-reduced-motion` (9 reglas). Still, reduced motion, ocultación de página, impresión y exportación canónica preservan el significado estático completo.

**Otras**
40. **Print** — `@media print` con estado estático completo.
41. **Deep links `#relation=<id>`** — enlace estable a una relación con `id` autoral, que sobrevive a reordenaciones del array; los documentos sin `id` mantienen los pins locales a la página.
42. **i18n en / zh-CN** — `meta.locale` controla sólo la UI del viewer propiedad del renderer, la leyenda por defecto, la copia de accesibilidad, el sufijo del título del documento y `<html lang>`. Nunca traduce el contenido autoral. Otros idiomas: omitir `meta.locale` y declarar explícitamente el fallback a inglés. (`renderers/shared/i18n.mjs`, 48 KB)
43. **Leyenda semántica interactiva** — puente de Semantic Legend para entradas respaldadas por hechos de nodo compilados exactos (incluye Dataflow `database` cuando existe un `nodes[].type: "database"` real).
44. **Persistencia de preferencias** — `localStorage` (8 usos).
45. **Atajos de teclado del viewer** — `?` (guía), `/` (finder), `0` (reset zoom), `T` (theme), `F` (focus), `L` (lens), `M` (motion/map), `R` (route), `S` (story), `E` (export), flechas, Home, End, Tab, Enter, Escape.

**Límite de verdad**: las exportaciones del viewer son activos de comunicación; no sustituyen al HTML comprobado, al recibo determinista de `deliver`, ni a una revisión visual real. No se añade servicio alojado, superficie de almacenamiento, dependencia, rama de esquema ni superficie de producto móvil para estas capacidades.

## 2.9 Validaciones — CÓDIGOS DE DIAGNÓSTICO COMPLETOS

Formato de cada diagnóstico: `{ code, severity, message, subject, evidence, supportedFixes }` (`renderers/shared/diagnostics.mjs`, `renderers/shared/validator.mjs`).

**`schema/*` — dinámicos**, generados como `` `schema/${error.keyword}` `` en `/home/maka/projects/all-draw/_research/archify/archify/renderers/shared/validator.mjs:73` a partir de las palabras clave de AJV. Los que tienen mensaje de reparación propio son 8: `schema/enum`, `schema/pattern`, `schema/minimum`, `schema/maximum`, `schema/minItems`, `schema/maxItems`, `schema/minLength`, `schema/maxLength` (además de los genéricos `schema/required`, `schema/type`, `schema/additionalProperties`, etc.).

**`artifact/*` — dinámicos**, generados como `` `artifact/${check.name.replaceAll('_','-')}` `` en `bin/archify.mjs:253`. Los 10 checks de `scripts/check-render-output.mjs` son:
1. `file_readable` → `artifact/file-readable`
2. `single_svg` → `artifact/single-svg`
3. `finite_svg` → `artifact/finite-svg`
4. `orthogonal_arrows` → `artifact/orthogonal-arrows`
5. `relationship_crossings` → `artifact/relationship-crossings`
6. `relationship_corridors` → `artifact/relationship-corridors`
7. `container_border_runs` → `artifact/container-border-runs`
8. `route_rhythm` → `artifact/route-rhythm`
9. `label_route_clearance` → `artifact/label-route-clearance`
10. `legend_clearance` → `artifact/legend-clearance`

(Validación básica reporta 4 checks; una aceptación *showcase* debe reportar los **9** checks de artefacto con 0 errores de composición y 0 avisos.)

**`composition/*` (7)**
1. `composition/ambiguous-corridor`
2. `composition/container-border-run`
3. `composition/desktop-readability`
4. `composition/label-route-clearance`
5. `composition/micro-segment`
6. `composition/proper-crossing`
7. `composition/short-interior-segment`

**`clean-flow/*` (2)**
8. `clean-flow/edge-through-node`
9. `clean-flow/endpoint-side-direction`

**`workflow/*` (13)**
10. `workflow/column-capacity`
11. `workflow/duplicate-lane-id`
12. `workflow/duplicate-node-id`
13. `workflow/explicit-pin-conflict`
14. `workflow/input-contract`
15. `workflow/invalid-node-column`
16. `workflow/node-overlap`
17. `workflow/non-finite-node-geometry`
18. `workflow/route-preset-conflict`
19. `workflow/solver-budget-exhausted`
20. `workflow/unknown-edge-endpoint`
21. `workflow/unknown-node-lane`
22. `workflow/viewbox-capacity`

**`viewer/*` (6)**
23. `viewer/chrome-legend-clearance`
24. `viewer/chrome-stage-clearance`
25. `viewer/chrome-unavailable`
26. `viewer/projected-text-readability`
27. `viewer/viewport-overflow`
28. `viewer/visual-check-runtime`

**`engineering/*` (7)** — perfil `deployment-ownership`
29. `engineering/deployment-boundary-kind`
30. `engineering/deployment-crossing-mechanism`
31. `engineering/deployment-owner-missing`
32. `engineering/deployment-private-region-consistency`
33. `engineering/deployment-private-state`
34. `engineering/deployment-region-ambiguous`
35. `engineering/deployment-region-scope`

**`delivery/*` (7)**
36. `delivery/candidate-unreadable`
37. `delivery/commit`
38. `delivery/evidence-receipt-invalid`
39. `delivery/freeze-specification`
40. `delivery/prepare-candidate`
41. `delivery/prepare-directory`
42. `delivery/receipt-invalid`

**`delta/*` (8)** — comando `compare`
43. `delta/base-input`
44. `delta/candidate-directory`
45. `delta/freeze-snapshot`
46. `delta/head-input`
47. `delta/internal`
48. `delta/output-directory`
49. `delta/receipt-directory`
50. `delta/runtime-missing`

**`migration/*` (7)** — comando `migrate`
51. `migration/commit`
52. `migration/destination-type`
53. `migration/internal`
54. `migration/path-preflight`
55. `migration/prepare-destination`
56. `migration/source-changed`
57. `migration/source-destination`

**`output/*` (7)**
58. `output/input-alias`
59. `output/meta-absolute`
60. `output/meta-extension`
61. `output/meta-outside-cwd`
62. `output/meta-resolved-extension`
63. `output/path-resolution`
64. `output/symlink-cycle`
65. `output/target-alias`  *(8 con este)*

**`cli/*` (6)**
66. `cli/invalid-arguments` (defecto)
67. `cli/invalid-option-value`
68. `cli/missing-option-value`
69. `cli/unknown-diagram-type`
70. `cli/unknown-option`
71. `cli/unsupported-option`
72. `cli/usage`

**`brand/*` (4)**
73. `brand/capture-unavailable`
74. `brand/digest-mismatch`
75. `brand/unknown`
76. `brand/unpinned-url`

**`legend/*` (3)**
77. `legend/content-overlap`
78. `legend/label-too-wide`
79. `legend/vertical-overflow`

**`input/*` (2)**
80. `input/json-parse`
81. `input/read`

**`internal/*` (2)**
82. `internal/renderer-process`
83. `internal/unclassified`

**Otros (4)**
84. `artifact/check-failed`
85. `guided-view/invalid`
86. `layout/constraint`
87. `relationship/duplicate-id`

**Métricas de composición** (`scripts/check-render-output.mjs`, objeto `composition.metrics`, 17): properCrossings, ambiguousCorridors, containerBorderRuns, labelRouteClearanceIssues, minLabelRouteClearance, maxBends, routesOverSuggestedBends, maxStretch, routesOverSuggestedStretch, minSegmentPx, minInteriorSegmentPx, shortSegmentCount, shortEndpointSegmentCount, shortInteriorSegmentCount, microSegmentCount, desktopReadabilityIssues, minProjectedNodeTextPx.

**Límites sugeridos** (`suggestedLimits`, 4): `bendsPerRelationship: 2`, `stretch: 1.35`, `segmentPx: 16`, `microSegmentPx: 8`.

## 2.10 Brands — catálogo

`/home/maka/projects/all-draw/_research/archify/archify/brand-marks/catalog.json` (`schemaVersion` + array `marks`)

**Total: 107 marcas.** Campos por marca: `id`, `title`, `category`, `aliases`, `domains`, `custom`.

Reparto por categoría (9 categorías):
- `engineering`: 18
- `data`: 17
- `ai`: 13
- `cloud`: 13
- `framework`: 13
- `collaboration`: 10
- `channel`: 10
- `business`: 8
- `language`: 5

Marcas vectoriales generadas en `/home/maka/projects/all-draw/_research/archify/archify/renderers/shared/generated-brand-marks.mjs` (163 KB). Captura de marcas desconocidas: `archify brands capture <url> --json` produce un objeto `{ url, sha256 }` con digest fijado; render y validate **nunca** hacen captura de red sin pin.

## 2.11 Documentación de referencia

`/home/maka/projects/all-draw/_research/archify/archify/references/`
- `authoring-contract.md` (14 KB) — enums de campos, matemática de espaciado, reglas de reparación geométrica, evidencia de repositorio, colocación por modo
- `delivery-contract.md` (9,6 KB) — campos canónicos del recibo, cobertura, sidecars, comportamiento de salida, registro manual suplementario, preview, evidencia de exportación, revisión visual, apertura post-commit
- `viewer-runtime.md` (4,2 KB) — capacidades del viewer
- `brand-marks.md` (2,2 KB) — sólo para marca desconocida con URL suministrada por el usuario

## 2.12 Renderers y utilidades

`renderers/`: `architecture/` (render-architecture.mjs 45 KB + grid.mjs), `workflow/`, `sequence/`, `dataflow/`, `lifecycle/` (cada uno con su README de contrato de layout), `shared/` (brand-marks.mjs, cli.mjs, desktop-readability.mjs, diagnostics.mjs, engineering-profiles.mjs, generated-brand-marks.mjs 163 KB, generated-validators.mjs 431 KB, geometry.mjs 57 KB, i18n.mjs 48 KB, layout-report.mjs, legend.mjs, output-path.mjs, validator.mjs).

`scripts/`: check-render-output.mjs (36 KB), check-update.mjs (56 KB), generate-brand-marks.mjs, generate-validators.mjs, render-examples.mjs, update-contract.mjs.
`delta/architecture-delta.mjs` (73 KB) · `recipes/scenarios.mjs` (32 KB, alimenta `archify guide`).
`examples/`: 14 JSON de ejemplo (2 por tipo aprox.) + 5 HTML renderizados.

## 2.13 Conteos finales Archify

| Métrica | Valor |
|---|---|
| Comandos CLI documentados en `usage()` | **16** (+ `help`/`-h`/`--help`) |
| Tipos de diagrama | **5** |
| Esquemas JSON | **6** (5 tipos + `common`) |
| Códigos de diagnóstico estáticos enumerados | **87** |
| Familias de códigos | **17** (schema, artifact, composition, clean-flow, workflow, viewer, engineering, delivery, delta, migration, output, cli, brand, legend, input, internal, layout/guided-view/relationship) |
| Checks de artefacto | **10** definidos (9 exigidos en showcase, 4 en validación básica) |
| Métricas de composición | 17 |
| Límites sugeridos | 4 |
| Marcas en el catálogo | **107** (9 categorías) |
| Tipos de componente (`componentType`) | 7 |
| Tipos de estado lifecycle | 8 |
| Variantes (`variant`) | 4 (+ `return` en sequence = 5) |
| Roles de arista workflow | 5 |
| Rutas: architecture / workflow / sequence / dataflow / lifecycle | 4 / 7 / — / 5 / 7 |
| Presets visuales | 4 |
| Perfiles de calidad | 2 (`standard`, `showcase`) |
| Modos de leyenda | 3 |
| Locales soportados | 2 (`en`, `zh-CN`) |
| Formatos de exportación del viewer | 6 (PNG, JPEG, WebP, SVG dual-theme, WebM, Share Card) + 2 variantes (route, reach) |
| Capítulos guiados máximos | 5 |
| Colores de punto de tarjeta | 7 |
| Versiones de esquema workflow | 2 (v1 y v2) |
| Perfiles de ingeniería | 1 (`deployment-ownership`) |
| Viewports de verificación obligatorios | 3 (1440×900, 1600×1000, 1920×1080) + 1 opcional (2048×1320) |

---

## Nota comparativa rápida para la matriz

Los dos productos resuelven problemas casi disjuntos: **Drawer** es una *aplicación editor* interactiva y persistente (98 acciones de modelo, 72 endpoints REST, multiusuario con cuentas, 5 modos de persistencia, PWA offline) con un modelo de dominio propio (capas × etapas, catálogo de APIs con OpenAPI, reglas de estilo condicional, personas). **Archify** es una *skill CLI generadora* que produce artefactos HTML autocontenidos e inmutables (16 comandos, 5 tipos tipados por esquema JSON estricto, 87 códigos de diagnóstico, viewer de sólo lectura con 45 capacidades de exploración/exportación), sin persistencia, sin cuentas y sin edición interactiva. Drawer edita un modelo vivo; Archify valida y congela una especificación.