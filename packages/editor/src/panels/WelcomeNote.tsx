import { useState } from 'react';
import { useT } from '@all-draw/i18n';
import { Icon } from '../icons';

/**
 * Propiedad de la vista con la nota de bienvenida de una plantilla (qué muestra y cómo seguir). La pone la galería de
 * plantillas en la primera vista del espacio nuevo; el lienzo la enseña como un aviso plegable que se puede cerrar.
 */
export const WELCOME_PROP = 'welcome';
const KEY = 'alldraw:welcome:';

type WelcomeState = 'open' | 'folded' | 'closed';
function readState(viewId: string): WelcomeState {
  try { const v = globalThis.localStorage?.getItem(KEY + viewId); return v === 'folded' || v === 'closed' ? v : 'open'; } catch { return 'open'; }
}
function writeState(viewId: string, v: WelcomeState): void {
  try { globalThis.localStorage?.setItem(KEY + viewId, v); } catch { /* sin almacenamiento: solo esta sesión */ }
}

/**
 * Aviso de bienvenida sobre el lienzo (arriba a la izquierda, sin tapar el diagrama): se pliega a una línea y se
 * cierra con la X. Plegado y cerrado se recuerdan por vista en este navegador; no toca el modelo ni el historial.
 */
export function WelcomeNote({ viewId, text }: { viewId: string; text: string }) {
  const t = useT();
  const [state, setState] = useState<WelcomeState>(() => readState(viewId));
  if (state === 'closed' || !text.trim()) return null;
  const set = (v: WelcomeState) => { setState(v); writeState(viewId, v); };
  const open = state === 'open';
  return (
    <aside className={`ad-welcome ${open ? '' : 'is-folded'}`} aria-label={t('Sobre esta plantilla')}>
      <div className="ad-welcome__head">
        <button type="button" className="ad-welcome__toggle" aria-expanded={open} onClick={() => set(open ? 'folded' : 'open')}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} /><Icon name="sparkle" size={14} />{t('Sobre esta plantilla')}
        </button>
        <button type="button" className="ad-btn ad-btn--ghost ad-welcome__close" onClick={() => set('closed')} aria-label={t('Cerrar la nota de bienvenida')} title={t('Cerrar')}><Icon name="close" size={14} /></button>
      </div>
      {open && <p className="ad-welcome__text">{text}</p>}
    </aside>
  );
}
