/** Los avisos del motor (claves en español) tienen traducción inglesa en `@all-draw/i18n`. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { missing } from '../../i18n/src';

describe('avisos traducibles', () => {
  it('todas las claves de aviso del motor están en el diccionario inglés', () => {
    const dir = join(__dirname, '../src');
    const keys = new Set<string>();
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      // warn('…'), warn(cond ? '…' : '…') y { key: '…' }
      for (const m of src.matchAll(/(?:warn\((?:[^'()]*\? )?|key: |: )'((?:[^'\\]|\\.)*\{[a-z]+\}(?:[^'\\]|\\.)*|La vista no tiene[^']*|Una transición[^']*)'/g)) keys.add(m[1]!);
    }
    expect(keys.size).toBeGreaterThan(20);
    expect(missing('en', keys)).toEqual([]);
  });
});
