import { t as translate } from '@all-draw/i18n';
import { MemoryStore, execute, type NotationRegistry } from '@all-draw/core';
import type { AnyImport } from '@all-draw/io';

/**
 * Texto de un error de importar/exportar en el idioma activo: los `ImportError` de `@all-draw/io` traen `key` (texto
 * español con `{var}`) y `vars`; el resto ya llega traducido por el traductor inyectado en io (`setIoTranslator`).
 */
export function ioErrorText(e: unknown): string {
  const x = e as { key?: unknown; vars?: Record<string, string | number>; message?: unknown } | null;
  if (x && typeof x.key === 'string') return translate(x.key, x.vars);
  return x && typeof x.message === 'string' ? x.message : String(e);
}

/** Extensiones que aceptan los selectores de fichero de importar (Visio y draw.io incluidos). */
export const IMPORT_FILE_ACCEPT = '.drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml,.drawio,.vsdx,.svg,.txt';

/**
 * Importar un fichero elegido por el usuario: se lee como bytes (así entra también Visio, que es un ZIP) y pasa por
 * `importAnyBinary`. Las vistas que llegan sin posiciones (DSL sin `at`) se colocan con el layout automático; io y
 * el layout se cargan aquí, bajo demanda, para no engordar el paquete inicial.
 */
export async function importFile(f: File, reg?: NotationRegistry): Promise<AnyImport> {
  const io = await import('@all-draw/io');
  const r = await io.importAnyBinary(new Uint8Array(await f.arrayBuffer()), f.name);
  if (r.layoutViews?.length) {
    try {
      const { layoutView, autoLayoutDefaults } = await import('@all-draw/layout');
      const store = new MemoryStore(r.workspace);
      for (const id of r.layoutViews) {
        const v = store.get('views', id);
        if (v) execute(store, await layoutView(store, reg, id, autoLayoutDefaults(v.notationId)));
      }
      r.workspace = store.snapshot();
    } catch { /* sin layout: se queda la rejilla provisional de io */ }
  }
  return r;
}
