// Editor, ola 2: conectar con ayuda (verde/rojo y etiqueta), «Crear y conectar» al soltar en vacío (un solo deshacer),
// Ctrl+K (erratas, «Añadir <tipo>», «Ir a la vista…», exportar), paleta (recientes, favoritos, categorías que se
// recuerdan), ayuda por campo en el inspector, «about» de las plantillas en la galería y nota de bienvenida.
//
//   pnpm dev --port 4351
//   BASE=http://127.0.0.1:4351 node e2e/editor-wave2.mjs
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = [];
const errors = [];
const check = (ok, msg, extra) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && extra !== undefined ? ` — ${extra}` : ''}`); if (!ok) fails.push(msg); };

const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/status of 40[14]|Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });

// ---- galería: cada plantilla dice qué muestra y cómo seguir
// Primera visita: `#/` es la portada; la galería de plantillas está en `#/espacios`.
await page.goto(base + '/#/espacios', { waitUntil: 'networkidle' });
await page.waitForSelector('.tpl'); await page.waitForTimeout(150);
const more = page.locator('.tpl__more[aria-expanded=false]');
if (await more.count()) await more.click();
const cards = await page.locator('.tpl').count();
const abouts = await page.locator('.tpl .tpl__about').allTextContents();
check(abouts.length === cards && abouts.every(a => a.split(/(?<=\.)\s+/).length >= 2), 'galería: cada tarjeta muestra su «about»', `${abouts.length}/${cards}`);
check(/Simular/.test(await page.getByRole('button', { name: 'Crear desde la plantilla «Proceso BPMN»' }).getAttribute('title') ?? ''), 'galería: el «about» entero en el título de la tarjeta');

// ---- crear desde la plantilla BPMN: nota de bienvenida plegable
await page.getByRole('button', { name: 'Crear desde la plantilla «Proceso BPMN»' }).click();
await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(700);
const welcome = page.locator('.ad-welcome');
check(await welcome.count() === 1 && /Simular/.test(await welcome.innerText()), 'bienvenida: la primera vista muestra la nota de la plantilla');
// La nota no tapa los nodos: el clic atraviesa el texto
const passThrough = await page.evaluate(() => { const p = document.querySelector('.ad-welcome__text'); if (!p) return false; const r = p.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return !!hit && !hit.closest('.ad-welcome'); });
check(passThrough, 'bienvenida: el texto deja pasar el puntero al lienzo');
await page.locator('.ad-welcome__toggle').click();
check(await page.locator('.ad-welcome__text').count() === 0 && await page.locator('.ad-welcome__toggle').getAttribute('aria-expanded') === 'false', 'bienvenida: se pliega');
await page.locator('.ad-welcome__close').click();
check(await welcome.count() === 0, 'bienvenida: se cierra');

const node = name => page.locator('.react-flow__node', { hasText: name }).first();
const counts = () => page.evaluate(() => ({ nodes: document.querySelectorAll('.react-flow__node').length, edges: document.querySelectorAll('.react-flow__edge').length }));
const center = async loc => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

// ---- conectar: verde sobre un destino válido, rojo (con el motivo) sobre uno que no
const from = node('Comprobar stock');
await from.hover();
const h = await from.locator('.react-flow__handle.source').first().boundingBox();
await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
let p = await center(node('Preparar el envío'));
await page.mouse.move(p.x, p.y, { steps: 12 }); await page.waitForTimeout(150);
const okTip = await page.locator('.ad-connect-tip').innerText().catch(() => '');
check(await page.locator('.react-flow__node.ad-connect-ok', { hasText: 'Preparar el envío' }).count() === 1 && /Flujo de secuencia/.test(okTip), 'conectar: destino válido en verde con la relación que se creará', okTip);
p = await center(node('Pedido recibido'));
await page.mouse.move(p.x, p.y, { steps: 8 }); await page.waitForTimeout(150);
const badTip = await page.locator('.ad-connect-tip.is-bad').innerText().catch(() => '');
check(await page.locator('.react-flow__node.ad-connect-bad', { hasText: 'Pedido recibido' }).count() === 1 && /No hay relaciones válidas/.test(badTip) && /pool/.test(badTip), 'conectar: destino no válido en rojo con el motivo', badTip);
check(await page.locator('.react-flow__node.ad-connect-ok').count() === 0, 'conectar: el verde anterior se quita');

// ---- soltar en vacío: «Crear y conectar»
const pool = await node('Tienda online').boundingBox();
const empty = { x: pool.x + 160, y: Math.min(pool.y + pool.height + 70, 860) };
await page.mouse.move(empty.x, empty.y, { steps: 10 }); await page.waitForTimeout(150);
check(/crear un elemento/.test(await page.locator('.ad-connect-tip').innerText().catch(() => '')), 'conectar: en vacío la etiqueta ofrece crear y conectar');
const before = await counts();
await page.mouse.up(); await page.waitForTimeout(250);
const menu = page.locator('.ad-create-menu');
check(await menu.count() === 1, 'crear y conectar: aparece el menú al soltar en vacío');
const firstItems = await menu.locator(':scope > .ad-create-item').allTextContents();
check(firstItems.length > 0 && firstItems.length <= 8 && firstItems.every(x => /Flujo de secuencia/.test(x)) && await menu.locator('details > summary', { hasText: 'Más tipos' }).count() === 1,
  'crear y conectar: los tipos con la relación habitual primero (y «Más tipos» para el resto)', firstItems.slice(0, 4).join(' | '));
check(await page.evaluate(() => document.activeElement?.classList.contains('ad-create-item')), 'crear y conectar: el foco entra en el menú');
await menu.locator('.ad-create-item', { hasText: 'Tarea' }).first().click(); await page.waitForTimeout(400);
const after = await counts();
check(after.nodes === before.nodes + 1 && after.edges === before.edges + 1, 'crear y conectar: crea el elemento y la relación', JSON.stringify({ before, after }));
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
const undone = await counts();
check(undone.nodes === before.nodes && undone.edges === before.edges, 'crear y conectar: un solo paso de deshacer', JSON.stringify(undone));

// ---- Ctrl+K: erratas, «Añadir <tipo>», recientes
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+k'); await page.waitForTimeout(150);
await page.keyboard.type('anadir tarae'); await page.waitForTimeout(150);
const top = await page.locator('.ad-cmdk__item').first().innerText();
check(/Añadir Tarea/.test(top), 'Ctrl+K: «Añadir Tarea» con una errata y sin tilde', top);
const n0 = (await counts()).nodes;
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
check((await counts()).nodes === n0 + 1, 'Ctrl+K: «Añadir Tarea» añade el elemento al lienzo');
check(/Tarea/.test(await page.locator('.ad-pal__quick', { hasText: 'Recientes' }).innerText().catch(() => '')), 'paleta: el tipo añadido sale en «Recientes»');
await page.keyboard.press('Control+k'); await page.waitForTimeout(150);
check(await page.locator('.ad-cmdk__section', { hasText: 'Recientes' }).count() === 1 && /Añadir Tarea/.test(await page.locator('.ad-cmdk__item').first().innerText()), 'Ctrl+K: lo último elegido, arriba en «Recientes»');
await page.keyboard.type('ir a la vista'); await page.waitForTimeout(100);
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
const ph = await page.locator('.ad-cmdk__input').getAttribute('placeholder');
const kinds = await page.locator('.ad-cmdk__item .ad-cmdk__label').allTextContents();
check(/Ir a la vista/.test(ph ?? '') && kinds.length >= 1 && kinds.includes('Proceso de pedido'), 'Ctrl+K: «Ir a la vista…» lista las vistas', `${ph} · ${kinds.join(', ')}`);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check(await page.locator('.ad-cmdk').count() === 1 && /Buscar elementos/.test(await page.locator('.ad-cmdk__input').getAttribute('placeholder') ?? ''), 'Ctrl+K: Escape vuelve de «Ir a la vista…» a la lista');
await page.locator('.ad-cmdk__input').fill('nueva vista'); await page.waitForTimeout(100);
await page.locator('.ad-cmdk__item', { hasText: 'Nueva vista…' }).first().click(); await page.waitForTimeout(100);
check((await page.locator('.ad-cmdk__item .ad-cmdk__label').allTextContents()).some(x => /Crear vista BPMN/.test(x)), 'Ctrl+K: «Nueva vista…» ofrece una por notación');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check(await page.locator('.ad-cmdk').count() === 0, 'Ctrl+K: Escape cierra');
// Exportar desde Ctrl+K (la app lo conecta a su menú Importar / Exportar)
await page.keyboard.press('Control+k'); await page.waitForTimeout(150);
await page.keyboard.type('exportar svg'); await page.waitForTimeout(150);
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.keyboard.press('Enter');
const file = await dl;
check(!!file && file.suggestedFilename().endsWith('.svg'), 'Ctrl+K: «Exportar la vista como SVG» descarga el SVG', file?.suggestedFilename());
await page.keyboard.press('Control+k'); await page.waitForTimeout(150);
await page.keyboard.type('documentacion'); await page.waitForTimeout(150);
check(/documentación de BPMN/.test(await page.locator('.ad-cmdk__item').first().innerText()), 'Ctrl+K: «Abrir la documentación de BPMN»');
await page.keyboard.press('Escape');

// ---- paleta: favoritos y categorías plegadas que se recuerdan
const row = page.locator('.ad-pal__row', { hasText: 'Compuerta exclusiva' }).first();
await row.hover();
await row.locator('.ad-pal__star').click(); await page.waitForTimeout(150);
check(/Compuerta exclusiva/.test(await page.locator('.ad-pal__quick', { hasText: 'Favoritos' }).innerText().catch(() => '')), 'paleta: la estrella añade a «Favoritos»');
await page.locator('.ad-pal__scroll details[data-cat="events"] > summary').click(); await page.waitForTimeout(150);
check(await page.locator('.ad-pal__scroll details[data-cat="events"]').evaluate(d => !d.open), 'paleta: se pliega «Eventos»');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(500);
check(await page.locator('.ad-pal__scroll details[data-cat="events"]').evaluate(d => !d.open) && await page.locator('.ad-pal__scroll details[data-cat="events"] .ad-pal__item').count() === 0, 'paleta: la categoría plegada se recuerda (y no monta sus tipos)');
check(await page.locator('.ad-pal__quick', { hasText: 'Favoritos' }).count() === 1, 'paleta: los favoritos se recuerdan');
check(await page.locator('.ad-welcome').count() === 0, 'bienvenida: cerrada sigue cerrada al volver');
// Teclado: F marca el tipo enfocado
await page.locator('.ad-pal__row', { hasText: 'Compuerta paralela' }).first().locator('.ad-pal__item').focus();
await page.keyboard.press('f'); await page.waitForTimeout(150);
check(/Compuerta paralela/.test(await page.locator('.ad-pal__quick', { hasText: 'Favoritos' }).innerText()), 'paleta: F marca el tipo enfocado como favorito');

// ---- inspector: ayuda por campo
await node('Comprobar stock').click(); await page.waitForTimeout(250);
const helps = await page.locator('.ad-insp .ad-field__help').allTextContents();
check(helps.some(x => /servicio \(automática\)/.test(x)), 'inspector: la ayuda del campo «Tipo de tarea» bajo el campo', helps.slice(0, 2).join(' | '));
check(await page.locator('.ad-insp .ad-field__info').count() >= helps.length && helps.length > 0, 'inspector: icono de información en los campos con ayuda');
const described = await page.locator('.ad-insp select').first().getAttribute('aria-describedby');
check(!!described && await page.locator(`[id="${described}"]`).count() === 1, 'inspector: el campo apunta a su ayuda (aria-describedby)');

// ---- en inglés: la ayuda y la nota, traducidas
await page.evaluate(() => localStorage.setItem('alldraw:lang', 'en'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(500);
await page.locator('.react-flow__node', { hasText: /Check stock|Comprobar stock/ }).first().click(); await page.waitForTimeout(250);
check((await page.locator('.ad-insp .ad-field__help').allTextContents()).some(x => /service \(automatic\)/.test(x)), 'inspector en inglés: ayuda traducida');

await page.close();
await browser.close();
console.log(`\n${fails.length ? `FALLOS: ${fails.length}` : 'todo bien'} · errores de página: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 8));
process.exit(fails.length || errors.length ? 1 : 0);
