# Lenguaje textual (DSL)

all-draw tiene un lenguaje de texto para describir un espacio entero —modelo, vistas, librerías— en un fichero que
se lee, se escribe a mano, se compara en Git y se genera desde un script. Se parece a Structurizr DSL y a LikeC4, pero
usa los tipos de **todas** las notaciones de all-draw (`archimate:BusinessActor`, `bpmn:Task`, `c4:Container`,
`uml:Class`…). Los ficheros llevan la extensión `.alldraw.txt`.

## Para qué sirve {#para-que}

- **Escribir un modelo deprisa**: diez líneas de texto y all-draw coloca las vistas solo con el layout automático.
- **Revisar cambios**: el texto es estable (el mismo espacio da siempre el mismo texto), así que un `git diff` dice
  exactamente qué ha cambiado.
- **Generar modelos** desde otros sistemas (un inventario, una CMDB, un script) sin conocer el JSON interno.
- **Ida y vuelta sin pérdidas**: exportar a texto e importarlo de nuevo da el mismo espacio, con los mismos ids.

## Exportar e importar {#exportar-importar}

- **Exportar**: **Importar / Exportar → Exportar el espacio → Texto de all-draw (DSL)** descarga `<espacio>.alldraw.txt`.
- **Importar**: como cualquier otro fichero (**Inicio → Importar…** o **Importar (sustituye el espacio)**). all-draw lo
  reconoce por la extensión `.alldraw.txt`, por la primera línea `// all-draw DSL v1` o por su contenido.
- Si alguna vista **no tiene posiciones** (ningún `at`), al importarla se le aplica el
  [layout automático](editor.md) según su notación.
- Si el texto tiene un error, la importación se detiene y dice **la línea y la columna** y qué se esperaba.

## Un ejemplo {#ejemplo}

```text
// all-draw DSL v1
workspace "Tienda" {
  description "Arquitectura mínima de la tienda online"

  model {
    cliente = archimate:BusinessActor "Cliente" {
      doc "Quien compra en la tienda"
    }
    web = archimate:ApplicationComponent "Tienda web" {
      version = "3.2"                       // un campo del elemento
      api = archimate:ApplicationInterface "API REST"   // anidado dentro de «web»
    }
    catalogo = archimate:ApplicationService "Catálogo"
    web -> catalogo : archimate:Realization
    sirve = catalogo -> cliente : archimate:Serving "consulta productos"
  }

  views {
    view mapa "Mapa de aplicaciones" {
      notation archimate
      include *                             // todos los elementos y sus relaciones
      note "Borrador para la reunión del lunes"
    }
  }
}
```

Sin posiciones: al importarlo, all-draw coloca la vista «Mapa de aplicaciones» automáticamente.

## Reglas básicas {#reglas}

- **Una instrucción por línea** (o varias separadas por `;`). Los bloques `{ … }` se abren al final de la línea de su
  instrucción y se cierran con `}`.
- **Comentarios**: `// hasta el final de la línea` y `/* de bloque */`.
- **Textos** entre comillas dobles, con los escapes de JSON: `"Línea 1\nLínea 2"`, `"comillas \"dentro\""`.
- **Ids**: letras, números, `_`, `$`, `.` y `-`, empezando por letra, `_` o `$`; pueden tener segmentos `:` (`n:A`).
  Cualquier otro id va entre acentos graves: `` `mi id con espacios` ``, `` `1` ``. Las palabras reservadas
  (`view`, `include`, `as`, `from`…) también van entre acentos graves cuando son ids.
- **Tipos**: siempre `pack:Tipo` (`bpmn:Task`, `lib:mi-libreria:Servicio`). La lista de tipos de cada notación está en
  la [referencia de notaciones](notaciones.md).
- **Valores**: textos, números, `true`, `false`, `null`, listas `[a, b]` y objetos `{ "clave": valor }` (JSON, con
  claves con o sin comillas y saltos de línea dentro). Donde se espera un nombre (`notation archimate`) vale un id
  suelto.

## Elementos {#elementos}

```text
id = pack:Tipo "Nombre" {
  doc "Documentación"
  tags ["crítico", "pagos"]
  props { "propietario": "Ana" }        // propiedades libres
  campo = "valor"                       // campos del tipo (`clave = valor`)
  hijo = pack:Tipo "Hijo"               // elemento anidado
}
```

- El **id** es opcional: `archimate:ApplicationService "Catálogo"` crea el id `catalogo` a partir del nombre.
- El **nombre** también es opcional (`archimate:Junction`).
- **Campos**: `clave = valor`. El valor es un literal (texto, número, lista, objeto…); una palabra suelta sin `:`
  también vale como texto (`kind = database`).
- **Anidar** un elemento dentro de otro guarda la jerarquía del modelo (`features.parentId`): sistema ⊃ contenedor ⊃
  componente en C4, por ejemplo.
- Otros atributos: `features { … }`, `ports [ … ]`, `profiles [ … ]`, `library id-de-librería`, `template true`,
  `templateId id`.

## Relaciones {#relaciones}

```text
[id =] origen -> destino [: pack:Tipo] ["Nombre"] {
  doc "…"
  condicion = "importe > 100"           // campos del tipo de relación
  fromPort "pedido#response.email"      // extremos en un pin
  toPort "avisos#request.destinatario"
  map "response.email" -> "request.destinatario"   // conexión campo a campo
}
```

- Sin tipo, la relación es `core:link`. Sin id, se genera uno (`rel_origen_destino`).
- El origen o el destino pueden ser **otra relación** (relaciones sobre relaciones de ArchiMate): escribe su id.
- Deja **un espacio a cada lado de los dos puntos**: `b : tipo` (`b:tipo` se leería como un solo id).

## Vistas {#vistas}

```text
view id "Nombre" {
  notation bpmn                 // notación (por defecto, libre)
  kind grid                     // freeform, grid, sequence, tree o matrix
  viewpoint layered             // viewpoint de ArchiMate o C4
  root proceso                  // elemento que la vista detalla
  doc "…"

  include pool at 40, 40 size 600, 300 {        // nodo de un elemento, con posición y tamaño
    include tarea at 60, 50                      // anidado: coordenadas relativas al padre
  }
  include tarea as tarea2 at 400, 50             // segunda aparición del mismo elemento: necesita id propio
  note "Revisar con Legal" as nota at 700, 40    // nodos visuales: note, label, group, image
  edge flujo1 via 300, 80  300, 140              // la arista de una relación, con puntos de quiebre
  edge flujo2 from tarea2 to fin                 // extremos explícitos (si el elemento aparece varias veces)
  edge as linea1 from nota to tarea              // arista sin relación (línea a una nota)
}
```

- `include a, b, c` añade varios elementos; `include *`, todos los del modelo (y las relaciones entre ellos).
- `edge *` dibuja todas las relaciones entre los elementos ya incluidos.
- `at x, y` y `size ancho, alto` son opcionales. **Si ningún nodo de la vista tiene `at`**, al importar se coloca con
  el layout automático.
- Dentro del bloque de un nodo: `style { "fill": "#fde68a" }`, `detail id-de-vista` (vista de detalle con doble clic),
  `text "…"` (etiqueta distinta del nombre), `z 2`, `instanceNote "…"`, `meta { … }`.
- En aristas: `label "…"`, `fromPort "…"`, `toPort "…"`, `style { "line": "dashed" }`.
- Ids de nodos y aristas: si no los escribes, son `<vista>.<elemento>` y `<vista>.<relación>`.

### Capas × etapas {#rejilla}

```text
view mapa "Mapa" {
  kind grid
  stagegroup fase1 "Fase 1" color "#e0e7ff"
  layer negocio "Negocio" color "#fef3c7" size 200
  stage descubrir "Descubrir" size 220 in fase1
  include buscar at 20, 20 cell negocio descubrir
}
```

## Librerías y otros registros {#librerias}

```text
library servicios "Servicios" {
  description "Tipos propios del equipo"
  elementType lib:servicios:svc "Microservicio" {
    color "#c7d2fe"
    category "Servicios"
    field repo "Repositorio" url
    field estado "Estado" select { "options": "activo,retirado" }
  }
  relationType lib:servicios:llama "Llama a" { line "dashed" }
}
```

Las dimensiones, personas, reglas de estilo y comentarios se escriben como registros con sus atributos tal cual:
`dimension dim_c4 "C4" { notationId "c4" }`, `person ana "Ana" { email "ana@example.com" }`,
`rule r1 "Críticos en rojo" { … }`, `comment c1 { … }`. El exportador los escribe siempre; a mano rara vez hacen falta.

## Errores {#errores}

Cada problema dice línea y columna:

| Mensaje | Causa típica |
|---|---|
| Se esperaba fin de línea y se encontró `"…"` | Dos nombres seguidos, o falta el `{` al final de la línea. |
| Texto sin cerrar (falta la comilla final) | Una comilla de más o de menos. |
| Falta «}» para cerrar el bloque abierto en la línea *N* | Un bloque sin cerrar. |
| Id repetido «x» | Dos elementos (o vistas, nodos…) con el mismo id. |
| La relación «r» no tiene nodos en la vista «v» | `edge r` en una vista que no incluye sus extremos. |
| «x» no parece un tipo (se esperaba pack:Tipo) | Falta el prefijo de la notación. |

Al importar se detiene en el primer **error**; los **avisos** (un elemento que no existe en `include`, una vista de
detalle que no está) se muestran en la lista de avisos y la importación sigue.

## Gramática {#gramatica}

```text
fichero      = [ "workspace" [TEXTO] "{" ] { instrucción } [ "}" ]
instrucción  = "name" TEXTO | "description" TEXTO | "current" ID | "created" TEXTO | "updated" TEXTO
             | "model" "{" { elemento | relación } "}"
             | "views" "{" { vista } "}" | vista
             | "library" ID [TEXTO] "{" { atributo | tipo } "}"
             | ("dimension" | "person" | "rule" | "comment") ID [TEXTO] [ "{" { ID VALOR } "}" ]
             | elemento | relación
elemento     = [ID "="] TIPO [TEXTO] [ "{" { atributo | campo | elemento | relación } "}" ]
campo        = ID "=" VALOR
relación     = [ID "="] REF "->" REF [":" TIPO] [TEXTO] [ "{" { atributo | campo | "map" TEXTO "->" TEXTO [TEXTO] } "}" ]
vista        = "view" [ID] [TEXTO] "{" { atributo | rejilla | nodo | arista } "}"
rejilla      = "layer" ID TEXTO ["color" TEXTO] ["size" NUM] | "stage" ID TEXTO ["size" NUM] ["in" ID]
             | "stagegroup" ID TEXTO ["color" TEXTO]
nodo         = ( "include" (REF | "*" | REF {"," REF}) | ("note"|"label"|"group"|"image"|"node") [TEXTO]
               | "visual" TIPO [TEXTO] ) ["as" ID] ["at" NUM "," NUM] ["size" NUM "," NUM] ["cell" ID ID]
               [ "{" { atributo | nodo } "}" ]
arista       = "edge" (REF | "*" | ) ["as" ID] ["from" REF] ["to" REF] ["via" NUM "," NUM {NUM "," NUM}]
               ["label" TEXTO] [ "{" { atributo } "}" ]
atributo     = ID VALOR
VALOR        = TEXTO | NUM | "true" | "false" | "null" | ID | "[" [VALOR {"," VALOR}] "]" | "{" [CLAVE ":" VALOR {"," …}] "}"
```

## Para desarrolladores {#api}

El paquete `@all-draw/io` expone una API estable (la usa también el editor de texto en vivo):

- `parseDsl(texto) → { workspace, diagnostics, unpositioned, locations }`: nunca lanza. `diagnostics` trae
  `severity`, `message` (traducido), `key`/`vars` y línea/columna de inicio y fin; `unpositioned`, las vistas que
  necesitan layout; `locations`, dónde empieza cada registro (`"elements/<id>"`, `"nodes/<id>"`…).
- `serializeDsl(workspace, { positions?, header?, indent? }) → texto`: determinista y sin pérdidas
  (`parseDsl(serializeDsl(ws)).workspace` es igual a `ws`). Con `positions: false` omite posiciones, tamaños y
  puntos de quiebre.
- `isDsl(texto)`: ¿parece este lenguaje?
