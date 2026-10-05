import { kit, type Tr } from './kit';

/** DDD: mapa de contextos de una tienda (subdominios, contextos y patrones con U/D) y el modelo táctico de Pedidos. */
export function dddTemplate(t: Tr) {
  const k = kit(t('Mapa de contextos de la tienda'));
  const map = k.view(t('Mapa de contextos'), { notationId: 'ddd', viewpointId: 'contextMap' });
  const dom = k.node(map, k.el('ddd:Domain', t('Comercio electrónico')), 0, 0, 1060, 560);
  const sub = (name: string, kind: string, x: number, y: number) => k.node(map, k.el('ddd:Subdomain', name, { fields: { kind } }), x, y, 190, 80, { parentNodeId: dom.id });
  const sCat = sub(t('Gestión del catálogo'), 'supporting', 50, 50);
  const sVenta = sub(t('Venta'), 'core', 435, 50);
  const sLog = sub(t('Logística'), 'supporting', 820, 50);
  const sCobro = sub(t('Cobros'), 'generic', 50, 420);
  const bcEl = (name: string, team: string) => k.el('ddd:BoundedContext', name, { fields: { team } });
  const pedidosEl = bcEl(t('Pedidos'), t('Equipo de ventas'));
  const bc = (el: ReturnType<typeof bcEl>, x: number, y: number) => k.node(map, el, x, y, 210, 110, { parentNodeId: dom.id });
  const cCat = bc(bcEl(t('Catálogo'), t('Equipo de producto')), 40, 210);
  const cPed = bc(pedidosEl, 425, 210);
  const cEnv = bc(bcEl(t('Envíos'), t('Equipo de logística')), 810, 210);
  const cPag = bc(bcEl(t('Pagos'), t('Proveedor externo')), 425, 405);
  const rel = (a: typeof cCat, b: typeof cCat, pattern: string) => k.link(map, 'ddd:ContextRelation', a, b, { fields: { pattern, sourceRole: 'U', targetRole: 'D' } });
  rel(cCat, cPed, 'Customer/Supplier');
  rel(cPed, cEnv, 'Open Host Service');
  rel(cPag, cPed, 'Anticorruption Layer');
  k.link(map, 'ddd:Implements', cCat, sCat);
  k.link(map, 'ddd:Implements', cPed, sVenta);
  k.link(map, 'ddd:Implements', cEnv, sLog);
  k.link(map, 'ddd:Implements', cPag, sCobro);

  const tac = k.view(t('Pedidos · modelo táctico'), { notationId: 'ddd', viewpointId: 'tactical', rootElementId: pedidosEl.id });
  const ctx = k.node(tac, pedidosEl, 0, 0, 680, 380);
  const agg = k.node(tac, k.el('ddd:Aggregate', t('Pedido'), { fields: { root: t('Pedido'), invariants: [t('El total es la suma de las líneas')] } }), 20, 40, 400, 320, { parentNodeId: ctx.id });
  const ent = k.node(tac, k.el('ddd:Entity', t('Pedido'), { fields: { stereotype: 'Aggregate Root', identity: 'pedidoId', attributes: ['pedidoId: PedidoId', `${t('estado')}: EstadoPedido`], operations: [`${t('confirmar')}(): void`] } }), 20, 40, 180, 120, { parentNodeId: agg.id });
  const linea = k.node(tac, k.el('ddd:ValueObject', t('LíneaDePedido'), { fields: { attributes: [`${t('producto')}: ProductoId`, `${t('cantidad')}: int`] } }), 210, 40, 175, 100, { parentNodeId: agg.id });
  const dinero = k.node(tac, k.el('ddd:ValueObject', t('Dinero'), { fields: { attributes: [`${t('importe')}: decimal`, `${t('moneda')}: String`] } }), 210, 190, 175, 100, { parentNodeId: agg.id });
  const ev = k.node(tac, k.el('ddd:DomainEvent', t('PedidoConfirmado'), { fields: { attributes: ['pedidoId: PedidoId', `${t('total')}: ${t('Dinero')}`] } }), 460, 50, 200, 100, { parentNodeId: ctx.id });
  const srv = k.node(tac, k.el('ddd:Service', t('Tarificador'), { fields: { layer: 'domain', operations: [`${t('calcularTotal')}(${t('pedido')}): ${t('Dinero')}`] } }), 460, 230, 200, 80, { parentNodeId: ctx.id });
  k.link(tac, 'ddd:Reference', ent, linea, { fields: { targetCard: '1..*' } });
  k.link(tac, 'ddd:Reference', ent, dinero);
  k.link(tac, 'ddd:Publishes', agg, ev);
  k.link(tac, 'ddd:Reference', srv, ent);
  cPed.detailViewId = tac.id;
  return k.done(map);
}
