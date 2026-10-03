# Comments

Comments let you talk *about* the diagram without cluttering it: a question about an element, a
change request on an arrow, a note in an empty spot of the canvas or a remark about the whole view.
Each comment starts a **thread** that people can reply to and, once the matter is settled,
**resolve**.

Comments are part of the workspace, just like elements and views: they are saved with it, synced
with other people in server workspaces, included in the exported `.alldraw.json` and in the
[history snapshots](historial.md), and undone with **Ctrl+Z** like any other change.

## Opening the comments panel {#abrir-el-panel}

The editor toolbar has a **Comments** button (a speech bubble). If the workspace has unresolved
threads, the button shows how many. Click it to open the side panel; click it again, use the
panel's **×** or press **Escape** (outside the text box) to close it.

The panel also opens by itself when you start a new comment or click a bubble on the canvas.

## What you can comment on {#que-se-puede-comentar}

| What | How to start | Where the thread shows |
|---|---|---|
| An **element** | Select it and, in the inspector (**Data** tab), **Comments** section → **＋ Comment** | In **every** view where that element appears |
| One specific **appearance** (a node) | Right-click the node → **Comment** | Only in that view, on that node |
| A note, group, label or image | Select it → inspector → **＋ Comment** | Only in that view |
| An **edge** (a line) | Select it → inspector → **＋ Comment** | On that line, in that view |
| A **point** on the canvas | Right-click an empty spot → **Comment here** | A marker at that exact point |
| The **whole view** | In the panel, **＋ Comment on view**; or with nothing selected, inspector → **＋ Comment** | In that view's list in the panel |

The difference between the first two rows matters: the same element can appear in several views
(see [model and views](conceptos.md#modelo-y-vistas)). If you comment from the inspector, the
comment belongs to the *element* and you will see it wherever the element is drawn. If you comment
with a right-click, it belongs to *that appearance* and only shows in that view.

On touch screens, right-click is replaced by a **long press**.

> [!TIP]
> When you write the first comment, the panel shows at the top what it is anchored to (for example
> "◆ Customer onboarding" or "◎ Point in Overview"). If that is not what you meant, click
> **Cancel** and start again from the right place.

## Writing, replying and editing {#escribir-y-responder}

- Type in the box and click **Comment** or press **Ctrl+Enter** (**⌘+Enter** on Mac). **Escape**
  cancels.
- To answer, click **Reply** under the thread. Replies stay in order, below the first comment.
- Your own comments show two buttons next to the date: **✎** (edit) and the bin (delete). An
  edited comment shows "(edited)".
- If you delete the **first** comment of a thread that already has replies, the **whole thread**
  is deleted; you are asked to confirm first.
- Dates are shown in relative form ("5 min ago", "yesterday"); hover over them to see the exact
  date and time.
- The button with the name of the commented item at the top of each thread (**Go to the commented
  item**) opens the right view, selects the element or line and centers the canvas on it.

> [!NOTE]
> **Who signs.** Today all-draw does not use your account name for comments: in a server workspace
> you sign with the same name shown in presence ("Anonymous" followed by a number, which changes
> every time you open the workspace) and in a local workspace, simply "Anonymous". Because the app
> recognizes "your" comments by that name, you may no longer be able to edit or delete the ones you
> wrote on another day. If people need to know who you are, sign inside the text or mention
> yourself (see below).

## @mentions {#menciones}

Type **@** in the text box and a list of the **workspace's people** appears (the ones added in the
**Workspace → People** panel, see [libraries, rules and people](librerias-reglas-personas.md)).
Keep typing to filter by name or email; choose with **↑ / ↓** and **Enter** or **Tab**, or with the
mouse.

- The mention is highlighted in the text; hover over it to see the person's team or email.
- If you delete the `@Name` text, the mention goes away.
- If the workspace has no people, the list tells you so: create them first.

> [!IMPORTANT]
> Mentioning someone **does not send them any notice** (all-draw sends no emails or
> notifications). A mention makes it clear who the comment is for. If that person needs to know,
> tell them through your usual channel.

## Resolving and reopening {#resolver}

Once the matter has been dealt with, click **✓ Resolve**. The thread is marked "✓ Resolved" (hover
to see who resolved it), leaves the **Open** filter and its bubble disappears from the canvas. It
is not deleted: it is still available under **Resolved**.

To open it again, click **Reopen**. **Replying to a resolved thread reopens it automatically.**

Anyone who can edit the workspace can resolve and reopen any thread, not only the person who
started it.

## Panel filters {#filtros}

At the top of the panel there are two controls:

- **Open / Resolved / All**, each with its count. Open threads are shown by default.
- **This view only** (on by default): shows the threads visible in the current view —those of the
  view, its points, its nodes and lines, and those of the elements and relationships that appear in
  it—. Turn it off to see the whole workspace.

If you reach a thread from a bubble or from the inspector, the panel relaxes the filters as needed
to show it to you.

## Bubbles on the canvas {#burbujas}

**Open** threads are shown on the diagram itself:

- At the top-right corner of a commented node, a bubble with the **number of open threads** on that
  node (including those of the element it represents).
- In the middle of a commented line, another bubble with its number of threads.
- On a commented point, a marker with the **number of messages** in the thread.

Click a bubble to open the thread in the panel. Bubbles keep their size when you zoom and are not
dragged along with the node by accident. Resolved threads show no bubble.

The inspector also summarises the comments of the selection: the **Comments (open / total)**
section shows up to five threads and a **See all** link if there are more.

## If the commented item is deleted {#al-borrar}

Threads are **not lost** when you delete what they were about; they move to something that still
exists:

| You delete… | The thread moves to… |
|---|---|
| A node (**Remove from this view**) | The view it was in |
| An element (**Delete from model**) | One of the views where it appeared |
| A line or a relationship | The view where it was drawn |
| A whole view | It is left **without an anchor**: shown as "No anchor (the commented item was deleted)" |

Threads without an anchor belong to no view: to see them, turn off **This view only**. If you undo
the deletion with **Ctrl+Z**, the comment goes back to its original place.

If a thread shows "(anchor deleted)", what it was about disappeared some other way (for example,
when importing a file that replaces the workspace). The text is still there; you can resolve or
delete it.

## Who can comment {#quien-puede}

| Where | Can read | Can write, reply and resolve |
|---|---|---|
| Local workspace (in your browser) | You | You |
| Server workspace, **owner** role | Yes | Yes |
| Server workspace, **can edit** role (or edit link) | Yes | Yes |
| Server workspace, **read-only** role (or read-only link) | Yes | No |

Roles are explained in [sharing and collaborating](compartir-y-colaborar.md).

## Local and server workspaces {#local-y-servidor}

- In a **local workspace**, comments live only in your browser. They work as notes to yourself, or
  to go along with an `.alldraw.json` you are going to hand to someone else.
- In a **server workspace**, everyone with access sees comments live, including those written while
  someone was offline, once the connection is back (see
  [offline](compartir-y-colaborar.md#sin-conexion)).
- If you **upload** a local workspace to the server, its comments go with it.

## Common mistakes {#errores-comunes}

- **"I can't see the comment I just wrote."** Check the filters: you may be on **Resolved**, or the
  thread may belong to another view while **This view only** is on.
- **"I don't get the Comment option."** You are in read-only mode (**read-only** role or read-only link).
  Ask the owner for an edit link.
- **"I comment on an element and the comment shows up in other views."** That is expected if you
  commented from the inspector: the thread belongs to the element. To keep it to this view, use
  right-click → **Comment** on the node.
- **"@ doesn't suggest anyone."** Mentions are of the workspace's people (**Workspace → People**),
  not of server users. Create them first.
- **"I mentioned someone and they didn't notice."** Mentions send no notices.
- **"I can no longer edit one of my comments."** See the note on [who signs](#escribir-y-responder).
- **"The bubble disappeared from the canvas."** The thread was resolved; it is still under
  **Resolved**.
