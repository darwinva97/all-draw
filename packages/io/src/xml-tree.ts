/**
 * Árbol XML **ordenado** (hijos en el orden del documento) para los lectores que lo necesitan: draw.io (orden de pintado
 * de las celdas), Visio (formas anidadas) y el conversor SVG → PDF (orden de pintado). Usa `fast-xml-parser` con
 * `preserveOrder` y decodifica las entidades **en una sola pasada** (el parser deja sin tocar `&#39;`/`&#xa;` y, si las
 * decodificara él, `&amp;#39;` acabaría convertido en `'`).
 */
import { XMLParser } from 'fast-xml-parser';
import { tr } from './i18n';

export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Texto directo del nodo (concatenado, sin el de los hijos). */
  text: string;
  parent?: XNode;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** `&amp;`, `&lt;`, `&#39;`, `&#xa;`… → caracteres (una sola pasada). */
export function decodeXmlEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

type Ordered = Record<string, unknown>;

/** Analiza `text` y devuelve el elemento raíz (sin `<?xml?>` ni comentarios). Lanza si no hay raíz. */
export function parseXmlTree(text: string, opts: { removeNSPrefix?: boolean } = {}): XNode {
  const parser = new XMLParser({
    preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text',
    parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: false,
    removeNSPrefix: opts.removeNSPrefix ?? false, ignoreDeclaration: true, ignorePiTags: true, commentPropName: '#comment',
  });
  const list = parser.parse(text) as Ordered[];
  const roots = convert(list, undefined);
  const root = roots[0];
  if (!root) throw new Error(tr('El XML está vacío.'));
  return root;
}

function convert(list: Ordered[], parent: XNode | undefined): XNode[] {
  const out: XNode[] = [];
  for (const item of list) {
    for (const key of Object.keys(item)) {
      if (key === ':@' || key === '#text' || key === '#comment') continue;
      const rawAttrs = (item[':@'] ?? {}) as Record<string, unknown>;
      const attrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawAttrs)) attrs[k] = decodeXmlEntities(String(v));
      const node: XNode = { tag: key, attrs, children: [], text: '', parent };
      const kids = (item[key] ?? []) as Ordered[];
      let text = '';
      for (const k of kids) if ('#text' in k) text += String(k['#text']);
      node.text = decodeXmlEntities(text);
      node.children = convert(kids, node);
      out.push(node);
    }
  }
  return out;
}

/** Hijos directos con esa etiqueta (sin prefijo de espacio de nombres si se pide `local`). */
export const kids = (n: XNode | undefined, tag: string): XNode[] => (n ? n.children.filter(c => c.tag === tag) : []);
export const kid = (n: XNode | undefined, tag: string): XNode | undefined => n?.children.find(c => c.tag === tag);
/** Todos los descendientes con esa etiqueta (en orden de documento). */
export function descendants(n: XNode, tag: string, out: XNode[] = []): XNode[] {
  for (const c of n.children) { if (c.tag === tag) out.push(c); descendants(c, tag, out); }
  return out;
}
