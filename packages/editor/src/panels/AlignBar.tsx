import type { ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Command } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord } from '../hooks';
import { alignBoxes, distributeBoxes, equalizeSize, type AlignKind, type Box } from '../align';

/**
 * Barra flotante del lienzo: alinear / distribuir / igualar con ≥2 nodos seleccionados, o
 * "Quitar bendpoints" con una arista seleccionada que los tenga. Trabaja con posiciones absolutas
 * de React Flow y convierte a relativas al padre al emitir comandos.
 */
export function AlignBar() {
  const { store, viewId, selection, run, readOnly } = useEditor();
  const rf = useReactFlow();
  const singleEdgeId = selection.nodes.length === 0 && selection.edges.length === 1 ? selection.edges[0] : undefined;
  const edge = useRecord('edges', singleEdgeId);
  const nodeIds = selection.nodes.filter(id => store.get('nodes', id)?.viewId === viewId);
  if (readOnly) return null;

  if (edge && edge.bendpoints.length > 0) {
    return (
      <div className="ad-align-bar" role="toolbar" aria-label="Arista">
        <button className="ad-align-btn ad-align-btn--text" title="Quitar todos los puntos de quiebre" onClick={() => run({ type: 'patch', collection: 'edges', id: edge.id, patch: { bendpoints: [] } })}>Quitar bendpoints</button>
      </div>
    );
  }
  if (nodeIds.length < 2) return null;

  const boxes = (): Box[] => nodeIds.flatMap(id => {
    const inn = rf.getInternalNode(id); const vn = store.get('nodes', id);
    if (!inn || !vn) return [];
    const a = inn.internals.positionAbsolute;
    return [{ id, x: a.x, y: a.y, w: inn.measured.width ?? vn.w, h: inn.measured.height ?? vn.h }];
  });
  const toRelative = (id: string, abs: { x: number; y: number }) => {
    const parentId = rf.getInternalNode(id)?.parentId;
    const pa = parentId ? rf.getInternalNode(parentId)?.internals.positionAbsolute : undefined;
    return { x: Math.round(abs.x - (pa?.x ?? 0)), y: Math.round(abs.y - (pa?.y ?? 0)) };
  };
  const move = (moves: { id: string; x: number; y: number }[]) => {
    if (moves.length) run({ type: 'moveNodes', moves: moves.map(m => ({ id: m.id, ...toRelative(m.id, m) })) });
  };
  const align = (kind: AlignKind) => move(alignBoxes(boxes(), kind));
  const distribute = (axis: 'x' | 'y') => move(distributeBoxes(boxes(), axis));
  const equalize = (dim: 'w' | 'h') => {
    const sizes = equalizeSize(boxes(), dim);
    if (!sizes.length) return;
    const cmds: Command[] = sizes.map(s => ({ type: 'patch', collection: 'nodes', id: s.id, patch: { w: s.w, h: s.h } }));
    run({ type: 'batch', label: dim === 'w' ? 'igualar ancho' : 'igualar alto', commands: cmds });
  };
  const canDistribute = nodeIds.length >= 3;

  return (
    <div className="ad-align-bar" role="toolbar" aria-label="Alinear">
      <span className="ad-align-group">
        <AlignButton title="Alinear a la izquierda" onClick={() => align('left')}><Icon d="M3 2v12M5 4h8v3H5zM5 9h5v3H5z" /></AlignButton>
        <AlignButton title="Centrar horizontalmente" onClick={() => align('centerX')}><Icon d="M8 2v12M4 4h8v3H4zM5.5 9h5v3h-5z" /></AlignButton>
        <AlignButton title="Alinear a la derecha" onClick={() => align('right')}><Icon d="M13 2v12M3 4h8v3H3zM6 9h5v3H6z" /></AlignButton>
      </span>
      <span className="ad-align-group">
        <AlignButton title="Alinear arriba" onClick={() => align('top')}><Icon d="M2 3h12M4 5h3v8H4zM9 5h3v5H9z" /></AlignButton>
        <AlignButton title="Centrar verticalmente" onClick={() => align('centerY')}><Icon d="M2 8h12M4 4h3v8H4zM9 5.5h3v5H9z" /></AlignButton>
        <AlignButton title="Alinear abajo" onClick={() => align('bottom')}><Icon d="M2 13h12M4 3h3v8H4zM9 6h3v5H9z" /></AlignButton>
      </span>
      <span className="ad-align-group">
        <AlignButton title="Distribuir horizontalmente" disabled={!canDistribute} onClick={() => distribute('x')}><Icon d="M2 2v12M14 2v12M5 5h2v6H5zM9 5h2v6H9z" /></AlignButton>
        <AlignButton title="Distribuir verticalmente" disabled={!canDistribute} onClick={() => distribute('y')}><Icon d="M2 2h12M2 14h12M5 5h6v2H5zM5 9h6v2H5z" /></AlignButton>
      </span>
      <span className="ad-align-group">
        <AlignButton title="Igualar ancho" onClick={() => equalize('w')}><Icon d="M2 8h12M4 6l-2 2 2 2M12 6l2 2-2 2M3 3h10M3 13h10" /></AlignButton>
        <AlignButton title="Igualar alto" onClick={() => equalize('h')}><Icon d="M8 2v12M6 4l2-2 2 2M6 12l2 2 2-2M3 3v10M13 3v10" /></AlignButton>
      </span>
    </div>
  );
}

function AlignButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return <button className="ad-align-btn" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</button>;
}

function Icon({ d }: { d: string }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
}
