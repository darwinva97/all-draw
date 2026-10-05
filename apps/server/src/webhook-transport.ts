/**
 * Transporte de los webhooks en Node (`node:http`/`node:https`), con la protección SSRF **en el propio socket**: la IP a
 * la que se conecta se comprueba dentro del `lookup` de la conexión (todas las que devuelve el DNS tienen que ser
 * públicas), así que un DNS que cambia entre la comprobación y la conexión (DNS rebinding) no sirve. Las IPs escritas en
 * la URL se comprueban antes (Node no llama a `lookup` para ellas). No sigue redirecciones, corta a los 10 s y lee como
 * mucho 64 KB de la respuesta. Ver `@all-draw/server-core/webhooks`.
 */
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { assertPublicAddresses, parseWebhookUrl, type Resolver, type UrlPolicy, type WebhookTransport } from '@all-draw/server-core';

/** Resolución DNS del sistema (A y AAAA), para comprobar la URL al registrar el webhook. */
export const nodeResolver = (): Resolver => async host => (await dns.promises.lookup(host, { all: true, verbatim: true })).map(a => a.address);

/** `lookup` que sólo deja conectar con IPs públicas (salvo `allowPrivate`). */
export function safeLookup(policy: UrlPolicy = {}): LookupFunction {
  return ((hostname: string, options: dns.LookupOptions, cb: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
      if (err) return cb(err, '', 4);
      const list = addrs as unknown as dns.LookupAddress[];
      if (!policy.allowPrivate) {
        try { assertPublicAddresses(hostname, list.map(a => a.address)); } catch (e) { return cb(e as NodeJS.ErrnoException, '', 4); }
      }
      if (options.all) return cb(null, list);
      const first = list[0];
      if (!first) return cb(Object.assign(new Error(`No se pudo resolver ${hostname}`), { code: 'ENOTFOUND' }), '', 4);
      cb(null, first.address, first.family);
    });
  }) as unknown as LookupFunction;
}

export function nodeTransport(policy: UrlPolicy = {}): WebhookTransport {
  const lookup = safeLookup(policy);
  return req => new Promise((resolve, reject) => {
    let u: URL;
    try { u = parseWebhookUrl(req.url, policy); } catch (e) { reject(e); return; }
    const mod = u.protocol === 'http:' ? http : https;
    let done = false;
    const chunks: Buffer[] = [];
    let n = 0;
    const r = mod.request(u, { method: 'POST', headers: { ...req.headers, 'content-length': String(Buffer.byteLength(req.body)) }, lookup, agent: false }, res => {
      const finish = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
      };
      res.on('data', (c: Buffer) => {
        if (n < req.maxResponseBytes) chunks.push(c.subarray(0, req.maxResponseBytes - n));
        n += c.length;
        if (n >= req.maxResponseBytes) { finish(); res.destroy(); }
      });
      res.on('end', finish);
      res.on('close', finish);
      res.on('error', finish);
    });
    const timer = setTimeout(() => r.destroy(new Error(`sin respuesta en ${Math.round(req.timeoutMs / 1000)} s`)), req.timeoutMs);
    timer.unref?.();
    r.on('error', e => { if (done) return; done = true; clearTimeout(timer); reject(e); });
    r.end(req.body);
  });
}
