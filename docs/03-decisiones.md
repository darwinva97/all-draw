# Decisiones (2026-09-18)

Confirmadas por el usuario tras el análisis:

1. **Proyecto nuevo**, en repositorio propio (propuesta: `darwinva97/all-draw`). Importador `.drawer` para traer lo hecho en Drawer.
2. **Canvas: React Flow** (`@xyflow/react`).
3. **Local-first: Yjs** (`y-indexeddb` en cliente, `UndoManager`, awareness). Elegido sobre Loro por ecosistema; la capa de sync queda detrás de una interfaz para poder cambiar.
4. **Despliegue agnóstico, primero Cloudflare.** Servidor en Hono (corre en Workers, Node, Bun, Lambda). Persistencia detrás de un puerto `WorkspaceStore` con adaptadores: Durable Object (Cloudflare), SQLite/Postgres (VPS, AWS). La sala Yjs igual: Durable Object o proceso Node con `y-websocket`.
5. **Orden de notaciones** (propuesta aceptada para empezar): ArchiMate → máquinas de estado → BPMN (subconjunto) → C4. Después: secuencia, ER, flujo de datos, y las "escenas libres" del catálogo corporativo.
6. **Ambición**: "diagramar cualquier cosa que pueda existir". Consecuencia de diseño: el núcleo no conoce ninguna notación; todo tipo de elemento, relación, puerto, viewpoint y renderer entra como *notation pack* de datos + componentes. La notación `freeform` (cajas, texto, flechas, imágenes, contenedores) es la red de seguridad para lo que aún no tenga pack.

## Nombre y dominio (propuesta, pendiente)

- Nombre de trabajo: **all-draw**. Alternativas: *Trama* (tejido de vistas), *Dimensio*, *Atlas*.
- Dominio de staging: `alldraw.bezenti.com` en esta VPS (Caddy) durante las fases 0–3; producción en Cloudflare desde la fase 4. `draw.bezenti.com` sigue siendo Drawer hasta que all-draw lo importe todo.

## Borradores

En `docs/borradores/` (JSON fuente en formato archify, HTML autocontenido y PNG):

- `arquitectura` — paquetes del monorepo y adaptadores de despliegue.
- `modelo` — entidades: Element/Port/Relation (semántica) vs View/ViewNode/ViewEdge (presentación), Dimension y detailViewId.
- `dimensiones` — el proceso "Alta de cliente" visto en BPMN, estados, ArchiMate y APIs con un pin `score → kycScore`.
- `fases` — hoja de ruta con las 7 fases y las 3 entregas.

Regenerar: `node _research/archify/archify/bin/archify.mjs render <tipo> <spec.json> <out.html>` y captura con `chromium --headless=new --screenshot`.


## Actualización 26 de septiembre de 2026

Repositorio creado: https://github.com/darwinva97/all-draw (público, MIT). Nombre definitivo del producto: **all-draw**. Staging: https://alldraw.bezenti.com.
