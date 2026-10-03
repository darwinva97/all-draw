/**
 * Figuras del lienzo: la persona C4 tiene figura propia (no el monigote), las figuras SVG reciben el color real del
 * tipo (antes, círculo blanco sin trazo) y los contenedores claros neutros toman el panel en tema oscuro.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ElementType, ViewNode } from '@all-draw/core';
import { ShapeSvg, figureFor, personGeometry, shapeColors, shapeStyle, isNeutralLight, DARK_PANEL } from '../src/nodes/shapes';
import { personGeometry as svgPersonGeometry, isNeutralLight as svgIsNeutralLight } from '../../io/src/svg';
import { defaultSize } from '../src/Canvas';

const vn = (extra: Partial<ViewNode> = {}): ViewNode => ({ id: 'n', viewId: 'v', x: 0, y: 0, w: 160, h: 150, style: {}, ...extra }) as ViewNode;
const type = (extra: Partial<ElementType>): ElementType => ({ id: 't', name: 'T', fields: [], ...extra }) as ElementType;

describe('figuras del lienzo', () => {
  it('c4:Person se pinta como persona C4; freeform:actor y otros actores siguen siendo monigote', () => {
    expect(figureFor('c4:Person', 'actor')).toBe('person');
    expect(figureFor('freeform:actor', 'actor')).toBe('actor');
    expect(figureFor('c4:SoftwareSystem', 'rounded')).toBe('rounded');
    expect(defaultSize('actor', false, 'c4:Person')).toEqual({ w: 160, h: 150 });
    expect(defaultSize('actor', false, 'freeform:actor')).toEqual({ w: 60, h: 90 });
  });

  it('la persona lleva cabeza y cuerpo con el color del tipo, en coordenadas del nodo', () => {
    const { fill, stroke } = shapeColors(type({ shape: 'actor', color: '#08427B' }), vn(), {});
    expect(fill).toBe('#08427B');
    const html = renderToStaticMarkup(createElement(ShapeSvg, { shape: 'person', fill, stroke, w: 160, h: 150 }));
    const g = personGeometry(160, 150);
    expect(html).toContain('viewBox="0 0 160 150"');
    expect(html).not.toContain('preserveAspectRatio');
    expect(html).toMatch(new RegExp(`<rect x="1" y="${g.bodyTop}"[^>]*fill="#08427B"`));
    expect(html).toMatch(/<circle cx="80"[^>]*fill="#08427B"/);
    // Misma geometría en el SVG exportado
    expect(svgPersonGeometry(160, 150)).toEqual(g);
    expect(g.bodyTop).toBeGreaterThan(2 * g.r);
  });

  it('las figuras SVG reciben el relleno y el trazo reales (la caja CSS es transparente)', () => {
    const t = type({ shape: 'actor', color: '#dcfce7' });
    const css = shapeStyle('actor', t, vn({ w: 60, h: 90 }), {});
    expect(css.background).toBe('transparent');
    const { fill, stroke } = shapeColors(t, vn({ w: 60, h: 90 }), {});
    expect(fill).toBe('#dcfce7');
    expect(stroke).not.toBe('transparent');
    const html = renderToStaticMarkup(createElement(ShapeSvg, { shape: 'actor', fill, stroke, w: 60, h: 90 }));
    expect(html).toMatch(/<path[^>]*fill="none"[^>]*stroke="#[0-9a-f]{6}"/);
    expect(html).toMatch(/<circle[^>]*fill="#dcfce7"/);
    // Reglas y estilo de la aparición mandan sobre el color del tipo
    expect(shapeColors(t, vn({ style: { fill: '#ff0000' } as ViewNode['style'] }), {}).fill).toBe('#ff0000');
    expect(shapeColors(t, vn(), { bg: '#00ff00', border: '#000000' })).toEqual({ fill: '#00ff00', stroke: '#000000' });
  });

  it('tema oscuro: un contenedor blanco o gris neutro (pool, lane, límite) toma el panel; uno con color propio no', () => {
    const pool = type({ shape: 'pool', container: true, color: '#F5F5F5' });
    expect(shapeColors(pool, vn(), {}, false).fill).toBe('#F5F5F5');
    const dark = shapeColors(pool, vn(), {}, true);
    expect(dark.fill).toBe(DARK_PANEL);
    expect(dark.stroke).not.toBe('#555');
    expect(shapeColors(pool, vn({ style: { fill: '#e0f2fe' } as ViewNode['style'] }), {}, true).fill).toBe('#e0f2fe');
    // Un estado amarillo (contenedor con color de tinte) y una tarea blanca (no contenedor) conservan su color
    expect(shapeColors(type({ shape: 'rounded', container: true, color: '#FFF2CC' }), vn(), {}, true).fill).toBe('#FFF2CC');
    expect(shapeColors(type({ shape: 'rounded', color: '#FFFFFF' }), vn(), {}, true).fill).toBe('#FFFFFF');
    for (const c of ['#FFFFFF', '#F5F5F5', '#f1f5f9', '#FFF2CC', '#85BBF0', undefined]) expect(isNeutralLight(c)).toBe(svgIsNeutralLight(c));
  });
});
