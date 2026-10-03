/** Referencia de notaciones en inglés: toda descripción (`doc`) de los packs tiene traducción y `localizePack` la aplica. */
import { describe, it, expect } from 'vitest';
import { CORE_PACK, type NotationPack } from '@all-draw/core';
import { missing } from '@all-draw/i18n';
import { PACKS, localizePack } from './registry';

const docsOf = (p: NotationPack): string[] => [
  p.doc, ...p.elementTypes.map(e => e.doc), ...p.relationTypes.map(r => r.doc), ...p.viewpoints.map(v => v.doc),
].filter((d): d is string => !!d);

describe('descripciones de los packs en inglés', () => {
  it('ningún doc de ningún pack se queda sin traducción', () => {
    const all = [CORE_PACK, ...PACKS].flatMap(p => docsOf(p).map(d => ({ pack: p.id, d })));
    expect(all.length).toBeGreaterThan(100);
    const lacking = missing('en', new Set(all.map(x => x.d)));
    expect(lacking.map(d => `${all.find(x => x.d === d)!.pack}: ${d}`)).toEqual([]);
  });

  it('localizePack traduce el doc del pack, de tipos, relaciones y viewpoints', () => {
    for (const p of [CORE_PACK, ...PACKS]) {
      const en = localizePack(p, 'en');
      const es = docsOf(p), out = docsOf(en);
      expect(out.length).toBe(es.length);
      // Ninguna descripción en inglés coincide con la española (todas son frases, no nombres propios)
      out.forEach((d, i) => expect(d, `${p.id}: ${es[i]}`).not.toBe(es[i]));
    }
    const bpmn = localizePack(PACKS.find(p => p.id === 'bpmn')!, 'en');
    expect(bpmn.elementTypes.find(t => t.id === 'bpmn:Lane')?.doc).toMatch(/lane/i);
    expect(localizePack(PACKS[0]!, 'es')).toBe(PACKS[0]);
  });
});
