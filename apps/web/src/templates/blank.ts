import { kit, type Tr } from './kit';

/** Espacio en blanco: una vista libre vacía para empezar a dibujar. */
export function blankTemplate(t: Tr) {
  const k = kit(t('Nuevo espacio'));
  const v = k.view(t('Vista principal'), { notationId: 'freeform' });
  return k.done(v);
}
