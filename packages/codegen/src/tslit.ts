/**
 * Impresor de literales TypeScript deterministas (para incrustar configuraciones en el código generado sin
 * `JSON.stringify` crudo): claves sin comillas cuando son identificadores, comillas simples, sangría de 2.
 */
import { isIdentifier } from './util';

export const tsString = (s: string): string =>
  `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`;

export const tsKey = (k: string): string => (isIdentifier(k) || /^(0|[1-9]\d*)$/.test(k) ? k : tsString(k));

const isPrimitive = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

export function tsLiteral(v: unknown, indent = ''): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return tsString(v);
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return String(v);
  const inner = indent + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const flat = v.every(isPrimitive) ? `[${v.map(x => tsLiteral(x)).join(', ')}]` : '';
    if (flat && flat.length + indent.length <= 100) return flat;
    return `[\n${v.map(x => `${inner}${tsLiteral(x, inner)},`).join('\n')}\n${indent}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${inner}${tsKey(k)}: ${tsLiteral(x, inner)},`).join('\n')}\n${indent}}`;
}
