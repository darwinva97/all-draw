/**
 * Nodos React Flow de las vistas de secuencia: línea de vida (cabecera + línea discontinua),
 * activación (barra fina sobre la línea) y fragmento combinado (contenedor con operador).
 */
import { memo, type MouseEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNode } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord } from '../hooks';
import { InlineEdit } from '../nodes/InlineEdit';
import { SEQ_HEADER_H } from './sequence';

export type LifelineData = { node: ViewNode; /** Alto total del diagrama (la línea baja hasta ahí). */ height: number; remoteColor?: string };
export type LifelineRFNode = Node<LifelineData, 'lifeline'>;
export type ActivationData = { node: ViewNode; remoteColor?: string };
export type ActivationRFNode = Node<ActivationData, 'activation'>;
export type FragmentData = { node: ViewNode; remoteColor?: string };
export type FragmentRFNode = Node<FragmentData, 'fragment'>;

/** Manejador de arrastre de la línea de vida: solo la cabecera (la línea sirve para conectar). */
export const LIFELINE_DRAG_HANDLE = '.ad-seq-lifeline__head';

export const LifelineNode = memo(function LifelineNode({ data, selected }: NodeProps<LifelineRFNode>) {
  const { run, readOnly, renaming, setRenaming } = useEditor();
  const vn = data.node;
  const element = useRecord('elements', vn.elementId);
  const kind = String(element?.fields['kind'] ?? 'participant');
  const type = typeof element?.fields['type'] === 'string' ? element.fields['type'] : '';
  const name = element ? (vn.text ?? element.name) : '?';
  const label = type ? `${name}: ${type}` : name;
  const editing = renaming === vn.id;
  const iconic = kind !== 'participant';
  const style: React.CSSProperties = { width: vn.w, height: data.height };
  const headStyle: React.CSSProperties = { height: SEQ_HEADER_H, background: vn.style.fill, borderColor: vn.style.stroke, color: vn.style.text };
  if (data.remoteColor && !selected) { headStyle.outline = `2px solid ${data.remoteColor}`; headStyle.outlineOffset = 2; }
  const onDouble = (e: MouseEvent) => { if (readOnly || !element) return; e.stopPropagation(); setRenaming(vn.id); };
  const rename = (n: string) => { if (element && n !== element.name) run({ type: 'patch', collection: 'elements', id: element.id, patch: { name: n } }); setRenaming(null); };
  return (
    <div className={`ad-seq-lifeline ad-seq-lifeline--${kind} ${selected ? 'is-selected' : ''}`} style={style} title={element?.doc || undefined}>
      <div className={`ad-seq-lifeline__head ${iconic ? 'is-iconic' : ''}`} style={headStyle}>
        {iconic && <LifelineIcon kind={kind} />}
        {editing
          ? <InlineEdit value={element?.name ?? ''} onCommit={rename} onCancel={() => setRenaming(null)} />
          : <span className="ad-seq-lifeline__name" onDoubleClick={onDouble}>{label}</span>}
      </div>
      <div className="ad-seq-lifeline__line" />
      {/* Un solo manejador que cubre toda la línea: sirve para empezar y terminar mensajes (modo `loose`). */}
      <Handle type="source" position={Position.Bottom} id="" className="ad-seq-handle" />
    </div>
  );
});

/** Figura de cabecera según `kind` (actor, boundary, control, entity, database). */
function LifelineIcon({ kind }: { kind: string }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;
  switch (kind) {
    case 'actor':
      return <svg className="ad-seq-lifeline__icon" viewBox="0 0 24 32" aria-hidden><circle cx="12" cy="5" r="4" {...c} /><path d="M12 9v11M3 13h18M12 20l-6 10M12 20l6 10" {...c} strokeLinecap="round" /></svg>;
    case 'boundary':
      return <svg className="ad-seq-lifeline__icon" viewBox="0 0 34 28" aria-hidden><path d="M3 4v20M3 14h8" {...c} /><circle cx="21" cy="14" r="10" {...c} /></svg>;
    case 'control':
      return <svg className="ad-seq-lifeline__icon" viewBox="0 0 28 30" aria-hidden><circle cx="14" cy="17" r="10" {...c} /><path d="M14 7l4-4M14 7l4 4" {...c} strokeLinecap="round" /></svg>;
    case 'entity':
      return <svg className="ad-seq-lifeline__icon" viewBox="0 0 28 30" aria-hidden><circle cx="14" cy="13" r="10" {...c} /><path d="M3 27h22" {...c} /></svg>;
    case 'database':
      return <svg className="ad-seq-lifeline__icon" viewBox="0 0 28 30" aria-hidden><ellipse cx="14" cy="6" rx="10" ry="4" {...c} /><path d="M4 6v18c0 2.2 4.5 4 10 4s10-1.8 10-4V6" {...c} /><path d="M4 14c0 2.2 4.5 4 10 4s10-1.8 10-4" {...c} /></svg>;
    default:
      return null;
  }
}

export const ActivationNode = memo(function ActivationNode({ data, selected }: NodeProps<ActivationRFNode>) {
  const { readOnly } = useEditor();
  const vn = data.node;
  const element = useRecord('elements', vn.elementId);
  const label = typeof element?.fields['label'] === 'string' ? element.fields['label'] : '';
  const style: React.CSSProperties = { background: vn.style.fill, borderColor: vn.style.stroke };
  if (data.remoteColor && !selected) { style.outline = `2px solid ${data.remoteColor}`; style.outlineOffset = 2; }
  return (
    <div className={`ad-seq-activation ${selected ? 'is-selected' : ''}`} style={style} title={label || element?.name || undefined}>
      {!readOnly && <NodeResizer minWidth={12} minHeight={16} isVisible={selected} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      <Handle type="source" position={Position.Right} id="" className="ad-seq-handle" />
    </div>
  );
});

export const FragmentNode = memo(function FragmentNode({ data, selected }: NodeProps<FragmentRFNode>) {
  const { readOnly } = useEditor();
  const vn = data.node;
  const element = useRecord('elements', vn.elementId);
  const kind = String(element?.fields['kind'] ?? 'alt');
  const condition = typeof element?.fields['condition'] === 'string' ? element.fields['condition'] : '';
  const style: React.CSSProperties = { width: vn.w, height: vn.h, background: vn.style.fill, borderColor: vn.style.stroke, color: vn.style.text };
  if (data.remoteColor && !selected) { style.outline = `2px solid ${data.remoteColor}`; style.outlineOffset = 2; }
  return (
    <div className={`ad-seq-fragment ${selected ? 'is-selected' : ''}`} style={style} title={element?.doc || undefined}>
      {!readOnly && <NodeResizer minWidth={60} minHeight={40} isVisible={selected} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      <span className="ad-seq-fragment__kind">{kind}</span>
      {condition && <span className="ad-seq-fragment__cond">{condition}</span>}
      {element?.name && element.name !== kind && <span className="ad-seq-fragment__name">{element.name}</span>}
    </div>
  );
});
