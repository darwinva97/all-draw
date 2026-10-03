/**
 * Los mensajes que el núcleo, io y layout generan en español con clave traducible (`say`, `fix`, `tr`, `trn`, `{ key: … }`)
 * y los plurales de la interfaz (`tn`) tienen traducción inglesa. Recorre los fuentes y comprueba `missing('en', …)`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { missing, setLang, tn, tMsg } from '../src';

const ROOT = resolve(__dirname, '../../..');
const DIRS = ['packages/core/src', 'packages/io/src', 'packages/layout/src', 'packages/editor/src', 'apps/web/src'].map(d => join(ROOT, d));

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'dist') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const STR = String.raw`'((?:[^'\\]|\\.)*)'`;
/** Primer argumento literal de `say(`, `fix(`, `tr(`, `new ImportError(` y `{ key: '…'` (mensajes anidados); los dos primeros de `trn(` y `tn(`. */
const ONE = new RegExp(String.raw`(?:\b(?:say|fix|tr)\(|\bnew ImportError\()\s*${STR}|\{\s*key:\s*${STR}\s*(?:\}|,\s*vars\b)`, 'g');
const TWO = new RegExp(String.raw`\b(?:trn|tn)\(\s*${STR}\s*,\s*${STR}`, 'g');
/** Mensaje de `diag(code, severity, collection, id, 'clave', …)` (validadores de bpmnlint). */
const DIAG = new RegExp(String.raw`\bdiag\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*[^,]+?,\s*${STR}`, 'g');
/** Motivos de afinidad de tipos (`pairs(…, 'core:x', 'motivo')`). */
const AFFINITY = new RegExp(String.raw`\bpairs\([^\n]*'core:(?:trace|realizes|refines)',\s*${STR}\)`, 'g');
const unq = (s: string) => s.replace(/\\(['"\\])/g, '$1');

export function extractMessageKeys(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(ONE)) out.push(unq(m[1] ?? m[2] ?? ''));
  for (const m of src.matchAll(TWO)) out.push(unq(m[1]!), unq(m[2]!));
  for (const m of src.matchAll(AFFINITY)) out.push(unq(m[1]!));
  for (const m of src.matchAll(DIAG)) out.push(unq(m[1]!));
  // Plantillas sin texto que traducir (`{a}; {b}`) y claves vacías no cuentan.
  return out.filter(k => /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(k.replace(/\{\w+\}/g, '')));
}

describe('mensajes traducibles', () => {
  it('extrae say/fix/tr/{ key }/trn/tn y motivos de afinidad', () => {
    expect(extractMessageKeys(`say('Hola {n}', { n }); fix('Borrar', c); tr('Uno'); x = { key: 'Anidado' }; trn('{n} vista', '{n} vistas', 2); tn('{n} nodo', '{n} nodos', 1); pairs(['a'], ['b'], 'core:trace', 'motivo'); y = { key: '{a}; {b}' }; diag('c', 'error', 'elements', e.id, 'Mensaje {x}', { x })`))
      .toEqual(['Hola {n}', 'Borrar', 'Uno', 'Anidado', '{n} vista', '{n} vistas', '{n} nodo', '{n} nodos', 'motivo', 'Mensaje {x}']);
  });

  it('todos los mensajes del núcleo, io, layout y los plurales de la interfaz tienen traducción inglesa', () => {
    const byKey = new Map<string, string[]>();
    for (const dir of DIRS) for (const file of walk(dir)) for (const k of extractMessageKeys(readFileSync(file, 'utf8'))) {
      const rel = relative(ROOT, file);
      const list = byKey.get(k) ?? [];
      if (!list.includes(rel)) list.push(rel);
      byKey.set(k, list);
    }
    expect(byKey.size).toBeGreaterThan(150);
    const lacking = missing('en', byKey.keys()).map(k => `${JSON.stringify(k)}  ←  ${byKey.get(k)!.join(', ')}`);
    expect(lacking, `Mensajes sin traducción inglesa:\n${lacking.join('\n')}`).toEqual([]);
  });

  it('tn elige singular o plural y tMsg traduce mensajes anidados', () => {
    setLang('en');
    expect(tn('{n} respuesta', '{n} respuestas', 1)).toBe('1 reply');
    expect(tn('{n} respuesta', '{n} respuestas', 2)).toBe('2 replies');
    expect(tMsg('"{name}" ({type}) no tiene traza a otra notación; {reason}', { name: 'Cliente', type: 'Business Actor', reason: { key: 'mismo nombre "{name}"', vars: { name: 'Cliente' } } }))
      .toBe('"Cliente" (Business Actor) has no trace to another notation; same name "Cliente"');
    setLang('es');
    expect(tn('{n} respuesta', '{n} respuestas', 1)).toBe('1 respuesta');
    expect(tn('{n} respuesta', '{n} respuestas', 0)).toBe('0 respuestas');
  });
});
