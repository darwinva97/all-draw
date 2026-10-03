import { useEffect } from 'react';
import { useT } from '@all-draw/i18n';
import { Icon } from '../icons';
import { inLayer } from '../ui/layer';

/** Panel de atajos de teclado (tecla ?). Textos en español; se traducen con `t()` al pintarlos. */
const GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'General', items: [['Ctrl+K / Ctrl+F', 'Buscar elementos, vistas y acciones'], ['?', 'Este panel'], ['Esc', 'Cerrar paneles, cancelar'], ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer']] },
  { title: 'Selección', items: [['Ctrl+A', 'Seleccionar todo'], ['Shift+clic', 'Añadir a la selección'], ['Shift+arrastrar', 'Selección por área'], ['F2', 'Renombrar el elemento seleccionado'], ['Supr', 'Quitar de la vista']] },
  { title: 'Edición', items: [['Ctrl+C / Ctrl+V', 'Copiar / pegar (misma aparición)'], ['Ctrl+Shift+V', 'Pegar como copia (elementos nuevos)'], ['Ctrl+D', 'Duplicar'], ['Flechas', 'Mover la selección 1 px'], ['Shift+flechas', 'Mover la selección 10 px'], ['Alt (mantener)', 'Desactivar el ajuste a rejilla']] },
  { title: 'Vista', items: [['+ / -', 'Acercar / alejar'], ['Ctrl+0', 'Zoom al 100 %'], ['Ctrl+Shift+F', 'Ajustar a la vista'], ['Doble clic en nodo', 'Entrar en su vista de detalle'], ['Doble clic en el nombre', 'Renombrar en línea'], ['Doble clic en arista', 'Añadir punto de quiebre'], ['Botón derecho', 'Menú del nodo / del lienzo']] },
];

export function ShortcutsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inLayer(e)) { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ad-cmdk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ad-cmdk ad-shortcuts" role="dialog" aria-modal="true" aria-label={t('Atajos de teclado')}>
        <header className="ad-shortcuts__head"><strong>{t('Atajos de teclado')}</strong><button className="ad-btn ad-btn--ghost" onClick={onClose} aria-label={t('Cerrar')} autoFocus><Icon name="close" size={14} /></button></header>
        <div className="ad-shortcuts__grid">
          {GROUPS.map(g => (
            <section key={g.title}>
              <div className="ad-section">{t(g.title)}</div>
              {g.items.map(([k, d]) => <div key={k} className="ad-shortcuts__row"><kbd>{t(k)}</kbd><span>{t(d)}</span></div>)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
