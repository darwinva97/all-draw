/**
 * Panel de **texto en vivo**: el espacio (o la vista actual) escrito en el lenguaje textual de all-draw (`@all-draw/io`,
 * `docs/manual/dsl.md`), editable y sincronizado en los dos sentidos. Se carga perezosamente desde `Editor.tsx` (botón
 * "Texto", Ctrl+Shift+E): ni el lenguaje ni este editor entran en el paquete inicial.
 *
 * - Editor propio y ligero: un `<textarea>` transparente sobre capas pintadas (resaltado, subrayado de diagnósticos,
 *   coincidencias de búsqueda) que solo dibujan las líneas visibles; numeración de líneas, autocompletado y búsqueda.
 *   Sin CodeMirror/Monaco: lo que hace falta aquí cabe en unos KB.
 * - Texto → modelo: tras 600 ms sin teclear y sin errores, `computeSync` (fusión a tres bandas, `text-sync.ts`) da los
 *   comandos y se aplican como **un único `batch`** (un paso de deshacer). Las vistas nuevas sin posiciones pasan por el
 *   layout que inyecta la app (`layout`).
 * - Modelo → texto: si el modelo cambia (lienzo, otra persona, deshacer) y el texto no tiene cambios pendientes, se
 *   rehace el texto (conservando el cursor en su declaración). Si los tiene, se combinan al aplicar; si chocan, aviso.
 * - Selección cruzada: el cursor sobre una declaración selecciona sus nodos/aristas en el lienzo, y seleccionar en el
 *   lienzo lleva el texto a su declaración.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { MemoryStore, execute, type Command, type Element, type Store, type ViewNode, type Workspace } from '@all-draw/core';
import { useT, tMsg } from '@all-draw/i18n';
import { useEditor } from '../context';
import { Icon } from '../icons';
import { HelpLink } from './HelpLink';
import {
  panelText, readText, computeSync, recordRanges, recordAt, selectionForRecord, recordsForSelection, mapOffset, explicitIdEdits, applyEdits,
  lineStarts, lineColOf, offsetOf, type TextScope, type TextSnapshot, type SyncIssue,
} from '../text-sync';

export interface TextPanelProps {
  onClose: () => void;
  /** Layout automático de una vista sobre un store cualquiera (la app lo conecta a `@all-draw/layout`). */
  layout?: (store: Store, viewId: string) => Promise<Command>;
  /** Tamaño por defecto de un nodo según su figura (`defaultSize` de `Canvas`; se pasa para no importar el lienzo aquí). */
  defaultSize?: (shape: string | undefined, container: boolean, typeId?: string) => { w: number; h: number };
}

const LH = 18;          // alto de línea (px), igual que en editor.css
const PAD_T = 6, PAD_L = 8;
const IDLE_MS = 600;
const PREFS_KEY = 'alldraw:text-panel';
type Status = 'synced' | 'pending' | 'errors' | 'conflict';

interface Prefs { scope: 'view' | 'workspace'; positions: boolean; width: number }
function readPrefs(): Prefs {
  try { const p = JSON.parse(globalThis.localStorage?.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>; return { scope: p.scope === 'workspace' ? 'workspace' : 'view', positions: !!p.positions, width: typeof p.width === 'number' ? p.width : 460 }; }
  catch { return { scope: 'view', positions: false, width: 460 }; }
}
function writePrefs(p: Prefs) { try { globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ } }

// ================================================================ Resaltado
const KEYWORDS = new Set(['workspace', 'model', 'views', 'view', 'library', 'elementType', 'relationType', 'portType', 'field', 'dimension', 'person', 'rule', 'comment',
  'include', 'note', 'label', 'group', 'image', 'visual', 'node', 'edge', 'layer', 'stage', 'stagegroup', 'grid', 'as', 'at', 'size', 'cell', 'from', 'to', 'via', 'in',
  'color', 'map', 'name', 'description', 'current', 'created', 'updated', 'detail', 'root', 'doc', 'tags', 'props', 'features', 'ports', 'profiles', 'template', 'templateId',
  'kind', 'notation', 'viewpoint', 'public', 'style', 'z', 'text', 'instanceNote', 'meta', 'visualType', 'fromPort', 'toPort', 'fromEnd', 'toEnd', 'notations']);
const ID_CHAR = /[\w$.-]/;
type Tok = [cls: string, text: string];

/** Fichas de una línea (comentarios, textos, palabras clave, tipos `pack:Tipo`, ids, números). */
function tokenizeLine(line: string, inComment: boolean): Tok[] {
  const toks: Tok[] = [];
  let plain = '', i = 0;
  const push = (cls: string, s: string) => { if (plain) { toks.push(['', plain]); plain = ''; } toks.push([cls, s]); };
  while (i < line.length) {
    if (inComment) {
      const e = line.indexOf('*/', i);
      if (e < 0) { push('c', line.slice(i)); break; }
      push('c', line.slice(i, e + 2)); i = e + 2; inComment = false; continue;
    }
    const ch = line[i]!;
    if (ch === '/' && line[i + 1] === '/') { push('c', line.slice(i)); break; }
    if (ch === '/' && line[i + 1] === '*') { inComment = true; push('c', '/*'); i += 2; continue; }
    if (ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      const s = line.slice(i, j + 1);
      push(ch === '"' ? 's' : s.includes(':') ? 't' : 'i', s); i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      for (;;) {
        while (j < line.length && ID_CHAR.test(line[j]!) && !(line[j] === '-' && line[j + 1] === '>')) j++;
        if (line[j] === ':' && j + 1 < line.length && ID_CHAR.test(line[j + 1]!) && line[j + 1] !== '-') { j++; continue; }
        break;
      }
      const w = line.slice(i, j);
      push(w.includes(':') ? 't' : w === 'true' || w === 'false' || w === 'null' ? 'n' : /^\s*=(?!=)/.test(line.slice(j)) ? 'd' : KEYWORDS.has(w) ? 'k' : 'i', w);
      i = j; continue;
    }
    const num = /\d/.test(ch) || (ch === '-' && /\d/.test(line[i + 1] ?? '')) ? /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(line.slice(i)) : null;
    if (num) { push('n', num[0]); i += num[0].length; continue; }
    if (ch === '-' && line[i + 1] === '>') { push('o', '->'); i += 2; continue; }
    if (ch === '=' || ch === ':') { push('o', ch); i++; continue; }
    if ('{}[]'.includes(ch)) { push('p', ch); i++; continue; }
    plain += ch; i++;
  }
  if (plain) toks.push(['', plain]);
  return toks;
}

/** ¿Empieza cada línea dentro de un comentario de bloque? */
function commentStarts(lines: string[]): boolean[] {
  const out: boolean[] = [];
  let inC = false;
  for (let l = 0; l < lines.length; l++) {
    out.push(inC);
    const s = lines[l]!;
    if (!inC && !s.includes('/*')) continue;
    for (let i = 0; i < s.length; i++) {
      if (inC) { const e = s.indexOf('*/', i); if (e < 0) break; inC = false; i = e + 1; continue; }
      const ch = s[i];
      if (ch === '"' || ch === '`') { let j = i + 1; while (j < s.length && s[j] !== ch) j += s[j] === '\\' ? 2 : 1; i = j; continue; }
      if (ch === '/' && s[i + 1] === '/') break;
      if (ch === '/' && s[i + 1] === '*') { inC = true; i++; }
    }
  }
  return out;
}

/** Línea "fantasma" (texto transparente) con tramos marcados: subrayados de diagnósticos o coincidencias. */
function GhostLine({ text, segs }: { text: string; segs: [from: number, to: number, cls: string][] }) {
  const out: ReactNode[] = [];
  let at = 0;
  segs.sort((a, b) => a[0] - b[0]).forEach(([from, to, cls], k) => {
    const f = Math.max(at, Math.min(from, text.length)), e = Math.max(f, Math.min(to, text.length));
    if (f > at) out.push(text.slice(at, f));
    out.push(<span key={k} className={cls}>{e > f ? text.slice(f, e) : ' '}</span>);
    at = Math.max(at, e);
  });
  return <div className="ad-txt-line">{out}</div>;
}

// ================================================================ Autocompletado
interface AcItem { label: string; detail?: string }
interface AcState { items: AcItem[]; index: number; from: number; to: number }
const VIEW_KINDS = ['freeform', 'grid', 'sequence', 'tree', 'matrix'];
const START_WORDS = ['include', 'edge', 'note', 'label', 'group', 'view', 'model', 'views', 'doc', 'tags', 'props', 'notation', 'kind', 'viewpoint', 'style', 'detail', 'root', 'library'];

export default function TextPanel({ onClose, layout, defaultSize }: TextPanelProps) {
  const t = useT();
  const ed = useEditor();
  const { store, registry, readOnly, viewId, selection, select, run } = ed;
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = (p: Partial<Prefs>) => setPrefsState(o => { const n = { ...o, ...p }; writePrefs(n); return n; });
  const [scopeView, setScopeView] = useState<string | null>(viewId);
  const scope = useMemo<TextScope>(() => (prefs.scope === 'view' && scopeView && store.get('views', scopeView) ? { kind: 'view', viewId: scopeView } : { kind: 'workspace' }), [prefs.scope, scopeView, store]);
  const positions = prefs.positions;

  const [text, setTextState] = useState('');
  const [snap, setSnapState] = useState<TextSnapshot | null>(null);
  const [problems, setProblems] = useState<SyncIssue[]>([]);
  const [conflict, setConflict] = useState<string[] | null>(null);
  const [status, setStatus] = useState<Status>('synced');
  const [hlLine, setHlLine] = useState<number | null>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0, height: 400 });
  const [ac, setAc] = useState<AcState | null>(null);
  const [find, setFind] = useState({ open: false, q: '', i: 0 });
  const [cw, setCw] = useState(7.2);

  const ta = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const textRef = useRef('');
  const snapRef = useRef<TextSnapshot | null>(null);
  /** Último punto en que texto y modelo coincidían. */
  const syncRef = useRef<{ text: string; base: TextSnapshot; modelText: string } | null>(null);
  const lastInput = useRef(0);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modelDirty = useRef(false);
  const applying = useRef(false);
  const programmatic = useRef(false);
  const noAc = useRef(false);
  const version = useRef(0);
  const pendingCaret = useRef<{ caret: number; top: number; left: number } | null>(null);
  const fromText = useRef(false);
  const lastCaretKey = useRef<string | null>(null);
  const escTab = useRef(false);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const positionsRef = useRef(positions); positionsRef.current = positions;
  const viewIdRef = useRef(viewId); viewIdRef.current = viewId;

  const setSnap = (s: TextSnapshot | null) => { snapRef.current = s; setSnapState(s); };
  const setText = (next: string, caret?: number) => {
    const el = ta.current;
    if (caret !== undefined && el) pendingCaret.current = { caret, top: el.scrollTop, left: el.scrollLeft };
    textRef.current = next; setTextState(next);
  };
  useLayoutEffect(() => {
    const p = pendingCaret.current, el = ta.current;
    if (!p || !el) return;
    pendingCaret.current = null;
    el.setSelectionRange(p.caret, p.caret);
    el.scrollTop = p.top; el.scrollLeft = p.left;
  }, [text]);

  const sizeOf = useCallback((n: ViewNode, el: Element | undefined) => {
    if (!n.elementId) { const vt = n.visualType; return vt === 'core:group' ? { w: 320, h: 220 } : vt === 'core:image' ? { w: 200, h: 150 } : vt === 'core:label' ? { w: 140, h: 28 } : { w: 180, h: 90 }; }
    const type = el ? registry.elementType(el.typeId) : undefined;
    return defaultSize?.(type?.shape, !!type?.container, el?.typeId);
  }, [registry, defaultSize]);

  // ---------------------------------------------------------------- modelo → texto
  const reload = useCallback((ws?: Workspace, ready?: string) => {
    const w = ws ?? store.snapshot();
    const txt = ready ?? panelText(w, scopeRef.current, { positions: positionsRef.current });
    const s = readText(txt, w);
    const old = textRef.current, oldSnap = snapRef.current, el = ta.current;
    const caret = el && old && oldSnap ? mapOffset(old, recordRanges(old, oldSnap.locations), txt, recordRanges(txt, s.locations), el.selectionStart) : undefined;
    syncRef.current = { text: txt, base: s, modelText: txt };
    modelDirty.current = false;
    setSnap(s); setProblems([]); setConflict(null); setStatus('synced');
    if (txt !== old) setText(txt, caret);
  }, [store]);

  /** El modelo cambió: si el texto no tiene cambios pendientes (y no se está tecleando), se rehace. */
  const checkModel = useCallback(() => {
    const sync = syncRef.current;
    if (!modelDirty.current || !sync) return;
    const dirty = textRef.current !== sync.text;
    if (!readOnly && (dirty || Date.now() - lastInput.current < IDLE_MS)) return; // se combina al aplicar
    const ws = store.snapshot();
    const mt = panelText(ws, scopeRef.current, { positions: positionsRef.current });
    modelDirty.current = false;
    if (mt !== sync.modelText || dirty) reload(ws, mt);
  }, [store, readOnly, reload]);

  // ---------------------------------------------------------------- texto → modelo
  const applyNow = useCallback(async (keepMine = false): Promise<void> => {
    clearTimeout(applyTimer.current);
    const sync = syncRef.current;
    if (readOnly || !sync) return;
    const txt = textRef.current;
    if (txt === sync.text && !keepMine) { setStatus('synced'); checkModel(); return; }
    const ws = store.snapshot();
    const mine = readText(txt, ws);
    setSnap(mine);
    if (mine.errors.length) { setProblems([]); setStatus('errors'); return; }
    const sc = scopeRef.current;
    const theirsText = panelText(ws, sc);
    const theirs = readText(theirsText, ws).ws;
    /** ¿Cambió el modelo (dentro del alcance) desde el último punto en común? Entonces, tras combinar, se rehace el texto. */
    const remote = (positionsRef.current ? panelText(ws, sc, { positions: true }) : theirsText) !== sync.modelText;
    const res = computeSync({ current: ws, base: sync.base, mine, scope: sc, theirs, sizeOf, keepMine });
    setProblems(res.problems);
    if (res.problems.some(p => p.severity === 'error')) { setStatus('errors'); return; }
    if (res.conflicts.length) { setConflict(res.conflicts); setStatus('conflict'); return; }
    let commands = res.commands;
    if (res.layoutViews.length && layout && commands.length) {
      const ver = version.current;
      try {
        const tmp = new MemoryStore(structuredClone(ws));
        execute(tmp, { type: 'batch', commands });
        const extra: Command[] = [];
        for (const v of res.layoutViews) { const c = await layout(tmp, v); execute(tmp, c); extra.push(c); }
        if (version.current !== ver || textRef.current !== txt) { schedule(); return; } // cambió algo mientras: otra vez
        commands = [...commands, ...extra];
      } catch { /* sin layout: se queda la colocación provisional */ }
    }
    if (commands.length) {
      applying.current = true;
      try { run({ type: 'batch', label: 'text', commands }); }
      catch (e) { setProblems([{ severity: 'error', key: 'No se pudo aplicar el texto: {error}', vars: { error: e instanceof Error ? e.message : String(e) }, line: 1, col: 1 }]); setStatus('errors'); return; }
      finally { applying.current = false; }
    }
    // Ids que el texto dejó al lenguaje: se escriben, para que renombrar después no cambie el id.
    let finalText = txt, finalSnap = mine;
    const edits = explicitIdEdits(txt, mine);
    if (edits.length && textRef.current === txt) { finalText = applyEdits(txt, edits); insertEdits(edits, finalText); finalSnap = readText(finalText, store.snapshot()); }
    syncRef.current = { text: finalText, base: finalSnap, modelText: panelText(store.snapshot(), sc, { positions: positionsRef.current }) };
    setSnap(finalSnap); setConflict(null); setStatus('synced');
    modelDirty.current = false;
    // El modelo había cambiado también por fuera: ya combinado, el texto se rehace para mostrarlo.
    if (remote && textRef.current === finalText) reload();
    // Si se cambió de vista mientras había cambios pendientes, ahora se sigue a la vista actual.
    if (sc.kind === 'view' && viewIdRef.current && viewIdRef.current !== sc.viewId) setScopeView(viewIdRef.current);
  }, [readOnly, store, sizeOf, layout, run, checkModel, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyRef = useRef(applyNow); applyRef.current = applyNow;
  const schedule = () => { clearTimeout(applyTimer.current); applyTimer.current = setTimeout(() => { void applyRef.current(); }, IDLE_MS); };

  /** Inserciones en el texto que respetan el deshacer del propio campo (si tiene el foco). */
  const insertEdits = (edits: { offset: number; insert: string }[], expected: string) => {
    const el = ta.current;
    if (el && document.activeElement === el) {
      const s0 = el.selectionStart, s1 = el.selectionEnd;
      const shift = (o: number) => o + edits.filter(e => e.offset <= o).reduce((n, e) => n + e.insert.length, 0);
      programmatic.current = true;
      try { for (const e of edits) { el.setSelectionRange(e.offset, e.offset); if (!document.execCommand('insertText', false, e.insert)) el.setRangeText(e.insert, e.offset, e.offset, 'end'); } }
      finally { programmatic.current = false; }
      el.setSelectionRange(shift(s0), shift(s1));
      if (el.value === expected) { textRef.current = expected; setTextState(expected); return; }
    }
    setText(expected, el ? el.selectionStart + edits.filter(e => e.offset <= el.selectionStart).reduce((n, e) => n + e.insert.length, 0) : undefined);
  };

  // Carga inicial y al cambiar de alcance o de "posiciones".
  useEffect(() => { reload(); }, [scope.kind, scope.kind === 'view' ? scope.viewId : '', positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cambios del modelo (los propios no cuentan).
  useEffect(() => store.subscribe(() => {
    version.current++;
    if (applying.current) return;
    modelDirty.current = true;
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(checkModel, 200);
  }), [store, checkModel]);
  useEffect(() => () => { clearTimeout(applyTimer.current); clearTimeout(checkTimer.current); }, []);

  // Cambio de vista en el lienzo: el texto la sigue (si hay cambios pendientes, primero se aplican).
  useEffect(() => {
    if (viewId === scopeView) return;
    const clean = !syncRef.current || textRef.current === syncRef.current.text;
    if (clean || readOnly) { setScopeView(viewId); return; }
    void applyRef.current();
  }, [viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cerrar: lo pendiente y sin errores se aplica.
  useEffect(() => () => { const s = syncRef.current; if (s && textRef.current !== s.text && !readOnly) void applyRef.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cambiar alcance o posiciones: primero se aplica lo pendiente; con errores, no se cambia. */
  const switchPrefs = async (p: Partial<Prefs>) => {
    const s = syncRef.current;
    if (s && textRef.current !== s.text && !readOnly) {
      await applyRef.current();
      if (syncRef.current && textRef.current !== syncRef.current.text) return;
    }
    if (p.scope === 'view') setScopeView(viewIdRef.current);
    setPrefs(p);
  };

  // ---------------------------------------------------------------- edición
  const lines = useMemo(() => text.split('\n'), [text]);
  const starts = useMemo(() => lineStarts(text), [text]);
  const inComment = useMemo(() => commentStarts(lines), [lines]);
  const ranges = useMemo(() => (snap ? recordRanges(snap.text, snap.locations) : []), [snap]);
  const rangesRef = useRef(ranges); rangesRef.current = ranges;
  const fresh = !!snap && snap.text === text;

  const activeNotation = (scope.kind === 'view' ? store.get('views', scope.viewId) : viewId ? store.get('views', viewId) : undefined)?.notationId ?? 'freeform';
  const computeAc = (txt: string, caret: number, explicit: boolean): AcState | null => {
    let s = caret;
    while (s > 0 && /[\w$.:-]/.test(txt[s - 1]!)) s--;
    const prefix = txt.slice(s, caret);
    if (!explicit && !prefix) return null;
    const ls = txt.lastIndexOf('\n', s - 1) + 1;
    const le = txt.indexOf('\n', caret);
    const before = txt.slice(ls, s), lineText = txt.slice(ls, le < 0 ? txt.length : le);
    const isRel = lineText.includes('->');
    const ws = snapRef.current?.ws;
    const ids = (c: 'elements' | 'relations' | 'views' | 'nodes'): AcItem[] => {
      const out = new Map<string, AcItem>();
      for (const r of Object.values((ws?.[c] ?? {}) as Record<string, { id: string; name?: string }>)) out.set(r.id, { label: r.id, detail: r.name });
      if (c !== 'nodes') for (const r of store.list(c) as { id: string; name?: string }[]) if (!out.has(r.id)) out.set(r.id, { label: r.id, detail: r.name });
      // lo declarado en el texto desde la última lectura (aún sin aplicar)
      if (c === 'elements' || c === 'relations') for (const m of txt.matchAll(/^[ \t]*([A-Za-z_$][\w$.-]*)[ \t]*=[ \t]*([^\n]*)/gm)) {
        const rel = m[2]!.includes('->');
        if (!out.has(m[1]!) && (c === 'relations') === rel && (rel || /^`?[A-Za-z_][\w.-]*:/.test(m[2]!))) out.set(m[1]!, { label: m[1]!, detail: /"((?:[^"\\]|\\.)*)"/.exec(m[2]!)?.[1] });
      }
      return [...out.values()];
    };
    const types = (rel: boolean): AcItem[] => {
      const all = rel ? registry.allRelationTypes() : registry.allElementTypes();
      const mine = prefix.includes(':') || activeNotation === 'freeform' ? all : all.filter(ty => ty.notationId === activeNotation || ty.id.startsWith('lib:') || ty.id.startsWith('core:'));
      return mine.map(ty => ({ label: ty.id, detail: t(ty.name) }));
    };
    let items: AcItem[];
    if (/->\s*\S+\s*:\s*$/.test(before)) items = types(true);
    else if (prefix.includes(':')) items = types(isRel);
    else if (/=\s*$/.test(before) && !isRel) items = [...types(false), ...ids('elements')];
    else if (/(?:^|\s)(?:include|root)\s+(?:[^\s,]+\s*,\s*)*$/.test(before) || /->\s*$/.test(before)) items = ids('elements');
    else if (/(?:^|\s)edge\s+$/.test(before)) items = ids('relations');
    else if (/(?:^|\s)(?:detail|current)\s+$/.test(before)) items = ids('views');
    else if (/(?:^|\s)(?:from|to)\s+$/.test(before)) items = [...ids('nodes'), ...ids('elements')];
    else if (/(?:^|\s)notation\s+$/.test(before)) items = registry.allPacks().map(p => ({ label: p.id, detail: t(p.name) }));
    else if (/(?:^|\s)kind\s+$/.test(before)) items = VIEW_KINDS.map(k => ({ label: k }));
    else if (/^\s*$/.test(before) || explicit) items = [...START_WORDS.map(k => ({ label: k })), ...ids('elements')];
    else return null;
    const p = prefix.toLowerCase();
    const score = (it: AcItem) => {
      const l = it.label.toLowerCase();
      if (l.startsWith(p)) return 0;
      if (!p.includes(':') && (l.split(':').pop() ?? '').startsWith(p)) return 1;
      if (p && it.detail?.toLowerCase().startsWith(p)) return 2;
      return -1;
    };
    const ranked = items.map(it => [score(it), it] as const).filter(([sc, it]) => sc >= 0 && it.label !== prefix)
      .sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label)).slice(0, 50).map(([, it]) => it);
    return ranked.length ? { items: ranked, index: 0, from: s, to: caret } : null;
  };

  /** Reemplaza [from, to) por `s` respetando el deshacer del campo. */
  const replaceRange = (from: number, to: number, s: string) => {
    const el = ta.current; if (!el) return;
    el.focus();
    el.setSelectionRange(from, to);
    if (!document.execCommand('insertText', false, s)) { el.setRangeText(s, from, to, 'end'); onInput(el.value, el.selectionStart, false); }
  };

  const onInput = (value: string, caret: number, typed: boolean) => {
    textRef.current = value; setTextState(value);
    setHlLine(null);
    if (programmatic.current || readOnly) return;
    lastInput.current = Date.now();
    setStatus(syncRef.current && value === syncRef.current.text ? 'synced' : 'pending');
    if (typed && !noAc.current) {
      const ch = value[caret - 1] ?? '';
      setAc(/[\w$.:-]/.test(ch) ? computeAc(value, caret, false) : null);
    }
    schedule();
  };
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => onInput(e.target.value, e.target.selectionStart, true);

  const acceptAc = (a: AcState, k = a.index) => {
    const it = a.items[k]; setAc(null);
    if (!it) return;
    noAc.current = true;
    try { replaceRange(a.from, a.to, it.label); } finally { noAc.current = false; }
  };

  // ---------------------------------------------------------------- vista: desplazamiento, línea visible
  const reveal = (offset: number, select?: number) => {
    const el = ta.current; if (!el) return;
    const { line, col } = lineColOf(starts, offset);
    const y = (line - 1) * LH;
    if (y < el.scrollTop + LH) el.scrollTop = Math.max(0, y - 3 * LH);
    else if (y + LH > el.scrollTop + el.clientHeight - LH) el.scrollTop = y - el.clientHeight + 4 * LH;
    const x = (col - 1) * cw;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 40);
    if (select !== undefined) el.setSelectionRange(offset, select);
  };
  const goTo = (line: number, col: number) => {
    const el = ta.current; if (!el) return;
    const off = offsetOf(starts, line, col);
    el.focus({ preventScroll: true });
    el.setSelectionRange(off, off);
    reveal(off);
  };

  useEffect(() => {
    const box = codeRef.current; if (!box) return;
    const ro = new ResizeObserver(() => setScroll(s => ({ ...s, height: box.clientHeight })));
    ro.observe(box);
    if (measure.current) { const w = measure.current.getBoundingClientRect().width / 20; if (w > 0) setCw(w); }
    ta.current?.focus({ preventScroll: true });
    return () => ro.disconnect();
  }, []);
  const onScroll = () => { const el = ta.current; if (el) setScroll(s => ({ ...s, top: el.scrollTop, left: el.scrollLeft })); };

  // ---------------------------------------------------------------- selección cruzada
  const lite = () => {
    const nodes: Workspace['nodes'] = {}, edges: Workspace['edges'] = {};
    for (const n of store.list('nodes')) nodes[n.id] = n;
    for (const e of store.list('edges')) edges[e.id] = e;
    return { nodes, edges };
  };
  const onCaret = () => {
    const el = ta.current;
    if (!el || document.activeElement !== el) return;
    const r = recordAt(rangesRef.current, el.selectionStart);
    const key = r?.key ?? null;
    if (key === lastCaretKey.current) return;
    lastCaretKey.current = key;
    if (!key) return;
    const sel = selectionForRecord(key, lite(), viewIdRef.current);
    if (sel && (sel.nodes.join() !== selection.nodes.join() || sel.edges.join() !== selection.edges.join())) { fromText.current = true; select(sel); }
  };
  useEffect(() => {
    if (fromText.current) { fromText.current = false; return; }
    const el = ta.current;
    if (!el || document.activeElement === el) return;
    const keys = recordsForSelection(selection, lite());
    const r = keys.map(k => rangesRef.current.find(x => x.key === k)).find(Boolean);
    if (!r || !fresh) { setHlLine(null); return; }
    lastCaretKey.current = r.key;
    setHlLine(lineColOf(starts, r.start).line);
    reveal(r.start, r.start);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- búsqueda
  const matches = useMemo(() => {
    if (!find.open || !find.q) return [] as number[];
    const q = find.q.toLowerCase(), lower = text.toLowerCase();
    const out: number[] = [];
    for (let i = lower.indexOf(q); i >= 0 && out.length < 5000; i = lower.indexOf(q, i + q.length)) out.push(i);
    return out;
  }, [text, find.open, find.q]);
  const cur = matches.length ? ((find.i % matches.length) + matches.length) % matches.length : -1;
  const goMatch = (d: number) => {
    if (!matches.length) return;
    const k = ((cur + d) % matches.length + matches.length) % matches.length;
    setFind(f => ({ ...f, i: k }));
    reveal(matches[k]!, matches[k]! + find.q.length);
  };
  const openFind = () => {
    const el = ta.current;
    const sel = el && el.selectionEnd > el.selectionStart && el.selectionEnd - el.selectionStart < 80 ? el.value.slice(el.selectionStart, el.selectionEnd) : '';
    setFind(f => ({ open: true, q: sel && !sel.includes('\n') ? sel : f.q, i: 0 }));
    setTimeout(() => { findInput.current?.focus(); findInput.current?.select(); }, 0);
  };

  // ---------------------------------------------------------------- teclado
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;
    if (ac) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = ac.items.length; setAc({ ...ac, index: (ac.index + (e.key === 'ArrowDown' ? 1 : -1) + n) % n }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptAc(ac); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAc(null); return; }
    }
    if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); openFind(); return; }
    if (e.key === 'F3') { e.preventDefault(); goMatch(e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Escape') { escTab.current = true; if (find.open) { e.stopPropagation(); setFind(f => ({ ...f, open: false })); } return; }
    if (readOnly) return;
    if (mod && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); setAc(computeAc(el.value, el.selectionStart, true)); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void applyRef.current(); return; }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      if (escTab.current) { escTab.current = false; return; } // Esc y luego Tab: el foco sale del texto
      e.preventDefault();
      const ls = el.value.lastIndexOf('\n', el.selectionStart - 1) + 1;
      if (e.shiftKey) { const m = /^ {1,2}/.exec(el.value.slice(ls)); if (m) { const s = el.selectionStart; replaceRange(ls, ls + m[0].length, ''); el.setSelectionRange(Math.max(ls, s - m[0].length), Math.max(ls, s - m[0].length)); } }
      else replaceRange(el.selectionStart, el.selectionEnd, '  ');
      return;
    }
    escTab.current = false;
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const s = el.selectionStart;
      const ls = el.value.lastIndexOf('\n', s - 1) + 1;
      let indent = /^[ \t]*/.exec(el.value.slice(ls, s))![0];
      if (/\{\s*$/.test(el.value.slice(ls, s))) indent += '  ';
      replaceRange(s, el.selectionEnd, `\n${indent}`);
      setAc(null);
    }
  };
  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && !(e.target as HTMLElement).closest('textarea, input, select')) { e.stopPropagation(); onClose(); }
  };

  // ---------------------------------------------------------------- redimensionar
  const onResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = prefs.width;
    const main = (e.currentTarget.closest('.ad-editor__main') as HTMLElement | null)?.clientWidth ?? 1200;
    const move = (ev: PointerEvent) => setPrefsState(p => ({ ...p, width: Math.max(320, Math.min(main - 80, w0 + ev.clientX - x0)) }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setPrefsState(p => { writePrefs(p); return p; }); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // ---------------------------------------------------------------- pintado
  const issues = useMemo(() => {
    if (!snap || !fresh) return [] as { severity: 'error' | 'warning'; line: number; col: number; endLine: number; endCol: number; message: string }[];
    const ds = [...snap.errors, ...snap.warnings].map(d => ({ severity: d.severity, line: d.line, col: d.col, endLine: d.endLine, endCol: d.endCol, message: tMsg(d.key, d.vars) }));
    const ps = problems.map(p => ({ severity: p.severity, line: p.line, col: p.col, endLine: p.line, endCol: p.col + 1, message: tMsg(p.key, p.vars) }));
    return [...ds, ...ps].sort((a, b) => a.line - b.line || a.col - b.col);
  }, [snap, fresh, problems, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const errorCount = issues.filter(i => i.severity === 'error').length;

  const first = Math.max(0, Math.floor(scroll.top / LH) - 4);
  const last = Math.min(lines.length, Math.ceil((scroll.top + scroll.height) / LH) + 4);
  const visible = lines.slice(first, last);
  const diagSegs = (ln: number, len: number): [number, number, string][] => issues.flatMap(d => {
    if (ln < d.line || ln > Math.max(d.line, d.endLine)) return [];
    const from = ln === d.line ? d.col - 1 : 0;
    let to = ln === d.endLine && d.endLine >= d.line ? d.endCol - 1 : len;
    if (to <= from) to = from + 1;
    return [[from, to, d.severity === 'error' ? 'ad-txt-err' : 'ad-txt-warn'] as [number, number, string]];
  });
  const errLines = useMemo(() => new Map(issues.map(i => [i.line, i.severity] as const).sort((a, b) => (a[1] === 'error' ? 1 : 0) - (b[1] === 'error' ? 1 : 0))), [issues]);
  const matchSegs = (ln: number): [number, number, string][] => {
    if (!matches.length) return [];
    const s = starts[ln - 1]!, e = ln < starts.length ? starts[ln]! : text.length + 1;
    return matches.flatMap((m, k) => (m >= s && m < e ? [[m - s, m - s + find.q.length, k === cur ? 'ad-txt-hit is-cur' : 'ad-txt-hit'] as [number, number, string]] : []));
  };
  const layerStyle = { transform: `translate(${PAD_L - scroll.left}px, ${PAD_T + first * LH - scroll.top}px)` };
  const gutterW = `calc(${String(lines.length).length}ch + 18px)`;
  const caretPos = ac ? lineColOf(starts, ac.from) : null;
  const scopeName = scope.kind === 'view' ? store.get('views', scope.viewId)?.name ?? '' : '';

  const statusText = readOnly ? t('Solo lectura')
    : status === 'pending' ? t('Sin aplicar…')
    : status === 'conflict' ? t('Conflicto')
    : status === 'errors' ? (errorCount === 1 ? t('1 error') : t('{n} errores', { n: errorCount || 1 }))
    : t('Sincronizado');

  return (
    <aside className="ad-txt-panel" aria-label={t('Texto')} onKeyDown={onPanelKeyDown} style={{ width: prefs.width }}>
      <header className="ad-txt-head">
        <span className="ad-txt-title">{t('Texto')}</span>
        <select className="ad-input ad-txt-scope" aria-label={t('Alcance del texto')} value={scope.kind} onChange={e => void switchPrefs({ scope: e.target.value as Prefs['scope'] })}>
          <option value="view" disabled={!viewId}>{t('Vista actual')}</option>
          <option value="workspace">{t('Todo el espacio')}</option>
        </select>
        <label className="ad-txt-opt" title={t('Escribir posiciones, tamaños y puntos de quiebre')}><input type="checkbox" checked={positions} onChange={e => void switchPrefs({ positions: e.target.checked })} />{t('Posiciones')}</label>
        <span className="ad-txt-spacer" />
        <HelpLink slug="dsl" anchor="editar-como-texto" label={t('Ayuda')} className="ad-help-link--compact" />
        <button className="ad-btn ad-btn--ghost" onClick={openFind} aria-label={t('Buscar en el texto (Ctrl+F)')} title={t('Buscar en el texto (Ctrl+F)')}><Icon name="search" size={14} /></button>
        <button className="ad-btn ad-btn--ghost" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar (Ctrl+Shift+E)')}><Icon name="close" size={14} /></button>
      </header>
      <div className="ad-txt-sub">
        <span className="ad-txt-where" title={scopeName || undefined}>{scopeName ? t('Vista «{name}»', { name: scopeName }) : t('Todo el espacio')}</span>
        <span className={`ad-txt-status ad-txt-status--${readOnly ? 'ro' : status}`} role="status" aria-live="polite">{statusText}</span>
      </div>
      {conflict && (
        <div className="ad-txt-alert" role="alert">
          <span title={conflict.join('\n')}>{t('El modelo cambió mientras editabas: los mismos datos tienen otro valor.')}</span>
          <button className="ad-btn" onClick={() => reload()}>{t('Recargar texto')}</button>
          <button className="ad-btn" onClick={() => void applyNow(true)}>{t('Mantener el mío')}</button>
        </div>
      )}
      {find.open && (
        <div className="ad-txt-find" role="search">
          <input ref={findInput} className="ad-input" value={find.q} placeholder={t('Buscar')} aria-label={t('Buscar en el texto')}
            onChange={e => setFind(f => ({ ...f, q: e.target.value, i: 0 }))}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'F3') { e.preventDefault(); goMatch(e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setFind(f => ({ ...f, open: false })); ta.current?.focus(); }
            }} />
          <span className="ad-txt-count">{find.q ? (matches.length ? `${cur + 1}/${matches.length}` : t('Sin resultados')) : ''}</span>
          <button className="ad-btn ad-btn--ghost" onClick={() => goMatch(-1)} disabled={!matches.length} aria-label={t('Anterior')} title={t('Anterior (Shift+Intro)')}>↑</button>
          <button className="ad-btn ad-btn--ghost" onClick={() => goMatch(1)} disabled={!matches.length} aria-label={t('Siguiente')} title={t('Siguiente (Intro)')}>↓</button>
          <button className="ad-btn ad-btn--ghost" onClick={() => { setFind(f => ({ ...f, open: false })); ta.current?.focus(); }} aria-label={t('Cerrar la búsqueda')}><Icon name="close" size={12} /></button>
        </div>
      )}
      <div className="ad-txt-editor">
        <div className="ad-txt-gutter" style={{ width: gutterW }} aria-hidden="true">
          <div style={{ transform: `translateY(${PAD_T + first * LH - scroll.top}px)` }}>
            {visible.map((_, k) => { const ln = first + k + 1; const sev = errLines.get(ln); return <div key={ln} className={`ad-txt-ln${sev ? ` is-${sev}` : ''}${ln === hlLine ? ' is-hl' : ''}`}>{ln}</div>; })}
          </div>
        </div>
        <div className="ad-txt-code" ref={codeRef}>
          {hlLine !== null && <div className="ad-txt-hlline" style={{ top: PAD_T + (hlLine - 1) * LH - scroll.top }} aria-hidden="true" />}
          <div className="ad-txt-layer ad-txt-layer--hl" style={layerStyle} aria-hidden="true">
            <span ref={measure} className="ad-txt-measure">{'x'.repeat(20)}</span>
            {visible.map((l, k) => <div key={first + k} className="ad-txt-line">{tokenizeLine(l, inComment[first + k]!).map(([cls, s], j) => (cls ? <span key={j} className={`ad-txt-tk-${cls}`}>{s}</span> : s))}</div>)}
          </div>
          {(issues.length > 0 || matches.length > 0) && (
            <div className="ad-txt-layer ad-txt-layer--marks" style={layerStyle} aria-hidden="true">
              {visible.map((l, k) => { const ln = first + k + 1; const segs = [...diagSegs(ln, l.length), ...matchSegs(ln)]; return segs.length ? <GhostLine key={ln} text={l} segs={segs} /> : <div key={ln} className="ad-txt-line" />; })}
            </div>
          )}
          <textarea ref={ta} className="ad-txt-input" value={text} onChange={onChange} onScroll={onScroll} onKeyDown={onKeyDown}
            onSelect={onCaret} onClick={() => { setAc(null); onCaret(); }} onBlur={() => setAc(null)}
            readOnly={readOnly} spellCheck={false} wrap="off" autoCapitalize="off" autoComplete="off" autoCorrect="off"
            aria-label={scope.kind === 'view' ? t('Texto de la vista «{name}»', { name: scopeName }) : t('Texto del espacio')}
            aria-invalid={errorCount > 0} aria-autocomplete="list" aria-expanded={!!ac} aria-controls={ac ? 'ad-txt-ac' : undefined} />
          {ac && caretPos && (
            <ul id="ad-txt-ac" className="ad-txt-ac" role="listbox" aria-label={t('Sugerencias')}
              style={{ top: PAD_T + caretPos.line * LH - scroll.top + 2, left: Math.max(0, PAD_L + (caretPos.col - 1) * cw - scroll.left - 4) }}>
              {ac.items.map((it, k) => (
                <li key={it.label} role="option" aria-selected={k === ac.index} className={k === ac.index ? 'is-on' : ''}
                  onMouseDown={e => { e.preventDefault(); acceptAc(ac, k); }}>
                  <code>{it.label}</code>{it.detail && it.detail !== it.label && <small>{it.detail}</small>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="ad-txt-problems" aria-label={t('Problemas del texto')}>
          {issues.slice(0, 200).map((d, k) => (
            <li key={k}><button className={`ad-link ad-txt-problem is-${d.severity}`} onClick={() => goTo(d.line, d.col)}>
              <Icon name={d.severity === 'error' ? 'error' : 'warning'} size={12} /><span className="ad-txt-pos">{d.line}:{d.col}</span><span>{d.message}</span>
            </button></li>
          ))}
        </ul>
      )}
      <div className="ad-txt-resize" onPointerDown={onResize} role="separator" aria-orientation="vertical" aria-label={t('Cambiar el ancho del panel de texto')} />
    </aside>
  );
}
