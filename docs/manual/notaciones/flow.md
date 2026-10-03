# Diagrama de flujo

## Qué es y cuándo usarla {#que-es}

El diagrama de flujo clásico (norma ISO 5807) dibuja un **procedimiento paso a paso**: dónde empieza,
qué se hace, qué preguntas se responden (sí/no) y dónde acaba. Es el diagrama que casi todo el mundo
sabe leer.

Úsalo para algoritmos, instrucciones, procedimientos internos sencillos o la lógica de una función. Si
en el proceso intervienen varios roles, hay mensajes entre organizaciones o quieres ejecutarlo en un
motor de procesos, usa [BPMN](bpmn.md).

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Inicio** | Rectángulo redondeado verde | Dónde empieza. Solo puede ser origen |
| **Fin** | Rectángulo redondeado rojo | Dónde termina. Solo puede ser destino |
| **Proceso** | Rectángulo | Un paso o acción: "Calcular el total" |
| **Decisión** | Rombo | Una pregunta con varias salidas. Campo **Pregunta** |
| **Entrada/Salida** | Paralelogramo | Leer o mostrar datos: "Pedir el email" |
| **Documento** | Hoja | Un documento o informe que se produce o se consulta |
| **Base de datos** | Cilindro | Un almacén de datos |
| **Subrutina** | Rectángulo con doble borde lateral | Un proceso predefinido que se detalla aparte |
| **Conector** | Círculo pequeño | Une dos tramos lejanos sin cruzar flechas por todo el dibujo; los dos conectores comparten **Referencia** ("A") |

## Relaciones {#relaciones}

Una sola: la **Flecha**, con un campo **Etiqueta** para las salidas de una decisión ("sí", "no", "> 100").

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Diagrama de flujo**.
2. Arrastra un **Inicio**, una **Entrada/Salida** "Pedir el email", una **Decisión** "¿Email válido?", un
   **Proceso** "Crear la cuenta" y un **Fin**.
3. Une cada paso con el siguiente y elige **Flecha** en el selector (sale la primera).
4. Une la decisión con "Crear la cuenta" y pon **Etiqueta** "sí"; añade otra flecha de la decisión de
   vuelta a "Pedir el email" con etiqueta "no".
5. Si un paso es complejo, usa una **Subrutina** y detállalo en otra vista: botón derecho → **Nueva vista
   de detalle…** (ver [Conceptos](../conceptos.md#drill-down)).

## Reglas de la notación {#reglas}

- Todo puede unirse con todo con una **Flecha**, con dos excepciones: del **Fin** no sale nada y al
  **Inicio** no llega nada.
- No hay anidamiento ni viewpoints.

## Importar y exportar {#importar-exportar}

- **Mermaid** (`flowchart`): exporta cada paso con su forma de Mermaid y las flechas con su etiqueta.
  Al **importar** un `flowchart` de Mermaid, los nodos llegan como figuras del lienzo
  [libre](freeform.md), no como tipos de diagrama de flujo.
- La vista se exporta también a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Decisiones sin etiqueta en las salidas**: rellena **Etiqueta** en cada flecha que sale de un rombo.
- **Varios finales sueltos**: está permitido, pero si todos significan lo mismo, une las ramas a un solo
  **Fin**.
- **Flechas que se cruzan por todo el diagrama**: usa un par de **Conector** con la misma referencia.
- **Usar Proceso para leer o mostrar datos**: para eso está **Entrada/Salida**; ayuda a ver de un vistazo
  dónde interviene el usuario.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref flow -->
