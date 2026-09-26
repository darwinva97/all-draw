import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { exportDrawio, importMermaid, importXState, MERMAID_VIEW_ID } from '../src';

const parse = (xml: string) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: n => n === 'mxCell' || n === 'mxPoint' }).parse(xml);

describe('exportDrawio', () => {
  it('escribe vértices con forma, padres para contenedores y aristas ortogonales con puntos', () => {
    const ws = importMermaid('flowchart TD\n  A[Inicio] --> B{Decide?}\n  subgraph S[Grupo]\n    B -.->|no| C[(BD)]\n  end\n  C --- D((Fin))').workspace;
    const edge = Object.values(ws.edges).find(e => e.fromNodeId === 'n:A')!;
    edge.bendpoints = [{ x: 300, y: 40 }];
    const { text, warnings } = exportDrawio(ws, MERMAID_VIEW_ID);
    expect(warnings).toEqual([]);
    expect(text).toContain('<mxGraphModel');
    const cells: Record<string, string>[] = parse(text).mxfile.diagram.mxGraphModel.root.mxCell;
    const byId = Object.fromEntries(cells.map(c => [c.id, c]));
    expect(byId['0']).toBeDefined();
    expect(byId['1']!.parent).toBe('0');
    expect(byId['c_n_A']).toMatchObject({ vertex: '1', parent: '1', value: 'Inicio' });
    expect(byId['c_n_B']!.style).toContain('rhombus');
    expect(byId['c_n_C']!.style).toContain('shape=cylinder3');
    expect(byId['c_n_D']!.style).toContain('ellipse');
    expect(byId['c_n_S']!.style).toContain('container=1');
    expect(byId['c_n_B']!.parent).toBe('c_n_S');
    expect(byId['c_n_C']!.parent).toBe('c_n_S');
    const e = cells.find(c => c.edge === '1' && c.source === 'c_n_A')!;
    expect(e.target).toBe('c_n_B');
    expect(e.style).toContain('edgeStyle=orthogonalEdgeStyle');
    expect(e.style).toContain('endArrow=classic');
    expect(text).toContain('<mxPoint x="300" y="40"/>');
    const dashed = cells.find(c => c.edge === '1' && c.source === 'c_n_B')!;
    expect(dashed.style).toContain('dashed=1');
    expect(dashed.value).toBe('no');
    const line = cells.find(c => c.edge === '1' && c.source === 'c_n_C')!;
    expect(line.style).toContain('endArrow=none');
  });

  it('en rejilla crea celdas contenedoras y cuelga los nodos de su celda', () => {
    const ws = importMermaid('flowchart TD\n  A --> B').workspace;
    ws.views['g'] = { id: 'g', kind: 'grid', notationId: 'grid', name: 'Rejilla', doc: '', style: {}, props: {}, grid: { layers: [{ id: 'l1', name: 'Negocio' }], stages: [{ id: 's1', name: 'E1' }, { id: 's2', name: 'E2' }], stageGroups: [] } };
    ws.nodes['ga'] = { id: 'ga', viewId: 'g', elementId: 'A', x: 10, y: 10, w: 160, h: 56, style: {}, cell: { layerId: 'l1', stageId: 's1' } };
    ws.nodes['gb'] = { id: 'gb', viewId: 'g', elementId: 'B', x: 10, y: 10, w: 160, h: 56, style: {}, cell: { layerId: 'l1', stageId: 's2' } };
    const { text } = exportDrawio(ws, 'g');
    const cells: Record<string, string>[] = parse(text).mxfile.diagram.mxGraphModel.root.mxCell;
    const byId = Object.fromEntries(cells.map(c => [c.id, c]));
    expect(byId['c_layer_l1']!.value).toBe('Negocio');
    expect(byId['c_stage_s2']!.value).toBe('E2');
    expect(byId['c_ga']!.parent).toBe('c_cell_l1_s1');
    expect(byId['c_gb']!.parent).toBe('c_cell_l1_s2');
    expect(byId['c_cell_l1_s1']!.style).toContain('container=1');
  });

  it('usa colores y puntas del pack (statechart) y escapa HTML', () => {
    const ws = importXState({ id: 'm', initial: 'a', states: { a: { on: { GO: 'b' } }, b: { type: 'final', description: 'x<y' } } }).workspace;
    ws.elements['b']!.name = 'Fin & "cierre"';
    const { text } = exportDrawio(ws, Object.keys(ws.views)[0]!);
    expect(text).toContain('fillColor=#FFF2CC');
    expect(text).toContain('shape=doubleEllipse');
    expect(text).toContain('Fin &amp;amp; &amp;quot;cierre&amp;quot;');
    expect(() => exportDrawio(ws, 'nope')).toThrow(/No existe la vista/);
  });
});
