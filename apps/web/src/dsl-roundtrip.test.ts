/**
 * Ida y vuelta del lenguaje textual con todas las plantillas del inicio: `parseDsl(serializeDsl(ws))` da el mismo
 * espacio (mismos registros con los mismos valores) y volver a escribirlo da exactamente el mismo texto.
 */
import { describe, it, expect } from 'vitest';
import { parseWorkspace } from '@all-draw/core';
import { parseDsl, serializeDsl } from '@all-draw/io';
import { TEMPLATES } from './templates';

const t = (k: string, v?: Record<string, string | number>) => (v ? k.replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? '')) : k);

describe('DSL: ida y vuelta de las plantillas', () => {
  for (const tpl of TEMPLATES) {
    it(tpl.id, () => {
      const ws = parseWorkspace(tpl.build(t));
      const text = serializeDsl(ws);
      const back = parseDsl(text);
      expect(back.diagnostics, text).toEqual([]);
      expect(back.unpositioned).toEqual([]);
      expect(back.workspace).toEqual(ws);
      expect(serializeDsl(back.workspace)).toBe(text);
    });
  }

  it('sin posiciones: mismo modelo, vistas pendientes de layout', () => {
    const ws = parseWorkspace(TEMPLATES.find(x => x.id === 'archimate')!.build(t));
    const back = parseDsl(serializeDsl(ws, { positions: false }));
    expect(back.diagnostics).toEqual([]);
    expect(back.workspace.elements).toEqual(ws.elements);
    expect(back.workspace.relations).toEqual(ws.relations);
    expect(Object.keys(back.workspace.nodes).sort()).toEqual(Object.keys(ws.nodes).sort());
    expect(back.unpositioned).toEqual(Object.keys(ws.views));
  });
});
