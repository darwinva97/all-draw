import { kit, type Tr } from './kit';

/** Máquina de estados: el ciclo de vida de un pedido, con eventos y una guarda. */
export function statechartTemplate(t: Tr) {
  const k = kit(t('Estados de un pedido'));
  const v = k.view(t('Estados de un pedido'), { notationId: 'statechart' });
  const init = k.node(v, k.el('statechart:Initial', ''), 20, 72, 24, 24);
  const pend = k.node(v, k.el('statechart:State', t('Pendiente de pago')), 90, 56, 160, 56);
  const paid = k.node(v, k.el('statechart:State', t('Pagado'), { fields: { entry: t('reservar stock') } }), 330, 56, 140, 56);
  const sent = k.node(v, k.el('statechart:State', t('Enviado')), 550, 56, 140, 56);
  const done = k.node(v, k.el('statechart:State', t('Entregado')), 770, 56, 140, 56);
  const fin = k.node(v, k.el('statechart:Final', ''), 975, 70, 28, 28);
  const cancel = k.node(v, k.el('statechart:State', t('Cancelado'), { fields: { entry: t('devolver el importe') } }), 330, 220, 140, 56);
  const fin2 = k.node(v, k.el('statechart:Final', ''), 386, 340, 28, 28);
  const tr = (a: typeof init, b: typeof init, event: string, guard = '') => k.link(v, 'statechart:Transition', a, b, { fields: { event, guard } });
  tr(init, pend, '');
  tr(pend, paid, t('pago recibido'));
  tr(paid, sent, t('enviar'));
  tr(sent, done, t('entregar'));
  tr(done, fin, '');
  tr(pend, cancel, t('cancelar'));
  tr(paid, cancel, t('cancelar'), t('antes del envío'));
  tr(cancel, fin2, '');
  return k.done(v);
}
