/**
 * Escritor mínimo de PDF 1.7 (sin dependencias salvo la compresión): páginas con flujos de contenido comprimidos
 * (`/FlateDecode`), las cuatro Helvetica estándar con `WinAnsiEncoding` (texto seleccionable y buscable, sin incrustar
 * fuentes), estados gráficos para la transparencia, marcadores (índice) y metadatos (`/Info`, idioma, título visible).
 *
 * Las Helvetica estándar solo cubren Latin-1 y unos pocos signos (€, comillas tipográficas, guiones…): `encodeWinAnsi`
 * sustituye lo demás (flechas → `->`) y devuelve lo que no pudo escribir para avisar.
 */
import { deflateZlib } from './compress';

// ---------------------------------------------------------------- Métricas de Helvetica (AFM de Adobe, 1/1000 em)
const REG_ASCII = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584'.split(',').map(Number);
const BOLD_ASCII = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584'.split(',').map(Number);
/** 0xA0–0xFF (Latin-1) en Helvetica normal. */
const REG_LATIN1 = '278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500'.split(',').map(Number);
/** Unicode → byte WinAnsi para 0x80–0x9F, con su ancho. */
const WIN_EXTRA: Record<number, [number, number]> = {
  0x20ac: [0x80, 556], 0x201a: [0x82, 222], 0x0192: [0x83, 556], 0x201e: [0x84, 333], 0x2026: [0x85, 1000], 0x2020: [0x86, 556], 0x2021: [0x87, 556],
  0x02c6: [0x88, 333], 0x2030: [0x89, 1000], 0x0160: [0x8a, 667], 0x2039: [0x8b, 333], 0x0152: [0x8c, 1000], 0x017d: [0x8e, 611], 0x2018: [0x91, 222],
  0x2019: [0x92, 222], 0x201c: [0x93, 333], 0x201d: [0x94, 333], 0x2022: [0x95, 350], 0x2013: [0x96, 556], 0x2014: [0x97, 1000], 0x02dc: [0x98, 333],
  0x2122: [0x99, 1000], 0x0161: [0x9a, 500], 0x203a: [0x9b, 333], 0x0153: [0x9c, 944], 0x017e: [0x9e, 500], 0x0178: [0x9f, 667],
};
/** Sustitutos legibles para signos frecuentes que la fuente no tiene. */
const SUBST: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇄': '<->', '⇒': '=>', '⤵': '»', '✓': 'v', '✔': 'v', '✕': 'x', '✗': 'x', '−': '-', '‐': '-', '‑': '-',
  '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ', '\t': ' ', '⋯': '...', '≤': '<=', '≥': '>=', '≠': '!=',
};

export interface Encoded { bytes: number[]; missing: string[] }
/** Texto → bytes WinAnsi (con sustitutos); `missing` son los caracteres que no se pudieron escribir. */
export function encodeWinAnsi(text: string): Encoded {
  const bytes: number[] = [], missing: string[] = [];
  for (const ch of text) {
    const sub = SUBST[ch];
    if (sub !== undefined && sub !== ch) { for (const c of sub) bytes.push(c.charCodeAt(0)); continue; }
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) bytes.push(cp);
    else if (WIN_EXTRA[cp]) bytes.push(WIN_EXTRA[cp]![0]);
    else {
      // Letra con diacríticos fuera de Latin-1 (ő, č…): la base sin acento antes que nada.
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (base && base !== ch && /^[\x20-\x7e]+$/.test(base)) bytes.push(...[...base].map(c => c.charCodeAt(0)));
      else if (cp >= 0x20 && !/\p{M}/u.test(ch) && !/\s/.test(ch)) missing.push(ch);
    }
  }
  return { bytes, missing };
}

const byteToUnicode = new Map<number, number>(Object.entries(WIN_EXTRA).map(([u, [b]]) => [b, Number(u)]));
/** Ancho (en unidades de 1/1000 em) de un byte WinAnsi. */
function byteWidth(b: number, bold: boolean): number {
  if (b >= 0x20 && b <= 0x7e) return (bold ? BOLD_ASCII : REG_ASCII)[b - 0x20]!;
  if (b >= 0xa0) {
    if (!bold) return REG_LATIN1[b - 0xa0]!;
    // En negrita: el ancho de la letra base (á → a) o el normal.
    const base = String.fromCharCode(b).normalize('NFD').charCodeAt(0);
    return base < 0x7f && base >= 0x20 ? BOLD_ASCII[base - 0x20]! : REG_LATIN1[b - 0xa0]!;
  }
  const u = byteToUnicode.get(b);
  return u !== undefined ? WIN_EXTRA[u]![1] : 556;
}
/** Ancho de un texto en Helvetica (puntos) a `size`. */
export function textWidth(text: string, size: number, bold = false): number {
  const { bytes } = encodeWinAnsi(text);
  let w = 0; for (const b of bytes) w += byteWidth(b, bold);
  return (w * size) / 1000;
}
/** Ancho de unos bytes WinAnsi ya codificados (puntos) a `size`. */
export function bytesWidth(bytes: number[], size: number, bold = false): number {
  let w = 0; for (const b of bytes) w += byteWidth(b, bold);
  return (w * size) / 1000;
}
/** Cadena literal de PDF `( … )` con los bytes dados (escapes de `\`, paréntesis y no ASCII en octal). */
export function pdfString(bytes: number[]): string {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b < 0x20 || b > 0x7e) s += `\\${b.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(b);
  }
  return `${s})`;
}
/** Texto de metadatos/marcadores: ASCII tal cual; si no, UTF-16BE con BOM en hexadecimal. */
export function pdfTextString(text: string): string {
  if (/^[\x20-\x7e]*$/.test(text)) return pdfString([...text].map(c => c.charCodeAt(0)));
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}
/** Número para el flujo de contenido (hasta 3 decimales, sin ceros de más). */
export const n = (v: number): string => { if (!Number.isFinite(v)) return '0'; const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? '0' : String(r); };

// ---------------------------------------------------------------- Documento
export const FONTS = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' } as const;
export type FontKey = keyof typeof FONTS;
export const FONT_RES: Record<FontKey, string> = { regular: 'F1', bold: 'F2', italic: 'F3', boldItalic: 'F4' };

export interface PdfPage { width: number; height: number; content: string; title?: string }
export interface PdfMeta { title?: string; author?: string; subject?: string; keywords?: string; creator?: string; producer?: string; date?: Date; lang?: string }

/** Monta el PDF: páginas (contenido ya en operadores), transparencias usadas (`/G<n>` → alfa) y metadatos. */
export function buildPdf(pages: PdfPage[], alphas: number[], meta: PdfMeta = {}): Uint8Array {
  const enc = new TextEncoder();
  const objs: (Uint8Array | string)[] = [];            // índice + 1 = número de objeto
  const add = (o: Uint8Array | string) => { objs.push(o); return objs.length; };
  const reserve = () => { objs.push(''); return objs.length; };
  const set = (id: number, o: Uint8Array | string) => { objs[id - 1] = o; };

  const catalogId = reserve(), pagesId = reserve();
  const fontIds = (Object.keys(FONTS) as FontKey[]).map(k => [FONT_RES[k], add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONTS[k]} /Encoding /WinAnsiEncoding >>`)] as const);
  const gsIds = alphas.map((a, i) => [`G${i}`, add(`<< /Type /ExtGState /ca ${n(a)} /CA ${n(a)} >>`)] as const);
  const resId = add(`<< /ProcSet [/PDF /Text] /Font << ${fontIds.map(([k, id]) => `/${k} ${id} 0 R`).join(' ')} >>${gsIds.length ? ` /ExtGState << ${gsIds.map(([k, id]) => `/${k} ${id} 0 R`).join(' ')} >>` : ''} >>`);
  const pageIds: number[] = [];
  for (const p of pages) {
    const data = deflateZlib(enc.encode(p.content));
    const head = enc.encode(`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`);
    const tail = enc.encode('\nendstream');
    const stream = new Uint8Array(head.length + data.length + tail.length);
    stream.set(head, 0); stream.set(data, head.length); stream.set(tail, head.length + data.length);
    const contentId = add(stream);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(p.width)} ${n(p.height)}] /Resources ${resId} 0 R /Contents ${contentId} 0 R >>`));
  }
  set(pagesId, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

  // Marcadores: uno por página con título.
  let outlinesId = 0;
  const marked = pages.map((p, i) => ({ title: p.title, page: pageIds[i]! })).filter(x => x.title);
  if (marked.length) {
    outlinesId = reserve();
    const itemIds = marked.map(() => reserve());
    marked.forEach((m, i) => set(itemIds[i]!, `<< /Title ${pdfTextString(m.title!)} /Parent ${outlinesId} 0 R${i ? ` /Prev ${itemIds[i - 1]} 0 R` : ''}${i < marked.length - 1 ? ` /Next ${itemIds[i + 1]} 0 R` : ''} /Dest [${m.page} 0 R /Fit] >>`));
    set(outlinesId, `<< /Type /Outlines /First ${itemIds[0]} 0 R /Last ${itemIds[itemIds.length - 1]} 0 R /Count ${itemIds.length} >>`);
  }
  const d = meta.date ?? new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  const date = `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const info: string[] = [];
  if (meta.title) info.push(`/Title ${pdfTextString(meta.title)}`);
  if (meta.author) info.push(`/Author ${pdfTextString(meta.author)}`);
  if (meta.subject) info.push(`/Subject ${pdfTextString(meta.subject)}`);
  if (meta.keywords) info.push(`/Keywords ${pdfTextString(meta.keywords)}`);
  info.push(`/Creator ${pdfTextString(meta.creator ?? 'all-draw')}`, `/Producer ${pdfTextString(meta.producer ?? 'all-draw (@all-draw/io)')}`, `/CreationDate (${date})`, `/ModDate (${date})`);
  const infoId = add(`<< ${info.join(' ')} >>`);
  set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesId ? ` /Outlines ${outlinesId} 0 R /PageMode /UseOutlines` : ''}${meta.lang ? ` /Lang ${pdfTextString(meta.lang)}` : ''} /ViewerPreferences << /DisplayDocTitle true >> >>`);

  // ---- serialización con tabla xref
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; chunks.push(u); offset += u.length; };
  push('%PDF-1.7\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));   // comentario binario: avisa a los transportes de que no es texto
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(offset); push(`${i + 1} 0 obj\n`); push(o); push('\nendobj\n'); });
  const xref = offset;
  push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  // Identificador estable: suma simple del contenido (no hace falta criptografía).
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const c of chunks) for (let i = 0; i < c.length; i += 7) { h1 = Math.imul(h1 ^ c[i]!, 16777619) >>> 0; h2 = Math.imul(h2 + c[i]!, 2654435761) >>> 0; }
  const id = `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.repeat(2);
  push(`trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(offset);
  let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
