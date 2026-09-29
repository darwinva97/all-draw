import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, makeEdge } from '@all-draw/core';
// io no depende de los packs ER/UML: se importan por ruta solo en el test.
import { ER_PACK, ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY, INHERITS } from '../../notations/er/src';
import { UML_CLASS_PACK, ASSOCIATION } from '../../notations/uml-class/src';
import { renderSvg, renderSvgDetailed, cardToHead, cardEnds, exportDrawio, exportMermaid, erMarker, ER_RELATION_HEADS } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(ER_PACK).register(UML_CLASS_PACK);

/** Vista ER: Cliente 1:N Pedido, Pedido N:M Producto, Cliente 1:1 Perfil (con cardinalidad por arista), Vip hereda de Cliente. */
function erScene() {
  const store = new MemoryStore();
  store.set('views', 'v', makeView('Modelo', { id: 'v', notationId: 'er' }));
  const ent = (id: string, name: string, x: number, y: number, fields: Record<string, unknown> = {}) => {
    store.set('elements', id, makeElement('er:Entity', name, { id, fields }));
    store.set('nodes', `n_${id}`, makeNode('v', id, { x, y, w: 160, h: 80 }, { id: `n_${id}` }));
  };
  ent('cliente', 'Cliente', 0, 0, { attributes: [{ key: 'id', value: 'uuid' }, { key: 'email', value: 'varchar(255)' }], pk: ['id'] });
  ent('pedido', 'Pedido', 400, 0);
  ent('producto', 'Producto', 400, 300);
  ent('perfil', 'Perfil', 0, 300);
  ent('vip', 'Cliente VIP', -300, 0);
  const rel = (id: string, typeId: string, a: string, b: string, fields: Record<string, unknown> = {}, name = '') => {
    store.set('relations', id, makeRelation(typeId, { elementId: a }, { elementId: b }, { id, fields, name }));
    store.set('edges', `e_${id}`, makeEdge('v', id, `n_${a}`, `n_${b}`, { id: `e_${id}` }));
  };
  rel('r1', ONE_TO_MANY, 'cliente', 'pedido', {}, 'hace');
  rel('r2', MANY_TO_MANY, 'pedido', 'producto');
  rel('r3', ONE_TO_ONE, 'cliente', 'perfil', { targetCard: '0..1' });
  rel('r4', INHERITS, 'vip', 'cliente');
  return store;
}

describe('pata de gallo: cardinalidad → cabeza', () => {
  it('cardToHead acepta la notación textual, N/M y los ids', () => {
    expect(['1', '1..1', '0..1', '*', '1..*', '0..*'].map(cardToHead)).toEqual(['one', 'only-one', 'zero-or-one', 'many', 'one-or-many', 'zero-or-many']);
    expect(cardToHead('N')).toBe('many');
    expect(cardToHead(' 0..n ')).toBe('zero-or-many');
    expect(cardToHead('zero-or-one')).toBe('zero-or-one');
    expect(cardToHead('2..5')).toBeUndefined();
    expect(cardToHead(3)).toBeUndefined();
  });

  it('cardEnds: select (ER) sustituye la cabeza; texto (UML) se rotula; roles aparte', () => {
    const er = reg().relationType(ONE_TO_MANY)!.fields;
    expect(cardEnds({ sourceCard: '0..1', targetCard: '0..*' }, er)).toEqual({ sourceHead: 'zero-or-one', targetHead: 'zero-or-many' });
    const uml = reg().relationType(ASSOCIATION)!.fields;
    expect(cardEnds({ sourceCard: '1', targetCard: '0..*', targetRole: 'pedidos' }, uml)).toEqual({ sourceCard: '1', targetCard: '0..*', targetRole: 'pedidos' });
  });

  it('la tabla de io coincide con las cabezas del pack ER', () => {
    for (const [id, heads] of Object.entries(ER_RELATION_HEADS)) expect(ER_PACK.relationTypes.find(t => t.id === id)).toMatchObject(heads);
    expect(ER_PACK.relationTypes.filter(t => !ER_RELATION_HEADS[t.id])).toEqual([]);
  });
});

describe('SVG con pata de gallo', () => {
  it('marcadores IE del tipo y de la cardinalidad por arista, orientados en el origen', () => {
    const svg = renderSvg(erScene(), reg(), 'v', { idPrefix: 'x' });
    // 1:N → doble barra en el origen (auto-start-reverse), barra + pata en el destino
    expect(svg).toMatch(/<marker id="x-m-only-one-444-s" orient="auto-start-reverse"[^>]*><path d="M16,2 L16,14 M11,2 L11,14"/);
    expect(svg).toMatch(/<marker id="x-m-one-or-many-444" orient="auto"[^>]*><path d="M10,8 L22,2 M10,8 L22,14 M10,8 L22,8 M6,2 L6,14"/);
    // targetCard 0..1 sustituye la doble barra del destino de la 1:1: círculo hueco + barra
    expect(svg).toMatch(/<marker id="x-m-zero-or-one-444"[^>]*><path d="M16,2 L16,14"[^>]*\/><circle class="ad-card-hollow" cx="8" cy="8" r="4"/);
    const r3 = /<g class="ad-edge" data-edge="e_r3"[^>]*>(.*?)<\/g>/.exec(svg)![1]!;
    expect(r3).toContain('marker-start="url(#x-m-only-one-444-s)"');
    expect(r3).toContain('marker-end="url(#x-m-zero-or-one-444)"');
    // la cardinalidad de un select no se rotula ni entra en el rótulo central
    expect(r3).not.toContain('ad-card-label');
    expect(r3).not.toContain('0..1');
    // herencia sigue con triángulo
    expect(svg).toContain('x-m-triangle-444');
  });

  it('UML: multiplicidades y roles como texto junto a cada extremo', () => {
    const store = new MemoryStore();
    store.set('views', 'u', makeView('Clases', { id: 'u', notationId: 'uml' }));
    for (const [id, x] of [['a', 0], ['b', 400]] as const) {
      store.set('elements', id, makeElement('uml:Class', id.toUpperCase(), { id }));
      store.set('nodes', `n_${id}`, makeNode('u', id, { x, y: 0, w: 160, h: 80 }, { id: `n_${id}` }));
    }
    store.set('relations', 'r', makeRelation(ASSOCIATION, { elementId: 'a' }, { elementId: 'b' }, { id: 'r', fields: { sourceCard: '1', targetCard: '0..*', targetRole: 'pedidos' } }));
    store.set('edges', 'e', makeEdge('u', 'r', 'n_a', 'n_b', { id: 'e' }));
    const svg = renderSvg(store, reg(), 'u');
    // origen en x=160 (borde derecho de A), la arista sale hacia la derecha: texto encima, empezando a 6 px
    expect(svg).toContain('<text class="ad-card-label" x="166" y="30" text-anchor="start" dominant-baseline="central">1</text>');
    // destino en x=400, entra por la izquierda: texto encima, alineado a la derecha
    expect(svg).toContain('<text class="ad-card-label" x="394" y="30" text-anchor="end" dominant-baseline="central">0..*</text>');
    expect(svg).toContain('<text class="ad-card-label ad-card-label--role" x="394" y="51" text-anchor="end" dominant-baseline="central">pedidos</text>');
    // los campos de extremo no se repiten en el rótulo central
    expect(svg).not.toMatch(/<g class="ad-edge-label">/);

    // Con bendpoint y trazado recto el rótulo sigue la dirección hacia el bendpoint (aquí, hacia arriba: vertical)
    store.set('edges', 'e', makeEdge('u', 'r', 'n_a', 'n_b', { id: 'e', bendpoints: [{ x: 80, y: -200 }], style: { router: 'straight' } }));
    store.set('relations', 'r', makeRelation(ASSOCIATION, { elementId: 'a' }, { elementId: 'b' }, { id: 'r', fields: { sourceCard: '1', sourceRole: 'un rol de origen bastante largo' } }));
    const bent = renderSvgDetailed(store, reg(), 'u');
    // extremo origen en el borde superior de A (80,0), dirección (0,-1): 14 px arriba, 7 px a la derecha / izquierda
    expect(bent.svg).toContain('<text class="ad-card-label" x="87" y="-14" text-anchor="start" dominant-baseline="central">1</text>');
    expect(bent.svg).toContain('x="73" y="-14" text-anchor="end" dominant-baseline="central">un rol de origen bastante largo</text>');
    // el rol largo sale por la izquierda del nodo y agranda la caja envolvente
    expect(bent.viewBox[0]).toBeLessThan(-24 - 100);
  });
});

describe('draw.io con pata de gallo', () => {
  it('mapea las cabezas IE a las flechas ER de draw.io', () => {
    const ws = erScene().snapshot();
    const cells: Record<string, string>[] = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: n => n === 'mxCell' }).parse(exportDrawio(ws, 'v').text).mxfile.diagram.mxGraphModel.root.mxCell;
    const style = (id: string) => cells.find(c => c.id === `c_e_${id}`)!.style;
    expect(style('r1')).toContain('startArrow=ERmandOne;endArrow=ERoneToMany;');
    expect(style('r2')).toContain('startArrow=ERoneToMany;endArrow=ERoneToMany;');
    expect(style('r3')).toContain('startArrow=ERmandOne;endArrow=ERzeroToOne;');
    expect(style('r3')).toContain('endFill=0;');
    expect(style('r4')).toContain('endArrow=block;');
    ws.relations['r2']!.fields = { sourceCard: '*', targetCard: '0..*' };
    ws.edges['e_r1']!.style = { sourceHead: 'one' };
    const again: Record<string, string>[] = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: n => n === 'mxCell' }).parse(exportDrawio(ws, 'v').text).mxfile.diagram.mxGraphModel.root.mxCell;
    expect(again.find(c => c.id === 'c_e_r2')!.style).toContain('startArrow=ERmany;endArrow=ERzeroToMany;');
    expect(again.find(c => c.id === 'c_e_r1')!.style).toContain('startArrow=ERone;');
  });
});

describe('Mermaid erDiagram', () => {
  it('exporta entidades con atributos y relaciones con su cardinalidad', () => {
    const { text, warnings } = exportMermaid(erScene().snapshot(), 'v');
    const lines = text.trim().split('\n');
    expect(lines[0]).toBe('erDiagram');
    expect(text).toContain('    Cliente {\n        uuid id PK\n        varchar(255) email\n    }');
    expect(lines).toContain('    Pedido');
    expect(lines).toContain('    Cliente_VIP');
    expect(lines).toContain('    Cliente ||--|{ Pedido : "hace"');
    expect(lines).toContain('    Pedido }|--|{ Producto : ""');
    expect(lines).toContain('    Cliente ||--o| Perfil : ""');
    // la herencia no tiene equivalente: se exporta con aviso
    expect(lines).toContain('    Cliente_VIP ||--|| Cliente : ""');
    expect(warnings).toEqual([expect.stringContaining('er:Inherits')]);
  });

  it('marcadores a izquierda y derecha', () => {
    const heads = ['one', 'only-one', 'zero-or-one', 'many', 'one-or-many', 'zero-or-many'] as const;
    expect(heads.map(h => erMarker(h, 'left'))).toEqual(['||', '||', '|o', '}o', '}|', '}o']);
    expect(heads.map(h => erMarker(h, 'right'))).toEqual(['||', '||', 'o|', 'o{', '|{', 'o{']);
  });
});
