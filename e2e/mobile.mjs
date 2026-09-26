// Interfaz adaptable y táctil: móvil (390×844, táctil) y tableta (900×700).
// Comprueba que no hay scroll horizontal, que en móvil aparece la barra inferior y las hojas,
// que la pulsación larga abre el menú contextual y que en tableta los paneles se colapsan y persisten.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:4196', out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [], fails = [];
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'FAIL'} ${name}`); if (!ok) fails.push(name); };
const noHScroll = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const watch = (page) => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); }); };
const openDemo = async (page) => {
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Abrir la demo/ }).click();
  await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(600);
};

// ---------------------------------------------------------------- móvil
{
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); watch(page);
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/mobile-home.png` });
  check('mobile home: sin scroll horizontal', await noHScroll(page));
  await openDemo(page);
  await page.screenshot({ path: `${out}/mobile-editor.png` });
  check('mobile editor: sin scroll horizontal', await noHScroll(page));
  check('mobile: barra inferior visible', await page.locator('.ad-tabbar').isVisible());
  check('mobile: barra superior compacta', await page.locator('.ad-toolbar--compact').count() === 1);
  check('mobile: sin paneles laterales', await page.locator('.ad-editor__left, .ad-editor__body > .ad-insp').count() === 0);
  const canvasBox = await page.locator('.ad-canvas').boundingBox();
  check('mobile: lienzo ocupa el ancho', Math.round(canvasBox.width) === 390);
  // Hoja de vistas
  await page.getByRole('button', { name: 'Vistas' }).click();
  await page.waitForSelector('.ad-sheet'); await page.waitForTimeout(350);
  check('mobile: hoja de vistas abierta', await page.locator('.ad-sheet .ad-views').isVisible());
  const sheetBox = await page.locator('.ad-sheet').boundingBox();
  check('mobile: hoja ~70 % de alto', Math.abs(sheetBox.height - 844 * 0.7) < 12);
  await page.screenshot({ path: `${out}/mobile-sheet-views.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('mobile: Escape cierra la hoja', await page.locator('.ad-sheet').count() === 0);
  // Hoja Añadir: un toque añade un nodo al centro
  const before = await page.locator('.react-flow__node').count();
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.waitForSelector('.ad-sheet .ad-pal'); await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/mobile-sheet-add.png` });
  await page.locator('.ad-sheet .ad-pal__item[draggable]').first().tap();
  await page.waitForTimeout(400);
  check('mobile: toque en la paleta añade un nodo', (await page.locator('.react-flow__node').count()) === before + 1);
  check('mobile: la hoja se cierra al añadir', await page.locator('.ad-sheet').count() === 0);
  // Inspector con el nodo recién creado seleccionado
  await page.getByRole('button', { name: 'Inspector' }).click();
  await page.waitForSelector('.ad-sheet .ad-insp'); await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/mobile-sheet-inspector.png` });
  check('mobile: hoja inspector', await page.locator('.ad-sheet .ad-insp').isVisible());
  // Tocar fuera cierra
  await page.touchscreen.tap(195, 60); await page.waitForTimeout(200);
  check('mobile: tocar fuera cierra la hoja', await page.locator('.ad-sheet').count() === 0);
  // Más (desde la barra superior "⋯")
  await page.getByRole('button', { name: 'Más opciones' }).click();
  await page.waitForSelector('.ad-sheet__more'); await page.waitForTimeout(350);
  check('mobile: hoja Más con exportar/importar', await page.locator('.ad-sheet__more').getByRole('button', { name: /Exportar|Importar/ }).count() > 0);
  await page.screenshot({ path: `${out}/mobile-sheet-more.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // Pulsación larga sobre un nodo → menú contextual
  const node = page.locator('.react-flow__node', { hasText: 'Cliente' }).first();
  const nb = await node.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const tp = { x: nb.x + nb.width / 2, y: nb.y + nb.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp] });
  await page.waitForTimeout(700);
  const menuOpen = await page.locator('.ad-popover').count() > 0;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  check('mobile: pulsación larga abre el menú contextual', menuOpen);
  await page.screenshot({ path: `${out}/mobile-longpress.png` });
  await page.keyboard.press('Escape');
  // Pan con un dedo mueve el viewport
  const tr0 = await page.locator('.react-flow__viewport').evaluate(el => el.style.transform);
  // Un punto vacío del lienzo (sobre el pane, no sobre un nodo ni sus asas)
  const empty = await page.evaluate(() => { for (let y = 120; y < 700; y += 20) for (let x = 20; x < 380; x += 20) { const el = document.elementFromPoint(x, y); if (el && el.classList.contains('react-flow__pane')) return { x, y }; } return null; });
  check('mobile: hay un punto vacío del lienzo', !!empty);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [empty] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: empty.x + i * 12, y: empty.y + i * 10 }] }); await page.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const tr1 = await page.locator('.react-flow__viewport').evaluate(el => el.style.transform);
  check('mobile: pan con un dedo', tr0 !== tr1);
  // Tema oscuro → theme-color
  await page.getByRole('button', { name: 'Más', exact: true }).click(); await page.waitForSelector('.ad-sheet__more');
  await page.locator('.ad-sheet__more').getByRole('button', { name: /Tema/ }).click(); await page.waitForTimeout(100);
  const isDark = await page.locator('.ad-editor.theme-dark').count() === 1;
  const themeColor = await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'));
  check('mobile: theme-color sigue al tema', isDark ? themeColor === '#161a22' : themeColor === '#ffffff');
  await page.screenshot({ path: `${out}/mobile-dark.png` });
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ---------------------------------------------------------------- tableta
{
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage(); watch(page);
  await page.evaluate(() => localStorage.removeItem('alldraw:panels')).catch(() => {});
  await openDemo(page);
  await page.screenshot({ path: `${out}/tablet-editor.png` });
  check('tablet: sin scroll horizontal', await noHScroll(page));
  check('tablet: paneles visibles al inicio', await page.locator('.ad-editor__left').count() === 1 && await page.locator('.ad-editor__body > .ad-insp').count() === 1);
  check('tablet: sin barra inferior', await page.locator('.ad-tabbar').count() === 0);
  await page.getByRole('button', { name: 'Mostrar u ocultar vistas y paleta' }).click();
  await page.getByRole('button', { name: 'Mostrar u ocultar el inspector' }).click();
  await page.waitForTimeout(300);
  check('tablet: paneles colapsados', await page.locator('.ad-editor__left, .ad-editor__body > .ad-insp').count() === 0);
  const cb = await page.locator('.ad-canvas').boundingBox();
  check('tablet: lienzo a todo el ancho', Math.round(cb.width) === 900);
  await page.screenshot({ path: `${out}/tablet-collapsed.png` });
  check('tablet: estado en localStorage', await page.evaluate(() => localStorage.getItem('alldraw:panels')) === '{"left":false,"right":false}');
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(400);
  check('tablet: persiste tras recargar', await page.locator('.ad-editor__left, .ad-editor__body > .ad-insp').count() === 0);
  await page.getByRole('button', { name: 'Mostrar u ocultar vistas y paleta' }).click();
  await page.getByRole('button', { name: 'Mostrar u ocultar el inspector' }).click();
  await page.waitForTimeout(300);
  check('tablet: paneles expandidos de nuevo', await page.locator('.ad-editor__left').count() === 1 && await page.locator('.ad-editor__body > .ad-insp').count() === 1);
  check('tablet: sin scroll horizontal con paneles', await noHScroll(page));
  await page.screenshot({ path: `${out}/tablet-expanded.png` });
  await page.evaluate(() => localStorage.removeItem('alldraw:panels'));
  await ctx.close();
}

console.log('ERRORS', errors);
await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
