import { describe, it, expect } from 'vitest';
import { evaluate, evalCondition, parseExpression, checkExpression, expressionVariables, runAction, parseDuration, formatDuration, ExprError } from '../src';

describe('evaluador de expresiones', () => {
  it('aritmética y precedencia', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7);
    expect(evaluate('(1 + 2) * 3')).toBe(9);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('2 * 3 % 4')).toBe(2);
    expect(evaluate('-x + +"5"', { x: 2 })).toBe(3);
    expect(evaluate('1e3 / 4')).toBe(250);
    expect(evaluate('.5 + 0.25')).toBe(0.75);
  });
  it('comparaciones y lógica (con alias en palabras)', () => {
    const v = { importe: 1500, pais: 'ES', vip: false };
    expect(evaluate('importe > 1000 && pais == "ES"', v)).toBe(true);
    expect(evaluate('importe > 1000 and not vip', v)).toBe(true);
    expect(evaluate('importe < 1000 or vip', v)).toBe(false);
    expect(evaluate('!vip', v)).toBe(true);
    expect(evaluate('importe >= 1500 ? "alto" : "bajo"', v)).toBe('alto');
    expect(evaluate("pais != 'FR'", v)).toBe(true);
    expect(evaluate('a ?? 3', {})).toBe(3);
    expect(evaluate('a || b && c', { a: 0, b: 1, c: 'x' })).toBe('x');
  });
  it('igualdad: números con cadenas numéricas y booleanos con texto; === estricta', () => {
    expect(evaluate("'5' == 5")).toBe(true);
    expect(evaluate("'5' === 5")).toBe(false);
    expect(evaluate("aprobado == 'true'", { aprobado: true })).toBe(true);
    expect(evaluate('a == b', { a: null })).toBe(true);
    expect(evaluate("'abc' < 'abd'")).toBe(true);
    expect(evaluate("'10' > 9")).toBe(true);
  });
  it('miembros, índices, in y longitud', () => {
    const v = { cliente: { pais: 'ES', tags: ['vip', 'nuevo'] }, items: [1, 2, 3] };
    expect(evaluate('cliente.pais', v)).toBe('ES');
    expect(evaluate("cliente['pais']", v)).toBe('ES');
    expect(evaluate('items[1]', v)).toBe(2);
    expect(evaluate('items.length', v)).toBe(3);
    expect(evaluate("'vip' in cliente.tags", v)).toBe(true);
    expect(evaluate("'pais' in cliente", v)).toBe(true);
    expect(evaluate("2 in [1, 2]", v)).toBe(true);
    expect(evaluate('cliente.nada.mas', v)).toBe(undefined);
  });
  it('funciones de la lista blanca', () => {
    expect(evaluate('len("hola") + len([1,2])')).toBe(6);
    expect(evaluate('max(1, 5, 3) - min(4, 2)')).toBe(3);
    expect(evaluate('round(3.14159, 2)')).toBe(3.14);
    expect(evaluate('upper(lower("AbC"))')).toBe('ABC');
    expect(evaluate('contains(["a","b"], "b") && startsWith("hola", "ho") && endsWith("hola", "la")')).toBe(true);
    expect(evaluate('isEmpty("") && !isEmpty([1])')).toBe(true);
    expect(evaluate('bool("no")')).toBe(false);
    expect(() => parseExpression('alert(1)')).toThrow(/Función desconocida/);
  });
  it('acepta los envoltorios ${…} y #{…}', () => {
    expect(evaluate('${importe > 100}', { importe: 200 })).toBe(true);
    expect(evaluate('#{x == 1}', { x: 1 })).toBe(true);
  });
  it('es seguro: sin prototipos, constructores ni código arbitrario', () => {
    expect(() => evaluate('x.__proto__', { x: {} })).toThrow(ExprError);
    expect(() => evaluate('x.constructor', { x: {} })).toThrow(ExprError);
    expect(() => evaluate("x['constructor']['constructor']('return 1')()", { x: {} })).toThrow();
    expect(() => evaluate('constructor')).toThrow(ExprError);
    expect(evaluate('toString', {})).toBe(undefined);
    expect(evaluate('x.toString', { x: {} })).toBe(undefined);
    expect(evaluate('s.length', { s: 'abc' })).toBe(3);
    expect(evaluate('d.getTime', { d: new Date() })).toBe(undefined);
    expect(() => parseExpression('a; b')).toThrow(ExprError);
    expect(() => parseExpression('(((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))')).toThrow(/anidada/);
    expect(() => parseExpression('1 +'.repeat(3000))).toThrow(/larga/);
  });
  it('errores con mensaje claro y sin lanzar en evalCondition', () => {
    expect(checkExpression('importe >')).toMatch(/termina/);
    expect(checkExpression('x = 1')).toMatch(/==/);
    expect(checkExpression("'abc")).toMatch(/sin cerrar/);
    expect(checkExpression('a @ b')).toMatch(/inesperado/);
    expect(checkExpression('a > 1')).toBeNull();
    expect(evalCondition('a >', {})).toEqual({ ok: false, error: expect.any(String) });
    expect(evalCondition('a > 1', { a: 2 })).toEqual({ ok: true, value: true });
    expect(evalCondition('aprobado', {})).toEqual({ ok: true, value: false });
  });
  it('variables que lee una expresión', () => {
    expect(expressionVariables('importe > limite && cliente.pais == "ES" && len(items) > 0').sort()).toEqual(['cliente', 'importe', 'items', 'limite']);
    expect(expressionVariables('roto >')).toEqual([]);
  });
});

describe('acciones', () => {
  it('asignaciones sin mutar las variables', () => {
    const v = { n: 1, s: 'a' };
    expect(runAction('n = n + 1', v)).toEqual({ kind: 'assign', target: 'n', variables: { n: 2, s: 'a' } });
    expect(v.n).toBe(1);
    expect(runAction('n += 5', v).variables?.n).toBe(6);
    expect(runAction('n -= 5', v).variables?.n).toBe(-4);
    expect(runAction('n *= 3', v).variables?.n).toBe(3);
    expect(runAction('n /= 2', v).variables?.n).toBe(0.5);
    expect(runAction('n++', v).variables?.n).toBe(2);
    expect(runAction('m--', v).variables?.m).toBe(-1);
    expect(runAction("s += 'b'", v).variables?.s).toBe('ab');
    expect(runAction('ok = n > 0', v).variables?.ok).toBe(true);
  });
  it('raise, acciones opacas y errores', () => {
    expect(runAction('raise(PAGADO)')).toEqual({ kind: 'raise', event: 'PAGADO' });
    expect(runAction("raise('a.b')")).toEqual({ kind: 'raise', event: 'a.b' });
    expect(runAction('enviarCorreo')).toEqual({ kind: 'opaque' });
    expect(runAction('x == 1')).toEqual({ kind: 'opaque' });
    expect(runAction('x = (')).toMatchObject({ kind: 'error' });
    expect(runAction('__proto__ = 1')).toMatchObject({ kind: 'error' });
  });
});

describe('duraciones', () => {
  it('formatos simples, compuestos e ISO 8601', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('500')).toBe(500);
    expect(parseDuration(250)).toBe(250);
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('5 min')).toBe(300_000);
    expect(parseDuration('2 minutos')).toBe(120_000);
    expect(parseDuration('1.5h')).toBe(5_400_000);
    expect(parseDuration('1h 30m')).toBe(5_400_000);
    expect(parseDuration('2 días')).toBe(172_800_000);
    expect(parseDuration('1d')).toBe(86_400_000);
    expect(parseDuration('PT5M')).toBe(300_000);
    expect(parseDuration('P1DT2H')).toBe(93_600_000);
    expect(parseDuration('R3/PT10M')).toBe(600_000);
    expect(parseDuration('after 2s')).toBe(2000);
    expect(parseDuration('mañana')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('5 lunas')).toBeNull();
  });
  it('formato legible', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(75_000)).toBe('1 min 15 s');
    expect(formatDuration(93_600_000)).toBe('1 d 2 h');
  });
});
