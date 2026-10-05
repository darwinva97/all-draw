/**
 * Modelo intermedio de un diagrama de clases UML (pack `uml`), común a los generadores TypeScript y Java.
 *
 * - Clasificadores: `uml:Class`, `uml:Interface`, `uml:Enum`. El paquete (`uml:Package`) que los contiene, por
 *   `features.parentId` o por anidamiento de nodos, da el namespace (`fields.namespace` o la cadena de nombres).
 * - Atributos (`fields.attributes`, una línea por atributo): `[vis] [/][nombre][mult] : Tipo[mult] [= valor] [{props}]`
 *   con visibilidad `+ - # ~`, `/` derivado, `{static}`, `{readOnly}`, `_nombre_` (subrayado = estático) y
 *   multiplicidad (`[*]`, `[0..*]`, `[1..*]` → lista; `[0..1]` → opcional).
 * - Operaciones (`fields.operations`): `[vis] nombre(p: Tipo, q: Tipo = 1): Retorno [{abstract}|{static}]`.
 * - Tipos: primitivos UML/Java/SQL comunes, genéricos (`List<X>`, `Set<X>`, `Map<K,V>`, `Optional<X>`, `X[]`) y
 *   clasificadores del modelo por nombre. Lo demás es desconocido (aviso).
 * - Relaciones: `uml:Generalization` (origen subclase → destino superclase), `uml:Realization` (clase → interfaz),
 *   y asociación/agregación/composición como propiedades de navegación en el lado navegable.
 * - Para que el código compile, las clases concretas reciben stubs de los miembros de sus interfaces y de las
 *   operaciones abstractas heredadas que no implementan.
 */
import type { Element, Relation, Workspace } from '@all-draw/core';
import { W, Warnings } from './warnings';
import {
  JAVA_RESERVED, TS_RESERVED, byNameThenId, camelCase, codeName, containerOf, isIdentifier, lines, selectScope,
  stripAccents, uniqueName, str, type Scope,
} from './util';
import type { CodegenOptions } from './types';

export type Lang = 'ts' | 'java';
export type Prim =
  | 'string' | 'char' | 'uuid' | 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'number' | 'decimal'
  | 'boolean' | 'date' | 'datetime' | 'void' | 'any';
export type TypeRef =
  | { k: 'prim'; p: Prim }
  | { k: 'ref'; id: string; name: string }
  | { k: 'array'; of: TypeRef }
  | { k: 'set'; of: TypeRef }
  | { k: 'map'; key: TypeRef; value: TypeRef }
  | { k: 'unknown'; raw: string };
export type Vis = '+' | '-' | '#' | '~' | '';
export type Kind = 'class' | 'interface' | 'enum';

export interface Member {
  name: string; vis: Vis; isStatic: boolean; readonly: boolean; derived: boolean;
  type: TypeRef; optional: boolean; def?: string;
  /** Comentario (p. ej. «Composición «líneas» (1..*)»). */
  note?: string;
  /** Nombre del clasificador del que se copia (stubs de interfaces). */
  from?: string;
}
export interface Param { name: string; type: TypeRef; optional: boolean; def?: string }
export interface Operation {
  name: string; vis: Vis; isStatic: boolean; isAbstract: boolean;
  params: Param[]; ret: TypeRef; retOptional: boolean; from?: string;
}
export interface Classifier {
  id: string; kind: Kind; name: string; rawName: string; abstract: boolean; stereotype: string; doc: string;
  /** Namespace (con puntos) del paquete contenedor; '' si no hay. */
  pkg: string;
  attrs: Member[]; ops: Operation[]; values: string[];
  /** Clase: superclase (id). */
  superclass?: string;
  /** Clase: interfaces que implementa; interfaz: interfaces que extiende (ids). */
  interfaces: string[];
}
export interface UmlModel { classifiers: Classifier[]; byId: Map<string, Classifier>; scope: Scope }

export const UML = {
  class: 'uml:Class', interface: 'uml:Interface', enum: 'uml:Enum', package: 'uml:Package',
  association: 'uml:Association', aggregation: 'uml:Aggregation', composition: 'uml:Composition',
  generalization: 'uml:Generalization', realization: 'uml:Realization',
} as const;
const KIND_OF: Record<string, Kind> = { [UML.class]: 'class', [UML.interface]: 'interface', [UML.enum]: 'enum' };
const DEFAULT_NAME: Record<Kind, string> = { class: 'Clase', interface: 'Interfaz', enum: 'Enumeracion' };
const KIND_LABEL: Record<Kind, string> = { class: 'clase', interface: 'interfaz', enum: 'enumeración' };
const STRUCTURAL: Record<string, string> = { [UML.association]: 'Asociación', [UML.aggregation]: 'Agregación', [UML.composition]: 'Composición' };

export const isUmlClassifier = (el: Element): boolean => el.typeId in KIND_OF;

// ---------------------------------------------------------------- Tipos
const PRIMS: Record<string, Prim> = {
  string: 'string', str: 'string', text: 'string', varchar: 'string', char: 'char', character: 'char', uuid: 'uuid', guid: 'uuid',
  byte: 'byte', short: 'short', int: 'int', integer: 'int', int32: 'int', long: 'long', int64: 'long', bigint: 'long', biginteger: 'long',
  float: 'float', real: 'float', double: 'double', number: 'number', decimal: 'decimal', bigdecimal: 'decimal', money: 'decimal', numeric: 'decimal',
  boolean: 'boolean', bool: 'boolean',
  localdate: 'date', date: 'datetime', datetime: 'datetime', localdatetime: 'datetime', timestamp: 'datetime', instant: 'datetime',
  zoneddatetime: 'datetime', offsetdatetime: 'datetime',
  void: 'void', any: 'any', object: 'any', unknown: 'any',
};
const LISTS = new Set(['list', 'arraylist', 'linkedlist', 'collection', 'iterable', 'array', 'sequence', 'seq', 'vector', 'readonlyarray']);
const SETS = new Set(['set', 'hashset', 'treeset', 'sortedset', 'linkedhashset']);
const MAPS = new Set(['map', 'hashmap', 'treemap', 'record', 'dictionary', 'dict', 'linkedhashmap']);
const OPTIONALS = new Set(['optional', 'maybe', 'nullable']);

/** Índice de `ch` al nivel 0 (fuera de `<>`, `()`, `[]`, `{}` y comillas); -1 si no está. */
export function indexTop(s: string, ch: string, from = 0): number {
  let depth = 0;
  let quote = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i]!;
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (depth === 0 && c === ch) return i;
    if ('<([{'.includes(c)) depth++;
    else if ('>)]}'.includes(c)) depth = Math.max(0, depth - 1);
  }
  return -1;
}
export function splitTop(s: string, ch: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = indexTop(s, ch); i >= 0; i = indexTop(s, ch, start)) { out.push(s.slice(start, i)); start = i + 1; }
  out.push(s.slice(start));
  return out;
}

export interface Mult { many: boolean; optional: boolean }
/** `*`, `0..*`, `1..*`, `0..1`, `1`, `n..m`. Devuelve null si no es una multiplicidad. */
export function parseMult(raw: string | undefined): Mult | null {
  const m = /^\s*(\d+|\*)\s*(?:\.\.\s*(\d+|\*|n))?\s*$/i.exec(raw ?? '');
  if (!m) return null;
  let lower = m[1]!, upper = m[2] ?? m[1]!;
  if (lower === '*') { lower = '0'; upper = '*'; }
  if (upper.toLowerCase() === 'n') upper = '*';
  const many = upper === '*' || Number(upper) > 1;
  return { many, optional: !many && lower === '0' };
}

/** Separa una multiplicidad final `[..]` (no vacía) de un texto. */
function takeMult(s: string): { text: string; mult: Mult | null } {
  const m = /^(.*?)\s*\[([^\]]+)\]\s*$/s.exec(s);
  if (m) { const mult = parseMult(m[2]); if (mult) return { text: m[1]!.trim(), mult }; }
  return { text: s.trim(), mult: null };
}

const wrapMult = (t: TypeRef, mult: Mult | null): TypeRef => (mult?.many ? { k: 'array', of: t } : t);

// ---------------------------------------------------------------- Análisis de líneas
interface ParsedProps { props: Set<string>; rest: string }
function takeProps(line: string): ParsedProps {
  const props = new Set<string>();
  // solo `{...}` sin comillas dentro (los valores por defecto `= {}` se respetan si no son palabras)
  const rest = line.replace(/\{\s*([A-Za-z][A-Za-z ,=-]*)\s*\}/g, (_, p: string) => {
    for (const x of p.split(',')) props.add(x.trim().toLowerCase().replace(/\s+/g, ''));
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  return { props, rest };
}

function takeVis(s: string): { vis: Vis; rest: string } {
  const c = s.charAt(0);
  if (c === '+' || c === '-' || c === '#' || c === '~') return { vis: c, rest: s.slice(1).trim() };
  const kw = /^(public|private|protected|package)\s+/i.exec(s);
  if (kw) {
    const v = kw[1]!.toLowerCase();
    return { vis: v === 'public' ? '+' : v === 'private' ? '-' : v === 'protected' ? '#' : '~', rest: s.slice(kw[0].length) };
  }
  return { vis: '', rest: s };
}

export interface RawAttr { vis: Vis; name: string; typeText: string; mult: Mult | null; def?: string; isStatic: boolean; readonly: boolean; derived: boolean }

export function parseAttributeLine(line: string): RawAttr | null {
  const { props, rest } = takeProps(line);
  let { vis, rest: s } = takeVis(rest);
  let isStatic = props.has('static') || props.has('classifier');
  let readonly = props.has('readonly') || props.has('frozen') || props.has('final');
  let derived = false;
  for (;;) {
    if (s.startsWith('/')) { derived = true; s = s.slice(1).trim(); continue; }
    const kw = /^(static|readonly|final)\s+/i.exec(s);
    if (kw) { if (kw[1]!.toLowerCase() === 'static') isStatic = true; else readonly = true; s = s.slice(kw[0].length); continue; }
    break;
  }
  const eq = indexTop(s, '=');
  const def = eq >= 0 ? s.slice(eq + 1).trim() : undefined;
  const left = eq >= 0 ? s.slice(0, eq).trim() : s;
  const colon = indexTop(left, ':');
  let namePart = colon >= 0 ? left.slice(0, colon).trim() : left.trim();
  let typePart = colon >= 0 ? left.slice(colon + 1).trim() : '';
  const nm = takeMult(namePart);
  namePart = nm.text;
  const tm = takeMult(typePart);
  typePart = tm.text;
  const under = /^_(.+)_$/.exec(namePart);
  if (under) { isStatic = true; namePart = under[1]!; }
  if (!namePart) return null;
  return { vis, name: namePart, typeText: typePart, mult: tm.mult ?? nm.mult, ...(def ? { def } : {}), isStatic, readonly, derived };
}

export interface RawParam { name: string; typeText: string; mult: Mult | null; def?: string }
export interface RawOp { vis: Vis; name: string; params: RawParam[]; retText: string; retMult: Mult | null; isStatic: boolean; isAbstract: boolean }

export function parseOperationLine(line: string): RawOp | null {
  const { props, rest } = takeProps(line);
  let { vis, rest: s } = takeVis(rest);
  let isStatic = props.has('static') || props.has('classifier');
  let isAbstract = props.has('abstract');
  for (;;) {
    const kw = /^(static|abstract)\s+/i.exec(s);
    if (!kw) break;
    if (kw[1]!.toLowerCase() === 'static') isStatic = true; else isAbstract = true;
    s = s.slice(kw[0].length);
  }
  const under = /^_(.+)_(\s*\(.*)$/s.exec(s);
  if (under) { isStatic = true; s = under[1]! + under[2]!; }
  const open = s.indexOf('(');
  let name: string, paramsText = '', after: string;
  if (open >= 0) {
    const close = indexTop(s.slice(open + 1), ')');
    const end = close >= 0 ? open + 1 + close : s.length;
    name = s.slice(0, open).trim();
    paramsText = s.slice(open + 1, end);
    after = s.slice(end + 1).trim();
  } else {
    const colon = indexTop(s, ':');
    name = (colon >= 0 ? s.slice(0, colon) : s).trim();
    after = colon >= 0 ? s.slice(colon) : '';
  }
  if (!name) return null;
  const retRaw = after.startsWith(':') ? after.slice(1).trim() : '';
  const rm = takeMult(retRaw);
  const params: RawParam[] = [];
  if (paramsText.trim()) {
    for (const p of splitTop(paramsText, ',')) {
      let t = p.trim().replace(/^(in|out|inout)\s+/i, '');
      if (!t) continue;
      const eq = indexTop(t, '=');
      const def = eq >= 0 ? t.slice(eq + 1).trim() : undefined;
      if (eq >= 0) t = t.slice(0, eq).trim();
      const colon = indexTop(t, ':');
      let pname: string, ptype: string;
      if (colon >= 0) { pname = t.slice(0, colon).trim(); ptype = t.slice(colon + 1).trim(); }
      else {
        // estilo Java: `Tipo nombre`
        const m = /^(.+?)\s+([A-Za-z_$][\w$]*)$/.exec(t);
        if (m) { ptype = m[1]!; pname = m[2]!; } else { pname = t; ptype = ''; }
      }
      const pm = takeMult(ptype);
      const nm = takeMult(pname);
      params.push({ name: nm.text, typeText: pm.text, mult: pm.mult ?? nm.mult, ...(def ? { def } : {}) });
    }
  }
  return { vis, name, params, retText: rm.text, retMult: rm.mult, isStatic, isAbstract };
}

// ---------------------------------------------------------------- Construcción
export function buildUml(ws: Workspace, opts: CodegenOptions, lang: Lang, warnings: Warnings): UmlModel | null {
  const scope = selectScope(ws, opts.viewId, { element: isUmlClassifier, relation: r => r.typeId.startsWith('uml:') });
  if (!scope) { warnings.add(W.viewMissing, { view: opts.viewId ?? '' }); return null; }
  const reserved = lang === 'ts' ? TS_RESERVED : JAVA_RESERVED;
  const fallback = lang === 'ts' ? 'unknown' : 'Object';

  // ---- nombres de tipo (únicos en todo el ámbito: TS genera un único fichero)
  const used = new Set<string>();
  const classifiers: Classifier[] = [];
  const byId = new Map<string, Classifier>();
  for (const el of scope.elements) {
    const kind = KIND_OF[el.typeId]!;
    const base = codeName(el.name.trim() || DEFAULT_NAME[kind], 'type', reserved, warnings, DEFAULT_NAME[kind]);
    const name = uniqueName(base, used);
    if (name !== base) warnings.add(W.duplicateName, { name: el.name, id: name });
    const c: Classifier = {
      id: el.id, kind, name, rawName: el.name.trim(), abstract: kind === 'class' && isTrue(el.fields.abstract),
      stereotype: str(el.fields.stereotype).trim().replace(/^[«<]+|[»>]+$/g, ''), doc: el.doc.trim(),
      pkg: namespaceOf(ws, scope, el.id, lang), attrs: [], ops: [], values: [], interfaces: [],
    };
    classifiers.push(c);
    byId.set(c.id, c);
  }
  // clasificadores del espacio fuera del ámbito (se pueden referenciar, no se generan)
  const outside = new Map<string, { id: string; name: string }>();
  const quiet = new Warnings();
  for (const el of Object.values(ws.elements).sort(byNameThenId)) {
    if (!isUmlClassifier(el) || el.template || byId.has(el.id) || !el.name.trim()) continue;
    const name = codeName(el.name, 'type', reserved, quiet, DEFAULT_NAME[KIND_OF[el.typeId]!]);
    for (const k of [el.name.trim(), name]) if (!outside.has(k)) outside.set(k, { id: el.id, name });
  }
  const lookup = new Map<string, Classifier>();
  const lookupCi = new Map<string, Classifier>();
  for (const c of classifiers) for (const k of [c.rawName, c.name]) {
    if (!lookup.has(k)) lookup.set(k, c);
    if (!lookupCi.has(k.toLowerCase())) lookupCi.set(k.toLowerCase(), c);
  }

  // ---- tipos
  const parseType = (text: string, owner: string): { type: TypeRef; optional: boolean } => {
    let t = text.trim();
    let optional = false;
    if (t.endsWith('?')) { optional = true; t = t.slice(0, -1).trim(); }
    if (t.endsWith('[]')) return { type: { k: 'array', of: parseType(t.slice(0, -2), owner).type }, optional };
    const g = /^([A-Za-z_$][\w$.]*)\s*<(.*)>$/s.exec(t);
    if (g) {
      const gname = g[1]!.split('.').pop()!.toLowerCase();
      const args = splitTop(g[2]!, ',').map(a => parseType(a, owner).type);
      if (LISTS.has(gname) && args.length === 1) return { type: { k: 'array', of: args[0]! }, optional };
      if (SETS.has(gname) && args.length === 1) return { type: { k: 'set', of: args[0]! }, optional };
      if (MAPS.has(gname) && args.length === 2) return { type: { k: 'map', key: args[0]!, value: args[1]! }, optional };
      if (OPTIONALS.has(gname) && args.length === 1) return { type: args[0]!, optional: true };
    }
    const simple = t.includes('.') && !g ? t.split('.').pop()! : t;
    const prim = PRIMS[simple.toLowerCase()];
    if (prim) return { type: { k: 'prim', p: prim }, optional };
    const c = lookup.get(simple) ?? lookup.get(t) ?? lookupCi.get(simple.toLowerCase());
    if (c) return { type: { k: 'ref', id: c.id, name: c.name }, optional };
    const o = outside.get(simple) ?? outside.get(t);
    if (o) { warnings.add(W.typeOutOfScope, { type: t, owner }); return { type: { k: 'ref', id: o.id, name: o.name }, optional }; }
    warnings.add(W.unknownType, { type: t, owner, fallback });
    return { type: { k: 'unknown', raw: t }, optional };
  };
  const typed = (typeText: string, mult: Mult | null, owner: string, member: string): { type: TypeRef; optional: boolean } => {
    if (!typeText) { warnings.add(W.missingType, { member, owner, fallback }); return { type: wrapMult({ k: 'unknown', raw: '' }, mult), optional: !!mult?.optional }; }
    const r = parseType(typeText, `${owner}.${member}`);
    return { type: wrapMult(r.type, mult), optional: r.optional || !!mult?.optional };
  };

  // ---- miembros
  const elById = new Map(scope.elements.map(e => [e.id, e] as const));
  const memberNames = new Map<string, Set<string>>();
  const memberName = (c: Classifier, raw: string, isOp: boolean): string => {
    const base = codeName(raw, 'member', reserved, warnings, isOp ? 'operacion' : 'atributo');
    // TS: propiedades y métodos comparten espacio de nombres; Java: solo los campos entre sí (los métodos se sobrecargan)
    if (isOp && lang === 'java') return base;
    const set = memberNames.get(c.id) ?? memberNames.set(c.id, new Set()).get(c.id)!;
    const name = uniqueName(base, set);
    if (name !== base) warnings.add(W.duplicateMember, { member: raw, owner: c.name, id: name });
    return name;
  };
  for (const c of classifiers) {
    const el = elById.get(c.id)!;
    if (c.kind === 'enum') {
      const vu = new Set<string>();
      for (const l of lines(el.fields.values)) {
        const raw = l.replace(/^[+\-#~]\s*/, '').split(/[=:(]/)[0]!.trim() || l;
        const base = codeName(raw, 'constant', reserved, warnings, 'VALOR');
        const v = uniqueName(base, vu, '_');
        if (v !== base) warnings.add(W.duplicateMember, { member: raw, owner: c.name, id: v });
        c.values.push(v);
      }
      continue;
    }
    for (const l of lines(el.fields.attributes)) {
      const a = parseAttributeLine(l);
      if (!a) { warnings.add(W.unparsedLine, { line: l, owner: c.name }); continue; }
      const name = memberName(c, a.name, false);
      const { type, optional } = typed(a.typeText, a.mult, c.name, name);
      c.attrs.push({ name, vis: a.vis, isStatic: a.isStatic, readonly: a.readonly, derived: a.derived, type, optional, ...(a.def ? { def: a.def } : {}) });
    }
    for (const l of lines(el.fields.operations)) {
      const o = parseOperationLine(l);
      if (!o) { warnings.add(W.unparsedLine, { line: l, owner: c.name }); continue; }
      const name = memberName(c, o.name, true);
      const pu = new Set<string>();
      const params = o.params.map((p, i) => {
        const pname = uniqueName(codeName(p.name, 'member', reserved, warnings, `arg${i}`), pu);
        const { type, optional } = typed(p.typeText, p.mult, `${c.name}.${name}`, pname);
        return { name: pname, type, optional, ...(p.def ? { def: p.def } : {}) };
      });
      const ret = o.retText ? parseType(o.retText, `${c.name}.${name}`) : { type: { k: 'prim', p: 'void' } as TypeRef, optional: false };
      const isAbstract = o.isAbstract && c.kind === 'class';
      c.ops.push({ name, vis: o.vis, isStatic: o.isStatic, isAbstract, params, ret: wrapMult(ret.type, o.retMult), retOptional: ret.optional || !!o.retMult?.optional });
    }
    if (c.kind === 'class' && !c.abstract && c.ops.some(o => o.isAbstract)) {
      warnings.add(W.abstractInConcrete, { name: c.name });
      c.abstract = true;
    }
  }

  // ---- herencia y realización
  const superCandidates = new Map<string, Classifier[]>();
  const reachesIface = (from: string, target: string, seen = new Set<string>()): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (byId.get(from)?.interfaces ?? []).some(i => reachesIface(i, target, seen));
  };
  const addIfaceExtends = (s: Classifier, t: Classifier) => {
    if (s.interfaces.includes(t.id)) return;
    if (reachesIface(t.id, s.id)) { warnings.add(W.inheritanceCycle, { from: s.name, to: t.name }); return; }
    s.interfaces.push(t.id);
  };
  const addImplements = (s: Classifier, t: Classifier) => { if (!s.interfaces.includes(t.id)) s.interfaces.push(t.id); };
  for (const r of scope.relations) {
    const s = byId.get(r.from.elementId!), t = byId.get(r.to.elementId!);
    if (!s || !t) continue;
    if (r.typeId === UML.generalization) {
      if (s.kind === 'class' && t.kind === 'class') (superCandidates.get(s.id) ?? superCandidates.set(s.id, []).get(s.id)!).push(t);
      else if (s.kind === 'interface' && t.kind === 'interface') addIfaceExtends(s, t);
      else if (s.kind === 'class' && t.kind === 'interface') addImplements(s, t);
      else warnings.add(W.badGeneralization, { from: s.name, fromKind: KIND_LABEL[s.kind], to: t.name, toKind: KIND_LABEL[t.kind] });
    } else if (r.typeId === UML.realization) {
      if (t.kind !== 'interface') warnings.add(W.badRealization, { from: s.name, to: t.name });
      else if (s.kind === 'class') addImplements(s, t);
      else if (s.kind === 'interface') addIfaceExtends(s, t);
      else warnings.add(W.badRealization, { from: s.name, to: t.name });
    }
  }
  const superChainHas = (from: string | undefined, target: string): boolean => {
    const seen = new Set<string>();
    for (let cur = from; cur && !seen.has(cur); cur = byId.get(cur)?.superclass) { if (cur === target) return true; seen.add(cur); }
    return false;
  };
  for (const c of classifiers) {
    const cands = (superCandidates.get(c.id) ?? []).sort(byNameThenId);
    const ok = cands.filter(t => {
      if (t.id === c.id || superChainHas(t.id, c.id)) { warnings.add(W.inheritanceCycle, { from: c.name, to: t.name }); return false; }
      return true;
    });
    if (!ok.length) continue;
    if (ok.length > 1) warnings.add(W.multipleInheritance, { name: c.name, classes: ok.map(t => t.name).join(', '), used: ok[0]!.name });
    c.superclass = ok[0]!.id;
  }
  // segunda pasada: una herencia aceptada antes puede cerrar un ciclo con una posterior
  for (const c of classifiers) if (c.superclass && superChainHas(byId.get(c.superclass)?.superclass, c.id)) {
    warnings.add(W.inheritanceCycle, { from: c.name, to: byId.get(c.superclass)!.name });
    delete c.superclass;
  }

  // ---- asociaciones: propiedades de navegación
  const navProp = (owner: Classifier, other: Classifier, role: string, card: string, r: Relation) => {
    if (owner.kind === 'enum') return;
    const raw = role.trim() || camelCase(other.rawName || other.name) || camelCase(other.name);
    const name = memberName(owner, raw, false);
    const mult = parseMult(card) ?? { many: false, optional: false };
    const label = STRUCTURAL[r.typeId]!;
    const note = `${label}${r.name ? ` «${r.name}»` : ''} con ${other.name}${card ? ` (${card.trim()})` : ''}.`;
    owner.attrs.push({ name, vis: '', isStatic: false, readonly: false, derived: false, type: wrapMult({ k: 'ref', id: other.id, name: other.name }, mult), optional: mult.optional, note });
  };
  for (const r of scope.relations) {
    if (!(r.typeId in STRUCTURAL)) continue;
    const s = byId.get(r.from.elementId!), t = byId.get(r.to.elementId!);
    if (!s || !t) continue;
    const nav = str(r.fields.navigable) || 'target';
    if (nav === 'target' || nav === 'both') navProp(s, t, str(r.fields.targetRole), str(r.fields.targetCard), r);
    if (nav === 'source' || nav === 'both') navProp(t, s, str(r.fields.sourceRole), str(r.fields.sourceCard), r);
  }

  // ---- stubs: miembros de interfaces y operaciones abstractas heredadas sin implementar
  const ifaceClosure = (ids: string[], seen = new Set<string>()): Classifier[] => {
    const out: Classifier[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const i = byId.get(id);
      if (!i) continue;
      out.push(i, ...ifaceClosure(i.interfaces, seen));
    }
    return out;
  };
  const chain = (c: Classifier): Classifier[] => {
    const out: Classifier[] = [];
    const seen = new Set<string>([c.id]);
    for (let cur = c.superclass ? byId.get(c.superclass) : undefined; cur && !seen.has(cur.id); cur = cur.superclass ? byId.get(cur.superclass) : undefined) { seen.add(cur.id); out.push(cur); }
    return out;
  };
  // procesar de la raíz hacia abajo para que las superclases ya tengan sus stubs
  const depth = (c: Classifier) => chain(c).length;
  for (const c of classifiers.filter(x => x.kind === 'class').sort((a, b) => depth(a) - depth(b) || byNameThenId(a, b))) {
    const ancestors = chain(c);
    const hasAttr = (n: string) => [c, ...ancestors].some(x => x.attrs.some(a => a.name === n));
    const hasConcreteOp = (n: string) => [c, ...ancestors].some(x => x.ops.some(o => o.name === n && !o.isAbstract));
    const hasOp = (n: string) => c.ops.some(o => o.name === n);
    const names = memberNames.get(c.id) ?? memberNames.set(c.id, new Set()).get(c.id)!;
    for (const i of ifaceClosure(c.interfaces)) {
      for (const a of i.attrs) if (!hasAttr(a.name) && !a.isStatic) { c.attrs.push({ ...a, from: i.name }); names.add(a.name); }
      for (const o of i.ops) if (!o.isStatic && !hasConcreteOp(o.name) && !hasOp(o.name)) c.ops.push({ ...o, isAbstract: false, from: i.name });
    }
    if (!c.abstract) {
      for (const a of ancestors) for (const o of a.ops) if (o.isAbstract && !hasConcreteOp(o.name) && !hasOp(o.name)) c.ops.push({ ...o, isAbstract: false, from: a.name });
    }
  }
  return { classifiers, byId, scope };
}

const isTrue = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

/** Namespace del paquete contenedor (cadena de paquetes anidados o `fields.namespace`). */
function namespaceOf(ws: Workspace, scope: Scope, elId: string, lang: Lang): string {
  const isPkg = (e: Element) => e.typeId === UML.package;
  const seen = new Set<string>();
  const segs = (pkg: Element | undefined): string[] => {
    if (!pkg || seen.has(pkg.id)) return [];
    seen.add(pkg.id);
    const ns = str(pkg.fields.namespace).trim();
    if (ns) return ns.split(/[./:\\]+/).filter(Boolean);
    return [...segs(containerOf(ws, scope.nodes, pkg.id, isPkg)), pkg.name || pkg.id];
  };
  const raw = segs(containerOf(ws, scope.nodes, elId, isPkg));
  return raw.map(s => packageSegment(s, lang)).filter(Boolean).join('.');
}

/** Segmento de paquete Java (minúsculas, sin tildes, solo `[a-z0-9_]`). */
export function packageSegment(s: string, lang: Lang): string {
  let seg = stripAccents(s).toLowerCase().replace(/[^a-z0-9_]+/g, '');
  if (!seg) return '';
  if (/^[0-9]/.test(seg)) seg = '_' + seg;
  if ((lang === 'java' ? JAVA_RESERVED : TS_RESERVED).has(seg)) seg += '_';
  return seg;
}

/** ¿Es un literal "simple" (número, booleano, null, cadena entre comillas)? */
export const isNumberLiteral = (s: string): boolean => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s);
export const quotedString = (s: string): string | null => {
  const m = /^(['"])(.*)\1$/s.exec(s.trim());
  return m ? m[2]! : null;
};
export { isIdentifier };
