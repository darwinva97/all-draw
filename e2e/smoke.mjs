// Prueba de humo con el chromium del sistema: abre la demo, navega dimensiones, hace capturas.
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const out = process.env.OUT ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/01-home.png` });
await page.getByRole('button', { name: /Abrir la demo/ }).click();
await page.waitForURL(/#\/w\//);
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/02-archimate.png` });
const counts = async () => ({ nodes: await page.locator('.react-flow__node').count(), edges: await page.locator('.react-flow__edge').count() });
console.log('archimate', await counts());
// Doble clic en "Alta de cliente" → entra en BPMN (detailViewId)
await page.locator('.react-flow__node', { hasText: 'Alta de cliente' }).first().dblclick();
await page.waitForTimeout(800);
console.log('bpmn', await counts(), 'crumbs:', await page.locator('.ad-crumb').count());
await page.screenshot({ path: `${out}/03-bpmn.png` });
// Menú contextual sobre "Verificar identidad" → Abrir en otra dimensión
await page.locator('.react-flow__node', { hasText: 'Verificar identidad' }).first().click({ button: 'right' });
await page.waitForSelector('.ad-menu');
await page.screenshot({ path: `${out}/04-menu.png` });
await page.keyboard.press('Escape');
// Volver y abrir estados desde el panel de vistas
await page.locator('.ad-views__item', { hasText: 'Alta de cliente · Estados' }).first().click();
await page.waitForTimeout(600);
console.log('statechart', await counts());
await page.screenshot({ path: `${out}/05-statechart.png` });
await page.locator('.ad-views__item', { hasText: 'Contenedores' }).first().click();
await page.waitForTimeout(600);
console.log('c4', await counts());
await page.screenshot({ path: `${out}/06-c4.png` });
await page.locator('.ad-views__item', { hasText: 'Mapa capas' }).first().click();
await page.waitForTimeout(800);
console.log('grid', await counts());
await page.screenshot({ path: `${out}/07-grid.png` });
// Seleccionar el nodo con pines y ver el inspector
await page.locator('.react-flow__node', { hasText: 'clientes-api' }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Pines/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/08-inspector-pines.png` });
// Problemas
await page.locator('.ad-problems__bar').click();
await page.waitForTimeout(300);
console.log('problems bar:', await page.locator('.ad-problems__bar').innerText());
await page.screenshot({ path: `${out}/09-problems.png` });
// Arrastrar un tipo desde la paleta a la vista ArchiMate y deshacer
await page.locator('.ad-views__item', { hasText: 'Arquitectura ·' }).first().click();
await page.waitForTimeout(500);
const before = (await counts()).nodes;
const src = page.locator('.ad-pal__item', { hasText: 'Business Actor' }).first();
const pane = page.locator('.react-flow__pane');
const sb = await src.boundingBox(); const pb = await pane.boundingBox();
if (sb && pb) {
  // Simular drop HTML5 con dataTransfer
  await page.evaluate(({ typeId, x, y }) => {
    const dt = new DataTransfer(); dt.setData('application/x-all-draw-type', typeId);
    const el = document.elementFromPoint(x, y);
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  }, { typeId: 'archimate:BusinessActor', x: pb.x + pb.width - 200, y: pb.y + 120 });
  await page.waitForTimeout(500);
}
const after = (await counts()).nodes;
console.log('drop: nodes', before, '→', after);
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
console.log('undo: nodes', (await counts()).nodes);
await page.screenshot({ path: `${out}/10-after-undo.png` });
// Recargar: persistencia IndexedDB
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.waitForTimeout(500);
console.log('reload', await counts(), 'title:', await page.locator('.app-name').inputValue());
console.log('ERRORS', errors.length, errors.slice(0, 10));
await browser.close();
process.exit(errors.length ? 1 : 0);
