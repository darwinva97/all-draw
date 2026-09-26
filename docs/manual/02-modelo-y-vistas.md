# 2. Modelo y vistas

## Un elemento, muchas apariciones

En la mayoría de diagramadores, una caja *es* el elemento: si la dibujas dos veces tienes dos
cosas. En all-draw hay dos niveles:

| Nivel | Qué contiene | Ejemplo |
|---|---|---|
| **Modelo** | `Element` (tipo, nombre, documentación, campos, pines, etiquetas) y `Relation` (tipo, origen, destino) | El proceso "Alta de cliente" de tipo `archimate:BusinessProcess`; la relación `Serving` de "CRM" a ese proceso |
| **Vistas** | `ViewNode` (aparición de un elemento en una vista: posición, tamaño, padre, estilo) y `ViewEdge` (dibujo de una relación en una vista: puntos de quiebre, estilo) | El mismo proceso dibujado en la vista ArchiMate y en la rejilla capas × etapas |

Consecuencias prácticas:

- Renombrar el elemento en una vista lo renombra en todas.
- **Supr** sobre un nodo (o botón derecho → *Quitar de esta vista*) *quita la aparición* de esa
  vista; el elemento sigue en el modelo. Para borrarlo de verdad, botón derecho → *Borrar del
  modelo* (lo quita de todas las vistas). Los elementos que no aparecen en ninguna vista salen en
  el panel de problemas como aviso `element-unused`, con el arreglo de borrarlos.
- Una relación puede dibujarse en varias vistas con puntos de quiebre distintos.
- La pestaña **Modelo** de la paleta lista todos los elementos existentes: arrástralos al lienzo
  para que aparezcan también en la vista actual.
- El panel **Vistas** muestra abajo el recuento del modelo (elementos y relaciones).

## Vistas y notaciones

Cada vista tiene una **notación** (`notationId`) que decide qué paleta se ofrece, qué relaciones
son válidas entre qué tipos (la matriz de validez de la notación) y cómo se pintan los nodos.
Opcionalmente tiene un **viewpoint**, que atenúa en la paleta los tipos que no le corresponden sin
prohibirlos (por ejemplo *Layered* o *Business Process Cooperation* en ArchiMate; *Contexto* o
*Contenedores* en C4).

Hay dos clases de vista (`kind`):

- **Libre** (`freeform`): lienzo con nodos, contenedores y aristas. Es la de todas las notaciones
  salvo la rejilla.
- **Rejilla** (`grid`): la notación *Capas × etapas*. Cada nodo vive en una celda (capa, etapa);
  las capas son filas y las etapas columnas, y se pueden agrupar etapas en bandas. Se editan en el
  inspector de la vista (pestañas *Capas* y *Etapas*).

Para crear una vista: **＋** en el panel Vistas (elige la notación) o **Ctrl+K** → "Crear vista …".
Las vistas se agrupan por notación en el panel; el color del punto es el de la notación.

Cada vista tiene en el inspector (clic en el fondo del lienzo): nombre, descripción, viewpoint y
**elemento raíz**.

## Dimensiones

Una **dimensión** es un eje por el que se navega desde cualquier nodo: "ver este concepto en
BPMN", "verlo en ArchiMate", "verlo como máquina de estados". Es simplemente `{nombre, notación,
viewpoint opcional}`. La demo trae cinco.

Se gestionan en el panel **Vistas → Dimensiones** (desplegable *＋ añadir dimensión…*, que ofrece
cada notación completa o uno de sus viewpoints). Sin dimensiones, el menú "Abrir en otra dimensión"
no ofrece nada.

## Drill-down y "Abrir en otra dimensión"

Botón derecho sobre un nodo:

![Menú del nodo: abrir en otra dimensión, aparece en, trazas](img/05-menu-dimension.png)

- **Abrir en otra dimensión**: una entrada por dimensión. Si el elemento ya es raíz de una vista
  de esa notación, la abre; si no, marca `(crear)` y crea una vista nueva de esa notación con ese
  elemento como raíz.
- **Nueva vista de detalle…**: crea una vista cuya raíz es el elemento y la enlaza como
  `detailViewId` del nodo. A partir de ahí, **doble clic** en el nodo entra en ella. En la demo, el
  proceso ArchiMate "Alta de cliente" tiene como detalle la vista BPMN.
- **Aparece en**: todas las vistas donde el elemento tiene un nodo; clic para ir.
- **Trazas**: sugerencias de relaciones puente (`core:trace`, `core:realizes`, `core:refines`) con
  elementos de otras notaciones que parecen el mismo concepto (mismo nombre, misma vista de detalle…).

También se puede elegir a mano en el inspector del nodo (*Vista al hacer doble clic*). Al entrar, la barra muestra la **ruta de vistas** (breadcrumb) y el
botón **←** para volver.

![Vista BPMN abierta desde el proceso ArchiMate; ruta en la barra](img/04-bpmn-detalle.png)

## "Dónde" en el inspector

Con un nodo seleccionado, la pestaña **Dónde** del inspector lista *Aparece en* (vistas con ese
elemento) y las relaciones del elemento con el resto del modelo, aunque no estén dibujadas en la
vista actual. Es la forma más rápida de comprobar que un concepto está bien enlazado entre
dimensiones.

## Elementos raíz y vistas de detalle en la práctica

Un patrón habitual:

1. Modela la arquitectura en ArchiMate (procesos, servicios, componentes).
2. Para cada proceso que quieras detallar: botón derecho → *Abrir en otra dimensión → Proceso
   (BPMN) (crear)*. Ese proceso pasa a ser el elemento raíz de la vista BPMN.
3. Dentro del BPMN, para la tarea que cambia de estado un objeto: *Abrir en otra dimensión →
   Estados*.
4. Con el validador *cobertura de trazas* (panel de problemas) ves qué elementos de una notación
   no tienen traza a ninguna otra.
