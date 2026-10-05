# Actividad (UML)

## Qué es y cuándo usarla {#que-es}

El diagrama de actividad de UML describe **un flujo de trabajo**: qué acciones se hacen, en qué orden,
dónde se decide entre caminos, qué partes van en paralelo y qué datos pasan de una acción a otra. Con
**particiones** (calles) muestra además quién hace cada cosa.

Úsalo para la lógica de un caso de uso, un proceso interno con pasos en paralelo o un algoritmo con
datos. Es más rico que el [diagrama de flujo](flow.md) (paralelismo, objetos, señales) y más ligero que
[BPMN](bpmn.md), que conviene cuando hay varias organizaciones o un motor de procesos.

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Acción** | Rectángulo redondeado | Un paso, con un verbo: "Validar pedido". **Llama a otra actividad** la marca como acción de llamada (icono de rastrillo); campo **Precondición local** |
| **Nodo inicial** | Círculo negro | Donde empieza el flujo. Solo tiene salidas |
| **Final de actividad** | Diana | Termina toda la actividad, aunque haya otros flujos en marcha |
| **Final de flujo** | Círculo con un aspa | Termina solo el flujo que llega; los demás siguen |
| **Decisión / fusión** | Rombo | **Papel** *Decisión* (una entrada, varias salidas con guardas) o *Fusión* (varias entradas alternativas, una salida). Campo **Entrada de decisión** |
| **Bifurcación / unión** | Barra negra | **Papel** *Bifurcación* (reparte en ramas paralelas) o *Unión* (espera a que lleguen todas). Campo **Especificación de unión** |
| **Nodo objeto** | Rectángulo con `[estado]` | Un dato que fluye entre acciones. Campos **Tipo** ("Pedido"), **Estado** ("pagado", se muestra entre corchetes) y **Colección** |
| **Enviar señal** | Pentágono en forma de flecha | Envía una señal sin esperar respuesta. Campos **Señal** y **Destinatario** |
| **Recibir señal o evento** | Rectángulo con una muesca a la izquierda | Espera una señal o un evento. **Disparador** ("Pago recibido", "cada día a las 8:00") y **Tipo de evento** (*Señal* o *Tiempo*) |
| **Partición (calle)** | Calle con el nombre en una banda lateral | El responsable (persona, rol o sistema) de las acciones que contiene |

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Flujo de control** | Continua con flecha abierta | El orden de ejecución entre acciones y nodos de control. Campos **Guarda** y **Peso** ("{weight = 2}"). Es la relación por defecto |
| **Flujo de objeto** | Continua con flecha abierta | El paso de un dato: sale de un nodo objeto o llega a uno. Campos **Guarda** y **Selección** |

La **Guarda** se escribe entre corchetes ("[aprobado]", "[else]") y el lienzo la muestra sobre la flecha.

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Actividad (UML)**. O parte de la plantilla **Actividad:
   tramitar un pedido** de la pantalla de inicio.
2. Arrastra dos **Partición (calle)**: "Cliente" y "Tienda".
3. En "Cliente", pon un **Nodo inicial** y una **Acción** "Enviar pedido". En "Tienda", una **Acción**
   "Comprobar stock", una **Decisión / fusión**, una **Acción** "Cobrar" y un **Final de actividad**.
4. Une los pasos en orden con **Flujo de control** (sale el primero).
5. En las dos salidas de la decisión, rellena **Guarda**: `[hay stock]` hacia "Cobrar" y `[sin stock]`
   hacia un **Final de flujo**.
6. Para preparar el envío y la factura a la vez, pon una **Bifurcación / unión** tras "Cobrar", dos
   acciones en paralelo y otra barra con **Papel** *Unión* antes del final.
7. Si "Cobrar" es complejo, marca **Llama a otra actividad** y detállalo en otra vista: botón derecho →
   **Nueva vista de detalle…** (ver [Conceptos](../conceptos.md#drill-down)).

## Reglas de la notación {#reglas}

- Al **Nodo inicial** no llega ningún flujo y de los **finales** no sale ninguno.
- **Flujo de objeto** si uno de los extremos es un **Nodo objeto** (el otro no puede ser el nodo
  inicial); **flujo de control** en el resto de casos. Entre dos acciones no cabe flujo de objeto: pon un
  nodo objeto en medio.
- La **Partición (calle)** no participa en ningún flujo; contiene cualquier cosa, incluidas otras
  particiones. Anidar no crea relaciones.
- No hay viewpoints.

## Importar y exportar {#importar-exportar}

- **Mermaid** (`flowchart`): la vista se exporta como diagrama de flujo de Mermaid. El fichero lleva un
  comentario que lo marca como diagrama de actividad, y al **importarlo** de nuevo vuelve como diagrama
  de actividad, no como figuras libres.
- La vista se exporta también a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Decisiones sin guarda**: rellena **Guarda** en cada flecha que sale de un rombo y haz que sean
  excluyentes; `[else]` cubre el resto.
- **Bifurcación sin unión**: si las ramas paralelas deben terminar antes de seguir, ciérralas con otra
  barra con **Papel** *Unión*; si no, cada rama acaba en su **Final de flujo**.
- **Final de actividad donde basta un final de flujo**: el final de actividad detiene también las ramas
  paralelas que sigan en marcha.
- **Usar un rombo para juntar ramas paralelas**: la fusión no espera; para esperar a todas, usa una
  **Bifurcación / unión** con papel *Unión*.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref activity -->
