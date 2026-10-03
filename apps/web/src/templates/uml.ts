import { kit, type Tr } from './kit';

/** Diagrama de clases UML: dominio de pedidos con asociación, composición, interfaz y enumeración. */
export function umlTemplate(t: Tr) {
  const k = kit(t('Diagrama de clases'));
  const v = k.view(t('Diagrama de clases'), { notationId: 'uml' });
  const cls = (name: string, attributes: string[], operations: string[], x: number, y: number, extra: Record<string, unknown> = {}) =>
    k.node(v, k.el('uml:Class', name, { fields: { attributes, operations, ...extra } }), x, y, 200, 120);
  const cliente = cls(t('Cliente'), [`- ${t('nombre')}: String`, '- email: String'], [`+ ${t('realizarPedido')}(): ${t('Pedido')}`], 0, 20);
  const pedido = cls(t('Pedido'), [`- ${t('fecha')}: Date`, `- ${t('estado')}: ${t('EstadoPedido')}`], [`+ ${t('total')}(): Money`], 330, 20);
  const linea = cls(t('LineaPedido'), [`- ${t('cantidad')}: int`], [`+ ${t('subtotal')}(): Money`], 330, 240);
  const producto = cls(t('Producto'), [`- ${t('nombre')}: String`, `- ${t('precio')}: Money`], [], 660, 240);
  const pagable = k.node(v, k.el('uml:Interface', t('Pagable'), { fields: { stereotype: 'interface', operations: [`+ ${t('pagar')}(): void`] } }), 660, 20, 200, 90);
  const estado = k.node(v, k.el('uml:Enum', t('EstadoPedido'), { fields: { values: [t('PENDIENTE'), t('PAGADO'), t('ENVIADO')] } }), 0, 240, 200, 110);
  k.link(v, 'uml:Association', cliente, pedido, { fields: { sourceCard: '1', targetCard: '0..*' } });
  k.link(v, 'uml:Composition', pedido, linea, { fields: { sourceCard: '1', targetCard: '1..*' } });
  k.link(v, 'uml:Association', linea, producto, { fields: { sourceCard: '0..*', targetCard: '1' } });
  k.link(v, 'uml:Realization', pedido, pagable);
  k.link(v, 'uml:Dependency', pedido, estado);
  return k.done(v);
}
