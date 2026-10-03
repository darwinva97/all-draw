import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { Icon } from '../icons';

/**
 * Enlace contextual "¿Cómo funciona?" a un capítulo de la documentación (se abre en otra pestaña para no perder
 * el lienzo). Solo aparece si la app ha dado `docsHref` al `EditorProvider`.
 */
export function HelpLink({ slug, anchor, label, className = '' }: { slug: string; anchor?: string; label?: string; className?: string }) {
  const t = useT();
  const { docsHref } = useEditor();
  if (!docsHref) return null;
  const text = label ?? t('¿Cómo funciona?');
  return (
    <a className={`ad-help-link ${className}`} href={docsHref(slug, anchor)} target="_blank" rel="noopener" title={t('{label} (se abre en otra pestaña)', { label: text })}>
      <Icon name="help" size={14} /><span>{text}</span>
    </a>
  );
}
