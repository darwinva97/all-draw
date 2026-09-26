import { figureOf, figureParts, iconParts, showsIcon } from '@all-draw/notation-archimate';

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
}

/**
 * Fondo SVG de un elemento ArchiMate con las figuras de Archi (`FIGURES` del pack): con la figura por defecto
 * se pinta el icono 16×16 en la esquina superior derecha con el color del trazo; con la alternativa, sin icono.
 */
export function ArchimateFigure({ typeId, figure, w, h, fill, stroke, strokeWidth = 1, borderStyle }: ArchimateFigureProps) {
  const alt = figure === 1;
  const def = figureOf(typeId, alt ? 1 : 0);
  const dash = borderStyle === 'dashed' ? '6 4' : borderStyle === 'dotted' ? '2 3' : undefined;
  const parts = figureParts(def, w, h, fill, stroke, strokeWidth, dash);
  const icon = showsIcon(typeId, figure) ? iconParts(typeId, stroke) : [];
  return (
    <>
      <svg className="ad-node__svg ad-archi" viewBox={`0 0 ${w} ${h}`} width={w} height={h} overflow="visible" aria-hidden data-figure={alt ? 1 : 0}>
        {parts.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      {icon.length > 0 && (
        <svg className="ad-archi__icon" viewBox="0 0 16 16" width={16} height={16} overflow="visible" aria-hidden>
          {icon.map((p, i) => <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinejoin="round" strokeLinecap="round" />)}
        </svg>
      )}
    </>
  );
}
