# Preguntas frecuentes

Respuestas cortas a las dudas más habituales. Cada una enlaza al capítulo donde se explica con
detalle.

## Empezar {#empezar}

### ¿Qué es all-draw y en qué se diferencia de otros diagramadores? {#que-es}

Es un diagramador en el que **un mismo modelo** se dibuja en **muchas notaciones**: el proceso "Alta
de cliente" puede aparecer en un mapa ArchiMate, en un BPMN y en una máquina de estados, y sigue
siendo una sola cosa. Si lo renombras en un sitio, cambia en todos. Ver
[conceptos](conceptos.md).

### ¿Necesito una cuenta? {#necesito-cuenta}

No. Sin cuenta trabajas con **espacios locales**, guardados en tu navegador. La cuenta hace falta
para guardar en el servidor, compartir y tener historial. Ver [primeros pasos](primeros-pasos.md).

### No puedo registrarme. ¿Por qué? {#no-puedo-registrarme}

Cada servidor decide si el registro está abierto, si pide un **código de invitación** o si está
cerrado ("El registro está cerrado en este servidor."). En los dos últimos casos, pide acceso a
quien opera el servidor. Mientras tanto puedes usar espacios locales.

### ¿Puedo usarlo en el móvil o en la tableta? {#movil}

Sí. En tableta los paneles se pliegan; en el móvil hay una barra inferior y los paneles salen como
hojas deslizantes. La **pulsación larga** sustituye al botón derecho. Para diagramas grandes, una
pantalla más amplia es más cómoda. Ver [editor](editor.md).

### ¿Cómo cambio el idioma o el tema? {#idioma-y-tema}

El **idioma** (español o inglés) se elige en el selector de la pantalla de inicio o en la barra del
editor; se recuerda en ese navegador. El **tema** se cambia con el botón de la barra del editor, que
pasa por *sistema* → *claro* → *oscuro*. Ver [editor](editor.md).

### ¿Hay atajos de teclado? {#atajos}

Sí: pulsa **?** en el editor para verlos todos, o consulta [atajos](atajos.md). Los más útiles:
**Ctrl+Z** deshacer, **Ctrl+Y** rehacer, **Ctrl+K** buscar, **F2** renombrar, **Supr** quitar de la
vista.

## Guardar y datos {#guardar-y-datos}

### ¿Se guarda solo? {#se-guarda-solo}

Sí, siempre. No hay botón de guardar. En un espacio local, cada cambio se guarda al momento en el
navegador ("guardado en este navegador"). En un espacio del servidor, los cambios se envían en
menos de un segundo; el indicador "● en línea" confirma la conexión. Ver
[primeros pasos](primeros-pasos.md).

### ¿Funciona sin conexión? {#sin-conexion}

Sí. Los espacios locales no necesitan red nunca, y la aplicación arranca sin conexión. Los
espacios del servidor que ya hayas abierto en ese navegador también se abren sin red, desde su copia
y con el último permiso que tenías ("○ sin conexión — los cambios se sincronizarán"); si la conexión
se cae mientras trabajas, el indicador pasa a "○ sin conexión (se sincroniza al volver)" y sigues
editando. Al volver la red se comprueban tus permisos y se fusiona todo. Solo un espacio del
servidor que nunca abriste en ese navegador necesita red para abrirse. Ver
[sin conexión](compartir-y-colaborar.md#sin-conexion).

### ¿Dónde están mis espacios locales y cómo no perderlos? {#espacios-locales}

Están **dentro de este navegador, en este equipo**, en la lista "En este navegador" del inicio. No
pasan a otro navegador ni a otro equipo, y se pierden si borras los datos del sitio o usas una
ventana privada. Para protegerlos: exporta de vez en cuando un **JSON de all-draw**
(`.alldraw.json`) o súbelos al servidor. Ver [espacios](conceptos.md#espacios).

### ¿Cómo paso un espacio local al servidor? {#subir-al-servidor}

Con la sesión iniciada, pulsa **Subir al servidor**, en la barra del editor o junto al espacio en
la pantalla de inicio. Se crea una **copia** en el servidor y se abre; el original local sigue en
tu navegador hasta que lo borres. Ver [primeros pasos](primeros-pasos.md).

### ¿Cómo recupero una versión anterior? {#version-anterior}

- Un error de hace un momento: **Ctrl+Z**.
- Un espacio del servidor de hace horas o días: **Historial** → **Restaurar** sobre la instantánea
  que quieras (el estado actual se guarda antes).
- Un espacio local: importa el último `.alldraw.json` que exportaste.

Ver [historial](historial.md).

### ¿Cuánto cuesta? ¿Hay límites? {#coste-y-limites}

El servicio de alldraw.bezenti.com es **gratuito** y lo mantiene un equipo pequeño: no hay
garantía de disponibilidad (SLA) ni soporte con plazos. Hay límites para que el servicio siga
siendo usable por todo el mundo: cada cuenta puede ser dueña de hasta 100 espacios, cada espacio
puede ocupar hasta 20 MB, un fichero que importes al servidor puede ocupar hasta 5 MB, cada espacio
guarda hasta 100 instantáneas y hay límites de intentos de inicio de sesión. Tus cuotas se ven en
**Cuenta**. Ver [términos](terminos.md).

### ¿Mis datos son privados? {#privacidad}

Tus espacios del servidor solo los ven tú, las personas a las que des acceso y, si hace falta para
mantenerlo o resolver una incidencia, quien administra el servidor. No hay publicidad ni analítica de terceros. Los espacios locales no
salen de tu navegador. Ver [privacidad](privacidad.md).

### ¿El servicio no responde? ¿Dónde veo si está caído? {#estado-del-servicio}

En la [página de estado](https://alldraw-monitor.darwin-sva-97.workers.dev) (también en el pie de la app,
**Estado del servicio**): se comprueba cada 5 minutos y muestra la disponibilidad de las últimas 24 horas y 7 días y
los últimos incidentes. Mientras el servidor principal no responde, los espacios que ya abriste en tu navegador
siguen disponibles sin conexión, y en [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev)
hay una **copia de respaldo de solo lectura**, actualizada cada noche, donde puedes entrar con tu cuenta y consultar
tus diagramas (no editarlos: los cambios se hacen en https://alldraw.bezenti.com).

## Editar {#editar}

### ¿Qué diferencia hay entre borrar de la vista y borrar del modelo? {#borrar-vista-o-modelo}

**Supr** (o botón derecho → **Quitar de esta vista**) quita el dibujo de esta vista; el elemento
sigue en el modelo y en las demás vistas. Botón derecho → **Borrar del modelo** lo elimina de
verdad, de todas las vistas, con sus relaciones. Ver [modelo y vistas](modelo-y-vistas.md).

### ¿Por qué no puedo conectar estos dos elementos? {#no-puedo-conectar}

Porque la notación de la vista no permite **ninguna** relación entre esos dos tipos: cada notación
tiene una [matriz de validez](conceptos.md#validez) y el editor la respeta. Si conectas pines, sus
campos además tienen que ser compatibles. Prueba con otro tipo de elemento, conecta en la otra
dirección o usa una [traza](conceptos.md#trazas) si son de niveles distintos. Ver
[editor](editor.md).

### ¿Puedo poner el mismo elemento en varios diagramas? {#mismo-elemento}

Sí, es la idea central. Arrástralo desde la pestaña **Modelo** de la paleta a otra vista, o usa
botón derecho → **Abrir en otra dimensión**. Ver [modelo y vistas](modelo-y-vistas.md).

### ¿Por qué no puedo editar nada? {#solo-lectura}

Estás en **solo lectura**: tienes ese rol en el espacio o has entrado con un enlace de lectura. Pide
al propietario un enlace de edición. Ver [compartir y colaborar](compartir-y-colaborar.md).

### ¿Cómo dejo comentarios a mis compañeros? {#comentar}

Botón derecho sobre un nodo → **Comentar**, o sobre el lienzo → **Comentar aquí**. Puedes responder,
mencionar con @ y resolver. Ver [comentarios](comentarios.md).

## Notaciones {#notaciones}

### ¿Qué notaciones puedo usar? {#que-notaciones}

ArchiMate, BPMN, máquina de estados, C4, capas × etapas, libre, secuencia, entidad-relación, clases
UML, mapa mental, diagrama de flujo y flujo de datos (DFD). Ver [notaciones](notaciones.md).

### ¿Qué es una dimensión? {#que-es-dimension}

Otra forma de ver el mismo elemento con otra notación: el proceso en ArchiMate, su detalle en BPMN y
su ciclo de vida como máquina de estados. Ver [dimensiones](conceptos.md#dimensiones).

## Colaborar {#colaborar}

### ¿Cómo invito a alguien? {#invitar}

En un espacio del servidor del que seas propietario, pulsa **Compartir** → **Nuevo enlace de edición** (o
**Nuevo enlace de lectura**) → **Copiar enlace**, y envía el enlace. Quien lo abra no necesita
cuenta. Lo puedes **revocar** cuando quieras. Ver [invitar](compartir-y-colaborar.md#invitar).

### ¿Qué pasa si dos personas editan lo mismo a la vez? {#edicion-simultanea}

Nada malo: los cambios se combinan sin bloqueos y todos acabáis viendo lo mismo. Si dos personas
cambian **exactamente el mismo dato** a la vez (por ejemplo, el nombre del mismo elemento), queda
uno de los dos valores, el mismo para todo el mundo. **Ctrl+Z** solo deshace tus cambios, nunca los
de otra persona. Ver [compartir y colaborar](compartir-y-colaborar.md).

### ¿Me avisan cuando me mencionan o me comparten un espacio? {#notificaciones}

Sí, en los espacios del servidor: la **campana** junto a tu nombre cuenta las notificaciones sin leer
(menciones, espacios compartidos contigo, cambios de rol y versiones restauradas en tus espacios). Para
que una mención te llegue, tu correo tiene que estar en tu ficha de **Espacio → Personas** (o firmar
comentarios con el mismo nombre). Si el servidor envía correos, las menciones también llegan por correo;
lo quitas en **Cuenta → Correo y notificaciones**. Ver [notificaciones](compartir-y-colaborar.md#notificaciones)
y [quién recibe el aviso](comentarios.md#aviso-de-mencion).

### ¿Cómo quito el acceso a alguien? {#quitar-acceso}

**Compartir** → **Revocar** junto al enlace que le diste. Desde ese momento el enlace ya no abre el
espacio, y quien lo tenga abierto se desconecta al instante con el aviso "Ya no tienes acceso a este
espacio". Si varias personas usaban el mismo enlace, crea uno nuevo para quienes deban seguir. Ver
[revocar un enlace](compartir-y-colaborar.md#revocar).

## Importar y exportar {#importar-y-exportar}

### ¿Cómo importo un modelo de Archi? {#importar-archi}

En la pantalla de inicio, **Importar…** y elige el fichero `.archimate` (o un Open Exchange
`.xml`). Se crea un espacio nuevo con los elementos, relaciones y vistas. Ver
[Archi](importar-exportar.md#archi).

### ¿Puedo exportar a imagen? {#exportar-imagen}

Sí, desde **Importar / Exportar**, para la vista abierta: **SVG** (un solo fichero que se ve bien en
tema claro y oscuro) o **PNG** a doble resolución. Para todas las vistas a la vez, **HTML
autocontenido**. Ver [formatos](importar-exportar.md#formatos).

### ¿Puedo llevar un BPMN a otras herramientas? {#exportar-bpmn}

Sí: **Importar / Exportar → BPMN 2.0 XML** genera un fichero estándar que abren otras herramientas
de BPMN. También se importan. Ver [BPMN](importar-exportar.md#bpmn).

### ¿Importar sustituye lo que tengo? {#importar-sustituye}

Desde el **inicio**, importar crea un espacio **nuevo**. Desde el menú **Importar / Exportar** del
editor, importar **sustituye** el contenido del espacio abierto (te pide confirmación). Antes de
hacerlo, exporta un `.alldraw.json` o, en un espacio del servidor, crea una instantánea con
etiqueta en **Historial**, por si quieres volver atrás.

## Cuenta y seguridad {#cuenta-y-seguridad}

### He olvidado la contraseña. ¿Qué hago? {#olvide-contrasena}

Pulsa **Entrar → ¿Olvidaste tu contraseña?**. Si el servidor envía correos, escribe tu correo y te
llega un enlace para elegir una contraseña nueva: sirve **una vez** y caduca en **una hora**, y al
usarlo se cierran todas tus sesiones. Si el servidor **no envía correos**, el diálogo te lo dice: pide
a una persona administradora que la restablezca; te dará una contraseña temporal que cambias en
**Cuenta → Cambiar contraseña**. Ver [He olvidado la contraseña](compartir-y-colaborar.md#recuperar-contrasena).

### ¿Por qué tengo que confirmar mi correo? {#confirmar-correo}

Para saber que la dirección es tuya: es a donde llegan los enlaces para recuperar la contraseña y los
avisos de menciones. Al registrarte (o al cambiar el correo) te llega un enlace que caduca en 24 horas;
si se te pasó, **Cuenta → Reenviar el enlace**. Algunos servidores no dejan crear espacios en el
servidor hasta confirmarlo; los espacios de tu navegador funcionan siempre. Ver
[confirmar el correo](compartir-y-colaborar.md#verificar-correo).

### ¿Cómo veo dónde tengo la sesión abierta? {#sesiones-activas}

En **Cuenta → Sesiones activas**: cada navegador con su sistema, la IP sin el último número, cuándo se
abrió y su último uso. **Cerrar esta sesión** echa a ese navegador al momento. Ver
[tu cuenta](compartir-y-colaborar.md#ajustes-cuenta).

### ¿Cómo cambio la contraseña o cierro sesión en todos mis dispositivos? {#cambiar-contrasena}

En **Cuenta** (menú de tu nombre, arriba a la derecha → **Cuenta y claves API**): **Cambiar
contraseña** cierra además tus otras sesiones; **Cerrar todas las sesiones** cierra todas, incluida la
actual. En los dos casos los espacios abiertos en esos navegadores se desconectan al momento y, si
dejas marcada la casilla **Revocar también las claves API**, tus claves dejan de funcionar. Para
salir solo de este navegador, usa **Cerrar sesión** en el menú de tu nombre. Una sesión que no usas
en 30 días caduca sola. Ver [qué pasa al cerrar sesiones](compartir-y-colaborar.md#cerrar-sesiones).

### ¿Cómo cambio mi nombre o mi correo? {#cambiar-nombre}

En **Cuenta → Perfil**. Para cambiar el correo te pide tu contraseña actual.

### ¿Cómo descargo todos mis datos? {#exportar-mis-datos}

En **Cuenta → Tus datos → Exportar mis datos** descargas un JSON con tu cuenta, tus claves API (sin
el secreto), tus espacios con su contenido, miembros y enlaces, y la lista de espacios compartidos
contigo. Ver [privacidad](privacidad.md#tus-derechos).

### ¿Cómo borro mi cuenta? {#borrar-cuenta}

En **Cuenta → Tus datos → Eliminar cuenta…**, escribe tu contraseña y confirma. Se borran tu cuenta,
tus sesiones, tus claves API y tu acceso a los espacios de otras personas. Cada espacio tuyo pasa a
su **editor más antiguo** (una cuenta a la que diste rol de editor); los que no tienen editores se
**borran**. No se puede deshacer: antes, exporta tus datos. Si eres la única persona administradora
del servidor, primero tienes que nombrar a otra. Ver [privacidad](privacidad.md#borrar-datos).

### ¿Puedo usar all-draw con un asistente de IA o desde mis programas? {#ia-y-api}

Sí. Crea una **clave API** en **Cuenta** y úsala con la API REST o con el servidor MCP para que un
agente lea y edite tus espacios. Ver [agentes y API](agentes-y-api.md).

### ¿Puedo instalar all-draw en mi propio servidor? {#autoalojar}

Sí: el código es abierto (licencia MIT) y se puede alojar en un servidor propio o en Cloudflare.
Ver [autoalojar](agentes-y-api.md#autoalojar).
