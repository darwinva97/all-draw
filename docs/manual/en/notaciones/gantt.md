# Gantt chart

## What it is and when to use it {#que-es}

A Gantt chart shows **a plan over time**: each task is a bar running from its start date to its end
date, milestones mark key dates and arrows say what has to finish before something else can start. At a
glance you see what happens each week, what runs in parallel and what is holding up the rest.

Use it to plan a project, track its progress or explain a schedule to whoever has to approve it. For the
logical order of steps without dates, an [activity](activity.md) diagram is a better fit.

Gantt views have their **own canvas**: one row per task and the bars on a timeline. Bars are computed
from the `start`, `end` and `duration` fields, not from the node's position. The scale (days, weeks or
months) is chosen automatically from the project's span, and you can switch it with the buttons at the
top left of the timeline.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Task** | Bar | A piece of work with `start`, `end` and `duration` (days). `progress` (%) fills the bar; `critical` paints it red (it is on the critical path). Field `assignee` |
| **Milestone** | Diamond | A checkpoint with no duration: delivery, approval, launch. It only has a date (`start`) |
| **Phase** | Summary bar | A group of tasks: it runs from the first to the last date of the tasks and milestones it contains. It can contain other phases |

Dates are ISO (`YYYY-MM-DD`) and count calendar days. The `end` is inclusive: a one-day task has the same
start and end. If `end` is missing, it comes from the duration; if `start` is missing, it is derived from
the predecessors (according to their dependencies) or from the end and the duration.

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Dependency** | Elbow arrow | The target task depends on the source. `kind`: *Finish → start (FS)*, the usual one and the one used if you don't pick another; *Start → start (SS)*; *Finish → finish (FF)*; *Start → finish (SF)*. `lag` (days) adds waiting time (or overlap, if negative) |

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Gantt chart**. Or start from the **Gantt: website
   launch** template on the home screen.
2. Drag a **Phase** "Design" and then two **Task**, dropping them on the phase's row (that puts them
   inside it): "Sketches" and "Mockup". A task starts on the day you drop it on and lasts 5 days.
3. In the inspector of "Sketches", set `start` to `2026-11-02` and `duration` to `5`. In "Mockup", only
   `duration` `10`.
4. Join "Sketches" → "Mockup" with **Dependency** (it comes first): "Mockup" starts the day after
   "Sketches" ends, without you typing its start.
5. Add a **Milestone** "Design approved" and join it from "Mockup" with another **Dependency**.
6. Fine-tune on the canvas: **drag a bar** horizontally to move its dates (in whole days), **drag its
   right edge** to change the duration and **drag a phase** to move everything it contains.
7. As work progresses, fill in `progress` and tick `critical` on the tasks that can't slip.

## Notation rules {#reglas}

- **Dependency** joins any combination of tasks, milestones and phases.
- **Nesting**: a **Phase** contains tasks, milestones and other phases. Nesting creates no relations, but
  the phase stretches to span everything it contains.
- No viewpoints.

## Import and export {#importar-exportar}

- **Mermaid** (`gantt`): phases export as `section`, FS dependencies as `after`, milestones as
  `milestone`, critical tasks as `crit` and progress as `done` or `active`.
- **Importing** a Mermaid `gantt` creates a Gantt view. Dependencies other than FS become explicit dates,
  with a warning.
- The view also exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Bars that aren't where you expect**: they come from `start`, `end` and `duration`, not from the
  position; check those fields or the dependency that sets the start.
- **End one day too late**: the end is the **last day** of the task, not the day after. A Monday-to-Friday
  task ends on Friday.
- **Typing every date by hand**: set the start of the first task and join the rest with dependencies;
  that way, if something slips, the tasks without their own start move with it.
- **Milestones with a duration**: if something takes days, it is a **Task**; a milestone is just a date.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref gantt -->
