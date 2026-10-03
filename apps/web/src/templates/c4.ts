import { kit, type Tr } from './kit';

/** C4: diagrama de contexto y, como detalle del sistema, el de contenedores. */
export function c4Template(t: Tr) {
  const k = kit(t('Sistema C4'));
  const ctx = k.view(t('Contexto'), { notationId: 'c4', viewpointId: 'context' });
  const person = k.el('c4:Person', t('Cliente'));
  const sys = k.el('c4:SoftwareSystem', t('Tienda online'));
  const pay = k.el('c4:SoftwareSystem', t('Pasarela de pago'), { fields: { external: true } });
  const mail = k.el('c4:SoftwareSystem', t('Servicio de correo'), { fields: { external: true } });
  const cP = k.node(ctx, person, 300, 0, 120, 110);
  const cS = k.node(ctx, sys, 250, 200, 220, 90);
  const cPay = k.node(ctx, pay, 20, 380, 200, 80);
  const cMail = k.node(ctx, mail, 500, 380, 200, 80);
  k.link(ctx, 'c4:Uses', cP, cS, { fields: { description: t('Compra productos') } });
  k.link(ctx, 'c4:Uses', cS, cPay, { fields: { description: t('Cobra los pedidos'), technology: 'HTTPS' } });
  k.link(ctx, 'c4:Uses', cS, cMail, { fields: { description: t('Envía confirmaciones'), technology: 'SMTP' } });

  const cont = k.view(t('Contenedores'), { notationId: 'c4', viewpointId: 'container', rootElementId: sys.id });
  const web = k.el('c4:Container', t('Aplicación web'), { fields: { technology: 'React', kind: 'browser' } });
  const apiC = k.el('c4:Container', t('API'), { fields: { technology: 'Node.js', kind: 'microservice' } });
  const db = k.el('c4:Container', t('Base de datos'), { fields: { technology: 'PostgreSQL', kind: 'database' } });
  const dP = k.node(cont, person, 40, 0, 120, 110);
  const dS = k.node(cont, sys, 220, 0, 470, 330);
  const dWeb = k.node(cont, web, 30, 60, 170, 80, { parentNodeId: dS.id });
  const dApi = k.node(cont, apiC, 260, 60, 170, 80, { parentNodeId: dS.id });
  const dDb = k.node(cont, db, 260, 210, 170, 80, { parentNodeId: dS.id });
  const dPay = k.node(cont, pay, 760, 40, 190, 80);
  const dMail = k.node(cont, mail, 760, 220, 190, 80);
  k.link(cont, 'c4:Uses', dP, dWeb, { fields: { description: t('Usa'), technology: 'HTTPS' } });
  k.link(cont, 'c4:Uses', dWeb, dApi, { fields: { technology: 'JSON/HTTPS' } });
  k.link(cont, 'c4:Uses', dApi, dDb, { fields: { technology: 'SQL' } });
  k.link(cont, 'c4:Uses', dApi, dPay, { fields: { technology: 'HTTPS' } });
  k.link(cont, 'c4:Uses', dApi, dMail, { fields: { technology: 'SMTP' } });
  cS.detailViewId = cont.id;
  return k.done(ctx);
}
