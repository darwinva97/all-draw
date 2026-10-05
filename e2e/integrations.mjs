// Integraciones de punta a punta en Chromium contra un servidor temporal, con un receptor de webhooks local (un
// `http.createServer` en este mismo script; el servidor arranca con `WEBHOOKS_ALLOW_PRIVATE=1` para poder llamarlo —
// sólo para pruebas, inseguro en producción):
// - Compartir → «Webhooks»: alta con eventos, secreto visible una vez, «Probar» (ping firmado HMAC-SHA256), registro de
//   entregas con estado y latencia; `workspace.changed` agregado, `snapshot.created`, reintentos ante 503; baja.
// - Compartir → «Insertar»: enlace de inserción por vista, tema y tamaño en el `<iframe>`, URL de la imagen; la página
//   `/embed/…` se deja incrustar desde otro origen, hace zoom y se actualiza sola (sondeo); oEmbed; revocar.
// - MCP remoto `POST /mcp` con una API key: `tools/list` (con `list_views`), `tools/call` y `resources/read`.
//
// Uso: node e2e/integrations.mjs   (compila la web en STATIC_DIR si no está: /tmp/alldraw-integrations-web)
//   STATIC_DIR, PORT (por defecto 47410), CHROMIUM (por defecto /usr/bin/chromium), SHOTS=<carpeta> (capturas del diálogo).
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = process.env.STATIC_DIR ?? '/tmp/alldraw-integrations-web';
const port = Number(process.env.PORT ?? 47410);
if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
  console.log(`compilando la web en ${staticDir}…`);
  const b = spawnSync('pnpm', ['--filter', 'web', 'exec', 'vite', 'build', '--outDir', staticDir, '--emptyOutDir'], { cwd: root, stdio: 'inherit' });
  if (b.status !== 0) { console.error('no se pudo compilar la web'); process.exit(2); }
}

// ---------------------------------------------------------------- Receptor de webhooks (y una página de otro origen)
const hits = [];
let replyStatus = 200;
let hostHtml = '';
const receiver = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/host.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(hostHtml); return; }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => { hits.push({ path: req.url, headers: req.headers, body, at: Date.now() }); res.writeHead(replyStatus, { 'content-type': 'text/plain' }); res.end('recibido'); });
});
await new Promise(r => receiver.listen(0, '127.0.0.1', r));
const rport = receiver.address().port;
const hookUrl = `http://127.0.0.1:${rport}/hook`;

// ---------------------------------------------------------------- Servidor temporal
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-integrations-data-'));
const lines = [];
const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: path.join(root, 'apps/server'),
  env: {
    ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, STATIC_DIR: staticDir, BACKUP_DIR: path.join(dataDir, 'backups'),
    REGISTER_MIN_MS: '0', LOG_LEVEL: 'info', PUBLIC_URL: '', NODE_ENV: '', MAIL_PROVIDER: 'none',
    WEBHOOKS_ALLOW_PRIVATE: '1', WEBHOOKS_DEBOUNCE_MS: '1500', WEBHOOKS_RETRY_BASE_MS: '300',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let buf = '';
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { lines.push(JSON.parse(l)); } catch { /* no JSON */ } } });
child.stderr.on('data', d => { if (!/ExperimentalWarning|trace-warnings/.test(String(d))) process.stderr.write(d); });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 150; i++) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* aún no */ } await new Promise(r => setTimeout(r, 100)); }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const check = (ok, msg) => { console.log(ok ? '  ok ' : '  KO ', msg); if (!ok) errors.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (cond, ms = 10_000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) return false; await sleep(100); } return true; };
const sign = (secret, body) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
const H = { 'content-type': 'application/json', 'x-requested-with': 'all-draw' };
const call = (p, method, pth, body) => p.evaluate(async ({ method, pth, body, H }) => { const r = await fetch(pth, { method, headers: H, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }; }, { method, pth, body, H });
const events = ev => hits.filter(h => h.headers['x-alldraw-event'] === ev);
const shot = async (loc, name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await loc.screenshot({ path: path.join(process.env.SHOTS, `${name}.png`) }); } };

try {
  const ctx = await browser.newContext({ locale: 'es-ES', viewport: { width: 1280, height: 860 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('alldraw:tour', 'done'); localStorage.setItem('alldraw:lang', 'es'); } catch { /* about:blank */ } });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/#/espacios`, { waitUntil: 'networkidle' });
  const stamp = Date.now();
  const reg = await call(page, 'POST', '/api/auth/register', { email: `int-${stamp}@test.local`, name: 'Integra QA', password: 'contraseña-larga' });
  check(reg.status === 201, 'cuenta creada');
  const ws = (await call(page, 'POST', '/api/workspaces', { name: 'Integraciones QA' })).body;
  const cmds = [
    { type: 'set', collection: 'views', id: 'v_proc', value: { id: 'v_proc', name: 'Proceso de cobro' } },
    { type: 'set', collection: 'elements', id: 'el_cobro', value: { id: 'el_cobro', typeId: 'freeform:box', name: 'Cobrar' } },
    { type: 'set', collection: 'nodes', id: 'n_cobro', value: { id: 'n_cobro', viewId: 'v_proc', elementId: 'el_cobro', x: 40, y: 40 } },
    { type: 'meta', patch: { currentViewId: 'v_proc' } },
  ];
  check((await call(page, 'POST', `/api/workspaces/${ws.id}/commands`, { commands: cmds })).status === 200, 'espacio con una vista y un elemento');

  // ---------------------------------------------------------------- Webhooks desde la interfaz
  console.log('webhooks');
  await page.goto(`${base}/#/s/${ws.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Compartir', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Compartir' });
  await dlg.getByRole('tab', { name: 'Webhooks' }).click();
  check(await dlg.getByRole('tab', { name: 'Webhooks' }).getAttribute('aria-selected') === 'true', 'pestaña «Webhooks» seleccionada');
  await dlg.getByLabel('URL (https://)').fill(hookUrl);
  await dlg.getByLabel('Versión guardada').check();
  await dlg.getByRole('button', { name: 'Añadir webhook' }).click();
  const secretEl = dlg.locator('.integr__secret code');
  await secretEl.waitFor({ timeout: 8000 });
  const secret = (await secretEl.textContent())?.trim() ?? '';
  check(/^whsec_/.test(secret), 'el secreto se muestra una vez al crearlo');
  hits.length = 0;
  await dlg.getByRole('button', { name: 'Probar' }).click();
  check(await until(() => events('ping').length > 0), 'el receptor recibe el ping de «Probar»');
  const ping = events('ping')[0];
  check(ping && ping.headers['x-alldraw-signature'] === sign(secret, ping.body), 'firma HMAC-SHA256 correcta (X-AllDraw-Signature)');
  check(ping && JSON.parse(ping.body).workspace?.id === ws.id, 'el cuerpo JSON lleva el espacio');
  await dlg.locator('.integr__last.is-ok').waitFor({ timeout: 8000 }).then(() => check(true, 'la interfaz muestra «Última entrega: HTTP 200 en … ms»'), () => check(false, 'la interfaz muestra la última entrega'));
  const lastTxt = await dlg.locator('.integr__last').first().textContent().catch(() => '');
  check(/HTTP 200 en \d+ ms/.test(lastTxt ?? ''), `estado y latencia visibles: «${lastTxt}»`);

  // workspace.changed agregado (debounce de 1,5 s en esta prueba; 30 s por defecto)
  hits.length = 0;
  await call(page, 'POST', `/api/workspaces/${ws.id}/commands`, { commands: [{ type: 'patch', collection: 'elements', id: 'el_cobro', patch: { name: 'Cobrar con tarjeta' } }] });
  await call(page, 'POST', `/api/workspaces/${ws.id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: 'el_aviso', value: { id: 'el_aviso', typeId: 'freeform:box', name: 'Avisar' } }] });
  check(await until(() => events('workspace.changed').length > 0, 15_000), 'workspace.changed llega agregado');
  check(events('workspace.changed').length === 1, 'un único workspace.changed para los dos cambios');
  const changed = events('workspace.changed')[0] ? JSON.parse(events('workspace.changed')[0].body) : {};
  check(changed.data?.counts?.elements?.added === 1 && changed.data?.counts?.elements?.changed === 1, `resumen: 1 añadido y 1 cambiado (${JSON.stringify(changed.data?.counts?.elements)})`);
  // Reintentos con espera exponencial ante 503
  hits.length = 0; replyStatus = 503;
  await call(page, 'POST', `/api/workspaces/${ws.id}/snapshots`, { label: 'Antes de integrar' });
  check(await until(() => events('snapshot.created').length >= 2), 'reintenta ante 503');
  replyStatus = 200;
  check(await until(() => events('snapshot.created').length >= 3), 'y entrega cuando el receptor vuelve');
  const ids = new Set(events('snapshot.created').map(h => h.headers['x-alldraw-delivery']));
  check(ids.size === 1, 'mismo X-AllDraw-Delivery en todos los intentos (se pueden descartar repetidos)');
  await sleep(500);
  await dlg.getByRole('tab', { name: 'Enlaces' }).click();
  await dlg.getByRole('tab', { name: 'Webhooks' }).click();
  await dlg.locator('.integr__log summary').first().click();
  const rows = await dlg.locator('.integr__log tbody tr').count();
  check(rows >= 3, `registro de entregas visible (${rows} filas)`);
  await shot(dlg, 'compartir-webhooks');

  // ---------------------------------------------------------------- Insertar desde la interfaz
  console.log('insertar');
  await dlg.getByRole('tab', { name: 'Insertar' }).click();
  check(await dlg.getByLabel('Vista', { exact: true }).inputValue() === 'v_proc', 'la vista actual viene elegida');
  await dlg.getByRole('button', { name: 'Crear enlace de inserción' }).click();
  const code = dlg.getByLabel('Código para insertar (iframe)');
  await code.waitFor({ timeout: 8000 });
  await dlg.getByLabel('Tema', { exact: true }).selectOption('dark');
  await dlg.getByLabel('Tamaño', { exact: true }).selectOption('l');
  const iframeCode = await code.inputValue();
  check(/<iframe src="http:\/\/127\.0\.0\.1:\d+\/embed\/[^/]+\/v_proc\?token=emb_[^"&]+&amp;theme=dark" width="1000" height="700"/.test(iframeCode), 'código <iframe> con la vista, el token, el tema y el tamaño');
  const imgUrl = await dlg.getByLabel('Imagen SVG (GitHub, Markdown, <img>)').inputValue();
  check(/\/embed\/[^/]+\/v_proc\.svg\?token=emb_/.test(imgUrl), 'URL de la imagen SVG');
  await shot(dlg, 'compartir-insertar');
  const embedUrl = iframeCode.match(/src="([^"]+)"/)[1].replace(/&amp;/g, '&');
  const token = new URL(embedUrl).searchParams.get('token');

  // Cabeceras: /embed se deja incrustar, el resto no
  const er = await fetch(embedUrl);
  check(er.status === 200 && /frame-ancestors \*/.test(er.headers.get('content-security-policy') ?? '') && !er.headers.get('x-frame-options'), '/embed: frame-ancestors * y sin X-Frame-Options');
  const ar = await fetch(`${base}/`);
  check(ar.headers.get('x-frame-options') === 'SAMEORIGIN', 'la app sigue sin dejarse incrustar');
  const sv = await fetch(imgUrl);
  check(sv.status === 200 && (sv.headers.get('content-type') ?? '').includes('image/svg+xml'), 'la imagen SVG se sirve');
  check((await fetch(`${base}/api/workspaces/${ws.id}/snapshot`, { headers: { authorization: `Bearer ${token}` } })).status === 401, 'el token de inserción no vale para la API');

  // Incrustado desde otro origen (el receptor), con sondeo de 5 s para ver la actualización
  hostHtml = `<!doctype html><title>Otra web</title><h1>Wiki</h1><iframe id="f" src="${embedUrl}&poll=5" width="900" height="600"></iframe>`;
  const host = await ctx.newPage();
  host.on('pageerror', e => errors.push(`pageerror (host): ${e.message}`));
  await host.goto(`http://127.0.0.1:${rport}/host.html`, { waitUntil: 'load' });
  const frame = host.frameLocator('#f');
  await frame.locator('svg.ad-svg').waitFor({ timeout: 10_000 }).then(() => check(true, 'el diagrama se ve incrustado en otra web'), () => check(false, 'el diagrama se ve incrustado en otra web'));
  check(await frame.locator('svg.ad-svg[data-theme="dark"]').count() === 1, 'con el tema oscuro pedido');
  check(await frame.getByRole('link', { name: /Abrir en all-draw/ }).getAttribute('href') === `http://127.0.0.1:${port}/#/s/${ws.id}/v/v_proc`, '«Abrir en all-draw» lleva a la vista (sin el token de inserción)');
  const f = host.frames().find(x => x.url().includes('/embed/'));
  const s0 = await f.evaluate(() => window.__alldrawEmbed.state().s);
  await frame.getByRole('button', { name: 'Acercar' }).click();
  await sleep(300);
  const s1 = await f.evaluate(() => window.__alldrawEmbed.state().s);
  await shot(host.locator('body'), 'insertado-en-otra-web');
  check(s1 > s0, `zoom con el botón (${s0.toFixed(2)} → ${s1.toFixed(2)})`);
  await call(page, 'POST', `/api/workspaces/${ws.id}/commands`, { commands: [{ type: 'patch', collection: 'elements', id: 'el_cobro', patch: { name: 'Cobrar al momento' } }] });
  check(await until(async () => (await frame.locator('svg.ad-svg').textContent().catch(() => '')).includes('Cobrar al momento'), 12_000), 'se actualiza sola al cambiar el diagrama (sondeo)');

  // oEmbed
  const pageHtml = await (await fetch(embedUrl)).text();
  const oembedHref = pageHtml.match(/<link rel="alternate" type="application\/json\+oembed" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
  check(!!oembedHref, 'la página anuncia oEmbed (<link rel="alternate">)');
  const oe = oembedHref ? await (await fetch(oembedHref)).json() : {};
  check(oe.type === 'rich' && /<iframe src="http:\/\/127\.0\.0\.1:\d+\/embed\//.test(oe.html ?? ''), 'oEmbed devuelve un <iframe>');

  // Revocar desde la interfaz
  await dlg.getByRole('button', { name: /Revocar el enlace de inserción de/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revocar' }).click();
  check(await until(async () => (await fetch(imgUrl)).status === 401), 'revocado: la imagen deja de servirse');
  await f.evaluate(() => window.__alldrawEmbed.poll());
  check(await until(async () => await frame.locator('#msg').isVisible().catch(() => false)), 'la página incrustada avisa de que ya no está disponible');
  await host.close();

  // Borrar el webhook
  await dlg.getByRole('tab', { name: 'Webhooks' }).click();
  await dlg.getByRole('button', { name: /^Borrar el webhook/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Borrar' }).click();
  check(await until(async () => (await call(page, 'GET', `/api/workspaces/${ws.id}/webhooks`)).body.webhooks.length === 0), 'webhook borrado desde la interfaz');
  await dlg.getByRole('button', { name: 'Cerrar' }).last().click();

  // ---------------------------------------------------------------- MCP remoto
  console.log('MCP remoto');
  const key = (await call(page, 'POST', '/api/keys', { name: 'mcp e2e' })).body.key;
  const rpc = async (method, params, id = 1, auth = `Bearer ${key}`) => {
    const r = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: auth }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
  check(init.status === 200 && init.body?.result?.serverInfo?.name === 'all-draw', 'initialize');
  const tools = await rpc('tools/list', {}, 2);
  const names = (tools.body?.result?.tools ?? []).map(t => t.name);
  check(['list_workspaces', 'get_snapshot', 'list_views', 'run_commands', 'validate', 'list_notations', 'render_svg'].every(n => names.includes(n)), `herramientas: ${names.join(', ')}`);
  const lv = await rpc('tools/call', { name: 'list_views', arguments: { workspaceId: ws.id } }, 3);
  check(JSON.parse(lv.body?.result?.content?.[0]?.text ?? '{}').views?.[0]?.name === 'Proceso de cobro', 'list_views devuelve la vista');
  const rc = await rpc('tools/call', { name: 'run_commands', arguments: { workspaceId: ws.id, commands: [{ type: 'patch', collection: 'elements', id: 'el_aviso', patch: { name: 'Avisar por MCP' } }] } }, 4);
  check(!rc.body?.result?.isError, 'run_commands por MCP');
  const rr = await rpc('resources/read', { uri: `alldraw://workspaces/${ws.id}/snapshot` }, 5);
  check(JSON.parse(rr.body?.result?.contents?.[0]?.text ?? '{}').elements?.el_aviso?.name === 'Avisar por MCP', 'resources/read del snapshot ve el cambio');
  check((await rpc('tools/list', {}, 6, 'Bearer adk_falsa')).status === 401, 'sin una API key válida: 401');
  await ctx.close();
} catch (e) {
  errors.push(`excepción: ${e?.stack ?? e}`);
  console.error(e);
} finally {
  await browser.close();
  await new Promise(r => { child.once('exit', r); child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000); });
  receiver.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
const serverErrors = lines.filter(l => l.level === 'error');
for (const l of serverErrors) errors.push(`log del servidor: ${l.msg} ${JSON.stringify(l.err ?? '')}`);
if (errors.length) { console.error(`\n${errors.length} fallo(s):\n- ${errors.join('\n- ')}`); process.exit(1); }
console.log('\nintegraciones: todo bien');
