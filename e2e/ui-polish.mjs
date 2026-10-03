// Interfaz pulida: portada, inicio con plantillas, recorrido guiado, menú de ayuda, avisos, diálogos y estados.
// Uso: cd apps/web && pnpm dev --port 4311   (en otra terminal)
//      BASE=http://127.0.0.1:4311 node e2e/ui-polish.mjs      (capturas en $OUT/ui-*.png, por defecto /tmp/shots)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [], fails = [];
const check = (ok, name) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fails.push(name); };
const watch = (page) => {
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of 40[14]|Failed to load resource|example\.com\/logo\.png/.test(m.text())) errors.push('console: ' + m.text()); });
};
const shot = (page, name, full = false) => page.screenshot({ path: `${out}/ui-${name}.png`, fullPage: full });
const nodes = (page) => page.locator('.react-flow__node').count();

// ------------------------------------------------------------------ escritorio
const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(); watch(page);

// Portada (visitante sin sesión ni espacios)
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.waitForSelector('.lp-hero h1');
check(await page.locator('h1').count() === 1, 'portada: un h1');
await page.waitForSelector('.lp-viewer__stage img.is-on', { timeout: 15000 });
check(await page.locator('.lp-viewer__tab').count() === 5, 'portada: cinco dimensiones en el visor');
await page.waitForTimeout(400);
await shot(page, 'landing');
await shot(page, 'landing-full', true);
await page.getByRole('tab', { name: 'Proceso' }).click();
await page.waitForTimeout(500);
check(await page.getByRole('tab', { name: 'Proceso' }).getAttribute('aria-selected') === 'true', 'portada: elegir una dimensión');
await shot(page, 'landing-bpmn');
check(await page.locator('.lp-notations__chip').count() >= 10, 'portada: notaciones soportadas');
check(await page.locator('footer a[href="#/docs/privacidad"]').count() === 1 && await page.locator('footer a[href="#/docs/terminos"]').count() === 1, 'portada: pie con privacidad y términos');
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(600);
await shot(page, 'landing-dark');
await page.emulateMedia({ colorScheme: 'light' });

// #/bienvenida siempre accesible
await page.goto(base + '/#/bienvenida');
await page.waitForSelector('.lp-hero h1');
check(true, 'portada en #/bienvenida');

// Probar sin cuenta → demo local → recorrido (primer acceso)
await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
await page.waitForURL(/#\/w\//);
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
await page.waitForSelector('.tour__pop', { timeout: 5000 });
const steps = await page.locator('.tour__dots i').count();
check(steps >= 6 && steps <= 8, `recorrido: ${steps} pasos`);
for (let i = 1; i <= steps; i++) {
  await page.waitForTimeout(350);
  check(await page.locator(`.tour[data-tour-step="${i}"]`).count() === 1, `recorrido: paso ${i}`);
  await shot(page, `tour-${i}`);
  if (i === 2) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150); check(await page.locator('.tour[data-tour-step="1"]').count() === 1, 'recorrido: ← vuelve atrás'); await page.keyboard.press('ArrowRight'); }
  await page.keyboard.press(i === steps ? 'Enter' : 'ArrowRight');
}
await page.waitForTimeout(300);
check(await page.locator('.tour').count() === 0, 'recorrido: se cierra al terminar');
check(await page.evaluate(() => localStorage.getItem('alldraw:tour')) === 'done', 'recorrido: queda marcado como visto');
await shot(page, 'editor');

// Menú de ayuda y repetir el recorrido
await page.locator('[data-tour="help"]').click();
await page.waitForSelector('[role="menu"][aria-label="Ayuda"]');
for (const name of ['Documentación', 'Atajos de teclado', 'Repetir el recorrido', 'Novedades', 'Informar de un problema']) check(await page.getByRole('menuitem', { name }).count() === 1, `ayuda: «${name}»`);
await shot(page, 'help-menu');
await page.getByRole('menuitem', { name: 'Atajos de teclado' }).click();
await page.waitForSelector('.ad-shortcuts');
check(true, 'ayuda: abre los atajos');
await page.keyboard.press('Escape');
await page.locator('[data-tour="help"]').click();
await page.getByRole('menuitem', { name: 'Repetir el recorrido' }).click();
await page.waitForSelector('.tour__pop');
check(true, 'ayuda: repite el recorrido');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check(await page.locator('.tour').count() === 0, 'recorrido: Escape lo salta');

// Diálogo de confirmación propio (borrar una vista): Escape cancela, confirmar borra
const viewsBefore = await page.locator('.ad-views__item').count();
await page.locator('.ad-views__item', { hasText: 'Alta de cliente · Secuencia' }).hover();
await page.getByRole('button', { name: /Borrar la vista Alta de cliente · Secuencia/ }).click();
await page.waitForSelector('[role="alertdialog"]');
check(await page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]')), 'confirmación: el foco entra en el diálogo');
await shot(page, 'confirm');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check(await page.locator('[role="alertdialog"]').count() === 0 && await page.locator('.ad-views__item').count() === viewsBefore, 'confirmación: Escape cancela');
await page.locator('.ad-views__item', { hasText: 'Alta de cliente · Secuencia' }).hover();
await page.getByRole('button', { name: /Borrar la vista Alta de cliente · Secuencia/ }).click();
await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Borrar' }).click();
await page.waitForTimeout(300);
check(await page.locator('.ad-views__item').count() === viewsBefore - 1, 'confirmación: Borrar borra');

// Prompt propio (imagen por URL) con validación
await page.locator('.ad-pal .ad-tabs button', { hasText: 'Visual' }).click();
await page.getByRole('button', { name: /URL/ }).click();
await page.waitForSelector('.ad-dlg input');
await page.locator('.ad-dlg input').fill('no-es-una-url');
await page.keyboard.press('Enter');
check(await page.locator('.ad-dlg__error').count() === 1, 'entrada: valida la URL');
await shot(page, 'prompt');
await page.locator('.ad-dlg input').fill('https://example.com/logo.png');
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
check(await page.locator('.ad-pal__item', { hasText: 'logo.png' }).count() === 1, 'entrada: añade la imagen');

// Tema oscuro del editor: la capa flotante lo sigue
await page.locator('.ad-toolbar button[aria-label*="cambiar tema"]').click(); // sistema → claro
await page.locator('.ad-toolbar button[aria-label*="cambiar tema"]').click(); // claro → oscuro
check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'tema oscuro: <html data-theme> sigue al editor');
await page.locator('.ad-views__item', { hasText: 'Mapa capas' }).hover();
await page.getByRole('button', { name: /Borrar la vista Mapa capas/ }).click();
await page.waitForSelector('[role="alertdialog"]');
await shot(page, 'confirm-dark');
await page.keyboard.press('Escape');
await page.locator('.ad-toolbar button[aria-label*="cambiar tema"]').click(); // oscuro → sistema

// Sin conexión: indicador global
await ctx.setOffline(true);
await page.evaluate(() => dispatchEvent(new Event('offline')));
await page.waitForSelector('.ad-offline', { timeout: 3000 });
await shot(page, 'offline');
await ctx.setOffline(false);
await page.evaluate(() => dispatchEvent(new Event('online')));
await page.waitForTimeout(300);
check(await page.locator('.ad-offline').count() === 0, 'conexión: el indicador desaparece al volver');

// Inicio con espacios: galería, listas y aviso (toast) al borrar
await page.goto(base + '/#/');
await page.waitForSelector('.tpl-grid');
check(await page.locator('h1').count() === 1, 'inicio: un h1');
const more = page.getByRole('button', { name: /Ver las \d+ plantillas/ });
if (await more.count()) await more.click();
const tplCount = await page.locator('.tpl').count();
check(tplCount === 12, `inicio: ${tplCount} plantillas`);
await page.waitForSelector('.ws__thumb img', { timeout: 15000 });
await page.waitForTimeout(1200);
await shot(page, 'home');
await shot(page, 'home-full', true);

// Crear desde cada plantilla: abre sin errores y tiene nodos (la de espacio en blanco, un lienzo vacío)
const labels = await page.locator('.tpl').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
for (const [i, label] of labels.entries()) {
  const errs = errors.length;
  await page.goto(base + '/#/');
  await page.waitForSelector('.tpl-grid');
  if (await more.count()) await more.click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForURL(/#\/w\//);
  await page.waitForSelector('.ad-canvas', { timeout: 15000 });
  await page.waitForTimeout(700);
  const n = await nodes(page);
  const blank = i === 0;
  check(blank ? n === 0 : n > 0, `plantilla «${label}»: ${n} nodos`);
  check(errors.length === errs, `plantilla «${label}»: sin errores`);
  if (i < 12) await shot(page, `tpl-${String(i + 1).padStart(2, '0')}`);
}

// Importar soltando un fichero en el inicio
await page.goto(base + '/#/');
await page.waitForSelector('.tpl-grid');
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['flowchart TD\n  A[Pedido] --> B{¿Pagado?}\n  B -->|sí| C[Enviar]\n  B -->|no| D[Avisar]\n'], 'flujo.mmd', { type: 'text/plain' }));
  dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
});
await page.waitForSelector('.dropzone');
await shot(page, 'home-drop');
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.items.add(new File(['flowchart TD\n  A[Pedido] --> B{¿Pagado?}\n  B -->|sí| C[Enviar]\n  B -->|no| D[Avisar]\n'], 'flujo.mmd', { type: 'text/plain' }));
  dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForURL(/#\/w\//, { timeout: 15000 });
await page.waitForSelector('.react-flow__node', { timeout: 15000 });
check(await nodes(page) >= 4, 'inicio: importar arrastrando un .mmd');

// Toast al borrar un espacio desde el inicio (con confirmación)
await page.goto(base + '/#/');
await page.waitForSelector('.ws-grid');
const wsBefore = await page.locator('.ws').count();
await page.locator('.ws').first().hover();
await page.locator('.ws').first().getByRole('button', { name: /Borrar .* de este navegador/ }).click();
await page.waitForSelector('[role="alertdialog"]');
await page.locator('[role="alertdialog"]').getByRole('button', { name: 'Borrar' }).click();
await page.waitForSelector('.ad-toast');
check(await page.locator('.ad-toast', { hasText: 'Espacio borrado' }).count() === 1, 'aviso: «Espacio borrado»');
await page.waitForTimeout(250);
await shot(page, 'toast');
check(await page.locator('.ws').count() === wsBefore - 1, 'inicio: el espacio desaparece');

// Estados de error al abrir
await page.goto(base + '/#/w/ws_no_existe');
await page.waitForSelector('.state__card');
check(await page.locator('.state h1').innerText() === 'Este espacio no existe', 'error: espacio local inexistente');
await shot(page, 'error-missing');
await page.goto(base + '/#/s/no_existe');
await page.waitForSelector('.state__card, .ws-skel', { timeout: 10000 });
await page.waitForTimeout(500);
await shot(page, 'error-server');

// Esqueleto de carga (se ve un instante; se fuerza con red lenta)
await page.goto(base + '/#/');
await page.waitForSelector('.ws-grid');
const href = await page.locator('.ws__link').first().getAttribute('href');
const cdp = await ctx.newCDPSession(page);
await page.evaluate(h => { location.hash = h; }, href);
await page.waitForSelector('.ws-skel, .ad-editor', { timeout: 5000 });
if (await page.locator('.ws-skel').count()) await shot(page, 'skeleton');
await cdp.detach();
await ctx.close();

// ------------------------------------------------------------------ móvil
const m = await browser.newContext({ locale: 'es-ES', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await m.newPage(); watch(mp);
await mp.goto(base + '/#/', { waitUntil: 'networkidle' });
await mp.waitForSelector('.lp-viewer__stage img.is-on', { timeout: 15000 });
await mp.waitForTimeout(400);
check(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'móvil portada: sin scroll horizontal');
await shot(mp, 'm-landing');
await shot(mp, 'm-landing-full', true);
await mp.getByRole('button', { name: 'Probar sin cuenta' }).click();
await mp.waitForSelector('.react-flow__node', { timeout: 15000 });
await mp.waitForSelector('.tour__pop');
await mp.waitForTimeout(300);
await shot(mp, 'm-tour');
check(await mp.evaluate(() => { const r = document.querySelector('.tour__pop').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'móvil: el recorrido cabe en pantalla');
await mp.getByRole('button', { name: 'Saltar el recorrido' }).tap();
await mp.goto(base + '/#/');
await mp.waitForSelector('.tpl-grid');
await mp.waitForTimeout(1200);
check(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'móvil inicio: sin scroll horizontal');
await shot(mp, 'm-home');
await shot(mp, 'm-home-full', true);
await m.close();

await browser.close();
if (errors.length) { console.log('\nErrores de página:\n' + errors.map(e => ' - ' + e).join('\n')); fails.push('errores de página'); }
if (fails.length) { console.log(`\nFALLOS (${fails.length}):\n` + fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log('\nInterfaz pulida: todo en verde');
