/**
 * Compartimentos de clasificador (clase, interfaz y enumeración UML; entidad ER): cabecera con «estereotipo» y nombre
 * (en cursiva si es abstracta) y una sección por campo con una fila por entrada. El tipo los declara en
 * `meta.compartments` (`sections`: campos `list`/`keyvalue`; `stereotype`, `abstract`, `pk`: campos auxiliares).
 *
 * Cada fila que sale de un campo con pines (`attributes` de clase o de entidad) es un pin: su manejador va a la altura
 * de la fila, así que una relación atributo → atributo sale de la fila. La misma geometría está en
 * `packages/io/src/svg.ts` (`compartmentsOf` / `compartmentLayout`): si cambias algo aquí, cámbialo allí.
 */
import type { Element, ElementType } from '@all-draw/core';

export interface CompartmentSpec { sections: string[]; stereotype?: string; abstract?: string; pk?: string }
export interface CompartmentRow {
  text: string;
  /** Segunda columna (tipo del atributo ER), alineada a la derecha. */
  detail?: string;
  /** Clave del pin que deriva `derivePorts` de esta entrada (`attributes[0]`, `attributes.id`). */
  portKey: string;
  /** Forma parte de la clave primaria. */
  pk?: boolean;
  /** Nombre repetido dentro de la sección. */
  dup?: boolean;
}
export interface Compartments { stereotype?: string; italic: boolean; sections: CompartmentRow[][] }

/** Medidas en px: cabecera (márgenes, estereotipo, nombre), fila y margen de cada sección. */
export const CMP = { pad: 5, stereo: 14, name: 18, row: 18, secPad: 3, emptySec: 10, border: 1 } as const;

export function compartmentSpec(type: ElementType | undefined): CompartmentSpec | undefined {
  const spec = type?.meta?.compartments as CompartmentSpec | undefined;
  return spec && Array.isArray(spec.sections) && spec.sections.length ? spec : undefined;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
/** Nombre de un miembro UML escrito como texto ("- nombre: String", "+ total(): Money" → "nombre", "total"). */
export function memberName(text: string): string {
  return text.replace(/^\s*[-+#~]\s*/, '').split(/[:(\s]/)[0]!.trim().toLowerCase();
}

export function compartmentsOf(el: Pick<Element, 'fields'>, type: ElementType | undefined): Compartments | undefined {
  const spec = compartmentSpec(type); if (!spec) return undefined;
  const f = el.fields ?? {};
  const stereotype = (spec.stereotype && str(f[spec.stereotype])) || str(type?.meta?.stereotypeDefault);
  const pkList = spec.pk && Array.isArray(f[spec.pk]) ? (f[spec.pk] as unknown[]).map(String) : [];
  const pk = new Set(pkList);
  const sections = spec.sections.map(key => {
    const v = f[key];
    if (!Array.isArray(v)) return [];
    const rows: CompartmentRow[] = [];
    v.forEach((x, i) => {
      if (typeof x === 'string') { if (x.trim()) rows.push({ text: x.trim(), portKey: `${key}[${i}]` }); }
      else if (x && typeof x === 'object' && str((x as { key?: unknown }).key)) {
        const k = String((x as { key: unknown }).key);
        rows.push({ text: k, detail: str((x as { value?: unknown }).value), portKey: `${key}.${k}`, pk: pk.has(k) || undefined });
      }
    });
    // Operaciones (con paréntesis) admiten sobrecarga: solo se marcan repetidos atributos y literales.
    const seen = new Map<string, number>();
    const names = rows.map(r => (r.text.includes('(') ? '' : memberName(r.text)));
    names.forEach(n => { if (n) seen.set(n, (seen.get(n) ?? 0) + 1); });
    rows.forEach((r, i) => { if (names[i] && seen.get(names[i]!)! > 1) r.dup = true; });
    return rows;
  });
  return { stereotype, italic: !!(spec.abstract && f[spec.abstract] === true), sections };
}

export interface CompartmentLayout {
  /** Alto de la cabecera (dentro del borde). */
  headerH: number;
  /** Secciones: `y` y `h` dentro del borde; cada fila con el centro vertical de su texto y de su pin. */
  sections: { y: number; h: number; rows: (CompartmentRow & { cy: number })[] }[];
  /** Alto mínimo del nodo, bordes incluidos. */
  height: number;
}

export function compartmentLayout(c: Compartments): CompartmentLayout {
  const headerH = CMP.pad * 2 + CMP.name + (c.stereotype ? CMP.stereo : 0);
  let y = headerH;
  const sections = c.sections.map(rows => {
    const h = rows.length ? CMP.secPad * 2 + rows.length * CMP.row : CMP.emptySec;
    const sec = { y, h, rows: rows.map((r, i) => ({ ...r, cy: y + CMP.secPad + i * CMP.row + CMP.row / 2 })) };
    y += h;
    return sec;
  });
  return { headerH, sections, height: y + CMP.border * 2 };
}

/** Alto mínimo de un nodo con compartimentos (0 si el tipo no los tiene). */
export function compartmentHeight(el: Pick<Element, 'fields'> | undefined, type: ElementType | undefined): number {
  const c = el ? compartmentsOf(el, type) : undefined;
  return c ? compartmentLayout(c).height : 0;
}
