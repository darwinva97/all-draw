/**
 * ER → SQL DDL (`er-postgres`, `er-sqlite`): un fichero `schema.postgres.sql` / `schema.sqlite.sql`.
 *
 * - Tablas desde `er:Entity`: nombre `fields.table` o el de la entidad en snake_case. Columnas desde
 *   `fields.attributes` (clave = columna, valor = tipo, admite marcas `pk`, `not null`, `null`, `unique`,
 *   `default x` y un `?` final = admite nulos). PK desde `fields.pk`; si está vacía y hay columna `id`, esa.
 * - Claves ajenas desde `er:OneToOne`/`er:OneToMany`/`er:ManyToMany` con la cardinalidad de cada extremo
 *   (`sourceCard`/`targetCard`, por defecto la del tipo: 1:1, 1:N con origen = uno, N:M): el lado "muchos"
 *   referencia al "uno"; 1:1 → el destino referencia al origen con UNIQUE; N:M → tabla intermedia `a_b` con PK
 *   compuesta y dos FK (ON DELETE CASCADE salvo que la relación diga otra cosa). Si la relación une puertos de
 *   atributo (o trae `mappings`) se usan esas columnas; si no, `<tabla>_<pk>` (creada con el tipo de la PK si no
 *   existe). NOT NULL según la cardinalidad mínima del lado referenciado. `ON DELETE` desde `fields.onDelete`.
 *   Un índice por FK salvo si la FK es UNIQUE o un prefijo de la PK.
 * - `er:Inherits` (subtipo → supertipo): estrategia joined (la PK del subtipo referencia a la del supertipo);
 *   otras estrategias solo como comentario, con aviso.
 * - Orden topológico (las referenciadas antes; a igualdad, por nombre). Ciclos: en PostgreSQL esas FK se
 *   añaden al final con `ALTER TABLE`; en SQLite se dejan en línea (las admite) con aviso.
 * - `er:View` con `fields.query` → `CREATE [MATERIALIZED] VIEW` al final.
 * - Identificadores entrecomillados solo si hace falta (mayúsculas, espacios, palabras reservadas…).
 */
import { portKeyOf, type Element, type Relation, type Workspace } from '@all-draw/core';
import type { CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { generatedBy, keyValues, selectScope, snakeCase, str, uniqueName } from './util';

export type Dialect = 'postgres' | 'sqlite';
const ER = {
  entity: 'er:Entity', view: 'er:View',
  oneToOne: 'er:OneToOne', oneToMany: 'er:OneToMany', manyToMany: 'er:ManyToMany', inherits: 'er:Inherits',
} as const;

// ---------------------------------------------------------------- Tipos
type Canon =
  | 'int' | 'smallint' | 'bigint' | 'serial' | 'bigserial' | 'varchar' | 'char' | 'text' | 'decimal' | 'real' | 'double'
  | 'bool' | 'date' | 'time' | 'timestamp' | 'timestamptz' | 'uuid' | 'json' | 'jsonb' | 'blob' | 'unknown';
interface SqlType { canon: Canon; args?: string; raw: string }

const CANON: Record<string, Canon> = {
  int: 'int', integer: 'int', int4: 'int', int32: 'int', mediumint: 'int',
  smallint: 'smallint', int2: 'smallint', tinyint: 'smallint', short: 'smallint',
  bigint: 'bigint', int8: 'bigint', long: 'bigint', int64: 'bigint',
  serial: 'serial', serial4: 'serial', autoincrement: 'serial', autonumeric: 'serial', bigserial: 'bigserial', serial8: 'bigserial',
  varchar: 'varchar', 'character varying': 'varchar', nvarchar: 'varchar', string: 'varchar', str: 'varchar',
  char: 'char', character: 'char', nchar: 'char',
  text: 'text', clob: 'text', longtext: 'text', mediumtext: 'text', tinytext: 'text',
  decimal: 'decimal', numeric: 'decimal', number: 'decimal', money: 'decimal', currency: 'decimal',
  float: 'real', real: 'real', float4: 'real',
  double: 'double', 'double precision': 'double', float8: 'double',
  bool: 'bool', boolean: 'bool', bit: 'bool',
  date: 'date', time: 'time',
  datetime: 'timestamp', timestamp: 'timestamp', 'timestamp without time zone': 'timestamp',
  timestamptz: 'timestamptz', 'timestamp with time zone': 'timestamptz',
  uuid: 'uuid', guid: 'uuid', uniqueidentifier: 'uuid',
  json: 'json', jsonb: 'jsonb',
  blob: 'blob', binary: 'blob', varbinary: 'blob', bytea: 'blob', bytes: 'blob', image: 'blob',
};

function parseSqlType(text: string): SqlType {
  const raw = text.trim();
  const m = /^([A-Za-z_][A-Za-z0-9_ ]*?)\s*(?:\(\s*([^)]*?)\s*\))?$/.exec(raw);
  if (!m) return { canon: 'unknown', raw };
  const name = m[1]!.toLowerCase().replace(/\s+/g, ' ');
  let canon = CANON[name] ?? 'unknown';
  let args = m[2]?.replace(/\s+/g, '') || undefined;
  if (name === 'money' || name === 'currency') args ??= '19,4';
  if ((name === 'string' || name === 'str') && !args) canon = 'text';
  return args ? { canon, args, raw } : { canon, raw };
}

function renderType(t: SqlType, d: Dialect): string {
  if (d === 'sqlite') {
    switch (t.canon) {
      case 'int': case 'smallint': case 'bigint': case 'serial': case 'bigserial': case 'bool': return 'INTEGER';
      case 'decimal': return 'NUMERIC';
      case 'real': case 'double': return 'REAL';
      case 'blob': return 'BLOB';
      case 'unknown': return t.raw;
      default: return 'TEXT';
    }
  }
  const a = t.args ? `(${t.args.replace(/,/g, ', ')})` : '';
  switch (t.canon) {
    case 'int': return 'integer';
    case 'double': return 'double precision';
    case 'bool': return 'boolean';
    case 'decimal': return `numeric${a}`;
    case 'varchar': case 'char': return `${t.canon}${a}`;
    case 'blob': return 'bytea';
    case 'unknown': return t.raw;
    default: return t.canon;
  }
}

/** Tipo de una columna que referencia a otra (serial → integer). */
const fkType = (t: SqlType): SqlType => (t.canon === 'serial' ? { canon: 'int', raw: 'integer' } : t.canon === 'bigserial' ? { canon: 'bigint', raw: 'bigint' } : t);

// ---------------------------------------------------------------- Identificadores
const SQL_RESERVED = new Set(`all analyse analyze and any array as asc asymmetric authorization between binary both case cast check collate
column concurrently constraint create cross current_catalog current_date current_role current_schema current_time current_timestamp
current_user default deferrable delete desc distinct do drop else end except exists false fetch for foreign freeze from full grant group
having ilike in index initially inner insert intersect into is isnull join key lateral leading left like limit localtime localtimestamp
natural not notnull null offset on only or order outer overlaps placing primary references returning right select session_user set
similar some symmetric table tablesample then to trailing true union unique update user using values variadic verbose view when where
window with`.split(/\s+/));
export const quoteIdent = (name: string): string => (/^[a-z_][a-z0-9_]*$/.test(name) && !SQL_RESERVED.has(name) ? name : `"${name.replace(/"/g, '""')}"`);
const constraintName = (...parts: string[]): string => quoteIdent(parts.map(p => snakeCase(p) || 'x').join('_').slice(0, 63));

// ---------------------------------------------------------------- Modelo de tablas
interface Column { name: string; type: SqlType; notNull: boolean; unique: boolean; def?: string; fromFk: boolean }
interface Fk { columns: string[]; ref: Table; refColumns: string[]; onDelete: string; unique: boolean }
interface Table {
  id: string; name: string; doc: string; columns: Column[]; pk: string[]; uniques: string[][]; fks: Fk[];
  comments: string[];
}
interface Card { min: number; many: boolean }
const CARD_DEFAULTS: Record<string, [string, string]> = {
  [ER.oneToOne]: ['1..1', '1..1'], [ER.oneToMany]: ['1..1', '1..*'], [ER.manyToMany]: ['1..*', '1..*'],
};
function parseCard(s: string): Card {
  const t = s.trim();
  if (t === '*' || t === '0..*' || t === 'n' || t === 'N' || t === '0..n') return { min: 0, many: true };
  if (t === '1..*' || t === '1..n') return { min: 1, many: true };
  if (t === '0..1' || t === '0') return { min: 0, many: false };
  const m = /^(\d+)(?:\.\.(\d+|\*))?$/.exec(t);
  if (m) { const lo = Number(m[1]), hi = m[2] === '*' ? Infinity : Number(m[2] ?? m[1]); return { min: lo, many: hi > 1 }; }
  return { min: 1, many: false };
}

const ON_DELETE: Record<string, string> = { cascade: 'CASCADE', 'set null': 'SET NULL', restrict: 'RESTRICT', 'set default': 'SET DEFAULT', 'no action': '' };

function buildTables(scopeEls: Element[], relations: Relation[], warnings: Warnings): Map<string, Table> {
  const tables = new Map<string, Table>();
  const usedNames = new Set<string>();
  for (const el of scopeEls) {
    if (el.typeId !== ER.entity) continue;
    const base = str(el.fields.table).trim() || snakeCase(el.name) || 'tabla';
    const name = uniqueName(base, usedNames, '_');
    if (name !== base) warnings.add(W.duplicateName, { name: base, id: name });
    const t: Table = { id: el.id, name, doc: el.doc.trim(), columns: [], pk: [], uniques: [], fks: [], comments: [] };
    const colNames = new Set<string>();
    const flaggedPk: string[] = [];
    for (const kv of keyValues(el.fields.attributes)) {
      const cname = uniqueName(kv.key, colNames, '_');
      if (cname !== kv.key) warnings.add(W.duplicateName, { name: kv.key, id: cname });
      let spec = kv.value;
      let notNull = false, unique = false, pk = false, nullable = false;
      let def: string | undefined;
      const dm = /\s+default\s+(.+)$/i.exec(spec);
      if (dm) { def = dm[1]!.trim(); spec = spec.slice(0, dm.index); }
      const flag = (re: RegExp) => { const hit = re.test(spec); if (hit) spec = spec.replace(re, ' ').trim(); return hit; };
      if (flag(/\bprimary\s+key\b|\bpk\b/i)) pk = true;
      if (flag(/\bnot\s+null\b|\bnotnull\b|\brequired\b|!$/i)) notNull = true;
      if (flag(/\bunique\b|\buk\b/i)) unique = true;
      flag(/\bfk\b/i);
      if (flag(/\bnullable\b|\bnull\b|\?$/i)) nullable = true;
      spec = spec.trim();
      if (!spec) warnings.add(W.missingSqlType, { table: name, column: cname, fallback: 'text' });
      const type = spec ? parseSqlType(spec) : { canon: 'text' as const, raw: 'text' };
      if (type.canon === 'unknown') warnings.add(W.unknownSqlType, { type: type.raw, table: name, column: cname });
      if (pk) flaggedPk.push(cname);
      t.columns.push({ name: cname, type, notNull: notNull && !nullable, unique, ...(def !== undefined ? { def } : {}), fromFk: false });
    }
    const declared = Array.isArray(el.fields.pk) ? el.fields.pk.map(String) : str(el.fields.pk).split(/[,\n]/);
    for (const p of [...declared.map(s => s.trim()).filter(Boolean), ...flaggedPk]) {
      const col = findCol(t, p);
      if (!col) { warnings.add(W.pkMissingColumn, { table: name, column: p }); continue; }
      if (!t.pk.includes(col.name)) t.pk.push(col.name);
    }
    if (!t.pk.length) { const id = findCol(t, 'id'); if (id) t.pk.push(id.name); }
    tables.set(el.id, t);
  }

  // ---- herencia primero (puede crear la PK del subtipo, que otras FK usan)
  const sorted = [...relations].sort((a, b) => Number(b.typeId === ER.inherits) - Number(a.typeId === ER.inherits));
  for (const r of sorted) {
    const a = tables.get(r.from.elementId!), b = tables.get(r.to.elementId!);
    if (!a || !b) continue;
    const onDelete = ON_DELETE[str(r.fields.onDelete).toLowerCase()] ?? '';
    if (r.typeId === ER.inherits) {
      const kind = str(r.fields.kind) || 'joined';
      if (kind !== 'joined') {
        warnings.add(W.inheritsStrategy, { sub: a.name, super: b.name, kind });
        a.comments.push(`${a.name} hereda de ${b.name} (estrategia ${kind}).`);
        continue;
      }
      if (!b.pk.length) { warnings.add(W.fkNoPk, { relation: r.name || r.id, table: b.name }); continue; }
      if (!a.pk.length) {
        for (const p of b.pk) {
          const ref = findCol(b, p)!;
          const col = findCol(a, p) ?? addCol(a, { name: p, type: fkType(ref.type), notNull: true, unique: false, fromFk: true });
          a.pk.push(col.name);
        }
      }
      if (a.pk.length !== b.pk.length) { warnings.add(W.inheritsPkMismatch, { sub: a.name, super: b.name }); continue; }
      a.comments.push(`${a.name} hereda de ${b.name} (estrategia joined: comparte su clave primaria).`);
      a.fks.push({ columns: [...a.pk], ref: b, refColumns: [...b.pk], onDelete: onDelete || 'CASCADE', unique: true });
      continue;
    }
    if (!(r.typeId in CARD_DEFAULTS)) continue;
    const [ds, dt] = CARD_DEFAULTS[r.typeId]!;
    const cs = parseCard(str(r.fields.sourceCard) || ds), ct = parseCard(str(r.fields.targetCard) || dt);
    const { fromCols, toCols } = endColumns(r);
    if (cs.many && ct.many) {
      junction(r, a, b, fromCols, toCols, onDelete || 'CASCADE', tables, usedNames, warnings);
    } else if (ct.many) {
      addFk(r, b, a, toCols, fromCols, cs.min === 0, false, onDelete, warnings);
    } else if (cs.many) {
      addFk(r, a, b, fromCols, toCols, ct.min === 0, false, onDelete, warnings);
    } else {
      addFk(r, b, a, toCols, fromCols, cs.min === 0, true, onDelete, warnings);
    }
  }
  return tables;
}

const findCol = (t: Table, name: string): Column | undefined =>
  t.columns.find(c => c.name === name) ?? t.columns.find(c => c.name.toLowerCase() === name.toLowerCase());
const addCol = (t: Table, c: Column): Column => { t.columns.push(c); return c; };

/** Columnas unidas por la relación: `mappings` o los puertos de los extremos (`attributes.<col>`). */
function endColumns(r: Relation): { fromCols: string[] | null; toCols: string[] | null } {
  const col = (path: string) => { const k = portKeyOf(path); return k.startsWith('attributes.') ? k.slice('attributes.'.length) : k; };
  const maps = r.mappings.filter(m => m.fromPath && m.toPath);
  if (maps.length) return { fromCols: maps.map(m => col(m.fromPath)), toCols: maps.map(m => col(m.toPath)) };
  return { fromCols: r.from.portId ? [col(r.from.portId)] : null, toCols: r.to.portId ? [col(r.to.portId)] : null };
}

function fkColumnName(child: Table, parent: Table, refCol: string, r: Relation): string {
  const relName = snakeCase(r.name);
  const parentBase = snakeCase(parent.name) || parent.name;
  let base = child === parent
    ? `${relName || 'padre'}_${refCol}`
    : refCol.toLowerCase().startsWith(parentBase.toLowerCase() + '_') ? refCol : `${parentBase}_${refCol}`;
  const existing = findCol(child, base);
  if (existing && existing.fromFk && relName && child !== parent) base = `${relName}_${refCol}`;
  const again = findCol(child, base);
  if (again && again.fromFk) base = uniqueName(base, new Set(child.columns.map(c => c.name)), '_');
  return base;
}

function addFk(r: Relation, child: Table, parent: Table, childCols: string[] | null, parentCols: string[] | null, nullable: boolean, unique: boolean, onDelete: string, warnings: Warnings): void {
  const refCols = (parentCols ?? parent.pk).map(c => findCol(parent, c)?.name ?? c);
  if (!refCols.length) { warnings.add(W.fkNoPk, { relation: r.name || r.id, table: parent.name }); return; }
  for (const c of refCols) if (!findCol(parent, c)) addCol(parent, { name: c, type: { canon: 'int', raw: 'integer' }, notNull: false, unique: false, fromFk: true });
  if (parentCols && !sameSet(refCols, parent.pk)) warnings.add(W.fkNotKey, { table: child.name, columns: refCols.join(', '), ref: parent.name });
  let cols = childCols;
  if (cols && cols.length !== refCols.length) {
    warnings.add(W.fkColumnCount, { relation: r.name || r.id, count: cols.length, expected: refCols.length });
    cols = null;
  }
  const names = (cols ?? refCols.map(rc => fkColumnName(child, parent, rc, r))).map((name, i) => {
    const ref = findCol(parent, refCols[i]!)!;
    const col = findCol(child, name) ?? addCol(child, { name, type: fkType(ref.type), notNull: false, unique: false, fromFk: true });
    if (!child.pk.includes(col.name)) col.notNull = !nullable;
    return col.name;
  });
  if (onDelete === 'SET NULL' && !nullable) warnings.add(W.setNullNotNull, { table: child.name, column: names.join(', ') });
  if (unique && !sameSet(names, child.pk) && !child.uniques.some(u => sameSet(u, names))) child.uniques.push(names);
  child.fks.push({ columns: names, ref: parent, refColumns: refCols, onDelete, unique });
}

function junction(r: Relation, a: Table, b: Table, fromCols: string[] | null, toCols: string[] | null, onDelete: string, tables: Map<string, Table>, usedNames: Set<string>, warnings: Warnings): void {
  const aCols = (fromCols ?? a.pk).map(c => findCol(a, c)?.name ?? c), bCols = (toCols ?? b.pk).map(c => findCol(b, c)?.name ?? c);
  if (!aCols.length) { warnings.add(W.fkNoPk, { relation: r.name || r.id, table: a.name }); return; }
  if (!bCols.length) { warnings.add(W.fkNoPk, { relation: r.name || r.id, table: b.name }); return; }
  const base = `${a.name}_${b.name}`;
  const name = uniqueName(usedNames.has(base) && r.name ? snakeCase(r.name) || base : base, usedNames, '_');
  const t: Table = { id: `${r.id}#junction`, name, doc: r.doc.trim() || `Tabla intermedia de la relación N:M${r.name ? ` «${r.name}»` : ''} entre ${a.name} y ${b.name}.`, columns: [], pk: [], uniques: [], fks: [], comments: [] };
  const used = new Set<string>();
  const side = (tbl: Table, cols: string[]) => cols.map(c => {
    const ref = findCol(tbl, c);
    const cname = uniqueName(c.toLowerCase().startsWith(tbl.name.toLowerCase() + '_') ? c : `${tbl.name}_${c}`, used, '_');
    t.columns.push({ name: cname, type: ref ? fkType(ref.type) : { canon: 'int', raw: 'integer' }, notNull: true, unique: false, fromFk: true });
    t.pk.push(cname);
    return cname;
  });
  const ac = side(a, aCols), bc = side(b, bCols);
  t.fks.push({ columns: ac, ref: a, refColumns: aCols, onDelete, unique: false }, { columns: bc, ref: b, refColumns: bCols, onDelete, unique: false });
  tables.set(t.id, t);
}

const sameSet = (x: string[], y: string[]) => x.length === y.length && x.every(v => y.includes(v));
const isPkPrefix = (cols: string[], pk: string[]) => cols.length <= pk.length && cols.every((c, i) => pk[i] === c);

// ---------------------------------------------------------------- Emisión
function topoOrder(tables: Table[]): { order: Table[]; cyclic: Set<string> } {
  const byName = [...tables].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.id < y.id ? -1 : 1));
  const done = new Set<Table>();
  const order: Table[] = [];
  const cyclic = new Set<string>();
  while (order.length < byName.length) {
    const ready = byName.find(t => !done.has(t) && t.fks.every(f => f.ref === t || done.has(f.ref)));
    const next = ready ?? byName.find(t => !done.has(t))!;
    if (!ready) for (const f of next.fks) if (f.ref !== next && !done.has(f.ref)) { cyclic.add(next.name); cyclic.add(f.ref.name); }
    done.add(next);
    order.push(next);
  }
  return { order, cyclic };
}

function fkClause(t: Table, f: Fk): string {
  const cols = f.columns.map(quoteIdent).join(', ');
  const refs = f.refColumns.map(quoteIdent).join(', ');
  return `CONSTRAINT ${constraintName('fk', t.name, ...f.columns)} FOREIGN KEY (${cols}) REFERENCES ${quoteIdent(f.ref.name)} (${refs})${f.onDelete ? ` ON DELETE ${f.onDelete}` : ''}`;
}

const sqlComment = (text: string): string[] => text.split('\n').map(l => `-- ${l}`.trimEnd());

export function generateErSql(ws: Workspace, opts: CodegenOptions, dialect: Dialect): CodegenResult {
  const warnings = new Warnings();
  const scope = selectScope(ws, opts.viewId, {
    element: el => el.typeId === ER.entity || el.typeId === ER.view,
    relation: r => r.typeId.startsWith('er:'),
  });
  if (!scope) { warnings.add(W.viewMissing, { view: opts.viewId ?? '' }); return { files: [], warnings: warnings.list }; }
  if (!scope.elements.length) { warnings.add(W.nothing, { scope: scope.title }); return { files: [], warnings: warnings.list }; }
  const tables = buildTables(scope.elements, scope.relations, warnings);
  for (const t of [...tables.values()].sort((x, y) => (x.name < y.name ? -1 : 1))) if (!t.pk.length) warnings.add(W.noPk, { table: t.name });
  const { order, cyclic } = topoOrder([...tables.values()]);
  if (cyclic.size) warnings.add(dialect === 'postgres' ? W.cyclePostgres : W.cycleSqlite, { tables: [...cyclic].sort().join(', ') });

  const out: string[] = [`-- ${generatedBy(scope.title)}`, `-- Esquema ${dialect === 'postgres' ? 'PostgreSQL' : 'SQLite'}.`];
  if (dialect === 'sqlite') out.push('', 'PRAGMA foreign_keys = ON;');
  const created = new Set<Table>();
  const deferred: string[] = [];
  for (const t of order) {
    out.push('');
    for (const c of t.comments) out.push(`-- ${c}`);
    if (t.doc) out.push(...sqlComment(t.doc));
    const inline: string[] = [];
    for (const c of t.columns) {
      const notNull = c.notNull || t.pk.includes(c.name);
      inline.push(`${quoteIdent(c.name)} ${renderType(c.type, dialect)}${notNull ? ' NOT NULL' : ''}${c.def !== undefined ? ` DEFAULT ${c.def}` : ''}`);
    }
    if (t.pk.length) inline.push(`PRIMARY KEY (${t.pk.map(quoteIdent).join(', ')})`);
    for (const c of t.columns) if (c.unique && !(t.pk.length === 1 && t.pk[0] === c.name)) inline.push(`UNIQUE (${quoteIdent(c.name)})`);
    for (const u of t.uniques) inline.push(`UNIQUE (${u.map(quoteIdent).join(', ')})`);
    for (const f of t.fks) {
      const later = dialect === 'postgres' && f.ref !== t && !created.has(f.ref);
      if (later) deferred.push(`ALTER TABLE ${quoteIdent(t.name)} ADD ${fkClause(t, f)};`);
      else inline.push(fkClause(t, f));
    }
    if (!t.columns.length && dialect === 'sqlite') out.push(`-- La tabla ${t.name} no tiene columnas; SQLite no admite tablas vacías.`);
    else out.push(`CREATE TABLE ${quoteIdent(t.name)} (`, inline.map(l => `  ${l}`).join(',\n'), ');');
    created.add(t);
    for (const f of t.fks) {
      if (f.unique || isPkPrefix(f.columns, t.pk)) continue;
      out.push(`CREATE INDEX ${constraintName('idx', t.name, ...f.columns)} ON ${quoteIdent(t.name)} (${f.columns.map(quoteIdent).join(', ')});`);
    }
  }
  if (deferred.length) out.push('', '-- Claves ajenas circulares', ...deferred);
  for (const v of scope.elements.filter(e => e.typeId === ER.view)) {
    const query = str(v.fields.query).trim().replace(/;\s*$/, '');
    const name = quoteIdent(str(v.fields.table).trim() || snakeCase(v.name) || 'vista');
    out.push('');
    if (v.doc.trim()) out.push(...sqlComment(v.doc.trim()));
    if (!query) { out.push(`-- La vista ${name} no tiene consulta.`); continue; }
    const mat = v.fields.materialized === true && dialect === 'postgres' ? 'MATERIALIZED ' : '';
    if (v.fields.materialized === true && dialect === 'sqlite') out.push('-- SQLite no tiene vistas materializadas: se crea una vista normal.');
    out.push(`CREATE ${mat}VIEW ${name} AS`, `${query};`);
  }
  const path = dialect === 'postgres' ? 'schema.postgres.sql' : 'schema.sqlite.sql';
  return { files: [{ path, content: out.join('\n') + '\n', language: 'sql' }], warnings: warnings.list };
}
