# Use cases (UML)

## What it is and when to use it {#que-es}

The UML use case diagram shows **what a system does and for whom**: the **actors** (people, other
systems or the passing of time) that interact with it and the **use cases**, the goals each actor
achieves ("Place order", "Track shipment"). It doesn't explain how each thing is done, only what is
offered and to whom.

Use it at the start of a project to agree on scope, to split features between teams or to explain a
product to someone non-technical. To tell step by step how a use case unfolds, follow up with a
[sequence diagram](sequence.md) or an [activity](activity.md) diagram.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Actor** | Stick figure | A role that interacts with the system, always **outside** the boundary. `kind`: *Person*, *External system* or *Time (timer)*; optional `stereotype` («system», «device»…) |
| **Use case** | Ellipse | A goal of the actor, with a verb: "Pay for the order". Fields `extensionPoints` (one per line), `precondition` and `postcondition` |
| **System (boundary)** | Rectangle with the name at the top | The system being described (the *subject*). It contains the use cases |
| **Package** | Folder with a tab | Groups use cases, actors or other packages |

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Association** | Solid line without arrow | The actor takes part in the use case. It is the default relation |
| **Include** | Dashed with open arrow, labeled «include» | The base use case (source) **always** includes the behavior of the included one (target) |
| **Extend** | Dashed with open arrow, labeled «extend» | The extending use case (source) adds **optional** behavior to the base use case (target). Fields `extensionPoint` and `condition` ("[valid coupon]") |
| **Generalization** | Solid with hollow triangle | An actor or use case (source) is a specialization of another (target) |
| **Dependency** | Dashed with open arrow | A package uses or imports another, with a `stereotype` («import», «access»…) |

You don't need to type «include» or «extend»: the canvas paints the keyword on the line from the
relation type. For an extend, it also shows the extension point and the condition you fill in.

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Use cases (UML)**. Or start from the **Use cases:
   online store** template on the home screen.
2. Drag a **System (boundary)** "Online store" and make it large: it will be the frame for the use cases.
3. Drag three **Use case** **inside** the system: "Place order", "Sign in" and "Apply coupon". In "Place
   order", type `payment` under `extensionPoints`.
4. Outside the boundary, add an **Actor** "Customer" (*Person*) and another one, "Payment gateway"
   (*External system*).
5. Join "Customer" to "Place order" with **Association** (it comes first); do the same between "Place
   order" and "Payment gateway".
6. Join "Place order" → "Sign in" and choose **Include**.
7. Join "Apply coupon" → "Place order" and choose **Extend**; in the inspector set the extension point to
   `payment` and the condition to `[has coupon]`.

## Notation rules {#reglas}

- **Association** only between an actor and a use case (in either direction).
- **Include** and **extend** only between use cases.
- **Generalization** only between elements of the same kind: actor → actor or use case → use case.
- **Dependency** only between packages. The **System (boundary)** takes part in no relation.
- **Nesting**: the system boundary contains only use cases (actors stay outside); a package contains
  anything. Nesting creates no relations.
- No viewpoints.

## Import and export {#importar-exportar}

- **Mermaid** (`flowchart`): exports actors as boxes and use cases as stadium shapes. A `flowchart`
  exported this way from all-draw imports back as a use case diagram.
- The view also exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Extend arrow backwards**: it goes from the **extending** use case (the optional one) to the **base**
  use case. The include arrow is the other way round: from the base to the included one.
- **Actors inside the boundary**: an actor is always external to the system; if something is inside, it
  is part of the system, not an actor.
- **Use cases that are steps**: "Click the Pay button" is not a goal; "Pay for the order" is.
- **Using «include» to order steps**: the diagram has no sequence; for order, use an
  [activity](activity.md) or a [sequence](sequence.md) diagram.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref usecase -->
