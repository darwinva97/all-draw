import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ElementType, Port, RuleStyle, ViewNode } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord, usePorts } from '../hooks';
import { resolveStyle } from '@all-draw/core';
import { shapeStyle, ShapeSvg } from './shapes';

export type ElementNodeData = { node: ViewNode; dimmed?: boolean };
export type ElementRFNode = Node<ElementNodeData, 'element'>;

/** Nodo genérico: pinta cualquier elemento según su tipo (forma, color, icono), las reglas de estilo y sus puertos. */
export const ElementNode = memo(function ElementNode({ data, selected }: NodeProps<ElementRFNode>) {
  const { registry, store, viewId } = useEditor();
  const vn = data.node;
  const element = useRecord('elements', vn.elementId);
  const type = element ? registry.elementType(element.typeId) : undefined;
  const ports = usePorts(element);
  const rule = useMemo(() => (element ? resolveStyle(store, registry, element, viewId ?? undefined).style : {}), [store, registry, element, viewId]);

  if (!element) return <div className="ad-node ad-node--missing">?</div>;
  const visible = visiblePorts(ports, vn);
  const shape = type?.shape ?? 'rounded';
  const css = shapeStyle(shape, type, vn, rule as RuleStyle);
  const label = vn.text ?? (element.name || (type?.name ?? ''));
  const icon = ['circle', 'double-circle', 'diamond', 'bar', 'actor'].includes(shape) ? undefined : ((rule.icon ?? type?.icon) || undefined);

  return (
    <div className={`ad-node ad-shape-${shape} ${type?.container ? 'is-container' : ''} ${selected ? 'is-selected' : ''} ${data.dimmed ? 'is-dimmed' : ''} ${rule.bold ? 'r-bold' : ''} ${rule.strike ? 'r-strike' : ''}`} style={css} title={element.doc || undefined}>
      <ShapeSvg shape={shape} fill={css.background as string} stroke={css.borderColor as string} figure={vn.style.figure} />
      <Handle type="target" position={Position.Top} id="" className="ad-handle ad-handle--body" />
      <Handle type="source" position={Position.Bottom} id="" className="ad-handle ad-handle--body" />
      <div className="ad-node__body">
        {icon && <span className="ad-node__icon">{icon}</span>}
        <span className="ad-node__label">{label}</span>
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
      {vn.detailViewId && <span className="ad-node__drill" title="Tiene vista de detalle">⤵</span>}
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
