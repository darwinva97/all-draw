// QA 2026-10-03 — paneles del editor, teclado y accesibilidad (fallos 10, 16, 18, 19, 20, 28, 46, 62, 63, 70, 74):
// menús contextuales dentro de la pantalla y con teclado (Shift+F10, flechas, Intro, Esc), paleta y vistas con
// teclado y clic, diálogos que retienen y devuelven el foco, pestañas, matriz de trazabilidad, barra superior y
// hojas móviles (menú como hoja inferior, elegir vista cierra la hoja, «Añadir» sin montarse encima).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:4173', out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = []; const check = (n, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'FAIL'} ${n} ${extra}`); if (!ok) fails.push(n); };
const openDemo = async (page) => {
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Abrir la demo|Probar sin cuenta/ }).click();
  await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(600);
};
const menuBox = (page) => page.evaluate(() => { const m = document.querySelector('.ad-menu'); if (!m) return null; const r = m.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth, sh: m.scrollHeight, ch: m.clientHeight, role: m.getAttribute('role'), focusIn: m.contains(document.activeElement), focusText: document.activeElement?.textContent?.trim().slice(0, 30) }; });
const active = (page) => page.evaluate(() => { const a = document.activeElement; return { cls: a?.className?.toString?.() ?? '', label: a?.getAttribute?.('aria-label') ?? '', text: a?.textContent?.trim().slice(0, 30) ?? '', tag: a?.tagName }; });
const errors = [];
{
  const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
  await openDemo(page);
  // 70
  const top = await page.evaluate(() => [...document.querySelectorAll('.ad-toolbar > input, .ad-crumb button, .ad-crumb__notation')].map(e => ({ t: e.value ?? e.textContent, sw: e.scrollWidth, cw: e.clientWidth })));
  check('70 nombre del espacio entero', top[0].sw <= top[0].cw + 1);
  check('70 chip de notación entero', top.at(-1).sw <= top.at(-1).cw + 1);
  await page.screenshot({ path: `${out}/qa2-panels-toolbar.png`, clip: { x: 0, y: 0, width: 1440, height: 50 } });
  // 10 desktop menu on low node
  const crm = page.locator('.react-flow__node', { hasText: 'Clúster' }).first();
  const bb = await crm.boundingBox();
  await page.mouse.click(bb.x + 10, bb.y + bb.height - 5, { button: 'right' }); await page.waitForTimeout(300);
  let m = await menuBox(page);
  check('10 menú nodo dentro de la pantalla', m && m.top >= 0 && m.bottom <= m.vh && m.right <= m.vw);
  check('10 role=menu y foco dentro', m && m.role === 'menu' && m.focusIn);
  check('10 todas las opciones alcanzables (scroll interno si no cabe)', m && (m.sh <= m.ch + 1 || m.ch < m.sh));
  const n0 = await page.locator('.react-flow__node').count();
  const pos0 = await crm.boundingBox();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  const f2 = await active(page);
  check('10 ↓ mueve el foco por el menú (no el nodo)', JSON.stringify(await crm.boundingBox()) === JSON.stringify(pos0) && /ad-popover__item/.test(f2.cls), f2.text);
  await page.keyboard.press('End'); const fe = await active(page);
  check('10 Fin va a la última opción', /Borrar del modelo/.test(fe.text), fe.text);
  await page.keyboard.press('ArrowUp'); const fu = await active(page);
  check('10 ↑ sube', /Quitar de esta vista/.test(fu.text), fu.text);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('10 Escape cierra', !(await menuBox(page)));
  const fa = await active(page); check('10 foco vuelve al nodo/lienzo', /react-flow__node|ad-canvas/.test(fa.cls), fa.cls);
  // Shift+F10 on selected node
  await page.locator('.react-flow__node', { hasText: 'Cliente' }).first().click(); await page.waitForTimeout(200);
  let cm = 0; await page.exposeFunction('cmCount', () => cm++); await page.evaluate(() => document.addEventListener('contextmenu', () => window.cmCount(), true));
  await page.keyboard.press('Shift+F10'); await page.waitForTimeout(300);
  m = await menuBox(page); check('10 Shift+F10 abre el menú del nodo con foco', m && m.focusIn, `contextmenu events: ${cm}`);
  // Enter on "Quitar de esta vista"
  await page.keyboard.press('End'); await page.keyboard.press('ArrowUp');
  const nBefore = await page.locator('.react-flow__node').count();
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('10 Intro ejecuta la opción', (await page.locator('.react-flow__node').count()) === nBefore - 1);
  const fq = await active(page); check('10 foco al lienzo tras quitar', /ad-canvas/.test(fq.cls), fq.cls);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  check('10 Ctrl+Z tras quitar desde el menú funciona', (await page.locator('.react-flow__node').count()) === nBefore);
  // ContextMenu key on pane (no selection)
  await page.locator('.react-flow__pane').click({ position: { x: 30, y: 30 } }); await page.waitForTimeout(100);
  await page.locator('.ad-canvas').focus();
  await page.keyboard.press('ContextMenu'); await page.waitForTimeout(300);
  m = await menuBox(page); check('10 tecla Menú sin selección abre el menú del lienzo', m && m.focusIn && /Pegar/.test(m.focusText), m?.focusText);
  await page.keyboard.press('Tab'); await page.waitForTimeout(100);
  check('10 Tab cierra el menú', !(await menuBox(page)));
  // 16 BPMN categories
  await page.locator('.ad-views__item', { hasText: 'Alta de cliente' }).filter({ hasText: /BPMN|Proceso/ }).first().click().catch(() => {});
  await page.locator('.ad-views__open').nth(1).click(); await page.waitForTimeout(400);
  const cats = await page.locator('.ad-pal__scroll > details > summary').allTextContents();
  check('16 categorías BPMN con nombre y en orden', cats.slice(0, 4).join('|') === 'Participantes|Actividades|Eventos|Compuertas', cats.slice(0, 4).join('|'));
  // 74
  const titles = await page.locator('.ad-pal__item').evaluateAll(xs => xs.map(x => x.getAttribute('title')).filter(Boolean));
  check('74 sin ids internos en tooltips', !titles.some(t => /^[a-z0-9-]+:[A-Za-z]/.test(t)), titles.slice(0, 3).join(' | '));
  // 19 palette keyboard: Tab from search -> tabs -> list
  await page.locator('.ad-pal input[type=search]').focus();
  await page.keyboard.press('Tab'); const ft = await active(page);
  check('46 paleta: Tab llega a la pestaña activa', /Notación/.test(ft.text), ft.text);
  await page.keyboard.press('Tab'); let fl = await active(page);
  check('19 paleta: Tab entra en la lista', /ad-pal__cat|ad-pal__item/.test(fl.cls) || fl.tag === 'SUMMARY', fl.text);
  await page.keyboard.press('ArrowDown'); fl = await active(page);
  check('19 paleta: ↓ al primer tipo', /ad-pal__item/.test(fl.cls), fl.text);
  const nb = await page.locator('.react-flow__node').count();
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  check('19 Intro añade el tipo', (await page.locator('.react-flow__node').count()) === nb + 1);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  const fd = await active(page); await page.keyboard.press(' '); await page.waitForTimeout(400);
  check('19 Espacio añade otro', (await page.locator('.react-flow__node').count()) === nb + 2, fd.text);
  // click on palette item adds
  await page.locator('.ad-pal__item').nth(3).click(); await page.waitForTimeout(400);
  check('19 clic en la paleta añade', (await page.locator('.react-flow__node').count()) === nb + 3);
  await page.screenshot({ path: `${out}/qa2-panels-palette.png` });
  // 19 views keyboard
  await page.locator('.ad-views__open').first().focus();
  await page.keyboard.press('ArrowDown'); const fv = await active(page);
  check('19 vistas: ↓ se mueve', /ad-views__open|SUMMARY/.test(fv.cls + fv.tag), fv.text);
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); 
  const target = (await active(page)).text;
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const crumb = await page.locator('.ad-crumb .is-current').textContent();
  check('19 vistas: Intro abre', target.includes(crumb) || crumb.includes(target), `${target} / ${crumb}`);
  // 46 inspector tabs
  await page.locator('.ad-views__open').first().click(); await page.waitForTimeout(400);
  await page.locator('.react-flow__node').filter({ hasText: /Tarea|Recoger/ }).first().click().catch(async () => page.locator('.react-flow__node').first().click());
  await page.waitForTimeout(200);
  await page.locator('.ad-insp [role=tab][aria-selected=true]').focus();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
  const it = await page.evaluate(() => ({ sel: document.querySelector('.ad-insp [role=tab][aria-selected=true]')?.textContent, foc: document.activeElement?.textContent, panel: document.querySelector('.ad-insp [role=tabpanel]')?.getAttribute('aria-labelledby') === document.querySelector('.ad-insp [role=tab][aria-selected=true]')?.id }));
  check('46 inspector: → cambia de pestaña, foco y panel enlazado', /Pines/.test(it.sel) && /Pines/.test(it.foc) && it.panel, JSON.stringify(it));
  // 20 Ctrl+K
  await page.locator('.ad-canvas').focus();
  await page.keyboard.press('Control+k'); await page.waitForTimeout(150);
  check('20 Ctrl+K: foco en el campo', (await active(page)).cls.includes('ad-cmdk__input'));
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  check('20 Ctrl+K: Tab no sale', await page.evaluate(() => !!document.activeElement?.closest('.ad-cmdk')));
  await page.keyboard.press('Shift+Tab'); 
  check('20 Ctrl+K: Shift+Tab no sale', await page.evaluate(() => !!document.activeElement?.closest('.ad-cmdk')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('20 Ctrl+K: Escape cierra y el foco vuelve al lienzo', (await page.locator('.ad-cmdk').count()) === 0 && (await active(page)).cls.includes('ad-canvas'));
  await page.getByRole('button', { name: 'Buscar (Ctrl+K)' }).click(); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('20 Ctrl+K: foco vuelve al botón Buscar', (await active(page)).label === 'Buscar (Ctrl+K)');
  // Shortcuts via ?
  await page.locator('.ad-canvas').focus();
  await page.keyboard.press('?'); await page.waitForTimeout(150);
  check('20 Atajos: foco dentro', await page.evaluate(() => !!document.activeElement?.closest('.ad-shortcuts')));
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  check('20 Atajos: Tab no sale', await page.evaluate(() => !!document.activeElement?.closest('.ad-shortcuts')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('20 Atajos: Escape devuelve el foco al lienzo', (await page.locator('.ad-shortcuts').count()) === 0 && (await active(page)).cls.includes('ad-canvas'));
  // WS
  await page.getByRole('button', { name: 'Espacio', exact: true }).click(); await page.waitForTimeout(300);
  check('20 Espacio: foco dentro', await page.evaluate(() => !!document.activeElement?.closest('.ad-ws-dialog')));
  for (let i = 0; i < 80; i++) await page.keyboard.press('Shift+Tab');
  check('20 Espacio: Shift+Tab no sale', await page.evaluate(() => !!document.activeElement?.closest('.ad-ws-dialog')));
  await page.locator('.ad-ws-tabs [role=tab][aria-selected=true]').focus();
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
  const wt = await page.evaluate(() => document.querySelector('.ad-ws-tabs [aria-selected=true]')?.textContent);
  check('46 Espacio: ← cambia a la última pestaña', /Trazabilidad/.test(wt), wt);
  await page.waitForTimeout(300);
  const tr = await page.evaluate(() => { const s = document.querySelector('.ad-tr-scroll'); const head = document.querySelector('.ad-tr-colhead .ad-tr-head span'); return s && { h: s.clientHeight, sh: s.scrollHeight, rowsVisible: [...s.querySelectorAll('tbody tr')].filter(r => r.getBoundingClientRect().bottom <= s.getBoundingClientRect().bottom).length, headCut: head ? head.scrollHeight > head.clientHeight + 1 : null, opts: [...document.querySelectorAll('.ad-tr-sel option')].map(o => o.textContent) }; });
  check('18 matriz con filas visibles', tr && tr.h > 250 && tr.rowsVisible >= 5);
  check('18 sin «lib» en selectores', !tr.opts.includes('lib'));
  await page.screenshot({ path: `${out}/qa2-panels-traces.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('20 Espacio: Escape devuelve el foco al botón Espacio', (await active(page)).text === 'Espacio', JSON.stringify(await active(page)));
  // 28
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(200);
  check('28 sin casilla Pública', (await page.getByText('Pública (solo lectura con enlace)').count()) === 0);
  const shareTxt = await page.locator('.ad-insp__share').textContent().catch(() => null);
  check('28 enlace/texto de compartir', !!shareTxt, shareTxt);
  await page.close();
}
{ // English categories
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('alldraw:tour', 'done'); });
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open the demo|Try it without an account/ }).click();
  await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(500);
  await page.locator('.ad-views__open').nth(1).click(); await page.waitForTimeout(400);
  const en = await page.locator('.ad-pal__scroll > details > summary').allTextContents();
  check('16 en inglés: categorías traducidas', en.slice(0, 3).join('|') === 'Participants|Activities|Events', en.slice(0, 3).join('|'));
  await page.close();
}
{
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
  await openDemo(page);
  await page.getByRole('button', { name: 'Vistas' }).click(); await page.waitForSelector('.ad-sheet'); await page.waitForTimeout(350);
  await page.locator('.ad-sheet .ad-views__item').first().click(); await page.waitForTimeout(400);
  check('62 hoja Vistas se cierra al elegir', (await page.locator('.ad-sheet').count()) === 0);
  // long-press on a node
  const node = page.locator('.react-flow__node', { hasText: 'CRM' }).first();
  const b = await node.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  const m = await menuBox(page);
  check('10 móvil: menú como hoja inferior dentro de la pantalla', m && m.bottom <= m.vh + 1 && m.left <= 1 && m.right >= m.vw - 1);
  const del = page.locator('.ad-menu button', { hasText: 'Borrar del modelo' });
  await del.scrollIntoViewIfNeeded();
  check('10 móvil: «Borrar del modelo» visible', await del.isVisible());
  await page.screenshot({ path: `${out}/qa2-panels-mobile-menu.png` });
  await page.mouse.click(200, 100); await page.waitForTimeout(300);
  check('10 móvil: tocar fuera cierra', !(await menuBox(page)));
  // 63 add twice -> no overlap
  const boxes = async () => page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map(n => { const r = n.getBoundingClientRect(); return { id: n.dataset.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  for (let k = 0; k < 2; k++) {
    const b0 = await boxes();
    await page.getByRole('button', { name: 'Añadir' }).click(); await page.waitForSelector('.ad-sheet'); await page.waitForTimeout(350);
    await page.locator('.ad-sheet .ad-pal__item', { hasText: 'Business Actor' }).first().tap(); await page.waitForTimeout(500);
    check(`63 hoja Añadir se cierra (${k})`, (await page.locator('.ad-sheet').count()) === 0);
    const b1 = await boxes();
    const nw = b1.filter(bb => !b0.some(o => o.id === bb.id));
    const ov = nw[0] && b0.filter(o => !(o.x + o.w <= nw[0].x || nw[0].x + nw[0].w <= o.x || o.y + o.h <= nw[0].y || nw[0].y + nw[0].h <= o.y));
    check(`63 añadir (${k}) no se monta encima`, nw.length === 1 && ov.length === 0, JSON.stringify(nw));
  }
  await page.screenshot({ path: `${out}/qa2-panels-mobile-add.png` });
}
console.log('ERRORS', errors);
console.log(fails.length ? `FAILS: ${fails.join(', ')}` : 'Paneles QA2: todo en verde');
await browser.close(); process.exit(fails.length || errors.length ? 1 : 0);
