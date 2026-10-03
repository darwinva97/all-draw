# Glossary

The words all-draw uses, explained in a few lines. They are grouped by topic; use the documentation
search if you are looking for a specific one.

## Workspaces and model {#grupo-espacios-y-modelo}

### Workspace {#espacio}

The document you work on: it holds the model, all its views, libraries, rules, people and comments.
It can be **local** (it lives in your browser) or **on the server** (saved on the server and
shareable). See [workspaces](conceptos.md#espacios).

### Local workspace {#espacio-local}

A workspace saved only in this browser, without an account. Nobody else sees it and it has no
history; to avoid losing it, export an `.alldraw.json` from time to time. See
[getting started](primeros-pasos.md).

### Server workspace {#espacio-del-servidor}

A workspace saved on the server with your account. It can be shared, syncs live and has
[history](historial.md).

### Model {#modelo}

The set of *things* you describe (elements) and how they relate (relationships), regardless of how
they are drawn. The same model can be shown in many views. See
[model and views](conceptos.md#modelo-y-vistas).

### Element {#elemento}

A thing in the model: a process, an application, a state, a table… It has a type, a name,
documentation and fields. Renaming it in one view renames it in all of them.

### Relationship {#relacion}

A typed link between two model elements ("serves", "flows to", "realizes"…). It exists only once in
the model even if it is drawn in several views.

### Type {#tipo}

The kind of an element or relationship within a notation (for example *Business Process* in
ArchiMate or *Task* in BPMN). It decides its shape, colour, fields and what it can connect to.

### Category {#categoria}

A grouping of types in the palette (for example *Activities* or *Events* in BPMN). It only serves
to organise the palette.

### Field {#campo}

A named piece of data on an element (for example "owner" or "request"). Fields are defined by the
type or by a library; you can also add free properties. Some fields produce pins.

### Implicit relationship {#relacion-implicita}

The relationship all-draw creates for you when you put a node inside another, if the notation
proposes one (for example, composition in ArchiMate). That way nesting is not just a drawing: it is
recorded in the model.

## Views and canvas {#grupo-vistas}

### View {#vista}

A specific diagram in the workspace, with a notation. It shows part of the model, laid out as you
like. A workspace can have as many views as you want.

### Node (appearance) {#nodo}

The drawing of an element in a view: position, size, style. The same element can have several
appearances in different views. **Remove from this view** deletes the appearance, not the element.

### Edge {#arista}

The drawing of a relationship in a view: the line with its bend points and style. Deleting an edge
from one view does not delete the relationship from the model if it is drawn in other views.

### Container {#contenedor}

A node that can hold others inside it (a BPMN pool, a group, a system in C4). When you put a node
inside, it becomes **nested**.

### Nesting {#anidamiento}

Putting one node inside another. The notation decides what can go inside what and sometimes creates
an [implicit relationship](#relacion-implicita). See [editor](editor.md).

### Bend point {#punto-de-quiebre}

A corner in a line. Double-clicking the line adds one, dragging it moves it and double-clicking it
removes it.

### Routing {#enrutado}

How a line's path between two nodes is drawn: **Orthogonal** (right angles), **Curved** or
**Straight**. You choose it in the edge inspector, **Routing** field.

### Auto layout {#layout-automatico}

A button that rearranges the nodes of the current view neatly, according to the notation. It can be
undone with Ctrl+Z.

### Layers × stages grid {#rejilla}

A table-shaped kind of view: rows are **layers** and columns are **stages**, and each node lives in
a cell. Useful for process or architecture maps by phase. See
[grid notation](notaciones/grid.md).

### Layer {#capa}

A row of the layers × stages grid (for example "Business", "Application", "Technology").

### Stage {#etapa}

A column of the layers × stages grid (for example "Request", "Validation", "Onboarding"). Several
stages can be grouped into bands.

## Notations and dimensions {#grupo-notaciones}

### Notation {#notacion}

The diagram language of a view: ArchiMate, BPMN, C4, state machine, entity-relationship… It decides
the palette, the shapes and which connections are valid. See [notations](notaciones.md).

### Pack {#pack}

The package that implements a notation inside all-draw: its types, relationships, validity matrix,
viewpoints and shapes. In practice, "pack" and "notation" are used almost interchangeably.

### Dimension {#dimension}

A way of looking at the same element through another notation: the "Customer onboarding" process
in ArchiMate, in BPMN and as a state machine are three dimensions of the same element. See
[dimensions](conceptos.md#dimensiones).

### Viewpoint {#viewpoint}

A focus within a notation that highlights the types relevant to a particular question (for example
*Context* in C4). It dims the rest of the palette but does not forbid it. See
[viewpoints](conceptos.md#viewpoints).

### Detail view {#vista-de-detalle}

A view that explains the inside of one specific element (its **root element**). For example, the
BPMN view that details the "Customer onboarding" process.

### Root element {#elemento-raiz}

The element a detail view describes. You choose it in the view inspector.

### Drill-down {#drill-down}

Going from a node into its detail view, and from there into another, deeper each time. See
[drill-down](conceptos.md#drill-down).

### View trail {#ruta}

The breadcrumb in the toolbar that shows which views you have gone down through. Click any of them
to go back to it, or the ← arrow to return to the previous one.

### Validity matrix {#matriz-de-validez}

Each notation's table saying which relationship type is allowed between which element types. It is
why the editor won't let you connect two things the notation does not allow. See
[validity](conceptos.md#validez).

### ArchiMate figure {#figura-archimate}

The alternative shape of an ArchiMate element (for example the cylinder of a data object or the
stick figure of an actor), instead of the rectangle with an icon. You choose it in the inspector.
See [ArchiMate](notaciones/archimate.md).

### Diagram catalogue {#catalogo}

A list of more than 160 diagram types common in IT organisations (capability map, value stream map,
application architecture…) that says which all-draw notation each one is drawn with. It helps you
pick the diagram type when creating a view. See [notations](notaciones.md).

## Pins, traces and checks {#grupo-pines-y-trazas}

### Pin {#pin}

A connection point on a node that matches one of the element's fields (for example, each field of
an API request). It lets you connect field to field. See [pins](conceptos.md#pines).

### Mapping {#mapeo}

In a relationship between pins, the correspondence between a source field and a target field (for
example, "customer.id → application.document").

### Trace {#traza}

A relationship linking elements from different levels or notations to say that one corresponds to
the other (for example, a business process and the application that supports it). See
[traces](conceptos.md#trazas).

### Realizes {#realiza}

A trace saying that an element *makes real* a more abstract one (an application realizes a
service).

### Refines {#refina}

A trace saying that an element is a *more detailed* version of another (a subprocess refines a
process).

### Trace coverage {#cobertura-de-trazas}

How many elements of one level have their trace to the other level. Those without one appear as
gaps in the traceability panel and in the problems panel.

### Validator {#validador}

An automatic check that reviews the workspace (invalid relationships, unused elements, BPMN rules,
overlaps in the drawing, missing traces…) and puts its results in the problems panel.

### Diagnostic {#diagnostico}

Each item in the problems panel: an error, a warning or a note, with the affected element and an
explanation.

### Fix {#arreglo}

The correction a diagnostic proposes and that you can apply with one click (for example, deleting
an element that is not used in any view).

## Libraries, rules and people {#grupo-librerias}

### Library {#libreria}

Your own set of types (with their fields and pins) and reusable components, to model what the
standard notations don't include. See [libraries, rules and people](librerias-reglas-personas.md).

### Component (template) {#componente}

A library element ready to be reused: dragging it onto the canvas creates an instance with its
fields already filled in.

### Instance {#instancia}

An element created from a component. When you change the component, the changes are propagated to
its instances.

### Rule {#regla}

A condition plus a style: "if the *status* field is *obsolete*, paint the node grey". It changes
the appearance, not the model.

### Person {#persona}

Someone you add to the workspace (name, email, team) to assign responsibilities or mention in
comments. It is not a server account.

### Assignment {#asignacion}

The link between a person and something in the workspace (an element, a view, a layer, a stage, a
type or a relationship) with a role, for example "owner".

## Collaboration {#grupo-colaboracion}

### Comment {#comentario}

A message anchored to an element, node, line, point on the canvas or view. See
[comments](comentarios.md).

### Thread {#hilo}

A comment and its replies. It is resolved or reopened as a whole.

### Mention {#mencion}

Typing `@Name` in a comment to refer to a person in the workspace. It is highlighted but sends no
notice.

### Snapshot {#instantanea}

A complete copy of a server workspace at a given moment, which you can go back to. See
[history](historial.md).

### Share link {#enlace-compartido}

An address that gives access to a server workspace, for editing or read-only, without an account.
It can be revoked at any time. See [inviting](compartir-y-colaborar.md#invitar).

### Role {#rol}

What you can do in a server workspace: **owner** (everything, including sharing and deleting),
**editor** (edit) or **viewer** (view only). See
[sharing and collaborating](compartir-y-colaborar.md).

### Presence {#presencia}

The avatars and cursors of the other people connected to the same workspace, live.

### Sync (CRDT) {#sincronizacion}

The technique all-draw uses to combine changes from several people, or changes made offline,
without locks or conflicts: all copies end up the same. CRDT is the technical name of this kind of
data structure.

### Offline mode {#sin-conexion}

Carrying on working when the network drops. Local workspaces need no network; in a server workspace
you already have open you keep editing on a copy in the browser, which syncs when the connection is
back. See [offline](compartir-y-colaborar.md#sin-conexion).

### PWA {#pwa}

*Progressive Web App*: all-draw can be installed from the browser as if it were an app, and it
starts even without a network.

## Import, export and automation {#grupo-importar-exportar}

### all-draw JSON {#json-de-all-draw}

all-draw's own format (`.alldraw.json`): it stores the whole workspace with nothing lost. It is the
best backup. See [formats](importar-exportar.md#formatos).

### Dual export {#exportacion-dual}

An SVG that shows in light or dark theme depending on the viewer's preference, in a single file.

### Self-contained HTML {#html-autocontenido}

A single `.html` file with every view, browsable offline without installing anything. Useful for
sending the diagram to people who don't use all-draw.

### API key {#clave-api}

A long password for programs and agents that acts with your permissions. You create and revoke it
in **Account**. See [keys](agentes-y-api.md#claves).

### MCP {#mcp}

*Model Context Protocol*: the protocol an AI assistant uses to read and edit your workspaces through
all-draw tools. See [MCP](agentes-y-api.md#mcp).
