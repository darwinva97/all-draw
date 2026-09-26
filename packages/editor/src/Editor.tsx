import { useState, type ReactNode } from 'react';
import { Canvas } from './Canvas';
import { Palette } from './panels/Palette';
import { Inspector } from './panels/Inspector';
import { ViewsPanel } from './panels/ViewsPanel';
import { Problems } from './panels/Problems';
import { Toolbar } from './panels/Toolbar';
import { WorkspacePanel } from './panels/WorkspacePanel';
import { useEditor } from './context';
import './editor.css';

/** Disposición completa del editor. La app envuelve esto en `EditorProvider`. */
export function Editor({ toolbarLeft, toolbarRight }: { toolbarLeft?: ReactNode; toolbarRight?: ReactNode }) {
  const { readOnly } = useEditor();
  const [wsOpen, setWsOpen] = useState(false);
  const left = readOnly ? toolbarLeft : <>
    <button className="ad-btn" onClick={() => setWsOpen(true)} title="Librerías, reglas de estilo y personas">Espacio</button>
    {toolbarLeft}
  </>;
  return (
    <div className={`ad-editor ${readOnly ? 'is-readonly' : ''}`}>
      <Toolbar left={left} right={toolbarRight} />
      <div className="ad-editor__body">
        <div className="ad-editor__left"><ViewsPanel />{!readOnly && <Palette />}</div>
        <main className="ad-editor__main"><Canvas /><Problems /></main>
        <Inspector />
      </div>
      {!readOnly && <WorkspacePanel open={wsOpen} onClose={() => setWsOpen(false)} />}
    </div>
  );
}
