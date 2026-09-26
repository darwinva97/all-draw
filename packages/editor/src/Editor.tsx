import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { makeView, newId } from '@all-draw/core';
import { Canvas } from './Canvas';
import { Palette } from './panels/Palette';
import { Inspector } from './panels/Inspector';
import { ViewsPanel } from './panels/ViewsPanel';
import { Problems } from './panels/Problems';
import { Toolbar } from './panels/Toolbar';
import { WorkspacePanel } from './panels/WorkspacePanel';
import { CommandPalette } from './panels/CommandPalette';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { useEditor, type Theme } from './context';
import type { SearchAction } from './search';
import { useT, useLang } from '@all-draw/i18n';
import './editor.css';

export interface EditorProps {
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  /** Tema forzado por la app; si no se da, manda el toggle de la barra (persistido en `localStorage('alldraw:theme')`). */
  theme?: Theme;
  /** Layout automático de la vista actual: la app lo conecta (p. ej. a `@all-draw/layout`). Sin él, la opción no aparece. */
  onRequestLayout?: () => void;
}

/** Disposición completa del editor. La app envuelve esto en `EditorProvider`. */
export function Editor({ toolbarLeft, toolbarRight, theme, onRequestLayout }: EditorProps) {
  const ed = useEditor();
  const t = useT();
  const [lang] = useLang(); // las acciones memorizadas se rehacen al cambiar de idioma
  const { readOnly, effectiveTheme, setTheme, registry, run, openView, canvas, selection, setRenaming, workspaceTab, openWorkspacePanel, closeWorkspacePanel } = ed;
  const [searchOpen, setSearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  useEffect(() => { if (theme) setTheme(theme); }, [theme, setTheme]);

  // Atajos globales: Ctrl+K / Ctrl+F abren la búsqueda; ? los atajos.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (key === 'k' || key === 'f') && !e.shiftKey && !e.altKey) { e.preventDefault(); setSearchOpen(o => !o); setKeysOpen(false); return; }
      const tg = e.target as HTMLElement | null;
      const typing = !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
      if (e.key === '?' && !typing && !mod) { e.preventDefault(); setKeysOpen(o => !o); setSearchOpen(false); }
      // F2 renombra el único nodo seleccionado aunque el foco no esté en el lienzo (p. ej. tras la paleta de comandos)
      if (e.key === 'F2' && !typing && !readOnly && selection.nodes.length === 1) { e.preventDefault(); setRenaming(selection.nodes[0]!); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [readOnly, selection.nodes, setRenaming]);

  const actions = useMemo<SearchAction[]>(() => {
    const packs = registry.allPacks().filter(p => p.id !== 'core');
    const out: SearchAction[] = [];
    if (!readOnly) {
      for (const p of packs) out.push({ id: `new-view:${p.id}`, label: t('Crear vista {name}', { name: p.name }), hint: t('Acción'), keywords: t('nueva vista crear') });
      out.push({ id: 'workspace', label: t('Abrir Espacio (librerías, reglas, personas)'), hint: t('Acción'), keywords: t('librerias reglas personas espacio') });
      if (onRequestLayout) out.push({ id: 'layout', label: t('Layout automático de la vista'), hint: t('Acción'), keywords: t('ordenar colocar layout automatico') });
    }
    out.push({ id: 'fit', label: t('Ajustar a la vista'), hint: 'Ctrl+Shift+F', keywords: t('encuadrar zoom') });
    out.push({ id: 'theme', label: t('Cambiar tema (claro / oscuro)'), hint: t('Acción'), keywords: t('tema oscuro claro') });
    out.push({ id: 'shortcuts', label: t('Atajos de teclado'), hint: '?', keywords: t('ayuda teclas') });
    return out;
  }, [registry, readOnly, onRequestLayout, t, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((id: string) => {
    if (id.startsWith('new-view:')) {
      const notationId = id.slice('new-view:'.length);
      const pack = registry.pack(notationId);
      const v = makeView(t('Nueva vista {name}', { name: pack?.name ?? '' }).trim(), { notationId, kind: pack?.viewKind ?? 'freeform' });
      if (v.kind === 'grid') v.grid = { layers: [{ id: newId('ly'), name: t('Negocio'), color: '#fde68a' }, { id: newId('ly'), name: t('Aplicación'), color: '#bfdbfe' }, { id: newId('ly'), name: t('Tecnología'), color: '#bbf7d0' }], stages: [t('Inicio'), t('Proceso'), t('Fin')].map(n => ({ id: newId('st'), name: n })), stageGroups: [] };
      run({ type: 'set', collection: 'views', id: v.id, value: v });
      openView(v.id);
    }
    else if (id === 'workspace') openWorkspacePanel();
    else if (id === 'layout') onRequestLayout?.();
    else if (id === 'fit') canvas.current?.fitView();
    else if (id === 'theme') setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    else if (id === 'shortcuts') setKeysOpen(true);
  }, [registry, run, openView, onRequestLayout, canvas, setTheme, effectiveTheme, openWorkspacePanel, t]);

  const left = readOnly ? toolbarLeft : <>
    <button className="ad-btn" onClick={() => openWorkspacePanel()} title={t('Librerías, reglas de estilo, personas y trazabilidad')}>{t('Espacio')}</button>
    {toolbarLeft}
  </>;
  return (
    <div className={`ad-editor theme-${effectiveTheme} ${readOnly ? 'is-readonly' : ''}`}>
      <Toolbar left={left} right={toolbarRight} onSearch={() => setSearchOpen(true)} onShortcuts={() => setKeysOpen(true)} />
      <div className="ad-editor__body">
        <div className="ad-editor__left"><ViewsPanel />{!readOnly && <Palette />}</div>
        <main className="ad-editor__main"><Canvas onRequestLayout={onRequestLayout} /><Problems /></main>
        <Inspector />
      </div>
      {!readOnly && <WorkspacePanel open={workspaceTab !== null} onClose={closeWorkspacePanel} initialTab={workspaceTab ?? 'libraries'} />}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} actions={actions} onAction={onAction} />
      <ShortcutsPanel open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}
