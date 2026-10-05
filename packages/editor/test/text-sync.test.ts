/**
 * Panel de texto en vivo: diff modelo ↔ texto (`computeSync`), geometría, conflictos, alcance de vista y mapeo de
 * posiciones del texto a registros (`text-sync.ts`).
 */
import { describe, it, expect } from 'vitest';
import { MemoryStore, History, execute, type Command, type Workspace, type ViewNode } from '@all-draw/core';
import { parseDsl } from '@all-draw/io';
import {
  panelText, readText, computeSync, scopeWorkspace, explicitGeometry, recordRanges, recordAt, selectionForRecord, recordsForSelection,
  mapOffset, explicitIdEdits, applyEdits, lineStarts, lineColOf, offsetOf, diffPatch, deepEqual, type TextScope,
} from '../src/text-sync';

const MODEL = `workspace "Tienda" {
  model {
    cliente = archimate:BusinessActor "Cliente" {
      doc "Compra"
    }
    web = archimate:ApplicationComponent "Web" {
      api = archimate:ApplicationInterface "API"
    }
    catalogo = archimate:ApplicationService "Catálogo"
    sirve = catalogo -> cliente : archimate:Serving "consulta"
    real = web -> catalogo : archimate:Realization
  }
  views {
    view mapa "Mapa" {
      notation archimate
      include cliente at 40, 40 size 160, 56 {
        style { "fill": "#fde68a" }
      }
      include web at 300, 40 size 400, 200 {
        include api at 20, 40 size 160, 56
      }
      include catalogo at 40, 300 size 160, 56
      edge sirve
      edge real via 500, 320
    }
    view otra "Otra" {
      notation archimate
      include cliente at 10, 10
      include catalogo at 300, 10
      edge sirve
    }
  }
}
`;
const WS: TextScope = { kind: 'workspace' };
const MAPA: TextScope = { kind: 'view', viewId: 'mapa' };

function model(): Workspace {
  const r = parseDsl(MODEL);
  expect(r.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  return r.workspace;
}
function run(cur: Workspace, commands: Command[]): Workspace {
  const s = new MemoryStore(structuredClone(cur));
  if (commands.length) execute(s, { type: 'batch', commands });
  return s.snapshot();
}
/** Edita el texto del panel con `fn` y sincroniza contra `cur` (o contra `remote` si el modelo cambió entretanto). */
function edit(cur: Workspace, scope: TextScope, fn: (text: string) => string, opts: { remote?: Workspace; positions?: boolean; keepMine?: boolean; sizeOf?: (n: ViewNode) => { w: number; h: number } } = {}) {
  const baseText = panelText(cur, scope, { positions: opts.positions });
  const base = readText(baseText, cur);
  const now = opts.remote ?? cur;
  const text = fn(baseText);
  const mine = readText(text, now);
  expect(mine.errors.map(e => `${e.line}:${e.col} ${e.message}`)).toEqual([]);
  const r = computeSync({ current: now, base, mine, scope, keepMine: opts.keepMine, sizeOf: opts.sizeOf });
  return { r, text, after: r.problems.length || r.conflicts.length ? now : run(now, r.commands) };
}
const kinds = (cmds: Command[]) => cmds.map(c => (c.type === 'meta' ? 'meta' : c.type === 'batch' ? 'batch' : `${c.type}:${c.collection}/${c.id}`));

describe('texto del panel', () => {
  it('todo el espacio: sin metainformación volátil y sin posiciones por defecto', () => {
    const ws = model();
    ws.meta.currentViewId = 'mapa'; ws.meta.updatedAt = '2026-10-05T00:00:00Z';
    const text = panelText(ws, WS);
    expect(text).not.toMatch(/current|updated|all-draw DSL/);
    expect(text).toContain('include cliente {');
    expect(text).not.toContain(' at 40');
    expect(panelText(ws, WS, { positions: true })).toContain('include cliente at 40, 40 size 160, 56');
  });

  it('una vista: la vista, sus elementos y las relaciones dibujadas (con sus extremos)', () => {
    const ws = model();
    const sub = scopeWorkspace(ws, { kind: 'view', viewId: 'otra' });
    expect(Object.keys(sub.views)).toEqual(['otra']);
    expect(Object.keys(sub.elements).sort()).toEqual(['catalogo', 'cliente']);
    expect(Object.keys(sub.relations)).toEqual(['sirve']);
    expect(Object.keys(sub.nodes).every(id => id.startsWith('otra.'))).toBe(true);
  });

  it('sin cambios no hay comandos (en los dos alcances, con y sin posiciones)', () => {
    const ws = model();
    for (const scope of [WS, MAPA]) for (const positions of [false, true]) {
      const { r } = edit(ws, scope, t => t, { positions });
      expect(r.commands).toEqual([]);
      expect(r.problems).toEqual([]);
      expect(r.conflicts).toEqual([]);
    }
  });
});

describe('diff modelo ↔ texto', () => {
  it('renombrar (nombre): un patch del nombre; posiciones y estilos intactos', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.replace('"Cliente"', '"Clienta"'));
    expect(kinds(r.commands)).toEqual(['patch:elements/cliente']);
    expect(r.commands[0]).toMatchObject({ patch: { name: 'Clienta' } });
    expect(after.elements.cliente!.name).toBe('Clienta');
    expect(after.nodes['mapa.cliente']).toEqual(ws.nodes['mapa.cliente']);
  });

  it('renombrar (id): los nodos del elemento renombrado heredan posición y tamaño; las relaciones se reapuntan', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.replace(/\bcliente\b/g, 'clienta'));
    expect(r.problems).toEqual([]);
    expect(after.elements.cliente).toBeUndefined();
    expect(after.elements.clienta).toMatchObject({ name: 'Cliente', doc: 'Compra' });
    expect(after.nodes['mapa.cliente']).toBeUndefined();
    expect(after.nodes['mapa.clienta']).toMatchObject({ x: 40, y: 40, w: 160, h: 56, style: { fill: '#fde68a' } });
    expect(after.nodes['otra.clienta']).toMatchObject({ x: 10, y: 10 });
    expect(after.relations.sirve!.to).toEqual({ elementId: 'clienta' });
    expect(Object.values(after.edges).filter(e => e.relationId === 'sirve')).toHaveLength(2);
  });

  it('añadir un elemento y una relación: se crean con su nodo (colocado bajo lo que hay) y su arista', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t
      .replace('    real = web', '    rol = archimate:BusinessRole "Rol"\n    asigna = rol -> cliente : archimate:Assignment\n    real = web')
      .replace('      edge sirve\n      edge real', '      include rol\n      edge asigna\n      edge sirve\n      edge real'),
    { sizeOf: () => ({ w: 120, h: 50 }) });
    expect(r.problems).toEqual([]);
    expect(kinds(r.commands)).toEqual(expect.arrayContaining(['set:elements/rol', 'set:relations/asigna', 'set:nodes/mapa.rol', 'set:edges/mapa.asigna']));
    expect(r.commands.every(c => c.type === 'set')).toBe(true);
    const n = after.nodes['mapa.rol']!;
    expect(n).toMatchObject({ w: 120, h: 50, x: 40 });
    expect(n.y).toBeGreaterThanOrEqual(300 + 56 + 40);
    expect(after.edges['mapa.asigna']).toMatchObject({ fromNodeId: 'mapa.rol', toNodeId: 'mapa.cliente' });
    expect(r.layoutViews).toEqual([]);
    // lo demás no se movió
    for (const id of Object.keys(ws.nodes)) expect(after.nodes[id]).toEqual(ws.nodes[id]);
  });

  it('borrar un elemento del texto (declaración, nodos y relaciones) lo borra del modelo con sus apariciones', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.split('\n').filter(l => !/catalogo|sirve|real/.test(l)).join('\n'));
    expect(r.problems).toEqual([]);
    expect(after.elements.catalogo).toBeUndefined();
    expect(after.relations.sirve).toBeUndefined();
    expect(after.relations.real).toBeUndefined();
    expect(Object.values(after.nodes).some(n => n.elementId === 'catalogo')).toBe(false);
    expect(Object.keys(after.edges)).toEqual([]);
    expect(after.elements.cliente).toEqual(ws.elements.cliente);
  });

  it('borrar la declaración pero dejar una relación que la usa: problema, no se aplica', () => {
    const ws = model();
    const { r } = edit(ws, WS, t => t.replace(/^\s*catalogo = .*\n/m, '').replace(/^\s*include catalogo.*\n/gm, ''));
    expect(r.commands).toEqual([]);
    expect(r.problems.map(p => p.key)).toContain('El elemento «{id}» no existe');
    expect(r.problems.every(p => p.line > 1)).toBe(true);
  });

  it('quitar solo el include quita el nodo y sus aristas de esa vista, no el elemento', () => {
    const ws = model();
    const baseText = panelText(ws, MAPA);
    const mine = readText(baseText.replace(/^\s*include catalogo.*\n/m, ''), ws);
    expect(mine.errors).toEqual([]);
    expect(mine.warnings.map(w => w.key)).toContain('La relación «{id}» no tiene nodos en la vista «{view}»: indica from y to');
    const r = computeSync({ current: ws, base: readText(baseText, ws), mine, scope: MAPA });
    const after = run(ws, r.commands);
    expect(after.elements.catalogo).toBeDefined();
    expect(after.nodes['mapa.catalogo']).toBeUndefined();
    expect(after.edges['mapa.sirve']).toBeUndefined();
    expect(after.edges['mapa.real']).toBeUndefined();
    expect(after.nodes['otra.catalogo']).toBeDefined();
    expect(after.edges['otra.sirve']).toBeDefined();
  });

  it('borrar una relación: relación y aristas en todas las vistas', () => {
    const ws = model();
    const { after } = edit(ws, WS, t => t.split('\n').filter(l => !/sirve/.test(l)).join('\n'));
    expect(after.relations.sirve).toBeUndefined();
    expect(Object.values(after.edges).map(e => e.relationId)).toEqual(['real']);
  });

  it('desde una vista, borrar la declaración borra el elemento también de las otras vistas', () => {
    const ws = model();
    const { r, after } = edit(ws, MAPA, t => t.split('\n').filter(l => !/catalogo|sirve|real/.test(l)).join('\n'));
    expect(r.problems).toEqual([]);
    expect(after.elements.catalogo).toBeUndefined();
    expect(after.nodes['otra.catalogo']).toBeUndefined();
    expect(after.edges['otra.sirve']).toBeUndefined();
    expect(after.nodes['otra.cliente']).toEqual(ws.nodes['otra.cliente']);
  });

  it('mover un nodo fuera de su contenedor conserva la posición absoluta; el elemento se desanida', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t
      .replace('      api = archimate:ApplicationInterface "API"\n', '').replace('    catalogo = ', '    api = archimate:ApplicationInterface "API"\n    catalogo = ')
      .replace(/      include web \{\n        include api\n      \}\n/, '      include web\n      include api\n'));
    expect(r.problems).toEqual([]);
    expect(after.elements.api!.features.parentId).toBeUndefined();
    expect(after.nodes['mapa.api']).toMatchObject({ x: 320, y: 80, w: 160, h: 56 });
    expect(after.nodes['mapa.api']!.parentNodeId).toBeUndefined();
  });

  it('mover un nodo dentro de un contenedor: si su posición no cae dentro, se coloca dentro y el contenedor crece si hace falta', () => {
    const ws = model();
    const { after } = edit(ws, WS, t => t.replace(/      include catalogo\n/, '').replace('        include api\n', '        include api\n        include catalogo\n'));
    const n = after.nodes['mapa.catalogo']!;
    expect(n.parentNodeId).toBe('mapa.web');
    expect(n.x).toBe(20);
    expect(n.y).toBe(40 + 56 + 20);
    const web = after.nodes['mapa.web']!;
    expect(web.h).toBeGreaterThanOrEqual(n.y + n.h);
    expect(web).toMatchObject({ x: 300, y: 40 });
  });

  it('cambiar campos, documentación y etiquetas: patch mínimo (y quitar un campo lo quita)', () => {
    const ws = model();
    ws.elements.web!.fields = { version: '3.1', equipo: 'Pagos' };
    const { r, after } = edit(ws, WS, t => t.replace('version = "3.1"', 'version = "3.2"').replace(/\n\s*equipo = "Pagos"/, '').replace('doc "Compra"', 'doc "Compra online"\n      tags ["vip"]'));
    expect(r.problems).toEqual([]);
    expect(after.elements.web!.fields).toEqual({ version: '3.2' });
    expect(after.elements.cliente).toMatchObject({ doc: 'Compra online', tags: ['vip'] });
    const p = r.commands.find(c => c.type === 'patch' && c.id === 'web');
    expect(p).toEqual({ type: 'patch', collection: 'elements', id: 'web', patch: { fields: { version: '3.2', equipo: undefined } } });
  });

  it('vistas: crear (con layout pedido), renombrar y borrar', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t
      .replace('view otra "Otra"', 'view otra "Otra vista"')
      .replace('  views {\n', '  views {\n    view nueva "Nueva" {\n      notation c4\n      include cliente, catalogo\n      edge sirve\n    }\n'));
    expect(r.problems).toEqual([]);
    expect(after.views.nueva).toMatchObject({ name: 'Nueva', notationId: 'c4' });
    expect(after.views.otra!.name).toBe('Otra vista');
    expect(Object.values(after.nodes).filter(n => n.viewId === 'nueva')).toHaveLength(2);
    expect(after.edges['nueva.sirve']).toBeDefined();
    expect(r.layoutViews).toEqual(['nueva']);
    const { after: after2 } = edit(after, WS, t => t.replace(/    view otra[\s\S]*?\n    }\n/, ''));
    expect(after2.views.otra).toBeUndefined();
    expect(Object.values(after2.nodes).some(n => n.viewId === 'otra')).toBe(false);
    expect(Object.values(after2.edges).some(e => e.viewId === 'otra')).toBe(false);
  });

  it('nombre y descripción del espacio', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.replace('workspace "Tienda" {', 'workspace "Tienda online" {\n  description "Demo"'));
    expect(r.commands).toEqual([{ type: 'meta', patch: { name: 'Tienda online', description: 'Demo' } }]);
    expect(after.meta.name).toBe('Tienda online');
  });

  it('un único paso de deshacer', () => {
    const ws = model();
    const { r } = edit(ws, WS, t => t.replace('"Cliente"', '"Clienta"').split('\n').filter(l => !/real/.test(l)).join('\n'));
    const store = new MemoryStore(structuredClone(ws));
    const h = new History(store);
    h.run({ type: 'batch', label: 'text', commands: r.commands });
    expect(store.get('elements', 'cliente')!.name).toBe('Clienta');
    expect(store.get('relations', 'real')).toBeUndefined();
    h.undo();
    expect(store.snapshot()).toEqual(ws);
    expect(h.canUndo).toBe(false);
  });
});

describe('geometría', () => {
  it('sin posiciones en el texto, la geometría del lienzo no se toca; un `at` escrito sí se aplica', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.replace('include cliente {', 'include cliente at 100, 120 {'));
    expect(kinds(r.commands)).toEqual(['patch:nodes/mapa.cliente']);
    expect(r.commands[0]).toMatchObject({ patch: { x: 100, y: 120 } });
    expect(after.nodes['mapa.cliente']).toMatchObject({ x: 100, y: 120, w: 160, h: 56 });
  });

  it('con posiciones: mover en el lienzo mientras se edita otra cosa no revierte el movimiento', () => {
    const ws = model();
    const remote = structuredClone(ws);
    remote.nodes['mapa.cliente']!.x = 999;
    const { r, after } = edit(ws, WS, t => t.replace('"Web"', '"Tienda web"'), { positions: true, remote });
    expect(r.conflicts).toEqual([]);
    expect(kinds(r.commands)).toEqual(['patch:elements/web']);
    expect(after.nodes['mapa.cliente']!.x).toBe(999);
  });

  it('una vista nueva cuyos nodos llevan `at` no pide layout', () => {
    const ws = model();
    const { r, after } = edit(ws, WS, t => t.replace('  views {\n', '  views {\n    view v2 "V2" {\n      include cliente at 5, 6\n      include web at 300, 6\n    }\n'));
    expect(r.layoutViews).toEqual([]);
    expect(after.nodes['v2.cliente']).toMatchObject({ x: 5, y: 6 });
  });

  it('`at`, `size` y `via` dentro de textos o comentarios no cuentan como escritos', () => {
    const text = 'view v {\n  note "quedamos at 5, 6" as n1\n  include a at 1, 2 // size 3, 4\n  edge as e1 from n1 to v.a label "via 3, 4"\n}\n';
    const r = parseDsl(`a = core:x "A"\n${text}`);
    const ex = explicitGeometry(`a = core:x "A"\n${text}`, r.locations);
    expect([...ex.at]).toEqual(['v.a']);
    expect([...ex.size]).toEqual([]);
    expect([...ex.via]).toEqual([]);
  });
});

describe('cambios a la vez (fusión a tres bandas)', () => {
  it('el modelo cambió un campo y el texto otro: se combinan sin conflicto', () => {
    const ws = model();
    const remote = structuredClone(ws);
    remote.elements.cliente!.doc = 'Cambiado en el lienzo';
    remote.elements.rol = { ...remote.elements.cliente!, id: 'rol', name: 'Rol nuevo' };
    const { r, after } = edit(ws, WS, t => t.replace('"Cliente"', '"Clienta"'), { remote });
    expect(r.conflicts).toEqual([]);
    expect(after.elements.cliente).toMatchObject({ name: 'Clienta', doc: 'Cambiado en el lienzo' });
    expect(after.elements.rol).toBeDefined();
  });

  it('el mismo campo cambiado a valores distintos: conflicto; "mantener el mío" gana el texto', () => {
    const ws = model();
    const remote = structuredClone(ws);
    remote.elements.cliente!.name = 'Remoto';
    const { r } = edit(ws, WS, t => t.replace('"Cliente"', '"Texto"'), { remote });
    expect(r.conflicts).toEqual(['elements/cliente.name']);
    expect(r.commands).toEqual([]);
    const { r: r2, after } = edit(ws, WS, t => t.replace('"Cliente"', '"Texto"'), { remote, keepMine: true });
    expect(r2.conflicts).toEqual([]);
    expect(after.elements.cliente!.name).toBe('Texto');
  });

  it('borrado en el modelo de algo que el texto no tocó: se acepta el borrado', () => {
    const ws = model();
    const remote = run(ws, [{ type: 'deleteElement', id: 'catalogo' } as Command].flatMap(c => [c]));
    const { r, after } = edit(ws, WS, t => t.replace('"Web"', '"W"'), { remote });
    // el texto aún tiene catalogo y sus relaciones: no se resucitan porque no cambiaron, pero el texto refiere a ellos
    expect(r.conflicts).toEqual([]);
    expect(after.elements.catalogo).toBeUndefined();
  });
});

describe('alcance de una vista', () => {
  it('incluir un elemento existente que no está en el texto', () => {
    const ws = model();
    ws.elements.extra = { ...ws.elements.catalogo!, id: 'extra', name: 'Extra' };
    const { r, after } = edit(ws, { kind: 'view', viewId: 'otra' }, t => t.replace('      include catalogo\n', '      include catalogo\n      include extra\n'));
    expect(r.problems).toEqual([]);
    expect(after.nodes['otra.extra']).toMatchObject({ elementId: 'extra', viewId: 'otra' });
    expect(after.elements.extra).toEqual(ws.elements.extra);
  });

  it('declarar un id que ya existe fuera del texto es un problema (no se pisa)', () => {
    const ws = model();
    const { r } = edit(ws, { kind: 'view', viewId: 'otra' }, t => t.replace('  model {\n', '  model {\n    web = archimate:Node "Otro"\n'));
    expect(r.commands).toEqual([]);
    expect(r.problems[0]).toMatchObject({ key: 'El id «{id}» ya existe en el espacio, fuera de este texto: usa otro id', vars: { id: 'web' } });
  });
});

describe('posiciones del texto ↔ registros', () => {
  const ws = model();
  const text = panelText(ws, WS);
  const snap = readText(text, ws);
  const ranges = recordRanges(text, snap.locations);
  const at = (needle: string, delta = 0) => text.indexOf(needle) + delta;

  it('el registro más interior bajo el cursor', () => {
    expect(recordAt(ranges, at('"API"'))!.key).toBe('elements/api');
    expect(recordAt(ranges, at('"Web"'))!.key).toBe('elements/web');
    expect(recordAt(ranges, at('doc "Compra"'))!.key).toBe('elements/cliente');
    expect(recordAt(ranges, at('include api'))!.key).toBe('nodes/mapa.api');
    expect(recordAt(ranges, at('edge real'))!.key).toBe('edges/mapa.real');
    expect(recordAt(ranges, at('sirve = '))!.key).toBe('relations/sirve');
  });

  it('registro → selección en la vista y selección → registro', () => {
    expect(selectionForRecord('elements/cliente', ws, 'mapa')).toEqual({ nodes: ['mapa.cliente'], edges: [] });
    expect(selectionForRecord('relations/sirve', ws, 'otra')).toEqual({ nodes: [], edges: ['otra.sirve'] });
    expect(selectionForRecord('nodes/otra.cliente', ws, 'mapa')).toBeNull();
    expect(selectionForRecord('views/mapa', ws, 'mapa')).toBeNull();
    expect(recordsForSelection({ nodes: ['mapa.api'], edges: [] }, ws)).toEqual(['elements/api', 'nodes/mapa.api']);
    expect(recordsForSelection({ nodes: [], edges: ['mapa.real'] }, ws)).toEqual(['relations/real', 'edges/mapa.real']);
  });

  it('el cursor sigue a su declaración cuando el texto se recarga', () => {
    const ws2 = structuredClone(ws);
    ws2.elements = { nuevo: { ...ws.elements.cliente!, id: 'nuevo', name: 'Nuevo' }, ...ws2.elements };
    const text2 = panelText(ws2, WS);
    const ranges2 = recordRanges(text2, readText(text2, ws2).locations);
    const off = at('"Catálogo"', 2);
    const off2 = mapOffset(text, ranges, text2, ranges2, off);
    expect(text2.slice(off2 - 2, off2 + 8)).toBe(text.slice(off - 2, off + 8));
  });

  it('líneas y columnas', () => {
    const s = lineStarts('ab\ncd\n');
    expect(lineColOf(s, 4)).toEqual({ line: 2, col: 2 });
    expect(offsetOf(s, 2, 2)).toBe(4);
  });

  it('ids implícitos se hacen explícitos tras aplicar', () => {
    const t = 'model {\n  archimate:BusinessActor "Ana Pérez"\n  ana_perez -> x : core:link\n  x = core:x\n}\nview "Mapa" {\n  include x\n}\n';
    const s = readText(t);
    const out = applyEdits(t, explicitIdEdits(t, s));
    expect(out).toContain('  ana_perez = archimate:BusinessActor "Ana Pérez"');
    expect(out).toContain('  rel_ana_perez_x = ana_perez -> x : core:link');
    expect(out).toContain('view view_mapa "Mapa" {');
    expect(parseDsl(out).workspace).toEqual(s.ws);
  });
});

describe('utilidades', () => {
  it('diffPatch y deepEqual', () => {
    expect(diffPatch({ a: 1, o: { x: 1, y: 2 }, l: [1] }, { a: 1, o: { x: 1 }, l: [1, 2] })).toEqual({ o: { y: undefined }, l: [1, 2] });
    expect(diffPatch({ a: 1 }, { a: 1, b: undefined })).toBeNull();
    expect(deepEqual({ a: undefined, b: [1, { c: 2 }] }, { b: [1, { c: 2 }] })).toBe(true);
  });
});
