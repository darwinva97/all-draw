/**
 * IP real del cliente detrás de proxies de confianza (`TRUSTED_PROXIES`), sin nada de Node.
 *
 * Sólo se cree a un salto si quien lo dice es de confianza: se parte de la IP del socket y, mientras esa IP sea un
 * proxy de confianza, se retrocede un salto en `X-Forwarded-For` (de derecha a izquierda; cada proxy añade al final
 * la IP que vio). Si el salto es un nodo de Cloudflare (y `cloudflare` está en la lista) y la petición trae
 * `CF-Connecting-IP`, esa es la IP del cliente. El primer salto que no es de confianza es el cliente.
 *
 * Así una cabecera `X-Forwarded-For` inventada no sirve de nada: o la pisa Caddy (que por defecto reemplaza la del
 * cliente por la IP que ve) o queda a la izquierda de un salto que no es de confianza.
 *
 * Formato de `TRUSTED_PROXIES`: lista separada por comas de IPs, redes CIDR (`10.0.0.0/8`, `fd00::/8`) y las palabras
 * `loopback` (127.0.0.0/8 y ::1), `private` (redes privadas) y `cloudflare` (redes publicadas por Cloudflare).
 * Sin definir: `loopback,cloudflare` (Caddy en la misma máquina y Cloudflare delante). Vacía: no se confía en nadie y
 * vale la IP del socket.
 */

/** https://www.cloudflare.com/ips-v4/ y /ips-v6/ (octubre de 2026). */
export const CLOUDFLARE_IPV4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'];
export const CLOUDFLARE_IPV6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'];
export const DEFAULT_TRUSTED_PROXIES = 'loopback,cloudflare';
const LOOPBACK = ['127.0.0.0/8', '::1/128'];
const PRIVATE = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'];

interface Ip { v: 4 | 6; n: bigint }
interface Cidr { v: 4 | 6; net: bigint; mask: bigint }

function parseV4(s: string): bigint | null {
  const p = s.split('.');
  if (p.length !== 4) return null;
  let n = 0n;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || Number(x) > 255) return null;
    n = (n << 8n) | BigInt(Number(x));
  }
  return n;
}
function parseV6(s: string): bigint | null {
  if (!/^[0-9a-f:.]+$/i.test(s)) return null;
  let tail: bigint[] = [];
  // IPv4 incrustada al final (`::ffff:1.2.3.4`)
  const lastColon = s.lastIndexOf(':');
  if (s.includes('.')) {
    const v4 = parseV4(s.slice(lastColon + 1));
    if (v4 === null) return null;
    tail = [v4 >> 16n, v4 & 0xffffn];
    s = s.slice(0, lastColon + 1); // `::ffff:` → `::ffff`; `::` se queda
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const words = (h: string) => (h === '' ? [] : h.split(':'));
  const head = words(halves[0]!), rest = halves.length === 2 ? words(halves[1]!) : [];
  const groups = [...head, ...rest];
  if (groups.some(g => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  const total = groups.length + tail.length;
  if (halves.length === 1 ? total !== 8 : total > 7) return null;
  const all = [...head.map(g => BigInt(parseInt(g, 16))), ...Array<bigint>(8 - total).fill(0n), ...rest.map(g => BigInt(parseInt(g, 16))), ...tail];
  return all.reduce((n, g) => (n << 16n) | g, 0n);
}
const MAPPED_V4 = 0xffffn << 32n;
/** IP (v4, v6 o v4 mapeada en v6, que se trata como v4); `null` si no es una IP. */
export function parseIp(raw: string | null | undefined): Ip | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('[')) s = s.slice(1, s.indexOf(']') > 0 ? s.indexOf(']') : undefined); // [::1]:puerto
  const zone = s.indexOf('%'); if (zone > 0) s = s.slice(0, zone);
  if (s.includes(':')) {
    const n = parseV6(s);
    if (n === null) return null;
    return n >> 32n === 0xffffn ? { v: 4, n: n - MAPPED_V4 } : { v: 6, n };
  }
  const n = parseV4(s.replace(/:\d+$/, ''));
  return n === null ? null : { v: 4, n };
}
function parseCidr(s: string): Cidr | null {
  const [addr, len] = s.split('/');
  const ip = parseIp(addr);
  if (!ip) return null;
  const bits = ip.v === 4 ? 32 : 128;
  const l = len === undefined ? bits : Number(len);
  if (!Number.isInteger(l) || l < 0 || l > bits) return null;
  const mask = l === 0 ? 0n : ((1n << BigInt(l)) - 1n) << BigInt(bits - l);
  return { v: ip.v, net: ip.n & mask, mask };
}
const inList = (ip: Ip, list: Cidr[]) => list.some(c => c.v === ip.v && (ip.n & c.mask) === c.net);

export interface TrustedProxies {
  /** ¿Es un proxy de confianza (incluidos los de Cloudflare si están en la lista)? */
  trusts(ip: string): boolean;
  /** ¿Es un nodo de Cloudflare y se confía en Cloudflare? */
  isCloudflare(ip: string): boolean;
  /** Lo que se configuró, para el log de arranque. */
  readonly spec: string;
}

/** Interpreta `TRUSTED_PROXIES` (ver arriba). Lanza si hay una entrada que no se entiende (mejor no arrancar que confiar mal). */
export function parseTrustedProxies(spec: string | undefined | null): TrustedProxies {
  const s = spec ?? DEFAULT_TRUSTED_PROXIES;
  const trusted: Cidr[] = [], cf: Cidr[] = [];
  for (const raw of s.split(',').map(x => x.trim()).filter(Boolean)) {
    const word = raw.toLowerCase();
    const add = (xs: string[], to: Cidr[]) => { for (const x of xs) to.push(parseCidr(x)!); };
    if (word === 'loopback') add(LOOPBACK, trusted);
    else if (word === 'private') add(PRIVATE, trusted);
    else if (word === 'cloudflare') add([...CLOUDFLARE_IPV4, ...CLOUDFLARE_IPV6], cf);
    else {
      const c = parseCidr(raw);
      if (!c) throw new Error(`TRUSTED_PROXIES: «${raw}» no es una IP, una red CIDR ni loopback/private/cloudflare`);
      trusted.push(c);
    }
  }
  return {
    spec: s,
    trusts: ip => { const p = parseIp(ip); return !!p && (inList(p, trusted) || inList(p, cf)); },
    isCloudflare: ip => { const p = parseIp(ip); return !!p && inList(p, cf); },
  };
}

/** Normaliza una IP para mostrarla y usarla de clave (sin `::ffff:` ni corchetes); deja el texto tal cual si no es IP. */
export function normalizeIp(raw: string): string {
  const p = parseIp(raw);
  if (!p) return raw.trim();
  if (p.v === 4) return [24n, 16n, 8n, 0n].map(sh => String((p.n >> sh) & 0xffn)).join('.');
  const g = Array.from({ length: 8 }, (_, i) => ((p.n >> BigInt((7 - i) * 16)) & 0xffffn).toString(16));
  return g.join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/:{3,}/, '::');
}

/**
 * IP del cliente: `remote` es la del socket; `forwardedFor` la cabecera `X-Forwarded-For` y `cfConnectingIp` la de
 * Cloudflare (sólo se usa si el salto que la trae es de Cloudflare).
 */
export function resolveClientIp(trust: TrustedProxies, remote: string | null | undefined, forwardedFor?: string | null, cfConnectingIp?: string | null): string {
  const hops = (forwardedFor ?? '').split(',').map(x => x.trim()).filter(Boolean);
  let ip = (remote ?? '').trim();
  if (!ip) return 'unknown';
  for (;;) {
    if (cfConnectingIp && trust.isCloudflare(ip) && parseIp(cfConnectingIp)) return normalizeIp(cfConnectingIp);
    if (!trust.trusts(ip) || hops.length === 0) return normalizeIp(ip);
    const prev = hops.pop()!;
    if (!parseIp(prev)) return normalizeIp(ip); // basura en la cabecera: nos quedamos con el último salto fiable
    ip = prev;
  }
}
