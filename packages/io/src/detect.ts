/**
 * Detección de formato por contenido (y extensión como pista) e importación genérica.
 *
 * Los errores de `importAny` son `ImportError`: además del mensaje (en español) llevan `key` y `vars` para que la
 * interfaz los traduzca, y dicen qué formato se detectó y dónde falla (línea y columna del XML o del JSON).
 */
import { XMLValidator } from 'fast-xml-parser';
import type { Workspace } from '@all-draw/core';
import { importDrawer } from './drawer';
import { importWorkspace } from './json';
import { importArchimate } from './archimate';
import { importOpenExchange } from './archimate-oef';
import { importStructurizr } from './structurizr';
import { importXState } from './xstate';
import { importMermaid } from './mermaid';
import { importOpenApi } from './openapi';
import { tr } from './i18n';
import { ImportError } from './errors';

export { ImportError } from './errors';

export type DetectedFormat = 'drawer' | 'alldraw' | 'archimate' | 'oef' | 'structurizr' | 'xstate' | 'mermaid' | 'openapi' | 'bpmn' | 'unknown';
export interface AnyImport {
  workspace: Workspace; warnings: string[]; format: DetectedFormat;
  /** Nombre legible del formato ("Archi (.archimate)", "BPMN 2.0"…), para avisos y diálogos. */
  formatLabel: string;
}

/** Nombre legible de cada formato (no se traduce: son nombres propios). */
export const FORMAT_LABELS: Record<DetectedFormat, string> = {
  drawer: 'Drawer (.drawer)', alldraw: 'all-draw (JSON)', archimate: 'Archi (.archimate)', oef: 'ArchiMate Open Exchange', structurizr: 'Structurizr JSON',
  xstate: 'XState JSON', mermaid: 'Mermaid', openapi: 'OpenAPI', bpmn: 'BPMN 2.0', unknown: '?',
};
export const formatLabel = (f: DetectedFormat): string => FORMAT_LABELS[f] ?? f;

const EXT: Record<string, DetectedFormat> = { drawer: 'drawer', archimate: 'archimate', bpmn: 'bpmn', mmd: 'mermaid', mermaid: 'mermaid' };
const MERMAID_HEAD = /^(flowchart|graph|stateDiagram(-v2)?|sequenceDiagram|classDiagram(-v2)?|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban)\b/;

/** Primera línea útil de un texto Mermaid (sin comentarios `%%` ni directivas `%%{init}%%`). */
const firstLine = (t: string) => t.split(/\r?\n/).map(l => l.replace(/%%.*$/, '').trim()).find(Boolean) ?? '';

export function detectFormat(text: string, filename?: string): DetectedFormat {
  const t = text.replace(/^﻿/, '').trim();
  const ext = filename ? filename.toLowerCase().split('.').pop() ?? '' : '';
  if (EXT[ext] && ext !== 'bpmn') return EXT[ext]!;

  if (t.startsWith('<')) {
    if (/xmlns:archimate\s*=\s*"http:\/\/www\.archimatetool\.com\/archimate"/.test(t)) return 'archimate';
    if (/xmlns\s*=\s*"http:\/\/www\.opengroup\.org\/xsd\/archimate/.test(t)) return 'oef';
    if (/http:\/\/www\.omg\.org\/spec\/BPMN\/|<(\w+:)?definitions\b/.test(t)) return 'bpmn';
    return ext === 'bpmn' ? 'bpmn' : 'unknown';
  }
  if (ext === 'bpmn') return 'bpmn';
  if (MERMAID_HEAD.test(firstLine(t))) return 'mermaid';
  if (t.startsWith('{') || t.startsWith('[')) {
    let obj: unknown;
    try { obj = JSON.parse(t); } catch { return 'unknown'; }
    return detectObject(obj);
  }
  // YAML: solo OpenAPI (o XState/Structurizr en YAML, poco habitual)
  if (/^(openapi|swagger)\s*:/m.test(t) || (/^paths\s*:/m.test(t) && /^info\s*:/m.test(t))) return 'openapi';
  return 'unknown';
}

export function detectObject(obj: unknown): DetectedFormat {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'unknown';
  const o = obj as Record<string, unknown>;
  if (o.openapi || o.swagger || (o.paths && o.info)) return 'openapi';
  if (o.meta && o.elements && o.views && typeof o.meta === 'object' && 'schemaVersion' in (o.meta as object)) return 'alldraw';
  if (o.app === 'diagramador' || (Array.isArray(o.libraries) && (Array.isArray(o.diagrams) || o.diagram))) return 'drawer';
  if (o.model && typeof o.model === 'object' && ('softwareSystems' in (o.model as object) || 'people' in (o.model as object) || o.views)) return 'structurizr';
  if (o.states && typeof o.states === 'object' && (o.initial !== undefined || o.id !== undefined || o.type === 'parallel')) return 'xstate';
  return 'unknown';
}

// ---------------------------------------------------------------- Diagnóstico de ficheros que no se pueden leer
/** Línea y columna (desde 1) de una posición del texto. */
export function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, Math.min(pos, text.length)));
  const line = before.split('\n').length;
  return { line, col: pos - before.lastIndexOf('\n') };
}

/**
 * Posición del primer error de sintaxis de un JSON (o `-1` si es válido). `JSON.parse` no siempre la da (depende del
 * motor y del error), así que se recorre el texto con un analizador mínimo que solo valida la gramática.
 */
export function jsonErrorOffset(text: string): number {
  let i = 0;
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i]!)) i++; };
  const fail = () => { throw i; };
  const lit = (w: string) => { if (text.startsWith(w, i)) i += w.length; else fail(); };
  const str = () => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') { i++; if (text[i] === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail(); i += 4; } else if (!'"\\/bfnrt'.includes(text[i] ?? '')) fail(); }
      else if (text.charCodeAt(i) < 0x20) fail();
      i++;
    }
    if (text[i] !== '"') fail();
    i++;
  };
  const value = (): void => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++; ws();
      if (text[i] === '}') { i++; return; }
      for (;;) { ws(); if (text[i] !== '"') fail(); str(); ws(); if (text[i] !== ':') fail(); i++; value(); ws(); if (text[i] === ',') { i++; continue; } if (text[i] === '}') { i++; return; } fail(); }
    }
    if (c === '[') {
      i++; ws();
      if (text[i] === ']') { i++; return; }
      for (;;) { value(); ws(); if (text[i] === ',') { i++; continue; } if (text[i] === ']') { i++; return; } fail(); }
    }
    if (c === '"') return str();
    if (c === 't') return lit('true');
    if (c === 'f') return lit('false');
    if (c === 'n') return lit('null');
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail();
    i += m![0].length;
  };
  try { value(); ws(); return i < text.length ? i : -1; } catch (pos) { return typeof pos === 'number' ? pos : i; }
}

/** Error de sintaxis de un JSON como línea/columna (y si parece cortado); `null` si el JSON es válido. */
export function jsonProblem(text: string): { line: number; col: number; detail: string; truncated: boolean } | null {
  try { JSON.parse(text); return null; } catch (e) {
    const msg = (e as Error).message;
    const pos = jsonErrorOffset(text);
    const end = text.trimEnd().length;
    const at = pos >= 0 ? pos : end;
    const near = text.slice(at, at + 24).split('\n')[0]!;
    const detail = near ? `«${near}»` : msg.replace(/\s*\(line \d+ column \d+\)/, '').replace(/ in JSON at position \d+/, '');
    return { ...lineCol(text, at), detail, truncated: at >= end };
  }
}

/** Primer error de buena formación del XML (`null` si está bien formado). */
export function xmlProblem(text: string): { line: number; col: number; detail: string; unclosed?: string[] } | null {
  const r = XMLValidator.validate(text, { allowBooleanAttributes: true });
  if (r === true) return null;
  // Etiquetas sin cerrar al final (fichero cortado): el validador las da como «Unclosed tag 'a'» o «Invalid '["a","b"]' found».
  const one = /^Unclosed tag '([^']+)'/.exec(r.err.msg);
  const many = /^Invalid '\[([\s\S]*)\]' found/.exec(r.err.msg);
  const unclosed = one ? [one[1]!] : many ? [...many[1]!.matchAll(/"([^"]+)"/g)].map(m => m[1]!) : undefined;
  if (unclosed?.length) return { ...lineCol(text, text.trimEnd().length), detail: r.err.msg, unclosed };
  return { line: r.err.line, col: r.err.col, detail: r.err.msg };
}

/** ¿Parece un binario (bytes nulos o muchos caracteres de reemplazo)? */
function looksBinary(text: string): boolean {
  if (text.includes('\u0000')) return true;
  const sample = text.slice(0, 4000);
  // oxlint-disable-next-line no-control-regex -- se buscan justamente caracteres de control
  const bad = (sample.match(/[�\u0001-\u0008\u000E-\u001F]/g) ?? []).length;
  return sample.length > 0 && bad / sample.length > 0.05;
}

/** Nombre del fichero sin extensiones de formato (`pedido.bpmn` → `pedido`, `x.alldraw.json` → `x`). */
export function fileStem(filename: string | undefined): string {
  if (!filename) return '';
  const base = filename.split(/[\\/]/).pop() ?? filename;
  return base.replace(/(\.(alldraw|drawer|archimate|oef|structurizr|xstate|bpmn|bpmn2|mmd|mermaid|json|xml|yaml|yml|txt))+$/i, '').replace(/[_]+/g, ' ').trim();
}

/** Por qué no se reconoce un fichero: qué parece y qué le falta. */
function unknownError(text: string, filename: string | undefined): ImportError {
  const name = filename ?? '';
  const t = text.replace(/^﻿/, '').trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    const p = jsonProblem(t);
    if (p) return p.truncated
      ? new ImportError('«{name}» es JSON pero está incompleto: termina antes de tiempo (línea {line}). ¿Se cortó al copiarlo o descargarlo?', { name, line: p.line })
      : new ImportError('«{name}» es JSON pero está mal formado en la línea {line}, columna {col}: {detail}', { name, line: p.line, col: p.col, detail: p.detail });
    return new ImportError('«{name}» es JSON válido, pero no corresponde a ningún formato conocido (all-draw, Drawer, Structurizr, XState u OpenAPI).', { name });
  }
  if (t.startsWith('<')) {
    const root = /<([\w:.-]+)[\s/>]/.exec(t.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/gi, '').trim())?.[1] ?? '?';
    if (root === 'mxfile' || root === 'mxGraphModel') return new ImportError('«{name}» es un diagrama de draw.io: all-draw puede exportar a draw.io, pero no importarlo.', { name });
    return new ImportError('«{name}» es XML con raíz <{root}>, que no es Archi, ArchiMate Open Exchange ni BPMN 2.0.', { name, root });
  }
  const head = firstLine(t);
  if (/^workspace\b/.test(head)) return new ImportError('«{name}» parece Structurizr DSL; exporta el espacio a JSON desde Structurizr e importa ese JSON.', { name });
  return new ImportError('No se reconoce el formato de «{name}». Formatos admitidos: all-draw, Drawer, Archi, ArchiMate Open Exchange, BPMN 2.0, Structurizr JSON, XState, Mermaid y OpenAPI.', { name });
}

/**
 * Normaliza colores `#rgb` a `#rrggbb` (los `<input type="color">` del inspector solo aceptan la forma larga).
 * Recorre los estilos de nodos y aristas, los colores de tipos de librería, de capas y grupos de etapas, y de reglas.
 */
export function normalizeColors(ws: Workspace): Workspace {
  const long = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{3}$/i.test(v.trim()) ? `#${v.trim().slice(1).split('').map(c => c + c).join('')}`.toLowerCase() : v);
  const fix = (o: Record<string, unknown> | undefined, keys: string[]) => { if (o) for (const k of keys) if (k in o) o[k] = long(o[k]); };
  for (const n of Object.values(ws.nodes)) fix(n.style as Record<string, unknown>, ['fill', 'stroke', 'text']);
  for (const e of Object.values(ws.edges)) fix(e.style as Record<string, unknown>, ['color']);
  for (const lib of Object.values(ws.libraries)) { for (const t of lib.elementTypes) fix(t as unknown as Record<string, unknown>, ['color']); for (const t of lib.relationTypes) fix(t as unknown as Record<string, unknown>, ['color']); }
  for (const v of Object.values(ws.views)) { for (const l of v.grid?.layers ?? []) fix(l as Record<string, unknown>, ['color']); for (const g of v.grid?.stageGroups ?? []) fix(g as Record<string, unknown>, ['color']); }
  for (const r of Object.values(ws.rules)) fix(r.style as Record<string, unknown>, ['bg', 'border', 'text', 'accent', 'top', 'badge']);
  for (const d of Object.values(ws.dimensions)) fix(d as unknown as Record<string, unknown>, ['color']);
  return ws;
}

/** Nombres genéricos que ponen los importadores cuando el fichero no trae uno: se sustituyen por el nombre del fichero. */
const PLACEHOLDERS = ['BPMN', 'Diagrama', 'Máquina de estados', 'Importado de Drawer', 'Sin nombre'];
/** Los importadores pueden traducir esos nombres (`tr`): cuentan el original y la traducción. */
const isPlaceholder = (name: string) => { const n = name.trim(); return !n || PLACEHOLDERS.some(p => p === n || tr(p) === n); };

export async function importAny(text: string, filename?: string): Promise<AnyImport> {
  const name = filename ?? '';
  if (!text.replace(/^﻿/, '').trim()) throw new ImportError('El fichero «{name}» está vacío.', { name });
  if (looksBinary(text)) throw new ImportError('«{name}» no es un fichero de texto (parece binario). Los formatos admitidos son JSON, XML, YAML o Mermaid.', { name });
  const format = detectFormat(text, filename);
  if (format === 'unknown') throw unknownError(text, filename);
  const label = formatLabel(format);
  const src = text.replace(/^﻿/, '');

  // Antes de pasar el texto al importador: un XML o JSON mal formado da su línea y columna (no el error crudo del parser).
  const trimmed = src.trim();
  if (trimmed.startsWith('<')) {
    const p = xmlProblem(trimmed);
    if (p?.unclosed) throw new ImportError('«{name}» parece {format}, pero el XML está incompleto: termina en la línea {line} sin cerrar {tags}. ¿Se cortó al copiarlo o descargarlo?', { name, format: label, line: p.line, tags: p.unclosed.slice(-3).map(t => `<${t}>`).join(', ') });
    if (p) throw new ImportError('«{name}» parece {format}, pero el XML está mal formado en la línea {line}, columna {col}: {detail}', { name, format: label, line: p.line, col: p.col, detail: p.detail });
  } else if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && format !== 'mermaid') {
    const p = jsonProblem(trimmed);
    if (p) throw p.truncated
      ? new ImportError('«{name}» parece {format}, pero el JSON está incompleto: termina antes de tiempo (línea {line}).', { name, format: label, line: p.line })
      : new ImportError('«{name}» parece {format}, pero el JSON está mal formado en la línea {line}, columna {col}: {detail}', { name, format: label, line: p.line, col: p.col, detail: p.detail });
  }

  let r: { workspace: Workspace; warnings: string[] };
  try {
    switch (format) {
      case 'drawer': r = importDrawer(src); break;
      case 'alldraw': r = { workspace: importWorkspace(src), warnings: [] }; break;
      case 'archimate': r = importArchimate(src); break;
      case 'oef': r = importOpenExchange(src); break;
      case 'structurizr': r = importStructurizr(src); break;
      case 'xstate': r = importXState(src); break;
      case 'mermaid': r = importMermaid(src); break;
      case 'openapi': { const o = importOpenApi(src, { name: filename }); r = { workspace: o.workspace, warnings: o.warnings }; break; }
      case 'bpmn': {
        // BPMN vive en ./bpmn (otro módulo, con bpmn-moddle); se carga dinámicamente para no pagar su coste si no se usa
        let mod: typeof import('./bpmn');
        try { mod = await import('./bpmn'); } catch (e) { throw new ImportError('El importador BPMN no está disponible: {detail}', { detail: (e as Error).message }); }
        const b = await mod.importBpmn(src);
        r = { workspace: b.workspace, warnings: b.warnings };
        break;
      }
    }
  } catch (e) {
    if (e instanceof ImportError) throw e;
    const detail = (e as Error)?.message ?? String(e);
    // Errores de validación del esquema (zod) son largos: se resume el primero.
    const short = detail.length > 300 ? `${detail.slice(0, 297)}…` : detail;
    throw new ImportError('«{name}» parece {format}, pero no se pudo leer: {detail}', { name, format: label, detail: short });
  }

  const ws = normalizeColors(r.workspace);
  // Sin nombre propio en el fichero: el del fichero (sin extensión). Lo mismo para la única vista con nombre genérico.
  const stem = fileStem(filename);
  if (stem && isPlaceholder(ws.meta.name)) {
    const old = ws.meta.name;
    ws.meta.name = stem;
    for (const v of Object.values(ws.views)) if (v.name === old || isPlaceholder(v.name)) v.name = stem;
  }
  return { workspace: ws, warnings: r.warnings, format, formatLabel: label };
}
