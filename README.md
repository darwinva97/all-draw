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

Staging: https://alldraw.bezenti.com.

## Documentación

- **Manual de usuario** (`docs/manual/`, con capturas): [Primeros pasos](docs/manual/01-primeros-pasos.md) ·
  [Modelo y vistas](docs/manual/02-modelo-y-vistas.md) · [Editor](docs/manual/03-editor.md) ·
  [Notaciones](docs/manual/04-notaciones.md) · [Librerías, reglas y personas](docs/manual/05-librerias-reglas-personas.md) ·
  [Compartir y colaborar](docs/manual/06-compartir-y-colaborar.md) · [Importar y exportar](docs/manual/07-importar-exportar.md) ·
  [Agentes y API](docs/manual/08-agentes-y-api.md) · [Desplegar](docs/manual/09-desplegar.md).
- **Estado del proyecto y pendientes**: [`docs/05-estado.md`](docs/05-estado.md).
- Para agentes: [`apps/server/SKILL.md`](apps/server/SKILL.md) y `GET /api/openapi.json`; servidor: [`apps/server/README.md`](apps/server/README.md).
- Accesibilidad: `node e2e/a11y.mjs` (con `pnpm dev` levantado) comprueba nombres accesibles, etiquetas de campos, diálogos y foco.

Licencia MIT. Reutiliza código MIT de [archify](https://github.com/tt-a1i/archify) y datos de [Archi](https://github.com/archimatetool/archi).
