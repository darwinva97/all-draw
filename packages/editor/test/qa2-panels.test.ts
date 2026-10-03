/**
 * QA 2026-10-03 — paneles del editor, teclado y accesibilidad (fallos 10, 16, 18, 19, 20, 28, 46, 62, 63, 70, 74).
 * Lógica pura (colocación de menús, roving, trampa de foco, categorías, hueco libre) y marcado (SSR) de los paneles.
 * El comportamiento en el navegador (foco, flechas, Shift+F10, hojas móviles) está en `e2e/panels-qa2.mjs`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryStore, History, NotationRegistry, CORE_PACK, makeElement, makeView, makeNode, type NotationPack, type ElementType } from '@all-draw/core';
import { setLang } from '@all-draw/i18n';
import { EditorProvider } from '../src/context';
import { placeMenu, isContextMenuKey, MENU_ITEMS } from '../src/ui/menu';
import { moveIndex } from '../src/ui/roving';
import { trapTarget } from '../src/ui/modal';
import { TabList, tabPanelProps, tabId, panelId } from '../src/ui/tabs';
import { PaneMenu } from '../src/panels/PaneMenu';
import { NodeMenu } from '../src/panels/NodeMenu';
import { Palette } from '../src/panels/Palette';
import { ViewsPanel } from '../src/panels/ViewsPanel';
import { Inspector, NodeInspector } from '../src/panels/Inspector';
import { WorkspacePanel } from '../src/panels/WorkspacePanel';
import { TracesTab } from '../src/panels/WorkspaceTraces';
import { ShortcutsPanel } from '../src/panels/ShortcutsPanel';
import { categoryGroups, freeSpot, containerNodeIds, paletteItemSize } from '../src/panels/palette-helpers';
import { DND_TYPE, DND_VISUAL } from '../src/Canvas';

const SRC = resolve(__dirname, '../src');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

/** Pack de prueba con categorías por id (como BPMN) y un orden distinto del de aparición. */
const BPMN: NotationPack = {
  id: 'bpmn', name: 'BPMN 2.0', portTypes: [], viewpoints: [], relationTypes: [],
  categories: [{ id: 'activities', name: 'Actividades', order: 1 }, { id: 'events', name: 'Eventos', order: 2 }, { id: 'participants', name: 'Participantes', order: 0 }],
  elementTypes: [
    { id: 'bpmn:StartEvent', name: 'Evento de inicio', category: 'events', fields: [], shape: 'circle' },
    { id: 'bpmn:Task', name: 'Tarea', category: 'activities', fields: [], doc: 'Trabajo atómico.' },
    { id: 'bpmn:Pool', name: 'Pool', category: 'participants', fields: [], container: true },
  ],
};
const ARCHI: NotationPack = {
  id: 'archimate', name: 'ArchiMate', portTypes: [], viewpoints: [], relationTypes: [], categories: [],
  elementTypes: [{ id: 'archimate:BusinessActor', name: 'Business Actor', fields: [] }],
};
const registry = () => new NotationRegistry().register(CORE_PACK).register(BPMN).register(ARCHI);

function demo() {
  const store = new MemoryStore();
  const view = makeView('Proceso', { id: 'v1', notationId: 'bpmn' });
  store.set('views', view.id, view);
  const el = makeElement('bpmn:Task', 'Revisar', { id: 'e1' });
  store.set('elements', el.id, el);
  store.set('nodes', 'n1', makeNode(view.id, el.id, { x: 0, y: 0 }, { id: 'n1' }));
  return { store, view };
}
function render(children: ReactNode, opts: { store?: MemoryStore; onShare?: () => void; viewId?: string | null; reg?: NotationRegistry } = {}) {
  const store = opts.store ?? demo().store;
  return renderToStaticMarkup(createElement(EditorProvider, {
    store, history: new History(store), registry: opts.reg ?? registry(), initialViewId: opts.viewId === undefined ? 'v1' : opts.viewId, onShare: opts.onShare, children,
  }));
}

beforeAll(() => setLang('es'));

describe('10 · menús contextuales dentro de la pantalla y con teclado', () => {
  it('cabe: se queda donde se abrió', () => {
    expect(placeMenu(100, 100, 220, 300, 1440, 900)).toEqual({ left: 100, top: 100, maxHeight: 884 });
  });
  it('no cabe por abajo: se voltea hacia arriba (caso del informe: 610 px abierto en y=522 con 900 px)', () => {
    const p = placeMenu(400, 522, 260, 610, 1440, 900);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.top + 610).toBeLessThanOrEqual(900 - 8);
  });
  it('no cabe ni arriba ni abajo: se pega al borde y limita el alto (desplazamiento interno)', () => {
    const p = placeMenu(200, 437, 300, 1200, 390, 844);
    expect(p.top).toBe(8);
    expect(p.maxHeight).toBe(844 - 16);
    expect(p.left + 300).toBeLessThanOrEqual(390 - 8 + 1);
  });
  it('no cabe por la derecha: se abre hacia la izquierda', () => {
    expect(placeMenu(1400, 100, 240, 200, 1440, 900).left).toBe(1400 - 240);
  });
  it('Shift+F10 y la tecla Menú abren el menú; F10 solo o con Ctrl, no', () => {
    const k = (key: string, mods: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => isContextMenuKey({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });
    expect(k('F10', { shiftKey: true })).toBe(true);
    expect(k('ContextMenu')).toBe(true);
    expect(k('F10')).toBe(false);
    expect(k('F10', { shiftKey: true, ctrlKey: true })).toBe(false);
  });
  it('↑ ↓ Inicio Fin recorren las opciones dando la vuelta', () => {
    expect(moveIndex('ArrowDown', -1, 4)).toBe(0);
    expect(moveIndex('ArrowDown', 3, 4)).toBe(0);
    expect(moveIndex('ArrowUp', 0, 4)).toBe(3);
    expect(moveIndex('End', 1, 4)).toBe(3);
    expect(moveIndex('Home', 2, 4)).toBe(0);
    expect(moveIndex('ArrowRight', 0, 4)).toBeNull();
    expect(moveIndex('ArrowRight', 0, 4, 'horizontal')).toBe(1);
    expect(moveIndex('Enter', 0, 4)).toBeNull();
  });
  it('menú del lienzo y de arista: role=menu con opciones menuitem', () => {
    const html = render(createElement(PaneMenu, { x: 10, y: 10, onClose: () => {}, label: 'Lienzo', items: [{ label: 'Pegar aquí', onClick: () => {} }, { label: 'Borrar', onClick: () => {}, danger: true }] }));
    expect(html).toContain('role="menu"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(2);
  });
  it('menú del nodo: role=menu, título y secciones de presentación, todas las acciones son menuitem', () => {
    const html = render(createElement(NodeMenu, { x: 10, y: 10, nodeId: 'n1', onClose: () => {} }));
    expect(html).toMatch(/role="menu"[^>]*aria-label="Revisar"/);
    for (const label of ['Comentar', 'Quitar de esta vista', 'Borrar del modelo']) expect(html).toMatch(new RegExp(`role="menuitem"[^>]*>[^<]*(<[^>]+>)*[^<]*${label}`));
    expect(html).not.toMatch(/<button(?![^>]*role="menuitem")[^>]*class="ad-popover__item/);
    expect(MENU_ITEMS).toContain('menuitem');
  });
  it('el editor abre el menú con Shift+F10 / tecla Menú (sobre la selección) y el lienzo no recibe las teclas del menú', () => {
    const editor = read('Editor.tsx');
    expect(editor).toMatch(/isContextMenuKey\(e\)[\s\S]{0,200}openContextMenuFor\(selection\)/);
    expect(read('ui/menu.tsx')).toMatch(/e\.stopPropagation\(\)/);
  });
});

describe('16 · categorías de la paleta con su nombre y en su orden', () => {
  const items = BPMN.elementTypes.map(type => ({ type, dimmed: false }));
  it('usa el nombre de la categoría del pack (no el id) y respeta `order`', () => {
    const g = categoryGroups(items, BPMN.categories, 'General');
    expect(g.map(x => x.name)).toEqual(['Participantes', 'Actividades', 'Eventos']);
    expect(g[2]!.items[0]!.type.id).toBe('bpmn:StartEvent');
  });
  it('acepta que el tipo traiga ya el nombre (packs localizados) y deja al final las categorías libres', () => {
    const t = (id: string, category?: string): { type: ElementType } => ({ type: { id, name: id, category, fields: [] } });
    const g = categoryGroups([t('a', 'Eventos'), t('b', 'Mis cosas'), t('c'), t('d', 'activities')], BPMN.categories, 'General');
    expect(g.map(x => x.name)).toEqual(['Actividades', 'Eventos', 'Mis cosas', 'General']);
  });
  it('la paleta pinta los nombres traducidos, no los ids', () => {
    const html = render(createElement(Palette));
    expect(html).toContain('>Participantes</summary>');
    expect(html).toContain('>Actividades</summary>');
    expect(html).not.toMatch(/>(events|activities|participants)<\/summary>/);
    expect(html.indexOf('Participantes')).toBeLessThan(html.indexOf('Actividades'));
  });
});

describe('74 · el tooltip de la paleta no enseña ids internos', () => {
  it('con descripción, la descripción; sin ella, sin title', () => {
    const html = render(createElement(Palette));
    expect(html).toContain('title="Trabajo atómico."');
    expect(html).not.toMatch(/title="bpmn:/);
  });
});

describe('19 · paleta y vistas con teclado; clic en un tipo lo añade', () => {
  it('los tipos de la paleta son botones (clic, Intro o Espacio los añaden) y se navega con flechas', () => {
    const html = render(createElement(Palette));
    expect(html.match(/class="ad-pal__item[^"]*"[^>]*role="button"/g)?.length).toBeGreaterThanOrEqual(3);
    const pal = read('panels/Palette.tsx');
    expect(pal).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/);
    expect(pal).toMatch(/useRoving\(scroll, PAL_NAV\)/);
    // TypeItem ya no es un componente definido en el render (rehacía los elementos y se perdía el foco)
    expect(pal).not.toMatch(/<TypeItem/);
  });
  it('cada vista es un botón propio (enfocable) y Supr con la vista enfocada la borra', () => {
    const html = render(createElement(ViewsPanel));
    expect(html).toMatch(/<button type="button" class="ad-views__open" aria-current="page"[^>]*>Proceso<\/button>/);
    expect(read('panels/ViewsPanel.tsx')).toMatch(/e\.key === 'Delete'/);
  });
});

describe('63 · añadir sin arrastrar busca un hueco libre cerca del centro', () => {
  const bounds = { x: 0, y: 0, w: 800, h: 600 };
  const center = { x: 400, y: 300 };
  const size = { w: 160, h: 56 };
  const ov = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
    p.x - size.w / 2 < r.x + r.w && r.x < p.x + size.w / 2 && p.y - size.h / 2 < r.y + r.h && r.y < p.y + size.h / 2;
  it('centro libre: el centro', () => {
    expect(freeSpot(center, size, [], [], bounds)).toEqual(center);
  });
  it('centro ocupado: el hueco más cercano que no pisa a nadie', () => {
    const obstacles = [{ x: 300, y: 260, w: 200, h: 80 }, { x: 300, y: 160, w: 200, h: 80 }];
    const p = freeSpot(center, size, obstacles, [], bounds);
    expect(obstacles.some(o => ov(p, o))).toBe(false);
    expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeLessThan(300);
  });
  it('puede caer dentro de un contenedor (pool, grupo) pero no a caballo de su borde', () => {
    const pool = { x: 100, y: 100, w: 600, h: 400 };
    const p = freeSpot(center, size, [{ x: 300, y: 260, w: 200, h: 80 }], [pool], bounds);
    expect(p.x - size.w / 2).toBeGreaterThanOrEqual(pool.x);
    expect(p.y + size.h / 2).toBeLessThanOrEqual(pool.y + pool.h);
  });
  it('sin hueco: el centro', () => {
    expect(freeSpot(center, size, [bounds], [], bounds)).toEqual(center);
  });
  it('tamaño y contenedores salen del modelo', () => {
    const { store } = demo();
    const reg = registry();
    store.set('elements', 'p', makeElement('bpmn:Pool', 'Banco', { id: 'p' }));
    store.set('nodes', 'np', makeNode('v1', 'p', { x: 0, y: 0, w: 600, h: 300 }, { id: 'np' }));
    expect([...containerNodeIds(store, reg, 'v1')]).toEqual(['np']);
    expect(paletteItemSize({ kind: DND_TYPE, data: 'bpmn:StartEvent' }, store, reg)).toEqual({ w: 40, h: 40 });
    expect(paletteItemSize({ kind: DND_VISUAL, data: JSON.stringify({ visualType: 'core:note' }) }, store, reg)).toEqual({ w: 180, h: 90 });
  });
});

describe('20 · Ctrl+K, Atajos y Espacio retienen el foco y lo devuelven', () => {
  const el = (id: string) => ({ id }) as unknown as HTMLElement;
  const [a, b, c] = [el('a'), el('b'), el('c')];
  it('Tab en el último vuelve al primero; Shift+Tab en el primero, al último; fuera de la caja, dentro', () => {
    expect(trapTarget([a, b, c], c, false, true)).toBe(a);
    expect(trapTarget([a, b, c], a, true, true)).toBe(c);
    expect(trapTarget([a, b, c], b, false, true)).toBeNull();
    expect(trapTarget([a, b, c], null, false, false)).toBe(a);
    expect(trapTarget([a, b, c], null, true, false)).toBe(c);
    expect(trapTarget([], null, false, false)).toBeNull();
  });
  it('los tres diálogos usan el mismo hook modal (sin `autoFocus`, que adelantaba el foco y perdía a quien abrió)', () => {
    for (const f of ['panels/CommandPalette.tsx', 'panels/ShortcutsPanel.tsx', 'panels/WorkspacePanel.tsx']) {
      const src = read(f);
      expect(src, f).toMatch(/useModal\(open, onClose/);
      expect(src, f).toMatch(/ref=\{box\}/);
      expect(src, f).not.toMatch(/autoFocus/);
    }
    expect(render(createElement(ShortcutsPanel, { open: true, onClose: () => {} }))).toContain('data-autofocus');
  });
});

describe('46 · semántica de pestañas', () => {
  it('TabList: tablist, tabs con aria-selected/aria-controls y una sola parada de Tab', () => {
    const ids = { base: 'x' };
    const html = renderToStaticMarkup(createElement(TabList, { ids, label: 'Secciones', value: 'b', onChange: () => {}, tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }));
    expect(html).toContain('role="tablist" aria-label="Secciones"');
    expect(html).toContain(`id="${tabId(ids, 'b')}" aria-selected="true" aria-controls="${panelId(ids)}" tabindex="0"`);
    expect(html).toContain(`id="${tabId(ids, 'a')}" aria-selected="false" aria-controls="${panelId(ids)}" tabindex="-1"`);
    expect(tabPanelProps(ids, 'b')).toMatchObject({ role: 'tabpanel', id: panelId(ids), 'aria-labelledby': tabId(ids, 'b') });
  });
  it('inspector de nodo: Datos/Pines/Dónde/Estilo como pestañas con su panel', () => {
    const html = render(createElement(NodeInspector, { nodeId: 'n1' }));
    expect(html).toContain('role="tablist" aria-label="Secciones del inspector"');
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    const panel = /role="tabpanel" id="([^"]+)" aria-labelledby="([^"]+)"/.exec(html);
    expect(panel).not.toBeNull();
    expect(html).toContain(`id="${panel![2]}" aria-selected="true" aria-controls="${panel![1]}"`);
  });
  it('panel Espacio: pestañas con su panel', () => {
    const html = render(createElement(WorkspacePanel, { open: true, onClose: () => {} }));
    expect(html).toContain('role="tablist" aria-label="Secciones del espacio"');
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html).toContain('role="tabpanel"');
  });
});

describe('28 · sin casilla «Pública»: compartir en solo lectura', () => {
  it('sin acción de la app, remite al botón Compartir', () => {
    const html = render(createElement(Inspector));
    expect(html).not.toContain('Pública');
    expect(html).not.toMatch(/type="checkbox"/);
    expect(html).toContain('usa el botón Compartir');
  });
  it('con `onShare`, un enlace «Compartir en solo lectura…»', () => {
    const html = render(createElement(Inspector), { onShare: () => {} });
    expect(html).toMatch(/<button type="button" class="ad-link ad-insp__share"[^>]*>.*Compartir en solo lectura…<\/button>/);
  });
  it('el manual ya no menciona la casilla', () => {
    for (const f of ['../../../docs/manual/modelo-y-vistas.md', '../../../docs/manual/en/modelo-y-vistas.md']) {
      expect(read(f)).not.toMatch(/\*\*Pública \(solo lectura con enlace\)\*\*|\*\*Public \(read-only via link\)\*\*/);
    }
  });
});

describe('18 · matriz de trazabilidad', () => {
  it('no se aplasta: los hijos del panel no encogen y la matriz tiene alto propio', () => {
    const css = read('editor.css');
    expect(css).toMatch(/\.ad-tr-main > \* \{ flex-shrink: 0; \}/);
    expect(css).toMatch(/\.ad-tr-scroll \{ max-height: max\(320px, 58vh\); \}/);
  });
  it('los tipos de librería salen como «Librerías», no como «lib»', () => {
    const store = new MemoryStore();
    const reg = registry();
    reg.registerLibraryTypes({ id: 'acme', elementTypes: [{ id: 'lib:acme:svc', name: 'Servicio', fields: [] }], relationTypes: [], portTypes: [] });
    store.set('elements', 'a', makeElement('lib:acme:svc', 'Pagos', { id: 'a' }));
    store.set('elements', 'b', makeElement('archimate:BusinessActor', 'Cliente', { id: 'b' }));
    const html = render(createElement(TracesTab), { store, reg, viewId: null });
    expect(html).toContain('>Librerías</option>');
    expect(html).not.toContain('>lib</option>');
  });
});

describe('62 · móvil: elegir una vista cierra la hoja', () => {
  it('la hoja Vistas pasa `onOpen` y el panel lo llama al abrir o crear', () => {
    expect(read('Editor.tsx')).toMatch(/<ViewsPanel onOpen=\{\(\) => setSheet\(null\)\} \/>/);
    const vp = read('panels/ViewsPanel.tsx');
    expect(vp.match(/onOpen\?\.\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('70 · barra superior', () => {
  it('el nombre del espacio se ve entero y el chip de la notación no se corta', () => {
    const css = read('editor.css');
    expect(css).toMatch(/\.ad-toolbar > input \{ field-sizing: content;[^}]*flex: none;/);
    expect(css).toMatch(/\.ad-crumb__notation \{ flex: none; white-space: nowrap; \}/);
    expect(css).toMatch(/\.ad-crumb \.ad-link \{[^}]*text-overflow: ellipsis;/);
  });
});
