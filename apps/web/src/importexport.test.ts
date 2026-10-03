/**
 * QA 2026-10-03, importar y exportar desde el editor: fallos 5 (importar se puede deshacer), 38 (nombres de fichero con
 * acentos), 57 (se abre la primera vista) y 64 (plantillas y demo sin avisos del validador).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryStore, History, loadInto, validate, DEFAULT_VALIDATORS, traceCoverage } from '@all-draw/core';
import { geometryLint } from '@all-draw/layout';
import { BPMNLINT_VALIDATORS, importAny } from '@all-draw/io';
import { setLang, tIn } from '@all-draw/i18n';
import { safeFileName, replaceWorkspaceCommand, firstViewOf } from './ImportExport';
import { TEMPLATES } from './templates';
import { demoWorkspace } from './demo';
import { createRegistry } from './registry';

afterEach(() => setLang('es'));

describe('fallo 38: nombres de fichero', () => {
  it('conservan acentos, ñ, espacios y emojis; solo cambian lo que no admite el sistema de ficheros', () => {
    expect(safeFileName('Visión por capas — préstamo', 'x')).toBe('Visión por capas — préstamo');
    expect(safeFileName('Máquina de estados', 'x')).toBe('Máquina de estados');
    expect(safeFileName('Banca Ñandú 🚀', 'x')).toBe('Banca Ñandú 🚀');
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j', 'x')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(safeFileName('  .oculto. ', 'x')).toBe('oculto');
    expect(safeFileName('', 'diagrama')).toBe('diagrama');
    expect(safeFileName('///', 'diagrama')).toBe('_');
  });
});

describe('fallo 5: importar sustituye el espacio con un comando que se puede deshacer', () => {
  it('Deshacer devuelve el espacio anterior entero (y Rehacer, el importado)', async () => {
    setLang('es');
    const store = new MemoryStore(); loadInto(store, demoWorkspace());
    const history = new History(store);
    const before = store.snapshot();
    const { workspace } = await importAny('flowchart TD\n  A[Pedir] --> B{¿Hay stock?}', 'pedido.mmd');
    history.run(replaceWorkspaceCommand(store, workspace));
    expect(store.meta().name).toBe('pedido');
    expect(store.list('elements').map(e => e.name).sort()).toEqual(['Pedir', '¿Hay stock?']);
    expect(store.list('views')).toHaveLength(1);
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(store.snapshot()).toEqual(before);   // mismo contenido (el orden de las claves puede cambiar)
    history.redo();
    expect(store.list('elements')).toHaveLength(2);
  });

  it('fallo 57: la vista que se abre es la actual del fichero, o la primera con nodos', async () => {
    const { workspace } = await importAny('flowchart TD\n  A --> B', 'x.mmd');
    expect(firstViewOf(workspace)).toBe(workspace.meta.currentViewId);
    const ws = structuredClone(workspace);
    ws.meta.currentViewId = null;
    ws.views['vacia'] = { ...Object.values(ws.views)[0]!, id: 'vacia', name: 'Vacía' };
    expect(firstViewOf(ws)).toBe(Object.keys(workspace.views)[0]);
  });
});

/** Fallo 64: las plantillas y la demo nacen sin avisos del validador (los símbolos sin nombre ya no son falsos positivos). */
describe('fallo 64: plantillas y demo sin avisos del validador', () => {
  for (const lang of ['es', 'en'] as const) {
    for (const tpl of TEMPLATES) {
      it(`${tpl.id} (${lang})`, () => {
        setLang(lang);
        const reg = createRegistry(lang);
        const store = new MemoryStore(); loadInto(store, tpl.build((k, v) => tIn(lang, k, v)));
        reg.syncLibraryTypes(store.list('libraries'));
        const diags = validate(store, reg, [...DEFAULT_VALIDATORS, geometryLint, ...BPMNLINT_VALIDATORS, traceCoverage]);
        const problems = diags.filter(d => d.severity !== 'info').map(d => `${d.code}: ${d.message}`);
        expect(problems).toEqual([]);
      });
    }
  }
});
