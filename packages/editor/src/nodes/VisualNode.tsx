import { memo, type MouseEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ViewNode } from '@all-draw/core';
import { fitText, notePath, NOTE_FONT, NOTE_LINE, NOTE_PAD } from '@all-draw/notation-archimate';
import { useNodeEnv } from './env';
import { InlineEdit } from './InlineEdit';
import { canvasMeasure, withBreaks } from './label';
import { darken, readable } from './shapes';
import { useT } from '@all-draw/i18n';

export type VisualNodeData = { node: ViewNode; remoteColor?: string; /** Se está editando el texto en línea. */ editing?: boolean };
export type VisualRFNode = Node<VisualNodeData, 'visual'>;

/** Colores por defecto de la nota (como `.ad-visual` del tema): relleno y borde. */
const NOTE_COLORS = { light: { fill: '#fff8c5', stroke: '#d4d4d8' }, dark: { fill: '#3b3416', stroke: '#5c5222' } } as const;
const measureNote = canvasMeasure(400);

/** Nodo sin elemento: nota, grupo, etiqueta, imagen, celda de rejilla. */
export const VisualNode = memo(function VisualNode({ data, selected }: NodeProps<VisualRFNode>) {
  const { run, readOnly, setRenaming, dark } = useNodeEnv();
  const t = useT();
  const vn = data.node;
  const kind = vn.visualType ?? 'core:note';
  const isGroup = kind === 'core:group' || kind === 'core:cell' || kind === 'core:header';
  const isImage = kind === 'core:image';
  const isNote = kind === 'core:note';
  const fixed = kind === 'core:cell' || kind === 'core:header';
  const editing = !!data.editing && !fixed;
  const src = typeof vn.meta?.src === 'string' ? vn.meta.src : undefined;
  // Nota: la figura (esquina doblada) la pinta el SVG de fondo; la caja CSS queda transparente.
  const style: React.CSSProperties = { width: vn.w, height: vn.h, background: isNote ? undefined : vn.style.fill, borderColor: isNote ? undefined : vn.style.stroke, color: vn.style.text ?? (isNote && vn.style.fill ? readable(vn.style.fill) : undefined) };
  if (data.remoteColor && !selected) { style.outline = `2px solid ${data.remoteColor}`; style.outlineOffset = 2; }
  const onTextDoubleClick = (e: MouseEvent) => { if (readOnly || fixed) return; e.stopPropagation(); setRenaming(vn.id); };
  const commit = (text: string) => { if (text !== (vn.text ?? '')) run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { text } }); setRenaming(null); };
  const text = vn.text ?? '';
  // Texto de la nota: arriba a la izquierda a 11 px; lo que no cabe se recorta con «…» (completo en el `title`).
  const noteFit = isNote && text ? fitText(text, { width: vn.w - 2 * NOTE_PAD.x - 0.5, height: vn.h - 2 * NOTE_PAD.y, fontSize: NOTE_FONT, minFontSize: NOTE_FONT, lineHeight: NOTE_LINE / NOTE_FONT, measure: measureNote }) : undefined;
  return (
    <div className={`ad-visual ad-visual--${kind.replace(':', '-')} ${selected ? 'is-selected' : ''}`} style={style}>
      {!readOnly && !fixed && selected && !editing && <NodeResizer minWidth={40} minHeight={24} keepAspectRatio={isImage} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      {/* Sin estos manejadores React Flow no pinta los conectores que ya llegan a una nota o un grupo (importados de
          Archi, por ejemplo). Son invisibles y no sirven para empezar conexiones nuevas. */}
      <Handle type="target" position={Position.Top} id="" isConnectable={false} className="ad-handle ad-handle--body ad-handle--inert" />
      <Handle type="source" position={Position.Bottom} id="" isConnectable={false} className="ad-handle ad-handle--body ad-handle--inert" />
      {isNote && <NoteShape w={vn.w} h={vn.h} fill={vn.style.fill} stroke={vn.style.stroke} dark={dark} />}
      {isImage && (src ? <img className="ad-visual__img" src={src} alt={vn.text ?? ''} draggable={false} /> : <div className="ad-visual__noimg">{t('Sin imagen')}</div>)}
      {editing
        ? <InlineEdit value={vn.text ?? ''} onCommit={commit} onCancel={() => setRenaming(null)} multiline={isNote} />
        : noteFit
          ? <div className="ad-visual__text" onDoubleClick={onTextDoubleClick} title={noteFit.truncated ? text : undefined} style={{ WebkitLineClamp: Math.max(1, noteFit.lines.length) }}>
            {noteFit.truncated ? noteFit.lines.map((l, i) => <span key={i} className="ad-node__line">{l || ' '}</span>) : withBreaks(text)}
          </div>
          : (!isImage || vn.text) && <div className={isGroup ? 'ad-visual__title' : isImage ? 'ad-visual__caption' : 'ad-visual__text'} onDoubleClick={onTextDoubleClick}>{text}</div>}
    </div>
  );
});

/** Figura de la nota de Archi: rectángulo con la esquina inferior derecha doblada. La misma geometría está en `svg.ts`. */
function NoteShape({ w, h, fill, stroke, dark }: { w: number; h: number; fill?: string; stroke?: string; dark: boolean }) {
  const theme = dark ? NOTE_COLORS.dark : NOTE_COLORS.light;
  const f = fill ?? theme.fill;
  const s = stroke ?? (fill ? darken(fill, 0.4) : theme.stroke);
  const p = notePath(w, h);
  return (
    <svg className="ad-note__bg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={p.body} fill={f} stroke={s} strokeWidth={1} strokeLinejoin="round" />
      <path className="ad-note__fold" d={p.fold} fill={/^#[0-9a-f]{6}$/i.test(f) ? darken(f, 0.12) : f} stroke={s} strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}
