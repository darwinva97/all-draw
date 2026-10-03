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

Manual de uso en línea: **https://alldraw.bezenti.com/docs** (español e inglés, con búsqueda). Las fuentes están en `docs/manual/`.

- **Centro de documentación dentro de la app**: <https://alldraw.bezenti.com/#/docs>, en español e inglés, con búsqueda,
  referencia de notaciones generada desde los packs y lista de endpoints leída de `/api/openapi.json`. Visor en
  [`apps/web/src/docs/`](apps/web/src/docs/README.md) (rutas `#/docs/<slug>#<ancla>`, `docHref()` en `links.ts`).
- **Manual de usuario** (Markdown con capturas): [`docs/manual/`](docs/manual/) en español y [`docs/manual/en/`](docs/manual/en/)
  en inglés. Empieza por [Primeros pasos](docs/manual/primeros-pasos.md) y [Conceptos](docs/manual/conceptos.md); también
  [Editor](docs/manual/editor.md), [Notaciones](docs/manual/notaciones.md), [Compartir y colaborar](docs/manual/compartir-y-colaborar.md),
  [Importar y exportar](docs/manual/importar-exportar.md), [Agentes y API](docs/manual/agentes-y-api.md) (incluye cómo instalar tu
  propio servidor), [FAQ](docs/manual/faq.md) y [Glosario](docs/manual/glosario.md). Las imágenes de `docs/manual/img/` se copian a
  `apps/web/public/docs-img/` en `prebuild` (`apps/web/scripts/copy-docs-img.mjs`).
- **Estado del proyecto y pendientes**: [`docs/05-estado.md`](docs/05-estado.md).
- Para agentes: [`apps/server/SKILL.md`](apps/server/SKILL.md) y `GET /api/openapi.json`; servidor: [`apps/server/README.md`](apps/server/README.md).
- Accesibilidad: `node e2e/a11y.mjs` (con `pnpm dev` levantado) comprueba nombres accesibles, etiquetas de campos, diálogos y foco.
- Documentación: `node e2e/docs.mjs` (con `pnpm --filter web dev --port 4310`) recorre todos los capítulos en los dos idiomas, enlaces, imágenes y búsqueda.

Licencia MIT. Reutiliza código MIT de [archify](https://github.com/tt-a1i/archify) y datos de [Archi](https://github.com/archimatetool/archi).
