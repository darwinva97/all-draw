import { kit, type Tr } from './kit';

/** Casos de uso UML: una tienda online con actores fuera del límite, «include», «extend» y generalización. */
export function usecaseTemplate(t: Tr) {
  const k = kit(t('Casos de uso de la tienda'));
  const v = k.view(t('Casos de uso de la tienda'), { notationId: 'usecase' });
  const sys = k.node(v, k.el('usecase:System', t('Tienda online')), 220, 0, 480, 440);
  const uc = (name: string, x: number, y: number, fields: Record<string, unknown> = {}) => k.node(v, k.el('usecase:UseCase', name, { fields }), x, y, 170, 70, { parentNodeId: sys.id });
  const buscar = uc(t('Buscar productos'), 30, 50);
  const pedir = uc(t('Realizar pedido'), 30, 185, { extensionPoints: [t('resumen del pedido')] });
  const cupon = uc(t('Aplicar cupón'), 30, 330);
  const sesion = uc(t('Iniciar sesión'), 280, 110);
  const pagar = uc(t('Pagar con tarjeta'), 280, 270);
  const cliente = k.node(v, k.el('usecase:Actor', t('Cliente'), { fields: { kind: 'person' } }), 60, 150, 60, 90);
  const registrado = k.node(v, k.el('usecase:Actor', t('Cliente registrado'), { fields: { kind: 'person' } }), 60, 330, 60, 90);
  const pasarela = k.node(v, k.el('usecase:Actor', t('Pasarela de pago'), { fields: { kind: 'system', stereotype: 'system' } }), 790, 260, 60, 90);
  k.link(v, 'usecase:Association', cliente, buscar);
  k.link(v, 'usecase:Association', cliente, pedir);
  k.link(v, 'usecase:Generalization', registrado, cliente);
  k.link(v, 'usecase:Include', pedir, sesion);
  k.link(v, 'usecase:Include', pedir, pagar);
  k.link(v, 'usecase:Extend', cupon, pedir, { fields: { extensionPoint: t('resumen del pedido'), condition: t('[tiene cupón]') } });
  k.link(v, 'usecase:Association', pagar, pasarela);
  return k.done(v);
}
