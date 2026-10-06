# El editor

El editor es donde dibujas: añades elementos, los conectas, los ordenas y rellenas sus datos. Este capítulo
recorre cada parte de la pantalla y las tareas del día a día. Si todavía no tienes claro qué es un *elemento*, una
*vista* o una *notación*, echa antes un vistazo a [Conceptos](conceptos.md).

![Editor: barra arriba, vistas y paleta a la izquierda, lienzo en el centro, inspector a la derecha](img/03-editor-archimate.png)

## Las zonas de la pantalla {#zonas}

La disposición se adapta al ancho de la ventana. Lo que cambia es *dónde* están las cosas, no lo que puedes hacer.

### En el ordenador {#escritorio}

Con una ventana ancha (1100 px o más) ves todo a la vez:

1. **Barra superior**, de izquierda a derecha:
   - **Espacio**: abre el panel de librerías, reglas, personas y trazabilidad (ver
     [Librerías, reglas y personas](librerias-reglas-personas.md)).
   - **☰**: vuelve a la lista de todos tus espacios.
   - **Nombre del espacio**: haz clic y escribe para cambiarlo.
   - **Ruta de vistas**: las vistas por las que has ido entrando (por ejemplo `Mapa › Alta de cliente`). Haz clic en
     cualquiera para volver a ella, o pulsa la flecha **Volver**. A la derecha, una etiqueta de color indica la
     notación de la vista actual.
   - **Personas conectadas** (solo en espacios del servidor), **Comentarios**, **Buscar**, **Ajuste a rejilla**,
     **Tema** y **Atajos de teclado**. Si no sabes qué es un botón, deja el ratón encima: aparece su nombre.
   - **Deshacer** y **Rehacer**.
   - **Estado de guardado**: `guardado en este navegador` en un espacio local; `● en línea`, `◌ conectando…` u
     `○ sin conexión (se sincroniza al volver)` en uno del servidor, seguido de tu rol.
   - **Importar / Exportar**, **Historial** (espacios del servidor), **Compartir** (si eres el propietario) o **Subir al
     servidor** (si el espacio es local), y el selector de idioma.
2. **Columna izquierda**: arriba el panel **Vistas** (agrupadas por notación, con las **Dimensiones** y un resumen
   del **Modelo**) y debajo la **Paleta**.
3. **Lienzo** en el centro, con los controles de zoom y el minimapa en las esquinas. Debajo, la barra de
   **problemas**.
4. **Inspector** a la derecha: muestra lo que tengas seleccionado (un elemento, una arista o, si no hay nada, la
   vista).

### En tableta {#tableta}

Las dos columnas laterales se pueden ocultar para dejar más sitio al lienzo:

- El botón del extremo izquierdo de la barra (**Mostrar u ocultar vistas y paleta**) o **Ctrl+B** pliega la columna
  izquierda.
- El del extremo derecho (**Mostrar u ocultar el inspector**) o **Ctrl+Alt+B** pliega el inspector.

La aplicación recuerda en este navegador qué paneles dejaste abiertos.

### En el móvil {#movil}

Por debajo de 700 px el lienzo ocupa toda la pantalla. La barra de arriba se reduce al nombre, deshacer/rehacer y
**Más opciones**, y aparece una **barra inferior** con cuatro botones. Cada uno abre una **hoja** que sube desde
abajo:

| Botón | Qué contiene |
|---|---|
| **Vistas** | La lista de vistas y dimensiones. |
| **Añadir** | La paleta. **Toca** un elemento para añadirlo en un hueco libre cerca del centro del lienzo (en el móvil no se arrastra). |
| **Inspector** | Los datos de lo seleccionado. |
| **Más** | La ruta de vistas, **Espacio**, buscar, rejilla, tema, atajos, **Ajustar a la vista**, **Layout automático** y las acciones de la aplicación (importar/exportar, compartir, idioma…). |

Para cerrar una hoja, toca fuera de ella, pulsa el botón de cerrar o arrástrala hacia abajo desde el asa. En pantallas táctiles,
**mantén pulsado** medio segundo sobre un nodo para abrir su menú (el equivalente al botón derecho), que sube desde abajo como
una hoja.

## La paleta {#paleta}

La paleta es el cajón del que sacas lo que vas a dibujar. Tiene un campo **Buscar…** que filtra la pestaña abierta y
cuatro pestañas:

| Pestaña | Qué hay | Cuándo usarla |
|---|---|---|
| **Notación** | Los tipos de la notación de la vista actual, agrupados por categoría. Si la vista tiene un *viewpoint*, los tipos que no encajan aparecen atenuados al final. Debajo, plegadas, las demás notaciones ("otra notación"). | Casi siempre: es lo normal para dibujar. |
| **Librerías** | Los tipos que has creado en tus librerías y los **componentes** (plantillas reutilizables). | Cuando trabajas con tipos propios o importados de Drawer u OpenAPI. |
| **Modelo** | Los elementos que **ya existen** en el espacio. Los que no aparecen en ninguna vista se marcan como huérfanos. | Para dibujar en esta vista algo que ya está en otra. |
| **Visual** | **Nota**, **Grupo** (un marco que arrastra lo que contiene), **Etiqueta** (texto sin borde) e **Imágenes** (por URL o desde un fichero, que se guarda dentro del espacio). | Para anotar y decorar: estos nodos no son parte del modelo y solo existen en esta vista. |

Encima de las categorías de **Notación** hay dos secciones que solo existen en tu navegador:

- **Favoritos**: pasa el ratón por un tipo y pulsa la **estrella** (con el teclado, **F** sobre el tipo). Vuelve a
  pulsarla para quitarlo.
- **Recientes**: los 8 últimos tipos que has añadido (desde la paleta, con Ctrl+K o con *Crear y conectar*).

Las categorías se pliegan y despliegan con un clic en su título, y la paleta lo **recuerda para cada notación**: si en
BPMN pliegas *Coreografía*, seguirá plegada la próxima vez que abras una vista BPMN.

> [!TIP]
> Arrastrar desde **Modelo** no crea un elemento nuevo: crea otra *aparición* del mismo. Si luego le cambias el
> nombre, cambia en todas las vistas. Es la forma correcta de reutilizar; ver [Modelo y vistas](modelo-y-vistas.md).

## Añadir nodos {#anadir}

1. En la paleta, busca el tipo que quieres (por ejemplo, *Business Process* en ArchiMate o *Tarea* en BPMN).
2. **Arrástralo** al lienzo y suéltalo donde quieras. Con un **clic** (o **Intro** con el teclado) se añade en un hueco
   libre cerca del centro del lienzo. En el móvil, abre **Añadir** y tócalo.
3. El nodo nace con el nombre del tipo. Pulsa **F2** (o haz doble clic sobre el nombre) y escribe el nombre real.
   **Enter** confirma, **Esc** cancela.
4. Rellena el resto de datos en el **Inspector** (documentación, campos, etiquetas).

Si lo sueltas encima de un contenedor (un pool, un grupo, un sistema C4…), queda dentro de él; ver [Anidar](#anidar).

## Conectar elementos {#conectar}

1. Pasa el ratón por encima del nodo de origen: aparecen unos puntos pequeños en su borde.
2. Arrastra desde el **punto del borde inferior** hasta el otro nodo y suelta sobre él (mientras arrastras se
   iluminan los puntos de conexión de todos los nodos). Mientras arrastras, el nodo que tienes debajo se marca en
   **verde** si la conexión vale, con una etiqueta que dice qué relación se creará (o cuántas hay para elegir), y en
   **rojo** si no vale, con el motivo (por ejemplo, que en BPMN el flujo de secuencia no sale de su pool).
3. Lo que pasa depende de la notación:
   - si solo hay **una** relación posible entre esos dos tipos, se crea directamente;
   - si hay **varias**, aparece el menú **Tipo de relación** para que elijas (la relación por defecto de la notación
     sale la primera);
   - si **ninguna** está permitida, la línea no se engancha y no se crea nada.

### Crear y conectar {#crear-y-conectar}

Si sueltas la conexión en un **hueco vacío** del lienzo, aparece el menú **Crear y conectar** con los tipos de la
notación que admiten una relación desde el origen: primero los que aceptan la relación habitual (en BPMN, el flujo de
secuencia), y dentro de ellos los que has usado hace poco y los que más hay en el espacio; el resto, en **Más tipos**.
Al elegir uno se crea el elemento en ese punto, ya conectado con la relación por defecto. Es **un solo paso** de
deshacer: **Ctrl+Z** quita el elemento y la relación a la vez. Desde una tarea BPMN, así se dibuja un proceso entero
sin volver a la paleta.

### Por qué se rechaza una conexión {#conexion-rechazada}

Cada notación tiene una **matriz de validez**: una tabla que dice qué relaciones se permiten entre cada par de tipos.
Por ejemplo, en BPMN un flujo de secuencia no puede salir de un pool. Si la conexión no "engancha", es que esa
relación no está permitida. Lee [Validez](conceptos.md#validez) para entender la idea y prueba alguna de estas salidas:

- conecta en el otro sentido (muchas relaciones solo valen en una dirección);
- elige otro tipo de elemento, más adecuado a lo que quieres expresar;
- si mezclas notaciones a propósito, usa una relación puente (traza, realiza, refina): ver
  [Trazas](conceptos.md#trazas).

Las relaciones que ya existían y han dejado de ser válidas (por ejemplo, tras cambiar un tipo) no desaparecen: salen
como error en el [panel de problemas](#problemas), con un botón para arreglarlas.

### Editar una arista {#aristas}

Selecciona la arista (haz clic sobre la línea) y, en el inspector, puedes cambiar:

- el **tipo de relación**, el nombre y la documentación;
- los campos propios de la relación (la condición de un flujo de secuencia BPMN, el evento y la guarda de una
  transición de estados…);
- el **Trazado**: *Recta*, *Curva* u *Ortogonal*, y el estilo de la **Línea** (*Continua*, *Discontinua*,
  *Punteada*).

**Doble clic** sobre la línea añade un **punto de quiebre**: arrástralo para dar forma a la arista y haz doble clic
sobre él para quitarlo. Con una arista seleccionada que tenga puntos de quiebre aparece el botón **Quitar
bendpoints**, que los elimina todos a la vez.

## Pines {#pines}

Los **pines** son datos concretos de un elemento convertidos en puntos de conexión. Por ejemplo, una API puede tener
un pin por cada campo de su respuesta (`respuesta.cliente.email`). Sirven para decir *qué dato* viaja de un sitio a
otro, no solo que dos cosas están relacionadas. La idea completa está en [Pines](conceptos.md#pines).

![Inspector, pestaña Pines, sobre un microservicio de la demo](img/07-rejilla-pines.png)

Para usarlos:

1. Selecciona el nodo y abre la pestaña **Pines** del inspector.
2. Marca los pines que quieres ver en *este* nodo, o pulsa **Todos** / **Ninguno**. Los que ya usa una relación
   llevan **●** y no se pueden ocultar. También puedes usar **Mostrar pines** / **Ocultar pines** en el menú del
   botón derecho.
3. Los pines aparecen como cuadraditos naranjas: los de **entrada** a la izquierda y los de **salida** a la derecha.
4. Arrastra desde un pin de salida hasta un pin de entrada de otro nodo. Solo se ofrecen las relaciones compatibles
   con esos tipos de dato.

Una relación entre pines guarda además el **mapeo** (qué campo va a qué campo) y lo muestra como etiqueta sobre la
arista. En la demo, el microservicio `clientes-api` conecta `cliente.email` con `notificaciones`.

Los pines salen de los campos del tipo: los campos *JSON*, *Lista* y *Clave → valor* generan pines solos, y cualquier
otro campo puede marcarse con **genera pines** en la librería; ver
[Pines en los campos](librerias-reglas-personas.md#pines-en-campos). Si un elemento no tiene pines, la pestaña lo
dice.

## Anidar {#anidar}

Anidar es meter un nodo dentro de otro: una tarea dentro de un carril, un contenedor dentro de un sistema C4, un
estado dentro de un estado compuesto.

1. Arrastra el nodo hijo y suéltalo **dentro** del padre. Solo funciona si el padre es un **contenedor** en su
   notación (pool, carril y subproceso en BPMN; sistema y contenedor en C4; estado compuesto; grupo en ArchiMate;
   paquete en UML…).
2. A partir de ahí, el hijo se mueve con el padre.
3. Si la notación define una relación implícita para el anidamiento, se crea sola. En ArchiMate, por ejemplo, meter
   una aplicación dentro de otra crea una *Composition*.
4. Para sacarlo, arrástralo fuera del padre.

¿Quieres agrupar cosas visualmente sin crear relaciones? Usa un **Grupo** de la pestaña **Visual**.

## Mover, redimensionar y alinear {#mover}

- **Mover**: arrastra el nodo. Con el teclado, las **flechas** lo mueven 1 px y **Shift + flechas**, 10 px.
- **Desplazar el lienzo**: arrastra sobre una zona vacía o por dentro de un contenedor sin seleccionar, usa la rueda
  del ratón, o mantén **Espacio** (o el botón central) y arrastra desde cualquier sitio, también encima de un nodo. La
  tecla **H** activa la mano (ver [Moverse por el lienzo](atajos.md#moverse)). **Zoom**: **Ctrl+rueda**, pellizco,
  las teclas **+** / **−**, o los botones de la esquina. **Ctrl+0** vuelve al 100 % y **Ctrl+Shift+F** encuadra toda la
  vista.
- **Redimensionar**: selecciona el nodo y arrastra sus esquinas. También puedes escribir el ancho y el alto en la
  pestaña **Estilo** del inspector.
- **Ajuste a rejilla** (botón de la barra): los nodos se colocan en saltos de 8 px. Mantén **Alt** mientras arrastras
  para desactivarlo un momento.
- **Seleccionar varios**: **Shift + clic** en cada uno, o **Shift + arrastrar** sobre una zona vacía para dibujar un
  rectángulo de selección. **Ctrl+A** selecciona todo.

Con **dos o más** nodos seleccionados aparece una barra flotante de alineación:

| Grupo | Botones |
|---|---|
| Horizontal | Alinear a la izquierda, Centrar horizontalmente, Alinear a la derecha |
| Vertical | Alinear arriba, Centrar verticalmente, Alinear abajo |
| Distribuir (con 3 o más) | Distribuir horizontalmente, Distribuir verticalmente |
| Tamaño | Igualar ancho, Igualar alto |

**Layout automático** (botón derecho sobre el lienzo, hoja **Más** en el móvil, o Ctrl+K → "Layout automático de la
vista") recoloca todos los nodos según la notación: por capas en BPMN y diagramas de flujo, en árbol en los mapas
mentales, celda a celda en la rejilla. Si no te gusta el resultado, **Ctrl+Z** lo deshace entero.

## Copiar, pegar y duplicar {#copiar}

| Atajo | Qué hace |
|---|---|
| **Ctrl+C** y luego **Ctrl+V** | Pega **nuevas apariciones de los mismos elementos**. Es el truco para llevar algo a otra vista: copia, cambia de vista y pega. |
| **Ctrl+Shift+V** | Pega como **copia**: crea elementos nuevos, independientes del original. |
| **Ctrl+D** | Duplica la selección (elementos nuevos) en la misma vista. |

Con el botón derecho sobre el lienzo, **Pegar aquí** deja lo copiado bajo el puntero. En una rejilla, lo pegado va a
la celda que tengas debajo. Si pegas algo copiado de *otro* espacio (por ejemplo, en otra pestaña), siempre se pega
como copia, porque esos elementos no existen en este espacio.

## Quitar o borrar {#borrar}

Hay una diferencia importante entre **quitar de la vista** y **borrar del modelo**:

| Acción | Cómo | Resultado |
|---|---|---|
| Quitar un nodo de la vista | **Supr** (o Retroceso) con el nodo seleccionado, o **Quitar de esta vista** en su menú | El nodo desaparece de esta vista, pero el elemento sigue en el modelo y en las demás vistas. |
| Borrar un elemento del modelo | **Borrar del modelo** en el menú del botón derecho (pide confirmación) | El elemento desaparece de **todas** las vistas, con sus relaciones. |
| Quitar una arista de la vista | **Supr** con la arista seleccionada, o **Quitar de esta vista** en su menú o en el inspector | La arista desaparece de esta vista; la **relación** sigue en el modelo y en las demás vistas. |
| Borrar una relación del modelo | **Shift+Supr** con la arista seleccionada, o **Borrar del modelo** en su menú o en el inspector (pide confirmación) | Se borra la **relación** del modelo, y con ella todas sus aristas en todas las vistas. |

Si te equivocas, **Ctrl+Z** lo recupera.

## El inspector {#inspector}

El inspector cambia según lo que selecciones.

Los campos de los tipos llevan una **ayuda** debajo (y un icono ⓘ junto al nombre) cuando la notación la define: qué
significa el campo y qué valores espera. Por ejemplo, en BPMN *Tipo de tarea* explica cada tipo, y en ER *Al borrar*
qué pasa con las filas hijas.

**Un elemento** tiene cuatro pestañas:

| Pestaña | Contenido |
|---|---|
| **Datos** | Nombre, documentación, los campos de su tipo, propiedades libres, **Etiquetas** (separadas por comas), la lista de **Relaciones**, las **Personas** asignadas y sus comentarios. |
| **Pines** | Qué pines se ven en este nodo; ver [Pines](#pines). |
| **Dónde** | **Vistas de detalle** del elemento, en qué vistas **Aparece en**, qué vista se abre al hacer doble clic, y sus **Trazas** y **Sugerencias** de traza con otras notaciones. |
| **Estilo** | Relleno, borde, color del texto, tamaño, texto alternativo y figura. Solo afecta a **esta aparición**: para pintar por datos en todas las vistas, usa [reglas](librerias-reglas-personas.md#reglas). |

**Una arista** muestra el tipo de relación, sus campos, el trazado y la línea (ver [Editar una arista](#aristas)).

**Nada seleccionado** muestra la **vista**: nombre, descripción, *viewpoint* (que limita qué tipos encajan),
elemento raíz y, en una rejilla, las capas y etapas.

## Menús del botón derecho {#menus}

![Menú del nodo con "Abrir en otra dimensión"](img/05-menu-dimension.png)

**Sobre un nodo** (o pulsación larga en táctil):

- **Entrar en el detalle**, si el nodo tiene una vista de detalle (también con doble clic sobre el nodo).
- **Abrir en otra dimensión**: salta a la vista de ese elemento en otra notación, o la crea si no existe. Ver
  [Dimensiones](conceptos.md#dimensiones).
- **Nueva vista de detalle…**, en cualquier notación.
- **Aparece en**: las vistas donde ya está dibujado.
- **Trazas**: hasta tres sugerencias de traza con elementos parecidos de otras notaciones (**Enlazar con…**).
- **Comentar**, **Mostrar pines** / **Ocultar pines**, **Quitar de esta vista** y **Borrar del modelo**.

**Sobre una arista**: **Comentar**, **Quitar de esta vista** (**Supr**) y **Borrar del modelo** (**Shift+Supr**, pide
confirmación). Los mismos dos botones están al final del inspector de la arista.

**Sobre el lienzo vacío**: **Pegar aquí**, **Añadir nota**, **Comentar aquí**, **Seleccionar todo**, **Ajustar a la
vista** y **Layout automático**.

## Rejilla capas × etapas {#rejilla}

En una vista de tipo *Capas × etapas* el lienzo es una tabla: las filas son **capas** (por ejemplo Negocio,
Aplicación, Tecnología) y las columnas, **etapas** de un proceso. Puede llevar encima una banda de grupos de etapas.

1. Suelta los nodos dentro de una **celda**: quedan asociados a ella y se mueven si la celda cambia de sitio. Fuera
   de las celdas no se puede soltar.
2. Para editar capas y etapas, haz clic en una zona vacía y usa el inspector de la vista: nombre, color, tamaño y
   orden, con los botones **capa** y **etapa** para añadir.
3. Si borras una capa o etapa, sus nodos quedan fuera de la rejilla hasta que los muevas a otra celda.

Es la vista que crea el importador de `.drawer`. Más detalles en [Rejilla](notaciones/grid.md).

## Buscar (Ctrl+K) {#buscar}

**Ctrl+K** (o **Ctrl+F**, o el botón **Buscar** de la barra) abre la búsqueda. Escribe y elige con las flechas y **Enter**:

- **Elementos**: te lleva a uno y lo encuadra. Si está en varias vistas y no en la actual, te pregunta a cuál ir.
- **Vistas**: las abre. **Ir a la vista…** deja en la lista solo las vistas.
- **Añadir *tipo***: uno por cada tipo de la notación de la vista y de tus librerías (escribe «añadir tarea»): lo pone
  en un hueco libre del lienzo, igual que un clic en la paleta.
- **Acciones**: **Nueva vista…** (eliges la notación), abrir **Espacio**, **Layout automático de la vista**,
  **Simular esta vista** (BPMN y estados), **Exportar la vista como SVG / PNG / PDF / Mermaid / draw.io**, exportar el
  espacio en JSON, **Importar un fichero…**, **Generar código…**, **Compartir…** e **Historial de versiones…** (en los
  espacios del servidor, si puedes usarlos), **Abrir la documentación** de la notación de la vista, **Ajustar a la
  vista**, cambiar el tema y ver los atajos.

La búsqueda no distingue tildes ni mayúsculas y perdona **una errata por palabra** («conetar», «exportr svg»). Al
abrirla sin escribir nada, arriba salen tus **recientes**: lo último que elegiste aquí.

**Esc** cierra la búsqueda (o vuelve a la lista si estabas en *Ir a la vista…* o *Nueva vista…*). Junto con el
inspector, es la forma de recorrer el modelo sin ratón.

## Editar como texto (Ctrl+Shift+E) {#texto}

El botón **Texto** de la barra (o **Ctrl+Shift+E**) abre a la izquierda del lienzo el **panel de texto**: la vista
actual —o todo el espacio— escrita en el [lenguaje textual](dsl.md) de all-draw. Escribe y, al dejar de teclear, el
lienzo se pone al día (un solo paso de deshacer); cambia algo en el lienzo y el texto se rehace. Tiene numeración de
líneas, colores, sugerencias de tipos e ids (**Ctrl+Espacio**), búsqueda (**Ctrl+F**) y la lista de errores con
línea y columna. Poner el cursor en una declaración la selecciona en el lienzo, y al revés. El borde derecho del panel
se arrastra para cambiar su ancho. Todos los detalles en [Editar como texto](dsl.md#editar-como-texto).

## Panel de problemas {#problemas}

![Panel de problemas desplegado](img/08-problemas.png)

La barra de debajo del lienzo resume cuántos **errores**, **avisos** y **notas** hay. Se recalcula un
momento después de cada cambio (verás `calculando…`), por partes y en los ratos libres del navegador, para que en
vistas grandes no frene lo que estés haciendo. Haz clic en ella para desplegar la lista:

1. Haz clic en el texto de un problema para ir a él: abre la vista y selecciona el nodo o la arista.
2. Si hay un botón al lado, es un **arreglo** automático: cambiar la relación por una válida, borrar un duplicado,
   quitar de la vista algo que no encaja en el viewpoint, borrar un elemento que no está en ninguna vista, crear la
   traza sugerida…
3. Si no hay botón, corrígelo a mano y el problema desaparecerá solo.

Qué se comprueba:

| Grupo | Ejemplos |
|---|---|
| Modelo | Referencias rotas, tipos desconocidos, relaciones no permitidas por la matriz, pines que ya no existen, elementos sin nombre o repetidos, elementos y relaciones que no aparecen en ninguna vista. |
| Vista | Elementos fuera del *viewpoint*, nodos solapados, aristas que atraviesan nodos, nodos demasiado pequeños. Solo se revisa la vista abierta. |
| BPMN | Diez reglas de *bpmnlint* (eventos de inicio y fin, nodos desconectados, compuertas superfluas…); ver la [tabla de reglas](importar-exportar.md#bpmnlint). |
| Trazas | Elementos que no tienen traza hacia otra notación (como nota). |
| Comentarios | Hilos sin resolver (como nota). |

> [!NOTE]
> Los errores no impiden guardar ni exportar: son una ayuda, no un bloqueo.

## Trazabilidad entre notaciones {#trazabilidad}

Cuando un mismo asunto está dibujado en varias notaciones (el proceso en BPMN, la aplicación en ArchiMate, los
estados en una máquina de estados), las **trazas** dicen qué se corresponde con qué. El editor te ayuda en tres
sitios:

- la pestaña **Dónde** del inspector, con las **Trazas** del elemento y **Sugerencias** para enlazarlo;
- las sugerencias del menú del botón derecho (**Enlazar con…**);
- la pestaña **Trazabilidad** del panel **Espacio**, con una matriz entre dos notaciones, la cobertura y los huecos.
  También se abre desde el enlace "*N* trazas entre dimensiones" del panel Vistas.

Cómo usar la matriz, paso a paso: [Trazabilidad](librerias-reglas-personas.md#trazabilidad).

## Comentarios {#comentarios}

El botón de **Comentarios** de la barra abre el panel de hilos; el número indica cuántos quedan sin resolver. Para
comentar algo concreto, usa el botón derecho: **Comentar** sobre un nodo o **Comentar aquí** sobre el lienzo. Todo
sobre hilos, respuestas, menciones y resolver: [Comentarios](comentarios.md).

## Tema {#tema}

El botón **Tema** de la barra va pasando por **sistema** (sigue la configuración de tu equipo), **claro** y
**oscuro**; al pasar el ratón ves cuál está activo. La elección se guarda en este navegador. También puedes cambiarlo desde Ctrl+K → "Cambiar tema". Las
imágenes SVG exportadas con tema claro y oscuro se adaptan solas al tema de quien las mira.

## Atajos esenciales {#atajos}

Los ocho que más se usan (en Mac, **Cmd** en lugar de **Ctrl**):

| Atajo | Acción |
|---|---|
| **Ctrl+K** | Buscar elementos, vistas y acciones |
| **Ctrl+Z** / **Ctrl+Y** | Deshacer / rehacer |
| **F2** | Renombrar el elemento seleccionado |
| **Supr** | Quitar de la vista (nodos y aristas) |
| **Shift+Supr** | Borrar del modelo la relación de la arista seleccionada |
| **Ctrl+C** / **Ctrl+V** | Copiar / pegar (misma aparición) |
| **Ctrl+D** | Duplicar |
| **Ctrl+Shift+F** | Ajustar a la vista |
| **?** | Ver todos los atajos en pantalla |

La lista completa está en [Atajos de teclado](atajos.md).

## Accesibilidad {#accesibilidad}

- Todos los controles se alcanzan con **Tab** y el foco se ve. Los botones de icono tienen nombre accesible.
- Los diálogos (entrar, compartir, buscar, atajos, Espacio) retienen el foco mientras están abiertos y se cierran con
  **Esc**, devolviendo el foco al botón que los abrió.
- Los mensajes de estado (conexión, enlace copiado, recálculo de problemas) se anuncian a los lectores de pantalla.
- El lienzo es gráfico; la alternativa por teclado es la búsqueda (**Ctrl+K**) junto con el inspector, que muestra
  todos los datos de lo seleccionado en campos etiquetados. Las flechas mueven los nodos seleccionados y **Shift+F10**
  (o la tecla **Menú**) abre su menú contextual, que se recorre con las flechas.
- El texto tiene un contraste de al menos 4,5:1 en tema claro y oscuro, y si tu sistema pide reducir el movimiento,
  se desactivan las transiciones.
- En pantallas táctiles los botones tienen un área de toque de al menos 44 px.

## Errores comunes {#errores-comunes}

**"Arrastro y la conexión no se crea."**
La relación no está permitida entre esos tipos (o en ese sentido). Mira [Por qué se rechaza una
conexión](#conexion-rechazada).

**"No veo la paleta ni el inspector editable."**
Estás en modo **solo lectura** (enlace de lectura o rol **solo lectura**). Pide al propietario un enlace de edición; ver
[Compartir y colaborar](compartir-y-colaborar.md#roles). Comprueba también que no hayas ocultado los paneles con los
botones de los extremos de la barra (o con **Ctrl+B** / **Ctrl+Alt+B**).

**"Cambié el nombre de un nodo y cambió en otra vista."**
Es lo esperado: los dos nodos son apariciones del mismo elemento. Si querías una copia independiente, usa
**Ctrl+Shift+V** o **Ctrl+D**.

**"Pulsé Supr sobre una arista y la relación sigue en el modelo."**
Es lo esperado: **Supr** solo quita la arista de esta vista, igual que con los nodos. Para borrar la relación en
todas las vistas usa **Shift+Supr** o **Borrar del modelo** (menú del botón derecho o inspector).

**"Suelto un nodo en la rejilla y no aparece."**
En una vista *Capas × etapas* solo se puede soltar dentro de una celda.

**"El nodo no entra en el contenedor."**
El destino no es un contenedor en su notación. Usa un **Grupo** visual si solo quieres enmarcarlo.

**"Los nodos saltan a posiciones raras al moverlos."**
Está activado el **ajuste a rejilla**. Desactívalo o mantén **Alt** mientras arrastras.

**"Hay errores en el panel de problemas que no entiendo."**
Haz clic en el texto para ir al sitio y prueba el botón de arreglo si lo hay. Los errores no bloquean nada; puedes
seguir trabajando y resolverlos después.
