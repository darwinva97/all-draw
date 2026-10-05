/**
 * Nombre de un nodo dentro de su caja (aspecto Archi): la zona útil (caja menos borde, márgenes, partes de la figura e
 * icono) se calcula aquí y el ajuste (`layoutLabel` de `@all-draw/notation-archimate`, el mismo que usa el SVG) decide
 * letra, líneas, «…» y si cabe la línea del tipo. El navegador parte las líneas por los mismos sitios: mismo ancho,
 * misma letra (medida con `canvas.measureText`) y `<wbr>` donde el ajuste admite partir una palabra.
 */
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { View } from '@all-draw/core';
import { approxTextWidth, layoutLabel, type LabelLayout, type LabelLayoutOptions, type MeasureText } from '@all-draw/notation-archimate';

/**
 * Preferencia de la vista `style.showTypeNames`: pintar el nombre del tipo bajo el nombre del elemento. Por defecto no
 * en ArchiMate (el icono de la esquina ya dice el tipo, como en Archi) y sí en el resto de notaciones.
 */
export function showTypeNamesOf(view: Pick<View, 'notationId' | 'style'> | undefined): boolean {
  const v = view?.style?.showTypeNames;
  return typeof v === 'boolean' ? v : view?.notationId !== 'archimate';
}

const FALLBACK_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
let ctx2d: CanvasRenderingContext2D | null | undefined;
let family: string | undefined;
const widths = new Map<string, number>();

/**
 * Medida real del texto con la letra de los nodos (la familia que hereda `.ad-editor`), con caché. Sin lienzo (pruebas
 * sin DOM) usa la aproximación por carácter.
 */
export function canvasMeasure(weight: number): MeasureText {
  return (text, fontSize) => {
    if (ctx2d === undefined) {
      try { ctx2d = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx2d = null; }
    }
    if (!ctx2d) return approxTextWidth(text, fontSize);
    if (!family) family = (typeof document !== 'undefined' && getComputedStyle(document.querySelector('.ad-editor') ?? document.body).fontFamily) || FALLBACK_FAMILY;
    const key = `${weight}|${fontSize}|${text}`;
    let w = widths.get(key);
    if (w === undefined) {
      ctx2d.font = `${weight} ${fontSize}px ${family}`;
      w = ctx2d.measureText(text).width;
      if (widths.size > 20000) widths.clear();
      widths.set(key, w);
    }
    return w;
  };
}

const measures = new Map<number, MeasureText>();
/** Medidor del lienzo para un grosor de letra (uno por grosor, compartido). */
export const measureFor = (weight: number): MeasureText => { let m = measures.get(weight); if (!m) { m = canvasMeasure(weight); measures.set(weight, m); } return m; };

const layouts = new Map<string, LabelLayout>();
/**
 * `layoutLabel` con la medida del lienzo y caché por texto y caja (muchos nodos comparten tamaño y letra). El ancho se
 * reduce medio píxel: el navegador redondea distinto que `measureText` y una línea al límite saltaría.
 */
export function fitNodeLabel(text: string, o: Omit<LabelLayoutOptions, 'measure'> & { weight: number }): LabelLayout {
  const key = `${o.weight}|${o.width}|${o.height}|${o.fontSize}|${o.minFontSize ?? ''}|${o.maxLines ?? ''}|${o.iconHeight ?? ''}|${o.typeName ?? ''}|${o.typeSlack ?? ''}|${text}`;
  let l = layouts.get(key);
  if (!l) {
    l = layoutLabel(text, { ...o, width: Math.max(0, o.width - 0.5), measure: measureFor(o.weight) });
    if (layouts.size > 5000) layouts.clear();
    layouts.set(key, l);
  }
  return l;
}

/** Texto con `<wbr>` tras «/», «_», «-» y «.» (donde `wrapLines` también admite partir). */
export function withBreaks(text: string): ReactNode {
  const parts = text.split(/(?<=[/_.-])(?=[^/_.\-\s])/);
  return parts.length < 2 ? text : parts.map((p, i) => <Fragment key={i}>{i > 0 && <wbr />}{p}</Fragment>);
}

/**
 * Contenido y estilo de la etiqueta ajustada: entera (el navegador la parte igual) o, si se ha recortado, línea a línea
 * con su «…». `-webkit-line-clamp` es la red: si el navegador sacara una línea más, la corta con «…» dentro de la caja.
 */
export function fittedLabel(text: string, fit: LabelLayout): { content: ReactNode; style: CSSProperties; title?: string } {
  const style: CSSProperties = { fontSize: fit.fontSize, lineHeight: `${fit.lineHeight}px` };
  if (fit.truncated) return { content: fit.lines.map((l, i) => <span key={i} className="ad-node__line">{l}</span>), style, title: text };
  return { content: withBreaks(text), style: { ...style, WebkitLineClamp: Math.max(1, fit.lines.length) } };
}
