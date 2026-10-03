# Modelo y vistas

Este capítulo es práctico: cómo crear vistas, llevar un elemento de una vista a otra, navegar entre
dimensiones y borrar sin llevarte sustos. La teoría (qué es el modelo, qué es una aparición, por qué hay
dimensiones) está explicada con dibujos en [Conceptos](conceptos.md).

## Repaso en 30 segundos {#repaso}

| Nivel | Qué contiene | Ejemplo de la demo |
|---|---|---|
| **Modelo** | **Elementos** (tipo, nombre, documentación, campos, pines, etiquetas) y **relaciones** (tipo, origen, destino) | El proceso "Alta de cliente"; la relación *Serving* de "CRM" a ese proceso |
| **Vistas** | **Nodos** (dónde y cómo se dibuja un elemento en esa vista) y **aristas** (cómo se dibuja una relación) | El mismo proceso en la vista ArchiMate y en la rejilla capas × etapas |

Regla de oro: **lo que escribes en el inspector (nombre, datos) es del elemento y se ve en todas las vistas;
lo que haces con el ratón en el lienzo (mover, cambiar tamaño, colores de la pestaña Estilo) es de esa vista.**

## Clases de vista {#clases-de-vista}

Cada vista tiene una **notación**, que decide la paleta, las relaciones válidas y el aspecto de los nodos.
Según la notación, el lienzo funciona de una de estas tres maneras:

| Clase | Notaciones | Cómo es el lienzo |
|---|---|---|
| **Libre** | ArchiMate, BPMN, estados, C4, ER, UML, mapa mental, flujo, DFD, Libre | Lienzo abierto: colocas nodos donde quieras, los metes en contenedores y los unes con aristas. |
| **Rejilla** | Capas × etapas | Una tabla: las filas son **capas** y las columnas **etapas**. Cada nodo vive en una celda y se mueve con ella. |
| **Secuencia** | Diagrama de secuencia | Las líneas de vida son columnas y los mensajes, flechas horizontales que se ordenan arrastrándolas hacia arriba o hacia abajo. |

Las capas y etapas de una rejilla se editan en el inspector de la vista (secciones **Capas** y **Etapas**):
nombre, color, alto o ancho, añadir y quitar. Más detalles de cada notación en [Notaciones](notaciones.md).

## Crear una vista {#crear-vista}

**Desde el panel Vistas** (lo más habitual):

1. En la columna izquierda, en la cabecera **Vistas**, pulsa el botón **+** (*Nueva vista*).
2. Elige una notación de la lista (cada una con su punto de color).
3. Se crea la vista "Nueva vista *notación*" y se abre. Si es una rejilla, trae tres capas
   (Negocio, Aplicación, Tecnología) y tres etapas (Inicio, Proceso, Fin) para empezar.

**Desde la búsqueda**: pulsa **Ctrl+K**, escribe "crear vista" y elige "Crear vista *notación*".

**En el móvil**: botón **Vistas** de la barra inferior → **+**.

Después, haz clic en una zona vacía del lienzo para ver la vista en el **inspector** y completa:

| Campo | Para qué sirve |
|---|---|
| **Nombre** | El título de la vista en el panel y en la ruta de vistas. |
| **Descripción** | Un texto libre; aparece al pasar el ratón sobre la vista en el panel. |
| **Viewpoint** | Recorta la paleta a los tipos de un viewpoint (los demás salen atenuados). *(ninguno: todo)* lo desactiva. Ver [Conceptos → Viewpoints](conceptos.md#viewpoints). |
| **Elemento raíz** | El elemento del que esta vista es el detalle. Ver [El patrón del elemento raíz](modelo-y-vistas.md#patron-elemento-raiz). |
| **Pública (solo lectura con enlace)** | Solo en espacios del servidor: permite enseñar esta vista con un enlace de lectura. Ver [Compartir y colaborar](compartir-y-colaborar.md). |

La cabecera del inspector resume la vista: notación, número de nodos y, si tiene raíz, "detalle de *X*".

## Organizar, abrir y borrar vistas {#gestionar-vistas}

- El panel **Vistas** agrupa las vistas **por notación** (con el punto de color de cada una) y las ordena
  por nombre. Cada grupo se pliega con un clic en su título.
- Las vistas que tienen elemento raíz llevan delante un pequeño rombo (◇).
- **Clic** en una vista para abrirla. El espacio recuerda la última vista abierta y vuelve a ella la próxima
  vez.
- Para **borrar** una vista, pulsa la **×** que tiene a su derecha. Te pedirá confirmación y te
  recordará que los elementos siguen en el modelo. Se borran sus nodos y aristas, **no** los elementos ni las
  relaciones.
- Al final del panel, la sección **Modelo** muestra cuántos elementos y relaciones hay en todo el espacio y
  cuántas trazas cruzan dimensiones (clic para abrir la matriz de trazabilidad).

## Llevar un elemento a otra vista {#reutilizar}

Un elemento puede aparecer en tantas vistas como quieras. Dos maneras de conseguirlo:

1. **Pestaña Modelo de la paleta**: abre la vista de destino, ve a la pestaña **Modelo**, busca el elemento
   y **arrástralo** al lienzo. Se crea una nueva aparición del mismo elemento.
2. **Copiar y pegar**: selecciona uno o varios nodos, **Ctrl+C**, cambia de vista y **Ctrl+V**. Se pegan
   apariciones de los mismos elementos, con las aristas que los unían.

Puedes llevar un elemento incluso a una vista de **otra notación**: en la demo, el rol ArchiMate "Gestor
comercial" aparece también en la vista C4 "CRM · Contenedores".

> [!IMPORTANT]
> Si lo que quieres es un elemento **nuevo** parecido a otro (no el mismo), usa **Ctrl+Shift+V** (pegar como
> copia) o **Ctrl+D** (duplicar). Si usas Ctrl+V y luego renombras, cambiarás el nombre en todas partes.

Para saber cuántas veces aparece un elemento, selecciónalo: la cabecera del inspector dice "en *n* vistas", y
la pestaña **Dónde** las lista todas.

## Dimensiones {#dimensiones}

Una dimensión es un eje de navegación: "ver este elemento en BPMN", "verlo como estados". Sin dimensiones,
el menú **Abrir en otra dimensión** sale vacío. Ver [Conceptos → Dimensiones](conceptos.md#dimensiones).

**Añadir una dimensión:**

1. En el panel **Vistas**, despliega la sección **Dimensiones**.
2. Abre el desplegable **Añadir dimensión…**.
3. Elige una notación completa (por ejemplo "BPMN 2.0 (todo)") o uno de sus viewpoints (por ejemplo, bajo C4,
   "Contexto"). La dimensión se crea con el nombre y el color de la notación.

**Quitar una dimensión:** pulsa **×** junto a ella. Solo desaparece el atajo de navegación; las vistas que ya
creaste siguen ahí.

> [!TIP]
> Una dimensión con viewpoint es más concreta: "C4 · Contexto" solo encuentra vistas C4 con ese viewpoint, y
> al crear una nueva desde el menú, la crea ya con él.

## Abrir en otra dimensión {#abrir-en-otra-dimension}

![Menú del nodo: abrir en otra dimensión, aparece en, trazas](img/05-menu-dimension.png)

1. Haz **clic derecho** sobre un nodo (en pantallas táctiles, mantén pulsado medio segundo).
2. En la sección **Abrir en otra dimensión** verás una entrada por dimensión, con su color.
3. Elige una:
   - Si el elemento **ya tiene** una vista de detalle en esa notación, se abre.
   - Si la entrada dice **(crear)**, se crea una vista nueva llamada "*elemento* · *dimensión*", con ese
     elemento como **raíz**, y se abre.

Al crear la vista desde un nodo que aún no tenía vista de doble clic, ese nodo queda enlazado con ella:
desde entonces, **doble clic** en el nodo te lleva al detalle, y el nodo muestra un pequeño icono de "bajar" en
la esquina para recordarte que tiene detalle.

Si la nueva vista es de la **misma notación** que el elemento (o es Libre), el propio elemento aparece en ella
como primer nodo. Si es de otra notación (por ejemplo, el detalle BPMN de un proceso ArchiMate), la vista
empieza vacía: el elemento es su raíz, pero no se dibuja.

El mismo menú tiene también:

- **Entrar en el detalle**: solo si el nodo tiene vista de doble clic.
- **Nueva vista de detalle…**: despliega todas las notaciones, aunque no sean dimensiones, y crea una vista de
  detalle de la elegida.
- **Aparece en**: las demás vistas donde está el elemento; clic para ir.
- **Trazas**: hasta tres sugerencias de "Enlazar con …" elementos de otras notaciones que parecen el mismo
  concepto (ver [Conceptos → Trazas](conceptos.md#trazas)).
- **Nodo**: **Comentar**, **Mostrar pines** / **Ocultar pines**, **Quitar de esta vista** y **Borrar del
  modelo**.

## Vistas de detalle y ruta de vistas {#vistas-de-detalle}

![Vista BPMN abierta desde el proceso ArchiMate, con la ruta de vistas en la barra](img/04-bpmn-detalle.png)

Cuando entras en un detalle (doble clic, **Entrar en el detalle** o **Abrir en otra dimensión**), la barra
superior muestra la **ruta de vistas**: *Arquitectura · Alta de cliente › Alta de cliente · BPMN*, con la
etiqueta de color de la notación actual.

- Pulsa **←** para volver a la vista anterior.
- Pulsa cualquier nombre de la ruta para saltar directamente a ese nivel.
- Si abres una vista desde el panel Vistas, la ruta empieza de nuevo desde esa vista.

**Cambiar a qué vista lleva el doble clic:** selecciona el nodo, pestaña **Dónde** del inspector, campo
**Vista al hacer doble clic**. Ofrece las vistas de detalle del elemento; *(ninguna)* desactiva el doble clic.

## La pestaña "Dónde" del inspector {#donde}

Con un nodo seleccionado, la pestaña **Dónde** responde a "¿dónde más está este elemento?":

| Sección | Qué muestra |
|---|---|
| **Vistas de detalle** | Las vistas cuya raíz es este elemento, con su notación. Clic para entrar. |
| **Aparece en** | Las demás vistas donde el elemento tiene un nodo. Clic para ir. |
| **Vista al hacer doble clic** | A cuál de sus vistas de detalle lleva el doble clic en este nodo. |
| **Trazas** | Las relaciones puente (Traza, Realiza, Refina) con elementos de otras notaciones, con opción de ir o quitarlas. |
| **Sugerencias** | Elementos de otras notaciones que parecen el mismo concepto, con un botón para enlazarlos. |

Las **relaciones** del elemento con el resto del modelo están en la pestaña **Datos**, sección
**Relaciones**: aparecen todas, también las que no están dibujadas en la vista actual (marcadas "(no en esta
vista)"). Si está dibujada, un clic la selecciona en el lienzo.

> [!TIP]
> Revisar **Dónde** es la forma más rápida de comprobar que un concepto está bien enlazado entre dimensiones.

## Quitar de la vista o borrar del modelo {#quitar-o-borrar}

Es la diferencia más importante de all-draw, y la causa de la mayoría de sustos:

| Acción | Cómo | Qué se borra | Qué se conserva |
|---|---|---|---|
| **Quitar de esta vista** | Selecciona el nodo y pulsa **Supr** (o Retroceso), o clic derecho → **Quitar de esta vista** | El nodo, los nodos que tuviera dentro y las aristas que lo tocan **en esta vista** | El elemento, sus relaciones y sus apariciones en otras vistas |
| **Borrar del modelo** | Clic derecho → **Borrar del modelo** (pide confirmación) | El elemento, **todas** sus apariciones en **todas** las vistas y todas sus relaciones | Nada de ese elemento; las vistas de las que era raíz se quedan sin raíz |
| **Quitar una arista de esta vista** | Selecciona la arista y pulsa **Supr**, o clic derecho → **Quitar de esta vista** | Esa arista, solo **en esta vista** | La relación y sus aristas en otras vistas |
| **Borrar una relación** | Selecciona la arista y pulsa **Shift+Supr**, o clic derecho → **Borrar del modelo** (pide confirmación) | La relación del modelo y **todas** sus aristas en todas las vistas | Los dos elementos |
| **Borrar una vista** | **×** junto a la vista en el panel | La vista con sus nodos y aristas | Todos los elementos y relaciones |

> [!WARNING]
> **Supr** es inofensivo tanto sobre *nodos* como sobre *aristas*: solo los quita de esta vista. Lo que borra del
> modelo entero es **Shift+Supr** (sobre aristas) y **Borrar del modelo**, que siempre piden confirmación.

Todo se puede deshacer con **Ctrl+Z** (Cmd+Z en Mac) mientras no cierres el espacio. En los espacios del
servidor también puedes volver a una instantánea anterior desde [Historial](historial.md).

## Elementos huérfanos {#huerfanos}

Un elemento **huérfano** es el que existe en el modelo pero no aparece en ninguna vista. Suele pasar cuando
quitas un nodo con **Supr** y era su única aparición, o al importar un modelo de otra herramienta.

No es un error: a veces es justo lo que quieres (un elemento documentado pero que aún no dibujas). Pero
conviene tenerlos localizados:

- En la pestaña **Modelo** de la paleta, los huérfanos salen en **cursiva**. Arrástralos a una vista para
  recuperarlos.
- El **panel de problemas** muestra una nota por cada uno ("… no aparece en ninguna vista") con el arreglo
  **Borrar elemento**.
- De la misma forma avisa de las relaciones que no están dibujadas en ninguna vista ("Relación no dibujada en
  ninguna vista").

## El patrón del elemento raíz {#patron-elemento-raiz}

El **elemento raíz** de una vista dice "esta vista es el detalle de este elemento". Es lo que hace que
**Abrir en otra dimensión** encuentre la vista correcta, que la vista lleve el rombo (◇) en el panel y que las
sugerencias de trazas funcionen mejor.

Un flujo de trabajo que funciona bien:

1. Modela la arquitectura en ArchiMate: procesos, servicios, aplicaciones.
2. Añade las dimensiones que vayas a usar (por ejemplo "BPMN 2.0" y "Máquina de estados").
3. Para cada proceso que quieras detallar: clic derecho → **Abrir en otra dimensión → BPMN 2.0 (crear)**. El
   proceso pasa a ser la raíz de la nueva vista BPMN y el doble clic queda enlazado.
4. Dentro del BPMN, para la tarea que cambia el estado de algo (un expediente, un pedido): **Abrir en otra
   dimensión → Máquina de estados (crear)**.
5. Enlaza los conceptos repetidos entre notaciones con trazas (menú del nodo → **Trazas**, o **Espacio →
   Trazabilidad**).
6. Revisa el panel de problemas: la nota "… no tiene traza a otra notación" te dice qué falta por conectar.

También puedes fijar o cambiar la raíz a mano en el inspector de la vista (**Elemento raíz**).

## Problemas frecuentes {#problemas-frecuentes}

**He renombrado un elemento y ha cambiado en otra vista que no quería.**
Las dos cajas eran el mismo elemento (seguramente las creaste con Ctrl+V o desde la pestaña Modelo). Deshaz
con Ctrl+Z, y en la vista donde quieras algo distinto quita el nodo y crea uno nuevo desde la pestaña
**Notación**, o usa **Ctrl+Shift+V** para pegar una copia independiente.

**"Abrir en otra dimensión" no ofrece nada.**
El espacio no tiene dimensiones: añádelas en **Vistas → Dimensiones**.

**He creado el detalle y la vista sale vacía.**
Es normal cuando la notación es distinta: el detalle BPMN de un proceso ArchiMate empieza en blanco. El
proceso es la raíz (lo pone la cabecera del inspector de la vista: "detalle de …"), aunque no se dibuje.

**El doble clic no entra en ningún sitio.**
El nodo no tiene vista de doble clic. Elígela en **Dónde → Vista al hacer doble clic**, o crea una con
**Nueva vista de detalle…**. Ojo: el doble clic *sobre el nombre* sirve para renombrar; haz doble clic en
otra parte del nodo.

**No me deja soltar un nodo en la rejilla.**
En una vista de capas × etapas los nodos solo pueden ir **dentro de una celda**. Suéltalo sobre una celda,
no en los encabezados ni fuera de la tabla.

**He borrado una capa o etapa y han desaparecido nodos.**
No se han borrado: quedan fuera de la rejilla hasta que los muevas a otra celda.

**He borrado una vista por error.**
Pulsa **Ctrl+Z**. Los elementos seguían en el modelo de todos modos; si ya cerraste el espacio y está en el
servidor, recupera una instantánea desde [Historial](historial.md).
