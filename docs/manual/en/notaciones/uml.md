# Class diagram (UML)

## What it is and when to use it {#que-es}

The UML class diagram describes the **structure of an object-oriented program**: which classes there
are, what data (attributes) and operations each one has, and how they relate (one inherits from another,
one contains another, one uses another).

Use it to design an application's domain model, document a library or explain a design before coding it.
If what you care about are the tables of a database, the [entity-relationship](er.md) diagram is more
direct.

## Key elements {#elementos-clave}

| Element | What it represents |
|---|---|
| **Class** | A class with three compartments: name, `attributes` (one per line: `- name: String`) and `operations` (`+ create(order: Order): void`). It can be `abstract` and carry a `stereotype` («entity», «service», «dto»…) |
| **Interface** | A contract («interface») with operations only; classes realize it |
| **Enumeration** | A closed list of `values` («enumeration»): `PENDING`, `ACTIVE`… |
| **Package** | A namespace containing classes, interfaces and enumerations |

A class's attributes are **pins**: you can attach an association to a specific attribute (see
[pins](../conceptos.md#pines)).

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Association** | Solid line | One class knows another. At each end, multiplicity (`sourceCard`/`targetCard`: `1`, `0..1`, `*`, `1..*`) and role; `navigable` says in which direction. It is the default relation |
| **Aggregation** | Hollow diamond at the source | The whole (source) groups parts that can exist on their own |
| **Composition** | Filled diamond at the source | The whole owns the parts: if the whole goes, they go too |
| **Generalization** | Hollow triangle | Inheritance: the subclass (source) is a kind of the superclass (target) |
| **Realization** | Dashed with triangle | A class implements an interface |
| **Dependency** | Dashed with open arrow | One uses, imports or creates another (with a `stereotype` «use», «import»…) |

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Class diagram (UML)**.
2. Drag a **Class** "Customer". In the inspector, under `attributes`, type `- id: UUID` and
   `- email: String`; under `operations`, `+ activate(): void`.
3. Drag another **Class** "Order" and an **Enumeration** "OrderStatus" with the values `PENDING`, `PAID`,
   `SHIPPED`.
4. Join "Customer" to "Order" and choose **Association**; set the source multiplicity to `1` and the target
   multiplicity to `0..*`.
5. Join "Order" to "OrderStatus" with **Association** or **Dependency**.
6. Add an **Interface** "Notifiable" and join it from "Customer" with **Realization**.
7. If you have many classes, group them in a **Package** by dragging them inside.

## Notation rules {#reglas}

- **Generalization** only between elements of the same kind: class → class or interface → interface.
- **Realization** only from a class to an interface.
- **Association, aggregation and composition** go from a class to another class or to an enumeration;
  from a class to an interface only association is allowed. An interface or an enumeration can only
  *depend on* a class.
- **Packages** only take part in dependencies.
- **Nesting**: a package contains anything, without creating a relation.

## Import and export {#importar-exportar}

- There is no import or export to UML formats yet (XMI, PlantUML, Mermaid `classDiagram`).
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**; **Mermaid** exports it as a
  generic diagram of boxes and arrows. See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Diamond at the wrong end**: in aggregation and composition the source is the **whole** (where the
  diamond goes) and the target the part. If it ends up backwards, delete the relation and create it the
  other way round.
- **Inheritance between a class and an interface**: that is a **Realization**, not a generalization.
- **Composition where an association is enough**: use composition only if the part makes no sense without
  the whole (the lines of an order); for "a customer has orders", association.
- **Everything in one giant class**: if a class has twenty attributes, it is probably hiding other
  classes.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref uml -->
