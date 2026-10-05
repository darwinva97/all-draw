# Activity (UML)

## What it is and when to use it {#que-es}

The UML activity diagram describes **a workflow**: which actions are performed, in what order, where a
choice is made between paths, which parts run in parallel and what data passes from one action to the
next. With **partitions** (swimlanes) it also shows who does each thing.

Use it for the logic of a use case, an internal process with parallel steps or an algorithm that handles
data. It is richer than the [flowchart](flow.md) (parallelism, objects, signals) and lighter than
[BPMN](bpmn.md), which is the better fit when several organizations or a process engine are involved.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Action** | Rounded rectangle | A step, with a verb: "Validate order". `callBehavior` marks it as a call action (rake icon); field `localPrecondition` |
| **Initial node** | Black dot | Where the flow starts. It only has outgoing flows |
| **Activity final** | Bullseye | Ends the whole activity, even if other flows are still running |
| **Flow final** | Circle with an X | Ends only the flow that reaches it; the others go on |
| **Decision / merge** | Diamond | `role` *Decision* (one input, several outputs with guards) or *Merge* (several alternative inputs, one output). Field `decisionInput` |
| **Fork / join** | Black bar | `role` *Fork* (splits into parallel branches) or *Join* (waits for all of them to arrive). Field `joinSpec` |
| **Object node** | Rectangle with `[state]` | A piece of data flowing between actions. Fields `type` ("Order"), `state` ("paid", shown in brackets) and `isCollection` |
| **Send signal** | Arrow-shaped pentagon | Sends a signal without waiting for a reply. Fields `signal` and `target` |
| **Accept event** | Rectangle with a notch on the left | Waits for a signal or an event. `trigger` ("Payment received", "every day at 8:00") and `kind` (*Signal* or *Time*) |
| **Partition (swimlane)** | Lane with the name in a side band | The party responsible (person, role or system) for the actions it contains |

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Control flow** | Solid with open arrow | The execution order between actions and control nodes. Fields `guard` and `weight` ("{weight = 2}"). It is the default relation |
| **Object flow** | Solid with open arrow | Data passing: it leaves an object node or arrives at one. Fields `guard` and `selection` |

The `guard` is written in brackets ("[approved]", "[else]") and the canvas shows it on the arrow.

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Activity (UML)**. Or start from the **Activity:
   process an order** template on the home screen.
2. Drag two **Partition (swimlane)**: "Customer" and "Store".
3. In "Customer", put an **Initial node** and an **Action** "Submit order". In "Store", an **Action**
   "Check stock", a **Decision / merge**, an **Action** "Charge" and an **Activity final**.
4. Join the steps in order with **Control flow** (it comes first).
5. On the two outputs of the decision, fill in the guard: `[in stock]` towards "Charge" and
   `[out of stock]` towards a **Flow final**.
6. To prepare the shipment and the invoice at the same time, put a **Fork / join** after "Charge", two
   actions in parallel and another bar with `role` *Join* before the end.
7. If "Charge" is complex, tick `callBehavior` and detail it in another view: right-click → **New detail
   view…** (see [Concepts](../conceptos.md#drill-down)).

## Notation rules {#reglas}

- No flow enters the **Initial node** and no flow leaves the **finals**.
- **Object flow** if one of the ends is an **Object node** (the other can't be the initial node);
  **control flow** in every other case. There is no object flow between two actions: put an object node
  in between.
- The **Partition (swimlane)** takes part in no flow; it contains anything, including other partitions.
  Nesting creates no relations.
- No viewpoints.

## Import and export {#importar-exportar}

- **Mermaid** (`flowchart`): the view exports as a Mermaid flowchart. The file carries a comment that
  marks it as an activity diagram, and when you **import** it again it comes back as an activity diagram,
  not as freeform shapes.
- The view also exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Decisions without guards**: fill in the guard on every arrow leaving a diamond and make them mutually
  exclusive; `[else]` covers the rest.
- **Fork without a join**: if the parallel branches must finish before going on, close them with another
  bar with `role` *Join*; otherwise, each branch ends in its own **Flow final**.
- **Activity final where a flow final is enough**: the activity final also stops any parallel branches
  that are still running.
- **Using a diamond to bring parallel branches together**: a merge doesn't wait; to wait for all of them,
  use a **Fork / join** with `role` *Join*.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref activity -->
