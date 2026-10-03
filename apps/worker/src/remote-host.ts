/** `DocHost` que reenvía cada operación al Durable Object del espacio (`WorkspaceDO`). */
import type { Command, Diagnostic, Workspace, WorkspaceMeta } from '@all-draw/core';
import { CommandError, type DocHost, type SnapshotMeta, type SvgOpts } from '@all-draw/server-core';

export class RemoteDocHost implements DocHost {
  constructor(private ns: DurableObjectNamespace) {}

  private stub(id: string) { return this.ns.get(this.ns.idFromName(id)); }
  private async call<T>(id: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.stub(id).fetch(new Request(`https://do${path}`, { method, headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }));
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('application/json') ? await res.json() as Record<string, unknown> : { text: await res.text() };
    if (!res.ok) {
      if (res.status === 400 || res.status === 413 || res.status === 422) {
        const { error, issues, ...extra } = data;
        throw new CommandError(res.status, String(error ?? 'error'), issues as unknown[] | undefined, extra);
      }
      if (res.status === 404) return null as T;
      throw new Error(`DO ${path}: ${res.status} ${String(data.error ?? data.text ?? '')}`);
    }
    return data as T;
  }

  async init(id: string, name: string, initial: Workspace | null) { await this.call(id, 'POST', '/init', { name, initial }); }
  snapshot(id: string) { return this.call<Workspace>(id, 'GET', '/snapshot'); }
  async replace(id: string, ws: Workspace) { await this.call(id, 'PUT', '/snapshot', ws); }
  async setMeta(id: string, patch: Partial<WorkspaceMeta>) { await this.call(id, 'POST', '/meta', { patch }); }
  async commands(id: string, commands: Command[], label?: string) { return (await this.call<{ inverse: Command }>(id, 'POST', '/commands', { commands, label })).inverse; }
  async validate(id: string) { return (await this.call<{ diagnostics: Diagnostic[] }>(id, 'GET', '/validate')).diagnostics; }
  async renderSvg(id: string, viewId: string, opts: SvgOpts) {
    const q = new URLSearchParams({ viewId, ...(opts.theme ? { theme: opts.theme } : {}), ...(opts.padding !== undefined ? { padding: String(opts.padding) } : {}) });
    const r = await this.call<{ text: string } | null>(id, 'GET', `/svg?${q}`);
    return r ? r.text : null;
  }
  async drop(id: string) { await this.call(id, 'POST', '/drop'); }

  async listSnapshots(id: string) { return (await this.call<{ snapshots: SnapshotMeta[] }>(id, 'GET', '/snapshots')).snapshots; }
  createSnapshot(id: string, authorId: string | null, label: string | null) { return this.call<SnapshotMeta>(id, 'POST', '/snapshots', { authorId, label }); }
  getSnapshot(id: string, sid: string) { return this.call<Workspace | null>(id, 'GET', `/snapshots/${encodeURIComponent(sid)}`); }
  restoreSnapshot(id: string, sid: string, authorId: string | null) { return this.call<Workspace | null>(id, 'POST', `/snapshots/${encodeURIComponent(sid)}/restore`, { authorId }); }
  async deleteSnapshot(id: string, sid: string) { return (await this.call<{ ok: true } | null>(id, 'DELETE', `/snapshots/${encodeURIComponent(sid)}`)) !== null; }
}
