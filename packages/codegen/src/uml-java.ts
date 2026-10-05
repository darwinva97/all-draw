/**
 * UML clases → Java (`uml-java`): un fichero por clasificador en `src/main/java/<paquete>/<Nombre>.java`.
 *
 * - Paquete: namespace del `uml:Package` contenedor (`fields.namespace` o la cadena de paquetes anidados, en
 *   minúsculas y sin tildes); `model` si no hay.
 * - Campos: `+` public, `-` o sin marca private, `#` protected, `~` sin modificador (paquete). Las listas
 *   (`[*]`, `List<X>`, `X[]`) son `List<T>` inicializadas a `new ArrayList<>()`; los primitivos opcionales van en
 *   su clase envoltorio (`Integer`…). Fechas → `java.time.LocalDateTime` (`LocalDate` si el tipo es `LocalDate`),
 *   `decimal` → `java.math.BigDecimal`, desconocidos → `Object` (con aviso).
 * - Métodos: cuerpo `throw new UnsupportedOperationException();`; `{abstract}` → `abstract` sin cuerpo; en
 *   interfaces, solo la firma. Atributos derivados (`/x`) → método `getX()`. Las propiedades de una interfaz
 *   (extremos de asociación navegables) se declaran como getters abstractos y las clases que la implementan
 *   reciben el campo y el getter.
 * - Sin getters/setters para el resto de campos.
 */
import type { Workspace } from '@all-draw/core';
import type { CodeFile, CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { generatedBy, pascalCase } from './util';
import { buildUml, isNumberLiteral, quotedString, type Classifier, type Member, type Operation, type Param, type TypeRef, type UmlModel } from './uml-model';

const BOX: Record<string, string> = { int: 'Integer', long: 'Long', float: 'Float', double: 'Double', boolean: 'Boolean', char: 'Character', byte: 'Byte', short: 'Short' };
const DEFAULT_PACKAGE = 'model';
const NOT_IMPLEMENTED = 'throw new UnsupportedOperationException();';

class Imports {
  util = false;
  readonly names = new Set<string>();
  readonly pkg: string;
  readonly m: UmlModel;
  constructor(pkg: string, m: UmlModel) { this.pkg = pkg; this.m = m; }
  type(t: TypeRef, boxed = false): string {
    switch (t.k) {
      case 'prim': {
        const p = t.p;
        const prim = p === 'string' ? 'String' : p === 'uuid' ? 'UUID' : p === 'number' ? 'double' : p === 'decimal' ? 'BigDecimal'
          : p === 'date' ? 'LocalDate' : p === 'datetime' ? 'LocalDateTime' : p === 'any' ? 'Object' : p;
        if (p === 'uuid') this.util = true;
        if (p === 'decimal') this.names.add('java.math.BigDecimal');
        if (p === 'date') this.names.add('java.time.LocalDate');
        if (p === 'datetime') this.names.add('java.time.LocalDateTime');
        return boxed ? BOX[prim] ?? prim : prim;
      }
      case 'ref': {
        const c = this.m.byId.get(t.id);
        const pkg = c ? c.pkg || DEFAULT_PACKAGE : this.pkg;
        if (pkg !== this.pkg) this.names.add(`${pkg}.${t.name}`);
        return t.name;
      }
      case 'array': this.util = true; return `List<${this.type(t.of, true)}>`;
      case 'set': this.util = true; return `Set<${this.type(t.of, true)}>`;
      case 'map': this.util = true; return `Map<${this.type(t.key, true)}, ${this.type(t.value, true)}>`;
      case 'unknown': return 'Object';
    }
  }
  lines(): string[] {
    const out = [...this.names].filter(n => !(this.util && n.startsWith('java.util.') && n.split('.').length === 3)).sort();
    return [...(this.util ? ['import java.util.*;'] : []), ...out.map(n => `import ${n};`)];
  }
}

const jdq = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function javaDefault(def: string, t: TypeRef, im: Imports): string {
  const d = def.trim();
  if (t.k === 'ref') {
    const c = im.m.byId.get(t.id);
    const v = d.replace(/^.*\./, '');
    if (c?.kind === 'enum' && c.values.includes(v)) return `${c.name}.${v}`;
  }
  if (t.k === 'array' && (d === '[]' || d === '{}')) { im.util = true; return 'new ArrayList<>()'; }
  if (t.k === 'prim') {
    const q = quotedString(d);
    if (t.p === 'string' || t.p === 'uuid') return q !== null ? jdq(q) : jdq(d);
    if (t.p === 'char' && q !== null) return `'${q.charAt(0)}'`;
    if (t.p === 'float' && isNumberLiteral(d)) return `${d}f`;
    if (t.p === 'long' && isNumberLiteral(d) && !d.includes('.')) return `${d}L`;
    if (t.p === 'decimal' && isNumberLiteral(d)) return `new BigDecimal("${d}")`;
    if (t.p === 'datetime' && /^(now|hoy|today|now\(\))$/i.test(d)) return 'LocalDateTime.now()';
    if (t.p === 'date' && /^(now|hoy|today|now\(\))$/i.test(d)) return 'LocalDate.now()';
  }
  return d;
}

function javadoc(textLines: string[], indent: string): string[] {
  const ls = textLines.flatMap(l => l.split('\n')).map(l => l.replace(/\*\//g, '*\\/').trimEnd());
  while (ls.length && !ls[ls.length - 1]) ls.pop();
  if (!ls.length) return [];
  if (ls.length === 1) return [`${indent}/** ${ls[0]} */`];
  return [`${indent}/**`, ...ls.map(l => (l ? `${indent} * ${l}` : `${indent} *`)), `${indent} */`];
}

const fieldVis = (v: Member['vis']) => (v === '+' ? 'public ' : v === '#' ? 'protected ' : v === '~' ? '' : 'private ');
const methodVis = (v: Member['vis']) => (v === '-' ? 'private ' : v === '#' ? 'protected ' : v === '~' ? '' : 'public ');
const getter = (name: string) => `get${pascalCase(name) || name}`;

function paramList(ps: Param[], im: Imports): string {
  return ps.map(p => `${im.type(p.type, p.optional)} ${p.name}`).join(', ');
}
const ret = (o: Operation, im: Imports) => im.type(o.ret, o.retOptional);

function memberDoc(x: { note?: string; vis?: Member['vis'] }): string[] {
  return [...(x.note ? [x.note] : [])];
}

function emitClassBody(c: Classifier, im: Imports): string[] {
  const body: string[] = [];
  const block = (ls: string[]) => { body.push('', ...ls); };
  for (const a of c.attrs) {
    if (a.derived) continue;
    const opt = a.optional;
    const t = im.type(a.type, opt);
    const mods = `${fieldVis(a.from ? '-' : a.vis)}${a.isStatic ? 'static ' : ''}${a.readonly ? 'final ' : ''}`;
    let init = '';
    if (a.def !== undefined) init = ` = ${javaDefault(a.def, a.type, im)}`;
    else if (a.type.k === 'array') init = ' = new ArrayList<>()';
    else if (a.type.k === 'set') init = ' = new HashSet<>()';
    else if (a.type.k === 'map') init = ' = new HashMap<>()';
    block([...javadoc(memberDoc(a), '    '), `    ${mods}${t} ${a.name}${init};`]);
  }
  for (const a of c.attrs) {
    if (a.derived) block([...javadoc(memberDoc(a), '    '), `    ${methodVis(a.vis)}${a.isStatic ? 'static ' : ''}${im.type(a.type, a.optional)} ${getter(a.name)}() {`, `        ${NOT_IMPLEMENTED}`, '    }']);
    else if (a.from) block(['    @Override', `    public ${im.type(a.type, a.optional)} ${getter(a.name)}() {`, `        return ${a.name};`, '    }']);
  }
  for (const o of c.ops) {
    const sig = `${ret(o, im)} ${o.name}(${paramList(o.params, im)})`;
    const doc = javadoc(memberDoc(o), '    ');
    if (o.isAbstract) block([...doc, `    ${methodVis(o.vis)}abstract ${sig};`]);
    else block([...doc, ...(o.from ? ['    @Override'] : []), `    ${methodVis(o.vis)}${o.isStatic ? 'static ' : ''}${sig} {`, `        ${NOT_IMPLEMENTED}`, '    }']);
  }
  return body;
}

function emitInterfaceBody(c: Classifier, im: Imports): string[] {
  const body: string[] = [];
  for (const a of c.attrs) body.push('', ...javadoc(memberDoc(a), '    '), `    ${im.type(a.type, a.optional)} ${getter(a.name)}();`);
  for (const o of c.ops) {
    const sig = `${ret(o, im)} ${o.name}(${paramList(o.params, im)})`;
    if (o.isStatic) body.push('', `    static ${sig} {`, `        ${NOT_IMPLEMENTED}`, '    }');
    else body.push('', ...javadoc(memberDoc(o), '    '), `    ${sig};`);
  }
  return body;
}

function emitFile(c: Classifier, m: UmlModel, title: string): CodeFile {
  const pkg = c.pkg || DEFAULT_PACKAGE;
  const im = new Imports(pkg, m);
  let head: string, body: string[];
  if (c.kind === 'enum') {
    head = `public enum ${c.name}`;
    body = c.values.map((v, i) => `    ${v}${i < c.values.length - 1 ? ',' : ''}`);
  } else if (c.kind === 'interface') {
    const ext = c.interfaces.map(i => im.type({ k: 'ref', id: i, name: m.byId.get(i)!.name }));
    head = `public interface ${c.name}${ext.length ? ` extends ${ext.join(', ')}` : ''}`;
    body = emitInterfaceBody(c, im);
  } else {
    const sup = c.superclass ? m.byId.get(c.superclass) : undefined;
    const ext = sup ? im.type({ k: 'ref', id: sup.id, name: sup.name }) : '';
    const impl = c.interfaces.map(i => im.type({ k: 'ref', id: i, name: m.byId.get(i)!.name }));
    head = `public ${c.abstract ? 'abstract ' : ''}class ${c.name}${ext ? ` extends ${ext}` : ''}${impl.length ? ` implements ${impl.join(', ')}` : ''}`;
    body = emitClassBody(c, im);
  }
  if (body[0] === '') body.shift();
  const doc = javadoc([...(c.doc ? [c.doc] : []), ...(c.stereotype ? [`«${c.stereotype}»`] : [])], '');
  const imports = im.lines();
  const content = [
    `// ${generatedBy(title)}`,
    `package ${pkg};`,
    ...(imports.length ? ['', ...imports] : []),
    '',
    ...doc,
    `${head} {`,
    ...body,
    '}',
  ].join('\n') + '\n';
  return { path: `src/main/java/${pkg.replace(/\./g, '/')}/${c.name}.java`, content, language: 'java' };
}

export function generateUmlJava(ws: Workspace, opts: CodegenOptions = {}): CodegenResult {
  const warnings = new Warnings();
  const m = buildUml(ws, opts, 'java', warnings);
  if (!m) return { files: [], warnings: warnings.list };
  if (!m.classifiers.length) { warnings.add(W.nothing, { scope: m.scope.title }); return { files: [], warnings: warnings.list }; }
  const files = m.classifiers.map(c => emitFile(c, m, m.scope.title)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, warnings: warnings.list };
}
