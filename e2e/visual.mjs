// Regresión visual de las plantillas de la galería, con el chromium del sistema.
//
// Para cada plantilla del inicio (#/espacios), en tema claro y oscuro, captura:
//   lienzo  el lienzo del editor (`.ad-canvas`) en una ventana de 1280×800, tras «Ajustar a la vista»;
//   svg     el SVG que exporta Importar / Exportar → «SVG (tema claro y oscuro)», pintado en chromium con ese tema.
// y lo compara con `e2e/visual-baseline/<plantilla>-<tema>-<lienzo|svg>.png` (la plantilla en blanco no tiene SVG:
// la exportación de una vista vacía avisa en lugar de descargar). <plantilla> sale del nombre de la tarjeta en español
// (hasta los dos puntos), p. ej. `proceso-bpmn`, `c4`, `gantt`.
//
// Uso:
//   pnpm --filter web build --outDir /tmp/alldraw-dist --emptyOutDir
//   STATIC_DIR=/tmp/alldraw-dist pnpm e2e:visual            # compara (arranca su propio servidor en un puerto libre)
//   STATIC_DIR=/tmp/alldraw-dist pnpm e2e:visual:update     # UPDATE=1: regenera las referencias
//   BASE=http://127.0.0.1:4193 node e2e/visual.mjs          # contra un servidor ya lanzado
//
// Variables:
//   UPDATE=1             escribe las referencias en lugar de comparar (cada plantilla se captura hasta que dos intentos
//                        seguidos coinciden) y borra las que ya no corresponden a ninguna plantilla.
//   BASELINE_DIR         carpeta de referencias (por defecto e2e/visual-baseline).
//   DIFF_DIR             dónde dejar actual/esperada/diferencias de lo que no coincide (por defecto /tmp/visual-diff).
//   PIXEL_THRESHOLD      diferencia máxima por canal (0–255) para que un píxel cuente como igual. Por defecto 16.
//   MAX_DIFF_PCT         porcentaje máximo de píxeles distintos por imagen. Por defecto 0.01 (= 1 de cada 10 000).
//   ONLY                 subcadena: solo las plantillas cuyo nombre la contenga (p. ej. ONLY=bpmn).
//   THEMES               light,dark (por defecto ambos).
//   CONCURRENCY          páginas a la vez (por defecto 4).
//   RETRIES              repeticiones desde cero de una plantilla que no coincide (por defecto 2; ver runJob).
//   MISSING=warn         una referencia que falta solo avisa (por defecto falla).
//   ACCEPT=a,b           nombres de imagen (sin .png) cuyas diferencias se aceptan con aviso (la CI pasa aquí las
//                        referencias que el cambio actualiza a propósito).
//   STATIC_DIR / BASE    build que se sirve, o servidor ya lanzado (ver e2e/lib/server.mjs).
//
// Estabilidad: fontconfig propio que solo ve DejaVu (e2e/lib/stable.mjs), sin animaciones, transiciones ni cursor,
// `prefers-reduced-motion`, reloj fijo (la plantilla Gantt se fecha desde hoy), aleatoriedad con semilla (ids de las
// plantillas: el orden de los ids decide qué etiqueta de arista se aparta), zona horaria UTC, idioma de la app fijado en
// español, recorrido guiado marcado como visto, sin avisos, presencia ni nota de bienvenida de la plantilla, y cada
// captura se repite hasta que dos seguidas salen idénticas. Dos ejecuciones seguidas en la misma máquina dan 0 píxeles
// distintos.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './lib/server.mjs';
import { comparePng } from './lib/pixeldiff.mjs';
import { STABLE_ARGS, STABLE_CSS, fontconfigEnv, injectStableCss, seedRandom, stableShot } from './lib/stable.mjs';

const UPDATE = process.env.UPDATE === '1';
const BASELINE_DIR = process.env.BASELINE_DIR ?? new URL('./visual-baseline/', import.meta.url).pathname;
const DIFF_DIR = process.env.DIFF_DIR ?? '/tmp/visual-diff';
const PIXEL_THRESHOLD = Number(process.env.PIXEL_THRESHOLD ?? 16);
const MAX_DIFF_PCT = Number(process.env.MAX_DIFF_PCT ?? 0.01);
const ONLY = process.env.ONLY ?? '';
const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map(s => s.trim()).filter(Boolean);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 4));
const MISSING_WARN = process.env.MISSING === 'warn';
const RETRIES = Math.max(0, Number(process.env.RETRIES ?? 2));
const ACCEPT = new Set((process.env.ACCEPT ?? '').split(',').map(s => s.trim().replace(/\.png$/, '')).filter(Boolean));
const FIXED_TIME = new Date('2026-03-04T10:00:00Z');
const VIEWPORT = { width: 1280, height: 800 };

const t0 = Date.now();
mkdirSync(BASELINE_DIR, { recursive: true });
rmSync(DIFF_DIR, { recursive: true, force: true });
const srv = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: STABLE_ARGS, env: { ...process.env, ...fontconfigEnv() } });

const slug = (s) => s.split(':')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function newContext(theme) {
  const ctx = await browser.newContext({
    locale: 'es-ES', timezoneId: 'UTC', viewport: VIEWPORT, deviceScaleFactor: 1,
    colorScheme: theme, reducedMotion: 'reduce', acceptDownloads: true,
  });
  await ctx.addInitScript((theme) => {
    localStorage.setItem('alldraw:tour', 'done');
    localStorage.setItem('alldraw:lang', 'es');
    localStorage.setItem('alldraw:theme', theme);
  }, theme);
  // La nota «Sobre esta plantilla» tapa parte del lienzo: fuera, para comparar solo el diagrama.
  await ctx.addInitScript(injectStableCss, STABLE_CSS + '.ad-welcome { display: none !important; }');
  await ctx.addInitScript(seedRandom, 20260304);
  await ctx.clock.setFixedTime(FIXED_TIME);
  return ctx;
}

async function openGallery(page) {
  await page.goto(srv.base + '/#/espacios', { waitUntil: 'networkidle' });
  await page.waitForSelector('.tpl-grid');
  const more = page.getByRole('button', { name: /^(Ver las \d+ plantillas)$/ });
  if (await more.count()) await more.click();
}

// Lista de plantillas, tal y como la pinta la galería del build que se sirve.
const listCtx = await newContext('light');
const listPage = await listCtx.newPage();
await openGallery(listPage);
const names = await listPage.locator('.tpl .tpl__name').allInnerTexts();
await listCtx.close();
const seen = new Map();
const templates = names.map((name, index) => {
  let id = slug(name) || `plantilla-${index + 1}`;
  if (seen.has(id)) id += `-${index + 1}`;
  seen.set(id, true);
  return { index, name, id };
}).filter(tp => !ONLY || tp.id.includes(ONLY) || tp.name.toLowerCase().includes(ONLY.toLowerCase()));
if (!templates.length) { console.error(`No hay plantillas${ONLY ? ` que coincidan con «${ONLY}»` : ''}.`); process.exit(1); }
console.log(`${templates.length} plantillas × ${THEMES.length} temas · ${UPDATE ? 'regenerando referencias' : `comparando (umbral por píxel ${PIXEL_THRESHOLD}, máximo ${MAX_DIFF_PCT} % de píxeles)`} · ${srv.base}`);

const produced = new Set();
const failures = [], warnings = [];

/** Compara (o, con UPDATE=1, escribe) una captura. Devuelve `{ ok, label, note?, files? }` sin tocar los contadores. */
function check(name, png) {
  const file = join(BASELINE_DIR, `${name}.png`);
  if (UPDATE) { writeFileSync(file, png); return { ok: true, label: 'escrita' }; }
  if (!existsSync(file)) {
    const note = `${name}: sin referencia (genera con UPDATE=1)`;
    return { ok: MISSING_WARN, warn: MISSING_WARN, label: MISSING_WARN ? 'nueva' : 'FALTA', note, files: { actual: png } };
  }
  const expected = readFileSync(file);
  if (expected.equals(png)) return { ok: true, label: 'ok' };
  const r = comparePng(expected, png, { pixelThreshold: PIXEL_THRESHOLD });
  const pct = r.ratio * 100;
  const detail = `${r.diffPixels} px (${pct.toFixed(4)} %, Δmáx ${r.maxDelta})${r.sameSize ? '' : `, tamaño ${r.expectedSize} → ${r.actualSize}`}`;
  if (r.sameSize && pct <= MAX_DIFF_PCT) return { ok: true, label: r.diffPixels ? `ok ~${r.diffPixels}px` : 'ok' };
  const files = { actual: png, expected, diff: r.diffPng };
  if (ACCEPT.has(name)) return { ok: true, warn: true, label: 'aceptada', note: `${name}: ${detail} (aceptada: la referencia cambia en este commit)`, files };
  return { ok: false, label: 'DISTINTA', note: `${name}: ${detail}`, files };
}

function saveDiff(name, files) {
  if (!files) return;
  mkdirSync(DIFF_DIR, { recursive: true });
  for (const [kind, png] of Object.entries(files)) writeFileSync(join(DIFF_DIR, `${name}-${kind}.png`), png);
}

/** Abre la plantilla en un contexto nuevo y devuelve `[[nombre, png], …]` (lienzo y, si hay nodos, SVG). */
async function capture({ tp, theme }) {
  const ctx = await newContext(theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const results = [];
  try {
    await openGallery(page);
    const card = page.locator('.tpl').nth(tp.index);
    const got = (await card.locator('.tpl__name').innerText()).trim();
    if (got !== tp.name) throw new Error(`la tarjeta ${tp.index + 1} es «${got}», se esperaba «${tp.name}»`);
    await card.click();
    await page.waitForURL(/#\/w\//);
    await page.waitForSelector('.ad-canvas .react-flow__renderer', { timeout: 20000 });
    const hasNodes = await page.waitForSelector('.react-flow__node', { timeout: 4000 }).then(() => true, () => false);
    // Encuadre: «Ajustar a la vista» y fuera el foco y el ratón (sin estados hover/focus sobre el lienzo).
    const fit = page.getByRole('button', { name: 'Ajustar a la vista' });
    if (hasNodes && await fit.count()) await fit.first().click();
    await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);
    await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
    await page.waitForTimeout(400); // duración del encuadre animado (300 ms)
    results.push([`${tp.id}-${theme}-lienzo`, await stableShot(page, page.locator('.ad-canvas'))]);

    if (hasNodes) {
      await page.getByRole('button', { name: /^Importar \/ Exportar/ }).click();
      await page.waitForSelector('[role="menu"]');
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.getByRole('menuitem', { name: /^SVG/ }).click(),
      ]);
      const svg = readFileSync(await download.path(), 'utf8');
      const view = await ctx.newPage();
      await view.setViewportSize({ width: 800, height: 600 });
      await view.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}body>svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: 'load' });
      results.push([`${tp.id}-${theme}-svg`, await stableShot(view, view.locator('body > svg'), { omitBackground: true })]);
    }
    if (errors.length) warnings.push(`${tp.id} (${theme}): errores de página: ${errors.slice(0, 3).join(' | ')}`);
    return results;
  } catch (e) {
    mkdirSync(DIFF_DIR, { recursive: true });
    await page.screenshot({ path: join(DIFF_DIR, `${tp.id}-${theme}-error.png`) }).catch(() => {});
    throw e;
  } finally {
    await ctx.close();
  }
}

/**
 * Una plantilla en un tema. Si algo no coincide se repite desde cero hasta RETRIES veces: la colocación de etiquetas
 * de aristas que se solapan depende del orden en que se miden (p. ej. la máquina de estados), y de vez en cuando sale la
 * otra variante. Lo que solo coincide al reintentar se avisa como inestable.
 */
async function runJob(job) {
  if (UPDATE) return updateJob(job);
  const failed = [];
  for (let attempt = 0; ; attempt++) {
    let results, error = null;
    try { results = await capture(job); } catch (e) { error = e; }
    const checks = results?.map(([name, png]) => [name, check(name, png)]) ?? [];
    const bad = error || checks.some(([, c]) => !c.ok);
    if (bad && attempt < RETRIES) {
      failed.push(error ? `error: ${error.message.split('\n')[0]}` : checks.filter(([, c]) => !c.ok).map(([, c]) => c.note).join('; '));
      continue;
    }
    if (error) failures.push(`${job.tp.id} (${job.theme}): ${error.message.split('\n')[0]}`);
    for (const [name, c] of checks) {
      produced.add(name);
      if (!c.ok) failures.push(c.note); else if (c.warn) warnings.push(c.note);
      if (!c.ok || c.warn) saveDiff(name, c.files);
      console.log(`  ${c.label.padEnd(9)} ${name}`);
    }
    if (!bad && failed.length) warnings.push(`inestable, coincide al intento ${attempt + 1}: ${failed.join(' | ')}`);
    return;
  }
}

/** UPDATE=1: captura hasta que dos intentos seguidos dan las mismas imágenes (descarta variantes ocasionales). */
async function updateJob(job) {
  let prev = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let results;
    try { results = await capture(job); } catch (e) {
      if (attempt < 3) continue;
      failures.push(`${job.tp.id} (${job.theme}): ${e.message.split('\n')[0]}`); return;
    }
    const same = prev && prev.length === results.length && prev.every(([n, png], i) => n === results[i][0] && png.equals(results[i][1]));
    if (same || attempt === 3) {
      if (!same) warnings.push(`${job.tp.id} (${job.theme}): no salen dos capturas iguales seguidas; se guarda la última`);
      for (const [name, png] of results) { produced.add(name); check(name, png); console.log(`  escrita   ${name}`); }
      return;
    }
    prev = results;
  }
}

const jobs = THEMES.flatMap(theme => templates.map(tp => ({ tp, theme })));
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
  while (next < jobs.length) await runJob(jobs[next++]);
}));

await browser.close();
await srv.stop();

// Referencias que ya no corresponden a ninguna plantilla (solo con la galería entera y ambos temas).
const full = !ONLY && THEMES.includes('light') && THEMES.includes('dark') && !failures.length;
const stale = full ? readdirSync(BASELINE_DIR).filter(f => f.endsWith('.png') && !produced.has(f.slice(0, -4))) : [];
if (UPDATE) for (const f of stale) rmSync(join(BASELINE_DIR, f));
else for (const f of stale) warnings.push(`${f}: referencia sin plantilla (bórrala o regenera con UPDATE=1)`);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
for (const w of warnings) console.log('⚠ ' + w);
if (failures.length) {
  for (const f of failures) console.log('✗ ' + f);
  console.log(`\n${failures.length} fallo(s) de ${produced.size} imágenes en ${secs} s. Diferencias en ${DIFF_DIR}/ (<nombre>-diff.png en rojo).`);
  console.log('Si el cambio es intencionado: UPDATE=1 node e2e/visual.mjs (o pnpm e2e:visual:update) y revisa las imágenes nuevas.');
  process.exit(1);
}
console.log(`\nOK: ${produced.size} imágenes ${UPDATE ? `escritas en ${BASELINE_DIR}${stale.length ? ` (${stale.length} obsoletas borradas)` : ''}` : 'iguales a las referencias'} en ${secs} s.`);
