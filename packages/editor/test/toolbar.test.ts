/**
 * Barra del editor: si la app inyecta su ayuda (`docsHref`, con el menú Ayuda que ya abre los atajos), la barra no
 * repite el botón de atajos de teclado; sin ayuda de la app, el botón sigue (y la tecla `?` en ambos casos).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryStore, History, NotationRegistry, CORE_PACK } from '@all-draw/core';
import { setLang } from '@all-draw/i18n';
import { EditorProvider } from '../src/context';
import { ToolbarTools } from '../src/panels/Toolbar';

function render(docsHref?: (slug: string) => string): string {
  const store = new MemoryStore();
  const tools = createElement(ToolbarTools, { onSearch: () => {}, onShortcuts: () => {} });
  return renderToStaticMarkup(createElement(EditorProvider, { store, history: new History(store), registry: new NotationRegistry().register(CORE_PACK), docsHref, children: tools }));
}

describe('barra: botón de atajos', () => {
  beforeAll(() => setLang('es'));
  it('sin ayuda de la app, la barra tiene el botón de atajos', () => {
    expect(render()).toContain('aria-label="Atajos de teclado"');
  });
  it('con docsHref (la app pone su menú Ayuda), la barra no lo repite', () => {
    const html = render(slug => `#/docs/${slug}`);
    expect(html).not.toContain('aria-label="Atajos de teclado"');
    // El resto de herramientas sigue
    expect(html).toContain('aria-label="Buscar (Ctrl+K)"');
  });
});
