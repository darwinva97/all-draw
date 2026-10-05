// Espacios del servidor sin conexión: con copia en IndexedDB (`srv_<id>`) se abren con el último rol conocido, se
// edita sin red y al volver (`online`) se conecta y sincroniza; sin copia, error claro. También recarga sin red (SW).
// Uso: BASE=http://127.0.0.1:<puerto> node e2e/offline.mjs   (servidor temporal con STATIC_DIR = build de la web)
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4002';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const fail = msg => { console.error('FALLO:', msg); errors.push(msg); };
const check = (ok, msg) => { console.log(ok ? '  ok ' : '  KO ', msg); if (!ok) fail(msg); };
const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 820 } });
const a = await ctx.newPage();
await a.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
a.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
const status = () => a.locator('.app-status').first().innerText();
const waitStatus = (re, timeout = 20000) => a.waitForFunction(r => new RegExp(r).test(document.querySelector('.app-status')?.textContent ?? ''), re.source, { timeout });

// 1. Cuenta y espacio del servidor abierto con red (queda la copia local y el rol)
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
await a.getByRole('button', { name: /Entrar/ }).click();
await a.getByRole('button', { name: 'No tengo cuenta' }).click();
await a.locator('input[type=email]').fill(`offline-${Date.now()}@test.local`);
await a.locator('.field input:not([type=email]):not([type=password])').fill('Offline QA');
await a.locator('input[type=password]').fill('contraseña-larga');
await a.getByRole('button', { name: 'Registrarme' }).click();
await a.waitForSelector('#h-remote', { timeout: 20000 });
await a.getByRole('button', { name: /^Abrir la demo/ }).first().click();
await a.waitForURL(/#\/s\//, { waitUntil: 'commit' });
await a.waitForSelector('.react-flow__node', { timeout: 20000 });
await waitStatus(/en línea/);
const wsId = /#\/s\/([^/?]+)/.exec(a.url())[1];
const nodesOnline = await a.locator('.react-flow__node').count();
console.log('espacio', wsId, '| nodos:', nodesOnline, '| estado:', await status());
const cachedRole = await a.evaluate(id => JSON.parse(localStorage.getItem('alldraw:index') ?? '{}')[`srv_${id}`]?.role ?? null, wsId);
check(cachedRole === 'owner', `rol guardado junto a la lista local (${cachedRole})`);
// Otro espacio que nunca se abre en este navegador (sin copia)
const otherId = await a.evaluate(async () => (await (await fetch('/api/workspaces', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'all-draw' }, body: JSON.stringify({ name: 'Nunca abierto' }) })).json()).id);

// Service worker: se espera a que se instale (precache) y una recarga con red para que controle la página
await a.evaluate(() => 'serviceWorker' in navigator && Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 30000))]));
await a.reload({ waitUntil: 'networkidle' });
await a.waitForSelector('.react-flow__node', { timeout: 20000 });
const swControls = await a.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 5000))]);
  return !!navigator.serviceWorker.controller;
});
console.log('service worker controla la página:', swControls);

// 2. Sin red: se abre desde la caché con el último rol y el aviso
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
await ctx.setOffline(true);
await a.evaluate(id => { location.hash = `#/s/${id}`; }, wsId);
await a.waitForSelector('.react-flow__node', { timeout: 20000 });
await waitStatus(/sin conexión — los cambios se sincronizarán/);
const nodesOffline = await a.locator('.react-flow__node').count();
check(nodesOffline === nodesOnline, `sin red se abre la copia local (${nodesOffline}/${nodesOnline} nodos)`);
check(/sin conexión — los cambios se sincronizarán/.test(await status()), `estado sin conexión: «${await status()}»`);
check(await a.locator('.ad-pal').count() > 0 || !(await a.locator('.app-name').isDisabled()), 'editable con el rol guardado (owner)');
check(await a.getByRole('button', { name: 'Compartir', exact: true }).count() === 0, 'sin red no se ofrece Compartir');
// Edición sin red
const renamed = `Renombrado sin red ${Date.now() % 10000}`;
await a.locator('.app-name').fill(renamed);
await a.waitForTimeout(600);

// 3. Vuelve la red: se conecta el proveedor y el cambio llega al servidor
await ctx.setOffline(false);
await waitStatus(/en línea/, 25000);
check(/en línea/.test(await status()), `al volver la red: «${await status()}»`);
check(await a.getByRole('button', { name: 'Compartir', exact: true }).count() === 1, 'con red vuelve Compartir');
let serverName = null;
for (let i = 0; i < 30 && serverName !== renamed; i++) {
  serverName = await a.evaluate(async id => (await (await fetch(`/api/workspaces/${id}/snapshot`)).json()).meta?.name, wsId);
  if (serverName !== renamed) await a.waitForTimeout(300);
}
check(serverName === renamed, `el cambio hecho sin red llegó al servidor (${serverName})`);

// 4. Sin red y sin copia: error claro
await ctx.setOffline(true);
await a.evaluate(id => { location.hash = `#/s/${id}`; }, otherId);
await a.waitForSelector('.state__card', { timeout: 15000 });
const card = await a.locator('.state__card').innerText();
check(/Sin conexión con el servidor/.test(card) && /no hay copia/.test(card), `sin copia → error claro: «${card.split('\n').slice(0, 2).join(' | ')}»`);
check(await a.locator('.state__card').getByRole('button', { name: 'Reintentar' }).count() === 1, 'ofrece reintentar');

// 5. Recarga completa sin red (el service worker sirve la app y se abre la copia)
if (swControls) {
  await a.evaluate(id => { location.hash = `#/s/${id}`; }, wsId);
  await a.reload({ waitUntil: 'domcontentloaded' }).catch(e => fail(`recarga sin red: ${e.message}`));
  await a.waitForSelector('.react-flow__node', { timeout: 20000 }).catch(() => fail('recarga sin red: no se abre la copia'));
  await waitStatus(/sin conexión — los cambios se sincronizarán/).catch(() => fail('recarga sin red: falta el aviso'));
  check(await a.locator('.app-name').inputValue() === renamed, 'recarga sin red: copia con el último cambio');
} else console.log('  (sin service worker controlando: se omite la recarga sin red)');
await ctx.setOffline(false);

await browser.close();
console.log('ERRORS', errors);
process.exit(errors.length ? 1 : 0);
