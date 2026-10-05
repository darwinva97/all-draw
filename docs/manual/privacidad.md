# Política de privacidad

Última actualización: 5 de octubre de 2026.

Esta política explica qué datos trata el servicio all-draw que se ofrece en
**https://alldraw.bezenti.com** (en adelante, "el servicio"), para qué, dónde y durante cuánto
tiempo, y cómo puedes ejercer tus derechos. Está escrita para que se entienda; si algo no queda
claro, escríbenos.

> [!NOTE]
> Esta política cubre el servicio alojado. Si usas all-draw instalado en el servidor de tu empresa
> o en el tuyo propio, el responsable de tus datos es quien opere esa instalación, no nosotros.

## Quién es el responsable {#responsable}

- Responsable: el autor del proyecto, una persona física, que opera el servicio de forma gratuita
  y lo identifica públicamente su cuenta de GitHub [darwinva97](https://github.com/darwinva97).
- Contacto para privacidad: un [aviso privado en GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), que solo ve el titular. Para lo demás, las [incidencias públicas del proyecto](https://github.com/darwinva97/all-draw/issues).
- Casi todo lo puedes hacer tú mismo sin escribir a nadie: exportar y borrar tus datos están en
  **Cuenta → Tus datos**.
- Si el servicio pasa a tener uso comercial, aquí se publicarán los datos fiscales del titular.

## Resumen {#resumen}

- Solo pedimos lo necesario para que tengas una cuenta: **correo, nombre y contraseña** (guardamos
  la contraseña cifrada de forma irreversible, nunca en claro).
- Tus diagramas son tuyos. Los guardamos para dártelos, no los usamos para nada más.
- **Sin publicidad, sin analítica de terceros, sin rastreo.** La única cookie propia es la de
  sesión.
- Puedes usar all-draw **sin cuenta**: los espacios locales no salen de tu navegador.
- Puedes llevarte todo en cualquier momento exportando un `.alldraw.json`.

## Qué datos tratamos {#que-datos}

### Si usas espacios locales (sin cuenta) {#datos-locales}

Nada llega a nuestro servidor. Tus espacios se guardan **en tu navegador** (IndexedDB) y solo salen
de él si tú lo decides: al exportar un fichero o al pulsar **Subir al servidor**. Para descargar la
aplicación tu navegador hace peticiones normales a la web (ver [infraestructura](#donde)).

### Si creas una cuenta {#datos-de-cuenta}

| Dato | Para qué |
|---|---|
| Correo electrónico | Identificarte al iniciar sesión. Puedes cambiarlo en **Cuenta → Perfil** |
| Nombre | Mostrarlo a las personas con quienes compartes. Puedes cambiarlo en **Cuenta → Perfil** |
| Contraseña | Se guarda solo su huella (hash PBKDF2-SHA256 con sal, 100 000 iteraciones); nadie, ni siquiera quien opera el servicio, puede leerla |
| Fecha de alta y si eres administrador | Gestión de la cuenta |
| Sesiones | Para mantenerte conectado: guardamos una huella del identificador de sesión, su fecha de creación y de caducidad. No guardamos tu IP ni tu navegador |
| Claves API | Nombre, primeros caracteres, huella de la clave, fecha de creación y de último uso. La clave completa solo se muestra una vez, al crearla |

### Contenido que guardas en el servidor {#datos-de-contenido}

- **Espacios**: nombre, propietario, fechas y todo su contenido (elementos, relaciones, vistas,
  librerías, reglas, personas y comentarios).
- **Miembros y enlaces compartidos**: quién tiene acceso a cada espacio, con qué rol, quién creó
  cada enlace y cuándo caduca.
- **Instantáneas del historial**: copias completas del espacio en distintos momentos, con quién las
  creó (ver [historial](historial.md)).
- **Comentarios**: texto, fecha y el nombre con el que se firmaron.

Mientras editas un espacio compartido, tu nombre, tu color, tu cursor y lo que tienes seleccionado
se envían **en directo** a las demás personas conectadas (presencia). Eso no se guarda.

### Datos técnicos {#datos-tecnicos}

- Para frenar ataques (por ejemplo, muchos intentos de contraseña), el servidor cuenta durante
  unos minutos los intentos por **dirección IP** y por correo. Ese recuento vive solo en memoria y
  se pierde al reiniciar; no se guarda en la base de datos.
- **Registro de peticiones**: por cada petición al servidor se anota la fecha, el método, la ruta
  (sin tokens ni contraseñas), el resultado, el tiempo de respuesta, el identificador interno de tu
  cuenta si has iniciado sesión y tu **IP truncada** (sin el último número, por ejemplo
  `203.0.113.0`), que permite ver abusos sin guardar tu dirección exacta. Nunca se registra el
  contenido de tus diagramas. También se anotan errores técnicos del servidor.
- **Informes de errores de la aplicación**: si la aplicación falla en tu navegador, envía un informe
  técnico con el mensaje de error, dónde ocurrió en el código, la página (sin tokens) y la
  identificación de tu navegador (*user agent*). Nunca incluye el contenido del diagrama. El servidor
  lo registra con tu IP truncada.
- Nuestros proveedores de infraestructura (ver [dónde](#donde)) procesan tu IP y los datos técnicos
  de la conexión para entregar la web, y pueden conservar registros según sus propias políticas.
  El proxy del servidor (Caddy) no guarda registros de acceso propios; Cloudflare conserva los suyos según
  su política de privacidad. En la instalación de Cloudflare Workers, los registros de la aplicación se
  guardan en Cloudflare unos días para diagnosticar fallos.

### Datos de otras personas que tú introduces {#datos-de-terceros}

En el panel **Personas** puedes anotar nombres, correos y equipos de otras personas, y en los
comentarios puedes mencionarlas. Esos datos los decides tú: introduce solo lo necesario y asegúrate
de que puedes hacerlo. Respecto a ellos, actuamos como encargado del tratamiento por tu cuenta.

## Para qué los usamos y con qué base legal {#finalidades}

| Finalidad | Base legal (RGPD) |
|---|---|
| Crear y mantener tu cuenta, guardar y sincronizar tus espacios, compartirlos como indiques | Ejecución del contrato: las [condiciones de uso](terminos.md) que aceptas al registrarte (art. 6.1.b) |
| Seguridad: limitar intentos, proteger sesiones, detectar abusos | Interés legítimo en proteger el servicio y a sus usuarios (art. 6.1.f) |
| Copias de seguridad para recuperar el servicio tras un fallo | Interés legítimo en no perder tus datos (art. 6.1.f) |
| Atender tus solicitudes y cumplir obligaciones legales | Obligación legal (art. 6.1.c) |

No usamos tus datos para publicidad, no hacemos perfiles y no tomamos decisiones automatizadas
sobre ti. No vendemos ni cedemos datos.

## Dónde están tus datos {#donde}

- **Servidor principal**: un servidor virtual (VPS) en Europa, donde viven la base de datos, los
  espacios, las instantáneas y las copias de seguridad.
  El proveedor es Contabo GmbH y el servidor está en Alemania (Unión Europea).
- **Cloudflare**: la web pasa por Cloudflare, que actúa como red de distribución y proxy (gestiona
  el DNS y el cifrado de la conexión y, por tanto, ve el tráfico). Cloudflare, Inc. es una empresa
  de EE. UU.; las transferencias internacionales se amparan en
  el Marco de Privacidad de Datos UE-EE. UU., al que Cloudflare está adherido, y las cláusulas contractuales
  tipo de su acuerdo de tratamiento de datos.
- **Copia de respaldo en Cloudflare Workers**: la dirección
  [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev) es una **copia de respaldo
  de solo lectura** del servicio, en la infraestructura de Cloudflare, que se actualiza **cada noche** con los datos
  del servidor principal (cuentas, espacios, miembros y enlaces). Sirve para consultar tus diagramas si el servidor
  principal cae; allí no se puede editar. Lo que borres en el servidor principal desaparece de la copia en la
  sincronización siguiente.
- **Copias de seguridad externas**: cada noche se envía una copia de la base de datos y de los espacios a
  Backblaze B2, un servicio de almacenamiento de Backblaze, Inc. (EE. UU.), en su región del este de EE. UU.
  (`us-east`). Se guardan cifradas en reposo, en un almacenamiento privado al que solo accede el titular, y se borran
  solas a los **90 días**. Solo se usan para recuperar el servicio tras un fallo grave. Las transferencias
  internacionales se amparan en las cláusulas contractuales tipo de su acuerdo de tratamiento de datos.
- **Monitor de disponibilidad**: un pequeño servicio en Cloudflare comprueba cada 5 minutos si el servicio responde y
  publica una [página de estado](https://alldraw-monitor.darwin-sva-97.workers.dev). Solo consulta el estado técnico
  (versión, tiempo en marcha y si la base de datos responde): **no ve cuentas, diagramas ni datos personales**.

## Cuánto tiempo los guardamos {#conservacion}

| Dato | Plazo |
|---|---|
| Cuenta | Hasta que se borre |
| Sesión | 30 días desde el último uso; al cerrar sesión se borra |
| Claves API | Hasta que las revoques o se borre la cuenta |
| Espacios y comentarios | Hasta que su propietario los borre |
| Instantáneas | Hasta 100 por espacio; las automáticas más antiguas se borran solas; todas se borran con el espacio |
| Copias de seguridad del servidor | 30 días; después se borran solas |
| Copias de seguridad externas (Backblaze) | 90 días; después se borran solas |
| Copia de respaldo en Cloudflare | Se sustituye cada noche por el contenido del servidor principal |
| Recuento de intentos por IP | Minutos, solo en memoria |
| Copia final de los espacios borrados al eliminar una cuenta | 30 días, con las copias de seguridad |
| Registros de peticiones y de errores | En el registro del sistema del servidor, que los borra solo por rotación al llenarse; contienen la IP truncada y nunca el contenido de los diagramas |

Ten en cuenta que un dato borrado puede seguir hasta 30 días en las copias de seguridad del servidor y
hasta 90 días en las copias externas, que no se modifican; pasado ese plazo desaparece. De la copia de
respaldo en Cloudflare desaparece en la sincronización de la noche siguiente.

## Sin publicidad ni rastreo {#sin-rastreo}

all-draw no incluye herramientas de analítica, píxeles de seguimiento, publicidad ni recursos de
terceros (fuentes, scripts) que se carguen desde otros dominios. La política de seguridad de
contenidos de la web solo permite cargar recursos del propio servicio.

La única excepción es de seguridad: Cloudflare puede añadir a la página un pequeño script de
**detección de bots** y fijar sus propias cookies técnicas de seguridad (por ejemplo `__cf_bm`),
para distinguir personas de ataques automatizados. No se usan para publicidad ni para seguirte por
otras webs. En el dominio principal están activas la comprobación del navegador, la protección del
correo frente a robots y la geolocalización aproximada por IP (solo el país, para seguridad).

## Cookies y almacenamiento en tu navegador {#cookies}

all-draw usa **una sola cookie**, técnica y necesaria, por lo que no requiere tu consentimiento:

| Nombre | Para qué | Duración |
|---|---|---|
| `alldraw_session` | Mantener tu sesión iniciada (solo si tienes cuenta). Es `HttpOnly` (los scripts no la leen) y solo viaja a este sitio | 30 días desde el último uso |

Cloudflare puede añadir sus propias cookies técnicas de seguridad (ver
[sin rastreo](#sin-rastreo)).

Además, la aplicación guarda en tu navegador datos que **no se envían** al servidor:

| Dónde | Qué |
|---|---|
| `localStorage` → `alldraw:lang` | Idioma elegido |
| `localStorage` → `alldraw:theme` | Tema (sistema, claro, oscuro) |
| `localStorage` → `alldraw:snap`, `alldraw:panels` | Preferencias del editor (ajuste a rejilla, paneles abiertos) |
| `localStorage` → `alldraw:index` | Lista de tus espacios locales |
| `localStorage` → `alldraw:me` | Nombre con el que firmar comentarios, si existe |
| `sessionStorage` → `alldraw:token:…` | Token de un enlace compartido, solo mientras la pestaña esté abierta |
| IndexedDB | Tus espacios locales y una copia de los espacios del servidor que abres, para trabajar sin conexión |
| Caché de la aplicación (PWA) | Los ficheros de la aplicación, para que arranque sin red |

> [!WARNING]
> Cerrar sesión **no borra** las copias de los espacios del servidor que guarda el navegador. Si
> usas un equipo compartido, borra los datos del sitio en la configuración del navegador al
> terminar.

## Con quién se comparten {#terceros}

- Con las **personas a las que des acceso** a un espacio (por enlace o como miembros).
- Con nuestros **proveedores de infraestructura** (alojamiento del VPS, Cloudflare y Backblaze para las
  copias de seguridad externas), solo para prestar el servicio y como encargados del tratamiento.
- Las personas **administradoras del servidor** pueden ver la lista de cuentas (nombre y correo)
  para gestionarlas, por ejemplo para restablecer una contraseña. Técnicamente también pueden abrir
  cualquier espacio del servidor; solo lo hacen para mantenimiento, para resolver una incidencia o
  cuando tú lo pides.
- Con autoridades, solo si una ley nos obliga.

Nadie más.

## Tus derechos {#tus-derechos}

Puedes pedir en cualquier momento:

- **Acceso**: saber qué datos tuyos tenemos.
- **Rectificación**: corregirlos.
- **Supresión**: que los borremos.
- **Portabilidad**: llevarte tus datos. Ya puedes hacerlo tú: **Cuenta → Tus datos → Exportar mis
  datos** descarga en un JSON tu cuenta, tus claves API (sin el secreto) y tus espacios con su
  contenido, miembros y enlaces; y **Importar / Exportar → JSON de all-draw** descarga un espacio
  concreto en un formato abierto.
- **Oposición y limitación** del tratamiento basado en interés legítimo.

Pídelo con un [aviso privado en GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), que solo ve el titular, indicando el correo de tu cuenta. Responderemos en el plazo
de un mes. Si no quedas conforme, puedes reclamar ante la autoridad de protección de
datos de tu país (en la Unión Europea, la de tu Estado miembro).

## Cómo borrar tus datos {#borrar-datos}

- **Espacios locales**: en el inicio, **Borrar** junto al espacio; o borra los datos del sitio en
  tu navegador.
- **Espacios del servidor**: su propietario los borra con **Borrar** en el inicio. Se borran con
  ellos sus instantáneas, miembros y enlaces.
- **Claves API y sesiones**: **Cuenta** → **Revocar** y **Cerrar todas las sesiones**.
- **Cuenta**: **Cuenta → Tus datos → Eliminar cuenta…**, con tu contraseña. Se borran tu cuenta, tus
  sesiones, tus claves API y tu acceso a espacios ajenos. Cada espacio tuyo pasa al miembro más antiguo
  que **puede editar**; los que no tienen ninguno se borran, y de ellos se guarda una copia final que se elimina
  sola a los 30 días, como el resto de copias de seguridad. Si no puedes entrar, pídelo con
  un [aviso privado en GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), que solo ve el titular.

## Seguridad {#seguridad}

- Conexión cifrada (HTTPS) y cabeceras de seguridad estrictas.
- Contraseñas con hash PBKDF2 y sal; sesiones y claves API guardadas solo como huellas.
- Cookie de sesión `HttpOnly` y `SameSite`, con protección contra peticiones de otros sitios.
- Límite de intentos de inicio de sesión y de registro.
- Copias de seguridad diarias, también fuera del servidor (cifradas en reposo).

Si encuentras un problema de seguridad, avísanos de forma privada en
https://github.com/darwinva97/all-draw/security.

Ningún sistema es infalible. Si detectamos una brecha que afecte a tus datos, te avisaremos y lo
comunicaremos a la autoridad cuando la ley lo exija.

## Menores {#menores}

El servicio no está dirigido a menores de 14 años. Si eres menor de esa edad, no crees una cuenta.

## Cambios en esta política {#cambios}

Si cambiamos algo importante, lo anunciaremos en [novedades](novedades.md) y actualizaremos la
fecha de arriba. Si el cambio afecta a cómo usamos tus datos, te lo haremos saber antes de
aplicarlo.
