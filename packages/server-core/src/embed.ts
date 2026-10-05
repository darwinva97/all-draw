/**
 * Insertar diagramas en otras webs (Confluence, Notion, Jira, GitHub…), igual en Node y en Workers:
 *
 *   GET /embed/<espacio>/<vista>?token=…&theme=light|dark|auto   página HTML ligera y autocontenida con el SVG, zoom,
 *                                                               desplazamiento, «Abrir en all-draw» y sondeo cada 30 s
 *   GET /embed/<espacio>/<vista>.svg?token=…&theme=…            sólo el SVG (para `<img>` o Markdown), con ETag
 *   GET /api/oembed?url=<una de las anteriores>&format=json      oEmbed (`type: rich`, un `<iframe>`), ver `api-integrations.ts`
 *
 * El `token` es un enlace de inserción (`emb_…`, de lectura y sólo para esa vista; se crean con
 * `POST /api/workspaces/:id/embeds`) o un enlace compartido normal (`lnk_…`) del espacio. Los de inserción no valen para la
 * API ni para el WebSocket (`resolveToken` los ignora). Estas rutas son las únicas que otras webs pueden incrustar
 * (`frame-ancestors *`); su CSP no deja cargar nada de fuera salvo imágenes `https:`.
 */
import { THEME_VARS } from '@all-draw/io';
import { EMBED_PREFIX, LINK_PREFIX, SAFE_ID, toHex } from './auth';
import { cspNonce, embedContentSecurityPolicy } from './headers';
import type { DocHost } from './host';
import type { ShareLink, WorkspaceStore } from './store/types';

export type EmbedTheme = 'light' | 'dark' | 'auto';
/** Sondeo por defecto de la página de inserción (segundos); `?poll=` lo cambia entre 5 y 3600. */
export const EMBED_POLL_S = 30;

export interface EmbedDeps {
  store: Pick<WorkspaceStore, 'getWorkspace' | 'resolveShareLink' | 'listShareLinks'>;
  docs: Pick<DocHost, 'renderSvg'>;
  /** `PUBLIC_URL`; si falta, el origen de la petición (respetando `x-forwarded-*`). */
  publicUrl?: string | null;
  /** Copia de respaldo: se avisa en la página de que es la copia. */
  standby?: boolean;
}

/** `/embed/<espacio>/<vista>[.svg]` → partes; `null` si no es una ruta de inserción. */
export function parseEmbedPath(pathname: string): { workspaceId: string; viewId: string; svg: boolean } | null {
  const m = /^\/embed\/([^/]+)\/([^/]+?)(\.svg)?\/?$/.exec(pathname);
  if (!m) return null;
  let workspaceId: string, viewId: string;
  try { workspaceId = decodeURIComponent(m[1]!); viewId = decodeURIComponent(m[2]!); } catch { return null; }
  if (!SAFE_ID.test(workspaceId) || !SAFE_ID.test(viewId)) return null;
  return { workspaceId, viewId, svg: !!m[3] };
}

export const parseEmbedTheme = (v: string | null | undefined): EmbedTheme => (v === 'light' || v === 'dark' ? v : 'auto');
const svgTheme = (t: EmbedTheme) => (t === 'auto' ? 'dual' as const : t);

/**
 * ¿Vale este token para insertar esta vista? Enlaces de inserción de esa vista (o sin vista) y enlaces compartidos del
 * espacio, sin caducar. Devuelve el enlace o el motivo.
 */
export async function authorizeEmbed(store: EmbedDeps['store'], token: string | null, workspaceId: string, viewId: string): Promise<{ link: ShareLink } | { reason: 'missing' | 'expired' | 'invalid' }> {
  if (!token) return { reason: 'missing' };
  if (!token.startsWith(EMBED_PREFIX) && !token.startsWith(LINK_PREFIX)) return { reason: 'invalid' };
  const link = await store.resolveShareLink(token);
  if (!link) {
    const stale = (await store.listShareLinks(workspaceId)).find(l => l.token === token);
    return { reason: stale?.expiresAt && Date.parse(stale.expiresAt) <= Date.now() ? 'expired' : 'invalid' };
  }
  if (link.workspaceId !== workspaceId || (link.viewId && link.viewId !== viewId)) return { reason: 'invalid' };
  return { link };
}

/** Origen público para construir enlaces (sin barra final). */
export function requestBase(req: Request, publicUrl?: string | null): string {
  if (publicUrl) return publicUrl.replace(/\/+$/, '');
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || u.host;
  return `${proto}://${host}`;
}

/** URLs de inserción de una vista con un token (sin `theme`: la interfaz lo añade). */
export function embedUrls(base: string, workspaceId: string, viewId: string, token: string) {
  const path = `${base.replace(/\/+$/, '')}/embed/${encodeURIComponent(workspaceId)}/${encodeURIComponent(viewId)}`;
  const q = `?token=${encodeURIComponent(token)}`;
  return { url: `${path}${q}`, svgUrl: `${path}.svg${q}` };
}

/** Ancho y alto del SVG (atributos `width`/`height` o `viewBox`). */
export function svgSize(svg: string): { width: number; height: number } {
  const head = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const num = (a: string) => Number(new RegExp(`\\s${a}="([\\d.]+)"`).exec(head)?.[1] ?? NaN);
  let width = num('width'), height = num('height');
  if (!(width > 0 && height > 0)) {
    const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(head);
    width = Number(vb?.[1] ?? 800); height = Number(vb?.[2] ?? 600);
  }
  return { width: Math.round(width) || 800, height: Math.round(height) || 600 };
}
/** Nombre de la vista (el `<title>` accesible del SVG, ya escapado como XML/HTML). */
export const svgTitle = (svg: string): string => /<title\b[^>]*>([^<]*)<\/title>/.exec(svg)?.[1] ?? '';

/** Tamaño del `<iframe>` para un SVG: hasta 800 de ancho, alto proporcional (200–600), respetando los máximos de oEmbed. */
export function iframeSize(svg: { width: number; height: number }, max: { width?: number; height?: number } = {}): { width: number; height: number } {
  const maxW = Math.max(200, Math.min(max.width ?? 800, 2000)), maxH = Math.max(150, Math.min(max.height ?? 600, 2000));
  const width = Math.min(maxW, Math.max(320, svg.width + 32));
  const height = Math.min(maxH, Math.max(200, Math.round(width * (svg.height / Math.max(1, svg.width))) + 16));
  return { width, height };
}

export async function etagOf(text: string): Promise<string> {
  return `"${toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 32)}"`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON seguro dentro de `<script>` (sin `</script>` ni `<!--`). */
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const vars = (t: 'light' | 'dark') => Object.entries(THEME_VARS[t]).map(([k, v]) => `${k}:${v}`).join(';');

type Lang = 'es' | 'en';
const TEXT = {
  es: { open: 'Abrir en all-draw', zoomIn: 'Acercar', zoomOut: 'Alejar', fit: 'Ajustar a la ventana', gone: 'Este diagrama ya no está disponible: el enlace se ha revocado o ha caducado.', expired: 'Este enlace de inserción ha caducado.', invalid: 'Este enlace de inserción no es válido o se ha revocado.', missing: 'Falta el token del enlace de inserción.', notFound: 'El diagrama no existe.', standby: 'Copia de respaldo de solo lectura', hint: 'Arrastra para moverte; Ctrl + rueda para hacer zoom' },
  en: { open: 'Open in all-draw', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to window', gone: 'This diagram is no longer available: the link was revoked or has expired.', expired: 'This embed link has expired.', invalid: 'This embed link is not valid or has been revoked.', missing: 'The embed link token is missing.', notFound: 'The diagram does not exist.', standby: 'Read-only backup copy', hint: 'Drag to move; Ctrl + wheel to zoom' },
} as const;
export function embedLang(req: Request): Lang {
  const q = new URL(req.url).searchParams.get('lang');
  if (q === 'en' || q === 'es') return q;
  return /^en\b/i.test(req.headers.get('accept-language') ?? '') ? 'en' : 'es';
}

function pageCss(theme: EmbedTheme): string {
  const root = theme === 'dark' ? vars('dark') : vars('light');
  return [
    `:root{${root};color-scheme:${theme === 'auto' ? 'light dark' : theme}}`,
    theme === 'auto' ? `@media (prefers-color-scheme: dark){:root{${vars('dark')}}}` : '',
    'html,body{margin:0;height:100%;overflow:hidden;background:var(--ad-bg);color:var(--ad-text);font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.vp{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none;outline:none}',
    '.vp.is-drag{cursor:grabbing}',
    '.cv{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}',
    '.cv svg{display:block;max-width:none}',
    '.bar{position:absolute;right:8px;bottom:8px;display:flex;gap:2px;align-items:center;background:var(--ad-panel);border:1px solid var(--ad-border);border-radius:8px;padding:3px;box-shadow:0 1px 4px rgba(0,0,0,.12)}',
    '.bar button,.bar a{font:inherit;color:var(--ad-text);background:none;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;text-decoration:none;min-width:28px;line-height:20px}',
    '.bar button:hover,.bar a:hover,.bar button:focus-visible,.bar a:focus-visible{background:var(--ad-bg);outline:none;color:var(--ad-accent)}',
    '.bar a{font-weight:600}',
    '.msg{position:absolute;left:8px;top:8px;right:8px;background:var(--ad-panel);border:1px solid var(--ad-border);border-radius:8px;padding:8px 10px}',
    '.tag{position:absolute;left:8px;bottom:8px;font-size:11px;color:var(--ad-muted)}',
    '@media (prefers-reduced-motion: no-preference){.cv.is-anim{transition:transform .18s ease-out}}',
  ].filter(Boolean).join('\n');
}

export interface EmbedPageOpts {
  svg: string; etag: string; theme: EmbedTheme; lang: Lang; nonce: string;
  title: string; workspaceName: string; openUrl: string; oembedUrl: string; pollS: number; standby?: boolean;
}

/** Página de inserción: el SVG en línea (se ve sin JavaScript) y un script pequeño para zoom, desplazamiento y sondeo. */
export function renderEmbedPage(o: EmbedPageOpts): string {
  const t = TEXT[o.lang];
  const fullTitle = `${o.title}${o.workspaceName ? ` · ${esc(o.workspaceName)}` : ''} — all-draw`;
  const script = `(()=>{const T=${js({ gone: t.gone, etag: o.etag, poll: o.pollS })};
const vp=document.getElementById('vp'),cv=document.getElementById('cv'),msg=document.getElementById('msg');
let s=1,x=0,y=0,touched=false,etag=T.etag,drag=null;
const dims=()=>{const g=cv.querySelector('svg');if(!g)return{w:1,h:1};const vb=g.viewBox&&g.viewBox.baseVal;return{w:+g.getAttribute('width')||(vb&&vb.width)||1,h:+g.getAttribute('height')||(vb&&vb.height)||1}};
const apply=(anim)=>{cv.classList.toggle('is-anim',!!anim);cv.style.transform='translate('+x+'px,'+y+'px) scale('+s+')'};
const fit=(anim)=>{const r=vp.getBoundingClientRect(),d=dims();s=Math.min(r.width/d.w,r.height/d.h,2)*0.96||1;x=(r.width-d.w*s)/2;y=(r.height-d.h*s)/2;apply(anim)};
const zoom=(f,cx,cy,anim)=>{const r=vp.getBoundingClientRect();if(cx==null){cx=r.width/2;cy=r.height/2}const n=Math.min(8,Math.max(0.05,s*f));x=cx-(cx-x)*n/s;y=cy-(cy-y)*n/s;s=n;touched=true;apply(anim)};
document.querySelectorAll('[data-z]').forEach(b=>b.addEventListener('click',()=>{const z=b.getAttribute('data-z');if(z==='in')zoom(1.25,null,null,true);else if(z==='out')zoom(0.8,null,null,true);else{touched=false;fit(true)}}));
vp.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const r=vp.getBoundingClientRect();zoom(Math.exp(-e.deltaY*0.002),e.clientX-r.left,e.clientY-r.top)},{passive:false});
vp.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={px:e.clientX,py:e.clientY,x,y};vp.setPointerCapture(e.pointerId);vp.classList.add('is-drag')});
vp.addEventListener('pointermove',e=>{if(!drag)return;x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;touched=true;apply()});
const end=()=>{drag=null;vp.classList.remove('is-drag')};vp.addEventListener('pointerup',end);vp.addEventListener('pointercancel',end);
vp.addEventListener('dblclick',()=>{touched=false;fit(true)});
vp.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')zoom(1.25,null,null,true);else if(e.key==='-')zoom(0.8,null,null,true);else if(e.key==='0'){touched=false;fit(true)}else if(e.key.startsWith('Arrow')){const d=40;if(e.key==='ArrowLeft')x+=d;if(e.key==='ArrowRight')x-=d;if(e.key==='ArrowUp')y+=d;if(e.key==='ArrowDown')y-=d;touched=true;apply(true)}else return;e.preventDefault()});
addEventListener('resize',()=>{if(!touched)fit()});
const src=location.pathname.replace(/\\/$/,'')+'.svg'+location.search;
let busy=false;
const poll=async()=>{if(document.hidden||busy)return;busy=true;try{const r=await fetch(src,{headers:etag?{'if-none-match':etag}:{},cache:'no-store',credentials:'omit'});if(r.status===200){const keep=touched;cv.innerHTML=await r.text();etag=r.headers.get('etag')||'';msg.hidden=true;if(!keep)fit()}else if(r.status===401||r.status===404){msg.textContent=T.gone;msg.hidden=false}}catch(e){}finally{busy=false}};
setInterval(poll,T.poll*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
fit();window.__alldrawEmbed={poll,fit,zoom,state:()=>({s,x,y,etag})};
})();`;
  return `<!doctype html>
<html lang="${o.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${fullTitle}</title>
<link rel="alternate" type="application/json+oembed" href="${esc(o.oembedUrl)}" title="${esc(o.title)}">
<style>${pageCss(o.theme)}</style>
</head>
<body>
<div id="vp" class="vp" tabindex="0" role="figure" aria-label="${esc(o.title)}" title="${esc(t.hint)}"><div id="cv" class="cv">${o.svg}</div></div>
<p id="msg" class="msg" role="status" hidden></p>
${o.standby ? `<p class="tag">${esc(t.standby)}</p>` : ''}
<div class="bar" role="toolbar" aria-label="all-draw">
<button type="button" data-z="out" title="${esc(t.zoomOut)}" aria-label="${esc(t.zoomOut)}">−</button>
<button type="button" data-z="fit" title="${esc(t.fit)}" aria-label="${esc(t.fit)}">⤢</button>
<button type="button" data-z="in" title="${esc(t.zoomIn)}" aria-label="${esc(t.zoomIn)}">+</button>
<a href="${esc(o.openUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.open)} ↗</a>
</div>
<script nonce="${o.nonce}">${script}</script>
</body>
</html>`;
}

/** Cabeceras comunes de las respuestas de inserción (la CSP con el `nonce` del script de la página). */
export function embedHeaders(contentType: string, nonce?: string): Record<string, string> {
  return {
    'content-type': contentType,
    'content-security-policy': embedContentSecurityPolicy(nonce),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cross-origin-resource-policy': 'cross-origin',
    'x-robots-tag': 'noindex',
  };
}

function errorPage(status: number, text: string, lang: Lang): Response {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>all-draw</title><style>${pageCss('auto')}</style></head><body><p class="msg" role="alert">${esc(text)}</p></body></html>`;
  return new Response(html, { status, headers: { ...embedHeaders('text/html; charset=utf-8'), 'cache-control': 'no-store' } });
}

/**
 * Atiende `/embed/*`; `null` si la ruta no es de inserción (el llamador sigue con lo suyo). Sólo GET y HEAD. Las respuestas
 * llevan ya sus cabeceras de seguridad (CSP propia, `frame-ancestors *`, sin `Referer`).
 */
export async function handleEmbed(req: Request, deps: EmbedDeps): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/embed/')) return null;
  const lang = embedLang(req);
  const t = TEXT[lang];
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD', ...embedHeaders('text/plain') } });
  const parts = parseEmbedPath(url.pathname);
  if (!parts) return errorPage(404, t.notFound, lang);
  const { workspaceId, viewId, svg: wantSvg } = parts;
  const ws = await deps.store.getWorkspace(workspaceId);
  if (!ws) return errorPage(404, t.notFound, lang);
  const token = url.searchParams.get('token');
  const auth = await authorizeEmbed(deps.store, token, workspaceId, viewId);
  if ('reason' in auth) return wantSvg ? new Response(t[auth.reason], { status: 401, headers: { ...embedHeaders('text/plain; charset=utf-8'), 'cache-control': 'no-store' } }) : errorPage(401, t[auth.reason], lang);
  const theme = parseEmbedTheme(url.searchParams.get('theme'));
  const svg = await deps.docs.renderSvg(workspaceId, viewId, { theme: svgTheme(theme) });
  if (svg === null) return wantSvg ? new Response(t.notFound, { status: 404, headers: embedHeaders('text/plain; charset=utf-8') }) : errorPage(404, t.notFound, lang);
  const etag = await etagOf(svg);
  if (wantSvg) {
    const common = { ...embedHeaders('image/svg+xml; charset=utf-8'), etag, 'cache-control': 'private, no-cache', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag' };
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: common });
    return new Response(req.method === 'HEAD' ? null : svg, { status: 200, headers: common });
  }
  const base = requestBase(req, deps.publicUrl);
  const pageUrl = `${base}${url.pathname}${url.search}`;
  const openUrl = `${base}/#/s/${encodeURIComponent(workspaceId)}/v/${encodeURIComponent(viewId)}${auth.link.token.startsWith(LINK_PREFIX) ? `?token=${encodeURIComponent(auth.link.token)}` : ''}`;
  const poll = Number(url.searchParams.get('poll'));
  const nonce = cspNonce();
  const html = renderEmbedPage({
    svg, etag, theme, lang, nonce, title: svgTitle(svg) || viewId, workspaceName: ws.name, openUrl,
    oembedUrl: `${base}/api/oembed?format=json&url=${encodeURIComponent(pageUrl)}`,
    pollS: Number.isFinite(poll) && poll >= 5 && poll <= 3600 ? Math.round(poll) : EMBED_POLL_S, ...(deps.standby ? { standby: true } : {}),
  });
  return new Response(req.method === 'HEAD' ? null : html, { status: 200, headers: { ...embedHeaders('text/html; charset=utf-8', nonce), 'cache-control': 'no-store' } });
}

/** Respuesta oEmbed (`type: rich`) para una URL de inserción de este servidor; `null` si no lo es o el token no vale. */
export async function oembedFor(deps: EmbedDeps, raw: string, base: string, max: { width?: number; height?: number } = {}): Promise<Record<string, unknown> | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.origin !== new URL(base).origin) return null;
  const parts = parseEmbedPath(u.pathname);
  if (!parts) return null;
  const ws = await deps.store.getWorkspace(parts.workspaceId);
  if (!ws) return null;
  const token = u.searchParams.get('token');
  const auth = await authorizeEmbed(deps.store, token, parts.workspaceId, parts.viewId);
  if ('reason' in auth) return null;
  const theme = parseEmbedTheme(u.searchParams.get('theme'));
  const svg = await deps.docs.renderSvg(parts.workspaceId, parts.viewId, { theme: svgTheme(theme) });
  if (svg === null) return null;
  const size = iframeSize(svgSize(svg), max);
  const page = `${base}/embed/${encodeURIComponent(parts.workspaceId)}/${encodeURIComponent(parts.viewId)}?${new URLSearchParams({ token: token!, ...(theme !== 'auto' ? { theme } : {}) })}`;
  const title = svgTitle(svg).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') || parts.viewId;
  return {
    version: '1.0', type: 'rich', provider_name: 'all-draw', provider_url: base, title: `${title} · ${ws.name}`,
    width: size.width, height: size.height, cache_age: 300,
    html: `<iframe src="${esc(page)}" width="${size.width}" height="${size.height}" style="border:0;max-width:100%" loading="lazy" allowfullscreen title="${esc(title)}"></iframe>`,
  };
}
