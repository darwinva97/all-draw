# Layers × stages

## What it is and when to use it {#que-es}

*Layers × stages* is not a notation with its own types: it is a **grid** where you place elements of any
notation. **Layers** are the rows (by default *Business*, *Application* and *Technology*) and **stages**
are the columns (steps of a journey, project phases, quarters…). Each node lives in a **cell**, where a
layer meets a stage.

Use it for boards and maps: a customer journey with what happens in each layer, a capability map, an
application portfolio by area, a quarterly roadmap. It is also the format diagrams imported from Drawer
arrive in.

![The demo's layers × stages grid, with visible pins on two microservices (Spanish interface)](../../img/07-rejilla-pines.png)

## Key elements {#elementos-clave}

The grid has no palette of its own: the palette's **Notation** tab shows the other notations as *other
notation*, and the **Libraries** and **Model** tabs show your own types and existing elements. What is
specific to this view is its structure:

| Piece | What it is | Where to edit it |
|---|---|---|
| **Layer** | A row with name, color and height | View inspector, **Layers** section (click the canvas background) |
| **Stage** | A column with name and width | View inspector, **Stages** section |
| **Stage group** | A top band grouping several consecutive stages ("Phase 1") | Comes from importing a `.drawer` file or is defined through the API |
| **Cell** | Where a layer meets a stage; it holds nodes | Drag a node to another cell to move it |

Any element fits in a cell: an ArchiMate process, a C4 container, a type from your own library (like the
demo's *Microservicio*, with its pins).

## Relations {#relaciones}

The default relation is **Link** (`core:link`). Between pins you normally use **Data flow**
(`core:flow`), which also records which field goes to which field. Between two elements of the same
notation that notation's relations also apply (for example, *Serving* between two ArchiMate elements).
See [bridge relations](../notaciones.md#relaciones-puente).

## Getting started {#como-empezar}

This is how the demo's grid view (*Mapa capas × etapas*) is built:

1. In the **Views** panel, press **＋** and choose **Layers × stages**.
2. Click the canvas background. In the inspector, rename the layers (*Business*, *Application*,
   *Technology*) and the stages: "Acquisition", "Onboarding", "Operation". Remove the extra one with **×**
   and add more with **＋ stage** or **＋ layer**.
3. From the palette's **Model** tab, drag elements that already exist: the "Customer onboarding" process
   to *Business × Onboarding*, the "CRM" to *Application × Onboarding*, the "Kubernetes cluster" to
   *Technology × Onboarding*.
4. Add new elements from the palette (any notation) or from a library.
5. Connect two nodes and choose **Link** in the picker (it comes first). To join specific values, show
   the pins in the inspector's **Pins** tab and drag from pin to pin (see [pins](../conceptos.md#pines)).

## Notation rules {#reglas}

- **One node, one cell**: each node belongs to one layer and one stage; dragging it changes its cell.
- **Deleting a layer or stage doesn't delete its nodes**: they stay outside the grid until you move them
  to another cell.
- There is no matrix of its own: the allowed relations depend on the notations of the elements you join.
- **Auto layout** arranges nodes inside their cell without moving them to another cell.

## Import and export {#importar-exportar}

- **Drawer** (`.drawer`): each Drawer diagram becomes a layers × stages view, with layers, stages, groups,
  colors, pins and mappings. See [Import and export](../importar-exportar.md#drawer).
- **draw.io** and **Mermaid**: export the cells as containers (in Mermaid, one `subgraph` per layer).
- **SVG**, **PNG** and **self-contained HTML** draw the grid as it is.
- ArchiMate, BPMN and Structurizr have no grid: when exporting to them, these views are left out with a
  warning. See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **"Lost" nodes after deleting a stage**: they are outside the grid. Drag them into a cell.
- **Creating a new element when it already exists**: if the process is already in another view, bring it
  from the **Model** tab; that way it is the same element and not a duplicate.
- **Pins that don't show**: pins are shown per node. Turn them on in the inspector's **Pins** tab.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref grid -->
