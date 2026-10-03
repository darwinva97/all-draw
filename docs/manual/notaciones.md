# Notaciones

En all-draw no hay "un diagrama BPMN" y "otro diagrama ArchiMate" separados: hay **un modelo** y muchas
vistas, y cada vista se dibuja con una **notación**. Este capítulo explica qué es una notación, cómo
elegir la adecuada y cómo combinar varias. Cada notación tiene además su propia página con los
elementos clave, un ejemplo paso a paso y los errores habituales.

## Qué es un pack de notación {#que-es-un-pack}

Cada notación viene empaquetada como un **pack**: un conjunto de datos que le dice al editor qué se
puede dibujar y cómo. Un pack contiene:

| Parte | Qué decide | Ejemplo |
|---|---|---|
| **Tipos de elemento** | Lo que aparece en la paleta, con su forma, color, icono y campos | *Tarea*, *Evento de inicio* y *Pool* en BPMN |
| **Tipos de relación** | Las líneas que puedes trazar y sus campos | *Flujo de secuencia* con su condición |
| **Matriz de validez** | Qué relación vale entre qué par de tipos | En ArchiMate, *Serving* de un servicio de aplicación a un proceso de negocio |
| **Anidamiento** | Qué puede ir dentro de qué, y si al meterlo se crea una relación | Una tarea dentro de una lane; en ArchiMate, *Composition* al anidar |
| **Viewpoints** | Subconjuntos de tipos para un propósito concreto | *Contexto* y *Contenedor* en C4 |
| **Colores y categorías** | Cómo se agrupa la paleta y cómo se pinta cada tipo | Capas de ArchiMate en amarillo, azul y verde |

Cada tipo tiene un identificador `pack:Tipo` (`bpmn:Task`, `archimate:BusinessProcess`, `c4:Container`).
No lo necesitas para dibujar, pero es el nombre que usan la [API](agentes-y-api.md), los importadores y
los mensajes del panel de problemas.

Cuando creas una vista eliges su notación (botón **＋** del panel **Vistas**). La notación de la vista
decide qué tipos salen primero en la paleta y cómo se colocan los nodos. Más sobre vistas y dimensiones
en [Conceptos](conceptos.md#notaciones).

## ¿Qué notación uso para…? {#que-notacion-uso}

| Quiero dibujar… | Notación | Por qué |
|---|---|---|
| Un **proceso** de negocio: quién hace qué y en qué orden | [BPMN 2.0](notaciones/bpmn.md) | Es el estándar de procesos: tareas, decisiones, eventos y carriles por rol |
| La **arquitectura empresarial**: negocio, aplicaciones y tecnología, y cómo se sirven | [ArchiMate 3.2](notaciones/archimate.md) | Une capas y tiene una matriz de validez completa |
| La arquitectura de un **software**: sistemas, contenedores, componentes | [C4](notaciones/c4.md) | Cuatro niveles de zoom fáciles de leer para cualquiera |
| El **ciclo de vida** de algo (un pedido, una cuenta, una solicitud) | [Máquina de estados](notaciones/statechart.md) | Estados, transiciones con evento y guarda, estados compuestos |
| Las **interacciones** entre participantes a lo largo del tiempo | [Diagrama de secuencia](notaciones/sequence.md) | Líneas de vida en columnas y mensajes ordenados de arriba abajo |
| Las tablas de una **base de datos** y sus relaciones | [Entidad-relación](notaciones/er.md) | Entidades con atributos y cardinalidades de pata de gallo |
| Las **clases** de un programa | [Diagrama de clases (UML)](notaciones/uml.md) | Clases, interfaces, herencia, composición |
| Una lluvia de **ideas** o un esquema | [Mapa mental](notaciones/mindmap.md) | Idea central y ramas, con colocación automática en árbol |
| Un **algoritmo** o procedimiento paso a paso | [Diagrama de flujo](notaciones/flow.md) | Inicio, pasos, decisiones sí/no y fin |
| Por dónde viajan los **datos** de un sistema | [Flujo de datos (DFD)](notaciones/dfd.md) | Procesos, almacenes y entidades externas unidos por flujos con nombre |
| Un **tablero**, mapa de capacidades o portfolio | [Capas × etapas](notaciones/grid.md) | Una rejilla de filas (capas) por columnas (etapas) donde cabe cualquier elemento |
| **Cualquier otra cosa**, sin reglas | [Libre](notaciones/freeform.md) | Cajas, elipses, flechas: todo se une con todo |

> [!TIP]
> No tienes que elegir una sola. Lo normal es modelar lo mismo en varias notaciones (el proceso en
> ArchiMate y en BPMN, la cuenta como máquina de estados) y saltar de una a otra con
> [dimensiones](conceptos.md#dimensiones).

## Todas las notaciones {#todas}

<!-- docs:notation-index -->

- [ArchiMate 3.2](notaciones/archimate.md): arquitectura empresarial.
- [BPMN 2.0](notaciones/bpmn.md): procesos y colaboraciones.
- [Máquina de estados](notaciones/statechart.md): ciclos de vida.
- [C4](notaciones/c4.md): arquitectura de software.
- [Capas × etapas](notaciones/grid.md): tableros y mapas.
- [Libre](notaciones/freeform.md): lienzo sin reglas.
- [Diagrama de secuencia](notaciones/sequence.md): interacciones en el tiempo.
- [Entidad-relación](notaciones/er.md): bases de datos.
- [Diagrama de clases (UML)](notaciones/uml.md): diseño orientado a objetos.
- [Mapa mental](notaciones/mindmap.md): ideas.
- [Diagrama de flujo](notaciones/flow.md): algoritmos.
- [Flujo de datos (DFD)](notaciones/dfd.md): datos en movimiento.

## Mezclar notaciones en una vista {#mezclar}

Una vista tiene una notación, pero no está cerrada a ella. En la pestaña **Notación** de la paleta, bajo
los tipos de la vista, aparecen plegadas las demás notaciones con la marca *otra notación*. Arrastra
cualquiera de sus tipos al lienzo: por ejemplo, un *Application Component* de ArchiMate en una vista C4,
o una nota del lienzo libre en un BPMN.

Qué relaciones se permiten lo decide la notación **de los elementos**, no la de la vista:

- **Dos elementos de la misma notación** siguen la matriz de esa notación. Dos tareas BPMN se unen con
  *Flujo de secuencia* aunque estén en una vista ArchiMate.
- **Dos elementos de notaciones distintas** solo se pueden unir con las relaciones puente del núcleo
  (siguiente apartado).
- Si una relación no encaja en la matriz, el panel de problemas la marca como error
  (`invalid-relation`) y propone cambiarla por una válida.

Los tipos que no pertenecen al viewpoint de la vista se ofrecen atenuados al final de la paleta; si los
usas, el panel de problemas avisa (`viewpoint-violation`), pero no te lo impide. Más en
[Conceptos](conceptos.md#validez).

## Relaciones puente del núcleo {#relaciones-puente}

Estas relaciones pertenecen al **núcleo** (`core`) y están disponibles en todas las notaciones. Son las
únicas que valen entre elementos de notaciones distintas, y sirven para enlazar dimensiones entre sí
(lo que all-draw llama [trazas](conceptos.md#trazas)).

| Relación | Identificador | Línea | Para qué |
|---|---|---|---|
| **Enlace** | `core:link` | continua con flecha | Enlace genérico. Es la relación por defecto en la rejilla capas × etapas y entre pines |
| **Traza** | `core:trace` | discontinua, punta abierta | El mismo concepto modelado en dos notaciones (la pool BPMN ↔ el proceso ArchiMate) |
| **Realiza** | `core:realizes` | discontinua, triángulo | Un elemento hace realidad otro (una tarea BPMN realiza un servicio ArchiMate) |
| **Refina** | `core:refines` | punteada, punta abierta | Un elemento detalla otro (un estado refina un objeto de negocio) |
| **Flujo de datos** | `core:flow` | continua con flecha | Datos que pasan de un elemento a otro; tiene un campo **Contrato** (JSON) y es la relación típica entre [pines](conceptos.md#pines) |

El menú del nodo (botón derecho → **Trazas**) y la pestaña **Trazabilidad** del panel **Espacio** sugieren
trazas entre elementos que parecen el mismo concepto (mismo nombre, misma vista de detalle…).

## Catálogo de diagramas {#catalogo}

Además de las doce notaciones dibujables existe el pack `catalog`, un **diccionario de 162 tipos de
diagrama** con notación formal, agrupados en 10 familias: arquitectura empresarial; negocio y procesos;
UML y modelado de software; C4, arquitectura y diseño; APIs e integración; datos; cloud e
infraestructura; DevOps y operaciones; seguridad, QA y riesgo; y producto y gestión. Cada entrada trae
una descripción y, cuando existe, la notación de all-draw con la que se modela (130 de los 162 la
tienen; el resto se dibuja en el lienzo libre).

El catálogo no aporta tipos a la paleta: sirve para responder "¿con qué notación hago un *Capability Heat
Map*?" (capas × etapas) o "¿y un *Value Stream Map*?" (ArchiMate). Todavía no tiene pantalla propia en la
aplicación: la API solo anuncia el pack (`GET /api/notations`, id `catalog`) y la lista completa está en
el [código del pack](https://github.com/darwinva97/all-draw/tree/main/packages/notations/catalog).
