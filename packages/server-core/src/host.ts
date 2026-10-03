/**
 * `DocHost`: lo que la API REST necesita del contenido de los espacios, expresado como
 * operaciones con datos (no callbacks) para que pueda estar en el mismo proceso (`LocalDocHost`,
 * sobre un `DocManager`) o en otro isolate (el worker de Cloudflare lo reenvía a un Durable Object).
 */
import type { Command, Diagnostic, Workspace, WorkspaceMeta } from '@all-draw/core';
import type { ConnMatch, DocManager } from './docs';
import { WS_DELETED, revokeConnections } from './ysync';
import { opCommands, opInit, opRenderSvg, opReplace, opSetMeta, opSnapshot, opValidate, type SvgOpts } from './ops';
import type { SnapshotMeta } from './store/types';

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
  /**
   * Cierra con `code` las conexiones WebSocket abiertas a este espacio por ese usuario o enlace (4401 acceso revocado,
   * 4205 cambio de rol). Devuelve cuántas cerró. No abre el doc si no está cargado (sin conexiones no hay nada que cerrar).
   */
  revoke(id: string, match: ConnMatch, code: number, reason: string): Promise<number>;

  // Historial de versiones (instantáneas del doc; viven junto al doc: BD en Node, storage del DO en Cloudflare)
  listSnapshots(id: string): Promise<SnapshotMeta[]>;
  createSnapshot(id: string, authorId: string | null, label: string | null): Promise<SnapshotMeta>;
  /** Workspace JSON de la instantánea; `null` si no existe. */
  getSnapshot(id: string, sid: string): Promise<Workspace | null>;
  /** Aplica la instantánea al doc vivo (guardando antes una automática); devuelve el Workspace restaurado o `null`. */
  restoreSnapshot(id: string, sid: string, authorId: string | null): Promise<Workspace | null>;
  deleteSnapshot(id: string, sid: string): Promise<boolean>;
}

export class LocalDocHost implements DocHost {
  constructor(readonly docs: DocManager) {}
  init(id: string, name: string, initial: Workspace | null) { return this.docs.withStore(id, s => opInit(s, name, initial)); }
  snapshot(id: string) { return this.docs.withStore(id, opSnapshot); }
  // Las escrituras comprueban antes la cuota `MAX_DOC_BYTES` (`LiveDoc.assertWritable` → 413).
  replace(id: string, ws: Workspace) { return this.docs.withStore(id, (s, live) => { live.assertWritable(); opReplace(s, ws); }); }
  setMeta(id: string, patch: Partial<WorkspaceMeta>) { return this.docs.withStore(id, s => opSetMeta(s, patch)); }
  commands(id: string, commands: Command[], label?: string) { return this.docs.withStore(id, (s, live) => { live.assertWritable(); return opCommands(s, commands, label); }); }
  validate(id: string) { return this.docs.withStore(id, opValidate); }
  renderSvg(id: string, viewId: string, opts: SvgOpts) { return this.docs.withStore(id, s => opRenderSvg(s, viewId, opts)); }
  async drop(id: string) {
    if (!this.docs.has(id)) return;
    const d = await this.docs.get(id);
    d.closeConnections(WS_DELETED, 'espacio borrado');
    d.conns.clear();
    await this.docs.unload(id);
  }

  async revoke(id: string, match: ConnMatch, code: number, reason: string) {
    if (!this.docs.has(id)) return 0;
    return revokeConnections(await this.docs.get(id), match, code, reason);
  }

  async listSnapshots(id: string) { return (await this.docs.get(id)).listSnapshots(); }
  async createSnapshot(id: string, authorId: string | null, label: string | null) { return (await this.docs.get(id)).createSnapshot(authorId, label); }
  async getSnapshot(id: string, sid: string) { return (await this.docs.get(id)).snapshotWorkspace(sid); }
  async restoreSnapshot(id: string, sid: string, authorId: string | null) {
    const d = await this.docs.get(id);
    d.assertWritable();
    const ws = await d.restoreSnapshot(sid, authorId);
    if (ws) { d.touch(); void d.flush(); }
    return ws;
  }
  async deleteSnapshot(id: string, sid: string) { return (await this.docs.get(id)).deleteSnapshot(sid); }
}
