/**
 * Referencia de la API y errores del servidor en inglés: todo `summary` y etiqueta del OpenAPI de `server-core` y todo
 * error con `code` tienen traducción, y el cliente traduce los errores por `code` (o por el texto) al idioma activo.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { missing, setLang, tIn } from '@all-draw/i18n';
import { SERVER_ERRORS, serverErrorMessage } from '../src/api';

// Rutas de `api.ts` y de las integraciones (`api-integrations.ts`).
const SRC = ['api.ts', 'api-integrations.ts'].map(f => readFileSync(resolve(__dirname, `../../../packages/server-core/src/${f}`), 'utf8')).join('\n');
const all = (re: RegExp) => [...SRC.matchAll(re)].map(m => m[1]!.replace(/\\'/g, "'"));

afterEach(() => setLang('es'));

describe('referencia de la API en inglés', () => {
  it('todo summary y etiqueta del OpenAPI tiene traducción', () => {
    const summaries = all(/summary: '((?:[^'\\]|\\.)*)'/g);
    const tags = all(/tags: \['([^']+)'\]/g);
    expect(summaries.length).toBeGreaterThan(30);
    for (const lang of ['en', 'pt', 'fr'] as const) expect(missing(lang, new Set([...summaries, ...tags])), lang).toEqual([]);
  });
});

describe('errores del servidor en el idioma de la interfaz', () => {
  it('cada texto fijo de `fail(…)` y cada código del cliente tienen traducción', () => {
    const fixed = all(/fail\(\d+(?:\s*,|[^,]*\?[^,]*:[^,]*,)\s*'((?:[^'\\]|\\.)*)'/g);
    expect(fixed.length).toBeGreaterThan(30);
    for (const lang of ['en', 'pt', 'fr'] as const) expect(missing(lang, new Set([...fixed, ...Object.values(SERVER_ERRORS)])), lang).toEqual([]);
  });

  it('traduce por code (con variables) y, sin code conocido, por el texto; en español deja el texto del servidor', () => {
    setLang('en');
    expect(serverErrorMessage({ error: 'Email o contraseña incorrectos', code: 'bad_credentials' }, '')).toBe('Wrong email or password');
    expect(serverErrorMessage({ error: 'Has llegado al máximo de 3 espacios…', code: 'quota_workspaces', limit: 3 }, '')).toBe('You have reached the maximum of 3 workspaces per account: delete the ones you no longer use to create others.');
    expect(serverErrorMessage({ error: 'Se requiere rol owner (tienes viewer)', code: 'role_required', required: 'owner', role: 'viewer' }, '')).toMatch(/^The “.+” role is required \(you have “.+”\)$/);
    expect(serverErrorMessage({ error: 'Borra la cuenta desde una sesión, no con una API key', code: 'session_required' }, '')).toBe('Delete the account from a session, not with an API key');
    expect(serverErrorMessage({ error: 'Algo nuevo' }, 'Bad Request')).toBe('Algo nuevo');
    expect(serverErrorMessage({}, 'Bad Request')).toBe('Bad Request');
    for (const lang of ['pt', 'fr'] as const) {
      setLang(lang);
      const msg = serverErrorMessage({ error: 'Email o contraseña incorrectos', code: 'bad_credentials' }, '');
      expect(msg).toBe(tIn(lang, SERVER_ERRORS['bad_credentials']!));
      expect(msg).not.toMatch(/contraseña|password/i);
      expect(serverErrorMessage({ error: '…', code: 'quota_workspaces', limit: 3 }, '')).toContain('3');
    }
    setLang('es');
    expect(serverErrorMessage({ error: 'Email o contraseña incorrectos', code: 'bad_credentials' }, '')).toBe('Email o contraseña incorrectos');
  });
});
