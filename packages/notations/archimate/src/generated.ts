// GENERADO — no editar. Ejecuta `pnpm --filter @all-draw/notation-archimate generate`.
// Fuente: ficheros de datos de Archi (_research/archi), ArchiMate 3.2.
import type { ElementType, RelationType } from '@all-draw/core';
import type { ValidityMatrix, Viewpoint, NotationCategory } from '@all-draw/core';

export const SPEC_VERSION = "ArchiMate 3.2";

/** Capas / categorías en el orden de la paleta de Archi. */
export const LAYERS: (NotationCategory & { elementTypes: string[] })[] = [
  {
    "id": "strategy",
    "name": "Strategy",
    "color": "#f5deaa",
    "order": 0,
    "elementTypes": [
      "archimate:Resource",
      "archimate:Capability",
      "archimate:ValueStream",
      "archimate:CourseOfAction"
    ]
  },
  {
    "id": "business",
    "name": "Business",
    "color": "#ffffb5",
    "order": 1,
    "elementTypes": [
      "archimate:BusinessActor",
      "archimate:BusinessRole",
      "archimate:BusinessCollaboration",
      "archimate:BusinessInterface",
      "archimate:BusinessProcess",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessEvent",
      "archimate:BusinessService",
      "archimate:BusinessObject",
      "archimate:Contract",
      "archimate:Representation",
      "archimate:Product"
    ]
  },
  {
    "id": "application",
    "name": "Application",
    "color": "#b5ffff",
    "order": 2,
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject"
    ]
  },
  {
    "id": "technology",
    "name": "Technology",
    "color": "#c9e7b7",
    "order": 3,
    "elementTypes": [
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact"
    ]
  },
  {
    "id": "physical",
    "name": "Physical",
    "color": "#c9e7b7",
    "order": 4,
    "elementTypes": [
      "archimate:Equipment",
      "archimate:Facility",
      "archimate:DistributionNetwork",
      "archimate:Material"
    ]
  },
  {
    "id": "motivation",
    "name": "Motivation",
    "color": "#ccccff",
    "order": 5,
    "elementTypes": [
      "archimate:Stakeholder",
      "archimate:Driver",
      "archimate:Assessment",
      "archimate:Goal",
      "archimate:Outcome",
      "archimate:Principle",
      "archimate:Requirement",
      "archimate:Constraint",
      "archimate:Meaning",
      "archimate:Value"
    ]
  },
  {
    "id": "implementation-migration",
    "name": "Implementation & Migration",
    "color": "#ffe0e0",
    "order": 6,
    "elementTypes": [
      "archimate:WorkPackage",
      "archimate:Deliverable",
      "archimate:ImplementationEvent",
      "archimate:Plateau",
      "archimate:Gap"
    ]
  },
  {
    "id": "other",
    "name": "Composite / Other",
    "color": "#ffffff",
    "order": 7,
    "elementTypes": [
      "archimate:Location",
      "archimate:Grouping"
    ]
  },
  {
    "id": "connector",
    "name": "Connectors",
    "color": "#000000",
    "order": 8,
    "elementTypes": [
      "archimate:Junction"
    ]
  }
];

export const CATEGORIES: NotationCategory[] = LAYERS.map(({ id, name, color, order }) => ({ id, name, color, order }));

/** 61 elementos (60 de la especificación + Junction). */
export const ELEMENTS: ElementType[] = [
  {
    "id": "archimate:Resource",
    "name": "Resource",
    "category": "strategy",
    "color": "#f5deaa",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Strategy",
      "aspect": "structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Capability",
    "name": "Capability",
    "category": "strategy",
    "color": "#f5deaa",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Strategy",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ValueStream",
    "name": "Value Stream",
    "category": "strategy",
    "color": "#f5deaa",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Strategy",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:CourseOfAction",
    "name": "Course of Action",
    "category": "strategy",
    "color": "#f5deaa",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Strategy",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessActor",
    "name": "Business Actor",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessRole",
    "name": "Business Role",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessCollaboration",
    "name": "Business Collaboration",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessInterface",
    "name": "Business Interface",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessProcess",
    "name": "Business Process",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessFunction",
    "name": "Business Function",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessInteraction",
    "name": "Business Interaction",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessEvent",
    "name": "Business Event",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessService",
    "name": "Business Service",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:BusinessObject",
    "name": "Business Object",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Contract",
    "name": "Contract",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Representation",
    "name": "Representation",
    "category": "business",
    "color": "#ffffb5",
    "shape": "note",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Product",
    "name": "Product",
    "category": "business",
    "color": "#ffffb5",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Business",
      "aspect": "composite",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationComponent",
    "name": "Application Component",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationCollaboration",
    "name": "Application Collaboration",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationInterface",
    "name": "Application Interface",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationFunction",
    "name": "Application Function",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationInteraction",
    "name": "Application Interaction",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationProcess",
    "name": "Application Process",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationEvent",
    "name": "Application Event",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ApplicationService",
    "name": "Application Service",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:DataObject",
    "name": "Data Object",
    "category": "application",
    "color": "#b5ffff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Application",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Node",
    "name": "Node",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Device",
    "name": "Device",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:SystemSoftware",
    "name": "System Software",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyCollaboration",
    "name": "Technology Collaboration",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyInterface",
    "name": "Technology Interface",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Path",
    "name": "Path",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:CommunicationNetwork",
    "name": "Communication Network",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyFunction",
    "name": "Technology Function",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyProcess",
    "name": "Technology Process",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyInteraction",
    "name": "Technology Interaction",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyEvent",
    "name": "Technology Event",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:TechnologyService",
    "name": "Technology Service",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Artifact",
    "name": "Artifact",
    "category": "technology",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Technology",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Equipment",
    "name": "Equipment",
    "category": "physical",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Physical",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Facility",
    "name": "Facility",
    "category": "physical",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Physical",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:DistributionNetwork",
    "name": "Distribution Network",
    "category": "physical",
    "color": "#c9e7b7",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Physical",
      "aspect": "active-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Material",
    "name": "Material",
    "category": "physical",
    "color": "#c9e7b7",
    "shape": "hexagon",
    "fields": [],
    "meta": {
      "layer": "Physical",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Stakeholder",
    "name": "Stakeholder",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Driver",
    "name": "Driver",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Assessment",
    "name": "Assessment",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Goal",
    "name": "Goal",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Outcome",
    "name": "Outcome",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Principle",
    "name": "Principle",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Requirement",
    "name": "Requirement",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Constraint",
    "name": "Constraint",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Meaning",
    "name": "Meaning",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "ellipse",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Value",
    "name": "Value",
    "category": "motivation",
    "color": "#ccccff",
    "shape": "ellipse",
    "fields": [],
    "meta": {
      "layer": "Motivation",
      "aspect": "motivation",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:WorkPackage",
    "name": "Work Package",
    "category": "implementation-migration",
    "color": "#ffe0e0",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Implementation & Migration",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Deliverable",
    "name": "Deliverable",
    "category": "implementation-migration",
    "color": "#ffe0e0",
    "shape": "note",
    "fields": [],
    "meta": {
      "layer": "Implementation & Migration",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:ImplementationEvent",
    "name": "Implementation Event",
    "category": "implementation-migration",
    "color": "#ffe0e0",
    "shape": "rounded",
    "fields": [],
    "meta": {
      "layer": "Implementation & Migration",
      "aspect": "behavior",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Plateau",
    "name": "Plateau",
    "category": "implementation-migration",
    "color": "#ffe0e0",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Implementation & Migration",
      "aspect": "composite",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Gap",
    "name": "Gap",
    "category": "implementation-migration",
    "color": "#ffe0e0",
    "shape": "rect",
    "fields": [],
    "meta": {
      "layer": "Implementation & Migration",
      "aspect": "passive-structure",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Location",
    "name": "Location",
    "category": "other",
    "color": "#edcfe2",
    "shape": "rect",
    "container": true,
    "fields": [],
    "meta": {
      "layer": "Composite / Other",
      "aspect": "composite",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Grouping",
    "name": "Grouping",
    "category": "other",
    "color": "#ffffff",
    "shape": "group",
    "container": true,
    "fields": [],
    "meta": {
      "layer": "Composite / Other",
      "aspect": "composite",
      "alternateFigure": true,
      "spec": "ArchiMate 3.2"
    }
  },
  {
    "id": "archimate:Junction",
    "name": "Junction",
    "category": "connector",
    "color": "#000000",
    "shape": "circle",
    "fields": [
      {
        "key": "junctionType",
        "label": "Junction type",
        "kind": "select",
        "options": "and,or",
        "doc": "And-junction (por defecto) u Or-junction."
      }
    ],
    "meta": {
      "layer": "Connectors",
      "aspect": "connector",
      "alternateFigure": false,
      "spec": "ArchiMate 3.2"
    }
  }
];

/** 11 relaciones. */
export const RELATIONS: RelationType[] = [
  {
    "id": "archimate:Composition",
    "name": "Composition",
    "category": "structural",
    "line": "solid",
    "sourceHead": "filled-diamond",
    "targetHead": "none",
    "fields": [],
    "relationEnds": true,
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "CompositionRelationship"
    }
  },
  {
    "id": "archimate:Aggregation",
    "name": "Aggregation",
    "category": "structural",
    "line": "solid",
    "sourceHead": "diamond",
    "targetHead": "none",
    "fields": [],
    "relationEnds": true,
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "AggregationRelationship"
    }
  },
  {
    "id": "archimate:Assignment",
    "name": "Assignment",
    "category": "structural",
    "line": "solid",
    "sourceHead": "dot",
    "targetHead": "arrow",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "AssignmentRelationship"
    }
  },
  {
    "id": "archimate:Realization",
    "name": "Realization",
    "category": "structural",
    "line": "dotted",
    "sourceHead": "none",
    "targetHead": "triangle",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "RealizationRelationship"
    }
  },
  {
    "id": "archimate:Serving",
    "name": "Serving",
    "category": "dependency",
    "line": "solid",
    "sourceHead": "none",
    "targetHead": "open",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "ServingRelationship"
    }
  },
  {
    "id": "archimate:Access",
    "name": "Access",
    "category": "dependency",
    "line": "dotted",
    "sourceHead": "none",
    "targetHead": "open",
    "fields": [
      {
        "key": "accessType",
        "label": "Access type",
        "kind": "select",
        "options": "write,read,access,readwrite",
        "doc": "write (por defecto), read, access (sin especificar), readwrite."
      }
    ],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "AccessRelationship"
    }
  },
  {
    "id": "archimate:Influence",
    "name": "Influence",
    "category": "dependency",
    "line": "dashed",
    "sourceHead": "none",
    "targetHead": "open",
    "fields": [
      {
        "key": "strength",
        "label": "Strength",
        "kind": "text",
        "doc": "p.ej. +, ++, -, --, 0…10"
      }
    ],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "InfluenceRelationship"
    }
  },
  {
    "id": "archimate:Triggering",
    "name": "Triggering",
    "category": "dynamic",
    "line": "solid",
    "sourceHead": "none",
    "targetHead": "arrow",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "TriggeringRelationship"
    }
  },
  {
    "id": "archimate:Flow",
    "name": "Flow",
    "category": "dynamic",
    "line": "dashed",
    "sourceHead": "none",
    "targetHead": "arrow",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "FlowRelationship"
    }
  },
  {
    "id": "archimate:Specialization",
    "name": "Specialization",
    "category": "other",
    "line": "solid",
    "sourceHead": "none",
    "targetHead": "triangle",
    "fields": [],
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "SpecializationRelationship"
    }
  },
  {
    "id": "archimate:Association",
    "name": "Association",
    "category": "dependency",
    "line": "solid",
    "sourceHead": "none",
    "targetHead": "none",
    "fields": [
      {
        "key": "directed",
        "label": "Directed",
        "kind": "checkbox",
        "doc": "Asociación dirigida (media flecha en destino)."
      }
    ],
    "relationEnds": true,
    "meta": {
      "spec": "ArchiMate 3.2",
      "archiClass": "AssociationRelationship"
    }
  }
];

/** Nombres locales de todos los conceptos de la matriz (62: elementos + Junction + Relationship). */
export const CONCEPTS: string[] = [
  "ApplicationCollaboration",
  "ApplicationComponent",
  "ApplicationEvent",
  "ApplicationFunction",
  "ApplicationInteraction",
  "ApplicationInterface",
  "ApplicationProcess",
  "ApplicationService",
  "Artifact",
  "Assessment",
  "BusinessActor",
  "BusinessCollaboration",
  "BusinessEvent",
  "BusinessFunction",
  "BusinessInteraction",
  "BusinessInterface",
  "BusinessObject",
  "BusinessProcess",
  "BusinessRole",
  "BusinessService",
  "Capability",
  "CommunicationNetwork",
  "Constraint",
  "Contract",
  "CourseOfAction",
  "DataObject",
  "Deliverable",
  "Device",
  "DistributionNetwork",
  "Driver",
  "Equipment",
  "Facility",
  "Gap",
  "Goal",
  "Grouping",
  "ImplementationEvent",
  "Junction",
  "Location",
  "Material",
  "Meaning",
  "Node",
  "Outcome",
  "Path",
  "Plateau",
  "Principle",
  "Product",
  "Relationship",
  "Representation",
  "Requirement",
  "Resource",
  "Stakeholder",
  "SystemSoftware",
  "TechnologyCollaboration",
  "TechnologyEvent",
  "TechnologyFunction",
  "TechnologyInteraction",
  "TechnologyInterface",
  "TechnologyProcess",
  "TechnologyService",
  "Value",
  "ValueStream",
  "WorkPackage"
];

/** Matriz de validez: `VALIDITY[Source][Target]` = ids de relación permitidos (origen → destino). */
export const VALIDITY: ValidityMatrix = {
  "ApplicationCollaboration": {
    "ApplicationCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationComponent": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationEvent": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationFunction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationInteraction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationInterface": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationProcess": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ApplicationService": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Artifact": {
    "ApplicationCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationComponent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Artifact": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Assessment": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessActor": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "BusinessCollaboration": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "BusinessEvent": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessFunction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessInteraction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessInterface": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessObject": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessProcess": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "BusinessRole": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "BusinessService": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Capability": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "CommunicationNetwork": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Constraint": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Contract": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "CourseOfAction": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "DataObject": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Deliverable": {
    "ApplicationCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationComponent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Artifact": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessRole": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Device": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DistributionNetwork": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Facility": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Material": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Plateau": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Device": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "DistributionNetwork": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "Driver": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Equipment": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Facility": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "Gap": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Goal": [
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Goal": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Grouping": {
    "ApplicationCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Assessment": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "BusinessActor": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "CourseOfAction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Deliverable": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Goal": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Meaning": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Node": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Path": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "Principle": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Product": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Requirement": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Resource": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ValueStream": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ]
  },
  "ImplementationEvent": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "ImplementationEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering"
    ]
  },
  "Junction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [],
    "Representation": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering"
    ]
  },
  "Location": {
    "ApplicationCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "Material": {
    "ApplicationCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationComponent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Artifact": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Meaning": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Node": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "Outcome": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Path": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "Plateau": {
    "ApplicationCollaboration": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationComponent": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationEvent": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationFunction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInteraction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInterface": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationProcess": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationService": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Artifact": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessCollaboration": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessEvent": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessFunction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInteraction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInterface": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessObject": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessRole": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessService": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Capability": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Constraint": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Device": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "DistributionNetwork": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Facility": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "ImplementationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Material": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Outcome": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Plateau": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Relationship": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Requirement": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyCollaboration": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyEvent": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyService": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering"
    ]
  },
  "Principle": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Product": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Relationship": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Association"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Representation": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Requirement": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Resource": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Stakeholder": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "SystemSoftware": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyCollaboration": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Assignment",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Assignment",
      "archimate:Association"
    ]
  },
  "TechnologyEvent": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyFunction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyInteraction": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyInterface": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Assignment",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyProcess": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "TechnologyService": {
    "ApplicationCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationComponent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ApplicationService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Artifact": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessRole": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "BusinessService": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Access",
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DistributionNetwork": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Facility": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Material": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Access",
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyCollaboration": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyFunction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInteraction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyInterface": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyProcess": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "TechnologyService": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "Value": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Association"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Association"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Resource": [
      "archimate:Association"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Composition",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Specialization"
    ],
    "ValueStream": [
      "archimate:Association"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "ValueStream": {
    "ApplicationCollaboration": [
      "archimate:Association"
    ],
    "ApplicationComponent": [
      "archimate:Association"
    ],
    "ApplicationEvent": [
      "archimate:Association"
    ],
    "ApplicationFunction": [
      "archimate:Association"
    ],
    "ApplicationInteraction": [
      "archimate:Association"
    ],
    "ApplicationInterface": [
      "archimate:Association"
    ],
    "ApplicationProcess": [
      "archimate:Association"
    ],
    "ApplicationService": [
      "archimate:Association"
    ],
    "Artifact": [
      "archimate:Association"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association"
    ],
    "BusinessCollaboration": [
      "archimate:Association"
    ],
    "BusinessEvent": [
      "archimate:Association"
    ],
    "BusinessFunction": [
      "archimate:Association"
    ],
    "BusinessInteraction": [
      "archimate:Association"
    ],
    "BusinessInterface": [
      "archimate:Association"
    ],
    "BusinessObject": [
      "archimate:Association"
    ],
    "BusinessProcess": [
      "archimate:Association"
    ],
    "BusinessRole": [
      "archimate:Association"
    ],
    "BusinessService": [
      "archimate:Association"
    ],
    "Capability": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "CommunicationNetwork": [
      "archimate:Association"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association"
    ],
    "CourseOfAction": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "DataObject": [
      "archimate:Association"
    ],
    "Deliverable": [
      "archimate:Association"
    ],
    "Device": [
      "archimate:Association"
    ],
    "DistributionNetwork": [
      "archimate:Association"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association"
    ],
    "Facility": [
      "archimate:Association"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "ImplementationEvent": [
      "archimate:Association"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association"
    ],
    "Material": [
      "archimate:Association"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association"
    ],
    "Plateau": [
      "archimate:Association"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "SystemSoftware": [
      "archimate:Association"
    ],
    "TechnologyCollaboration": [
      "archimate:Association"
    ],
    "TechnologyEvent": [
      "archimate:Association"
    ],
    "TechnologyFunction": [
      "archimate:Association"
    ],
    "TechnologyInteraction": [
      "archimate:Association"
    ],
    "TechnologyInterface": [
      "archimate:Association"
    ],
    "TechnologyProcess": [
      "archimate:Association"
    ],
    "TechnologyService": [
      "archimate:Association"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "WorkPackage": [
      "archimate:Association"
    ]
  },
  "WorkPackage": {
    "ApplicationCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationComponent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "ApplicationService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Artifact": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Assessment": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "BusinessActor": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessRole": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "BusinessService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Capability": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CommunicationNetwork": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Constraint": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Contract": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "CourseOfAction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DataObject": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Deliverable": [
      "archimate:Access",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Device": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "DistributionNetwork": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Driver": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Equipment": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Facility": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Gap": [
      "archimate:Association"
    ],
    "Goal": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Grouping": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering"
    ],
    "ImplementationEvent": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Triggering"
    ],
    "Junction": [
      "archimate:Access",
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Assignment",
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Specialization",
      "archimate:Triggering",
      "archimate:Serving"
    ],
    "Location": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Material": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Meaning": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "Node": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Outcome": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Path": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Plateau": [
      "archimate:Flow",
      "archimate:Association",
      "archimate:Realization",
      "archimate:Triggering"
    ],
    "Principle": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Product": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Relationship": [
      "archimate:Association"
    ],
    "Representation": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Requirement": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "Resource": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Stakeholder": [
      "archimate:Influence",
      "archimate:Association",
      "archimate:Realization"
    ],
    "SystemSoftware": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyCollaboration": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyEvent": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyFunction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInteraction": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyInterface": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyProcess": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "TechnologyService": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "Value": [
      "archimate:Influence",
      "archimate:Association"
    ],
    "ValueStream": [
      "archimate:Association",
      "archimate:Realization"
    ],
    "WorkPackage": [
      "archimate:Composition",
      "archimate:Flow",
      "archimate:Aggregation",
      "archimate:Association",
      "archimate:Specialization",
      "archimate:Triggering"
    ]
  }
};

/** 25 viewpoints, con macros de capa expandidas. */
export const VIEWPOINTS: Viewpoint[] = [
  {
    "id": "organization",
    "name": "Organization",
    "elementTypes": [
      "archimate:BusinessActor",
      "archimate:BusinessCollaboration",
      "archimate:BusinessInterface",
      "archimate:BusinessRole",
      "archimate:Location",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "business_process_cooperation",
    "name": "Business Process Cooperation",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:BusinessActor",
      "archimate:BusinessCollaboration",
      "archimate:BusinessEvent",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessInterface",
      "archimate:BusinessObject",
      "archimate:BusinessProcess",
      "archimate:BusinessRole",
      "archimate:BusinessService",
      "archimate:Location",
      "archimate:Representation",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "product",
    "name": "Product",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Artifact",
      "archimate:BusinessActor",
      "archimate:BusinessCollaboration",
      "archimate:BusinessEvent",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessInterface",
      "archimate:BusinessObject",
      "archimate:BusinessProcess",
      "archimate:BusinessRole",
      "archimate:BusinessService",
      "archimate:Contract",
      "archimate:Material",
      "archimate:Product",
      "archimate:TechnologyService",
      "archimate:Value",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "application_cooperation",
    "name": "Application Cooperation",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Location",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "application_structure",
    "name": "Application Structure",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:DataObject",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "application_usage",
    "name": "Application Usage",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:BusinessActor",
      "archimate:BusinessCollaboration",
      "archimate:BusinessEvent",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessObject",
      "archimate:BusinessProcess",
      "archimate:BusinessRole",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "implementation_deployment",
    "name": "Implementation and Deployment",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Artifact",
      "archimate:Path",
      "archimate:SystemSoftware",
      "archimate:TechnologyFunction",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyInterface",
      "archimate:TechnologyProcess",
      "archimate:TechnologyService",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "technology",
    "name": "Technology",
    "elementTypes": [
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact",
      "archimate:Location",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "technology_usage",
    "name": "Technology Usage",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationEvent",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "information_structure",
    "name": "Information Structure",
    "elementTypes": [
      "archimate:Artifact",
      "archimate:BusinessObject",
      "archimate:DataObject",
      "archimate:Meaning",
      "archimate:Representation",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "service_realization",
    "name": "Service Realization",
    "elementTypes": [
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:BusinessActor",
      "archimate:BusinessCollaboration",
      "archimate:BusinessEvent",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessInterface",
      "archimate:BusinessObject",
      "archimate:BusinessProcess",
      "archimate:BusinessRole",
      "archimate:BusinessService",
      "archimate:Representation",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "physical",
    "name": "Physical",
    "elementTypes": [
      "archimate:Equipment",
      "archimate:Facility",
      "archimate:DistributionNetwork",
      "archimate:Material",
      "archimate:CommunicationNetwork",
      "archimate:Device",
      "archimate:Location",
      "archimate:Node",
      "archimate:Path",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "stakeholder",
    "name": "Stakeholder",
    "elementTypes": [
      "archimate:Assessment",
      "archimate:Driver",
      "archimate:Goal",
      "archimate:Outcome",
      "archimate:Stakeholder",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "goal_realization",
    "name": "Goal Realization",
    "elementTypes": [
      "archimate:Constraint",
      "archimate:Goal",
      "archimate:Outcome",
      "archimate:Principle",
      "archimate:Requirement",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "requirements_realization",
    "name": "Requirements Realization",
    "elementTypes": [
      "archimate:Constraint",
      "archimate:Goal",
      "archimate:Meaning",
      "archimate:Outcome",
      "archimate:Principle",
      "archimate:Requirement",
      "archimate:Value",
      "archimate:Resource",
      "archimate:Capability",
      "archimate:ValueStream",
      "archimate:CourseOfAction",
      "archimate:BusinessActor",
      "archimate:BusinessRole",
      "archimate:BusinessCollaboration",
      "archimate:BusinessInterface",
      "archimate:BusinessProcess",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessEvent",
      "archimate:BusinessService",
      "archimate:BusinessObject",
      "archimate:Contract",
      "archimate:Representation",
      "archimate:Product",
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact",
      "archimate:Location",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "motivation",
    "name": "Motivation",
    "elementTypes": [
      "archimate:Stakeholder",
      "archimate:Driver",
      "archimate:Assessment",
      "archimate:Goal",
      "archimate:Outcome",
      "archimate:Principle",
      "archimate:Requirement",
      "archimate:Constraint",
      "archimate:Meaning",
      "archimate:Value",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "strategy",
    "name": "Strategy",
    "elementTypes": [
      "archimate:Resource",
      "archimate:Capability",
      "archimate:ValueStream",
      "archimate:CourseOfAction",
      "archimate:Outcome",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "capability",
    "name": "Capability Map",
    "elementTypes": [
      "archimate:Capability",
      "archimate:Outcome",
      "archimate:Resource",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "value_stream",
    "name": "Value Stream",
    "elementTypes": [
      "archimate:Capability",
      "archimate:Outcome",
      "archimate:Stakeholder",
      "archimate:ValueStream",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "outcome_realization",
    "name": "Outcome Realization",
    "elementTypes": [
      "archimate:Capability",
      "archimate:Meaning",
      "archimate:Outcome",
      "archimate:Resource",
      "archimate:Value",
      "archimate:ValueStream",
      "archimate:BusinessActor",
      "archimate:BusinessRole",
      "archimate:BusinessCollaboration",
      "archimate:BusinessInterface",
      "archimate:BusinessProcess",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessEvent",
      "archimate:BusinessService",
      "archimate:BusinessObject",
      "archimate:Contract",
      "archimate:Representation",
      "archimate:Product",
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact",
      "archimate:Location",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "resource",
    "name": "Resource Map",
    "elementTypes": [
      "archimate:Capability",
      "archimate:Resource",
      "archimate:WorkPackage",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "project",
    "name": "Project",
    "elementTypes": [
      "archimate:BusinessActor",
      "archimate:BusinessRole",
      "archimate:Deliverable",
      "archimate:Goal",
      "archimate:ImplementationEvent",
      "archimate:Outcome",
      "archimate:WorkPackage",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "migration",
    "name": "Migration",
    "elementTypes": [
      "archimate:Gap",
      "archimate:Plateau",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "implementation_migration",
    "name": "Implementation and Migration",
    "elementTypes": [
      "archimate:BusinessActor",
      "archimate:BusinessRole",
      "archimate:BusinessCollaboration",
      "archimate:BusinessInterface",
      "archimate:BusinessProcess",
      "archimate:BusinessFunction",
      "archimate:BusinessInteraction",
      "archimate:BusinessEvent",
      "archimate:BusinessService",
      "archimate:BusinessObject",
      "archimate:Contract",
      "archimate:Representation",
      "archimate:Product",
      "archimate:ApplicationComponent",
      "archimate:ApplicationCollaboration",
      "archimate:ApplicationInterface",
      "archimate:ApplicationFunction",
      "archimate:ApplicationInteraction",
      "archimate:ApplicationProcess",
      "archimate:ApplicationEvent",
      "archimate:ApplicationService",
      "archimate:DataObject",
      "archimate:Node",
      "archimate:Device",
      "archimate:SystemSoftware",
      "archimate:TechnologyCollaboration",
      "archimate:TechnologyInterface",
      "archimate:Path",
      "archimate:CommunicationNetwork",
      "archimate:TechnologyFunction",
      "archimate:TechnologyProcess",
      "archimate:TechnologyInteraction",
      "archimate:TechnologyEvent",
      "archimate:TechnologyService",
      "archimate:Artifact",
      "archimate:WorkPackage",
      "archimate:Deliverable",
      "archimate:ImplementationEvent",
      "archimate:Plateau",
      "archimate:Gap",
      "archimate:Constraint",
      "archimate:Goal",
      "archimate:Location",
      "archimate:Requirement",
      "archimate:Junction",
      "archimate:Grouping"
    ]
  },
  {
    "id": "layered",
    "name": "Layered",
    "elementTypes": []
  }
];
