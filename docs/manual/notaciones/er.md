# Entidad-relación

## Qué es y cuándo usarla {#que-es}

El diagrama entidad-relación describe **qué datos guarda un sistema y cómo se relacionan**: las
*entidades* (clientes, pedidos, productos), sus *atributos* (nombre, email, fecha) y las *relaciones*
entre ellas (un cliente hace muchos pedidos).

Úsalo para diseñar o documentar una base de datos, acordar un modelo de datos con negocio o explicar
una integración. Sirve para los tres niveles habituales: **conceptual** (solo entidades y relaciones),
**lógico** (con atributos tipados) y **físico** (tablas y vistas reales). Las relaciones se dibujan con
la notación de **pata de gallo** (*Information Engineering*), la más extendida.

## Elementos clave {#elementos-clave}

| Elemento | Qué representa |
|---|---|
| **Entidad** | Una tabla o concepto de datos. Su campo **Atributos** es una lista de pares *Atributo / Tipo* (`id / uuid`, `email / text`). **Clave primaria** dice qué atributos la forman; **Entidad débil** (doble borde) indica que depende de otra para identificarse; **Tabla física** es su nombre real en la base de datos |
| **Atributo** | Un atributo suelto, dibujado como óvalo (estilo Chen). Tiene **Tipo**, **Clave** (pk, fk, unique) y **Nulo** |
| **Vista** | Una vista de base de datos: una consulta sobre otras entidades. Puede ser **Materializada** |

Cada atributo de una entidad es además un **pin**: un punto de conexión propio al que se puede unir una
relación. Así una relación puede ir del atributo `cliente_id` de *Pedido* al atributo `id` de *Cliente*
(una clave foránea). Ver [pines](../conceptos.md#pines).

## Relaciones {#relaciones}

| Relación | Extremos por defecto | Para qué |
|---|---|---|
| **Uno a uno** | Uno y solo uno ↔ uno y solo uno | Cada cliente tiene una ficha fiscal |
| **Uno a muchos** | Uno y solo uno → uno o muchos | Un cliente hace muchos pedidos. Es la relación por defecto |
| **Muchos a muchos** | Uno o muchos ↔ uno o muchos | Pedidos y productos (en físico se resuelve con una tabla intermedia) |
| **Hereda** | Triángulo | Un subtipo de otra entidad, con **Estrategia** (una tabla, unidas, tabla por clase) |
| **Tiene** | Línea simple | Entidad → atributo suelto, y vista → entidad en la que se apoya |

Cada extremo se puede ajustar con **Cardinalidad origen** y **Cardinalidad destino**: `1` (barra),
`1..1` (doble barra), `0..1` (círculo y barra), `*` (pata de gallo), `1..*` (barra y pata), `0..*`
(círculo y pata). También tienen **Identificativa** (la clave del hijo incluye la del padre) y **Al
borrar** (*no action*, *cascade*, *set null*, *restrict*).

## Cómo empezar {#como-empezar}

1. En el panel **Vistas**, pulsa **＋** y elige **Entidad-relación**. En el inspector de la vista puedes
   elegir el viewpoint *Conceptual*, *Lógico* o *Físico*.
2. Arrastra dos **Entidad**: "Cliente" y "Pedido".
3. En el inspector de "Cliente", en **Atributos**, añade `id / uuid`, `email / text`, `nombre / text`; en
   **Clave primaria**, `id`.
4. En "Pedido", añade `id / uuid`, `cliente_id / uuid`, `fecha / date`.
5. Une "Cliente" con "Pedido" y elige **Uno a muchos** en el selector (sale la primera). Si un cliente puede no tener pedidos, cambia la
   **Cardinalidad destino** a `0..*`.
6. Para modelar la clave foránea campo a campo, muestra los pines de las dos entidades (pestaña
   **Pines**) y arrastra de `cliente_id` a `id`.

## Reglas de la notación {#reglas}

- Entre **entidades** valen *Uno a uno*, *Uno a muchos*, *Muchos a muchos* y *Hereda*; de una entidad a un
  **atributo** suelto, solo *Tiene*; una **vista** solo *tiene* entidades u otras vistas.
- Entre **pines de atributo** solo valen las tres relaciones de cardinalidad.
- **Viewpoints**: *Conceptual* (entidades y atributos sueltos), *Lógico* (entidades) y *Físico* (entidades
  y vistas).
- No hay anidamiento: las entidades no contienen otros nodos (los atributos van en su campo).

## Importar y exportar {#importar-exportar}

- **Mermaid `erDiagram`**: exporta entidades con sus atributos y claves, y las relaciones con la
  cardinalidad de cada extremo, la misma que ves en el editor.
- **draw.io** y **SVG**: exportan la pata de gallo tal cual.
- No hay importación desde SQL ni desde `erDiagram` todavía. Ver la
  [tabla de formatos](../importar-exportar.md#formatos).

## Errores comunes {#errores-comunes}

- **Dibujar la relación al revés**: en *Uno a muchos* el origen es el lado "uno" (el cliente) y el destino
  el lado "muchos" (los pedidos).
- **Crear un atributo suelto por cada columna**: en los niveles lógico y físico es más claro meterlos en
  el campo **Atributos** de la entidad; los óvalos son para el estilo Chen conceptual.
- **Muchos a muchos en el modelo físico**: en una base de datos real necesitas una entidad intermedia
  ("Línea de pedido") con dos relaciones *Uno a muchos*.
- **Olvidar la clave primaria**: sin ella el exportador no puede marcar `PK`.

## Referencia completa {#referencia}

La lista completa de tipos, relaciones, matriz de validez y viewpoints se genera desde el propio pack:

<!-- docs:notation-ref er -->
