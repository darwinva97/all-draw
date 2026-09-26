/**
 * Alinear, distribuir e igualar tamaños. Funciones puras sobre cajas en coordenadas absolutas
 * del lienzo; el llamador convierte de vuelta a coordenadas relativas al padre.
 */
export interface Box { id: string; x: number; y: number; w: number; h: number }
export interface Move { id: string; x: number; y: number }
export interface Size { id: string; w: number; h: number }

export type AlignKind = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

/** Nuevas posiciones absolutas tras alinear (solo las cajas que cambian). */
export function alignBoxes(boxes: Box[], kind: AlignKind): Move[] {
  if (boxes.length < 2) return [];
  const minX = Math.min(...boxes.map(b => b.x)), maxX = Math.max(...boxes.map(b => b.x + b.w));
  const minY = Math.min(...boxes.map(b => b.y)), maxY = Math.max(...boxes.map(b => b.y + b.h));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const out: Move[] = [];
  for (const b of boxes) {
    let x = b.x, y = b.y;
    switch (kind) {
      case 'left': x = minX; break;
      case 'right': x = maxX - b.w; break;
      case 'centerX': x = cx - b.w / 2; break;
      case 'top': y = minY; break;
      case 'bottom': y = maxY - b.h; break;
      case 'centerY': y = cy - b.h / 2; break;
    }
    x = Math.round(x); y = Math.round(y);
    if (x !== b.x || y !== b.y) out.push({ id: b.id, x, y });
  }
  return out;
}

/** Reparte huecos iguales entre cajas consecutivas a lo largo del eje; la primera y la última no se mueven. */
export function distributeBoxes(boxes: Box[], axis: 'x' | 'y'): Move[] {
  if (boxes.length < 3) return [];
  const pos = (b: Box) => (axis === 'x' ? b.x : b.y);
  const size = (b: Box) => (axis === 'x' ? b.w : b.h);
  const sorted = [...boxes].sort((a, b) => (pos(a) + size(a) / 2) - (pos(b) + size(b) / 2));
  const first = sorted[0]!, last = sorted[sorted.length - 1]!;
  const span = (pos(last) + size(last)) - pos(first);
  const total = sorted.reduce((s, b) => s + size(b), 0);
  const gap = (span - total) / (sorted.length - 1);
  const out: Move[] = [];
  let cursor = pos(first) + size(first) + gap;
  for (let i = 1; i < sorted.length - 1; i++) {
    const b = sorted[i]!;
    const v = Math.round(cursor);
    if (v !== pos(b)) out.push({ id: b.id, x: axis === 'x' ? v : b.x, y: axis === 'y' ? v : b.y });
    cursor += size(b) + gap;
  }
  return out;
}

/** Iguala ancho o alto al mayor de la selección (solo las cajas que cambian). */
export function equalizeSize(boxes: Box[], dim: 'w' | 'h'): Size[] {
  if (boxes.length < 2) return [];
  const target = Math.max(...boxes.map(b => b[dim]));
  return boxes.filter(b => b[dim] !== target).map(b => ({ id: b.id, w: dim === 'w' ? target : b.w, h: dim === 'h' ? target : b.h }));
}
