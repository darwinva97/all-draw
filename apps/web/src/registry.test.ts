/** Referencia de notaciones en inglés, portugués y francés: toda descripción (`doc`) de los packs tiene traducción y `localizePack` la aplica. */
import { describe, it, expect } from 'vitest';
import { CORE_PACK, type NotationPack } from '@all-draw/core';
import { LANGS, missing, tIn, type Lang } from '@all-draw/i18n';
import { PACKS, localizePack } from './registry';

const docsOf = (p: NotationPack): string[] => [
  p.doc, ...p.elementTypes.map(e => e.doc), ...p.relationTypes.map(r => r.doc), ...p.viewpoints.map(v => v.doc),
].filter((d): d is string => !!d);

const OTHER: Lang[] = LANGS.map(l => l.id).filter(l => l !== 'es');

describe('descripciones de los packs en todos los idiomas', () => {
  it('cubre los cuatro idiomas de la interfaz', () => expect(LANGS.map(l => l.id)).toEqual(['es', 'en', 'pt', 'fr']));

  it.each(OTHER)('ningún doc de ningún pack se queda sin traducción (%s)', lang => {
    const all = [CORE_PACK, ...PACKS].flatMap(p => docsOf(p).map(d => ({ pack: p.id, d })));
    expect(all.length).toBeGreaterThan(100);
    const lacking = missing(lang, new Set(all.map(x => x.d)));
    expect(lacking.map(d => `${all.find(x => x.d === d)!.pack}: ${d}`)).toEqual([]);
  });

  it.each(OTHER)('localizePack traduce el doc del pack, de tipos, relaciones y viewpoints (%s)', lang => {
    for (const p of [CORE_PACK, ...PACKS]) {
      const loc = localizePack(p, lang);
      const es = docsOf(p), out = docsOf(loc);
      expect(out.length).toBe(es.length);
      // Ninguna descripción traducida coincide con la española (todas son frases, no nombres propios)
      out.forEach((d, i) => expect(d, `${p.id}: ${es[i]}`).not.toBe(es[i]));
      // Nombres de pack, categorías y tipos: los mismos que da el diccionario
      expect(loc.name).toBe(tIn(lang, p.name));
      p.categories.forEach((c, i) => expect(loc.categories[i]!.name).toBe(tIn(lang, c.name)));
      p.elementTypes.forEach((e, i) => expect(loc.elementTypes[i]!.name).toBe(tIn(lang, e.name)));
    }
  });

  it('BPMN y ArchiMate: terminología de cada idioma', () => {
    const bpmn = localizePack(PACKS.find(p => p.id === 'bpmn')!, 'en');
    expect(bpmn.elementTypes.find(t => t.id === 'bpmn:Lane')?.doc).toMatch(/lane/i);
    expect(localizePack(PACKS[0]!, 'es')).toBe(PACKS[0]);
    const name = (lang: Lang, pack: string, id: string) => localizePack(PACKS.find(p => p.id === pack)!, lang).elementTypes.find(t => t.id === id)?.name;
    expect(name('pt', 'bpmn', 'bpmn:Task')).toBe('Tarefa');
    expect(name('fr', 'bpmn', 'bpmn:Task')).toBe('Tâche');
    expect(name('pt', 'bpmn', 'bpmn:ExclusiveGateway')).toMatch(/^Gateway exclusivo$/i);
    expect(name('fr', 'bpmn', 'bpmn:ExclusiveGateway')).toMatch(/^Passerelle exclusive$/i);
    // Los tipos de ArchiMate se quedan en inglés, como en la especificación
    const am = PACKS.find(p => p.id === 'archimate')!;
    for (const lang of OTHER) localizePack(am, lang).elementTypes.forEach((e, i) => expect(e.name).toBe(tIn('en', am.elementTypes[i]!.name)));
  });
});

describe('campos de los packs: etiquetas y opciones legibles en todos los idiomas', () => {
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
    for (const lang of OTHER) expect(missing(lang, texts.keys()).map(k => `${texts.get(k)}: ${k}`), `Textos de campos sin traducción (${lang})`).toEqual([]);
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
    const pt = localizePack(PACKS.find(p => p.id === 'bpmn')!, 'pt').elementTypes.find(t => t.id === 'bpmn:Task')!.fields.find(f => f.key === 'taskType')!;
    const fr = localizePack(PACKS.find(p => p.id === 'bpmn')!, 'fr').elementTypes.find(t => t.id === 'bpmn:Task')!.fields.find(f => f.key === 'taskType')!;
    expect(pt.label).toBe(tIn('pt', 'Tipo de tarea'));
    expect(fr.label).toBe(tIn('fr', 'Tipo de tarea'));
    expect([pt.label, fr.label]).not.toContain('Tipo de tarea');
    expect(pt.label).not.toBe(fr.label);
    // Las etiquetas en español no cambian con 'es'
    expect(localizePack(PACKS.find(p => p.id === 'bpmn')!, 'es').elementTypes.find(t => t.id === 'bpmn:Task')!.fields.find(f => f.key === 'taskType')!.label).toBe('Tipo de tarea');
  });
});
