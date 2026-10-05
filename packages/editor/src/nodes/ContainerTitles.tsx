import { memo, useMemo } from 'react';
import { ViewportPortal, useInternalNode, type Node } from '@xyflow/react';
import { nodeText, type ElementNodeData } from './ElementNode';
import { fittedLabel } from './label';
import { shapeStyle } from './shapes';
import { useNodeEnv } from './env';

/**
 * Títulos de contenedor tapados por algún hijo (`data.titleAbove`, calculado en `Canvas`): cada nodo de React Flow es
 * su propio contexto de apilamiento, así que el título dentro del padre no puede quedar encima de los hijos. Se pintan
 * aquí, en una capa sobre los nodos, en la misma posición, letra y líneas que el título del padre (que queda
 * transparente: sigue ahí para el doble clic y los lectores de pantalla). El SVG hace lo mismo con su capa `ad-titles`.
 */
export function ContainerTitles({ nodes }: { nodes: Node[] }) {
  const ids = useMemo(() => nodes.filter(n => (n.data as Partial<ElementNodeData>).titleAbove).map(n => n.id), [nodes]);
  if (!ids.length) return null;
  return <ViewportPortal><div className="ad-ctitles" aria-hidden>{ids.map(id => <ContainerTitle key={id} id={id} />)}</div></ViewportPortal>;
}

const ContainerTitle = memo(function ContainerTitle({ id }: { id: string }) {
  const n = useInternalNode(id);
  const { dark, lowDetail, showTypeNames } = useNodeEnv();
  const data = n?.data as ElementNodeData | undefined;
  if (!n || !data?.element || !data.titleAbove || data.editing) return null;
  const { label, icon, typeName, geo } = nodeText(data, { lowDetail, showTypeNames });
  if (!geo) return null;
  const { node: vn, type, rule } = data;
  const color = shapeStyle(type?.shape ?? 'rounded', type, vn, rule, dark).color;
  const fitted = fittedLabel(label, geo.fit);
  const p = n.internals.positionAbsolute, b = geo.border;
  return (
    <div className={`ad-ctitle ${geo.left ? 'is-left' : 'is-center'}${data.dimmed ? ' is-dimmed' : ''}${rule.strike ? ' r-strike' : ''}`}
      style={{ left: p.x + b + geo.pad.left, top: p.y + b + geo.pad.top, width: Math.max(0, vn.w - 2 * b - geo.pad.left - geo.pad.right), color }}>
      {icon && geo.fit.showIcon && <span className="ad-node__icon">{icon}</span>}
      <span className="ad-node__label ad-node__label--fit" style={{ ...fitted.style, fontWeight: rule.bold ? 700 : data.archimate ? 400 : 500 }}>{fitted.content}</span>
      {geo.fit.showType && typeName && <span className="ad-node__type">{typeName}</span>}
    </div>
  );
});
