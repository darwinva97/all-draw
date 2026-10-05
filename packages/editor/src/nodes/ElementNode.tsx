import { memo, type CSSProperties, type MouseEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Element, ElementType, Port, RuleStyle, ViewNode } from '@all-draw/core';
import { textInset, figureOf, showsIcon } from '@all-draw/notation-archimate';
import { shapeStyle, shapeColors, ShapeSvg, figureFor, personGeometry, readable, isExtraFigure, figureInset, SVG_ONLY_FIGURES } from './shapes';
import { compartmentsOf, compartmentLayout, type CompartmentLayout } from './compartments';
import { ArchimateFigure, archimateBox } from './ArchimateFigure';
import { InlineEdit } from './InlineEdit';
import { useNodeEnv, useSimMark } from './env';
import { useT } from '@all-draw/i18n';
import { Icon } from '../icons';

/**
 * Datos de un nodo de elemento. `Canvas` los resuelve una vez por vista (elemento, tipo, estilo de las reglas,
 * puertos) y reutiliza el mismo objeto mientras no cambie nada, así que el nodo no se suscribe al store.
 */
export type ElementNodeData = {
  node: ViewNode;
  /** `undefined`: el elemento no existe (referencia rota). */
  element?: Element;
  type?: ElementType;
  /** Estilo resuelto de las reglas (`resolveStyle`). */
  rule: RuleStyle;
  /** Todos los puertos del elemento (`allPorts`); el nodo elige los visibles. */
  ports: Port[];
  /** El tipo es de ArchiMate: se pinta con las figuras de Archi. */
  archimate: boolean;
  dimmed?: boolean;
  /** Color de otro participante que lo tiene seleccionado. */
  remoteColor?: string;
  /** Se está renombrando en línea. */
  editing?: boolean;
};
export type ElementRFNode = Node<ElementNodeData, 'element'>;

/** `data` igual campo a campo (los valores ya conservan su identidad mientras no cambie el registro). */
export function sameElementData(a: ElementNodeData, b: ElementNodeData): boolean {
  return a === b || (a.node === b.node && a.element === b.element && a.type === b.type && a.rule === b.rule && a.ports === b.ports
    && a.archimate === b.archimate && a.dimmed === b.dimmed && a.remoteColor === b.remoteColor && a.editing === b.editing);
}

/**
 * Comparación de props para `memo`: `data` se compara campo a campo y el resto de props de React Flow por igualdad
 * simple. Así, mover o seleccionar un nodo no vuelve a pintar los otros cientos de la vista.
 */
export function elementNodePropsEqual(a: NodeProps<ElementRFNode>, b: NodeProps<ElementRFNode>): boolean {
  if (!sameElementData(a.data, b.data)) return false;
  const ka = Object.keys(a) as (keyof NodeProps<ElementRFNode>)[];
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (k !== 'data' && !Object.is(a[k], b[k])) return false;
  return true;
}

const SMALL_SHAPES = new Set(['circle', 'double-circle', 'diamond', 'bar', 'actor']);
/** Opacidad de `.ad-node.is-dimmed` (editor.css). */
export const DIMMED_OPACITY = 0.45;

/** Nodo genérico: pinta cualquier elemento según su tipo (forma, color, icono), las reglas de estilo y sus puertos. */
export const ElementNode = memo(function ElementNode({ data, selected }: NodeProps<ElementRFNode>) {
  const { readOnly, run, setRenaming, dark, lowDetail } = useNodeEnv();
  const t = useT();
  const sim = useSimMark(data.node.id);
  const { node: vn, element, type, rule, archimate } = data;
  if (!element) return <div className="ad-node ad-node--missing">?</div>;
  const visible = visiblePorts(data.ports, vn);
  const shape = type?.shape ?? 'rounded';
  const css = shapeStyle(shape, type, vn, rule, dark);
  // Las figuras SVG reciben el relleno y el trazo reales (la caja CSS de esas figuras es transparente).
  const colors = shapeColors(type, vn, rule, dark);
  const figure = figureFor(element.typeId, shape);
  // Clase, interfaz, enumeración, entidad: compartimentos con una fila por atributo (y su pin a esa altura).
  const cmp = archimate ? undefined : compartmentsOf(element, type);
  const layout = cmp ? compartmentLayout(cmp) : undefined;
  if (layout) css.height = Math.max(vn.h, layout.height);
  if (figure === 'store') css.color = rule.text ?? vn.style.text ?? readable(colors.fill);
  // Figuras UML nuevas (paquete, caja 3D, señales…): las pinta el SVG entero y el texto respeta pestaña, caras y puntas.
  const extra = isExtraFigure(figure);
  if (extra) {
    if (SVG_ONLY_FIGURES.has(figure)) { css.background = 'transparent'; css.borderColor = 'transparent'; }
    const ins = figureInset(figure, vn.w, vn.h);
    if (ins.top || ins.right || ins.left) css.padding = `${4 + ins.top}px ${10 + ins.right}px 4px ${10 + ins.left}px`;
  }
  if (figure === 'person') {
    // Persona C4: el texto va dentro del cuerpo, bajo la cabeza, con el color legible sobre el del tipo.
    css.color = rule.text ?? vn.style.text ?? readable(colors.fill);
    css.paddingTop = personGeometry(vn.w, vn.h).bodyTop + 2;
    css.paddingBottom = 4;
  }
  const label = vn.text ?? (element.name || (type?.name ?? ''));
  // Sin nombre, la etiqueta ya es el nombre del tipo: no se repite debajo ("Tarea / Tarea").
  const showType = !!type && !lowDetail && label !== type.name;
  // Figuras de Archi: el fondo lo pinta `ArchimateFigure` (path + icono) y el texto se centra en la zona útil.
  const archiFill = css.background as string, archiStroke = css.borderColor as string;
  // Rectángulo y redondeado sólidos de 1 px: los pinta la caja CSS (sin SVG); el resto, `ArchimateFigure`.
  const boxRadius = archimate ? archimateBox(element.typeId, vn.style.figure, rule.borderWidth ?? 1, rule.borderStyle) : undefined;
  if (archimate) {
    const def = figureOf(element.typeId, vn.style.figure === 1 ? 1 : 0);
    const inset = textInset(def, vn.w, vn.h);
    css.background = 'transparent'; css.borderColor = 'transparent'; css.boxShadow = undefined;
    // Rectángulo/redondeado sin SVG: un `div` con la misma caja que ocuparía el SVG (`archimateBoxStyle`).
    css.padding = `${4 + inset.top}px ${10 + inset.right + (showsIcon(element.typeId, vn.style.figure) ? 12 : 0)}px ${4 + inset.bottom}px ${10 + inset.left}px`;
  }
  const icon = archimate || SMALL_SHAPES.has(shape) || (extra && !rule.icon) ? undefined : ((rule.icon ?? type?.icon) || undefined);
  const editing = !!data.editing;
  // Atenuado (otra notación o fuera del viewpoint) con una opacidad propia: se combinan (la clase sola daría .45 fijo).
  if (data.dimmed && css.opacity !== undefined) css.opacity = Number(css.opacity) * DIMMED_OPACITY;
  // Posición de la etiqueta que guardan los importadores (como el SVG): `top` arriba (contenedores de Archi con hijos),
  // `bottom` fuera, bajo la figura (objetos y almacenes de datos BPMN). Las figuras con etiqueta debajo ya la llevan ahí.
  const labelPos = !layout && !SMALL_SHAPES.has(shape) ? vn.style.labelPosition : undefined;
  const labelBelow = labelPos === 'bottom';
  const rowKeys = layout ? new Set(layout.sections.flatMap(sec => sec.rows.map(r => r.portKey))) : undefined;
  const loose = rowKeys ? visible.filter(p => !rowKeys.has(p.key)) : visible;
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
    <div className={`ad-node ad-shape-${figure}${extra ? ` ad-shape-${shape}` : ''}${layout ? ' ad-node--cls' : ''}${labelPos === 'top' || labelBelow ? ` ad-node--label-${labelPos}` : ''}${archimate ? ' ad-node--archimate' : ''}${type?.container ? ' is-container' : ''}${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${rule.bold ? ' r-bold' : ''}${rule.strike ? ' r-strike' : ''}${sim ? ` ad-sim ad-sim--${sim}` : ''}`} style={css} title={element.doc || undefined}>
      {/* El redimensionador (8 controles) solo existe con el nodo seleccionado. */}
      {!readOnly && selected && !editing && <NodeResizer minWidth={24} minHeight={layout?.height ?? 16} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      {boxRadius !== undefined && <div className="ad-archi-box" style={archimateBoxStyle(vn.w, vn.h, boxRadius, dark && archiFill === '#fff' ? '#1c2230' : archiFill, archiStroke)} />}
      {archimate
        ? <ArchimateFigure typeId={element.typeId} figure={vn.style.figure} w={vn.w} h={vn.h} fill={archiFill} stroke={archiStroke} strokeWidth={rule.borderWidth ?? 1} borderStyle={rule.borderStyle} box={boxRadius !== undefined} lowDetail={lowDetail} />
        : <ShapeSvg shape={figure} fill={colors.fill} stroke={colors.stroke} figure={vn.style.figure} w={vn.w} h={vn.h} dark={dark} />}
      {/* Manejadores del cuerpo: React Flow los necesita para situar las aristas (aunque sean flotantes). */}
      <Handle type="target" position={Position.Top} id="" className="ad-handle ad-handle--body" />
      <Handle type="source" position={Position.Bottom} id="" className="ad-handle ad-handle--body" />
      {layout && cmp ? (
        <Classifier layout={layout} cmp={cmp} label={label} ports={data.ports} lowDetail={lowDetail}
          name={editing ? <InlineEdit value={element.name} onCommit={rename} onCancel={() => setRenaming(null)} /> : <span className="ad-node__label" onDoubleClick={onLabelDoubleClick}>{label}</span>}
          dupTitle={t('Nombre repetido')} pkTitle={t('Clave primaria')} />
      ) : (
      <>
      {labelBelow && icon && <span className="ad-node__icon ad-node__icon--alone">{icon}</span>}
      <div className="ad-node__body">
        {icon && !labelBelow && <span className="ad-node__icon">{icon}</span>}
        {editing
          ? <InlineEdit value={element.name} onCommit={rename} onCancel={() => setRenaming(null)} />
          : <span className="ad-node__label" onDoubleClick={onLabelDoubleClick}>{label}</span>}
        {rule.badge && <span className="ad-node__badge" style={{ background: rule.badge }}>{rule.badgeText}</span>}
        {showType && !labelBelow && <span className="ad-node__type">{type?.name}</span>}
      </div>
      </>
      )}
      {layout && rule.badge && <span className="ad-node__badge" style={{ background: rule.badge }}>{rule.badgeText}</span>}
      {loose.length > 0 && (
        <div className="ad-ports">
          {loose.map((p, i) => (
            <div key={p.id} className={`ad-port ad-port--${p.direction}`} style={{ top: `${((i + 1) / (loose.length + 1)) * 100}%` }}>
              {p.direction !== 'out' && <Handle type="target" position={Position.Left} id={p.id} className="ad-handle ad-handle--port" />}
              <span className="ad-port__label" title={`${p.key}${p.dataType ? ` · ${p.dataType}` : ''}`}>{p.label ?? p.key}</span>
              {p.direction !== 'in' && <Handle type="source" position={Position.Right} id={p.id} className="ad-handle ad-handle--port" />}
            </div>
          ))}
        </div>
      )}
      {vn.detailViewId && <span className="ad-node__drill" title={t('Tiene vista de detalle')}><Icon name="drill" size={11} /></span>}
    </div>
  );
}, elementNodePropsEqual);

/**
 * Cuerpo de un clasificador: cabecera («estereotipo» y nombre, en cursiva si es abstracto) y una sección por campo. Las
 * filas que son pines llevan sus manejadores (entrada a la izquierda, salida a la derecha) a la altura de la fila.
 */
function Classifier({ layout, cmp, name, label, ports, lowDetail, dupTitle, pkTitle }: { layout: CompartmentLayout; cmp: NonNullable<ReturnType<typeof compartmentsOf>>; name: React.ReactNode; label: string; ports: Port[]; lowDetail: boolean; dupTitle: string; pkTitle: string }) {
  const byKey = new Map(ports.map(p => [p.key, p] as const));
  return (
    <>
      <div className="ad-cls__head" style={{ height: layout.headerH }} title={label}>
        {cmp.stereotype && <span className="ad-cls__stereo">«{cmp.stereotype}»</span>}
        <span className={`ad-cls__name${cmp.italic ? ' is-abstract' : ''}`}>{name}</span>
      </div>
      {layout.sections.map((sec, i) => (
        <div key={i} className="ad-cls__sec" style={{ top: sec.y, height: sec.h }}>
          {!lowDetail && sec.rows.map(r => (
            <div key={r.portKey} className={`ad-cls__row${r.pk ? ' is-pk' : ''}${r.dup ? ' is-dup' : ''}`} style={{ top: r.cy - sec.y }} title={r.dup ? dupTitle : undefined}>
              {r.pk && <span className="ad-cls__pk" title={pkTitle}>PK</span>}
              <span className="ad-cls__text">{r.text}</span>
              {r.detail && <span className="ad-cls__detail">{r.detail}</span>}
            </div>
          ))}
        </div>
      ))}
      {layout.sections.flatMap(sec => sec.rows).map(r => {
        const p = byKey.get(r.portKey);
        if (!p) return null;
        return (
          <span key={`h-${r.portKey}`}>
            {p.direction !== 'out' && <Handle type="target" position={Position.Left} id={p.id} className="ad-handle ad-handle--port ad-handle--row" style={{ top: r.cy }} />}
            {p.direction !== 'in' && <Handle type="source" position={Position.Right} id={p.id} className="ad-handle ad-handle--port ad-handle--row" style={{ top: r.cy }} />}
          </span>
        );
      })}
    </>
  );
}

/**
 * Caja, trazo y radio que ocuparía el SVG de una figura rectangular o redondeada de Archi (`.ad-archi-box`). El SVG va
 * en la caja de relleno (dentro del borde transparente de 1 px), con `viewBox` de w×h escalado sin deformar
 * (`xMidYMid meet`) y el path a medio píxel del borde con trazo 1: se reproduce esa misma geometría. El tema oscuro
 * cambia el blanco puro por el fondo del panel (misma regla que `.ad-node__svg [fill="#fff"]`); eso lo hace quien llama.
 */
function archimateBoxStyle(w: number, h: number, radius: number, fill: string, stroke: string): CSSProperties {
  const pw = Math.max(1, w - 2), ph = Math.max(1, h - 2);
  const s = Math.min(pw / w, ph / h);
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const x = round((pw - w * s) / 2), y = round((ph - h * s) / 2);
  const r = Math.min(radius, (w - 1) / 2, (h - 1) / 2);
  return { top: y, bottom: y, left: x, right: x, background: fill, borderWidth: round(s), borderColor: stroke, borderRadius: radius ? round((r + 0.5) * s) : 0 };
}

const NO_PORTS: Port[] = [];
/** Puertos visibles: los elegidos en la vista, o los usados por alguna arista, o ninguno. */
function visiblePorts(ports: Port[], vn: ViewNode): Port[] {
  if (vn.style.showPorts === false || !ports.length) return NO_PORTS;
  if (vn.style.visiblePorts?.length) { const set = new Set(vn.style.visiblePorts); return ports.filter(p => set.has(p.key) || set.has(p.id)); }
  if (vn.style.showPorts) return ports;
  return NO_PORTS;
}

export type { ElementType };
