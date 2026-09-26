/**
 * Paleta de comandos (Ctrl+K / Ctrl+F): busca elementos, vistas y acciones. Elegir un elemento
 * lo selecciona y encuadra si está en la vista actual; si no, ofrece sus vistas para saltar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useAnyChange } from '../hooks';
import { searchWorkspace, type SearchAction, type SearchHit } from '../search';

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
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); setPending(null); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  const hits = useMemo(() => (open ? searchWorkspace(store, registry, q, { viewId, actions }) : []), [open, store, registry, q, viewId, actions]);
  useEffect(() => { setIdx(0); }, [q]);
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
    if (hit.kind === 'action') { onClose(); onAction(hit.id); }
    else if (hit.kind === 'view') { openView(hit.id); onClose(); }
    else jumpToElement(hit);
  };
  const items: { key: string; label: string; hint: string; icon: string; onPick: () => void }[] = pending
    ? [
      ...pending.viewIds.map(vid => ({ key: vid, label: store.get('views', vid)?.name ?? vid, hint: registry.pack(store.get('views', vid)?.notationId ?? '')?.name ?? '', icon: '◻', onPick: () => jumpToElement(pending, vid) })),
      { key: '__back', label: t('← Volver a los resultados'), hint: '', icon: '', onPick: () => setPending(null) },
    ]
    : hits.map(h => ({ key: `${h.kind}:${h.id}`, label: h.label, hint: h.hint, icon: h.kind === 'action' ? '▸' : h.kind === 'view' ? '◻' : '●', onPick: () => choose(h) }));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[idx]?.onPick(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (pending) setPending(null); else onClose(); }
  };

  return (
    <div className="ad-cmdk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ad-cmdk" role="dialog" aria-modal="true" aria-label={t('Buscar')} onKeyDown={onKey}>
        <input ref={input} className="ad-cmdk__input" aria-label={t('Buscar elementos, vistas o acciones')} placeholder={pending ? t('«{name}» aparece en… (elige una vista)', { name: pending.label }) : t('Buscar elementos, vistas o acciones…')} value={q} onChange={e => setQ(e.target.value)} disabled={!!pending} />
        <div ref={list} className="ad-cmdk__list">
          {items.length === 0 && <div className="ad-empty">{t('Sin resultados para «{q}».', { q })}</div>}
          {items.map((it, i) => (
            <button key={it.key} className={`ad-cmdk__item ${i === idx ? 'is-active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={it.onPick}>
              <span className="ad-cmdk__icon">{it.icon}</span>
              <span className="ad-cmdk__label">{it.label}</span>
              <small>{it.hint}</small>
            </button>
          ))}
        </div>
        <div className="ad-cmdk__foot">{t('↑↓ moverse · Enter elegir · Esc cerrar')}</div>
      </div>
    </div>
  );
}
