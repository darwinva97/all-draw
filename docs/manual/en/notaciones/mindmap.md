# Mind map

## What it is and when to use it {#que-es}

A mind map starts from a **central idea** and develops it in **branches**: main topics around it and,
from each one, ever more specific subtopics. It is the quickest way to organise ideas without worrying
about a formal structure yet.

Use it for brainstorming, preparing a meeting or a presentation, summarising a document or making a
first outline of something you will later model with a more formal notation.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Central idea** | Yellow ellipse | The topic of the map. There is usually one |
| **Topic** | Rounded box | A main branch coming out of the central idea. It has a **Priority** (a number) |
| **Subtopic** | Text | A detail of a topic; it can have its own subtopics, as deep as you like |

All three have a **Notes** field for whatever doesn't fit in the name.

## Relations {#relaciones}

Only one: the **Branch**, a line without an arrowhead from parent to child.

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Mind map**.
2. Drag a **Central idea**: "Product launch".
3. Drag three **Topic**: "Marketing", "Sales", "Support". Join the central idea to each one and choose
   **Branch** in the picker (it comes first).
4. Add **Subtopic** under each topic ("Social media campaign", "Team training"…) and join them to their
   topic with **Branch**.
5. Press **Ctrl+K** and choose **Auto layout of the view**: the map arranges itself as a tree.

## Notation rules {#reglas}

- Branches always go **outwards**: central idea → topic or subtopic; topic → topic or subtopic; subtopic →
  subtopic. **Nothing points to the central idea** and a subtopic cannot have a topic as a child.
- The hierarchy is expressed with branches, **not by nesting** nodes inside each other.
- Auto layout uses a left-to-right tree arrangement.

## Import and export {#importar-exportar}

- There is no import or export to mind map formats yet (FreeMind, XMind, Mermaid `mindmap`).
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**; **Mermaid** exports it as a
  `flowchart`. See the [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Branch isn't offered in the picker** (only the core relations appear): you are probably going from
  child to parent. Always connect from the node closer to the centre.
- **Long sentences in the nodes**: a mind map works with keywords; the rest goes in **Notes**.
- **Several central ideas**: if you end up with two, maybe they are two maps, or two topics of a more
  general idea.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref mindmap -->
