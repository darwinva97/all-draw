import type { CSSProperties } from 'react';
import type { ElementType, RuleStyle, Shape, ViewNode } from '@all-draw/core';

/**
 * Figura que se pinta: la del tipo, salvo la persona de C4 (`c4:Person`, tipo `actor`), el almacén de datos DFD
 * (`dfd:DataStore`, tipo `bar`: dos líneas paralelas con el nombre entre ellas) y las figuras propias de las notaciones
 * UML nuevas (`EXTRA_FIGURES`: paquete, componente, artefacto, nodo 3D, interfaz requerida, puerto, final de flujo,
 * enviar y recibir señal). La misma tabla y geometría están en `packages/io/src/svg.ts`.
 */
export type ExtraFigure = 'package' | 'component' | 'artifact' | 'node3d' | 'socket' | 'port' | 'flow-final' | 'send' | 'receive';
export type Figure = Shape | 'person' | 'store' | ExtraFigure;
/** Figura propia por tipo; la `shape` del tipo sigue mandando en tamaño por defecto, rótulo (dentro o debajo) y lint. */
export const EXTRA_FIGURES: Readonly<Record<string, ExtraFigure>> = {
  'usecase:Package': 'package', 'component:Package': 'package',
  'component:Component': 'component', 'deployment:Component': 'component',
  'component:Artifact': 'artifact', 'deployment:Artifact': 'artifact', 'deployment:DeploymentSpecification': 'artifact',
  'deployment:Node': 'node3d', 'deployment:Device': 'node3d', 'deployment:ExecutionEnvironment': 'node3d',
  'component:RequiredInterface': 'socket', 'component:Port': 'port',
  'activity:FlowFinal': 'flow-final', 'activity:SendSignal': 'send', 'activity:AcceptEvent': 'receive',
};
/** Figuras nuevas que dibuja entera el SVG (la caja CSS queda transparente); el resto solo añade un icono a la caja. */
export const SVG_ONLY_FIGURES: ReadonlySet<string> = new Set(['package', 'node3d', 'socket', 'port', 'flow-final', 'send', 'receive']);
export function figureFor(typeId: string | undefined, shape: Shape): Figure {
  if (shape === 'actor' && !!typeId && typeId.startsWith('c4:')) return 'person';
  if (shape === 'bar' && typeId === 'dfd:DataStore') return 'store';
  return (typeId && EXTRA_FIGURES[typeId]) || shape;
}
export const isExtraFigure = (f: Figure): f is ExtraFigure => Object.values(EXTRA_FIGURES).includes(f as ExtraFigure);

/** Pieza de una figura nueva en coordenadas del nodo: `fill` relleno + trazo, `shade` relleno oscurecido, `line` solo trazo. */
export interface FigurePart { d: string; paint: 'fill' | 'shade' | 'line' }
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Pestaña del paquete (alto) y fondo de la caja 3D: también fijan el margen del texto. */
export const packageTab = (w: number, h: number) => ({ tw: r2(Math.min(Math.max(w * 0.4, 30), 120)), th: r2(Math.min(14, h * 0.3)) });
export const nodeDepth = (w: number, h: number) => r2(Math.max(6, Math.min(14, Math.min(w, h) * 0.12)));
const arrowTip = (w: number, h: number) => r2(Math.min(h / 2, w * 0.25));

/**
 * Geometría de las figuras nuevas (w×h, trazo de 1,5 a medio píxel del borde). `undefined` si la figura no es nueva.
 * Paquete: carpeta con pestaña; componente: icono de componente arriba a la derecha (la caja la pinta el CSS); artefacto:
 * icono de documento; nodo: caja 3D; interfaz requerida: semicírculo abierto a la derecha; puerto: cuadrado; final de
 * flujo: círculo con aspa; enviar señal: pentágono en flecha; recibir: rectángulo con muesca a la izquierda.
 */
export function figureParts(fig: Figure, w: number, h: number): FigurePart[] | undefined {
  const a = 0.75, W = r2(w - a), H = r2(h - a);
  switch (fig) {
    case 'package': { const { tw, th } = packageTab(w, h); return [{ d: `M${a},${a} H${tw} V${th} H${a} Z`, paint: 'fill' }, { d: `M${a},${th} H${W} V${H} H${a} Z`, paint: 'fill' }]; }
    case 'component': { const x = r2(w - 21), y = 6; return [{ d: `M${x + 4},${y} h12 v14 h-12 Z`, paint: 'fill' }, { d: `M${x},${y + 3} h8 v3 h-8 Z M${x},${y + 8} h8 v3 h-8 Z`, paint: 'fill' }]; }
    case 'artifact': { const x = r2(w - 18), y = 5; return [{ d: `M${x},${y} H${x + 7} L${x + 11},${y + 4} V${y + 14} H${x} Z`, paint: 'fill' }, { d: `M${x + 7},${y} V${y + 4} H${x + 11}`, paint: 'line' }]; }
    case 'node3d': {
      const d = nodeDepth(w, h);
      return [
        { d: `M${a},${d} L${d},${a} H${W} L${r2(W - d + a)},${d} Z`, paint: 'shade' },
        { d: `M${r2(W - d + a)},${d} L${W},${a} V${r2(H - d + a)} L${r2(W - d + a)},${H} Z`, paint: 'shade' },
        { d: `M${a},${d} H${r2(W - d + a)} V${H} H${a} Z`, paint: 'fill' },
      ];
    }
    case 'socket': { const r = r2(Math.min(w, h) / 2 - 2), cx = r2(w / 2 + r / 2), cy = r2(h / 2); return [{ d: `M${cx},${r2(cy - r)} A${r},${r} 0 0 0 ${cx},${r2(cy + r)}`, paint: 'line' }]; }
    case 'port': { const s = r2(Math.min(w, h) - 2), x = r2((w - s) / 2), y = r2((h - s) / 2); return [{ d: `M${x},${y} h${s} v${s} h${-s} Z`, paint: 'fill' }]; }
    case 'flow-final': {
      const r = r2(Math.min(w, h) / 2 - 1), cx = r2(w / 2), cy = r2(h / 2), k = r2(r * 0.7071);
      return [{ d: `M${r2(cx - r)},${cy} A${r},${r} 0 1 0 ${r2(cx + r)},${cy} A${r},${r} 0 1 0 ${r2(cx - r)},${cy} Z`, paint: 'fill' }, { d: `M${r2(cx - k)},${r2(cy - k)} L${r2(cx + k)},${r2(cy + k)} M${r2(cx + k)},${r2(cy - k)} L${r2(cx - k)},${r2(cy + k)}`, paint: 'line' }];
    }
    case 'send': { const t = arrowTip(w, h); return [{ d: `M${a},${a} H${r2(W - t)} L${W},${r2(h / 2)} L${r2(W - t)},${H} H${a} Z`, paint: 'fill' }]; }
    case 'receive': { const t = arrowTip(w, h); return [{ d: `M${a},${a} H${W} V${H} H${a} L${r2(a + t)},${r2(h / 2)} Z`, paint: 'fill' }]; }
    default: return undefined;
  }
}

/** Margen del texto dentro de las figuras nuevas (pestaña, caras de la caja 3D, punta y muesca de las señales). */
export function figureInset(fig: Figure, w: number, h: number): { top: number; right: number; bottom: number; left: number } {
  const z = { top: 0, right: 0, bottom: 0, left: 0 };
  if (fig === 'package') return { ...z, top: packageTab(w, h).th };
  if (fig === 'node3d') { const d = nodeDepth(w, h); return { ...z, top: d, right: d }; }
  if (fig === 'send') return { ...z, right: arrowTip(w, h) * 0.6 };
  if (fig === 'receive') return { ...z, left: arrowTip(w, h) * 0.6 };
  if (fig === 'component' || fig === 'artifact') return { ...z, right: 14 };
  return z;
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
  const extra = figureParts(shape, Math.max(1, w), Math.max(1, h));
  if (extra) {
    const paint = (p: FigurePart) => (p.paint === 'line' ? { fill: 'none', stroke, strokeWidth: 1.5 } : { fill: p.paint === 'shade' && /^#[0-9a-f]{6}$/i.test(f) ? darken(f, 0.12) : f, stroke, strokeWidth: 1.5 });
    return <svg className="ad-node__svg" viewBox={`0 0 ${Math.max(1, w)} ${Math.max(1, h)}`} aria-hidden>{extra.map((p, i) => <path key={i} d={p.d} strokeLinejoin="round" {...paint(p)} />)}</svg>;
  }
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
