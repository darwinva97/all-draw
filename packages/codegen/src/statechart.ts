/**
 * Máquinas de estados → XState v5 (`statechart-xstate`) y tabla de transiciones en Markdown (`statechart-table`).
 *
 * La configuración sale de `exportXState` de `@all-draw/io` (la misma que el exportador JSON), así que el código
 * generado y el `.json` exportado coinciden. Sobre ella se genera:
 * - `<nombre>.machine.ts`: `setup({ types, actions, guards, delays }).createMachine(config)` ejecutable. Las acciones
 *   son stubs que hacen `console.log`; las guardas devuelven `true` (con el texto original en un comentario). Los
 *   nombres que no son identificadores (`saldo > 0`, `x = x + 1`) van como claves entre comillas, y el config los
 *   referencia por nombre. Los retardos con unidades (`5s`) se declaran en `delays`. Exporta el tipo de eventos.
 * - `<nombre>.transitions.md`: tabla `| Estado | Evento | Guarda | Destino | Acciones |` con rutas `padre.hijo`,
 *   transiciones temporizadas (`after 5s`) y sin evento (`always`), y una tabla de estados con entry/exit.
 *
 * Con vista se genera su máquina; sin vista, una por cada vista `statechart` del espacio.
 */
import type { View, Workspace } from '@all-draw/core';
import { exportXState, type XStateActions, type XStateConfig, type XStateTransition, type XStateTransitionObject } from '@all-draw/io';
import type { CodeFile, CodegenOptions, CodegenResult } from './types';
import { W, Warnings } from './warnings';
import { byNameThenId, camelCase, generatedBy, pascalCase, slug, uniqueName } from './util';
import { tsKey, tsLiteral, tsString } from './tslit';

export interface MachineModel {
  view: View;
  /** Base de los nombres de fichero (`pedido` → `pedido.machine.ts`). */
  fileBase: string;
  /** Nombre de la constante exportada (`pedidoMachine`). */
  machineName: string;
  /** Nombre del tipo de eventos (`PedidoEvent`). */
  eventType: string;
  config: XStateConfig;
  actions: string[];
  guards: string[];
  /** Retardos con nombre (los numéricos van tal cual en `after`). */
  delays: Record<string, number>;
  events: string[];
}

const asList = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const actionNames = (a: XStateActions | undefined): string[] => asList(a).map(x => (typeof x === 'string' ? x : x.type)).filter(Boolean);
const transitions = (t: XStateTransition | undefined): XStateTransitionObject[] => asList(t).map(x => (typeof x === 'string' ? { target: x } : x));
const guardOf = (t: XStateTransitionObject): string => { const g = t.guard ?? t.cond; return g === undefined ? '' : typeof g === 'string' ? g : g.type; };

/** `5s` → 5000, `1.5 min` → 90000, `200ms` → 200; null si no se entiende. */
export function parseDelay(s: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|seg|m|min|h)?\s*$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'ms').toLowerCase();
  const f = unit === 'ms' ? 1 : unit === 's' || unit === 'sec' || unit === 'seg' ? 1000 : unit === 'h' ? 3600000 : 60000;
  return Math.round(n * f);
}

const statechartViews = (ws: Workspace): View[] => Object.values(ws.views).filter(v => v.notationId === 'statechart').sort((a, b) => byNameThenId({ name: a.name, id: a.id }, { name: b.name, id: b.id }));

/** Modelo de las máquinas del ámbito (también lo usan los tests para arrancarlas con `xstate`). */
export function statechartMachines(ws: Workspace, opts: CodegenOptions, warnings: Warnings): MachineModel[] | null {
  let views: View[];
  if (opts.viewId) {
    const v = ws.views[opts.viewId];
    if (!v) { warnings.add(W.viewMissing, { view: opts.viewId }); return null; }
    views = [v];
  } else views = statechartViews(ws);
  const usedFiles = new Set<string>();
  const usedIdents = new Set<string>();
  const out: MachineModel[] = [];
  for (const view of views) {
    let config: XStateConfig;
    try {
      const res = exportXState(ws, view.id);
      config = res.config;
      for (const message of res.warnings) warnings.add(W.xstateExport, { message });
    } catch (e) {
      warnings.add(W.xstateExport, { message: (e as Error).message });
      continue;
    }
    if (!config.states || !Object.keys(config.states).length) { warnings.add(W.nothing, { scope: view.name || view.id }); continue; }
    const actions = new Set<string>(), guards = new Set<string>(), events = new Set<string>();
    const delays: Record<string, number> = {};
    const walk = (node: XStateConfig) => {
      for (const a of [...actionNames(node.entry), ...actionNames(node.exit)]) actions.add(a);
      const visit = (t: XStateTransition | undefined) => {
        for (const x of transitions(t)) {
          const g = guardOf(x);
          if (g) guards.add(g);
          for (const a of actionNames(x.actions)) actions.add(a);
        }
      };
      for (const [ev, t] of Object.entries(node.on ?? {})) { if (ev !== '*') events.add(ev); visit(t); }
      for (const [d, t] of Object.entries(node.after ?? {})) {
        if (!/^\d+$/.test(d)) {
          const ms = parseDelay(d);
          if (ms === null) warnings.add(W.unknownDelay, { delay: d });
          delays[d] = ms ?? 1000;
        }
        visit(t);
      }
      visit(node.always);
      for (const child of Object.values(node.states ?? {})) walk(child);
    };
    walk(config);
    const base = view.name || view.id;
    const fileBase = uniqueName(slug(base) || 'maquina', usedFiles, '-');
    let ident = camelCase(base) || 'maquina';
    if (/^[0-9]/.test(ident)) ident = '_' + ident;
    ident = uniqueName(ident, usedIdents);
    const sortStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    out.push({
      view, fileBase, machineName: `${ident}Machine`, eventType: `${pascalCase(ident) || 'Maquina'}Event`, config,
      actions: [...actions].sort(sortStr), guards: [...guards].sort(sortStr), delays: Object.fromEntries(Object.entries(delays).sort(([a], [b]) => sortStr(a, b))),
      events: [...events].sort(sortStr),
    });
  }
  return out;
}

// ---------------------------------------------------------------- XState (TypeScript)
function machineFile(m: MachineModel): CodeFile {
  const L: string[] = [
    '/**',
    ` * ${generatedBy(m.view.name || m.view.id)}`,
    ' * Máquina de estados → XState v5. Ejecutable: las acciones y las guardas son stubs para completar.',
    ' */',
    "import { setup } from 'xstate';",
    '',
    '/** Eventos que acepta la máquina. */',
  ];
  if (m.events.length) L.push(`export type ${m.eventType} =`, ...m.events.map((e, i) => `  | { type: ${tsString(e)} }${i === m.events.length - 1 ? ';' : ''}`));
  else L.push(`export type ${m.eventType} = { type: string };`);
  L.push('', `export const ${m.machineName} = setup({`, '  types: {', `    events: {} as ${m.eventType},`, '  },');
  if (m.actions.length) {
    L.push('  actions: {');
    for (const a of m.actions) L.push(`    ${tsKey(a)}: () => {`, `      console.log(${tsString(`acción: ${a}`)});`, '    },');
    L.push('  },');
  }
  if (m.guards.length) {
    L.push('  guards: {');
    for (const g of m.guards) L.push(`    ${tsKey(g)}: () => {`, `      // TODO: ${g.replace(/\s+/g, ' ')}`, '      return true;', '    },');
    L.push('  },');
  }
  const delayKeys = Object.keys(m.delays);
  if (delayKeys.length) {
    L.push('  delays: {');
    for (const d of delayKeys) L.push(`    ${tsKey(d)}: ${m.delays[d]},`);
    L.push('  },');
  }
  L.push(`}).createMachine(${tsLiteral(m.config)});`);
  return { path: `${m.fileBase}.machine.ts`, content: L.join('\n') + '\n', language: 'typescript' };
}

// ---------------------------------------------------------------- Tabla Markdown
const cell = (s: string): string => (s.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim() || '—');
const delayLabel = (d: string): string => {
  if (!/^\d+$/.test(d)) return `after ${d}`;
  const n = Number(d);
  return n >= 1000 && n % 1000 === 0 ? `after ${n / 1000}s` : `after ${n}ms`;
};

function tableFile(m: MachineModel): CodeFile {
  // rutas e ids
  const idToPath = new Map<string, string>();
  const parentOf = new Map<string, string>();
  const order: [string, XStateConfig][] = [];
  const index = (node: XStateConfig, path: string) => {
    for (const [k, child] of Object.entries(node.states ?? {})) {
      const p = path ? `${path}.${k}` : k;
      parentOf.set(p, path);
      if (child.id) idToPath.set(child.id, p);
      order.push([p, child]);
      index(child, p);
    }
  };
  index(m.config, '');
  const resolve = (from: string, target: string | string[] | undefined): string => {
    if (target === undefined) return '';
    if (Array.isArray(target)) return target.map(t => resolve(from, t)).join(', ');
    if (target.startsWith('#')) {
      const raw = target.slice(1);
      if (idToPath.has(raw)) return idToPath.get(raw)!;
      const dot = raw.indexOf('.');
      if (dot > 0) {
        const head = raw.slice(0, dot), tail = raw.slice(dot + 1);
        if (head === m.config.id) return tail;
        if (idToPath.has(head)) return `${idToPath.get(head)}.${tail}`;
      }
      return raw;
    }
    if (target.startsWith('.')) return `${from}${target}`;
    const parent = parentOf.get(from) ?? '';
    return parent ? `${parent}.${target}` : target;
  };
  const rows: string[] = [];
  const add = (state: string, event: string, t: XStateTransitionObject) => {
    rows.push(`| ${cell(state)} | ${cell(event)} | ${cell(guardOf(t))} | ${t.target === undefined ? '(interna)' : cell(resolve(state, t.target))} | ${cell(actionNames(t.actions).join(', '))} |`);
  };
  for (const [p, node] of order) {
    for (const [ev, t] of Object.entries(node.on ?? {})) for (const x of transitions(t)) add(p, ev, x);
    for (const [d, t] of Object.entries(node.after ?? {})) for (const x of transitions(t)) add(p, delayLabel(d), x);
    for (const x of transitions(node.always)) add(p, 'always', x);
  }
  const kind = (n: XStateConfig): string => (n.type === 'parallel' ? 'paralelo' : n.type === 'final' ? 'final' : n.type === 'history' ? `historia (${n.history === 'deep' ? 'profunda' : 'superficial'})` : n.states && Object.keys(n.states).length ? 'compuesto' : 'simple');
  const title = m.view.name || m.view.id;
  const L = [
    `# ${title}`,
    '',
    generatedBy(title),
    '',
    `Estado inicial: \`${m.config.initial ?? '—'}\`.`,
    '',
    '## Transiciones',
    '',
    '| Estado | Evento | Guarda | Destino | Acciones |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Estados',
    '',
    '| Estado | Tipo | Estado inicial | Entry | Exit | Descripción |',
    '| --- | --- | --- | --- | --- | --- |',
    ...order.map(([p, n]) => `| ${cell(p)} | ${kind(n)} | ${cell(n.initial ? `${p}.${n.initial}` : '')} | ${cell(actionNames(n.entry).join(', '))} | ${cell(actionNames(n.exit).join(', '))} | ${cell(n.description ?? '')} |`),
  ];
  if (!rows.length) L.splice(L.indexOf('| Estado | Evento | Guarda | Destino | Acciones |'), 2, '_Sin transiciones._');
  return { path: `${m.fileBase}.transitions.md`, content: L.join('\n') + '\n', language: 'markdown' };
}

export function generateStatechart(ws: Workspace, opts: CodegenOptions, kind: 'xstate' | 'table'): CodegenResult {
  const warnings = new Warnings();
  const machines = statechartMachines(ws, opts, warnings);
  if (!machines) return { files: [], warnings: warnings.list };
  if (!machines.length && !warnings.list.length) warnings.add(W.nothing, { scope: ws.meta.name || 'Sin nombre' });
  const files = machines.map(m => (kind === 'xstate' ? machineFile(m) : tableFile(m)));
  return { files, warnings: warnings.list };
}
