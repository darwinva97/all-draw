# Generate code

A well-made diagram already holds much of the code that comes after it. **Generate code** turns the model into
starter files: TypeScript or Java classes, the database's SQL schema, a ready-to-run XState machine, your APIs'
OpenAPI contract or a Structurizr workspace. The workspace does not change: the data is only read.

## How to use it {#como}

1. Open the view you want code for (for example, the class diagram).
2. **Import / Export → Generate code…**
3. Pick the **generator**. The ones that fit the open view come first; below them, those that work on the **whole
   workspace**.
4. Check the **preview** (with colours) and the **warnings**, if any.
5. **Copy** copies the file you are looking at. **Download** downloads the file or, when there are several, a
   **.zip** with all of them.

With a view open, the generator uses **only what appears in that view**; from *For the whole workspace*, everything in
its notation.

## Generators {#generadores}

| Generator | From | Produces |
|---|---|---|
| **TypeScript (UML classes)** | Class diagram | `src/model.ts` with enums, interfaces and classes (superclasses first). |
| **Java (UML classes)** | Class diagram | One file per class, interface or enum in `src/main/java/<package>/`. |
| **PostgreSQL SQL** / **SQLite SQL** | Entity-relationship | `schema.postgres.sql` / `schema.sqlite.sql`: tables, primary and foreign keys, indexes and views. |
| **XState machine** | State machine | `<name>.machine.ts`: a runnable **XState v5** machine with stubs for actions and guards. |
| **Transition table** | State machine | `<name>.transitions.md`: state, event, guard, target and actions, plus entries and exits. |
| **OpenAPI** | API library | One `openapi/<api>.yaml` (OpenAPI 3.1) per API, with operations, parameters and bodies. |
| **Structurizr DSL** | C4 or ArchiMate | `workspace.dsl` with the model, deployment and views. |

### UML classes → TypeScript and Java {#uml}

- **Attributes** and **operations** are read from each line of the compartment: `- name: String`,
  `+ total(): Decimal`, `# items: Line[*]`, `+ create(order: Order): void`. Visibility (`+ - # ~`), type, default
  value and multiplicity (`[*]`, `[0..1]`) are kept.
- Common types are translated (`String` → `string` / `String`, `int` → `number` / `int`, `Date` → `Date` /
  `LocalDateTime`, lists → `T[]` / `List<T>`). An unknown type is kept as is and produces a warning.
- **Generalization** → `extends`; **Realization** → `implements`. **Association**, **aggregation** and
  **composition** add a property on the navigable side with the end's **role** and **multiplicity**.
- Methods get a body that throws "not implemented", so the file compiles from the start.
- Names with spaces or accents become valid identifiers (with a warning).

### Entity-relationship → SQL {#sql}

- Each **entity** is a table (the *Physical table* field wins over the name) and each **attribute** a column, with its
  type translated for each database.
- The **primary key** comes from the *Primary key* field; if it is empty and there is an `id` column, that one is used.
- Relationships with **cardinality** create the foreign keys: the "many" side points to the "one" side; in 1:1, the
  target holds the foreign key with `UNIQUE`; N:M creates a link table. If the relationship joins attribute **pins**
  (column to column), those columns are used.
- `NULL` / `NOT NULL` follow the minimum cardinality (`0..1`, `0..*` allow nulls), `ON DELETE` follows *On delete*, and
  there is one index per foreign key.
- Tables are created in the right order; with circular references, PostgreSQL gets the foreign keys at the end with
  `ALTER TABLE`.

### State machine → XState {#xstate}

The configuration is the same as the **XState JSON** export (and the same semantics as the
[simulation](simulacion.md)). The file imports `setup` from `xstate`, declares one stub per action and guard (guards
return `true` and keep their original text in a comment) and exports the machine and the type of its events:

```ts
import { createActor } from 'xstate';
import { altaDeClienteEstadosMachine } from './alta-de-cliente-estados.machine';

const actor = createActor(altaDeClienteEstadosMachine).start();
actor.send({ type: 'datos completos' });
```

Install `xstate` in your project (`npm install xstate`) and replace the stubs with your logic.

### APIs → OpenAPI {#openapi}

It takes the **operations** in the API library (the ones you import from Drawer or OpenAPI, or define by hand):
method, path, summary, path, query and header parameters, request and response bodies, and response codes. Example
JSON bodies become a **schema** (inferred types) with the example included. The result can be imported back into
all-draw.

### C4 and ArchiMate → Structurizr DSL {#structurizr}

- **C4**: people, systems, containers and components nested as in the model, with technology, description and the
  `External` tag; relationships with description and technology; deployment nodes with instances; and one view per C4
  view (context, containers, components).
- **ArchiMate**: actors and roles → `person`, application components → `softwareSystem`, everything else → `element`
  with its ArchiMate type; relationships carry their type's name.

Open it with [Structurizr](https://structurizr.com) or Structurizr Lite.

## Warnings {#avisos}

When something has no exact translation (an unknown type, a table without a primary key, an operation without a path,
multiple inheritance…), the code is generated anyway and the **warnings** list explains what was decided. Fix the
model and generate again.

See also: [Import and export](importar-exportar.md), [Simulation](simulacion.md), [UML classes](notaciones/uml.md),
[Entity-relationship](notaciones/er.md).
