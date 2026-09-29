import { memo, type MouseEvent } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNode } from '@all-draw/core';
import { useNodeEnv } from './env';
import { InlineEdit } from './InlineEdit';
import { useT } from '@all-draw/i18n';

export type VisualNodeData = { node: ViewNode; remoteColor?: string; /** Se está editando el texto en línea. */ editing?: boolean };
export type VisualRFNode = Node<VisualNodeData, 'visual'>;

/** Nodo sin elemento: nota, grupo, etiqueta, imagen, celda de rejilla. */
export const VisualNode = memo(function VisualNode({ data, selected }: NodeProps<VisualRFNode>) {
  const { run, readOnly, setRenaming } = useNodeEnv();
  const t = useT();
  const vn = data.node;
  const kind = vn.visualType ?? 'core:note';
  const isGroup = kind === 'core:group' || kind === 'core:cell' || kind === 'core:header';
  const isImage = kind === 'core:image';
  const fixed = kind === 'core:cell' || kind === 'core:header';
  const editing = !!data.editing && !fixed;
  const src = typeof vn.meta?.src === 'string' ? vn.meta.src : undefined;
  const style: React.CSSProperties = { width: vn.w, height: vn.h, background: vn.style.fill, borderColor: vn.style.stroke, color: vn.style.text };
  if (data.remoteColor && !selected) { style.outline = `2px solid ${data.remoteColor}`; style.outlineOffset = 2; }
  const onTextDoubleClick = (e: MouseEvent) => { if (readOnly || fixed) return; e.stopPropagation(); setRenaming(vn.id); };
  const commit = (text: string) => { if (text !== (vn.text ?? '')) run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { text } }); setRenaming(null); };
  return (
    <div className={`ad-visual ad-visual--${kind.replace(':', '-')} ${selected ? 'is-selected' : ''}`} style={style}>
      {!readOnly && !fixed && selected && !editing && <NodeResizer minWidth={40} minHeight={24} keepAspectRatio={isImage} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      {isImage && (src ? <img className="ad-visual__img" src={src} alt={vn.text ?? ''} draggable={false} /> : <div className="ad-visual__noimg">{t('Sin imagen')}</div>)}
      {editing
        ? <InlineEdit value={vn.text ?? ''} onCommit={commit} onCancel={() => setRenaming(null)} multiline={kind === 'core:note'} />
        : (!isImage || vn.text) && <div className={isGroup ? 'ad-visual__title' : isImage ? 'ad-visual__caption' : 'ad-visual__text'} onDoubleClick={onTextDoubleClick}>{vn.text ?? ''}</div>}
    </div>
  );
});
