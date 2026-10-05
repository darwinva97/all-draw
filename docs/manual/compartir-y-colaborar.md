# Compartir y colaborar

En all-draw varias personas pueden trabajar a la vez sobre el mismo espacio y ver los cambios de las demás al
instante. Este capítulo explica cómo llevar un espacio al servidor, cómo invitar a otras personas, qué puede hacer
cada una y qué pasa cuando se va la conexión. Al final está la pantalla **Cuenta**, donde cambias tu contraseña y,
si administras el servidor, gestionas las cuentas.

## Local o en el servidor {#local-o-servidor}

Solo se comparten los espacios **del servidor**. Un espacio **local** vive únicamente en tu navegador.

| | Espacio local | Espacio en el servidor |
|---|---|---|
| Dónde aparece en el inicio | **En este navegador** | **En el servidor** |
| Dirección | `#/w/<id>` | `#/s/<id>` |
| Necesita cuenta | No | Sí, o un enlace compartido |
| Se puede compartir | No (antes hay que subirlo) | Sí |
| Estado en la barra | `guardado en este navegador` | `● en línea` · tu rol |

Si has entrado con tu cuenta, **Nuevo espacio en el servidor** e **Importar…** crean directamente espacios del
servidor.

## Crear una cuenta y entrar {#cuenta}

![Diálogo para entrar o crear una cuenta](img/02-entrar.png)

1. En el inicio, pulsa **Entrar / registrarse** (arriba a la derecha). Si todavía no tienes ningún espacio, verás la
   portada de all-draw en lugar del inicio: allí el botón se llama **Entrar**.
2. Si ya tienes cuenta, escribe tu correo y contraseña y pulsa **Entrar**.
3. Si no, pulsa **No tengo cuenta**, rellena correo, nombre y una contraseña de **al menos 8 caracteres**, y pulsa
   **Registrarme**.

Según cómo esté configurado el servidor, el registro puede ser abierto, pedir un **Código de invitación** (pídeselo a
quien administre el servidor) o estar cerrado ("El registro está cerrado en este servidor"). La sesión dura 30 días
desde la última vez que usas la aplicación; para salir, abre el menú de tu nombre (arriba a la derecha) y pulsa
**Cerrar sesión**.

### Confirmar el correo {#verificar-correo}

Si el servidor envía correos, al registrarte te llega un mensaje **Confirma tu correo de all-draw** con un enlace.
Ábrelo (sirve **una vez** y caduca en **24 horas**) y verás **Correo confirmado**. Mientras no lo confirmes, la pantalla
**Cuenta** te lo recuerda con el botón **Reenviar el enlace** (cada enlace nuevo anula el anterior).

Algunos servidores exigen el correo confirmado para **crear espacios en el servidor**: hasta entonces, **Nuevo espacio
en el servidor** y **Subir al servidor** responden "Confirma tu correo para crear espacios en el servidor". Los espacios
de tu navegador funcionan igual, y los que te compartan los puedes abrir.

### He olvidado la contraseña {#recuperar-contrasena}

1. Pulsa **Entrar** y, en el diálogo, **¿Olvidaste tu contraseña?**
2. Si el servidor envía correos, escribe tu correo y pulsa **Enviar el enlace**. Verás "Si hay una cuenta con ese
   correo, te hemos enviado un enlace": el mensaje es el mismo exista o no la cuenta, para no revelar quién está
   registrado.
3. Abre el enlace del correo **Restablece tu contraseña de all-draw** (sirve **una vez** y caduca en **una hora**;
   si pides otro, el anterior deja de valer).
4. Escribe la **Nueva contraseña** dos veces y pulsa **Guardar la contraseña**. Se **cierran todas tus sesiones** y se
   desconectan los espacios abiertos (ver [Qué pasa al cerrar sesiones](#cerrar-sesiones)); con la casilla **Revocar
   también las claves API** (marcada por defecto) también dejan de valer tus claves.
5. Pulsa **Entrar** y usa la contraseña nueva.

Si el servidor **no envía correos**, **¿Olvidaste tu contraseña?** te lo explica: pide a un administrador que te la
restablezca (ver [Administración del servidor](#administracion)).

## Subir un espacio local al servidor {#subir}

1. Entra con tu cuenta.
2. Abre el espacio local y pulsa **Subir al servidor** en la barra del editor. También puedes hacerlo desde el
   inicio, con el botón **Subir al servidor** de ese espacio en la lista **En este navegador**.
3. Se crea una **copia** en el servidor y se abre (su dirección pasa a ser `#/s/<id>`). Tú eres su propietario.

> [!IMPORTANT]
> El espacio local original **sigue existiendo** en tu navegador y ya no está conectado a la copia del servidor. A
> partir de ahora trabaja en la copia del servidor (sección **En el servidor** del inicio) y, cuando estés seguro, borra
> la local para no confundirte.

## Roles {#roles}

Cada persona tiene un rol en cada espacio del servidor:

| Rol | Qué puede hacer |
|---|---|
| **solo lectura** | Ver todas las vistas, buscar, exportar, leer comentarios y seguir los cambios en directo. No puede modificar nada. |
| **puede editar** | Todo lo anterior y además editar: dibujar, cambiar datos, usar el panel Espacio, comentar, importar y restaurar instantáneas del historial. |
| **propietario** | Todo lo anterior y además **Compartir** (crear y revocar enlaces), borrar el espacio y borrar instantáneas. |

En la [API](agentes-y-api.md) los mismos roles se llaman `viewer`, `editor` y `owner`.

- El **propietario** es quien crea (o sube) el espacio.
- Los **administradores** del servidor ven todos los espacios con permisos de propietario. El primer usuario que se registra
  en un servidor es administrador.
- Tu rol aparece en la barra, junto al estado de la conexión (por ejemplo, `● en línea · puede editar`), y en la lista
  **En el servidor** del inicio.

Desde la interfaz se comparte con **enlaces**. Dar un rol a una cuenta concreta (miembros) o transferir la propiedad
se hace hoy por la API (`PUT /api/workspaces/:id/members/:userId` con `{ "role": "editor" }`); ver
[Agentes y API](agentes-y-api.md).

## Invitar a alguien {#invitar}

Solo el propietario ve el botón **Compartir**.

![Diálogo Compartir con un enlace de edición y otro de lectura](img/10-compartir.png)

1. Abre el espacio (tiene que estar en el servidor) y pulsa **Compartir**.
2. Elige qué quieres que pueda hacer la otra persona:
   - **Nuevo enlace de edición**: podrá editar a la vez que tú.
   - **Nuevo enlace de lectura**: solo podrá mirar.
3. El enlace aparece en la lista (✎ edición o 👁 lectura, con la fecha). Pulsa **Copiar enlace**: verás "Enlace copiado
   al portapapeles".
4. Envíalo por el canal que uses (correo, chat…). Quien lo abra entra directamente en el espacio, **sin necesidad de
   cuenta**.

El enlace tiene esta forma: `https://alldraw.bezenti.com/#/s/<id>?token=lnk_…`. Solo vale para ese espacio y con ese
rol: con un enlace de lectura se rechaza cualquier intento de escribir, también por la API.

> [!TIP]
> Crea un enlace distinto para cada persona o grupo. Así podrás revocar el de uno sin cortar a los demás.

Al abrirlo, all-draw guarda el token en esa pestaña y lo **borra de la barra de direcciones**, para que no quede en
el historial, en marcadores ni en capturas de pantalla. Si la persona cierra la pestaña, necesitará volver a abrir el
enlace original.

Los enlaces pueden llevar fecha de caducidad, pero hoy eso solo se configura por la API (campo `expiresAt`). Al llegar
esa hora el enlace deja de abrir el espacio y quien lo tenga **abierto** se desconecta en ese momento, con el aviso
«Ya no tienes acceso a este espacio».

## Revocar un enlace {#revocar}

1. Pulsa **Compartir**.
2. Junto al enlace, pulsa **Revocar**. Verás "Enlace revocado".

A partir de ese momento el enlace ya no sirve para abrir el espacio ni para reconectarse. Quien lo tenga **abierto en
ese momento** se desconecta al instante y ve el aviso «Ya no tienes acceso a este espacio» con el botón **Volver al
inicio**; lo que tuviera sin enviar ya no llega al servidor, y la copia que guardaba su navegador deja de abrirse sin
conexión. Revocar no borra lo que esa persona haya podido exportar o copiar.

Lo mismo ocurre al **quitar a un miembro**, al **borrar la cuenta** de esa persona y al **borrar el espacio** (en ese
caso el aviso es «Este espacio se ha borrado»). Si a un miembro se le **cambia el rol** (por ejemplo, de **puede editar** a
**solo lectura**), su conexión se rehace sola con el rol nuevo: ve «Tus permisos en este espacio han cambiado» y, si
pasa a solo lectura, deja de poder editar en ese mismo momento.

## Insertar diagramas en otras webs {#insertar}

Puedes mostrar una vista en **Confluence, Notion, Jira, GitHub** o cualquier web. Se ve en **solo lectura**, con zoom
y desplazamiento, y **se actualiza sola** (comprueba cada 30 s si el diagrama ha cambiado). Solo el propietario lo
configura.

1. Pulsa **Compartir** y abre la pestaña **Insertar**.
2. Elige la **Vista**, el **Tema** (automático —sigue al tema del sistema de quien mira—, claro u oscuro) y el
   **Tamaño** (o escribe el ancho y el alto).
3. Pulsa **Crear enlace de inserción**. Aparecen:
   - el **código para insertar**: un `<iframe>` listo para pegar (**Copiar código**);
   - el **enlace** de la página (**Copiar enlace**), para los sitios que lo convierten solos en un recuadro;
   - la **imagen SVG** (**Copiar URL de la imagen** o **Copiar Markdown**), para donde no se admiten iframes.

El enlace de inserción (`…/embed/<espacio>/<vista>?token=emb_…`) solo sirve para **ver esa vista**: no abre el espacio,
no deja ver las demás vistas ni vale para la API. Cualquiera que lo tenga puede verla, así que trátalo como un enlace de
lectura. Para dejar de mostrarla, pulsa **Revocar** en la lista **Enlaces de inserción**: las páginas que la incrustan
muestran «Este diagrama ya no está disponible» en menos de un minuto. Un enlace de lectura normal (`lnk_…`) también
sirve en la dirección `/embed/…`, pero da acceso a todo el espacio: es mejor uno de inserción.

En la página insertada: **arrastra** para moverte, **Ctrl + rueda** (o los botones **+** y **−**) para el zoom, doble
clic o **⤢** para encajar, y **Abrir en all-draw ↗** para ir al espacio (pedirá entrar si no tienes acceso).

**Confluence.** Edita la página, escribe `/iframe` (macro **Iframe**, o **HTML** si tu administrador la permite) y pega
la dirección de la página insertada (sin el `<iframe>`), con el ancho y el alto que quieras. En Confluence Cloud sin
macro de iframe, pega el enlace en una línea sola y elige la vista **Insertado** (*Embed*) si la ofrece.

**Notion.** Escribe `/embed`, elige **Insertar** (*Embed*) y pega el **enlace** (**Copiar enlace**). Notion reconoce la
página por oEmbed y muestra el diagrama en un recuadro que puedes redimensionar.

**Jira.** En la descripción o en un comentario, pega el enlace y elige la vista **Insertado** si aparece (Jira Cloud); si
no, inserta la **imagen SVG** como imagen externa.

**GitHub** (README, issues, wikis). GitHub no admite iframes: usa **Copiar Markdown**, que pega la imagen:
`![Proceso de cobro](https://alldraw.bezenti.com/embed/<espacio>/<vista>.svg?token=emb_…)`. Con el tema automático la
imagen sigue al modo claro u oscuro de quien la mira. GitHub guarda la imagen en caché un rato: los cambios pueden
tardar unos minutos en verse.

**WordPress y otras webs.** Pega el código `<iframe>` en un bloque HTML personalizado. Las que leen oEmbed (WordPress con
el enlace en una línea sola, por ejemplo) lo convierten solas.

> [!NOTE]
> Para avisar de los cambios en Slack, Teams o Discord (en vez de insertar el diagrama), usa la pestaña **Webhooks**:
> ver [Webhooks](agentes-y-api.md#webhooks).

## Presencia {#presencia}

En un espacio del servidor la barra muestra un círculo de color por cada persona conectada (el tuyo, el primero), con
sus iniciales. Pasa el ratón por encima para ver quién es y en qué vista está. Si sois más de seis, se ve "+*N*".

Cuando estáis en la misma vista, ves también su **cursor** con su nombre, moviéndose en el lienzo.

Cómo aparece cada persona:

- **Con la sesión iniciada**, con el **nombre de su cuenta** y un color fijo (el mismo en cada recarga y en cada equipo).
  Es también la firma de sus comentarios.
- **Con un enlace y sin cuenta**, como "Anónimo" seguido de un número. Ese nombre se genera la primera vez y se guarda
  en el navegador, así que no cambia al recargar; es el mismo con el que firma sus comentarios. Si quieres salir con tu
  nombre, entra con tu cuenta antes de abrir el enlace.

## Edición simultánea {#edicion-simultanea}

No hay que "bloquear" ni "proteger" nada: varias personas pueden editar el mismo elemento a la vez y los cambios se
combinan solos en todos los navegadores, sin avisos de conflicto (la sincronización usa CRDT). Al final todos ven
exactamente lo mismo. Lo que se combina depende de qué toca cada uno:

| Si a la vez… | Resultado |
|---|---|
| Una persona cambia el **nombre** de un elemento y otra su **documentación**, sus **campos**, sus **propiedades** o su **tipo** | Se conservan **todos** los cambios: cada campo de un elemento, relación, vista o nodo se sincroniza por separado. |
| Una persona mueve un nodo y otra le cambia el tamaño o el color | Se conservan los dos. |
| Dos personas escriben en el **mismo texto largo**: la documentación de un elemento, relación o vista, el texto de una nota, un comentario o un campo de texto largo o JSON | Se **fusionan letra a letra**, como en un editor de documentos compartido: si una escribe al principio y otra al final, quedan las dos frases. |
| Dos personas cambian el **mismo campo corto** (el nombre, una opción de una lista, un número, una fecha, la posición de un nodo) | **Gana el último** cambio que llega al servidor, y es el mismo para todos. |
| Una persona edita algo que otra **borra** | Queda borrado. Si hacía falta, se recupera desde el [Historial](historial.md). |

Algunos detalles:

- Las listas (etiquetas, pines, puntos de una línea, tipos de una librería…) cuentan como un solo campo: si dos personas
  las cambian a la vez, gana una. Igual los dos extremos de una línea o de una relación (de dónde sale y adónde llega):
  si una persona cambia el origen y otra el destino a la vez, queda la línea de una de las dos, nunca una mezcla.
- Si el texto que estás escribiendo cambia porque otra persona escribe en él, el cursor puede saltar al final; lo que
  hayáis escrito los dos se conserva.
- Si dos personas empiezan a la vez a rellenar algo que estaba vacío y no es de un elemento (el estilo de un nodo, la
  documentación o los campos de una relación, una nota de instancia), gana una; a partir de ahí se combina como arriba.
- **Deshacer** (Ctrl+Z) solo deshace **tus** cambios, nunca los de los demás, aunque sean en el mismo elemento: si
  renombras un elemento mientras otra persona escribe su documentación, deshacer devuelve el nombre y deja su texto.
- Para conversar sobre el modelo sin tocarlo, usa los [comentarios](comentarios.md).
- Si alguien estropea algo, cualquier editor puede volver a una versión anterior desde el [Historial](historial.md).

> [!NOTE]
> Los espacios creados antes de octubre de 2026 guardaban cada elemento como un bloque y, si dos personas lo
> editaban a la vez, se quedaba solo uno de los cambios. El servidor los pasa al formato nuevo la primera vez que los
> abre (guardando antes una instantánea automática), sin que tengas que hacer nada. Si tienes abierta una pestaña de
> antes de la actualización, el servidor no la deja sincronizar hasta que **recargues** la página: así no puede
> estropear el espacio. Lo que hubieras cambiado en ella sigue guardado en el navegador y se envía al recargar.

## Sin conexión {#sin-conexion}

Cada espacio del servidor que abres tiene una **copia en tu navegador**. Si se va la red mientras trabajas:

1. El estado de la barra cambia a `○ sin conexión (se sincroniza al volver)`. Mientras intenta reconectar verás
   `◌ conectando…`.
2. Sigue trabajando con normalidad: todo se guarda en tu navegador.
3. Cuando vuelve la conexión, tus cambios y los de los demás se fusionan solos y el estado vuelve a `● en línea`.

all-draw se puede instalar como aplicación (PWA) y arranca aunque no haya red. Sin conexión puedes abrir y editar
todos tus **espacios locales** y también los **espacios del servidor que ya hayas abierto antes en ese navegador**:

1. Se abre la copia guardada con el último permiso que tenías (si eras lector, sigues en solo lectura).
2. La barra muestra `○ sin conexión — los cambios se sincronizarán`. **Compartir** e **Historial** no están
   disponibles hasta que vuelva la red.
3. En cuanto vuelve la conexión se comprueban tus permisos, se conecta y se sincroniza todo; el estado pasa a
   `● en línea`. Si mientras tanto te quitaron el acceso, verás «Ya no tienes acceso a este espacio» y lo que hiciste
   sin red no se envía.

Un espacio del servidor que nunca has abierto en ese navegador no tiene copia: sin red verás «Sin conexión con el
servidor» y podrás **Reintentar** cuando vuelva. Si vas a viajar, abre antes los espacios que vayas a necesitar.

> [!WARNING]
> No borres los datos del navegador mientras tengas cambios sin sincronizar (estado `○ sin conexión`): perderías lo
> que hayas hecho desde que se fue la red.

## Solo lectura {#solo-lectura}

Con un enlace de lectura o el rol **solo lectura**, el editor se abre en **modo solo lectura**:

- no aparecen la paleta, el botón **Espacio**, deshacer/rehacer, el ajuste a rejilla ni la opción de importar;
- el inspector muestra los datos, pero no deja cambiarlos;
- puedes navegar por las vistas, buscar con Ctrl+K, leer los comentarios, exportar (imágenes, HTML, JSON…) y ver a los
  demás trabajando en directo.

Los mismos permisos se aplican a la API y a los agentes: una clave API tiene, en cada espacio, los permisos de su
usuario, y un enlace de lectura solo permite leer. Ver [Agentes y API](agentes-y-api.md).

## Tu cuenta {#ajustes-cuenta}

Con la sesión iniciada, arriba a la derecha aparece tu nombre. Al pulsarlo se abre el menú de la cuenta, con tu
correo y dos opciones:

- **Cuenta y claves API**: abre la pantalla **Cuenta** (`#/keys`).
- **Cerrar sesión**: cierra la sesión en este navegador. Si tenías un espacio del servidor abierto en otra pestaña de
  este navegador, se desconecta al momento.

![Pantalla Cuenta con las claves API](img/12-claves-api.png)

Tiene estas secciones:

- **Claves API**: para conectar agentes y scripts. Escribe un nombre, pulsa **Crear** y **copia la clave en ese
  momento**: no se vuelve a mostrar. **Revocar** la anula. Más en [Agentes y API](agentes-y-api.md).
- **Cambiar contraseña**:
  1. Escribe la **Contraseña actual**.
  2. Escribe la **Nueva contraseña** (mínimo 8 caracteres) y repítela.
  3. Pulsa **Cambiar**. Verás "Contraseña cambiada; las demás sesiones se han cerrado": los demás navegadores donde
     tuvieras la sesión abierta tendrán que volver a entrar.
- **Sesiones activas**: la lista de los navegadores y dispositivos donde tienes la sesión abierta, con el navegador y
  el sistema (por ejemplo "Firefox en Linux" o "Safari en iOS (móvil)"), la IP **sin el último número**, cuándo se abrió
  y su último uso. La de este navegador lleva la marca **esta sesión**. **Cerrar esta sesión** cierra solo esa: aquel
  navegador tiene que volver a entrar y sus espacios abiertos se desconectan al momento.
- **Cerrar todas las sesiones**: cierra tu sesión en todos los navegadores, **incluido este**, y te devuelve al
  inicio. Úsalo si has entrado en un ordenador ajeno o crees que alguien usa tu cuenta.
- **Correo y notificaciones** (solo si el servidor envía correos): **Recibir por correo cuando me mencionen** (activado
  por defecto) y el **Idioma de los correos**.

Para **cambiar el correo** escribe el nuevo en **Perfil**, tu contraseña actual y pulsa **Guardar**. Si el servidor
envía correos, el cambio **no es inmediato**: te mandamos un enlace a la dirección nueva (24 horas) y un aviso a la
anterior; hasta que abras el enlace sigues entrando con el correo de antes. Sin correo, el cambio es inmediato.

## Notificaciones {#notificaciones}

Con la sesión iniciada, junto a tu nombre (y en la barra del editor de los espacios del servidor) está la **campana**.
El número rojo son las notificaciones **sin leer**. Al pulsarla ves las últimas, con un enlace a lo notificado:

- **Te han mencionado** en un comentario (ver [menciones](comentarios.md#menciones)), con un extracto.
- **Te han compartido un espacio**: alguien te ha añadido como miembro, con tu rol.
- **Tu rol ha cambiado** en un espacio, o **ahora eres su propietario**.
- **Han restaurado una versión** de un espacio tuyo (si lo haces tú, no te avisa).

Al abrir una notificación queda leída; **Marcar todo como leído** las marca todas. La campana se actualiza sola cada
minuto. Si el servidor envía correos y tienes activado **Recibir por correo cuando me mencionen**, las menciones también
te llegan por correo al momento.

### Qué pasa al cerrar sesiones {#cerrar-sesiones}

**Cambiar contraseña**, **Cerrar todas las sesiones** y el **restablecimiento** que hace un administrador (ver
[Administración del servidor](#administracion)) cierran las sesiones **y desconectan al momento** los espacios del
servidor que estuvieran abiertos en esos navegadores: quien los tenga abiertos deja de recibir y de enviar cambios y
tiene que volver a entrar. Lo que no se hubiera enviado todavía no llega al servidor.

Los tres ofrecen la casilla **Revocar también las claves API**, marcada por defecto: así los agentes y scripts que
usen tus claves también pierden el acceso. Desmárcala solo si estás seguro de que tus claves no se han filtrado (por
ejemplo, si solo quieres cerrar la sesión de un ordenador prestado).

**Cerrar sesión** (en el menú de tu nombre) solo afecta a este navegador: cierra su sesión y desconecta el espacio
del servidor que tuviera abierto. Las claves API siguen funcionando.

> [!NOTE]
> Una clave API no puede cerrar sesiones ni cambiar la contraseña: esas acciones solo se pueden hacer con la sesión
> iniciada en el navegador. Así, quien consiga una clave no puede echarte de tu cuenta.

## Administración del servidor {#administracion}

Si eres administrador, la pantalla **Cuenta** muestra además **Usuarios del servidor**: todas las cuentas con su
nombre, correo, fecha de creación y si son administradoras.

**Si alguien olvida su contraseña** y el servidor envía correos, puede recuperarla sola con **¿Olvidaste tu
contraseña?** (ver [He olvidado la contraseña](#recuperar-contrasena)). Si el servidor no envía correos:

1. Entra en **Cuenta** y busca a esa persona en **Usuarios del servidor**.
2. Pulsa **Restablecer** junto a su correo y confirma.
3. Aparece una **contraseña temporal**. Cópiala ahora (no se vuelve a mostrar) y házsela llegar por un canal seguro.
   Sus sesiones abiertas se cierran y sus espacios abiertos se desconectan al momento (ver
   [Qué pasa al cerrar sesiones](#cerrar-sesiones)).
4. La persona entra con la contraseña temporal y la cambia en **Cuenta → Cambiar contraseña**.

No puedes restablecer tu propia contraseña desde esta lista; usa **Cambiar contraseña**.

## Errores comunes {#errores-comunes}

**"Escribimos dos a la vez y se ha perdido un cambio."**
Si los dos cambiasteis el mismo campo corto (por ejemplo, el nombre), gana el último: es lo esperado (ver
[edición simultánea](#edicion-simultanea)). Los textos largos y los campos distintos se combinan. Si se perdió algo que
necesitas, búscalo en el [Historial](historial.md).

**"Sale «Hay una versión nueva de all-draw» y no sincroniza."**
Esa pestaña es de una versión anterior de la aplicación. Pulsa **Recargar** (o recarga la página): lo que tenías está
guardado en el navegador y se envía al volver.

**"No veo el botón Compartir."**
Solo lo ve el propietario, y solo en espacios del servidor. Si el espacio es local, súbelo primero con **Subir al
servidor**. Si no eres el propietario, pídele que te mande un enlace.

**"Al pulsar Subir al servidor sale «Necesitas una cuenta en el servidor»."**
Tienes que entrar con tu cuenta antes. Vuelve al inicio (☰), pulsa **Entrar / registrarse** y repite.

**"He subido el espacio y mis últimos cambios no están."**
Seguramente los hiciste en la copia local, que no está conectada con la del servidor. Abre la copia del servidor
desde **En el servidor**.

**"La otra persona abre el enlace y ve «No se pudo abrir»."**
El enlace se ha revocado o ha caducado, o se ha copiado incompleto (tiene que incluir `?token=lnk_…`). Crea uno nuevo
y vuelve a enviarlo.

**"Cerré la pestaña y ya no puedo volver a entrar con el enlace."**
El token se guarda solo en la pestaña donde se abrió y se borra de la dirección. Abre otra vez el enlace original (no
un marcador de la dirección sin token).

**"La otra persona no puede editar."**
Le diste un enlace de lectura. Crea un **Nuevo enlace de edición**, envíaselo y, si quieres, revoca el de lectura.

**"Revoqué un enlace y la persona sigue viendo los cambios."**
Al revocar se desconecta al instante. Si sigue apareciendo en la presencia, es que entra por otro camino: con otro
enlace (revócalo también) o con su cuenta como miembro (quítala de los miembros).

**"Sale «Ya no tienes acceso a este espacio»."**
Han revocado el enlace con el que entraste o te han quitado el permiso. Pulsa **Volver al inicio** y pide un enlace nuevo
a quien administra el espacio. Lo que hicieras después de perder el acceso no se ha guardado en el servidor; si lo
necesitas, expórtalo antes de salir (**Importar / Exportar**).

**"Pone «sin conexión» y no vuelve a «en línea»."**
Comprueba tu conexión a internet y recarga la página: tus cambios están guardados en el navegador y se enviarán al
reconectar. Si la red funciona y sigue sin conectar, puede que el servidor esté caído; avisa a quien lo administre.

**"Al entrar sale «Demasiados intentos; espera unos minutos»."**
Se han hecho demasiados intentos de entrar desde tu conexión o con tu correo (el límite es de 10 cada 15 minutos). Espera y prueba de nuevo
con calma; si no recuerdas la contraseña, pide a un administrador que la restablezca.

**"No puedo registrarme."**
El servidor pide un **Código de invitación** o tiene el registro cerrado. Pide acceso a quien lo administre.

**"Aparezco como «Anónimo» y un número."**
Has abierto el enlace sin haber iniciado sesión. Entra con tu cuenta y vuelve a abrir el enlace para aparecer con tu
nombre; ver [Presencia](#presencia).
