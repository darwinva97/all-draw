/**
 * **Exportar a PDF** (vectorial, sin navegador): `exportPdf(store, reg, viewIds | 'all', opts) → { bytes, warnings, pages }`.
 *
 * Una página por vista: cabecera con el nombre de la vista y el del espacio (y la notación), el dibujo de `renderSvg`
 * (tema claro, sin fondo) traducido a operadores PDF por `svg-pdf.ts`, y pie con el número de página. El texto es texto
 * de verdad (Helvetica estándar: seleccionable y buscable). Metadatos: título, autor, asunto, fecha, idioma y un
 * marcador por vista.
 *
 * Por qué así y no con una librería: `svg2pdf.js` + `jsPDF` necesitan un DOM (en Node, jsdom) y pesan ~400 kB; `pdf-lib`
 * (~300 kB) no sabe de SVG, así que habría que traducir el SVG igualmente. El escritor propio ocupa unas 200 líneas y
 * la traducción, unas 400; lo único externo es `fflate` (ya usado para draw.io y Visio) para comprimir los flujos.
 * Límite conocido: las fuentes estándar del PDF solo cubren Latin-1 (y €, comillas, guiones…); los caracteres fuera de
 * ese juego (emojis, alfabetos no latinos) se omiten con aviso.
 */
import type { NotationRegistry, Store } from '@all-draw/core';
import { renderSvg } from './svg';
import { svgToPdfOps, svgViewBox } from './svg-pdf';
import { buildPdf, encodeWinAnsi, pdfString, textWidth, n, FONT_RES, type PdfPage } from './pdf-writer';
import { tr, ioLang } from './i18n';

export type PdfPageSize = 'a4' | 'a3' | 'fit';
export interface PdfOptions {
  /** Tamaño de página: A4 o A3, o ajustado al dibujo (por defecto A4). */
  pageSize?: PdfPageSize;
  /** Orientación de A4/A3 (por defecto apaisada; `auto` según la forma de cada vista). */
  orientation?: 'landscape' | 'portrait' | 'auto';
  /** Título del documento (por defecto, el nombre del espacio). */
  title?: string;
  author?: string;
  subject?: string;
  /** Fecha de creación (por defecto, ahora). */
  date?: Date;
  /** Margen en puntos (por defecto 36 = 1,27 cm). */
  margin?: number;
  /** Sin cabecera ni pie (solo el dibujo). */
  bare?: boolean;
}
export interface PdfExport { bytes: Uint8Array; warnings: string[]; pages: number }

const SIZES: Record<'a4' | 'a3', [number, number]> = { a4: [841.89, 595.28], a3: [1190.55, 841.89] };
/** Píxel CSS → punto: 72/96. Escala máxima (los dibujos pequeños no se agrandan). */
const PX = 0.75;

export function exportPdf(store: Store, reg: NotationRegistry, viewIds: string[] | 'all', opts: PdfOptions = {}): PdfExport {
  const warnings: string[] = [];
  const meta = store.meta();
  const all = store.list('views');
  const hasNodes = new Set(store.list('nodes').map(nd => nd.viewId));
  let views = viewIds === 'all' ? all.filter(v => hasNodes.has(v.id)) : viewIds.map(id => store.get('views', id)).filter((v): v is NonNullable<typeof v> => !!v);
  if (viewIds !== 'all') for (const id of viewIds) if (!store.get('views', id)) warnings.push(tr('No existe la vista {view}', { view: id }));
  if (viewIds === 'all' && all.length > views.length) warnings.push(tr('Las vistas vacías no se incluyen en el PDF ({n})', { n: all.length - views.length }));
  if (!views.length) views = [];
  const margin = opts.margin ?? 36;
  const alphas: number[] = [];
  const alpha = (a: number) => { let i = alphas.indexOf(a); if (i < 0) { alphas.push(a); i = alphas.length - 1; } return `G${i}`; };
  const missing = new Set<string>();
  const pages: PdfPage[] = [];
  const workspaceName = meta.name || tr('Sin nombre');

  views.forEach((view, idx) => {
    const svg = renderSvg(store, reg, view.id, { theme: 'light', background: 'transparent', bare: true, idPrefix: `p${idx}`, padding: 8 });
    const [vx, vy, vw, vh] = svgViewBox(svg);
    const head = opts.bare ? 0 : 46, foot = opts.bare ? 0 : 22;
    let W: number, H: number;
    const size = opts.pageSize ?? 'a4';
    if (size === 'fit') {
      // Página del tamaño del dibujo (a escala 1 px = 0,75 pt), con límite de 200 pulgadas (14 400 pt) por lado.
      const k = Math.min(PX, (14400 - 2 * margin) / vw, (14400 - 2 * margin - head - foot) / vh);
      W = Math.max(200, vw * k + 2 * margin); H = vh * k + 2 * margin + head + foot;
    } else {
      const [a, b] = SIZES[size];
      const orient = opts.orientation ?? 'landscape';
      const landscape = orient === 'landscape' || (orient === 'auto' && vw >= vh);
      [W, H] = landscape ? [a, b] : [b, a];
    }
    const areaW = W - 2 * margin, areaH = H - 2 * margin - head - foot;
    const s = Math.min(PX, areaW / vw, areaH / vh);
    const top = H - margin - head;
    const ox = margin + (areaW - vw * s) / 2;
    const base: [number, number, number, number, number, number] = [s, 0, 0, -s, ox - vx * s, top + vy * s];
    const r = svgToPdfOps(svg, { base, alpha });
    for (const c of r.missingChars) missing.add(c);

    const parts: string[] = [];
    if (!opts.bare) {
      const text = (str: string, x: number, y: number, size: number, font: 'regular' | 'bold', gray: number) => {
        const e = encodeWinAnsi(str); for (const c of e.missing) missing.add(c);
        parts.push(`BT /${FONT_RES[font]} ${n(size)} Tf ${n(gray)} g ${n(x)} ${n(y)} Td ${pdfString(e.bytes)} Tj ET`);
      };
      const clip = (str: string, size: number, font: 'regular' | 'bold', max: number) => { let t = str; while (t.length > 1 && textWidth(t, size, font === 'bold') > max) t = t.slice(0, -2) + '…'; return t; };
      text(clip(view.name || tr('Vista'), 15, 'bold', areaW), margin, H - margin - 15, 15, 'bold', 0.1);
      const notation = reg.pack(view.notationId)?.name ?? view.notationId;
      text(clip(`${workspaceName} · ${tr(notation)}`, 9, 'regular', areaW), margin, H - margin - 31, 9, 'regular', 0.42);
      parts.push(`0.85 G 0.5 w ${n(margin)} ${n(H - margin - 39)} m ${n(W - margin)} ${n(H - margin - 39)} l S`);
      const pageNo = `${idx + 1} / ${views.length}`;
      text(pageNo, W - margin - textWidth(pageNo, 8), margin - 12, 8, 'regular', 0.5);
      text(clip(workspaceName, 8, 'regular', areaW - 60), margin, margin - 12, 8, 'regular', 0.5);
    }
    parts.push('q', r.ops, 'Q');
    pages.push({ width: W, height: H, content: parts.join('\n'), title: view.name || tr('Vista') });
  });

  if (!pages.length) {
    // Sin vistas que dibujar: una página con el aviso (un PDF sin páginas no es válido).
    const msg = tr('El espacio no tiene vistas con contenido.');
    const e = encodeWinAnsi(msg);
    pages.push({ width: SIZES.a4[0], height: SIZES.a4[1], content: `BT /F1 14 Tf 0.3 g 72 500 Td ${pdfString(e.bytes)} Tj ET` });
    warnings.push(msg);
  }
  if (missing.size) warnings.push(tr('Algunos caracteres no existen en la fuente estándar del PDF y se han omitido: {chars}', { chars: [...missing].slice(0, 20).join(' ') }));
  const bytes = buildPdf(pages, alphas, {
    title: opts.title ?? (views.length === 1 && viewIds !== 'all' ? `${workspaceName} — ${views[0]!.name}` : workspaceName),
    author: opts.author, subject: opts.subject ?? meta.description ?? undefined, date: opts.date, lang: ioLang(),
    keywords: [...new Set(views.map(v => reg.pack(v.notationId)?.name ?? v.notationId))].join(', '),
  });
  return { bytes, warnings, pages: pages.length };
}
