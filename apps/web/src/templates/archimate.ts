import { kit, type Tr } from './kit';

/** Arquitectura ArchiMate en capas: negocio, aplicación y tecnología con sus relaciones de servicio. */
export function archimateTemplate(t: Tr) {
  const k = kit(t('Arquitectura en capas'));
  const v = k.view(t('Arquitectura en capas'), { notationId: 'archimate', viewpointId: 'layered' });
  // Rótulos de capa: 36 px de alto, lo que pide una línea de texto (con 28 el lint avisaba de que no cabía).
  k.label(v, t('Negocio'), 0, 54, 110, 36);
  k.label(v, t('Aplicación'), 0, 224, 110, 36);
  k.label(v, t('Tecnología'), 0, 394, 110, 36);
  const cliente = k.node(v, k.el('archimate:BusinessActor', t('Cliente')), 130, 20, 150, 56);
  const servicio = k.node(v, k.el('archimate:BusinessService', t('Venta online')), 330, 20, 170, 56);
  const proceso = k.node(v, k.el('archimate:BusinessProcess', t('Gestionar pedido')), 330, 110, 170, 56);
  const objeto = k.node(v, k.el('archimate:BusinessObject', t('Pedido')), 560, 110, 150, 56);
  const appSvc = k.node(v, k.el('archimate:ApplicationService', t('Servicio de pedidos')), 330, 200, 170, 56);
  const web = k.node(v, k.el('archimate:ApplicationComponent', t('Tienda web')), 130, 290, 150, 56);
  const erp = k.node(v, k.el('archimate:ApplicationComponent', t('ERP')), 330, 290, 170, 56);
  const datos = k.node(v, k.el('archimate:DataObject', t('Registro de pedido')), 560, 290, 150, 56);
  const nodo = k.node(v, k.el('archimate:Node', t('Servidor de aplicaciones')), 230, 380, 190, 56);
  const db = k.node(v, k.el('archimate:SystemSoftware', t('Base de datos')), 470, 380, 170, 56);
  k.link(v, 'archimate:Serving', servicio, cliente);
  k.link(v, 'archimate:Realization', proceso, servicio);
  k.link(v, 'archimate:Access', proceso, objeto);
  k.link(v, 'archimate:Serving', appSvc, proceso);
  k.link(v, 'archimate:Realization', erp, appSvc);
  k.link(v, 'archimate:Serving', erp, web);
  k.link(v, 'archimate:Access', erp, datos);
  k.link(v, 'archimate:Realization', datos, objeto);
  k.link(v, 'archimate:Serving', nodo, erp);
  k.link(v, 'archimate:Serving', db, erp);
  return k.done(v);
}
