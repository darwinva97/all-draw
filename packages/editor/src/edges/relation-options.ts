/**
 * Relaciones que se ofrecen al conectar dos nodos en el lienzo.
 *
 * - **Primero las de la notación**, en el orden del pack, con la habitual (`defaultRelation`) arriba. Si la habitual vale entre cualquier par
 *   (la Association de ArchiMate), no dice nada: va al final de las de la notación, detrás de las específicas.
 * - **Después las genéricas** (`core:*`: enlace, traza, realiza…), bajo «Trazabilidad».
 * - Entre dos tipos de la **misma notación con matriz de validez**, si la matriz no permite ninguna, tampoco se ofrecen
 *   las genéricas: la conexión no es válida y el lienzo explica por qué (`explainNoRelation`). Entre pines manda la
 *   compatibilidad de los puertos (un flujo de datos campo a campo sí vale).
 */
import type { NotationRegistry } from '@all-draw/core';

export const isBridgeRelation = (reg: NotationRegistry, id: string) => id.startsWith('core:') || reg.relationType(id)?.notationId === 'core';

/** ¿Los dos tipos son de la misma notación y esta tiene matriz de validez? */
export function sameNotationWithMatrix(reg: NotationRegistry, sourceTypeId: string, targetTypeId: string): boolean {
  const n = reg.notationOf(sourceTypeId);
  return n === reg.notationOf(targetTypeId) && !!reg.pack(n)?.validity;
}

/** Quita las genéricas cuando la matriz de la notación no permite ninguna relación propia entre esos tipos (sin pines). */
export function pruneBridges(reg: NotationRegistry, sourceTypeId: string, targetTypeId: string, opts: string[], viaPorts: boolean): string[] {
  if (viaPorts || !sameNotationWithMatrix(reg, sourceTypeId, targetTypeId)) return opts;
  // Notaciones cuya relación habitual es genérica (rejilla): las genéricas son las suyas.
  const def = reg.pack(reg.notationOf(sourceTypeId))?.defaultRelation;
  if (def && isBridgeRelation(reg, def)) return opts;
  return opts.some(o => !isBridgeRelation(reg, o)) ? opts : [];
}

/** ¿`rel` vale desde `sourceTypeId` hacia todos los tipos de su notación? (no aporta nada como primera opción) */
function catchAll(reg: NotationRegistry, sourceTypeId: string, rel: string): boolean {
  const pack = reg.pack(reg.notationOf(sourceTypeId));
  const types = pack?.elementTypes ?? [];
  return types.length > 2 && types.every(t => reg.allowedRelations(sourceTypeId, t.id).includes(rel));
}

export interface RelationGroups { native: string[]; bridge: string[] }

/** Agrupa y ordena las opciones del selector «Tipo de relación». */
export function groupRelationOptions(reg: NotationRegistry, opts: string[], sourceTypeId: string, defaultRelation?: string): RelationGroups {
  const uniq = [...new Set(opts)];
  // Orden del pack (en ArchiMate, el de la especificación: estructurales, de dependencia —Serving— y dinámicas).
  const order = new Map((reg.pack(reg.notationOf(sourceTypeId))?.relationTypes ?? []).map((r, i) => [r.id, i] as const));
  const rank = (o: string) => order.get(o) ?? Number.MAX_SAFE_INTEGER;
  let native = uniq.filter(o => !isBridgeRelation(reg, o)).map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).map(x => x.o);
  const bridge = uniq.filter(o => isBridgeRelation(reg, o));
  if (defaultRelation && native.includes(defaultRelation) && native.length > 1) {
    const rest = native.filter(o => o !== defaultRelation);
    native = catchAll(reg, sourceTypeId, defaultRelation) ? [...rest, defaultRelation] : [defaultRelation, ...rest];
  }
  // La habitual genérica (rejilla: `core:link`) va primera de su grupo.
  const b = defaultRelation && bridge.includes(defaultRelation) ? [defaultRelation, ...bridge.filter(o => o !== defaultRelation)] : bridge;
  return { native, bridge: b };
}

type Tr = (key: string, vars?: Record<string, string | number>) => string;
const names = (reg: NotationRegistry, ids: string[]) => [...new Set(ids.map(id => reg.relationType(id)?.name ?? id))];
const list = (xs: string[], max = 4) => (xs.length > max ? `${xs.slice(0, max).join(', ')}…` : xs.join(', '));

/**
 * Aviso cuando no hay ninguna relación válida de `sourceTypeId` a `targetTypeId`: título y qué permite la matriz
 * (al revés, o con qué tipos sí se conecta el origen). `blockedByPools`: la matriz lo permitía, pero BPMN no deja que
 * un flujo de secuencia cruce pools ni que uno de mensaje se quede dentro de una.
 */
export function explainNoRelation(reg: NotationRegistry, t: Tr, sourceTypeId: string, targetTypeId: string, blockedByPools = false): { title: string; description: string } {
  const st = reg.elementType(sourceTypeId), tt = reg.elementType(targetTypeId);
  const from = st?.name ?? sourceTypeId, to = tt?.name ?? targetTypeId;
  const pack = reg.pack(reg.notationOf(sourceTypeId));
  const notation = pack?.name ?? reg.notationOf(sourceTypeId);
  const title = t('No hay relaciones válidas de «{from}» a «{to}» en {notation}', { from, to, notation });
  if (blockedByPools) return { title, description: t('En BPMN, el flujo de secuencia no sale de su pool y el de mensaje solo une pools distintas.') };
  const own = (a: string, b: string) => reg.allowedRelations(a, b).filter(o => !isBridgeRelation(reg, o));
  const back = own(targetTypeId, sourceTypeId);
  if (back.length) return { title, description: t('Al revés sí: {list}.', { list: list(names(reg, back)) }) };
  const targets = (pack?.elementTypes ?? []).filter(x => own(sourceTypeId, x.id).length).map(x => x.name);
  if (targets.length) return { title, description: t('«{from}» puede conectarse con: {list}.', { from, list: list([...new Set(targets)], 5) }) };
  return { title, description: t('«{from}» no puede ser origen de ninguna relación en {notation}.', { from, notation }) };
}
