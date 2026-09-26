/**
 * Detección de formato por contenido (y extensión como pista) e importación genérica.
 */
import type { Workspace } from '@all-draw/core';
import { importDrawer } from './drawer';
import { importWorkspace } from './json';
import { importArchimate } from './archimate';
import { importOpenExchange } from './archimate-oef';
import { importStructurizr } from './structurizr';
import { importXState } from './xstate';
import { importMermaid } from './mermaid';
import { importOpenApi } from './openapi';

export type DetectedFormat = 'drawer' | 'alldraw' | 'archimate' | 'oef' | 'structurizr' | 'xstate' | 'mermaid' | 'openapi' | 'bpmn' | 'unknown';
export interface AnyImport { workspace: Workspace; warnings: string[]; format: DetectedFormat }

const EXT: Record<string, DetectedFormat> = { drawer: 'drawer', archimate: 'archimate', bpmn: 'bpmn', mmd: 'mermaid', mermaid: 'mermaid' };

export function detectFormat(text: string, filename?: string): DetectedFormat {
  const t = text.trim();
  const ext = filename ? filename.toLowerCase().split('.').pop() ?? '' : '';
  if (EXT[ext] && ext !== 'bpmn') return EXT[ext]!;

  if (t.startsWith('<')) {
    if (/xmlns:archimate\s*=\s*"http:\/\/www\.archimatetool\.com\/archimate"/.test(t)) return 'archimate';
    if (/xmlns\s*=\s*"http:\/\/www\.opengroup\.org\/xsd\/archimate/.test(t)) return 'oef';
    if (/http:\/\/www\.omg\.org\/spec\/BPMN\/|<(\w+:)?definitions\b/.test(t)) return 'bpmn';
    return ext === 'bpmn' ? 'bpmn' : 'unknown';
  }
  if (ext === 'bpmn') return 'bpmn';
  const head = t.split(/\r?\n/).map(l => l.replace(/%%.*$/, '').trim()).find(Boolean) ?? '';
  if (/^(flowchart|graph|stateDiagram(-v2)?)\b/.test(head)) return 'mermaid';
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

export async function importAny(text: string, filename?: string): Promise<AnyImport> {
  const format = detectFormat(text, filename);
  switch (format) {
    case 'drawer': { const r = importDrawer(text); return { ...r, format }; }
    case 'alldraw': return { workspace: importWorkspace(text), warnings: [], format };
    case 'archimate': { const r = importArchimate(text); return { ...r, format }; }
    case 'oef': { const r = importOpenExchange(text); return { ...r, format }; }
    case 'structurizr': { const r = importStructurizr(text); return { ...r, format }; }
    case 'xstate': { const r = importXState(text); return { ...r, format }; }
    case 'mermaid': { const r = importMermaid(text); return { ...r, format }; }
    case 'openapi': { const r = importOpenApi(text, { name: filename }); return { workspace: r.workspace, warnings: r.warnings, format }; }
    case 'bpmn': {
      // BPMN vive en ./bpmn (otro módulo, con bpmn-moddle); se carga dinámicamente para no pagar su coste si no se usa
      try {
        const mod = await import('./bpmn');
        const r = await mod.importBpmn(text);
        return { workspace: r.workspace, warnings: r.warnings, format };
      } catch (e) {
        throw new Error(`El importador BPMN no está disponible: ${(e as Error).message}`);
      }
    }
    default:
      throw new Error(`No se reconoce el formato del fichero${filename ? ` ${filename}` : ''}.`);
  }
}
