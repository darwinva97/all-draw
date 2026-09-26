/**
 * Todas las claves `t('…')` del editor y de la web tienen entrada en el diccionario inglés.
 * Recorre los fuentes con `fs`, extrae las llamadas con literal simple (sin `${}`) y comprueba `missing('en', …)`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { missing } from '../src';

const ROOT = resolve(__dirname, '../../..');
const DIRS = [
  { dir: join(ROOT, 'packages/editor/src'), ext: /\.(ts|tsx)$/ },
  { dir: join(ROOT, 'apps/web/src'), ext: /\.tsx$/ },
];

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** `t('…')`, `t("…")` y `t(`…`)` sin interpolación `${}`; el literal puede ir seguido de `, { vars }`. */
const CALL = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)\s*[,)]/g;

export function extractKeys(src: string): string[] {
  const keys: string[] = [];
  for (const m of src.matchAll(CALL)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    keys.push(raw.replace(/\\(['"`\\])/g, '$1'));
  }
  return keys;
}

describe('claves de traducción', () => {
  it('extrae literales simples y omite plantillas interpoladas', () => {
    expect(extractKeys(`t('Hola'); t("Adiós"); t(\`Qué tal\`); t(\`No \${x}\`); t('Con {n}', { n: 1 }); t('It\\'s')`)).toEqual(['Hola', 'Adiós', 'Qué tal', 'Con {n}', "It's"]);
  });

  it('todas las claves del editor y de la web están en el diccionario inglés', () => {
    const byKey = new Map<string, string[]>();
    for (const { dir, ext } of DIRS) {
      for (const file of walk(dir, ext)) {
        for (const k of extractKeys(readFileSync(file, 'utf8'))) {
          const rel = relative(ROOT, file);
          const list = byKey.get(k) ?? [];
          if (!list.includes(rel)) list.push(rel);
          byKey.set(k, list);
        }
      }
    }
    expect(byKey.size).toBeGreaterThan(50);
    const lacking = missing('en', byKey.keys()).map(k => `${JSON.stringify(k)}  ←  ${byKey.get(k)!.join(', ')}`);
    expect(lacking, `Claves sin traducción inglesa:\n${lacking.join('\n')}`).toEqual([]);
  });
});
