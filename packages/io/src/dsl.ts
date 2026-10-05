/**
 * **Lenguaje textual de all-draw (DSL)**: describe un espacio (modelo, vistas, librerías…) en texto legible, al estilo de
 * Structurizr DSL y LikeC4, pero con los tipos de todas nuestras notaciones (`pack:Tipo`). Extensión `.alldraw.txt`.
 * Gramática y ejemplos: `docs/manual/dsl.md`.
 *
 * ## API estable (la usa el panel de texto en vivo)
 *
 * - `parseDsl(text) → { workspace, diagnostics, unpositioned, locations }`: **nunca lanza**. Devuelve lo que pudo leer
 *   y los diagnósticos (`error`/`warning`, mensaje traducido con `tr`, `key`+`vars` para retraducir, y línea/columna
 *   1-based de inicio y fin). `unpositioned` son las vistas sin ninguna posición (`at`): la aplicación les aplica el
 *   layout automático (`@all-draw/layout`); io solo les pone una rejilla provisional. `locations` da dónde empieza la
 *   declaración de cada registro (`"elements/<id>"`, `"nodes/<id>"`…), para enlazar texto ↔ lienzo.
 * - `serializeDsl(ws, opts) → string`: texto determinista (mismo espacio → mismo texto) que conserva los ids, así
 *   `parseDsl(serializeDsl(ws)).workspace` es equivalente a `ws` (mismos registros, mismos valores). `opts.positions:
 *   false` omite posiciones, tamaños y quiebros (el modelo «limpio», para que lo coloque el layout).
 * - `isDsl(text)`: ¿parece este lenguaje? (para la detección de formato).
 *
 * ## Resumen de la gramática
 *
 * ```
 * // comentario de línea        /* comentario de bloque *\/
 * workspace "Nombre" {                      // opcional: también vale escribir las instrucciones sueltas
 *   description "…"   current vista_1
 *   library lib_x "Servicios" { elementType lib:lib_x:svc "Microservicio" { color "#c7d2fe"  field repo "Repositorio" url } }
 *   model {
 *     cliente = archimate:BusinessActor "Cliente" { doc "…"  tags ["vip"]  campo = "valor"  hijo = c4:Container "Web" }
 *     sirve = app -> cliente : archimate:Serving "atiende" { map "a.b" -> "c.d" }
 *   }
 *   views {
 *     view vista_1 "Mapa" {
 *       notation archimate   viewpoint layered
 *       include cliente at 40, 40 size 160, 56 { style { "fill": "#fff" }  include hijo at 10, 30 }
 *       note "Texto" at 300, 40
 *       edge sirve via 200, 80
 *     }
 *   }
 * }
 * ```
 * Valores: `"texto"` (escapes JSON), números, `true`/`false`/`null`, listas `[…]`, objetos `{ "clave": valor }` y, donde
 * se espera un nombre (`notation archimate`), identificadores sueltos. Ids: `[A-Za-z_$][\w$.-]*` con segmentos `:…`,
 * o cualquier texto entre acentos graves (`` `mi id` ``). Instrucciones: una por línea (o separadas por `;`).
 */
import { parseWorkspace, SCHEMA_VERSION, type Workspace, type Element, type Relation, type View, type ViewNode, type ViewEdge, type Library, type ElementType, type RelationType, type PortType, type FieldDef, type GridLayout } from '@all-draw/core';

type Layer = GridLayout['layers'][number];
type Stage = GridLayout['stages'][number];
import { emptyWs } from './empty';
import { tr } from './i18n';

export const DSL_VERSION = 1;
export const DSL_HEADER = `// all-draw DSL v${DSL_VERSION}`;

export interface DslDiagnostic {
  severity: 'error' | 'warning';
  /** Mensaje ya traducido (`tr`). */
  message: string;
  /** Clave (texto español con `{var}`) y variables, para retraducir si cambia el idioma. */
  key: string;
  vars: Record<string, string | number>;
  line: number; col: number; endLine: number; endCol: number;
}
export interface DslParseResult {
  workspace: Workspace;
  diagnostics: DslDiagnostic[];
  /** Vistas con nodos pero sin ninguna posición (`at`): necesitan layout automático. */
  unpositioned: string[];
  /** Inicio de la declaración de cada registro: `"elements/<id>"`, `"relations/<id>"`, `"views/<id>"`, `"nodes/<id>"`… */
  locations: Record<string, { line: number; col: number }>;
}
export interface DslSerializeOptions {
  /** Escribir posiciones, tamaños y puntos de quiebre (por defecto sí). */
  positions?: boolean;
  /** Cabecera `// all-draw DSL v1` (por defecto sí). */
  header?: boolean;
  /** Sangría (por defecto dos espacios). */
  indent?: string;
}

// ================================================================ Léxico
type TokType = 'id' | 'str' | 'num' | 'p' | 'nl' | 'eof';
interface Tok { t: TokType; v: string; line: number; col: number; endLine: number; endCol: number; quoted?: boolean }

const ID_START = /[A-Za-z_$]/;
const ID_CHAR = /[\w$.-]/;
const NUM = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

function lex(text: string, diag: (key: string, vars: Record<string, string | number>, at: { line: number; col: number }, end?: { line: number; col: number }) => void): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1, col = 1;
  const adv = (n = 1) => { for (let k = 0; k < n; k++) { if (text[i] === '\n') { line++; col = 1; } else col++; i++; } };
  const push = (t: TokType, v: string, sl: number, sc: number, quoted?: boolean) => out.push({ t, v, line: sl, col: sc, endLine: line, endCol: col, ...(quoted ? { quoted } : {}) });
  while (i < text.length) {
    const c = text[i]!;
    const sl = line, sc = col;
    if (c === '\n' || c === ';') { adv(); if (out[out.length - 1]?.t !== 'nl') push('nl', '\n', sl, sc); continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\uFEFF') { adv(); continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') adv(); continue; }
    if (c === '/' && text[i + 1] === '*') {
      adv(2);
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) adv();
      if (i >= text.length) diag('Comentario sin cerrar (falta */)', {}, { line: sl, col: sc });
      else adv(2);
      continue;
    }
    if (c === '"') {
      let j = i + 1, closed = false;
      while (j < text.length) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === '"') { closed = true; break; } if (text[j] === '\n') break; j++; }
      if (!closed) { diag('Texto sin cerrar (falta la comilla final)', {}, { line: sl, col: sc }); adv(j - i); push('str', '', sl, sc); continue; }
      const raw = text.slice(i, j + 1);
      let v = '';
      try { v = JSON.parse(raw) as string; } catch { diag('Texto con un escape no válido: {text}', { text: raw.slice(0, 40) }, { line: sl, col: sc }); v = raw.slice(1, -1); }
      adv(j + 1 - i); push('str', v, sl, sc); continue;
    }
    if (c === '`') {
      let j = i + 1, v = '';
      while (j < text.length && text[j] !== '`' && text[j] !== '\n') { if (text[j] === '\\' && j + 1 < text.length) { v += text[j + 1]; j += 2; continue; } v += text[j]; j++; }
      if (text[j] !== '`') { diag('Id entre acentos graves sin cerrar', {}, { line: sl, col: sc }); adv(j - i); push('id', v, sl, sc, true); continue; }
      adv(j + 1 - i); push('id', v, sl, sc, true); continue;
    }
    if (c === '-' && text[i + 1] === '>') { adv(2); push('p', '->', sl, sc); continue; }
    const m = (c === '-' || c === '.' || /\d/.test(c)) ? NUM.exec(text.slice(i, i + 40)) : null;
    if (m && !(c === '.' && !m[0])) { adv(m[0].length); push('num', m[0], sl, sc); continue; }
    if (ID_START.test(c)) {
      let j = i;
      for (;;) {
        while (j < text.length && ID_CHAR.test(text[j]!) && !(text[j] === '-' && text[j + 1] === '>')) j++;
        if (text[j] === ':' && j + 1 < text.length && ID_CHAR.test(text[j + 1]!) && text[j + 1] !== '-') { j++; continue; }
        break;
      }
      const v = text.slice(i, j);
      adv(j - i); push('id', v, sl, sc); continue;
    }
    if ('{}[](),=:*'.includes(c)) { adv(); push('p', c, sl, sc); continue; }
    diag('Carácter inesperado «{char}»', { char: c }, { line: sl, col: sc });
    adv();
  }
  out.push({ t: 'eof', v: '', line, col, endLine: line, endCol: col });
  return out;
}

// ================================================================ Borradores (fase 1) y resolución (fase 2)
type Pos = { line: number; col: number };
type Json = unknown;
interface ElDraft { id?: string; typeId: string; name: string; attrs: Partial<Element>; fields: Record<string, Json>; parent?: ElDraft; pos: Pos }
interface RelDraft { id?: string; from: { ref: string; pos: Pos }; to: { ref: string; pos: Pos }; typeId: string; name: string; attrs: Partial<Relation>; fields: Record<string, Json>; fromPort?: string; toPort?: string; fromEnd?: Json; toEnd?: Json; mappings: { fromPath: string; toPath: string; label?: string }[]; pos: Pos }
interface NodeDraft { id?: string; elementRef?: { ref: string; pos: Pos }; visualType?: string; visual: boolean; text?: string; at?: [number, number]; size?: [number, number]; cell?: { layerId: string; stageId: string }; attrs: Partial<ViewNode>; detail?: { ref: string; pos: Pos }; parent?: NodeDraft; pos: Pos; final?: ViewNode }
interface EdgeDraft { id?: string; relRef?: { ref: string; pos: Pos }; from?: { ref: string; pos: Pos }; to?: { ref: string; pos: Pos }; via: { x: number; y: number }[]; label?: string; attrs: Partial<ViewEdge>; fromPort?: string; toPort?: string; pos: Pos }
interface ViewDraft { id?: string; name: string; attrs: Partial<View>; root?: { ref: string; pos: Pos }; grid?: { layers: Layer[]; stages: Stage[]; stageGroups: { id: string; name: string; color?: string }[] }; nodes: NodeDraft[]; edges: EdgeDraft[]; includeAll: boolean; edgeAll: boolean; pos: Pos }

const ELEMENT_ATTRS: Record<string, keyof Element> = { doc: 'doc', tags: 'tags', props: 'props', features: 'features', ports: 'ports', profiles: 'profiles', library: 'libraryId', template: 'template', templateId: 'templateId' };
const RELATION_ATTRS: Record<string, keyof Relation> = { doc: 'doc', props: 'props', features: 'features', mappings: 'mappings' };
const VIEW_ATTRS: Record<string, keyof View> = { kind: 'kind', notation: 'notationId', viewpoint: 'viewpointId', doc: 'doc', public: 'public', style: 'style', props: 'props' };
const NODE_ATTRS: Record<string, keyof ViewNode> = { style: 'style', z: 'z', text: 'text', instanceNote: 'note', meta: 'meta', visualType: 'visualType' };
const EDGE_ATTRS: Record<string, keyof ViewEdge> = { style: 'style', label: 'label' };
const VISUALS: Record<string, string | undefined> = { note: 'core:note', label: 'core:label', group: 'core:group', image: 'core:image', node: undefined };
const RESERVED = new Set(['workspace', 'model', 'views', 'view', 'library', 'elementType', 'relationType', 'portType', 'field', 'dimension', 'person', 'rule', 'comment',
  'include', 'note', 'label', 'group', 'image', 'visual', 'node', 'edge', 'layer', 'stage', 'stagegroup', 'grid', 'true', 'false', 'null', 'as', 'at', 'size', 'cell',
  'from', 'to', 'via', 'in', 'color', 'map', 'name', 'description', 'current', 'created', 'updated', '_', 'detail', 'root']);

const slugId = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

class Parser {
  toks: Tok[]; i = 0;
  diags: DslDiagnostic[] = [];
  ws: Workspace = emptyWs('Sin nombre');
  els: ElDraft[] = []; rels: RelDraft[] = []; views: ViewDraft[] = [];
  locations: Record<string, Pos> = {};
  libPos = new Map<string, Pos>();

  constructor(text: string) {
    this.toks = lex(text, (key, vars, at, end) => this.diag('error', key, vars, at, end));
  }

  // ---- diagnósticos
  diag(severity: 'error' | 'warning', key: string, vars: Record<string, string | number>, at: Pos, end?: Pos) {
    this.diags.push({ severity, key, vars, message: tr(key, vars), line: at.line, col: at.col, endLine: end?.line ?? at.line, endCol: end?.col ?? at.col + 1 });
  }
  errAt(t: Tok, key: string, vars: Record<string, string | number> = {}) { this.diag('error', key, vars, t, { line: t.endLine, col: t.endCol }); }
  describe(t: Tok): string {
    if (t.t === 'nl') return tr('fin de línea');
    if (t.t === 'eof') return tr('fin del texto');
    if (t.t === 'str') return JSON.stringify(t.v).slice(0, 30);
    return `«${t.v}»`;
  }
  expected(what: string, t = this.peek()) { this.errAt(t, 'Se esperaba {expected} y se encontró {found}', { expected: what, found: this.describe(t) }); }

  // ---- tokens
  peek(k = 0): Tok { return this.toks[Math.min(this.i + k, this.toks.length - 1)]!; }
  next(): Tok { const t = this.peek(); if (t.t !== 'eof') this.i++; return t; }
  isP(v: string, k = 0) { const t = this.peek(k); return t.t === 'p' && t.v === v; }
  isKw(v: string, k = 0) { const t = this.peek(k); return t.t === 'id' && !t.quoted && t.v === v; }
  skipNl() { while (this.peek().t === 'nl') this.i++; }
  /** Salta hasta el final de la instrucción (respetando llaves y corchetes anidados). */
  recover() {
    let depth = 0;
    for (;;) {
      const t = this.peek();
      if (t.t === 'eof') return;
      if (t.t === 'p' && (t.v === '{' || t.v === '[' || t.v === '(')) depth++;
      if (t.t === 'p' && (t.v === '}' || t.v === ']' || t.v === ')')) { if (depth === 0) return; depth--; }
      if (t.t === 'nl' && depth === 0) return;
      this.i++;
    }
  }
  /** Fin de instrucción: salto de línea, `}` (sin consumir) o fin del texto. */
  endStmt() {
    const t = this.peek();
    if (t.t === 'nl') { this.i++; return; }
    if (t.t === 'eof' || (t.t === 'p' && t.v === '}')) return;
    this.expected(tr('fin de línea'));
    this.recover();
  }
  ident(what = tr('un identificador')): string | undefined {
    const t = this.peek();
    if (t.t === 'id') { this.i++; return t.v; }
    this.expected(what); return undefined;
  }
  str(): string | undefined {
    const t = this.peek();
    if (t.t === 'str') { this.i++; return t.v; }
    this.expected(tr('un texto entre comillas')); return undefined;
  }
  optStr(): string | undefined { const t = this.peek(); if (t.t === 'str') { this.i++; return t.v; } return undefined; }
  number(): number | undefined {
    const t = this.peek();
    if (t.t === 'num') { this.i++; return Number(t.v); }
    this.expected(tr('un número')); return undefined;
  }
  pair(): [number, number] | undefined {
    const a = this.number(); if (a === undefined) return undefined;
    if (this.isP(',')) this.i++;
    const b = this.number(); if (b === undefined) return undefined;
    return [a, b];
  }

  // ---- valores (JSON ampliado)
  value(): Json {
    this.skipNlIn();
    const t = this.peek();
    if (t.t === 'str') { this.i++; return t.v; }
    if (t.t === 'num') { this.i++; return Number(t.v); }
    if (t.t === 'id') {
      this.i++;
      if (!t.quoted && t.v === 'true') return true;
      if (!t.quoted && t.v === 'false') return false;
      if (!t.quoted && t.v === 'null') return null;
      return t.v;
    }
    if (t.t === 'p' && t.v === '[') {
      this.i++;
      const arr: Json[] = [];
      for (;;) {
        this.skipNlIn();
        if (this.isP(']')) { this.i++; return arr; }
        if (this.peek().t === 'eof') { this.expected('«]»'); return arr; }
        arr.push(this.value());
        this.skipNlIn();
        if (this.isP(',')) { this.i++; continue; }
        if (this.isP(']')) { this.i++; return arr; }
        this.expected(tr('«,» o «]»')); this.recoverValue(']'); return arr;
      }
    }
    if (t.t === 'p' && t.v === '{') {
      this.i++;
      const obj: Record<string, Json> = {};
      for (;;) {
        this.skipNlIn();
        if (this.isP('}')) { this.i++; return obj; }
        const k = this.peek();
        if (k.t !== 'str' && k.t !== 'id') { this.expected(tr('una clave')); this.recoverValue('}'); return obj; }
        this.i++;
        let key = k.v;
        // `{a:1}` sin espacio: el léxico lo lee como un id con dos puntos; se separa aquí.
        if (k.t === 'id' && !k.quoted && key.includes(':') && !this.isP(':')) {
          const at = key.indexOf(':');
          const rest = key.slice(at + 1); key = key.slice(0, at);
          obj[key] = rest === 'true' ? true : rest === 'false' ? false : rest === 'null' ? null : rest !== '' && Number.isFinite(Number(rest)) ? Number(rest) : rest;
        } else {
          if (!this.isP(':')) { this.expected('«:»'); this.recoverValue('}'); return obj; }
          this.i++;
          obj[key] = this.value();
        }
        this.skipNlIn();
        if (this.isP(',')) { this.i++; continue; }
        if (this.isP('}')) { this.i++; return obj; }
        if (this.peek(-1).t === 'nl' || this.toks[this.i - 1]?.t === 'nl') continue;
        this.expected(tr('«,» o «}»')); this.recoverValue('}'); return obj;
      }
    }
    this.expected(tr('un valor'));
    if (t.t !== 'nl' && t.t !== 'eof' && !(t.t === 'p' && t.v === '}')) this.i++;
    return undefined;
  }
  /** Dentro de `[ ]` y `{ }` los saltos de línea no cuentan. */
  skipNlIn() { while (this.peek().t === 'nl') this.i++; }
  recoverValue(close: string) {
    let depth = 0;
    while (this.peek().t !== 'eof') {
      const t = this.next();
      if (t.t === 'p' && (t.v === '[' || t.v === '{')) depth++;
      if (t.t === 'p' && (t.v === ']' || t.v === '}')) { if (depth === 0 && t.v === close) return; depth--; }
    }
  }
  /** ¿Empieza un valor literal (no un id suelto)? */
  isLiteralStart(k = 0) {
    const t = this.peek(k);
    return t.t === 'str' || t.t === 'num' || (t.t === 'p' && (t.v === '[' || t.v === '{')) || (t.t === 'id' && !t.quoted && (t.v === 'true' || t.v === 'false' || t.v === 'null'));
  }

  /** Bloque `{ … }`: llama a `stmt` por cada instrucción hasta la `}`. */
  block(stmt: () => void) {
    const open = this.peek();
    if (!this.isP('{')) return;
    this.i++;
    for (;;) {
      this.skipNl();
      const t = this.peek();
      if (t.t === 'eof') { this.errAt(t, 'Falta «}» para cerrar el bloque abierto en la línea {line}', { line: open.line }); return; }
      if (t.t === 'p' && t.v === '}') { this.i++; return; }
      const before = this.i;
      stmt();
      if (this.i === before) { this.errAt(this.peek(), 'Instrucción desconocida {word}', { word: this.describe(this.peek()) }); this.i++; this.recover(); }
    }
  }

  // ================================================================ Instrucciones
  file() {
    for (;;) {
      this.skipNl();
      const t = this.peek();
      if (t.t === 'eof') return;
      if (t.t === 'p' && t.v === '}') { this.errAt(t, '«}» sin bloque que cerrar'); this.i++; continue; }
      const before = this.i;
      if (this.isKw('workspace')) {
        this.i++;
        const name = this.optStr(); if (name !== undefined) this.ws.meta.name = name;
        if (this.isP('{')) this.block(() => this.workspaceStmt()); else this.endStmt();
        continue;
      }
      this.workspaceStmt();
      if (this.i === before) { this.errAt(t, 'Instrucción desconocida {word}', { word: this.describe(t) }); this.i++; this.recover(); }
    }
  }

  workspaceStmt() {
    const t = this.peek();
    if (t.t === 'id' && !t.quoted && !this.isP('=', 1) && !this.isP('->', 1)) {
      switch (t.v) {
        case 'name': this.i++; { const v = this.str(); if (v !== undefined) this.ws.meta.name = v; } this.endStmt(); return;
        case 'description': this.i++; { const v = this.str(); if (v !== undefined) this.ws.meta.description = v; } this.endStmt(); return;
        case 'current': this.i++; { const v = this.ident(); if (v !== undefined) this.ws.meta.currentViewId = v; } this.endStmt(); return;
        case 'created': this.i++; { const v = this.str(); if (v !== undefined) this.ws.meta.createdAt = v; } this.endStmt(); return;
        case 'updated': this.i++; { const v = this.str(); if (v !== undefined) this.ws.meta.updatedAt = v; } this.endStmt(); return;
        case 'model': this.i++; this.block(() => this.modelStmt(undefined)); this.endStmt(); return;
        case 'views': this.i++; this.block(() => { if (this.isKw('view')) this.viewStmt(); }); this.endStmt(); return;
        case 'view': this.viewStmt(); return;
        case 'library': this.libraryStmt(); return;
        case 'dimension': case 'person': case 'rule': case 'comment': this.recordStmt(t.v); return;
      }
    }
    this.modelStmt(undefined);
  }

  /** Elemento, relación (o, dentro de un elemento, atributo o campo). */
  modelStmt(parent: ElDraft | undefined) {
    const t0 = this.peek();
    if (t0.t !== 'id') return;
    // atributo de elemento: `doc "…"`, `tags […]`…
    if (parent && !t0.quoted && t0.v in ELEMENT_ATTRS && !this.isP('=', 1) && !this.isP('->', 1)) {
      this.i++;
      const v = this.value();
      if (v !== undefined) (parent.attrs as Record<string, unknown>)[ELEMENT_ATTRS[t0.v]!] = v;
      this.endStmt(); return;
    }
    if (this.isP('->', 1)) { this.relationStmt(undefined, t0); return; }
    if (this.isP('=', 1)) {
      this.i += 2;
      // campo: `clave = literal` (o un id suelto sin «:», que es texto)
      const t = this.peek();
      const bareWord = t.t === 'id' && !t.quoted && !t.v.includes(':') && !this.isP('->', 1);
      if (this.isLiteralStart() || bareWord) {
        if (!parent) { this.errAt(t0, 'Los campos («{key} = valor») van dentro del bloque de un elemento', { key: t0.v }); this.value(); this.endStmt(); return; }
        parent.fields[t0.v] = this.value();
        this.endStmt(); return;
      }
      if (t.t === 'id' && this.isP('->', 1)) { this.relationStmt(t0.v, t); return; }
      if (t.t === 'id') { this.i++; this.elementStmt(t0.v, t, parent, t0); return; }
      this.expected(tr('un tipo (pack:Tipo), una relación o un valor')); this.recover(); return;
    }
    if (t0.quoted || t0.v.includes(':')) { this.i++; this.elementStmt(undefined, t0, parent, t0); return; }
  }

  elementStmt(id: string | undefined, type: Tok, parent: ElDraft | undefined, start: Tok) {
    if (!type.quoted && !type.v.includes(':')) this.diag('warning', '«{type}» no parece un tipo (se esperaba pack:Tipo)', { type: type.v }, type);
    const name = this.optStr() ?? '';
    const d: ElDraft = { id, typeId: type.v, name, attrs: {}, fields: {}, parent, pos: { line: start.line, col: start.col } };
    this.els.push(d);
    if (this.isP('{')) this.block(() => this.modelStmt(d));
    this.endStmt();
  }

  relationStmt(id: string | undefined, fromTok: Tok) {
    const start = id !== undefined ? this.toks[this.i - 2]! : fromTok;
    this.i++; // from
    this.i++; // ->
    const toTok = this.peek();
    const to = this.ident(tr('el destino de la relación'));
    let typeId = 'core:link';
    if (this.isP(':')) { this.i++; const ty = this.ident(tr('un tipo de relación (pack:Tipo)')); if (ty) typeId = ty; }
    const name = this.optStr() ?? '';
    const d: RelDraft = { id, from: { ref: fromTok.v, pos: fromTok }, to: { ref: to ?? '', pos: toTok }, typeId, name, attrs: {}, fields: {}, mappings: [], pos: { line: start.line, col: start.col } };
    this.rels.push(d);
    if (this.isP('{')) this.block(() => {
      const t = this.peek();
      if (t.t !== 'id') return;
      if (!t.quoted && this.isP('=', 1) === false) {
        if (t.v in RELATION_ATTRS) { this.i++; const v = this.value(); if (v !== undefined) (d.attrs as Record<string, unknown>)[RELATION_ATTRS[t.v]!] = v; this.endStmt(); return; }
        if (t.v === 'fromPort' || t.v === 'toPort') { this.i++; const v = this.str(); if (v !== undefined) d[t.v] = v; this.endStmt(); return; }
        if (t.v === 'fromEnd' || t.v === 'toEnd') { this.i++; d[t.v] = this.value(); this.endStmt(); return; }
        if (t.v === 'map') {
          this.i++;
          const a = this.str(); if (!this.isP('->')) { this.expected('«->»'); this.recover(); return; } this.i++;
          const b = this.str(); const label = this.optStr();
          if (a !== undefined && b !== undefined) d.mappings.push({ fromPath: a, toPath: b, ...(label !== undefined ? { label } : {}) });
          this.endStmt(); return;
        }
      }
      if (this.isP('=', 1)) { this.i += 2; d.fields[t.v] = this.value(); this.endStmt(); return; }
      this.errAt(t, 'Atributo desconocido «{name}» en {where}', { name: t.v, where: tr('una relación') }); this.i++; this.recover();
    });
    this.endStmt();
  }

  libraryStmt() {
    const start = this.next();
    const id = this.ident(); if (id === undefined) { this.recover(); return; }
    const name = this.optStr() ?? '';
    const lib: Library = { id, name, description: '', elementTypes: [], relationTypes: [], portTypes: [], notations: [] };
    if (this.ws.libraries[id]) this.errAt(start, 'Id repetido «{id}»', { id });
    this.ws.libraries[id] = lib;
    this.locations[`libraries/${id}`] = { line: start.line, col: start.col };
    this.block(() => {
      const t = this.peek();
      if (t.t !== 'id' || t.quoted) return;
      if (t.v === 'description') { this.i++; const v = this.str(); if (v !== undefined) lib.description = v; this.endStmt(); return; }
      if (t.v === 'notations') { this.i++; const v = this.value(); if (Array.isArray(v)) lib.notations = v.map(String); this.endStmt(); return; }
      if (t.v === 'elementType' || t.v === 'relationType' || t.v === 'portType') {
        this.i++;
        const tid = this.ident(); if (tid === undefined) { this.recover(); return; }
        const tname = this.optStr() ?? '';
        const rec: Record<string, unknown> = { id: tid, name: tname };
        const fields: FieldDef[] = [];
        if (this.isP('{')) this.block(() => {
          const a = this.peek();
          if (a.t !== 'id') return;
          if (!a.quoted && a.v === 'field') {
            this.i++;
            const key = this.ident(tr('la clave del campo')); const label = this.str(); const kind = this.ident(tr('el tipo del campo'));
            const extra = this.isP('{') ? this.value() : undefined;
            if (key !== undefined && label !== undefined && kind !== undefined) fields.push({ key, label, kind: kind as FieldDef['kind'], ...(extra && typeof extra === 'object' ? extra as object : {}) });
            this.endStmt(); return;
          }
          this.i++;
          const v = this.value();
          if (v !== undefined) rec[a.v] = v;
          this.endStmt();
        });
        if (fields.length || t.v !== 'portType') rec.fields = [...((rec.fields as FieldDef[] | undefined) ?? []), ...fields];
        if (t.v === 'elementType') lib.elementTypes.push(rec as unknown as ElementType);
        else if (t.v === 'relationType') lib.relationTypes.push(rec as unknown as RelationType);
        else lib.portTypes.push(rec as unknown as PortType);
        this.endStmt(); return;
      }
      this.errAt(t, 'Atributo desconocido «{name}» en {where}', { name: t.v, where: tr('una librería') }); this.i++; this.recover();
    });
    this.endStmt();
  }

  /** `dimension|person|rule|comment ID ["Nombre"] { clave valor … }`: el registro tal cual. */
  recordStmt(kind: string) {
    const start = this.next();
    const id = this.ident(); if (id === undefined) { this.recover(); return; }
    const rec: Record<string, unknown> = { id };
    const name = this.optStr(); if (name !== undefined) rec.name = name;
    this.block(() => {
      const t = this.peek();
      if (t.t !== 'id') return;
      this.i++;
      const v = this.value();
      if (v !== undefined) rec[t.v] = v;
      this.endStmt();
    });
    const coll = ({ dimension: 'dimensions', person: 'people', rule: 'rules', comment: 'comments' } as const)[kind as 'dimension']!;
    if ((this.ws[coll] as Record<string, unknown>)[id]) this.errAt(start, 'Id repetido «{id}»', { id });
    (this.ws[coll] as Record<string, unknown>)[id] = rec;
    this.locations[`${coll}/${id}`] = { line: start.line, col: start.col };
    this.endStmt();
  }

  viewStmt() {
    const start = this.next();
    let id: string | undefined;
    if (this.peek().t === 'id') id = this.next().v;
    const name = this.optStr() ?? '';
    const v: ViewDraft = { id, name, attrs: {}, nodes: [], edges: [], includeAll: false, edgeAll: false, pos: { line: start.line, col: start.col } };
    this.views.push(v);
    this.block(() => this.viewBodyStmt(v, undefined));
    this.endStmt();
  }

  viewBodyStmt(v: ViewDraft, parent: NodeDraft | undefined) {
    const t = this.peek();
    if (t.t !== 'id' || t.quoted) return;
    const kw = t.v;
    if (!parent && kw in VIEW_ATTRS) { this.i++; const val = this.value(); if (val !== undefined) (v.attrs as Record<string, unknown>)[VIEW_ATTRS[kw]!] = val; this.endStmt(); return; }
    if (!parent && kw === 'root') { this.i++; const r = this.peek(); const id = this.ident(); if (id) v.root = { ref: id, pos: r }; this.endStmt(); return; }
    if (!parent && kw === 'grid') { this.i++; const val = this.value(); const g = (val && typeof val === 'object' ? val : {}) as Partial<ViewDraft['grid']>; v.grid = { layers: g?.layers ?? [], stages: g?.stages ?? [], stageGroups: g?.stageGroups ?? [] }; this.endStmt(); return; }
    if (!parent && (kw === 'layer' || kw === 'stage' || kw === 'stagegroup')) {
      this.i++;
      const id = this.ident(); const name = this.str() ?? '';
      if (id === undefined) { this.recover(); return; }
      v.grid ??= { layers: [], stages: [], stageGroups: [] };
      const rec: Record<string, unknown> = { id, name };
      for (;;) {
        if (this.isKw('color')) { this.i++; rec.color = this.str(); continue; }
        if (this.isKw('size') && kw !== 'stagegroup') { this.i++; rec.size = this.number(); continue; }
        if (this.isKw('in') && kw === 'stage') { this.i++; const g = this.peek(); this.i++; rec.groupId = g.t === 'id' && !g.quoted && g.v === 'null' ? null : g.v; continue; }
        break;
      }
      if (kw === 'layer') v.grid.layers.push(rec as Layer); else if (kw === 'stage') v.grid.stages.push(rec as Stage); else v.grid.stageGroups.push(rec as { id: string; name: string });
      this.endStmt(); return;
    }
    if (kw === 'include') {
      this.i++;
      if (this.isP('*')) { this.i++; v.includeAll = true; this.endStmt(); return; }
      const refs: Tok[] = [];
      for (;;) {
        const r = this.peek();
        if (r.t !== 'id') { this.expected(tr('el id de un elemento')); this.recover(); return; }
        this.i++; refs.push(r);
        if (this.isP(',')) { this.i++; continue; }
        break;
      }
      if (refs.length > 1) { for (const r of refs) v.nodes.push({ elementRef: { ref: r.v, pos: r }, visual: false, attrs: {}, parent, pos: r }); this.endStmt(); return; }
      const d: NodeDraft = { elementRef: { ref: refs[0]!.v, pos: refs[0]! }, visual: false, attrs: {}, parent, pos: t };
      this.nodeTail(v, d);
      return;
    }
    if (kw in VISUALS || kw === 'visual') {
      this.i++;
      let visualType = VISUALS[kw];
      if (kw === 'visual') { const ty = this.ident(tr('un tipo visual (core:note…)')); visualType = ty; }
      const text = this.optStr();
      const d: NodeDraft = { visualType, visual: true, ...(text !== undefined ? { text } : {}), attrs: {}, parent, pos: t };
      this.nodeTail(v, d);
      return;
    }
    if (kw === 'edge' && !parent) {
      this.i++;
      if (this.isP('*')) { this.i++; v.edgeAll = true; this.endStmt(); return; }
      const d: EdgeDraft = { via: [], attrs: {}, pos: t };
      const r = this.peek();
      if (r.t === 'id' && (r.quoted || !['as', 'from', 'to', 'via', 'label'].includes(r.v))) { this.i++; d.relRef = { ref: r.v, pos: r }; }
      for (;;) {
        if (this.isKw('as')) { this.i++; d.id = this.ident(); continue; }
        if (this.isKw('from')) { this.i++; const p = this.peek(); const x = this.ident(); if (x) d.from = { ref: x, pos: p }; continue; }
        if (this.isKw('to')) { this.i++; const p = this.peek(); const x = this.ident(); if (x) d.to = { ref: x, pos: p }; continue; }
        if (this.isKw('label')) { this.i++; d.label = this.str(); continue; }
        if (this.isKw('via')) { this.i++; while (this.peek().t === 'num') { const p = this.pair(); if (!p) break; d.via.push({ x: p[0], y: p[1] }); } continue; }
        break;
      }
      if (this.isP('{')) this.block(() => {
        const a = this.peek();
        if (a.t !== 'id' || a.quoted) return;
        if (a.v in EDGE_ATTRS) { this.i++; const val = this.value(); if (val !== undefined) (d.attrs as Record<string, unknown>)[EDGE_ATTRS[a.v]!] = val; this.endStmt(); return; }
        if (a.v === 'fromPort' || a.v === 'toPort') { this.i++; const s = this.str(); if (s !== undefined) d[a.v] = s; this.endStmt(); return; }
        this.errAt(a, 'Atributo desconocido «{name}» en {where}', { name: a.v, where: tr('una arista') }); this.i++; this.recover();
      });
      v.edges.push(d);
      this.endStmt(); return;
    }
    if (parent) {
      if (kw in NODE_ATTRS) { this.i++; const val = this.value(); if (val !== undefined) (parent.attrs as Record<string, unknown>)[NODE_ATTRS[kw]!] = val; this.endStmt(); return; }
      if (kw === 'detail') { this.i++; const p = this.peek(); const x = this.ident(); if (x) parent.detail = { ref: x, pos: p }; this.endStmt(); return; }
      this.errAt(t, 'Atributo desconocido «{name}» en {where}', { name: kw, where: tr('un nodo') }); this.i++; this.recover(); return;
    }
    this.errAt(t, 'Atributo desconocido «{name}» en {where}', { name: kw, where: tr('una vista') }); this.i++; this.recover();
  }

  /** `[as id] [at x, y] [size w, h] [cell capa etapa] [{ … }]` de un nodo. */
  nodeTail(v: ViewDraft, d: NodeDraft) {
    for (;;) {
      if (this.isKw('as')) { this.i++; d.id = this.ident(); continue; }
      if (this.isKw('at')) { this.i++; d.at = this.pair(); continue; }
      if (this.isKw('size')) { this.i++; d.size = this.pair(); continue; }
      if (this.isKw('cell')) { this.i++; const l = this.ident(); const s = this.ident(); if (l !== undefined && s !== undefined) d.cell = { layerId: l, stageId: s }; continue; }
      break;
    }
    v.nodes.push(d);
    if (this.isP('{')) this.block(() => this.viewBodyStmt(v, d));
    this.endStmt();
  }

  // ================================================================ Fase 2: ids, referencias y registros
  build(): DslParseResult {
    const ws = this.ws;
    const warn = (key: string, vars: Record<string, string | number>, at: Pos) => this.diag('warning', key, vars, at);
    const error = (key: string, vars: Record<string, string | number>, at: Pos) => this.diag('error', key, vars, at);
    const loc = (k: string, p: Pos) => { this.locations[k] = { line: p.line, col: p.col }; };

    // ---- elementos
    const elIds = new Set<string>();
    for (const d of this.els) if (d.id !== undefined) { if (elIds.has(d.id)) error('Id repetido «{id}»', { id: d.id }, d.pos); elIds.add(d.id); }
    const uniq = (set: Set<string>, base: string) => { let id = base, n = 2; while (set.has(id)) id = `${base}_${n++}`; set.add(id); return id; };
    for (const d of this.els) if (d.id === undefined) d.id = uniq(elIds, slugId(d.name) || slugId(d.typeId.split(':').pop() ?? '') || 'el');
    for (const d of this.els) {
      const el: Element = { id: d.id!, typeId: d.typeId, name: d.name, doc: '', fields: d.fields, ports: [], profiles: [], props: {}, features: {}, tags: [] };
      Object.assign(el, d.attrs);
      el.fields = d.fields;
      if (d.parent) el.features = { ...el.features, parentId: d.parent.id };
      ws.elements[el.id] = el;
      loc(`elements/${el.id}`, d.pos);
    }

    // ---- relaciones
    const relIds = new Set<string>();
    for (const d of this.rels) if (d.id !== undefined) { if (relIds.has(d.id)) error('Id repetido «{id}»', { id: d.id }, d.pos); relIds.add(d.id); }
    for (const d of this.rels) if (d.id === undefined) d.id = uniq(relIds, `rel_${slugId(d.from.ref)}_${slugId(d.to.ref)}`);
    const endOf = (r: { ref: string; pos: Pos }, raw: Json | undefined): Relation['from'] => {
      if (raw && typeof raw === 'object') return raw as Relation['from'];
      if (r.ref === '_') return {};
      if (ws.elements[r.ref]) return { elementId: r.ref };
      if (relIds.has(r.ref)) return { relationId: r.ref };
      warn('«{ref}» no es un elemento ni una relación', { ref: r.ref }, r.pos);
      return { elementId: r.ref };
    };
    for (const d of this.rels) {
      const from = endOf(d.from, d.fromEnd), to = endOf(d.to, d.toEnd);
      if (d.fromPort !== undefined) from.portId = d.fromPort;
      if (d.toPort !== undefined) to.portId = d.toPort;
      const rel: Relation = { id: d.id!, typeId: d.typeId, name: d.name, doc: '', from, to, mappings: [], fields: d.fields, props: {}, features: {} };
      Object.assign(rel, d.attrs);
      if (d.mappings.length) rel.mappings = [...(rel.mappings ?? []), ...d.mappings];
      ws.relations[rel.id] = rel;
      loc(`relations/${rel.id}`, d.pos);
    }

    // ---- vistas
    const viewIds = new Set<string>();
    for (const v of this.views) if (v.id !== undefined) { if (viewIds.has(v.id)) error('Id repetido «{id}»', { id: v.id }, v.pos); viewIds.add(v.id); }
    for (const v of this.views) if (v.id === undefined) v.id = uniq(viewIds, `view_${slugId(v.name) || viewIds.size + 1}`);
    const nodeIds = new Set<string>(), edgeIds = new Set<string>();
    for (const v of this.views) {
      for (const n of v.nodes) if (n.id !== undefined) { if (nodeIds.has(n.id)) error('Id repetido «{id}»', { id: n.id }, n.pos); nodeIds.add(n.id); }
      for (const e of v.edges) if (e.id !== undefined) { if (edgeIds.has(e.id)) error('Id repetido «{id}»', { id: e.id }, e.pos); edgeIds.add(e.id); }
    }
    const unpositioned: string[] = [];
    for (const v of this.views) {
      const viewId = v.id!;
      const view: View = { id: viewId, kind: 'freeform', notationId: 'freeform', name: v.name, doc: '', style: {}, props: {} };
      Object.assign(view, v.attrs);
      if (v.root) { view.rootElementId = v.root.ref; if (!ws.elements[v.root.ref]) warn('El elemento «{id}» no existe', { id: v.root.ref }, v.root.pos); }
      if (v.grid) view.grid = v.grid;
      ws.views[viewId] = view;
      loc(`views/${viewId}`, v.pos);

      // include *: todos los elementos (no plantillas) que no estén ya
      if (v.includeAll) {
        const already = new Set(v.nodes.filter(n => n.elementRef).map(n => n.elementRef!.ref));
        for (const el of Object.values(ws.elements)) if (!el.template && !already.has(el.id)) v.nodes.push({ elementRef: { ref: el.id, pos: v.pos }, visual: false, attrs: {}, pos: v.pos });
      }
      // ids de nodo: los explícitos ya están; los automáticos, `<vista>.<elemento>` (o `<vista>.n<k>` para los visuales)
      let k = 1;
      for (const n of v.nodes) if (n.id === undefined) n.id = uniq(nodeIds, n.elementRef ? `${viewId}.${n.elementRef.ref}` : `${viewId}.n${k++}`);
      const byNodeId = new Map(v.nodes.map(n => [n.id!, n]));
      for (const n of v.nodes) {
        if (n.elementRef && !ws.elements[n.elementRef.ref]) warn('El elemento «{id}» no existe', { id: n.elementRef.ref }, n.elementRef.pos);
        const vn: ViewNode = { id: n.id!, viewId, x: n.at?.[0] ?? 0, y: n.at?.[1] ?? 0, w: n.size?.[0] ?? 160, h: n.size?.[1] ?? (n.visual ? 40 : 56), style: {} };
        if (n.elementRef) vn.elementId = n.elementRef.ref;
        if (n.visualType !== undefined) vn.visualType = n.visualType;
        if (n.text !== undefined) vn.text = n.text;
        if (n.parent) vn.parentNodeId = n.parent.id;
        if (n.cell) vn.cell = n.cell;
        Object.assign(vn, n.attrs);
        if (n.detail) vn.detailViewId = n.detail.ref;
        n.final = vn;
        ws.nodes[vn.id] = vn;
        loc(`nodes/${vn.id}`, n.pos);
      }
      // nodo de un elemento en esta vista (el primero, en orden de escritura)
      const nodeOfEl = (elId: string) => v.nodes.find(n => n.elementRef?.ref === elId)?.id;
      const nodeRef = (r: { ref: string; pos: Pos }) => {
        if (byNodeId.has(r.ref)) return r.ref;
        const viaEl = nodeOfEl(r.ref);
        if (viaEl) return viaEl;
        error('El nodo «{id}» no existe en la vista «{view}»', { id: r.ref, view: viewId }, r.pos);
        return undefined;
      };
      const drawn = new Set<string>();
      let ek = 1;
      for (const e of v.edges) {
        const rel = e.relRef ? ws.relations[e.relRef.ref] : undefined;
        if (e.relRef && !rel) error('La relación «{id}» no existe', { id: e.relRef.ref }, e.relRef.pos);
        const from = e.from ? nodeRef(e.from) : rel?.from.elementId ? nodeOfEl(rel.from.elementId) : undefined;
        const to = e.to ? nodeRef(e.to) : rel?.to.elementId ? nodeOfEl(rel.to.elementId) : undefined;
        if (!from || !to) { if (rel && !e.from && !e.to) error('La relación «{id}» no tiene nodos en la vista «{view}»: indica from y to', { id: rel.id, view: viewId }, e.pos); continue; }
        const id = e.id ?? uniq(edgeIds, rel ? `${viewId}.${rel.id}` : `${viewId}.e${ek++}`);
        const ve: ViewEdge = { id, viewId, fromNodeId: from, toNodeId: to, bendpoints: e.via, style: {} };
        if (e.relRef) ve.relationId = e.relRef.ref;
        if (e.label !== undefined) ve.label = e.label;
        if (e.fromPort !== undefined) ve.fromPortId = e.fromPort;
        if (e.toPort !== undefined) ve.toPortId = e.toPort;
        Object.assign(ve, e.attrs);
        ws.edges[id] = ve;
        if (rel) drawn.add(rel.id);
        loc(`edges/${id}`, e.pos);
      }
      // include * / edge *: cada relación entre elementos presentes (una vez)
      if (v.includeAll || v.edgeAll) {
        for (const rel of Object.values(ws.relations)) {
          if (drawn.has(rel.id) || !rel.from.elementId || !rel.to.elementId) continue;
          const from = nodeOfEl(rel.from.elementId), to = nodeOfEl(rel.to.elementId);
          if (!from || !to) continue;
          const id = uniq(edgeIds, `${viewId}.${rel.id}`);
          ws.edges[id] = { id, viewId, relationId: rel.id, fromNodeId: from, toNodeId: to, bendpoints: [], style: {} };
        }
      }
      for (const n of v.nodes) if (n.detail && !viewIds.has(n.detail.ref)) warn('La vista «{id}» no existe', { id: n.detail.ref }, n.detail.pos);
      // Sin posiciones: rejilla provisional (la aplicación aplica después el layout automático).
      const placed = v.nodes.filter(n => n.at);
      if (v.nodes.length && !placed.length) unpositioned.push(viewId);
      provisionalLayout(v.nodes.filter(n => !n.at).map(n => n.final!), Object.values(ws.nodes).filter(n => n.viewId === viewId));
    }
    if (ws.meta.currentViewId && !ws.views[ws.meta.currentViewId]) warn('La vista «{id}» no existe', { id: ws.meta.currentViewId }, { line: 1, col: 1 });
    for (const [id, lib] of Object.entries(ws.libraries)) if (lib.id !== id) lib.id = id;

    let workspace: Workspace = ws;
    ws.meta.schemaVersion = SCHEMA_VERSION;
    try { workspace = parseWorkspace(ws); }
    catch (e) {
      const issue = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues?.[0];
      const where = issue ? issue.path.join('.') : '';
      const at = issue && typeof issue.path[1] === 'string' ? this.locations[`${issue.path[0]}/${issue.path[1]}`] : undefined;
      error('El espacio no es válido ({where}): {detail}', { where, detail: issue?.message ?? (e as Error).message }, at ?? { line: 1, col: 1 });
    }
    return { workspace, diagnostics: this.diags, unpositioned, locations: this.locations };
  }
}

/** Coloca en rejilla los nodos sin `at`: los de primer nivel en filas de 4, bajo los colocados; los hijos dentro de su padre (que crece). */
function provisionalLayout(loose: ViewNode[], all: ViewNode[]) {
  if (!loose.length) return;
  const set = new Set(loose.map(n => n.id));
  const byId = new Map(all.map(n => [n.id, n]));
  const kidsOf = (id: string) => loose.filter(n => n.parentNodeId === id);
  const place = (list: ViewNode[], x0: number, y0: number): { w: number; h: number } => {
    let x = x0, y = y0, rowH = 0, maxW = 0;
    list.forEach((n, i) => {
      if (i && i % 4 === 0) { x = x0; y += rowH + 40; rowH = 0; }
      const inner = kidsOf(n.id);
      if (inner.length) { const s = place(inner, 20, 40); n.w = Math.max(n.w, s.w + 20); n.h = Math.max(n.h, s.h + 20); }
      n.x = x; n.y = y;
      x += n.w + 60; rowH = Math.max(rowH, n.h); maxW = Math.max(maxW, x - 60);
    });
    return { w: maxW, h: y + rowH };
  };
  const groups = new Map<string, ViewNode[]>();
  for (const n of loose) {
    const p = n.parentNodeId && byId.has(n.parentNodeId) ? n.parentNodeId : '';
    if (p && set.has(p)) continue;                     // lo coloca su padre (también suelto)
    const l = groups.get(p) ?? []; l.push(n); groups.set(p, l);
  }
  const offsetY = all.filter(n => !set.has(n.id) && !n.parentNodeId).reduce((m, n) => Math.max(m, n.y + n.h + 60), 40);
  for (const [p, list] of groups) {
    if (!p) { place(list, 40, offsetY); continue; }
    const parent = byId.get(p)!;
    const s = place(list, 20, 40);
    parent.w = Math.max(parent.w, s.w + 20); parent.h = Math.max(parent.h, s.h + 20);
  }
}

/** Lee el texto del lenguaje. No lanza: los problemas van en `diagnostics`. */
export function parseDsl(text: string): DslParseResult {
  const p = new Parser(text);
  p.file();
  return p.build();
}

/** ¿Parece texto de este lenguaje? Cabecera `// all-draw`, o `workspace`/`model`/`view` con tipos `pack:Tipo`. */
export function isDsl(text: string): boolean {
  const t = text.replace(/^\uFEFF/, '');
  if (/^\s*\/\/\s*all-draw\b/i.test(t)) return true;
  const first = t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '').trim()).find(Boolean) ?? '';
  if (!/^(workspace\b|model\s*\{|views?\b|library\b)/.test(first)) return false;
  return /(^|\n)\s*[\w$.`-]+\s*=\s*`?[A-Za-z_][\w.-]*:[A-Za-z]/.test(t) || /(^|\n)\s*include\s+/.test(t);
}

// ================================================================ Serializador
const BARE = /^[A-Za-z_$][\w$.-]*(?::[\w$.-]+)*$/;
/** Id en el texto: suelto si se puede, si no entre acentos graves. */
export function dslId(s: string): string {
  if (BARE.test(s) && !s.endsWith('-') && !s.includes('->') && !RESERVED.has(s) && !/[.:-]$/.test(s) && !/:-/.test(s)) return s;
  return `\`${s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
}
const q = (s: string) => JSON.stringify(s);
/** Nombre en una posición sin ambigüedad (clave de campo o atributo, valor como `notation archimate`): sin la lista de reservadas. */
export function dslName(s: string): string {
  if (BARE.test(s) && !/[.:-]$/.test(s) && !/:-/.test(s) && s !== 'true' && s !== 'false' && s !== 'null') return s;
  return `\`${s.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
}
/** Tipo de elemento: entre acentos graves si no lleva «:» (si no, `x = tipo` se leería como un campo de texto). */
const typeOut = (t: string) => (t.includes(':') ? dslName(t) : `\`${t.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``);
const num = (n: number) => JSON.stringify(n);

/** Valor JSON: en una línea si es corto; si no, con sangría. */
function val(v: unknown, indent: string): string {
  const one = JSON.stringify(v);
  if (one === undefined) return 'null';
  if (one.length <= 100 || typeof v !== 'object' || v === null) return one;
  return JSON.stringify(v, null, 2).split('\n').map((l, i) => (i ? indent + l : l)).join('\n');
}
const isEmpty = (v: unknown) => v === undefined || v === '' || (Array.isArray(v) && !v.length) || (v !== null && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length);

/** Escribe el espacio en el lenguaje (determinista; conserva ids). */
export function serializeDsl(ws: Workspace, opts: DslSerializeOptions = {}): string {
  const IND = opts.indent ?? '  ';
  const positions = opts.positions !== false;
  const out: string[] = [];
  const line = (depth: number, s: string) => out.push(IND.repeat(depth) + s);
  const attr = (depth: number, key: string, v: unknown) => { if (!isEmpty(v)) line(depth, `${key} ${val(v, IND.repeat(depth))}`); };

  if (opts.header !== false) out.push(DSL_HEADER);
  line(0, `workspace ${q(ws.meta.name ?? '')} {`);
  attr(1, 'description', ws.meta.description);
  if (ws.meta.createdAt) attr(1, 'created', ws.meta.createdAt);
  if (ws.meta.updatedAt) attr(1, 'updated', ws.meta.updatedAt);
  if (ws.meta.currentViewId) line(1, `current ${dslId(ws.meta.currentViewId)}`);

  // ---- librerías
  for (const lib of Object.values(ws.libraries)) {
    out.push('');
    line(1, `library ${dslId(lib.id)} ${q(lib.name)} {`);
    attr(2, 'description', lib.description);
    attr(2, 'notations', lib.notations);
    const typeBlock = (kw: string, t: Record<string, unknown> & { id: string; name: string; fields?: FieldDef[] }) => {
      const rest = Object.entries(t).filter(([k, v]) => k !== 'id' && k !== 'name' && k !== 'fields' && v !== undefined);
      const fields = t.fields ?? [];
      if (!rest.length && !fields.length && kw !== 'portType') { line(2, `${kw} ${dslId(t.id)} ${q(t.name)}`); return; }
      if (!rest.length && !fields.length) { line(2, `${kw} ${dslId(t.id)} ${q(t.name)}`); return; }
      line(2, `${kw} ${dslId(t.id)} ${q(t.name)} {`);
      for (const [k, v] of rest) line(3, `${dslName(k)} ${val(v, IND.repeat(3))}`);
      for (const f of fields) {
        const { key, label, kind, ...extra } = f;
        line(3, `field ${dslName(key)} ${q(label)} ${kind}${Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''}`);
      }
      line(2, '}');
    };
    for (const t of lib.elementTypes) typeBlock('elementType', t as never);
    for (const t of lib.relationTypes) typeBlock('relationType', t as never);
    for (const t of lib.portTypes) typeBlock('portType', t as never);
    line(1, '}');
  }

  // ---- modelo (anidado por features.parentId cuando el padre existe y no hay ciclos)
  const els = Object.values(ws.elements);
  const parentOf = (e: Element) => { const p = e.features?.parentId; return typeof p === 'string' && p !== e.id && ws.elements[p] ? p : undefined; };
  const nests = (e: Element) => { const seen = new Set<string>([e.id]); let p = parentOf(e); while (p) { if (seen.has(p)) return false; seen.add(p); p = parentOf(ws.elements[p]!); } return !!parentOf(e); };
  const childrenOf = new Map<string, Element[]>();
  for (const e of els) if (nests(e)) { const p = parentOf(e)!; const l = childrenOf.get(p) ?? []; l.push(e); childrenOf.set(p, l); }
  const writeEl = (e: Element, depth: number) => {
    const head = `${dslId(e.id)} = ${typeOut(e.typeId)}${e.name !== '' ? ` ${q(e.name)}` : ''}`;
    const body: (() => void)[] = [];
    const features = { ...e.features };
    if (nests(e)) delete features.parentId;
    const attrs: [string, unknown][] = [['doc', e.doc], ['tags', e.tags], ['props', e.props], ['features', features], ['ports', e.ports], ['profiles', e.profiles], ['library', e.libraryId], ['template', e.template], ['templateId', e.templateId]];
    for (const [k, v] of attrs) if (!isEmpty(v) && v !== false || (k === 'template' && v === false)) body.push(() => line(depth + 1, `${k} ${k === 'library' || k === 'templateId' ? dslName(String(v)) : val(v, IND.repeat(depth + 1))}`));
    for (const [k, v] of Object.entries(e.fields ?? {})) if (v !== undefined) body.push(() => line(depth + 1, `${dslName(k)} = ${val(v, IND.repeat(depth + 1))}`));
    const kids = childrenOf.get(e.id) ?? [];
    if (!body.length && !kids.length) { line(depth, head); return; }
    line(depth, `${head} {`);
    for (const b of body) b();
    for (const k of kids) writeEl(k, depth + 1);
    line(depth, '}');
  };
  const rels = Object.values(ws.relations);
  if (els.length || rels.length) {
    out.push('');
    line(1, 'model {');
    for (const e of els) if (!nests(e)) writeEl(e, 2);
    for (const r of rels) {
      const relIds = new Set(rels.map(x => x.id));
      const endRef = (end: Relation['from']): { ref: string; raw?: unknown; port?: string } => {
        const keys = Object.keys(end).filter(k => (end as Record<string, unknown>)[k] !== undefined);
        if (end.elementId !== undefined && !end.relationId && keys.every(k => k === 'elementId' || k === 'portId') && (ws.elements[end.elementId] || !relIds.has(end.elementId))) return { ref: end.elementId, port: end.portId };
        if (end.relationId !== undefined && !end.elementId && keys.every(k => k === 'relationId' || k === 'portId') && !ws.elements[end.relationId]) return { ref: end.relationId, port: end.portId };
        return { ref: '_', raw: end };
      };
      const a = endRef(r.from), b = endRef(r.to);
      const head = `${dslId(r.id)} = ${a.ref === '_' ? '_' : dslId(a.ref)} -> ${b.ref === '_' ? '_' : dslId(b.ref)} : ${dslId(r.typeId)}${r.name !== '' ? ` ${q(r.name)}` : ''}`;
      const body: string[] = [];
      if (a.raw) body.push(`fromEnd ${JSON.stringify(a.raw)}`); else if (a.port !== undefined) body.push(`fromPort ${q(a.port)}`);
      if (b.raw) body.push(`toEnd ${JSON.stringify(b.raw)}`); else if (b.port !== undefined) body.push(`toPort ${q(b.port)}`);
      if (!isEmpty(r.doc)) body.push(`doc ${q(r.doc)}`);
      if (!isEmpty(r.props)) body.push(`props ${val(r.props, IND.repeat(3))}`);
      if (!isEmpty(r.features)) body.push(`features ${val(r.features, IND.repeat(3))}`);
      for (const m of r.mappings ?? []) body.push(`map ${q(m.fromPath)} -> ${q(m.toPath)}${m.label !== undefined ? ` ${q(m.label)}` : ''}`);
      for (const [k, v] of Object.entries(r.fields ?? {})) if (v !== undefined) body.push(`${dslName(k)} = ${val(v, IND.repeat(3))}`);
      if (!body.length) line(2, head);
      else { line(2, `${head} {`); for (const b2 of body) line(3, b2); line(2, '}'); }
    }
    line(1, '}');
  }

  // ---- vistas
  const views = Object.values(ws.views);
  if (views.length) {
    out.push('');
    line(1, 'views {');
    for (const v of views) {
      line(2, `view ${dslId(v.id)} ${q(v.name)} {`);
      if (v.kind !== 'freeform') line(3, `kind ${v.kind}`);
      if (v.notationId !== 'freeform') line(3, `notation ${dslName(v.notationId)}`);
      if (v.viewpointId !== undefined) line(3, `viewpoint ${dslName(v.viewpointId)}`);
      if (v.rootElementId !== undefined) line(3, `root ${dslId(v.rootElementId)}`);
      attr(3, 'doc', v.doc);
      if (v.public !== undefined) line(3, `public ${v.public}`);
      attr(3, 'style', v.style);
      attr(3, 'props', v.props);
      if (v.grid) {
        const g = v.grid;
        if (!g.layers.length && !g.stages.length && !g.stageGroups.length) line(3, 'grid {}');
        const extra = (o: Record<string, unknown>, known: string[]) => Object.keys(o).filter(k => !known.includes(k) && o[k] !== undefined);
        if (g.layers.some(l => extra(l, ['id', 'name', 'color', 'size']).length) || g.stages.some(s => extra(s, ['id', 'name', 'size', 'groupId']).length) || g.stageGroups.some(s => extra(s, ['id', 'name', 'color']).length)) line(3, `grid ${JSON.stringify(g)}`);
        else {
          for (const gr of g.stageGroups) line(3, `stagegroup ${dslId(gr.id)} ${q(gr.name)}${gr.color !== undefined ? ` color ${q(gr.color)}` : ''}`);
          for (const l of g.layers) line(3, `layer ${dslId(l.id)} ${q(l.name)}${l.color !== undefined ? ` color ${q(l.color)}` : ''}${l.size !== undefined ? ` size ${num(l.size)}` : ''}`);
          for (const s of g.stages) line(3, `stage ${dslId(s.id)} ${q(s.name)}${s.size !== undefined ? ` size ${num(s.size)}` : ''}${s.groupId !== undefined ? ` in ${s.groupId === null ? 'null' : dslId(s.groupId)}` : ''}`);
        }
      }
      // nodos (anidados por parentNodeId)
      const nodes = Object.values(ws.nodes).filter(n => n.viewId === v.id);
      const inView = new Set(nodes.map(n => n.id));
      const nodeParent = (n: ViewNode) => (n.parentNodeId && n.parentNodeId !== n.id && inView.has(n.parentNodeId) ? n.parentNodeId : undefined);
      const nestsNode = (n: ViewNode) => { const seen = new Set([n.id]); let p = nodeParent(n); while (p) { if (seen.has(p)) return false; seen.add(p); p = nodeParent(ws.nodes[p]!); } return !!nodeParent(n); };
      const kidsOf = new Map<string, ViewNode[]>();
      for (const n of nodes) if (nestsNode(n)) { const l = kidsOf.get(n.parentNodeId!) ?? []; l.push(n); kidsOf.set(n.parentNodeId!, l); }
      const firstNodeOfEl = new Map<string, string>();
      const order: ViewNode[] = [];
      const walk = (n: ViewNode) => { order.push(n); for (const k of kidsOf.get(n.id) ?? []) walk(k); };
      for (const n of nodes) if (!nestsNode(n)) walk(n);
      for (const n of order) if (n.elementId && !firstNodeOfEl.has(n.elementId)) firstNodeOfEl.set(n.elementId, n.id);
      const writeNode = (n: ViewNode, depth: number) => {
        let head: string;
        const visualKw = n.elementId === undefined ? (n.visualType === undefined ? 'node' : Object.entries(VISUALS).find(([, t]) => t === n.visualType)?.[0]) : undefined;
        if (n.elementId !== undefined) head = `include ${dslId(n.elementId)}`;
        else head = `${visualKw ?? `visual ${dslId(n.visualType!)}`}${n.text !== undefined ? ` ${q(n.text)}` : ''}`;
        const auto = n.elementId !== undefined ? `${v.id}.${n.elementId}` : undefined;
        if (n.id !== auto) head += ` as ${dslId(n.id)}`;
        if (positions) head += ` at ${num(n.x)}, ${num(n.y)} size ${num(n.w)}, ${num(n.h)}`;
        if (n.cell) head += ` cell ${dslId(n.cell.layerId)} ${dslId(n.cell.stageId)}`;
        const body: string[] = [];
        if (n.elementId !== undefined && n.visualType !== undefined) body.push(`visualType ${q(n.visualType)}`);
        if (n.elementId !== undefined && n.text !== undefined) body.push(`text ${q(n.text)}`);
        if (!isEmpty(n.style)) body.push(`style ${val(n.style, IND.repeat(depth + 1))}`);
        if (n.z !== undefined) body.push(`z ${num(n.z)}`);
        if (n.detailViewId !== undefined) body.push(`detail ${dslId(n.detailViewId)}`);
        if (n.note !== undefined) body.push(`instanceNote ${q(n.note)}`);
        if (n.meta !== undefined) body.push(`meta ${val(n.meta, IND.repeat(depth + 1))}`);
        const kids = kidsOf.get(n.id) ?? [];
        if (!body.length && !kids.length) { line(depth, head); return; }
        line(depth, `${head} {`);
        for (const b of body) line(depth + 1, b);
        for (const k of kids) writeNode(k, depth + 1);
        line(depth, '}');
      };
      for (const n of nodes) if (!nestsNode(n)) writeNode(n, 3);
      // aristas
      for (const e of Object.values(ws.edges)) {
        if (e.viewId !== v.id) continue;
        const rel = e.relationId ? ws.relations[e.relationId] : undefined;
        let head = `edge${e.relationId !== undefined ? ` ${dslId(e.relationId)}` : ''}`;
        const auto = e.relationId !== undefined ? `${v.id}.${e.relationId}` : undefined;
        if (e.id !== auto) head += ` as ${dslId(e.id)}`;
        const autoFrom = rel?.from.elementId ? firstNodeOfEl.get(rel.from.elementId) : undefined;
        const autoTo = rel?.to.elementId ? firstNodeOfEl.get(rel.to.elementId) : undefined;
        if (e.fromNodeId !== autoFrom) head += ` from ${dslId(e.fromNodeId)}`;
        if (e.toNodeId !== autoTo) head += ` to ${dslId(e.toNodeId)}`;
        if (positions && e.bendpoints.length) head += ` via ${e.bendpoints.map(p => `${num(p.x)}, ${num(p.y)}`).join('  ')}`;
        if (e.label !== undefined) head += ` label ${q(e.label)}`;
        const body: string[] = [];
        if (e.fromPortId !== undefined) body.push(`fromPort ${q(e.fromPortId)}`);
        if (e.toPortId !== undefined) body.push(`toPort ${q(e.toPortId)}`);
        if (!isEmpty(e.style)) body.push(`style ${val(e.style, IND.repeat(4))}`);
        if (!body.length) line(3, head);
        else { line(3, `${head} {`); for (const b of body) line(4, b); line(3, '}'); }
      }
      line(2, '}');
    }
    line(1, '}');
  }

  // ---- otros registros (tal cual)
  const records: [string, Record<string, Record<string, unknown>>][] = [['dimension', ws.dimensions as never], ['person', ws.people as never], ['rule', ws.rules as never], ['comment', ws.comments as never]];
  for (const [kw, coll] of records) {
    const list = Object.values(coll);
    if (!list.length) continue;
    out.push('');
    for (const r of list) {
      const rest = Object.entries(r).filter(([k, v]) => k !== 'id' && k !== 'name' && v !== undefined);
      const head = `${kw} ${dslId(String(r.id))}${typeof r.name === 'string' ? ` ${q(r.name)}` : ''}`;
      if (!rest.length) { line(1, head); continue; }
      line(1, `${head} {`);
      for (const [k, v] of rest) line(2, `${dslName(k)} ${val(v, IND.repeat(2))}`);
      line(1, '}');
    }
  }
  line(0, '}');
  return `${out.join('\n')}\n`;
}

/** Exportación a `.alldraw.txt` (mismo contrato que los demás exportadores de texto). */
export function exportDsl(ws: Workspace, opts: DslSerializeOptions = {}): { text: string; warnings: string[] } {
  return { text: serializeDsl(ws, opts), warnings: [] };
}
