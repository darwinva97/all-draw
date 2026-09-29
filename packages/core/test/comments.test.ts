import { describe, it, expect } from 'vitest';
import {
  MemoryStore, History, execute, exampleWorkspace, parseWorkspace, migrate, makeComment, makeView, makeNode, makeEdge,
  threadsOf, threadsOfView, openThreadCount, commentThreads, validate, unresolvedComments, NotationRegistry, CORE_PACK,
  CommandSchema, SCHEMA_VERSION, type Comment, type CommentAnchor,
} from '../src';

const me = { name: 'Ana', userId: 'u1' };
const store = () => new MemoryStore(parseWorkspace(exampleWorkspace()));
let seq = 0;
/** Comentario con fecha creciente (el orden de los hilos depende de ella). */
function add(s: MemoryStore, anchor: CommentAnchor, text: string, extra: Partial<Comment> = {}): Comment {
  const c = makeComment(anchor, me, text, { createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)).toISOString(), ...extra });
  execute(s, { type: 'set', collection: 'comments', id: c.id, value: c });
  return c;
}

describe('comentarios: esquema', () => {
  it(`migra de la versión 1 a la ${SCHEMA_VERSION} creando comments`, () => {
    const ws = migrate({ ...exampleWorkspace(), comments: undefined, meta: { name: 'x', schemaVersion: 1 } });
    expect(ws.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(ws.comments).toEqual({});
  });
  it('conserva los comentarios existentes al migrar y valida el registro', () => {
    const c = makeComment({ kind: 'node', id: 'vn_1' }, me, 'hola');
    const ws = migrate({ ...exampleWorkspace(), comments: { [c.id]: c } });
    expect(ws.comments[c.id]!.text).toBe('hola');
    expect(ws.comments[c.id]!.mentions).toEqual([]);
  });
  it('CommandSchema acepta la colección comments', () => {
    const c = makeComment({ kind: 'view', id: 'vw_1' }, me, 'x');
    expect(CommandSchema.safeParse({ type: 'set', collection: 'comments', id: c.id, value: c }).success).toBe(true);
    expect(CommandSchema.safeParse({ type: 'patch', collection: 'comments', id: c.id, patch: { resolved: true } }).success).toBe(true);
  });
});

describe('comentarios: consultas', () => {
  it('agrupa hilos, respuestas en orden y el estado resuelto del primero', () => {
    const s = store();
    const root = add(s, { kind: 'node', id: 'vn_1' }, 'primero');
    add(s, root.anchor, 'respuesta', { threadId: root.id });
    add(s, { kind: 'element', id: 'el_crm' }, 'otro');
    const [th] = threadsOf(s, { kind: 'node', id: 'vn_1' });
    expect(th!.comments.map(c => c.text)).toEqual(['primero', 'respuesta']);
    expect(th!.resolved).toBe(false);
    expect(commentThreads(s)).toHaveLength(2);
    execute(s, { type: 'patch', collection: 'comments', id: root.id, patch: { resolved: true, resolvedBy: 'Ana' } });
    expect(threadsOf(s, { kind: 'node', id: 'vn_1' })[0]!.resolved).toBe(true);
    expect(openThreadCount(s)).toBe(1);
  });
  it('threadsOfView incluye vista, puntos, nodos, aristas y elementos/relaciones que aparecen en ella', () => {
    const s = store();
    add(s, { kind: 'view', id: 'vw_1', viewId: 'vw_1' }, 'vista');
    add(s, { kind: 'point', viewId: 'vw_1', x: 10, y: 20 }, 'punto');
    add(s, { kind: 'node', id: 'vn_2' }, 'nodo');
    add(s, { kind: 'edge', id: 've_1' }, 'arista');
    add(s, { kind: 'element', id: 'el_alta' }, 'elemento');   // aparece en vw_1 y vw_2
    add(s, { kind: 'relation', id: 'rel_1' }, 'relación');
    add(s, { kind: 'point', viewId: 'vw_2', x: 0, y: 0 }, 'otra vista');
    expect(threadsOfView(s, 'vw_1').map(t => t.root.text).sort()).toEqual(['arista', 'elemento', 'nodo', 'punto', 'relación', 'vista']);
    expect(threadsOfView(s, 'vw_2').map(t => t.root.text).sort()).toEqual(['elemento', 'otra vista']);
    expect(threadsOf(s, { kind: 'point', viewId: 'vw_1' }).map(t => t.root.text)).toEqual(['punto']);
    expect(openThreadCount(s, 'vw_2')).toBe(2);
  });
  it('el validador opcional comment-unresolved informa de los hilos abiertos', () => {
    const s = store();
    const c = add(s, { kind: 'view', id: 'vw_1' }, 'pendiente');
    const reg = new NotationRegistry().register(CORE_PACK);
    const d = validate(s, reg, [unresolvedComments]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: 'comment-unresolved', severity: 'info', subject: { collection: 'comments', id: c.id } });
    execute(s, d[0]!.supportedFixes[0]!.command);
    expect(validate(s, reg, [unresolvedComments])).toEqual([]);
    expect(validate(s, reg).some(x => x.code === 'comment-unresolved')).toBe(false);
  });
});

describe('comentarios: borrar reancla (no se pierden)', () => {
  it('deleteNode lleva los hilos del nodo y de sus aristas a la vista', () => {
    const s = store();
    const onNode = add(s, { kind: 'node', id: 'vn_1' }, 'n');
    const onEdge = add(s, { kind: 'edge', id: 've_1' }, 'e');
    const other = add(s, { kind: 'node', id: 'vn_3' }, 'otro');
    execute(s, { type: 'deleteNode', id: 'vn_1' });
    expect(s.get('comments', onNode.id)!.anchor).toEqual({ kind: 'view', id: 'vw_1', viewId: 'vw_1' });
    expect(s.get('comments', onEdge.id)!.anchor).toEqual({ kind: 'view', id: 'vw_1', viewId: 'vw_1' });
    expect(s.get('comments', other.id)!.anchor).toEqual({ kind: 'node', id: 'vn_3' });
    expect(threadsOfView(s, 'vw_1')).toHaveLength(2);
  });
  it('deleteElement reancla los del elemento y los de sus nodos; undo lo deja como estaba', () => {
    const s = store();
    const h = new History(s);
    const onEl = add(s, { kind: 'element', id: 'el_alta' }, 'el');
    const reply = add(s, { kind: 'element', id: 'el_alta' }, 'resp', { threadId: onEl.id });
    const onNode = add(s, { kind: 'node', id: 'vn_3' }, 'n3');
    const before = s.snapshot();
    h.run({ type: 'deleteElement', id: 'el_alta' });
    expect(s.get('elements', 'el_alta')).toBeUndefined();
    expect(s.list('comments')).toHaveLength(3);
    expect(s.get('comments', onEl.id)!.anchor.kind).toBe('view');
    expect(s.get('comments', onEl.id)!.anchor.id).toMatch(/^vw_/);
    expect(s.get('comments', reply.id)!.anchor).toEqual(s.get('comments', onEl.id)!.anchor);
    expect(s.get('comments', onNode.id)!.anchor).toEqual({ kind: 'view', id: 'vw_2', viewId: 'vw_2' });
    h.undo();
    expect(s.snapshot()).toEqual(before);
    h.redo();
    expect(s.get('comments', onNode.id)!.anchor.kind).toBe('view');
  });
  it('deleteRelation reancla los de la relación a una vista donde estaba dibujada', () => {
    const s = store();
    const c = add(s, { kind: 'relation', id: 'rel_1' }, 'r');
    execute(s, { type: 'deleteRelation', id: 'rel_1' });
    expect(s.get('comments', c.id)!.anchor).toEqual({ kind: 'view', id: 'vw_1', viewId: 'vw_1' });
  });
  it('deleteView deja los hilos de la vista sin ancla (kind view sin id)', () => {
    const s = store();
    const h = new History(s);
    const v = makeView('Temporal');
    const n = makeNode(v.id, 'el_crm', { x: 0, y: 0 });
    const n2 = makeNode(v.id, 'el_alta', { x: 200, y: 0 });
    const e = makeEdge(v.id, 'rel_1', n2.id, n.id);
    h.run({ type: 'batch', commands: [
      { type: 'set', collection: 'views', id: v.id, value: v }, { type: 'set', collection: 'nodes', id: n.id, value: n },
      { type: 'set', collection: 'nodes', id: n2.id, value: n2 }, { type: 'set', collection: 'edges', id: e.id, value: e },
    ] });
    const cs = [
      add(s, { kind: 'view', id: v.id, viewId: v.id }, 'v'),
      add(s, { kind: 'point', viewId: v.id, x: 1, y: 2 }, 'p'),
      add(s, { kind: 'node', id: n.id }, 'n'),
      add(s, { kind: 'edge', id: e.id }, 'e'),
    ];
    const keep = add(s, { kind: 'element', id: 'el_crm' }, 'el');
    const before = s.snapshot();
    h.run({ type: 'deleteView', id: v.id });
    for (const c of cs) expect(s.get('comments', c.id)!.anchor).toEqual({ kind: 'view' });
    expect(s.get('comments', keep.id)!.anchor).toEqual({ kind: 'element', id: 'el_crm' });
    expect(commentThreads(s)).toHaveLength(5);
    h.undo();
    expect(s.snapshot()).toEqual(before);
  });
});
