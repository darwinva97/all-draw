#!/usr/bin/env node
/**
 * Copia las imágenes del manual (`docs/manual/img/**`) a `apps/web/public/docs-img/`, de donde las sirve la app
 * (`/docs-img/…`) tanto en desarrollo como en producción. Se ejecuta en `prebuild`; tras añadir imágenes al manual,
 * lánzalo a mano para verlas con `pnpm dev`: `node apps/web/scripts/copy-docs-img.mjs`.
 * Sincroniza: borra de destino lo que ya no existe en origen.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../../docs/manual/img');
const DST = resolve(here, '../public/docs-img');
const OK = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (OK.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const wanted = new Set(files.map(f => relative(SRC, f)));
mkdirSync(DST, { recursive: true });
let removed = 0;
for (const f of walk(DST)) if (!wanted.has(relative(DST, f))) { rmSync(f); removed++; }
let copied = 0;
for (const f of files) {
  const to = join(DST, relative(SRC, f));
  if (existsSync(to) && statSync(to).size === statSync(f).size && statSync(to).mtimeMs >= statSync(f).mtimeMs) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(f, to, { preserveTimestamps: true });
  copied++;
}
console.log(`docs-img: ${files.length} imágenes (${copied} copiadas, ${removed} borradas) → ${relative(process.cwd(), DST) || DST}`);
