// Medición en navegador con el chromium del sistema: crea el espacio grande (1.000 elementos × 50
// vistas, `?bench=1`), mide el tiempo hasta pintar la primera vista de 60 nodos y el de cambiar entre
// 5 vistas. Imprime los números (y JSON con OUT=fichero). Requiere `pnpm dev --port 4195` en apps/web.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:4195';
const out = process.env.OUT ?? '';
const PER_VIEW = 60;
const SWITCHES = 5;

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

/** Espera a que haya ≥ n nodos pintados cuyo primer id sea distinto de `prevFirst`, y a dos frames más (pintado real). */
const waitPainted = (n, prevFirst) => page.waitForFunction(({ n, prevFirst }) => {
  const nodes = document.querySelectorAll('.react-flow__node');
  if (nodes.length < n) return false;
  return nodes[0].getAttribute('data-id') !== prevFirst;
}, { n, prevFirst }, { timeout: 60000 }).then(() => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))))));

await page.goto(base + '/?bench=1#/', { waitUntil: 'networkidle' });
const create = page.locator('[data-bench="create"]');
await create.waitFor({ timeout: 15000 });

// 1) Crear el espacio y pintar la primera vista (incluye generar, cargar en Yjs/IndexedDB, abrir y montar el editor).
await page.evaluate(() => performance.mark('bench:create'));
const t0 = Date.now();
await create.click();
await page.waitForURL(/#\/w\//, { timeout: 60000 });
const tUrl = Date.now() - t0;
await waitPainted(PER_VIEW, null);
const firstPaint = Date.now() - t0;
await page.evaluate(() => { performance.mark('bench:painted'); performance.measure('bench:create→painted', 'bench:create', 'bench:painted'); });
const createToPainted = await page.evaluate(() => performance.getEntriesByName('bench:create→painted', 'measure')[0]?.duration ?? null);
const nodeCount = await page.locator('.react-flow__node').count();
const edgeCount = await page.locator('.react-flow__edge').count();
const m1 = await metrics();
console.log(`crear + abrir: ${tUrl} ms hasta la URL, ${firstPaint} ms hasta pintar ${nodeCount} nodos y ${edgeCount} aristas (performance.measure: ${createToPainted?.toFixed(0)} ms)`);

// 2) Cambiar entre 5 vistas desde el panel de vistas (cada una tiene 60 nodos).
const switches = [];
for (let i = 2; i <= SWITCHES + 1; i++) {
  const prevFirst = await page.locator('.react-flow__node').first().getAttribute('data-id');
  const item = page.locator('.ad-views__item > span', { hasText: new RegExp(`^Vista ${i}$`) }).first();
  await item.scrollIntoViewIfNeeded();
  const s0 = Date.now();
  await page.evaluate(i => performance.mark(`bench:view${i}:start`), i);
  await item.click();
  await waitPainted(PER_VIEW, prevFirst);
  const ms = Date.now() - s0;
  await page.evaluate(i => { performance.mark(`bench:view${i}:painted`); performance.measure(`bench:switch${i}`, `bench:view${i}:start`, `bench:view${i}:painted`); }, i);
  const measured = await page.evaluate(i => performance.getEntriesByName(`bench:switch${i}`, 'measure')[0]?.duration ?? null, i);
  switches.push({ view: `Vista ${i}`, ms, measured });
  console.log(`cambiar a Vista ${i}: ${ms} ms (performance.measure: ${measured?.toFixed(0)} ms)`);
}
const avg = switches.reduce((a, s) => a + s.ms, 0) / switches.length;
const m2 = await metrics();

// 3) Panel de problemas: tiempo hasta que deja de "calculando…" tras abrirlo.
const p0 = Date.now();
await page.locator('.ad-problems__bar').click();
await page.waitForFunction(() => !document.querySelector('.ad-problems__busy'), null, { timeout: 30000 });
const problemsMs = Date.now() - p0;
console.log(`problemas (vista actual): ${problemsMs} ms · ${await page.locator('.ad-problems__bar').innerText()}`);

const result = {
  base, elements: 1000, views: 50, perView: PER_VIEW,
  createToUrlMs: tUrl, createToPaintedMs: firstPaint, createToPaintedMeasureMs: createToPainted, nodes: nodeCount, edges: edgeCount,
  switches, switchAvgMs: Math.round(avg), problemsMs,
  metrics: { afterOpen: { JSHeapUsedMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), DOMNodes: m1.Nodes, LayoutCount: m1.LayoutCount, ScriptDurationS: +m1.ScriptDuration.toFixed(2) }, afterSwitches: { JSHeapUsedMB: +(m2.JSHeapUsedSize / 1048576).toFixed(1), DOMNodes: m2.Nodes, LayoutCount: m2.LayoutCount, ScriptDurationS: +m2.ScriptDuration.toFixed(2) } },
  errors,
};
console.log(`media de cambio de vista: ${Math.round(avg)} ms · heap ${result.metrics.afterSwitches.JSHeapUsedMB} MB · ${m2.Nodes} nodos DOM`);
if (out) writeFileSync(out, JSON.stringify(result, null, 2));
console.log('ERRORS', errors.length, errors.slice(0, 10));
await browser.close();
process.exit(errors.length ? 1 : 0);
