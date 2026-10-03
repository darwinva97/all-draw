import { makeRelation } from '@all-draw/core';
import { kit, type Tr } from './kit';

/** Diagrama de secuencia: un pago con tarjeta, con mensajes síncronos, una respuesta y un mensaje asíncrono. */
export function sequenceTemplate(t: Tr) {
  const k = kit(t('Pago con tarjeta'));
  const v = k.view(t('Pago con tarjeta'), { notationId: 'sequence', kind: 'sequence' });
  const life = (name: string, kind: string, x: number) => k.node(v, k.el('sequence:Lifeline', name, { fields: { kind } }), x, 0, 140, 60);
  const cliente = life(t('Cliente'), 'actor', 40);
  const web = life(t('Tienda web'), 'boundary', 260);
  const api = life(t('API de pagos'), 'control', 480);
  const banco = life(t('Banco'), 'entity', 700);
  let order = 0;
  const msg = (a: typeof cliente, b: typeof cliente, text: string, y: number, kind = 'sync', typeId = 'sequence:Message') => {
    const ea = k.ws.elements[a.elementId!]!, eb = k.ws.elements[b.elementId!]!;
    const r = makeRelation(typeId, { elementId: ea.id }, { elementId: eb.id }, { fields: typeId === 'sequence:Return' ? { order: ++order, text } : { kind, order: ++order, text } });
    k.ws.relations[r.id] = r;
    k.edge(v, r, a, b, { bendpoints: [{ x: 0, y }] });
  };
  msg(cliente, web, t('confirma el pago'), 110);
  msg(web, api, 'POST /pagos', 150);
  msg(api, banco, t('autorizar cargo'), 200);
  msg(banco, api, t('autorizado'), 250, 'sync', 'sequence:Return');
  msg(api, web, '201 Created', 300, 'async');
  msg(web, cliente, t('muestra el recibo'), 350);
  return k.done(v);
}
