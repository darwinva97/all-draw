/**
 * Renderizador mínimo de Markdown → elementos React. Sin dependencias y sin `dangerouslySetInnerHTML`: todo el
 * texto pasa por React, que lo escapa; el HTML crudo del Markdown se muestra como texto (salvo las directivas
 * `<!-- docs:… -->`). Subconjunto soportado: ver `README.md`.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { useT } from '@all-draw/i18n';
import { docHref, isDocSlug } from './links';
import { GITHUB_REPO } from './chapters';
import { Icon } from './icons';

// ---------------------------------------------------------------- Bloques
export type Align = 'left' | 'center' | 'right' | null;
export type Callout = 'note' | 'tip' | 'important' | 'warning' | 'caution';
export type Block =
  | { t: 'h'; level: number; text: string; id: string }
  | { t: 'p'; text: string }
  | { t: 'img'; alt: string; src: string }
  | { t: 'list'; ordered: boolean; start: number; items: Block[][]; loose: boolean }
  | { t: 'table'; head: string[]; align: Align[]; rows: string[][] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; callout: Callout | null; blocks: Block[] }
  | { t: 'hr' }
  | { t: 'directive'; name: string; arg: string };

const FENCE = /^\s{0,3}(```+|~~~+)\s*([\w+-]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST = /^(\s*)([-*+]|(\d{1,9})[.)])(\s+|$)/;
const QUOTE = /^\s{0,3}>\s?/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const DIRECTIVE = /^\s*<!--\s*docs:([\w-]+)\s*(.*?)\s*-->\s*$/;
const IMG_LINE = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)\s*$/;
const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;

const indentOf = (s: string): number => { let n = 0; for (const ch of s) { if (ch === ' ') n++; else if (ch === '\t') n += 4; else break; } return n; };
const isBlank = (s: string): boolean => s.trim() === '';

/** Quita hasta `n` columnas de sangría. */
function dedent(s: string, n: number): string {
  let i = 0, col = 0;
  while (i < s.length && col < n && (s[i] === ' ' || s[i] === '\t')) { col += s[i] === '\t' ? 4 : 1; i++; }
  return s.slice(i);
}

/** "Sí, ¿qué es?" → "si-que-es". */
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[`*_~[\]()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
}

/** Separa `Título {#id}` en texto e id. */
function headingParts(raw: string): { text: string; id: string | null } {
  const m = /^(.*?)\s*\{#([\w-]+)\}\s*$/.exec(raw.replace(/\s+#+\s*$/, ''));
  return m ? { text: m[1]!, id: m[2]! } : { text: raw.replace(/\s+#+\s*$/, ''), id: null };
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || QUOTE.test(line) || HR.test(line) || DIRECTIVE.test(line) || /^\s{0,3}([-*+]|\d{1,9}[.)])\s+\S/.test(line) || /^\s*<!--/.test(line);
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '', code = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '`') code = !code;
    if (ch === '|' && !code) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

export function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) { i++; continue; }
    let m: RegExpExecArray | null;

    if ((m = FENCE.exec(line))) {
      const fence = m[1]!, lang = m[2] ?? '', ind = indentOf(line);
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(lines[i]!)) { body.push(dedent(lines[i]!, ind)); i++; }
      i++;
      out.push({ t: 'code', lang, text: body.join('\n') });
      continue;
    }
    if ((m = DIRECTIVE.exec(line))) { out.push({ t: 'directive', name: m[1]!, arg: m[2] ?? '' }); i++; continue; }
    if (/^\s*<!--/.test(line)) { while (i < lines.length && !lines[i]!.includes('-->')) i++; i++; continue; }
    if ((m = HEADING.exec(line))) {
      const { text, id } = headingParts(m[2]!);
      out.push({ t: 'h', level: m[1]!.length, text, id: id ?? slugify(text) });
      i++; continue;
    }
    if (HR.test(line)) { out.push({ t: 'hr' }); i++; continue; }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!)) { body.push(lines[i]!.replace(QUOTE, '')); i++; }
      let callout: Callout | null = null;
      const first = CALLOUT.exec(body[0]?.trim() ?? '');
      if (first) { callout = first[1]!.toLowerCase() as Callout; body.shift(); }
      out.push({ t: 'quote', callout, blocks: parseBlocks(body) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!)) {
      const head = splitRow(line);
      const align: Align[] = splitRow(lines[i + 1]!).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !isBlank(lines[i]!) && lines[i]!.includes('|')) { rows.push(splitRow(lines[i]!)); i++; }
      out.push({ t: 'table', head, align, rows });
      continue;
    }
    if (LIST.test(line)) {
      const res = parseList(lines, i);
      out.push(res.block); i = res.next;
      continue;
    }
    if ((m = IMG_LINE.exec(line)) && (i + 1 >= lines.length || isBlank(lines[i + 1]!) || startsBlock(lines[i + 1]!))) {
      out.push({ t: 'img', alt: m[1]!, src: m[2]! }); i++; continue;
    }
    // Párrafo: hasta línea en blanco o inicio de otro bloque.
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]!) && !startsBlock(lines[i]!) && !(lines[i]!.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!))) { para.push(lines[i]!.trim()); i++; }
    out.push({ t: 'p', text: para.join(' ') });
  }
  return out;
}

function parseList(lines: string[], from: number): { block: Block; next: number } {
  const first = LIST.exec(lines[from]!)!;
  const base = indentOf(first[1]!);
  const ordered = !!first[3];
  const start = ordered ? parseInt(first[3]!, 10) : 1;
  const items: string[][] = [];
  let loose = false;
  let i = from;
  let content = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = LIST.exec(line);
    if (m && Math.abs(indentOf(m[1]!) - base) <= 1 && !!m[3] === ordered) {
      content = indentOf(m[1]!) + m[2]!.length + Math.max(1, Math.min(m[4]!.length, 4));
      items.push([line.slice(m[0].length)]);
      i++; continue;
    }
    if (isBlank(line)) {
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j]!)) j++;
      if (j >= lines.length) break;
      const nx = lines[j]!, nm = LIST.exec(nx);
      if (indentOf(nx) > base && !(nm && indentOf(nm[1]!) <= base + 1)) { items[items.length - 1]!.push(''); loose = true; i++; continue; }
      if (nm && Math.abs(indentOf(nm[1]!) - base) <= 1 && !!nm[3] === ordered) { loose = true; i = j; continue; }
      break;
    }
    if (indentOf(line) > base) { items[items.length - 1]!.push(dedent(line, Math.min(indentOf(line), content))); i++; continue; }
    // Continuación perezosa de párrafo (sin sangría y sin empezar otro bloque).
    if (!startsBlock(line)) { items[items.length - 1]!.push(line.trim()); i++; continue; }
    break;
  }
  return { block: { t: 'list', ordered, start, items: items.map(it => parseBlocks(it)), loose }, next: i };
}

export function parseMarkdown(src: string): Block[] { return parseBlocks(src.replace(/\r\n?/g, '\n').split('\n')); }

/** Asigna ids únicos a los títulos (si dos coinciden, `-2`, `-3`…). Muta y devuelve los bloques. */
export function uniqueIds(blocks: Block[]): Block[] {
  const seen = new Map<string, number>();
  for (const b of blocks) if (b.t === 'h') {
    const n = seen.get(b.id) ?? 0;
    seen.set(b.id, n + 1);
    if (n) b.id = `${b.id}-${n + 1}`;
  }
  return blocks;
}

/** Texto plano de un fragmento inline (para índice de búsqueda, títulos y la tabla de contenidos). */
export function inlineText(s: string): string {
  return s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1').replace(/(\*\*|__|~~)(.+?)\1/g, '$2').replace(/(^|[^\w*])[*_](\S[^*_]*?)[*_](?=[^\w*]|$)/g, '$1$2').replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1');
}

export function blocksText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.t === 'p' || b.t === 'h') parts.push(inlineText(b.text));
    else if (b.t === 'img') parts.push(b.alt);
    else if (b.t === 'list') for (const it of b.items) parts.push(blocksText(it));
    else if (b.t === 'quote') parts.push(blocksText(b.blocks));
    else if (b.t === 'table') { parts.push(b.head.map(inlineText).join(' ')); for (const r of b.rows) parts.push(r.map(inlineText).join(' ')); }
    else if (b.t === 'code') parts.push(b.text);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------- Enlaces y rutas
/** Resuelve `rel` respecto al directorio de `file` (rutas relativas a `docs/manual/`). Puede salir de `docs/manual` (`../..`). */
export function resolvePath(file: string, rel: string): string {
  const parts = file.split('/'); parts.pop();
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (parts.length && parts[parts.length - 1] !== '..') parts.pop(); else parts.push('..'); }
    else parts.push(seg);
  }
  return parts.join('/');
}

export interface LinkTarget { href: string; external: boolean; internal: boolean }

/** Convierte un enlace del Markdown en un `href` de la app. `file` es la ruta del capítulo relativa a `docs/manual/`. */
export function linkTarget(raw: string, file: string, slug: string): LinkTarget {
  const href = raw.trim();
  if (/^(https?:|mailto:)/i.test(href)) return { href, external: true, internal: false };
  if (/^[a-z][\w+.-]*:/i.test(href)) return { href: '#', external: false, internal: false }; // javascript:, data:… fuera
  if (href.startsWith('#')) return { href: docHref(slug as never, href.slice(1)), external: false, internal: true };
  if (href.startsWith('/')) return { href, external: true, internal: false };
  const [pathPart, anchor] = href.split('#') as [string, string | undefined];
  const resolved = resolvePath(file, pathPart);
  if (resolved.startsWith('img/') || resolved.startsWith('en/img/')) return { href: imageSrc(resolved), external: true, internal: false };
  if (!resolved.startsWith('..') && resolved.endsWith('.md')) {
    const s = resolved.replace(/^en\//, '').replace(/\.md$/, '');
    return { href: isDocSlug(s) ? docHref(s, anchor) : `#/docs/${s}${anchor ? `#${anchor}` : ''}`, external: false, internal: true };
  }
  // Fuera del manual: al fichero en GitHub.
  const repoPath = resolvePath('docs/manual/' + file, pathPart);
  return { href: `${GITHUB_REPO}/blob/main/${repoPath}${anchor ? `#${anchor}` : ''}`, external: true, internal: false };
}

/** `img/x.png` (resuelta respecto a `docs/manual/`) → `/docs-img/x.png`. */
export function imageSrc(resolved: string): string {
  const m = /(?:^|\/)img\/(.+)$/.exec(resolved);
  return m ? `/docs-img/${m[1]}` : resolved;
}

// ---------------------------------------------------------------- Resaltado
const fold1 = (ch: string): string => {
  if (ch.length !== 1) return ch; // astrales: tal cual (mantiene la longitud UTF-16)
  const lower = ch.toLowerCase();
  if (lower === 'ñ') return lower; // la ñ es otra letra, no una n con tilde («año» no es «ano»)
  return lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0] ?? ch;
};
/** Minúsculas sin acentos (pero con ñ), conservando la longitud por punto de código. */
export const fold = (s: string): string => Array.from(s, fold1).join('');

/** Parte `text` en trozos marcando las apariciones de cualquiera de `terms` (ya plegados). */
export function highlight(text: string, terms: string[], keyBase = 'h'): ReactNode {
  const ts = terms.filter(t => t.length >= 2);
  if (!ts.length || !text) return text;
  const chars = Array.from(text);
  const folded = chars.map(fold1);
  const marks = new Array<boolean>(chars.length).fill(false);
  for (const term of ts) {
    // Sobre arrays de puntos de código para no desalinear con caracteres astrales.
    const tc = Array.from(term), tl = tc.length;
    for (let i = 0; i + tl <= folded.length; i++) {
      let ok = true;
      for (let j = 0; j < tl; j++) if (folded[i + j] !== tc[j]) { ok = false; break; }
      if (ok) { for (let j = 0; j < tl; j++) marks[i + j] = true; i += tl - 1; }
    }
  }
  if (!marks.includes(true)) return text;
  const out: ReactNode[] = [];
  let cur = '', on = marks[0]!;
  chars.forEach((ch, i) => {
    if (marks[i] !== on) { out.push(on ? <mark key={`${keyBase}${i}`} className="docs-mark">{cur}</mark> : cur); cur = ''; on = marks[i]!; }
    cur += ch;
  });
  out.push(on ? <mark key={`${keyBase}end`} className="docs-mark">{cur}</mark> : cur);
  return <>{out}</>;
}

// ---------------------------------------------------------------- Inline
export interface RenderCtx {
  /** Ruta del fichero relativa a `docs/manual/` (para resolver enlaces e imágenes). */
  file: string;
  slug: string;
  /** Términos (plegados) a resaltar. */
  terms: string[];
  directive?: (name: string, arg: string) => ReactNode;
}

function findClose(s: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '`') { const e = s.indexOf('`', i + 1); if (e > 0) { i = e; continue; } }
    if (s[i] === open) depth++;
    else if (s[i] === close) { if (depth === 0) return i; depth--; }
  }
  return -1;
}

export function renderInline(s: string, ctx: RenderCtx): ReactNode[] {
  let seq = 0;
  const k = () => `i${seq++}`;
  const out: ReactNode[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(<Fragment key={k()}>{highlight(buf, ctx.terms, k())}</Fragment>); buf = ''; } };
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === '\\' && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(s[i + 1]!)) { buf += s[i + 1]; i += 2; continue; }
    if (ch === '`') {
      let n = 1; while (s[i + n] === '`') n++;
      const fence = '`'.repeat(n);
      const end = s.indexOf(fence, i + n);
      if (end > 0) { flush(); out.push(<code key={k()}>{highlight(s.slice(i + n, end).trim() || s.slice(i + n, end), ctx.terms, k())}</code>); i = end + n; continue; }
    }
    if ((ch === '!' && s[i + 1] === '[') || ch === '[') {
      const img = ch === '!';
      const lb = i + (img ? 1 : 0);
      const rb = findClose(s, lb + 1, '[', ']');
      if (rb > 0 && s[rb + 1] === '(') {
        const rp = findClose(s, rb + 2, '(', ')');
        if (rp > 0) {
          const label = s.slice(lb + 1, rb);
          const dest = s.slice(rb + 2, rp).trim().replace(/^<|>$/g, '').replace(/\s+"[^"]*"$/, '');
          flush();
          if (img) {
            const src = imageSrc(resolvePath(ctx.file, dest));
            out.push(<img key={k()} className="docs-inline-img" src={/^https?:/.test(dest) ? dest : src} alt={label} loading="lazy" />);
          } else {
            const tgt = linkTarget(dest, ctx.file, ctx.slug);
            out.push(tgt.external
              ? <a key={k()} href={tgt.href} target="_blank" rel="noopener noreferrer">{renderInline(label, ctx)}</a>
              : <a key={k()} href={tgt.href} data-internal={tgt.internal ? '' : undefined}>{renderInline(label, ctx)}</a>);
          }
          i = rp + 1; continue;
        }
      }
    }
    if (ch === '<') {
      const m = /^<(https?:\/\/[^\s>]+)>/.exec(s.slice(i));
      if (m) { flush(); out.push(<a key={k()} href={m[1]} target="_blank" rel="noopener noreferrer">{m[1]}</a>); i += m[0].length; continue; }
    }
    if ((ch === '*' || ch === '_' || ch === '~') && s[i + 1] === ch) {
      const end = s.indexOf(ch + ch, i + 2);
      if (end > i + 2) {
        flush();
        const inner = renderInline(s.slice(i + 2, end), ctx);
        out.push(ch === '~' ? <del key={k()}>{inner}</del> : <strong key={k()}>{inner}</strong>);
        i = end + 2; continue;
      }
    }
    if ((ch === '*' || ch === '_') && s[i + 1] && s[i + 1] !== ' ' && s[i + 1] !== ch && (ch === '*' || i === 0 || !/\w/.test(s[i - 1]!))) {
      let end = i + 1;
      while (end < s.length) {
        end = s.indexOf(ch, end);
        if (end < 0) break;
        if (s[end + 1] === ch) { end += 2; continue; }
        if (s[end - 1] !== ' ' && (ch === '*' || end + 1 >= s.length || !/\w/.test(s[end + 1]!))) break;
        end++;
      }
      if (end > i + 1) { flush(); out.push(<em key={k()}>{renderInline(s.slice(i + 1, end), ctx)}</em>); i = end + 1; continue; }
    }
    buf += ch; i++;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- Bloques → React
function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin portapapeles */ }
  };
  return (
    <div className="docs-code">
      <div className="docs-code__bar">
        <span className="docs-code__lang">{lang || t('texto')}</span>
        <button type="button" className="docs-code__copy" onClick={copy} aria-label={t('Copiar código')}>
          <Icon name={copied ? 'check' : 'copy'} />{copied ? t('Copiado') : t('Copiar')}
        </button>
      </div>
      <pre tabIndex={0}><code>{text}</code></pre>
    </div>
  );
}

const CALLOUT_ICON: Record<Callout, 'info' | 'tip' | 'alert'> = { note: 'info', tip: 'tip', important: 'info', warning: 'alert', caution: 'alert' };
const CALLOUT_TITLE: Record<Callout, string> = { note: 'Nota', tip: 'Consejo', important: 'Importante', warning: 'Atención', caution: 'Cuidado' };

function HeadingAnchor({ id, slug }: { id: string; slug: string }) {
  const t = useT();
  return <a className="docs-h__anchor" href={docHref(slug as never, id)} aria-label={t('Enlace a esta sección')}><Icon name="link" /></a>;
}

function Callout({ kind, children }: { kind: Callout; children: ReactNode }) {
  const t = useT();
  return (
    <aside className={`docs-callout docs-callout--${kind}`}>
      <p className="docs-callout__title"><Icon name={CALLOUT_ICON[kind]} />{t(CALLOUT_TITLE[kind])}</p>
      {children}
    </aside>
  );
}

export function renderBlocks(blocks: Block[], ctx: RenderCtx, tight = false): ReactNode[] {
  return blocks.map((b, idx) => {
    const key = `b${idx}`;
    switch (b.t) {
      case 'h': {
        const content = renderInline(b.text, ctx);
        if (b.level === 1) return <h1 key={key} className="docs-h docs-h1">{content}</h1>;
        const Tag = (`h${Math.min(b.level, 6)}`) as 'h2';
        return <Tag key={key} id={b.id} className={`docs-h docs-h${b.level}`} tabIndex={-1}>{content}{b.level <= 3 && <HeadingAnchor id={b.id} slug={ctx.slug} />}</Tag>;
      }
      case 'p': return tight ? <Fragment key={key}>{renderInline(b.text, ctx)}</Fragment> : <p key={key}>{renderInline(b.text, ctx)}</p>;
      case 'img': {
        const external = /^https?:/.test(b.src);
        const src = external ? b.src : imageSrc(resolvePath(ctx.file, b.src));
        return (
          <figure key={key} className="docs-figure">
            <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={b.alt} loading="lazy" decoding="async" /></a>
            {b.alt && <figcaption aria-hidden="true">{renderInline(b.alt, ctx)}</figcaption>}
          </figure>
        );
      }
      case 'list': {
        const items = b.items.map((it, j) => {
          const single = !b.loose && it.length >= 1 && it[0]!.t === 'p';
          return <li key={j}>{single ? [<Fragment key="p0">{renderInline((it[0] as { text: string }).text, ctx)}</Fragment>, ...renderBlocks(it.slice(1), ctx)] : renderBlocks(it, ctx)}</li>;
        });
        return b.ordered ? <ol key={key} start={b.start !== 1 ? b.start : undefined}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case 'table':
        return (
          <div key={key} className="docs-table" tabIndex={0} role="region" aria-label={inlineText(b.head.join(' · '))}>
            <table>
              <thead><tr>{b.head.map((h, j) => <th key={j} scope="col" style={b.align[j] ? { textAlign: b.align[j]! } : undefined}>{renderInline(h, ctx)}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, ri) => <tr key={ri}>{b.head.map((_, j) => <td key={j} style={b.align[j] ? { textAlign: b.align[j]! } : undefined}>{renderInline(r[j] ?? '', ctx)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      case 'code': return <CodeBlock key={key} lang={b.lang} text={b.text} />;
      case 'quote':
        return b.callout
          ? <Callout key={key} kind={b.callout}>{renderBlocks(b.blocks, ctx)}</Callout>
          : <blockquote key={key}>{renderBlocks(b.blocks, ctx)}</blockquote>;
      case 'hr': return <hr key={key} />;
      case 'directive': return <Fragment key={key}>{ctx.directive?.(b.name, b.arg) ?? null}</Fragment>;
    }
  });
}

/** Títulos de nivel 2 y 3 para la tabla de contenidos. */
export function headingsOf(blocks: Block[]): { id: string; text: string; level: number }[] {
  return blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h' && (b.level === 2 || b.level === 3)).map(b => ({ id: b.id, text: inlineText(b.text), level: b.level }));
}
