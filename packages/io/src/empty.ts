/** Espacio vacío con todas las colecciones (sin dependencias: lo usa el lenguaje de texto, que se carga suelto). */
import { SCHEMA_VERSION, type Workspace } from '@all-draw/core';

export function emptyWs(name: string): Workspace {
  return { meta: { schemaVersion: SCHEMA_VERSION, name, description: '' }, libraries: {}, elements: {}, relations: {}, views: {}, nodes: {}, edges: {}, dimensions: {}, people: {}, rules: {}, comments: {} };
}
