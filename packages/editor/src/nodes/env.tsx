import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Command, NotationRegistry } from '@all-draw/core';

/**
 * Lo que los nodos necesitan del editor y apenas cambia. Los nodos no leen `useEditor()`: su valor cambia con cada
 * selección y haría pasar por todos los nodos de la vista (el `memo` no corta los cambios de contexto). Lo que sí
 * cambia por nodo (edición en línea, estilo resuelto, elemento…) llega en `data`, calculado una vez en `Canvas`.
 */
export interface NodeEnv {
  registry: NotationRegistry;
  readOnly: boolean;
  dark: boolean;
  /**
   * Zoom bajo (`LOW_DETAIL_ZOOM`): los nodos omiten lo que en pantalla mediría unos pocos píxeles (icono de Archi,
   * nombre del tipo). Cambia solo al cruzar el umbral, no en cada paso del zoom.
   */
  lowDetail: boolean;
  run(cmd: Command): void;
  setRenaming(id: string | null): void;
}

export const NodeEnvContext = createContext<NodeEnv | null>(null);

export function useNodeEnv(): NodeEnv {
  const env = useContext(NodeEnvContext);
  if (!env) throw new Error('Los nodos del lienzo necesitan <NodeEnvContext.Provider> (Canvas)');
  return env;
}

/** Por debajo de este zoom el nodo se pinta sin detalles ilegibles (icono de 16 px < 5 px, tipo de 10 px < 3 px). */
export const LOW_DETAIL_ZOOM = 0.3;

/**
 * Marcas de la simulación por nodo de vista (`active`, `waiting`, `blocked`, `visited`, `within`): el nodo añade la
 * clase `ad-sim--<marca>`. Fuera de una simulación el contexto es `NO_SIM_MARKS` (suscripción vacía, sin marcas): no
 * cuesta nada. Con simulación, cada nodo se suscribe y solo se vuelve a pintar el que cambia de marca.
 */
export interface SimMarks {
  subscribe(cb: () => void): () => void;
  get(nodeId: string): string | undefined;
}
export interface SimMarksController extends SimMarks {
  /** Sustituye todas las marcas. */
  set(marks: Record<string, string>): void;
  clear(): void;
}
const noop = () => () => {};
export const NO_SIM_MARKS: SimMarks = { subscribe: noop, get: () => undefined };
export const SimMarksContext = createContext<SimMarks>(NO_SIM_MARKS);

export function createSimMarks(): SimMarksController {
  let marks: Record<string, string> = {};
  const subs = new Set<() => void>();
  const emit = () => { for (const f of subs) f(); };
  return {
    subscribe(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    get: id => marks[id],
    set(next) { marks = next; emit(); },
    clear() { if (Object.keys(marks).length) { marks = {}; emit(); } },
  };
}

/** Marca de simulación de un nodo (o `undefined`). */
export function useSimMark(nodeId: string): string | undefined {
  const m = useContext(SimMarksContext);
  return useSyncExternalStore(m.subscribe, () => m.get(nodeId), () => undefined);
}
