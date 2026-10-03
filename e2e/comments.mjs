// Comentarios: comentar un nodo (con @mención), responder, resolver, comentar un punto y abrir desde la burbuja.
// Uso: BASE=http://127.0.0.1:4197 node e2e/comments.mjs   (capturas en $OUT/comments-*.png)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('alldraw:tour', 'done')); // sin recorrido guiado
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push('console: ' + m.text()); });
const check = (cond, msg) => { if (!cond) errors.push('check: ' + msg); console.log(cond ? 'ok  ' : 'FAIL', msg); };

await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Abrir la demo|Probar sin cuenta/ }).click();
await page.waitForURL(/#\/w\//);
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.waitForTimeout(600);

// Una persona para poder mencionarla
await page.getByRole('button', { name: 'Espacio' }).click();
await page.locator('.ad-ws-tabs button', { hasText: 'Personas' }).click();
await page.getByPlaceholder('Nueva persona…').fill('Ana López');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 1. Comentar un nodo desde su menú contextual, con @mención
const node = page.locator('.react-flow__node', { hasText: 'Alta de cliente' }).first();
await node.click({ button: 'right' });
await page.locator('.ad-menu button', { hasText: 'Comentar' }).click();
await page.waitForSelector('.ad-cm-panel');
const draft = page.locator('.ad-cm-thread.is-draft textarea');
await draft.pressSequentially('Revisar con @an');
await page.waitForSelector('.ad-cm-mentions li');
check(await page.locator('.ad-cm-mentions li', { hasText: 'Ana López' }).count() === 1, 'autocompletado sugiere a Ana López');
await page.screenshot({ path: `${out}/comments-1-mention.png` });
await page.keyboard.press('Enter');
await draft.pressSequentially('antes del viernes');
await page.keyboard.press('Control+Enter');
await page.waitForTimeout(300);
check(await page.locator('.ad-cm-thread').count() === 1, 'hilo creado');
check(await page.locator('.ad-cm-mention', { hasText: '@Ana López' }).count() === 1, 'mención resaltada');
check(await page.locator('.ad-cm-bubble--node').count() >= 1, 'burbuja sobre el nodo');
check((await page.locator('.ad-cm-toolbtn .ad-cm-count').innerText()) === '1', 'contador de la barra = 1');
await page.screenshot({ path: `${out}/comments-2-node.png` });

// 2. Responder
await page.locator('.ad-cm-thread button', { hasText: 'Responder' }).click();
await page.locator('.ad-cm-thread textarea').pressSequentially('Hecho, lo miro mañana');
await page.keyboard.press('Control+Enter');
await page.waitForTimeout(300);
check(await page.locator('.ad-cm-thread .ad-cm-item').count() === 2, 'respuesta añadida');
await page.screenshot({ path: `${out}/comments-3-reply.png` });

// 3. Resolver: desaparece de "Abiertos" y aparece en "Resueltos"; la burbuja se va
await page.locator('.ad-cm-thread button', { hasText: 'Resolver' }).click();
await page.waitForTimeout(300);
check(await page.locator('.ad-cm-thread').count() === 0, 'resuelto: fuera de Abiertos');
check(await page.locator('.ad-cm-bubble--node').count() === 0, 'sin burbuja tras resolver');
await page.locator('.ad-cm-seg button', { hasText: 'Resueltos' }).click();
await page.waitForTimeout(200);
check(await page.locator('.ad-cm-thread.is-resolved').count() === 1, 'aparece en Resueltos');
await page.screenshot({ path: `${out}/comments-4-resolved.png` });
await page.locator('.ad-cm-seg button', { hasText: 'Abiertos' }).click();

// 4. Comentar un punto vacío del lienzo
const spot = await page.evaluate(() => {
  const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
  for (let y = pane.top + 60; y < pane.bottom - 160; y += 20) for (let x = pane.left + 80; x < pane.right - 420; x += 20) {
    const el = document.elementFromPoint(x, y);
    if (el && el.classList.contains('react-flow__pane')) return { x, y };
  }
  return null;
});
check(!!spot, 'hay un hueco en el lienzo');
await page.mouse.click(spot.x, spot.y, { button: 'right' });
await page.locator('.ad-menu button', { hasText: 'Comentar aquí' }).click();
await page.waitForTimeout(200);
check(await page.locator('.ad-cm-bubble--draft').count() === 1, 'marcador provisional en el punto');
await page.locator('.ad-cm-thread.is-draft textarea').pressSequentially('¿Falta aquí el sistema de scoring?');
await page.keyboard.press('Control+Enter');
await page.waitForTimeout(300);
check(await page.locator('.ad-cm-bubble--point').count() === 1, 'marcador del punto');
await page.screenshot({ path: `${out}/comments-5-point.png` });

// 5. Cerrar el panel y abrir el hilo desde el marcador
await page.locator('.ad-cm-panel button[aria-label="Cerrar"]').click();
await page.waitForTimeout(200);
await page.locator('.ad-cm-bubble--point .ad-cm-bubble__in').click();
await page.waitForSelector('.ad-cm-panel');
await page.waitForTimeout(300);
check(await page.locator('.ad-cm-thread.is-active', { hasText: 'scoring' }).count() === 1, 'clic en el marcador abre su hilo');
// Ir al ancla del hilo resuelto desde "Todos" (selecciona el nodo)
await page.locator('.ad-cm-seg button', { hasText: 'Todos' }).click();
await page.locator('.ad-cm-thread', { hasText: 'Revisar con' }).locator('.ad-cm-anchor').click();
await page.waitForTimeout(500);
check(await page.locator('.react-flow__node.selected', { hasText: 'Alta de cliente' }).count() === 1, 'ir al ancla selecciona el nodo');
await page.screenshot({ path: `${out}/comments-6-all.png` });
// Inspector: sección de comentarios del elemento
check(await page.locator('.ad-insp .ad-cm-section .ad-cm-mini').count() === 1, 'inspector muestra el hilo del elemento');

// 6. Tema oscuro
await page.evaluate(() => localStorage.setItem('alldraw:theme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.locator('.ad-cm-toolbtn').click();
await page.waitForTimeout(400);
check(await page.locator('.ad-cm-thread').count() === 1, 'tras recargar persiste (IndexedDB)');
await page.screenshot({ path: `${out}/comments-7-dark.png` });
await page.evaluate(() => localStorage.removeItem('alldraw:theme'));

// 7. Móvil: el panel ocupa el lienzo; se abre desde la hoja "Más"
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.getByRole('button', { name: 'Más opciones' }).click();
await page.locator('.ad-sheet .ad-cm-toolbtn').click();
await page.waitForSelector('.ad-cm-panel');
await page.waitForTimeout(300);
check(await page.locator('.ad-sheet').count() === 0, 'móvil: la hoja se cierra al abrir comentarios');
await page.screenshot({ path: `${out}/comments-8-mobile.png` });

console.log('ERRORS', errors.length, errors.slice(0, 10));
await browser.close();
process.exit(errors.length ? 1 : 0);
