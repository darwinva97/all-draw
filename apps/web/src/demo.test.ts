/**
 * El espacio de ejemplo se construye en el idioma activo: en español conserva los textos de siempre
 * (los e2e los buscan) y en inglés no queda ningún nombre visible sin traducir.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setLang, tIn, missing } from '@all-draw/i18n';
import type { Workspace } from '@all-draw/core';
import { demoWorkspace } from './demo';
import demoSource from './demo.ts?raw';

/** Nombres visibles en orden estable (orden de inserción): espacio, elementos, vistas, capas/etapas, dimensiones, reglas, bibliotecas. */
function visibleNames(ws: Workspace): string[] {
  const out = [ws.meta.name];
  for (const e of Object.values(ws.elements)) out.push(e.name);
  for (const v of Object.values(ws.views)) {
    out.push(v.name);
    if (v.doc) out.push(v.doc);
    for (const l of v.grid?.layers ?? []) out.push(l.name);
    for (const s of v.grid?.stages ?? []) out.push(s.name);
    for (const g of v.grid?.stageGroups ?? []) out.push(g.name);
  }
  for (const d of Object.values(ws.dimensions)) out.push(d.name);
  for (const r of Object.values(ws.rules)) out.push(r.name);
  for (const r of Object.values(ws.relations)) out.push(r.name);
  for (const lib of Object.values(ws.libraries)) {
    out.push(lib.name);
    for (const ty of lib.elementTypes) out.push(ty.name, ...ty.fields.map(f => f.label));
  }
  return out;
}

/** Textos idénticos en ambos idiomas (siglas, nombres propios, palabras clave de notación). */
const SAME = new Set(['', 'CRM', 'C4', 'Portal', 'alt', 'no', 'email', 'JSON/HTTPS', 'SQL', 'REST']);

afterEach(() => setLang('es'));

describe('demoWorkspace', () => {
  it('en español tiene los nombres de siempre', () => {
    setLang('es');
    const ws = demoWorkspace();
    expect(ws.meta.name).toBe('Demo · Alta de cliente');
    const elements = Object.values(ws.elements).map(e => e.name);
    expect(elements).toContain('Cliente');
    expect(elements).toContain('Verificar identidad');
    expect(Object.values(ws.views).map(v => v.name)).toContain('Arquitectura · Alta de cliente');
    expect(Object.values(ws.rules).map(r => r.name)).toContain('Servicios sin repo');
  });

  it('todas las claves t() de la demo tienen traducción inglesa', () => {
    const keys = [...demoSource.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)].map(m => m[1]!);
    expect(keys.length).toBeGreaterThan(40);
    expect(missing('en', keys)).toEqual([]);
  });

  it('en inglés no queda ningún nombre visible sin traducir', () => {
    setLang('es');
    const es = visibleNames(demoWorkspace());
    setLang('en');
    const ws = demoWorkspace();
    const en = visibleNames(ws);
    expect(en.length).toBe(es.length);
    const untranslated = es.filter((s, i) => en[i] !== tIn('en', s) || (en[i] === s && !SAME.has(s)));
    expect(untranslated).toEqual([]);
    expect(ws.meta.name).toBe('Demo · Customer onboarding');
    expect(Object.values(ws.elements).map(e => e.name)).toContain('Customer');
    expect(Object.values(ws.views).map(v => v.name)).toContain('Architecture · Customer onboarding');
    // La regla por tipo sigue casando con el nombre (traducido) del tipo de la biblioteca.
    const rule = ws.rules['rule_svc']!;
    expect(rule.conditions.find(c => c.source === 'type')?.value).toBe(ws.libraries['lib_demo']!.elementTypes[0]!.name);
  });
});
