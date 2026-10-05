// Edición simultánea: dos navegadores editan a la vez el nombre y la documentación de un mismo elemento.
// A (dueño, con cuenta) abre la demo y comparte un enlace de edición; B lo abre. Mientras B está «desconectado» (su
// WebSocket se retiene con `routeWebSocket`: así las ediciones son de verdad simultáneas), A renombra el elemento y
// escribe al principio de su documentación y B escribe al final; al soltar, los dos ven las tres cosas.
// Después: historial — A crea una instantánea, cambia el nombre, la abre con «Ver», la compara y la restaura; B ve el
// aviso «A ha restaurado la versión de …». Crea una cuenta `*@test.local` en el servidor de BASE (bórrala si es producción).
import { chromium } from 'playwright-core';
const base = process.env.BASE ?? 'http://127.0.0.1:4002';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? '  ok ' : 'FAIL '} ${what}`); if (!ok) failed++; };
const mk = async () => {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1360, height: 860 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('alldraw:tour', 'done'));
  p.on('pageerror', e => errors.push(e.message));
  return p;
};
const a = await mk(), b = await mk();

// B: WebSocket a través de Playwright, con interruptor para retener los mensajes en las dos direcciones.
let hold = false;
const queued = { up: [], down: [] };
let relay = null;
await b.routeWebSocket(/\/ws\//, ws => {
  const server = ws.connectToServer();
  ws.onMessage(m => { if (hold) queued.up.push(m); else server.send(m); });
  server.onMessage(m => { if (hold) queued.down.push(m); else ws.send(m); });
  relay = { flush() { for (const m of queued.up.splice(0)) server.send(m); for (const m of queued.down.splice(0)) ws.send(m); } };
});

// A: cuenta, demo y enlace de edición
await a.goto(base + '/#/', { waitUntil: 'networkidle' });
await a.getByRole('button', { name: /Entrar/ }).click();
await a.getByRole('button', { name: 'No tengo cuenta' }).click();
await a.locator('input[type=email]').fill(`e2e-concurrent-${Date.now()}@test.local`);
await a.locator('.field input:not([type=email]):not([type=password])').fill('Ana E2E');
await a.locator('input[type=password]').fill('contraseña-larga');
await a.getByRole('button', { name: 'Registrarme' }).click();
await a.waitForSelector('#h-remote', { timeout: 20000 });
await a.getByRole('button', { name: /^Abrir la demo/ }).first().click();
await a.waitForURL(/#\/s\//, { waitUntil: 'commit' });
await a.waitForSelector('.react-flow__node', { timeout: 20000 });
await a.waitForTimeout(1200);
const wsId = /#\/s\/([^/?]+)/.exec(a.url())[1];
await a.getByRole('button', { name: 'Compartir', exact: true }).click();
await a.getByRole('button', { name: 'Nuevo enlace de edición' }).click();
await a.waitForSelector('text=edición', { timeout: 10000 }); await a.waitForTimeout(500);
await a.keyboard.press('Escape');
const links = await a.evaluate(async id => (await fetch(`/api/workspaces/${id}/links`)).json(), wsId);
await b.goto(links.links[0].url.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
await b.waitForSelector('.react-flow__node', { timeout: 20000 });
await b.waitForTimeout(1200);

// Los dos seleccionan el mismo elemento
const NODE = 'Cliente';
for (const p of [a, b]) await p.locator('.react-flow__node', { hasText: NODE }).first().click();
const nameOf = p => p.getByLabel('Nombre', { exact: true });
const docOf = p => p.locator('label.ad-field', { hasText: 'Documentación' }).locator('textarea').first();
await nameOf(a).waitFor({ timeout: 10000 }); await nameOf(b).waitFor({ timeout: 10000 });
// Documentación de partida, sincronizada
await docOf(a).fill('Base.');
await b.waitForFunction(() => [...document.querySelectorAll('label.ad-field')].some(l => l.textContent.includes('Documentación') && l.querySelector('textarea')?.value === 'Base.'), null, { timeout: 10000 });
check(true, 'B ve la documentación de partida');

// Ediciones simultáneas (B retenido)
hold = true;
await a.waitForTimeout(200);
await nameOf(a).fill('Cliente de A');
await docOf(a).click(); await a.keyboard.press('Control+Home'); await a.keyboard.type('[A] ', { delay: 20 });
await docOf(b).click(); await b.keyboard.press('Control+End'); await b.keyboard.type(' [B]', { delay: 20 });
await a.waitForTimeout(300);
check(await nameOf(b).inputValue() === NODE && await docOf(b).inputValue() === 'Base. [B]', 'mientras está retenido, B solo ve lo suyo');
check(await docOf(a).inputValue() === '[A] Base.', 'y A solo lo suyo');
hold = false;
relay?.flush();
const want = { name: 'Cliente de A', doc: '[A] Base. [B]' };
for (const [p, who] of [[a, 'A'], [b, 'B']]) {
  try {
    await p.waitForFunction(w => document.querySelector('input[aria-label="Nombre"]')?.value === w.name
      && [...document.querySelectorAll('label.ad-field')].some(l => l.textContent.includes('Documentación') && l.querySelector('textarea')?.value === w.doc), want, { timeout: 10000 });
    check(true, `${who} ve el nombre de A y la documentación de los dos («${want.doc}»)`);
  } catch { check(false, `${who} converge (nombre «${await nameOf(p).inputValue()}», doc «${await docOf(p).inputValue()}»)`); }
}
const snap = await a.evaluate(async id => (await fetch(`/api/workspaces/${id}/snapshot`)).json(), wsId);
const el = Object.values(snap.elements).find(e => e.name === want.name);
check(!!el && el.doc === want.doc, 'el servidor tiene las dos ediciones');

// Historial: instantánea, cambio, «Ver», «Comparar con la actual», «Restaurar esta versión» → aviso en B
await a.getByRole('button', { name: 'Historial' }).click();
await a.locator('#snap-label').fill('antes del e2e');
await a.getByRole('button', { name: 'Crear instantánea' }).click();
await a.locator('.share__list li', { hasText: 'antes del e2e' }).waitFor({ timeout: 10000 });
await a.keyboard.press('Escape');
await nameOf(a).fill('Nombre temporal');
await b.waitForFunction(() => document.querySelector('input[aria-label="Nombre"]')?.value === 'Nombre temporal', null, { timeout: 10000 });
await a.getByRole('button', { name: 'Historial' }).click();
await a.locator('.share__list li', { hasText: 'antes del e2e' }).getByRole('button', { name: /^Ver / }).click();
await a.getByTestId('snapshot-preview').waitFor({ timeout: 10000 });
await a.getByTestId('snapshot-preview').locator('.react-flow__node').first().waitFor({ timeout: 10000 });
check(await a.getByTestId('snapshot-preview').locator('.react-flow__node', { hasText: 'Cliente de A' }).count() > 0, 'la vista previa muestra la versión guardada (solo lectura)');
await a.getByRole('button', { name: 'Comparar con la actual' }).click();
const diffText = await a.getByTestId('snapshot-diff').innerText();
check(/Cambiados desde entonces/.test(diffText) && diffText.includes('Nombre temporal'), 'comparar: el elemento renombrado aparece como cambiado');
await a.getByRole('button', { name: 'Restaurar esta versión' }).click();
await a.locator('[role="alertdialog"]').getByRole('button', { name: 'Restaurar' }).click();
try {
  await b.locator('.ad-toast', { hasText: 'ha restaurado la versión de' }).waitFor({ timeout: 10000 });
  check((await b.locator('.ad-toast', { hasText: 'ha restaurado la versión de' }).innerText()).includes('Ana E2E'), 'B ve el aviso «Ana E2E ha restaurado la versión de …»');
} catch { check(false, 'B ve el aviso de restauración'); }
await b.waitForFunction(() => document.querySelector('input[aria-label="Nombre"]')?.value === 'Cliente de A', null, { timeout: 10000 }).then(() => check(true, 'y el nombre vuelve al de la versión restaurada'), () => check(false, 'el nombre vuelve en B'));
check(await a.locator('.ad-toast', { hasText: 'ha restaurado la versión de' }).count() === 0, 'A no se avisa a sí mismo');

await browser.close();
console.log('ERRORS', errors);
process.exit(errors.length || failed ? 1 : 0);
