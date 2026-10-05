/**
 * Notaciones nuevas en io: figuras UML (paquete, componente, artefacto, nodo 3D, socket, puerto, final de flujo, señales),
 * palabra clave en las aristas («include», «deploy»…), vista de Gantt en el SVG y Mermaid (gantt, actividad y casos de uso).
 */
import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, makeEdge, parseWorkspace, type Store } from '@all-draw/core';
import { USECASE_PACK } from '../../notations/usecase/src';
import { COMPONENT_PACK } from '../../notations/component/src';
import { DEPLOYMENT_PACK } from '../../notations/deployment/src';
import { ACTIVITY_PACK } from '../../notations/activity/src';
import { GANTT_PACK } from '../../notations/gantt/src';
import { renderSvg, figureFor } from '../src/svg';
import { ganttGeometry, renderGanttSvg, dayOf, GANTT } from '../src/svg-gantt';
import { exportMermaid, importMermaid, MERMAID_VIEW_ID } from '../src';

const reg = () => [USECASE_PACK, COMPONENT_PACK, DEPLOYMENT_PACK, ACTIVITY_PACK, GANTT_PACK].reduce((r, p) => r.register(p), new NotationRegistry().register(CORE_PACK));

function build(notationId: string, kind: 'freeform' | 'gantt' = 'freeform') {
  const s = new MemoryStore();
  s.set('views', 'v', makeView('Vista', { id: 'v', notationId, kind }));
  const el = (id: string, typeId: string, name: string, fields: Record<string, unknown> = {}) => { const e = makeElement(typeId, name, { id: `el_${id}`, fields }); s.set('elements', e.id, e); return e; };
  const node = (id: string, x: number, y: number, w = 160, h = 56, parentNodeId?: string) => { const n = makeNode('v', `el_${id}`, { x, y, w, h }, { id, parentNodeId }); s.set('nodes', n.id, n); return n; };
  const link = (id: string, typeId: string, a: string, b: string, fields: Record<string, unknown> = {}) => {
    const r = makeRelation(typeId, { elementId: `el_${a}` }, { elementId: `el_${b}` }, { id: `rel_${id}`, fields }); s.set('relations', r.id, r);
    s.set('edges', `e_${id}`, makeEdge('v', r.id, a, b, { id: `e_${id}` }));
  };
  return { s, el, node, link };
}
const wsOf = (s: Store) => parseWorkspace({ meta: { name: 'X' }, views: Object.fromEntries(s.list('views').map(v => [v.id, v])), elements: Object.fromEntries(s.list('elements').map(v => [v.id, v])), relations: Object.fromEntries(s.list('relations').map(v => [v.id, v])), nodes: Object.fromEntries(s.list('nodes').map(v => [v.id, v])), edges: Object.fromEntries(s.list('edges').map(v => [v.id, v])) });

describe('figuras UML nuevas en el SVG', () => {
  it('figureFor: tabla por tipo; la shape del tipo sigue mandando en el resto', () => {
    expect(figureFor('deployment:Node', 'rect')).toBe('node3d');
    expect(figureFor('component:RequiredInterface', 'circle')).toBe('socket');
    expect(figureFor('component:ProvidedInterface', 'circle')).toBe('circle');
    expect(figureFor('activity:FlowFinal', 'circle')).toBe('flow-final');
    expect(figureFor('usecase:Package', 'group')).toBe('package');
    expect(figureFor('uml:Package', 'group')).toBe('group');
  });

  it('caja 3D, paquete con pestaña, señales y final de flujo; iconos de componente y artefacto sobre la caja', () => {
    const { s, el, node } = build('deployment');
    el('n', 'deployment:Node', 'Servidor'); node('n', 0, 0, 300, 200);
    el('a', 'deployment:Artifact', 'app.jar'); node('a', 20, 60, 140, 50, 'n');
    el('c', 'deployment:Component', 'Pedidos'); node('c', 400, 0);
    el('p', 'usecase:Package', 'Ventas'); node('p', 0, 300, 300, 160);
    el('snd', 'activity:SendSignal', 'Avisar'); node('snd', 400, 300);
    el('rcv', 'activity:AcceptEvent', 'Pago recibido'); node('rcv', 400, 400);
    el('ff', 'activity:FlowFinal', ''); node('ff', 600, 300, 30, 30);
    el('ri', 'component:RequiredInterface', 'IPago'); node('ri', 600, 400, 30, 30);
    const svg = renderSvg(s, reg(), 'v', { bare: false });
    const part = (id: string) => {
      const i = svg.indexOf(`data-node="${id}"`), start = svg.lastIndexOf('<g', i);
      const next = [svg.indexOf('<g class="ad-node', i), svg.indexOf('<g class="ad-edges"', i)].filter(x => x > 0);
      return svg.slice(start, Math.min(...next));
    };
    expect((part('n').match(/<path/g) ?? []).length).toBe(3);           // tres caras
    expect(part('n')).not.toContain('<rect class="ad-shape"');            // sin caja: la figura es la caja 3D
    expect((part('p').match(/<path/g) ?? []).length).toBe(2);           // pestaña + cuerpo
    expect(part('a')).toContain('<rect class="ad-shape"');                // caja + icono de documento
    expect((part('a').match(/<path/g) ?? []).length).toBe(2);
    expect((part('c').match(/<path/g) ?? []).length).toBe(2);           // icono de componente
    expect(part('snd')).toMatch(/<path d="M0.75,0.75 H[\d.]+ L159.25,28/); // punta a la derecha
    expect(part('rcv')).toMatch(/L[\d.]+,28 Z/);                         // muesca a la izquierda
    expect(part('ff')).toMatch(/A14,14/);
    expect(part('ri')).toMatch(/A13,13 0 0 0/);
    // El texto respeta la pestaña y la profundidad de la caja: el nombre del nodo va por debajo de la cara superior
    const ys = [...part('n').matchAll(/class="ad-node__label"[^>]*>|<text[^>]* y="([\d.]+)"/g)].map(m => Number(m[1])).filter(Boolean);
    expect(Math.min(...ys)).toBeGreaterThan(12);
  });

  it('palabra clave de la relación delante del rótulo: «include», «extend» con su punto, «deploy»', () => {
    const { s, el, node, link } = build('usecase');
    el('base', 'usecase:UseCase', 'Pagar'); node('base', 0, 0);
    el('inc', 'usecase:UseCase', 'Validar tarjeta'); node('inc', 300, 0);
    el('ext', 'usecase:UseCase', 'Aplicar cupón'); node('ext', 0, 200);
    link('i', 'usecase:Include', 'base', 'inc');
    link('x', 'usecase:Extend', 'ext', 'base', { extensionPoint: 'descuentos', condition: '[cupón válido]' });
    const svg = renderSvg(s, reg(), 'v');
    expect(svg).toContain('«include»');
    expect(svg).toContain('«extend» descuentos · [cupón válido]');
  });
});

describe('Gantt en el SVG', () => {
  function plan() {
    const b = build('gantt', 'gantt');
    b.el('f', 'gantt:Group', 'Diseño'); b.node('f', 0, 0, 260, 140);
    b.el('a', 'gantt:Task', 'Bocetos', { start: '2026-04-06', end: '2026-04-10', progress: 100, assignee: 'Ana' }); b.node('a', 20, 40, 220, 40, 'f');
    b.el('b', 'gantt:Task', 'Maquetas', { duration: 4, critical: true }); b.node('b', 20, 88, 220, 40, 'f');
    b.el('m', 'gantt:Milestone', 'Aprobación'); b.node('m', 0, 200, 220, 40);
    b.link('ab', 'gantt:Dependency', 'a', 'b', { kind: 'FS' });
    b.link('bm', 'gantt:Dependency', 'b', 'm', { kind: 'FS', lag: 1 });
    return b;
  }

  it('geometría: filas por anidamiento y fechas de los campos y las dependencias', () => {
    const { s } = plan();
    const g = ganttGeometry(s, s.get('views', 'v')!);
    expect(g.rows.map(r => r.el.name)).toEqual(['Diseño', 'Bocetos', 'Maquetas', 'Aprobación']);
    expect(g.scale).toBe('day');
    const b = g.rows[2]!;
    expect(b.start).toBe(dayOf('2026-04-11'));
    expect(b.end).toBe(dayOf('2026-04-14'));
    expect(g.rows[3]!.start).toBe(dayOf('2026-04-16'));
    expect(g.rows[0]!).toMatchObject({ start: dayOf('2026-04-06'), end: dayOf('2026-04-14') });
    expect(b.bar.y).toBe(GANTT.headerH + 2 * GANTT.rowH + (GANTT.rowH - GANTT.barH) / 2);
  });

  it('pinta rejilla, barras, rombo, fase y dependencias en codo; el render genérico no repite los nodos', () => {
    const { s } = plan();
    const r = reg();
    const svg = renderSvg(s, r, 'v', { theme: 'light' });
    expect(svg).toContain('class="ad-gantt-grid"');
    expect(svg).toContain('ad-gantt-bar--task');
    expect(svg).toContain('ad-gantt-bar--milestone');
    expect(svg).toContain('ad-gantt-bar--group');
    expect(svg).toContain('Ana');
    expect(svg).toContain('#F8CECC');                      // crítica
    expect(svg).toContain('100%');                         // progreso
    expect((svg.match(/ad-gantt-dep-edge/g) ?? []).length).toBe(2);
    expect(svg).toContain('FS+1d');
    expect(svg).toContain('abr 2026');
    expect((svg.match(/data-node="a"/g) ?? []).length).toBe(1);
    const parts = renderGanttSvg(s, r, s.get('views', 'v')!, { bare: true })!;
    expect([...parts.nodeIds].sort()).toEqual(['a', 'b', 'f', 'm']);
    expect(parts.back).not.toContain('data-node');
    // Una vista que no es de Gantt no se toca
    const other = build('activity');
    expect(renderGanttSvg(other.s, r, other.s.get('views', 'v')!, { bare: false })).toBeNull();
  });
});

describe('Mermaid: gantt', () => {
  it('exporta secciones, after, crit/done, hito y avisa de las dependencias que no son FS', () => {
    const b = build('gantt', 'gantt');
    b.el('f', 'gantt:Group', 'Diseño'); b.node('f', 0, 0, 260, 140);
    b.el('a', 'gantt:Task', 'Bocetos: v1', { start: '2026-04-06', end: '2026-04-10', progress: 100 }); b.node('a', 20, 40, 220, 40, 'f');
    b.el('b', 'gantt:Task', 'Maquetas', { duration: 4, critical: true }); b.node('b', 20, 88, 220, 40, 'f');
    b.el('m', 'gantt:Milestone', 'Aprobación'); b.node('m', 0, 200, 220, 40);
    b.el('c', 'gantt:Task', 'Revisión', { start: '2026-04-20', duration: 2 }); b.node('c', 0, 260, 220, 40);
    b.link('ab', 'gantt:Dependency', 'a', 'b', { kind: 'FS' });
    b.link('bm', 'gantt:Dependency', 'b', 'm', { kind: 'SS' });
    const { text, warnings } = exportMermaid(wsOf(b.s), 'v');
    const lines = text.trim().split('\n').map(l => l.trim());
    expect(lines.slice(0, 3)).toEqual(['gantt', 'title Vista', 'dateFormat YYYY-MM-DD']);
    expect(lines).toContain('section Diseño');
    expect(lines).toContain('Bocetos v1 :done, a, 2026-04-06, 5d');
    expect(lines).toContain('Maquetas :crit, b, after a, 4d');
    expect(lines).toContain('Aprobación :milestone, m, 2026-04-11, 0d');
    expect(lines).toContain('Revisión :c, 2026-04-20, 2d');
    // Las tareas sueltas van antes de la primera sección (si no, Mermaid las metería en ella)
    expect(lines.indexOf('Revisión :c, 2026-04-20, 2d')).toBeLessThan(lines.indexOf('section Diseño'));
    expect(warnings.join(' ')).toMatch(/SS/);
  });

  it('importa: secciones como fases, after y tareas encadenadas como FS, fin exclusivo, etiquetas', () => {
    const { workspace: ws, warnings } = importMermaid([
      'gantt', '  title Lanzamiento', '  dateFormat YYYY-MM-DD', '  excludes weekends',
      '  section Diseño', '    Bocetos :done, a1, 2026-04-06, 5d', '    Maquetas :crit, a2, after a1, 4d', '    Pulido : 2d',
      '  section Entrega', '    Fin :milestone, m1, 2026-04-20, 0d', '    Hotfix :2026-04-21, 2026-04-23',
    ].join('\n'));
    const v = ws.views[MERMAID_VIEW_ID]!;
    expect(v).toMatchObject({ kind: 'gantt', notationId: 'gantt', name: 'Lanzamiento' });
    const byName = (n: string) => Object.values(ws.elements).find(e => e.name === n)!;
    expect(byName('Diseño').typeId).toBe('gantt:Group');
    expect(byName('Bocetos').fields).toMatchObject({ start: '2026-04-06', duration: 5, progress: 100 });
    expect(byName('Maquetas').fields).toMatchObject({ duration: 4, critical: true });
    expect(byName('Maquetas').fields.start).toBeUndefined();
    expect(byName('Fin')).toMatchObject({ typeId: 'gantt:Milestone', fields: { start: '2026-04-20' } });
    expect(byName('Hotfix').fields).toMatchObject({ start: '2026-04-21', end: '2026-04-22' });
    const deps = Object.values(ws.relations).map(r => `${ws.elements[r.from.elementId!]!.name}>${ws.elements[r.to.elementId!]!.name}:${r.fields.kind}`);
    expect(deps).toEqual(['Bocetos>Maquetas:FS', 'Maquetas>Pulido:FS']);
    const nodeOf = (n: string) => Object.values(ws.nodes).find(x => x.elementId === byName(n).id)!;
    expect(nodeOf('Maquetas').parentNodeId).toBe(nodeOf('Diseño').id);
    expect(warnings.join(' ')).toMatch(/excluidos/);
    // Ida y vuelta: las fechas resueltas coinciden
    const s = new MemoryStore(ws);
    const g = ganttGeometry(s, v);
    expect(g.rows.find(r => r.el.name === 'Pulido')!.start).toBe(dayOf('2026-04-15'));
  });
});

describe('Mermaid: actividad y casos de uso como flowchart con marca', () => {
  it('actividad: figuras y clases por tipo, guardas en las flechas; vuelve con sus tipos', () => {
    const b = build('activity');
    b.el('lane', 'activity:Partition', 'Almacén'); b.node('lane', 0, 0, 600, 400);
    b.el('i', 'activity:Initial', ''); b.node('i', 30, 30, 30, 30, 'lane');
    b.el('a', 'activity:Action', 'Preparar'); b.node('a', 100, 20, 160, 56, 'lane');
    b.el('d', 'activity:Decision', '¿Stock?'); b.node('d', 100, 120, 50, 50, 'lane');
    b.el('o', 'activity:ObjectNode', 'Pedido', { state: 'pagado' }); b.node('o', 300, 20);
    b.el('s', 'activity:SendSignal', 'Avisar'); b.node('s', 300, 120);
    b.el('ff', 'activity:FlowFinal', ''); b.node('ff', 300, 220, 30, 30);
    b.el('f', 'activity:ActivityFinal', ''); b.node('f', 400, 220, 30, 30);
    b.link('1', 'activity:ControlFlow', 'i', 'a');
    b.link('2', 'activity:ControlFlow', 'a', 'd');
    b.link('3', 'activity:ControlFlow', 'd', 's', { guard: '[sí]' });
    b.link('4', 'activity:ControlFlow', 'd', 'ff', { guard: '[no]' });
    b.link('5', 'activity:ObjectFlow', 'o', 'a');
    b.link('6', 'activity:ControlFlow', 's', 'f');
    const { text } = exportMermaid(wsOf(b.s), 'v');
    expect(text.split('\n')[0]).toBe('%% all-draw: activity');
    expect(text).toContain('flowchart TD');
    expect(text).toMatch(/subgraph \w+\["Almacén"\]/);
    expect(text).toContain('["Pedido ［pagado］"]');
    expect(text).toMatch(/-->\|"\[sí\]"\|/);
    expect(text).toMatch(/class [\w,]+ Initial/);
    const { workspace: ws } = importMermaid(text);
    expect(ws.views[MERMAID_VIEW_ID]!.notationId).toBe('activity');
    const types = Object.values(ws.elements).map(e => e.typeId).sort();
    expect(types).toEqual(['activity:Action', 'activity:ActivityFinal', 'activity:Decision', 'activity:FlowFinal', 'activity:Initial', 'activity:ObjectNode', 'activity:Partition', 'activity:SendSignal']);
    const obj = Object.values(ws.elements).find(e => e.typeId === 'activity:ObjectNode')!;
    expect(obj).toMatchObject({ name: 'Pedido', fields: { state: 'pagado' } });
    expect(Object.values(ws.relations).filter(r => r.typeId === 'activity:ObjectFlow')).toHaveLength(1);
    expect(Object.values(ws.relations).map(r => r.fields.guard).filter(Boolean).sort()).toEqual(['[no]', '[sí]']);
    const init = Object.values(ws.nodes).find(n => ws.elements[n.elementId!]!.typeId === 'activity:Initial')!;
    expect([init.w, init.h]).toEqual([30, 30]);
    const reg2 = reg();
    for (const r of Object.values(ws.relations)) expect(reg2.isValidRelation(ws.elements[r.from.elementId!]!.typeId, ws.elements[r.to.elementId!]!.typeId, r.typeId)).toBe(true);
  });

  it('casos de uso: actores, elipses en el límite, «include»/«extend» y generalización; vuelve con sus tipos', () => {
    const b = build('usecase');
    b.el('sys', 'usecase:System', 'Tienda'); b.node('sys', 200, 0, 400, 300);
    b.el('c', 'usecase:Actor', 'Cliente'); b.node('c', 0, 50, 60, 90);
    b.el('v', 'usecase:Actor', 'Cliente VIP'); b.node('v', 0, 200, 60, 90);
    b.el('p', 'usecase:UseCase', 'Pagar'); b.node('p', 40, 40, 160, 70, 'sys');
    b.el('t', 'usecase:UseCase', 'Validar tarjeta'); b.node('t', 220, 40, 160, 70, 'sys');
    b.el('x', 'usecase:UseCase', 'Aplicar cupón'); b.node('x', 40, 180, 160, 70, 'sys');
    b.link('1', 'usecase:Association', 'c', 'p');
    b.link('2', 'usecase:Include', 'p', 't');
    b.link('3', 'usecase:Extend', 'x', 'p', { extensionPoint: 'descuentos', condition: '[cupón]' });
    b.link('4', 'usecase:Generalization', 'v', 'c');
    const { text } = exportMermaid(wsOf(b.s), 'v');
    expect(text).toContain('flowchart LR');
    expect(text).toContain('(["Pagar"])');
    expect(text).toContain('-.->|"«include»"|');
    expect(text).toContain('-.->|"«extend» descuentos [cupón]"|');
    const { workspace: ws } = importMermaid(text);
    const rels = Object.values(ws.relations).map(r => r.typeId).sort();
    expect(rels).toEqual(['usecase:Association', 'usecase:Extend', 'usecase:Generalization', 'usecase:Include']);
    expect(Object.values(ws.relations).find(r => r.typeId === 'usecase:Extend')!.fields).toEqual({ extensionPoint: 'descuentos', condition: '[cupón]' });
    expect(Object.values(ws.elements).find(e => e.name === 'Tienda')!.typeId).toBe('usecase:System');
    expect(Object.values(ws.elements).filter(e => e.typeId === 'usecase:Actor').map(e => e.name).sort()).toEqual(['Cliente', 'Cliente VIP']);
    // Sin marca, un flowchart sigue siendo genérico
    expect(importMermaid('flowchart LR\n  a([x]) --> b').workspace.views[MERMAID_VIEW_ID]!.notationId).toBe('freeform');
  });
});
