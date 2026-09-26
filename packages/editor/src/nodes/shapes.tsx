import type { CSSProperties } from 'react';
import type { ElementType, RuleStyle, Shape, ViewNode } from '@all-draw/core';

export function shapeStyle(shape: Shape, type: ElementType | undefined, vn: ViewNode, rule: RuleStyle): CSSProperties {
  const fill = rule.bg ?? vn.style.fill ?? type?.color ?? '#ffffff';
  const stroke = rule.border ?? vn.style.stroke ?? darken(fill, 0.35);
  const css: CSSProperties = {
    width: vn.w, height: vn.h,
    background: fill, borderColor: stroke,
    color: rule.text ?? vn.style.text ?? readable(fill),
    opacity: rule.opacity ?? vn.style.opacity ?? 1,
    fontSize: vn.style.fontSize,
    borderWidth: rule.borderWidth ?? 1,
    borderStyle: rule.borderStyle ?? 'solid',
  };
  if (rule.accent) { css.boxShadow = `inset ${rule.accentWidth ?? 4}px 0 0 ${rule.accent}`; }
  if (rule.top) { css.boxShadow = `${css.boxShadow ? css.boxShadow + ',' : ''} inset 0 ${rule.topWidth ?? 4}px 0 ${rule.top}`; }
  if (rule.glow) { css.boxShadow = `${css.boxShadow ? css.boxShadow + ',' : ''} 0 0 12px ${rule.glow}`; }
  if (['ellipse', 'diamond', 'hexagon', 'parallelogram', 'cylinder', 'actor', 'circle', 'double-circle', 'bar'].includes(shape)) {
    css.background = 'transparent'; css.borderColor = 'transparent';
  }
  return css;
}

/** Figuras que no se pueden hacer con CSS: se pintan en un SVG de fondo. */
export function ShapeSvg({ shape, fill, stroke }: { shape: Shape; fill: string; stroke: string; figure?: number }) {
  const f = fill === 'transparent' ? '#fff' : fill;
  const common = { fill: f, stroke, strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' as const };
  let body: React.ReactNode = null;
  switch (shape) {
    case 'ellipse': body = <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />; break;
    case 'circle': body = <circle cx="50" cy="50" r="48" {...common} />; break;
    case 'double-circle': body = <><circle cx="50" cy="50" r="48" {...common} /><circle cx="50" cy="50" r="38" {...common} /></>; break;
    case 'diamond': body = <polygon points="50,1 99,50 50,99 1,50" {...common} />; break;
    case 'hexagon': body = <polygon points="25,2 75,2 98,50 75,98 25,98 2,50" {...common} />; break;
    case 'parallelogram': body = <polygon points="20,2 98,2 80,98 2,98" {...common} />; break;
    case 'bar': body = <rect x="0" y="40" width="100" height="20" {...common} fill={stroke} />; break;
    case 'cylinder': body = <><path d="M2,15 v70 a48,12 0 0 0 96,0 v-70" {...common} /><ellipse cx="50" cy="15" rx="48" ry="12" {...common} /></>; break;
    case 'actor': body = <><circle cx="50" cy="14" r="12" {...common} /><path d="M50,26 v34 M20,40 h60 M50,60 l-22,38 M50,60 l22,38" fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" /></>; break;
    default: return null;
  }
  return <svg className="ad-node__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>{body}</svg>;
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
