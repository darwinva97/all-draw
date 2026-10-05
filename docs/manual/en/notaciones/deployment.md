# Deployment (UML)

## What it is and when to use it {#que-es}

The UML deployment diagram shows **where the software runs**: the machines, devices and execution
environments (servers, containers, virtual machines, browsers), which artifacts (executables, images,
configuration files) are installed on each one, and how they communicate with each other.

Use it to document an infrastructure, prepare a cloud migration or explain to operations what has to be
installed and where. For the logical structure of the pieces, use the [component](component.md) diagram;
if you prefer a simpler notation, the deployment view of [C4](c4.md) covers the basics.

## Key elements {#elementos-clave}

| Element | Shape | What it represents |
|---|---|---|
| **Node** | 3D box | A computing resource: server, virtual machine, cluster. Fields `stereotype` («server», «cloud»…), `os` (operating system) and `instances` |
| **Device** | 3D box («device») | A physical node: server, phone, router, sensor. Field `stereotype` |
| **Execution environment** | 3D box («executionEnvironment») | Software that hosts artifacts: container, JVM, application server, browser. Fields `stereotype` and `technology` (`Docker 27`, `OpenJDK 21`, `Node 24`) |
| **Artifact** | Rectangle with the document icon | What gets deployed: executable, library, container image, script. Fields `fileName` and `version` |
| **Deployment specification** | Rectangle with the document icon («deployment spec») | The parameters an artifact is deployed with: ports, replicas, variables. Field `properties` (property → value pairs) |
| **Component** | Rectangle with the component icon | The logical component an artifact manifests; it is detailed in a [component](component.md) diagram |

Nodes, devices and execution environments **nest**: a server contains a Docker container that contains a
JVM that contains the `.jar`.

## Relations {#relaciones}

| Relation | Drawing | Meaning |
|---|---|---|
| **Communication path** | Solid line | Two nodes exchange messages. Field `protocol` (`HTTPS`, `JDBC`, `AMQP`, `gRPC`). It is the default relation |
| **Deploy** | Dashed with open arrow, labeled «deploy» | The artifact (source) is installed on the node (target). Equivalent to drawing it inside |
| **Manifestation** | Dashed with open arrow, labeled «manifest» | The artifact (source) is the physical form of the component (target) |
| **Dependency** | Dashed with open arrow | A deployment specification configures an artifact or a node, or an artifact needs another one. Optional `stereotype` («use», «configure»…) |

The canvas paints the «deploy» and «manifest» keywords by itself, from the relation type.

## Getting started {#como-empezar}

1. In the **Views** panel, press **＋** and choose **Deployment (UML)**. Or start from the **Deployment:
   cloud store** template on the home screen.
2. Drag a **Node** "Web server" (operating system *Debian 13*) and another **Node** "Database server".
3. Inside "Web server", drag an **Execution environment** "Docker" (technology *Docker 27*) and, inside it,
   an **Artifact** "store-api" (file `store-api:1.4.2`). Nesting it deploys it there, without creating any
   relation.
4. Join the two servers with **Communication path** (it comes first) and set the protocol to `JDBC`.
5. Add a **Component** "Store API" outside the nodes and join it from "store-api" with
   **Manifestation**.
6. Add a **Deployment specification** "store-api.env" with the properties `PORT → 8080` and
   `REPLICAS → 2`, and join it to the artifact with **Dependency**.

## Notation rules {#reglas}

- **Communication path** only between nodes, devices and execution environments (in any combination).
- **Deploy**: from an artifact or a deployment specification to a node, device or environment.
- **Manifestation**: only from an artifact to a component.
- **Dependency**: from a deployment specification to an artifact or a node, or between artifacts.
- **Nesting**: a node or a device contains nodes, devices, environments, artifacts, specifications and
  components; an execution environment contains other environments, artifacts, specifications and
  components (not nodes or devices). Nesting creates no relations.
- No viewpoints.

## Import and export {#importar-exportar}

- Mermaid has no deployment diagram: **Mermaid** exports the view as a generic `flowchart` of boxes and
  arrows, with a warning.
- The view exports to **SVG**, **PNG**, **draw.io** and **self-contained HTML**. See the
  [format table](../importar-exportar.md#formatos).

## Common mistakes {#errores-comunes}

- **Drawing it inside and also joining it with «deploy»**: both say the same thing; pick one. Nesting is
  usually clearer.
- **Putting a server inside a Docker container**: an execution environment can't contain nodes or
  devices; the hierarchy goes from hardware to software.
- **Repeating the node for every replica**: use the `instances` field instead of drawing ten identical
  servers.
- **Communication paths without a protocol**: fill in `protocol`; it is the first thing whoever runs the
  system will ask.

## Full reference {#referencia}

The complete list of types, relations, validity matrix and viewpoints is generated from the pack itself:

<!-- docs:notation-ref deployment -->
