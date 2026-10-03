/**
 * Error de importación con un mensaje traducible: `key` es el texto en español con `{var}` (el mismo que `message`
 * tras sustituir `vars`, ya traducido con el traductor inyectado en `./i18n`). La interfaz puede volver a traducirlo con
 * `t(key, vars)` si cambia el idioma. Vive aparte de `detect.ts` para que los importadores lo usen sin ciclos.
 */
import { tr } from './i18n';

export class ImportError extends Error {
  readonly key: string;
  readonly vars: Record<string, string | number>;
  constructor(key: string, vars: Record<string, string | number> = {}) {
    super(tr(key, vars));
    this.name = 'ImportError';
    this.key = key; this.vars = vars;
  }
}
