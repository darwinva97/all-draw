/** Piezas comunes de las pantallas fuera del editor: marca, cabecera, pie, tema y menú de cuenta. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';
import { LangSelect } from './App';
import { useAppTheme, THEME_NEXT } from './theme';
import { docHref, REPO_URL } from './help';
import type { User } from './api';
import { NotificationBell } from './Notifications';

/** Marca de all-draw (la misma figura que el favicon). */
export function Logo({ className = 'brand__mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#2563eb" />
      <rect x="12" y="14" width="18" height="12" rx="3" fill="#fff" />
      <rect x="34" y="38" width="18" height="12" rx="3" fill="#fff" />
      <circle cx="43" cy="20" r="6" fill="#fde68a" />
      <path d="M30 20h7M21 26v12h13" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

export function Brand({ href = '#/' }: { href?: string }) {
  const t = useT();
  return <a className="brand" href={href} aria-label={t('all-draw, inicio')}><Logo /><span>all-draw</span></a>;
}

const THEME_ICON = { system: 'contrast', light: 'sun', dark: 'moon' } as const;
const THEME_LABEL = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' } as const;

export function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useAppTheme();
  const label = `${t(THEME_LABEL[theme])} · ${t('cambiar tema')}`;
  return <button type="button" className="btn btn--ghost btn--icon" onClick={() => setTheme(THEME_NEXT[theme])} aria-label={label} title={label}><Icon name={THEME_ICON[theme]} /></button>;
}

/** Rol en un espacio del servidor, en palabras de la interfaz (claves en español). */
export function roleLabel(t: (k: string) => string, role: string): string {
  return role === 'owner' ? t('propietario') : role === 'editor' ? t('puede editar') : role === 'viewer' ? t('solo lectura') : role;
}

export const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Menú de la cuenta (nombre → Cuenta y claves API, Salir), con la campana de notificaciones delante. */
export function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);
  return (<>
    <NotificationBell />
    <div className="user-menu" ref={box}>
      <button ref={trigger} type="button" className="btn btn--ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} title={user.email}>
        <span className="avatar" aria-hidden="true">{initialsOf(user.name)}</span><span className="user-menu__name">{user.name}</span><Icon name="chevronDown" size={14} />
      </button>
      {open && <div className="menu" role="menu" aria-label={t('Cuenta')}>
        <div className="menu__title">{user.email}</div>
        <a role="menuitem" href="#/keys" onClick={() => setOpen(false)}><Icon name="key" />{t('Cuenta y claves API')}</a>
        <div className="menu__sep" />
        <button role="menuitem" type="button" onClick={() => { setOpen(false); onLogout(); }}><Icon name="logout" />{t('Cerrar sesión')}</button>
      </div>}
    </div>
  </>);
}

/** Cabecera fija de portada, inicio y cuenta. `right` va antes de los controles de idioma y tema. */
export function AppHeader({ right, nav = true }: { right?: ReactNode; nav?: boolean }) {
  const t = useT();
  return (
    <header className="topbar">
      <Brand />
      {nav && <nav className="topbar__nav" aria-label={t('Secciones')}>
        <a href={docHref('primeros-pasos')}>{t('Documentación')}</a>
        <a href={docHref('novedades')}>{t('Novedades')}</a>
      </nav>}
      <span className="topbar__spacer" />
      <ThemeToggle />
      <LangSelect />
      {right}
    </header>
  );
}

export function AppFooter() {
  const t = useT();
  return (
    <footer className="page__foot">
      <div className="foot">
        <Brand />
        <nav aria-label={t('Enlaces del pie')}>
          <a href={docHref('primeros-pasos')}>{t('Documentación')}</a>
          <a href={REPO_URL} target="_blank" rel="noopener">GitHub</a>
          <a href={docHref('novedades')}>{t('Novedades')}</a>
          <a href={docHref('privacidad')}>{t('Privacidad')}</a>
          <a href={docHref('terminos')}>{t('Términos')}</a>
          <a href="https://alldraw-monitor.darwin-sva-97.workers.dev" target="_blank" rel="noopener">{t('Estado del servicio')}</a>
        </nav>
        <span className="foot__spacer" />
        <span>{t('Código abierto, licencia MIT')}</span>
        <LangSelect />
      </div>
    </footer>
  );
}
