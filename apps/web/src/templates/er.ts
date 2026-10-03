import { kit, type Tr } from './kit';

/** Modelo entidad-relación: clientes, pedidos, líneas y productos con cardinalidades de pata de gallo. */
export function erTemplate(t: Tr) {
  const k = kit(t('Modelo de datos'));
  const v = k.view(t('Modelo de datos'), { notationId: 'er', viewpointId: 'logical' });
  const ent = (name: string, attrs: [string, string][], x: number, y: number) =>
    k.node(v, k.el('er:Entity', name, { fields: { attributes: attrs.map(([key, value]) => ({ key, value })), pk: [attrs[0]![0]] } }), x, y, 170, 70);
  const cliente = ent(t('Cliente'), [['id', 'uuid'], [t('nombre'), 'text'], ['email', 'text']], 0, 40);
  const pedido = ent(t('Pedido'), [['id', 'uuid'], [t('fecha'), 'date'], [t('total'), 'numeric']], 330, 40);
  const linea = ent(t('Línea de pedido'), [['id', 'uuid'], [t('cantidad'), 'int']], 330, 260);
  const producto = ent(t('Producto'), [['id', 'uuid'], [t('nombre'), 'text'], [t('precio'), 'numeric']], 660, 260);
  k.link(v, 'er:OneToMany', cliente, pedido, { name: t('hace') });
  k.link(v, 'er:OneToMany', pedido, linea, { name: t('contiene'), fields: { identifying: true } });
  k.link(v, 'er:OneToMany', producto, linea, { name: t('aparece en') });
  return k.done(v);
}
