/** La demo de la web ("Alta de cliente") se simula de punta a punta en sus vistas BPMN y de estados. */
import { describe, it, expect } from 'vitest';
import { demoWorkspace } from '../../../apps/web/src/demo';
import { setLang } from '../../i18n/src';
import { createSimulation, simulationKind } from '../src';

setLang('es');

describe('demo de la web', () => {
  const ws = demoWorkspace();
  const viewOf = (notation: string) => Object.values(ws.views).find(v => v.notationId === notation)!.id;

  it('solo BPMN y estados son simulables', () => {
    expect(Object.values(ws.views).map(v => simulationKind(ws, v.id)).filter(Boolean).sort()).toEqual(['bpmn', 'statechart']);
  });

  it('BPMN: pregunta en «¿Verificado?» y acaba en «Cliente activo» o «Rechazado»', () => {
    const s = createSimulation(ws, viewOf('bpmn'));
    s.start();
    s.run();
    const v = s.view();
    expect(v.status).toBe('waiting');
    const choice = v.actions[0]!;
    expect(choice.kind).toBe('choice');
    expect(choice.options!.map(o => o.label).sort()).toEqual(['no', 'sí']);
    s.perform(choice.id, [choice.options!.find(o => o.label === 'sí')!.id]);
    s.run();
    const end = s.view();
    expect(end.status).toBe('completed');
    expect(end.history.filter(h => h.kind === 'end').map(h => s.nameOf(h.element))).toEqual(['Cliente activo']);
    expect(Object.values(end.nodes).every(m => m === 'visited')).toBe(true);
  });

  it('estados: Pendiente → En verificación → Activo → final', () => {
    const s = createSimulation(ws, viewOf('statechart'));
    s.start();
    expect(s.view().value).toBe('Pendiente');
    expect(s.view().actions.map(a => a.label)).toEqual(['datos completos']);
    s.perform('event:datos completos');
    expect(s.view().value).toBe('En verificación');
    expect(s.view().actionLog.map(a => a.action)).toEqual(['lanzar KYC']);
    s.perform('event:kyc ok');
    expect(s.view().status).toBe('completed');
  });
});
