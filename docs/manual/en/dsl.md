# Text language (DSL)

all-draw has a text language to describe a whole workspace —model, views, libraries— in a file you can read, write
by hand, diff in Git and generate from a script. It resembles Structurizr DSL and LikeC4, but uses the types of
**every** all-draw notation (`archimate:BusinessActor`, `bpmn:Task`, `c4:Container`, `uml:Class`…). Files use the
`.alldraw.txt` extension.

## What it is for {#para-que}

- **Write a model quickly**: ten lines of text and all-draw lays out the views by itself with the automatic layout.
- **Review changes**: the text is stable (the same workspace always gives the same text), so a `git diff` tells you
  exactly what changed.
- **Generate models** from other systems (an inventory, a CMDB, a script) without knowing the internal JSON.
- **Lossless round trip**: exporting to text and importing it again gives the same workspace, with the same ids.

## Exporting and importing {#exportar-importar}

- **Export**: **Import / Export → Export the workspace → all-draw text (DSL)** downloads `<workspace>.alldraw.txt`.
- **Import**: like any other file (**Home → Import…** or **Import (replaces the workspace)**). all-draw recognizes it
  by the `.alldraw.txt` extension, by the first line `// all-draw DSL v1` or by its content.
- If a view **has no positions** (no `at` at all), the [automatic layout](editor.md) for its notation is applied on
  import.
- If the text has an error, the import stops and tells you **the line and the column** and what was expected.

## Editing as text {#editar-como-texto}

The editor has a **live text panel**: the model written in this language, next to the canvas and synchronized both
ways. Open it with the **Text** button in the bar, with **Ctrl+Shift+E** or from **Ctrl+K → Edit as text**; close it
the same way or with its ✕ button.

- **Scope**: *Current view* (the view, its elements and the relationships it draws) or *Whole space* (also libraries,
  people, rules and comments). With *Current view*, the text follows the view you open on the canvas.
- **Positions**: off (the default), the text has no `at`, `size` or `via` and stays clean; on, it writes them. Either
  way, **what you don't write is kept**: position, size and bend points on the canvas only change if you write them on
  that line.
- **When it is applied**: when you stop typing (a little over half a second) and only if the text **has no errors**.
  Everything you changed since last time goes in as **a single undo step** (Ctrl+Z on the canvas undoes all of it).
  **Ctrl+S** applies without waiting. The status (*In sync*, *Not applied yet…*, *N errors*) is under the panel's bar.
- **Errors**: they are underlined in the text, the line number turns red and the list below shows `line:column` and the
  reason; a click takes the cursor there. While there are errors the model does not change.
- **Autocomplete**: as you type, the types of the view's notation (`archimate:Bus…`) and existing ids (after `include`,
  `edge`, `->`, `detail`…) show up. **Ctrl+Space** opens it by hand; **↑/↓** and **Enter** or **Tab** choose; **Esc**
  closes it.
- **Search**: **Ctrl+F** with the focus in the text (it does not open the general search); **Enter**/**F3** next,
  **Shift+Enter**/**Shift+F3** previous.
- **Cross selection**: with the cursor on an element's declaration (or its `include`, a relationship, an edge) it gets
  selected on the canvas; when you select something on the canvas, the text jumps to its line and highlights it.
- **Keyboard**: **Tab** indents and **Shift+Tab** outdents; to leave the text with the keyboard press **Esc** and then
  **Tab**. **Enter** keeps the indentation (and adds to it after `{`).

What each change in the text does:

| In the text | In the model |
|---|---|
| Change a name, a field, `doc`, `tags`, the type… | Changes that data; the rest of the record stays the same |
| Add a declaration (`x = pack:Type "…"`, `a -> b`) | Creates the element or the relationship |
| Add `include x` / `edge r` | Adds the node (placed next to what is already there) or the edge |
| Remove `include x` | Removes the node from this view (and its edges); the element stays in the model |
| Remove an element's declaration | **Deletes it from the model**, with its appearances and relationships in every view |
| Move an `include` into or out of another one's block | Changes its container keeping its position on screen |
| Change the id (everywhere) | New element with that id; its nodes inherit the old one's position |
| A new view without `at` | It is created and placed with the [automatic layout](editor.md) |

- A declaration without an id (`archimate:BusinessActor "Ana"`) gets one when applied and the text writes it
  (`ana = …`): that way renaming it later does not change the id.
- From *Current view* you can `include` any element of the space, even if it is not in the text; what you cannot do is
  **declare** an id that already exists outside the text (you are warned and nothing is applied: pick another id).
- `//` comments and your own formatting are not stored in the model: when the text is rebuilt, they are lost.

**If the model changes while you edit** (someone changes it on the canvas or from another session): if you have no
pending changes, the text is rebuilt by itself, keeping the cursor on its declaration; if you do, the text is left alone
and, when applied, the changes are **merged** (what you changed wins, what the other person changed is kept). Only if
you both changed **the same data** to different values does the *The model changed…* notice show up, with two options:
**Reload text** (discards yours) or **Keep mine** (applies your text).

In **read-only** mode (read links) the panel shows the text, follows changes and lets you search and select, but not
edit.

## An example {#ejemplo}

```text
// all-draw DSL v1
workspace "Shop" {
  description "Minimal architecture of the online shop"

  model {
    customer = archimate:BusinessActor "Customer" {
      doc "Whoever buys in the shop"
    }
    web = archimate:ApplicationComponent "Web shop" {
      version = "3.2"                       // a field of the element
      api = archimate:ApplicationInterface "REST API"   // nested inside "web"
    }
    catalog = archimate:ApplicationService "Catalog"
    web -> catalog : archimate:Realization
    serves = catalog -> customer : archimate:Serving "looks up products"
  }

  views {
    view map "Application map" {
      notation archimate
      include *                             // every element and their relationships
      note "Draft for Monday's meeting"
    }
  }
}
```

No positions: when you import it, all-draw lays out the "Application map" view automatically.

## Basic rules {#reglas}

- **One statement per line** (or several separated by `;`). `{ … }` blocks open at the end of their statement's line
  and close with `}`.
- **Comments**: `// to the end of the line` and `/* block */`.
- **Texts** in double quotes, with JSON escapes: `"Line 1\nLine 2"`, `"quotes \"inside\""`.
- **Ids**: letters, digits, `_`, `$`, `.` and `-`, starting with a letter, `_` or `$`; they may have `:` segments
  (`n:A`). Any other id goes between backticks: `` `my id with spaces` ``, `` `1` ``. Reserved words (`view`,
  `include`, `as`, `from`…) also go between backticks when they are ids.
- **Types**: always `pack:Type` (`bpmn:Task`, `lib:my-library:Service`). The list of types of each notation is in the
  [notation reference](notaciones.md).
- **Values**: texts, numbers, `true`, `false`, `null`, lists `[a, b]` and objects `{ "key": value }` (JSON, with keys
  with or without quotes and line breaks inside). Where a name is expected (`notation archimate`) a bare id is fine.

## Elements {#elementos}

```text
id = pack:Type "Name" {
  doc "Documentation"
  tags ["critical", "payments"]
  props { "owner": "Ana" }              // free properties
  field = "value"                       // fields of the type (`key = value`)
  child = pack:Type "Child"             // nested element
}
```

- The **id** is optional: `archimate:ApplicationService "Catalog"` creates the id `catalog` from the name.
- The **name** is optional too (`archimate:Junction`).
- **Fields**: `key = value`. The value is a literal (text, number, list, object…); a bare word without `:` also
  counts as text (`kind = database`).
- **Nesting** an element inside another stores the model hierarchy (`features.parentId`): system ⊃ container ⊃
  component in C4, for example.
- Other attributes: `features { … }`, `ports [ … ]`, `profiles [ … ]`, `library library-id`, `template true`,
  `templateId id`.

## Relationships {#relaciones}

```text
[id =] source -> target [: pack:Type] ["Name"] {
  doc "…"
  condition = "amount > 100"            // fields of the relationship type
  fromPort "order#response.email"       // ends on a pin
  toPort "notices#request.recipient"
  map "response.email" -> "request.recipient"   // field-to-field connection
}
```

- Without a type, the relationship is `core:link`. Without an id, one is generated (`rel_source_target`).
- The source or the target can be **another relationship** (ArchiMate relationships on relationships): write its id.
- Leave **a space on each side of the colon**: `b : type` (`b:type` would be read as a single id).

## Views {#vistas}

```text
view id "Name" {
  notation bpmn                 // notation (free by default)
  kind grid                     // freeform, grid, sequence, tree or matrix
  viewpoint layered             // ArchiMate or C4 viewpoint
  root process                  // element the view details
  doc "…"

  include pool at 40, 40 size 600, 300 {        // node of an element, with position and size
    include task at 60, 50                       // nested: coordinates relative to the parent
  }
  include task as task2 at 400, 50               // second appearance of the same element: needs its own id
  note "Check with Legal" as memo at 700, 40     // visual nodes: note, label, group, image
  edge flow1 via 300, 80  300, 140               // the edge of a relationship, with bend points
  edge flow2 from task2 to end                   // explicit ends (if the element appears several times)
  edge as line1 from memo to task                // edge without a relationship (line to a note)
}
```

- `include a, b, c` adds several elements; `include *`, every element of the model (and the relationships between
  them).
- `edge *` draws every relationship between the elements already included.
- `at x, y` and `size width, height` are optional. **If no node of the view has `at`**, it is laid out with the
  automatic layout on import.
- Inside a node block: `style { "fill": "#fde68a" }`, `detail view-id` (detail view on double click), `text "…"`
  (a label different from the name), `z 2`, `instanceNote "…"`, `meta { … }`.
- On edges: `label "…"`, `fromPort "…"`, `toPort "…"`, `style { "line": "dashed" }`.
- Node and edge ids: if you do not write them, they are `<view>.<element>` and `<view>.<relationship>`.

### Layers × stages {#rejilla}

```text
view map "Map" {
  kind grid
  stagegroup phase1 "Phase 1" color "#e0e7ff"
  layer business "Business" color "#fef3c7" size 200
  stage discover "Discover" size 220 in phase1
  include search at 20, 20 cell business discover
}
```

## Libraries and other records {#librerias}

```text
library services "Services" {
  description "The team's own types"
  elementType lib:services:svc "Microservice" {
    color "#c7d2fe"
    category "Services"
    field repo "Repository" url
    field status "Status" select { "options": "active,retired" }
  }
  relationType lib:services:calls "Calls" { line "dashed" }
}
```

Dimensions, people, style rules and comments are written as records with their attributes as they are:
`dimension dim_c4 "C4" { notationId "c4" }`, `person ana "Ana" { email "ana@example.com" }`,
`rule r1 "Critical in red" { … }`, `comment c1 { … }`. The exporter always writes them; by hand they are rarely needed.

## Errors {#errores}

Every problem gives a line and a column:

| Message | Typical cause |
|---|---|
| Expected end of line but found `"…"` | Two names in a row, or the `{` at the end of the line is missing. |
| Unclosed text (the closing quote is missing) | One quote too many or too few. |
| Missing "}" to close the block opened on line *N* | A block that is not closed. |
| Duplicate id "x" | Two elements (or views, nodes…) with the same id. |
| Relationship "r" has no nodes in view "v" | `edge r` in a view that does not include its ends. |
| "x" does not look like a type (expected pack:Type) | The notation prefix is missing. |

On import it stops at the first **error**; **warnings** (an element that does not exist in `include`, a detail view
that is not there) are shown in the warnings list and the import goes on.

## Grammar {#gramatica}

```text
file         = [ "workspace" [TEXT] "{" ] { statement } [ "}" ]
statement    = "name" TEXT | "description" TEXT | "current" ID | "created" TEXT | "updated" TEXT
             | "model" "{" { element | relationship } "}"
             | "views" "{" { view } "}" | view
             | "library" ID [TEXT] "{" { attribute | type } "}"
             | ("dimension" | "person" | "rule" | "comment") ID [TEXT] [ "{" { ID VALUE } "}" ]
             | element | relationship
element      = [ID "="] TYPE [TEXT] [ "{" { attribute | field | element | relationship } "}" ]
field        = ID "=" VALUE
relationship = [ID "="] REF "->" REF [":" TYPE] [TEXT] [ "{" { attribute | field | "map" TEXT "->" TEXT [TEXT] } "}" ]
view         = "view" [ID] [TEXT] "{" { attribute | grid | node | edge } "}"
grid         = "layer" ID TEXT ["color" TEXT] ["size" NUM] | "stage" ID TEXT ["size" NUM] ["in" ID]
             | "stagegroup" ID TEXT ["color" TEXT]
node         = ( "include" (REF | "*" | REF {"," REF}) | ("note"|"label"|"group"|"image"|"node") [TEXT]
               | "visual" TYPE [TEXT] ) ["as" ID] ["at" NUM "," NUM] ["size" NUM "," NUM] ["cell" ID ID]
               [ "{" { attribute | node } "}" ]
edge         = "edge" (REF | "*" | ) ["as" ID] ["from" REF] ["to" REF] ["via" NUM "," NUM {NUM "," NUM}]
               ["label" TEXT] [ "{" { attribute } "}" ]
attribute    = ID VALUE
VALUE        = TEXT | NUM | "true" | "false" | "null" | ID | "[" [VALUE {"," VALUE}] "]" | "{" [KEY ":" VALUE {"," …}] "}"
```

## For developers {#api}

The `@all-draw/io` package exposes a stable API (the live text editor uses it too):

- `parseDsl(text) → { workspace, diagnostics, unpositioned, locations }`: never throws. `diagnostics` carries
  `severity`, `message` (translated), `key`/`vars` and the start and end line/column; `unpositioned`, the views that
  need a layout; `locations`, where each record starts (`"elements/<id>"`, `"nodes/<id>"`…).
- `serializeDsl(workspace, { positions?, header?, indent? }) → text`: deterministic and lossless
  (`parseDsl(serializeDsl(ws)).workspace` equals `ws`). With `positions: false` it leaves out positions, sizes and
  bend points.
- `isDsl(text)`: does it look like this language?
