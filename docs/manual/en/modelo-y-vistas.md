# Model and views

This chapter is practical: how to create views, bring an element from one view to another, navigate between
dimensions and delete things without nasty surprises. The theory (what the model is, what an appearance is,
why there are dimensions) is explained with drawings in [Concepts](conceptos.md).

## 30-second recap {#repaso}

| Level | What it holds | Example from the demo |
|---|---|---|
| **Model** | **Elements** (type, name, documentation, fields, pins, tags) and **relations** (type, source, target) | The "Alta de cliente" process; the *Serving* relation from "CRM" to that process |
| **Views** | **Nodes** (where and how an element is drawn in that view) and **edges** (how a relation is drawn) | The same process in the ArchiMate view and in the layers × stages grid |

Golden rule: **what you type in the inspector (name, data) belongs to the element and shows in every view;
what you do with the mouse on the canvas (move, resize, colours from the Style tab) belongs to that view.**

## Kinds of view {#clases-de-vista}

Each view has a **notation**, which decides the palette, the valid relations and how nodes look. Depending on
the notation, the canvas works in one of three ways:

| Kind | Notations | What the canvas is like |
|---|---|---|
| **Freeform** | ArchiMate, BPMN, states, C4, ER, UML, mind map, flowchart, DFD, Freeform | An open canvas: place nodes anywhere, put them in containers and connect them with edges. |
| **Grid** | Layers × stages | A table: rows are **layers** and columns are **stages**. Each node lives in a cell and moves with it. |
| **Sequence** | Sequence diagram | Lifelines are columns and messages are horizontal arrows you reorder by dragging them up or down. |

A grid's layers and stages are edited in the view's inspector (**Layers** and **Stages** sections): name,
colour, height or width, add and remove. More about each notation in [Notations](notaciones.md).

## Creating a view {#crear-vista}

**From the Views panel** (the usual way):

1. In the left column, in the **Views** header, press the **+** button (*New view*).
2. Pick a notation from the list (each with its colour dot).
3. The view "New *notation* view" is created and opened. If it is a grid, it comes with three layers
   (Business, Application, Technology) and three stages (Start, Process, End) to get you going.

**From search**: press **Ctrl+K**, type "create" and choose "Create *notation* view".

**On a phone**: **Views** button in the bottom bar → **+**.

Then click an empty area of the canvas to see the view in the **inspector** and fill in:

| Field | What it is for |
|---|---|
| **Name** | The view's title in the panel and in the view path. |
| **Description** | Free text; shown when you hover the view in the panel. |
| **Viewpoint** | Narrows the palette to a viewpoint's types (the others are dimmed). *(none: everything)* turns it off. See [Concepts → Viewpoints](conceptos.md#viewpoints). |
| **Root element** | The element this view is the detail of. See [The root element pattern](modelo-y-vistas.md#patron-elemento-raiz). |
| **Public (read-only via link)** | Server workspaces only: lets you show this view with a read-only link. See [Sharing and collaborating](compartir-y-colaborar.md). |

The inspector header sums up the view: notation, number of nodes and, if it has a root, "detail of *X*".

## Organising, opening and deleting views {#gestionar-vistas}

- The **Views** panel groups views **by notation** (with each one's colour dot) and sorts them by name. Click
  a group's title to collapse it.
- Views that have a root element show a small diamond (◇) in front.
- **Click** a view to open it. The workspace remembers the last view you opened and returns to it next time.
- To **delete** a view, press the **×** on its right. You will be asked to confirm and reminded that the
  elements stay in the model. Its nodes and edges are deleted, **not** the elements or the relations.
- At the bottom of the panel, the **Model** section shows how many elements and relations the whole workspace
  has, and how many traces cross dimensions (click to open the traceability matrix).

## Bringing an element into another view {#reutilizar}

An element can appear in as many views as you like. Two ways to do it:

1. **The palette's Model tab**: open the target view, go to the **Model** tab, find the element and **drag**
   it onto the canvas. A new appearance of the same element is created.
2. **Copy and paste**: select one or more nodes, **Ctrl+C**, switch view and **Ctrl+V**. Appearances of the
   same elements are pasted, with the edges that connected them.

You can even bring an element into a view of **another notation**: in the demo, the ArchiMate role "Gestor
comercial" (account manager) also appears in the C4 view "CRM · Contenedores".

> [!IMPORTANT]
> If what you want is a **new** element similar to another one (not the same one), use **Ctrl+Shift+V**
> (paste as copy) or **Ctrl+D** (duplicate). If you use Ctrl+V and then rename, you rename it everywhere.

To find out how many times an element appears, select it: the inspector header says "in *n* views", and the
**Where** tab lists them all.

## Dimensions {#dimensiones}

A dimension is a navigation axis: "see this element in BPMN", "see it as states". Without dimensions, the
**Open in another dimension** menu is empty. See [Concepts → Dimensions](conceptos.md#dimensiones).

**Adding a dimension:**

1. In the **Views** panel, expand the **Dimensions** section.
2. Open the **Add dimension…** drop-down.
3. Choose a whole notation (for example "BPMN 2.0 (all)") or one of its viewpoints (for example, under C4,
   "Context"). The dimension is created with the notation's name and colour.

**Removing a dimension:** press the **×** next to it. Only the navigation shortcut goes away; the views you
already created stay.

> [!TIP]
> A dimension with a viewpoint is more specific: "C4 · Context" only finds C4 views with that viewpoint, and
> when it creates a new one from the menu, it sets that viewpoint on it.

## Open in another dimension {#abrir-en-otra-dimension}

![Node menu: open in another dimension, appears in, traces (Spanish interface)](../img/05-menu-dimension.png)

1. **Right-click** a node (on touch screens, press and hold for half a second).
2. The **Open in another dimension** section shows one entry per dimension, with its colour.
3. Choose one:
   - If the element **already has** a detail view in that notation, it opens.
   - If the entry says **(create)**, a new view called "*element* · *dimension*" is created, with that element
     as its **root**, and opened.

When the view is created from a node that had no double-click view yet, that node gets linked to it: from
then on, **double-clicking** the node takes you to the detail, and the node shows a small "drill down" icon in
its corner to remind you it has one.

If the new view is in the **same notation** as the element (or is Freeform), the element itself appears in it
as the first node. If it is in another notation (for example, the BPMN detail of an ArchiMate process), the
view starts empty: the element is its root but is not drawn.

The same menu also has:

- **Enter detail**: only if the node has a double-click view.
- **New detail view…**: expands every notation, even those that are not dimensions, and creates a detail view
  in the one you pick.
- **Appears in**: the other views where the element is; click to go there.
- **Traces**: up to three "Link to …" suggestions of elements in other notations that look like the same
  concept (see [Concepts → Traces](conceptos.md#trazas)).
- **Node**: **Comment**, **Show pins** / **Hide pins**, **Remove from this view** and **Delete from model**.

## Detail views and the view path {#vistas-de-detalle}

![BPMN view opened from the ArchiMate process, with the view path in the toolbar (Spanish interface)](../img/04-bpmn-detalle.png)

When you enter a detail (double-click, **Enter detail** or **Open in another dimension**), the top toolbar
shows the **view path**: *Arquitectura · Alta de cliente › Alta de cliente · BPMN*, with the current
notation's colour tag.

- Press **←** (back) to return to the previous view.
- Press any name in the path to jump straight to that level.
- If you open a view from the Views panel, the path starts again from that view.

**Changing where double-click goes:** select the node, inspector **Where** tab, **View on double-click**
field. It offers the element's detail views; *(none)* turns double-click off.

## The inspector's "Where" tab {#donde}

With a node selected, the **Where** tab answers "where else is this element?":

| Section | What it shows |
|---|---|
| **Detail views** | The views whose root is this element, with their notation. Click to enter. |
| **Appears in** | The other views where the element has a node. Click to go there. |
| **View on double-click** | Which of its detail views double-clicking this node opens. |
| **Traces** | The bridge relations (Trace, Realizes, Refines) with elements in other notations, with options to go to them or remove them. |
| **Suggestions** | Elements in other notations that look like the same concept, with a button to link them. |

The element's **relations** with the rest of the model are in the **Data** tab, **Relations** section: all of
them are listed, including those not drawn in the current view (marked "(not in this view)"). If one is
drawn, clicking it selects it on the canvas.

> [!TIP]
> Checking **Where** is the quickest way to make sure a concept is properly linked across dimensions.

## Remove from view or delete from model {#quitar-o-borrar}

This is the most important distinction in all-draw, and the cause of most surprises:

| Action | How | What is deleted | What is kept |
|---|---|---|---|
| **Remove from this view** | Select the node and press **Del** (or Backspace), or right-click → **Remove from this view** | The node, any nodes inside it and the edges touching it **in this view** | The element, its relations and its appearances in other views |
| **Delete from model** | Right-click → **Delete from model** (asks for confirmation) | The element, **all** its appearances in **all** views and all its relations | Nothing of that element; views it was the root of are left without a root |
| **Remove an edge from this view** | Select the edge and press **Del**, or right-click → **Remove from this view** | That edge, only **in this view** | The relation and its edges in other views |
| **Delete a relation** | Select the edge and press **Shift+Del**, or right-click → **Delete from model** (asks for confirmation) | The relation in the model and **all** its edges in every view | Both elements |
| **Delete a view** | **×** next to the view in the panel | The view with its nodes and edges | All elements and relations |

> [!WARNING]
> **Del** is harmless on both *nodes* and *edges*: it only removes them from this view. What deletes from the whole
> model is **Shift+Del** (on edges) and **Delete from model**, which always ask for confirmation.

Everything can be undone with **Ctrl+Z** (Cmd+Z on a Mac) as long as you don't close the workspace. In server
workspaces you can also go back to an earlier snapshot from [History](historial.md).

## Orphan elements {#huerfanos}

An **orphan** element exists in the model but does not appear in any view. It usually happens when you remove
a node with **Del** and it was its only appearance, or when you import a model from another tool.

It is not an error: sometimes it is exactly what you want (an element that is documented but not drawn yet).
But it is worth keeping track of them:

- In the palette's **Model** tab, orphans are shown in *italics*. Drag them into a view to bring them back.
- The **problems panel** shows a note for each one (it does not appear in any view) with a fix that deletes
  the element.
- In the same way it flags relations that are not drawn in any view.

## The root element pattern {#patron-elemento-raiz}

A view's **root element** says "this view is the detail of this element". It is what lets **Open in another
dimension** find the right view, gives the view its diamond (◇) in the panel and makes trace suggestions work
better.

A workflow that works well:

1. Model the architecture in ArchiMate: processes, services, applications.
2. Add the dimensions you are going to use (for example "BPMN 2.0" and "State machine").
3. For each process you want to detail: right-click → **Open in another dimension → BPMN 2.0 (create)**. The
   process becomes the root of the new BPMN view and double-click is linked.
4. Inside the BPMN, for the task that changes the state of something (a case file, an order): **Open in
   another dimension → State machine (create)**.
5. Link concepts repeated across notations with traces (node menu → **Traces**, or **Workspace →
   Traceability**).
6. Check the problems panel: the note saying an element has no trace to another notation tells you what is
   still unconnected.

You can also set or change the root by hand in the view's inspector (**Root element**).

## Common problems {#problemas-frecuentes}

**I renamed an element and it changed in another view where I didn't want it to.**
Both boxes were the same element (you probably created them with Ctrl+V or from the Model tab). Undo with
Ctrl+Z, and in the view where you want something different, remove the node and create a new one from the
**Notation** tab, or use **Ctrl+Shift+V** to paste an independent copy.

**"Open in another dimension" offers nothing.**
The workspace has no dimensions: add them in **Views → Dimensions**.

**I created the detail and the view is empty.**
That is normal when the notation is different: the BPMN detail of an ArchiMate process starts blank. The
process is the root (the view's inspector header says "detail of …"), even though it is not drawn.

**Double-click doesn't go anywhere.**
The node has no double-click view. Pick one in **Where → View on double-click**, or create one with **New
detail view…**. Note: double-clicking *the name* renames it; double-click another part of the node.

**It won't let me drop a node in the grid.**
In a layers × stages view, nodes can only go **inside a cell**. Drop it on a cell, not on the headers or
outside the table.

**I deleted a layer or stage and some nodes disappeared.**
They were not deleted: they stay outside the grid until you move them to another cell.

**I deleted a view by mistake.**
Press **Ctrl+Z**. The elements were still in the model anyway; if you already closed the workspace and it is
on the server, restore a snapshot from [History](historial.md).
