/** Tipos comunes a los dos motores (BPMN por tokens y máquinas de estados). Todo es serializable (JSON). */

/**
 * Estado global de una simulación:
 * - `idle`: sin iniciar · `running`: hay trabajo pendiente (tokens listos, temporizadores) · `waiting`: solo puede
 *   avanzar con una acción del usuario (elegir rama, disparar mensaje, enviar evento, cambiar variables)
 * - `completed`: terminó con normalidad · `terminated`: un fin de terminación o el pseudoestado Terminar la cortó
 * - `failed`: error sin capturar · `deadlock`: quedan tokens que nunca podrán avanzar · `loop`: se repite el mismo
 *   estado sin intervención (bucle sin salida).
 */
export type SimStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'terminated' | 'failed' | 'deadlock' | 'loop';

/** Aviso traducible: `key` es el texto en español con `{var}` (convenio de `@all-draw/i18n`). */
export interface SimWarning { key: string; vars?: Record<string, string | number>; element?: string }

/** Clase de entrada del historial (la interfaz la traduce y la pinta). */
export type SimEventKind =
  // comunes
  | 'start' | 'completed' | 'terminated' | 'deadlock' | 'loop' | 'variables' | 'warning'
  // BPMN
  | 'flow' | 'enter' | 'leave' | 'wait' | 'decision' | 'choice' | 'fork' | 'join' | 'timer' | 'message' | 'signal' | 'condition'
  | 'boundary' | 'subprocess-start' | 'subprocess-end' | 'event-subprocess' | 'end' | 'error' | 'escalation' | 'link' | 'condition-error'
  // máquinas de estados
  | 'event' | 'ignored' | 'transition' | 'exit' | 'entry' | 'action' | 'done';

export interface SimEvent {
  /** Orden global. */
  seq: number;
  /** Paso de la simulación en el que ocurrió. */
  step: number;
  /** Tiempo simulado (ms desde el inicio). */
  time: number;
  kind: SimEventKind;
  /** Elemento del modelo (nodo de flujo, estado). */
  element?: string;
  /** Flujo de secuencia / de mensaje o transición. */
  flow?: string;
  token?: number;
  /** Texto libre: nombre de evento, condición, acción, motivo… (no se traduce). */
  detail?: string;
  /** Clave de aviso traducible (con `kind: 'warning'`). */
  warning?: SimWarning;
}

export const isFinished = (s: SimStatus) => s === 'completed' || s === 'terminated' || s === 'failed';
