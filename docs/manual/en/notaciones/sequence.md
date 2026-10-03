# Sequence diagram

## What it is and when to use it {#que-es}

A sequence diagram shows **who talks to whom and in which order**. Each participant is a column (its
*lifeline*) and messages are horizontal arrows read from top to bottom, like a conversation over time.

Use it to explain how a specific operation works across several systems ("what happens when the customer
submits the form?"), to design an API or to document an integration. It follows UML 2.

Sequence views have their **own canvas**: lifelines line up in columns by themselves and messages are
placed vertically according to their order.

## Key elements {#elementos-clave}

| Element | What it represents |
|---|---|
| **Lifeline** | A participant: person, system, component or object. The `kind` field picks the header icon: actor, boundary, control, entity, database or participant. `type` says which class it is ("order: Order") |
| **Activation** | The narrow bar on a lifeline while that participant is working. It goes inside its lifeline |
| **Fragment** | A frame grouping messages with an operator (`kind`): `alt` (alternatives), `opt` (optional), `loop` (repetition), `par` (parallel), `break`, `critical` or `ref` (reference to another diagram), with its `condition` ("[email not found]") |
| **Note** | A comment on a lifeline or a message |

## Relations {#relaciones}

| Relation | Line | What for |
|---|---|---|
| **Message** | Solid with arrow | A call. `kind`: *sync* (filled head, waits for a reply), *async* (open head), *return*, *create* (creates the participant), *destroy* (ends it). `order` sets its position and `text` is what is sent ("POST /customers") |
| **Return** (`sequence:Return`) | Dashed, open head | The reply to a message. Equivalent to a message of kind *return* |

## Getting started {#como-empezar}

This is how the demo's sequence view (*Alta de cliente · Secuencia*, "customer onboarding") is built:

1. In the **Views** panel, press **＋** and choose **Sequence diagram**.
2. Drag four **Lifeline**: "Customer" (kind *actor*), "Portal" (*boundary*), "Customer API" (*control*) and
   "Database" (*database*). They line up in columns; drag them left or right to change the order.
3. Drag from the "Customer" lifeline to the "Portal" lifeline: a **Message** is created. Type its text,
   "fills in the form".
4. Continue with "Portal" → "Customer API" ("POST /customers") and "Customer API" → "Database" ("find by
   email").
5. Add the database's reply to the API as a **Return** ("none"): change the relation type in the
   inspector.
6. To change a message's order, **drag its label** up or down.
7. Put an **Activation** inside "Customer API" to show when it is working, and an `alt` **Fragment** with
   the condition "[email not found]" around the messages that only happen in that case.

> [!TIP]
> For a message from a participant to itself, drag from its lifeline and drop on the handle of its own
> header.

## Notation rules {#reglas}

- Messages only join **lifelines or activations**. Notes and fragments don't send or receive messages (a
  note is anchored with a core **Link**).
- An **Activation** goes inside a lifeline (or another activation); a **Fragment** can contain anything.
  Nesting creates no relations.
- The vertical position comes from the message order; if two messages share the same order, the one
  created first goes first.

## Import and export {#importar-exportar}

- There is no standard sequence format yet (Mermaid `sequenceDiagram`, PlantUML) for import or export.
- The view exports to **SVG**, **PNG** and **self-contained HTML** as an image; **Mermaid** and **draw.io**
  export it as a generic diagram of boxes and arrows.
- See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Messages that don't appear where you expect**: the height is driven by `order`. Drag the label to
  reposition it.
- **Drawing the reply as a normal message**: use **Return** (or kind *return*) so it is drawn dashed and
  reads as a reply.
- **Too many participants**: more than six or seven columns gets hard to read. Split it into several
  diagrams and use a `ref` fragment to refer to them.
- **Duplicating participants that already exist**: the "Customer API" lifeline can be linked to the C4
  container of the same name with a trace (`core:trace`), as in the demo.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref sequence -->
