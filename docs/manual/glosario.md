# Glosario

Las palabras que usa all-draw, explicadas en pocas líneas. Están agrupadas por tema; usa la búsqueda
del centro de documentación si buscas una concreta.

## Espacios y modelo {#grupo-espacios-y-modelo}

### Espacio {#espacio}

El documento con el que trabajas: contiene el modelo, todas sus vistas, librerías, reglas, personas
y comentarios. Puede ser **local** (vive en tu navegador) o **del servidor** (se guarda en el
servidor y se comparte). Ver [espacios](conceptos.md#espacios).

### Espacio local {#espacio-local}

Espacio guardado solo en este navegador, sin cuenta. Nadie más lo ve y no tiene historial; para no
perderlo, exporta un `.alldraw.json` de vez en cuando. Ver [primeros pasos](primeros-pasos.md).

### Espacio del servidor {#espacio-del-servidor}

Espacio guardado en el servidor con tu cuenta. Se puede compartir, se sincroniza en directo y tiene
[historial](historial.md).

### Modelo {#modelo}

El conjunto de *cosas* que describes (elementos) y cómo se relacionan (relaciones),
independientemente de cómo se dibujen. Un mismo modelo se puede mostrar en muchas vistas. Ver
[modelo y vistas](conceptos.md#modelo-y-vistas).

### Elemento {#elemento}

Una cosa del modelo: un proceso, una aplicación, un estado, una tabla… Tiene tipo, nombre,
documentación y campos. Renombrarlo en una vista lo renombra en todas.

### Relación {#relacion}

Un vínculo con tipo entre dos elementos del modelo ("sirve a", "fluye a", "realiza"…). Existe una
sola vez en el modelo aunque se dibuje en varias vistas.

### Tipo {#tipo}

La clase de un elemento o relación dentro de una notación (por ejemplo *Business Process* en
ArchiMate o *Tarea* en BPMN). Decide su forma, su color, sus campos y con qué se puede conectar.

### Categoría {#categoria}

Agrupación de tipos en la paleta (por ejemplo *Actividades* o *Eventos* en BPMN). Solo sirve para
ordenar la paleta.

### Campo {#campo}

Un dato con nombre de un elemento (por ejemplo, "responsable" o "request"). Los campos los define
el tipo o una librería; también puedes añadir propiedades libres. Algunos campos generan pines.

### Relación implícita {#relacion-implicita}

La relación que all-draw crea por ti cuando metes un nodo dentro de otro, si la notación propone
una (por ejemplo, composición en ArchiMate). Así anidar no es solo un dibujo: queda en el modelo.

## Vistas y lienzo {#grupo-vistas}

### Vista {#vista}

Un diagrama concreto del espacio, con una notación. Muestra una parte del modelo, dispuesta a tu
gusto. Un espacio puede tener tantas vistas como quieras.

### Nodo (aparición) {#nodo}

El dibujo de un elemento en una vista: posición, tamaño, estilo. Un mismo elemento puede tener
varias apariciones en vistas distintas. **Quitar de esta vista** borra la aparición, no el
elemento.

### Arista {#arista}

El dibujo de una relación en una vista: la línea con sus puntos de quiebre y su estilo. Borrar una
arista de una vista no borra la relación del modelo si se dibuja en otras.

### Contenedor {#contenedor}

Un nodo que puede contener otros dentro (un pool de BPMN, un grupo, un sistema en C4). Al meter un
nodo dentro, queda **anidado**.

### Anidamiento {#anidamiento}

Poner un nodo dentro de otro. La notación decide qué puede ir dentro de qué y, a veces, crea una
[relación implícita](#relacion-implicita). Ver [editor](editor.md).

### Punto de quiebre {#punto-de-quiebre}

Un codo en una línea. Doble clic sobre la línea añade uno, arrastrarlo lo mueve y doble clic sobre
él lo quita.

### Enrutado {#enrutado}

Cómo se traza el camino de una línea entre dos nodos: **Ortogonal** (en ángulo recto), **Curva**
o **Recta**. Se elige en el inspector de la arista, campo **Trazado**.

### Layout automático {#layout-automatico}

Botón que recoloca los nodos de la vista actual de forma ordenada, según la notación. Se puede
deshacer con Ctrl+Z.

### Rejilla capas × etapas {#rejilla}

Un tipo de vista en forma de tabla: las filas son **capas** y las columnas **etapas**, y cada nodo
vive en una celda. Útil para mapas de procesos o de arquitectura por fases. Ver
[notación de rejilla](notaciones/grid.md).

### Capa {#capa}

Una fila de la rejilla capas × etapas (por ejemplo "Negocio", "Aplicación", "Tecnología").

### Etapa {#etapa}

Una columna de la rejilla capas × etapas (por ejemplo "Solicitud", "Validación", "Alta"). Varias
etapas se pueden agrupar en bandas.

## Notaciones y dimensiones {#grupo-notaciones}

### Notación {#notacion}

El lenguaje de diagrama de una vista: ArchiMate, BPMN, C4, máquina de estados, entidad-relación…
Decide la paleta, las formas y qué conexiones son válidas. Ver [notaciones](notaciones.md).

### Pack {#pack}

El paquete que implementa una notación dentro de all-draw: sus tipos, relaciones, matriz de
validez, viewpoints y formas. En la práctica, "pack" y "notación" se usan casi como sinónimos.

### Dimensión {#dimension}

Una forma de mirar el mismo elemento desde otra notación: el proceso "Alta de cliente" en
ArchiMate, en BPMN y como máquina de estados son tres dimensiones del mismo elemento. Ver
[dimensiones](conceptos.md#dimensiones).

### Viewpoint {#viewpoint}

Un enfoque dentro de una notación que destaca los tipos relevantes para una pregunta concreta (por
ejemplo *Contexto* en C4). Atenúa el resto de la paleta, pero no lo prohíbe. Ver
[viewpoints](conceptos.md#viewpoints).

### Vista de detalle {#vista-de-detalle}

Una vista que explica por dentro un elemento concreto (su **elemento raíz**). Por ejemplo, la vista
BPMN que detalla el proceso "Alta de cliente".

### Elemento raíz {#elemento-raiz}

El elemento que una vista de detalle describe. Se elige en el inspector de la vista.

### Drill-down {#drill-down}

Entrar desde un nodo en su vista de detalle, y desde ahí en otra, cada vez más hondo. Ver
[drill-down](conceptos.md#drill-down).

### Ruta de vistas {#ruta}

La línea de migas de pan (*breadcrumb*) de la barra que muestra por qué vistas has bajado. Pulsa
cualquiera para volver a ella, o la flecha ← para volver a la anterior.

### Matriz de validez {#matriz-de-validez}

La tabla de cada notación que dice qué tipo de relación se permite entre qué tipos de elemento.
Por ella el editor no te deja conectar dos cosas que la notación no admite. Ver
[validez](conceptos.md#validez).

### Figura ArchiMate {#figura-archimate}

La forma alternativa de un elemento ArchiMate (por ejemplo, el cilindro de un objeto de datos o el
monigote de un actor), en lugar del rectángulo con icono. Se elige en el inspector. Ver
[ArchiMate](notaciones/archimate.md).

### Catálogo de diagramas {#catalogo}

Una lista de más de 160 tipos de diagrama habituales en una organización de TI (mapa de
capacidades, mapa de flujo de valor, arquitectura de aplicaciones…) que dice con qué notación de
all-draw se dibuja cada uno. Sirve para elegir el tipo de diagrama al crear una vista. Ver
[notaciones](notaciones.md).

## Pines, trazas y comprobaciones {#grupo-pines-y-trazas}

### Pin {#pin}

Un punto de conexión de un nodo que corresponde a un campo del elemento (por ejemplo, cada campo
de la petición de una API). Permite conectar campo con campo. Ver [pines](conceptos.md#pines).

### Mapeo {#mapeo}

En una relación entre pines, la correspondencia entre un campo de origen y uno de destino (por
ejemplo, "cliente.dni → solicitud.documento").

### Traza {#traza}

Una relación que une elementos de distintos niveles o notaciones para decir que uno corresponde a
otro (por ejemplo, un proceso de negocio con la aplicación que lo soporta). Ver
[trazas](conceptos.md#trazas).

### Realiza {#realiza}

Traza que dice que un elemento *hace realidad* a otro más abstracto (una aplicación realiza un
servicio).

### Refina {#refina}

Traza que dice que un elemento es una versión *más detallada* de otro (un subproceso refina un
proceso).

### Cobertura de trazas {#cobertura-de-trazas}

Cuántos elementos de un nivel tienen su traza hacia el otro nivel. Los que no la tienen aparecen
como huecos en el panel de trazabilidad y en el panel de problemas.

### Validador {#validador}

Una comprobación automática que revisa el espacio (relaciones no válidas, elementos sin usar,
reglas de BPMN, solapes en el dibujo, trazas que faltan…) y deja sus resultados en el panel de
problemas.

### Diagnóstico {#diagnostico}

Cada aviso del panel de problemas: un error, un aviso o una nota, con el elemento afectado y una
explicación.

### Arreglo {#arreglo}

La corrección que un diagnóstico propone y que puedes aplicar con un clic (por ejemplo, borrar un
elemento que no se usa en ninguna vista).

## Librerías, reglas y personas {#grupo-librerias}

### Librería {#libreria}

Un conjunto propio de tipos (con sus campos y pines) y componentes reutilizables, para modelar lo
que las notaciones estándar no traen. Ver [librerías, reglas y personas](librerias-reglas-personas.md).

### Componente (plantilla) {#componente}

Un elemento de librería preparado para reutilizarse: arrastrarlo al lienzo crea una instancia con
sus campos ya puestos.

### Instancia {#instancia}

Un elemento creado a partir de un componente. Cuando cambias el componente, los cambios se
propagan a sus instancias.

### Regla {#regla}

Una condición más un estilo: "si el campo *estado* vale *obsoleto*, pinta el nodo en gris". Cambia
la apariencia, no el modelo.

### Persona {#persona}

Alguien que das de alta en el espacio (nombre, correo, equipo) para asignarle responsabilidades o
mencionarlo en comentarios. No es una cuenta del servidor.

### Asignación {#asignacion}

El vínculo entre una persona y algo del espacio (un elemento, una vista, una capa, una etapa, un
tipo o una relación) con un papel, por ejemplo "responsable".

## Colaboración {#grupo-colaboracion}

### Comentario {#comentario}

Un mensaje anclado a un elemento, nodo, línea, punto del lienzo o vista. Ver
[comentarios](comentarios.md).

### Hilo {#hilo}

Un comentario y sus respuestas. Se resuelve o se reabre entero.

### Mención {#mencion}

Escribir `@Nombre` en un comentario para referirte a una persona del espacio. Se resalta, pero no
envía avisos.

### Instantánea {#instantanea}

Una copia completa de un espacio del servidor en un momento dado, a la que se puede volver. Ver
[historial](historial.md).

### Enlace compartido {#enlace-compartido}

Una dirección que da acceso a un espacio del servidor, de edición o de lectura, sin necesidad de
cuenta. Se puede revocar en cualquier momento. Ver [invitar](compartir-y-colaborar.md#invitar).

### Rol {#rol}

Lo que puedes hacer en un espacio del servidor: **owner** (dueño: todo, incluido compartir y
borrar), **editor** (editar) o **viewer** (solo ver). Ver
[compartir y colaborar](compartir-y-colaborar.md).

### Presencia {#presencia}

Los avatares y cursores de las demás personas conectadas al mismo espacio, en directo.

### Sincronización (CRDT) {#sincronizacion}

La técnica con la que all-draw combina los cambios de varias personas, o los hechos sin conexión,
sin bloqueos ni conflictos: todas las copias acaban iguales. CRDT es el nombre técnico de este
tipo de estructura de datos.

### Modo sin conexión {#sin-conexion}

Seguir trabajando cuando se cae la red. Los espacios locales no necesitan red; en un espacio del
servidor que ya tienes abierto sigues editando sobre una copia en el navegador, que se sincroniza al
volver la conexión. Ver
[sin conexión](compartir-y-colaborar.md#sin-conexion).

### PWA {#pwa}

*Progressive Web App*: all-draw se puede instalar desde el navegador como si fuera una aplicación y
arranca aunque no haya red.

## Importar, exportar y automatizar {#grupo-importar-exportar}

### JSON de all-draw {#json-de-all-draw}

El formato propio de all-draw (`.alldraw.json`): guarda el espacio completo y sin pérdidas. Es la
mejor copia de seguridad. Ver [formatos](importar-exportar.md#formatos).

### Exportación dual {#exportacion-dual}

Un SVG que se ve en tema claro o oscuro según la preferencia de quien lo mira, en un solo fichero.

### HTML autocontenido {#html-autocontenido}

Un único fichero `.html` con todas las vistas, navegable sin conexión y sin instalar nada. Útil
para enviar el diagrama a quien no usa all-draw.

### Clave API {#clave-api}

Una contraseña larga para programas y agentes, que actúa con tus permisos. Se crea y se revoca en
**Cuenta**. Ver [claves](agentes-y-api.md#claves).

### MCP {#mcp}

*Model Context Protocol*: el protocolo con el que un asistente de IA puede leer y editar tus
espacios usando herramientas de all-draw. Ver [MCP](agentes-y-api.md#mcp).
