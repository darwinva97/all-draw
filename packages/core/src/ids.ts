import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gen = customAlphabet(alphabet, 12);

/** Id nuevo, estable y corto. El prefijo sirve para leer los ficheros a ojo: `el_…`, `vn_…`. */
export function newId(prefix = ''): string {
  return prefix ? `${prefix}_${gen()}` : gen();
}

/** Id determinista a partir de un texto (para semillas y generadores: mismo texto → mismo id). */
export function slugId(prefix: string, text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return prefix ? `${prefix}:${slug}` : slug;
}
