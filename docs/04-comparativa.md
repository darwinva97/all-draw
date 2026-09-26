# Comparativa: all-draw frente a las referencias

Fecha: 2026-09-18. Inventarios completos por herramienta en `docs/inventarios/` (Archi, Drawer, archify, y diez herramientas web). Este documento responde a la pregunta "¿soportamos todo lo que soporta ArchiMate (y el resto)?" y fija qué entra en cada fase.

**Estado real hoy: all-draw no tiene código.** Todo lo que aparece como "all-draw" es compromiso de diseño, marcado con la fase del plan (`docs/02-plan.md`) en que se entrega. Leyenda:

- ✔ soportado por la referencia
- ◐ parcial, vía plugin o de pago
- ✘ no
- **F0…F6** fase de all-draw en que se cubre
- **F7+** después de la v1
- **✘ no** decisión explícita de no hacerlo

## 1. ArchiMate: cobertura elemento a elemento

Archi (referencia): 60 tipos de elemento + Junction, 11 relaciones, 25 viewpoints, matriz de validez de 62×62 conceptos, profiles/specializations, properties + features, 3 tipos de vista (ArchiMate, Sketch, Canvas), `DiagramModelReference`, 8 reglas de validador, Open Exchange Format 3.1/3.2, CSV, HTML report, 24 opciones de CLI.

| Área ArchiMate | Archi | all-draw | Cómo |
|---|---|---|---|
| 60 elementos en 8 capas (Strategy 4, Business 13, Application 9, Technology 13, Physical 4, Motivation 10, Impl&Migration 5, Other 2) | ✔ | **F3** completo | Pack `archimate` generado por script desde `ArchimateModelUtils.java` y `archimate.ecore`: cada tipo con capa, categoría (active/passive/behavior/composite), figura por defecto y alternativa (42 con dos variantes), icono. |
| Junction AND / OR | ✔ | **F3** | Tipo `Junction` con campo `type` (and/or) y regla de homogeneidad de relaciones. |
| 11 relaciones con categoría | ✔ | **F3** | `RelationType` por relación; categoría estructural/dependencia/dinámica/otra como tag. |
| Matriz de validez 62×62 con letras `acfginorstv` | ✔ | **F3** | `validityMatrix` del pack generada desde `relationships.xml` (4.034 líneas). Se aplica en `isValidConnection` de React Flow y en el validador. |
| Relaciones sobre relaciones (Association a una relación) | ✔ | **F3** | `Relation.from/to` admiten `{relationId}` además de `{elementId, portId?}`. |
| Access.accessType (write/read/access/readwrite), Influence.strength, Association.directed | ✔ | **F3** | Campos tipados de cada `RelationType`. |
| Anidamiento visual → relación implícita (ARM) | ✔ configurable | **F3** | Regla del pack: al anidar `A` dentro de `B`, proponer relación de la lista permitida (Composition, Aggregation, Assignment, Access, Realization, Specialization) u ocultar la línea. Preferencia por workspace. |
| Relaciones derivadas | ✘ (no hay motor) | **✘ no** en v1 | Igual que Archi. Candidato F7+. |
| 25 viewpoints + "None", macros `$ApplicationElements$` | ✔ | **F3** | `viewpoints[]` generados desde `viewpoints.xml`; filtro suave (atenúa paleta y nodos), regla "arista solo si ambos extremos permitidos". |
| Profiles / specializations con imagen | ✔ | **F3** | `Profile { name, conceptType, image }` en el workspace; referenciado desde `Element.profiles[]`; paleta muestra especializaciones. |
| Properties (usuario) y Features (app) | ✔ | **F1** | `Element.props{}` y `Element.features{}` separados, en todo objeto con id. |
| Documentation en concepto, vista, grupo, nota, conexión | ✔ | **F1** | Campo `doc` (Markdown) en Element, Relation, View, ViewNode de tipo grupo/nota. |
| Folders (8 tipos, anidables) | ✔ | **F2** | Carpetas del explorador de modelo; asignación automática por capa del pack. |
| Vista ArchiMate + Sketch + Canvas en el mismo modelo | ✔ | **F2** | Son tres notation packs (`archimate`, `freeform`, `canvas` con bloques/sticky). Coexisten en el mismo workspace. |
| `DiagramModelReference` (nodo que abre otra vista) | ✔ | **F3** | `ViewNode.detailViewId` + tipo de nodo "referencia a vista" con miniatura. |
| Group, Note (dogear/rect/none, Markdown), Image, Legend | ✔ | **F2** | Nodos de la notación `freeform`, disponibles en cualquier vista. Legend en F3. |
| Atributos gráficos: bounds, fill, alpha, line color/width/style, font, text alignment/position, gradient, icon visible/color, image position (10), locked | ✔ | **F2** | `ViewNode.style{}` con ese conjunto exacto; Features para defaults. |
| Conexiones: bendpoints, label position (source/middle/target), text relative position, line width/color, routers bendpoint/manhattan | ✔ | **F2** bendpoints, label; **F5** router manhattan | React Flow edge custom + `ViewEdge.bendpoints[]`; ortogonal en F5 con elkjs/libavoid. |
| Label expressions `${name}`, `${property:k}`, `${if:…}`, prefijos `$model{}`, `$source{}` | ✔ (12 constructos, 19 prefijos) | **F3** subconjunto (`name`, `type`, `doc`, `property:k`, `properties`, `if`, `nvl`, prefijos `model/view/parent/source/target`) | Motor de plantillas de etiqueta compartido por todos los packs. Prefijos por tipo de relación en F7+. |
| Validador (8 reglas: relación ilegal, elemento sin uso, relación sin uso, vista vacía, concepto fuera de viewpoint, anidamiento sin relación, posible duplicado, junction heterogéneo) | ✔ | **F3** las 8 | Panel de problemas con el contrato de diagnóstico de archify (`code, severity, subject, supportedFixes`). |
| Generate View for element | ✔ | **F3** | "Crear vista desde este elemento" con radio N de relaciones. |
| Magic connector, format painter, marquee 6 modos | ✔ | **F2** magic connector (menú de tipos válidos al soltar); format painter **F6**; marquee básico F2 | |
| Navigator (entrantes/salientes), Model Tree con búsqueda por nombre/doc/propiedad/vista/capa/especialización, regex | ✔ | **F2** árbol y búsqueda por nombre/tipo; **F3** por propiedad/vista/viewpoint; navigator **F3** | |
| Visualiser (Zest, grafo radial con profundidad) | ✔ | **F6** | Vista `graph` con elkjs radial. |
| Open Exchange Format import/export (XSD 3.1/3.2) | ✔ | **F5** | `io/archimate-oef` contra los XSD de `org.opengroup.archimate.xmlexchange/xsd`. |
| `.archimate` nativo import | ✔ | **F5** | Importador directo del XMI de Archi (más rico que OEF: features, figuras alternativas, referencias a vista). |
| CSV elements/relations/properties | ✔ | **F5** | |
| HTML report navegable | ✔ | **F6** | Sitio estático generado con el viewer de solo lectura. |
| Jasper (PDF, DOCX, PPT, RTF, ODT) | ✔ | **✘ no** | Se cubre con export PDF de vistas + Markdown. |
| Plantillas `.architemplate`, `.archicanvas` | ✔ | **F6** | Workspaces plantilla. |
| CLI (24 opciones) | ✔ | **F6** | CLI `alldraw` sobre `packages/core`: import, export, validate, render. |
| Scripting jArchi | externo | **F6** | API TS del modelo (comandos) + MCP. |
| Colaboración coArchi (git) | externo | **F4** | Yjs en tiempo real, más export a JSON versionable en git. |
| Model importer / merge con matcher por id | ✔ | **F5** | Merge de workspaces por id estable. |
| Temas (light/dark/high contrast), i18n | ✔ | **F2** light/dark; i18n **F6** (es, en) | |
| Preferencias (~100 claves) | ✔ | **F2** subconjunto; resto según demanda | |

**Respuesta directa: sí, el plan cubre todo el metamodelo de ArchiMate (60+1 elementos, 11 relaciones, matriz, viewpoints, profiles) en la Fase 3, porque se genera desde los ficheros de datos de Archi, no a mano.** Lo que queda fuera de la v1: relaciones derivadas (Archi tampoco las tiene), informes Jasper, y los prefijos de etiqueta por tipo de relación.

## 2. BPMN 2.0 (referencia bpmn-js)

bpmn-moddle: 137 tipos en el metamodelo, 53 renderizados, 75 entradas de replace menu, `BpmnRules` para validez, drilldown en subprocesos, element templates con JSON Schema, bpmnlint 27 reglas, token simulation.

| Área | bpmn-js | all-draw | Fase |
|---|---|---|---|
| Metamodelo completo 137 tipos (leer/escribir XML sin pérdida) | ✔ | ✔ vía `bpmn-moddle` (MIT) en `io/bpmn` | F5 |
| Elementos modelables: tareas (8), subprocesos (5 variantes), call activity, transaction, gateways (5), eventos inicio (5+7), intermedios (11), boundary (14), fin (8), pool/lane, data object/store, group, text annotation, flujos (sequence/default/conditional/message/association/data) | ✔ 53 | **F3 subconjunto**: pool, lane, task genérica + user/service/script/manual/send/receive, subproceso colapsado/expandido, call activity, gateways exclusive/parallel/inclusive/event-based, eventos inicio/fin none-message-timer-signal-error-terminate, intermedios catch/throw message-timer-signal, boundary interrupting/non-interrupting message-timer-error, data object/store, annotation, sequence/message/default/conditional flow. **F5**: el resto (escalation, compensation, cancel, link, conditional, complex gateway, transaction, ad-hoc, multi-instance markers, choreography no). | F3/F5 |
| Reglas de conexión (`BpmnRules`) | ✔ | `validityMatrix` del pack + reglas custom (boundary→host, mismo pool para sequence flow, message flow entre pools) | F3 |
| Drilldown subproceso colapsado con breadcrumbs | ✔ | `detailViewId` + breadcrumb (mecanismo genérico) | F3 |
| Element templates (propiedades tipadas por JSON Schema) | ✔ | Es el mecanismo nativo de all-draw: `ElementType.fields` tipados; importador de element templates | F5 |
| Replace menu (cambiar tipo conservando conexiones) | ✔ | "Cambiar tipo" genérico con conservación de relaciones válidas | F2 |
| Context pad (anexar siguiente) y auto-place | ✔ | Anexar con Tab/menú y auto-place | F2 |
| bpmnlint 27 reglas | ✔ | Motor de reglas de validación por pack; se portan las 27 (son puras) | F5 |
| Token simulation | ✔ | **F7+** | |
| Colores "BPMN in Color" en XML | ✔ | Import/export de `bioc:` | F5 |
| Properties panel Camunda 7/8 | ✔ | **✘ no** (específico de motor) | |

## 3. Máquinas de estado (referencias Stately/XState y archify lifecycle)

| Área | Stately | all-draw | Fase |
|---|---|---|---|
| Estados atómicos, compuestos (initial), paralelos, finales, history shallow/deep | ✔ | ✔ pack `statechart`: estado con `kind` y anidamiento por contenedores | F3 |
| Transiciones con evento, guard, actions, delayed (`after`), eventless (`always`), self/reenter, wildcard | ✔ | Campos tipados de `RelationType` transición: `event, guard, actions[], delay, kind` | F3 |
| Entry/exit actions, invoke, spawn, context schema, events schema | ✔ | Campos del estado; `context`/`events` como campos JSON del elemento raíz (generan puertos) | F3 |
| Simulación | ✔ | **F7+** (intérprete XState embebido) | |
| Export XState JSON/JS/TS, Mermaid stateDiagram | ✔ | Export XState JSON y Mermaid | F5 |
| SCXML | ◐ (solo MCP) | Import/export SCXML | F5 |
| Generate test paths, GitHub sync, Sky | ✔ premium | **✘ no** | |

## 4. C4 (referencias Structurizr, LikeC4)

| Área | Structurizr / LikeC4 | all-draw | Fase |
|---|---|---|---|
| person, softwareSystem, container, component, group, custom element, deployment nodes/instances | ✔ | Pack `c4` con esos tipos; deployment en F5 | F3 |
| Vistas landscape/context/container/component/dynamic/deployment/filtered | ✔ | Vistas C4 como `View.kind` con `rootElementId` y nivel; filtered = viewpoint con expresiones | F3 |
| Expresiones include/exclude (`->id->`, `element.tag==`, `*->*`) | ✔ | Motor de predicados de vista (`include`, `exclude`, `where`) compartido; genera vistas derivadas | F3 básico, F5 completo |
| `navigateTo`, drill-down por doble clic | ✔ | `detailViewId` genérico | F3 |
| Perspectives (vistas transversales por preocupación) | ✔ Structurizr | Es exactamente "Dimension" en all-draw | F3 |
| 19 shapes, iconos, themes AWS/Azure/GCP/K8s/OCI | ✔ | Shapes del pack; themes de iconos importables (JSON de Structurizr) | F3 shapes, F5 themes |
| Implied relationships (3 estrategias) | ✔ | Relaciones implícitas por jerarquía, configurable | F5 |
| DSL textual, `!include`, `!script`, archetypes | ✔ | **F7+** DSL propio; en v1 import de Structurizr JSON y LikeC4 JSON (`likec4 export json`) | F5 import |
| Docs y ADRs embebidos | ✔ | Markdown por elemento; ADRs **F7+** | F1 |
| 26 inspecciones | ✔ | Validador por pack | F5 |
| MCP | ✔ | MCP sobre la API de comandos | F6 |

## 5. Canvas libre y editor (referencias draw.io, Excalidraw, Drawer)

| Capacidad | draw.io | Excalidraw | Drawer | all-draw | Fase |
|---|---|---|---|---|---|
| Formas básicas, texto, imagen, freehand, sticky, frame | ✔ | ✔ | chips en celdas | Pack `freeform` (rect, elipse, rombo, texto, imagen, sticky, grupo, nota); freehand **F7+** | F2 |
| Bibliotecas de formas (draw.io 76 sidebars, >10.000 formas; Excalidraw `.excalidrawlib`) | ✔ | ✔ | librerías de componentes con tipos y campos | Librerías de tipos + iconos (Simple Icons con licencias por marca, Structurizr themes, SVG propios); import `.excalidrawlib` y librerías XML de draw.io **F7+** | F2 base |
| Edit Data (nombre/valor sin tipado, placeholders `%k%`) | ✔ | customData | campos tipados por tipo (10 kinds) | Campos tipados (los 10 kinds de Drawer + `reference` a otro elemento + `enumMulti`), placeholders en etiquetas | F1 |
| Tags | ✔ | ✘ | ✘ | Tags en Element, Relation, View | F1 |
| Páginas y links entre páginas | ✔ | ✘ | diagramas | Vistas + `detailViewId` + links a URL/elemento/vista | F3 |
| Layers (capas de dibujo) | ✔ | ✘ | ✘ | Capas de vista (show/hide/lock) | F5 |
| Alinear, distribuir, z-order, agrupar, match size, lock, flip, rotate | ✔ | ✔ | parcial | Align 6, distribute 2, z-order 4, group, lock; rotate/flip **F7+** | F2 |
| Estilos de conector (straight/orthogonal/curved, dashed, jumps, 9 puntas + ER) | ✔ | ✔ | 3 estilos, 3 direcciones | straight/bezier/orthogonal, solid/dashed/dotted, puntas none/arrow/open/diamond/circle/crow + ER cardinalidades; line jumps **F5** | F2 |
| Sketch/rough style | ✔ | ✔ (base) | ✘ | **F7+** | |
| Math/LaTeX en texto | ✔ | ✘ | ✘ | **F7+** | |
| Layout automático (ELK 7 + mxGraph 10 + libavoid) | ✔ | ✘ | ✘ | elkjs (layered, tree, radial, force, stress, box) + libavoid para rutas | F5 |
| Find/replace, omnibox | ✔ | búsqueda | Ctrl+K librería | Búsqueda global (elementos, vistas, comandos) | F2; replace F5 |
| Undo/redo | ✔ | ✔ | ✔ (snapshots) | Por comando con inverso (Yjs UndoManager) | F1 |
| Copy/paste, duplicate, copy style, paste special | ✔ | ✔ | ✔ | ✔ | F2 |
| Zoom doble (contenido / títulos) | ✘ | ✘ | ✔ | ✔ (rasgo de Drawer conservado) | F2 |
| Cabeceras fijas capa×etapa, grupos de etapas | ✘ | ✘ | ✔ | ✔ en pack `grid` | F2 |
| Reglas de estilo condicional (7 fuentes × 10 operadores × 16 propiedades) | ◐ | ✘ | ✔ | ✔ ampliado: fuentes `relation`, `view`, `notation`, `port`, `tag` | F1 motor, F2 UI |
| Personas y asignaciones con papel | ✘ | ✘ | ✔ | ✔ | F2 |
| Catálogo de APIs + OpenAPI import/export | ✘ | ✘ | ✔ | ✔ generalizado como "catálogo tipado" (API, evento, modelo de datos) con `$ref` resuelto | F1/F2 |
| Pines campo→campo | ✘ | ✘ | ◐ (strings, no en catálogo API) | `Port` derivado de campos, N mappings por relación, validado por tipo | F1 |
| Temas light/dark/sistema, alto contraste | ✔ | ✔ | ✔ | light/dark/sistema; alto contraste F6 | F2 |
| Ventanas separadas sincronizadas | ✘ | ✘ | ✔ | ✔ (Yjs lo da gratis vía BroadcastChannel/IndexedDB) | F4 |
| Modo zen, pantalla completa, paneles redimensionables | ✘/✔ | ✔ | ✔ | ✔ | F2 |
| Atajos configurables | ✔ | ✘ | 35 fijos | Atajos con mapa configurable | F2 base, F6 configurable |
| Presentación / guided views / story (archify) | ✔ presentación | ✘ | ✘ | Vistas guiadas (capítulos con focus) | F6 |
| i18n | ✔ | 58 locales | es | es + en; resto por contribución | F6 |

## 6. Datos, plataforma y automatización

| Capacidad | Mejor referencia | all-draw | Fase |
|---|---|---|---|
| Modelo ≠ vistas | Archi, Structurizr, LikeC4, EA, Modelio | ✔ núcleo | F0 |
| Multi-notación en un documento | EA, Modelio, draw.io (sin semántica) | ✔ con semántica por pack | F3 |
| Drill-down entre notaciones distintas | ninguna lo hace | ✔ "abrir en otra dimensión" | F3 |
| Propiedades tipadas | EA (tagged values), Stately (schemas), bpmn element templates | ✔ `ElementType.fields` con 12 kinds y validación Zod | F1 |
| Puertos/pines con datos | EA/Modelio (UML ports, sin datos), Rete (sockets) | ✔ `Port` con `path`, tipo y compatibilidad | F1 |
| Data linking a hojas de cálculo (Lucid) | Lucidchart | Import CSV/XLSX a campos; sync bidireccional **F7+** | F5 |
| Trazabilidad / relationship matrix (EA) | EA, Modelio | Matriz de relaciones entre dos conjuntos filtrados | F5 |
| Baselines / diff / versiones | EA, Camunda, Stately, Structurizr | Historial Yjs + `compare` de dos snapshots (portado de archify delta) | F4 historial, F6 diff |
| Colaboración en tiempo real | Miro, Lucid, draw.io (Drive), Excalidraw | ✔ Yjs (cursores, presencia) | F4 |
| Comentarios por elemento | Camunda, Miro, Lucid, Drive | Comentarios en Element/View | F6 |
| Offline | draw.io, Excalidraw, Archi, Drawer | ✔ PWA + IndexedDB + archivo + single-file | F2 local, F4 sync |
| API REST | Structurizr, Miro, Lucid, Stately | ✔ generada desde Zod (OpenAPI automático) | F4 |
| CLI | draw.io, LikeC4, Structurizr, bpmn.io | ✔ | F6 |
| Scripting | todas | API TS de comandos; `!script` **F7+** | F1 API, F6 público |
| MCP / IA | draw.io, LikeC4, Structurizr, Stately, Miro, Lucid | ✔ MCP + SKILL.md; generación con IA (BYOK) F7+ | F6 |
| Import BPMN XML | bpmn-js, EA, Modelio, Lucid | ✔ | F5 |
| Import ArchiMate OEF / .archimate | Archi, EA, Modelio | ✔ ambos | F5 |
| Import draw.io XML | draw.io, Lucid | ✔ (geometría + datos; sin semántica salvo librerías reconocidas ArchiMate/BPMN/C4) | F5 |
| Import Excalidraw, JSON Canvas, Structurizr JSON, LikeC4 JSON, XState, SCXML, Mermaid, OpenAPI, `.drawer` | varios | ✔ todos; Mermaid solo flowchart/state/sequence/class | F1 `.drawer` y OpenAPI; F5 resto |
| Export SVG/PNG/PDF, HTML autocontenido, JSON, Mermaid, PlantUML, D2, draw.io | varios | ✔ | F2 imagen; F4 single-file; F5 resto |
| Export Visio VSDX | draw.io, Lucid, Miro | **F7+** | |
| Plugins / extensibilidad | bpmn-js, draw.io, EA, Lucid | Notation packs (datos + componentes React), importadores/exportadores como módulos, temas | F3 API pública de packs |
| Licencia | draw.io Apache, LikeC4 MIT, Excalidraw MIT | MIT o Apache-2.0 (a decidir antes del primer commit) | F0 |

## 7. Lo que ninguna referencia hace y all-draw sí

1. **Un elemento en vistas de notaciones distintas con semántica propia en cada una** (BusinessProcess en ArchiMate, pool en BPMN, máquina de estados, nodo C4) unidos por trazabilidad explícita. EA y Modelio lo aproximan con un repositorio común pero sin "cambiar de dimensión" desde el nodo.
2. **Pines con datos**: campos tipados del elemento (incluidos contratos JSON) como puertos conectables entre notaciones, con validación de tipo. Rete y React Flow dan el mecanismo visual; nadie lo une a un metamodelo.
3. **Reglas de estilo condicional sobre cualquier fuente** (campo, relación, vista, notación, persona, tag) heredadas de Drawer y ampliadas. Lucid tiene lo más parecido, de pago.
4. **Notaciones como datos** generadas desde las fuentes oficiales (Archi, bpmn-moddle, XState): añadir una notación no toca el núcleo.
5. **Offline real con colaboración** en la misma app: draw.io lo consigue solo con Drive; Miro y Lucid no son offline; Archi y EA no colaboran en tiempo real.

## 8. Lo que all-draw no hará (por ahora)

- Simulación (BPMN token, XState, DMN, SysML paramétrica).
- Generación de código, ingeniería inversa, esquemas de base de datos (EA, Modelio).
- Informes Jasper, DOCX, PPTX.
- UML completo por XMI, SysML, UAF, DMN, CMMN: se añaden como packs después de la v1 si hay demanda; el núcleo no lo impide.
- Visio import/export, integraciones Confluence/Jira, video chat, voting, timers.
- DSL textual propio (LikeC4/Structurizr): se evalúa en F7+ una vez estable el modelo JSON.

## 9. Conteos de referencia frente a objetivo v1

| Métrica | Archi | bpmn-js | draw.io | Drawer | all-draw v1 (tras F5) |
|---|---|---|---|---|---|
| Tipos de elemento semánticos | 61 | 53 renderizados / 137 modelo | 0 (formas sin semántica) | definidos por usuario | 61 ArchiMate + ~45 BPMN + ~8 statechart + ~10 C4 + freeform + grid + los del usuario |
| Tipos de relación | 11 | 6 | 0 | 1 (con estilo) | 11 + 6 + 3 + 4 + trazabilidad + usuario |
| Viewpoints / filtros | 25 | 0 | tags/layers | 0 | 25 ArchiMate + predicados libres |
| Reglas de validación | 8 | 27 (lint) + BpmnRules | 0 | 0 | 8 + 27 + matriz por pack + geométricas (archify) |
| Notaciones en un documento | 3 | 1 | ∞ sin semántica | 1 | 6 con semántica + freeform |
| Import | .archimate, OEF, CSV | BPMN | 15+ formatos | JSON, OpenAPI | 12 formatos |
| Colaboración tiempo real | ✘ | ✘ (lib) | ◐ | ✘ | ✔ |
| Offline | ✔ | ✔ | ✔ | ✔ | ✔ |
