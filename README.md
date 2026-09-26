# all-draw

Diagramador universal: **un modelo, muchas notaciones como dimensiones**. Un mismo elemento vive en
vistas ArchiMate, BPMN, máquinas de estado, C4, capas×etapas o lienzo libre; desde cualquier nodo se
cambia de dimensión o se entra en su detalle. Los valores tipados de cada componente son **pines**
conectables. Funciona offline y online (Yjs).

- `docs/` — análisis, plan, decisiones, comparativa e inventarios de las herramientas de referencia.
- `packages/core` — modelo (Zod), store, comandos con inverso, puertos derivados, registro de notaciones, reglas, diagnósticos.
- `packages/notations/*` — packs de notación como datos (ArchiMate generado desde los ficheros de Archi).
- `packages/editor` — editor React Flow.
- `packages/io` — importadores/exportadores (`.drawer`, ArchiMate, BPMN…).
- `packages/sync` — Yjs: IndexedDB local y proveedor WebSocket.
- `apps/web` — aplicación (Vite + React, PWA).
- `apps/server` — servidor Node: cuentas, permisos, sincronización Yjs, API REST (`/api/openapi.json`), MCP y `SKILL.md` para agentes.
- `packages/layout` — elkjs y lint geométrico.

```bash
pnpm install
pnpm test          # unitarios (vitest)
pnpm dev           # http://127.0.0.1:4173
pnpm build         # apps/web/dist (PWA)
pnpm start         # servidor Node: estáticos + sincronización Yjs en /ws/<sala> (puerto 4002)
pnpm e2e           # pruebas con el chromium del sistema (necesita `pnpm dev` y `pnpm start` levantados)
```

Staging: https://alldraw.bezenti.com. Estado detallado y pendientes en `docs/05-estado.md`.

Licencia MIT. Reutiliza código MIT de [archify](https://github.com/tt-a1i/archify) y datos de [Archi](https://github.com/archimatetool/archi).
