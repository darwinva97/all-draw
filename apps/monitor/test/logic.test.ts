/** Monitor: qué cuenta como caída, avisos tras 2 fallos seguidos y al recuperarse, textos y página de estado. */
import { describe, expect, it } from 'vitest';
import { alertFor, judge, parseTargets, pickLang, renderPage, step, type CheckResult, type Summary, type TargetState } from '../src/logic';

const T0 = Date.parse('2026-10-05T03:00:00Z');
const res = (ok: boolean, i: number, error: string | null = ok ? null : 'HTTP 502'): CheckResult => ({ target: 'vps', ts: T0 + i * 300_000, ok, status: ok ? 200 : 502, ms: 80, dbOk: ok, error });

describe('monitor', () => {
  it('judge: 200 + status ok + BD ok; 503 degradado, JSON raro o BD caída son fallos', () => {
    expect(judge(200, { status: 'ok', db: { ok: true } })).toEqual({ ok: true, dbOk: true, error: null });
    expect(judge(503, { status: 'degraded', db: { ok: false } })).toMatchObject({ ok: false, dbOk: false, error: 'HTTP 503 (BD sin respuesta)' });
    expect(judge(200, '<html>')).toMatchObject({ ok: false, error: expect.stringContaining('sin JSON') });
    expect(judge(200, { status: 'ok', db: { ok: false } })).toMatchObject({ ok: false, error: 'la BD no responde' });
  });

  it('step: un fallo no avisa; el segundo seguido sí (una vez); el primer acierto avisa de la recuperación', () => {
    let s: TargetState = { fails: 0, down: false, since: null };
    const seq = [true, false, true, false, false, false, true, true].map((ok, i) => {
      const r = step(s, res(ok, i), 2);
      s = r.state;
      return r.transition?.kind ?? null;
    });
    expect(seq).toEqual([null, null, null, null, 'down', null, 'up', null]);
    const down = step({ fails: 1, down: false, since: T0 }, res(false, 1), 2).transition!;
    expect(down).toMatchObject({ kind: 'down', since: T0, fails: 2 });
    const up = step({ fails: 3, down: true, since: T0 }, res(true, 3), 2).transition!;
    expect(up).toMatchObject({ kind: 'up', downForMs: 900_000 });
  });

  it('avisos de ntfy y destinos', () => {
    const target = { id: 'vps', name: 'alldraw.bezenti.com', url: 'https://alldraw.bezenti.com/api/status' };
    const a = alertFor({ kind: 'down', target: 'vps', since: T0, fails: 2, error: 'sin respuesta en 10 s' }, target, 'https://status', 'prueba local');
    expect(a).toMatchObject({ title: '[prueba local] all-draw caído: alldraw.bezenti.com', priority: 5, click: 'https://status' });
    expect(a.message).toContain('2026-10-05 03:00 UTC');
    expect(alertFor({ kind: 'up', target: 'vps', since: T0, downForMs: 3_900_000 }, target, null).message).toContain('1 h 5 min');
    expect(parseTargets('[{"id":"a","url":"https://x/api/status"}]')).toEqual([{ id: 'a', name: 'a', url: 'https://x/api/status' }]);
    expect(() => parseTargets('{')).toThrow(/JSON/);
  });

  it('página de estado: autocontenida, escapa textos, idioma por Accept-Language', () => {
    const s: Summary = {
      generatedAt: T0,
      targets: [{
        target: { id: 'vps', name: 'VPS <principal>', url: 'https://alldraw.bezenti.com/api/status' }, down: true,
        last: { ts: T0, ok: false, status: 0, ms: 10_000, error: 'sin respuesta en 10 s' }, uptime24h: 0.99653, uptime7d: 1, avgMs24h: 84.4,
        hours: Array.from({ length: 24 }, (_, i) => ({ from: T0 - (23 - i) * 3_600_000, total: i === 23 ? 12 : 12, ok: i === 23 ? 10 : 12 })),
      }],
      incidents: [{ target: 'vps', started: T0 - 600_000, ended: null, reason: 'HTTP 502' }],
    };
    const html = renderPage(s, 'es', 'https://alldraw.bezenti.com');
    expect(html).toContain('VPS &lt;principal&gt;');
    expect(html).toContain('99,65 %');
    expect(html).toContain('100 %');
    expect(html).toContain('Hay servicios caídos');
    expect(html).toContain('en curso');
    expect(html).not.toMatch(/<script|<link|src="http/);
    expect(renderPage(s, 'en', 'https://x')).toContain('Some services are down');
    expect(pickLang('en-US,en;q=0.9')).toBe('en');
    expect(pickLang('es-ES,es;q=0.9,en;q=0.8')).toBe('es');
    expect(pickLang(null)).toBe('es');
  });
});
