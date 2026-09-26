// Dos navegadores (contextos aislados) editan la misma sala a través del servidor y convergen; el servidor persiste en disco.
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4002';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const mk = async () => { const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message)); return p; };
const a = await mk(), b = await mk();
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
await a.getByRole('button', { name: /Abrir la demo/ }).click();
await a.waitForURL(/#\/w\//); await a.waitForSelector('.react-flow__node');
await a.getByRole('button', { name: 'Compartir en línea' }).click();
await a.waitForSelector('.react-flow__node'); await a.waitForTimeout(1500);
const url = a.url();
console.log('A status:', await a.locator('.app-status').innerText(), url.replace(base, ''));
await b.goto(url, { waitUntil: 'networkidle' });
await b.waitForSelector('.react-flow__node', { timeout: 15000 }); await b.waitForTimeout(1500);
console.log('B nodes:', await b.locator('.react-flow__node').count(), 'status:', await b.locator('.app-status').innerText(), 'name:', await b.locator('.app-name').inputValue());
// B renombra el espacio y añade un nodo; A debe verlo
await b.locator('.app-name').fill('Demo compartida');
const pane = b.locator('.react-flow__pane'); const pb = await pane.boundingBox();
await b.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-all-draw-type', 'archimate:Goal'); const el = document.elementFromPoint(x, y); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { x: pb.x + pb.width - 150, y: pb.y + 100 });
await a.waitForTimeout(1500);
console.log('A after B edit → nodes:', await a.locator('.react-flow__node').count(), 'name:', await a.locator('.app-name').inputValue());
await browser.close();
console.log('ERRORS', errors);
process.exit(errors.length ? 1 : 0);
