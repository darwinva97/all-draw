import { describe, it, expect } from 'vitest';
import { MemoryStore, emptyWorkspace, execute, makeElement, makeView, makeNode, makeRelation, makeEdge, type Store } from '@all-draw/core';
import {
  ganttLayout, dayOf, isoOf, autoScale, elbowRoute, moveCommand, resizeCommand, dropFields, xOfDay, dayAtX, resolveDates, ganttRowNodes,
  GANTT, SCALE_PX, GANTT_TASK, GANTT_MILESTONE, GANTT_GROUP, GANTT_DEPENDENCY,
} from '../src/views/gantt';

/** Fase con dos tareas (una por fin, otra por duración) + una tarea sin fechas que depende (FS) + un hito con SS. */
function fixture() {
  const store: Store = new MemoryStore(emptyWorkspace());
  const view = makeView('Plan', { id: 'vw_g', notationId: 'gantt', kind: 'gantt' });
  store.set('views', view.id, view);
  const el = (id: string, typeId: string, fields: Record<string, unknown> = {}) => { const e = makeElement(typeId, id, { id: `el_${id}`, fields }); store.set('elements', e.id, e); return e; };
  const nd = (id: string, y: number, parentNodeId?: string) => { const n = makeNode(view.id, `el_${id}`, { x: 0, y, w: 160, h: 40 }, { id: `vn_${id}`, parentNodeId }); store.set('nodes', n.id, n); return n; };
  el('fase', GANTT_GROUP);
  el('a', GANTT_TASK, { start: '2026-03-02', end: '2026-03-06', progress: 50 });
  el('b', GANTT_TASK, { start: '2026-03-04', duration: 3, critical: true, assignee: 'Ana' });
  el('c', GANTT_TASK, { duration: 2 });
  el('m', GANTT_MILESTONE);
  nd('fase', 0);
  nd('b', 80, 'vn_fase');
  nd('a', 40, 'vn_fase');
  nd('c', 200);
  nd('m', 240);
  const dep = (id: string, from: string, to: string, fields: Record<string, unknown> = {}) => {
    const r = makeRelation(GANTT_DEPENDENCY, { elementId: `el_${from}` }, { elementId: `el_${to}` }, { id: `rel_${id}`, fields }); store.set('relations', r.id, r);
    const e = makeEdge(view.id, r.id, `vn_${from}`, `vn_${to}`, { id: `ve_${id}` }); store.set('edges', e.id, e);
  };
  dep('ac', 'a', 'c', { kind: 'FS', lag: 1 });
  dep('cm', 'c', 'm', { kind: 'SS' });
  return { store, view };
}

describe('fechas', () => {
  it('dayOf/isoOf ida y vuelta; fechas inválidas', () => {
    expect(isoOf(dayOf('2026-03-02')!)).toBe('2026-03-02');
    expect(dayOf('2026-03-03')! - dayOf('2026-03-02')!).toBe(1);
    expect(dayOf('2024-02-30')).toBeUndefined();
    expect(dayOf('ayer')).toBeUndefined();
    expect(dayOf(42)).toBeUndefined();
    expect(dayOf('2026-03-02T10:00:00Z')).toBe(dayOf('2026-03-02'));
  });

  it('resuelve fin inclusivo, duración, dependencias FS con desfase y SS, y la fase abarca su contenido', () => {
    const { store } = fixture();
    const rows = ganttRowNodes(store, 'vw_g');
    const d = resolveDates(store, 'vw_g', rows);
    const D = (s: string) => dayOf(s)!;
    expect(d.get('el_a')).toEqual({ start: D('2026-03-02'), end: D('2026-03-06'), dated: true });
    expect(d.get('el_b')).toEqual({ start: D('2026-03-04'), end: D('2026-03-06'), dated: true });
    // FS + 1 día: empieza dos días después del último de A (06 → 08) y dura 2
    expect(d.get('el_c')).toEqual({ start: D('2026-03-08'), end: D('2026-03-09'), dated: false });
    // SS: el hito empieza a la vez que C y no ocupa días
    expect(d.get('el_m')).toEqual({ start: D('2026-03-08'), end: D('2026-03-07'), dated: false });
    expect(d.get('el_fase')).toMatchObject({ start: D('2026-03-02'), end: D('2026-03-06') });
  });

  it('FF y SF fijan el fin del sucesor', () => {
    const { store } = fixture();
    store.set('relations', 'rel_cm', { ...store.get('relations', 'rel_cm')!, fields: { kind: 'FF' } });
    let d = resolveDates(store, 'vw_g', ganttRowNodes(store, 'vw_g'));
    expect(d.get('el_m')!.start).toBe(dayOf('2026-03-09')! + 1); // hito al acabar C
    store.set('elements', 'el_c', { ...store.get('elements', 'el_c')!, fields: { duration: 2 } });
    store.set('relations', 'rel_ac', { ...store.get('relations', 'rel_ac')!, fields: { kind: 'SF' } });
    d = resolveDates(store, 'vw_g', ganttRowNodes(store, 'vw_g'));
    // SF: C acaba el día antes de que empiece A
    expect(isoOf(d.get('el_c')!.end)).toBe('2026-03-01');
  });
});

describe('ganttLayout', () => {
  it('filas: la fase y su contenido por y, luego el resto; barras de los campos (no de x/y)', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g', { lang: 'es' });
    expect(l.rows.map(r => `${r.depth}:${r.name}`)).toEqual(['0:fase', '1:a', '1:b', '0:c', '0:m']);
    expect(l.scale).toBe('day');
    expect(l.px).toBe(SCALE_PX.day);
    const a = l.rows[1]!;
    expect(a.bar.x).toBe(xOfDay(l, dayOf('2026-03-02')!));
    expect(a.bar.w).toBe(5 * l.px);
    expect(a.bar.y).toBe(GANTT.headerH + 1 * GANTT.rowH + (GANTT.rowH - GANTT.barH) / 2);
    expect(a.progress).toBe(50);
    expect(l.rows[2]).toMatchObject({ critical: true, assignee: 'Ana' });
    // Hito: rombo centrado en el principio de su día; fase: barra fina de lo que contiene
    const m = l.rows[4]!;
    expect(m.bar.x + m.bar.w / 2).toBe(xOfDay(l, dayOf('2026-03-08')!));
    expect(l.rows[0]!.bar.h).toBe(GANTT.groupH);
    // El día 0 es lunes y la cabecera tiene meses y días
    expect(new Date(l.day0 * 86_400_000).getUTCDay()).toBe(1);
    expect(l.majors[0]!.label).toMatch(/feb|mar/);
    expect(l.minors.length).toBe(l.days);
    expect(l.weekends.length).toBeGreaterThan(0);
    expect(l.height).toBe(GANTT.headerH + 5 * GANTT.rowH + 8);
  });

  it('escala automática y forzada por la vista', () => {
    expect(autoScale(30)).toBe('day');
    expect(autoScale(120)).toBe('week');
    expect(autoScale(400)).toBe('month');
    const { store, view } = fixture();
    store.set('views', view.id, { ...view, style: { ganttScale: 'month' } });
    const l = ganttLayout(store, 'vw_g', { lang: 'en' });
    expect(l.scale).toBe('month');
    expect(new Date(l.day0 * 86_400_000).getUTCDate()).toBe(1);
    expect(l.minors.map(t => t.label)).toContain('Mar');
    expect(l.majors[0]!.label).toBe('2026');
    expect(ganttLayout(store, 'vw_g', { scale: 'week' }).minors[0]!.label).toMatch(/^\d+ /);
  });

  it('dependencias: FS del fin al inicio, SS del inicio al inicio, en codo', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g');
    const fs = l.deps.find(d => d.edgeId === 've_ac')!;
    const a = l.rows[1]!, c = l.rows[3]!;
    expect(fs.kind).toBe('FS');
    expect(fs.points[0]).toEqual({ x: a.bar.x + a.bar.w, y: a.bar.y + a.bar.h / 2 });
    expect(fs.points.at(-1)).toEqual({ x: c.bar.x, y: c.bar.y + c.bar.h / 2 });
    expect(fs.dir).toBe(1);
    // Todos los tramos son horizontales o verticales
    for (const d of l.deps) for (let i = 1; i < d.points.length; i++) expect(d.points[i]!.x === d.points[i - 1]!.x || d.points[i]!.y === d.points[i - 1]!.y).toBe(true);
    const ss = l.deps.find(d => d.edgeId === 've_cm')!;
    expect(ss.points[0]!.x).toBe(c.bar.x);
    expect(ss.kind).toBe('SS');
  });

  it('elbowRoute rodea cuando el destino empieza antes que el origen', () => {
    const r = elbowRoute({ x: 300, y: 50 }, 1, { x: 100, y: 120 }, 1);
    expect(r.length).toBe(6);
    expect(r.at(-1)).toEqual({ x: 100, y: 120 });
    expect(elbowRoute({ x: 100, y: 50 }, 1, { x: 300, y: 120 }, 1)).toEqual([{ x: 100, y: 50 }, { x: 110, y: 50 }, { x: 110, y: 120 }, { x: 300, y: 120 }]);
  });
});

describe('edición', () => {
  it('mover una tarea con fin desplaza inicio y fin; una con duración solo el inicio', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g');
    execute(store, moveCommand(store, l, l.rows[1]!, 3)!);
    expect(store.get('elements', 'el_a')!.fields).toMatchObject({ start: '2026-03-05', end: '2026-03-09', progress: 50 });
    execute(store, moveCommand(store, l, l.rows[2]!, -1)!);
    expect(store.get('elements', 'el_b')!.fields).toMatchObject({ start: '2026-03-03', duration: 3 });
    expect(store.get('elements', 'el_b')!.fields.end).toBeUndefined();
    expect(moveCommand(store, l, l.rows[1]!, 0)).toBeNull();
  });

  it('mover una fase mueve todo lo que contiene; mover una tarea derivada fija sus fechas', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g');
    const cmd = moveCommand(store, l, l.rows[0]!, 7)!;
    expect(cmd.type).toBe('batch');
    execute(store, cmd);
    expect(store.get('elements', 'el_a')!.fields.start).toBe('2026-03-09');
    expect(store.get('elements', 'el_b')!.fields.start).toBe('2026-03-11');
    execute(store, moveCommand(store, l, l.rows[3]!, 1)!);
    expect(store.get('elements', 'el_c')!.fields).toMatchObject({ start: '2026-03-09', duration: 2 });
    execute(store, moveCommand(store, l, l.rows[4]!, 2)!);
    expect(store.get('elements', 'el_m')!.fields.start).toBe('2026-03-10');
  });

  it('redimensionar cambia el fin (y la duración si la usa), nunca menos de un día; solo tareas', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g');
    const a = l.rows[1]!;
    execute(store, resizeCommand(store, l, a, { x: a.bar.x, w: a.bar.w + 2 * l.px })!);
    expect(store.get('elements', 'el_a')!.fields).toMatchObject({ start: '2026-03-02', end: '2026-03-08' });
    const b = l.rows[2]!;
    execute(store, resizeCommand(store, l, b, { x: b.bar.x, w: 1 })!);
    expect(store.get('elements', 'el_b')!.fields).toMatchObject({ start: '2026-03-04', duration: 1 });
    expect(resizeCommand(store, l, l.rows[4]!, { x: 0, w: 100 })).toBeNull();
    expect(resizeCommand(store, l, a, { x: a.bar.x, w: a.bar.w })).toBeNull();
  });

  it('soltar desde la paleta: la tarea empieza el día bajo el puntero y dura 5 días', () => {
    const { store } = fixture();
    const l = ganttLayout(store, 'vw_g');
    const x = xOfDay(l, dayOf('2026-03-10')!) + 3;
    expect(dayAtX(l, x)).toBe(dayOf('2026-03-10'));
    expect(dropFields(l, GANTT_TASK, x)).toEqual({ start: '2026-03-10', duration: 5 });
    expect(dropFields(l, GANTT_MILESTONE, x)).toEqual({ start: '2026-03-10' });
    expect(dropFields(l, GANTT_GROUP, x)).toBeUndefined();
    expect(dropFields(l, 'flow:Process', x)).toBeUndefined();
  });
});
