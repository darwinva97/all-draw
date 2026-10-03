# Diagrama de secuencia

## Qué es y cuándo usarla {#que-es}

Un diagrama de secuencia muestra **quién habla con quién y en qué orden**. Cada participante es una
columna (su *línea de vida*) y los mensajes son flechas horizontales que se leen de arriba abajo, como
una conversación en el tiempo.

Úsalo para explicar cómo funciona una operación concreta entre varios sistemas ("¿qué pasa cuando el
cliente envía el formulario?"), para diseñar una API o para documentar una integración. Sigue UML 2.

Las vistas de secuencia tienen **lienzo propio**: las líneas de vida se alinean solas en columnas y los
mensajes se colocan en vertical según su orden.

## Elementos clave {#elementos-clave}

| Elemento | Qué representa |
|---|---|
| **Línea de vida** | Un participante: persona, sistema, componente u objeto. El campo **Clase** (`kind`) elige el icono de la cabecera: actor, boundary (interfaz), control, entity, database o participant. **Tipo** indica de qué clase es ("pedido: Pedido") |
| **Activación** | La franja estrecha sobre una línea de vida mientras ese participante está trabajando. Se mete dentro de su línea de vida |
| **Fragmento** | Un marco que agrupa mensajes con un **Operador**: `alt` (alternativas), `opt` (opcional), `loop` (repetición), `par` (en paralelo), `break`, `critical` o `ref` (referencia a otro diagrama), con su **Condición** ("[no existe el email]") |
| **Nota** | Un comentario sobre una línea de vida o un mensaje |

## Relaciones {#relaciones}

| Relación | Línea | Para qué |
|---|---|---|
| **Mensaje** | Continua con flecha | Una llamada. **Clase** (`kind`): *sync* (punta llena, espera respuesta), *async* (punta abierta), *return*, *create* (crea al participante), *destroy* (lo termina). **Orden** fija la posición y **Texto** es lo que se envía ("POST /clientes") |
| **Respuesta** (`sequence:Return`) | Discontinua, punta abierta | La respuesta a un mensaje. Equivale a un mensaje de clase *return* |

## Cómo empezar {#como-empezar}

Así se construye la vista *Alta de cliente · Secuencia* de la demo:

1. En el panel **Vistas**, pulsa **＋** y elige **Diagrama de secuencia**.
2. Arrastra cuatro **Línea de vida**: "Cliente" (Clase *actor*), "Portal" (*boundary*), "API de clientes"
   (*control*) y "Base de datos" (*database*). Se colocan en columnas; arrástralas a izquierda o derecha
   para cambiar el orden.
3. Arrastra de la línea "Cliente" a la línea "Portal": se crea un **Mensaje**. Escribe su texto,
   "rellena el formulario".
4. Sigue con "Portal" → "API de clientes" ("POST /clientes") y "API de clientes" → "Base de datos"
   ("buscar por email").
5. Añade la respuesta de la base de datos a la API como **Respuesta** ("ninguno"): cambia el tipo de la
   relación en el inspector.
6. Para cambiar el orden de un mensaje, **arrastra su etiqueta** hacia arriba o hacia abajo.
7. Mete una **Activación** dentro de "API de clientes" para mostrar cuándo trabaja, y un **Fragmento**
   `alt` con la condición "[no existe el email]" alrededor de los mensajes que solo pasan en ese caso.

> [!TIP]
> Para un mensaje de un participante a sí mismo, arrastra desde su línea de vida y suelta en el
> manejador de su propia cabecera.

## Reglas de la notación {#reglas}

- Los mensajes solo unen **líneas de vida o activaciones**. Las notas y los fragmentos no envían ni
  reciben mensajes (una nota se ancla con un **Enlace** del núcleo).
- Una **Activación** va dentro de una línea de vida (o de otra activación); un **Fragmento** puede
  contener cualquier cosa. Anidar no crea relaciones.
- La posición vertical sale del orden de los mensajes; si dos tienen el mismo orden, va primero el que se
  creó antes.

## Importar y exportar {#importar-exportar}

- No hay todavía un formato estándar de secuencia (Mermaid `sequenceDiagram`, PlantUML) ni para importar
  ni para exportar.
- La vista se exporta a **SVG**, **PNG** y **HTML autocontenido** como imagen; **Mermaid** y **draw.io**
  la exportan como un diagrama genérico de cajas y flechas.
- Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Mensajes que no se ven donde esperas**: la altura la manda el **Orden**. Arrastra la etiqueta para
  recolocarlo.
- **Poner la respuesta como mensaje normal**: usa **Respuesta** (o la clase *return*) para que se dibuje
  discontinua y se lea como respuesta.
- **Demasiados participantes**: más de seis o siete columnas cuesta leer. Divide en varios diagramas y
  usa un fragmento `ref` para referirte a ellos.
- **Duplicar participantes que ya existen**: la línea de vida "API de clientes" puede enlazarse con el
  contenedor C4 del mismo nombre mediante una traza (`core:trace`), como en la demo.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref sequence -->
