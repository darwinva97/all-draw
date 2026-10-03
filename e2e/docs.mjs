// Centro de documentación (#/docs) con el chromium del sistema.
//
// En español (`es-ES`) y en inglés (`en-US`) recorre todos los capítulos de la barra lateral y comprueba:
//   1. cada capítulo pinta exactamente un `h1` (y no se queda en "cargando");
//   2. ningún enlace interno `#/docs/...` apunta a un capítulo inexistente ni a un ancla que no existe;
//   3. ninguna imagen está rota (naturalWidth > 0);
//   4. no hay errores de página (pageerror / console.error);
//   5. la búsqueda encuentra "pines" y, al abrir el primer resultado, el término queda resaltado;
//   6. en móvil (390 px) el menú abre la barra lateral y no hay desbordamiento horizontal.
// En inglés, los capítulos que caen al español (sin traducción) se listan como aviso.
// Capturas en /tmp/shots/docs-*.png.
//
// Cómo lanzarlo:
//   cd apps/web && pnpm dev --port 4310           # en otra terminal
//   BASE=http://127.0.0.1:4310 node e2e/docs.mjs   # BASE por defecto: http://127.0.0.1:4310
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4310';
const SHOTS = '/tmp/shots';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const failures = [];
const warnings = [];
const fail = (m) => { failures.push(m); console.log('  ✗ ' + m); };
const shotName = (s) => s.replace(/[^\w-]+/g, '-');

async function waitChapter(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('#docs-content');
    return !!main && !main.querySelector('.docs-article--loading') && !!main.querySelector('h1');
  }, null, { timeout: 15000 });
  // Imágenes perezosas: que carguen todas antes de medir.
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#docs-content img')];
    imgs.forEach(i => { i.loading = 'eager'; });
    await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
  });
}

async function go(page, hash) {
  await page.evaluate(h => { location.hash = h; }, hash);
  await waitChapter(page);
}

for (const locale of ['es-ES', 'en-US']) {
  const lang = locale.slice(0, 2);
  console.log(`\n== ${locale}`);
  const ctx = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(`${base}/#/docs`);
  await waitChapter(page);
  await page.screenshot({ path: `${SHOTS}/docs-${lang}-index.png` });
  const slugs = await page.$$eval('#docs-nav a[href^="#/docs/"]', as => as.map(a => a.getAttribute('href').slice('#/docs/'.length)));
  if (slugs.length < 29) fail(`[${lang}] la barra lateral tiene ${slugs.length} capítulos (se esperaban 29)`);
  const known = new Set(slugs);
  const idsBySlug = new Map();
  const links = []; // { from, slug, anchor }
  const fallbacks = [];

  /** Reintenta si Vite recarga la página a mitad (HMR al cambiar un .md). */
  const retry = async (f) => { for (let i = 0; ; i++) { try { return await f(); } catch (e) { if (i >= 2 || !/context was destroyed|navigation/i.test(String(e))) throw e; await page.waitForTimeout(500); } } };
  for (const slug of slugs) {
    const info = await retry(async () => { await go(page, `#/docs/${slug}`); return page.evaluate(() => {
      const main = document.querySelector('#docs-content');
      return {
        h1: main.querySelectorAll('h1').length,
        title: main.querySelector('h1')?.textContent ?? '',
        ids: [...main.querySelectorAll('[id]')].map(e => e.id),
        links: [...main.querySelectorAll('a[href^="#/docs"]')].map(a => a.getAttribute('href')),
        broken: [...main.querySelectorAll('img')].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')),
        fallback: !!main.querySelector('.docs-fallback'),
        notFound: !!main.querySelector('.docs-article h1') && /no encontrada|not found/i.test(main.querySelector('h1').textContent),
      };
    }); });
    if (info.h1 !== 1) fail(`[${lang}] ${slug}: ${info.h1} h1`);
    if (info.notFound) fail(`[${lang}] ${slug}: página no encontrada`);
    for (const src of info.broken) fail(`[${lang}] ${slug}: imagen rota ${src}`);
    if (info.fallback) fallbacks.push(slug);
    idsBySlug.set(slug, new Set(info.ids));
    for (const href of info.links) {
      const m = /^#\/docs\/?([^?#]*)(?:\?[^#]*)?(?:#(.*))?$/.exec(href);
      if (!m) continue;
      links.push({ from: slug, slug: decodeURIComponent(m[1]), anchor: m[2] ? decodeURIComponent(m[2]) : null, href });
    }
    await page.screenshot({ path: `${SHOTS}/docs-${lang}-${shotName(slug)}.png` });
    console.log(`  ✓ ${slug}  «${info.title.trim()}»${info.fallback ? '  (español)' : ''}`);
  }

  for (const l of links) {
    if (l.slug === '') continue;
    if (!known.has(l.slug)) { fail(`[${lang}] ${l.from}: enlace a capítulo inexistente ${l.href}`); continue; }
    if (l.anchor && !idsBySlug.get(l.slug)?.has(l.anchor)) fail(`[${lang}] ${l.from}: ancla inexistente ${l.href}`);
  }
  console.log(`  enlaces internos comprobados: ${links.length}`);
  if (lang !== 'es' && fallbacks.length) warnings.push(`[${lang}] sin traducir (se muestra en español): ${fallbacks.join(', ')}`);

  // Búsqueda.
  const term = lang === 'es' ? 'pines' : 'pins';
  for (const q of lang === 'es' ? ['pines'] : ['pins', 'pines']) {
    await go(page, '#/docs');
    await page.fill('.docs-search input', q);
    try {
      await page.waitForSelector('.docs-search [role="option"]', { timeout: 10000 });
      const n = await page.$$eval('.docs-search [role="option"]', o => o.length);
      const marked = await page.$$eval('.docs-search [role="option"] .docs-mark', o => o.length);
      if (!marked) fail(`[${lang}] búsqueda "${q}": resultados sin resaltar`);
      console.log(`  ✓ búsqueda "${q}": ${n} resultados`);
      if (q === term) {
        await page.screenshot({ path: `${SHOTS}/docs-${lang}-search.png` });
        await page.keyboard.press('Enter');
        await waitChapter(page);
        const marks = await page.waitForSelector('.docs-article .docs-mark', { timeout: 8000 }).then(() => 1, () => 0);
        if (!marks) fail(`[${lang}] al abrir el resultado de "${q}" no hay texto resaltado`);
      }
    } catch {
      if (q === term || lang === 'es') fail(`[${lang}] la búsqueda no encuentra "${q}"`);
    }
  }

  // Tema oscuro (mismo almacenamiento que el editor) y explorador de la matriz.
  await page.evaluate(() => localStorage.setItem('alldraw:theme', 'dark'));
  await page.goto(`${base}/#/docs/notaciones/archimate`);
  await page.reload();
  await waitChapter(page);
  if (!(await page.$('.docs--dark'))) fail(`[${lang}] el tema oscuro no se aplica`);
  const matrix = await page.$('.docs-matrix');
  if (!matrix) fail(`[${lang}] notaciones/archimate: falta el explorador de la matriz`);
  else {
    await matrix.scrollIntoViewIfNeeded();
    const rels = await page.$$eval('.docs-matrix__list li', l => l.length);
    if (!rels) fail(`[${lang}] la matriz de ArchiMate no ofrece relaciones para el par inicial`);
    await page.screenshot({ path: `${SHOTS}/docs-${lang}-dark-archimate-matrix.png` });
  }
  await page.goto(`${base}/#/docs/conceptos`);
  await waitChapter(page);
  await page.screenshot({ path: `${SHOTS}/docs-${lang}-dark-conceptos.png` });
  await page.evaluate(() => localStorage.removeItem('alldraw:theme'));

  // Ancla directa (carga completa de la página).
  await page.goto(`${base}/#/docs/conceptos#pines`);
  await page.reload();
  await waitChapter(page);
  await page.waitForTimeout(200);
  const top = await page.evaluate(() => document.getElementById('pines')?.getBoundingClientRect().top ?? null);
  if (top === null) fail(`[${lang}] conceptos#pines: no existe el ancla`);
  else if (top < 0 || top > 200) fail(`[${lang}] conceptos#pines: el ancla no queda arriba (top=${Math.round(top)})`);

  // Referencia de la API: con /api/openapi.json real (el de producción, servido por intercepción si el servidor de
  // desarrollo no tiene API) la página lista endpoints agrupados.
  const spec = await fetch(process.env.OPENAPI_URL ?? 'https://alldraw.bezenti.com/api/openapi.json').then(r => r.ok ? r.text() : null).catch(() => null);
  if (spec) {
    await page.route('**/api/openapi.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: spec }));
    await page.goto(`${base}/#/docs/agentes-y-api#endpoints`);
    await page.reload();
    await waitChapter(page);
    try {
      await page.waitForSelector('.docs-api__group li', { timeout: 10000 });
      const n = await page.$$eval('.docs-api__group li', l => l.length);
      const groups = await page.$$eval('.docs-api__group', g => g.length);
      if (n < 10) fail(`[${lang}] referencia de la API: solo ${n} endpoints`);
      console.log(`  ✓ referencia de la API: ${n} endpoints en ${groups} grupos`);
      await page.$eval('.docs-api', e => e.scrollIntoView());
      await page.screenshot({ path: `${SHOTS}/docs-${lang}-api-ref.png` });
    } catch { fail(`[${lang}] la referencia de la API no lista endpoints`); }
    await page.unroute('**/api/openapi.json');
  } else warnings.push('no se pudo descargar openapi.json de producción: referencia de la API sin comprobar');

  // Móvil.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ['', 'editor', 'notaciones/bpmn', 'agentes-y-api']) {
    await go(page, `#/docs${slug ? '/' + slug : ''}`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 1) fail(`[${lang}] móvil ${slug || 'índice'}: desborda ${over}px en horizontal`);
    await page.screenshot({ path: `${SHOTS}/docs-${lang}-mobile-${shotName(slug || 'index')}.png` });
  }
  await page.click('.docs-header__menu');
  await page.waitForTimeout(350);
  const navVisible = await page.evaluate(() => { const r = document.querySelector('#docs-nav').getBoundingClientRect(); return r.left >= 0 && r.width > 200; });
  if (!navVisible) fail(`[${lang}] móvil: el menú no abre la barra lateral`);
  await page.screenshot({ path: `${SHOTS}/docs-${lang}-mobile-menu.png` });

  const relevant = errors.filter(e => !/favicon|manifest|registerSW|\/api\//i.test(e));
  for (const e of relevant) fail(`[${lang}] ${e}`);
  await ctx.close();
}

await browser.close();
for (const w of warnings) console.log('\n⚠ ' + w);
if (failures.length) { console.log(`\n${failures.length} fallo(s).`); process.exit(1); }
console.log(`\nOK. Capturas en ${SHOTS}/docs-*.png`);
