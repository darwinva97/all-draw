/** Iconos del visor de documentación: trazo 1.5 en una rejilla de 16, `currentColor`. */
const PATHS = {
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  close: 'M4 4l8 8M12 4l-8 8',
  search: 'M7 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zM11 11l3.5 3.5',
  sun: 'M8 10.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06',
  moon: 'M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z',
  system: 'M2 3.5h12v8H2zM6 14h4M8 11.5V14',
  edit: 'M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3',
  prev: 'M10 3.5L5.5 8l4.5 4.5',
  next: 'M6 3.5l4.5 4.5L6 12.5',
  copy: 'M5.5 5.5h7v8h-7zM3.5 10.5v-8h7',
  check: 'M3 8.5l3 3 7-7',
  link: 'M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2.5-2.5a2.5 2.5 0 0 0-3.54-3.54l-.75.75M9.25 6.75a2.5 2.5 0 0 0-3.54 0l-2.5 2.5a2.5 2.5 0 0 0 3.54 3.54l.75-.75',
  info: 'M8 14.25A6.25 6.25 0 1 0 8 1.75a6.25 6.25 0 0 0 0 12.5zM8 7.25v4M8 4.75v.5',
  tip: 'M6 12.5h4M6.5 14.5h3M8 1.75a4.25 4.25 0 0 0-2.5 7.69V11h5V9.44A4.25 4.25 0 0 0 8 1.75z',
  alert: 'M8 2l6.5 11.5h-13zM8 6.5v3.25M8 11.5v.5',
  external: 'M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4',
  book: 'M2.5 3c2-.75 3.75-.5 5.5.75 1.75-1.25 3.5-1.5 5.5-.75v10c-2-.75-3.75-.5-5.5.75-1.75-1.25-3.5-1.5-5.5-.75zM8 3.75v10',
  swap: 'M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13',
  back: 'M13 8H3.5M7 4.5L3.5 8 7 11.5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`docs-icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
