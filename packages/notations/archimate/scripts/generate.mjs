#!/usr/bin/env node
/**
 * Genera `src/generated.ts` (pack ArchiMate 3.2) a partir de los ficheros de datos de Archi
 * (`_research/archi`). Sin dependencias: los XML son regulares y se parsean con regex.
 *
 * Fuentes:
 *  - com.archimatetool.model/model/relationships.xml       matriz de validez (letras por par)
 *  - com.archimatetool.model/model/relationships-keys.xml  letra → relación
 *  - com.archimatetool.model/model/viewpoints.xml          viewpoints con macros `$XElements$`
 *  - com.archimatetool.model/model/archimate.ecore         jerarquía (capas / aspectos)
 *  - com.archimatetool.model/src/.../util/ArchimateModelUtils.java   orden por capa (macros)
 *  - com.archimatetool.editor/src/.../ui/factory/elements/*UIProvider.java  colores y figuras
 *  - com.archimatetool.editor/src/.../ui/factory/elements/messages.properties  nombres
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const ROOT = resolve(PKG, '../../..');
const ARCHI = join(ROOT, '_research/archi');
const MODEL = join(ARCHI, 'com.archimatetool.model');
const EDITOR = join(ARCHI, 'com.archimatetool.editor');
const OUT = join(PKG, 'src/generated.ts');

const read = (p) => readFileSync(p, 'utf8');
const NS = 'archimate';
const id = (local) => `${NS}:${local}`;

// ---------------------------------------------------------------- relationships-keys.xml
const keysXml = read(join(MODEL, 'model/relationships-keys.xml'));
/** letra → nombre local de la relación (sin sufijo "Relationship"). */
const KEY_TO_REL = {};
for (const m of keysXml.matchAll(/<key\s+char="(\w)"\s+relationship="(\w+)Relationship"\s*\/>/g)) KEY_TO_REL[m[1]] = m[2];
if (Object.keys(KEY_TO_REL).length !== 11) throw new Error(`Esperaba 11 letras de relación, hay ${Object.keys(KEY_TO_REL).length}`);

// ---------------------------------------------------------------- relationships.xml
const relXml = read(join(MODEL, 'model/relationships.xml'));
const specVersion = /<relationships\s+version="([^"]+)"/.exec(relXml)?.[1] ?? '3.2';
/** { Source: { Target: 'letras' } } */
const MATRIX_RAW = {};
for (const src of relXml.matchAll(/<source\s+concept="(\w+)">([\s\S]*?)<\/source>/g)) {
  const row = (MATRIX_RAW[src[1]] = {});
  for (const t of src[2].matchAll(/<target\s+concept="(\w+)"\s+relations="([a-z]*)"\s*\/>/g)) row[t[1]] = t[2];
}
const CONCEPTS = Object.keys(MATRIX_RAW).sort();
for (const s of CONCEPTS) for (const t of CONCEPTS) if (MATRIX_RAW[s][t] === undefined) throw new Error(`Matriz incompleta: ${s} → ${t}`);

// ---------------------------------------------------------------- archimate.ecore (jerarquía)
const ecore = read(join(MODEL, 'model/archimate.ecore'));
/** nombre → supertipos directos */
const SUPER = {};
for (const m of ecore.matchAll(/<eClassifiers\s([^>]*?)\/?>/g)) {
  const attrs = m[1];
  const name = /name="(\w+)"/.exec(attrs)?.[1];
  if (!name) continue;
  const sup = /eSuperTypes="([^"]*)"/.exec(attrs)?.[1] ?? '';
  SUPER[name] = sup.split(/\s+/).filter(Boolean).map((s) => s.replace('#//', ''));
}
function ancestors(name, acc = new Set()) {
  for (const s of SUPER[name] ?? []) if (!acc.has(s)) { acc.add(s); ancestors(s, acc); }
  return acc;
}

// ---------------------------------------------------------------- ArchimateModelUtils.java (orden por capa)
const utilsJava = read(join(MODEL, 'src/com/archimatetool/model/util/ArchimateModelUtils.java'));
function classList(method) {
  const body = new RegExp(`public static EClass\\[\\] ${method}\\(\\)\\s*\\{([\\s\\S]*?)\\};`).exec(utilsJava)?.[1];
  if (!body) throw new Error(`No encuentro ${method}() en ArchimateModelUtils.java`);
  return [...body.matchAll(/eINSTANCE\.get(\w+)\(\)/g)].map((m) => m[1]);
}
const LAYER_DEFS = [
  { id: 'strategy', name: 'Strategy', method: 'getStrategyClasses', macro: '$StrategyElements$' },
  { id: 'business', name: 'Business', method: 'getBusinessClasses', macro: '$BusinessElements$' },
  { id: 'application', name: 'Application', method: 'getApplicationClasses', macro: '$ApplicationElements$' },
  { id: 'technology', name: 'Technology', method: 'getTechnologyClasses', macro: '$TechnologyElements$' },
  { id: 'physical', name: 'Physical', method: 'getPhysicalClasses', macro: '$PhysicalElements$' },
  { id: 'motivation', name: 'Motivation', method: 'getMotivationClasses', macro: '$MotivationElements$' },
  { id: 'implementation-migration', name: 'Implementation & Migration', method: 'getImplementationMigrationClasses', macro: '$ImplementationMigrationElements$' },
  { id: 'other', name: 'Composite / Other', method: 'getOtherClasses' },
  { id: 'connector', name: 'Connectors', method: 'getConnectorClasses' },
];
for (const l of LAYER_DEFS) l.classes = classList(l.method);
const RELATION_ORDER = classList('getRelationsClasses').map((n) => n.replace(/Relationship$/, ''));
const LAYER_OF = {};
const ORDER_OF = {};
let order = 0;
for (const l of LAYER_DEFS) for (const c of l.classes) { LAYER_OF[c] = l; ORDER_OF[c] = order++; }

// ---------------------------------------------------------------- UI providers (colores, figuras, nombres)
const providersDir = join(EDITOR, 'src/com/archimatetool/editor/ui/factory/elements');
const abstractProvider = read(join(providersDir, 'AbstractArchimateElementUIProvider.java'));
const hex = (r, g, b) => '#' + [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
/** variable estática → hex, p.ej. defaultBusinessColor → #ffffb5 */
const COLOR_VARS = {};
for (const m of abstractProvider.matchAll(/Color\s+(\w+)\s*=\s*new Color\((\d+),\s*(\d+),\s*(\d+)\)/g)) COLOR_VARS[m[1]] = hex(m[2], m[3], m[4]);
const NAMES = {};
for (const line of read(join(providersDir, 'messages.properties')).split('\n')) {
  const m = /^(\w+)UIProvider_0=(.+)$/.exec(line.trim());
  if (m) NAMES[m[1]] = m[2].trim();
}
const UI = {};
for (const file of readdirSync(providersDir)) {
  const m = /^(\w+)UIProvider\.java$/.exec(file);
  if (!m || m[1].startsWith('Abstract')) continue;
  const src = read(join(providersDir, file));
  const local = /getInstance\(\)\.get(\w+)\(\)/.exec(src)?.[1] ?? /eINSTANCE\.get(\w+)\(\)/.exec(src)?.[1];
  if (!local) continue;
  const localColor = {};
  for (const c of src.matchAll(/Color\s+(\w+)\s*=\s*new Color\((\d+),\s*(\d+),\s*(\d+)\)/g)) localColor[c[1]] = hex(c[2], c[3], c[4]);
  const ret = /getDefaultColor\(\)\s*\{\s*return\s+([\w.]+);/.exec(src)?.[1];
  let color;
  if (ret === 'ColorConstants.black') color = '#000000';
  else if (ret === 'ColorConstants.white') color = '#ffffff';
  else color = localColor[ret] ?? COLOR_VARS[ret];
  const altOverride = /hasAlternateFigure\(\)\s*\{\s*return\s+(true|false);/.exec(src)?.[1];
  const alternateFigure = altOverride ? altOverride === 'true' : /hasAlternateFigure\(\)\s*\{\s*return\s+true;/.test(abstractProvider);
  UI[local] = { color, alternateFigure };
}

// ---------------------------------------------------------------- aspecto y figura (aproximación)
function aspectOf(local) {
  const a = ancestors(local);
  if (local === 'Junction') return 'connector';
  if (a.has('MotivationElement')) return 'motivation';
  if (a.has('CompositeElement')) return 'composite';
  if (a.has('ActiveStructureElement')) return 'active-structure';
  if (a.has('PassiveStructureElement')) return 'passive-structure';
  if (a.has('BehaviorElement')) return 'behavior';
  if (a.has('StructureElement')) return 'structure';
  if (/Event$/.test(local)) return 'behavior'; // ImplementationEvent: el ecore no lo marca
  return 'other';
}
function shapeOf(local) {
  if (local === 'Junction') return 'circle';
  if (local === 'Grouping') return 'group';
  if (local === 'Value' || local === 'Meaning') return 'ellipse';
  if (local === 'Material') return 'hexagon';
  if (local === 'Representation' || local === 'Deliverable') return 'note';
  if (/(Process|Function|Interaction|Event|Service)$/.test(local) || local === 'Capability' || local === 'ValueStream' || local === 'CourseOfAction' || local === 'WorkPackage') return 'rounded';
  return 'rect';
}
const CONTAINERS = new Set(['Grouping', 'Location']);

// ---------------------------------------------------------------- elementos
const ELEMENT_LOCALS = CONCEPTS.filter((c) => c !== 'Relationship');
const elements = ELEMENT_LOCALS.map((local) => {
  const layer = LAYER_OF[local];
  if (!layer) throw new Error(`Elemento sin capa en ArchimateModelUtils: ${local}`);
  const ui = UI[local];
  if (!ui?.color) throw new Error(`Sin color para ${local}`);
  const fields = [];
  if (local === 'Junction') fields.push({ key: 'junctionType', label: 'Junction type', kind: 'select', options: 'and,or', doc: 'And-junction (por defecto) u Or-junction.' });
  return {
    id: id(local),
    name: NAMES[local] ?? local.replace(/([a-z])([A-Z])/g, '$1 $2'),
    category: layer.id,
    color: ui.color,
    shape: shapeOf(local),
    ...(CONTAINERS.has(local) ? { container: true } : {}),
    fields,
    meta: { layer: layer.name, aspect: aspectOf(local), alternateFigure: ui.alternateFigure, spec: `ArchiMate ${specVersion}`, order: ORDER_OF[local] },
  };
}).sort((a, b) => a.meta.order - b.meta.order);

// ---------------------------------------------------------------- relaciones
const REL_STYLE = {
  Composition: { category: 'structural', line: 'solid', sourceHead: 'filled-diamond', targetHead: 'none' },
  Aggregation: { category: 'structural', line: 'solid', sourceHead: 'diamond', targetHead: 'none' },
  Assignment: { category: 'structural', line: 'solid', sourceHead: 'dot', targetHead: 'arrow' },
  Realization: { category: 'structural', line: 'dotted', sourceHead: 'none', targetHead: 'triangle' },
  Serving: { category: 'dependency', line: 'solid', sourceHead: 'none', targetHead: 'open' },
  Access: { category: 'dependency', line: 'dotted', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'accessType', label: 'Access type', kind: 'select', options: 'write,read,access,readwrite', doc: 'write (por defecto), read, access (sin especificar), readwrite.' }] },
  Influence: { category: 'dependency', line: 'dashed', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'strength', label: 'Strength', kind: 'text', doc: 'p.ej. +, ++, -, --, 0…10' }] },
  Triggering: { category: 'dynamic', line: 'solid', sourceHead: 'none', targetHead: 'arrow' },
  Flow: { category: 'dynamic', line: 'dashed', sourceHead: 'none', targetHead: 'arrow' },
  Specialization: { category: 'other', line: 'solid', sourceHead: 'none', targetHead: 'triangle' },
  Association: { category: 'dependency', line: 'solid', sourceHead: 'none', targetHead: 'none',
    fields: [{ key: 'directed', label: 'Directed', kind: 'checkbox', doc: 'Asociación dirigida (media flecha en destino).' }] },
};
const ECORE_REL_CATEGORY = { StructuralRelationship: 'structural', DependendencyRelationship: 'dependency', DynamicRelationship: 'dynamic', OtherRelationship: 'other' };
/** Letras que Archi permite con `Relationship` como destino, desde cualquier origen. */
const relToRelationship = new Set();
for (const s of CONCEPTS) for (const ch of MATRIX_RAW[s].Relationship) relToRelationship.add(KEY_TO_REL[ch]);
const relations = RELATION_ORDER.map((local) => {
  const style = REL_STYLE[local];
  if (!style) throw new Error(`Sin estilo para relación ${local}`);
  const sup = SUPER[`${local}Relationship`]?.[0];
  const category = ECORE_REL_CATEGORY[sup] ?? style.category;
  if (category !== style.category) throw new Error(`Categoría de ${local} no cuadra con el ecore (${sup})`);
  return {
    id: id(local),
    name: local,
    category,
    line: style.line,
    sourceHead: style.sourceHead,
    targetHead: style.targetHead,
    fields: style.fields ?? [],
    ...(relToRelationship.has(local) ? { relationEnds: true } : {}),
    meta: { spec: `ArchiMate ${specVersion}`, archiClass: `${local}Relationship` },
  };
});
if (relations.length !== 11) throw new Error(`Esperaba 11 relaciones, hay ${relations.length}`);

// ---------------------------------------------------------------- matriz
const validity = {};
for (const s of CONCEPTS) {
  validity[s] = {};
  for (const t of CONCEPTS) {
    validity[s][t] = [...MATRIX_RAW[s][t]].map((ch) => {
      const r = KEY_TO_REL[ch];
      if (!r) throw new Error(`Letra desconocida '${ch}' en ${s} → ${t}`);
      return id(r);
    });
  }
}

// ---------------------------------------------------------------- viewpoints
const vpXml = read(join(MODEL, 'model/viewpoints.xml'));
const MACROS = Object.fromEntries(LAYER_DEFS.filter((l) => l.macro).map((l) => [l.macro, l.classes]));
const REL_MACROS = {
  $StructuralRelationships$: 'structural', $DependencyRelationships$: 'dependency', $DynamicRelationships$: 'dynamic', $OtherRelationships$: 'other',
};
const viewpoints = [];
for (const m of vpXml.matchAll(/<viewpoint\s+id="([^"]+)">([\s\S]*?)<\/viewpoint>/g)) {
  const body = m[2];
  const name = /<name[^>]*>([^<]+)<\/name>/.exec(body)?.[1]?.trim();
  if (!name) throw new Error(`Viewpoint ${m[1]} sin nombre`);
  const elementTypes = [];
  const relationTypes = [];
  for (const c of body.matchAll(/<concept>([^<]+)<\/concept>/g)) {
    const concept = c[1].trim();
    if (MACROS[concept]) {
      for (const local of MACROS[concept]) elementTypes.push(id(local));
    } else if (REL_MACROS[concept]) {
      for (const r of relations) if (r.category === REL_MACROS[concept]) relationTypes.push(r.id);
    } else if (concept.endsWith('Relationship')) {
      relationTypes.push(id(concept.replace(/Relationship$/, '')));
    } else if (ELEMENT_LOCALS.includes(concept)) {
      elementTypes.push(id(concept));
    } else {
      throw new Error(`Concepto desconocido en viewpoint ${m[1]}: ${concept}`);
    }
  }
  // Archi (Viewpoint.defaultList): Junction y Grouping se permiten en cualquier viewpoint con lista.
  if (elementTypes.length) elementTypes.push(id('Junction'), id('Grouping'));
  const vp = { id: m[1], name, elementTypes: [...new Set(elementTypes)] };
  if (relationTypes.length) vp.relationTypes = [...new Set(relationTypes)];
  viewpoints.push(vp);
}

// ---------------------------------------------------------------- capas / categorías
const LAYER_COLOR_FALLBACK = { other: '#ffffff', connector: '#000000' };
const layers = LAYER_DEFS.map((l, i) => {
  const first = l.classes.find((c) => UI[c]?.color && !['Grouping', 'Location', 'Junction'].includes(c));
  return { id: l.id, name: l.name, color: first ? UI[first].color : LAYER_COLOR_FALLBACK[l.id] ?? '#ffffff', order: i, elementTypes: l.classes.map(id) };
});

// ---------------------------------------------------------------- salida
const strip = (o) => JSON.parse(JSON.stringify(o));
const j = (v) => JSON.stringify(strip(v), null, 2);
const elementsOut = elements.map(({ meta: { order: _o, ...meta }, ...e }) => ({ ...e, meta }));
const out = `// GENERADO — no editar. Ejecuta \`pnpm --filter @all-draw/notation-archimate generate\`.
// Fuente: ficheros de datos de Archi (_research/archi), ArchiMate ${specVersion}.
import type { ElementType, RelationType } from '@all-draw/core';
import type { ValidityMatrix, Viewpoint, NotationCategory } from '@all-draw/core';

export const SPEC_VERSION = ${JSON.stringify(`ArchiMate ${specVersion}`)};

/** Capas / categorías en el orden de la paleta de Archi. */
export const LAYERS: (NotationCategory & { elementTypes: string[] })[] = ${j(layers)};

export const CATEGORIES: NotationCategory[] = LAYERS.map(({ id, name, color, order }) => ({ id, name, color, order }));

/** ${elementsOut.length} elementos (60 de la especificación + Junction). */
export const ELEMENTS: ElementType[] = ${j(elementsOut)};

/** ${relations.length} relaciones. */
export const RELATIONS: RelationType[] = ${j(relations)};

/** Nombres locales de todos los conceptos de la matriz (${CONCEPTS.length}: elementos + Junction + Relationship). */
export const CONCEPTS: string[] = ${j(CONCEPTS)};

/** Matriz de validez: \`VALIDITY[Source][Target]\` = ids de relación permitidos (origen → destino). */
export const VALIDITY: ValidityMatrix = ${j(validity)};

/** ${viewpoints.length} viewpoints, con macros de capa expandidas. */
export const VIEWPOINTS: Viewpoint[] = ${j(viewpoints)};
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`generated.ts: ${elementsOut.length} elementos, ${relations.length} relaciones, ${CONCEPTS.length}x${CONCEPTS.length} matriz, ${viewpoints.length} viewpoints, ${layers.length} capas → ${OUT}`);
