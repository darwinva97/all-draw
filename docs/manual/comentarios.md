# Comentarios

Los comentarios sirven para conversar *sobre* el diagrama sin ensuciarlo: una duda sobre un
elemento, una petición de cambio en una flecha, una nota en un hueco del lienzo o una observación
sobre la vista entera. Cada comentario abre un **hilo** al que se puede responder y que, cuando el
asunto queda zanjado, se **resuelve**.

Los comentarios forman parte del espacio, igual que los elementos y las vistas: se guardan con él,
se sincronizan con las demás personas en los espacios del servidor, van dentro del
`.alldraw.json` exportado y en las [instantáneas del historial](historial.md), y se deshacen con
**Ctrl+Z** como cualquier otro cambio.

## Abrir el panel de comentarios {#abrir-el-panel}

En la barra del editor está el botón **Comentarios** (un bocadillo). Si hay hilos sin resolver en
el espacio, el botón muestra cuántos. Al pulsarlo se abre el panel lateral; vuelve a pulsarlo, usa
la **×** del panel o pulsa **Escape** (fuera del cuadro de texto) para cerrarlo.

El panel también se abre solo cuando empiezas un comentario nuevo o cuando pulsas una burbuja del
lienzo.

## Qué se puede comentar {#que-se-puede-comentar}

| Qué | Cómo se empieza | Dónde se ve el hilo |
|---|---|---|
| Un **elemento** | Selecciónalo y, en el inspector (pestaña **Datos**), sección **Comentarios** → **＋ Comentar** | En **todas** las vistas donde aparece ese elemento |
| Una **aparición** concreta (un nodo) | Botón derecho sobre el nodo → **Comentar** | Solo en esa vista, sobre ese nodo |
| Una nota, grupo, etiqueta o imagen | Selecciónala → inspector → **＋ Comentar** | Solo en esa vista |
| Una **arista** (una línea) | Selecciónala → inspector → **＋ Comentar** | Sobre esa línea, en esa vista |
| Un **punto** del lienzo | Botón derecho en un hueco vacío → **Comentar aquí** | Un marcador en ese punto exacto |
| La **vista entera** | En el panel, **＋ Comentar la vista**; o sin nada seleccionado, inspector → **＋ Comentar** | En la lista del panel de esa vista |

La diferencia entre las dos primeras filas importa: el mismo elemento puede aparecer en varias
vistas (ver [modelo y vistas](conceptos.md#modelo-y-vistas)). Si comentas desde el inspector, el
comentario va con el *elemento* y lo verás allí donde se dibuje. Si comentas con el botón derecho,
va con *esa aparición* y solo se ve en esa vista.

En pantallas táctiles, el botón derecho se sustituye por una **pulsación larga**.

> [!TIP]
> Al escribir el primer comentario, el panel muestra arriba a qué está anclado (por ejemplo
> "◆ Alta de cliente" o "◎ Punto en Vista general"). Si no es lo que querías, pulsa **Cancelar**
> y empieza de nuevo desde el sitio correcto.

## Escribir, responder y editar {#escribir-y-responder}

- Escribe en el cuadro y pulsa **Comentar** o **Ctrl+Enter** (**⌘+Enter** en Mac). **Escape**
  cancela.
- Para contestar, pulsa **Responder** debajo del hilo. Las respuestas quedan en orden, debajo del
  primer comentario.
- En tus propios comentarios aparecen dos botones al lado de la fecha: **✎** (editar) y la
  papelera (borrar). Un comentario editado muestra "(editado)".
- Si borras el **primer** comentario de un hilo que ya tiene respuestas, se borra el **hilo
  entero**; antes te pide confirmación.
- La fecha se muestra en forma relativa ("hace 5 min", "ayer"); pasa el ratón por encima para ver
  la fecha y hora exactas.
- El botón con el nombre de lo comentado, arriba de cada hilo (**Ir a lo comentado**), abre la
  vista correspondiente, selecciona el elemento o la línea y centra el lienzo en él.

> [!NOTE]
> **Quién firma.** Hoy all-draw no toma el nombre de tu cuenta para los comentarios: en un espacio
> del servidor firmas con el mismo nombre que aparece en la presencia ("Anónimo" seguido de un
> número, que cambia cada vez que abres el espacio) y en un espacio local, simplemente "Anónimo".
> Como la app reconoce "tus" comentarios por ese nombre, puede que al volver otro día ya no puedas
> editar o borrar los que escribiste. Si necesitas que se sepa quién eres, firma dentro del texto o
> menciónate (ver abajo).

## Menciones con @ {#menciones}

Escribe **@** en el cuadro de texto y aparece una lista con las **personas del espacio** (las que
se dan de alta en el panel **Espacio → Personas**, ver
[librerías, reglas y personas](librerias-reglas-personas.md)). Puedes seguir escribiendo para
filtrar por nombre o por correo; elige con **↑ / ↓** y **Enter** o **Tab**, o con el ratón.

- La mención se resalta en el texto; al pasar el ratón por encima ves su equipo o su correo.
- Si borras el texto `@Nombre`, la mención desaparece.
- Si el espacio no tiene personas, la lista te lo indica: primero hay que crearlas.

### Quién recibe el aviso {#aviso-de-mencion}

En los **espacios del servidor**, una mención en un comentario **nuevo** avisa a la persona en su
[campana de notificaciones](compartir-y-colaborar.md#notificaciones) (y por correo si el servidor
envía correos y lo tiene activado) cuando el servidor sabe qué cuenta es. Lo decide así, por orden:

1. La persona del espacio tiene un **correo** y hay una cuenta con ese correo: esa cuenta. Es la forma
   segura: pon el correo de cada persona en **Espacio → Personas**.
2. Si no tiene correo (o no hay cuenta con él), se busca una cuenta que haya **firmado comentarios en
   este espacio con el mismo nombre** (sin mirar mayúsculas ni acentos). Si dos cuentas firman con ese
   nombre, no se avisa a ninguna.

Nunca se avisa al autor del comentario ni a quien **no tenga acceso** al espacio (mencionar no da
acceso). Editar un comentario para añadir una mención no avisa, ni restaurar una versión con
comentarios antiguos, ni los comentarios de hace más de un día que llegan al volver la conexión.

> [!IMPORTANT]
> En los **espacios locales** (del navegador) las menciones **no avisan a nadie**: no hay servidor
> que lo haga. La mención sirve para dejar claro a quién va dirigido el comentario.

## Resolver y reabrir {#resolver}

Cuando el asunto está atendido, pulsa **✓ Resolver**. El hilo se marca "✓ Resuelto" (al pasar el
ratón se ve quién lo resolvió), desaparece del filtro **Abiertos** y su burbuja se quita del
lienzo. No se borra: sigue disponible en **Resueltos**.

Para volver a abrirlo, pulsa **Reabrir**. **Responder a un hilo resuelto lo reabre
automáticamente.**

Cualquiera que pueda editar el espacio puede resolver y reabrir cualquier hilo, no solo quien lo
empezó.

## Filtros del panel {#filtros}

Arriba del panel hay dos controles:

- **Abiertos / Resueltos / Todos**, cada uno con su número. Por defecto se ven los abiertos.
- **Solo esta vista** (activado por defecto): muestra los hilos que se ven en la vista actual —los
  de la vista, sus puntos, sus nodos y líneas, y los de los elementos y relaciones que aparecen en
  ella—. Desactívalo para ver los de todo el espacio.

Si llegas a un hilo desde una burbuja o desde el inspector, el panel relaja los filtros lo
necesario para enseñártelo.

## Burbujas en el lienzo {#burbujas}

Los hilos **abiertos** se ven sobre el propio diagrama:

- En la esquina superior derecha de un nodo comentado, una burbuja con el **número de hilos
  abiertos** de ese nodo (incluidos los del elemento que representa).
- En el centro de una línea comentada, otra burbuja con su número de hilos.
- En un punto comentado, un marcador con el **número de mensajes** del hilo.

Pulsa una burbuja para abrir el hilo en el panel. Las burbujas mantienen su tamaño al hacer zoom y
no se arrastran con el nodo por accidente. Los hilos resueltos no muestran burbuja.

El inspector también resume los comentarios de lo seleccionado: la sección **Comentarios (abiertos
/ total)** enseña hasta cinco hilos y un enlace **Ver todos** si hay más.

## Si se borra lo comentado {#al-borrar}

Los hilos **no se pierden** al borrar aquello de lo que hablaban; se mueven a algo que sigue
existiendo:

| Borras… | El hilo pasa a… |
|---|---|
| Un nodo (**Quitar de esta vista**) | La vista en la que estaba |
| Un elemento (**Borrar del modelo**) | Una de las vistas donde aparecía |
| Una línea o una relación | La vista en la que estaba dibujada |
| Una vista entera | Queda **sin ancla**: aparece como "Sin ancla (lo comentado se borró)" |

Los hilos sin ancla no pertenecen a ninguna vista: para verlos, desactiva **Solo esta vista**. Si
deshaces el borrado con **Ctrl+Z**, el comentario vuelve a su sitio original.

Si un hilo muestra "(ancla borrada)", lo que comentaba desapareció por otra vía (por ejemplo, al
importar un fichero que sustituye el espacio). El texto sigue ahí; puedes resolverlo o borrarlo.

## Quién puede comentar {#quien-puede}

| Dónde | Puede leer | Puede escribir, responder y resolver |
|---|---|---|
| Espacio local (en tu navegador) | Tú | Tú |
| Espacio del servidor, rol **propietario** | Sí | Sí |
| Espacio del servidor, rol **puede editar** (o enlace de edición) | Sí | Sí |
| Espacio del servidor, rol **solo lectura** (o enlace de lectura) | Sí | No |

Los roles se explican en [compartir y colaborar](compartir-y-colaborar.md).

## Espacios locales y del servidor {#local-y-servidor}

- En un **espacio local**, los comentarios viven solo en tu navegador. Sirven como notas para ti
  mismo, o para acompañar un `.alldraw.json` que vayas a pasar a otra persona.
- En un **espacio del servidor**, todas las personas con acceso ven los comentarios en directo, y
  también los que se escriban mientras alguien está sin conexión, cuando vuelva la red (ver
  [sin conexión](compartir-y-colaborar.md#sin-conexion)).
- Si **subes** un espacio local al servidor, sus comentarios se suben con él.

## Errores comunes {#errores-comunes}

- **"No veo el comentario que acabo de escribir."** Mira los filtros: puede que estés en
  **Resueltos**, o que el hilo sea de otra vista y tengas activado **Solo esta vista**.
- **"No me sale la opción Comentar."** Estás en modo de solo lectura (rol **solo lectura** o enlace
  de lectura). Pide al propietario un enlace de edición.
- **"Comento un elemento y el comentario aparece en otras vistas."** Es lo esperado si comentaste
  desde el inspector: el hilo va con el elemento. Para que sea solo de esta vista, usa botón
  derecho → **Comentar** sobre el nodo.
- **"La @ no sugiere a nadie."** Las menciones son de las personas del espacio
  (**Espacio → Personas**), no de los usuarios del servidor. Créalas primero.
- **"Mencioné a alguien y no se ha enterado."** Las menciones no envían avisos.
- **"Ya no puedo editar un comentario mío."** Ver la nota de [quién firma](#escribir-y-responder).
- **"Desapareció la burbuja del lienzo."** El hilo se resolvió; sigue en **Resueltos**.
