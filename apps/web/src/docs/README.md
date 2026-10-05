# Centro de documentación (`#/docs`)

Visor del manual de usuario dentro de la app. El contenido vive en `docs/manual/` (Markdown, español),
`docs/manual/en/` (inglés, completo) y `docs/manual/pt/` y `docs/manual/fr/` (portugués de Brasil y francés, en parte),
siempre con los mismos nombres de fichero; este directorio solo tiene el visor.

| Fichero | Qué hace |
|---|---|
| `links.ts` | `DOC_SLUGS`, `docHref(slug, anchor?)`, `parseDocsHash(hash)`. **Lo que deben usar otras pantallas para enlazar.** Sin dependencias: importarlo no arrastra el visor. |
| `chapters.ts` | Índice: grupos de la barra lateral, orden, fichero de cada slug y carga perezosa de los `.md` (`import.meta.glob`). |
| `markdown.tsx` | Renderizador mínimo propio (Markdown → elementos React, sin `dangerouslySetInnerHTML`). |
| `DocsScreen.tsx` | Pantalla: barra lateral, contenido, tabla de contenidos, búsqueda, anterior/siguiente, tema, móvil, impresión. Se carga con `lazy()` desde `App.tsx`. |
| `search.ts` | Índice de búsqueda en memoria (se construye al buscar por primera vez). |
| `NotationRef.tsx` | Referencia de notaciones **generada desde los packs** (`PACKS`, `localizePack`). |
| `ApiRef.tsx` | Lista de endpoints leída en tiempo de ejecución de `/api/openapi.json`. |

## Rutas

- `#/docs` — índice (portada del centro de documentación).
- `#/docs/<slug>` — capítulo. Slugs: los de `DOC_SLUGS` (`primeros-pasos`, `conceptos`, …, `notaciones/<packId>`).
- **Ancla dentro de un capítulo: `#/docs/<slug>#<id>`** (segundo `#`). El visor también acepta `#/docs/<slug>?h=<id>`
  por compatibilidad, pero genera siempre la forma con `#`. Usa `docHref('conceptos', 'pines')`.
- `?q=<texto>` resalta el texto en el capítulo (lo añade la búsqueda).

Slug desconocido → página "no encontrado" con enlace al índice.

## Convenciones del Markdown (para quien escriba en `docs/manual/`)

El renderizador entiende un subconjunto de GitHub Markdown. Lo que no está aquí se muestra como texto.

- **Un `# Título` por fichero**, en la primera línea. Es el `h1` y el título de la pestaña.
- **Ids estables en `##` y `###`**: `## Pines {#pines}`. El id va en español (sin acentos, minúsculas, guiones) y es
  **el mismo en la versión inglesa** (`## Pins {#pines}`), así `docHref('conceptos', 'pines')` vale en los dos idiomas.
  Sin `{#id}` se genera uno a partir del texto. GitHub muestra el `{#id}` como texto: es aceptable.
- Párrafos, `**negrita**`, `*cursiva*`, `` `código` ``, `~~tachado~~`, saltos de línea duros no.
- Listas `-` / `1.` con anidamiento por sangría de 2–4 espacios; listas de tareas no.
- Tablas GFM (`| a | b |` + `|---|:---:|`).
- Bloques de código con lenguaje: ```` ```bash ````, ```` ```json ````… (botón copiar en el visor).
- Citas `>`; avisos estilo GitHub: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` en la
  primera línea de la cita.
- Imágenes en línea propia: `![Texto alternativo](img/03-editor-archimate.png)` (ruta **relativa al fichero**: desde
  `en/` o `notaciones/` es `../img/…`; desde `en/notaciones/` es `../../img/…`). Se sirven desde `/docs-img/` (las copia
  `apps/web/scripts/copy-docs-img.mjs` en `prebuild`). El texto alternativo se muestra como pie de figura.
  Diagramas propios en SVG: `img/<nombre>.es.svg` y `img/<nombre>.en.svg` si llevan texto.
- Enlaces internos **a ficheros `.md`**, relativos: `[Conceptos](conceptos.md)`, `[pines](conceptos.md#pines)`,
  desde `notaciones/`: `[Editor](../editor.md)`, `[BPMN](bpmn.md)`. En el visor se convierten en `#/docs/<slug>#<id>`;
  en GitHub siguen funcionando. Desde `en/` se enlaza a los hermanos de `en/` igual (`conceptos.md`).
- Enlaces externos `https://…` (se abren en otra pestaña) y `/api/openapi.json` (ruta absoluta del servidor).
- Regla horizontal `---`.
- HTML: no se interpreta (se escapa), **salvo** estos comentarios-directiva, invisibles en GitHub:
  - `<!-- docs:notation-index -->` — tarjetas de todas las notaciones (en `notaciones.md`).
  - `<!-- docs:notation-ref <packId> -->` — referencia generada del pack (al final de `notaciones/<packId>.md`).
  - `<!-- docs:api-ref -->` — endpoints de `/api/openapi.json` (en `agentes-y-api.md`).
  - `<!-- docs:chapters -->` — lista de capítulos agrupada (portada).

## Idioma

`useLang()` decide la carpeta. Si un capítulo no existe en ese idioma se usa el primero que lo tenga según
`chapterLangs()` (portugués y francés → inglés → español) y se muestra un aviso traducido («Este capítulo todavía no
está traducido; se muestra la versión en inglés/español»). En pt y fr están traducidos `primeros-pasos`, `conceptos`,
`faq`, `glosario`, `privacidad`, `terminos` y `atajos`; usan las capturas inglesas (`../img/*-en.png`, `*.en.svg`).
En francés, espacio insecable antes de `: ; ? !` y dentro de « ».
Los textos de la interfaz del visor usan `useT()`; sus claves están en `packages/i18n/src/en.ts`, bloque
`// ==== Documentación` (y las mismas claves en `pt.ts` y `fr.ts`).

## Comprobación

`node e2e/docs.mjs` con `pnpm --filter web dev --port 4310` levantado (variable `BASE` para otra URL): recorre todos
los slugs en `es-ES` y `en-US`, exige un `h1`, que los enlaces `#/docs/…` existan, que no haya imágenes rotas y que la
búsqueda encuentre "pines"; deja capturas en `/tmp/shots/docs-*.png`.
