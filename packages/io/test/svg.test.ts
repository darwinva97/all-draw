import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeElement, makeView, makeNode, makeRelation, makeEdge, type NotationPack, type ViewNode, type StyleRule } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { GRID_PACK } from '@all-draw/notation-grid';
import { ARCHIMATE_PACK, figureOf, iconOf } from '@all-draw/notation-archimate';
import { renderSvg, renderSvgDetailed, wrapText, mixWithWhite, visiblePorts, escapeXml } from '../src/svg';
import { edgePath, floatingEndpoints, orthogonalize, smoothStepPath } from '../src/bendpath-svg';

const SHAPES: NotationPack = {
  id: 'shapes', name: 'Figuras', categories: [], portTypes: [], viewpoints: [],
  elementTypes: [
    { id: 'shapes:pool', name: 'Pool', shape: 'pool', container: true, color: '#e0f2fe', fields: [] },
    { id: 'shapes:lane', name: 'Lane', shape: 'lane', container: true, color: '#e0f2fe', fields: [] },
    { id: 'shapes:start', name: 'Inicio', shape: 'circle', color: '#000000', fields: [] },
    { id: 'shapes:end', name: 'Fin', shape: 'double-circle', color: '#000000', fields: [] },
    { id: 'shapes:gw', name: 'Compuerta', shape: 'diamond', color: '#fef3c7', fields: [] },
    { id: 'shapes:hex', name: 'Hexágono', shape: 'hexagon', color: '#fde68a', fields: [] },
    { id: 'shapes:par', name: 'Paralelogramo', shape: 'parallelogram', color: '#ddd6fe', fields: [] },
    { id: 'shapes:bar', name: 'Barra', shape: 'bar', color: '#000000', fields: [] },
    { id: 'shapes:svc', name: 'Servicio', shape: 'rect', color: '#2563eb', icon: '⚙', fields: [{ key: 'api', label: 'API', kind: 'json' }, { key: 'owner', label: 'Owner', kind: 'text' }] },
    { id: 'shapes:plain', name: 'Plano', shape: 'rect', fields: [] },
  ],
  relationTypes: [
    { id: 'shapes:flow', name: 'Flujo', line: 'dashed', sourceHead: 'circle', targetHead: 'triangle', color: '#dc2626', fields: [{ key: 'cond', label: 'Condición', kind: 'text' }] },
    { id: 'shapes:agg', name: 'Agregación', line: 'dotted', sourceHead: 'diamond', targetHead: 'open', fields: [] },
  ],
};

const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(GRID_PACK).register(SHAPES);

/** Vista sintética con todas las figuras, contenedores anidados, puertos, bendpoints y reglas. */
function scene() {
  const store = new MemoryStore();
  const view = makeView('Todo', { id: 'v', notationId: 'shapes', doc: 'Vista de prueba con <todas> las figuras & cosas.' });
  store.set('views', view.id, view);
  const detail = makeView('Detalle', { id: 'd', notationId: 'freeform' });
  store.set('views', detail.id, detail);
  const mk = (id: string, typeId: string, name: string, pos: { x: number; y: number; w?: number; h?: number }, extra: Partial<ViewNode> = {}, fields: Record<string, unknown> = {}) => {
    const el = makeElement(typeId, name, { id: `el_${id}`, fields, doc: `Doc de ${name}` }); store.set('elements', el.id, el);
    const n = makeNode('v', el.id, pos, { id, ...extra }); store.set('nodes', n.id, n);
    return n;
  };
  mk('pool', 'shapes:pool', 'Ventas', { x: 0, y: 0, w: 600, h: 260 });
  mk('lane', 'shapes:lane', 'Comercial', { x: 30, y: 10, w: 560, h: 240 }, { parentNodeId: 'pool' });
  mk('start', 'shapes:start', 'Inicio', { x: 20, y: 100, w: 36, h: 36 }, { parentNodeId: 'lane' });
  mk('task', 'freeform:box', 'Registrar pedido', { x: 90, y: 90 }, { parentNodeId: 'lane', detailViewId: 'd' });
  mk('gw', 'shapes:gw', '¿Aprobado?', { x: 300, y: 90, w: 56, h: 56 }, { parentNodeId: 'lane' });
  mk('end', 'shapes:end', 'Fin', { x: 420, y: 100, w: 36, h: 36 }, { parentNodeId: 'lane' });
  mk('hex', 'shapes:hex', 'Hexágono', { x: 700, y: 20 });
  mk('par', 'shapes:par', 'Paralelogramo', { x: 700, y: 100 });
  mk('bar', 'shapes:bar', 'Barra', { x: 700, y: 180, w: 160, h: 12 });
  mk('cyl', 'freeform:cylinder', 'Base de datos', { x: 700, y: 240, w: 120, h: 80 });
  mk('act', 'freeform:actor', 'Cliente', { x: 860, y: 240, w: 60, h: 80 });
  mk('ell', 'freeform:ellipse', 'Elipse', { x: 940, y: 240 });
  mk('note', 'freeform:note', 'Una nota con un texto bastante largo que debería partirse en varias líneas', { x: 700, y: 340, w: 160, h: 90 });
  mk('grp', 'freeform:group', 'Grupo', { x: 0, y: 300, w: 300, h: 160 });
  mk('svc', 'shapes:svc', 'CRM', { x: 20, y: 60, w: 200, h: 70 }, { parentNodeId: 'grp', style: { showPorts: true } }, { api: '{"cliente":{"id":1,"email":"a@b.c"}}', owner: 'Ana' });
  mk('plain', 'shapes:plain', 'Sin color', { x: 400, y: 340 }, { style: { fontSize: 15 } });
  mk('other', 'bpmn:Task', 'De otra notación', { x: 400, y: 420 });
  // Nodos visuales
  const vnote: ViewNode = { id: 'vnote', viewId: 'v', visualType: 'core:note', text: 'Nota visual', x: 600, y: 480, w: 120, h: 50, style: {} }; store.set('nodes', vnote.id, vnote);
  const vgrp: ViewNode = { id: 'vgrp', viewId: 'v', visualType: 'core:group', text: 'Zona', x: 750, y: 480, w: 160, h: 80, style: {} }; store.set('nodes', vgrp.id, vgrp);
  const vlbl: ViewNode = { id: 'vlbl', viewId: 'v', visualType: 'core:label', text: 'Etiqueta suelta', x: 950, y: 480, w: 120, h: 24, style: {} }; store.set('nodes', vlbl.id, vlbl);
  // Relaciones y aristas
  const link = (id: string, typeId: string, from: string, to: string, extra: Partial<ReturnType<typeof makeEdge>> = {}, relExtra: Partial<ReturnType<typeof makeRelation>> = {}) => {
    const rel = makeRelation(typeId, { elementId: `el_${from}` }, { elementId: `el_${to}` }, { id: `rel_${id}`, ...relExtra }); store.set('relations', rel.id, rel);
    const e = makeEdge('v', rel.id, from, to, { id, ...extra }); store.set('edges', e.id, e);
  };
  link('e1', 'shapes:flow', 'start', 'task', {}, { fields: { cond: 'siempre' } });
  link('e2', 'shapes:flow', 'task', 'gw', { label: 'valida' });
  link('e3', 'shapes:flow', 'gw', 'end', { bendpoints: [{ x: 400, y: 60 }, { x: 460, y: 60 }] });
  link('e4', 'shapes:agg', 'hex', 'par', { style: { router: 'bezier' } });
  link('e5', 'freeform:arrow', 'par', 'bar', { style: { router: 'straight', line: 'dotted', color: '#16a34a' } });
  link('e6', 'core:flow', 'svc', 'cyl', { fromPortId: 'el_svc#api.cliente.email', bendpoints: [{ x: 500, y: 300 }] }, { mappings: [{ fromPath: 'api.cliente.email', toPath: 'email' }] });
  link('e7', 'freeform:arrow', 'task', 'hex', { bendpoints: [{ x: 500, y: -40 }], style: { router: 'orthogonal' } });
  link('e8', 'freeform:bidirectional', 'cyl', 'act', { style: { sourceHead: 'filled-diamond', targetHead: 'dot' } });
  link('e9', 'freeform:line', 'act', 'ell', { style: { targetHead: 'half', width: 3 } });
  // Reglas de estilo
  const rule: StyleRule = { id: 'r1', name: 'CRM rojo', enabled: true, priority: 1, match: 'all', target: 'element', conditions: [{ source: 'name', op: 'eq', value: 'CRM' }], style: { bg: '#fee2e2', border: '#dc2626', accent: '#dc2626', top: '#f59e0b', badge: '#dc2626', badgeText: '3', bold: true, borderStyle: 'dashed', borderWidth: 2 } };
  store.set('rules', rule.id, rule);
  const rule2: StyleRule = { id: 'r2', name: 'tachado', enabled: true, priority: 2, match: 'all', target: 'element', conditions: [{ source: 'name', op: 'contains', value: 'Paralelo' }], style: { strike: true, opacity: 0.7, text: '#7c3aed' } };
  store.set('rules', rule2.id, rule2);
  return store;
}

function gridScene() {
  const store = new MemoryStore();
  const view = makeView('Tablero', {
    id: 'g', kind: 'grid', notationId: 'grid',
    grid: { layers: [{ id: 'L1', name: 'Negocio', color: '#fef3c7' }, { id: 'L2', name: 'Aplicación', color: '#ede9fe' }], stages: [{ id: 'S1', name: 'Etapa 1', groupId: 'G' }, { id: 'S2', name: 'Etapa 2', groupId: 'G' }, { id: 'S3', name: 'Etapa 3' }], stageGroups: [{ id: 'G', name: 'Fase A', color: '#dbeafe' }] },
  });
  store.set('views', view.id, view);
  const put = (id: string, name: string, layerId: string, stageId: string) => {
    const el = makeElement('freeform:box', name, { id: `el_${id}` }); store.set('elements', el.id, el);
    const n = makeNode('g', el.id, { x: 20, y: 30, w: 140, h: 50 }, { id, cell: { layerId, stageId } }); store.set('nodes', n.id, n);
  };
  put('a', 'Alta', 'L1', 'S1'); put('b', 'Baja', 'L2', 'S3');
  const rel = makeRelation('core:link', { elementId: 'el_a' }, { elementId: 'el_b' }, { id: 'r' }); store.set('relations', rel.id, rel);
  const e = makeEdge('g', rel.id, 'a', 'b', { id: 'e' }); store.set('edges', e.id, e);
  return store;
}

/** Comprobación de forma XML con fast-xml-parser si está instalado; si no, regex. */
async function assertWellFormed(svg: string) {
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  let parsed = false;
  try {
    const mod = (await import('fast-xml-parser' as string)) as { XMLValidator?: { validate(s: string): true | { err: unknown } } };
    if (mod.XMLValidator) { const r = mod.XMLValidator.validate(svg); expect(r).toBe(true); parsed = true; }
  } catch { /* no instalado */ }
  if (!parsed) {
    // Equilibrio de etiquetas (sin contar autocerradas)
    const open = (svg.match(/<(?!\/|!|\?)[a-zA-Z][^>]*[^/]>/g) ?? []).length;
    const close = (svg.match(/<\/[a-zA-Z][^>]*>/g) ?? []).length;
    expect(open).toBe(close);
    // Sin `&` sueltos ni NaN
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;|#\d+;)/);
  }
  expect(svg).not.toContain('NaN');
  expect(svg).not.toContain('undefined');
}

describe('renderSvg', () => {
  it('exampleWorkspace: SVG bien formado con título, descripción y nombres', async () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const svg = renderSvg(store, reg(), 'vw_1');
    await assertWellFormed(svg);
    expect(svg).toContain('<title id="ad-vw_1-title">Mapa</title>');
    expect(svg).toContain('<desc id="ad-vw_1-desc">Vista &quot;Mapa&quot; (freeform) con 2 elementos y 1 relaciones.');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="ad-vw_1-title ad-vw_1-desc"');
    expect(svg).toContain('Proceso de alta');
    expect(svg).toContain('>CRM<');
    expect(svg).toContain('>usa<');                     // etiqueta de la arista
    expect(svg).toContain('data-detail-view="vw_2"');
    expect(svg).toContain('marker-end="url(#ad-vw_1-m-arrow-444)"');
    expect(svg).toContain('data-theme="light"');
    expect(svg).not.toContain('prefers-color-scheme');
  });

  it('temas: dark fija variables oscuras, dual usa prefers-color-scheme', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const dark = renderSvg(store, reg(), 'vw_1', { theme: 'dark' });
    expect(dark).toContain('data-theme="dark"');
    expect(dark).toContain('--ad-bg:#0f1115');
    expect(dark).not.toContain('--ad-bg:#f6f7f9');
    const dual = renderSvg(store, reg(), 'vw_1', { theme: 'dual' });
    expect(dual).toContain('@media (prefers-color-scheme: dark)');
    expect(dual).toContain('--ad-bg:#f6f7f9');
    expect(dual).toContain('--ad-bg:#0f1115');
    expect(dual).toContain('svg.ad-svg[data-theme="dark"]');
    expect(dual).not.toMatch(/<svg [^>]*data-theme=/);
  });

  it('opciones: padding, fuente, fondo, prefijo, bare', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const r = renderSvgDetailed(store, reg(), 'vw_1', { padding: 0, fontFamily: 'Inter, sans-serif', background: 'transparent', idPrefix: 'x y' });
    expect(r.viewBox[0]).toBe(40); expect(r.viewBox[1]).toBe(40);
    expect(r.width).toBe(460); expect(r.height).toBe(60);
    expect(r.svg).toContain('font-family:Inter, sans-serif');
    expect(r.svg).not.toContain('class="ad-bg"');
    expect(r.svg).toContain('id="x_y-title"');
    const bare = renderSvg(store, reg(), 'vw_1', { bare: true });
    expect(bare).not.toContain('<title');
    expect(bare).not.toContain('data-node=');
    expect(() => renderSvg(store, reg(), 'no-existe')).toThrow(/no existe la vista/);
  });

  it('vista sintética: todas las figuras, contenedores, puertos, bendpoints, reglas', async () => {
    const store = scene();
    const svg = renderSvg(store, reg(), 'v', { theme: 'dual' });
    await assertWellFormed(svg);
    // Nombres (con escape)
    for (const name of ['Ventas', 'Comercial', 'Registrar pedido', '¿Aprobado?', 'Hexágono', 'Paralelogramo', 'Base de datos', 'Cliente', 'Elipse', 'CRM', 'Sin color', 'Nota visual', 'Zona', 'Etiqueta suelta']) expect(svg).toContain(escapeXml(name));
    expect(svg).toContain('Vista de prueba con &lt;todas&gt; las figuras &amp; cosas.');
    // Clases de figura
    for (const s of ['pool', 'lane', 'circle', 'double-circle', 'diamond', 'hexagon', 'parallelogram', 'bar', 'cylinder', 'actor', 'ellipse', 'note', 'group', 'rounded', 'rect']) expect(svg).toContain(`ad-shape-${s}`);
    expect(svg).toContain('rotate(-90');                                       // etiqueta vertical de pool/lane
    expect(svg).toContain('polygon points="50,1 99,50 50,99 1,50"');          // rombo
    expect(svg).toContain('<circle cx="50" cy="50" r="38"');                   // doble círculo
    expect(svg).toContain('M2,15 v70 a48,12 0 0 0 96,0 v-70');                // cilindro
    // Contenedores anidados: posiciones absolutas (start = pool 0 + lane 30 + 20)
    expect(svg).toMatch(/translate\(50,110\) scale\(0\.36,0\.36\)/);
    // Puertos visibles con etiqueta y arista por puerto saliendo por la derecha
    expect(svg).toContain('ad-port__handle');
    expect(svg).toContain('>cliente.email<');
    expect(svg).toContain('ad-edge-label__pins');
    // Reglas de estilo
    expect(svg).toContain('fill="#fee2e2"');
    expect(svg).toContain('r-bold');
    expect(svg).toContain('r-strike');
    expect(svg).toContain('ad-node__badge');
    expect(svg).toContain('stroke-dasharray="6 4"');
    // Marcadores por cabeza y línea
    for (const h of ['circle', 'triangle', 'diamond', 'open', 'arrow', 'filled-diamond', 'dot', 'half']) expect(svg).toMatch(new RegExp(`id="ad-v-m-${h}-`));
    expect(svg).toContain('stroke-dasharray="8 5"');
    expect(svg).toContain('stroke-dasharray="2 4"');
    expect(svg).toContain('marker-start="url(#ad-v-m-circle-dc2626-s)"');
    // Etiquetas de arista: explícita, por campo y por nombre de tipo con mappings
    expect(svg).toContain('>valida<');
    expect(svg).toContain('>siempre<');
    // Bezier, recta, ortogonal y smoothstep
    expect(svg).toMatch(/<path d="M [\d.]+,[\d.]+ C /);
    expect(svg).toMatch(/<path d="M [\d.-]+,[\d.-]+ L [\d.-]+,[\d.-]+" fill="none"/);
    expect(svg).toMatch(/ Q /);
    // Nodo de otra notación atenuado; nota multilínea; detalle
    expect(svg).toContain('is-dimmed');
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(20);
    expect(svg).toContain('data-detail-view="d"');
    expect(svg).toContain('<title>Doc de CRM</title>');
    // Fuente por nodo
    expect(svg).toContain('font-size="15"');
    // Contenedores se pintan antes que sus hijos
    expect(svg.indexOf('data-node="pool"')).toBeLessThan(svg.indexOf('data-node="lane"'));
    expect(svg.indexOf('data-node="lane"')).toBeLessThan(svg.indexOf('data-node="task"'));
  });

  it('vista grid: celdas, cabeceras y grupos con los rects de cellRects', async () => {
    const store = gridScene();
    const svg = renderSvg(store, reg(), 'g');
    await assertWellFormed(svg);
    expect((svg.match(/class="ad-cell"/g) ?? []).length).toBe(6);
    for (const t of ['Negocio', 'Aplicación', 'Etapa 1', 'Etapa 2', 'Etapa 3', 'Fase A']) expect(svg).toContain(t);
    expect(svg).toContain(`fill="${mixWithWhite('#fef3c7', 0.25)}"`);
    expect(svg).toContain('color-mix(in srgb, #fef3c7 25%, var(--ad-panel))');
    // El nodo `a` está en la celda L1|S1: x = 140 + 20, y = 28 + 40 + 30
    expect(svg).toMatch(/<rect class="ad-shape" x="160" y="98"/);
    expect(svg).toContain('data-cell="L1|S1"');
    // Arista entre celdas
    expect(svg).toContain('data-edge="e"');
  });

  it('vista ArchiMate: figuras de Archi con data-figure, paths e iconos', () => {
    const store = new MemoryStore();
    const r = new NotationRegistry().register(CORE_PACK).register(ARCHIMATE_PACK);
    const view = makeView('Arquitectura', { id: 'va', notationId: 'archimate' }); store.set('views', view.id, view);
    const add = (id: string, typeId: string, x: number, figure?: number) => {
      const el = makeElement(typeId, id, { id: `el_${id}` }); store.set('elements', el.id, el);
      const n = makeNode('va', el.id, { x, y: 10, w: 120, h: 55 }, { id, style: figure === undefined ? {} : { figure } }); store.set('nodes', n.id, n);
    };
    add('actor', 'archimate:BusinessActor', 0);
    add('proc', 'archimate:BusinessProcess', 140, 1);
    add('comp', 'archimate:ApplicationComponent', 280, 1);
    add('node', 'archimate:Node', 420, 1);
    add('goal', 'archimate:Goal', 560);
    const svg = renderSvg(store, r, 'va');
    expect(svg).toContain('data-figure="0"');
    expect(svg).toContain('data-figure="1"');
    expect((svg.match(/class="ad-shape ad-archi"/g) ?? []).length).toBe(5);
    // Rectángulo con icono: icono 16×16 en la esquina; figura alternativa: sin icono
    expect((svg.match(/class="ad-archi__icon"/g) ?? []).length).toBe(2);
    expect(svg).toContain(`d="${iconOf('archimate:BusinessActor')}"`);
    expect(svg).toContain(`d="${figureOf('archimate:BusinessProcess', 1).path(120, 55)}"`);
    expect(svg).toContain(`d="${figureOf('archimate:Node', 1).lines!(120, 55)}"`);
    expect(svg).toContain(`d="${figureOf('archimate:Goal', 0).path(120, 55)}"`);
    expect(svg).not.toContain('NaN');
    expect(svg).toContain('fill="#ffffb5"');
    expect(renderSvg(store, r, 'va', { bare: true })).not.toContain('data-figure');
  });

  it('vista vacía produce un SVG válido', async () => {
    const store = new MemoryStore();
    const v = makeView('Vacía', { id: 'e' }); store.set('views', v.id, v);
    const r = renderSvgDetailed(store, reg(), 'e');
    await assertWellFormed(r.svg);
    expect(r.width).toBeGreaterThan(0);
  });
});

describe('utilidades', () => {
  it('wrapText parte por palabras y trocea palabras largas', () => {
    expect(wrapText('hola mundo', 200)).toEqual(['hola mundo']);
    expect(wrapText('una etiqueta bastante larga', 80).length).toBeGreaterThan(1);
    expect(wrapText('a\nb', 200)).toEqual(['a', 'b']);
    expect(wrapText('supercalifragilistico', 40).every(l => l.length <= 5)).toBe(true);
    expect(wrapText('', 100)).toEqual(['']);
  });
  it('visiblePorts replica el editor', () => {
    const ports = [{ id: 'p#a', key: 'a', direction: 'both' as const, derived: true }, { id: 'p#b', key: 'b', direction: 'out' as const, derived: true }];
    const vn = (style: ViewNode['style']): ViewNode => ({ id: 'n', viewId: 'v', x: 0, y: 0, w: 1, h: 1, style });
    expect(visiblePorts(ports, vn({}))).toEqual([]);
    expect(visiblePorts(ports, vn({ showPorts: true }))).toHaveLength(2);
    expect(visiblePorts(ports, vn({ showPorts: true, visiblePorts: ['b'] }))).toHaveLength(1);
    expect(visiblePorts(ports, vn({ showPorts: false, visiblePorts: ['b'] }))).toEqual([]);
  });
  it('bendpath-svg: extremos flotantes, ortogonalización y smoothstep', () => {
    const a = { x: 0, y: 0, w: 100, h: 50 }, b = { x: 300, y: 0, w: 100, h: 50 };
    const ep = floatingEndpoints(a, b);
    expect(ep).toMatchObject({ sourceX: 100, sourceY: 25, sourcePosition: 'right', targetX: 300, targetY: 25, targetPosition: 'left' });
    expect(orthogonalize([{ x: 0, y: 0 }, { x: 10, y: 10 }], 'right', 'left')).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const s = smoothStepPath(ep);
    expect(s.path).toBe('M 100,25 L 300,25');
    expect(s.labelX).toBe(200);
    const below = floatingEndpoints(a, { x: 0, y: 200, w: 100, h: 50 });
    expect(below.sourcePosition).toBe('bottom'); expect(below.targetPosition).toBe('top');
    const bent = edgePath(ep, [{ x: 200, y: 100 }], 'smoothstep');
    expect(bent.path).toContain(' Q ');
    expect(edgePath(ep, [{ x: 200, y: 100 }], 'bezier').path).toContain(' C ');
    expect(edgePath(ep, [{ x: 200, y: 100 }], 'straight').path).toBe('M 100,25 L 200,100 L 300,25');
  });
});
