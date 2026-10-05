/**
 * Internacionalización mínima. La **clave es el texto en español** tal como aparece en la interfaz;
 * los diccionarios traducen a otros idiomas y, si falta una entrada, se usa el idioma de respaldo (`FALLBACK`: el
 * inglés para portugués y francés) y, en último término, la clave.
 * `{nombre}` interpola variables. Sin dependencias; válido en React (hook) y fuera (funciones puras).
 */
import { useSyncExternalStore } from 'react';

export type Lang = 'es' | 'en' | 'pt' | 'fr';
/** Idiomas de la interfaz con su nombre nativo (el selector no se traduce). */
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'es', name: 'Español' }, { id: 'en', name: 'English' }, { id: 'pt', name: 'Português' }, { id: 'fr', name: 'Français' },
];
const LANG_IDS = LANGS.map(l => l.id);
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANG_IDS as string[]).includes(v);
/** Etiqueta BCP 47 para `Intl` (`pt` es la variante brasileña). */
export const LOCALES: Record<Lang, string> = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR' };
/** Si a un diccionario le falta una clave, antes que la clave (español) se prueba este idioma. */
const FALLBACK: Partial<Record<Lang, Lang>> = { pt: 'en', fr: 'en' };

const dicts: Record<Lang, Record<string, string>> = { es: {}, en: {}, pt: {}, fr: {} };
/**
 * Los diccionarios se cargan bajo demanda (un trozo del bundle por idioma): quien usa la app en español no descarga
 * ninguno. `ready()` antes de pintar evita ver un instante en español; en Node/tests, `import '@all-draw/i18n/en'`
 * (o `/pt`, `/fr`). Portugués y francés cargan también el inglés, su respaldo.
 */
const LOADERS: Partial<Record<Lang, () => Promise<Record<string, string>>>> = {
  en: () => import('./en').then(m => m.en),
  pt: () => import('./pt').then(m => m.pt),
  fr: () => import('./fr').then(m => m.fr),
};
const loading = new Map<Lang, Promise<void>>();
export function ensureLang(l: Lang): Promise<void> {
  const load = LOADERS[l];
  if (!load) return Promise.resolve();
  let p = loading.get(l);
  if (!p) {
    const fb = FALLBACK[l];
    const own = load().then(d => addTranslations(l, d), () => { loading.delete(l); });
    p = fb ? Promise.all([own, ensureLang(fb)]).then(() => undefined) : own;
    loading.set(l, p);
  }
  return p;
}
/** Promesa que se cumple cuando el diccionario del idioma activo está cargado. */
export function ready(): Promise<void> { return ensureLang(current); }
const listeners = new Set<() => void>();
let current: Lang = detect();

/** Idioma de un `navigator.language`, `Accept-Language` o similar (`pt-BR` → `pt`); `null` si no es de los nuestros. */
export function langOf(tag: string | null | undefined): Lang | null {
  const base = (tag ?? '').trim().toLowerCase().split(/[-_,;]/)[0] ?? '';
  return isLang(base) ? base : null;
}

function detect(): Lang {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('alldraw:lang') : null;
    if (isLang(saved)) return saved;
    return (typeof navigator !== 'undefined' ? langOf(navigator.language) : null) ?? 'es';
  } catch { return 'es'; }
}

export function getLang(): Lang { return current; }
export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  void ensureLang(l);
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
  return interpolate(lookup(current, key), vars);
}

function lookup(lang: Lang, key: string): string {
  const own = dicts[lang][key];
  if (own !== undefined) return own;
  const fb = FALLBACK[lang];
  return (fb && dicts[fb][key]) ?? key;
}

/** Traduce a un idioma concreto (exportaciones, servidor). */
export function tIn(lang: Lang, key: string, vars?: Vars): string {
  return interpolate(lookup(lang, key), vars);
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

/** Claves en español que no tienen traducción propia en `lang`, sin contar el respaldo (para tests y para completar diccionarios). */
export function missing(lang: Lang, keys: Iterable<string>): string[] {
  const d = dicts[lang];
  return [...keys].filter(k => !(k in d));
}

const pluralRules = new Map<Lang, Intl.PluralRules>();
/** ¿`n` va en singular en `lang`? Con `Intl.PluralRules`: en francés y portugués 0 también es singular («0 commentaire»). */
export function isSingular(n: number, lang: Lang = current): boolean {
  let r = pluralRules.get(lang);
  if (!r) { r = new Intl.PluralRules(LOCALES[lang]); pluralRules.set(lang, r); }
  return r.select(n) === 'one';
}

/**
 * Plural: elige `singular` o `plural` según la regla del idioma activo (`Intl.PluralRules`: categoría `one` →
 * singular; el resto → plural) y lo traduce con `{n}` y `vars`. Las dos claves son textos en español
 * (`'{n} respuesta'`, `'{n} respuestas'`); cada diccionario tiene las dos.
 */
export function tn(singular: string, plural: string, n: number, vars?: Vars): string {
  return t(isSingular(n) ? singular : plural, { n, ...vars });
}

/** Fecha (y hora, por defecto) en el formato del idioma activo. Acepta ISO, milisegundos o `Date`. */
export function formatDate(d: string | number | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }, lang: Lang = current): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  try { return date.toLocaleString(LOCALES[lang], opts); } catch { return date.toISOString().slice(0, 16).replace('T', ' '); }
}

/** Número con los separadores del idioma activo (`1 234,5` en francés). */
export function formatNumber(n: number, opts?: Intl.NumberFormatOptions, lang: Lang = current): string {
  try { return n.toLocaleString(LOCALES[lang], opts); } catch { return String(n); }
}

/**
 * Mensaje traducible con estructura (diagnósticos, sugerencias, avisos): `key` es el texto en español con `{var}`
 * y cada variable puede ser otro mensaje, que se traduce antes de interpolarlo.
 */
export interface Msg { key: string; vars?: MsgVars }
export type MsgVars = Record<string, string | number | Msg>;

const isMsg = (v: unknown): v is Msg => typeof v === 'object' && v !== null && typeof (v as Msg).key === 'string';

/** Traduce un mensaje estructurado (o una clave con variables, algunas de ellas mensajes) al idioma activo. */
export function tMsg(m: Msg): string;
export function tMsg(key: string, vars?: MsgVars): string;
export function tMsg(a: Msg | string, b?: MsgVars): string {
  const { key, vars } = typeof a === 'string' ? { key: a, vars: b } : a;
  if (!vars) return t(key);
  const flat: Vars = {};
  for (const [k, v] of Object.entries(vars)) flat[k] = isMsg(v) ? tMsg(v) : v;
  return t(key, flat);
}
