import { describe, it, expect } from 'vitest';
import { ELEMENTS } from '../src/generated';
import { FIGURES, figureOf, iconOf, showsIcon, figureParts, iconParts, textInset, type FigureDef } from '../src/figures';

const local = (id: string) => id.slice(id.indexOf(':') + 1);
const SIZES: [number, number][] = [[120, 55], [40, 40], [200, 120], [12, 8]];

function checkPath(d: string, what: string) {
  expect(d, what).toMatch(/^M/);
  expect(d, what).not.toMatch(/NaN|Infinity|undefined/);
}
function checkDef(def: FigureDef, what: string) {
  for (const [w, h] of SIZES) {
    checkPath(def.path(w, h), `${what} path ${w}×${h}`);
    for (const k of ['lines', 'over', 'solid'] as const) { const g = def[k]; if (g) checkPath(g(w, h), `${what} ${k} ${w}×${h}`); }
    if (def.strokeWidth) expect(def.strokeWidth(w, h), `${what} strokeWidth`).toBeGreaterThan(0);
    const inset = textInset(def, w, h);
    for (const v of Object.values(inset)) { expect(v).toBeGreaterThanOrEqual(0); expect(Number.isFinite(v)).toBe(true); }
  }
}

describe('figuras ArchiMate', () => {
  it('cubre los 61 elementos del pack y nada más', () => {
    const ids = ELEMENTS.map(e => local(e.id));
    expect(ids).toHaveLength(61);
    for (const id of ids) expect(FIGURES[id], id).toBeDefined();
    expect(Object.keys(FIGURES).sort()).toEqual([...ids].sort());
  });

  it('todos los iconos son paths 16×16 no vacíos que empiezan por M', () => {
    for (const [id, f] of Object.entries(FIGURES)) {
      checkPath(f.icon, `${id} icon`);
      if (f.iconSolid) checkPath(f.iconSolid, `${id} iconSolid`);
      const nums = f.icon.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(Math.max(...nums), `${id} icon dentro de 16×16`).toBeLessThanOrEqual(17);
      expect(iconOf(`archimate:${id}`)).toBe(f.icon);
      expect(iconParts(`archimate:${id}`, '#000')[0]?.stroke).toBe('#000');
    }
  });

  it('las figuras 0 y 1 generan paths válidos en varios tamaños', () => {
    for (const [id, f] of Object.entries(FIGURES)) {
      checkDef(figureOf(`archimate:${id}`, 0), `${id} figura 0`);
      checkDef(figureOf(id, 1), `${id} figura 1`);
      if (f.figure0 === 'custom') expect(f.base, `${id} base`).toBeDefined();
      if (f.figure1) expect(figureOf(id, 1)).toBe(f.figure1);
      else expect(figureOf(id, 1)).toBe(figureOf(id, 0));
    }
  });

  it('todos menos Junction tienen figura alternativa y muestran icono solo con la figura 0', () => {
    for (const id of Object.keys(FIGURES)) {
      if (id === 'Junction') { expect(FIGURES[id]!.figure1).toBeUndefined(); expect(showsIcon(id, 0)).toBe(false); continue; }
      expect(FIGURES[id]!.figure1, id).toBeDefined();
      expect(showsIcon(`archimate:${id}`, 0)).toBe(true);
      expect(showsIcon(`archimate:${id}`, undefined)).toBe(true);
      expect(showsIcon(`archimate:${id}`, 1)).toBe(false);
    }
  });

  it('figureParts resuelve colores y grosor', () => {
    const parts = figureParts(figureOf('archimate:Node', 1), 120, 55, '#c9e7b7', '#333', 1);
    expect(parts[0]).toMatchObject({ fill: '#c9e7b7', stroke: '#333', strokeWidth: 1 });
    expect(parts[1]).toMatchObject({ fill: 'none', stroke: '#333' });
    const junction = figureParts(figureOf('archimate:Junction', 0), 15, 15, '#fff', '#000');
    expect(junction.at(-1)).toMatchObject({ fill: '#000', stroke: 'none' });
    const plateau = figureParts(figureOf('archimate:Plateau', 1), 120, 55, '#fff', '#000');
    expect(plateau[0]!.fill).toBe('none');
    expect(plateau[0]!.strokeWidth).toBeGreaterThanOrEqual(7);
    expect(figureParts(figureOf('archimate:Path', 1), 120, 55, '#fff', '#000')[0]!.dash).toBeTruthy();
    expect(figureParts(figureOf('archimate:Grouping', 0), 120, 55, '#fff', '#000')[0]!.dash).toBe('6 3');
    expect(figureOf('bpmn:Task', 1).path(10, 10)).toMatch(/^M/);
  });

  it('las figuras con cabecera reservan margen para el texto', () => {
    expect(textInset(figureOf('archimate:Node', 1), 120, 55).top).toBe(14);
    expect(textInset(figureOf('archimate:Device', 1), 120, 55).bottom).toBeCloseTo(11, 0);
    expect(textInset(figureOf('archimate:BusinessRole', 1), 120, 55).left).toBe(15);
    expect(textInset(figureOf('archimate:BusinessObject', 1), 120, 55).top).toBe(12);
    expect(textInset(figureOf('archimate:ApplicationComponent', 1), 120, 55).left).toBe(18);
  });
});
