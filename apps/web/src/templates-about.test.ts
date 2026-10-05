/**
 * Plantillas: cada una tiene `about` (2–3 frases: qué muestra y cómo seguir) con traducción inglesa, y el espacio que
 * crea lleva esa nota de bienvenida en la vista que se abre primero (salvo el espacio en blanco).
 */
import { describe, it, expect } from 'vitest';
import { parseWorkspace } from '@all-draw/core';
import { missing } from '@all-draw/i18n';
import { TEMPLATES, WELCOME_PROP, withWelcome } from './templates';
import { blankTemplate } from './templates/blank';

const t = (k: string, v?: Record<string, string | number>) => (v ? k.replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? '')) : k);

describe('plantillas: «about» y nota de bienvenida', () => {
  it('cada plantilla explica en 2–3 frases qué muestra y cómo seguir, con traducción inglesa', () => {
    for (const tpl of TEMPLATES) {
      const sentences = tpl.about.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, tpl.id).toBeGreaterThanOrEqual(2);
      expect(sentences.length, tpl.id).toBeLessThanOrEqual(3);
    }
    expect(missing('en', TEMPLATES.map(x => x.about))).toEqual([]);
  });

  it('la primera vista del espacio nuevo lleva la nota (en el idioma activo); el espacio en blanco, no', () => {
    for (const tpl of TEMPLATES) {
      const ws = parseWorkspace(tpl.build(t));
      const first = ws.views[ws.meta.currentViewId!]!;
      if (tpl.id === 'blank') expect(first.props[WELCOME_PROP], tpl.id).toBeUndefined();
      else expect(first.props[WELCOME_PROP], tpl.id).toBe(tpl.about);
      // Solo esa vista
      expect(Object.values(ws.views).filter(v => v.props[WELCOME_PROP]).length, tpl.id).toBe(tpl.id === 'blank' ? 0 : 1);
    }
  });

  it('withWelcome conserva las demás propiedades de la vista', () => {
    const ws = blankTemplate(t);
    const v = ws.views[ws.meta.currentViewId!]!;
    v.props = { otra: 'x' };
    expect(withWelcome(ws, 'Hola').views[v.id]!.props).toEqual({ otra: 'x', [WELCOME_PROP]: 'Hola' });
  });
});
