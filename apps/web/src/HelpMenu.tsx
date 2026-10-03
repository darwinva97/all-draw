/** Botón de ayuda de la barra del editor: documentación, atajos, repetir el recorrido, novedades e informar de un problema. */
import { useEffect, useRef, useState } from 'react';
import { Icon, useEditor } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';
import { docHref, ISSUES_URL } from './help';

export function HelpMenu({ onTour }: { onTour: () => void }) {
  const t = useT();
  const { setShortcutsOpen } = useEditor();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button ref={trigger} type="button" className="btn btn--ghost btn--icon" data-tour="help" aria-haspopup="menu" aria-expanded={open}
        aria-label={t('Ayuda')} title={t('Ayuda')} onClick={() => setOpen(o => !o)}><Icon name="help" /></button>
      {open && <div ref={menu} className="menu" role="menu" aria-label={t('Ayuda')}>
        <a role="menuitem" href={docHref('primeros-pasos')} target="_blank" rel="noopener" onClick={close}><Icon name="book" />{t('Documentación')}<span className="menu__ext"><Icon name="external" size={14} /></span></a>
        <button role="menuitem" type="button" onClick={() => { close(); setShortcutsOpen(true); }}><Icon name="keyboard" />{t('Atajos de teclado')}<kbd>?</kbd></button>
        <button role="menuitem" type="button" onClick={() => { close(); onTour(); }}><Icon name="replay" />{t('Repetir el recorrido')}</button>
        <div className="menu__sep" />
        <a role="menuitem" href={docHref('novedades')} target="_blank" rel="noopener" onClick={close}><Icon name="sparkle" />{t('Novedades')}<span className="menu__ext"><Icon name="external" size={14} /></span></a>
        <a role="menuitem" href={ISSUES_URL} target="_blank" rel="noopener" onClick={close}><Icon name="bug" />{t('Informar de un problema')}<span className="menu__ext"><Icon name="external" size={14} /></span></a>
      </div>}
    </span>
  );
}
