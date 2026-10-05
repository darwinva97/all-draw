/**
 * Emisor YAML mínimo y determinista para datos JSON (objetos, listas, cadenas, números, booleanos, null).
 * Las cadenas van sin comillas solo si es seguro; si no, entre comillas dobles con escapes JSON (válidos en
 * YAML); las multilínea, como bloque literal `|-`. Evita depender de una librería para algo tan acotado.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const RESERVED = /^(true|false|yes|no|on|off|y|n|null|~)$/i;
const PLAIN = /^[\p{L}_][\p{L}\p{N}_ .\/()\-]*$/u;

export function yamlScalar(v: null | boolean | number | string): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '.nan';
  if (PLAIN.test(v) && !RESERVED.test(v) && !v.endsWith(' ') && !/ #|: /.test(v)) return v;
  return JSON.stringify(v);
}

const key = (k: string): string => yamlScalar(k);
const isScalar = (v: Json): v is null | boolean | number | string => v === null || typeof v !== 'object';
const isBlock = (s: string) => s.includes('\n') && !/^\s/.test(s) && !/\s$/.test(s) && !s.includes('\r') && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);

function scalarAt(v: null | boolean | number | string, indent: string): string {
  if (typeof v === 'string' && isBlock(v)) return `|-\n${v.split('\n').map(l => (l ? `${indent}  ${l}` : '')).join('\n')}`;
  return yamlScalar(v);
}

function emit(v: Json, indent: string): string[] {
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (isScalar(item)) { out.push(`${indent}- ${scalarAt(item, indent + '  ')}`); continue; }
      if (Array.isArray(item) ? !item.length : !Object.keys(item).length) { out.push(`${indent}- ${Array.isArray(item) ? '[]' : '{}'}`); continue; }
      const inner = emit(item, indent + '  ');
      out.push(`${indent}- ${inner[0]!.slice(indent.length + 2)}`, ...inner.slice(1));
    }
    return out;
  }
  if (isScalar(v)) return [`${indent}${scalarAt(v, indent)}`];
  const out: string[] = [];
  for (const [k, x] of Object.entries(v)) {
    if (isScalar(x)) out.push(`${indent}${key(k)}: ${scalarAt(x, indent)}`);
    else if (Array.isArray(x) ? !x.length : !Object.keys(x).length) out.push(`${indent}${key(k)}: ${Array.isArray(x) ? '[]' : '{}'}`);
    else out.push(`${indent}${key(k)}:`, ...emit(x, indent + '  '));
  }
  return out;
}

/** YAML de un valor JSON (los `undefined` se omiten). */
export function toYaml(value: unknown): string {
  const clean = JSON.parse(JSON.stringify(value ?? null)) as Json;
  if (isScalar(clean)) return yamlScalar(clean) + '\n';
  return emit(clean, '').join('\n') + '\n';
}
