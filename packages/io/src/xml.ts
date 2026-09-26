/**
 * Ayudantes de XML compartidos por los importadores/exportadores (Archi, Open Exchange, draw.io).
 * Envuelven `fast-xml-parser` con una configuración fija: todo son cadenas (nada se convierte a
 * número), los atributos van con prefijo `@_` y el texto de un nodo mixto en `#text`.
 */
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export type XmlNode = Record<string, unknown>;

export interface ParseXmlOptions {
  /** Etiquetas que siempre se leen como array aunque aparezcan una sola vez. */
  arrayTags?: string[];
  /** Quitar prefijos de espacio de nombres (`archimate:model` → `model`, `xsi:type` → `type`). */
  removeNSPrefix?: boolean;
}

export function parseXml(text: string, opts: ParseXmlOptions = {}): XmlNode {
  const arrays = new Set(opts.arrayTags ?? []);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    removeNSPrefix: opts.removeNSPrefix ?? false,
    isArray: (name) => arrays.has(name),
  });
  return parser.parse(text) as XmlNode;
}

export function buildXml(root: XmlNode, opts: { declaration?: boolean } = {}): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  });
  const body = builder.build(root) as string;
  return (opts.declaration === false ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n') + body;
}

/** Atributo como cadena (o undefined). */
export function attr(node: XmlNode | undefined, name: string): string | undefined {
  const v = node?.[`@_${name}`];
  return v === undefined || v === null ? undefined : String(v);
}

export function attrNum(node: XmlNode | undefined, name: string, def = 0): number {
  const v = attr(node, name);
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Hijos con esa etiqueta, siempre como array. */
export function children(node: XmlNode | undefined, tag: string): XmlNode[] {
  const v = node?.[tag];
  if (v === undefined || v === null) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.map(x => (x && typeof x === 'object' ? (x as XmlNode) : { '#text': x === '' ? '' : String(x) }));
}

export function child(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return children(node, tag)[0];
}

/** Texto de un nodo: `<doc>hola</doc>` → "hola"; `<name xml:lang="en">x</name>` → "x". */
export function textOf(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return textOf(v[0]);
  if (typeof v === 'object') { const t = (v as XmlNode)['#text']; return t === undefined ? '' : String(t); }
  return '';
}

/** Texto del primer hijo con esa etiqueta. */
export function childText(node: XmlNode | undefined, tag: string): string {
  return textOf(node?.[tag]);
}

/** Objeto de atributos para el builder (`{ a: 1 }` → `{ '@_a': '1' }`); omite undefined. */
export function attrs(values: Record<string, string | number | boolean | undefined>): XmlNode {
  const out: XmlNode = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[`@_${k}`] = String(v);
  return out;
}

/** `#rrggbb` → `{ r, g, b }`; devuelve null si no es un color hexadecimal. */
export function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
