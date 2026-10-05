/**
 * `YjsStore`: el contrato `Store` del núcleo sobre un `Y.Doc`.
 *
 * Estructura del documento (formato de registros 2): un `Y.Map` por colección (`doc.getMap('elements')`, …) cuyo
 * valor para cada id es **otro `Y.Map` con los campos del registro**, y `doc.getMap('meta')` con claves sueltas.
 *
 * - Cada campo de primer nivel es una clave del `Y.Map` del registro: dos personas que cambian a la vez campos
 *   distintos del mismo elemento conservan los dos cambios; si tocan el mismo campo gana el último (LWW).
 * - Los subobjetos «bolsa» (`fields`, `props`, `features`, `style`, `meta`, `grid`) son a su vez `Y.Map`: se
 *   fusionan clave a clave (dos campos tipados distintos, dos propiedades distintas…).
 * - Los textos largos (`doc` de elementos, relaciones y vistas; `text` y `note` de nodos; `text` de comentarios;
 *   `notes` de personas; `description` de librerías; los campos `textarea`/`json` de `fields`) son `Y.Text`: dos
 *   personas escribiendo en el mismo texto se fusionan carácter a carácter.
 * - Lo demás (números, cadenas cortas, matrices, objetos-valor como `anchor`/`cell`) es atómico.
 * - Excepciones por tamaño (ver `EMPTY_DEFAULTS`, `EAGER_KEYS`, `PACKED_KEYS`): el `id` no se guarda (es la clave);
 *   los vacíos por defecto (`''`, `[]`, `{}`) no se guardan y se reponen al leer (salvo `doc`/`fields`/`props` de
 *   elementos y `doc` de vistas, que se crean siempre); los extremos de aristas y relaciones y la vista/elemento de
 *   un nodo van juntos en una sola clave atómica (`$`). Así un espacio grande ocupa un 20 % menos que con registros
 *   JSON y abrirlo cuesta casi lo mismo (`docs/06-rendimiento.md`).
 *
 * `get`/`list`/`snapshot` devuelven siempre objetos planos (con caché por registro: la identidad se mantiene hasta
 * que el registro cambia) y `set` calcula el diff contra el estado actual y solo toca lo que cambió; en los `Y.Text`
 * aplica un diff mínimo de texto (prefijo y sufijo comunes). Dentro de `transact`, borrar y volver a escribir el
 * mismo registro (lo que hace `loadInto`) es un diff, no un borrado y una creación.
 *
 * **Compatibilidad (formato 1):** los documentos antiguos guardan cada registro como un objeto JSON plano. Se leen
 * igual, y cada registro se **migra perezosamente** al formato nuevo la primera vez que cambia (o todos de golpe con
 * `migrateRecords`, que es lo que hace el servidor al cargar un doc antiguo). Los clientes antiguos no entienden el
 * formato 2: el servidor no los deja sincronizar (ver `SYNC_PROTOCOL` en `remote.ts` y la puerta de versión de
 * `LiveDoc` en `@all-draw/server-core`).
 */
import * as Y from 'yjs';
import {
  COLLECTIONS,
  WorkspaceMeta as WorkspaceMetaSchema,
  parseWorkspace,
  type Collection,
  type Listener,
  type RecordOf,
  type Store,
  type StoreChange,
  type Workspace,
  type WorkspaceMeta,
} from '@all-draw/core';

/** Formato de los registros que escribe este código (1 = JSON plano por registro; 2 = `Y.Map` por registro). */
export const RECORD_FORMAT = 2;

/** Subobjetos que se guardan como `Y.Map` (fusión clave a clave). El resto de objetos son valores atómicos. */
export const BAG_KEYS: ReadonlySet<string> = new Set(['fields', 'props', 'features', 'style', 'meta', 'grid']);

/** Campos de primer nivel que son texto largo (`Y.Text`), por colección. */
export const TEXT_KEYS: Readonly<Partial<Record<Collection, ReadonlySet<string>>>> = {
  elements: new Set(['doc']),
  relations: new Set(['doc']),
  views: new Set(['doc']),
  nodes: new Set(['text', 'note']),
  comments: new Set(['text']),
  people: new Set(['notes']),
  libraries: new Set(['description']),
};

/**
 * Valores vacíos por defecto (los del esquema) que **no se guardan**: un registro recién creado ocupa solo lo que
 * tiene contenido (menos elementos de Yjs: abrir y cargar un espacio grande cuesta casi lo mismo que con registros
 * JSON). Al leer se reponen. `s` = cadena vacía, `a` = matriz vacía, `o` = objeto vacío.
 *
 * Los textos largos y las bolsas vacías se crean como `Y.Text`/`Y.Map` al recibir su primer contenido; una vez
 * creados no se vuelven a quitar aunque se vacíen (así no se pierde lo que otra persona esté escribiendo en ellos).
 */
export const EMPTY_DEFAULTS: Readonly<Partial<Record<Collection, Readonly<Record<string, 's' | 'a' | 'o'>>>>> = {
  elements: { name: 's', doc: 's', fields: 'o', ports: 'a', profiles: 'a', props: 'o', features: 'o', tags: 'a' },
  relations: { name: 's', doc: 's', mappings: 'a', fields: 'o', props: 'o', features: 'o' },
  views: { name: 's', doc: 's', style: 'o', props: 'o' },
  nodes: { style: 'o' },
  edges: { bendpoints: 'a', style: 'o' },
  people: { assignments: 'a' },
  rules: { conditions: 'a', style: 'o' },
  comments: { mentions: 'a' },
  libraries: { description: 's', elementTypes: 'a', relationTypes: 'a', portTypes: 'a', notations: 'a' },
};
/**
 * Excepciones: vacíos que **sí** se crean siempre (como `Y.Text`/`Y.Map`), porque es donde dos personas escriben a la
 * vez en un registro recién creado y, si cada una creara el suyo, ganaría una (ver «Edición simultánea» en el manual).
 */
export const EAGER_KEYS: Readonly<Partial<Record<Collection, ReadonlySet<string>>>> = {
  elements: new Set(['doc', 'fields', 'props']),
  views: new Set(['doc']),
};
/**
 * Claves que se guardan **juntas**, como un único valor atómico bajo `PACK_KEY`: los extremos de una línea o de una
 * relación (y su tipo) y la vista/elemento de un nodo. Son una unidad: mezclar el origen que puso una persona con el
 * puerto que puso otra daría una combinación inválida; y no cambian casi nunca, así que agruparlas ahorra muchos
 * elementos de Yjs en los espacios grandes (abrir es más rápido). Si dos personas los cambian a la vez, gana uno.
 */
export const PACKED_KEYS: Readonly<Partial<Record<Collection, readonly string[]>>> = {
  nodes: ['viewId', 'elementId', 'visualType'],
  edges: ['viewId', 'relationId', 'fromNodeId', 'toNodeId', 'fromPortId', 'toPortId'],
  relations: ['typeId', 'from', 'to'],
};
export const PACK_KEY = '$';
const PACKED_SETS = Object.fromEntries(COLLECTIONS.map(c => [c, new Set<string>(PACKED_KEYS[c] ?? [])])) as unknown as Record<Collection, ReadonlySet<string>>;


function isEmptyOf(kind: 's' | 'a' | 'o' | undefined, v: unknown): boolean {
  if (!kind) return false;
  if (kind === 's') return v === '';
  if (kind === 'a') return Array.isArray(v) && v.length === 0;
  if (!v || typeof v !== 'object' || Array.isArray(v) || v instanceof Y.AbstractType) return false;
  for (const k in v as Record<string, unknown>) if ((v as Record<string, unknown>)[k] !== undefined) return false;
  return true;
}
const DEFAULT_LIST = Object.fromEntries(COLLECTIONS.map(c => [c, Object.entries(EMPTY_DEFAULTS[c] ?? {})])) as Record<Collection, [string, 's' | 'a' | 'o'][]>;
const emptyOf = (kind: 's' | 'a' | 'o'): unknown => (kind === 's' ? '' : kind === 'a' ? [] : {});

/**
 * Qué claves de `fields` de un registro son texto largo (`textarea`/`json`). La app lo conecta con su registro de
 * notaciones (`store.textFields = …`); sin él, se trata como texto largo cualquier valor con saltos de línea.
 * Una vez un campo es `Y.Text` lo sigue siendo aunque el criterio cambie (la representación es pegajosa).
 */
export type TextFieldResolver = (collection: Collection, record: Record<string, unknown>) => Iterable<string> | undefined;

/** Traduce el origen de una transacción Yjs al `origin` del `StoreChange`. */
export function resolveOrigin(origin: unknown): string {
  if (typeof origin === 'string') return origin;
  if (origin instanceof Y.UndoManager) return origin.undoing ? 'undo' : origin.redoing ? 'redo' : 'local';
  // Cualquier otro objeto es un proveedor (IndexedDB, WebSocket, …) o una aplicación de update directa.
  return 'remote';
}

/** Clona los valores anidados que el parseo dejó compartidos con el original (hasta dos niveles). */
function detachShared(parsed: Record<string, unknown>, raw: Record<string, unknown> | undefined): void {
  if (!raw) return;
  for (const k of Object.keys(parsed)) {
    const v = parsed[k];
    if (!v || typeof v !== 'object') continue;
    if (v === raw[k]) { parsed[k] = structuredClone(v); continue; }
    if (Array.isArray(v)) continue;
    const rv = raw[k];
    if (!rv || typeof rv !== 'object') continue;
    const inner = v as Record<string, unknown>, rinner = rv as Record<string, unknown>;
    for (const kk of Object.keys(inner)) {
      const x = inner[kk];
      if (x && typeof x === 'object' && x === rinner[kk]) inner[kk] = structuredClone(x);
    }
  }
}

// ---------------------------------------------------------------- utilidades de valores
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Y.AbstractType) && !(v instanceof Uint8Array);

/** Igualdad estructural de valores JSON (atómicos). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!jsonEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>;
  let n = 0;
  for (const k in ao) {
    if (ao[k] === undefined) continue;
    n++;
    if (!jsonEqual(ao[k], bo[k])) return false;
  }
  for (const k in bo) if (bo[k] !== undefined) n--;
  return n === 0;
}

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

/**
 * Diff mínimo de texto (prefijo y sufijo comunes): un borrado y una inserción en el hueco. Para teclear, pegar o
 * borrar un trozo es exactamente lo que cambió, así que las ediciones simultáneas en otras partes del texto se
 * conservan. No parte pares sustitutos (emoji).
 */
export function textDiff(before: string, after: string): { index: number; remove: number; insert: string } | null {
  if (before === after) return null;
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  if (start > 0 && start < before.length && isLowSurrogate(before.charCodeAt(start)) && isHighSurrogate(before.charCodeAt(start - 1))) start--;
  let endB = before.length, endA = after.length;
  while (endB > start && endA > start && before.charCodeAt(endB - 1) === after.charCodeAt(endA - 1)) { endB--; endA--; }
  if (endB < before.length && endB > start && isLowSurrogate(before.charCodeAt(endB)) && isHighSurrogate(before.charCodeAt(endB - 1))) { endB++; endA++; }
  return { index: start, remove: endB - start, insert: after.slice(start, endA) };
}

function applyText(t: Y.Text, value: string): void {
  const d = textDiff(t.toString(), value);
  if (!d) return;
  if (d.remove) t.delete(d.index, d.remove);
  if (d.insert) t.insert(d.index, d.insert);
}

/** Valor de Yjs → valor plano. */
function plainValue(v: unknown): unknown {
  if (v === null || typeof v !== 'object' || !(v instanceof Y.AbstractType)) return v;
  if (v instanceof Y.Text) return v.toString();
  if (v instanceof Y.Map) return plainMap(v);
  if (v instanceof Y.AbstractType) return v.toJSON();
  return v;
}
function plainMap(m: Y.Map<unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  m.forEach((v, k) => { o[k] = plainValue(v); });
  return o;
}
/** Registro en formato 2 → objeto plano (con el `id` repuesto si no se guardó). */
function plainRecord(c: Collection, id: string, m: Y.Map<unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { id };
  m.forEach((v, k) => {
    if (k === PACK_KEY && v && typeof v === 'object') Object.assign(o, v);
    else o[k] = plainValue(v);
  });
  const defs = DEFAULT_LIST[c];
  for (let i = 0; i < defs.length; i++) { const [k, kind] = defs[i]!; if (o[k] === undefined) o[k] = emptyOf(kind); }
  return o;
}

/**
 * Valor guardado en el `Y.Map` de una colección → registro plano (para quien lea el `Y.Doc` directamente en vez de usar
 * el store, p. ej. en un observador): en formato 2 lo convierte; en formato 1 (JSON) lo devuelve tal cual.
 */
export function recordValue(c: Collection, id: string, v: unknown): Record<string, unknown> | undefined {
  if (v instanceof Y.Map) return plainRecord(c, id, v);
  return v && typeof v === 'object' ? v as Record<string, unknown> : undefined;
}

/** ¿Este registro aún está en el formato antiguo (JSON plano)? */
export const isLegacyRecord = (v: unknown): boolean => v !== undefined && !(v instanceof Y.Map);

export interface YjsStoreOptions {
  /** Ver `TextFieldResolver`. */
  textFields?: TextFieldResolver;
}

export class YjsStore implements Store {
  readonly doc: Y.Doc;
  readonly maps: Record<Collection, Y.Map<unknown>>;
  readonly metaMap: Y.Map<unknown>;
  /** Claves de `fields` que son texto largo; ver `TextFieldResolver`. Se puede cambiar en cualquier momento. */
  textFields: TextFieldResolver | null;
  private listeners = new Set<Listener>();
  private listCache = new Map<Collection, unknown[]>();
  /** Registro plano por id (misma identidad hasta que cambia). */
  private recCache: Record<Collection, Map<string, unknown>>;
  private metaCache: WorkspaceMeta | null = null;
  /** Profundidad de `transact` y borrados aplazados hasta que acabe la más externa (ver `delete`). */
  private depth = 0;
  private pendingDel: Map<Collection, Set<string>> | null = null;

  constructor(doc: Y.Doc = new Y.Doc(), opts: YjsStoreOptions = {}) {
    this.doc = doc;
    this.textFields = opts.textFields ?? null;
    this.maps = Object.fromEntries(COLLECTIONS.map(c => [c, doc.getMap(c)])) as Record<Collection, Y.Map<unknown>>;
    this.recCache = Object.fromEntries(COLLECTIONS.map(c => [c, new Map()])) as Record<Collection, Map<string, unknown>>;
    this.metaMap = doc.getMap('meta');
    for (const c of COLLECTIONS) {
      const map = this.maps[c];
      map.observeDeep((events, txn) => {
        const ids = new Set<string>();
        for (const ev of events) {
          if (ev.target === map) for (const k of (ev as Y.YMapEvent<unknown>).keysChanged) ids.add(k);
          else { const id = ev.path[0]; if (typeof id === 'string') ids.add(id); }
        }
        if (!ids.size) return;
        const cache = this.recCache[c];
        for (const id of ids) cache.delete(id);
        this.listCache.delete(c);
        this.emit({ collection: c, ids: [...ids], origin: resolveOrigin(txn.origin) });
      });
    }
    this.metaMap.observe((ev, txn) => {
      this.metaCache = null;
      this.emit({ collection: 'meta', ids: [...ev.keysChanged], origin: resolveOrigin(txn.origin) });
    });
  }

  get<C extends Collection>(c: C, id: string): RecordOf<C> | undefined {
    if (this.pendingDel?.get(c)?.has(id)) return undefined;
    const cache = this.recCache[c];
    const hit = cache.get(id);
    if (hit !== undefined) return hit as RecordOf<C>;
    const v = this.maps[c].get(id);
    if (v === undefined) return undefined;
    const rec = v instanceof Y.Map ? plainRecord(c, id, v) : v;
    cache.set(id, rec);
    return rec as RecordOf<C>;
  }

  set<C extends Collection>(c: C, id: string, value: RecordOf<C>): void {
    const revived = !!this.pendingDel?.get(c)?.delete(id);
    const cur = this.maps[c].get(id);
    if (cur instanceof Y.Map) {
      // Sin cambios (p. ej. `loadInto` o restaurar con el mismo contenido): no se toca el documento.
      const prev = this.recCache[c].get(id) ?? plainRecord(c, id, cur);
      if (jsonEqual(prev, value)) {
        if (revived) { this.recCache[c].set(id, prev); this.listCache.delete(c); }
        return;
      }
    }
    this.invalidate(c, id);
    this.doc.transact(() => {
      const rec = value as unknown as Record<string, unknown>;
      const entries = this.recordEntries(c, id, rec);
      // Registro nuevo, o antiguo en JSON plano (migración perezosa): se escribe entero en el formato nuevo.
      if (cur instanceof Y.Map) this.patchMap(cur, entries, TEXT_KEYS[c], c, rec, true);
      else this.maps[c].set(id, this.buildMap(entries, TEXT_KEYS[c], c, rec, true));
    }, 'local');
  }

  /**
   * Dentro de `transact` el borrado se aplaza al final: si el mismo registro se vuelve a escribir en la misma
   * transacción (`loadInto`, restaurar, importar encima) se hace diff contra el que había en vez de borrarlo y
   * crearlo de nuevo, así que lo que no cambia no se toca (ni se pierde lo que otro esté editando en él).
   */
  delete(c: Collection, id: string): void {
    if (!this.maps[c].has(id) || this.pendingDel?.get(c)?.has(id)) return;
    if (this.depth > 0) {
      // El registro plano se queda en la caché: si se vuelve a escribir igual, se compara con él sin reconstruirlo.
      this.listCache.delete(c);
      this.pendingDel ??= new Map();
      let set = this.pendingDel.get(c);
      if (!set) this.pendingDel.set(c, (set = new Set()));
      set.add(id);
      return;
    }
    this.invalidate(c, id);
    this.doc.transact(() => this.maps[c].delete(id), 'local');
  }

  list<C extends Collection>(c: C): RecordOf<C>[] {
    let cached = this.listCache.get(c);
    if (!cached) {
      const out: unknown[] = [];
      const gone = this.pendingDel?.get(c);
      for (const id of this.maps[c].keys()) if (!gone?.has(id)) out.push(this.get(c, id));
      this.listCache.set(c, (cached = out));
    }
    return cached as RecordOf<C>[];
  }
  ids(c: Collection): string[] {
    const gone = this.pendingDel?.get(c);
    const out = [...this.maps[c].keys()];
    return gone?.size ? out.filter(id => !gone.has(id)) : out;
  }

  meta(): WorkspaceMeta {
    if (!this.metaCache) this.metaCache = WorkspaceMetaSchema.parse(Object.fromEntries(this.metaMap.entries()));
    return this.metaCache;
  }
  setMeta(patch: Partial<WorkspaceMeta>): void {
    this.metaCache = null;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) this.metaMap.delete(k);
        else if (!jsonEqual(this.metaMap.get(k), v)) this.metaMap.set(k, v);
      }
    }, 'local');
  }

  /** Una transacción Yjs: un solo `StoreChange` por colección tocada. Anidar reutiliza la externa. */
  transact<T>(fn: () => T, origin = 'local'): T {
    return this.doc.transact(() => {
      this.depth++;
      try { return fn(); } finally { if (--this.depth === 0) this.flushDeletes(); }
    }, origin);
  }
  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  /**
   * Copia validada (`parseWorkspace`), desligada del documento. Zod ya construye objetos nuevos para
   * todo lo tipado; solo los valores `unknown` (campos, rasgos, meta, estilo de vista) se devuelven
   * por referencia, así que se clonan únicamente esos en vez de clonar todo el documento dos veces.
   */
  snapshot(): Workspace {
    const raw: Record<string, Record<string, Record<string, unknown>>> = { meta: Object.fromEntries(this.metaMap.entries()) as Record<string, Record<string, unknown>> };
    for (const c of COLLECTIONS) {
      const out: Record<string, Record<string, unknown>> = {};
      for (const id of this.maps[c].keys()) out[id] = this.get(c, id) as unknown as Record<string, unknown>;
      raw[c] = out;
    }
    const ws = parseWorkspace(raw);
    for (const c of COLLECTIONS) {
      const src = raw[c]!;
      for (const [id, rec] of Object.entries(ws[c])) detachShared(rec as Record<string, unknown>, src[id]);
    }
    detachShared(ws.meta as Record<string, unknown>, raw.meta as unknown as Record<string, unknown>);
    return ws;
  }

  /** Registros que aún están en el formato antiguo (JSON plano), por colección. */
  legacyCount(): number {
    let n = 0;
    for (const c of COLLECTIONS) for (const v of this.maps[c].values()) if (isLegacyRecord(v)) n++;
    return n;
  }

  // ---------------------------------------------------------------- escritura
  private invalidate(c: Collection, id: string) { this.recCache[c].delete(id); this.listCache.delete(c); }

  private flushDeletes() {
    const p = this.pendingDel; if (!p) return;
    this.pendingDel = null;
    for (const [c, ids] of p) for (const id of ids) { this.maps[c].delete(id); this.invalidate(c, id); }
  }

  /** Entradas de un registro: sin `undefined` y sin `id` si coincide con la clave. */
  private recordEntries(c: Collection, id: string, rec: Record<string, unknown>): [string, unknown][] {
    const out: [string, unknown][] = [];
    const packed = PACKED_SETS[c];
    let pack: Record<string, unknown> | null = null;
    for (const k in rec) {
      const v = rec[k];
      if (v === undefined || (k === 'id' && v === id)) continue;
      if (packed.has(k)) { (pack ??= {})[k] = v; continue; }
      out.push([k, v]);
    }
    if (pack) out.push([PACK_KEY, pack]);
    return out;
  }

  private fieldTextKeys(c: Collection, rec: Record<string, unknown>, fields: Record<string, unknown>): Set<string> {
    const keys = new Set<string>();
    const fromResolver = this.textFields?.(c, rec);
    if (fromResolver) for (const k of fromResolver) keys.add(k);
    else for (const k in fields) { const v = fields[k]; if (typeof v === 'string' && v.includes('\n')) keys.add(k); }
    return keys;
  }

  /** Valor nuevo para una clave (`Y.Text`, `Y.Map` o atómico). `record` = primer nivel del registro (con bolsas). */
  private buildValue(k: string, v: unknown, textKeys: ReadonlySet<string> | undefined, c: Collection, rec: Record<string, unknown>, record: boolean): unknown {
    if (typeof v === 'string' && textKeys?.has(k)) return new Y.Text(v);
    if (record && BAG_KEYS.has(k) && isPlainObject(v)) {
      const inner = Object.entries(v).filter(([, x]) => x !== undefined);
      return this.buildMap(inner, k === 'fields' ? this.fieldTextKeys(c, rec, v) : undefined, c, rec, false);
    }
    return v;
  }

  private buildMap(entries: [string, unknown][], textKeys: ReadonlySet<string> | undefined, c: Collection, rec: Record<string, unknown>, record: boolean): Y.Map<unknown> {
    const m = new Y.Map<unknown>();
    const defs = record ? EMPTY_DEFAULTS[c] : undefined;
    const eager = EAGER_KEYS[c];
    for (const [k, v] of entries) {
      if (defs && isEmptyOf(defs[k], v) && !eager?.has(k)) continue;
      m.set(k, this.buildValue(k, v, textKeys, c, rec, record));
    }
    return m;
  }

  /** Lleva `ymap` a `entries` tocando solo lo que cambió. `record` = primer nivel de un registro. */
  private patchMap(ymap: Y.Map<unknown>, entries: [string, unknown][], textKeys: ReadonlySet<string> | undefined, c: Collection, rec: Record<string, unknown>, record: boolean): void {
    const defs = record ? EMPTY_DEFAULTS[c] : undefined;
    const eager = record ? EAGER_KEYS[c] : undefined;
    const next = new Set<string>();
    for (const [k, v] of entries) {
      // Un vacío por defecto no se guarda… salvo que ya sea un Y.Text/Y.Map (entonces se vacía, no se quita) o sea
      // de los que se crean siempre.
      if (defs && isEmptyOf(defs[k], v) && !eager?.has(k) && !(ymap.get(k) instanceof Y.AbstractType)) continue;
      next.add(k);
    }
    for (const k of [...ymap.keys()]) if (!next.has(k)) ymap.delete(k);
    for (const [k, v] of entries) {
      if (!next.has(k)) continue;
      const cur = ymap.get(k);
      if (cur instanceof Y.Text) {
        // Pegajoso: un texto largo sigue siéndolo; solo cambia de representación si deja de ser cadena.
        if (typeof v === 'string') applyText(cur, v); else ymap.set(k, this.buildValue(k, v, textKeys, c, rec, record));
        continue;
      }
      if (typeof v === 'string' && textKeys?.has(k)) {
        if (cur !== v) ymap.set(k, new Y.Text(v));
        continue;
      }
      if (record && BAG_KEYS.has(k) && isPlainObject(v)) {
        const inner = Object.entries(v).filter(([, x]) => x !== undefined);
        const innerText = k === 'fields' ? this.fieldTextKeys(c, rec, v) : undefined;
        if (cur instanceof Y.Map) this.patchMap(cur, inner, innerText, c, rec, false);
        else ymap.set(k, this.buildMap(inner, innerText, c, rec, false));
        continue;
      }
      if (cur instanceof Y.AbstractType || !jsonEqual(cur, v)) ymap.set(k, v);
    }
  }

  private emit(ch: StoreChange) { for (const l of this.listeners) l(ch); }
}

/**
 * Reemplaza el contenido de un store por el de `ws` tocando solo lo que cambia: borra los registros que sobran y
 * escribe el resto con `set` (que en `YjsStore` hace diff campo a campo). A diferencia de `loadInto` (que borra y
 * vuelve a crear todo), no rompe las ediciones simultáneas en registros que no cambian. Una sola transacción.
 */
export function replaceInto(store: Store, ws: Workspace, origin = 'load'): void {
  store.transact(() => {
    for (const c of COLLECTIONS) {
      const next = ws[c] as Record<string, unknown>;
      for (const id of store.ids(c)) if (!(id in next)) store.delete(c, id);
      for (const [id, v] of Object.entries(next)) {
        const cur = store.get(c, id);
        if (cur === undefined || !jsonEqual(cur, v)) store.set(c, id, v as never);
      }
    }
    store.setMeta(ws.meta);
  }, origin);
}

/**
 * Migra de una vez todos los registros en formato antiguo (JSON plano) al formato nuevo. Normalmente no hace falta
 * (se migran solos al primer cambio); sirve para tests y herramientas. Devuelve cuántos migró.
 */
export function migrateRecords(store: YjsStore, origin = 'migrate'): number {
  let n = 0;
  store.transact(() => {
    for (const c of COLLECTIONS) {
      for (const [id, v] of [...store.maps[c].entries()]) {
        if (!isLegacyRecord(v)) continue;
        store.set(c, id, structuredClone(v) as never);
        n++;
      }
    }
  }, origin);
  return n;
}
