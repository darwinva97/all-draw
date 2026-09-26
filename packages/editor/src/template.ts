/**
 * Plantillas (componentes de librería) y tipos: propagar cambios de una plantilla a sus
 * instancias y reasignar el tipo de los elementos al borrar un tipo. Funciones puras que
 * devuelven comandos; el llamador los envuelve en un `batch`.
 */
import type { Command, Element, Store } from '@all-draw/core';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface PropagationPlan {
  commands: Command[];
  /** Instancias que reciben algún cambio. */
  touched: string[];
  /** Instancias que existen pero no cambian (todo lo modificado en la plantilla estaba sobreescrito). */
  skipped: string[];
}

/**
 * Cambios de `prev` → `next` (dos estados de la misma plantilla) aplicados a sus instancias.
 * Regla por campo: si la instancia tenía el mismo valor que la plantilla antigua, se actualiza;
 * si lo había cambiado, se respeta. Igual para el nombre y la documentación.
 */
export function propagateTemplate(store: Store, prev: Element, next: Element): PropagationPlan {
  const commands: Command[] = [];
  const touched: string[] = [];
  const skipped: string[] = [];
  if (prev.id !== next.id) return { commands, touched, skipped };
  const keys = new Set([...Object.keys(prev.fields), ...Object.keys(next.fields)]);
  const changedKeys = [...keys].filter(k => !same(prev.fields[k], next.fields[k]));
  const nameChanged = prev.name !== next.name;
  const docChanged = prev.doc !== next.doc;
  if (changedKeys.length === 0 && !nameChanged && !docChanged) return { commands, touched, skipped };

  for (const inst of store.list('elements')) {
    if (inst.template || inst.templateId !== next.id) continue;
    const patch: Record<string, unknown> = {};
    const fields: Record<string, unknown> = {};
    for (const k of changedKeys) if (same(inst.fields[k], prev.fields[k])) fields[k] = next.fields[k];
    if (Object.keys(fields).length) patch.fields = fields;
    if (nameChanged && inst.name === prev.name) patch.name = next.name;
    if (docChanged && inst.doc === prev.doc) patch.doc = next.doc;
    if (Object.keys(patch).length === 0) { skipped.push(inst.id); continue; }
    commands.push({ type: 'patch', collection: 'elements', id: inst.id, patch });
    touched.push(inst.id);
  }
  return { commands, touched, skipped };
}

/** Tipo al que se convierten los elementos si no se elige otro al borrar su tipo. */
export const FALLBACK_TYPE = 'freeform:box';

/**
 * Reasigna el tipo de todos los elementos (plantillas incluidas) que usan `fromTypeId`.
 * Si el destino no es un tipo de librería (`lib:…`), el elemento deja de pertenecer a la librería.
 */
export function retypeElements(store: Store, fromTypeId: string, toTypeId: string = FALLBACK_TYPE): Command[] {
  if (fromTypeId === toTypeId) return [];
  const toLib = libraryOfTypeId(toTypeId);
  return store.list('elements').filter(e => e.typeId === fromTypeId).map(e => {
    const patch: Record<string, unknown> = { typeId: toTypeId };
    if (toLib !== undefined && toLib !== e.libraryId) patch.libraryId = toLib || undefined;
    return { type: 'patch', collection: 'elements', id: e.id, patch } as Command;
  });
}

/** `lib:<libId>:<slug>` → `<libId>`; tipo de pack → `''`; sin prefijo reconocible → undefined. */
export function libraryOfTypeId(typeId: string): string | undefined {
  const m = /^lib:([^:]+):/.exec(typeId);
  if (m) return m[1];
  return typeId.includes(':') ? '' : undefined;
}
