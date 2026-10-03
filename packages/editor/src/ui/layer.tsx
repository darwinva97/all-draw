/**
 * Capa de interfaz flotante (avisos, diálogos y lo que la app quiera añadir): una raíz de React propia montada
 * bajo demanda en `document.body`, fuera del editor. Así `toast()` y `confirmDialog()` se pueden llamar desde
 * cualquier sitio (paneles, la app, código no React) sin montar proveedores.
 *
 * El tema sale de `<html data-theme>` (lo fija el editor mientras está abierto y la app fuera de él) o, si no
 * hay, de `prefers-color-scheme`.
 */
import { Fragment, useSyncExternalStore, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './ui.css';

const parts = new Map<string, ComponentType>();
const listeners = new Set<() => void>();
let version = 0;
let root: Root | null = null;

function Layer() {
  useSyncExternalStore(f => { listeners.add(f); return () => listeners.delete(f); }, () => version);
  return <>{[...parts.entries()].map(([k, C]) => <Fragment key={k}><C /></Fragment>)}</>;
}

/** Añade (o sustituye) un componente en la capa flotante y la monta si hace falta. Sin `document` no hace nada. */
export function mountInLayer(key: string, part: ComponentType): void {
  if (typeof document === 'undefined') return;
  if (parts.get(key) === part && root) return;
  parts.set(key, part);
  version++;
  if (!root) {
    const el = document.createElement('div');
    el.className = 'ad-layer';
    document.body.appendChild(el);
    root = createRoot(el);
    root.render(<Layer />);
  }
  for (const f of listeners) f();
}

/** ¿El evento viene de dentro de la capa flotante? Los atajos y las trampas de foco del editor lo ignoran. */
export function inLayer(e: Event): boolean {
  const t = e.target as Element | null;
  return !!t && typeof t.closest === 'function' && !!t.closest('.ad-layer');
}

/** Selector de controles enfocables (trampas de foco). */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
