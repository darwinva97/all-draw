/**
 * Resumen del navegador de una sesión para la lista de «Sesiones activas»: sólo navegador, sistema y tipo de
 * dispositivo (`Firefox;Linux;desktop`). El user-agent completo no se guarda (identifica demasiado).
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'cli' | 'unknown';
export interface DeviceSummary { browser: string | null; os: string | null; type: DeviceType }

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bVivaldi\//, 'Vivaldi'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bCriOS\/|\b(?:Headless)?Chrome\/|\bChromium\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
  [/^curl\//i, 'curl'],
  [/^Wget\//i, 'Wget'],
  [/^python-requests\/|^python-urllib/i, 'Python'],
  [/^node(?:-fetch)?\b|^undici\b/i, 'Node.js'],
  [/^Go-http-client\//, 'Go'],
];
const SYSTEMS: [RegExp, string][] = [
  [/\b(?:iPhone|iPad|iPod)\b.*\bOS \d/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

export function summarizeUserAgent(ua: string | null | undefined): DeviceSummary {
  const s = (ua ?? '').slice(0, 512);
  if (!s.trim()) return { browser: null, os: null, type: 'unknown' };
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1] ?? null;
  const os = SYSTEMS.find(([re]) => re.test(s))?.[1] ?? null;
  const cli = !!browser && ['curl', 'Wget', 'Python', 'Node.js', 'Go'].includes(browser);
  const type: DeviceType = cli ? 'cli'
    : /\biPad\b|\bTablet\b/.test(s) || (/\bAndroid\b/.test(s) && !/\bMobile\b/.test(s)) ? 'tablet'
    : /\bMobi|\biPhone\b|\biPod\b/.test(s) ? 'mobile'
    : browser || os ? 'desktop' : 'unknown';
  return { browser, os, type };
}

/** `navegador;sistema;tipo` (lo que se guarda en `sessions.device`). */
export const describeUserAgent = (ua: string | null | undefined): string => { const d = summarizeUserAgent(ua); return `${d.browser ?? ''};${d.os ?? ''};${d.type}`; };

export function parseDevice(stored: string | null | undefined): DeviceSummary {
  const [browser, os, type] = (stored ?? '').split(';');
  const types: DeviceType[] = ['desktop', 'mobile', 'tablet', 'cli', 'unknown'];
  return { browser: browser || null, os: os || null, type: types.includes(type as DeviceType) ? type as DeviceType : 'unknown' };
}
