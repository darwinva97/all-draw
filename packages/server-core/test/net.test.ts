/** IP real del cliente detrás de proxies de confianza (`TRUSTED_PROXIES`). */
import { describe, expect, it } from 'vitest';
import { normalizeIp, parseIp, parseTrustedProxies, resolveClientIp } from '../src/net';

describe('parseIp / normalizeIp', () => {
  it('v4, v6, v4 mapeada, con puerto o zona', () => {
    expect(parseIp('203.0.113.7')).toEqual({ v: 4, n: 0xcb007107n });
    expect(parseIp('::ffff:127.0.0.1')).toEqual({ v: 4, n: 0x7f000001n });
    expect(parseIp('::1')).toEqual({ v: 6, n: 1n });
    expect(parseIp('2606:4700::6810:84e5')?.v).toBe(6);
    expect(parseIp('[2001:db8::1]:443')?.v).toBe(6);
    expect(parseIp('fe80::1%eth0')?.v).toBe(6);
    for (const bad of ['', 'x', '1.2.3', '1.2.3.256', '1::2::3', 'unknown', '1:2:3:4:5:6:7:8:9']) expect(parseIp(bad)).toBeNull();
    expect(normalizeIp('::ffff:198.51.100.4')).toBe('198.51.100.4');
    expect(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
  });
});

describe('resolveClientIp', () => {
  const def = parseTrustedProxies(undefined); // loopback,cloudflare
  it('por defecto: Caddy local + Cloudflare → CF-Connecting-IP', () => {
    // Caddy reemplaza X-Forwarded-For con la IP que ve (el nodo de Cloudflare)
    expect(resolveClientIp(def, '127.0.0.1', '172.70.1.2', '198.51.100.9')).toBe('198.51.100.9');
    expect(resolveClientIp(def, '::ffff:127.0.0.1', '2606:4700:10::1', '2001:db8::7')).toBe('2001:db8::7');
  });
  it('X-Forwarded-For o CF-Connecting-IP inventados no cuelan', () => {
    // Directo a Caddy saltándose Cloudflare: el salto que ve Caddy no es de Cloudflare
    expect(resolveClientIp(def, '127.0.0.1', '203.0.113.50', '1.1.1.1')).toBe('203.0.113.50');
    // Directo al puerto del servidor (sin Caddy): la IP del socket manda
    expect(resolveClientIp(def, '203.0.113.50', '10.9.9.9', '1.1.1.1')).toBe('203.0.113.50');
    // Lo que el cliente pone a la izquierda no se mira
    expect(resolveClientIp(def, '127.0.0.1', '1.2.3.4, 203.0.113.50')).toBe('203.0.113.50');
    // Basura en la cabecera
    expect(resolveClientIp(def, '127.0.0.1', 'hola')).toBe('127.0.0.1');
  });
  it('sin proxies (local) y con lista propia', () => {
    expect(resolveClientIp(def, '127.0.0.1', undefined)).toBe('127.0.0.1');
    const none = parseTrustedProxies('');
    expect(resolveClientIp(none, '127.0.0.1', '203.0.113.50', '1.1.1.1')).toBe('127.0.0.1');
    const lb = parseTrustedProxies('loopback, 10.0.0.0/8');
    expect(resolveClientIp(lb, '127.0.0.1', '203.0.113.50, 10.1.2.3')).toBe('203.0.113.50');
    expect(resolveClientIp(lb, '127.0.0.1', '172.70.1.2', '1.1.1.1')).toBe('172.70.1.2'); // sin `cloudflare`: no se cree su cabecera
    expect(() => parseTrustedProxies('loopback, nope')).toThrow(/TRUSTED_PROXIES/);
  });
});
