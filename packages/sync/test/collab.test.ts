// @vitest-environment node
/**
 * Formato de registros 2 (`Y.Map` por registro, bolsas `Y.Map`, textos largos `Y.Text`): fusión de ediciones
 * simultáneas, deshacer, compatibilidad y migración perezosa de documentos en formato 1 (registros JSON planos).
 */
import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import * as awarenessProtocol from 'y-protocols/awareness';
import {
  COLLECTIONS, execute, exampleWorkspace, generateLargeWorkspace, loadInto, makeComment, makeElement, makeNode, makeView, parseWorkspace,
  type Workspace,
} from '@all-draw/core';
import {
  YjsStore, YjsHistory, diffWorkspaces, isEmptyDiff, isLegacyRecord, jsonEqual, migrateRecords, onNotices, publishNotice, replaceInto, textDiff,
} from '../src';

/** JSON con claves ordenadas, para comparar sin depender del orden de inserción. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, (x as Record<string, unknown>)[k]])) : x);
}
/** Sincroniza en las dos direcciones cada par de docs (como hace el servidor). */
function syncAll(...docs: Y.Doc[]) {
  for (const a of docs) for (const b of docs) if (a !== b) Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)), 'remote-test');
}
function replicas(n: number, ws: Workspace = exampleWorkspace()): YjsStore[] {
  const first = new YjsStore(); loadInto(first, ws);
  const out = [first];
  for (let i = 1; i < n; i++) { const s = new YjsStore(); Y.applyUpdate(s.doc, Y.encodeStateAsUpdate(first.doc)); out.push(s); }
  return out;
}
/** Documento en formato 1, escrito como lo hacía el `YjsStore` anterior: un objeto JSON por registro. */
function legacyDoc(ws: Workspace): Y.Doc {
  const d = new Y.Doc();
  d.transact(() => {
    for (const c of COLLECTIONS) for (const [id, v] of Object.entries(ws[c])) d.getMap(c).set(id, structuredClone(v));
    for (const [k, v] of Object.entries(ws.meta)) if (v !== undefined) d.getMap('meta').set(k, v);
  });
  return d;
}
/** Lo que leía el `YjsStore` anterior de un doc en formato 1. */
function legacyRead(d: Y.Doc): Workspace {
  const raw: Record<string, unknown> = { meta: Object.fromEntries(d.getMap('meta').entries()) };
  for (const c of COLLECTIONS) raw[c] = Object.fromEntries(d.getMap(c).entries());
  return parseWorkspace(structuredClone(raw));
}

describe('contrato Store con registros Y.Map', () => {
  it('get devuelve lo escrito (con los vacíos por defecto repuestos) y mantiene la identidad hasta que cambia', () => {
    const s = new YjsStore();
    const a = makeElement('freeform:box', 'A', { fields: { prioridad: 'alta', notas: 'línea 1\nlínea 2' }, props: { owner: 'Ana' }, tags: ['x'] });
    s.set('elements', a.id, a);
    expect(s.get('elements', a.id)).toEqual(a);
    const first = s.get('elements', a.id);
    expect(s.get('elements', a.id)).toBe(first);
    expect(s.list('elements')[0]).toBe(first);
    s.set('elements', a.id, { ...a, name: 'A2' });
    expect(s.get('elements', a.id)).not.toBe(first);
    expect(s.get('elements', a.id)).toEqual({ ...a, name: 'A2' });
    // Los vacíos no se guardan pero se reponen
    const raw = s.maps.elements.get(a.id) as Y.Map<unknown>;
    expect(raw).toBeInstanceOf(Y.Map);
    expect(raw.has('ports')).toBe(false);
    expect(raw.has('id')).toBe(false);
    expect(raw.get('fields')).toBeInstanceOf(Y.Map);
    expect((raw.get('fields') as Y.Map<unknown>).get('notas')).toBeInstanceOf(Y.Text); // texto con saltos de línea
    expect((raw.get('fields') as Y.Map<unknown>).get('prioridad')).toBe('alta');
  });

  it('set solo toca lo que cambia: escribir lo mismo no genera update; un campo cambiado, un update pequeño', () => {
    const [s] = replicas(1);
    const updates: Uint8Array[] = [];
    s!.doc.on('update', (u: Uint8Array) => updates.push(u));
    const el = s!.get('elements', 'el_alta')!;
    s!.set('elements', 'el_alta', structuredClone(el));
    expect(updates).toHaveLength(0);
    loadInto(s!, s!.snapshot()); // loadInto con el mismo contenido: nada
    expect(updates).toHaveLength(0);
    s!.set('elements', 'el_alta', { ...el, name: 'Otro nombre' });
    expect(updates).toHaveLength(1);
    expect(updates[0]!.byteLength).toBeLessThan(80);
  });

  it('un documento de texto se edita con un diff mínimo (Y.Text)', () => {
    const s = new YjsStore();
    const el = makeElement('freeform:box', 'A', { doc: 'Hola mundo' });
    s.set('elements', el.id, el);
    const text = (s.maps.elements.get(el.id) as Y.Map<unknown>).get('doc') as Y.Text;
    const deltas: unknown[] = [];
    text.observe(ev => deltas.push(ev.delta));
    s.set('elements', el.id, { ...el, doc: 'Hola, mundo' });
    expect(deltas).toEqual([[{ retain: 4 }, { insert: ',' }]]);
    // Vaciarlo no quita el Y.Text (quien esté escribiendo en él no pierde nada)
    s.set('elements', el.id, { ...el, doc: '' });
    expect((s.maps.elements.get(el.id) as Y.Map<unknown>).get('doc')).toBe(text);
    expect(s.get('elements', el.id)!.doc).toBe('');
  });

  it('textDiff: prefijo y sufijo comunes, sin partir emoji', () => {
    expect(textDiff('abc', 'abc')).toBeNull();
    expect(textDiff('abc', 'abXc')).toEqual({ index: 2, remove: 0, insert: 'X' });
    expect(textDiff('aaaa', 'aaa')).toEqual({ index: 3, remove: 1, insert: '' });
    expect(textDiff('hola', 'adiós')).toEqual({ index: 0, remove: 4, insert: 'adiós' });
    const d = textDiff('x😀y', 'x😃y')!; // mismo sustituto alto: no se parte el par
    expect(d.insert).toBe('😃');
    expect('x😀y'.slice(0, d.index) + d.insert + 'x😀y'.slice(d.index + d.remove)).toBe('x😃y');
  });

  it('delete + set del mismo registro en una transacción hace diff (loadInto conserva el Y.Map)', () => {
    const [s] = replicas(1);
    const before = s!.maps.elements.get('el_alta');
    const ws = s!.snapshot();
    ws.elements['el_alta']!.name = 'Cambiado';
    delete ws.elements['el_crm'];
    loadInto(s!, ws);
    expect(s!.maps.elements.get('el_alta')).toBe(before);
    expect(s!.get('elements', 'el_alta')!.name).toBe('Cambiado');
    expect(s!.get('elements', 'el_crm')).toBeUndefined();
    expect(stable(s!.snapshot())).toBe(stable(parseWorkspace(ws)));
    // dentro de la transacción, lo borrado ya no se ve
    s!.transact(() => {
      s!.delete('elements', 'el_alta');
      expect(s!.get('elements', 'el_alta')).toBeUndefined();
      expect(s!.ids('elements')).not.toContain('el_alta');
      expect(s!.list('elements').some(e => e.id === 'el_alta')).toBe(false);
    });
    expect(s!.maps.elements.has('el_alta')).toBe(false);
  });

  it('replaceInto deja el contenido igual que loadInto', () => {
    const [s] = replicas(1);
    const target = parseWorkspace(generateLargeWorkspace({ elements: 30, views: 3, perView: 10 }));
    replaceInto(s!, target);
    const t = new YjsStore(); loadInto(t, target);
    expect(stable(s!.snapshot())).toBe(stable(t.snapshot()));
  });
});

describe('ediciones simultáneas', () => {
  it('dos docs: campos distintos del mismo elemento se conservan todos', () => {
    const [a, b] = replicas(2);
    const el = a!.get('elements', 'el_alta')!;
    a!.set('elements', 'el_alta', { ...el, name: 'Alta de cliente' });
    b!.set('elements', 'el_alta', { ...el, doc: 'Documentación nueva', props: { ...el.props, dueño: 'Luis' }, fields: { ...el.fields, sla: '24h' } });
    syncAll(a!.doc, b!.doc);
    for (const s of [a!, b!]) {
      const r = s.get('elements', 'el_alta')!;
      expect(r.name).toBe('Alta de cliente');
      expect(r.doc).toBe('Documentación nueva');
      expect(r.props['dueño']).toBe('Luis');
      expect(r.fields['sla']).toBe('24h');
    }
    expect(stable(a!.snapshot())).toBe(stable(b!.snapshot()));
  });

  it('tres docs: nombre, documentación, campos, estilo y posición del mismo elemento/nodo', () => {
    const [a, b, c] = replicas(3);
    const el = a!.get('elements', 'el_alta')!;
    const node = a!.list('nodes').find(n => n.elementId === 'el_alta')!;
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'Nombre de A' } });
    execute(b!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { fields: { owner: 'B' }, props: { nivel: '2' } } });
    execute(c!, { type: 'batch', commands: [
      { type: 'patch', collection: 'elements', id: 'el_alta', patch: { tags: ['c'], fields: { coste: '3' } } },
      { type: 'moveNodes', moves: [{ id: node.id, x: 999, y: 111 }] },
    ] });
    execute(a!, { type: 'patch', collection: 'nodes', id: node.id, patch: { style: { fill: '#f00' } } });
    execute(b!, { type: 'patch', collection: 'nodes', id: node.id, patch: { w: 300 } });
    syncAll(a!.doc, b!.doc, c!.doc);
    const want = { ...el, name: 'Nombre de A', fields: { ...el.fields, owner: 'B', coste: '3' }, props: { ...el.props, nivel: '2' }, tags: ['c'] };
    for (const s of [a!, b!, c!]) {
      expect(stable(s.get('elements', 'el_alta'))).toEqual(stable(want));
      expect(s.get('nodes', node.id)).toMatchObject({ x: 999, y: 111, w: 300, style: { ...node.style, fill: '#f00' } });
    }
    expect(stable(b!.snapshot())).toBe(stable(a!.snapshot()));
    expect(stable(c!.snapshot())).toBe(stable(a!.snapshot()));
  });

  it('dos ediciones en el mismo doc (texto largo) se fusionan carácter a carácter', () => {
    const [a, b] = replicas(2);
    const el = a!.get('elements', 'el_alta')!;
    a!.set('elements', el.id, { ...el, doc: 'Primera línea.\nSegunda línea.' });
    syncAll(a!.doc, b!.doc);
    // A escribe al principio, B al final, a la vez
    execute(a!, { type: 'patch', collection: 'elements', id: el.id, patch: { doc: 'IMPORTANTE: Primera línea.\nSegunda línea.' } });
    execute(b!, { type: 'patch', collection: 'elements', id: el.id, patch: { doc: 'Primera línea.\nSegunda línea.\nTercera de B.' } });
    syncAll(a!.doc, b!.doc);
    expect(a!.get('elements', el.id)!.doc).toBe('IMPORTANTE: Primera línea.\nSegunda línea.\nTercera de B.');
    expect(b!.get('elements', el.id)!.doc).toBe(a!.get('elements', el.id)!.doc);
  });

  it('textos de notas, comentarios y campos textarea también se fusionan', () => {
    const [a, b] = replicas(2);
    a!.textFields = b!.textFields = (c, rec) => (c === 'elements' && rec.typeId === 'freeform:box' ? ['resumen'] : undefined);
    const note = makeNode('vw_1', undefined, { x: 0, y: 0 }, { visualType: 'core:note', text: 'nota' });
    const cm = makeComment({ kind: 'view', id: 'vw_1', viewId: 'vw_1' }, { name: 'Ana' }, 'comentario');
    const box = makeElement('freeform:box', 'Caja', { fields: { resumen: 'medio' } });
    execute(a!, { type: 'batch', commands: [
      { type: 'set', collection: 'nodes', id: note.id, value: note },
      { type: 'set', collection: 'comments', id: cm.id, value: cm },
      { type: 'set', collection: 'elements', id: box.id, value: box },
    ] });
    syncAll(a!.doc, b!.doc);
    execute(a!, { type: 'batch', commands: [
      { type: 'patch', collection: 'nodes', id: note.id, patch: { text: 'una nota' } },
      { type: 'patch', collection: 'comments', id: cm.id, patch: { text: 'un comentario' } },
      { type: 'patch', collection: 'elements', id: box.id, patch: { fields: { resumen: 'al medio' } } },
    ] });
    execute(b!, { type: 'batch', commands: [
      { type: 'patch', collection: 'nodes', id: note.id, patch: { text: 'nota larga' } },
      { type: 'patch', collection: 'comments', id: cm.id, patch: { text: 'comentario editado' } },
      { type: 'patch', collection: 'elements', id: box.id, patch: { fields: { resumen: 'medio día' } } },
    ] });
    syncAll(a!.doc, b!.doc);
    for (const s of [a!, b!]) {
      expect(s.get('nodes', note.id)!.text).toBe('una nota larga');
      expect(s.get('comments', cm.id)!.text).toBe('un comentario editado');
      expect(s.get('elements', box.id)!.fields['resumen']).toBe('al medio día');
    }
  });

  it('extremos de una arista: van juntos (gana uno entero); estilo y etiqueta se fusionan aparte', () => {
    const [a, b] = replicas(2);
    const edge = a!.list('edges')[0]!;
    const nodes = a!.list('nodes').filter(n => n.viewId === edge.viewId && n.id !== edge.fromNodeId && n.id !== edge.toNodeId);
    const raw = a!.maps.edges.get(edge.id) as Y.Map<unknown>;
    expect(raw.get('$')).toMatchObject({ viewId: edge.viewId, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId });
    expect(raw.has('fromNodeId')).toBe(false);
    if (!nodes.length) return;
    execute(a!, { type: 'patch', collection: 'edges', id: edge.id, patch: { toNodeId: nodes[0]!.id, label: 'de A' } });
    execute(b!, { type: 'patch', collection: 'edges', id: edge.id, patch: { fromNodeId: nodes[0]!.id, style: { color: '#0a0' } } });
    syncAll(a!.doc, b!.doc);
    const got = a!.get('edges', edge.id)!;
    expect(b!.get('edges', edge.id)).toEqual(got);
    expect(got.label).toBe('de A');
    expect(got.style.color).toBe('#0a0');
    // los extremos son los de A o los de B, nunca una mezcla
    const fromA = got.toNodeId === nodes[0]!.id && got.fromNodeId === edge.fromNodeId;
    const fromB = got.fromNodeId === nodes[0]!.id && got.toNodeId === edge.toNodeId;
    expect(fromA || fromB).toBe(true);
  });

  it('el mismo campo atómico: gana uno (el mismo en todos)', () => {
    const [a, b] = replicas(2);
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'De A' } });
    execute(b!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'De B' } });
    syncAll(a!.doc, b!.doc);
    expect(['De A', 'De B']).toContain(a!.get('elements', 'el_alta')!.name);
    expect(b!.get('elements', 'el_alta')!.name).toBe(a!.get('elements', 'el_alta')!.name);
  });

  it('editar un registro que otro borra a la vez: queda borrado en todos', () => {
    const [a, b] = replicas(2);
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_crm', patch: { name: 'CRM 2' } });
    execute(b!, { type: 'deleteElement', id: 'el_crm' });
    syncAll(a!.doc, b!.doc);
    expect(a!.get('elements', 'el_crm')).toBeUndefined();
    expect(stable(a!.snapshot())).toBe(stable(b!.snapshot()));
  });

  it('el StoreChange de un cambio remoto anidado lleva el id del registro y origen remote', () => {
    const [a, b] = replicas(2);
    const changes: { collection: string; ids: string[]; origin: string }[] = [];
    b!.subscribe(ch => changes.push(ch));
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { doc: 'texto', props: { k: 'v' } } });
    Y.applyUpdate(b!.doc, Y.encodeStateAsUpdate(a!.doc, Y.encodeStateVector(b!.doc)), {});
    expect(changes).toEqual([{ collection: 'elements', ids: ['el_alta'], origin: 'remote' }]);
    expect(b!.get('elements', 'el_alta')!.props['k']).toBe('v');
  });
});

describe('deshacer', () => {
  it('un paso por comando, también con cambios anidados y de texto', () => {
    const [s] = replicas(1);
    const h = new YjsHistory(s!);
    const before = stable(s!.snapshot());
    h.run({ type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'X', doc: 'doc nuevo', fields: { a: '1' } } });
    h.run({ type: 'moveNodes', moves: s!.list('nodes').map(n => ({ id: n.id, x: n.x + 10, y: n.y })) });
    expect(h.undo()).toBe(true);
    expect(s!.get('elements', 'el_alta')!.name).toBe('X');
    expect(h.undo()).toBe(true);
    expect(stable(s!.snapshot())).toBe(before);
    expect(h.canUndo).toBe(false);
    h.redo();
    expect(s!.get('elements', 'el_alta')).toMatchObject({ name: 'X', doc: 'doc nuevo', fields: { a: '1' } });
  });

  it('deshacer tras una edición remota en otro campo del mismo registro no pisa lo remoto', () => {
    const [a, b] = replicas(2);
    const h = new YjsHistory(a!);
    const oldName = a!.get('elements', 'el_alta')!.name;
    h.run({ type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'Nombre local' } });
    syncAll(a!.doc, b!.doc);
    execute(b!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { doc: 'Doc remoto', props: { r: '1' } } });
    syncAll(a!.doc, b!.doc);
    expect(h.undo()).toBe(true);
    syncAll(a!.doc, b!.doc);
    for (const s of [a!, b!]) expect(s.get('elements', 'el_alta')).toMatchObject({ name: oldName, doc: 'Doc remoto', props: { r: '1' } });
  });

  it('deshacer una escritura en un texto conserva lo que otro escribió en el mismo texto', () => {
    const [a, b] = replicas(2);
    a!.set('elements', 'el_alta', { ...a!.get('elements', 'el_alta')!, doc: 'base' });
    syncAll(a!.doc, b!.doc);
    const h = new YjsHistory(a!);
    h.run({ type: 'patch', collection: 'elements', id: 'el_alta', patch: { doc: 'base local' } });
    execute(b!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { doc: 'remoto base' } });
    syncAll(a!.doc, b!.doc);
    expect(a!.get('elements', 'el_alta')!.doc).toBe('remoto base local');
    h.undo();
    syncAll(a!.doc, b!.doc);
    expect(b!.get('elements', 'el_alta')!.doc).toBe('remoto base');
  });
});

describe('compatibilidad con el formato 1 (registros JSON)', () => {
  const fixtures: [string, () => Workspace][] = [
    ['ejemplo', () => exampleWorkspace()],
    ['grande (200 elementos)', () => generateLargeWorkspace({ elements: 200, views: 8, perView: 40 })],
    ['registros sin normalizar', () => {
      const ws = exampleWorkspace();
      // Como los de un import antiguo: faltan campos con valor por defecto y hay claves de más.
      const el = ws.elements['el_alta'] as unknown as Record<string, unknown>;
      delete el.ports; delete el.tags; el.extra = { libre: true };
      ws.views[makeView('Vista suelta').id] = { ...makeView('Vista suelta'), id: Object.keys(ws.views)[0]! };
      return ws;
    }],
  ];

  for (const [name, make] of fixtures) {
    it(`${name}: se lee igual que antes, migra perezosamente y converge con un cliente nuevo`, () => {
      const ws = make();
      const old = legacyDoc(ws);
      const expected = stable(legacyRead(old));
      // Otra réplica del mismo documento antiguo (como la copia local de otro navegador)
      const other = new YjsStore(); Y.applyUpdate(other.doc, Y.encodeStateAsUpdate(old));
      // Lectura: idéntica a la del store anterior
      const s = new YjsStore(old);
      expect(stable(s.snapshot())).toBe(expected);
      const total = COLLECTIONS.reduce((n, c) => n + s.ids(c).length, 0);
      expect(s.legacyCount()).toBe(total);
      // Primer cambio de un registro: solo ese pasa al formato nuevo
      const anyEl = s.ids('elements')[0]!;
      execute(s, { type: 'patch', collection: 'elements', id: anyEl, patch: { name: 'Migrado' } });
      expect(isLegacyRecord(s.maps.elements.get(anyEl))).toBe(false);
      expect(s.legacyCount()).toBe(total - 1);
      // La otra réplica edita a la vez otro registro: convergen
      const anyNode = other.ids('nodes')[0];
      if (anyNode) execute(other, { type: 'moveNodes', moves: [{ id: anyNode, x: 7, y: 7 }] });
      syncAll(old, other.doc);
      expect(stable(other.snapshot())).toBe(stable(s.snapshot()));
      expect(s.get('elements', anyEl)!.name).toBe('Migrado');
      if (anyNode) expect(s.get('nodes', anyNode)).toMatchObject({ x: 7, y: 7 });
      // Migración completa: mismo contenido, nada en formato 1
      const before = stable(s.snapshot());
      const left = s.legacyCount();
      expect(migrateRecords(s)).toBe(left);
      expect(s.legacyCount()).toBe(0);
      expect(stable(s.snapshot())).toBe(before);
      // Ida y vuelta por un update completo
      const again = new YjsStore(); Y.applyUpdate(again.doc, Y.encodeStateAsUpdate(s.doc));
      expect(stable(again.snapshot())).toBe(before);
    });
  }

  it('un cliente antiguo que reescribe un registro migrado (JSON entero) no rompe la lectura', () => {
    const [a] = replicas(1);
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { name: 'Nuevo' } });
    const legacy = new Y.Doc(); Y.applyUpdate(legacy, Y.encodeStateAsUpdate(a!.doc));
    // Lo que haría el YjsStore anterior: el registro entero como JSON
    legacy.getMap('elements').set('el_alta', { ...exampleWorkspace().elements['el_alta']!, name: 'Del cliente viejo' });
    syncAll(a!.doc, legacy);
    expect(a!.get('elements', 'el_alta')!.name).toBe('Del cliente viejo');
    expect(isLegacyRecord(a!.maps.elements.get('el_alta'))).toBe(true);
    execute(a!, { type: 'patch', collection: 'elements', id: 'el_alta', patch: { doc: 'otra vez nuevo' } });
    expect(isLegacyRecord(a!.maps.elements.get('el_alta'))).toBe(false);
    expect(a!.get('elements', 'el_alta')).toMatchObject({ name: 'Del cliente viejo', doc: 'otra vez nuevo' });
  });

  // Copia de la base de datos de producción (cópiala antes: `cp ~/.alldraw-data/alldraw.sqlite /tmp/alldraw-mig/`).
  // No se versiona (son datos de usuarios): si no está, el test se salta.
  const REAL_DB = process.env.ALLDRAW_MIGRATION_DB ?? '/tmp/alldraw-mig/alldraw.sqlite';
  it.skipIf(!existsSync(REAL_DB))('documentos reales (copia de la base de datos): lectura idéntica, migración sin pérdidas', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(REAL_DB, { readOnly: true });
    const rows = db.prepare('SELECT workspace_id AS id, state FROM docs').all() as { id: string; state: Uint8Array }[];
    const updates = db.prepare('SELECT workspace_id AS id, data FROM doc_updates ORDER BY id').all() as { id: string; data: Uint8Array }[];
    db.close();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const d = new Y.Doc();
      Y.applyUpdate(d, row.state);
      for (const u of updates) if (u.id === row.id) Y.applyUpdate(d, u.data);
      const expected = stable(legacyRead(d));
      const s = new YjsStore(d);
      expect(stable(s.snapshot()), row.id).toBe(expected);
      migrateRecords(s);
      expect(s.legacyCount()).toBe(0);
      expect(stable(s.snapshot()), row.id).toBe(expected);
      const again = new YjsStore(); Y.applyUpdate(again.doc, Y.encodeStateAsUpdate(d));
      expect(stable(again.snapshot()), row.id).toBe(expected);
    }
  });
});

describe('resumen de diferencias', () => {
  it('añadidos, borrados y cambiados con nombres', () => {
    const before = exampleWorkspace();
    const after = structuredClone(before);
    after.elements['el_alta']!.name = 'Alta 2';
    after.elements['el_alta']!.doc = 'nuevo';
    delete after.elements['el_crm'];
    const nuevo = makeElement('freeform:box', 'Nuevo');
    after.elements[nuevo.id] = nuevo;
    const v = Object.keys(after.views)[0]!;
    const n = Object.values(after.nodes).find(x => x.viewId === v)!;
    after.nodes[n.id] = { ...n, x: n.x + 5 };
    const d = diffWorkspaces(before, after);
    expect(d.elements.added).toEqual([{ id: nuevo.id, name: 'Nuevo' }]);
    expect(d.elements.removed.map(x => x.id)).toEqual(['el_crm']);
    expect(d.elements.changed).toEqual([{ id: 'el_alta', name: 'Alta 2', keys: ['doc', 'name'], was: 'Proceso de alta' }]);
    expect(d.views.changed).toEqual([{ id: v, name: after.views[v]!.name, keys: ['content'] }]);
    expect(isEmptyDiff(d)).toBe(false);
    expect(isEmptyDiff(diffWorkspaces(before, structuredClone(before)))).toBe(true);
    expect(jsonEqual({ a: [1, { b: 2 }], c: undefined }, { a: [1, { b: 2 }] })).toBe(true);
  });
});

describe('avisos a los demás conectados (awareness)', () => {
  it('onNotices avisa una vez de cada aviso nuevo de otro cliente; no repite los ya publicados', () => {
    const d1 = new Y.Doc(), d2 = new Y.Doc(), d3 = new Y.Doc();
    const a1 = new Awareness(d1), a2 = new Awareness(d2), a3 = new Awareness(d3);
    const relay = (from: Awareness, to: Awareness[]) => from.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const u = awarenessProtocol.encodeAwarenessUpdate(from, added.concat(updated, removed));
      for (const t of to) awarenessProtocol.applyAwarenessUpdate(t, u, 'relay');
    });
    relay(a1, [a2]); relay(a2, [a1]);
    a1.setLocalStateField('name', 'Ana'); a2.setLocalStateField('name', 'Luis');
    const got: string[] = [];
    const off = onNotices(a2, (n, from) => got.push(`${from.name}:${n.kind}:${n.at}`));
    const mine: string[] = [];
    onNotices(a1, n => mine.push(n.id));
    publishNotice(a1, { kind: 'restore', at: '2026-10-01T10:00:00.000Z', by: 'Ana' });
    expect(got).toEqual(['Ana:restore:2026-10-01T10:00:00.000Z']);
    expect(mine).toEqual([]); // el propio no
    a1.setLocalStateField('cursor', { x: 1, y: 1 }); // otro cambio de presencia: no repite
    expect(got).toHaveLength(1);
    publishNotice(a1, { kind: 'restore', at: '2026-10-02T10:00:00.000Z' });
    expect(got).toHaveLength(2);
    // Quien llega después no ve los avisos ya publicados
    const late: string[] = [];
    onNotices(a3, n => late.push(n.id));
    awarenessProtocol.applyAwarenessUpdate(a3, awarenessProtocol.encodeAwarenessUpdate(a1, [a1.clientID]), 'relay');
    expect(late).toEqual([]);
    off();
    publishNotice(a1, { kind: 'restore', at: '2026-10-03T10:00:00.000Z' });
    expect(got).toHaveLength(2);
  });
});
