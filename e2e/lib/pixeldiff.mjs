// Comparación de PNG píxel a píxel (sin dependencias de comparación: solo `pngjs` para decodificar y codificar).
//
// Un píxel cuenta como distinto si alguno de sus canales (R, G, B, A) difiere en más de `pixelThreshold` (0–255).
// La imagen de diferencias muestra la referencia apagada en gris y los píxeles distintos en rojo; si los tamaños no
// coinciden, la zona que solo existe en una de las dos sale en magenta (y todos esos píxeles cuentan como distintos).
import { PNG } from 'pngjs';

/**
 * @param {Buffer} expectedPng
 * @param {Buffer} actualPng
 * @param {{ pixelThreshold?: number }} [opts]
 * @returns {{ width: number, height: number, sameSize: boolean, expectedSize: string, actualSize: string,
 *             diffPixels: number, total: number, ratio: number, maxDelta: number, diffPng: Buffer }}
 */
export function comparePng(expectedPng, actualPng, { pixelThreshold = 0 } = {}) {
  const a = PNG.sync.read(expectedPng);
  const b = PNG.sync.read(actualPng);
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height);
  const out = new PNG({ width, height });
  let diffPixels = 0, maxDelta = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const inA = x < a.width && y < a.height, inB = x < b.width && y < b.height;
      if (!inA || !inB) {
        diffPixels++; maxDelta = 255;
        out.data[o] = 255; out.data[o + 1] = 0; out.data[o + 2] = 255; out.data[o + 3] = 255;
        continue;
      }
      const ia = (y * a.width + x) * 4, ib = (y * b.width + x) * 4;
      const d = Math.max(
        Math.abs(a.data[ia] - b.data[ib]), Math.abs(a.data[ia + 1] - b.data[ib + 1]),
        Math.abs(a.data[ia + 2] - b.data[ib + 2]), Math.abs(a.data[ia + 3] - b.data[ib + 3]));
      if (d > maxDelta) maxDelta = d;
      if (d > pixelThreshold) {
        diffPixels++;
        out.data[o] = 255; out.data[o + 1] = 0; out.data[o + 2] = 0; out.data[o + 3] = 255;
      } else {
        // Referencia en gris, aclarada, para situar las diferencias.
        const alpha = a.data[ia + 3] / 255;
        const lum = (0.299 * a.data[ia] + 0.587 * a.data[ia + 1] + 0.114 * a.data[ia + 2]) * alpha + 255 * (1 - alpha);
        const v = Math.round(255 - (255 - lum) * 0.25);
        out.data[o] = v; out.data[o + 1] = v; out.data[o + 2] = v; out.data[o + 3] = 255;
      }
    }
  }
  const total = width * height;
  return {
    width, height,
    sameSize: a.width === b.width && a.height === b.height,
    expectedSize: `${a.width}×${a.height}`, actualSize: `${b.width}×${b.height}`,
    diffPixels, total, ratio: total ? diffPixels / total : 0, maxDelta,
    diffPng: PNG.sync.write(out),
  };
}
