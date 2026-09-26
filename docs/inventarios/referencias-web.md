# Inventario: bpmn.io, draw.io, LikeC4, Structurizr, Excalidraw, Enterprise Architect, Modelio, Stately, Miro, Lucidchart

Informe completo. Primero, lo que falló o difiere de lo pedido; después los diez inventarios y la tabla transversal.

**Incidencias de fuentes**
- bpmn.io: `bpmn.io/toolkit/` y las páginas de Camunda `desktop-modeler/` y `desktop-modeler/overview/` dan 404; usé `bpmn.io/toolkit/bpmn-js/`, el walkthrough, `bpmn.io/license`, el código fuente de `bpmn-io/*` vía `gh api` y los `.md` de `camunda/camunda-docs`. La lista "cmmn-js" no aparece: está archivada.
- draw.io: la doc vive en `drawio.com/docs/…`, no en `/doc/…`; precios de Confluence/Jira no renderizan sin JS.
- LikeC4: varias URLs `/dsl/*` no existen; se leyeron los `.mdx` fuente y la gramática Langium.
- Structurizr: `structurizr/docs`, `/export`, `/dsl` en GitHub han desaparecido (todo está en el monorepo `structurizr/structurizr`); no existe exportador a draw.io ni Excalidraw (grep sobre el monorepo).
- Miro, Lucid, Sparx: 403 de Cloudflare; se salvó con el proxy `r.jina.ai`, OpenAPI oficial de Miro, tipos npm del Web SDK, `lucid.readme.io/llms.txt` y `sparxsystems.us`. Modeliosoft redirige a Docaposte sin catálogo de precios.
- Stately: `/docs/scxml`, `/docs/agents` 404; se leyó el fuente MDX de `statelyai/docs`.

Leyenda: **[V]** verificado en fuente esta sesión · **[V-snip]** visto solo en extracto de búsqueda de fuente oficial · **[M]** de memoria.

---

# 1. bpmn.io (bpmn-js, dmn-js, form-js)

**Versiones** [V gh releases]: bpmn-js v18.28.0 (2026-09-04), dmn-js v17.8.0 (2026-04-23), form-js v2.0.0 (2026-09-18), bpmnlint v11.14.0, Camunda Modeler v5.51.1. dmn-js solo lee/escribe DMN 1.3 (migrar con `dmn-migrate`) [V README].

**Arquitectura** [V walkthrough]: `diagram-js` (canvas SVG, EventBus, ElementFactory, ElementRegistry, GraphicsFactory, CommandStack undo/redo, Overlays, Modeling, Palette, ContextPad; DI con `didi`) + `bpmn-moddle` (metamodelo BPMN 2.0, `fromXML`/`toXML`, validación) + `bpmn-js` (BpmnRenderer, BpmnRules, BpmnUpdater). Variantes `Viewer`, `NavigatedViewer`, `Modeler`. Cada shape expone `businessObject`.

## (a) Notaciones
BPMN 2.0 (bpmn-js), DMN 1.3 DRD + decision tables + literal expressions + boxed expressions (dmn-js, paquetes `dmn-js-drd`, `dmn-js-decision-table`, `dmn-js-literal-expression`, `dmn-js-boxed-expression`) [V], formularios JSON (form-js viewer/editor/playground) [V], FEEL (`feelin`, `feel-editor`, `lang-feel`, `lezer-feel`, `feel-lint`) [V lista de repos]. CMMN: repo `cmmn-js` archivado [V ausencia en repos no archivados].

## (b) Elementos y relaciones
**Metamodelo bpmn-moddle: 137 tipos** [V `bpmn.json`]: Activity, AdHocSubProcess, Artifact, Assignment, Association, Auditing, BaseElement, BoundaryEvent, BusinessRuleTask, CallActivity, CallChoreography, CallConversation, CallableElement, CancelEventDefinition, CatchEvent, Category, CategoryValue, Choreography, ChoreographyActivity, ChoreographyTask, Collaboration, CompensateEventDefinition, ComplexBehaviorDefinition, ComplexGateway, ConditionalEventDefinition, Conversation, ConversationAssociation, ConversationLink, ConversationNode, CorrelationKey, CorrelationProperty, CorrelationPropertyBinding, CorrelationPropertyRetrievalExpression, CorrelationSubscription, DataAssociation, DataInput, DataInputAssociation, DataObject, DataObjectReference, DataOutput, DataOutputAssociation, DataState, DataStore, DataStoreReference, Definitions, Documentation, EndEvent, EndPoint, Error, ErrorEventDefinition, Escalation, EscalationEventDefinition, Event, EventBasedGateway, EventDefinition, ExclusiveGateway, Expression, Extension, ExtensionAttributeDefinition, ExtensionDefinition, ExtensionElements, FlowElement, FlowElementsContainer, FlowNode, FormalExpression, Gateway, GlobalBusinessRuleTask, GlobalChoreographyTask, GlobalConversation, GlobalManualTask, GlobalScriptTask, GlobalTask, GlobalUserTask, Group, HumanPerformer, ImplicitThrowEvent, Import, InclusiveGateway, InputOutputBinding, InputOutputSpecification, InputSet, InteractionNode, Interface, IntermediateCatchEvent, IntermediateThrowEvent, ItemAwareElement, ItemDefinition, Lane, LaneSet, LinkEventDefinition, LoopCharacteristics, ManualTask, Message, MessageEventDefinition, MessageFlow, MessageFlowAssociation, Monitoring, MultiInstanceLoopCharacteristics, Operation, OutputSet, ParallelGateway, Participant, ParticipantAssociation, ParticipantMultiplicity, PartnerEntity, PartnerRole, Performer, PotentialOwner, Process, Property, ReceiveTask, Relationship, Rendering, Resource, ResourceAssignmentExpression, ResourceParameter, ResourceParameterBinding, ResourceRole, RootElement, ScriptTask, SendTask, SequenceFlow, ServiceTask, Signal, SignalEventDefinition, StandardLoopCharacteristics, StartEvent, SubChoreography, SubConversation, SubProcess, Task, TerminateEventDefinition, TextAnnotation, ThrowEvent, TimerEventDefinition, Transaction, UserTask.

**Tipos que renderiza BpmnRenderer (53)** [V]: Activity, AdHocSubProcess, Association, BaseElement, BoundaryEvent, BusinessRuleTask, CallActivity, CancelEventDefinition, CompensateEventDefinition, ComplexGateway, ConditionalEventDefinition, DataInput, DataInputAssociation, DataObject, DataObjectReference, DataOutput, DataOutputAssociation, DataStoreReference, EndEvent, ErrorEventDefinition, EscalationEventDefinition, Event, EventBasedGateway, ExclusiveGateway, Gateway, Group, InclusiveGateway, IntermediateCatchEvent, IntermediateEvent, IntermediateThrowEvent, Lane, LinkEventDefinition, ManualTask, MessageEventDefinition, MessageFlow, MultipleEventDefinition, ParallelGateway, ParallelMultipleEventDefinition, Participant, ReceiveTask, ScriptTask, SendTask, SequenceFlow, ServiceTask, SignalEventDefinition, StartEvent, SubProcess, Task, TerminateEventDefinition, TextAnnotation, TimerEventDefinition, Transaction, UserTask. **No modelables**: Choreography, Conversation (solo en metamodelo).

**Catálogo del replace menu (`PopupEntries`, 75 entradas)** [V `lib/features/popup-menu/PopupEntries.js`]:
- Actividades (15): task, user-task, service-task, send-task, receive-task, manual-task, rule-task (business rule), script-task, call-activity, transaction, event-subprocess, collapsed-subprocess, expanded-subprocess, collapsed-ad-hoc-subprocess, expanded-ad-hoc-subprocess.
- Gateways (5): exclusive, parallel, inclusive, complex, event-based (+ variantes "Event based instantiating" y "Parallel event based instantiating").
- Datos (2): data-store-reference, data-object-reference. Pools (2): expanded-pool, collapsed-pool.
- Start (5 + 7 en event sub-process): none, message, timer, conditional, signal; en event subprocess además error, escalation, compensation y no-interruptores message/timer/conditional/signal/escalation.
- Intermedios (11): none-throwing, message catch/throw, timer catch, escalation throw, conditional catch, link catch/throw, compensation throw, signal catch/throw.
- Boundary (14): none, message, timer, escalation, conditional, error, cancel, signal, compensation + non-interrupting message/timer/escalation/conditional/signal.
- End (8): none, message, escalation, error, cancel, compensation, signal, terminate.
- Flujos: sequence flow, default flow, conditional flow [V ReplaceOptions].
- Toggles en el menú [V ReplaceMenuProvider]: toggle-loop, toggle-parallel-mi, toggle-sequential-mi, toggle-non-interrupting, toggle-is-collection, toggle-participant-multiplicity; iconos loop/parallel-mi/sequential-mi markers. Ad-hoc, compensación (`isForCompensation`) vía properties panel [M].
- Grupo (Group con CategoryValue, tag visual 18.23) [V changelog], TextAnnotation, Association, MessageFlow, DataInput/OutputAssociation, Lane (split/insert), Participant.

**Paleta (`PaletteProvider`)** [V]: hand-tool, lasso-tool, space-tool, global-connect-tool, create.start-event, create.intermediate-event, create.end-event, create.exclusive-gateway, create.task, create.data-object, create.data-store, create.subprocess-expanded, create.participant-expanded, create.group. **Context pad** [V]: append.append-task, append.gateway, append.intermediate-event, append.end-event, append.text-annotation, append.receive-task, append.message/timer/signal/condition-intermediate-event, append.compensation-activity, connect, replace, delete, lane-insert-above/below, lane-divide-two/three, create.end; desde 18.13 crear hijos desde el context pad. `bpmn-js-create-append-anything` añade "crear/anexar cualquier cosa" con teclas N y A y element templates [V].

**Reglas de conexión (`BpmnRules`)** [V]: reglas `connection.create`, `connection.reconnect`, `connection.start`, `connection.updateWaypoints`, `element.copy`, `elements.create`, `elements.move`, `shape.attach`, `shape.create`, `shape.resize`; funciones canConnectSequenceFlow, canConnectMessageFlow, canConnectAssociation, canConnectDataAssociation, canConnectCompensationAssociation, canAttach (boundary a host), canDrop, canInsert, canReplace, canResize, isSameScope/isSameOrganization, isReceiveTaskAfterEventBasedGateway, etc. Cobertura de motor Camunda 8 vs modeler: pool/lane, transaction, complex gateway, loop marker, data, cancel, multiple: solo modelado [V bpmn-coverage, inferido del markup].

## (c) Edición del canvas
Módulos `lib/features` de bpmn-js [V]: align-elements, append-preview, auto-place, auto-resize, context-pad, copy-paste, di-ordering, distribute-elements, drilldown, editor-actions, grid-snapping, interaction-events, keyboard, label-editing, label-link, modeling-feedback, modeling, ordering, outline, palette, popup-menu, replace-preview, replace, rules, search, snapping, space-tool. De diagram-js además [V]: attach-support, auto-scroll, bendpoints, change-support, clipboard, complex-preview, connect, connection-preview, create, dragging, global-connect, hand-tool, hover-fix, hover-tooltip, keep-selection-visible, keyboard-move-selection, lasso-tool, mouse, move, overlays, preview-support, resize, root-elements, scheduler, search-pad, selection, tool-manager, tooltips.
- Operaciones de modeling [V]: moveShape, moveElements, moveConnection, layoutConnection, createConnection/Shape/Elements/Label, appendShape, removeElements, distributeElements, alignElements, replaceShape, resizeShape, createSpace, updateWaypoints, reconnect/Start/End, toggleCollapse; BPMN: updateLabel, updateProperties, updateModdleProperties, resizeLane, addLane, splitLane, makeCollaboration, makeProcess, setColor, claimId/unclaimId.
- Editor actions [V]: undo, redo, copy, paste, cut, duplicate, stepZoom, zoom, removeSelection, selectElements, spaceTool, lassoTool, handTool, globalConnectTool, directEditing, find (search pad), moveToOrigin, alignElements, distributeElements, setColor, replaceElement. Atajos [V keyboard bindings]: Ctrl+Z/Y, Ctrl+C/V/X, Ctrl+D, Ctrl +/-/0, Supr, A (align), C (color), E (direct edit), F (find), H (hand), L (lasso), R (replace), S (space) [teclas listadas en BpmnKeyboardBindings].
- Minimap: `diagram-js-minimap` (viewport, clic/drag/scroll) [V README]; grid: `diagram-js-grid`; origen: `diagram-js-origin`.
- Color: `setColor` nativo (fill/stroke serializados como `bioc:`/`color:` según "BPMN in Color"), `bpmn-js-color-picker` en context pad, `bpmn-in-color-moddle` [V].
- Search pad con búsqueda por nombre/id y ranking (18.14) [V]; popup menu con búsqueda, tabs (18.24), navegación multi-paso, entradas deshabilitadas, accesibilidad ARIA [V changelog].
- Labels externas redimensionables (18.16), enlace visual label-target (18.9), direct editing completa en blur [V]. Token `--accent-color` para theming (18.26) [V].
- Copy/paste entre instancias con `bpmn-js-native-copy-paste` [V awesome]; `bpmn-js-copy-as-image` [V repos].
- Accesibilidad: proyecto `a11y`, `bpmn-js-rtl-example` [V repos].

## (d) Modelo / vistas / navegación
- Un documento = un `bpmn:Definitions` con colaboración o proceso; no hay separación modelo/vista más allá de DI (BPMNShape/BPMNEdge/BPMNLabel) [V].
- **Drilldown** en subprocesos colapsados: módulo `drilldown` con DrilldownBreadcrumbs, DrilldownCentering, DrilldownOverlayBehavior, SubprocessCompatibility (planos BPMNDiagram separados) [V]. `bpmn-js-disable-collapsed-subprocess` / `bpmn-js-collapse-subprocess` [V awesome].
- Deep linking, overlays, url-viewer, `Canvas#scrollToElement` múltiple, `findRoot` [V ejemplos + changelog].
- Camunda Modeler: multi-diagram por fichero (plugin comunitario), Navigator plugin, Process landscape visualization (Web Modeler) [V].

## (e) Datos por elemento
- Atributos del metamodelo (id, name, documentation, extensionElements, propiedades Camunda 7/8 con `camunda-bpmn-moddle`/`zeebe-bpmn-moddle`) [V props-panel README + M para moddle].
- **Properties panel** (`bpmn-js-properties-panel` sobre `@bpmn-io/properties-panel`): ids, multi-instance, propiedades técnicas Camunda 7/8, undo/redo integrado; extensible (ejemplos properties-panel-extension, -list-extension, -async-extension, React panel) [V].
- **Element templates** (JSON Schema tipado: bindings a propiedades, tipos String/Text/Boolean/Dropdown/Hidden, constraints, iconos): `element-templates`, `bpmn-js-element-templates`, `element-templates-validator`, `element-template-chooser`, `element-template-icon-renderer`, `element-templates-cli` [V repos]. **Es el mecanismo de propiedades tipadas.**
- Moddle extensions (custom-meta-model, model-extension) para atributos propios validados [V ejemplos].
- Comentarios embebidos en `bpmn:documentation textFormat="text/x-comments"` (`bpmn-js-embedded-comments`) [V].
- Variables: `extract-process-variables`, `variable-resolver`, `variable-outline` [V repos].

## (f) Estilos / temas
Renderer sustituible (custom-rendering, `bpmn-js-nyan`, `bpmn-js-sketchy` estilo mano alzada, `bpmn-js-task-priorities`) [V]; colores por elemento; CSS variables (`--accent-color`), ejemplo `theming`; `bpmn-font` de símbolos; tema Dracula plugin comunitario [V].

## (g) Layout automático
`bpmn-auto-layout`: genera DI completo desde BPMN XML sin/con DI, procesos y colaboraciones, Node ≥ 22.12 y browser [V README]. `auto-place` coloca el siguiente elemento al anexar [V]. `align-to-origin` [V]. Sin re-layout general interactivo en el modeler [V ausencia].

## (h) Import / export
Import/export BPMN 2.0 XML (`importXML`, `saveXML`, `saveSVG`) [V]; `bpmn-to-image` CLI → PNG/SVG/PDF (opciones title, footer, scale, min-dimensions) [V]; `bpmn-js-headless`; `bpmn-to-visio` (.vsdx) [V awesome]; `add-exporter` metadata; DMN XML 1.3 + `dmn-migrate(-cli)`; form-js schema JSON; `graphml-moddle` [V]; conformidad BPMN MIWG test suite [V repos]. Camunda Modeler: deploy/start instance, export imagen [V docs].

## (i) Colaboración / offline / persistencia
Librería sin backend; ficheros locales. Camunda Desktop Modeler (Electron, MIT, Win/Linux/macOS): trabajo con sistema de ficheros local, offline [V]. Camunda Web Modeler [V docs collaboration]: edición en tiempo real con **canvas lock** ("Take over"), presencia, attention grabber, comentarios por elemento con @menciones, roles Project Admin/Editor/Commenter/Viewer, enlaces solo lectura con contraseña, iframe embed, **versiones** (antes milestones: crear, comparar visual y XML, restaurar, copiar), Git sync, process applications, Play mode, marketplace, IDP [V]. Otras apps: Cawemo, STORMBPMN, Duckflow, Miragon VS Code, Obsidian plugin, bpmn-diff-bitbucket [V awesome]. `vs-code-bpmn-io` (ver/editar, undo) [V].

## (j) Automatización
API JS completa (modeling, elementRegistry, eventBus…); `bpmn-js-cli` (modelar sin ratón); `bpmn-js-differ` (diff semántico) y `bpmn-js-diffing` visual; `dmn-js-differ`; `bpmn-to-image` CLI; `bpmnlint` CLI/browser con **27 reglas** [V]: ad-hoc-sub-process, conditional-event, conditional-flows, end-event-required, event-based-gateway, event-sub-process-typed-start-event, fake-join, global, label-required, link-event, no-bpmndi, no-complex-gateway, no-disconnected, no-duplicate-sequence-flows, no-gateway-join-fork, no-implicit-end, no-implicit-split, no-implicit-start, no-inclusive-gateway, no-overlapping-elements, single-blank-start-event, single-event-definition, standard-size, start-event-required, sub-process-blank-start-event, superfluous-gateway, superfluous-label, superfluous-termination; plugins custom (`bpmnlint-plugin-example`), `bpmn-js-bpmnlint`, `dmnlint`. **Token simulation** (`bpmn-js-token-simulation`, conforme a la spec, modeler y viewer) [V]. `dmn-js-simulation`, `dmn-testing-plugin` [V]. IA: **BPMN Copilot** (Camunda SaaS alpha, generar/explicar/modificar diagramas ≤ 400 KB, solo diagramas creados por él) y FEEL Copilot [V camunda-docs]. MCP: no hay servidor MCP oficial de bpmn.io [V ausencia en repos]. React/Vue/Svelte/Angular/JupyterLab/Slidev wrappers [V].

## (k) Extensibilidad
`additionalModules` (módulos didi con `__depends__`/`__init__`), moddle extensions, custom rules, custom palette/context pad, custom renderer, custom elements (dentro y fuera de BPMN), custom bundle, i18n (`bpmn-js-i18n`), `boilerplate-extension`, `generator-diagram-js` [V]. Camunda Modeler plugins: menu entries, custom styles, React components, bpmn-js modules, bpmn-moddle ext., dmn-js modules, dmn-moddle ext., bpmnlint plugins (API "not stable") [V]; ~20 plugins comunitarios listados (autosave, i18n, multi-diagram, dracula, navigator, resize tasks, color picker, reduced palette, token simulation, tooltips, data outline…) [V].

## (l) Licencia y precio
**bpmn.io License** (MIT-like con cláusula de watermark obligatoria e inamovible; uso comercial permitido; sin plan de pago para quitarla) para bpmn-js, dmn-js, form-js [V]. Extensiones (minimap, color-picker, token-simulation, comments…) MIT [V]. Camunda Modeler MIT [V]. Camunda: Development self-managed gratis; Production y SaaS "talk to sales"; tras 30 días de trial queda cuenta gratuita limitada a modelado BPMN/DMN; Web Modeler solo en Production/SaaS [V pricing].

---

# 2. draw.io / diagrams.net

**Versión** web v31.4.6 (2026-09-16), desktop v31.4.5 [V].

## (a) Tipos de diagrama
Catálogo oficial [V /docs/diagram-types/]: AWS, Azure, BPMN 2.0, C4, charts, circular flowcharts, Citrix, concept maps, cross-functional flowcharts, DFD, dependency graphs, P&ID, ER, floorplans, Gantt, Gitflow, home lab, Ishikawa, Kanban, 5C/SWOT/PEST, network, org charts, risk, rack, requirements, RACI, Salesforce, Sankey, SAP, sentence trees, story mapping, fórmulas químicas, swimlanes, SysML, T-charts, threat modelling, timelines/roadmaps, trees, UML (use case, class, sequence, component, activity, state, communication, package, profile, timing; composite/deployment vía blog UML 2.5), Veeam, Venn. Además ArchiMate 3/4, mindmaps, wireframes, infografías, VSM, sitemaps, circuitos, fluid power, Kubernetes, tablas, BMC, PERT, WBS [V templates + Sidebar]. Plantillas: 15 secciones (basic 10, business 15, charts 6, cloud 41, engineering 3, flowcharts 9, layout 4, maps 5, network 13, other 12, software 12, tables 4, uml 8, venn 8, wireframes 5), CC-BY 4.0 [V].

## (b) Shape libraries
Stencils XML del repo [V]: alibaba_cloud, android, arrows, atlassian, atlassian2, aws (11), aws2 (18), aws3, aws3d, aws4, azure, basic, bootstrap, bpmn, cabinets, cisco (14), cisco19, cisco_safe (9), citrix, citrix2, clipart, eip, electrical (24), floorplan, flowchart, fluid_power, gcp (10), gcp2, gcp3, gmdl, ibm, ibm_cloud, ios7, kubernetes, kubernetes2, lean_mapping, mockup (9), mscae (11), networks, networks2, office (10), openstack, pid (25), rack (9), salesforce, signs (11), sitemap, veeam (4), vvd, webicons, weblogos. Shapes JS [V]: bpmn, emoji, er, ios7, mockup, pid2, rack, mxAWS3D, mxAWS4, mxAndroid, mxArchiMate, mxArchiMate3, mxArchiMate4, mxArrows, mxAtlassian(2), mxBasic, mxBootstrap, mxC4, mxCabinets, mxCisco19, mxCiscoSafe, mxDFD, mxEip, mxElectrical, mxFloorplan, mxFlowchart, mxGCP2, mxGmdl, mxIBM, mxInfographic, mxKubernetes, mxLeanMap, mxNetworks(2), mxSAP, mxSysML, mxUML25. img/lib: active_directory, allied_telesis, atlassian, azure2, clip_art, cumulus, dynamics365, ibm, mscae, sap. IDs de sidebar (76) [V]: general, uml, uml25, er, alibaba_cloud, azure2, dynamics365, ios, android, aws3d, flowchart, basic, infographic, arrows, arrows2, lean_mapping, citrix, azure, network, network2, vvd, sitemap, dfd, threatModeling, citrix2, mscae, active_directory, bpmn2, clipart, ibm, ibm_cloud, allied_telesis, cumulus, eip, mockups, pid2, salesforce, signs, gcp, gcp2, gcp3, gcpicons, rack, electrical, aws2, aws3, aws4b, sap, aws4, aws4r, pid, cisco, cisco_safe, office, openstack, veeam, veeam2, cabinets, floorplan, bootstrap, atlassian, atlassian2, fluid_power, gmdl, archimate4, archimate3, archimate, webicons, sysml, c4, kubernetes. Externas (jgraph/drawio-libs): azure integration (23), fortinet (18) [V]. >10.000 formas indexadas + icon service [V].

## (c) Edición del canvas
Arrange: align 6, distribute H/V, z-order 4, group/ungroup/enter/exit, rotate/turn, flip, autosize, match size, copy/paste size, lock, collapse/expand [V]. Find/Replace (labels, tags, tooltips, propiedades, regex, todas las páginas) + omnibox [V]. Conectores: floating vs fixed points, Edit Connection Points, waypoints add/remove/clear, snap to point; edge styles straight/orthogonal/simple/isometric/curved/ER, sharp/rounded/curved, pattern solid/dashed/dotted, line jumps (arc/gap/sharp), puntas classic/block/open/oval/diamond (+thin) + ER/UML [V+M], flow animation [V]. Sketch (rough.js; Jiggle, Fill Weight, Hachure Gap/Angle, ZigZag) [V]. Dark mode/high contrast/adaptive colors [V]. MathJax ($$, \(…\), AsciiMath) [V]. Layers (add/dup/rename/delete/hide/lock/reorder) [V]. Freehand y Polygon [V]. Undo/redo; clipboard interno/nativo, copy as image, copy/paste style/size/data [V]. Atajos configurables (`keyboardShortcuts`), 23 atajos con modificador+ratón [V]. Grid, guías, ruler, page view/infinite, background image, units [V]. Containers con folding, swimlanes, tablas (merge, filas/columnas, tabla contenedora) [V]. Imágenes: URL/drag, edit image, edit SVG colors/CSS vars [V]. Spell check, Outline, Fullscreen, Explore, Move area, Waypoint shape, Enumerate, Edit Geometry [V].

## (d) Modelo / vistas / navegación
Sin separación modelo/vista (una celda = una forma). Páginas múltiples (add/dup/rename/reorder/delete; links se actualizan) [V]. Links (Ctrl+K) a URL, página (`data:page/id,…`) o acción JSON [V]. Acciones/animación [V]: show, hide, toggle, fadeIn/Out, style, toggleStyle, highlight, scroll, viewbox, open, tags, wait, explore, opacity, fade, wipe, pop, flow, select; selectores cells/layers/tags/tagsMatch/descendants; animación de página con steps/loop. Collapsible containers, tree folding, `nav=1` [V]. Tooltips por propiedad/metadatos [V]. Viewer/lightbox (`chrome=0`, `lightbox=1`, layers, tags, toolbar), Presentation Mode, Explore radial [V].

## (e) Datos por elemento
Edit Data (Ctrl+M): pares nombre/valor **sin tipado**, ID editable, `tooltip` predefinido; herencia forma←contenedor←página←archivo; vars globales URL/config [V]. Placeholders `%name%` + predefinidos id/width/height/length/date/time/timestamp/pagenumber/pagecount/page/filename (+Confluence version/creator/modifier) [V]. Tags múltiples con show/hide/select [V]. Propiedades booleanas de estilo (container, collapsible, resizable, connectable, locked, treeFolding, placeholders, part, pointerEvents, autosize, dropTarget, childLayout, portConstraint, recursiveResize, snapToPoint, orthogonal, noJump, comic, sketch…) [V]. Export JSON/SVG con metadata [V].

## (f) Estilos / temas
Style string `k=v;` editable, Edit Style, copy/paste style, default style, estilos globales [V]. Fill/gradient/glass/lanecolour, line, opacity, rounded, shadow, sketch; texto (fuentes sistema/Google/custom, HTML parcial, dirección, spacing) [V]. `compressStyles` [V]. UI themes: Classic/Kennedy, Atlas, Simple, Minimal, Sketch, dark; Appearance auto/light/dark/high contrast [V]. Configuración (~100 claves): defaultFonts, customFonts, presetColors, defaultColorSchemes, defaultVertexStyle/EdgeStyle/TextStyle, styles, libraries, templateFile, css, darkColor, hideMenus, keyboardShortcuts, lockdown… [V].

## (g) Layout automático
Menú Arrange > Layout [V]: Horizontal/Vertical Flow, Horizontal/Vertical Tree, Radial Tree, Organic, Circle, Org Chart (linear/hanger/fishbone/single column/smart), Parallels, Orthogonal Routing (libavoid WASM), Custom (JSON), Legacy. Motores: ELK (layered, tree, radial, organic, stress, disco, box), mxGraph (hierarchical, circle, compactTree, edgeLabel, fastOrganic, parallelEdge, partition, radialTree, stack, orgChart) [V]. Layout shapes vivos (tree, flow, mindmap, org chart, Tree Container; `childLayout` stack/table/tree) [V]. WebCola deprecated [V].

## (h) Import / export
Import [V]: .drawio/.xml, .png/.svg/.jpeg/.gif (con XML embebido), .vsdx nativo, .vsd (online), .vss/.vssx → library, Gliffy, Lucidchart (Dry Run), Miro (código presente), GraphML/EMF (carpetas), Mermaid (28 tipos; editable como formas nativas desde jul-2026), PlantUML (menú Advanced, servidor) [V+M], CSV con directivas (label, style, identity, parent, connect, layout…), SQL DDL → ER, From Text, Generate (IA). No .odg. Export [V]: PNG (XML embebido, transparente), JPEG, WebP, SVG (links, fuentes embebidas, dark/light/auto), GIF animado, PDF (server o Print), HTML, XML, JSON (topología para LLMs), URL, VSDX [M]; Publish/Embed HTML/IFrame/SVG/Link, Presentation Mode. Guardado nativo .drawio/.png/.svg/.html [V].

## (i) Colaboración / offline / persistencia
Storage: Google Drive, OneDrive/SharePoint, Dropbox, GitHub, GitLab, Trello, Nextcloud, dispositivo, navegador (IndexedDB), URL [V]. **Tiempo real con cursores**: Drive, OneDrive, Confluence Cloud, Nextcloud; Dropbox/GitHub/GitLab no [V]. Comentarios: Drive y Confluence [V]. Revision history: Drive (100), Dropbox, Confluence [V]. Autosave + conflict handling [V]. Offline: PWA, Desktop Electron (Win/macOS/Linux; sin red salvo updates; sin nube/IA/fonts), Docker `jgraph/drawio`, modos stealth/lockdown/zero-egress [V]. Integraciones: Confluence/Jira (Cloud Forge, DC), SharePoint, Office 365, Google Workspace, Notion, Nextcloud, VS Code (hediet), WordPress, Monday, Lark, y ~15 terceros [V].

## (j) Automatización
Embed mode postMessage (`embed=1`, `proto=json`): eventos configure/init/load/autosave/save/exit/export/openLink/…; acciones load (xml/png/svg/vsdx/lucid/gliffy/csv/mermaid + layout), merge, patch, getDiff, dialog, prompt, template, layout, export (xml/json/svg/png/html…), fit, viewbox, invokeAction… [V]. ~120 URL params + hash `#G #W #T #D #H #A #L #U #R #P #_CONFIG_ #S`, `#create` con xml/csv/mermaid/generate [V]. CLI desktop: `-x --export`, `-f` (pdf/png/jpg/svg/vsdx/xml), `--layout`, `-a`, `-p`, `-l`, `-g`, `-s`, `-t`, `-e`, `--embed-svg-images/fonts`, `--theme`, `--html-*`, `-u`, `-c --create`, `-k --check` [V]. mxGraph API interna accesible desde plugins (`ui.editor.graph`) [V]. IA: Generate con OpenAI/Claude/Gemini/self-hosted, BYOK, chats, adjuntos [V]. **MCP**: hosted `https://mcp.draw.io/mcp` (`create_diagram`, `search_shapes`) y npm `@drawio/mcp` (`open_drawio_xml/csv/mermaid`, `search_shapes`, `list_pages`, `get_page`, `set_page`; postLayout elk, libavoid) + plugins Claude Code/Codex/Copilot CLI [V].

## (k) Extensibilidad
Plugins repo [V]: animation, anonymize, edgeConnection, explore, flow, import, nextcloud, number, page, props, rackF5, random, replay, sql, svgdata, tags, text, tooltips, trees, trello, update, webcola (deprecated); no funcionan en Desktop/Confluence; `voice`/`tickets` no existen [V]. Custom shapes: Edit Shape con stencil XML (shape/connections/constraint/background/foreground/rect/roundrect/ellipse/path/stroke/fill/fillstroke/alpha/strokewidth/dashed/dashpattern/linejoin/linecap/colors/font/text/save/restore) [V]. Custom libraries .xml (Drive/OneDrive/GitHub/Dropbox/device/browser/URL, `clibs=U…`), Scratchpad, community libraries [V]. Config `#_CONFIG_`, Extras > Configuration [V].

## (l) Licencia y precio
Core Apache 2.0 (stencils con restricción anti-Atlassian; plantillas CC-BY 4.0; no aceptan PRs) [V]; Desktop Apache 2.0 [V]; app.diagrams.net y Docker gratis, sin tier enterprise [V]; ingresos por apps Atlassian (Confluence Cloud Standard/Advanced, DC, Jira) [V]; precio por usuario/mes y gratis hasta 10 usuarios [M]; SharePoint editor en Marketplace [V].

---

# 3. LikeC4

**v1.59.3** (2026-09-02), **MIT**, gratuito [V]. Archivos `.c4`/`.likec4`, fusión de todos los ficheros en un modelo; Node ≥ 20; playground.likec4.dev [V].

## (a) DSL
- Bloques: `specification`, `model`, `views` (con carpeta `views 'A / B' {}`), `global`, `deployment`; `import { x } from 'proyecto'` (multi-proyecto) [V].
- `specification`: `element <kind>` (tags, title, description, technology, notation, summary, link, style), `relationship <kind>` (tags, title, description, technology, notation, link, color/line/head/tail, multiple), `tag <n> { color }`, `color <n> <hex|rgb|rgba>`, `deploymentNode <kind>` [V].
- Elementos: `kind name 'Title'` o `name = kind 'Title' 'summary' 'tech'`; anidamiento ilimitado; FQN; hoisting; `it/this`; propiedades title, description (Markdown), summary, technology, link (múltiples, incl. rutas a código con líneas), icon, metadata, style, tags; tecnología inferida del icono [V].
- Relaciones: `->`, `<->`, `-[kind]->`, `.kind`, sourceless; title, description, technology, tags, link, `navigateTo` (a dynamic view), metadata, style [V].
- `extend <fqn> {}` (elementos, relaciones, tags, metadata, links), `extend a -> b {}`; en deployment también; reglas de fusión de metadata [V].
- Metadata: string | array | boolean; **sin esquema/tipado** (Builder TS sí declara claves); filtrable `where metadata.k is` [V].
- Notation (leyenda) experimental [V].

## (b) Vistas
`view [name] [of elem] [extends v]`, `dynamic view`, `deployment view`; `index` por defecto; `implicitViews` [V]. Predicados [V]: `include *`, `elem`, `elem.*`, `elem.**`, `elem._`, `exclude`, `element.kind =`, `element.tag =`, `with { title description technology icon color shape multiple textSize navigateTo notation notes size padding border opacity iconColor iconSize iconPosition }`, relaciones `a -> b`, `-> b`, `a ->`, `-> b.* ->`, `* -> *`, `-[kind]->`, `where kind/tag is|is not` + and/or/not, `source.tag`, `target.kind`, `metadata.k`; `global predicateGroup`, `global style/styleGroup`; `group 'T' { color opacity border include }`; `style *`, `style a, b`, `style x.*`, `style element.tag = #t`; **autoLayout TopBottom|BottomTop|LeftRight|RightLeft [rankSep nodeSep]**, `rank same|min|max|source|sink { }`; layout manual limitado en VS Code + `likec4 validate` drift [V]. Dynamic: pasos `a -> b 'title'`, cadenas, notes, navigateTo, flow control `parallel/opt/loop/break/alt/try-catch-finally`, variantes `diagram|sequence`, walkthrough [V]. Deployment: nodos jerárquicos, `instanceOf`, relaciones, `extend`, `deployment view` con `includeAncestors`; limitaciones (`with` no funciona, sin estilos globales) [V].

## (c) Estilos
Colores tema: primary, secondary, muted, slate, blue, indigo, sky, red, gray, green, amber + custom [V]. Shapes: rectangle, component, person, browser, mobile, cylinder, storage, queue, bucket, document [V]. size/padding/textSize/iconSize xs..xl; opacity; border dashed/dotted/solid/none; multiple; icon (URL, `@/`, bundled aws:/azure:/gcp:/tech:/bootstrap: >5.000, none, SVG light/dark) ; iconColor, iconPosition [V]. Relación: color, line dashed/solid/dotted, head/tail none/normal/onormal/dot/odot/diamond/odiamond/crow/open/vee, multiple [V]. Tema por proyecto (`likec4.config.json`: theme.colors detallados, sizes, defaults, `extends`; `defineConfig/defineTheme` TS) [V].

## (d) Datos
Tags, metadata, links, technology, description/summary Markdown, notation, notes; kinds y tags validados contra `specification`; config con JSON Schema; multi-proyecto [V].

## (e) Tooling
**CLI** [V]: `serve|start|dev`, `build` (Vite estático, single-file), `preview`, `export png|jpg` (Playwright, `--theme`, `--seq`, `--flat`, filtros), `export json`, `export drawio` (`--all-in-one`, `--roundtrip`, perfil `leanix`), `gen react|webcomponent|model|mmd|dot|d2|plantuml|custom`, `validate`, `format`, `lsp`, `mcp`. Webapp export: png/jpg/dot/d2/mmd/puml/drawio [V]. Docker, GitHub Action [V]. **VS Code** (+ Open VSX, web): diagnósticos, semantic highlight, preview, completado, go-to, references, rename, hover, MCP integrado, comandos `semantic-layout-with-ai`, `validate-layout`… ; LSP standalone, Neovim, Emacs, Zed, JetBrains [V]. **React**: `LikeC4ModelProvider`, `LikeC4View`, `ReactLikeC4`, `LikeC4Diagram` (props pannable, zoomable, controls, fitView, readOnly, enableSearch, enableElementDetails, enableRelationshipBrowser, enableDynamicViewWalkthrough, enableCompareWithLatest, enableNotations, enableElementTags, enableNotes, renderNodes, where, eventos onNavigateTo/onNodeClick/…), hooks [V]. Web component `<likec4-view>` [V]. Vite plugin con módulos virtuales `likec4:react|model|dot|mmd|projects` [V]. **Model API**: `LikeC4.fromWorkspace/fromSource`, `computedModel/layoutedModel/parsedModel`, `toBuilder`, `toDSL/writeDSL`, `LikeC4Model` (roots, elements, relationships, views, ancestors, incomers, outgoers, elementsWhere…), Builder tipado, `generateDrawio/generateLikeC4` [V]. **MCP** (`likec4 mcp`, `@likec4/mcp`, VS Code): tools list-projects, read-project-summary, search-element, read-element, read-deployment, read-view, render-view, preview-view, find-relationships, query-graph, query-incomers/outgoers-graph, query-by-metadata, query-by-tags, query-by-tag-pattern, find-relationship-paths, batch-read-elements, subgraph-summary, element-diff, open-view; Agent Skill `likec4-dsl` [V]. Draw.io: solo export (round-trip de layout por comentarios) [V].

## (f) Viewer
Drill-down (view of / navigateTo / implicitViews), atrás/adelante, búsqueda, detalles de elemento y relación, relationships browser (scope view/global), focus mode, walkthrough dinámico, leyenda, tags, notas, dark/light (sistema, forzable), landing con grid/carpetas, Share, Export, compare with auto layout, single-file HTML, modo rendimiento [V].

## (g) Colaboración / persistencia
Ficheros en git, sin backend, offline total; CI (Action, Docker, validate, format --check); round-trip programático lossy; sin tiempo real ni SaaS [V].

## (h) Licencia
MIT, gratuito, sponsors [V].

---

# 4. Structurizr (monorepo `structurizr/structurizr`)

**Java 6.2.3** (2026-09-17), binarios **2026.06.28**, Java 21, Apache-2.0; cloud/Lite/CLI/on-premises EOL → `local`/`server`/comandos [V].

## (a) Elementos
person, softwareSystem, container, component, group (anidable), `element` custom, `archetypes` (herencia, defaults, relaciones `--kind->`); deployment: deploymentEnvironment, deploymentGroup, deploymentNode (instances `4`, `0..N`…), infrastructureNode, softwareSystemInstance, containerInstance, instanceOf, healthCheck (deprecado en 6.1 → dynamic perspectives) [V]. Relaciones `->` con description/technology/tags/url/properties/perspectives, pares permitidos definidos, `-/>` elimina; implied relationships (3 estrategias + default) [V]. Propiedades comunes: tags, description, technology, url, properties, perspectives (estáticas y **dinámicas por URL**) [V]. `!element/!elements/!relationship/!relationships <expr> {}` [V]. Reglas: sin forward references, `!const/!var`, `!identifiers flat|hierarchical`; 130 tokens del parser listados [V].

## (b) Vistas
systemLandscape, systemContext, container, component, filtered (include/exclude tags sobre base), dynamic (orden, paralelismo con `{}`), deployment, custom, image (plantuml/mermaid/kroki/image), + `default`, `animation`, `title`, `description`, `properties`; vistas por defecto sin bloque views; wildcards `*`, `*?` [V].

## (c) Estilos
Element: shape (**19**: Box, RoundedBox, Circle, Ellipse, Hexagon, Diamond, Cylinder, Bucket, Pipe, Person, Robot, Folder, WebBrowser, Window, Terminal, Shell, MobileDevicePortrait, MobileDeviceLandscape, Component), icon, iconPosition, width, height, background, color, stroke, strokeWidth, fontSize, border solid/dashed/dotted, opacity, metadata, description, properties; `styles { light {} dark {} }` [V]. Relationship: thickness, color, dashed, style, routing Direct/Orthogonal/Curved, jump, fontSize, width, position, opacity, metadata, description [V]. Tags boundary/group/Decision:<Status>; terminology [V]. Themes JSON: AWS (2020.04, 2022.04, 2023.01, 2025.07), GCP (1.5, 2025.09), Kubernetes, Azure (2019.09…2025.11), OCI (2020.04, 2021.04, 2023.04); **sin tema Cisco** [V].

## (d) Autolayout
`autoLayout [tb|bt|lr|rl] [rankSep] [nodeSep] [edgeSep] [vertices]`; UI Dagre 1.1.8; `structurizr-autolayout` con Graphviz solo programático; layout manual con vértices y `merge` [V].

## (e) Expresiones, docs, inspecciones
Expresiones: `->id`, `id->`, `->id->`, `element.type==`, `element.parent==`, `element.tag==/!=`, `element.technology==/!=`, `element.properties[k]==`, `element.group==`, `relationship.tag`, `relationship.source/destination`, `relationship==a->b`, `*->*`, `&&`/`||` [V]. Docs `!docs` Markdown/AsciiDoc, embeds `embed:Key`, `{perspective=}`, plugins PlantUML/Mermaid; ADRs `!adrs adrtools|madr|log4brains` con grafo y navegación; 26 tipos de inspección con severidades; workspace `extends`, `configuration { scope visibility users }`; OpenAPI del JSON [V].

## (f) Exportadores / importadores
Clases: StructurizrPlantUML, C4PlantUML, Mermaid, DOT, Ilograph, WebSequenceDiagrams; app: JSON, theme, DSL, static site, Playwright PNG/SVG [V]. `export -format`: plantuml, plantuml/structurizr, plantuml/c4plantuml (±light/dark), mermaid, websequencediagrams, json, theme, static, png, svg, fqcn; DOT/Ilograph no expuestos en vNext; D2 solo tercero; **sin draw.io/Excalidraw** [V]. Importadores: Image, Kroki, Mermaid, PlantUML, docs, ADRs; `!include file|dir|url`, `!script`, `!plugin`, `!components` (component finder: matcher annotation/extends/implements/name-suffix/fqn-regex, supportingTypes…) [V].

## (g) Tooling
Comandos vNext: playground, local, server, export, push, pull, branches, create, delete, lock, unlock, merge, validate, inspect, list, generate system-landscape, regenerate-apikey [V]. Server: auth none/fixed/file/SAML/LDAP, RBAC, S3/Azure, Lucene/Elasticsearch, versiones (30), branches, sharing links, DSL editor web, búsqueda, inspecciones [V]. Workspace API REST (`GET/PUT /api/workspace/{id}`, branch, lock, images, apikey) + Admin API [V]. **MCP** (Spring HTTP `/mcp`, Docker `structurizr/mcp`, público `mcp.structurizr.com`): validate, parse, inspect, export-plantuml, export-c4plantuml, export-mermaid, create/get/getWorkspaces/update/deleteWorkspace [V]. Scripting `!script groovy|kotlin|ruby|javascript`, `!plugin` Java [V]. UI: viewer con atajos, animación, perspectives, tags filter, dark mode, presentation, editor drag/align/distribute/vértices/routing/jumps, explorations graph/tree/model, embed iframe/imagen, JS `structurizr.scripting` [V]. Comunidad: VS Code, IntelliJ, tree-sitter, libs TS/PHP/Python/Go, Kroki, Docusaurus… [V].

## (h) Licencia y precio
Apache-2.0; todo gratis salvo `server` con binarios: £300–£2.400/mes por tramos 1-20…1001+ usuarios, anual; trial 14 días; open core compilable gratis [V].

---

# 5. Excalidraw

MIT, v0.18.1 (2026-04-21), npm `@excalidraw/excalidraw` [V].
- **Elementos**: rectangle, diamond, ellipse, arrow, line (sharp/curved/elbow), freedraw, text, image (crop), frame, magicframe, embeddable, iframe (video/generic/document), stickynote (nuevo), selection; conversión entre tipos [V]. Herramientas: selection, lasso, rectangle, diamond, ellipse, arrow, line, freedraw, text, image, eraser, hand, frame, magicframe, stickynote, embeddable, laser, autoshape, bucketfill [V].
- **Propiedades**: stroke/background, fillStyle hachure/cross-hatch/solid/zigzag, strokeStyle solid/dashed/dotted, strokeWidth 1/2/4, roughness 0/1/2, roundness, opacity, groupIds, frameId, fractional index, link, locked, customData; fuentes Virgil/Helvetica/Cascadia/Excalifont/Nunito/Lilita One/Comic Shanns/Liberation Sans/Assistant; texto bound; bindings con BindMode inside/orbit/skip; puntas arrow/bar/circle/circle_outline/triangle/triangle_outline/diamond/diamond_outline + cardinalidades ER; polygon; freedraw pressure [V].
- **Canvas**: infinito, zoom/fit, grid+step, snapping, frames, grupos, z-order, align 6/distribute 2, lock, flip, duplicate, copy styles, crop, linear editor, wrap in container, zen/view mode, dark, fullscreen, stats, command palette, búsqueda, element links, undo/redo, pen mode, 58 locales [V].
- **Librerías**: `.excalidrawlib`, libraries.excalidraw.com (MIT, PR a `excalidraw-libs`), API `updateLibrary`, `#addLibrary` [V].
- **Colaboración** (solo app, no paquete): socket.io + Firebase, salas cifradas E2E (clave en URL), cursores 30 fps, follow mode, idle, enlaces solo lectura `#json=` [V].
- **Export**: PNG, SVG, clipboard, `.excalidraw` JSON, embed scene en PNG/SVG, `exportToCanvas/Blob/Svg/Clipboard`, dark mode, scale, padding; Plus: PDF, PPTX [V]. **Import**: `.excalidraw`, imágenes (svg/png/jpg/gif/webp/bmp/ico/avif), paste; **Mermaid→Excalidraw** (solo flowcharts nativos, resto imagen); text-to-diagram y wireframe-to-code IA (`TTDDialog`, límite 100/día free); Element Skeleton [V].
- **API**: props (initialData, excalidrawAPI, onChange, onPointerUpdate, viewModeEnabled, zenModeEnabled, gridModeEnabled, theme, UIOptions, langCode, renderTopRightUI, validateEmbeddable, renderEmbeddable, aiEnabled…), `updateScene`, `addFiles`, `getSceneElements`, `scrollToContent`, `setActiveTool`, `toggleSidebar`; utilidades restore/serialize/reconcile/bounds; children `MainMenu`, `WelcomeScreen`, `Footer`, `Sidebar`, `LiveCollaborationTrigger`, `Stats` [V]. Sin SSR.
- **Offline**: PWA, local-first, autosave en navegador [V].
- **Excalidraw+**: Free (1 escena, colaboradores ilimitados) / Plus $6/usuario/mes (escenas ilimitadas, nube, permisos, presentaciones, voice/screenshare, comentarios, teams, PDF/PPTX, IA extendida) [V].

---

# 6. Enterprise Architect (Sparx) y Modelio

## 6.1 Sparx EA v17.2 Build 1721 (2026-07-28) [V]
**Notaciones/tecnologías** [V modeling_languages + compare-editions]: UML 2.5 (14 diagramas [M lista]), SysML 1.1–1.5 (v2 vía Trechoro), SysPhS, ArchiMate 2.0/3, BPMN 2.0 (+BPMN XML, BPEL 2.0 gen.), DMN (modeling/simulation/decision service), CMMN, AML, UAF, UPDM (DoDAF/MODAF), NAF v4, MARTE, SPEM, BMM, EPBE, GML 3.2.1/3.3, AUTOSAR, MOF, ODM (OWL/RDF), VDML, TOGAF (+Gap Analysis), Zachman, BABOK/BIZBOK, SOMF 2.1, SoaML, BIAN, C4, TM Forum ODA, SIMF, DDS, NIEM 4/5, IFML, ArcGIS, Ecore, WSDL, XSD, XSLT debugger, icon sets AWS/Azure/GCP; ERD (IDEF1X, IE, DDL), Custom Tables, Requirements, Specification Manager, Mind Mapping, Wireframes (web/Android/Apple/Windows/Win32), Kanban, Roadmaps, Charts/Dashboards/Heat maps, Gantt, Decision tables (Business Rules Composer), Executable State Machines, Time Aware Modeling, Perspectives, Journals, Hand Drawn Mode, diagram filters/legends/matrix view; Schema Composer (CIM, NIEM, UN/CEFACT, UBL → XSD/RDFS/JSON); code engineering ActionScript, Ada, C, C++, C#, Java, Delphi, Verilog, PHP, VHDL, Python, SystemC, VB.Net, VB (+ binarios Java/.NET, gramáticas propias, debuggers, profilers, sequence desde traza); MDA C#/DDL/EJB/Java/JUnit/NUnit/WSDL/XSD; DB: DB2, Firebird, Access, MySQL, SQL Server, Oracle, PostgreSQL (+ MariaDB, SQLite, Informix, Ingres, Sybase [V-wiki]).
**Repositorio** [V compare-editions salvo marcado]: Traceability window, Relationship Matrix (+overlays, Gap Analysis Matrix), Model Views, Baselines diff/merge, XMI merge, Audit, Version control (SVN, CVS, TFS, SCC; **Git no nativo**), RAS read/write, Model Simulation (UML activity/sequence/state, BPSim + Monte Carlo, DMN, Executable StateMachines, SysML parametric con OpenModelica/MATLAB/Octave/Simulink, UI simulation), Scripting JScript/VBScript/JavaScript (+ Hybrid, Scriptlets, Workflow; Python solo URL en índice 17.2, no confirmado), Automation Interface COM, Add-Ins (+ model-based JS), MDG Technologies (perfiles, Shape Script, toolboxes, patrones, plantillas), Document generation RTF/HTML/PDF (DOCX [M]), Linked Documents, Security por roles, repositorios EAP/QEA/Firebird/DBMS/Cloud, Pro Cloud Server (WebEA, SBPI Jira/Confluence/DevOps/ServiceNow/DOORS/…, OSLC REST, Prolaborate), EA SaaS, Model Transformations, Glossary, Team Library, Discussions/Chat/Mail/Journal/Reviews, gestión de proyecto y tests, Tagged values/stereotypes, model validation, patrones; Import/export XMI 1.0/1.1/1.2/2.1 (2.5 [M]), XEA/XML nativo, CSV, ReqIF, ArchiMate Exchange, BPMN 2.0 XML, .emx/RSA, Rhapsody, Data Miner (ODBC/JSON/XML/Excel), MDG Office (Ultimate), DOORS/Eclipse/VS links; EA Lite gratuita solo lectura.
**Precio (USD, perpetua + 12 meses)** [V purchase + sparxsystems.us]: Professional $245 (floating $320), Corporate $320/$425, Unified $535/$699, Ultimate $750/$965; renovaciones $81–$318; PCS Token $115/token, Team $5.350, Enterprise $8.555/año; Prolaborate $2.600 (10) … $24.909 (ilimitado)/año.

## 6.2 Modelio Open Source 6.2.0 (2026-08-26) [V]
**Notaciones** [V wiki + fuentes]: UML 2.x (Class, Composite structure, Component, Deployment, Object, Package, Activity, Sequence, Communication, Interaction overview, Use case, State — 12), BPMN 2.0 (editor + XML, MIWG), ArchiMate 3.2 (core), automatic diagrams (Inheritance, Class/Package structure); módulos OSS: JavaDesigner, SysMLArchitect (sin requisitos), TogafArchitect; perfiles XSD/WSDL/BPEL/SoaML/MARTE [V-wiki]. Comerciales [V-snip]: Analyst (requisitos, goals, rules, dictionary, KPIs, matrices, Excel/Word), Business/Application/ArchiMate/TOGAF/SysML Architect, NAF, DoDAF, MARTE, C++/C#/SQL/Hibernate Designer, Document Publisher (Word/LibreOffice/HTML), Web Model Publisher, Excel Exchange, Privaciz, Modelio Studio, Teamwork Manager SVN, Constellation, UPDM. Wireframes: no [M].
**Repositorio** [V wiki]: separación modelo/diagrama (Model Browser + Diagrams), Links Editor y Links matrix (6.0), query tool visual (6.2), audit en tiempo real con catálogo de reglas R1000–R4040, Jython scripting/macros, Java module API (.jmdac) + Maven plugin, MDA services, model patterns, rich notes Office/ODF, Model Components (.ramc) y librerías HTTP, teamwork OSS (update/deliver/locks, modelos síncronos en tiempo real 6.0, comments/change requests), auto layout parcial (6.1/6.2), traceability in diagrams, HTML Publisher; comercial: repositorio central, Modelio Reader web, roles, versionado/comparación, workflow de validación, impact analysis. Import/export: XMI EMF-UML2 3.0.0, OMG 2.1.1/2.2/2.3/2.4.1 (solo UML, parcial), BPMN 2.0 XML, ArchiMate exchange (export 5.4.1, import 6.1.1), proyectos/archivos, Excel (comercial); reverse Java (OSS), C++/C#/SQL (comercial).
**Licencia/precio**: GPL-3.0 (APIs Apache 2.0); Modelio BA/SA/SD, Reader, SaaS por Docaposte sin precios públicos (terciario: BA desde 850 €) [V-snip].

---

# 7. Stately.ai / XState

XState MIT, `xstate@5.33.2` (2026-09-15), v6 alpha; Studio propietario [V].
- **Estados**: atómicos, compuestos (`initial`), paralelos, finales (`output`), history shallow/deep con target de respaldo, `#id`, tags, meta, description Markdown; inalcanzables marcados [V].
- **Transiciones**: eventos con payload, targets hermano/hijo/descendiente/#id/múltiples, self internas vs `reenter`, forbidden, wildcard `*`/`mouse.*`, guards inline/nombradas/params/and-or-not/stateIn, `after` (nombradas, dinámicas), `always`, `transition()` pura [V].
- **Actions/actors**: assign, raise, sendTo, sendParent, enqueueActions, log, cancel, stopChild, spawnChild, emit; fromPromise/Transition/Callback/Observable/EventObservable, invoke vs spawn, snapshots persistentes, context con input, `setup({types})` [V]. Paquetes: @xstate/react/vue/svelte/solid, @statelyai/inspect, @xstate/store (+bindings), @xstate/graph, @xstate/test, @statelyai/agent v2 alpha [V].
- **Studio**: modos Design/Simulate/Live simulation; canvas con autolayout, zoom/pan, atajos; paneles Code/Structure/Share/Simulate/Deploy/Details/Events schema/Context schema/Tests; tipos de transición Normal/Guarded/Delayed/Eventless/State done/Invoke done/error/Self; Sources; descriptions, notes, colores (8), assets, Figma embed, lock, light/dark [V]. Simulate: eventos, event log, reset [V].
- **Código/IA**: export JSON/JS/TS/Mermaid (todos), Markdown/Stories (premium), v4/v5 toggle, CodeSandbox/StackBlitz, Generate React app; import `createMachine()` JS y GitHub URL; **SCXML no en UI** (solo vía MCP `convert_machine` XState↔SCXML↔XGraph↔D2); Generate with AI (OpenAI), Generate test paths (Playwright); **MCP** `https://stately.ai/mcp`: create_state_machine, validate_machine, convert_machine, diff_machines, apply_machine_patches, generate_graph_paths, simulate_machine, visualize_machine, analyze_machine, generate_test_code, extract_machines_from_code; REST API (OpenAPI) [V].
- **Compartir/versiones/equipos**: public/unlisted/private, share URL, embed iframe, image URL png live, version history (autoguardado horario, restore), GitHub sync (PRs), Teams (Owner/Admin/Editor/Viewer, 10), comentarios solo en self-hosting vía Liveblocks, live collaboration "coming soon", self-hosting early preview (`@statelyai/sdk`) [V].
- **Sky** (deploy de máquinas como workflows), **Inspector** (`createBrowserInspector`, secuencia en tiempo real), **VS Code** (edición visual, typegen, lint; no completo en v5), CLI `xstate typegen/sky` [V].
- **Precio**: Community $0 (2 proyectos, 3 máquinas); Pro $33/mes anual ($39 mensual); Team $167/$199 (10 miembros); Enterprise contacto [V].

---

# 8. Miro y Lucidchart (referencia comercial)

## 8.1 Miro
- **Colaboración**: cursores, comentarios/@menciones, video chat, timer, voting, Talktrack (legacy), presentation, Follow/Bring to me, private mode, Engage, breakout frames; SDK `collaboration`, `timer`, `notifications` [V/V-snip].
- **Objetos** (REST v2 OpenAPI): sticky_notes, shapes (21 básicas), texts, cards (fields, assignee, status, dueDate), app_cards, images, documents, embeds, frames, connectors (straight/elbowed/curved, 16 puntas incl. ERD), tags (8/ítem), groups, docs; experimental mindmap_nodes, code_widgets, flowchart shapes; formatos Tables (campos custom, Jira sync, fórmulas, formato condicional), Kanban, Timelines, Slides, Docs [V].
- **Datos**: cards con campos/tags, Jira/Asana/Linear/ClickUp/DevOps bidireccional (Business), metadata 6 KB/ítem, app data, data classification, AWS Cloud View [V].
- **Diagramación**: shape packs BPMN, UML, ERD, DFD, VSM, AWS, Azure, GCP, Kubernetes, Cisco, Salesforce, AI (Business+; 4.700+ formas), swimlanes, capas, Mermaid/PlantUML apps, auto layout solo org charts CSV y mind maps; containers [M] [V-snip].
- **IA**: generación de diagramas/mind maps desde texto o imagen, resúmenes, clustering, traducción, Sidekicks, Flows, **MCP Server** (100/500/2.000/10.000 llamadas/día por plan), créditos 10/25/50 [V].
- **API**: REST v2 (boards, items, bulk, export jobs, audit, SCIM…), Web SDK 2.17 (create*, ui, viewport, storage, eventos), Marketplace 250+ [V].
- **Export**: JPG/PNG (HD pago), PDF (vector pago), CSV, VSDX [V-snip]; **Import**: Mural, Lucidchart/Lucidspark, Jamboard, Visio .vsdx, FigJam, draw.io (vía vsdx), OmniGraffle, Conceptboard [V]. **Offline: no** [V-snip].
- **Precio**: Free (3 tableros), Starter $8, Business $20 (anual; mensual +20 %), Enterprise ≥30 [V].

## 8.2 Lucidchart
- **Data linking** [V]: Google Sheets, Excel 365 (two-way), XLSX/CSV ≤3 MB, custom fields, BambooHR/AWS/SQL/Salesforce; arrastrar fila a forma, Add Text, refresh 30 s/manual, replace dataset, export CSV; fórmulas; "Enterprise only" según artículo (precios listan "básica" en Free).
- **Formato condicional** [V]: If shape type / connected shapes / text / shape data / location / formulas, AND/OR/ELSE IF → shape style, custom style, icons, text badge, custom icon, dynamic shapes (progreso); cloud data shapes; reglas por IA.
- **Capas/acciones** [V]: múltiples capas por página, show/hide/lock, save layer view, PDF por capas; Actions (toggle/show/hide capa, CF rules, página, URL, email, documento), hotspots.
- **Shape libraries** [V/V-snip]: Standard, Flowchart, Containers, ER, Video, Table; AWS 2024, Azure 2021/2024, GCP 2021, BPMN 2.0, UML, Network, Mind maps, Venn, Org charts, Mockups/wireframes (premium), Salesforce, Kubernetes, Cisco, iOS/Android/ServiceNow [M]; icon packs Streamline/Icons8/SAP BTP/Post-it/GIPHY/Brandfetch; custom desde SVG/Visio stencils, compartidas (Team).
- **Auto-generación** [V-snip/V]: ERD desde SQL (MySQL/PostgreSQL/SQL Server/Oracle) y ERD→SQL, cloud AWS/Azure/GCP (Lucidscale), org chart desde CSV/BambooHR, UML sequence markup, Mermaid (REST), Lucid AI (prompt, imagen→formas, MCP server), Salesforce account maps, Process Capture.
- **Colaboración**: tiempo real, comentarios, Presentation Builder, revision history, publicación con contraseña, Team hubs; threads vía REST [V/V-snip].
- **Export**: PDF, PNG, JPEG, SVG, VSDX/VDX, JSON, CSV de shape data, **BPMN 2.0 .bpmn**, Slides/PowerPoint; API export PNG/JPEG [V]. **Import**: Visio .vsdx/.vsd/.vdx, Gliffy, **draw.io**, OmniGraffle, **BPMN/XPDL**, stencils Visio, imágenes por IA, `.lucid` Standard Import; editar importado requiere plan de pago [V].
- **API**: REST (documents create from JSON/Standard Import, export, copy, search, threads, mermaid, embedding, folders, sharing, users, audit, teams, cloud, shape libraries, SCIM, Data API), **Extension API** (`lucid-package`, editor extensions, custom shape libraries data-driven, data connectors, Lucid Cards, OAuth), Standard Import `.lucid` (pages, shapes, lines, groups, layers, images, data) [V].
- **Layout**: containers, smart containers, swimlanes, assisted layout, org chart layouts [V].
- **Precio** (anual): Free (3 docs, 75 formas), Individual $9, Team $10/usuario (mín. 3), Enterprise contacto [V].

---

# Capacidades transversales

✔ = sí · ✘ = no · ◐ = parcial/vía extensión o plan de pago. Columnas: **BPMN** = bpmn-js (+ecosistema bpmn.io; entre paréntesis Camunda Web Modeler), **DRW** = draw.io, **LC4** = LikeC4, **STZ** = Structurizr, **EXC** = Excalidraw (app/paquete), **EA** = Sparx EA, **MOD** = Modelio, **STA** = Stately/XState, **MIRO**, **LUC** = Lucidchart.

| Capacidad | BPMN | DRW | LC4 | STZ | EXC | EA | MOD | STA | MIRO | LUC |
|---|---|---|---|---|---|---|---|---|---|---|
| Modelo ≠ vistas | ◐ (un modelo, DI; planos de subproceso) | ✘ | ✔ | ✔ | ✘ | ✔ | ✔ | ◐ (máquina = modelo; una vista) | ✘ | ◐ (data-backed shapes) |
| Drill-down | ✔ (subprocesos colapsados) | ◐ (links entre páginas, collapse) | ✔ | ✔ (doble clic por nivel) | ✘ | ✔ | ✔ | ✔ (estados anidados) | ◐ (frames/links) | ◐ (links, hotspots) |
| Multi-notación en un documento | ✘ (BPMN, DMN, forms separados) | ✔ | ◐ (C4 + kinds propios + deployment) | ◐ (C4 + custom) | ✔ (libre) | ✔ | ✔ | ✘ | ✔ | ✔ |
| Propiedades tipadas | ◐ (element templates JSON Schema, moddle) | ✘ (texto) | ◐ (kinds/tags validados; metadata sin esquema) | ◐ (properties string; archetypes) | ✘ (customData libre) | ✔ (tagged values tipados, perfiles) | ✔ (tag/note types, MDA) | ✔ (context/events schema) | ◐ (card fields, tables) | ◐ (shape data + fórmulas, CF) |
| Puertos / pines | ◐ (boundary events, data I/O) | ◐ (connection points fixed) | ✘ | ✘ | ◐ (binding inside/orbit) | ✔ (ports, pins UML/SysML) | ✔ (UML ports) | ✘ | ✘ | ◐ (connection points) |
| Reglas de validez de conexión | ✔ (BpmnRules) | ✘ | ◐ (kinds válidos; sin restricción de pares) | ◐ (pares permitidos en modelo) | ✘ | ✔ | ✔ (audit) | ✔ (targets válidos) | ✘ | ✘ |
| Viewpoints / filtros | ✘ (bpmnlint no filtra) | ◐ (layers, tags, custom actions) | ✔ (predicados, where, global) | ✔ (filtered views, expresiones, perspectives) | ✘ | ✔ (perspectives, diagram filters, model views) | ◐ (matrices, query tool) | ✘ | ◐ (layers) | ✔ (layers, CF, data views) |
| Estilo condicional por reglas | ◐ (task-priorities, renderer custom) | ◐ (acciones `style`/CF vía placeholders; plugin) | ✔ (style rules por kind/tag/where) | ✔ (styles por tag, themes) | ✘ | ✔ (legends auto-coloring, Shape Script) | ◐ (diagram styles) | ◐ (colores manuales) | ◐ (tables CF) | ✔ (conditional formatting) |
| Layout automático | ◐ (bpmn-auto-layout externo, auto-place) | ✔ (ELK/mxGraph, 10+) | ✔ (Graphviz) | ✔ (Dagre/Graphviz) | ✘ (solo Mermaid import) | ✔ | ◐ (parcial 6.1+) | ✔ | ◐ (org chart, mind map) | ◐ (org chart, assisted) |
| Offline | ✔ (lib; Desktop Modeler) | ✔ (PWA, Desktop, Docker) | ✔ | ✔ (`local`, server) | ✔ (PWA) | ✔ | ✔ | ◐ (self-hosting preview) | ✘ | ✘ |
| Colaboración en tiempo real | ◐ (Web Modeler: canvas lock, comentarios) | ✔ (Drive/OneDrive/Confluence/Nextcloud) | ✘ | ✘ | ✔ (app, E2EE) | ◐ (repositorio compartido, Prolaborate) | ◐ (teamwork síncrono 6.0) | ✘ ("coming soon") | ✔ | ✔ |
| API REST | ✘ (Camunda Web Modeler sí) | ✘ | ✘ | ✔ (Workspace/Admin API) | ✘ (Plus backend privado) | ✔ (OSLC vía PCS) | ◐ (comercial) | ✔ (premium) | ✔ (v2) | ✔ |
| CLI | ✔ (bpmn-to-image, bpmnlint, dmn-migrate) | ✔ (desktop export) | ✔ | ✔ | ✘ | ✘ (COM) | ◐ (Maven plugin, CLI options) | ◐ (`xstate typegen/sky`) | ✘ | ◐ (`lucid-package`) |
| Scripting | ✔ (API JS, moddle) | ◐ (plugins JS, embed API) | ✔ (Model API TS, Builder) | ✔ (!script groovy/kotlin/ruby/js, plugins Java) | ✔ (API JS) | ✔ (JS/JScript/VBScript, COM) | ✔ (Jython, Java) | ✔ (XState JS/TS) | ✔ (Web SDK) | ✔ (Extension API) |
| MCP / IA | ◐ (BPMN/FEEL Copilot en Camunda SaaS; sin MCP) | ✔ (MCP hosted + npm; Generate BYOK) | ✔ (MCP + skill) | ✔ (MCP) | ◐ (text-to-diagram) | ✘ | ◐ (IA anunciada) | ✔ (MCP + Generate) | ✔ (MCP + Miro AI) | ✔ (MCP + Lucid AI) |
| Import BPMN | ✔ | ◐ (formas BPMN; no XML) | ✘ | ✘ | ✘ | ✔ (BPMN XML) | ✔ | ✘ | ✘ | ✔ (.bpmn/.xpdl) |
| Import ArchiMate | ✘ | ◐ (formas; no exchange) | ✘ | ✘ | ✘ | ✔ (Exchange) | ✔ (6.1.1) | ✘ | ✘ | ✘ |
| Import draw.io | ✘ | ✔ | ✘ (solo export) | ✘ | ✘ | ✘ | ✘ | ✘ | ◐ (vía vsdx) | ✔ |
| Export SVG/PNG/PDF | ✔ SVG nativo; PNG/PDF vía bpmn-to-image | ✔ ✔ ✔ | ✔ PNG/JPG (SVG ✘ nativo, PDF ✘) | ✔ PNG/SVG (PDF ✘) | ✔ PNG/SVG (PDF solo Plus) | ✔ (imagen, PDF) | ✔ (imagen; PDF vía publisher) | ◐ (PNG por URL; SVG/PDF ✘) | ◐ (JPG/PNG/PDF; SVG ✘) | ✔ ✔ ✔ |
| Plugins / extensibilidad | ✔ (módulos didi, moddle, renderer, templates) | ✔ (plugins, stencils, libs, config) | ◐ (generadores custom, React nodes) | ✔ (!plugin, !script, themes) | ◐ (API/children components, libs) | ✔ (MDG, Add-ins, Shape Script) | ✔ (módulos Java, macros) | ◐ (Sources; no plugins de UI) | ✔ (Web SDK apps, marketplace) | ✔ (Extension API) |
| Licencia libre | ◐ (bpmn.io License, watermark) | ✔ Apache 2.0 | ✔ MIT | ✔ Apache 2.0 (server binarios de pago) | ✔ MIT | ✘ | ◐ (core GPLv3; módulos comerciales) | ◐ (XState MIT; Studio propietario) | ✘ | ✘ |

**Notas a la tabla**: las celdas "◐" de EA/Modelio sobre colaboración y estilo condicional se apoyan en compare-editions y wiki, no en pruebas. "Viewpoints" en bpmn-js: no hay filtrado de vistas; el properties panel y bpmnlint no generan vistas. En Structurizr la ausencia de exportador draw.io está verificada por grep del monorepo; en LikeC4 el export drawio existe pero no hay import.