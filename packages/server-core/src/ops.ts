/**
 * Operaciones de la API sobre el contenido de un espacio, como funciones puras sobre un `YjsStore`.
 * Las usa `LocalDocHost` (Node: el doc está en el mismo proceso) y el Durable Object del worker
 * (el doc está en otro isolate y la API se las pide por `fetch`). Así la lógica es una sola.
 */
import {
  CommandSchema, MemoryStore, Workspace as WorkspaceSchema, execute, loadInto, validate,
  Library, Element, Relation, View, ViewNode, ViewEdge, Dimension, Person, StyleRule, Comment, SCHEMA_VERSION,
  type Collection, type Command, type Diagnostic, type Workspace, type WorkspaceMeta, type NotationRegistry,
} from '@all-draw/core';
import { renderSvg as renderSvgIo } from '@all-draw/io';
import type { YjsStore } from '@all-draw/sync';
import { createRegistry } from './notations';

/** Error de usuario al aplicar comandos (→ 400 si es de forma, 422 si no se pudo aplicar, 413 si el espacio supera `MAX_DOC_BYTES`). */
export class CommandError extends Error {
  constructor(readonly status: 400 | 413 | 422, message: string, readonly issues?: unknown[], readonly extra?: Record<string, unknown>) { super(message); }
}

/** Código de error (en el cuerpo `{ code }`) cuando un espacio llega a `MAX_DOC_BYTES`. */
export const DOC_TOO_LARGE = 'doc_too_large';
export const formatBytes = (n: number): string => n >= 1024 * 1024 ? `${Math.round((n / (1024 * 1024)) * 10) / 10} MB` : `${Math.round(n / 1024)} KB`;
export function docTooLarge(limit: number): CommandError {
  return new CommandError(413, `El espacio ha llegado a su tamaño máximo (${formatBytes(limit)}). Borra contenido o reparte el modelo en varios espacios para seguir editando.`, undefined, { code: DOC_TOO_LARGE, limit });
}

type RecordSchema = { safeParse(v: unknown): { success: true; data: unknown } | { success: false; error: { issues: unknown[] } } };
/** Esquema de registro por colección: `set` normaliza el valor (rellena `style: {}`, `bendpoints: []`, …). */
const RECORD_SCHEMAS: Record<Collection, RecordSchema> =
  { libraries: Library, elements: Element, relations: Relation, views: View, nodes: ViewNode, edges: ViewEdge, dimensions: Dimension, people: Person, rules: StyleRule, comments: Comment };

export function normalizeCommand(cmd: Command): Command {
  switch (cmd.type) {
    case 'set': {
      const r = RECORD_SCHEMAS[cmd.collection].safeParse(cmd.value);
      if (!r.success) throw new CommandError(400, `set ${cmd.collection}/${cmd.id}: registro inválido`, r.error.issues);
      if ((r.data as { id?: string }).id !== cmd.id) throw new CommandError(400, `set ${cmd.collection}/${cmd.id}: value.id no coincide con id`);
      return { ...cmd, value: r.data as never };
    }
    case 'batch': return { ...cmd, commands: cmd.commands.map(normalizeCommand) };
    default: return cmd;
  }
}

/** Valida la forma de una lista de comandos JSON (para el DO, que recibe JSON sin pasar por la API). */
export function parseCommands(raw: unknown): Command[] {
  const r = CommandSchema.array().min(1).max(5000).safeParse(raw);
  if (!r.success) throw new CommandError(400, 'comandos inválidos', r.error.issues);
  return (r.data as Command[]).map(normalizeCommand);
}

export function registryFor(s: YjsStore): NotationRegistry {
  const reg = createRegistry();
  for (const lib of s.list('libraries')) reg.registerLibraryTypes(lib);
  return reg;
}

export const opSnapshot = (s: YjsStore): Workspace => s.snapshot();

export function opInit(s: YjsStore, name: string, initial: Workspace | null): void {
  if (initial) loadInto(s, { ...initial, meta: { ...initial.meta, name } });
  else s.setMeta({ name, createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION });
}

export function opReplace(s: YjsStore, ws: Workspace): void { loadInto(s, ws); }

export function opSetMeta(s: YjsStore, patch: Partial<WorkspaceMeta>): void { s.setMeta({ ...patch, updatedAt: new Date().toISOString() }); }

/** Aplica comandos (ya normalizados) con ensayo previo sobre una copia: si uno falla, el doc no queda a medias. */
export function opCommands(s: YjsStore, commands: Command[], label?: string): Command {
  try {
    execute(new MemoryStore(s.snapshot()), { type: 'batch', label, commands });
    return execute(s, { type: 'batch', label: label ?? 'api', commands }, 'api');
  } catch (e) { throw new CommandError(422, `No se pudo aplicar: ${(e as Error).message}`); }
}

export function opValidate(s: YjsStore): Diagnostic[] { return validate(s, registryFor(s)); }

export interface SvgOpts { theme?: 'light' | 'dark' | 'dual'; padding?: number }
/** `null` si la vista no existe. */
export function opRenderSvg(s: YjsStore, viewId: string, opts: SvgOpts = {}): string | null {
  if (!s.get('views', viewId)) return null;
  return renderSvgIo(s, registryFor(s), viewId, { ...(opts.theme ? { theme: opts.theme } : {}), ...(opts.padding !== undefined ? { padding: opts.padding } : {}) });
}

export const parseWorkspaceJson = (raw: unknown): Workspace | { issues: unknown[] } => {
  const r = WorkspaceSchema.safeParse(raw);
  return r.success ? r.data : { issues: r.error.issues };
};
