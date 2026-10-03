/**
 * QA 2026-10-03, importar y exportar: fallos 6, 7, 34–37, 39–41, 58, 60 y 82 (los de la interfaz están en
 * `apps/web/src/importexport.test.ts`). Los ficheros de `fixtures/` son los de la sesión de QA.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryStore, NotationRegistry, CORE_PACK, emptyWorkspace, makeElement, makeNode, makeRelation, makeEdge, makeView, type Workspace, type NotationPack } from '@all-draw/core';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { GRID_PACK } from '@all-draw/notation-grid';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { importAny, importArchimate, exportArchimate, importOpenExchange, exportOpenExchange, renderSvg, exportMermaid, importMermaid, detectFormat, sequenceGeometry, fileStem, ImportError } from '../src';

const fixture = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');
const SEQUENCE_PACK: NotationPack = { id: 'sequence', name: 'Secuencia', version: '0', viewKind: 'sequence', categories: [], elementTypes: [
  { id: 'sequence:Lifeline', name: 'Línea de vida', category: 'p', fields: [] }, { id: 'sequence:Activation', name: 'Activación', category: 'p', fields: [] },
  { id: 'sequence:Fragment', name: 'Fragmento', category: 'p', fields: [] }, { id: 'sequence:Note', name: 'Nota', category: 'p', shape: 'note', fields: [] },
], relationTypes: [{ id: 'sequence:Message', name: 'Mensaje', category: 'p', fields: [] }, { id: 'sequence:Return', name: 'Respuesta', category: 'p', line: 'dashed', fields: [] }], portTypes: [], viewpoints: [] };
const reg = () => new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK).register(GRID_PACK).register(STATECHART_PACK).register(SEQUENCE_PACK);

/** Pago: cliente (actor) → tienda (participante) → API, respuesta, mensaje a sí mismo, destrucción, activación y `alt`. */
function sequenceWs(): { ws: Workspace; viewId: string; ids: Record<string, string> } {
  const ws = emptyWorkspace('Seq');
  const v = makeView('Pago', { notationId: 'sequence', kind: 'sequence' }); ws.views[v.id] = v;
  const add = <T extends { id: string }>(c: keyof Workspace, x: T) => { (ws[c] as Record<string, T>)[x.id] = x; return x; };
  const life = (name: string, kind: string, x: number) => { const e = add('elements', makeElement('sequence:Lifeline', name, { fields: { kind } })); return add('nodes', makeNode(v.id, e.id, { x, y: 0, w: 140, h: 60 })); };
  const a = life('Cliente', 'actor', 40), b = life('Tienda', 'participant', 260), c = life('API', 'control', 480);
  const act = add('elements', makeElement('sequence:Activation', 'proceso', { fields: { label: 'procesar' } }));
  const actNode = add('nodes', makeNode(v.id, act.id, { x: 0, y: 140, w: 12, h: 120 }, { parentNodeId: c.id }));
  const frag = add('elements', makeElement('sequence:Fragment', 'alt', { fields: { kind: 'alt', condition: '[hay stock]' } }));
  const fragNode = add('nodes', makeNode(v.id, frag.id, { x: 240, y: 180, w: 400, h: 90 }));
  const msg = (from: typeof a, to: typeof a, order: number, text: string, kind = 'sync', y?: number, typeId = 'sequence:Message') => {
    const r = add('relations', makeRelation(typeId, { elementId: from.elementId! }, { elementId: to.elementId! }, { fields: typeId === 'sequence:Return' ? { order, text } : { kind, order, text } }));
    return add('edges', makeEdge(v.id, r.id, from.id, to.id, y === undefined ? {} : { bendpoints: [{ x: 0, y }] }));
  };
  const m1 = msg(a, b, 1, 'paga', 'sync', 110);
  msg(b, c, 2, 'POST /pagos', 'sync', 150);
  msg(c, c, 3, 'validar', 'sync');                         // sin altura: 40 px bajo el anterior
  msg(c, b, 4, 'ok', 'sync', 240, 'sequence:Return');
  msg(b, a, 5, 'recibo', 'async', 300);
  msg(a, b, 6, 'cerrar', 'destroy', 340);
  return { ws, viewId: v.id, ids: { a: a.id, b: b.id, c: c.id, act: actNode.id, frag: fragNode.id, m1: m1.id } };
}

describe('fallo 6: secuencia en SVG (líneas de vida, mensajes por orden, activaciones y fragmentos)', () => {
  it('geometría: mensajes por orden y altura (explícita o 40 px bajo el anterior)', () => {
    const { ws, viewId } = sequenceWs();
    const g = sequenceGeometry(new MemoryStore(ws), viewId);
    expect(g.lifelines.map(l => l.x)).toEqual([40, 260, 480]);
    expect(g.messages.map(m => [m.order, m.y])).toEqual([[1, 110], [2, 150], [3, 190], [4, 240], [5, 300], [6, 340]]);
    expect(g.messages[2]!.self).toBe(true);
    expect(g.messages.map(m => m.kind)).toEqual(['sync', 'sync', 'sync', 'return', 'async', 'destroy']);
  });

  it('pinta cabeceras, líneas discontinuas, mensajes horizontales con «orden: texto», activación y `alt`', () => {
    const { ws, viewId, ids } = sequenceWs();
    const svg = renderSvg(new MemoryStore(ws), reg(), viewId, { theme: 'light' });
    expect(svg.match(/class="ad-seq-line"/g)).toHaveLength(3);
    // Participante con caja; actor y control con su figura (sin caja)
    expect(svg.match(/class="ad-seq-head"/g)).toHaveLength(1);
    expect(svg.match(/class="ad-seq-icon"/g)).toHaveLength(2);
    // Mensaje 1: de centro a centro (110 → 330) a la altura 110; la punta llena acaba en el centro del destino
    expect(svg).toMatch(/<path d="M110,110 L320,110"/);
    expect(svg).toContain('1: paga');
    expect(svg).toContain('4: ok');
    expect(svg).toMatch(/stroke-dasharray="7 5"/);            // la respuesta, discontinua
    expect(svg).toMatch(/H590 V214/);                          // a sí mismo: escalón de 40×24 a la derecha
    // Activación centrada en la línea de vida de la API (480 + 64) y el fragmento con su operador y condición
    expect(svg).toContain(`data-node="${ids.act}"`);
    expect(svg).toMatch(/<rect class="ad-seq-act" x="544" y="140" width="12" height="120"/);
    expect(svg).toMatch(/class="ad-seq-op"[^>]*><tspan[^>]*>alt</);
    expect(svg).toContain('[hay stock]');
    // Ni cajas genéricas para las líneas de vida ni aristas ortogonales para los mensajes
    expect(svg).not.toMatch(/class="ad-edge"[^>]*data-edge=/);
    expect(svg.match(/data-type="sequence:Lifeline"/g)).toHaveLength(3);
  });

  it('en oscuro y en dual lleva sus variables de color', () => {
    const { ws, viewId } = sequenceWs();
    const dark = renderSvg(new MemoryStore(ws), reg(), viewId, { theme: 'dark' });
    expect(dark).toContain('--ad-seq-head:#1f2c44');
    const dual = renderSvg(new MemoryStore(ws), reg(), viewId, { theme: 'dual' });
    expect(dual).toMatch(/@media \(prefers-color-scheme: dark\)\{svg\.ad-svg:not\(\[data-theme="light"\]\)\{--ad-seq-head:#1f2c44/);
  });
});

describe('fallos 36 y 39: rejilla capas × etapas', () => {
  function gridWs() {
    const ws = emptyWorkspace('G');
    const v = makeView('Mapa', { notationId: 'grid', kind: 'grid', grid: { layers: [{ id: 'l1', name: 'Negocio', color: '#fef3c7' }, { id: 'l2', name: 'Datos', color: '#1e3a8a' }], stages: [{ id: 's1', name: 'Alta' }], stageGroups: [] } });
    ws.views[v.id] = v;
    const e = makeElement('archimate:BusinessActor', 'Cliente'); ws.elements[e.id] = e;
    const n = makeNode(v.id, e.id, { x: 10, y: 10, w: 140, h: 56 }, { cell: { layerId: 'l1', stageId: 's1' } }); ws.nodes[n.id] = n;
    return { ws, viewId: v.id };
  }
  it('no atenúa los elementos de otra notación (como el lienzo)', () => {
    const { ws, viewId } = gridWs();
    expect(renderSvg(new MemoryStore(ws), reg(), viewId)).not.toMatch(/class="[^"]*is-dimmed/);
  });
  it('cabeceras de capa legibles: color mezclado con el panel en oscuro y texto del tema (blanco si el color es oscuro)', () => {
    const { ws, viewId } = gridWs();
    const svg = renderSvg(new MemoryStore(ws), reg(), viewId, { theme: 'dark' });
    expect(svg).toContain('--ad-hdr-mix:42%');
    expect(svg).toContain('fill:color-mix(in srgb, #fef3c7 var(--ad-hdr-mix), var(--ad-panel))');
    expect(svg).toMatch(/style="fill:var\(--ad-text\)"[^>]*><tspan[^>]*>Negocio/);
    expect(svg).toMatch(/style="fill:#fff"[^>]*><tspan[^>]*>Datos/);
  });
});

describe('fallos 7 y 34: Drawer', () => {
  const ws = () => importAny(fixture('fixture.drawer'), 'fixture.drawer').then(r => r.workspace);
  it('los pines que usan las relaciones quedan visibles en sus nodos (la arista tiene dónde engancharse)', async () => {
    const w = await ws();
    const e = w.edges['r1']!;
    expect(e.fromPortId).toBe('c-crm#response_body.cliente.id');
    expect(w.nodes[e.fromNodeId]!.style).toMatchObject({ showPorts: true, visiblePorts: ['response_body.cliente.id'] });
    expect(w.nodes[e.toNodeId]!.style).toMatchObject({ showPorts: true, visiblePorts: ['responseBody.cliente.id'] });
  });
  it('un placement anidado queda dentro de su padre, bajo su título, y el tipo del padre es contenedor', async () => {
    const w = await ws();
    const parent = w.nodes['p-alta']!, child = w.nodes['p-kyc']!;
    expect(child.parentNodeId).toBe(parent.id);
    expect(child.y).toBeGreaterThanOrEqual(56);
    expect(parent.w).toBeGreaterThanOrEqual(child.x + child.w);
    expect(parent.h).toBeGreaterThanOrEqual(child.y + child.h);
    const type = Object.values(w.libraries).flatMap(l => l.elementTypes).find(t => t.id === w.elements[parent.elementId!]!.typeId);
    expect(type?.container).toBe(true);
  });
});

describe('fallo 35: Archi y OEF, el nombre de los contenedores va arriba', () => {
  const ARCHI = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="M" id="m">
  <folder name="Business" id="f1" type="business">
    <element xsi:type="archimate:BusinessProcess" name="Tramitar" id="p"/>
    <element xsi:type="archimate:BusinessProcess" name="Registrar" id="q"/>
  </folder>
  <folder name="Views" id="f2" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="V" id="v">
      <child xsi:type="archimate:DiagramObject" id="np" archimateElement="p"><bounds x="10" y="10" width="400" height="160"/>
        <child xsi:type="archimate:DiagramObject" id="nq" archimateElement="q"><bounds x="20" y="40" width="120" height="55"/></child>
      </child>
      <child xsi:type="archimate:DiagramObject" id="nc" archimateElement="q" textPosition="1"><bounds x="500" y="10" width="200" height="160"/>
        <child xsi:type="archimate:DiagramObject" id="nd" archimateElement="p"><bounds x="20" y="40" width="120" height="55"/></child>
      </child>
    </element>
  </folder>
</archimate:model>`;
  it('Archi: con hijos y sin `textPosition` (arriba por defecto) → `labelPosition: top`; centrado explícito se respeta', () => {
    const { workspace: w } = importArchimate(ARCHI);
    expect(w.nodes['np']!.style.labelPosition).toBe('top');
    expect(w.nodes['nq']!.style.labelPosition).toBeUndefined();
    expect(w.nodes['nc']!.style.labelPosition).toBeUndefined();
    // Ida y vuelta: sin pérdidas (arriba es lo que Archi supone si no hay atributo)
    const back = importArchimate(exportArchimate(w).text).workspace;
    expect(back.nodes['np']!.style.labelPosition).toBe('top');
  });
  it('OEF: los nodos con hijos llevan la etiqueta arriba', () => {
    const { workspace: w } = importArchimate(ARCHI);
    const oef = importOpenExchange(exportOpenExchange(w).text).workspace;
    expect(Object.values(oef.nodes).filter(n => n.style.labelPosition === 'top')).toHaveLength(2);
  });
  it('SVG: la etiqueta de un nodo con `labelPosition: top` va arriba, no al centro', () => {
    const { workspace: w } = importArchimate(ARCHI);
    const svg = renderSvg(new MemoryStore(w), reg(), 'v');
    const m = new RegExp('data-node="np"[\\s\\S]*?class="ad-node__label"[^>]*><tspan x="[\\d.]+" dy="0">Tramitar').exec(svg);
    expect(m).not.toBeNull();
    const y = Number(/data-node="np"[\s\S]*?<text x="[\d.]+" y="([\d.]+)"[^>]*class="ad-node__label"/.exec(svg)?.[1]);
    expect(y).toBeLessThan(10 + 40);                           // en la franja de arriba del nodo (y = 10…170)
  });
});

describe('fallos 40 y 58: BPMN de bpmn.io', () => {
  it('espacio y vista con el nombre del proceso (no «BPMN» ni «Collaboration_1»)', async () => {
    const r = await importAny(fixture('pedido-bpmnio.bpmn'), 'pedido-bpmnio.bpmn');
    expect(r.workspace.meta.name).toBe('Tramitar pedido');
    expect(Object.values(r.workspace.views).map(v => v.name)).toContain('Tramitar pedido');
    expect(Object.values(r.workspace.views).map(v => v.name)).not.toContain('Collaboration_1');
  });
  it('sin nombre en el fichero, el del fichero', async () => {
    const xml = `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D"><bpmn:process id="P"><bpmn:task id="T"/></bpmn:process></bpmn:definitions>`;
    expect((await importAny(xml, 'mi_proceso.bpmn')).workspace.meta.name).toBe('mi proceso');
  });
  it('el texto de la anotación es su etiqueta; el almacén lleva la etiqueta debajo', async () => {
    const w = (await importAny(fixture('pedido-bpmnio.bpmn'), 'p.bpmn')).workspace;
    expect(w.elements['Ann_1']!.name).toBe('Revisar en < 2 h');
    expect(w.elements['Ann_1']!.fields['text']).toBe('Revisar en < 2 h');
    const ds = Object.values(w.nodes).find(n => n.elementId === 'DS_Pedidos')!;
    expect(ds.style.labelPosition).toBe('bottom');
  });
  it('SVG: una compuerta sin nombre no muestra el nombre de su tipo debajo', async () => {
    const w = (await importAny(fixture('pedido-bpmnio.bpmn'), 'p.bpmn')).workspace;
    const { BPMN_PACK } = await import('@all-draw/notation-bpmn');
    const view = Object.values(w.views).find(v => v.name === 'Tramitar pedido')!;
    const svg = renderSvg(new MemoryStore(w), reg().register(BPMN_PACK), view.id);
    const gw = new RegExp('data-element="Gw_Split"[^>]*>([\\s\\S]*?)</g>').exec(svg)?.[1] ?? '';
    expect(gw).not.toContain('Compuerta paralela');
  });
});

describe('fallos 37 y 41: Mermaid', () => {
  const structure = (w: Workspace) => Object.values(w.nodes).map(n => {
    const e = w.elements[n.elementId!]!; const p = n.parentNodeId ? w.elements[w.nodes[n.parentNodeId]!.elementId!]! : undefined;
    return `${e.typeId}:${e.name}<${p?.name ?? '-'}`;
  }).sort();
  it('stateDiagram: compuestos y regiones paralelas sobreviven a la ida y vuelta', () => {
    const a = importMermaid(fixture('state.mmd')).workspace;
    const text = exportMermaid(a, Object.keys(a.views)[0]!).text;
    expect(text).toMatch(/state Mostrando \{\n\s+Lista\n\s+Detalle\n\s+\[\*\] --> Lista\n\s+Lista --> Detalle: seleccionar/);
    expect(text).toMatch(/state Paralelo \{\n\s+A1\n\s+A2\n\s+A1 --> A2\n\s+--\n\s+B1\n\s+B2\n\s+B1 --> B2\n\s+\}/);
    expect(structure(importMermaid(text).workspace)).toEqual(structure(a));
  });

  it('secuencia → sequenceDiagram con participantes, flechas por clase, activaciones y fragmentos (y vuelta)', () => {
    const { ws, viewId } = sequenceWs();
    const r = exportMermaid(ws, viewId);
    expect(r.text).toMatch(/^sequenceDiagram\n {4}actor Cliente\n {4}participant Tienda\n {4}participant API\n/);
    expect(r.text).toContain('Cliente->>Tienda: paga');
    expect(r.text).toContain('API-->>Tienda: ok');
    expect(r.text).toContain('Tienda-)Cliente: recibo');
    expect(r.text).toContain('Cliente-xTienda: cerrar');
    // La activación (140–260) se abre antes del mensaje 2 y se cierra dentro del `alt` (180–270), antes de su `end`.
    expect(r.text).toMatch(/activate API\n {4}Tienda->>API: POST \/pagos\n {4}alt hay stock\n {8}API->>API: validar\n {8}API-->>Tienda: ok\n {8}deactivate API\n {4}end\n/);
    const back = importMermaid(r.text).workspace;
    expect(Object.values(back.views)[0]!.kind).toBe('sequence');
    const msgs = Object.values(back.relations).sort((x, y) => Number(x.fields['order']) - Number(y.fields['order']));
    expect(msgs.map(m => m.fields['text'])).toEqual(['paga', 'POST /pagos', 'validar', 'ok', 'recibo', 'cerrar']);
    expect(msgs[3]!.typeId).toBe('sequence:Return');
    expect(Object.values(back.elements).filter(e => e.typeId === 'sequence:Fragment')).toHaveLength(1);
    expect(Object.values(back.elements).filter(e => e.typeId === 'sequence:Activation')).toHaveLength(1);
  });

  it('clases → classDiagram con miembros, estereotipos y multiplicidades (y vuelta)', () => {
    const ws = emptyWorkspace('UML');
    const v = makeView('Clases', { notationId: 'uml' }); ws.views[v.id] = v;
    const el = (typeId: string, name: string, fields: Record<string, unknown>, x: number) => { const e = makeElement(typeId, name, { fields }); ws.elements[e.id] = e; const n = makeNode(v.id, e.id, { x, y: 0, w: 200, h: 100 }); ws.nodes[n.id] = n; return n; };
    const cliente = el('uml:Class', 'Cliente', { attributes: ['- nombre: String'], operations: ['+ realizarPedido(): Pedido'] }, 0);
    const pedido = el('uml:Class', 'Pedido', { attributes: [], operations: [] }, 300);
    const pagable = el('uml:Interface', 'Pagable', { stereotype: 'interface', operations: ['+ pagar(): void'] }, 600);
    const estado = el('uml:Enum', 'Estado', { values: ['PENDIENTE', 'PAGADO'] }, 900);
    const link = (typeId: string, a: typeof cliente, b: typeof cliente, fields: Record<string, unknown> = {}) => {
      const r = makeRelation(typeId, { elementId: a.elementId! }, { elementId: b.elementId! }, { fields }); ws.relations[r.id] = r;
      const e = makeEdge(v.id, r.id, a.id, b.id); ws.edges[e.id] = e;
    };
    link('uml:Association', cliente, pedido, { sourceCard: '1', targetCard: '0..*' });
    link('uml:Realization', pedido, pagable);
    link('uml:Dependency', pedido, estado);
    const r = exportMermaid(ws, v.id);
    expect(r.text).toMatch(/^classDiagram\n/);
    expect(r.text).toMatch(/class Cliente \{\n\s+-nombre: String\n\s+\+realizarPedido\(\) Pedido\n\s+\}/);
    expect(r.text).toMatch(/class Pagable \{\n\s+<<interface>>\n\s+\+pagar\(\) void/);
    expect(r.text).toMatch(/class Estado \{\n\s+<<enumeration>>\n\s+PENDIENTE/);
    expect(r.text).toContain('Cliente "1" -- "0..*" Pedido');
    expect(r.text).toContain('Pedido ..|> Pagable');
    expect(r.warnings).toEqual([]);
    const back = importMermaid(r.text).workspace;
    const byName = (n: string) => Object.values(back.elements).find(e => e.name === n)!;
    expect(byName('Pagable').typeId).toBe('uml:Interface');
    expect(byName('Estado').fields['values']).toEqual(['PENDIENTE', 'PAGADO']);
    expect(byName('Cliente').fields['attributes']).toEqual(['- nombre: String']);
    expect(byName('Cliente').fields['operations']).toEqual(['+ realizarPedido(): Pedido']);
    const assoc = Object.values(back.relations).find(x => x.typeId === 'uml:Association')!;
    expect(assoc.fields).toMatchObject({ sourceCard: '1', targetCard: '0..*' });
  });

  it('una vista sin equivalente en Mermaid avisa de que sale como flowchart', () => {
    const ws = emptyWorkspace('A');
    const v = makeView('Capas', { notationId: 'archimate' }); ws.views[v.id] = v;
    const e = makeElement('archimate:BusinessActor', 'Cliente'); ws.elements[e.id] = e;
    ws.nodes['n'] = makeNode(v.id, e.id, { x: 0, y: 0 }, { id: 'n' } as never);
    const r = exportMermaid(ws, v.id);
    expect(r.text.startsWith('flowchart TD')).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/no tiene equivalente en Mermaid/);
  });

  it('flowchart: hexágono y paralelogramo vuelven con su figura (fallo 82)', () => {
    const a = importMermaid('flowchart TD\n  A{{Auditar}} --> B[/Pedir datos/]').workspace;
    expect(a.libraries['lib_mermaid']!.elementTypes.map(t => t.shape)).toEqual(['hexagon', 'parallelogram']);
    const text = exportMermaid(a, Object.keys(a.views)[0]!).text;
    expect(text).toContain('{{"Auditar"}}');
    expect(text).toContain('[/"Pedir datos"/]');
  });

  it('erDiagram y otros tipos: error explícito al importar', async () => {
    await expect(importAny('erDiagram\n  A ||--o{ B : tiene', 'er.mmd')).rejects.toThrow(/«erDiagram» no se pueden importar/);
    expect(detectFormat('sequenceDiagram\n A->>B: x')).toBe('mermaid');
  });
});

describe('fallo 60 y 82: errores comprensibles y colores normalizados', () => {
  const err = async (text: string, name: string) => { try { await importAny(text, name); } catch (e) { return e as ImportError; } throw new Error('no falló'); };
  it('vacío, binario, XML truncado, JSON mal formado, JSON desconocido, draw.io', async () => {
    expect((await err('  \n', 'vacio.json')).message).toBe('El fichero «vacio.json» está vacío.');
    expect((await err('\u0000\u0001garbage', 'x.json')).message).toMatch(/no es un fichero de texto/);
    const t = await err(fixture('truncado.archimate'), 'truncado.archimate');
    expect(t).toBeInstanceOf(ImportError);
    expect(t.message).toMatch(/parece Archi \(\.archimate\), pero el XML está incompleto: termina en la línea 46 sin cerrar <archimate:model>, <folder>/);
    expect(t.key).toMatch(/\{format\}/);
    expect((await err('{"meta": {"schemaVersion": 1', 'roto.alldraw.json')).message).toMatch(/JSON pero está incompleto/);
    expect((await err('{\n  "app": "diagramador",\n  "libraries": [1,,2]\n}', 'x.drawer')).message).toMatch(/JSON está mal formado en la línea 3, columna \d+/);
    expect((await err('{"foo": 1}', 'cualquiera.json')).message).toMatch(/JSON válido, pero no corresponde a ningún formato conocido/);
    expect((await err('<mxfile><diagram/></mxfile>', 'a.drawio.xml')).message).toMatch(/draw\.io/);
    expect((await err('<svg/>', 'a.xml')).message).toMatch(/raíz <svg>/);
  });
  it('el formato detectado viene con su nombre legible', async () => {
    const r = await importAny('flowchart TD\n A', 'mapa.mmd');
    expect(r.formatLabel).toBe('Mermaid');
    expect(r.workspace.meta.name).toBe('mapa');
    expect(Object.values(r.workspace.views)[0]!.name).toBe('mapa');
  });
  it('colores #rgb pasan a #rrggbb (los selectores de color solo aceptan la forma larga)', async () => {
    const ws = emptyWorkspace('C');
    const v = makeView('V'); ws.views[v.id] = v;
    const e = makeElement('freeform:box', 'x'); ws.elements[e.id] = e;
    ws.nodes['n'] = { ...makeNode(v.id, e.id, { x: 0, y: 0 }), id: 'n', style: { fill: '#fff', stroke: '#AbC' } };
    const r = await importAny(JSON.stringify(ws), 'c.alldraw.json');
    expect(r.workspace.nodes['n']!.style).toMatchObject({ fill: '#ffffff', stroke: '#aabbcc' });
  });
  it('nombre del fichero sin extensiones de formato', () => {
    expect(fileStem('Banca Ñandú.alldraw.json')).toBe('Banca Ñandú');
    expect(fileStem('/tmp/pedido_bpmnio.bpmn')).toBe('pedido bpmnio');
  });
});
