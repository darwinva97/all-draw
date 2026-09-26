import { describe, it, expect } from 'vitest';
import { importXState, exportXState, XSTATE_VIEW_ID, type XStateConfig } from '../src';

const MACHINE: XStateConfig = {
  id: 'pedido',
  initial: 'nuevo',
  states: {
    nuevo: { entry: 'registrar', exit: ['limpiar', 'avisar'], on: { PAGAR: { target: 'pagando', guard: 'hayStock', actions: ['reservar'] }, CANCELAR: 'cancelado' } },
    pagando: {
      initial: 'esperando',
      states: {
        esperando: { on: { OK: 'confirmado', KO: { target: '#pedido.nuevo' } }, after: { 5000: 'expirado' } },
        expirado: { always: { target: '#pedido.cancelado' } },
        confirmado: { type: 'final' },
      },
      onDone: 'enviado',
      on: { CANCELAR: 'cancelado' },
    } as XStateConfig,
    enviado: {
      type: 'parallel',
      states: {
        transporte: { initial: 'ruta', states: { ruta: { on: { LLEGA: 'entregado' } }, entregado: { type: 'final' } } },
        factura: { initial: 'pendiente', states: { pendiente: { on: { FACTURAR: 'emitida' } }, emitida: {} } },
      },
      on: { ROTO: 'nadie' },
    },
    cancelado: { type: 'final', description: 'Fin' },
  },
};

describe('importXState', () => {
  const { workspace: ws, warnings } = importXState(MACHINE);

  it('crea estados con ruta como id, tipos, entry/exit y pseudoestados iniciales', () => {
    expect(ws.elements['nuevo']).toMatchObject({ typeId: 'statechart:State', name: 'nuevo', fields: { entry: 'registrar', exit: 'limpiar\navisar' } });
    expect(ws.elements['pagando.confirmado']!.typeId).toBe('statechart:Final');
    expect(ws.elements['enviado']!.typeId).toBe('statechart:Parallel');
    expect(ws.elements['enviado.transporte.ruta']).toMatchObject({ typeId: 'statechart:State', name: 'ruta' });
    expect(ws.elements['cancelado']!.doc).toBe('Fin');
    expect(ws.elements['_initial']!.typeId).toBe('statechart:Initial');
    expect(ws.elements['pagando._initial']).toBeDefined();
    expect(ws.relations['_initial-->nuevo']).toMatchObject({ to: { elementId: 'nuevo' } });
  });

  it('crea transiciones con evento, guarda, acciones, retardo y destinos por id', () => {
    const pagar = Object.values(ws.relations).find(r => r.fields.event === 'PAGAR')!;
    expect(pagar).toMatchObject({ from: { elementId: 'nuevo' }, to: { elementId: 'pagando' }, fields: { guard: 'hayStock', actions: ['reservar'] } });
    const ko = Object.values(ws.relations).find(r => r.fields.event === 'KO')!;
    expect(ko.to.elementId).toBe('nuevo');
    const after = Object.values(ws.relations).find(r => r.fields.delay)!;
    expect(after).toMatchObject({ from: { elementId: 'pagando.esperando' }, to: { elementId: 'pagando.expirado' }, fields: { delay: '5000ms' } });
    const always = Object.values(ws.relations).find(r => r.from.elementId === 'pagando.expirado')!;
    expect(always.to.elementId).toBe('cancelado');
    expect(warnings.some(w => w.includes('nadie'))).toBe(true);
  });

  it('crea una vista con anidamiento y los compuestos abarcan a sus hijos', () => {
    const v = ws.views[XSTATE_VIEW_ID]!;
    expect(v.notationId).toBe('statechart');
    const pag = ws.nodes['n:pagando']!, esp = ws.nodes['n:pagando.esperando']!;
    expect(esp.parentNodeId).toBe(pag.id);
    expect(pag.parentNodeId).toBeUndefined();
    expect(esp.x + esp.w).toBeLessThanOrEqual(pag.w);
    expect(esp.y + esp.h).toBeLessThanOrEqual(pag.h);
    const ruta = ws.nodes['n:enviado.transporte.ruta']!;
    expect(ruta.parentNodeId).toBe('n:enviado.transporte');
    const e = Object.values(ws.edges).find(e => e.relationId === Object.values(ws.relations).find(r => r.fields.event === 'PAGAR')!.id)!;
    expect(e.label).toBe('PAGAR [hayStock] / reservar');
  });
});

describe('exportXState', () => {
  it('reconstruye la configuración con nombres como claves', () => {
    const ws = importXState(MACHINE).workspace;
    const { config, warnings } = exportXState(ws);
    expect(warnings).toEqual([]);
    expect(config.id).toBe('pedido');
    expect(config.initial).toBe('nuevo');
    expect(Object.keys(config.states!).sort()).toEqual(['cancelado', 'enviado', 'nuevo', 'pagando']);
    expect(config.states!.nuevo).toMatchObject({ entry: 'registrar', exit: ['limpiar', 'avisar'], on: { PAGAR: { target: 'pagando', guard: 'hayStock', actions: ['reservar'] }, CANCELAR: 'cancelado' } });
    expect(config.states!.pagando!.initial).toBe('esperando');
    expect(config.states!.pagando!.states!.esperando!.on!.OK).toBe('confirmado');
    expect(config.states!.pagando!.states!.esperando!.on!.KO).toBe('#nuevo');
    expect(config.states!.nuevo!.id).toBe('nuevo');
    expect(config.states!.pagando!.states!.esperando!.after).toEqual({ '5000': 'expirado' });
    expect(config.states!.pagando!.states!.expirado!.always).toEqual({ target: '#cancelado' });
    expect(config.states!.pagando!.states!.confirmado).toEqual({ type: 'final' });
    expect(config.states!.enviado!.type).toBe('parallel');
    expect(config.states!.enviado!.initial).toBeUndefined();
    expect(config.states!.enviado!.states!.transporte!.states!.ruta!.on!.LLEGA).toBe('entregado');
    expect(config.states!.cancelado).toEqual({ id: 'cancelado', type: 'final', description: 'Fin' });
  });

  it('ida y vuelta: importar lo exportado da el mismo modelo', () => {
    const a = importXState(MACHINE).workspace;
    const b = importXState(exportXState(a).config).workspace;
    expect(Object.keys(b.elements).sort()).toEqual(Object.keys(a.elements).sort());
    const key = (ws: typeof a) => Object.values(ws.relations).map(r => `${r.from.elementId}|${r.fields.event}|${r.fields.delay ?? ''}|${r.fields.guard}|${(r.fields.actions as string[]).join(',')}|${r.to.elementId}`).sort();
    expect(key(b)).toEqual(key(a));
  });

  it('falla con claridad si no hay vista de estados', () => {
    const ws = importXState(MACHINE).workspace;
    expect(() => exportXState(ws, 'no-existe')).toThrow(/No existe la vista/);
  });
});
