import type { CSSProperties } from 'react';
import type { ElementType, RuleStyle, Shape, ViewNode } from '@all-draw/core';

/**
 * Figura que se pinta: la del tipo, salvo la persona de C4 (`c4:Person`, tipo `actor`) y el almacén de datos DFD
 * (`dfd:DataStore`, tipo `bar`: dos líneas paralelas con el nombre entre ellas), que tienen figura propia.
 */
export type Figure = Shape | 'person' | 'store';
export function figureFor(typeId: string | undefined, shape: Shape): Figure {
  if (shape === 'actor' && !!typeId && typeId.startsWith('c4:')) return 'person';
  if (shape === 'bar' && typeId === 'dfd:DataStore') return 'store';
  return shape;
}

/** Tinta de los pseudoestados negros (inicial, final, bifurcación…) en tema oscuro: negro sobre negro no se ve. */
export const DARK_INK = '#e6e8ec';
/** Negro o casi negro (luminancia < 40). */
export function isInk(hex: string | undefined): boolean {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null; if (!m) return false;
  const n = parseInt(m[1]!, 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 40;
}

/** Color del panel en tema oscuro (`--ad-panel` de `.theme-dark`). */
export const DARK_PANEL = '#161a22';

/** Blanco o gris muy claro sin apenas tinte (#fff, #f5f5f5, #f1f5f9…): el "papel" de pools, lanes, límites y grupos. */
export function isNeutralLight(hex: string | undefined): boolean {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null; if (!m) return false;
  const n = parseInt(m[1]!, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
}

/**
 * Relleno y trazo de un nodo (regla → estilo de la aparición → color del tipo → tema), antes de pasarlos a la figura.
 * En tema oscuro, un contenedor cuyo tipo es blanco o gris claro neutro (pool, lane, límite C4, paquete…) toma el color
 * del panel, como el resto de la interfaz; un color puesto a mano (regla o estilo) se respeta. El SVG hace lo mismo.
 */
export function shapeColors(type: ElementType | undefined, vn: ViewNode, rule: RuleStyle, dark = false): { fill: string; stroke: string } {
  const own = rule.bg ?? vn.style.fill;
  const paper = dark && own === undefined && !!type?.container && isNeutralLight(type.color);
  // Pseudoestados negros en oscuro: tinta clara (relleno y trazo), como en el SVG exportado (`--ad-ink`).
  const ink = dark && own === undefined && isInk(type?.color);
  const fill = paper ? DARK_PANEL : ink ? DARK_INK : own ?? type?.color ?? (dark ? '#1c2230' : '#ffffff');
  return { fill, stroke: rule.border ?? vn.style.stroke ?? (ink ? DARK_INK : darken(paper ? type!.color! : fill, 0.35)) };
}

/**
 * Persona C4: cabeza (círculo) y cuerpo (rectángulo muy redondeado) en coordenadas del nodo (w×h); el texto va dentro
 * del cuerpo, que empieza en `bodyTop`. La misma geometría está en `packages/io/src/svg.ts` (`personGeometry`).
 */
export function personGeometry(w: number, h: number): { cx: number; cy: number; r: number; bodyTop: number; bodyH: number; rx: number } {
  const r = Math.max(6, Math.min(w * 0.17, h * 0.19));
  const bodyTop = Math.round(2 * r + 3);
  const bodyH = Math.max(4, h - bodyTop - 1);
  return { cx: w / 2, cy: r + 1, r, bodyTop, bodyH, rx: Math.min(r * 1.3, bodyH / 2, (w - 2) / 2) };
}

/** Actor (monigote) en coordenadas del nodo, sin deformar la cabeza aunque el nodo no sea cuadrado. Igual en `svg.ts`. */
export function actorGeometry(w: number, h: number): { cx: number; cy: number; r: number; path: string } {
  const r = Math.max(4, Math.min(w * 0.2, h * 0.12));
  const cx = w / 2, cy = r + 1, neck = cy + r, hip = h * 0.62, arm = neck + (hip - neck) * 0.3, dx = w * 0.32, leg = w * 0.25;
  const f = (n: number) => Math.round(n * 100) / 100;
  return { cx, cy, r, path: `M${f(cx)},${f(neck)} V${f(hip)} M${f(cx - dx)},${f(arm)} H${f(cx + dx)} M${f(cx)},${f(hip)} L${f(cx - leg)},${f(h - 1)} M${f(cx)},${f(hip)} L${f(cx + leg)},${f(h - 1)}` };
}

/** `dark`: el relleno por defecto (sin color de tipo ni de regla) es el del panel oscuro; los colores de tipo se mantienen. */
export function shapeStyle(shape: Shape, type: ElementType | undefined, vn: ViewNode, rule: RuleStyle, dark = false): CSSProperties {
  const { fill, stroke } = shapeColors(type, vn, rule, dark);
  const css: CSSProperties = {
    width: vn.w, height: vn.h,
    background: fill, borderColor: stroke,
    color: rule.text ?? vn.style.text ?? readable(fill),
    fontSize: vn.style.fontSize,
    borderWidth: rule.borderWidth ?? 1,
    borderStyle: rule.borderStyle ?? 'solid',
  };
  // Opacidad en línea solo si la regla o el estilo la fijan: un `opacity: 1` en línea anulaba `.is-dimmed` (otra notación).
  const opacity = rule.opacity ?? vn.style.opacity;
  if (opacity !== undefined) css.opacity = opacity;
  if (rule.accent) { css.boxShadow = `inset ${rule.accentWidth ?? 4}px 0 0 ${rule.accent}`; }
  if (rule.top) { css.boxShadow = `${css.boxShadow ? css.boxShadow + ',' : ''} inset 0 ${rule.topWidth ?? 4}px 0 ${rule.top}`; }
  if (rule.glow) { css.boxShadow = `${css.boxShadow ? css.boxShadow + ',' : ''} 0 0 12px ${rule.glow}`; }
  if (['ellipse', 'diamond', 'hexagon', 'parallelogram', 'cylinder', 'actor', 'circle', 'double-circle', 'bar'].includes(shape)) {
    css.background = 'transparent'; css.borderColor = 'transparent';
    if (['circle', 'double-circle', 'diamond', 'bar', 'actor'].includes(shape)) css.color = rule.text ?? vn.style.text ?? (dark ? '#e6e8ec' : '#111');
  }
  return css;
}

/**
 * Figuras que no se pueden hacer con CSS: se pintan en un SVG de fondo con el relleno y el trazo del nodo
 * (`shapeColors`; la caja CSS de estas figuras es transparente). Las que dependen de proporciones (actor, persona C4)
 * se dibujan en coordenadas del nodo (`w`×`h`); el resto, en un viewBox 0..100 estirado.
 */
export function ShapeSvg({ shape, fill, stroke, w = 100, h = 100, dark = false }: { shape: Figure; fill: string; stroke: string; figure?: number; w?: number; h?: number; dark?: boolean }) {
  const f = fill === 'transparent' ? '#fff' : fill;
  const common = { fill: f, stroke, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const };
  if (shape === 'person' || shape === 'actor') {
    const ww = Math.max(1, w), hh = Math.max(1, h);
    let body: React.ReactNode;
    if (shape === 'person') {
      const g = personGeometry(ww, hh);
      body = <><rect x={1} y={g.bodyTop} width={ww - 2} height={g.bodyH} rx={g.rx} {...common} /><circle cx={g.cx} cy={g.cy} r={g.r} {...common} /></>;
    } else {
      const g = actorGeometry(ww, hh);
      body = <><path d={g.path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" /><circle cx={g.cx} cy={g.cy} r={g.r} {...common} /></>;
    }
    return <svg className="ad-node__svg" viewBox={`0 0 ${ww} ${hh}`} aria-hidden>{body}</svg>;
  }
  let body: React.ReactNode = null;
  switch (shape) {
    case 'ellipse': body = <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />; break;
    case 'circle': body = <circle cx="50" cy="50" r="48" {...common} />; break;
    case 'double-circle':
      // Relleno oscuro (estado final): diana, anillo vacío y punto lleno. Claro (evento intermedio BPMN): dos círculos.
      body = bullseye(fill, dark)
        ? <><circle cx="50" cy="50" r="47" fill="#fff" stroke={f} strokeWidth={2} vectorEffect="non-scaling-stroke" /><circle cx="50" cy="50" r="30" fill={f} stroke="none" /></>
        : <><circle cx="50" cy="50" r="48" {...common} /><circle cx="50" cy="50" r="38" {...common} /></>;
      break;
    case 'diamond': body = <polygon points="50,1 99,50 50,99 1,50" {...common} />; break;
    case 'hexagon': body = <polygon points="25,2 75,2 98,50 75,98 25,98 2,50" {...common} />; break;
    case 'parallelogram': body = <polygon points="20,2 98,2 80,98 2,98" {...common} />; break;
    case 'bar': body = <rect x="0" y="40" width="100" height="20" {...common} fill={stroke} />; break;
    case 'cylinder': body = <><path d="M2,15 v70 a48,12 0 0 0 96,0 v-70" {...common} /><ellipse cx="50" cy="15" rx="48" ry="12" {...common} /></>; break;
    case 'store': body = <><rect x="0" y="1" width="100" height="98" fill={f} stroke="none" /><path d="M0,1 H100 M0,99 H100" fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /></>; break;
    default: return null;
  }
  return <svg className="ad-node__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>{body}</svg>;
}

/** El círculo doble se pinta como diana (estado final) si su relleno es tinta: negro, o la tinta clara del tema oscuro. */
export function bullseye(fill: string, dark = false): boolean {
  return isInk(fill) || (dark && fill === DARK_INK);
}

export function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#555';
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
export function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#111';
  const n = parseInt(m[1]!, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}
