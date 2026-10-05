/**
 * Panel de texto: en solo lectura el texto no se puede editar (el campo es `readonly` y el estado lo dice);
 * con permiso de escritura, sí.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryStore, History, NotationRegistry, CORE_PACK, emptyWorkspace } from '@all-draw/core';
import { setLang } from '@all-draw/i18n';
import { EditorProvider } from '../src/context';
import TextPanel from '../src/panels/TextPanel';

function render(readOnly: boolean): string {
  const ws = emptyWorkspace('Prueba');
  ws.views.v1 = { id: 'v1', kind: 'freeform', notationId: 'freeform', name: 'Vista 1', doc: '', style: {}, props: {} };
  const store = new MemoryStore(ws);
  const panel = createElement(TextPanel, { onClose: () => {} });
  return renderToStaticMarkup(createElement(EditorProvider, { store, history: new History(store), registry: new NotationRegistry().register(CORE_PACK), readOnly, initialViewId: 'v1', children: panel }));
}

describe('panel de texto', () => {
  beforeAll(() => setLang('es'));
  it('solo lectura: el texto se muestra sin poder editarlo', () => {
    const html = render(true);
    expect(html).toMatch(/<textarea[^>]*readOnly=""|<textarea[^>]*readonly=""/i);
    expect(html).toContain('Solo lectura');
  });
  it('con permiso: editable, alcance de la vista actual', () => {
    const html = render(false);
    expect(html).not.toMatch(/<textarea[^>]*readonly/i);
    expect(html).toContain('Vista «Vista 1»');
    expect(html).toContain('aria-label="Texto de la vista «Vista 1»"');
  });
});
