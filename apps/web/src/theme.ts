/**
 * Tema de las pantallas de la app fuera del editor (portada, inicio, cuenta). Comparte la preferencia con el
 * editor (`localStorage('alldraw:theme')`: `system` | `light` | `dark`) y la aplica como `<html data-theme>`;
 * con `system` no hay atributo y manda `prefers-color-scheme` en el CSS.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { THEME_KEY, type Theme } from '@all-draw/editor';

const listeners = new Set<() => void>();
function read(): Theme {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}
function apply(theme: Theme): void {
  const html = document.documentElement;
  if (theme === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', theme);
}

export function useAppTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, read, read);
  useEffect(() => { apply(theme); }, [theme]);
  const set = useCallback((t: Theme) => {
    try { localStorage.setItem(THEME_KEY, t); } catch { /* sin almacenamiento */ }
    apply(t);
    for (const f of listeners) f();
  }, []);
  return [theme, set];
}
export const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const DARK_MQ = '(prefers-color-scheme: dark)';
/** Tema que se ve realmente (resuelve `system` con `prefers-color-scheme`). */
export function useEffectiveTheme(): 'light' | 'dark' {
  const [theme] = useAppTheme();
  const sys = useSyncExternalStore(
    f => { const mq = matchMedia(DARK_MQ); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); },
    () => matchMedia(DARK_MQ).matches, () => false);
  return theme === 'system' ? (sys ? 'dark' : 'light') : theme;
}
