/**
 * Punto de entrada estable (la unidad systemd ejecuta `node src/server.mjs`).
 * El servidor está en TypeScript (`server.ts`) e importa los paquetes del monorepo directamente
 * desde sus fuentes `.ts` (con imports sin extensión), cosa que `--experimental-strip-types` no
 * resuelve; por eso se carga con el loader de `tsx`.
 */
import { register } from 'tsx/esm/api';
register();
await import('./server.ts');
