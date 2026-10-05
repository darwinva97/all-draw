/**
 * Editor, ola 2: conectar con ayuda («Crear y conectar» y veredicto), Ctrl+K (búsqueda con erratas, recientes,
 * submenús, «Añadir <tipo>»), paleta (recientes, favoritos, categorías recordadas), ayuda por campo, montaje por
 * tandas y aristas simplificadas, y validación troceada del panel de problemas. Lo del navegador está en
 * `e2e/editor-wave2.mjs`.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MemoryStore, History, NotationRegistry, CORE_PACK, makeView, makeNode, validate, DEFAULT_VALIDATORS,
  type Validator, type Diagnostic,
} from '@all-draw/core';
import type { Node } from '@xyflow/react';
import { setLang } from '@all-draw/i18n';
import { BPMN_PACK } from '../../notations/bpmn/src';
import { ARCHIMATE_PACK } from '../../notations/archimate/src';
import { STATECHART_PACK } from '../../notations/statechart/src';
import { C4_PACK } from '../../notations/c4/src';
import { ER_PACK } from '../../notations/er/src';
import { UML_CLASS_PACK } from '../../notations/uml-class/src';
import { GANTT_PACK } from '../../notations/gantt/src';
import { DDD_PACK } from '../../notations/ddd/src';
import { EditorProvider } from '../src/context';
import { creatableTargets, defaultOf } from '../src/edges/connect-assist';
import { litePath } from '../src/edges/LiteEdge';
import { scoreText, searchWorkspace, withinOneEdit, type SearchAction } from '../src/search';
import { pushRecent, noteTypeUsed, recentTypes, toggleFavoriteType, favoriteTypes, setCategoryOpen, categoryState, isCategoryOpen, RECENT_TYPES_MAX, noteCmdkChoice, cmdkRecent } from '../src/prefs';
import { planBatches, mountSet, BATCH_FIRST, BATCH_FROM } from '../src/Canvas';
import { validateInSlices, bySeverity, PROBLEMS_PAGE, type IdleSlot } from '../src/panels/Problems';
import { FieldEditor } from '../src/panels/Inspector';
import { Palette } from '../src/panels/Palette';
import { WelcomeNote } from '../src/panels/WelcomeNote';

/** `localStorage` en memoria (los tests corren en Node). */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); },
  };
}
beforeAll(() => setLang('es'));
beforeEach(() => { (globalThis as { localStorage?: Storage }).localStorage = memoryStorage(); });

const reg = () => new NotationRegistry().register(CORE_PACK).register(BPMN_PACK).register(ARCHIMATE_PACK).register(STATECHART_PACK);

describe('«Crear y conectar»: tipos que admiten la relación desde el origen', () => {
  it('BPMN, desde una tarea: tareas, compuertas y finales con flujo de secuencia; ni pools ni carriles', () => {
    const c = creatableTargets(reg(), 'bpmn:Task', 'bpmn', undefined);
    const ids = c.map(x => x.typeId);
    expect(ids).toContain('bpmn:Task');
    expect(ids).toContain('bpmn:ExclusiveGateway');
    expect(ids).toContain('bpmn:EndEvent');
    expect(ids).not.toContain('bpmn:Pool');
    expect(ids).not.toContain('bpmn:Lane');
    expect(c.find(x => x.typeId === 'bpmn:Task')!.relationId).toBe('bpmn:SequenceFlow');
    // A un evento de inicio solo llega un flujo de mensaje (desde otra pool): nunca uno de secuencia, y va detrás
    const start = c.findIndex(x => x.typeId === 'bpmn:StartEvent');
    if (start >= 0) { expect(c[start]!.relationId).not.toBe('bpmn:SequenceFlow'); expect(start).toBeGreaterThan(ids.indexOf('bpmn:EndEvent')); }
  });
  it('los recientes van primero, después los más usados en el espacio', () => {
    const base = creatableTargets(reg(), 'bpmn:Task', 'bpmn', undefined).map(x => x.typeId);
    const usage = new Map([['bpmn:ParallelGateway', 9]]);
    const withUsage = creatableTargets(reg(), 'bpmn:Task', 'bpmn', undefined, { usage }).map(x => x.typeId);
    expect(withUsage[0]).toBe('bpmn:ParallelGateway');
    const withRecent = creatableTargets(reg(), 'bpmn:Task', 'bpmn', undefined, { usage, recent: ['bpmn:EndEvent'] }).map(x => x.typeId);
    expect(withRecent.slice(0, 2)).toEqual(['bpmn:EndEvent', 'bpmn:ParallelGateway']);
    expect(new Set(withRecent)).toEqual(new Set(base));
  });
  it('estados: desde un estado, la transición; un final no es origen de nada', () => {
    const c = creatableTargets(reg(), 'statechart:State', 'statechart', undefined);
    expect(c.length).toBeGreaterThan(0);
    expect(c.every(x => x.relationId === 'statechart:Transition')).toBe(true);
    expect(creatableTargets(reg(), 'statechart:Final', 'statechart', undefined)).toEqual([]);
  });
  it('la relación por defecto del veredicto es la primera del selector', () => {
    const r = reg();
    expect(defaultOf(r, ['bpmn:SequenceFlow'], 'bpmn:Task', 'bpmn:SequenceFlow')).toBe('bpmn:SequenceFlow');
    expect(defaultOf(r, [], 'bpmn:Task')).toBeNull();
  });
});

describe('Ctrl+K: erratas, acentos, recientes y submenús', () => {
  it('una edición como mucho (sustituir, insertar, borrar, cruzar dos vecinas)', () => {
    expect(withinOneEdit('tarea', 'tarea')).toBe(true);
    expect(withinOneEdit('tarae', 'tarea')).toBe(true);
    expect(withinOneEdit('tares', 'tarea')).toBe(true);
    expect(withinOneEdit('tara', 'tarea')).toBe(true);
    expect(withinOneEdit('tareas', 'tarea')).toBe(true);
    expect(withinOneEdit('tarxyz', 'tarea')).toBe(false);
  });
  it('casa con una errata y sin acentos; no con ruido', () => {
    expect(scoreText('conetar', 'Conectar')).toBeGreaterThan(0);
    expect(scoreText('exportr svg', 'Exportar la vista como SVG')).toBeGreaterThan(0);
    expect(scoreText('anadir tarea', 'Añadir Tarea')).toBeGreaterThan(0);
    expect(scoreText('compuerat', 'Compuerta exclusiva')).toBeGreaterThan(0);
    expect(scoreText('zzz', 'Compuerta exclusiva')).toBe(0);
    expect(scoreText('xy', 'xa')).toBe(0); // menos de 3 letras: sin erratas
    // Una coincidencia exacta sigue mandando sobre una con errata
    expect(scoreText('tarea', 'Tarea')).toBeGreaterThan(scoreText('tarae', 'Tarea'));
  });
  it('sin consulta: lo reciente arriba; «Añadir <tipo>» solo al buscar', () => {
    const store = new MemoryStore();
    store.set('views', 'v1', makeView('Uno', { id: 'v1' }));
    store.set('views', 'v2', makeView('Dos', { id: 'v2' }));
    const actions: SearchAction[] = [{ id: 'fit', label: 'Ajustar a la vista' }, { id: 'add:bpmn:Task', label: 'Añadir Tarea', searchOnly: true }];
    const empty = searchWorkspace(store, undefined, '', { actions, recent: ['view:v2'] });
    expect(empty[0]).toMatchObject({ kind: 'view', id: 'v2' });
    expect(empty.some(h => h.id === 'add:bpmn:Task')).toBe(false);
    expect(searchWorkspace(store, undefined, 'anadir tarea', { actions })[0]).toMatchObject({ id: 'add:bpmn:Task' });
    // Modo «Ir a la vista…»: solo vistas
    expect(searchWorkspace(store, undefined, '', { actions, only: 'views' }).every(h => h.kind === 'view')).toBe(true);
    expect(searchWorkspace(store, undefined, 'dso', { actions, only: 'views' }).map(h => h.id)).toEqual(['v2']);
  });
  it('las elecciones recientes se recuerdan (las últimas primero, sin repetir)', () => {
    noteCmdkChoice('view:a'); noteCmdkChoice('action:fit'); noteCmdkChoice('view:a');
    expect(cmdkRecent()).toEqual(['view:a', 'action:fit']);
  });
});

describe('Paleta: recientes, favoritos y categorías plegadas', () => {
  it('recientes: el último primero, sin duplicados y como mucho 8', () => {
    expect(pushRecent(['a', 'b'], 'b', 8)).toEqual(['b', 'a']);
    for (let i = 0; i < 12; i++) noteTypeUsed(`t${i}`);
    noteTypeUsed('t5');
    expect(recentTypes()[0]).toBe('t5');
    expect(recentTypes()).toHaveLength(RECENT_TYPES_MAX);
  });
  it('favoritos se marcan y desmarcan; las categorías recuerdan su estado por notación', () => {
    toggleFavoriteType('bpmn:Task'); toggleFavoriteType('bpmn:EndEvent'); toggleFavoriteType('bpmn:Task');
    expect(favoriteTypes()).toEqual(['bpmn:EndEvent']);
    setCategoryOpen('bpmn', 'events', false);
    expect(isCategoryOpen(categoryState(), 'bpmn', 'events', true)).toBe(false);
    expect(isCategoryOpen(categoryState(), 'archimate', 'events', true)).toBe(true);
    expect(JSON.parse(localStorage.getItem('alldraw:palette:collapsed')!)).toEqual({ bpmn: { events: false } });
  });
  it('la paleta pinta Favoritos y Recientes encima de las categorías, y no monta las plegadas', () => {
    const store = new MemoryStore();
    store.set('views', 'v1', makeView('Proceso', { id: 'v1', notationId: 'bpmn' }));
    noteTypeUsed('bpmn:Task');
    toggleFavoriteType('bpmn:EndEvent');
    setCategoryOpen('bpmn', 'gateways', false);
    const html = renderToStaticMarkup(createElement(EditorProvider, { store, history: new History(store), registry: reg(), initialViewId: 'v1', children: createElement(Palette) }));
    expect(html.indexOf('Favoritos')).toBeGreaterThan(-1);
    expect(html.indexOf('Favoritos')).toBeLessThan(html.indexOf('Recientes'));
    expect(html.indexOf('Recientes')).toBeLessThan(html.indexOf('data-cat="'));
    // Plegada: el `<details>` está, sin sus tipos dentro
    const gw = html.slice(html.indexOf('data-cat="gateways"'), html.indexOf('</details>', html.indexOf('data-cat="gateways"')));
    expect(gw).not.toContain('ad-pal__item');
    // Otras notaciones, plegadas por defecto: sin montar
    expect(html).toContain('data-cat="other:archimate"');
    expect(html).not.toContain('Business Actor');
    // La estrella va junto al tipo (no dentro de su `role="button"`) y fuera del orden de Tab
    expect(html).toMatch(/<\/div><button type="button" class="ad-pal__star is-on" tabindex="-1" aria-pressed="true"/);
  });
});

describe('Ayuda por campo', () => {
  it('el inspector pinta `doc` bajo el campo, enlazado con aria-describedby, y un icono de información', () => {
    const html = renderToStaticMarkup(createElement(FieldEditor, { def: { key: 'guard', label: 'Guarda', kind: 'text', doc: 'Condición entre corchetes.' }, value: '', onChange: () => {} }));
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}" class="ad-field__help">Condición entre corchetes.</small>`);
    expect(html).toContain('ad-field__info');
    const none = renderToStaticMarkup(createElement(FieldEditor, { def: { key: 'x', label: 'X', kind: 'text' }, value: '', onChange: () => {} }));
    expect(none).not.toContain('ad-field__help');
    expect(none).not.toContain('aria-describedby');
  });
  it('los packs de BPMN, C4, ER, UML, Gantt, DDD y estados documentan casi todos sus campos', () => {
    for (const p of [BPMN_PACK, C4_PACK, ER_PACK, UML_CLASS_PACK, GANTT_PACK, DDD_PACK, STATECHART_PACK]) {
      const fields = [...p.elementTypes, ...p.relationTypes].flatMap(t => t.fields ?? []);
      const documented = fields.filter(f => f.doc?.trim()).length;
      expect(documented / fields.length, p.id).toBeGreaterThanOrEqual(0.85);
    }
  });
});

describe('Nota de bienvenida', () => {
  it('se pinta con el texto, plegable y con botón de cerrar; cerrada no se pinta', () => {
    const html = renderToStaticMarkup(createElement(WelcomeNote, { viewId: 'v1', text: 'Qué muestra y cómo seguir.' }));
    expect(html).toContain('Sobre esta plantilla');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Qué muestra y cómo seguir.');
    expect(html).toContain('aria-label="Cerrar la nota de bienvenida"');
    localStorage.setItem('alldraw:welcome:v1', 'closed');
    expect(renderToStaticMarkup(createElement(WelcomeNote, { viewId: 'v1', text: 'x' }))).toBe('');
    localStorage.setItem('alldraw:welcome:v2', 'folded');
    const folded = renderToStaticMarkup(createElement(WelcomeNote, { viewId: 'v2', text: 'Texto' }));
    expect(folded).toContain('aria-expanded="false"');
    expect(folded).not.toContain('Texto</p>');
  });
});

describe('Vistas grandes: montaje por tandas y aristas simplificadas', () => {
  const grid = (n: number, parentEvery = 0): Node[] => Array.from({ length: n }, (_, i) => ({
    id: `n${i}`, position: { x: (i % 30) * 200, y: Math.floor(i / 30) * 100 }, width: 160, height: 56, data: {},
    ...(parentEvery && i % parentEvery === 1 ? { parentId: `n${i - 1}` } : {}),
  }));
  it('lo más cercano al centro de lo que se ve, primero; lo de fuera, al final', () => {
    const nodes = grid(300);
    // Encuadre que ve solo la esquina superior izquierda (x 0–1000, y 0–500)
    const plan = planBatches(nodes, { x: 0, y: 0, zoom: 1 }, { w: 1000, h: 500 }, () => '#ccc');
    expect(plan.order).toHaveLength(300);
    const first = new Set(plan.order.slice(0, 10));
    for (const id of first) { const n = nodes.find(x => x.id === id)!; expect(n.position.x).toBeLessThan(1000); expect(n.position.y).toBeLessThan(500); }
    expect(plan.ghosts).toHaveLength(300);
  });
  it('una tanda incluye siempre el padre de cada hijo', () => {
    const nodes = grid(200, 2);
    const plan = planBatches(nodes, { x: 0, y: 0, zoom: 0.2 }, { w: 1200, h: 800 }, () => '#ccc');
    const set = mountSet(plan, BATCH_FIRST);
    expect(set.size).toBeGreaterThanOrEqual(BATCH_FIRST);
    for (const id of set) { const p = plan.parent.get(id); if (p) expect(set.has(p)).toBe(true); }
    expect(mountSet(plan, Number.MAX_SAFE_INTEGER).size).toBe(200);
    expect(BATCH_FROM).toBeGreaterThan(BATCH_FIRST);
  });
  it('la arista simplificada es una polilínea recta por los bendpoints', () => {
    expect(litePath([{ x: 0, y: 0 }, { x: 10.04, y: 5 }, { x: 20, y: 20 }])).toBe('M0,0 L10,5 L20,20');
  });
});

describe('Panel de problemas: validación troceada en huecos de inactividad', () => {
  const slow = (id: string, ms: number, out: Diagnostic[] = []): Validator => ({ id, run: () => { const t0 = Date.now(); while (Date.now() - t0 < ms) { /* trabajo */ } return out; } });
  it('un validador por hueco cuando no queda tiempo, y el mismo resultado que `validate`', () => {
    const store = new MemoryStore();
    store.set('views', 'v', makeView('V', { id: 'v' }));
    store.set('nodes', 'n', makeNode('v', 'falta', { x: 0, y: 0 }, { id: 'n' }));
    const validators = [...DEFAULT_VALIDATORS, slow('a', 1), slow('b', 1)];
    const queue: ((s?: IdleSlot) => void)[] = [];
    let done: Diagnostic[] | null = null;
    validateInSlices(validators, { store, reg: reg(), viewId: 'v' }, d => { done = d; }, fn => { queue.push(fn); return () => {}; });
    let slots = 0;
    while (queue.length) { slots++; queue.shift()!({ timeRemaining: () => 0 }); }
    expect(slots).toBe(validators.length);
    expect(done).toEqual(validate(store, reg(), validators, 'v'));
    expect(done!.some(d => d.code === 'node-without-element')).toBe(true);
  });
  it('con tiempo libre, varios en el mismo hueco; cancelado, no termina', () => {
    const queue: ((s?: IdleSlot) => void)[] = [];
    let calls = 0;
    const cancel = validateInSlices([slow('a', 0), slow('b', 0), slow('c', 0)], { store: new MemoryStore(), reg: reg() }, () => { calls++; }, fn => { queue.push(fn); return () => {}; });
    queue.shift()!({ timeRemaining: () => 50 });
    expect(calls).toBe(1);
    const q2: ((s?: IdleSlot) => void)[] = [];
    const c2 = validateInSlices([slow('a', 0), slow('b', 0)], { store: new MemoryStore(), reg: reg() }, () => { calls++; }, fn => { q2.push(fn); return () => {}; });
    q2.shift()!({ timeRemaining: () => 0 });
    c2();
    while (q2.length) q2.shift()!({ timeRemaining: () => 0 });
    expect(calls).toBe(1);
    void cancel;
  });
  it('informa de lo que tarda cada validador (el panel retrasa los lentos)', () => {
    const seen: [string, number, number][] = [];
    validateInSlices([slow('rapido', 0), slow('lento', 85)], { store: new MemoryStore(), reg: reg() }, () => {}, fn => { fn({ timeRemaining: () => 0 }); return () => {}; }, (v, d, ms) => seen.push([v.id, d.length, ms]));
    expect(seen.map(x => x[0])).toEqual(['rapido', 'lento']);
    expect(seen[1]![2]).toBeGreaterThanOrEqual(80);
  });
});

describe('Panel de problemas: lista larga', () => {
  it('errores primero, después avisos y notas (estable), y se pinta por páginas', () => {
    const d = (code: string, severity: Diagnostic['severity']): Diagnostic => ({ code, severity, message: code, subject: { collection: 'nodes', id: code }, supportedFixes: [] });
    const out = bySeverity([d('n1', 'info'), d('w1', 'warning'), d('e1', 'error'), d('n2', 'info'), d('e2', 'error')]);
    expect(out.map(x => x.code)).toEqual(['e1', 'e2', 'w1', 'n1', 'n2']);
    expect(PROBLEMS_PAGE).toBeLessThanOrEqual(200);
  });
});
