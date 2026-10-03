# Freeform

## What it is and when to use it {#que-es}

The **freeform** canvas is a whiteboard with no rules: boxes, ellipses, diamonds, cylinders, notes and
arrows, and everything connects to everything. It imposes no meaning; you give it one with names and
colours.

Use it for quick sketches, drawings that don't fit any notation, simple network diagrams or any diagram
type in the [catalog](../notaciones.md#catalogo) that doesn't have its own notation yet (UML use cases,
Gantt charts…). It is also the importers' fallback type: when a file brings a shape they don't recognise,
they turn it into a freeform shape.

## Key elements {#elementos-clave}

| Element | What for |
|---|---|
| **Box** | General-purpose rounded rectangle. It has a `description` field |
| **Ellipse** | A start or end, a concept, an informal state |
| **Diamond** | A question or decision |
| **Cylinder** | A database or store |
| **Actor** | A person |
| **Note** | A sticky-note comment |
| **Group** | A frame that holds other nodes (they move with it) |
| **Text** | A label with no background or border |

## Relations {#relaciones}

| Relation | Line |
|---|---|
| **Arrow** | Solid with a head (the default relation) |
| **Line** | Solid, no heads |
| **Dashed** | Dashed with a head |
| **Bidirectional** | Solid with a head at both ends |

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Freeform**.
2. Drag a few **Box** from the palette and rename them with **F2**.
3. Join them by dragging from the bottom edge of one to another and choose the connector in the picker
   (**Arrow** comes first). You can change it later in the inspector.
4. To group, drag a **Group** and put the nodes inside it.
5. Change colours and borders in the inspector's **Style** tab, or create rules that paint according to
   the data (see [Libraries, rules and people](../librerias-reglas-personas.md)).

> [!TIP]
> On the freeform canvas you can also drag types from other notations (the **Notation** tab, *other
> notation* sections) and types from your libraries. That way a sketch can gain meaning little by little.

## Notation rules {#reglas}

- **No validity matrix**: any freeform shape connects to any other with any of the four connectors.
- With elements of **another notation** (a BPMN task, an ArchiMate service) only the core
  [bridge relations](../notaciones.md#relaciones-puente) apply, as in any view.
- Only the **Group** is a container; putting something inside it creates no relation.

## Import and export {#importar-exportar}

- **Mermaid** (`flowchart`/`graph`): on import, nodes and edges become freeform shapes and connectors; on
  export, each shape is translated to its Mermaid equivalent.
- **draw.io**, **SVG**, **PNG** and **self-contained HTML**: export the view as it is.
- See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Using freeform for something that has a notation**: if you are drawing a process, a data model or an
  architecture, its own notation gives you validation, export to standard formats and a suitable auto
  layout.
- **Drawing the same thing twice**: if the element already exists in another view, drag it from the
  **Model** tab instead of creating a new box with the same name.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref freeform -->
