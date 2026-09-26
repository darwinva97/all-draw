// Panel de espacio (librerías/reglas/personas), copiar/pegar, alinear y bendpoints.
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4173', out = process.env.OUT ?? '/tmp/shots';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Abrir la demo/ }).click();
await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(500);
const n = () => page.locator('.react-flow__node').count();
// Copiar/pegar: seleccionar dos nodos con Shift y pegar
await page.locator('.react-flow__node', { hasText: 'Cliente' }).first().click();
await page.locator('.react-flow__node', { hasText: 'Gestor comercial' }).first().click({ modifiers: ['Shift'] });
await page.screenshot({ path: `${out}/11-alignbar.png` });
console.log('alignbar:', await page.locator('[class*=ad-align]').count() > 0);
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.waitForTimeout(400);
console.log('paste: nodes', await n());
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
console.log('undo paste: nodes', await n());
// Bendpoint: doble clic sobre una arista
const edge = page.locator('.react-flow__edge').first();
const bb = await edge.boundingBox();
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(400);
console.log('bend handles:', await page.locator('[class*=ad-bend]').count());
await page.screenshot({ path: `${out}/12-bendpoint.png` });
// Panel Espacio → Reglas → nueva regla
await page.getByRole('button', { name: 'Espacio' }).click();
await page.waitForSelector('[class*=ad-ws]');
await page.locator('.ad-ws-tabs button', { hasText: 'Reglas' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/13-reglas.png` });
await page.locator('.ad-ws-tabs button', { hasText: 'Librer' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/14-librerias.png` });
await page.locator('.ad-ws-tabs button', { hasText: 'Personas' }).click(); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/15-personas.png` });
await page.keyboard.press('Escape');
console.log('panel closed:', await page.locator('[class*=ad-ws-overlay], .ad-ws').count());
console.log('ERRORS', errors);
await browser.close(); process.exit(errors.length ? 1 : 0);
