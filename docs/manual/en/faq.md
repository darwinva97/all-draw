# Frequently asked questions

Short answers to the most common questions. Each one links to the chapter where it is explained in
detail.

## Getting started {#empezar}

### What is all-draw and how is it different from other diagram tools? {#que-es}

It is a diagram tool where **one model** is drawn in **many notations**: the "Customer onboarding"
process can appear in an ArchiMate map, in a BPMN diagram and in a state machine, and it is still a
single thing. Rename it in one place and it changes everywhere. See [concepts](conceptos.md).

### Do I need an account? {#necesito-cuenta}

No. Without an account you work with **local workspaces**, saved in your browser. You need an
account to save on the server, share and have history. See [getting started](primeros-pasos.md).

### I can't sign up. Why? {#no-puedo-registrarme}

Each server decides whether registration is open, requires an **invite code** or is closed
("Registration is closed on this server."). In the last two cases, ask whoever runs the server for
access. Meanwhile you can use local workspaces.

### Can I use it on a phone or tablet? {#movil}

Yes. On tablets the panels collapse; on phones there is a bottom bar and panels slide in as sheets.
A **long press** replaces right-click. For large diagrams a bigger screen is more comfortable. See
[editor](editor.md).

### How do I change the language or theme? {#idioma-y-tema}

The **language** (Spanish or English) is chosen in the selector on the home screen or in the editor
toolbar; it is remembered in that browser. The **theme** is changed with the editor toolbar button,
which cycles through *system* → *light* → *dark*. See [editor](editor.md).

### Are there keyboard shortcuts? {#atajos}

Yes: press **?** in the editor to see them all, or see [shortcuts](atajos.md). The most useful:
**Ctrl+Z** undo, **Ctrl+Y** redo, **Ctrl+K** search, **F2** rename, **Del** remove from view.

## Saving and data {#guardar-y-datos}

### Does it save automatically? {#se-guarda-solo}

Yes, always. There is no save button. In a local workspace every change is saved instantly in the
browser ("saved in this browser"). In a server workspace changes are sent in under a second; the
"● online" indicator confirms the connection. See [getting started](primeros-pasos.md).

### Does it work offline? {#sin-conexion}

Largely, yes. Local workspaces never need a network, and the application starts offline. Server
workspaces need a network **to open** (your permissions are checked), but if the connection drops
while you work, the indicator changes to "○ offline (syncs when back)" and you keep editing; when
the network returns everything is merged. See [offline](compartir-y-colaborar.md#sin-conexion).

### Where are my local workspaces and how do I avoid losing them? {#espacios-locales}

They are **inside this browser, on this computer**, in the "In this browser" list on the home
screen. They do not move to another browser or computer, and they are lost if you clear the site's
data or use a private window. To protect them: export an **all-draw JSON** (`.alldraw.json`) from
time to time or upload them to the server. See [workspaces](conceptos.md#espacios).

### How do I move a local workspace to the server? {#subir-al-servidor}

While signed in, click **Upload to server**, in the editor toolbar or next to the workspace on the
home screen. A **copy** is created on the server and opened; the local original stays in your
browser until you delete it. See [getting started](primeros-pasos.md).

### How do I get back an earlier version? {#version-anterior}

- A mistake from a moment ago: **Ctrl+Z**.
- A server workspace from hours or days ago: **History** → **Restore** on the snapshot you want
  (the current state is saved first).
- A local workspace: import the last `.alldraw.json` you exported.

See [history](historial.md).

### How much does it cost? Are there limits? {#coste-y-limites}

The service at alldraw.bezenti.com is **free** and run by a small team: there is no availability
guarantee (SLA) and no support with response times. There are limits so the service stays usable
for everyone: each account can own up to 100 workspaces, each workspace can take up to 20 MB, a file
you import to the server can be up to 5 MB, each workspace keeps up to 100 snapshots and sign-in
attempts are limited. Your quotas are shown in **Account**. See [terms](terminos.md).

### Is my data private? {#privacidad}

Your server workspaces are seen only by you, the people you give access to and, when needed to
maintain it or fix an incident, whoever administers the server. There is no advertising and no third-party analytics. Local
workspaces never leave your browser. See [privacy](privacidad.md).

## Editing {#editar}

### What is the difference between deleting from the view and deleting from the model? {#borrar-vista-o-modelo}

**Del** (or right-click → **Remove from this view**) removes the drawing from this view; the
element stays in the model and in the other views. Right-click → **Delete from model** really
deletes it, from every view, along with its relationships. See [model and views](modelo-y-vistas.md).

### Why can't I connect these two elements? {#no-puedo-conectar}

Because the view's notation allows **no** relationship between those two types: each notation has a
[validity matrix](conceptos.md#validez) and the editor respects it. If you connect pins, their
fields must also be compatible. Try another element type, connect in the opposite direction or use
a [trace](conceptos.md#trazas) if they belong to different levels. See [editor](editor.md).

### Can I put the same element in several diagrams? {#mismo-elemento}

Yes, that is the core idea. Drag it from the palette's **Model** tab into another view, or use
right-click → **Open in another dimension**. See [model and views](modelo-y-vistas.md).

### Why can't I edit anything? {#solo-lectura}

You are in **read-only** mode: you have the *viewer* role or came in through a read-only link. Ask
the owner for an edit link. See [sharing and collaborating](compartir-y-colaborar.md).

### How do I leave comments for my colleagues? {#comentar}

Right-click a node → **Comment**, or the canvas → **Comment here**. You can reply, mention with @ and
resolve. See [comments](comentarios.md).

## Notations {#notaciones}

### Which notations can I use? {#que-notaciones}

ArchiMate, BPMN, state machine, C4, layers × stages, freeform, sequence, entity-relationship, UML
class, mind map, flowchart and data flow (DFD). See [notations](notaciones.md).

### What is a dimension? {#que-es-dimension}

Another way of seeing the same element through another notation: the process in ArchiMate, its
detail in BPMN and its life cycle as a state machine. See [dimensions](conceptos.md#dimensiones).

## Collaborating {#colaborar}

### How do I invite someone? {#invitar}

In a server workspace you own, click **Share** → **New edit link** (or **New read-only link**) →
**Copy link**, and send the link. Whoever opens it does not need an account. You can **revoke** it
whenever you want. See [inviting](compartir-y-colaborar.md#invitar).

### What happens if two people edit the same thing at once? {#edicion-simultanea}

Nothing bad: changes are combined without locks and everyone ends up seeing the same thing. If two
people change **exactly the same piece of data** at the same time (for example, the name of the same
element), one of the two values remains, the same one for everybody. **Ctrl+Z** only undoes your
own changes, never someone else's. See [sharing and collaborating](compartir-y-colaborar.md).

### How do I remove someone's access? {#quitar-acceso}

**Share** → **Revoke** next to the link you gave them. From then on the link no longer opens the
workspace; anyone who has it open at that moment may stay connected until they reload the page or
lose the connection. If several people used the same link, create a new one for those who should
keep access. See [sharing and collaborating](compartir-y-colaborar.md).

## Import and export {#importar-y-exportar}

### How do I import a model from Archi? {#importar-archi}

On the home screen, click **Import…** and pick the `.archimate` file (or an Open Exchange `.xml`).
A new workspace is created with the elements, relationships and views. See
[Archi](importar-exportar.md#archi).

### Can I export to an image? {#exportar-imagen}

Yes, from **Import / Export**, for the open view: **SVG** (a single file that looks right in both
light and dark themes) or double-resolution **PNG**. For every view at once, **self-contained
HTML**. See [formats](importar-exportar.md#formatos).

### Can I take a BPMN diagram to other tools? {#exportar-bpmn}

Yes: **Import / Export → BPMN 2.0 XML** produces a standard file that other BPMN tools open. You can
also import them. See [BPMN](importar-exportar.md#bpmn).

### Does importing replace what I have? {#importar-sustituye}

From the **home screen**, importing creates a **new** workspace. From the editor's **Import /
Export** menu, importing **replaces** the content of the open workspace (you are asked to confirm).
Before doing so, export an `.alldraw.json` or, in a server workspace, create a labelled snapshot in
**History**, in case you want to go back.

## Account and security {#cuenta-y-seguridad}

### I forgot my password. What do I do? {#olvide-contrasena}

all-draw **sends no emails**, so there is no "reset password" link. Ask a server administrator to
reset it: they will give you a temporary password. Sign in with it and change it in **Account →
Change password**.

### How do I change my password or sign out of all my devices? {#cambiar-contrasena}

In **Account** (the "API keys" link next to your name on the home screen): **Change password** also
signs out your other sessions; **Sign out everywhere** closes all of them, including the current
one. A session you don't use for 30 days expires on its own.

### How do I change my name or email? {#cambiar-nombre}

In **Account → Profile**. Changing your email asks for your current password.

### How do I download all my data? {#exportar-mis-datos}

**Account → Your data → Export my data** downloads a JSON with your account, your API keys (without
the secret), your workspaces with their content, members and links, and the list of workspaces
shared with you. See [privacy](privacidad.md#tus-derechos).

### How do I delete my account? {#borrar-cuenta}

In **Account → Your data → Delete account…**, type your password and confirm. Your account, sessions,
API keys and access to other people's workspaces are deleted. Each workspace you own passes to its
**longest-standing editor** (an account you gave the editor role); those without editors are
**deleted**. It cannot be undone: export your data first. If you are the server's only
administrator, you must appoint another one first. See [privacy](privacidad.md#borrar-datos).

### Can I use all-draw with an AI assistant or from my own programs? {#ia-y-api}

Yes. Create an **API key** in **Account** and use it with the REST API or the MCP server so an agent
can read and edit your workspaces. See [agents and API](agentes-y-api.md).

### Can I install all-draw on my own server? {#autoalojar}

Yes: the code is open source (MIT licence) and can be hosted on your own server or on Cloudflare.
See [self-hosting](agentes-y-api.md#autoalojar).
