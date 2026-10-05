// Servidor temporal propio para las pruebas que generan imágenes (regresión visual, capturas del manual): puerto alto
// libre, `DATA_DIR` nuevo en /tmp (sin cuentas ni espacios reales) y la web ya construida en `STATIC_DIR`.
//
//   const srv = await startServer({ staticDir: '/tmp/alldraw-dist' });   // srv.base = 'http://127.0.0.1:<puerto>'
//   …
//   await srv.stop();                                                      // para el servidor y borra el DATA_DIR
//
// Si la variable `BASE` está definida no arranca nada y usa esa dirección (servidor lanzado a mano).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const freePort = () => new Promise((ok, ko) => {
  const s = createServer();
  s.unref();
  s.on('error', ko);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

/**
 * @param {{ staticDir?: string, port?: number, quiet?: boolean }} [opts]
 * @returns {Promise<{ base: string, stop: () => Promise<void> }>}
 */
export async function startServer(opts = {}) {
  if (process.env.BASE) return { base: process.env.BASE.replace(/\/$/, ''), stop: async () => {} };
  const staticDir = resolve(opts.staticDir ?? process.env.STATIC_DIR ?? join(root, 'apps/web/dist'));
  if (!existsSync(join(staticDir, 'index.html'))) {
    throw new Error(`No hay build de la web en ${staticDir}. Constrúyela con: pnpm --filter web build --outDir /tmp/alldraw-dist --emptyOutDir  (y STATIC_DIR=/tmp/alldraw-dist)`);
  }
  const port = opts.port || Number(process.env.PORT || 0) || await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'alldraw-e2e-data-'));
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: join(root, 'apps/server'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, STATIC_DIR: staticDir, LOG_LEVEL: 'warn', REGISTER_MIN_MS: '0', NODE_NO_WARNINGS: '1' },
    stdio: ['ignore', opts.quiet === false ? 'inherit' : 'ignore', 'inherit'],
  });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20000;
  for (;;) {
    if (exited) { rmSync(dataDir, { recursive: true, force: true }); throw new Error(`El servidor temporal terminó al arrancar (puerto ${port})`); }
    const ok = await fetch(base + '/').then(r => r.ok, () => false);
    if (ok) break;
    if (Date.now() > deadline) { child.kill(); rmSync(dataDir, { recursive: true, force: true }); throw new Error(`El servidor temporal no responde en ${base}`); }
    await new Promise(r => setTimeout(r, 200));
  }
  const stop = async () => {
    if (!exited) { child.kill('SIGTERM'); await new Promise(r => { child.once('exit', r); setTimeout(r, 3000); }); }
    rmSync(dataDir, { recursive: true, force: true });
  };
  process.once('exit', () => { if (!exited) child.kill('SIGKILL'); });
  return { base, stop };
}
