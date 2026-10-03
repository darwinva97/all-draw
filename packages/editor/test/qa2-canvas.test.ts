/**
 * QA2 · lienzo e interacción: compartimentos UML/ER (lienzo y SVG), figuras (diana, almacén DFD, tinta en oscuro),
 * opciones al conectar (agrupadas, ordenadas y explicadas), etiquetas de arista que no tapan nodos, encuadre sin zoom
 * al 400 %, Ctrl+0 centrado, pista de la vista vacía e iconos de tipo sin emoji ni texto suelto.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, makeEdge, derivePorts,
  type ElementType, type NotationPack, type ViewNode,
} from '@all-draw/core';
import { ARCHIMATE_PACK } from '../../notations/archimate/src';
import { BPMN_PACK } from '../../notations/bpmn/src';
import { STATECHART_PACK } from '../../notations/statechart/src';
import { UML_CLASS_PACK } from '../../notations/uml-class/src';
import { ER_PACK } from '../../notations/er/src';
import { C4_PACK } from '../../notations/c4/src';
import { DFD_PACK } from '../../notations/dfd/src';
import { FLOWCHART_PACK } from '../../notations/flowchart/src';
import { FREEFORM_PACK } from '../../notations/freeform/src';
import { SEQUENCE_PACK } from '../../notations/sequence/src';
import { MINDMAP_PACK } from '../../notations/mindmap/src';
import { GRID_PACK } from '../../notations/grid/src';
import { compartmentsOf, compartmentLayout, compartmentHeight, memberName, CMP } from '../src/nodes/compartments';
import { compartmentsOf as svgCompartmentsOf, compartmentLayout as svgCompartmentLayout, figureFor as svgFigureFor, renderSvg } from '../../io/src/svg';
import { figureFor, shapeColors, ShapeSvg, bullseye, isInk, DARK_INK } from '../src/nodes/shapes';
import { groupRelationOptions, pruneBridges, explainNoRelation, isBridgeRelation } from '../src/edges/relation-options';
import { placeLabel, labelSize, rectAround, overlap, LABEL_STOPS, LABEL_GAP } from '../src/edges/label-place';
import { ReactFlowProvider } from '@xyflow/react';
import { ElementNode, type ElementNodeData } from '../src/nodes/ElementNode';
import { NodeEnvContext, type NodeEnv } from '../src/nodes/env';
import { shapeStyle } from '../src/nodes/shapes';
import { defaultSize, fitPadding, fitViewport, zoomAroundCenter, exampleType, FIT_MAX_ZOOM, MINIMAP } from '../src/Canvas';

const ALL: NotationPack[] = [FREEFORM_PACK, GRID_PACK, ARCHIMATE_PACK, BPMN_PACK, STATECHART_PACK, C4_PACK, SEQUENCE_PACK, ER_PACK, UML_CLASS_PACK, MINDMAP_PACK, FLOWCHART_PACK, DFD_PACK];
const reg = () => { const r = new NotationRegistry().register(CORE_PACK); for (const p of ALL) r.register(p); return r; };
const tr = (k: string, v?: Record<string, string | number>) => k.replace(/\{(\w+)\}/g, (m, x: string) => (v && x in v ? String(v[x]) : m));
const typeOf = (id: string) => reg().elementType(id)!;

describe('compartimentos (fallo 4)', () => {
  const cls = makeElement('uml:Class', 'Pedido', { fields: { stereotype: 'entity', abstract: true, attributes: ['- fecha: Date', '- email: String', '- Email: Texto'], operations: ['+ total(): Money', '+ total(iva: Money): Money'] } });

  it('clase: «estereotipo», cursiva si es abstracta, atributos y operaciones; repetidos marcados (no la sobrecarga)', () => {
    const c = compartmentsOf(cls, typeOf('uml:Class'))!;
    expect(c.stereotype).toBe('entity');
    expect(c.italic).toBe(true);
    expect(c.sections.map(s => s.map(r => r.text))).toEqual([['- fecha: Date', '- email: String', '- Email: Texto'], ['+ total(): Money', '+ total(iva: Money): Money']]);
    expect(c.sections[0]!.map(r => !!r.dup)).toEqual([false, true, true]);
    expect(c.sections[1]!.some(r => r.dup)).toBe(false);
    expect(memberName('+ realizarPedido(): Pedido')).toBe('realizarpedido');
  });

  it('interfaz y enumeración llevan su estereotipo por defecto; la enumeración, sus literales', () => {
    const i = compartmentsOf(makeElement('uml:Interface', 'Pagable', { fields: { operations: ['+ pagar(): void'] } }), typeOf('uml:Interface'))!;
    expect(i.stereotype).toBe('interface');
    expect(i.sections).toHaveLength(1);
    const e = compartmentsOf(makeElement('uml:Enum', 'Estado', { fields: { values: ['PENDIENTE', 'PAGADO'] } }), typeOf('uml:Enum'))!;
    expect(e.stereotype).toBe('enumeration');
    expect(e.sections[0]!.map(r => r.text)).toEqual(['PENDIENTE', 'PAGADO']);
    // Sin compartimentos: el resto de tipos
    expect(compartmentsOf(makeElement('bpmn:Task', 'T'), typeOf('bpmn:Task'))).toBeUndefined();
  });

  it('entidad ER: una fila por atributo con su tipo y la clave primaria marcada; la clave de la fila es la del pin', () => {
    const ent = makeElement('er:Entity', 'Cliente', { fields: { attributes: [{ key: 'id', value: 'uuid' }, { key: 'email', value: 'text' }], pk: ['id'] } });
    const c = compartmentsOf(ent, typeOf('er:Entity'))!;
    expect(c.sections[0]).toEqual([{ text: 'id', detail: 'uuid', portKey: 'attributes.id', pk: true }, { text: 'email', detail: 'text', portKey: 'attributes.email', pk: undefined }]);
    const ports = derivePorts(ent, reg().fieldsOf('er:Entity')).map(p => p.key);
    for (const r of c.sections[0]!) expect(ports).toContain(r.portKey);
    // Atributos de clase UML: también pines, con la misma clave que `derivePorts`
    const umlPorts = derivePorts(cls, reg().fieldsOf('uml:Class')).map(p => p.key);
    expect(umlPorts).toContain(compartmentsOf(cls, typeOf('uml:Class'))!.sections[0]![0]!.portKey);
  });

  it('geometría: cabecera, secciones y alto mínimo; el SVG usa exactamente la misma', () => {
    const c = compartmentsOf(cls, typeOf('uml:Class'))!;
    const l = compartmentLayout(c);
    expect(l.headerH).toBe(CMP.pad * 2 + CMP.name + CMP.stereo);
    expect(l.sections[0]!.y).toBe(l.headerH);
    expect(l.sections[0]!.rows[1]!.cy - l.sections[0]!.rows[0]!.cy).toBe(CMP.row);
    expect(l.height).toBe(l.sections[1]!.y + l.sections[1]!.h + 2);
    expect(compartmentHeight(cls, typeOf('uml:Class'))).toBe(l.height);
    expect(svgCompartmentsOf(cls, typeOf('uml:Class'))).toEqual(c);
    expect(svgCompartmentLayout(c)).toEqual(l);
    // Sección vacía: una franja mínima (la clase sin operaciones sigue teniendo tres compartimentos)
    const empty = compartmentLayout(compartmentsOf(makeElement('uml:Class', 'X'), typeOf('uml:Class'))!);
    expect(empty.sections.map(s => s.h)).toEqual([CMP.emptySec, CMP.emptySec]);
  });

  it('SVG: filas, PK y el pin de cada atributo a la altura de su fila (la arista sale de la fila)', () => {
    const s = new MemoryStore();
    s.set('views', 'v', makeView('V', { id: 'v', notationId: 'er' }));
    const a = makeElement('er:Entity', 'Cliente', { id: 'ea', fields: { attributes: [{ key: 'id', value: 'uuid' }, { key: 'email', value: 'text' }], pk: ['id'] } });
    const b = makeElement('er:Entity', 'Pedido', { id: 'eb', fields: { attributes: [{ key: 'id', value: 'uuid' }, { key: 'cliente', value: 'uuid' }], pk: ['id'] } });
    s.set('elements', a.id, a); s.set('elements', b.id, b);
    s.set('nodes', 'na', makeNode('v', a.id, { x: 0, y: 0, w: 170, h: 40 }, { id: 'na' }));
    s.set('nodes', 'nb', makeNode('v', b.id, { x: 400, y: 0, w: 170, h: 40 }, { id: 'nb' }));
    const rel = makeRelation('er:OneToMany', { elementId: a.id, portId: 'ea#attributes.id' }, { elementId: b.id, portId: 'eb#attributes.cliente' }, { id: 'r' });
    s.set('relations', rel.id, rel);
    s.set('edges', 'e', makeEdge('v', rel.id, 'na', 'nb', { id: 'e', fromPortId: 'ea#attributes.id', toPortId: 'eb#attributes.cliente' }));
    const svg = renderSvg(s, reg(), 'v');
    expect(svg).toContain('class="ad-cls__row is-pk"');
    expect(svg).toContain('>PK</text>');
    expect(svg).toContain('>uuid</text>');
    // El nodo crece hasta que caben las filas (40 → alto del layout)
    const h = compartmentLayout(compartmentsOf(a, typeOf('er:Entity'))!).height;
    expect(svg).toMatch(new RegExp(`<rect class="ad-shape" x="0" y="0" width="170" height="${h}"`));
    const l = compartmentLayout(compartmentsOf(a, typeOf('er:Entity'))!);
    const yId = 1 + l.sections[0]!.rows[0]!.cy, yCliente = 1 + l.sections[0]!.rows[1]!.cy;
    const path = /data-edge="e"[^>]*>(?:<title>.*?<\/title>)?<path d="M ([\d.]+),([\d.]+)/.exec(svg)!;
    expect(Number(path[1])).toBe(170);
    expect(Number(path[2])).toBe(yId);
    expect(svg).toMatch(new RegExp(`L 400,${yCliente}"`));
    // Los pines de las filas no se dibujan como pines sueltos con etiqueta
    expect(svg).not.toContain('class="ad-port__label"');
  });
});

describe('figuras (fallo 1)', () => {
  it('estado final: diana (anillo vacío y punto) en el lienzo; un evento intermedio BPMN sigue con dos círculos', () => {
    const black = shapeColors(typeOf('statechart:Final'), { style: {} } as ViewNode, {});
    expect(bullseye(black.fill)).toBe(true);
    const html = renderToStaticMarkup(createElement(ShapeSvg, { shape: 'double-circle', fill: black.fill, stroke: black.stroke }));
    expect(html).toContain('r="30"');
    expect(html).toMatch(/r="47" fill="#fff"/);
    const ev = shapeColors(typeOf('bpmn:IntermediateCatchEvent'), { style: {} } as ViewNode, {});
    expect(renderToStaticMarkup(createElement(ShapeSvg, { shape: 'double-circle', fill: ev.fill, stroke: ev.stroke }))).toContain('r="38"');
  });

  it('tema oscuro: los pseudoestados negros usan tinta clara (relleno y trazo); con color propio, se respeta', () => {
    expect(isInk('#000000')).toBe(true);
    expect(isInk('#FFF2CC')).toBe(false);
    const dark = shapeColors(typeOf('statechart:Initial'), { style: {} } as ViewNode, {}, true);
    expect(dark).toEqual({ fill: DARK_INK, stroke: DARK_INK });
    expect(bullseye(dark.fill, true)).toBe(true);
    expect(shapeColors(typeOf('statechart:Initial'), { style: { fill: '#ff0000' } } as unknown as ViewNode, {}, true).fill).toBe('#ff0000');
  });

  it('almacén DFD: dos líneas paralelas con el nombre dentro, también en el SVG; tamaño propio', () => {
    expect(figureFor('dfd:DataStore', 'bar')).toBe('store');
    expect(svgFigureFor('dfd:DataStore', 'bar')).toBe('store');
    expect(figureFor('statechart:Fork', 'bar')).toBe('bar');
    expect(defaultSize('bar', false, 'dfd:DataStore')).toEqual({ w: 160, h: 44 });
    const html = renderToStaticMarkup(createElement(ShapeSvg, { shape: 'store', fill: '#F5F5F5', stroke: '#555' }));
    expect(html).toContain('M0,1 H100 M0,99 H100');
    const s = new MemoryStore();
    s.set('views', 'v', makeView('V', { id: 'v', notationId: 'dfd' }));
    const el = makeElement('dfd:DataStore', 'Clientes', { id: 'ds' });
    s.set('elements', el.id, el);
    s.set('nodes', 'n', makeNode('v', el.id, { x: 0, y: 0, w: 160, h: 44 }, { id: 'n' }));
    const svg = renderSvg(s, reg(), 'v');
    expect(svg).toContain('ad-shape-store');
    expect(svg).toContain('M0,1 H100 M0,99 H100');
    // El nombre va dentro (centro vertical del nodo), no debajo
    expect(svg).toMatch(/class="ad-node__label"[^>]*><tspan x="80" dy="0">Clientes/);
    expect(svg).not.toMatch(/y="5\d(\.\d+)?"[^>]*class="ad-node__label"/);
  });
});

describe('conectar: opciones y avisos (fallos 3 y 17)', () => {
  it('ArchiMate servicio → actor: primero las específicas en el orden de la especificación (Serving antes que Flow), Association al final; las genéricas aparte', () => {
    const r = reg();
    const opts = r.allowedRelations('archimate:BusinessService', 'archimate:BusinessActor');
    const g = groupRelationOptions(r, opts, 'archimate:BusinessService', ARCHIMATE_PACK.defaultRelation);
    expect(g.native.indexOf('archimate:Serving')).toBeLessThan(g.native.indexOf('archimate:Flow'));
    expect(g.native.at(-1)).toBe('archimate:Association');
    expect(g.native.every(o => !isBridgeRelation(r, o))).toBe(true);
    expect(g.bridge).toEqual(expect.arrayContaining(['core:trace', 'core:link']));
  });

  it('la habitual de la notación va arriba (BPMN: flujo de secuencia; UML: asociación)', () => {
    const r = reg();
    const g = groupRelationOptions(r, r.allowedRelations('uml:Class', 'uml:Class'), 'uml:Class', UML_CLASS_PACK.defaultRelation);
    expect(g.native[0]).toBe('uml:Association');
    const b = groupRelationOptions(r, r.allowedRelations('bpmn:Task', 'bpmn:Task'), 'bpmn:Task', BPMN_PACK.defaultRelation);
    expect(b.native[0]).toBe('bpmn:SequenceFlow');
  });

  it('entre tipos que la matriz prohíbe no se ofrecen las genéricas (Final → Inicial); entre pines o entre notaciones, sí', () => {
    const r = reg();
    const opts = r.allowedRelations('statechart:Final', 'statechart:Initial');
    expect(opts.every(o => isBridgeRelation(r, o))).toBe(true);
    expect(pruneBridges(r, 'statechart:Final', 'statechart:Initial', opts, false)).toEqual([]);
    expect(pruneBridges(r, 'statechart:Final', 'statechart:Initial', opts, true)).toEqual(opts);
    const cross = r.allowedRelations('bpmn:Task', 'archimate:BusinessProcess');
    expect(pruneBridges(r, 'bpmn:Task', 'archimate:BusinessProcess', cross, false)).toEqual(cross);
    const ok = r.allowedRelations('statechart:State', 'statechart:State');
    expect(pruneBridges(r, 'statechart:State', 'statechart:State', ok, false)).toEqual(ok);
  });

  it('el aviso explica qué permite la matriz: al revés, con qué tipos se conecta el origen, o que no puede ser origen', () => {
    const r = reg();
    const fin = explainNoRelation(r, tr, 'statechart:Final', 'statechart:Initial');
    expect(fin.title).toBe('No hay relaciones válidas de «Final» a «Inicial» en Máquina de estados');
    expect(fin.description).toMatch(/«Final» no puede ser origen/);
    const back = explainNoRelation(r, tr, 'statechart:State', 'statechart:Initial');
    expect(back.description).toMatch(/^Al revés sí: /);
    const pools = explainNoRelation(r, tr, 'bpmn:Task', 'bpmn:Task', true);
    expect(pools.description).toMatch(/pool/);
  });
});

describe('etiquetas de arista (fallo 72)', () => {
  const line = (x0: number, x1: number, y: number) => LABEL_STOPS.map(t => ({ x: x0 + (x1 - x0) * t, y, dx: 1, dy: 0 }));
  it('en el centro si no tapa nada; si tapa un nodo o una etiqueta, en el primer punto libre del recorrido', () => {
    const size = labelSize('datos completos');
    expect(placeLabel(line(0, 400, 100), size, [])).toEqual({ x: 200, y: 100 });
    const node = { x: 150, y: 80, w: 100, h: 40 };
    const p = placeLabel(line(0, 400, 100), size, [node]);
    expect(overlap(rectAround(p, size), node)).toBe(0);
    const other = rectAround({ x: 200, y: 100 }, size);
    const q = placeLabel(line(0, 400, 100), size, [], [other]);
    expect(overlap(rectAround(q, { w: size.w + LABEL_GAP * 2, h: size.h + LABEL_GAP * 2 }), other)).toBe(0);
  });

  it('arista corta entre dos nodos: la etiqueta se aparta a un lado de la línea en vez de tapar los nodos', () => {
    const size = labelSize('datos completos');
    const a = { x: 0, y: 75, w: 140, h: 50 }, b = { x: 200, y: 75, w: 140, h: 50 };
    const p = placeLabel(line(140, 200, 100), size, [a, b]);
    expect(overlap(rectAround(p, size), a) + overlap(rectAround(p, size), b)).toBe(0);
    expect(Math.abs(p.x - 170)).toBeLessThan(1);
  });
});

describe('encuadre y zoom (fallos 2, 66 y 76)', () => {
  const rfNode = (id: string, x: number, y: number, w: number, h: number) => ({ id, position: { x, y }, width: w, height: h, data: {} });
  it('vista vacía: sin encuadre; un nodo pequeño no se amplía por encima del 100 %', () => {
    expect(fitViewport([], 1000, 800)).toBeUndefined();
    const vp = fitViewport([rfNode('a', 0, 0, 40, 40)], 1000, 800)!;
    expect(vp.zoom).toBe(FIT_MAX_ZOOM);
    expect(FIT_MAX_ZOOM).toBe(1);
  });

  it('con minimapa, el encuadre reserva su alto abajo para que no tape los nodos de la esquina', () => {
    const p = fitPadding(1000, 800, true);
    expect(parseInt(p.bottom)).toBeGreaterThanOrEqual(MINIMAP.h + 24);
    expect(parseInt(fitPadding(1000, 800, false).bottom)).toBe(parseInt(p.top));
    const vp = fitViewport([rfNode('a', 0, 0, 2000, 1500)], 1000, 800, true)!;
    // El borde inferior del contenido queda por encima del minimapa
    expect(1500 * vp.zoom + vp.y).toBeLessThanOrEqual(800 - MINIMAP.h - 24 + 1);
  });

  it('Ctrl+0: 100 % alrededor del centro de lo que se ve', () => {
    const vp = { x: -160, y: -385, zoom: 4 };
    const w = 800, h = 600;
    const center = { x: (w / 2 - vp.x) / vp.zoom, y: (h / 2 - vp.y) / vp.zoom };
    const out = zoomAroundCenter(vp, w, h, 1);
    expect(out.zoom).toBe(1);
    expect((w / 2 - out.x) / out.zoom).toBeCloseTo(center.x);
    expect((h / 2 - out.y) / out.zoom).toBeCloseTo(center.y);
  });
});

describe('vista vacía (fallo 69) y tipos sin repetir (fallo 73)', () => {
  it('SVG: un nodo cuyo nombre es el del tipo no repite el tipo debajo («Tarea / Tarea»)', () => {
    const s = new MemoryStore();
    s.set('views', 'v', makeView('V', { id: 'v', notationId: 'bpmn' }));
    const a = makeElement('bpmn:Task', 'Tarea', { id: 'a' }), b = makeElement('bpmn:Task', 'Revisar', { id: 'b' });
    s.set('elements', a.id, a); s.set('elements', b.id, b);
    s.set('nodes', 'na', makeNode('v', a.id, { x: 0, y: 0, w: 160, h: 70 }, { id: 'na' }));
    s.set('nodes', 'nb', makeNode('v', b.id, { x: 300, y: 0, w: 160, h: 70 }, { id: 'nb' }));
    const svg = renderSvg(s, reg(), 'v');
    expect(svg.match(/>Tarea</g)?.length).toBe(2); // «Tarea» (nombre de a) + tipo de b
  });

  it('el tipo de ejemplo de la pista es uno de contenido (Estado, Tarea), no un pseudoestado ni una pool', () => {
    expect(exampleType(STATECHART_PACK)?.id).toBe('statechart:State');
    expect(exampleType(BPMN_PACK)?.id).toBe('bpmn:Task');
    expect(exampleType(UML_CLASS_PACK)?.id).toBe('uml:Class');
  });
});

describe('iconos de tipo (fallos 61 y 77)', () => {
  it('ningún tipo usa emoji (sin fuente de emoji se ven como ▯) ni un nombre en texto como icono', () => {
    const bad: string[] = [];
    for (const p of ALL) for (const t of p.elementTypes as ElementType[]) {
      const icon = t.icon ?? '';
      if (/[\u{1F000}-\u{1FFFF}]/u.test(icon) || /[a-z]{3,}/i.test(icon)) bad.push(`${t.id}: ${icon}`);
    }
    expect(bad).toEqual([]);
    expect(C4_PACK.elementTypes.find(t => t.id === 'c4:DeploymentNode')?.icon).not.toBe('deployment-node');
  });
});

/** Pinta un `ElementNode` (sin lienzo: proveedor de React Flow y entorno mínimo). */
function renderNode(typeId: string, name: string, extra: { fields?: Record<string, unknown>; style?: Record<string, unknown>; dimmed?: boolean; w?: number; h?: number } = {}): string {
  const type = typeOf(typeId);
  const el = makeElement(typeId, name, { fields: extra.fields ?? {} });
  const vn = makeNode('v', el.id, { x: 0, y: 0, w: extra.w ?? 160, h: extra.h ?? 60 }, { style: (extra.style ?? {}) as ViewNode['style'] });
  const data: ElementNodeData = { node: vn, element: el, type, rule: {}, ports: derivePorts(el, reg().fieldsOf(typeId)), archimate: false, dimmed: extra.dimmed };
  const env = { registry: reg(), readOnly: true, dark: false, lowDetail: false, run: () => {}, setRenaming: () => {} } as unknown as NodeEnv;
  const props = { id: 'n', data, selected: false, type: 'element', dragging: false, zIndex: 0, isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: false, selectable: true, draggable: true };
  return renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(NodeEnvContext.Provider, { value: env }, createElement(ElementNode as unknown as (p: typeof props) => null, props))));
}

describe('nodo del lienzo (fallos 4, 73, 35/40 y atenuado)', () => {
  it('clase UML: compartimentos con filas y un pin por atributo a la altura de su fila', () => {
    const html = renderNode('uml:Class', 'Cliente', { fields: { attributes: ['- nombre: String', '- email: String'], operations: ['+ pedir(): void'] } });
    expect(html).toContain('ad-node--cls');
    expect(html.match(/class="ad-cls__row/g)?.length).toBe(3);
    const l = compartmentLayout(compartmentsOf(makeElement('uml:Class', 'Cliente', { fields: { attributes: ['- nombre: String', '- email: String'], operations: ['+ pedir(): void'] } }), typeOf('uml:Class'))!);
    expect(html).toContain(`top:${l.sections[0]!.rows[1]!.cy}px`);
    expect(html).toMatch(/ad-handle--row/);
  });

  it('sin nombre propio («Tarea» de tipo Tarea) no repite el tipo debajo', () => {
    expect(renderNode('bpmn:Task', 'Tarea')).not.toContain('ad-node__type');
    expect(renderNode('bpmn:Task', 'Revisar')).toContain('ad-node__type');
  });

  it('`labelPosition` del importador: `top` arriba (contenedor de Archi), `bottom` bajo la figura con el icono dentro', () => {
    expect(renderNode('bpmn:Task', 'Grupo', { style: { labelPosition: 'top' } })).toContain('ad-node--label-top');
    const below = renderNode('bpmn:DataObject', 'Pedido', { style: { labelPosition: 'bottom' }, w: 36, h: 50 });
    expect(below).toContain('ad-node--label-bottom');
    expect(below).toContain('ad-node__icon--alone');
    expect(below).not.toContain('ad-node__type');
    expect(renderNode('bpmn:DataObject', 'Pedido')).not.toMatch(/ad-node--label-/);
  });

  it('atenuado: sin opacidad en línea (la clase `.is-dimmed` manda); con opacidad propia, se combinan', () => {
    expect(shapeStyle('rect', typeOf('bpmn:Task'), { w: 10, h: 10, style: {} } as unknown as ViewNode, {}).opacity).toBeUndefined();
    expect(shapeStyle('rect', typeOf('bpmn:Task'), { w: 10, h: 10, style: {} } as unknown as ViewNode, { opacity: 0.5 }).opacity).toBe(0.5);
    const dim = renderNode('bpmn:Task', 'Revisar', { dimmed: true });
    expect(dim).toContain('is-dimmed');
    expect(dim).not.toMatch(/style="[^"]*opacity/);
    expect(renderNode('bpmn:Task', 'Revisar', { dimmed: true, style: { opacity: 0.8 } })).toMatch(/opacity:0\.36/);
  });
});
