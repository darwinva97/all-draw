/**
 * Catálogo de avisos. Cada clave es el texto en español con `{var}` (convenio de `@all-draw/i18n`): la UI la
 * traduce tal cual y añade la versión inglesa. Los generadores solo emiten claves de aquí (`W.algo`), así que
 * `WARNING_KEYS` es exhaustivo por construcción (y un test lo comprueba).
 */
import type { CodegenWarning } from './types';

export const W = {
  // ---- comunes
  viewMissing: 'La vista {view} no existe',
  nothing: 'No hay nada que generar en {scope}',
  renamed: 'El nombre "{name}" no es un identificador válido; se usa "{id}"',
  duplicateName: 'Hay varios elementos que se llamarían "{name}"; se usa "{id}"',

  // ---- UML
  unknownType: 'Tipo desconocido "{type}" en {owner}; se usa {fallback}',
  missingType: '"{member}" de {owner} no tiene tipo; se usa {fallback}',
  typeOutOfScope: 'El tipo "{type}" de {owner} es un clasificador que no está en la vista; se referencia pero no se genera',
  unparsedLine: 'No se entiende la línea "{line}" de {owner}; se omite',
  duplicateMember: 'El miembro "{member}" está repetido en {owner}; se renombra a "{id}"',
  multipleInheritance: 'La clase {name} hereda de varias clases ({classes}); se usa {used}',
  inheritanceCycle: 'Ciclo de herencia entre {from} y {to}; se ignora esa relación',
  badGeneralization: 'Generalización no válida de {from} ({fromKind}) a {to} ({toKind}); se ignora',
  badRealization: 'Realización no válida de {from} a {to}: el destino no es una interfaz; se ignora',
  abstractInConcrete: 'La clase {name} tiene operaciones abstractas; se genera como abstracta',

  // ---- ER → SQL
  noPk: 'La tabla {table} no tiene clave primaria',
  pkMissingColumn: 'La clave primaria de {table} nombra la columna {column}, que no existe; se omite',
  unknownSqlType: 'Tipo SQL desconocido "{type}" en {table}.{column}; se deja tal cual',
  missingSqlType: 'La columna {table}.{column} no tiene tipo; se usa {fallback}',
  fkNoPk: 'La relación {relation} apunta a {table}, que no tiene clave primaria; no se genera la clave ajena',
  fkColumnCount: 'La relación {relation} une {count} columnas con una clave de {expected}; se usan las columnas por defecto',
  fkNotKey: 'La clave ajena de {table} ({columns}) referencia columnas de {ref} que no son su clave primaria',
  setNullNotNull: 'ON DELETE SET NULL en {table}.{column}, que no admite nulos',
  cyclePostgres: 'Hay referencias circulares entre tablas ({tables}); sus claves ajenas se añaden al final con ALTER TABLE',
  cycleSqlite: 'Hay referencias circulares entre tablas ({tables}); SQLite las admite, pero al cargar datos hay que desactivar o diferir las claves ajenas',
  inheritsStrategy: 'Herencia de {sub} a {super} con estrategia "{kind}": solo se documenta con un comentario',
  inheritsPkMismatch: 'La clave primaria de {sub} no encaja con la de {super}; no se genera la clave ajena de la herencia',

  // ---- Máquinas de estados
  xstateExport: 'Exportador XState: {message}',
  unknownDelay: 'Retardo "{delay}" no reconocido; se define como 1000 ms',

  // ---- OpenAPI
  opWithoutApi: 'Hay {count} operaciones sin API; van a openapi/api.yaml',
  opWithoutPath: 'La operación "{operation}" no tiene path; se omite',
  duplicateOperation: 'La operación {method} {path} está repetida en {api}; se omite "{operation}"',
  invalidJson: 'El cuerpo {body} de "{operation}" no es JSON válido; se declara como texto',
  undeclaredPathParam: 'El parámetro {param} del path {path} no está declarado en "{operation}"; se añade como texto',

  // ---- Structurizr DSL
  notExported: 'El elemento "{name}" ({type}) no tiene equivalente en Structurizr; se omite',
  containerWithoutSystem: 'El contenedor "{name}" no está dentro de ningún sistema; va a "Sin sistema"',
  componentWithoutContainer: 'El componente "{name}" no está dentro de ningún contenedor; se omite',
  relationSkipped: 'La relación {id} une elementos no exportados; se omite',
  viewWithoutScope: 'La vista "{view}" no tiene un {kind} de referencia; se genera como vista general',
} as const;

export type WarningKey = (typeof W)[keyof typeof W];

/** Todas las claves de aviso que puede emitir el paquete (la UI les añade traducción inglesa). */
export const WARNING_KEYS: readonly string[] = Object.freeze(Object.values(W));

/** Acumulador de avisos sin duplicados (misma clave y mismas variables = un aviso). */
export class Warnings {
  readonly list: CodegenWarning[] = [];
  private readonly seen = new Set<string>();
  add(key: WarningKey, vars?: Record<string, string | number>): void {
    const sig = key + '\u0000' + JSON.stringify(vars ?? {});
    if (this.seen.has(sig)) return;
    this.seen.add(sig);
    this.list.push(vars ? { key, vars } : { key });
  }
}

/** Texto del aviso interpolado en español (para tests/CLI). */
export function warningText(w: CodegenWarning): string {
  const vars = w.vars;
  if (!vars) return w.key;
  return w.key.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
