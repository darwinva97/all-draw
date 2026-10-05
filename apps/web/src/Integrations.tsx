/**
 * Pestañas «Insertar» y «Webhooks» del diálogo Compartir (sólo el dueño del espacio):
 *  - Insertar: enlace de inserción por vista (`emb_…`), tema, tamaño, código `<iframe>`, URL de la imagen SVG y Markdown
 *    para copiar, y revocar. Ver `docs/manual/compartir-y-colaborar.md#insertar`.
 *  - Webhooks: registrar URLs con sus eventos, el secreto de la firma (se ve una vez), «Probar» y las últimas 20 entregas
 *    (estado y latencia). Ver `docs/manual/agentes-y-api.md#webhooks`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon, confirmDialog, toast, useCollection, useEditor } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';
import { api, type EmbedLink, type WebhookEvent, type WebhookFormat, type WebhookInfo } from './api';
import { reportError } from './notify';
import './integrations.css';

export type ShareTab = 'links' | 'embed' | 'webhooks';

/** Pestañas accesibles (WAI-ARIA tabs, activación automática, ← → Inicio Fin). */
export function ShareTabList({ value, onChange, base }: { value: ShareTab; onChange: (t: ShareTab) => void; base: string }) {
  const t = useT();
  const tabs: { id: ShareTab; label: string }[] = [{ id: 'links', label: t('Enlaces') }, { id: 'embed', label: t('Insertar') }, { id: 'webhooks', label: t('Webhooks') }];
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const i = tabs.findIndex(x => x.id === value);
    const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    onChange(tabs[j]!.id);
    ref.current?.ownerDocument.getElementById(`${base}-tab-${tabs[j]!.id}`)?.focus();
  };
  return (
    <div ref={ref} className="ad-tabs integr__tabs" role="tablist" aria-label={t('Compartir')} onKeyDown={onKeyDown}>
      {tabs.map(tb => <button key={tb.id} type="button" role="tab" id={`${base}-tab-${tb.id}`} aria-selected={tb.id === value} aria-controls={`${base}-panel`}
        tabIndex={tb.id === value ? 0 : -1} className={tb.id === value ? 'is-active' : ''} onClick={() => onChange(tb.id)}>{tb.label}</button>)}
    </div>
  );
}

async function copyText(text: string, ok: string, t: ReturnType<typeof useT>) {
  try { await navigator.clipboard?.writeText(text); toast.success(ok); }
  catch { toast.info(t('No se pudo copiar; selecciónalo y cópialo a mano'), { duration: 8000 }); }
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---------------------------------------------------------------- Insertar
type Theme = 'auto' | 'light' | 'dark';
const SIZES: { id: string; w: number; h: number }[] = [{ id: 's', w: 600, h: 400 }, { id: 'm', w: 800, h: 500 }, { id: 'l', w: 1000, h: 700 }];

export function EmbedPanel({ id }: { id: string }) {
  const t = useT();
  const views = useCollection('views');
  const { viewId: current } = useEditor();
  const [chosen, setViewId] = useState<string>(current ?? '');
  /** La elegida si aún existe; si no, la primera. */
  const viewId = views.some(v => v.id === chosen) ? chosen : views[0]?.id ?? '';
  const [theme, setTheme] = useState<Theme>('auto');
  const [w, setW] = useState(800); const [h, setH] = useState(500);
  const [embeds, setEmbeds] = useState<EmbedLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => api.embeds(id).then(setEmbeds).catch(e => { setEmbeds([]); reportError(e, { title: t('No se pudieron cargar los enlaces de inserción') }); }), [id, t]);
  useEffect(() => { void refresh(); }, [refresh]);
  const viewName = (vid: string) => views.find(v => v.id === vid)?.name || t('Vista sin nombre');
  /** El enlace más reciente de la vista elegida. */
  const embed = useMemo(() => [...(embeds ?? [])].reverse().find(e => e.viewId === viewId) ?? null, [embeds, viewId]);
  const q = theme === 'auto' ? '' : `&theme=${theme}`;
  const pageUrl = embed ? `${embed.url}${q}` : '';
  const imgUrl = embed ? `${embed.svgUrl}${q}` : '';
  const iframe = embed ? `<iframe src="${escAttr(pageUrl)}" width="${w}" height="${h}" style="border:0;max-width:100%" loading="lazy" allowfullscreen title="${escAttr(viewName(viewId))}"></iframe>` : '';
  const markdown = embed ? `![${viewName(viewId).replace(/[[\]]/g, '')}](${imgUrl})` : '';
  const create = async () => {
    setBusy(true);
    try { await api.createEmbed(id, viewId); await refresh(); toast.success(t('Enlace de inserción creado')); }
    catch (e) { reportError(e, { title: t('No se pudo crear el enlace de inserción'), retry: () => void create() }); }
    finally { setBusy(false); }
  };
  const revoke = async (e: EmbedLink) => {
    if (!(await confirmDialog({ title: t('¿Revocar este enlace de inserción?'), message: t('Las páginas que lo incrustan dejarán de mostrar el diagrama (en menos de un minuto).'), confirmLabel: t('Revocar'), danger: true }))) return;
    try { await api.deleteEmbed(id, e.token); toast.success(t('Enlace de inserción revocado')); await refresh(); } catch (x) { reportError(x, { title: t('No se pudo revocar el enlace') }); }
  };
  if (!views.length) return <p className="list-empty">{t('Este espacio todavía no tiene vistas que insertar.')}</p>;
  return (
    <div className="integr">
      <p className="modal__lead">{t('Inserta una vista en Confluence, Notion, Jira o cualquier web. Se ve en solo lectura y se actualiza sola cuando cambias el diagrama. El enlace solo da acceso a esa vista.')}</p>
      <div className="integr__grid">
        <label className="field"><span>{t('Vista')}</span>
          <select aria-label={t('Vista')} value={viewId} onChange={e => setViewId(e.target.value)}>{views.map(v => <option key={v.id} value={v.id}>{v.name || t('Vista sin nombre')}</option>)}</select>
        </label>
        <label className="field"><span>{t('Tema')}</span>
          <select aria-label={t('Tema')} value={theme} onChange={e => setTheme(e.target.value as Theme)}>
            <option value="auto">{t('Automático (el del sistema)')}</option><option value="light">{t('Claro')}</option><option value="dark">{t('Oscuro')}</option>
          </select>
        </label>
        <label className="field"><span>{t('Tamaño')}</span>
          <select aria-label={t('Tamaño')} value={SIZES.find(s => s.w === w && s.h === h)?.id ?? 'custom'} onChange={e => { const s = SIZES.find(x => x.id === e.target.value); if (s) { setW(s.w); setH(s.h); } }}>
            <option value="s">{t('Pequeño (600 × 400)')}</option><option value="m">{t('Mediano (800 × 500)')}</option><option value="l">{t('Grande (1000 × 700)')}</option><option value="custom" disabled>{t('Personalizado')}</option>
          </select>
        </label>
        <div className="integr__size">
          <label className="field"><span>{t('Ancho')}</span><input type="number" aria-label={t('Ancho')} min={200} max={2000} value={w} onChange={e => setW(Math.max(200, Math.min(2000, Number(e.target.value) || 800)))} /></label>
          <label className="field"><span>{t('Alto')}</span><input type="number" aria-label={t('Alto')} min={150} max={2000} value={h} onChange={e => setH(Math.max(150, Math.min(2000, Number(e.target.value) || 500)))} /></label>
        </div>
      </div>
      {!embed && embeds !== null && <div className="row"><button className="btn btn--primary" disabled={busy || !viewId} onClick={() => void create()}><Icon name="share" size={14} />{t('Crear enlace de inserción')}</button></div>}
      {embed && <>
        <label className="field"><span>{t('Código para insertar (iframe)')}</span><textarea aria-label={t('Código para insertar (iframe)')} className="integr__code" readOnly rows={3} value={iframe} onFocus={e => e.currentTarget.select()} /></label>
        <div className="row">
          <button className="btn btn--primary btn--sm" onClick={() => void copyText(iframe, t('Código copiado'), t)}><Icon name="copy" size={14} />{t('Copiar código')}</button>
          <button className="btn btn--sm" onClick={() => void copyText(pageUrl, t('Enlace copiado al portapapeles'), t)}><Icon name="copy" size={14} />{t('Copiar enlace (Notion, oEmbed)')}</button>
          <a className="btn btn--ghost btn--sm" href={pageUrl} target="_blank" rel="noopener noreferrer">{t('Vista previa')}</a>
        </div>
        <label className="field"><span>{t('Imagen SVG (GitHub, Markdown, <img>)')}</span><input aria-label={t('Imagen SVG (GitHub, Markdown, <img>)')} className="integr__code" readOnly value={imgUrl} onFocus={e => e.currentTarget.select()} /></label>
        <div className="row">
          <button className="btn btn--sm" onClick={() => void copyText(imgUrl, t('URL de la imagen copiada'), t)}><Icon name="copy" size={14} />{t('Copiar URL de la imagen')}</button>
          <button className="btn btn--sm" onClick={() => void copyText(markdown, t('Markdown copiado'), t)}><Icon name="copy" size={14} />{t('Copiar Markdown')}</button>
        </div>
      </>}
      <h3 className="integr__h">{t('Enlaces de inserción')}</h3>
      <ul className="share__list" aria-label={t('Enlaces de inserción')} aria-busy={embeds === null}>
        {embeds === null && <li className="list-empty">{t('Cargando…')}</li>}
        {embeds?.length === 0 && <li className="list-empty">{t('Todavía no hay enlaces de inserción.')}</li>}
        {embeds?.map(e => <li key={e.token}>
          <span className="share__what"><Icon name="eye" size={14} />{viewName(e.viewId)} <small>{new Date(e.createdAt).toLocaleString()}</small></span>
          <button className="btn btn--ghost btn--sm" aria-label={t('Revocar el enlace de inserción de {view}', { view: viewName(e.viewId) })} onClick={() => void revoke(e)}>{t('Revocar')}</button>
        </li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Webhooks
const EVENTS: WebhookEvent[] = ['workspace.changed', 'comment.created', 'snapshot.created', 'snapshot.restored', 'member.added'];

export function WebhooksPanel({ id }: { id: string }) {
  const t = useT();
  const eventLabel = (e: WebhookEvent | 'ping') => ({
    'workspace.changed': t('Cambios en el espacio (resumen cada 30 s)'), 'comment.created': t('Comentario nuevo'), 'snapshot.created': t('Versión guardada'),
    'snapshot.restored': t('Versión restaurada'), 'member.added': t('Miembro añadido'), ping: t('Prueba'),
  } as Record<string, string>)[e] ?? e;
  const formatLabel = (f: WebhookFormat | 'auto') => ({ auto: t('Automático (según la URL)'), json: 'JSON', slack: 'Slack', teams: 'Microsoft Teams', discord: 'Discord' } as Record<string, string>)[f] ?? f;
  const [hooks, setHooks] = useState<WebhookInfo[] | null>(null);
  const [meta, setMeta] = useState<{ max: number; enabled: boolean }>({ max: 10, enabled: true });
  const [url, setUrl] = useState(''); const [format, setFormat] = useState<WebhookFormat | 'auto'>('auto');
  const [events, setEvents] = useState<WebhookEvent[]>(['workspace.changed', 'comment.created']);
  const [secret, setSecret] = useState<{ hook: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const refresh = useCallback(() => api.webhooks(id).then(r => { setHooks(r.webhooks); setMeta({ max: r.max, enabled: r.enabled }); }).catch(e => { setHooks([]); reportError(e, { title: t('No se pudieron cargar los webhooks') }); }), [id, t]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Mientras haya reintentos en curso, se refresca el registro cada 5 s.
  const pending = !!hooks?.some(h => h.deliveries.some(d => d.pending));
  useEffect(() => { if (!pending) return; const h = setInterval(() => void refresh(), 5000); return () => clearInterval(h); }, [pending, refresh]);
  const toggle = (e: WebhookEvent) => setEvents(cur => (cur.includes(e) ? cur.filter(x => x !== e) : [...cur, e]));
  const create = async (ev: React.FormEvent) => {
    ev.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api.createWebhook(id, { url: url.trim(), events, format });
      setSecret({ hook: r.webhook.id, value: r.secret }); setUrl('');
      toast.success(t('Webhook creado'));
      await refresh();
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  const test = async (h: WebhookInfo) => {
    setTesting(h.id);
    try {
      const d = await api.testWebhook(id, h.id);
      if (d.ok) toast.success(t('Prueba entregada: HTTP {status} en {ms} ms', { status: d.status, ms: d.ms }));
      else toast.error(t('La prueba falló'), { description: d.error ?? `HTTP ${d.status}` });
      await refresh();
    } catch (x) { reportError(x, { title: t('No se pudo probar el webhook') }); }
    finally { setTesting(null); }
  };
  const remove = async (h: WebhookInfo) => {
    if (!(await confirmDialog({ title: t('¿Borrar este webhook?'), message: t('Dejará de recibir avisos de este espacio.'), confirmLabel: t('Borrar'), danger: true }))) return;
    try { await api.deleteWebhook(id, h.id); toast.success(t('Webhook borrado')); if (secret?.hook === h.id) setSecret(null); await refresh(); } catch (x) { reportError(x, { title: t('No se pudo borrar el webhook') }); }
  };
  const full = (hooks?.length ?? 0) >= meta.max;
  return (
    <div className="integr">
      <p className="modal__lead">{t('Avisa a otra aplicación (Slack, Microsoft Teams, Discord o tu propio servicio) cuando pase algo en este espacio. Cada envío va firmado con HMAC-SHA256 en la cabecera X-AllDraw-Signature.')}</p>
      {!meta.enabled && <p className="integr__note" role="note">{t('Esta instalación no envía webhooks (copia de respaldo de solo lectura).')}</p>}
      <form className="integr__form" onSubmit={create}>
        <label className="field"><span>{t('URL (https://)')}</span><input type="url" aria-label={t('URL (https://)')} required inputMode="url" placeholder="https://hooks.slack.com/services/…" maxLength={2000} value={url} onChange={e => setUrl(e.target.value)} /></label>
        <label className="field"><span>{t('Formato')}</span>
          <select aria-label={t('Formato')} value={format} onChange={e => setFormat(e.target.value as WebhookFormat | 'auto')}>{(['auto', 'slack', 'teams', 'discord', 'json'] as const).map(f => <option key={f} value={f}>{formatLabel(f)}</option>)}</select>
        </label>
        <fieldset className="integr__events"><legend>{t('Eventos')}</legend>
          {EVENTS.map(e => <label key={e} className="check"><input type="checkbox" checked={events.includes(e)} onChange={() => toggle(e)} /> {eventLabel(e)}</label>)}
        </fieldset>
        <div className="row">
          <button className="btn btn--primary" type="submit" disabled={busy || full || !url.trim() || events.length === 0}>{t('Añadir webhook')}</button>
          {full && <small>{t('Máximo {n} webhooks por espacio', { n: meta.max })}</small>}
        </div>
        <p className="err" role="alert" aria-live="assertive">{err}</p>
      </form>
      {secret && <div className="integr__secret" role="status">
        <p>{t('Secreto de la firma (cópialo ahora, no se vuelve a mostrar):')}</p>
        <code>{secret.value}</code>
        <button className="btn btn--sm" onClick={() => void copyText(secret.value, t('Secreto copiado'), t)}><Icon name="copy" size={14} />{t('Copiar')}</button>
      </div>}
      <ul className="share__list integr__hooks" aria-label={t('Webhooks')} aria-busy={hooks === null}>
        {hooks === null && <li className="list-empty">{t('Cargando…')}</li>}
        {hooks?.length === 0 && <li className="list-empty">{t('Todavía no hay webhooks.')}</li>}
        {hooks?.map(h => {
          const last = h.deliveries[0];
          return <li key={h.id} className="integr__hook">
            <div className="integr__hookhead">
              <span className="share__what" title={h.url}><Icon name="share" size={14} /><span className="integr__url">{h.url}</span> <small>{formatLabel(h.format)}</small></span>
              <button className="btn btn--sm" disabled={testing === h.id || !meta.enabled} onClick={() => void test(h)}>{testing === h.id ? t('Probando…') : t('Probar')}</button>
              <button className="btn btn--ghost btn--sm" aria-label={t('Borrar el webhook {url}', { url: h.url })} onClick={() => void remove(h)}>{t('Borrar')}</button>
            </div>
            <small className="integr__evlist">{h.events.map(eventLabel).join(' · ')}</small>
            {last && <small className={`integr__last ${last.ok ? 'is-ok' : last.pending ? 'is-wait' : 'is-ko'}`}>
              {last.ok ? t('Última entrega: HTTP {status} en {ms} ms', { status: last.status, ms: last.ms }) : last.pending ? t('Reintentando… (intento {n})', { n: last.attempts }) : t('Último envío fallido: {error}', { error: last.error ?? `HTTP ${last.status}` })}
            </small>}
            {h.deliveries.length > 0 && <details className="integr__log">
              <summary>{t('Últimas entregas ({n})', { n: h.deliveries.length })}</summary>
              <table>
                <thead><tr><th>{t('Cuándo')}</th><th>{t('Evento')}</th><th>{t('Estado')}</th><th>{t('Latencia')}</th><th>{t('Intentos')}</th></tr></thead>
                <tbody>{h.deliveries.map(d => <tr key={d.id} className={d.ok ? 'is-ok' : d.pending ? 'is-wait' : 'is-ko'} title={d.error ?? ''}>
                  <td>{new Date(d.at).toLocaleString()}</td><td>{eventLabel(d.event)}</td><td>{d.status || '—'}{d.error && !d.ok ? ` · ${d.error.slice(0, 60)}` : ''}</td><td>{d.ms} ms</td><td>{d.attempts}{d.pending ? '…' : ''}</td>
                </tr>)}</tbody>
              </table>
            </details>}
          </li>;
        })}
      </ul>
    </div>
  );
}
