# Análisis previo (2026-09-18)

Fuentes clonadas en `_research/` (no forman parte del proyecto): `diagramador`, `catalogo-corporativo-ti`, `archify` (tt-a1i), `archi` (archimatetool).

## 1. diagramador (Drawer) — draw.bezenti.com

React 19 + Vite + Zustand + React Router; backend opcional en Cloudflare Worker (Hono) con Durable Object SQLite. ~7.300 líneas de TS más `openapi.json` (4.300). Sin tests ni linter.

**Modelo** (`src/types.ts`): `Library { types: ComponentType[], components: Component[] }`, `ComponentType { fields: FieldDef[] }` con 10 `FieldKind` (text, textarea, number, select, checkbox, url, date, list, keyvalue, json), `Component { typeId, fields }`, `Diagram { layers, stages, stageGroups, placements, relations }`, `Placement { componentId, layerId, stageId, x, y, parentId, operationId, note }`, `Relation { from, to (placement ids), fromField?, toField?, style, dir, color, width, label }`, `Api { operations: ApiOperation[] }`, `Person/Assignment`, `StyleRule/Condition/RuleStyle`.

**Lo que ya resuelve bien y hay que conservar:**
- Separación definición/instancia: `Component` (catálogo) vs `Placement` (aparición en un diagrama). Mismo componente en N celdas, realce de clones, desvinculación explícita.
- Metamodelo abierto: tipos con campos definidos por el usuario, sin tocar código.
- Reglas de estilo desacopladas de la semántica (`lib/rules.ts`), con prioridad y ámbito por diagrama.
- Catálogo de APIs definido una vez y usado en N celdas eligiendo operación (`lib/api.ts`), con import/export OpenAPI.
- Reconocimiento de estructura JSON (`lib/schema.ts`: `jsonFields`, `connectableFields`) y relación campo→campo (`Relation.fromField/toField`). **Es el germen de los "pines".**
- Persistencia en 5 capas: localStorage, archivo `.drawer` (File System Access + IndexedDB para el handle), HTML de un solo archivo, PWA con service worker, sync con cuenta (flush antes de pull al volver la red).
- API REST completa + `agent.md` + `SKILL.md` para agentes.

**Lo que no sirve para el objetivo transversal:**
1. El lienzo es una única rejilla capa×etapa. `Placement` exige `layerId`+`stageId`; `x/y` son relativos a la celda. BPMN, máquinas de estado o C4 no encajan.
2. Capas y etapas son locales a cada diagrama: no hay dimensiones compartidas entre vistas.
3. `Relation` no tiene tipo semántico (solo estilo). Para BPMN/ArchiMate/C4 la relación es entidad de primera clase con reglas de validez.
4. No existe "vista", "viewpoint", ni enlace diagrama→diagrama (drill-down). Solo un listado de "dónde se usa".
5. Los pines son strings sin validación; una relación soporta un único par campo→campo; y **no funcionan sobre el catálogo de APIs** (el componente espejo tiene `typeId: null`, así que `connectableFields` devuelve vacío). Dos mecanismos de contrato de API que no se hablan.
6. Un solo blob global: undo = `JSON.stringify` de todo (80 snapshots), sin índices, búsquedas lineales.
7. Sync last-write-wins por documento, sin merge; un solo Durable Object para todos los usuarios.
8. Modelo duplicado cliente/servidor (`worker/index.ts` redefine los tipos) y `openapi.json` mantenido a mano.

**Bugs encontrados:** el modo archivo `.drawer` no guarda `apis` (`local.ts` omite el campo en `firma/fileText/parse`); `GET /diagrams/:id/export` del Worker tampoco devuelve `apis`.

## 2. catalogo-corporativo-ti

16 archivos, 1 commit. Cuatro listas de 500 nombres (`src/*.txt` con cabeceras `@@`) que `build.py` convierte a CSV/JSON/MD. Cada entrada tiene exactamente `{catalogo, n, categoria, nombre}`. **No hay ids estables, ni relaciones entre diagramas/procesos/documentos/ceremonias, ni gramática de ninguna notación.** ArchiMate aparece 0 veces en los diagramas (solo en prosa del README). 51 duplicados.

Valor real: diccionario de dominio y checklist de alcance. Los 10 niveles L0–L9 del README y la frase "cada elemento puede tener diagramas + documentos + procesos + roles + ceremonias + herramientas + métricas + controles" son la especificación en prosa del modelo que se quiere construir. Antes de usarlo como semilla hay que separar notaciones formales (~80–120 entradas) de "temas dibujados" (el resto).

## 3. archify (tt-a1i, MIT, 66k★)

Skill de agente: JSON spec → HTML autocontenido, validado. Node ≥18, cero dependencias de runtime. Cinco tipos: architecture, workflow (swimlanes), sequence, dataflow, lifecycle (máquina de estados). **No** es editor (viewer de solo lectura, no-goal explícito), **no** tiene auto-layout de grafos, **no** hace drill-down entre diagramas, **no** cubre BPMN ni ArchiMate. Sus "pines" son coordenadas geométricas fijas, no puertos con datos.

**Reutilizable (código MIT, puro, sin deps):**
- `archify/renderers/shared/geometry.mjs` (1.400 líneas): solapes, cruces, corredores ambiguos, clearance etiqueta↔ruta, puertos por lado con reparto determinista (`anchor`, port spread), `roundedPath`, y sugerencias de reparación calculadas. Sirve como linter de calidad en vivo para un editor.
- Contrato de diagnóstico `{code, severity, subject, evidence, supportedFixes[]}` con ruta anotada por id/label.
- Validadores JSON Schema precompilados con ajv standalone (validar offline sin cargar ajv).
- Test de autocontención offline (prohíbe cualquier subrecurso externo) y empaquetado por sentinelas con datos en `<script type="application/json">`.
- Export SVG dual-theme resolviendo variables CSS, y guardas de tamaño de canvas.
- Design system de diagramas técnicos (4 presets × light/dark) y perfil de calidad `standard|showcase`.
- Ojo: los 107 iconos de marca vienen de Simple Icons con licencias mixtas (Vue es NC-SA).

## 4. Archi / ArchiMate (MIT, Java/EMF)

Es la referencia de diseño más importante para el objetivo. Lecciones extraídas del metamodelo (`com.archimatetool.model/model/archimate.ecore`):

1. **Concepto ≠ objeto de diagrama.** Ni un píxel vive en el concepto. `DiagramModelArchimateObject` tiene `bounds`, color, fuente y una referencia `archimateElement`. Borrar de una vista no borra del modelo.
2. **Índice inverso** concepto → objetos de diagrama, mantenido en el modelo (`getReferencingDiagramComponents`).
3. **Las conexiones de diagrama unen objetos de diagrama; las relaciones semánticas unen conceptos.** Una misma relación se dibuja N veces con bendpoints distintos por vista.
4. **Las relaciones son conceptos** (id, propiedades, perfiles) y pueden ser origen/destino de otras relaciones.
5. **Matriz de relaciones válidas como datos** (`relationships.xml`, ~4.000 líneas, letras clave `acfginorstv`), cargada por `RelationshipsMatrix`.
6. **Viewpoints como filtros suaves** (`viewpoints.xml`): lista vacía = todo permitido, macros `$ApplicationElements$`, una arista solo si sus dos extremos están permitidos; atenúan, no prohíben.
7. **Properties (usuario) vs Features (aplicación)**: dos bolsas separadas; los defaults de features no se serializan.
8. **Profiles/specializations**: nombre + `conceptType` + imagen, declarados una vez y referenciados; no crean tipos nuevos.
9. **`DiagramModelReference`**: un nodo normal cuyo payload es otra vista (drill-down, vistas índice, subprocesos colapsados).
10. Todo con id estable, un solo documento con carpetas, versionado + capa de compatibilidad, todas las mutaciones por Commands (undo global y scripting).
11. Notaciones extra (Canvas, Sketch) como plugins que heredan los mixins base.
12. Archi **no tiene puertos**; `Connectable` es el punto de extensión natural.

## 5. Ecosistema (verificado el 2026-09-18)

- **Nadie hace lo que se pide** (multi-notación en web + drill-down + pines tipados + offline). Los más cercanos por concepto: Structurizr (modelo/vistas, `perspectives`), LikeC4 (predicados de vista, `navigateTo`, MIT, TS), Sirius Web (metamodelo + descripciones de vista, Java), Gaphor (fichero modelo + presentación por `subject`), Modelio (UML+BPMN+ArchiMate en un repositorio, GPL).
- **Canvas**: React Flow (MIT, handles con id = pines, `isValidConnection`, `parentId/extent` para contenedores) es la opción recomendada. tldraw es técnicamente superior pero de licencia propietaria. JointJS core (MPL) tiene ports y routers ortogonales. bpmn-js exige marca de agua; `bpmn-moddle` (MIT) sirve para leer/escribir el XML sin usar su editor.
- **Layout**: elkjs (EPL, jerarquía + puertos + hyperedges, en Web Worker) para lo general; dagre para lo simple; layouts ad hoc para secuencia y para la rejilla capa×etapa.
- **Local-first**: Yjs (MIT, y-indexeddb, `UndoManager`, awareness, servidores sobre Cloudflare Durable Objects) o Loro (MIT, MovableTree, time travel). Automerge 3 si se quiere historia tipo git.
- **Formatos**: BPMN 2.0 XML (`bpmn-moddle`), ArchiMate Open Exchange (XSD 3.1/3.2), Structurizr JSON, XState JSON / SCXML, draw.io XML, JSON Canvas (solo export), Mermaid/PlantUML/D2 (texto). ELK JSON como modelo de grafo con puertos.
