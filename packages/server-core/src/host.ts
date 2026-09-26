/**
 * `DocHost`: lo que la API REST necesita del contenido de los espacios, expresado como
 * operaciones con datos (no callbacks) para que pueda estar en el mismo proceso (`LocalDocHost`,
 * sobre un `DocManager`) o en otro isolate (el worker de Cloudflare lo reenvía a un Durable Object).
 */
import type { Command, Diagnostic, Workspace, WorkspaceMeta } from '@all-draw/core';
import type { DocManager } from './docs';
import { opCommands, opInit, opRenderSvg, opReplace, opSetMeta, opSnapshot, opValidate, type SvgOpts } from './ops';

export interface DocHost {
  /** Contenido inicial de un espacio recién creado (vacío con nombre o un Workspace completo). */
  init(id: string, name: string, initial: Workspace | null): Promise<void>;
  snapshot(id: string): Promise<Workspace>;
  replace(id: string, ws: Workspace): Promise<void>;
  setMeta(id: string, patch: Partial<WorkspaceMeta>): Promise<void>;
  /** Aplica comandos normalizados; lanza `CommandError` (422) si alguno no se puede aplicar. Devuelve el inverso. */
  commands(id: string, commands: Command[], label?: string): Promise<Command>;
  validate(id: string): Promise<Diagnostic[]>;
  /** `null` si la vista no existe. */
  renderSvg(id: string, viewId: string, opts: SvgOpts): Promise<string | null>;
  /** El espacio se borra: cierra conexiones (4410) y olvida el doc. */
  drop(id: string): Promise<void>;
}

export class LocalDocHost implements DocHost {
  constructor(readonly docs: DocManager) {}
  init(id: string, name: string, initial: Workspace | null) { return this.docs.withStore(id, s => opInit(s, name, initial)); }
  snapshot(id: string) { return this.docs.withStore(id, opSnapshot); }
  replace(id: string, ws: Workspace) { return this.docs.withStore(id, s => opReplace(s, ws)); }
  setMeta(id: string, patch: Partial<WorkspaceMeta>) { return this.docs.withStore(id, s => opSetMeta(s, patch)); }
  commands(id: string, commands: Command[], label?: string) { return this.docs.withStore(id, s => opCommands(s, commands, label)); }
  validate(id: string) { return this.docs.withStore(id, opValidate); }
  renderSvg(id: string, viewId: string, opts: SvgOpts) { return this.docs.withStore(id, s => opRenderSvg(s, viewId, opts)); }
  async drop(id: string) {
    if (!this.docs.has(id)) return;
    const d = await this.docs.get(id);
    d.closeConnections(4410, 'espacio borrado');
    d.conns.clear();
    await this.docs.unload(id);
  }
}
