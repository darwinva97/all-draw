import { kit, type Tr } from './kit';

/** Actividad UML: tramitar un pedido en dos calles, con decisión, bifurcación y unión, nodo objeto y señales. */
export function activityTemplate(t: Tr) {
  const k = kit(t('Tramitar un pedido'));
  const v = k.view(t('Tramitar un pedido'), { notationId: 'activity' });
  const cli = k.node(v, k.el('activity:Partition', t('Cliente')), 0, 0, 1080, 150);
  const shop = k.node(v, k.el('activity:Partition', t('Tienda')), 0, 170, 1080, 330);
  // Inicial, finales y barras no llevan rótulo en UML: `text: ''` evita que se pinte el nombre del tipo debajo.
  const n = (typeId: string, name: string, x: number, y: number, w: number, h: number, parent: typeof cli, fields: Record<string, unknown> = {}) => k.node(v, k.el(typeId, name, { fields }), x, y, w, h, { parentNodeId: parent.id, ...(name ? {} : { text: '' }) });
  const ini = n('activity:Initial', '', 50, 60, 30, 30, cli);
  const hacer = n('activity:Action', t('Hacer pedido'), 120, 47, 150, 56, cli);
  const conf = n('activity:AcceptEvent', t('Confirmación recibida'), 760, 47, 190, 56, cli, { trigger: t('Aviso de envío'), kind: 'signal' });
  const fin = n('activity:ActivityFinal', '', 1010, 60, 30, 30, cli);
  const validar = n('activity:Action', t('Validar pedido'), 120, 40, 150, 56, shop);
  const stock = n('activity:Decision', t('¿Hay stock?'), 330, 43, 50, 50, shop, { role: 'decision' });
  const cobrar = n('activity:Action', t('Cobrar'), 440, 40, 140, 56, shop);
  const cancelar = n('activity:Action', t('Cancelar pedido'), 190, 190, 150, 56, shop);
  const ff = n('activity:FlowFinal', '', 250, 280, 30, 30, shop);
  const fork = n('activity:Fork', '', 420, 130, 180, 10, shop, { role: 'fork' });
  const prep = n('activity:Action', t('Preparar envío'), 380, 180, 140, 56, shop);
  const fact = n('activity:Action', t('Emitir factura'), 545, 180, 140, 56, shop);
  const join = n('activity:Fork', '', 420, 280, 180, 10, shop, { role: 'join' });
  const obj = n('activity:ObjectNode', t('Factura'), 740, 160, 150, 50, shop, { type: t('Factura'), state: t('emitida') });
  const avisar = n('activity:SendSignal', t('Avisar al cliente'), 720, 255, 180, 56, shop, { signal: t('Aviso de envío') });
  const cf = (a: typeof ini, b: typeof ini, guard = '') => k.link(v, 'activity:ControlFlow', a, b, guard ? { fields: { guard } } : {});
  cf(ini, hacer); cf(hacer, validar); cf(validar, stock);
  cf(stock, cobrar, t('[sí]')); cf(stock, cancelar, t('[no]')); cf(cancelar, ff);
  cf(cobrar, fork); cf(fork, prep); cf(fork, fact); cf(prep, join); cf(fact, join); cf(join, avisar);
  k.link(v, 'activity:ObjectFlow', fact, obj);
  k.link(v, 'activity:ObjectFlow', obj, avisar);
  cf(avisar, conf); cf(conf, fin);
  return k.done(v);
}
