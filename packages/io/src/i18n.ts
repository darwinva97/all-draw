/**
 * Textos de `@all-draw/io` (avisos y errores de importar/exportar, HTML exportado, `<desc>` del SVG) en el idioma
 * de quien lo usa. La clave es el texto en español con `{var}` (el mismo convenio que `@all-draw/i18n`); por defecto
 * se interpola en español. El paquete no depende de React ni de `@all-draw/i18n`, y en el servidor (sin traductor)
 * todo sale en español, como antes. Dos formas de inyectar el traductor:
 * - `setIoTranslator(t, getLang)` (tests, CLI, quien ya tenga io cargado);
 * - `globalThis[Symbol.for(IO_TRANSLATOR_KEY)] = { t, lang }`: la web lo hace al arrancar **sin importar io**, que se
 *   carga bajo demanda (así io no entra en el paquete inicial).
 */
export type IoVars = Record<string, string | number>;
export type IoTranslate = (key: string, vars?: IoVars) => string;
/** Variables tal como llegan de los importadores (un atributo ausente se escribe como antes: `undefined`). */
export type IoLooseVars = Record<string, string | number | null | undefined>;

const interpolate: IoTranslate = (key, vars) => (vars ? key.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : key);

/** Nombre (para `Symbol.for`) del traductor global que la aplicación puede dejar antes de cargar io. */
export const IO_TRANSLATOR_KEY = 'all-draw.io.translator';
interface GlobalTranslator { t: IoTranslate; lang?: () => string }
const fromGlobal = (): GlobalTranslator | undefined => (globalThis as Record<symbol, GlobalTranslator | undefined>)[Symbol.for(IO_TRANSLATOR_KEY)];

let explicit: GlobalTranslator | null = null;
const translate: IoTranslate = (key, vars) => (explicit ?? fromGlobal())?.t(key, vars) ?? interpolate(key, vars);
const langOf = (): string => (explicit ?? fromGlobal())?.lang?.() ?? 'es';

/** Inyecta el traductor (p. ej. `t` de `@all-draw/i18n`) y el idioma activo (para `lang` del HTML y las fechas); `null` lo quita. */
export function setIoTranslator(t: IoTranslate | null, lang?: () => string): void {
  explicit = t ? { t, ...(lang ? { lang } : {}) } : null;
}

/** Traduce una clave (texto en español con `{var}`) con el traductor inyectado. */
export function tr(key: string, vars?: IoLooseVars): string {
  if (!vars) return translate(key);
  const clean: IoVars = {};
  for (const [k, v] of Object.entries(vars)) clean[k] = typeof v === 'number' ? v : String(v);
  return translate(key, clean);
}

/** Idioma activo (`es` si nadie lo ha inyectado). */
export const ioLang = (): string => langOf();

const pluralRules = new Map<string, Intl.PluralRules | null>();
/** ¿`n` va en singular en el idioma activo? `Intl.PluralRules` (en francés y portugués también 0); sin `Intl`, sólo 1. */
function singular(n: number): boolean {
  const lang = langOf();
  let r = pluralRules.get(lang);
  if (r === undefined) { try { r = new Intl.PluralRules(lang); } catch { r = null; } pluralRules.set(lang, r); }
  return r ? r.select(n) === 'one' : n === 1;
}

/** Plural: `singular` o `plural` según la regla del idioma activo (las dos claves en español, con `{n}`). */
export const trn = (singularKey: string, plural: string, n: number, vars?: IoLooseVars): string => tr(singular(n) ? singularKey : plural, { n, ...vars });

/** Meses abreviados del idioma activo (`Intl`, zona UTC), para las cabeceras de fechas. */
export function ioMonths(lang: string = langOf()): string[] {
  try {
    const f = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => { const x = f.format(Date.UTC(2024, i, 15)); return lang.startsWith('pt') ? x.replace(/\.$/, '') : x; });
  } catch { return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; }
}
