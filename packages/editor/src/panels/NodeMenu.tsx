import { dimensionsOfElement, viewsOfElement, makeView, makeNode, newId, type Command } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { topSuggestions, linkCommand } from './traces-helpers';
import { CommentIcon } from './Comments';
import { Icon } from '../icons';
import { confirmDialog } from '../ui/dialog';
import { useMenu, MenuBackdrop } from '../ui/menu';

/**
 * Menú contextual de un nodo: cambiar de dimensión, detalle, puertos, quitar, borrar. Dentro de la pantalla, con
 * teclado (también se abre con Shift+F10 o la tecla Menú) y, en móvil, como hoja inferior (ver `ui/menu.tsx`).
 */
export function NodeMenu({ x, y, nodeId, onClose }: { x: number; y: number; nodeId: string; onClose: () => void }) {
  const t = useT();
  const { store, registry, run, openView, readOnly, openComments } = useEditor();
  const m = useMenu(x, y, onClose);
  const vn = store.get('nodes', nodeId);
  const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined;
  if (!vn || !el) return null;
  const dims = dimensionsOfElement(store, el.id);
  const { details, appearsIn } = viewsOfElement(store, el.id);
  const packs = registry.allPacks().filter(p => p.id !== 'core');
  const traceSugs = readOnly ? [] : topSuggestions(store, registry, el.id, 3);

  const openIn = (viewId: string) => { openView(viewId, true); onClose(); };
  const createDetail = (notationId: string, viewpointId?: string, dimName?: string) => {
    const pack = registry.pack(notationId);
    const view = makeView(`${el.name} · ${dimName ?? pack?.name ?? notationId}`, { notationId, kind: pack?.viewKind ?? 'freeform', viewpointId, rootElementId: el.id });
    const cmds: Command[] = [{ type: 'set', collection: 'views', id: view.id, value: view }];
    // El elemento aparece también en su propia vista de detalle, como nodo raíz visual
    if (notationId === registry.notationOf(el.typeId) || notationId === 'freeform') cmds.push({ type: 'set', collection: 'nodes', id: newId('vn'), value: makeNode(view.id, el.id, { x: 40, y: 40, w: vn.w, h: vn.h }) });
    if (!vn.detailViewId) cmds.push({ type: 'patch', collection: 'nodes', id: vn.id, patch: { detailViewId: view.id } });
    run({ type: 'batch', label: t('crear vista de detalle'), commands: cmds });
    openView(view.id, true); onClose();
  };
  const togglePorts = () => { run({ type: 'patch', collection: 'nodes', id: vn.id, patch: { style: { showPorts: !vn.style.showPorts, visiblePorts: undefined } } }); onClose(); };

  const title = el.name || registry.elementType(el.typeId)?.name;
  return <>
    {m.sheet && <MenuBackdrop />}
    <div ref={m.ref} className={`ad-popover ad-menu${m.sheet ? ' ad-menu--sheet' : ''}`} style={m.style} role="menu" aria-label={title} onKeyDown={m.onKeyDown}>
      <div className="ad-popover__title" role="presentation">{title}</div>
      {vn.detailViewId && store.get('views', vn.detailViewId) && <button type="button" role="menuitem" tabIndex={-1} className="ad-popover__item" onClick={() => openIn(vn.detailViewId!)}><Icon name="drill" size={14} />{t('Entrar en el detalle')}</button>}
      <div className="ad-popover__section" role="presentation">{t('Abrir en otra dimensión')}</div>
      {dims.map(({ dimension: d, view }) => (
        <button type="button" role="menuitem" tabIndex={-1} key={d.id} className="ad-popover__item" onClick={() => view ? openIn(view.id) : (!readOnly && createDetail(d.notationId, d.viewpointId, d.name))}>
          <span className="ad-dot" style={{ background: d.color ?? registry.pack(d.notationId)?.color ?? '#999' }} /> {d.name} {view ? '' : <small>{t('(crear)')}</small>}
        </button>
      ))}
      {details.filter(v => !dims.some(d => d.view?.id === v.id)).map(v => <button type="button" role="menuitem" tabIndex={-1} key={v.id} className="ad-popover__item" onClick={() => openIn(v.id)}><Icon name="diamond" size={12} />{v.name}</button>)}
      {!readOnly && (
        <details className="ad-popover__details">
          <summary className="ad-popover__item" role="menuitem" tabIndex={-1} aria-haspopup="true"><Icon name="plus" size={14} />{t('Nueva vista de detalle…')}</summary>
          {packs.map(p => <button type="button" role="menuitem" tabIndex={-1} key={p.id} className="ad-popover__item ad-popover__item--sub" onClick={() => createDetail(p.id)}>{p.name}</button>)}
        </details>
      )}
      {appearsIn.length > 0 && <div className="ad-popover__section" role="presentation">{t('Aparece en')}</div>}
      {appearsIn.map(v => <button type="button" role="menuitem" tabIndex={-1} key={v.id} className="ad-popover__item" onClick={() => openIn(v.id)}><Icon name="view" size={12} />{v.name}</button>)}
      {traceSugs.length > 0 && <div className="ad-popover__section" role="presentation">{t('Trazas')}</div>}
      {traceSugs.map(s => (
        <button type="button" role="menuitem" tabIndex={-1} key={s.target.id} className="ad-popover__item" title={`${s.reason} (${Math.round(s.score * 100)} %)`} onClick={() => { run(linkCommand(el.id, s)); onClose(); }}>
          <Icon name="trace" size={14} />{t('Enlazar con {name}', { name: s.target.name || t('(sin nombre)') })} <small>({registry.pack(registry.notationOf(s.target.typeId))?.name ?? registry.notationOf(s.target.typeId)})</small>
        </button>
      ))}
      {!readOnly && <>
        <div className="ad-popover__section" role="presentation">{t('Nodo')}</div>
        <button type="button" role="menuitem" tabIndex={-1} className="ad-popover__item" onClick={() => { openComments({ draft: { kind: 'node', id: vn.id, viewId: vn.viewId } }); onClose(); }}><CommentIcon size={12} /> {t('Comentar')}</button>
        <button type="button" role="menuitem" tabIndex={-1} className="ad-popover__item" onClick={togglePorts}>{vn.style.showPorts ? t('Ocultar pines') : t('Mostrar pines')}</button>
        <button type="button" role="menuitem" tabIndex={-1} className="ad-popover__item" onClick={() => { run({ type: 'deleteNode', id: vn.id }); onClose(); }}>{t('Quitar de esta vista')}</button>
        <button type="button" role="menuitem" tabIndex={-1} className="ad-popover__item ad-popover__item--danger" onClick={async () => { onClose(); if (await confirmDialog({ title: t('¿Borrar "{name}" del modelo y de todas las vistas?', { name: el.name }), message: t('Desaparece de todas las vistas en las que aparece. Puedes deshacerlo con Ctrl+Z.'), danger: true })) run({ type: 'deleteElement', id: el.id }); }}>{t('Borrar del modelo')}</button>
      </>}
    </div>
  </>;
}
