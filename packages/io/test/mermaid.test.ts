import { describe, it, expect } from 'vitest';
import { exportMermaid, importMermaid, importXState, importArchimate, exportArchimate, MERMAID_VIEW_ID, parseTransition } from '../src';

const FLOW = `%% comentario
flowchart LR
  A[Inicio] --> B{Decide?}
  B -->|sí| C((Fin))
  B -- no --> D[(Base de datos)]
  C -.-> E & F
  subgraph S1 [Backend]
    D --- G>Nota]
    subgraph S2 [Datos]
      H
    end
  end
  classDef x fill:#f00
  G <--> H
`;

const STATE = `stateDiagram-v2
    [*] --> Idle
    state "En marcha" as Running
    Idle --> Running: START [ok] / log, beep
    Running --> Idle: STOP
    state Running {
        [*] --> Slow
        Slow --> Fast: FASTER
        Fast --> [*]
    }
    state Fork <<fork>>
    Running --> Fork
    Idle --> [*]
`;

describe('importMermaid (flowchart)', () => {
  const { workspace: ws, warnings } = importMermaid(FLOW);

  it('crea nodos con forma, aristas con etiqueta y subgraphs anidados', () => {
    expect(warnings).toEqual([]);
    expect(ws.elements['A']).toMatchObject({ typeId: 'freeform:box', name: 'Inicio' });
    expect(ws.elements['B']).toMatchObject({ typeId: 'freeform:diamond', name: 'Decide?' });
    expect(ws.elements['C']!.typeId).toBe('freeform:ellipse');
    expect(ws.elements['D']!.typeId).toBe('freeform:cylinder');
    expect(ws.elements['G']!.typeId).toBe('freeform:note');
    expect(ws.elements['S1']).toMatchObject({ typeId: 'freeform:group', name: 'Backend' });
    expect(ws.elements['S2']).toMatchObject({ typeId: 'freeform:group', name: 'Datos' });
    const rels = Object.values(ws.relations);
    expect(rels.find(r => r.from.elementId === 'B' && r.to.elementId === 'C')).toMatchObject({ typeId: 'freeform:arrow', name: 'sí' });
    expect(rels.find(r => r.from.elementId === 'B' && r.to.elementId === 'D')).toMatchObject({ name: 'no' });
    expect(rels.filter(r => r.from.elementId === 'C').map(r => r.to.elementId).sort()).toEqual(['E', 'F']);
    expect(rels.find(r => r.from.elementId === 'C')!.typeId).toBe('freeform:dashed');
    expect(rels.find(r => r.from.elementId === 'D')!.typeId).toBe('freeform:line');
    expect(rels.find(r => r.from.elementId === 'G' && r.to.elementId === 'H')!.typeId).toBe('freeform:bidirectional');
  });

  it('anida los nodos en la vista y el layout es horizontal', () => {
    expect(ws.nodes['n:D']!.parentNodeId).toBe('n:S1');
    expect(ws.nodes['n:H']!.parentNodeId).toBe('n:S2');
    expect(ws.nodes['n:S2']!.parentNodeId).toBe('n:S1');
    expect(ws.nodes['n:B']!.x).toBeGreaterThan(ws.nodes['n:A']!.x);
    expect(ws.nodes['n:B']!.y).toBe(ws.nodes['n:A']!.y);
    const s1 = ws.nodes['n:S1']!, d = ws.nodes['n:D']!;
    expect(d.x + d.w).toBeLessThanOrEqual(s1.w);
    expect(Object.values(ws.edges).find(e => e.fromNodeId === 'n:B' && e.toNodeId === 'n:C')!.label).toBe('sí');
  });
});

describe('importMermaid (stateDiagram-v2)', () => {
  const { workspace: ws, warnings } = importMermaid(STATE);
  it('crea estados, pseudoestados, compuestos y transiciones parseadas', () => {
    expect(warnings).toEqual([]);
    expect(ws.views[MERMAID_VIEW_ID]!.notationId).toBe('statechart');
    expect(ws.elements['Running']).toMatchObject({ typeId: 'statechart:State', name: 'En marcha' });
    expect(ws.elements['Fork']!.typeId).toBe('statechart:Fork');
    expect(ws.elements['root._initial']!.typeId).toBe('statechart:Initial');
    expect(ws.elements['Running._initial']!.typeId).toBe('statechart:Initial');
    expect(ws.elements['Running._final']!.typeId).toBe('statechart:Final');
    expect(ws.nodes['n:Slow']!.parentNodeId).toBe('n:Running');
    expect(ws.nodes['n:Running._initial']!.parentNodeId).toBe('n:Running');
    const start = Object.values(ws.relations).find(r => r.from.elementId === 'Idle' && r.to.elementId === 'Running')!;
    expect(start.fields).toEqual({ event: 'START', guard: 'ok', actions: ['log', 'beep'] });
    expect(parseTransition('after 500ms / x')).toEqual({ event: '', guard: '', actions: ['x'], delay: '500ms' });
  });
});

describe('exportMermaid', () => {
  it('flowchart con formas, subgraphs y aristas; reimportable', () => {
    const ws = importMermaid(FLOW).workspace;
    const { text } = exportMermaid(ws, MERMAID_VIEW_ID);
    expect(text.startsWith('flowchart TD')).toBe(true);
    expect(text).toContain('B{"Decide?"}');
    expect(text).toContain('D[("Base de datos")]');
    expect(text).toContain('subgraph S1["Backend"]');
    expect(text).toContain('subgraph S2["Datos"]');
    expect(text).toContain('B -->|"sí"| C');
    expect(text).toContain('C -.-> E');
    expect(text).toContain('D --- G');
    expect(text).toContain('G <--> H');
    const again = importMermaid(text).workspace;
    expect(Object.keys(again.elements)).toHaveLength(Object.keys(ws.elements).length);
    expect(Object.keys(again.relations)).toHaveLength(Object.keys(ws.relations).length);
  });

  it('stateDiagram-v2 desde una máquina XState', () => {
    const ws = importXState({ id: 'luz', initial: 'verde', states: { verde: { on: { T: { target: 'amarillo', guard: 'g' } } }, amarillo: { on: { T: 'rojo' } }, rojo: { initial: 'a', states: { a: { on: { X: 'b' } }, b: { type: 'final' } }, on: { T: 'verde' } } } }).workspace;
    const { text } = exportMermaid(ws, Object.keys(ws.views)[0]!);
    expect(text.startsWith('stateDiagram-v2')).toBe(true);
    expect(text).toContain('[*] --> verde');
    expect(text).toContain('state rojo {');
    expect(text).toContain('[*] --> rojo_a');
    expect(text).toContain('rojo_a --> [*]: X');
    expect(text).toContain('verde --> amarillo: T [g]');
    expect(text).toContain('state "a" as rojo_a');
    const again = importMermaid(text).workspace;
    expect(again.elements['rojo_a']).toMatchObject({ typeId: 'statechart:State', name: 'a' });
    expect(again.nodes['n:rojo_a']!.parentNodeId).toBe('n:rojo');
  });

  it('rejilla: un subgraph por capa; ArchiMate: formas del pack', () => {
    const ws = importArchimate(exportArchimate(importArchimate(`<?xml version="1.0"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="m" id="m">
  <folder name="Business" id="fb" type="business"><element xsi:type="archimate:BusinessProcess" name="Vender" id="p"/><element xsi:type="archimate:BusinessActor" name="Cliente" id="a"/></folder>
  <folder name="Relations" id="fr" type="relations"><element xsi:type="archimate:AssignmentRelationship" id="r" source="a" target="p"/></folder>
  <folder name="Views" id="fv" type="diagrams"><element xsi:type="archimate:ArchimateDiagramModel" name="v" id="v">
    <child xsi:type="archimate:DiagramObject" id="na" archimateElement="a"><bounds x="0" y="0" width="120" height="55"/><sourceConnection xsi:type="archimate:Connection" id="c" source="na" target="np" archimateRelationship="r"/></child>
    <child xsi:type="archimate:DiagramObject" id="np" archimateElement="p"><bounds x="200" y="0" width="120" height="55"/></child>
  </element></folder>
</archimate:model>`).workspace).text).workspace;
    const { text } = exportMermaid(ws, 'v');
    expect(text).toContain('p("Vender")');
    expect(text).toContain('a["Cliente"]');
    expect(text).toContain('a --> p');

    const grid = importMermaid('flowchart TD\n  A --> B').workspace;
    grid.views['g'] = { id: 'g', kind: 'grid', notationId: 'grid', name: 'Rejilla', doc: '', style: {}, props: {}, grid: { layers: [{ id: 'l1', name: 'Negocio' }, { id: 'l2', name: 'Datos' }], stages: [{ id: 's1', name: 'E1' }], stageGroups: [] } };
    grid.nodes['ga'] = { id: 'ga', viewId: 'g', elementId: 'A', x: 0, y: 0, w: 160, h: 56, style: {}, cell: { layerId: 'l1', stageId: 's1' } };
    grid.nodes['gb'] = { id: 'gb', viewId: 'g', elementId: 'B', x: 0, y: 0, w: 160, h: 56, style: {}, cell: { layerId: 'l2', stageId: 's1' } };
    grid.edges['ge'] = { id: 'ge', viewId: 'g', relationId: Object.keys(grid.relations)[0]!, fromNodeId: 'ga', toNodeId: 'gb', bendpoints: [], style: {} };
    const g = exportMermaid(grid, 'g').text;
    expect(g).toContain('subgraph layer_l1["Negocio"]');
    expect(g).toContain('subgraph layer_l2["Datos"]');
    expect(g).toContain('A --> B');
  });
});
