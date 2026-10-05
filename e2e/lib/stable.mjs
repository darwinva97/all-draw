// Utilidades para capturas reproducibles con el chromium del sistema: fuentes fijas, sin animaciones ni cursores, y
// capturas que esperan a que la página deje de cambiar. Las usan `visual.mjs` y `manual-shots.mjs`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * La app pinta con `system-ui` / `sans-serif` (y `ui-monospace` en el código), así que la fuente depende de la máquina.
 * Para que las capturas no cambien según lo instalado, chromium arranca con una configuración de fontconfig propia que
 * solo ve DejaVu (paquetes `fonts-dejavu-core` y `fonts-dejavu-mono` en Debian/Ubuntu, la que ya sale en este
 * servidor para `system-ui`) y a la que apuntan todos los alias genéricos. Sin antialiasing subpíxel ni hinting fuerte.
 */
export const FONT_DIR = process.env.FONT_DIR ?? '/usr/share/fonts/truetype/dejavu';

export function fontconfigEnv() {
  if (!existsSync(join(FONT_DIR, 'DejaVuSans.ttf'))) {
    throw new Error(`Falta DejaVu en ${FONT_DIR}: instala fonts-dejavu-core y fonts-dejavu-mono (apt) o indica FONT_DIR.`);
  }
  const dir = join(tmpdir(), 'alldraw-e2e-fontconfig');
  mkdirSync(join(dir, 'cache'), { recursive: true });
  const alias = (family, to) => `  <alias binding="strong"><family>${family}</family><prefer><family>${to}</family></prefer></alias>`;
  const sans = ['system-ui', 'sans-serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', 'Inter'];
  const mono = ['monospace', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Courier New'];
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${join(dir, 'cache')}</cachedir>
${sans.map(f => alias(f, 'DejaVu Sans')).join('\n')}
${mono.map(f => alias(f, 'DejaVu Sans Mono')).join('\n')}
${alias('serif', 'DejaVu Serif')}
  <match target="font">
    <edit name="antialias" mode="assign"><bool>true</bool></edit>
    <edit name="hinting" mode="assign"><bool>true</bool></edit>
    <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
    <edit name="rgba" mode="assign"><const>none</const></edit>
    <edit name="embeddedbitmap" mode="assign"><bool>false</bool></edit>
  </match>
</fontconfig>
`;
  const file = join(dir, 'fonts.conf');
  writeFileSync(file, conf);
  return { FONTCONFIG_FILE: file };
}

/** Argumentos de chromium que quitan fuentes de variación entre ejecuciones. */
export const STABLE_ARGS = [
  '--no-sandbox',
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--disable-font-subpixel-positioning',
  '--force-color-profile=srgb',
  '--disable-gpu',
  '--hide-scrollbars',
];

/** Sin animaciones, transiciones ni cursor de texto. */
export const NO_MOTION_CSS = `
*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; scroll-behavior: auto !important; }
`;
/** Sin avisos flotantes, indicador de conexión, banda de respaldo, recorrido guiado ni presencia de otras personas. */
export const NO_OVERLAYS_CSS = `
.ad-toasts, .ad-offline, .ad-standby, .tour, .ad-peer-cursor, .ad-presence { display: none !important; }
`;
export const STABLE_CSS = NO_MOTION_CSS + NO_OVERLAYS_CSS;

/** Script de inicio de página (`addInitScript(injectStableCss, STABLE_CSS)`): inyecta el CSS en cuanto existe el documento. */
export function injectStableCss(css) {
  const add = () => { const s = document.createElement('style'); s.dataset.e2e = 'stable'; s.textContent = css; (document.head ?? document.documentElement).appendChild(s); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
}

/**
 * Script de inicio de página (`addInitScript(seedRandom, semilla)`): `crypto.getRandomValues`, `crypto.randomUUID` y
 * `Math.random` con un generador determinista. Las plantillas crean ids nuevos (nanoid) en cada uso, y algunas cosas
 * dependen de su orden (la colocación de etiquetas de aristas da prioridad a la de id menor): con ids aleatorios, la
 * máquina de estados salía con las etiquetas en una u otra posición según la ejecución.
 */
export function seedRandom(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = next;
  const c = globalThis.crypto;
  if (!c) return;
  c.getRandomValues = (arr) => {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(next() * 256);
    return arr;
  };
  c.randomUUID = () => {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

/**
 * Captura `target` (página o localizador) cuando dos capturas seguidas salen idénticas: fuentes cargadas, sin
 * cambios de layout ni pintados pendientes. Devuelve el PNG.
 */
export async function stableShot(page, target = page, { tries = 25, interval = 120, ...opts } = {}) {
  await page.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
  let prev = null;
  for (let i = 0; i < tries; i++) {
    const buf = await target.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css', ...opts });
    if (prev && buf.equals(prev)) return buf;
    prev = buf;
    await page.waitForTimeout(interval);
  }
  throw new Error(`la captura no se estabiliza tras ${tries} intentos`);
}
