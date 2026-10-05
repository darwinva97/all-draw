// Panel de texto en vivo (Ctrl+Shift+E / botón «Texto»): texto ↔ lienzo en los dos sentidos, un paso de deshacer,
// diagnósticos con subrayado y lista, autocompletado, búsqueda, selección cruzada, conflicto «el modelo cambió».
// Uso: `pnpm dev --port 4352` y `BASE=http://127.0.0.1:4352 node e2e/text-panel.mjs`. Capturas en /tmp/shots/txt-*.png.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:4173', out = process.env.OUT ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = []; const check = (n, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'FAIL'} ${n} ${extra}`); if (!ok) fails.push(n); };
const errors = [];
const page = await browser.newPage({ locale: 'es-ES', viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { localStorage.setItem('alldraw:tour', 'done'); localStorage.removeItem('alldraw:text-panel'); });
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Abrir la demo|Probar sin cuenta/ }).first().click();
await page.waitForSelector('.react-flow__node'); await page.waitForTimeout(600);

const ta = page.locator('.ad-txt-input');
const text = () => ta.inputValue();
const nodeNames = () => page.locator('.react-flow__node').allInnerTexts();
/** Selecciona `needle` (la n-ésima aparición) en el texto y lo sustituye tecleando. */
const replaceIn = async (needle, by, nth = 0) => {
  await ta.focus();
  const ok = await ta.evaluate((el, [needle, nth]) => {
    let i = -1; for (let k = 0; k <= nth; k++) { i = el.value.indexOf(needle, i + 1); if (i < 0) return false; }
    el.setSelectionRange(i, i + needle.length); return true;
  }, [needle, nth]);
  if (!ok) throw new Error(`no está en el texto: ${needle}`);
  await page.keyboard.insertText(by);
};
const caretAt = async (needle, delta = 0) => { await ta.focus(); await ta.evaluate((el, [n, d]) => { const i = el.value.indexOf(n) + d; el.setSelectionRange(i, i); el.dispatchEvent(new Event('select', { bubbles: true })); }, [needle, delta]); };
const idle = () => page.waitForTimeout(1100);

// ---- abrir con el botón y con el atajo
await page.getByRole('button', { name: 'Texto', exact: true }).click();
await page.waitForSelector('.ad-txt-panel');
await page.waitForFunction(() => document.querySelector('.ad-txt-input')?.value.includes('view '));
check('el botón abre el panel con el texto de la vista', (await text()).includes('include '));
check('foco en el texto al abrir', await ta.evaluate(el => document.activeElement === el));
check('numeración de líneas', (await page.locator('.ad-txt-ln').count()) > 10);
check('resaltado: palabras clave, tipos y textos', (await page.locator('.ad-txt-tk-k').count()) > 0 && (await page.locator('.ad-txt-tk-t').count()) > 0 && (await page.locator('.ad-txt-tk-s').count()) > 0);
await page.screenshot({ path: `${out}/txt-open.png` });
await page.keyboard.press('Control+Shift+E');
check('Ctrl+Shift+E lo cierra', (await page.locator('.ad-txt-panel').count()) === 0);
await page.locator('.ad-canvas').first().focus();
await page.keyboard.press('Control+Shift+E');
await page.waitForSelector('.ad-txt-panel');
await page.waitForFunction(() => document.querySelector('.ad-txt-input')?.value.length > 20);
check('Ctrl+Shift+E lo abre', true);

// ---- texto → lienzo: renombrar (un paso de deshacer)
const t0 = await text();
const m = /^\s+(\w+) = archimate:\w+ "([^"]+)"/m.exec(t0);
const [, elId, elName] = m;
await replaceIn(`"${elName}"`, `"${elName} (texto)"`);
check('mientras se teclea: «Sin aplicar…»', (await page.locator('.ad-txt-status').innerText()).includes('Sin aplicar'));
await idle();
check('renombrar en el texto renombra en el lienzo', (await nodeNames()).some(n => n.includes(`${elName} (texto)`)));
check('estado «Sincronizado»', (await page.locator('.ad-txt-status').innerText()).includes('Sincronizado'));
await page.locator('.ad-canvas').first().focus();
await page.keyboard.press('Control+z');
await idle();
check('Ctrl+Z en el lienzo deshace el cambio entero (un paso)', !(await nodeNames()).some(n => n.includes('(texto)')) && (await nodeNames()).some(n => n.includes(elName)));
check('y el texto se actualiza solo', (await text()).includes(`"${elName}"`) && !(await text()).includes('(texto)'));

// ---- añadir un elemento y su aparición
const lines = (await text()).split('\n');
const modelLine = lines.findIndex(l => /^\s+model \{/.test(l));
const viewInclude = lines.findIndex(l => /^\s+include /.test(l));
await ta.focus();
await ta.evaluate((el, [ml]) => { const off = el.value.split('\n').slice(0, ml + 1).join('\n').length; el.setSelectionRange(off, off); }, [modelLine]);
await page.keyboard.press('Enter');
await page.keyboard.insertText('nuevo_e2e = archimate:BusinessRole "Rol desde texto"');
await ta.evaluate((el, [vl]) => { const ls = el.value.split('\n'); const off = ls.slice(0, vl + 1).join('\n').length + 0; el.setSelectionRange(off - ls[vl].length, off - ls[vl].length); }, [viewInclude + 1]);
const indent = /^\s*/.exec(lines[viewInclude])[0];
await page.keyboard.insertText(`${indent.trimStart()}include nuevo_e2e\n${indent}`);
await idle();
check('añadir elemento + include crea el nodo', (await nodeNames()).some(n => n.includes('Rol desde texto')), JSON.stringify((await page.locator('.ad-txt-problem').allInnerTexts()).slice(0, 3)));

// ---- diagnósticos: error con subrayado y lista; no se aplica
await caretAt('nuevo_e2e = archimate:BusinessRole "Rol desde texto"', 'nuevo_e2e = archimate:BusinessRole "Rol desde texto"'.length);
await page.keyboard.insertText(' "otro texto"');
await idle();
const probs = await page.locator('.ad-txt-problem').allInnerTexts();
check('error en la lista con línea:columna', probs.some(p => /^\s*\d+:\d+/.test(p) && /Se esperaba/.test(p)), JSON.stringify(probs.slice(0, 2)));
check('subrayado del error', (await page.locator('.ad-txt-err').count()) > 0);
check('número de línea en rojo', (await page.locator('.ad-txt-ln.is-error').count()) > 0);
check('estado con errores', /error/.test(await page.locator('.ad-txt-status').innerText()));
await page.screenshot({ path: `${out}/txt-error.png` });
await page.locator('.ad-txt-problem').first().click();
check('clic en el problema lleva el cursor a su línea', await ta.evaluate(el => el.value.slice(0, el.selectionStart).split('\n').pop().includes('Rol desde texto')));
await replaceIn(' "otro texto"', '');
await idle();
check('al corregirlo desaparecen los problemas', (await page.locator('.ad-txt-problem').count()) === 0);

// ---- autocompletado de tipos
await caretAt('nuevo_e2e = archimate:BusinessRole "Rol desde texto"', 'nuevo_e2e = archimate:BusinessRole "Rol desde texto"'.length);
await page.keyboard.press('Enter');
await page.keyboard.type('otro_e2e = archimate:BusinessAc', { delay: 15 });
await page.waitForSelector('.ad-txt-ac');
const acItems = await page.locator('.ad-txt-ac li').allInnerTexts();
check('autocompletado de tipos de la notación', acItems.some(i => i.startsWith('archimate:BusinessActor')), acItems.slice(0, 3).join(' | '));
await page.screenshot({ path: `${out}/txt-autocomplete.png` });
await page.keyboard.press('Enter');
check('Intro acepta la sugerencia', (await text()).includes('otro_e2e = archimate:BusinessActor'));
await page.keyboard.insertText(' "Actor e2e"');
await page.keyboard.press('Enter');
await page.keyboard.type('include otro', { delay: 15 });
const acIds = await page.locator('.ad-txt-ac li').allInnerTexts().catch(() => []);
check('autocompletado de ids tras include', acIds.some(i => i.startsWith('otro_e2e')), acIds.slice(0, 3).join(' | '));
await page.keyboard.press('Escape');
await page.keyboard.press('Control+a'); // (no hace nada raro: selecciona el texto)
await page.keyboard.press('ArrowRight');
await replaceIn('include otro', '');
await idle();
check('elemento solo en el modelo (sin include) no crea nodo', !(await nodeNames()).some(n => n.includes('Actor e2e')));

// ---- búsqueda
await ta.focus();
await page.keyboard.press('Control+f');
await page.waitForSelector('.ad-txt-find input');
check('Ctrl+F en el texto abre su búsqueda (no la paleta)', (await page.locator('.ad-cmdk').count()) === 0);
await page.locator('.ad-txt-find input').fill('include');
const count = await page.locator('.ad-txt-count').innerText();
check('búsqueda cuenta coincidencias', /^1\/\d+$/.test(count) || /^\d+\/\d+$/.test(count), count);
await page.keyboard.press('Enter');
check('Intro va a la siguiente', (await page.locator('.ad-txt-count').innerText()).startsWith('2/'));
check('coincidencias marcadas', (await page.locator('.ad-txt-hit').count()) > 0);
await page.screenshot({ path: `${out}/txt-search.png` });
await page.keyboard.press('Escape');
check('Esc cierra la búsqueda y vuelve al texto', (await page.locator('.ad-txt-find').count()) === 0 && await ta.evaluate(el => document.activeElement === el));

// ---- selección cruzada
await caretAt(`${elId} = archimate`, 2);
await page.waitForTimeout(200);
const selNames = await page.locator('.react-flow__node.selected').allInnerTexts();
check('cursor en una declaración selecciona su nodo en el lienzo', selNames.some(n => n.includes(elName)), JSON.stringify(selNames));
// el nodo más a la derecha (el panel tapa la parte izquierda del lienzo)
const vis = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map(n => ({ id: n.getAttribute('data-id'), x: n.getBoundingClientRect().left, name: n.innerText.split('\n')[0].trim() })).sort((a, b) => b.x - a.x)[0]);
const other = page.locator(`.react-flow__node[data-id="${vis.id}"]`);
await other.click();
await page.waitForTimeout(300);
check('seleccionar en el lienzo marca su línea en el texto', (await page.locator('.ad-txt-hlline').count()) === 1);
const hlText = await ta.evaluate(el => { const s = el.value.slice(0, el.selectionStart).split('\n').length; return el.value.split('\n')[s - 1]; });
check('…y lleva el cursor a su declaración', hlText.includes(`"${vis.name}"`), `${hlText} / ${vis.name}`);
await page.screenshot({ path: `${out}/txt-selection.png` });

// ---- lienzo → texto: mover y renombrar fuera
await other.click();
await page.keyboard.press('F2');
await page.keyboard.press('Control+a');
await page.keyboard.type('Rol renombrado en el lienzo');
await page.keyboard.press('Enter');
await idle();
check('renombrar en el lienzo actualiza el texto', (await text()).includes('"Rol renombrado en el lienzo"'));

// ---- conflicto: texto con cambios pendientes (y un error) mientras el lienzo cambia lo mismo
await replaceIn('"Rol renombrado en el lienzo"', '"Rol desde el texto"');
await page.keyboard.insertText(' "error"');
await idle();
await other.click();
await page.keyboard.press('F2');
await page.keyboard.press('Control+a');
await page.keyboard.type('Rol del lienzo');
await page.keyboard.press('Enter');
await idle();
check('con cambios pendientes, el texto no se pisa', (await text()).includes('"Rol desde el texto"'));
await replaceIn(' "error"', '');
await idle();
check('aviso «El modelo cambió» con las dos opciones', (await page.locator('.ad-txt-alert').count()) === 1
  && (await page.getByRole('button', { name: 'Recargar texto' }).count()) === 1 && (await page.getByRole('button', { name: 'Mantener el mío' }).count()) === 1);
await page.screenshot({ path: `${out}/txt-conflict.png` });
await page.getByRole('button', { name: 'Mantener el mío' }).click();
await idle();
check('«Mantener el mío» aplica el texto', (await nodeNames()).some(n => n.includes('Rol desde el texto')));
// otra vez, ahora recargando
await replaceIn('"Rol desde el texto"', '"Rol B"');
await page.keyboard.insertText(' "error"');
await idle();
await other.click();
await page.keyboard.press('F2'); await page.keyboard.press('Control+a'); await page.keyboard.type('Rol C'); await page.keyboard.press('Enter');
await idle();
await replaceIn(' "error"', '');
await idle();
await page.getByRole('button', { name: 'Recargar texto' }).click();
await page.waitForTimeout(300);
check('«Recargar texto» descarta lo mío', (await text()).includes('"Rol C"') && !(await text()).includes('"Rol B"'));

// ---- alcance: todo el espacio
await page.locator('.ad-txt-scope').selectOption('workspace');
await page.waitForTimeout(400);
const whole = await text();
check('alcance «Todo el espacio» muestra todas las vistas', (whole.match(/\n\s+view /g) ?? []).length > 1);
await page.screenshot({ path: `${out}/txt-workspace.png` });
// una vista nueva escrita en el texto: se crea y se coloca con el layout automático (sin solaparse)
const ids = [...whole.matchAll(/^\s+(\w+) = archimate:\w+ "/gm)].slice(0, 3).map(m => m[1]);
await caretAt('  views {\n', '  views {\n'.length);
await page.keyboard.insertText(`    view v_e2e "Vista desde texto" {\n      notation archimate\n      include ${ids.join(', ')}\n    }\n`);
await idle();
check('vista nueva desde el texto aparece en la lista de vistas', (await page.locator('.ad-editor__left').innerText()).includes('Vista desde texto'));
await page.locator('.ad-editor__left').getByText('Vista desde texto').first().click();
await page.waitForTimeout(800);
const boxes = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map(n => n.getBoundingClientRect()).map(r => [r.left, r.top, r.width, r.height]));
const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]));
check('sus nodos se colocan sin solaparse', boxes.length === 3 && !overlap, JSON.stringify(boxes));
await page.screenshot({ path: `${out}/txt-new-view.png` });

// ---- tema oscuro
await page.evaluate(() => { localStorage.setItem('alldraw:theme', 'dark'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.react-flow__node');
await page.keyboard.press('Control+Shift+E');
await page.waitForSelector('.ad-txt-panel');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/txt-dark.png` });

// ---- móvil
const mob = await browser.newPage({ locale: 'es-ES', viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
mob.on('pageerror', e => errors.push(e.message));
await mob.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
await mob.goto(base + '/#/', { waitUntil: 'networkidle' });
await mob.getByRole('button', { name: /Abrir la demo|Probar sin cuenta/ }).first().click();
await mob.waitForSelector('.react-flow__node'); await mob.waitForTimeout(500);
await mob.keyboard.press('Control+Shift+E');
await mob.waitForSelector('.ad-txt-panel');
const box = await mob.locator('.ad-txt-panel').boundingBox();
check('móvil: el panel ocupa el ancho', box && box.width >= 380, JSON.stringify(box));
await mob.screenshot({ path: `${out}/txt-mobile.png` });

check('sin errores de la página', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(fails.length ? `\n${fails.length} FALLOS: ${fails.join(', ')}` : '\nTodo bien');
process.exit(fails.length ? 1 : 0);
