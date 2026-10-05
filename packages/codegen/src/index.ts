/**
 * `@all-draw/codegen`: generación de código a partir del modelo (`Workspace` de `@all-draw/core`). Paquete puro
 * (sin React ni DOM) y determinista (orden estable, sin marcas de tiempo).
 *
 * Generadores: UML clases → TypeScript / Java, ER → SQL (PostgreSQL / SQLite), máquina de estados → XState v5 y
 * tabla de transiciones, APIs → OpenAPI 3.1 y C4/ArchiMate → Structurizr DSL. Con `opts.viewId` cada uno trabaja
 * con lo que aparece en esa vista; sin vista, con todo el espacio de su notación.
 *
 * Los avisos son traducibles (`key` = texto en español con `{var}`); `WARNING_KEYS` y `GENERATOR_TEXTS` listan
 * todos los textos para que la UI les añada la traducción.
 */
import type { Workspace } from '@all-draw/core';
import type { CodegenOptions, CodegenResult, Generator, GeneratorId } from './types';
import { generateUmlTypescript } from './uml-typescript';
import { generateUmlJava } from './uml-java';
import { generateErSql } from './er-sql';
import { generateStatechart } from './statechart';
import { generateOpenApi, isApi, isOperation } from './openapi';
import { generateStructurizrDsl } from './structurizr-dsl';
import { isUmlClassifier } from './uml-model';

export type { CodeLanguage, CodeFile, CodegenWarning, CodegenResult, CodegenOptions, GeneratorId, Generator } from './types';
export { WARNING_KEYS, warningText } from './warnings';
export { statechartMachines, parseDelay, type MachineModel } from './statechart';
export { inferSchema, parseParamText } from './openapi';
export { parseAttributeLine, parseOperationLine, parseMult } from './uml-model';
export { toYaml } from './yaml';

const viewNotation = (ws: Workspace, viewId: string | null | undefined): string | null | undefined =>
  viewId ? ws.views[viewId]?.notationId ?? null : undefined;

const anyElement = (ws: Workspace, test: (typeId: string) => boolean) => Object.values(ws.elements).some(e => !e.template && test(e.typeId));

const umlApplies = (ws: Workspace, viewId?: string | null) => {
  const n = viewNotation(ws, viewId);
  return n === undefined ? Object.values(ws.elements).some(e => !e.template && isUmlClassifier(e)) : n === 'uml';
};
const erApplies = (ws: Workspace, viewId?: string | null) => {
  const n = viewNotation(ws, viewId);
  return n === undefined ? anyElement(ws, t => t === 'er:Entity') : n === 'er';
};
const statechartApplies = (ws: Workspace, viewId?: string | null) => {
  const n = viewNotation(ws, viewId);
  return n === undefined ? Object.values(ws.views).some(v => v.notationId === 'statechart') : n === 'statechart';
};

export const GENERATORS: Generator[] = [
  {
    id: 'uml-typescript',
    label: 'TypeScript (clases UML)',
    description: 'Clases, interfaces y enumeraciones TypeScript a partir del diagrama de clases.',
    applies: umlApplies,
    generate: (ws, opts) => generateUmlTypescript(ws, opts),
  },
  {
    id: 'uml-java',
    label: 'Java (clases UML)',
    description: 'Un fichero Java por clase, interfaz o enumeración del diagrama de clases.',
    applies: umlApplies,
    generate: (ws, opts) => generateUmlJava(ws, opts),
  },
  {
    id: 'er-postgres',
    label: 'SQL PostgreSQL',
    description: 'Esquema PostgreSQL (tablas, claves primarias y ajenas, índices) a partir del modelo entidad-relación.',
    applies: erApplies,
    generate: (ws, opts) => generateErSql(ws, opts ?? {}, 'postgres'),
  },
  {
    id: 'er-sqlite',
    label: 'SQL SQLite',
    description: 'Esquema SQLite (tablas, claves primarias y ajenas, índices) a partir del modelo entidad-relación.',
    applies: erApplies,
    generate: (ws, opts) => generateErSql(ws, opts ?? {}, 'sqlite'),
  },
  {
    id: 'statechart-xstate',
    label: 'Máquina XState',
    description: 'Máquina de estados XState v5 ejecutable, con stubs para las acciones y las guardas.',
    applies: statechartApplies,
    generate: (ws, opts) => generateStatechart(ws, opts ?? {}, 'xstate'),
  },
  {
    id: 'statechart-table',
    label: 'Tabla de transiciones',
    description: 'Tabla Markdown con las transiciones (evento, guarda, destino, acciones) y los estados.',
    applies: statechartApplies,
    generate: (ws, opts) => generateStatechart(ws, opts ?? {}, 'table'),
  },
  {
    id: 'openapi',
    label: 'OpenAPI',
    description: 'Un documento OpenAPI 3.1 en YAML por cada API, con sus operaciones, parámetros y cuerpos.',
    applies: (ws, viewId) => {
      if (!viewId) return Object.values(ws.elements).some(e => isOperation(ws, e));
      if (!ws.views[viewId]) return false;
      return Object.values(ws.nodes).some(n => n.viewId === viewId && n.elementId && ws.elements[n.elementId] && (isOperation(ws, ws.elements[n.elementId]!) || isApi(ws, ws.elements[n.elementId]!)));
    },
    generate: (ws, opts) => generateOpenApi(ws, opts),
  },
  {
    id: 'structurizr-dsl',
    label: 'Structurizr DSL',
    description: 'Workspace de Structurizr DSL (modelo, despliegue y vistas) a partir de C4 o ArchiMate.',
    applies: (ws, viewId) => {
      const n = viewNotation(ws, viewId);
      return n === undefined ? anyElement(ws, t => t.startsWith('c4:') || t.startsWith('archimate:')) : n === 'c4' || n === 'archimate';
    },
    generate: (ws, opts) => generateStructurizrDsl(ws, opts),
  },
];

/** Textos en español de `label`/`description` de los generadores (la UI los traduce). */
export const GENERATOR_TEXTS: readonly string[] = Object.freeze(GENERATORS.flatMap(g => [g.label, g.description]));

/** Generadores que tienen sentido para esa vista (o, sin vista, para el espacio), en el orden de `GENERATORS`. */
export function generatorsFor(ws: Workspace, viewId?: string | null): Generator[] {
  return GENERATORS.filter(g => g.applies(ws, viewId));
}

export function generate(id: GeneratorId, ws: Workspace, opts?: CodegenOptions): CodegenResult {
  const g = GENERATORS.find(x => x.id === id);
  if (!g) throw new Error(`Generador desconocido: ${id}`);
  return g.generate(ws, opts ?? {});
}
