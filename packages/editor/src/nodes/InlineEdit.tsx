import { useEffect, useRef, useState } from 'react';

/** Campo de texto dentro de un nodo: Enter guarda, Esc cancela, perder el foco guarda. */
export function InlineEdit({ value, onCommit, onCancel, multiline }: { value: string; onCommit: (v: string) => void; onCancel: () => void; multiline?: boolean }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && (!multiline || !e.shiftKey)) { e.preventDefault(); onCommit(v); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  const common = {
    ref, className: 'ad-inline-edit nodrag nopan', value: v, onKeyDown,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: () => onCommit(v),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };
  return multiline ? <textarea {...common} rows={3} /> : <input {...common} />;
}
