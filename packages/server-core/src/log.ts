/**
 * Registro estructurado mínimo (una línea JSON por evento) y utilidades para no filtrar datos personales
 * ni secretos en los logs: IP truncada, rutas sin tokens. Sin dependencias de Node: el worker lo usa con
 * `console` (Workers Observability recoge cada línea) y el servidor Node con `process.stdout`.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export const LOG_LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
export type LogFields = Record<string, unknown>;

export interface Logger {
  readonly level: LogLevel;
  log(level: Exclude<LogLevel, 'silent'>, msg: string, fields?: LogFields): void;
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

export const parseLogLevel = (v: string | null | undefined, fallback: LogLevel = 'info'): LogLevel =>
  v && v.toLowerCase() in LOG_LEVELS ? (v.toLowerCase() as LogLevel) : fallback;

/** Convierte errores en algo serializable (mensaje y pila recortada). */
function plain(v: unknown): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack?.split('\n').slice(0, 8).join('\n') };
  return v;
}

/**
 * Logger JSON: `{"t":"…","level":"info","msg":"http",…campos}`. `write` recibe la línea ya serializada
 * (por defecto `console.log`/`console.error` según el nivel).
 */
export function jsonLogger(opts: { level?: LogLevel; write?: (line: string, level: Exclude<LogLevel, 'silent'>) => void; base?: LogFields } = {}): Logger {
  const level = opts.level ?? 'info';
  const min = LOG_LEVELS[level];
  const write = opts.write ?? ((line, l) => (l === 'error' || l === 'warn' ? console.error(line) : console.log(line)));
  const log: Logger['log'] = (l, msg, fields) => {
    if (LOG_LEVELS[l] < min) return;
    const out: LogFields = { t: new Date().toISOString(), level: l, msg, ...opts.base };
    if (fields) for (const [k, v] of Object.entries(fields)) if (v !== undefined) out[k] = plain(v);
    let line: string;
    try { line = JSON.stringify(out); } catch { line = JSON.stringify({ t: out.t, level: l, msg, note: 'campos no serializables' }); }
    write(line, l);
  };
  return {
    level, log,
    debug: (m, f) => log('debug', m, f),
    info: (m, f) => log('info', m, f),
    warn: (m, f) => log('warn', m, f),
    error: (m, f) => log('error', m, f),
  };
}

/** IP sin el último octeto (IPv4 → `203.0.113.0`) o con sólo el /48 (IPv6 → `2001:db8:85a3::`): sirve para ver abusos sin guardar la dirección exacta. */
export function truncateIp(ip: string | null | undefined): string {
  if (!ip) return 'unknown';
  let s = ip.trim();
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice(7);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(s);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0`;
  if (s.includes(':')) {
    const head = s.split('%')[0]!.split('::')[0]!.split(':').filter(Boolean).slice(0, 3);
    return `${head.join(':')}::`;
  }
  return 'unknown';
}

/** Tokens que pueden aparecer en una ruta (`/links/lnk_…`) o en la query (`?token=`): sesión, API key, enlace, restablecer y verificar. */
const TOKEN_SEGMENT = /^(?:lnk|adk|ads|rst|vfy)_[A-Za-z0-9]+$/;

/** Ruta sin query ni tokens: `/api/workspaces/ws_1/links/lnk_abc?token=x` → `/api/workspaces/ws_1/links/:token`. */
export function redactPath(urlOrPath: string): string {
  const q = urlOrPath.search(/[?#]/);
  const p = q >= 0 ? urlOrPath.slice(0, q) : urlOrPath;
  return p.split('/').map(seg => (TOKEN_SEGMENT.test(seg) ? ':token' : seg)).join('/').slice(0, 300);
}

/** Quita `token=…` de cualquier texto con URLs (mensajes y pilas de errores del cliente). */
export const redactTokens = (s: string): string => s.replace(/(token=)[^&#\s"']+/gi, '$1…').replace(/\b(?:lnk|adk|ads|rst|vfy)_[A-Za-z0-9]{8,}/g, m => `${m.slice(0, 4)}…`);
