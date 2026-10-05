// Cuentas de punta a punta en Chromium contra un servidor temporal con `MAIL_PROVIDER=log` (los enlaces de los correos se
// leen de su log):
// - verificar el correo con el enlace del registro (el token se borra de la barra de direcciones);
// - «¿Olvidaste tu contraseña?» → mismo aviso exista o no la cuenta → enlace → contraseña nueva → sesiones cerradas;
// - sesiones activas en «Cuenta» y «Cerrar esta sesión» (la otra sesión deja de valer);
// - campana: compartir un espacio y mencionar en un comentario llegan como notificación, con enlace y contador, también
//   en la barra del editor; el correo de la mención sale en el log;
// - un enlace que caduca con el espacio abierto lo corta (aviso «Ya no tienes acceso»);
// - sin correo (`MAIL_PROVIDER=none`), «¿Olvidaste tu contraseña?» explica que lo pida a un administrador.
//
// Uso: pnpm --filter web exec vite build --outDir /tmp/alldraw-accounts-web && node e2e/accounts.mjs
//   STATIC_DIR (por defecto /tmp/alldraw-accounts-web), PORT (por defecto 47390; el de sin correo, PORT+1).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = path.resolve(process.env.STATIC_DIR ?? '/tmp/alldraw-accounts-web'); // absoluta: el servidor arranca en otro directorio
const port = Number(process.env.PORT ?? 47390);
if (!fs.existsSync(path.join(staticDir, 'index.html'))) { console.error(`falta la app compilada en ${staticDir} (vite build --outDir ${staticDir})`); process.exit(2); }

/** Arranca `apps/server` con un DATA_DIR temporal; devuelve la URL, las líneas JSON del log y cómo pararlo. */
async function startServer(p, extraEnv) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-accounts-data-'));
  const lines = [];
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: path.join(root, 'apps/server'),
    env: { ...process.env, PORT: String(p), HOST: '127.0.0.1', DATA_DIR: dataDir, STATIC_DIR: staticDir, BACKUP_DIR: path.join(dataDir, 'backups'), REGISTER_MIN_MS: '0', LOG_LEVEL: 'info', PUBLIC_URL: '', NODE_ENV: '', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { lines.push(JSON.parse(l)); } catch { /* no JSON */ } } });
  child.stderr.on('data', d => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
  const url = `http://127.0.0.1:${p}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${url}/healthz`)).ok) break; } catch { /* aún no */ } await new Promise(r => setTimeout(r, 100)); }
  return { url, lines, stop: () => new Promise(r => { child.once('exit', r); child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000); }).then(() => fs.rmSync(dataDir, { recursive: true, force: true })) };
}

const srv = await startServer(port, { MAIL_PROVIDER: 'log' });
const base = srv.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const check = (ok, msg) => { console.log(ok ? '  ok ' : '  KO ', msg); if (!ok) errors.push(msg); };
const mk = async () => {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 820 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'es'); } catch { /* about:blank */ } });
  p.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  return p;
};
const H = { 'content-type': 'application/json', 'x-requested-with': 'all-draw' };
const call = (p, method, pth, body) => p.evaluate(async ({ method, pth, body, H }) => { const r = await fetch(pth, { method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }; }, { method, pth, body, H });
const register = async (p, email, name, password = 'contraseña-larga') => (await call(p, 'POST', '/api/auth/register', { email, name, password })).body.user;
const login = async (p, email, password = 'contraseña-larga') => (await call(p, 'POST', '/api/auth/login', { email, password })).status;
/** Último correo a `to` cuyo texto encaja con `re`, esperando a que aparezca en el log. */
async function mailTo(to, re, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    const m = [...srv.lines].reverse().find(l => l.msg === 'correo' && l.to === to && re.test(String(l.text)));
    if (m) return m;
    if (Date.now() - t0 > timeout) return null;
    await new Promise(r => setTimeout(r, 100));
  }
}
const linkIn = m => /https?:\/\/\S+#\/\S+token=\S+/.exec(String(m?.text ?? ''))?.[0] ?? '';
const stamp = Date.now();
const ana = `ana-${stamp}@test.local`, bea = `bea-${stamp}@test.local`;

try {
  // ---------------------------------------------------------------- Verificar el correo
  console.log('verificar el correo');
  const a = await mk();
  await a.goto(base + '/#/espacios', { waitUntil: 'networkidle' });
  const anaUser = await register(a, ana, 'Ana QA');
  check(anaUser?.emailVerified === false, 'recién registrada, el correo está sin verificar');
  const vmail = await mailTo(ana, /verificar\?token=/);
  check(!!vmail && /Confirma tu correo/.test(vmail.subject), `correo de verificación en el log: «${vmail?.subject}»`);
  await a.goto(base + '/#/keys', { waitUntil: 'networkidle' });
  await a.waitForSelector('[data-testid=verify-notice]', { timeout: 8000 }).catch(() => {});
  check(/sin verificar/.test(await a.locator('[data-testid=verify-notice]').innerText().catch(() => '')), 'Cuenta avisa de que el correo está sin verificar');
  await a.goto(linkIn(vmail).replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  await a.waitForSelector('[data-testid=verify-screen] h1:text("Correo confirmado")', { timeout: 8000 }).catch(() => {});
  check(/Correo confirmado/.test(await a.locator('[data-testid=verify-screen]').innerText()), 'el enlace confirma el correo');
  check(!/token=/.test(await a.evaluate(() => location.href)), 'el token ya no está en la barra de direcciones');
  check((await call(a, 'GET', '/api/auth/session')).body.user.emailVerified === true, 'la cuenta queda verificada');
  await a.goto('about:blank');
  await a.goto(linkIn(vmail).replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  await a.waitForSelector('[data-testid=verify-screen] h1:text("Este enlace ya no sirve")', { timeout: 8000 }).catch(() => {});
  check(/ya no sirve/.test(await a.locator('[data-testid=verify-screen]').innerText()), 'el enlace no sirve dos veces');

  // ---------------------------------------------------------------- Sesiones activas
  console.log('sesiones activas');
  const a2 = await mk();
  await a2.goto(base + '/#/espacios', { waitUntil: 'networkidle' });
  check(await login(a2, ana) === 200, 'Ana entra desde otro navegador');
  await a.goto(base + '/#/keys', { waitUntil: 'networkidle' });
  await a.waitForSelector('[data-testid=sessions] li .sessions__what', { timeout: 8000 });
  const rows = a.locator('[data-testid=sessions] li');
  check(await rows.count() === 2, `dos sesiones en la lista (${await rows.count()})`);
  check(await a.locator('[data-testid=sessions] .sessions__tag').count() === 1, 'una marcada como «esta sesión»');
  check(/Chrome en Linux/.test(await rows.first().innerText()), `dispositivo resumido: «${(await rows.first().innerText()).split('\n')[0]}»`);
  check(/IP 127\.0\.0\.0/.test(await a.locator('[data-testid=sessions]').innerText()), 'IP truncada');
  const other = rows.filter({ hasNot: a.locator('.sessions__tag') });
  await other.getByRole('button', { name: /Cerrar la sesión de/ }).click();
  await a.getByRole('button', { name: 'Cerrar esta sesión' }).last().click(); // confirmar
  await a.waitForFunction(() => document.querySelectorAll('[data-testid=sessions] li').length === 1, null, { timeout: 8000 }).catch(() => {});
  check(await rows.count() === 1, 'queda una sesión');
  check((await call(a2, 'GET', '/api/auth/session')).body.user === null, 'la sesión cerrada ya no vale en el otro navegador');

  // ---------------------------------------------------------------- Notificaciones
  console.log('notificaciones');
  const b = await mk();
  await b.goto(base + '/#/espacios', { waitUntil: 'networkidle' });
  const beaUser = await register(b, bea, 'Bea QA');
  const wsId = (await call(a, 'POST', '/api/workspaces', { name: 'Cuentas QA' })).body.id;
  check((await call(a, 'PUT', `/api/workspaces/${wsId}/members/${beaUser.id}`, { role: 'editor' })).status === 200, 'Ana comparte un espacio con Bea');
  await b.reload({ waitUntil: 'networkidle' });
  await b.waitForSelector('[data-testid=bell]', { timeout: 8000 }).catch(() => {});
  check(/1 sin leer/.test(await b.locator('[data-testid=bell]').getAttribute('aria-label').catch(() => '') ?? ''), 'la campana de la cabecera cuenta 1 sin leer');
  await b.locator('[data-testid=bell]').click();
  const item = b.locator('.bell__item').first();
  check(/Ana QA ha compartido contigo «Cuentas QA»/.test(await item.innerText()), `la notificación dice quién y qué: «${(await item.innerText()).split('\n')[0]}»`);
  await item.click();
  await b.waitForFunction(id => location.hash.startsWith(`#/s/${id}`), wsId, { timeout: 8000 }).catch(() => {});
  check((await b.evaluate(() => location.hash)).startsWith(`#/s/${wsId}`), 'el enlace lleva al espacio');
  await b.waitForSelector('.app-status', { timeout: 15000 });
  check(await b.locator('[data-testid=bell]').first().waitFor({ timeout: 15000 }).then(() => true, () => false) && await b.locator('[data-testid=bell]').count() === 1, 'la campana también está en la barra del editor');
  check(!/sin leer/.test(await b.locator('[data-testid=bell]').getAttribute('aria-label') ?? ''), 'al abrirla queda leída');
  // Mención: una Persona con el correo de Bea y un comentario nuevo que la menciona (por la API, como un agente)
  const now = new Date().toISOString();
  const cmd = await call(a, 'POST', `/api/workspaces/${wsId}/commands`, { commands: [
    { type: 'set', collection: 'people', id: 'p_bea', value: { id: 'p_bea', name: 'Bea QA', email: bea, assignments: [] } },
    { type: 'set', collection: 'comments', id: 'c_qa', value: { id: 'c_qa', threadId: 'c_qa', anchor: { kind: 'view', id: 'v_x' }, author: { name: 'Ana QA', userId: anaUser.id }, text: '@Bea QA revisa esto', mentions: ['p_bea'], createdAt: now } },
  ] });
  check(cmd.status === 200, `comentario con mención (${cmd.status})`);
  const mention = await mailTo(bea, /te ha mencionado/);
  check(!!mention && /Ana QA te ha mencionado en «Cuentas QA»/.test(mention.subject), `correo de la mención en el log: «${mention?.subject}»`);
  await b.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await b.waitForFunction(() => /1 sin leer/.test(document.querySelector('[data-testid=bell]')?.getAttribute('aria-label') ?? ''), null, { timeout: 8000 }).catch(() => {});
  check(/1 sin leer/.test(await b.locator('[data-testid=bell]').getAttribute('aria-label') ?? ''), 'la mención aparece en la campana del editor');
  await b.locator('[data-testid=bell]').click();
  check(/Ana QA te ha mencionado en «Cuentas QA»[\s\S]*@Bea QA revisa esto/.test(await b.locator('.bell__item').first().innerText()), 'con el extracto del comentario');
  await b.keyboard.press('Escape');

  // ---------------------------------------------------------------- Enlace que caduca con el espacio abierto
  console.log('enlace que caduca');
  const exp = new Date(Date.now() + 6000).toISOString();
  const link = (await call(a, 'POST', `/api/workspaces/${wsId}/links`, { role: 'editor', expiresAt: exp })).body;
  const c = await mk();
  await c.goto(link.url.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  await c.waitForFunction(() => /en línea/.test(document.querySelector('.app-status')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
  check(/en línea/.test(await c.locator('.app-status').innerText()), 'con el enlace temporal se conecta');
  await c.waitForSelector('[data-testid=lost-access]', { timeout: 15000 }).catch(() => {});
  check(/Ya no tienes acceso/.test(await c.locator('[data-testid=lost-access]').innerText().catch(() => '')), 'al caducar se corta la conexión y se avisa');
  check(srv.lines.some(l => l.msg === 'ws: enlace caducado'), 'el servidor registra el cierre por caducidad');

  // ---------------------------------------------------------------- Recuperar la contraseña
  console.log('recuperar la contraseña');
  const r = await mk();
  await r.goto(base + '/#/bienvenida', { waitUntil: 'networkidle' });
  await r.getByRole('button', { name: 'Entrar' }).first().click();
  await r.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  check(/te enviaremos un enlace/.test(await r.locator('.modal__lead').innerText()), 'el diálogo explica el enlace por correo');
  await r.locator('input[name=email]').fill(`nadie-${stamp}@test.local`);
  await r.getByRole('button', { name: 'Enviar el enlace' }).click();
  await r.waitForSelector('[data-testid=forgot-sent]', { timeout: 8000 });
  const noAccount = await r.locator('[data-testid=forgot-sent]').innerText();
  await r.getByRole('button', { name: 'Volver a entrar' }).click();
  await r.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await r.locator('input[name=email]').fill(ana);
  await r.getByRole('button', { name: 'Enviar el enlace' }).click();
  await r.waitForSelector('[data-testid=forgot-sent]', { timeout: 8000 });
  check(await r.locator('[data-testid=forgot-sent]').innerText() === noAccount, 'el mismo aviso exista o no la cuenta');
  const rmail = await mailTo(ana, /restablecer\?token=/);
  check(!!rmail && !(await mailTo(`nadie-${stamp}@test.local`, /./, 500)), 'sólo se escribe a la cuenta que existe');
  await r.goto(linkIn(rmail).replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  await r.waitForSelector('[data-testid=reset-screen] input[type=password]', { timeout: 8000 });
  check(!/token=/.test(await r.evaluate(() => location.href)), 'el token ya no está en la barra de direcciones');
  const pw = r.locator('[data-testid=reset-screen] input[type=password]');
  await pw.nth(0).fill('contraseña-nueva-larga'); await pw.nth(1).fill('contraseña-nueva-larga');
  await r.getByRole('button', { name: 'Guardar la contraseña' }).click();
  await r.waitForSelector('[data-testid=reset-screen] h1:text("Contraseña cambiada")', { timeout: 8000 }).catch(() => {});
  check(/Contraseña cambiada/.test(await r.locator('[data-testid=reset-screen]').innerText()), 'contraseña cambiada con el enlace');
  check((await call(a, 'GET', '/api/auth/session')).body.user === null, 'las sesiones abiertas de Ana se han cerrado');
  check(await login(r, ana) === 401 && await login(r, ana, 'contraseña-nueva-larga') === 200, 'la vieja ya no vale; la nueva sí');
  await r.goto('about:blank');
  await r.goto(linkIn(rmail).replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
  await r.waitForSelector('[data-testid=reset-screen] input[type=password]', { timeout: 8000 });
  await pw.nth(0).fill('otra-contraseña-larga'); await pw.nth(1).fill('otra-contraseña-larga');
  await r.getByRole('button', { name: 'Guardar la contraseña' }).click();
  await r.waitForSelector('[data-testid=reset-screen] h1:text("Este enlace ya no sirve")', { timeout: 8000 }).catch(() => {});
  check(/ya no sirve/.test(await r.locator('[data-testid=reset-screen]').innerText()), 'el enlace de restablecer es de un solo uso');
  check(!srv.lines.filter(l => l.msg === 'http').some(l => /rst_|vfy_/.test(JSON.stringify(l))), 'ningún token en el log de accesos');
} finally {
  await srv.stop();
}

// ---------------------------------------------------------------- Sin correo
console.log('sin correo');
const off = await startServer(port + 1, { MAIL_PROVIDER: 'none' });
try {
  const n = await mk();
  await n.goto(off.url + '/#/bienvenida', { waitUntil: 'networkidle' });
  check((await call(n, 'GET', '/api/auth/config')).body.email === false, 'config anuncia email: false');
  await n.getByRole('button', { name: 'Entrar' }).first().click();
  await n.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  check(/Pide a un administrador/.test(await n.locator('.modal__lead').innerText()), 'el enlace explica que lo pida a un administrador');
  check(await n.locator('input[name=email]').count() === 0, 'y no pide el correo');
} finally { await off.stop(); }

await browser.close();
if (errors.length) { console.error(`\n${errors.length} fallos:\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log('\naccounts: todo bien');
