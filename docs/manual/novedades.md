# Novedades

Lo que ha ido cambiando en all-draw, de lo más reciente a lo más antiguo, contado desde el punto de
vista de quien lo usa.

## 3 de octubre de 2026 {#novedades-2026-10-03}

- **Centro de documentación dentro de la app**, en español e inglés: el manual completo, con
  búsqueda, índice de cada capítulo, referencia de todas las notaciones, glosario y preguntas
  frecuentes, sin salir de all-draw.
- **Tu cuenta, en tus manos**: en **Cuenta** puedes cambiar tu nombre y tu correo, ver tus cuotas,
  **exportar todos tus datos** en un JSON y **eliminar tu cuenta** tú mismo.
- Si la aplicación falla, en lugar de una página en blanco verás un aviso con la opción de
  recargar, y se envía un informe técnico (sin el contenido de tus diagramas) para poder
  corregirlo.
- Nuevos capítulos: [comentarios](comentarios.md), [historial](historial.md),
  [glosario](glosario.md), [preguntas frecuentes](faq.md), [privacidad](privacidad.md) y
  [condiciones de uso](terminos.md).

## 30 de septiembre de 2026 {#novedades-2026-09-30}

- **Comentarios en los diagramas**: comenta un elemento, una línea, un punto del lienzo o una vista
  entera; responde, menciona con @ a las personas del espacio y resuelve los hilos. Las burbujas del
  lienzo te enseñan dónde hay conversaciones abiertas, y los hilos no se pierden aunque se borre lo
  comentado. Ver [comentarios](comentarios.md).
- **Pata de gallo y cardinalidades** en los diagramas entidad-relación y de clases UML ("uno a
  muchos", "cero o uno"…), también al exportar a SVG, draw.io y Mermaid.
- **Cambiar de vista es más rápido**: hasta casi el doble en diagramas grandes.
- all-draw también funciona **instalado en Cloudflare**, para quien quiera alojarlo allí.
- Si el servidor tiene el registro cerrado, nadie puede crear una cuenta sin código de invitación,
  ni siquiera en una instalación recién estrenada.

## 26 de septiembre de 2026: historial, móvil y seguridad {#novedades-2026-09-26-historial}

- **Historial de versiones** en los espacios del servidor: instantáneas automáticas cada 30 minutos
  de actividad, instantáneas con nombre cuando quieras, restaurar con un clic y descargar cualquier
  versión. Ver [historial](historial.md).
- **Copias de seguridad diarias** del servidor, conservadas 30 días.
- **Móvil y tableta**: barra inferior, paneles deslizantes, pulsación larga para el menú y botones
  pensados para el dedo.
- **Modelos grandes más ágiles**: espacios con miles de elementos y decenas de vistas se abren,
  validan y dibujan mucho más rápido.
- **Cuenta más segura**: cambiar la contraseña, cerrar sesión en todos los dispositivos, sesiones
  que caducan tras 30 días sin uso, restablecimiento de contraseña por un administrador y registro
  con código de invitación.

## 26 de septiembre de 2026: inglés {#novedades-2026-09-26-ingles}

- all-draw **en inglés**: selector de idioma en el inicio y en el editor. Por defecto usa el idioma
  de tu navegador. Los nombres de las notaciones, tipos y viewpoints también se traducen (los de
  ArchiMate se quedan en inglés, como en la especificación).
- En los diagramas de secuencia, una línea de vida ya puede **enviarse mensajes a sí misma**.

## 26 de septiembre de 2026: figuras ArchiMate y trazabilidad {#novedades-2026-09-26-archimate}

- **Figuras ArchiMate** iguales a las de Archi: iconos propios para los 61 tipos y sus figuras
  alternativas, también en el SVG exportado.
- **Trazabilidad visible**: matriz entre dos notaciones, cobertura, huecos y sugerencias de trazas
  que puedes aceptar de una vez. Ver [trazas](conceptos.md#trazas).
- **Diagramas de secuencia** con su propio lienzo: líneas de vida en columnas y mensajes que se
  ordenan arrastrando.
- **Manual de usuario** con capturas y mejoras de **accesibilidad** (teclado, lectores de
  pantalla, contraste).

## 26 de septiembre de 2026: cuentas y colaboración {#novedades-2026-09-26-cuentas}

- **Cuentas** y **espacios en el servidor**, con roles de propietario, puede editar y solo lectura.
- **Compartir con enlaces** de edición o de lectura, que se pueden revocar. Ver
  [compartir y colaborar](compartir-y-colaborar.md).
- **Presencia**: ves quién está conectado y sus cursores.
- Los espacios del servidor **funcionan sin conexión** y se sincronizan al volver.
- **Importar y exportar** Archi, ArchiMate Open Exchange, BPMN 2.0, Structurizr, XState, Mermaid,
  OpenAPI y draw.io; exportar a **SVG**, **PNG** y **HTML autocontenido**. Ver
  [importar y exportar](importar-exportar.md).
- **Nuevas notaciones**: secuencia, entidad-relación, clases UML, mapa mental, diagrama de flujo y
  flujo de datos, además de BPMN completo y un catálogo de más de 160 tipos de diagrama.
- **Tema oscuro**, **layout automático**, búsqueda global (**Ctrl+K**), renombrar con **F2**,
  notas, grupos, etiquetas e imágenes en el lienzo.
- **API y MCP** para que programas y asistentes de IA trabajen con tus espacios. Ver
  [agentes y API](agentes-y-api.md).

## 26 de septiembre de 2026: librerías y edición {#novedades-2026-09-26-librerias}

- Panel **Espacio** con **librerías** (tipos propios con campos y pines, componentes reutilizables),
  **reglas** de estilo y **personas** con sus asignaciones. Ver
  [librerías, reglas y personas](librerias-reglas-personas.md).
- **Copiar, pegar y duplicar** (Ctrl+C, Ctrl+V, Ctrl+D), **alinear y distribuir** varios nodos y
  **puntos de quiebre** editables en las líneas.

## 26 de septiembre de 2026: primera versión {#novedades-2026-09-26-primera}

- Un modelo, muchas notaciones: **ArchiMate**, **BPMN**, **máquina de estados**, **C4**,
  **capas × etapas** y **libre**, con un mismo elemento visible en varias dimensiones. Ver
  [conceptos](conceptos.md).
- El editor solo permite las conexiones que la notación admite.
- **Espacios locales** guardados en el navegador, que funcionan sin conexión e instalables como
  aplicación (PWA).
- **Importar desde Drawer** (`.drawer`), con sus APIs y campos convertidos en pines. Ver
  [Drawer](importar-exportar.md#drawer).
- Una **demo** ("Alta de cliente") en cinco dimensiones para ver la idea en marcha.
