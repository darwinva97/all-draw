import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeView, makeComment, type Comment } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK } from '@all-draw/notation-grid';
import { renderStandaloneHtml, externalReferences } from '../src/html';
import { renderSvg } from '../src/svg';

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

describe('renderStandaloneHtml: comentarios', () => {
  /** exampleWorkspace con tres hilos en vw_1 (uno resuelto con respuesta, uno en un punto y uno a la vista) y uno en vw_2. */
  function withComments() {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const add = (c: Comment) => store.set('comments', c.id, c);
    const node = store.list('nodes').find(n => n.viewId === 'vw_1' && n.elementId === 'el_crm')!;
    add(makeComment({ kind: 'node', id: node.id, viewId: 'vw_1' }, { name: 'Ana <Dev>', userId: 'u1' }, '¿Es el CRM nuevo? Ver url(https://evil.example/x.png)', { id: 'c1', createdAt: '2026-09-01T10:00:00.000Z' }));
    add(makeComment({ kind: 'node', id: node.id, viewId: 'vw_1' }, { name: 'Luis' }, 'Sí, el de 2026', { id: 'c1r', threadId: 'c1', createdAt: '2026-09-01T11:00:00.000Z', editedAt: '2026-09-01T11:05:00.000Z' }));
    store.set('comments', 'c1', { ...store.get('comments', 'c1')!, resolved: true, resolvedBy: 'Luis' });
    add(makeComment({ kind: 'point', viewId: 'vw_1', x: 900, y: 700 }, { name: 'Eva' }, 'Falta algo aquí', { id: 'c2', createdAt: '2026-09-02T09:00:00.000Z' }));
    add(makeComment({ kind: 'view', id: 'vw_1', viewId: 'vw_1' }, { name: 'Eva' }, 'Revisar la vista', { id: 'c3', createdAt: '2026-09-03T09:00:00.000Z' }));
    add(makeComment({ kind: 'element', id: 'el_alta' }, { name: 'Pau' }, 'Detalle', { id: 'c4', createdAt: '2026-09-04T09:00:00.000Z' }));
    return { store, node };
  }
  const section = (html: string, id: string) => { const i = html.indexOf(`<section class="ad-view" data-view="${id}"`); return html.slice(i, html.indexOf('</section>', i)); };

  it('cada vista muestra sus hilos abiertos y resueltos (autor, fecha, texto) y marcadores numerados', () => {
    const { store, node } = withComments();
    const html = renderStandaloneHtml(store, reg());
    const v1 = section(html, 'vw_1');
    expect(v1).toContain('<aside class="ad-comments" aria-label="Comentarios">');
    expect(v1).toContain('3 abiertos · 1 resuelto');
    // Numerados del más antiguo al más reciente
    const order = [...v1.matchAll(/<li class="ad-thread[^"]*" data-thread="([^"]+)"><div class="ad-thread__head"><span class="ad-thread__n">(\d+)</g)].map(m => `${m[2]}:${m[1]}`);
    expect(order).toEqual(['1:c1', '2:c2', '3:c3', '4:c4']);
    // Hilo resuelto: estado, autor (escapado), fecha con datetime, respuesta y "(editado)"
    expect(v1).toContain('<li class="ad-thread is-resolved" data-thread="c1">');
    expect(v1).toContain('Resuelto por Luis');
    expect(v1).toContain('<b>Ana &lt;Dev&gt;</b>');
    expect(v1).toContain('<time datetime="2026-09-01T10:00:00.000Z">');
    expect(v1).toContain('Sí, el de 2026');
    expect(v1).toContain('(editado)');
    expect(v1).toContain('>CRM</span>');                       // qué se comenta
    expect(v1).toContain('Punto del lienzo');
    expect(v1).toContain('Toda la vista');
    // Marcadores en el SVG: sobre el nodo (atenuado por resuelto) y en el punto; la vista entera no lleva
    expect(v1).toMatch(/<g class="ad-marker is-muted" data-marker="c1">/);
    expect(v1).toMatch(/<g class="ad-marker" data-marker="c2">/);
    expect(v1).not.toContain('data-marker="c3"');
    expect(v1).toContain('.ad-marker circle{');
    // El punto (900, 700) queda dentro del viewBox
    const vb = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(v1)!.slice(1).map(Number);
    expect(vb[0]! + vb[2]!).toBeGreaterThan(900);
    expect(vb[1]! + vb[3]!).toBeGreaterThan(700);
    void node;
    // El hilo del elemento sale en las dos vistas en las que aparece; vw_2 no tiene más
    const v2 = section(html, 'vw_2');
    expect([...v2.matchAll(/data-thread="([^"]+)"/g)].map(m => m[1])).toEqual(['c4']);
    expect(v2).toMatch(/<g class="ad-marker" data-marker="c4">[\s\S]*?>1</);
    // Sigue autocontenido aunque un comentario cite una URL
    assertOffline(html);
    expect(html).not.toContain('url(https://evil.example');
  });

  it('comments: false lo quita; el SVG suelto nunca lleva comentarios', () => {
    const { store } = withComments();
    const html = renderStandaloneHtml(store, reg(), { comments: false });
    expect(html).not.toContain('class="ad-comments"');
    expect(html).not.toContain('<g class="ad-marker');
    const svg = renderSvg(store, reg(), 'vw_1');
    expect(svg).not.toContain('<g class="ad-marker');
    expect(svg).not.toContain('CRM nuevo');
  });

  it('sin comentarios, la vista se pinta como antes (sin panel)', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const html = renderStandaloneHtml(store, reg());
    expect(html).not.toContain('<aside class="ad-comments"');
    expect(html).toContain('<div class="ad-view__canvas"><svg');
  });
});
