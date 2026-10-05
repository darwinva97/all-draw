/**
 * UML clases → TypeScript (`uml-typescript`).
 *
 * Decisión: **un único fichero `src/model.ts`** con todo el ámbito. Repartir por paquete obligaría a importar
 * entre ficheros y las clases que heredan de otro módulo con ciclos de importación fallan en ejecución (la
 * superclase aún no está definida); el paquete de cada clasificador queda en su JSDoc. Orden: enumeraciones,
 * interfaces y clases (las superclases antes que sus subclases; a igualdad, por nombre).
 *
 * - Visibilidad: `-` → `private`, `#` → `protected`, `+` o sin marca → público, `~` → público con comentario.
 * - Atributos obligatorios sin valor llevan `!` (asignación definitiva); las listas se inicializan a `[]`.
 * - Atributos derivados (`/x`) → getter que lanza `Error('No implementado')`.
 * - Operaciones de clase → cuerpo `throw new Error('No implementado')`; en interfaces, solo la firma.
 * - Clases abstractas: las operaciones marcadas `{abstract}` se generan como `abstract` sin cuerpo; el resto con
 *   cuerpo. Las clases concretas reciben stubs de los miembros de sus interfaces y de las operaciones abstractas
 *   heredadas que no implementan, para que el fichero compile.
 */
import type { Workspace } from '@all-draw/core';
import type { CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { generatedBy } from './util';
import { buildUml, quotedString, type Classifier, type Member, type Operation, type Param, type TypeRef, type UmlModel } from './uml-model';

export function tsType(t: TypeRef): string {
  switch (t.k) {
    case 'prim':
      switch (t.p) {
        case 'string': case 'char': case 'uuid': return 'string';
        case 'boolean': return 'boolean';
        case 'date': case 'datetime': return 'Date';
        case 'void': return 'void';
        case 'any': return 'unknown';
        default: return 'number';
      }
    case 'ref': return t.name;
    case 'array': return `${tsType(t.of)}[]`;
    case 'set': return `Set<${tsType(t.of)}>`;
    case 'map': return `Map<${tsType(t.key)}, ${tsType(t.value)}>`;
    case 'unknown': return 'unknown';
  }
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function tsDefault(def: string, type: TypeRef, m: UmlModel): string {
  const d = def.trim();
  if (type.k === 'ref') {
    const c = m.byId.get(type.id);
    const v = d.replace(/^.*\./, '');
    if (c?.kind === 'enum' && c.values.includes(v)) return `${c.name}.${v}`;
  }
  if (type.k === 'prim') {
    if ((type.p === 'string' || type.p === 'char' || type.p === 'uuid') && quotedString(d) === null) return `'${esc(d)}'`;
    if ((type.p === 'date' || type.p === 'datetime') && /^(now|hoy|today|now\(\))$/i.test(d)) return 'new Date()';
  }
  if ((type.k === 'array') && (d === '{}' || d === '[]')) return '[]';
  return d;
}

export function jsdoc(textLines: string[], indent: string): string[] {
  const ls = textLines.flatMap(l => l.split('\n')).map(l => l.replace(/\*\//g, '*\\/').trimEnd());
  while (ls.length && !ls[ls.length - 1]) ls.pop();
  if (!ls.length) return [];
  if (ls.length === 1) return [`${indent}/** ${ls[0]} */`];
  return [`${indent}/**`, ...ls.map(l => (l ? `${indent} * ${l}` : `${indent} *`)), `${indent} */`];
}

const visTs = (v: Member['vis']): string => (v === '-' ? 'private ' : v === '#' ? 'protected ' : '');

function params(ps: Param[], m: UmlModel): string {
  const lastRequired = ps.reduce((acc, p, i) => (!p.optional && p.def === undefined ? i : acc), -1);
  return ps.map((p, i) => {
    const t = tsType(p.type);
    if (p.def !== undefined) return `${p.name}: ${t} = ${tsDefault(p.def, p.type, m)}`;
    if (p.optional) return i < lastRequired ? `${p.name}: ${t} | undefined` : `${p.name}?: ${t}`;
    return `${p.name}: ${t}`;
  }).join(', ');
}

const retType = (o: Operation) => `${tsType(o.ret)}${o.retOptional && !(o.ret.k === 'prim' && o.ret.p === 'void') ? ' | undefined' : ''}`;
const NOT_IMPLEMENTED = "throw new Error('No implementado');";

function classifierDoc(c: Classifier): string[] {
  return [
    ...(c.doc ? [c.doc] : []),
    ...(c.stereotype ? [`«${c.stereotype}»`] : []),
    ...(c.pkg ? [`Paquete ${c.pkg}.`] : []),
  ];
}

function memberDoc(x: { note?: string; from?: string; vis?: Member['vis'] }): string[] {
  return [
    ...(x.note ? [x.note] : []),
    ...(x.from ? [`Requerido por ${x.from}.`] : []),
    ...(x.vis === '~' ? ['Visibilidad de paquete (~).'] : []),
  ];
}

function emitClass(c: Classifier, m: UmlModel): string[] {
  const sup = c.superclass ? m.byId.get(c.superclass) : undefined;
  const impl = c.interfaces.map(i => m.byId.get(i)!.name);
  const head = `export ${c.abstract ? 'abstract ' : ''}class ${c.name}${sup ? ` extends ${sup.name}` : ''}${impl.length ? ` implements ${impl.join(', ')}` : ''}`;
  const body: string[] = [];
  for (const a of c.attrs) {
    if (body.length) body.push('');
    body.push(...jsdoc(memberDoc(a), '  '));
    const t = tsType(a.type);
    const mods = `${visTs(a.vis)}${a.isStatic ? 'static ' : ''}`;
    if (a.derived) {
      body.push(`  ${mods}get ${a.name}(): ${t}${a.optional ? ' | undefined' : ''} {`, `    ${NOT_IMPLEMENTED}`, '  }');
      continue;
    }
    const ro = a.readonly ? 'readonly ' : '';
    if (a.def !== undefined) body.push(`  ${mods}${ro}${a.name}${a.optional ? '?' : ''}: ${t} = ${tsDefault(a.def, a.type, m)};`);
    else if (a.optional) body.push(`  ${mods}${ro}${a.name}?: ${t};`);
    else if (a.type.k === 'array') body.push(`  ${mods}${ro}${a.name}: ${t} = [];`);
    else if (a.type.k === 'set') body.push(`  ${mods}${ro}${a.name}: ${t} = new Set();`);
    else if (a.type.k === 'map') body.push(`  ${mods}${ro}${a.name}: ${t} = new Map();`);
    else if (a.isStatic) body.push(`  ${mods}${ro}${a.name}: ${t};`);
    else body.push(`  ${mods}${ro}${a.name}!: ${t};`);
  }
  for (const o of c.ops) {
    if (body.length) body.push('');
    body.push(...jsdoc(memberDoc(o), '  '));
    const sig = `${o.name}(${params(o.params, m)}): ${retType(o)}`;
    if (o.isAbstract) body.push(`  ${visTs(o.vis)}abstract ${sig};`);
    else body.push(`  ${visTs(o.vis)}${o.isStatic ? 'static ' : ''}${sig} {`, `    ${NOT_IMPLEMENTED}`, '  }');
  }
  return [...jsdoc(classifierDoc(c), ''), ...(body.length ? [`${head} {`, ...body, '}'] : [`${head} {}`])];
}

function emitInterface(c: Classifier, m: UmlModel): string[] {
  const ext = c.interfaces.map(i => m.byId.get(i)!.name);
  const head = `export interface ${c.name}${ext.length ? ` extends ${ext.join(', ')}` : ''}`;
  const body: string[] = [];
  for (const a of c.attrs) {
    body.push(...jsdoc(memberDoc(a), '  '));
    body.push(`  ${a.readonly || a.derived ? 'readonly ' : ''}${a.name}${a.optional ? '?' : ''}: ${tsType(a.type)};`);
  }
  for (const o of c.ops) {
    body.push(...jsdoc(memberDoc(o), '  '));
    body.push(`  ${o.name}(${params(o.params, m)}): ${retType(o)};`);
  }
  return [...jsdoc(classifierDoc(c), ''), ...(body.length ? [`${head} {`, ...body, '}'] : [`${head} {}`])];
}

function emitEnum(c: Classifier): string[] {
  const head = `export enum ${c.name}`;
  return [...jsdoc(classifierDoc(c), ''), ...(c.values.length ? [`${head} {`, ...c.values.map(v => `  ${v} = '${v}',`), '}'] : [`${head} {}`])];
}

/** Clases en orden: cada superclase antes que sus subclases; a igualdad, por nombre. */
export function classOrder(m: UmlModel): Classifier[] {
  const out: Classifier[] = [];
  const done = new Set<string>();
  const visit = (c: Classifier, stack: Set<string>) => {
    if (done.has(c.id) || stack.has(c.id)) return;
    stack.add(c.id);
    const sup = c.superclass ? m.byId.get(c.superclass) : undefined;
    if (sup) visit(sup, stack);
    done.add(c.id);
    out.push(c);
  };
  for (const c of m.classifiers.filter(x => x.kind === 'class')) visit(c, new Set());
  return out;
}

export function generateUmlTypescript(ws: Workspace, opts: CodegenOptions = {}): CodegenResult {
  const warnings = new Warnings();
  const m = buildUml(ws, opts, 'ts', warnings);
  if (!m) return { files: [], warnings: warnings.list };
  if (!m.classifiers.length) { warnings.add(W.nothing, { scope: m.scope.title }); return { files: [], warnings: warnings.list }; }
  const blocks: string[][] = [
    ...m.classifiers.filter(c => c.kind === 'enum').map(emitEnum),
    ...m.classifiers.filter(c => c.kind === 'interface').map(c => emitInterface(c, m)),
    ...classOrder(m).map(c => emitClass(c, m)),
  ];
  const header = ['/**', ` * ${generatedBy(m.scope.title)}`, ' * Diagrama de clases UML → TypeScript.', ' */'];
  const content = [...header, ...blocks.flatMap(b => ['', ...b])].join('\n') + '\n';
  return { files: [{ path: 'src/model.ts', content, language: 'typescript' }], warnings: warnings.list };
}
