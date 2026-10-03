# Data flow (DFD)

## What it is and when to use it {#que-es}

A data flow diagram (DFD) shows **where the information of a system travels**: where it comes from,
which processes transform it, where it is stored and where it goes. It doesn't say in which order things
happen or who does them; only which data moves.

Use it to analyze a system before designing it, for privacy and security reviews ("where does personal
data go?") or to document integrations. It follows the classic Yourdon/DeMarco and Gane-Sarson
notations, and it is built in **levels**: a context diagram with a single process and, from it, more
detailed diagrams.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Process** | Circle | Something that transforms data: "Validate order". The `number` field holds the level numbering: "0" for the context, "1", "1.2"… |
| **Data store** | Two parallel lines | Data at rest: a table, a file, a queue. Its identifier (`number`) is "D1", "D2"… |
| **External entity** | Rectangle | Whoever sends or receives data from outside the system: a person, an organization, another system |

## Relations {#relaciones}

Only one: the **Data flow**, an arrow with the required `data` field, which names what travels ("validated
order", "payment details").

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Data flow (DFD)**. For the context level, choose the
   **Context (level 0)** viewpoint in the view's inspector.
2. Drag a **Process** "Onboarding system" (number `0`) and two **External entity**: "Customer" and "KYC
   provider".
3. Join "Customer" to the process, choose **Data flow** in the picker (it comes first) and type
   "onboarding request" in `data`.
4. Join the process to "KYC provider" ("identity details") and the provider to the process ("verification
   result").
5. For level 1: right-click the process → **New detail view…**. In the new view, break the process down
   into "1 Collect details", "2 Verify identity", "3 Create account" and add a **Data store** "D1
   Customers".

## Notation rules {#reglas}

- **Every flow touches a process**: no flows between two external entities, between two stores or between
  an external entity and a store. Data always goes through a process.
- **Levels are not nested**: each level is a **detail view** of the process it breaks down (see
  [drill-down](../conceptos.md#drill-down)), and the `number` field keeps the numbering ("1" → "1.1",
  "1.2").
- **Viewpoint** *Context (level 0)*: only processes and external entities.
- The flow's `data` field is required by the notation. all-draw doesn't stop you from leaving it empty, so
  check it before calling the diagram finished.

## Import and export {#importar-exportar}

- There is no standard DFD format to import or export.
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**; **Mermaid** exports it as a
  `flowchart`. See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **A flow straight from an external entity to a store**: the process that receives and saves the data is
  missing.
- **Unnamed flows**: a DFD without the `data` field says nothing; name every flow.
- **Confusing a DFD with a flowchart**: if you are drawing yes/no decisions and the order of steps, you
  want a [flowchart](flow.md) or [BPMN](bpmn.md).
- **Processes named with nouns**: a process does something ("Validate order"); it isn't a thing
  ("Orders").

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref dfd -->
