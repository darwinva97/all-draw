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
  espera a que se pinten los 60 nodos de la primera vista, cambia entre 5 vistas y abre el panel de
  problemas; mide con `performance.mark/measure` y `Performance.getMetrics` (CDP). `OUT=fichero.json`
  guarda los números. Requiere `pnpm dev --port 4195` en `apps/web` (o `BASE=` otra URL).

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

- El cambio de vista en producción (~400 ms para 60 nodos) está dominado por el montaje y pintado
  de los nodos (figuras SVG, sombras, manejadores de React Flow), no por el modelo. Opciones:
  aligerar el CSS de los nodos (sombras y `color-mix`), diferir el `MiniMap`, y medir con el
  perfilador de React si el contexto del editor (que cambia con la selección) hace pasar por todos
  los nodos.
- `snapshot()` sigue costando ~50–80 ms por el parseo Zod de 9.000 registros; si hace falta más,
  cabe un `parse` perezoso por colección.
- Las medidas en navegador con `pnpm dev` no son representativas del producto: para comparar
  versiones úsese `pnpm --filter web build && npx vite preview --port 4196` y `BASE=http://127.0.0.1:4196`.
