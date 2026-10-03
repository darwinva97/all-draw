/** Búsqueda del manual: plegado (acentos fuera, ñ dentro), términos mínimos y resultados sobre el manual real. */
import { describe, it, expect } from 'vitest';
import { fold } from './markdown';
import { MIN_TERM, search, sectionsOf, termsOf, tooShort, type Section } from './search';

/** Capítulos en español del manual, como texto (sin `node:fs`: este fichero lo comprueba también `tsconfig.app`). */
const MANUAL = import.meta.glob<string>('../../../../docs/manual/*.md', { query: '?raw', import: 'default', eager: true });
const chapter = (file: string): Section[] => sectionsOf(file.replace(/\.md$/, ''), MANUAL[`../../../../docs/manual/${file}`]!);

describe('fold', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(fold('Canción ÁRBOL Pingüino')).toBe('cancion arbol pinguino');
  });

  it('conserva la ñ (también en mayúsculas)', () => {
    expect(fold('Año ESPAÑA')).toBe('año españa');
    expect(fold('huérfano')).toBe('huerfano');
  });

  it('mantiene la longitud por punto de código (el resaltado depende de ello)', () => {
    for (const s of ['Año', 'Ñandú', 'émoji 🎉 fin', 'İstanbul']) expect(Array.from(fold(s)).length).toBe(Array.from(s).length);
  });
});

describe('termsOf / tooShort', () => {
  it('pliega la consulta y descarta palabras de una letra', () => {
    expect(termsOf('Año y CANCIÓN')).toEqual(['año', 'cancion']);
    expect(termsOf('a')).toEqual([]);
    expect(MIN_TERM).toBe(2);
  });

  it('acepta la ñ descompuesta (n + tilde combinable)', () => {
    expect(termsOf('año')).toEqual(['año']);
  });

  it('una consulta de una letra es «demasiado corta», no «sin resultados»', () => {
    expect(tooShort('a')).toBe(true);
    expect(tooShort(' x ')).toBe(true);
    expect(tooShort('a b')).toBe(true);
    expect(tooShort('')).toBe(false);
    expect(tooShort('   ')).toBe(false);
    expect(tooShort('C4')).toBe(false);
    expect(tooShort('a pines')).toBe(false);
  });
});

describe('search', () => {
  const sec = (heading: string, text: string): Section => ({ slug: 's', chapter: 'S', heading, id: heading.toLowerCase(), text, ftext: fold(text), fheading: fold(heading) });
  const sections = [
    sec('Huérfanos', 'Un elemento huérfano no aparece en ninguna vista.'),
    sec('Calendario', 'Cada año se archivan los espacios.'),
    sec('Canciones', 'La canción del verano.'),
  ];

  it('«año» no encuentra «huérfano» y sí «año»', () => {
    expect(search(sections, 'año').map(h => h.section.heading)).toEqual(['Calendario']);
  });

  it('sin acentos encuentra con acentos (y al revés)', () => {
    expect(search(sections, 'cancion').map(h => h.section.heading)).toEqual(['Canciones']);
    expect(search(sections, 'HUÉRFANO').map(h => h.section.heading)).toEqual(['Huérfanos']);
  });

  it('una sola letra no busca', () => {
    expect(search(sections, 'a')).toEqual([]);
  });

  it('en el manual real, «año» no devuelve secciones que solo dicen «huérfano»', () => {
    const all = ['glosario.md', 'editor.md', 'conceptos.md', 'faq.md'].flatMap(chapter);
    expect(all.some(s => s.ftext.includes('huerfano'))).toBe(true);
    for (const h of search(all, 'año')) expect(h.section.ftext).toContain('año');
    expect(search(all, 'huérfano').length).toBeGreaterThan(0);
  });
});
