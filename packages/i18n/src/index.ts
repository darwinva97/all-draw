/**
 * Internacionalización mínima. La **clave es el texto en español** tal como aparece en la interfaz;
 * los diccionarios traducen a otros idiomas y, si falta una entrada, se devuelve la clave.
 * `{nombre}` interpola variables. Sin dependencias; válido en React (hook) y fuera (funciones puras).
 */
import { useSyncExternalStore } from 'react';
import { en } from './en';

export type Lang = 'es' | 'en';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'es', name: 'Español' }, { id: 'en', name: 'English' }];

const dicts: Record<Lang, Record<string, string>> = { es: {}, en };
const listeners = new Set<() => void>();
let current: Lang = detect();

function detect(): Lang {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('alldraw:lang') : null;
    if (saved === 'es' || saved === 'en') return saved;
    const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
    return nav.toLowerCase().startsWith('en') ? 'en' : 'es';
  } catch { return 'es'; }
}

export function getLang(): Lang { return current; }
export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try { localStorage.setItem('alldraw:lang', l); } catch { /* sin almacenamiento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  for (const f of listeners) f();
}
export function onLangChange(f: () => void): () => void { listeners.add(f); return () => listeners.delete(f); }

/** Registra o amplía un diccionario (los packs o la app pueden aportar cadenas). */
export function addTranslations(lang: Lang, entries: Record<string, string>): void {
  Object.assign(dicts[lang], entries);
  for (const f of listeners) f();
}

export type Vars = Record<string, string | number>;

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Traduce un texto en español al idioma activo. */
export function t(key: string, vars?: Vars): string {
  const d = dicts[current];
  return interpolate(d[key] ?? key, vars);
}

/** Traduce a un idioma concreto (exportaciones, servidor). */
export function tIn(lang: Lang, key: string, vars?: Vars): string {
  return interpolate(dicts[lang][key] ?? key, vars);
}

/** Hook: devuelve `t` y provoca re-render al cambiar de idioma. */
export function useT(): typeof t {
  useSyncExternalStore(onLangChange, getLang, getLang);
  return t;
}
export function useLang(): [Lang, (l: Lang) => void] {
  const l = useSyncExternalStore(onLangChange, getLang, getLang);
  return [l, setLang];
}

/** Claves en español que no tienen traducción en `lang` (para tests y para completar diccionarios). */
export function missing(lang: Lang, keys: Iterable<string>): string[] {
  const d = dicts[lang];
  return [...keys].filter(k => !(k in d));
}
