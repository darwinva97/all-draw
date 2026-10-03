# Flowchart

## What it is and when to use it {#que-es}

The classic flowchart (ISO 5807) draws a **step-by-step procedure**: where it starts, what is done, which
questions are answered (yes/no) and where it ends. It is the diagram almost everybody can read.

Use it for algorithms, instructions, simple internal procedures or the logic of a function. If several
roles take part, messages are exchanged between organizations or you want to run it in a process engine,
use [BPMN](bpmn.md).

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Start** | Green rounded rectangle | Where it starts. It can only be a source |
| **End** | Red rounded rectangle | Where it ends. It can only be a target |
| **Process** | Rectangle | A step or action: "Calculate the total" |
| **Choice** | Diamond | A decision: a question with several outcomes. Field `question` |
| **Input/Output** | Parallelogram | Reading or showing data: "Ask for the email" |
| **Document** | Sheet | A document or report produced or consulted |
| **Database** | Cylinder | A data store |
| **Subroutine** | Rectangle with double side borders | A predefined process detailed elsewhere |
| **Connector** | Small circle | Joins two distant sections without arrows crossing the whole drawing; both connectors share the same `ref` ("A") |

## Relations {#relaciones}

Only one: the **Arrow**, with a `label` field for the outcomes of a decision ("yes", "no", "> 100").

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Flowchart**.
2. Drag a **Start**, an **Input/Output** "Ask for the email", a **Choice** "Valid email?", a **Process**
   "Create the account" and an **End**.
3. Join each step to the next and choose **Arrow** in the picker (it comes first).
4. Join the decision to "Create the account" and set the label to "yes"; add another arrow from the
   decision back to "Ask for the email" with the label "no".
5. If a step is complex, use a **Subroutine** and detail it in another view: right-click → **New detail
   view…** (see [Concepts](../conceptos.md#drill-down)).

## Notation rules {#reglas}

- Everything can be joined to everything with an **Arrow**, with two exceptions: nothing leaves the
  **End** and nothing enters the **Start**.
- No nesting or viewpoints.

## Import and export {#importar-exportar}

- **Mermaid** (`flowchart`): exports each step with its Mermaid shape and the arrows with their label.
  When you **import** a Mermaid `flowchart`, the nodes arrive as [freeform](freeform.md) shapes, not as
  flowchart types.
- The view also exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Decisions without labels on their outcomes**: fill in the label of every arrow leaving a diamond.
- **Several loose ends**: it is allowed, but if they all mean the same thing, join the branches into a
  single **End**.
- **Arrows crossing the whole diagram**: use a pair of **Connector** with the same reference.
- **Using Process to read or show data**: that is what **Input/Output** is for; it helps to see at a
  glance where the user is involved.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref flow -->
