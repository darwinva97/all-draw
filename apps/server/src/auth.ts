/**
 * Identidad: la lógica vive en `@all-draw/server-core` (WebCrypto, PBKDF2). Aquí sólo se registra
 * el verificador de los hashes heredados `scrypt$<sal>$<hash>` (creados por versiones anteriores
 * con `node:crypto`); la API los re-hashea a PBKDF2 en el primer login correcto.
 */
import { scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { registerPasswordScheme } from '@all-draw/server-core';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function verifyScrypt(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 32, SCRYPT);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
registerPasswordScheme('scrypt', verifyScrypt);

export * from '@all-draw/server-core';
