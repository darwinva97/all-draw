import { describe, it, expect } from 'vitest';
import { parseWorkspace, exampleWorkspace } from '@all-draw/core';
import { parseDsl, serializeDsl, isDsl, detectFormat, importAny, importMermaid, importDrawio, dslId } from '../src';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE = `// all-draw DSL v1
/* Un ejemplo escrito a mano: sin ids de nodo ni posiciones */
workspace "Tienda" {
  description "Arquitectura mínima"

  model {
    cliente = archimate:BusinessActor "Cliente" {
      doc "Quien compra"
      tags ["externo"]
    }
    web = archimate:ApplicationComponent "Tienda web" {
      version = 3
      activo = true
      notas = sin-comillas
      api = archimate:ApplicationInterface "API REST"
    }
    archimate:ApplicationService "Catálogo"     // sin id: se genera a partir del nombre
    web -> cliente : archimate:Serving "atiende"
    sirve = catalogo -> cliente : archimate:Serving
  }

  view mapa "Mapa" {
    notation archimate
    include *
    note "Borrador"
  }
}
`;

describe('parseDsl', () => {
  const r = parseDsl(SAMPLE);
  const ws = r.workspace;

  it('lee el ejemplo sin errores y con valores por defecto', () => {
    expect(r.diagnostics).toEqual([]);
    expect(() => parseWorkspace(ws)).not.toThrow();
    expect(ws.meta).toMatchObject({ name: 'Tienda', description: 'Arquitectura mínima' });
    expect(ws.elements['cliente']).toMatchObject({ typeId: 'archimate:BusinessActor', name: 'Cliente', doc: 'Quien compra', tags: ['externo'], ports: [], props: {} });
  });

  it('campos, anidamiento (features.parentId) e ids generados', () => {
    expect(ws.elements['web']!.fields).toEqual({ version: 3, activo: true, notas: 'sin-comillas' });
    expect(ws.elements['api']).toMatchObject({ typeId: 'archimate:ApplicationInterface', features: { parentId: 'web' } });
    expect(ws.elements['catalogo']).toMatchObject({ name: 'Catálogo', typeId: 'archimate:ApplicationService' });
    const rels = Object.values(ws.relations);
    expect(rels.map(x => [x.from.elementId, x.to.elementId, x.typeId, x.name])).toEqual([
      ['web', 'cliente', 'archimate:Serving', 'atiende'], ['catalogo', 'cliente', 'archimate:Serving', ''],
    ]);
    expect(ws.relations['sirve']).toBeDefined();
  });

  it('include * pone todos los elementos y sus relaciones; sin posiciones → pendiente de layout con rejilla provisional', () => {
    const nodes = Object.values(ws.nodes).filter(n => n.viewId === 'mapa');
    expect(nodes.filter(n => n.elementId).map(n => n.elementId).sort()).toEqual(['api', 'catalogo', 'cliente', 'web']);
    expect(nodes.find(n => n.visualType === 'core:note')!.text).toBe('Borrador');
    expect(Object.values(ws.edges)).toHaveLength(2);
    expect(r.unpositioned).toEqual(['mapa']);
    const xs = new Set(nodes.map(n => `${n.x},${n.y}`));
    expect(xs.size).toBe(nodes.length);
    expect(ws.views['mapa']!.notationId).toBe('archimate');
  });

  it('locations: dónde empieza cada registro', () => {
    expect(r.locations['elements/cliente']).toEqual({ line: 7, col: 5 });
    expect(r.locations['views/mapa']).toEqual({ line: 22, col: 3 });
  });
});

describe('errores con línea y columna', () => {
  const errs = (text: string) => parseDsl(text).diagnostics.filter(d => d.severity === 'error');

  it('sintaxis', () => {
    expect(errs('a = x:T "A"\nb = x:T "B" "sobra"')[0]).toMatchObject({ line: 2, col: 13, message: expect.stringMatching(/Se esperaba fin de línea/) });
    expect(errs('a = x:T "sin cerrar\n')[0]).toMatchObject({ line: 1, col: 9, message: expect.stringMatching(/sin cerrar/) });
    expect(errs('model {\n  a = x:T\n')[0]).toMatchObject({ line: 3, message: expect.stringMatching(/Falta «}».*línea 1/) });
    expect(errs('}')[0]!.message).toMatch(/sin bloque/);
    expect(errs('a = x:T "A" { doc }')[0]!.message).toMatch(/Se esperaba un valor/);
    expect(errs('a = x:T ~')[0]).toMatchObject({ line: 1, col: 9, message: expect.stringMatching(/Carácter inesperado «~»/) });
  });

  it('referencias', () => {
    expect(errs('a = x:T\na = x:T')[0]!.message).toMatch(/Id repetido «a»/);
    expect(errs('view v { include a\n edge nada }')[0]!.message).toMatch(/La relación «nada» no existe/);
    expect(errs('a = x:T\nb = x:T\nr = a -> b\nview v {\n  include a\n  edge r\n}')[0]).toMatchObject({ line: 6, message: expect.stringMatching(/no tiene nodos/) });
    const w = parseDsl('view v { include fantasma }').diagnostics[0]!;
    expect(w).toMatchObject({ severity: 'warning', line: 1, col: 18 });
    expect(w.message).toMatch(/«fantasma» no existe/);
  });

  it('recupera tras un error y sigue leyendo', () => {
    const r = parseDsl('a = x:T "A" !!!\nb = x:T "B"');
    expect(r.diagnostics.length).toBeGreaterThan(0);
    expect(r.workspace.elements['b']).toBeDefined();
  });

  it('nunca lanza', () => {
    for (const t of ['', '{', '"', '`', 'workspace', 'view', 'a ->', 'a = ', '[[[', 'model { view }', '/*']) expect(() => parseDsl(t)).not.toThrow();
  });
});

describe('serializeDsl', () => {
  it('ida y vuelta con el ejemplo del núcleo, Mermaid y draw.io importados', () => {
    const sources = [
      parseWorkspace(exampleWorkspace()),
      importMermaid('flowchart TD\n  A[Inicio] --> B{Decide?}\n  subgraph S[Grupo]\n    B -.->|no| C[(BD)]\n  end').workspace,
      parseWorkspace(importDrawio(readFileSync(join(__dirname, 'fixtures', 'varias-paginas.drawio'), 'utf8')).workspace),
    ];
    for (const ws of sources) {
      const text = serializeDsl(ws);
      const back = parseDsl(text);
      expect(back.diagnostics, text).toEqual([]);
      expect(back.workspace).toEqual(parseWorkspace(ws));
    }
  });

  it('ids raros entre acentos graves, extremos de relación sin elemento y valores largos', () => {
    const ws = parseWorkspace({
      meta: { name: 'Raro' },
      elements: {
        '1 dos': { id: '1 dos', typeId: 'sin-pack', name: 'x' },
        'as': { id: 'as', typeId: 'a:B', name: 'y', fields: { big: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, `valor ${i}`])) } },
      },
      relations: {
        r: { id: 'r', typeId: 'core:link', from: { elementId: '1 dos', portId: 'p#a' }, to: { relationId: 'r2' } },
        r2: { id: 'r2', typeId: 'core:link', from: {}, to: { elementId: 'as' } },
      },
    });
    const text = serializeDsl(ws);
    expect(text).toContain('`1 dos` = `sin-pack` "x"');
    const back = parseDsl(text);
    expect(back.diagnostics, text).toEqual([]);
    expect(back.workspace).toEqual(ws);
    expect(dslId('vista.uno')).toBe('vista.uno');
    expect(dslId('view')).toBe('`view`');
  });

  it('determinista', () => {
    const ws = parseWorkspace(exampleWorkspace());
    expect(serializeDsl(ws)).toBe(serializeDsl(parseWorkspace(JSON.parse(JSON.stringify(ws)))));
  });
});

describe('detección e importación', () => {
  it('isDsl y detectFormat', () => {
    expect(isDsl(SAMPLE)).toBe(true);
    expect(isDsl('workspace {\n  model {\n    u = person "User"\n  }\n}')).toBe(false); // Structurizr DSL
    expect(detectFormat(SAMPLE)).toBe('dsl');
    expect(detectFormat('model {\n a = x:T\n}', 'algo.alldraw.txt')).toBe('dsl');
    expect(detectFormat('flowchart TD\n A')).toBe('mermaid');
  });

  it('importAny: devuelve las vistas sin posiciones y falla con línea y columna', async () => {
    const r = await importAny(SAMPLE, 'tienda.alldraw.txt');
    expect(r.format).toBe('dsl');
    expect(r.layoutViews).toEqual(['mapa']);
    expect(r.workspace.meta.name).toBe('Tienda');
    await expect(importAny('// all-draw DSL v1\na = x:T "A"\nb = x:T "B" "C"', 'x.alldraw.txt')).rejects.toThrow(/línea 3, columna 13/);
  });
});

describe('ejemplos del manual', () => {
  const block = (file: string, heading: RegExp) => {
    const md = readFileSync(join(__dirname, '../../../docs/manual', file), 'utf8');
    const at = md.search(heading);
    return /```text\n([\s\S]*?)```/.exec(md.slice(at))![1]!;
  };
  for (const file of ['dsl.md', 'en/dsl.md']) it(`${file}: el ejemplo completo se lee sin errores ni avisos`, () => {
    const r = parseDsl(block(file, /\{#ejemplo\}/));
    expect(r.diagnostics).toEqual([]);
    expect(Object.keys(r.workspace.elements)).toHaveLength(4);
    expect(r.unpositioned).toHaveLength(1);
    expect(Object.values(r.workspace.edges)).toHaveLength(2);
    // la librería y la rejilla también son válidas
    const lib = parseDsl(block(file, /\{#librerias\}/));
    expect(lib.diagnostics).toEqual([]);
    expect(Object.values(lib.workspace.libraries)[0]!.elementTypes[0]!.fields.map(f => f.kind)).toEqual(['url', 'select']);
    const grid = parseDsl(`a = x:T "A"\nsearch = x:T\nsearch2 = x:T\n${block(file, /\{#rejilla\}/).replace(/\binclude search\b/, 'include search')}`);
    expect(grid.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  });
});
