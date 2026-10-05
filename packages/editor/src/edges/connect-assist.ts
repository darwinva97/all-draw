/**
 * Ayudas al conectar (sin React): qué se ofrece al soltar una conexión en un hueco vacío («Crear y conectar») y qué
 * dice la etiqueta flotante mientras se arrastra. Reutiliza las reglas de `relation-options.ts`.
 */
import type { ElementType, NotationRegistry } from '@all-draw/core';
import { groupRelationOptions, isBridgeRelation, pruneBridges } from './relation-options';

export interface CreateCandidate {
  typeId: string;
  /** Relación que se crea por defecto desde el origen hacia un elemento nuevo de `typeId`. */
  relationId: string;
  /** Cuántas relaciones admite el par (para indicar que se puede cambiar después). */
  options: number;
}

export interface CreateTargetsOptions {
  /** Tipos de las librerías del espacio (también se ofrecen si la matriz lo permite). */
  libraryTypes?: ElementType[];
  /** Elementos que ya hay de cada tipo en el espacio: los más usados van antes. */
  usage?: ReadonlyMap<string, number>;
  /** Tipos usados hace poco en este navegador (el primero, el más reciente). */
  recent?: readonly string[];
}

/** Formas que no son «contenido» y no se ofrecen como destino de una conexión (pools, carriles, grupos…). */
const NOT_TARGET_SHAPES = new Set(['pool', 'lane', 'group', 'label']);

/**
 * Tipos que pueden ser destino de una relación desde `sourceTypeId` en una vista de `notationId` (y su viewpoint),
 * con la relación por defecto. Orden: los que admiten la relación habitual de la notación; dentro, los recientes,
 * después los más usados en el espacio y, al final, el orden del pack.
 */
export function creatableTargets(reg: NotationRegistry, sourceTypeId: string, notationId: string, viewpointId: string | undefined, o: CreateTargetsOptions = {}): CreateCandidate[] {
  const pack = reg.pack(notationId);
  const def = pack?.defaultRelation;
  const bridgeDefault = !!def && isBridgeRelation(reg, def);
  const types = [
    ...(pack?.elementTypes ?? []).filter(t => reg.inViewpoint(notationId, viewpointId, t.id)),
    ...(o.libraryTypes ?? []),
  ].filter(t => !t.abstract && !NOT_TARGET_SHAPES.has(t.shape ?? ''));
  const seen = new Set<string>();
  const out: (CreateCandidate & { rank: number[] })[] = [];
  types.forEach((t, i) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    const allowed = pruneBridges(reg, sourceTypeId, t.id, reg.allowedRelations(sourceTypeId, t.id), false);
    if (!allowed.length) return;
    const groups = groupRelationOptions(reg, allowed, sourceTypeId, def);
    // Las genéricas (enlace, traza…) solo cuentan si son lo habitual de la notación (rejilla, libre).
    if (!groups.native.length && !(bridgeDefault && allowed.includes(def!))) return;
    const relationId = def && allowed.includes(def) ? def : groups.native[0] ?? groups.bridge[0]!;
    const r = o.recent?.indexOf(t.id) ?? -1;
    // Primero los que admiten la relación habitual de la notación (desde una tarea BPMN, los del flujo de secuencia);
    // dentro, los recientes y los más usados en el espacio.
    out.push({ typeId: t.id, relationId, options: groups.native.length + groups.bridge.length,
      rank: [def && allowed.includes(def) ? 0 : 1, r < 0 ? Number.MAX_SAFE_INTEGER : r, -(o.usage?.get(t.id) ?? 0), i] });
  });
  out.sort((a, b) => { for (let k = 0; k < a.rank.length; k++) if (a.rank[k] !== b.rank[k]) return a.rank[k]! - b.rank[k]!; return 0; });
  return out.map(({ typeId, relationId, options }) => ({ typeId, relationId, options }));
}

/** Lo que dice la etiqueta flotante sobre el nodo bajo el puntero mientras se arrastra una conexión. */
export type ConnectVerdict =
  | { ok: true; relationId: string; options: number }
  | { ok: false; title: string; description: string };

/** Relación que se creará (la primera del selector, que es la habitual) o, si no hay ninguna, `null`. */
export function defaultOf(reg: NotationRegistry, opts: string[], sourceTypeId: string, defaultRelation?: string): string | null {
  if (!opts.length) return null;
  const g = groupRelationOptions(reg, opts, sourceTypeId, defaultRelation);
  return g.native[0] ?? g.bridge[0] ?? null;
}
