# 4. Notaciones

Cada notación es un **pack de datos**: tipos de elemento, tipos de relación, matriz de validez
(qué relación vale entre qué tipos), viewpoints, reglas de anidamiento y colores. Los ids de tipo
son `pack:Tipo` (`bpmn:Task`, `archimate:BusinessProcess`) y son los que usan la API y los
importadores. En cualquier vista puedes mezclar tipos de otras notaciones (paleta → "otra
notación"); la matriz de la notación de la vista decide qué relaciones son válidas y el validador
avisa del resto.

Relaciones del **núcleo**, disponibles en todas las notaciones y pensadas para unir dimensiones:

| Relación | Uso |
|---|---|
| `core:link` | Enlace genérico (la relación por defecto en la rejilla y entre pines) |
| `core:trace` | El mismo concepto modelado en dos notaciones (pool BPMN ↔ proceso ArchiMate) |
| `core:realizes` | Un elemento realiza otro (tarea BPMN → servicio ArchiMate) |
| `core:refines` | Un elemento detalla otro (estado → objeto de negocio) |
| `core:flow` | Flujo de datos con un campo `contract` (json) |

## ArchiMate 3.2 (`archimate`)

Arquitectura empresarial según The Open Group. El pack se genera desde los ficheros de Archi:
61 elementos (60 de la especificación más *Junction*) en las capas estrategia, negocio,
aplicación, tecnología, físico, motivación, implementación/migración y compuestos; 11 relaciones
(Composition, Aggregation, Assignment, Realization, Serving, Access, Influence, Triggering, Flow,
Specialization, Association) con la **matriz de validez completa** de Archi (62×62); 25 viewpoints
(Organization, Business Process Cooperation, Application Cooperation, Layered, Capability Map,
Motivation, Implementation and Migration…).

- Anidar un elemento dentro de otro crea la relación de anidamiento (Composition por defecto;
  Aggregation, Assignment, Realization, Specialization o Access si la matriz lo permite).
  *Grouping* y *Location* aceptan cualquier hijo.
- Ejemplo: `BusinessRole` —Assignment→ `BusinessProcess` "Alta de cliente";
  `ApplicationService` —Serving→ ese proceso; `ApplicationComponent` "CRM" —Realization→ el servicio.
- Importa y exporta `.archimate` (Archi) y Open Exchange.

## BPMN 2.0 (`bpmn`)

Procesos, colaboraciones, coreografías y conversaciones: 36 tipos (pool, participante colapsado,
lane, tarea, 4 clases de subproceso, actividad de llamada, eventos de inicio/intermedio/fin/borde,
compuertas, objetos y almacenes de datos, anotaciones, grupos, coreografía, conversación) y
6 relaciones (`SequenceFlow`, `MessageFlow`, `Association`, `DataInputAssociation`,
`DataOutputAssociation`, `ConversationLink`). Viewpoints *Colaboración*, *Proceso* (sin pools ni
mensajes) y *Coreografía*.

- El tipo de tarea es un campo (`taskType`: user, service, script, manual, businessRule, send,
  receive) que cambia el icono; los eventos llevan `eventDefinition`; el evento de borde,
  `attachedTo` e `interrupting`; los flujos, `condition` y `default`.
- Reglas propias del editor: `SequenceFlow` solo dentro del mismo pool, `MessageFlow` solo entre
  pools distintos, una única salida por defecto por compuerta. Más las 10 reglas de bpmnlint en
  el panel de problemas.
- Ejemplo (demo): pool "Banco" con lanes "Gestor" y "Sistemas"; `StartEvent` → `Task` "Recoger
  datos" → `Task` "Verificar identidad" → `ExclusiveGateway` "¿Verificado?" → "Crear cuenta" →
  `EndEvent` "Cliente activo", y rama a "Rechazado".
- Importa y exporta BPMN 2.0 XML con DI.

![Vista BPMN de la demo](img/04-bpmn-detalle.png)

## Máquina de estados (`statechart`)

Estados jerárquicos al estilo UML/XState: `State`, `Initial`, `Final`, `Choice`, `Fork`, `Join`,
`History` (`deep`), `Parallel`, `Terminate`, y la relación `Transition` con `event`, `guard`,
`actions`, `delay` e `internal`. `State` y `Parallel` son contenedores (estados compuestos y
regiones paralelas). Los estados llevan `entry`, `exit` y `activities`.

- Ejemplo (demo): `Initial` → "Pendiente" → "En verificación" → "Activo" o "Rechazado" → `Final`,
  con el evento y la guarda de cada transición en la arista.
- Importa y exporta XState JSON y Mermaid `stateDiagram-v2`.

![Máquina de estados de la demo](img/06-estados.png)

## C4 (`c4`)

Los cuatro niveles de Simon Brown más despliegue: `Person`, `SoftwareSystem`, `Container`,
`Component`, `Code`, `DeploymentNode`, `Boundary`; relaciones `Relationship` y `Uses`. Viewpoints
*Contexto*, *Contenedor*, *Componente*, *Código*, *Despliegue*. Anidamiento sistema ⊃ contenedor ⊃
componente ⊃ código; `DeploymentNode` contiene nodos y contenedores; `Boundary` cualquier cosa.
Campos: `external` (se pinta en gris), `technology`, `Container.kind` (app, database, queue…),
`DeploymentNode.instances`.

- Ejemplo (demo): `Container` "Portal del gestor", "API de clientes" y "Base de datos" dentro del
  `SoftwareSystem` "CRM", que usa el sistema externo "Proveedor KYC".
- Importa y exporta Structurizr JSON.

## Capas × etapas (`grid`)

No tiene tipos propios: es una **clase de vista** en la que cualquier elemento de cualquier
notación se coloca en una celda (capa × etapa). Capas = filas (Negocio, Aplicación, Tecnología por
defecto), etapas = columnas, grupos de etapas = banda superior. Relación por defecto `core:link`.
Es la vista de los tableros, mapas de capacidades, portfolios y del formato `.drawer`.

![Rejilla capas × etapas de la demo](img/07-rejilla-pines.png)

## Libre (`freeform`)

Lienzo sin reglas: `box`, `ellipse`, `diamond`, `cylinder`, `note`, `group` (contenedor) y más;
relaciones `arrow`, `line`, `dashed`, `bidirectional`. Todo se puede unir con todo. Es el tipo de
respaldo de los importadores cuando no reconocen un tipo.

## Diagrama de secuencia (`sequence`)

`Lifeline` (`kind`: actor, boundary, control, entity…), `Activation` (anidable en la línea de
vida), `Fragment` (`kind`: alt, opt, loop, par…, con `condition`) y `Note`; mensajes `Message`
(`kind`: sync, async, create, destroy; `order` fija el orden vertical) y `Return`. Hoy se dibuja
sobre el lienzo libre (el lienzo propio de secuencia está pendiente).

## Entidad-relación (`er`)

`Entity` (con `attributes` como pares clave/valor que se convierten en **pines**, `pk`, `weak`),
`Attribute` y `View`; relaciones `OneToOne`, `OneToMany`, `ManyToMany`, `Has`, `Inherits` con
cardinalidades, `identifying` y `onDelete`. Viewpoints conceptual, lógico y físico. Unir atributo
con atributo modela una clave foránea.

## Diagrama de clases UML (`uml`)

`Class` (`stereotype`, `abstract`, `attributes`, `operations`), `Interface`, `Enum` (`values`),
`Package` (contenedor); relaciones `Association` (roles y multiplicidades en cada extremo,
`navigable`), `Aggregation`, `Composition`, `Generalization` (solo entre el mismo tipo),
`Realization` (clase → interfaz), `Dependency`.

## Mapa mental (`mindmap`)

`Root`, `Topic` (`priority`), `Subtopic`; relación `Branch`, siempre hacia fuera (nada apunta a
la raíz). Layout automático en árbol.

## Diagrama de flujo (`flow`)

ISO 5807: `Start`, `End`, `Process`, `Decision`, `IO`, `Subroutine`, `Document`, `Database`,
`Connector`; relación `Arrow` con `label` (sí/no). `End` nunca es origen y `Start` nunca destino.
Importa y exporta Mermaid `flowchart`.

## Flujo de datos, DFD (`dfd`)

Yourdon / Gane-Sarson: `Process` (`number` "1.2"), `DataStore`, `External`; relación `Flow` con el
campo obligatorio `data`. Todo flujo toca un proceso. Los niveles se hacen con vistas de detalle.

## Catálogo de diagramas (`catalog`)

No es una notación dibujable: es un diccionario de 162 tipos de diagrama con notación formal,
agrupados en 10 familias (arquitectura empresarial, negocio y procesos, UML, datos…), cada uno
con su descripción y, cuando existe, la notación de all-draw que lo cubre. Sirve para elegir qué
vista crear.
