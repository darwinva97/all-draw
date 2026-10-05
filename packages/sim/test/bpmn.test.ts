import { describe, it, expect } from 'vitest';
import { buildBpmnModel, analyzeBpmn, BpmnSimulation, startBpmn, createSimulation, type BpmnSimOptions } from '../src';
import { bpmnWs, type NodeSpec, type FlowSpec } from './helpers';

const sim = (nodes: NodeSpec[], flows: FlowSpec[], opts: BpmnSimOptions = {}) => {
  const { ws, viewId } = bpmnWs(nodes, flows);
  return startBpmn(buildBpmnModel(ws, viewId), opts);
};
const kinds = (s: BpmnSimulation) => s.history.map(h => h.kind);
const visited = (s: BpmnSimulation) => Object.keys(s.snapshot().visitedNodes);
const at = (s: BpmnSimulation) => s.tokens.map(t => t.node).sort();

const T = (id: string, extra: Partial<NodeSpec> = {}): NodeSpec => ({ id, type: 'Task', ...extra });
const S = (id = 'start', extra: Partial<NodeSpec> = {}): NodeSpec => ({ id, type: 'StartEvent', ...extra });
const E = (id = 'end', extra: Partial<NodeSpec> = {}): NodeSpec => ({ id, type: 'EndEvent', ...extra });

describe('modelo BPMN desde una vista', () => {
  it('toma nodos de flujo y flujos de la vista, con ámbitos de subproceso y avisos', () => {
    const { ws, viewId } = bpmnWs(
      [{ id: 'pool', type: 'Pool' }, S('s', { parent: 'pool' }), { id: 'sp', type: 'SubProcess', parent: 'pool' }, S('s2', { parent: 'sp' }), E('e2', { parent: 'sp' }), E('e', { parent: 'pool' }),
        { id: 'tm', type: 'IntermediateCatchEvent', fields: { eventDefinition: 'timer', timer: 'cuando sea' } }],
      [{ from: 's', to: 'sp' }, { from: 's2', to: 'e2' }, { from: 'sp', to: 'e' }],
    );
    const m = buildBpmnModel(ws, viewId);
    expect(Object.keys(m.nodes).sort()).toEqual(['e', 'e2', 's', 's2', 'sp', 'tm']);
    expect(m.nodes.s2!.scope).toBe('sp');
    expect(m.nodes.s!.scope).toBeNull();
    expect(m.nodes.sp!.outgoing).toEqual(['f3']);
    expect(m.nodes.tm!.timerMs).toBe(60_000);
    expect(m.warnings.map(w => w.key)).toContain('El temporizador «{timer}» de «{name}» no es una duración reconocible; se usa 1 min');
  });
  it('avisa de condiciones inválidas, bordes sueltos y bucles sin salida (análisis estático)', () => {
    const { ws, viewId } = bpmnWs(
      [S(), T('a'), T('b'), { id: 'g', type: 'ExclusiveGateway' }, E(), { id: 'b1', type: 'BoundaryEvent', fields: { eventDefinition: 'timer', timer: '1m' } }, T('x'), T('y')],
      [{ from: 'start', to: 'g' }, { from: 'g', to: 'a', condition: 'importe >' }, { from: 'g', to: 'end', condition: 'true' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'x', to: 'y' }],
    );
    const m = buildBpmnModel(ws, viewId);
    const keys = m.warnings.map(w => w.key);
    expect(keys).toContain('La condición «{condition}» del flujo «{name}» no es válida: {error}');
    expect(keys).toContain('El evento de borde «{name}» no está adherido a ninguna actividad de la vista; no se disparará');
    expect(keys).toContain('«{name}» está en un bucle sin salida: desde ahí no se llega a ningún fin');
    const a = analyzeBpmn(m);
    expect(a.traps.sort()).toEqual(['a', 'b']);
    expect(a.unreachable).toEqual(['b1']);
  });
  it('subproceso colapsado con vista de detalle: su contenido viene de esa vista', () => {
    const detail = bpmnWs([S('ds'), T('dt'), E('de')], [{ id: 'd1', from: 'ds', to: 'dt' }, { id: 'd2', from: 'dt', to: 'de' }], { viewId: 'detalle' });
    const { ws, viewId } = bpmnWs([S(), { id: 'sp', type: 'SubProcess', detailView: 'detalle' }, E()], [{ from: 'start', to: 'sp' }, { from: 'sp', to: 'end' }], { ws: detail.ws });
    const m = buildBpmnModel(ws, viewId);
    expect(m.nodes.dt!.scope).toBe('sp');
    expect(m.nodes.dt!.viewId).toBe('detalle');
    const s = startBpmn(m);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toEqual(expect.arrayContaining(['ds', 'dt', 'de', 'sp']));
  });
});

describe('simulación BPMN: secuencia y compuertas', () => {
  it('flujo lineal: inicio → tareas → fin', () => {
    const s = sim([S(), T('a'), T('b'), E()], [{ from: 'start', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'end' }]);
    expect(s.status).toBe('running');
    expect(at(s)).toEqual(['start']);
    s.step();
    expect(at(s)).toEqual(['a']);
    const r = s.run();
    expect(r.status).toBe('completed');
    expect(s.tokens).toHaveLength(0);
    expect(kinds(s)[0]).toBe('start');
    expect(kinds(s).at(-1)).toBe('completed');
    expect(s.snapshot().visitedFlows).toEqual({ f1: 1, f2: 1, f3: 1 });
  });
  it('exclusiva: primera condición cierta, la de por defecto o pregunta', () => {
    const nodes = [S(), { id: 'g', type: 'ExclusiveGateway' }, T('alto'), T('medio'), T('bajo'), E()];
    const flows: FlowSpec[] = [{ from: 'start', to: 'g' }, { from: 'g', to: 'alto', condition: 'importe > 1000' }, { from: 'g', to: 'medio', condition: 'importe > 100' }, { from: 'g', to: 'bajo', default: true },
      { from: 'alto', to: 'end' }, { from: 'medio', to: 'end' }, { from: 'bajo', to: 'end' }];
    const run = (importe?: number) => { const s = sim(nodes, flows, { variables: importe === undefined ? {} : { importe } }); s.run(); return s; };
    expect(visited(run(5000))).toContain('alto');
    expect(visited(run(5000))).not.toContain('medio');
    expect(visited(run(500))).toContain('medio');
    expect(visited(run(5))).toContain('bajo');
    expect(visited(run())).toContain('bajo');
    expect(run(5000).history.find(h => h.kind === 'decision')?.detail).toBe('importe > 1000');
  });
  it('exclusiva sin condiciones: pregunta, y elegir continúa', () => {
    const s = sim([S(), { id: 'g', type: 'ExclusiveGateway', name: '¿Verificado?' }, T('si'), E('no'), E()], [{ from: 'start', to: 'g' }, { from: 'g', to: 'si', name: 'sí' }, { from: 'g', to: 'no', name: 'no' }, { from: 'si', to: 'end' }]);
    s.run();
    expect(s.status).toBe('waiting');
    const acts = s.available();
    expect(acts).toEqual([{ id: expect.stringMatching(/^choice:/), kind: 'choice', token: expect.any(Number), element: 'g', flows: ['f2', 'f3'], multi: false }]);
    expect(s.choose(acts[0]!.kind === 'choice' ? acts[0]!.token : 0, ['f2', 'f3'])).toBe(false);
    expect(s.perform(acts[0]!.id, ['f2'])).toBe(true);
    expect(s.run().status).toBe('completed');
    expect(visited(s)).toContain('si');
    expect(kinds(s)).toContain('choice');
  });
  it('exclusiva: una condición rota se registra y cuenta como falsa', () => {
    const s = sim([S(), { id: 'g', type: 'ExclusiveGateway' }, T('a'), T('b'), E()], [{ from: 'start', to: 'g' }, { from: 'g', to: 'a', condition: 'x >' }, { from: 'g', to: 'b', default: true }, { from: 'a', to: 'end' }, { from: 'b', to: 'end' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('b');
    expect(s.history.find(h => h.kind === 'condition-error')?.detail).toMatch(/^x >:/);
  });
  it('paralela: bifurca y une cuando llegan todas las ramas', () => {
    const s = sim([S(), { id: 'fork', type: 'ParallelGateway' }, T('a', { props: { duration: '5m' } }), T('b', { props: { duration: '10m' } }), { id: 'join', type: 'ParallelGateway' }, T('c'), E()],
      [{ from: 'start', to: 'fork' }, { from: 'fork', to: 'a' }, { from: 'fork', to: 'b' }, { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'join', to: 'c' }, { from: 'c', to: 'end' }]);
    s.step(); s.step();
    expect(at(s)).toEqual(['a', 'b']);
    let sawWait = false;
    while (s.status === 'running') { s.step(); if (s.tokens.some(t => t.node === 'join' && t.wait === 'join')) sawWait = true; }
    expect(sawWait).toBe(true);
    expect(s.status).toBe('completed');
    expect(s.time).toBe(600_000);
    expect(s.history.filter(h => h.kind === 'join')).toHaveLength(1);
    expect(s.snapshot().visitedNodes.c).toBeGreaterThanOrEqual(1);
    expect(s.history.filter(h => h.kind === 'end' && h.element === 'end')).toHaveLength(1);
  });
  it('bloqueo: una unión paralela tras una exclusiva espera para siempre', () => {
    const s = sim([S(), { id: 'x', type: 'ExclusiveGateway' }, T('a'), T('b'), { id: 'join', type: 'ParallelGateway', name: 'Unir' }, E()],
      [{ from: 'start', to: 'x' }, { from: 'x', to: 'a', condition: 'true' }, { from: 'x', to: 'b', default: true, name: 'otra' }, { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'join', to: 'end' }]);
    s.run();
    expect(s.status).toBe('deadlock');
    expect(s.snapshot().blocked).toEqual([{ token: expect.any(Number), element: 'join', reason: 'join', missing: ['b'] }]);
    expect(kinds(s)).toContain('deadlock');
    const v = createSimulation(...Object.values(bpmnWs([S(), { id: 'x', type: 'ExclusiveGateway' }, T('a'), T('b'), { id: 'join', type: 'ParallelGateway' }, E()],
      [{ from: 'start', to: 'x' }, { from: 'x', to: 'a', condition: 'true' }, { from: 'x', to: 'b', default: true }, { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'join', to: 'end' }])) as [never, string]);
    v.run();
    expect(v.view().nodes['n:v:join']).toBe('blocked');
  });
  it('inclusiva: sigue todas las ramas ciertas y une solo las que se activaron', () => {
    const nodes = [S(), { id: 'or', type: 'InclusiveGateway' }, T('a'), T('b', { props: { duration: '1h' } }), T('c'), { id: 'join', type: 'InclusiveGateway' }, E()];
    const flows: FlowSpec[] = [{ from: 'start', to: 'or' }, { from: 'or', to: 'a', condition: 'x > 0' }, { from: 'or', to: 'b', condition: 'y > 0' }, { from: 'or', to: 'c', default: true },
      { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'c', to: 'join' }, { from: 'join', to: 'end' }];
    const both = sim(nodes, flows, { variables: { x: 1, y: 1 } });
    both.run();
    expect(both.status).toBe('completed');
    expect(visited(both)).toEqual(expect.arrayContaining(['a', 'b']));
    expect(visited(both)).not.toContain('c');
    expect(both.history.filter(h => h.kind === 'join')).toEqual([expect.objectContaining({ detail: '2' })]);
    expect(both.history.filter(h => h.kind === 'end' && h.element === 'end')).toHaveLength(1);
    const one = sim(nodes, flows, { variables: { x: 1, y: 0 } });
    one.run();
    expect(one.status).toBe('completed');
    expect(one.history.filter(h => h.kind === 'join')).toEqual([expect.objectContaining({ detail: '1' })]);
    const none = sim(nodes, flows, { variables: {} });
    none.run();
    expect(visited(none)).toContain('c');
  });
  it('inclusiva sin condiciones: pregunta (varias ramas a la vez)', () => {
    const s = sim([S(), { id: 'or', type: 'InclusiveGateway' }, T('a'), T('b'), T('c'), { id: 'join', type: 'InclusiveGateway' }, E()],
      [{ from: 'start', to: 'or' }, { from: 'or', to: 'a' }, { from: 'or', to: 'b' }, { from: 'or', to: 'c' }, { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'c', to: 'join' }, { from: 'join', to: 'end' }]);
    s.run();
    const choice = s.available()[0]!;
    expect(choice).toMatchObject({ kind: 'choice', multi: true, flows: ['f2', 'f3', 'f4'] });
    s.perform(choice.id, ['f2', 'f4']);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).not.toContain('b');
  });
  it('compleja: se simula como inclusiva y avisa', () => {
    const s = sim([S(), { id: 'cx', type: 'ComplexGateway' }, T('a'), E()], [{ from: 'start', to: 'cx' }, { from: 'cx', to: 'a', condition: 'true' }, { from: 'a', to: 'end' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(s.history.some(h => h.warning?.key === 'La compuerta compleja «{name}» se simula como inclusiva')).toBe(true);
  });
});

describe('simulación BPMN: eventos y tiempo', () => {
  it('temporizador intermedio: el reloj simulado salta al vencimiento', () => {
    const s = sim([S(), { id: 'w', type: 'IntermediateCatchEvent', fields: { eventDefinition: 'timer', timer: 'PT15M' } }, E()], [{ from: 'start', to: 'w' }, { from: 'w', to: 'end' }]);
    s.step(); s.step();
    expect(s.tokens[0]).toMatchObject({ node: 'w', wait: 'timer' });
    expect(s.time).toBe(0);
    s.run();
    expect(s.time).toBe(900_000);
    expect(s.status).toBe('completed');
    expect(s.history.find(h => h.kind === 'timer')?.time).toBe(900_000);
  });
  it('mensaje intermedio: espera a que el usuario lo dispare', () => {
    const s = sim([S(), { id: 'm', type: 'IntermediateCatchEvent', name: 'Pago recibido', fields: { eventDefinition: 'message' } }, E()], [{ from: 'start', to: 'm' }, { from: 'm', to: 'end' }]);
    s.run();
    expect(s.status).toBe('waiting');
    const a = s.available();
    expect(a).toEqual([expect.objectContaining({ kind: 'message', element: 'm', source: 'catch' })]);
    expect(s.trigger('m')).toBe(true);
    expect(s.run().status).toBe('completed');
  });
  it('señal: un lanzamiento despierta a quien la espera', () => {
    const s = sim([S(), { id: 'fork', type: 'ParallelGateway' }, { id: 'catch', type: 'IntermediateCatchEvent', name: 'Listo', fields: { eventDefinition: 'signal' } }, T('a'), { id: 'throw', type: 'IntermediateThrowEvent', name: 'Listo', fields: { eventDefinition: 'signal' } }, E('e1'), E('e2')],
      [{ from: 'start', to: 'fork' }, { from: 'fork', to: 'catch' }, { from: 'fork', to: 'a' }, { from: 'a', to: 'throw' }, { from: 'throw', to: 'e2' }, { from: 'catch', to: 'e1' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(s.history.filter(h => h.kind === 'signal').map(h => h.element)).toEqual(['throw', 'catch']);
  });
  it('condicional: espera hasta que las variables cumplen la condición', () => {
    const s = sim([S(), { id: 'c', type: 'IntermediateCatchEvent', fields: { eventDefinition: 'conditional', condition: 'stock > 0' } }, E()], [{ from: 'start', to: 'c' }, { from: 'c', to: 'end' }], { variables: { stock: 0 } });
    s.run();
    expect(s.status).toBe('waiting');
    expect(s.available()).toEqual([expect.objectContaining({ kind: 'condition', condition: 'stock > 0' })]);
    s.setVariables({ stock: 3 });
    s.run();
    expect(s.status).toBe('completed');
  });
  it('enlace: el lanzamiento salta a la captura con el mismo nombre', () => {
    const s = sim([S(), { id: 'lt', type: 'IntermediateThrowEvent', name: 'A', fields: { eventDefinition: 'link' } }, { id: 'lc', type: 'IntermediateCatchEvent', name: 'A', fields: { eventDefinition: 'link' } }, T('t'), E()],
      [{ from: 'start', to: 'lt' }, { from: 'lc', to: 't' }, { from: 't', to: 'end' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('t');
    expect(kinds(s)).toContain('link');
  });
  it('compuerta basada en eventos: gana el primero (temporizador o mensaje)', () => {
    const nodes = [S(), { id: 'eg', type: 'EventBasedGateway' }, { id: 'msg', type: 'IntermediateCatchEvent', name: 'Respuesta', fields: { eventDefinition: 'message' } }, { id: 'tmo', type: 'IntermediateCatchEvent', fields: { eventDefinition: 'timer', timer: '2d' } }, T('ok'), T('reclamar'), E()];
    const flows: FlowSpec[] = [{ from: 'start', to: 'eg' }, { from: 'eg', to: 'msg' }, { from: 'eg', to: 'tmo' }, { from: 'msg', to: 'ok' }, { from: 'tmo', to: 'reclamar' }, { from: 'ok', to: 'end' }, { from: 'reclamar', to: 'end' }];
    const timeout = sim(nodes, flows);
    timeout.run();
    expect(timeout.status).toBe('completed');
    expect(visited(timeout)).toContain('reclamar');
    expect(visited(timeout)).not.toContain('ok');
    expect(timeout.time).toBe(172_800_000);
    const answered = sim(nodes, flows);
    answered.step(); answered.step();
    expect(answered.tokens[0]!.wait).toBe('eventGateway');
    expect(answered.available().map(a => a.element)).toEqual(['msg']);
    answered.trigger('msg');
    answered.run();
    expect(visited(answered)).toContain('ok');
    expect(visited(answered)).not.toContain('reclamar');
    expect(answered.time).toBe(0);
  });
  it('flujo de mensaje: la tarea de envío entrega a la captura de la otra pool', () => {
    const s = sim([S('s1'), T('enviar', { fields: { taskType: 'send' } }), E('e1'), S('s2'), { id: 'rx', type: 'IntermediateCatchEvent', fields: { eventDefinition: 'message' } }, E('e2')],
      [{ from: 's1', to: 'enviar' }, { from: 'enviar', to: 'e1' }, { from: 's2', to: 'rx' }, { from: 'rx', to: 'e2' }, { id: 'mf', from: 'enviar', to: 'rx', type: 'bpmn:MessageFlow' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(s.snapshot().visitedFlows.mf).toBe(1);
  });
  it('mensaje que llega antes que el token queda en el buzón', () => {
    const s = sim([S('s1'), T('enviar'), E('e1'), S('s2'), T('largo', { props: { duration: '1h' } }), { id: 'rx', type: 'Task', fields: { taskType: 'receive' } }, E('e2')],
      [{ from: 's1', to: 'enviar' }, { from: 'enviar', to: 'e1' }, { from: 's2', to: 'largo' }, { from: 'largo', to: 'rx' }, { from: 'rx', to: 'e2' }, { id: 'mf', from: 'enviar', to: 'rx', type: 'bpmn:MessageFlow' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(s.snapshot().mailbox).toEqual({});
  });
});

describe('simulación BPMN: subprocesos, bordes y fines', () => {
  const sub = (extraNodes: NodeSpec[] = [], extraFlows: FlowSpec[] = []): [NodeSpec[], FlowSpec[]] => [
    [S(), { id: 'sp', type: 'SubProcess' }, S('is', { parent: 'sp' }), T('it', { parent: 'sp', props: { duration: '10m' } }), E('ie', { parent: 'sp' }), T('after'), E(), ...extraNodes],
    [{ from: 'start', to: 'sp' }, { from: 'is', to: 'it' }, { from: 'it', to: 'ie' }, { from: 'sp', to: 'after' }, { from: 'after', to: 'end' }, ...extraFlows],
  ];
  it('entra en el subproceso, lo recorre y sale', () => {
    const s = sim(...sub());
    s.step(); s.step();
    expect(s.tokens.map(t => [t.node, t.wait ?? t.state])).toEqual([['sp', 'subprocess'], ['is', 'ready']]);
    s.run();
    expect(s.status).toBe('completed');
    expect(kinds(s)).toEqual(expect.arrayContaining(['subprocess-start', 'subprocess-end']));
    expect(s.history.findIndex(h => h.kind === 'subprocess-end')).toBeLessThan(s.history.findIndex(h => h.element === 'after'));
  });
  it('borde de temporizador interruptor: cancela el subproceso y sigue por el borde', () => {
    const s = sim(...sub([{ id: 'b', type: 'BoundaryEvent', fields: { eventDefinition: 'timer', timer: '5m', attachedTo: 'sp' } }, T('escalar'), E('e3')], [{ from: 'b', to: 'escalar' }, { from: 'escalar', to: 'e3' }]));
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('escalar');
    expect(visited(s)).not.toContain('after');
    expect(visited(s)).not.toContain('ie');
    expect(s.time).toBe(300_000);
    expect(s.history.find(h => h.kind === 'boundary')?.detail).toBe('interrupting');
  });
  it('borde no interruptor: lanza otro token y la actividad sigue', () => {
    const s = sim(...sub([{ id: 'b', type: 'BoundaryEvent', fields: { eventDefinition: 'timer', timer: '5m', attachedTo: 'sp', interrupting: false } }, T('avisar'), E('e3')], [{ from: 'b', to: 'avisar' }, { from: 'avisar', to: 'e3' }]));
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toEqual(expect.arrayContaining(['avisar', 'after', 'ie']));
    expect(s.history.filter(h => h.kind === 'boundary')).toHaveLength(1);
    expect(s.time).toBe(600_000);
  });
  it('borde de mensaje en una tarea: el usuario lo dispara mientras la tarea está en curso', () => {
    const s = sim([S(), T('t', { props: { duration: '1h' } }), E(), { id: 'b', type: 'BoundaryEvent', name: 'Cancelado', fields: { eventDefinition: 'message', attachedTo: 't' } }, E('ec')],
      [{ from: 'start', to: 't' }, { from: 't', to: 'end' }, { from: 'b', to: 'ec' }]);
    s.step(); s.step();
    expect(s.available()).toEqual([expect.objectContaining({ kind: 'message', element: 'b', source: 'boundary' })]);
    s.trigger('b');
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('ec');
    expect(visited(s)).not.toContain('end');
    expect(s.time).toBe(0);
  });
  it('borde condicional: se dispara cuando la condición pasa a cumplirse', () => {
    const s = sim([S(), T('t', { fields: { taskType: 'user' } }), E(), { id: 'b', type: 'BoundaryEvent', fields: { eventDefinition: 'conditional', condition: 'urgente', attachedTo: 't', interrupting: false } }, E('eb')],
      [{ from: 'start', to: 't' }, { from: 't', to: 'end' }, { from: 'b', to: 'eb' }], { manualTasks: true });
    s.run();
    expect(s.status).toBe('waiting');
    s.setVariables({ urgente: true });
    expect(visited(s)).toContain('b');
    s.run();
    expect(s.tokens.map(t => t.node)).toEqual(['t']);
    const done = s.available().find(a => a.kind === 'complete')!;
    s.perform(done.id);
    s.run();
    expect(s.status).toBe('completed');
  });
  it('error en un subproceso: lo captura el evento de borde de error', () => {
    const s = sim([S(), { id: 'sp', type: 'SubProcess' }, S('is', { parent: 'sp' }), E('err', { parent: 'sp', fields: { eventDefinition: 'error' } }), T('after'), E(), { id: 'be', type: 'BoundaryEvent', fields: { eventDefinition: 'error', attachedTo: 'sp' } }, T('reparar'), E('e2')],
      [{ from: 'start', to: 'sp' }, { from: 'is', to: 'err' }, { from: 'sp', to: 'after' }, { from: 'after', to: 'end' }, { from: 'be', to: 'reparar' }, { from: 'reparar', to: 'e2' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('reparar');
    expect(visited(s)).not.toContain('after');
  });
  it('error sin capturar: la simulación falla', () => {
    const s = sim([S(), E('err', { fields: { eventDefinition: 'error' } })], [{ from: 'start', to: 'err' }]);
    s.run();
    expect(s.status).toBe('failed');
    expect(s.history.at(-1)).toMatchObject({ kind: 'error', detail: 'uncaught' });
  });
  it('escalado no interruptor: el subproceso sigue y se abre otra rama', () => {
    const s = sim([S(), { id: 'sp', type: 'SubProcess' }, S('is', { parent: 'sp' }), { id: 'esc', type: 'IntermediateThrowEvent', parent: 'sp', fields: { eventDefinition: 'escalation' } }, E('ie', { parent: 'sp' }), E(),
      { id: 'b', type: 'BoundaryEvent', fields: { eventDefinition: 'escalation', attachedTo: 'sp', interrupting: false } }, T('avisar'), E('e2')],
      [{ from: 'start', to: 'sp' }, { from: 'is', to: 'esc' }, { from: 'esc', to: 'ie' }, { from: 'sp', to: 'end' }, { from: 'b', to: 'avisar' }, { from: 'avisar', to: 'e2' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toEqual(expect.arrayContaining(['avisar', 'ie', 'end']));
  });
  it('fin de terminación: mata todos los tokens', () => {
    const s = sim([S(), { id: 'fork', type: 'ParallelGateway' }, T('rapida'), T('lenta', { props: { duration: '1d' } }), E('term', { fields: { eventDefinition: 'terminate' } }), E()],
      [{ from: 'start', to: 'fork' }, { from: 'fork', to: 'rapida' }, { from: 'fork', to: 'lenta' }, { from: 'rapida', to: 'term' }, { from: 'lenta', to: 'end' }]);
    s.run();
    expect(s.status).toBe('terminated');
    expect(s.tokens).toHaveLength(0);
    expect(visited(s)).not.toContain('end');
    expect(s.step()).toBe(false);
  });
  it('terminación dentro de un subproceso: solo termina el subproceso', () => {
    const s = sim([S(), { id: 'sp', type: 'SubProcess' }, S('is', { parent: 'sp' }), { id: 'f', type: 'ParallelGateway', parent: 'sp' }, T('x', { parent: 'sp', props: { duration: '1h' } }), E('t', { parent: 'sp', fields: { eventDefinition: 'terminate' } }), E('ix', { parent: 'sp' }), T('after'), E()],
      [{ from: 'start', to: 'sp' }, { from: 'is', to: 'f' }, { from: 'f', to: 'x' }, { from: 'f', to: 't' }, { from: 'x', to: 'ix' }, { from: 'sp', to: 'after' }, { from: 'after', to: 'end' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('after');
    expect(visited(s)).not.toContain('ix');
  });
  it('subproceso de evento interruptor por mensaje', () => {
    const s = sim([S(), T('larga', { props: { duration: '1d' } }), E(), { id: 'es', type: 'EventSubProcess' }, S('ms', { parent: 'es', name: 'Anulación', fields: { eventDefinition: 'message' } }), T('anular', { parent: 'es' }), E('ee', { parent: 'es' })],
      [{ from: 'start', to: 'larga' }, { from: 'larga', to: 'end' }, { from: 'ms', to: 'anular' }, { from: 'anular', to: 'ee' }]);
    s.step(); s.step();
    const a = s.available().find(x => x.element === 'ms')!;
    expect(a).toMatchObject({ kind: 'message', source: 'eventSub' });
    s.perform(a.id);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toContain('anular');
    expect(visited(s)).not.toContain('end');
  });
  it('subproceso de evento de temporizador no interruptor', () => {
    const s = sim([S(), T('larga', { props: { duration: '2h' } }), E(), { id: 'es', type: 'EventSubProcess' }, S('ts', { parent: 'es', fields: { eventDefinition: 'timer', timer: '1h', interrupting: false } }), T('recordar', { parent: 'es' }), E('ee', { parent: 'es' })],
      [{ from: 'start', to: 'larga' }, { from: 'larga', to: 'end' }, { from: 'ts', to: 'recordar' }, { from: 'recordar', to: 'ee' }]);
    s.run();
    expect(s.status).toBe('completed');
    expect(visited(s)).toEqual(expect.arrayContaining(['recordar', 'end']));
    expect(s.time).toBe(7_200_000);
  });
  it('tareas manuales: esperan a completar', () => {
    const s = sim([S(), T('u', { fields: { taskType: 'user' } }), T('auto', { fields: { taskType: 'service' } }), E()], [{ from: 'start', to: 'u' }, { from: 'u', to: 'auto' }, { from: 'auto', to: 'end' }], { manualTasks: true });
    s.run();
    expect(s.status).toBe('waiting');
    const c = s.available()[0]!;
    expect(c).toMatchObject({ kind: 'complete', element: 'u' });
    expect(s.complete(-1)).toBe(false);
    s.perform(c.id);
    expect(s.run().status).toBe('completed');
  });
});

describe('simulación BPMN: bucles, estado y solo lectura', () => {
  it('detecta un bucle sin salida en ejecución y para', () => {
    const s = sim([S(), T('reintentar'), { id: 'g', type: 'ExclusiveGateway' }, E()], [{ from: 'start', to: 'reintentar' }, { from: 'reintentar', to: 'g' }, { from: 'g', to: 'end', condition: 'ok' }, { from: 'g', to: 'reintentar', default: true }], { variables: { ok: false } });
    const r = s.run(500);
    expect(r.status).toBe('loop');
    expect(r.stoppedByLimit).toBe(false);
    expect(r.steps).toBeLessThan(20);
    expect(s.history.find(h => h.kind === 'loop')?.detail).toBeTruthy();
    // Cambiar las variables saca del bucle.
    s.setVariables({ ok: true });
    expect(s.run().status).toBe('completed');
  });
  it('un bucle con salida no se marca como bucle', () => {
    const s = sim([S(), T('a'), { id: 'g', type: 'ExclusiveGateway' }, E()], [{ from: 'start', to: 'a' }, { from: 'a', to: 'g' }, { from: 'g', to: 'end', condition: 'true' }, { from: 'g', to: 'a', default: true }]);
    expect(s.run().status).toBe('completed');
  });
  it('run se detiene en maxSteps', () => {
    const s = sim([S(), T('a'), T('b'), T('c'), E()], [{ from: 'start', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'end' }]);
    const r = s.run(3);
    expect(r).toMatchObject({ steps: 3, status: 'running', stoppedByLimit: true });
  });
  it('el estado es JSON y se puede restaurar a mitad', () => {
    const { ws, viewId } = bpmnWs([S(), { id: 'fork', type: 'ParallelGateway' }, T('a', { props: { duration: '5m' } }), T('b'), { id: 'join', type: 'ParallelGateway' }, E()],
      [{ from: 'start', to: 'fork' }, { from: 'fork', to: 'a' }, { from: 'fork', to: 'b' }, { from: 'a', to: 'join' }, { from: 'b', to: 'join' }, { from: 'join', to: 'end' }]);
    const model = buildBpmnModel(ws, viewId);
    const a = startBpmn(model);
    a.step(); a.step(); a.step();
    const saved = JSON.parse(JSON.stringify(a.snapshot()));
    const b = new BpmnSimulation(JSON.parse(JSON.stringify(model)), {}, saved);
    a.run(); b.run();
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(b.status).toBe('completed');
  });
  it('no modifica el espacio', () => {
    const { ws, viewId } = bpmnWs([S(), { id: 'g', type: 'ExclusiveGateway' }, T('a'), E()], [{ from: 'start', to: 'g' }, { from: 'g', to: 'a', condition: 'x > 1' }, { from: 'g', to: 'end', default: true }, { from: 'a', to: 'end' }]);
    const before = JSON.stringify(ws);
    const s = createSimulation(ws, viewId, { variables: { x: 5 } });
    s.start(); s.run(); s.setVariables({ x: 0 }); s.start(); s.run();
    expect(JSON.stringify(ws)).toBe(before);
  });
  it('fachada: resaltado de nodos y aristas, acciones y nombres', () => {
    const { ws, viewId } = bpmnWs([S('s', { name: 'Solicitud' }), { id: 'g', type: 'ExclusiveGateway', name: '¿OK?' }, T('a', { name: 'Alta' }), E('e', { name: 'Fin' })],
      [{ from: 's', to: 'g' }, { from: 'g', to: 'a', name: 'sí' }, { from: 'g', to: 'e', name: 'no' }, { from: 'a', to: 'e' }]);
    const s = createSimulation(ws, viewId);
    expect(s.kind).toBe('bpmn');
    s.start();
    expect(s.view().nodes).toEqual({ 'n:v:s': 'active' });
    s.run();
    const v = s.view();
    expect(v.status).toBe('waiting');
    expect(v.nodes['n:v:g']).toBe('waiting');
    expect(v.nodes['n:v:s']).toBe('visited');
    expect(v.edges['e:v:f1']).toBe('visited');
    expect(v.actions).toEqual([{ id: expect.any(String), kind: 'choice', element: 'g', label: '¿OK?', enabled: true, multi: false, options: [{ id: 'f2', label: 'sí' }, { id: 'f3', label: 'no' }] }]);
    s.perform(v.actions[0]!.id, ['f2']);
    expect(s.view().edges['e:v:f2']).toBe('last');
    expect(s.nameOf('f4')).toBe('Alta → Fin');
    expect(s.nameOf('a')).toBe('Alta');
  });
});
