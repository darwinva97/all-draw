import { useEffect, useState } from 'react';
import { useLang, useT, LANGS, type Lang } from '@all-draw/i18n';
import { Home } from './Home';
import { WorkspaceScreen } from './WorkspaceScreen';
import { KeysScreen } from './Keys';

function useHashRoute(): string {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

/** Selector de idioma compacto (Home y barra del editor). Al cambiar, toda la interfaz se vuelve a pintar por el hook. */
export function LangSelect({ className = '' }: { className?: string }) {
  const [lang, setLang] = useLang();
  const t = useT();
  return (
    <select className={`lang-select ${className}`} value={lang} aria-label={t('Idioma')} title={t('Idioma')} onChange={e => setLang(e.target.value as Lang)}>
      {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
}

export function App() {
  const hash = useHashRoute();
  const [lang] = useLang();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const m = /^#\/(w|s)\/([^/?]+)(?:\/v\/([^/?]+))?/.exec(hash);
  if (m) return <WorkspaceScreen key={m[1]! + m[2]!} mode={m[1] === 's' ? 'server' : 'local'} id={decodeURIComponent(m[2]!)} viewId={m[3] ? decodeURIComponent(m[3]) : null} />;
  if (hash.startsWith('#/keys')) return <KeysScreen />;
  return <Home />;
}
