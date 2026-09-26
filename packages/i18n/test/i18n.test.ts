import { describe, it, expect } from 'vitest';
import { t, tIn, setLang, getLang, addTranslations, missing } from '../src';

describe('i18n', () => {
  it('devuelve la clave si falta traducción e interpola variables', () => {
    setLang('en');
    expect(t('Cerrar')).toBe('Close');
    expect(t('Texto sin traducir')).toBe('Texto sin traducir');
    addTranslations('en', { 'Hola {nombre}': 'Hello {nombre}' });
    expect(t('Hola {nombre}', { nombre: 'Ana' })).toBe('Hello Ana');
    setLang('es');
    expect(t('Hola {nombre}', { nombre: 'Ana' })).toBe('Hola Ana');
    expect(getLang()).toBe('es');
    expect(tIn('en', 'Borrar')).toBe('Delete');
    expect(missing('en', ['Cerrar', 'zzz'])).toEqual(['zzz']);
  });
});
