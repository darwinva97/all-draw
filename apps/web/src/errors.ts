/**
 * Errores de la app web:
 *   - `ErrorBoundary`: si un componente revienta, en vez de una página en blanco se ve "Algo salió mal" con
 *     **Recargar** e **Informar** (y el detalle técnico plegado). Lo monta `main.tsx` alrededor de toda la app.
 *   - `installGlobalErrorHandlers()`: `window.onerror` y `unhandledrejection` → `POST /api/client-errors`.
 *
 * Qué se manda: mensaje, pila, pila de componentes, ruta de la página **sin query ni tokens** y el
 * user-agent. Nunca contenido del diagrama. Con deduplicación (la misma firma se manda una vez por
 * sesión; las repeticiones sólo suman `count`), muestreo de los errores globales (50 %) y como mucho
 * 20 informes por pestaña. El servidor limita además a 8 KB y por IP.
 *
 * Es `.ts` (sin JSX) a propósito: se carga antes que nada y no depende del resto de la app.
 */
import { Component, createElement as h, useState, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '@all-draw/i18n';

export const CLIENT_ERRORS_ENDPOINT = '/api/client-errors';
const MAX_REPORTS = 20;
const GLOBAL_SAMPLE = 0.5;
const MAX_BODY = 7 * 1024;

export type ErrorSource = 'boundary' | 'onerror' | 'unhandledrejection' | 'manual';
interface Report { message: string; stack?: string; componentStack?: string; source: ErrorSource; url: string; userAgent?: string; count?: number }

const seen = new Map<string, number>();
let sent = 0;

function describe(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: `${err.name}: ${err.message}`, ...(err.stack ? { stack: err.stack } : {}) };
  if (typeof err === 'string') return { message: err };
  try { return { message: JSON.stringify(err) ?? String(err) }; } catch { return { message: String(err) }; }
}

/** Ruta de la página sin query ni tokens: `#/s/ws_1?token=lnk_…` → `#/s/ws_1`. */
export function pageForReport(loc: Pick<Location, 'pathname' | 'hash'> = location): string {
  return (loc.pathname + loc.hash.replace(/\?.*$/, '')).replace(/\b(?:lnk|adk|ads)_[A-Za-z0-9]+/g, ':token').slice(0, 500);
}

const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Manda un informe (si no está repetido, entra en la muestra y no se ha llegado al tope). Devuelve si se
 * envió. `force` se salta deduplicación y muestreo (botón "Informar").
 */
export function reportClientError(err: unknown, source: ErrorSource, extra: { componentStack?: string; force?: boolean } = {}): boolean {
  if (typeof window === 'undefined') return false;
  const { message, stack } = describe(err);
  const key = `${message}\n${stack?.split('\n')[1] ?? ''}`;
  const prev = seen.get(key) ?? 0;
  seen.set(key, prev + 1);
  if (!extra.force) {
    if (prev > 0) return false;
    if (source !== 'boundary' && Math.random() >= GLOBAL_SAMPLE) return false;
  }
  if (sent >= MAX_REPORTS) return false;
  const report: Report = {
    message: clip(message, 1000)!, source, url: pageForReport(),
    ...(stack ? { stack: clip(stack, 3000) } : {}),
    ...(extra.componentStack ? { componentStack: clip(extra.componentStack, 1500) } : {}),
    ...(typeof navigator !== 'undefined' ? { userAgent: clip(navigator.userAgent, 300) } : {}),
    ...(prev > 0 ? { count: prev + 1 } : {}),
  };
  let body = JSON.stringify(report);
  if (body.length > MAX_BODY) { delete report.componentStack; report.stack = clip(report.stack, 1000); body = JSON.stringify(report); }
  sent++;
  void fetch(CLIENT_ERRORS_ENDPOINT, {
    method: 'POST', keepalive: true, credentials: 'same-origin', body,
    headers: { 'content-type': 'application/json', 'x-requested-with': 'all-draw' },
  }).catch(() => { /* sin servidor (modo local): nada que hacer */ });
  return true;
}

/** Ruido conocido que no es un fallo de la app. */
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i];

let installed = false;
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => {
    if (e.target && e.target !== window) return; // fallo al cargar una imagen o un script: no es una excepción
    const err = e.error ?? e.message;
    const text = describe(err).message;
    if (IGNORE.some(r => r.test(text) || r.test(e.filename ?? ''))) return;
    reportClientError(err, 'onerror');
  }, true);
  window.addEventListener('unhandledrejection', e => {
    const text = describe(e.reason).message;
    if (IGNORE.some(r => r.test(text))) return;
    reportClientError(e.reason, 'unhandledrejection');
  });
}

// ---------------------------------------------------------------- Pantalla de error

function ErrorScreen({ error, componentStack }: { error: unknown; componentStack?: string }) {
  const t = useT();
  const [status, setStatus] = useState<'idle' | 'sent' | 'failed'>('idle');
  const detail = describe(error);
  const send = () => setStatus(reportClientError(error, 'manual', { force: true, ...(componentStack ? { componentStack } : {}) }) ? 'sent' : 'failed');
  return h('main', { className: 'home', role: 'alert', style: { maxWidth: 640, margin: '10vh auto', padding: 24 } },
    h('h1', null, t('Algo salió mal')),
    h('p', { className: 'lead' }, t('La aplicación ha tenido un error inesperado. Tus espacios en el servidor están a salvo; lo que estabas editando en este navegador se guarda solo.')),
    h('div', { className: 'row', style: { gap: 8, marginTop: 16 } },
      h('button', { className: 'btn btn--primary', type: 'button', onClick: () => location.reload() }, t('Recargar')),
      h('button', { className: 'btn', type: 'button', disabled: status === 'sent', onClick: send }, status === 'sent' ? t('Informe enviado') : t('Informar del error')),
      h('a', { className: 'btn btn--ghost', href: '#/', onClick: () => setTimeout(() => location.reload(), 0) }, t('Ir al inicio')),
    ),
    h('p', { role: 'status', 'aria-live': 'polite', className: status === 'failed' ? 'err' : 'ok' },
      status === 'sent' ? t('Gracias: el informe no incluye el contenido de tus diagramas.') : status === 'failed' ? t('No se pudo enviar el informe (ya se enviaron muchos o no hay servidor).') : ''),
    h('details', { style: { marginTop: 16 } },
      h('summary', null, t('Detalles técnicos')),
      h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 300, overflow: 'auto' } }, [detail.message, detail.stack, componentStack].filter(Boolean).join('\n\n')),
    ),
  );
}

interface BoundaryState { error: unknown; componentStack?: string; failed: boolean }

/** Captura errores de render de toda la app (ver `main.tsx`). */
export class ErrorBoundary extends Component<{ children?: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null, failed: false };
  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> { return { error, failed: true }; }
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? undefined;
    this.setState({ componentStack });
    reportClientError(error, 'boundary', componentStack ? { componentStack } : {});
  }
  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return h(ErrorScreen, { error: this.state.error, ...(this.state.componentStack ? { componentStack: this.state.componentStack } : {}) });
  }
}
