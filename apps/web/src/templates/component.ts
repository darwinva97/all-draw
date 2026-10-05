import { kit, type Tr } from './kit';

/** Componentes UML: la web consume la interfaz de pedidos (ensamblaje de «socket» y «lollipop»), con puerto y delegación. */
export function componentTemplate(t: Tr) {
  const k = kit(t('Componentes de la tienda'));
  const v = k.view(t('Componentes de la tienda'), { notationId: 'component' });
  const web = k.node(v, k.el('component:Component', t('Web de la tienda'), { fields: { technology: 'React' } }), 0, 90, 200, 100);
  // El «socket» sin rótulo: el nombre de la interfaz ya va bajo el «lollipop» con el que encaja.
  const socket = k.node(v, k.el('component:RequiredInterface', ''), 250, 128, 24, 24, { text: '' });
  const ball = k.node(v, k.el('component:ProvidedInterface', t('IPedidos'), { fields: { operations: ['+ crear(carrito): Pedido', '+ consultar(id): Pedido'] } }), 290, 128, 24, 24);
  const pedidos = k.node(v, k.el('component:Component', t('Pedidos'), { fields: { stereotype: 'subsystem' } }), 380, 20, 340, 240);
  const port = k.node(v, k.el('component:Port', t('api')), 10, 109, 22, 22, { parentNodeId: pedidos.id });
  const gestor = k.node(v, k.el('component:Component', t('Gestor de pedidos')), 110, 80, 190, 80, { parentNodeId: pedidos.id });
  const pagos = k.node(v, k.el('component:Component', t('Pagos')), 450, 340, 200, 80);
  const jar = k.node(v, k.el('component:Artifact', 'pedidos.jar', { fields: { fileName: 'pedidos.jar' } }), 800, 110, 170, 60);
  k.link(v, 'component:Requires', web, socket);
  k.link(v, 'component:Assembly', socket, ball);
  k.link(v, 'component:Provides', port, ball);
  k.link(v, 'component:Delegation', port, gestor);
  k.link(v, 'component:Dependency', gestor, pagos, { fields: { stereotype: '«use»' } });
  k.link(v, 'component:Dependency', jar, pedidos, { fields: { stereotype: '«manifest»' } });
  return k.done(v);
}
