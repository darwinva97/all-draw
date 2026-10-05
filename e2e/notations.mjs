// Notaciones nuevas: casos de uso, componentes, despliegue y actividad UML, Gantt y DDD. Abre cada plantilla (sin errores,
// con nodos y figuras propias), hace capturas `nota-*.png` (claro y oscuro) y prueba la vista de Gantt: arrastrar una barra
// cambia sus fechas, estirarla cambia el fin, el selector de escala y la paleta (soltar una tarea le da fecha).
//
//   cd apps/web && pnpm dev --port 4342
//   BASE=http://127.0.0.1:4342 node e2e/notations.mjs        (capturas en $OUT, por defecto /tmp/shots)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = [], errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };

const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'es'); });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 40[14]|Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });

// Con un espacio guardado, el inicio muestra la galería de plantillas (sin espacios, la portada).
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Abrir la demo|Probar sin cuenta/ }).first().click();
await page.waitForSelector('.react-flow__node');

async function template(name) {
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.tpl'); await page.waitForTimeout(150);
  const more = page.locator('.tpl__more[aria-expanded=false]');
  if (await more.count()) await more.click();
  await page.getByRole('button', { name: `Crear desde la plantilla «${name}»` }).click();
  await page.waitForSelector('.react-flow'); await page.waitForTimeout(900);
}
const nodes = () => page.locator('.react-flow__node').count();
const theme = async (t) => { await page.emulateMedia({ colorScheme: t }); await page.waitForTimeout(400); };

const TPLS = [
  ['usecase', 'Casos de uso: tienda online', '.ad-shape-actor'],
  ['component', 'Componentes: tienda online', '.ad-shape-socket'],
  ['deployment', 'Despliegue: tienda en la nube', '.ad-shape-node3d'],
  ['activity', 'Actividad: tramitar un pedido', '.ad-shape-flow-final'],
  ['gantt', 'Gantt: lanzamiento de una web', '.ad-gantt-bar--task'],
  ['ddd', 'DDD: mapa de contextos de una tienda', '.ad-node--cls, .ad-shape-ellipse'],
];
for (const [id, name, sel] of TPLS) {
  const errs = errors.length;
  await template(name);
  const n = await nodes();
  check(n > 3, `${id}: ${n} nodos`);
  check(await page.locator(sel).count() > 0, `${id}: figura propia (${sel})`);
  check(errors.length === errs, `${id}: sin errores${errors.length > errs ? ` (${errors.slice(errs).join(' | ')})` : ''}`);
  await theme('light');
  await page.screenshot({ path: `${out}/nota-${id}.png` });
  await theme('dark');
  await page.screenshot({ path: `${out}/nota-${id}-dark.png` });
  await theme('light');
}

// DDD: la vista táctica de Pedidos (mismo contexto en otra vista, con agregado y clasificadores)
await template('DDD: mapa de contextos de una tienda');
await page.locator('.ad-views__item', { hasText: 'Pedidos · modelo táctico' }).first().click();
await page.waitForTimeout(800);
check(await page.locator('.ad-node--cls').count() === 5, `ddd: entidad, objetos de valor, evento y servicio como clasificadores (${await page.locator('.ad-node--cls').count()})`);
check(await page.locator('.ad-cls__stereo', { hasText: 'Value Object' }).count() === 2, 'ddd: «Value Object» por defecto');
await page.screenshot({ path: `${out}/nota-ddd-tactical.png` });

// Palabras clave en las aristas
await template('Casos de uso: tienda online');
const labels = (await page.locator('.ad-edge-label').allInnerTexts()).join(' | ');
check(/«include»/.test(labels) && /«extend» resumen del pedido · \[tiene cupón\]/.test(labels), `casos de uso: «include» y «extend» rotulados (${labels})`);

// ---------------------------------------------------------------- Gantt
await template('Gantt: lanzamiento de una web');
check(await page.locator('.react-flow__node-ganttGrid').count() === 1, 'gantt: rejilla de fondo');
check(await page.locator('.react-flow__edge-ganttDep').count() === 7, `gantt: 7 dependencias en codo (${await page.locator('.react-flow__edge-ganttDep').count()})`);
check(await page.locator('.ad-gantt-bar--milestone').count() === 1 && await page.locator('.ad-gantt-bar--group').count() === 2, 'gantt: hito y dos fases');
const startOf = async () => page.locator('.ad-insp input[type=date]').first().inputValue();
const bar = page.locator('.react-flow__node-ganttBar', { has: page.locator('[title^="Investigación de usuarios"]') });
await bar.click(); await page.waitForTimeout(300);
const before = await startOf();
const b0 = await bar.boundingBox();
const zoom = await page.evaluate(() => Number(/scale\(([\d.]+)\)/.exec(document.querySelector('.react-flow__viewport').style.transform)?.[1] ?? 1));
const scaleBtn = (label) => page.locator('.ad-gantt-scale button', { hasText: label });
// Píxeles por día de la escala actual: la barra de «Investigación de usuarios» dura 5 días.
const pxDay = b0.width / zoom / 5;
await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await page.mouse.down();
// Un primer paso corto: React Flow empieza a arrastrar al superar su umbral y ese tramo no cuenta.
await page.mouse.move(b0.x + b0.width / 2 + 2, b0.y + b0.height / 2);
await page.mouse.move(b0.x + b0.width / 2 + 2 + 7 * pxDay * zoom, b0.y + b0.height / 2 + 40, { steps: 12 });
await page.mouse.up(); await page.waitForTimeout(500);
const after = await startOf();
const days = (Date.parse(after) - Date.parse(before)) / 86400000;
check(days === 7, `gantt: arrastrar la barra una semana mueve el inicio (${before} → ${after})`);
const b1 = await bar.boundingBox();
check(Math.abs(b1.y - b0.y) < 2, 'gantt: la barra no se sale de su fila');
// Estirar el borde derecho dos días: cambia el fin
const endOf = async () => page.locator('.ad-insp input[type=date]').nth(1).inputValue();
const end0 = await endOf();
await bar.click(); await page.waitForTimeout(200);
const right = bar.locator('.react-flow__resize-control.right');
check(await right.count() === 1, 'gantt: control para estirar la barra');
const r = await right.boundingBox();
await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
await page.mouse.move(r.x + r.width / 2 + 2 * pxDay * zoom, r.y + r.height / 2, { steps: 8 });
await page.mouse.up(); await page.waitForTimeout(500);
const end1 = await endOf();
check((Date.parse(end1) - Date.parse(end0)) / 86400000 === 2, `gantt: estirar la barra cambia el fin (${end0} → ${end1})`);
await page.screenshot({ path: `${out}/nota-gantt-edit.png` });
// Escala
await scaleBtn('Meses').click(); await page.waitForTimeout(400);
check(await scaleBtn('Meses').getAttribute('aria-pressed') === 'true', 'gantt: escala por meses');
await page.screenshot({ path: `${out}/nota-gantt-months.png` });
await scaleBtn('Días').click(); await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/nota-gantt-days.png` });
await scaleBtn('Auto').click(); await page.waitForTimeout(300);
// Soltar una tarea desde la paleta: nace con fecha (5 días) en su fila
const nBars = await page.locator('.react-flow__node-ganttBar').count();
const grid = await page.locator('.react-flow__node-ganttGrid').boundingBox();
await page.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-all-draw-type', 'gantt:Task'); const el = document.elementFromPoint(x, y); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { x: grid.x + grid.width * 0.5, y: grid.y + grid.height - 6 });
await page.waitForTimeout(500);
check(await page.locator('.react-flow__node-ganttBar').count() === nBars + 1, 'gantt: soltar una tarea añade una fila');
check(/^\d{4}-\d{2}-\d{2}$/.test(await startOf()), 'gantt: la tarea soltada nace con fecha de inicio');

// Inglés: nombres traducidos en la galería y en el selector de escala (otra página: la de arriba fija el español al cargar)
const en = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
await en.addInitScript(() => { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'en'); });
en.on('pageerror', e => errors.push(e.message));
await en.goto(base + '/#/', { waitUntil: 'networkidle' });
await en.getByRole('button', { name: /Open the demo|Try it without/ }).first().click();
await en.waitForSelector('.react-flow__node');
await en.goto(base + '/#/', { waitUntil: 'networkidle' });
await en.waitForSelector('.tpl');
const moreEn = en.locator('.tpl__more[aria-expanded=false]');
if (await moreEn.count()) await moreEn.click();
const ganttEn = en.getByRole('button', { name: /Gantt: website launch/ });
check(await ganttEn.count() === 1, 'inglés: plantilla de Gantt traducida');
await ganttEn.click();
await en.waitForSelector('.react-flow'); await en.waitForTimeout(800);
check(await en.locator('.ad-gantt-scale button', { hasText: 'Weeks' }).count() === 1, 'inglés: selector de escala traducido');
check(await en.locator('.ad-gantt-bar[title^="User research"]').count() === 1, 'inglés: tareas de la plantilla en inglés');
await en.screenshot({ path: `${out}/nota-gantt-en.png` });

check(errors.length === 0, `sin errores de página (${errors.join(' | ')})`);
await browser.close();
console.log(fails.length ? `\n${fails.length} fallo(s).` : '\nTodo bien.');
process.exit(fails.length ? 1 : 0);
