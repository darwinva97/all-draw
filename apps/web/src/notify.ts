/** Avisos de error de la app: los fallos de red llevan "Reintentar"; los demás muestran el mensaje del servidor. */
import { toast } from '@all-draw/editor';
import { t } from '@all-draw/i18n';
import { isNetworkError } from './api';

export function reportError(e: unknown, opts: { title?: string; retry?: () => void } = {}): void {
  if (isNetworkError(e)) {
    toast.error(opts.title ?? t('No hay conexión con el servidor'), {
      id: 'network', description: t('Comprueba tu conexión. Lo que hagas en espacios abiertos se guarda en este navegador.'),
      action: opts.retry ? { label: t('Reintentar'), onClick: opts.retry } : undefined,
    });
    return;
  }
  const msg = e instanceof Error ? e.message : String(e);
  toast.error(opts.title ?? msg, { description: opts.title ? msg : undefined, action: opts.retry ? { label: t('Reintentar'), onClick: opts.retry } : undefined });
}
