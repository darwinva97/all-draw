#!/usr/bin/env node
/**
 * Genera `src/generated.ts` (semilla del catálogo de tipos de diagrama) a partir de
 * `_research/catalogo-corporativo-ti/data/catalogo.json` (500 nombres de diagramas en 10
 * categorías, sin ids ni gramática).
 *
 * De esas 500 entradas se quedan solo las que son **notaciones formales o formatos con
 * gramática reconocible** (ERD, BPMN, UML, C4, DFD, matrices, roadmaps…), no los "temas
 * dibujados" (Kubernetes Ingress Diagram, Circuit Breaker Diagram…). La selección es una lista
 * cerrada por número de entrada (`n`) con, opcionalmente, el pack de all-draw equivalente y una
 * URL de referencia. Sin dependencias.
 *
 * Uso: `node packages/notations/catalog/scripts/seed.mjs`
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const ROOT = resolve(PKG, '../../..');
const SOURCE = join(ROOT, '_research/catalogo-corporativo-ti/data/catalogo.json');
const OUT = join(PKG, 'src/generated.ts');

/** Ids reales de los packs de all-draw (`NotationPack.id`). */
const PACKS = ['archimate', 'bpmn', 'statechart', 'c4', 'sequence', 'er', 'uml', 'mindmap', 'flow', 'dfd', 'grid', 'freeform'];

const URL = {
  archimate: 'https://pubs.opengroup.org/architecture/archimate32-doc/',
  bpmn: 'https://www.omg.org/spec/BPMN/2.0/',
  uml: 'https://www.omg.org/spec/UML/2.5.1/',
  c4: 'https://c4model.com/',
  togaf: 'https://pubs.opengroup.org/togaf-standard/',
  dmn: 'https://www.omg.org/spec/DMN/',
  iso5807: 'https://www.iso.org/standard/11955.html',
  chen: 'https://doi.org/10.1145/320434.320440',
  yourdon: 'https://en.wikipedia.org/wiki/Data-flow_diagram',
  ddd: 'https://www.domainlanguage.com/ddd/reference/',
  storymap: 'https://www.jpattonassociates.com/story-mapping/',
  wbs: 'https://www.pmi.org/pmbok-guide-standards/foundational/pmbok',
  bmc: 'https://www.strategyzer.com/library/the-business-model-canvas',
  safe: 'https://scaledagileframework.com/',
};

/**
 * Selección: `n` → [notationId | null, url | null]. El nombre, la familia (categoría) y la
 * descripción salen del fichero de datos.
 */
const SELECTION = {
  // Arquitectura empresarial y corporativa
  1: ['archimate', URL.archimate], 2: ['archimate', URL.archimate], 3: ['archimate', URL.archimate], 4: ['archimate', URL.archimate],
  5: ['archimate', URL.archimate], 6: ['archimate', URL.archimate], 7: ['archimate', URL.archimate], 8: ['archimate', URL.archimate],
  9: ['archimate', URL.archimate], 10: ['grid', null], 11: ['archimate', URL.archimate], 12: ['archimate', URL.archimate],
  13: ['grid', URL.bmc], 16: ['archimate', URL.archimate], 17: ['archimate', URL.archimate], 18: ['mindmap', null],
  25: ['archimate', URL.archimate], 26: ['archimate', URL.archimate], 27: ['archimate', URL.archimate], 28: ['archimate', URL.archimate],
  29: ['archimate', URL.archimate], 30: ['archimate', URL.archimate], 33: ['archimate', URL.togaf],
  37: ['grid', URL.togaf], 38: ['grid', URL.togaf], 39: ['grid', URL.togaf], 40: ['grid', URL.togaf], 41: ['grid', URL.togaf], 42: ['grid', URL.togaf],
  43: ['grid', null], 44: ['grid', null], 45: ['archimate', URL.archimate], 47: ['archimate', URL.archimate],
  // Negocio y procesos
  51: ['bpmn', URL.bpmn], 52: ['flow', URL.iso5807], 53: ['bpmn', URL.bpmn], 56: ['bpmn', URL.bpmn], 57: ['bpmn', URL.bpmn],
  59: ['mindmap', null], 60: ['mindmap', null], 64: ['bpmn', URL.bpmn], 65: ['bpmn', URL.bpmn], 66: [null, URL.bpmn], 67: [null, URL.bpmn],
  68: ['bpmn', URL.bpmn], 69: ['bpmn', URL.bpmn], 70: ['bpmn', URL.bpmn], 71: ['flow', URL.iso5807], 72: ['statechart', URL.uml],
  74: ['bpmn', URL.bpmn], 76: ['flow', URL.dmn], 77: ['mindmap', URL.dmn], 78: ['grid', URL.dmn], 82: ['grid', null], 83: ['grid', null],
  84: ['bpmn', URL.bpmn], 85: ['bpmn', URL.bpmn], 86: ['flow', URL.iso5807], 87: ['archimate', URL.archimate], 88: ['grid', null],
  90: ['grid', null], 92: ['flow', null], 96: ['statechart', URL.uml], 97: ['statechart', URL.uml],
  // UML y modelado de software
  101: [null, URL.uml], 102: ['uml', URL.uml], 103: ['uml', URL.uml], 104: ['sequence', URL.uml], 105: [null, URL.uml], 106: ['flow', URL.uml],
  107: ['statechart', URL.uml], 108: [null, URL.uml], 109: [null, URL.uml], 110: ['uml', URL.uml], 111: [null, URL.uml], 112: [null, URL.uml],
  113: [null, URL.uml], 114: [null, URL.uml], 115: [null, URL.uml], 116: [null, URL.uml], 117: ['uml', URL.uml], 118: ['uml', URL.uml],
  119: ['uml', URL.uml], 120: ['er', URL.uml], 121: [null, URL.uml], 123: ['sequence', URL.uml], 124: ['sequence', URL.uml],
  126: ['statechart', URL.uml], 127: ['statechart', URL.uml], 128: ['statechart', URL.uml], 134: ['uml', URL.uml], 135: ['uml', URL.uml],
  145: ['uml', URL.uml], 150: [null, URL.uml],
  // C4, arquitectura y diseño
  151: ['c4', URL.c4], 152: ['c4', URL.c4], 153: ['c4', URL.c4], 154: ['c4', URL.c4], 155: ['c4', URL.c4], 156: ['c4', URL.c4],
  157: ['dfd', URL.yourdon], 158: ['c4', URL.c4], 178: [null, URL.ddd], 179: [null, URL.ddd], 180: [null, URL.ddd], 181: ['uml', URL.ddd],
  182: ['uml', URL.ddd], 183: [null, URL.ddd],
  // APIs, integración y microservicios
  207: ['sequence', URL.uml], 219: ['sequence', null], 220: ['sequence', null], 221: ['sequence', null], 248: ['sequence', URL.uml],
  // Datos y bases de datos
  251: ['er', URL.chen], 252: ['er', URL.chen], 253: ['er', URL.chen], 254: ['er', URL.chen], 255: ['er', null], 258: ['er', null],
  260: ['dfd', URL.yourdon], 261: ['dfd', URL.yourdon], 262: [null, null], 264: ['statechart', null],
  // Cloud, infraestructura y redes
  313: [null, null], 340: ['sequence', null], 341: ['sequence', null], 342: ['sequence', null],
  // DevOps, Kubernetes y operaciones
  351: ['flow', null], 355: [null, null], 356: [null, null], 382: ['statechart', null],
  // Seguridad, QA y riesgo
  410: ['sequence', null], 411: ['sequence', null], 413: ['sequence', null], 420: ['dfd', URL.yourdon], 421: ['dfd', URL.yourdon],
  424: ['dfd', URL.yourdon], 431: ['grid', null], 432: ['grid', null], 443: [null, null], 447: ['statechart', URL.uml],
  // Producto, proyectos, gestión y operaciones corporativas
  451: [null, null], 452: [null, null], 458: ['grid', null], 459: [null, URL.safe], 461: ['mindmap', URL.safe], 462: ['mindmap', URL.safe],
  463: ['grid', URL.storymap], 464: ['grid', URL.storymap], 468: ['mindmap', URL.wbs], 469: ['mindmap', null], 470: [null, null],
  471: [null, URL.wbs], 472: [null, URL.wbs], 473: [null, URL.wbs], 474: [null, URL.wbs], 475: ['grid', null], 476: ['grid', null],
  482: ['grid', null], 485: [null, null], 491: ['mindmap', null], 492: ['mindmap', null],
};

/** Descripción corta por pack (la fuente no trae descripciones). */
const DESCRIPTION = {
  archimate: 'Se modela con ArchiMate: elementos de negocio, aplicación, tecnología, motivación e implementación.',
  bpmn: 'Se modela con BPMN 2.0: pools, lanes, tareas, eventos, gateways y flujos.',
  statechart: 'Se modela como máquina de estados: estados, transiciones y pseudoestados.',
  c4: 'Se modela con C4: personas, sistemas, contenedores, componentes y despliegue.',
  sequence: 'Se modela como diagrama de secuencia: líneas de vida y mensajes ordenados.',
  er: 'Se modela como entidad-relación: entidades con atributos y cardinalidades.',
  uml: 'Se modela como diagrama de clases UML: clasificadores y sus relaciones.',
  mindmap: 'Se modela como árbol/mapa mental: una raíz y ramas.',
  flow: 'Se modela como diagrama de flujo: pasos, decisiones y terminales.',
  dfd: 'Se modela como diagrama de flujo de datos: procesos, almacenes, entidades externas y flujos.',
  grid: 'Se modela como rejilla: filas (capas) por columnas (etapas) con celdas.',
  freeform: 'Lienzo libre.',
};

const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const all = JSON.parse(readFileSync(SOURCE, 'utf8'));
const diagrams = all.filter(e => e.catalogo === 'diagramas');
if (diagrams.length !== 500) throw new Error(`Esperaba 500 diagramas, hay ${diagrams.length}`);
const byN = new Map(diagrams.map(e => [e.n, e]));

const seen = new Set();
const kinds = [];
for (const [nStr, [notationId, url]] of Object.entries(SELECTION)) {
  const n = Number(nStr);
  const entry = byN.get(n);
  if (!entry) throw new Error(`No existe la entrada ${n}`);
  if (notationId && !PACKS.includes(notationId)) throw new Error(`Pack desconocido ${notationId} en ${n}`);
  const id = slug(entry.nombre);
  if (seen.has(id)) throw new Error(`Id duplicado ${id} (${n})`);
  seen.add(id);
  const description = notationId ? DESCRIPTION[notationId] : 'Sin pack equivalente todavía: se dibuja en lienzo libre.';
  kinds.push({ id, n, name: entry.nombre, family: entry.categoria, description, notationId: notationId ?? undefined, url: url ?? undefined });
}
kinds.sort((a, b) => a.n - b.n);

const q = (s) => JSON.stringify(s);
const lines = kinds.map(k => {
  const parts = [`id: ${q(k.id)}`, `n: ${k.n}`, `name: ${q(k.name)}`, `family: ${q(k.family)}`, `description: ${q(k.description)}`];
  if (k.notationId) parts.push(`notationId: ${q(k.notationId)}`);
  if (k.url) parts.push(`url: ${q(k.url)}`);
  return `  { ${parts.join(', ')} },`;
});

const families = [...new Set(kinds.map(k => k.family))];
const out = `/**
 * GENERADO por scripts/seed.mjs a partir de _research/catalogo-corporativo-ti (no editar a mano).
 * ${kinds.length} tipos de diagrama con notación formal, de las 500 entradas del catálogo.
 */
export interface DiagramKind {
  /** Slug estable del nombre. */
  id: string;
  /** Número de entrada en el catálogo de origen. */
  n: number;
  name: string;
  /** Categoría del catálogo de origen. */
  family: string;
  description: string;
  /** Id del pack de all-draw que lo modela (\`NotationPack.id\`), si existe equivalente. */
  notationId?: string;
  /** Referencia a la especificación o fuente canónica. */
  url?: string;
}

/** Packs de all-draw a los que puede apuntar \`notationId\`. */
export const KNOWN_PACKS: readonly string[] = ${JSON.stringify(PACKS)};

export const FAMILIES: readonly string[] = ${JSON.stringify(families)};

export const DIAGRAM_KINDS: DiagramKind[] = [
${lines.join('\n')}
];
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`${kinds.length} tipos de diagrama → ${OUT}`);
