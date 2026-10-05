/**
 * Los diccionarios portugués y francés cubren todas las claves del inglés (la referencia de cobertura) y todas las
 * traducciones (inglés incluido) conservan exactamente las mismas `{variables}` que su clave española.
 */
import { describe, it, expect } from 'vitest';
import { en } from '../src/en';
import { pt } from '../src/pt';
import { fr } from '../src/fr';
import { enDocs } from '../src/en-docs';
import { enFields } from '../src/en-fields';
import { enMessages } from '../src/en-messages';
import { enApi } from '../src/en-api';
import { ptDocs } from '../src/pt-docs';
import { ptFields } from '../src/pt-fields';
import { ptMessages } from '../src/pt-messages';
import { ptApi } from '../src/pt-api';
import { frDocs } from '../src/fr-docs';
import { frFields } from '../src/fr-fields';
import { frMessages } from '../src/fr-messages';
import { frApi } from '../src/fr-api';
import { getLang, isLang, langOf, LANGS, missing, setLang, t, tIn, formatNumber } from '../src';

const DICTS = { en, pt, fr };
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const lines = (s: string) => s.split('\n').length;

describe('diccionarios', () => {
  it.each(['pt', 'fr'] as const)('%s tiene todas las claves del inglés', lang => {
    const d = DICTS[lang];
    const lacking = Object.keys(en).filter(k => !(k in d));
    expect(lacking, `Claves del inglés sin traducción (${lang})`).toEqual([]);
    expect(Object.keys(d).filter(k => !(k in en)), `Claves de ${lang} que no están en el inglés`).toEqual([]);
  });

  it.each([
    ['docs', enDocs, ptDocs, frDocs], ['fields', enFields, ptFields, frFields], ['messages', enMessages, ptMessages, frMessages], ['api', enApi, ptApi, frApi],
  ] as const)('los diccionarios parciales (%s) tienen las mismas claves en los tres idiomas', (_name, e, p, f) => {
    expect(Object.keys(p).sort()).toEqual(Object.keys(e).sort());
    expect(Object.keys(f).sort()).toEqual(Object.keys(e).sort());
  });

  it.each(['en', 'pt', 'fr'] as const)('%s: cada traducción conserva las mismas {variables} y saltos de línea que la clave', lang => {
    const bad = Object.entries(DICTS[lang])
      .filter(([k, v]) => !v.trim() || vars(k) !== vars(v) || lines(k) !== lines(v))
      .map(([k, v]) => `${JSON.stringify(k)} → ${JSON.stringify(v)}`);
    expect(bad, `Traducciones con variables distintas (${lang})`).toEqual([]);
  });

  it('los diccionarios registrados no tienen huecos (missing) y el idioma se detecta por la etiqueta', () => {
    for (const l of ['en', 'pt', 'fr'] as const) expect(missing(l, Object.keys(en))).toEqual([]);
    expect(LANGS.map(l => l.id)).toEqual(['es', 'en', 'pt', 'fr']);
    expect(langOf('pt-BR')).toBe('pt');
    expect(langOf('fr-CA')).toBe('fr');
    expect(langOf('en-GB,en;q=0.9')).toBe('en');
    expect(langOf('de-DE')).toBeNull();
    expect(isLang('fr')).toBe(true);
  });

  it('pt y fr vuelven al inglés si les falta una clave, antes que al español', async () => {
    const { addTranslations } = await import('../src');
    addTranslations('en', { 'Clave solo en inglés {x}': 'English only {x}' });
    expect(tIn('pt', 'Clave solo en inglés {x}', { x: 1 })).toBe('English only 1');
    expect(tIn('fr', 'Clave solo en inglés {x}', { x: 1 })).toBe('English only 1');
    expect(tIn('es', 'Clave solo en inglés {x}', { x: 1 })).toBe('Clave solo en inglés 1');
    const prev = getLang();
    setLang('fr');
    expect(t('Cerrar')).toBe(fr['Cerrar']);
    expect(formatNumber(1234.5)).toMatch(/1\s?234,5/);
    setLang(prev);
  });
});
