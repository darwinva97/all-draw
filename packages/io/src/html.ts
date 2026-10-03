/**
 * HTML **autocontenido** con todas las vistas del workspace como SVG (`renderSvg`), índice
 * lateral, navegación por `detailViewId` (clic en un nodo con vista de detalle) y lista
 * "aparece en" por elemento. Sin URLs externas: CSS y JS van inline y no se cargan fuentes remotas.
 * Tema claro/oscuro con el `dual` de los SVG y un conmutador manual.
 * Con `comments` (por defecto), cada vista muestra sus hilos de comentarios (abiertos y resueltos) en un panel
 * lateral y marcadores numerados sobre lo comentado.
 */
import { indexOf, threadsOfView, viewsOfElement, type CommentAnchor, type CommentThread, type NotationRegistry, type Store, type View } from '@all-draw/core';
import { escapeXml, renderSvg, THEME_VARS, type SvgMarker, type SvgTheme } from './svg';

export interface HtmlOptions {
  title?: string;
  /** Tema inicial; `dual` (por defecto) sigue al sistema y deja conmutar. */
  theme?: SvgTheme;
  fontFamily?: string;
  /** Vista inicial; por defecto `meta.currentViewId` o la primera. */
  initialViewId?: string;
  /** Solo estas vistas (por defecto todas). */
  viewIds?: string[];
  /** Hilos de comentarios de cada vista (panel lateral y marcadores numerados). Por defecto, sí. */
  comments?: boolean;
}

const esc = escapeXml;
const vars = (t: 'light' | 'dark') => Object.entries(THEME_VARS[t]).map(([k, v]) => `${k}:${v}`).join(';');

function css(fontFamily: string): string {
  return `
:root{${vars('light')};--ad-side:260px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars('dark')}}}
:root[data-theme="dark"]{${vars('dark')}}
:root[data-theme="dark"] svg.ad-svg{${vars('dark')}}
:root[data-theme="light"] svg.ad-svg{${vars('light')}}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font:13px/1.4 ${fontFamily};color:var(--ad-text);background:var(--ad-bg);display:grid;grid-template-columns:var(--ad-side) 1fr;grid-template-rows:100vh}
a{color:var(--ad-accent);text-decoration:none}
a:hover{text-decoration:underline}
.ad-side{border-right:1px solid var(--ad-border);background:var(--ad-panel);overflow:auto;display:flex;flex-direction:column}
.ad-side__head{padding:12px 14px;border-bottom:1px solid var(--ad-border)}
.ad-side__head h1{font-size:15px;margin:0 0 2px}
.ad-side__head p{margin:0;color:var(--ad-muted);font-size:12px}
.ad-side__theme{display:flex;gap:4px;margin-top:8px}
.ad-btn{border:1px solid var(--ad-border);background:var(--ad-panel);color:var(--ad-text);border-radius:6px;padding:2px 8px;cursor:pointer;font:inherit;font-size:12px}
.ad-btn.is-active,.ad-btn:hover{border-color:var(--ad-accent);color:var(--ad-accent)}
.ad-index{list-style:none;margin:0;padding:6px 0}
.ad-index__group{padding:8px 14px 2px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--ad-muted)}
.ad-index__item a{display:block;padding:5px 14px;color:inherit;border-left:3px solid transparent}
.ad-index__item a:hover{background:var(--ad-bg);text-decoration:none}
.ad-index__item.is-current a{border-left-color:var(--ad-accent);font-weight:600}
.ad-index__notation{float:right;font-size:10px;padding:0 6px;border-radius:10px;color:#fff;margin-top:2px}
.ad-main{overflow:auto;padding:16px 20px}
.ad-view{display:none}
.ad-view.is-current{display:block}
.ad-view__head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.ad-view__head h2{margin:0;font-size:18px}
.ad-view__head .ad-muted{color:var(--ad-muted)}
.ad-view__doc{margin:0 0 10px;color:var(--ad-muted);max-width:80ch;white-space:pre-wrap}
.ad-view__canvas{border:1px solid var(--ad-border);border-radius:8px;background:var(--ad-bg);overflow:auto;max-height:70vh}
.ad-view__canvas svg{display:block;max-width:100%;height:auto}
.ad-view__canvas svg [data-node]{cursor:pointer}
.ad-view__canvas svg [data-node].is-focus>.ad-shape,.ad-view__canvas svg [data-node].is-focus>rect{stroke:var(--ad-accent)!important;stroke-width:2.5!important}
.ad-appears{margin-top:14px}
.ad-appears h3{font-size:13px;margin:0 0 6px}
.ad-appears table{border-collapse:collapse;font-size:12px;width:100%;max-width:900px}
.ad-appears th,.ad-appears td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--ad-border);vertical-align:top}
.ad-appears th{color:var(--ad-muted);font-weight:500}
.ad-appears tr.is-focus td{background:color-mix(in srgb, var(--ad-accent) 12%, transparent)}
.ad-appears .ad-chip{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;background:var(--ad-bg);border:1px solid var(--ad-border);color:var(--ad-muted);white-space:nowrap;margin:1px 2px 1px 0}
.ad-appears .ad-chip.is-detail{border-color:var(--ad-accent);color:var(--ad-accent)}
.ad-crumbs{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--ad-muted);margin-bottom:8px;min-height:18px}
.ad-crumbs a{color:inherit}
.ad-view__body{display:flex;gap:14px;align-items:flex-start}
.ad-view__body>.ad-view__canvas{flex:1;min-width:0}
.ad-comments{flex:none;width:300px;max-height:70vh;overflow:auto;border:1px solid var(--ad-border);border-radius:8px;background:var(--ad-panel);padding:8px}
.ad-comments h3{font-size:13px;margin:2px 4px 8px}
.ad-comments h3 small{color:var(--ad-muted);font-weight:400}
.ad-threads{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ad-thread{border:1px solid var(--ad-border);border-radius:8px;padding:8px;cursor:pointer}
.ad-thread.is-focus{border-color:var(--ad-accent);box-shadow:0 0 0 2px color-mix(in srgb, var(--ad-accent) 30%, transparent)}
.ad-thread.is-resolved{opacity:.75}
.ad-thread__head{display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px}
.ad-thread__n{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--ad-accent);color:#fff;font-weight:700;font-size:11px}
.ad-thread.is-resolved .ad-thread__n{background:var(--ad-muted)}
.ad-thread__anchor{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ad-muted)}
.ad-thread__state{font-size:11px;padding:0 6px;border-radius:10px;border:1px solid var(--ad-border);color:var(--ad-muted);white-space:nowrap}
.ad-thread.is-resolved .ad-thread__state{color:#16a34a;border-color:color-mix(in srgb, #16a34a 50%, transparent)}
.ad-cm{padding:4px 2px;border-top:1px solid var(--ad-border)}
.ad-cm:first-of-type{border-top:0}
.ad-cm__meta{font-size:11px;color:var(--ad-muted);display:flex;gap:6px;flex-wrap:wrap}
.ad-cm__meta b{color:var(--ad-text)}
.ad-cm p{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
@media (max-width:1000px){.ad-view__body{flex-direction:column}.ad-comments{width:auto;max-height:none;align-self:stretch}}
@media (max-width:720px){body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.ad-side{border-right:0;border-bottom:1px solid var(--ad-border);max-height:40vh}}
@media print{body{display:block}.ad-side{display:none}.ad-view{display:block;page-break-after:always}.ad-view__canvas{max-height:none;overflow:visible}.ad-comments{max-height:none}}
`;
}

/** JS inline: navegación por hash, clic en nodos con detalle, resaltado "aparece en", tema. */
const SCRIPT = `
(function(){
  var views = Array.prototype.slice.call(document.querySelectorAll('.ad-view'));
  var items = Array.prototype.slice.call(document.querySelectorAll('.ad-index__item'));
  var history = [];
  function show(id, push){
    var found = false;
    views.forEach(function(v){ var on = v.getAttribute('data-view') === id; v.classList.toggle('is-current', on); if (on) found = true; });
    if (!found && views[0]) { id = views[0].getAttribute('data-view'); views[0].classList.add('is-current'); }
    items.forEach(function(i){ i.classList.toggle('is-current', i.getAttribute('data-view') === id); });
    if (push !== false && history[history.length - 1] !== id) history.push(id);
    if (history.length > 20) history.shift();
    renderCrumbs();
    document.title = (document.querySelector('.ad-view.is-current h2') || {}).textContent || document.title;
  }
  function renderCrumbs(){
    var el = document.querySelector('.ad-crumbs'); if (!el) return;
    el.innerHTML = history.slice(-5).map(function(id, i, arr){
      var name = (document.querySelector('.ad-view[data-view="' + id + '"] h2') || {}).textContent || id;
      return (i < arr.length - 1) ? '<a href="#view=' + encodeURIComponent(id) + '">' + name.replace(/</g, '&lt;') + '</a><span>\\u203a</span>' : '<strong>' + name.replace(/</g, '&lt;') + '</strong>';
    }).join('');
  }
  function fromHash(){
    var m = /view=([^&]+)/.exec(location.hash);
    show(m ? decodeURIComponent(m[1]) : (document.body.getAttribute('data-initial-view') || ''), true);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  // Comentarios: marcador numerado <-> hilo del panel
  function focusThread(view, id, scroll){
    Array.prototype.forEach.call(view.querySelectorAll('.ad-thread.is-focus, .ad-marker.is-focus'), function(x){ x.classList.remove('is-focus'); });
    var th = view.querySelector('.ad-thread[data-thread="' + id + '"]');
    if (th) { th.classList.add('is-focus'); if (scroll) th.scrollIntoView({ block: 'nearest' }); }
    Array.prototype.forEach.call(view.querySelectorAll('.ad-marker[data-marker="' + id + '"]'), function(m){ m.classList.add('is-focus'); });
  }
  document.addEventListener('click', function(ev){
    var t = ev.target;
    var marker = t && t.closest ? t.closest('[data-marker]') : null;
    var thread = !marker && t && t.closest ? t.closest('.ad-thread[data-thread]') : null;
    if (marker || thread) {
      var v = (marker || thread).closest('.ad-view');
      if (v) focusThread(v, (marker || thread).getAttribute(marker ? 'data-marker' : 'data-thread'), !!marker);
      return;
    }
    var node = t && t.closest ? t.closest('[data-node]') : null;
    if (!node) return;
    var detail = node.getAttribute('data-detail-view');
    if (detail && document.querySelector('.ad-view[data-view="' + detail + '"]')) { location.hash = 'view=' + encodeURIComponent(detail); return; }
    var elId = node.getAttribute('data-element');
    var view = node.closest('.ad-view');
    if (!view) return;
    Array.prototype.forEach.call(view.querySelectorAll('.is-focus'), function(x){ x.classList.remove('is-focus'); });
    if (!elId) return;
    node.classList.add('is-focus');
    var row = view.querySelector('.ad-appears tr[data-element="' + elId + '"]');
    if (row) { row.classList.add('is-focus'); row.scrollIntoView({ block: 'nearest' }); }
  });
  var root = document.documentElement;
  function setTheme(t){
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-set-theme]'), function(b){ b.classList.toggle('is-active', b.getAttribute('data-set-theme') === t); });
    try { localStorage.setItem('ad-theme', t); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-set-theme]'), function(b){ b.addEventListener('click', function(){ setTheme(b.getAttribute('data-set-theme')); }); });
  var saved = null; try { saved = localStorage.getItem('ad-theme'); } catch (e) {}
  setTheme(saved || root.getAttribute('data-theme') || 'auto');
})();
`;

export function renderStandaloneHtml(store: Store, reg: NotationRegistry, opts: HtmlOptions = {}): string {
  const meta = store.meta();
  const title = opts.title ?? meta.name ?? 'Diagrama';
  const theme = opts.theme ?? 'dual';
  const fontFamily = opts.fontFamily ?? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const all = store.list('views');
  const views = opts.viewIds ? all.filter(v => opts.viewIds!.includes(v.id)) : all;
  const initial = opts.initialViewId ?? (meta.currentViewId && views.some(v => v.id === meta.currentViewId) ? meta.currentViewId : views[0]?.id ?? '');
  const packName = (id: string) => reg.pack(id)?.name ?? id;
  const packColor = (id: string) => reg.pack(id)?.color ?? '#64748b';
  const viewLink = (v: View, cls = '') => `<a href="#view=${encodeURIComponent(v.id)}"${cls ? ` class="${cls}"` : ''}>${esc(v.name || v.id)}</a>`;
  const inSet = new Set(views.map(v => v.id));

  // Índice agrupado por notación
  const byNotation = new Map<string, View[]>();
  for (const v of views) byNotation.set(v.notationId, [...(byNotation.get(v.notationId) ?? []), v]);
  const index = [...byNotation.entries()].map(([nid, list]) =>
    `<li class="ad-index__group">${esc(packName(nid))}</li>` +
    list.map(v => `<li class="ad-index__item" data-view="${esc(v.id)}"><a href="#view=${encodeURIComponent(v.id)}">${esc(v.name || v.id)}${v.kind !== 'freeform' ? ` <span class="ad-index__notation" style="background:${esc(packColor(nid))}">${esc(v.kind)}</span>` : ''}</a></li>`).join(''),
  ).join('');

  // Secciones
  const withComments = opts.comments ?? true;
  const sections = views.map(v => {
    const cm = withComments ? viewComments(store, v.id) : { markers: [], panel: '' };
    const svg = renderSvg(store, reg, v.id, { theme, fontFamily, idPrefix: `ad-${v.id}`, markers: cm.markers });
    const nodes = store.list('nodes').filter(n => n.viewId === v.id && n.elementId);
    const seen = new Set<string>();
    const rows: string[] = [];
    for (const n of nodes) {
      const el = store.get('elements', n.elementId!);
      if (!el || seen.has(el.id)) continue;
      seen.add(el.id);
      const { details, appearsIn } = viewsOfElement(store, el.id);
      const others = appearsIn.filter(o => o.id !== v.id && inSet.has(o.id));
      const dets = details.filter(d => inSet.has(d.id));
      const type = reg.elementType(el.typeId);
      rows.push(`<tr data-element="${esc(el.id)}"><td>${esc(el.name || '(sin nombre)')}</td><td class="ad-muted">${esc(type?.name ?? el.typeId)}</td><td>${dets.map(d => viewLink(d, 'ad-chip is-detail')).join('')}${others.map(o => viewLink(o, 'ad-chip')).join('') || (dets.length ? '' : '<span class="ad-chip">solo aquí</span>')}</td></tr>`);
    }
    const root = v.rootElementId ? store.get('elements', v.rootElementId) : undefined;
    return `<section class="ad-view" data-view="${esc(v.id)}" aria-labelledby="h-${esc(v.id)}">
<div class="ad-view__head"><h2 id="h-${esc(v.id)}">${esc(v.name || v.id)}</h2><span class="ad-muted">${esc(packName(v.notationId))}${v.viewpointId ? ` · ${esc(v.viewpointId)}` : ''}${root ? ` · detalle de ${esc(root.name)}` : ''}</span></div>
${v.doc ? `<p class="ad-view__doc">${esc(v.doc)}</p>` : ''}
${cm.panel ? `<div class="ad-view__body"><div class="ad-view__canvas">${svg}</div>${cm.panel}</div>` : `<div class="ad-view__canvas">${svg}</div>`}
${rows.length ? `<div class="ad-appears"><h3>Aparece en</h3><table><thead><tr><th>Elemento</th><th>Tipo</th><th>Vistas</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : ''}
</section>`;
  }).join('\n');

  const themeAttr = theme === 'dual' ? '' : ` data-theme="${theme}"`;
  return `<!DOCTYPE html>
<html lang="es"${themeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>${css(fontFamily)}</style>
</head>
<body data-initial-view="${esc(initial)}">
<nav class="ad-side" aria-label="Vistas">
<div class="ad-side__head"><h1>${esc(title)}</h1><p>${esc(meta.description || `${views.length} vistas · ${store.list('elements').filter(e => !e.template).length} elementos`)}</p>
<div class="ad-side__theme" role="group" aria-label="Tema"><button class="ad-btn" data-set-theme="auto" type="button">Auto</button><button class="ad-btn" data-set-theme="light" type="button">Claro</button><button class="ad-btn" data-set-theme="dark" type="button">Oscuro</button></div></div>
<ul class="ad-index">${index}</ul>
</nav>
<main class="ad-main">
<div class="ad-crumbs" aria-label="Recorrido"></div>
${sections || '<p class="ad-muted">No hay vistas.</p>'}
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------- Comentarios
/** Texto de usuario: escapado y sin `(` literal (así un `url(https://…)` escrito en un comentario no parece un recurso). */
const escText = (s: string) => esc(s).replace(/\(/g, '&#40;');

/** Fecha legible (día, mes, año y hora) para el panel; el valor exacto va en `datetime`. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try { return d.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

/** Qué se comenta, en palabras (para el panel y el texto emergente del marcador). */
function anchorText(store: Store, a: CommentAnchor): string {
  const elName = (id?: string) => { const e = id ? store.get('elements', id) : undefined; return e ? (e.name || '(sin nombre)') : undefined; };
  const nodeName = (id?: string) => { const n = id ? store.get('nodes', id) : undefined; return n ? (elName(n.elementId) ?? n.text ?? 'Nota') : undefined; };
  const relName = (id?: string) => { const r = id ? store.get('relations', id) : undefined; return r ? (r.name || `${elName(r.from.elementId) ?? '?'} → ${elName(r.to.elementId) ?? '?'}`) : undefined; };
  switch (a.kind) {
    case 'element': return elName(a.id) ?? '(borrado)';
    case 'node': return nodeName(a.id) ?? '(borrado)';
    case 'relation': return relName(a.id) ?? '(borrada)';
    case 'edge': { const e = a.id ? store.get('edges', a.id) : undefined; return e ? (e.label || relName(e.relationId) || `${nodeName(e.fromNodeId) ?? '?'} → ${nodeName(e.toNodeId) ?? '?'}`) : '(borrada)'; }
    case 'view': return 'Toda la vista';
    case 'point': return 'Punto del lienzo';
  }
}

/** Dónde poner el marcador de un hilo en esta vista (puede ser en varios sitios: un elemento con dos apariciones). */
function markerSpots(store: Store, a: CommentAnchor, viewId: string): SvgMarker['at'][] {
  const idx = indexOf(store);
  switch (a.kind) {
    case 'node': return a.id && store.get('nodes', a.id)?.viewId === viewId ? [{ node: a.id }] : [];
    case 'element': return a.id ? idx.nodesOfElement(a.id).filter(n => n.viewId === viewId).map(n => ({ node: n.id })) : [];
    case 'edge': return a.id && store.get('edges', a.id)?.viewId === viewId ? [{ edge: a.id }] : [];
    case 'relation': return a.id ? idx.edgesOfRelation(a.id).filter(e => e.viewId === viewId).map(e => ({ edge: e.id })) : [];
    case 'point': return a.viewId === viewId && a.x !== undefined && a.y !== undefined ? [{ x: a.x, y: a.y }] : [];
    case 'view': return [];
  }
}

/** Hilos de la vista, numerados del más antiguo al más reciente: marcadores para el SVG y panel lateral. */
function viewComments(store: Store, viewId: string): { markers: SvgMarker[]; panel: string } {
  const threads: CommentThread[] = [...threadsOfView(store, viewId)].sort((a, b) => (a.root.createdAt < b.root.createdAt ? -1 : a.root.createdAt > b.root.createdAt ? 1 : 0));
  if (!threads.length) return { markers: [], panel: '' };
  const markers: SvgMarker[] = [];
  const items = threads.map((th, i) => {
    const n = String(i + 1);
    const what = anchorText(store, th.anchor);
    for (const at of markerSpots(store, th.anchor, viewId)) markers.push({ label: n, at, muted: th.resolved, id: th.id, title: `${n}. ${th.root.author.name}: ${th.root.text.slice(0, 80)}` });
    const state = th.resolved ? `Resuelto${th.root.resolvedBy ? ` por ${esc(th.root.resolvedBy)}` : ''}` : 'Abierto';
    const comments = th.comments.map(c => `<div class="ad-cm"><div class="ad-cm__meta"><b>${escText(c.author.name)}</b><time datetime="${esc(c.createdAt)}">${esc(fmtDate(c.createdAt))}</time>${c.editedAt ? '<span>(editado)</span>' : ''}</div><p>${escText(c.text)}</p></div>`).join('');
    return `<li class="ad-thread${th.resolved ? ' is-resolved' : ''}" data-thread="${esc(th.id)}"><div class="ad-thread__head"><span class="ad-thread__n">${n}</span><span class="ad-thread__anchor" title="${escText(what)}">${escText(what)}</span><span class="ad-thread__state">${state}</span></div>${comments}</li>`;
  });
  const open = threads.filter(t => !t.resolved).length;
  const panel = `<aside class="ad-comments" aria-label="Comentarios"><h3>Comentarios <small>${open} abiertos · ${threads.length - open} resueltos</small></h3><ol class="ad-threads">${items.join('')}</ol></aside>`;
  return { markers, panel };
}

/**
 * Comprueba que un HTML no depende de recursos externos: ningún `src`/`href`/`url()`/`@import`
 * con esquema `http(s)` o `//`. Devuelve las referencias externas encontradas (vacío = OK).
 */
export function externalReferences(html: string): string[] {
  const out: string[] = [];
  const attr = /\b(?:src|href|srcset|poster|data|action)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]*)/gi;
  const cssUrl = /url\(\s*["']?\s*((?:https?:)?\/\/[^"')\s]*)/gi;
  const imp = /@import\s+["']((?:https?:)?\/\/[^"']*)/gi;
  for (const re of [attr, cssUrl, imp]) { let m: RegExpExecArray | null; while ((m = re.exec(html))) out.push(m[1]!); }
  return out;
}
