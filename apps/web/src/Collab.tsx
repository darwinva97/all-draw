/**
 * Puente de colaboración del espacio abierto (se monta una vez dentro del `EditorProvider` de `WorkspaceScreen`):
 *
 * - Dice al `YjsStore` qué campos tipados son texto largo (`textarea`/`json` según el registro de notaciones), para
 *   que se guarden como `Y.Text` y dos personas puedan escribir a la vez en ellos.
 * - Muestra los avisos de los demás conectados («Ana ha restaurado la versión de …»), que llegan por awareness.
 * - Si el servidor cierra con 4426 (esta pestaña es de una versión anterior al formato del documento), pide recargar.
 */
import { useEffect } from 'react';
import type { NotationRegistry } from '@all-draw/core';
import { toast } from '@all-draw/editor';
import { onNotices, WS_UPGRADE_REQUIRED, type LocalWorkspace, type RemoteConnection } from '@all-draw/sync';
import { formatDate, useT } from '@all-draw/i18n';

const LONG_TEXT = new Set(['textarea', 'json']);

/** Fecha y hora legibles de una versión (instantánea). */
export const versionDate = (iso: string): string => formatDate(iso);

export function CollabBridge({ lw, conn, registry }: { lw: LocalWorkspace; conn: RemoteConnection | null; registry: NotationRegistry }) {
  const t = useT();

  useEffect(() => {
    lw.store.textFields = (c, rec) => {
      const typeId = typeof rec.typeId === 'string' ? rec.typeId : '';
      const defs = c === 'elements' ? (registry.elementType(typeId) ? registry.fieldsOf(typeId) : undefined)
        : c === 'relations' ? registry.relationType(typeId)?.fields : undefined;
      return defs ? defs.filter(d => LONG_TEXT.has(d.kind)).map(d => d.key) : undefined;
    };
    return () => { lw.store.textFields = null; };
  }, [lw, registry]);

  useEffect(() => {
    if (!conn) return;
    return onNotices(conn.awareness, (n, from) => {
      if (n.kind !== 'restore') return;
      const name = from.name || n.by || t('Alguien');
      toast.info(t('{name} ha restaurado la versión de {date}', { name, date: versionDate(n.at) }), {
        id: `notice-${n.id}`, duration: 12_000,
        description: t('El espacio ha vuelto a como estaba entonces. Lo de después sigue en el historial, en la instantánea automática previa.'),
      });
    });
  }, [conn, t]);

  useEffect(() => {
    if (!conn) return;
    const onClose = (ev: { code: number } | null) => {
      if (ev?.code !== WS_UPGRADE_REQUIRED) return;
      toast.info(t('Hay una versión nueva de all-draw'), {
        id: 'upgrade-required', duration: Infinity,
        description: t('Recarga la página para seguir sincronizando. Lo que tienes abierto está guardado en este navegador.'),
        action: { label: t('Recargar'), onClick: () => location.reload() },
      });
    };
    conn.provider.on('connection-close', onClose);
    return () => { conn.provider.off('connection-close', onClose); };
  }, [conn, t]);

  return null;
}
