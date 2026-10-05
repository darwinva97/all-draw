import { describe, it, expect } from 'vitest';
import { createMachine, createActor, SimulatedClock } from 'xstate';
import { importXState, exportXState, XSTATE_VIEW_ID, type XStateConfig } from '../../io/src/xstate'; // directo: sin arrastrar todo io
import { buildStatechartModel, startStatechart, StatechartSimulation, createSimulation, evaluate, type StatechartSimOptions } from '../src';
import { scWs, tr, type NodeSpec, type FlowSpec } from './helpers';

const sim = (nodes: NodeSpec[], flows: FlowSpec[], opts: StatechartSimOptions = {}) => {
  const { ws, viewId } = scWs(nodes, flows);
  return startStatechart(buildStatechartModel(ws, viewId), opts);
};
const actionNames = (s: StatechartSimulation) => s.actions.map(a => a.action);
const I = (id: string, parent?: string): NodeSpec => ({ id, type: 'Initial', ...(parent ? { parent } : {}) });
const St = (id: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({ id, type: 'State', ...extra });

describe('modelo de máquina de estados', () => {
  it('jerarquía, iniciales, compuestos y avisos', () => {
    const { ws, viewId } = scWs([I('i'), St('a'), St('b'), I('bi', 'b'), St('b1', { parent: 'b' }), St('b2', { parent: 'b' }), St('b3', { parent: 'b', name: 'b2' })],
      [tr('i', 'a'), tr('bi', 'b2'), tr('a', 'b', 'GO', { delay: 'pronto' })]);
    const m = buildStatechartModel(ws, viewId);
    expect(m.states.b!.kind).toBe('compound');
    expect(m.states.b!.initial).toBe('b2');
    expect(m.states['#root']!.initial).toBe('a');
    expect(m.states.b1!.parent).toBe('b');
    expect(m.transitions.map(t => t.id)).toEqual(['f3']);
    expect(m.transitions[0]!.delayMs).toBe(1000);
    expect(m.warnings.map(w => w.key).sort()).toEqual(['Dos estados hermanos se llaman «{name}»', 'El retardo «{delay}» no es una duración reconocible; se usa 1 s']);
  });
});

describe('simulación de máquinas de estados', () => {
  it('estado inicial, eventos, guardas y acciones en orden (salida, transición, entrada)', () => {
    const s = sim([I('i'), St('pend', { name: 'Pendiente', fields: { exit: 'salirP' } }), St('ver', { name: 'Verificando', fields: { entry: 'lanzarKyc\nregistrar' } }), St('ok', { name: 'Activo' }), St('ko', { name: 'Rechazado' })],
      [tr('i', 'pend'), tr('pend', 'ver', 'DATOS', { actions: ['guardar'] }), tr('ver', 'ok', 'KYC', { guard: 'puntuacion >= 50' }), tr('ver', 'ko', 'KYC', { guard: 'else' })], { variables: { puntuacion: 80 } });
    expect(s.value()).toBe('Pendiente');
    expect(s.status).toBe('waiting');
    expect(s.availableEvents()).toEqual([{ event: 'DATOS', enabled: true, transitions: ['f2'] }]);
    expect(s.send('NADA')).toBe(false);
    expect(s.history.at(-1)).toMatchObject({ kind: 'ignored', detail: 'NADA' });
    s.send('DATOS');
    expect(s.value()).toBe('Verificando');
    expect(actionNames(s)).toEqual(['salirP', 'guardar', 'lanzarKyc', 'registrar']);
    expect(s.actions.map(a => a.kind)).toEqual(['exit', 'transition', 'entry', 'entry']);
    s.send('KYC');
    expect(s.value()).toBe('Activo');
    const s2 = sim([I('i'), St('ver'), St('ok'), St('ko')], [tr('i', 'ver'), tr('ver', 'ok', 'KYC', { guard: 'puntuacion >= 50' }), tr('ver', 'ko', 'KYC', { guard: 'else' })], { variables: { puntuacion: 10 } });
    s2.send('KYC');
    expect(s2.value()).toBe('ko');
  });
  it('estados compuestos: entrar por el inicial, transiciones heredadas del padre y salir de dentro afuera', () => {
    const s = sim([I('i'), St('p', { fields: { entry: 'enP', exit: 'exP' } }), I('pi', 'p'), St('p1', { parent: 'p', fields: { entry: 'enP1', exit: 'exP1' } }), St('p2', { parent: 'p' }), St('fuera')],
      [tr('i', 'p'), tr('pi', 'p1'), tr('p1', 'p2', 'N'), tr('p', 'fuera', 'SALIR')]);
    expect(s.value()).toEqual({ p: 'p1' });
    expect(actionNames(s)).toEqual(['enP', 'enP1']);
    s.send('SALIR');
    expect(s.value()).toBe('fuera');
    expect(actionNames(s).slice(2)).toEqual(['exP1', 'exP']);
  });
  it('autotransición: no sale del estado atómico; en un compuesto reinicia a los hijos; las internas no tocan nada', () => {
    const s = sim([I('i'), St('a', { fields: { entry: 'enA', exit: 'exA' } }), St('c', { fields: { entry: 'enC' } }), I('ci', 'c'), St('c1', { parent: 'c', fields: { entry: 'enC1', exit: 'exC1' } }), St('c2', { parent: 'c', fields: { entry: 'enC2', exit: 'exC2' } })],
      [tr('i', 'a'), tr('a', 'a', 'SELF', { actions: ['t'] }), tr('a', 'c', 'GO'), tr('ci', 'c1'), tr('c1', 'c2', 'N'), tr('c', 'c', 'RESET', { actions: ['r'] }), tr('c', 'c', 'TICK', { internal: true, actions: ['tick'] })]);
    s.send('SELF');
    expect(actionNames(s)).toEqual(['enA', 't']);
    s.send('GO'); s.send('N');
    expect(s.value()).toEqual({ c: 'c2' });
    const n = s.actions.length;
    s.send('TICK');
    expect(actionNames(s).slice(n)).toEqual(['tick']);
    s.send('RESET');
    expect(actionNames(s).slice(n + 1)).toEqual(['exC2', 'r', 'enC1']);
    expect(s.value()).toEqual({ c: 'c1' });
  });
  it('paralelos: todas las regiones a la vez; un evento puede mover varias; final cuando terminan todas', () => {
    const s = sim([I('i'), { id: 'par', type: 'Parallel' }, St('r1', { parent: 'par' }), I('r1i', 'r1'), St('a1', { parent: 'r1' }), { id: 'a2', type: 'Final', parent: 'r1' },
      St('r2', { parent: 'par' }), I('r2i', 'r2'), St('b1', { parent: 'r2' }), { id: 'b2', type: 'Final', parent: 'r2' }, St('fin'), { id: 'F', type: 'Final' }],
      [tr('i', 'par'), tr('r1i', 'a1'), tr('r2i', 'b1'), tr('a1', 'a2', 'AVANZA'), tr('b1', 'b2', 'AVANZA'), tr('par', 'fin', 'done'), tr('fin', 'F', 'FIN')]);
    expect(s.value()).toEqual({ par: { r1: 'a1', r2: 'b1' } });
    s.send('AVANZA');
    expect(s.value()).toBe('fin');
    expect(s.history.filter(h => h.kind === 'done').map(h => h.element)).toEqual(['r1', 'r2', 'par']);
    s.send('FIN');
    expect(s.status).toBe('completed');
    expect(s.send('FIN')).toBe(false);
  });
  it('historia superficial y profunda; sin registro usa la transición por defecto', () => {
    const nodes = (deep: boolean): NodeSpec[] => [I('i'), St('m'), I('mi', 'm'), St('x', { parent: 'm' }), I('xi', 'x'), St('x1', { parent: 'x' }), St('x2', { parent: 'x' }), St('y', { parent: 'm' }), { id: 'h', type: 'History', parent: 'm', fields: { deep } }, St('pausa')];
    const flows: FlowSpec[] = [tr('i', 'm'), tr('mi', 'x'), tr('xi', 'x1'), tr('x1', 'x2', 'N'), tr('x', 'y', 'Y'), tr('m', 'pausa', 'PAUSA'), tr('pausa', 'h', 'SEGUIR'), tr('h', 'y')];
    const shallow = sim(nodes(false), flows);
    shallow.send('SEGUIR');
    shallow.send('PAUSA'); shallow.send('SEGUIR');
    expect(shallow.value()).toEqual({ m: { x: 'x1' } });
    shallow.send('N'); shallow.send('PAUSA'); shallow.send('SEGUIR');
    expect(shallow.value()).toEqual({ m: { x: 'x1' } });
    const deep = sim(nodes(true), flows);
    deep.send('N'); deep.send('PAUSA'); deep.send('SEGUIR');
    expect(deep.value()).toEqual({ m: { x: 'x2' } });
    const dflt = sim([I('i'), St('pausa'), St('m'), I('mi', 'm'), St('x', { parent: 'm' }), St('y', { parent: 'm' }), { id: 'h', type: 'History', parent: 'm' }], [tr('i', 'pausa'), tr('mi', 'x'), tr('pausa', 'h', 'SEGUIR'), tr('h', 'y')]);
    dflt.send('SEGUIR');
    expect(dflt.value()).toEqual({ m: 'y' });
  });
  it('decisión (choice) con guardas y always encadenadas', () => {
    const s = sim([I('i'), St('a'), { id: 'd', type: 'Choice' }, St('alto'), St('bajo')],
      [tr('i', 'a'), tr('a', 'd', 'EVALUAR'), tr('d', 'alto', '', { guard: 'n > 10' }), tr('d', 'bajo', '', { guard: 'else' })], { variables: { n: 50 } });
    s.send('EVALUAR');
    expect(s.value()).toBe('alto');
    expect(s.history.filter(h => h.kind === 'transition').map(h => h.flow)).toEqual(['f2', 'f3']);
  });
  it('after: temporizadores con reloj simulado; salir del estado los cancela', () => {
    const s = sim([I('i'), St('rojo'), St('verde'), St('ambar')], [tr('i', 'rojo'), tr('rojo', 'verde', '', { delay: '30s' }), tr('verde', 'ambar', '', { delay: '25s' }), tr('ambar', 'rojo', '', { delay: '5s' }), tr('verde', 'ambar', 'PEATON')]);
    expect(s.status).toBe('running');
    expect(s.timers()).toEqual([expect.objectContaining({ state: 'rojo', due: 30_000 })]);
    s.step();
    expect(s.value()).toBe('verde');
    expect(s.time).toBe(30_000);
    s.send('PEATON');
    expect(s.timers()).toEqual([expect.objectContaining({ state: 'ambar', due: 35_000 })]);
    s.advance(10_000);
    expect(s.value()).toBe('rojo');
    expect(s.time).toBe(40_000);
    // Ciclo sin fin: run lo detecta como bucle.
    const r = s.run(100);
    expect(r.status).toBe('loop');
    expect(r.steps).toBeLessThan(10);
  });
  it('acciones con variables, raise y always con guarda (contador)', () => {
    const s = sim([I('i'), St('contando', { fields: { entry: 'n = 0' } }), St('listo', { fields: { entry: 'raise(AVISO)' } }), St('avisado')],
      [tr('i', 'contando'), tr('contando', 'contando', 'INC', { internal: true, actions: ['n++'] }), tr('contando', 'listo', '', { guard: 'n >= 3' }), tr('listo', 'avisado', 'AVISO')]);
    expect(s.variables.n).toBe(0);
    s.send('INC'); s.send('INC');
    expect(s.value()).toBe('contando');
    s.send('INC');
    expect(s.value()).toBe('avisado');
    expect(s.actions.find(a => a.action === 'n++')).toMatchObject({ effect: 'assign', detail: 'n = 1' });
  });
  it('always sin salida: se detecta el bucle', () => {
    const s = sim([I('i'), St('a'), St('b')], [tr('i', 'a'), tr('a', 'b'), tr('b', 'a')]);
    expect(s.status).toBe('loop');
    expect(s.history.some(h => h.kind === 'loop')).toBe(true);
  });
  it('bifurcación, unión y terminar (extensiones)', () => {
    const s = sim([I('i'), St('a'), { id: 'fk', type: 'Fork' }, { id: 'par', type: 'Parallel' }, St('r1', { parent: 'par' }), St('x1', { parent: 'r1' }), St('x2', { parent: 'r1' }), St('r2', { parent: 'par' }), St('y1', { parent: 'r2' }), St('y2', { parent: 'r2' }), { id: 'jn', type: 'Join' }, St('fin'), { id: 'X', type: 'Terminate' }],
      [tr('i', 'a'), tr('a', 'fk', 'GO'), tr('fk', 'x2'), tr('fk', 'y2'), tr('x2', 'jn', 'J'), tr('y2', 'jn', 'J'), tr('jn', 'fin'), tr('fin', 'X', 'MATAR')]);
    s.send('GO');
    expect(s.value()).toEqual({ par: { r1: 'x2', r2: 'y2' } });
    s.send('J');
    expect(s.value()).toBe('fin');
    s.send('MATAR');
    expect(s.status).toBe('terminated');
  });
  it('bloqueo: un estado sin salidas que no es final', () => {
    const s = sim([I('i'), St('a'), St('b')], [tr('i', 'a'), tr('a', 'b', 'GO')]);
    s.send('GO');
    expect(s.status).toBe('deadlock');
  });
  it('estado JSON restaurable y fachada con eventos', () => {
    const { ws, viewId } = scWs([I('i'), St('a'), St('b')], [tr('i', 'a'), tr('a', 'b', 'GO', { guard: 'listo' }), tr('b', 'a', 'VOLVER')]);
    const model = buildStatechartModel(ws, viewId);
    const a = startStatechart(model);
    const b = new StatechartSimulation(model, {}, JSON.parse(JSON.stringify(a.snapshot())));
    expect(b.value()).toBe('a');
    const f = createSimulation(ws, viewId, { variables: { listo: false } });
    expect(f.kind).toBe('statechart');
    f.start();
    expect(f.view().actions).toEqual([{ id: 'event:GO', kind: 'event', label: 'GO', enabled: false }]);
    expect(f.variableNames()).toEqual(['listo']);
    f.setVariables({ listo: true });
    expect(f.view().actions[0]!.enabled).toBe(true);
    f.perform('event:GO');
    const v = f.view();
    expect(v.value).toBe('b');
    expect(v.nodes['n:v:b']).toBe('active');
    expect(v.nodes['n:v:a']).toBe('visited');
    expect(v.edges['e:v:f2']).toBe('last');
  });
});

// ---------------------------------------------------------------- compatibilidad con XState v5
/** Ejecuta las mismas secuencias de eventos en el motor propio (sobre el espacio importado) y en XState real (sobre lo exportado). */
function compare(config: XStateConfig, events: string[], vars: Record<string, unknown> = {}) {
  const { workspace } = importXState(config);
  const exported = exportXState(workspace, XSTATE_VIEW_ID).config;
  const log: string[] = [];
  const machine = createMachine(exported as never, {
    actions: new Proxy({}, { get: (_t, k) => () => { log.push(String(k)); } }) as never,
    guards: new Proxy({}, { get: (_t, k) => () => String(k) === 'else' || !!evaluate(String(k), vars) }) as never,
  });
  const clock = new SimulatedClock();
  const actor = createActor(machine, { clock: clock as never }).start();
  const ours = startStatechart(buildStatechartModel(workspace, XSTATE_VIEW_ID), { variables: vars });
  const ourLog = () => ours.actions.map(a => a.action);
  expect(ours.value()).toEqual(actor.getSnapshot().value);
  expect(ourLog()).toEqual(log);
  for (const ev of events) {
    if (ev.startsWith('+')) { const ms = Number(ev.slice(1)); clock.increment(ms); ours.advance(ms); }
    else { actor.send({ type: ev }); ours.send(ev); }
    expect({ ev, value: ours.value() }).toEqual({ ev, value: actor.getSnapshot().value });
    expect({ ev, log: ourLog() }).toEqual({ ev, log: [...log] });
    expect(ours.status === 'completed').toBe(actor.getSnapshot().status === 'done');
  }
}

/** Pseudoaleatorio reproducible. */
function lcg(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

const PEDIDO: XStateConfig = {
  id: 'pedido', initial: 'nuevo',
  states: {
    nuevo: { entry: 'registrar', exit: ['limpiar', 'avisar'], on: { PAGAR: { target: 'pagando', guard: 'hayStock', actions: ['reservar'] }, CANCELAR: 'cancelado', TOCAR: { actions: 'tocar' } } },
    pagando: {
      initial: 'esperando', entry: 'enPagando', exit: 'exPagando',
      states: {
        esperando: { entry: 'enEsperando', on: { OK: 'confirmado', KO: { target: '#pedido.nuevo' } }, after: { 5000: 'expirado' } },
        expirado: { always: { target: '#pedido.cancelado' } },
        confirmado: { entry: 'enConfirmado', on: { ENVIAR: '#pedido.enviado' } },
      },
      on: { CANCELAR: 'cancelado' },
    },
    enviado: {
      type: 'parallel', entry: 'enEnviado',
      states: {
        transporte: { initial: 'ruta', states: { ruta: { on: { LLEGA: 'entregado' } }, entregado: { entry: 'entregar' } } },
        factura: { initial: 'pendiente', states: { pendiente: { on: { FACTURAR: 'emitida' } }, emitida: { on: { ANULAR: 'pendiente' } } } },
      },
      on: { DEVOLVER: 'nuevo' },
    },
    cancelado: { type: 'final', entry: 'enCancelado' },
  },
};

const REPRODUCTOR: XStateConfig = {
  id: 'reproductor', initial: 'apagado',
  states: {
    apagado: { on: { ENCENDER: 'encendido' } },
    encendido: {
      initial: 'parado', entry: 'enEncendido', exit: 'exEncendido',
      states: {
        parado: { entry: 'enParado', on: { PLAY: 'sonando' } },
        sonando: {
          initial: 'normal', entry: 'enSonando', exit: 'exSonando',
          states: { normal: { on: { RAPIDO: 'rapido' } }, rapido: { entry: 'enRapido', on: { NORMAL: 'normal' }, after: { 1000: 'normal' } } },
          on: { PAUSA: 'pausado', STOP: 'parado' },
        },
        pausado: { on: { PLAY: 'historia', PLAY_DEEP: 'hist_deep' } },
        historia: { type: 'history', history: 'shallow' },
        hist_deep: { type: 'history', history: 'deep' },
      },
      on: { APAGAR: 'apagado', REINICIAR: { target: 'encendido', actions: 'reiniciar' }, PING: { actions: 'pong' } },
    },
  },
};

const PUERTA: XStateConfig = {
  id: 'puerta', initial: 'cerrada',
  states: {
    cerrada: { on: { ABRIR: [{ target: 'abierta', guard: 'autorizado', actions: 'log' }, { target: 'alarma' }], BLOQUEAR: 'bloqueada' } },
    bloqueada: { on: { DESBLOQUEAR: { target: 'cerrada', guard: 'conLlave' } } },
    abierta: { entry: 'luz', exit: 'apagarLuz', after: { 3000: 'cerrada' }, on: { CERRAR: 'cerrada', EMPUJAR: { target: 'abierta', actions: 'empujar' } } },
    alarma: { entry: 'sirena', always: [{ target: 'bloqueada', guard: 'grave' }], on: { RESET: 'cerrada' } },
  },
};

describe('compatibilidad con XState v5 (lo que exporta io)', () => {
  it('pedido: compuestos, paralelos, after, always, finales e ids absolutos', () => {
    compare(PEDIDO, ['TOCAR', 'PAGAR', 'OK', 'ENVIAR', 'LLEGA', 'FACTURAR', 'ANULAR', 'DEVOLVER', 'PAGAR', '+5000', 'PAGAR'], { hayStock: true });
    compare(PEDIDO, ['PAGAR', 'CANCELAR'], { hayStock: false });
  });
  it('reproductor: historia superficial y profunda, autotransiciones en compuestos y transiciones del padre', () => {
    compare(REPRODUCTOR, ['ENCENDER', 'PLAY', 'RAPIDO', 'PAUSA', 'PLAY', 'RAPIDO', 'PAUSA', 'PLAY_DEEP', 'PING', 'REINICIAR', 'PLAY', 'RAPIDO', '+999', '+1', 'STOP', 'APAGAR', 'ENCENDER']);
  });
  it('puerta: guardas en listas, always con guarda, after y autotransición', () => {
    compare(PUERTA, ['ABRIR', 'RESET', 'BLOQUEAR', 'DESBLOQUEAR'], { autorizado: false, grave: false, conLlave: false });
    compare(PUERTA, ['ABRIR', 'EMPUJAR', '+2999', 'EMPUJAR', '+3000', 'ABRIR', 'CERRAR'], { autorizado: true, grave: true, conLlave: true });
    compare(PUERTA, ['ABRIR', 'DESBLOQUEAR'], { autorizado: false, grave: true, conLlave: true });
  });
  it('secuencias aleatorias de eventos dan el mismo estado y las mismas acciones', () => {
    const machines: [XStateConfig, string[], Record<string, unknown>][] = [
      [PEDIDO, ['PAGAR', 'CANCELAR', 'OK', 'KO', 'ENVIAR', 'LLEGA', 'FACTURAR', 'ANULAR', 'DEVOLVER', 'TOCAR', '+2500'], { hayStock: true }],
      [REPRODUCTOR, ['ENCENDER', 'APAGAR', 'PLAY', 'PAUSA', 'STOP', 'RAPIDO', 'NORMAL', 'PLAY_DEEP', 'REINICIAR', 'PING', '+600'], {}],
      [PUERTA, ['ABRIR', 'CERRAR', 'BLOQUEAR', 'DESBLOQUEAR', 'RESET', 'EMPUJAR', '+1500'], { autorizado: true, grave: false, conLlave: true }],
    ];
    for (const [cfg, alphabet, vars] of machines) {
      for (let seed = 1; seed <= 15; seed++) {
        const rnd = lcg(seed);
        compare(cfg, Array.from({ length: 25 }, () => alphabet[Math.floor(rnd() * alphabet.length)]!), vars);
      }
    }
  });
});
