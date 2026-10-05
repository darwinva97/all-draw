/**
 * Figuras e iconos ArchiMate, fieles a Archi.
 *
 * Escrito a mano mirando `com.archimatetool.editor/src/com/archimatetool/editor/diagram/figures/elements/*Figure.java`
 * (y los delegados `BoxFigureDelegate`, `CylinderFigureDelegate`, `ProcessFigureDelegate`, `ServiceFigureDelegate`,
 * `ParallelogramFigureDelegate`, `RoundedRectangleFigureDelegate`, `AbstractMotivationFigure`). No lo genera `generate.mjs`.
 *
 * - `icon`: el `IIconDelegate.drawIcon` de cada figura, pasado a un path SVG en un viewBox 0 0 16 16 (trazo 1, sin
 *   relleno salvo `iconSolid`, que Archi rellena con el color del trazo).
 * - `figure0`: figura por defecto de Archi (`type == 0`): rectángulo o rectángulo redondeado con icono; en Motivación
 *   un octógono achaflanado (`custom` + `base`); Junction es solo un círculo relleno.
 * - `figure1`: figura alternativa (`type == 1`), sin icono, con las proporciones del Java (márgenes fijos, `getFigurePositionFromTextPosition`…).
 */

export interface Inset { top?: number; right?: number; bottom?: number; left?: number }

/** Descripción de una figura: paths en coordenadas absolutas del nodo (0,0)-(w,h). */
export interface FigureDef {
  /** Contorno principal (relleno con el color del nodo y trazo). */
  path: (w: number, h: number) => string;
  /** `fill`: solo relleno; `stroke`: solo trazo (figuras hechas de líneas gruesas). Por defecto ambos. */
  mode?: 'fill' | 'stroke';
  /** Líneas decorativas (solo trazo), pintadas sobre `path`. */
  lines?: (w: number, h: number) => string;
  /** Capa superior con relleno y trazo (círculos que tapan a otros). */
  over?: (w: number, h: number) => string;
  /** Partes rellenas con el color del trazo (puntos, flechas, Junction). */
  solid?: (w: number, h: number) => string;
  /** Grosor del trazo de `path` y `lines` (Archi lo calcula a partir del tamaño en algunas figuras). */
  strokeWidth?: (w: number, h: number) => number;
  /** Guiones del trazo de `path`. */
  dash?: (w: number, h: number) => string;
  /** Márgenes de la zona útil para el texto. */
  inset?: (w: number, h: number) => Inset;
}

export interface Figure {
  icon: string;
  /** Parte del icono rellena con el color del trazo. */
  iconSolid?: string;
  /** Grosor del trazo del icono (1 por defecto). */
  iconStroke?: number;
  figure0: 'rect' | 'rounded' | 'custom';
  /** Figura de `figure0 === 'custom'` (octógono de Motivación, círculo de Junction). */
  base?: FigureDef;
  /** Figura alternativa. */
  figure1?: FigureDef;
  /** Nunca se pinta icono (Junction). */
  noIcon?: true;
}

// ---------------------------------------------------------------- Utilidades geométricas
interface R { x: number; y: number; w: number; h: number }
type Gen = (r: R) => string;

const n = (v: number): string => (Math.round(v * 100) / 100).toString();
const P = (x: number, y: number): string => `${n(x)},${n(y)}`;
const M = (x: number, y: number): string => `M${P(x, y)}`;
const L = (x: number, y: number): string => `L${P(x, y)}`;
/** Círculo completo como dos arcos. */
const circle = (cx: number, cy: number, r: number): string => `M${P(cx + r, cy)}a${n(r)},${n(r)} 0 1 0 ${n(-2 * r)},0a${n(r)},${n(r)} 0 1 0 ${n(2 * r)},0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number): string => `M${P(cx + rx, cy)}a${n(rx)},${n(ry)} 0 1 0 ${n(-2 * rx)},0a${n(rx)},${n(ry)} 0 1 0 ${n(2 * rx)},0Z`;
/** Arco de elipse al estilo SWT: `start`/`sweep` en grados, 0 = 3 en punto, positivo antihorario en pantalla. */
function arc(cx: number, cy: number, rx: number, ry: number, start: number, sweep: number, move = true): string {
  const a0 = (start * Math.PI) / 180, a1 = ((start + sweep) * Math.PI) / 180;
  const x0 = cx + rx * Math.cos(a0), y0 = cy - ry * Math.sin(a0);
  const x1 = cx + rx * Math.cos(a1), y1 = cy - ry * Math.sin(a1);
  const large = Math.abs(sweep) > 180 ? 1 : 0, flag = sweep > 0 ? 0 : 1;
  return `${move ? M(x0, y0) : ''}A${n(rx)},${n(ry)} 0 ${large} ${flag} ${P(x1, y1)}`;
}
const poly = (pts: [number, number][]): string => pts.map((p, i) => (i ? L(p[0], p[1]) : M(p[0], p[1]))).join('') + 'Z';
const shrink = (r: R, d: number): R => ({ x: r.x + d, y: r.y + d, w: Math.max(1, r.w - 2 * d), h: Math.max(1, r.h - 2 * d) });
/** `getFigurePositionFromTextPosition(rect, ratio)`: encaja la figura en la proporción `ratio` (ancho/alto), centrada. */
function fit(r: R, ratio: number): R {
  if (r.h * ratio <= r.w) { const w = r.h * ratio; return { x: r.x + (r.w - w) / 2, y: r.y, w, h: r.h }; }
  const h = r.w / ratio; return { x: r.x, y: r.y + (r.h - h) / 2, w: r.w, h };
}
/** Convierte un generador sobre `R` (con medio píxel de margen para el trazo) en `(w, h) => path`. */
const gen = (g: Gen) => (w: number, h: number): string => g({ x: 0.5, y: 0.5, w: Math.max(1, w - 1), h: Math.max(1, h - 1) });
const rectPath: Gen = ({ x, y, w, h }) => `${M(x, y)}h${n(w)}v${n(h)}h${n(-w)}Z`;
const roundedPath = (rad: number): Gen => ({ x, y, w, h }) => {
  const r = Math.min(rad, w / 2, h / 2);
  return `${M(x + r, y)}h${n(w - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(r)}v${n(h - 2 * r)}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(r)}h${n(2 * r - w)}a${n(r)},${n(r)} 0 0 1 ${n(-r)},${n(-r)}v${n(2 * r - h)}a${n(r)},${n(r)} 0 0 1 ${n(r)},${n(-r)}Z`;
};
/** Octógono achaflanado de `AbstractMotivationFigure` (INSET 10). */
const octagon: Gen = ({ x, y, w, h }) => {
  const c = Math.min(10, w / 2, h / 2);
  return poly([[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]);
};

// ---------------------------------------------------------------- Figuras por defecto
export const RECT: FigureDef = { path: gen(rectPath) };
/** `RoundedRectangleFigureDelegate`: arco 20 → radio 10. */
export const ROUNDED: FigureDef = { path: gen(roundedPath(10)) };
const OCTAGON: FigureDef = { path: gen(octagon), inset: () => ({ left: 4, right: 4 }) };
const GROUP_RECT: FigureDef = { path: gen(rectPath), dash: () => '6 3' };

// ---------------------------------------------------------------- Figuras alternativas (compartidas por capas)
/** `ProcessFigureDelegate`: flecha gruesa. */
const PROCESS: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const x1 = x + w * 0.7, y1 = y + h / 5, y2 = y + h - h / 5;
    return poly([[x, y1], [x1, y1], [x1, y], [x + w, y + h / 2], [x1, y + h], [x1, y2], [x, y2]]);
  }),
  inset: (_w, h) => ({ top: h / 5, bottom: h / 5 }),
};
/** `EventFigure`: muesca a la izquierda y arco a la derecha. */
const EVENT: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const indent = Math.min(h / 3, w / 3), cy = y + h / 2, ax = x + w - indent;
    return `${M(x, y)}${L(x + indent, cy)}${L(x, y + h)}${L(ax, y + h)}A${n(indent)},${n(h / 2)} 0 0 0 ${P(ax, y)}Z`;
  }),
  inset: (w, h) => { const i = Math.min(h / 3, w / 3); return { left: i / 2, right: i / 3 }; },
};
/** `ServiceFigureDelegate`: rectángulo con arcos de radio alto (píldora). */
const SERVICE: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const rx = Math.min(h, w * 0.8) / 2, ry = h / 2;
    return `${M(x + rx, y)}h${n(w - 2 * rx)}A${n(rx)},${n(ry)} 0 0 1 ${P(x + w - rx, y + h)}h${n(2 * rx - w)}A${n(rx)},${n(ry)} 0 0 1 ${P(x + rx, y)}Z`;
  }),
  inset: (w, h) => { const rx = Math.min(h, w * 0.8) / 2; return { left: rx / 3, right: rx / 3 }; },
};
/** `FunctionFigure`: pentágono con punta arriba y muesca abajo (OFFSET 5). */
const FUNCTION: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const y1 = y + h / 5, y2 = y + h - h / 5;
    return poly([[x, y + h], [x, y1], [x + w / 2, y], [x + w, y1], [x + w, y + h], [x + w / 2, y2]]);
  }),
  inset: (_w, h) => ({ top: h / 5 }),
};
/** `InteractionFigure`: dos medios círculos separados (FRACTION 0.86). */
const INTERACTION: FigureDef = {
  path: gen((r0) => {
    const r = fit(shrink(r0, 0.5), 1 / 0.86);
    const GAP = 0.14;
    let d: number, x1 = r.x, x2: number;
    if (r.w <= r.h) { d = r.w * 0.86; x2 = r.x + r.w; }
    else { d = Math.min(r.h, r.w * 0.85); x1 += (r.w - d) / 2 - (d * GAP) / 2; x2 = x1 + d + d * GAP; }
    const y = r.y + (r.h - d) / 2, rad = d / 2;
    return `${M(x1 + rad, y)}A${n(rad)},${n(rad)} 0 0 0 ${P(x1 + rad, y + d)}Z${M(x2 - rad, y + d)}A${n(rad)},${n(rad)} 0 0 0 ${P(x2 - rad, y)}Z`;
  }),
  inset: (w) => ({ left: w * 0.06, right: w * 0.06 }),
};
/** `CollaborationFigure`: dos círculos solapados. */
const COLLABORATION: FigureDef = {
  path: gen((r0) => {
    const r = fit(shrink(r0, 0.5), 1.5);
    let d: number, x1 = r.x;
    if (r.w <= r.h) d = (r.w / 3) * 2;
    else { d = Math.min(r.h, (r.w / 3) * 2); x1 += r.w / 2 - d * 0.75; }
    const x2 = x1 + d / 2, y = r.y + (r.h - d) / 2;
    return circle(x1 + d / 2, y + d / 2, d / 2) + circle(x2 + d / 2, y + d / 2, d / 2);
  }),
  inset: (w) => ({ left: w * 0.06, right: w * 0.06 }),
};
/** `InterfaceFigure`: elipse en todo el rectángulo. */
const INTERFACE: FigureDef = {
  path: gen((r0) => { const r = fit(shrink(r0, 0.5), 1); return ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2); }),
  inset: (w) => ({ left: w * 0.08, right: w * 0.08 }),
};
/** `BusinessActorFigure`: monigote. */
const ACTOR: FigureDef = {
  path: gen((r0) => {
    const r = fit(r0, 2 / 3);
    const d = Math.min(r.w / 2, r.h / 3), cx = r.x + r.w / 2, cy = r.y + (r.h + 1) / 2;
    return circle(cx, cy - d, d / 2);
  }),
  lines: gen((r0) => {
    const r = fit(r0, 2 / 3);
    const d = Math.min(r.w / 2, r.h / 3), cx = r.x + r.w / 2, cy = r.y + (r.h + 1) / 2;
    const top = cy - d / 2, hip = top + d, foot = top + 2 * d - 1;
    return `${M(cx, top)}${L(cx, hip)}${M(cx, hip)}${L(cx - d, foot)}${M(cx, hip)}${L(cx + d, foot)}${M(cx - d, cy - d / 4)}${L(cx + d, cy - d / 4)}`;
  }),
};
/** `CylinderFigureDelegate` (Business Role y Stakeholder): cilindro tumbado. */
const CYLINDER_H: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const rx = w / 8, ry = h / 2;
    return `${M(x + rx, y)}A${n(rx)},${n(ry)} 0 0 0 ${P(x + rx, y + h)}${L(x + w - rx, y + h)}A${n(rx)},${n(ry)} 0 0 0 ${P(x + w - rx, y)}Z`;
  }),
  lines: gen(({ x, y, w, h }) => `${M(x + w - w / 8, y)}A${n(w / 8)},${n(h / 2)} 0 0 0 ${P(x + w - w / 8, y + h)}`),
  inset: (w) => ({ left: w / 8, right: w / 8 }),
};
/** `ObjectFigure`: rectángulo con banda superior (TOP_MARGIN 12). */
const OBJECT: FigureDef = { path: gen(rectPath), lines: gen(({ x, y, w }) => `${M(x, y + 12)}h${n(w)}`), inset: () => ({ top: 12 }) };
/** `ContractFigure`: banda arriba y abajo. */
const CONTRACT: FigureDef = { path: gen(rectPath), lines: gen(({ x, y, w, h }) => `${M(x, y + 12)}h${n(w)}${M(x, y + h - 12)}h${n(w)}`), inset: () => ({ top: 12, bottom: 12 }) };
/** `ProductFigure`: pestaña en la esquina superior izquierda. */
const PRODUCT: FigureDef = { path: gen(rectPath), lines: gen(({ x, y, w }) => `${M(x, y + 12)}${L(x + w / 2, y + 12)}${L(x + w / 2, y)}`), inset: () => ({ top: 12 }) };
/** `DeliverableFigure.getFigurePath(curveHeight, rect, inset)`. */
const wavy = (curve: number): Gen => ({ x, y, w, h }) => {
  const cy = y + h - curve;
  return `${M(x, y)}${L(x, cy - 1)}Q${P(x + w / 4, y + h + curve)} ${P(x + w / 2 + 1, cy)}Q${P(x + w - w / 4, cy - curve - 1)} ${P(x + w, cy)}${L(x + w, y)}Z`;
};
const DELIVERABLE: FigureDef = { path: gen(wavy(8)), inset: () => ({ bottom: 8 }) };
const REPRESENTATION: FigureDef = { path: gen(wavy(6)), lines: gen(({ x, y, w }) => `${M(x, y + 12)}h${n(w)}`), inset: () => ({ top: 12, bottom: 6 }) };
/** `ApplicationComponentFigure`: cuerpo con dos cajitas a la izquierda (INDENT 10). */
const COMPONENT: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const k = h < 50 ? h / 50 : 1, b1 = 10 * k, b2 = 30 * k, bh = 13 * k, i = 10;
    return poly([[x + i, y], [x + w, y], [x + w, y + h], [x + i, y + h], [x + i, y + b2 + bh], [x, y + b2 + bh], [x, y + b2], [x + i, y + b2], [x + i, y + b1 + bh], [x, y + b1 + bh], [x, y + b1], [x + i, y + b1]]);
  }),
  lines: gen(({ x, y, h }) => {
    const k = h < 50 ? h / 50 : 1, b1 = 10 * k, b2 = 30 * k, bh = 13 * k;
    return `${M(x + 10, y + b1)}h10v${n(bh)}h-10${M(x + 10, y + b2)}h10v${n(bh)}h-10`;
  }),
  inset: () => ({ left: 18 }),
};
/** `BoxFigureDelegate` (Node): caja 3D (EDGE_SIZE 14). */
const BOX: FigureDef = {
  path: gen(({ x, y, w, h }) => { const e = Math.min(14, w / 2, h / 2); return poly([[x, y + e], [x + e, y], [x + w, y], [x + w, y + h - e], [x + w - e, y + h], [x, y + h]]); }),
  lines: gen(({ x, y, w, h }) => { const e = Math.min(14, w / 2, h / 2); return `${M(x, y + e)}${L(x + w - e, y + e)}${L(x + w, y)}${M(x + w - e, y + e)}${L(x + w - e, y + h)}`; }),
  inset: (w, h) => { const e = Math.min(14, w / 2, h / 2); return { top: e, right: e }; },
};
/** `DeviceFigure`: caja redondeada sobre una peana (INDENT 15). */
const DEVICE: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const hi = h / 5, th = h - hi + 1, r = Math.min(15, w / 4, th / 2), ind = Math.min(15, w / 4);
    return roundedPath(r)({ x, y, w, h: th }) + poly([[x + 1, y + h], [x + ind + 1, y + th], [x + w - ind, y + th], [x + w - 1, y + h]]);
  }),
  inset: (_w, h) => ({ bottom: h / 5 }),
};
/** `SystemSoftwareFigure`: dos discos, el delantero tapa al trasero. */
const SYSTEM_SOFTWARE: FigureDef = {
  path: gen((r0) => { const r = fit(r0, 1); const d = (r.w / 3) * 2, x1 = r.x + (r.w - d) / 4, y1 = r.y + (r.h - d) / 2; return circle(x1 + d / 6 + d / 2, y1 + d / 2, d / 2); }),
  over: gen((r0) => { const r = fit(r0, 1); const d = (r.w / 3) * 2, x1 = r.x + (r.w - d) / 4, y1 = r.y + (r.h - d) / 2; return circle(x1 + d / 2, y1 + d / 6 + d / 2, d / 2); }),
};
/** `ArtifactFigure`: hoja con la esquina doblada (FOLD_HEIGHT 18). */
const ARTIFACT: FigureDef = {
  path: gen(({ x, y, w, h }) => { const f = Math.min(18, w / 2, h / 2); return poly([[x, y], [x + w - f, y], [x + w, y + f], [x + w, y + h], [x, y + h]]); }),
  lines: gen(({ x, y, w, h }) => { const f = Math.min(18, w / 2, h / 2); return `${M(x + w, y + f)}${L(x + w - f, y + f)}${L(x + w - f, y)}`; }),
  inset: (w, h) => ({ right: Math.min(18, w / 2, h / 2) / 2 }),
};
/** `DistributionNetworkFigure` / `PathFigure`: flecha doble gruesa. */
function network(r0: R, W: number, H: number) {
  const lw = Math.max(3, Math.sqrt(W * H) / 24);
  const r = shrink(fit(r0, 5 / 3), lw);
  const size = Math.min(r.h, r.w / 1.5 / 2), a = { w: size * 0.5, h: size };
  const cy = r.y + r.h / 2;
  return { lw, r, a, cy };
}
const netArrows: Gen = (r0) => {
  const { r, a, cy } = network(r0, r0.w, r0.h);
  return `${M(r.x + a.w, cy - a.h / 2)}${L(r.x, cy)}${L(r.x + a.w, cy + a.h / 2)}${M(r.x + r.w - a.w, cy - a.h / 2)}${L(r.x + r.w, cy)}${L(r.x + r.w - a.w, cy + a.h / 2)}`;
};
const DISTRIBUTION: FigureDef = {
  path: gen((r0) => {
    const { r, a, cy } = network(r0, r0.w, r0.h);
    const x1 = r.x + a.h / 5, x2 = r.x + r.w - a.h / 5, y1 = cy - a.h / 5, y2 = cy + a.h / 5;
    return poly([[x1, y1], [x2, y1], [r.x + r.w, cy], [x2, y2], [x1, y2], [r.x, cy]]);
  }),
  mode: 'fill',
  lines: gen((r0) => {
    const { r, a, cy } = network(r0, r0.w, r0.h);
    const x1 = r.x + a.h / 5, x2 = r.x + r.w - a.h / 5;
    return `${M(x1, cy - a.h / 5)}${L(x2, cy - a.h / 5)}${M(x1, cy + a.h / 5)}${L(x2, cy + a.h / 5)}` + netArrows(r0);
  }),
  strokeWidth: (w, h) => Math.max(3, Math.sqrt(w * h) / 24),
};
const PATH: FigureDef = {
  path: gen((r0) => { const { r, cy } = network(r0, r0.w, r0.h); return `${M(r.x, cy)}${L(r.x + r.w, cy)}`; }),
  mode: 'stroke',
  dash: (w, h) => { const lw = Math.max(3, Math.sqrt(w * h) / 24); return `${n(lw * 2)} ${n(lw)}`; },
  lines: gen(netArrows),
  strokeWidth: (w, h) => Math.max(3, Math.sqrt(w * h) / 24),
};
/** `CommunicationNetworkFigure`: cuatro nodos unidos por un paralelogramo. */
function commNet(r0: R) {
  const r = fit(r0, 1);
  const size = Math.min(r.w, r.h), blob = Math.max(10, Math.sqrt(r.w * r.h) / 7), br = blob / 2;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, wo = size / 3, ho = size / 4;
  const x = cx - wo, y = cy - ho, w = wo * 2, h = ho * 2, indent = w / 5;
  return { x, y, w, h, indent, blob, br, lw: blob / 4 };
}
const COMM_NETWORK: FigureDef = {
  path: gen((r0) => {
    const { x, y, w, h, indent, br } = commNet(r0);
    return poly([[x + br, y + h - br], [x + w - indent - br, y + h - br], [x + w - br, y + br], [x + indent + br, y + br]]);
  }),
  mode: 'stroke',
  over: gen((r0) => {
    const { x, y, w, h, indent, br } = commNet(r0);
    return circle(x + br, y + h - br, br) + circle(x + w - indent - br, y + h - br, br) + circle(x + indent + br, y + br, br) + circle(x + w - br, y + br, br);
  }),
  strokeWidth: (w, h) => { const r = fit({ x: 0, y: 0, w, h }, 1); return Math.max(10, Math.sqrt(r.w * r.h) / 7) / 4; },
};
/** `MaterialFigure`: hexágono con tres trazos. */
function material(r0: R) {
  const r = fit(shrink(r0, 0.5), 10 / 9);
  let fw = r.w, fh = r.h;
  if (r.w <= r.h) fh = r.w - r.w / 10; else fw = Math.min(r.h + r.w / 10, r.w);
  return { x: r.x + (r.w - fw) / 2, y: r.y + (r.h - fh) / 2, fw, fh };
}
const MATERIAL: FigureDef = {
  path: gen((r0) => { const { x, y, fw, fh } = material(r0); return poly([[x + fw / 4, y], [x, y + fh / 2], [x + fw / 4, y + fh], [x + (3 * fw) / 4, y + fh], [x + fw, y + fh / 2], [x + (3 * fw) / 4, y]]); }),
  lines: gen((r0) => {
    const { x, y, fw, fh } = material(r0);
    return `${M(x + (3 * fw) / 8, y + fh / 10)}${L(x + fw / 6, y + fh / 2)}${M(x + fw / 3, y + fh - fh / 7)}${L(x + fw - fw / 3, y + fh - fh / 7)}${M(x + fw - (3 * fw) / 8, y + fh / 10)}${L(x + fw - fw / 6, y + fh / 2)}`;
  }),
  inset: (w) => ({ left: w * 0.06, right: w * 0.06 }),
};
/** `EquipmentFigure`: dos engranajes (`getPathShape` con rotaciones de 14°/31° y 22°/23°). */
function gear(rect: R): string {
  const s = Math.min(rect.w, rect.h), cx = rect.x + s / 2, cy = rect.y + s / 2;
  const rot = (p: [number, number], deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180, dx = p[0] - cx, dy = p[1] - cy;
    return [dx * Math.cos(a) - dy * Math.sin(a) + cx, dx * Math.sin(a) + dy * Math.cos(a) + cy];
  };
  const first: [number, number] = [cx, rect.y];
  const second: [number, number] = [cx - s / 5.9, rect.y + s / 6.5];
  let fc = rot(first, 14), sc = rot(rot(second, 22), 23);
  const pts: [number, number][] = [first, fc, sc];
  sc = rot(sc, 22); pts.push(sc);
  for (let i = 0; i < 7; i++) {
    fc = rot(fc, 31); pts.push(fc); fc = rot(fc, 14); pts.push(fc);
    sc = rot(sc, 23); pts.push(sc); sc = rot(sc, 22); pts.push(sc);
  }
  return poly(pts);
}
function equipment(r0: R) {
  const r = fit(shrink(r0, 2), 1);
  const xc = r.x + r.w / 2, yc = r.y + r.h / 2, m = Math.min(r.w, r.h);
  const w1 = (m * 2) / 3, w2 = m / 2;
  const r1: R = { x: xc - (w1 * 2) / 3, y: yc - w1 / 2 + w1 / 4, w: w1, h: w1 };
  const r2: R = { x: xc, y: yc - w2 * 0.96, w: w2, h: w2 };
  return { r1, r2 };
}
const EQUIPMENT: FigureDef = {
  path: gen((r0) => { const { r1, r2 } = equipment(r0); return gear(r1) + gear(r2); }),
  lines: gen((r0) => { const { r1, r2 } = equipment(r0); return circle(r1.x + r1.w / 2, r1.y + r1.h / 2, r1.w / 6) + circle(r2.x + r2.w / 2, r2.y + r2.h / 2, r2.w / 6); }),
};
/** `FacilityFigure`: fábrica con tres dientes de sierra. */
const FACILITY: FigureDef = {
  path: gen((r0) => {
    const r = fit(r0, 1), s = Math.min(r.w, r.h), x = r.x + (r.w - s) / 2, y = r.y + (r.h - s) / 2;
    const xt = s / 4 + s / 20, yt = s / 5, hb = s / 2;
    return poly([[x, y], [x, y + s], [x + s, y + s], [x + s, y + hb], [x + s - xt, y + hb + yt], [x + s - xt, y + hb], [x + s - 2 * xt, y + hb + yt], [x + s - 2 * xt, y + hb], [x + s - 3 * xt, y + hb + yt], [x + s - 3 * xt, y]]);
  }),
};
/** `LocationFigure`: chincheta. */
const LOCATION: FigureDef = {
  path: gen((r0) => {
    const r = fit(r0, 1), f = Math.min(r.w, r.h), ym = (r.h - f + 2) / 2, xc = r.x + r.w / 2, d = (f / 4) * 3;
    return arc(xc, r.y + ym + d / 2, d / 2, d / 2, -35, 250) + L(xc, r.y + r.h - ym) + 'Z';
  }),
};
/** `GroupingFigure` tipo 1: pestaña (TOPBAR_HEIGHT 18, INSET 1.4). El título va en la pestaña. */
const GROUP_TAB: FigureDef = {
  path: gen(({ x, y, w, h }) => { const tw = w / 1.4, th = Math.min(18, h / 2); return poly([[x, y + h], [x, y], [x + tw, y], [x + tw, y + th], [x + w, y + th], [x + w, y + h]]); }),
  lines: gen(({ x, y, w, h }) => `${M(x, y + Math.min(18, h / 2))}h${n(w / 1.4)}`),
  dash: () => '6 3',
  inset: (w) => ({ right: w - w / 1.4 }),
};
/** `JunctionFigure`: círculo relleno (AND) con el color del trazo (negro: la tinta del tema). */
const JUNCTION: FigureDef = {
  path: gen((r) => circle(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2)),
  solid: gen((r) => circle(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2)),
};
/** `JunctionFigure` con `junctionType = or`: el mismo círculo, hueco (relleno del fondo, borde de tinta). */
export const JUNCTION_OR: FigureDef = { path: JUNCTION.path };
/** `ResourceFigure`: caja con pestaña lateral (pila) y tres barras. */
const RESOURCE: FigureDef = {
  path: gen(({ x, y, w, h }) => {
    const nw = w / 12, nh = h / 3, ny = y + (h - nh) / 2, a = Math.min(5, w / 4, h / 4), b = Math.min(3, nh / 3);
    return `${M(x + a, y)}${L(x + w - nw - a, y)}Q${P(x + w - nw, y)} ${P(x + w - nw, y + a)}${L(x + w - nw, ny)}${L(x + w - b, ny)}Q${P(x + w, ny)} ${P(x + w, ny + b)}${L(x + w, ny + nh - b)}Q${P(x + w, ny + nh)} ${P(x + w - b, ny + nh)}${L(x + w - nw, ny + nh)}${L(x + w - nw, y + h - a)}Q${P(x + w - nw, y + h)} ${P(x + w - nw - a, y + h)}${L(x + a, y + h)}Q${P(x, y + h)} ${P(x, y + h - a)}${L(x, y + a)}Q${P(x, y)} ${P(x + a, y)}Z`;
  }),
  lines: gen(({ x, y, w, h }) => {
    const nw = w / 12, nh = h / 3, ny = y + (h - nh) / 2, g = w / 6, t = y + h / 5, b = y + (h * 4) / 5;
    return `${M(x + w - nw, ny)}v${n(nh)}${M(x + g, t)}${L(x + g, b)}${M(x + 2 * g, t)}${L(x + 2 * g, b)}${M(x + 3 * g, t)}${L(x + 3 * g, b)}`;
  }),
  inset: (w) => ({ right: w / 12 }),
};
/** `CapabilityFigure`: escalera de tres peldaños. */
function capability(r0: R) {
  const r = shrink(fit(r0, 1), 0.5);
  const b = Math.min(r.h / 3, r.w / 3), x = r.x + (r.w - 3 * b) / 2, y = r.y + (r.h - 3 * b) / 2;
  return { x, y, b };
}
const CAPABILITY: FigureDef = {
  path: gen((r0) => { const { x, y, b } = capability(r0); return poly([[x, y + 3 * b], [x, y + 2 * b], [x + b, y + 2 * b], [x + b, y + b], [x + 2 * b, y + b], [x + 2 * b, y], [x + 3 * b, y], [x + 3 * b, y + 3 * b]]); }),
  lines: gen((r0) => { const { x, y, b } = capability(r0); return `${M(x + b, y + 3 * b)}${L(x + b, y + 2 * b)}${M(x + 2 * b, y + 3 * b)}${L(x + 2 * b, y + b)}${M(x + b, y + 2 * b)}${L(x + 3 * b, y + 2 * b)}${M(x + 2 * b, y + b)}${L(x + 3 * b, y + b)}`; }),
};
/** `ValueStreamFigure`: flecha (chevron). */
const VALUE_STREAM: FigureDef = {
  path: gen(({ x, y, w, h }) => { const i = Math.min(h / 2, w / 2), cy = y + h / 2, px = x + w - i; return poly([[x, y], [x + i, cy], [x, y + h], [px, y + h], [x + w, cy], [px, y]]); }),
  inset: (w, h) => { const i = Math.min(h / 2, w / 2); return { left: i / 2, right: i / 2 }; },
};
/** `CourseOfActionFigure`: diana con flecha curva desde abajo a la izquierda. */
function courseOfAction(r0: R) {
  const r = fit(shrink(r0, 0.5), 1.24);
  const rad = Math.min(Math.round(r.h / 2.5), Math.round(r.w / 3.1));
  const fw = rad * 3.1, fh = rad * 2.5;
  const cx = r.x + r.w - rad - (r.w - fw) / 2, cy = r.y + rad + (r.h - fh) / 2;
  const r2 = Math.max(1, Math.round((rad * 2) / 3 - 0.5)), r3 = Math.max(1, Math.round(rad / 3 - 0.5));
  const x0 = cx - rad * 2, y0 = cy + rad * 2;
  // Intersección de la línea (x0,y0)→(cx-r3,cy-r3) con el círculo de radio `rad` centrado en (cx-r3,cy-r3)
  const ccx = cx - r3, ccy = cy - r3, dx = x0 - ccx, dy = y0 - ccy, len = Math.hypot(dx, dy) || 1;
  const ix = ccx + (dx / len) * rad, iy = ccy + (dy / len) * rad;
  const aL = r3 * 1.5, aW = Math.max(3, aL / 5);
  return { r, rad, cx, cy, r2, r3, x0, y0, ix, iy, aL, aW };
}
const COURSE_OF_ACTION: FigureDef = {
  path: gen((r0) => { const { cx, cy, rad } = courseOfAction(r0); return circle(cx, cy, rad); }),
  over: gen((r0) => { const { cx, cy, r2 } = courseOfAction(r0); return circle(cx, cy, r2); }),
  solid: gen((r0) => { const { cx, cy, r3, ix, iy, aL } = courseOfAction(r0); return circle(cx, cy, r3) + poly([[ix, iy], [ix - aL, iy - aL / 3], [ix - aL / 3, iy + aL]]); }),
  lines: gen((r0) => { const { r, x0, y0, ix, iy, aW } = courseOfAction(r0); return `${M(x0, r.y + r.h - 1)}${L(x0 + (ix - x0) / 3, iy + (y0 - iy) / 3)}${L(ix - aW, iy + aW)}`; }),
  strokeWidth: (w, h) => courseOfAction({ x: 0.5, y: 0.5, w: w - 1, h: h - 1 }).aW,
};
/** `DriverFigure`: timón. */
function driver(r0: R) {
  const r = fit(r0, 1);
  const lw = Math.max(1, Math.sqrt(r0.w * r0.h) / 20);
  let rad = Math.min(r.h / 2, r.w / 2); rad -= rad % 2;
  const actual = rad - Math.round(rad / 10) - lw / 2;
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, rad, actual, lw };
}
const DRIVER: FigureDef = {
  path: gen((r0) => { const { cx, cy, actual } = driver(r0); return circle(cx, cy, Math.max(1, actual)); }),
  lines: gen((r0) => {
    const { cx, cy, rad } = driver(r0), k = rad * Math.SQRT1_2;
    return `${M(cx - k, cy - k)}${L(cx + k, cy + k)}${M(cx - rad, cy)}${L(cx + rad, cy)}${M(cx - k, cy + k)}${L(cx + k, cy - k)}${M(cx, cy - rad)}${L(cx, cy + rad)}`;
  }),
  solid: gen((r0) => { const { cx, cy, rad } = driver(r0); return circle(cx, cy, Math.round(rad / 4)); }),
  strokeWidth: (w, h) => Math.max(1, Math.sqrt(w * h) / 20),
};
/** `AssessmentFigure`: lupa. */
function assessment(r0: R) {
  const r = fit(r0, 1);
  const rad = Math.min(Math.round(r.h / 2.5), Math.round(r.w / 2.5));
  const f = rad * 2.5 - 2;
  const cx = r.x + r.w - rad - (r.w - f) / 2, cy = r.y + rad + (r.h - f) / 2;
  return { rad, cx, cy };
}
const ASSESSMENT: FigureDef = {
  path: gen((r0) => { const { rad, cx, cy } = assessment(r0); return circle(cx, cy, rad); }),
  lines: gen((r0) => { const { rad, cx, cy } = assessment(r0), k = rad * Math.SQRT1_2; return `${M(cx - k, cy + k - 1)}${L(cx - 1.5 * rad + 1, cy + 1.5 * rad - 1)}`; }),
};
/** `GoalFigure`: diana. */
function goalRadius(r0: R) {
  const r = fit(shrink(r0, 0.5), 1);
  let rad = Math.min(r.h / 2, r.w / 2); rad -= rad % 2;
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, rad };
}
const GOAL: FigureDef = {
  path: gen((r0) => { const { cx, cy, rad } = goalRadius(r0); return circle(cx, cy, rad); }),
  over: gen((r0) => { const { cx, cy, rad } = goalRadius(r0); return circle(cx, cy, Math.max(1, Math.round((rad * 2) / 3 - 0.5))); }),
  solid: gen((r0) => { const { cx, cy, rad } = goalRadius(r0); const r2 = Math.round((rad * 2) / 3 - 0.5); return circle(cx, cy, Math.max(1, Math.round(r2 / 3 - 0.5))); }),
};
/** `OutcomeFigure`: diana con flecha hacia arriba a la derecha. */
function outcome(r0: R) {
  const r = fit(shrink(r0, 0.5), 1);
  const rad = Math.min(Math.round(r.h / 2.2), Math.round(r.w / 2.2)), f = rad * 2.2;
  const cx = r.x + rad + (r.w - f) / 2, cy = r.y + r.h - rad - (r.h - f) / 2;
  const r2 = Math.max(1, Math.round((rad * 2) / 3 - 0.5)), r3 = Math.max(1, Math.round(rad / 3 - 0.5));
  const aL = r3 * 0.8, aW = Math.max(2, aL / 6);
  return { rad, cx, cy, r2, r3, aL, aW };
}
const OUTCOME: FigureDef = {
  path: gen((r0) => { const { cx, cy, rad } = outcome(r0); return circle(cx, cy, rad); }),
  over: gen((r0) => { const { cx, cy, r2, r3 } = outcome(r0); return circle(cx, cy, r2) + circle(cx, cy, r3); }),
  solid: gen((r0) => { const { cx, cy, aL, aW } = outcome(r0); return poly([[cx - aW, cy + aW], [cx + aL, cy], [cx, cy - aL]]); }),
  lines: gen((r0) => {
    const { cx, cy, rad, aL, aW } = outcome(r0), k = 1.2;
    const px = cx + k * (rad - aL * 1.2), py = cy + k * (aL * 1.2 - rad);
    return `${M(cx, cy)}${L(cx + rad * k - 0.5 * aL, cy - rad * k + 0.5 * aL)}${M(px, py)}${L(cx + rad * k, cy - rad * k + aL + aW)}${M(px, py)}${L(cx + rad * k - aL - aW, cy - rad * k)}`;
  }),
  strokeWidth: (w, h) => outcome({ x: 0.5, y: 0.5, w: w - 1, h: h - 1 }).aW,
};
/** `PrincipleFigure`: cojín con signo de exclamación. */
const PRINCIPLE: FigureDef = {
  path: gen((r0) => {
    const r = fit(shrink(r0, 0.5), 1), { x, y, w, h } = r, fx = w / 24, fy = h / 24, c = Math.min(fx, fy);
    return `${M(x + c, y + c)}C${P(x + 8 * fx, y)} ${P(x + 16 * fx, y)} ${P(x + w - c, y + c)}C${P(x + w, y + 8 * fy)} ${P(x + w, y + 16 * fy)} ${P(x + w - c, y + h - c)}C${P(x + 16 * fx, y + h)} ${P(x + 8 * fx, y + h)} ${P(x + c, y + h - c)}C${P(x, y + 16 * fy)} ${P(x, y + 8 * fy)} ${P(x + c, y + c)}Z`;
  }),
  solid: gen((r0) => {
    const r = fit(shrink(r0, 0.5), 1), { x, y, w, h } = r, cx = x + w / 2;
    let u = Math.max(1, Math.round((h - 2) / 20)); if (u >= w / 2) u = Math.max(1, w / 4);
    return poly([[cx - u, y + 3 * u], [cx + u, y + 3 * u], [cx + 0.8 * u, y + h - 7 * u], [cx - 0.8 * u, y + h - 7 * u]]) + poly([[cx + 0.8 * u, y + h - 5 * u], [cx - 0.8 * u, y + h - 5 * u], [cx - 0.8 * u, y + h - 3 * u], [cx + 0.8 * u, y + h - 3 * u]]);
  }),
};
/** `ParallelogramFigureDelegate` (FLANGE 16), con barra para Constraint. */
const parallelogram = (slash: boolean): FigureDef => ({
  ...(slash ? { lines: gen(({ x, y, w, h }) => { const f = Math.min(16, w / 3), s = Math.min(20, w / 4); return `${M(x + f + s, y)}${L(x + s, y + h)}`; }) } : {}),
  path: gen(({ x, y, w, h }) => { const f = Math.min(16, w / 3); return poly([[x + f, y], [x + w, y], [x + w - f, y + h], [x, y + h]]); }),
  inset: (w) => { const f = Math.min(16, w / 3); return { left: f + (slash ? 8 : 0), right: f }; },
});
/** `MeaningFigure`: nube (rejilla 12×7). */
const MEANING: FigureDef = {
  path: gen((r0) => {
    const r = fit(r0, 5 / 3), { x, y } = r, gx = r.w / 12, gy = r.h / 7;
    const c = (a: number, b: number, d: number, e: number, f: number, g: number) => `C${P(x + a * gx, y + b * gy)} ${P(x + d * gx, y + e * gy)} ${P(x + f * gx, y + g * gy)}`;
    return `${M(x + gx, y + 2 * gy)}${c(0, 0, 2, 0, 3, 1)}${c(4, 0, 6, 0, 7, 1)}${c(8, 0, 10, 0, 10, 1)}${c(12, 0, 12, 2, 11, 3)}${c(12, 3, 12, 4, 11, 5)}${c(11, 7, 8, 7, 7, 6)}${c(6, 7, 2, 7, 2, 5)}${c(0, 5, 0, 3, 1, 2)}Z`
      + `${M(x + 0.5 * gx, y + 5.5 * gy)}${c(1, 5, 2, 5.5, 1.5, 6)}${c(1, 6.5, 0, 6, 0.5, 5.5)}Z`;
  }),
  inset: (w) => ({ left: w * 0.06, right: w * 0.06 }),
};
/** `ValueFigure`: elipse. */
const VALUE: FigureDef = {
  path: gen(({ x, y, w, h }) => ellipse(x + w / 2, y + h / 2, w / 2, h / 2)),
  inset: (w) => ({ left: w * 0.08, right: w * 0.08 }),
};
/** `WorkPackageFigure`: arco con flecha (rejilla de 8). */
function workPackage(r0: R) {
  const r = fit(r0, 8 / 7), gu = r.w / 8, rad = 2.5 * gu;
  const cx = r.x + gu / 2 + rad, cy = r.y + gu / 2 + rad;
  return { gu, rad, cx, cy };
}
const WORK_PACKAGE: FigureDef = {
  path: gen((r0) => { const { gu, rad, cx, cy } = workPackage(r0); return arc(cx, cy, rad, rad, -25, 295) + L(cx + 3 * gu, cy + rad); }),
  mode: 'stroke',
  solid: gen((r0) => { const { gu, rad, cx, cy } = workPackage(r0), px = cx + 3 * gu, py = cy + rad; return poly([[px, py], [px, py - 1.5 * gu], [px + 2 * gu, py], [px, py + 1.5 * gu]]); }),
  strokeWidth: (w, h) => Math.max(1, Math.floor(fit({ x: 0, y: 0, w, h }, 8 / 7).w / 8)),
};
/** `PlateauFigure`: tres barras gruesas escalonadas. */
const PLATEAU: FigureDef = {
  path: gen((r0) => {
    const r = fit(r0, 5 / 3.5), s = Math.min(r.w, r.h), x = r.x + (r.w - s) / 2, y = r.y + (r.h - s) / 2;
    return `${M(x, y + (3 * s) / 4)}${L(x + s - (2 * s) / 6, y + (3 * s) / 4)}${M(x + s / 6, y + s / 2)}${L(x + s - s / 6, y + s / 2)}${M(x + (2 * s) / 6, y + s / 4)}${L(x + s, y + s / 4)}`;
  }),
  mode: 'stroke',
  strokeWidth: (w, h) => { const r = fit({ x: 0, y: 0, w, h }, 5 / 3.5); return Math.max(7, Math.sqrt(r.w * r.h) / 16); },
};
/** `GapFigure`: círculo cruzado por dos líneas. */
function gap(r0: R) {
  const r = fit(shrink(r0, 0.5), 5 / 3);
  const wf = (3 * r.w) / 10;
  const cr = r.h < r.w ? Math.min(r.h / 2, wf) : wf;
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, cr };
}
const GAP: FigureDef = {
  path: gen((r0) => { const { cx, cy, cr } = gap(r0); return circle(cx, cy, cr); }),
  lines: gen((r0) => { const { cx, cy, cr } = gap(r0), x1 = cx - 1.5 * cr, x2 = cx + 1.5 * cr; return `${M(x1, cy - cr / 4)}${L(x2, cy - cr / 4)}${M(x1, cy + cr / 4)}${L(x2, cy + cr / 4)}`; }),
};

// ---------------------------------------------------------------- Iconos (16×16)
const I = {
  actor: circle(8, 3, 2.5) + 'M8,5.5V11M8,11L4.5,15.5M8,11L11.5,15.5M4.5,8.5H11.5',
  role: 'M2.5,4A2.5,4 0 0 0 2.5,12H12M2.5,4H12' + ellipse(12.5, 8, 2.5, 4),
  collaboration: circle(6, 8, 5) + circle(10, 8, 5),
  interface: 'M0,8H6.5' + circle(11, 8, 4.5),
  process: 'M1,6H9V3L15,8L9,13V10H1Z',
  function: 'M2,15V6L8,1L14,6V15L8,9Z',
  interaction: 'M6.5,2A5,6 0 0 0 6.5,14ZM9.5,14A5,6 0 0 0 9.5,2Z',
  event: 'M0,3.5H12M0,12.5H12M0,12.5A4,4.5 0 0 0 0,3.5M12,12.5A4,4.5 0 0 0 12,3.5',
  service: 'M4,3.5H12a4,4.5 0 0 1 0,9H4a4,4.5 0 0 1 0,-9Z',
  object: 'M1.5,3H14.5V13H1.5ZM1.5,6H14.5',
  contract: 'M1.5,3H14.5V13H1.5ZM1.5,6H14.5M1.5,10H14.5',
  product: 'M1.5,3H14.5V13H1.5ZM1.5,6H7.5V3',
  deliverable: 'M1.5,3.5V10.5Q4.5,14 9,11.5Q11.5,9 14.5,11.5V3.5Z',
  representation: 'M1.5,3.5V10.5Q4.5,14 9,11.5Q11.5,9 14.5,11.5V3.5ZM1.5,6.5H14.5',
  component: 'M4.5,14.5V10.5M4.5,8.5V6.5M4.5,3.5V1.5H14.5V14.5H4M1.5,3.5h6v2.5h-6ZM1.5,8.5h6v2.5h-6Z',
  node: 'M1,4H12V15H1ZM1,4L4,1H15V12L12,15M12,4L15,1',
  device: 'M3.5,2H11.5a1.5,1.5 0 0 1 1.5,1.5V8.5a1.5,1.5 0 0 1 -1.5,1.5H3.5a1.5,1.5 0 0 1 -1.5,-1.5V3.5a1.5,1.5 0 0 1 1.5,-1.5ZM1,14L4,10H11L14,14Z',
  systemSoftware: circle(7, 8.5, 5.5) + 'M11.75,11.26A5.5,5.5 0 1 0 4.24,3.75',
  artifact: 'M2,0.5H9L14,5.5V15.5H2ZM9,0.5V5.5H14',
  path: 'M3,8H5M7,8H9M11,8H13M4,3L0,8L4,13M12,3L16,8L12,13',
  commNetwork: circle(3, 11, 2.5) + circle(5, 3, 2.5) + circle(13, 3, 2.5) + circle(11, 11, 2.5) + 'M3.5,8.5L4.5,5.5M11.5,8.5L12.5,5.5M5.5,11H8.5M7.5,3H10.5',
  equipment: '',
  facility: 'M0.5,14H15.5V8L11.5,11V8L7.5,11V8L3.5,11V2H0.5Z',
  distribution: 'M1.5,6H14.5M1.5,10H14.5M4,3L0,8L4,13M12,3L16,8L12,13',
  material: 'M12,1H4L0,8L3,15H12L16,8ZM6,3L2.7,8.5M4.3,12.5H11M13,8.5L10,3',
  resource: 'M1.5,3H12.5a1.5,1.5 0 0 1 1.5,1.5V11.5a1.5,1.5 0 0 1 -1.5,1.5H1.5A1.5,1.5 0 0 1 0,11.5V4.5A1.5,1.5 0 0 1 1.5,3ZM14,6H16V10H14ZM3,5V11M6,5V11M9,5V11',
  capability: 'M10,2h4v4h-4ZM6,6h4v4h-4ZM10,6h4v4h-4ZM2,10h4v4h-4ZM6,10h4v4h-4ZM10,10h4v4h-4Z',
  valueStream: 'M0.5,3H10.5L15.5,8L10.5,13H0.5L5.5,8Z',
  courseOfAction: circle(10.28, 4.88, 4.68) + circle(10.28, 4.88, 2.88) + circle(10.28, 4.88, 1.08) + 'M3.8,8.84A3.6,3.6 0 0 0 0.26,11.81',
  stakeholder: 'M4.5,4.5A4,3.5 0 0 0 4.5,11.5H11.5M4,4.5H11.5' + circle(12, 8, 3.5),
  driver: circle(8, 8, 6.5) + circle(8, 8, 1.5) + 'M0,8H16M8,0V16M2,2L14,14M2,14L14,2',
  assessment: circle(9, 6, 4) + 'M7,9L2,14',
  goal: circle(8, 8, 6.5) + circle(8, 8, 4) + circle(8, 8, 1.5),
  outcome: circle(6, 9.6, 5.2) + circle(6, 9.6, 3.2) + circle(6, 9.6, 1.2) + 'M5.6,10L13.2,2.4M11.2,4.4L12,0.4M11.2,4.4L15.2,3.6',
  principle: 'M4,1H12a2,2 0 0 1 2,2V13a2,2 0 0 1 -2,2H4a2,2 0 0 1 -2,-2V3a2,2 0 0 1 2,-2ZM7.5,3V10M8.5,3V10M7.5,11.5V13.5M8.5,11.5V13.5',
  requirement: 'M4,3.5H16L12,12.5H0Z',
  constraint: 'M4,3.5H16L12,12.5H0ZM8,3.5L4,12.5',
  meaning: 'M7,2.9A4,3 0 0 0 1.5,6.95M11.15,7.35A4,3 0 0 0 6.06,2.88M6.26,9.64A3,2.5 0 0 1 1.46,6.68M10.98,7.13A3,3 0 0 1 6.11,9.83',
  value: ellipse(8, 8, 7, 4.5),
  workPackage: 'M9.23,8.04A4.5,4.5 0 1 0 5.39,10.98M5,11H11.5',
  plateau: 'M0,11H12M2,8H14M4,5H16',
  gap: circle(8, 8, 6.5) + 'M0,6.5H16M0,9.5H16',
  location: 'M12.7,7.21A5,5 0 1 0 3.3,7.21L8,15.5Z',
  grouping: 'M1.5,3H7.5V6H1.5ZM1.5,6H14.5V13H1.5Z',
  junction: 'M2,2h2v2h-2ZM2,12h2v2h-2ZM14,7h2v2h-2ZM4,4L6,6M10,8H14M4,12L6,10',
};
/** Engranaje del icono de Equipment (`drawIconCog`). */
function cog(cx: number, cy: number, segments: number, r1: number, r2: number, r3: number): string {
  const half = Math.PI / (2 * segments), delta = half / 4, pts: [number, number][] = [];
  const at = (r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    pts.push(at(r2, a - half), at(r3, a - half + delta), at(r3, a + half - delta), at(r2, a + half));
  }
  return poly(pts) + circle(cx, cy, r1);
}
I.equipment = cog(5.5, 10, 8, 2, 4, 5.5) + cog(11.5, 4.5, 6, 1.3, 2.8, 4);

// ---------------------------------------------------------------- Tabla
const motivation = (icon: string, figure1: FigureDef, extra: Partial<Figure> = {}): Figure => ({ icon, figure0: 'custom', base: OCTAGON, figure1, ...extra });

export const FIGURES: Record<string, Figure> = {
  // Estrategia
  Resource: { icon: I.resource, figure0: 'rect', figure1: RESOURCE },
  Capability: { icon: I.capability, figure0: 'rounded', figure1: CAPABILITY },
  ValueStream: { icon: I.valueStream, figure0: 'rounded', figure1: VALUE_STREAM },
  CourseOfAction: { icon: I.courseOfAction, iconSolid: 'M1.71,6.68L6.03,7.4L3.87,11.14Z' + circle(10.28, 4.88, 0.4), figure0: 'rounded', figure1: COURSE_OF_ACTION },
  // Negocio
  BusinessActor: { icon: I.actor, figure0: 'rect', figure1: ACTOR },
  BusinessRole: { icon: I.role, figure0: 'rect', figure1: CYLINDER_H },
  BusinessCollaboration: { icon: I.collaboration, figure0: 'rect', figure1: COLLABORATION },
  BusinessInterface: { icon: I.interface, figure0: 'rect', figure1: INTERFACE },
  BusinessProcess: { icon: I.process, figure0: 'rounded', figure1: PROCESS },
  BusinessFunction: { icon: I.function, figure0: 'rounded', figure1: FUNCTION },
  BusinessInteraction: { icon: I.interaction, figure0: 'rounded', figure1: INTERACTION },
  BusinessEvent: { icon: I.event, figure0: 'rounded', figure1: EVENT },
  BusinessService: { icon: I.service, figure0: 'rounded', figure1: SERVICE },
  BusinessObject: { icon: I.object, figure0: 'rect', figure1: OBJECT },
  Contract: { icon: I.contract, figure0: 'rect', figure1: CONTRACT },
  Representation: { icon: I.representation, figure0: 'rect', figure1: REPRESENTATION },
  Product: { icon: I.product, figure0: 'rect', figure1: PRODUCT },
  // Aplicación
  ApplicationComponent: { icon: I.component, figure0: 'rect', figure1: COMPONENT },
  ApplicationCollaboration: { icon: I.collaboration, figure0: 'rect', figure1: COLLABORATION },
  ApplicationInterface: { icon: I.interface, figure0: 'rect', figure1: INTERFACE },
  ApplicationFunction: { icon: I.function, figure0: 'rounded', figure1: FUNCTION },
  ApplicationInteraction: { icon: I.interaction, figure0: 'rounded', figure1: INTERACTION },
  ApplicationProcess: { icon: I.process, figure0: 'rounded', figure1: PROCESS },
  ApplicationEvent: { icon: I.event, figure0: 'rounded', figure1: EVENT },
  ApplicationService: { icon: I.service, figure0: 'rounded', figure1: SERVICE },
  DataObject: { icon: I.object, figure0: 'rect', figure1: OBJECT },
  // Tecnología
  Node: { icon: I.node, figure0: 'rect', figure1: BOX },
  Device: { icon: I.device, figure0: 'rect', figure1: DEVICE },
  SystemSoftware: { icon: I.systemSoftware, figure0: 'rect', figure1: SYSTEM_SOFTWARE },
  TechnologyCollaboration: { icon: I.collaboration, figure0: 'rect', figure1: COLLABORATION },
  TechnologyInterface: { icon: I.interface, figure0: 'rect', figure1: INTERFACE },
  Path: { icon: I.path, iconStroke: 1.5, figure0: 'rect', figure1: PATH },
  CommunicationNetwork: { icon: I.commNetwork, figure0: 'rect', figure1: COMM_NETWORK },
  TechnologyFunction: { icon: I.function, figure0: 'rounded', figure1: FUNCTION },
  TechnologyProcess: { icon: I.process, figure0: 'rounded', figure1: PROCESS },
  TechnologyInteraction: { icon: I.interaction, figure0: 'rounded', figure1: INTERACTION },
  TechnologyEvent: { icon: I.event, figure0: 'rounded', figure1: EVENT },
  TechnologyService: { icon: I.service, figure0: 'rounded', figure1: SERVICE },
  Artifact: { icon: I.artifact, figure0: 'rect', figure1: ARTIFACT },
  // Físico
  Equipment: { icon: I.equipment, figure0: 'rect', figure1: EQUIPMENT },
  Facility: { icon: I.facility, iconStroke: 1.2, figure0: 'rect', figure1: FACILITY },
  DistributionNetwork: { icon: I.distribution, iconStroke: 1.2, figure0: 'rect', figure1: DISTRIBUTION },
  Material: { icon: I.material, iconStroke: 1.2, figure0: 'rect', figure1: MATERIAL },
  // Motivación (figura 0 = octógono con icono)
  Stakeholder: motivation(I.stakeholder, CYLINDER_H),
  Driver: motivation(I.driver, DRIVER, { iconStroke: 1.2, iconSolid: circle(8, 8, 0.5) }),
  Assessment: motivation(I.assessment, ASSESSMENT),
  Goal: motivation(I.goal, GOAL, { iconStroke: 1.2, iconSolid: circle(8, 8, 0.5) }),
  Outcome: motivation(I.outcome, OUTCOME, { iconStroke: 1.2, iconSolid: circle(6, 9.6, 0.4) }),
  Principle: motivation(I.principle, PRINCIPLE),
  Requirement: motivation(I.requirement, parallelogram(false)),
  Constraint: motivation(I.constraint, parallelogram(true)),
  Meaning: motivation(I.meaning, MEANING),
  Value: motivation(I.value, VALUE),
  // Implementación y migración
  WorkPackage: { icon: I.workPackage, iconSolid: 'M11.5,8L15.5,11L11.5,14Z', figure0: 'rounded', figure1: WORK_PACKAGE },
  Deliverable: { icon: I.deliverable, figure0: 'rect', figure1: DELIVERABLE },
  ImplementationEvent: { icon: I.event, figure0: 'rounded', figure1: EVENT },
  Plateau: { icon: I.plateau, iconStroke: 2, figure0: 'rect', figure1: PLATEAU },
  Gap: { icon: I.gap, figure0: 'rect', figure1: GAP },
  // Otros
  Location: { icon: I.location, figure0: 'rect', figure1: LOCATION },
  Grouping: { icon: I.grouping, figure0: 'custom', base: GROUP_RECT, figure1: GROUP_TAB },
  Junction: { icon: I.junction, iconSolid: circle(8, 8, 3), figure0: 'custom', base: JUNCTION, noIcon: true },
};

// ---------------------------------------------------------------- API
const local = (typeId: string): string => { const i = typeId.indexOf(':'); return i < 0 ? typeId : typeId.slice(i + 1); };

/** Definición de figura de un tipo (id completo o nombre local), o `undefined` si no es ArchiMate. */
export function figureEntry(typeId: string): Figure | undefined { return FIGURES[local(typeId)]; }

/** Icono (path SVG 16×16) del tipo, o `undefined`. */
export function iconOf(typeId: string): string | undefined { return figureEntry(typeId)?.icon; }

/**
 * Figura a pintar: `0` = por defecto de Archi (rectángulo/redondeado/octógono), `1` = alternativa (si no la hay, la de 0).
 * `variant`: `or` = Junction hueca (`junctionType = or`).
 */
export function figureOf(typeId: string, figure: 0 | 1 = 0, variant?: string): FigureDef {
  const f = figureEntry(typeId);
  if (!f) return RECT;
  if (f.base === JUNCTION && variant === 'or') return JUNCTION_OR;
  const base = f.base ?? (f.figure0 === 'rounded' ? ROUNDED : RECT);
  return figure === 1 && f.figure1 ? f.figure1 : base;
}

/** ¿Se muestra el icono? Solo con la figura por defecto (Junction nunca). */
export function showsIcon(typeId: string, figure: number | undefined): boolean {
  const f = figureEntry(typeId);
  return !!f && !f.noIcon && !(figure === 1 && f.figure1);
}

/** Trozo de dibujo listo para volcar a `<path>`: `fill`/`stroke` ya resueltos. */
export interface FigurePart { d: string; fill: string; stroke: string; strokeWidth: number; dash?: string }

/**
 * Descompone una figura en paths con colores resueltos, en el orden de pintado. `strokeWidth` es el grosor
 * base (reglas de estilo); las figuras de líneas gruesas lo sustituyen por el suyo.
 */
export function figureParts(def: FigureDef, w: number, h: number, fill: string, stroke: string, strokeWidth = 1, dash?: string): FigurePart[] {
  const sw = def.strokeWidth ? def.strokeWidth(w, h) : strokeWidth;
  const parts: FigurePart[] = [];
  const d = def.dash?.(w, h) ?? dash;
  parts.push({ d: def.path(w, h), fill: def.mode === 'stroke' ? 'none' : fill, stroke: def.mode === 'fill' ? 'none' : stroke, strokeWidth: sw, dash: d });
  if (def.lines) parts.push({ d: def.lines(w, h), fill: 'none', stroke, strokeWidth: sw });
  if (def.over) parts.push({ d: def.over(w, h), fill, stroke, strokeWidth: sw });
  if (def.solid) parts.push({ d: def.solid(w, h), fill: stroke, stroke: 'none', strokeWidth: 0 });
  return parts;
}

/** Paths del icono (coordenadas 0..16) con el color del trazo. */
export function iconParts(typeId: string, stroke: string): FigurePart[] {
  const f = figureEntry(typeId);
  if (!f) return [];
  const parts: FigurePart[] = [{ d: f.icon, fill: 'none', stroke, strokeWidth: f.iconStroke ?? 1 }];
  if (f.iconSolid) parts.push({ d: f.iconSolid, fill: stroke, stroke: 'none', strokeWidth: 0 });
  return parts;
}

/** Márgenes de la zona de texto de la figura. */
export function textInset(def: FigureDef, w: number, h: number): Required<Inset> {
  const i = def.inset?.(w, h) ?? {};
  return { top: i.top ?? 0, right: i.right ?? 0, bottom: i.bottom ?? 0, left: i.left ?? 0 };
}

// ---------------------------------------------------------------- Cachés para el lienzo
/**
 * Caché acotada: el lienzo pinta muchas veces las mismas figuras (mismo tipo, tamaño y colores), y cada `figureParts`
 * recalcula los paths. No cambia ninguna geometría: guarda el resultado de las funciones de arriba. Al llenarse se
 * descarta la entrada más antigua (FIFO: más barato que reordenar en cada acierto y suficiente para este uso).
 */
class Bounded<V> {
  private map = new Map<string, V>();
  private readonly max: number;
  constructor(max: number) { this.max = max; }
  get(key: string, make: () => V): V {
    let v = this.map.get(key);
    if (v === undefined) {
      v = make();
      if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value!);
      this.map.set(key, v);
    }
    return v;
  }
  get size(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
}

const partsCache = new Bounded<FigurePart[]>(2000);
const iconCache = new Bounded<FigurePart[]>(500);

/**
 * `figureParts(figureOf(typeId, figure), …)` con caché por `(tipo, figura, w, h, colores, trazo)`: dos nodos del mismo tipo,
 * tamaño y estilo comparten la misma matriz (no hay que tratarla como mutable).
 */
export function figurePartsCached(typeId: string, figure: number | undefined, w: number, h: number, fill: string, stroke: string, strokeWidth = 1, dash?: string, variant?: string): FigurePart[] {
  const alt = figure === 1 ? 1 : 0;
  return partsCache.get(`${local(typeId)}|${alt}|${w}|${h}|${fill}|${stroke}|${strokeWidth}|${dash ?? ''}|${variant ?? ''}`, () => figureParts(figureOf(typeId, alt, variant), w, h, fill, stroke, strokeWidth, dash));
}

/** ¿Es una Junction? (círculo pequeño sin icono ni etiqueta dentro). */
export const isJunction = (typeId: string): boolean => local(typeId) === 'Junction';
/** Tamaño de una Junction nueva, como en Archi. */
export const JUNCTION_SIZE = 15;

/** `iconParts` con caché por `(tipo, color)`. */
export function iconPartsCached(typeId: string, stroke: string): FigurePart[] {
  return iconCache.get(`${local(typeId)}|${stroke}`, () => iconParts(typeId, stroke));
}

/** Vacía las cachés de figuras (pruebas). */
export function clearFigureCaches(): void { partsCache.clear(); iconCache.clear(); }

// ---------------------------------------------------------------- Texto dentro de las figuras
/*
 * Ajuste del nombre dentro de la zona útil de un nodo, igual en el lienzo (`ElementNode`, que mide con
 * `canvas.measureText`) y en el SVG exportado (`packages/io/src/svg.ts`, que mide con un lienzo si lo hay y, sin DOM,
 * con `approxTextWidth`): salto de línea por palabras (y dentro de una palabra tras «/», «_», «-» o «.»); si no cabe, la
 * letra baja de medio en medio píxel hasta `MIN_LABEL_FONT`, y si aun así no cabe se recorta con «…». Nunca devuelve
 * líneas más anchas que `width` ni más líneas de las que caben en `height`.
 */
/** Ancho en px de `text` con letra de `fontSize` px. */
export type MeasureText = (text: string, fontSize: number) => number;

/** Letra por defecto de los nodos ArchiMate (Archi usa 9 pt). */
export const ARCHI_FONT_SIZE = 11.5;
/** Letra mínima a la que se reduce un nombre que no cabe; por debajo, se recorta con «…». */
export const MIN_LABEL_FONT = 9;
/** Interlineado de las etiquetas (múltiplo del tamaño de letra). */
export const LABEL_LINE_HEIGHT = 1.25;
/** Línea del nombre del tipo (bajo el nombre, solo si cabe). */
export const TYPE_FONT = 10;
export const TYPE_LINE = 13;
export const ELLIPSIS = '…';

const NARROW = new Set("iljI.,:;'!|`·");
const SEMI = new Set('frt()[]{}/\\-"*');
const WIDE = new Set('mwMW@%');
/**
 * Ancho aproximado sin DOM: em por carácter de una sans-serif (entre Arial y DejaVu Sans, algo por exceso para que lo
 * que cabe aquí quepa también al pintarlo).
 */
export function approxTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    if (ch === ' ') em += 0.32;
    else if (NARROW.has(ch)) em += 0.3;
    else if (SEMI.has(ch)) em += 0.4;
    else if (WIDE.has(ch)) em += 0.92;
    else if (ch !== ch.toLowerCase()) em += 0.7;
    else if (ch >= '0' && ch <= '9') em += 0.62;
    else em += 0.6;
  }
  return em * fontSize;
}

/** Trozos de un párrafo entre los que se puede saltar: palabras y, dentro de ellas, tras «/», «_», «-» o «.». */
export function breakPieces(para: string): { text: string; space: boolean }[] {
  const out: { text: string; space: boolean }[] = [];
  for (const word of para.split(/\s+/).filter(Boolean)) {
    word.split(/(?<=[/_.-])(?=[^/_.-])/).forEach((text, j) => out.push({ text, space: j === 0 && out.length > 0 }));
  }
  return out;
}

/** Salto de línea voraz: respeta los `\n` (un párrafo vacío es una línea en blanco). Una pieza más ancha que `width` queda sola en su línea. */
export function wrapLines(text: string, width: number, fontSize: number, measure: MeasureText = approxTextWidth): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const p of breakPieces(para)) {
      if (!cur) { cur = p.text; continue; }
      const next = cur + (p.space ? ' ' : '') + p.text;
      if (measure(next, fontSize) <= width) cur = next; else { out.push(cur); cur = p.text; }
    }
    out.push(cur);
  }
  return out;
}

/** `line` recortada por el final hasta que, con «…», mida como mucho `width` (con `force`, lleva «…» aunque quepa entera). */
export function ellipsize(line: string, width: number, fontSize: number, measure: MeasureText = approxTextWidth, force = false): string {
  if (!force && measure(line, fontSize) <= width) return line;
  const chars = Array.from(line.trimEnd());
  while (chars.length && measure(chars.join('').trimEnd() + ELLIPSIS, fontSize) > width) chars.pop();
  const s = chars.join('').trimEnd() + ELLIPSIS;
  return measure(s, fontSize) <= width ? s : '';
}

export interface FitTextOptions {
  /** Ancho y alto disponibles (px). */
  width: number;
  height: number;
  /** Letra de partida (px). */
  fontSize: number;
  /** Letra mínima (por defecto `MIN_LABEL_FONT`); igual a `fontSize`: no se reduce, solo se recorta. */
  minFontSize?: number;
  /** Interlineado, múltiplo de la letra (por defecto `LABEL_LINE_HEIGHT`). */
  lineHeight?: number;
  /** Máximo de líneas (título de contenedor: 2). */
  maxLines?: number;
  measure?: MeasureText;
}
export interface FittedText {
  lines: string[];
  fontSize: number;
  /** Alto de línea (px). */
  lineHeight: number;
  /** Recortado con «…»: el texto completo va en el `title`. */
  truncated: boolean;
}

const half = (v: number) => Math.round(v * 2) / 2;

/** Ajusta `text` a `width`×`height`: salto por palabras, letra más pequeña (hasta `minFontSize`) y por último «…». */
export function fitText(text: string, o: FitTextOptions): FittedText {
  const measure = o.measure ?? approxTextWidth;
  const lhf = o.lineHeight ?? LABEL_LINE_HEIGHT;
  const min = Math.min(o.fontSize, o.minFontSize ?? MIN_LABEL_FONT);
  const width = Math.max(0, o.width), height = Math.max(0, o.height);
  if (!text.trim()) return { lines: [], fontSize: o.fontSize, lineHeight: o.fontSize * lhf, truncated: false };
  for (let fs = o.fontSize; ; fs = Math.max(min, half(fs - 0.5))) {
    const lh = fs * lhf;
    const lines = wrapLines(text, width, fs, measure);
    const room = Math.min(o.maxLines ?? Infinity, Math.floor((height + 0.01) / lh));
    if (lines.length <= room && lines.every(l => measure(l, fs) <= width)) return { lines, fontSize: fs, lineHeight: lh, truncated: false };
    if (fs <= min) {
      const shown = lines.slice(0, Math.max(0, room));
      const cut = lines.length > shown.length;
      const out = shown.map((l, i) => ellipsize(l, width, fs, measure, cut && i === shown.length - 1));
      // Sin sitio ni para «…»: nada (mejor que pintar fuera del nodo).
      return { lines: out.some(Boolean) ? out : [], fontSize: fs, lineHeight: lh, truncated: true };
    }
  }
}

export interface LabelLayoutOptions extends FitTextOptions {
  /** Nombre del tipo: una línea de `TYPE_FONT` px bajo el nombre, solo si cabe entera. */
  typeName?: string;
  /** Alto reservado sobre el nombre (icono de texto del tipo). */
  iconHeight?: number;
  /**
   * Alto extra que puede usar la línea del tipo (el margen vertical del nodo): la letra pequeña del tipo cabe en el
   * margen sin salirse de la caja (el bloque se centra y reparte el exceso arriba y abajo).
   */
  typeSlack?: number;
}
export interface LabelLayout extends FittedText {
  /** Se pinta el icono de texto (se quita si sin él el nombre cabe con más letra). */
  showIcon: boolean;
  /** Se pinta la línea del tipo. */
  showType: boolean;
  /** Alto del bloque (icono, nombre y tipo, con 1 px entre ellos). */
  height: number;
}

/**
 * Bloque de texto de un nodo: icono (alto fijo), nombre ajustado con `fitText` y, si cabe, el nombre del tipo. El nombre
 * manda: si con el icono hay que reducir o recortar el nombre y sin él no tanto, el icono no se pinta.
 */
export function layoutLabel(text: string, o: LabelLayoutOptions): LabelLayout {
  const measure = o.measure ?? approxTextWidth;
  let iconH = o.iconHeight ?? 0;
  let fit = fitText(text, { ...o, height: o.height - (iconH ? iconH + 1 : 0) });
  if (iconH && (fit.truncated || fit.fontSize < o.fontSize)) {
    const bare = fitText(text, o);
    if ((fit.truncated && !bare.truncated) || bare.fontSize > fit.fontSize) { fit = bare; iconH = 0; }
  }
  const used = (iconH ? iconH + 1 : 0) + fit.lines.length * fit.lineHeight;
  const showType = !!o.typeName && !fit.truncated && used + (used ? 1 : 0) + TYPE_LINE <= o.height + (o.typeSlack ?? 0) + 0.01 && measure(o.typeName, TYPE_FONT) <= o.width;
  return { ...fit, showIcon: iconH > 0, showType, height: used + (showType ? (used ? 1 : 0) + TYPE_LINE : 0) };
}

// ---------------------------------------------------------------- Nota (`core:note`) con el aspecto de Archi
/** Letra e interlineado del texto de las notas (px). */
export const NOTE_FONT = 11;
export const NOTE_LINE = 14;
/** Margen del texto de la nota, borde incluido (px): arriba a la izquierda, como Archi. */
export const NOTE_PAD = { x: 8, y: 6 } as const;
/** Lado de la esquina doblada de la nota (Archi: 12 px; menos en notas muy pequeñas). */
export const noteFoldSize = (w: number, h: number): number => Math.max(0, Math.min(12, w / 3, h / 3));

/**
 * Nota de Archi (`NoteFigure`): rectángulo con la esquina inferior derecha cortada (`body`) y el triángulo de la parte
 * doblada (`fold`), a medio píxel del borde para un trazo de 1. Coordenadas del nodo (0,0)-(w,h).
 */
export function notePath(w: number, h: number): { body: string; fold: string } {
  const c = noteFoldSize(w, h), x1 = Math.max(0.5, w - 0.5), y1 = Math.max(0.5, h - 0.5);
  return {
    body: `${M(0.5, 0.5)}${L(x1, 0.5)}${L(x1, y1 - c)}${L(x1 - c, y1)}${L(0.5, y1)}Z`,
    fold: `${M(x1 - c, y1)}${L(x1 - c, y1 - c)}${L(x1, y1 - c)}Z`,
  };
}
