// Medición en navegador con el chromium del sistema (1440×900).
//
// Por defecto crea el espacio grande de `?bench=1` (1.000 elementos × 50 vistas de 60 nodos), mide el tiempo hasta
// pintar la primera vista y el de cambiar entre SWITCHES vistas, y abre el panel de problemas.
// Con PER_VIEW distinto de 60 genera el espacio aquí (esbuild + `generateLargeWorkspace` del núcleo, pack ArchiMate)
// y lo importa como .json desde la portada: `PER_VIEW=300 VIEWS=12 node e2e/bench.mjs`.
//
// Variables: BASE (URL; mídase contra `vite preview` del build de producción), PER_VIEW, VIEWS, ELEMENTS,
// SWITCHES (cambios medidos, 8 por defecto), OUT=fichero.json (resultados), TRACE=fichero.json (traza de Chrome de los
// cambios de vista, con un desglose por categoría en la salida), PROFILE=fichero.cpuprofile (perfil de CPU de los cambios),
// SCHEMA_VERSION (versión de esquema del espacio generado, para builds anteriores a un cambio de esquema).
//
//   pnpm --filter web exec vite build --outDir /tmp/alldraw-bench-dist
//   pnpm --filter web exec vite preview --outDir /tmp/alldraw-bench-dist --port 4199 --host 127.0.0.1
//   BASE=http://127.0.0.1:4199 node e2e/bench.mjs
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const base = process.env.BASE ?? 'http://127.0.0.1:4195';
const out = process.env.OUT ?? '';
const PER_VIEW = Number(process.env.PER_VIEW ?? 60);
const VIEWS = Number(process.env.VIEWS ?? (PER_VIEW === 60 ? 50 : 12));
const ELEMENTS = Number(process.env.ELEMENTS ?? 1000);
const SWITCHES = Math.min(Number(process.env.SWITCHES ?? 8), VIEWS - 1);
const TRACE = process.env.TRACE ?? '';
const PROFILE = process.env.PROFILE ?? '';
/** Por encima de este número de nodos el lienzo solo monta los visibles (`VIRTUALIZE_FROM` en Canvas.tsx). */
const VIRTUALIZED = PER_VIEW > 300;
const useButton = PER_VIEW === 60 && VIEWS === 50 && ELEMENTS === 1000;

/** Genera el espacio con el núcleo (TypeScript empaquetado al vuelo con esbuild) y lo guarda como JSON. */
async function generateFile() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { createRequire } = await import('node:module');
  // esbuild llega como dependencia de vite (no está en la raíz del monorepo): se resuelve desde apps/web.
  const vite = createRequire(join(root, 'apps/web/package.json')).resolve('vite');
  const { build } = createRequire(vite)('esbuild');
  const entry = `import { generateLargeWorkspace, NotationRegistry, CORE_PACK } from '@all-draw/core';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
export const make = (o) => { const registry = new NotationRegistry(); registry.register(CORE_PACK); registry.register(ARCHIMATE_PACK); return generateLargeWorkspace({ ...o, notation: 'archimate', registry }); };`;
  const res = await build({ stdin: { contents: entry, resolveDir: join(root, 'apps/web'), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error' });
  const mod = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
  const ws = mod.make({ elements: ELEMENTS, views: VIEWS, perView: PER_VIEW, name: `Banco ${ELEMENTS}×${VIEWS}×${PER_VIEW}` });
  // Para medir builds anteriores a un cambio de esquema: SCHEMA_VERSION=1.
  if (process.env.SCHEMA_VERSION) ws.meta.schemaVersion = Number(process.env.SCHEMA_VERSION);
  const file = join(tmpdir(), `alldraw-bench-${ELEMENTS}-${VIEWS}-${PER_VIEW}.json`);
  writeFileSync(file, JSON.stringify(ws));
  return file;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('alldraw:tour', 'done')); // sin recorrido guiado
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 40[14]/.test(m.text())) errors.push('console: ' + m.text()); });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

/**
 * Espera a que la vista nueva esté montada (hay nodos y ninguno es de la vista anterior; sin virtualización, al menos
 * `n`) y a dos frames más (pintado real). Los ids de nodo del banco son únicos entre vistas.
 */
const waitPainted = (n, prevIds) => page.waitForFunction(({ n, prevIds }) => {
  const nodes = document.querySelectorAll('.react-flow__node');
  if (nodes.length < n) return false;
  const prev = new Set(prevIds);
  for (const el of nodes) if (prev.has(el.getAttribute('data-id'))) return false;
  return true;
}, { n, prevIds }, { timeout: 60000, polling: 'raf' }).then(() => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now()))))));
const nodeIds = () => page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map(e => e.getAttribute('data-id')));
const minNodes = VIRTUALIZED ? 1 : PER_VIEW;

await page.goto(base + '/?bench=1#/', { waitUntil: 'networkidle' });
let t0;
if (useButton) {
  const create = page.locator('[data-bench="create"]');
  await create.waitFor({ timeout: 15000 });
  await page.evaluate(() => performance.mark('bench:create'));
  t0 = Date.now();
  await create.click();
} else {
  const file = await generateFile();
  await page.evaluate(() => performance.mark('bench:create'));
  t0 = Date.now();
  await page.locator('input[type=file]').setInputFiles(file);
}

// 1) Crear el espacio y pintar la primera vista (incluye generar/importar, cargar en Yjs/IndexedDB, abrir y montar el editor).
await page.waitForURL(/#\/w\//, { timeout: 120000 });
const tUrl = Date.now() - t0;
await waitPainted(minNodes, []);
const firstPaint = Date.now() - t0;
await page.evaluate(() => { performance.mark('bench:painted'); performance.measure('bench:create→painted', 'bench:create', 'bench:painted'); });
const createToPainted = await page.evaluate(() => performance.getEntriesByName('bench:create→painted', 'measure')[0]?.duration ?? null);
const nodeCount = await page.locator('.react-flow__node').count();
const edgeCount = await page.locator('.react-flow__edge').count();
const m1 = await metrics();
console.log(`${ELEMENTS} elementos × ${VIEWS} vistas × ${PER_VIEW} nodos · crear + abrir: ${tUrl} ms hasta la URL, ${firstPaint} ms hasta pintar ${nodeCount} nodos y ${edgeCount} aristas (performance.measure: ${createToPainted?.toFixed(0)} ms)`);
await page.waitForTimeout(500);

// 2) Cambiar entre vistas desde el panel de vistas.
if (TRACE) await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8.execute,blink,cc,gpu', transferMode: 'ReturnAsStream' });
if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
const switches = [];
for (let i = 2; i <= SWITCHES + 1; i++) {
  const prevIds = await nodeIds();
  const item = page.locator('.ad-views__item > span', { hasText: new RegExp(`^Vista ${i}$`) }).first();
  await item.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  // Medida dentro de la página: desde el `pointerdown` del clic (sin la espera de "accionabilidad" de playwright) hasta
  // el primer frame pintado con la vista nueva (comprobado en requestAnimationFrame; el mensaje de MessageChannel se
  // entrega cuando ese frame ya se ha pintado).
  await page.evaluate(({ i, n, prevIds }) => {
    window.__benchDone = new Promise(resolve => {
      document.addEventListener('pointerdown', () => {
        performance.mark(`bench:view${i}:start`);
        const prev = new Set(prevIds);
        const tick = () => {
          const nodes = document.querySelectorAll('.react-flow__node');
          let ok = nodes.length >= n && document.querySelector('.react-flow__edge') !== null;
          if (ok) for (const el of nodes) if (prev.has(el.getAttribute('data-id'))) { ok = false; break; }
          if (!ok) { requestAnimationFrame(tick); return; }
          const ch = new MessageChannel();
          ch.port1.onmessage = () => { performance.mark(`bench:view${i}:painted`); resolve(performance.measure(`bench:switch${i}`, `bench:view${i}:start`, `bench:view${i}:painted`).duration); };
          ch.port2.postMessage(0);
        };
        requestAnimationFrame(tick);
      }, { capture: true, once: true });
    });
  }, { i, n: minNodes, prevIds });
  const s0 = Date.now();
  await item.click();
  const measured = await page.evaluate(() => window.__benchDone);
  const ms = Date.now() - s0;
  const mounted = await page.locator('.react-flow__node').count();
  switches.push({ view: `Vista ${i}`, ms, measured: measured === null ? null : Math.round(measured), mounted });
  console.log(`cambiar a Vista ${i}: ${Math.round(measured)} ms (${ms} ms con el clic de playwright, ${mounted} nodos montados)`);
}
if (PROFILE) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(PROFILE, JSON.stringify(profile)); console.log(`perfil de CPU en ${PROFILE}`); }
let traceSummary;
if (TRACE) {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  let data = '';
  for (;;) { const c = await cdp.send('IO.read', { handle: stream }); data += c.data; if (c.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  writeFileSync(TRACE, data);
  traceSummary = summarizeTrace(JSON.parse(data));
  console.log(`traza en ${TRACE}; hilo principal por categoría (ms, total de los ${switches.length} cambios): ${JSON.stringify(traceSummary)}`);
}
const measuredAll = switches.map(s => s.measured ?? s.ms).sort((a, b) => a - b);
const avg = measuredAll.reduce((a, s) => a + s, 0) / measuredAll.length;
const median = measuredAll[Math.floor(measuredAll.length / 2)];
const m2 = await metrics();

// 3) Panel de problemas: tiempo hasta que deja de "calculando…" tras abrirlo.
const p0 = Date.now();
await page.locator('.ad-problems__bar').click();
await page.waitForFunction(() => !document.querySelector('.ad-problems__busy'), null, { timeout: 30000 });
const problemsMs = Date.now() - p0;
console.log(`problemas (vista actual): ${problemsMs} ms · ${await page.locator('.ad-problems__bar').innerText()}`);

const result = {
  base, elements: ELEMENTS, views: VIEWS, perView: PER_VIEW,
  createToUrlMs: tUrl, createToPaintedMs: firstPaint, createToPaintedMeasureMs: createToPainted, nodes: nodeCount, edges: edgeCount,
  switches, switchAvgMs: Math.round(avg), switchMedianMs: median, switchMinMs: measuredAll[0], switchMaxMs: measuredAll[measuredAll.length - 1], problemsMs,
  trace: traceSummary,
  metrics: { afterOpen: { JSHeapUsedMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), DOMNodes: m1.Nodes, LayoutCount: m1.LayoutCount, ScriptDurationS: +m1.ScriptDuration.toFixed(2) }, afterSwitches: { JSHeapUsedMB: +(m2.JSHeapUsedSize / 1048576).toFixed(1), DOMNodes: m2.Nodes, LayoutCount: m2.LayoutCount, ScriptDurationS: +m2.ScriptDuration.toFixed(2) } },
  errors,
};
console.log(`cambio de vista: media ${Math.round(avg)} ms · mediana ${median} ms · [${measuredAll[0]}–${measuredAll[measuredAll.length - 1]}] · heap ${result.metrics.afterSwitches.JSHeapUsedMB} MB · ${m2.Nodes} nodos DOM`);
if (out) writeFileSync(out, JSON.stringify(result, null, 2));
console.log('ERRORS', errors.length, errors.slice(0, 10));
await browser.close();
process.exit(errors.length ? 1 : 0);

/** Suma la duración de los eventos de nivel superior del hilo principal del renderer por tipo (script, estilo, layout, pintado…). */
function summarizeTrace(trace) {
  const events = trace.traceEvents ?? trace;
  const main = events.find(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  if (!main) return {};
  const cat = {
    FunctionCall: 'script', EvaluateScript: 'script', TimerFire: 'script', FireAnimationFrame: 'script', EventDispatch: 'script', RunMicrotasks: 'script', 'v8.run': 'script', V8Execute: 'script',
    UpdateLayoutTree: 'estilo', RecalculateStyles: 'estilo', ParseAuthorStyleSheet: 'estilo',
    Layout: 'layout', 'LocalFrameView::layout': 'layout',
    Paint: 'pintado', PaintImage: 'pintado', 'PrePaint': 'prepintado', Layerize: 'capas', UpdateLayer: 'capas', 'Commit': 'commit', HitTest: 'hit-test',
    MinorGC: 'gc', MajorGC: 'gc', 'V8.GC_SCAVENGER': 'gc',
  };
  const sums = {};
  // Solo eventos completos no anidados en otro del mismo hilo: se recorren por inicio y se descuenta el solape.
  const xs = events.filter(e => e.ph === 'X' && e.pid === main.pid && e.tid === main.tid && cat[e.name]).sort((a, b) => a.ts - b.ts);
  let end = 0;
  for (const e of xs) {
    if (e.ts < end) continue;
    const k = cat[e.name];
    sums[k] = (sums[k] ?? 0) + e.dur / 1000;
    end = e.ts + e.dur;
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => b[1] - a[1]));
}
