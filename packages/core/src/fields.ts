/** Reconocimiento de la estructura de un JSON: lista plana de campos (portado de Drawer `lib/schema.ts`). */
export interface SchemaField { path: string; type: string; example: string; leaf: boolean }

/** Recorre un valor JSON y devuelve sus campos como rutas (`a.b`, `items[].id`), con tipo y ejemplo. */
export function jsonFields(value: unknown, max = 300): SchemaField[] {
  const out: SchemaField[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (out.length >= max || depth > 10) return;
    if (Array.isArray(v)) {
      if (path) out.push({ path, type: `array[${v.length}]`, example: '', leaf: false });
      if (v.length) walk(v[0], path + '[]', depth + 1);
      return;
    }
    if (v && typeof v === 'object') {
      if (path) out.push({ path, type: 'object', example: '', leaf: false });
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, depth + 1);
      return;
    }
    const type = v === null ? 'null' : typeof v;
    out.push({ path: path || '$', type, example: JSON.stringify(v), leaf: true });
  };
  walk(value, '', 0);
  return out;
}

/** Campos de un texto JSON, o null si no es JSON válido / está vacío. */
export function parseJsonFields(text: unknown): SchemaField[] | null {
  const s = String(text ?? '').trim();
  if (!s) return null;
  try { return jsonFields(JSON.parse(s)); } catch { return null; }
}

/** Texto plano de un valor de campo, sea del tipo que sea (lista, clave→valor, JSON…). */
export function fieldText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' && 'key' in (x as object))
    ? `${(x as { key: string }).key}=${(x as { value: string }).value}` : String(x)).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Normaliza texto para comparar: minúsculas, sin tildes, sin espacios sobrantes. */
export const normText = (v: unknown) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
