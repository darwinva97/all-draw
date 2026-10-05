# Components (UML)

## What it is and when to use it {#que-es}

The UML component diagram shows **which replaceable pieces a system is made of and how they fit
together**: each component provides some interfaces (what it can do) and requires others (what it asks
of the rest), and the diagram says who satisfies whom.

Use it to design or document the internal architecture of an application, decide which modules can be
swapped without touching the rest, or agree on contracts between teams. If you want a lighter view to
explain a system to anyone, [C4](c4.md) is more direct; to see where each piece runs, use the
[deployment](deployment.md) diagram.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Component** | Rectangle with the component icon at the top right | A modular part of the system. It is a container: subcomponents, ports, interfaces and artifacts go inside. Fields `stereotype` («subsystem», «service», «library»…) and `technology` |
| **Provided interface** | Circle («lollipop») | What the component offers. Field `operations`, one per line: `+ find(id): Order` |
| **Required interface** | Half circle («socket») | What the component needs from another one. Field `operations` |
| **Port** | Small square on the border | An interaction point of the component that groups provided and required interfaces |
| **Artifact** | Rectangle with the document icon | The physical piece that implements a component. Field `fileName` (`orders.jar`, `api:1.4.2`) |
| **Package** | Folder with a tab | Groups components, interfaces and artifacts |

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Provides** | Solid line | Joins a component or port to the interface it offers (the stick of the «lollipop») |
| **Requires** | Solid line | Joins a component or port to the interface it needs (the stick of the «socket») |
| **Assembly** | Solid line | The required interface (source) is satisfied by the provided one (target); it also joins two components or two ports. It is the default relation |
| **Delegation** | Solid with open arrow, labeled «delegate» | What arrives at a port is handled by an inner part of the component |
| **Realization** | Dashed with hollow triangle | The component (source) implements an interface or another component's specification |
| **Dependency** | Dashed with open arrow | The source needs the target to work. Optional `stereotype` («use», «import», «manifest»…) |

The canvas paints the «delegate» label by itself, from the relation type.

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Components (UML)**. Or start from the **Components:
   online store** template on the home screen.
2. Drag two **Component**: "Orders" and "Payments" (stereotype «service»).
3. Next to "Payments", drag a **Provided interface** "Payments API" with the operation
   `+ charge(order: Order): Receipt`, and join it from "Payments" with **Provides**.
4. Next to "Orders", drag a **Required interface** "Charging" and join it from "Orders" with
   **Requires**.
5. Join "Charging" → "Payments API" with **Assembly** (it comes first): what "Orders" needs is covered by
   what "Payments" offers.
6. If "Orders" exposes a **Port** on its border, put a subcomponent "Validator" inside and join the port
   to it with **Delegation**.
7. Add an **Artifact** "orders.jar" and join it to "Orders" with **Dependency** and the stereotype
   «manifest».

## Notation rules {#reglas}

- **Provides** and **Requires** only go from a component or a port to an interface of the matching kind.
- **Assembly**: from a required interface to a provided interface, between two components or between two
  ports.
- **Delegation**: between two ports, or between a port and a component (in either direction).
- **Realization**: from a component to another component or to a provided interface.
- **Dependency**: between components, from a component to an interface, between artifacts and
  components (both ways), between artifacts and between packages.
- **Nesting**: a component contains components, ports, interfaces and artifacts; a package contains
  anything. Nesting creates no relations.
- No viewpoints.

## Import and export {#importar-exportar}

- Mermaid has no component diagram: **Mermaid** exports the view as a generic `flowchart` of boxes and
  arrows, with a warning.
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Assembly backwards**: the source is the **required** interface (the half circle) and the target the
  **provided** one (the circle).
- **Joining components directly for everything**: if the contract matters, draw the interfaces; that way
  you can see which piece could be replaced by another one offering the same thing.
- **Mixing up component and artifact**: the component is the logical piece ("Payments"); the artifact,
  the file that contains it ("payments.jar"). Where that file is installed belongs in the
  [deployment](deployment.md) diagram.
- **One component per class**: if there are dozens of tiny components, you are probably drawing a
  [class diagram](uml.md).

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref component -->
