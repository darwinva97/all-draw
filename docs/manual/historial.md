# Historial de versiones

El **historial** guarda fotografías completas de un espacio del servidor —las **instantáneas**— para
que puedas volver a un estado anterior aunque hayan pasado días o aunque los cambios los hiciera
otra persona. Este capítulo explica cómo funcionan, en qué se diferencian de deshacer y de las
copias de seguridad del servidor, y qué hacer con los espacios locales.

## Instantáneas y deshacer no son lo mismo {#instantaneas-y-deshacer}

| | Deshacer (**Ctrl+Z** / **Ctrl+Y**) | Instantáneas (**Historial**) |
|---|---|---|
| Qué guarda | Tus últimos cambios, uno a uno | El espacio **entero** en un momento dado |
| De quién | Solo **tus** cambios (no los de las demás personas) | Todo, lo haya hecho quien lo haya hecho |
| Cuánto dura | Mientras tengas el espacio abierto | Se queda en el servidor (con los límites de abajo) |
| Dónde | Espacios locales y del servidor | Solo espacios del **servidor** |

Usa **Ctrl+Z** para corregir un error de hace un momento. Usa el **historial** para recuperar cómo
estaba el espacio ayer, antes de una reorganización grande o antes de que alguien borrara una vista.

## Abrir el historial {#abrir}

En un espacio del servidor, pulsa **Historial** en la barra del editor. Se abre un diálogo con la
lista de instantáneas, la más reciente arriba. De cada una ves:

- su **etiqueta** (o *Automática* si no la tiene),
- la fecha y hora,
- quién la creó (o *sistema* si la creó el servidor solo),
- su tamaño.

En un espacio local el botón **Historial** no aparece: ver [espacios locales](#espacios-locales).

## Ver una instantánea sin restaurarla {#ver}

Pulsa **Ver** junto a una instantánea para abrir una **vista previa de solo lectura**: el espacio tal como estaba en
ese momento, con el lienzo y el selector de vistas (arriba), sin tocar el espacio actual. Puedes moverte, acercarte y
seleccionar, pero no cambiar nada. Cualquier rol puede verla, también el de solo lectura.

Desde la vista previa:

- **Comparar con la actual** abre a la derecha un resumen de lo que ha cambiado **desde esa versión hasta ahora**, por
  elementos, relaciones y vistas:
  - **Añadidos desde entonces**: lo que no existía en la versión (se quitaría al restaurarla).
  - **Borrados desde entonces**: lo que existía y ya no (volvería al restaurarla).
  - **Cambiados desde entonces**: con su nombre actual (y el de antes, si cambió) y qué cambió: nombre,
    documentación, campos, propiedades, estilo… En las vistas, *contenido* quiere decir que cambiaron sus nodos o
    líneas.
  - Al final, si cambió el nombre del espacio o cuántos cambios hay en librerías, personas, reglas o comentarios.
- **Restaurar esta versión** hace lo mismo que **Restaurar** en la lista (ver [restaurar](#restaurar)).
- **Cerrar** (o Escape) vuelve a la lista.

## Instantáneas automáticas {#automaticas}

El servidor crea instantáneas sin que hagas nada:

- **Cada 30 minutos de actividad**: cuando llega un cambio y han pasado al menos 30 minutos desde
  la última instantánea. Si nadie toca el espacio, no se crean (no hace falta: no ha cambiado).
- **Antes de cada restauración**: el estado que había justo antes de restaurar se guarda como
  instantánea automática, para que una restauración se pueda deshacer.

## Crear una instantánea con etiqueta {#crear}

Antes de un cambio grande, conviene dejar una marca con nombre:

1. Abre **Historial**.
2. Escribe una etiqueta en **Etiqueta (opcional)**, por ejemplo "Antes de reorganizar capas"
   (hasta 120 caracteres).
3. Pulsa **Crear instantánea**. Verás el mensaje "Instantánea creada".

Si dejas la etiqueta vacía, la instantánea se crea igual pero se trata como automática (ver
[límites](#limites)). Las instantáneas **etiquetadas no se borran solas nunca**.

## Restaurar una instantánea {#restaurar}

1. En **Historial**, pulsa **Restaurar** junto a la instantánea que quieres.
2. Confirma. El mensaje te recuerda que el estado actual se guardará antes.

Qué pasa al restaurar:

- El servidor guarda **primero** una instantánea automática del estado actual. Nada se pierde.
- Después sustituye el contenido del espacio por el de la instantánea: modelo, vistas,
  librerías, reglas, personas y comentarios.
- Todas las personas que tengan el espacio abierto ven el cambio al instante, como cualquier otra
  edición, y un aviso: "*Ana* ha restaurado la versión de *fecha*". Así nadie se encuentra el espacio cambiado sin
  saber por qué.
- Solo cambia lo que difiere de la instantánea: si alguien está escribiendo en un elemento que la restauración no
  toca, no pierde lo que escribe.

Si te equivocaste de instantánea, abre **Historial** otra vez y restaura la automática que se creó
justo antes (la más reciente de la lista).

> [!NOTE]
> Restaurar no cambia quién tiene acceso: los miembros, los enlaces compartidos y la propiedad del
> espacio no forman parte de las instantáneas.

## Descargar una instantánea {#descargar}

**Descargar JSON** guarda la instantánea en tu equipo como fichero `.json`. Es el mismo formato que
**Importar / Exportar → JSON de all-draw**, así que puedes:

- guardarlo como copia de seguridad propia;
- abrirlo como espacio nuevo con **Importar…** en la pantalla de inicio, sin tocar el original;
- compararlo o procesarlo con otras herramientas.

## Borrar una instantánea {#borrar}

Solo el **propietario** del espacio ve el botón **Borrar** en cada instantánea. Pide
confirmación y no se puede deshacer.

## Quién puede hacer qué {#permisos}

| Acción | solo lectura | puede editar | propietario |
|---|:---:|:---:|:---:|
| Ver la lista | ✓ | ✓ | ✓ |
| Ver una instantánea y compararla | ✓ | ✓ | ✓ |
| Descargar JSON | ✓ | ✓ | ✓ |
| Crear instantánea | | ✓ | ✓ |
| Restaurar | | ✓ | ✓ |
| Borrar instantánea | | | ✓ |

Ver [compartir y colaborar](compartir-y-colaborar.md) para los roles.

## Límites {#limites}

- Cada espacio guarda como máximo **100 instantáneas**. Al pasar de ahí, el servidor borra las
  **automáticas más antiguas** (las que no tienen etiqueta).
- Las **etiquetadas** no se borran solas; solo las borra el propietario. Si un espacio acumula muchas
  etiquetadas, ocupan sitio de esas 100 y quedan menos huecos para las automáticas.
- Si se **borra el espacio**, se borran también todas sus instantáneas.

> [!TIP]
> Pon etiqueta a las instantáneas que quieras conservar a largo plazo (una entrega, una revisión
> aprobada). Las automáticas son una red de seguridad para los últimos días de trabajo, no un
> archivo.

## Espacios locales {#espacios-locales}

Los espacios guardados solo en tu navegador **no tienen historial**. Para protegerlos:

- Exporta de vez en cuando con **Importar / Exportar → JSON de all-draw** (fichero
  `.alldraw.json`) y guarda el fichero donde guardes tus documentos. Volver a una versión es
  importar ese fichero (ver [importar y exportar](importar-exportar.md#formatos)).
- O súbelo al servidor con **Subir al servidor** (necesitas cuenta): a partir de ahí tendrá
  instantáneas automáticas.

> [!WARNING]
> Si borras los datos del navegador, usas una ventana privada o cambias de equipo, los espacios
> locales no viajan contigo. Sin un `.alldraw.json` exportado no hay forma de recuperarlos.

## Copias de seguridad del servidor {#copias-del-servidor}

Además del historial, quien opera el servidor hace **copias de seguridad diarias** de todos los
datos (cuentas y espacios) y las conserva **30 días**. Son distintas de las instantáneas:

| | Instantáneas | Copias de seguridad del servidor |
|---|---|---|
| Para qué | Volver a una versión de **un** espacio | Recuperar el servicio entero tras un desastre (fallo del disco, error grave) |
| Quién las usa | Tú, desde **Historial** | Solo quien opera el servidor |
| Frecuencia | Cada 30 min de actividad, antes de restaurar y cuando tú quieras | Una vez al día |
| Cuánto duran | Hasta 100 por espacio; las etiquetadas, indefinidamente | 30 días |

No puedes restaurar una copia de seguridad del servidor por tu cuenta. Si has perdido algo que no
está en el historial, escribe a quien opera el servicio (ver [privacidad](privacidad.md)) lo antes
posible, indicando el espacio y la fecha aproximada; pasados 30 días ya no habrá copia.

Hoy las copias se guardan en la propia infraestructura del servicio. Para lo que no te puedas
permitir perder, guarda además tu propio `.alldraw.json`.

## Errores comunes {#errores-comunes}

- **"No veo el botón Historial."** Estás en un espacio local. Solo los espacios del servidor
  tienen historial.
- **"No puedo crear ni restaurar."** Tienes rol de **solo lectura**. Puedes ver y descargar, pero
  no cambiar el espacio.
- **"Restauré y he perdido lo que hice hoy."** No: justo antes de restaurar se creó una
  instantánea automática con el estado de hoy. Restáurala.
- **"Ha desaparecido una instantánea antigua."** Si no tenía etiqueta, se podó al superar las
  100. Pon etiqueta a las que quieras conservar.
- **"Ctrl+Z no deshace la restauración."** Deshacer solo revierte tus ediciones. Para volver
  atrás, restaura la instantánea automática previa.
- **"La lista está vacía."** El espacio es nuevo o lleva poco tiempo sin cambios: crea una
  instantánea a mano.
- **"Hay una instantánea automática de octubre de 2026 que no creó nadie."** Es la que guarda el
  servidor antes de pasar un espacio antiguo al formato nuevo de edición simultánea (ver
  [compartir y colaborar](compartir-y-colaborar.md#edicion-simultanea)). Se poda como las demás automáticas.
- **"No sé qué versión restaurar."** Pulsa **Ver** y luego **Comparar con la actual** en cada candidata antes de
  restaurar.
