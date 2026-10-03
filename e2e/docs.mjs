// Centro de documentación (#/docs) con el chromium del sistema.
//
// En español (`es-ES`) y en inglés (`en-US`) recorre todos los capítulos de la barra lateral y comprueba:
//   1. cada capítulo pinta exactamente un `h1` (y no se queda en "cargando");
//   2. ningún enlace interno `#/docs/...` apunta a un capítulo inexistente ni a un ancla que no existe;
//   3. ninguna imagen está rota (naturalWidth > 0);
//   4. no hay errores de página (pageerror / console.error);
//   5. la búsqueda encuentra "pines" y, al abrir el primer resultado, el término queda resaltado;
//   6. en móvil (390 px) el menú abre la barra lateral y no hay desbordamiento horizontal; al abrirla el foco va al
//      capítulo actual, lo de detrás es `inert`, y Escape la cierra y devuelve el foco al botón del menú;
//   7. una consulta de una letra pide más letras (no «nada coincide»), «año» no encuentra «huérfano», y todo
//      `aria-controls` apunta a un id que existe; «Saltar al contenido» en oscuro tiene contraste ≥ 4.5.
// En inglés, los capítulos que caen al español (sin traducción) se listan como aviso.
// Capturas en /tmp/shots/docs-*.png.
//
// Cómo lanzarlo:
//   cd apps/web && pnpm dev --port 4310           # en otra terminal
//   BASE=http://127.0.0.1:4310 node e2e/docs.mjs   # BASE por defecto: http://127.0.0.1:4310
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4173';
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

  // Consultas cortas y ñ.
  await go(page, '#/docs');
  await page.fill('.docs-search input', 'a');
  await page.waitForTimeout(250);
  const shortMsg = await page.$eval('.docs-search__pop', e => e.textContent).catch(() => '');
  if (!/2/.test(shortMsg) || /Nada coincide|Nothing matches/i.test(shortMsg)) fail(`[${lang}] búsqueda de una letra: «${shortMsg}»`);
  if (lang === 'es') {
    await page.fill('.docs-search input', 'año');
    await page.waitForTimeout(600);
    const snips = await page.$$eval('.docs-search [role="option"]', o => o.map(x => x.textContent.toLowerCase()));
    const bad = snips.filter(t => !t.includes('año'));
    if (bad.length) fail(`[es] «año» encuentra resultados sin «año»: ${bad[0].slice(0, 80)}`);
    else console.log(`  ✓ búsqueda "año": ${snips.length} resultados, ninguno por «huérfano»`);
  }
  const dangling = await page.evaluate(() => [...document.querySelectorAll('[aria-controls]')].flatMap(e => e.getAttribute('aria-controls').split(/\s+/)).filter(id => !document.getElementById(id)));
  if (dangling.length) fail(`[${lang}] aria-controls sin destino: ${dangling.join(', ')}`);
  await page.fill('.docs-search input', '');
  await page.keyboard.press('Escape');

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
  const skipRatio = await page.$eval('.docs-skip', el => {
    const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    const cs = getComputedStyle(el), a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  if (skipRatio < 4.5) fail(`[${lang}] «Saltar al contenido» en oscuro: contraste ${skipRatio.toFixed(2)}`);
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
  // Foco en el capítulo actual (la última página visitada es agentes-y-api), detrás `inert`, Escape cierra.
  const drawer = await page.evaluate(() => ({
    focused: document.activeElement?.getAttribute('aria-current') === 'page' ? document.activeElement.getAttribute('href') : document.activeElement?.textContent,
    mainInert: document.querySelector('#docs-content').inert,
    searchInert: document.querySelector('.docs-search').inert,
    menuInert: document.querySelector('.docs-header__menu').inert,
  }));
  if (drawer.focused !== '#/docs/agentes-y-api') fail(`[${lang}] móvil: al abrir el índice el foco va a «${drawer.focused}» y no al capítulo actual`);
  if (!drawer.mainInert || !drawer.searchInert || drawer.menuInert) fail(`[${lang}] móvil: con el índice abierto lo de detrás no es inert (${JSON.stringify(drawer)})`);
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  const tabbedOut = await page.evaluate(() => { const a = document.activeElement; return !!a && a !== document.body && !a.closest('#docs-nav') && !a.classList.contains('docs-header__menu'); });
  if (tabbedOut) fail(`[${lang}] móvil: con el índice abierto el tabulador sale al contenido de detrás`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const afterEsc = await page.evaluate(() => ({ open: document.querySelector('.docs').classList.contains('is-nav-open'), onMenu: document.activeElement?.classList.contains('docs-header__menu'), mainInert: document.querySelector('#docs-content').inert }));
  if (afterEsc.open || !afterEsc.onMenu || afterEsc.mainInert) fail(`[${lang}] móvil: Escape no cierra el índice o no devuelve el foco al menú (${JSON.stringify(afterEsc)})`);
  else console.log('  ✓ móvil: foco al capítulo actual, fondo inert, Escape devuelve el foco al menú');
  // Navegar desde el índice: se cierra y el foco pasa al contenido.
  await page.click('.docs-header__menu');
  await page.waitForTimeout(300);
  await page.click('#docs-nav a[href="#/docs/faq"]');
  await waitChapter(page);
  await page.waitForTimeout(200);
  const afterNav = await page.evaluate(() => ({ open: document.querySelector('.docs').classList.contains('is-nav-open'), inMain: !!document.activeElement?.closest('#docs-content'), inert: !!document.querySelector('.docs-search').inert }));
  if (afterNav.open || !afterNav.inMain || afterNav.inert) fail(`[${lang}] móvil: tras navegar desde el índice ${JSON.stringify(afterNav)}`);

  const relevant = errors.filter(e => !/favicon|manifest|registerSW|\/api\//i.test(e));
  for (const e of relevant) fail(`[${lang}] ${e}`);
  await ctx.close();
}

await browser.close();
for (const w of warnings) console.log('\n⚠ ' + w);
if (failures.length) { console.log(`\n${failures.length} fallo(s).`); process.exit(1); }
console.log(`\nOK. Capturas en ${SHOTS}/docs-*.png`);
