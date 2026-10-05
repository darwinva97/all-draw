// Idiomas de la interfaz: recorre las pantallas principales en español, inglés, portugués y francés y falla si en los
// elementos de interfaz aparecen palabras de otro idioma (restos sin traducir), si el idioma no se detecta por el
// navegador o si un texto se sale de su caja.
//
// Uso: cd apps/web && pnpm dev --port 4361          (en otra terminal)
//      BASE=http://127.0.0.1:4361 node e2e/i18n.mjs   (capturas en $OUT/i18n-<lang>-*.png, por defecto /tmp/shots)
//
// Pantallas: portada, inicio (plantillas), una plantilla de ArchiMate, BPMN, C4 y ER, inspector, panel de problemas,
// menú Importar / Exportar, documentación (un capítulo traducido y otro con el aviso de «sin traducir») y Compartir.
// Compartir necesita el servidor de cuentas: si `BASE` no lo tiene (el `pnpm dev` de la web no lo lleva), arranca uno
// temporal con la web construida en `STATIC_DIR` (por defecto /tmp/alldraw-i18n-dist; si no existe, se omite).
//   pnpm --filter web build --outDir /tmp/alldraw-i18n-dist --emptyOutDir
// `LANGS=pt,fr` limita los idiomas.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './lib/server.mjs';

const base = (process.env.BASE ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const LANGS = (process.env.LANGS ?? 'es,en,pt,fr').split(',').map(s => s.trim()).filter(Boolean);
const LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR' };

// ---------------------------------------------------------------- Detección de textos de otro idioma
/**
 * Palabras españolas frecuentes en la interfaz que no existen (o no se usan) en portugués, francés ni inglés. Además,
 * cualquier palabra con ñ, ¿, ¡ o terminada en -ción/-sión. Las que son válidas en portugués (vista, buscar, abrir,
 * exportar, idioma, tipo, elemento…) no están: darían falsos positivos.
 */
const SPANISH = new Set(`añadir borrar guardar cerrar nuevo nueva nuevos plantilla plantillas relación relaciones espacio espacios elegir
  ningún ninguna también aquí cómo qué están puedes tienes pulsa arrastra hasta contraseña correo cuenta documentación atajos
  ayuda enlace enlaces deshacer rehacer lienzo cargando hay los las nombre crear seleccionar notación dimensión versión sesión
  conexión opción información según después ahora todavía siempre ejemplo cambiar salir usuario`.split(/\s+/).filter(Boolean));
/** Españolas que en inglés sí son palabras («sin», «con»…): sólo cuentan en portugués y francés. */
const SPANISH_NOT_EN = new Set(['sin', 'una', 'con', 'el']);
/** Palabras inglesas frecuentes de la interfaz (para pt y fr: un resto sin traducir o el respaldo inglés a la vista). */
const ENGLISH = new Set(`the and with your you save cancel close search settings workspace workspaces view views new add loading
  share help sign undo redo template templates nothing selected problems`.split(/\s+/).filter(Boolean));
/** Palabras que sí pueden salir: nombres propios y términos que se dejan en inglés (tipos de ArchiMate, Pool…). */
const ALLOW = { pt: new Set(['pool', 'lane', 'gateway', 'snapshot', 'snapshots', 'template', 'templates', 'viewpoint', 'viewpoints']), fr: new Set(['pool', 'viewpoint', 'viewpoints']), en: new Set(), es: new Set(['pool', 'lane', 'viewpoint', 'viewpoints']) };

/** Textos de interfaz visibles: texto de la página sin el contenido del usuario ni del manual, y aria-label/title/placeholder. */
async function uiTexts(page, { skipArticle = false } = {}) {
  return page.evaluate((skipArticle) => {
    const SKIP = 'select, option, code, pre, kbd, textarea, input, .react-flow__node, .react-flow__edge, .ad-cm-body, .ws__name, .lang-select, svg text, .docs-search__hits' + (skipArticle ? ', .docs-article > :not(.docs-fallback):not(.docs-crumb):not(.docs-pager):not(.docs-article__foot), .docs-toc' : '');
    const out = [];
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent.trim();
      if (!text || !el || el.closest(SKIP) || !visible(el)) continue;
      out.push({ where: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), text });
    }
    for (const el of document.querySelectorAll('[aria-label], [title], [placeholder]')) {
      if (el.closest(SKIP.replace('input, ', '').replace('textarea, ', '')) || !visible(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder']) { const v = el.getAttribute(a); if (v) out.push({ where: `${el.tagName.toLowerCase()}[${a}]`, text: v }); }
    }
    return out;
  }, skipArticle);
}

function foreignWords(lang, items) {
  const bad = [];
  for (const { where, text } of items) {
    // Fuera: `código` y siglas en mayúsculas (AND, XOR, API…), que no son de ningún idioma.
    const words = text.replace(/`[^`]*`/g, ' ').replace(/\b\p{Lu}{2,}\b/gu, ' ').toLowerCase().match(/[\p{L}¿¡]+(?:[-'’][\p{L}]+)*/gu) ?? []; // «mostrá-los», «l'espace»: una palabra
    for (const w of words) {
      if (ALLOW[lang].has(w)) continue;
      const es = lang !== 'es' && (SPANISH.has(w) || (lang !== 'en' && SPANISH_NOT_EN.has(w)) || /ñ|¿|¡/.test(w) || /[a-z](?:ción|sión)(?:es)?$/.test(w));
      const en = (lang === 'pt' || lang === 'fr' || lang === 'es') && ENGLISH.has(w);
      if (es || en) bad.push(`${where}: «${w}» en «${text.slice(0, 90)}»`);
    }
  }
  return [...new Set(bad)];
}

/** Elementos de interfaz cuyo texto se sale de su caja (cortado sin puntos suspensivos o desbordando). */
async function overflowing(page) {
  return page.evaluate(() => {
    const sel = 'button, [role=tab], [role=menuitem], label, .btn, .ad-btn, .ad-tab, .chip, th, .ad-section, h1, h2, h3, .tpl__name, .lp-hero p, .docs-fallback';
    const res = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('.react-flow__node, .react-flow__edge, [hidden], .visually-hidden') || !el.textContent?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.textOverflow === 'ellipsis') continue; // recorte deliberado (con título)
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) res.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} «${el.textContent.trim().slice(0, 50)}» (${el.scrollWidth}>${el.clientWidth})`);
    }
    return [...new Set(res)];
  });
}

// ---------------------------------------------------------------- Recorrido
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = [];
const check = (ok, name, detail = []) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) { fails.push(name); for (const d of detail.slice(0, 12)) console.log('       ' + d); }
};

async function screen(page, lang, name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 350);
  await page.screenshot({ path: `${out}/i18n-${lang}-${name}.png`, fullPage: !!opts.full });
  const words = foreignWords(lang, await uiTexts(page, opts));
  check(words.length === 0, `${lang} ${name}: sin textos de otro idioma`, words);
  const over = await overflowing(page);
  check(over.length === 0, `${lang} ${name}: ningún texto se sale de su caja`, over);
}

const errors = [];
for (const lang of LANGS) {
  console.log(`== ${lang}`);
  const ctx = await browser.newContext({ locale: LOCALE[lang], viewport: { width: 1440, height: 900 } });
  // Sin preferencia guardada: el idioma sale de navigator.language. Sin recorrido guiado.
  await ctx.addInitScript(() => { try { localStorage.setItem('alldraw:tour', 'done'); } catch { /* */ } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${lang} pageerror: ${e.message}`));

  // Portada
  await page.goto(base + '/#/bienvenida', { waitUntil: 'networkidle' });
  await page.waitForSelector('.lp-hero h1');
  check(await page.evaluate(() => document.documentElement.lang) === lang, `${lang}: <html lang> detectado del navegador`);
  check(await page.locator('.lang-select').first().inputValue() === lang, `${lang}: selector de idioma en la portada`);
  check(await page.locator('.lang-select').first().locator('option').count() === 4, `${lang}: el selector tiene los cuatro idiomas`);
  await screen(page, lang, 'portada', { wait: 800 });

  // Inicio con todas las plantillas
  await page.goto(base + '/#/espacios');
  await page.waitForSelector('.tpl-grid');
  if (await page.locator('.tpl__more[aria-expanded="false"]').count()) await page.locator('.tpl__more').click();
  await screen(page, lang, 'inicio', { full: true });

  // Plantillas: ArchiMate (inspector, problemas, importar/exportar), BPMN, C4 y ER
  for (const id of ['archimate', 'bpmn', 'c4', 'er']) {
    await page.goto(base + '/#/espacios');
    await page.waitForSelector('.tpl-grid');
    if (await page.locator('.tpl__more[aria-expanded="false"]').count()) await page.locator('.tpl__more').click();
    await page.locator(`.tpl[data-tpl="${id}"]`).click();
    await page.waitForURL(/#\/w\//);
    await page.waitForSelector('.react-flow__node', { timeout: 15000 });
    check(await page.locator('.lang-select').count() > 0, `${lang} ${id}: selector de idioma en el editor`);
    await screen(page, lang, `editor-${id}`, { wait: 900 });
    if (id !== 'archimate') continue;
    await page.locator('.react-flow__node', { hasText: 'Business Service' }).first().click(); // nombre de tipo ArchiMate: igual en todos los idiomas
    await page.waitForSelector('.ad-insp');
    await screen(page, lang, 'inspector');
    const tabs = page.locator('.ad-insp [role=tab]');
    for (let i = 1; i < await tabs.count(); i++) { await tabs.nth(i).click(); await screen(page, lang, `inspector-${i + 1}`, { wait: 250 }); }
    await page.locator('.ad-problems__bar').click();
    await screen(page, lang, 'problemas');
    await page.locator('.ad-problems__bar').click();
    await page.locator('button[aria-haspopup="menu"]').filter({ has: page.locator('svg') }).filter({ hasText: /\// }).first().click();
    await page.waitForSelector('[role="menu"]');
    await screen(page, lang, 'importar-exportar');
    await page.keyboard.press('Escape');
  }

  // Documentación: capítulo traducido y capítulo con aviso (pt/fr muestran el inglés)
  await page.goto(base + '/#/docs/conceptos');
  await page.waitForSelector('.docs-article h1');
  check(await page.locator('#docs-lang option').count() === 4, `${lang}: selector de idioma en la documentación`);
  check(await page.locator('.docs-fallback').count() === 0, `${lang} docs conceptos: traducido (sin aviso)`);
  check(await page.locator('.docs-article').getAttribute('lang') === lang, `${lang} docs conceptos: el texto está en ${lang}`);
  // El texto de los capítulos en es/en cita a propósito nombres del otro idioma (la demo); en pt/fr se comprueba entero.
  await screen(page, lang, 'docs-conceptos', { skipArticle: lang === 'es' || lang === 'en' });
  await page.goto(base + '/#/docs/editor');
  await page.waitForSelector('.docs-article h1');
  const fallback = lang === 'pt' || lang === 'fr';
  check(await page.locator('.docs-fallback').count() === (fallback ? 1 : 0), `${lang} docs editor: ${fallback ? 'aviso de capítulo sin traducir' : 'sin aviso'}`);
  if (fallback) check(await page.locator('.docs-article').getAttribute('lang') === 'en', `${lang} docs editor: se muestra la versión inglesa`);
  await screen(page, lang, 'docs-editor', { skipArticle: fallback });
  await ctx.close();
}

// ---------------------------------------------------------------- Compartir (servidor de cuentas)
const hasApi = await fetch(base + '/api/status').then(r => r.ok && /json/.test(r.headers.get('content-type') ?? ''), () => false);
let srv = null;
if (!hasApi) {
  const staticDir = process.env.STATIC_DIR ?? '/tmp/alldraw-i18n-dist';
  if (existsSync(join(staticDir, 'index.html'))) {
    const saved = process.env.BASE; delete process.env.BASE;
    srv = await startServer({ staticDir });
    process.env.BASE = saved;
  } else console.log(`skip Compartir: ${base} no tiene /api y no hay build en ${staticDir}`);
}
const apiBase = hasApi ? base : srv?.base;
if (apiBase) {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ locale: LOCALE[lang], viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('alldraw:tour', 'done'); } catch { /* */ } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${lang} pageerror: ${e.message}`));
    // Registro por la API (con el Accept-Language del navegador) y demo en el servidor desde el inicio
    await page.goto(apiBase + '/#/espacios', { waitUntil: 'networkidle' });
    const email = `i18n-${lang}-${Date.now()}@example.com`;
    const reg = await page.evaluate(async ({ email, lang }) => {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'all-draw', 'accept-language': lang }, body: JSON.stringify({ email, name: 'Ana', password: 'una-contraseña-larga-123' }) });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, { email, lang });
    check(reg.status < 300, `${lang}: registro en el servidor (${reg.status})`);
    check(reg.body?.user?.locale === lang, `${lang}: el idioma de los correos de la cuenta sale del navegador (${reg.body?.user?.locale})`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.tpl-grid');
    await page.locator('.tpl[data-tpl="demo"]').click();
    await page.waitForURL(/#\/s\//, { timeout: 20000 });
    await page.waitForSelector('.react-flow__node', { timeout: 20000 });
    await page.locator('button[data-tour="share"]').click();
    await page.waitForSelector('#share-title');
    await screen(page, lang, 'compartir');
    await ctx.close();
  }
}
if (srv) await srv.stop();

await browser.close();
check(errors.length === 0, 'sin errores de página', errors);
console.log(fails.length ? `\n${fails.length} fallos` : '\nok');
process.exit(fails.length ? 1 : 0);
