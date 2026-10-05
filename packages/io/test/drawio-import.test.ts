import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { parseWorkspace, type Workspace } from '@all-draw/core';
import { importDrawio, exportDrawio, decodeDrawioDiagram, htmlToText, isDrawio, importMermaid, importAny, detectFormat, MERMAID_VIEW_ID } from '../src';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const byName = (ws: Workspace, name: string) => Object.values(ws.elements).find(e => e.name === name)!;
const nodeOf = (ws: Workspace, name: string) => Object.values(ws.nodes).find(n => n.elementId === byName(ws, name)?.id)!;

describe('importDrawio', () => {
  const { workspace: ws, warnings } = importDrawio(fixture('varias-paginas.drawio'));

  it('es un espacio válido con una vista por página', () => {
    expect(() => parseWorkspace(ws)).not.toThrow();
    expect(Object.values(ws.views).map(v => v.name)).toEqual(['Flujo', 'Proceso BPMN', 'ArchiMate', 'Clases y datos']);
    expect(Object.values(ws.views).map(v => v.notationId)).toEqual(['freeform', 'bpmn', 'archimate', 'uml']);
  });

  it('formas básicas, etiquetas HTML y colores', () => {
    expect(byName(ws, 'Rectángulo').typeId).toBe('lib:lib_drawio:rect');
    expect(ws.libraries['lib_drawio']?.elementTypes.map(t => t.shape)).toContain('rect');
    expect(byName(ws, 'Paso\ndos líneas').typeId).toBe('freeform:box');
    expect(byName(ws, 'Elipse').typeId).toBe('freeform:ellipse');
    expect(byName(ws, '¿Válido?').typeId).toBe('freeform:diamond');
    expect(byName(ws, 'Base de datos').typeId).toBe('freeform:cylinder');
    expect(byName(ws, 'Cliente').typeId).toBe('freeform:actor');
    expect(byName(ws, 'Una nota\nde dos líneas').typeId).toBe('freeform:note');
    expect(byName(ws, 'Hexágono').typeId).toBe('lib:lib_drawio:hexagon');
    const rect = nodeOf(ws, 'Rectángulo');
    expect(rect).toMatchObject({ x: 40, y: 40, w: 120, h: 60, style: { fill: '#dae8fc', stroke: '#6c8ebf' } });
    // blanco por defecto de draw.io: sin relleno (sigue al tema); color de texto sí
    expect(nodeOf(ws, 'Paso\ndos líneas').style).toEqual({ text: '#990000' });
  });

  it('contenedores y grupos anidan con coordenadas relativas', () => {
    const lane = nodeOf(ws, 'Contenedor');
    expect(byName(ws, 'Contenedor').typeId).toBe('freeform:group');
    const a = nodeOf(ws, 'Dentro A');
    expect(a.parentNodeId).toBe(lane.id);
    expect([a.x, a.y]).toEqual([20, 50]);
    const g1 = nodeOf(ws, 'G1');
    const group = ws.nodes[g1.parentNodeId!]!;
    expect(group.visualType).toBe('core:group');
    expect(nodeOf(ws, 'G2').x).toBe(200);
    const txt = Object.values(ws.nodes).find(n => n.text === 'Texto suelto')!;
    expect(txt.visualType).toBe('core:label');
  });

  it('UserObject: propiedades y tooltip como documentación', () => {
    const el = byName(ws, 'Con propiedades');
    expect(el.props).toEqual({ owner: 'Ana' });
    expect(el.doc).toBe('Explicación en HTML');
  });

  it('aristas: etiqueta, puntos absolutos (también dentro de un contenedor), estilo y avisos', () => {
    const edges = Object.values(ws.edges);
    const e1 = edges.find(e => e.id.endsWith('_e1'))!;
    expect(ws.relations[e1.relationId!]).toMatchObject({ typeId: 'freeform:arrow', name: 'sigue' });
    const e2 = edges.find(e => e.id.endsWith('_e2'))!;
    expect(e2.bendpoints).toEqual([{ x: 300, y: 130 }, { x: 310, y: 140 }]);
    expect(e2.style).toMatchObject({ color: '#b85450', width: 2 });
    const e3 = edges.find(e => e.id.endsWith('_e3'))!;
    expect(ws.relations[e3.relationId!]).toMatchObject({ typeId: 'freeform:dashed', name: 'consulta' });
    expect(e3.style.router).toBe('straight');
    const e4 = edges.find(e => e.id.endsWith('_e4'))!;
    expect(ws.relations[e4.relationId!]!.typeId).toBe('freeform:bidirectional');
    expect(e4.bendpoints).toEqual([{ x: 200, y: 360 }]);
    expect(warnings.some(w => /sin origen o sin destino/.test(w))).toBe(true);
    expect(warnings.some(w => /mxgraph\.aws4\.resourceIcon/.test(w))).toBe(true);
  });

  it('BPMN: pool, carriles, eventos, tareas, compuerta, datos y flujos', () => {
    expect(byName(ws, 'Tienda').typeId).toBe('bpmn:Pool');
    expect(byName(ws, 'Ventas').typeId).toBe('bpmn:Lane');
    expect(nodeOf(ws, 'Ventas').parentNodeId).toBe(nodeOf(ws, 'Tienda').id);
    expect(byName(ws, 'Pedido recibido')).toMatchObject({ typeId: 'bpmn:StartEvent', fields: { eventDefinition: 'message' } });
    expect(byName(ws, 'Revisar pedido')).toMatchObject({ typeId: 'bpmn:Task', fields: { taskType: 'user' } });
    expect(byName(ws, '¿Stock?').typeId).toBe('bpmn:ExclusiveGateway');
    expect(byName(ws, 'Enviar').fields).toEqual({ taskType: 'service' });
    expect(byName(ws, 'Fin')).toMatchObject({ typeId: 'bpmn:EndEvent', fields: { eventDefinition: 'terminate' } });
    expect(byName(ws, 'Albarán').typeId).toBe('bpmn:DataObject');
    const rels = Object.values(ws.relations).filter(r => r.typeId.startsWith('bpmn:'));
    expect(rels.filter(r => r.typeId === 'bpmn:SequenceFlow')).toHaveLength(4);
    expect(rels.filter(r => r.typeId === 'bpmn:Association')).toHaveLength(1);
    expect(rels.find(r => r.name === 'sí')).toBeDefined();
  });

  it('ArchiMate 3: tipo por figura y capa (color de la paleta), relaciones por su dibujo', () => {
    expect(byName(ws, 'Cliente', ).typeId).toBe('freeform:actor');
    const archi = (n: string) => Object.values(ws.elements).find(e => e.name === n && e.typeId.startsWith('archimate:'))?.typeId;
    expect(archi('Cliente')).toBe('archimate:BusinessActor');
    expect(archi('Comprar')).toBe('archimate:BusinessProcess');
    expect(archi('Catálogo')).toBe('archimate:ApplicationService');
    expect(archi('Tienda web')).toBe('archimate:ApplicationComponent');
    expect(archi('Servidor')).toBe('archimate:Node');
    // color fuera de la paleta: capa dudosa → forma libre con aviso
    expect(byName(ws, '¿Proceso?').typeId).toBe('lib:lib_drawio:rect');
    expect(warnings.some(w => /sin capa reconocible/.test(w))).toBe(true);
    // el relleno de la paleta no se copia al nodo
    const n = Object.values(ws.nodes).find(x => ws.elements[x.elementId ?? '']?.typeId === 'archimate:BusinessProcess')!;
    expect(n.style.fill).toBeUndefined();
    const types = Object.values(ws.relations).filter(r => r.typeId.startsWith('archimate:')).map(r => r.typeId).sort();
    expect(types).toEqual(['archimate:Assignment', 'archimate:Realization', 'archimate:Serving', 'archimate:Serving']);
  });

  it('UML (clase, interfaz) y ER (tablas con PK y relación entre atributos)', () => {
    expect(byName(ws, 'Pedido')).toMatchObject({ typeId: 'uml:Class', fields: { attributes: ['- id: int', '- total: decimal'], operations: ['+ pagar(): void'] } });
    expect(byName(ws, 'Pagable')).toMatchObject({ typeId: 'uml:Interface', fields: { operations: ['+ pagar(): void'] } });
    expect(Object.values(ws.relations).find(r => r.typeId === 'uml:Realization')).toBeDefined();
    // las filas no son nodos
    expect(Object.values(ws.nodes).some(n => n.id.endsWith('_cls1'))).toBe(false);
    const cli = byName(ws, 'Cliente');
    expect(Object.values(ws.elements).filter(e => e.typeId === 'er:Entity').map(e => e.name).sort()).toEqual(['Cliente', 'Factura']);
    const ent = Object.values(ws.elements).find(e => e.typeId === 'er:Entity' && e.name === 'Cliente')!;
    expect(ent.fields).toEqual({ attributes: [{ key: 'id', value: '' }, { key: 'nombre', value: '' }], pk: ['id'] });
    const fk = Object.values(ws.relations).find(r => r.typeId.startsWith('er:'))!;
    expect(fk).toMatchObject({ typeId: 'er:OneToMany', fields: { sourceCard: '1..1', targetCard: '0..*' } });
    expect(fk.from.portId).toBe(`${ent.id}#attributes.id`);
    expect(cli).toBeDefined();
  });
});

describe('draw.io comprimido', () => {
  it('descomprime cada página (deflate raw + base64 + URI) y da el mismo resultado', () => {
    const plain = importDrawio(fixture('varias-paginas.drawio')).workspace;
    const packed = importDrawio(fixture('comprimido.drawio')).workspace;
    expect(Object.keys(packed.elements).sort()).toEqual(Object.keys(plain.elements).sort());
    expect(Object.values(packed.nodes).map(n => [n.x, n.y, n.w, n.h])).toEqual(Object.values(plain.nodes).map(n => [n.x, n.y, n.w, n.h]));
  });

  it('decodeDrawioDiagram y página dañada con aviso', () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Á é" vertex="1" parent="1"><mxGeometry x="1" y="2" width="3" height="4" as="geometry"/></mxCell></root></mxGraphModel>';
    const data = deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString('base64');
    expect(decodeDrawioDiagram(data)).toBe(xml);
    const r = importDrawio(`<mxfile><diagram name="Buena">${data}</diagram><diagram name="Rota">no-es-base64!!</diagram></mxfile>`);
    expect(Object.values(r.workspace.elements)[0]!.name).toBe('Á é');
    expect(r.warnings.join()).toMatch(/Rota/);
  });

  it('SVG editable de draw.io (atributo content) y mxGraphModel suelto', () => {
    const inner = fixture('varias-paginas.drawio').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" content="${inner}"><g/></svg>`;
    expect(isDrawio(svg)).toBe(true);
    expect(Object.keys(importDrawio(svg).workspace.views)).toHaveLength(4);
    const model = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Solo" style="ellipse" vertex="1" parent="1"><mxGeometry width="80" height="80" as="geometry"/></mxCell></root></mxGraphModel>';
    expect(Object.values(importDrawio(model).workspace.elements)[0]).toMatchObject({ name: 'Solo', typeId: 'freeform:ellipse' });
  });

  it('htmlToText', () => {
    expect(htmlToText('<div><b>Hola</b></div><div>mundo&nbsp;&amp; más</div>')).toBe('Hola\nmundo & más');
    expect(htmlToText('a<br/>b<br>c')).toBe('a\nb\nc');
  });
});

describe('ida y vuelta con exportDrawio', () => {
  it('conserva nombres, tipos, anidamiento, aristas, etiquetas y puntos', () => {
    const src = importMermaid('flowchart TD\n  A[Inicio] --> B{Decide?}\n  subgraph S[Grupo]\n    B -.->|no| C[(BD)]\n  end\n  C --- D((Fin))').workspace;
    const edge = Object.values(src.edges).find(e => e.fromNodeId === 'n:A')!;
    edge.bendpoints = [{ x: 300, y: 40 }];
    src.nodes['n:A']!.style = { fill: '#ff0000' };
    const back = importDrawio(exportDrawio(src, MERMAID_VIEW_ID).text).workspace;
    const names = (ws: Workspace) => Object.values(ws.elements).map(e => `${e.name}|${e.typeId}`).sort();
    expect(names(back)).toEqual(names(src));
    const nb = Object.values(back.nodes).find(n => back.elements[n.elementId!]?.name === 'Decide?')!;
    const ns = Object.values(back.nodes).find(n => back.elements[n.elementId!]?.name === 'Grupo')!;
    expect(nb.parentNodeId).toBe(ns.id);
    const rels = Object.values(back.relations).map(r => `${back.elements[r.from.elementId!]!.name}->${back.elements[r.to.elementId!]!.name}:${r.typeId}:${r.name}`).sort();
    const srels = Object.values(src.relations).map(r => `${src.elements[r.from.elementId!]!.name}->${src.elements[r.to.elementId!]!.name}:${r.typeId}:${r.name}`).sort();
    expect(rels).toEqual(srels);
    const be = Object.values(back.edges).find(e => back.elements[back.nodes[e.fromNodeId]!.elementId!]!.name === 'Inicio')!;
    expect(be.bendpoints).toEqual([{ x: 300, y: 40 }]);
    expect(Object.values(back.nodes).find(n => back.elements[n.elementId!]?.name === 'Inicio')!.style.fill).toBe('#ff0000');
    for (const n of Object.values(src.nodes)) {
      const m = Object.values(back.nodes).find(x => back.elements[x.elementId!]?.name === src.elements[n.elementId!]!.name)!;
      expect([m.x, m.y, m.w, m.h]).toEqual([Math.round(n.x), Math.round(n.y), Math.round(n.w), Math.round(n.h)]);
    }
  });
});

describe('detección e importAny', () => {
  it('reconoce draw.io (también comprimido) y lo importa', async () => {
    expect(detectFormat(fixture('comprimido.drawio'))).toBe('drawio');
    expect(detectFormat('<mxGraphModel/>', 'x.xml')).toBe('drawio');
    const r = await importAny(fixture('comprimido.drawio'), 'mi-diagrama.drawio');
    expect(r.format).toBe('drawio');
    expect(r.formatLabel).toBe('draw.io');
    expect(r.workspace.meta.name).toBe('mi-diagrama');
  });
});
