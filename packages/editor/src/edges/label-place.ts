/**
 * Dónde va la etiqueta de una arista: en el punto medio **del recorrido** (no entre los dos extremos, que en una arista
 * con codos puede caer dentro de un nodo) y, si ahí tapa un nodo u otra etiqueta, en el primer punto del recorrido que
 * quede libre (40 %, 60 %, 30 %…). Sin hueco libre, el que menos tape.
 */
export interface Pt { x: number; y: number }
/** Punto del recorrido con su dirección (vector unitario), para poder apartar la etiqueta a un lado de la línea. */
export interface Stop extends Pt { dx?: number; dy?: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Fracciones del recorrido que se prueban, en orden de preferencia. */
export const LABEL_STOPS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.14, 0.86] as const;

/** Tamaño aproximado de la etiqueta (11 px, relleno 6 px, borde): basta para decidir si tapa algo. */
export function labelSize(text: string): { w: number; h: number } {
  return { w: Math.ceil(text.length * 5.8) + 16, h: 18 };
}

/** Separación mínima entre dos etiquetas. */
export const LABEL_GAP = 10;

export const rectAround = (p: Pt, s: { w: number; h: number }): Rect => ({ x: p.x - s.w / 2, y: p.y - s.h / 2, w: s.w, h: s.h });

export function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * `points`: los puntos del recorrido en `LABEL_STOPS` (mismo orden). `nodes`: cajas de los nodos que no se deben tapar
 * (sin contenedores: una etiqueta dentro de una pool no la "tapa"). `labels`: etiquetas ya colocadas.
 * Si ningún punto del recorrido queda libre (arista corta entre dos nodos), se prueba a apartarla a un lado de la línea
 * cerca del centro, junto a ella.
 */
export function placeLabel(points: Stop[], size: { w: number; h: number }, nodes: Rect[], labels: Rect[] = []): Pt {
  const side: Pt[] = [];
  for (const p of points.slice(0, 3)) {
    if (p.dx === undefined || p.dy === undefined) continue;
    // Normal a la línea; la distancia mínima deja la etiqueta justo al lado (media altura o media anchura más un margen).
    const nx = -p.dy, ny = p.dx;
    const base = Math.abs(nx) * size.w / 2 + Math.abs(ny) * size.h / 2 + 4;
    for (const d of [0, 10, 20, 32]) for (const sgn of [-1, 1]) side.push({ x: p.x + nx * (base + d) * sgn, y: p.y + ny * (base + d) * sgn });
  }
  let best: Pt = points[0]!, bestScore = Infinity;
  for (const p of [...points, ...side]) {
    const r = rectAround(p, size);
    let score = 0;
    for (const n of nodes) score += overlap(r, n);
    // Tapar otra etiqueta (o quedar pegada a ella, que se leen como una sola) es peor que rozar un nodo.
    const near = { x: r.x - LABEL_GAP, y: r.y - LABEL_GAP, w: r.w + LABEL_GAP * 2, h: r.h + LABEL_GAP * 2 };
    for (const l of labels) score += overlap(near, l) * 2;
    if (score === 0) return { x: p.x, y: p.y };
    if (score < bestScore) { bestScore = score; best = { x: p.x, y: p.y }; }
  }
  return best;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let probe: SVGPathElement | null = null;
/** Puntos del trazado `d` en las fracciones `LABEL_STOPS` de su longitud, con su dirección (un `<path>` oculto y reutilizado). */
export function pathStops(d: string): Stop[] | null {
  if (typeof document === 'undefined') return null;
  try {
    if (!probe || !probe.isConnected) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none');
      probe = document.createElementNS(SVG_NS, 'path');
      svg.appendChild(probe);
      document.body.appendChild(svg);
    }
    probe.setAttribute('d', d);
    const len = probe.getTotalLength();
    if (!Number.isFinite(len) || len <= 0) return null;
    return LABEL_STOPS.map(t => {
      const p = probe!.getPointAtLength(len * t);
      const a = probe!.getPointAtLength(Math.max(0, len * t - 2)), b = probe!.getPointAtLength(Math.min(len, len * t + 2));
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: p.x, y: p.y, dx: (b.x - a.x) / l, dy: (b.y - a.y) / l };
    });
  } catch { return null; }
}
