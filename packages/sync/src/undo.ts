/**
 * Historial de deshacer sobre `Y.UndoManager`: misma forma pública que `History` de core, pero el
 * inverso lo calcula Yjs (funciona también con cambios locales intercalados con remotos).
 */
import * as Y from 'yjs';
import { COLLECTIONS, execute, type Command } from '@all-draw/core';
import type { YjsStore } from './ydoc';

export class YjsHistory {
  readonly manager: Y.UndoManager;
  constructor(readonly store: YjsStore) {
    this.manager = new Y.UndoManager([...COLLECTIONS.map(c => store.maps[c]), store.metaMap], {
      trackedOrigins: new Set(['local']),
      captureTimeout: 0, // cada transacción es un paso
      doc: store.doc,
    });
  }
  /** Ejecuta el comando con origen 'local'; el inverso lo guarda el UndoManager, no nosotros. */
  run(cmd: Command): void { execute(this.store, cmd, 'local'); }
  undo(): boolean { return this.manager.undo() !== null; }
  redo(): boolean { return this.manager.redo() !== null; }
  get canUndo() { return this.manager.canUndo(); }
  get canRedo() { return this.manager.canRedo(); }
  clear() { this.manager.clear(); }
  destroy() { this.manager.destroy(); }
}
