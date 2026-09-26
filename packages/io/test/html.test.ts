import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeView } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK } from '@all-draw/notation-grid';
import { renderStandaloneHtml, externalReferences } from '../src/html';

const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(GRID_PACK);

/** Autocontención (idea de archify): ningún `src`/`href`/`url()`/`@import` externo; `href="#…"` sí vale. */
function assertOffline(html: string) {
  expect(externalReferences(html)).toEqual([]);
  expect(html).not.toMatch(/\b(src|href)\s*=\s*["']https?:\/\//i);
  expect(html).not.toMatch(/<link\b/i);
  expect(html).not.toMatch(/@font-face/i);
  expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
}

describe('renderStandaloneHtml', () => {
  it('exampleWorkspace: HTML autocontenido con todas las vistas, índice y navegación', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const html = renderStandaloneHtml(store, reg());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>Ejemplo</title>');
    expect(html).toContain('<meta charset="utf-8">');
    assertOffline(html);
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(3 * 1024 * 1024);
    // Dos vistas como SVG inline con ids distintos
    expect((html.match(/<svg /g) ?? []).length).toBe(2);
    expect(html).toContain('<section class="ad-view" data-view="vw_1"');
    expect(html).toContain('<section class="ad-view" data-view="vw_2"');
    expect(html).toContain('id="ad-vw_1-title"');
    expect(html).toContain('id="ad-vw_2-title"');
    // Índice lateral con enlaces por hash y grupo por notación
    expect(html).toContain('href="#view=vw_1"');
    expect(html).toContain('class="ad-index__item" data-view="vw_2"');
    expect(html).toContain('<li class="ad-index__group">Libre</li>');
    // Navegación por detailViewId y lista "aparece en"
    expect(html).toContain('data-detail-view="vw_2"');
    expect(html).toContain('data-detail-view');
    expect(html).toContain('<h3>Aparece en</h3>');
    expect(html).toContain('<tr data-element="el_alta">');
    expect(html).toContain('class="ad-chip is-detail"');
    expect(html).toContain('detalle de Proceso de alta');
    // Tema dual: CSS de sistema + conmutador
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('data-set-theme="dark"');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<script>');
    expect(html).toContain('data-initial-view="vw_1"');
  });

  it('respeta tema fijo, título, vista inicial y subconjunto de vistas', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const html = renderStandaloneHtml(store, reg(), { theme: 'dark', title: 'Mi <export>', initialViewId: 'vw_2', viewIds: ['vw_2'] });
    expect(html).toContain('<html lang="es" data-theme="dark">');
    expect(html).toContain('<title>Mi &lt;export&gt;</title>');
    expect(html).toContain('data-initial-view="vw_2"');
    expect((html.match(/<svg /g) ?? []).length).toBe(1);
    expect(html).not.toContain('data-view="vw_1"');
    assertOffline(html);
  });

  it('workspace sin vistas y vista grid', () => {
    const store = new MemoryStore();
    expect(renderStandaloneHtml(store, reg())).toContain('No hay vistas.');
    const v = makeView('Tablero', { id: 'g', kind: 'grid', notationId: 'grid', grid: { layers: [{ id: 'L', name: 'Capa' }], stages: [{ id: 'S', name: 'Etapa' }], stageGroups: [] } });
    store.set('views', v.id, v);
    const html = renderStandaloneHtml(store, reg());
    expect(html).toContain('class="ad-cell"');
    expect(html).toContain('<span class="ad-index__notation"');
    assertOffline(html);
  });

  it('externalReferences detecta lo que no debe haber', () => {
    expect(externalReferences('<a href="#x">ok</a><img src="data:image/png;base64,AAA">')).toEqual([]);
    expect(externalReferences('<link href="https://fonts.example/x.css">')).toEqual(['https://fonts.example/x.css']);
    expect(externalReferences('<img srcset="//cdn.example/a.png 1x">')).toEqual(['//cdn.example/a.png']);
    expect(externalReferences('<style>@import "https://x/y.css"; a{background:url(https://x/y.png)}</style>')).toHaveLength(2);
  });
});
