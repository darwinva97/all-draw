/**
 * Comentarios: panel lateral de hilos (filtros, responder, editar, resolver, menciones), sección
 * pequeña del inspector, botón de la barra y capa del lienzo (burbujas sobre nodos/aristas y
 * marcadores en puntos). Los comentarios son una colección más del `Workspace`: se sincronizan y se
 * deshacen como cualquier registro. En solo lectura se leen pero no se escriben.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ViewportPortal, useReactFlow, useStore as useFlowStore, useViewport } from '@xyflow/react';
import {
  anchorViewIds, commentThreads, indexOf, makeComment, openThreadCount, threadsOf, threadsOfView,
  type Command, type Comment, type CommentAnchor, type CommentAuthor, type CommentThread, type Person,
} from '@all-draw/core';
import { useLang, useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange, useCollection } from '../hooks';
import { initials, colorFor } from '../presence';
import {
  anchorLabel, anchorNodesIn, anchorTarget, applyMention, commentAuthor, isOwn, matchPeople, mentionQuery, mentionsIn, relativeTime, splitMentions,
} from './comments-helpers';
import { Icon, type IconName } from '../icons';
import { HelpLink } from './HelpLink';
import { confirmDialog } from '../ui/dialog';

/** Glifo del ancla (`anchorLabel`) → icono SVG. */
const ANCHOR_ICON: Record<string, IconName> = { '◆': 'diamond', '↗': 'trace', '▭': 'view', '▦': 'layers', '◎': 'pin' };
const AnchorIcon = ({ glyph }: { glyph: string }) => <Icon name={ANCHOR_ICON[glyph] ?? 'diamond'} size={12} />;

type Filter = 'open' | 'resolved' | 'all';

/** Autor de los comentarios propios (presencia → `localStorage('alldraw:me')` → "Anónimo"). */
function useCommentAuthor(): CommentAuthor {
  const t = useT();
  const { presence } = useEditor();
  return useMemo(() => commentAuthor(presence?.me, t('Anónimo')), [presence, t]);
}

/** Reloj para las fechas relativas (se refresca cada 30 s). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  return now;
}

const hashColor = (s: string) => colorFor([...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));

/** Lleva el lienzo al ancla del hilo: abre su vista, selecciona lo comentado y pide centrarlo. */
function useGoToThread() {
  const { store, viewId, openView, select, openComments } = useEditor();
  return useCallback((th: CommentThread) => {
    const target = anchorTarget(store, th.anchor, viewId);
    if (target) {
      if (target.viewId !== viewId) openView(target.viewId);
      select({ nodes: target.nodes, edges: target.edges });
    }
    openComments({ threadId: th.id, reveal: true });
  }, [store, viewId, openView, select, openComments]);
}

// ---------------------------------------------------------------- iconos (SVG: no dependen de fuentes de emoji)
export function CommentIcon({ size = 14 }: { size?: number }) {
  return <svg className="ad-cm-icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.6c0-.9.7-1.6 1.6-1.6h7.8c.9 0 1.6.7 1.6 1.6v5.8c0 .9-.7 1.6-1.6 1.6H7.2L4.4 13.4V11h-.3c-.9 0-1.6-.7-1.6-1.6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
}
function TrashIcon() {
  return <svg className="ad-cm-icon" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ---------------------------------------------------------------- barra
/** Botón 💬 de la barra con el número de hilos abiertos del espacio. */
export function CommentsToolButton({ labels }: { labels?: boolean }) {
  const t = useT();
  const { store, comments, openComments, closeComments } = useEditor();
  useCollection('comments');
  const n = openThreadCount(store);
  const title = n ? t('Comentarios: {n} sin resolver', { n }) : t('Comentarios');
  return (
    <button className={`ad-btn ad-cm-toolbtn ${comments.open ? 'is-on' : ''}`} onClick={() => (comments.open ? closeComments() : openComments())}
      aria-pressed={comments.open} title={title} aria-label={title}>
      <CommentIcon size={15} />{n > 0 && <span className="ad-cm-count" aria-hidden="true">{n}</span>}
      {labels && <span className="ad-btn__label">{t('Comentarios')}</span>}
    </button>
  );
}

// ---------------------------------------------------------------- panel
export function CommentsPanel() {
  const t = useT();
  const { store, viewId, readOnly, comments, closeComments, openComments, run } = useEditor();
  useAnyChange();
  const me = useCommentAuthor();
  const people = useCollection('people');
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('open');
  const [onlyView, setOnlyView] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Un hilo pedido desde fuera (burbuja, inspector) siempre se ve: se relajan los filtros si hace falta.
  useEffect(() => {
    const th = comments.threadId ? commentThreads(store).find(x => x.id === comments.threadId) : undefined;
    if (!th) return;
    if (th.resolved && filter === 'open') setFilter('all');
    if (!th.resolved && filter === 'resolved') setFilter('all');
    if (onlyView && viewId && !anchorViewIds(store, th.anchor).includes(viewId)) setOnlyView(false);
    const id = setTimeout(() => listRef.current?.querySelector<HTMLElement>(`[data-thread="${CSS.escape(th.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    return () => clearTimeout(id);
  }, [comments.threadId, comments.reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = onlyView && viewId ? threadsOfView(store, viewId) : commentThreads(store);
  const counts = { open: all.filter(x => !x.resolved).length, resolved: all.filter(x => x.resolved).length, all: all.length };
  const list = all.filter(x => filter === 'all' || (filter === 'open' ? !x.resolved : x.resolved));

  const create = (text: string, mentions: string[]) => {
    if (!comments.draft) return;
    const c = makeComment(comments.draft, me, text, { mentions });
    run({ type: 'set', collection: 'comments', id: c.id, value: c });
    if (filter === 'resolved') setFilter('open');
    openComments({ threadId: c.id, draft: null });
  };
  const draftLabel = comments.draft ? anchorLabel(store, comments.draft, t) : null;

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && !(e.target as HTMLElement).closest('textarea')) { e.stopPropagation(); closeComments(); }
  };

  return (
    <aside className="ad-cm-panel" aria-label={t('Comentarios')} onKeyDown={onKeyDown}>
      <header className="ad-cm-panel__head">
        <span className="ad-cm-panel__title">{t('Comentarios')}</span>
        <HelpLink slug="comentarios" label={t('Ayuda')} className="ad-help-link--compact" />
        {!readOnly && viewId && !comments.draft && (
          <button className="ad-btn ad-btn--ghost" onClick={() => openComments({ draft: { kind: 'view', id: viewId, viewId } })} title={t('Comentar la vista entera')}><Icon name="plus" size={14} />{t('Comentar la vista')}</button>
        )}
        <button className="ad-btn ad-btn--ghost" onClick={closeComments} aria-label={t('Cerrar')} title={t('Cerrar')}><Icon name="close" size={14} /></button>
      </header>
      <div className="ad-cm-panel__filters">
        <div className="ad-cm-seg" role="radiogroup" aria-label={t('Filtrar comentarios')}>
          {(['open', 'resolved', 'all'] as const).map(f => (
            <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
              {f === 'open' ? t('Abiertos') : f === 'resolved' ? t('Resueltos') : t('Todos')} <small>{counts[f]}</small>
            </button>
          ))}
        </div>
        <label className="ad-cm-onlyview"><input type="checkbox" checked={onlyView} disabled={!viewId} onChange={e => setOnlyView(e.target.checked)} /> {t('Solo esta vista')}</label>
      </div>
      <div className="ad-cm-panel__scroll" ref={listRef}>
        {comments.draft && !readOnly && draftLabel && (
          <div className="ad-cm-thread is-draft">
            <div className="ad-cm-anchor is-static"><AnchorIcon glyph={draftLabel.icon} /> {draftLabel.label}</div>
            <Composer autoFocus people={people} placeholder={t('Escribe un comentario… (@ para mencionar)')} submitLabel={t('Comentar')}
              onSubmit={create} onCancel={() => openComments({ draft: null })} />
          </div>
        )}
        {list.length === 0 && !comments.draft && (
          <div className="ad-cm-empty">
            {filter === 'resolved' ? t('No hay hilos resueltos.') : filter === 'open' ? t('No hay comentarios abiertos.') : t('Todavía no hay comentarios.')}
            {!readOnly && filter !== 'resolved' && <div className="ad-cm-empty__hint">{t('Botón derecho sobre un nodo → "Comentar", o sobre el lienzo → "Comentar aquí".')}</div>}
          </div>
        )}
        {list.map(th => <ThreadCard key={th.id} th={th} active={th.id === comments.threadId} me={me} people={people} now={now} />)}
      </div>
    </aside>
  );
}

function ThreadCard({ th, active, me, people, now }: { th: CommentThread; active: boolean; me: CommentAuthor; people: Person[]; now: number }) {
  const t = useT();
  const { store, run, readOnly, openComments } = useEditor();
  const goTo = useGoToThread();
  const [replying, setReplying] = useState(false);
  const label = anchorLabel(store, th.anchor, t);

  const reply = (text: string, mentions: string[]) => {
    const c = makeComment(th.anchor, me, text, { threadId: th.id, mentions });
    const cmds: Command[] = [{ type: 'set', collection: 'comments', id: c.id, value: c }];
    // Responder a un hilo resuelto lo reabre
    if (th.resolved) cmds.push({ type: 'patch', collection: 'comments', id: th.root.id, patch: { resolved: false, resolvedBy: undefined } });
    run({ type: 'batch', label: 'responder', commands: cmds });
    setReplying(false);
  };
  const toggleResolved = () => run({ type: 'patch', collection: 'comments', id: th.root.id, patch: th.resolved ? { resolved: false, resolvedBy: undefined } : { resolved: true, resolvedBy: me.name } });

  return (
    <article className={`ad-cm-thread ${active ? 'is-active' : ''} ${th.resolved ? 'is-resolved' : ''}`} data-thread={th.id}
      onClick={() => { if (!active) openComments({ threadId: th.id }); }}>
      <div className="ad-cm-thread__top">
        <button className={`ad-cm-anchor ${label.missing ? 'is-missing' : ''}`} onClick={e => { e.stopPropagation(); goTo(th); }} title={t('Ir a lo comentado')}>
          <AnchorIcon glyph={label.icon} /> <span className="ad-cm-anchor__label">{label.label}</span>
        </button>
        {th.resolved && <span className="ad-cm-badge" title={th.root.resolvedBy ? t('Resuelto por {name}', { name: th.root.resolvedBy }) : undefined}><Icon name="check" size={12} />{t('Resuelto')}</span>}
      </div>
      {th.comments.map((c, i) => <CommentItem key={c.id} c={c} th={th} isRoot={i === 0} me={me} people={people} now={now} />)}
      {!readOnly && (
        <div className="ad-cm-thread__actions">
          {replying
            ? <Composer autoFocus people={people} placeholder={t('Responder…')} submitLabel={t('Responder')} onSubmit={reply} onCancel={() => setReplying(false)} />
            : <>
              <button className="ad-btn ad-btn--ghost" onClick={e => { e.stopPropagation(); setReplying(true); openComments({ threadId: th.id }); }}>{t('Responder')}</button>
              <button className="ad-btn ad-btn--ghost" onClick={e => { e.stopPropagation(); toggleResolved(); }}>{th.resolved ? t('Reabrir') : <><Icon name="check" size={14} />{t('Resolver')}</>}</button>
            </>}
        </div>
      )}
    </article>
  );
}

function CommentItem({ c, th, isRoot, me, people, now }: { c: Comment; th: CommentThread; isRoot: boolean; me: CommentAuthor; people: Person[]; now: number }) {
  const t = useT();
  const [lang] = useLang();
  const { run, readOnly } = useEditor();
  const [editing, setEditing] = useState(false);
  const own = !readOnly && isOwn(c, me);
  const save = (text: string, mentions: string[]) => {
    run({ type: 'patch', collection: 'comments', id: c.id, patch: { text, mentions, editedAt: new Date().toISOString() } });
    setEditing(false);
  };
  const remove = async () => {
    if (isRoot && th.comments.length > 1) {
      if (!(await confirmDialog({ title: t('¿Borrar el hilo entero ({n} comentarios)?', { n: th.comments.length }), message: t('Se borran el comentario inicial y todas sus respuestas.'), danger: true }))) return;
      run({ type: 'batch', label: 'borrar hilo', commands: th.comments.map(x => ({ type: 'delete', collection: 'comments', id: x.id }) as Command) });
    } else run({ type: 'delete', collection: 'comments', id: c.id });
  };
  const color = c.author.color ?? hashColor(c.author.name);
  const when = relativeTime(c.createdAt, now, lang);
  return (
    <div className={`ad-cm-item ${isRoot ? 'is-root' : ''}`}>
      <span className="ad-cm-avatar" style={{ background: color }} aria-hidden="true">{initials(c.author.name)}</span>
      <div className="ad-cm-item__body">
        <div className="ad-cm-item__meta">
          <b>{c.author.name}</b>
          <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString(lang)}>{when}</time>
          {c.editedAt && <span className="ad-cm-edited" title={new Date(c.editedAt).toLocaleString(lang)}>{t('(editado)')}</span>}
          {own && !editing && (
            <span className="ad-cm-item__tools">
              <button className="ad-btn ad-btn--ghost" onClick={e => { e.stopPropagation(); setEditing(true); }} title={t('Editar')} aria-label={t('Editar')}><Icon name="edit" size={14} /></button>
              <button className="ad-btn ad-btn--ghost" onClick={e => { e.stopPropagation(); remove(); }} title={t('Borrar')} aria-label={t('Borrar')}><TrashIcon /></button>
            </span>
          )}
        </div>
        {editing
          ? <Composer autoFocus people={people} initial={c.text} submitLabel={t('Guardar')} onSubmit={save} onCancel={() => setEditing(false)} />
          : <p className="ad-cm-text">{splitMentions(c.text, people).map((p, i) => p.person
            ? <span key={i} className="ad-cm-mention" title={p.person.team ?? p.person.email ?? p.person.name}>{p.text}</span>
            : <span key={i}>{p.text}</span>)}</p>}
      </div>
    </div>
  );
}

/** Editor de texto con autocompletado de `@persona`. Ctrl+Enter envía, Escape cancela. */
function Composer({ initial = '', placeholder, submitLabel, onSubmit, onCancel, people, autoFocus }: {
  initial?: string; placeholder?: string; submitLabel: string; people: Person[]; autoFocus?: boolean;
  onSubmit: (text: string, mentions: string[]) => void; onCancel: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(initial);
  const [q, setQ] = useState<{ start: number; query: string } | null>(null);
  const [hi, setHi] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const sugs = q ? matchPeople(people, q.query) : [];
  useEffect(() => { if (autoFocus) { const el = ta.current; el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); } }, [autoFocus]);

  const refresh = (value: string, caret: number) => { const m = mentionQuery(value, caret); setQ(m); setHi(0); };
  const pick = (p: Person) => {
    if (!q || !ta.current) return;
    const r = applyMention(text, ta.current.selectionStart ?? text.length, q.start, p.name.trim());
    setText(r.text); setQ(null);
    requestAnimationFrame(() => { ta.current?.focus(); ta.current?.setSelectionRange(r.caret, r.caret); });
  };
  const submit = () => { const v = text.trim(); if (!v) return; onSubmit(v, mentionsIn(v, people)); setText(''); setQ(null); };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (sugs.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % sugs.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + sugs.length) % sugs.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(sugs[hi]!); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQ(null); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };
  return (
    <div className="ad-cm-composer" onClick={e => e.stopPropagation()}>
      <div className="ad-cm-composer__field">
      <textarea ref={ta} className="ad-input ad-cm-composer__input" rows={2} value={text} placeholder={placeholder} aria-label={placeholder ?? submitLabel}
        aria-autocomplete="list" aria-expanded={sugs.length > 0}
        onChange={e => { setText(e.target.value); refresh(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onKeyUp={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') refresh(e.currentTarget.value, e.currentTarget.selectionStart ?? 0); }}
        onBlur={() => setTimeout(() => setQ(null), 150)}
        onKeyDown={onKeyDown} />
      {sugs.length > 0 && (
        <ul className="ad-cm-mentions" role="listbox" aria-label={t('Personas')}>
          {sugs.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === hi} className={i === hi ? 'is-on' : ''} onMouseDown={e => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
              <span className="ad-cm-avatar ad-cm-avatar--sm" style={{ background: hashColor(p.name) }} aria-hidden="true">{initials(p.name)}</span>
              {p.name}{(p.team || p.email) && <small>{p.team ?? p.email}</small>}
            </li>
          ))}
        </ul>
      )}
      {q && sugs.length === 0 && people.length === 0 && <div className="ad-cm-mentions ad-cm-mentions--empty">{t('No hay personas en el espacio (Espacio → Personas).')}</div>}
      </div>
      <div className="ad-cm-composer__row">
        <small className="ad-cm-composer__hint">{t('Ctrl+Enter para enviar')}</small>
        <button className="ad-btn ad-btn--ghost" onClick={onCancel}>{t('Cancelar')}</button>
        <button className="ad-btn ad-btn--primary" disabled={!text.trim()} onClick={submit}>{submitLabel}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inspector
/** Sección pequeña del inspector: hilos de lo seleccionado y botón para comentar. */
export function CommentsSection({ anchors, newAnchor }: { anchors: CommentAnchor[]; newAnchor: CommentAnchor }) {
  const t = useT();
  const { store, readOnly, openComments } = useEditor();
  useCollection('comments');
  const seen = new Set<string>();
  const threads = anchors.flatMap(a => threadsOf(store, a)).filter(th => (seen.has(th.id) ? false : (seen.add(th.id), true)));
  const open = threads.filter(th => !th.resolved).length;
  return (
    <div className="ad-cm-section">
      <div className="ad-section ad-cm-section__head">
        <span>{t('Comentarios')} ({open}{threads.length > open ? ` / ${threads.length}` : ''})</span>
        {!readOnly && <button className="ad-btn ad-btn--ghost" onClick={() => openComments({ draft: newAnchor })}><Icon name="plus" size={14} />{t('Comentar')}</button>}
      </div>
      {threads.length === 0 && <div className="ad-hint">{t('Sin comentarios.')}</div>}
      {threads.slice(0, 5).map(th => (
        <button key={th.id} className={`ad-link ad-cm-mini ${th.resolved ? 'is-resolved' : ''}`} onClick={() => openComments({ threadId: th.id })}>
          <b>{th.root.author.name}</b> <span className="ad-cm-mini__text">{th.root.text}</span>
          <small>{th.resolved ? <Icon name="check" size={12} /> : null}{th.comments.length > 1 ? ` ${t('{n} respuestas', { n: th.comments.length - 1 })}` : ''}</small>
        </button>
      ))}
      {threads.length > 5 && <button className="ad-link" onClick={() => openComments()}>{t('Ver todos ({n})', { n: threads.length })}</button>}
    </div>
  );
}

// ---------------------------------------------------------------- lienzo
interface Bubble { key: string; x: number; y: number; threads: CommentThread[]; kind: 'node' | 'edge' | 'point' }

/**
 * Capa del lienzo (va dentro de `<ReactFlow>`): burbuja con el número de hilos abiertos sobre cada
 * nodo/arista comentados y un marcador en cada punto. Clic → abre el hilo en el panel. También
 * atiende las peticiones de "ir al ancla" (`comments.reveal`) centrando el lienzo.
 */
export function CommentLayer() {
  const t = useT();
  const { store, viewId, comments, openComments } = useEditor();
  const cms = useCollection('comments');
  const nodes = useCollection('nodes');
  const edges = useCollection('edges');
  const rf = useReactFlow();
  const { zoom } = useViewport();

  const groups = useMemo(() => {
    const byNode = new Map<string, CommentThread[]>(), byEdge = new Map<string, CommentThread[]>(), points: CommentThread[] = [];
    if (!viewId) return { byNode, byEdge, points };
    const idx = indexOf(store);
    const push = (m: Map<string, CommentThread[]>, id: string, th: CommentThread) => { const l = m.get(id); if (l) { if (!l.includes(th)) l.push(th); } else m.set(id, [th]); };
    for (const th of threadsOfView(store, viewId)) {
      if (th.resolved) continue;
      const a = th.anchor;
      if (a.kind === 'node' && a.id) push(byNode, a.id, th);
      else if (a.kind === 'element' && a.id) for (const n of idx.nodesOfElement(a.id)) { if (n.viewId === viewId) push(byNode, n.id, th); }
      else if (a.kind === 'edge' && a.id) push(byEdge, a.id, th);
      else if (a.kind === 'relation' && a.id) for (const e of idx.edgesOfRelation(a.id)) { if (e.viewId === viewId) push(byEdge, e.id, th); }
      else if (a.kind === 'point' && a.x !== undefined && a.y !== undefined) points.push(th);
    }
    return { byNode, byEdge, points };
  }, [store, viewId, cms, nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Posiciones absolutas (medidas por React Flow) de los nodos que hacen falta; la firma evita re-renders si no cambian.
  const needed = useMemo(() => {
    const s = new Set(groups.byNode.keys());
    for (const id of groups.byEdge.keys()) { const e = store.get('edges', id); if (e) { s.add(e.fromNodeId); s.add(e.toNodeId); } }
    return [...s];
  }, [groups, store]);
  const sig = useFlowStore(useCallback(s => needed.map(id => {
    const n = s.nodeLookup.get(id); if (!n) return '';
    const p = n.internals.positionAbsolute;
    return `${id}:${Math.round(p.x)}:${Math.round(p.y)}:${Math.round(n.measured.width ?? n.width ?? 0)}:${Math.round(n.measured.height ?? n.height ?? 0)}`;
  }).join('|'), [needed]));
  const boxes = useMemo(() => {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const part of sig.split('|')) { if (!part) continue; const [id, x, y, w, h] = part.split(':'); m.set(id!, { x: +x!, y: +y!, w: +w!, h: +h! }); }
    return m;
  }, [sig]);

  const bubbles: Bubble[] = [];
  for (const [id, ths] of groups.byNode) { const b = boxes.get(id); if (b) bubbles.push({ key: `n:${id}`, x: b.x + b.w - 2, y: b.y + 2, threads: ths, kind: 'node' }); }
  for (const [id, ths] of groups.byEdge) {
    const e = store.get('edges', id); if (!e) continue;
    const a = boxes.get(e.fromNodeId), b = boxes.get(e.toNodeId); if (!a || !b) continue;
    let p: { x: number; y: number };
    if (e.bendpoints.length) { const i = Math.floor(e.bendpoints.length / 2); p = e.bendpoints.length % 2 ? e.bendpoints[i]! : { x: (e.bendpoints[i - 1]!.x + e.bendpoints[i]!.x) / 2, y: (e.bendpoints[i - 1]!.y + e.bendpoints[i]!.y) / 2 }; }
    else p = { x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2 };
    bubbles.push({ key: `e:${id}`, x: p.x, y: p.y, threads: ths, kind: 'edge' });
  }
  for (const th of groups.points) bubbles.push({ key: `p:${th.id}`, x: th.anchor.x!, y: th.anchor.y!, threads: [th], kind: 'point' });
  const draft = comments.draft?.kind === 'point' && comments.draft.viewId === viewId && comments.draft.x !== undefined ? comments.draft : null;

  // "Ir al ancla": centra el lienzo cuando el hilo pedido es visible en la vista actual.
  const handled = useRef(comments.reveal);
  useEffect(() => {
    if (comments.reveal === handled.current || !viewId || !comments.threadId) return;
    const th = commentThreads(store).find(x => x.id === comments.threadId);
    if (!th || !anchorViewIds(store, th.anchor).includes(viewId)) return;
    const timer = setTimeout(() => {
      handled.current = comments.reveal;
      const a = th.anchor;
      const ids = anchorNodesIn(store, a, viewId).filter(id => rf.getInternalNode(id));
      if (a.kind === 'point' && a.x !== undefined && a.y !== undefined) void rf.setCenter(a.x, a.y, { zoom: Math.max(rf.getZoom(), 0.9), duration: 300 });
      else if (ids.length) void rf.fitView({ nodes: ids.map(id => ({ id })), duration: 300, padding: 0.5, maxZoom: 1.3 });
    }, 60);
    return () => clearTimeout(timer);
  }, [comments.reveal, comments.threadId, viewId, store, rf]);

  if (!bubbles.length && !draft) return null;
  const scale = 1 / zoom;
  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return (
    <ViewportPortal>
      {bubbles.map(b => {
        const active = b.threads.some(th => th.id === comments.threadId) && comments.open;
        const first = b.threads[0]!;
        const title = b.threads.length === 1
          ? `${first.root.author.name}: ${first.root.text.slice(0, 80)}`
          : t('{n} hilos sin resolver', { n: b.threads.length });
        return (
          <button key={b.key} className={`ad-cm-bubble ad-cm-bubble--${b.kind} nodrag nopan ${active ? 'is-active' : ''}`} title={title} aria-label={title}
            style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${scale})` }}
            onPointerDown={stop} onMouseDown={stop} onDoubleClick={stop}
            onClick={e => { e.stopPropagation(); openComments({ threadId: first.id }); }}>
            <span className="ad-cm-bubble__in">{b.kind === 'point' ? first.comments.length : b.threads.length}</span>
          </button>
        );
      })}
      {draft && (
        <div className="ad-cm-bubble ad-cm-bubble--point ad-cm-bubble--draft" aria-hidden="true" style={{ transform: `translate(${draft.x}px, ${draft.y}px) scale(${scale})` }}>
          <span className="ad-cm-bubble__in"><Icon name="plus" size={12} /></span>
        </div>
      )}
    </ViewportPortal>
  );
}
