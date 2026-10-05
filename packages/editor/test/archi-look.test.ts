/**
 * Aspecto Archi en el lienzo: preferencia «Mostrar el nombre del tipo», nombre ajustado a la caja, banda de título de
 * los contenedores (y título encima de los hijos que lo tapan), Junction y notas. Sin DOM: la medida es la aproximada.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { CORE_PACK, NotationRegistry, makeElement, makeNode, makeView, type ViewNode } from '@all-draw/core';
import { ARCHIMATE_PACK, ARCHI_FONT_SIZE, ELLIPSIS, JUNCTION_SIZE } from '../../notations/archimate/src';
import { BPMN_PACK } from '../../notations/bpmn/src';
import { ElementNode, labelGeometry, nodeText, titleCovered, type ElementNodeData } from '../src/nodes/ElementNode';
import { VisualNode } from '../src/nodes/VisualNode';
import { NodeEnvContext, type NodeEnv } from '../src/nodes/env';
import { showTypeNamesOf, withBreaks } from '../src/nodes/label';
import { defaultSize } from '../src/Canvas';

const reg = () => new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK).register(BPMN_PACK);
const typeOf = (id: string) => reg().elementType(id)!;

function data(typeId: string, name: string, o: { w?: number; h?: number; style?: Partial<ViewNode['style']>; fields?: Record<string, unknown>; hasChildren?: boolean } = {}): ElementNodeData {
  const el = makeElement(typeId, name, { fields: o.fields ?? {} });
  const vn = makeNode('v', el.id, { x: 0, y: 0, w: o.w ?? 130, h: o.h ?? 50 }, { style: (o.style ?? {}) as ViewNode['style'] });
  return { node: vn, element: el, type: typeOf(typeId), rule: {}, ports: [], archimate: typeId.startsWith('archimate:'), hasChildren: o.hasChildren };
}

function render(d: ElementNodeData, env: Partial<NodeEnv> = {}): string {
  const full = { registry: reg(), readOnly: true, dark: false, lowDetail: false, run: () => {}, setRenaming: () => {}, ...env } as NodeEnv;
  const props = { id: 'n', data: d, selected: false, type: 'element', dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: false, selectable: true, draggable: true };
  return renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(NodeEnvContext.Provider, { value: full }, createElement(ElementNode as unknown as (p: typeof props) => null, props))));
}

describe('preferencia de la vista «Mostrar el nombre del tipo»', () => {
  it('por defecto: no en ArchiMate, sí en el resto; lo guardado en la vista manda', () => {
    expect(showTypeNamesOf(makeView('A', { notationId: 'archimate' }))).toBe(false);
    expect(showTypeNamesOf(makeView('B', { notationId: 'bpmn' }))).toBe(true);
    expect(showTypeNamesOf(makeView('A', { notationId: 'archimate', style: { showTypeNames: true } }))).toBe(true);
    expect(showTypeNamesOf(makeView('B', { notationId: 'bpmn', style: { showTypeNames: false } }))).toBe(false);
    expect(showTypeNamesOf(undefined)).toBe(true);
  });

  it('ArchiMate: sin el tipo dentro de la caja; con la preferencia, el tipo vuelve si cabe', () => {
    const d = data('archimate:BusinessProcess', 'Revisar', { w: 160, h: 70 });
    expect(render(d)).not.toContain('ad-node__type');
    expect(render(d, { showTypeNames: false })).not.toContain('Business Process');
    expect(render(d, { showTypeNames: true })).toContain('ad-node__type');
  });

  it('resto de notaciones: el tipo solo si cabe', () => {
    expect(render(data('bpmn:Task', 'Revisar', { w: 160, h: 60 }), { showTypeNames: true })).toContain('ad-node__type');
    expect(render(data('bpmn:Task', 'Revisar la solicitud de crédito del cliente', { w: 100, h: 40 }), { showTypeNames: true })).not.toContain('ad-node__type');
  });
});

describe('nombre ajustado a la caja', () => {
  it('ArchiMate: letra de 11,5 px, margen de 5 px y hueco del icono a la derecha', () => {
    const g = labelGeometry(data('archimate:BusinessProcess', 'Aplica reglas'), undefined, false)!;
    expect(g.fit.fontSize).toBe(ARCHI_FONT_SIZE);
    expect(g.pad).toEqual({ top: 3, right: 21, bottom: 3, left: 5 });
    expect(g.band).toBe(false);
    expect(render(data('archimate:BusinessProcess', 'Aplica reglas'))).toMatch(/class="ad-node__label ad-node__label--fit" style="font-size:11.5px/);
  });

  it('lo que no cabe ni a 9 px se recorta con «…» y el texto completo va en el `title`', () => {
    const long = 'Consulta solicitud existente Aliados ALIADOS con un nombre larguísimo que no cabe';
    const html = render(data('archimate:ApplicationService', long, { w: 90, h: 30 }));
    expect(html).toContain(ELLIPSIS);
    expect(html).toContain(`title="${long}"`);
    expect(html).toContain('ad-node__line');
  });

  it('`<wbr>` donde el ajuste admite partir una palabra («/», «_», «-», «.»)', () => {
    expect(renderToStaticMarkup(createElement('span', null, withBreaks('GET: /a/b')))).toBe('<span>GET: /<wbr/>a/<wbr/>b</span>');
    expect(withBreaks('sin cortes')).toBe('sin cortes');
  });
});

describe('contenedores: banda de título', () => {
  it('Grouping: banda arriba a la izquierda, dos líneas como mucho', () => {
    const g = labelGeometry(data('archimate:Grouping', 'Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece', { w: 120, h: 300 }), undefined, false)!;
    expect(g).toMatchObject({ band: true, left: true });
    expect(g.fit.lines.length).toBeLessThanOrEqual(2);
    expect(render(data('archimate:Grouping', 'Capa', { w: 300, h: 200 }))).toMatch(/ad-node--band ad-node--title-left/);
  });

  it('nodo con hijos o `labelPosition: top`: banda centrada', () => {
    expect(labelGeometry(data('archimate:ApplicationComponent', 'Registro', { w: 500, h: 100, hasChildren: true }), undefined, false)).toMatchObject({ band: true, left: false });
    expect(labelGeometry(data('archimate:ApplicationInterface', 'API', { w: 500, h: 100, style: { labelPosition: 'top' } }), undefined, false)).toMatchObject({ band: true, left: false });
  });

  it('un hijo que tapa el título lo manda a la capa de encima (`titleAbove`)', () => {
    const d = data('archimate:Grouping', 'Validacion de riesgo', { w: 600, h: 300, hasChildren: true });
    const text = nodeText(d, { lowDetail: false, showTypeNames: false });
    expect(titleCovered(d, text, [{ x: 40, y: 4, w: 110, h: 48 }])).toBe(true);
    expect(titleCovered(d, text, [{ x: 20, y: 40, w: 110, h: 48 }])).toBe(false);
    expect(titleCovered(d, text, [{ x: 400, y: 2, w: 110, h: 48 }])).toBe(false);
    expect(render({ ...d, titleAbove: true })).toContain('is-under');
  });
});

describe('Junction', () => {
  it('círculo relleno sin texto; con nombre, debajo; 15×15 desde la paleta', () => {
    const html = render(data('archimate:Junction', '', { w: 15, h: 15 }));
    expect(html).toContain('ad-node--junction');
    expect(html).not.toContain('ad-node__label');
    expect(html).not.toContain('Junction<');
    expect(html.match(/<path[^>]*fill="#000000"/g)?.length).toBe(2);
    expect(render(data('archimate:Junction', 'Decide', { w: 15, h: 15 }))).toContain('>Decide<');
    expect(defaultSize('circle', false, 'archimate:Junction')).toEqual({ w: JUNCTION_SIZE, h: JUNCTION_SIZE });
  });

  it('«or»: hueco (fondo y borde de tinta)', () => {
    const html = render(data('archimate:Junction', '', { w: 15, h: 15, fields: { junctionType: 'or' } }));
    expect(html.match(/<path/g)?.length).toBe(1);
    expect(html).toMatch(/<path[^>]*fill="#ffffff"[^>]*stroke="#000000"/);
  });
});

describe('nota', () => {
  const note = (text: string, style: Record<string, unknown> = {}, w = 140, h = 118) => {
    const vn = { id: 'n1', viewId: 'v', visualType: 'core:note', text, x: 0, y: 0, w, h, style } as ViewNode;
    const env = { registry: reg(), readOnly: true, dark: false, lowDetail: false, run: () => {}, setRenaming: () => {} } as unknown as NodeEnv;
    const props = { id: 'n1', data: { node: vn }, selected: false, type: 'visual', dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: false, selectable: true, draggable: true };
    return renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(NodeEnvContext.Provider, { value: env }, createElement(VisualNode as unknown as (p: typeof props) => null, props))));
  };

  it('esquina doblada con el color de `style.fill` y texto legible encima', () => {
    const html = note('Riesgo Bajo - verde\nRiesgo Alto - rojo', { fill: '#b5ffff' });
    expect(html).toContain('ad-note__fold');
    expect(html).toMatch(/<path d="M0.5,0.5L139.5,0.5[^"]*" fill="#b5ffff"/);
    expect(html).toContain('color:#111');
    expect(html).toContain('Riesgo Bajo - verde\nRiesgo Alto - rojo');
    expect(html).toContain('-webkit-line-clamp:2');
  });

  it('lo que no cabe se recorta con «…» (texto completo en el `title`)', () => {
    const long = Array.from({ length: 20 }, (_, i) => `Línea ${i + 1}`).join('\n');
    const html = note(long, {}, 140, 80);
    expect(html).toContain(ELLIPSIS);
    expect(html).toContain('title="Línea 1');
  });
});
