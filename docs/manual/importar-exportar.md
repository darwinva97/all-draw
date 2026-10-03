# Importar y exportar

all-draw puede abrir modelos que ya tienes en otras herramientas (Archi, Camunda, Drawer, Mermaid, OpenAPI…) y
sacar tu trabajo como copia de seguridad, como imagen, como página web o en el formato de otra herramienta. Este
capítulo te ayuda a elegir el formato y te guía paso a paso.

## Dónde está {#donde}

Hay dos sitios para importar y uno para exportar:

| Dónde | Qué hace |
|---|---|
| **Inicio → Importar…** | Crea un **espacio nuevo** a partir del fichero. Si has entrado con tu cuenta, se crea en el servidor; si no, en este navegador. Es la opción más segura: no toca nada de lo que ya tienes. |
| **Editor → Importar / Exportar → Importar (sustituye el espacio)** | Carga el fichero **en el espacio abierto, sustituyendo todo su contenido**. Pide confirmación antes. |
| **Editor → Importar / Exportar → Exportar…** | Descarga el espacio completo o la vista actual en el formato que elijas. |

![Menú Importar / Exportar del editor](img/11-importar-exportar.png)

En el móvil, **Importar / Exportar** está en la hoja **Más**. Si el espacio está en solo lectura, puedes exportar pero
no importar.

> [!WARNING]
> Importar desde el editor **reemplaza** el contenido del espacio, no lo añade. Si el espacio tiene algo que quieras
> conservar, exporta antes un **JSON de all-draw** o, en un espacio del servidor, crea una instantánea en el
> [Historial](historial.md).

## ¿Qué formato elijo? {#que-formato}

| Quiero… | Usa | Desde |
|---|---|---|
| Hacer una **copia de seguridad** o mover un espacio a otro servidor | **JSON de all-draw** (`.alldraw.json`) | Exportar el espacio |
| Enseñar el modelo a alguien **sin all-draw**, navegable | **HTML autocontenido** | Exportar el espacio |
| Poner un diagrama en un documento o una presentación | **PNG (2×)** o **SVG** | Exportar la vista |
| Una imagen que se vea bien con fondo claro y oscuro (wiki, web) | **SVG (tema claro y oscuro)** | Exportar la vista |
| Traer un modelo de **Archi** | `.archimate` | Importar |
| Devolver un modelo a **Archi** u otra herramienta ArchiMate | `.archimate` o **Open Exchange** | Exportar el espacio |
| Traer o llevar procesos de **Camunda, bpmn.io, Signavio, Bizagi…** | **BPMN 2.0 XML** | Importar / exportar |
| Traer un proyecto de **Drawer** | `.drawer` | Importar |
| Pegar un diagrama en un README de GitHub o GitLab | **Mermaid** | Exportar la vista |
| Convertir un diagrama Mermaid que ya tienes | `.mmd` | Importar |
| Partir del contrato de una **API** | **OpenAPI** (JSON o YAML) | Importar |
| Seguir retocando un dibujo en **draw.io / diagrams.net** | **draw.io** | Exportar la vista |
| Modelos **C4** de Structurizr | **Structurizr JSON** | Importar / exportar |
| Máquinas de estados para código (XState) | **XState JSON** | Importar / exportar la vista |

> [!TIP]
> Solo el **JSON de all-draw** guarda *todo*: dimensiones, pines, reglas, personas, comentarios y las relaciones
> entre notaciones. Los demás formatos guardan lo que la otra herramienta sabe representar.

## Importar paso a paso {#importar}

El procedimiento es siempre el mismo:

1. Consigue el fichero en tu ordenador (más abajo, cómo sacarlo de cada herramienta).
2. En el inicio, pulsa **Importar…** y elige el fichero. (O, para sustituir el espacio abierto, **Importar /
   Exportar** → **Importar (sustituye el espacio)** y confirma.)
3. all-draw reconoce el formato solo y abre el espacio.
4. Si algo no se pudo conservar, al importar desde el editor verás una ventana de **Avisos** con la lista (las doce
   primeras y "… y *N* más").
5. Recorre las vistas y abre el [panel de problemas](editor.md#problemas) por si hay algo que revisar.

El selector de ficheros admite `.drawer`, `.json`, `.archimate`, `.xml`, `.bpmn`, `.mmd`, `.yaml` y `.yml`.

### Desde Archi {#archi}

1. En Archi, guarda el modelo (**File → Save**): el fichero que se guarda es el `.archimate`.
2. En all-draw, **Inicio → Importar…** y elige ese fichero.
3. Se crea una vista por cada vista de Archi, con su *viewpoint*, colores, grupos, notas y puntos de quiebre. Las
   referencias a otras vistas se convierten en enlaces de detalle (doble clic para entrar), y los perfiles
   (*specializations*) en una librería `lib:archimate-profiles`.

Los bocetos (*Sketch*) y lienzos (*Canvas*) de Archi no se importan, y los objetos que no se pueden representar pasan
a notas. Si tu herramienta no es Archi pero exporta **ArchiMate Open Exchange** (`.xml`), impórtalo igual: all-draw lo
reconoce por su contenido.

Para volver a Archi: **Exportar el espacio → Archi (.archimate)** y ábrelo con **File → Open** en Archi.

### Desde herramientas BPMN {#bpmn}

Camunda Modeler, bpmn.io, Signavio, Bizagi y la mayoría de herramientas BPMN guardan o exportan **BPMN 2.0 XML**
(`.bpmn` o `.xml`).

1. En tu herramienta, guarda o exporta el proceso como BPMN 2.0 XML. Si te deja elegir, incluye la información del
   diagrama (*diagram interchange*, DI): son las posiciones de cada forma.
2. En all-draw, **Inicio → Importar…** y elige el fichero.
3. Se crea una vista por cada diagrama del fichero, con pools, carriles, tareas, eventos, compuertas, subprocesos,
   flujos, puntos de quiebre y colores. Entre diagramas puedes entrar y salir con doble clic.

Las extensiones propias de cada herramienta (por ejemplo, las de Camunda) se guardan y **vuelven a salir al exportar**,
así que puedes ir y volver sin perderlas. Para exportar: **Exportar el espacio → BPMN 2.0 XML (todas las vistas
BPMN)**, o desde una vista BPMN, **BPMN 2.0 XML** solo de esa vista (incluye sus vistas de detalle).

Las vistas BPMN se revisan con las [reglas de bpmnlint](#bpmnlint) y los fallos aparecen en el panel de problemas.

### Desde Drawer {#drawer}

1. En Drawer, exporta el proyecto: obtendrás un fichero `.drawer` (también vale si lo tienes como `.json`).
2. En all-draw, **Inicio → Importar…** y elígelo.
3. Resultado:
   - cada librería de Drawer se convierte en una [librería](librerias-reglas-personas.md#librerias) con sus tipos y
     campos, y sus componentes;
   - las APIs y operaciones van a la librería `lib:apis`, con los cuerpos de petición y respuesta como
     [pines](conceptos.md#pines) de verdad;
   - cada diagrama se convierte en una vista [Capas × etapas](editor.md#rejilla) con sus capas, etapas, grupos y
     colores;
   - las relaciones conservan pines, mapeos de campos, color, grosor, estilo y sentido; también se importan personas,
     asignaciones y reglas.

Lo que cambia: no hay puntos de quiebre, todos los nodos tienen el mismo tamaño (160×56) y el cargo de cada persona
pasa a sus notas. Solo se admiten ficheros de la versión 1 de Drawer, y no se puede exportar de vuelta a `.drawer`.

### Desde Mermaid {#mermaid}

1. Copia el texto del diagrama Mermaid y guárdalo en un fichero con extensión `.mmd` (por ejemplo `proceso.mmd`).
   all-draw entiende `flowchart` / `graph` y `stateDiagram-v2`.
2. **Inicio → Importar…** y elige el fichero.
3. Como Mermaid no guarda posiciones, all-draw coloca los nodos por niveles. Retócalos a mano o usa **Layout
   automático**.

Se conservan las formas de los nodos, las flechas (`-->`, `-.->`, `---`, `<-->`) con su texto, los `subgraph`
(como contenedores) y, en diagramas de estados, `[*]`, estados compuestos, regiones paralelas y `<<choice>>`,
`<<fork>>`, `<<join>>`. **Los colores no se conservan**: Mermaid los define con `classDef`, `style` y `linkStyle`, que se
ignoran (igual que `click`, `direction` y `note`).

Para sacar una vista a Mermaid: **Exportar la vista → Mermaid**. Las vistas de estados salen como `stateDiagram-v2`,
las vistas ER como `erDiagram` (con cardinalidades) y las demás como `flowchart`.

### Desde OpenAPI {#openapi}

1. Consigue la especificación de la API (OpenAPI 3.x o Swagger 2.0) en JSON o YAML.
2. **Inicio → Importar…** y elígela.
3. Se crea un espacio con la librería `lib:apis`: una API plantilla y una operación plantilla por cada ruta y método,
   con servidores, seguridad, parámetros, cabeceras, códigos de respuesta y etiquetas. Los cuerpos de petición y
   respuesta se convierten en un JSON de ejemplo y **cada hoja es un pin**.
4. Este importador **no crea vistas**: abre una vista, ve a la pestaña **Librerías** de la paleta y arrastra las
   operaciones desde **Componentes**.

### Otros formatos {#otros}

- **Structurizr JSON** (C4): personas, sistemas, contenedores, componentes y despliegue, con sus vistas y posiciones.
  Solo el formato JSON de Structurizr; el lenguaje DSL (`.dsl`) no se reconoce.
- **XState JSON**: una máquina de estados. No trae posiciones, así que se colocan en rejilla al importar.
- **JSON de all-draw**: restaura una copia de seguridad tal cual, migrando las versiones antiguas si hace falta.

## Exportar {#exportar}

El menú **Importar / Exportar** tiene dos apartados:

- **Exportar el espacio**: JSON de all-draw, HTML autocontenido (todas las vistas), Archi (.archimate), ArchiMate Open
  Exchange, Structurizr JSON (C4) y BPMN 2.0 XML (todas las vistas BPMN).
- **Exportar la vista «…»**: SVG (tema claro y oscuro), PNG (2×), Mermaid, draw.io y, según la notación de la vista,
  BPMN 2.0 XML o XState JSON.

El fichero se descarga con el nombre del espacio o de la vista. Si algo no cabe en el formato elegido, verás una
ventana de **Avisos** que lo explica.

### Copia de seguridad {#copia}

1. **Importar / Exportar → JSON de all-draw**.
2. Guarda el `.alldraw.json` donde guardes tus copias.
3. Para restaurarlo, **Inicio → Importar…** (crea un espacio nuevo con todo) o, para sobrescribir un espacio,
   **Importar (sustituye el espacio)** desde el editor.

El resultado es estable: dos exportaciones del mismo estado dan exactamente el mismo fichero, así que puedes guardarlo
en Git y ver las diferencias. En los espacios del servidor tienes además el [Historial](historial.md) de
instantáneas.

### Imágenes {#imagen}

Abre la vista que quieres y elige:

- **SVG (tema claro y oscuro)**: imagen vectorial (se amplía sin perder calidad) que cambia sola a colores claros u
  oscuros según el tema de quien la mire. Ideal para webs y wikis. Incluye título y descripción accesibles.
- **PNG (2×)**: imagen normal, a doble resolución, con el tema que tengas puesto en ese momento. Ideal para documentos
  y presentaciones.

Las dos se ven igual que el lienzo: formas, colores (también los de las reglas), contenedores, rejilla, pines y
etiquetas de mapeos.

### HTML para compartir {#html}

**HTML autocontenido (todas las vistas)** descarga una sola página web que se abre en cualquier navegador, sin
conexión y sin instalar nada:

- un índice de vistas agrupadas por notación;
- navegación por las vistas de detalle y una ruta de migas;
- para cada elemento, en qué vistas aparece; y la descripción de cada vista;
- un botón para cambiar entre tema claro y oscuro.

Es una foto: no se puede volver a importar y no incluye todos los campos de cada elemento.

### Llevar a otra herramienta {#a-otra-herramienta}

- **Archi / Open Exchange**: solo sale lo que es ArchiMate; el resto (y las rejillas) se omite con aviso.
- **BPMN 2.0 XML**: solo las vistas BPMN.
- **Structurizr**: solo lo que es C4.
- **draw.io**: una vista, con formas, colores, anidamiento y puntos de quiebre, para seguir dibujando en
  diagrams.net. No incluye documentación ni pines y no se puede volver a importar en all-draw.
- **Mermaid** y **XState**: sin posiciones ni colores.

## Cómo se reconoce el formato {#deteccion}

No tienes que decir qué formato es. all-draw mira la extensión (`.drawer`, `.archimate`, `.mmd`) y, si no basta, el
contenido: los espacios de nombres del XML (Archi, Open Exchange, BPMN), las claves del JSON (all-draw, Drawer,
Structurizr, XState, OpenAPI), la primera línea de Mermaid o `openapi:` / `swagger:` en YAML. Al importar desde el
editor, el mensaje de confirmación te dice qué formato ha detectado.

## Tabla de formatos {#formatos}

Referencia completa de lo que se conserva y lo que se pierde en cada formato.

| Formato | Sentido | Se conserva | Se pierde / avisos |
|---|---|---|---|
| **JSON de all-draw** (`.alldraw.json`) | importa y exporta | Todo el espacio (modelo, vistas, posiciones, puntos de quiebre, estilos, librerías, reglas, personas, dimensiones). Salida estable (claves ordenadas): dos exportaciones del mismo estado son idénticas. Al importar se migran esquemas antiguos. | Nada. Es el formato de copia de seguridad. |
| **.drawer** (Drawer) | importa | Librerías y tipos con campos; componentes (usados o plantillas); APIs y operaciones como `lib:api`/`lib:apiOperation` con **pines** reales sobre petición/respuesta; cada diagrama → vista *capas × etapas* con capas, etapas, grupos y colores; posiciones por celda, anidamiento y notas; relaciones `core:link` con pines, mapeos de campos, color, grosor, estilo y sentido; personas con asignaciones; reglas con condiciones; dimensión `dim_grid`. | Sin puntos de quiebre; tamaño de nodo fijo 160×56; el cargo de la persona pasa a notas. Avisos por tipos/APIs/celdas/placements inexistentes (nunca errores). Solo `version: 1`. No hay exportación a `.drawer`. |
| **Archi** (`.archimate`) | importa y exporta | Elementos y relaciones con sus ids (incluidas relaciones sobre relaciones), documentación, propiedades, perfiles (→ librería `lib:archimate-profiles`), carpetas; campos de relación (Junction and/or, `accessType`, `strength`, `directed`); vistas con viewpoint, grupos, notas, referencias a vista (→ `detailViewId`), anidamiento, colores de relleno/línea/fuente, alpha, puntos de quiebre (convertidos de relativos a absolutos, ida y vuelta probada con Archisurance). | Bocetos y lienzos de Archi no se importan; objetos no soportados pasan a nota. Al exportar se omiten con aviso los elementos, relaciones y vistas que no son ArchiMate (y las rejillas). |
| **ArchiMate Open Exchange** (`.oef.xml`) | importa y exporta | Lo mismo que Archi, más nombre/documentación por idioma, `propertyDefinitions`, organizaciones, viewpoint por nombre, `Container` → grupo, `Label` → nota o enlace a vista, colores RGB con opacidad, puntos de quiebre. | Avisos por viewpoint o definición de propiedad desconocidos. Al exportar, coordenadas negativas se desplazan e ids que empiezan por dígito se prefijan `id-`. Lo no ArchiMate se omite con aviso. |
| **BPMN 2.0 XML** (`.bpmn`) | importa y exporta | Metamodelo completo (bpmn-moddle): pools y participantes (colapsado si no tiene proceso), lanes, tipos de tarea, subprocesos (evento, ad hoc, transacción), eventos con definición/temporizador/condición, datos, coreografía, conversación, documentación, `isExpanded`; extensiones (`extensionElements` y atributos ajenos) se guardan y vuelven al exportar; una vista por `BPMNDiagram` con drill-down entre ellas; posiciones relativas al padre, posición de etiqueta, waypoints → puntos de quiebre, colores `bioc:`/`color:`. | Sin DI se importa el modelo sin vistas (aviso). Avisos por artefactos o nodos no soportados y por formas sin elemento. Al exportar se ignoran las vistas que no son BPMN y las plantillas. Exportar una sola vista incluye sus vistas de detalle. |
| **Structurizr JSON** (C4) | importa y exporta | Personas, sistemas, contenedores, componentes, nodos de despliegue e infraestructura; `External`, `technology`, etiquetas, propiedades, descripción; jerarquía (`features.parentId`); relaciones (también de instancias); vistas landscape/contexto/contenedores/componentes/despliegue con x/y y `vertices` → puntos de quiebre; enrutado; dimensión `dim_c4`. | Vistas dinámicas y filtradas no se importan (aviso); tamaños de nodo sintéticos. Al exportar se omiten con aviso lo no C4, los `Boundary`, el nivel de código, componentes sin contenedor y elementos repetidos en una vista; contenedores sin sistema van a "Sin sistema". |
| **XState JSON** | importa y exporta (vista de estados) | Estados por ruta (`a.b.c`), paralelos, finales, histórico; `entry`/`exit`, `description`, `meta`; pseudoestado inicial; transiciones con evento, guarda (`cond`/`guard`), acciones, `internal`, `after` (→ delay) y `always`; destinos `.hijo` y `#id`. | El fichero no tiene posiciones: al importar se aplica un layout en rejilla; al exportar se pierden posiciones, colores y puntos de quiebre. Fork/join/terminate se omiten con aviso. Solo se ofrece al exportar desde una vista de estados. |
| **Mermaid** (`.mmd`) | importa `flowchart`/`graph` y `stateDiagram-v2`; exporta además `erDiagram` | Nodos con forma según tipo, aristas `-->`, `-.->`, `---`, `<-->` con etiqueta, `subgraph` anidados (contenedores; en rejilla, uno por capa); estados `[*]`, compuestos, regiones paralelas, `<<choice/fork/join>>`, etiquetas `evento [guarda] / acciones`. Las vistas ER se exportan como `erDiagram` con atributos y cardinalidades. | Se ignoran `classDef`, `class`, `style`, `linkStyle`, `click`, `direction`, `note`: **se pierden los colores**. Sin posiciones: layout por niveles al importar; al exportar se pierden posiciones, tamaños, puntos de quiebre y pines. Avisos por líneas no reconocidas o `end` desemparejados. |
| **draw.io** (`.drawio`) | exporta (una vista) | `mxGraphModel` sin comprimir: formas por tipo, colores, trazo, fuente, opacidad, anidamiento (`container=1`), celdas de rejilla como contenedores, aristas ortogonales con estilo, puntas, etiqueta y puntos de quiebre; nodos con detalle como `shape=process`. | Sin documentación, propiedades ni pines. Avisos por nodos sin elemento o aristas rotas. No se reimporta. |
| **OpenAPI 2.0/3.x** (JSON/YAML) | importa | Librería `lib:apis` con una API plantilla y una operación plantilla por path+método: servidores, seguridad, versión, `externalDocs`, cabeceras, parámetros, códigos de respuesta, y cuerpos de petición/respuesta como JSON de ejemplo generado del esquema (`$ref`, `allOf/oneOf`, enum, formatos, ciclos) → cada hoja es un **pin**; etiquetas y `deprecated`. | No crea vistas (solo plantillas para arrastrar). Avisos por `$ref` externos, referencias no encontradas u operaciones repetidas. |
| **SVG** (una vista) | exporta | Mismo aspecto que el lienzo: formas, colores por tipo y por reglas, contenedores, rejilla, aristas con puntos de quiebre y marcadores, pines visibles, etiquetas de mapeos; `<title>`/`<desc>` accesibles y atributos `data-*`; tema **dual** (`prefers-color-scheme`). | Es una imagen: no se reimporta. |
| **PNG** (una vista, 2×) | exporta | Rasterizado del SVG con el tema actual. | Nada semántico. |
| **HTML autocontenido** | exporta | Todas las vistas como SVG con índice por notación, navegación por `detailViewId` y migas, tabla "aparece en" por elemento, documentación de cada vista, tema dual con conmutador; CSS y JS inline sin URLs externas. | No se reimporta; no incluye propiedades ni campos detallados. |

## Reglas de bpmnlint incluidas {#bpmnlint}

Se ejecutan sobre todas las vistas BPMN y aparecen en el [panel de problemas](editor.md#problemas):

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
| bpmn-pool-rules | error | Flujo de secuencia que cruza pools, flujo de mensaje dentro de una misma pool o evento de borde sin actividad |

## Errores comunes {#errores-comunes}

**"No se pudo importar: No se reconoce el formato del fichero…"**
El contenido no corresponde a ningún formato admitido. Casos típicos: un Structurizr en DSL (`.dsl`) en vez de JSON,
un fichero de draw.io o Visio, un Excel/CSV exportado de Archi, o un `.json` cualquiera. Comprueba en la
[tabla de formatos](#formatos) que tu fichero es uno de ellos y, si es XML de BPMN u Open Exchange, que no lo hayas
editado a mano quitando los espacios de nombres.

**"El texto no parece un diagrama Mermaid soportado."**
Solo se importan `flowchart` / `graph` y `stateDiagram-v2`. Los diagramas `sequenceDiagram`, `classDiagram`,
`erDiagram`, `gantt` y demás no se importan.

**"He importado un Mermaid y ha perdido los colores."**
Es lo esperado: los estilos de Mermaid (`classDef`, `style`, `linkStyle`) se ignoran. Vuelve a dar color con una
[regla](librerias-reglas-personas.md#reglas) (por ejemplo, por nombre o por tipo), que además se aplica en todas
las vistas.

**"Mi fichero Mermaid no aparece en el selector."**
Tiene otra extensión (`.txt`, `.md`). Cámbiala a `.mmd`.

**"He importado un BPMN y no hay ninguna vista."**
El fichero no tenía información del diagrama (DI), solo el modelo. Los elementos están en la pestaña **Modelo** de la
paleta: crea una vista BPMN, arrástralos y usa **Layout automático**. Mejor aún, vuelve a exportar desde tu herramienta
incluyendo el diagrama.

**"He importado un OpenAPI y el lienzo está vacío."**
Es normal: el importador solo crea plantillas. Ábrelas desde la pestaña **Librerías** de la paleta, apartado
**Componentes**.

**"Importé desde el editor y he perdido lo que tenía."**
Importar desde el editor sustituye el espacio. En un espacio del servidor, busca una instantánea anterior en
[Historial](historial.md) y restáurala (se crean solas con la actividad y también a mano). En un espacio local, solo
puedes recuperarlo si tenías una copia `.alldraw.json`. Para no correr riesgos, importa desde el **inicio**, que crea
un espacio nuevo.

**"Quiero añadir un fichero a mi espacio, no sustituirlo."**
Hoy no se pueden fusionar dos ficheros. Importa el nuevo en un espacio aparte (desde el inicio), ábrelo en otra
pestaña, copia los nodos con **Ctrl+C** y pégalos en tu espacio con **Ctrl+V**: se pegan como copias.

**"No he visto ningún aviso al importar desde el inicio."**
Los avisos solo se muestran en pantalla al importar desde el editor. Si te interesa saber qué se ha quedado fuera,
importa desde el editor sobre un espacio vacío.

**"No encuentro la opción de importar."**
Estás en solo lectura (enlace de lectura o rol **solo lectura**): solo puedes exportar.

**"El SVG se ve oscuro en mi documento."**
El SVG de tema claro y oscuro sigue el tema de quien lo mira. Si necesitas un aspecto fijo, exporta **PNG (2×)** con
el tema que prefieras puesto en la barra.

**"Al exportar a Archi faltan cosas."**
Archi solo entiende ArchiMate: lo que esté en otras notaciones (BPMN, C4, rejillas…) se omite y se avisa. Para no
perder nada, guarda también un **JSON de all-draw**.

**"No me sale la opción XState o BPMN en Exportar la vista."**
Esas opciones solo aparecen cuando la vista abierta es de estados (XState) o BPMN.
