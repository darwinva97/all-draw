import { kit, type Tr } from './kit';

/** Diagrama de flujo: validar una solicitud con una decisión y un bucle de corrección. */
export function flowchartTemplate(t: Tr) {
  const k = kit(t('Diagrama de flujo'));
  const v = k.view(t('Diagrama de flujo'), { notationId: 'flow' });
  const start = k.node(v, k.el('flow:Start', t('Inicio')), 230, 0, 120, 44);
  const input = k.node(v, k.el('flow:IO', t('Recibir solicitud'), { fields: { direction: 'in' } }), 205, 80, 170, 56);
  const validate = k.node(v, k.el('flow:Process', t('Validar los datos')), 205, 170, 170, 56);
  const ok = k.node(v, k.el('flow:Decision', t('¿Son correctos?')), 220, 260, 140, 90);
  const save = k.node(v, k.el('flow:Database', t('Guardar')), 215, 390, 150, 64);
  const end = k.node(v, k.el('flow:End', t('Fin')), 230, 490, 120, 44);
  const fix = k.node(v, k.el('flow:Process', t('Pedir corrección')), 470, 275, 160, 56);
  const arrow = 'flow:Arrow';
  k.link(v, arrow, start, input);
  k.link(v, arrow, input, validate);
  k.link(v, arrow, validate, ok);
  k.link(v, arrow, ok, save, { fields: { label: t('sí') }, name: t('sí') });
  k.link(v, arrow, ok, fix, { fields: { label: t('no') }, name: t('no') });
  k.link(v, arrow, fix, validate, {}, { bendpoints: [{ x: 550, y: 198 }] });
  k.link(v, arrow, save, end);
  return k.done(v);
}
