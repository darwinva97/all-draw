import { describe, it, expect } from 'vitest';
import { unzlibSync } from 'fflate';
import { MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, makeView } from '@all-draw/core';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { GRID_PACK } from '@all-draw/notation-grid';
import { exportPdf, svgToPdfOps, parsePath, parseColor, parseTransform, textWidth, encodeWinAnsi } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(FREEFORM_PACK).register(ARCHIMATE_PACK).register(BPMN_PACK).register(GRID_PACK);
const latin1 = (b: Uint8Array) => Array.from(b, c => String.fromCharCode(c)).join('');

/** Lector mínimo de PDF para los tests: objetos por número, flujos descomprimidos y comprobación de la tabla xref. */
function readPdf(bytes: Uint8Array) {
  const s = latin1(bytes);
  const startxref = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(s)![1]);
  const xref = s.slice(startxref);
  expect(xref.startsWith('xref')).toBe(true);
  const offsets = [...xref.matchAll(/(\d{10}) 00000 n /g)].map(m => Number(m[1]));
  offsets.forEach((o, i) => expect(s.slice(o, o + 12).startsWith(`${i + 1} 0 obj`)).toBe(true));
  const obj = (id: number) => { const o = offsets[id - 1]!; return s.slice(o, s.indexOf('endobj', o)); };
  const streams = (): string[] => offsets.map((_, i) => obj(i + 1)).filter(t => t.includes('/FlateDecode')).map(t => {
    const start = t.indexOf('stream\n') + 7, len = Number(/\/Length (\d+)/.exec(t)![1]);
    const raw = Uint8Array.from(t.slice(start, start + len), c => c.charCodeAt(0));
    return latin1(unzlibSync(raw));
  });
  return { s, obj, streams, count: offsets.length };
}

describe('exportPdf', () => {
  const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
  const date = new Date('2026-10-05T10:00:00Z');

  it('PDF válido: cabecera, tabla xref correcta, una página A4 apaisada por vista, texto real y metadatos', () => {
    const r = exportPdf(store, reg(), 'all', { date, author: 'Ana' });
    const withNodes = new Set(store.list('nodes').map(x => x.viewId)).size;
    expect(r.pages).toBe(withNodes);
    expect(latin1(r.bytes.subarray(0, 8))).toBe('%PDF-1.7');
    const pdf = readPdf(r.bytes);
    expect(pdf.s).toMatch(/\/MediaBox \[0 0 841\.89 595\.28\]/);
    expect(pdf.s).toMatch(/\/BaseFont \/Helvetica /);
    expect(pdf.s).toMatch(/\/Encoding \/WinAnsiEncoding/);
    expect(pdf.s).toMatch(/\/Author \(Ana\)/);
    expect(pdf.s).toMatch(/\/CreationDate \(D:20261005100000Z\)/);
    expect(pdf.s).toMatch(/\/Outlines \d+ 0 R \/PageMode \/UseOutlines/);
    const content = pdf.streams().join('\n');
    // título de la vista, nombre del espacio y etiquetas de los nodos como texto seleccionable
    expect(content).toMatch(/\(Mapa\) Tj/);
    for (const name of Object.values(store.snapshot().elements).map(e => e.name)) expect(content).toContain(`(${name}) Tj`);
    expect(content).toMatch(/ re\b| c\n| l\n/);
  });

  it('determinista con la misma fecha', () => {
    const a = exportPdf(store, reg(), 'all', { date }).bytes, b = exportPdf(store, reg(), 'all', { date }).bytes;
    expect(latin1(a)).toBe(latin1(b));
  });

  it('A3, vertical y ajustado al dibujo', () => {
    expect(readPdf(exportPdf(store, reg(), ['vw_1'], { pageSize: 'a3', date }).bytes).s).toMatch(/\/MediaBox \[0 0 1190\.55 841\.89\]/);
    expect(readPdf(exportPdf(store, reg(), ['vw_1'], { orientation: 'portrait', date }).bytes).s).toMatch(/\/MediaBox \[0 0 595\.28 841\.89\]/);
    const fit = readPdf(exportPdf(store, reg(), ['vw_1'], { pageSize: 'fit', date }).bytes).s;
    const [, w, h] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(fit)!.map(Number);
    expect(w).toBeLessThan(841); expect(h).toBeLessThan(595);
  });

  it('varias vistas: una página y un marcador por vista (las vacías se omiten con aviso); acentos en WinAnsi', () => {
    const s2 = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const v = makeView('Vacía', { id: 'vacia' }); s2.set('views', v.id, v);
    const v2 = makeView('Segunda vista', { id: 'v2' }); s2.set('views', v2.id, v2);
    s2.set('nodes', 'n2', { id: 'n2', viewId: 'v2', visualType: 'core:note', text: 'Ñandú → café 😀', x: 0, y: 0, w: 160, h: 60, style: {} });
    const r = exportPdf(s2, reg(), 'all', { date });
    const withNodes = new Set(s2.list('nodes').map(x => x.viewId)).size;
    expect(r.pages).toBe(withNodes);
    expect(r.warnings.join('\n')).toMatch(/vacías/);
    expect(r.warnings.join('\n')).toMatch(/😀/);
    const pdf = readPdf(r.bytes);
    expect(pdf.s.match(/\/Title /g)!.length).toBe(withNodes + 1); // documento + un marcador por página
    const all = pdf.streams().join('\n');
    expect(all).toContain('(\\321and\\372 -> caf\\351) Tj');
  });

  it('sin vistas: una página con el aviso (nunca un PDF sin páginas)', () => {
    const empty = new MemoryStore(parseWorkspace({ meta: { name: 'Nada' } }));
    const r = exportPdf(empty, reg(), 'all', { date });
    expect(r.pages).toBe(1);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('SVG → PDF', () => {
  const base = [1, 0, 0, -1, 0, 100] as [number, number, number, number, number, number];
  const alphas: number[] = [];
  const alpha = (a: number) => { alphas.push(a); return `G${alphas.length - 1}`; };

  it('cascada CSS: clases, descendientes, especificidad, var() y color-mix()', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="ad-svg" viewBox="0 0 100 100"><style>svg.ad-svg{--c:#ff0000;--p:#ffffff}.a rect{fill:var(--c)}.a .b{fill:#00ff00}.m{fill:color-mix(in srgb, #000000 50%, var(--p))}</style>
      <g class="a"><rect width="10" height="10"/><rect class="b" width="10" height="10" fill="#0000ff"/></g><rect class="m" width="1" height="1" style="opacity:.5"/></svg>`;
    const { ops } = svgToPdfOps(svg, { base, alpha });
    expect(ops).toMatch(/^1 0 0 rg$/m);
    expect(ops).toMatch(/^0 1 0 rg$/m);
    expect(ops).toMatch(/^0\.5 0\.5 0\.5 rg$/m);
    expect(ops).toMatch(/\/G\d+ gs/);
    expect(alphas).toContain(0.5);
  });

  it('texto: anclaje centrado con el ancho real de Helvetica, línea base central, negrita y tspans', () => {
    const svg = '<svg viewBox="0 0 100 100"><text x="50" y="20" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700"><tspan x="50" dy="0">Hola</tspan><tspan x="50" dy="12">mundo</tspan></text></svg>';
    const { ops } = svgToPdfOps(svg, { base, alpha });
    const w = textWidth('Hola', 10, true);
    expect(ops).toContain(`/F2 10 Tf`);
    expect(ops).toContain(`1 0 0 1 ${Math.round((50 - w / 2) * 1000) / 1000} ${100 - 23.5} Tm`);
    expect(ops).toContain('(mundo) Tj');
  });

  it('trazados: arcos a cúbicas, H/V relativos, Q y transformaciones', () => {
    const segs = parsePath('M0,0 h10 v10 a5,5 0 0 1 -10,0 Q 0 5 0 0 z');
    expect(segs.map(s => s.op).join('')).toBe('MLLCCCZ');
    const cs = segs.filter(s => s.op === 'C') as { x: number; y: number }[];
    expect(cs[0]!.x).toBeCloseTo(5, 6); expect(cs[0]!.y).toBeCloseTo(15, 6);   // punto medio del semicírculo
    expect(cs[1]).toMatchObject({ x: 0, y: 10 });
    expect(cs[2]).toMatchObject({ x: 0, y: 0 });
    expect(parseTransform('translate(10,20) scale(2)')).toEqual([2, 0, 0, 2, 10, 20]);
    const r = parseTransform('rotate(90 10 10)');
    expect(r.map(x => Math.round(x))).toEqual([0, 1, -1, 0, 20, 0]);
  });

  it('colores', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseColor('rgba(0,0,0,.02)')).toEqual({ r: 0, g: 0, b: 0, a: 0.02 });
    expect(parseColor('none')).toBeNull();
    expect(parseColor('color-mix(in srgb, #ff0000 25%, #ffffff)')).toMatchObject({ r: 255, g: 191.25, b: 191.25 });
  });

  it('WinAnsi: Latin-1, €, comillas tipográficas y sustitutos', () => {
    expect(encodeWinAnsi('€“á”')).toEqual({ bytes: [0x80, 0x93, 0xe1, 0x94], missing: [] });
    expect(encodeWinAnsi('a→b').bytes).toEqual([97, 45, 62, 98]);
    expect(encodeWinAnsi('漢').missing).toEqual(['漢']);
    expect(textWidth('Hola', 10)).toBeCloseTo((722 + 556 + 222 + 556) / 100, 5);
  });
});
