/**
 * Evaluador de expresiones **seguro** para condiciones de flujos BPMN, guardas y acciones de máquinas de estados.
 * Sin `eval` ni `Function`: un analizador de descenso recursivo construye un árbol y un intérprete lo recorre sobre
 * un objeto de variables. Solo lee propiedades propias de objetos planos y arrays (nada de `__proto__`,
 * `constructor` ni `prototype`) y solo llama a las funciones de la lista blanca `FUNCTIONS`.
 *
 * Sintaxis (subconjunto de JavaScript, con alias en palabras):
 *  - literales: `12`, `3.5`, `1e3`, `'texto'`, `"texto"`, `true`, `false`, `null`, `[1, 2]`
 *  - variables y miembros: `importe`, `cliente.pais`, `items[0]`, `cliente['tipo']`, `items.length`
 *  - aritmética `+ - * / %`, comparación `< <= > >= == != === !==`, lógica `&& || !` (y `and`, `or`, `not`),
 *    `??`, `in` (`'a' in lista`, `'clave' in objeto`), ternario `c ? a : b`, paréntesis
 *  - funciones: `len(x)`, `min(..)`, `max(..)`, `abs(x)`, `round(x, d?)`, `floor`, `ceil`, `lower`, `upper`, `trim`,
 *    `contains(a, b)`, `startsWith(a, b)`, `endsWith(a, b)`, `number(x)`, `string(x)`, `bool(x)`, `isEmpty(x)`
 *  - envoltorios de Camunda/JUEL: `${importe > 100}` y `#{...}` se aceptan tal cual.
 *
 * `==`/`!=` comparan números con cadenas numéricas como números (`'5' == 5`) y el resto por identidad; `===` es estricta.
 * Las acciones admiten además asignaciones: `x = expr`, `x += expr` (`-=`, `*=`, `/=`), `x++`, `x--` y `raise(EVENTO)`.
 */

export class ExprError extends Error {
  readonly pos: number;
  constructor(message: string, pos = -1) { super(message); this.name = 'ExprError'; this.pos = pos; }
}

export type Expr =
  | { t: 'lit'; v: unknown }
  | { t: 'id'; name: string }
  | { t: 'arr'; items: Expr[] }
  | { t: 'mem'; obj: Expr; key: Expr }
  | { t: 'call'; fn: string; args: Expr[] }
  | { t: 'un'; op: string; a: Expr }
  | { t: 'bin'; op: string; a: Expr; b: Expr }
  | { t: 'cond'; c: Expr; a: Expr; b: Expr };

export type Vars = Record<string, unknown>;

/** Longitud máxima del texto y profundidad máxima del árbol (evita desbordar la pila con entradas hostiles). */
export const MAX_EXPR_LENGTH = 4000;
const MAX_DEPTH = 100;
const BLOCKED = new Set(['__proto__', 'prototype', 'constructor', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);

// ---------------------------------------------------------------- léxico
type Tok = { k: 'num'; v: number; p: number } | { k: 'str'; v: string; p: number } | { k: 'id'; v: string; p: number } | { k: 'op'; v: string; p: number } | { k: 'end'; p: number };

const OPS = ['===', '!==', '...', '==', '!=', '<=', '>=', '&&', '||', '??', '+=', '-=', '*=', '/=', '++', '--', '<', '>', '+', '-', '*', '/', '%', '!', '(', ')', '[', ']', ',', '.', '?', ':', '='];
const ID_START = /[\p{L}_$]/u;
const ID_PART = /[\p{L}\p{N}_$]/u;

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ k: 'num', v: Number(m[0]), p: i }); i += m[0].length; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '';
      for (;;) {
        if (j >= src.length) throw new ExprError('Cadena sin cerrar', i);
        const d = src[j]!;
        if (d === c) break;
        if (d === '\\') {
          const e = src[j + 1] ?? '';
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
          j += 2; continue;
        }
        s += d; j++;
      }
      out.push({ k: 'str', v: s, p: i }); i = j + 1; continue;
    }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < src.length && ID_PART.test(src[j]!)) j++;
      out.push({ k: 'id', v: src.slice(i, j), p: i }); i = j; continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (!op) throw new ExprError(`Carácter inesperado «${c}»`, i);
    out.push({ k: 'op', v: op, p: i }); i += op.length;
  }
  out.push({ k: 'end', p: src.length });
  return out;
}

// ---------------------------------------------------------------- sintaxis
const WORD_OPS: Record<string, string> = { and: '&&', or: '||', not: '!', y: '&&', o: '||', no: '!' };
const BIN_PREC: Record<string, number> = {
  '??': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '===': 4, '!==': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, in: 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7,
};

class Parser {
  private i = 0;
  private depth = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }
  peek(): Tok { return this.toks[this.i]!; }
  next(): Tok { return this.toks[this.i++]!; }
  isOp(v: string): boolean { const t = this.peek(); return t.k === 'op' && t.v === v; }
  expect(v: string): void { const t = this.next(); if (t.k !== 'op' || t.v !== v) throw new ExprError(`Se esperaba «${v}»`, t.p); }
  /** Operador binario en la posición actual (símbolo o palabra `and`/`or`/`in`). */
  binOp(): string | null {
    const t = this.peek();
    if (t.k === 'op' && t.v in BIN_PREC) return t.v;
    if (t.k === 'id') { const w = WORD_OPS[t.v.toLowerCase()]; if (w && w !== '!') return w; if (t.v === 'in') return 'in'; }
    return null;
  }
  parse(): Expr {
    const e = this.ternary();
    const t = this.peek();
    if (t.k !== 'end') throw new ExprError(t.k === 'op' && t.v === '=' ? 'Usa «==» para comparar (una asignación solo vale en acciones)' : 'Sobra texto al final de la expresión', t.p);
    return e;
  }
  ternary(): Expr {
    if (++this.depth > MAX_DEPTH) throw new ExprError('Expresión demasiado anidada', this.peek().p);
    try {
      const c = this.binary(0);
      if (this.isOp('?')) {
        this.next();
        const a = this.ternary();
        this.expect(':');
        const b = this.ternary();
        return { t: 'cond', c, a, b };
      }
      return c;
    } finally { this.depth--; }
  }
  binary(minPrec: number): Expr {
    let left = this.unary();
    for (;;) {
      const op = this.binOp();
      if (!op) return left;
      const prec = BIN_PREC[op]!;
      if (prec <= minPrec) return left;
      this.next();
      left = { t: 'bin', op, a: left, b: this.binary(prec) };
    }
  }
  unary(): Expr {
    const t = this.peek();
    const word = t.k === 'id' ? WORD_OPS[t.v.toLowerCase()] : undefined;
    if ((t.k === 'op' && (t.v === '!' || t.v === '-' || t.v === '+')) || word === '!') {
      this.next();
      if (++this.depth > MAX_DEPTH) throw new ExprError('Expresión demasiado anidada', t.p);
      try { return { t: 'un', op: word === '!' ? '!' : (t as { v: string }).v, a: this.unary() }; } finally { this.depth--; }
    }
    return this.postfix(this.primary());
  }
  postfix(e: Expr): Expr {
    for (;;) {
      if (this.isOp('.')) {
        this.next();
        const t = this.next();
        if (t.k !== 'id') throw new ExprError('Se esperaba un nombre tras «.»', t.p);
        e = { t: 'mem', obj: e, key: { t: 'lit', v: t.v } };
      } else if (this.isOp('[')) {
        this.next();
        const key = this.ternary();
        this.expect(']');
        e = { t: 'mem', obj: e, key };
      } else return e;
    }
  }
  primary(): Expr {
    const t = this.next();
    if (t.k === 'num' || t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'id') {
      const w = t.v;
      if (w === 'true' || w === 'verdadero') return { t: 'lit', v: true };
      if (w === 'false' || w === 'falso') return { t: 'lit', v: false };
      if (w === 'null' || w === 'undefined') return { t: 'lit', v: w === 'null' ? null : undefined };
      if (this.isOp('(')) {
        this.next();
        const args: Expr[] = [];
        if (!this.isOp(')')) { do { args.push(this.ternary()); } while (this.isOp(',') && this.next()); }
        this.expect(')');
        if (!(w in FUNCTIONS)) throw new ExprError(`Función desconocida «${w}»`, t.p);
        return { t: 'call', fn: w, args };
      }
      return { t: 'id', name: w };
    }
    if (t.k === 'op' && t.v === '(') { const e = this.ternary(); this.expect(')'); return e; }
    if (t.k === 'op' && t.v === '[') {
      const items: Expr[] = [];
      if (!this.isOp(']')) { do { items.push(this.ternary()); } while (this.isOp(',') && this.next()); }
      this.expect(']');
      return { t: 'arr', items };
    }
    throw new ExprError(t.k === 'end' ? 'La expresión termina de forma inesperada' : 'Expresión no válida', t.p);
  }
}

/** Quita `${…}`/`#{…}` y espacios. */
export function unwrapExpression(src: string): string {
  const s = src.trim();
  const m = /^[$#]\{([\s\S]*)\}$/.exec(s);
  return m ? m[1]!.trim() : s;
}

const CACHE = new Map<string, Expr>();
/** Analiza una expresión (memoizado). Lanza `ExprError` si no es válida. */
export function parseExpression(src: string): Expr {
  const cached = CACHE.get(src);
  if (cached) return cached;
  if (src.length > MAX_EXPR_LENGTH) throw new ExprError('Expresión demasiado larga');
  const body = unwrapExpression(src);
  if (!body) throw new ExprError('Expresión vacía');
  const e = new Parser(lex(body)).parse();
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(src, e);
  return e;
}

// ---------------------------------------------------------------- evaluación
const isNumLike = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    const other = typeof a === 'boolean' ? b : a, bool = typeof a === 'boolean' ? a : b;
    if (typeof other === 'string') return other.toLowerCase() === String(bool);
    if (typeof other === 'number') return other === Number(bool);
    return false;
  }
  if (isNumLike(a) && isNumLike(b) && (typeof a === 'number' || typeof b === 'number')) return Number(a) === Number(b);
  return false;
}
function compare(a: unknown, b: unknown): number {
  if (isNumLike(a) && isNumLike(b) && (typeof a === 'number' || typeof b === 'number')) return Number(a) - Number(b);
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const na = Number(a), nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return NaN;
  return na - nb;
}
const truthy = (v: unknown) => !!v;

function isPlain(o: unknown): o is Record<string, unknown> {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return false;
  const p = Object.getPrototypeOf(o);
  return p === Object.prototype || p === null;
}
function getMember(obj: unknown, key: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  const k = typeof key === 'number' ? key : String(key);
  if (typeof k === 'string' && BLOCKED.has(k)) throw new ExprError(`Propiedad no permitida «${k}»`);
  if (typeof obj === 'string' || Array.isArray(obj)) {
    if (k === 'length') return obj.length;
    const idx = typeof k === 'number' ? k : /^\d+$/.test(k) ? Number(k) : NaN;
    return Number.isInteger(idx) ? obj[idx] : undefined;
  }
  if (isPlain(obj)) return Object.hasOwn(obj, k) ? obj[k as string] : undefined;
  return undefined;
}

const num = (v: unknown) => Number(v);
const str = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
export const FUNCTIONS: Record<string, (...a: unknown[]) => unknown> = {
  len: v => (typeof v === 'string' || Array.isArray(v) ? v.length : isPlain(v) ? Object.keys(v).length : 0),
  min: (...a) => Math.min(...a.flat().map(num)),
  max: (...a) => Math.max(...a.flat().map(num)),
  abs: v => Math.abs(num(v)),
  round: (v, d) => { const f = 10 ** Math.max(0, Math.min(10, Number(d ?? 0) | 0)); return Math.round(num(v) * f) / f; },
  floor: v => Math.floor(num(v)),
  ceil: v => Math.ceil(num(v)),
  lower: v => str(v).toLowerCase(),
  upper: v => str(v).toUpperCase(),
  trim: v => str(v).trim(),
  contains: (a, b) => (Array.isArray(a) ? a.some(x => looseEq(x, b)) : str(a).includes(str(b))),
  startsWith: (a, b) => str(a).startsWith(str(b)),
  endsWith: (a, b) => str(a).endsWith(str(b)),
  number: v => num(v),
  string: v => str(v),
  bool: v => (typeof v === 'string' ? !['', '0', 'false', 'no', 'falso'].includes(v.trim().toLowerCase()) : !!v),
  isEmpty: v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (isPlain(v) && Object.keys(v).length === 0),
};

function ev(e: Expr, vars: Vars, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new ExprError('Expresión demasiado anidada');
  switch (e.t) {
    case 'lit': return e.v;
    case 'id':
      if (BLOCKED.has(e.name)) throw new ExprError(`Nombre no permitido «${e.name}»`);
      return Object.hasOwn(vars, e.name) ? vars[e.name] : undefined;
    case 'arr': return e.items.map(x => ev(x, vars, depth + 1));
    case 'mem': return getMember(ev(e.obj, vars, depth + 1), ev(e.key, vars, depth + 1));
    case 'call': return FUNCTIONS[e.fn]!(...e.args.map(x => ev(x, vars, depth + 1)));
    case 'un': {
      const a = ev(e.a, vars, depth + 1);
      return e.op === '!' ? !truthy(a) : e.op === '-' ? -num(a) : num(a);
    }
    case 'cond': return truthy(ev(e.c, vars, depth + 1)) ? ev(e.a, vars, depth + 1) : ev(e.b, vars, depth + 1);
    case 'bin': {
      if (e.op === '&&') { const a = ev(e.a, vars, depth + 1); return truthy(a) ? ev(e.b, vars, depth + 1) : a; }
      if (e.op === '||') { const a = ev(e.a, vars, depth + 1); return truthy(a) ? a : ev(e.b, vars, depth + 1); }
      if (e.op === '??') { const a = ev(e.a, vars, depth + 1); return a === null || a === undefined ? ev(e.b, vars, depth + 1) : a; }
      const a = ev(e.a, vars, depth + 1), b = ev(e.b, vars, depth + 1);
      switch (e.op) {
        case '+': return typeof a === 'string' || typeof b === 'string' ? str(a) + str(b) : num(a) + num(b);
        case '-': return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': return num(a) / num(b);
        case '%': return num(a) % num(b);
        case '==': return looseEq(a, b);
        case '!=': return !looseEq(a, b);
        case '===': return a === b;
        case '!==': return a !== b;
        case '<': return compare(a, b) < 0;
        case '<=': return compare(a, b) <= 0;
        case '>': return compare(a, b) > 0;
        case '>=': return compare(a, b) >= 0;
        case 'in':
          if (Array.isArray(b)) return b.some(x => looseEq(x, a));
          if (typeof b === 'string') return b.includes(str(a));
          if (isPlain(b)) return !BLOCKED.has(str(a)) && Object.hasOwn(b, str(a));
          return false;
      }
      throw new ExprError(`Operador desconocido «${e.op}»`);
    }
  }
}

/** Evalúa una expresión (texto o árbol) sobre las variables. Lanza `ExprError`. */
export function evaluate(src: string | Expr, vars: Vars = {}): unknown {
  return ev(typeof src === 'string' ? parseExpression(src) : src, vars, 0);
}

export type ConditionResult = { ok: true; value: boolean } | { ok: false; error: string };
/** Evalúa una condición como booleano sin lanzar: `{ ok: false, error }` si no se puede analizar o evaluar. */
export function evalCondition(src: string, vars: Vars = {}): ConditionResult {
  try { return { ok: true, value: truthy(evaluate(src, vars)) }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

/** ¿Es una expresión válida? Devuelve el mensaje de error o `null`. */
export function checkExpression(src: string): string | null {
  try { parseExpression(src); return null; } catch (e) { return e instanceof Error ? e.message : String(e); }
}

/** Nombres de variables que lee una expresión (las de primer nivel), para ofrecerlas como editables. */
export function expressionVariables(src: string): string[] {
  let e: Expr;
  try { e = parseExpression(src); } catch { return []; }
  const out = new Set<string>();
  const walk = (x: Expr) => {
    switch (x.t) {
      case 'id': out.add(x.name); break;
      case 'arr': x.items.forEach(walk); break;
      case 'mem': walk(x.obj); if (x.key.t !== 'lit') walk(x.key); break;
      case 'call': x.args.forEach(walk); break;
      case 'un': walk(x.a); break;
      case 'bin': walk(x.a); walk(x.b); break;
      case 'cond': walk(x.c); walk(x.a); walk(x.b); break;
    }
  };
  walk(e);
  return [...out];
}

// ---------------------------------------------------------------- acciones
/** Resultado de una acción: variables nuevas (si asignó), evento interno (si `raise`) o nada (acción opaca). */
export interface ActionEffect { kind: 'assign' | 'raise' | 'opaque' | 'error'; variables?: Vars; event?: string; target?: string; error?: string }

const ASSIGN = /^([\p{L}_$][\p{L}\p{N}_$]*)\s*(=|\+=|-=|\*=|\/=)(?!=)\s*([\s\S]+)$/u;
const INCDEC = /^([\p{L}_$][\p{L}\p{N}_$]*)\s*(\+\+|--)$/u;
const RAISE = /^(?:raise|send)\s*\(\s*['"]?([^'")]+?)['"]?\s*\)$/;

/**
 * Ejecuta una acción de texto sobre las variables, sin modificarlas (devuelve una copia si asigna). Una acción que
 * no es asignación ni `raise(...)` (p. ej. `enviarCorreo`) es opaca: solo se registra.
 */
export function runAction(src: string, vars: Vars = {}): ActionEffect {
  const s = unwrapExpression(src);
  const r = RAISE.exec(s);
  if (r) return { kind: 'raise', event: r[1]!.trim() };
  const m = ASSIGN.exec(s), inc = INCDEC.exec(s);
  if (!m && !inc) return { kind: 'opaque' };
  const name = (m ?? inc)![1]!;
  if (BLOCKED.has(name)) return { kind: 'error', error: `Nombre no permitido «${name}»` };
  try {
    const cur = Object.hasOwn(vars, name) ? vars[name] : undefined;
    let value: unknown;
    if (inc) value = num(cur ?? 0) + (inc[2] === '++' ? 1 : -1);
    else {
      const rhs = evaluate(m![3]!, vars);
      const op = m![2]!;
      value = op === '=' ? rhs : op === '+=' ? (typeof cur === 'string' || typeof rhs === 'string' ? str(cur) + str(rhs) : num(cur ?? 0) + num(rhs))
        : op === '-=' ? num(cur ?? 0) - num(rhs) : op === '*=' ? num(cur ?? 0) * num(rhs) : num(cur ?? 0) / num(rhs);
    }
    return { kind: 'assign', target: name, variables: { ...vars, [name]: value } };
  } catch (e) { return { kind: 'error', error: e instanceof Error ? e.message : String(e) }; }
}

// ---------------------------------------------------------------- duraciones
/**
 * Duración en milisegundos: `500ms`, `30s`, `5m`, `2h`, `1d`, `1.5h`, `5 min`, número sin unidad (ms), ISO 8601
 * (`PT5M`, `P1DT2H`, `R3/PT10M` → el periodo). `null` si no se entiende.
 */
export function parseDuration(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;
  const cycle = /^R\d*\/(.+)$/i.exec(s);
  if (cycle) s = cycle[1]!.split('/').find(p => /^P/i.test(p)) ?? cycle[1]!;
  const iso = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(s);
  if (iso && s.length > 1 && !/T$/i.test(s)) {
    const [, w, d, h, m, sec] = iso;
    return Math.round((Number(w ?? 0) * 7 * 86400 + Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(sec ?? 0)) * 1000);
  }
  s = s.replace(/^after\s+/i, '');
  const re = /(\d+(?:\.\d+)?)\s*(ms|milisegundos?|milliseconds?|s|segs?|segundos?|secs?|seconds?|m|mins?|minutos?|minutes?|h|hrs?|horas?|hours?|d|d[ií]as?|days?|w|sem|semanas?|weeks?)?(?![\p{L}])\s*/uy;
  let total = 0, pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m || re.lastIndex === pos) return null;
    total += Number(m[1]) * unitMs(m[2] ?? 'ms');
    pos = re.lastIndex;
  }
  return Math.round(total);
}

function unitMs(u: string): number {
  const x = u.toLowerCase();
  if (x === 'ms' || x.startsWith('mil')) return 1;
  if (x === 's' || x.startsWith('seg') || x.startsWith('sec')) return 1000;
  if (x === 'm' || x.startsWith('min')) return 60_000;
  if (x === 'h' || x.startsWith('h')) return 3_600_000;
  if (x === 'd' || x.startsWith('d')) return 86_400_000;
  return 604_800_000;
}

/** `75_000` → `1 min 15 s`; `0` → `0 s`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const parts: string[] = [];
  let s = Math.round(ms / 1000);
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (d) parts.push(`${d} d`);
  if (h) parts.push(`${h} h`);
  if (m) parts.push(`${m} min`);
  if (s || !parts.length) parts.push(`${s} s`);
  return parts.join(' ');
}
