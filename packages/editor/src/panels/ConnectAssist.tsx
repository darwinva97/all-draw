/**
 * Ayudas del lienzo al conectar:
 * - `ConnectFeedback` (dentro de `<ReactFlow>`): mientras se arrastra una conexión, el nodo bajo el puntero se marca
 *   en verde si la relación vale y en rojo si no, con una etiqueta flotante que dice qué relación se creará o por qué
 *   no se puede. Toca el DOM del nodo directamente (una clase), sin volver a pintar los nodos.
 * - `CreateConnectMenu`: al soltar en un hueco vacío, «Crear y conectar» con los tipos que admiten la relación.
 */
import { useEffect, useRef, useState } from 'react';
import { useConnection, useStore } from '@xyflow/react';
import { useT } from '@all-draw/i18n';
import { useMenu, MenuBackdrop } from '../ui/menu';
import type { CreateCandidate } from '../edges/connect-assist';

export type ConnectFeedbackVerdict = { ok: boolean; text: string; detail?: string };

export interface ConnectFeedbackProps {
  /** Nodo desde el que se arrastra (el lienzo lo fija en `onConnectStart`). */
  sourceId: () => string | null;
  /** Veredicto para soltar sobre `targetId` (null: no es un destino posible, p. ej. una celda). */
  evaluate: (sourceId: string, targetId: string, fromHandle: string | null, toHandle: string | null) => ConnectFeedbackVerdict | null;
  /** Nodo de elemento bajo el punto de pantalla (excluido el origen), o `undefined`. */
  nodeAt: (x: number, y: number, exclude: string) => string | undefined;
  /** ¿Está el punto sobre algún nodo? (sobre el propio origen no se ofrece crear). */
  overNode: (x: number, y: number) => boolean;
  /** Se ofrece «Crear y conectar» al soltar en vacío. */
  canCreate: boolean;
}

const OK = 'ad-connect-ok', BAD = 'ad-connect-bad';

export function ConnectFeedback({ sourceId, evaluate, nodeAt, overNode, canCreate }: ConnectFeedbackProps) {
  const t = useT();
  const inProgress = useConnection(s => s.inProgress);
  const domNode = useStore(s => s.domNode);
  const [tip, setTip] = useState<{ x: number; y: number; v: ConnectFeedbackVerdict } | null>(null);
  // Lo último evaluado: el veredicto solo se recalcula al cambiar de nodo o de manejador bajo el puntero.
  const last = useRef<{ key: string; v: ConnectFeedbackVerdict | null; el: Element | null } | null>(null);
  const handles = useStore(s => (s.connection.inProgress ? `${s.connection.fromHandle?.id ?? ''}|${s.connection.toNode?.id ?? ''}|${s.connection.toHandle?.id ?? ''}` : ''));
  const handlesRef = useRef(handles); handlesRef.current = handles;

  useEffect(() => {
    if (!inProgress || !domNode) return;
    let raf = 0;
    let pos: { x: number; y: number } | null = null;
    const clear = () => { last.current?.el?.classList.remove(OK, BAD); last.current = null; };
    const update = () => {
      raf = 0;
      const src = sourceId();
      if (!pos || !src) return;
      const [fromHandle, toNode, toHandle] = handlesRef.current.split('|');
      const target = nodeAt(pos.x, pos.y, src);
      const box = domNode.getBoundingClientRect();
      const at = { x: pos.x - box.left, y: pos.y - box.top };
      if (!target) {
        clear();
        const empty = canCreate && !overNode(pos.x, pos.y);
        setTip(empty ? { ...at, v: { ok: true, text: t('Suelta para crear un elemento y conectarlo') } } : null);
        return;
      }
      const key = `${target}|${fromHandle}|${toNode === target ? toHandle : ''}`;
      if (last.current?.key !== key) {
        clear();
        const v = evaluate(src, target, fromHandle || null, toNode === target ? toHandle || null : null);
        const el = v ? domNode.querySelector(`.react-flow__node[data-id="${CSS.escape(target)}"]`) : null;
        el?.classList.add(v!.ok ? OK : BAD);
        last.current = { key, v, el };
      }
      const v = last.current!.v;
      setTip(v ? { ...at, v } : null);
    };
    const move = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const p = 'touches' in e ? e.touches[0] : e;
      if (!p) return;
      pos = { x: p.clientX, y: p.clientY };
      if (!raf) raf = requestAnimationFrame(update);
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener('mousemove', move, opts);
    document.addEventListener('touchmove', move, opts);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', move, opts);
      document.removeEventListener('touchmove', move, opts);
      clear();
      setTip(null);
    };
  }, [inProgress, domNode, sourceId, evaluate, nodeAt, overNode, canCreate, t]);

  if (!inProgress || !tip) return null;
  return (
    <div className={`ad-connect-tip ${tip.v.ok ? 'is-ok' : 'is-bad'}`} style={{ transform: `translate(${Math.round(tip.x + 14)}px, ${Math.round(tip.y + 16)}px)` }} role="status" aria-live="polite">
      <span className="ad-connect-tip__text">{tip.v.text}</span>
      {tip.v.detail && <span className="ad-connect-tip__detail">{tip.v.detail}</span>}
    </div>
  );
}

/** Opciones del menú «Crear y conectar» que se ven sin desplegar «Más tipos». */
export const CREATE_MENU_TOP = 8;

export interface CreateConnectMenuProps {
  x: number; y: number;
  candidates: CreateCandidate[];
  typeName: (typeId: string) => string;
  typeColor: (typeId: string) => string | undefined;
  relationName: (relationId: string) => string;
  onPick: (c: CreateCandidate) => void;
  onClose: () => void;
}

/** Menú «Crear y conectar»: los tipos más habituales primero; el resto bajo «Más tipos». */
export function CreateConnectMenu({ x, y, candidates, typeName, typeColor, relationName, onPick, onClose }: CreateConnectMenuProps) {
  const t = useT();
  const m = useMenu(x, y, onClose);
  const item = (c: CreateCandidate) => (
    <button key={c.typeId} type="button" role="menuitem" tabIndex={-1} className="ad-popover__item ad-create-item" data-type={c.typeId}
      title={c.options > 1 ? t('Se crea «{rel}»; puedes cambiar la relación en el inspector', { rel: relationName(c.relationId) }) : undefined}
      onClick={() => { onPick(c); onClose(); }}>
      <span className="ad-pal__swatch" style={{ background: typeColor(c.typeId) ?? '#eee' }} />
      <span className="ad-pal__ellipsis">{typeName(c.typeId)}</span>
      <small>{relationName(c.relationId)}</small>
    </button>
  );
  const top = candidates.slice(0, CREATE_MENU_TOP), rest = candidates.slice(CREATE_MENU_TOP);
  return <>
    {m.sheet && <MenuBackdrop />}
    <div ref={m.ref} className={`ad-popover ad-menu ad-create-menu${m.sheet ? ' ad-menu--sheet' : ''}`} style={m.style} role="menu" aria-label={t('Crear y conectar')} onKeyDown={m.onKeyDown}>
      <div className="ad-popover__title">{t('Crear y conectar')}</div>
      {top.map(item)}
      {rest.length > 0 && <details className="ad-popover__details">
        <summary className="ad-popover__item" role="menuitem" tabIndex={-1} aria-haspopup="true">{t('Más tipos ({n})', { n: rest.length })}</summary>
        {rest.map(item)}
      </details>}
    </div>
  </>;
}
