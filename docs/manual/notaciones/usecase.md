# Casos de uso (UML)

## Qué es y cuándo usarla {#que-es}

El diagrama de casos de uso de UML muestra **qué hace un sistema y para quién**: los **actores** (personas,
otros sistemas o el paso del tiempo) que interactúan con él y los **casos de uso**, los objetivos que cada
actor consigue ("Realizar pedido", "Consultar envío"). No explica cómo se hace cada cosa, solo qué se
ofrece y a quién.

Úsalo al principio de un proyecto para acordar el alcance, para repartir funcionalidades entre equipos o
para explicar un producto a alguien que no es técnico. Para contar paso a paso cómo transcurre un caso de
uso, sigue con un [diagrama de secuencia](sequence.md) o uno de [actividad](activity.md).

## Elementos clave {#elementos-clave}

| Elemento | Forma | Qué representa |
|---|---|---|
| **Actor** | Monigote | Un rol que interactúa con el sistema, siempre **fuera** del límite. **Tipo de actor**: *Persona*, *Sistema externo* o *Tiempo (temporizador)*; **Estereotipo** opcional («system», «device»…) |
| **Caso de uso** | Elipse | Un objetivo del actor, con un verbo: "Pagar el pedido". Campos **Puntos de extensión** (uno por línea), **Precondición** y **Postcondición** |
| **Sistema (límite)** | Rectángulo con el nombre arriba | El sistema que se describe (el *subject*). Contiene los casos de uso |
| **Paquete** | Carpeta con pestaña | Agrupa casos de uso, actores u otros paquetes |

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Asociación** | Línea continua sin flecha | El actor participa en el caso de uso. Es la relación por defecto |
| **Inclusión** | Discontinua con flecha abierta, rotulada «include» | El caso base (origen) **siempre** incluye el comportamiento del incluido (destino) |
| **Extensión** | Discontinua con flecha abierta, rotulada «extend» | El caso que extiende (origen) añade comportamiento **opcional** al caso base (destino). Campos **Punto de extensión** y **Condición** ("[cupón válido]") |
| **Generalización** | Continua con triángulo hueco | Un actor o caso de uso (origen) es una especialización de otro (destino) |
| **Dependencia** | Discontinua con flecha abierta | Un paquete usa o importa otro, con **Estereotipo** («import», «access»…) |

No hace falta escribir «include» ni «extend»: el lienzo pinta la palabra clave sobre la línea a partir del
tipo de relación. En la extensión, además, muestra el punto de extensión y la condición que rellenes.

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Casos de uso (UML)**. O parte de la plantilla
   **Casos de uso: tienda online** de la pantalla de inicio.
2. Arrastra un **Sistema (límite)** "Tienda online" y hazlo grande: será el marco de los casos de uso.
3. Arrastra **dentro** del sistema tres **Caso de uso**: "Realizar pedido", "Iniciar sesión" y "Aplicar
   cupón". En "Realizar pedido", escribe en **Puntos de extensión** `pago`.
4. Fuera del límite, añade un **Actor** "Cliente" (*Persona*) y otro "Pasarela de pago" (*Sistema
   externo*).
5. Une "Cliente" con "Realizar pedido" con **Asociación** (sale la primera); haz lo mismo entre "Realizar
   pedido" y "Pasarela de pago".
6. Une "Realizar pedido" → "Iniciar sesión" y elige **Inclusión**.
7. Une "Aplicar cupón" → "Realizar pedido" y elige **Extensión**; en el inspector pon **Punto de
   extensión** `pago` y **Condición** `[tiene cupón]`.

## Reglas de la notación {#reglas}

- **Asociación** solo entre un actor y un caso de uso (en cualquier sentido).
- **Inclusión** y **extensión** solo entre casos de uso.
- **Generalización** solo entre elementos del mismo tipo: actor → actor o caso de uso → caso de uso.
- **Dependencia** solo entre paquetes. El **Sistema (límite)** no participa en ninguna relación.
- **Anidamiento**: el límite del sistema contiene solo casos de uso (los actores quedan fuera); un paquete
  contiene cualquier cosa. Anidar no crea relaciones.
- No hay viewpoints.

## Importar y exportar {#importar-exportar}

- **Mermaid** (`flowchart`): exporta los actores como cajas y los casos de uso con forma de estadio. Un
  `flowchart` exportado así desde all-draw vuelve a importarse como diagrama de casos de uso.
- La vista se exporta también a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Flecha de «extend» al revés**: va del caso que **extiende** (el opcional) al caso **base**. La de
  «include», al contrario: del base al incluido.
- **Actores dentro del límite**: el actor es siempre externo al sistema; si algo está dentro, es parte del
  sistema y no un actor.
- **Casos de uso que son pasos**: "Pulsar el botón Pagar" no es un objetivo; "Pagar el pedido", sí.
- **Usar «include» para ordenar pasos**: el diagrama no tiene secuencia; para el orden, usa un diagrama de
  [actividad](activity.md) o de [secuencia](sequence.md).

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref usecase -->
