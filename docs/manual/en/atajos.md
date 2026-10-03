# Keyboard, mouse and touch shortcuts

Everything you can do with the keyboard, the mouse or your finger in the all-draw editor, in one place. In
the editor, press **?** to see a summary on screen (or use the **Keyboard shortcuts** button in the toolbar).

> [!TIP]
> **On a Mac**, use **Cmd** (⌘) wherever this page says **Ctrl**: **Cmd+Z**, **Cmd+C**, **Cmd+K**… Both work.
> **Alt** is the **Option** key (⌥), and **Del** is the **delete** key (⌫). If **F2** does nothing, try
> **fn+F2**.

## Before you start: where the focus is {#foco}

There are two kinds of shortcuts:

- **Global**: they work anywhere in the editor as long as you are not typing in a field. They are **Ctrl+K**,
  **Ctrl+F**, **?** and **F2**.
- **Canvas**: all the others (copy, paste, move with arrows, zoom, delete…). They only work when the canvas has
  the focus. If a shortcut "does nothing", **click an empty area of the canvas** and try again.

While you type in a text field (the inspector, the palette's search box…), keys type text and canvas shortcuts
do not fire. That way **Del** deletes letters, not nodes.

## General {#general}

| Shortcut | What it does |
|---|---|
| **Ctrl+K** or **Ctrl+F** | Opens (or closes) search: elements, views and actions |
| **?** | Opens (or closes) the shortcuts panel |
| **Esc** | Closes menus, panels and dialogs; cancels renaming |
| **Ctrl+Z** | Undo |
| **Ctrl+Y** or **Ctrl+Shift+Z** | Redo |

> [!NOTE]
> In the editor, **Ctrl+F** opens all-draw's search instead of the browser's find bar.

## Selection {#seleccion}

| Shortcut | What it does |
|---|---|
| **Click** | Selects a node or an edge |
| **Shift+click** | Adds to or removes from the selection |
| **Shift+drag** on the background | Marquee selection (everything inside the rectangle) |
| **Ctrl+A** | Selects all nodes and edges in the view |
| **Click the background** | Clears the selection and shows the view in the inspector |
| **F2** | Renames the selected element (with a single node selected) |

## Editing {#edicion}

| Shortcut | What it does |
|---|---|
| **Ctrl+C** | Copies the selected nodes (and the edges between them) |
| **Ctrl+V** | Pastes **new appearances of the same elements**. Use it to bring elements into another view |
| **Ctrl+Shift+V** | Pastes as a **copy**: creates new, independent elements |
| **Ctrl+D** | Duplicates the selection (new elements), slightly offset |
| **Arrow keys** | Move the selection 1 px |
| **Shift+arrows** | Move the selection 10 px |
| **Del** or **Backspace** | On nodes: **removes them from the view** (they stay in the model). On edges: **deletes the relation** from the model |
| **Alt** (hold) | Disables snap to grid while you drag |

> [!WARNING]
> **Del** on an edge does not just remove it from the view: it deletes the relation in every view. If you get
> it wrong, **Ctrl+Z**. Be careful with **Ctrl+A** followed by **Del**: since **Ctrl+A** also selects edges, it
> would delete every relation drawn in the view. More in
> [Model and views](modelo-y-vistas.md#quitar-o-borrar).

In a layers × stages grid, whatever you paste goes into the cell under the cursor.

## View and zoom {#vista}

| Shortcut | What it does |
|---|---|
| **+** (or **=**) | Zoom in |
| **-** | Zoom out |
| **Ctrl+0** | Zoom to 100% |
| **Ctrl+Shift+F** | Fit to view (frames all nodes) |

## Renaming inline {#renombrar}

When you rename a node on the canvas itself (with **F2** or by double-clicking its name):

| Key | What it does |
|---|---|
| **Enter** | Confirms the name |
| **Esc** | Cancels and keeps the old name |
| **Shift+Enter** | Line break (notes only) |

## Search (Ctrl+K) {#busqueda}

| Key | What it does |
|---|---|
| Type | Filters elements, views and actions |
| **↑** / **↓** | Moves through the list |
| **Enter** | Opens the chosen result |
| **Esc** | If you were choosing a view for an element, goes back to the results; otherwise closes |

## Comments {#comentarios}

| Key | What it does |
|---|---|
| **Ctrl+Enter** | Sends the comment or reply |
| **@** | Starts a mention; the list of people appears |
| **↑** / **↓** | Moves through the mention list |
| **Enter** or **Tab** | Picks the highlighted mention |
| **Esc** | Closes the mention list; if there is none, cancels the draft |

More in [Comments](comentarios.md).

## Dialogs {#dialogos}

In dialogs (sign in, share, search, shortcuts, Workspace…):

| Key | What it does |
|---|---|
| **Tab** / **Shift+Tab** | Moves to the next / previous control (focus stays inside the dialog) |
| **Esc** | Closes the dialog and returns focus to the button that opened it |

## Mouse {#raton}

| Gesture | Where | What it does |
|---|---|---|
| Drag | Canvas background | Pans the view |
| Wheel | Canvas | Zooms in or out |
| Double-click | Canvas background | Zooms in |
| Drag | From the palette onto the canvas | Creates a node (or an appearance, from the **Model** tab) |
| Drag | A node | Moves it; dropping it inside a container nests it |
| Drag | Corners of a selected node | Resizes it |
| Drag | From a node's bottom edge to another node | Creates a relation (the **Relationship type** menu appears) |
| Drag | From one pin to another pin | Creates a pin-to-pin relation, with its mapping |
| Double-click | A node | Enters its detail view |
| Double-click | A node's name | Renames it inline |
| Double-click | An edge | Adds a bend point |
| Drag | A bend point | Moves it |
| Double-click | A bend point | Removes it |
| Right-click | A node | Node menu: open in another dimension, detail, traces, comment, pins, remove, delete |
| Right-click | Canvas background | Canvas menu: **Paste here**, **Add note**, **Comment here**, **Select all**, **Fit to view**, **Auto layout** |
| Drag or wheel | Minimap (bottom-right corner) | Pans or zooms the view |

The zoom in, zoom out and fit-to-view buttons are also at the bottom left of the canvas.

## Touch screens {#tactil}

all-draw adapts to the screen size:

- **Desktop** (1100 px or wider): all three columns visible.
- **Tablet** (700 to 1099 px): the toolbar has two buttons to **show or hide** the views-and-palette column and
  the inspector column. Your choice is remembered.
- **Phone** (under 700 px): the canvas fills the screen and a bar appears at the bottom with **Views**,
  **Add**, **Inspector** and **More**. Each button opens a sheet that slides up from the bottom.

| Gesture | What it does |
|---|---|
| Tap | Selects a node or an edge |
| Drag one finger on the background | Pans the view |
| Pinch | Zooms in or out |
| Drag a node | Moves it |
| **Press and hold** a node (half a second, without moving your finger) | Opens the node menu, like right-click |
| Tap a type in the **Add** sheet | Adds it in the centre of the canvas |
| Tap outside the sheet, drag its handle down or press its **×** | Closes the sheet |

The **More** sheet holds the view path, **Workspace**, search, snap to grid, theme, shortcuts, **Fit to view**,
**Auto layout** and the workspace actions (import/export, share…). The undo and redo buttons always stay in the
top bar.

> [!TIP]
> Without a keyboard, the node menu (press and hold) replaces several shortcuts: **Enter detail** instead of
> double-click, **Remove from this view** instead of **Del**. To rename, open the **Inspector** sheet and edit
> the name at the top.

## Common problems {#problemas-frecuentes}

**A shortcut does nothing.**
Click an empty area of the canvas to give it the focus. If you are typing in a field, canvas shortcuts are off
on purpose.

**Ctrl+V doesn't paste anything.**
You first need to copy all-draw nodes with **Ctrl+C**. You cannot paste in a read-only workspace.

**I pressed Del and a relation disappeared from every view.**
You had an edge selected: **Del** deletes the relation from the model. Press **Ctrl+Z**.

**The arrow keys scroll the page instead of moving the node.**
The canvas does not have the focus, or nothing is selected. Click the node to select it and try again.

**On my phone, press-and-hold doesn't open the menu.**
Keep your finger still on the node: if it moves more than a few pixels, it counts as a drag. Press-and-hold
only works on nodes, not on the background.

**In a read-only workspace many shortcuts don't respond.**
That is expected: only navigation works (search, select all, zoom, fit to view, **Esc**).
