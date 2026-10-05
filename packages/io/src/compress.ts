/**
 * Compresión detrás de una sola puerta: draw.io (deflate «raw» + base64), Visio (ZIP) y los flujos del PDF (zlib).
 * Usa `fflate` (≈ 8 kB, sin dependencias, mismo código en Node y en el navegador, síncrono), así los importadores
 * siguen siendo funciones normales y no hace falta `DecompressionStream` ni `node:zlib`.
 */
import { inflateSync, unzipSync, zlibSync, strFromU8, strToU8 } from 'fflate';

/** Base64 → bytes (sin `Buffer` ni `atob`, para que valga igual en Node y en el navegador). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = new Int16Array(128).fill(-1);
  for (let i = 0; i < A.length; i++) map[A.charCodeAt(i)] = i;
  const s = clean.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let buf = 0, bits = 0, o = 0;
  for (let i = 0; i < s.length; i++) {
    const v = map[s.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error('base64 no válido');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += A[(n >> 18) & 63]! + A[(n >> 12) & 63]! + (b === undefined ? '=' : A[(n >> 6) & 63]!) + (c === undefined ? '=' : A[n & 63]!);
  }
  return out;
}

/** Deflate «raw» (sin cabecera zlib), como lo escribe draw.io (`pako.deflateRaw`). */
export const inflateRaw = (bytes: Uint8Array): Uint8Array => inflateSync(bytes);
/** Deflate con cabecera zlib (`/FlateDecode` del PDF). */
export const deflateZlib = (bytes: Uint8Array): Uint8Array => zlibSync(bytes, { level: 6 });
/** Ficheros de un ZIP (`.vsdx`): ruta → bytes. */
export const unzip = (bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(bytes);
export const utf8 = (bytes: Uint8Array): string => strFromU8(bytes);
export const toUtf8Bytes = (s: string): Uint8Array => strToU8(s);
