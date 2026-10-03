// Revocar con el espacio abierto y la identidad en la presencia:
// - con cuenta, la presencia lleva el nombre de la cuenta; con enlace sin cuenta, un nombre local estable (no cambia al recargar);
// - bajar a un miembro a lectura le cambia el rol al momento (cierre 4205 → reconecta); quitarlo o revocar el enlace
//   muestra «Ya no tienes acceso a este espacio» con «Volver al inicio».
// Uso: BASE=http://127.0.0.1:<puerto> node e2e/revoke.mjs
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4002';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const check = (ok, msg) => { console.log(ok ? '  ok ' : '  KO ', msg); if (!ok) errors.push(msg); };
const mk = async () => { const p = await (await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 820 } })).newPage(); await p.addInitScript(() => localStorage.setItem('alldraw:tour', 'done')); p.on('pageerror', e => errors.push(`pageerror: ${e.message}`)); return p; };
const H = { 'content-type': 'application/json', 'x-requested-with': 'all-draw' };
/** Registro por la API desde la página (la cookie queda en su contexto). */
const register = (p, email, name) => p.evaluate(async ({ email, name, H }) => {
  const cfg = await (await fetch('/api/auth/config')).json();
  await new Promise(r => setTimeout(r, (cfg.formMinMs ?? 0) + 200)); // el servidor exige un tiempo mínimo de formulario
  const r = await fetch('/api/auth/register', { method: 'POST', headers: H, body: JSON.stringify({ email, name, password: 'contraseña-larga', ...(cfg.formToken ? { formToken: cfg.formToken } : {}) }) });
  return (await r.json()).user;
}, { email, name, H });
const call = (p, method, path, body) => p.evaluate(async ({ method, path, body, H }) => { const r = await fetch(path, { method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }; }, { method, path, body, H });
const statusOf = p => p.locator('.app-status').first().innerText();
const waitText = (p, sel, re, timeout = 15000) => p.waitForFunction(({ sel, r }) => new RegExp(r).test(document.querySelector(sel)?.textContent ?? ''), { sel, r: re.source }, { timeout });
const stamp = Date.now();

// Ana (dueña) crea el espacio
const a = await mk();
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
await register(a, `ana-${stamp}@test.local`, 'Ana QA');
const wsId = (await call(a, 'POST', '/api/workspaces', { name: 'Revocar QA' })).body.id;
await a.goto(`${base}/#/s/${wsId}`, { waitUntil: 'networkidle' });
await waitText(a, '.app-status', /en línea/);

// Bea entra por enlace de edición, sin cuenta
const link = (await call(a, 'POST', `/api/workspaces/${wsId}/links`, { role: 'editor' })).body;
const b = await mk();
await b.goto(link.url.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
await waitText(b, '.app-status', /en línea/);
const bName = await b.evaluate(() => localStorage.getItem('alldraw:me'));
check(/^Anónimo \d{3}$/.test(bName ?? ''), `nombre local generado y guardado: ${bName}`);
await a.waitForFunction(n => [...document.querySelectorAll('.ad-avatar:not(.is-me)')].some(e => e.getAttribute('title') === n), bName, { timeout: 10000 }).catch(() => {});
check(await a.locator(`.ad-avatar:not(.is-me)[title="${bName}"]`).count() === 1, 'Ana ve a Bea con su nombre local');
await b.waitForFunction(() => [...document.querySelectorAll('.ad-avatar:not(.is-me)')].some(e => e.getAttribute('title') === 'Ana QA'), null, { timeout: 10000 }).catch(() => {});
check(await b.locator('.ad-avatar:not(.is-me)[title="Ana QA"]').count() === 1, 'Bea ve a Ana con el nombre de su cuenta');
const colorA1 = await a.locator('.ad-avatar.is-me').evaluate(e => getComputedStyle(e).backgroundColor);
await b.reload({ waitUntil: 'networkidle' });
await waitText(b, '.app-status', /en línea/);
check(await b.evaluate(() => localStorage.getItem('alldraw:me')) === bName, 'el nombre local no cambia al recargar');
check(/Anónimo \d{3} \(tú\)/.test(await b.locator('.ad-avatar.is-me').getAttribute('title')) && (await b.locator('.ad-avatar.is-me').getAttribute('title')).startsWith(bName), 'la presencia propia usa ese nombre');
await a.reload({ waitUntil: 'networkidle' });
await waitText(a, '.app-status', /en línea/);
check(await a.locator('.ad-avatar.is-me').evaluate(e => getComputedStyle(e).backgroundColor) === colorA1, `color de la cuenta estable entre recargas (${colorA1})`);

// Carla, miembro con cuenta: editora → lectora (reconecta con el rol nuevo) → quitada (aviso)
const c = await mk();
await c.goto(base + '/#/', { waitUntil: 'networkidle' });
const carla = await register(c, `carla-${stamp}@test.local`, 'Carla QA');
check((await call(a, 'PUT', `/api/workspaces/${wsId}/members/${carla.id}`, { role: 'editor' })).status === 200, 'Carla añadida como editora');
await c.goto(`${base}/#/s/${wsId}`, { waitUntil: 'networkidle' });
await waitText(c, '.app-status', /en línea · puede editar/);
check(!(await c.locator('.app-name').isDisabled()), 'Carla puede editar');
check((await call(a, 'PUT', `/api/workspaces/${wsId}/members/${carla.id}`, { role: 'viewer' })).status === 200, 'Carla pasa a lectora');
await waitText(c, '.app-status', /solo lectura/).catch(() => {});
check(/solo lectura/.test(await statusOf(c)), `Carla ve su rol nuevo sin recargar: «${await statusOf(c)}»`);
check(await c.locator('.app-name').isDisabled(), 'y ya no puede editar');
await waitText(c, '.app-status', /en línea/).catch(() => {});
check(/en línea/.test(await statusOf(c)), 'Carla sigue conectada (reconectó)');

check((await call(a, 'DELETE', `/api/workspaces/${wsId}/members/${carla.id}`)).status === 204, 'Carla quitada');
await c.waitForSelector('[data-testid=lost-access]', { timeout: 10000 }).catch(() => {});
check(/Ya no tienes acceso a este espacio/.test(await c.locator('[data-testid=lost-access]').innerText().catch(() => '')), 'Carla ve «Ya no tienes acceso a este espacio»');

// Revocar el enlace de Bea
check((await call(a, 'DELETE', `/api/workspaces/${wsId}/links/${link.token}`)).status === 204, 'enlace revocado');
await b.waitForSelector('[data-testid=lost-access]', { timeout: 10000 }).catch(() => {});
const dlg = await b.locator('[data-testid=lost-access]').innerText().catch(() => '');
check(/Ya no tienes acceso a este espacio/.test(dlg), 'Bea ve «Ya no tienes acceso a este espacio»');
check(/^sin acceso$/.test((await statusOf(b)).trim()), `estado de Bea: «${await statusOf(b)}»`);
if (process.env.SHOT) await b.screenshot({ path: process.env.SHOT });
check(await b.evaluate(id => JSON.parse(localStorage.getItem('alldraw:index') ?? '{}')[`srv_${id}`]?.role ?? null, wsId) === null, 'se olvida el rol guardado (no se abrirá sin red)');
await b.getByRole('link', { name: 'Volver al inicio' }).click();
await b.waitForFunction(() => location.hash === '#/' || location.hash === '', null, { timeout: 5000 }).catch(() => {});
check(['#/', ''].includes(await b.evaluate(() => location.hash)), '«Volver al inicio» lleva al inicio');
// Ana no se ha visto afectada
check(/en línea/.test(await statusOf(a)) && await a.locator('[data-testid=lost-access]').count() === 0, 'Ana sigue conectada');

await browser.close();
console.log('ERRORS', errors);
process.exit(errors.length ? 1 : 0);
