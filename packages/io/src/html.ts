/**
 * HTML **autocontenido** con todas las vistas del workspace como SVG (`renderSvg`), índice
 * lateral, navegación por `detailViewId` (clic en un nodo con vista de detalle) y lista
 * "aparece en" por elemento. Sin URLs externas: CSS y JS van inline y no se cargan fuentes remotas.
 * Tema claro/oscuro con el `dual` de los SVG y un conmutador manual.
 */
import { viewsOfElement, type NotationRegistry, type Store, type View } from '@all-draw/core';
import { escapeXml, renderSvg, THEME_VARS, type SvgTheme } from './svg';

export interface HtmlOptions {
  title?: string;
  /** Tema inicial; `dual` (por defecto) sigue al sistema y deja conmutar. */
  theme?: SvgTheme;
  fontFamily?: string;
  /** Vista inicial; por defecto `meta.currentViewId` o la primera. */
  initialViewId?: string;
  /** Solo estas vistas (por defecto todas). */
  viewIds?: string[];
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
@media (max-width:720px){body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.ad-side{border-right:0;border-bottom:1px solid var(--ad-border);max-height:40vh}}
@media print{body{display:block}.ad-side{display:none}.ad-view{display:block;page-break-after:always}.ad-view__canvas{max-height:none;overflow:visible}}
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
  document.addEventListener('click', function(ev){
    var t = ev.target;
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
  const sections = views.map(v => {
    const svg = renderSvg(store, reg, v.id, { theme, fontFamily, idPrefix: `ad-${v.id}` });
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
<div class="ad-view__canvas">${svg}</div>
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
