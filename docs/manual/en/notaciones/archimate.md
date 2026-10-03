# ArchiMate 3.2

## What it is and when to use it {#que-es}

ArchiMate is The Open Group's **enterprise architecture** language. In a single drawing it tells what
the organization does (business), which applications it uses to do it (application) and what
infrastructure they run on (technology), plus strategy, motivation (goals, requirements) and change
projects.

Use it to answer questions such as "which applications support this process?", "what happens if we
switch this server off?" or "which capabilities does this project cover?". If you need the step-by-step
flow of a process, combine it with [BPMN](bpmn.md); for the inside of a piece of software, with
[C4](c4.md).

The all-draw pack is generated from the files of the Archi tool, so it follows the specification
closely: **61 elements** (the 60 of ArchiMate 3.2 plus *Junction*), **11 relations**, the complete
validity matrix and **25 viewpoints**.

![ArchiMate view of the demo in the editor (Spanish interface)](../../img/03-editor-archimate.png)

## Key elements {#elementos-clave}

The palette groups elements by layer (*Strategy*, *Business*, *Application*, *Technology*, *Physical*,
*Motivation*, *Implementation & Migration* and *Composite / Other*). The ones you will use most:

| Element | Layer | What it represents |
|---|---|---|
| **Business Actor** | Business | A specific person or organization: "Customer", "Risk department" |
| **Business Role** | Business | A role someone plays: "Account manager" |
| **Business Process** | Business | A sequence of work with an outcome: "Customer onboarding" |
| **Business Service** | Business | What the business offers to the outside: "Onboarding service" |
| **Business Object** | Business | Business information: "Contract", "Application form" |
| **Application Component** | Application | An application or module: "CRM" |
| **Application Service** | Application | What an application offers to others: "KYC check" |
| **Data Object** | Application | Data handled by an application: "Customer file" |
| **Node** | Technology | Infrastructure where software runs: "Kubernetes cluster" |
| **Capability**, **Goal**, **Work Package** | Strategy, motivation, implementation | What the organization is able to do, what it wants to achieve and the projects to get there |

Two special elements: **Grouping** (groups anything) and **Location** (where something is) accept any
child; **Junction** joins or splits relations (*and*/*or*).

In the inspector's **Style** tab you can choose how each node is drawn: *Rectangle with icon* or
*ArchiMate figure* (the specification's alternative shape, such as the stick figure for an actor).

## Relations {#relaciones}

| Relation | Meaning | Example |
|---|---|---|
| **Composition** | Is made of (the part does not exist without the whole) | A component composed of modules |
| **Aggregation** | Groups (the part can exist on its own) | A product groups services |
| **Assignment** | Who does what | *Account manager* → *Customer onboarding* |
| **Realization** | Makes real | *CRM* → *KYC check* |
| **Serving** | Serves | *KYC check* → *Customer onboarding* |
| **Access** | Reads or writes data (field `accessType`: read, write…) | *Customer onboarding* → *Customer file* |
| **Influence** | Influences (motivation; field `strength`) | A principle influences a requirement |
| **Triggering** | Triggers (time order) | One process triggers another |
| **Flow** | Passes something to | One process passes information to another |
| **Specialization** | Is a kind of | "Premium customer" is a kind of "Customer" |
| **Association** | Generic relation (field `directed`). It is the default relation | Any link without strong semantics |

When you connect two nodes, the picker only offers the relations the matrix allows between those two
types (plus the core [bridge relations](../notaciones.md#relaciones-puente), which are always allowed).

## Getting started {#como-empezar}

An example based on the demo's ArchiMate view (*Arquitectura · Alta de cliente*, "customer
onboarding"):

1. In the **Views** panel, press **＋** and choose **ArchiMate 3.2**. In the view's inspector (click the
   canvas background) set the name and, if you like, the *Layered* viewpoint.
2. Drag from the palette a **Business Actor** "Customer", a **Business Role** "Account manager" and a
   **Business Process** "Customer onboarding". Rename with **F2**.
3. Join the role to the process: drag from the bottom edge of the role to the process and choose
   **Assignment**.
4. Add an **Application Service** "KYC check" and join it to the process with **Serving**.
5. Add an **Application Component** "CRM" and join it to the service with **Realization**.
6. Add a **Data Object** "Customer file" and join the process to it with **Access**.
7. To detail the process in BPMN: right-click "Customer onboarding" → **Open in another dimension** (see
   [Concepts](../conceptos.md#drill-down)).

## Notation rules {#reglas}

- **Complete validity matrix** (the same as Archi's): between each pair of types only the relations the
  specification allows are offered. The core bridge relations (`core:trace`, `core:realizes`…) are always
  allowed to link to other notations.
- **Nesting creates a relation**: dropping an element inside another proposes a nesting relation,
  *Composition* by default; also *Aggregation*, *Assignment*, *Realization*, *Specialization* or *Access*
  if the matrix allows it. Taking it out of the container removes it.
- **Grouping** and **Location** accept any child, with *Composition* or *Aggregation*.
- **Viewpoints**: there are 25 (*Organization*, *Business Process Cooperation*, *Application Cooperation*,
  *Layered*, *Capability Map*, *Motivation*, *Implementation and Migration*…). Choosing one dims the
  types that don't belong to it in the palette and the problems panel warns if you use them; it doesn't
  forbid them.

## Import and export {#importar-exportar}

- **Archi** (`.archimate`): import and export, with views, folders, properties, colors and bend points.
  See [Import and export](../importar-exportar.md#archi).
- **ArchiMate Open Exchange** (`.oef.xml`): the standard exchange format, for Archi, BiZZdesign, Sparx and
  other tools.
- When exporting to these formats, elements that are not ArchiMate are left out with a warning. What
  doesn't fit in them (dimensions, pins, traces) is kept in the all-draw JSON.
- Each view can also be exported to SVG, PNG, Mermaid and draw.io ([format table](../importar-exportar.md#formatos)).

## Common mistakes {#errores-comunes}

- **The relation isn't offered when connecting**: the matrix doesn't allow it in that direction. For
  example, a *Business Object* cannot *access* a process: it is the process that accesses the object. Try
  connecting the other way round.
- **A Composition you didn't want is created** when you drop a node inside another. Select the relation
  and change it in the inspector, or use a **Grouping** or a visual **Group** if you only want to group.
- **Mixing up actor and role**: the actor is *who* (Ana, the customer); the role is *what part* they play.
  Assign the actor to the role and the role to the process.
- **Crossing layers without services**: an application doesn't "do" a business process; it serves it
  (*Application Service* → *Serving* → process).

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref archimate -->
