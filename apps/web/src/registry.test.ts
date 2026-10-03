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

describe('campos de los packs: etiquetas y opciones legibles en los dos idiomas', () => {
  const fieldsOf = (p: NotationPack) => [...p.elementTypes, ...p.relationTypes].flatMap(t => (t.fields ?? []).map(f => ({ pack: p.id, type: t.id, f })));
  const all = [CORE_PACK, ...PACKS].flatMap(fieldsOf);

  it('toda opción `select` tiene nombre legible (optionLabels) y toda etiqueta, opción, rótulo y ayuda tiene traducción inglesa', () => {
    expect(all.length).toBeGreaterThan(100);
    const unnamed: string[] = [];
    const texts = new Map<string, string>();
    for (const { pack, type, f } of all) {
      const where = `${type}.${f.key}`;
      texts.set(f.label, where);
      if (f.doc) texts.set(f.doc, where);
      if (f.kind === 'keyvalue' && f.options) for (const part of f.options.split('|')) texts.set(part, where);
      if (f.kind !== 'select') continue;
      for (const o of (f.options ?? '').split(',').map(x => x.trim()).filter(Boolean)) {
        const label = f.optionLabels?.[o];
        if (!label) unnamed.push(`${pack} ${where}: ${o}`);
        else texts.set(label, `${where}=${o}`);
      }
    }
    expect(unnamed, 'Opciones sin nombre legible').toEqual([]);
    expect(missing('en', texts.keys()).map(k => `${texts.get(k)}: ${k}`), 'Textos de campos sin traducción inglesa').toEqual([]);
  });

  it('localizePack traduce etiquetas, ayudas y rótulos de keyvalue; las opciones conservan su valor interno', () => {
    const bpmn = localizePack(PACKS.find(p => p.id === 'bpmn')!, 'en');
    const task = bpmn.elementTypes.find(t => t.id === 'bpmn:Task')!;
    const taskType = task.fields.find(f => f.key === 'taskType')!;
    expect(taskType.label).toBe('Task type');
    expect(taskType.options).toContain('businessRule');
    expect(taskType.optionLabels?.businessRule).toBe('Regla de negocio'); // el inspector lo traduce con t()
    expect(task.fields.find(f => f.key === 'loop')?.label).toBe('Loop');
    const er = localizePack(PACKS.find(p => p.id === 'er')!, 'en');
    const attrs = er.elementTypes.flatMap(t => t.fields).find(f => f.kind === 'keyvalue' && f.options);
    if (attrs) expect(attrs.options).not.toMatch(/Atributo/);
    // Las etiquetas en español no cambian con 'es'
    expect(localizePack(PACKS.find(p => p.id === 'bpmn')!, 'es').elementTypes.find(t => t.id === 'bpmn:Task')!.fields.find(f => f.key === 'taskType')!.label).toBe('Tipo de tarea');
  });
});
