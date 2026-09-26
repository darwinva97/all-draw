# Inventario: Archi (ArchiMate)

Inventario completo de Archi (repo `/home/maka/projects/all-draw/_research/archi`, `ModelVersion.VERSION = "5.0.0"`).

---

# A. METAMODELO ArchiMate

Rutas: `com.archimatetool.model/model/archimate.ecore`, `com.archimatetool.model/src/com/archimatetool/model/util/ArchimateModelUtils.java`, `com.archimatetool.model/model/relationships.xml`, `relationships-keys.xml`, `viewpoints.xml`.

## A.1 Tipos de elemento por capa (según `ArchimateModelUtils.getXxxClasses()`)

**Strategy (4)**: Resource, Capability, Value Stream, Course of Action.

**Business (13)**: Business Actor, Business Role, Business Collaboration, Business Interface, Business Process, Business Function, Business Interaction, Business Event, Business Service, Business Object, Contract, Representation, Product.

**Application (9)**: Application Component, Application Collaboration, Application Interface, Application Function, Application Interaction, Application Process, Application Event, Application Service, Data Object.

**Technology (13)**: Node, Device, System Software, Technology Collaboration, Technology Interface, Path, Communication Network, Technology Function, Technology Process, Technology Interaction, Technology Event, Technology Service, Artifact.

**Physical (4)**: Equipment, Facility, Distribution Network, Material.

**Motivation (10)**: Stakeholder, Driver, Assessment, Goal, Outcome, Principle, Requirement, Constraint, Meaning, Value.

**Implementation & Migration (5)**: Work Package, Deliverable, Implementation Event, Plateau, Gap.

**Other / Composite (2)**: Location, Grouping.

**Connector / Junction (1)**: Junction (con `type` "" = AND, "or" = OR; `XOR` está comentado en `IJunction.java`).

**TOTAL = 60 elementos + 1 Junction = 61 tipos de concepto no-relación.**

Interfaces/clasificadores abstractos del metamodelo que categorizan estos elementos: `ArchimateConcept`, `ArchimateElement`, `ArchimateRelationship`, `StrategyElement`, `BusinessElement`, `ApplicationElement`, `TechnologyElement`, `TechnologyObject`, `PhysicalElement`, `MotivationElement`, `ImplementationMigrationElement`, `CompositeElement`, `BehaviorElement`, `StrategyBehaviorElement`, `StructureElement`, `ActiveStructureElement`, `PassiveStructureElement`.

## A.2 Relaciones (11) — letra clave y categoría

De `relationships-keys.xml` y las superclases del ecore:

| Relación | Letra | Categoría (superclase ecore) |
|---|---|---|
| Composition | `c` | Estructural (`StructuralRelationship`) |
| Aggregation | `g` | Estructural |
| Assignment | `i` | Estructural |
| Realization | `r` | Estructural |
| Serving | `v` | Dependencia (`DependendencyRelationship`) |
| Access | `a` | Dependencia |
| Influence | `n` | Dependencia |
| Association | `o` | Dependencia |
| Triggering | `t` | Dinámica (`DynamicRelationship`) |
| Flow | `f` | Dinámica |
| Specialization | `s` | Otra (`OtherRelationship`) |

**TOTAL = 11 relaciones.**

## A.3 Reglas especiales

- **Matriz de validez**: `com.archimatetool.model/model/relationships.xml` (versión 3.2) — 62 conceptos origen (los 60 elementos + Junction + el pseudo-concepto `Relationship`), cada uno con lista de destinos y letras permitidas. Implementada en `RelationshipsMatrix.java`; API: `ArchimateModelUtils.isValidRelationship(source, target, type)`, `isValidRelationshipStart(...)`, `getValidRelationships(...)`.
- **Relaciones sobre relaciones**: soportadas vía el concepto genérico `Relationship` en la matriz; sólo se admite `o` (Association) hacia/desde una relación (`RelationshipsMatrix.RELATIONSHIP_CONCEPT` mapea "Relationship" → `ArchimateRelationship`). Una relación puede ser source/target porque `ArchimateRelationship` extiende `ArchimateConcept`.
- **Junction AND/OR**: `IJunction.AND_JUNCTION_TYPE = ""` (por defecto), `OR_JUNCTION_TYPE = "or"`; XOR comentado. Reglas en `ArchimateModelUtils.isValidRelationship`: todas las relaciones entrantes y salientes de un Junction deben ser del mismo tipo; las relaciones indirectas (source-del-junction → target) deben ser válidas; excepción explícita (ArchiMate 3 Apéndice B): Grouping y Location pueden tener Aggregation/Composition hacia cualquier concepto incluido Junction sin romper la homogeneidad (`isGroupingOrLocationAggregationOrCompositionRelationship`).
- **Relaciones derivadas**: **no** existe motor de derivación en el core (no hay clase/flag "derived relationship"; la palabra "derived" solo aparece en código generado EMF). Lo más cercano es el filtro de relaciones ocultas en anidamiento y la `RelationshipsMatrix` (que ya codifica el resultado permitido).
- **Duplicados**: `hasDirectRelationship()` impide crear una segunda relación idéntica entre los mismos conceptos.
- **Nesting → relación implícita (ARM, Automatic Relationship Management)**, `ConnectionsARMPreferencePage` + `ConnectionPreferences` + `PreferenceInitializer`:
  - `USE_NESTED_CONNECTIONS` (default true): "Enable implicit connections in Views for nested elements".
  - `CREATE_RELATION_WHEN_ADDING_NEW_ELEMENT_TO_CONTAINER`, `CREATE_RELATION_WHEN_ADDING_MODEL_TREE_ELEMENT_TO_CONTAINER`, `CREATE_RELATION_WHEN_MOVING_ELEMENT_TO_CONTAINER` (todas default true).
  - `NEW_RELATIONS_TYPES` default = bits 1,5,6,7,8,9 sobre el orden de `getRelationsClasses()` (Composition, Aggregation, Assignment, Realization, Serving, Access, Influence, Triggering, Flow, Specialization, Association) → **Aggregation, Access, Influence, Triggering, Flow, Specialization**.
  - `NEW_REVERSE_RELATIONS_TYPES` default = 0 (ninguna).
  - `HIDDEN_RELATIONS_TYPES` default = bits 0..10 → **las 11 relaciones se ocultan al anidar**.
  - Validador Hammer (`NestedElementsChecker`) considera "válidas para anidar": Composition, Aggregation, Assignment, Access, Realization, Specialization.
- **Access con accessType** (`IAccessRelationship`): `WRITE_ACCESS = 0` (default), `READ_ACCESS = 1`, `UNSPECIFIED_ACCESS = 2`, `READ_WRITE_ACCESS = 3`. Sección UI: `AccessRelationshipSection`.
- **Influence con strength**: atributo `strength` (EString libre, p.ej. "+", "++", "-", "50%"). Sección: `InfluenceRelationshipSection`.
- **Association directed**: atributo booleano `directed` en `AssociationRelationship`. Sección: `AssociationRelationshipSection`.
- **Specialization**: relación `SpecializationRelationship` (categoría "Other") + concepto de *especialización por Profile* (ver A.5).

## A.4 Viewpoints (`com.archimatetool.model/model/viewpoints.xml`, version 3.0) — 25

1. Organization (`organization`)
2. Business Process Cooperation (`business_process_cooperation`)
3. Product (`product`)
4. Application Cooperation (`application_cooperation`)
5. Application Structure (`application_structure`)
6. Application Usage (`application_usage`)
7. Implementation and Deployment (`implementation_deployment`)
8. Technology (`technology`)
9. Technology Usage (`technology_usage`)
10. Information Structure (`information_structure`)
11. Service Realization (`service_realization`)
12. Physical (`physical`)
13. Stakeholder (`stakeholder`)
14. Goal Realization (`goal_realization`)
15. Requirements Realization (`requirements_realization`)
16. Motivation (`motivation`)
17. Strategy (`strategy`)
18. Capability Map (`capability`)
19. Value Stream (`value_stream`)
20. Outcome Realization (`outcome_realization`)
21. Resource Map (`resource`)
22. Project (`project`)
23. Migration (`migration`)
24. Implementation and Migration (`implementation_migration`)
25. Layered (`layered`)

Más el valor implícito "None / Total" (vista sin viewpoint). Cada viewpoint declara `<concept>` permitidos, con macros `$ApplicationElements$`, `$TechnologyElements$`, etc.

## A.5 Profiles, properties, features, documentation, metadata, folders, versión

- **Profile / Specializations** (`Profile`): atributos `name`, `id`, `specialization` (boolean, default true), `conceptType` (String con el nombre de la EClass a la que aplica), + `DiagramModelImageProvider` (imagen/icono propio). Colección `ArchimateModel.profiles`. Interfaz `Profiles` en `ArchimateConcept` (un concepto lleva 0..n profiles). API: `hasProfileByNameAndType`, `getProfileByNameAndType`, `findProfilesForConceptType`, `findProfileUsage`, `findProfilesUsage`, `isMatchingProfile`, `sortProfiles`. UI: `ProfilesManagerDialog`, `SpecializationSection`.
- **Properties**: pares `key`/`value` (clase `Property`), en `ArchimateModel`, `Folder`, `ArchimateConcept`, `DiagramModel`, `DiagramModelGroup`, `DiagramModelNote`, `DiagramModelImage`, `DiagramModelConnection`, `SketchModelSticky`, `SketchModelActor`. UI: `UserPropertiesSection`, `UserPropertiesManagerDialog`.
- **Features**: pares `name`/`value` (clase `Feature`), interfaz `Features` en `ArchimateModelObject`. Features conocidas: `lineAlpha`, `gradient`, `iconVisible`, `iconColor`, `deriveElementLineColor`, `lineStyle`, `nameVisible`, `imageSource`, `textRelativePosition`, `hideJunctionArrows`, `legend`, `labelExpression`.
- **Documentation**: interfaz `Documentable` en `Folder`, `ArchimateConcept`, `DiagramModel`, `DiagramModelGroup`, `DiagramModelImage`, `DiagramModelConnection`, `SketchModelActor`.
- **Metadata del modelo**: `Metadata` con lista de `Property` (entradas Dublin Core en el XML Exchange).
- **Modelo**: `ArchimateModel` con `name`, `id`, `purpose`, `file` (transient), `version`, `metadata`, `profiles`, `folders`.
- **Folders** (`FolderType`): `user(0)`, `strategy(1)`, `business(2)`, `application(3)`, `technology(4)`, `relations(5)`, `other(6)`, `diagrams(7)` — 8 tipos. Anidables (`FolderContainer`), con documentación y propiedades.
- **Versión de modelo**: `ModelVersion.VERSION = "5.0.0"`.

---

# B. TIPOS DE DIAGRAMA Y OBJETOS DE DIAGRAMA

Rutas: `com.archimatetool.model/model/archimate.ecore`, `com.archimatetool.canvas/model/canvas.ecore`, `com.archimatetool.editor/src/com/archimatetool/editor/diagram/`.

## B.1 Tipos de vista (3 + referencias)

1. **ArchimateDiagramModel** (`ArchimateDiagramModel extends DiagramModel`): atributo `viewpoint` (id de viewpoint); contiene `DiagramModelArchimateObject`, `DiagramModelArchimateConnection`, `DiagramModelGroup`, `DiagramModelNote`, `DiagramModelImage`, `DiagramModelReference`, `DiagramModelConnection` (líneas simples).
2. **SketchModel** (`SketchModel extends DiagramModel`): atributo `background` (int; preferencia `SKETCH_DEFAULT_BACKGROUND`); objetos: `SketchModelSticky` (sticky con color, contenido de texto, contenedor, propiedades, text position, iconic), `SketchModelActor` (documentación + propiedades), `DiagramModelGroup`, `DiagramModelNote`, `DiagramModelImage`, `DiagramModelReference`, y 4 tipos de conexión de línea (plain, flecha, punteada, punteada con flecha) en `SketchEditorPalette`.
3. **CanvasModel** (plugin `com.archimatetool.canvas`, `canvas.ecore`): `CanvasModel`, `CanvasModelBlock` (bloque contenedor con imagen, hint, notas, lockable, border), `CanvasModelSticky` (con color/imagen/hint), `CanvasModelImage`, `CanvasModelConnection`; interfaces `IHintProvider` (hint title + content), `IHelpHintProvider`, `INotesContent` (notas). Plantillas: `com.archimatetool.canvas/templates/*.archicanvas` (ArchiMate 3.0 Notation Overview, bmc, cjc, swot).
4. **DiagramModelReference**: objeto que referencia otra vista (`referencedModel`), con `TextPosition` e `Iconic`.

## B.2 Objetos y atributos gráficos

- **DiagramModelObject** (base): `bounds` (x, y, width, height vía `Bounds`), `fillColor`, `alpha` (0-255), + `FontAttribute` (`font`, `fontColor`), + `LineObject` (`lineWidth`, `lineColor`), + `TextAlignment`.
- **Features de aspecto** (`IDiagramModelObject`): `lineAlpha` (default 255), `gradient` (`GRADIENT_NONE=-1` + direcciones), `iconVisible` (`IF_NO_IMAGE_DEFINED=0`, `ALWAYS=1`, `NEVER=2`), `iconColor`, `deriveElementLineColor` (default true), `lineStyle` (`DEFAULT=-1`, `SOLID=0`, `DASHED=1`, `DOTTED=2`, `NONE=3`), `nameVisible`, `labelExpression`.
- **TextPosition**: `TOP=0`, `CENTRE=1`, `BOTTOM=2`.
- **TextAlignment**: `LEFT=1`, `CENTER=2`, `RIGHT=4`.
- **BorderType**: para `DiagramModelNote`: `BORDER_DOGEAR=0` (default), `BORDER_RECTANGLE=1`, `BORDER_NONE=2`; para `DiagramModelGroup`: tipo tabbed/rectangle. `BorderObject` (`borderColor`) en `DiagramModelImage`.
- **Iconic / imagen**: `imagePath` (`DiagramModelImageProvider`), `imagePosition` con 10 valores: `TOP_LEFT=0`, `TOP_CENTRE=1`, `TOP_RIGHT=2`, `MIDDLE_LEFT=3`, `MIDDLE_CENTRE=4`, `MIDDLE_RIGHT=5`, `BOTTOM_LEFT=6`, `BOTTOM_CENTRE=7`, `BOTTOM_RIGHT=8`, `FILL=9`. Feature `imageSource` (icono del profile vs imagen propia; `ImageSourceSection`).
- **Lockable**: atributo `locked` (Group, Note, Image, objetos de diagrama) → `LockObjectAction`, `LockedSection`.
- **Group** (`DiagramModelGroup`): contenedor, documentación, propiedades, text position, border type, iconic.
- **Note** (`DiagramModelNote`): `content` (TextContent), text position, border type, propiedades, iconic; markdown opcional (`MARKDOWN_MODE`, plugin `com.archimatetool.markdown`).
- **Image** (`DiagramModelImage`): imagen + border color + propiedades + documentación.
- **Legend**: `FEATURE_LEGEND` / `LEGEND_MODEL_NAME = "DiagramModelLegend"`, `LegendFigure`, `LegendPreferencePage`, `LegendSection` (etiquetas, colores, filas por columna, orden).

## B.3 Conexiones

- **DiagramModelConnection**: `text` (label), `textPosition` (SOURCE/MIDDLE/TARGET), `textAlignment`, `lineWidth`, `lineColor`, `font`/`fontColor`, `type` (int: estilos de línea de sketch/canvas), `source`, `target`, `bendpoints` (lista de `DiagramModelBendpoint` con `startX/startY/endX/endY`), propiedades, documentación.
- Feature `textRelativePosition` (posición relativa de la etiqueta, default CENTER) — `DiagramConnectionLabelRelativePositionComposite`.
- **DiagramModelArchimateConnection**: enlaza a una `ArchimateRelationship`.
- **Routers** (`IDiagramModel.connectionRouterType`): `CONNECTION_ROUTER_BENDPOINT = 0`, `CONNECTION_ROUTER_MANHATTAN = 2` (shortest-path `=1` está comentado/retirado).
- Preferencias de conexión: `USE_ORTHOGONAL_ANCHOR`, `USE_LINE_CURVES`, `USE_LINE_JUMPS`, `CONNECTION_LABEL_STRATEGY`, `SHOW_SELECTED_CONNECTIONS`, `SHOW_WARNING_ON_RECONNECT`, `MAGIC_CONNECTOR_POLARITY`, `ANTI_ALIAS`.
- **Figuras de conexión** (17 ficheros en `diagram/figures/connections/`): Access, Aggregation, Assignment, Association, Composition, Flow, Influence, Realization, Serving, Specialization, Triggering + `RoundedPolylineConnection`, `PathDrawnPolygonDecoration`, `LineConnectionFigure`.

## B.4 Figuras alternativas (type 0 / type 1)

`IArchimateElementUIProvider.hasAlternateFigure()` → true para todos los elementos ArchiMate salvo **Junction** (`JunctionUIProvider` devuelve false). El atributo `DiagramModelArchimateObject.type` (int 0 = figura por defecto, 1 = alternativa). Preferencia por elemento: `DEFAULT_FIGURE_PREFIX` + `DiagramFiguresPreferencePage`.

Figuras con dos variantes reales (42 clases en `diagram/figures/elements/` que consultan `getType()`): Artifact, Assessment, BusinessRole, Collaboration, Capability, CommunicationNetwork, DistributionNetwork, Constraint, ApplicationComponent, Event, Deliverable, BusinessActor, Facility, CourseOfAction, Grouping, Goal, Interface, Node, Contract, Location, Process, Requirement, Object, Device, Plateau, Driver, Resource, Stakeholder, SystemSoftware, WorkPackage, Gap, Function, Equipment, Material, Interaction, Meaning, Outcome, Principle, Product, Service, ValueStream, Value. Delegados de forma reutilizables: `BoxFigureDelegate`, `CylinderFigureDelegate`, `ParallelogramFigureDelegate`, `ProcessFigureDelegate`, `ArchimateDiagramModelIconDelegate`.

Feature `hideJunctionArrows` para flechas de Junction.

---

# C. FUNCIONES DEL EDITOR

Ruta base: `com.archimatetool.editor/` (`plugin.xml`, `src/com/archimatetool/editor/actions/`, `diagram/actions/`, `diagram/tools/`, `preferences/`, `propertysections/`, `views/`, `tools/`).

## C.1 Acciones de modelo / aplicación (`editor/actions/`)

New Model, Open Model, Close Model, Save, Save As, Import Model (`ImportModelAction`), Import Into Model (`ImportIntoModelAction`), Export Model (`ExportModelAction`), Welcome New Model, About, Check For New Version, Open Data Folder, Plugin Manager, Show Models View, Show Properties View, Show Outline View, Show Navigator View, Show Palette View, Show Profiles Manager, Show Properties Manager, Show/Hide Toolbar, MRU (most recently used) menu, Web Browser action, Set Concept Type (cambio de tipo de concepto), Full Screen mode, Split Editor.

Comandos declarados en `plugin.xml` (38 ids propios): `newModel`, `openModel`, `closeModel`, `duplicate`, `openDiagram`, `showTreeModelView`, `showPropertiesView`, `showOutlineView`, `showNavigatorView`, `showPaletteView`, `exportAsImageToClipboard`, `fullScreen`, `org.eclipse.gef.zoom_normal`, `generateView`, `defaultSize`, `paste_special`, `pluginManager`, `openPropertiesDialog`, `openProfilesDialog`, `openDataFolder`, `deleteFromModel`, `deleteContainer`, `selectInModelTree`, `selectSameObjectType`, `invertConnection`, `bringToFront`, `bringForward`, `sendToBack`, `sendBackward`, `palette.command`, `textAlignmentLeft/Centre/Right`, `textPositionTop/Centre/Bottom`, `newElement`, `deleteBendpoints`.

## C.2 Acciones del editor de diagramas (`diagram/actions/` + `AbstractDiagramEditor.createActions`)

Zoom In, Zoom Out, Zoom Normal (+ pinch-zoom gesture, `PinchZoomGestureHandler`), Select All, Print (con `PrintModeDialog`), Rename (DirectEdit), Delete, Undo, Redo, Delete From Model, Delete Container, Delete Bendpoints, Cut, Copy, Paste, Paste Special (`DIAGRAM_PASTE_SPECIAL_BEHAVIOR`), Duplicate, Toggle Grid Enabled (snap), Toggle Grid Visible, Toggle Snap To Alignment Guides, Match Width, Match Height, Match Size, Align Left / Right / Top / Bottom / Center / Middle, Default Size (`DefaultEditPartSizeAction`), Reset Aspect Ratio, Properties, Fill Colour, Line Width, Line Colour, Font, Font Colour, Opacity (fill alpha), Outline Opacity (line alpha), Border Colour, Border Type (Note/Group), Export As Image, Export As Image To Clipboard, Connection Router → Bendpoint / Manhattan, Object Position (Bring To Front, Bring Forward, Send To Back, Send Backward), Text Alignment (Left/Centre/Right), Text Position (Top/Centre/Bottom), Lock/Unlock Object, Full Screen, Select Element In Model Tree, Select Same Object Type, Find/Replace (`FindReplaceAction`, `DiagramEditorFindReplaceProvider`), Invert Connection (`InvertConnectionAction`), Generate View For Element (`GenerateViewAction` + `tools/GenerateViewDialog`, `GenerateViewCommand`), Viewpoint (`ViewpointAction`, uno por viewpoint = 25 + "None"), New Element (`NewElementHandler` / Quick Add `SHOW_QUICK_ADD_ON_TRIGGER`).

Conteo aproximado de acciones registradas en el editor de diagramas: ~60 base + 4 Object Position + 3 Text Alignment + 3 Text Position + 26 Viewpoint ≈ **96**; sumando las ~25 acciones de aplicación y las ~17 del árbol de modelos → **≈ 138 acciones/comandos**.

## C.3 Herramientas de paleta (`diagram/tools/`, `*Palette.java`)

- Selection tool, Marquee tool con 6 comportamientos (nodes contained + related connections, nodes touched + related connections, connections contained, connections touched, nodes contained, nodes touched).
- **Magic Connector** (`MagicConnectionCreationTool`, `MagicConnectionModelFactory`, preferencia `MAGIC_CONNECTOR_POLARITY`).
- **Format Painter** (`FormatPainterTool`, `FormatPainterToolEntry`, `FormatPainterInfo`).
- Paleta ArchiMate: los 60 elementos + Junction + las 11 relaciones + Note + Group + Diagram Reference + Connection (línea); atajos de teclado por tipo (`PaletteKeyHandler`), paleta flotante (`FloatingPalette`), colores de paleta (`CustomPaletteColorProvider`), especializaciones en paleta (`SHOW_SPECIALIZATIONS_IN_PALETTE`), ocultado por viewpoint (`VIEWPOINTS_HIDE_PALETTE_ELEMENTS`), estado (`PALETTE_STATE`).
- Paleta Sketch: Actor, Group, Sticky (varios colores), 4 tipos de conexión.
- Paleta Canvas: Block, Image, Sticky (varios colores), conexiones.
- `MouseWheelHorizontalScrollHandler`, `PanningSelectionExtendedTool`.

## C.4 Label expressions (`editor/ui/textrender/`)

Renderers registrados en `TextRenderer`: NameRenderer, DocumentationRenderer, TypeRenderer, SpecializationRenderer, PropertiesRenderer, TextContentRenderer, RelationshipRenderer, ViewpointRenderer, IfRenderer, WordWrapRenderer.

Sintaxis completa:
- `${name}`
- `${documentation}` o `${doc}`
- `${type}`
- `${specialization}`
- `${content}` (Note/Sticky; admite prefijo `connection:source|target`)
- `${property:<key>}`
- `${properties}` (todas las propiedades key=value)
- `${propertiesvalues}` (sólo valores)
- `${properties:<separador>:<key>}` (propiedades filtradas por clave con separador)
- `${if:<cond>:<then>}` y `${if:<cond>:<then>:<else>}`
- `${nvl:<cond>:<alt>}`
- `${wordwrap:<n>:<texto>}`
- Renderer de relación y de viewpoint (nombre del viewpoint de la vista).

**Prefijos** (`ITextRenderer`):
- core: `model`, `view`, `parent`, `source`, `target`, `mfolder` (carpeta del modelo), `vfolder` (carpeta de la vista) — ej. `$model{name}`, `$vfolder{name}`.
- de conexión: `connection:`, `triggering:`, `access:`, `specialization:`, `composition:`, `assignment:`, `aggregation:`, `realization:`, `serving:`, `influence:`, `flow:`, `association:` combinados con `source` o `target` — ej. `$composition:target{name}`.

Preferencia `USE_LABEL_EXPRESSIONS_IN_ANALYSIS_TABLE`; sección UI `LabelRendererSection`.

## C.5 Vistas

- **Models Tree** (`views/tree/`): árbol de modelos y carpetas, drag&drop, cut/paste, rename, duplicate, delete, sort folder, open diagram, generate view, link to editor, properties, save/close model, new element menus; `TreeViewpointFilterProvider` (filtrado por viewpoint: `VIEWPOINTS_FILTER_MODEL_TREE`); `TreeSelectionSynchroniser`; `TreeStateHelper`; incremento de nodos (`TREE_DISPLAY_NODE_INCREMENT`), orden alfanumérico (`TREE_ALPHANUMERIC_SORT`), resaltado de elementos no usados (`HIGHLIGHT_UNUSED_ELEMENTS_IN_MODEL_TREE`), iconos de especialización (`SHOW_SPECIALIZATION_ICONS_IN_MODEL_TREE`).
- **Búsqueda/filtros del árbol** (`views/tree/search/SearchFilter`, `SearchWidget`): filtro por Nombre, por Documentación, por valores de Propiedad (selección de claves), por Vistas, por capa/carpeta (Strategy, Business, Application, Technology & Physical, Motivation, Implementation & Migration, Other, Relations, Views), por Especializaciones, Show All Folders, Match Case, Match Regular Expression, Reset Filters, Refresh; preferencias `SEARCHFILTER_*`, `TREE_SEARCH_AUTO`.
- **Properties view** (`views/properties/CustomPropertiesView` + 49 secciones en `propertysections/`): Name/Documentation, Archimate Concept, Archimate Model, Folder, Access Relationship, Association Relationship, Influence Relationship, Junction Type, Junction Connection Arrows, Specialization, Fill Colour, Fill Opacity, Line (color/width), Line Style, Border Colour, Border Type (Note), Group Border Type, Font, Text Alignment, Text Content, Gradient, Icon, Icon Colour, Icon Visible, Image Chooser, Image Source, Diagram Model, Diagram Figure Type, Diagram Model Connection, Connection Label / Label Position / Label Relative Position, Label Renderer (label expression), Legend, Locked, Sketch Element, Sketch Model Background, Sketch Sticky Name, User Properties, Used In Views, Used In Relationships, Viewpoint, Diagram Model Image; + canvas: Hint Content, Notes. Preferencia `PROPERTIES_SINGLE_COLUMN`.
- **Outline** (`OverviewOutlinePage`), **Navigator** (`views/navigator/`, navegación entrante/saliente por relaciones), **Palette view**, **Hints view** (`com.archimatetool.help/src/.../hints/HintsView`, 110 ficheros HTML de hints en `com.archimatetool.help/hints/`, más hints de canvas en `com.archimatetool.canvas/help/hints`; preferencias `HINTS_BROWSER_JS_ENABLED`, `HINTS_BROWSER_EXTERNAL_HOSTS_ENABLED`), **Visualiser/Zest** (`com.archimatetool.zest`: ZestView, DrillDownManager, export as image, copy to clipboard, animación y profundidad), **Validator (Hammer)** view, **Browser** (`com.archimatetool.editor.browser`).

## C.6 Validador / Hammer (`com.archimatetool.hammer`) — 8 reglas

1. `InvalidRelationsChecker` — "Illegal relation": tipo de relación no permitido entre dos conceptos.
2. `UnusedElementsChecker` — "Unused Element": elemento no usado en ninguna vista.
3. `UnusedRelationsChecker` — "Unused Relation": relación no usada en ninguna vista.
4. `EmptyViewsChecker` — "Empty View": vista sin elementos ni relaciones.
5. `ViewpointChecker` — "Concept in Viewpoint": concepto que no pertenece al viewpoint de la vista.
6. `NestedElementsChecker` — "Visual Nesting": anidamiento visual sin relación semántica adecuada (válidas: Composition, Aggregation, Assignment, Access, Realization, Specialization).
7. `DuplicateElementChecker` — "Possible duplicate": mismo nombre repetido para el mismo tipo.
8. `JunctionsChecker` — "Junction relationships": Junction con tipos de relación heterogéneos.

Cada regla se puede activar/desactivar por preferencias; los resultados se agrupan en categorías Errors / Warnings / Advice / OK.

## C.7 Preferencias (11 páginas + ~100 claves)

Páginas (`plugin.xml`): Appearance, Fonts, Colours, Diagram, Diagram > Appearance, Diagram > Figures, Diagram > Legend, General, Connections, Connections > ARM, Network, System, Keys (Eclipse).

Claves (`IPreferenceConstants`, lista completa): SHOW_STATUS_LINE, DEFAULT_CONNECTION_LINE_COLOR, DEFAULT_ELEMENT_LINE_COLOR, DEFAULT_FILL_COLOR_PREFIX, FOLDER_COLOUR_PREFIX, DERIVE_ELEMENT_LINE_COLOR, SAVE_USER_DEFAULT_COLOR, VIEW_BACKGROUND_COLOR, VISUALISER_BACKGROUND_COLOR, DEFAULT_VIEW_FONT, FONT_SCALING, ANALYSIS_TABLE_FONT, MODEL_TREE_FONT, MULTI_LINE_TEXT_FONT, NAVIGATOR_TREE_FONT, PROPERTIES_TABLE_FONT, SINGLE_LINE_TEXT_FONT, MAC_ITEM_HEIGHT_PROPERTY_KEY, LEGEND_LABEL_PREFIX, LEGEND_COLORS_DEFAULT, LEGEND_ROWS_PER_COLUMN_DEFAULT, LEGEND_SORT_DEFAULT, ANTI_ALIAS, MAGIC_CONNECTOR_POLARITY, SHOW_SELECTED_CONNECTIONS, USE_ORTHOGONAL_ANCHOR, USE_LINE_CURVES, USE_LINE_JUMPS, CONNECTION_LABEL_STRATEGY, SHOW_WARNING_ON_RECONNECT, CREATE_RELATION_WHEN_ADDING_NEW_ELEMENT_TO_CONTAINER, CREATE_RELATION_WHEN_ADDING_MODEL_TREE_ELEMENT_TO_CONTAINER, CREATE_RELATION_WHEN_MOVING_ELEMENT_TO_CONTAINER, HIDDEN_RELATIONS_TYPES, USE_NESTED_CONNECTIONS, NEW_RELATIONS_TYPES, NEW_REVERSE_RELATIONS_TYPES, GRID_SIZE, MARGIN_WIDTH, PALETTE_STATE, VIEW_TOOLTIPS, EDIT_NAME_ON_NEW_OBJECT, SHOW_SPECIALIZATIONS_IN_PALETTE, SHOW_QUICK_ADD_ON_TRIGGER, DIAGRAM_OBJECT_RESIZE_BEHAVIOUR, DIAGRAM_PASTE_SPECIAL_BEHAVIOR, VIEWPOINTS_FILTER_MODEL_TREE, VIEWPOINTS_GHOST_DIAGRAM_ELEMENTS, VIEWPOINTS_HIDE_PALETTE_ELEMENTS, VIEWPOINTS_HIDE_MAGIC_CONNECTOR_ELEMENTS, DEFAULT_ARCHIMATE_FIGURE_WIDTH, DEFAULT_ARCHIMATE_FIGURE_HEIGHT, DEFAULT_ARCHIMATE_FIGURE_TEXT_ALIGNMENT, DEFAULT_ARCHIMATE_FIGURE_TEXT_POSITION, ARCHIMATE_FIGURE_WORD_WRAP_STYLE, DEFAULT_GRADIENT, SKETCH_DEFAULT_BACKGROUND, DEFAULT_FIGURE_PREFIX, OPEN_DIAGRAMS_ON_LOAD, BACKUP_ON_SAVE, HIGHLIGHT_UNUSED_ELEMENTS_IN_MODEL_TREE, TREE_SEARCH_AUTO, SHOW_WARNING_ON_DELETE_FROM_TREE, SHOW_SPECIALIZATION_ICONS_IN_MODEL_TREE, SHOW_SPECIALIZATIONS_IN_MODEL_TREE_MENU, TREE_DISPLAY_NODE_INCREMENT, TREE_ALPHANUMERIC_SORT, USE_LABEL_EXPRESSIONS_IN_ANALYSIS_TABLE, ADD_DOCUMENTATION_NOTE_ON_RELATION_CHANGE, SCALE_IMAGE_EXPORT, ANIMATE_VIEW, ANIMATION_VIEW_TIME, ANIMATE_VISUALISER_NODES, ANIMATE_VISUALISER_TIME, EDGE_BROWSER, HINTS_BROWSER_JS_ENABLED, HINTS_BROWSER_EXTERNAL_HOSTS_ENABLED, PREFS_NETWORK_TIMEOUT, PREFS_PROXY_ENABLED, PREFS_PROXY_HOST, PREFS_PROXY_PORT, PREFS_PROXY_REQUIRES_AUTHENTICATION, PREFS_PROXY_USERNAME, PREFS_PROXY_PASSWORD, GRID_VISIBLE, GRID_SNAP, GRID_SHOW_GUIDELINES, LINK_VIEW, MRU_MAX, DOWNLOAD_URL, UPDATE_URL, PROPERTIES_SINGLE_COLUMN, SEARCHFILTER_NAME, SEARCHFILTER_DOCUMENTATION, SEARCHFILTER_PROPETY_VALUES, SEARCHFILTER_VIEWS, SEARCHFILTER_SHOW_ALL_FOLDERS, SEARCHFILTER_MATCH_CASE, SEARCHFILTER_USE_REGEX, MAX_DIAGRAMS_TO_OPEN_AT_ONCE, MARKDOWN_MODE.

## C.8 Tema / look & feel e i18n

- `com.archimatetool.editor.themes/plugin.xml`: temas E4 (`e4_default`, `e4_dark`, `e4_system`, `high-contrast`) + tema propio `com.archimatetool.editor.theme.basic`, con colores/fuentes temáticos (VIEW_BACKGROUND, VISUALISER_BACKGROUND, PALETTE_BACKGROUND, PALETTE_TITLE_BACKGROUND, PALETTE_TOOLBAR_BACKGROUND y las 6 fuentes: MODEL_TREE, NAVIGATOR_TREE, PROPERTIES_TABLE, ANALYSIS_TABLE, SINGLE_LINE_TEXT, MULTI_LINE_TEXT).
- **i18n**: el repo **no incluye language packs**; incluye el generador `other/com.archimatetool.nls/create-nls.xml` (Ant) que crea fragmentos `*.nl_<lang>` a partir de los plugins fuente (parámetros `lang_code`, `nls_version`, `bundle_name`, `bundle_vendor`). Idiomas disponibles = los que el usuario/comunidad genere; no hay `fragment.xml` de idioma en el árbol. Todos los plugins usan `messages.properties` + `plugin.properties` externalizados.

## C.9 Línea de comandos (`com.archimatetool.commandline` y `*.commandline`) — 24 opciones

- `--createEmptyModel`, `--loadModel <file>`, `--saveModel <file>`
- `--importModel <file>`, `--importModel.update`, `--importModel.updateAll`
- `--csv.import <dir>`, `--csv.export <dir>`, `--csv.exportDelimiter`, `--csv.exportEncoding`, `--csv.exportFilenamePrefix`, `--csv.exportExcelCompatible`, `--csv.exportStripNewLines`
- `--xmlexchange.import <file>`, `--xmlexchange.export <file>`, `--xmlexchange.exportFolders`, `--xmlexchange.exportLang`
- `--html.createReport <dir>`
- `--jasper.createReport <dir>`, `--jasper.filename`, `--jasper.title`, `--jasper.template`, `--jasper.locale`, `--jasper.format`

## C.10 Extensiones externas (mención)

- **jArchi** (scripting JS/Nashorn-GraalVM): plugin externo, no está en este repo.
- **coArchi / coArchi2** (colaboración vía Git): plugin externo, no está en este repo.
- Plugin Manager (`com.archimatetool.editor.pluginManager`) para instalar estos `.archiplugin`.

---

# D. FORMATOS

Rutas: `com.archimatetool.editor/src/com/archimatetool/editor/model/`, `org.opengroup.archimate.xmlexchange/`, `com.archimatetool.csv/`, `com.archimatetool.reports/`, `com.archimatetool.jasperreports/`, `com.archimatetool.templates/`, `com.archimatetool.export.svg/`.

1. **`.archimate`** — formato nativo (XMI/EMF, `ARCHIMATE_FILE_EXTENSION = ".archimate"`, `ModelVersion 5.0.0`); backup opcional al guardar (`BACKUP_ON_SAVE`). Imágenes embebidas en un archivo ZIP cuando el modelo tiene imágenes.
2. **Open Exchange XML (The Open Group)** — `org.opengroup.archimate.xmlexchange`: `XMLModelExporter` / `XMLModelImporter`, validación XSD (`XMLValidator`), mapeo de tipos (`XMLTypeMapper`), metadatos Dublin Core; opciones de exportación: incluir organización de carpetas (`exportFolders`), idioma (`exportLang`), validación.
3. **CSV** — `com.archimatetool.csv` con **3 ficheros**: `elements.csv`, `relations.csv`, `properties.csv` (`CSVConstants.ELEMENTS_FILENAME / RELATIONS_FILENAME / PROPERTIES_FILENAME`), con prefijo de nombre configurable, delimitador (`,` `;` tab), encoding, modo compatible con Excel (BOM), y strip de saltos de línea. Importación equivalente.
4. **Exportación de imagen** — `ImageExportProvider`: **PNG**, **JPG/JPEG**, **BMP**; `com.archimatetool.export.svg`: **SVG** (`SVGExportProvider`) y **PDF** (`PDFExportProvider`). Además Export As Image To Clipboard, escalado (`SCALE_IMAGE_EXPORT`), impresión de vista.
5. **Informe HTML** — `com.archimatetool.reports` (genera sitio HTML navegable con vistas como imágenes + páginas por elemento); CLI `--html.createReport`.
6. **Jasper Reports** — `com.archimatetool.jasperreports`: formatos **HTML, PDF, DOCX, PPT, RTF, ODT** (constantes `EXPORT_HTML`, `EXPORT_PDF`, `EXPORT_DOCX`, `EXPORT_PPT`, `EXPORT_RTF`, `EXPORT_ODT`); plantilla incluida `reports/Customizable Report`; opciones de título, nombre de fichero, plantilla y locale.
7. **Plantillas** — `.architemplate` (`ArchimateTemplateManager.ARCHIMATE_TEMPLATE_FILE_EXTENSION`, ZIP con `model.archimate` + manifest + miniaturas); ejemplo `com.archimatetool.templates/templates/customizable-report.architemplate`. Canvas: `.archicanvas` (4 plantillas incluidas). Hay plantillas de modelo y de vista/canvas, con "Template Manager" y colecciones de plantillas.
8. **Model Importer** — `com.archimatetool.modelimporter`: importar/mergear otro `.archimate` dentro del modelo actual, con modos update / updateAll y matcher de objetos por ID.

---

# CONTEO FINAL ESTIMADO

| Métrica | Valor |
|---|---|
| Tipos de elemento ArchiMate | **60** (+ Junction = 61 conceptos no-relación) |
| Tipos de relación | **11** |
| Viewpoints | **25** (+ "None"/sin viewpoint = 26 opciones) |
| Tipos de vista | 3 (ArchiMate View, Sketch, Canvas) + Diagram Reference |
| Objetos visuales no-ArchiMate | 8 (Group, Note, Image, Reference, Connection/línea, Sketch Sticky, Sketch Actor, Canvas Block/Sticky/Image) |
| Figuras alternativas (type 0/1) | 42 elementos con figura alternativa real; `hasAlternateFigure()` true para 60/61 (Junction excluido) |
| Acciones/comandos del editor | **≈ 138** (≈96 en el editor de diagramas incl. 26 viewpoints, ≈25 de aplicación, ≈17 del árbol de modelos); 38 `<command>` propios declarados en `plugin.xml` |
| Secciones de Properties view | 49 clases `*Section.java` (+2 de canvas) |
| Reglas del validador (Hammer) | **8** |
| Páginas de preferencias | 12 (11 propias + Keys) |
| Claves de preferencias | ~100 |
| Opciones de línea de comandos | **24** |
| Tipos de carpeta | 8 |
| Expresiones de etiqueta | 12 constructos + 19 prefijos |
| Formatos de exportación de imagen | 5 (PNG, JPG, BMP, SVG, PDF) |
| Formatos de informe | HTML + Jasper (HTML, PDF, DOCX, PPT, RTF, ODT) |