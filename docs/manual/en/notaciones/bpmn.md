# BPMN 2.0

## What it is and when to use it {#que-es}

BPMN (*Business Process Model and Notation*) is the standard for drawing **processes**: which steps there
are, who does each one, in which order, which decisions are taken and which messages are exchanged with
others. Both business and IT people understand it, and many process engines can run it.

Use it to document or redesign a procedure ("customer onboarding", "handling a complaint"), to agree on
responsibilities between departments or to prepare an automation. If you only need a simple algorithm
without roles or messages, a [flowchart](flow.md) is lighter.

The pack covers the modellable elements of BPMN 2.0: processes, collaborations, choreographies and
conversations (36 types and 6 relations).

![BPMN view of the demo, opened from the ArchiMate process](../../img/04-bpmn-detalle.png)

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Pool** | Large band with the name written vertically | A participant (a company, a system) with its own process |
| **Lane** | Band inside a pool | A role or department within the participant: "Manager", "Systems" |
| **Participant (collapsed pool)** | Empty band | A participant whose process is not detailed (a "black box"), for example the customer |
| **Task** | Rounded rectangle | A unit of work. The task type field (`taskType`: user, service, script, manual, business rule, send, receive) changes the icon |
| **Subprocess** | Rectangle with **⊞** | A step that is itself a process. Collapsed, double-click opens its detail view; expanded, it contains its steps |
| **Start event** / **End event** | Thin / thick circle | Where the process starts and ends. They can have an event definition (`eventDefinition`: message, timer, error…) |
| **Intermediate catch / throw event** | Double circle | Something that happens in the middle of the process: waiting for a message, a deadline… |
| **Boundary event** | Double circle on a task's edge | Something that can interrupt a task (a deadline, an error). It is attached with the `attachedTo` field |
| **Exclusive gateway** | Diamond with ✕ | Decision: **only one** path is taken |
| **Parallel gateway** | Diamond with ＋ | All paths at once (and waits for all of them when joining) |
| **Data object** / **Data store** | Sheet / cylinder | Information that is used or produced |
| **Text annotation** | Bracket with text | A comment on any element |

There are also the inclusive, event-based and complex gateways, the call activity, the event, ad hoc and
transaction subprocesses, and the choreography and conversation elements.

## Relations {#relaciones}

| Relation | Line | What for |
|---|---|---|
| **Sequence flow** | Solid with arrow | The order of the steps. Fields `condition` and `default` (the path taken when no other applies). It is the default relation |
| **Message flow** | Dashed, circle at the source | Messages between different participants |
| **Association** | Dotted | Joins annotations, groups and messages to any element |
| **Data input** / **Data output** | Dotted with arrow | Data going into a task / coming out of it |
| **Conversation link** | Double line | Joins a participant to a conversation |

## Getting started {#como-empezar}

This is how the demo's BPMN view (*Alta de cliente · BPMN*, "customer onboarding") is built:

1. In the **Views** panel, press **＋** and choose **BPMN 2.0**.
2. Drag a **Pool** and call it "Bank". Drag two **Lane** inside it: "Manager" and "Systems".
3. In the "Manager" lane, add a **Start event** "Application received" and a **Task** "Collect details"
   (in the inspector, task type *user*).
4. In the "Systems" lane, add the task "Verify identity" (*service*), an **Exclusive gateway**
   "Verified?", the task "Create account" and an **End event** "Customer active".
5. Join the steps in order by dragging from the bottom edge of each node to the next one and choose
   **Sequence flow** in the picker (it comes first: it is BPMN's default relation).
6. Draw a second flow from the gateway to another end event "Rejected". Name the two outgoing flows
   ("yes" and "no") and, if you like, give them a condition.
7. Look at the **problems** bar below the canvas: the BPMN rules warn you if a start event is missing, if
   a node is disconnected or if an outgoing flow has no label.
8. To link to the architecture: right-click the task → **Traces**, or join the task to an ArchiMate
   service with `core:realizes` (see [bridge relations](../notaciones.md#relaciones-puente)).

## Notation rules {#reglas}

- **Validity matrix by role**: a sequence flow cannot leave an end event or enter a start or boundary
  event; a message flow leaves tasks, end events, throw events or pools and enters tasks, start, catch or
  boundary events; data goes into tasks and throw events and comes out of tasks and catch events.
- **BPMN rules the matrix cannot express**:
    - A **sequence flow** joins steps **of the same pool** (and the same subprocess). When connecting, the
      editor does not offer a sequence flow between different pools.
    - A **message flow** joins **different pools**; never two steps of the same one. It is not offered when
      connecting inside one pool.
    - A **boundary event** is attached to an activity: drop it inside the task or subprocess.
    - A gateway has at most **one default flow**; the other flows out of an exclusive gateway carry a
      condition.

  The first three are also checked across the whole model by the *bpmn-pool-rules* rule in the problems
  panel.
- **Nesting** without an implicit relation: a pool or lane contains lanes, steps, data, annotations and
  messages; a subprocess contains steps, data and annotations; a **Group** contains anything.
- **Viewpoints**: *Collaboration* (everything), *Process* (no pools, lanes, message flows, choreographies
  or conversations) and *Choreography*.
- **bpmnlint rules**: the problems panel applies 10 rules from the bpmnlint tool (start and end events
  required, disconnected nodes, superfluous gateways, labels…) and *bpmn-pool-rules* (pools of the flows and
  boundary events). The list is in
  [Import and export](../importar-exportar.md#bpmn).

## Import and export {#importar-exportar}

- **BPMN 2.0 XML** (`.bpmn`): import and export with positions (DI), so you can go back and forth between
  all-draw and Camunda Modeler, bpmn.io, Signavio and others. Exporting the workspace includes every BPMN
  view; exporting from a view includes that view and its detail views. Details in
  [Import and export](../importar-exportar.md#bpmn).
- Each view can also be exported to SVG, PNG, Mermaid and draw.io ([format table](../importar-exportar.md#formatos)).

## Common mistakes {#errores-comunes}

- **A sequence flow between two pools**: different participants only exchange messages. Use a **Message
  flow**.
- **Tasks that split without a gateway** (*no-implicit-split*): if two flows leave a task, add a gateway
  to make clear whether it is a decision or a parallel split.
- **An exclusive gateway with unlabelled outgoing flows**: the reader can't tell which path is which.
  Name each flow ("yes", "no") or give it a condition.
- **Opening with an exclusive gateway and closing with a parallel one** (or the other way round): the
  process waits forever for a path that never arrives. Close with the same type of gateway you opened
  with.
- **Modelling the customer as a lane of the bank**: if the customer is another party, draw it as a
  separate **Participant** and talk to it with message flows.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref bpmn -->
