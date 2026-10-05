// Aspecto Archi de las vistas ArchiMate: importa un diagrama real de Archi (40 elementos anidados, notas, Junction) y
// comprueba en el lienzo y en el SVG exportado que:
//   - ningún texto de nodo se sale de su caja (rectángulos de los glifos, con `Range`, frente al del nodo);
//   - en la vista ArchiMate no se pinta el nombre del tipo («Business Process», «Grouping»…), y la casilla
//     «Mostrar el nombre del tipo» del inspector de vista lo vuelve a mostrar (donde cabe);
//   - la Junction es un círculo negro relleno sin texto, y la nueva desde la paleta mide 15×15;
//   - las notas llevan la esquina doblada y el texto arriba a la izquierda.
// Uso: `pnpm dev --port 4173` y `BASE=http://127.0.0.1:4173 node e2e/archi-look.mjs`.
// Capturas en /tmp/shots/archi-look-*.png (TAG=antes las nombra archi-look-antes-*.png).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4173', out = process.env.OUT ?? '/tmp/shots';
const tag = process.env.TAG ? `-${process.env.TAG}` : '';
const shot = (name) => `${out}/archi-look${tag}-${name}.png`;
const fixture = new URL('./fixtures/archi-look.alldraw.json', import.meta.url).pathname;
const JUNCTION_NODE = 'vn_xxX3edo7FJmi';
const TYPE_NAMES = ['Business Process', 'Business Actor', 'Application Interface', 'Application Service', 'Application Component', 'Grouping', 'Junction'];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const fails = []; const check = (n, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'FAIL'} ${n} ${extra}`); if (!ok) fails.push(n); };

/** Texto de cada nodo que se sale de su caja (más de 1 px), con el rectángulo real de los glifos. */
const overflowing = (page) => page.evaluate(() => {
  const bad = [];
  for (const rf of document.querySelectorAll('.react-flow__node')) {
    const box = rf.querySelector(':scope > .ad-node, :scope > .ad-visual');
    if (!box) continue;
    const b = box.getBoundingClientRect();
    // Etiquetas fuera a propósito (debajo de la figura): se miden contra su propia caja, no contra la figura.
    for (const t of box.querySelectorAll('.ad-node__label, .ad-node__type, .ad-visual__text, .ad-visual__title')) {
      if (t.closest('.ad-node--label-bottom, .ad-shape-circle, .ad-shape-double-circle, .ad-shape-diamond, .ad-shape-bar, .ad-shape-actor')) continue;
      const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const q of r.getClientRects()) {
          if (!q.width || !q.height) continue;
          if (q.left < b.left - 1 || q.right > b.right + 1 || q.top < b.top - 1 || q.bottom > b.bottom + 1) {
            bad.push(`${rf.getAttribute('data-id')} «${n.textContent.slice(0, 30)}» texto ${Math.round(q.left)},${Math.round(q.top)}–${Math.round(q.right)},${Math.round(q.bottom)} caja ${Math.round(b.left)},${Math.round(b.top)}–${Math.round(b.right)},${Math.round(b.bottom)}`);
            break;
          }
        }
      }
    }
  }
  return bad;
});

/** Píxel (r,g,b) en el centro de un elemento, a partir de una captura de su recuadro. */
async function centerPixel(page, locator) {
  const png = PNG.sync.read(await locator.screenshot());
  const i = ((png.height >> 1) * png.width + (png.width >> 1)) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

async function openFixture(theme) {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1600, height: 1000 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript((theme) => { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'es'); localStorage.setItem('alldraw:theme', theme); }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await page.waitForURL(/#\/w\//, { timeout: 30000 });
  await page.waitForSelector('.react-flow__node');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Ajustar a la vista' }).first().click();
  await page.mouse.move(2, 990);
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await openFixture(theme);
  const n = await page.locator('.react-flow__node').count();
  check(`[${theme}] el diagrama se importa entero`, n >= 42, `${n} nodos`);
  await page.locator('.ad-canvas').screenshot({ path: shot(theme) });

  // ---- nada se sale de su caja
  const bad = await overflowing(page);
  check(`[${theme}] ningún texto de nodo desborda su caja`, bad.length === 0, bad.slice(0, 5).join(' | '));

  // ---- sin nombres de tipo
  const texts = await page.locator('.react-flow__node').allInnerTexts();
  const typed = texts.filter(t => TYPE_NAMES.some(name => t.includes(name)));
  check(`[${theme}] sin nombres de tipo en la vista ArchiMate`, typed.length === 0 && (await page.locator('.ad-node__type').count()) === 0, typed.slice(0, 3).join(' | '));

  // ---- Junction: círculo negro relleno, sin texto
  const junction = page.locator(`.react-flow__node[data-id="${JUNCTION_NODE}"]`);
  check(`[${theme}] la Junction está en el lienzo`, (await junction.count()) === 1);
  if (await junction.count()) {
    check(`[${theme}] la Junction no lleva texto`, (await junction.innerText()).trim() === '');
    const fills = await junction.locator('svg path').evaluateAll(ps => ps.map(p => getComputedStyle(p).fill));
    const ink = theme === 'dark' ? 'rgb(230, 232, 236)' : 'rgb(0, 0, 0)';
    check(`[${theme}] la Junction es un círculo relleno de tinta`, fills.length > 0 && fills.every(f => f === ink), fills.join(','));
    const px = await centerPixel(page, junction);
    const dark = px.every(c => c < 60), light = px.every(c => c > 200);
    check(`[${theme}] el centro de la Junction es ${theme === 'dark' ? 'claro' : 'negro'}`, theme === 'dark' ? light : dark, px.join(','));
  }

  // ---- notas: texto arriba a la izquierda, esquina doblada
  const note = page.locator('.react-flow__node .ad-visual--core-note').first();
  const geo = await note.evaluate(el => {
    const b = el.getBoundingClientRect(), t = el.querySelector('.ad-visual__text')?.getBoundingClientRect();
    return { dx: t ? t.left - b.left : -1, dy: t ? t.top - b.top : -1, fold: !!el.querySelector('.ad-note__fold'), font: getComputedStyle(el.querySelector('.ad-visual__text')).fontSize };
  });
  check(`[${theme}] nota con esquina doblada`, geo.fold);
  check(`[${theme}] texto de la nota arriba a la izquierda, 11 px`, geo.dx >= 0 && geo.dx < 12 && geo.dy >= 0 && geo.dy < 12 && geo.font === '11px', JSON.stringify(geo));

  // Los conectores que salen de las notas también se pintan (antes las notas no tenían manejadores y React Flow los omitía).
  for (const id of ['ve_69cOd98f2r5R', 've_WyvdtIfDXlfr', 've_nyVgCgTY3MRN'])
    check(`[${theme}] se pinta el conector de nota ${id}`, await page.locator(`.react-flow__edge[data-id="${id}"] path`).count() > 0);

  // ---- detalle: arriba a la izquierda, al 100 %
  await page.locator('.ad-canvas').focus();
  await page.keyboard.press('Control+0');
  await page.waitForTimeout(400);
  await page.locator('.ad-canvas').screenshot({ path: shot(`${theme}-100`) });

  if (theme === 'light') {
    // ---- SVG exportado: mismas reglas
    await page.getByRole('button', { name: /^Importar \/ Exportar/ }).click();
    await page.waitForSelector('[role="menu"]');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('menuitem', { name: /^SVG/ }).click()]);
    const svg = readFileSync(await download.path(), 'utf8');
    const svgTyped = TYPE_NAMES.filter(name => svg.includes(`>${name}<`));
    check('SVG: sin nombres de tipo', svgTyped.length === 0, svgTyped.join(', '));
    const view = await ctx.newPage();
    await view.setViewportSize({ width: 1800, height: 1100 });
    const showSvg = async (t) => {
      await view.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${t === 'dark' ? '#0f1115' : '#fff'}}</style></head><body>${svg.replace('<svg ', `<svg data-theme="${t}" `)}</body></html>`);
      await view.locator('body > svg').screenshot({ path: shot(`svg-${t}`) });
    };
    await showSvg('dark');
    await showSvg('light');
    // Texto del SVG dentro de su nodo (las etiquetas de nodo van en el `<g data-node>` del nodo).
    const svgBad = await view.evaluate(() => {
      const bad = [];
      for (const g of document.querySelectorAll('g[data-node]')) {
        const shape = g.querySelector(':scope > .ad-shape, :scope > rect, :scope > path');
        if (!shape || g.querySelector(':scope > .ad-shape.ad-shape-circle')) continue;
        const b = shape.getBoundingClientRect();
        for (const t of g.querySelectorAll(':scope > text.ad-node__label, :scope > text.ad-node__type, :scope > text.ad-visual__text, :scope > text.ad-visual__title')) {
          const q = t.getBoundingClientRect();
          if (q.width && (q.left < b.left - 1 || q.right > b.right + 1 || q.top < b.top - 1 || q.bottom > b.bottom + 1)) bad.push(`${g.getAttribute('data-node')} «${t.textContent.slice(0, 30)}»`);
        }
      }
      return bad;
    });
    check('SVG: ningún texto desborda su nodo', svgBad.length === 0, svgBad.slice(0, 5).join(' | '));
    const jfill = await view.evaluate((id) => [...document.querySelectorAll(`g[data-node="${id}"] path`)].map(p => getComputedStyle(p).fill), JUNCTION_NODE);
    check('SVG: Junction rellena de negro', jfill.length > 0 && jfill.every(f => f === 'rgb(0, 0, 0)'), jfill.join(','));
    check('SVG: Junction sin texto', await view.evaluate((id) => !document.querySelector(`g[data-node="${id}"] text`), JUNCTION_NODE));
    await view.close();

    // ---- preferencia de la vista: «Mostrar el nombre del tipo»
    // Nada seleccionado (clic en el lienzo vacío, ya encuadrado): el inspector muestra la vista.
    await page.getByRole('button', { name: 'Ajustar a la vista' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
    const box = page.getByRole('checkbox', { name: 'Mostrar el nombre del tipo' });
    await box.waitFor({ timeout: 5000 }).catch(() => {});
    check('inspector de vista: casilla «Mostrar el nombre del tipo» desmarcada', (await box.count()) === 1 && !(await box.isChecked()));
    if (await box.count()) {
      await box.check();
      await page.getByRole('button', { name: 'Ajustar a la vista' }).first().click();
      await page.waitForTimeout(400);
      const shown = await page.locator('.ad-node__type').count();
      check('con la casilla se ven los tipos donde caben', shown > 0, `${shown}`);
      const bad2 = await overflowing(page);
      check('con tipos, ningún texto desborda', bad2.length === 0, bad2.slice(0, 3).join(' | '));
      await page.locator('.ad-canvas').screenshot({ path: shot('tipos') });
      await box.uncheck();
      await page.waitForTimeout(200);
      check('sin la casilla, otra vez sin tipos', (await page.locator('.ad-node__type').count()) === 0);
    }

    // ---- Junction nueva desde la paleta: 15×15
    const search = page.getByRole('searchbox', { name: 'Buscar en la paleta' });
    await search.fill('Junction');
    const before = new Set(await page.locator('.react-flow__node').evaluateAll(ns => ns.map(n => n.getAttribute('data-id'))));
    await page.locator('.ad-pal__item', { hasText: /^Junction/ }).first().click();
    await page.waitForTimeout(400);
    const created = await page.locator('.react-flow__node').evaluateAll((ns, prev) => ns.filter(n => !prev.includes(n.getAttribute('data-id'))).map(n => ({ w: n.style.width, h: n.style.height, text: n.innerText.trim() })), [...before]);
    check('Junction desde la paleta: 15×15 y sin texto', created.length === 1 && created[0].w === '15px' && created[0].h === '15px' && created[0].text === '', JSON.stringify(created));
  }
  check(`[${theme}] sin errores de página`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
if (fails.length) { console.log(`\n${fails.length} fallo(s): ${fails.join('; ')}`); process.exit(1); }
console.log('\nOK: aspecto Archi');
