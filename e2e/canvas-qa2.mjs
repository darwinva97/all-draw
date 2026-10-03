// QA2 · lienzo e interacción (informe docs/qa/2026-10-03-informe.md, fallos 2, 3, 4, 14, 17, 22, 23, 66, 69, 71, 72, 73, 76).
//
//   cd apps/web && pnpm dev --port 4331
//   BASE=http://127.0.0.1:4331 node e2e/canvas-qa2.mjs
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = [];
const errors = [];
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg); };

async function open(locale = 'es-ES', lang) {
  const page = await browser.newPage({ locale, viewport: { width: 1440, height: 900 } });
  await page.addInitScript((l) => { localStorage.setItem('alldraw:tour', 'done'); if (l) localStorage.setItem('alldraw:lang', l); }, lang);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of 401|Failed to load resource|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Abrir la demo|Probar sin cuenta|Open the demo|Try it without/ }).first().click();
  await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(400);
  return page;
}
async function template(page, name) {
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.tpl'); await page.waitForTimeout(150);
  const more = page.locator('.tpl__more[aria-expanded=false]');
  if (await more.count()) await more.click();
  await page.getByRole('button', { name: `Crear desde la plantilla «${name}»` }).click();
  await page.waitForSelector('.react-flow'); await page.waitForTimeout(700);
}
const node = (page, name) => page.locator('.react-flow__node', { hasText: name }).first();
const vp = page => page.evaluate(() => document.querySelector('.react-flow__viewport')?.style.transform ?? '');
async function drop(page, typeId, x, y) {
  await page.evaluate(({ typeId, x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-all-draw-type', typeId); const el = document.elementFromPoint(x, y); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { typeId, x, y });
  await page.waitForTimeout(400);
}
/** Arrastra desde el manejador inferior de `from` hasta el centro (cuerpo) de `to`. */
async function connectToBody(page, from, to) {
  await from.hover();
  const h = await from.locator('.react-flow__handle.source').first().boundingBox();
  const d = await to.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
  await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 10 });
  await page.mouse.up(); await page.waitForTimeout(400);
}

// ---------------------------------------------------------------- demo (ArchiMate)
let page = await open();
// 3 + 17: soltar en el centro del nodo abre el selector, con nombres (sin ids de notación) y la trazabilidad aparte
await connectToBody(page, node(page, 'Servicio de onboarding'), node(page, 'Cliente'));
const picker = page.locator('.ad-relpicker');
check(await picker.count() === 1, '3: soltar sobre el cuerpo del destino abre «Tipo de relación»');
const items = await picker.locator('.ad-popover__item').allInnerTexts();
const section = await picker.locator('.ad-popover__section').allInnerTexts();
check(items.every(t => !/\b(archimate|core|bpmn)\b/.test(t)), `17: opciones sin ids de notación (${items.join(' | ')})`);
check(section.length === 1 && /Trazabilidad/i.test(section[0]), '17: genéricas bajo «Trazabilidad»');
check(items.indexOf('Serving') >= 0 && items.indexOf('Serving') < items.indexOf('Association') && items.indexOf('Association') < items.indexOf('Traza'), '17: Serving antes que Association; las de la notación antes que las genéricas');
check(await page.evaluate(() => document.activeElement?.closest('.ad-relpicker') !== null), '17: el foco entra en el selector');
await page.keyboard.press('Escape');
// 23: textos de React Flow en español y aristas con nombres
const controls = await page.locator('.react-flow__controls button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
check(controls.includes('Acercar') && controls.includes('Alejar') && controls.includes('Ajustar a la vista'), `23: controles en español (${controls.join(', ')})`);
const edgeLabel = await page.locator('.react-flow__edge').first().getAttribute('aria-label');
check(/→/.test(edgeLabel ?? '') && !/vn_|Edge from/.test(edgeLabel ?? ''), `23: arista anunciada como «origen → destino (tipo)»: ${edgeLabel}`);
check(await page.locator('.react-flow__minimap title').textContent() === 'Minimapa', '23: minimapa en español');
// 76: minimapa más pequeño y translúcido
const mm = await page.locator('.react-flow__minimap').evaluate(el => ({ w: el.getBoundingClientRect().width, op: Number(getComputedStyle(el).opacity) }));
check(mm.w <= 172 && mm.op < 1, `76: minimapa translúcido y más pequeño (${JSON.stringify(mm)})`);
// 22: foco visible al tabular: primero las aristas (trazo resaltado) y luego los nodos (contorno)
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Tab');
const edgeFocus = await page.evaluate(() => { const a = document.activeElement; const p = a?.querySelector('.react-flow__edge-path'); return { edge: !!a?.classList.contains('react-flow__edge'), w: p ? getComputedStyle(p).strokeWidth : '' }; });
check(!edgeFocus.edge || edgeFocus.w === '3px', `22: arista enfocada con el trazo resaltado (${JSON.stringify(edgeFocus)})`);
for (let i = 0; i < 40 && !(await page.evaluate(() => document.activeElement?.classList.contains('react-flow__node'))); i++) await page.keyboard.press('Tab');
const focus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { node: a.classList.contains('react-flow__node'), outline: cs.outlineStyle, w: cs.outlineWidth, label: a.getAttribute('aria-label') }; });
check(focus.node && focus.outline !== 'none' && focus.w !== '0px', `22: nodo enfocado con contorno visible (${JSON.stringify(focus)})`);
check(!!focus.label && !focus.label.startsWith('vn_'), `23: nodo anunciado por su nombre (${focus.label})`);
// 14: Supr sobre el nodo enfocado y Ctrl+Z inmediatamente
const count = () => page.locator('.react-flow__node').count();
const n0 = await count();
await node(page, 'Gestor comercial').click();
await page.keyboard.press('Delete'); await page.waitForTimeout(300);
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
check(await count() === n0, '14: Supr y Ctrl+Z seguido devuelve el nodo');
// 14: pegar, enfocar lo pegado, deshacer (desaparece lo enfocado) y pegar como copia
await node(page, 'Gestor comercial').click();
await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await page.waitForTimeout(300);
await page.locator('.react-flow__node.selected').last().focus();
await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
check(await page.evaluate(() => document.activeElement?.classList.contains('ad-canvas')), '14: al deshacer el pegado, el foco vuelve al lienzo');
await page.keyboard.press('Control+Shift+v'); await page.waitForTimeout(400);
check(await count() === n0 + 1, '14: Ctrl+Shift+V funciona después de deshacer');
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
// 69: abrir en otra dimensión (crear) → pista y botón para colocar el elemento
await node(page, 'Verificación KYC').click({ button: 'right' }); await page.waitForTimeout(200);
await page.locator('.ad-menu .ad-popover__item', { hasText: /Estados/ }).first().click(); await page.waitForTimeout(600);
const hint = await page.locator('.ad-canvas-hint').innerText().catch(() => '');
check(/Verificación KYC/.test(hint) && /Estado/.test(hint), `69: la vista nueva explica qué hacer (${hint.replace(/\n+/g, ' / ')})`);
await page.locator('.ad-canvas-hint button').click(); await page.waitForTimeout(400);
check(await count() === 1 && await page.locator('.ad-canvas-hint').count() === 0, '69: «Colocar…» pone el elemento en la vista');
// Atenuado: en la vista C4, los elementos de otra notación (el rol ArchiMate) se ven al 45 % (antes, `opacity: 1` en línea)
await page.locator('.ad-views__item', { hasText: 'CRM · Contenedores' }).first().click(); await page.waitForTimeout(600);
const dimmed = await page.locator('.ad-node.is-dimmed').evaluateAll(ns => ns.map(n => getComputedStyle(n).opacity));
check(dimmed.length > 0 && dimmed.every(o => o === '0.45'), `atenuado: elementos de otra notación al 45 % (${dimmed.join(', ')})`);
// 71: en secuencia, el círculo de «mensaje a sí mismo» no se ve si no se está conectando
await page.locator('.ad-views__item', { hasText: 'Alta de cliente · Secuencia' }).first().click(); await page.waitForTimeout(600);
await page.mouse.move(5, 5);
const selfOp = await page.locator('.ad-seq-handle--self').first().evaluate(el => getComputedStyle(el).opacity);
check(selfOp === '0', `71: el círculo de mensaje a sí mismo está oculto en reposo (opacity ${selfOp})`);
await page.close();

// ---------------------------------------------------------------- plantillas
page = await open();
// 2: primer elemento en una vista vacía, sin zoom al 400 %
await template(page, 'Espacio en blanco');
check(/Arrastra aquí un tipo/.test(await page.locator('.ad-canvas-hint').innerText().catch(() => '')), '69: la vista vacía dice qué hacer');
const pane = await page.locator('.react-flow__pane').boundingBox();
await drop(page, 'freeform:box', pane.x + 200, pane.y + 200);
check(/scale\(1\)/.test(await vp(page)), `2: tras soltar el primero el zoom sigue al 100 % (${await vp(page)})`);
await drop(page, 'freeform:ellipse', pane.x + 500, pane.y + 200);
const second = await page.locator('.react-flow__node').nth(1).boundingBox();
check(Math.abs(second.x + second.width / 2 - (pane.x + 500)) < 3 && second.width < 200, `2: el segundo cae donde se suelta y a tamaño normal (${JSON.stringify(second)})`);
// 73: un nodo sin nombre propio no repite el tipo
await drop(page, 'bpmn:Task', pane.x + 300, pane.y + 400);
check((await node(page, 'Tarea').innerText()).split('\n').filter(t => t.trim() === 'Tarea').length === 1, '73: «Tarea» aparece una sola vez');
// 66: Ctrl+0 conserva el centro
await page.locator('.ad-canvas').focus();
await page.keyboard.press('+'); await page.waitForTimeout(250); await page.keyboard.press('+'); await page.waitForTimeout(250);
const center = async () => page.evaluate(() => { const c = document.querySelector('.ad-canvas').getBoundingClientRect(); const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([\d.]+)\)/.exec(document.querySelector('.react-flow__viewport').style.transform); const [x, y, z] = m.slice(1).map(Number); return { x: (c.width / 2 - x) / z, y: (c.height / 2 - y) / z, z }; });
const c1 = await center();
await page.keyboard.press('Control+0'); await page.waitForTimeout(400);
const c2 = await center();
check(c2.z === 1 && Math.abs(c1.x - c2.x) < 2 && Math.abs(c1.y - c2.y) < 2, `66: Ctrl+0 vuelve al 100 % sin mover el centro (${JSON.stringify([c1, c2])})`);

// 4: compartimentos de clase y de entidad, con los pines de los atributos a la altura de su fila
await template(page, 'Diagrama de clases UML');
const cliente = node(page, 'Cliente');
const rows = await cliente.locator('.ad-cls__row').allInnerTexts();
check(rows.some(r => /nombre: String/.test(r)) && rows.some(r => /realizarPedido/.test(r)), `4: la clase muestra atributos y operaciones (${rows.join(' | ')})`);
check(/«interface»/.test(await node(page, 'Pagable').innerText()), '4: la interfaz muestra «interface»');
check(/PENDIENTE/.test(await page.locator('.react-flow__node', { hasText: '«enumeration»' }).first().innerText()), '4: la enumeración muestra sus literales');
await template(page, 'Modelo entidad-relación');
const ent = node(page, 'Cliente');
check(await ent.locator('.ad-cls__row.is-pk').count() === 1, '4: la entidad marca la clave primaria');
const align = await ent.evaluate(n => {
  const row = n.querySelectorAll('.ad-cls__row')[1].getBoundingClientRect();
  const h = [...n.querySelectorAll('.ad-handle--row')].find(x => x.dataset.handleid?.endsWith('#attributes.nombre') || x.getAttribute('data-handleid')?.endsWith('attributes.nombre'));
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return Math.abs((r.top + r.height / 2) - (row.top + row.height / 2));
});
check(align !== null && align < 2, `4: el pin del atributo está alineado con su fila (desvío ${align})`);

// 3: relación no válida en la notación → aviso que explica por qué
await template(page, 'Máquina de estados');
const fin = page.locator('.react-flow__node', { hasText: /^Final$/ }).first();
const ini = page.locator('.react-flow__node', { hasText: /^Inicial$/ }).first();
await connectToBody(page, fin, ini);
const toast = await page.locator('.ad-toast').allInnerTexts();
check(toast.some(t => /No hay relaciones válidas de «Final» a «Inicial»/.test(t) && /no puede ser origen/.test(t)), `3: aviso al soltar una relación prohibida (${toast.join(' / ')})`);
check(await page.locator('.ad-relpicker').count() === 0, '17: no se ofrecen relaciones genéricas entre tipos que la matriz prohíbe');
// 72: las etiquetas no se tapan entre sí ni tapan estados
const overlaps = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.ad-edge-label')].map(l => l.getBoundingClientRect());
  const nodes = [...document.querySelectorAll('.react-flow__node')].map(n => n.getBoundingClientRect());
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  let n = 0;
  labels.forEach((a, i) => { labels.forEach((b, j) => { if (i < j && hit(a, b)) n++; }); nodes.forEach(b => { if (hit(a, b)) n++; }); });
  return n;
});
check(overlaps === 0, `72: etiquetas sin solaparse con otras ni con nodos (${overlaps})`);
await page.close();

// ---------------------------------------------------------------- inglés
page = await open('en-US', 'en');
const en = await page.locator('.react-flow__controls button').evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
check(en.includes('Zoom in') && en.includes('Fit to view'), `23: controles en inglés (${en.join(', ')})`);
await page.close();

check(errors.length === 0, `sin errores de consola ${JSON.stringify(errors.slice(0, 3))}`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FALLOS` : '\nTODO OK');
process.exit(fails.length ? 1 : 0);
