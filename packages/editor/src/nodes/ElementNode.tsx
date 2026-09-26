import { memo, useMemo, type MouseEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ElementType, Port, RuleStyle, ViewNode } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord, usePorts, useCollection } from '../hooks';
import { resolveStyle } from '@all-draw/core';
import { textInset, figureOf, showsIcon } from '@all-draw/notation-archimate';
import { shapeStyle, ShapeSvg } from './shapes';
import { ArchimateFigure } from './ArchimateFigure';
import { InlineEdit } from './InlineEdit';
import { useT } from '@all-draw/i18n';

export type ElementNodeData = { node: ViewNode; dimmed?: boolean; /** Color de otro participante que lo tiene seleccionado. */ remoteColor?: string };
export type ElementRFNode = Node<ElementNodeData, 'element'>;

/** Nodo genérico: pinta cualquier elemento según su tipo (forma, color, icono), las reglas de estilo y sus puertos. */
export const ElementNode = memo(function ElementNode({ data, selected }: NodeProps<ElementRFNode>) {
  const { registry, store, viewId, readOnly, run, renaming, setRenaming, effectiveTheme } = useEditor();
  const t = useT();
  const vn = data.node;
  const element = useRecord('elements', vn.elementId);
  const type = element ? registry.elementType(element.typeId) : undefined;
  const ports = usePorts(element);
  // Las reglas dependen también de `rules` y `people` (fuentes persona/papel): sus listas cambian de identidad al cambiar.
  const rules = useCollection('rules');
  const people = useCollection('people');
  const rule = useMemo(() => (element ? resolveStyle(store, registry, element, viewId ?? undefined).style : {}), [store, registry, element, viewId, rules, people]);

  if (!element) return <div className="ad-node ad-node--missing">?</div>;
  const visible = visiblePorts(ports, vn);
  const shape = type?.shape ?? 'rounded';
  const css = shapeStyle(shape, type, vn, rule as RuleStyle, effectiveTheme === 'dark');
  const label = vn.text ?? (element.name || (type?.name ?? ''));
  const archimate = registry.notationOf(element.typeId) === 'archimate';
  // Figuras de Archi: el fondo lo pinta `ArchimateFigure` (path + icono) y el texto se centra en la zona útil.
  const archiFill = css.background as string, archiStroke = css.borderColor as string;
  if (archimate) {
    const def = figureOf(element.typeId, vn.style.figure === 1 ? 1 : 0);
    const inset = textInset(def, vn.w, vn.h);
    css.background = 'transparent'; css.borderColor = 'transparent'; css.boxShadow = undefined;
    css.padding = `${4 + inset.top}px ${10 + inset.right + (showsIcon(element.typeId, vn.style.figure) ? 12 : 0)}px ${4 + inset.bottom}px ${10 + inset.left}px`;
  }
  const icon = archimate || ['circle', 'double-circle', 'diamond', 'bar', 'actor'].includes(shape) ? undefined : ((rule.icon ?? type?.icon) || undefined);
  const editing = renaming === vn.id;
  if (data.remoteColor && !selected) { css.outline = `2px solid ${data.remoteColor}`; css.outlineOffset = 2; }

  const onLabelDoubleClick = (e: MouseEvent) => {
    // Con vista de detalle, el doble clic sigue entrando (F2 para renombrar); si no, renombra en línea.
    if (readOnly || vn.detailViewId) return;
    e.stopPropagation();
    setRenaming(vn.id);
  };
  const rename = (name: string) => {
    if (name !== element.name) run({ type: 'patch', collection: 'elements', id: element.id, patch: { name } });
    setRenaming(null);
  };

  return (
    <div className={`ad-node ad-shape-${shape} ${archimate ? 'ad-node--archimate' : ''} ${type?.container ? 'is-container' : ''} ${selected ? 'is-selected' : ''} ${data.dimmed ? 'is-dimmed' : ''} ${rule.bold ? 'r-bold' : ''} ${rule.strike ? 'r-strike' : ''}`} style={css} title={element.doc || undefined}>
      {!readOnly && <NodeResizer minWidth={24} minHeight={16} isVisible={selected && !editing} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      {archimate
        ? <ArchimateFigure typeId={element.typeId} figure={vn.style.figure} w={vn.w} h={vn.h} fill={archiFill} stroke={archiStroke} strokeWidth={rule.borderWidth ?? 1} borderStyle={rule.borderStyle} />
        : <ShapeSvg shape={shape} fill={css.background as string} stroke={css.borderColor as string} figure={vn.style.figure} />}
      <Handle type="target" position={Position.Top} id="" className="ad-handle ad-handle--body" />
      <Handle type="source" position={Position.Bottom} id="" className="ad-handle ad-handle--body" />
      <div className="ad-node__body">
        {icon && <span className="ad-node__icon">{icon}</span>}
        {editing
          ? <InlineEdit value={element.name} onCommit={rename} onCancel={() => setRenaming(null)} />
          : <span className="ad-node__label" onDoubleClick={onLabelDoubleClick}>{label}</span>}
        {rule.badge && <span className="ad-node__badge" style={{ background: rule.badge }}>{rule.badgeText}</span>}
        {type && <span className="ad-node__type">{type.name}</span>}
      </div>
      {visible.length > 0 && (
        <div className="ad-ports">
          {visible.map((p, i) => (
            <div key={p.id} className={`ad-port ad-port--${p.direction}`} style={{ top: `${((i + 1) / (visible.length + 1)) * 100}%` }}>
              {p.direction !== 'out' && <Handle type="target" position={Position.Left} id={p.id} className="ad-handle ad-handle--port" />}
              <span className="ad-port__label" title={`${p.key}${p.dataType ? ` · ${p.dataType}` : ''}`}>{p.label ?? p.key}</span>
              {p.direction !== 'in' && <Handle type="source" position={Position.Right} id={p.id} className="ad-handle ad-handle--port" />}
            </div>
          ))}
        </div>
      )}
      {vn.detailViewId && <span className="ad-node__drill" title={t('Tiene vista de detalle')}>⤵</span>}
    </div>
  );
});

/** Puertos visibles: los elegidos en la vista, o los usados por alguna arista, o ninguno. */
function visiblePorts(ports: Port[], vn: ViewNode): Port[] {
  if (vn.style.showPorts === false) return [];
  if (vn.style.visiblePorts?.length) { const set = new Set(vn.style.visiblePorts); return ports.filter(p => set.has(p.key) || set.has(p.id)); }
  if (vn.style.showPorts) return ports;
  return [];
}

export type { ElementType };
