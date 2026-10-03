/**
 * Portada (`#/bienvenida`, y el inicio para quien llega sin sesión ni espacios locales). Ligera: la demostración
 * visual son las vistas reales del espacio de ejemplo, pintadas con `renderSvg` de la propia app al cargar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@all-draw/editor';
import { useLang, useT } from '@all-draw/i18n';
import { demoWorkspace } from './demo';
import { api, type User } from './api';
import { AuthDialog } from './Auth';
import { AppFooter, AppHeader, UserMenu } from './Chrome';
import { PACKS, PACK_COLORS, localizePack } from './registry';
import { createLocalWorkspace } from './spaces';
import { workspaceThumb } from './thumbs';
import { useEffectiveTheme } from './theme';
import { docHref } from './help';
import { reportError } from './notify';
import './pwa';
import './Landing.css';

/** Las cinco dimensiones de la demo que enseña la portada (notación → nombre de la dimensión, clave en español). */
const DIMENSIONS: { notation: string; name: string }[] = [
  { notation: 'archimate', name: 'Arquitectura' },
  { notation: 'bpmn', name: 'Proceso' },
  { notation: 'statechart', name: 'Estados' },
  { notation: 'c4', name: 'C4' },
  { notation: 'grid', name: 'Capas × etapas' },
];
const IDEAS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'layers', title: 'Un modelo, muchas vistas', text: 'Cada elemento existe una sola vez. Dibújalo en tantas vistas y notaciones como necesites: si lo renombras, cambia en todas.' },
  { icon: 'pin', title: 'Pines de datos', text: 'Los campos JSON de un servicio se convierten en pines. Une un campo con otro y queda documentado por dónde viaja cada dato.' },
  { icon: 'cloudOff', title: 'Sin conexión y en equipo', text: 'Trabaja en el navegador sin cuenta ni red. Con una cuenta, comparte un enlace y editad a la vez, con comentarios e historial.' },
  { icon: 'fileImport', title: 'Trae lo que ya tienes', text: 'Importa modelos de Archi, procesos de bpmn.io, espacios de Structurizr y ficheros Mermaid, XState u OpenAPI.' },
];

export function Landing({ serverUp: serverUpProp, user: userProp, onAuthed }: { serverUp?: boolean; user?: User | null; onAuthed?: () => void }) {
  const t = useT();
  const [serverUp, setServerUp] = useState(serverUpProp ?? false);
  const [user, setUser] = useState<User | null>(userProp ?? null);
  const [auth, setAuth] = useState<'login' | 'register' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (serverUpProp !== undefined) return;
    let alive = true;
    api.available().then(async up => { if (!alive) return; setServerUp(up); if (up) { const u = await api.me(); if (alive) setUser(u ?? null); } });
    return () => { alive = false; };
  }, [serverUpProp]);
  useEffect(() => { document.title = t('all-draw · un modelo, muchas notaciones'); return () => { document.title = 'all-draw'; }; }, [t]);

  const tryDemo = async () => {
    setBusy(true);
    try { location.hash = `#/w/${await createLocalWorkspace(demoWorkspace())}`; }
    catch (e) { setBusy(false); reportError(e, { title: t('No se pudo crear la demo') }); }
  };
  const closeAuth = async () => {
    setAuth(null);
    const u = await api.me(); setUser(u ?? null);
    if (u) { onAuthed?.(); if (location.hash.startsWith('#/bienvenida')) location.hash = '#/'; }
  };
  const logout = async () => { try { await api.logout(); } catch (e) { reportError(e); } setUser(null); };

  return (
    <div className="page lp">
      <AppHeader right={user
        ? <UserMenu user={user} onLogout={logout} />
        : serverUp && <button type="button" className="btn btn--ghost" onClick={() => setAuth('login')}>{t('Entrar')}</button>} />
      <main className="lp__main" id="contenido">
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-hero__copy">
            <h1 id="lp-title">{t('Dibuja el sistema una vez. Míralo en todas sus notaciones.')}</h1>
            <p className="lp-hero__lead">{t('all-draw guarda un único modelo y lo muestra como arquitectura ArchiMate, proceso BPMN, máquina de estados, C4 o mapa de capas. Cambias un elemento y cambia en todas las vistas.')}</p>
            <div className="lp-hero__cta">
              <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={tryDemo}>{busy ? t('Abriendo la demo…') : t('Probar sin cuenta')}</button>
              {user
                ? <a className="btn btn--lg" href="#/">{t('Ir a mis espacios')}</a>
                : serverUp && <button type="button" className="btn btn--lg" onClick={() => setAuth('register')}>{t('Crear cuenta')}</button>}
              <a className="lp-hero__doc" href={docHref('primeros-pasos')}><Icon name="book" />{t('Leer la documentación')}</a>
            </div>
            <p className="lp-hero__note">{t('Sin registro: la demo se guarda en este navegador y funciona sin conexión.')}</p>
          </div>
          <DimensionViewer />
        </section>

        <section className="lp-sect" aria-labelledby="lp-ideas">
          <h2 id="lp-ideas">{t('Cómo funciona')}</h2>
          <ul className="lp-ideas">
            {IDEAS.map(i => (
              <li key={i.title}>
                <span className="lp-ideas__icon"><Icon name={i.icon} size={20} /></span>
                <h3>{t(i.title)}</h3>
                <p>{t(i.text)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-sect" aria-labelledby="lp-notations">
          <h2 id="lp-notations">{t('Notaciones incluidas')}</h2>
          <p className="lp-sect__lead">{t('Cada una con sus figuras, sus reglas de validez y su exportación. Además, librerías propias con tus tipos y campos.')}</p>
          <Notations />
        </section>

        <section className="lp-close" aria-labelledby="lp-close">
          <h2 id="lp-close">{t('Empieza por la demo: tarda un segundo.')}</h2>
          <div className="lp-hero__cta">
            <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={tryDemo}>{t('Empezar con la demo')}</button>
            <a className="btn btn--lg" href={docHref('primeros-pasos')}>{t('Primeros pasos')}</a>
          </div>
        </section>
      </main>
      <AppFooter />
      {auth && <AuthDialog initialMode={auth} onClose={closeAuth} />}
    </div>
  );
}

function Notations() {
  const [lang] = useLang();
  const packs = useMemo(() => PACKS.map(p => localizePack(p, lang)), [lang]);
  return (
    <ul className="lp-notations">
      {packs.map(p => (
        <li key={p.id}><a className="chip lp-notations__chip" href={docHref(`notaciones/${p.id}`)}><span className="chip__dot" style={{ background: PACK_COLORS[p.id] ?? p.color }} />{p.name}</a></li>
      ))}
    </ul>
  );
}

/** Las cinco dimensiones del espacio de ejemplo; avanza sola cada pocos segundos hasta que el usuario elige una. */
function DimensionViewer() {
  const t = useT();
  const [lang] = useLang();
  const theme = useEffectiveTheme();
  const ws = useMemo(() => demoWorkspace(), []);
  const views = useMemo(() => DIMENSIONS.map(d => ({ ...d, view: Object.values(ws.views).find(v => v.notationId === d.notation && !v.rootElementId) ?? Object.values(ws.views).find(v => v.notationId === d.notation)! })), [ws]);
  const colors = PACK_COLORS;
  const [imgs, setImgs] = useState<Record<string, string | null>>({});
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const hover = useRef(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    for (const v of views) workspaceThumb('landing-demo', ws, lang, theme, v.view.id).then(url => { if (alive) setImgs(m => ({ ...m, [v.view.id]: url })); });
    return () => { alive = false; };
  }, [views, ws, lang, theme]);
  useEffect(() => {
    if (!auto || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!hover.current && !document.hidden) setI(x => (x + 1) % views.length); }, 4200);
    return () => clearInterval(id);
  }, [auto, views.length]);

  const pick = (n: number, focus = false) => { setAuto(false); setI(n); if (focus) tabs.current[n]?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); pick((i + 1) % views.length, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pick((i + views.length - 1) % views.length, true); }
    else if (e.key === 'Home') { e.preventDefault(); pick(0, true); }
    else if (e.key === 'End') { e.preventDefault(); pick(views.length - 1, true); }
  };
  const cur = views[i]!;
  return (
    <figure className="lp-viewer" onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }}>
      <div className="lp-viewer__bar">
        <div className="lp-viewer__tabs" role="tablist" aria-label={t('Dimensiones del espacio de ejemplo')} onKeyDown={onKey}>
          {views.map((v, n) => (
            <button key={v.notation} ref={el => { tabs.current[n] = el; }} type="button" role="tab" id={`lp-tab-${v.notation}`} aria-selected={n === i} aria-controls="lp-panel"
              tabIndex={n === i ? 0 : -1} className={`lp-viewer__tab ${n === i ? 'is-on' : ''}`} onClick={() => pick(n)}>
              <span className="chip__dot" style={{ background: colors[v.notation] }} />{t(v.name)}
            </button>
          ))}
        </div>
      </div>
      <div className="lp-viewer__stage" id="lp-panel" role="tabpanel" aria-labelledby={`lp-tab-${cur.notation}`}>
        {views.map((v, n) => {
          const url = imgs[v.view.id];
          return url
            ? <img key={v.view.id} src={url} alt={n === i ? t('Vista «{name}» del espacio de ejemplo', { name: v.view.name }) : ''} aria-hidden={n !== i} className={n === i ? 'is-on' : ''} draggable={false} />
            : n === i ? <span key={v.view.id} className="skel lp-viewer__skel" aria-hidden="true" /> : null;
        })}
      </div>
      <figcaption className="lp-viewer__cap">
        <Icon name="diamond" size={14} />
        <span>{t('Cinco vistas de un mismo modelo. Comparten elementos y trazas: no son copias que haya que mantener a mano.')}</span>
      </figcaption>
    </figure>
  );
}
