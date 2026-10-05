/** Avisos y textos de los generadores con traducción inglesa en `@all-draw/i18n` (la UI los traduce con `tMsg`/`t`). */
import { describe, it, expect } from 'vitest';
import { missing } from '../../i18n/src';
import { WARNING_KEYS, GENERATOR_TEXTS } from '../src';

describe('textos traducibles', () => {
  it('todas las claves de aviso y los textos de los generadores están en el diccionario inglés', () => {
    expect(missing('en', [...WARNING_KEYS, ...GENERATOR_TEXTS])).toEqual([]);
  });
});
