/**
 * Búsqueda de texto en todo el manual. El índice se construye la primera vez que se busca (carga todos los
 * capítulos del idioma) y se guarda en memoria: una entrada por sección (`h1`/`h2`/`h3`).
 */
import type { Lang } from '@all-draw/i18n';
import { loadAll } from './chapters';
import { blocksText, fold, inlineText, parseMarkdown, uniqueIds, type Block } from './markdown';

export interface Section { slug: string; chapter: string; heading: string; id: string | null; text: string; ftext: string; fheading: string }
export interface Hit { section: Section; score: number; snippet: string }

const indexes = new Map<Lang, Promise<Section[]>>();

export function sectionsOf(slug: string, source: string): Section[] {
  const blocks = uniqueIds(parseMarkdown(source));
  const out: Section[] = [];
  let chapter = slug;
  let cur: { heading: string; id: string | null; body: Block[] } | null = null;
  const push = () => {
    if (!cur) return;
    const text = blocksText(cur.body).replace(/\s+/g, ' ').trim();
    out.push({ slug, chapter, heading: cur.heading, id: cur.id, text, ftext: fold(text), fheading: fold(cur.heading) });
  };
  for (const b of blocks) {
    if (b.t === 'h' && b.level <= 3) {
      push();
      if (b.level === 1) chapter = inlineText(b.text);
      cur = { heading: inlineText(b.text), id: b.level === 1 ? null : b.id, body: [] };
    } else {
      if (!cur) cur = { heading: chapter, id: null, body: [] };
      cur.body.push(b);
    }
  }
  push();
  return out;
}

export function buildIndex(lang: Lang): Promise<Section[]> {
  let p = indexes.get(lang);
  if (!p) {
    p = loadAll(lang).then(chs => chs.flatMap(c => sectionsOf(c.slug, c.source)));
    p.catch(() => indexes.delete(lang));
    indexes.set(lang, p);
  }
  return p;
}

/** Términos plegados (minúsculas, sin acentos) de una consulta. */
export const termsOf = (q: string): string[] => fold(q).split(/[^\p{L}\p{N}:_-]+/u).filter(w => w.length >= 2);

function count(hay: string, needle: string): number {
  let n = 0, i = hay.indexOf(needle);
  while (i >= 0) { n++; i = hay.indexOf(needle, i + needle.length); }
  return n;
}

export function search(sections: Section[], q: string, limit = 24): Hit[] {
  const terms = termsOf(q);
  if (!terms.length) return [];
  const hits: Hit[] = [];
  for (const s of sections) {
    let score = 0, all = true;
    for (const term of terms) {
      const inHead = count(s.fheading, term), inText = count(s.ftext, term);
      if (!inHead && !inText) { all = false; break; }
      score += inHead * 8 + Math.min(inText, 10) + (s.fheading === term ? 12 : 0);
    }
    if (!all) continue;
    if (s.id === null) score += 2; // el capítulo entero, como resultado general
    hits.push({ section: s, score, snippet: snippet(s, terms[0]!) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function snippet(s: Section, term: string): string {
  const at = s.ftext.indexOf(term);
  if (at < 0) return s.text.slice(0, 140) + (s.text.length > 140 ? '…' : '');
  const from = Math.max(0, at - 60);
  const to = Math.min(s.text.length, at + term.length + 100);
  return `${from > 0 ? '…' : ''}${s.text.slice(from, to).trim()}${to < s.text.length ? '…' : ''}`;
}
