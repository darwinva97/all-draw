import { describe, it, expect } from 'vitest';
import {
  approxTextWidth, breakPieces, wrapLines, ellipsize, fitText, layoutLabel, notePath, noteFoldSize, figureOf, figureParts, figurePartsCached,
  isJunction, JUNCTION_OR, ELLIPSIS, MIN_LABEL_FONT, TYPE_LINE, type MeasureText,
} from '../src/figures';

/** Medida inyectable y exacta: cada carácter mide medio tamaño de letra. */
const mono: MeasureText = (s, fs) => Array.from(s).length * fs * 0.5;

describe('ajuste de texto: salto de línea', () => {
  it('parte por palabras sin pasarse del ancho', () => {
    // 10 px → 5 px por carácter; 60 px = 12 caracteres
    expect(wrapLines('Valida si el cliente existe', 60, 10, mono)).toEqual(['Valida si el', 'cliente', 'existe']);
    for (const l of wrapLines('Valida si el cliente existe', 60, 10, mono)) expect(mono(l, 10)).toBeLessThanOrEqual(60);
  });

  it('respeta los saltos de línea (un párrafo vacío es una línea en blanco)', () => {
    expect(wrapLines('Uno\n\nDos tres', 100, 10, mono)).toEqual(['Uno', '', 'Dos tres']);
  });

  it('dentro de una palabra solo parte tras «/», «_», «-» o «.»', () => {
    expect(breakPieces('GET: /underwriting/{id}/retrieve').map(p => p.text)).toEqual(['GET:', '/', 'underwriting/', '{id}/', 'retrieve']);
    expect(breakPieces('a b').map(p => p.space)).toEqual([false, true]);
    expect(wrapLines('/underwriting/{underwritingid}/retrieve', 100, 10, mono)).toEqual(['/underwriting/', '{underwritingid}/', 'retrieve']);
  });

  it('una palabra más ancha que la línea queda sola (la recorta `fitText`)', () => {
    expect(wrapLines('a Supercalifragilístico b', 40, 10, mono)).toEqual(['a', 'Supercalifragilístico', 'b']);
  });

  it('la medida aproximada da más a las mayúsculas y a la «m» que a la «i»', () => {
    expect(approxTextWidth('MMM', 10)).toBeGreaterThan(approxTextWidth('aaa', 10));
    expect(approxTextWidth('aaa', 10)).toBeGreaterThan(approxTextWidth('iii', 10));
    expect(approxTextWidth('', 10)).toBe(0);
  });
});

describe('ajuste de texto: letra y «…»', () => {
  it('si cabe, lo deja con la letra de partida', () => {
    const f = fitText('Aplica reglas', { width: 100, height: 40, fontSize: 11.5, measure: mono });
    expect(f).toMatchObject({ lines: ['Aplica reglas'], fontSize: 11.5, truncated: false });
    expect(f.lineHeight).toBeCloseTo(11.5 * 1.25);
  });

  it('si no cabe, baja la letra de medio en medio píxel hasta que quepa', () => {
    // A 11,5 px (2 líneas de 14,4 px) no cabe en 26 px de alto; a 10 px (2 de 12,5 px), sí
    const f = fitText('Valida nivel de riesgo', { width: 70, height: 26, fontSize: 11.5, measure: mono });
    expect(f.truncated).toBe(false);
    expect(f.fontSize).toBeLessThan(11.5);
    expect(f.fontSize).toBeGreaterThanOrEqual(MIN_LABEL_FONT);
    expect(f.fontSize * 2).toBe(Math.round(f.fontSize * 2));
    expect(f.lines.length * f.lineHeight).toBeLessThanOrEqual(26);
    for (const l of f.lines) expect(mono(l, f.fontSize)).toBeLessThanOrEqual(70);
  });

  it('a 9 px y aún sin sitio, recorta con «…» y nunca se sale de la caja', () => {
    const text = 'Consulta solicitud existente Aliados ALIADOS con un nombre larguísimo';
    const f = fitText(text, { width: 60, height: 24, fontSize: 11.5, measure: mono });
    expect(f.truncated).toBe(true);
    expect(f.fontSize).toBe(MIN_LABEL_FONT);
    expect(f.lines.length).toBe(Math.floor(24 / (9 * 1.25)));
    expect(f.lines.at(-1)!.endsWith(ELLIPSIS)).toBe(true);
    for (const l of f.lines) expect(mono(l, 9)).toBeLessThanOrEqual(60);
  });

  it('una palabra que no cabe ni a 9 px se recorta con «…»', () => {
    const f = fitText('Supercalifragilísticoexpialidoso', { width: 50, height: 40, fontSize: 13, measure: mono });
    expect(f.truncated).toBe(true);
    expect(f.lines).toHaveLength(1);
    expect(f.lines[0]!.endsWith(ELLIPSIS)).toBe(true);
    expect(mono(f.lines[0]!, 9)).toBeLessThanOrEqual(50);
  });

  it('`maxLines` (título de contenedor): como mucho dos líneas', () => {
    const f = fitText('Uno dos tres cuatro cinco seis siete ocho nueve diez once doce', { width: 60, height: 500, fontSize: 11.5, maxLines: 2, measure: mono });
    expect(f.lines).toHaveLength(2);
    expect(f.truncated).toBe(true);
    expect(f.lines[1]!.endsWith(ELLIPSIS)).toBe(true);
  });

  it('`minFontSize` igual a la letra: no reduce, solo recorta (notas)', () => {
    const f = fitText('a\nb\nc\nd\ne', { width: 100, height: 30, fontSize: 11, minFontSize: 11, lineHeight: 14 / 11, measure: mono });
    expect(f.fontSize).toBe(11);
    expect(f.lines).toEqual(['a', `b${ELLIPSIS}`]);
  });

  it('sin sitio ni para una línea, no pinta nada; texto vacío, ninguna línea', () => {
    expect(fitText('Hola', { width: 100, height: 5, fontSize: 11.5, measure: mono }).lines).toEqual([]);
    expect(fitText('   ', { width: 100, height: 50, fontSize: 11.5, measure: mono })).toMatchObject({ lines: [], truncated: false });
  });

  it('ellipsize: recorta por el final y con `force` añade «…» aunque quepa', () => {
    expect(ellipsize('abcdefghij', 30, 10, mono)).toBe(`abcde${ELLIPSIS}`);
    expect(ellipsize('abc', 30, 10, mono)).toBe('abc');
    expect(ellipsize('abc', 30, 10, mono, true)).toBe(`abc${ELLIPSIS}`);
    expect(ellipsize('abc', 2, 10, mono)).toBe('');
  });

  it('con la medida aproximada (sin DOM) también respeta la caja', () => {
    const f = fitText('Visualiza resumen con resultado de la validacion', { width: 110, height: 40, fontSize: 11.5 });
    for (const l of f.lines) expect(approxTextWidth(l, f.fontSize)).toBeLessThanOrEqual(110);
    expect(f.lines.length * f.lineHeight).toBeLessThanOrEqual(40);
  });
});

describe('bloque de etiqueta: nombre del tipo e icono', () => {
  it('el tipo solo se pinta si cabe entero bajo el nombre', () => {
    const roomy = layoutLabel('Revisar', { width: 120, height: 50, fontSize: 13, typeName: 'Task', measure: mono });
    expect(roomy.showType).toBe(true);
    expect(roomy.height).toBeCloseTo(13 * 1.25 + 1 + TYPE_LINE);
    const tight = layoutLabel('Revisar', { width: 120, height: 20, fontSize: 13, typeName: 'Task', measure: mono });
    expect(tight.showType).toBe(false);
    const narrow = layoutLabel('Revisar', { width: 30, height: 80, fontSize: 9, typeName: 'Business Process', measure: mono });
    expect(narrow.showType).toBe(false);
    expect(layoutLabel('Revisar', { width: 120, height: 50, fontSize: 13, measure: mono }).showType).toBe(false);
  });

  it('el icono de texto reserva su alto sobre el nombre', () => {
    const l = layoutLabel('Uno dos', { width: 200, height: 40, fontSize: 13, iconHeight: 16, measure: mono });
    expect(l.height).toBeCloseTo(16 + 1 + 13 * 1.25);
  });
});

describe('Junction y nota', () => {
  it('Junction «or»: el mismo círculo, hueco (sin relleno de tinta)', () => {
    expect(isJunction('archimate:Junction')).toBe(true);
    expect(isJunction('archimate:Grouping')).toBe(false);
    const and = figureOf('archimate:Junction', 0);
    expect(figureOf('archimate:Junction', 0, 'or')).toBe(JUNCTION_OR);
    expect(figureOf('archimate:Grouping', 0, 'or')).not.toBe(JUNCTION_OR);
    expect(JUNCTION_OR.path(15, 15)).toBe(and.path(15, 15));
    expect(figureParts(and, 15, 15, '#000', '#000').map(p => p.fill)).toEqual(['#000', '#000']);
    expect(figureParts(JUNCTION_OR, 15, 15, '#fff', '#000').map(p => p.fill)).toEqual(['#fff']);
    expect(figurePartsCached('archimate:Junction', 0, 15, 15, '#fff', '#000', 1, undefined, 'or')).toHaveLength(1);
    expect(figurePartsCached('archimate:Junction', 0, 15, 15, '#fff', '#000', 1)).toHaveLength(2);
  });

  it('nota: esquina doblada abajo a la derecha (12 px, menos en notas pequeñas)', () => {
    expect(noteFoldSize(140, 118)).toBe(12);
    expect(noteFoldSize(24, 30)).toBe(8);
    const p = notePath(140, 100);
    expect(p.body).toBe('M0.5,0.5L139.5,0.5L139.5,87.5L127.5,99.5L0.5,99.5Z');
    expect(p.fold).toBe('M127.5,99.5L127.5,87.5L139.5,87.5Z');
  });
});

describe('bloque de etiqueta: el nombre manda sobre el icono', () => {
  it('si el icono obliga a reducir el nombre y sin él cabe mejor, el icono no se pinta', () => {
    // 30 px de alto: con icono (17) quedan 13 px, ni una línea de 13 px; sin icono caben dos líneas a 12 px
    const l = layoutLabel('Equipos de producto', { width: 70, height: 30, fontSize: 13, iconHeight: 16, measure: mono });
    expect(l.showIcon).toBe(false);
    expect(l.fontSize).toBeGreaterThan(9);
    const roomy = layoutLabel('Público', { width: 120, height: 40, fontSize: 13, iconHeight: 16, measure: mono });
    expect(roomy).toMatchObject({ showIcon: true, fontSize: 13 });
  });
});

describe('bloque de etiqueta: la línea del tipo puede usar el margen vertical', () => {
  it('con `typeSlack`, el tipo entra aunque el bloque pase un poco de la zona útil (sin salir de la caja)', () => {
    const o = { width: 140, height: 46, fontSize: 13, iconHeight: 16, typeName: 'Proceso', measure: mono };
    expect(layoutLabel('Validar los datos', o).showType).toBe(false);
    const l = layoutLabel('Validar los datos', { ...o, typeSlack: 8 });
    expect(l.showType).toBe(true);
    expect(l.height).toBeLessThanOrEqual(46 + 8);
  });
});
