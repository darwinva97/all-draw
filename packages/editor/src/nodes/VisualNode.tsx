import { memo } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNode } from '@all-draw/core';
import { useEditor } from '../context';

export type VisualNodeData = { node: ViewNode };
export type VisualRFNode = Node<VisualNodeData, 'visual'>;

/** Nodo sin elemento: nota, grupo, etiqueta, celda de rejilla. */
export const VisualNode = memo(function VisualNode({ data, selected }: NodeProps<VisualRFNode>) {
  const { run, readOnly } = useEditor();
  const vn = data.node;
  const kind = vn.visualType ?? 'core:note';
  const isGroup = kind === 'core:group' || kind === 'core:cell';
  return (
    <div className={`ad-visual ad-visual--${kind.replace(':', '-')} ${selected ? 'is-selected' : ''}`} style={{ width: vn.w, height: vn.h, background: vn.style.fill, borderColor: vn.style.stroke, color: vn.style.text }}>
      {!readOnly && kind !== 'core:cell' && <NodeResizer minWidth={40} minHeight={24} isVisible={selected} onResizeEnd={(_, p) => run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { x: p.x, y: p.y, w: p.width, h: p.height } })} />}
      <div className={isGroup ? 'ad-visual__title' : 'ad-visual__text'}>{vn.text ?? ''}</div>
    </div>
  );
});
