import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
z.config({ jitless: true }); // evita la sonda `Function('')` de zod, incompatible con la CSP sin unsafe-eval
import './index.css';
import { App } from './App';
import { ErrorBoundary, installGlobalErrorHandlers } from './errors';

// Errores no capturados → `POST /api/client-errors` (deduplicados y muestreados; nunca el contenido del diagrama).
installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
