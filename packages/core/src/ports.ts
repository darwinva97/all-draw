/**
 * Puertos (pines). Un elemento tiene puertos declarados (`element.ports`) y puertos **derivados**
 * de sus campos tipados: un campo `json` produce un puerto por hoja, `list`/`keyvalue` uno por
 * entrada, y cualquier otro campo marcado `port: true` un puerto plano. Los ids son estables
 * (`<elementId>#<key>`) para que las relaciones sobrevivan a re-derivaciones.
 */
import { parseJsonFields } from './fields';
import type { Element, FieldDef, Port, KeyValue } from './model';

export const PORT_SEP = '#';

export function portId(elementId: string, key: string): string {
  return `${elementId}${PORT_SEP}${key}`;
}

export function portKeyOf(id: string): string {
  const i = id.indexOf(PORT_SEP);
  return i < 0 ? id : id.slice(i + 1);
}

const DEFAULT_PORT_KINDS = new Set(['json', 'list', 'keyvalue']);

/** Puertos derivados de los campos de un elemento según las definiciones de su tipo. */
export function derivePorts(element: Pick<Element, 'id' | 'fields'>, defs: FieldDef[]): Port[] {
  const out: Port[] = [];
  const push = (key: string, extra: Partial<Port>, def: FieldDef) => out.push({
    id: portId(element.id, key), key, derived: true,
    direction: def.direction ?? 'both',
    portTypeId: def.portTypeId ?? `field:${def.kind}`,
    group: def.label, label: def.label,
    ...extra,
  });
  for (const def of defs) {
    const wants = def.port ?? DEFAULT_PORT_KINDS.has(def.kind);
    if (!wants) continue;
    const value = element.fields[def.key];
    if (def.kind === 'json') {
      const parsed = parseJsonFields(value);
      if (parsed) {
        for (const s of parsed) push(`${def.key}.${s.path}`, { label: s.path, path: s.path, dataType: s.type }, def);
        continue;
      }
    }
    if (def.kind === 'list' && Array.isArray(value)) {
      value.forEach((v, i) => push(`${def.key}[${i}]`, { label: String(v), path: `[${i}]`, dataType: 'string' }, def));
      continue;
    }
    if (def.kind === 'keyvalue' && Array.isArray(value)) {
      for (const kv of value as KeyValue[]) if (kv && kv.key) push(`${def.key}.${kv.key}`, { label: kv.key, path: kv.key, dataType: 'string' }, def);
      continue;
    }
    push(def.key, { dataType: def.kind }, def);
  }
  return out;
}

/** Todos los puertos de un elemento: los declarados a mano más los derivados (los declarados ganan por clave). */
export function allPorts(element: Element, defs: FieldDef[]): Port[] {
  const manual = new Map(element.ports.map(p => [p.key, p] as const));
  const derived = derivePorts(element, defs).filter(p => !manual.has(p.key));
  return [...element.ports, ...derived];
}

/** Regla de compatibilidad entre tipos de puerto. `'*'` casa con cualquiera. */
export interface PortRule { from: string; to: string; relationTypes: string[] }

export function compatibleRelationTypes(rules: PortRule[], fromType: string | undefined, toType: string | undefined): string[] | null {
  if (!fromType && !toType) return null; // sin puertos: decide la matriz de elementos
  const hit = rules.filter(r => (r.from === '*' || r.from === fromType) && (r.to === '*' || r.to === toType));
  if (hit.length === 0) return null;
  return [...new Set(hit.flatMap(r => r.relationTypes))];
}
