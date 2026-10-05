/**
 * Aspecto Archi en el SVG exportado (igual que el lienzo): sin nombre del tipo en ArchiMate salvo que la vista lo pida,
 * nombre ajustado a la caja, título de contenedor arriba (y encima de los hijos que lo tapan), Junction y notas.
 */
import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, type ViewNode } from '@all-draw/core';
import { ARCHIMATE_PACK, approxTextWidth, notePath, ELLIPSIS } from '@all-draw/notation-archimate';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { renderSvg, showTypeNamesOf, textMeasurer } from '../src/svg';

const reg = () => new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK).register(BPMN_PACK);

function scene(notationId = 'archimate', style: Record<string, unknown> = {}) {
  const store = new MemoryStore();
  store.set('views', 'v', makeView('Riesgo', { id: 'v', notationId, style }));
  const add = (id: string, typeId: string, name: string, box: { x: number; y: number; w: number; h: number }, o: { parent?: string; style?: Partial<ViewNode['style']>; fields?: Record<string, unknown> } = {}) => {
    const el = makeElement(typeId, name, { id: `el_${id}`, fields: o.fields ?? {} });
    store.set('elements', el.id, el);
    store.set('nodes', id, makeNode('v', el.id, box, { id, parentNodeId: o.parent, style: (o.style ?? {}) as ViewNode['style'] }));
  };
  add('grp', 'archimate:Grouping', 'Validacion de riesgo', { x: 0, y: 0, w: 600, h: 300 });
  add('proc', 'archimate:BusinessProcess', 'Validad solicitud de credito existente', { x: 20, y: 100, w: 130, h: 50 }, { parent: 'grp' });
  add('svc', 'archimate:ApplicationService', 'Consulta solicitud existente Aliados ALIADOS con un nombre larguísimo', { x: 200, y: 100, w: 90, h: 30 }, { parent: 'grp' });
  add('jn', 'archimate:Junction', '', { x: 400, y: 100, w: 15, h: 15 }, { parent: 'grp' });
  add('jor', 'archimate:Junction', '', { x: 450, y: 100, w: 15, h: 15 }, { parent: 'grp', fields: { junctionType: 'or' } });
  return store;
}

/** Textos `<tspan>` de un nodo. */
const textsOf = (svg: string, id: string) => {
  const i = svg.indexOf(`data-node="${id}"`), j = svg.indexOf('data-node=', i + 1);
  const g = svg.slice(i, j < 0 ? undefined : j);
  return [...g.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(m => m[1]);
};

describe('SVG con aspecto Archi', () => {
  it('ArchiMate: sin nombres de tipo; con `showTypeNames`, el tipo vuelve donde cabe', () => {
    const svg = renderSvg(scene(), reg(), 'v');
    for (const name of ['Grouping', 'Business Process', 'Application Service', 'Junction']) expect(svg).not.toContain(`>${name}<`);
    expect(svg).not.toContain('class="ad-node__type"');
    expect(renderSvg(scene('archimate', { showTypeNames: true }), reg(), 'v')).toContain('class="ad-node__type"');
    expect(showTypeNamesOf({ notationId: 'archimate' })).toBe(false);
    expect(showTypeNamesOf({ notationId: 'bpmn', style: {} })).toBe(true);
  });

  it('el nombre se ajusta a la zona útil: letra de 11,5 px, nunca más ancho que la caja; lo que no cabe, con «…»', () => {
    const svg = renderSvg(scene(), reg(), 'v');
    const proc = textsOf(svg, 'proc');
    expect(proc.length).toBeGreaterThan(1);
    // Zona útil del proceso: 130 − 2 de borde − 5 − 5 − 16 del icono
    const fs = Number(/data-node="proc"[\s\S]*?class="ad-node__label"[^>]*font-size="([\d.]+)"/.exec(svg)?.[1]);
    expect(fs).toBeLessThanOrEqual(11.5);
    expect(fs).toBeGreaterThanOrEqual(9);
    for (const l of proc) expect(approxTextWidth(l, fs)).toBeLessThanOrEqual(130 - 2 - 26);
    const svc = textsOf(svg, 'svc');
    expect(svc.at(-1)!.endsWith(ELLIPSIS)).toBe(true);
    expect(svg).toMatch(/data-node="svc"[\s\S]*?<title>Consulta solicitud existente Aliados ALIADOS con un nombre larguísimo<\/title>/);
    expect(svg).toContain('.ad-node--archimate .ad-node__label{font-weight:400}');
  });

  it('Grouping: título arriba a la izquierda, dentro de la caja', () => {
    const svg = renderSvg(scene(), reg(), 'v');
    const m = /data-node="grp"[\s\S]*?<text x="([\d.]+)" y="([\d.]+)" text-anchor="start"[^>]*class="ad-node__label"/.exec(svg)!;
    expect(Number(m[1])).toBe(6);
    expect(Number(m[2])).toBeLessThan(14);
  });

  it('título tapado por un hijo: se pinta en la capa de títulos, después de los nodos', () => {
    const store = scene();
    store.set('nodes', 'proc', { ...store.get('nodes', 'proc')!, x: 4, y: 2 });
    const svg = renderSvg(store, reg(), 'v');
    expect(svg).toContain('<g class="ad-titles">');
    expect(svg.indexOf('data-title-of="grp"')).toBeGreaterThan(svg.indexOf('data-node="proc"'));
    expect(renderSvg(scene(), reg(), 'v')).not.toContain('ad-titles');
  });

  it('Junction: círculo de tinta sin texto; «or», hueco', () => {
    const svg = renderSvg(scene(), reg(), 'v');
    expect(textsOf(svg, 'jn')).toEqual([]);
    const jn = /data-node="jn"[^>]*>([\s\S]*?)<\/g><\/g>/.exec(svg)![1]!;
    expect(jn.match(/fill="var\(--ad-ink\)"/g)?.length).toBe(2);
    const jor = /data-node="jor"[^>]*>([\s\S]*?)<\/g><\/g>/.exec(svg)![1]!;
    expect(jor.match(/<path/g)?.length).toBe(1);
    expect(jor).toContain('fill="var(--ad-panel)"');
    expect(jor).toContain('stroke="var(--ad-ink)"');
  });

  it('nota: esquina doblada, color de `style.fill`, texto arriba a la izquierda a 11 px con sus saltos de línea', () => {
    const store = scene();
    store.set('nodes', 'note', { id: 'note', viewId: 'v', visualType: 'core:note', text: 'Valida si califica\n\nRiesgo Bajo - verde', x: 700, y: 0, w: 140, h: 118, style: { fill: '#b5ffff' } } as ViewNode);
    const svg = renderSvg(store, reg(), 'v');
    const p = notePath(140, 118);
    expect(svg).toContain(`d="${p.body}"`);
    expect(svg).toContain(`d="${p.fold}"`);
    expect(svg).toContain('style="fill:#b5ffff;');
    expect(textsOf(svg, 'note')).toEqual(['Valida si califica', ' ', 'Riesgo Bajo - verde']);
    expect(svg).toMatch(/data-node="note"[\s\S]*?<text x="708" y="[\d.]+" text-anchor="start"[^>]*class="ad-visual__text"[^>]*font-size="11"/);
  });

  it('sin lienzo, el medidor es el aproximado', () => {
    expect(textMeasurer('sans-serif')(400)).toBe(approxTextWidth);
  });
});
