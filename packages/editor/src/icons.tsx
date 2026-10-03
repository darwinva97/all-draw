/**
 * Iconos propios en SVG (rejilla de 16 px, trazo de 1,5 px, extremos redondeados). Sustituyen a los glifos
 * Unicode (⌕ ⌗ ◐ ↶ ↷ ☰ ＋ × ⋯ …), que en algunas fuentes se pintan como cajas vacías.
 *
 * `<Icon name="search" />` (16 px) o `<Icon name="help" size={20} />`: el trazo se compensa para que siga
 * midiendo 1,5 px a cualquier tamaño. Son decorativos (`aria-hidden`); el nombre accesible lo pone el botón.
 */
import type { ReactNode } from 'react';

const dot = (x: number, y: number) => <circle cx={x} cy={y} r=".9" fill="currentColor" stroke="none" />;

const PATHS = {
  home: <path d="M2.5 7.2 8 2.8l5.5 4.4M4 6.2V13h3v-3.2h2V13h3V6.2" />,
  spaces: <><rect x="2.5" y="2.5" width="4.25" height="4.25" rx="1" /><rect x="9.25" y="2.5" width="4.25" height="4.25" rx="1" /><rect x="2.5" y="9.25" width="4.25" height="4.25" rx="1" /><rect x="9.25" y="9.25" width="4.25" height="4.25" rx="1" /></>,
  search: <><circle cx="7" cy="7" r="4.25" /><path d="m10.2 10.2 3.3 3.3" /></>,
  snap: <path d="M2 5.5h12M2 10.5h12M5.5 2v12M10.5 2v12" />,
  sun: <><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5V3m0 10v1.5M1.5 8H3m10 0h1.5M3.4 3.4l1.06 1.06m7.08 7.08 1.06 1.06M3.4 12.6l1.06-1.06m7.08-7.08L12.6 3.4" /></>,
  moon: <path d="M13.2 9.7A5.6 5.6 0 0 1 6.3 2.8a5.6 5.6 0 1 0 6.9 6.9Z" />,
  contrast: <><circle cx="8" cy="8" r="5.6" /><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" stroke="none" /></>,
  keyboard: <><rect x="1.5" y="4" width="13" height="8.5" rx="1.5" />{dot(4.5, 7)}{dot(7, 7)}{dot(9.5, 7)}{dot(12, 7)}<path d="M5.5 9.8h5" /></>,
  undo: <path d="M5.5 3.8 2.5 6.8l3 3M2.5 6.8h7.2a3.3 3.3 0 0 1 0 6.6H7.5" />,
  redo: <path d="m10.5 3.8 3 3-3 3m3-3H6.3a3.3 3.3 0 0 0 0 6.6h2.2" />,
  more: <>{dot(3.5, 8)}{dot(8, 8)}{dot(12.5, 8)}</>,
  panelLeft: <><rect x="2" y="2.5" width="12" height="11" rx="1.75" /><path d="M6.25 2.5v11" /></>,
  panelRight: <><rect x="2" y="2.5" width="12" height="11" rx="1.75" /><path d="M9.75 2.5v11" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  close: <path d="m4.25 4.25 7.5 7.5m0-7.5-7.5 7.5" />,
  chevronDown: <path d="m4 6 4 4 4-4" />,
  chevronRight: <path d="m6 4 4 4-4 4" />,
  chevronLeft: <path d="M10 4 6 8l4 4" />,
  arrowLeft: <path d="M13 8H3m4-4L3 8l4 4" />,
  arrowRight: <path d="M3 8h10M9 4l4 4-4 4" />,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDown: <path d="M8 3v10m-4-4 4 4 4-4" />,
  comment: <path d="M2.5 3.6c0-.9.7-1.6 1.6-1.6h7.8c.9 0 1.6.7 1.6 1.6v5.8c0 .9-.7 1.6-1.6 1.6H7.2l-2.8 2.4V11h-.3c-.9 0-1.6-.7-1.6-1.6Z" />,
  trash: <path d="M2.5 4.5h11M6 4.5V3h4v1.5m-6 0 .7 9h6.6l.7-9" />,
  edit: <path d="m10.3 2.7 3 3L6 13H3v-3Z" />,
  eye: <><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></>,
  check: <path d="m3 8.5 3 3 7-7" />,
  help: <><circle cx="8" cy="8" r="6" /><path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.6-1.9 2.8" />{dot(8, 11.6)}</>,
  book: <path d="M2.5 3h3.8A1.7 1.7 0 0 1 8 4.7V13a1.5 1.5 0 0 0-1.5-1.5h-4ZM13.5 3H9.7A1.7 1.7 0 0 0 8 4.7V13a1.5 1.5 0 0 1 1.5-1.5h4Z" />,
  replay: <path d="M2.7 8a5.3 5.3 0 1 0 1.55-3.75M2.7 2.5v3h3" />,
  history: <path d="M2.7 8a5.3 5.3 0 1 0 1.55-3.75M2.7 2.5v3h3M8 5.2V8l2 1.4" />,
  sparkle: <path d="M8 2.2 9.3 6l3.7 1.3-3.7 1.3L8 12.4 6.7 8.6 3 7.3 6.7 6ZM12.5 11.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" />,
  bug: <path d="M5.5 6h5v3.5a2.5 2.5 0 0 1-5 0ZM6 6a2 2 0 0 1 4 0M2.5 8.5h3m5 0h3M3 13l2.7-1.6M13 13l-2.7-1.6M3 4l2.7 1.8M13 4l-2.7 1.8" />,
  external: <path d="M9 2.5h4.5V7m0-4.5-6 6m4 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />,
  upload: <path d="M8 10.5v-8m-3 3 3-3 3 3M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />,
  download: <path d="M8 2.5v8m-3-3 3 3 3-3M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />,
  link: <path d="m6.5 9.5 3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1m-2 4-1 1a2.8 2.8 0 0 1-4-4l1-1" />,
  share: <><circle cx="11.5" cy="3.8" r="1.8" /><circle cx="4.5" cy="8" r="1.8" /><circle cx="11.5" cy="12.2" r="1.8" /><path d="m6.1 7 3.8-2.2M6.1 9l3.8 2.2" /></>,
  cloud: <path d="M4.6 12.5h6.8a3 3 0 0 0 .3-6 4 4 0 0 0-7.7 1.2 2.4 2.4 0 0 0 .6 4.8Z" />,
  cloudOff: <path d="M4.6 12.5h6.8a3 3 0 0 0 1.9-.7M12.3 6.7a4 4 0 0 0-6.5-2.6M4.2 6.6a2.5 2.5 0 0 0 .4 5.9M2 2l12 12" />,
  device: <path d="M3 3.5h10v7H3ZM1.5 12.5h13" />,
  fit: <path d="M2.5 6V2.5H6m4 0h3.5V6m0 4v3.5H10m-4 0H2.5V10" />,
  layout: <><rect x="2.5" y="2.5" width="4.5" height="3.5" rx=".8" /><rect x="9" y="10" width="4.5" height="3.5" rx=".8" /><path d="M4.75 6v5.75H9" /></>,
  box: <path d="M2.5 4.6 8 2.2l5.5 2.4v6.8L8 13.8l-5.5-2.4ZM2.5 4.6 8 7l5.5-2.4M8 7v6.8" />,
  layers: <path d="M8 2.2 2.2 5.1 8 8l5.8-2.9ZM2.2 8 8 10.9 13.8 8M2.2 10.9 8 13.8l5.8-2.9" />,
  shapes: <><rect x="2.5" y="2.5" width="4.75" height="4.75" rx="1" /><circle cx="11.2" cy="4.9" r="2.4" /><path d="m5 9.2 2.6 4.3H2.4Z" /><path d="M11.2 9.3v4.2m-2.1-2.1h4.2" /></>,
  sliders: <><path d="M2.5 4.5h6m3 0h2m-11 7h2m3 0h6" /><circle cx="10" cy="4.5" r="1.5" /><circle cx="6" cy="11.5" r="1.5" /></>,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.25" /><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" /></>,
  image: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><circle cx="5.8" cy="6.4" r="1.15" /><path d="m2.5 12 3.6-3.4 2.4 2.3 2-1.9 3 2.8" /></>,
  note: <path d="M3 2.5h7l3 3v8H3ZM10 2.5v3h3M5.5 8.2h5m-5 2.4h3" />,
  group: <path d="M2.5 5V2.5H5m6 0h2.5V5m0 6v2.5H11m-6 0H2.5V11M7 2.5h2m-2 11h2M2.5 7v2m11-2v2" />,
  text: <path d="M3.5 3.5h9M8 3.5v9m-2 0h4" />,
  drill: <path d="M4 2.5v6a2 2 0 0 0 2 2h7m-3-3 3 3-3 3" />,
  diamond: <path d="M8 2.3 13.7 8 8 13.7 2.3 8Z" />,
  view: <rect x="3" y="3" width="10" height="10" rx="1.75" />,
  swap: <path d="M3 5.5h10m-3-3 3 3-3 3m3 2H3m3-3-3 3 3 3" />,
  trace: <path d="M2.5 8h7.5M7.5 5l3 3-3 3M13.5 3.5v9" />,
  error: <><circle cx="8" cy="8" r="6" /><path d="M8 4.8v3.6" />{dot(8, 11)}</>,
  warning: <><path d="M8 2.4 14.2 13H1.8Z" /><path d="M8 6.5v3" />{dot(8, 11.1)}</>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.3V11" />{dot(8, 5)}</>,
  success: <><circle cx="8" cy="8" r="6" /><path d="m5.4 8.2 1.8 1.8 3.4-3.6" /></>,
  file: <path d="M4 2h5l3 3v9H4ZM9 2v3h3" />,
  fileImport: <path d="M9.5 2h-5.5v12h8V4.5ZM9.5 2v2.5H12M8 6.5v5m-2.3-2.2L8 11.6l2.3-2.3" />,
  user: <><circle cx="8" cy="5.5" r="2.6" /><path d="M2.8 13.5a5.2 5.2 0 0 1 10.4 0" /></>,
  logout: <path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6m4.5 8.5 3-3-3-3m3 3h-7" />,
  globe: <><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c1.7 1.6 2.5 3.6 2.5 6S9.7 12.4 8 14C6.3 12.4 5.5 10.4 5.5 8S6.3 3.6 8 2Z" /></>,
  sort: <path d="M5 3v10m-2.5-2.5L5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" />,
  key: <><circle cx="5.2" cy="10.8" r="2.7" /><path d="m7.1 8.9 6.4-6.4m-2 2 1.6 1.6" /></>,
  template: <><rect x="2" y="2.5" width="12" height="11" rx="1.75" /><path d="M2 6.2h12M6.5 6.2v7.3" /></>,
  folder: <path d="M2 4.5a1 1 0 0 1 1-1h3.2l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />,
  pin: <><circle cx="8" cy="6" r="2.2" /><path d="M8 8.2V14" /></>,
  wand: <path d="m2.5 13.5 8-8m-1.5-1.5 3 3M12 1.8v2m-1-1h2M3.5 2.5v2m-1-1h2M13 9.5v2m-1-1h2" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps {
  name: IconName;
  /** Lado en px (16 por defecto; 20 en la barra inferior y en la portada). */
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg className={`ad-icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={(1.5 * 16) / size} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
