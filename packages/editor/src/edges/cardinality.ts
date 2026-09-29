/**
 * Cardinalidades en los extremos de una arista: cabezas de pata de gallo (Information Engineering)
 * y rótulos de multiplicidad/rol junto a cada extremo.
 *
 * - Campo `sourceCard`/`targetCard` de tipo `select` (pack ER): su valor se traduce a una cabeza
 *   (`cardToHead`) que sustituye la del tipo en ese extremo; no se pinta como texto.
 * - Campo de texto (UML: "0..*", "1") o sin definición en el tipo: se pinta como rótulo pequeño.
 * - `sourceRole`/`targetRole`: rótulo al otro lado de la línea.
 *
 * Funciones puras; `packages/io/src/svg.ts` replica `cardToHead` y `endLabel` para que el SVG
 * exportado coincida con el lienzo. Si cambias algo aquí, cámbialo allí también.
 */
import type { ArrowHead, FieldDef } from '@all-draw/core';

export interface Pt { x: number; y: number }
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Claves de extremo: no entran en el rótulo central de la arista. */
export const END_KEYS = new Set(['sourceCard', 'targetCard', 'sourceRole', 'targetRole']);

const CARD_HEAD: Record<string, ArrowHead> = {
  '1': 'one', 'one': 'one',
  '1..1': 'only-one', '||': 'only-one', 'only-one': 'only-one',
  '0..1': 'zero-or-one', '?': 'zero-or-one', 'zero-or-one': 'zero-or-one',
  '*': 'many', 'many': 'many',
  '1..*': 'one-or-many', '+': 'one-or-many', 'one-or-many': 'one-or-many',
  '0..*': 'zero-or-many', 'zero-or-many': 'zero-or-many',
};

/** "1", "1..1", "0..1", "*", "1..*", "0..*" (también `N`/`M` por `*` y los ids de `ArrowHead`) → cabeza IE. */
export function cardToHead(v: unknown): ArrowHead | undefined {
  if (typeof v !== 'string') return undefined;
  const k = v.trim().toLowerCase().replace(/\s+/g, '').replace(/^(n|m)$/, '*').replace(/\.\.(n|m)$/, '..*');
  return CARD_HEAD[k];
}

export interface CardEnds {
  sourceHead?: ArrowHead; targetHead?: ArrowHead;
  sourceCard?: string; targetCard?: string;
  sourceRole?: string; targetRole?: string;
}

/** Lee los campos de extremo de una relación según las definiciones de su tipo. */
export function cardEnds(fields: Record<string, unknown> | undefined, defs: FieldDef[] | undefined): CardEnds {
  const out: CardEnds = {};
  if (!fields) return out;
  const str = (k: string) => { const v = fields[k]; return typeof v === 'string' && v.trim() ? v.trim() : undefined; };
  for (const end of ['source', 'target'] as const) {
    const key = `${end}Card`, v = str(key);
    if (v) {
      const def = defs?.find(d => d.key === key);
      const head = def?.kind === 'select' ? cardToHead(v) : undefined;
      if (head) out[`${end}Head`] = head; else out[`${end}Card`] = v;
    }
    const role = str(`${end}Role`);
    if (role) out[`${end}Role`] = role;
  }
  return out;
}

const SIDE_VEC: Record<Side, Pt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const unit = (x: number, y: number): Pt => { const l = Math.hypot(x, y); return l < 1e-6 ? { x: 1, y: 0 } : { x: x / l, y: y / l }; };

/**
 * Dirección con la que la arista se aleja del nodo en el extremo `p` (hacia `next`, el primer
 * bendpoint o el otro extremo). Recta y curva con bendpoints siguen la cuerda; ortogonal y curva sin
 * bendpoints salen perpendiculares al lado del nodo.
 */
export function endDirection(p: Pt, side: Side, next: Pt, router: string, hasBends: boolean): Pt {
  if (router === 'straight' || (router === 'bezier' && hasBends)) return unit(next.x - p.x, next.y - p.y);
  if (hasBends) {
    const horizontal = side === 'left' || side === 'right';
    const dx = next.x - p.x, dy = next.y - p.y;
    if (horizontal && dx !== 0) return { x: Math.sign(dx), y: 0 };
    if (!horizontal && dy !== 0) return { x: 0, y: Math.sign(dy) };
  }
  return SIDE_VEC[side];
}

export interface EndLabel { x: number; y: number; anchor: 'start' | 'middle' | 'end' }

/**
 * Posición de un rótulo de extremo, junto al extremo `p` con la arista saliendo en dirección `u`.
 * `side` 1 (multiplicidad) va encima en aristas horizontales y a la derecha en verticales; -1 (rol),
 * al otro lado, para que ambos extremos queden del mismo lado. El texto crece alejándose del nodo.
 */
export function endLabel(p: Pt, u: Pt, side: 1 | -1): EndLabel {
  if (Math.abs(u.x) >= Math.abs(u.y)) {
    // arista horizontal: texto encima/debajo, empieza cerca del nodo y se aleja de él
    return { x: p.x + u.x * 6, y: p.y + u.y * 14 + (side === 1 ? -10 : 11), anchor: u.x >= 0 ? 'start' : 'end' };
  }
  // arista vertical: texto a un lado, a 14 px del nodo
  return { x: p.x + u.x * 14 + (side === 1 ? 7 : -7), y: p.y + u.y * 14, anchor: side === 1 ? 'start' : 'end' };
}
