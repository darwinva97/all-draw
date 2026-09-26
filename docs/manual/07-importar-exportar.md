# 7. Importar y exportar

Dos sitios:

- **Inicio → Importar…**: crea un espacio nuevo a partir del fichero (local, o en el servidor si
  tienes sesión).
- **Editor → Importar / Exportar**: importar **sustituye** el contenido del espacio actual (pide
  confirmación); exportar ofrece los formatos del espacio completo y los de la vista actual.

![Menú Importar / Exportar del editor](img/11-importar-exportar.png)

El formato de entrada se detecta por extensión (`.drawer`, `.archimate`, `.mmd`) o por contenido
(espacios de nombres XML, claves del JSON, primera línea de Mermaid, `openapi:` en YAML). Los
avisos de importación (lo que no se pudo conservar) se muestran al terminar. Extensiones que acepta
el selector: `.drawer .json .archimate .xml .bpmn .mmd .yaml .yml`.

## Tabla de formatos

| Formato | Sentido | Se conserva | Se pierde / avisos |
|---|---|---|---|
| **JSON de all-draw** (`.alldraw.json`) | importa y exporta | Todo el espacio (modelo, vistas, posiciones, bendpoints, estilos, librerías, reglas, personas, dimensiones). Salida estable (claves ordenadas): dos exportaciones del mismo estado son idénticas. Al importar se migran esquemas antiguos. | Nada. Es el formato de copia de seguridad. |
| **.drawer** (Drawer) | importa | Librerías y tipos con campos; componentes (usados o plantillas); APIs y operaciones como `lib:api`/`lib:apiOperation` con **pines** reales sobre petición/respuesta; cada diagrama → vista *capas × etapas* con capas, etapas, grupos y colores; posiciones por celda, anidamiento y notas; relaciones `core:link` con pines, mapeos de campos, color, grosor, estilo y sentido; personas con asignaciones; reglas con condiciones; dimensión `dim_grid`. | Sin bendpoints; tamaño de nodo fijo 160×56; el cargo de la persona pasa a notas. Avisos por tipos/APIs/celdas/placements inexistentes (nunca errores). Solo `version: 1`. No hay exportación a `.drawer`. |
| **Archi** (`.archimate`) | importa y exporta | Elementos y relaciones con sus ids (incluidas relaciones sobre relaciones), documentación, propiedades, perfiles (→ librería `lib:archimate-profiles`), carpetas; campos de relación (Junction and/or, `accessType`, `strength`, `directed`); vistas con viewpoint, grupos, notas, referencias a vista (→ `detailViewId`), anidamiento, colores de relleno/línea/fuente, alpha, bendpoints (convertidos de relativos a absolutos, ida y vuelta probada con Archisurance). | Bocetos y lienzos de Archi no se importan; objetos no soportados pasan a nota. Al exportar se omiten con aviso los elementos, relaciones y vistas que no son ArchiMate (y las rejillas). |
| **ArchiMate Open Exchange** (`.oef.xml`) | importa y exporta | Lo mismo que Archi, más nombre/documentación por idioma, `propertyDefinitions`, organizaciones, viewpoint por nombre, `Container` → grupo, `Label` → nota o enlace a vista, colores RGB con opacidad, bendpoints. | Avisos por viewpoint o definición de propiedad desconocidos. Al exportar, coordenadas negativas se desplazan e ids que empiezan por dígito se prefijan `id-`. Lo no ArchiMate se omite con aviso. |
| **BPMN 2.0 XML** (`.bpmn`) | importa y exporta | Metamodelo completo (bpmn-moddle): pools y participantes (colapsado si no tiene proceso), lanes, tipos de tarea, subprocesos (evento, ad hoc, transacción), eventos con definición/temporizador/condición, datos, coreografía, conversación, documentación, `isExpanded`; extensiones (`extensionElements` y atributos ajenos) se guardan y vuelven al exportar; una vista por `BPMNDiagram` con drill-down entre ellas; posiciones relativas al padre, posición de etiqueta, waypoints → bendpoints, colores `bioc:`/`color:`. | Sin DI se importa el modelo sin vistas (aviso). Avisos por artefactos o nodos no soportados y por formas sin elemento. Al exportar se ignoran las vistas que no son BPMN y las plantillas. Exportar una sola vista incluye sus vistas de detalle. |
| **Structurizr JSON** (C4) | importa y exporta | Personas, sistemas, contenedores, componentes, nodos de despliegue e infraestructura; `External`, `technology`, etiquetas, propiedades, descripción; jerarquía (`features.parentId`); relaciones (también de instancias); vistas landscape/contexto/contenedores/componentes/despliegue con x/y y `vertices` → bendpoints; enrutado; dimensión `dim_c4`. | Vistas dinámicas y filtradas no se importan (aviso); tamaños de nodo sintéticos. Al exportar se omiten con aviso lo no C4, los `Boundary`, el nivel de código, componentes sin contenedor y elementos repetidos en una vista; contenedores sin sistema van a "Sin sistema". |
| **XState JSON** | importa y exporta | Estados por ruta (`a.b.c`), paralelos, finales, histórico; `entry`/`exit`, `description`, `meta`; pseudoestado inicial; transiciones con evento, guarda (`cond`/`guard`), acciones, `internal`, `after` (→ delay) y `always`; destinos `.hijo` y `#id`. | El fichero no tiene posiciones: al importar se aplica un layout en rejilla; al exportar se pierden posiciones, colores y bendpoints. Fork/join/terminate se omiten con aviso. Requiere una vista de estados para exportar. |
| **Mermaid** (`.mmd`; `flowchart`/`graph` y `stateDiagram-v2`) | importa y exporta | Nodos con forma según tipo, aristas `-->`, `-.->`, `---`, `<-->` con etiqueta, `subgraph` anidados (contenedores; en rejilla, uno por capa); estados `[*]`, compuestos, regiones paralelas, `<<choice/fork/join>>`, etiquetas `evento [guarda] / acciones`. | Se ignoran `classDef`, `class`, `style`, `linkStyle`, `click`, `direction`, `note`: **se pierden los colores**. Sin posiciones: layout por niveles al importar; al exportar se pierden posiciones, tamaños, bendpoints y pines. Avisos por líneas no reconocidas o `end` desemparejados. |
| **draw.io** (`.drawio`) | exporta (una vista) | `mxGraphModel` sin comprimir: formas por tipo, colores, trazo, fuente, opacidad, anidamiento (`container=1`), celdas de rejilla como contenedores, aristas ortogonales con estilo, puntas, etiqueta y bendpoints; nodos con detalle como `shape=process`. | Sin documentación, propiedades ni pines. Avisos por nodos sin elemento o aristas rotas. No se reimporta. |
| **OpenAPI 2.0/3.x** (JSON/YAML) | importa | Librería `lib:apis` con una API plantilla y una operación plantilla por path+método: servidores, seguridad, versión, `externalDocs`, cabeceras, parámetros, códigos de respuesta, y cuerpos de petición/respuesta como JSON de ejemplo generado del esquema (`$ref`, `allOf/oneOf`, enum, formatos, ciclos) → cada hoja es un **pin**; etiquetas y `deprecated`. | No crea vistas (solo plantillas para arrastrar). Avisos por `$ref` externos, referencias no encontradas u operaciones repetidas. |
| **SVG** (una vista) | exporta | Mismo aspecto que el lienzo: formas, colores por tipo y por reglas, contenedores, rejilla, aristas con bendpoints y marcadores, pines visibles, etiquetas de mapeos; `<title>`/`<desc>` accesibles y atributos `data-*`; tema claro, oscuro o **dual** (`prefers-color-scheme`). | Es una imagen: no se reimporta. |
| **PNG** (una vista, 2×) | exporta | Rasterizado del SVG con el tema actual. | Solo en el navegador; nada semántico. |
| **HTML autocontenido** | exporta | Todas las vistas como SVG con índice por notación, navegación por `detailViewId` y migas, tabla "aparece en" por elemento, documentación de cada vista, tema dual con conmutador; CSS y JS inline sin URLs externas. | No se reimporta; no incluye propiedades ni campos detallados. |

## Reglas de bpmnlint incluidas

Se ejecutan sobre todas las vistas BPMN y aparecen en el panel de problemas:

| Regla | Severidad | Qué comprueba |
|---|---|---|
| start-event-required | error | Cada proceso o subproceso tiene evento de inicio (no se exige en ad hoc ni de evento) |
| end-event-required | error | Cada proceso o subproceso tiene evento de fin |
| no-disconnected | error | Nodo sin flujos de secuencia (exentos: eventos de borde, compensación, link, subprocesos de evento); propone borrarlo |
| single-blank-start-event | error | Más de un evento de inicio sin definición en el mismo proceso |
| no-implicit-split | aviso | Un nodo divide el flujo sin compuerta |
| no-duplicate-sequence-flows | error | Dos flujos con el mismo origen y destino; propone borrar el duplicado |
| label-required | aviso | Falta etiqueta en pools, lanes, actividades, eventos, compuertas divergentes o flujos condicionales |
| superfluous-gateway | aviso | Compuerta con una entrada y una salida |
| fake-join | aviso | Actividad que recibe varios flujos sin compuerta |
| no-inclusive-gateway-without-condition | error | Salida de compuerta inclusiva sin condición ni por defecto |

## Consejos

- Para **copias de seguridad** y para mover espacios entre servidores usa `.alldraw.json`.
- Para entregar a quien no tiene all-draw, **HTML autocontenido** (navegable, sin instalar nada) o
  **SVG dual** (se ve bien en fondo claro y oscuro).
- La ida y vuelta con Archi y con BPMN está probada con modelos reales, pero solo conserva lo que
  esas herramientas pueden representar: las dimensiones, pines y relaciones puente de all-draw
  viven en el `.alldraw.json`.
