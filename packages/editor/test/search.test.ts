import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeElement, makeView, makeNode, type NotationPack } from '@all-draw/core';
import { searchWorkspace, scoreText, elementTexts } from '../src/search';

const FREEFORM: NotationPack = {
  id: 'freeform', name: 'Libre', categories: [], portTypes: [], viewpoints: [], relationTypes: [],
  elementTypes: [{ id: 'freeform:box', name: 'Caja', fields: [] }],
};
const setup = () => ({ store: new MemoryStore(parseWorkspace(exampleWorkspace())), reg: new NotationRegistry().register(CORE_PACK).register(FREEFORM) });

describe('scoreText', () => {
  it('ordena: exacto > empieza por > empieza palabra > contiene > todas las palabras', () => {
    expect(scoreText('crm', 'CRM')).toBe(100);
    expect(scoreText('cr', 'CRM')).toBe(80);
    expect(scoreText('alta', 'Proceso de alta')).toBe(60);
    expect(scoreText('oces', 'Proceso de alta')).toBe(40);
    expect(scoreText('alta proceso', 'Proceso de alta')).toBe(30);
    expect(scoreText('xyz', 'Proceso de alta')).toBe(0);
    expect(scoreText('', 'x')).toBe(0);
  });
  it('ignora tildes y mayúsculas', () => {
    expect(scoreText('facturacion', 'Facturación')).toBe(100);
    expect(scoreText('ÁREA', 'area comercial')).toBe(80);
  });
});

describe('searchWorkspace', () => {
  it('encuentra elementos por nombre y dice en cuántas vistas están', () => {
    const { store, reg } = setup();
    const hits = searchWorkspace(store, reg, 'alta', { viewId: 'vw_1' });
    const el = hits.find(h => h.kind === 'element' && h.id === 'el_alta');
    expect(el).toBeDefined();
    if (el?.kind === 'element') { expect(el.viewIds.sort()).toEqual(['vw_1', 'vw_2']); expect(el.hint).toContain('en esta vista'); }
    // También la vista "Detalle del alta"
    expect(hits.some(h => h.kind === 'view' && h.id === 'vw_2')).toBe(true);
  });
  it('busca en documentación, etiquetas, propiedades y valores de campos, con menos peso que el nombre', () => {
    const { store, reg } = setup();
    store.set('elements', 'el_x', makeElement('freeform:box', 'Pagos', { id: 'el_x', doc: 'Pasarela de tarjetas', tags: ['pci'], props: { owner: 'Marta' }, fields: { api: '{"endpoint":"stripe"}' } }));
    for (const q of ['tarjetas', 'pci', 'marta', 'stripe']) {
      const hits = searchWorkspace(store, reg, q);
      expect(hits.map(h => h.id), q).toContain('el_x');
    }
    store.set('elements', 'el_y', makeElement('freeform:box', 'Stripe', { id: 'el_y' }));
    const hits = searchWorkspace(store, reg, 'stripe');
    expect(hits[0]!.id).toBe('el_y'); // el nombre gana al campo
  });
  it('no devuelve plantillas y prioriza los elementos de la vista actual', () => {
    const { store, reg } = setup();
    store.set('elements', 'el_t', makeElement('freeform:box', 'CRM plantilla', { id: 'el_t', template: true }));
    store.set('views', 'vw_3', makeView('Otra', { id: 'vw_3' }));
    store.set('elements', 'el_crm2', makeElement('freeform:box', 'CRM', { id: 'el_crm2' }));
    store.set('nodes', 'vn_9', makeNode('vw_3', 'el_crm2', { x: 0, y: 0 }, { id: 'vn_9' }));
    const hits = searchWorkspace(store, reg, 'crm', { viewId: 'vw_3' });
    expect(hits.map(h => h.id)).not.toContain('el_t');
    expect(hits[0]!.id).toBe('el_crm2');
  });
  it('acciones: se buscan por etiqueta y palabras clave; sin consulta se listan acciones y vistas', () => {
    const { store, reg } = setup();
    const actions = [{ id: 'layout', label: 'Layout automático', keywords: 'ordenar' }, { id: 'ws', label: 'Abrir Espacio' }];
    expect(searchWorkspace(store, reg, 'ordenar', { actions }).map(h => h.id)).toEqual(['layout']);
    const empty = searchWorkspace(store, reg, '', { actions });
    expect(empty.filter(h => h.kind === 'action')).toHaveLength(2);
    expect(empty.filter(h => h.kind === 'view')).toHaveLength(2);
    expect(empty.some(h => h.kind === 'element')).toBe(false);
  });
  it('respeta el límite', () => {
    const { store, reg } = setup();
    for (let i = 0; i < 50; i++) store.set('elements', `e${i}`, makeElement('freeform:box', `Servicio ${i}`, { id: `e${i}` }));
    expect(searchWorkspace(store, reg, 'servicio', { limit: 5 })).toHaveLength(5);
  });
  it('elementTexts separa nombre de lo secundario', () => {
    const t = elementTexts(makeElement('freeform:box', 'N', { doc: 'D', tags: ['t'], props: { k: 'v' }, fields: { f: ['a', 'b'] } }));
    expect(t.primary).toEqual(['N']);
    expect(t.secondary).toEqual(['D', 't', 'k v', 'a, b']);
  });
});
