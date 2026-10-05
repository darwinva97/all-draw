import { describe, it, expect } from 'vitest';
import type { Workspace } from '@all-draw/core';
import { XSTATE_VIEW_ID } from '@all-draw/io';
import { GENERATORS, GENERATOR_TEXTS, WARNING_KEYS, generate, generatorsFor, warningText, type CodegenWarning } from '../src';
import { apiWorkspace, archimateWorkspace, builder, c4Workspace, erCycleWorkspace, erEdgeWorkspace, erWorkspace, statechartEdgeWorkspace, statechartWorkspace, umlEdgeWorkspace, umlWorkspace } from './fixtures';

const FIXTURES: Record<string, () => Workspace> = {
  uml: umlWorkspace, umlEdge: umlEdgeWorkspace, er: erWorkspace, erCycle: erCycleWorkspace, erEdge: erEdgeWorkspace,
  statechart: statechartWorkspace, statechartEdge: statechartEdgeWorkspace,
  api: apiWorkspace, c4: c4Workspace, archimate: archimateWorkspace,
};

/** Todos los avisos de todos los generadores sobre todos los fixtures (con cada vista y sin vista). */
function allWarnings(): CodegenWarning[] {
  const out: CodegenWarning[] = [];
  for (const make of Object.values(FIXTURES)) {
    const ws = make();
    for (const viewId of [undefined, ...Object.keys(ws.views), 'no-existe']) {
      for (const g of GENERATORS) out.push(...g.generate(ws, viewId ? { viewId } : {}).warnings);
    }
  }
  return out;
}

describe('API pública', () => {
  it('GENERATORS: ids únicos en el orden acordado, textos en GENERATOR_TEXTS', () => {
    expect(GENERATORS.map(g => g.id)).toEqual(['uml-typescript', 'uml-java', 'er-postgres', 'er-sqlite', 'statechart-xstate', 'statechart-table', 'openapi', 'structurizr-dsl']);
    for (const g of GENERATORS) {
      expect(GENERATOR_TEXTS).toContain(g.label);
      expect(GENERATOR_TEXTS).toContain(g.description);
    }
    expect(GENERATOR_TEXTS).toHaveLength(GENERATORS.length * 2);
  });

  it('generatorsFor según la notación de la vista o, sin vista, el contenido del espacio', () => {
    const ids = (ws: Workspace, v?: string | null) => generatorsFor(ws, v).map(g => g.id);
    expect(ids(umlWorkspace(), 'v-uml')).toEqual(['uml-typescript', 'uml-java']);
    expect(ids(erWorkspace(), 'v-er')).toEqual(['er-postgres', 'er-sqlite']);
    expect(ids(statechartWorkspace(), XSTATE_VIEW_ID)).toEqual(['statechart-xstate', 'statechart-table']);
    expect(ids(apiWorkspace(), 'v-grid')).toEqual(['openapi']);
    expect(ids(apiWorkspace(), null)).toEqual(['openapi']);
    expect(ids(c4Workspace(), 'v-ctx')).toEqual(['structurizr-dsl']);
    expect(ids(archimateWorkspace(), 'v-am')).toEqual(['structurizr-dsl']);
    expect(ids(umlWorkspace(), 'no-existe')).toEqual([]);
    const mixed = umlWorkspace();
    Object.assign(mixed.elements, erWorkspace().elements);
    expect(ids(mixed)).toEqual(['uml-typescript', 'uml-java', 'er-postgres', 'er-sqlite']);
    expect(ids(builder('vacío').ws)).toEqual([]);
  });

  it('generate() delega en el generador y rechaza ids desconocidos', () => {
    expect(generate('er-sqlite', erWorkspace()).files[0]!.path).toBe('schema.sqlite.sql');
    expect(() => generate('nada' as never, erWorkspace())).toThrow();
  });

  it('todas las claves de aviso emitidas están en WARNING_KEYS y se interpolan por completo', () => {
    const ws = allWarnings();
    expect(ws.length).toBeGreaterThan(20);
    for (const w of ws) {
      expect(WARNING_KEYS).toContain(w.key);
      const placeholders = [...w.key.matchAll(/\{(\w+)\}/g)].map(m => m[1]!).sort();
      expect(Object.keys(w.vars ?? {}).sort(), w.key).toEqual(placeholders);
    }
    expect(new Set(WARNING_KEYS).size).toBe(WARNING_KEYS.length);
  });

  it('salida determinista: dos ejecuciones dan exactamente lo mismo', () => {
    for (const make of Object.values(FIXTURES)) {
      for (const g of GENERATORS) expect(JSON.stringify(g.generate(make(), {}))).toBe(JSON.stringify(g.generate(make(), {})));
    }
  });

  it('warningText interpola las variables', () => {
    expect(warningText({ key: 'La vista {view} no existe', vars: { view: 'v1' } })).toBe('La vista v1 no existe');
    expect(warningText({ key: 'Sin variables' })).toBe('Sin variables');
  });
});
