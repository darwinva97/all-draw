import { memo, type CSSProperties, type MouseEvent } from 'react';
import { Handle, NodeResizer, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Element, ElementType, Port, RuleStyle, ViewNode } from '@all-draw/core';
import { textInset, figureOf, showsIcon, isJunction, ARCHI_FONT_SIZE, TYPE_FONT, type LabelLayout } from '@all-draw/notation-archimate';
import { shapeStyle, shapeColors, ShapeSvg, figureFor, personGeometry, readable, isExtraFigure, figureInset, SVG_ONLY_FIGURES, DARK_PANEL } from './shapes';
import { compartmentsOf, compartmentLayout, type CompartmentLayout } from './compartments';
import { ArchimateFigure, archimateBox } from './ArchimateFigure';
import { InlineEdit } from './InlineEdit';
import { useNodeEnv, useSimMark } from './env';
import { fitNodeLabel, fittedLabel, measureFor } from './label';
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
  /** Tiene nodos hijos en la vista: el nombre va en la banda superior, como un contenedor. */
  hasChildren?: boolean;
  /**
   * Algún hijo tapa la banda del título: el título lo pinta la capa `ContainerTitles` del lienzo, encima de los hijos,
   * y aquí queda transparente (sigue ahí para el doble clic y la accesibilidad).
   */
  titleAbove?: boolean;
};
export type ElementRFNode = Node<ElementNodeData, 'element'>;

/** `data` igual campo a campo (los valores ya conservan su identidad mientras no cambie el registro). */
export function sameElementData(a: ElementNodeData, b: ElementNodeData): boolean {
  return a === b || (a.node === b.node && a.element === b.element && a.type === b.type && a.rule === b.rule && a.ports === b.ports
    && a.archimate === b.archimate && a.dimmed === b.dimmed && a.remoteColor === b.remoteColor && a.editing === b.editing
    && a.hasChildren === b.hasChildren && a.titleAbove === b.titleAbove);
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
  const { readOnly, run, setRenaming, dark, lowDetail, showTypeNames } = useNodeEnv();
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
  if (extra && SVG_ONLY_FIGURES.has(figure)) { css.background = 'transparent'; css.borderColor = 'transparent'; }
  // Persona C4: el texto va dentro del cuerpo, bajo la cabeza, con el color legible sobre el del tipo.
  if (figure === 'person') css.color = rule.text ?? vn.style.text ?? readable(colors.fill);
  const junction = archimate && isJunction(element.typeId);
  // Etiqueta (la Junction solo lleva su nombre, si lo tiene, debajo), icono de texto y nombre del tipo: este, según la
  // preferencia de la vista (en ArchiMate no: lo dice el icono) y nunca si la etiqueta ya es el tipo ("Tarea / Tarea").
  // `geo`: nombre ajustado a la zona útil (letra, líneas, «…» y si cabe el tipo); `undefined` en las figuras con la
  // etiqueta fuera o propia (pequeñas, calles, clasificadores).
  const { label, icon, typeName, geo } = nodeText(data, { lowDetail, showTypeNames });
  if (geo) css.padding = `${geo.pad.top}px ${geo.pad.right}px ${geo.pad.bottom}px ${geo.pad.left}px`;
  const showType = geo ? geo.fit.showType : !!typeName;
  // Figuras de Archi: el fondo lo pinta `ArchimateFigure` (path + icono) con el relleno y el trazo del nodo.
  const archiFill = colors.fill, archiStroke = colors.stroke;
  // Rectángulo y redondeado sólidos de 1 px: los pinta la caja CSS (sin SVG); el resto, `ArchimateFigure`.
  const boxRadius = archimate ? archimateBox(element.typeId, vn.style.figure, rule.borderWidth ?? 1, rule.borderStyle) : undefined;
  if (archimate) { css.background = 'transparent'; css.borderColor = 'transparent'; css.boxShadow = undefined; }
  // Junction «or»: círculo hueco (fondo del tema y borde de tinta).
  const junctionOr = junction && element.fields?.junctionType === 'or';
  const editing = !!data.editing;
  // Atenuado (otra notación o fuera del viewpoint) con una opacidad propia: se combinan (la clase sola daría .45 fijo).
  if (data.dimmed && css.opacity !== undefined) css.opacity = Number(css.opacity) * DIMMED_OPACITY;
  // Posición de la etiqueta que guardan los importadores (como el SVG): `top` arriba (contenedores de Archi con hijos),
  // `bottom` fuera, bajo la figura (objetos y almacenes de datos BPMN). Las figuras con etiqueta debajo ya la llevan ahí.
  const labelPos = !layout && !SMALL_SHAPES.has(shape) ? vn.style.labelPosition : undefined;
  const labelBelow = labelPos === 'bottom';
  const fitted = geo ? fittedLabel(label, geo.fit) : undefined;
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
    <div className={`ad-node ad-shape-${figure}${extra ? ` ad-shape-${shape}` : ''}${layout ? ' ad-node--cls' : ''}${labelPos === 'top' || labelBelow ? ` ad-node--label-${labelPos}` : ''}${geo?.band ? ' ad-node--band' : ''}${geo?.left ? ' ad-node--title-left' : ''}${archimate ? ' ad-node--archimate' : ''}${junction ? ' ad-node--junction' : ''}${type?.container ? ' is-container' : ''}${selected ? ' is-selected' : ''}${data.dimmed ? ' is-dimmed' : ''}${rule.bold ? ' r-bold' : ''}${rule.strike ? ' r-strike' : ''}${sim ? ` ad-sim ad-sim--${sim}` : ''}`} style={css} title={element.doc || undefined}>
      {/* El redimensionador (8 controles) solo existe con el nodo seleccionado. */}
      {!readOnly && selected && !editing && <NodeResizer minWidth={junction ? 8 : 24} minHeight={layout?.height ?? (junction ? 8 : 16)} lineClassName="ad-resizer__line" handleClassName="ad-resizer__handle" />}
      {boxRadius !== undefined && <div className="ad-archi-box" style={archimateBoxStyle(vn.w, vn.h, boxRadius, dark && archiFill === '#fff' ? '#1c2230' : archiFill, archiStroke)} />}
      {archimate
        ? <ArchimateFigure typeId={element.typeId} figure={vn.style.figure} w={vn.w} h={vn.h} fill={junctionOr ? (dark ? DARK_PANEL : '#ffffff') : archiFill} stroke={archiStroke} strokeWidth={rule.borderWidth ?? 1} borderStyle={rule.borderStyle} box={boxRadius !== undefined} lowDetail={lowDetail} variant={junctionOr ? 'or' : undefined} />
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
      {(label || editing || rule.badge || !junction) && <div className="ad-node__body">
        {icon && !labelBelow && (geo ? geo.fit.showIcon : true) && <span className="ad-node__icon">{icon}</span>}
        {editing
          ? <InlineEdit value={element.name} onCommit={rename} onCancel={() => setRenaming(null)} />
          : fitted
            ? <span className={`ad-node__label ad-node__label--fit${data.titleAbove ? ' is-under' : ''}`} style={fitted.style} title={fitted.title} onDoubleClick={onLabelDoubleClick}>{fitted.content}</span>
            : <span className="ad-node__label" onDoubleClick={onLabelDoubleClick}>{label}</span>}
        {rule.badge && <span className="ad-node__badge" style={{ background: rule.badge }}>{rule.badgeText}</span>}
        {showType && !labelBelow && <span className={`ad-node__type${data.titleAbove ? ' is-under' : ''}`}>{type?.name}</span>}
      </div>}
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

/** Margen del texto (borde incluido aparte) en los nodos ArchiMate y en el resto, y hueco del icono de Archi (16 px). */
export const ARCHI_PAD = { x: 5, y: 3, icon: 16 } as const;
export const NODE_PAD = { x: 10, y: 4 } as const;
/** Alto del icono de texto del tipo (`.ad-node__icon`: 16 px, interlineado 1). */
export const TEXT_ICON_H = 16;

export interface LabelGeometry {
  /** Márgenes interiores del nodo (sin el borde): la zona útil del texto. */
  pad: { top: number; right: number; bottom: number; left: number };
  /** Título en la banda superior (contenedor, nodo con hijos, `labelPosition: 'top'`). */
  band: boolean;
  /** Alineado a la izquierda (Grouping de Archi, contenedores del resto de notaciones). */
  left: boolean;
  fit: LabelLayout;
  /** Grosor del borde de la caja. */
  border: number;
}

/**
 * Zona útil y ajuste del nombre de un nodo de elemento (la misma cuenta que `renderElementNode` en el SVG). `undefined`
 * si la etiqueta no va dentro de la caja: figuras pequeñas (debajo), calles y piscinas (vertical), clasificadores
 * (cabecera propia), `labelPosition: 'bottom'`.
 */
export function labelGeometry(data: ElementNodeData, typeName: string | undefined, textIcon: boolean): LabelGeometry | undefined {
  const { node: vn, element, type, rule, archimate } = data;
  if (!element) return undefined;
  const shape = type?.shape ?? 'rounded';
  const figure = figureFor(element.typeId, shape);
  // Persona C4 y almacén DFD: figuras «pequeñas» por tipo, pero con el nombre dentro.
  const inside = figure === 'person' || figure === 'store';
  if ((SMALL_SHAPES.has(shape) && !inside) || shape === 'pool' || shape === 'lane' || vn.style.labelPosition === 'bottom') return undefined;
  if (!archimate && compartmentsOf(element, type)) return undefined;
  let pad: LabelGeometry['pad'];
  if (archimate) {
    const inset = textInset(figureOf(element.typeId, vn.style.figure === 1 ? 1 : 0), vn.w, vn.h);
    const icon = showsIcon(element.typeId, vn.style.figure) ? ARCHI_PAD.icon : 0;
    pad = { top: ARCHI_PAD.y + inset.top, right: ARCHI_PAD.x + inset.right + icon, bottom: ARCHI_PAD.y + inset.bottom, left: ARCHI_PAD.x + inset.left };
  } else if (figure === 'person') {
    pad = { top: personGeometry(vn.w, vn.h).bodyTop + 2, right: NODE_PAD.x, bottom: NODE_PAD.y, left: NODE_PAD.x };
  } else {
    const ins = isExtraFigure(figure) ? figureInset(figure, vn.w, vn.h) : { top: 0, right: 0, bottom: 0, left: 0 };
    pad = { top: NODE_PAD.y + ins.top, right: NODE_PAD.x + ins.right, bottom: NODE_PAD.y, left: NODE_PAD.x + ins.left };
  }
  const band = vn.style.labelPosition === 'top' || !!type?.container || !!data.hasChildren;
  const left = archimate ? element.typeId === 'archimate:Grouping' : !!type?.container;
  const border = rule.borderWidth ?? 1;
  const label = vn.text ?? (element.name || (type?.name ?? ''));
  const fit = fitNodeLabel(label, {
    width: vn.w - 2 * border - pad.left - pad.right,
    height: vn.h - 2 * border - pad.top - pad.bottom,
    fontSize: vn.style.fontSize ?? (archimate ? ARCHI_FONT_SIZE : 13),
    maxLines: band ? 2 : undefined,
    iconHeight: textIcon ? TEXT_ICON_H : 0,
    typeName,
    typeSlack: band ? 0 : Math.min(pad.top, pad.bottom) * 2,
    weight: rule.bold ? 700 : archimate ? 400 : 500,
  });
  return { pad, band, left, fit, border };
}

/** Lo que pinta el texto de un nodo (lo comparten `ElementNode` y la capa `ContainerTitles`). */
export interface NodeText {
  label: string;
  /** Icono de texto del tipo (no ArchiMate). */
  icon?: string;
  /** Nombre del tipo si la vista lo pide y no repite la etiqueta. */
  typeName?: string;
  geo?: LabelGeometry;
}
export function nodeText(data: ElementNodeData, env: { lowDetail: boolean; showTypeNames?: boolean }): NodeText {
  const { node: vn, element, type, rule, archimate } = data;
  if (!element) return { label: '' };
  const shape = type?.shape ?? 'rounded';
  const extra = isExtraFigure(figureFor(element.typeId, shape));
  const junction = archimate && isJunction(element.typeId);
  const label = vn.text ?? (element.name || (junction ? '' : (type?.name ?? '')));
  const typeName = type && !env.lowDetail && label !== type.name && (env.showTypeNames ?? !archimate) ? type.name : undefined;
  const icon = archimate || SMALL_SHAPES.has(shape) || (extra && !rule.icon) ? undefined : ((rule.icon ?? type?.icon) || undefined);
  return { label, icon, typeName, geo: labelGeometry(data, typeName, !!icon) };
}

/**
 * ¿Algún hijo (cajas relativas al padre) tapa el título de la banda superior? Entonces el título se pinta encima de los
 * hijos (`ContainerTitles`), como hace el SVG con su capa de títulos.
 */
export function titleCovered(data: ElementNodeData, { geo, typeName, icon }: NodeText, kids: { x: number; y: number; w: number; h: number }[]): boolean {
  if (!kids.length || !geo?.band || !geo.fit.lines.length) return false;
  const vn = data.node, b = geo.border;
  const m = measureFor(data.rule.bold ? 700 : data.archimate ? 400 : 500), mt = measureFor(400);
  const tw = Math.max(icon && geo.fit.showIcon ? TEXT_ICON_H : 0, ...geo.fit.lines.map(l => m(l, geo.fit.fontSize)), geo.fit.showType && typeName ? mt(typeName, TYPE_FONT) : 0);
  const areaW = vn.w - 2 * b - geo.pad.left - geo.pad.right;
  const r = { x: b + geo.pad.left + (geo.left ? 0 : (areaW - tw) / 2), y: b + geo.pad.top, w: tw, h: geo.fit.height };
  return kids.some(k => k.x < r.x + r.w && r.x < k.x + k.w && k.y < r.y + r.h && r.y < k.y + k.h);
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
