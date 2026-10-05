# Simulation

Before you sign off a process or a state machine, you can **run it**: all-draw places tokens on the start events
(BPMN) or enters the initial state (state machine) and moves forward step by step, asking you whenever a decision is
needed. You quickly see whether there are branches that are never reached, joins that wait forever or loops with no
way out.

The simulation **only reads the model**: it works on a copy and changes nothing in the workspace, so you can also use
it in read-only workspaces.

## Opening the panel {#abrir}

1. Open a **BPMN** or **state machine** view.
2. Press **Simulate** in the top bar. The simulation panel opens to the right of the canvas.
3. Press **Start**.

The button only appears in views of those two notations. If you move to another BPMN or state machine view, the
simulation starts over there; in any other view the panel closes. Closing it returns the canvas to normal.

## Controls {#controles}

| Control | What it does |
|---|---|
| **Start / Restart** | Starts from scratch with the current variables. |
| **Step** | Moves a single thing forward: one token (BPMN) or the next timer (states). |
| **Run / Pause** | Steps at the chosen **speed** until it needs something from you, finishes or gets stuck. *Instant* does it all at once. |
| **Clear** | Removes the simulation from the canvas. |

On the canvas:

- **Green with a dot**: there is a token (BPMN) or it is the active state.
- **Amber with a pulsing dot**: it is waiting for something (a decision, a message, a timer, the other branches).
- **Red**: stuck.
- **Small faded dot**: already visited.
- **Arrows** taken in the last step are animated; the ones taken before stay coloured. With *reduce motion* turned on
  in your system there are no animations.

The **history** lists every step with its **simulated time** (`t = 5 min`). Click a line to select the element on the
canvas.

## BPMN processes {#bpmn}

| Element | How it is simulated |
|---|---|
| Start event | Gets a token when you start (the plain ones; if there are none, all of them). |
| Task, collapsed subprocess, call activity | The token enters and leaves when its **duration** is over (`duration` property, e.g. `5m`, `2h`, `PT30M`; 0 by default). Receive tasks wait for a message. |
| **Exclusive** gateway | Takes the first branch whose **condition** holds; otherwise the **default** branch; with no conditions, **it asks you**. |
| **Parallel** gateway | Splits into every branch; when joining, waits for one token per incoming flow. |
| **Inclusive** gateway | Takes every branch whose condition holds (or the default one); when joining, waits only for the branches that were activated. With no conditions, lets you pick one or more. |
| **Event-based** gateway | Waits for the first of its events: timers fire on their own, you trigger messages and signals. |
| Expanded subprocess | Creates a scope with its own tokens and leaves when they finish. If it is collapsed and has a detail view, that view is used. |
| Intermediate timer | Waits for its duration (*Timer* field); the simulated clock jumps to the deadline. |
| Intermediate message / signal | Wait until you press the message or signal button under **Available actions**. A signal throw wakes up everything waiting for it; drawn message flows deliver the message by themselves. |
| Conditional event | Waits until its condition holds (change the variables). |
| **Boundary** event | While the activity is running. **Interrupting** (default) cancels the activity and continues from the boundary; **non-interrupting** opens one more branch. Error and cancel are thrown by an end event inside the subprocess. |
| Event subprocess | Armed while its scope is alive (message, signal, timer, condition, error). |
| **Terminate** end | Stops every token (inside a subprocess, only that subprocess's tokens). |
| Uncaught error end | The simulation ends with *Uncaught error*. |

With **Wait at user and manual tasks** turned on, those tasks do not finish by themselves: press **Complete** on each
one. Handy for trying boundary events.

> [!TIP]
> To let a gateway decide on its own, write the condition on the outgoing flow (Inspector → *Condition*), for example
> `amount > 1000`, and mark another outgoing flow as *Default*.

## State machines {#estados}

The simulation follows the same semantics as **XState v5**, the one used by the XState JSON export:

- Compound states (entered through the **Initial** pseudostate, or the first child from top to bottom), **parallel
  regions** (all at once) and **final** states (a top-level final state ends the machine).
- Shallow (H) and deep (H\*) **history**: remembers where it was when leaving; if there is nothing to remember yet, it
  uses its default transition.
- **Choice**: its event-less transitions are evaluated in order; the `else` guard always holds.
- Transitions with **event**, **guard**, **actions** and **delay** (`after 5s`). With neither event nor delay, they are
  taken as soon as the guard holds.
- **Fork**, **Join** and **Terminate** are simulated too, even though XState does not have them.

**Available events** shows one button per event the active states are waiting for (disabled if no guard holds right
now). The **Executed actions** tab lists entry, exit and transition actions in the order they run.

Actions shaped like assignments change variables: `attempts = attempts + 1`, `total += amount`, `n++`.
`raise(EVENT)` sends an internal event. Any other action (`sendEmail`) is only logged.

## Variables and conditions {#variables}

The panel suggests the variables read by the model's conditions and guards. Type a value and press Enter: numbers
(`1500`), `true` / `false`, text or JSON (`["a", "b"]`). Add more with **new variable**.

Conditions are simple expressions, evaluated without running code:

| Write | Meaning |
|---|---|
| `amount > 1000 && country == "ES"` | comparison and "and" (also `and`) |
| `vip \|\| urgent`, `not approved` | "or" and "not" (`or`, `!`) |
| `customer.type == 'company'`, `items[0]` | fields and positions |
| `'vip' in tags`, `len(items) > 3` | membership and functions (`len`, `min`, `max`, `round`, `lower`, `contains`…) |
| `${amount > 100}` | Camunda's format works too |

## Deadlocks and loops {#bloqueos}

- **Stuck**: there are tokens that can never move on, for example a parallel join after an exclusive gateway. The
  panel tells you which branches are missing.
- **Loop with no way out**: the same state repeats without you doing anything (for example, a retry whose condition
  never changes). *Run* stops; change a variable or pick another branch to get out.
- **Model warnings**: when the panel opens it checks for unreadable timers, badly written conditions, boundary events
  with no activity and nodes from which no end can be reached.

See also: [BPMN](notaciones/bpmn.md), [State machine](notaciones/statechart.md), [Generate code](generar-codigo.md).
