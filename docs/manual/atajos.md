# Atajos de teclado, ratón y gestos

Todo lo que se puede hacer con el teclado, el ratón o el dedo en el editor de all-draw, en un solo sitio.
Dentro del editor, pulsa **?** para ver un resumen en pantalla (o el botón **Atajos de teclado** de la barra).

> [!TIP]
> **En Mac**, usa **Cmd** (⌘) donde aquí pone **Ctrl**: **Cmd+Z**, **Cmd+C**, **Cmd+K**… Los dos funcionan.
> **Alt** es la tecla **Opción** (⌥), y **Supr** es la tecla **Borrar** (⌫). Si **F2** no responde, prueba
> **fn+F2**.

## Antes de empezar: dónde está el foco {#foco}

Hay dos clases de atajos:

- **Globales**: funcionan en cualquier parte del editor mientras no estés escribiendo en un campo. Son
  **Ctrl+K**, **Ctrl+F**, **?** y **F2** (y **Ctrl+Shift+E**, que funciona incluso escribiendo).
- **Del lienzo**: el resto (copiar, pegar, mover con flechas, zoom, borrar…). Solo funcionan cuando el foco está
  en el lienzo. Si un atajo "no hace nada", **haz clic en una zona vacía del lienzo** y vuelve a probar.

Mientras escribes en un campo de texto (el inspector, el buscador de la paleta…), las teclas escriben texto y
los atajos del lienzo no se disparan. Así **Supr** borra letras y no nodos.

## General {#general}

| Atajo | Qué hace |
|---|---|
| **Ctrl+K** o **Ctrl+F** | Abre (o cierra) la búsqueda: elementos, vistas y acciones |
| **?** | Abre (o cierra) el panel de atajos |
| **Ctrl+Shift+E** | Abre (o cierra) el [panel de texto](dsl.md#editar-como-texto) |
| **Esc** | Cierra menús, paneles y diálogos; cancela el renombrado |
| **Shift+F10** o tecla **Menú** | Abre el menú contextual de lo seleccionado en el lienzo (o el del lienzo, sin selección) |
| **Ctrl+Z** | Deshacer |
| **Ctrl+Y** o **Ctrl+Shift+Z** | Rehacer |

> [!NOTE]
> En el editor, **Ctrl+F** abre la búsqueda de all-draw en lugar de la búsqueda del navegador.

## Selección {#seleccion}

| Atajo | Qué hace |
|---|---|
| **Clic** | Selecciona un nodo o una arista |
| **Shift+clic** | Añade o quita de la selección |
| **Shift+arrastrar** sobre el fondo | Selección por área (todo lo que quede dentro del rectángulo) |
| **Ctrl+A** | Selecciona todos los nodos y aristas de la vista |
| **Clic en el fondo** | Quita la selección y muestra la vista en el inspector |
| **F2** | Renombra el elemento seleccionado (con un solo nodo seleccionado) |

## Edición {#edicion}

| Atajo | Qué hace |
|---|---|
| **Ctrl+C** | Copia los nodos seleccionados (y las aristas entre ellos) |
| **Ctrl+V** | Pega **nuevas apariciones de los mismos elementos**. Sirve para llevar elementos a otra vista |
| **Ctrl+Shift+V** | Pega como **copia**: crea elementos nuevos e independientes |
| **Ctrl+D** | Duplica la selección (elementos nuevos), un poco desplazada |
| **Flechas** | Mueven la selección 1 px |
| **Shift+flechas** | Mueven la selección 10 px |
| **Supr** o **Retroceso** | **Quita de la vista** los nodos y aristas seleccionados (elementos y relaciones siguen en el modelo) |
| **Shift+Supr** | Sobre aristas: **borra la relación** del modelo, con todas sus aristas en todas las vistas (pide confirmación) |
| **Alt** (mantener) | Desactiva el ajuste a rejilla mientras arrastras |

> [!WARNING]
> **Shift+Supr** sobre una arista no solo la quita de la vista: borra la relación en todas las vistas. Si te
> equivocas, **Ctrl+Z**. Cuidado con **Ctrl+A** seguido de **Shift+Supr**: como **Ctrl+A** selecciona también las
> aristas, borraría todas las relaciones dibujadas en la vista. Más en
> [Modelo y vistas](modelo-y-vistas.md#quitar-o-borrar).

En una rejilla capas × etapas, lo que pegas va a la celda que está bajo el cursor.

## Vista y zoom {#vista}

| Atajo | Qué hace |
|---|---|
| **+** (o **=**) | Acercar |
| **-** | Alejar |
| **Ctrl+0** | Zoom al 100 % |
| **Ctrl+Shift+F** | Ajustar a la vista (encuadra todos los nodos) |

## Renombrar en línea {#renombrar}

Al renombrar un nodo en el propio lienzo (con **F2** o doble clic sobre el nombre):

| Tecla | Qué hace |
|---|---|
| **Intro** | Confirma el nombre |
| **Esc** | Cancela y deja el nombre como estaba |
| **Shift+Intro** | Salto de línea (solo en las notas) |

## Búsqueda (Ctrl+K) {#busqueda}

| Tecla | Qué hace |
|---|---|
| Escribir | Filtra elementos, vistas y acciones (sin tildes y con una errata por palabra) |
| **↑** / **↓** | Mueve la selección por la lista |
| **Intro** | Abre el resultado elegido |
| **Esc** | Si estabas eligiendo vista para un elemento, o en *Ir a la vista…* / *Nueva vista…*, vuelve a los resultados; si no, cierra |

## Panel de texto (Ctrl+Shift+E) {#texto}

Con el foco en el texto del panel ([Editar como texto](dsl.md#editar-como-texto)):

| Tecla | Qué hace |
|---|---|
| **Ctrl+Espacio** | Sugerencias de tipos e ids (también salen solas al escribir) |
| **↑** / **↓**, **Intro** o **Tab** | Recorre y elige la sugerencia; **Esc** cierra la lista |
| **Ctrl+F** | Busca en el texto (no abre la búsqueda general) |
| **Intro** / **F3** | Coincidencia siguiente; con **Shift**, la anterior |
| **Ctrl+S** | Aplica el texto ya, sin esperar |
| **Tab** / **Shift+Tab** | Sangra / quita sangría |
| **Esc**, luego **Tab** | Sale del texto con el teclado |
| **Ctrl+Z** | Deshace lo escrito en el texto (en el lienzo, deshace el cambio aplicado entero) |

## Comentarios {#comentarios}

| Tecla | Qué hace |
|---|---|
| **Ctrl+Intro** | Envía el comentario o la respuesta |
| **@** | Empieza una mención; aparece la lista de personas |
| **↑** / **↓** | Recorre la lista de menciones |
| **Intro** o **Tab** | Elige la mención resaltada |
| **Esc** | Cierra la lista de menciones; si no hay lista, cancela el borrador |

Más en [Comentarios](comentarios.md).

## Diálogos {#dialogos}

En los diálogos (entrar, compartir, búsqueda, atajos, Espacio…):

| Tecla | Qué hace |
|---|---|
| **Tab** / **Shift+Tab** | Pasa al control siguiente / anterior (el foco no sale del diálogo) |
| **Esc** | Cierra el diálogo y devuelve el foco al botón que lo abrió |

## Menús, paleta y paneles {#menus-y-paneles}

| Tecla | Dónde | Qué hace |
|---|---|---|
| **↑** / **↓**, **Inicio** / **Fin** | Menú contextual | Recorre las opciones; **Intro** elige; **Esc** o **Tab** lo cierran y el foco vuelve al lienzo |
| **Tab**, luego **↑** / **↓** | Paleta y lista de vistas | Entra en la lista (una sola parada de **Tab**) y se mueve por ella |
| **Intro** o **Espacio** | Un tipo de la paleta | Lo añade en un hueco libre cerca del centro del lienzo visible (igual que un clic) |
| **F** o **\*** | Un tipo de la paleta | Lo marca o desmarca como favorito |
| **Intro** / **Supr** | Una vista de la lista | La abre / la borra (pide confirmación) |
| **←** / **→** | Pestañas (paleta, inspector, Espacio) | Cambia de pestaña |

## Ratón {#raton}

| Gesto | Dónde | Qué hace |
|---|---|---|
| Arrastrar | Fondo del lienzo | Desplaza la vista |
| Rueda | Lienzo | Acerca o aleja |
| Doble clic | Fondo del lienzo | Acerca |
| Arrastrar | Desde la paleta al lienzo | Crea un nodo (o una aparición, desde la pestaña **Modelo**) |
| Clic | Un tipo de la paleta | Lo añade en un hueco libre cerca del centro del lienzo |
| Arrastrar | Un nodo | Lo mueve; si lo sueltas dentro de un contenedor, lo anida |
| Arrastrar | Esquinas de un nodo seleccionado | Cambia su tamaño |
| Arrastrar | Desde el borde inferior de un nodo hasta otro | Crea una relación (aparece el menú **Tipo de relación**). Mientras arrastras, el destino se marca en verde si vale y en rojo si no, con el motivo |
| Arrastrar | Desde el borde inferior de un nodo hasta un hueco vacío | Menú **Crear y conectar**: crea un elemento ahí ya conectado (un solo Ctrl+Z lo deshace) |
| Arrastrar | Desde un pin hasta otro pin | Crea una relación entre pines, con su mapeo |
| Doble clic | Un nodo | Entra en su vista de detalle |
| Doble clic | El nombre de un nodo | Lo renombra en línea |
| Doble clic | Una arista | Añade un punto de quiebre |
| Arrastrar | Un punto de quiebre | Lo mueve |
| Doble clic | Un punto de quiebre | Lo quita |
| Clic derecho | Un nodo | Menú del nodo: abrir en otra dimensión, detalle, trazas, comentar, pines, quitar, borrar |
| Clic derecho | Fondo del lienzo | Menú del lienzo: **Pegar aquí**, **Añadir nota**, **Comentar aquí**, **Seleccionar todo**, **Ajustar a la vista**, **Layout automático** |
| Arrastrar o rueda | Minimapa (esquina inferior derecha) | Desplaza o acerca la vista |

Abajo a la izquierda del lienzo están también los botones de acercar, alejar y ajustar a la vista.

## Pantallas táctiles {#tactil}

all-draw se adapta al tamaño de la pantalla:

- **Escritorio** (1100 px o más): las tres columnas a la vista.
- **Tableta** (de 700 a 1099 px): la barra tiene dos botones para **mostrar u ocultar** la columna de vistas y
  paleta y la del inspector. La elección se recuerda.
- **Móvil** (menos de 700 px): el lienzo ocupa toda la pantalla y abajo aparece una barra con **Vistas**,
  **Añadir**, **Inspector** y **Más**. Cada botón abre una hoja que sube desde abajo.

| Gesto | Qué hace |
|---|---|
| Tocar | Selecciona un nodo o una arista |
| Arrastrar con un dedo sobre el fondo | Desplaza la vista |
| Pellizcar | Acerca o aleja |
| Arrastrar un nodo | Lo mueve |
| **Mantener pulsado** un nodo (medio segundo, sin mover el dedo) | Abre el menú del nodo, igual que el clic derecho |
| Tocar un tipo en la hoja **Añadir** | Lo añade en un hueco libre cerca del centro del lienzo |
| Tocar fuera de la hoja, arrastrar su asa hacia abajo o pulsar su **×** | Cierra la hoja |

En la hoja **Más** están la ruta de vistas, **Espacio**, buscar, ajuste a rejilla, tema, atajos, **Ajustar a la
vista**, **Layout automático** y las acciones del espacio (importar/exportar, compartir…). Los botones de
deshacer y rehacer se quedan siempre en la barra superior.

> [!TIP]
> Sin teclado, el menú del nodo (mantener pulsado) sustituye a varios atajos: **Entrar en el detalle** en vez
> del doble clic, **Quitar de esta vista** en vez de **Supr**. Para renombrar, abre la hoja **Inspector** y
> edita el nombre arriba.

## Problemas frecuentes {#problemas-frecuentes}

**Un atajo no hace nada.**
Haz clic en una zona vacía del lienzo para darle el foco. Si estás escribiendo en un campo, los atajos del
lienzo no funcionan a propósito.

**Ctrl+V no pega nada.**
Primero hay que copiar nodos de all-draw con **Ctrl+C**. En un espacio de solo lectura no se puede pegar.

**He pulsado Shift+Supr y ha desaparecido una relación de todas las vistas.**
Tenías seleccionada una arista: **Shift+Supr** borra la relación del modelo. Pulsa **Ctrl+Z**. **Supr** solo la
habría quitado de esta vista.

**Las flechas desplazan la página en vez de mover el nodo.**
El foco no está en el lienzo, o no hay nada seleccionado. Selecciona el nodo con un clic y vuelve a probar.

**En el móvil, la pulsación larga no abre el menú.**
Mantén el dedo quieto sobre el nodo: si se mueve más de unos pocos píxeles, se interpreta como arrastre. La
pulsación larga solo funciona sobre nodos, no sobre el fondo.

**En un espacio de solo lectura muchos atajos no responden.**
Es normal: solo funcionan los de navegación (búsqueda, seleccionar todo, zoom, ajustar a la vista, **Esc**).
