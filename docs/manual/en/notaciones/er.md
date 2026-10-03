# Entity-relationship

## What it is and when to use it {#que-es}

The entity-relationship diagram describes **what data a system stores and how it relates**: the
*entities* (customers, orders, products), their *attributes* (name, email, date) and the *relationships*
between them (a customer places many orders).

Use it to design or document a database, agree on a data model with the business or explain an
integration. It works for the three usual levels: **conceptual** (entities and relationships only),
**logical** (with typed attributes) and **physical** (actual tables and views). Relationships are drawn
in **crow's foot** notation (*Information Engineering*), the most widespread.

## Key elements {#elementos-clave}

| Element | What it represents |
|---|---|
| **Entity** | A table or data concept. Its `attributes` field is a list of *Attribute / Type* pairs (`id / uuid`, `email / text`). `pk` says which attributes form the primary key; `weak` (double border) marks an entity that depends on another to be identified; `table` is its real name in the database |
| **Attribute** | A standalone attribute, drawn as an oval (Chen style). It has `type`, `key` (pk, fk, unique) and `nullable` |
| **View** | A database view: a query over other entities. It can be `materialized` |

Each attribute of an entity is also a **pin**: a connection point of its own that a relationship can be
attached to. So a relationship can go from the `customer_id` attribute of *Order* to the `id` attribute
of *Customer* (a foreign key). See [pins](../conceptos.md#pines).

## Relations {#relaciones}

| Relation | Default ends | What for |
|---|---|---|
| **One to one** | One and only one ↔ one and only one | Each customer has one tax record |
| **One to many** | One and only one → one or many | A customer places many orders. It is the default relation |
| **Many to many** | One or many ↔ one or many | Orders and products (physically resolved with a junction table) |
| **Inherits** | Triangle | A subtype of another entity, with a strategy (`kind`: single table, joined, table per class) |
| **Has** | Plain line | Entity → standalone attribute, and view → entity it relies on |

Each end can be adjusted with `sourceCard` and `targetCard`: `1` (bar), `1..1` (double bar), `0..1`
(circle and bar), `*` (crow's foot), `1..*` (bar and foot), `0..*` (circle and foot). They also have
`identifying` (the child's key includes the parent's) and `onDelete` (*no action*, *cascade*, *set
null*, *restrict*).

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Entity-relationship**. In the view's inspector you can
   pick the *Conceptual*, *Logical* or *Physical* viewpoint.
2. Drag two **Entity**: "Customer" and "Order".
3. In the inspector of "Customer", under `attributes`, add `id / uuid`, `email / text`, `name / text`;
   under `pk`, `id`.
4. In "Order", add `id / uuid`, `customer_id / uuid`, `date / date`.
5. Join "Customer" to "Order" and choose **One to many** in the picker (it comes first). If a customer can
   have no orders, set `targetCard` to `0..*`.
6. To model the foreign key field to field, show the pins of both entities (**Pins** tab) and drag from
   `customer_id` to `id`.

## Notation rules {#reglas}

- Between **entities**: *One to one*, *One to many*, *Many to many* and *Inherits*; from an entity to a
  standalone **attribute**, only *Has*; a **view** only *has* entities or other views.
- Between **attribute pins** only the three cardinality relations are allowed.
- **Viewpoints**: *Conceptual* (entities and standalone attributes), *Logical* (entities) and *Physical*
  (entities and views).
- No nesting: entities don't contain other nodes (attributes go in their field).

## Import and export {#importar-exportar}

- **Mermaid `erDiagram`**: exports entities with their attributes and keys, and relationships with the
  cardinality of each end, the same you see in the editor.
- **draw.io** and **SVG**: export the crow's feet as they are.
- There is no import from SQL or from `erDiagram` yet. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Drawing the relationship backwards**: in *One to many* the source is the "one" side (the customer) and
  the target the "many" side (the orders).
- **One standalone attribute per column**: at the logical and physical levels it is clearer to put them in
  the entity's `attributes` field; ovals are for conceptual Chen style.
- **Many to many in the physical model**: a real database needs a junction entity ("Order line") with two
  *One to many* relationships.
- **Forgetting the primary key**: without it the exporter can't mark `PK`.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref er -->
