// Flujo con cuentas: A se registra, crea un espacio con la demo, genera un enlace de edición; B lo abre sin cuenta y ambos convergen.
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4002';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const mk = async () => { const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 820 } }); const p = await ctx.newPage(); await p.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));; p.on('pageerror', e => errors.push(e.message)); return p; };
const a = await mk(), b = await mk();
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
const email = `e2e-${Date.now()}@test.local`;
await a.getByRole('button', { name: /Entrar/ }).click();
await a.getByRole('button', { name: 'No tengo cuenta' }).click();
await a.locator('input[type=email]').fill(email);
await a.locator('.field input:not([type=email]):not([type=password])').fill('E2E');
await a.locator('input[type=password]').fill('contraseña-larga');
await a.getByRole('button', { name: 'Registrarme' }).click();
await a.waitForSelector('#h-remote', { timeout: 20000 });
await a.getByRole('button', { name: /^Abrir la demo/ }).first().click();
await a.waitForURL(/#\/s\//, { waitUntil: 'commit' }); await a.waitForSelector('.react-flow__node', { timeout: 20000 }); await a.waitForTimeout(1500);
console.log('A status:', await a.locator('.app-status').first().innerText());
await a.getByRole('button', { name: 'Compartir', exact: true }).click();
await a.getByRole('button', { name: 'Nuevo enlace de edición' }).click();
await a.waitForSelector('text=edición', { timeout: 10000 }); await a.waitForTimeout(500);
// Sacamos la URL del enlace por la API (la cookie de A la tiene su contexto)
const wsId = /#\/s\/([^/?]+)/.exec(a.url())[1];
const links = await a.evaluate(async id => (await fetch(`/api/workspaces/${id}/links`)).json(), wsId);
const url = links.links[0].url.replace(/^https?:\/\/[^/]+/, base);
console.log('link:', url.replace(base, '').replace(/token=.*/, 'token=…'));
await b.goto(url, { waitUntil: 'networkidle' });
await b.waitForSelector('.react-flow__node', { timeout: 20000 }); await b.waitForTimeout(1500);
console.log('B nodes:', await b.locator('.react-flow__node').count(), 'status:', await b.locator('.app-status').first().innerText());
const pane = b.locator('.react-flow__pane'); const pb = await pane.boundingBox();
await b.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-all-draw-type', 'archimate:Goal'); const el = document.elementFromPoint(x, y); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { x: pb.x + pb.width - 150, y: pb.y + 100 });
await a.waitForTimeout(1500);
console.log('A after B edit → nodes:', await a.locator('.react-flow__node').count());
// Presencia: A ve a B en la barra
console.log('peers seen by A:', await a.locator('.ad-avatar:not(.is-me)').count());
await browser.close();
console.log('ERRORS', errors);
process.exit(errors.length ? 1 : 0);
