import { t as translate } from '@all-draw/i18n';

/**
 * Texto de un error de importar/exportar en el idioma activo: los `ImportError` de `@all-draw/io` traen `key` (texto
 * español con `{var}`) y `vars`; el resto ya llega traducido por el traductor inyectado en io (`setIoTranslator`).
 */
export function ioErrorText(e: unknown): string {
  const x = e as { key?: unknown; vars?: Record<string, string | number>; message?: unknown } | null;
  if (x && typeof x.key === 'string') return translate(x.key, x.vars);
  return x && typeof x.message === 'string' ? x.message : String(e);
}
