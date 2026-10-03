/**
 * Textos de io en el idioma de la interfaz (fallos 26 y 81): sin traductor salen en español (servidor, CLI); con
 * `setIoTranslator` el `<desc>` del SVG, el HTML exportado y los avisos de importar salen traducidos.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeView } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK } from '@all-draw/notation-grid';
// io no depende de i18n (ni de React): el test usa el diccionario por ruta relativa.
import { tIn } from '../../i18n/src';
import { renderSvg, renderStandaloneHtml, importMermaid, setIoTranslator, tr, trn, ioLang, IO_TRANSLATOR_KEY } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(GRID_PACK);
const english = () => setIoTranslator((k, v) => tIn('en', k, v), () => 'en');

afterEach(() => setIoTranslator(null));

describe('io en el idioma inyectado', () => {
  it('sin traductor: español (como antes) e interpolación', () => {
    expect(tr('No existe la vista {view}', { view: 'v1' })).toBe('No existe la vista v1');
    expect(trn('{n} vista', '{n} vistas', 1)).toBe('1 vista');
    expect(trn('{n} vista', '{n} vistas', 3)).toBe('3 vistas');
    const html = renderStandaloneHtml(new MemoryStore(parseWorkspace(exampleWorkspace())), reg());
    expect(html).toContain('<html lang="es"');
    expect(html).toContain('Aparece en');
  });

  it('con traductor inglés: desc del SVG, HTML (lang, textos, sin ids internos) y avisos de importar', () => {
    english();
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const svg = renderSvg(store, reg(), 'vw_1');
    expect(svg).toMatch(/<desc id="ad-vw_1-desc">View &quot;Mapa&quot; \(Libre\) with 2 elements and 1 relation\./);
    const grid = makeView('Rejilla', { kind: 'grid', notationId: 'grid', id: 'vw_grid' });
    store.set('views', grid.id, grid);
    const html = renderStandaloneHtml(store, reg());
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('Appears in');
    expect(html).toContain('>Light<');
    expect(html).not.toMatch(/>Aparece en<|>Claro<|solo aquí/);
    // El índice nombra el tipo de vista, no su id interno
    expect(html).toContain('>Layers × stages</span>');
    expect(html).not.toMatch(/ad-index__notation"[^>]*>grid</);
    const { warnings } = importMermaid('flowchart TD\n  A --> B\n  end\n');
    expect(warnings.join('\n')).toMatch(/without an open/);
  });

  it('la web deja el traductor en globalThis[Symbol.for(IO_TRANSLATOR_KEY)] sin importar io; setIoTranslator manda sobre él', () => {
    const g = globalThis as Record<symbol, unknown>;
    g[Symbol.for(IO_TRANSLATOR_KEY)] = { t: (k: string, v?: Record<string, string | number>) => tIn('en', k, v), lang: () => 'en' };
    try {
      expect(tr('No existe la vista {view}', { view: 'v1' })).toBe('View v1 does not exist');
      expect(ioLang()).toBe('en');
      setIoTranslator(k => `[${k}]`);
      expect(tr('Diagrama')).toBe('[Diagrama]');
    } finally { delete g[Symbol.for(IO_TRANSLATOR_KEY)]; }
  });

  it('las migas son la ruta de detalle (vista padre → vista actual), no el historial de clics', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const html = renderStandaloneHtml(store, reg());
    const detail = store.list('nodes').find(n => n.detailViewId);
    if (detail) expect(html).toContain(`data-view="${detail.detailViewId}" data-parent="${detail.viewId}"`);
    expect(html).not.toContain('history.push');
  });
});
