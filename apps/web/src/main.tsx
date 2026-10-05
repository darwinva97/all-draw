import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ready } from '@all-draw/i18n';
import { z } from 'zod';
z.config({ jitless: true }); // evita la sonda `Function('')` de zod, incompatible con la CSP sin unsafe-eval
import './index.css';
import { App } from './App';
import { ErrorBoundary, installGlobalErrorHandlers } from './errors';

// Errores no capturados → `POST /api/client-errors` (deduplicados y muestreados; nunca el contenido del diagrama).
installGlobalErrorHandlers();

// Direcciones limpias: /docs, /docs/<capítulo>, /bienvenida y /espacios llevan a su ruta (#/…) de la app.
{
  const m = /^\/(docs(?:\/[\w/-]*)?|bienvenida|espacios)\/?$/.exec(location.pathname);
  if (m && !location.hash) history.replaceState(null, '', `/#/${m[1]}${location.search}`);
}

// El diccionario del idioma activo se carga aparte: se espera (breve) para no pintar un instante en otro idioma.
void ready().finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>));
