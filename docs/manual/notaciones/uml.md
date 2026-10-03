# Diagrama de clases (UML)

## Qué es y cuándo usarla {#que-es}

El diagrama de clases de UML describe la **estructura de un programa orientado a objetos**: qué clases
hay, qué datos (atributos) y qué operaciones tiene cada una, y cómo se relacionan (una hereda de otra,
una contiene a otra, una usa a otra).

Úsalo para diseñar el modelo de dominio de una aplicación, documentar una librería o explicar un diseño
antes de programarlo. Si lo que te interesa son las tablas de una base de datos, el
[entidad-relación](er.md) es más directo.

## Elementos clave {#elementos-clave}

| Elemento | Qué representa |
|---|---|
| **Clase** | Una clase con tres compartimentos: nombre, **Atributos** (uno por línea: `- nombre: String`) y **Operaciones** (`+ crear(pedido: Pedido): void`). Puede ser **Abstracta** y llevar **Estereotipo** («entity», «service», «dto»…) |
| **Interfaz** | Un contrato («interface») con solo operaciones; las clases la realizan |
| **Enumeración** | Una lista cerrada de **Valores** («enumeration»): `PENDIENTE`, `ACTIVO`… |
| **Paquete** | Un espacio de nombres que contiene clases, interfaces y enumeraciones |

Los atributos de una clase son **pines**: puedes unir una asociación a un atributo concreto (ver
[pines](../conceptos.md#pines)).

## Relaciones {#relaciones}

| Relación | Dibujo | Significado |
|---|---|---|
| **Asociación** | Línea continua | Una clase conoce a otra. En cada extremo, **Multiplicidad** (`1`, `0..1`, `*`, `1..*`) y **Rol**; **Navegable** dice en qué sentido. Es la relación por defecto |
| **Agregación** | Rombo hueco en el origen | El todo (origen) agrupa partes que pueden existir solas |
| **Composición** | Rombo lleno en el origen | El todo posee las partes: si desaparece el todo, desaparecen ellas |
| **Generalización** | Triángulo hueco | Herencia: la subclase (origen) es un tipo de la superclase (destino) |
| **Realización** | Discontinua con triángulo | Una clase implementa una interfaz |
| **Dependencia** | Discontinua con flecha abierta | Una usa, importa o crea a otra (con **Estereotipo** «use», «import»…) |

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Diagrama de clases (UML)**.
2. Arrastra una **Clase** "Cliente". En el inspector, en **Atributos**, escribe `- id: UUID` y
   `- email: String`; en **Operaciones**, `+ activar(): void`.
3. Arrastra otra **Clase** "Pedido" y una **Enumeración** "EstadoPedido" con los valores `PENDIENTE`,
   `PAGADO`, `ENVIADO`.
4. Une "Cliente" con "Pedido" y elige **Asociación**; pon **Multiplicidad origen** `1` y **Multiplicidad
   destino** `0..*`.
5. Une "Pedido" con "EstadoPedido" mediante **Asociación** o **Dependencia**.
6. Añade una **Interfaz** "Notificable" y únela desde "Cliente" con **Realización**.
7. Si tienes muchas clases, agrúpalas en **Paquete** arrastrándolas dentro.

## Reglas de la notación {#reglas}

- **Generalización** solo entre elementos del mismo tipo: clase → clase o interfaz → interfaz.
- **Realización** solo de una clase a una interfaz.
- **Asociación, agregación y composición** van de una clase a otra clase o a una enumeración; de una
  clase a una interfaz solo cabe asociación. Una interfaz o una enumeración solo pueden *depender* de
  una clase.
- Los **paquetes** solo participan en dependencias.
- **Anidamiento**: un paquete contiene cualquier cosa, sin crear relación.

## Importar y exportar {#importar-exportar}

- No hay todavía importación ni exportación a formatos UML (XMI, PlantUML, Mermaid `classDiagram`).
- La vista se exporta a **SVG**, **PNG**, **draw.io** y **HTML autocontenido**; **Mermaid** la exporta como
  diagrama genérico de cajas y flechas. Ver la [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Rombo en el extremo equivocado**: en agregación y composición el origen es el **todo** (donde va el
  rombo) y el destino la parte. Si queda al revés, borra la relación y créala en el otro sentido.
- **Herencia entre una clase y una interfaz**: eso es una **Realización**, no una generalización.
- **Composición donde basta una asociación**: usa composición solo si la parte no tiene sentido sin el
  todo (las líneas de un pedido); para "un cliente tiene pedidos", asociación.
- **Todo en una clase gigante**: si una clase tiene veinte atributos, probablemente esconde otras clases.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref uml -->
