// Capturas del manual de usuario (1440×900) en español y en inglés, contra un servidor completo con cuentas.
//
//   docs/manual/img/NN-nombre.png      interfaz en español (las usa docs/manual/**/*.md)
//   docs/manual/img/NN-nombre-en.png   interfaz en inglés  (las usa docs/manual/en/**/*.md)
//
// Sin datos reales: arranca su propio servidor en un puerto alto libre con un DATA_DIR nuevo en /tmp (e2e/lib/server.mjs)
// y registra cuentas de ejemplo (ana@ejemplo.com / ana@example.com). Hace falta un build de la web:
//
//   pnpm --filter web build --outDir /tmp/alldraw-dist --emptyOutDir
//   STATIC_DIR=/tmp/alldraw-dist node e2e/manual-shots.mjs          # LANGS=es o LANGS=en para uno solo
//   node apps/web/scripts/copy-docs-img.mjs                          # para verlas con `pnpm dev` (el build ya lo hace)
//
// Con BASE=http://127.0.0.1:<puerto> usa un servidor ya lanzado (con un DATA_DIR vacío: las cuentas se registran).
// Fuentes fijas (DejaVu) y sin animaciones ni avisos flotantes, como la regresión visual (e2e/lib/stable.mjs).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { startServer } from './lib/server.mjs';
import { NO_MOTION_CSS, NO_OVERLAYS_CSS, STABLE_ARGS, fontconfigEnv, injectStableCss } from './lib/stable.mjs';

const out = new URL('../docs/manual/img/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const LANGS = (process.env.LANGS ?? 'es,en').split(',').map(s => s.trim()).filter(Boolean);

/** Textos de la interfaz y del espacio de ejemplo que usa el recorrido, por idioma (deben coincidir con @all-draw/i18n). */
const L = {
  es: {
    locale: 'es-ES', suffix: '',
    email: 'ana@ejemplo.com', name: 'Ana', password: 'contraseña-larga',
    signIn: /^Entrar( \/ registrarse)?$/, noAccount: 'No tengo cuenta', register: 'Registrarme', openDemo: /^Abrir la demo/,
    process: 'Alta de cliente', task: 'Verificar identidad', statesView: 'Alta de cliente · Estados', gridView: 'Mapa capas',
    service: 'clientes-api', pins: /Pines/, workspace: 'Espacio', rules: 'Reglas',
    share: 'Compartir', newEdit: 'Nuevo enlace de edición', newRead: 'Nuevo enlace de lectura', readLink: 'lectura',
    importExport: /Importar \/ Exportar/, create: 'Crear',
  },
  en: {
    locale: 'en-US', suffix: '-en',
    email: 'ana@example.com', name: 'Ana', password: 'a-long-password',
    signIn: /^Sign in( \/ register)?$/, noAccount: 'I don\'t have an account', register: 'Register', openDemo: /^Open the demo/,
    process: 'Customer onboarding', task: 'Verify identity', statesView: 'Customer onboarding · States', gridView: 'Layers × stages',
    service: 'customers-api', pins: /Pins/, workspace: 'Workspace', rules: 'Rules',
    share: 'Share', newEdit: 'New edit link', newRead: 'New read-only link', readLink: 'read-only',
    importExport: /Import \/ Export/, create: 'Create',
  },
};

const srv = await startServer();
const base = srv.base;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium', args: STABLE_ARGS, env: { ...process.env, ...fontconfigEnv() } });

for (const lang of LANGS) {
  const s = L[lang];
  if (!s) throw new Error(`Idioma desconocido: ${lang}`);
  console.log(`== ${lang}`);
  const ctx = await browser.newContext({ locale: s.locale, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.addInitScript((lang) => {
    localStorage.setItem('alldraw:tour', 'done'); // sin recorrido guiado
    localStorage.setItem('alldraw:lang', lang);
  }, lang);
  await ctx.addInitScript(injectStableCss, NO_MOTION_CSS + NO_OVERLAYS_CSS);
  const page = await ctx.newPage();
  const shot = async (n) => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${out}/${n}${s.suffix}.png`, animations: 'disabled', caret: 'hide' }); console.log(`  ${n}${s.suffix}.png`); };
  const wait = (ms) => page.waitForTimeout(ms);

  await page.goto(base + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: s.signIn }).first().waitFor();
  await wait(300);
  await shot('01-inicio');
  await page.getByRole('button', { name: s.signIn }).first().click();
  await page.getByRole('button', { name: s.noAccount }).click();
  await page.locator('input[type=email]').fill(s.email);
  await page.locator('.field input:not([type=email]):not([type=password])').fill(s.name);
  await page.locator('input[type=password]').fill(s.password);
  await wait(200);
  await shot('02-entrar');
  await page.getByRole('button', { name: s.register, exact: true }).click();
  await page.waitForSelector('#h-remote', { timeout: 20000 });
  await page.getByRole('button', { name: s.openDemo }).first().click();
  await page.waitForURL(/#\/s\//, { waitUntil: 'commit' });
  await page.waitForSelector('.react-flow__node', { timeout: 20000 }); await wait(1500);
  await shot('03-editor-archimate');
  await page.locator('.react-flow__node', { hasText: s.process }).first().dblclick(); await wait(900);
  await shot('04-bpmn-detalle');
  await page.locator('.react-flow__node', { hasText: s.task }).first().click({ button: 'right' });
  await page.waitForSelector('.ad-menu'); await wait(300);
  await shot('05-menu-dimension');
  await page.keyboard.press('Escape');
  await page.locator('.ad-views__item', { hasText: s.statesView }).first().click(); await wait(800);
  await shot('06-estados');
  await page.locator('.ad-views__item', { hasText: s.gridView }).first().click(); await wait(900);
  await page.locator('.react-flow__node', { hasText: s.service }).first().click(); await wait(300);
  await page.getByRole('tab', { name: s.pins }).click(); await wait(400);
  await shot('07-rejilla-pines');
  await page.locator('.ad-problems__bar').click(); await wait(400);
  await shot('08-problemas');
  await page.locator('.ad-problems__bar').click(); await wait(200);
  await page.getByRole('button', { name: s.workspace, exact: true }).click(); await wait(500);
  await page.locator('.ad-ws-tabs button', { hasText: s.rules }).click(); await wait(400);
  await shot('09-espacio-reglas');
  await page.keyboard.press('Escape'); await wait(300);
  await page.getByRole('button', { name: s.share, exact: true }).click();
  await page.getByRole('button', { name: s.newEdit }).click();
  await page.getByRole('button', { name: s.newRead }).click();
  await page.waitForSelector(`text=${s.readLink}`, { timeout: 10000 }); await wait(500);
  await shot('10-compartir');
  await page.keyboard.press('Escape'); await wait(300);
  await page.getByRole('button', { name: s.importExport }).click();
  await page.waitForSelector('[role="menu"]'); await wait(300);
  await shot('11-importar-exportar');
  await page.keyboard.press('Escape');
  await page.goto(base + '/#/keys', { waitUntil: 'networkidle' });
  await page.locator('#key-name').fill('agente-claude');
  await page.getByRole('button', { name: s.create, exact: true }).click(); await wait(800);
  await shot('12-claves-api');
  await ctx.close();
}

await browser.close();
await srv.stop();
console.log('ok');
