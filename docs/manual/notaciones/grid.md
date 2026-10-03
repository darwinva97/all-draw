# Capas × etapas

## Qué es y cuándo usarla {#que-es}

*Capas × etapas* no es una notación con tipos propios: es una **rejilla** en la que colocas elementos de
cualquier notación. Las **capas** son las filas (por defecto *Negocio*, *Aplicación* y *Tecnología*) y
las **etapas** son las columnas (pasos de un recorrido, fases de un proyecto, trimestres…). Cada nodo vive
en una **celda**, el cruce de una capa con una etapa.

Úsala para tableros y mapas: un recorrido de cliente con lo que pasa en cada capa, un mapa de
capacidades, un portfolio de aplicaciones por área, una hoja de ruta por trimestres. Es también el
formato en el que llegan los diagramas importados de Drawer.

![Rejilla capas × etapas de la demo, con pines visibles en dos microservicios](../img/07-rejilla-pines.png)

## Elementos clave {#elementos-clave}

La rejilla no tiene paleta propia: en la pestaña **Notación** de la paleta salen las demás notaciones
como *otra notación*, y en las pestañas **Librerías** y **Modelo** tus tipos y tus elementos existentes.
Lo propio de esta vista es su estructura:

| Pieza | Qué es | Dónde se edita |
|---|---|---|
| **Capa** | Una fila con nombre, color y alto | Inspector de la vista, sección **Capas** (clic en el fondo del lienzo) |
| **Etapa** | Una columna con nombre y ancho | Inspector de la vista, sección **Etapas** |
| **Grupo de etapas** | Una banda superior que agrupa varias etapas seguidas ("Fase 1") | Llega al importar un `.drawer` o se define por la API |
| **Celda** | El cruce capa × etapa; contiene los nodos | Arrastra un nodo a otra celda para moverlo |

Cualquier elemento cabe en una celda: un proceso ArchiMate, un contenedor C4, un tipo de una librería
propia (como los *Microservicio* de la demo, con sus pines).

## Relaciones {#relaciones}

La relación por defecto es **Enlace** (`core:link`). Entre pines se usa normalmente **Flujo de datos**
(`core:flow`), que además guarda qué campo va a qué campo. Entre dos elementos de la misma notación
también valen las relaciones de esa notación (por ejemplo, *Serving* entre dos elementos ArchiMate).
Ver [relaciones puente](../notaciones.md#relaciones-puente).

## Cómo empezar {#como-empezar}

Así se construye la vista *Mapa capas × etapas* de la demo:

1. En el panel **Vistas**, pulsa **＋** y elige **Capas × etapas**.
2. Haz clic en el fondo del lienzo. En el inspector, renombra las capas (*Negocio*, *Aplicación*,
   *Tecnología*) y las etapas: "Captación", "Alta", "Operación". Quita la que sobre con **×** y añade más
   con **＋ etapa** o **＋ capa**.
3. Desde la pestaña **Modelo** de la paleta, arrastra elementos que ya existen: el proceso "Alta de
   cliente" a *Negocio × Alta*, el "CRM" a *Aplicación × Alta*, el "Clúster Kubernetes" a
   *Tecnología × Alta*.
4. Añade elementos nuevos desde la paleta (cualquier notación) o desde una librería.
5. Conecta dos nodos y elige **Enlace** en el selector (sale el primero). Para unir valores concretos, muestra los pines en la
   pestaña **Pines** del inspector y arrastra de pin a pin (ver [pines](../conceptos.md#pines)).

## Reglas de la notación {#reglas}

- **Un nodo, una celda**: cada nodo pertenece a una capa y una etapa; al arrastrarlo cambia de celda.
- **Borrar una capa o etapa no borra sus nodos**: quedan fuera de la rejilla hasta que los muevas a otra
  celda.
- No hay matriz propia: las relaciones permitidas dependen de las notaciones de los elementos que unes.
- El **layout automático** coloca los nodos dentro de su celda, sin cambiarlos de celda.

## Importar y exportar {#importar-exportar}

- **Drawer** (`.drawer`): cada diagrama de Drawer se convierte en una vista de capas × etapas, con capas,
  etapas, grupos, colores, pines y mapeos. Ver [Importar y exportar](../importar-exportar.md#drawer).
- **draw.io** y **Mermaid**: exportan las celdas como contenedores (en Mermaid, un `subgraph` por capa).
- **SVG**, **PNG** y **HTML autocontenido** dibujan la rejilla tal cual.
- ArchiMate, BPMN y Structurizr no tienen rejilla: al exportar a ellos, estas vistas se omiten con
  aviso. Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Nodos "perdidos" tras borrar una etapa**: están fuera de la rejilla. Arrástralos a una celda.
- **Crear un elemento nuevo cuando ya existe**: si el proceso ya está en otra vista, tráelo desde la
  pestaña **Modelo**; así es el mismo elemento y no un duplicado.
- **Pines que no aparecen**: los pines se muestran por nodo. Actívalos en la pestaña **Pines** del
  inspector.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref grid -->
