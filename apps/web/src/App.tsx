import { lazy, Suspense, useEffect, useState } from 'react';
import { getLang, t as translate, useLang, useT, LANGS, type Lang } from '@all-draw/i18n';
import { Home } from './Home';
import { WorkspaceScreen } from './WorkspaceScreen';
import { KeysScreen } from './Keys';
import { Landing } from './Landing';

// Avisos de importar/exportar, HTML exportado y `<desc>` de los SVG en el idioma de la interfaz. Se deja el traductor en
// `Symbol.for(IO_TRANSLATOR_KEY)` sin importar `@all-draw/io` (se carga bajo demanda y no debe entrar en el paquete inicial).
(globalThis as Record<symbol, unknown>)[Symbol.for('all-draw.io.translator')] = { t: translate, lang: getLang };

/** Centro de documentación (`#/docs…`): trozo perezoso, no entra en el paquete inicial. Enlaces: `./docs/links`. */
const DocsScreen = lazy(() => import('./docs/DocsScreen'));
/** Enlaces de los correos de cuenta (`#/restablecer?token=…`, `#/verificar?token=…`): también perezosos. */
const ResetPasswordScreen = lazy(() => import('./AccountLinks').then(m => ({ default: m.ResetPasswordScreen })));
const VerifyEmailScreen = lazy(() => import('./AccountLinks').then(m => ({ default: m.VerifyEmailScreen })));

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
  const t = useT();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { void import('./StandbyBanner').then(m => m.mountStandbyBanner()); }, []); // aviso de la copia de respaldo de solo lectura (Cloudflare)
  const m = /^#\/(w|s)\/([^/?]+)(?:\/v\/([^/?]+))?/.exec(hash);
  if (m) return <WorkspaceScreen key={m[1]! + m[2]!} mode={m[1] === 's' ? 'server' : 'local'} id={decodeURIComponent(m[2]!)} viewId={m[3] ? decodeURIComponent(m[3]) : null} />;
  if (/^#\/docs(?:[/?#]|$)/.test(hash)) return <Suspense fallback={<div className="home" role="status" aria-live="polite">{t('Cargando…')}</div>}><DocsScreen hash={hash} /></Suspense>;
  if (hash.startsWith('#/keys')) return <KeysScreen />;
  if (/^#\/(restablecer|verificar)(?:[?#]|$)/.test(hash)) {
    const Screen = hash.startsWith('#/restablecer') ? ResetPasswordScreen : VerifyEmailScreen;
    return <Suspense fallback={<div className="home" role="status" aria-live="polite">{t('Cargando…')}</div>}><Screen key={hash} /></Suspense>;
  }
  // Portada siempre accesible; en `#/` el inicio muestra la portada a quien llega sin sesión ni espacios locales.
  if (hash.startsWith('#/bienvenida')) return <Landing />;
  // `#/espacios`: el inicio (plantillas, importar, espacios) también sin sesión ni espacios locales; lo enlaza la portada.
  if (hash.startsWith('#/espacios')) return <Home key="espacios" forceHome />;
  return <Home />;
}
