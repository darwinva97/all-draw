# Notations

In all-draw there is no separate "BPMN diagram" and "ArchiMate diagram": there is **one model** and many
views, and each view is drawn with a **notation**. This chapter explains what a notation is, how to
pick the right one and how to combine several. Each notation also has its own page with the key
elements, a step-by-step example and common mistakes.

## What a notation pack is {#que-es-un-pack}

Each notation comes packaged as a **pack**: a set of data that tells the editor what can be drawn and
how. A pack contains:

| Part | What it decides | Example |
|---|---|---|
| **Element types** | What shows up in the palette, with its shape, colour, icon and fields | *Task*, *Start event* and *Pool* in BPMN |
| **Relation types** | The lines you can draw and their fields | *Sequence flow* with its condition |
| **Validity matrix** | Which relation is allowed between which pair of types | In ArchiMate, *Serving* from an application service to a business process |
| **Nesting** | What can go inside what, and whether nesting creates a relation | A task inside a lane; in ArchiMate, *Composition* when nesting |
| **Viewpoints** | Subsets of types for a specific purpose | *Context* and *Container* in C4 |
| **Colours and categories** | How the palette is grouped and how each type is painted | ArchiMate layers in yellow, blue and green |

Each type has an identifier `pack:Type` (`bpmn:Task`, `archimate:BusinessProcess`, `c4:Container`). You
don't need it to draw, but it is the name used by the [API](agentes-y-api.md), the importers and the
messages in the problems panel.

When you create a view you choose its notation (the **＋** button in the **Views** panel). The view's
notation decides which types come first in the palette and how nodes are laid out. More on views and
dimensions in [Concepts](conceptos.md#notaciones).

## Which notation should I use for…? {#que-notacion-uso}

| I want to draw… | Notation | Why |
|---|---|---|
| A business **process**: who does what, in which order | [BPMN 2.0](notaciones/bpmn.md) | The process standard: tasks, decisions, events and lanes per role |
| **Enterprise architecture**: business, applications and technology, and how they serve each other | [ArchiMate 3.2](notaciones/archimate.md) | Connects layers and has a complete validity matrix |
| The architecture of a piece of **software**: systems, containers, components | [C4](notaciones/c4.md) | Four zoom levels that anyone can read |
| The **life cycle** of something (an order, an account, a request) | [State machine](notaciones/statechart.md) | States, transitions with event and guard, composite states |
| **Interactions** between participants over time | [Sequence diagram](notaciones/sequence.md) | Lifelines in columns and messages ordered top to bottom |
| The tables of a **database** and how they relate | [Entity-relationship](notaciones/er.md) | Entities with attributes and crow's foot cardinalities |
| The **classes** of a program | [Class diagram (UML)](notaciones/uml.md) | Classes, interfaces, inheritance, composition |
| A **brainstorm** or an outline | [Mind map](notaciones/mindmap.md) | Central idea and branches, laid out automatically as a tree |
| An **algorithm** or step-by-step procedure | [Flowchart](notaciones/flow.md) | Start, steps, yes/no decisions and end |
| Where the **data** of a system travels | [Data flow (DFD)](notaciones/dfd.md) | Processes, stores and external entities joined by named flows |
| A **board**, capability map or portfolio | [Layers × stages](notaciones/grid.md) | A grid of rows (layers) by columns (stages) where any element fits |
| **Anything else**, with no rules | [Freeform](notaciones/freeform.md) | Boxes, ellipses, arrows: everything connects to everything |

> [!TIP]
> You don't have to pick just one. It is normal to model the same thing in several notations (the
> process in ArchiMate and in BPMN, the account as a state machine) and jump between them with
> [dimensions](conceptos.md#dimensiones).

## All notations {#todas}

<!-- docs:notation-index -->

- [ArchiMate 3.2](notaciones/archimate.md): enterprise architecture.
- [BPMN 2.0](notaciones/bpmn.md): processes and collaborations.
- [State machine](notaciones/statechart.md): life cycles.
- [C4](notaciones/c4.md): software architecture.
- [Layers × stages](notaciones/grid.md): boards and maps.
- [Freeform](notaciones/freeform.md): a canvas with no rules.
- [Sequence diagram](notaciones/sequence.md): interactions over time.
- [Entity-relationship](notaciones/er.md): databases.
- [Class diagram (UML)](notaciones/uml.md): object-oriented design.
- [Mind map](notaciones/mindmap.md): ideas.
- [Flowchart](notaciones/flow.md): algorithms.
- [Data flow (DFD)](notaciones/dfd.md): data in motion.

## Mixing notations in one view {#mezclar}

A view has one notation, but it is not locked to it. In the palette's **Notation** tab, below the view's
own types, the other notations appear collapsed and marked *other notation*. Drag any of their types onto
the canvas: for example an ArchiMate *Application Component* into a C4 view, or a freeform note into a
BPMN view.

Which relations are allowed is decided by the notation **of the elements**, not that of the view:

- **Two elements of the same notation** follow that notation's matrix. Two BPMN tasks are joined with a
  *Sequence flow* even inside an ArchiMate view.
- **Two elements of different notations** can only be joined with the core bridge relations (next
  section).
- If a relation does not fit the matrix, the problems panel flags it as an error (`invalid-relation`)
  and offers to change it to a valid one.

Types that don't belong to the view's viewpoint are offered dimmed at the end of the palette; if you use
them the problems panel warns you (`viewpoint-violation`), but it doesn't stop you. More in
[Concepts](conceptos.md#validez).

## Core bridge relations {#relaciones-puente}

These relations belong to the **core** (`core`) and are available in every notation. They are the only
ones allowed between elements of different notations, and they are used to link dimensions together
(what all-draw calls [traces](conceptos.md#trazas)).

| Relation | Identifier | Line | What for |
|---|---|---|---|
| **Link** | `core:link` | solid with arrow | Generic link. The default relation in the layers × stages grid and between pins |
| **Trace** | `core:trace` | dashed, open head | The same concept modelled in two notations (the BPMN pool ↔ the ArchiMate process) |
| **Realizes** | `core:realizes` | dashed, triangle | One element makes another real (a BPMN task realizes an ArchiMate service) |
| **Refines** | `core:refines` | dotted, open head | One element details another (a state refines a business object) |
| **Data flow** | `core:flow` | solid with arrow | Data passing from one element to another; it has a *contract* field (JSON) and is the typical relation between [pins](conceptos.md#pines) |

The node menu (right-click → **Traces**) and the **Traceability** tab of the **Workspace** panel suggest
traces between elements that look like the same concept (same name, same detail view…).

## Diagram catalog {#catalogo}

Besides the twelve drawable notations there is the `catalog` pack, a **dictionary of 162 diagram
types** with a formal notation, grouped into 10 families: enterprise architecture; business and
processes; UML and software modelling; C4, architecture and design; APIs and integration; data; cloud
and infrastructure; DevOps and operations; security, QA and risk; and product and management. Each entry
has a description and, when there is one, the all-draw notation used to model it (130 of the 162 have
one; the rest are drawn on the freeform canvas).

The catalog adds no types to the palette: it answers questions like "which notation do I use for a
*Capability Heat Map*?" (layers × stages) or "and a *Value Stream Map*?" (ArchiMate). It has no screen of
its own in the app yet: the API only announces the pack (`GET /api/notations`, id `catalog`) and the
full list lives in the [pack's source code](https://github.com/darwinva97/all-draw/tree/main/packages/notations/catalog).
