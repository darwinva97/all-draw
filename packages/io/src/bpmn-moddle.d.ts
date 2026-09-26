/**
 * `bpmn-moddle` publica tipos para el metamodelo (`bpmn-moddle/types`) pero no para su entrada
 * principal. Declaración mínima de lo que usa `./bpmn.ts`; los elementos moddle son dinámicos.
 */
declare module 'bpmn-moddle' {
  export interface ModdleNs { prefix: string; localName: string; uri: string }
  export interface ModdlePropertyDescriptor {
    name: string;
    type: string;
    isMany?: boolean;
    isReference?: boolean;
    isAttr?: boolean;
    isBody?: boolean;
    isId?: boolean;
    default?: unknown;
  }
  export interface ModdleDescriptor {
    name: string;
    isGeneric?: boolean;
    ns: ModdleNs;
    properties: ModdlePropertyDescriptor[];
    propertiesByName: Record<string, ModdlePropertyDescriptor>;
  }
  export interface ModdleElement {
    $type: string;
    $descriptor: ModdleDescriptor;
    $attrs: Record<string, unknown>;
    $parent?: ModdleElement;
    $body?: string;
    $children?: ModdleElement[];
    id?: string;
    get(name: string): unknown;
    set(name: string, value: unknown): void;
    $instanceOf(type: string): boolean;
    [key: string]: unknown;
  }
  export interface ParseResult {
    rootElement: ModdleElement;
    references: unknown[];
    warnings: { message: string; error?: Error }[];
    elementsById: Record<string, ModdleElement>;
  }
  export class BpmnModdle {
    constructor(packages?: Record<string, unknown>, options?: Record<string, unknown>);
    create(type: string, attrs?: Record<string, unknown>): ModdleElement;
    createAny(name: string, nsUri: string, properties?: Record<string, unknown>): ModdleElement;
    getType(type: string): unknown;
    fromXML(xml: string, options?: Record<string, unknown>): Promise<ParseResult>;
    toXML(element: ModdleElement, options?: { format?: boolean; preamble?: boolean }): Promise<{ xml: string }>;
  }
}
