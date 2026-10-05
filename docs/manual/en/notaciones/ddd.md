# DDD: context map

## What it is and when to use it {#que-es}

Domain-driven design (DDD, by Eric Evans) splits the business into pieces, each with its own language.
It works at two levels. The **strategic** level is the **context map**: which subdomains the business
has, which **bounded contexts** solve them and how they relate to each other (who leads, who adapts). The
**tactical** level is the model of each context: aggregates, entities, value objects, domain events and
services.

Use it to decide how to split a system into services or teams, document the integrations between them or
design a context's model before coding it. For class detail without DDD semantics, use the
[class diagram](uml.md); for the applications and databases that implement each context, [C4](c4.md).

## Key elements {#elementos-clave}

| Element | Level | What it represents |
|---|---|---|
| **Domain** | Strategic | The business area being modeled. It contains subdomains and bounded contexts. Field `vision` |
| **Subdomain** | Strategic | A part of the domain. `kind` (required): *Core*, what sets the business apart; *Supporting*; or *Generic*, what you could buy off the shelf |
| **Bounded context** | Strategic | The boundary within which a model and its language are consistent. It contains the tactical model. Fields `team`, `responsibilities` (one per line) and `vision` |
| **Aggregate** | Tactical | A cluster that changes as a unit. It contains entities, value objects and events. Fields `root` and `invariants` |
| **Entity** | Tactical | An object with its own identity («Entity»). Fields `identity`, `attributes` and `operations` |
| **Value object** | Tactical | An immutable object without identity: "Money", "Address" («Value Object»). Field `attributes` |
| **Domain event** | Tactical | Something that has already happened, in the past tense: "Order confirmed" («Domain Event»). Field `attributes` |
| **Service** | Tactical | An operation that belongs to no entity («Service»). `layer` (*Domain*, *Application* or *Infrastructure*) and `operations` |

Entities, value objects, events and services are drawn as classifiers: the «stereotype» at the top and
the `attributes` and `operations` compartments below, one line per item (`amount: Money`,
`confirm(): void`). The `stereotype` field replaces the default one («Aggregate Root», «Repository»…).

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Context relationship** | Solid line with the pattern as its label | How two bounded contexts relate. `pattern` (required): *Partnership*, *Shared Kernel*, *Customer/Supplier*, *Conformist*, *Anticorruption Layer*, *Open Host Service*, *Published Language* or *Separate Ways*. `sourceRole` and `targetRole`: *U* (upstream, the one depended on) or *D* (downstream), painted next to each end. It is the default relation |
| **Implements** | Dashed with open arrow | The bounded context solves (fully or partly) a subdomain |
| **Reference** | Solid with open arrow | The source knows or uses the target; between aggregates, by identity only. `sourceCard` and `targetCard` (multiplicity) |
| **Publishes** | Dashed with arrow | An aggregate, entity or service emits a domain event |
| **Triggers** | Dashed with arrow | A domain event sets off a service, aggregate or context that listens to it |

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **DDD: context map**. In the view's inspector, pick the
   **Context map** viewpoint. Or start from the **DDD: context map of a store** template on the home
   screen.
2. Drag a **Domain** "E-commerce" and, inside it, two **Subdomain**: "Sales" (*Core*) and "Billing"
   (*Generic*).
3. Inside the domain, add two **Bounded context**: "Orders" and "Invoicing". Join each one to its
   subdomain with **Implements**.
4. Join "Orders" → "Invoicing" with **Context relationship** (it comes first). Pick the *Customer/Supplier*
   pattern, source role *U* and target role *D*: the canvas labels the pattern and the letters.
5. Create another DDD view with the **Tactical model** viewpoint and bring the "Orders" context into it
   (it is the same element; see [bringing an element into another view](../modelo-y-vistas.md#reutilizar)).
   Inside it, put an **Aggregate** "Order" with the **Entity** "Order" (identity `orderId`) and the
   **Value object** "Money".
6. Add a **Domain event** "Order confirmed", join it from the aggregate with **Publishes**, and from the
   event to a **Service** "Issue invoice" with **Triggers**.

## Notation rules {#reglas}

- **Context relationship** only between bounded contexts; **Implements** only from a bounded context to
  a subdomain.
- **Reference**: from an aggregate, entity, value object or service to an aggregate, entity or value
  object. A value object can only reference other value objects.
- **Publishes**: from an aggregate, entity or service to a domain event. **Triggers**: from an event to a
  service, an aggregate or a bounded context.
- **Nesting**: a domain contains subdomains and bounded contexts; a bounded context contains aggregates,
  entities, value objects, events and services; an aggregate contains entities, value objects and
  events. Nesting creates no relations.
- **Viewpoints**: *Context map* (domain, subdomains and bounded contexts, with context relationships and
  implements) and *Tactical model* (bounded context, aggregates, entities, value objects, events and
  services, with reference, publishes and triggers).

## Import and export {#importar-exportar}

- There is no import from DDD formats (Context Mapper CML). Mermaid has no equivalent: **Mermaid** exports
  the view as a generic `flowchart` of boxes and arrows, with a warning.
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Mixing up subdomain and bounded context**: the subdomain is the problem ("Billing"); the context, the
  solution with its own model and language. Join them with **Implements**.
- **U and D the wrong way round**: *upstream* is the context others depend on, the one that publishes its
  model; *downstream*, the one that adapts.
- **Aggregates referencing each other by object**: between aggregates, the **Reference** is by identity
  (`customerId`), not by putting one aggregate inside another.
- **Everything is an entity**: if an object doesn't need its own identity ("Money", "Address"), it is a
  **Value object**.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref ddd -->
