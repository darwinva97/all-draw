import { createContext, useContext } from 'react';
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
