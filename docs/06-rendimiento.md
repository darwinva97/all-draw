# Rendimiento con modelos grandes

Objetivo del plan: **1.000 elementos × 50 vistas fluido**. Este documento recoge el banco de pruebas,
las medidas antes y después de la tanda de optimización del 26 de septiembre de 2026 y lo que queda.

## Banco de pruebas

- `generateLargeWorkspace()` en `packages/core/src/bench.ts`: espacio determinista (PRNG mulberry32
  con semilla) con 1.000 elementos ArchiMate, 50 vistas de 60 nodos (10 % contenedores con 2–3 hijos
  anidados), ~1.500 relaciones válidas según la matriz del pack, ~3.000 aristas y 5 reglas de estilo.
  Con `pack`/`registry` respeta la matriz de validez y las reglas de anidamiento; sin pack usa tipos
  genéricos. Se usa desde los tests y desde la web.
- `packages/core/test/bench.test.ts` y `packages/editor/test/bench.test.ts`: benchmarks con
  `performance.now()` (tres pasadas: se informa de la primera, en frío, y de la mejor; el umbral se
  aplica a la mejor y es **10× el objetivo**, para no fallar por ruido pero sí ante una regresión).
- `apps/web`: en la portada, con `?bench=1` en la URL, aparece el enlace "Espacio grande de prueba
  (1000 × 50)" que crea un espacio local con el generador.
- `e2e/bench.mjs`: abre `?bench=1` con el chromium del sistema (`playwright-core`), crea el espacio,
  espera a que se pinten los 60 nodos de la primera vista, cambia entre vistas y abre el panel de
  problemas; mide con `performance.mark/measure` y `Performance.getMetrics` (CDP). `OUT=fichero.json`
  guarda los números. `BASE=` apunta al servidor (por defecto `http://127.0.0.1:4195`); para medir,
  el build de producción (ver "Cambio de vista" más abajo). `PER_VIEW=300` (y `VIEWS`, `ELEMENTS`)
  genera otro espacio con el núcleo y lo importa; `SWITCHES`, `TRACE=` y `PROFILE=` en la cabecera.

## Núcleo (vitest, Node 22, mejor de tres pasadas; entre paréntesis la primera en frío)

| Medida | Objetivo | Antes | Después |
|---|---|---|---|
| `validate()` completo (refs, tipos, higiene) | < 1 s | 44–58 ms (124–222) | 12–15 ms (32–35) |
| `validate()` + `geometryLint` de las 50 vistas | < 1 s | 409–445 ms (473–568) | 110–151 ms (251–270) |
| `lintView` de una vista de 60 nodos | — | 4,0–5,6 ms | 1,3–1,5 ms |
| `resolveStyle` de los 1.000 elementos (5 reglas) | < 200 ms | 6,4–7,2 ms (9–16) | 3,9–4,7 ms (7–19) |
| `createIndex` (MemoryStore) | < 200 ms | 4,6–8,5 ms | 3,2–4,7 ms |
| `createIndex` (YjsStore) | < 200 ms | 4,8–5,3 ms | 4,8–6,1 ms |
| `execute(moveNodes)` de 100 nodos | < 50 ms | 0,3 ms (1,7–2,0) | 0,2–0,5 ms (1,8–3,6) |
| `MemoryStore.list('nodes')` × 1.000 llamadas | — | 530–627 ms | 0,0–0,1 ms |
| `YjsStore.snapshot()` | < 500 ms | 92–102 ms (222–288) | 54–79 ms (166–202) |
| `loadInto` en `YjsStore` | < 2 s | 33–37 ms (41–58) | 34–54 ms (51–58) |
| `searchWorkspace` ("service 7") | — | 7–8 ms | 5–9 ms |

Los números varían ±30 % entre ejecuciones (JIT, recolector, otros procesos); las diferencias
pequeñas (`loadInto`, `createIndex`, búsqueda) están dentro del ruido y no se tocaron.

## Navegador (`e2e/bench.mjs`, chromium del sistema, 1440×900)

`pnpm dev` (React en modo desarrollo, con StrictMode y `jsxDEV`) frente a `vite preview` de la
compilación de producción. Los tiempos de desarrollo llevan la sobrecarga del runtime de
desarrollo de React (creación de elementos con pila, validación de propiedades, doble render), que
en el perfil supone más de la mitad del tiempo de script.

| Medida | Antes (dev) | Después (dev) | Después (producción) |
|---|---|---|---|
| Crear el espacio y pintar la primera vista (60 nodos, 62 aristas) | 2.850 ms | 1.570–2.110 ms | 1.490 ms |
| Cambiar de vista (media de 5 cambios) | 1.178 ms (980–1.337) | 850–900 ms (680–1.060) | 422 ms (229–544) |
| Panel de problemas tras abrirlo | 1.285 ms, 5.904 notas (todas las vistas) | 125–170 ms, 91 notas (vista actual) | 229 ms |
| Memoria JS tras 5 cambios | 118 MB | 89–95 MB | 38 MB |

Perfil del cambio de vista en producción (~300 ms de muestreo): ~95 ms de JavaScript (React commit,
React Flow) y el resto estilo/composición/pintado del navegador y espera de frames. El coste ya no
está en el modelo sino en montar 60 nodos con figura SVG, sombras y manejadores.

## Qué se cambió

- **`MemoryStore.list()`** cachea la matriz por colección hasta el siguiente `set`/`delete` (como ya
  hacía `YjsStore`). Además, la identidad estable de la lista sirve de clave para otras cachés.
- **`validate`**: `hygiene` usa `indexOf(store).nodesOfView` (antes recorría todos los nodos por
  vista, cuadrático); `typeValidity` calcula las reglas de puertos una sola vez; `traceGaps` indexa
  las parejas trazadas en una pasada; `indexBpmn` usa `nodesOfElement` en vez de recorrer todos los
  nodos por elemento.
- **Contexto de validador con `viewId` opcional** (`ValidatorContext`; `validate(store, reg,
  validators, viewId?)`): `geometryLint` acota el lint a esa vista si se le da. El panel de problemas
  la pasa, así que la geometría solo se calcula para la vista abierta.
- **`geometryLint`**: nodos y aristas de la vista por índice; solapes con barrido por `x` dentro de
  cada grupo (mismo padre y sistema de coordenadas); prefiltro por caja de la ruta antes del recorte
  Liang–Barsky en `edge-through-node` (era el 80 % del lint).
- **Reglas de estilo precompiladas** por identidad de `store.list('rules')`: valor normalizado,
  `RegExp` compilada, conjunto para `in`, número para `gt/lt`; `matchingRules` ya no filtra ni
  ordena la colección por elemento, y las fuentes `people`/`role` usan un mapa elemento → personas
  cacheado por identidad de `store.list('people')`. Las funciones públicas (`condMatches`,
  `ruleMatches`, `resolveStyle`, `resolveRelationStyle`…) conservan su firma.
- **`YjsStore.snapshot()`**: `parseWorkspace` ya construye objetos nuevos para todo lo tipado; solo se
  clonan los valores `unknown` que quedan compartidos (campos, rasgos, meta, estilo de vista), en vez
  de `structuredClone` de todo el documento antes del parseo.
- **`Problems.tsx`**: recalcula con un retardo de 300 ms y en `requestIdleCallback` (o `setTimeout`
  donde no exista), muestra "calculando…" mientras tanto y pasa la vista actual a los validadores.
- **`Canvas.tsx`**: `onlyRenderVisibleElements` cuando la vista tiene más de `VIRTUALIZE_FROM` (300)
  nodos; `rfNodes` ya se construía desde `indexOf(store)` (vista → nodos). **`ElementNode`** tiene
  comparador propio para `memo` (`elementNodePropsEqual`): `data` se compara campo a campo (`node`
  del índice conserva su identidad si el registro no cambió), así mover o seleccionar un nodo no
  vuelve a pintar el resto.
- **Paleta (pestaña Modelo) y paleta de comandos**: pintan 200 entradas y ofrecen "Mostrar más" (sin
  dependencias de virtualización).

## Qué queda

- Cambio de vista: ver la sección "Cambio de vista (30 de septiembre de 2026)" más abajo.
- `snapshot()` sigue costando ~50–80 ms por el parseo Zod de 9.000 registros; si hace falta más,
  cabe un `parse` perezoso por colección.
- Las medidas en navegador con `pnpm dev` no son representativas del producto: para comparar
  versiones úsese `pnpm --filter web build && npx vite preview --port 4196` y `BASE=http://127.0.0.1:4196`.

## Cambio de vista (30 de septiembre de 2026)

Objetivo: < 150 ms en producción para una vista de 60 nodos y fluido con 300.

### Cómo se mide

```bash
pnpm --filter web exec vite build --outDir /tmp/alldraw-bench-dist      # no escribir en apps/web/dist
pnpm --filter web exec vite preview --outDir /tmp/alldraw-bench-dist --port 4199 --host 127.0.0.1
BASE=http://127.0.0.1:4199 node e2e/bench.mjs                           # 60 nodos × 50 vistas (botón de ?bench=1)
BASE=http://127.0.0.1:4199 PER_VIEW=300 node e2e/bench.mjs              # 300 nodos × 12 vistas (importado)
BASE=http://127.0.0.1:4199 TRACE=/tmp/t.json PROFILE=/tmp/p.cpuprofile node e2e/bench.mjs
```

`e2e/bench.mjs` mide ahora dentro de la página: desde el `pointerdown` del clic en el panel de vistas
hasta el primer frame pintado en que ya están los nodos de la vista nueva (comprobado en
`requestAnimationFrame`; el mensaje de un `MessageChannel` llega con ese frame ya pintado). Antes
medía con `Date.now()` alrededor de `click()` + `waitForFunction` de playwright, lo que añade la
espera de "accionabilidad" y el sondeo (~100 ms); ese número se sigue imprimiendo entre paréntesis.
Con la medida antigua, el mismo build de partida daba ~330 ms de media (el 422 de la tabla de arriba
se tomó con el código y la carga de entonces). Informa de mediana, p25–p75, mínimo y máximo.
`PER_VIEW` ≠ 60 genera el espacio con `generateLargeWorkspace` (esbuild al vuelo) y lo importa como
`.json` desde la portada; `SCHEMA_VERSION=1` permite medir builds anteriores a un cambio de esquema.
`TRACE=` resume el hilo principal por categoría (script, estilo, layout, pintado…).

### Resultados

Build de producción (`vite preview`), chromium del sistema, 1440×900, servidor compartido de 8
núcleos con carga 2–4 de otros procesos (los números bailan ±20 %; por eso varias pasadas
intercaladas "antes/después"). "Antes" es el árbol de trabajo al empezar (HEAD `6ba9fed` más los
cambios en curso de otros agentes), compilado igual.

| Cambio de vista | Antes: mediana (p25–p75), media | Después: mediana (p25–p75), media | Muestras |
|---|---|---|---|
| 60 nodos, 62 aristas (1.000 elementos × 50 vistas) | 176 ms (145–198), 185 | **124 ms** (101–151), 139 | 3 × 12 cada uno |
| 300 nodos, ~330 aristas (1.000 × 12 vistas) | 717 ms (642–770), 746 | **384 ms** (368–426), 416 | 2 × 8 |
| 600 nodos, ~600 aristas (1.000 × 8 vistas, virtualizado) | 1.651 ms, 1.667 | **979 ms**, 1.067 | 1 × 6 |

Sin cambios apreciables: crear el espacio y pintar la primera vista (1,1–1,3 s con 60 nodos; 1,7–2,0 s
con 300), memoria JS tras los cambios (25–47 MB con 60 nodos; 105–131 MB con 300) y panel de problemas.
Traza de 8 cambios con 60 nodos (ms del hilo principal): estilo 217 → 92, layout 93 → 79, pintado
87 → 76; el "script" de la traza (1.629 → 1.422) incluye la validación en reposo del panel de
problemas y el propio playwright, así que no es comparable con la tabla.

### Qué costaba (perfil de CPU, build sin minificar)

- **Selectores de nodos ya retirados** (~30 ms por cambio con 60 nodos, ~160 ms con 300): con un solo
  almacén de React Flow para todas las vistas, al cambiar de vista React Flow quitaba los nodos viejos
  de su `nodeLookup` antes de que React los desmontara, y el selector de cada `NodeWrapper` retirado
  (`s.nodeLookup.get(id).internals`) lanzaba una excepción en cada actualización del almacén hasta el
  desmontaje: 420 excepciones por cambio con 60 nodos (contadas parcheando el build).
- **El contexto del editor en cada nodo**: `ElementNode` y `VisualNode` leían `useEditor()`, cuyo valor
  cambia con la selección, la vista y el renombrado; un cambio de contexto atraviesa `memo`, así que
  cualquier selección repintaba todos los nodos. Además cada nodo se suscribía a 3 colecciones del
  store (`useRecord`, `useCollection('rules'|'people')`) y resolvía su estilo.
- **Contenido del nodo**: SVG de la figura (svg + 1–4 paths recalculados en cada render), icono
  (svg + 1–2 paths), etiqueta del tipo. Experimento de cota con 300 nodos: un `ElementNode` mínimo
  (div + nombre + 2 manejadores) bajaba el cambio de ~520 a ~340 ms; el resto es de React Flow
  (`NodeWrapper`: arrastre, `ResizeObserver` y manejadores por nodo), aristas y validación.

### Qué se cambió

- **Un almacén de React Flow por vista** (`<ReactFlowProvider key={viewId}>` en `Canvas`): la vista
  anterior se desmonta de una vez y no quedan selectores de nodos retirados. El encuadre inicial se
  calcula desde el modelo antes del primer pintado (`getViewportForBounds` con los mismos márgenes y
  zoom máximo que `fitView`), así el primer frame sale ya encuadrado sin esperar a medir los nodos, y
  con `onlyRenderVisibleElements` no se monta nada fuera del encuadre. **Cambio de comportamiento:**
  cada vista se encuadra la primera vez que se abre y recuerda su encuadre (`onMoveEnd`) al volver;
  antes, solo la primera vista se encuadraba y las demás heredaban el encuadre de la anterior.
- **Nodos sin `useEditor()`**: leen un contexto propio y estable (`nodes/env.tsx`: registro, solo
  lectura, tema, `run`, `setRenaming`, `lowDetail`). `Canvas` resuelve una vez por construcción el
  elemento, tipo, estilo de reglas (`resolveStyle`, cacheado por elemento hasta que cambian reglas,
  personas, librerías o la vista), puertos y "renombrando" de cada nodo y los pasa en `data`.
- **Identidad estable en `rfNodes`/`rfEdges`**: si un nodo o arista no cambió se devuelve el objeto
  anterior (y su `data`), así React Flow y `memo` no repintan; seleccionar o renombrar un nodo solo
  repinta ese nodo. Incluye los nodos sintéticos de la rejilla.
- **`NodeResizer` solo en el nodo seleccionado** (antes montado con `isVisible=false` en todos).
  `InlineEdit` ya solo se montaba al editar. Los dos manejadores del cuerpo se mantienen: React Flow
  los necesita para situar las aristas (sin ellos no las pinta); los de puertos, como antes, solo si
  los puertos están visibles.
- **`figures.ts`**: `figurePartsCached` / `iconPartsCached`, cachés acotadas (2.000 / 500 entradas,
  FIFO) por `(tipo, figura, w, h, colores, trazo)`; no cambia ninguna geometría. `ArchimateFigure` es
  `memo`.
- **Rectángulo y redondeado de Archi sin SVG**: la figura por defecto de casi todos los tipos (con trazo
  sólido de 1 px) se pinta con un `div` (`.ad-archi-box`) que reproduce exactamente la caja del SVG (que
  va en la caja de relleno, escalado con `xMidYMid meet`). Comparado píxel a píxel con el build
  anterior (880×824, zoom 100 % y ajustado, tema claro y oscuro): ≤ 5 píxeles distintos, salvo
  aristas desplazadas medio píxel en el tema oscuro ajustado (los manejadores se miden a otro zoom).
  Las demás figuras (octógono de Motivación, alternativas, trazos discontinuos o gruesos) siguen en SVG.
- **Menos detalle con zoom bajo** (< 0,3, `LOW_DETAIL_ZOOM`): sin icono de Archi (< 5 px en pantalla)
  ni nombre del tipo (< 3 px). Cambia solo al cruzar el umbral. A ese zoom se ve una vista de 300 nodos
  entera (zoom ajustado ~0,18); las de 60 nodos se abren a ~0,45, con todo el detalle.

Probado y descartado:

- Icono como imagen `data:` compartida (`::after` con una URL por tipo y color, sin DOM por nodo): más
  lento (mediana 161 ms frente a 120 ms con el SVG en línea, 60 nodos) por la decodificación de cada
  SVG-imagen. No se probó `<use href>` a un `<symbol>` compartido: el icono son 1–2 paths y `<use>`
  clona un árbol en sombra por instancia, así que no se espera ganancia.
- Caja de la figura como `::before` con variables CSS en línea (sin elemento): igual o algo peor que el
  `div` (las 6 variables se heredan a todo el nodo). Con `@property … inherits: false` el pseudo-elemento
  tampoco las recibe.
- `contain: layout paint` en `.ad-node`: la contención de pintado recortaría la insignia, las etiquetas
  de puertos, el texto de las formas pequeñas (debajo del nodo) y el contorno de selección; y el estilo
  y el layout ya no pesan (ver traza). No hay sombras en los nodos salvo las de reglas (`glow`, acentos),
  que las figuras de Archi ya ignoraban.
- Bajar `VIRTUALIZE_FROM` (300): al abrir una vista se encuadra entera y todo es visible, así que no
  reduce el montaje del cambio; solo ayuda al volver a una vista ampliada, a cambio de montar y
  desmontar nodos al desplazarse.

### Qué queda

- Con 300 nodos (~380 ms), la mayor parte es de React Flow por nodo (`NodeWrapper` con arrastre,
  `ResizeObserver` y manejadores) y de las aristas (`RelationEdge`, ~20 ms por cambio con 300). Para
  bajar de ahí: montar por tandas en varios frames, o un modo de "vista previa" estática al cambiar.
- El panel de problemas valida 300 ms después de cada cambio (en reposo): con 300 nodos son ~70 ms que
  pueden caer dentro de la interacción siguiente.
- Con 600 nodos el cambio sigue en ~1 s.

## Formato de registros 2: `Y.Map` por registro (5 de octubre de 2026)

Para que dos personas puedan editar a la vez campos distintos del mismo elemento (y escribir en el mismo texto), cada
registro del `Y.Doc` pasó de ser un objeto JSON (un elemento de Yjs por registro) a un `Y.Map` de campos, con bolsas
`Y.Map` (`fields`, `props`, `style`…) y textos largos `Y.Text` (ver `packages/sync/src/ydoc.ts`). Más elementos de Yjs
por registro es más trabajo al crear y al decodificar; estas medidas comparan el `YjsStore` anterior con el nuevo sobre
el espacio grande (1.000 elementos, 3.256 relaciones, 50 vistas, 3.000 nodos, 3.675 aristas).

### Cómo se mide

Las dos implementaciones en el mismo proceso, alternándolas (6 rondas; cada medida es la mejor de 9 pasadas), con
`tsx` y Node 22, en la VPS compartida con otros procesos (carga 8–11 en 8 núcleos: el ruido es grande, por eso se dan
la mediana de las rondas y, entre paréntesis, el mínimo). El banco permanente es `packages/sync/test/bench.test.ts`
(umbrales 10× lo medido) junto a `packages/editor/test/bench.test.ts`.

| Medida (espacio grande) | Formato 1 (JSON) | Formato 2 (`Y.Map`) | Diferencia |
|---|---|---|---|
| `loadInto` en caliente (banco del editor: mismo store, mejor de tres) | 19 ms (9) | 24 ms (17) | +25 % |
| `YjsStore.snapshot()` | 75 ms (53) | 54 ms (42) | −28 % |
| `createIndex` (YjsStore) | 4,7 ms (3,3) | 3,4 ms (2,5) | −28 % |
| Abrir: `applyUpdate` del doc completo | 102 ms (86) | 102 ms (97) | ≈ 0 % |
| Abrir: `applyUpdate` + `list()` de todas las colecciones | 96 ms (85) | 120 ms (97) | +24 % |
| `execute(moveNodes)` de 100 nodos | 0,5 ms (0,3) | 1,6 ms (1,2) | ×3 (+1 ms) |
| Renombrar un elemento + `list` + `get` | 0,1 ms | 0,1 ms | = |
| `loadInto` en un store **vacío** (crear o importar) | 17 ms (14) | 99 ms (72) | ×5–6 (+80 ms) |
| Tamaño del doc (update completo) | 1.688 KB | 1.354 KB | −20 % |
| Elementos de Yjs (structs) | ~11.000 | ~39.400 | ×3,6 |

Lo que entra en el ±30 %: el banco del editor (`loadInto` en caliente, `snapshot`, `createIndex`, `nodesOfView`) y
abrir un espacio. Lo que no, y por qué se acepta:

- **Crear o importar en un store vacío** (×5–6): es una vez por espacio (plantilla, importación, subir al servidor) y
  son 100 ms para 11.000 registros; el coste es inherente a tener un elemento de Yjs por campo, que es justo lo que
  permite fusionar campo a campo.
- **Mover 100 nodos** (×3): ~1,5 ms por comando (Yjs crea un evento por registro anidado cambiado); muy por debajo de
  un frame, también arrastrando una selección grande.

### Qué se hizo para que no costara más

Una primera versión «ingenua» (todo campo, bolsa y texto como elemento de Yjs, también los vacíos) costaba al abrir
×2,5 (`applyUpdate` 190–340 ms), cargar en frío ×8 y ocupaba un 30 % más. Lo que lo deja en lo de la tabla:

- **No se guardan los vacíos por defecto** (`''`, `[]`, `{}` del esquema, `EMPTY_DEFAULTS`) ni el `id` (es la clave):
  se reponen al leer. Excepción: `doc`, `fields` y `props` de los elementos y `doc` de las vistas se crean siempre
  (`EAGER_KEYS`), porque es donde dos personas escriben a la vez en un elemento recién creado y, si cada una creara
  su `Y.Text`/`Y.Map`, ganaría una. En relaciones no se crean siempre: hay 3 veces más relaciones que elementos y
  costaban un 30 % más al abrir.
- **Claves agrupadas** (`PACKED_KEYS`): los extremos de aristas (`viewId`, `relationId`, nodos y puertos) y relaciones
  (`typeId`, `from`, `to`) y la vista/elemento de un nodo van en un único valor atómico `$`. Son una unidad (mezclar
  el origen de una persona con el puerto de otra daría algo inválido) y casi nunca cambian; ahorran ~20.000 elementos.
- **Caché de registros planos** por id (la identidad se mantiene hasta que el registro cambia, igual que antes) y
  `list()` reconstruida desde esa caché.
- **`set` sin cambios no escribe** (compara con el registro en caché) y, dentro de una transacción, **borrar y volver a
  escribir el mismo registro es un diff** (los borrados se aplazan al final de `transact`): `loadInto` sobre el mismo
  contenido no genera ningún update, y restaurar una instantánea solo toca lo que difiere.
