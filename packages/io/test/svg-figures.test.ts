/**
 * Figuras de persona (C4) y actor en el SVG, y contenedores "papel" (pool, lane, límite…) en tema oscuro y dual.
 */
import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, makeRelation, makeEdge, type ViewNode } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { C4_PACK } from '@all-draw/notation-c4';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { renderSvg, personGeometry, isNeutralLight } from '../src/svg';

const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(C4_PACK).register(BPMN_PACK).register(STATECHART_PACK);

function store(notationId: string, nodes: { id: string; typeId: string; name: string; box: { x: number; y: number; w: number; h: number }; parent?: string; extra?: Partial<ViewNode> }[]) {
  const s = new MemoryStore();
  s.set('views', 'v', makeView('V', { id: 'v', notationId }));
  for (const n of nodes) {
    const el = makeElement(n.typeId, n.name, { id: `el_${n.id}` });
    s.set('elements', el.id, el);
    s.set('nodes', n.id, makeNode('v', el.id, n.box, { id: n.id, parentNodeId: n.parent, ...n.extra }));
  }
  return s;
}

/** Fragmento del grupo de un nodo: desde su `<g … data-node="id">` hasta el siguiente nodo o las aristas (no se anidan). */
const nodeSvg = (svg: string, id: string) => {
  const i = svg.indexOf(`data-node="${id}"`);
  const start = svg.lastIndexOf('<g', i);
  const next = [svg.indexOf('<g class="ad-node', i), svg.indexOf('<g class="ad-edges"', i)].filter(x => x > 0);
  return svg.slice(start, Math.min(...next));
};

describe('SVG: persona C4 y actor', () => {
  it('c4:Person es cabeza + cuerpo redondeado con el color del tipo y el texto dentro del cuerpo', () => {
    const s = store('c4', [{ id: 'p', typeId: 'c4:Person', name: 'Cliente', box: { x: 0, y: 0, w: 160, h: 150 } }]);
    const svg = renderSvg(s, reg(), 'v');
    const g = nodeSvg(svg, 'p');
    expect(g).toContain('ad-shape-person');
    expect(g).not.toContain('ad-shape-actor');
    const geo = personGeometry(160, 150);
    // Cabeza y cuerpo rellenos del azul de persona C4 (no un círculo blanco suelto)
    expect(g).toMatch(/<circle[^>]*cx="80"[^>]*fill="#08427B"/);
    expect(g).toMatch(new RegExp(`<rect[^>]*y="${geo.bodyTop}"[^>]*rx="[\\d.]+"[^>]*fill="#08427B"`));
    // Sin monigote: ningún trazo de brazos/piernas
    expect(g).not.toMatch(/<path[^>]*fill="none"/);
    // Texto blanco (legible sobre el azul) y dentro del cuerpo, no debajo de la figura
    const label = /<text[^>]*y="([\d.]+)"[^>]*class="ad-node__label"[^>]*fill="#fff"[^>]*><tspan[^>]*>Cliente</.exec(g);
    expect(label).not.toBeNull();
    const y = Number(label![1]);
    expect(y).toBeGreaterThan(geo.bodyTop);
    expect(y).toBeLessThan(150);
  });

  it('freeform:actor es un monigote visible: cabeza con el color del tipo y trazo del cuerpo', () => {
    const s = store('freeform', [{ id: 'a', typeId: 'freeform:actor', name: 'Usuario', box: { x: 0, y: 0, w: 60, h: 90 } }]);
    const g = nodeSvg(renderSvg(s, reg(), 'v'), 'a');
    expect(g).toContain('ad-shape-actor');
    expect(g).toMatch(/<circle[^>]*fill="#dcfce7"[^>]*stroke="#[0-9a-f]{6}"/i);
    expect(g).toMatch(/<path[^>]*fill="none"[^>]*stroke="#[0-9a-f]{6}"/i);
    // La cabeza no se deforma: círculo en coordenadas del nodo, no un viewBox 100×100 estirado
    expect(g).not.toContain('scale(');
  });
});

describe('SVG: contenedores claros en tema oscuro', () => {
  const bpmn = () => {
    const s = store('bpmn', [
      { id: 'pool', typeId: 'bpmn:Pool', name: 'Banco', box: { x: 0, y: 0, w: 600, h: 300 } },
      { id: 'lane', typeId: 'bpmn:Lane', name: 'Gestor', box: { x: 30, y: 0, w: 570, h: 300 }, parent: 'pool' },
      { id: 'start', typeId: 'bpmn:StartEvent', name: 'Inicio', box: { x: 40, y: 40, w: 40, h: 40 }, parent: 'lane' },
      { id: 'task', typeId: 'bpmn:Task', name: 'Tarea', box: { x: 140, y: 30, w: 140, h: 60 }, parent: 'lane' },
      { id: 'tinted', typeId: 'bpmn:Pool', name: 'Con color', box: { x: 0, y: 400, w: 600, h: 100 }, extra: { style: { fill: '#e0f2fe' } } },
    ]);
    const r = makeRelation('bpmn:SequenceFlow', { elementId: 'el_start' }, { elementId: 'el_task' }, { id: 'r' });
    s.set('relations', r.id, r);
    const e = makeEdge('v', r.id, 'start', 'task', { id: 'e' }); s.set('edges', e.id, e);
    return s;
  };

  it('pool y lane llevan la clase "papel"; el tema oscuro les pone el panel y el texto del tema', () => {
    const svg = renderSvg(bpmn(), reg(), 'v', { theme: 'dark' });
    for (const id of ['pool', 'lane']) expect(nodeSvg(svg, id)).toMatch(/class="[^"]*\bad-lc\b[^"]*\bad-lc-text\b/);
    expect(svg).toContain('svg.ad-svg .ad-lc>.ad-shape{fill:var(--ad-panel)}');
    expect(svg).toContain('svg.ad-svg .ad-lc-text>text{fill:var(--ad-text)}');
    // La etiqueta del evento (debajo de la figura, sobre la lane) sigue al tema
    expect(nodeSvg(svg, 'start')).toMatch(/class="[^"]*\bad-on-lc\b/);
    // La tarea (no contenedor) conserva su blanco; un pool con relleno propio se respeta
    expect(nodeSvg(svg, 'task')).not.toMatch(/\bad-lc\b/);
    expect(nodeSvg(svg, 'tinted')).not.toMatch(/\bad-lc\b/);
    // Aristas sin color propio: el gris claro del editor oscuro, no #444 sobre fondo negro
    expect(svg).toMatch(/<path[^>]*stroke="#9aa3b2"[^>]*marker-end=/);
  });

  it('en claro no se aplica; en dual solo con el esquema oscuro (o data-theme="dark")', () => {
    const light = renderSvg(bpmn(), reg(), 'v', { theme: 'light' });
    expect(light).not.toContain('.ad-lc>.ad-shape');
    expect(light).toMatch(/<path[^>]*stroke="#444"/);
    const dual = renderSvg(bpmn(), reg(), 'v', { theme: 'dual' });
    expect(dual).toMatch(/@media \(prefers-color-scheme: dark\)\{svg\.ad-svg\{[^}]*\}svg\.ad-svg:not\(\[data-theme="light"\]\) \.ad-lc>\.ad-shape\{fill:var\(--ad-panel\)\}/);
    expect(dual).toContain('svg.ad-svg[data-theme="dark"] .ad-lc>.ad-shape{fill:var(--ad-panel)}');
    expect(dual).toContain('--ad-edge:#9aa3b2');
    expect(dual).toMatch(/<path[^>]*stroke="var\(--ad-edge\)"/);
    // El relleno claro sigue como atributo (lo que se ve en claro)
    expect(nodeSvg(dual, 'pool')).toMatch(/<rect class="ad-shape"[^>]*fill="#F5F5F5"/i);
  });

  it('solo cuentan como "papel" los blancos y grises neutros (un estado amarillo no)', () => {
    expect(['#FFFFFF', '#F5F5F5', '#FAFAFA', '#f1f5f9'].every(c => isNeutralLight(c))).toBe(true);
    expect(['#FFF2CC', '#E1D5E7', '#85BBF0', '#e0f2fe', '#08427B', 'var(--x)', undefined].some(c => isNeutralLight(c))).toBe(false);
    const s = store('statechart', [{ id: 'st', typeId: 'statechart:State', name: 'Activo', box: { x: 0, y: 0, w: 160, h: 80 } }]);
    expect(nodeSvg(renderSvg(s, reg(), 'v', { theme: 'dark' }), 'st')).not.toMatch(/\bad-lc\b/);
  });
});
