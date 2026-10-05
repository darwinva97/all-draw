/**
 * Aviso fijo de la copia de respaldo de solo lectura (el worker de Cloudflare con `STANDBY="true"`): pregunta una vez
 * `GET /api/status` y, sólo si responde `standby: true`, monta un aviso fijo abajo con el enlace al servidor principal
 * (`primaryUrl`). En el VPS no pinta nada. Se monta desde `App.tsx` con `mountStandbyBanner()` en su propia raíz de
 * React (no toca el árbol de pantallas); sus estilos van aquí, en un `<style>` propio.
 */
import { createRoot } from 'react-dom/client';
import { useT } from '@all-draw/i18n';

const FALLBACK_PRIMARY = 'https://alldraw.bezenti.com';
const MARK = '\u0000';

/**
 * Abajo en el centro, como el aviso «sin conexión» (`.ad-offline`): arriba taparía la barra superior. En el editor sube
 * por encima de la barra de estado y, si a la vez está el aviso sin conexión, se apila encima de él. Ámbar oscuro fijo
 * (contraste 7:1 con el blanco) en los dos temas.
 */
const CSS = `
.ad-standby{position:fixed;z-index:110;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);
  width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;padding:7px 14px;border-radius:999px;
  background:#7c4a00;color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:var(--shadow-md);font:600 12.5px/1.35 var(--font,system-ui,sans-serif);text-align:center}
.ad-standby a{color:inherit;text-decoration:underline;text-underline-offset:2px}
:root:has(.ad-editor) .ad-standby{bottom:40px}
:root:has(.ad-editor--mobile) .ad-standby{bottom:calc(66px + env(safe-area-inset-bottom))}
:root:has(.ad-offline) .ad-standby{bottom:calc(56px + env(safe-area-inset-bottom))}
:root:has(.ad-editor):has(.ad-offline) .ad-standby{bottom:80px}
@media (max-width:520px){.ad-standby{border-radius:12px}}
`;

export function StandbyBanner({ primaryUrl }: { primaryUrl: string }) {
  const t = useT();
  // El enlace va en medio de la frase traducida: se marca su sitio y se parte el texto.
  const [before, after = ''] = t('Copia de respaldo de solo lectura, actualizada cada noche — usa {url}', { url: MARK }).split(MARK);
  const host = primaryUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <>
      <style>{CSS}</style>
      <div className="ad-standby" role="status" aria-live="polite" data-standby-banner="">{before}<a href={primaryUrl}>{host}</a>{after}</div>
    </>
  );
}

let mounted = false;
/** Consulta `/api/status` y monta el aviso si el servidor es la copia de respaldo. Idempotente. */
export function mountStandbyBanner(): void {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  // Solo una copia de respaldo puede estar en modo standby: ni el servidor principal ni el desarrollo local lo están,
  // así que ahí no se pregunta (en `vite dev` no hay API y la petición daría un 404 en la consola).
  const host = location.hostname;
  if (host === new URL(FALLBACK_PRIMARY).hostname || host === 'localhost' || /^127\.|^\[?::1\]?$/.test(host)) return;
  void fetch('/api/status', { headers: { accept: 'application/json' } })
    .then(r => (r.headers.get('content-type') ?? '').includes('application/json') ? r.json() as Promise<{ standby?: boolean; primaryUrl?: string }> : null)
    .then(s => {
      if (!s?.standby) return;
      const el = document.createElement('div');
      document.body.appendChild(el);
      createRoot(el).render(<StandbyBanner primaryUrl={/^https?:\/\//.test(s.primaryUrl ?? '') ? s.primaryUrl! : FALLBACK_PRIMARY} />);
    })
    .catch(() => { /* sin servidor (espacios locales) o sin red: no hay aviso que dar */ });
}
