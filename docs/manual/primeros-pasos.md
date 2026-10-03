# Primeros pasos

all-draw es un diagramador en el que dibujas **un solo modelo** y lo miras desde **muchas notaciones**:
ArchiMate, BPMN, máquina de estados, C4, secuencia, entidad-relación, UML, mapa mental y más. Un elemento
("Alta de cliente") existe una sola vez y puede aparecer en tantas vistas como quieras; si lo renombras en
una, cambia en todas. Funciona en el navegador, sin instalar nada, en [alldraw.bezenti.com](https://alldraw.bezenti.com).

> [!TIP]
> ¿Tienes prisa? Salta a [Tu primer diagrama en 5 minutos](primeros-pasos.md#primer-diagrama). ¿Quieres entender la idea
> antes de dibujar? Lee [Conceptos](conceptos.md).

## Qué es all-draw {#que-es}

La mayoría de herramientas tratan cada diagrama como un dibujo aislado: si la misma aplicación sale en el
diagrama de arquitectura y en el de procesos, son dos cajas distintas que hay que mantener a mano. En
all-draw hay dos capas:

- El **modelo**: las cosas que existen (procesos, aplicaciones, personas, datos…) y cómo se relacionan.
- Las **vistas**: los diagramas. Cada vista dibuja una parte del modelo en una notación concreta.

Gracias a eso puedes saltar de un proceso de negocio a su detalle BPMN, de ahí a la máquina de estados del
expediente, y comprobar qué piezas no están conectadas entre niveles. Todo eso se explica con dibujos en
[Conceptos](conceptos.md).

## La pantalla de inicio {#pantalla-de-inicio}

![Pantalla de inicio de all-draw](img/01-inicio.png)

Al abrir la aplicación ves una frase de presentación, tres botones y, debajo, tus espacios:

| Botón | Qué hace |
|---|---|
| **Nuevo espacio** | Crea un espacio vacío y lo abre en el editor. Con la sesión iniciada se llama **Nuevo espacio en el servidor**. |
| **Abrir la demo** | Crea una copia del espacio de ejemplo "Alta de cliente" (ver [la demo](primeros-pasos.md#demo)). Puedes tocarlo sin miedo: es tuyo. |
| **Importar…** | Crea un espacio a partir de un fichero: `.drawer`, `.alldraw.json`, `.archimate` (Archi), Open Exchange, BPMN 2.0 XML, Structurizr, XState, Mermaid u OpenAPI. Ver [Importar y exportar](importar-exportar.md). |

En la misma fila, a la derecha, aparece **Entrar / registrarse** si el servidor de cuentas está disponible.
La primera vez, mientras no tengas ningún espacio ni sesión, en lugar del inicio verás la portada de all-draw; allí
el botón para iniciar sesión se llama **Entrar**.
En la parte superior de la pantalla está el **selector de idioma**.

Un **espacio** (en inglés, *workspace*) es la unidad de trabajo: contiene el modelo, todas sus vistas, las
librerías, las reglas de estilo y las personas. Cada espacio se abre con su propia dirección web, así que
puedes guardarla en marcadores.

La lista de espacios se divide en dos secciones:

- **En el servidor**: solo aparece con la sesión iniciada. Muestra cada espacio con tu papel (**propietario**,
  **puede editar** o **solo lectura**) y la fecha del último cambio. El propietario ve un botón **Borrar**.
- **En este navegador**: los espacios locales. Cada uno tiene **Borrar** y, con la sesión iniciada,
  **Subir al servidor**.

Haz clic en el nombre (o en cualquier parte de la fila) para abrir un espacio.

## Espacios locales y espacios en el servidor {#espacios-locales-y-servidor}

all-draw funciona sin cuenta. Lo que creas sin entrar es **local**: vive en el almacenamiento de tu
navegador. Con una cuenta puedes guardar espacios **en el servidor** y compartirlos.

| | Espacio local | Espacio en el servidor |
|---|---|---|
| Dónde vive | En **este navegador** (en este ordenador) | En el servidor, con una copia en tu navegador |
| Dirección | `…/#/w/<id>` | `…/#/s/<id>` |
| Necesita cuenta | No | Sí (o un enlace compartido) |
| Funciona sin conexión | Siempre | Sí: guarda en local y sincroniza al volver la conexión |
| Se puede compartir | No (primero hay que subirlo) | Sí: enlaces de edición y de lectura, edición a la vez |
| Historial de versiones | No | Sí (ver [Historial](historial.md)) |
| Se pierde si… | Borras los datos del navegador o cambias de ordenador | Lo borra su propietario |

> [!WARNING]
> Un espacio local **no** se copia solo a ningún sitio. Si borras los datos de navegación, usas una ventana
> privada o cambias de ordenador, no lo verás. Para guardarlo de verdad, súbelo al servidor o expórtalo a un
> fichero `.alldraw.json` (ver [Importar y exportar](importar-exportar.md)).

Para pasar un espacio local al servidor: inicia sesión y pulsa **Subir al servidor**, en la lista de inicio
o en la barra del editor. Se crea una **copia** en el servidor y se abre; el espacio local sigue existiendo
hasta que lo borres.

Más detalles en [Conceptos → Espacios](conceptos.md#espacios).

## Crear una cuenta {#crear-cuenta}

Necesitas cuenta para guardar espacios en el servidor, compartirlos, ver su historial y crear claves para
agentes.

1. En la pantalla de inicio, pulsa **Entrar / registrarse** (arriba a la derecha; en la portada se llama **Entrar**).
2. En el diálogo, pulsa **No tengo cuenta**. El título cambia a **Crear cuenta**.
3. Rellena **Correo**, **Nombre** y **Contraseña** (mínimo 8 caracteres).
4. Si el servidor pide un **Código de invitación**, escríbelo (te lo da quien administra el servidor).
5. Pulsa **Registrarme**. El diálogo se cierra y ya tienes la sesión iniciada.

![Diálogo de entrar o crear cuenta](img/02-entrar.png)

Para **entrar** con una cuenta que ya tienes: **Entrar / registrarse**, escribe correo y contraseña y pulsa
**Entrar**. El enlace **Ya tengo cuenta** vuelve del registro al inicio de sesión.

Con la sesión iniciada:

- El primer botón pasa a ser **Nuevo espacio en el servidor** y **Abrir la demo** crea la demo en el
  servidor.
- Aparece la sección **En el servidor**.
- Arriba a la derecha ves tu nombre. Al pulsarlo se abre el menú de la cuenta, con **Cuenta y claves API** y
  **Cerrar sesión**.

**Cuenta y claves API** abre la pantalla **Cuenta**, donde puedes crear claves para agentes (ver
[Agentes y API](agentes-y-api.md)), **Cambiar contraseña** y **Cerrar todas las sesiones**. Si eres
administrador, ahí también está la lista **Usuarios del servidor**.

La sesión dura 30 días y se renueva sola mientras uses la aplicación. El primer usuario que se registra en
un servidor es su administrador.

> [!NOTE]
> Cada servidor decide si el registro está **abierto**, **con invitación** o **cerrado**. Si está cerrado,
> el diálogo lo dice ("El registro está cerrado en este servidor.") y el botón **Registrarme** queda
> desactivado: pide una cuenta a quien lo administre.

## Tu primer diagrama en 5 minutos {#primer-diagrama}

Vamos a dibujar un proceso BPMN muy pequeño: *Pedido recibido → Preparar pedido → Pedido enviado*.

1. En la pantalla de inicio pulsa **Nuevo espacio**. Se abre el editor con un espacio vacío.
2. Arriba, haz clic en el nombre "Nuevo espacio" y escribe uno propio, por ejemplo *Tienda*.
3. En el panel **Vistas** (columna izquierda), pulsa el botón **+** y elige **BPMN 2.0**. Se crea y se abre la
   vista "Nueva vista BPMN 2.0".
4. Haz clic en una zona vacía del lienzo: el **inspector** (columna derecha) muestra la vista. Cambia su
   nombre a *Proceso de pedido*.
5. En la **paleta** (debajo de Vistas), pestaña **Notación**, busca **Evento de inicio** y **arrástralo** al
   lienzo.
6. Con el nodo recién creado seleccionado, pulsa **F2**, escribe *Pedido recibido* y pulsa **Intro**.
7. Repite con una **Tarea** (*Preparar pedido*) y un **Evento de fin** (*Pedido enviado*), colocados de
   izquierda a derecha. Puedes usar el campo **Buscar…** de la paleta para encontrarlos antes.
8. Conecta: acerca el ratón al **borde inferior** de *Pedido recibido* hasta ver el punto de conexión,
   arrastra hasta *Preparar pedido* y suelta. En el menú **Tipo de relación** elige **Flujo de secuencia**
   (sale el primero). Haz lo mismo de *Preparar pedido* a *Pedido enviado*.
9. Mira la barra inferior del lienzo: es el **panel de problemas**. Si algo no encaja con las reglas de BPMN,
   te lo dirá ahí.
10. Listo. No hay que guardar: el indicador de la barra pone `guardado en este navegador`.

> [!TIP]
> ¿Te has equivocado? **Ctrl+Z** deshace y **Ctrl+Y** rehace (en Mac, **Cmd+Z** y **Cmd+Y**). Todos los
> atajos están en [Atajos](atajos.md).

Para seguir: selecciona *Preparar pedido* y mira el inspector (pestañas **Datos**, **Pines**, **Dónde**,
**Estilo**). Luego prueba a crear otra vista y a arrastrar *Preparar pedido* desde la pestaña **Modelo** de
la paleta: verás el mismo elemento en dos vistas. Eso es lo que explica [Modelo y vistas](modelo-y-vistas.md).

## La demo "Alta de cliente" {#demo}

La demo es la mejor forma de entender all-draw. Modela el alta de un cliente en un banco y dibuja el mismo
modelo en **seis dimensiones**:

| Vista | Notación | Qué muestra |
|---|---|---|
| Arquitectura · Alta de cliente | ArchiMate 3.2 (viewpoint *Layered*) | Actor, rol, proceso, servicio, componentes, datos y nodo |
| Alta de cliente · BPMN | BPMN 2.0 | El proceso paso a paso, con una pool "Banco" y dos lanes |
| Alta de cliente · Estados | Máquina de estados | El ciclo de vida del expediente: pendiente, en verificación, activo, rechazado |
| CRM · Contenedores | C4 (viewpoint *Contenedor*) | Los contenedores del CRM (portal, API, base de datos) y el proveedor KYC externo |
| Alta de cliente · Secuencia | Diagrama de secuencia | Cliente, portal, API y base de datos intercambiando mensajes |
| Mapa capas × etapas | Capas × etapas | Los mismos elementos en una rejilla Negocio/Aplicación/Tecnología × Captación/Alta/Operación, con dos microservicios de una librería conectados por **pines** |

Además trae dos reglas de estilo ("Externos en gris" y "Servicios sin repo"), una librería "Sistemas" con el
tipo *Microservicio*, y varias **trazas** entre notaciones (por ejemplo, la tarea BPMN "Verificar identidad"
está trazada con el servicio ArchiMate "Verificación KYC").

![Editor con la vista ArchiMate de la demo](img/03-editor-archimate.png)

Ábrela con **Abrir la demo** y prueba estas cuatro cosas:

1. **Doble clic** sobre el proceso "Alta de cliente" en la vista ArchiMate: entras en su vista de detalle
   BPMN. Arriba aparece la **ruta de vistas** y el botón **←** para volver.
2. **Botón derecho** sobre cualquier nodo → **Abrir en otra dimensión**: la lista de dimensiones. Las que ya
   tienen vista se abren; las marcadas **(crear)** crean una vista nueva.
3. En "Mapa capas × etapas", selecciona `clientes-api` y abre la pestaña **Pines** del inspector: verás el
   pin `cliente.email` conectado a `notificaciones`.
4. Selecciona cualquier elemento y abre la pestaña **Dónde**: lista todas las vistas en las que aparece.

## Guardado automático e indicador de estado {#guardado}

No hay botón de guardar. Cada cambio se guarda al momento en tu navegador y, si el espacio está en el
servidor, se envía en cuanto hay conexión. El indicador de la barra del editor te dice en qué estado estás:

| Indicador | Significado |
|---|---|
| `guardado en este navegador` | Espacio local. Todo está guardado en este navegador. |
| `● en línea` | Espacio en el servidor, conectado. Los cambios se envían al instante. |
| `◌ conectando…` | Intentando conectar con el servidor. Puedes seguir trabajando. |
| `○ sin conexión (se sincroniza al volver)` | Sin conexión. Tus cambios se guardan en local y se envían cuando vuelva la red. |

En los espacios del servidor, junto al indicador aparece tu papel (**propietario**, **puede editar** o **solo
lectura**). Con **solo lectura** puedes mirar pero no editar.

Los espacios del servidor guardan además **instantáneas** automáticas que puedes restaurar desde el botón
**Historial** (ver [Historial](historial.md)).

## Instalar como aplicación (PWA) {#instalar-pwa}

all-draw es una **aplicación web instalable** (PWA): puedes tenerla en el escritorio o en la pantalla de
inicio del móvil, se abre en su propia ventana y carga aunque no tengas conexión.

1. Abre [alldraw.bezenti.com](https://alldraw.bezenti.com) en Chrome, Edge u otro navegador compatible.
2. En el ordenador: pulsa el icono de **instalar** que aparece en la barra de direcciones (o menú del
   navegador → *Instalar all-draw*).
3. En el móvil: menú del navegador → *Añadir a pantalla de inicio* (en Safari para iPhone, botón
   *Compartir* → *Añadir a pantalla de inicio*).

La aplicación instalada se actualiza sola cuando hay una versión nueva. Tus espacios son los mismos que en
el navegador donde la instalaste.

## Idioma {#idioma}

La interfaz está en **español** y en **inglés**. La primera vez se elige según el idioma de tu navegador
(inglés si tu navegador está en inglés; español en cualquier otro caso).

Para cambiarlo, usa el selector **Español / English**: está en la parte superior de la pantalla de inicio y
también en la barra del editor (en el móvil, dentro de la hoja **Más**). El cambio es inmediato y se recuerda en este navegador.

> [!NOTE]
> El idioma cambia los textos de la interfaz, los nombres de los tipos y las categorías de la paleta. **No**
> traduce lo que tú escribes (nombres de elementos, documentación). Los nombres de los tipos ArchiMate se
> mantienen en inglés en los dos idiomas, como en la especificación.

## Problemas frecuentes {#problemas-frecuentes}

**No veo el botón "Entrar / registrarse" (o "Entrar" en la portada).**
Solo aparece si el servidor de cuentas responde. Comprueba tu conexión y recarga la página. Mientras tanto
puedes trabajar con espacios locales.

**Mis espacios han desaparecido.**
Si eran locales, viven en el navegador donde los creaste: comprueba que usas el mismo navegador y el mismo
perfil, y que no estás en una ventana privada. Si borraste los datos del sitio, los espacios locales se
perdieron. Por eso conviene subirlos al servidor o exportarlos.

**He olvidado mi contraseña.**
No hay recuperación por correo. Pide al administrador del servidor que la restablezca desde **Cuenta →
Usuarios del servidor → Restablecer**: te dará una contraseña temporal que luego puedes cambiar en
**Cambiar contraseña**.

**"Subir al servidor" dice que necesito una cuenta.**
Inicia sesión primero en la pantalla de inicio y vuelve a pulsar **Subir al servidor**.

**El indicador se queda en `○ sin conexión`.**
Tus cambios no se pierden: siguen en el navegador. Cuando vuelva la conexión se envían solos. Si tarda
mucho, recarga la página.

**No puedo editar nada en un espacio compartido.**
Mira tu papel junto al indicador: con **solo lectura** (o un enlace de lectura) solo puedes mirar. Pide al
propietario un enlace de edición (ver [Compartir y colaborar](compartir-y-colaborar.md)).

## Siguientes pasos {#siguientes-pasos}

- [Conceptos](conceptos.md): modelo y vistas, dimensiones, pines, trazas y viewpoints, con dibujos.
- [El editor](editor.md): todas las zonas de la pantalla y cómo se usan.
- [Modelo y vistas](modelo-y-vistas.md): crear vistas, navegar entre dimensiones, quitar y borrar.
- [Atajos](atajos.md): teclado, ratón y gestos táctiles.
- [Preguntas frecuentes](faq.md): dudas habituales.
