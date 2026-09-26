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
  const { readOnly, effectiveTheme, setTheme, registry, run, openView, canvas, selection, setRenaming } = ed;
  const [wsOpen, setWsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  useEffect(() => { if (theme) setTheme(theme); }, [theme, setTheme]);

  // Atajos globales: Ctrl+K / Ctrl+F abren la búsqueda; ? los atajos.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (key === 'k' || key === 'f') && !e.shiftKey && !e.altKey) { e.preventDefault(); setSearchOpen(o => !o); setKeysOpen(false); return; }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
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
      for (const p of packs) out.push({ id: `new-view:${p.id}`, label: `Crear vista ${p.name}`, hint: 'Acción', keywords: 'nueva vista crear' });
      out.push({ id: 'workspace', label: 'Abrir Espacio (librerías, reglas, personas)', hint: 'Acción', keywords: 'librerias reglas personas espacio' });
      if (onRequestLayout) out.push({ id: 'layout', label: 'Layout automático de la vista', hint: 'Acción', keywords: 'ordenar colocar layout automatico' });
    }
    out.push({ id: 'fit', label: 'Ajustar a la vista', hint: 'Ctrl+Shift+F', keywords: 'encuadrar zoom' });
    out.push({ id: 'theme', label: 'Cambiar tema (claro / oscuro)', hint: 'Acción', keywords: 'tema oscuro claro' });
    out.push({ id: 'shortcuts', label: 'Atajos de teclado', hint: '?', keywords: 'ayuda teclas' });
    return out;
  }, [registry, readOnly, onRequestLayout]);

  const onAction = useCallback((id: string) => {
    if (id.startsWith('new-view:')) {
      const notationId = id.slice('new-view:'.length);
      const pack = registry.pack(notationId);
      const v = makeView(`Nueva vista ${pack?.name ?? ''}`.trim(), { notationId, kind: pack?.viewKind ?? 'freeform' });
      if (v.kind === 'grid') v.grid = { layers: [{ id: newId('ly'), name: 'Negocio', color: '#fde68a' }, { id: newId('ly'), name: 'Aplicación', color: '#bfdbfe' }, { id: newId('ly'), name: 'Tecnología', color: '#bbf7d0' }], stages: ['Inicio', 'Proceso', 'Fin'].map(n => ({ id: newId('st'), name: n })), stageGroups: [] };
      run({ type: 'set', collection: 'views', id: v.id, value: v });
      openView(v.id);
    }
    else if (id === 'workspace') setWsOpen(true);
    else if (id === 'layout') onRequestLayout?.();
    else if (id === 'fit') canvas.current?.fitView();
    else if (id === 'theme') setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    else if (id === 'shortcuts') setKeysOpen(true);
  }, [registry, run, openView, onRequestLayout, canvas, setTheme, effectiveTheme]);

  const left = readOnly ? toolbarLeft : <>
    <button className="ad-btn" onClick={() => setWsOpen(true)} title="Librerías, reglas de estilo y personas">Espacio</button>
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
      {!readOnly && <WorkspacePanel open={wsOpen} onClose={() => setWsOpen(false)} />}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} actions={actions} onAction={onAction} />
      <ShortcutsPanel open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}
