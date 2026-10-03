# Libre

## Qué es y cuándo usarla {#que-es}

El lienzo **libre** es una pizarra sin reglas: cajas, elipses, rombos, cilindros, notas y flechas, y
todo se puede unir con todo. No impone ningún significado; lo pones tú con los nombres y los colores.

Úsalo para bocetos rápidos, esquemas que no encajan en ninguna notación, diagramas de red sencillos o
cualquier tipo de diagrama del [catálogo](../notaciones.md#catalogo) que todavía no tiene notación propia
(casos de uso UML, diagramas de Gantt…). También es el tipo de respaldo de los importadores: cuando un
fichero trae una forma que no reconocen, la convierten en una figura libre.

## Elementos clave {#elementos-clave}

| Elemento | Para qué |
|---|---|
| **Caja** | Rectángulo redondeado de uso general. Tiene campo **Descripción** |
| **Elipse** | Inicio o fin, un concepto, un estado informal |
| **Rombo** | Una pregunta o decisión |
| **Cilindro** | Una base de datos o almacén |
| **Actor** | Una persona |
| **Nota** | Un comentario tipo pósit |
| **Grupo** | Un marco que contiene otros nodos (se mueven con él) |
| **Texto** | Un rótulo sin fondo ni borde |

## Relaciones {#relaciones}

| Relación | Línea |
|---|---|
| **Flecha** | Continua con punta (la relación por defecto) |
| **Línea** | Continua sin puntas |
| **Discontinua** | Discontinua con punta |
| **Bidireccional** | Continua con punta en los dos extremos |

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Libre**.
2. Arrastra unas **Caja** desde la paleta y renómbralas con **F2**.
3. Únelas arrastrando desde el borde inferior de una a otra y elige el conector en el selector (**Flecha**
   sale la primera). Puedes cambiarlo después en el inspector.
4. Para agrupar, arrastra un **Grupo** y mete los nodos dentro.
5. Cambia colores y bordes en la pestaña **Estilo** del inspector, o crea reglas que pinten según los
   datos (ver [Librerías, reglas y personas](../librerias-reglas-personas.md)).

> [!TIP]
> En el lienzo libre también puedes arrastrar tipos de otras notaciones (pestaña **Notación**, apartados
> *otra notación*) y tipos de tus librerías. Así un boceto puede ir ganando significado poco a poco.

## Reglas de la notación {#reglas}

- **Sin matriz de validez**: cualquier figura libre se une con cualquier otra con cualquiera de los cuatro
  conectores.
- Con elementos de **otra notación** (una tarea BPMN, un servicio ArchiMate) solo valen las
  [relaciones puente](../notaciones.md#relaciones-puente) del núcleo, como en cualquier vista.
- Solo el **Grupo** es contenedor; meter algo dentro no crea ninguna relación.

## Importar y exportar {#importar-exportar}

- **Mermaid** (`flowchart`/`graph`): al importar, los nodos y aristas se convierten en figuras y conectores
  libres; al exportar, cada forma se traduce a su equivalente de Mermaid.
- **draw.io**, **SVG**, **PNG** y **HTML autocontenido**: exportan la vista tal cual.
- Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Usar el lienzo libre para algo que tiene notación**: si estás dibujando un proceso, un modelo de
  datos o una arquitectura, la notación propia te dará validación, exportación a formatos estándar y
  layout automático adecuado.
- **Dibujar dos veces la misma cosa**: si el elemento ya existe en otra vista, arrástralo desde la pestaña
  **Modelo** en vez de crear una caja nueva con el mismo nombre.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref freeform -->
