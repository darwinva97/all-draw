/**
 * Paleta de comandos (Ctrl+K / Ctrl+F): busca elementos, vistas y acciones. Elegir un elemento
 * lo selecciona y encuadra si está en la vista actual; si no, ofrece sus vistas para saltar.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';
import { searchWorkspace, scoreText, type SearchAction, type SearchHit } from '../search';
import { cmdkRecent, noteCmdkChoice } from '../prefs';
import { Icon, type IconName } from '../icons';
import { useModal } from '../ui/modal';

/** Resultados que se pintan de golpe; el resto sale con "mostrar más". */
export const CMDK_PAGE = 200;

/** Acción que abre la lista de vistas («Ir a la vista…») y la que abre la de notaciones («Nueva vista…»). */
export const GO_VIEW_ACTION = 'go-view';
export const NEW_VIEW_ACTION = 'new-view';
type Mode = 'all' | 'views' | 'new-view';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  actions: SearchAction[];
  onAction: (id: string) => void;
}

export function CommandPalette({ open, onClose, actions, onAction }: CommandPaletteProps) {
  const t = useT();
  const { store, registry, viewId, openView, select, canvas } = useEditor();
  useAnyChange();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [pending, setPending] = useState<Extract<SearchHit, { kind: 'element' }> | null>(null);
  const [shown, setShown] = useState(CMDK_PAGE);
  /** Submenús: «Ir a la vista…» (solo vistas) y «Nueva vista…» (una por notación). Escape vuelve a la lista. */
  const [mode, setMode] = useState<Mode>('all');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Foco en el campo al abrir, atrapado mientras está abierta; Escape vuelve de "elige una vista" o cierra; al cerrar,
  // el foco vuelve a donde estaba (salvo que el salto a un elemento lo lleve al lienzo).
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const modeRef = useRef(mode); modeRef.current = mode;
  const box = useModal(open, onClose, { onEscape: () => (pendingRef.current ? setPending(null) : modeRef.current !== 'all' ? (setMode('all'), setQ('')) : onClose()) });
  useEffect(() => { if (open) { setQ(''); setIdx(0); setPending(null); setMode('all'); } }, [open]);
  /** Lo elegido hace poco en este navegador (se lee al abrir). */
  const recent = useMemo(() => (open ? cmdkRecent() : []), [open]);
  const hits = useMemo<SearchHit[]>(() => {
    if (!open) return [];
    if (mode === 'views') return searchWorkspace(store, registry, q, { viewId, recent, only: 'views' });
    if (mode === 'new-view') {
      const opts = actions.filter(a => a.id.startsWith('new-view:'));
      return opts.map(a => ({ kind: 'action' as const, id: a.id, label: a.label, hint: a.hint ?? '', keywords: a.keywords, score: q.trim() ? Math.max(scoreText(q, a.label), scoreText(q, a.keywords ?? '')) : 1 }))
        .filter(h => h.score > 0).sort((a, b) => b.score - a.score);
    }
    return searchWorkspace(store, registry, q, { viewId, actions, recent });
  }, [open, store, registry, q, viewId, actions, mode, recent]);
  useEffect(() => { setIdx(0); setShown(CMDK_PAGE); }, [q, mode]);
  useEffect(() => { list.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [idx]);

  if (!open) return null;

  const jumpToElement = (hit: Extract<SearchHit, { kind: 'element' }>, targetViewId?: string) => {
    const vid = targetViewId ?? (hit.viewIds.includes(viewId ?? '') ? viewId : undefined);
    if (!vid) {
      if (hit.viewIds.length === 1) return jumpToElement(hit, hit.viewIds[0]);
      if (hit.viewIds.length === 0) { onClose(); return; }
      setPending(hit); return;
    }
    if (vid !== viewId) openView(vid);
    const nodeIds = store.list('nodes').filter(n => n.viewId === vid && n.elementId === hit.id).map(n => n.id);
    // Tras cambiar de vista el lienzo se monta en el siguiente ciclo; el encuadre espera a que exista.
    setTimeout(() => { select({ nodes: nodeIds, edges: [] }); canvas.current?.fitView(nodeIds); canvas.current?.focus(); }, vid !== viewId ? 60 : 0);
    onClose();
  };
  const choose = (hit: SearchHit) => {
    if (hit.kind === 'action' && (hit.id === GO_VIEW_ACTION || hit.id === NEW_VIEW_ACTION)) {
      setMode(hit.id === GO_VIEW_ACTION ? 'views' : 'new-view'); setQ(''); input.current?.focus(); return;
    }
    noteCmdkChoice(`${hit.kind}:${hit.id}`);
    if (hit.kind === 'action') { onClose(); onAction(hit.id); }
    else if (hit.kind === 'view') { openView(hit.id); onClose(); }
    else jumpToElement(hit);
  };
  const isRecent = (h: SearchHit) => !q.trim() && mode === 'all' && recent.includes(`${h.kind}:${h.id}`);
  const items: { key: string; label: string; hint: string; icon: IconName | null; onPick: () => void; recent?: boolean }[] = pending
    ? [
      ...pending.viewIds.map(vid => ({ key: vid, label: store.get('views', vid)?.name ?? vid, hint: registry.pack(store.get('views', vid)?.notationId ?? '')?.name ?? '', icon: 'view' as IconName, onPick: () => jumpToElement(pending, vid) })),
      { key: '__back', label: t('Volver a los resultados'), hint: '', icon: 'arrowLeft' as IconName, onPick: () => setPending(null) },
    ]
    : hits.map(h => ({ key: `${h.kind}:${h.id}`, label: h.label, hint: h.hint, icon: (isRecent(h) ? 'history' : h.kind === 'action' ? 'chevronRight' : h.kind === 'view' ? 'view' : 'diamond') as IconName, onPick: () => choose(h), recent: isRecent(h) }));
  const placeholder = pending ? t('«{name}» aparece en… (elige una vista)', { name: pending.label })
    : mode === 'views' ? t('Ir a la vista… (escribe su nombre; Esc vuelve)')
    : mode === 'new-view' ? t('Nueva vista: elige la notación (Esc vuelve)')
    : t('Buscar elementos, vistas o acciones…');

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.onPick(); }
  };

  return (
    <div className="ad-cmdk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="ad-cmdk" role="dialog" aria-modal="true" aria-label={t('Buscar')} onKeyDown={onKey}>
        <input ref={input} data-autofocus className="ad-cmdk__input" aria-label={t('Buscar elementos, vistas o acciones')} placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)} readOnly={!!pending} aria-disabled={!!pending || undefined} />
        <div ref={list} className="ad-cmdk__list">
          {items.length === 0 && <div className="ad-empty">{t('Sin resultados para «{q}».', { q })}</div>}
          {items.slice(0, shown).map((it, i) => (<Fragment key={it.key}>
            {it.recent && i === 0 && <div className="ad-cmdk__section">{t('Recientes')}</div>}
            {!it.recent && i > 0 && items[i - 1]!.recent && <div className="ad-cmdk__section">{t('Todo')}</div>}
            <button className={`ad-cmdk__item ${i === idx ? 'is-active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={it.onPick}>
              <span className="ad-cmdk__icon">{it.icon && <Icon name={it.icon} size={14} />}</span>
              <span className="ad-cmdk__label">{it.label}</span>
              <small>{it.hint}</small>
            </button>
          </Fragment>))}
          {items.length > shown && <button className="ad-cmdk__item ad-cmdk__more" onClick={() => setShown(n => n + CMDK_PAGE)}>{t('Mostrar más ({n} de {total})', { n: shown, total: items.length })}</button>}
        </div>
        <div className="ad-cmdk__foot">{t('↑↓ moverse · Enter elegir · Esc cerrar')}</div>
      </div>
    </div>
  );
}
