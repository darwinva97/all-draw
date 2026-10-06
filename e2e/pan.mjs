// Moverse por el lienzo sin mover nodos (como Figma o Illustrator), sobre el diagrama de Archi de e2e/fixtures:
//   - arrastrar por el interior de un contenedor sin seleccionar desplaza la vista (no lo mueve); un clic lo
//     selecciona; arrastrando su título se mueve;
//   - Espacio+arrastrar, la herramienta mano (H) y el botón central desplazan también sobre un nodo, sin moverlo ni
//     seleccionarlo; Esc deja la mano;
//   - la rueda desplaza sin cambiar el zoom, Ctrl+rueda hace zoom y el botón del ratón de los controles vuelve a la
//     rueda con zoom;
//   - Ctrl+B oculta y muestra el panel izquierdo y Ctrl+Alt+B el derecho (también en escritorio).
// Uso: `pnpm dev --port 4173` y `node e2e/pan.mjs` (BASE para otro servidor).
import { chromium } from 'playwright-core';

const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const fixture = new URL('./fixtures/archi-look.alldraw.json', import.meta.url).pathname;
const CONTAINER = 'vn_iIFIqqTtDwVQ'; // [API EXP] Validacion de Lead (interfaz con interfaces dentro)
const LEAF = 'vn_2ZyhnMfSYsq5';      // Valida si tiene camapaña existente

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = []; const check = (n, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'FAIL'} ${n} ${extra}`); if (!ok) fails.push(n); };

const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript(() => { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'es'); });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(base + '/#/', { waitUntil: 'networkidle' });
await page.locator('input[type=file]').first().setInputFiles(fixture);
await page.waitForURL(/#\/w\//, { timeout: 30000 });
await page.waitForSelector(`.react-flow__node[data-id="${CONTAINER}"]`);
await page.waitForTimeout(500);

const viewport = () => page.evaluate(() => { const m = getComputedStyle(document.querySelector('.react-flow__viewport')).transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number); return { x: m[4], y: m[5], zoom: m[0] }; });
const nodeLoc = (id) => page.locator(`.react-flow__node[data-id="${id}"]`);
/** Posición del nodo en el modelo (no en pantalla): cambia solo si se mueve el nodo. */
const modelPos = (id) => nodeLoc(id).evaluate(el => el.style.transform);
const isSelected = (id) => nodeLoc(id).evaluate(el => el.classList.contains('selected'));
const box = async (id) => (await nodeLoc(id).boundingBox());
async function drag(from, dx, dy, { button = 'left' } = {}) {
  await page.mouse.move(from.x, from.y); await page.mouse.down({ button });
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + dx * i / 8, from.y + dy * i / 8);
  await page.mouse.up({ button }); await page.waitForTimeout(150);
}
const moved = (a, b) => Math.abs(a.x - b.x) > 20 || Math.abs(a.y - b.y) > 20;

// Zoom al 100 %: los contenedores ocupan casi toda la pantalla.
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+0');
await page.waitForTimeout(400);
await nodeLoc(CONTAINER).scrollIntoViewIfNeeded().catch(() => {});

// ---- interior de un contenedor sin seleccionar
let b = await box(CONTAINER);
const interior = { x: b.x + b.width - 40, y: b.y + b.height - 12 };
let v0 = await viewport(), p0 = await modelPos(CONTAINER);
await drag(interior, -150, -60);
let v1 = await viewport();
check('interior del contenedor: arrastrar desplaza la vista', moved(v0, v1), JSON.stringify({ v0, v1 }));
check('interior del contenedor: el contenedor no se mueve', (await modelPos(CONTAINER)) === p0);
check('interior del contenedor: arrastrar no lo selecciona', !(await isSelected(CONTAINER)));
b = await box(CONTAINER);
await page.mouse.click(b.x + b.width - 40, b.y + b.height - 12);
await page.waitForTimeout(150);
check('interior del contenedor: un clic lo selecciona', await isSelected(CONTAINER));
await page.keyboard.press('Escape'); await page.mouse.click(5, 990); // deseleccionar en el lienzo vacío
await page.waitForTimeout(150);

// ---- título del contenedor: sí lo mueve
const title = nodeLoc(CONTAINER).locator('.ad-node__label').first();
const tb = await title.boundingBox();
p0 = await modelPos(CONTAINER);
await drag({ x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 }, 40, 30);
check('título del contenedor: arrastrar lo mueve', (await modelPos(CONTAINER)) !== p0);
await page.keyboard.press('Control+z'); await page.waitForTimeout(150);

// ---- Espacio + arrastrar sobre un nodo
b = await box(LEAF);
let center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
v0 = await viewport(); p0 = await modelPos(LEAF);
await page.mouse.move(center.x, center.y);
await page.keyboard.down('Space');
check('Espacio: cursor de mano', await page.locator('.ad-canvas.is-hand').count() === 1);
await drag(center, 120, 80);
await page.keyboard.up('Space');
v1 = await viewport();
check('Espacio+arrastrar sobre un nodo desplaza la vista', moved(v0, v1));
check('Espacio+arrastrar no mueve el nodo', (await modelPos(LEAF)) === p0);
check('Espacio+arrastrar no selecciona el nodo', !(await isSelected(LEAF)));
check('al soltar Espacio vuelve el cursor normal', await page.locator('.ad-canvas.is-hand').count() === 0);

// ---- herramienta mano
await page.locator('.ad-canvas').focus();
await page.keyboard.press('h');
check('H activa la mano', await page.getByRole('button', { name: 'Herramienta mano' }).getAttribute('aria-pressed') === 'true');
b = await box(LEAF); center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
v0 = await viewport(); p0 = await modelPos(LEAF);
await drag(center, -100, -50);
check('mano: arrastrar sobre un nodo desplaza la vista', moved(v0, await viewport()));
check('mano: el nodo no se mueve', (await modelPos(LEAF)) === p0);
b = await box(LEAF);
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(150);
check('mano: un clic no selecciona', !(await isSelected(LEAF)));
await page.keyboard.press('Escape');
check('Esc deja la mano', await page.getByRole('button', { name: 'Herramienta mano' }).getAttribute('aria-pressed') === 'false');
await page.getByRole('button', { name: 'Herramienta mano' }).click();
check('el botón de los controles activa la mano', await page.locator('.ad-canvas.is-hand').count() === 1);
await page.getByRole('button', { name: 'Herramienta mano' }).click();

// ---- botón central sobre un nodo
b = await box(LEAF); center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
v0 = await viewport(); p0 = await modelPos(LEAF);
await drag(center, 90, 40, { button: 'middle' });
check('botón central sobre un nodo desplaza la vista', moved(v0, await viewport()));
check('botón central: el nodo no se mueve', (await modelPos(LEAF)) === p0);

// ---- rueda
const cb = await page.locator('.ad-canvas').boundingBox(); // tras el zoom el nodo puede haber quedado fuera
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
v0 = await viewport();
await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
v1 = await viewport();
check('rueda sobre un nodo: desplaza en vertical', Math.abs(v1.y - v0.y + 300) < 2 && v1.x === v0.x, JSON.stringify({ v0, v1 }));
check('rueda: el zoom no cambia', v1.zoom === v0.zoom);
await page.keyboard.down('Shift'); await page.mouse.wheel(0, 200); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
const v2 = await viewport();
check('Shift+rueda: desplaza en horizontal', Math.abs(v2.x - v1.x + 200) < 2 && Math.abs(v2.y - v1.y) < 2, JSON.stringify({ v1, v2 }));
await page.keyboard.down('Control'); await page.mouse.wheel(0, -300); await page.keyboard.up('Control'); await page.waitForTimeout(400);
check('Ctrl+rueda: hace zoom', (await viewport()).zoom > v2.zoom);
await page.getByRole('button', { name: 'La rueda del ratón hace zoom' }).click();
const canvasBox = await page.locator('.ad-canvas').boundingBox(); // tras el zoom el nodo puede haber quedado fuera
await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
v0 = await viewport();
await page.mouse.wheel(0, 300); await page.waitForTimeout(400); // alejar: acercar podría topar con el zoom máximo
check('con la preferencia «zoom», la rueda hace zoom', (await viewport()).zoom < v0.zoom);
check('la preferencia se guarda', await page.evaluate(() => localStorage.getItem('alldraw:canvas:wheel')) === '"zoom"');
await page.getByRole('button', { name: 'La rueda del ratón hace zoom' }).click();

// ---- paneles: Ctrl+B y Ctrl+Alt+B (escritorio)
const left = () => page.locator('.ad-editor__left').count(), right = () => page.locator('.ad-inspector, .ad-editor > .ad-editor__body > aside').count();
const rightBefore = await right();
const canvasRect = () => page.locator('.ad-canvas').evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, win: innerWidth }; });
const full = await canvasRect();
await page.locator('.ad-canvas').focus();
await page.keyboard.press('Control+b');
check('Ctrl+B oculta el panel izquierdo', (await left()) === 0);
await page.waitForTimeout(300);
{ const r = await canvasRect(); check('sin panel izquierdo, el lienzo empieza en el borde izquierdo', r.left < 2 && r.width > full.width + 200, JSON.stringify({ full, r })); }
await page.keyboard.press('Control+b');
check('Ctrl+B lo vuelve a mostrar', (await left()) === 1);
await page.keyboard.press('Control+Alt+b');
await page.waitForTimeout(300);
{ const r = await canvasRect(); check('sin panel derecho, el lienzo llega al borde derecho', r.win - r.right < 2 && r.width > full.width + 200, JSON.stringify({ full, r })); }
await page.keyboard.press('Control+b');
await page.waitForTimeout(300);
{ const r = await canvasRect(); check('sin ningún panel, el lienzo ocupa todo el ancho', r.left < 2 && r.win - r.right < 2, JSON.stringify(r)); }
await page.keyboard.press('Control+b');
check('Ctrl+Alt+B oculta el panel derecho', rightBefore > 0 && (await right()) === 0 && (await page.locator('.ad-editor.is-right-hidden').count()) === 1);
await page.keyboard.press('Control+Alt+b');
check('Ctrl+Alt+B lo vuelve a mostrar', (await right()) === rightBefore);
check('en escritorio hay botones para los paneles', await page.getByRole('button', { name: 'Mostrar u ocultar vistas y paleta' }).count() === 1 && await page.getByRole('button', { name: 'Mostrar u ocultar el inspector' }).count() === 1);

check('sin errores de página', errors.length === 0, errors.join(' | '));
await browser.close();
if (fails.length) { console.error(`\nFALLAN ${fails.length}: ${fails.join(', ')}`); process.exit(1); }
console.log('\nOK: moverse por el lienzo');
