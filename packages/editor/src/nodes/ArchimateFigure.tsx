import { memo } from 'react';
import { figureOf, figurePartsCached, iconPartsCached, showsIcon, RECT, ROUNDED } from '@all-draw/notation-archimate';

export interface ArchimateFigureProps {
  typeId: string;
  /** `0` rectángulo con icono (por defecto de Archi), `1` figura alternativa. */
  figure?: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  /** `dashed` / `dotted` de las reglas de estilo. */
  borderStyle?: string;
  /** El contorno lo pinta la caja CSS del nodo (`archimateBox`): aquí solo el icono. */
  box?: boolean;
  /** Zoom bajo: sin icono (mide menos de 5 px en pantalla). */
  lowDetail?: boolean;
  /** `or`: Junction hueca. */
  variant?: string;
}

/**
 * Figura que se puede pintar con la propia caja CSS del nodo, sin SVG: el rectángulo y el rectángulo redondeado de
 * Archi con trazo sólido de 1 px, que son la figura por defecto de casi todos los tipos. El path de Archi va a medio
 * píxel del borde con trazo 1, que ocupa exactamente una sombra interior de 1 px; el radio del redondeado es 10 (el
 * navegador lo recorta a la mitad del lado, como `roundedPath`). Devuelve el radio o `undefined`.
 */
export function archimateBox(typeId: string, figure: number | undefined, strokeWidth = 1, borderStyle?: string): number | undefined {
  if (strokeWidth !== 1 || (borderStyle && borderStyle !== 'solid')) return undefined;
  const def = figureOf(typeId, figure === 1 ? 1 : 0);
  return def === RECT ? 0 : def === ROUNDED ? 10 : undefined;
}

/**
 * Fondo SVG de un elemento ArchiMate con las figuras de Archi (`FIGURES` del pack): con la figura por defecto
 * se pinta el icono 16×16 en la esquina superior derecha con el color del trazo; con la alternativa, sin icono.
 * Los paths salen de una caché acotada por tipo, figura, tamaño y colores (`figurePartsCached`, `iconPartsCached`).
 * (Probado: el icono como imagen `data:` de fondo compartida es más lento al cambiar de vista, por la decodificación
 * de cada SVG-imagen; ver docs/06-rendimiento.md.)
 */
export const ArchimateFigure = memo(function ArchimateFigure({ typeId, figure, w, h, fill, stroke, strokeWidth = 1, borderStyle, box, lowDetail, variant }: ArchimateFigureProps) {
  const alt = figure === 1;
  const dash = borderStyle === 'dashed' ? '6 4' : borderStyle === 'dotted' ? '2 3' : undefined;
  const parts = box ? NONE : figurePartsCached(typeId, figure, w, h, fill, stroke, strokeWidth, dash, variant);
  const icon = !lowDetail && showsIcon(typeId, figure) ? iconPartsCached(typeId, stroke) : NONE;
  return (
    <>
      {parts.length > 0 && (
        <svg className="ad-node__svg ad-archi" viewBox={`0 0 ${w} ${h}`} width={w} height={h} overflow="visible" aria-hidden data-figure={alt ? 1 : 0}>
          {parts.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinejoin="round" strokeLinecap="round" />)}
        </svg>
      )}
      {icon.length > 0 && (
        <svg className="ad-archi__icon" viewBox="0 0 16 16" width={16} height={16} overflow="visible" aria-hidden>
          {icon.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />)}
        </svg>
      )}
    </>
  );
});

const NONE: never[] = [];
