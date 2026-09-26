import { describe, expect, it } from 'vitest';
import { hashPassword, makeHasher, needsRehash, randomToken, registerPasswordScheme, verifyPassword } from '../src/auth';

describe('auth (WebCrypto)', () => {
  it('PBKDF2: hash y verificación; formatos desconocidos → false', async () => {
    const h = await hashPassword('secreta-larga');
    expect(h).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await verifyPassword('secreta-larga', h)).toBe(true);
    expect(await verifyPassword('otra', h)).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'md5$ab$cd')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$zz$zz')).toBe(false);
    expect(needsRehash(h)).toBe(false);
    expect(needsRehash('scrypt$aa$bb')).toBe(true);
  });

  it('esquemas heredados registrados por el runtime', async () => {
    expect(await verifyPassword('x', 'scrypt$aa$bb')).toBe(false);
    registerPasswordScheme('scrypt', async (pw, stored) => pw === 'legacy' && stored.endsWith('$bb'));
    expect(await verifyPassword('legacy', 'scrypt$aa$bb')).toBe(true);
    expect(await verifyPassword('legacy', 'scrypt$aa$cc')).toBe(false);
  });

  it('hasher SHA-256 vs HMAC y tokens aleatorios', async () => {
    const plain = makeHasher(null), keyed = makeHasher('secreto'), keyed2 = makeHasher('otro');
    expect(await plain('t')).toHaveLength(64);
    expect(await keyed('t')).not.toBe(await plain('t'));
    expect(await keyed('t')).not.toBe(await keyed2('t'));
    expect(await keyed('t')).toBe(await keyed('t'));
    const t = randomToken('ads_');
    expect(t).toMatch(/^ads_[A-Za-z0-9]{32}$/);
    expect(randomToken('ads_')).not.toBe(t);
  });
});
