/// <reference types="vite-plugin-pwa/client" />
/**
 * Piezas globales de la app en la capa flotante del editor (se importa una vez, por efecto, desde las pantallas):
 *
 * - Indicador "sin conexión" mientras `navigator.onLine` es falso, y aviso al recuperarla.
 * - Aviso "hay una versión nueva" del service worker (PWA con `registerType: 'prompt'`): no se recarga sola;
 *   el usuario elige cuándo con "Recargar".
 */
import { useEffect, useRef, useState } from 'react';
import { Icon, mountInLayer, mountUiLayer, toast } from '@all-draw/editor';
import { t, useT } from '@all-draw/i18n';

function OfflineIndicator() {
  const tt = useT();
  const [online, setOnline] = useState(() => navigator.onLine);
  const wasOffline = useRef(false);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      if (wasOffline.current) toast.success(tt('Conexión recuperada'), { id: 'online', description: tt('Los cambios pendientes se sincronizan solos.'), duration: 3500 });
      wasOffline.current = false;
    };
    const down = () => { setOnline(false); wasOffline.current = true; toast.dismiss('online'); };
    addEventListener('online', up); addEventListener('offline', down);
    return () => { removeEventListener('online', up); removeEventListener('offline', down); };
  }, [tt]);
  if (online) return null;
  return (
    <div className="ad-offline" role="status" title={tt('Puedes seguir trabajando: todo se guarda en este navegador y se sincroniza al volver la conexión.')}>
      <Icon name="cloudOff" size={14} /><span>{tt('Sin conexión')}</span><span className="ad-offline__more">{tt('· se guarda en este navegador')}</span>
    </div>
  );
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast.info(t('Hay una versión nueva de all-draw'), {
          id: 'sw-update', duration: Infinity, description: t('Recarga para usarla; lo que tienes abierto ya está guardado.'),
          action: { label: t('Recargar'), onClick: () => { void update(true); } },
        });
      },
      onOfflineReady() { toast.success(t('Lista para usar sin conexión'), { id: 'sw-offline', duration: 4000 }); },
    });
  }).catch(() => { /* sin service worker (navegación privada, http): la app funciona igual */ });
}

let started = false;
/** Monta la capa flotante, el indicador de conexión y el registro del service worker (idempotente). */
export function startAppShell(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  mountUiLayer();
  mountInLayer('offline', OfflineIndicator);
  registerServiceWorker();
}
startAppShell();
